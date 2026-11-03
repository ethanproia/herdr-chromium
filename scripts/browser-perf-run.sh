#!/bin/sh
# Section R rerun: release build, 5 runs per number, build and run inside the Chromium slot; logs
# load before and after (a quiet machine is part of the result).
# Usage: scripts/browser-perf-run.sh [R1,R4,...]   Env: HERDR_PERF_SIZE=WxH (DIPs, default
# 1024x768; 3008x1692 is a 6016x3384 px frame), HERDR_PERF_RUNS (5), CARGO_TARGET_DIR.
set -eu
: "${HERDR_FORK_DIR:=$HOME/work.noindex/herdr-fork}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$HERDR_FORK_DIR/target-frames-perf}"
export PATH="$HOME/.cargo/bin:$PATH" HERDR_PERF_RUNS="${HERDR_PERF_RUNS:-5}" HERDR_FORK_DIR
[ -n "${1:-}" ] && export HERDR_PERF_ONLY="$1"
cd "$(dirname "$0")/.."
FORK_WORKER=${FORK_WORKER:-frames-perf} exec "$HERDR_FORK_DIR/bin/chromium-slot" sh -c '
  export HERDR_BROWSER_CEF_HOST="$(scripts/fork-host-bundle.sh release)"
  cargo test --release --locked --test browser_perf --no-run >&2
  uptime; cargo test --release --locked --test browser_perf; uptime'
