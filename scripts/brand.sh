# Sourced by the fork's scripts: the user-facing name from brand.json (docs/branding.md).
# BRAND_FILE picks another file (the rename test does). Sets BRAND_NAME, BRAND_SLUG,
# BRAND_VERSION (optional in the file: 0.0.0), BRAND_BUNDLE_ID, BRAND_CLI, BRAND_HOME
# (relative to $HOME), BRAND_SESSION, and BRAND_PREVIOUS: one line per earlier brand,
# tab-separated name, bundle_id, cli, home, session.
# A missing required key stops the script that sourced this, saying which key and file.
_brand_root=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)
: "${BRAND_FILE:=$_brand_root/brand.json}"
_brand_vars=$(python3 - "$BRAND_FILE" <<'PY'
import json, shlex, sys
path = sys.argv[1]
try:
    b = json.load(open(path))
except Exception as e:
    sys.exit(f"brand.json: cannot read {path}: {e}")
required = ("name", "slug", "bundle_id", "cli", "home", "session")
missing = [k for k in required if not isinstance(b.get(k), str) or not b[k]]
if missing:
    sys.exit(f"brand.json: {path} is missing required key(s): {', '.join(missing)}")
for k in required:
    print(f"BRAND_{k.upper()}={shlex.quote(b[k])}")
print(f"BRAND_VERSION={shlex.quote(b.get('version') or '0.0.0')}")
rows = []
for i, p in enumerate(b.get("previous", [])):
    gone = [k for k in ("name", "bundle_id", "cli", "home", "session") if not isinstance(p.get(k), str) or not p[k]]
    if gone:
        sys.exit(f"brand.json: {path} previous[{i}] is missing: {', '.join(gone)}")
    rows.append("\t".join(p[k] for k in ("name", "bundle_id", "cli", "home", "session")))
print(f"BRAND_PREVIOUS={shlex.quote(chr(10).join(rows))}")
PY
) || { echo "brand.json: stopping (see above)" >&2; exit 1; }
eval "$_brand_vars"
unset _brand_vars
