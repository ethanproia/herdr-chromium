//! `HERDR_APP_FRAME_STATS=1`: the app window's own frame timing, appended to
//! `<app home>/frame-stats.log`. Every 2 s per window: frames/s, draw ms (layout and scene, CPU),
//! present ms (renderer encode and commit, CPU), interval ms between presents, throttled and
//! skipped frame requests; and for the process: GPU ms per frame and drawable wait ms (GPU or
//! display back-pressure). `=2` also writes a line per frame. Off by default (GPUI then does one
//! atomic load per frame). Cannot see WindowServer compositing or scanout (1 to 2 vsyncs after
//! present), nor the browser host (its own browser/stats.log). Hooks: vendor/gpui-pre frame_stats.
//! A `herdr-app shot` (the only way a headless window draws) writes `window=N shot draw_ms=` and a
//! `shot summary` (shots, draw p50/p95), timed in app code: no present, so not in frames or intervals.

use gpui::frame_stats::{FrameSample, set_sink};
use std::collections::HashMap;
use std::io::Write;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const WINDOW: Duration = Duration::from_secs(2);

#[derive(Default)]
struct Win {
    frames: usize,
    draw: Vec<f64>,
    present: Vec<f64>,
    interval: Vec<f64>,
    last: Option<Instant>,
    throttled: usize,
    skipped: usize,
    /// Draws made for a `shot` (no present, so outside frames and intervals).
    shot: Vec<f64>,
}

struct State {
    out: std::fs::File,
    per_frame: bool,
    start: Instant,
    since: Instant,
    windows: HashMap<u64, Win>,
    gpu: Vec<f64>,
    wait: Vec<f64>,
}

/// The running recorder, also fed by `shot_draw` (app code; GPUI reports the rest through the sink).
static STATE: std::sync::OnceLock<Mutex<State>> = std::sync::OnceLock::new();

/// A `herdr-app shot` redrew `window` outside the display link: GPUI reports no frame for it, so the
/// app times `Window::draw` itself. Headless windows draw only this way, so agents can measure draw
/// cost without a shown window. Nothing happens when stats are off.
pub fn shot_draw(window: u64, draw_ms: f64) {
    if let Some(mut s) = STATE.get().and_then(|s| s.lock().ok()) {
        s.shot(window, draw_ms);
    }
}

/// Install the sink when `HERDR_APP_FRAME_STATS` is 1 or 2; otherwise do nothing.
pub fn start() {
    let level = std::env::var("HERDR_APP_FRAME_STATS").unwrap_or_default();
    if level != "1" && level != "2" {
        return;
    }
    let path = crate::mods::app_dir().join("frame-stats.log");
    let Ok(out) = std::fs::OpenOptions::new().create(true).append(true).open(&path) else {
        eprintln!("herdr-app: cannot open {}", path.display());
        return;
    };
    let now = Instant::now();
    let state = Mutex::new(State { out, per_frame: level == "2", start: now, since: now, windows: HashMap::new(), gpu: Vec::new(), wait: Vec::new() });
    {
        let mut s = state.lock().unwrap();
        let _ = writeln!(s.out, "0.0 start pid={}", std::process::id());
    }
    if STATE.set(state).is_err() {
        return;
    }
    set_sink(|sample| {
        if let Some(mut s) = STATE.get().and_then(|s| s.lock().ok()) {
            s.record(sample);
        }
    });
}

fn pct(v: &mut [f64], p: f64) -> f64 {
    v.sort_by(f64::total_cmp);
    if v.is_empty() { 0.0 } else { v[((v.len() - 1) as f64 * p).round() as usize] }
}

impl State {
    fn record(&mut self, sample: FrameSample) {
        let t = self.start.elapsed().as_secs_f64() * 1e3;
        match sample {
            FrameSample::Frame { window, draw_ms, present_ms, at } => {
                let w = self.windows.entry(window).or_default();
                w.frames += 1;
                w.draw.push(draw_ms);
                w.present.push(present_ms);
                let interval = w.last.map(|l| (at - l).as_secs_f64() * 1e3);
                if let Some(i) = interval {
                    w.interval.push(i);
                }
                w.last = Some(at);
                if self.per_frame {
                    let _ = writeln!(self.out, "{t:.1} window={window} frame draw_ms={draw_ms:.2} present_ms={present_ms:.2} interval_ms={}", interval.map_or("-".into(), |i| format!("{i:.2}")));
                }
            }
            FrameSample::PresentOnly { window, present_ms, at } => {
                let w = self.windows.entry(window).or_default();
                w.frames += 1;
                w.present.push(present_ms);
                if let Some(l) = w.last {
                    w.interval.push((at - l).as_secs_f64() * 1e3);
                }
                w.last = Some(at);
            }
            FrameSample::Throttled { window } => self.windows.entry(window).or_default().throttled += 1,
            FrameSample::Skipped { window } => self.windows.entry(window).or_default().skipped += 1,
            FrameSample::Gpu { ms } => self.gpu.push(ms),
            FrameSample::DrawableWait { ms } => self.wait.push(ms),
        }
        self.maybe_summary(t);
    }

    /// A shot's draw: always one line (shots are rare), and counted in the window's shot summary.
    fn shot(&mut self, window: u64, draw_ms: f64) {
        let t = self.start.elapsed().as_secs_f64() * 1e3;
        self.windows.entry(window).or_default().shot.push(draw_ms);
        let _ = writeln!(self.out, "{t:.1} window={window} shot draw_ms={draw_ms:.2}");
        self.maybe_summary(t);
    }

