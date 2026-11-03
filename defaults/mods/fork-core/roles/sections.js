// Sidebar sections: apply shared "sidebar.sections" to the layout, toggle one from a click, open the menu.
// Writes only from clicks and from the footer's one-time init, never from render.
import { run, layout, shared, setShared, openOverlay } from "herdr";
import { SELF } from "../self.js";
import { normalizeSections, toggleSection, sectionsPlan, menuHeight, SECTION_KEYS } from "../sections-pure.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) { const f = find(child, id); if (f) return f; }
  return null;
}
export const sections = () => normalizeSections(shared("sidebar.sections"));
// collapsedNow: the real on-screen state when the caller knows it (a drag updates the layout file only on release).
const layoutState = (collapsedNow) => {
  const l = layout();
  return { spacesHidden: find(l, "spaces")?.hidden === true, agentsHidden: find(l, "agents")?.hidden === true, footerPx: find(l, "sidebar-footer")?.size?.px, footerHidden: find(l, "sidebar-footer")?.hidden === true, collapsed: collapsedNow ?? (find(l, "sidebar")?.size?.px ?? Infinity) < 160,
    statusHidden: find(l, "status") ? find(l, "status").hidden === true : undefined };
};
// Issues commands only where the layout differs from the sections. Returns how many.
export function applySections(collapsedNow) {
  const l = layout();
  if (!find(l, "spaces") || !find(l, "agents") || !find(l, "sidebar-footer")) return 0;   // another layout: leave it alone
  const cmds = sectionsPlan(sections(), layoutState(collapsedNow));
  for (const [name, args] of cmds) run(name, args);
  return cmds.length;
}
// A click on a menu row.
export function toggleFromClick(key) {
  const next = toggleSection(shared("sidebar.sections"), key);
  if (!next) return;
  setShared("sidebar.sections", next);
  applySections();
}
export const openSectionsMenu = () =>
  openOverlay({ mod: SELF, kind: "popup", width: 260, height: menuHeight(SECTION_KEYS.length + 1, 1) + 30 /* collapse row, hairline, "Show" label */, props: { role: "menu", tab: "sidebar" } });

// The sidebar's one switch between its two states, used by the top-bar button, the right-click menu and the key
// (<core>.toggle-sidebar, cmd-b). Open -> remember the open width, go to the 44px rail; rail -> back to that width.
const RAIL_PX = 44, OPEN_MIN = 200, OPEN_MAX = 480;
const sidebarPx = () => find(layout(), "sidebar")?.size?.px;
export const isCollapsed = () => (sidebarPx() ?? Infinity) < 160;
const openWidth = () => Math.min(OPEN_MAX, Math.max(OPEN_MIN, shared("sidebar.width") ?? 268));
export function toggleSidebar() {
  const width = sidebarPx(), c = isCollapsed();
  if (!c && width >= OPEN_MIN) setShared("sidebar.width", width);
  applySidebarState(!c);
}

// Puts the sidebar in one of its two states in a single layout.set (Ethan: "treat the rail and expanded state as two
// different states? rail can't be resized?"): the rail is pinned min = max = 44 so it can't be dragged; the open
// sidebar drags between 200 and 480 and a drag never collapses it. Also: Spaces/Agents resizable only while open, the
// top row 44px tall in the rail (equal button margins), and the open sidebar's own Spaces split given back.
export function applySidebarState(collapsed) {
  const tree = JSON.parse(JSON.stringify(layout()));
  const bar = find(tree, "sidebar"), lists = find(tree, "sidebar-lists"), brand = find(tree, "brand"), sp = find(tree, "spaces");
  if (!bar) return;
  const px = collapsed ? RAIL_PX : Math.min(OPEN_MAX, Math.max(OPEN_MIN, bar.size?.px >= OPEN_MIN ? bar.size.px : openWidth()));
  bar.size = { px };
  bar.min = collapsed ? RAIL_PX : OPEN_MIN;
  bar.max = collapsed ? RAIL_PX : OPEN_MAX;
  if (lists) lists.resizable = !collapsed;
  if (brand) brand.size = { px: collapsed ? RAIL_PX : 46 };
  if (sp && collapsed && !sp.size?.px) setShared("sidebar.spacesSize", sp.size ?? { weight: 1 });
  if (sp && !collapsed && sp.size?.px) sp.size = shared("sidebar.spacesSize") ?? { weight: 1 };
  setShared("sidebar.collapsed", collapsed);
  run("layout.set", { layout: tree });
}
