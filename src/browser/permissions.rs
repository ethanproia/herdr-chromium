//! Site permission prompts: what the person decided per origin and kind, for their own profile.
//!
//! `<app home>/browser/permissions.json` = `{ "<origin>": { "<kind>": true|false } }`, owner-only
//! (0600) and written atomically. Only the person's profile ("default") reads or writes it; an
//! agent's block always asks and never remembers. A file that doesn't parse is moved aside once
//! (`permissions.json.corrupt-<ms>`) and treated as empty, so it is never silently overwritten.
//! No `browser.*` command reads this file or answers a prompt.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

type Decisions = BTreeMap<String, BTreeMap<String, bool>>;

fn path(dir: &Path) -> PathBuf {
    dir.join("permissions.json")
}

fn load(dir: &Path) -> Decisions {
    let p = path(dir);
    let Ok(text) = std::fs::read_to_string(&p) else { return Decisions::new() };
    match serde_json::from_str(&text) {
        Ok(d) => d,
        Err(_) => {
            let ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_millis());
            let _ = std::fs::rename(&p, dir.join(format!("permissions.json.corrupt-{ms}")));
            Decisions::new()
        }
    }
}

/// The stored answer for every one of `kinds` at `origin`: Some(false) if any is blocked,
/// Some(true) if all are allowed, None (ask) if any is undecided. Exact origin and kind only.
pub fn decided(dir: &Path, profile: &str, origin: &str, kinds: &[String]) -> Option<bool> {
    if profile != super::agent::PERSON_PROFILE || kinds.is_empty() {
        return None;
    }
    let d = load(dir);
    let site = d.get(origin)?;
    let answers: Vec<bool> = kinds.iter().map(|k| site.get(k).copied()).collect::<Option<_>>()?;
    Some(answers.iter().all(|a| *a))
}

/// "Remember for this site" (allow) or "Never on this site" (block), for the person's profile.
pub fn remember(dir: &Path, profile: &str, origin: &str, kinds: &[String], allow: bool) -> std::io::Result<()> {
    if profile != super::agent::PERSON_PROFILE {
        return Ok(());
    }
    let mut d = load(dir);
    let site = d.entry(origin.to_string()).or_default();
    for k in kinds {
        site.insert(k.clone(), allow);
    }
    super::agent::write_atomic(&path(dir), serde_json::to_string_pretty(&d).unwrap_or_default().as_bytes())
}

/// The prompt's sentence. `origin` is untrusted: control characters become spaces and it is
/// capped, so it renders as one plain line.
pub fn prompt_text(origin: &str, kinds: &[String]) -> String {
    let clean: String = origin.chars().map(|c| if c.is_control() { ' ' } else { c }).collect();
    let site = if clean.chars().count() > 80 { clean.chars().take(80).collect::<String>() + "…" } else { clean };
    let words: Vec<&str> = kinds
        .iter()
        .map(|k| match k.as_str() {
            "camera" => "your camera",
            "microphone" => "your microphone",
            "geolocation" => "your location",
            "clipboard-read" => "what you copied",
            _ => "something else",
        })
        .collect();
    let list = match words.as_slice() {
        [] => "something".to_string(),
        [one] => one.to_string(),
        [rest @ .., last] => format!("{} and {last}", rest.join(", ")),
    };
    format!("{site} wants to use {list}")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fresh folder, removed when dropped.
    struct Tmp(PathBuf);
    impl Tmp {
        fn path(&self) -> &Path {
            &self.0
        }
    }
    impl Drop for Tmp {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn tmp() -> Tmp {
        static N: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
        let n = N.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let d = std::env::temp_dir().join(format!("herdr-permissions-{}-{n}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        Tmp(d)
    }

    fn kinds(k: &[&str]) -> Vec<String> {
        k.iter().map(|s| s.to_string()).collect()
    }

    #[::core::prelude::v1::test]
    fn remembered_per_origin_and_kind_exactly() {
        let d = tmp();
        let o = "https://meet.test";
        assert_eq!(decided(d.path(), "default", o, &kinds(&["camera"])), None);
        remember(d.path(), "default", o, &kinds(&["camera"]), true).unwrap();
        assert_eq!(decided(d.path(), "default", o, &kinds(&["camera"])), Some(true));
        assert_eq!(decided(d.path(), "default", o, &kinds(&["camera", "microphone"])), None, "a new kind asks");
        assert_eq!(decided(d.path(), "default", "https://meet.test:8443", &kinds(&["camera"])), None, "another origin asks");
        remember(d.path(), "default", o, &kinds(&["microphone"]), false).unwrap();
        assert_eq!(decided(d.path(), "default", o, &kinds(&["camera", "microphone"])), Some(false), "a block is remembered too");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(std::fs::metadata(path(d.path())).unwrap().permissions().mode() & 0o777, 0o600);
        }
    }

    #[::core::prelude::v1::test]
    fn the_agent_profile_never_reads_or_writes() {
        let d = tmp();
        remember(d.path(), "agent", "https://a.test", &kinds(&["camera"]), true).unwrap();
        assert!(!path(d.path()).exists());
        remember(d.path(), "default", "https://a.test", &kinds(&["camera"]), true).unwrap();
        assert_eq!(decided(d.path(), "agent", "https://a.test", &kinds(&["camera"])), None);
    }

    #[::core::prelude::v1::test]
    fn a_corrupt_file_is_moved_aside_once_and_read_as_empty() {
        let d = tmp();
        std::fs::write(path(d.path()), "{not json").unwrap();
        assert_eq!(decided(d.path(), "default", "https://a.test", &kinds(&["camera"])), None);
        let aside: Vec<_> = std::fs::read_dir(d.path()).unwrap().filter_map(|e| e.ok()).filter(|e| e.file_name().to_string_lossy().starts_with("permissions.json.corrupt-")).collect();
        assert_eq!(aside.len(), 1);
        assert_eq!(std::fs::read_to_string(aside[0].path()).unwrap(), "{not json");
        assert!(!path(d.path()).exists());
    }

    #[::core::prelude::v1::test]
    fn hostile_origins_render_as_one_plain_capped_line() {
        let t = prompt_text("https://a.test\n<b>Allow</b>\r\u{7}", &kinds(&["camera", "microphone"]));
        assert_eq!(t, "https://a.test <b>Allow</b>   wants to use your camera and your microphone");
        let long = prompt_text(&format!("https://{}", "x".repeat(500)), &kinds(&["geolocation"]));
        assert!(long.starts_with("https://xxx") && long.contains("…") && long.chars().count() < 120 && !long.contains('\n'));
        assert_eq!(prompt_text("https://m.test", &kinds(&["camera", "microphone", "geolocation"])), "https://m.test wants to use your camera, your microphone and your location");
    }
}
