#!/usr/bin/env bash
# scripts/install-fork-macos on a scratch HOME with a fake stock Herdr: it installs Herdr Labs
# beside stock, copies stock's home and note once, updates in place, and removes to the
# Trash. Stock's app, CLI link, home and notes stay byte-for-byte the same throughout.
# Never builds, never registers with LaunchServices, never touches the real HOME.
#   HERDR_APP_BIN=<herdr-app> scripts/test-install-fork.sh
set -uo pipefail
cd "$(dirname "$0")/.."
: "${HERDR_APP_BIN:?set HERDR_APP_BIN to a herdr-app build}"
fails=0
ok() { echo "ok   $*"; }
bad() { echo "FAIL $*"; fails=$((fails + 1)); }

scratch=$(mktemp -d "${TMPDIR:-/tmp}/install-fork.XXXXXX")
H=$scratch/home
mkdir -p "$H/Applications/Herdr.app/Contents/MacOS" "$H/.local/bin" "$H/.config/herdr-app/layouts/.state" "$H/Notes"
printf 'stock binary\n' > "$H/Applications/Herdr.app/Contents/MacOS/Herdr"
ln -s "$H/Applications/Herdr.app/Contents/MacOS/Herdr" "$H/.local/bin/herdr-app"
printf '{ "theme": "dark" }\n' > "$H/.config/herdr-app/settings.json"
printf '{ "layout": "main", "frame.welcomed": "done" }\n' > "$H/.config/herdr-app/shared.json"
printf '{ "global": { "cmd-t": "tab.new" } }\n' > "$H/.config/herdr-app/keys.json"
printf 'state\n' > "$H/.config/herdr-app/layouts/.state/main.json"
printf 'sock\n' > "$H/.config/herdr-app/herdr-app.sock"
printf '# My note\n' > "$H/Notes/notepad.md"

# A stand-in host bundle: the installer only copies it.
host=$scratch/herdr-browser-host.app
mkdir -p "$host/Contents/MacOS" && printf '#!/bin/sh\n' > "$host/Contents/MacOS/herdr-browser-host" && chmod +x "$host/Contents/MacOS/herdr-browser-host"

stock_sum() { (cd "$H" && find Applications/Herdr.app .local/bin/herdr-app .config/herdr-app Notes -print0 | sort -z | xargs -0 shasum 2>/dev/null; readlink .local/bin/herdr-app) | shasum; }
before=$(stock_sum)
run() { HOME=$H HERDR_APP_BIN=$HERDR_APP_BIN HERDR_HOST_APP=$host FORK_INSTALL_NO_REGISTER=1 scripts/install-fork-macos "$@"; }

