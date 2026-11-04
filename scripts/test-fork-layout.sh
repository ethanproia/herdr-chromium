#!/usr/bin/env bash
# Headless check of the fork's own layout on fresh throwaway homes: it is the
# default, a home left on the old name "fork" opens it, and every bundled
# fork-* mod's main surface opens in the normal headless window (`up` starts it
# windowed, never fullscreen) with no
# errors. `herdr-app check` only loads a mod; this renders each one live.
# Run with HERDR_APP_BIN set to the build.
#   scripts/test-fork-layout.sh [shots dir]
set -uo pipefail
cd "$(dirname "$0")/.."
: "${HERDR_APP_BIN:?set HERDR_APP_BIN}"
shots=${1:-}
fails=0
ok() { echo "ok   $*"; }
bad() { echo "FAIL $*"; fails=$((fails + 1)); }
field() { python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin).get(sys.argv[1])))" "$1"; }

# A fresh home that has seen the welcome and this version's What's new (either would cover the window).
fresh() {
  local name=$1 shared=$2 root=$HOME/.herdr-fork-home/$1
  if [[ -e $root ]]; then echo "fork home $root exists; pick another name or remove it" >&2; exit 2; fi
  mkdir -p "$root/home"
  printf '%s\n' "$shared" > "$root/home/shared.json"
  printf '{ "last_run": "999.0.0" }\n' > "$root/home/update-notes.json"
}

# 1. Fresh home: labs is the default layout; each bundled mod renders with errors [].
n=tfl$$; fresh $n '{"frame.welcomed":"skipped"}'
R() { scripts/fork-run.sh $n "$@"; }
R up >/dev/null || bad "start $n"
sleep 4
[[ $(R status | field layout) == '"labs"' ]] && ok "labs is the default layout" || bad "default layout: $(R status | field layout)"
R do space.new >/dev/null
sleep 2
[[ $(R status | field overlays) == "[]" ]] && ok "nothing covers the window" || bad "overlays open: $(R status | field overlays)"
[[ -n $shots ]] && R shot "$shots/labs.png" >/dev/null
surfaces=(
  "fork-notepad|{}"
  "fork-notepad-view|{}"
  "fork-board|{}"
  "fork-spaces-browser|{}"
  "fork-agents-named|{}"
  "fork-core|{\"role\":\"plus\"}"
  "fork-core|{\"role\":\"new-panel\",\"direction\":\"right\"}"
  "fork-core|{\"role\":\"side-strip\"}"
  "fork-core|{\"role\":\"sidebar-header\"}"
  "fork-core|{\"role\":\"sidebar-footer\"}"
  "fork-core|{\"role\":\"status\"}"
)
for s in "${surfaces[@]}"; do
  mod=${s%%|*} props=${s#*|}
  [[ -d defaults/mods/$mod ]] || continue
  R do tab.new --name "$mod" --mod "$mod" --props "$props" >/dev/null
  sleep 3
  errs=$(R status | field errors)
  [[ $errs == "[]" ]] && ok "$mod $props renders" || bad "$mod $props: $errs"
  [[ -n $shots ]] && R shot "$shots/${mod}-$(echo "$props" | tr -dc 'a-z-').png" >/dev/null
done
R down >/dev/null

# 2. A home left on the old layout name "fork" opens labs.
n=tfo$$; fresh $n '{"frame.welcomed":"skipped","layout":"fork"}'
R up >/dev/null || bad "start $n"
sleep 4
[[ $(R status | field layout) == '"labs"' ]] && ok "old name fork opens labs" || bad "old name fork: $(R status | field layout)"
R do layout.switch --name main >/dev/null; sleep 1
R do layout.switch --name fork >/dev/null; sleep 2
[[ $(R status | field layout) == '"labs"' ]] && ok "layout.switch fork reaches labs" || bad "layout.switch fork: $(R status | field layout)"
R down >/dev/null

echo "failures: $fails"
exit $((fails > 0))
