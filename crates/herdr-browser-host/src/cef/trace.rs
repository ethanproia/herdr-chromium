//! `HERDR_BROWSER_TRACE=1`: one line per frame event in `<browser dir>/trace-host.log`, stamped on
//! the machine's monotonic clock (CLOCK_UPTIME_RAW, ns) so they line up with the app's
//! `trace-app.log` (`scripts/browser-trace.py` joins them by seq). Off: one atomic load per event.

use std::io::Write;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

static ON: AtomicBool = AtomicBool::new(false);
static OUT: Mutex<Option<std::fs::File>> = Mutex::new(None);

unsafe extern "C" {
    fn clock_gettime_nsec_np(clock: u32) -> u64;
}

/// Nanoseconds on CLOCK_UPTIME_RAW (the same clock in every process on this machine).
pub fn now() -> u64 {
    const CLOCK_UPTIME_RAW: u32 = 8;
    unsafe { clock_gettime_nsec_np(CLOCK_UPTIME_RAW) }
}

pub fn open(dir: &std::path::Path) {
    if std::env::var_os("HERDR_BROWSER_TRACE").is_none_or(|v| v.is_empty() || v == "0") {
        return;
    }
    if let Ok(f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("trace-host.log")) {
        *OUT.lock().unwrap() = Some(f);
        ON.store(true, Ordering::Relaxed);
    }
}

pub fn on() -> bool {
    ON.load(Ordering::Relaxed)
}

/// `<ns> <event> <fields>`.
pub fn line(event: &str, fields: std::fmt::Arguments) {
    if !on() {
        return;
    }
    if let Some(f) = OUT.lock().unwrap().as_mut() {
        let _ = writeln!(f, "{} {event} {fields}", now());
    }
}
