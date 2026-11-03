// Pure row model for the Notes pane: one row per line (a fenced code block is one row).
// No gpui imports, so node can test it. joinRows(splitRows(s)) === s for every string.

const FENCE = /^\s*(```|~~~)/;

export function splitRows(s) {
  const lines = s.split("\n");
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const m = FENCE.exec(lines[i]);
    if (!m) { rows.push(lines[i]); continue; }
    const start = i;
    i++;
    while (i < lines.length && !lines[i].trimStart().startsWith(m[1])) i++;
    if (i >= lines.length) i = lines.length - 1;
    rows.push(lines.slice(start, i + 1).join("\n"));
  }
  return rows;
}

export const joinRows = (rows) => rows.join("\n");
export const isFence = (row) => FENCE.test(row);

// What a row is: { kind, level?, marker, text, checked?, indent }.
// marker = the markdown prefix exactly as typed; marker + text === row (after indent).
export function parseRow(row) {
  let m;
  if (isFence(row)) return { kind: "code", marker: "", text: row, indent: "" };
  if ((m = /^(#{1,3})(\s+)(.*)$/.exec(row))) return { kind: "h", level: m[1].length, indent: "", marker: m[1] + m[2], text: m[3] };
  if ((m = /^(\s*)([-*+]\s+\[([ xX])\]\s)(.*)$/.exec(row))) return { kind: "task", indent: m[1], marker: m[2], checked: m[3] !== " ", text: m[4] };
  if ((m = /^(\s*)([-*+]\s+)(.*)$/.exec(row))) return { kind: "bullet", indent: m[1], marker: m[2], text: m[3] };
  if ((m = /^(\s*)((\d+)[.)]\s+)(.*)$/.exec(row))) return { kind: "number", indent: m[1], marker: m[2], n: Number(m[3]), text: m[4] };
  if ((m = /^(>\s?)(.*)$/.exec(row))) return { kind: "quote", indent: "", marker: m[1], text: m[2] };
  if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(row)) return { kind: "hr", indent: "", marker: row, text: "" };
  return { kind: "p", indent: "", marker: "", text: row };
}

// The slash menu's types, in order. prefix: what the row starts with.
export const TYPES = [
  { id: "p", name: "Text", hint: "Plain text", prefix: "", keys: "text paragraph plain" },
  { id: "h1", name: "Heading 1", hint: "Big section heading", prefix: "# ", keys: "h1 heading title" },
  { id: "h2", name: "Heading 2", hint: "Medium section heading", prefix: "## ", keys: "h2 heading subtitle" },
  { id: "h3", name: "Heading 3", hint: "Small section heading", prefix: "### ", keys: "h3 heading" },
  { id: "task", name: "To-do list", hint: "Track tasks with a checkbox", prefix: "- [ ] ", keys: "todo task checkbox check" },
  { id: "bullet", name: "Bulleted list", hint: "A simple bulleted list", prefix: "- ", keys: "bullet list ul" },
  { id: "number", name: "Numbered list", hint: "A list with numbering", prefix: "1. ", keys: "number numbered ol list" },
  { id: "quote", name: "Quote", hint: "Capture a quote", prefix: "> ", keys: "quote blockquote" },
  { id: "hr", name: "Divider", hint: "Separate sections", prefix: "---", keys: "divider hr line rule separator" },
];

export function filterTypes(query) {
  const q = query.trim().toLowerCase();
  if (!q) return TYPES;
  return TYPES.filter((t) => t.name.toLowerCase().includes(q) || t.keys.includes(q));
}

// Turn a row into another type, keeping its text (and indent for lists).
export function setType(row, id) {
  const r = parseRow(row);
  const t = TYPES.find((x) => x.id === id);
  if (!t) return row;
  if (id === "hr") return "---";
  const keepIndent = ["task", "bullet", "number"].includes(id) ? r.indent : "";
  return keepIndent + t.prefix + (r.kind === "hr" ? "" : r.text);
}

// The prefix a new row gets after Enter on this row (Notion continues lists).
export function continuePrefix(row) {
  const r = parseRow(row);
  if (r.kind === "task") return r.indent + r.marker.replace(/\[[xX]\]/, "[ ]");
  if (r.kind === "bullet") return r.indent + r.marker;
  if (r.kind === "number") return r.indent + r.marker.replace(/^\d+/, String(r.n + 1));
  return "";
}

// A list row with nothing after its marker (Enter on it leaves the list, as in Notion).
export const isEmptyItem = (row) => {
  const r = parseRow(row);
  return ["task", "bullet", "number", "quote"].includes(r.kind) && r.text === "";
};

export function toggleTask(row) {
  const m = /^(\s*[-*+]\s+\[)([ xX])(\].*)$/.exec(row);
  return m ? m[1] + (m[2] === " " ? "x" : " ") + m[3] : row;
}

// Inline runs: { t: "text" | "mark" | "code" | "bold" | "italic", s }.
export function parseInline(str) {
  const out = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\s][^*]*\*)|(\b_[^_\s][^_]*_\b)|(\[((?:\\.|[^\]\\])+)\]\((<[^>\n]+>|[^)\s]+)\))/g;
  let at = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > at) out.push({ t: "text", s: str.slice(at, m.index) });
    const s = m[0];
    if (m[6]) out.push({ t: "mark", s: "[" }, { t: "link", s: m[7].replace(/\\(.)/g, "$1"), href: m[8].replace(/^<(.*)>$/, "$1"), start: m.index }, { t: "mark", s: `](${m[8]})` });
    else if (m[1]) out.push({ t: "mark", s: "`" }, { t: "code", s: s.slice(1, -1) }, { t: "mark", s: "`" });
    else if (m[2] || m[3]) out.push({ t: "mark", s: s.slice(0, 2) }, { t: "bold", s: s.slice(2, -2) }, { t: "mark", s: s.slice(-2) });
    else out.push({ t: "mark", s: s[0] }, { t: "italic", s: s.slice(1, -1) }, { t: "mark", s: s[0] });
    at = m.index + s.length;
  }
  if (at < str.length) out.push({ t: "text", s: str.slice(at) });
  return out;
}

export function titleOf(text) {
  for (const l of text.split("\n")) {
    if (l.trim()) return l.replace(/^\s*#+\s*/, "").replace(/^\s*[-*+]\s+(\[[ xX]\]\s)?/, "").trim() || "Untitled";
  }
  return "Untitled";
}

export function slugOf(title, stamp) {
  const s = title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return s && title !== "Untitled" ? s : `untitled-${stamp}`;
}

export function uniqueName(slug, taken) {
  const set = new Set(taken);
  if (!set.has(`${slug}.md`)) return `${slug}.md`;
  for (let k = 2; ; k++) if (!set.has(`${slug}-${k}.md`)) return `${slug}-${k}.md`;
}

export function ageOf(ms, now) {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 14) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / (86400 * 7))}w`;
}

