//! The macOS player on a real 1 s clip (0.5 s red, then blue), on the main thread as in the app
//! (AVFoundation reports status through the main queue): stills are exact frames, and playing
//! gives frames, the duration and the end.

#[cfg(target_os = "macos")]
#[path = "../src/video/backend.rs"]
mod backend;
#[cfg(target_os = "macos")]
pub use backend::{Backend, PlayerState};
#[cfg(target_os = "macos")]
#[path = "../src/video/mac.rs"]
mod mac;

#[cfg(target_os = "macos")]
fn main() {
    use core_foundation::runloop::{CFRunLoop, kCFRunLoopDefaultMode};
    use std::time::{Duration, Instant};
    let clip = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/video/red-blue.mp4");
    let av = mac::AvFoundation;
    let red = |px: [u8; 4]| px[2] > 200 && px[0] < 60 && px[1] < 60;
    let blue = |px: [u8; 4]| px[0] > 200 && px[2] < 60 && px[1] < 60;
    let first = av.still(&clip, 0.0).unwrap();
    assert!(red(mac::middle_bgra(&first)), "still at 0: {:?}", mac::middle_bgra(&first));
    let later = av.still(&clip, 0.8).unwrap();
    assert!(blue(mac::middle_bgra(&later)), "still at 0.8: {:?}", mac::middle_bgra(&later));
    assert!(av.still(std::path::Path::new("/nonexistent.mp4"), 0.0).is_err());

    let mut p = av.play(&clip, 0.0, true).unwrap();
    let (mut frames, mut saw_blue, deadline) = (0, false, Instant::now() + Duration::from_secs(5));
    let state = loop {
        CFRunLoop::run_in_mode(unsafe { kCFRunLoopDefaultMode }, Duration::from_millis(15), false);
        if let Some(f) = av.frame(&mut p) {
            frames += 1;
            saw_blue |= blue(mac::middle_bgra(&f));
        }
        let st = av.state(&p);
        assert!(st.error.is_none(), "{st:?}");
        if st.ended || Instant::now() > deadline {
            break st;
        }
    };
    assert!(state.ended, "played to the end: {state:?}");
    assert!(state.duration.is_some_and(|d| (d - 1.0).abs() < 0.1), "{state:?}");
    assert!(frames >= 10 && saw_blue, "frames delivered: {frames}, reached the blue half: {saw_blue}");
    drop(p);
    println!("video play test passed: red still, exact blue still at 0.8 s, {frames} frames, ended at {:.2} s of {:.2}", state.time, state.duration.unwrap());
}

#[cfg(not(target_os = "macos"))]
fn main() {}
