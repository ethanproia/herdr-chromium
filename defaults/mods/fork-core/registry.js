// The tools registry: descriptors bundled in core (tools/*.json) plus discovered mods/*/tool.json, merged by id
// (a plugin's tool.json wins over a bundled one). Pure: the host is injected (`io`), so node can test it.
//
// io = { self, scan(): Promise<[{ file, folder, bundled }]>, read(file): Promise<string|null>, disabled(): string[] }

export const RUN_ALLOW = ["pane.zoom", "pane.close", "pane.split", "tab.new", "browser.new", "layout.show", "layout.hide", "layout.select"];
export const PLACES = ["tab", "split", "pane", "side"];
// Plus.on_key_down binds these before a tool shortcut: ⌘N is New space, ⌘1–⌘9 are agents.
// Matched the same way as that handler (one character, lower-cased).
const MENU_SHORTCUTS = new Set(["n", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MOD_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function bad(msg) { throw new Error(msg); }

// Icon paths are relative to the descriptor's own folder (core/icons/ for bundled ones). Paths that already start
// with "mods/" or "/" are used as given; ".." is never allowed.
function resolveIcon(p, base) {
  if (p == null || p === "") return null;
  if (typeof p !== "string") bad("icon must be a string");
  if (p.split("/").includes("..")) bad("icon path may not contain ..");
  if (p.startsWith("/")) bad("icon path must be relative");
  return p.startsWith("mods/") ? p : base + p;
}

function action(a, folder) {
  if (!isObj(a)) bad("header action must be an object");
  const keys = Object.keys(a);
  if (keys.length !== 1) bad("header action needs exactly one of toggleShared, runCommand, openPopup");
  const [k] = keys, v = a[k];
  if (k === "toggleShared") {
    if (typeof v !== "string" || !v) bad("toggleShared needs a key");
    return { toggleShared: v };
  }
  if (k === "runCommand") {
    if (!isObj(v) || !RUN_ALLOW.includes(v.name)) bad(`runCommand name must be one of ${RUN_ALLOW.join(", ")}`);
    if (v.args != null && !isObj(v.args)) bad("runCommand args must be an object");
    return { runCommand: { name: v.name, args: v.args ?? {} } };
  }
  if (k === "openPopup") {
    if (!isObj(v) || typeof v.height !== "number") bad("openPopup needs a numeric height");
    if (v.props != null && !isObj(v.props)) bad("openPopup props must be an object");
    return { openPopup: { props: v.props ?? {}, width: typeof v.width === "number" ? v.width : undefined, height: v.height } };
  }
  return bad(`unknown action ${k}`);
}

function copySpec(c) {
  if (c == null) return null;
  if (!isObj(c)) bad("copy must be an object");
  if (c.copyTerminal === true) return { copyTerminal: true };
  const f = c.copyFile;
  if (!isObj(f)) bad("copy needs copyFile or copyTerminal");
  const path = typeof f.path === "string" && f.path ? f.path : null;
  const dirShared = typeof f.dirShared === "string" && f.dirShared ? f.dirShared : null;
  if (!path && !(dirShared && typeof f.file === "string" && f.file)) bad("copyFile needs path, or dirShared and file");
  return { copyFile: { path, dirShared, file: f.file ?? null, stripFrontmatter: f.stripFrontmatter === true } };
}

// raw descriptor object -> tool (throws Error with a plain message when invalid)
export function normalizeTool(raw, folder, opts = {}) {
  const self = opts.self ?? "core";
  if (!isObj(raw)) bad("descriptor must be an object");
  if (typeof raw.id !== "string" || !ID_RE.test(raw.id)) bad("id missing or not a plain name");
  if (typeof raw.name !== "string" || !raw.name.trim()) bad("name missing");
  const bundled = opts.bundled === true;
  const base = bundled ? `mods/${self}/icons/` : `mods/${folder}/`;
  const home = bundled ? self : folder;

  const o = raw.open;
  if (!isObj(o)) bad("open missing");
  let open;
  if (o.terminal === true) open = { terminal: true };
  else if (typeof o.mod === "string") {
    const mod = o.mod === "." ? home : o.mod;
    if (!MOD_RE.test(mod)) bad("open.mod is not a plain folder name");
    if (o.props != null && !isObj(o.props)) bad("open.props must be an object");
    open = { mod, props: o.props ?? {} };
  } else if (typeof o.command === "string") {
    if (!RUN_ALLOW.includes(o.command)) bad(`open.command must be one of ${RUN_ALLOW.join(", ")}`);
    open = { command: o.command };
  } else bad("open needs mod, command or terminal");

  const places = raw.places == null ? ["tab", "split"] : raw.places;
  if (!Array.isArray(places) || places.some((p) => !PLACES.includes(p))) bad(`places must be a list of ${PLACES.join(", ")}`);

  let header = [];
  if (raw.header != null) {
    if (!Array.isArray(raw.header)) bad("header must be a list");
    const seen = new Set();
    header = raw.header.map((h) => {
      if (!isObj(h) || typeof h.id !== "string" || !h.id) bad("header button needs an id");
      // Element ids are `ph-tool-<id>-<pane>` and `hm-act-<id>`. Two buttons with the same id
      // share those ids, so gpui hover and click state mix between them.
      if (seen.has(h.id)) bad("duplicate header id");
      seen.add(h.id);
      return { id: h.id, icon: resolveIcon(h.icon, base), label: typeof h.label === "string" ? h.label : h.id, action: action(h.action, folder) };
    });
  }
  // openPopup is drawn on the tool's own mod. A terminal or command has no mod to open, so the popup
  // would be given none. Reject the descriptor rather than ship a button that cannot open.
  if (header.some((h) => h.action.openPopup) && !open.mod) bad("openPopup needs open.mod");
  if (raw.shortcut != null && raw.shortcut !== "" && !(typeof raw.shortcut === "string" && raw.shortcut.length === 1)) bad("shortcut must be one character");
  if (raw.order != null && typeof raw.order !== "number") bad("order must be a number");

  return {
    id: raw.id,
    name: raw.name.trim(),
    group: typeof raw.group === "string" && raw.group ? raw.group : "Tools",
    icon: resolveIcon(raw.icon, base),
    open,
    places,
    header,
    copy: copySpec(raw.copy),
    shortcut: raw.shortcut ?? "",
    order: raw.order ?? 100,
    folder: home,
    bundled,
    unlessInstalled: typeof raw.unlessInstalled === "string" ? raw.unlessInstalled : undefined,
  };
}

// text -> { tool } | { error }
export function parseDescriptor(text, folder, opts = {}) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { error: "not valid JSON" }; }
  try { return { tool: normalizeTool(raw, folder, opts) }; } catch (e) { return { error: e.message }; }
}

