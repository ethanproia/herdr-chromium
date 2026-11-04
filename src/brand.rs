//! HERDR: the fork's user-facing name, generated from brand.json at build time (build.rs).
//! Change the name there; internals (crates, binaries, HERDR_* variables, the herdr-app CLI
//! mods call, the `labs` layout file) keep their names. See docs/branding.md.
include!(concat!(env!("OUT_DIR"), "/brand.rs"));

/// "Trestle 0.2.0 (Herdr 0.1.13, 4101803)": `--version`, `status`, Settings and the installer.
pub fn version_line() -> String {
    format!("{NAME} {VERSION} (Herdr {HERDR_BASE}, {GIT_SHA})")
}

/// The build for the About block in Settings (`updates().build`): the name, versions and commit,
/// and each bundled mod with the labs commit it is pinned to (defaults/bundled-mods.lock.json).
/// Not a mod API export: the version shows on the About screen, --version, status and the installer only.
pub fn app_info() -> serde_json::Value {
    let lock: serde_json::Value = serde_json::from_str(include_str!("../defaults/bundled-mods.lock.json")).unwrap_or_default();
    let mods: Vec<serde_json::Value> = lock["mods"]
        .as_object()
        .map(|m| m.iter().map(|(k, v)| serde_json::json!({ "name": k, "commit": v["commit"] })).collect())
        .unwrap_or_default();
    serde_json::json!({ "name": NAME, "version": VERSION, "base": HERDR_BASE, "sha": GIT_SHA, "line": version_line(), "mods": mods })
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_brand_comes_from_brand_json() {
        let json: serde_json::Value = serde_json::from_str(include_str!("../brand.json")).unwrap();
        assert_eq!(super::NAME, json["name"]);
        assert_eq!(super::SLUG, json["slug"]);
        assert_eq!(super::VERSION, json["version"]);
        assert_eq!(super::HERDR_BASE, env!("CARGO_PKG_VERSION"));
        assert!(!super::GIT_SHA.is_empty());
    }

    #[test]
    fn the_about_block_names_the_build_and_every_pinned_mod() {
        let info = super::app_info();
        assert_eq!((info["name"].as_str(), info["version"].as_str(), info["base"].as_str()), (Some(super::NAME), Some(super::VERSION), Some(env!("CARGO_PKG_VERSION"))));
        assert_eq!(info["sha"], super::GIT_SHA);
        assert_eq!(info["line"], format!("{} {} (Herdr {}, {})", super::NAME, super::VERSION, env!("CARGO_PKG_VERSION"), super::GIT_SHA));
        let lock: serde_json::Value = serde_json::from_str(include_str!("../defaults/bundled-mods.lock.json")).unwrap();
        let mods = info["mods"].as_array().unwrap();
        assert_eq!(mods.len(), lock["mods"].as_object().unwrap().len());
        for m in mods {
            let name = m["name"].as_str().unwrap();
            assert_eq!(m["commit"], lock["mods"][name]["commit"], "{name}");
            assert!(m["commit"].as_str().is_some_and(|c| c.len() >= 7), "{name} has a commit");
        }
    }
}
