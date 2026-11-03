//! S27 addressed Send (part 4): the "N · Send" badge opens this popover listing the running
//! agents; a click on one is the consent, and the batch is written to that agent's inbox
//! (inbox.rs). Nothing is pasted or typed into any pane (Ethan's rule). The Send chip then says
//! `Queued for <agent>`, `Read by <agent>` once the agent fetched it (inbox `read-at`), or
//! `Not read yet` after `NOT_READ_MS`.
//!
//! The list, the chip text and delivery are pure or file-only and tested here. `BrowserView`
//! (view.rs, part 1) holds a `SendTo` and draws `popover`/`chip`; window.rs feeds the agent
//! list and hands the addressed batch to `deliver`.

use super::handoff::Recipient;
use super::inbox;
use super::view::AnnotationBatch;
use gpui::prelude::FluentBuilder as _;
use gpui::{AnyElement, Context, InteractiveElement as _, IntoElement, ParentElement as _, StatefulInteractiveElement as _, Styled as _, Window, div, px, rgb};
use std::path::Path;

/// After this long unread, the chip says `Not read yet` (GUESS: 2 minutes).
pub const NOT_READ_MS: u64 = 2 * 60 * 1000;

/// One running agent the person can send to.
#[derive(Debug, Clone, PartialEq)]
pub struct Candidate {
    pub to: Recipient,
    /// The agent's 7501 word (working, idle, ...), shown dimmed next to the name.
    pub word: Option<String>,
}

/// The popover's list from `(terminal address, display name, word)` for every live agent:
/// local terminals only (a `machine/t7` address is out of scope for v1), sorted by name then id.
pub fn candidates(agents: impl IntoIterator<Item = (String, String, Option<String>)>) -> Vec<Candidate> {
    let mut out: Vec<Candidate> = agents
        .into_iter()
        .filter(|(addr, _, _)| inbox::terminal_dir(Path::new(""), addr).is_ok())
        .map(|(terminal, name, word)| Candidate { to: Recipient { terminal, name }, word })
        .collect();
    out.sort_by(|a, b| (&a.to.name, &a.to.terminal).cmp(&(&b.to.name, &b.to.terminal)));
    out
}

/// Where a sent batch stands, for the chip.
#[derive(Debug, Clone, PartialEq)]
pub enum Chip {
    Queued(String),
    Read(String),
    NotRead(String),
    /// The write failed; the pins stay so nothing is lost.
    Failed(String),
}

impl Chip {
    pub fn text(&self) -> String {
        match self {
            Chip::Queued(n) => format!("Queued for {n}"),
            Chip::Read(n) => format!("Read by {n}"),
            Chip::NotRead(n) => format!("Not read yet by {n}"),
            Chip::Failed(e) => format!("Not sent: {e}"),
        }
    }
}

/// The popover and the last delivery, held by the view.
#[derive(Debug, Default)]
pub struct SendTo {
    /// Some while the popover is open.
    pub open: Option<Vec<Candidate>>,
    /// Pre-selected next time (still needs a click).
    pub last: Option<String>,
    /// The batch on its way: recipient, batch id, when it was written.
    pub sent: Option<(Recipient, u64, u64)>,
    pub failed: Option<String>,
    /// Why the last send went without its picture, said on the chip.
    pub picture_note: Option<String>,
}

impl SendTo {
    /// The badge was clicked: show the list (an empty list says so instead of sending anywhere).
    pub fn show(&mut self, list: Vec<Candidate>) {
        self.open = Some(list);
    }

    /// A row was clicked: the popover closes and the choice is remembered.
    pub fn choose(&mut self, terminal: &str) -> Option<Recipient> {
        let to = self.open.take()?.into_iter().find(|c| c.to.terminal == terminal)?.to;
        self.last = Some(to.terminal.clone());
        Some(to)
    }

    pub fn delivered(&mut self, result: Result<(Recipient, u64), String>, now_ms: u64, picture_note: Option<String>) {
        self.picture_note = picture_note;
        match result {
            Ok((to, id)) => {
                self.sent = Some((to, id, now_ms));
                self.failed = None;
            }
            Err(e) => self.failed = Some(e),
        }
    }

    /// The chip for the last send, reading the inbox's `read-at`.
    pub fn chip(&self, inbox_root: &Path, now_ms: u64) -> Option<Chip> {
        if let Some(e) = &self.failed {
            return Some(Chip::Failed(e.clone()));
        }
        let (to, id, at) = self.sent.as_ref()?;
        Some(if inbox::read_at(inbox_root, &to.terminal, *id).is_some() {
            Chip::Read(to.name.clone())
        } else if now_ms.saturating_sub(*at) >= NOT_READ_MS {
            Chip::NotRead(to.name.clone())
        } else {
            Chip::Queued(to.name.clone())
        })
    }

    /// The chip's words: where the batch stands, and why the picture was left out if it was.
    pub fn chip_line(&self, inbox_root: &Path, now_ms: u64) -> Option<String> {
        let chip = self.chip(inbox_root, now_ms)?.text();
        Some(match &self.picture_note {
            Some(why) => format!("{chip} · no picture: {why}"),
            None => chip,
        })
    }

    /// Whether the chip can still change (the view re-checks once a second while it can).
    pub fn waiting(&self, inbox_root: &Path) -> bool {
        self.sent.as_ref().is_some_and(|(to, id, _)| inbox::read_at(inbox_root, &to.terminal, *id).is_none())
    }
}

