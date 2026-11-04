// Role "sidebar-footer": the bottom of the left sidebar (replaces workspace-chrome's footer). Settings, and
// "Add Machine" only when switched on in the sidebar's right-click menu (shared "sidebar.sections".addMachine,
// default off: Ethan 2026-11-03 "please also hide the new machine button in the bottom left").
import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, shared, settings } from "herdr";
import { icon } from "../self.js";
import { copyText } from "../look.js";
import { appVersion } from "../app-info.js";
import { narrow, openSectionsMenu } from "./sections.js";
// With the fork's "glass" setting the sidebar's layout background draws translucent over a blurred window; painting
// our own opaque chrome here would hide it, so sidebar roots leave the background to the layout then.
const glassOn = () => settings()?.glass === true;


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
      return v_flex().size_full().when(!glassOn(), (el) => el.bg(t.chrome)).items_center().pt(9).gap(4)   // no top border in the rail: no stray hairline
        .on_mouse_down("right", () => openSectionsMenu())
        .when(showAddMachine(), (el) => el.child(ctl("rail-machine", "plus", "Add Machine", () => run("mod.open", { name: "machine-add" }))))
        .child(ctl("rail-search", "search", "Search", () => run("mod.open", { name: "picker" })))
        .child(ctl("rail-settings", "settings", "Settings", () => run("app.settings")));
    }
    // Fork only: one dim version line at the very bottom (hover = full line, click = copy it). Stock: no appInfo, no line.
    const ver = appVersion();
    return v_flex().size_full().when(!glassOn(), (el) => el.bg(t.chrome)).border_t(1).border_color(t.border).p(8).text_size(13)
      .on_mouse_down("right", () => openSectionsMenu())
      .when(showAddMachine(), (el) => el.child(row("machine", icon("plus"), "Add Machine", true, () => run("mod.open", { name: "machine-add" }))))
      .when(Boolean(ver), (el) => el.child(div().id("app-version").h(20).px(8).flex().items_center().text_size(11).text_color(t.dim)
        .truncate().cursor_pointer().hover((s) => s.text_color(t.muted)).tooltip(ver.full)
        .on_click(() => copyText(ver.full, "Version copied")).child(ver.short)));
  }
}
