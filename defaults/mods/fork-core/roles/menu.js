// Role "menu": right-click menus (replaces the old menu-browser). Opened as a popup with
// props { role: "menu", tab: "pane" | "tab" | "space" | "side" | "global", target }; Herdr's terminal_menu passes { tab, target } too.
// ↑/↓ move, Enter runs, Esc closes. An item is [label, command, args]; a command "worktree" opens the worktree dialog.
import { div, svg } from "gpui-kit";
import { v_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";
import { SELF } from "../self.js";
import { icon, menuRow, keysym, copyText, groupLabel } from "../look.js";
import { menuHeight } from "../pure.js";
import { sectionLocked } from "../sections-pure.js";
import { sideMenuItems, runSideAction } from "./side-strip.js";
import { sections, toggleFromClick, toggleSidebar, isCollapsed } from "./sections.js";

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// A space's checkout: "main" (a repo's own), "linked" (a worktree), or null.
async function checkout(folder, on) {
  const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder, on });
  const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder, on });
  if (top.code !== 0 || common.code !== 0) return null;
  return common.stdout.trim() === `${top.stdout.trim()}/.git` ? "main" : "linked";
}

function items(p, git) {
  p = p ?? {};
  const tg = p.target ?? {};
  switch (p.tab) {
    case "pane": {
      // A kept sub-agent can go back under its parent, still running.
      const all = terminals();
      const term = all.find((t) => t.address === tg.terminal);
      const parent = term?.parent && all.find((t) => t.address === term.parent);
      // Once they go to the program, Shift+right-click still opens this menu.
      const toProgram = term?.labels?.["herdr.right-click"] === "program";
      return [
        ["Split right", "pane.split", { direction: "right", pane: tg.pane }],
        ["Split down", "pane.split", { direction: "down", pane: tg.pane }],
        ["Copy link to panel", "copy-link", { pane: tg.pane, terminal: tg.terminal }],
        ["Zoom", "pane.zoom", { pane: tg.pane }],
        ...(term
          ? [
              toProgram
                ? ["Use Herdr right-click menu", "terminal.right_click", { terminal: term.address, to: "menu" }]
                : ["Send right-clicks to pane", "terminal.right_click", { terminal: term.address, to: "program" }],
            ]
          : []),
        ...(parent ? [[`Send back to ${parent.name || parent.address}`, "terminal.park", { terminal: term.address }]] : []),
        ["Close pane", "pane.close", { pane: tg.pane }],
      ];
    }
    case "tab":
      return [
        // Splits act on the tab's focused pane (else its first).
        ...((() => { const ps = panes().filter((x) => x.tab === tg.id); const pn = (ps.find((x) => x.focused) ?? ps[0])?.pane;
          return pn ? [["Split right", "pane.split", { direction: "right", pane: pn }], ["Split down", "pane.split", { direction: "down", pane: pn }]] : []; })()),
        ["Rename", "tab.rename", { id: tg.id }],
        ["New tab", "tab.new", { space: tg.space }],
        ["Copy link to tab", "copy-tab-link", { id: tg.id, space: tg.space }],
        ["Close", "tab.close", { id: tg.id }],
      ];
    case "space":
      return [
        ["Rename", "space.rename", { id: tg.id }],
        ...(git ? [["New worktree", "worktree", { space: tg.id, action: "new" }], ["Open worktree", "worktree", { space: tg.id, action: "open" }]] : []),
        ...(git === "linked" ? [["Remove worktree", "worktree", { space: tg.id, action: "remove" }]] : []),
        ["Close", "space.close", { id: tg.id }],
      ];
    case "side":
      // A side panel strip tab: Pin / Unpin, Open as tab, Close.
      return sideMenuItems(tg);
    case "sidebar":
      // Checkable toggles for the left sidebar's sections.
      return [[isCollapsed() ? "Expand sidebar" : "Collapse sidebar", "sidebar.collapse", {}], ["Spaces", "sidebar.toggle", { key: "spaces" }], ["Agents", "sidebar.toggle", { key: "agents" }], ["Add machine", "sidebar.toggle", { key: "addMachine" }], ["Status bar", "sidebar.toggle", { key: "statusBar" }]];
    default:
      return [
        ["New space", "space.new", {}],
        ["Keybinds", "app.help", {}],
        ["Theme: graphite", "app.theme", { name: "graphite" }],
        ["Theme: ink", "app.theme", { name: "ink" }],
        ["Theme: moss", "app.theme", { name: "moss" }],
        ["Theme: atom one dark", "app.theme", { name: "atom-one-dark" }],
      ];
  }
}

