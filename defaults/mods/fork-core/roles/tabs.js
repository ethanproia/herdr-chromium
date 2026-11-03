// Role "tabs": the tab strip (replaces the old tabs-browser). Tabs, + right after the last tab, the Files / Changes
// panel buttons, window buttons. Key commands: `<this folder>.split-right`, `.split-down`, `.new-browser`.
import { openInSide } from "./side-strip.js";
import { toggleSidebar } from "./sections.js";
import { div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, theme, window, shared, setShared, layout, nextCommand, settings } from "herdr";
import { SELF } from "../self.js";
import { fadeLabel, over } from "../scroll.js";
import { icon, registryIO, openInTab, openRegistry } from "../look.js";
import { createRegistry } from "../registry.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

const SIDE = (id) => `panels.side.${id}`;

export default class Tabs {
  init(_props, cx) {
    this.reg = openRegistry({ writer: true });
    cx.spawn(async (cx) => { if (await this.reg.refresh()) cx.notify(); });
    cx.spawn(async () => {
      for (;;) {
        const c = String(await nextCommand());
        const split = /^(?:.*\.)?split-(right|down)$/.exec(c);
        if (split) {
          const pane = panes().find((p) => p.focused)?.pane;
          if (pane) run("pane.split", { direction: split[1], pane, mod: SELF, props: { role: "new-panel", direction: split[1] } });
        } else if (c.endsWith("new-browser")) this.newBrowser();
        else if (c.endsWith("toggle-sidebar")) toggleSidebar();   // cmd-b: rail <-> open sidebar
      }
    });
    this.pressed = null;
    this.migratePanels();
    // The side panel is remembered per space. It is synced here, on a gentle tick, never from render().
    cx.timer.every(150, () => this.syncPanel());
    // Tools installed or removed later: re-scan every 30 s (cheap; publishes only when the list changed).
    cx.timer.every(30000, (cx) => cx.spawn(async (cx) => { if (await this.reg.refresh()) cx.notify(); }));
  }

  // A Browser tab in the current space (cmd-shift-b), through the registry's browser tool, else the plain mod.
  newBrowser() {
    const space = spaces().find((sp) => sp.active)?.id;
    const tool = this.reg.tools.find((t) => t.id === "browser" || t.id === "browser-native");
    if (tool) return openInTab(tool, space);
    run("tab.new", { name: "Browser", space, mod: "browser", props: { id: `b${Date.now().toString(36)}` } });
  }

  // Once: the old per-space choices (local storage) move to the shared keys panels.side.<space>.
  migratePanels() {
    if (shared("panels.version") === 1) return;
    try {
      const old = JSON.parse(localStorage.getItem("panels") ?? "{}");
      for (const [id, v] of Object.entries(old)) if (shared(SIDE(id)) === undefined) setShared(SIDE(id), v ?? null);
    } catch {}
    setShared("panels.version", 1);
  }

  enabledPanels() { return [...(shared("workspace.panels") ?? ["files", "changes"])]; }