run >"$scratch/install.log" 2>&1 && ok "install runs" || bad "install: $(tail -3 "$scratch/install.log")"
app="$H/Applications/Herdr Labs.app"
plist="$app/Contents/Info.plist"
pv() { /usr/libexec/PlistBuddy -c "Print :$1" "$plist" 2>/dev/null; }
[[ -x "$app/Contents/MacOS/Herdr Labs" ]] && ok "app binary in place" || bad "app binary"
[[ -x "$app/Contents/Frameworks/herdr-browser-host.app/Contents/MacOS/herdr-browser-host" ]] && ok "host nested in Frameworks" || bad "host in Frameworks"
[[ $(pv CFBundleIdentifier) == dev.herdr.app.labs ]] && ok "own bundle id" || bad "bundle id: $(pv CFBundleIdentifier)"
[[ $(pv LSEnvironment:HERDR_APP_HOME) == "$H/.config/herdr-labs" ]] && ok "own home in the bundle" || bad "HERDR_APP_HOME: $(pv LSEnvironment:HERDR_APP_HOME)"
[[ $(pv LSEnvironment:HC_SESSION) == herdr-labs ]] && ok "own core session" || bad "HC_SESSION"
[[ $(pv LSEnvironment:HERDR_BROWSER_HOST) == "$app/Contents/Frameworks/herdr-browser-host.app/Contents/MacOS/herdr-browser-host" ]] && ok "host path in the bundle" || bad "HERDR_BROWSER_HOST: $(pv LSEnvironment:HERDR_BROWSER_HOST)"
grep -q "HC_SESSION='herdr-labs'" "$H/.local/bin/herdr-labs" && ok "herdr-labs CLI sets its own session" || bad "CLI env"
[[ -x "$app/Contents/Resources/install-fork-macos" ]] && ok "uninstaller inside the app" || bad "uninstaller copy"
L=$H/.config/herdr-labs
[[ $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["layout"])' "$L/shared.json") == labs ]] && ok "copy opens on labs" || bad "copy layout"
cmp -s "$L/settings.json" "$H/.config/herdr-app/settings.json" && cmp -s "$L/keys.json" "$H/.config/herdr-app/keys.json" && ok "settings and keys copied" || bad "copy content"
[[ ! -e $L/herdr-app.sock && ! -e $L/layouts/.state ]] && ok "sockets and layout state left out" || bad "copied sockets or state"
cmp -s "$L/data/notepad/notepad.md" "$H/Notes/notepad.md" && ok "note copied into the labs home" || bad "note copy"
[[ $(stock_sum) == "$before" ]] && ok "stock untouched after install" || bad "stock changed by install"

# The copy is once: an update keeps the labs home as the person left it.
printf '# Changed in labs\n' > "$L/data/notepad/notepad.md"
run >"$scratch/update.log" 2>&1 && ok "update runs" || bad "update: $(tail -3 "$scratch/update.log")"
grep -q "Changed in labs" "$L/data/notepad/notepad.md" && ok "update keeps the labs home" || bad "update overwrote the labs home"
ls "$H/.Trash" | grep -q "^Herdr Labs.app " && ok "old app moved to the Trash on update" || bad "old app not in Trash"
[[ $(stock_sum) == "$before" ]] && ok "stock untouched after update" || bad "stock changed by update"

HOME=$H "$H/.local/bin/herdr-labs" uninstall >"$scratch/remove.log" 2>&1 && ok "herdr-labs uninstall runs" || bad "uninstall: $(tail -3 "$scratch/remove.log")"
[[ ! -e $app && ! -e $H/.local/bin/herdr-labs ]] && ok "app and CLI gone" || bad "app or CLI left"
[[ -d $L ]] && ok "labs home kept without --purge" || bad "labs home removed"
[[ $(stock_sum) == "$before" ]] && ok "stock untouched after uninstall" || bad "stock changed by uninstall"

# --purge also moves the home to the Trash (the CLI and the home share a name: no collision).
run >"$scratch/reinstall.log" 2>&1 && ok "reinstall runs" || bad "reinstall: $(tail -3 "$scratch/reinstall.log")"
HOME=$H "$H/.local/bin/herdr-labs" uninstall --purge >"$scratch/purge.log" 2>&1 && ok "uninstall --purge runs" || bad "purge: $(tail -3 "$scratch/purge.log")"
[[ ! -e $L && ! -e $app && ! -e $H/.local/bin/herdr-labs ]] && ok "--purge removes the labs home too" || bad "left after --purge: $(ls -d "$L" "$app" "$H/.local/bin/herdr-labs" 2>/dev/null)"
[[ $(ls "$H/.Trash" | grep -c "^herdr-labs ") -ge 2 ]] && ok "CLI and home both in the Trash" || bad "Trash: $(ls "$H/.Trash")"
[[ $(stock_sum) == "$before" ]] && ok "stock untouched after --purge" || bad "stock changed by --purge"

# Refuses to write over stock.
out=$(HOME=$H HERDR_APP_BIN=$HERDR_APP_BIN HERDR_HOST_APP=$host FORK_INSTALL_NO_REGISTER=1 bash -c 'sed "s|^cli=.*|cli=\"\$HOME/.local/bin/herdr-app\"|" scripts/install-fork-macos > "'"$scratch"'/evil" && bash "'"$scratch"'/evil"' 2>&1)
[[ $out == *"refusing"* ]] && ok "refuses to write over stock's CLI" || bad "no refusal: $out"
[[ $(stock_sum) == "$before" ]] && ok "stock untouched at the end" || bad "stock changed"

chmod -R u+w "$scratch" && find "$scratch" -delete
echo "failures: $fails"
exit $((fails > 0))
