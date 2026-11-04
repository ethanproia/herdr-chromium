//! The clip rules with a fake player: stills until played, the cap, visibility, release when the
//! element is gone, end and loop, per-copy keys and events, the path rule, and the frame loop.

use super::*;
use std::cell::RefCell;
use std::rc::Rc;

#[derive(Default)]
struct Log {
    stills: usize,
    opened: usize,
    released: usize,
}

#[derive(Clone, Default)]
struct Fake(Rc<RefCell<Log>>);

struct FakePlayer {
    log: Rc<RefCell<Log>>,
    time: f64,
    ended: bool,
}

impl Drop for FakePlayer {
    fn drop(&mut self) {
        self.log.borrow_mut().released += 1;
    }
}

impl Backend for Fake {
    type Player = FakePlayer;
    type Picture = String;
    fn still(&self, path: &std::path::Path, at: f64) -> Result<String, String> {
        self.0.borrow_mut().stills += 1;
        Ok(format!("{}@{at}", path.file_name().unwrap().to_string_lossy()))
    }
    fn play(&self, _: &std::path::Path, at: f64, _: bool) -> Result<FakePlayer, String> {
        self.0.borrow_mut().opened += 1;
        Ok(FakePlayer { log: self.0.clone(), time: at, ended: false })
    }
    fn frame(&self, p: &mut FakePlayer) -> Option<String> {
        p.time += 1.0;
        Some(format!("frame@{}", p.time))
    }
    fn state(&self, p: &FakePlayer) -> PlayerState {
        PlayerState { time: p.time, duration: Some(10.0), ended: p.ended || p.time >= 10.0, error: None }
    }
    fn seek(&self, p: &mut FakePlayer, to: f64) {
        (p.time, p.ended) = (to, false);
    }
}

thread_local! {
    static FAKE: RefCell<Option<Clips<Fake>>> = const { RefCell::new(None) };
}

impl Host for Fake {
    fn with<R>(f: impl FnOnce(&mut Clips<Self>) -> R) -> R {
        FAKE.with_borrow_mut(|c| f(c.as_mut().expect("a test installs its clips")))
    }
    fn show(picture: String) -> AnyElement {
        div().child(picture).into_any_element()
    }
}

fn setup() -> (tempfile_dir::Dir, Fake, Clips<Fake>) {
    let dir = tempfile_dir::Dir::new();
    for n in 0..8 {
        std::fs::write(dir.0.join(format!("c{n}.mp4")), b"x").unwrap();
    }
    let fake = Fake::default();
    let clips = Clips::new(fake.clone(), dir.0.clone());
    (dir, fake, clips)
}

fn spec(n: usize) -> VideoSpec {
    VideoSpec { path: format!("c{n}.mp4"), ..VideoSpec::default() }
}

/// Renders clip `id` (named the same) and, when `on_screen`, has layout see it.
fn frame(c: &mut Clips<Fake>, id: &str, spec: &VideoSpec, on_screen: bool, now: Instant) -> Option<String> {
    let p = c.rendered(id, id, spec, now);
    if on_screen {
        c.seen(id, now);
    }
    p
}

fn drain(c: &mut Clips<Fake>, id: &str) -> Vec<String> {
    let rx = c.events_of(id).expect("a clip on screen");
    std::iter::from_fn(|| rx.try_recv().ok()).map(|e| e["type"].as_str().unwrap().to_owned()).collect()
}

#[test]
fn an_idle_clip_is_a_still_and_holds_no_player() {
    let (_d, fake, mut c) = setup();
    let now = Instant::now();
    for n in 0..8 {
        assert_eq!(frame(&mut c, &format!("v{n}"), &spec(n), true, now), Some(format!("c{n}.mp4@0")));
        // Rendering again does not decode again.
        frame(&mut c, &format!("v{n}"), &spec(n), true, now);
    }
    assert_eq!((fake.0.borrow().stills, fake.0.borrow().opened), (8, 0));
    assert!(!c.any_playing());
}

