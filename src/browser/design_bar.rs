//! Design mode chrome (part 4, A1, A2, A9): one strip that holds every design control, the label
//! chip on the hover box, and markers for pins scrolled out of view, like Cursor's design mode.
//!
//! The decisions (what shows, where a chip or marker goes) are pure functions with tests; the
//! elements are built here and wired by `BrowserView` (view.rs, part 1) through one callback that
//! receives a `StripAction`. Design mode = the input owner is Pick, Markup or Comment
//! (docs/browser-input-owner.md); the strip shows whenever it is.

use super::input::Owner;
use super::markup::Tool;
use gpui::prelude::FluentBuilder as _;
use gpui::{AnyElement, Context, InteractiveElement as _, IntoElement, ParentElement as _, StatefulInteractiveElement as _, Styled as _, Window, div, hsla, px, rgb};

/// What the strip shows, read from the view each render.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StripState {
    pub owner: Owner,
    pub tool: Tool,
    pub styles_on: bool,
    pub comment_on: bool,
    /// Pending pins on every page (the Send badge).
    pub count: usize,
}

/// What a strip control asks the view to do.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StripAction {
    /// Select elements (Pick); a drag draws a region.
    Select,
    /// Draw on the page (Markup).
    Draw,
    Tool(Tool),
    Undo,
    ToggleStyles,
    ToggleComment,
    Send,
    /// Leave design mode (Esc does the same, one layer at a time).
    Done,
}

/// Whether design mode is on (the strip shows).
pub fn design_on(owner: Owner) -> bool {
    matches!(owner, Owner::Pick | Owner::Markup | Owner::Comment)
}

/// The controls the strip shows, in order, for a state (ids double as test handles).
pub fn controls(s: &StripState) -> Vec<(&'static str, &'static str, StripAction, bool)> {
    if !design_on(s.owner) {
        return vec![];
    }
    let drawing = s.owner == Owner::Markup;
    let mut out = vec![
        ("design-select", "Select", StripAction::Select, s.owner == Owner::Pick || s.owner == Owner::Comment),
        ("design-draw", "Draw", StripAction::Draw, drawing),
    ];
    if drawing {
        for (id, label, t) in [("design-pen", "Pen", Tool::Pen), ("design-rect", "Rect", Tool::Rect), ("design-ellipse", "Ellipse", Tool::Ellipse), ("design-arrow", "Arrow", Tool::Arrow)] {
            out.push((id, label, StripAction::Tool(t), s.tool == t));
        }
        out.push(("design-undo", "Undo", StripAction::Undo, false));
    }
    out.push(("design-styles", "Styles", StripAction::ToggleStyles, s.styles_on));
    out.push(("design-comment", "Comment", StripAction::ToggleComment, s.comment_on));
    if s.count > 0 {
        out.push(("design-send", "Send", StripAction::Send, false));
    }
    out.push(("design-done", "Done", StripAction::Done, false));
    out
}

/// The strip element, or None outside design mode. `on` is the view's handler for a control.
pub fn strip<V: 'static>(s: &StripState, height: f32, cx: &mut Context<V>, on: impl Fn(&mut V, StripAction, &mut Window, &mut Context<V>) + Clone + 'static) -> Option<AnyElement> {
    let controls = controls(s);
    if controls.is_empty() {
        return None;
    }
    let count = s.count;
    let mut bar = div().id("design-strip").flex().flex_none().items_center().gap_1().h(px(height)).px_2().text_xs().bg(hsla(0.62, 0.8, 0.55, 0.14)).child(div().pr_1().child("Design"));
    for (id, label, action, active) in controls {
        let on = on.clone();
        let text = if action == StripAction::Send { format!("{count} · Send") } else { label.to_string() };
        bar = bar.child(
            div()
                .id(id)
                .px_1()
                .rounded_sm()
                .cursor_pointer()
                .when(active, |d| d.bg(hsla(0., 0., 0.5, 0.3)))
                .when(action == StripAction::Send, |d| d.bg(rgb(0xff3b30)).text_color(rgb(0xffffff)).rounded_full())
                .child(text)
                .on_click(cx.listener(move |v, _, window, cx| on(v, action, window, cx))),
        );
    }
    Some(bar.into_any_element())
}

