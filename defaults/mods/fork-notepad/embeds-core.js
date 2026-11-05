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

// Image cache caps: the download cache sweeps itself after each fetch.
export const CACHE_MAX_FILES = 200;
export const CACHE_MAX_BYTES = 200 * 1024 * 1024;

// Which files to delete so the folder is under `maxFiles` files and `maxBytes` bytes.
// files: [{name, size, mtime}]; the smallest mtime goes first. Equal mtimes keep
// their incoming order (stat follows `ls`, so a same-second tie is alphabetical).
// `keep` (a Set or a list of names) counts toward both caps but is never deleted:
// a file this process just fetched, or is about to return, must survive the sweep.
export function evictList(files, maxFiles, maxBytes, keep) {
  const pinned = keep instanceof Set ? keep : new Set(keep || []);
  const list = (files || []).slice().sort((a, b) => (a.mtime || 0) - (b.mtime || 0));
  let n = list.length, bytes = 0;
  for (const f of list) bytes += f.size || 0;
  const out = [];
  for (const f of list) {
    if (n <= maxFiles && bytes <= maxBytes) break;
    if (pinned.has(f.name)) continue;
    out.push(f.name);
    n--;
    bytes -= f.size || 0;
  }
  return out;
}

// Lines from BSD `stat -f "%m %z %N"`. A line that is not `<mtime> <size> <path>`
// is skipped, so one bad line does not drop the rest. `dir` is the cache directory;
// only a path under that directory yields a name (the path with the dir prefix removed).
// A matching line for some other path is ignored, so a format mismatch cannot invent
// a name and delete it.
export function parseStat(out, dir) {
  const files = [];
  const prefix = String(dir ?? "").replace(/\/+$/, "") + "/";
  for (const line of String(out ?? "").split("\n")) {
    const m = /^(\d+) (\d+) (.+)$/.exec(line);
    if (!m || !m[3].startsWith(prefix)) continue;
    const name = m[3].slice(prefix.length);
    if (name) files.push({ name, size: Number(m[2]), mtime: Number(m[1]) });
  }
  return files;
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

// Only fetch public web pages: http(s) only, and never this machine or the local network (a note could hold
// file:///…/.ssh/id_rsa or http://127.0.0.1:<port>/…). Redirects are checked hop by hop (fetchHops). Literal
// hosts only: a public name that resolves to a private address (DNS rebinding) is not caught here.
export function isSafeFetchUrl(url) {
  let u;
  try { u = new URL(String(url ?? "")); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".") && !h.includes(":")) return false;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;   // CGNAT, Tailscale
    return true;
  }
  if (/^[\d.]+$/.test(h) || /^0x/.test(h)) return false;   // odd IPv4 spellings (2130706433, 0x7f.1)
  if (h.includes(":")) {
    if (h === "::" || h === "::1") return false;
    if (/^(fe[89ab]|fc|fd|ff)/.test(h)) return false;     // link-local, unique-local, multicast
    if (h.startsWith("::ffff:")) return false;            // IPv4-mapped: refuse rather than decode
    return true;
  }
  return true;
}

// curl flags for every embed fetch: web protocols only, and curl never follows a redirect itself (no -L);
// fetchHops follows them so each hop passes isSafeFetchUrl.
// Also: no URL globbing ([a-z] / {a,b} in a note's link), and no proxy from the environment. Callers put "-q" (skip
// ~/.curlrc) as curl's very first argument; curl ignores it anywhere else.
export const CURL_SAFE = ["--proto", "=http,https", "--max-redirs", "0", "--globoff", "--noproxy", "*"];
export const MAX_HOPS = 3;

// Cap curl's body at the first argument's byte count and exit with curl's status.
// head closes the pipe once it has that many bytes, so a chunked response with no
// Content-Length is not stored in full (--max-filesize only applies when the length
// is declared). curl's status is saved aside: the pipeline's own status would be
// head's 0, and a connect failure would never try the next address.
// The pipeline is in the background. A shell defers INT and TERM until a foreground
// pipeline finishes, so a killed fetch would wait out curl's -m and could leave curl
// running. wait is interrupted at once; the trap kills curl and head, and EXIT removes
// the status files.
export const CURL_BODY_SCRIPT = `n=$1; shift
rcf=$(mktemp "\${TMPDIR:-/tmp}/notepad-rc.XXXXXX") || exit 1
pf=$(mktemp "\${TMPDIR:-/tmp}/notepad-rc.XXXXXX") || { rm -f -- "$rcf"; exit 1; }
hpid=
trap 'rm -f -- "$rcf" "$pf"' EXIT
trap 'c=$(cat "$pf" 2>/dev/null || true); [ -n "$c" ] && kill "$c" 2>/dev/null; [ -n "$hpid" ] && kill "$hpid" 2>/dev/null; wait; exit 130' INT
trap 'c=$(cat "$pf" 2>/dev/null || true); [ -n "$c" ] && kill "$c" 2>/dev/null; [ -n "$hpid" ] && kill "$hpid" 2>/dev/null; wait; exit 143' TERM
{
  curl "$@" &
  echo $! > "$pf"
  wait $!
  echo $? > "$rcf"
} | head -c "$n" &
hpid=$!
wait
rc=$(cat "$rcf" 2>/dev/null || true)
case "$rc" in
  ''|*[!0-9]*) exit 1 ;;
esac
exit "$rc"
`;

