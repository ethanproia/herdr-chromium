// Role "pane-header": a pane's header, for layouts that frame their panes (replaces the old pane-browser):
//   { "tab": "active", "pane": { "header": { "content": { "mod": "core", "props": { "role": "pane-header" } } } } }
// Shows the program's icon, the agent's name or the terminal's title, the folder, and the agent's status; buttons split,
// zoom and close this pane. A mod pane gets its name, icon, own buttons and Copy from that tool's descriptor
// (registry). Props from the app: { pane, terminal }. Click: focus the pane.
import { div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, agents, props, run, theme, home, shared, openOverlay } from "herdr";
import { SELF } from "../self.js";
import { fadeLabel, over } from "../scroll.js";
import { icon, runPaneCopy, runHeaderAction, openRegistry, watchRegistry, REGISTRY_WAKE } from "../look.js";
import { normalizeTool, FALLBACKS } from "../registry.js";
import { copyPlan, copySpecFor, headerDirPath, headerMenuEntries, menuHeight, toolHeaderElId, paneNoteCopyClaim, COPY_FILE_STRIPPED } from "../pure.js";

// "remote-desktop" -> "Remote desktop", "fork-browser" -> "Browser".
export const properName = (mod) => { const m = String(mod).replace(/^fork-/, "").replace(/[-_]+/g, " ").trim(); return m.charAt(0).toUpperCase() + m.slice(1); };

function progIcon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).size(size).flex_none();
}

// Same stand-in the registry uses (FALLBACKS), so header buttons match before and after the scan.
// Folder names only: the fork's "fork-" prefix is covered; other mods get no stand-in.
const builtinFor = (mod) => (/^(?:fork-)?notepad$/.test(mod ?? "") ? normalizeTool(FALLBACKS.notepad, mod, { self: SELF }) : null);

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

// A file viewer is the notepad-view mod. PaneInfo has no props, so the path comes from
// shared "notepad.files" (published by that mod). The header shows the file name and folder,
// and must not offer the shared note's Markdown / Export controls.
const isViewerMod = (m) => /^(?:fork-)?notepad-view$/.test(m ?? "");
function viewedFile(p) {
  if (!isViewerMod(p?.mod)) return null;
  const files = shared("notepad.files");
  const published = files && typeof files === "object" ? files[p.pane] : null;
  if (typeof published === "string" && published) return published;
  return published && typeof published.path === "string" && published.path ? published.path : null;
}

export default class PaneHeader {
  init(_p, cx) {
    this.hovered = false; this.w = 9999; this.copied = false; this.copying = false;
    this.reg = openRegistry();
    this.stopRegistry = watchRegistry(cx);
  }

