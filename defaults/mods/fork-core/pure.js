// Pure helpers: no host imports, so `node core/test.mjs` can load them.

export const ROLES = ["tabs", "pane-header", "menu", "plus", "new-panel", "side-strip", "sidebar-footer", "status", "sidebar-header"];

// Which role a copy of core plays. An explicit props.role wins; otherwise Herdr's own shapes decide:
// terminal_menu passes { tab, target }; pane.split passes { direction }; a pane header block passes { pane }.
export function pickRole(p) {
  p = p && typeof p === "object" ? p : {};
  if (ROLES.includes(p.role)) return p.role;
  if (p.tab) return "menu";
  if (p.direction) return "new-panel";
  if (p.pane && !p.overlay) return "pane-header";
  return null;
}

// "cmd-shift-enter" -> "⌘⇧↩", as macOS menus write shortcuts.
export const KEYSYM = { cmd: "⌘", shift: "⇧", alt: "⌥", ctrl: "⌃", enter: "↩", backspace: "⌫", escape: "⎋", tab: "⇥", up: "↑", down: "↓", left: "←", right: "→", space: "Space" };
export function keysym(k) {
  if (!k) return "";
  const first = String(k).split(/\s+/)[0];
  return first.split("-").map((p) => KEYSYM[p] ?? (p.length === 1 ? p.toUpperCase() : p)).join("");
}

// Copy scripts. The producer writes a temp file and the clipboard is only touched when it exited 0 (so a failing
// producer never leaves a half copy or an empty clipboard, and the exit code is the producer's or pbcopy's).
// $1 = what to copy (terminal address, file path or text), $2 = temp folder (optional: TMPDIR when absent).
// The Notepad's ••• popup runs [script, $1] itself, hence the $2 fallback.
const guarded = (producer) =>
  'd="${2:-${TMPDIR:-/tmp}}"; mkdir -p "$d" && t="$d/copy.$$" && ' + producer + ' > "$t" && pbcopy < "$t"; rc=$?; rm -f "$t"; exit $rc';
export const COPY_TERMINAL = guarded('hc read "$1" --lines 100000');
export const COPY_FILE = guarded('cat "$1"');
export const COPY_FILE_STRIPPED = guarded("awk 'NR==1&&/^---$/{f=1;next} f&&/^---$/{f=0;next} !f' \"$1\"");
export const COPY_TEXT = guarded('printf %s "$1"');

// What a header's Copy button copies, as [script, argument] or null.
// `shared` is a reader for shared keys (injected so this stays pure).
export function copyPlan({ terminal, copy, viewPath }, shared) {
  if (terminal) return [COPY_TERMINAL, terminal];
  if (viewPath) return [COPY_FILE, viewPath];
  const c = copy?.copyFile;
  if (c) {
    let path = null;
    if (typeof c.path === "string" && c.path) path = c.path;
    else if (c.dirShared) {
      const dir = shared(c.dirShared);
      if (typeof dir === "string" && dir && c.file) path = `${dir}/${c.file}`;
    }
    if (path) return [c.stripFrontmatter ? COPY_FILE_STRIPPED : COPY_FILE, path];
  }
  return null;
}

// Menu height: rows are 32px, a hairline group break is 9px, 4px padding top and bottom.
export const menuHeight = (rows, breaks) => 8 + rows * 32 + breaks * 9;
