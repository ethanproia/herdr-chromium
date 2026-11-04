//! `HERDR_BROWSER_BEGIN_FRAME=1`: pace Chromium's compositor with one external BeginFrame per
//! display vsync instead of CEF's own `windowless_frame_rate` timer. CEF's timer drifts against
//! the real refresh (measured: ~52 paints/s with periodic ~33 ms gaps on a quiet 60 Hz display);
//! a `CVDisplayLink` on the display does not drift, and it follows whatever rate the display
//! runs (60 Hz here, 120 Hz on ProMotion) with nothing to configure.
//!
//! The link's io thread only counts vsyncs; the host's message loop (which is CEF's UI thread)
//! sends `BrowserHost::send_external_begin_frame` once per vsync to each browser that wants a
//! frame. Browsers are created with `external_begin_frame_enabled` only when the link actually
//! started, so a link failure keeps CEF's own pacing. An idle page gets every Nth vsync (a
//! trickle, not none: a page that starts painting again must not wait forever), and a watchdog
//! nudges a browser whose BeginFrames drew no paint for 250 ms.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

/// The env switch: set and not "0" paces compositing externally.
pub fn enabled() -> bool {
    static ON: OnceLock<bool> = OnceLock::new();
    *ON.get_or_init(|| std::env::var_os("HERDR_BROWSER_BEGIN_FRAME").is_some_and(|v| !v.is_empty() && v != "0"))
}

/// Vsyncs the display-link io thread saw and the message loop has not taken yet.
static TICKS: AtomicU64 = AtomicU64::new(0);
static STARTED: OnceLock<bool> = OnceLock::new();

/// Whether a new browser may use external BeginFrames: the switch is on and the display link
/// runs. A link that failed to start leaves CEF's own pacing on (a browser made without
/// `external_begin_frame_enabled` keeps its internal timer).
pub fn on() -> bool {
    enabled() && *STARTED.get_or_init(start_link)
}

/// Vsyncs since the last call. Ticks arriving while the loop is busy coalesce into one: a late
/// BeginFrame is still worth one frame, never a burst to catch up.
pub fn take_ticks() -> u64 {
    TICKS.swap(0, Ordering::Relaxed)
}

fn start_link() -> bool {
    unsafe {
        let mut link: sys::CVDisplayLinkRef = std::ptr::null_mut();
        // The host has no window to ask for its display: the main display's vsync is used
        // (an approximation when the app sits on another display).
        if sys::CVDisplayLinkCreateWithCGDisplay(sys::CGMainDisplayID(), &mut link) != 0 || link.is_null() {
            return false;
        }
        let period = sys::CVDisplayLinkGetNominalOutputVideoRefreshPeriod(link);
        let hz = if period.time_value > 0 { period.time_scale as f64 / period.time_value as f64 } else { 0.0 };
        if sys::CVDisplayLinkSetOutputCallback(link, ticked, std::ptr::null_mut()) != 0 || sys::CVDisplayLinkStart(link) != 0 {
            sys::CVDisplayLinkRelease(link);
            return false;
        }
        super::debug(format_args!("display link on main display at {hz:.2} Hz"));
        // Never stopped or released, like the app's own display links: CVDisplayLinkStop only
        // flags the io thread to exit, and a straggler callback after release reads freed
        // memory. The link lives for the host process, which is all this needs.
        true
    }
}

unsafe extern "C" fn ticked(_l: sys::CVDisplayLinkRef, _now: *const CVTimeStamp, _out: *const CVTimeStamp, _in: i64, _out_f: *mut i64, _ctx: *mut std::ffi::c_void) -> i32 {
    TICKS.fetch_add(1, Ordering::Relaxed);
    0
}

type CVTimeStamp = std::ffi::c_void;

mod sys {
    #![allow(non_camel_case_types)]
    use std::ffi::c_void;

    pub type CVDisplayLinkRef = *mut c_void;
    pub type CVDisplayLinkOutputCallback = unsafe extern "C" fn(CVDisplayLinkRef, *const c_void, *const c_void, i64, *mut i64, *mut c_void) -> i32;

