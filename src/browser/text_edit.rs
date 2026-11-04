//! S13 inline text edit (part 4, A14): double-click a picked element, type in place, Return saves
//! (a text-edit pin), Esc puts the text back. The host makes the element editable (TextEdit, only
//! on the person's own pick and only plain text); `BrowserInput` routes keys while
//! `Owner::TextEdit` is on top. This is the view's bookkeeping between those two.

use super::annotate::Target;
use herdr_browser_protocol::TextEditOp;

/// What the strip says while editing, or why an edit didn't start.
pub const HINT_EDITING: &str = "Return to save · Esc to cancel";
pub const HINT_REFUSED: &str = "Only plain text can be edited here";
/// How long a plain pick click waits for a second click before pick mode ends (macOS's default
/// double-click interval is 500 ms; most people are faster).
pub const DOUBLE_CLICK_MS: u64 = 350;

#[derive(Debug, Default)]
pub struct TextEdit {
    /// The element being edited, from the pick the double-click made.
    pub target: Option<Target>,
    /// The TextEdit request in flight and what it asked.
    pub asked: Option<(u64, TextEditOp)>,
    pub hint: Option<&'static str>,
    /// A plain pick click is waiting to end pick mode (a double-click cancels it): its number.
    pub exit_wait: Option<u64>,
    waits: u64,
}

/// What the view does with a host answer.
#[derive(Debug, PartialEq)]
pub enum Next {
    /// Begin worked: enter `Owner::TextEdit`.
    Edit,
    /// Begin refused: stay picking, say why.
    Refused,
    /// Commit worked and changed the text: pin it.
    Pin { target: Target, before: String, after: String },
    /// Cancel done, a commit that changed nothing, or an answer to something else.
    Nothing,
}

impl TextEdit {
    /// A plain pick click: wait for a possible second click before pick mode ends. Returns its number.
    pub fn wait_for_second_click(&mut self) -> u64 {
        self.waits += 1;
        self.exit_wait = Some(self.waits);
        self.waits
    }

    /// The wait `n` ran out: whether pick mode should end now (no double-click came).
    pub fn wait_ran_out(&mut self, n: u64) -> bool {
        if self.exit_wait == Some(n) {
            self.exit_wait = None;
            return true;
        }
        false
    }

    /// Sends `op` for the current target as request `req`; None when there is nothing to edit.
    pub fn ask(&mut self, req: u64, op: TextEditOp) -> Option<String> {
        let selector = self.target.as_ref()?.selector.clone();
        self.asked = Some((req, op));
        Some(selector)
    }

    /// The host's `TextEditResult` for `req`.
    pub fn answered(&mut self, req: u64, ok: bool, before: String, after: String) -> Next {
        let Some((_, op)) = self.asked.filter(|(r, _)| *r == req) else { return Next::Nothing };
        self.asked = None;
        match (op, ok) {
            (TextEditOp::Begin, true) => {
                self.hint = Some(HINT_EDITING);
                Next::Edit
            }
            (TextEditOp::Begin, false) => {
                self.target = None;
                self.hint = Some(HINT_REFUSED);
                Next::Refused
            }
            (TextEditOp::Commit, true) if before != after => {
                self.hint = None;
                match self.target.take() {
                    Some(target) => Next::Pin { target, before, after },
                    None => Next::Nothing,
                }
            }
            _ => {
                self.hint = None;
                self.target = None;
                Next::Nothing
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t() -> Target {
        Target { selector: "h1".into(), label: "h1 Hello".into(), rect: (0.0, 0.0, 10.0, 10.0) }
    }

    #[test]
    fn begin_then_commit_pins_and_refusals_say_why() {
        let mut e = TextEdit { target: Some(t()), ..TextEdit::default() };
        assert_eq!(e.ask(1, TextEditOp::Begin).as_deref(), Some("h1"));
        assert_eq!(e.answered(9, true, "a".into(), "a".into()), Next::Nothing, "another request's answer");
        assert_eq!(e.answered(1, true, "Hello".into(), "Hello".into()), Next::Edit);
        assert_eq!(e.hint, Some(HINT_EDITING));
        e.ask(2, TextEditOp::Commit);
        assert_eq!(e.answered(2, true, "Hello".into(), "Hello v2".into()), Next::Pin { target: t(), before: "Hello".into(), after: "Hello v2".into() });
        assert!(e.target.is_none() && e.hint.is_none());
        let mut e = TextEdit { target: Some(t()), ..TextEdit::default() };
        e.ask(3, TextEditOp::Begin);
        assert_eq!(e.answered(3, false, String::new(), String::new()), Next::Refused);
        assert_eq!(e.hint, Some(HINT_REFUSED));
        let mut e = TextEdit { target: Some(t()), ..TextEdit::default() };
        e.ask(4, TextEditOp::Commit);
        assert_eq!(e.answered(4, true, "same".into(), "same".into()), Next::Nothing, "no change, no pin");
        assert!(TextEdit::default().ask(5, TextEditOp::Cancel).is_none());
    }

    #[test]
    fn a_second_click_cancels_the_wait_to_leave_pick() {
        let mut e = TextEdit::default();
        let first = e.wait_for_second_click();
        let second = e.wait_for_second_click();
        assert!(!e.wait_ran_out(first), "an older wait doesn't end pick");
        e.exit_wait = None; // the double-click came
        assert!(!e.wait_ran_out(second));
        let third = e.wait_for_second_click();
        assert!(e.wait_ran_out(third) && !e.wait_ran_out(third));
    }
}
