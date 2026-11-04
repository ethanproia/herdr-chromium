# Branding: the fork's name

## Change the name: edit brand.json

The fork's name is one file, `brand.json` at the repository root:

```json
{ "name": "…", "slug": "…", "bundle_id": "…", "cli": "…", "home": ".config/…", "session": "…",
  "previous": [ { "name": "Herdr Labs", … } ] }
```

Edit it and rebuild. `build.rs` turns it into the app's constants (`src/brand.rs`), and the
scripts read it through `scripts/brand.sh`. Before changing a released name, move the old one
into `previous`, so installs under it are migrated (docs/fork-install.md). `scripts/test-brand.sh` checks that everything agrees with the file, and that no
earlier name is written outside its allow-list.

## User-facing rename (the default, on ethan/browser-parity)

Only what the person sees follows `brand.json`:

- the window and menu titles;
- the setup screen and app notices;
- the installed app's name and bundle id, its CLI link, its home folder and its core session
  (the installer; held until the name is released).

Internal names keep herdr. That covers the crates and binaries (`herdr-app`,
`herdr-browser-*`), the `HERDR_*` variables, the bundled mods' `fork-*` prefix, `src/`
modules, the stock `herdr-app` and `hc` CLIs that mods call, and the `labs` layout (the
person's own file, with its window state). That way, merges from
upstream Herdr stay small.

## Deep rename (for a release branch)

`scripts/rename-brand.sh --dry-run` lists every internal herdr name the deep rename would
change: each file, its match count, and what the allow-list protects. These are:

- vendored and third-party code;
- licence and notice files;
- lines with URLs;
- the stock `herdr-app` CLI in `defaults/`;
- stock Herdr's own paths.

`scripts/rename-brand.sh --deep` applies it. That rewrites:

- the crates and binaries to `<slug>-app` and `<slug>-browser-*`;
- `HERDR_` to `<SLUG>_`;
- the bundled mods' `fork-` prefix to `<slug>-`;
- the names of files and folders carrying these names.

It refuses to run on `ethan/browser-parity`, `master` or `main`. Run it on a throwaway
release branch (`ethan/release-<name>`) and never merge that branch back.

`scripts/test-rename-brand.sh [slug]` proves it on a scratch copy. After a deep rename to
another name, the copy must:

- build (workspace, all targets, and the CEF host feature);
- pass the app tests;
- pass `test-brand.sh`;
- pass the installer's scratch-HOME test.
