// Role "sidebar-header": the sidebar's top bar (replaces workspace-chrome's brand row). Herdr mark and name, then
// search, settings, sidebar toggle (Ethan 2026-11-03: "place a settings icon to the left of the sidebar button, same
// style as search and sidebar buttons"). Always shown, so it also re-applies the saved sidebar sections at start.
import { div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, window, shared, setShared, layout, updates, settings } from "herdr";
import { icon } from "../self.js";
import { applySections, openSectionsMenu, toggleSidebar, applySidebarState, isCollapsed } from "./sections.js";
// With the fork's "glass" setting the sidebar's layout background draws translucent over a blurred window; painting
// our own opaque chrome here would hide it, so sidebar roots leave the background to the layout then.
const glassOn = () => settings()?.glass === true;


function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) { const f = find(child, id); if (f) return f; }
  return null;
}
// The collapsed rail is one width, the sidebar's minimum (Ethan: "lock it to the minimum width, the whole rail").
const RAIL_PX = 44;
const OPEN_MIN = 200;     // the open sidebar's minimum width
const OPEN_MAX = 480;
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;
// The open width: the last width the sidebar had open, kept within its limits.
const openWidth = () => Math.min(OPEN_MAX, Math.max(OPEN_MIN, shared("sidebar.width") ?? 268));

export default class SidebarHeader {
  init(_p, cx) {
    // Herdr reports no size change at start, so the current state's rules are applied once here.
    applySidebarState(isCollapsed());
    applySections();
    cx.timer.after(2000, () => { applySections(); });
  }
  // The real on-screen width tells collapsed from open (it updates live; the layout file only on release). A flip
  // re-applies the sections (the footer changes role) and switches the drag rules below.
  onSize(w) {
    const c = w < 160;
    if (c !== this.wasNarrow) {
      this.wasNarrow = c; applySections(c);
      // Whoever changed the width (button, key, the rail's own button), the state's full rules follow it.
      const l = layout(), bar = find(l, "sidebar");
      if (bar && (c ? bar.max !== RAIL_PX : bar.min !== 200)) applySidebarState(c);
    }

  }
  button(t, id, ic, action, dot) {
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action)
      .child(svg(icon(ic)).size(15))
      .when(Boolean(dot), (el) => el.relative().child(div().absolute().top(4).right(4).size(5).rounded_full().bg(t.accent)));
  }
  render() {
    const t = theme();
    const collapsed = narrow();
    const mac = window()?.platform === "macos";
    // Collapsed: the sidebar button stays in this top row, centered (Ethan: "at the actual top of the rail where it was
    // before"). In a windowed macOS the traffic lights hold this row, so the rail shows it first instead.
    // Equal margin top, left and right: (44 rail - 26 button) / 2 = 9 (Ethan: "outer margin around the rail top sidebar
    // button is equidistant"); the button sits on the space tiles' center line.
    if (collapsed) return h_flex().size_full().when(!glassOn(), (el) => el.bg(t.chrome)).items_center().justify_center().on_size_change((sz) => this.onSize(sz.width)).on_mouse_down("right", () => openSectionsMenu())
      .when(!mac || window()?.fullscreen, (el) => el.child(this.button(t, "sidebar-toggle", "sidebar", toggleSidebar).tooltip("Expand sidebar")));
    return h_flex().size_full().when(!glassOn(), (el) => el.bg(t.chrome)).pl(14).pr(10).gap(4).items_center().text_size(13.5)
      .on_size_change((sz) => this.onSize(sz.width))
      .on_mouse_down("right", () => openSectionsMenu())
      .when(mac && !window()?.fullscreen, (el) => el.pl(76))
      .child(div().flex_1())   // no mark or wordmark (Ethan: "remove the herdr logo and text altogether"); buttons sit right
      .child(this.button(t, "search", "search", () => run("mod.open", { name: "picker" })))
      .child(this.button(t, "settings", "settings", () => run("app.settings"), updates()?.app?.ready))
      .child(this.button(t, "sidebar-toggle", "sidebar", toggleSidebar));
  }
}