  close() { this.stopRegistry?.(); this.stopRegistry = null; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  // The descriptor of a mod pane's tool: found by the folder it runs from.
  toolFor(mod) {
    if (!mod) return null;
    // Every mod pane shows its tool's proper name and icon (Ethan: "all tabs should have an icon"); header buttons
    // and Copy come only from tools that declare them.
    return this.reg.tools.find((x) => x.open.mod === mod) ?? builtinFor(mod);
  }

  // The Copy button: the copy never passes the text through argv, and "Copied" shows only when it succeeded.
  copy(src, cx) {
    const claim = paneNoteCopyClaim(src, this.copying, COPY_FILE_STRIPPED);
    if (!claim.start) return;
    // A note flush shares one notepad.flushReq. Hold the button until this one finishes
    // so a second click cannot replace the request the first handshake is waiting on.
    if (claim.hold) this.copying = true;
    // A click's cx is gone after its first await; the copy runs in an AsyncContext from cx.spawn.
    const mod = this.me()?.mod;
    cx.spawn(async (cx) => {
      let ok = false;
      try { ok = await runPaneCopy(src[0], src[1], mod, cx); } catch { ok = false; }
      if (claim.hold) this.copying = false;
      this.copied = ok;
      cx.notify();
      if (ok) cx.timer.after(1200, (cx) => { this.copied = false; cx.notify(); });
    });
  }

  // Split buttons open the new pane as the New panel instead of a terminal.
  splitButton(t, id, ico, direction, pane) {
    return this.button(t, id, ico, "pane.split", { direction, pane, mod: SELF, props: { role: "new-panel", direction } });
  }

  button(t, id, ico, command, args, action) {
    return div()
      .id(id)
      .flex_none()
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        if (action) action(cx); else run(command, args);
      })
      .child(svg(ico.includes("/") ? ico : icon(ico)).size(14));
  }

  // One of a tool's own header buttons (typed actions only). The narrow menu runs this same helper.
  toolButton(t, tool, h, pane) {
    const a = h.action;
    const lit = a.toggleShared && shared(a.toggleShared) === true;
    return this.button(t, toolHeaderElId(h.id, pane), h.icon ?? icon("plus"), null, null,
      () => runHeaderAction(a, { pane, mod: tool.open?.mod })).when(lit, (b) => b.text_color(t.foreground));
  }

  render(cx) {
    const t = theme();
    shared(REGISTRY_WAKE);   // the shared registry watcher bumps this; every header redraws from the one copy
    const p = this.me();
    if (!p) return div();
    const clean = (p.title || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
    const firstAgent = panes().find((q) => q.tab === p.tab && q.program?.agent);
    const tabName = agents().find((a) => a.tab === p.tab)?.space_name || "";
    const isLead = p.program?.agent && firstAgent?.pane === p.pane && !/orchestrator/i.test(tabName);
    const baseName = (p.program?.agent && clean && clean !== p.program?.name && clean) || ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const viewPath = viewedFile(p);
    const isViewer = isViewerMod(p.mod) || viewPath !== null;
    // The New panel is core itself; other mod panes name themselves in their descriptor.
    const tool = isViewer || p.mod === SELF ? null : this.toolFor(p.mod);
    const head = isViewer ? null
      : p.mod === SELF ? { name: "New panel", icon: icon("panel"), folder: "" }
      : tool ? { name: tool.name, icon: tool.icon }
      : p.mod ? { name: properName(p.mod), icon: icon("panel") } : null;   // a mod with no descriptor: still named + iconed
    // The notes folder comes from copyFile.dirShared. Header buttons do not make a pane a Notepad,
    // so a plugin with buttons and no shared dir still shows the pane's cwd.
    const dirKey = tool?.copy?.copyFile?.dirShared;
    const dirLabel = folder(headerDirPath({
      isViewer, viewPath, dirShared: dirKey,
      sharedDir: typeof dirKey === "string" && dirKey ? shared(dirKey) : undefined,
      explicit: head?.folder, cwd: p.cwd,
    }));
    const links = shared("notepad.links");
    const backlinks = Array.isArray(links) ? links.filter((h) => (p.terminal && h === `herdr:agent/${p.terminal}`) || h === `herdr:tab/${p.tab}`) : [];
    const noteMod = this.reg.tools.find((x) => x.id === "notepad")?.open.mod ?? builtinFor("notepad").open.mod;
    const name = isViewer ? (viewPath ? viewPath.slice(viewPath.lastIndexOf("/") + 1) : "File") : (head ? head.name : baseName);
    const pic = isViewer ? svg(icon("viewer-file")).size(14).flex_none().text_color(t.dim)
      : head?.icon ? svg(head.icon).size(14).flex_none().text_color(t.dim) : head ? null : (progIcon(p.program, 14, t.dim) ?? svg(icon("shell")).size(14).flex_none().text_color(t.dim));
    const st = p.status;
    const pane = p.pane;
    // Narrow panes: the title shrinks, fading out at its edge (min 48px) and the folder text goes first; a mod's own buttons
    // fold into one ••• button; only then stock buttons drop, close last. Nothing overlaps.
    const BTN = 20, GAP = 8;
    // A mod tool's copy spec (copyFile or copyTerminal) wins. A bare terminal uses the terminal
    // tool's copyTerminal when the registry has one; with no spec, copyPlan still copies the address.
    const copySrc = copyPlan({ terminal: p.terminal, copy: copySpecFor(p, tool?.copy, this.reg.tools), viewPath }, shared);
    const own = tool?.header?.length ? tool.header : [];
    const folded = headerMenuEntries(own, copySrc);
    const extras = folded.length;
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
    const headBg = over(t.background, isLead ? t.accent + "1a" : null);   // what the header shows, for the fading labels
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
      // Right-click the header: the pane menu (Split, Copy link to panel, Zoom, Close). Inside a
      // terminal the program usually gets right-clicks, so the header is the reliable place for it.
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        openOverlay({ mod: SELF, kind: "popup", props: { role: "menu", tab: "pane", target: { pane, terminal: p.terminal } }, width: 260, height: 272 });
      })
      .when(Boolean(pic), (el) => el.child(pic))
      .child(fadeLabel(this, `ph-name-${pane}`, { text: name, bg: headBg, style: (el) => el.font_medium().text_color(t.foreground), outer: (el) => el.min_w(48).max_w(260) }))
      // Backlink: the Notepad mentions this chat or tab; click lists the lines (Notepad as a popup).
      .when(Boolean(backlinks.length), (el) => el.child(div().id(`ph-bl-${pane}`).p(3).rounded(4).flex_none().text_color(t.dim)
        .hover((s) => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: noteMod, kind: "popup", props: { backlinks }, width: 320, height: 200 }); })
        .child(svg(icon("note")).size(12))))
      .child(fadeLabel(this, `ph-dir-${pane}`, { text: dirLabel, bg: headBg, style: (el) => el.text_color(t.dim) }))
      .when(st === "working", (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", (el) => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", (el) => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      // Narrow: Copy and the tool's own buttons fold into one •••. Core draws that menu and runs the
      // same typed actions as the wide buttons (any tool, not only the Notepad).
      .when(this.hovered && fold, (el) => el.child(this.button(t, `ph-more-${pane}`, "more", null, null,
        () => openOverlay({ mod: SELF, kind: "popup", props: { role: "header-menu", pane, mod: tool?.open?.mod, copy: copySrc, items: own }, width: 200, height: menuHeight(folded.length, 0) }))))
      // Copy the whole pane (a check shows for a moment after it lands, and only then).
      .when(this.hovered && !fold && Boolean(copySrc), (el) => el.child(this.button(t, `ph-cp-${pane}`, this.copied ? "check" : "copy", null, null, (cx) => this.copy(copySrc, cx))
        .when(this.copied, (b) => b.text_color(t.foreground))))
      // The tool's own controls, built exactly like the stock buttons; a toggle shows lit while on.
      .when(this.hovered && !fold && own.length > 0, (el) => el.children(own.map((h) => this.toolButton(t, tool, h, pane))))
      .when(this.hovered, (el) => el.children(stock.map((b) => b())));
  }
}
