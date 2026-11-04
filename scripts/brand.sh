# Sourced by the fork's scripts: the user-facing name from brand.json (docs/branding.md).
# Also BRAND_VERSION.
# BRAND_FILE picks another file (the rename test does). Sets BRAND_NAME, BRAND_SLUG,
# BRAND_BUNDLE_ID, BRAND_CLI, BRAND_HOME (relative to $HOME), BRAND_SESSION,
# and BRAND_PREVIOUS: one line per earlier brand, tab-separated
# name, bundle_id, cli, home, session.
_brand_root=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)
: "${BRAND_FILE:=$_brand_root/brand.json}"
eval "$(python3 - "$BRAND_FILE" <<'PY'
import json, shlex, sys
b = json.load(open(sys.argv[1]))
for k in ("name", "slug", "version", "bundle_id", "cli", "home", "session"):
    print(f"BRAND_{k.upper()}={shlex.quote(b[k])}")
prev = "\n".join("\t".join(p[k] for k in ("name", "bundle_id", "cli", "home", "session")) for p in b.get("previous", []))
print(f"BRAND_PREVIOUS={shlex.quote(prev)}")
PY
)"
