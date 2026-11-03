// Pure helpers: no host imports, so `node core/test.mjs` can load them.
import { RUN_ALLOW } from "./registry.js";

export const ROLES = ["tabs", "pane-header", "menu", "plus", "new-panel", "side-strip", "sidebar-footer", "status", "sidebar-header", "header-menu"];

// Which role a copy of core plays. An explicit props.role wins; otherwise Herdr's own shapes decide:
// terminal_menu passes { tab, target }; pane.split passes { direction }; a pane header block passes { pane }.
export function pickRole(p) {
  p = p && typeof p === "object" ? p : {};
  if (ROLES.includes(p.role)) return p.role;
  if (p.tab) return "menu";
  if (p.direction) return "new-panel";
  if (p.pane && !p.overlay) return "pane-header";
  return null;
}

// "cmd-shift-enter" -> "⌘⇧↩", as macOS menus write shortcuts.
export const KEYSYM = { cmd: "⌘", shift: "⇧", alt: "⌥", ctrl: "⌃", enter: "↩", backspace: "⌫", escape: "⎋", tab: "⇥", up: "↑", down: "↓", left: "←", right: "→", space: "Space" };
export function keysym(k) {
  if (!k) return "";
  const first = String(k).split(/\s+/)[0];
  return first.split("-").map((p) => KEYSYM[p] ?? (p.length === 1 ? p.toUpperCase() : p)).join("");
}

// Copy scripts. The producer writes a temp file and the clipboard is only touched when it exited 0 (so a failing
// producer never leaves a half copy or an empty clipboard, and the exit code is the producer's or pbcopy's).
// $1 = what to copy (terminal address, file path or text), $2 = temp folder (optional: TMPDIR when absent).
// Callers that run [script, $1] with no temp dir still work, hence the $2 fallback.
const guarded = (producer) =>
  'd="${2:-${TMPDIR:-/tmp}}"; mkdir -p "$d" && t="$d/copy.$$" && ' + producer + ' > "$t" && pbcopy < "$t"; rc=$?; rm -f "$t"; exit $rc';
export const COPY_TERMINAL = guarded('hc read "$1" --lines 100000');
export const COPY_FILE = guarded('cat "$1"');
export const COPY_FILE_STRIPPED = guarded("awk 'NR==1&&/^---$/{f=1;next} f&&/^---$/{f=0;next} !f' \"$1\"");
export const COPY_TEXT = guarded('printf %s "$1"');

// Directory a pane header labels, before ~ shortening.
// A file viewer uses the open file's parent ("" until a path is published).
// A copy spec with dirShared uses that shared directory when the reader returned a string
// (the Notepad's notes folder, including "" if that is what was published).
// Header buttons do not select a folder. Anything else uses an explicit label when the
// caller set one (the New panel passes "") or the pane's cwd.
export function headerDirPath({ isViewer, viewPath, dirShared, sharedDir, explicit, cwd } = {}) {
  if (isViewer) {
    if (typeof viewPath !== "string" || !viewPath) return "";
    const i = viewPath.lastIndexOf("/");
    return i > 0 ? viewPath.slice(0, i) : "";
  }
  if (typeof dirShared === "string" && dirShared && typeof sharedDir === "string") return sharedDir;
  if (explicit !== undefined) return typeof explicit === "string" ? explicit : "";
  return typeof cwd === "string" ? cwd : "";
}

// What a header's Copy button copies, as [script, argument] or null.
// `shared` is a reader for shared keys (injected so this stays pure).
// A descriptor spec is authoritative and does not fall through: `copyTerminal` copies the pane's
// terminal address (nothing, when the pane has none); `copyFile` copies that file even if the pane
// also has a terminal. With no spec, a terminal address still copies its scrollback, then a viewer path.
export function copyPlan({ terminal, copy, viewPath }, shared) {
  if (copy?.copyTerminal === true) return terminal ? [COPY_TERMINAL, terminal] : null;
  const c = copy?.copyFile;
  if (c) {
    let path = null;
    if (typeof c.path === "string" && c.path) path = c.path;
    else if (c.dirShared) {
      const dir = shared(c.dirShared);
      if (typeof dir === "string" && dir && c.file) path = `${dir}/${c.file}`;
    }
    return path ? [c.stripFrontmatter ? COPY_FILE_STRIPPED : COPY_FILE, path] : null;
  }
  if (terminal) return [COPY_TERMINAL, terminal];
  if (viewPath) return [COPY_FILE, viewPath];
  return null;
}

