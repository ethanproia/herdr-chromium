// The shared look and helpers for every role: one menu row, one group label, shortcut symbols, icon paths,
// the safe copy runner, how a tool opens, and the host side of the registry.
import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, hc, appHome, readTextFile, settings, notify, run, watchFolder, shared, setShared, openOverlay, writeTextFile } from "herdr";
import * as herdr from "herdr";
import { SELF, icon } from "./self.js";
import { keysym, COPY_TEXT, COPY_FILE_STRIPPED, watchMembership, registryWatchRelevant, headerActionPlan, registryNotice, runRegistryWatch, registryWatchFailure, runCopyPlan } from "./pure.js";
import { resolveOpen, createRegistry, readRegistryCache, toolsFromCache, publishRegistryChanges, REGISTRY_CACHE_KEY } from "./registry.js";

export { keysym, registryNotice, icon };
export const KEYFONT = ".SystemUIFont";   // the bundled UI font has no bold or symbols: macOS menus use the system one

// A group label ("Tools", "Agents", "Workspace").
// A fixed height (top + 24: an 18px line + 6 below), so every popup's height sum is exact and its bottom padding
// stays equal to the top (Ethan: "look at the bottom inside spacing, not correct, too short").
export function groupLabel(t, text, top = 6) {
  return div().h(top + 24).flex_none().flex().items_end().px(8).pb(6).text_size(12).line_height("18px").font_weight(500).text_color(t.dim).child(text);
}

// One 32px menu row: 16px icon, name, faint hint on the right; the highlight follows pointer and arrows.
// o = { t, id, icon (an element), name, hint, active, enabled, onClick(e, cx), onHover(cx) }
export function menuRow(o) {
  const { t, enabled = true, active = false } = o;
  // A disabled row never lights up and shows no pointer (Ethan: "if it's unavailable, it shouldnt light up when i hover").
  return h_flex().id(o.id).h(32).px(8).gap(10).rounded(6).items_center().flex_none().when(enabled, (el) => el.cursor_pointer())
    .text_color(enabled ? t.foreground : t.dim)
    .when(active && enabled, (el) => el.bg(t.hover))
    .on_hover((h, cx) => { if (h && enabled && o.onHover) o.onHover(cx); })
    .on_click((e, cx) => { if (enabled && o.onClick) o.onClick(e, cx); })
    // One step down the type scale for every menu (Ethan: menu text was one size too large): 13px names, 11px hints,
    // icons drawn at 15px in the same 16px slot.
    .child(div().size(16).flex_none().flex().items_center().justify_center().text_color(active ? t.foreground : t.muted).child(o.icon))
    .child(div().flex_1().min_w(0).truncate().text_size(13).child(o.name))
    .child(div().flex_none().text_size(11).font_family(KEYFONT).text_color(t.dim).child(o.hint ?? ""));
}

export const toolIcon = (tool, size = 15) => (tool.icon ? svg(tool.icon).size(size) : div().size(size));

// ---- copy: the clipboard only changes when the producer succeeded --------------------------------------------------
export const tmpDir = () => `${appHome()}/data/${SELF}/tmp`;

// Runs a copy plan (from pure.js) and resolves true only on success; says so on failure.
// A terminal plan reads through hc(); file and text plans stay shell scripts.
export function runCopy(script, arg) {
  return Promise.resolve(runCopyPlan(script, arg, {
    hc,
    exec,
    writeTextFile,
    tmpDir,
    stamp: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  })).then((r) => {
    if (!r || r.code !== 0) notify({ title: "Couldn't copy", body: (r?.stderr || "").trim().slice(0, 200), level: "error", timeout: 3000 });
    return !!r && r.code === 0;
  }).catch((e) => {
    notify({ title: "Couldn't copy", body: String(e?.message ?? e).slice(0, 200), level: "error", timeout: 3000 });
    return false;
  });
}

export function copyText(text, doneTitle = "Link copied") {
  return runCopy(COPY_TEXT, text).then((ok) => { if (ok) notify({ title: doneTitle, body: text, timeout: 2000 }); return ok; });
}

// The Notepad saves 400 ms after typing. A note copy asks that mod to write first (the same handshake
// Export uses) so the clipboard gets the latest text. A timeout (nothing answered) copies the file as
// it stands. An error answer does not copy. `mod` is the note's own mod name.
export function flushNoteCopy(mod, cx) {
  const req = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setShared("notepad.flushReq", req);
  run(`${mod || "notepad"}.flush`);
  return (async () => {
    for (let i = 0; i < 30; i++) {
      const a = shared("notepad.flushAck");
      if (a && a.req === req) {
        await cx.sleep(150);
        // A newer request may have replaced the answer by now; only an answer to this request counts.
        const z = shared("notepad.flushAck");
        const ack = z && z.req === req ? z : a;
        return ack.ok ? null : (ack.error || "The note could not be saved");
      }
      await cx.sleep(100);
    }
    return null;
  })();
}

