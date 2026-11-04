//! HERDR: mods' `video(path, options)` (the element is gpui-shell's; this plays it).
//!
//! A clip is keyed by the mod copy that draws it and its element's `.id()`. Until it
//! plays it is a still: the first frame (or the frame at the last seek), decoded once, so 50 idle
//! clips cost about 50 images and hold no player. Playing makes a player; pausing, ending or
//! leaving the screen releases it and keeps the last frame as the still. At most `MAX_PLAYING`
//! play at once (the longest playing pauses); a playing clip outside its window's visible area for
//! `OFFSCREEN` pauses. A clip that stops rendering (its mod closed, or it left the layout) is
//! dropped after `GONE` while it holds a player, or `GONE_IDLE` as a still (a cached view may skip
//! renders while it stays on screen). Paths follow `image`'s rule: inside the app directory
//! (`gpui_shell::AppAssets::checked_path`).
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
/// A clip with a player that has not rendered this long is dropped (player, still and all).
pub const GONE: Duration = Duration::from_secs(3);
/// A still (no player) that has not rendered this long is dropped.
pub const GONE_IDLE: Duration = Duration::from_secs(60);
/// How often `time` events go out while playing.
const TIME_EVERY: Duration = Duration::from_millis(250);
/// Events kept per clip for a slow reader; older ones are dropped.
const EVENTS_KEPT: usize = 64;

mod backend;
pub use backend::{Backend, PlayerState};

struct Clip<P, Pic> {
    /// The script's `.id()` (events carry it; the map key adds the mod copy).
    name: String,
    spec: VideoSpec,
    /// Where the player is (or would start).
    time: f64,
    duration: Option<f64>,
    /// The picture shown when not playing: the still, then the last frame played.
    still: Option<Pic>,
    player: Option<P>,
    started: Option<Instant>,
    autoplayed: bool,
    rendered: Instant,
    /// Last seen inside the window's visible area (layout says so, not a guess).
    visible: Option<Instant>,
    last_time_event: Option<Instant>,
    ready_sent: bool,
    /// This clip's events; dropping the clip closes them (waiting readers get an error).
    events: (async_channel::Sender<Value>, async_channel::Receiver<Value>),
}

/// All clips of this process, on GPUI's main thread.
pub struct Clips<B: Backend> {
    backend: B,
    root: std::path::PathBuf,
    clips: HashMap<String, Clip<B::Player, B::Picture>>,
}

/// The map key of clip `id` drawn by the mod copy `scope`.
pub fn key(scope: usize, id: &str) -> String {
    format!("{scope}/{id}")
}

impl<B: Backend> Clips<B> {
    pub fn new(backend: B, root: std::path::PathBuf) -> Self {
        Self { backend, root, clips: HashMap::new() }
    }

    fn emit(&mut self, id: &str, kind: &str, error: Option<&str>) {
        let Some(clip) = self.clips.get(id) else { return };
        let mut e = json!({ "id": clip.name, "type": kind, "time": clip.time, "duration": clip.duration });
        if let Some(error) = error {
            e["error"] = json!(error);
        }
        let (tx, rx) = &clip.events;
        if tx.is_full() {
            let _ = rx.try_recv();
        }
        let _ = tx.try_send(e);
    }

    /// The events of clip `id` (for `nextVideoEvent`); None when no such clip is on screen.
    pub fn events_of(&self, id: &str) -> Option<async_channel::Receiver<Value>> {
        self.clips.get(id).map(|c| c.events.1.clone())
    }

    fn path(&self, spec: &VideoSpec) -> Result<std::path::PathBuf, String> {
        gpui_shell::AppAssets::new(self.root.clone()).checked_path(&spec.path).map_err(|e| format!("{e:#}"))
    }

    /// The element rendered this frame (clip `id` named `name` by its script). Makes the clip and its
    /// still on first sight (a new path replaces the clip, closing its events), advances a playing
    /// one, and returns the picture to show.
    pub fn rendered(&mut self, id: &str, name: &str, spec: &VideoSpec, now: Instant) -> Option<B::Picture> {
        let fresh = self.clips.get(id).is_none_or(|c| c.spec.path != spec.path);
        if fresh {
            // Dropping the old clip closes its events and releases its player.
            self.clips.remove(id);
            let still = self.path(spec).and_then(|p| self.backend.still(&p, 0.0));
            self.clips.insert(id.to_owned(), Clip::new(name, spec.clone(), still.as_ref().ok().cloned(), now));
            if let Err(e) = still {
                self.emit(id, "error", Some(&e));
                return None;
            }
        }
        let clip = self.clips.get_mut(id).expect("made above");
        clip.spec = spec.clone();
        clip.rendered = now;
        self.advance(id, now);
        let clip = self.clips.get(id)?;
        clip.still.clone()
    }

