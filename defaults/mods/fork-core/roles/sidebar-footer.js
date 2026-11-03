// Role "sidebar-footer": the bottom of the left sidebar (replaces workspace-chrome's footer). Settings, and
// "Add machine" only when switched on in the sidebar's right-click menu (shared "sidebar.sections".addMachine,
// default off: Ethan 2026-11-03 "please also hide the new machine button in the bottom left").
import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, updates, layout, shared } from "herdr";
import { icon } from "../self.js";
import { openSectionsMenu } from "./sections.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) { const f = find(child, id); if (f) return f; }
  return null;
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;
export const showAddMachine = () => shared("sidebar.sections")?.addMachine === true;
export { footerHeight } from "../sections-pure.js";   // 1 border + 8 padding on every side + 28 per row

export default class SidebarFooter {
  init() {}
  render() {
    const t = theme();
    const collapsed = narrow();
    const row = (id, ic, label, dim, action) => h_flex().id(id).h(28).px(8).gap(9).items_center().rounded(8)
      .text_color(dim ? t.dim : t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
      .on_click(action).child(svg(ic).size(14))
      .when(!collapsed, (el) => el.child(label));
    // Settings lives in the top bar now; the footer only shows when Add machine is switched on (else it's hidden).
    // Rail: Add machine (when on), search and settings stacked as 26px icon buttons, 9px from the edges
    // (Ethan: "the settings and search should be at the bottom").
    if (collapsed) {
      const ctl = (id, ic, tip, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6)
        .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip).on_click(action).child(svg(icon(ic)).size(15));
      return v_flex().size_full().bg(t.chrome).items_center().pt(9).gap(4)   // no top border in the rail: no stray hairline
        .on_mouse_down("right", () => openSectionsMenu())
        .when(showAddMachine(), (el) => el.child(ctl("rail-machine", "plus", "Add machine", () => run("mod.open", { name: "machine-add" }))))
        .child(ctl("rail-search", "search", "Search", () => run("mod.open", { name: "picker" })))
        .child(ctl("rail-settings", "settings", "Settings", () => run("app.settings")));
    }
    return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).p(8).text_size(13)
      .on_mouse_down("right", () => openSectionsMenu())
      .when(showAddMachine(), (el) => el.child(row("machine", icon("plus"), "Add machine", true, () => run("mod.open", { name: "machine-add" }))));
  }
}
