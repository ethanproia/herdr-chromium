// Role "inbox": the bell's panel (a popup, props { role: "inbox", height }). Header: "Notifications", the Do Not
// Disturb state and three compact actions (Mark All Read, Do Not Disturb, Clear All). Below: newest first, grouped
// by day. A row click runs its action (unless stale), marks it read and closes; hover shows × to clear one row.
// Without the notification API (stock Herdr) it draws the empty state and never calls anything missing.
import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, props, closeOverlay, run } from "herdr";
import { icon, groupLabel } from "../look.js";
import { scroller, fadeLabel, over } from "../scroll.js";
import { inboxSnapshot, markRead, clearNotifications, setDnd } from "../notes.js";
import { groupByDay, relTime, rowState, rowIcon, rowClickPlan, actionAllowed, inboxHeight, HEAD_H, ROW_H, ROW_H_ONE, PAD } from "../inbox-pure.js";

const TONE = (t, tone) => (tone === "error" ? t.blocked : tone === "warning" ? (t.ansi3 ?? t.blocked) : tone === "success" ? t.done : null);

export default class Inbox {
  init(_p, cx) {
    this.hover = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    // Relative times ("5m") move on by themselves: a gentle redraw, nothing written.
    cx.timer.every(30000, (cx) => cx.notify());
  }

  close() { closeOverlay(props()?.overlay); }

  click(it) {
    const plan = rowClickPlan(it);
    // rowClickPlan already drops names outside the allow-list. Check again at the run() call so a
    // plan that was built some other way cannot start terminal.kill or any other command.
    if (plan.run && actionAllowed(plan.run.name)) run(plan.run.name, plan.run.args);
    markRead(plan.markRead);
    if (plan.close) this.close();
  }

  // A compact 24px icon button for the header (tooltip names it); `on` = a held state (Do Not Disturb).
  headButton(t, id, ic, tip, action, { on = false, enabled = true } = {}) {
    return div().id(id).size(24).flex_none().flex().items_center().justify_center().rounded(6)
      .bg(on ? t.selected : t.popover).text_color(on ? t.foreground : enabled ? t.muted : t.dim)
      .when(enabled, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => { action(); cx.notify(); }))
      .tooltip(tip)
      .child(svg(icon(ic)).size(15));
  }

  row(t, it, now) {
    const s = rowState(it);
    const hot = this.hover === it.id;
    const bg = hot ? over(t.popover, t.hover) : t.popover;
    const ri = rowIcon(it);
    const glyph = ri.path ? svg(ri.path).size(15) : svg(icon(ri.name)).size(15);
    const tone = TONE(t, ri.tone);
    return h_flex().id(`nt-${it.id}`).h(s.tall ? ROW_H : ROW_H_ONE).px(8).gap(10).rounded(6).items_center().flex_none()
      .when(hot, (el) => el.bg(t.hover)).when(s.dim, (el) => el.opacity(0.5))
      .cursor_pointer()
      .on_hover((h, cx) => { const next = h ? it.id : (this.hover === it.id ? null : this.hover); if (next !== this.hover) { this.hover = next; cx.notify(); } })
      .on_click(() => this.click(it))
      // 16px icon slot, top-aligned with the title line on a two-line row.
      .child(div().size(16).flex_none().flex().items_center().justify_center().when(s.tall, (el) => el.self_start().mt(8))
        .text_color(tone ?? (s.unread ? t.foreground : t.muted)).child(glyph))
      .child(v_flex().flex_1().min_w(0).justify_center()
        .child(h_flex().items_center().gap(6).min_w(0)
          .child(fadeLabel(this, `nt-title-${it.id}`, { text: it.title || it.from || "Notification", bg,
            style: (el) => el.text_size(13).line_height("18px").text_color(s.unread ? t.foreground : t.muted).when(s.unread, (x) => x.font_weight(500)),
            outer: (el) => el.flex_1().min_w(0) }))
          .when(Boolean(s.countLabel), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(s.countLabel)))
          .child(div().flex_none().text_size(11).text_color(t.dim).child(relTime(it.ts, now))))
        .when(s.tall, (el) => el.child(div().min_w(0).truncate().text_size(11).line_height("16px").text_color(t.dim).child(it.body))))
      // Right: the unread dot at rest, a small × on hover (clears just this one).
      .child(div().size(16).flex_none().flex().items_center().justify_center()
        .when(hot, (el) => el.id(`nt-x-${it.id}`).rounded(4).text_color(t.dim).hover((x) => x.text_color(t.foreground))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => { cx.stop_propagation(); clearNotifications(it.id); if (this.hover === it.id) this.hover = null; cx.notify(); })
          .tooltip("Clear").child(svg(icon("close")).size(12)))
        .when(!hot && s.unread, (el) => el.child(div().size(6).rounded(3).bg(t.accent))));
  }

  render(_cx) {
    const t = theme();
    const snap = inboxSnapshot();
    const now = Date.now();
    const items = snap?.items ?? [];
    const dnd = snap?.settings?.dnd === true;
    const H = Number(props()?.height) || inboxHeight(snap, now);
    const head = h_flex().id("inbox-head").h(HEAD_H).flex_none().pl(12).pr(8).gap(4).items_center().border_b(1).border_color(t.border)
      .child(div().flex_none().text_size(13).font_weight(600).text_color(t.foreground).child("Notifications"))
      .when(dnd, (el) => el.child(h_flex().flex_none().ml(4).gap(4).items_center().text_size(11).text_color(t.dim)
        .child(svg(icon("bell-off")).size(12)).child("Do Not Disturb")))
      .child(div().flex_1())
      .when(Boolean(snap), (el) => el
        .child(this.headButton(t, "inbox-read", "check-check", "Mark All Read", () => markRead("all"), { enabled: items.some((x) => !x.read) }))
        .child(this.headButton(t, "inbox-dnd", dnd ? "bell-off" : "bell", dnd ? "Turn Off Do Not Disturb" : "Do Not Disturb", () => setDnd(!dnd), { on: dnd }))
        .child(this.headButton(t, "inbox-clear", "trash", "Clear All", () => { clearNotifications("all"); this.hover = null; }, { enabled: items.length > 0 })));
    const body = !items.length
      ? div().flex_1().min_h(0).flex().items_center().justify_center().text_size(13).text_color(t.dim).child("No notifications")
      : scroller(this, "inbox", {
          id: "inbox-list", bg: t.popover,
          outer: (el) => el.flex_1().min_h(0),
          inner: (el) => el.px(4).py(PAD),
          children: groupByDay(items, now).map((g) => v_flex().flex_none()
            .child(groupLabel(t, g.label))
            .children(g.items.map((it) => this.row(t, it, now)))),
        });
    return v_flex().id("inbox").track_focus(this.handle).w_full().h(H).bg(t.popover)
      .on_key_down((e) => { if (e.key === "escape") this.close(); })
      .child(head)
      .child(body);
  }
}