/// The hover box's chip text: the pick label's tag and text, then the size, like
/// "button Go now · 98×43". The label comes from the page: shown, never sent as the person's words.
pub fn chip_text(label: &str, w: f32, h: f32) -> String {
    let label = if label.is_empty() { "element" } else { label };
    format!("{label} · {}×{}", w.round(), h.round())
}

pub const CHIP_HEIGHT: f32 = 18.0;

/// Where the chip goes, in page DIPs: just above the box, or just inside its top edge when the box
/// touches the top of the viewport; never off the left edge.
pub fn chip_origin(rect: (f32, f32, f32, f32)) -> (f32, f32) {
    let (x, y, _, _) = rect;
    let above = y - CHIP_HEIGHT - 2.0;
    (x.max(0.0), if above >= 0.0 { above } else { y.max(0.0) + 2.0 })
}

/// The chip element, placed by the caller at `chip_origin` (page coordinates).
pub fn chip(text: String) -> impl IntoElement {
    div().h(px(CHIP_HEIGHT)).px_1().rounded_sm().text_xs().bg(rgb(0x2563eb)).text_color(rgb(0xffffff)).child(text)
}

/// Pins out of view, by the edge they are past (pin numbers, in order). A pin counts as out when
/// its box is wholly outside the viewport.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Offscreen {
    pub above: Vec<u32>,
    pub below: Vec<u32>,
    pub left: Vec<u32>,
    pub right: Vec<u32>,
}

impl Offscreen {
    pub fn is_empty(&self) -> bool {
        self.above.is_empty() && self.below.is_empty() && self.left.is_empty() && self.right.is_empty()
    }
}

/// `pins`: (number, rect in viewport DIPs now); `view`: the viewport size. Above/below win over
/// left/right for a pin past a corner.
pub fn offscreen(pins: &[(u32, (f32, f32, f32, f32))], view: (f32, f32)) -> Offscreen {
    let mut out = Offscreen::default();
    for &(n, (x, y, w, h)) in pins {
        if y + h <= 0.0 {
            out.above.push(n);
        } else if y >= view.1 {
            out.below.push(n);
        } else if x + w <= 0.0 {
            out.left.push(n);
        } else if x >= view.0 {
            out.right.push(n);
        }
    }
    out
}

/// The markers' text: "↑ 1, 3" style, one per edge that has pins.
pub fn offscreen_labels(o: &Offscreen) -> Vec<(&'static str, String)> {
    let list = |v: &[u32]| v.iter().map(u32::to_string).collect::<Vec<_>>().join(", ");
    [("pins-above", "↑", &o.above), ("pins-below", "↓", &o.below), ("pins-left", "←", &o.left), ("pins-right", "→", &o.right)]
        .into_iter()
        .filter(|(_, _, v)| !v.is_empty())
        .map(|(id, arrow, v)| (id, format!("{arrow} {}", list(v))))
        .collect()
}

/// What a click on a pin offers (its popover).
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PinAction {
    /// Reopen its comment field with the text (the Comment owner).
    Edit(u32),
    Delete(u32),
}

