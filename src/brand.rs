//! HERDR: the fork's user-facing name, generated from brand.json at build time (build.rs).
//! Change the name there; internals (crates, binaries, HERDR_* variables, the herdr-app CLI
//! mods call, the `labs` layout file) keep their names. See docs/branding.md.
include!(concat!(env!("OUT_DIR"), "/brand.rs"));

#[cfg(test)]
mod tests {
    #[test]
    fn the_brand_comes_from_brand_json() {
        let json: serde_json::Value = serde_json::from_str(include_str!("../brand.json")).unwrap();
        assert_eq!(super::NAME, json["name"]);
        assert_eq!(super::SLUG, json["slug"]);
    }
}
