// Pure decisions for the Notepad header menu's Copy. No herdr imports, so node can test it.
// The pane header copies through core (copyPlan / runPaneCopy), not these shells.

// A failed `hc read` must not reach pbcopy: pbcopy exits 0 on empty stdin and would wipe the
// clipboard. An empty success (a blank terminal) is a real copy, so only a nonzero code refuses.
export function terminalCopyPlan(result) {
  if (!result || result.code !== 0) {
    const stderr = result && typeof result.stderr === "string" ? result.stderr.trim().slice(0, 200) : "";
    return { copy: false, error: stderr };
  }
  return { copy: true, text: typeof result.stdout === "string" ? result.stdout : "" };
}

// awk writes the note body to a temp file; pbcopy runs only after awk succeeds.
export function noteCopyShell() {
  return "awk 'NR==1&&/^---$/{f=1;next} f&&/^---$/{f=0;next} !f' \"$1\" > \"$2\" && pbcopy < \"$2\"";
}

export function fileCopyShell() {
  return 'pbcopy < "$1"';
}
