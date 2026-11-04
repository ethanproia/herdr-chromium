// Pure helpers: no host imports, so `node core/test.mjs` can load them.
import { RUN_ALLOW } from "./registry.js";
import { runOverlayItem } from "./overlay-action.js";

export const ROLES = ["tabs", "pane-header", "menu", "plus", "new-panel", "side-strip", "sidebar-footer", "status", "sidebar-header", "header-menu", "inbox"];

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

// Copy scripts for a file or a string. The producer writes a temp file and the clipboard is only touched when it
// exited 0 (so a failing producer never leaves a half copy or an empty clipboard, and the exit code is the
// producer's or pbcopy's). $1 = what to copy, $2 = temp folder (optional: TMPDIR when absent). Callers that run
// [script, $1] with no temp dir still work, hence the $2 fallback.
// Terminal scrollback is not a script. `hc` is not on PATH when Herdr is opened from the Dock or Finder, so a
// shell `hc read` exits 127 and every terminal Copy fails. COPY_TERMINAL is the marker runCopyPlan recognizes.
const guarded = (producer) =>
  // umask 077 and mktemp: the temp file is new (never an existing file or a symlink) and only the user can read it.
  'umask 077; d="${2:-${TMPDIR:-/tmp}}"; mkdir -p "$d" && t=$(mktemp "$d/copy.XXXXXX") || exit 1; trap \'rm -f "$t"\' EXIT; ' + producer + ' > "$t" && pbcopy < "$t"';
export const COPY_TERMINAL = "copy-terminal";
export const COPY_FILE = guarded('cat "$1"');
export const COPY_FILE_STRIPPED = guarded("awk 'NR==1&&/^---$/{f=1;next} f&&/^---$/{f=0;next} !f' \"$1\"");
export const COPY_TEXT = guarded('printf %s "$1"');
const TERMINAL_READ_LINES = "100000";

// Read scrollback with the host hc() API, then pbcopy a file. A failed read (or a thrown hc) never
// touches the clipboard. An empty successful read is a real empty scrollback and is copied.
export async function copyTerminalScrollback(address, io) {
  let read;
  try {
    read = await io.hc(["read", String(address), "--lines", TERMINAL_READ_LINES]);
  } catch (e) {
    return { code: 1, stderr: e instanceof Error ? e.message : String(e), stdout: "" };
  }
  if (!read || read.code !== 0) return { code: read?.code ?? 1, stderr: read?.stderr || "", stdout: "" };
  const dir = io.tmpDir();
  const name = `${dir}/copy.${io.stamp()}`;
  const made = await io.exec("mkdir", ["-p", dir]);
  if (!made || made.code !== 0) return { code: made?.code ?? 1, stderr: made?.stderr || "Could not make a temp folder", stdout: "" };
  try {
    await io.writeTextFile(name, read.stdout ?? "", null);
    const copied = await io.exec("sh", ["-c", 'pbcopy < "$1"', "sh", name]);
    return copied ?? { code: 1, stderr: "", stdout: "" };
  } finally {
    await io.exec("rm", ["-f", name]).catch(() => {});
  }
}

// File and text plans stay shell scripts. A terminal plan never reaches the shell.
export function runCopyPlan(script, arg, io) {
  if (script === COPY_TERMINAL) return copyTerminalScrollback(arg, io);
  return io.exec("sh", ["-c", script, "sh", arg, io.tmpDir()]);
}

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

// What one header-menu choose does. Every copy row ("hold") leaves the popup up until
// the copy settles: closing first can tear the view down, and a promise awaiting in
// that view never finishes, so the clipboard write and its notification are lost.
// A second choose in that window ("ignore") must not start another copy. Both click
// and Enter share this, and a second note flush would overwrite notepad.flushReq so
// the first handshake can miss its ack. Every other row ("run") closes the popup and
// runs immediately, so Export still opens the next popup. `busy` is the menu's flag.
export function headerMenuChoose(entry, busy) {
  if (busy) return "ignore";
  if (entry?.kind === "copy") return "hold";
  return "run";
}

// Start the chosen row. A held copy starts before the popup closes and closes when
// the promise settles (or the overlay wait expires). A run row closes first.
export function beginHeaderMenuChoice(step, { copy, action, close, sleep }) {
  if (step === "ignore") return undefined;
  if (step === "hold") return runOverlayItem(() => copy(), close, true, undefined, sleep);
  close();
  action();
  return undefined;
}