// A line an agent added (`notepad add`). The editor hides it; plain text and PDF drop it too.
// Copy as Markdown keeps the raw note, marker included.
export const BY_MARK = /\s*<!-- by (.+?) -->$/;
export const stripBy = (row) => row.replace(BY_MARK, "");

// Join an append-only disk update onto local text. `disk` starts with `loaded` (the caller's isAppend check).
// bin/notepad writes its own newline when the base had none. A second Notepad pane saving a keystroke at the
// end of the last row is also an append, and must stay on that line. Insert a break only when the base ended
// with one and the local text no longer does (the local edit removed that break).
export function mergeAppend(loaded, text, disk) {
  const base = typeof loaded === "string" ? loaded : "";
  let add = String(disk).slice(base.length);
  if (text.endsWith("\n") && add.startsWith("\n")) add = add.slice(1);
  else if (base.endsWith("\n") && text !== "" && !text.endsWith("\n") && !add.startsWith("\n")) add = "\n" + add;
  return text + add;
}

// What Restore should do with a draft. `base` is the text the draft was edited from
// (null: the file did not exist; undefined: a draft with no recorded base).
// "save" writes the draft. "merge" keeps an append that landed on that base. "conflict" does not overwrite.
export function draftRestore(base, draft, disk) {
  if (disk === draft) return "save";
  if (base === undefined) return disk === null ? "save" : "conflict";
  if (disk === base) return "save";
  if (typeof base === "string" && typeof disk === "string" && disk.length > base.length && disk.startsWith(base)) return "merge";
  return "conflict";
}

