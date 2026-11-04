//! HERDR: mods' `video(path, options)` (the element is gpui-shell's; this plays it).
//!
//! A clip is keyed by its element's `.id()` (window-wide: prefix it with the mod's name). Until it
//! plays it is a still: the first frame (or the frame at the last seek), decoded once, so 50 idle
//! clips cost about 50 images and hold no player. Playing makes a player; pausing, ending or
//! leaving the screen releases it and keeps the last frame as the still. At most `MAX_PLAYING`
//! play at once (the longest playing pauses). A clip whose element stops painting (its mod closed,
//! or it left the layout) is dropped after `GONE`. Paths follow `image`'s rule: inside the app
//! directory (`gpui_shell::AppAssets::checked_path`).
//!
//! Mods drive clips with herdr's `videoPlay(id)`, `videoPause(id)`, `videoSeek(id, seconds)` and
//! read `nextVideoEvent(id)`: `{id, type, time, duration, error?}` with type `ready`, `time` (4 a
//! second while playing), `paused`, `ended` or `error`.

use gpui::{AnyElement, App, ElementId, InteractiveElement, IntoElement, ObjectFit, ParentElement, Refineable as _, SharedString, StyleRefinement, Styled, Window, canvas, div};
use gpui_shell::video::VideoSpec;
use serde_json::{Value, json};
use std::cell::RefCell;
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Players alive at once.
pub const MAX_PLAYING: usize = 4;
/// A playing clip not on screen this long pauses.
pub const OFFSCREEN: Duration = Duration::from_secs(1);
/// A clip whose element has not painted this long is dropped (player, still and all).
pub const GONE: Duration = Duration::from_secs(3);
/// How often `time` events go out while playing.
const TIME_EVERY: Duration = Duration::from_millis(250);
/// Events kept per clip for a slow reader; older ones are dropped.
const EVENTS_KEPT: usize = 64;

mod backend;
pub use backend::{Backend, PlayerState};

struct Clip<P, Pic> {
    spec: VideoSpec,
    /// Where the player is (or would start).
    time: f64,
    duration: Option<f64>,
    /// The picture shown when not playing: the still, then the last frame played.
    still: Option<Pic>,
    player: Option<P>,
    started: Option<Instant>,
    autoplayed: bool,
    painted: Instant,
    visible: Instant,
    last_time_event: Option<Instant>,
    ready_sent: bool,
}

/// All clips of this process, on GPUI's main thread.
pub struct Clips<B: Backend> {
    backend: B,
    root: std::path::PathBuf,
    clips: HashMap<String, Clip<B::Player, B::Picture>>,
    events: HashMap<String, (async_channel::Sender<Value>, async_channel::Receiver<Value>)>,
}

impl<B: Backend> Clips<B> {
    pub fn new(backend: B, root: std::path::PathBuf) -> Self {
        Self { backend, root, clips: HashMap::new(), events: HashMap::new() }
    }

    fn channel(&mut self, id: &str) -> &(async_channel::Sender<Value>, async_channel::Receiver<Value>) {
        self.events.entry(id.to_owned()).or_insert_with(|| async_channel::bounded(EVENTS_KEPT))
    }

    fn emit(&mut self, id: &str, kind: &str, error: Option<&str>) {
        let (time, duration) = self.clips.get(id).map_or((0.0, None), |c| (c.time, c.duration));
        let mut e = json!({ "id": id, "type": kind, "time": time, "duration": duration });
        if let Some(error) = error {
            e["error"] = json!(error);
        }
        let (tx, rx) = self.channel(id).clone();
        if tx.is_full() {
            let _ = rx.try_recv();
        }
        let _ = tx.try_send(e);
    }

    /// The next event of clip `id` (for `nextVideoEvent`).
    pub fn events_of(&mut self, id: &str) -> async_channel::Receiver<Value> {
        self.channel(id).1.clone()
    }

    fn path(&self, spec: &VideoSpec) -> Result<std::path::PathBuf, String> {
        gpui_shell::AppAssets::new(self.root.clone()).checked_path(&spec.path).map_err(|e| format!("{e:#}"))
    }

