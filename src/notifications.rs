//! HERDR: the notification history behind the bell (slice 1 of the notifications scope,
//! scratch/inbox-notifications-scope.md). Not the S27 annotation inbox (src/browser/inbox.rs).
//!
//! Every notice the app or a mod posts goes through `Store::post`: it is recorded here (unless
//! private or toast-only) and the window decides whether a toast shows (Do Not Disturb, muted
//! sources). Mods read the list through the `notifications()` snapshot and change it with
//! markRead / clearNotifications. The file is private (0700 folder, 0600 file), written whole
//! and renamed into place, and never followed through a symlink.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

pub const MAX_ITEMS: usize = 200;
pub const MAX_PER_SOURCE: usize = 100;
pub const MAX_AGE_MS: u64 = 30 * 24 * 60 * 60 * 1000;
pub const MAX_TITLE: usize = 200;
pub const MAX_BODY: usize = 500;
pub const SOURCES: [&str; 6] = ["agents", "machines", "browser", "updates", "mods", "app"];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub ts: u64,
    pub source: String,
    pub from: String,
    pub title: String,
    #[serde(default)]
    pub body: String,
    pub level: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    pub count: u32,
    pub read: bool,
    #[serde(default)]
    pub stale: bool,
}

/// What a poster hands in; `post` fills the rest.
#[derive(Debug, Clone, Default)]
pub struct Note {
    pub source: String,
    pub from: String,
    pub title: String,
    pub body: String,
    pub level: String,
    pub icon: Option<String>,
    pub action: Option<Value>,
    pub key: Option<String>,
}

/// Which items a mark-read or clear touches.
#[derive(Debug, Clone, PartialEq)]
pub enum Target {
    Id(String),
    All,
    Source(String),
}

impl Target {
    /// `"n_3"`, `"all"` or `{source: "agents"}`, as mods pass it.
    pub fn from_value(v: &Value) -> Option<Target> {
        match v {
            Value::String(s) if s == "all" => Some(Target::All),
            Value::String(s) => Some(Target::Id(s.clone())),
            Value::Object(o) => o.get("source").and_then(Value::as_str).map(|s| Target::Source(s.to_owned())),
            _ => None,
        }
    }

