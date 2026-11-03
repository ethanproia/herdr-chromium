// Read-only file viewer for Notepad file links (a separate mod id, so pane headers don't treat it as the
// shared note). Self-contained: Herdr mods can't import from another mod's folder.
// Props: { view: absolute path }. Markdown renders; other text files show in a read-only code view.
import { View, div } from "gpui-kit";
import { h_flex, v_flex, TextView, Editor, EditorState } from "gpui-base";
import { theme, props, readTextFile } from "herdr";

const FONT = ".SystemUIFont";

export default class NotepadView extends View {
  init(_p, cx) {
    this.path = props()?.view ?? "";
    this.text = null; this.missing = false; this.editor = null;
    cx.spawn(async (cx) => {
      const text = await readTextFile(this.path).catch(() => null);
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
