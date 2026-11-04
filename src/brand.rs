//! HERDR: the fork's user-facing name and layout, generated from brand.json at build time
//! (build.rs). Change the name there; internals (crates, binaries, HERDR_* variables, the
//! herdr-app CLI mods call) keep their herdr names. See docs/branding.md.
include!(concat!(env!("OUT_DIR"), "/brand.rs"));

#[cfg(test)]
mod tests {
    #[test]
    fn the_brand_comes_from_brand_json() {
        let json: serde_json::Value = serde_json::from_str(include_str!("../brand.json")).unwrap();
        assert_eq!(super::NAME, json["name"]);
        assert_eq!(super::SLUG, json["slug"]);
        assert_eq!(super::LAYOUT, json["layout"]);
        let old: Vec<&str> = json["previous"].as_array().unwrap().iter().map(|p| p["layout"].as_str().unwrap()).collect();
        assert_eq!(super::OLD_LAYOUTS, old.as_slice());
    }
}