export const sortTools = (tools) => [...tools].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

const shortcutLabel = (t) => (t.bundled ? `tools/${t.id}.json` : `${t.folder}/tool.json`);

// The + menu looks up toolsFor(tools, "tab") in this order and opens the first shortcut hit,
// ahead of ⌘N. Clear a shortcut that menu already owns, or that an earlier tab tool took, so
// the row does not advertise a key that will not open it. The tool stays, and the cleared key is
// named in `warnings` (not with the descriptors that were dropped). A tool that is not in that
// list cannot take the key, so its shortcut is left as written.
export function settleShortcuts(tools, labelOf = shortcutLabel) {
  const taken = new Set();
  const warnings = [];
  const out = [];
  for (const t of tools) {
    const raw = typeof t.shortcut === "string" ? t.shortcut : "";
    const key = raw.toLowerCase();
    const inMenu = key.length === 1 && Array.isArray(t.places) && t.places.includes("tab");
    if (!inMenu) { out.push(t); continue; }
    if (MENU_SHORTCUTS.has(key) || taken.has(key)) {
      warnings.push(`${labelOf(t)}: shortcut cleared (${raw} ${MENU_SHORTCUTS.has(key) ? "is reserved" : "already used"})`);
      out.push({ ...t, shortcut: "" });
      continue;
    }
    taken.add(key);
    out.push(t);
  }
  return { tools: out, warnings };
}

// Cache key for the last good scan. Bump it when a stored tool's shape changes so an older
// blob is ignored instead of being drawn. Entries still pass through normalizeTool: a v1 row
// missing `open` or `places` is dropped, and the rest are kept.
export const REGISTRY_CACHE_KEY = "registry.v1";

