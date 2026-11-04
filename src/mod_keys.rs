//! A mod's own `keys.json` (`mods/<name>/keys.json`) merged into the home's
//! `keys.json` on start, so a bundled or added mod's keys work without a hand
//! edit. A key the person already binds is never replaced; a binding they
//! delete is never added back. What we added is recorded in
//! `keys-merged.json` (`{ mod: { "section\u{1f}key": action } }`), which lets
//! a later mod version update a binding the person left alone, and lets a
//! removed mod take back only the bindings it added.
//! HERDR: a mod turned off (settings `mods_disabled`) counts as removed, and a
//! binding a newer mod version dropped is taken back too (unless the person
//! changed it).

use std::collections::BTreeMap;
use std::path::Path;

type Sections = BTreeMap<String, BTreeMap<String, String>>;
type Merged = BTreeMap<String, BTreeMap<String, String>>;

const SEP: char = '\u{1f}';

static NOTES: std::sync::Mutex<Vec<String>> = std::sync::Mutex::new(Vec::new());

/// Toast lines for the window: keys a mod wanted but the person already uses,
/// or a keys.json that could not be read (left as it was).
pub fn take_notes() -> Vec<String> {
    std::mem::take(&mut *NOTES.lock().unwrap())
}

/// `home` is the app home: `mods/`, `keys.json`, `keys-merged.json`.
pub fn merge(home: &Path) -> std::io::Result<()> {
    let notes = merge_at(home, &crate::mods::disabled())?;
    NOTES.lock().unwrap().extend(notes);
    Ok(())
}