// The wide Copy button. A stripped note file holds the button until its flush
// finishes; a second click in that window must not start. A copy that does not
// flush is not held, so it still runs on the first click. Nothing runs when
// there is no source, or while a note flush already owns the button.
export function paneNoteCopyClaim(src, copying, strippedScript) {
  if (!src || copying) return { start: false, hold: false };
  return { start: true, hold: src[0] === strippedScript };
}

// Rows in the narrow-pane ••• menu: Copy (when the plan produced a script), then each real header action.
// A button with no typed action is left out; Copy is left out when there is nothing to copy.
// The copy script must be one of core's own (props can come from any caller of tab.new / pane.split).
const COPY_SCRIPTS = new Set([COPY_TERMINAL, COPY_FILE, COPY_FILE_STRIPPED, COPY_TEXT]);
export function headerMenuEntries(header, copy) {
  const rows = [];
  if (Array.isArray(copy) && COPY_SCRIPTS.has(copy[0]) && (typeof copy[1] === "string" || typeof copy[1] === "number"))
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

// groupLabel in the right-click menu (6 top + 12 text + 6 bottom). The tab-bar menu always
// reserves it, the same way the menu role adds it for tab "tabbar".
export const MENU_GROUP_LABEL_H = 30;

// Right-click on the tab bar's empty space. Same rows the menu role renders: New Tab, tab tools
// (not Terminal), side tools as pin checks, Rename Space. `tools` is the shared registry list.
export function tabbarMenuItems(tools, space) {
  const list = Array.isArray(tools) ? tools : [];
  const tabTools = list.filter((x) => (x.places ?? []).includes("tab") && x.id !== "terminal");
  const sideTools = list.filter((x) => (x.places ?? []).includes("side"));
  return [
    ["New Tab", "tab.new", { space }],
    ...tabTools.map((x) => [x.name, "tool.open", { id: x.id, icon: x.icon }]),
    ...sideTools.map((x) => [x.name, "panel.pin", { tool: x.id, icon: x.icon }]),
    ["Rename Space…", "space.rename", { id: space }],
  ];
}

// A hairline sits before some items, which groups them. Shared with the menu role so a popup
// states the same height the menu root draws.
export const breaksBefore = (list, i) => i > 0 && ((list[i][1] === "sidebar.toggle" && list[i - 1][1] === "sidebar.collapse") || (list[i][1] === "tool.open" && list[i - 1][1] !== "tool.open") || (list[i][1] === "panel.pin" && list[i - 1][1] !== "panel.pin") || (list[i][1] === "space.rename" && list[i - 1][1] === "panel.pin") || list[i][1] === "machine.add" || list[i][1].endsWith(".close") || list[i][1] === "app.help" || list[i][1] === "terminal.right_click" || list[i][1] === "copy-link" || (list[i][1] === "space.move" && list[i - 1][1] !== "space.move") || list[i][1] === "tab.rename" || (list[i][1] === "app.theme" && list[i - 1][1] !== "app.theme") || list[i][1] === "notifications.clear_all");

// Popup height for the tab-bar menu: the menu root's own formula, from the rows it will render.
export function tabbarMenuHeight(tools, space) {
  const list = tabbarMenuItems(tools, space);
  const breaks = list.filter((_, i) => breaksBefore(list, i)).length;
  return menuHeight(list.length, breaks) + MENU_GROUP_LABEL_H;
}

// Pinned tools drawn on the tab bar. A stale id (no registry entry) is left out. A tool with no
// icon still shows, as the first letter of its name, the same mark the side strip uses.
export function tabBarPins(pins, tools) {
  if (!Array.isArray(pins)) return [];
  const list = Array.isArray(tools) ? tools : [];
  const out = [];
  for (const id of pins) {
    const tool = list.find((x) => x && x.id === id);
    if (!tool) continue;
    const icon = tool.icon ? tool.icon : "";
    // An empty name is not a mark. Fall through to the id so the button is not a blank box.
    const source = tool.name || tool.id || "";
    const letter = icon ? "" : String(source).charAt(0).toUpperCase();
    if (!icon && !letter) continue;
    const name = tool.name || String(tool.id);
    out.push({ id: tool.id, name, icon, letter });
  }
  return out;
}

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
