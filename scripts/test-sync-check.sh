#!/usr/bin/env bash
# The bundled-mods check fails on anything build.rs would ship that the
# lockfile doesn't cover. Runs scripts/sync-bundled-mods.py --check on a
# temporary copy of scripts/ and defaults/, once clean and once per tampering.
# Needs LABS_GIT (a labs clone with the pinned commits).
#   scripts/test-sync-check.sh
set -uo pipefail
cd "$(dirname "$0")/.."
fails=0
ok() { echo "ok   $*"; }
bad() { echo "FAIL $*"; fails=$((fails + 1)); }

work=$(mktemp -d "${TMPDIR:-/tmp}/sync-check.XXXXXX")
fresh() {
  [[ -d $work/t ]] && chmod -R u+w "$work/t" && find "$work/t" -delete
  mkdir -p "$work/t" && cp -R scripts defaults "$work/t/"
}
check() { python3 "$work/t/scripts/sync-bundled-mods.py" --check 2>&1; }

fresh
out=$(check) && ok "clean tree is in sync" || bad "clean tree: $out"

fresh; echo x > "$work/t/defaults/mods/stray.txt"
out=$(check); [[ $? -ne 0 && $out == *"extra file stray.txt"* ]] && ok "extra file fails" || bad "extra file: $out"

fresh; mkdir "$work/t/defaults/mods/fork-extra" && echo '{}' > "$work/t/defaults/mods/fork-extra/mod.json"
out=$(check); [[ $? -ne 0 && $out == *"extra folder fork-extra"* ]] && ok "extra fork folder fails" || bad "extra fork folder: $out"

fresh; mkdir "$work/t/defaults/mods/sneaky" && echo '{}' > "$work/t/defaults/mods/sneaky/mod.json"
out=$(check); [[ $? -ne 0 && $out == *"extra folder sneaky"* ]] && ok "unrecorded folder fails" || bad "unrecorded folder: $out"

fresh; echo '// changed' >> "$work/t/defaults/mods/tabs/main.js"
out=$(check); [[ $? -ne 0 && $out == *"stock tabs changed"* ]] && ok "changed stock mod fails" || bad "changed stock: $out"

fresh; echo '// changed' >> "$work/t/defaults/mods/fork-core/main.js"
out=$(check); [[ $? -ne 0 && $out == *"fork-core"* ]] && ok "changed fork mod fails" || bad "changed fork mod: $out"

fresh; python3 - "$work/t/defaults/bundled-mods.lock.json" <<'EOF'
import json, sys
p = sys.argv[1]; lock = json.load(open(p))
lock["mods"]["core"]["exec"] = ["sh"]
json.dump(lock, open(p, "w"), indent=2)
EOF
out=$(check); [[ $? -ne 0 && $out == *"fork-core runs git"* ]] && ok "undeclared exec command fails" || bad "undeclared exec: $out"

find "$work" -delete
echo "failures: $fails"
exit $((fails > 0))