// Which copy spec the header should hand to copyPlan.
// A mod tool's own spec wins. A bare terminal (no mod) uses a tool that opens a terminal and declares
// `copyTerminal` — the bundled Terminal tool when it is one of them. A mod with no spec does not borrow
// that, and a terminal tool that only declares copyFile is not applied to every shell.
export function copySpecFor(pane, toolCopy, tools) {
  if (toolCopy) return toolCopy;
  if (pane?.mod || !pane?.terminal) return null;
  const hits = (Array.isArray(tools) ? tools : []).filter((x) => x?.open?.terminal && x.copy?.copyTerminal === true);
  return (hits.find((x) => x.id === "terminal") ?? hits[0])?.copy ?? null;
}

// One typed header action, as data. Unknown shapes are null so a menu does not invent a command.
// `runCommand` stays on the allow-list; the pane the button sits on wins over a descriptor pane.
export function headerActionPlan(action, pane) {
  if (!action || typeof action !== "object" || Array.isArray(action)) return null;
  const keys = Object.keys(action);
  if (keys.length !== 1) return null;
  if (typeof action.toggleShared === "string" && action.toggleShared) return { kind: "toggleShared", key: action.toggleShared };
  const run = action.runCommand;
  if (run && typeof run === "object" && typeof run.name === "string" && RUN_ALLOW.includes(run.name))
    return { kind: "run", name: run.name, args: withPane(run.args, pane) };
  const pop = action.openPopup;
  if (pop && typeof pop === "object" && !Array.isArray(pop))
    return { kind: "popup", props: pop.props && typeof pop.props === "object" && !Array.isArray(pop.props) ? pop.props : {}, width: typeof pop.width === "number" ? pop.width : 220, height: pop.height };
  return null;
}

// Element id for one of a tool's own header buttons. The `tool` segment keeps it off the stock
// buttons in the same header (`ph-r-`, `ph-d-`, `ph-z-`, `ph-x-`, `ph-cp-`, `ph-more-`, `ph-bl-`).
export function toolHeaderElId(id, pane) {
  return `ph-tool-${id}-${pane}`;
}

// Element id for one row of the folded header menu. Copy is the fixed `hm-copy` row; a tool
// action is `hm-act-…`, so a button whose id is `copy` does not share that row's id.
export function headerMenuElId(entry) {
  return entry?.kind === "copy" ? "hm-copy" : `hm-act-${entry?.id}`;
}

// Rows in the narrow-pane ••• menu: Copy (when the plan produced a script), then each real header action.
// A button with no typed action is left out; Copy is left out when there is nothing to copy.
export function headerMenuEntries(header, copy) {
  const rows = [];
  if (Array.isArray(copy) && typeof copy[0] === "string" && copy[0] && (typeof copy[1] === "string" || typeof copy[1] === "number"))
    rows.push({ kind: "copy", id: "copy", label: "Copy Contents", copy: [copy[0], String(copy[1])] });
  if (Array.isArray(header)) {
    for (const h of header) {
      if (!h || typeof h !== "object" || !headerActionPlan(h.action, undefined)) continue;
      rows.push({
        kind: "action",
        id: String(h.id || "item"),
        label: typeof h.label === "string" && h.label ? h.label : String(h.id || "Item"),
        icon: typeof h.icon === "string" ? h.icon : null,
        action: h.action,
      });
    }
  }
  return rows;
}

// Menu height: rows are 32px, a hairline group break is 9px, 4px padding top and bottom.
export const menuHeight = (rows, breaks) => 8 + rows * 32 + breaks * 9;

// A header button's command arguments. The pane the button sits on wins over anything the
// descriptor put in args (a plugin must not close or split some other pane).
export function withPane(args, pane) {
  return { ...(args && typeof args === "object" ? args : {}), pane };
}

// One registry watch for every header in this worker. `members` is oldest-first.
// A join starts the watch only when nobody owns it. A leave starts it again only when the owner left
// and someone is still listening. Returns the id that should start, or null when the watch stays put.
export function watchMembership(members, owner, event) {
  const set = new Set(members);
  if (event.type === "join") set.add(event.id);
  else set.delete(event.id);
  const list = [...set];
  let next = owner != null && set.has(owner) ? owner : null;
  let start = null;
  if (next == null && list.length) {
    next = event.type === "join" ? event.id : list[0];
    start = next;
  }
  return { members: list, owner: next, start };
}

