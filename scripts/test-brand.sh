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
want=$(python3 -c 'import json,sys; b=json.load(open(sys.argv[1])); print(b["name"], b["slug"], b["cli"], b["session"])' brand.json)
[[ "$BRAND_NAME $BRAND_SLUG $BRAND_CLI $BRAND_SESSION" == "$want" ]] && ok "scripts/brand.sh reads brand.json ($BRAND_NAME)" || bad "scripts/brand.sh: $BRAND_NAME $BRAND_SLUG $BRAND_CLI $BRAND_SESSION, want $want"
# The reader: version is optional (0.0.0); a missing required key stops with a clear message.
t=$(mktemp -d)
printf '{"name":"A","slug":"a","bundle_id":"d.a","cli":"a","home":".config/a","session":"a"}' > "$t/ok.json"
printf '{"name":"A","slug":"a","cli":"a","home":".config/a","session":"a"}' > "$t/bad.json"
[[ $(bash -c "BRAND_FILE='$t/ok.json' source '$root/scripts/brand.sh'; echo \$BRAND_VERSION") == 0.0.0 ]] && ok "version is optional (0.0.0)" || bad "version without a default"
out=$(bash -c "BRAND_FILE='$t/bad.json' source '$root/scripts/brand.sh'; echo went-on" 2>&1)
[[ $out == *"missing required key(s): bundle_id"* && $out != *went-on* ]] && ok "a missing required key stops, naming it" || bad "missing key: $out"
rm -rf "$t"
# The app's name strings come from src/brand.rs, never a literal of the current name.
lit=$(git grep -n -I -F "\"$BRAND_NAME\"" -- 'src/*.rs' 'src/**/*.rs' | grep -v '^src/brand.rs' || true)
[[ -z $lit ]] && ok "no literal \"$BRAND_NAME\" in src (it comes from brand.rs)" || bad "literal brand name in src: $lit"

# The install guide names the current brand (it is written out there; a rename updates it).
grep -q -F "$BRAND_NAME" docs/fork-install.md && ok "docs/fork-install.md names $BRAND_NAME" || bad "docs/fork-install.md doesn't name $BRAND_NAME"

# 2. Earlier brands' names only where they belong: brand.json lists them (migration);
# this test; docs/branding.md explains them; docs/fork-install.md tells a person moving over.
allow=(brand.json scripts/test-brand.sh docs/branding.md docs/fork-install.md)
pathspec=(-- . ':!vendor')
for a in "${allow[@]}"; do pathspec+=(":!$a"); done
while IFS=$'\t' read -r p_name p_id p_cli p_home p_session; do
  [[ -n $p_name ]] || continue
  for old in "$p_name" "$p_id" "$p_cli"; do
    hits=$(git grep -n -I -F -e "$old" "${pathspec[@]}" | cut -c1-160 || true)
    [[ -z $hits ]] && ok "no \"$old\" outside the allow-list" || bad "\"$old\" outside the allow-list:"$'\n'"$hits"
  done
done <<< "$BRAND_PREVIOUS"

echo "failures: $fails"
exit $((fails > 0))