/// The pin popover: the comment (the person's own words) and Edit / Delete.
pub fn pin_popover<V: 'static>(n: u32, comment: &str, cx: &mut Context<V>, on: impl Fn(&mut V, PinAction, &mut Window, &mut Context<V>) + Clone + 'static) -> AnyElement {
    let (edit, delete) = (on.clone(), on);
    div()
        .id(("pin-popover", n as usize))
        .flex()
        .flex_col()
        .gap_1()
        .p_1()
        .w(px(220.))
        .rounded_md()
        .text_xs()
        .bg(rgb(0x1f1f1f))
        .text_color(rgb(0xf2f2f2))
        .child(format!("{n}. {}", if comment.is_empty() { "(no comment)" } else { comment }))
        .child(
            div()
                .flex()
                .gap_2()
                .child(div().id(("pin-edit", n as usize)).cursor_pointer().child("Edit").on_click(cx.listener(move |v, _, w, cx| edit(v, PinAction::Edit(n), w, cx))))
                .child(div().id(("pin-delete", n as usize)).cursor_pointer().text_color(rgb(0xff6b60)).child("Delete").on_click(cx.listener(move |v, _, w, cx| delete(v, PinAction::Delete(n), w, cx)))),
        )
        .into_any_element()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(owner: Owner) -> StripState {
        StripState { owner, tool: Tool::Rect, styles_on: false, comment_on: true, count: 0 }
    }

    fn ids(s: &StripState) -> Vec<&'static str> {
        controls(s).into_iter().map(|c| c.0).collect()
    }

    #[test]
    fn the_strip_shows_only_in_design_mode_with_the_right_controls() {
        assert!(controls(&state(Owner::Browse)).is_empty());
        assert!(controls(&state(Owner::Agent)).is_empty(), "a lease shows its own strip");
        assert_eq!(ids(&state(Owner::Pick)), ["design-select", "design-draw", "design-styles", "design-comment", "design-done"]);
        let draw = StripState { count: 3, comment_on: false, ..state(Owner::Markup) };
        assert_eq!(ids(&draw), ["design-select", "design-draw", "design-pen", "design-rect", "design-ellipse", "design-arrow", "design-undo", "design-styles", "design-comment", "design-send", "design-done"]);
        let active: Vec<_> = controls(&draw).into_iter().filter(|c| c.3).map(|c| c.0).collect();
        assert_eq!(active, ["design-draw", "design-rect"], "the mode and the tool are lit");
        let comment = controls(&state(Owner::Comment));
        assert!(comment.iter().any(|c| c.0 == "design-select" && c.3), "a comment belongs to Select");
        assert!(comment.iter().any(|c| c.0 == "design-comment" && c.3));
    }

    #[test]
    fn the_chip_names_the_element_and_sits_above_it() {
        assert_eq!(chip_text("button Go now", 98.0, 43.2), "button Go now · 98×43");
        assert_eq!(chip_text("", 10.0, 10.0), "element · 10×10");
        assert_eq!(chip_origin((10.0, 50.0, 98.0, 43.0)), (10.0, 30.0));
        assert_eq!(chip_origin((-5.0, 4.0, 98.0, 43.0)), (0.0, 6.0), "at the top: just inside the box");
    }

    #[test]
    fn pins_out_of_view_are_counted_by_edge() {
        let view = (400.0, 300.0);
        let pins = [
            (1, (10.0, -50.0, 20.0, 20.0)),
            (2, (10.0, 100.0, 20.0, 20.0)),
            (3, (10.0, 300.0, 20.0, 20.0)),
            (4, (-30.0, 100.0, 20.0, 20.0)),
            (5, (400.0, 10.0, 20.0, 20.0)),
            (6, (10.0, -25.0, 20.0, 30.0)),
            (7, (500.0, 900.0, 20.0, 20.0)),
        ];
        let o = offscreen(&pins, view);
        assert_eq!(o, Offscreen { above: vec![1], below: vec![3, 7], left: vec![4], right: vec![5] }, "6 is partly visible; 7 past a corner counts below");
        assert_eq!(offscreen_labels(&o), vec![("pins-above", "↑ 1".to_string()), ("pins-below", "↓ 3, 7".to_string()), ("pins-left", "← 4".to_string()), ("pins-right", "→ 5".to_string())]);
        assert!(offscreen(&[(2, (10.0, 100.0, 20.0, 20.0))], view).is_empty());
    }
}
