//! Responsive mode: the device sizes a browser block can preview. The page gets a real viewport
//! of the device's size and scale (`Resize`); `Device` adds the mobile UA, touch and a coarse
//! pointer. User agents come only from this list (an agent picks a name or a size, never a UA).

use herdr_browser_protocol::Device;

#[derive(Debug, Clone, PartialEq)]
pub struct Preset {
    pub name: &'static str,
    pub w: f32,
    pub h: f32,
    pub scale: f32,
    pub mobile: bool,
    pub user_agent: Option<&'static str>,
}

const IPHONE_UA: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA: &str = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const IPAD_UA: &str = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

pub const PRESETS: [Preset; 3] = [
    Preset { name: "iPhone 15", w: 390.0, h: 844.0, scale: 3.0, mobile: true, user_agent: Some(IPHONE_UA) },
    Preset { name: "Pixel 8", w: 412.0, h: 915.0, scale: 2.625, mobile: true, user_agent: Some(ANDROID_UA) },
    Preset { name: "iPad Air", w: 820.0, h: 1180.0, scale: 2.0, mobile: true, user_agent: Some(IPAD_UA) },
];

/// A block's device mode: a preset or a custom size (desktop UA, no touch), maybe rotated.
#[derive(Debug, Clone, PartialEq)]
pub struct Mode {
    pub name: String,
    pub w: f32,
    pub h: f32,
    pub scale: f32,
    pub mobile: bool,
    pub user_agent: Option<String>,
}

impl Mode {
    pub fn preset(name: &str) -> Option<Mode> {
        let p = PRESETS.iter().find(|p| p.name.eq_ignore_ascii_case(name))?;
        Some(Mode { name: p.name.into(), w: p.w, h: p.h, scale: p.scale, mobile: p.mobile, user_agent: p.user_agent.map(Into::into) })
    }

    /// A custom size: clamped to sane bounds, desktop UA, no touch.
    pub fn custom(w: f32, h: f32, scale: Option<f32>) -> Mode {
        let (w, h) = (w.clamp(200.0, 3840.0).round(), h.clamp(200.0, 3840.0).round());
        Mode { name: "Custom".into(), w, h, scale: scale.unwrap_or(2.0).clamp(1.0, 4.0), mobile: false, user_agent: None }
    }

    pub fn rotated(&self) -> Mode {
        Mode { w: self.h, h: self.w, ..self.clone() }
    }

    pub fn device(&self) -> Device {
        Device { mobile: self.mobile, touch: self.mobile, user_agent: self.user_agent.clone() }
    }

    /// The scale that fits the device inside `area` (never above 1: a small device is not blown up).
    pub fn fit(&self, area_w: f32, area_h: f32) -> f32 {
        (area_w / self.w).min(area_h / self.h).min(1.0).max(0.05)
    }

    /// "iPhone 15 · 390×844 @3x · 72%"
    pub fn label(&self, fit: f32) -> String {
        format!("{} · {}×{} @{}x · {}%", self.name, self.w, self.h, self.scale, (fit * 100.0).round())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[::core::prelude::v1::test]
    fn presets_sizes_fit_and_rotate() {
        let m = Mode::preset("iphone 15").unwrap();
        assert_eq!((m.w, m.h, m.scale, m.mobile), (390.0, 844.0, 3.0, true));
        assert!(m.device().touch && m.device().user_agent.unwrap().contains("iPhone"));
        assert_eq!(m.rotated().w, 844.0);
        assert_eq!(m.fit(1000.0, 422.0), 0.5);
        assert_eq!(m.fit(4000.0, 4000.0), 1.0, "never blown up");
        assert_eq!(m.label(0.5), "iPhone 15 · 390×844 @3x · 50%");
        assert!(Mode::preset("Nokia").is_none());
        let c = Mode::custom(10.0, 99999.0, None);
        assert_eq!((c.w, c.h, c.mobile, c.user_agent.is_none()), (200.0, 3840.0, false, true), "custom is clamped and never sets a UA");
    }
}
