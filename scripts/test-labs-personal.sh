#!/usr/bin/env bash
# The fork's labs layout is personal: seeded once from the bundled copy (never over an existing file),
# structural layout.set on it is kept across a restart, layout.reset labs puts the bundled copy back,
# and an install from when labs was shipped keeps its file and clicks. Shipped main still refuses
# structure. Fresh headless homes. Run with HERDR_APP_BIN set to the build.
#   scripts/test-labs-personal.sh
set -uo pipefail
cd "$(dirname "$0")/.."
: "${HERDR_APP_BIN:?set HERDR_APP_BIN}"
fails=0
ok() { echo "ok   $*"; }
bad() { echo "FAIL $*"; fails=$((fails + 1)); }

fresh() {
  local root=$HOME/.herdr-fork-home/$1
  if [[ -e $root ]]; then echo "fork home $root exists" >&2; exit 2; fi
  mkdir -p "$root/home"
  printf '{"frame.welcomed":"skipped"}\n' > "$root/home/shared.json"
  printf '{ "last_run": "999.0.0" }\n' > "$root/home/update-notes.json"
}
status() { scripts/fork-run.sh "$1" status | python3 -c "import json,sys; print(json.load(sys.stdin)[sys.argv[1]])" "$2"; }
# Layout $3 with node $4's "min" set to $2: a structural change (not a click) that core doesn't manage itself.
set_max() {
  local tree
  tree=$(python3 - "$HOME/.herdr-fork-home/$1/home/layouts/$3.json" "$2" "${4:-status}" <<'PY'
import json, sys
t = json.load(open(sys.argv[1]))
def walk(n):
    if isinstance(n, dict):
        if n.get("id") == sys.argv[3]:
            n["min"] = int(sys.argv[2])
        for v in n.values():
            walk(v)
    elif isinstance(n, list):
        for v in n:
            walk(v)
walk(t)
print(json.dumps(t))
PY
)
  scripts/fork-run.sh "$1" do layout.set --layout "$tree"
}
sidebar_max() { python3 -c "
import json,sys
def find(n):
    if isinstance(n, dict):
        if n.get('id') == sys.argv[2]: return n.get('min')
        for v in n.values():
            r = find(v)
            if r is not None: return r
    elif isinstance(n, list):
        for v in n:
            r = find(v)
            if r is not None: return r
print(find(json.load(open(sys.argv[1]))))" "$1" "${2:-status}"; }

# 1. Fresh home: seeded from the bundled copy, shown by default.
n=lp1$$; fresh $n; H=$HOME/.herdr-fork-home/$n/home
scripts/fork-run.sh $n up >/dev/null || bad "start"
sleep 3
cmp -s "$H/layouts/labs.json" defaults/layouts/labs.json && ok "labs.json seeded from the bundled copy" || bad "seed differs or missing"
[[ $(status $n layout) == labs ]] && ok "labs is shown" || bad "shown: $(status $n layout)"
python3 -c 'import json,sys; sys.exit(0 if "layout:labs" not in json.load(open(sys.argv[1])) else 1)' "$H/installed.json" && ok "labs is not recorded as shipped" || bad "installed.json still records labs"

# 2. Structural layout.set on labs is written and survives a restart.
out=$(set_max $n 421 labs)
[[ $out != *error* ]] && ok "structural layout.set on labs accepted" || bad "layout.set refused: $out"
sleep 2
[[ $(sidebar_max "$H/layouts/labs.json") == 421 ]] && ok "the change is in labs.json" || bad "labs.json max: $(sidebar_max "$H/layouts/labs.json")"
scripts/fork-run.sh $n down >/dev/null
scripts/fork-run.sh $n up >/dev/null; sleep 3
[[ $(sidebar_max "$H/layouts/labs.json") == 421 && $(status $n layout) == labs ]] && ok "kept across a restart (not reseeded)" || bad "after restart: $(sidebar_max "$H/layouts/labs.json")"

# 3. Shipped main still refuses structure, and its file is unchanged.
scripts/fork-run.sh $n do layout.switch --name main >/dev/null; sleep 2
before=$(shasum "$H/layouts/main.json")
out=$(set_max $n 333 main sidebar)
sleep 2
[[ $out == *error* ]] && ok "structural layout.set on shipped main refused" || bad "main accepted structure: $out"
[[ $(shasum "$H/layouts/main.json") == "$before" ]] && ok "main.json unchanged" || bad "main.json changed"

# 4. layout.reset labs puts the bundled copy back.
scripts/fork-run.sh $n do layout.switch --name labs >/dev/null; sleep 2
scripts/fork-run.sh $n do layout.reset --name labs >/dev/null; sleep 2
cmp -s "$H/layouts/labs.json" defaults/layouts/labs.json && ok "layout.reset labs restores the bundled copy" || bad "reset: max $(sidebar_max "$H/layouts/labs.json")"
ls "$H/layouts" | grep -q '^labs.*old' && ok "the reset kept the old file aside" || bad "no aside copy: $(ls "$H/layouts")"
scripts/fork-run.sh $n down >/dev/null

# 5. An existing labs.json is never written over by the seed.
n=lp2$$; fresh $n; H=$HOME/.herdr-fork-home/$n/home
mkdir -p "$H/layouts"
python3 - defaults/layouts/labs.json "$H/layouts/labs.json" <<'PY'
import json, sys
t = json.load(open(sys.argv[1]))
def walk(n):
    if isinstance(n, dict):
        if n.get("id") == "status":
            n["min"] = 17
        for v in n.values(): walk(v)
    elif isinstance(n, list):
        for v in n: walk(v)
walk(t); json.dump(t, open(sys.argv[2], "w"), indent=2)
PY
scripts/fork-run.sh $n up >/dev/null; sleep 3
[[ $(sidebar_max "$H/layouts/labs.json") == 17 ]] && ok "an existing labs.json is not overwritten" || bad "the seed wrote over it (status min: $(sidebar_max "$H/layouts/labs.json"))"
scripts/fork-run.sh $n down >/dev/null

# 6. An install from when labs was shipped (made by a build that shipped it: HERDR_APP_BIN_OLD), with clicks:
#    its file and clicks stay as the person's; the shipped record goes. Skipped without an old build.
if [[ -n ${HERDR_APP_BIN_OLD:-} ]]; then
  n=lp3$$; fresh $n; H=$HOME/.herdr-fork-home/$n/home
  HERDR_APP_BIN=$HERDR_APP_BIN_OLD scripts/fork-run.sh $n up >/dev/null; sleep 3
  HERDR_APP_BIN=$HERDR_APP_BIN_OLD scripts/fork-run.sh $n down >/dev/null
  python3 -c 'import json,sys; sys.exit(0 if "layout:labs" in json.load(open(sys.argv[1])) else 1)' "$H/installed.json" && ok "the old build recorded labs as shipped" || bad "old build did not record labs"
  mkdir -p "$H/layouts/.state"
  printf '{"hidden":{"status":false}}\n' > "$H/layouts/.state/labs.json"
  scripts/fork-run.sh $n up >/dev/null; sleep 3
  [[ -f $H/layouts/labs.json ]] && cmp -s "$H/layouts/labs.json" defaults/layouts/labs.json && ok "the old install keeps labs.json" || bad "labs.json removed or changed"
  [[ -f $H/layouts/.state/labs.json ]] && grep -q '"status"' "$H/layouts/.state/labs.json" && ok "its clicks (.state) are kept" || bad ".state: $(cat "$H/layouts/.state/labs.json" 2>/dev/null)"
  python3 -c 'import json,sys; sys.exit(0 if "layout:labs" not in json.load(open(sys.argv[1])) else 1)' "$H/installed.json" && ok "the shipped record is dropped" || bad "installed.json still records labs"
  scripts/fork-run.sh $n down >/dev/null
else
  echo "skip migration check: set HERDR_APP_BIN_OLD to a build that ships labs"
fi

echo "failures: $fails"
exit $((fails > 0))