    /// The element painted this frame (`visible`: inside the window's content mask). Makes the clip
    /// and its still on first sight, starts autoplay, and returns the picture to show.
    pub fn painted(&mut self, id: &str, spec: &VideoSpec, visible: bool, now: Instant) -> Option<B::Picture> {
        let fresh = self.clips.get(id).is_none_or(|c| c.spec.path != spec.path);
        if fresh {
            if let Some(old) = self.clips.remove(id) {
                drop(old);
            }
            let still = match self.path(spec).and_then(|p| self.backend.still(&p, 0.0)) {
                Ok(s) => Some(s),
                Err(e) => {
                    self.clips.insert(id.to_owned(), Clip::new(spec.clone(), None, now));
                    self.emit(id, "error", Some(&e));
                    return None;
                }
            };
            self.clips.insert(id.to_owned(), Clip::new(spec.clone(), still, now));
        }
        let clip = self.clips.get_mut(id).expect("made above");
        clip.spec = spec.clone();
        clip.painted = now;
        if visible {
            clip.visible = now;
        }
        if spec.autoplay && !clip.autoplayed && visible {
            clip.autoplayed = true;
            let _ = self.play(id, now);
        }
        self.advance(id, now);
        let clip = self.clips.get(id)?;
        clip.still.clone()
    }

    /// Playing, position and length of clip `id` (the controls bar shows these).
    pub fn status(&self, id: &str) -> Option<(bool, f64, Option<f64>)> {
        self.clips.get(id).map(|c| (c.player.is_some(), c.time, c.duration))
    }

    /// Whether any clip is playing (the window keeps drawing frames while one is).
    pub fn any_playing(&self) -> bool {
        self.clips.values().any(|c| c.player.is_some())
    }

    pub fn play(&mut self, id: &str, now: Instant) -> Result<(), String> {
        let Some(clip) = self.clips.get(id) else { return Err(format!("no video {id:?} on screen")) };
        if clip.player.is_some() {
            return Ok(());
        }
        // Played again after the end: from the start.
        let at = if clip.duration.is_some_and(|d| clip.time >= d - 0.05) { 0.0 } else { clip.time };
        let spec = clip.spec.clone();
        let path = self.path(&spec)?;
        // The cap: the clip playing longest makes room.
        while self.clips.values().filter(|c| c.player.is_some()).count() >= MAX_PLAYING {
            let oldest = self.clips.iter().filter(|(_, c)| c.player.is_some()).min_by_key(|(_, c)| c.started).map(|(k, _)| k.clone());
            match oldest {
                Some(k) => self.pause(&k),
                None => break,
            }
        }
        let player = match self.backend.play(&path, at, spec.muted) {
            Ok(p) => p,
            Err(e) => {
                self.emit(id, "error", Some(&e));
                return Err(e);
            }
        };
        let clip = self.clips.get_mut(id).expect("checked above");
        (clip.player, clip.started) = (Some(player), Some(now));
        Ok(())
    }

    /// Releases the player; the last frame stays as the still.
    pub fn pause(&mut self, id: &str) {
        let Some(clip) = self.clips.get_mut(id) else { return };
        if clip.player.take().is_some() {
            clip.started = None;
            self.emit(id, "paused", None);
        }
    }

    pub fn seek(&mut self, id: &str, to: f64) -> Result<(), String> {
        let to = to.max(0.0);
        let path = { let clip = self.clips.get(id).ok_or_else(|| format!("no video {id:?} on screen"))?; self.path(&clip.spec)? };
        let clip = self.clips.get_mut(id).expect("checked above");
        let to = clip.duration.map_or(to, |d| to.min(d));
        clip.time = to;
        match clip.player.as_mut() {
            Some(p) => self.backend.seek(p, to),
            // Paused: the still shows the new position.
            None => {
                if let Ok(s) = self.backend.still(&path, to) {
                    clip.still = Some(s);
                }
            }
        }
        Ok(())
    }

