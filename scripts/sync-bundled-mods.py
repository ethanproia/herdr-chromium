#!/usr/bin/env python3
"""Copies the fork's bundled mods from a pinned essexlabs/labs commit into
defaults/mods/fork-<name>/ (build.rs embeds them; the app installs them on
start). Labs projects/herdr-mods stays the source of record: edit there,
re-pin here, run this, commit the result.

  scripts/sync-bundled-mods.py            copy every pinned mod (lockfile)
  scripts/sync-bundled-mods.py --check    exit 1 if defaults/mods differs from the lockfile's copy

The lockfile (defaults/bundled-mods.lock.json) names, per mod: the labs
branch and commit, the folder in labs, "ship": false to hold one back,
"keys" for a keys.json written into the mod, and "rename": "paths" to rename
only folder references (mods/<n>/, mod:<n>), never plain strings such as tool ids;
"layout" pins the labs layout that becomes defaults/layouts/fork.json.
LABS_GIT (default ~/work.noindex/herdr-board/labs-wt) is any labs clone that
has the commits; nothing is fetched here.

Shipped names get a "fork-" prefix so a home's own mods of the same name are
never touched (the app renames an unrecognised folder it would overwrite to
<name>-edited). References to bundled names inside the copied files move
with them: "mods/<n>/", the exact string "<n>", "mod.open:<n>", "mod:<n>"
and keys.json commands "<n>.<command>". Shared-state keys such as
"notepad.md" are left as they are.
"""
import hashlib, json, os, re, shutil, subprocess, sys, tarfile, io

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCK = os.path.join(ROOT, "defaults", "bundled-mods.lock.json")
MODS = os.path.join(ROOT, "defaults", "mods")
PREFIX = "fork-"
# Never shipped: editor typings Herdr writes itself, tests, plans, launchers.
SKIP = re.compile(r"(^|/)(gpui-kit\.d\.ts|jsconfig\.json|node_modules|test[^/]*|tests|refs|reviews|bin|PLAN[^/]*\.md|README\.md|\.gitignore|\.cache)(/|$)")
TEXT = (".js", ".mjs", ".json", ".md", ".txt", ".svg", ".html", ".css")


def labs_files(git, commit, path):
    raw = subprocess.run(["git", "-C", git, "archive", "--format=tar", commit, path], check=True, capture_output=True).stdout
    with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
        for m in tar.getmembers():
            if m.isfile():
                rel = m.name[len(path):].lstrip("/")
                if not SKIP.search(rel):
                    yield rel, tar.extractfile(m).read()


def rename_refs(text, names, keys_file, paths_only=False):
    for n in names:
        q = re.escape(n)
        text = re.sub(rf"mods/{q}/", f"mods/{PREFIX}{n}/", text)
        text = re.sub(rf"mod\.open:{q}\b(?!-)", f"mod.open:{PREFIX}{n}", text)
        text = re.sub(rf'"mod:{q}"', f'"mod:{PREFIX}{n}"', text)
        if not paths_only:
            text = re.sub(rf'(["\']){q}\1', rf"\g<1>{PREFIX}{n}\g<1>", text)
        if keys_file:
            text = re.sub(rf'"{q}\.(?=[a-z])', f'"{PREFIX}{n}.', text)
    return text


def build(lock, git):
    names = [n for n, m in lock["mods"].items() if m.get("ship", True)]
    out = {}
    for n in names:
        m = lock["mods"][n]
        files = {}
        # "rename": "paths" (core) and tool.json descriptors keep plain strings: those are tool ids;
        # core finds folders itself (its own at runtime, fork-<name> for plugins).
        paths_only = m.get("rename") == "paths"
        for rel, data in labs_files(git, m["commit"], m["path"]):
            if rel.endswith(TEXT):
                data = rename_refs(data.decode(), names, rel.endswith("keys.json"), paths_only or rel.endswith("tool.json")).encode()
            files[rel] = data
        if "keys" in m:
            # Keys the lockfile ships for a mod (its labs keys.json is not shipped as is).
            files["keys.json"] = rename_refs(json.dumps(m["keys"], indent=2) + "\n", names, True).encode()
        meta = json.loads(files["mod.json"])
        # Shipped, not a person's clone: Herdr's own record of the original doesn't apply.
        meta.pop("cloned_from", None)
        meta["version"] = m.get("version", "0.1.0")
        meta["source"] = {"repo": lock["repo"], "branch": m["branch"], "commit": m["commit"], "path": m["path"]}
        files["mod.json"] = (json.dumps(meta, indent=2) + "\n").encode()
        out[PREFIX + n] = files
    return out


