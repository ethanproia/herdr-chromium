// Role "header-menu": the ••• popup a narrow pane header opens for Copy and that tool's own buttons.
// Props: { role: "header-menu", pane, mod, copy, items }. `items` is the tool's header list; each action
// is the same typed action the wide buttons run. This menu is core's, so a plugin does not have to
// understand a Notepad-only { headerMenu } popup. ↑/↓ move, Enter runs, Esc closes.
import { div, svg } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme, props, closeOverlay, shared, notify } from "herdr";
import { menuRow, icon, runPaneCopy, runHeaderAction } from "../look.js";
import { menuHeight, headerMenuEntries, headerMenuElId, headerMenuChoose, beginHeaderMenuChoice } from "../pure.js";

export default class HeaderMenu {
  init(_p, cx) {
    this.at = 0;
    this.busy = false;
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  entries() {
    const p = props() ?? {};
    return headerMenuEntries(p.items, p.copy);
  }

  choose(entry, cx) {
    const p = props() ?? {};
    const step = headerMenuChoose(entry, this.busy);
    // Every copy, not only the note flush, stays up until its promise settles. Closing first
    // can tear this view down and drop the clipboard write. busy blocks click and Enter for
    // that wait: a second note flush would replace notepad.flushReq.
    if (step === "ignore") return;
    if (step === "hold") this.busy = true;
    // Copies wait across awaits, so the whole choice runs in an AsyncContext from cx.spawn
    // (a click's cx expires at its first await).
    const go = (cx) => beginHeaderMenuChoice(step, {
      copy: () => runPaneCopy(entry.copy?.[0], entry.copy?.[1], p.mod, cx).then((ok) => {
        if (ok) notify({ title: "Copied", timeout: 1500 });
      }),
      action: () => runHeaderAction(entry.action, { pane: p.pane, mod: p.mod }),
      close: () => {
        this.busy = false;
        closeOverlay(p.overlay);
      },
      sleep: cx ? (ms) => cx.sleep(ms) : undefined,
    });
    const settle = (pending) => { if (pending && typeof pending.catch === "function") pending.catch(() => { this.busy = false; }); };
    if (cx?.spawn) cx.spawn(async (cx) => { try { await go(cx); } catch { this.busy = false; } });
    else settle(go(undefined));
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const list = this.entries();
    if (this.at >= list.length) this.at = 0;
    const hint = (entry) => {
      if (entry.kind !== "action" || !entry.action.toggleShared) return "";
      return shared(entry.action.toggleShared) === true ? "On" : "Off";
    };
    return v_flex()
      .id("header-menu")
      .track_focus(this.handle)
      .w_full()
      .h(menuHeight(list.length, 0))
      .p(4)
      .bg(t.popover)
      .on_key_down((e, cx) => {
        if (e.key === "escape") return closeOverlay(p.overlay);
        if (!list.length) return;
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") {
          if (headerMenuChoose(list[this.at], this.busy) === "ignore") return;
          this.choose(list[this.at], cx);
        }
        else return;
        cx.notify();
      })
      .children(
        list.map((entry, i) => menuRow({
          t,
          id: headerMenuElId(entry),
          icon: svg(entry.icon || icon(entry.kind === "copy" ? "copy" : "plus")).size(16),
          name: entry.label,
          hint: hint(entry),
          active: i === this.at,
          onClick: (_e, cx) => this.choose(entry, cx),
          onHover: (cx) => { if (this.at !== i) { this.at = i; cx.notify(); } },
        })),
      );
  }
}