    /// Pulls a playing clip's frame and reports time, ready, end (or loops) and errors.
    fn advance(&mut self, id: &str, now: Instant) {
        let Some(clip) = self.clips.get_mut(id) else { return };
        let Some(player) = clip.player.as_mut() else { return };
        if let Some(frame) = self.backend.frame(player) {
            clip.still = Some(frame);
        }
        let st = self.backend.state(player);
        clip.time = st.time;
        clip.duration = st.duration.or(clip.duration);
        let ready = !clip.ready_sent && clip.duration.is_some();
        let tick = clip.last_time_event.is_none_or(|t| now.duration_since(t) >= TIME_EVERY);
        let looped = clip.spec.looped;
        if ready {
            clip.ready_sent = true;
        }
        if tick {
            clip.last_time_event = Some(now);
        }
        if ready {
            self.emit(id, "ready", None);
        }
        if let Some(e) = st.error {
            self.clips.get_mut(id).expect("present").player = None;
            self.emit(id, "error", Some(&e));
            return;
        }
        if st.ended {
            let clip = self.clips.get_mut(id).expect("present");
            if looped {
                clip.time = 0.0;
                if let Some(p) = clip.player.as_mut() {
                    self.backend.seek(p, 0.0);
                }
            } else {
                (clip.player, clip.started) = (None, None);
                self.emit(id, "ended", None);
            }
            return;
        }
        if tick {
            self.emit(id, "time", None);
        }
    }

    /// Off screen too long: pause. Not painted too long (its mod closed): drop it entirely.
    pub fn sweep(&mut self, now: Instant) {
        let offscreen: Vec<String> = self.clips.iter().filter(|(_, c)| c.player.is_some() && now.duration_since(c.visible) >= OFFSCREEN).map(|(k, _)| k.clone()).collect();
        for id in offscreen {
            self.pause(&id);
        }
        let gone: Vec<String> = self.clips.iter().filter(|(_, c)| now.duration_since(c.painted) >= GONE).map(|(k, _)| k.clone()).collect();
        for id in gone {
            self.clips.remove(&id);
            self.events.remove(&id);
        }
    }

    #[cfg(test)]
    fn playing(&self) -> Vec<String> {
        let mut v: Vec<String> = self.clips.iter().filter(|(_, c)| c.player.is_some()).map(|(k, _)| k.clone()).collect();
        v.sort();
        v
    }
}

impl<P, Pic> Clip<P, Pic> {
    fn new(spec: VideoSpec, still: Option<Pic>, now: Instant) -> Self {
        Self { spec, time: 0.0, duration: None, still, player: None, started: None, autoplayed: false, painted: now, visible: now, last_time_event: None, ready_sent: false }
    }
}

// --- The app's clips, the element and herdr's functions --------------------------------------

#[cfg(target_os = "macos")]
type Native = mac::AvFoundation;
#[cfg(not(target_os = "macos"))]
type Native = Unsupported;

