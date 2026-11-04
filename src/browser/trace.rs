//! `HERDR_BROWSER_TRACE=1`: the app side of the frame trace, in `<app home>/browser/trace-app.log`,
//! on the same monotonic clock as the host's `trace-host.log` (CLOCK_UPTIME_RAW, ns), so
//! `scripts/browser-trace.py` can join them by seq. macOS only; off, one check per event.

use std::io::Write;
use std::sync::{Mutex, OnceLock};

static OUT: OnceLock<Option<Mutex<std::fs::File>>> = OnceLock::new();

#[cfg(target_os = "macos")]
fn now() -> u64 {
    unsafe extern "C" {
        fn clock_gettime_nsec_np(clock: u32) -> u64;
    }
    const CLOCK_UPTIME_RAW: u32 = 8;
    unsafe { clock_gettime_nsec_np(CLOCK_UPTIME_RAW) }
}

fn out() -> Option<&'static Mutex<std::fs::File>> {
    OUT.get_or_init(|| {
        if !cfg!(target_os = "macos") || std::env::var_os("HERDR_BROWSER_TRACE").is_none_or(|v| v.is_empty() || v == "0") {
            return None;
        }
        let dir = crate::mods::app_dir().join("browser");
        let _ = std::fs::create_dir_all(&dir);
        std::fs::OpenOptions::new().create(true).append(true).open(dir.join("trace-app.log")).ok().map(Mutex::new)
    })
    .as_ref()
}

/// `<ns> <event> <fields>`.
pub fn line(event: &str, fields: std::fmt::Arguments) {
    #[cfg(target_os = "macos")]
    if let Some(f) = out() {
        let _ = writeln!(f.lock().unwrap(), "{} {event} {fields}", now());
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (event, fields, out());
}