    fn maybe_summary(&mut self, t: f64) {
        let span = self.since.elapsed();
        if span >= WINDOW {
            self.summary(t, span);
        }
    }

    fn summary(&mut self, t: f64, span: Duration) {
        let secs = span.as_secs_f64();
        let mut ids: Vec<u64> = self.windows.keys().copied().collect();
        ids.sort();
        for id in ids {
            let w = self.windows.get_mut(&id).expect("listed");
            if !w.shot.is_empty() {
                let line = format!("{t:.1} window={id} shot summary shots={} draw_p50_ms={:.2} draw_p95_ms={:.2}", w.shot.len(), pct(&mut w.shot, 0.5), pct(&mut w.shot, 0.95));
                let _ = writeln!(self.out, "{line}");
                w.shot.clear();
            }
            if w.frames == 0 && w.throttled == 0 {
                continue;
            }
            let line = format!(
                "{t:.1} window={id} summary frames_per_s={:.1} draw_p50_ms={:.2} draw_p95_ms={:.2} present_p50_ms={:.2} present_p95_ms={:.2} interval_p50_ms={:.2} interval_p95_ms={:.2} throttled={} skipped={}",
                w.frames as f64 / secs,
                pct(&mut w.draw, 0.5),
                pct(&mut w.draw, 0.95),
                pct(&mut w.present, 0.5),
                pct(&mut w.present, 0.95),
                pct(&mut w.interval, 0.5),
                pct(&mut w.interval, 0.95),
                w.throttled,
                w.skipped
            );
            let _ = writeln!(self.out, "{line}");
            *w = Win { last: w.last, ..Win::default() };
        }
        if !self.gpu.is_empty() || !self.wait.is_empty() {
            let line = format!(
                "{t:.1} gpu summary gpu_p50_ms={:.2} gpu_p95_ms={:.2} drawable_wait_p50_ms={:.2} drawable_wait_p95_ms={:.2} gpu_frames={}",
                pct(&mut self.gpu, 0.5),
                pct(&mut self.gpu, 0.95),
                pct(&mut self.wait, 0.5),
                pct(&mut self.wait, 0.95),
                self.gpu.len()
            );
            let _ = writeln!(self.out, "{line}");
        }
        self.gpu.clear();
        self.wait.clear();
        self.since = Instant::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summary_lines_from_samples() {
        let path = std::env::temp_dir().join(format!("herdr-frame-stats-{}.log", std::process::id()));
        let out = std::fs::File::create(&path).unwrap();
        let now = Instant::now();
        let mut s = State { out, per_frame: true, start: now, since: now, windows: HashMap::new(), gpu: Vec::new(), wait: Vec::new() };
        for i in 0..10u64 {
            s.record(FrameSample::Frame { window: 7, draw_ms: 3.0, present_ms: 1.0, at: now + Duration::from_millis(16 * i) });
            s.record(FrameSample::Gpu { ms: 2.0 });
            s.record(FrameSample::DrawableWait { ms: 0.5 });
        }
        // The 2 s window ends: the next sample writes the summaries.
        s.since = now - WINDOW;
        s.record(FrameSample::Throttled { window: 7 });
        let log = std::fs::read_to_string(&path).unwrap();
        let _ = std::fs::remove_file(&path);
        assert_eq!(log.lines().filter(|l| l.contains(" frame ")).count(), 10, "{log}");
        let summary = log.lines().find(|l| l.contains("window=7 summary")).expect("window summary");
        for want in ["draw_p50_ms=3.00", "present_p95_ms=1.00", "interval_p50_ms=16.00", "throttled=1"] {
            assert!(summary.contains(want), "{want} missing: {summary}");
        }
        assert!(!log.contains("shot"), "no shot lines without shots");
        let gpu = log.lines().find(|l| l.contains("gpu summary")).expect("gpu summary");
        assert!(gpu.contains("gpu_p95_ms=2.00") && gpu.contains("drawable_wait_p50_ms=0.50") && gpu.contains("gpu_frames=10"), "{gpu}");
    }

    #[test]
    fn shot_draws_are_logged_and_summarised_apart_from_frames() {
        let path = std::env::temp_dir().join(format!("herdr-frame-stats-shot-{}.log", std::process::id()));
        let out = std::fs::File::create(&path).unwrap();
        let now = Instant::now();
        let mut s = State { out, per_frame: false, start: now, since: now, windows: HashMap::new(), gpu: Vec::new(), wait: Vec::new() };
        s.shot(3, 12.0);
        s.shot(3, 20.0);
        s.since = now - WINDOW;
        s.shot(3, 16.0);
        let log = std::fs::read_to_string(&path).unwrap();
        let _ = std::fs::remove_file(&path);
        assert_eq!(log.lines().filter(|l| l.contains("window=3 shot draw_ms=")).count(), 3, "{log}");
        let summary = log.lines().find(|l| l.contains("window=3 shot summary")).expect("shot summary");
        assert!(summary.contains("shots=3") && summary.contains("draw_p50_ms=16.00") && summary.contains("draw_p95_ms=20.00"), "{summary}");
        assert!(!log.contains("window=3 summary"), "a shot is not a presented frame: {log}");
    }
}