// Stored tools -> tools safe for toolsFor / resolveOpen. One bad row does not drop the rest.
export function toolsFromCache(entries, self = "core") {
  if (!Array.isArray(entries)) return [];
  const tools = [];
  for (const entry of entries) {
    if (!isObj(entry)) continue;
    const folder = typeof entry.folder === "string" && entry.folder ? entry.folder : self;
    try { tools.push(normalizeTool(entry, folder, { bundled: entry.bundled === true, self })); } catch { /* skip this row */ }
  }
  // The cache is drawn before the next scan. Drop the same collisions loadRegistry does.
  return settleShortcuts(tools).tools;
}

export function readRegistryCache(raw, self = "core") {
  try {
    const c = JSON.parse(raw ?? "null");
    return toolsFromCache(c?.tools, self);
  } catch {
    return [];
  }
}

// Merge by id; a plugin's descriptor replaces a bundled one with the same id.
export function mergeTools(bundled, plugins) {
  const byId = new Map();
  for (const t of bundled) byId.set(t.id, t);
  for (const t of plugins) byId.set(t.id, t);
  return sortTools([...byId.values()]);
}

export const toolsFor = (tools, place) => tools.filter((t) => t.places.includes(place));

// Turn a descriptor's open into something to run. A prop value "$unique" or "$unique:b" becomes a fresh id
// ("b" + base36 time), as the Browser and Remote desktop need one per tab.
export function resolveOpen(tool, now = Date.now()) {
  const o = tool.open;
  if (o.terminal) return { kind: "terminal" };
  if (o.command) return { kind: "command", name: o.command };
  const props = {};
  for (const [k, v] of Object.entries(o.props ?? {})) {
    const m = typeof v === "string" ? /^\$unique(?::(.*))?$/.exec(v) : null;
    props[k] = m ? `${m[1] ?? ""}${now.toString(36)}` : v;
  }
  return { kind: "mod", mod: o.mod, props: Object.keys(props).length ? props : undefined };
}

// One scan: bundled + discovered, merged. Bad files are skipped and named in `errors`.
// A shortcut the + menu will not honor is cleared and named in `warnings`; that tool stays.
export async function loadRegistry(io) {
  const files = await io.scan();
  const disabled = new Set(io.disabled?.() ?? []);
  const bundled = [], plugins = [], errors = [], seen = new Set();
  const labels = new Map();
  for (const f of [...files].sort((a, b) => a.folder.localeCompare(b.folder) || a.file.localeCompare(b.file))) {
    if (!f.bundled && (disabled.has(f.folder) || f.folder === io.self)) continue;
    const label = f.bundled ? `tools/${f.file.split("/").pop()}` : `${f.folder}/tool.json`;
    let text = null;
    try { text = await io.read(f.file); } catch {}
    if (text == null) { errors.push(`${label}: could not read`); continue; }
    const r = parseDescriptor(text, f.folder, { bundled: f.bundled, self: io.self });
    if (r.error) { errors.push(`${label}: ${r.error}`); continue; }
    if (!f.bundled) {
      if (seen.has(r.tool.id)) { errors.push(`${label}: id ${r.tool.id} already taken by another plugin`); continue; }
      seen.add(r.tool.id);
    }
    const list = f.bundled ? bundled : plugins;
    list.push(r.tool);
    labels.set(r.tool, label);
  }
  // Bundled descriptors that open another mod show only while that mod is installed and not switched off.
  const inst = io.installed ? new Set(await io.installed()) : null;
  // unlessInstalled: a stand-in that steps aside only when that mod is installed and enabled
  // (the fork's native Browser vs the browser mod). Switched off, the stand-in stays: the mod's own entry is dropped too.
  const usable = (t) => (!t.unlessInstalled || !inst || !inst.has(t.unlessInstalled) || disabled.has(t.unlessInstalled))
    && (!t.open.mod || t.open.mod === io.self || ((!inst || inst.has(t.open.mod)) && !disabled.has(t.open.mod)));
  const kept = bundled.filter(usable);
  // Stand-ins for tools that will ship their own tool.json: used while an installed folder has none.
  if (inst) for (const [id, raw] of Object.entries(FALLBACKS)) {
    if (plugins.some((t) => t.id === id) || kept.some((t) => t.id === id)) continue;
    const folder = [id, `fork-${id}`].find((f) => inst.has(f) && !disabled.has(f));
    if (folder) {
      const tool = normalizeTool(raw, folder, { self: io.self });
      labels.set(tool, `${folder}/tool.json`);
      plugins.push(tool);
    }
  }
  // Menu order, not scan order: Plus finds the first tab tool, which is this sorted list.
  const settled = settleShortcuts(mergeTools(kept, plugins), (t) => labels.get(t) ?? shortcutLabel(t));
  return { tools: settled.tools, errors, warnings: settled.warnings };
}