// Pane-header Copy. A stripped note file flushes first; every other script is the guarded copy as-is.
export function runPaneCopy(script, arg, mod, cx) {
  const start = () => runCopy(script, arg);
  if (script !== COPY_FILE_STRIPPED) return start();
  return flushNoteCopy(mod, cx).then((err) => {
    if (!err) return start();
    notify({ title: "Couldn't copy", body: String(err).trim().slice(0, 200), level: "error", timeout: 3000 });
    return false;
  }).catch((e) => {
    notify({ title: "Couldn't copy", body: String(e?.message ?? e).slice(0, 200), level: "error", timeout: 3000 });
    return false;
  });
}

// The same typed actions the wide header buttons run. `mod` is the tool's own mod (openPopup only).
export function runHeaderAction(action, { pane, mod } = {}) {
  const plan = headerActionPlan(action, pane);
  if (!plan) return;
  if (plan.kind === "toggleShared") setShared(plan.key, shared(plan.key) !== true);
  else if (plan.kind === "run") run(plan.name, plan.args);
  else if (plan.kind === "popup" && mod) openOverlay({ mod, kind: "popup", props: plan.props, width: plan.width, height: plan.height });
}

// ---- opening a tool ------------------------------------------------------------------------------------------------
export function openInTab(tool, space) {
  const o = resolveOpen(tool);
  if (o.kind === "terminal") run("tab.new", { space });
  else if (o.kind === "command") run(o.name, {});   // browser.new opens a tab in the current space (no space arg)
  else run("tab.new", { name: tool.name, space, mod: o.mod, ...(o.props ? { props: o.props } : {}) });
}

// The extra arguments pane.split takes to start this tool in the new pane (null for a command).
export function splitExtra(tool) {
  const o = resolveOpen(tool);
  if (o.kind === "terminal") return {};
  if (o.kind === "mod") return { mod: o.mod, ...(o.props ? { props: o.props } : {}) };
  return null;
}

// Starts a tool beside `pane`.
export function openInSplit(tool, direction, pane) {
  const extra = splitExtra(tool);
  if (extra) run("pane.split", { direction, pane, ...extra });
  else run(resolveOpen(tool).name, { place: direction, pane });   // browser.new {place: "right" | "down", pane}
}

// ---- the host side of the registry (descriptors are read with the shell: one listing, plain file reads) -----------
export const registryIO = {
  self: SELF,
  async scan() {
    const mods = `${appHome()}/mods`;
    const r = await exec("sh", ["-c",
      'for f in "$1"/*/tool.json; do [ -f "$f" ] && printf "P%s\\n" "$f"; done; for f in "$2"/*.json; do [ -f "$f" ] && printf "B%s\\n" "$f"; done; true',
      "sh", mods, `${mods}/${SELF}/tools`]);
    if (r.code !== 0) throw new Error((r.stderr || "listing failed").trim());
    return r.stdout.split("\n").filter(Boolean).map((line) => {
      const file = line.slice(1), bundled = line[0] === "B";
      return { file, bundled, folder: bundled ? SELF : file.split("/").slice(-2, -1)[0] };
    });
  },
  async installed() {
    const r = await exec("sh", ["-c", 'for d in "$1"/*/; do [ -f "$d/mod.json" ] && basename "$d"; done; true', "sh", `${appHome()}/mods`]);
    if (r.code !== 0) throw new Error((r.stderr || "listing failed").trim());
    return r.stdout.split("\n").filter(Boolean);
  },
  read: (file) => readTextFile(file),
  // Command names, feature-detected. Stock Herdr may not export `commands`; a named import of a missing
  // export fails this module, so it is read off the namespace (same as notes.js). Null means the list is
  // unknown: not a function, a throw, or a null, empty, or non-array answer. The registry then keeps
  // command-backed tools. A real list hides only the commands it does not contain.
  commands() {
    if (typeof herdr.commands !== "function") return null;
    try {
      const list = herdr.commands();
      if (!Array.isArray(list)) return null;
      const names = list.map((c) => (typeof c === "string" ? c : c?.name)).filter((n) => typeof n === "string");
      return names.length ? names : null;   // an unrecognised shape is "unknown", so command tools stay visible
    } catch { return null; }
  },
  disabled() { const d = settings()?.mods_disabled; return Array.isArray(d) ? d.filter((x) => typeof x === "string") : []; },
};

// One registry per worker. Every role reads this copy; one header owns the poll and the folder watch.
// The shared key holds the last good tool list plus a wake count: localStorage can't hold the list, because each
// popup is its own mod copy with its own empty storage. Only the always-shown tab strip (writer: true) publishes
// the list; menus read it and refresh quietly behind it. Headers read the key in render, so any bump redraws them.
// A bare number (an older wake with no list yet) still counts.
export const REGISTRY_WAKE = "core.registry";

