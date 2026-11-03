// Role "side-strip": the side panel's tab strip, Chrome style. Pinned tools are compact icon-only tabs at the left,
// then a hairline, then unpinned tools (icon + name + x); one unpinned slot is "temporary" (italic) and the next
// temporary opening replaces it. Right-click a tab opens the core menu role (Pin / Unpin, Open as tab, Close).
//
// State: this role writes panels.pins and panels.temp, and only from a user action (pin, unpin, close). It never writes
// from render(). panels.side.<space> (which tool a space shows) is written by the tabs role alone (syncPanel).
// The role changes the layout (layout.set) only from a user action, plus once at start to dock pinned tools a fresh
// layout file doesn't hold.
import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, run, openOverlay, theme, shared, setShared, layout } from "herdr";
import { SELF, icon } from "../self.js";
import { openRegistry, openInTab } from "../look.js";
import { menuHeight } from "../pure.js";
import { BODY, DEFAULT_PINS, find, contentFor, withSideTools, sideIds, stripModel, reduce, sideMenuRows } from "../side-model.js";

// ---- tool descriptors: the registry (also read by the menu role, which runs the actions) ----
let reg = null;
const registry = () => (reg ??= openRegistry());
const FALLBACK = [
  { id: "files", name: "Files", icon: icon("file"), open: { mod: "files", props: {} } },
  { id: "changes", name: "Changes", icon: icon("changes"), open: { mod: "changes", props: {} } },
];
const toolOf = (id) => registry().tools.find((t) => t.id === id) ?? FALLBACK.find((t) => t.id === id)
  ?? { id, name: id.charAt(0).toUpperCase() + id.slice(1) };

// ---- state (callable from click handlers and the menu role, never from render) ----
const pinsNow = () => { const p = shared("panels.pins"); return Array.isArray(p) ? p : DEFAULT_PINS; };
const tempNow = () => shared("panels.temp") ?? null;
const current = () => ({ ids: sideIds(layout()), pins: pinsNow(), temp: tempNow() });
const activeSpace = () => spaces().find((p) => p.active);

// Applies a stack change: the layout (when it differs) and the pins / temp keys.
function apply(next, active) {
  const tree = layout();
  if (!find(tree, BODY)) return false;
  const out = withSideTools(tree, next.ids.map((id) => ({ id, content: contentFor(toolOf(id)) })), active);
  if (JSON.stringify(out) !== JSON.stringify(tree)) run("layout.set", { layout: out });
  setShared("panels.pins", next.pins);
  setShared("panels.temp", next.temp);
  return true;
}

// Show a tool in the side panel. The tabs role records the choice per space.
function showTool(id) {
  run("layout.select", { stack: BODY, child: id });
  run("layout.show", { id: "panel" });
}

function closeTool(id) {
  const next = reduce(current(), "close", id);
  apply(next, undefined);
  if (!next.ids.length) run("layout.hide", { id: "panel" });
}

// Open a tool in the side panel. mode: "temporary" (default) | "pinned". For the + menu's Side panel icon (later step).
// TODO(needs Ethan: park or keep): Terminal in the side panel needs terminal.park plus a { terminal } block; no block here.
export function openInSide(id, mode = "temporary") {
  const have = sideIds(layout()).includes(id);
  if (!have && !contentFor(toolOf(id))) return false;
  if (!apply(reduce(current(), mode === "pinned" ? "pin" : "temporary", id), id)) return false;
  showTool(id);
  return true;
}

// Rows for the menu role (props { role: "menu", tab: "side", target: { tool } }).
export const sideMenuItems = (target) => sideMenuRows(target?.tool, pinsNow().includes(target?.tool));
// The popup's height: the menu role's own helper (32px rows, 4px padding, one hairline before Close).
export const sideMenuPopupHeight = () => menuHeight(3, 1);

