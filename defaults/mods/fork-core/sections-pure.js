// Pure helpers for the left sidebar's sections (no host imports; tested by test-sections.mjs).
// A drag reports a live width while the layout file still holds the pre-drag size. layout.set of that tree
// snaps the sidebar back. True once the file has caught up (or it has no px to be stale).
export const sidebarWidthSettled = (filePx, livePx) => typeof filePx !== "number" || Math.abs(filePx - livePx) <= 1;
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
// The fork's version line adds one 20px row under the others (fork only: stock has no appInfo).
export const VERSION_ROW_PX = 20;
export const footerHeight = (rows, version = false) => 17 + 28 * rows + (version ? VERSION_ROW_PX : 0);
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
  if (!rows && !state.version) { if (!state.footerHidden) cmds.push(["layout.hide", { id: "sidebar-footer" }]); }
  else {
    if (state.footerHidden) cmds.push(["layout.show", { id: "sidebar-footer" }]);
    const px = footerHeight(rows, Boolean(state.version));
    if (state.footerPx !== px) cmds.push(["layout.resize", { id: "sidebar-footer", px }]);
  }
  return cmds;
}

// The rail is 44px (min = max); the open sidebar drags 200–480, with a 46px top row and resizable lists.
// Pending means the width has crossed into a state whose other rules are not applied yet. A width change that
// already wrote min/max (the rail's Expand) is still pending until lists, the top row, and a pixel Spaces split match.
const RAIL_PX = 44, OPEN_MIN = 200, OPEN_MAX = 480, BRAND_OPEN = 46;
function findNode(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) { const f = findNode(child, id); if (f) return f; }
  return null;
}
export function sidebarRulesPending(tree, collapsed) {
  const bar = findNode(tree, "sidebar");
  if (!bar) return false;
  const lists = findNode(tree, "sidebar-lists"), brand = findNode(tree, "brand"), sp = findNode(tree, "spaces");
  if (collapsed) {
    return bar.min !== RAIL_PX || bar.max !== RAIL_PX
      || (lists != null && lists.resizable !== false)
      || (brand != null && brand.size?.px !== RAIL_PX);
  }
  return bar.min !== OPEN_MIN || bar.max !== OPEN_MAX
    || (lists != null && lists.resizable !== true)
    || (brand != null && brand.size?.px !== BRAND_OPEN)
    || Boolean(sp?.size?.px);
}

// The fork's version line from appInfo() ({name, version, base, sha}): short "Trestle 0.2.0 · 1a2b3c4" in the footer,
// full "Trestle 0.2.0 (Herdr 0.1.13, <sha>)" on hover and on the clipboard. Null without a name and version.
export function versionLine(info) {
  if (!info || typeof info !== "object") return null;
  const name = typeof info.name === "string" ? info.name.trim() : "";
  const version = typeof info.version === "string" ? info.version.trim() : "";
  if (!name || !version) return null;
  const sha = typeof info.sha === "string" ? info.sha.trim() : "";
  const base = typeof info.base === "string" ? info.base.trim() : "";
  const head = `${name} ${version}`;
  const inner = [base ? `Herdr ${base}` : "", sha].filter(Boolean).join(", ");
  return { short: sha ? `${head} · ${sha.slice(0, 7)}` : head, full: inner ? `${head} (${inner})` : head };
}
