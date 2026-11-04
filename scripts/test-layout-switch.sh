#!/usr/bin/env bash
# Switching to a personal layout built on core must not rewrite its file with the layout
# shown before. (New mod copies used to read the previous layout() at start, and core's
# start-time layout.set saved that stale tree under the new name.) Fresh headless home.
# Run with HERDR_APP_BIN set to the build.
#   scripts/test-layout-switch.sh
set -uo pipefail
cd "$(dirname "$0")/.."
: "${HERDR_APP_BIN:?set HERDR_APP_BIN}"
fails=0
ok() { echo "ok   $*"; }
bad() { echo "FAIL $*"; fails=$((fails + 1)); }

n=lsw$$
root=$HOME/.herdr-fork-home/$n
if [[ -e $root ]]; then echo "fork home $root exists" >&2; exit 2; fi
H=$root/home
mkdir -p "$H"
printf '{"frame.welcomed":"skipped"}\n' > "$H/shared.json"
printf '{ "last_run": "999.0.0" }\n' > "$H/update-notes.json"
R() { scripts/fork-run.sh $n "$@"; }
sum() { shasum -a 256 "$1" | cut -c1-16; }

R up >/dev/null || bad "start"
sleep 3
# A personal stock layout (a clone of main), shown first; then a personal layout built on core.
cp "$H/layouts/main.json" "$H/layouts/plain.json"
R do layout.switch --name plain >/dev/null
R do space.new >/dev/null
sleep 2
cp "$H/layouts/labs.json" "$H/layouts/corelay.json"
before=$(sum "$H/layouts/corelay.json")

R do layout.switch --name corelay >/dev/null
sleep 6
[[ $(R status | python3 -c 'import json,sys; print(json.load(sys.stdin)["layout"])') == corelay ]] && ok "switched to the core layout" || bad "not switched"
grep -q '"mod": "fork-core"' "$H/layouts/corelay.json" && ok "the file still names core" || bad "the file lost core: $(grep -o '"mod": "[^"]*"' "$H/layouts/corelay.json" | sort -u | tr '\n' ' ')"
grep -q '"mod": "workspace-chrome"' "$H/layouts/corelay.json" && bad "the file took the previous (stock) layout" || ok "the previous layout was not written into it"

# Back and forth again, and a reload of the file while it is shown.
R do layout.switch --name plain >/dev/null; sleep 2
R do layout.switch --name corelay >/dev/null; sleep 6
grep -q '"mod": "workspace-chrome"' "$H/layouts/corelay.json" && bad "a second switch wrote the previous layout" || ok "a second switch keeps it"
cp "$H/layouts/labs.json" "$H/layouts/corelay.json.new" && mv "$H/layouts/corelay.json.new" "$H/layouts/corelay.json"
sleep 6
grep -q '"mod": "workspace-chrome"' "$H/layouts/corelay.json" && bad "a file reload wrote the previous layout" || ok "a file reload keeps it"
grep -q '"mod": "workspace-chrome"' "$H/layouts/plain.json" && ok "the stock layout keeps its own tree" || bad "plain.json changed: $(grep -o '"mod": "[^"]*"' "$H/layouts/plain.json" | sort -u | tr '\n' ' ')"
[[ $(R status | python3 -c 'import json,sys; print(json.load(sys.stdin)["errors"])') == "[]" ]] && ok "no errors" || bad "errors: $(R status)"
echo "(corelay.json: $before before, $(sum "$H/layouts/corelay.json") after; core may tune its own fields)"

R down >/dev/null
echo "failures: $fails"
exit $((fails > 0))
