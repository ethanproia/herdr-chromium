//! The clip rules with a fake player: stills until played, the cap, offscreen pause, release when
//! the element is gone, end and loop, events, and the path rule.

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
        PlayerState { time: p.time, duration: Some(10.0), ended: p.ended, error: None }
    }
    fn seek(&self, p: &mut FakePlayer, to: f64) {
        (p.time, p.ended) = (to, false);
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

fn drain(c: &mut Clips<Fake>, id: &str) -> Vec<String> {
    let rx = c.events_of(id);
    std::iter::from_fn(|| rx.try_recv().ok()).map(|e| e["type"].as_str().unwrap().to_owned()).collect()
}

#[test]
fn an_idle_clip_is_a_still_and_holds_no_player() {
    let (_d, fake, mut c) = setup();
    let now = Instant::now();
    for n in 0..8 {
        assert_eq!(c.painted(&format!("v{n}"), &spec(n), true, now), Some(format!("c{n}.mp4@0")));
        // Painting again does not decode again.
        c.painted(&format!("v{n}"), &spec(n), true, now);
    }
    assert_eq!((fake.0.borrow().stills, fake.0.borrow().opened), (8, 0));
    assert!(!c.any_playing());
}

#[test]
fn play_pause_and_seek_from_code() {
    let (_d, fake, mut c) = setup();
    let now = Instant::now();
    c.painted("v", &spec(0), true, now);
    c.play("v", now).unwrap();
    assert!(c.any_playing());
    assert_eq!(c.painted("v", &spec(0), true, now), Some("frame@1".into()), "playing shows the player's frames");
    c.pause("v");
    assert!(!c.any_playing() && fake.0.borrow().released == 1, "pausing releases the player");
    assert_eq!(c.painted("v", &spec(0), true, now), Some("frame@1".into()), "the last frame stays as the still");
    c.seek("v", 4.0).unwrap();
    assert_eq!(c.painted("v", &spec(0), true, now), Some("c0.mp4@4".into()), "a paused seek shows that frame");
    c.play("v", now).unwrap();
    assert_eq!(c.painted("v", &spec(0), true, now), Some("frame@5".into()), "play resumes from the seek");
    assert!(c.play("nope", now).is_err());
    let events = drain(&mut c, "v");
    assert!(events.contains(&"ready".into()) && events.contains(&"paused".into()) && events.contains(&"time".into()), "{events:?}");
}

#[test]
fn at_most_max_playing_and_the_oldest_makes_room() {
    let (_d, _fake, mut c) = setup();
    let t0 = Instant::now();
    for n in 0..=MAX_PLAYING {
        c.painted(&format!("v{n}"), &spec(n), true, t0);
        c.play(&format!("v{n}"), t0 + Duration::from_millis(n as u64)).unwrap();
    }
    let playing = c.playing();
    assert_eq!(playing.len(), MAX_PLAYING);
    assert!(!playing.contains(&"v0".into()), "the first started made room: {playing:?}");
    assert!(drain(&mut c, "v0").contains(&"paused".into()));
}

#[test]
fn offscreen_pauses_and_a_closed_mod_releases_everything() {
    let (_d, fake, mut c) = setup();
    let t0 = Instant::now();
    c.painted("a", &spec(0), true, t0);
    c.painted("b", &spec(1), true, t0);
    c.play("a", t0).unwrap();
    c.play("b", t0).unwrap();
    // `a` keeps painting on screen; `b` paints but is scrolled out of view.
    let t1 = t0 + OFFSCREEN + Duration::from_millis(10);
    c.painted("a", &spec(0), true, t1);
    c.painted("b", &spec(1), false, t1);
    c.sweep(t1);
    assert_eq!(c.playing(), vec!["a".to_string()], "offscreen paused");
    // The mod closes: nothing paints any more.
    c.sweep(t1 + GONE);
    assert!(c.clips.is_empty() && !c.any_playing(), "every clip and player released");
    assert_eq!(fake.0.borrow().released, 2);
    assert!(c.events.is_empty(), "their event queues too");
}

#[test]
fn autoplay_starts_once_on_screen_and_end_or_loop_follow_the_option() {
    let (_d, _fake, mut c) = setup();
    let now = Instant::now();
    let auto = VideoSpec { autoplay: true, ..spec(0) };
    c.painted("v", &auto, false, now);
    assert!(!c.any_playing(), "not while off screen");
    c.painted("v", &auto, true, now);
    assert!(c.any_playing());
    c.clips.get_mut("v").unwrap().player.as_mut().unwrap().ended = true;
    c.painted("v", &auto, true, now);
    assert!(!c.any_playing() && drain(&mut c, "v").contains(&"ended".into()));
    c.painted("v", &auto, true, now);
    assert!(!c.any_playing(), "autoplay does not restart an ended clip");
    let looped = VideoSpec { autoplay: true, looped: true, ..spec(1) };
    c.painted("l", &looped, true, now);
    c.clips.get_mut("l").unwrap().player.as_mut().unwrap().ended = true;
    c.painted("l", &looped, true, now);
    assert!(c.any_playing() && !drain(&mut c, "l").contains(&"ended".into()), "a loop starts over");
}

#[test]
fn paths_follow_the_image_rule() {
    let (d, fake, mut c) = setup();
    let now = Instant::now();
    let outside = d.0.parent().unwrap().join("outside.mp4");
    std::fs::write(&outside, b"x").unwrap();
    std::os::unix::fs::symlink(&outside, d.0.join("link.mp4")).unwrap();
    for (id, path) in [("up", "../outside.mp4"), ("abs", outside.to_str().unwrap()), ("link", "link.mp4"), ("missing", "nope.mp4")] {
        assert_eq!(c.painted(id, &VideoSpec { path: path.into(), ..VideoSpec::default() }, true, now), None, "{path}");
        assert_eq!(drain(&mut c, id), vec!["error".to_string()], "{path}");
    }
    assert_eq!(fake.0.borrow().stills, 0, "nothing outside was opened");
    let _ = std::fs::remove_file(outside);
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
