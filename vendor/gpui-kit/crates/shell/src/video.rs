//! HERDR: the `video(path, options)` element. The shell only describes it: which clip and how it
//! plays. The host (herdr-app) installs the renderer that plays it; without one the element is an
//! empty box styled like any other, so a script still lays out and tests run headless.

use gpui::{AnyElement, App, ElementId, InteractiveElement, IntoElement, SharedString, StyleRefinement, Styled, Window, div};
use std::sync::OnceLock;

/// What a script asked for. The path follows `image`'s rule (inside the application directory);
/// the host checks it before opening anything.
#[derive(Clone, Debug, Default, PartialEq, Eq, Hash)]
pub struct VideoSpec {
    pub path: String,
    pub autoplay: bool,
    pub looped: bool,
    pub muted: bool,
    pub controls: bool,
}

impl VideoSpec {
    /// `options` is the script's object as JSON; unknown keys and non-boolean values are refused,
    /// so a typo is an error rather than a clip that quietly ignores it.
    pub fn parse(path: String, options: &str) -> Result<Self, String> {
        let value: serde_json::Value = serde_json::from_str(options).map_err(|e| format!("video options: {e}"))?;
        let Some(map) = value.as_object() else {
            return Err("video options must be an object".into());
        };
        let mut spec = Self { path, ..Self::default() };
        for (key, v) in map {
            let Some(on) = v.as_bool() else {
                return Err(format!("video option `{key}` must be true or false"));
            };
            match key.as_str() {
                "autoplay" => spec.autoplay = on,
                "loop" => spec.looped = on,
                "muted" => spec.muted = on,
                "controls" => spec.controls = on,
                other => return Err(format!("unknown video option `{other}` (autoplay, loop, muted, controls)")),
            }
        }
        Ok(spec)
    }
}

/// Draws a video element: the spec, its element id, the script's `.id()` key, and its style.
pub type Renderer = fn(&VideoSpec, ElementId, Option<SharedString>, StyleRefinement, &mut Window, &mut App) -> AnyElement;

static RENDERER: OnceLock<Renderer> = OnceLock::new();

/// The host's player. Set once, before any window draws.
pub fn set_renderer(renderer: Renderer) {
    let _ = RENDERER.set(renderer);
}

pub(crate) fn render(spec: &VideoSpec, id: ElementId, key: Option<SharedString>, refinement: StyleRefinement, window: &mut Window, cx: &mut App) -> AnyElement {
    if let Some(renderer) = RENDERER.get() {
        return renderer(spec, id, key, refinement, window, cx);
    }
    let mut el = div().id(id);
    el.style().refine(&refinement);
    el.into_any_element()
}
