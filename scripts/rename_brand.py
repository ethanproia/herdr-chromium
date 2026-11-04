"""The deep rename (scripts/rename-brand.sh --deep): rewrite the fork's internal herdr names to
brand.json's slug, for a throwaway release branch. docs/branding.md explains when to use it.

Rewritten (whole tokens): the crates and binaries (herdr-app, herdr-browser-host,
herdr-browser-protocol, herdr-browser-surface, and their herdr_* Rust names), the HERDR_
environment prefix, and the bundled mods' fork-<name> prefix (folders, references and the
sync script's PREFIX). Files and folders whose names carry a token are renamed too.

Never touched (the allow-list), each reported with its match count:
  vendor/, .git/, target*/ and node_modules/: third-party and build output;
  licence, notice and third-party files (LICENSE*, NOTICE*, COPYING*, THIRD_PARTY*, licenses/);
  lines with a URL (upstream links stay true);
  the stock `herdr-app` CLI and `hc` as user mods and their guide call them (defaults/**),
  and stock Herdr's own paths (.config/herdr-app, .local/bin/herdr-app);
  mod API names (the `herdr.` JS API is not a token here).
"""
import json, os, re, sys

root = os.path.abspath(sys.argv[1])
apply = "--deep" in sys.argv
brand = json.load(open(os.path.join(root, "brand.json")))
slug = brand["slug"]
snake, upper = slug.replace("-", "_"), slug.replace("-", "_").upper()
if not re.fullmatch(r"[a-z][a-z0-9-]*", slug) or slug in ("herdr", "fork"):
    sys.exit(f"rename-brand: slug {slug!r} must be lowercase letters, digits and -, and not herdr or fork")

mods = sorted(d[len("fork-"):] for d in os.listdir(os.path.join(root, "defaults", "mods")) if d.startswith("fork-"))
rules = [  # (name, pattern, replacement), longest first so herdr-app doesn't eat herdr-app-x
    ("herdr-browser-host", r"(?<![\w-])herdr-browser-host(?![\w])", f"{slug}-browser-host"),
    ("herdr-browser-protocol", r"(?<![\w-])herdr-browser-protocol(?![\w])", f"{slug}-browser-protocol"),
    ("herdr-browser-surface", r"(?<![\w-])herdr-browser-surface(?![\w])", f"{slug}-browser-surface"),
    ("herdr_browser_*", r"(?<![\w])herdr_browser_(host|protocol|surface)(?![\w])", rf"{snake}_browser_\1"),
    # Not stock Herdr's own paths (its home .config/herdr-app and CLI link .local/bin/herdr-app).
    ("herdr-app", r"(?<![\w-])(?<!\.config/)(?<!bin/)herdr-app(?![\w-])", f"{slug}-app"),
    ("herdr_app", r"(?<![\w])herdr_app(?![\w])", f"{snake}_app"),
    ("HERDR_", r"(?<![\w])HERDR_(?=[A-Z])", f"{upper}_"),
] + [(f"fork-{m}", rf"(?<![\w-])fork-{re.escape(m)}(?![\w-])", f"{slug}-{m}") for m in mods] + [
    ("PREFIX", r'^PREFIX = "fork-"$', f'PREFIX = "{slug}-"'),
]
compiled = [(n, re.compile(p, re.M), r) for n, p, r in rules]

SKIP_DIRS = {".git", "vendor", "node_modules", "licenses"}
SKIP_FILE = re.compile(r"^(LICENSE|NOTICE|COPYING|THIRD[_-]PARTY)", re.I)
URL = re.compile(r"://")
# The stock CLI user mods call (and its guide) keeps its name under defaults/.
CLI_KEEP = {"herdr-app"}
STOCK_PATH = re.compile(r"(?:\.config/|bin/)herdr-app(?![\w-])")

changed, counts, protected = [], {}, {}
def bump(d, k, n=1):
    d[k] = d.get(k, 0) + n

def skip_dir(name):
    return name in SKIP_DIRS or name.startswith("target")

renames = []
for dirpath, dirs, files in os.walk(root, topdown=True):
    rel_dir = os.path.relpath(dirpath, root)
    kept = [d for d in dirs if skip_dir(d)]
    for d in kept:
        bump(protected, f"{os.path.join(rel_dir, d)}/ (third-party or build output)")
    dirs[:] = [d for d in dirs if not skip_dir(d)]
    for f in files:
        rel = os.path.normpath(os.path.join(rel_dir, f))
        if f == ".git":  # a worktree's pointer to its repository
            continue
        if SKIP_FILE.match(f):
            bump(protected, "licence/notice files")
            continue
        path = os.path.join(root, rel)
        try:
            text = open(path, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        out_lines, n_file = [], 0
        for line in text.splitlines(keepends=True):
            if URL.search(line):
                hits = sum(len(c.findall(line)) for _, c, _ in compiled)
                if hits:
                    bump(protected, "lines with a URL", hits)
                out_lines.append(line)
                continue
            k_stock = len(STOCK_PATH.findall(line))
            if k_stock:
                bump(protected, "stock Herdr's own paths (.config/herdr-app, .local/bin/herdr-app)", k_stock)
            for name, c, r in compiled:
                if name in CLI_KEEP and rel.startswith("defaults" + os.sep):
                    k = len(c.findall(line))
                    if k:
                        bump(protected, "stock herdr-app CLI in defaults/ (mods and their guide)", k)
                    continue
                line, k = c.subn(r, line)
                if k:
                    n_file += k
                    bump(counts, name, k)
            out_lines.append(line)
        if n_file:
            changed.append((rel, n_file))
            if apply:
                open(path, "w", encoding="utf-8").write("".join(out_lines))
    # Names of files and folders here that carry a token.
    for name in dirs + files:
        new = name
        for _, c, r in compiled:
            new = c.sub(r, new)
        if new != name:
            renames.append((os.path.join(dirpath, name), os.path.join(dirpath, new)))

print(f"rename-brand: herdr -> {slug} ({'applied' if apply else 'dry run'})")
for rel, n in sorted(changed):
    print(f"  {n:5d}  {rel}")
print(f"files: {len(changed)}, matches: {sum(counts.values())}")
for k, v in sorted(counts.items(), key=lambda kv: -kv[1]):
    print(f"  {v:6d}  {k}")
print("protected by the allow-list:")
for k, v in sorted(protected.items(), key=lambda kv: -kv[1]):
    print(f"  {v:6d}  {k}")
print(f"renamed paths: {len(renames)}")
for a, b in renames:
    print(f"  {os.path.relpath(a, root)} -> {os.path.relpath(b, root)}")
if apply:
    # Deepest first, so a folder's children move before it does.
    for a, b in sorted(renames, key=lambda ab: -ab[0].count(os.sep)):
        os.rename(a, b)
