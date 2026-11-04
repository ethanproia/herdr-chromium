// The notification bell and inbox, pure parts: no host imports, so `node core/test-inbox.mjs` can load them.
// The host side (feature-detected, namespaced) is notes.js; the panel is roles/inbox.js.

export const SOURCES = ["agents", "machines", "browser", "updates", "mods", "app"];
const LEVELS = ["info", "success", "warning", "error"];

// ---- sizes (px) ------------------------------------------------------------------------------------------------------
export const INBOX_W = 340;
export const HEAD_H = 40;        // title + compact actions, hairline below
export const ROW_H = 48;         // two lines: 13px title (18 line) + 11px body (16 line), 7 above and below
export const ROW_H_ONE = 32;     // no body: the shared one-line menu row height
export const LABEL_H = 30;       // groupLabel(t, text) at its default top of 6
export const EMPTY_H = 96;       // the "No notifications" box
export const PAD = 4;            // list padding top and bottom, as the menus
export const INBOX_MAX_H = 460;
export const BELL_MENU_H = 8 + 3 * 32 + 9;   // menuHeight(3 rows, 1 hairline)

// "Now", "5m", "2h", "3d": the Agents list's words.
export function relTime(ts, now) {
  const ms = Math.max(0, (Number(now) || 0) - (Number(ts) || 0));
  const m = Math.floor(ms / 60000);
  if (m < 1) return "Now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Local calendar day: "Today", "Yesterday", "Mon, Nov 3", and the year once it is not this year.
export function dayLabel(ts, now) {
  const day = startOfDay(ts), today = startOfDay(now);
  if (day === today) return "Today";
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (day === y.getTime()) return "Yesterday";
  const d = new Date(ts), n = new Date(now);
  const base = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === n.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

// One snapshot, cleaned: never throws on a missing or odd shape. null in = the API is absent.
export function normalizeSnapshot(s) {
  if (!s || typeof s !== "object") return null;
  const items = (Array.isArray(s.items) ? s.items : []).filter((x) => x && typeof x === "object" && x.id != null).map((x) => ({
    id: String(x.id),
    ts: Number(x.ts) || 0,
    source: SOURCES.includes(x.source) ? x.source : "app",
    from: typeof x.from === "string" ? x.from : "",
    title: typeof x.title === "string" ? x.title : "",
    body: typeof x.body === "string" ? x.body : "",
    level: LEVELS.includes(x.level) ? x.level : "info",
    icon: typeof x.icon === "string" && x.icon ? x.icon : null,
    action: x.action && typeof x.action === "object" && typeof x.action.name === "string" && x.action.name ? { name: x.action.name, args: x.action.args && typeof x.action.args === "object" ? x.action.args : {} } : null,
    count: Number.isFinite(x.count) && x.count > 1 ? Math.floor(x.count) : 1,
    read: x.read === true,
    stale: x.stale === true,
  }));
  const st = s.settings && typeof s.settings === "object" ? s.settings : {};
  const muted = Array.isArray(st.muted_sources) ? st.muted_sources.filter((x) => typeof x === "string") : [];
  return { unread: Number.isFinite(s.unread) && s.unread > 0 ? Math.floor(s.unread) : 0, items, settings: { dnd: st.dnd === true, muted_sources: muted } };
}

// Newest first, grouped by local day: [{ label, items }].
export function groupByDay(items, now) {
  const sorted = [...(Array.isArray(items) ? items : [])].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const out = [];
  for (const it of sorted) {
    const label = dayLabel(it.ts, now);
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(it);
    else out.push({ label, items: [it] });
  }
  return out;
}

// The bell: hidden without the API; a dot for unread (the host's count already leaves muted sources out);
// the blocked colour when an unread error from an unmuted source is waiting; bell-off under Do Not Disturb.
export function badgeState(snap) {
  if (!snap) return { show: false, dot: false, tone: null, dnd: false, unread: 0 };
  const muted = new Set(snap.settings?.muted_sources ?? []);
  const error = snap.items.some((x) => !x.read && x.level === "error" && !muted.has(x.source));
  const dot = snap.unread > 0;
  return { show: true, dot, tone: dot ? (error ? "error" : "accent") : null, dnd: snap.settings?.dnd === true, unread: snap.unread };
}

// One row's look and what a click may do. A stale row (its terminal or agent is gone) is dimmed and its
// action does not run; a click still marks it read.
export function rowState(it) {
  const actionable = !it.stale && Boolean(it.action);
  return {
    unread: !it.read,
    dim: it.stale,
    actionable,
    tall: Boolean(it.body),
    countLabel: it.count > 1 ? `×${it.count}` : "",
  };
}

// What a row click does, as data: run its action (when it can), mark it read, close the panel.
export function rowClickPlan(it) {
  const s = rowState(it);
  return { run: s.actionable ? { name: it.action.name, args: it.action.args ?? {} } : null, markRead: it.id, close: true };
}

// Which icon a row shows: the item's own, else the level's for a warning or error, else its source's.
export const SOURCE_ICON = { agents: "agents", machines: "remote", browser: "globe", updates: "download", mods: "panel", app: "bell" };
export function rowIcon(it) {
  if (it.icon) return { path: it.icon, own: true };
  if (it.level === "error") return { name: "circle-x", tone: "error" };
  if (it.level === "warning") return { name: "triangle-alert", tone: "warning" };
  if (it.level === "success") return { name: "circle-check", tone: "success" };
  return { name: SOURCE_ICON[it.source] ?? "bell", tone: null };
}

// The panel's height for this snapshot: header, then padding, labels and rows, capped (the list scrolls past it).
export function inboxHeight(snap, now) {
  const items = snap?.items ?? [];
  if (!items.length) return HEAD_H + EMPTY_H;
  const groups = groupByDay(items, now);
  let h = HEAD_H + PAD * 2;
  for (const g of groups) h += LABEL_H + g.items.reduce((a, it) => a + (it.body ? ROW_H : ROW_H_ONE), 0);
  return Math.min(INBOX_MAX_H, h);
}

// The bell's right-click menu: [label, command, args, enabled].
export function bellMenuItems(snap) {
  const s = snap ?? { unread: 0, items: [], settings: { dnd: false } };
  return [
    ["Mark All Read", "notifications.read_all", {}, s.items.some((x) => !x.read)],
    ["Do Not Disturb", "notifications.toggle_dnd", {}],
    ["Clear All", "notifications.clear_all", {}, s.items.length > 0],
  ];
}
