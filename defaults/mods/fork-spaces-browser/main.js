// Workspace spaces: stable colored avatars, worktrees under their checkout,
// [spaces-browser: adds a remote desktop button per machine header] grouped by machine when more than one is known. After a space's name, the repo
// its first terminal is in now, only where unusual: branch, ahead/behind. Agent state lives in the agents list, not here. Click to
// switch, right-click for its menu, drag to reorder.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, machines, panes, run, openOverlay, exec, hc, theme, shared, setShared, watchFolder, window, layout, settings } from "herdr";
import { labelOf, groupByHost } from "./hosts.js";
import { railFitPx } from "./rail.js";
import { scroller, fadeLabel, over, tint } from "./scroll.js";
// With the fork's "glass" setting the sidebar's layout background draws translucent over a blurred window; painting
// our own opaque chrome here would hide it, so sidebar roots leave the background to the layout then.
const glassOn = () => settings()?.glass === true;

const MACHINE_ICONS = { null: "mods/fork-spaces-browser/laptop.svg", basis: "mods/fork-spaces-browser/laptop.svg", laptop: "mods/fork-spaces-browser/laptop.svg", studio: "mods/fork-spaces-browser/studio.svg", "studio-agent": "mods/fork-spaces-browser/studio.svg", "exe-labs": "mods/fork-spaces-browser/cloud.svg" };
// Sidebar sections menu: core's menu role. Core's folder is "fork-core"; the fork's is "fork-core" (used when "fork-core" is switched off).
const coreMod = () => { const off = settings()?.mods_disabled; return Array.isArray(off) && off.includes("fork-core") ? "fork-core" : "fork-core"; };
const openSectionsMenu = () => openOverlay({ mod: coreMod(), kind: "popup", width: 260, height: 8 + 5 * 32 + 2 * 9 + 30, props: { role: "menu", tab: "sidebar" } });
// Expanded list geometry (px). Levels: machine/host heading -> user (a host's other machines) -> spaces. Each nested
// group sits in a box with a 1px guide on its left (shadcn SidebarMenuSub): the host's guide is 14px in from its heading
// (about under the heading's icon), the user's 12px in from the user's own guide. Controls are ONE column at the right
// edge in fixed slots, so > + dot chevron line up on machine, user and host rows alike; space rows keep the chevron slot
// empty so their git tail ends where the dots do.
const IND = { host: 14, user: 12 };
const SLOT = { remote: 20, add: 20, dot: 12, chev: 16 };
// The pane divider token exactly (layout divider: 1px "border"), so guides read as secondary (Ethan: "same as what the divs look like between panels").
const guideColor = (t) => t.border;
const machineIcon = m => MACHINE_ICONS[m ?? null] ?? "mods/workspace-chrome/server.svg";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
// The whole open state in one layout.set, the same rules as core's applySidebarState(false): drag limits 200–480,
// lists resizable, the top row 46px, and Spaces given back the split the rail replaced with a pixel height.
function expandSidebar() {
  const tree = JSON.parse(JSON.stringify(layout()));
  const bar = find(tree, "sidebar"), lists = find(tree, "sidebar-lists"), brand = find(tree, "brand"), sp = find(tree, "spaces");
  if (!bar) return;
  const px = Math.min(480, Math.max(200, bar.size?.px >= 200 ? bar.size.px : (shared("sidebar.width") ?? 268)));
  bar.size = { px };
  bar.min = 200;
  bar.max = 480;
  if (lists) lists.resizable = true;
  if (brand) brand.size = { px: 46 };
  if (sp && sp.size?.px) sp.size = shared("sidebar.spacesSize") ?? { weight: 1 };
  setShared("sidebar.collapsed", false);
  run("layout.set", { layout: tree });
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// Where a space is now: its first terminal's live folder, else where it was made.
// `ps`: panes(), read once by the caller (each read copies every pane).
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}
const rowHeight = ({ tree }) => (tree ? 28 : 30);
const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);
const base = (path) => path.replace(/\/+$/, "").split("/").pop();
// Changes made outside Herdr (an editor's save, a commit in another app): looked
// for this often, in repos the list shows, while the window is in front.
const FALLBACK = 60000;
const GRACE_MS = 1500;   // longest a new space waits for its git before it is shown