    #[repr(C)]
    pub struct CVTime {
        pub time_value: i64,
        pub time_scale: i32,
        pub flags: i32,
    }

    #[link(name = "CoreGraphics", kind = "framework")]
    #[link(name = "CoreVideo", kind = "framework")]
    unsafe extern "C" {
        pub fn CGMainDisplayID() -> u32;
        pub fn CVDisplayLinkCreateWithCGDisplay(display: u32, out: *mut CVDisplayLinkRef) -> i32;
        pub fn CVDisplayLinkSetOutputCallback(link: CVDisplayLinkRef, callback: CVDisplayLinkOutputCallback, user_info: *mut c_void) -> i32;
        pub fn CVDisplayLinkGetNominalOutputVideoRefreshPeriod(link: CVDisplayLinkRef) -> CVTime;
        pub fn CVDisplayLinkStart(link: CVDisplayLinkRef) -> i32;
        pub fn CVDisplayLinkRelease(link: CVDisplayLinkRef);
    }
}

/// A paint this recent means the page is animating or scrolling: keep pacing at display rate.
const LIVE: Duration = Duration::from_millis(300);
/// A paint-provoking event (input, resize, show, create) earns pacing this long with no paint.
const WAKE: Duration = Duration::from_millis(300);
/// BeginFrames went unanswered this long: nudge once (the compositor may have dropped them) and
/// keep pacing every vsync until a paint arrives.
const WATCHDOG: Duration = Duration::from_millis(250);
/// An idle browser still gets every Nth vsync (~5 Hz at 60 Hz): page-side changes (timers, late
/// invalidates) appear within ~200 ms instead of never, and their paint re-paces it to full rate.
const IDLE_TRICKLE: u64 = 12;

/// What `decide` wants done with a browser this vsync.
#[derive(Debug, PartialEq, Eq)]
pub enum Pace {
    /// Send one external BeginFrame.
    Frame,
    /// Send nothing.
    Skip,
    /// Send, and first nudge CEF's own pacing (watchdog: BeginFrames drew no paint for 250 ms).
    Watchdog,
}

/// One browser's pacing state (all on the host's single thread).
#[derive(Default)]
pub struct Pacing {
    /// When the last paint (view or popup) arrived.
    painted: Option<Instant>,
    /// A paint is likely until this deadline (input, resize, show, create set it).
    wake: Option<Instant>,
    /// When the current unpainted wants-frames stretch began, for the watchdog.
    first_want: Option<Instant>,
    /// The watchdog already nudged for the current unpainted stretch.
    watchdog: bool,
}

impl Pacing {
    /// A just-created browser wants its first paint.
    pub fn new() -> Pacing {
        let mut p = Pacing::default();
        p.want();
        p
    }

    /// A paint is likely soon: pace the browser for a while even if none arrives.
    pub fn want(&mut self) {
        self.wake = Some(Instant::now() + WAKE);
    }

    /// A paint arrived: the unpainted stretch is over, and the page is live for a while.
    pub fn painted(&mut self) {
        *self = Pacing { painted: Some(Instant::now()), ..Default::default() };
    }

