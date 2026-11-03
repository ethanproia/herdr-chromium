//! HERDR: optional frame timing for the embedding app (`HERDR_APP_FRAME_STATS` in herdr-app).
//! Off by default: every hook is one relaxed atomic load. The app installs a sink with
//! [`set_sink`], which turns recording on; GPUI and its renderer report [`FrameSample`]s to it.

use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

static ON: AtomicBool = AtomicBool::new(false);
static SINK: OnceLock<Box<dyn Fn(FrameSample) + Send + Sync>> = OnceLock::new();

/// One measurement. Times are milliseconds.
#[derive(Clone, Copy, Debug)]
pub enum FrameSample {
    /// A drawn and presented frame of `window`: CPU time of `Window::draw` (layout and scene) and
    /// of `Window::present` (renderer encode and commit), and when the present finished.
    Frame {
        /// The window's id (`WindowId::as_u64`).
        window: u64,
        /// CPU time of `Window::draw`.
        draw_ms: f64,
        /// CPU time of `Window::present`.
        present_ms: f64,
        /// When the present returned.
        at: Instant,
    },
    /// A present without a new draw (presentation kept alive during fast input).
    PresentOnly {
        /// The window's id.
        window: u64,
        /// CPU time of `Window::present`.
        present_ms: f64,
        /// When the present returned.
        at: Instant,
    },
    /// A frame request held back by the inactive-window or thermal frame-rate limit.
    Throttled {
        /// The window's id.
        window: u64,
    },
    /// A frame request with nothing to draw.
    Skipped {
        /// The window's id.
        window: u64,
    },
    /// The renderer waited `ms` for a drawable from the layer (GPU or display back-pressure).
    DrawableWait {
        /// Milliseconds blocked in `next_drawable`.
        ms: f64,
    },
    /// GPU execution time of one frame's command buffer (GPUEndTime - GPUStartTime).
    Gpu {
        /// Milliseconds on the GPU clock.
        ms: f64,
    },
}

/// True once a sink is installed.
#[inline]
pub fn enabled() -> bool {
    ON.load(Ordering::Relaxed)
}

/// Install the sink (first call wins) and start recording.
pub fn set_sink(sink: impl Fn(FrameSample) + Send + Sync + 'static) {
    if SINK.set(Box::new(sink)).is_ok() {
        ON.store(true, Ordering::Relaxed);
    }
}

/// Hand `sample` to the installed sink, if any.
pub fn record(sample: FrameSample) {
    if let Some(sink) = SINK.get() {
        sink(sample);
    }
}
