//! ~/.config/herdr-app/keys.json: every key is a string action, reloaded live.
//!
//! ```json
//! {
//!   "global":   { "ctrl-shift-t": "tab.new", "ctrl-1": "tab.select:1" },
//!   "terminal": { "ctrl-left": "send:\u001bb", "ctrl-shift-t": "terminal" },
//!   "layout:terminals": { "ctrl-]": "space.next" },
//!   "mod:editor": { "ctrl-s": "editor.save" }
//! }
//! ```
//!
//! An action is a command (`pane.split:right`: the value fills its first
//! argument), `send:<text>` (types into the focused terminal),
//! `<mod>.<command>` (delivered to that mod's `nextCommand()`), or `terminal`
//! (the program gets the key: the binding is switched off where this section
//! applies).

use gpui::{App, KeyBinding, KeyBindingContextPredicate, NoAction};
use std::rc::Rc;
use gpui_shell::action::ShellAction;
use std::collections::BTreeMap;

/// The reserved shortcut that restores the default layout and keys.
pub const ESCAPE_HATCH: &str = "ctrl-alt-shift-escape";

/// The shipped keys: prefix-free; plain ctrl+letter always stays with the
/// program. Herdr uses ctrl+shift (defaults/keys.json), or cmd on macOS
/// (defaults/keys.macos.json, with Mac terminal editing keys).
#[cfg(not(target_os = "macos"))]
pub const DEFAULTS: &str = include_str!("../defaults/keys.json");
#[cfg(target_os = "macos")]
pub const DEFAULTS: &str = include_str!("../defaults/keys.macos.json");

fn defaults() -> BTreeMap<String, BTreeMap<String, String>> {
    serde_json::from_str(DEFAULTS).expect("defaults/keys.json is valid")
}

/// Every binding as `(section, keys, action)`, for the keybind help.
pub fn listing() -> Vec<(String, String, String)> {
    let text = std::fs::read_to_string(path()).unwrap_or_default();
    let sections: BTreeMap<String, BTreeMap<String, String>> = serde_json::from_str(&text).unwrap_or_else(|_| defaults());
    let mut out = Vec::new();
    for (s, keys) in sections {
        for (k, a) in keys {
            let a = current(&a);
            if !gone_mod(&a) {
                out.push((s.clone(), k, a));
            }
        }
    }
    out.push(("global".into(), ESCAPE_HATCH.into(), "app.reset".into()));
    out
}

pub fn path() -> std::path::PathBuf {
    crate::mods::app_dir().join("keys.json")
}

/// The GPUI key tab a section applies in. `global` is the window itself,
/// not "no tab": GPUI ranks a binding without one above every other, so
/// it would beat `layout:` (same depth, added earlier) and only lose to
/// `terminal` and `mod:` by order.
fn tab(section: &str) -> Result<String, String> {
    match section {
        "global" => Ok("Herdr".into()),
        "terminal" => Ok("Terminal".into()),
        s => match (s.strip_prefix("mod:"), s.strip_prefix("layout:")) {
            (Some(p), _) if !p.is_empty() => Ok(format!("mod == {p}")),
            // While layouts/<name>.json is shown (the window's tab says which).
            (_, Some(l)) if !l.is_empty() => Ok(format!("layout == {l}")),
            _ => Err(format!("unknown section {s:?}: use \"global\", \"terminal\", \"layout:<name>\" or \"mod:<name>\"")),
        },
    }
}

/// 0.1.0's words in a keys.json from then (installed once, so still theirs):
/// projects became spaces, contexts tabs, the start popup the new tab.
pub(crate) fn current(action: &str) -> String {
    if action == "mod.open:start" {
        return "tab.new".into();
    }
    let command = |a: &str| crate::commands::find(a.split_once(':').map_or(a, |(n, _)| n)).is_some();
    for (old, new) in [("project.", "space."), ("context.", "tab.")] {
        if let Some(rest) = action.strip_prefix(old) {
            let renamed = format!("{new}{rest}");
            // Only a command that was renamed: a mod named `project` keeps its own.
            if command(&renamed) && !command(action) {
                return renamed;
            }
        }
    }
    action.to_owned()
}

/// A mod's command whose mod is gone (0.1.x's `ribbon.next`): bound to nothing.
fn gone_mod(action: &str) -> bool {
    let name = action.split_once(':').map_or(action, |(n, _)| n);
    // HERDR: keys of a mod turned off (settings mods_disabled) are skipped like a missing mod's.
    let off = crate::mods::disabled();
    if action.strip_prefix("mod.open:").is_some_and(|m| off.contains(m)) || name.split_once('.').is_some_and(|(m, _)| off.contains(m)) {
        return true;
    }
    crate::commands::find(name).is_none()
        && name.split_once('.').is_some_and(|(m, _)| !m.starts_with("frame-") && !crate::mods::mods_dir().join(m).is_dir())
}

// HERDR: fork-core's split commands open its New panel chooser; while fork-core is
// turned off or missing their keys fall back to the built-in split instead of going dead.
const FALLBACKS: &[(&str, &str)] = &[("fork-core.split-right", "pane.split:right"), ("fork-core.split-down", "pane.split:down")];

