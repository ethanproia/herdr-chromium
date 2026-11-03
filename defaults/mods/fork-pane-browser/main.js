// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "fork-pane-browser" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, agents, props, run, theme, home, shared, setShared, openOverlay } from "herdr";

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

// Mod panes get a proper name and icon, matching agent headers.
const MOD_HEADS = {
  notepad: { name: "Notepad", icon: "mods/fork-notepad/note.svg" },
  "fork-split-chooser": { name: "New panel", icon: "mods/fork-split-chooser/panel.svg", folder: "" },
};

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

function parentDir(path) {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : "";
}

// A file viewer is the notepad mod opened with props.view, or the notepad-view mod.
// Its header must not offer the shared note's Markdown / Export controls or that note's folder.
// The shared path only labels a viewer; it must not reclassify the shared-note pane.
function viewedFile(p) {
  if (p?.mod !== "fork-notepad-view" && !(p?.mod === "fork-notepad" && typeof p.props?.view === "string")) return null;
  const direct = p.props?.view;
  if (typeof direct === "string" && direct) return direct;
  const files = shared("notepad.files");
  const published = files && typeof files === "object" ? files[p.pane] : null;
  if (typeof published === "string" && published) return published;
  return published && typeof published.path === "string" && published.path ? published.path : null;
}

export default class Pane extends View {
  init() { this.hovered = false; this.w = 9999; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  // Split buttons open the new pane as a chooser (split-chooser) instead of a terminal.
  splitButton(t, id, icon, direction, pane) {
    return this.button(t, id, icon, "pane.split", { direction, pane, mod: "fork-split-chooser", props: { direction } });
  }

  button(t, id, icon, command, args, action) {
    return div()
      .id(id)
      .flex_none()
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        if (action) action(); else run(command, args);
      })
      .child(svg(icon.includes("/") ? icon : `mods/fork-pane-browser/${icon}.svg`).size(14));
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const clean = (p.title || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
    const firstAgent = panes().find(q => q.tab === p.tab && q.program?.agent);
    const tabName = agents().find(a => a.tab === p.tab)?.space_name || "";
    const isLead = p.program?.agent && firstAgent?.pane === p.pane && !/orchestrator/i.test(tabName);
    const baseName = (p.program?.agent && clean && clean !== p.program?.name && clean) || ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const viewPath = viewedFile(p);
    const isViewer = p.mod === "fork-notepad-view" || viewPath !== null;
    const isNote = p.mod === "fork-notepad" && !isViewer;
    const head = isViewer ? null : (p.mod ? MOD_HEADS[p.mod] : null);
    const notesDir = shared("notepad.dir");
    const dirLabel = isViewer ? folder(viewPath ? parentDir(viewPath) : "")
      : isNote ? folder(typeof notesDir === "string" ? notesDir : "")
      : (head?.folder ?? folder(p.cwd));
    const links = shared("notepad.links");
    const backlinks = Array.isArray(links) ? links.filter((h) => (p.terminal && h === `herdr:agent/${p.terminal}`) || h === `herdr:tab/${p.tab}`) : [];
    const name = isViewer ? (viewPath ? viewPath.slice(viewPath.lastIndexOf("/") + 1) : "File") : (head ? head.name : baseName);
    const pic = isViewer ? svg("mods/fork-notepad/icons/file.svg").size(14).flex_none().text_color(t.dim)
      : head ? svg(head.icon).size(14).flex_none().text_color(t.dim) : icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    // Narrow panes: the title shrinks to an ellipsis (min 48px) and the folder text goes first; a mod's own buttons
    // fold into one ••• button; only then stock buttons drop, close last. Nothing overlaps.
    const BTN = 20, GAP = 8;
    const extras = isNote ? 2 : 0;
    const room = this.w - 20 - (pic ? 14 + GAP : 0) - 48 - GAP - (st && st !== "idle" ? 20 : 0);
    const fits = (n) => n * BTN + Math.max(0, n - 1) * GAP;
    const fold = extras > 0 && room < fits(4 + extras);
    const stockN = Math.max(0, Math.min(4, Math.floor((room - (fold ? BTN + GAP : 0) + GAP) / (BTN + GAP))));
    const stock = [
      () => this.splitButton(t, `ph-r-${pane}`, "split-right", "right", pane),
      () => this.splitButton(t, `ph-d-${pane}`, "split-down", "down", pane),
      () => this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }),
      () => this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane }),
    ].slice(4 - stockN);
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(isLead ? t.accent + "1a" : t.background)
      .border_b(1)
      .border_color(isLead ? t.accent + "66" : t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_size_change((size, cx) => { if (Math.abs(size.width - this.w) > 1) { this.w = size.width; cx.notify(); } })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().min_w(48).max_w(260).truncate().font_medium().text_color(t.foreground).child(name))
      // Backlink: the Notepad mentions this chat or tab; click lists the lines (Notepad as a popup).
      .when(Boolean(backlinks.length), el => el.child(div().id(`ph-bl-${pane}`).p(3).rounded(4).flex_none().text_color(t.dim)
        .hover((s) => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "fork-notepad", kind: "popup", props: { backlinks }, width: 320, height: 200 }); })
        .child(svg("mods/fork-notepad/note.svg").size(12))))
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(dirLabel))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered && fold, el => el.child(this.button(t, `ph-more-${pane}`, "mods/fork-notepad/more.svg", null, null,
        () => openOverlay({ mod: "fork-notepad", kind: "popup", props: { headerMenu: true }, width: 200, height: 84 }))))
      .when(this.hovered && isNote && !fold, el => el
        // Notepad's own controls, built exactly like the stock buttons; Markdown shows lit while on.
        .child(this.button(t, `ph-md-${pane}`, "mods/fork-notepad/md.svg", null, null, () => setShared("notepad.md", shared("notepad.md") !== true))
          .when(shared("notepad.md") === true, (b) => b.text_color(t.foreground)))
        .child(this.button(t, `ph-ex-${pane}`, "mods/fork-notepad/export.svg", null, null,
          () => openOverlay({ mod: "fork-notepad", kind: "popup", props: { export: true }, width: 220, height: 176 }))))
      .when(this.hovered, el => el.children(stock.map((b) => b())));
  }
}