  // Switching space shows that space's choice (closed if it never had one); opening or closing the panel records it.
  syncPanel() {
    const space = spaces().find((p) => p.active);
    const panel = find(layout(), "panel"), body = find(layout(), "panel-body");
    if (!space || !panel) return;
    // A space can come back to any tool in the side panel's stack (pinned tools beyond Files and Changes too).
    const enabled = (body?.children ?? []).map((c) => c.id);
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && shared(SIDE(space.id)) === undefined)) {
        const stored = shared(SIDE(space.id)) ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    const cur = shared(SIDE(space.id));
    this.last ??= {};
    if (cur === now || this.last[space.id] === now) return;   // nothing new (and never rewrite the same value every tick)
    this.last[space.id] = now;
    setShared(SIDE(space.id), now);
  }

  // Every tab has an icon: an agent's own, else the tool's (registry, by the pane's mod; the New panel is core's
  // panel icon), else the program's, else the terminal icon.
  tabIcon(c, agentPane, program, t) {
    const sized = (el) => el.size(14).flex_none();
    if (agentPane?.program?.icon) return program.tint ? sized(svg(program.icon)).text_color(t.muted) : sized(image(program.icon));
    const modPane = panes().find((p) => p.tab === c.id && p.focused && p.mod) ?? panes().find((p) => p.tab === c.id && p.mod);
    if (modPane) {
      const tool = this.reg.tools.find((x) => x.open.mod === modPane.mod);
      return sized(svg(tool?.icon ?? icon("panel"))).text_color(t.muted);
    }
    if (program?.icon) return program.tint ? sized(svg(program.icon)).text_color(t.muted) : sized(image(program.icon));
    return sized(svg(icon("shell"))).text_color(t.muted);
  }

  render(_cx) {
    const t = theme();
    const space = spaces().find((p) => p.active);
    const shown = space?.tabs ?? [];
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const item = (c, i) => {
      const agentPane = panes().find((p) => p.tab === c.id && p.focused && p.program?.agent) ?? panes().find((p) => p.tab === c.id && p.program?.agent);
      const program = agentPane?.program ?? panes().find((p) => p.tab === c.id)?.program;
      const worker = (agentPane?.title || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
      const fallback = (worker && worker !== program?.name) ? worker : program?.name ?? "Terminal";
      const name = /^tb\d+$/.test(c.name) ? fallback : c.name;
      const hot = this.hoverTab === c.id;   // tracked, not the host's :hover, so the fading name matches the chip
      const chip = hot ? t.hover : c.active ? t.raised : t.chrome;
      return h_flex().id(`tab-${c.id}`).h(29).px(10).gap(7).rounded(7).items_center().flex_none().text_size(12.8)
        .border(1).border_color(c.active ? t.border : t.chrome).bg(chip).text_color(c.active ? t.foreground : t.muted)
        .on_hover((h, cx) => { const next = h ? c.id : (this.hoverTab === c.id ? null : this.hoverTab); if (next !== this.hoverTab) { this.hoverTab = next; cx.notify(); } })
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex((x) => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", () => openOverlay({ mod: SELF, kind: "popup", width: 260, height: 220, props: { role: "menu", tab: "tab", target: { id: c.id, space: space.id } } }))
        .child(this.tabIcon(c, agentPane, program, t))
        .child(fadeLabel(this, `tabname-${c.id}`, { text: c.zoomed ? `${name} Z` : name, bg: over(t.chrome, chip), outer: (el) => el.min_w(0).max_w(170) }))
        .when(c.status === "working", (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
        .when(c.status === "blocked" || c.status === "done", (el) => el.child(div().size(6).rounded(3).bg(t[c.status])))
        .when(c.active, (el) => el.child(div().id(`close-${c.id}`).text_color(t.dim).on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child(svg(icon("close")).size(12))));
    };
    const panel = find(layout(), "panel"), body = find(layout(), "panel-body");
    const enabled = this.enabledPanels();   // always shown, as today; a tool closed in the strip comes back pinned
    const panelButton = (id, label, ico) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(`panel-${id}`).h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover((s) => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else if (!(body?.children ?? []).some((c) => c.id === id)) openInSide(id, "pinned");
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        }).child(svg(ico).size(14)).child(label);
    };
    // Stock 0.1.12's rule: in a windowed macOS (titlebar none) the window buttons sit over the layout at
    // traffic_lights; when the sidebar is narrower than them (the 44px rail), the tabs start after them.
    const root = layout(), bar = find(root, "sidebar"), w = window();
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / (settings()?.zoom || 1) - (bar?.hidden ? 0 : bar?.size?.px ?? 0))
      : 10;
    return h_flex().size_full().min_w(0).pl(lightsPadding).pr(10).gap(3).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel((e) => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      // + sits right after the last tab, as in Chrome, Figma and Paper (it scrolls with the tabs).
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().children(shown.map(item))
        .child(button("tab-new", "+", () => openOverlay({ mod: SELF, kind: "popup", width: 260, height: 575, props: { role: "plus" } }))))
      .when(enabled.includes("files"), (el) => el.child(panelButton("files", "Files", icon("file"))))
      .when(enabled.includes("changes"), (el) => el.child(panelButton("changes", "Changes", icon("changes"))))
      .when(window()?.buttons, (el) => el.child(button("minimize", "−", () => run("window.minimize")))
        .child(button("maximize", "□", () => run("window.maximize")))
        .child(button("close-window", svg(icon("close")).size(13), () => run("window.close"))));
  }
}