// One 16px line icon per item (same grid and stroke as the pane header buttons).
// A small switch (shadcn Switch proportions): 28x16 track, 12px knob; on = accent track, knob right.
// Locked (the last list still on) looks the same as on, with a tooltip saying why it won't turn off.
function toggleSwitch(t, on, locked) {
  return div().id("sw").w(28).h(16).flex_none().rounded(8).p(2).flex().items_center()
    .bg(on ? t.accent : t.border).when(on, (el) => el.justify_end())
    .when(locked, (el) => el.tooltip("At least one list stays on"))
    .child(div().size(12).rounded(6).bg(t.foreground));
}

// The height of a groupLabel (6 top + 12 text + 6 bottom, as the + menu counts it).
export const LABEL_H = 30;

function menuIcon(command, args) {
  if (command === "pane.split") return icon(args?.direction === "down" ? "split-down" : "split-right");
  if (command === "pane.zoom") return icon("zoom");
  if (command === "turn-into") return icon("turn-into");
  if (command === "copy-link" || command === "copy-tab-link") return icon("link");
  if (command === "terminal.right_click") return icon("mouse");
  if (command === "terminal.park") return icon("send-back");
  if (command === "sidebar.collapse") return icon("sidebar");
  if (command === "sidebar.toggle") return icon({ spaces: "spaces", agents: "agents", addMachine: "plus", statusBar: "status-bar" }[args?.key] ?? "panel");
  if (command === "side.pin") return icon("pin");
  if (command === "side.unpin") return icon("unpin");
  if (command === "side.tab") return icon("turn-into");
  if (command.endsWith(".close")) return icon("menu-close");
  if (command.endsWith(".rename")) return icon("rename");
  if (command.endsWith(".new")) return icon("plus");
  if (command === "worktree") return icon("worktree");
  if (command === "app.help") return icon("keyboard");
  if (command === "app.theme") return icon("theme");
  return icon("plus");
}

// A pane's internal link, the same form Notepad mentions use: "[name](herdr:agent/<terminal address>)" for a
// terminal or agent (an agent resolves it with `hc read|get|send <address>`), "[name](herdr:pane/<pane id>)" for
// any other pane. Pasted into the Notepad it becomes a mention badge.
function copyLink({ pane, terminal }) {
  const p = panes().find((x) => x.pane === pane);
  const term = terminal && terminals().find((x) => x.address === terminal);
  const label = (term?.name || p?.title || terminal || pane || "panel").replace(/[\\\]]/g, "\\$&");
  copyText(terminal ? `[${label}](herdr:agent/${terminal})` : `[${label}](herdr:pane/${pane})`);
}

// A tab's link, as Notepad tab mentions: "[Space › Tab](herdr:tab/<tab id>)".
function copyTabLink({ id, space }) {
  const sp = spaces().find((s) => s.id === space) ?? spaces().find((s) => (s.tabs ?? []).some((t) => t.id === id));
  const tabs = sp?.tabs ?? [];
  const tab = tabs.find((t) => t.id === id);
  const label = `${sp?.name ?? "Space"} › ${tab?.name || String(tabs.indexOf(tab) + 1)}`.replace(/[\\\]]/g, "\\$&");
  copyText(`[${label}](herdr:tab/${id})`);
}

// The key bound to a command, for the hint on the right.
function shortcut(name, args) {
  // `pane.split:right` binds pane.split with { direction: "right" }.
  const value = args && Object.values(args)[0];
  const k = keys().find((b) => b.section === "global" && (b.action === name || b.action === `${name}:${value}`));
  return k ? keysym(Array.isArray(k.keys) ? k.keys[0] : k.keys) : "";
}

