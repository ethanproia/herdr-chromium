#!/usr/bin/env bash
# Test-only `do mod.click`: unknown in a run without HERDR_APP_TEST_INPUT=1, and with it a
# click at pane-local x, y reaches a mod's on_click. Fresh headless homes; nothing else.
# Run with HERDR_APP_BIN set to the build.
#   scripts/test-mod-click.sh
set -uo pipefail
cd "$(dirname "$0")/.."
: "${HERDR_APP_BIN:?set HERDR_APP_BIN}"
fails=0
ok() { echo "ok   $*"; }
bad() { echo "FAIL $*"; fails=$((fails + 1)); }

# A home with one mod whose click renames its tab.
fresh() {
  local root=$HOME/.herdr-fork-home/$1
  if [[ -e $root ]]; then echo "fork home $root exists; pick another name or remove it" >&2; exit 2; fi
  mkdir -p "$root/home/mods/clicktest"
  printf '{"frame.welcomed":"skipped"}\n' > "$root/home/shared.json"
  printf '{ "last_run": "999.0.0" }\n' > "$root/home/update-notes.json"
  printf '{"place":"none"}\n' > "$root/home/mods/clicktest/mod.json"
  cat > "$root/home/mods/clicktest/main.js" <<'JS'
import { View, div } from "gpui-kit";
import { run } from "herdr";
export default class extends View {
  render() { return div().size_full().on_click(() => run("tab.rename", { name: "clicked" })); }
}
JS
}
start() { # name: up, a space, the mod as a tab; prints the mod's pane id
  scripts/fork-run.sh "$1" up >/dev/null || bad "start $1"
  scripts/fork-run.sh "$1" do space.new >/dev/null
  scripts/fork-run.sh "$1" do tab.new --mod clicktest >/dev/null
  sleep 3
  scripts/fork-run.sh "$1" status | python3 -c 'import json,sys; print(json.load(sys.stdin)["focused_pane"])'
}
tab_names() { scripts/fork-run.sh "$1" ls | grep -o '"name": "[^"]*"'; }

# 1. Without HERDR_APP_TEST_INPUT=1: unknown, and nothing is clicked.
n=mcn$$; fresh $n
pane=$(HERDR_APP_TEST_INPUT=0 start $n)
out=$(scripts/fork-run.sh $n do mod.click --copy "$pane" --x 20 --y 20)
[[ $out == *"unknown command"* ]] && ok "mod.click is unknown without test input" || bad "without test input: $out"
scripts/fork-run.sh $n commands | grep -q '"mod.click"' && bad "listed in commands" || ok "not listed in commands"
sleep 1
tab_names $n | grep -q clicked && bad "a click got through without test input" || ok "no click without test input"
scripts/fork-run.sh $n down >/dev/null

# 2. With it (fork-run's default for headless homes): the click reaches the mod.
n=mcy$$; fresh $n
pane=$(start $n)
out=$(scripts/fork-run.sh $n do mod.click --copy "$pane" --x 20 --y 20)
[[ $out == *'"ok": true'* ]] && ok "mod.click accepted with test input" || bad "with test input: $out"
sleep 2
tab_names $n | grep -q '"clicked"' && ok "the click reached the mod's on_click" || bad "no click: $(tab_names $n | tr '\n' ' ')"
out=$(scripts/fork-run.sh $n do mod.click --copy nosuchpane --x 1 --y 1)
[[ $out == *"no mod copy"* ]] && ok "an unknown copy is refused" || bad "unknown copy: $out"
scripts/fork-run.sh $n down >/dev/null

echo "failures: $fails"
exit $((fails > 0))