// Baseline to keep after choosing Restore. "save" must not rewind to `base`: the disk already
// equals the draft or the base, and rewinding makes the draft's own tail look like an append.
// "merge" and "conflict" pin the older base so a later save still sees the outside edit.
export function loadedAfterRestore(action, base, loaded, draft) {
  if (action === "save") return loaded;
  if (base !== undefined) return base;
  return action === "conflict" ? draft : loaded;
}

// How a non-forced save should treat the file on disk.
// "same": disk already equals local text (the baseline is stale). Advance the baseline; do not append that tail again.
// "write": disk matches the baseline, so the local text is the change to write.
// "merge": disk is a pure append of the baseline.
// "conflict": disk changed in some other way.
export function savePlan(loaded, text, disk) {
  if (disk === text) return "same";
  if (disk === loaded) return "write";
  if (typeof loaded === "string" && typeof disk === "string" && disk.length > loaded.length && disk.startsWith(loaded)) return "merge";
  if (disk !== text) return "conflict";
  return "write";
}

// ---- export ----
const stripInline = (s) => parseInline(s).filter((r) => r.t !== "mark").map((r) => r.s).join("");

// Plain text: markdown marks removed, lists keep a bullet or number, to-dos keep a box.
export function toPlain(text) {
  return splitRows(text).map((row) => {
    const clean = stripBy(row);
    const r = parseRow(clean);
    if (r.kind === "code") return clean.split("\n").filter((l) => !isFence(l)).join("\n");
    if (r.kind === "hr") return "";
    const body = stripInline(r.text);
    if (r.kind === "bullet") return r.indent + "• " + body;
    if (r.kind === "number") return r.indent + r.n + ". " + body;
    if (r.kind === "task") return r.indent + (r.checked ? "☑ " : "☐ ") + body;
    return body;
  }).join("\n");
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
// http(s) and mailto: the schemes a note link may hand to the OS. safeHref adds absolute paths for the PDF.
export function openableUrl(href) {
  const s = String(href || "");
  return /^https?:\/\//i.test(s) || /^mailto:/i.test(s) ? s : null;
}
// Exported links: only http(s), mailto, and absolute file paths become anchors. date:, herdr:, javascript:,
// and protocol-relative "//..." stay plain text. A path is rewritten to file:// so the PDF can open it.
const safeHref = (h) => {
  const web = openableUrl(h);
  if (web) return web;
  const s = String(h || "");
  if (s.startsWith("/") && !s.startsWith("//")) return "file://" + encodeURI(s);
  return null;
};
function inlineHtml(s) {
  return parseInline(s).map((r) => r.t === "mark" ? "" : r.t === "link" ? (safeHref(r.href) ? `<a href="${escAttr(safeHref(r.href))}">${esc(r.s)}</a>` : esc(r.s)) : r.t === "bold" ? `<b>${esc(r.s)}</b>` : r.t === "italic" ? `<i>${esc(r.s)}</i>`
    : r.t === "code" ? `<code>${esc(r.s)}</code>` : esc(r.s)).join("");
}

// A printable page (for the PDF export): Notion-like type, black on white.
export function toHtml(text, title) {
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const row of splitRows(text)) {
    const clean = stripBy(row);
    const r = parseRow(clean);
    const want = r.kind === "bullet" || r.kind === "task" ? "ul" : r.kind === "number" ? "ol" : null;
    if (want !== list) { close(); if (want) { out.push(`<${want}>`); list = want; } }
    if (r.kind === "h") out.push(`<h${r.level}>${inlineHtml(r.text)}</h${r.level}>`);
    else if (r.kind === "bullet" || r.kind === "number") out.push(`<li>${inlineHtml(r.text)}</li>`);
    else if (r.kind === "task") out.push(`<li class="task">${r.checked ? "☑" : "☐"} ${inlineHtml(r.text)}</li>`);
    else if (r.kind === "quote") out.push(`<blockquote>${inlineHtml(r.text)}</blockquote>`);
    else if (r.kind === "hr") out.push("<hr>");
    else if (r.kind === "code") out.push(`<pre>${esc(clean.split("\n").filter((l) => !isFence(l)).join("\n"))}</pre>`);
    else out.push(clean.trim() ? `<p>${inlineHtml(r.text)}</p>` : "");
  }
  close();
  return `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font:15px/1.6 -apple-system,system-ui,sans-serif;color:#191919;max-width:680px;margin:48px auto;padding:0 24px}
h1{font-size:30px;margin:28px 0 8px}h2{font-size:22px;margin:24px 0 6px}h3{font-size:18px;margin:18px 0 4px}
p{margin:4px 0}ul,ol{margin:4px 0;padding-left:24px}li.task{list-style:none;margin-left:-20px}
blockquote{border-left:3px solid #191919;margin:6px 0;padding-left:14px}hr{border:0;border-top:1px solid #ddd;margin:16px 0}
code{font:13px ui-monospace,Menlo,monospace;background:#f1f1ef;padding:1px 5px;border-radius:4px}
pre{font:13px/1.5 ui-monospace,Menlo,monospace;background:#f7f6f3;padding:12px 14px;border-radius:6px;white-space:pre-wrap}
</style>${out.join("\n")}`;
}

