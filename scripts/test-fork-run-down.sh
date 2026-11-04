#!/usr/bin/env bash
# `fork-run.sh <name> down` leaves nothing of that home running, even after a second
# `up` overwrote the pid file: no herdr-app on the home, no herdr-core for its session.
# Run with HERDR_APP_BIN set to the build.
#   scripts/test-fork-run-down.sh
set -uo pipefail
cd "$(dirname "$0")/.."
: "${HERDR_APP_BIN:?set HERDR_APP_BIN}"
fails=0
ok() { echo "ok   $*"; }
bad() { echo "FAIL $*"; fails=$((fails + 1)); }

n=frd$$
home=$HOME/.herdr-fork-home/$n/home
apps() { ps -E -ax -o pid=,command= | awk -v want="HERDR_APP_HOME=$home" '{ for (i = 3; i <= NF; i++) if ($i == want && $2 ~ /\/herdr-app$/) { print $1; break } }'; }
cores() { ps -ax -o pid=,command= | grep -F "herdr-fork-$n" | grep -v grep | awk '{print $1}'; }

scripts/fork-run.sh $n up >/dev/null || bad "first up"
first=$(apps | head -1)
[[ -n $first ]] && ok "first up runs an app" || bad "no app after first up"
scripts/fork-run.sh $n up >/dev/null 2>&1
# A terminal: its holder outlives a plain core stop.
scripts/fork-run.sh $n do space.new >/dev/null
sleep 2
[[ -n $(cores) ]] && ok "a core and terminal run for the session" || bad "no core for the session"
[[ -n $(apps) ]] && ok "an app runs after the second up" || bad "no app after second up"
[[ $(cat "$HOME/.herdr-fork-home/$n/pid" 2>/dev/null) != "$first" || $(apps | wc -l) -gt 1 ]] \
  && ok "the pid file no longer names every app (the stranding case)" \
  || echo "note: the second up reused the first app; down is still checked"
scripts/fork-run.sh $n down >/dev/null
sleep 3
[[ -z $(apps) ]] && ok "no herdr-app left on the home" || bad "apps left: $(apps | tr '\n' ' ')"
[[ -z $(cores) ]] && ok "no herdr-core left for the session" || bad "cores left: $(cores | tr '\n' ' ')"

echo "failures: $fails"
exit $((fails > 0))