// curl's CURLE_COULDNT_CONNECT. A later address of the same name is tried only for this status.
export const CURL_COULDNT_CONNECT = 7;
// Lookup returned nothing (no dig, split DNS, empty answer). Not the same as a private address.
export const RESOLVE_ERROR = "could not resolve host";

// Fetch `url`, following at most MAX_HOPS redirects, each checked before it is fetched. `once(url, extra)` runs
// one curl and resolves to { redirect, result } (redirect = curl's %{redirect_url}, "" when there is none).
// Resolves to { url, result } for the final page, { error: RESOLVE_ERROR } when the name has no addresses,
// or null when a hop is refused or there are too many.
// `pin(url)` returns pinArgs: null to refuse, { error: RESOLVE_ERROR } when lookup found nothing, [] when no
// pin is needed, or a list of curl arg lists (one checked address each). A connect failure tries the next list.
export async function fetchHops(url, once, maxHops = MAX_HOPS, pin = null) {
  let cur = url;
  for (let hop = 0; hop <= maxHops; hop++) {
    if (!isSafeFetchUrl(cur)) return null;
    const extra = pin ? await pin(cur) : [];
    if (extra && extra.error === RESOLVE_ERROR) return { error: RESOLVE_ERROR };
    if (!extra) return null;
    const attempts = extra.length === 0 ? [[]] : (Array.isArray(extra[0]) ? extra : [extra]);
    let r;
    for (let i = 0; i < attempts.length; i++) {
      r = await once(cur, attempts[i]);
      if (Number(r?.result?.code) === CURL_COULDNT_CONNECT && i + 1 < attempts.length) continue;
      break;
    }
    const next = String(r?.redirect ?? "").trim();
    if (!next) return { url: cur, result: r?.result };
    let abs;
    try { abs = new URL(next, cur).href; } catch { return null; }
    cur = abs;
  }
  return null;
}

// Why a fetch result must not be parsed. Null means the page is usable (including a curl that connected
// and failed; that is not a refused address and not a lookup failure).
export function loadFailure(got) {
  if (got && got.error === RESOLVE_ERROR) return RESOLVE_ERROR;
  if (!got || got.error) return "not a public web address";
  return null;
}

// A public name can resolve to this machine or the local network. Check every address the name resolves to
// (`lookup(host)` -> list of IPs) and pin curl with --resolve, so curl never resolves the name again.
// Any private address refuses the fetch (null). No address is RESOLVE_ERROR, not a refusal.
// Each returned list pins one checked address; fetchHops tries the next only after a connect failure.
export async function pinArgs(url, lookup) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return [];   // a literal address: isSafeFetchUrl already checked it
  let ips;
  try { ips = await lookup(host); } catch { return { error: RESOLVE_ERROR }; }
  ips = (ips || []).map((x) => String(x).trim()).filter(Boolean);
  if (!ips.length) return { error: RESOLVE_ERROR };
  const lit = (ip) => (ip.includes(":") ? `[${ip}]` : ip);
  if (!ips.every((ip) => isSafeFetchUrl(`http://${lit(ip)}/`))) return null;
  const seen = new Set();
  ips = ips.filter((ip) => (seen.has(ip) ? false : seen.add(ip)));
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  return ips.map((ip) => ["--resolve", `${host}:${port}:${lit(ip)}`]);
}

// dig treats a bare name starting with "-" or "+" as an option (`-f` reads a batch file).
// The name is the argument of `-q`, so it is only the query.
export function digArgs(host, type) {
  return ["+short", "+time=2", "+tries=1", "-q", String(host), type];
}

// The addresses in `dig +short` output (CNAME lines end with "." and are skipped).
export function ipsFromDig(out) {
  return String(out || "").split("\n").map((l) => l.trim())
    .filter((l) => /^\d+\.\d+\.\d+\.\d+$/.test(l) || (/^[0-9a-f:]+$/i.test(l) && l.includes(":")));
}

// Cache file names an open note still draws: every successful result in an Embeds cache (an image's path,
// a bookmark's thumb and icon) that lives under `rel`. The sweep never deletes these, so an image on screen
// never loses its file while its cache entry still says ok.
export function heldNames(entries, rel) {
  const out = new Set();
  const add = (p) => { if (typeof p === "string" && p.startsWith(rel + "/")) out.add(p.slice(rel.length + 1)); };
  for (const v of entries || []) {
    if (!v || v.ok !== true) continue;
    add(v.path); add(v.thumb?.path); add(v.icon?.path);
  }
  return out;
}