// ---- frontmatter (the page icon lives here: "icon: 🌿") ----
const FRONT = /^---\n([\s\S]*?)\n---(\n|$)/;
// Split a note into its frontmatter block (exact text, "" if none) and the body.
export function splitFront(text) {
  const m = FRONT.exec(text);
  return m ? { front: m[0], body: text.slice(m[0].length) } : { front: "", body: text };
}
export function iconOf(front) {
  const m = /^icon:\s*(.+)$/m.exec(front);
  return m ? m[1].trim() : "";
}
// Set or clear the icon, keeping any other frontmatter lines.
export function withIcon(front, icon) {
  const lines = front ? front.replace(/\n$/, "").split("\n").slice(1, -1).filter((l) => !/^icon:/.test(l)) : [];
  if (icon) lines.unshift(`icon: ${icon}`);
  return lines.length ? `---\n${lines.join("\n")}\n---\n` : "";
}

// Replace the link that starts at `offset` when its href is still `href`. null if that occurrence is gone.
// Clearing keeps one space at the join ("a [date] b" -> "a b") and leaves other spacing alone.
export function replaceLinkAt(row, offset, href, replacement) {
  const span = linkSpans(row).find((s) => s.start === offset);
  if (!span || span.href !== href) return null;
  const left = row.slice(0, span.start);
  const right = row.slice(span.end);
  if (replacement) return left + replacement + right;
  const trail = left.match(/ *$/)[0].length;
  const lead = right.match(/^ */)[0].length;
  return left.slice(0, left.length - trail) + (trail + lead ? " " : "") + right.slice(lead);
}

