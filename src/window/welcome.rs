//! HERDR: the main area when no space is open: a short welcome (the sidebar's words, labs PR
//! #1339: "No spaces yet"), the three ways in, and the recent spaces. While this computer's
//! spaces are still arriving it says so, and after `LOAD_TIMEOUT` it says they didn't come
//! instead of staying blank. Prior art (from memory, not re-fetched): Notion, Cursor and Warp
//! open on a small centred card with a title, one line, primary actions and a recents list.

use super::*;

/// How long "Loading spaces…" may show before it says why it stopped waiting.
pub(super) const LOAD_TIMEOUT: Duration = Duration::from_secs(8);
/// At most this many recent spaces are listed.
const RECENTS: usize = 5;

/// What the welcome shows about loading, from how long it has waited.
#[derive(Debug, PartialEq)]
pub(super) enum Loading {
    No,
    Waiting,
    TimedOut,
}

pub(super) fn loading_state(loading: bool, since: Option<Instant>, now: Instant) -> Loading {
    match (loading, since) {
        (false, _) => Loading::No,
        (true, Some(t)) if now.duration_since(t) >= LOAD_TIMEOUT => Loading::TimedOut,
        (true, _) => Loading::Waiting,
    }
}

impl AppWindow {
    /// The welcome, in place of the blank "no space" area.
    pub(super) fn render_welcome(&self, cx: &mut Context<Self>) -> AnyElement {
        let z = settings::z;
        let loading = self.documents.get("").is_some_and(|s| s.layout() == "loading");
        let since = *self.welcome_loading_since.borrow();
        let state = loading_state(loading, since, Instant::now());
        let key = |action: &str| crate::keys::listing().into_iter().find(|(_, _, a)| a == action).map(|(_, k, _)| k);
        let button = |id: &'static str, label: &'static str, hint: Option<String>, primary: bool| {
            div()
                .id(id)
                .flex()
                .items_center()
                .gap(z(8.0))
                .h(z(32.0))
                .px(z(12.0))
                .rounded(z(6.0))
                .cursor_pointer()
                .text_size(z(13.0))
                .when(primary, |d| d.bg(c("accent")).text_color(c("accent_foreground")))
                .when(!primary, |d| d.border_1().border_color(c("border")).text_color(c("foreground")).hover(|s| s.bg(c("muted"))))
                .child(label)
                .when_some(hint, |d, k| d.child(div().text_size(z(11.0)).opacity(0.7).child(k)))
        };
        let actions = div()
            .flex()
            .gap(z(8.0))
            .child(button("welcome-new", "New Space", key("space.new"), true).on_click(cx.listener(|this, _, w, cx| this.run("space.new", json!({}), w, cx))))
            .child(button("welcome-folder", "Open Folder…", None, false).on_click(cx.listener(|this, _, w, cx| this.welcome_open_folder(w, cx))))
            .child(button("welcome-agent", "Start an Agent…", None, false).on_click(cx.listener(|this, _, w, cx| this.run(WELCOME_AGENT_COMMAND, json!({}), w, cx))));
        let recents: Vec<_> = self.model.recent.iter().take(RECENTS).cloned().collect();
        let mut list = div().flex().flex_col().gap(z(2.0));
        for (i, r) in recents.iter().enumerate() {
            let (name, folder) = (r.name.clone(), r.folder.clone());
            list = list.child(
                div()
                    .id(("welcome-recent", i))
                    .flex()
                    .justify_between()
                    .gap(z(16.0))
                    .px(z(8.0))
                    .py(z(4.0))
                    .rounded(z(4.0))
                    .cursor_pointer()
                    .hover(|s| s.bg(c("muted")))
                    .child(div().text_size(z(13.0)).text_color(c("foreground")).child(name.clone()))
                    .child(div().text_size(z(12.0)).text_color(c("dim")).truncate().child(folder.replace(&home(), "~")))
                    .on_click(cx.listener(move |this, _, w, cx| this.run("space.new", json!({ "name": name, "folder": folder }), w, cx))),
            );
        }
        let status = match state {
            Loading::No => None,
            Loading::Waiting => Some("Loading spaces…".to_owned()),
            Loading::TimedOut => Some(format!("Couldn't load spaces · This computer's spaces didn't arrive after {} s", LOAD_TIMEOUT.as_secs())),
        };
        let card = div()
            .id("welcome")
            .flex()
            .flex_col()
            .gap(z(16.0))
            .w(z(440.0))
            .child(div().text_size(z(20.0)).font_weight(FontWeight::SEMIBOLD).text_color(c("foreground")).child("No spaces yet"))
            .child(div().text_size(z(13.0)).text_color(c("dim")).child("A space keeps one project's tabs, terminals and agents together."))
            .when_some(status, |d, s| d.child(div().id("welcome-status").text_size(z(12.0)).text_color(c(if state == Loading::TimedOut { "blocked" } else { "dim" })).child(s)))
            .child(actions)
            .when(!recents.is_empty(), |d| {
                d.child(div().mt(z(8.0)).text_size(z(11.0)).text_color(c("dim")).child("Recent"))
                    .child(list)
            });
        div().size_full().flex().items_center().justify_center().child(card).into_any_element()
    }

    /// Open Folder…: the system chooser, then a space there.
    fn welcome_open_folder(&mut self, _window: &mut Window, cx: &mut Context<Self>) {
        let picked = cx.prompt_for_paths(PathPromptOptions { files: false, directories: true, multiple: false, prompt: Some("Open".into()) });
        cx.spawn_in(_window, async move |this, cx| {
            let Some(folder) = picked.await.ok().and_then(Result::ok).flatten().and_then(|p| p.into_iter().next()) else { return };
            let _ = this.update_in(cx, |this, w, cx| this.run("space.new", json!({ "folder": folder.to_string_lossy() }), w, cx));
        })
        .detach();
    }

    /// Keeps the loading clock: when "loading" started, cleared once it ends. The poll redraws
    /// when the timeout passes so the reason appears without input.
    pub(super) fn tick_welcome(&mut self, cx: &mut Context<Self>) {
        let loading = self.documents.get("").is_some_and(|s| s.layout() == "loading");
        let mut since = self.welcome_loading_since.borrow_mut();
        match (loading, *since) {
            (true, None) => *since = Some(Instant::now()),
            (false, Some(_)) => *since = None,
            (true, Some(t)) if !self.welcome_timeout_drawn.get() && t.elapsed() >= LOAD_TIMEOUT => {
                self.welcome_timeout_drawn.set(true);
                cx.notify();
            }
            _ => {}
        }
        if !loading {
            self.welcome_timeout_drawn.set(false);
        }
    }
}

/// HERDR: what "Start an Agent…" runs: core's + menu, which lists the agents (labs PR #1339).
/// Without fork-core the command is unknown and the person gets the usual "failed" notice.
pub(super) const WELCOME_AGENT_COMMAND: &str = "fork-core.new-menu";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loading_says_why_after_the_timeout() {
        let t0 = Instant::now();
        assert_eq!(loading_state(false, Some(t0), t0 + LOAD_TIMEOUT * 2), Loading::No);
        assert_eq!(loading_state(true, None, t0), Loading::Waiting);
        assert_eq!(loading_state(true, Some(t0), t0 + Duration::from_secs(1)), Loading::Waiting);
        assert_eq!(loading_state(true, Some(t0), t0 + LOAD_TIMEOUT), Loading::TimedOut);
    }
}
