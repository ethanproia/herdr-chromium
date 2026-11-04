#!/usr/bin/env bash
# scripts/install-fork-macos on a scratch HOME with a fake stock Herdr: it installs the fork
# under its name (brand.json) beside stock, copies stock's home and note once, updates in
# place, and removes to the Trash. Then: an install under the previous name (brand.json "previous")
# moves over (with and without live terminals in its core session), and another brand.json
# moves every name with it. Stock's app, CLI link, home and notes stay byte-for-byte the
# same throughout. Never builds, never registers with LaunchServices, never touches the real HOME.
#   HERDR_APP_BIN=<herdr-app> scripts/test-install-fork.sh
set -uo pipefail
cd "$(dirname "$0")/.."
: "${HERDR_APP_BIN:?set HERDR_APP_BIN to a herdr-app build}"
source scripts/brand.sh
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
printf 'pending core update\n' > "$H/.config/herdr-app/.updated"
printf '# My note\n' > "$H/Notes/notepad.md"

# A stand-in host bundle: the installer only copies it.
host=$scratch/herdr-browser-host.app
mkdir -p "$host/Contents/MacOS"
printf '#!/bin/sh\n[ "$1" = --capabilities ] && echo '"'"'{"protocol":1,"sandboxed":true}'"'"'\n' > "$host/Contents/MacOS/herdr-browser-host"
chmod +x "$host/Contents/MacOS/herdr-browser-host"
# A pre-SEC4 host: it doesn't know --capabilities.
old_host=$scratch/old-host.app
mkdir -p "$old_host/Contents/MacOS" && printf '#!/bin/sh\nexit 2\n' > "$old_host/Contents/MacOS/herdr-browser-host" && chmod +x "$old_host/Contents/MacOS/herdr-browser-host"

stock_sum() { (cd "$H" && find Applications/Herdr.app .local/bin/herdr-app .config/herdr-app Notes -print0 | sort -z | xargs -0 shasum 2>/dev/null; readlink .local/bin/herdr-app) | shasum; }
before=$(stock_sum)
run() { HOME=$H HERDR_APP_BIN=$HERDR_APP_BIN HERDR_HOST_APP=$host FORK_INSTALL_NO_REGISTER=1 scripts/install-fork-macos "$@"; }

