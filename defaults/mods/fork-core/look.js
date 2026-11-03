// The shared look and helpers for every role: one menu row, one group label, shortcut symbols, icon paths,
// the safe copy runner, how a tool opens, and the host side of the registry.
import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, appHome, readTextFile, settings, notify, run, shared, setShared } from "herdr";
import { SELF, icon } from "./self.js";
import { keysym, COPY_TEXT } from "./pure.js";
import { resolveOpen, createRegistry } from "./registry.js";

export { keysym, icon };
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
  return h_flex().id(o.id).h(32).px(8).gap(10).rounded(6).items_center().flex_none().cursor_pointer()
    .text_color(enabled ? t.foreground : t.dim)
    .when(active, (el) => el.bg(t.hover))
    .on_hover((h, cx) => { if (h && enabled && o.onHover) o.onHover(cx); })
    .on_click((e, cx) => { if (enabled && o.onClick) o.onClick(e, cx); })
    .child(div().size(16).flex_none().flex().items_center().justify_center().text_color(active ? t.foreground : t.muted).child(o.icon))
    .child(div().flex_1().min_w(0).truncate().text_size(14).child(o.name))
    .child(div().flex_none().text_size(12).font_family(KEYFONT).text_color(t.dim).child(o.hint ?? ""));
}

export const toolIcon = (tool, size = 16) => (tool.icon ? svg(tool.icon).size(size) : div().size(size));

// ---- copy: the clipboard only changes when the producer succeeded --------------------------------------------------
export const tmpDir = () => `${appHome()}/data/${SELF}/tmp`;

// Runs [script, arg] (from pure.js) and resolves true only on success; says so on failure.
export function runCopy(script, arg) {
  return exec("sh", ["-c", script, "sh", arg, tmpDir()]).then((r) => {
    if (r.code !== 0) notify({ title: "Couldn't copy", body: (r.stderr || "").trim().slice(0, 200), level: "error", timeout: 3000 });
    return r.code === 0;
  }).catch((e) => {
    notify({ title: "Couldn't copy", body: String(e?.message ?? e).slice(0, 200), level: "error", timeout: 3000 });
    return false;
  });
}

export function copyText(text, doneTitle = "Link copied") {
  runCopy(COPY_TEXT, text).then((ok) => { if (ok) notify({ title: doneTitle, body: text, timeout: 2000 }); });
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
  disabled() { const d = settings()?.mods_disabled; return Array.isArray(d) ? d.filter((x) => typeof x === "string") : []; },
};

// A registry seeded from the last good scan, kept in shared state ("core.registry"), so every menu opens with its
// rows at once. localStorage can't hold it: each popup is its own mod copy with its own (empty) storage. Only the
// always-shown tab strip (writer: true) refreshes and publishes it; menus read it and refresh quietly behind it.
const CACHE = "core.registry";
export function openRegistry({ writer = false } = {}) {
  const reg = createRegistry(registryIO);
  const c = shared(CACHE);
  if (Array.isArray(c?.tools)) { reg.tools = c.tools; reg.seeded = true; }
  const refresh = reg.refresh;
  reg.refresh = async () => {
    const changed = await refresh();
    if (writer && reg.loaded && JSON.stringify(shared(CACHE)?.tools) !== JSON.stringify(reg.tools)) setShared(CACHE, { tools: reg.tools });
    return changed;
  };
  return reg;
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