/// The action a binding runs: itself, a gone mod's fallback, or None (bound to nothing).
fn resolve(action: &str, gone: impl Fn(&str) -> bool) -> Option<String> {
    if !gone(action) {
        return Some(action.to_owned());
    }
    FALLBACKS.iter().find(|(a, _)| *a == action).map(|(_, b)| (*b).to_owned())
}

fn valid_action(action: &str) -> bool {
    let name = action.split_once(':').map_or(action, |(n, _)| n);
    crate::commands::find(name).is_some()
        || action == "terminal"
        || action.starts_with("send:")
        || name.split_once('.').is_some_and(|(m, c)| !m.is_empty() && !c.is_empty())
}

/// Reads keys.json (writing the defaults if it's missing) into bindings, or says what's wrong.
pub fn load() -> Result<Vec<KeyBinding>, String> {
    let p = path();
    if !p.exists() {
        let _ = std::fs::write(&p, DEFAULTS);
    }
    let text = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    parse(&text)
}

pub fn parse(text: &str) -> Result<Vec<KeyBinding>, String> {
    let sections: BTreeMap<String, BTreeMap<String, String>> = serde_json::from_str(text).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    let mut problems = Vec::new();
    for (section, keys) in &sections {
        let ctx = match tab(section) {
            Ok(c) => c,
            Err(e) => {
                problems.push(e);
                continue;
            }
        };
        for (keys, action) in keys {
            let Some(action) = resolve(&current(action), gone_mod) else { continue };
            let action = &action;
            if !valid_action(action) {
                problems.push(format!("{section}.{keys}: unknown action {action:?}"));
                continue;
            }
            if keys == ESCAPE_HATCH {
                problems.push(format!("{ESCAPE_HATCH} is reserved for resetting Herdr"));
                continue;
            }
            let predicate = match KeyBindingContextPredicate::parse(&ctx) {
                Ok(p) => Some(Rc::new(p)),
                Err(e) => {
                    problems.push(format!("{section}: {e}"));
                    continue;
                }
            };
            let action: Box<dyn gpui::Action> = if action == "terminal" {
                // Off where this section applies; globally, simply not bound.
                if section == "global" {
                    continue;
                }
                Box::new(NoAction)
            } else {
                #[cfg(target_os = "macos")]
                let native = crate::macos::action(action);
                #[cfg(not(target_os = "macos"))]
                let native: Option<Box<dyn gpui::Action>> = None;
                native.unwrap_or_else(|| Box::new(ShellAction::new(action.clone())))
            };
            let binding = KeyBinding::load(keys, action, predicate, false, None, &gpui::DummyKeyboardMapper);
            match binding {
                Ok(b) => out.push(b),
                Err(e) => problems.push(format!("{section}.{keys}: {e}")),
            }
        }
    }
    if problems.is_empty() { Ok(out) } else { Err(problems.join("; ")) }
}

/// The UI kit's own keys (text editing in inputs, lists): bound at its init,
/// kept across every reload of keys.json.
struct KitKeys(Vec<KeyBinding>);
impl gpui::Global for KitKeys {}

/// Restores kit bindings, installs user bindings, then adds reserved bindings.
pub fn install(bindings: Vec<KeyBinding>, cx: &mut App) {
    if !cx.has_global::<KitKeys>() {
        let kit = cx.key_bindings().borrow().bindings().cloned().collect();
        cx.set_global(KitKeys(kit));
    }
    let kit = cx.global::<KitKeys>().0.clone();
    cx.clear_key_bindings();
    cx.bind_keys(kit);
    cx.bind_keys(bindings);
    cx.bind_keys([
        KeyBinding::new(ESCAPE_HATCH, ShellAction::new("app.reset"), None),
        KeyBinding::new("escape", ShellAction::new("overlay.close"), Some("Overlay")),
    ]);
}

#[cfg(test)]
mod tests {
    #[test]
    fn keys_from_0_1_0_mean_the_same_now() {
        assert_eq!(super::current("project.select:2"), "space.select:2");
        assert_eq!(super::current("context.new"), "tab.new");
        assert_eq!(super::current("mod.open:start"), "tab.new");
        assert_eq!(super::current("pane.zoom"), "pane.zoom");
    }

    #[test]
    fn core_split_keys_fall_back_while_core_is_off_or_missing() {
        use super::resolve;
        // fork-core on: its command.
        assert_eq!(resolve("fork-core.split-right", |_| false).as_deref(), Some("fork-core.split-right"));
        // Turned off (mods_disabled) or folder missing: gone_mod is true either way.
        assert_eq!(resolve("fork-core.split-right", |_| true).as_deref(), Some("pane.split:right"));
        assert_eq!(resolve("fork-core.split-down", |_| true).as_deref(), Some("pane.split:down"));
        // Any other gone mod's key stays unbound.
        assert_eq!(resolve("ribbon.next", |_| true), None);
    }

    #[test]
    fn own_cmd_d_is_never_replaced() {
        // A person's own action on the key is kept as written: no fallback applies to it.
        assert_eq!(super::resolve("pane.zoom", |_| false).as_deref(), Some("pane.zoom"));
        assert_eq!(super::parse(r#"{ "global": { "cmd-d": "pane.zoom" } }"#).unwrap().len(), 1);
    }

    #[test]
    fn shipped_keys_load() {
        for keys in [include_str!("../defaults/keys.json"), include_str!("../defaults/keys.macos.json")] {
            assert_eq!(super::parse(keys).err(), None);
        }
    }
}
