// scroll.js: one scroll container for every mod. No native scrollbar, no scrolling unless the content overflows, and a
// short fade (the Claude desktop / Notion kind) at the top when content is scrolled away and at the bottom when more
// is below. Mods can't import across folders, so this file lives in core/ and is copied byte for byte into each mod
// (core/test-scroll.mjs fails when a copy drifts).
//
//   scroller(this, "spaces", { id: "spaces-scroll", bg: t.chrome, outer: (el) => el.flex_1().min_h(0), inner: (el) => el.px(8), children })
//
// The owner (the View) keeps the state in owner._scroll[key]. The host has no way to read a native scroll offset, so
// this owns it: the outer box clips, the inner box is shifted up by the offset, the wheel moves the offset.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";

export const FADE_H = 20;      // px, tall enough to read as a fade, short enough to hide little
const STRIPS = 10;             // the host's background takes a colour, not a gradient: the fade is stacked tints
const EPS = 1;                 // under a pixel of overflow is layout rounding, not overflow

// ---- pure ----------------------------------------------------------------------------------------------------------
export const maxOffset = (content, box) => (content - box > EPS ? content - box : 0);
export const clampOffset = (off, content, box) => Math.min(Math.max(0, Number.isFinite(off) ? off : 0), maxOffset(content, box));
// Which fades show: top only while something is hidden above, bottom only while something is hidden below.
export function fadesFor(off, content, box) {
  const max = maxOffset(content, box), o = clampOffset(off, content, box);
  return { top: max > 0 && o > EPS, bottom: max > 0 && o < max - EPS };
}
// A wheel event moves content by delta.y (negative = content up = scroll down), so the offset goes the other way.
export const wheelOffset = (off, deltaY, content, box) => clampOffset(off - deltaY, content, box);
// "#rgb" | "#rrggbb" | "#rrggbbaa" plus an alpha 0..1 -> "#rrggbbaa" (null when it isn't a hex colour).
export function tint(color, a) {
  let h = String(color ?? "").replace("#", "");
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8 || /[^0-9a-f]/i.test(h)) return null;
  const aa = Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, "0");
  return `#${h.slice(0, 6)}${aa}`;
}
// Alpha of strip i (0 = the edge) of n: smooth from opaque at the edge to clear.
export const stripAlpha = (i, n) => { const x = (i + 0.5) / n; return (1 - x) * (1 - x) * (1 + 2 * x) * 0.9; };   // 1 - smoothstep(x), a touch under solid

// "#rrggbb" or "#rrggbbaa" composited over an opaque base: the colour a translucent row background really shows.
// top absent/null gives base. null when base isn't a hex colour.
export function over(base, top) {
  const hex = (c) => { let h = String(c ?? "").replace("#", ""); if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join(""); return h.length === 6 || h.length === 8 ? (/[^0-9a-f]/i.test(h) ? null : h) : null; };
  const b = hex(base), f = hex(top);
  if (!b) return null;
  if (!f) return `#${b.slice(0, 6)}`;
  const a = f.length === 8 ? parseInt(f.slice(6, 8), 16) / 255 : 1;
  const mix = (i) => Math.round(parseInt(f.slice(i, i + 2), 16) * a + parseInt(b.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0");
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}
// Does text of natural width `need` overflow a box `room` wide? Unmeasured (0 room or no need) is no overflow.
export const overflows = (need, room) => Number.isFinite(need) && Number.isFinite(room) && room > 0 && need - room > EPS;

// ---- element ---------------------------------------------------------------------------------------------------------
function fade(bg, top) {
  const h = FADE_H / STRIPS;
  const el = div().absolute().left(0).right(0).h(FADE_H).flex().flex_col();
  if (top) el.top(0); else el.bottom(0);
  for (let k = 0; k < STRIPS; k++) {
    const i = top ? k : STRIPS - 1 - k;   // the bottom fade is the top one upside down
    const c = tint(bg, stripAlpha(i, STRIPS));
    el.child(div().h(h).flex_none().bg(c ?? "#00000000"));
  }
  return el;
}

// o = { id, bg (the colour behind the list), children, outer(el) -> el (size, handlers), inner(el) -> el (padding, alignment) }
export function scroller(owner, key, o) {
  const s = ((owner._scroll ??= {})[key] ??= { off: 0, box: 0, content: 0 });
  const set = (patch, cx) => {
    const next = { ...s, ...patch };
    next.off = clampOffset(next.off, next.content, next.box);
    const moved = next.off !== s.off || next.box !== s.box || next.content !== s.content;
    Object.assign(s, next);
    if (moved) cx.notify();
  };
  const off = clampOffset(s.off, s.content, s.box);
  const f = fadesFor(off, s.content, s.box);
  const inner = v_flex().id(`${o.id}-content`).w_full().flex_none().mt(-off)
    .on_size_change((z, cx) => set({ content: z.height }, cx))
    .children(o.children);
  const outer = v_flex().id(o.id).relative().overflow_hidden()
    .on_size_change((z, cx) => set({ box: z.height }, cx))
    .on_scroll_wheel((e, cx) => set({ off: wheelOffset(s.off, e.delta.y, s.content, s.box) }, cx))
    .child(o.inner ? o.inner(inner) : inner);
  if (f.top && o.bg) outer.child(fade(o.bg, true));
  if (f.bottom && o.bg) outer.child(fade(o.bg, false));
  return o.outer ? o.outer(outer) : outer;
}

// ---- horizontal text fade (instead of an ellipsis) ----------------------------------------------------------------------
export const FADE_W = 24;      // px, the last stretch of an overflowing name fades into the row's background
const H_STRIPS = 8;            // 3px each

function fadeRight(bg) {
  const w = FADE_W / H_STRIPS;
  const el = h_flex().absolute().top(0).bottom(0).right(0).w(FADE_W);
  for (let k = 0; k < H_STRIPS; k++) {
    const c = tint(bg, stripAlpha(H_STRIPS - 1 - k, H_STRIPS));   // clear at the left, near solid at the right edge
    el.child(div().w(w).h_full().flex_none().bg(c ?? "#00000000"));
  }
  return el;
}

// A one-line name that, when it is wider than its room, fades out to `bg` instead of ending in an ellipsis.
//   fadeLabel(this, `ag-${a.address}`, { text: name, bg: over(t.chrome, hovered ? t.hover : null), style: (el) => el.text_color(c), outer: (el) => el.flex_1().min_w(0) })
// bg = the colour the row really shows right now (the caller tracks hover: normal, hover, selected). The text is measured
// at its natural width (inner) against the room it has (outer); state lives on owner._fit[key], and a redraw is asked only
// when the answer flips. Nothing shared is written from render.
export function fadeLabel(owner, key, o) {
  const fit = (owner._fit ??= new Map());
  const k = fit.get(key) ?? { room: 0, need: 0 };
  const note = (patch, cx) => {
    const was = fit.get(key) ?? k, next = { ...was, ...patch };
    fit.set(key, next);
    if (overflows(next.need, next.room) !== overflows(was.need, was.room)) cx.notify();
  };
  const text = div().id(`${o.id ?? key}-txt`).flex_none().whitespace_nowrap()
    .on_size_change((z, cx) => note({ need: z.width }, cx))
    .child(o.text);
  const outer = h_flex().id(`${o.id ?? key}-fade`).relative().overflow_hidden().items_center()
    .on_size_change((z, cx) => note({ room: z.width }, cx))
    .child(o.style ? o.style(text) : text);
  if (overflows(k.need, k.room) && o.bg) outer.child(fadeRight(o.bg));
  return o.outer ? o.outer(outer) : outer.flex_1().min_w(0);
}
