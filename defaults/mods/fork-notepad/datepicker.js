// Notion's date picker popover for a date mention: header inputs (date, and time when on),
// month navigation with Today/Now, a Sunday-first month grid, "Include time" toggle, "Clear".
// Not built, on purpose: End date, Date format, Time format, Timezone, Remind (see NOTES in refs/dates).
//   Remind is core in Notion but not wired here: Herdr can only notify while the app runs.
import { div } from "gpui-kit";
import { h_flex, v_flex, Input, InputState } from "gpui-base";
import { parseDateHref, parseTyped, setDate, dateText, monthName } from "./dates.js";

const W = 250, CELL = 32, PAD = 8;
const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const p2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const DEFAULT_TIME = "09:00";   // Notion seeds 9:00 when Include time is switched on (seen in Mobbin)

function time12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${p2(m)} ${h >= 12 ? "PM" : "AM"}`;
}

export class DatePicker {
  constructor() {
    this.href = null;
    this.view = null;                 // {y, m} month on show
    this.cb = null;                   // latest {onChange, onClose}, kept for the submit handlers
    this.dateInput = InputState.new({ placeholder: "Pick a date" });
    this.timeInput = InputState.new({ placeholder: "Time" });
    this.dateInput.on("submit", (_e, cx) => {
      const it = parseTyped(this.dateInput.value(), new Date());
      const p = it && parseDateHref(it.href);
      if (p) this.emit(setDate(this.href ?? it.href, { date: p.date }), cx);
      else this.sync();                // unparseable: put the shown date back
    });
    this.timeInput.on("submit", (_e, cx) => {
      const it = parseTyped(this.timeInput.value(), new Date());
      const p = it && parseDateHref(it.href);
      if (p && p.time) this.emit(setDate(this.href, { time: p.time }), cx);
      else this.sync();
    });
  }

  // Seed from a mention's href.
  open(href) {
    this.href = parseDateHref(href) ? href : "date:" + ymd(new Date());
    const p = parseDateHref(this.href);
    const [y, m] = p.date.split("-").map(Number);
    this.view = { y, m: m - 1 };
    this.sync();
  }

  sync() {
    const p = parseDateHref(this.href);
    if (!p) return;
    this.dateInput.set_value(dateText("date:" + p.date));
    this.timeInput.set_value(p.time ? time12(p.time) : "");
  }

  emit(href, cx) {
    this.href = href;
    this.sync();
    this.cb?.onChange?.(href, cx);
    cx.notify();
  }

  shift(delta) {
    let m = this.view.m + delta, y = this.view.y;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    this.view = { y, m };
  }

  // 6 weeks, Sunday first, with the neighbouring months' days dimmed (as in Notion).
  cells() {
    const { y, m } = this.view;
    const first = new Date(y, m, 1);
    const out = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(y, m, 1 - first.getDay() + i);
      out.push({ d, key: ymd(d), other: d.getMonth() !== m });
    }
    return out;
  }

  render(t, { onChange, onClose }) {
    this.cb = { onChange, onClose };
    if (!this.href) this.open("date:" + ymd(new Date()));
    const p = parseDateHref(this.href);
    const todayKey = ymd(new Date());
    const hasTime = !!p.time;

    const field = (state, w) => h_flex().h(28).px(8).items_center().rounded(6).border(1).border_color(t.border)
      .text_size(13).text_color(t.foreground).w(w).child(Input.new(state));

    const header = h_flex().px(PAD).pt(PAD).gap(6)
      .child(field(this.dateInput, hasTime ? 120 : W - PAD * 2))
      .when(hasTime, (el) => el.child(field(this.timeInput, W - PAD * 2 - 120 - 6)));

    const navBtn = (id, label, delta) => div().id(id).size(24).flex().items_center().justify_center().rounded(6)
      .cursor_pointer().text_size(14).text_color(t.muted).hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { this.shift(delta); cx.notify(); }).child(label);

    const monthRow = h_flex().px(PAD + 2).pt(10).pb(2).items_center().justify_between()
      .child(div().text_size(13).font_semibold().text_color(t.foreground).child(`${monthName(this.view.m)} ${this.view.y}`))
      .child(h_flex().items_center().gap(2)
        .child(div().id("dp-today").px(6).h(24).flex().items_center().rounded(6).cursor_pointer().text_size(12)
          .text_color(t.muted).hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { const n = new Date(); this.view = { y: n.getFullYear(), m: n.getMonth() }; cx.notify(); })
          .child(hasTime ? "Now" : "Today"))
        .child(navBtn("dp-prev", "‹", -1))
        .child(navBtn("dp-next", "›", 1)));

    const weekRow = h_flex().px(PAD).pt(4)
      .children(WEEK.map((w) => div().w(CELL).h(22).flex().items_center().justify_center().text_size(11).text_color(t.dim).child(w)));

    const cells = this.cells();
    const grid = v_flex().px(PAD).pb(PAD).children([0, 1, 2, 3, 4, 5].map((r) =>
      h_flex().children(cells.slice(r * 7, r * 7 + 7).map((c) => {
        const sel = c.key === p.date, today = c.key === todayKey;
        return div().id(`dp-d-${c.key}`).size(CELL).flex_none().flex().items_center().justify_center().rounded(CELL / 2)
          .cursor_pointer().text_size(13)
          .when(sel, (el) => el.bg(t.accent).text_color(t.accent_foreground).font_semibold())
          .when(!sel, (el) => el.text_color(c.other ? t.dim : t.foreground).hover((s) => s.bg(t.hover)))
          .when(today && !sel, (el) => el.border(1).border_color(t.accent))
          .on_click((_e, cx) => this.emit(setDate(this.href, { date: c.key }), cx))
          .child(String(c.d.getDate()));
      }))));

    const toggle = h_flex().id("dp-time").h(28).px(PAD + 2).items_center().justify_between().cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.emit(setDate(this.href, { time: hasTime ? null : DEFAULT_TIME }), cx))
      .child(div().text_size(13).text_color(t.foreground).child("Include time"))
      .child(h_flex().w(28).h(16).rounded(8).p(2).items_center()
        .bg(hasTime ? t.accent : t.border).when(hasTime, (el) => el.justify_end())
        .child(div().size(12).rounded(6).bg(hasTime ? t.accent_foreground : t.popover)));

    const clear = div().id("dp-clear").h(28).px(PAD + 2).flex().items_center().cursor_pointer().text_size(13)
      .text_color(t.muted).hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { onChange?.(null, cx); onClose?.(cx); })   // null = remove the mention
      .child("Clear");

    return v_flex().id("date-picker").w(W).rounded(8).border(1).border_color(t.border).bg(t.popover).shadow_md().overflow_hidden()
      .child(header).child(monthRow).child(weekRow).child(grid)
      .child(div().h(1).bg(t.border))
      .child(v_flex().py(4).child(toggle).child(clear));
  }
}
