// Embeds for the Notepad: image, link bookmark, embedded file. Never throws from render.
// Look-alikes (saved in refs/embeds/, Mobbin captures of Notion web):
//  - Bookmark card: refs/embeds/notion-bookmark-card.webp (full-width bordered card, title 14, 2-line muted
//    description 12, favicon + url row, cropped thumbnail on the right).
//  - Image block: refs/embeds/notion-image-caption.webp (fit to content width, radius 4, caption 12 muted below).
//  - Embedded file (Obsidian ![[ ]] look; Mobbin has no Obsidian, so the left-rule block follows Notion's quote):
//    refs/embeds/notion-quote-leftborder.webp, with a small "filename ... Open" header row.
import { div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, home, appHome, run } from "herdr";
import { parseMeta, hashKey, extOf, isRemote, excerpt, lineOf, fit, cover, clampText, domainOf, cacheGet, cacheSet, FAIL_TTL } from "./embeds-core.js";
import { openableUrl } from "./rows.js";

const FILE_RECHECK_MS = 2000;
const CACHE_REL = "mods/fork-notepad/.cache";   // image() paths are relative to ~/.config/herdr-app
const FETCH_MS = 5000, FETCH_CAP = 512 * 1024, FILE_LINES = 20;
const MAX_IMG_H = 520;

const expand = (p) => (p.startsWith("~/") ? home() + p.slice(1) : p);
const keyOf = (e) => e.kind + ":" + (e.src || e.url || e.path);

