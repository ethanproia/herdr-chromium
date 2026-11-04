#!/bin/bash
# The fork's name lives in brand.json only (docs/branding.md). Fails when:
#   1. scripts/brand.sh or the app's build-time constants disagree with brand.json;
#   2. an earlier brand's name (brand.json "previous") is written anywhere outside the
#      allow-list below.
# BRAND_ROOT checks another checkout (the deep-rename scratch test uses it).
set -uo pipefail
root=${BRAND_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
cd "$root" || exit 1
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

# 1. One source: the shell snippet reads the same values.
BRAND_FILE=$root/brand.json source "$root/scripts/brand.sh"
want=$(python3 -c 'import json,sys; b=json.load(open(sys.argv[1])); print(b["name"], b["slug"], b["layout"])' brand.json)
[[ "$BRAND_NAME $BRAND_SLUG $BRAND_LAYOUT" == "$want" ]] && ok "scripts/brand.sh reads brand.json ($BRAND_NAME)" || bad "scripts/brand.sh: $BRAND_NAME $BRAND_SLUG $BRAND_LAYOUT, want $want"
# The app's name strings come from src/brand.rs, never a literal of the current name.
lit=$(git grep -n -I -F "\"$BRAND_NAME\"" -- 'src/*.rs' 'src/**/*.rs' | grep -v '^src/brand.rs' || true)
[[ -z $lit ]] && ok "no literal \"$BRAND_NAME\" in src (it comes from brand.rs)" || bad "literal brand name in src: $lit"

# 2. Earlier brands' names only where they belong.
# brand.json lists them (migration); the installer, its scratch test and its doc are held
# until the name is released (fork-lead 2026-11-04), then move to brand.sh; this test;
# docs/branding.md explains them.
allow=(brand.json scripts/test-brand.sh docs/branding.md
       scripts/install-fork-macos scripts/test-install-fork.sh docs/fork-install.md)
pathspec=(-- . ':!vendor')
for a in "${allow[@]}"; do pathspec+=(":!$a"); done
while IFS=$'\t' read -r p_name p_id p_cli p_home p_session p_layout; do
  [[ -n $p_name ]] || continue
  for old in "$p_name" "$p_id" "$p_cli"; do
    hits=$(git grep -n -I -F -e "$old" "${pathspec[@]}" | cut -c1-160 || true)
    [[ -z $hits ]] && ok "no \"$old\" outside the allow-list" || bad "\"$old\" outside the allow-list:"$'\n'"$hits"
  done
done <<< "$BRAND_PREVIOUS"

echo "failures: $fails"
exit $((fails > 0))