    fn hits(&self, i: &Item) -> bool {
        match self {
            Target::Id(id) => &i.id == id,
            Target::All => true,
            Target::Source(s) => &i.source == s,
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Store {
    /// Newest first.
    pub items: Vec<Item>,
    #[serde(default)]
    seq: u64,
    /// Something changed since the last save.
    #[serde(skip)]
    pub dirty: bool,
}

fn cap(text: &str, n: usize) -> String {
    let clean: String = text.chars().filter(|c| !c.is_control() || *c == '\n').collect();
    if clean.chars().count() <= n {
        return clean;
    }
    let mut s: String = clean.chars().take(n.saturating_sub(1)).collect();
    s.push('…');
    s
}

/// A failed download's URL keeps its scheme, host and path, never its query or fragment.
pub fn strip_query(url_text: &str) -> String {
    url_text
        .split_whitespace()
        .map(|w| if w.contains("://") { w.split(['?', '#']).next().unwrap_or(w) } else { w })
        .collect::<Vec<_>>()
        .join(" ")
}

impl Store {
    /// Records `note` at `now_ms`; returns its id. A repeat of a key bumps that item instead.
    pub fn post(&mut self, note: Note, now_ms: u64) -> String {
        self.dirty = true;
        if let Some(key) = &note.key
            && let Some(i) = self.items.iter().position(|i| i.key.as_ref() == Some(key))
        {
            let mut it = self.items.remove(i);
            it.ts = now_ms;
            it.count = it.count.saturating_add(1);
            it.read = false;
            it.stale = false;
            it.title = cap(&note.title, MAX_TITLE);
            it.body = cap(&note.body, MAX_BODY);
            it.level = note.level;
            it.action = note.action;
            let id = it.id.clone();
            self.items.insert(0, it);
            return id;
        }
        self.seq += 1;
        let id = format!("n_{}", self.seq);
        let source = if SOURCES.contains(&note.source.as_str()) { note.source } else { "app".to_owned() };
        self.items.insert(0, Item {
            id: id.clone(),
            ts: now_ms,
            source,
            from: cap(&note.from, 100),
            title: cap(&note.title, MAX_TITLE),
            body: cap(&note.body, MAX_BODY),
            level: note.level,
            icon: note.icon,
            action: note.action,
            key: note.key,
            count: 1,
            read: false,
            stale: false,
        });
        self.trim(now_ms);
        id
    }

    /// Age, per-source and total caps: read items go before unread, oldest first.
    pub fn trim(&mut self, now_ms: u64) {
        let before = self.items.len();
        self.items.retain(|i| now_ms.saturating_sub(i.ts) <= MAX_AGE_MS);
        for s in SOURCES {
            while self.items.iter().filter(|i| i.source == s).count() > MAX_PER_SOURCE {
                self.drop_one(|i| i.source == s);
            }
        }
        while self.items.len() > MAX_ITEMS {
            self.drop_one(|_| true);
        }
        if self.items.len() != before {
            self.dirty = true;
        }
    }

    fn drop_one(&mut self, within: impl Fn(&Item) -> bool) {
        let pick = self.items.iter().rposition(|i| within(i) && i.read).or_else(|| self.items.iter().rposition(&within));
        if let Some(i) = pick {
            self.items.remove(i);
        }
    }

    pub fn mark_read(&mut self, t: &Target) -> usize {
        self.mark_read_as(t, None)
    }

    /// `owner`: a mod without `"permissions": { "notifications": "all" }` touches only its own items.
    pub fn mark_read_as(&mut self, t: &Target, owner: Option<&str>) -> usize {
        let mut n = 0;
        for i in self.items.iter_mut().filter(|i| t.hits(i) && owns(owner, i) && !i.read) {
            i.read = true;
            n += 1;
        }
        self.dirty |= n > 0;
        n
    }

    /// The thing a keyed item was about resolved (the agent is no longer blocked): it reads as read.
    pub fn resolve(&mut self, key: &str) -> bool {
        let hit = self.items.iter_mut().find(|i| i.key.as_deref() == Some(key) && !i.read);
        let found = hit.map(|i| i.read = true).is_some();
        self.dirty |= found;
        found
    }

    /// Marks read every item whose key starts with `prefix` (focusing agent t7: `agent:t7:`).
    pub fn resolve_prefix(&mut self, prefix: &str) -> usize {
        let mut n = 0;
        for i in self.items.iter_mut().filter(|i| !i.read && i.key.as_deref().is_some_and(|k| k.starts_with(prefix))) {
            i.read = true;
            n += 1;
        }
        self.dirty |= n > 0;
        n
    }

    /// Real deletion.
    pub fn clear(&mut self, t: &Target) -> usize {
        self.clear_as(t, None)
    }

    pub fn clear_as(&mut self, t: &Target, owner: Option<&str>) -> usize {
        let before = self.items.len();
        self.items.retain(|i| !(t.hits(i) && owns(owner, i)));
        let n = before - self.items.len();
        self.dirty |= n > 0;
        n
    }

    pub fn unread(&self, muted: &[String]) -> usize {
        self.items.iter().filter(|i| !i.read && !muted.contains(&i.source)).count()
    }

    /// Items whose action can't survive a restart (a terminal or agent from the last run).
    fn mark_stale(&mut self) {
        for i in &mut self.items {
            i.stale = i.action.as_ref().is_some_and(|a| a["args"].get("terminal").is_some() || a["args"].get("agent").is_some());
        }
    }

    /// Reads the history file. Missing: empty. Unreadable or a symlink: moved aside, empty.
    pub fn load(path: &Path, now_ms: u64) -> Store {
        let link = path.symlink_metadata().is_ok_and(|m| m.file_type().is_symlink());
        let read = if link { None } else { std::fs::read(path).ok() };
        let mut store = match read.map(|b| serde_json::from_slice::<Store>(&b)) {
            None if !link => return Store::default(),
            Some(Ok(s)) => s,
            _ => {
                let aside = path.with_extension(format!("bad-{now_ms}.json"));
                let _ = std::fs::rename(path, aside);
                return Store::default();
            }
        };
        store.seq = store.seq.max(store.items.iter().filter_map(|i| i.id.strip_prefix("n_")?.parse().ok()).max().unwrap_or(0));
        store.mark_stale();
        store.trim(now_ms);
        store.dirty = false;
        store
    }

    /// Writes the whole history: 0700 folder, 0600 temp file, renamed over the old one.
    pub fn save(&mut self, path: &Path) -> io::Result<()> {
        let dir = path.parent().ok_or_else(|| io::Error::from(io::ErrorKind::InvalidInput))?;
        private_dir(dir)?;
        let tmp = path.with_extension("json.tmp");
        let _ = std::fs::remove_file(&tmp);
        let mut o = std::fs::OpenOptions::new();
        o.write(true).create_new(true);
        #[cfg(unix)]
        std::os::unix::fs::OpenOptionsExt::mode(&mut o, 0o600);
        o.open(&tmp)?.write_all(&serde_json::to_vec(self).map_err(io::Error::other)?)?;
        std::fs::rename(&tmp, path)?;
        self.dirty = false;
        Ok(())
    }
}

/// A mod's own items: posted by it (source `mods`, from = its folder). `None`: every item.
fn owns(owner: Option<&str>, i: &Item) -> bool {
    owner.is_none_or(|me| i.source == "mods" && i.from == me)
}

/// The whole `notifications()` payload, as the window publishes it to mods.
pub fn view(store: &Store, settings: &crate::settings::NotificationSettings) -> Value {
    serde_json::json!({
        "unread": store.unread(&settings.muted_sources),
        "items": store.items,
        "settings": { "dnd": settings.dnd, "muted_sources": settings.muted_sources },
    })
}

/// What one mod's `notifications()` returns: the whole payload for a mod with
/// `"permissions": { "notifications": "all" }` (`owner` None), else only the caller's own items,
/// their unread count, and no settings.
pub fn scope(full: &Value, owner: Option<&str>) -> Value {
    let Some(me) = owner else { return full.clone() };
    let items: Vec<&Value> = full["items"].as_array().into_iter().flatten().filter(|i| i["source"] == "mods" && i["from"] == me).collect();
    let unread = items.iter().filter(|i| i["read"] == false).count();
    serde_json::json!({ "unread": unread, "items": items })
}

fn private_dir(dir: &Path) -> io::Result<()> {
    if dir.symlink_metadata().is_ok_and(|m| m.file_type().is_symlink()) {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, format!("{} is a symlink", dir.display())));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::{DirBuilderExt, PermissionsExt};
        std::fs::DirBuilder::new().recursive(true).mode(0o700).create(dir)?;
        std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))
    }
    #[cfg(not(unix))]
    std::fs::create_dir_all(dir)
}