// Command from a menu row, run by menu.js after it closes its popup.
export function runSideAction(command, args) {
  const id = args?.tool;
  if (!id) return;
  if (command === "side.pin" || command === "side.unpin") {
    apply(reduce(current(), command === "side.pin" ? "pin" : "unpin", id), undefined);
  } else if (command === "side.close") {
    closeTool(id);
  } else if (command === "side.tab") {
    const tool = toolOf(id);
    if (!tool.open) return;
    openInTab(tool, activeSpace()?.id);
    if (!pinsNow().includes(id)) closeTool(id);   // a pinned tool stays docked
  }
}

// ---- the role ----
export default class SideStrip {
  init(_props, cx) {
    cx.spawn(async (cx) => {
      if (await registry().refresh()) cx.notify();
      this.dockPinned();
    });
  }

  // Once, when the registry is in: pinned tools missing from the stack (a restart reloads the layout file) are added
  // back. Layout only; no shared key is written.
  dockPinned() {
    const tree = layout();
    const have = sideIds(tree);
    const missing = pinsNow().filter((id) => !have.includes(id) && contentFor(toolOf(id)));
    if (!find(tree, BODY) || !missing.length) return;
    const list = [...have, ...missing].map((id) => ({ id, content: contentFor(toolOf(id)) }));
    run("layout.set", { layout: withSideTools(tree, list, undefined) });
  }

  render(_cx) {
    const t = theme();
    const tree = layout();
    const panel = find(tree, "panel"), body = find(tree, BODY);
    const { pinned, rest, temp } = stripModel({ pins: pinsNow(), temp: tempNow(), ids: sideIds(tree) });
    const active = panel && !panel.hidden ? body?.active : null;

    const stop = (_e, c) => c.stop_propagation();
    const menu = (id) => openOverlay({ mod: SELF, kind: "popup", width: 260, height: sideMenuPopupHeight(), props: { role: "menu", tab: "side", target: { tool: id } } });
    const glyph = (tool, on) => tool.icon
      ? svg(tool.icon).size(16).flex_none().text_color(on ? t.foreground : t.dim)
      : div().size(16).flex_none().text_size(12).text_color(on ? t.foreground : t.dim).child((tool.name ?? tool.id).charAt(0).toUpperCase());
    const tab = (id) => ({ id, tool: toolOf(id), on: active === id });
    const pin = ({ id, tool, on }) => div().id(`side-pin-${id}`).w(30).h(26).flex_none().flex().items_center().justify_center().rounded(6)
      .when(on, (el) => el.bg(t.hover)).hover((s) => s.bg(t.hover)).tooltip(tool.name ?? id)
      .on_mouse_down("left", stop).on_click(() => showTool(id))
      .on_mouse_down("right", () => menu(id))
      .child(glyph(tool, on));
    const open = ({ id, tool, on }) => h_flex().id(`side-tab-${id}`).h(26).px(8).gap(6).flex_none().items_center().rounded(6).text_size(12)
      .when(on, (el) => el.bg(t.hover)).hover((s) => s.bg(t.hover)).text_color(on ? t.foreground : t.muted)
      .on_mouse_down("left", stop).on_click(() => showTool(id))
      .on_mouse_down("right", () => menu(id))
      .child(glyph(tool, on))
      .child(div().max_w(120).truncate().when(id === temp, (el) => el.italic()).child(tool.name ?? id))
      .child(div().id(`side-close-${id}`).size(16).flex_none().flex().items_center().justify_center().rounded(4).text_color(t.dim)
        .hover((s) => s.bg(t.raised).text_color(t.foreground))
        .on_mouse_down("left", stop)
        .on_click((_e, c) => { c.stop_propagation(); closeTool(id); })
        .child(svg(icon("close")).size(12)));

    return h_flex().id("side-strip").w_full().h(34).min_w(0).px(6).gap(2).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(h_flex().id("side-strip-scroll").flex_1().min_w(0).h_full().items_center().gap(2).overflow_x_scrollbar()
        .children(pinned.map((id) => pin(tab(id))))
        .when(pinned.length > 0 && rest.length > 0, (el) => el.child(div().w(1).h(16).flex_none().mx(5).bg(t.border)))
        .children(rest.map((id) => open(tab(id)))));
  }
}
