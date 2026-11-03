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
  // Same look as the Notepad / menu: one label, 32px rows with a 16px icon, name and faint number key; one
  // highlight that follows the pointer and the arrow keys; "Tools" and "Agents" labels for the two groups.
  render() {
    const t = theme();
    const list = this.choices();
    if (this.at >= list.length) this.at = 0;
    const builtIn = 3;   // Terminal, Browser, Notepad
    const label = (text) => div().px(8).pt(4).pb(6).text_size(12).font_weight(500).text_color(t.dim).child(text);
    const rows = [label("Tools")];
    list.forEach(([id, icon, name, extra], i) => {
      if (i === builtIn) rows.push(div().h(8), label("Agents"));   // labels alone separate the groups
      rows.push(h_flex().id(`sc-${id}`).h(32).px(8).gap(10).rounded(6).items_center().flex_none().cursor_pointer()
        .when(i === this.at, (el) => el.bg(t.hover))
        .on_hover((h, cx) => { if (h && this.at !== i) { this.at = i; cx.notify(); } })
        .on_click(() => this.pick(extra))
        .child(div().size(16).flex_none().flex().items_center().justify_center().text_color(i === this.at ? t.foreground : t.muted).child(icon))
        .child(div().flex_1().min_w(0).truncate().text_size(14).text_color(t.foreground).child(name))
        .child(div().flex_none().text_size(12).text_color(t.dim).child(i < 9 ? String(i + 1) : "")));
    });
    return v_flex().id("fork-split-chooser").track_focus(this.handle).size_full().bg(t.background).items_center().justify_center().p(16)
      .font_family(".SystemUIFont")
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
      // No card: the pane already contains it (Ethan); the / and right-click menus keep theirs, they're popovers.
      .child(v_flex().w_full().max_w(300).p(4)
        .children(rows));
  }
}
