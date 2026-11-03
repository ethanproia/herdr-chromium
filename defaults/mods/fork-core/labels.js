// Pure label text for Copy link. No herdr imports, so node can test it.

export function escapeLabel(s) {
  return String(s ?? "").replace(/[\\\]]/g, "\\$&");
}

// The tab's name, or its 1-based place when it has none. A tab that is not in the space
// uses its id: indexOf(missing) + 1 is 0, which is not a tab number.
export function tabLeaf(tabs, id) {
  const list = Array.isArray(tabs) ? tabs : [];
  const i = list.findIndex((t) => t && t.id === id);
  if (i < 0) return id == null || id === "" ? "" : String(id);
  return list[i].name ? String(list[i].name) : String(i + 1);
}
