//! HERDR: toasts as a deck, like shadcn's Sonner (`position: top-right`, `expand: false`).
//!
//! The newest toast is in front at full size; older ones peek out behind it, each `PEEK` px
//! further and `SHRINK` narrower (GPUI has no transform on a div, so a card narrows instead of
//! scaling), at most `LIMIT` shown. Hovering the deck lays it out as a list with `GAP` between
//! cards. Everything here is the arithmetic; window.rs draws, animates and times the cards.

use crate::layout::{Axis, Node, Size};

pub const PEEK: f32 = 12.0;
pub const GAP: f32 = 8.0;
pub const SHRINK: f32 = 0.05;
pub const LIMIT: usize = 3;
/// How long a card takes to slide in, fade out or move to its new place.
pub const ANIM_MS: u64 = 200;

/// Where one card goes, measured from the deck's edge (its top for a top corner).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Slot {
    pub y: f32,
    /// Width as a share of the card's own (1 in front, smaller behind).
    pub width: f32,
    /// Collapsed cards behind the front one take its height, so only their edge peeks out.
    pub height: f32,
    pub shown: bool,
    /// Higher is drawn later, on top.
    pub z: usize,
}

/// Slots for cards of `heights`, newest first. `expanded`: the pointer is over the deck.
pub fn deck(heights: &[f32], expanded: bool) -> Vec<Slot> {
    let n = heights.len();
    let front = heights.first().copied().unwrap_or(0.0);
    let mut y = 0.0;
    heights
        .iter()
        .enumerate()
        .map(|(i, &h)| {
            let shown = i < LIMIT;
            let z = n - i;
            if expanded {
                let s = Slot { y, width: 1.0, height: h, shown, z };
                y += h + GAP;
                s
            } else {
                let level = i.min(LIMIT - 1) as f32;
                Slot { y: PEEK * level, width: 1.0 - SHRINK * level, height: if i == 0 { h } else { front }, shown, z }
            }
        })
        .collect()
}

/// How tall the deck is (the hover area), from the slots `deck` gave.
pub fn extent(slots: &[Slot]) -> f32 {
    slots.iter().filter(|s| s.shown).map(|s| s.y + s.height).fold(0.0, f32::max)
}

/// The fixed bars along the layout's right edge at the top (`top`) or bottom: the px-sized
/// blocks met walking to that corner (a row goes to its last shown child; a column takes its
/// first, or last, shown child and, when that is a px block, adds it and keeps going with the
/// next one), plus the paddings crossed on the way to a bar. Labs: the tab bar (42), and the panel's strip (34)
/// below it while the panel is open. Toasts start past these so they never cover their controls.
pub fn edge_bars(node: &Node, top: bool) -> f32 {
    let shown: Vec<&Node> = node.children().iter().filter(|c| !c.hidden).collect();
    let bars = match node.axis() {
        Some(Axis::Row) => shown.last().map_or(0.0, |c| edge_bars(c, top)),
        Some(Axis::Column) => {
            let mut sum = 0.0;
            let order: Box<dyn Iterator<Item = &&Node>> = if top { Box::new(shown.iter()) } else { Box::new(shown.iter().rev()) };
            for c in order {
                match (c.size, c.content()) {
                    (Some(Size::Px { px }), Some(_)) => sum += px,
                    _ => {
                        sum += edge_bars(c, top);
                        break;
                    }
                }
            }
            sum
        }
        _ => 0.0,
    };
    // Padding only counts when a bar lies past it.
    if bars > 0.0 { node.padding.map_or(0.0, |p| p.axes().0) + bars } else { 0.0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collapsed_the_newest_is_in_front_and_older_ones_peek_smaller() {
        let s = deck(&[60.0, 80.0, 72.0, 72.0], false);
        let ys: Vec<f32> = s.iter().map(|s| s.y).collect();
        assert_eq!(ys, [0.0, 12.0, 24.0, 24.0]);
        let ws: Vec<f32> = s.iter().map(|s| (s.width * 100.0).round()).collect();
        assert_eq!(ws, [100.0, 95.0, 90.0, 90.0]);
        assert_eq!(s.iter().map(|s| s.height).collect::<Vec<_>>(), [60.0, 60.0, 60.0, 60.0], "behind cards take the front's height");
        assert_eq!(s.iter().map(|s| s.shown).collect::<Vec<_>>(), [true, true, true, false], "a fourth stays alive but hidden");
        assert!(s[0].z > s[1].z && s[1].z > s[2].z, "front on top");
        assert_eq!(extent(&s), 84.0);
    }

    #[test]
    fn hovered_the_deck_becomes_a_list_with_gaps() {
        let s = deck(&[60.0, 80.0, 72.0, 72.0], true);
        assert_eq!(s.iter().map(|s| s.y).collect::<Vec<_>>(), [0.0, 68.0, 156.0, 236.0]);
        assert!(s.iter().all(|s| s.width == 1.0));
        assert_eq!(s.iter().map(|s| s.height).collect::<Vec<_>>(), [60.0, 80.0, 72.0, 72.0]);
        assert_eq!(extent(&s), 228.0, "the hidden fourth doesn't count");
        assert!(deck(&[], false).is_empty() && extent(&[]) == 0.0);
    }

    #[test]
    fn toasts_start_below_the_labs_tab_bar_and_the_open_panel_strip() {
        let labs: Node = serde_json::from_str(include_str!("../../defaults/layouts/labs.json")).unwrap();
        assert_eq!(edge_bars(&labs, true), 42.0, "the tab bar");
        assert_eq!(edge_bars(&labs, false), 0.0, "the status bar is hidden in the shipped layout");
        let mut open = labs.clone();
        fn show(n: &mut Node, id: &str) {
            if n.id == id {
                n.hidden = false;
            }
            for c in n.children_mut().into_iter().flatten() {
                show(c, id);
            }
        }
        show(&mut open, "panel");
        show(&mut open, "status");
        assert_eq!(edge_bars(&open, true), 42.0 + 8.0 + 34.0, "tab bar, the body's padding, the panel's strip");
        assert_eq!(edge_bars(&open, false), 28.0, "the status bar");
    }
}
