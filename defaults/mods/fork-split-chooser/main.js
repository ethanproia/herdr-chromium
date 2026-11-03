// The chooser a split opens in its new, empty pane: Terminal, Browser, Notepad, the installed agents.
// Picking one splits this pane with it and closes this pane, so it takes this pane's place.
// Props: { direction, replace? } (replace: an existing pane to turn into the pick, closed too).
// ↑/↓ move, Enter or 1-9 pick, Esc closes this pane.
import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, spaces, panes, knownAgents, run, props } from "herdr";

export default class SplitChooser extends View {
  init(_p, cx) {
    this.agents = [];
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      try { this.agents = await knownAgents({ on: spaces().find(s => s.active)?.machine }); } catch {}
      cx.notify();
    });
  }
  // This pane: the app's pane id if given, else the focused chooser in the shown tab.
  me() {
    const own = props()?.pane;
    if (own) return own;
    const mine = panes().filter(p => p.mod === "fork-split-chooser");
    return (mine.find(p => p.focused) ?? (mine.length === 1 ? mine[0] : null))?.pane;
  }
  // More kinds go here: each is [id, icon, name, split args].
  choices() {
    const t = theme();
    return [
      ["terminal", svg("icons/shell.svg").size(16), "Terminal", {}],
      ["browser", svg("mods/browser/globe.svg").size(16), "Browser", { mod: "browser", props: { id: `b${Date.now().toString(36)}` } }],
      ["fork-notepad", svg("mods/fork-notepad/note.svg").size(16), "Notepad", { mod: "fork-notepad" }],
      ...this.agents.filter(a => a.installed).map(a =>
        [a.key, a.tint ? svg(a.icon).size(16).text_color(t.foreground) : image(a.icon).size(16), a.name, { argv: a.run }]),
    ];
  }
  pick(extra) {
    const pane = this.me();
    if (!pane) return;
    const { direction = "right", replace } = props() ?? {};
    run("pane.split", { direction, pane, ...extra });
    run("pane.close", { pane });
    if (replace) run("pane.close", { pane: replace });
  }
  dismiss() {
    const pane = this.me();
    if (pane) run("pane.close", { pane });
  }
  render() {
    const t = theme();
    const list = this.choices();
    if (this.at >= list.length) this.at = 0;
    return v_flex().id("fork-split-chooser").track_focus(this.handle).size_full().bg(t.background).items_center().justify_center().p(16)
      .on_mouse_down("left", () => this.handle.focus())
      .on_key_down((e, cx) => {
        const n = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") return this.pick(list[this.at][3]);
        else if (n >= 0 && n < list.length) return this.pick(list[n][3]);
        else if (e.key === "escape") return this.dismiss();
        else return;
        cx.notify();
      })
      .child(v_flex().w_full().max_w(320).gap(2).text_size(13)
        .child(div().px(10).pb(8).text_size(12).text_color(t.dim).child(props()?.replace ? "Turn this pane into" : "Open in this pane"))
        .children(list.map(([id, icon, name, extra], i) =>
          h_flex().id(`sc-${id}`).h(34).px(10).gap(10).rounded(7).items_center().flex_none().text_color(t.foreground)
            .when(i === this.at, el => el.bg(t.selected))
            .hover(s => s.bg(t.hover))
            .on_click(() => this.pick(extra))
            .child(icon).child(div().flex_1().child(name))
            .child(div().text_size(11).text_color(t.dim).child(i < 9 ? String(i + 1) : ""))))
        .child(div().px(10).pt(10).text_size(11).text_color(t.dim).child("↑↓ move · Enter or 1–9 pick · Esc close")));
  }
}
