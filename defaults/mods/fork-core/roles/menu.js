// Role "menu": right-click menus (replaces the old menu-browser). Opened as a popup with
// props { role: "menu", tab: "pane" | "tab" | "space" | "side" | "global", target }; Herdr's terminal_menu passes { tab, target } too.
// ↑/↓ move, Enter runs, Esc closes. An item is [label, command, args]; a command "worktree" opens the worktree dialog.
import { div, svg } from "gpui-kit";
import { v_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, agents, exec, shared, setShared } from "herdr";
import { SELF } from "../self.js";
import { icon, menuRow, keysym, copyText, groupLabel, openInTab } from "../look.js";
import { menuHeight } from "../pure.js";
import { sectionLocked } from "../sections-pure.js";
import { escapeLabel, tabLeaf } from "../labels.js";
import { sideMenuItems, runSideAction } from "./side-strip.js";
import { sections, toggleFromClick, toggleSidebar, isCollapsed } from "./sections.js";
import { inboxSnapshot } from "../notes.js";
import { bellMenuItems } from "../inbox-pure.js";

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
        ["Split Right", "pane.split", { direction: "right", pane: tg.pane }],
        ["Split Down", "pane.split", { direction: "down", pane: tg.pane }],
        ["Copy Link to Panel", "copy-link", { pane: tg.pane, terminal: tg.terminal }],
        ["Zoom", "pane.zoom", { pane: tg.pane }],
        ...(term
          ? [
              toProgram
                ? ["Use Herdr Right-Click Menu", "terminal.right_click", { terminal: term.address, to: "menu" }]
                : ["Send Right-Clicks to Pane", "terminal.right_click", { terminal: term.address, to: "program" }],
            ]
          : []),
        ...(parent ? [[`Send Back to ${parent.name || parent.address}`, "terminal.park", { terminal: term.address }]] : []),
        ["Close Pane", "pane.close", { pane: tg.pane }],
      ];
    }
    case "tabbar": {
      // Right-click on the tab bar's empty space: a new tab, the + menu's tools, the side-panel tools as pin checks
      // (pinned ones show at the top right), and renaming the space.
      const reg = shared("core.registry"), tools = Array.isArray(reg?.tools) ? reg.tools : [];
      const tabTools = tools.filter((x) => (x.places ?? []).includes("tab") && x.id !== "terminal");
      const sideTools = tools.filter((x) => (x.places ?? []).includes("side"));
      return [
        ["New Tab", "tab.new", { space: tg.space }],
        ...tabTools.map((x) => [x.name, "tool.open", { id: x.id, icon: x.icon }]),
        ...sideTools.map((x) => [x.name, "panel.pin", { tool: x.id, icon: x.icon }]),
        ["Rename Space…", "space.rename", { id: tg.space }],
      ];
    }
    case "tab":
      return [
        // Splits act on the tab's focused pane (else its first).
        ...((() => { const ps = panes().filter((x) => x.tab === tg.id); const pn = (ps.find((x) => x.focused) ?? ps[0])?.pane;
          return pn ? [["Split Right", "pane.split", { direction: "right", pane: pn }], ["Split Down", "pane.split", { direction: "down", pane: pn }]] : []; })()),
        ["Rename", "tab.rename", { id: tg.id }],
        ["New Tab", "tab.new", { space: tg.space }],
        ["Copy Link to Tab", "copy-tab-link", { id: tg.id, space: tg.space }],
        ["Close", "tab.close", { id: tg.id }],
      ];
    case "space": {
      // Move up / down stay inside the space's machine (Herdr's own rule); space.move takes a 1-based index.
      const all = spaces();
      const at = all.findIndex((s) => s.id === tg.id);
      const mine = all[at]?.machine ?? null;
      const up = at > 0 && (all[at - 1].machine ?? null) === mine;
      const down = at >= 0 && at < all.length - 1 && (all[at + 1].machine ?? null) === mine;
      return [
        ["Open", "space.select", { id: tg.id }],
        ["Rename…", "space.rename", { id: tg.id }],
        ["Change Color…", "space.color-menu", { id: tg.id }],
        ["New Tab Here", "tab.new", { space: tg.id }],
        ["Copy Link to Space", "copy-space-link", { id: tg.id }],
        ...(up ? [["Move Up", "space.move", { id: tg.id, index: at }]] : []),
        ...(down ? [["Move Down", "space.move", { id: tg.id, index: at + 2 }]] : []),
        ...(git ? [["New Worktree", "worktree", { space: tg.id, action: "new" }], ["Open Worktree", "worktree", { space: tg.id, action: "open" }]] : []),
        ...(git === "linked" ? [["Remove Worktree", "worktree", { space: tg.id, action: "remove" }]] : []),
        ["Close Space…", "space.close", { id: tg.id }],
      ];
    }
    case "space-color":
      // The six avatar colors the Spaces list uses; the current one is checked.
      return Object.keys(SPACE_COLORS).map((c) => [SPACE_COLORS[c][0], "space.color", { id: tg.id, color: c }]);
    case "agent": {
      // Right-click on an agent row (Agents list, expanded or rail). Close only for an agent that is not working or blocked.
      const a = agents().find((x) => x.address === tg.terminal);
      const quiet = a && a.status !== "working" && a.status !== "blocked";
      return [
        ["Focus", "pane.focus", { pane: a?.pane ?? tg.pane }],
        ["Copy Link to Agent", "copy-link", { terminal: tg.terminal }],
        ["Rename…", "tab.rename", { id: a?.tab ?? tg.tab }],
        a?.pinned ? ["Unpin", "terminal.pin", { terminal: tg.terminal, pinned: false }] : ["Pin to Top", "terminal.pin", { terminal: tg.terminal, pinned: true }],
        ...(quiet ? [["Close…", "agent.close", { terminal: tg.terminal }]] : []),
      ];
    }
    case "machine": {
      // Right-click on a machine heading in the Spaces list: tg = { key (fold key), machine (name | null | absent), online }.
      // An offline machine keeps New Space as a disabled row (a 4th item field of false), same size; hosts have none.
      const folded = (shared("machines.folded") ?? []).includes(tg.key);
      return [
        ...(tg.machine !== undefined ? [["New Space", "space.new", tg.machine ? { machine: tg.machine } : {}, tg.online !== false]] : []),
        [folded ? "Expand" : "Collapse", "machine.fold", { key: tg.key }],
      ];
    }
    case "inbox":
      // Right-click on the notification bell: Mark All Read, Do Not Disturb (a check), Clear All.
      return bellMenuItems(inboxSnapshot());
    case "side":
      // A side panel strip tab: Pin / Unpin, Open as tab, Close.
      return sideMenuItems(tg);
    case "sidebar":
      // Checkable toggles for the left sidebar's sections.
      return [[isCollapsed() ? "Expand Sidebar" : "Collapse Sidebar", "sidebar.collapse", {}], ["Spaces", "sidebar.toggle", { key: "spaces" }], ["Agents", "sidebar.toggle", { key: "agents" }], ["Status Bar", "sidebar.toggle", { key: "statusBar" }], ["Add Machine…", "machine.add", {}]]   // an action, not a switch (Ethan: "add machine here should not be a toggle");
    default:
      return [
        ["New Space", "space.new", {}],
        ["Keybinds", "app.help", {}],
        ["Theme: Graphite", "app.theme", { name: "graphite" }],
        ["Theme: Ink", "app.theme", { name: "ink" }],
        ["Theme: Moss", "app.theme", { name: "moss" }],
        ["Theme: Atom One Dark", "app.theme", { name: "atom-one-dark" }],
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

// The Spaces list's avatar colors (same hexes as spaces-browser's MARK).
const SPACE_COLORS = { ansi6: ["Teal", "#22a99a"], ansi3: ["Orange", "#e3814f"], ansi4: ["Blue", "#5b8def"], ansi5: ["Violet", "#8b7cf6"], ansi2: ["Green", "#3fae6a"], ansi1: ["Pink", "#d9649a"] };

// The height of a groupLabel (6 top + 12 text + 6 bottom, as the + menu counts it).
export const LABEL_H = 30;

function menuIcon(command, args) {
  if (command === "pane.split") return icon(args?.direction === "down" ? "split-down" : "split-right");
  if (command === "pane.zoom") return icon("zoom");
  if (command === "copy-link" || command === "copy-tab-link" || command === "copy-space-link") return icon("link");
  if (command === "space.select" || command === "pane.focus") return icon("spaces");
  if (command === "space.color-menu") return icon("theme");
  if (command === "terminal.pin") return icon(args?.pinned ? "pin" : "unpin");
  if (command === "machine.fold") return icon("sidebar");
  if (command === "space.move") return icon("send-back");
  if (command === "terminal.right_click") return icon("mouse");
  if (command === "terminal.park") return icon("send-back");
  if (command === "sidebar.collapse") return icon("sidebar");
  if (command === "machine.add") return icon("plus");
  if (command === "sidebar.toggle") return icon({ spaces: "spaces", agents: "agents", addMachine: "plus", statusBar: "status-bar" }[args?.key] ?? "panel");
  if (command === "tool.open" || command === "panel.pin") return args?.icon ?? icon("panel");
  if (command === "side.pin") return icon("pin");
  if (command === "side.unpin") return icon("unpin");
  if (command === "side.tab") return icon("turn-into");
  if (command.endsWith(".close")) return icon("menu-close");
  if (command.endsWith(".rename")) return icon("rename");
  if (command.endsWith(".new")) return icon("plus");
  if (command === "worktree") return icon("worktree");
  if (command === "app.help") return icon("keyboard");
  if (command === "app.theme") return icon("theme");
  if (command === "notifications.read_all") return icon("check-check");
  if (command === "notifications.toggle_dnd") return icon("bell-off");
  if (command === "notifications.clear_all") return icon("trash");
  return icon("plus");
}

// A pane's internal link, the same form Notepad mentions use: "[name](herdr:agent/<terminal address>)" for a
// terminal or agent (an agent resolves it with `hc read|get|send <address>`), "[name](herdr:pane/<pane id>)" for
// any other pane. Pasted into the Notepad it becomes a mention badge.
function copyLink({ pane, terminal }) {
  const p = panes().find((x) => x.pane === pane);
  const term = terminal && terminals().find((x) => x.address === terminal);
  const label = escapeLabel(term?.name || p?.title || terminal || pane || "panel");
  copyText(terminal ? `[${label}](herdr:agent/${terminal})` : `[${label}](herdr:pane/${pane})`);
}

// A tab's link, as Notepad tab mentions: "[Space › Tab](herdr:tab/<tab id>)".
function copyTabLink({ id, space }) {
  const sp = spaces().find((s) => s.id === space) ?? spaces().find((s) => (s.tabs ?? []).some((t) => t.id === id));
  const label = escapeLabel(`${sp?.name ?? "Space"} › ${tabLeaf(sp?.tabs, id)}`);
  copyText(`[${label}](herdr:tab/${id})`);
}

// A space's link: "[name](herdr:space/<space id>)".
function copySpaceLink({ id }) {
  const label = (spaces().find((s) => s.id === id)?.name ?? "Space").replace(/[\\\]]/g, "\\$&");
  copyText(`[${label}](herdr:space/${id})`);
}