// One footer line. "Skipped" is only for a descriptor that was dropped. A scan failure and a
// cleared shortcut stay on `warnings`: the tools are still listed, so they are not skips.
export function registryNotice(reg) {
  const warnings = Array.isArray(reg?.warnings) ? reg.warnings : [];
  const scan = warnings.find((w) => typeof w === "string" && w.startsWith("scan failed"));
  if (scan) return scan;
  const errors = Array.isArray(reg?.errors) ? reg.errors : [];
  const skipped = errors.find((e) => typeof e === "string" && e);
  if (skipped) return `Skipped ${skipped}`;
  const note = warnings.find((w) => typeof w === "string" && w);
  return note ?? "";
}

export const REGISTRY_WATCH_RETRY_MS = 5000;
// Persistent watch failures wait longer, up to the registry poll interval, instead of logging
// and arming a timer on the base interval for as long as the owner exists.
export const REGISTRY_WATCH_RETRY_MAX_MS = 30000;

export function registryWatchFailure(e) {
  return `core: watch failed: ${e?.message ?? e}`;
}

// One folder-watch generation for the registry owner. `watch` resolves to a path batch or throws.
// A throw is retried while this owner holds the watch. The first wait is `retryMs`; each further
// failure in a row doubles it up to `retryMaxMs` (never below `retryMs`). A watch that resolves
// resets the wait and the reported message, so a later outage starts over and is reported again.
// `onError` runs for the first failure in a streak and whenever `registryWatchFailure` changes,
// not again for the same line. The loop stops when `isOwner` is false, including a batch or a
// failure that lands after this owner has left, so a header that closed does not keep the watch
// or start another one.
export async function runRegistryWatch({
  isOwner, watch, onBatch, onError, wait,
  retryMs = REGISTRY_WATCH_RETRY_MS,
  retryMaxMs = REGISTRY_WATCH_RETRY_MAX_MS,
}) {
  const base = retryMs;
  const cap = Math.max(base, retryMaxMs);
  let delay = base;
  let reported = null;
  for (;;) {
    if (!isOwner()) return;
    let paths;
    try {
      paths = await watch();
    } catch (e) {
      const line = registryWatchFailure(e);
      if (line !== reported) {
        reported = line;
        onError(e);
      }
      if (!isOwner()) return;
      await wait(delay);
      delay = Math.min(delay * 2, cap);
      continue;
    }
    delay = base;
    reported = null;
    if (!isOwner()) return;
    onBatch(paths);
  }
}

const stripTrail = (p) => (typeof p === "string" && p.length > 1 ? p.replace(/\/+$/, "") : (typeof p === "string" ? p : ""));

// A bundled descriptor the shell glob `tools/*.json` would read: not a dotfile, directly in that folder.
const plainJson = (name) => typeof name === "string" && name.endsWith(".json") && !name.startsWith(".");

// True when a watchFolder batch can change the registry. scan() reads mods/*/tool.json and
// mods/<self>/tools/*.json; installed() lists directories under mods/ that contain a mod.json.
// Adding, removing, or renaming a mod is often only an event on that directory (one segment
// under mods/), with no tool.json or mod.json path in the batch. Writes under a mod that are
// neither a descriptor nor that directory (state, build output, node_modules, a nested
// tool.json) do not. A batch that includes the watched folder itself means the host dropped
// paths, so the scan runs. A batch that is not a list of paths is treated as relevant. The
// 30s poll covers a miss.
export function registryWatchRelevant(paths, modsDir, self) {
  if (!Array.isArray(paths)) return true;
  const root = stripTrail(modsDir);
  if (!root) return true;
  const prefix = `${root}/`;
  const bundled = typeof self === "string" && self && !self.includes("/") ? self : null;
  for (const raw of paths) {
    if (typeof raw !== "string") return true;
    const p = stripTrail(raw);
    if (p === root) return true;
    if (!p.startsWith(prefix)) continue;
    const parts = p.slice(prefix.length).split("/");
    if (parts.some((s) => s === "" || s === "." || s === "..")) continue;
    // The mod folder itself: an atomic install, removal, or rename may report only this path.
    if (parts.length === 1) return true;
    if (parts.length === 2 && (parts[1] === "tool.json" || parts[1] === "mod.json")) return true;
    if (bundled && parts.length === 3 && parts[0] === bundled && parts[1] === "tools" && plainJson(parts[2])) return true;
  }
  return false;
}
