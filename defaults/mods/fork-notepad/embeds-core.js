// Pure side of Notepad embeds (no gpui/herdr imports, so node can test it).
// Patterns follow Notion: image block `![alt](src)`, web bookmark = a bare URL on its own line;
// Obsidian: embedded note `![[path]]`. References saved in refs/embeds/.

// A row (one markdown line) -> null | {kind:"image",src,alt} | {kind:"bookmark",url} | {kind:"file",path}
export function embedOf(row) {
  if (typeof row !== "string") return null;
  const s = row.trim();
  if (!s || s.includes("\n")) return null;
  let m;
  if ((m = /^!\[\[([^\]\n|]+?)(?:\|[^\]\n]*)?\]\]$/.exec(s))) return { kind: "file", path: m[1].trim() };
  if ((m = /^!\[([^\]\n]*)\]\(\s*([^\s)]+)(?:\s+"[^"]*")?\s*\)$/.exec(s))) return { kind: "image", src: m[2], alt: m[1] };
  if (/^https?:\/\/[^\s<>]+$/i.test(s)) return { kind: "bookmark", url: s };
  return null;
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'", "#x2F": "/" };
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (ENT[e] !== undefined) return ENT[e];
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
    }
    return all;
  });
}

// "https://a.com/x/y?z" + "../i.png" -> absolute. No URL class (the mod runtime may lack it).
export function resolveUrl(rel, base) {
  if (!rel) return "";
  rel = decodeEntities(rel).trim();
  if (/^https?:\/\//i.test(rel)) return rel;
  const m = /^(https?:)\/\/([^/?#]+)([^?#]*)/i.exec(base || "");
  if (!m) return "";
  if (rel.startsWith("//")) return m[1] + rel;
  if (rel.startsWith("/")) return `${m[1]}//${m[2]}${rel}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(rel)) return "";   // data:, javascript:, ...
  const dir = m[3].slice(0, m[3].lastIndexOf("/") + 1) || "/";
  const out = [];
  for (const p of (dir + rel).split("/")) {
    if (p === "..") out.pop(); else if (p !== ".") out.push(p);
  }
  return `${m[1]}//${m[2]}${out.join("/").replace(/^\/?/, "/")}`;
}

export function domainOf(url) {
  const m = /^https?:\/\/([^/?#:]+)/i.exec(url || "");
  return m ? m[1].replace(/^www\./i, "") : "";
}

function attrs(tag) {
  const o = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag))) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return o;
}

// {title, description, image, favicon, domain} from <title>, og:*/twitter:*, link rel=icon.
export function parseMeta(html, url) {
  html = String(html || "");
  const head = html.slice(0, 512 * 1024);
  const meta = {}, links = [];
  for (const tag of head.match(/<(?:meta|link)\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    if (/^<meta/i.test(tag)) {
      const k = (a.property || a.name || "").toLowerCase();
      if (k && a.content !== undefined && meta[k] === undefined) meta[k] = decodeEntities(a.content).trim();
    } else if (a.rel && a.href) links.push({ rel: a.rel.toLowerCase().split(/\s+/), href: a.href, size: parseInt(a.sizes, 10) || 0 });
  }
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  const title = (meta["og:title"] || meta["twitter:title"] || (t ? decodeEntities(t[1]) : "")).replace(/\s+/g, " ").trim();
  const description = (meta["og:description"] || meta["twitter:description"] || meta["description"] || "").replace(/\s+/g, " ").trim();
  const img = meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || meta["twitter:image:src"] || "";
  const icons = links.filter((l) => l.rel.includes("icon") && !l.rel.includes("mask-icon"));
  // Prefer a plain icon (16-64px), then any icon.
  icons.sort((a, b) => Number(a.rel.includes("apple-touch-icon")) - Number(b.rel.includes("apple-touch-icon")) || a.size - b.size);
  const favicon = resolveUrl(icons[0] ? icons[0].href : "/favicon.ico", url);
  return { title, description, image: resolveUrl(img, url), favicon, domain: domainOf(url) };
}

// Small stable hash for cache file names: djb2 -> base36.
export function hashKey(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function extOf(url) {
  const m = /\.([a-z0-9]{2,4})(?:[?#]|$)/i.exec((url || "").replace(/^https?:\/\/[^/]+/i, ""));
  const e = m ? m[1].toLowerCase() : "";
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"].includes(e) ? e : "png";
}

export const isRemote = (s) => /^https?:\/\//i.test(s || "");

// First `n` lines of a file's text, with whether more follow.
export function excerpt(text, n = 20) {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return { lines: lines.slice(0, n), more: lines.length > n };
}

// A line of an embedded note -> {kind, text, level?}, markers stripped (plain styled text).
export function lineOf(line) {
  let m;
  if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) return { kind: "h", level: Math.min(m[1].length, 3), text: m[2] };
  if ((m = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line))) return { kind: "task", checked: m[1] !== " ", text: m[2] };
  if ((m = /^(\s*)[-*+]\s+(.*)$/.exec(line))) return { kind: "bullet", text: m[2], depth: Math.floor(m[1].length / 2) };
  if ((m = /^\s*(\d+)[.)]\s+(.*)$/.exec(line))) return { kind: "number", n: m[1], text: m[2] };
  if ((m = /^>\s?(.*)$/.exec(line))) return { kind: "quote", text: m[1] };
  if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) return { kind: "hr", text: "" };
  if (/^\s*(```|~~~)/.test(line)) return { kind: "fence", text: line.trim() };
  return { kind: "p", text: line };
}

// Fit a w x h image into maxW (never upscale) and maxH, keeping the ratio.
export function fit(w, h, maxW, maxH) {
  if (!(w > 0 && h > 0)) return { w: maxW, h: Math.round(maxW * 0.5625) };
  let s = Math.min(1, maxW / w);
  if (maxH) s = Math.min(s, maxH / h);
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

// Crop-to-cover: scaled size and offset so the image fills bw x bh, centred.
export function cover(w, h, bw, bh) {
  if (!(w > 0 && h > 0)) return { w: bw, h: bh, x: 0, y: 0 };
  const s = Math.max(bw / w, bh / h);
  const sw = Math.ceil(w * s), sh = Math.ceil(h * s);
  return { w: sw, h: sh, x: Math.round((bw - sw) / 2) || 0, y: Math.round((bh - sh) / 2) || 0 };
}

// A failed embed load is remembered only briefly, so the next render after this can try again.
// A success stays until the cache drops the oldest entry. `now` is milliseconds.
export const FAIL_TTL = 5000;

export function cacheSet(cache, key, data, now, max = 200) {
  for (const [k, v] of cache) {
    if (v && v.ok === false && typeof v.expires === "number" && now >= v.expires) cache.delete(k);
  }
  const fail = !data || data.ok === false;
  cache.set(key, fail ? { ok: false, why: (data && data.why) || "Could not load", expires: now + FAIL_TTL } : data);
  while (cache.size > max) cache.delete(cache.keys().next().value);
}

// The stored value, or undefined when there is nothing to reuse (missing, or a failure past its expiry).
export function cacheGet(cache, key, now) {
  if (!cache.has(key)) return undefined;
  const hit = cache.get(key);
  if (hit && hit.ok === false && typeof hit.expires === "number" && now >= hit.expires) {
    cache.delete(key);
    return undefined;
  }
  return hit;
}

// Clamp text to about `lines` lines of `cpl` characters, with an ellipsis.
export function clampText(s, cpl, lines) {
  const max = Math.max(8, Math.floor(cpl)) * lines;
  s = String(s || "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:]+$/, "") + "…";
}