// What a stored color name looks like on an avatar (the same in every mod
// that draws space avatars): one strong color per hue, light and dark alike.
// The hover text of an offline machine: "Offline since 3h ago" (since_ms is when `hc machine ls` last changed its state; there is no last-seen time).
const offlineTip = (m) => {
  const label = !m || m.state === "unreachable" ? "Offline" : m.state.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  const s = m?.since_ms ? Math.max(0, Math.round((Date.now() - m.since_ms) / 1000)) : null;
  if (s == null) return label;
  const ago = s < 90 ? "just now" : s < 5400 ? `${Math.round(s / 60)}m ago` : s < 129600 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
  return `${label} since ${ago}`;
};
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

// A space speaks up only when something in it needs you.
export function glyph(status) {
  return status === "blocked" || status === "done" ? "●" : "·";
}

export function tone(t, status) {
  return t[status] ?? t.unknown;
}

export default class Spaces extends View {
  init(_props, cx) {
    this.git = {}; // where() -> { name, branch, ahead, behind, repo, linked }, null: not a repo
    this.checked = {}; // where() -> when it was last looked at
    this.unsure = new Set(); // where()s git couldn't answer for (a machine away)
    this.pending = new Set(); // where()s to look at next
    this.busy = {}; // pane -> an agent working or a program in front of its shell
    this.ready = {}; // machine -> its layout was readable at the last look
    this.at = {}; // space -> its where() at the last look
    this.watching = new Set(); // local repos' git folders
    // Spaces made while this runs wait (at most a moment) for their git, so a
    // worktree appears under its repo instead of jumping there.
    this.shown = new Set(spaces().map((s) => s.id));
    this.born = {};
    this.pressed = null;
    this.over = null;
    this.machines = [];
    // Folded machines live in shared "machines.folded" so core's machine menu can fold them too; the old local list moves over once.
    if (shared("machines.folded") == null) { try { setShared("machines.folded", JSON.parse(localStorage.getItem("machines.folded") ?? "[]")); } catch { setShared("machines.folded", []); } }
    this.refreshMachines(cx);
    cx.timer.every(15000, cx => this.refreshMachines(cx));
    // `git status` walks the whole tree, on another machine a process there:
    // only when its answer could have changed (see `due`).
    // Live-data changes redraw this mod, and each draw runs one check (see render); this slow tick only covers
    // what changes without a redraw. It never redraws by itself.
    cx.timer.every(5000, (cx) => this.checkNew(cx));
  }

  // Looks for work after a change: git to refresh, colors to assign, and when a new space may be shown.
  // Redraws only for a deadline (below); a changed git answer redraws through refreshGit.
  // Rail: the Spaces section is as tall as its tiles plus any row stacked in that same section (the Expand
  // button on windowed macOS). Tiles alone leave the scroller short by that row, so the rail still scrolls
  // (Ethan: "this is still scrollable in rail view"). Agents gets the rest. Only while Agents is shown; the
  // open sidebar gets its own sizes back from the core (sidebar-header).
  fitRail() {
    const l = layout(), sp = find(l, "spaces"), ag = find(l, "agents");
    if (!narrow() || !sp || !ag || ag.hidden) return;
    const want = railFitPx({
      content: this._scroll?.rail?.content,
      chrome: this._railChrome,
      macWindowed: window()?.platform === "macos" && !window()?.fullscreen,
    });
    if (want == null) return;
    if (sp.size?.px !== want) run("layout.resize", { id: "spaces", px: want });
  }

  checkNew(cx) {
    this.fitRail();
    const now = Date.now();
    const sp = spaces();
    for (const s of sp) if (!this.shown.has(s.id)) this.born[s.id] ??= now;
    const due = this.due(now, sp, panes());
    if (due.size) this.refreshGit(due, cx);
    this.syncColors(sp);
    this.armDeadline(sp, now, cx);
  }

  // A new space waits for its git (so a worktree appears under its repo), but never longer than GRACE_MS from when
  // it appeared. One timer for the earliest such moment; when it fires the space is shown, and that is the only
  // redraw this wait causes. A space whose git arrives sooner is shown by that answer's own redraw.
  armDeadline(sp, now, cx) {
    let at = Infinity;
    for (const s of sp) if (!this.shown.has(s.id) && this.born[s.id] !== undefined) at = Math.min(at, this.born[s.id] + GRACE_MS + 1);
    if (at === Infinity || (this.deadline !== undefined && this.deadline <= at)) return;
    const mine = (this.deadline = at);
    cx.timer.after(Math.max(0, at - now), (cx) => {
      if (this.deadline === mine) this.deadline = undefined;
      cx.notify();
    });
  }