#[test]
fn play_pause_and_seek_from_code() {
    let (_d, fake, mut c) = setup();
    let now = Instant::now();
    frame(&mut c, "v", &spec(0), true, now);
    c.play("v", now).unwrap();
    assert!(c.any_playing());
    assert_eq!(frame(&mut c, "v", &spec(0), true, now), Some("frame@1".into()), "playing shows the player's frames");
    c.pause("v");
    assert!(!c.any_playing() && fake.0.borrow().released == 1, "pausing releases the player");
    assert_eq!(frame(&mut c, "v", &spec(0), true, now), Some("frame@1".into()), "the last frame stays as the still");
    c.seek("v", 4.0).unwrap();
    assert_eq!(frame(&mut c, "v", &spec(0), true, now), Some("c0.mp4@4".into()), "a paused seek shows that frame");
    c.play("v", now).unwrap();
    assert_eq!(frame(&mut c, "v", &spec(0), true, now), Some("frame@5".into()), "play resumes from the seek");
    assert!(c.play("nope", now).unwrap_err().contains(r#""nope""#));
    let events = drain(&mut c, "v");
    assert!(events.contains(&"ready".into()) && events.contains(&"paused".into()) && events.contains(&"time".into()), "{events:?}");
}

#[test]
fn at_most_max_playing_and_the_oldest_makes_room() {
    let (_d, _fake, mut c) = setup();
    let t0 = Instant::now();
    for n in 0..=MAX_PLAYING {
        frame(&mut c, &format!("v{n}"), &spec(n), true, t0);
        c.play(&format!("v{n}"), t0 + Duration::from_millis(n as u64)).unwrap();
    }
    let playing = c.playing();
    assert_eq!(playing.len(), MAX_PLAYING);
    assert!(!playing.contains(&"v0".into()), "the first started made room: {playing:?}");
    assert!(drain(&mut c, "v0").contains(&"paused".into()));
}

/// P1-1: visibility is what layout says, every frame, not a guess fed back from the last one.
#[test]
fn a_clipped_clip_pauses_even_while_redrawn_and_an_idle_visible_one_stays() {
    let (_d, _fake, mut c) = setup();
    let t0 = Instant::now();
    // Looped, so neither ends while the frames go by.
    let (a, b) = (VideoSpec { looped: true, ..spec(0) }, VideoSpec { looped: true, ..spec(1) });
    frame(&mut c, "shown", &a, true, t0);
    frame(&mut c, "clipped", &b, true, t0);
    c.play("shown", t0).unwrap();
    c.play("clipped", t0).unwrap();
    // Both keep rendering every frame (a playing clip redraws); layout puts one outside the mask.
    let mut t = t0;
    while t < t0 + OFFSCREEN + Duration::from_millis(100) {
        t += Duration::from_millis(16);
        frame(&mut c, "shown", &a, true, t);
        frame(&mut c, "clipped", &b, false, t);
        c.sweep(t);
    }
    assert_eq!(c.playing(), vec!["shown".to_string()], "the clipped one paused despite redraws");
    // An idle still in a cached view renders once and is then skipped while it stays on screen.
    frame(&mut c, "idle", &spec(2), true, t);
    c.sweep(t + GONE + Duration::from_secs(5));
    assert!(c.status("idle").is_some(), "an idle still outlives GONE");
    c.sweep(t + GONE_IDLE);
    assert!(c.status("idle").is_none(), "but not GONE_IDLE");
}

#[test]
fn a_closed_mod_releases_its_players_and_closes_its_events() {
    let (_d, fake, mut c) = setup();
    let t0 = Instant::now();
    frame(&mut c, "a", &spec(0), true, t0);
    frame(&mut c, "b", &spec(1), true, t0);
    c.play("a", t0).unwrap();
    c.play("b", t0).unwrap();
    let waiting = c.events_of("a").unwrap();
    while waiting.try_recv().is_ok() {}
    // The mod closes: nothing renders any more.
    c.sweep(t0 + GONE);
    assert!(c.clips.is_empty(), "every playing clip dropped");
    assert_eq!(fake.0.borrow().released, 2, "and its player released");
    assert!(waiting.recv_blocking().is_err(), "a reader still waiting is told the video is gone");
}

#[test]
fn autoplay_waits_for_layout_and_end_or_loop_follow_the_option() {
    let (_d, _fake, mut c) = setup();
    let now = Instant::now();
    let auto = VideoSpec { autoplay: true, ..spec(0) };
    frame(&mut c, "v", &auto, false, now);
    assert!(!c.any_playing(), "not before layout has seen it on screen");
    frame(&mut c, "v", &auto, true, now);
    assert!(c.any_playing());
    c.clips.get_mut("v").unwrap().player.as_mut().unwrap().ended = true;
    frame(&mut c, "v", &auto, true, now);
    assert!(!c.any_playing() && drain(&mut c, "v").contains(&"ended".into()));
    frame(&mut c, "v", &auto, true, now);
    assert!(!c.any_playing(), "autoplay does not restart an ended clip");
    let looped = VideoSpec { autoplay: true, looped: true, ..spec(1) };
    frame(&mut c, "l", &looped, true, now);
    c.clips.get_mut("l").unwrap().player.as_mut().unwrap().ended = true;
    frame(&mut c, "l", &looped, true, now);
    assert!(c.any_playing() && !drain(&mut c, "l").contains(&"ended".into()), "a loop starts over");
}

/// P1-2: two mod copies using the same `.id()` have their own clips, players and events.
#[test]
fn two_copies_with_the_same_id_stay_apart() {
    let (_d, _fake, mut c) = setup();
    let now = Instant::now();
    let (one, two) = (key(1, "clip"), key(2, "clip"));
    c.rendered(&one, "clip", &spec(0), now);
    c.rendered(&two, "clip", &spec(1), now);
    c.play(&one, now).unwrap();
    assert_eq!(c.playing(), vec![one.clone()], "playing one copy's clip leaves the other's alone");
    let (e1, e2) = (drain(&mut c, &one), drain(&mut c, &two));
    assert!(e1.is_empty() && e2.is_empty(), "nothing sent yet: {e1:?} {e2:?}");
    c.pause(&one);
    let rx = c.events_of(&one).unwrap();
    let e = rx.try_recv().unwrap();
    assert_eq!((e["id"].as_str(), e["type"].as_str()), (Some("clip"), Some("paused")), "events carry the script's id");
    assert!(c.events_of(&two).unwrap().try_recv().is_err(), "and reach only their copy");
}

/// P1-3: no queue for an id that is not on screen; replacing a clip's source closes the old queue.
#[test]
fn events_exist_only_for_clips_on_screen() {
    let (_d, _fake, mut c) = setup();
    let now = Instant::now();
    for n in 0..5000 {
        assert!(c.events_of(&format!("ghost{n}")).is_none());
    }
    assert!(c.clips.is_empty(), "asking made nothing");
    c.rendered("v", "v", &spec(0), now);
    let old = c.events_of("v").unwrap();
    c.rendered("v", "v", &spec(1), now);
    assert!(old.recv_blocking().is_err(), "the replaced clip's readers are told it is gone");
    assert!(c.events_of("v").is_some(), "the new source has its own");
}

#[test]
fn paths_follow_the_image_rule() {
    let (d, fake, mut c) = setup();
    let now = Instant::now();
    let outside = d.0.parent().unwrap().join("outside.mp4");
    std::fs::write(&outside, b"x").unwrap();
    for (id, path) in [("up", "../outside.mp4"), ("abs", outside.to_str().unwrap()), ("missing", "nope.mp4")] {
        assert_eq!(frame(&mut c, id, &VideoSpec { path: path.into(), ..VideoSpec::default() }, true, now), None, "{path}");
        assert_eq!(drain(&mut c, id), vec!["error".to_string()], "{path}");
    }
    assert_eq!(fake.0.borrow().stills, 0, "nothing outside was opened");
}

#[cfg(unix)]
#[test]
fn a_link_out_of_the_app_dir_is_refused() {
    let (d, fake, mut c) = setup();
    let outside = d.0.parent().unwrap().join("outside.mp4");
    std::fs::write(&outside, b"x").unwrap();
    std::os::unix::fs::symlink(&outside, d.0.join("link.mp4")).unwrap();
    assert_eq!(frame(&mut c, "link", &VideoSpec { path: "link.mp4".into(), ..VideoSpec::default() }, true, Instant::now()), None);
    assert_eq!(drain(&mut c, "link"), vec!["error".to_string()]);
    assert_eq!(fake.0.borrow().stills, 0);
}

#[test]
fn play_after_the_end_starts_over() {
    let (_d, _fake, mut c) = setup();
    let now = Instant::now();
    frame(&mut c, "v", &spec(0), true, now);
    c.play("v", now).unwrap();
    c.seek("v", 10.0).unwrap();
    c.clips.get_mut("v").unwrap().player.as_mut().unwrap().ended = true;
    frame(&mut c, "v", &spec(0), true, now);
    assert!(drain(&mut c, "v").contains(&"ended".into()));
    c.play("v", now).unwrap();
    assert_eq!(c.clips["v"].player.as_ref().unwrap().time, 0.0, "from the start, not the end");
}

#[test]
fn the_controls_bar_maps_time_and_clicks() {
    assert_eq!((clock(0.0), clock(3.4), clock(75.0), clock(3725.0)), ("0:00".into(), "0:03".into(), "1:15".into(), "1:02:05".into()));
    assert_eq!((fraction(2.5, 10.0), fraction(12.0, 10.0), fraction(1.0, 0.0)), (0.25, 1.0, 0.0));
    assert_eq!((fraction_at(150.0, 100.0, 200.0), fraction_at(50.0, 100.0, 200.0), fraction_at(400.0, 100.0, 200.0)), (0.25, 0.0, 1.0));
    let (_d, _fake, mut c) = setup();
    let now = Instant::now();
    assert_eq!(c.status("v"), None);
    frame(&mut c, "v", &spec(0), true, now);
    assert_eq!(c.status("v"), Some((false, 0.0, None)));
    c.play("v", now).unwrap();
    frame(&mut c, "v", &spec(0), true, now);
    assert_eq!(c.status("v"), Some((true, 1.0, Some(10.0))), "what the bar shows while playing");
}

#[test]
fn a_scrub_belongs_to_one_clip_until_the_release() {
    assert!(!scrubbing("a"));
    start_scrub("a");
    assert!(scrubbing("a") && !scrubbing("b"), "only the clip under the press");
    end_scrub();
    assert!(!scrubbing("a"));
}

/// P0-1: a playing clip keeps its window drawing by itself. The window here draws only when
/// something asked for the next frame (as an idle window does): with no input, the picture must
/// still change and `ended` must arrive.
#[gpui::test]
fn a_playing_clip_draws_and_ends_with_no_input(cx: &mut gpui::TestAppContext) {
    struct View;
    impl gpui::Render for View {
        fn render(&mut self, window: &mut Window, cx: &mut gpui::Context<Self>) -> impl IntoElement {
            div().size_full().child(render::<Fake>(&spec(0), ElementId::Name("clip".into()), Some("clip".into()), 1, StyleRefinement::default(), window, cx))
        }
    }
    let (d, fake, clips) = setup();
    FAKE.with_borrow_mut(|c| *c = Some(clips));
    let (_view, cx) = cx.add_window_view(|_, _| View);
    let draw = |cx: &mut gpui::VisualTestContext| cx.update(|window, cx| window.draw(cx).clear(cx));
    draw(cx);
    let id = key(1, "clip");
    let events = Fake::with(|c| c.events_of(&id)).unwrap();
    Fake::with(|c| c.play(&id, Instant::now())).unwrap();
    // The play itself redraws once (the host call invalidates the window); after that, only asks.
    draw(cx);
    let (mut drawn, mut ended) = (1, false);
    for _ in 0..40 {
        if cx.update(|window, cx| window.simulate_next_frame(cx)) == 0 {
            break;
        }
        draw(cx);
        drawn += 1;
        ended |= std::iter::from_fn(|| events.try_recv().ok()).any(|e| e["type"] == "ended");
        if ended {
            break;
        }
    }
    // Before the fix the window drew once after play and then nothing asked for another frame.
    assert!(drawn >= 3, "the clip kept drawing on its own: {drawn} frames");
    assert!(ended, "and its end arrived without input");
    assert_eq!(fake.0.borrow().released, 1, "the ended clip released its player");
    FAKE.with_borrow_mut(|c| *c = None);
    drop(d);
}

/// A throwaway directory, removed on drop.
mod tempfile_dir {
    pub struct Dir(pub std::path::PathBuf);
    impl Dir {
        pub fn new() -> Self {
            use std::sync::atomic::{AtomicU64, Ordering};
            static N: AtomicU64 = AtomicU64::new(0);
            let base = std::env::temp_dir().join(format!("herdr-video-{}-{}", std::process::id(), N.fetch_add(1, Ordering::Relaxed)));
            let p = base.join("app");
            std::fs::create_dir_all(&p).unwrap();
            Dir(p)
        }
    }
    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(self.0.parent().unwrap());
        }
    }
}
