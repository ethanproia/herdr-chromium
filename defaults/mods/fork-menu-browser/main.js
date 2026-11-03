// Context menus (Herdr's items). Opened as a popup with
// props { tab: "pane" | "tab" | "space" | "global", target }.
// ↑/↓ move, Enter runs, Esc closes. An item is [label, command, args];
// a command "worktree" opens the worktree dialog instead.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
const KEYFONT = ".SystemUIFont";   // ⌘⇧↩ symbols, as in macOS menus
import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, exec } from "herdr";

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
        ["Turn into\u2026", "turn-into", { pane: tg.pane }],
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
        ["Rename", "tab.rename", { id: tg.id }],
        ["New tab", "tab.new", { space: tg.space }],
        ["Close", "tab.close", { id: tg.id }],
      ];
    case "space":
      return [
        ["Rename", "space.rename", { id: tg.id }],
        ...(git ? [["New worktree", "worktree", { space: tg.id, action: "new" }], ["Open worktree", "worktree", { space: tg.id, action: "open" }]] : []),
        ...(git === "linked" ? [["Remove worktree", "worktree", { space: tg.id, action: "remove" }]] : []),
        ["Close", "space.close", { id: tg.id }],
      ];
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

// One 16px line icon per item (same grid and stroke as the pane header buttons and the Notepad / menu).
function menuIcon(command, args) {
  const pb = (n) => `mods/fork-pane-browser/${n}.svg`, own = (n) => `mods/fork-menu-browser/icons/${n}.svg`;
  if (command === "pane.split") return pb(args?.direction === "down" ? "split-down" : "split-right");
  if (command === "pane.zoom") return pb("zoom");
  if (command === "turn-into") return own("turn-into");
  if (command === "terminal.right_click") return own("mouse");
  if (command === "terminal.park") return own("send-back");
  if (command.endsWith(".close")) return own("close");
  if (command.endsWith(".rename")) return own("rename");
  if (command.endsWith(".new")) return own("plus");
  if (command === "worktree") return own("worktree");
  if (command === "app.help") return own("keyboard");
  if (command === "app.theme") return own("theme");
  return own("plus");
}

// "cmd-shift-enter" -> "⌘⇧↩", as macOS menus write shortcuts.
const KEYSYM = { cmd: "⌘", shift: "⇧", alt: "⌥", ctrl: "⌃", enter: "↩", backspace: "⌫", escape: "⎋", tab: "⇥", up: "↑", down: "↓", left: "←", right: "→", space: "Space" };
function keysym(k) {
  if (!k) return "";
  const first = String(k).split(/\s+/)[0];
  return first.split("-").map((p) => KEYSYM[p] ?? (p.length === 1 ? p.toUpperCase() : p)).join("");
}

// The key bound to a command, for the hint on the right.
function shortcut(name, args) {
  // `pane.split:right` binds pane.split with { direction: "right" }.
  const value = args && Object.values(args)[0];
  const k = keys().find((b) => b.section === "global" && (b.action === name || b.action === `${name}:${value}`));
  return k ? keysym(Array.isArray(k.keys) ? k.keys[0] : k.keys) : "";
}

export default class Menu extends View {
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
    closeOverlay(props()?.overlay);
    if (it[1] === "worktree") openOverlay({ mod: "worktree", kind: "dialog", ...(it[2].action === "open" ? { width: 560, height: 480 } : { width: 440, height: 260 }), props: it[2] });
    // Splits open their new pane as a chooser; Turn into opens one beside the pane, which replaces it.
    else if (it[1] === "pane.split") run("pane.split", { ...it[2], mod: "fork-split-chooser", props: { direction: it[2].direction } });
    else if (it[1] === "turn-into") run("pane.split", { direction: "right", pane: it[2].pane, mod: "fork-split-chooser", props: { direction: "right", replace: it[2].pane } });
    else run(it[1], it[2]);
  }

  render(cx) {
    const t = theme();
    const list = items(props(), this.git);
    // Same look as the Notepad / menu: 32px rows, 16px line icon, name, faint shortcut; one highlight that follows
    // the pointer and the arrow keys; hairlines between groups.
    return v_flex()
      .id("menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
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
            .when(i > 0 && (it[1].endsWith(".close") || it[1] === "app.help" || it[1] === "terminal.right_click" || (it[1] === "app.theme" && list[i - 1][1] !== "app.theme")), (el) => el.child(div().mx(-4).my(4).h(1).bg(t.border)))
            .child(h_flex()
              .id(`mi-${i}`)
              .h(32)
              .px(8)
              .gap(10)
              .rounded(6)
              .items_center()
              .cursor_pointer()
              .when(i === this.at, (el) => el.bg(t.hover))
              .on_hover((h, cx) => { if (h && this.at !== i) { this.at = i; cx.notify(); } })
              .on_click((_e, cx) => this.choose(i, cx))
              .child(svg(menuIcon(it[1], it[2])).size(16).flex_none().text_color(i === this.at ? t.foreground : t.muted))
              .child(div().flex_1().min_w(0).truncate().text_size(14).text_color(t.foreground).child(it[0]))
              .child(div().flex_none().text_size(12).font_family(KEYFONT).text_color(t.dim).child(shortcut(it[1], it[2])))),
        ),
      );
  }
}