thread_local! {
    static CLIPS: RefCell<Option<Clips<Native>>> = const { RefCell::new(None) };
    static SWEEPING: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

fn with_clips<R>(f: impl FnOnce(&mut Clips<Native>) -> R) -> R {
    CLIPS.with_borrow_mut(|c| f(c.get_or_insert_with(|| Clips::new(Native::default(), crate::mods::app_dir()))))
}

/// Installs the renderer (before any window draws).
pub fn install() {
    gpui_shell::video::set_renderer(render);
}

fn render(spec: &VideoSpec, element: ElementId, key: Option<SharedString>, refinement: StyleRefinement, window: &mut Window, cx: &mut App) -> AnyElement {
    let id = key.map(|k| k.to_string()).unwrap_or_else(|| spec.path.clone());
    if !SWEEPING.get() {
        SWEEPING.set(true);
        cx.spawn(async move |cx| loop {
            cx.background_executor().timer(Duration::from_millis(500)).await;
            cx.update(|_| with_clips(|c| c.sweep(Instant::now())));
        })
        .detach();
    }
    let visible = std::rc::Rc::new(std::cell::Cell::new(false));
    // Shown last frame: what the clip had; this frame's visibility counts from the next paint.
    let picture = with_clips(|c| {
        let was_visible = c.clips.get(&id).is_none_or(|clip| Instant::now().duration_since(clip.visible) < OFFSCREEN);
        c.painted(&id, spec, was_visible, Instant::now())
    });
    if with_clips(|c| c.any_playing()) {
        // Frames come from the player on each draw.
        window.refresh();
    }
    let mut el = div().id(element).relative();
    el.style().refine(&refinement);
    #[cfg(target_os = "macos")]
    if let Some(p) = picture {
        el = el.child(gpui::surface(p).absolute().size_full().object_fit(ObjectFit::Contain));
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (picture, ObjectFit::Contain);
    if spec.controls {
        el = el.child(controls(&id));
    }
    let probe_id = id.clone();
    el.child(
        canvas(
            move |bounds, window, _| {
                let mask = window.content_mask().bounds;
                visible.set(mask.intersects(&bounds));
                if visible.get() {
                    with_clips(|c| {
                        if let Some(clip) = c.clips.get_mut(&probe_id) {
                            clip.visible = Instant::now();
                        }
                    });
                }
            },
            |_, _, _, _| {},
        )
        .absolute()
        .size_full(),
    )
    .into_any_element()
}

/// `controls: true`: a bar along the bottom with play/pause, a scrub track (click or drag to seek)
/// and the time. It drives the clip the way `videoPlay` / `videoPause` / `videoSeek` do.
fn controls(id: &str) -> AnyElement {
    use gpui::{MouseButton, Pixels, hsla, px, relative};
    let Some((playing, time, duration)) = with_clips(|c| c.status(id)) else { return div().into_any_element() };
    let track = std::rc::Rc::new(std::cell::Cell::new(gpui::Bounds::<Pixels>::default()));
    let (toggle, down) = (id.to_owned(), id.to_owned());
    let seek_at = std::rc::Rc::new(move |id: &str, x: Pixels, bounds: gpui::Bounds<Pixels>| {
        if let Some(d) = duration {
            let _ = with_clips(|c| c.seek(id, fraction_at(f32::from(x), f32::from(bounds.origin.x), f32::from(bounds.size.width)) * d));
        }
    });
    let (seek_down, seek_drag) = (seek_at.clone(), seek_at);
    let (track_down, track_drag, track_probe) = (track.clone(), track.clone(), track);
    let scrub_id = id.to_owned();
    let white = hsla(0.0, 0.0, 1.0, 1.0);
    div()
        .absolute()
        .left_0()
        .right_0()
        .bottom_0()
        .h(px(28.0))
        .px(px(8.0))
        .gap(px(8.0))
        .flex()
        .items_center()
        .bg(hsla(0.0, 0.0, 0.0, 0.55))
        .text_color(white)
        .text_xs()
        .child(
            div()
                .id(SharedString::from(format!("{id}-video-play")))
                .w(px(16.0))
                .cursor_pointer()
                .child(if playing { "❚❚" } else { "▶" })
                .on_mouse_down(MouseButton::Left, move |_, window, cx| {
                    cx.stop_propagation();
                    with_clips(|c| if playing { c.pause(&toggle) } else { let _ = c.play(&toggle, Instant::now()); });
                    window.refresh();
                }),
        )
        .child(
            div()
                .id(SharedString::from(format!("{id}-video-track")))
                .flex_1()
                .h(px(12.0))
                .flex()
                .items_center()
                .cursor_pointer()
                .child(
                    div().w_full().h(px(4.0)).rounded(px(2.0)).bg(hsla(0.0, 0.0, 1.0, 0.3)).relative().child(
                        div().absolute().left_0().top_0().bottom_0().rounded(px(2.0)).bg(white).w(relative(duration.map_or(0.0, |d| fraction(time, d)))),
                    ),
                )
                .child(
                    canvas(
                        move |bounds, _, _| track_probe.set(bounds),
                        // While this clip is being scrubbed, the whole window's moves and the release
                        // are the bar's: caught in the capture phase, so the mod under it never sees them.
                        move |_, _, window, _| {
                            if !scrubbing(&scrub_id) {
                                return;
                            }
                            let (id, seek, track) = (scrub_id.clone(), seek_drag.clone(), track_drag.clone());
                            window.on_mouse_event(move |e: &gpui::MouseMoveEvent, phase, window, cx| {
                                if phase == gpui::DispatchPhase::Capture && scrubbing(&id) {
                                    cx.stop_propagation();
                                    seek(&id, e.position.x, track.get());
                                    window.refresh();
                                }
                            });
                            let id = scrub_id.clone();
                            window.on_mouse_event(move |_: &gpui::MouseUpEvent, phase, window, cx| {
                                if phase == gpui::DispatchPhase::Capture && scrubbing(&id) {
                                    cx.stop_propagation();
                                    end_scrub();
                                    window.refresh();
                                }
                            });
                        },
                    )
                    .absolute()
                    .size_full(),
                )
                .on_mouse_down(MouseButton::Left, move |e, window, cx| {
                    cx.stop_propagation();
                    start_scrub(&down);
                    seek_down(&down, e.position.x, track_down.get());
                    window.refresh();
                }),
        )
        .child(format!("{} / {}", clock(time), duration.map_or("--:--".into(), clock)))
        .into_any_element()
}

thread_local! {
    /// The clip whose track the mouse is dragging (mouse down on it, not yet up).
    static SCRUB: RefCell<Option<String>> = const { RefCell::new(None) };
}

fn start_scrub(id: &str) {
    SCRUB.with_borrow_mut(|s| *s = Some(id.to_owned()));
}

fn end_scrub() {
    SCRUB.with_borrow_mut(|s| *s = None);
}

fn scrubbing(id: &str) -> bool {
    SCRUB.with_borrow(|s| s.as_deref() == Some(id))
}

/// How far along `time` is, 0..1.
fn fraction(time: f64, duration: f64) -> f32 {
    if duration > 0.0 { (time / duration).clamp(0.0, 1.0) as f32 } else { 0.0 }
}

/// Where a click at `x` falls on a track starting at `left`, `width` wide, 0..1.
fn fraction_at(x: f32, left: f32, width: f32) -> f64 {
    if width > 0.0 { ((x - left) / width).clamp(0.0, 1.0) as f64 } else { 0.0 }
}

/// `m:ss`, or `h:mm:ss` from an hour.
fn clock(seconds: f64) -> String {
    let s = seconds.max(0.0).round() as u64;
    if s >= 3600 { format!("{}:{:02}:{:02}", s / 3600, s / 60 % 60, s % 60) } else { format!("{}:{:02}", s / 60, s % 60) }
}

/// herdr's `videoPlay`, `videoPause`, `videoSeek`, `nextVideoEvent`.
pub fn functions(module: gpui_shell::HostModule) -> gpui_shell::HostModule {
    use gpui_shell::{HostError, HostValue};
    module
        .function("videoPlay", |a| {
            let id = a.string(0)?.to_owned();
            with_clips(|c| c.play(&id, Instant::now())).map_err(HostError::new)?;
            Ok(HostValue::Null)
        })
        .function("videoPause", |a| {
            let id = a.string(0)?.to_owned();
            with_clips(|c| c.pause(&id));
            Ok(HostValue::Null)
        })
        .function("videoSeek", |a| {
            let id = a.string(0)?.to_owned();
            let to = a.number(1)?;
            with_clips(|c| c.seek(&id, to)).map_err(HostError::new)?;
            Ok(HostValue::Null)
        })
        .async_function("nextVideoEvent", |a| {
            let id = a.string(0)?.to_owned();
            let rx = with_clips(|c| c.events_of(&id));
            Ok(async move { rx.recv().await.map(|e| crate::mods::to_host(&e)).map_err(|_| HostError::new("the video is gone")) })
        })
}

/// Off macOS nothing plays yet: every clip reports an error.
#[cfg(not(target_os = "macos"))]
#[derive(Default)]
pub struct Unsupported;

#[cfg(not(target_os = "macos"))]
impl Backend for Unsupported {
    type Player = ();
    type Picture = ();
    fn still(&self, _: &std::path::Path, _: f64) -> Result<(), String> {
        Err("video plays on macOS only for now".into())
    }
    fn play(&self, _: &std::path::Path, _: f64, _: bool) -> Result<(), String> {
        Err("video plays on macOS only for now".into())
    }
    fn frame(&self, _: &mut ()) -> Option<()> {
        None
    }
    fn state(&self, _: &()) -> PlayerState {
        PlayerState::default()
    }
    fn seek(&self, _: &mut (), _: f64) {}
}

#[cfg(target_os = "macos")]
mod mac;

#[cfg(test)]
mod tests;
