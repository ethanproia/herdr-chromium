// Core: one folder, several roles, chosen by props().role (see pure.js pickRole for the fallbacks).
//   tabs         the tab strip                       replaced: tabs-browser
//   pane-header  a pane's header                      replaced: pane-browser
//   menu         right-click menus                    replaced: menu-browser
//   plus         the + menu                           replaced: new-menu-browser
//   new-panel    the chooser a split opens            replaced: split-chooser
//   side-strip   the side panel's tab strip (separate worker)
// A role is a plain class with init(props, cx), render(cx) and an optional close(cx); this View creates it once and
// delegates. Roles reach each other only through this folder's own name (SELF), never an old folder id.
import { View, div } from "gpui-kit";
import { props } from "herdr";
import { pickRole } from "./pure.js";
import Tabs from "./roles/tabs.js";
import PaneHeader from "./roles/pane-header.js";
import Menu from "./roles/menu.js";
import Plus from "./roles/plus.js";
import NewPanel from "./roles/new-panel.js";
import SideStrip from "./roles/side-strip.js";
import SidebarFooter from "./roles/sidebar-footer.js";
import Status from "./roles/status.js";
import SidebarHeader from "./roles/sidebar-header.js";

const ROLE_CLASSES = { "tabs": Tabs, "pane-header": PaneHeader, "menu": Menu, "plus": Plus, "new-panel": NewPanel, "side-strip": SideStrip, "sidebar-footer": SidebarFooter, "status": Status, "sidebar-header": SidebarHeader };

export default class Core extends View {
  init(p, cx) {
    this.name = pickRole(props() ?? p);
    const Role = this.name && ROLE_CLASSES[this.name];
    this.role = Role ? new Role() : null;
    this.role?.init(props() ?? p, cx);
  }

  render(cx) {
    return this.role ? this.role.render(cx) : div();
  }

  async close(cx) {
    await this.role?.close?.(cx);
  }
}