# SEC4: a host without sandboxed helpers is refused, and nothing is installed.
out=$(HOME=$H HERDR_APP_BIN=$HERDR_APP_BIN HERDR_HOST_APP=$old_host FORK_INSTALL_NO_REGISTER=1 scripts/install-fork-macos 2>&1)
[[ $? -ne 0 && $out == *"does not report sandboxed helpers"* && ! -e "$H/Applications/$BRAND_NAME.app" ]] && ok "a pre-SEC4 host is refused" || bad "old host: $out"
run >"$scratch/install.log" 2>&1 && ok "install runs" || bad "install: $(tail -3 "$scratch/install.log")"
grep -q "^Installed $BRAND_NAME $BRAND_VERSION (Herdr " "$scratch/install.log" && ok "installer prints the version line" || bad "no version line: $(tail -1 "$scratch/install.log")"
app="$H/Applications/$BRAND_NAME.app"
CLI=$H/.local/bin/$BRAND_CLI
plist="$app/Contents/Info.plist"
pv() { /usr/libexec/PlistBuddy -c "Print :$1" "$plist" 2>/dev/null; }
[[ -x "$app/Contents/MacOS/$BRAND_NAME" ]] && ok "app binary in place" || bad "app binary"
[[ -x "$app/Contents/Frameworks/herdr-browser-host.app/Contents/MacOS/herdr-browser-host" ]] && ok "host nested in Frameworks" || bad "host in Frameworks"
[[ $(pv CFBundleIdentifier) == "$BRAND_BUNDLE_ID" ]] && ok "own bundle id" || bad "bundle id: $(pv CFBundleIdentifier)"
[[ $(pv LSEnvironment:HERDR_APP_HOME) == "$H/$BRAND_HOME" ]] && ok "own home in the bundle" || bad "HERDR_APP_HOME: $(pv LSEnvironment:HERDR_APP_HOME)"
[[ $(pv LSEnvironment:HC_SESSION) == "$BRAND_SESSION" ]] && ok "own core session" || bad "HC_SESSION"
[[ $(pv LSEnvironment:HERDR_BROWSER_HOST) == "$app/Contents/Frameworks/herdr-browser-host.app/Contents/MacOS/herdr-browser-host" ]] && ok "host path in the bundle" || bad "HERDR_BROWSER_HOST: $(pv LSEnvironment:HERDR_BROWSER_HOST)"
grep -q "HC_SESSION='$BRAND_SESSION'" "$CLI" && ok "$BRAND_CLI CLI sets its own session" || bad "CLI env"
[[ -x "$app/Contents/Resources/install-fork-macos" ]] && ok "uninstaller inside the app" || bad "uninstaller copy"
L=$H/$BRAND_HOME
[[ $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["layout"])' "$L/shared.json") == labs ]] && ok "copy opens on labs" || bad "copy layout"
cmp -s "$L/settings.json" "$H/.config/herdr-app/settings.json" && cmp -s "$L/keys.json" "$H/.config/herdr-app/keys.json" && ok "settings and keys copied" || bad "copy content"
[[ ! -e $L/herdr-app.sock && ! -e $L/layouts/.state ]] && ok "sockets and layout state left out" || bad "copied sockets or state"
[[ ! -e $L/.updated ]] && ok "stock's update marker left out" || bad "copied .updated"
cmp -s "$L/data/notepad/notepad.md" "$H/Notes/notepad.md" && ok "note copied into the labs home" || bad "note copy"
[[ $(stock_sum) == "$before" ]] && ok "stock untouched after install" || bad "stock changed by install"

# The copy is once: an update keeps the labs home as the person left it.
printf '# Changed in labs\n' > "$L/data/notepad/notepad.md"
run >"$scratch/update.log" 2>&1 && ok "update runs" || bad "update: $(tail -3 "$scratch/update.log")"
grep -q "Changed in labs" "$L/data/notepad/notepad.md" && ok "update keeps the labs home" || bad "update overwrote the labs home"
ls "$H/.Trash" | grep -q "^$BRAND_NAME.app " && ok "old app moved to the Trash on update" || bad "old app not in Trash"
[[ $(stock_sum) == "$before" ]] && ok "stock untouched after update" || bad "stock changed by update"

HOME=$H "$CLI" uninstall >"$scratch/remove.log" 2>&1 && ok "$BRAND_CLI uninstall runs" || bad "uninstall: $(tail -3 "$scratch/remove.log")"
[[ ! -e $app && ! -e $CLI ]] && ok "app and CLI gone" || bad "app or CLI left"
[[ -d $L ]] && ok "labs home kept without --purge" || bad "labs home removed"
[[ $(stock_sum) == "$before" ]] && ok "stock untouched after uninstall" || bad "stock changed by uninstall"

# --purge also moves the home to the Trash (the CLI and the home share a name: no collision).
run >"$scratch/reinstall.log" 2>&1 && ok "reinstall runs" || bad "reinstall: $(tail -3 "$scratch/reinstall.log")"
HOME=$H "$CLI" uninstall --purge >"$scratch/purge.log" 2>&1 && ok "uninstall --purge runs" || bad "purge: $(tail -3 "$scratch/purge.log")"
[[ ! -e $L && ! -e $app && ! -e $CLI ]] && ok "--purge removes the home too" || bad "left after --purge: $(ls -d "$L" "$app" "$CLI" 2>/dev/null)"
[[ $(ls "$H/.Trash" | grep -c "^$BRAND_CLI ") -ge 1 && $(ls "$H/.Trash" | grep -c "^$(basename "$BRAND_HOME") ") -ge 1 ]] && ok "CLI and home both in the Trash" || bad "Trash: $(ls "$H/.Trash")"
[[ $(stock_sum) == "$before" ]] && ok "stock untouched after --purge" || bad "stock changed by --purge"

# Refuses to write over stock (a copy of the installer, with the name files beside it as in an app).
cp scripts/brand.sh brand.json "$scratch/"
out=$(HOME=$H HERDR_APP_BIN=$HERDR_APP_BIN HERDR_HOST_APP=$host FORK_INSTALL_NO_REGISTER=1 bash -c 'sed "s|^cli=.*|cli=\"\$HOME/.local/bin/herdr-app\"|" scripts/install-fork-macos > "'"$scratch"'/evil" && bash "'"$scratch"'/evil"' 2>&1)
[[ $out == *"refusing"* ]] && ok "refuses to write over stock's CLI" || bad "no refusal: $out"
[[ $(stock_sum) == "$before" ]] && ok "stock untouched at the end" || bad "stock changed"

# ---- An install under the previous name moves over.
IFS=$'\t' read -r P_NAME P_ID P_CLI P_HOME P_SESSION <<< "$(printf '%s\n' "$BRAND_PREVIOUS" | head -n1)"
old_install() { # a fake install under the previous name on HOME $1
  local h=$1
  mkdir -p "$h/Applications/$P_NAME.app/Contents/MacOS" "$h/.local/bin" "$h/$P_HOME/layouts/.state"
  printf 'old app\n' > "$h/Applications/$P_NAME.app/Contents/MacOS/$P_NAME"
  printf '#!/bin/sh\nexit 0\n' > "$h/.local/bin/$P_CLI" && chmod +x "$h/.local/bin/$P_CLI"
  printf '{ "theme": "light" }\n' > "$h/$P_HOME/settings.json"
  printf '{ "layout": "labs" }\n' > "$h/$P_HOME/shared.json"
  printf '{ "personal": "labs" }\n' > "$h/$P_HOME/layouts/labs.json"
  printf 'clicks\n' > "$h/$P_HOME/layouts/.state/labs.json"
  printf 'sock\n' > "$h/$P_HOME/herdr-app.sock"
}
M=$scratch/migrate
mkdir -p "$M/Applications/Herdr.app/Contents/MacOS" "$M/.local/bin" "$M/.config/herdr-app"
cp "$H/Applications/Herdr.app/Contents/MacOS/Herdr" "$M/Applications/Herdr.app/Contents/MacOS/Herdr" 2>/dev/null || printf 'stock binary\n' > "$M/Applications/Herdr.app/Contents/MacOS/Herdr"
old_install "$M"
mrun() { HOME=$1 HERDR_APP_BIN=$HERDR_APP_BIN HERDR_HOST_APP=$host FORK_INSTALL_NO_REGISTER=1 PATH=${2:-$PATH} scripts/install-fork-macos; }
mrun "$M" >"$scratch/migrate.log" 2>&1 && ok "update from $P_NAME runs" || bad "migrate: $(tail -3 "$scratch/migrate.log")"
N=$M/$BRAND_HOME
[[ ! -e "$M/Applications/$P_NAME.app" && ! -e "$M/.local/bin/$P_CLI" ]] && ok "the $P_NAME app and CLI link left" || bad "old app or CLI still there"
ls "$M/.Trash" | grep -q "^$P_NAME.app " && ls "$M/.Trash" | grep -q "^$P_CLI " && ok "both are in the Trash, not deleted" || bad "Trash: $(ls "$M/.Trash")"
cmp -s "$N/layouts/labs.json" "$M/$P_HOME/layouts/labs.json" && cmp -s "$N/layouts/.state/labs.json" "$M/$P_HOME/layouts/.state/labs.json" && ok "the personal labs layout and its .state came along" || bad "layout or state not copied"
cmp -s "$N/settings.json" "$M/$P_HOME/settings.json" && [[ $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["layout"])' "$N/shared.json") == labs ]] && ok "settings came along, still on labs" || bad "settings or layout setting"
[[ -d $M/$P_HOME && ! -e $N/herdr-app.sock ]] && ok "old home kept as a backup; sockets left out" || bad "old home gone or socket copied"
[[ -x "$M/Applications/$BRAND_NAME.app/Contents/MacOS/$BRAND_NAME" && -x "$M/.local/bin/$BRAND_CLI" ]] && ok "$BRAND_NAME installed" || bad "new app or CLI missing"
grep -q "HC_SESSION='$BRAND_SESSION'" "$M/.local/bin/$BRAND_CLI" && ok "no live terminals: the new session $BRAND_SESSION" || bad "session: $(grep -o "HC_SESSION='[^']*'" "$M/.local/bin/$BRAND_CLI")"
printf '{ "personal": "changed in the new home" }\n' > "$N/layouts/labs.json"
old_install "$M" && mrun "$M" >"$scratch/migrate2.log" 2>&1 && grep -q "changed in the new home" "$N/layouts/labs.json" && ok "the copy is once: an existing new home is never written over" || bad "second migration overwrote the new home"

# Live terminals in the old session: kept, and said so.
V=$scratch/live
mkdir -p "$V/fakebin" "$V/Applications/Herdr.app/Contents/MacOS" && printf 'stock binary\n' > "$V/Applications/Herdr.app/Contents/MacOS/Herdr"
old_install "$V"
printf '#!/bin/sh\n[ "$HC_SESSION" = "%s" ] && echo %s || echo %s\n' "$P_SESSION" "'{\"terminals\": [{\"id\": \"t1\"}, {\"id\": \"t2\"}]}'" "'{\"terminals\": []}'" > "$V/fakebin/hc" && chmod +x "$V/fakebin/hc"
mrun "$V" "$V/fakebin:$PATH" >"$scratch/live.log" 2>&1 && ok "update with live terminals runs" || bad "live: $(tail -3 "$scratch/live.log")"
grep -q "HC_SESSION='$P_SESSION'" "$V/.local/bin/$BRAND_CLI" && grep -q "kept the core session $P_SESSION" "$scratch/live.log" && ok "live terminals: the old session $P_SESSION is kept, and the installer says so" || bad "live session: $(grep -o "HC_SESSION='[^']*'" "$V/.local/bin/$BRAND_CLI"); $(cat "$scratch/live.log")"
mrun "$V" "$V/fakebin:$PATH" >/dev/null 2>&1 && grep -q "HC_SESSION='$P_SESSION'" "$V/.local/bin/$BRAND_CLI" && ok "an update keeps the kept session" || bad "update lost the kept session"

