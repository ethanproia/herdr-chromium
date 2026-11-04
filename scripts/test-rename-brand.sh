#!/bin/bash
# The deep rename on a scratch copy (never this checkout): copy the tree, give it another
# brand, run scripts/rename-brand.sh --deep, then the scratch copy must still build and pass:
# cargo check (workspace, all targets, + the CEF host feature), the app tests,
# scripts/test-brand.sh and the installer's scratch-HOME test. Prints the match counts
# and what the allow-list protected. Run builds through the build slot.
#   scripts/test-rename-brand.sh [slug]     (default zzrename)
set -uo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
slug=${1:-zzrename}
scratch=$(mktemp -d "${TMPDIR:-/tmp}/rename-brand.XXXXXX")
fails=0
ok() { echo "ok   $*"; }
bad() { echo "FAIL $*"; fails=$((fails + 1)); }

rsync -a --exclude 'target*/' --exclude '.git' --exclude 'node_modules/' "$here/" "$scratch/src/"
cd "$scratch/src" || exit 1
python3 - "$slug" <<'PY'
import json, sys
s = sys.argv[1]
b = json.load(open("brand.json"))
b.update(name=s.capitalize(), slug=s, bundle_id=f"dev.{s}.app", cli=s, home=f".config/{s}", session=s, layout=s)
json.dump(b, open("brand.json", "w"), indent=2)
PY
git init -q . && git checkout -qb scratch/rename-brand && git add -A >/dev/null && git -c user.email=t@t -c user.name=t commit -qm scratch
echo "== deep rename to $slug"
scripts/rename-brand.sh --deep . | sed -n '/^files:/,/^renamed paths/p'
git add -A >/dev/null
left=$(scripts/rename-brand.sh --dry-run . | sed -n 's/^files: \([0-9]*\), matches: \([0-9]*\)$/\2/p')
[[ $left == 0 ]] && ok "nothing left to rename after --deep" || bad "$left matches left after --deep"
[[ -d crates/$slug-browser-host && -d defaults/mods/$slug-board ]] && ok "crates and bundled mods renamed" || bad "folders not renamed"

export CARGO_TARGET_DIR=$scratch/target PATH=$HOME/.cargo/bin:/opt/homebrew/bin:$PATH
up=$(printf '%s' "$slug" | tr 'a-z-' 'A-Z_')
cargo check --locked --workspace --all-targets >"$scratch/check.log" 2>&1 && ok "cargo check --workspace --all-targets" || { bad "cargo check"; grep -E '^error' -A5 "$scratch/check.log" | head -20; }
cargo check --locked --workspace --all-targets --features "$slug-browser-host/cef" >"$scratch/check-cef.log" 2>&1 && ok "cargo check with the CEF host feature" || { bad "cargo check (cef)"; grep -E '^error' -A5 "$scratch/check-cef.log" | head -20; }
tests=$(cargo test --locked --bin "$slug-app" -- --skip a_watched_folder 2>&1 | grep '^test result')
[[ $tests == *" 0 failed"* ]] && ok "app tests: $tests" || bad "app tests: $tests"
BRAND_ROOT=$scratch/src scripts/test-brand.sh >"$scratch/brand.log" 2>&1 && ok "test-brand.sh" || { bad "test-brand.sh"; cat "$scratch/brand.log"; }
cargo build -q --locked --bin "$slug-app" && env "${up}_APP_BIN=$CARGO_TARGET_DIR/debug/$slug-app" scripts/test-install-fork.sh >"$scratch/install.log" 2>&1 \
  && ok "installer scratch-HOME test ($(grep -c '^ok' "$scratch/install.log") checks)" || { bad "installer scratch test"; grep -E '^FAIL' "$scratch/install.log" | head; }

echo "failures: $fails  (scratch: $scratch)"
exit $((fails > 0))
