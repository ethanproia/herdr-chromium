// Pure helpers for @ mentions: no gpui or herdr imports, so node can test them.
// Date rows live in dates.js (mentions.js imports dateItems from there).
const MAX_PER_KIND = 8;

const base = (p) => p.slice(p.lastIndexOf("/") + 1);

// Files rank basename prefix > basename contains > path contains; other kinds keep their order.
export function filterItems(items, query) {
  const q = (query || "").trim().toLowerCase();
  const byKind = new Map();
  for (const it of items) {
    let rank = 0;
    if (q) {
      if (it.kind === "file") {
        const b = base(it.hint || it.label).toLowerCase(), p = (it.hint || "").toLowerCase();
        const l = (it.label || "").toLowerCase();
        if (b.startsWith(q) || l.startsWith(q)) rank = 0;
        else if (b.includes(q) || l.includes(q)) rank = 1;
        else if (p.includes(q)) rank = 2;
        else continue;
      } else if (!`${it.label} ${it.hint || ""}`.toLowerCase().includes(q)) continue;
    }
    if (!byKind.has(it.kind)) byKind.set(it.kind, []);
    byKind.get(it.kind).push({ it, rank, i: byKind.get(it.kind).length });
  }
  const out = [];
  for (const list of byKind.values()) {
    list.sort((a, b) => a.rank - b.rank || a.i - b.i);
    for (const e of list.slice(0, MAX_PER_KIND)) out.push(e.it);
  }
  return out;
}

export function encodeLink(item) {
  const text = String(item.text).replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\)/g, "\\)");
  // CommonMark: a destination with spaces or parentheses goes in <...>.
  const href = /[\s()<>]/.test(item.href) ? `<${item.href}>` : item.href;
  return `[${text}](${href})`;
}

export function parseHref(href) {
  const h = String(href || "");
  let m;
  if ((m = /^date:(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(h))) return m[2] ? { kind: "date", date: m[1], time: m[2] } : { kind: "date", date: m[1] };
  if ((m = /^herdr:agent\/(.+)$/.exec(h))) return { kind: "agent", id: m[1] };
  if ((m = /^herdr:tab\/(.+)$/.exec(h))) return { kind: "tab", id: m[1] };
  if ((m = /^herdr:pane\/(.+)$/.exec(h))) return { kind: "pane", id: m[1] };   // "Copy link to panel" on a non-terminal pane
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(h) || /^mailto:/i.test(h)) return { kind: "url", id: h };
  return { kind: "file", path: h };
}