# ---- Another brand.json: every name follows it.
B=$scratch/brand && mkdir -p "$B/Applications/Herdr.app/Contents/MacOS" && printf 'stock\n' > "$B/Applications/Herdr.app/Contents/MacOS/Herdr"
python3 - "$scratch/other-brand.json" <<'PY2'
import json, sys
json.dump({"name": "Zz Other", "slug": "zzother", "version": "9.9.9", "bundle_id": "dev.zzother.app", "cli": "zzother", "home": ".config/zzother", "session": "zzother", "previous": []}, open(sys.argv[1], "w"))
PY2
HOME=$B BRAND_FILE=$scratch/other-brand.json HERDR_APP_BIN=$HERDR_APP_BIN HERDR_HOST_APP=$host FORK_INSTALL_NO_REGISTER=1 scripts/install-fork-macos >"$scratch/other.log" 2>&1 && ok "install under another brand.json runs" || bad "other brand: $(tail -3 "$scratch/other.log")"
op="$B/Applications/Zz Other.app/Contents/Info.plist"
ov() { /usr/libexec/PlistBuddy -c "Print :$1" "$op" 2>/dev/null; }
[[ -x "$B/Applications/Zz Other.app/Contents/MacOS/Zz Other" && $(ov CFBundleIdentifier) == dev.zzother.app && $(ov CFBundleName) == "Zz Other" ]] && ok "app name, executable and bundle id follow brand.json" || bad "plist: $(ov CFBundleIdentifier) $(ov CFBundleName)"
[[ $(ov LSEnvironment:HERDR_APP_HOME) == "$B/.config/zzother" && $(ov LSEnvironment:HC_SESSION) == zzother ]] && ok "home and session follow brand.json" || bad "env: $(ov LSEnvironment:HERDR_APP_HOME) $(ov LSEnvironment:HC_SESSION)"
grep -q "HC_SESSION='zzother'" "$B/.local/bin/zzother" && grep -q "Zz Other.app" "$B/.local/bin/zzother" && ok "CLI wrapper follows brand.json" || bad "CLI wrapper"
cmp -s "$B/Applications/Zz Other.app/Contents/Resources/brand.json" "$scratch/other-brand.json" && HOME=$B "$B/.local/bin/zzother" uninstall >/dev/null 2>&1 && [[ ! -e "$B/Applications/Zz Other.app" ]] && ok "the installed app keeps its brand.json: uninstall finds its own names" || bad "uninstall under another brand"

chmod -R u+w "$scratch" && find "$scratch" -delete
echo "failures: $fails"
exit $((fails > 0))