    /// Layout placed clip `id` inside its window's visible area this frame. Autoplay starts here, on
    /// the first sighting, never on a guess.
    pub fn seen(&mut self, id: &str, now: Instant) {
        let Some(clip) = self.clips.get_mut(id) else { return };
        clip.visible = Some(now);
        if clip.spec.autoplay && !clip.autoplayed {
            clip.autoplayed = true;
            let _ = self.play(id, now);
        }
    }

    /// Playing, position and length of clip `id` (the controls bar shows these).
    pub fn status(&self, id: &str) -> Option<(bool, f64, Option<f64>)> {
        self.clips.get(id).map(|c| (c.player.is_some(), c.time, c.duration))
    }

    /// Whether any clip is playing.
    #[cfg(test)]
    pub fn any_playing(&self) -> bool {
        self.clips.values().any(|c| c.player.is_some())
    }

    pub fn play(&mut self, id: &str, now: Instant) -> Result<(), String> {
        let Some(clip) = self.clips.get(id) else { return Err(format!("no video {:?} on screen", id.split_once('/').map_or(id, |(_, n)| n))) };
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
        let path = { let clip = self.clips.get(id).ok_or_else(|| format!("no video {:?} on screen", id.split_once('/').map_or(id, |(_, n)| n)))?; self.path(&clip.spec)? };
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

    /// Off screen too long: pause. Not rendered too long (its mod closed): drop it entirely, which
    /// releases its player and closes its events.
    pub fn sweep(&mut self, now: Instant) {
        // Gone first: a closed mod's playing clips go with their players, before the pause below
        // would turn them into stills that wait GONE_IDLE.
        self.clips.retain(|_, c| now.duration_since(c.rendered) < if c.player.is_some() { GONE } else { GONE_IDLE });
        let offscreen: Vec<String> = self
            .clips
            .iter()
            .filter(|(_, c)| c.player.is_some() && c.visible.or(c.started).is_none_or(|v| now.duration_since(v) >= OFFSCREEN))
            .map(|(k, _)| k.clone())
            .collect();
        for id in offscreen {
            self.pause(&id);
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
    fn new(name: &str, spec: VideoSpec, still: Option<Pic>, now: Instant) -> Self {
        Self {
            name: name.to_owned(),
            spec,
            time: 0.0,
            duration: None,
            still,
            player: None,
            started: None,
            autoplayed: false,
            rendered: now,
            visible: None,
            last_time_event: None,
            ready_sent: false,
            events: async_channel::bounded(EVENTS_KEPT),
        }
    }
}

// --- The app's clips, the element and herdr's functions --------------------------------------

/// Where a backend's clips live and how its pictures are shown: the app's AVFoundation clips, or a
/// test's fake ones (the element and its frame loop are the same either way).
pub trait Host: Backend + Sized + 'static {
    fn with<R>(f: impl FnOnce(&mut Clips<Self>) -> R) -> R;
    fn show(picture: Self::Picture) -> AnyElement;
}

#[cfg(target_os = "macos")]
type Native = mac::AvFoundation;
#[cfg(not(target_os = "macos"))]
type Native = Unsupported;

thread_local! {
    static CLIPS: RefCell<Option<Clips<Native>>> = const { RefCell::new(None) };
    static SWEEPING: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

impl Host for Native {
    fn with<R>(f: impl FnOnce(&mut Clips<Self>) -> R) -> R {
        CLIPS.with_borrow_mut(|c| f(c.get_or_insert_with(|| Clips::new(Native::default(), crate::mods::app_dir()))))
    }
    #[cfg(target_os = "macos")]
    fn show(picture: Self::Picture) -> AnyElement {
        gpui::surface(picture).absolute().size_full().object_fit(ObjectFit::Contain).into_any_element()
    }
    #[cfg(not(target_os = "macos"))]
    fn show(_: ()) -> AnyElement {
        let _ = ObjectFit::Contain;
        div().into_any_element()
    }
}

/// Installs the renderer (before any window draws).
pub fn install() {
    gpui_shell::video::set_renderer(|spec, element, key, scope, refinement, window, cx| render::<Native>(spec, element, key, scope, refinement, window, cx));
}

fn render<H: Host>(spec: &VideoSpec, element: ElementId, key: Option<SharedString>, scope: usize, refinement: StyleRefinement, window: &mut Window, cx: &mut App) -> AnyElement {
    let name = key.map(|k| k.to_string()).unwrap_or_else(|| spec.path.clone());
    let id = self::key(scope, &name);
    if !SWEEPING.get() {
        SWEEPING.set(true);
        cx.spawn(async move |cx| loop {
            cx.background_executor().timer(Duration::from_millis(500)).await;
            cx.update(|_| H::with(|c| c.sweep(Instant::now())));
        })
        .detach();
    }
    let picture = H::with(|c| c.rendered(&id, &name, spec, Instant::now()));
    if H::with(|c| c.status(&id).is_some_and(|(playing, _, _)| playing)) {
        // A playing clip renders again next frame (its view, not a refresh: a refresh during a
        // draw is dropped), pulling the next picture, time and end on its own.
        window.request_animation_frame();
    }
    let mut el = div().id(element).relative();
    el.style().refine(&refinement);
    if let Some(p) = picture {
        el = el.child(H::show(p));
    }
    if spec.controls {
        el = el.child(controls::<H>(&id));
    }
    let probe_id = id.clone();
    el.child(
        canvas(
            move |bounds, window, _| {
                if window.content_mask().bounds.intersects(&bounds) {
                    H::with(|c| c.seen(&probe_id, Instant::now()));
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
fn controls<H: Host>(id: &str) -> AnyElement {
    use gpui::{MouseButton, Pixels, hsla, px, relative};
    let Some((playing, time, duration)) = H::with(|c| c.status(id)) else { return div().into_any_element() };
    let track = std::rc::Rc::new(std::cell::Cell::new(gpui::Bounds::<Pixels>::default()));
    let (toggle, down) = (id.to_owned(), id.to_owned());
    let seek_at = std::rc::Rc::new(move |id: &str, x: Pixels, bounds: gpui::Bounds<Pixels>| {
        if let Some(d) = duration {
            let _ = H::with(|c| c.seek(id, fraction_at(f32::from(x), f32::from(bounds.origin.x), f32::from(bounds.size.width)) * d));
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
                    H::with(|c| if playing { c.pause(&toggle) } else { let _ = c.play(&toggle, Instant::now()); });
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

/// herdr's `videoPlay`, `videoPause`, `videoSeek`, `nextVideoEvent`: each acts on the clip with that
/// `.id()` drawn by the calling mod copy, and redraws its window.
pub fn functions(module: gpui_shell::HostModule) -> gpui_shell::HostModule {
    use gpui_shell::{HostError, HostValue};
    fn clip(a: &gpui_shell::HostArguments) -> Result<String, HostError> {
        let scope = gpui_shell::video::current_scope().ok_or_else(|| HostError::new("video functions are for mods"))?;
        Ok(key(scope, a.string(0)?))
    }
    module
        .function("videoPlay", |a| {
            let id = clip(a)?;
            Native::with(|c| c.play(&id, Instant::now())).map_err(HostError::new)?;
            gpui_shell::video::invalidate_current();
            Ok(HostValue::Null)
        })
        .function("videoPause", |a| {
            let id = clip(a)?;
            Native::with(|c| c.pause(&id));
            gpui_shell::video::invalidate_current();
            Ok(HostValue::Null)
        })
        .function("videoSeek", |a| {
            let (id, to) = (clip(a)?, a.number(1)?);
            Native::with(|c| c.seek(&id, to)).map_err(HostError::new)?;
            gpui_shell::video::invalidate_current();
            Ok(HostValue::Null)
        })
        .async_function("nextVideoEvent", |a| {
            let id = clip(a)?;
            let name = a.string(0)?.to_owned();
            let rx = Native::with(|c| c.events_of(&id)).ok_or_else(|| HostError::new(format!("no video {name:?} on screen")))?;
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