def fork_layout(lock, git):
    """defaults/layouts/fork.json: the pinned labs layout (Ethan's Mac layout, built on
    core roles) with every bundled mod under its fork- name. The status bar starts hidden."""
    names = {n for n, m in lock["mods"].items() if m.get("ship", True)}
    pin = lock["layout"]
    raw = subprocess.run(["git", "-C", git, "show", f"{pin['commit']}:{pin['path']}"], check=True, capture_output=True).stdout
    layout = json.loads(raw)
    layout.pop("cloned_from", None)
    if layout.get("terminal_menu") in names:
        layout["terminal_menu"] = PREFIX + layout["terminal_menu"]

    def walk(n):
        if isinstance(n, dict):
            if n.get("id") == "status":
                n["hidden"] = True
            if isinstance(n.get("mod"), str) and n["mod"] in names:
                n["mod"] = PREFIX + n["mod"]
            for v in n.values():
                walk(v)
        elif isinstance(n, list):
            for v in n:
                walk(v)

    walk(layout)
    return json.dumps(layout, indent=2) + "\n"


def digest(files):
    h = hashlib.sha256()
    for rel in sorted(files):
        h.update(rel.encode() + b"\0" + files[rel] + b"\0")
    return h.hexdigest()[:16]


def main():
    lock = json.load(open(LOCK))
    git = os.path.expanduser(os.environ.get("LABS_GIT", "~/work.noindex/herdr-board/labs-wt"))
    missing = [m["commit"][:9] for m in [*lock["mods"].values(), lock["layout"]] if m.get("ship", True)
               and subprocess.run(["git", "-C", git, "cat-file", "-e", m["commit"] + "^{commit}"], capture_output=True).returncode]
    if missing:
        sys.exit(f"sync-bundled-mods: {git} lacks {', '.join(missing)}; set LABS_GIT to an essexlabs/labs clone and fetch")
    out = build(lock, git)
    # Herdr's script engine has no structuredClone (node tests pass, the live mod throws).
    clones = sorted(f"{name}/{rel}" for name, files in out.items() for rel, data in files.items()
                    if rel.endswith((".js", ".mjs")) and b"structuredClone" in data)
    if clones:
        sys.exit("sync-bundled-mods: structuredClone isn't in Herdr's script engine: " + ", ".join(clones))
    if "--check" in sys.argv:
        bad = []
        for name, files in out.items():
            have = {}
            d = os.path.join(MODS, name)
            for dirpath, _, fs in os.walk(d):
                for f in fs:
                    p = os.path.join(dirpath, f)
                    have[os.path.relpath(p, d)] = open(p, "rb").read()
            if digest(have) != digest(files):
                bad.append(name)
        if open(os.path.join(ROOT, "defaults", "layouts", "fork.json")).read() != fork_layout(lock, git):
            bad.append("layouts/fork.json")
        print("sync-bundled-mods: " + ("in sync" if not bad else "differs: " + ", ".join(bad)))
        sys.exit(1 if bad else 0)
    # Drop fork-* copies no longer in the lockfile, then write each fresh.
    for d in os.listdir(MODS):
        if d.startswith(PREFIX) and d not in out:
            shutil.rmtree(os.path.join(MODS, d))
    for name, files in out.items():
        d = os.path.join(MODS, name)
        shutil.rmtree(d, ignore_errors=True)
        for rel, data in files.items():
            p = os.path.join(d, rel)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, "wb").write(data)
        print(f"{name}: {len(files)} files, {sum(map(len, files.values()))} bytes, digest {digest(files)}")
    open(os.path.join(ROOT, "defaults", "layouts", "fork.json"), "w").write(fork_layout(lock, git))
    print("layouts/fork.json: the pinned labs layout with fork- names")


if __name__ == "__main__":
    main()
