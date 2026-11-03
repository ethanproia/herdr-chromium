// The export popup's scratch folder (including a Chrome profile) has to be removed
// before the popup closes. Closing can tear the view down, and an rm that awaits
// after that never runs. A cancelled folder pick removes the folder and leaves the popup open.
// One removal: a second rm started in parallel can fail and leave the folder behind.
// A failed rm must not skip the close, or the popup stays up with no result.

// Markdown writes the note body. An empty note is a zero-byte file and is still an export.
// A PDF must be non-empty: Chrome can exit 0 after writing nothing.
export function exportFileTest(kind) {
  return kind === "md" ? "-e" : "-s";
}

export async function finishExport(cleanup, outcome, io) {
  try {
    await cleanup();
  } catch { /* the result is already decided; a leftover folder must not trap the popup */ }
  if (outcome?.cancelled) {
    io.stay();
    return;
  }
  io.close(outcome);
}
