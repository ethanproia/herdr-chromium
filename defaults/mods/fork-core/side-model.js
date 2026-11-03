// Pure model for the side panel strip: no herdr imports, runs under node.

export const BODY = "panel-body";
export const DEFAULT_PINS = ["files", "changes"];

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The block a tool becomes inside the side panel's stack.
// tool.side.content wins (a descriptor can say exactly), then open.mod, then the
// fork's browser. Terminals have no block here (they need terminal.park): null.
export function contentFor(tool) {
  if (tool?.side?.content) return tool.side.content;
  const open = tool?.open ?? {};
  if (open.mod) return open.props && Object.keys(open.props).length ? { mod: open.mod, props: open.props } : { mod: open.mod };
  if (open.command === "browser.new") return { browser: { url: tool.url ?? "about:blank", profile: "default" } };
  return null;
}

// New panel-body children: one block per tool, in the order given.
// tools: [{ id, content? }]. A tool already in the stack keeps its node as is
// (so files+changes round-trips byte for byte); a new one gets
// { id, type: "block", content }. `active` stays valid: the asked-for id, else
// the old one, else the first child (none when empty). Nothing outside
// panel-body is touched; no panel-body means an unchanged copy.
export function withSideTools(tree, tools, active) {
  const out = JSON.parse(JSON.stringify(tree));
  const body = find(out, BODY);
  if (!body) return out;
  const old = new Map((body.children ?? []).map((c) => [c.id, c]));
  const seen = new Set();
  const kids = [];
  for (const t of tools ?? []) {
    if (!t?.id || seen.has(t.id)) continue;
    const node = old.get(t.id) ?? (t.content ? { id: t.id, type: "block", content: t.content } : null);
    if (!node) continue;
    seen.add(t.id);
    kids.push(node);
  }
  body.children = kids;
  const want = [active, body.active].find((a) => a && seen.has(a));
  if (want) body.active = want;
  else if (kids.length) body.active = kids[0].id;
  else delete body.active;
  return out;
}

export function sideIds(tree) {
  return (find(tree, BODY)?.children ?? []).map((c) => c.id);
}

// Strip order: pinned (in pin order) first, then the other open tools in stack
// order, the temporary one last. Only tools that are in the stack show.
export function stripModel({ pins, temp, ids }) {
  const open = new Set(ids);
  const pinned = (pins ?? []).filter((id, i, a) => open.has(id) && a.indexOf(id) === i);
  const rest = ids.filter((id) => !pinned.includes(id) && id !== temp);
  if (temp && open.has(temp) && !pinned.includes(temp)) rest.push(temp);
  return { pinned, rest, temp: temp && rest.includes(temp) ? temp : null };
}

// Stack contents after a user action. Returns { ids, pins, temp }.
export function reduce({ ids, pins, temp }, action, id) {
  ids = [...ids]; pins = [...(pins ?? [])];
  const has = ids.includes(id);
  switch (action) {
    case "pin":
      if (!has) ids.push(id);
      return { ids, pins: [...pins.filter((p) => p !== id), id], temp: temp === id ? null : temp };
    case "unpin":
      return { ids, pins: pins.filter((p) => p !== id), temp };
    case "close":
      return { ids: ids.filter((x) => x !== id), pins: pins.filter((p) => p !== id), temp: temp === id ? null : temp };
    case "temporary": {
      if (has) return { ids, pins, temp }; // already there: just select it
      // the next temporary opening replaces the previous one
      const keep = temp && !pins.includes(temp) ? ids.filter((x) => x !== temp) : ids;
      return { ids: [...keep, id], pins, temp: id };
    }
    default:
      return { ids, pins, temp };
  }
}

// ---- the layout change: the strip block above panel-body, inside the side panel column only ----
export const STRIP = "panel-strip";
export const STRIP_HEIGHT = 34;

// Adds { mod, props: { role: "side-strip" } } as a fixed-height block above panel-body (inside the column that holds
// panel-body). Idempotent: an existing strip is left as it is. Nothing outside that column is touched; no panel-body
// means an unchanged copy. `mod` is the folder the layout names for core (the shipped layouts say "core").
export function withSideStrip(tree, mod = "core") {
  const out = JSON.parse(JSON.stringify(tree));
  const find2 = (n) => {
    if ((n?.children ?? []).some((c) => c.id === BODY)) return n;
    for (const c of n?.children ?? []) { const f = find2(c); if (f) return f; }
    return null;
  };
  const col = find2(out);
  if (!col || col.children.some((c) => c.id === STRIP)) return out;
  const at = col.children.findIndex((c) => c.id === BODY);
  col.children.splice(at, 0, { id: STRIP, type: "block", content: { mod, props: { role: "side-strip" } }, size: { px: STRIP_HEIGHT } });
  return out;
}

// Right-click rows for a strip tab: [label, command, args]. menu.js runs a "side.*" command with runSideAction.
export function sideMenuRows(id, pinned) {
  return [
    [pinned ? "Unpin" : "Pin", pinned ? "side.unpin" : "side.pin", { tool: id }],
    ["Open as tab", "side.tab", { tool: id }],
    ["Close", "side.close", { tool: id }],
  ];
}

// Old tabs-browser localStorage "panels" ({ spaceId: toolId | null }) to shared keys.
export function migratePanels(raw) {
  let map = {};
  try { map = JSON.parse(raw ?? "{}") || {}; } catch { map = {}; }
  const keys = {};
  for (const [space, tool] of Object.entries(map)) {
    if (typeof tool === "string" || tool === null) keys[`panels.side.${space}`] = tool;
  }
  return keys;
}
