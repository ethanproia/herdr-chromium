// Role "plus": the + menu (replaces the old new-menu-browser). Three labelled groups: Tools (from the registry),
// Agents (from knownAgents()), Workspace (hard-coded). 32px rows, one highlight that follows the pointer and the arrows.
import { div, svg, image } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme, spaces, panes, knownAgents, run, openOverlay, closeOverlay, props, window } from "herdr";
import { icon, groupLabel, menuRow, toolIcon, openInTab, openRegistry, keepSelection, registryNotice } from "../look.js";
import { toolsFor } from "../registry.js";
import { openInSide } from "./side-strip.js";
import { scroller } from "../scroll.js";

export default class Plus {
  init(_props, cx) {
    this.agents = [];
    this.at = 0;
    this.reg = openRegistry();
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      try { this.agents = await knownAgents({ on: spaces().find((s) => s.active)?.machine }); }
      catch { this.failed = true; }
      cx.notify();
    });
    cx.spawn(async (cx) => { if (await this.reg.refresh()) cx.notify(); });
  }

  // Every row: [id, icon, name, action, shortcut, enabled]; group labels sit between.
  groups() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    const mod = window()?.platform === "macos" ? "⌘" : "Ctrl+";
    const folder = panes().find((p) => p.focused)?.cwd;
    const installed = this.agents.filter((a) => a.installed);
    const choices = [...installed, ...this.agents.filter((a) => !a.installed).slice(0, 2)];
    const ic = (path) => svg(path).size(15);
    // Tools that open as a tab, then side-panel tools (Files, Changes), which open in the side panel.
    const tabTools = toolsFor(this.reg.tools, "tab");
    const sideOnly = toolsFor(this.reg.tools, "side").filter((x) => !tabTools.includes(x));
    const tools = [
      ...tabTools.map((tool) => [`tool-${tool.id}`, toolIcon(tool), tool.name, () => openInTab(tool, space?.id), tool.shortcut ? `${mod}${tool.shortcut.toUpperCase()}` : "", true]),
      ...sideOnly.map((tool) => [`tool-${tool.id}`, toolIcon(tool), tool.name, () => openInSide(tool.id, "temporary"), "", true]),
    ];
    const agents = choices.map((a, i) => [`agent-${a.key}`, a.tint ? svg(a.icon).size(15).text_color(t.foreground) : image(a.icon).size(15), a.name,
      () => run("tab.new", { name: a.name, space: space?.id, argv: a.run }), a.installed ? (i < 9 ? `${mod}${i + 1}` : "") : "not installed", a.installed]);
    const work = [
      ["space", ic(icon("plus")), "New Space", () => run("space.new"), `${mod}N`, true],
      ["worktree", ic("mods/workspace-chrome/branch.svg"), "New Worktree…", () => openOverlay({ mod: "worktree", kind: "dialog", width: 460, height: 280, props: { space: space?.id, folder, action: "new" } }), "", Boolean(space)],
      ["worktree-open", ic("mods/workspace-chrome/branch.svg"), "Open Worktree…", () => openOverlay({ mod: "worktree", kind: "dialog", width: 560, height: 480, props: { space: space?.id, folder, action: "open" } }), "", Boolean(space)],
    ];
    return [["Tools", tools], ["Agents", agents], ["Workspace", work]];
  }

  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    const groups = this.groups();
    const flat = groups.flatMap(([, rows]) => rows).filter((r) => r[5]);
    keepSelection(this, flat.map((r) => r[0]));
    if (this.at >= flat.length) this.at = 0;
    const installed = this.agents.filter((a) => a.installed);
    const toolsNow = toolsFor(this.reg.tools, "tab");
    const pick = (r) => { closeOverlay(props().overlay); r[3](); };
    // A popup has no size of its own to fill: the menu states its height (size_full / flex_1 here collapsed to 0).
    const rowsN = groups.reduce((n, [name, rows]) => n + (rows.length || (name === "Agents" ? 1 : 0)), 0);
    const note = registryNotice(this.reg);
    const H = Math.min(560, 8 + groups.length * 30 + (groups.length - 1) * 6 + rowsN * 32 + (note ? 26 : 0));
    const list = [];
    groups.forEach(([name, rows], g) => {
      if (g > 0) list.push(div().h(6));
      list.push(groupLabel(t, name));
      if (name === "Agents" && this.agents.length === 0) list.push(div().px(8).py(6).text_size(13).text_color(t.dim).child(this.failed ? "Could not load agents" : "Checking installed agents…"));
      for (const r of rows) {
        const k = flat.indexOf(r);
        list.push(menuRow({
          t, id: r[0], icon: r[1], name: r[2], hint: r[4], active: k === this.at, enabled: r[5],
          onClick: () => pick(r),
          onHover: (cx) => { if (this.at !== k) { this.at = k; cx.notify(); } },
        }));
      }
    });
    if (note) list.push(div().px(8).pt(6).h(26).flex_none().truncate().text_size(11).text_color(t.dim).child(note));
    return v_flex().id("new-menu").track_focus(this.handle).w_full().h(H).bg(t.popover).p(4).font_family(".SystemUIFont")
      .on_key_down((e, cx) => {
        if (e.key === "down" || e.key === "up") { this.at = (this.at + (e.key === "down" ? 1 : flat.length - 1)) % flat.length; return cx.notify(); }
        if (e.key === "enter") return flat[this.at] && pick(flat[this.at]);
        if (e.key === "escape") return closeOverlay(props().overlay);
        if (!e.modifiers.control && !e.modifiers.platform) return;
        const agent = /^[1-9]$/.test(e.key) ? installed[Number(e.key) - 1] : null;
        const tool = toolsNow.find((x) => x.shortcut && x.shortcut.toLowerCase() === e.key);
        if (!agent && !tool && e.key !== "n") return;
        closeOverlay(props().overlay);
        if (agent) run("tab.new", { name: agent.name, space: space?.id, argv: agent.run });
        else if (tool) openInTab(tool, space?.id);
        else run("space.new");
      })
      .child(scroller(this, "list", { id: "new-menu-list", bg: t.popover, children: list, outer: (el) => el.h(H - 8) }));
  }
}
