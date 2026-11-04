// Read-only file viewer for Notepad file links (a separate mod id, so pane headers don't treat it as the
// shared note). Self-contained: Herdr mods can't import from another mod's folder.
// Props: { view: absolute path }. Markdown renders; other text files show in a read-only code view.
//
// It shows the file's name and path in its own top bar and publishes nothing for the pane header. A content
// mod isn't told its pane id, so labelling the header meant guessing which pane is whose; ten review rounds
// of guessing rules kept finding new races (crashed viewers, several opening at once, ping-pong writes).
// The header shows "File"; the bar right below it names the file. Revisit if Herdr gives mods their pane id.
import { View, div } from "gpui-kit";
import { h_flex, v_flex, TextView, Editor, EditorState } from "gpui-base";
import { theme, props, readTextFile, shared, setShared } from "herdr";

const FONT = ".SystemUIFont";

export default class NotepadView extends View {
  init(_p, cx) {
    this.path = props()?.view ?? "";
    this.text = null; this.missing = false; this.editor = null;
    // One-time cleanup of the keys the old pane-claiming version left in shared state.
    if (shared("notepad.viewers") != null) setShared("notepad.viewers", null);
    if (shared("notepad.files") != null) setShared("notepad.files", null);
    cx.spawn(async (cx) => {
      const text = this.path ? await readTextFile(this.path).catch(() => null) : null;   // no file given: "File not found"
      this.text = text ?? "";
      this.missing = text === null;
      if (text !== null && !/\.(md|markdown|mdx)$/i.test(this.path)) {
        const ext = (this.path.match(/\.([a-z0-9]+)$/i) ?? [])[1] ?? "";
        this.editor = EditorState.new({ language: ext, value: text, readonly: true, soft_wrap: true, folding: false });
      }
      cx.notify();
    });
  }

  render() {
    const t = theme();
    const name = this.path.slice(this.path.lastIndexOf("/") + 1) || "File";
    const body = this.text === null ? div().text_size(13).text_color(t.dim).child("Loading…")
      : this.missing ? div().text_size(13).text_color(t.dim).child("File not found")
      : this.editor ? Editor.new(this.editor).size_full()
      : TextView.markdown(`view-${this.path}`, this.text).selectable(true);
    return v_flex().id("viewer").size_full().bg(t.background).font_family(FONT)
      .child(h_flex().h(32).px(12).gap(8).items_center().flex_none().border_b(1).border_color(t.border)
        .child(div().text_size(13).font_weight(500).text_color(t.foreground).child(name))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.dim).child(this.path)))
      .child(div().id("viewer-scroll").flex_1().min_h(0).overflow_y_scrollbar().px(16).py(12).child(body));
  }
}
