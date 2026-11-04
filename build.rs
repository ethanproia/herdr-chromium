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
    let field = |key: &str| -> String {
        let at = text.find(&format!("\"{key}\"")).unwrap_or_else(|| panic!("brand.json has no {key}"));
        let rest = &text[at + key.len() + 2..];
        let start = rest.find('"').unwrap() + 1;
        let end = start + rest[start..].find('"').unwrap();
        rest[start..end].to_string()
    };
    // The first occurrence of each key is the current brand (`previous` comes after).
    let prev_layouts: Vec<String> = text.split("\"previous\"").nth(1).map(|p| {
        p.split("\"layout\"").skip(1).filter_map(|s| { let s = &s[s.find('"')? + 1..]; Some(s[..s.find('"')?].to_string()) }).collect()
    }).unwrap_or_default();
    let code = format!(
        "pub const NAME: &str = {:?};\npub const SLUG: &str = {:?};\npub const LAYOUT: &str = {:?};\n/// Layout names earlier brands used (homes may still name them).\npub const OLD_LAYOUTS: &[&str] = &{:?};\n",
        field("name"), field("slug"), field("layout"), prev_layouts
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
