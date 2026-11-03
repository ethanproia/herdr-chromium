// Notepad: one persistent Notion-style markdown note (~/Notes/notepad.md), shared by every Notepad pane.
// One row per line; the row you're on is a plain text box, every other row is drawn styled.
// The pane header (pane-browser) holds its Markdown toggle (shared "notepad.md") and Export (this mod as a popup).
// Save-with-check and the folder watch loop are adapted from herdsidian (MIT, (c) 2026 Andersson Quintero).
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, Textarea, TextareaState, Popup, TextView, Editor, EditorState } from "gpui-base";
import { theme, settings, home, exec, readTextFile, writeTextFile, watchFolder, nextCommand, props, shared, setShared,
  closeOverlay, notify, pickFolder } from "herdr";
import { splitRows, joinRows, isFence, parseRow, filterTypes, setType, continuePrefix, isEmptyItem, toggleTask,
  parseInline, titleOf, slugOf, toPlain, toHtml, splitFront, iconOf, withIcon, TYPES, linkSpans } from "./rows.js";
import { IconPicker, iconElement } from "./iconpicker.js";
import { loadItems, openHref, KIND_ICON } from "./mentions.js";
import { filterItems, encodeLink, parseHref } from "./mentions-core.js";
import { Embeds } from "./embeds.js";
import { embedOf } from "./embeds-core.js";

const NOTES_DIR = home() + "/Notes";
const NOTE_PATH = NOTES_DIR + "/notepad.md";
const LOCK = NOTE_PATH + ".lock";               // shared with bin/notepad: one writer at a time
const DRAFT = NOTES_DIR + "/.notepad.draft.md";  // unsaved text kept when the pane closes mid-conflict
const SAVE_MS = 400;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Look. One place for every number (see refs/REFS.md).
const S = {
  title: [30, 38, 700],                   // the note's first line, drawn as the page title (Notion 40px bold, scaled)
  body: 15, lh: 24,                       // body text px, line height px (Notion 16/1.5, scaled for a pane)
  h: { 1: [28, 36, 600, 24], 2: [22, 30, 600, 18], 3: [18, 26, 600, 12] }, // Notion 1.875/1.5/1.25em, semibold, space above
  rowPad: 3,                              // vertical padding per row (Notion block 3px 0)
  width: 720, padX: 56, padTop: 32, narrow: 420, padNarrow: 20, // below `narrow` px: small margins, no handles       // content column (left margin holds the + and ⋮⋮ handles)
  check: 16, gutter: 24,                  // checkbox size, bullet/number/checkbox column (8px gap to text)
  indent: 10,                             // px per leading space (2 spaces = one 20px level)
  menuW: 248, menuItem: 32,               // slash menu (shadcn Command item: 32 high, 8px padding)
};

const backoffMs = (n) => Math.min(30_000, 1000 * 2 ** Math.max(0, n - 1));
const words = (s) => s.split(/(?<=\s)/).filter(Boolean);
const SLASH = /(^|\s)\/([\w-]*)$/;
const AT = /(^|\s)@([^\s@]*)$/;
const BY = /\s*<!-- by (.+?) -->$/;           // a line an agent added: shown as a faint "· name"
const DROP = "#2383E2";                         // Notion's drop-line blue
// The page font: macOS's system font, like Notion. Herdr's bundled UI font has no bold, so headings looked flat.
const FONT = ".SystemUIFont";
// Parsed inline runs, cached by line text (a redraw re-reads every line; most never change).
const INLINE = new Map();
function inline(text) {
  let v = INLINE.get(text);
  if (!v) { if (INLINE.size > 4000) INLINE.clear(); v = parseInline(text); INLINE.set(text, v); }
  return v;
}
const BADGE_ICON = { agent: "chat", tab: "list", file: "file", date: "calendar", url: "globe" };
const PH = { p: "Type '/' to style", h1: "Heading 1", h2: "Heading 2", h3: "Heading 3", task: "To-do", bullet: "List", number: "List", quote: "Empty quote" };
// Rows whose markdown prefix is drawn as a control (checkbox, bullet...) and kept out of the text box.
const DECORATED = new Set(["h", "task", "bullet", "number", "quote"]);

