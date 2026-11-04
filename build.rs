//! Embeds the default mods (defaults/mods/**), the program icons
//! (defaults/icons/*) and the frame's mods (defaults/frame/**) so Herdr can
//! install them.
//!
//! Worktrees may share one target dir, and with it this script and its output.
//! So nothing here names this checkout: paths are relative to the package and
//! the generated code includes files through the compiling crate's
//! `CARGO_MANIFEST_DIR`.

use std::path::Path;

fn walk(dir: &Path, base: &Path, root: &Path, out: &mut Vec<String>) {
    let mut entries: Vec<_> = std::fs::read_dir(dir).unwrap().flatten().map(|e| e.path()).collect();
    entries.sort();
    for p in entries {
        if p.is_dir() {
            walk(&p, base, root, out);
        } else {
            let path = p.strip_prefix(base).unwrap().to_string_lossy().replace('\\', "/");
            println!("cargo:rerun-if-changed={path}");
            let rel = p.strip_prefix(root).unwrap().to_string_lossy().replace('\\', "/");
            out.push(format!("    ({rel:?}, include_bytes!(concat!(env!(\"CARGO_MANIFEST_DIR\"), \"/{path}\"))),"));
        }
    }
}

fn embed(base: &Path, folder: &str, name: &str, file: &str) {
    println!("cargo:rerun-if-changed={folder}");
    let mut lines = Vec::new();
    let root = base.join(folder);
    walk(&root, base, &root, &mut lines);
    let code = format!("pub const {name}: &[(&str, &[u8])] = &[\n{}\n];\n", lines.join("\n"));
    std::fs::write(Path::new(&std::env::var("OUT_DIR").unwrap()).join(file), code).unwrap();
}

/// HERDR: the fork's user-facing name, from brand.json (one file; docs/branding.md).
fn brand(base: &Path) {
    println!("cargo:rerun-if-changed=brand.json");
    let text = std::fs::read_to_string(base.join("brand.json")).expect("brand.json");
    let opt_field = |key: &str| -> Option<String> {
        let at = text.find(&format!("\"{key}\""))?;
        let rest = &text[at + key.len() + 2..];
        let start = rest.find('"')? + 1;
        Some(rest[start..start + rest[start..].find('"')?].to_string())
    };
    let field = |key: &str| -> String {
        let at = text.find(&format!("\"{key}\"")).unwrap_or_else(|| panic!("brand.json has no {key}"));
        let rest = &text[at + key.len() + 2..];
        let start = rest.find('"').unwrap() + 1;
        let end = start + rest[start..].find('"').unwrap();
        rest[start..end].to_string()
    };
    // Build info (shown once its place is settled): the fork's version, the Herdr version it is
    // built on (this crate's), and the commit it was built from.
    let sha = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .current_dir(base)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "unknown".into());
    // A new commit is a new GIT_SHA: watch this checkout's own HEAD (a worktree's lives in the
    // main repository), and its branch ref.
    let git = |args: &[&str]| std::process::Command::new("git").args(args).current_dir(base).output().ok().filter(|o| o.status.success()).map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
    if let Some(head) = git(&["rev-parse", "--absolute-git-dir"]) {
        println!("cargo:rerun-if-changed={head}/HEAD");
        if let Some(r) = git(&["symbolic-ref", "-q", "HEAD"]) {
            println!("cargo:rerun-if-changed={head}/{r}");
        }
    }
    let code = format!(
        "pub const NAME: &str = {:?};\npub const SLUG: &str = {:?};\n/// The fork's own version (brand.json).\npub const VERSION: &str = {:?};\n/// The stock Herdr version this build is based on.\npub const HERDR_BASE: &str = {:?};\n/// The commit this build was made from (short sha, \"unknown\" outside git).\npub const GIT_SHA: &str = {:?};\n",
        field("name"), field("slug"), opt_field("version").unwrap_or_else(|| "0.0.0".into()), std::env::var("CARGO_PKG_VERSION").unwrap(), sha
    );
    std::fs::write(Path::new(&std::env::var("OUT_DIR").unwrap()).join("brand.rs"), code).unwrap();
}

fn main() {
    let base = std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    brand(&base);
    embed(&base, "defaults/mods", "DEFAULT_MODS", "default_mods.rs");
    embed(&base, "defaults/icons", "DEFAULT_ICONS", "default_icons.rs");
    embed(&base, "defaults/frame", "FRAME_MODS", "frame_mods.rs");

    // Windows takes the window, taskbar and Start menu icon from the program file.
    #[cfg(windows)]
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!("cargo:rerun-if-changed=assets/icons/herdr-app.ico");
        winresource::WindowsResource::new().set_icon("assets/icons/herdr-app.ico").compile().expect("cannot embed the icon");
    }
}
