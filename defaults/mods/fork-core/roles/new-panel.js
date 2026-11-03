// Role "new-panel": the chooser a split opens in its new, empty pane (replaces the old split-chooser): the tools
// that can open in a split (from the registry), then the installed agents. Picking one splits this pane with it and,
// once the new pane really exists, closes this pane. If it never appears
// within 2 s nothing is closed and an error shows. Props: { role: "new-panel", direction }.
// ↑/↓ move, Enter or 1-9 pick, Esc closes this pane.
import { div, svg, image } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme, spaces, panes, knownAgents, run, props, notify } from "herdr";
import { SELF } from "../self.js";
import { groupLabel, menuRow, toolIcon, openInSplit, openRegistry, keepSelection, registryNotice } from "../look.js";
import { toolsFor } from "../registry.js";

export default class NewPanel {
  init(_p, cx) {
    this.agents = [];
    this.at = 0;
    this.busy = false;
    this.error = "";
    this.reg = openRegistry();
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      try { this.agents = await knownAgents({ on: spaces().find((s) => s.active)?.machine }); } catch {}
      cx.notify();
    });
    cx.spawn(async (cx) => { if (await this.reg.refresh()) cx.notify(); });
  }

  // This pane: the app's pane id if given, else the focused New panel in the shown tab.
  me() {
    const own = props()?.pane;
    if (own) return own;
    const mine = panes().filter((p) => p.mod === SELF);
    return (mine.find((p) => p.focused) ?? (mine.length === 1 ? mine[0] : null))?.pane;
  }

  // Each choice is [id, icon, name, start(direction, pane), isMine(newPane)].
  choices() {
    const t = theme();
    return [
      ...toolsFor(this.reg.tools, "split").map((tool) => [`tool-${tool.id}`, toolIcon(tool), tool.name, (d, pane) => openInSplit(tool, d, pane),
        tool.open.mod ? (p) => p.mod === tool.open.mod : tool.open.terminal ? (p) => p.terminal != null : () => true]),
      ...this.agents.filter((a) => a.installed).map((a) =>
        [`agent-${a.key}`, a.tint ? svg(a.icon).size(16).text_color(t.foreground) : image(a.icon).size(16), a.name, (d, pane) => run("pane.split", { direction: d, pane, argv: a.run }), (p) => p.terminal != null]),
    ];
  }

  // Never destroy first: split, wait until the new pane shows up in panes(), then close this one.
  pick(choice, cx) {
    const pane = this.me();
    if (!pane || this.busy) return;
    const { direction = "right" } = props() ?? {};
    const before = new Set(panes().map((p) => p.pane));
    const tab = panes().find((p) => p.pane === pane)?.tab;
    // Only a pane this request made counts: new, in this tab, and of the kind chosen.
    const mine = (p) => !before.has(p.pane) && p.tab === tab && choice[4](p);
    this.busy = true; this.error = "";
    choice[3](direction, pane);
    const deadline = Date.now() + 2000;
    const tick = (cx) => {
      if (panes().some(mine)) {
        run("pane.close", { pane });
        return;
      }
      if (Date.now() >= deadline) {
        this.busy = false;
        this.error = `Couldn't open ${choice[2]}`;
        notify({ title: this.error, body: "Nothing was closed.", level: "error", timeout: 3000 });
        cx.notify();
        return;
      }
      cx.timer.after(80, tick);
    };
    cx.timer.after(80, tick);
  }

  dismiss() {
    const pane = this.me();
    if (pane) run("pane.close", { pane });
  }

  // Same look as the + menu: one label, 32px rows with a 16px icon, name and faint number key; one highlight that
  // follows the pointer and the arrow keys; "Tools" and "Agents" labels for the two groups.
  render() {
    const t = theme();
    const list = this.choices();
    keepSelection(this, list.map((c) => c[0]));
    if (this.at >= list.length) this.at = 0;
    const builtIn = list.filter((c) => c[0].startsWith("tool-")).length;
    const rows = [groupLabel(t, "Tools", 4)];
    list.forEach((c, i) => {
      if (i === builtIn) rows.push(div().h(8), groupLabel(t, "Agents", 4));   // labels alone separate the groups
      rows.push(menuRow({
        t, id: `sc-${c[0]}`, icon: c[1], name: c[2], hint: i < 9 ? String(i + 1) : "", active: i === this.at,
        onClick: (_e, cx) => this.pick(c, cx),
        onHover: (cx) => { if (this.at !== i) { this.at = i; cx.notify(); } },
      }));
    });
    const note = registryNotice(this.reg);
    if (this.error) rows.push(div().px(8).pt(8).text_size(12).text_color(t.blocked).child(this.error));
    if (note) rows.push(div().px(8).pt(8).truncate().text_size(11).text_color(t.dim).child(note));
    return v_flex().id("new-panel").track_focus(this.handle).size_full().bg(t.background).items_center().justify_center().p(16)
      .font_family(".SystemUIFont")
      .on_mouse_down("left", () => this.handle.focus())
      .on_key_down((e, cx) => {
        const n = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
        if (!list.length && (e.key === "down" || e.key === "up")) return;
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") return list[this.at] && this.pick(list[this.at], cx);
        else if (n >= 0 && n < list.length) return this.pick(list[n], cx);
        else if (e.key === "escape") return this.dismiss();
        else return;
        cx.notify();
      })
      // No card: the pane already contains it; the / and right-click menus keep theirs, they're popovers.
      .child(v_flex().w_full().max_w(300).p(4).children(rows));
  }
}
