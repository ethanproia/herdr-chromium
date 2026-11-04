# Installing the fork next to stock Herdr (plan, for review)

Status: `scripts/install-fork-macos` implements this plan, tested on a scratch HOME only
(`scripts/test-install-fork.sh`). It has not been run against Ethan's real HOME. `scripts/install-macos` is
unchanged and must not be used for the fork: it overwrites
`~/Applications/Herdr.app` (bundle id `dev.herdr.app`) and the
`~/.local/bin/herdr-app` link, and it doesn't install the browser host
(review P1-13).

## Goals

- Stock Herdr keeps working exactly as before: same app, same CLI, same home
  (`~/.config/herdr-app`), same running terminals.
- The fork is a second app that can run at the same time and be removed
  without leaving traces in stock's files.
- Switching back is one command and never needs a stock reinstall.

## What the fork install looks like

| | Stock | Fork |
|---|---|---|
| App | `~/Applications/Herdr.app` | `~/Applications/Trestle.app` |
| Bundle id | `dev.herdr.app` | `dev.trestle.app` |
| CLI link | `~/.local/bin/herdr-app` | `~/.local/bin/trestle` |
| Home | `~/.config/herdr-app` | `~/.config/trestle` (`HERDR_APP_HOME`) |
| Core session | stock's | `HC_SESSION=trestle` (own herdr-core, own terminals) |
| Browser host | none | `Contents/Frameworks/herdr-browser-host.app` |
| Updates | upstream | off: a source build never checks (`HERDR_APP_RELEASE` unset); `HERDR_RELEASES_URL` stays unset until a fork channel exists |

The fork reads its home from `HERDR_APP_HOME` (`src/mods.rs:53`). It finds the
browser host from `HERDR_BROWSER_HOST`, or else beside its own binary
(`src/browser/view.rs:146`). Both are set in the bundle's `LSEnvironment`, so
Finder and Dock launches get them.

## Steps (`scripts/install-fork-macos`)

1. Build: `cargo build --release` and the browser host
   (`crates/herdr-browser-host`, release), both through the build slot.
2. Assemble `~/Applications/Trestle.app.new`:
   - `Contents/MacOS/Trestle`: the release `herdr-app` binary.
   - `Contents/Frameworks/herdr-browser-host.app`: the host bundle from
     `scripts/fork-host-bundle.sh release`, which carries its own CEF framework
     and helpers (see `docs/fork-host.md`).
   - `Contents/Resources/Herdr.icns`. A distinct icon later, so the two apps
     can be told apart in the Dock.
   - An `Info.plist` like stock's, except:
     - `CFBundleIdentifier` `dev.trestle.app`;
     - `CFBundleName` and `CFBundleDisplayName` `Trestle`;
     - `CFBundleExecutable` `Trestle`;
     - `LSEnvironment` sets `HERDR_APP_HOME=~/.config/trestle`,
       `HC_SESSION=trestle`, `HERDR_APP_ID=trestle`,
       `HERDR_BROWSER_HOST=<app>/Contents/Frameworks/herdr-browser-host.app/Contents/MacOS/herdr-browser-host`, and
       stock's PATH line.
3. Sign it: `codesign --force --deep --sign - "Trestle.app.new"`. This is
   ad hoc for Ethan's Mac only; public builds need Developer ID signing,
   notarization and the CEF sandbox (review P0-08).
4. Swap it in: `mv` the old `Trestle.app` aside, then move `.new` into
   place, so a failed step never leaves a half-written app.
5. Link the CLI: `ln -sfn "<app>/Contents/MacOS/Trestle" ~/.local/bin/trestle`.
   Never touch `~/.local/bin/herdr-app`.
6. Register: `lsregister -f "<app>"`.

## First run: a copy of the stock home

The installer never writes inside `~/.config/herdr-app`. On first install only
(when `~/.config/trestle` doesn't exist), it:

1. Copies `~/.config/herdr-app` to `~/.config/trestle`. It reads stock's
   files and never moves them, and leaves out sockets
   (`herdr-app.sock`) and `layouts/.state`.
2. Writes `"layout": "labs"` into the copy's `shared.json`, so the fork opens
   on Labs.
3. Leaves the copy's `keys.json` alone. The mod key merge adds the fork's
   bundled keys and keeps Ethan's own (`keys.json.bak` is the before copy).

Data that lives outside the home has to be checked as well (review P2-19):

- Notepad: in a non-default home it writes under `<home>/data/notepad`, not
  `~/Notes`. Decide whether to copy his `~/Notes/notepad.md` in once, or point
  the fork at it read only. Default: copy once.
- Board: its cache is under `<home>/data/herdr-board`, so the copy covers it.

## Moving over from an earlier name

The name lives in `brand.json`, and earlier names are listed under `previous` (Herdr Labs
first). When the installer finds an install under an earlier name:

1. It quits it, then moves its app and CLI link (`~/Applications/Herdr Labs.app`,
   `~/.local/bin/herdr-labs`) to the Trash. Nothing is deleted.
2. It copies its home (`~/.config/herdr-labs`) to the new one once. That includes
   layouts and their `.state`, the personal `labs` layout, settings, keys and notes;
   sockets are left out. The old home stays where it is, as a backup. A new home that
   already exists is never written over.
3. If the old core session (`herdr-labs`) still runs terminals, it keeps that session,
   because those terminals are the person's. The installer says so, and later updates keep
   it. If the old session is empty, the install uses the new session (`trestle`).

Stock Herdr's app, CLI link and home are never touched.

## Terminals

The fork uses its own herdr-core session, so it starts with no terminals and
never touches the agents running in stock. Sharing stock's core, so the
fork sees and drives the same terminals, is a separate step for later. It
needs a check that stock and the fork's herdr-core versions agree, plus a
proof that a switch back leaves those terminals running. Until then, the
copy brings over spaces and layout state, but not live terminals.

## Switching back

`trestle uninstall` (or `scripts/install-fork-macos --remove`; the app keeps a copy of
the installer in `Contents/Resources`, so this works after the checkout is gone):

1. Quits Trestle (`trestle do app.quit`), and stops its herdr-core
   session with `hc --session trestle` and the core's stop command.
2. Moves `~/Applications/Trestle.app` and `~/.local/bin/trestle` to the
   Trash. Nothing is deleted outright.
3. Keeps `~/.config/trestle`, unless `--purge` is given, which trashes it
   too.

Stock was never modified, so switching back is just opening Herdr.

## Verification before Ethan uses it

On a test account, or with `HOME` pointed at a scratch folder:

1. Install. Check that stock's `Herdr.app`, `~/.local/bin/herdr-app` and
   `~/.config/herdr-app` are byte-for-byte unchanged (`shasum` before and
   after).
2. Run both apps at once. Each has its own windows, CLI and core, and stock's
   terminals keep running.
3. Uninstall. Check that stock is still byte-for-byte unchanged and opens
   normally.
4. In the fork, check: browser blocks open (the host is found in Frameworks),
   the Labs layout, the bundled mods, and copied keys and settings.

## Open questions for review

1. Name: decided (Trestle, 2026-11-04); it is one edit in `brand.json` (docs/branding.md).
2. Notepad: copy `~/Notes/notepad.md` once, or share it?
3. Should the fork share stock's herdr-core in a later phase, or always keep
   its own?
4. Update channel: none until a signed, notarized fork release exists.