async function dims(path) {
  try {
    const r = await exec("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path]);
    const w = /pixelWidth:\s*(\d+)/.exec(r.stdout), h = /pixelHeight:\s*(\d+)/.exec(r.stdout);
    if (r.code === 0 && w && h) return { w: Number(w[1]), h: Number(h[1]) };
  } catch { /* no size: caller falls back */ }
  return null;
}

// Download a remote image once; returns {path (relative to appHome), w, h} or null.
async function cached(url) {
  try {
    const name = `${hashKey(url)}.${extOf(url)}`;
    const abs = `${appHome()}/${CACHE_REL}/${name}`;
    let d = await dims(abs);
    if (!d) {
      await exec("mkdir", ["-p", `${appHome()}/${CACHE_REL}`]);
      await exec("curl", ["-sL", "-m", "10", "-o", abs, url]);
      d = await dims(abs);
      if (!d) { await exec("rm", ["-f", abs]); return null; }   // not an image (html error page etc.)
    }
    return { path: `${CACHE_REL}/${name}`, ...d };
  } catch { return null; }
}

async function withTimeout(p, ms, cx) {
  let timer = null;
  const t = new Promise((_, rej) => { timer = cx.timer.after(ms, () => rej(new Error("timeout"))); });
  try { return await Promise.race([p, t]); } finally { try { timer && timer.cancel && timer.cancel(); } catch { /* ok */ } }
}

async function load(e, cx) {
  if (e.kind === "image") {
    if (isRemote(e.src)) {
      const c = await cached(e.src);
      return c ? { ok: true, ...c } : { ok: false, why: "Could not load image" };
    }
    const path = expand(e.src);
    const d = await dims(path);
    return d ? { ok: true, path, ...d } : { ok: false, why: "Image not found" };
  }
  if (e.kind === "bookmark") {
    let meta = { title: "", description: "", image: "", favicon: "", domain: domainOf(e.url) };
    try {
      const html = await withTimeout(fetch(e.url).then((r) => r.text()), FETCH_MS, cx);
      meta = parseMeta(html.slice(0, FETCH_CAP), e.url);
    } catch { /* offline or slow: the card still shows the url */ }
    const [thumb, icon] = await Promise.all([meta.image ? cached(meta.image) : null, meta.favicon ? cached(meta.favicon) : null]);
    return { ok: true, ...meta, thumb, icon };
  }
  if (e.kind === "file") {
    const path = expand(e.path);
    const text = await readTextFile(path).catch(() => null);
    if (text === null || text === undefined) return { ok: false, why: "File not found", path };
    return { ok: true, path, name: path.slice(path.lastIndexOf("/") + 1), ...excerpt(text, FILE_LINES) };
  }
  return { ok: false, why: "" };
}

export class Embeds {
  constructor() { this.cache = new Map(); this.busy = new Set(); this.checked = new Map(); }
  // At most 3 loads at once (the rest start as these finish and redraw); keep the newest 200 results.
  static MAX_LOADS = 3;
  static MAX_CACHE = 200;

  get(embed, cx) {
    try {
      const k = keyOf(embed);
      const hit = cacheGet(this.cache, k, Date.now());
      if (hit) {
        // An embedded file on screen is re-read at most every 2 s; it redraws only when its text changed.
        if (embed.kind === "file" && hit.ok && Date.now() - (this.checked.get(k) ?? 0) > FILE_RECHECK_MS && !this.busy.has(k)) {
          this.checked.set(k, Date.now());
          this.busy.add(k);
          cx.spawn(async (cx) => {
            let data;
            try { data = await load(embed, cx); } catch { data = null; }
            this.busy.delete(k);
            if (data && JSON.stringify(data) !== JSON.stringify(hit)) { cacheSet(this.cache, k, data, Date.now(), Embeds.MAX_CACHE); cx.notify(); }
          });
        }
        return hit;
      }
      if (!this.busy.has(k) && this.busy.size < Embeds.MAX_LOADS) {
        this.busy.add(k);
        cx.spawn(async (cx) => {
          let data;
          try { data = await load(embed, cx); } catch { data = { ok: false, why: "Could not load" }; }
          cacheSet(this.cache, k, data, Date.now(), Embeds.MAX_CACHE);
          this.busy.delete(k);
          // A failure is shown until it expires, then one redraw tries again. Successes stay cached.
          if (!data?.ok) cx.timer.after(FAIL_TTL, (cx) => cx.notify());
          cx.notify();
        });
      }
    } catch { /* render falls back to the skeleton */ }
    return null;
  }

  render(t, embed, data, width) {
    try {
      width = Math.max(120, Math.floor(width || 400));
      const id = "emb-" + hashKey(keyOf(embed));
      if (!data) return skeleton(t, id, embed);
      if (!data.ok) return quiet(t, id, `${data.why || "Unavailable"}${embed.alt ? ": " + embed.alt : ""}`);
      if (embed.kind === "image") return imageBlock(t, id, embed, data, width);
      if (embed.kind === "bookmark") return bookmark(t, id, embed, data, width);
      if (embed.kind === "file") return fileBlock(t, id, embed, data, width);
      return skeleton(t, id, embed);
    } catch {
      return div().id("emb-err").h(20);
    }
  }
}

// Loading: one quiet raised row (Notion's empty block tone).
function skeleton(t, id, embed) {
  const h = embed.kind === "bookmark" ? 64 : embed.kind === "image" ? 120 : 56;
  return div().id(id).w_full().h(h).rounded(6).bg(t.raised);
}

function quiet(t, id, text) {
  return h_flex().id(id).w_full().h(36).px(12).items_center().rounded(6).bg(t.raised)
    .child(div().text_size(12).text_color(t.muted).truncate().child(text));
}

// Notion image block: natural size up to the content width, radius 4, 12px muted caption.
function imageBlock(t, id, embed, d, width) {
  const f = fit(d.w, d.h, width, MAX_IMG_H);
  return v_flex().id(id).w_full().py(4).gap(6)
    .child(div().w(f.w).h(f.h).rounded(4).overflow_hidden().child(image(d.path).w(f.w).h(f.h)))
    .when(Boolean(embed.alt), (el) => el.child(div().text_size(12).line_height("16px").text_color(t.muted).child(embed.alt)));
}

// Notion bookmark: bordered card, text column left, optional cropped thumbnail right (1/3 width).
function bookmark(t, id, embed, d, width) {
  const H = 88, thumbW = d.thumb ? Math.round(width / 3) : 0;
  const textW = width - thumbW - 28;
  const title = d.title || d.domain || embed.url;
  const card = h_flex().id(id).w_full().h(H).rounded(6).border(1).border_color(t.border).overflow_hidden()
    .cursor_pointer().hover((s) => s.bg(t.hover))
    .on_click(() => { const url = openableUrl(embed.url); if (url) exec("open", [url]).catch(() => {}); });
  const col = v_flex().flex_1().min_w(0).h_full().px(14).py(10).gap(4).justify_between()
    .child(v_flex().gap(2)
      .child(div().text_size(14).line_height("20px").text_color(t.foreground).truncate().child(title))
      .when(Boolean(d.description), (el) => el.child(div().h(32).overflow_hidden().text_size(12).line_height("16px").text_color(t.muted)
        .child(clampText(d.description, textW / 6.3, 2)))))
    .child(h_flex().gap(6).items_center()
      .when(Boolean(d.icon), (el) => el.child(div().size(16).flex_none().rounded(2).overflow_hidden().child(image(d.icon.path).w(16).h(16))))
      .child(div().text_size(12).line_height("16px").text_color(t.muted).truncate().child(embed.url)));
  card.child(col);
  if (d.thumb) {
    const c = cover(d.thumb.w, d.thumb.h, thumbW, H - 2);
    card.child(div().w(thumbW).h_full().flex_none().relative().overflow_hidden()
      .child(image(d.thumb.path).absolute().left(c.x).top(c.y).w(c.w).h(c.h)));
  }
  return div().w_full().py(4).child(card);
}

// Obsidian-style embedded note: left rule, small header row (name + Open), first lines as plain styled text.
function fileBlock(t, id, embed, d, width) {
  const lines = d.lines.map(lineOf);
  const row = (l, i) => {
    const base = div().text_size(13).line_height("20px").text_color(t.foreground);
    if (l.kind === "h") return div().mt(i ? 6 : 0).text_size(l.level === 1 ? 18 : l.level === 2 ? 15 : 14).line_height(l.level === 1 ? "26px" : "22px").font_weight(700).text_color(t.foreground).child(l.text || " ");
    if (l.kind === "bullet") return h_flex().pl(l.depth * 16).gap(8).child(div().w(10).flex_none().text_size(13).line_height("20px").text_color(t.muted).child("•")).child(base.flex_1().min_w(0).child(l.text));
    if (l.kind === "task") return h_flex().gap(8).child(div().w(10).flex_none().text_size(13).line_height("20px").text_color(t.muted).child(l.checked ? "☑" : "☐")).child(base.flex_1().min_w(0).child(l.text));
    if (l.kind === "number") return h_flex().gap(8).child(div().flex_none().text_size(13).line_height("20px").text_color(t.muted).child(l.n + ".")).child(base.flex_1().min_w(0).child(l.text));
    if (l.kind === "quote") return div().border_l(2).border_color(t.border).pl(10).text_size(13).line_height("20px").text_color(t.muted).child(l.text || " ");
    if (l.kind === "hr") return div().my(8).h(1).w_full().bg(t.border);
    if (l.kind === "fence") return base.text_color(t.dim).child(l.text);
    return base.child(l.text || " ");
  };
  const open = h_flex().id(id + "-open").h(20).px(6).items_center().rounded(4).cursor_pointer().flex_none()
    .hover((s) => s.bg(t.hover)).on_click(() => { run("pane.split", { direction: "right", mod: "fork-notepad-view", props: { view: d.path } }); })
    .child(div().text_size(12).text_color(t.muted).child("Open"));
  return div().w_full().py(4).child(
    v_flex().id(id).w_full().border_l(3).border_color(t.border).pl(14).pr(4).py(2).gap(2)
      .child(h_flex().items_center().gap(8).child(div().flex_1().min_w(0).text_size(12).line_height("16px").text_color(t.muted).truncate().child(d.name)).child(open))
      .children(lines.map(row))
      .when(d.more, (el) => el.child(div().text_size(12).text_color(t.dim).child("…"))));
}