// The Notepad as it was before it shipped its own tool.json (header buttons and copy included).
export const FALLBACKS = {
  notepad: {
    id: "notepad", name: "Notepad", icon: "note.svg", order: 2,
    open: { mod: "." }, places: ["tab", "split", "pane", "side"],
    header: [
      { id: "md", icon: "md.svg", label: "Markdown", action: { toggleShared: "notepad.md" } },
      { id: "export", icon: "export.svg", label: "Export…", action: { openPopup: { props: { export: true }, width: 220, height: 176 } } },
    ],
    copy: { copyFile: { dirShared: "notepad.dir", file: "notepad.md", stripFrontmatter: true } },
  },
};

// Holds the last good registry. refresh() resolves true when something changed; a failed scan keeps the
// tools and skipped-descriptor errors it had, and records the failure on `warnings`.
// The first successful scan counts as a change even when the tools match a cache that was copied onto `tools`
// beforehand (`loaded` is still false, and `key` was never seeded). Callers that share one in-flight scan each
// see that same result. A refresh that arrives while a scan is running marks the registry dirty. When the
// current scan finishes, one more runs, and another if a refresh arrived during that one. A write that landed
// after this scan had already listed or read its files is applied before refresh() resolves, instead of waiting
// for a later event. `changed` stays true when any scan in that chain differed from the registry it started from.
export function createRegistry(io) {
  let dirty = false;
  const reg = {
    tools: [],
    errors: [],
    warnings: [],
    loaded: false,
    key: "",
    inflight: null,
    refresh() {
      if (reg.inflight) {
        dirty = true;
        return reg.inflight;
      }
      reg.inflight = (async () => {
        let changed = false;
        try {
          do {
            dirty = false;
            try {
              const r = await loadRegistry(io);
              const key = JSON.stringify(r);
              // `key` is the last good scan. A failure leaves that key and writes over `warnings`,
              // so the next good scan can match `key` while the held warnings still say it failed.
              // Compare the held tools, errors and warnings too, or the footer never clears.
              const held = JSON.stringify({ tools: reg.tools, errors: reg.errors, warnings: reg.warnings });
              changed = changed || key !== reg.key || key !== held || !reg.loaded;
              reg.tools = r.tools; reg.errors = r.errors; reg.warnings = r.warnings; reg.key = key; reg.loaded = true;
            } catch (e) {
              const msg = `scan failed: ${e?.message ?? e}`;
              const prior = reg.warnings.find((w) => w.startsWith("scan failed"));
              changed = changed || prior !== msg;
              reg.warnings = [msg, ...reg.warnings.filter((w) => !w.startsWith("scan failed"))];
            }
          } while (dirty);
          return changed;
        } finally { reg.inflight = null; }
      })();
      return reg.inflight;
    },
  };
  return reg;
}

// Hosts wake other views and rewrite their cache from refresh(). That work must follow the tools, not
// refresh()'s flag: the flag is true for the first scan and for an error-only change, and every caller
// that joined the in-flight scan would otherwise publish again. `publish` runs for a scan that left
// different tools than the ones already held (the cache seed, or the last scan). The wrapper has the
// same in-flight join as refresh(): a call that arrives after the scan underneath has already read still
// marks this flight dirty, and a follow-up scan publishes only when its tools differ.
export function publishRegistryChanges(reg, publish) {
  const refresh = reg.refresh;
  let flight = null;
  let dirty = false;
  reg.refresh = () => {
    if (flight) {
      dirty = true;
      return flight;
    }
    flight = (async () => {
      let changed = false;
      try {
        do {
          dirty = false;
          const before = JSON.stringify(reg.tools);
          // Await first. `changed || await refresh()` would skip the follow-up once changed is true.
          changed = (await refresh()) || changed;
          if (reg.loaded && JSON.stringify(reg.tools) !== before) publish(reg.tools);
        } while (dirty);
        return changed;
      } finally { flight = null; }
    })();
    return flight;
  };
  return reg;
}