export default class Notes extends View {
  init(_p, cx) {
    this.handle = cx.focus_handle();
    if (props()?.export) { this.exporting = false; return; }   // opened by the header's Export button
    if (props()?.view) return this.initViewer(cx);              // a file mention opened beside the note
    this.ta = TextareaState.new({});   // placeholders are drawn by renderActive (they change with the row type)
    this.titleTa = TextareaState.new({ placeholder: "Untitled" });
    this.titleTa.set_auto_grow(1, 8);
    this.titleTa.set_soft_wrap(true);
    this.titleTa.on("change", (_e, cx) => this.onTitleChange(cx));
    this.ta.set_auto_grow(1, 80);
    this.ta.set_soft_wrap(true);
    this.ta.on("change", (_e, cx) => this.onChange(cx));
    this.cur = null;          // { path, text, loaded (null: no file yet), dirty, conflict }
    this.rows = [];
    this.active = -1;
    this.prefix = "";         // the active row's marker, drawn as a control and kept out of the text box
    this.menu = null;         // { at, items, query }
    this.lastMd = this.md;
    this.error = null;
    this.seq = 0;
    this.changedAt = 0;
    this.suffix = "";         // the active row's hidden "by" marker, kept out of the text box
    this.picker = new IconPicker();
    this.embeds = new Embeds();
    this.pickerOpen = false; this.pickerClosedAt = 0; this.titleHover = false;
    this.mentions = []; this.mentionsAt = 0;
    this.hoverRow = -1; this.hoverSeq = 0; this.drag = null;
    this.width = 800;      // pane width (on_size_change); FORK: panes have no min width a mod can set
    this.rowH = {};        // measured row heights by state, for the line-switch jitter check (see measure()) this.dragMoved = false; this.blockMenu = -1;

    cx.spawn(async (cx) => {
      try { await exec("mkdir", ["-p", NOTES_DIR]); } catch (e) { this.error = `Cannot create ${NOTES_DIR}: ${e}`; }
      const text = await readTextFile(NOTE_PATH).catch(() => null);
      this.cur = { path: NOTE_PATH, text: text ?? "", loaded: text, dirty: false, conflict: false, front: "" };
      const { front, body } = splitFront(text ?? "");
      this.cur.front = front;
      this.rows = body ? splitRows(body) : ["", ""];
      if (!text) this.activate(0, cx, true);
      this.publishLinks();
      cx.notify();
      this.watch(cx);
      // A draft left by a pane that closed with unsaved changes: offer it back.
      const draft = await readTextFile(DRAFT).catch(() => null);
      if (draft !== null && draft !== this.cur.text) { this.draft = draft; cx.notify(); }
      else if (draft !== null) exec("rm", ["-f", DRAFT]).catch(() => {});
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") { if (this.active >= 0) this.focusText(cx); else this.handle.focus(); }
        // ⌘A (keys.json "mod:fork-notepad"): select the line you're on. FORK: all lines needs a whole-note selection.
        if (c === "select-all" && this.active >= 0) { const b = this.box(); b.set_selected_range({ start: 0, end: b.value().length }); }
        cx.notify();
      }
    });
    cx.timer.every(60000, (cx) => cx.notify());
  }

  // ---- file ----
  get md() { return shared("notepad.md") === true; }

  watch(cx) {
    cx.spawn(async (cx) => {
      let failures = 0;
      for (;;) {
        try {
          await watchFolder(NOTES_DIR);
          failures = 0;
          await this.refreshCurrent();
          cx.notify();
        } catch (e) {
          if (failures === 0) { this.error = `Cannot watch ${NOTES_DIR}: ${e}`; cx.notify(); }
          failures++;
          await cx.sleep(backoffMs(failures));
        }
      }
    });
  }

  // The open note changed on disk. Our own saves match what we have and are ignored; an outside edit
  // is taken only while nothing is being typed, otherwise it shows the Reload / Overwrite banner.
  async refreshCurrent() {
    const c = this.cur;
    if (!c || !c.path) return;
    const disk = await readTextFile(c.path).catch(() => null);
    if (disk === null || disk === c.loaded || disk === c.text || disk === c.writing || this.cur !== c) return;
    // Something only appended (the `notepad` command agents use): merge it live, even mid-typing.
    if (this.isAppend(disk)) return this.mergeAppend(disk);
    if (c.dirty || this.active >= 0) { c.conflict = true; return; }
    this.adopt(disk);
  }

  isAppend(disk) {
    const c = this.cur;
    return c.loaded !== null && disk !== null && disk.length > c.loaded.length && disk.startsWith(c.loaded);
  }

  // Add what was appended on disk after our base to our text, with exactly one line break at the seam.
  mergeAppend(disk) {
    const c = this.cur;
    let add = disk.slice(c.loaded.length);
    if (c.text.endsWith("\n") && add.startsWith("\n")) add = add.slice(1);
    else if (c.text !== "" && !c.text.endsWith("\n") && !add.startsWith("\n")) add = "\n" + add;
    c.text += add;
    c.loaded = disk;
    c.dirty = c.text !== disk;
    const { front, body } = splitFront(c.text);
    c.front = front;
    this.rows = splitRows(body);
    if (this.active >= this.rows.length) this.active = -1;
    this.publishLinks();
  }

  adopt(text) {
    this.cur.text = text; this.cur.loaded = text; this.cur.dirty = false; this.cur.conflict = false;
    const { front, body } = splitFront(text);
    this.cur.front = front;
    this.rows = splitRows(body);
    this.active = -1; this.menu = null;
    this.publishLinks();
  }

  // Publish the note's links (shared "notepad.links") so pane headers can show a backlink mark.
  publishLinks() {
    const hrefs = [...new Set(this.rows.flatMap((row) => inline(row).filter((x) => x.t === "link").map((x) => x.href)))].sort();
    const now = shared("notepad.links");
    if (!Array.isArray(now) || now.join("\n") !== hrefs.join("\n")) setShared("notepad.links", hrefs);
  }

  edited(cx) {
    this.cur.text = this.cur.front + joinRows(this.rows);
    this.cur.dirty = true;
    const mine = ++this.seq;
    cx.timer.after(SAVE_MS, (cx) => { if (mine === this.seq) this.save(false, cx); });
  }

  // One save at a time, under the lock bin/notepad also takes. An agent's append since our base is merged
  // first; any other outside change becomes the Reload / Keep mine banner. `loaded` moves only after a write lands.
  save(force, cx) {
    const c = this.cur;
    if (!c || (!c.dirty && !force)) return this.saving ?? Promise.resolve();
    if (this.saving) { this.saveAgain = true; return this.saving; }
    this.saving = (async () => {
      do { this.saveAgain = false; await this.saveOnce(c, force, cx); force = false; } while (this.saveAgain && c.dirty && !c.conflict);
      this.saving = null;
      cx.notify();
    })();
    return this.saving;
  }

  async saveOnce(c, force, cx) {
    if (c.text.trim() === "" && c.loaded === null) return;
    const locked = await this.lock(cx);
    try {
      const disk = await readTextFile(c.path).catch(() => null);
      if (!force && disk !== c.loaded) {
        if (this.isAppend(disk)) this.mergeAppend(disk);
        else if (disk !== c.text) { c.conflict = true; return; }
      }
      const text = c.text;
      c.writing = text;
      await writeTextFile(c.path, text, disk);
      c.loaded = text; c.dirty = c.text !== text; c.conflict = false; this.error = null;
      this.publishLinks();
    } catch (e) {
      this.error = `Cannot save: ${e}`;
    } finally {
      c.writing = null;
      if (locked) await exec("rmdir", [LOCK]).catch(() => {});
    }
  }

  // mkdir is atomic: the same lock directory the CLI uses. Gives up after ~2s (a stale lock is the CLI's to clear).
  async lock(cx) {
    for (let n = 0; n < 20; n++) {
      const r = await exec("mkdir", [LOCK]).catch(() => null);
      if (r && r.code === 0) return true;
      await cx.sleep(100);
    }
    return false;
  }

  restoreDraft(keep, cx) {
    if (keep) {
      this.cur.text = this.draft;
      const { front, body } = splitFront(this.draft);
      this.cur.front = front; this.rows = splitRows(body); this.active = -1;
      this.cur.dirty = true;
      this.save(true, cx);
    }
    this.draft = null;
    exec("rm", ["-f", DRAFT]).catch(() => {});
    cx.notify();
  }

  // ---- editing ----
  // Row 0 is the title: its own text box ("Untitled" placeholder), stored as a "# " heading line.
  box() { return this.active === 0 ? this.titleTa : this.ta; }
  titleText(row) { return this.md ? row : row.replace(/^#{1,6}\s+/, ""); }
  titleRow(v) { return this.md ? v : (v.trim() ? "# " + v : ""); }
  focusText(cx) { cx.timer.after(30, () => this.box().focus()); }

  onTitleChange(cx) {
    if (this.active !== 0 || !this.cur) return;
    this.changedAt = Date.now();
    const v = this.titleTa.value();
    if (v.includes("\n")) {
      const [first, ...rest] = v.split("\n");
      this.rows[0] = this.titleRow(first);
      this.rows.splice(1, 0, rest.join("\n"));
      this.edited(cx);
      return this.activate(1, cx, false);
    }
    const row = this.titleRow(v);
    if (row === this.rows[0]) return;
    this.rows[0] = row;
    this.edited(cx);
    cx.notify();
  }

  // The row's marker goes to a control when markdown is hidden; with markdown shown the box holds the raw row.
  splitPrefix(row) {
    if (this.md || isFence(row)) return ["", row];
    const r = parseRow(row);
    return DECORATED.has(r.kind) ? [r.indent + r.marker, r.text] : ["", row];
  }

  // What the text box holds for a row: the row minus its drawn marker (prefix) and hidden "by" note (suffix).
  seat(row, i) {
    if (i === 0) { this.prefix = ""; this.suffix = ""; return this.titleText(row); }
    const [prefix, text] = this.splitPrefix(row);
    const m = BY.exec(text);
    this.prefix = prefix; this.suffix = m ? m[0] : "";
    return m ? text.slice(0, -m[0].length) : text;
  }

  // Put text into the body text box with its links as inline tokens (drawn as badges, kept as markdown in the value).
  setBox(text) {
    if (this.md || this.active === 0) return this.box().set_value(text);
    const spans = linkSpans(text);
    if (!spans.length) return this.ta.set_value(text);
    this.ta.set_value({ text, tokens: spans.map((sp) => ({ range: { start: sp.start, end: sp.end }, token: { id: sp.href, text: sp.text, label: sp.label } })) });
  }

  commit() {
    if (this.active < 0) return;
    this.active = -1; this.menu = null;
  }

  activate(i, cx, atEnd, at) {
    this.commit();
    if (i < 0 || i >= this.rows.length) { cx.notify(); return; }
    this.active = i;
    const text = this.seat(this.rows[i], i);
    this.setBox(text);
    const pos = at ?? (atEnd ? text.length : 0);
    this.box().set_selected_range({ start: pos, end: pos });
    this.focusText(cx);
    cx.notify();
  }

  setRow(text, cx) {
    // Re-split after a type change so the text box only ever holds the text part.
    this.rows[this.active] = text;
    const rest = this.seat(text, this.active);
    if (this.ta.value() !== rest) { this.setBox(rest); this.ta.set_selected_range({ start: rest.length, end: rest.length }); }
    this.edited(cx);
  }

  onChange(cx) {
    if (this.active < 1 || !this.cur) return;
    this.changedAt = Date.now();
    const v = this.ta.value();
    const full = this.prefix + v + this.suffix;
    if (full === this.rows[this.active]) return;

    // FORK: Enter can't be intercepted; the newline it types is how a row ends. A code block keeps its newlines.
    if (v.includes("\n") && !isFence(full)) {
      if (this.menu) { this.choose(v.replace("\n", ""), cx); return; }
      const parts = v.split("\n");
      const first = this.prefix + parts[0] + this.suffix;
      if (parts.length === 2 && parts[1] === "" && isEmptyItem(first)) { this.setRow("", cx); cx.notify(); return; }
      const lead = parts.length === 2 ? continuePrefix(first) : "";
      const added = parts.slice(1).map((p, k) => (k === 0 ? lead : "") + p);
      this.rows.splice(this.active, 1, first, ...added);
      this.edited(cx);
      const target = this.active + added.length;
      this.activate(target, cx, false, parts.length === 2 ? this.splitPrefix(this.rows[target])[1].length - parts[1].length : undefined);
      return;
    }

    // "---" typed on its own row becomes a divider, and the cursor moves to a fresh row below.
    if (!this.md && full === "---") {
      this.rows.splice(this.active, 1, "---", "");
      this.edited(cx);
      return this.activate(this.active + 1, cx, true);
    }
    // Markdown shortcuts: typing "# ", "- ", "[] " or "1. " at the start turns the row into that type.
    if (!this.md && this.prefix === "") {
      const shortcut = /^\[\]\s$/.test(v.slice(0, 3)) ? "- [ ] " + v.slice(3) : null;
      const r = parseRow(shortcut ?? full);
      if (shortcut || (DECORATED.has(r.kind) && r.marker)) { this.setRow(shortcut ?? full, cx); this.updateMenu(cx); cx.notify(); return; }
    }
    this.rows[this.active] = full;
    this.updateMenu(cx);
    this.edited(cx);
    cx.notify();
  }

  updateMenu(cx) {
    const v = this.ta.value();
    const at = AT.exec(v), m = at ? null : SLASH.exec(v);
    if (!at && !m) { this.menu = null; return; }
    if (at && cx && Date.now() - this.mentionsAt > 15000) {
      // Load chats, tabs and files once in a while; refresh the open menu when they arrive.
      this.mentionsAt = Date.now();
      cx.spawn(async (cx) => { this.mentions = await loadItems(); if (this.menu?.type === "at") { this.updateMenu(cx); cx.notify(); } });
    }
    const type = at ? "at" : "slash";
    const items = at ? filterItems(this.mentions, at[2]) : filterTypes(m[2]);
    if (!items.length && type === "slash") { this.menu = null; return; }
    const opening = !this.menu;
    this.menu = { type, at: Math.max(0, Math.min(this.menu?.at ?? 0, items.length - 1)), items, query: (at ?? m)[2] };
    // FORK: the text box keeps ↑/↓ for its cursor, so while the menu is open the pane takes the keyboard
    // and feeds typing into the filter itself (see menuKey). A cancelable key hook would make this unnecessary.
    if (opening) this.handle.focus();
  }

  // Keys while the / menu is open (the pane holds the keyboard).
  menuKey(e, cx) {
    const k = e.keystroke, n = Math.max(1, this.menu.items.length);
    if (k === "up" || k === "down") { this.menu.at = (this.menu.at + (k === "down" ? 1 : n - 1)) % n; return cx.notify(); }
    if (k === "enter" || k === "tab") return this.choose(undefined, cx);
    if (k === "escape") { this.menu = null; this.focusText(cx); return cx.notify(); }
    const v = this.ta.value();
    let next = null;
    if (k === "backspace") next = v.slice(0, -1);
    else if (e.key_char && !e.modifiers?.platform && !e.modifiers?.control && !e.modifiers?.alt) next = v + e.key_char;
    if (next === null) return;
    this.setBox(next);
    this.ta.set_selected_range({ start: next.length, end: next.length });
    this.onChange(cx);
    if (!this.menu) this.focusText(cx);    // the filter emptied or a space ended it: back to typing
    cx.notify();
  }

  // Enter in an open menu: apply the highlighted / type or @ mention.
  choose(value, cx) {
    const item = this.menu.items[this.menu.at];
    if (this.menu.type === "at") return item ? this.mention(item, value, cx) : (this.menu = null, cx.notify());
    return this.pick(item?.id, value, cx);
  }

  // Replace the typed "@query" with the mention's markdown link.
  mention(item, value, cx) {
    const v = (value ?? this.ta.value()).replace(AT, "$1") + encodeLink(item) + " ";
    this.menu = null;
    this.setBox(v);   // the link becomes an inline badge in the line you're typing, right away
    this.ta.set_selected_range({ start: v.length, end: v.length });
    this.rows[this.active] = this.prefix + v + this.suffix;
    this.edited(cx);
    this.focusText(cx);
    cx.notify();
  }

  // Apply a slash-menu choice to the active row (its "/query" removed).
  pick(id, value, cx) {
    if (!id) return;
    const base = this.prefix + (value ?? this.ta.value()).replace(SLASH, "$1").replace(/\s$/, "");
    this.menu = null;
    this.focusText(cx);
    if (id === "hr") {
      const keep = base.trim() ? [base] : [];
      this.rows.splice(this.active, 1, ...keep, "---", "");
      this.edited(cx);
      this.activate(this.active + keep.length + 1, cx, true);
      return;
    }
    this.setRow(setType(base, id) + this.suffix, cx);
    this.focusText(cx);
    cx.notify();
  }

  removeRow(cx) {
    const i = this.active;
    if (this.prefix) { this.setRow(this.ta.value() + this.suffix, cx); cx.notify(); return; } // Backspace on an empty item: back to text
    if (i <= 0 || this.rows.length <= 1) return;
    this.rows.splice(i, 1);
    this.edited(cx);
    this.activate(Math.max(0, i - 1), cx, true);
  }

  toggleCheck(i, cx) {
    this.rows[i] = toggleTask(this.rows[i]);
    if (i === this.active) this.prefix = this.splitPrefix(this.rows[i])[0];
    this.edited(cx);
    cx.notify();
  }

  toggleMd() { setShared("notepad.md", !this.md); }

  get icon() { return this.cur ? iconOf(this.cur.front) : ""; }
  setIcon(icon, cx) {
    this.cur.front = withIcon(this.cur.front, icon);
    this.edited(cx);
    cx.notify();
  }

  // Drag a row by its ⋮⋮ handle: `to` is the gap it lands in (row index it goes before). Row 0 is the title.
  moveRow(from, to, cx) {
    if (from < 1 || to < 1 || to === from || to === from + 1) return;
    this.commit();
    const [row] = this.rows.splice(from, 1);
    this.rows.splice(to > from ? to - 1 : to, 0, row);
    this.edited(cx);
  }

  blockAction(i, what, cx) {
    this.blockMenu = -1;
    this.commit();
    if (what === "delete") { this.rows.splice(i, 1); if (this.rows.length < 2) this.rows.push(""); }
    else if (what === "duplicate") this.rows.splice(i + 1, 0, this.rows[i]);
    else this.rows[i] = setType(this.rows[i], what);
    this.edited(cx);
    cx.notify();
  }

  // Notion's +: a new row below with the / menu open.
  addBelow(i, cx) {
    i = Math.max(0, i);
    this.rows.splice(i + 1, 0, "/");
    this.edited(cx);
    this.activate(i + 1, cx, true);
    this.updateMenu(cx);
  }

  tail(cx) {
    if (this.rows[this.rows.length - 1].trim() !== "") { this.rows.push(""); this.edited(cx); }
    this.activate(this.rows.length - 1, cx, true);
  }


  onKey(e, cx) {
    const k = e.keystroke;
    if (k === "cmd-e" || k === "cmd-shift-m") return this.toggleMd();
    if (k === "escape" && (this.pickerOpen || this.blockMenu >= 0)) { this.pickerOpen = false; this.blockMenu = -1; return cx.notify(); }
    if (this.active < 0) return;
    if (this.menu) return this.menuKey(e, cx);
    if (k === "escape") { this.commit(); this.handle.focus(); return cx.notify(); }
    const single = !this.box().value().includes("\n");
    // FORK: with a readable cursor (selected_range) these would only fire at the first/last visual line.
    if (k === "up" && single && this.active > 0) return this.activate(this.active - 1, cx, true);
    if (k === "down" && single && this.active === this.rows.length - 1 && this.active === 0) { this.rows.push(""); this.edited(cx); }
    if (k === "down" && single && this.active < this.rows.length - 1) return this.activate(this.active + 1, cx, true);
    // FORK: a Backspace that changed nothing means the box was already empty (no cancelable key hook yet).
    if (k === "backspace" && this.active > 0 && this.ta.value() === "" && Date.now() - this.changedAt > 40) return this.removeRow(cx);
  }

  // ---- drawing ----
  runs(t, text, size, lh, opts = {}) {
    const by = BY.exec(text);
    if (by) text = text.slice(0, -by[0].length);
    const parts = inline(text);
    // Most lines are plain text: one element that wraps by itself, instead of one per word.
    if (!by && parts.length <= 1 && (parts[0]?.t ?? "text") === "text") {
      let el = div().flex_1().min_w_0().text_size(size).line_height(`${lh}px`).text_color(opts.color ?? t.foreground).child(text || " ");
      if (opts.weight) el = el.font_weight(opts.weight);
      if (opts.strike) el = el.line_through();
      return el;
    }
    const row = h_flex().flex_wrap().flex_1().min_w_0();
    const mono = settings().font_family;
    for (const r of parts) {
      if (r.t === "mark" && !this.md) continue;
      if (r.t === "link" && !this.md) {
        const href = r.href;
        row.child(this.badge(t, href, r.s, size, lh, opts.color).id(`lk-${this.linkSeq++}`)
          .on_click((_e, cx) => { cx.stop_propagation(); openHref(href, cx); }));
        continue;
      }
      if (r.t === "code") {
        row.child(div().text_size(size - 2).line_height(`${lh}px`).font_family(mono).px(5).rounded(4).bg(t.raised).text_color(t.foreground).child(r.s));
        continue;
      }
      for (const w of words(r.s)) {
        let el = div().text_size(size).line_height(`${lh}px`).text_color(r.t === "mark" ? t.dim : (opts.color ?? t.foreground)).child(w);
        if (opts.weight) el = el.font_weight(opts.weight);
        if (r.t === "bold") el = el.font_weight(700);
        if (r.t === "italic") el = el.italic();
        if (opts.strike && r.t !== "mark") el = el.line_through();
        row.child(el);
      }
    }
    if (by) row.child(div().ml(6).text_size(12).line_height(`${lh}px`).text_color(t.dim).child(`· ${by[1]}`));
    return row;
  }

  // Notion's inline mention: at the line's size, small icon + name with a faint underline, light bg on hover.
  // Used both in styled lines and as the text box's inline token, so a mention looks the same while typing.
  badge(t, href, label, size, lh, color, selected) {
    const kind = parseHref(href).kind;
    return h_flex().px(2).gap(3).items_center().rounded(3).cursor_pointer().when(Boolean(selected), (b) => b.bg(t.selection))
      .hover((s) => s.bg(t.hover))
      .child(svg(`mods/fork-notepad/icons/${BADGE_ICON[kind] ?? "bookmark"}.svg`).size(Math.round(size * 0.85)).flex_none().text_color(t.muted))
      .child(div().text_size(size).line_height(`${lh}px`).font_weight(500).border_b(1).border_color(t.dim)
        .text_color(kind === "date" ? t.muted : (color ?? t.foreground)).child(label));
  }

  // Size and weight a row's text uses, styled or in the text box.
  metrics(r) {
    if (r.kind === "h") { const [size, lh, weight, top] = S.h[r.level]; return { size, lh, weight, top }; }
    return { size: S.body, lh: S.lh, weight: 400, top: 0 };
  }

  checkbox(t, i, checked) {
    return div().id(`cb-${i}`).flex_none().size(S.check).rounded(4).border(1)
      .border_color(checked ? t.accent : t.muted).when(checked, (el) => el.bg(t.accent))
      .flex().items_center().justify_center().text_size(11).text_color(t.accent_foreground).cursor_pointer()
      .when(checked, (el) => el.child("✓"))
      .on_click((_e, cx) => { cx.stop_propagation(); this.toggleCheck(i, cx); });
  }

  // The control in front of a row: checkbox, bullet, number or quote bar (or the raw marker when markdown shows).
  lead(t, r, i, lh) {
    const col = (child) => div().w(S.gutter).flex_none().h(lh).flex().items_center().child(child);
    if (r.kind === "task") return col(this.checkbox(t, i, r.checked));
    if (r.kind === "bullet") return col(div().size(6).rounded(3).ml(7).when(r.indent.length >= 2, (el) => el.border(1).border_color(t.foreground)).when(r.indent.length < 2, (el) => el.bg(t.foreground)));
    if (r.kind === "number") return col(div().text_size(S.body).text_color(t.foreground).child(`${r.n}.`));
    return null;
  }

  renderTitle(t, row) {
    const [size, lh, weight] = S.title;
    const text = this.titleText(row);
    const wrap = div().id("row-0").w_full().pb(10).cursor_text().on_click((_e, cx) => this.activate(0, cx, true));
    if (!text) return wrap.child(div().text_size(size).line_height(`${lh}px`).font_weight(weight).text_color(t.dim).child("Untitled"));
    const mark = this.md ? "" : null;
    return wrap.child(this.runs(t, this.md ? row.replace(/^(#{1,6}\s+)/, "") : text, size, lh, { weight })
      .when(this.md && /^#{1,6}\s+/.test(row), (el) => el));
  }

  renderRow(t, row, i, cx) {
    if (i === 0) return this.renderTitle(t, row);
    // Embeds (images, link bookmarks, ![[file]]) draw as blocks unless the markdown is shown.
    const em = !this.md && embedOf(row);
    if (em) return div().id(`row-${i}`).w_full().py(4).cursor_text().on_click((_e, cx) => this.activate(i, cx, true))
      .child(this.embeds.render(t, em, this.embeds.get(em, cx), S.width - 2 * this.pad));
    const r = parseRow(row);
    const { size, lh, weight, top } = this.metrics(r);
    const wrap = div().id(`row-${i}`).w_full().pt(S.rowPad + top).pb(S.rowPad).cursor_text()
      .on_click((_e, cx) => this.activate(i, cx, true));
    if (r.kind === "hr") return wrap.py(9).child(this.md ? div().text_size(S.body).text_color(t.dim).child("---") : div().h(1).w_full().bg(t.border));
    if (r.kind === "code") {
      const lines = row.split("\n");
      return wrap.child(v_flex().w_full().bg(t.raised).rounded(6).px(14).py(10).children(lines.map((l, k) => {
        const fence = k === 0 || (k === lines.length - 1 && lines.length > 1 && isFence(l));
        if (fence && !this.md) return div().h(fence && k === 0 ? 0 : 0);
        return div().text_size(13).line_height("20px").font_family(settings().font_family).text_color(fence ? t.dim : t.foreground).child(l || " ");
      })));
    }
    if (r.kind === "p" && row === "") {
      return wrap.child(div().h(lh));   // Notion: an empty line you're not on shows nothing
    }
    if (r.kind === "h" && r.text === "" && !this.md) return wrap.child(div().text_size(size).line_height(`${lh}px`).font_weight(weight).text_color(t.dim).child(PH[`h${r.level}`]));
    const indent = (r.indent?.length ?? 0) * S.indent;
    if (this.md) {
      // Markdown shown: the marker stays in the text, dimmed, with the same styling.
      const marker = r.indent + r.marker;
      return wrap.pl(0).child(h_flex().items_start()
        .when(marker !== "", (el) => el.child(div().flex_none().text_size(size).line_height(`${lh}px`).text_color(t.dim).font_weight(weight).child(marker.replace(/ /g, " "))))
        .child(this.runs(t, r.text, size, lh, { weight: r.kind === "h" ? weight : 0, color: r.kind === "quote" ? t.muted : undefined })));
    }
    if (r.kind === "quote") return wrap.child(div().border_l(3).border_color(t.foreground).pl(14).child(this.runs(t, r.text, size, lh)));
    const lead = this.lead(t, r, i, lh);
    const done = r.kind === "task" && r.checked;
    return wrap.pl(indent).child(h_flex().items_start().when(Boolean(lead), (el) => el.child(lead))
      .child(this.runs(t, r.text, size, lh, { weight: r.kind === "h" ? weight : 0, color: done ? t.dim : undefined, strike: done })));
  }

  renderActive(t, i) {
    if (i === 0) {
      const [size, lh, weight] = S.title;
      // Size and weight sit on the wrapper too: text styles cascade, and the text box alone ignores weight.
      return div().id("row-0").w_full().pb(10).text_size(size).line_height(`${lh}px`).font_weight(weight).text_color(t.foreground)
        .child(Textarea.new(this.titleTa).w_full().p(0).border(0).bg(t.background).font_family(FONT)
          .text_size(size).line_height(`${lh}px`).font_weight(weight).text_color(t.foreground));
    }
    const row = this.rows[i];
    const r = parseRow(row);
    const { size, lh, weight, top } = this.metrics(this.md ? { kind: "p" } : r);
    const field = Textarea.new(this.ta)
      .token((tk) => this.badge(t, tk.token.id, tk.token.label ?? tk.token.text, size, lh, null, tk.selected))
      .on_token_click((e, cx) => openHref(e.token.id, cx))
      .w_full().p(0).border(0).bg("#00000000").font_family(FONT).text_size(size).line_height(`${lh}px`)
      .font_weight(weight).text_color(t.foreground);
    // Notion's placeholders: only on the empty line you're on, worded for its type.
    const ph = this.ta.value() === "" ? (this.md ? PH.p : PH[r.kind === "h" ? `h${r.level}` : r.kind] ?? PH.p) : null;
    const box = div().relative().w_full().text_size(size).line_height(`${lh}px`).font_weight(weight)
      .when(Boolean(ph), (el) => el.child(div().absolute().top(0).left(0).text_size(size).line_height(`${lh}px`).font_weight(weight).text_color(t.dim).child(ph)))
      .child(field);
    let body;
    if (this.md || !this.prefix) body = box;
    else if (r.kind === "quote") body = div().w_full().border_l(3).border_color(t.foreground).pl(14).child(box);
    else {
      const lead = this.lead(t, r, i, lh);
      body = h_flex().w_full().items_start().pl((r.indent?.length ?? 0) * S.indent).when(Boolean(lead), (el) => el.child(lead)).child(div().flex_1().min_w_0().child(box));
    }
    const holder = div().id(`row-${i}`).w_full().pt(S.rowPad + (this.md ? 0 : top)).pb(S.rowPad).child(body);
    const menu = this.menu && this.renderMenu(t);
    return Popup.new("slash", holder).anchor("top_left").when(Boolean(menu), (el) => el.content(menu));
  }

  renderMenu(t) {
    const { items, at } = this.menu;
    if (this.menu.type === "at") {
      const LABEL = { date: "Date", agent: "Chat", tab: "Tab", file: "File" };
      return v_flex().id("at-menu").w(S.menuW + 40).max_h(320).mt(4).p(4).gap(1).rounded(8).border(1).border_color(t.border).bg(t.popover).shadow_md()
        .child(div().px(8).py(6).text_size(12).font_weight(500).text_color(t.muted).child("Mention"))
        .when(items.length === 0, (el) => el.child(div().px(8).py(6).text_size(13).text_color(t.dim).child(this.mentions.length ? "No results" : "Loading…")))
        .children(items.map((it, k) => h_flex().id(`at-${k}`).h(32).px(8).gap(8).items_center().rounded(6).cursor_pointer()
          .when(k === at, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
          .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.mention(it, undefined, cx); })
          .child(div().w(18).flex_none().text_size(13).child(KIND_ICON[it.kind] ?? "•"))
          .child(div().flex_1().min_w_0().truncate().text_size(14).text_color(t.foreground).child(it.label))
          .child(div().max_w(140).truncate().text_size(12).text_color(t.dim).child(it.hint || LABEL[it.kind]))));
    }
    // Notion / shadcn Command: one label, groups split by hairlines; each row = line icon, name, the markdown shortcut.
    const KEY = { p: "", h1: "#", h2: "##", h3: "###", task: "[]", bullet: "-", number: "1.", quote: ">", hr: "---" };
    const GROUP = { p: 0, h1: 0, h2: 0, h3: 0, task: 1, bullet: 1, number: 1, quote: 2, hr: 2 };
    const mono = settings().font_family;
    const list = v_flex().id("slash-menu").w(S.menuW).mt(4).p(4).rounded(8).border(1).border_color(t.border).bg(t.popover).shadow_md().font_family(FONT)
      .child(div().px(8).pt(4).pb(6).text_size(12).font_weight(500).text_color(t.dim).child("Style"));
    items.forEach((it, k) => {
      if (k > 0 && GROUP[it.id] !== GROUP[items[k - 1].id]) list.child(div().h(1).mx(-4).my(4).bg(t.border));
      list.child(h_flex().id(`slash-${it.id}`).h(S.menuItem).px(8).gap(10).items_center().rounded(6).cursor_pointer()
        .when(k === at, (el) => el.bg(t.hover)).hover((s) => s.bg(t.hover))
        .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.pick(it.id, undefined, cx); })
        .child(svg(`mods/fork-notepad/blocks/${it.id}.svg`).size(16).flex_none().text_color(k === at ? t.foreground : t.muted))
        .child(div().flex_1().text_size(14).text_color(t.foreground).child(it.name))
        .child(div().text_size(12).font_family(mono).text_color(t.dim).child(KEY[it.id])));
    });
    return list;
  }

  // Flush a pending save when the pane closes, so nothing typed is lost.
  // The draft is written first (one quick local write), so a failed or cut-short save never loses typing.
  async close(cx) {
    if (!this.cur?.dirty) return;
    await exec("sh", ["-c", 'printf %s "$1" > "$2"', "sh", this.cur.text, DRAFT]).catch(() => {});
    await this.save(false, cx);
    if (!this.cur.dirty) await exec("rm", ["-f", DRAFT]).catch(() => {});
  }

  // ---- export (this mod opened as a popup by the header's Export button) ----
  async runExport(kind, cx) {
    if (this.exporting) return;
    this.exporting = true; cx.notify();
    const done = (title, body, level) => { notify({ title, body, level, timeout: 3000 }); closeOverlay(props().overlay); };
    try {
      const text = splitFront((await readTextFile(NOTE_PATH).catch(() => null)) ?? "").body;
      const name = slugOf(titleOf(text), new Date().toISOString().slice(0, 10));
      if (kind === "copy-md" || kind === "copy-text") {
        await exec("sh", ["-c", 'printf %s "$1" | pbcopy', "sh", kind === "copy-md" ? text : toPlain(text)]);
        return done(kind === "copy-md" ? "Copied as Markdown" : "Copied as plain text");
      }
      const folder = await pickFolder({ prompt: kind === "pdf" ? "Export PDF to" : "Export Markdown to" });
      if (!folder) { this.exporting = false; return cx.notify(); }
      if (kind === "md") {
        await exec("cp", [NOTE_PATH, `${folder}/${name}.md`]);
        return done("Exported", `${folder}/${name}.md`);
      }
      const tmp = (await exec("mktemp", ["-d"])).stdout.trim();
      await exec("sh", ["-c", 'printf %s "$1" > "$2"', "sh", toHtml(text, titleOf(text)), `${tmp}/note.html`]);
      await exec(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--user-data-dir=${tmp}/profile`,
        `--print-to-pdf=${folder}/${name}.pdf`, `file://${tmp}/note.html`]);
      await exec("rm", ["-rf", tmp]);
      return done("Exported PDF", `${folder}/${name}.pdf`);
    } catch (e) {
      this.exporting = false;
      done("Export failed", String(e), "error");
    }
  }

  // "Mentioned in Notepad": the lines that link to a pane (opened from that pane's header mark).
  renderBacklinks(cx) {
    const t = theme();
    if (this.blText === undefined) {
      this.blText = null;
      cx.spawn(async (cx) => { this.blText = splitFront((await readTextFile(NOTE_PATH).catch(() => null)) ?? "").body; cx.notify(); });
    }
    const want = new Set(props().backlinks);
    const lines = (this.blText ?? "").split("\n").filter((l) => parseInline(l).some((x) => x.t === "link" && want.has(x.href)));
    const plain = (l) => toPlain(l.replace(BY, ""));
    return v_flex().id("backlinks").size_full().p(4).gap(1).bg(t.popover).font_family(FONT)
      .child(div().px(8).py(6).text_size(12).font_weight(500).text_color(t.muted).child("Mentioned in Notepad"))
      .children(lines.map((l, k) => div().id(`bl-${k}`).px(8).py(6).rounded(6).text_size(13).text_color(t.foreground).truncate().child(plain(l))))
      .when(this.blText !== null && !lines.length, (el) => el.child(div().px(8).py(6).text_size(13).text_color(t.dim).child("No mentions")));
  }

  renderExport() {
    const t = theme();
    const item = (id, label, hint) => h_flex().id(`ex-${id}`).h(32).px(8).gap(8).items_center().rounded(6).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.runExport(id, cx))
      .child(div().flex_1().text_size(13).text_color(t.foreground).child(label))
      .child(div().text_size(11).text_color(t.dim).child(hint));
    return v_flex().id("export").size_full().p(4).gap(1).bg(t.popover)
      .child(div().px(8).py(6).text_size(12).font_weight(500).text_color(t.muted).child(this.exporting ? "Exporting…" : "Export"))
      .child(item("copy-md", "Copy as Markdown", ""))
      .child(item("copy-text", "Copy as plain text", ""))
      .child(div().h(1).mx(4).my(4).bg(t.border))
      .child(item("md", "Save Markdown…", ".md"))
      .child(item("pdf", "Save PDF…", ".pdf"));
  }

  // Notion's page icon: a hover row above the title ("Add icon"), or the icon itself; both open the picker.
  titleArea(t, el) {
    const icon = this.icon;
    const toggle = (_e, cx) => {
      if (Date.now() - this.pickerClosedAt < 250) return;
      this.pickerOpen = !this.pickerOpen;
      if (this.pickerOpen) this.picker.reset();
      cx.notify();
    };
    const trigger = icon
      ? div().id("page-icon").p(4).rounded(6).cursor_pointer().hover((s) => s.bg(t.hover)).on_click(toggle).child(iconElement(icon, 56, t))
      : h_flex().id("add-icon").h(28).px(6).gap(6).items_center().rounded(6).cursor_pointer().text_size(14).text_color(t.dim)
        .hover((s) => s.bg(t.hover)).on_click(toggle).when(!(this.titleHover || this.pickerOpen), (b) => b.invisible())
        .child("☺").child("Add icon");
    const pop = Popup.new("icon-pop", trigger).anchor("top_left").when(this.pickerOpen, (p) => p.content(div().mt(4)
      .on_mouse_down_out((_e, cx) => { this.pickerOpen = false; this.pickerClosedAt = Date.now(); cx.notify(); })
      .child(this.picker.render(t, {
        onPick: (ic, cx) => { this.pickerOpen = false; this.setIcon(ic, cx); },
        onRemove: (cx) => { this.pickerOpen = false; this.setIcon("", cx); },
      }))));
    return v_flex().id("title-area").w_full().pb(2)
      .on_hover((h, cx) => { if (h !== this.titleHover) { this.titleHover = h; cx.notify(); } })
      .child(h_flex().w_full().pb(4).child(pop)).child(el);
  }

  // Notion's block handles: + and ⋮⋮ in the left margin on hover; drag ⋮⋮ to move, click it for the block menu.
  // Show a row's handles on hover; hide them 150 ms after the pointer leaves (unless it came back or is dragging).
  hoverAt(i, h, cx) {
    const seq = ++this.hoverSeq;
    if (h) { if (this.hoverRow !== i) { this.hoverRow = i; cx.notify(); } return; }
    cx.timer.after(150, (cx) => {
      if (seq === this.hoverSeq && this.hoverRow === i && !this.drag) { this.hoverRow = -1; cx.notify(); }
    });
  }

  // Jitter check: a line's height when it's the text box vs styled must match. Records both and writes any
  // mismatch to ~/work.noindex/herdr-notepad/jitter.json (temporary instrument; remove once both states match).
  measure(i, row, size, cx) {
    const state = i === this.active ? "edit" : "styled";
    const k = row, prev = this.rowH[k] ?? {};
    if (prev[state] === size.height) return;
    this.rowH[k] = { ...prev, [state]: size.height };
    const rec = this.rowH[k];
    if (rec.edit !== undefined && rec.styled !== undefined) {
      this.jitter = { ...(this.jitter ?? {}), [row.slice(0, 40)]: { kind: parseRow(row).kind, edit: rec.edit, styled: rec.styled, diff: +(rec.edit - rec.styled).toFixed(2) } };
      const out = JSON.stringify({ at: new Date().toISOString(), width: this.width, rows: this.jitter }, null, 1);
      exec("sh", ["-c", 'printf %s "$1" > "$2"', "sh", out, home() + "/work.noindex/herdr-notepad/jitter.json"]).catch(() => {});
    }
  }

  get pad() { return this.width < S.narrow ? S.padNarrow : S.padX; }

  blockFrame(t, row, i, el) {
    const { lh, top } = this.metrics(parseRow(row));
    const show = this.width >= S.narrow && ((this.hoverRow === i && !this.drag) || this.blockMenu === i);
    // Notion's handles: two 24px boxes, + then ⋮⋮ ending 4px before the text, 16px icons centered, on the first line.
    const handle = (id, child) => div().id(id).size(24).flex().flex_none().items_center().justify_center().rounded(4)
      .text_color(t.dim).hover((s) => s.bg(t.hover)).cursor_pointer().child(child);
    const grip = handle(`grip-${i}`, svg("mods/fork-notepad/grip.svg").size(16))
      .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.drag = { from: i, to: i }; this.dragMoved = false; })
      .on_click((_e, cx) => { if (this.dragMoved) return; this.blockMenu = this.blockMenu === i ? -1 : i; cx.notify(); });
    const menuItem = (id, label, what) => h_flex().id(`bm-${id}-${i}`).h(28).px(8).items_center().rounded(6).cursor_pointer()
      .text_size(13).text_color(t.foreground).hover((s) => s.bg(t.hover))
      .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.blockAction(i, what, cx); }).child(label);
    const menu = v_flex().id(`block-menu-${i}`).w(220).mt(4).p(4).gap(1).rounded(8).border(1).border_color(t.border).bg(t.popover).shadow_md()
      .on_mouse_down_out((_e, cx) => { this.blockMenu = -1; cx.notify(); })
      .child(menuItem("del", "Delete", "delete")).child(menuItem("dup", "Duplicate", "duplicate"))
      .child(div().h(1).mx(4).my(4).bg(t.border))
      .child(div().px(8).py(4).text_size(12).font_weight(500).text_color(t.muted).child("Turn into"))
      .children(TYPES.filter((x) => x.id !== "hr").map((x) => menuItem(x.id, x.name, x.id)));
    const handles = h_flex().id(`handles-${i}`).absolute().left(this.pad - 24 * 2 - 2 - 4).top(S.rowPad + top + (lh - 24) / 2).gap(2)
      .on_hover((h, cx) => this.hoverAt(i, h, cx))
      .child(handle(`add-${i}`, svg("mods/fork-notepad/plus.svg").size(16)).on_click((e, cx) => this.addBelow(e.modifiers?.alt ? i - 1 : i, cx)))  // ⌥-click: above (Notion)
      .child(Popup.new(`bm-pop-${i}`, grip).anchor("top_left").when(this.blockMenu === i, (p) => p.content(menu)));
    const line = (pos) => div().absolute().left(this.pad).right(0).h(3).rounded(2).bg(DROP).when(pos === "top", (d) => d.top(-2)).when(pos === "bottom", (d) => d.bottom(-2));
    const d = this.drag && this.dragMoved ? this.drag : null;
    // The row's hover area runs into the left margin, so the pointer can reach + and ⋮⋮ without losing them.
    return div().id(`blk-${i}`).relative().ml(-this.pad).pl(this.pad)
      .on_size_change((size, cx) => this.measure(i, row, size, cx))
      .on_hover((h, cx) => this.hoverAt(i, h, cx))
      .on_mouse_move((e, cx) => {
        if (!this.drag) return;
        const to = e.local_position.y < e.bounds.height / 2 ? i : i + 1;
        if (to !== this.drag.to || !this.dragMoved) { this.drag.to = to; this.dragMoved = true; cx.notify(); }
      })
      .child(el)
      .when(show, (b) => b.child(handles))
      .when(Boolean(d) && d.to === i, (b) => b.child(line("top")))
      .when(Boolean(d) && d.to === i + 1 && i === this.rows.length - 1, (b) => b.child(line("bottom")));
  }

  // ---- viewer (a file mention opened beside the note; read-only) ----
  initViewer(cx) {
    this.view = props().view;
    this.viewText = null; this.viewEditor = null;
    cx.spawn(async (cx) => {
      const text = await readTextFile(this.view).catch(() => null);
      this.viewText = text ?? "";
      this.viewMissing = text === null;
      if (!/\.(md|markdown|mdx)$/i.test(this.view) && text !== null) {
        const ext = (this.view.match(/\.([a-z0-9]+)$/i) ?? [])[1] ?? "";
        this.viewEditor = EditorState.new({ language: ext, value: text, readonly: true, soft_wrap: true, folding: false });
      }
      cx.notify();
    });
  }

  renderViewer() {
    const t = theme();
    const name = this.view.slice(this.view.lastIndexOf("/") + 1);
    const body = this.viewText === null ? div().text_size(13).text_color(t.dim).child("Loading…")
      : this.viewMissing ? div().text_size(13).text_color(t.dim).child("File not found")
      : this.viewEditor ? Editor.new(this.viewEditor).size_full()
      : TextView.markdown(`view-${this.view}`, this.viewText).selectable(true);
    return v_flex().id("viewer").size_full().bg(t.background).font_family(FONT)
      .child(h_flex().h(32).px(12).gap(8).items_center().flex_none().border_b(1).border_color(t.border)
        .child(div().text_size(13).font_weight(500).text_color(t.foreground).child(name))
        .child(div().flex_1().min_w_0().truncate().text_size(12).text_color(t.dim).child(this.view)))
      .child(div().id("viewer-scroll").flex_1().min_h(0).overflow_y_scrollbar().px(16).py(12).child(body));
  }

  render(cx) {
    if (props()?.view) return this.renderViewer();
    if (props()?.export) return this.renderExport();
    if (props()?.backlinks) return this.renderBacklinks(cx);
    const t = theme();
    this.linkSeq = 0;
    if (this.md !== this.lastMd) { this.lastMd = this.md; this.commit(); }   // the header toggled Markdown

    const banner = (text, actions) => h_flex().mx(16).mt(8).px(12).py(8).gap(8).items_center().flex_none().rounded(8)
      .border(1).border_color(t.border).bg(t.raised).text_size(12).child(div().flex_1().child(text)).children(actions);
    const act = (id, label, action) => div().id(id).h(24).px(8).flex().items_center().rounded(6).border(1).border_color(t.border)
      .hover((s) => s.bg(t.hover)).cursor_pointer().on_click(action).child(label);

    let content;
    if (!this.cur) content = div();
    else content = v_flex().w_full()
      .children(this.rows.map((row, i) => {
        const el = i === this.active ? this.renderActive(t, i) : this.renderRow(t, row, i, cx);
        return i === 0 ? this.titleArea(t, el) : this.blockFrame(t, row, i, el);
      }))
      .child(div().id("tail").w_full().h(200).cursor_text().on_click((_e, cx) => this.tail(cx)));

    return v_flex().id("notes-root").track_focus(this.handle)
      .on_size_change((size, cx) => { if (Math.abs(size.width - this.width) > 1) { this.width = size.width; cx.notify(); } }).size_full().bg(t.background).text_color(t.foreground).font_family(FONT)
      .on_key_down((e, cx) => this.onKey(e, cx))
      .on_mouse_up("left", (_e, cx) => {
        if (!this.drag) return;
        const { from, to } = this.drag;
        this.drag = null;
        if (this.dragMoved) this.moveRow(from, to, cx);
        cx.notify();
      })
      .when(typeof this.draft === "string", (el) => el.child(banner("Unsaved changes from a closed Notepad were kept.", [
        act("restore", "Restore", (_e, cx) => this.restoreDraft(true, cx)),
        act("discard", "Discard", (_e, cx) => this.restoreDraft(false, cx)),
      ])))
      .when(Boolean(this.cur?.conflict), (el) => el.child(banner("The note changed outside Herdr.", [
        act("reload", "Reload", (_e, cx) => { readTextFile(NOTE_PATH).then((d) => { this.adopt(d ?? ""); cx.notify(); }); }),
        act("overwrite", "Keep mine", (_e, cx) => this.save(true, cx)),
      ])))
      .when(Boolean(this.error), (el) => el.child(div().px(16).pt(8).text_size(12).text_color(t.blocked).child(this.error)))
      .child(div().id("scroll").flex_1().min_h(0).overflow_y_scrollbar()
        .child(h_flex().w_full().justify_center()
          .child(v_flex().w_full().max_w(S.width).px(this.pad).pt(S.padTop).child(content))));
  }
}