fn merge_at(home: &Path, disabled: &std::collections::BTreeSet<String>) -> std::io::Result<Vec<String>> {
    let keys_path = home.join("keys.json");
    let record_path = home.join("keys-merged.json");
    // No keys.json yet: the defaults are written on first load; merge next start.
    let Ok(text) = std::fs::read_to_string(&keys_path) else { return Ok(Vec::new()) };
    let mut keys: Sections = match serde_json::from_str(&text) {
        Ok(k) => k,
        Err(e) => return Ok(vec![format!("keys.json could not be read ({e}); mod keys were not added")]),
    };
    let mut record: Merged = std::fs::read_to_string(&record_path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();

    let mut wanted: Merged = BTreeMap::new();
    for entry in std::fs::read_dir(home.join("mods")).into_iter().flatten().flatten() {
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else { continue };
        if disabled.contains(&name) {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(entry.path().join("keys.json")) else { continue };
        let Ok(sections) = serde_json::from_str::<Sections>(&text) else { continue };
        let flat = wanted.entry(name).or_default();
        for (section, bindings) in sections {
            for (key, action) in bindings {
                flat.insert(format!("{section}{SEP}{key}"), action);
            }
        }
    }

    let mut notes = Vec::new();
    let mut changed = false;
    // Mods that are gone (or turned off): take back what they added and the person left alone.
    // Mods still here: the same for bindings their current keys.json no longer has.
    for (name, mut added) in std::mem::take(&mut record) {
        let dropped: BTreeMap<String, String> = match wanted.get(&name) {
            Some(flat) => {
                let gone: Vec<String> = added.keys().filter(|s| !flat.contains_key(*s)).cloned().collect();
                let dropped = gone.into_iter().filter_map(|s| added.remove_entry(&s)).collect();
                record.insert(name, added);
                dropped
            }
            None => added,
        };
        for (slot, action) in dropped {
            let (section, key) = slot.split_once(SEP).unwrap_or(("", &slot));
            if keys.get(section).and_then(|s| s.get(key)) == Some(&action) {
                keys.get_mut(section).unwrap().remove(key);
                changed = true;
            }
        }
    }
    keys.retain(|_, b| !b.is_empty());

    for (name, flat) in &wanted {
        let added = record.entry(name.clone()).or_default();
        for (slot, action) in flat {
            let (section, key) = slot.split_once(SEP).unwrap();
            let current = keys.get(section).and_then(|s| s.get(key)).cloned();
            match (added.get(slot).cloned(), current) {
                // Added before and the person deleted it: theirs to keep deleted.
                (Some(_), None) => {}
                // Ours, unchanged by them: follow the mod.
                (Some(old), Some(now)) if old == now => {
                    if &now != action {
                        keys.get_mut(section).unwrap().insert(key.to_owned(), action.clone());
                        added.insert(slot.clone(), action.clone());
                        changed = true;
                    }
                }
                // Theirs now (they changed it): leave it, stop tracking.
                (Some(_), Some(_)) => {
                    added.remove(slot);
                }
                (None, None) => {
                    keys.entry(section.to_owned()).or_default().insert(key.to_owned(), action.clone());
                    added.insert(slot.clone(), action.clone());
                    changed = true;
                }
                (None, Some(now)) if &now == action => {}
                (None, Some(_)) => notes.push(format!("{name} wants {key} ({section}); kept yours")),
            }
        }
    }
    record.retain(|_, a| !a.is_empty());

    if changed {
        // One copy of the person's own file before Herdr first changes it.
        let backup = home.join("keys.json.bak");
        if !backup.exists() {
            std::fs::write(&backup, &text)?;
        }
        crate::persist::write_atomic(&keys_path, serde_json::to_string_pretty(&keys).unwrap() + "\n")?;
    }
    let body = serde_json::to_string_pretty(&record).unwrap() + "\n";
    if std::fs::read_to_string(&record_path).ok().as_deref() != Some(body.as_str()) {
        if record.is_empty() {
            let _ = std::fs::remove_file(&record_path);
        } else {
            crate::persist::write_atomic(&record_path, body)?;
        }
    }
    Ok(notes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    fn home(tag: &str) -> std::path::PathBuf {
        let h = std::env::temp_dir().join(format!("herdr-mod-keys-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&h);
        std::fs::create_dir_all(h.join("mods")).unwrap();
        h
    }
    fn write(p: &Path, v: Value) {
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, serde_json::to_string_pretty(&v).unwrap()).unwrap();
    }
    fn keys(h: &Path) -> Value {
        serde_json::from_str(&std::fs::read_to_string(h.join("keys.json")).unwrap()).unwrap()
    }

    #[test]
    fn adds_missing_keeps_the_persons_and_backs_up_once() {
        let h = home("add");
        write(&h.join("keys.json"), json!({ "global": { "cmd-t": "tab.new", "cmd-shift-x": "space.new" } }));
        write(&h.join("mods/board/keys.json"), json!({ "global": { "cmd-shift-y": "mod.open:board", "cmd-shift-x": "mod.open:board" }, "mod:board": { "cmd-a": "board.select-all" } }));
        let notes = merge_at(&h, &Default::default()).unwrap();
        let k = keys(&h);
        assert_eq!(k["global"]["cmd-shift-y"], "mod.open:board");
        assert_eq!(k["global"]["cmd-shift-x"], "space.new", "never replaces the person's key");
        assert_eq!(k["mod:board"]["cmd-a"], "board.select-all");
        assert_eq!(notes, vec!["board wants cmd-shift-x (global); kept yours".to_owned()]);
        let bak: Value = serde_json::from_str(&std::fs::read_to_string(h.join("keys.json.bak")).unwrap()).unwrap();
        assert!(bak["global"].get("cmd-shift-y").is_none(), "backup is the file before the merge");
        // The backup is written once only.
        write(&h.join("mods/board/keys.json"), json!({ "global": { "cmd-shift-y": "mod.open:board", "cmd-shift-u": "mod.open:board" } }));
        merge_at(&h, &Default::default()).unwrap();
        let bak2: Value = serde_json::from_str(&std::fs::read_to_string(h.join("keys.json.bak")).unwrap()).unwrap();
        assert_eq!(bak, bak2);
    }

    #[test]
    fn a_persons_own_cmd_d_survives_fork_core() {
        let h = home("cmdd");
        write(&h.join("keys.json"), json!({ "global": { "cmd-d": "pane.zoom" } }));
        write(&h.join("mods/fork-core/keys.json"), json!({ "global": { "cmd-d": "fork-core.split-right" } }));
        merge_at(&h, &Default::default()).unwrap();
        assert_eq!(keys(&h)["global"]["cmd-d"], "pane.zoom");
    }

    #[test]
    fn a_persons_own_cmd_b_survives_fork_core() {
        let h = home("cmdb");
        write(&h.join("keys.json"), json!({ "global": { "cmd-b": "tab.new" } }));
        write(&h.join("mods/fork-core/keys.json"), json!({ "global": { "cmd-b": "fork-core.toggle-sidebar" } }));
        merge_at(&h, &Default::default()).unwrap();
        assert_eq!(keys(&h)["global"]["cmd-b"], "tab.new");
    }

    #[test]
    fn a_deleted_binding_stays_deleted_and_an_untouched_one_follows_the_mod() {
        let h = home("follow");
        write(&h.join("keys.json"), json!({ "global": {} }));
        write(&h.join("mods/board/keys.json"), json!({ "global": { "cmd-shift-y": "mod.open:board", "cmd-shift-u": "board.one" } }));
        merge_at(&h, &Default::default()).unwrap();
        // The person deletes one; the mod changes the other.
        let mut k = keys(&h);
        k["global"].as_object_mut().unwrap().remove("cmd-shift-y");
        write(&h.join("keys.json"), k);
        write(&h.join("mods/board/keys.json"), json!({ "global": { "cmd-shift-y": "mod.open:board", "cmd-shift-u": "board.two" } }));
        merge_at(&h, &Default::default()).unwrap();
        let k = keys(&h);
        assert!(k["global"].get("cmd-shift-y").is_none());
        assert_eq!(k["global"]["cmd-shift-u"], "board.two");
        // The person changes it: it is theirs from then on.
        let mut k = keys(&h);
        k["global"]["cmd-shift-u"] = json!("space.new");
        write(&h.join("keys.json"), k);
        write(&h.join("mods/board/keys.json"), json!({ "global": { "cmd-shift-u": "board.three" } }));
        merge_at(&h, &Default::default()).unwrap();
        assert_eq!(keys(&h)["global"]["cmd-shift-u"], "space.new");
    }

    #[test]
    fn a_removed_mod_takes_back_only_what_it_added() {
        let h = home("remove");
        write(&h.join("keys.json"), json!({ "global": { "cmd-t": "tab.new" } }));
        write(&h.join("mods/board/keys.json"), json!({ "global": { "cmd-shift-y": "mod.open:board", "cmd-shift-u": "board.one" } }));
        merge_at(&h, &Default::default()).unwrap();
        let mut k = keys(&h);
        k["global"]["cmd-shift-u"] = json!("space.new");
        write(&h.join("keys.json"), k);
        std::fs::remove_dir_all(h.join("mods/board")).unwrap();
        merge_at(&h, &Default::default()).unwrap();
        let k = keys(&h);
        assert!(k["global"].get("cmd-shift-y").is_none());
        assert_eq!(k["global"]["cmd-shift-u"], "space.new");
        assert_eq!(k["global"]["cmd-t"], "tab.new");
        assert!(!h.join("keys-merged.json").exists());
    }

    #[test]
    fn an_unreadable_keys_json_is_left_alone() {
        let h = home("broken");
        std::fs::write(h.join("keys.json"), "{ not json").unwrap();
        write(&h.join("mods/board/keys.json"), json!({ "global": { "cmd-shift-y": "mod.open:board" } }));
        let notes = merge_at(&h, &Default::default()).unwrap();
        assert_eq!(std::fs::read_to_string(h.join("keys.json")).unwrap(), "{ not json");
        assert!(!h.join("keys.json.bak").exists());
        assert_eq!(notes.len(), 1);
    }

    #[test]
    fn nothing_to_add_writes_nothing() {
        let h = home("quiet");
        std::fs::write(h.join("keys.json"), "{\n  \"global\": { \"cmd-t\": \"tab.new\" }\n}\n").unwrap();
        merge_at(&h, &Default::default()).unwrap();
        assert_eq!(std::fs::read_to_string(h.join("keys.json")).unwrap(), "{\n  \"global\": { \"cmd-t\": \"tab.new\" }\n}\n");
        assert!(!h.join("keys-merged.json").exists());
    }

    #[test]
    fn a_turned_off_mod_takes_back_its_keys_and_adds_them_again_when_on() {
        let h = home("off");
        write(&h.join("keys.json"), json!({ "global": { "cmd-t": "tab.new" } }));
        write(&h.join("mods/board/keys.json"), json!({ "global": { "cmd-shift-y": "mod.open:board" } }));
        merge_at(&h, &Default::default()).unwrap();
        assert_eq!(keys(&h)["global"]["cmd-shift-y"], "mod.open:board");
        let off: std::collections::BTreeSet<String> = ["board".to_owned()].into();
        merge_at(&h, &off).unwrap();
        assert!(keys(&h)["global"].get("cmd-shift-y").is_none(), "a turned-off mod contributes no keys");
        assert_eq!(keys(&h)["global"]["cmd-t"], "tab.new");
        merge_at(&h, &Default::default()).unwrap();
        assert_eq!(keys(&h)["global"]["cmd-shift-y"], "mod.open:board");
    }

    #[test]
    fn a_binding_dropped_by_an_upgrade_is_taken_back_but_the_persons_change_stays() {
        let h = home("drop");
        write(&h.join("keys.json"), json!({ "global": {} }));
        write(&h.join("mods/board/keys.json"), json!({ "global": { "cmd-shift-y": "mod.open:board", "cmd-shift-u": "board.one", "cmd-shift-i": "board.two" } }));
        merge_at(&h, &Default::default()).unwrap();
        // The person rebinds one of the mod's keys.
        let mut k = keys(&h);
        k["global"]["cmd-shift-i"] = json!("tab.new");
        write(&h.join("keys.json"), k);
        // The new version drops cmd-shift-u and cmd-shift-i.
        write(&h.join("mods/board/keys.json"), json!({ "global": { "cmd-shift-y": "mod.open:board" } }));
        merge_at(&h, &Default::default()).unwrap();
        let k = keys(&h);
        assert!(k["global"].get("cmd-shift-u").is_none(), "an obsolete binding is taken back");
        assert_eq!(k["global"]["cmd-shift-i"], "tab.new", "the person's own change stays");
        assert_eq!(k["global"]["cmd-shift-y"], "mod.open:board");
        let record: Value = serde_json::from_str(&std::fs::read_to_string(h.join("keys-merged.json")).unwrap()).unwrap();
        assert_eq!(record["board"].as_object().unwrap().len(), 1, "only the live binding stays recorded");
    }
}
