#!/usr/bin/env bash
# Runs this checkout's herdr-app on its own home, core and state, so it can
# never attach to or disturb the Herdr you are using. See docs/fork-dev.md.
#
#   scripts/fork-run.sh <name> status|do|shot|ls ...   talk to the fork's window
#   scripts/fork-run.sh <name> hc <args>               hc against the fork's core
#   scripts/fork-run.sh <name> up                      start the window hidden (HERDR_APP_HEADLESS=1)
#   scripts/fork-run.sh <name> render --layout f.json --out f.png   render a layout offscreen
#   FORK_RUN_WINDOW=1 scripts/fork-run.sh <name> window   open the window (visible, see below)
#   scripts/fork-run.sh <name> down                    stop the fork's window and core
#
# Home: ~/.herdr-fork-home/<name>/home (FORK_RUN_HOME picks another; the real
# ~/.config/herdr-app is refused). `up` never shows a window or takes
# focus; `window` shows and activates it, so it is opt-in.
set -euo pipefail

here=$(cd "$(dirname "$0")/.." && pwd)
name=${1:?usage: fork-run.sh <name> <command> ...}
shift
case $name in */*|.*|"") echo "fork-run: bad name $name" >&2; exit 2 ;; esac
root=$HOME/.herdr-fork-home/$name
home=${FORK_RUN_HOME:-$root/home}
real=${XDG_CONFIG_HOME:-$HOME/.config}/herdr-app
canon() { python3 -c 'import os,sys; print(os.path.realpath(os.path.expanduser(sys.argv[1])))' "$1"; }
if [[ $(canon "$home") == "$(canon "$real")" || $(canon "$home") == "$(canon "$HOME/.config/herdr-app")" ]]; then
  echo "fork-run: refusing to use the real home $real" >&2
  exit 1
fi
bin=${HERDR_APP_BIN:-${CARGO_TARGET_DIR:-${HERDR_FORK_DIR:-$HOME/work.noindex/herdr-fork}/target}/debug/herdr-app}
# A build without the headless switch would show a window: refuse it.
has_headless() { [[ -x $bin ]] && grep -aq HERDR_APP_HEADLESS "$bin"; }

export HERDR_APP_HOME=$home
export HC_SESSION=herdr-fork-$name
# Short: the core socket lives under it and macOS caps socket paths at 103 bytes.
export XDG_STATE_HOME=/tmp/hf-$name
export HERDR_APP_ID=herdr-app-fork-$name
export HERDR_APP_NO_SOUND=1
mkdir -p "$home" "$root/bin"
# The name is predictable, so the state dir must be ours and private: never follow one
# someone else made (a symlink or a dir they own) into their hands.
mkdir -m 700 "$XDG_STATE_HOME" 2>/dev/null || true
if [[ -L $XDG_STATE_HOME || ! -O $XDG_STATE_HOME ]]; then
  echo "fork-run: $XDG_STATE_HOME is not a directory you own; refusing" >&2
  exit 1
fi
chmod 700 "$XDG_STATE_HOME"
# Opening a link would reach the real browser: log it instead.
printf '#!/bin/sh\nprintf "%%s\\n" "$*" >>%q\n' "$root/opened" >"$root/bin/open"
chmod +x "$root/bin/open"
export PATH=$root/bin:$PATH

cmd=${1:-status}
case $cmd in
  up)
    [[ -x $bin ]] || (cd "$here" && CARGO_TARGET_DIR=${bin%/debug/herdr-app} cargo build --locked)
    if ! has_headless; then
      echo "fork-run: $bin has no HERDR_APP_HEADLESS switch (old build?); refusing to start it" >&2
      exit 1
    fi
    HERDR_APP_HEADLESS=1 nohup "$bin" >"$root/app.log" 2>&1 </dev/null &
    echo $! >"$root/pid"
    for _ in $(seq 100); do "$bin" status >/dev/null 2>&1 && break; sleep 0.2; done
    "$bin" status >/dev/null 2>&1 || { echo "fork-run: window did not answer; see $root/app.log" >&2; exit 1; }
    echo "fork $name up headless, pid $(cat "$root/pid")"
    ;;
  window)
    if [[ ${FORK_RUN_WINDOW:-} != 1 ]]; then
      echo "fork-run: the window appears on screen and takes focus (no headless mode on macOS)." >&2
      echo "fork-run: set FORK_RUN_WINDOW=1 to open it anyway." >&2
      exit 1
    fi
    [[ -x $bin ]] || (cd "$here" && CARGO_TARGET_DIR=${bin%/debug/herdr-app} cargo build --locked)
    nohup "$bin" >"$root/app.log" 2>&1 </dev/null &
    echo $! >"$root/pid"
    echo "fork window pid $(cat "$root/pid"), log $root/app.log"
    ;;
  down)
    # Every herdr-app on this home, not only the one in the pid file: a second `up`
    # overwrites the file, and a stranded app keeps its core alive.
    pids=$(ps -E -ax -o pid=,command= | awk -v want="HERDR_APP_HOME=$home" '
      { app = 0; mine = 0
        for (i = 2; i <= NF; i++) {
          if (i == 2 && $i ~ /\/herdr-app$/) app = 1
          if ($i == want) mine = 1
        }
        if (app && mine) print $1 }')
    for pid in $pids; do kill "$pid" 2>/dev/null || true; done
    # Wait for the apps to exit (up to 20 s). `|| true`: under set -e a failed kill -0 here
    # used to end the script before the cleanup below ran.
    for _ in $(seq 200); do
      left=$(for pid in $pids; do kill -0 "$pid" 2>/dev/null && echo "$pid"; done || true)
      [[ -z $left ]] && break
      sleep 0.1
    done
    rm -f "$root/pid"
    # This home's core and its terminal holders, without hc (an hc call starts a core when none
    # runs). Holders outlive their core by design, and a quitting app parks its terminals just
    # after it exits, which starts a core: end whatever has files open in this home's private
    # state dir until it has been quiet for 3 s (at most 20 s), then remove that state.
    mine() { lsof -c herdr-cor -Fpn 2>/dev/null | awk -v s="/herdr-core/$HC_SESSION/" '/^p/ { p = substr($0, 2) } /^n/ && index($0, s) { print p }' | sort -u; }
    quiet=0
    for _ in $(seq 20); do
      left=$(mine)
      if [[ -z $left ]]; then
        quiet=$((quiet + 1))
        [[ $quiet -ge 3 ]] && break
      else
        quiet=0
        kill $left 2>/dev/null || true
      fi
      sleep 1
    done
    case $XDG_STATE_HOME in /tmp/hf-*) rm -rf "${XDG_STATE_HOME:?}/herdr-core/${HC_SESSION:?}" ;; esac
    echo "fork $name stopped"
    ;;
  hc) shift; exec hc "$@" ;;
  status|do|shot|ls|commands|render) exec "$bin" "$@" ;;
  *) echo "fork-run: unknown command $cmd" >&2; exit 2 ;;
esac
