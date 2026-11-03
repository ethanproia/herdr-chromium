// Notion-style page icon picker: Emoji / Icons tabs, filter box, Recent + categories, Remove.
// Icon strings: an emoji character, or "icon:<name>" (mods/fork-notepad/icons/<name>.svg).
import { div, svg } from "gpui-kit";
import { h_flex, v_flex, Input, InputState } from "gpui-base";
import { categories, search } from "./emoji.js";

export const ICON_NAMES = ["file", "note", "book", "bookmark", "star", "heart", "flag", "home", "folder", "inbox",
  "calendar", "clock", "bell", "check", "list", "code", "terminal", "bolt", "sun", "moon",
  "leaf", "globe", "map", "pin", "camera", "music", "image", "pen", "pencil", "brush",
  "lightbulb", "rocket", "gift", "coffee", "chat", "mail", "lock", "key", "gear", "chart"];

const RECENT_KEY = "notepad.recent";
const RECENT_MAX = 18;
const W = 408, H = 356, CELL = 32, PAD = 8;

function loadRecent() {
  try {
    const a = JSON.parse(globalThis.localStorage?.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(a) ? a.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch { return []; }
}
function saveRecent(list) {
  try { globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
}

export function iconElement(icon, size, t) {
  if (typeof icon === "string" && icon.startsWith("icon:"))
    return svg(`mods/fork-notepad/icons/${icon.slice(5)}.svg`).size(size).text_color(t.muted);
  return div().flex_none().text_size(size).line_height(`${Math.round(size * 1.15)}px`).child(icon ?? "");
}

export class IconPicker {
  constructor() {
    this.input = InputState.new({ placeholder: "Filter..." });
    this.tab = "emoji";
    this.recent = loadRecent();
    this.cb = null;
    this.input.on("change", (_e, cx) => cx.notify());
    this.input.on("submit", (_e, cx) => {
      const first = this.results()[0];
      if (first && this.cb) this.pick(first, this.cb.onPick, cx);
    });
  }

  reset() {
    this.tab = "emoji";
    this.input.set_value?.("");
    this.recent = loadRecent();
  }

  onKey(_e, _cx) { return false; }   // Escape belongs to the lead

  query() { return (this.input.value() ?? "").trim().toLowerCase(); }

  results() {
    const q = this.query();
    if (this.tab === "icons") {
      const names = q ? ICON_NAMES.filter((n) => n.includes(q)) : ICON_NAMES;
      return names.map((n) => `icon:${n}`);
    }
    return q ? search(q) : [];
  }

  pick(icon, onPick, cx) {
    this.recent = [icon, ...this.recent.filter((x) => x !== icon)].slice(0, RECENT_MAX);
    saveRecent(this.recent);
    onPick?.(icon, cx);
  }

  render(t, { onPick, onRemove }) {
    this.cb = { onPick, onRemove };
    const q = this.query();
    const body = v_flex().id("ip-body").flex_1().min_h_0().px(PAD).pb(PAD).gap(4).overflow_y_scrollbar();
    const label = (s) => div().px(2).pt(8).pb(2).text_size(12).text_color(t.dim).child(s);
    const grid = (id, items) => h_flex().flex_wrap().children(items.map((ic, i) => this.cell(t, `${id}-${i}`, ic, onPick)));

    if (this.tab === "icons") {
      const r = this.results();
      body.child(label("Icons"));
      body.child(r.length ? grid("ic", r) : div().px(2).py(8).text_size(13).text_color(t.muted).child("No results"));
    } else if (q) {
      const r = this.results();
      body.child(r.length ? grid("es", r) : div().px(2).py(8).text_size(13).text_color(t.muted).child("No results"));
    } else {
      if (this.recent.length) body.child(label("Recent")).child(grid("rc", this.recent));
      for (const c of categories) body.child(label(c.name)).child(grid(`c-${c.name}`, c.items.map((x) => x[0])));
    }

    const tab = (id, name) => div().id(`ip-tab-${id}`).px(2).h(26).flex().items_center().cursor_pointer().text_size(13)
      .border_b(2).border_color(this.tab === id ? t.foreground : t.popover)
      .text_color(this.tab === id ? t.foreground : t.muted)
      .on_click((_e, cx) => { this.tab = id; cx.notify(); })
      .child(name);

    return v_flex().id("icon-picker").w(W).h(H).rounded(8).border(1).border_color(t.border).bg(t.popover).shadow_md().overflow_hidden()
      .child(h_flex().px(PAD + 4).pt(PAD).items_center().justify_between()
        .child(h_flex().gap(12).child(tab("emoji", "Emoji")).child(tab("icons", "Icons")))
        .child(div().id("ip-remove").px(6).h(24).flex().items_center().rounded(6).cursor_pointer().text_size(12).text_color(t.muted)
          .hover((s) => s.bg(t.hover)).on_click((_e, cx) => onRemove?.(cx)).child("Remove")))
      .child(div().px(PAD).py(PAD)
        .child(h_flex().h(28).px(8).items_center().rounded(6).border(1).border_color(t.border).text_size(13).text_color(t.foreground)
          .child(Input.new(this.input))))
      .child(body);
  }

  cell(t, id, icon, onPick) {
    const el = div().id(`ip-${id}`).size(CELL).flex_none().flex().items_center().justify_center().rounded(6).cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.pick(icon, onPick, cx));
    return el.child(icon.startsWith("icon:") ? iconElement(icon, 18, { ...t, muted: t.foreground }) : iconElement(icon, 22, t));
  }
}