/// `<app home>/data/notifications/history.json`.
pub fn path() -> PathBuf {
    crate::mods::app_dir().join("data").join("notifications").join("history.json")
}

/// Whether a notice is recorded: `private` never; `keep` when given; else warnings and errors,
/// and info lasting longer than 3 s (a quick "Copied" is a confirmation, not news).
pub fn keeps(level: &str, timeout_ms: Option<u64>, keep: Option<bool>, private: bool) -> bool {
    if private {
        return false;
    }
    keep.unwrap_or_else(|| matches!(level, "warning" | "error") || timeout_ms.is_none_or(|t| t > 3000))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(source: &str, title: &str, key: Option<&str>) -> Note {
        Note { source: source.into(), from: "x".into(), title: title.into(), level: "info".into(), key: key.map(Into::into), ..Note::default() }
    }

    fn tmp() -> PathBuf {
        let d = std::env::temp_dir().join(format!("herdr-notes-test-{}-{}", std::process::id(), crate::browser::handoff::fresh_token()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn a_key_collapses_repeats_and_resolve_reads_it() {
        let mut s = Store::default();
        let a = s.post(note("agents", "t7 needs you", Some("agent:t7:blocked")), 1);
        s.post(note("app", "other", None), 2);
        s.mark_read(&Target::All);
        let b = s.post(note("agents", "t7 needs you again", Some("agent:t7:blocked")), 3);
        assert_eq!(a, b, "same item");
        assert_eq!((s.items.len(), s.items[0].count, s.items[0].read, s.items[0].ts), (2, 2, false, 3), "bumped to the top, unread again");
        assert_eq!(s.unread(&[]), 1);
        assert_eq!(s.unread(&["agents".into()]), 0, "muted sources don't count");
        assert!(s.resolve("agent:t7:blocked") && !s.resolve("agent:t7:blocked"));
        s.post(note("agents", "t7 done", Some("agent:t7:done")), 4);
        assert_eq!(s.resolve_prefix("agent:t7:"), 1);
        assert_eq!(s.unread(&[]), 0);
    }

    #[test]
    fn caps_drop_read_before_unread_and_keep_each_source_bounded() {
        let mut s = Store::default();
        for i in 0..MAX_PER_SOURCE as u64 + 10 {
            s.post(note("mods", &format!("m{i}"), None), 10 + i);
        }
        assert_eq!(s.items.iter().filter(|i| i.source == "mods").count(), MAX_PER_SOURCE, "a chatty mod can't evict others");
        s.post(note("agents", "keep me", None), 500);
        s.mark_read(&Target::Source("mods".into()));
        for i in 0..MAX_ITEMS as u64 {
            s.post(note("app", &format!("a{i}"), None), 1000 + i);
        }
        assert_eq!(s.items.len(), MAX_ITEMS);
        assert!(s.items.iter().any(|i| i.title == "keep me"), "read mods items went first");
        s.trim(1000 + MAX_AGE_MS + 600);
        assert!(s.items.iter().all(|i| i.ts >= 600), "older than 30 days goes");
        let long = s.post(Note { title: "t".repeat(500), body: "b\u{1b}[31m".repeat(400), level: "error".into(), source: "nope".into(), ..Note::default() }, 5000);
        let it = s.items.iter().find(|i| i.id == long).unwrap();
        assert_eq!((it.title.chars().count(), it.body.chars().count(), it.source.as_str()), (MAX_TITLE, MAX_BODY, "app"));
        assert!(!it.body.contains('\u{1b}'));
    }

    #[test]
    fn mark_read_and_clear_by_id_source_and_all() {
        let mut s = Store::default();
        let a = s.post(note("agents", "a", None), 1);
        s.post(note("browser", "b", None), 2);
        s.post(note("browser", "c", None), 3);
        assert_eq!(s.mark_read(&Target::Id(a.clone())), 1);
        assert_eq!(s.clear(&Target::Source("browser".into())), 2);
        assert_eq!(s.items.len(), 1);
        assert_eq!(Target::from_value(&serde_json::json!("all")), Some(Target::All));
        assert_eq!(Target::from_value(&serde_json::json!({"source": "agents"})), Some(Target::Source("agents".into())));
        assert_eq!(Target::from_value(&serde_json::json!(a)), Some(Target::Id(a)));
        assert_eq!(s.clear(&Target::All), 1);
    }

    #[test]
    fn the_file_is_private_survives_a_restart_and_a_corrupt_one_is_moved_aside() {
        let home = tmp();
        let path = home.join("data/notifications/history.json");
        let mut s = Store::default();
        s.post(Note { action: Some(serde_json::json!({"name": "agent.focus", "args": {"terminal": "t7"}})), ..note("agents", "t7", None) }, 1);
        s.post(note("app", "plain", None), 2);
        s.save(&path).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = |p: &Path| std::fs::metadata(p).unwrap().permissions().mode() & 0o777;
            assert_eq!((mode(path.parent().unwrap()), mode(&path)), (0o700, 0o600));
        }
        let mut back = Store::load(&path, 3);
        assert_eq!(back.items.len(), 2);
        assert!(back.items[1].stale && !back.items[0].stale, "a terminal action from the last run is stale");
        assert_eq!(back.post(note("app", "next", None), 4), "n_3", "ids keep counting");
        std::fs::write(&path, b"{not json").unwrap();
        assert!(Store::load(&path, 9).items.is_empty());
        assert!(path.with_extension("bad-9.json").exists() && !path.exists());
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(home.join("elsewhere.json"), &path).unwrap();
            assert!(Store::load(&path, 10).items.is_empty(), "a linked history is not read");
            std::os::unix::fs::symlink(home.join("data"), home.join("ld")).unwrap();
            assert!(Store::default().save(&home.join("ld/history.json")).is_err(), "a linked folder is refused");
        }
        std::fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn a_mod_without_the_permission_sees_and_changes_only_its_own_items() {
        let mut s = Store::default();
        let agent = s.post(note("agents", "t7 needs you", None), 1);
        let theirs = s.post(Note { from: "fork-board".into(), ..note("mods", "board", None) }, 2);
        let mine = s.post(Note { from: "my-mod".into(), ..note("mods", "mine", None) }, 3);
        let settings = crate::settings::NotificationSettings { dnd: true, ..Default::default() };
        let v = scope(&view(&s, &settings), Some("my-mod"));
        assert_eq!(v["items"].as_array().unwrap().len(), 1);
        assert_eq!((v["items"][0]["id"].as_str(), v["unread"].as_u64()), (Some(mine.as_str()), Some(1)));
        assert!(v.get("settings").is_none(), "settings are the panel's");
        assert_eq!(s.mark_read_as(&Target::All, Some("my-mod")), 1);
        assert_eq!(s.mark_read_as(&Target::Id(agent.clone()), Some("my-mod")), 0, "another source's item by id");
        assert_eq!(s.clear_as(&Target::Source("agents".into()), Some("my-mod")), 0);
        assert_eq!(s.clear_as(&Target::Id(theirs.clone()), Some("my-mod")), 0, "another mod's item");
        assert_eq!(s.clear_as(&Target::All, Some("my-mod")), 1);
        assert_eq!(s.items.len(), 2);
        let all = scope(&view(&s, &settings), None);
        assert_eq!((all["items"].as_array().unwrap().len(), all["settings"]["dnd"].as_bool()), (2, Some(true)));
        assert_eq!(s.clear_as(&Target::All, None), 2, "the panel (permission all) clears everything");
    }

    #[test]
    fn what_is_kept_and_what_is_toast_only() {
        assert!(keeps("error", Some(1000), None, false));
        assert!(!keeps("info", Some(1500), None, false), "a quick confirmation");
        assert!(keeps("info", None, None, false) && keeps("info", Some(5000), None, false));
        assert!(!keeps("error", None, Some(false), false) && keeps("info", Some(1000), Some(true), false));
        assert!(!keeps("error", None, Some(true), true), "private is never stored");
        assert_eq!(strip_query("Failed: https://a.test/f.zip?token=SECRET#x (403)"), "Failed: https://a.test/f.zip (403)");
    }
}
