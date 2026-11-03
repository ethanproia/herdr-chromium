// Pixel height for the Spaces layout section while the sidebar is a rail.
// `content` is the tile scroller. `chrome` is the rest of that same section: the
// Expand row, present only on a windowed macOS (traffic lights take the top bar).
// Sizing the section to the tiles alone leaves the scroller short by the row, so
// the rail still scrolls and shows a bottom fade.
//
// Returns null when there is nothing to apply yet: no measured tiles, or the row
// is on screen but its height has not been measured (applying the tiles alone
// would lock in the short scroller). A measured row from an earlier windowed
// frame is ignored once the row is gone, so fullscreen and other platforms stay
// exactly as tall as the tiles.
export function railFitPx({ content, chrome, macWindowed }) {
  if (!(typeof content === "number" && content > 0)) return null;
  if (macWindowed && !(chrome > 0)) return null;
  const extra = macWindowed ? Math.ceil(chrome) : 0;
  return Math.ceil(content) + extra;
}
