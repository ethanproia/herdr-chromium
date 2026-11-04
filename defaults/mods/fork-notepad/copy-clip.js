// Copy a pane's contents without letting a failed read look like success.
// A shell pipeline's status is pbcopy's, so `hc … | pbcopy` still copies empty
// input and returns 0 when hc fails. Callers read with the hc helper, then copy
// only when that read exited 0. The note's awk strip does the same with a temp file.

export function hasCopy(spec) {
  return spec?.kind === "terminal" || spec?.kind === "sh";
}

// What the header Copy button copies. A terminal is an hc read (not a PATH lookup).
// A note is its markdown without frontmatter. Anything else has nothing to copy.
// A file viewer's path is not on the pane record, and the header is not told which
// file that pane has open, so there is no viewer branch to guess one.
export function copySpec({ terminal, isNote, dir, mod } = {}) {
  if (terminal) return { kind: "terminal", address: terminal };
  if (isNote && typeof dir === "string") return { kind: "sh", script: noteCopyCommand(), arg: `${dir}/notepad.md`, flush: mod || "fork-notepad" };
  return null;
}

// Strip a leading frontmatter block, then pbcopy only if awk exited 0.
// A missing file must not replace the clipboard.
export function noteCopyCommand() {
  return "out=$(mktemp) || exit 1; awk 'NR==1&&/^---$/{f=1;next} f&&/^---$/{f=0;next} !f' \"$1\" > \"$out\"; s=$?; if [ \"$s\" -eq 0 ]; then pbcopy < \"$out\"; s=$?; fi; rm -f \"$out\"; exit $s";
}

// A failed or missing read is not something to put on the clipboard, even if stdout holds a partial line.
// A successful empty read is a real empty scrollback and may be copied.
export function clipAfterRead(result) {
  if (!result || result.code !== 0) return { ok: false, code: result?.code ?? 1, stderr: result?.stderr || "" };
  return { ok: true, code: 0, text: result.stdout ?? "" };
}

// Write text to a file under the app home and pbcopy that file (exec has no stdin, and a long scrollback
// does not fit in argv). Removes the file either way.
export async function pbcopyFile(text, io) {
  const dir = `${io.appHome()}/data/pane-copy/tmp`;
  const name = `${dir}/clip-${io.stamp()}.txt`;
  const made = await io.exec("mkdir", ["-p", dir]);
  if (!made || made.code !== 0) return { code: made?.code ?? 1, stderr: made?.stderr || "Could not make a temp folder", stdout: "" };
  await io.writeTextFile(name, text ?? "", null);
  try {
    const r = await io.exec("sh", ["-c", 'pbcopy < "$1"', "sh", name]);
    return r ?? { code: 1, stderr: "", stdout: "" };
  } finally {
    await io.exec("rm", ["-f", name]).catch(() => {});
  }
}

// A flush may answer ok only when the note matches disk and is not in conflict.
// `error` also holds folder-watch and mkdir failures. save() leaves those in place when the note is
// already clean, so an error that was already set is not a failed save. An error this flush's save
// set or replaced still fails the ack (and is the message), including when dirty was cleared.
export function flushAck({ dirty, conflict, errorBefore, errorAfter }) {
  const saveError = errorAfter !== errorBefore && errorAfter ? errorAfter : null;
  const ok = !dirty && !conflict && !saveError;
  if (ok) return { ok: true };
  const error = conflict
    ? "The note changed on disk; reload or keep yours first"
    : (saveError || "The note has unsaved changes");
  return { ok: false, error };
}

// A watch failure stays up until watchFolder succeeds again. A different error that replaced it
// (a save failure) stays up when the watch recovers.
export function errorAfterWatch(error, watchError) {
  return watchError && error === watchError ? null : error;
}

// The note saves 400 ms after the last edit, so ask the open note to save first (the same request and answer
// as Export: notepad.flushReq, the <mod>.flush command, notepad.flushAck). `mod` is the note's folder name, which
// the fork renames. Resolves to an error string, or null when the file is current or no note answered in 3 s.
export async function flushNote(mod, io) {
  const req = io.stamp();
  io.setShared("notepad.flushReq", req);
  io.run(`${mod}.flush`);
  for (let i = 0; i < 30; i++) {
    const a = io.shared("notepad.flushAck");
    if (a && a.req === req) {
      // Give other open copies a moment to answer the same request; one failure wins (they never overwrite it).
      await io.sleep(150);
      const z = io.shared("notepad.flushAck");
      const ack = z && z.req === req ? z : a;
      return ack.ok ? null : (ack.error || "The note could not be saved");
    }
    await io.sleep(100);
  }
  return null;
}

export async function applyCopy(spec, io) {
  if (spec?.kind === "terminal") {
    const r = await io.hc(["read", spec.address, "--lines", "100000"]);
    const clip = clipAfterRead(r);
    if (!clip.ok) return { code: clip.code, stderr: clip.stderr, stdout: "" };
    return pbcopyFile(clip.text, io);
  }
  if (spec?.kind === "sh") {
    if (spec.flush && io.run) {
      const err = await flushNote(spec.flush, io);
      if (err) return { code: 1, stderr: err, stdout: "" };
    }
    return io.exec("sh", ["-c", spec.script, "sh", spec.arg]);
  }
  return { code: 1, stderr: "nothing to copy", stdout: "" };
}
