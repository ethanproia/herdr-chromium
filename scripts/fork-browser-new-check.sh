#!/usr/bin/env bash
# Headless check of the person's browser (browser.new): a new tab, then one right of its pane, each
# page loaded on real CEF. Profile "default" and raw chords off: the window.rs unit test. No window,
# no focus, own home (fork-run.sh "browser-new").
#
#   HERDR_BROWSER_HOST=<bundle exe> HERDR_APP_BIN=<target>/debug/herdr-app scripts/fork-browser-new-check.sh
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
: "${HERDR_BROWSER_HOST:?set HERDR_BROWSER_HOST to the CEF host bundle executable}"
export HERDR_BROWSER_HOST
name=browser-new
run() { "$here/scripts/fork-run.sh" "$name" "$@"; }
fail() { echo "FAIL: $*" >&2; exit 1; }
port=8766
python3 -m http.server $port -d "$here/tests/fixtures/browser" >/dev/null 2>&1 &
srv=$!
trap 'kill $srv 2>/dev/null; run down >/dev/null 2>&1 || true' EXIT
base=http://127.0.0.1:$port
run down >/dev/null 2>&1 || true
rm -rf "$HOME/.herdr-fork-home/$name"
run up
run do space.new '{"name":"b"}' >/dev/null
id() { python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get(sys.argv[2]) or "")' "$1" "$2"; }
title() { run do browser.eval "{\"pane\":\"$1\",\"expr\":\"document.title\"}" 2>/dev/null || true; }

echo "== 1 browser.new (a new tab)"
r=$(run do browser.new "{\"url\":\"$base/scroll.html\"}"); echo "   $r"; [[ $r != *error* ]] || fail "$r"
pane=$(id "$r" id); tab=$(id "$r" tab); [[ -n $pane && -n $tab ]] || fail "no pane and tab in $r"
run ls | grep -q "\"$tab\"" || fail "tab $tab not listed"
for _ in $(seq 60); do t=$(title "$pane"); [[ $t == *scroll* ]] && break; sleep 0.25; done
echo "   title $t"; [[ $t == *scroll* ]] || fail "page did not load"

echo "== 2 browser.new right of that pane"
r=$(run do browser.new "{\"url\":\"$base/form.html\",\"place\":\"right\",\"pane\":\"$pane\"}"); echo "   $r"; [[ $r != *error* ]] || fail "$r"
second=$(id "$r" id); [[ -n $second && $second != "$pane" ]] || fail "no second pane in $r"
[[ $(id "$r" tab) == "" ]] || fail "a split must not make a tab: $r"
# Both pages answer at once: two blocks side by side in one tab.
t=$(title "$pane"); [[ $t == *scroll* ]] || fail "first page gone after the split: $t"
for _ in $(seq 60); do t=$(title "$second"); [[ $t == *form* ]] && break; sleep 0.25; done
echo "   title $t"; [[ $t == *form* ]] || fail "split page did not load"

echo "== 3 an agent's browser.remote still goes to the agent"
r=$(run do browser.remote '{}' || true); echo "   $r"; [[ $r == *error* ]] || fail "browser.remote reached the window"

run down >/dev/null
sleep 1
if pgrep -f "herdr-fork-home/$name" >/dev/null; then fail "a process of the fork is left"; fi
echo "browser.new check passed"