    /// This vsync's decision. `shots` is a screenshot waiting on a hidden browser's next paint;
    /// `backed_up` is the frame pool full of unacked frames (a paint then only replaces the
    /// pending one, and the miss is the app's, so the watchdog clock does not run); `tick` is
    /// the process-wide vsync count, for the idle trickle.
    pub fn decide(&mut self, now: Instant, hidden: bool, shots: bool, backed_up: bool, tick: u64) -> Pace {
        if hidden && !shots {
            self.wake = None;
            self.first_want = None;
            return Pace::Skip;
        }
        if backed_up {
            return Pace::Skip;
        }
        let live = self.painted.is_some_and(|t| now.saturating_duration_since(t) < LIVE);
        let waking = self.wake.is_some_and(|w| now < w);
        if !live && !waking && !self.watchdog {
            self.first_want = None;
            return if tick % IDLE_TRICKLE == 0 { Pace::Frame } else { Pace::Skip };
        }
        if !live {
            let started = *self.first_want.get_or_insert(self.painted.unwrap_or(now));
            if !self.watchdog && now.saturating_duration_since(started) >= WATCHDOG {
                self.watchdog = true;
                return Pace::Watchdog;
            }
        }
        Pace::Frame
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(secs: u64) -> Instant {
        Instant::now() + Duration::from_secs(secs)
    }

    #[test]
    fn a_waking_browser_paces_until_it_paints() {
        let mut p = Pacing::new();
        assert_eq!(p.decide(at(0), false, false, false, 1), Pace::Frame);
        // Past the wake deadline with no paint it would go idle; while waking it stays paced.
        assert_eq!(p.decide(at(0) + WAKE / 2, false, false, false, 2), Pace::Frame);
        // An expired wake with no paint drops to the trickle, not full pacing.
        assert_eq!(p.decide(at(0) + WAKE + Duration::from_millis(1), false, false, false, 3), Pace::Skip);
        assert_eq!(p.decide(at(0) + WAKE + Duration::from_millis(2), false, false, false, IDLE_TRICKLE), Pace::Frame);
    }

    #[test]
    fn a_painting_browser_stays_paced_then_goes_idle() {
        let mut p = Pacing::default();
        p.painted = Some(at(0));
        assert_eq!(p.decide(at(0) + LIVE / 2, false, false, false, 5), Pace::Frame, "recent paint: live");
        assert_eq!(p.decide(at(0) + LIVE + Duration::from_millis(1), false, false, false, 5), Pace::Skip, "quiet page: idle");
    }

    #[test]
    fn the_watchdog_nudges_once_and_keeps_pacing() {
        let mut p = Pacing::new();
        assert_eq!(p.decide(at(0), false, false, false, 1), Pace::Frame);
        // 250 ms of wants-frames without a paint: nudge once.
        assert_eq!(p.decide(at(0) + WATCHDOG, false, false, false, 2), Pace::Watchdog);
        // Then it is paced every vsync until a paint arrives, even past the wake deadline.
        assert_eq!(p.decide(at(0) + WATCHDOG * 2, false, false, false, 3), Pace::Frame);
        assert_eq!(p.decide(at(0) + WATCHDOG * 4, false, false, false, 4), Pace::Frame);
        // A paint resets everything; the next quiet stretch is idle, not watchdog.
        p.painted();
        assert_eq!(p.decide(at(0) + Duration::from_secs(10), false, false, false, 5), Pace::Skip);
    }

    #[test]
    fn the_watchdog_counts_from_the_last_paint_not_the_last_tick() {
        let mut p = Pacing::default();
        p.painted = Some(at(0));
        p.wake = Some(at(0) + Duration::from_secs(60));
        // Still live at first: no watchdog.
        assert_eq!(p.decide(at(0) + LIVE / 2, false, false, false, 1), Pace::Frame);
        // 350 ms after the last paint while still wanting: the stretch began at the paint
        // (250 ms), not when `live` expired, or the nudge would wait until 550 ms.
        assert_eq!(p.decide(at(0) + Duration::from_millis(350), false, false, false, 2), Pace::Watchdog);
    }

    #[test]
    fn hidden_and_backed_up_browsers_are_skipped() {
        let mut p = Pacing::new();
        assert_eq!(p.decide(at(0), true, false, false, IDLE_TRICKLE), Pace::Skip, "hidden: nothing at all");
        assert_eq!(Pacing::new().decide(at(0), true, true, false, 1), Pace::Frame, "hidden but a shot waits: pace");
        // A full pool skips without starting the watchdog clock.
        p.painted = Some(at(0));
        assert_eq!(p.decide(at(0) + WATCHDOG * 2, false, false, true, 2), Pace::Skip);
        assert_eq!(p.decide(at(0) + WATCHDOG * 2, false, false, false, 2), Pace::Skip, "quiet after the stall, no late watchdog");
        // And a hidden stretch forgets the wake entirely.
        let mut p = Pacing::new();
        p.decide(at(0), true, false, false, 1);
        assert_eq!(p.decide(at(0) + Duration::from_secs(1), false, false, false, 1), Pace::Skip);
    }
}