  // Stored avatar colors (shared "space.colors"). Colors are dropped only for spaces that are gone for sure: while any
  // machine is not "ready" its spaces are missing from spaces() and must keep theirs. Assigned here, never in render.
  syncColors(sp) {
    const stored = shared("space.colors") ?? {};
    const ms = machines();
    const complete = ms.length > 0 && ms.every((m) => m.layout === "ready");
    const ids = new Set(sp.map((p) => p.id));
    const kept = Object.fromEntries(Object.entries(stored).filter(([id]) => !complete || ids.has(id)));
    let changed = Object.keys(kept).length !== Object.keys(stored).length;
    const palette = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
    for (const p of sp) {
      if (kept[p.id] || p.name === "~") continue;
      const uses = (c) => Object.values(kept).filter((v) => v === c).length;
      kept[p.id] = palette.reduce((best, c) => (uses(c) < uses(best) ? c : best));
      changed = true;
    }
    if (changed) setShared("space.colors", kept);
  }

  // Places whose git could have changed: new ones (a new space, a cd), where a
  // command or an agent's turn just ended (a checkout, a commit, edits), those on
  // a machine that is back, and repos in view whose fallback is due.
  due(now, sp, ps) {
    // Moved there: what it knew of that place may be old.
    const at = {};
    for (const s of sp) at[s.id] = where(s, ps);
    const keys = new Set(Object.values(at).filter((k) => JSON.parse(k)[1]));
    const due = new Set([...keys].filter((k) => !(k in this.git)));
    for (const [id, k] of Object.entries(at)) if (this.at[id] && this.at[id] !== k && keys.has(k)) due.add(k);
    this.at = at;
    const spaceOf = {};
    for (const s of sp) for (const t of s.tabs ?? []) spaceOf[t.id] = s;
    const busy = {};
    for (const p of ps) {
      if (!p.terminal || !spaceOf[p.tab]) continue;
      busy[p.pane] = p.status === "working" || !(p.program?.shell || p.program?.agent);
      if (this.busy[p.pane] && !busy[p.pane]) this.sameRepo(at[spaceOf[p.tab].id], keys).forEach((k) => due.add(k));
    }
    this.busy = busy;
    for (const m of machines()) {
      const ready = m.layout === "ready";
      if (ready && this.ready[m.name] === false) for (const k of keys) if (JSON.parse(k)[0] === m.name) due.add(k);
      this.ready[m.name] = ready;
    }
    if (window().active) {
      for (const k of keys) {
        const asks = this.git[k] || this.unsure.has(k);
        if (asks && !this.folded.has(JSON.parse(k)[0]) && now - (this.checked[k] ?? 0) > FALLBACK) due.add(k);
      }
    }
    return due;
  }

  // `key` and the other places in its repo (a commit there moves their ahead/behind).
  sameRepo(key, keys) {
    const repo = this.git[key]?.repo;
    return [key, ...(repo ? [...keys].filter((k) => this.git[k]?.repo === repo) : [])];
  }