// A hairline sits before some items, which groups them.
const breaksBefore = (list, i) => i > 0 && ((list[i][1] === "sidebar.toggle" && list[i - 1][1] === "sidebar.collapse") || list[i][1].endsWith(".close") || list[i][1] === "app.help" || list[i][1] === "terminal.right_click" || list[i][1] === "copy-link" || list[i][1] === "tab.rename" || (list[i][1] === "app.theme" && list[i - 1][1] !== "app.theme"));

export default class Menu {
  init(_props, cx) {
    this.at = 0;
    this.git = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    const p = props();
    const space = p?.tab === "space" && spaces().find((s) => s.id === p.target?.id);
    const folder = space && place(space);
    if (folder)
      cx.spawn(async (cx) => {
        this.git = await checkout(folder, space.machine).catch(() => null);
        cx.notify();
      });
  }

  choose(i, cx) {
    const it = items(props(), this.git)[i];
    if (!it) return;
    // A switch flips in place and the menu stays open; the last list on can't be switched off (the click does nothing).
    if (it[1] === "sidebar.toggle") { toggleFromClick(it[2].key); return cx?.notify?.(); }
    if (it[1] === "sidebar.collapse") { closeOverlay(props()?.overlay); return toggleSidebar(); }
    closeOverlay(props()?.overlay);
    if (it[1] === "worktree") openOverlay({ mod: "worktree", kind: "dialog", ...(it[2].action === "open" ? { width: 560, height: 480 } : { width: 440, height: 260 }), props: it[2] });
    // Splits open their new pane as the New panel; Turn into opens one beside the pane, which replaces it.
    else if (it[1] === "pane.split") run("pane.split", { ...it[2], mod: SELF, props: { role: "new-panel", direction: it[2].direction } });
    else if (it[1].startsWith("side.")) runSideAction(it[1], it[2]);
    else if (it[1] === "copy-link") copyLink(it[2]);
    else if (it[1] === "copy-tab-link") copyTabLink(it[2]);
    else if (it[1] === "turn-into") run("pane.split", { direction: "right", pane: it[2].pane, mod: SELF, props: { role: "new-panel", direction: "right", replace: it[2].pane } });
    else run(it[1], it[2]);
  }

  render(cx) {
    const t = theme();
    const list = items(props(), this.git);
    if (this.at >= list.length) this.at = 0;
    const breaks = list.filter((_, i) => breaksBefore(list, i)).length;
    const label = props()?.tab === "sidebar" ? "Show" : null;   // the + menu's small group label, for the toggles menu
    // Same look as the + menu: 32px rows, 16px line icon, name, faint shortcut; one highlight that follows
    // the pointer and the arrow keys; hairlines between groups. The root states its height (a popup has none of its own).
    return v_flex()
      .id("menu")
      .track_focus(this.handle)
      .w_full()
      .h(menuHeight(list.length, breaks) + (label ? LABEL_H : 0))
      .p(4)
      .bg(t.popover)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") this.choose(this.at, cx);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .children(
        list.map((it, i) =>
          v_flex()
            .when(breaksBefore(list, i), (el) => el.child(div().mx(-4).my(4).h(1).bg(t.border)))
            .when(Boolean(label) && it[1] === "sidebar.toggle" && list[i - 1]?.[1] !== "sidebar.toggle", (el) => el.child(groupLabel(t, label)))
            .child(menuRow({
              t, id: `mi-${i}`,
              icon: svg(menuIcon(it[1], it[2])).size(16), name: it[0], active: i === this.at,
              // A toggle shows its state as a check on the right, where other menus show a shortcut.
              hint: it[1] === "sidebar.collapse" ? shortcut(`${SELF}.toggle-sidebar`) : it[1] === "sidebar.toggle" ? toggleSwitch(t, sections()[it[2].key], sectionLocked(sections(), it[2].key)) : shortcut(it[1], it[2]),
              onClick: (_e, cx) => this.choose(i, cx),
              onHover: (cx) => { if (this.at !== i) { this.at = i; cx.notify(); } },
            }))),
      );
  }
}