/// Writes the addressed batch to `<browser dir>/inbox` and prunes old read batches.
pub fn deliver(browser_dir: &Path, batch: &AnnotationBatch, to: &Recipient, now_ms: u64) -> Result<inbox::Delivered, String> {
    let root = inbox::root(browser_dir);
    let _ = inbox::prune(&root, now_ms);
    inbox::deliver(&root, batch, to).map_err(|e| e.to_string())
}

/// The recipient list under the Send badge. `on` gets the chosen terminal id, or `None` for Cancel.
pub fn popover<V: 'static>(s: &SendTo, count: usize, cx: &mut Context<V>, on: impl Fn(&mut V, Option<String>, &mut Window, &mut Context<V>) + Clone + 'static) -> Option<AnyElement> {
    let list = s.open.as_ref()?;
    let mut menu = div()
        .id("send-to")
        .flex()
        .flex_col()
        .gap_1()
        .p_1()
        .w(px(240.))
        .rounded_md()
        .text_xs()
        .bg(rgb(0x1f1f1f))
        .text_color(rgb(0xf2f2f2))
        .child(format!("Send {count} to"));
    if list.is_empty() {
        menu = menu.child(div().text_color(rgb(0x9a9a9a)).child("No agents running"));
    }
    for c in list {
        let (t, pick) = (c.to.terminal.clone(), on.clone());
        menu = menu.child(
            div()
                .id(gpui::SharedString::from(format!("send-to-{t}")))
                .flex()
                .gap_2()
                .px_1()
                .rounded_sm()
                .cursor_pointer()
                .when(s.last.as_deref() == Some(t.as_str()), |d| d.bg(rgb(0x3a3a3a)))
                .child(c.to.name.clone())
                .child(div().text_color(rgb(0x9a9a9a)).child(format!("{t}{}", c.word.as_deref().map(|w| format!(" · {w}")).unwrap_or_default())))
                .on_click(cx.listener(move |v, _, w, cx| pick(v, Some(t.clone()), w, cx))),
        );
    }
    let cancel = on;
    menu = menu
        .child(div().text_color(rgb(0x9a9a9a)).child("Page text is sent as labelled data."))
        .child(div().id("send-to-cancel").cursor_pointer().child("Cancel").on_click(cx.listener(move |v, _, w, cx| cancel(v, None, w, cx))));
    Some(menu.into_any_element())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::browser::annotate::{Annotation, State, Target};

    fn row(t: &str, n: &str) -> (String, String, Option<String>) {
        (t.into(), n.into(), Some("idle".into()))
    }

    fn batch(id: u64) -> AnnotationBatch {
        AnnotationBatch {
            version: 1,
            id,
            sent_at_ms: id,
            block: "b1".into(),
            url: "https://example.com/".into(),
            title: "t".into(),
            scroll: (0.0, 0.0),
            annotations: vec![Annotation { n: 1, page: "https://example.com/".into(), target: Target { selector: "#a".into(), label: "a".into(), rect: (0.0, 0.0, 1.0, 1.0) }, comment: "bigger".into(), state: State::Pending }],
            css_edits: None,
            css_was: vec![],
            picture: None,
            region: None,
            scale: 1.0,
            untrusted: vec![],
        }
    }

    #[test]
    fn the_list_is_local_agents_by_name() {
        let list = candidates([row("t9", "Codex"), row("vps/t1", "Claude Code"), row("t2", "Claude Code"), row("t1", "Claude Code")]);
        let ids: Vec<_> = list.iter().map(|c| c.to.terminal.as_str()).collect();
        assert_eq!(ids, ["t1", "t2", "t9"], "remote agents are left out in v1");
    }

    #[test]
    fn a_click_chooses_and_cancel_or_a_stale_id_sends_nowhere() {
        let mut s = SendTo::default();
        s.show(candidates([row("t1", "Claude Code")]));
        assert_eq!(s.choose("t8"), None, "only a listed agent");
        assert!(s.open.is_none());
        s.show(candidates([row("t1", "Claude Code")]));
        assert_eq!(s.choose("t1").map(|r| r.terminal), Some("t1".into()));
        assert_eq!(s.last.as_deref(), Some("t1"));
    }

    #[test]
    fn the_chip_goes_queued_then_read_or_not_read() {
        let home = std::env::temp_dir().join(format!("herdr-sendto-test-{}", crate::browser::handoff::fresh_token()));
        let to = Recipient { terminal: "t7".into(), name: "Claude Code".into() };
        let d = deliver(&home, &batch(5), &to, 1_000).unwrap();
        assert!(d.dir.join("note.md").exists());
        let root = inbox::root(&home);
        let mut s = SendTo::default();
        s.delivered(Ok((to.clone(), 5)), 1_000, None);
        assert_eq!(s.chip(&root, 1_000).unwrap().text(), "Queued for Claude Code");
        assert_eq!(s.chip(&root, 1_000 + NOT_READ_MS).unwrap().text(), "Not read yet by Claude Code");
        assert!(s.waiting(&root));
        inbox::mark_read(&root, "t7", 5, 2_000).unwrap();
        assert_eq!(s.chip(&root, 1_000 + NOT_READ_MS).unwrap().text(), "Read by Claude Code");
        assert!(!s.waiting(&root));
        s.delivered(Err("disk full".into()), 3_000, Some("the region was off screen".into()));
        assert_eq!(s.chip_line(&root, 3_000).unwrap(), "Not sent: disk full · no picture: the region was off screen");
        assert_eq!(s.chip(&root, 3_000), Some(Chip::Failed("disk full".into())));
        std::fs::remove_dir_all(home).unwrap();
    }
}
