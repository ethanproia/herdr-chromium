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
const layoutState = () => {
  const l = layout();
  return { spacesHidden: find(l, "spaces")?.hidden === true, agentsHidden: find(l, "agents")?.hidden === true, footerPx: find(l, "sidebar-footer")?.size?.px, footerHidden: find(l, "sidebar-footer")?.hidden === true,
    statusHidden: find(l, "status") ? find(l, "status").hidden === true : undefined };
};
// Issues commands only where the layout differs from the sections. Returns how many.
export function applySections() {
  const l = layout();
  if (!find(l, "spaces") || !find(l, "agents") || !find(l, "sidebar-footer")) return 0;   // another layout: leave it alone
  const cmds = sectionsPlan(sections(), layoutState());
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
  openOverlay({ mod: SELF, kind: "popup", width: 260, height: menuHeight(SECTION_KEYS.length, 0) + 30 /* + the "Show" label */, props: { role: "menu", tab: "sidebar" } });