let registry = null;
let registryWriter = false;
let watchMembers = [];
let watchOwner = null;
const watchCx = new Map();

function wakeCount(prev) {
  if (typeof prev === "number") return prev;
  return typeof prev?.wake === "number" ? prev.wake : 0;
}

// The writer publishes its list; anyone else only bumps the wake and keeps the writer's list.
function publishShared(tools) {
  try {
    const prev = shared(REGISTRY_WAKE);
    const wake = wakeCount(prev) + 1;
    if (registryWriter) setShared(REGISTRY_WAKE, { tools, wake });
    else if (Array.isArray(prev?.tools)) setShared(REGISTRY_WAKE, { tools: prev.tools, wake });
    else setShared(REGISTRY_WAKE, wake);
  } catch { /* a caller with no host call still gets the new tools on its own notify */ }
}

export function openRegistry({ writer = false } = {}) {
  const late = writer && !registryWriter;
  registryWriter = registryWriter || writer;
  if (registry) {
    // A writer arriving after this worker already scanned publishes what it has, since the next scan may see no change.
    if (late && registry.loaded && JSON.stringify(shared(REGISTRY_WAKE)?.tools) !== JSON.stringify(registry.tools)) publishShared(registry.tools);
    return registry;
  }
  const reg = createRegistry(registryIO);
  // The shared copy first (it reaches popups); this worker's own storage only when nothing is shared yet.
  // Either way the cached rows are validated before they are drawn.
  let cached = null;
  try { cached = shared(REGISTRY_WAKE); } catch { /* empty until the scan */ }
  if (Array.isArray(cached?.tools)) { reg.tools = toolsFromCache(cached.tools, SELF); reg.seeded = true; }
  else {
    try { reg.tools = readRegistryCache(localStorage.getItem(REGISTRY_CACHE_KEY), SELF); } catch { /* empty until the scan */ }
  }
  // One publish per scan, and only when the loaded tools differ from the seeded copy. The first
  // scan reports a change even when they match, and the + menu, New panel and tab strip share it.
  publishRegistryChanges(reg, (tools) => {
    try { localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({ tools })); } catch { /* the next scan still fills menus */ }
    publishShared(tools);
  });
  registry = reg;
  return reg;
}

function beginRegistryWatch(id) {
  const cx = watchCx.get(id);
  if (!cx || watchOwner !== id) return;
  const reg = openRegistry();
  const reload = (cx) => {
    if (watchOwner !== id) return;
    cx.spawn(async (cx) => {
      if (watchOwner !== id) return;
      const changed = await reg.refresh();
      if (watchOwner !== id) return;
      if (changed && reg.errors.length) console.log(`core: skipped ${reg.errors.join("; ")}`);
      if (changed && reg.warnings.length) console.log(`core: ${reg.warnings.join("; ")}`);
      if (changed) cx.notify();
    });
  };
  reload(cx);
  cx.timer.every(30000, reload);
  cx.spawn(async (cx) => {
    const modsOf = () => `${appHome()}/mods`;
    // watchFolder takes no cancel handle, so a call stays blocked until mods/ changes even
    // after the owner leaves. A newer owner has its own watch. Ignore the late batch, and
    // retry a throw while this id still owns the watch instead of leaving it unwatched.
    await runRegistryWatch({
      isOwner: () => watchOwner === id,
      watch: () => watchFolder(modsOf()),
      onBatch: (paths) => {
        if (registryWatchRelevant(paths, modsOf(), SELF)) reload(cx);
      },
      onError: (e) => console.log(registryWatchFailure(e)),
      wait: (ms) => new Promise((resolve) => { cx.timer.after(ms, resolve); }),
    });
  });
}

function applyWatch(event) {
  const next = watchMembership(watchMembers, watchOwner, event);
  watchMembers = next.members;
  watchOwner = next.owner;
  if (next.start) beginRegistryWatch(next.start);
}

// The first header polls and watches mods/. Later headers share that registry. When the owner
// closes, the oldest header still on screen takes the watch; a leave of anyone else changes nothing.
export function watchRegistry(cx) {
  const id = {};
  watchCx.set(id, cx);
  applyWatch({ type: "join", id });
  return () => {
    watchCx.delete(id);
    applyWatch({ type: "leave", id });
  };
}

// Keeps the highlighted row on the same item when rows arrive or move (by row id, not position).
export function keepSelection(self, ids) {
  const prev = self.rowIds;
  if (prev && prev.join("\n") !== ids.join("\n")) {
    const k = ids.indexOf(prev[self.at]);
    self.at = k >= 0 ? k : 0;
  }
  self.rowIds = ids;
}
