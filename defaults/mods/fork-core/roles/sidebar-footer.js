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
    return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).p(8).text_size(13)
      .on_mouse_down("right", () => openSectionsMenu())
      .when(showAddMachine(), (el) => el.child(row("machine", icon("plus"), "Add machine", true, () => run("mod.open", { name: "machine-add" }))));
  }
}