// Caret after one edit turned `before` into `after` (UTF-16 indexes, same as the text box).
// The end of the changed span: a mid-line edit stays there, an edit at the end stays at the end.
// A deletion stays at the cut. Equal strings report the end.
//
// Inserting text that equals the characters already after the caret is ambiguous: "ab" becoming
// "abb" is either a "b" typed at index 1 (caret 2) or a "b" appended (caret 3). The strings do not
// say which. This reports the right edge of that overlap, which keeps an edit at the end of the
// line at the end. TextareaState can set_selected_range and cannot read it back, so the caller
// cannot substitute the real caret. A ")" that completes a link typed just before another ")"
// is this case, and the caret lands one character too far right.
export function caretAfterEdit(before, after) {
  const b = String(before ?? ""), a = String(after ?? "");
  let i = 0;
  const n = Math.min(b.length, a.length);
  while (i < n && b.charCodeAt(i) === a.charCodeAt(i)) i++;
  let be = b.length, ae = a.length;
  while (be > i && ae > i && b.charCodeAt(be - 1) === a.charCodeAt(ae - 1)) { be--; ae--; }
  return ae < 0 ? 0 : ae > a.length ? a.length : ae;
}

// Where the markdown links sit in a line (JS string offsets = the text box's UTF-16 offsets), for inline badges.
export function linkSpans(text) {
  const out = [];
  const re = /\[((?:\\.|[^\]\\])+)\]\((<[^>\n]+>|[^)\s]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], label: m[1].replace(/\\(.)/g, "$1"), href: m[2].replace(/^<(.*)>$/, "$1") });
  }
  return out;
}

// ---- long-note windowing: prefix sums over row heights, binary search for the rows on screen ----
// prefixOffsets(hs)[i] is the y of row i's top (relative to the first row); the last entry is the total height.
export function prefixOffsets(hs) {
  const p = new Float64Array(hs.length + 1);
  for (let i = 0; i < hs.length; i++) p[i + 1] = p[i] + hs[i];
  return p;
}

// Rows i in [first, last) are the ones that touch [top, bottom] (both relative to the first row's top):
// first = the first row whose bottom edge reaches `top`; last = the first row (after first) whose top edge reaches
// `bottom`, or n. Same answer as walking the rows from the start, in O(log n).
export function visibleRange(prefix, top, bottom) {
  const n = prefix.length - 1;
  let lo = 0, hi = n;                      // first i in [0, n] with prefix[i + 1] >= top (n: none)
  while (lo < hi) { const m = (lo + hi) >> 1; if (prefix[m + 1] >= top) hi = m; else lo = m + 1; }
  const first = lo;
  lo = first; hi = n;                      // first j in [first, n] with prefix[j] >= bottom (n: none)
  while (lo < hi) { const m = (lo + hi) >> 1; if (prefix[m] >= bottom) hi = m; else lo = m + 1; }
  return { first, last: lo };
}

// Keep a per-index height cache aligned with a row splice.
// `inserted` are the heights of the new rows (undefined = not measured yet, so the row uses an estimate
// until it is drawn). Heights after the splice stay with their rows; they are not left pointing at a neighbor.
export function spliceHeights(heights, start, deleteCount, inserted = []) {
  const next = heights.slice();
  if (inserted.length && next.length < start) next.length = start;   // windowed mode measures only drawn rows: pad, don't append early
  next.splice(start, deleteCount, ...inserted);
  return next;
}

// Same gap math as moving a row: `to` is the index the row is dropped before.
// Dropping a row into its own gap (`to === from` or `to === from + 1`) changes nothing.
export function moveHeight(heights, from, to) {
  if (to === from || to === from + 1) return heights.slice();
  const next = heights.slice();
  const [h] = from < next.length ? next.splice(from, 1) : [undefined];
  const dest = to > from ? to - 1 : to;
  if (next.length < dest) next.length = dest;   // sparse (windowed mode): pad so the height lands at `dest`, not the end
  next.splice(dest, 0, h);
  while (next.length && next[next.length - 1] === undefined) next.length--;   // trailing unmeasured rows carry nothing
  return next;
}
