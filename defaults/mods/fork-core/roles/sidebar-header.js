// Role "sidebar-header": the sidebar's top bar (replaces workspace-chrome's brand row). Herdr mark and name, then
// search, settings, sidebar toggle (Ethan 2026-11-03: "place a settings icon to the left of the sidebar button, same
// style as search and sidebar buttons"). Always shown, so it also re-applies the saved sidebar sections at start.
import { div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, window, shared, setShared, layout, updates } from "herdr";
import { icon } from "../self.js";
import { applySections, openSectionsMenu } from "./sections.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) { const f = find(child, id); if (f) return f; }
  return null;
}
// The collapsed rail is one width, the sidebar's minimum (Ethan: "lock it to the minimum width, the whole rail").
const RAIL_PX = 44;
const OPEN_MIN = 200;     // the open sidebar's minimum width
const COLLAPSE_AT = 120;  // dragged narrower than this, it closes to the rail
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;
// Stock's toggle: to the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? Math.max(OPEN_MIN, shared("sidebar.width") ?? 268) : RAIL_PX });
}

export default class SidebarHeader {
  init(_p, cx) {
    applySections();
    // A rail left at another width (older toggles used 44 off macOS) snaps to the one rail width.
    const px = find(layout(), "sidebar")?.size?.px;
    if (narrow() && px !== RAIL_PX) run("layout.resize", { id: "sidebar", px: RAIL_PX });
    // Two widths only: the rail, or the wide sidebar. Anything wider than the rail but short of the wide minimum
    // snaps straight to the wide version (Ethan: "any wider and it should instantly snap back to the wide version").
    // Dragging the edge: under COLLAPSE_AT snaps to the rail, between that and OPEN_MIN snaps to OPEN_MIN (the open
    // sidebar's minimum, Ethan: "it needs a minimum width too when open for the breakpoint").
    cx.timer.every(100, () => {
      const w = find(layout(), "sidebar")?.size?.px;
      if (!(w > RAIL_PX) || w >= OPEN_MIN) return;
      if (w < COLLAPSE_AT) { setShared("sidebar.collapsed", true); run("layout.resize", { id: "sidebar", px: RAIL_PX }); }
      else { setShared("sidebar.collapsed", false); run("layout.resize", { id: "sidebar", px: OPEN_MIN }); }
    });
    cx.timer.after(2000, () => { applySections(); });
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
    if (collapsed) return h_flex().size_full().bg(t.chrome).items_center().justify_center().on_mouse_down("right", () => openSectionsMenu())
      .when(!mac || window()?.fullscreen, (el) => el.child(this.button(t, "sidebar-toggle", "sidebar", toggleSidebar).tooltip("Expand sidebar")));
    return h_flex().size_full().bg(t.chrome).pl(14).pr(10).gap(4).items_center().text_size(13.5)
      .on_mouse_down("right", () => openSectionsMenu())
      .when(mac && !window()?.fullscreen, (el) => el.pl(76))
      .child(h_flex().flex_1().gap(8).items_center().child(image("frame/welcome/herdr.png").size(20).rounded(5)).child(div().font_semibold().text_color(t.foreground).child("Herdr")))
      .child(this.button(t, "search", "search", () => run("mod.open", { name: "picker" })))
      .child(this.button(t, "settings", "settings", () => run("app.settings"), updates()?.app?.ready))
      .child(this.button(t, "sidebar-toggle", "sidebar", toggleSidebar));
  }
}
