// Pure helpers for the left sidebar's sections (no host imports; tested by test-sections.mjs).
// menuHeight is pure.js's: 8 + rows * 32 + breaks * 9.
export const menuHeight = (rows, breaks) => 8 + rows * 32 + breaks * 9;

// ---- left sidebar sections (shared "sidebar.sections"): which blocks the sidebar shows --------------------------
export const SECTION_KEYS = ["spaces", "agents", "addMachine", "statusBar"];
export const SECTION_DEFAULTS = { spaces: true, agents: false, addMachine: false, statusBar: false };
// Anything stored becomes a full {spaces, agents, addMachine}; never both lists off.
export function normalizeSections(v) {
  const o = v && typeof v === "object" ? v : {};
  const s = { ...SECTION_DEFAULTS };
  for (const k of SECTION_KEYS) if (typeof o[k] === "boolean") s[k] = o[k];
  if (!s.spaces && !s.agents) s.spaces = true;
  return s;
}
// The sections after a click on `key`, or null when the click isn't allowed (it would turn both lists off).
export function toggleSection(cur, key) {
  if (!SECTION_KEYS.includes(key)) return null;
  const c = normalizeSections(cur);
  const next = { ...c, [key]: !c[key] };
  return !next.spaces && !next.agents ? null : next;
}
// A row can't be switched off when it is the only list still on.
export const sectionLocked = (cur, key) => toggleSection(cur, key) === null;
// Footer block height: 1 border + 8 padding on every side + 28 per row.
export const footerHeight = (rows) => 17 + 28 * rows;
// Settings moved to the sidebar's top bar (Ethan 2026-11-03), so the footer holds only Add machine: 0 rows = hidden.
// Rail footer: 1 border + 9 + buttons of 26 with 4 between + 9 (the same 9 px margin as the rail's top button).
export const railFooterHeight = (sections) => { const n = 2 + (normalizeSections(sections).addMachine ? 1 : 0); return 1 + 9 + 26 * n + 4 * (n - 1) + 9; };
export const footerRows = (sections) => (normalizeSections(sections).addMachine ? 1 : 0);
// Commands that bring the layout to `sections`. `state` = { spacesHidden, agentsHidden, footerPx, footerHidden, statusHidden (undefined when the layout has no status block) }. Only differences.
export function sectionsPlan(sections, state) {
  const s = normalizeSections(sections);
  const cmds = [];
  if (Boolean(state.spacesHidden) === s.spaces) cmds.push([s.spaces ? "layout.show" : "layout.hide", { id: "spaces" }]);
  if (Boolean(state.agentsHidden) === s.agents) cmds.push([s.agents ? "layout.show" : "layout.hide", { id: "agents" }]);
  if (state.statusHidden !== undefined && Boolean(state.statusHidden) === s.statusBar) cmds.push([s.statusBar ? "layout.show" : "layout.hide", { id: "status" }]);
  // Collapsed, the footer is the rail's bottom: search and settings (plus Add machine when on), always shown.
  if (state.collapsed) {
    if (state.footerHidden) cmds.push(["layout.show", { id: "sidebar-footer" }]);
    const px = railFooterHeight(s);
    if (state.footerPx !== px) cmds.push(["layout.resize", { id: "sidebar-footer", px }]);
    return cmds;
  }
  const rows = footerRows(s);
  if (!rows) { if (!state.footerHidden) cmds.push(["layout.hide", { id: "sidebar-footer" }]); }
  else {
    if (state.footerHidden) cmds.push(["layout.show", { id: "sidebar-footer" }]);
    const px = footerHeight(rows);
    if (state.footerPx !== px) cmds.push(["layout.resize", { id: "sidebar-footer", px }]);
  }
  return cmds;
}