// The key bound to a command, for the hint on the right.
function shortcut(name, args) {
  // `pane.split:right` binds pane.split with { direction: "right" }.
  const value = args && Object.values(args)[0];
  const k = keys().find((b) => b.section === "global" && (b.action === name || b.action === `${name}:${value}`));
  return k ? keysym(Array.isArray(k.keys) ? k.keys[0] : k.keys) : "";
}

// A hairline sits before some items, which groups them.
// A side-panel tool is pinned when it's in shared panels.pins (pinned tools show at the top right of the tab bar).
const pinned = (id) => { const p = shared("panels.pins"); return Array.isArray(p) && p.includes(id); };
const breaksBefore = (list, i) => i > 0 && ((list[i][1] === "sidebar.toggle" && list[i - 1][1] === "sidebar.collapse") || (list[i][1] === "tool.open" && list[i - 1][1] !== "tool.open") || (list[i][1] === "panel.pin" && list[i - 1][1] !== "panel.pin") || (list[i][1] === "space.rename" && list[i - 1][1] === "panel.pin") || list[i][1] === "machine.add" || list[i][1].endsWith(".close") || list[i][1] === "app.help" || list[i][1] === "terminal.right_click" || list[i][1] === "copy-link" || (list[i][1] === "space.move" && list[i - 1][1] !== "space.move") || list[i][1] === "tab.rename" || (list[i][1] === "app.theme" && list[i - 1][1] !== "app.theme") || list[i][1] === "notifications.clear_all");

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
    if (!it || it[3] === false) return;   // a disabled row does nothing
    // A switch flips in place and the menu stays open; the last list on can't be switched off (the click does nothing).
    if (it[1] === "sidebar.toggle") { toggleFromClick(it[2].key); return cx?.notify?.(); }
    if (it[1] === "sidebar.collapse") { closeOverlay(props()?.overlay); return toggleSidebar(); }
    if (it[1] === "machine.add") { closeOverlay(props()?.overlay); return run("mod.open", { name: "machine-add" }); }
    if (it[1] === "notifications.toggle_dnd") { run(it[1], it[2]); return cx?.notify?.(); }   // a check flips in place
    if (it[1] === "panel.pin") { runSideAction(pinned(it[2].tool) ? "side.unpin" : "side.pin", { tool: it[2].tool }); return cx?.notify?.(); }   // a check flips in place
    if (it[1] === "tool.open") { closeOverlay(props()?.overlay); const tool = (shared("core.registry")?.tools ?? []).find((x) => x.id === it[2].id); return tool && openInTab(tool, spaces().find((x) => x.active)?.id); }
    closeOverlay(props()?.overlay);
    if (it[1] === "machine.fold") { const cur = shared("machines.folded") ?? []; return setShared("machines.folded", cur.includes(it[2].key) ? cur.filter((k) => k !== it[2].key) : [...cur, it[2].key]); }
    if (it[1] === "space.color") return setShared("space.colors", { ...(shared("space.colors") ?? {}), [it[2].id]: it[2].color });
    if (it[1] === "space.color-menu") return openOverlay({ mod: SELF, kind: "popup", width: 260, height: menuHeight(Object.keys(SPACE_COLORS).length, 0), props: { role: "menu", tab: "space-color", target: it[2] } });
    if (it[1] === "agent.close") {
      // Never closes a working agent: re-read its status now, then ask first.
      const a = agents().find((x) => x.address === it[2].terminal);
      if (!a || a.status === "working" || a.status === "blocked") return;
      return openOverlay({ mod: "confirm", kind: "dialog", width: 380, height: 170, props: { title: "Close agent?", detail: `${a.space_name ? `${a.space_name} · ` : ""}${a.program?.name ?? it[2].terminal} will end.`, command: { name: "terminal.kill", args: { terminal: it[2].terminal } } } });
    }
    if (it[1] === "copy-space-link") return copySpaceLink(it[2]);
    if (it[1] === "worktree") openOverlay({ mod: "worktree", kind: "dialog", ...(it[2].action === "open" ? { width: 560, height: 480 } : { width: 440, height: 260 }), props: it[2] });
    // Splits open their new pane as the New panel.
    else if (it[1] === "pane.split") run("pane.split", { ...it[2], mod: SELF, props: { role: "new-panel", direction: it[2].direction } });
    else if (it[1].startsWith("side.")) runSideAction(it[1], it[2]);
    else if (it[1] === "copy-link") copyLink(it[2]);
    else if (it[1] === "copy-tab-link") copyTabLink(it[2]);
    else run(it[1], it[2]);
  }

  render(cx) {
    const t = theme();
    const list = items(props(), this.git);
    if (this.at >= list.length) this.at = 0;
    // The highlight never rests on a disabled row (arrows step over it).
    const live = (i) => list[i]?.[3] !== false;
    if (!live(this.at)) { const k = list.findIndex((_, i) => live(i)); if (k >= 0) this.at = k; }
    const step = (d) => { for (let n = 1; n <= list.length; n++) { const k = (this.at + d * n + list.length * n) % list.length; if (live(k)) return k; } return this.at; };
    const breaks = list.filter((_, i) => breaksBefore(list, i)).length;
    const label = props()?.tab === "sidebar" ? "Show" : props()?.tab === "tabbar" ? "Pinned" : null;   // the + menu's small group label, for a toggles group
    const labelBefore = (it, prev) => (it[1] === "sidebar.toggle" && prev?.[1] !== "sidebar.toggle") || (it[1] === "panel.pin" && prev?.[1] !== "panel.pin");
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
        if (e.key === "down") this.at = step(1);
        else if (e.key === "up") this.at = step(-1);
        else if (e.key === "enter") this.choose(this.at, cx);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .children(
        list.map((it, i) =>
          v_flex()
            .when(breaksBefore(list, i), (el) => el.child(div().mx(-4).my(4).h(1).bg(t.border)))
            .when(Boolean(label) && labelBefore(it, list[i - 1]), (el) => el.child(groupLabel(t, label)))
            .child(menuRow({
              t, id: `mi-${i}`,
              // Show / hide rows (shadcn DropdownMenuCheckboxItem, no switches in menus): a clear check on the right when
              // on, the row's icon dimmed when off.
              icon: it[1] === "space.color" ? div().size(12).rounded(6).bg(SPACE_COLORS[it[2].color][1]) : svg(menuIcon(it[1], it[2])).size(15).when((it[1] === "sidebar.toggle" && !sections()[it[2].key]) || (it[1] === "panel.pin" && !pinned(it[2].tool)) || !live(i), (el) => el.text_color(t.dim)),
              name: it[0], active: i === this.at && live(i), enabled: live(i),
              // A toggle shows its state as a check on the right, where other menus show a shortcut.
              hint: it[1] === "notifications.toggle_dnd" ? (inboxSnapshot()?.settings?.dnd ? svg(icon("check")).size(14).text_color(t.foreground) : "") : it[1] === "panel.pin" ? (pinned(it[2].tool) ? svg(icon("check")).size(14).text_color(t.foreground) : "") : it[1] === "space.color" ? (((shared("space.colors") ?? {})[it[2].id] ?? "ansi6") === it[2].color ? svg(icon("check")).size(14).text_color(t.foreground) : "") : it[1] === "sidebar.collapse" ? shortcut(`${SELF}.toggle-sidebar`) : it[1] === "sidebar.toggle" ? (sections()[it[2].key] ? svg(icon("check")).size(14).text_color(t.foreground).when(sectionLocked(sections(), it[2].key), (el) => el.tooltip("At least one list stays on")) : "") : shortcut(it[1], it[2]),
              onClick: (_e, cx) => this.choose(i, cx),
              onHover: (cx) => { if (this.at !== i) { this.at = i; cx.notify(); } },
            }))),
      );
  }
}
