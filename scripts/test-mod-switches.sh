#!/usr/bin/env bash
# Headless check of mod keys merging and the per-mod off switch (settings
# mods_disabled), on throwaway homes. Run with HERDR_APP_BIN set to the build.
#   scripts/test-mod-switches.sh
set -uo pipefail
cd "$(dirname "$0")/.."
bin=${HERDR_APP_BIN:?set HERDR_APP_BIN}
fails=0
ok() { echo "ok   $*"; }
bad() { echo "FAIL $*"; fails=$((fails + 1)); }
json() { python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(eval(sys.argv[2]))" "$@"; }

# 1. An existing home with its own keys.json gets the bundled mods' keys, keeps its own.
name=msk1; root=$HOME/.herdr-fork-home/$name; rm -rf "$root"; mkdir -p "$root/home"
printf '{\n  "global": { "cmd-t": "tab.new", "cmd-shift-y": "space.new" }\n}\n' > "$root/home/keys.json"
cp "$root/home/keys.json" /tmp/msk1-before.json
mkdir -p "$root/home/mods/demo"; printf 'export default class {}\n' > "$root/home/mods/demo/main.js"
printf '{ "global": { "cmd-shift-j": "mod.open:demo", "cmd-shift-y": "mod.open:demo" } }\n' > "$root/home/mods/demo/keys.json"
scripts/fork-run.sh $name up >/dev/null || bad "start $name"
k=$root/home/keys.json
[[ $(json "$k" 'd["global"].get("cmd-shift-j")') == "mod.open:demo" ]] && ok "mod key added" || bad "mod key added: $(cat "$k")"
[[ $(json "$k" 'd["global"].get("cmd-shift-y")') == "space.new" ]] && ok "person's own key kept" || bad "person's key kept"
[[ $(json "$k" 'd["global"].get("cmd-t")') == "tab.new" ]] && ok "other keys kept" || bad "other keys kept"
cmp -s "$root/home/keys.json.bak" /tmp/msk1-before.json && ok "keys.json.bak is the old file" || bad "backup"
[[ -f $root/home/keys-merged.json ]] && ok "keys-merged.json written" || bad "keys-merged.json"
scripts/fork-run.sh $name down >/dev/null

# 2. A broken keys.json is left alone.
name=msk2; root=$HOME/.herdr-fork-home/$name; rm -rf "$root"; mkdir -p "$root/home"
printf '{ not json' > "$root/home/keys.json"
scripts/fork-run.sh $name up >/dev/null || bad "start $name"
[[ $(cat "$root/home/keys.json") == "{ not json" ]] && ok "broken keys.json untouched" || bad "broken keys.json changed"
[[ ! -e $root/home/keys.json.bak ]] && ok "no backup for a broken file" || bad "backup for broken file"
scripts/fork-run.sh $name down >/dev/null

# 3. mods_disabled: off, then on again without a restart.
name=msk3; root=$HOME/.herdr-fork-home/$name; rm -rf "$root"; mkdir -p "$root/home"
echo '{"frame.welcomed":"skipped"}' > "$root/home/shared.json"
scripts/fork-run.sh $name up >/dev/null || bad "start $name"
R() { scripts/fork-run.sh $name "$@"; }
R do space.new >/dev/null
R do mod.open --name fork-board | grep -q '"ok"' && ok "fork-board opens when on" || bad "fork-board opens when on"
R do overlay.close >/dev/null
python3 - "$root/home/settings.json" <<'E'
import json, sys
p = sys.argv[1]; d = json.load(open(p)); d["mods_disabled"] = ["fork-board"]; json.dump(d, open(p, "w"), indent=2)
E
sleep 2
out=$(R do mod.open --name fork-board)
grep -q "turned off" <<<"$out" && ok "mod.open says turned off" || bad "mod.open when off: $out"
out=$(R do tab.new '{"mod":"fork-board"}')
grep -q "turned off" <<<"$out" && ok "tab.new says turned off" || bad "tab.new when off: $out"
R do layout.switch --name fork >/dev/null
R status | grep -q '"errors": \[\]' && ok "fork layout loads with board off" || bad "fork layout with board off"
R shot /tmp/msk3-off.png >/dev/null
python3 - "$root/home/settings.json" <<'E'
import json, sys
p = sys.argv[1]; d = json.load(open(p)); d.pop("mods_disabled"); json.dump(d, open(p, "w"), indent=2)
E
sleep 2
R do mod.open --name fork-board | grep -q '"ok"' && ok "back on without restart" || bad "back on without restart"
scripts/fork-window-probe "$(cat "$root/pid")"
R down >/dev/null

rm -rf "$HOME"/.herdr-fork-home/msk[123] /tmp/hf-msk[123]
echo "failures: $fails"
exit $((fails > 0))