  refreshMachines(cx) {
    cx.spawn(async cx => {
      try { const r = await hc(["machine", "ls", "--json"]); if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary); } catch {}
      cx.notify();
    });
  }

  // One look at a time, each place once however often it was asked for meanwhile.
  refreshGit(keys, cx) {
    for (const k of keys) this.pending.add(k);
    if (this.refreshing) return;
    this.refreshing = true;
    cx.spawn(async (cx) => {
      while (this.pending.size) {
        const keys = [...this.pending];
        this.pending.clear();
        for (const key of keys) await this.check(key, cx);
      }
      const used = new Set(Object.values(this.git).filter(Boolean).map((g) => JSON.parse(g.repo)).filter(([on]) => !on).map(([, repo]) => repo));
      for (const repo of this.watching) if (!used.has(repo)) this.watching.delete(repo);
      this.refreshing = false;
      cx.notify();
    });
  }

  // One place's git: branch, ahead/behind, its repo.
  async check(key, cx) {
    const [on, cwd] = JSON.parse(key);
    this.checked[key] = Date.now();
    this.unsure.delete(key);
    try {
      // No optional locks: a status that touched the index would wake the watch again.
      // Writes nothing under .git (index lock, fsmonitor cookie): watch() would wake on it.
      const r = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v2", "--branch"], { cwd, on });
      if (r.code !== 0) {
        // Only git's own "no" is remembered as no repo; anything else is asked again.
        if (!/not a git repository/i.test(r.stderr)) this.unsure.add(key);
        this.git[key] = null;
        return;
      }
      // The repo's own .git folder names it; a worktree's top differs from it.
      const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
      const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on });
      const repo = common.stdout.trim();
      const name = repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
      const info = { name, branch: null, ahead: 0, behind: 0, repo: JSON.stringify([on, repo]), linked: repo !== `${top.stdout.trim()}/.git` };
      for (const line of r.stdout.split("\n")) {
        if (line.startsWith("# branch.head ")) info.branch = line.slice(14);
        else if (line.startsWith("# branch.ab ")) {
          const [a, b] = line.slice(12).split(" ");
          info.ahead = Math.abs(parseInt(a, 10)) || 0;
          info.behind = Math.abs(parseInt(b, 10)) || 0;
        }
      }
      this.git[key] = info;
      if (!on) this.watch(repo, cx);
    } catch {
      // Couldn't ask (the machine is away): keep what it showed, look again later.
      this.git[key] ??= null;
      this.unsure.add(key);
    }
  }

  watch(repo, cx) {
    if (this.watching.has(repo)) return;
    this.watching.add(repo);
    cx.spawn(async (cx) => {
      try {
        while (this.watching.has(repo)) {
          await watchFolder(repo);
          const mine = JSON.stringify([null, repo]);
          if (this.watching.has(repo)) this.refreshGit(Object.keys(this.git).filter((k) => this.git[k]?.repo === mine), cx);
        }
      } catch { this.watching.delete(repo); }
    });
  }

  menu(w) {
    // A popup is as tall as its items; height is only the most.
    openOverlay({ mod: coreMod(), kind: "popup", width: 260, height: 400, props: { role: "menu", tab: "space", target: { id: w.id } } });
  }

  // Spaces in order, each worktree space moved under its main checkout's.
  ordered() {
    const sp = spaces(), ps = panes();
    const ready = (w) => this.shown.has(w.id) || where(w, ps) in this.git || Date.now() - (this.born[w.id] ??= Date.now()) > GRACE_MS;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const list = sp.map((w, i) => ({ w, i, g: this.git[where(w, ps)] ?? null })).filter((r) => this.shown.has(r.w.id));
    const mains = new Set(list.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
    const nested = (r) => r.g?.linked && mains.has(r.g.repo);
    const out = [];
    const placed = new Set(); // repos whose worktrees are listed (under the first of its spaces)
    for (const r of list) {
      if (nested(r)) continue;
      out.push({ ...r, tree: null });
      if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
      placed.add(r.g.repo);
      const kids = list.filter((k) => nested(k) && k.g.repo === r.g.repo);
      kids.forEach((k, n) => out.push({ ...k, tree: n === kids.length - 1 ? "└─" : "├─" }));
    }
    return out;
  }

  // Hover is tracked (not left to the host's :hover) so a fading name can match the row it sits on.
  hoverOn(key) {
    return (h, cx) => {
      const next = h ? key : (this.hoverKey === key ? null : this.hoverKey);
      if (next !== this.hoverKey) { this.hoverKey = next; cx.notify(); }
    };
  }

  get folded() { return new Set(shared("machines.folded") ?? []); }

  toggleFold(m, cx) {
    const next = this.folded;
    next.has(m) ? next.delete(m) : next.add(m);
    setShared("machines.folded", [...next]);
    cx.notify();
  }

  // Right-click on a machine heading: core's machine menu. o = { key (fold key), machine (name | null | undefined for a host), online }
  machineMenu(o) {
    openOverlay({ mod: coreMod(), kind: "popup", width: 260, height: 80, props: { role: "menu", tab: "machine", target: o } });
  }

  // The right-hand controls column: four fixed slots, right-aligned, always all four wide (an absent one is blank), so
  // it lines up on every heading. o = { id, remote (machine name or null), add (machine name | null | undefined = none),
  // addOff (the machine is offline: + shows disabled), dot, folded, chevron }
  controls(t, o) {
    const slot = (w, el) => div().w(w).h(20).flex_none().flex().items_center().justify_center().child(el ?? "");
    const btn = (id, w, label, action) => div().id(id).w(w).h(20).flex_none().flex().items_center().justify_center().rounded(4).text_color(t.dim)
      .hover(s => s.bg(t.raised).text_color(t.foreground)).on_click((_e, cx) => { cx.stop_propagation(); action(); }).child(label);
    // A disconnected machine has no >; its + stays in the slot but disabled (Ethan: "the new space option should also be
    // disabled/greyed out"): faded, no hover, no action, "Offline" on hover. The click stops here so it doesn't fold.
    return h_flex().flex_none().items_center()
      .child(o.remote ? btn(`machine-remote-${o.remote}`, SLOT.remote, ">", () => run("tab.new", { name: `${o.remote} desktop`, mod: "remote-desktop", props: { id: `rd${Date.now().toString(36)}`, machine: o.remote } })) : slot(SLOT.remote))
      .child(o.add !== undefined && o.addOff ? div().id(`machine-add-${o.add ?? "local"}`).w(SLOT.add).h(20).flex_none().flex().items_center().justify_center()
        .text_color(t.dim).opacity(0.4).tooltip("Offline").on_click((_e, cx) => cx.stop_propagation()).child("+")
        : o.add !== undefined ? btn(`machine-add-${o.add ?? "local"}`, SLOT.add, "+", () => run("space.new", o.add ? { machine: o.add } : {})) : slot(SLOT.add))
      .child(slot(SLOT.dot, o.dot ? div().size(6).rounded(3).bg(o.dot) : null))
      .child(slot(SLOT.chev, svg(`mods/workspace-chrome/chevron-${o.folded ? "right" : "down"}.svg`).size(11).flex_none().text_color(t.dim)));
  }

  // One heading row. level 0: machine / host (icon, 11.5 medium); level 1: a host's user (no icon, 11, lighter).
  // o = { id, key (fold key), level, icon, label, off (offline: whole row dims), tip (hover text), menu, controls }
  head(t, o) {
    const hot = this.hoverKey === o.id;
    const one = o.level === 1;
    return h_flex().id(o.id).h(one ? 24 : 26).flex_none().pl(one ? 13 : 8).pr(8).gap(7).items_center().rounded(6)
      .cursor_pointer().when(hot, s => s.bg(t.hover)).on_hover(this.hoverOn(o.id))
      .when(Boolean(o.tip), el => el.tooltip(o.tip))
      .on_click((_e, cx) => this.toggleFold(o.key, cx))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.machineMenu(o.menu); })
      .when(Boolean(o.icon), el => el.child(o.icon))
      .child(fadeLabel(this, `hd-${o.id}`, { text: o.label, bg: over(t.chrome, hot ? t.hover : null),
        style: (el) => el.text_size(one ? 11 : 11.5).text_color(one || o.off ? t.dim : t.muted).when(!one, e => e.font_medium()) }))
      .child(o.controls);
  }

  // A guide-lined box for a nested group (shadcn SidebarMenuSub): 1px line in the theme border at reduced alpha.
  nest(t, id, ml, kids) {
    return v_flex().id(id).flex_none().ml(ml).border_l(1).border_color(guideColor(t)).children(kids);
  }

  // The rows, under a header per machine once one isn't this computer.
  grouped(t, collapsed) {
    const rows = this.ordered();
    const draw = (r, col) => (collapsed ? this.compact(r, t) : this.row(r, t, col));
    const remote = [...new Set([...rows.map(r => r.w.machine).filter(Boolean), ...this.machines.map(m => m.name)])].sort();
    const loading = m => {
      const layout = machines().find(k => k.name === m)?.layout;
      return layout === "loading" || (!layout && this.machines.some(k => k.name === m && k.state === "connected"))
        || spaces().some(s => (s.machine ?? null) === m && !this.shown.has(s.id));
    };
    const loadingRow = m => div().id(`machine-loading-${m ?? "local"}`).h(28).flex_none().px(8).text_size(12).text_color(t.dim).child(collapsed ? "…" : "Loading…");
    if (!remote.length) return loading(null) && !rows.length ? [loadingRow(null)] : rows.map(r => draw(r, false));
    const { shared: hostMembers, sharedHost, order: machineNames } = groupByHost(remote, this.machines, collapsed);
    const empty = m => h_flex().id(`machine-new-${m ?? "local"}`).h(28).flex_none().px(8).gap(7).items_center().rounded(7)
      .text_size(12).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_click(() => run("space.new", m ? { machine: m } : {}))
      .child(svg("mods/workspace-chrome/plus.svg").size(12)).when(!collapsed, el => el.child("New Space There"));
    const out = [];
    let nest = null;   // the open host box: its heading's key, and the rows collected into it
    const flush = () => { if (nest && !nest.skip) { out.push(this.nest(t, `host-box-${nest.h}`, IND.host, nest.kids)); } nest = null; };
    for (const m of machineNames) {
      if (m?.startsWith("host:")) {
        flush();
        const h = m.slice(5), folded = this.folded.has(m);
        const online = hostMembers[h].some(n => this.machines.find(k => k.name === n)?.state === "connected");
        out.push(this.head(t, { id: `host-${h}`, key: m, level: 0, icon: svg(machineIcon(hostMembers[h][0])).size(13).flex_none().text_color(online ? t.muted : t.dim), label: h, off: !online,
          tip: online ? null : offlineTip(hostMembers[h].map(n => this.machines.find(k => k.name === n)).filter(Boolean)[0]), menu: { key: m, online },
          controls: this.controls(t, { dot: online ? t.ansi2 : t.dim, folded }) }));
        nest = { h, kids: [], skip: folded };   // a folded host hides its users with it
        continue;
      }
      const host = m && sharedHost(m);
      const mine = rows.filter((r) => (r.w.machine ?? null) === m);
      const machine = this.machines.find(k => k.name === m);
      const connected = !m || machine?.state === "connected";
      const folded = this.folded.has(m);
      const tip = connected ? null : offlineTip(machine);
      const ctl = this.controls(t, { remote: connected && m ? m : null, add: m ?? null, addOff: !connected, dot: connected ? t.ansi2 : t.dim, folded });
      if (host) {
        // A host's user: under its host's guide, its spaces under its own (hidden with a folded host heading).
        if (!nest || nest.h !== host) { flush(); nest = { h: host, kids: [] }; }
        if (nest.skip) continue;
        nest.kids.push(this.head(t, { id: `machine-${m}`, key: m, level: 1, label: labelOf(m, host), off: !connected, tip, menu: { key: m, machine: m, online: connected }, controls: ctl }));
        if (!folded) nest.kids.push(this.nest(t, `user-box-${m}`, IND.user, mine.length ? mine.map(r => draw(r, true)) : [loading(m) ? loadingRow(m) : empty(m)]));
        continue;
      }
      flush();
      out.push(this.head(t, { id: `machine-${m ?? "local"}`, key: m, level: 0, icon: svg(machineIcon(m)).size(13).flex_none().text_color(connected ? t.muted : t.dim), label: m ?? "This computer", off: !connected, tip, menu: { key: m, machine: m ?? null, online: connected }, controls: ctl }));
      if (!folded) out.push(...(mine.length ? mine.map(r => draw(r, true)) : [loading(m) ? loadingRow(m) : empty(m)]));
    }
    flush();
    return out;
  }

  // Only what's unusual, after the name: "herdr \u00b7 spike \u21912 \u21931". The repo or
  // branch goes when the name already says it (a worktree is named after its branch),
  // and master/main go: nearly every space is on one.
  gitTail(g, tree, name, t, id) {
    const raw = g.branch ?? "detached";
    const same = (a) => a.toLowerCase() === name.toLowerCase();
    const branch = same(raw) || raw === "master" || raw === "main" ? "" : raw;
    const repo = tree || same(g.name) ? "" : g.name;
    const where = [repo, branch].filter(Boolean).join(" \u00b7 ");
    // The name is the only thing that truncates. The tail sits whole in the room left of it, or is not shown: it is
    // measured at its natural width (inner) against the room it has (outer) and hidden, not clipped, when it won't fit.
    // Hidden, not removed, so it keeps being measured and comes back when the sidebar widens. Until measured: hidden.
    const fit = (this.tailFit ??= new Map());
    const k = (fit.get(id) ?? { room: 0, need: Infinity });
    const shows = k.need <= k.room;
    const note = (patch, cx) => {
      const was = (fit.get(id) ?? k), next = { ...was, ...patch };
      fit.set(id, next);
      if ((next.need <= next.room) !== (was.need <= was.room)) cx.notify();
    };
    return h_flex().id(`tail-${id}`)
      .flex_1()
      .min_w(0)
      .overflow_hidden()
      .justify_end()
      .items_center()
      .on_size_change((z, cx) => note({ room: z.width }, cx))
      .child(h_flex().id(`tail-in-${id}`)
        .flex_none()
        .gap(5)
        .items_center()
        .text_size(11.5)
        .text_color(t.dim)
        .when(!shows, (el) => el.opacity(0))
        .on_size_change((z, cx) => note({ need: z.width }, cx))
        .when(Boolean(where), (el) => el.child(div().flex_none().child(where)))
        .when(g.ahead > 0, (el) => el.child(div().flex_none().text_color(t.ansi2).child(`\u2191${g.ahead}`)))
        .when(g.behind > 0, (el) => el.child(div().flex_none().text_color(t.ansi1).child(`\u2193${g.behind}`))));
  }

  row({ w, i, g, tree }, t, col = false) {
    const on = w.active;
    const colors = shared("space.colors") ?? {};
    const color = colors[w.id] ?? "ansi6";
    const fill = color.startsWith("#") ? color : (MARK[color] ?? t[color]);
    const hot = this.hoverKey === `space-${w.id}`;
    return v_flex()
      .relative()
      .id(`space-${w.id}`)
      .pl(8)
      .pr(col ? 8 + SLOT.chev : 8)
      .h(rowHeight({ tree }))
      .flex_none()
      .justify_center()
      .rounded(8)
      .when(on, (el) => el.bg(t.selected))
      .when(!on && hot, (el) => el.bg(t.hover))
      .on_hover(this.hoverOn(`space-${w.id}`))
      .when(this.pressed !== null && this.over === i && this.pressed !== i, (el) => el.border_t(2).border_color(t.accent))
      .on_mouse_down("left", () => {
        this.pressed = i;
        this.over = i;
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        this.pressed = null;
        if (from !== null && from !== i) run("space.move", { id: spaces()[from].id, index: i + 1 });
        else run("space.select", { id: w.id });
        cx.notify();
      })
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.menu(w); })
      .child(
        h_flex()
          .gap(9)
          .items_center()
          .when(Boolean(tree), el => el.pl(22).child(svg("mods/workspace-chrome/branch.svg").size(13).text_color(t.dim)))
          .when(!tree, el => el.child(h_flex().size(18).flex_none().rounded(5).bg(fill).items_center().justify_center().text_size(10.5).font_bold().text_color("#ffffff").child([...w.name][0]?.toUpperCase() ?? "?")))
          .child(fadeLabel(this, `sp-${w.id}`, { text: w.name, bg: over(t.chrome, on ? t.selected : hot ? t.hover : null),
            style: (el) => el.text_color(t.foreground), outer: (el) => el.min_w(0).max_w(150) }))
          .child(g ? this.gitTail(g, tree, w.name, t, w.id) : div().flex_1()),
      );
  }

  // Collapsed sidebar: an icon rail. One colored letter tile per space, in the expanded order (worktrees right under
  // their checkout, a touch smaller), a thin line between machine groups, the space name as a hover tooltip.
  // One rail tile (Discord-style, sized for a 44px rail): every space a 28px tile with 8px either side, 6px between
  // tiles; the active space gets a rounded pill on the rail's left edge (inside the rail), hover a short one.
  tile({ w, i }, t) {
    const on = w.active;
    const colors = shared("space.colors") ?? {};
    const color = colors[w.id] ?? "ansi6";
    const fill = color.startsWith("#") ? color : (MARK[color] ?? t[color]);
    const hovered = this.hoverTile === w.id;
    return h_flex().id(`space-${w.id}`).relative().w_full().h(34).flex_none().items_center().justify_center()
      .when(this.pressed !== null && this.over === i && this.pressed !== i, (el) => el.border_t(2).border_color(t.accent))
      .on_hover((h, cx) => { const next = h ? w.id : (this.hoverTile === w.id ? null : this.hoverTile); if (next !== this.hoverTile) { this.hoverTile = next; cx.notify(); } })
      .on_mouse_down("left", () => { this.pressed = i; this.over = i; })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        this.pressed = null;
        if (from !== null && from !== i) run("space.move", { id: spaces()[from].id, index: i + 1 });
        else run("space.select", { id: w.id });
        cx.notify();
      })
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.menu(w); })
      .tooltip(w.name)
      .when(on || hovered, (el) => el.child(div().absolute().left(0).top(on ? 7 : 13).w(3).h(on ? 20 : 8).rounded_r(2).bg(on ? t.foreground : t.muted)))
      .child(h_flex().size(28).rounded(8).flex_none().bg(fill).items_center().justify_center().text_size(12).font_bold().text_color("#ffffff")
        .when(!on, (el) => el.opacity(hovered ? 0.95 : 0.78))
        .child([...w.name][0]?.toUpperCase() ?? "?"));
  }

  rail(t) {
    const rows = this.ordered();
    const remote = [...new Set([...rows.map((r) => r.w.machine).filter(Boolean), ...this.machines.map((m) => m.name)])].sort();
    const { order } = groupByHost(remote, this.machines, true);
    const groups = order.filter((m) => !m?.startsWith("host:")).map((m) => rows.filter((r) => (r.w.machine ?? null) === m)).filter((g) => g.length);
    const out = [];
    groups.forEach((g, n) => {
      if (n) out.push(div().id(`rail-sep-${n}`).w(20).h(1).my(5).flex_none().bg(t.border));   // rows are 34 (28 + 6): 5 + 1 + 5 keeps the rhythm
      g.forEach((r) => out.push(this.tile(r, t)));
    });
    return out;
  }

  render(cx) {
    const t = theme();
    const collapsed = narrow();
    // One check after every draw (a live-data change redraws), outside the draw itself.
    if (!this.checking) { this.checking = true; cx.spawn(async (cx) => { this.checking = false; this.checkNew(cx); }); }
    if (collapsed) {
      // Spaces fill the rail; search, settings and expand sit stacked at the bottom (Ethan: "settings and other top
      // controls should move to bottom"), clear of the macOS traffic lights.
      const ctl = (id, ic, tip, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(7)
        .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action)
        .child(svg(`mods/workspace-chrome/${ic}.svg`).size(15));
      return v_flex().size_full().min_h(0).when(!glassOn(), (el) => el.bg(t.chrome)).items_center().text_size(13)
        // The sidebar button lives in the top bar; only a windowed macOS (traffic lights in that row) shows it here.
        .when(window()?.platform === "macos" && !window()?.fullscreen, (el) => el.child(div().pt(2).pb(4).flex_none()
          .on_size_change((z, cx) => { if (z.height !== this._railChrome) { this._railChrome = z.height; cx.notify(); } })
          .child(ctl("rail-expand", "sidebar", "Expand Sidebar", () => expandSidebar()))))
        .child(scroller(this, "rail", { id: "spaces-rail", bg: t.chrome, children: this.rail(t),   // just the spaces; search and settings are the sidebar footer (core), the true bottom
          outer: (el) => el.flex_1().min_h(0).w_full()
            .on_mouse_down("right", () => openSectionsMenu())
            .on_mouse_up("left", (_e, cx) => { this.pressed = null; cx.notify(); }),
          inner: (el) => el.items_center().pb(8).pt(3) }));
    }
    return v_flex().size_full().min_h(0).when(!glassOn(), (el) => el.bg(t.chrome)).text_size(13)
      .child(h_flex().id("spaces-title").on_mouse_down("right", () => openSectionsMenu()).h(31).pl(16).pr(10).items_center().justify_between().text_size(11.5).text_color(t.dim)
        .child("Spaces")
        .child(div().id("space-new").p(4).rounded(5).hover(s => s.bg(t.hover).text_color(t.foreground)).on_click(() => run("space.new")).child("+")))
      .child(scroller(this, "list", { id: "spaces-scroll", bg: t.chrome, children: this.grouped(t, collapsed),   // no scrollbar, no scrolling until it overflows, fades at the hidden edges
        outer: (el) => el.flex_1().min_h(0)
          .on_mouse_down("right", () => openSectionsMenu())
          .on_mouse_up("left", (_e, cx) => { this.pressed = null; cx.notify(); }),
        inner: (el) => el.px(8).pb(14) }));
  }
}
