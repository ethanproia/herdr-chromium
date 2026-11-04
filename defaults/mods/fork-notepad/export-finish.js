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

// Copy src onto folder/name.ext without replacing anything already there.
// The bytes land in a temp file in the same directory, then a hard link publishes that name.
// A filesystem without hard links (exFAT, some SMB shares, some FUSE mounts) gets a noclobber
// create instead. mktemp's 0600 is replaced with 0666 masked by umask, the mode cp would use.
// Exit 17 means the name was already taken (the existing file is left untouched). Any other
// nonzero status means this attempt failed and removed what it created, so a short write (a full
// disk) is not left behind as name.ext for the next try to skip over.
// EXIT removes the temp name if the shell is killed before it publishes. On dash that trap does
// not run for a signal unless the signal is caught, so TERM, INT, and HUP exit through it.
// On the no-hard-link path, once this attempt owns $2, the same trap removes that name too, so a
// killed script does not leave an empty or partial file for the next run to treat as taken.
// The trap is cleared only after the name is published. It never covers a name this attempt did
// not create.
export const PUBLISH_SCRIPT = `tmp=$(mktemp "$2.XXXXXX") || exit 1
cleanup=$tmp
trap 'rm -f -- "$tmp" "$cleanup"' EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
trap 'exit 129' HUP
cat "$1" > "$tmp"
status=$?
if [ "$status" -ne 0 ]; then
  rm -f -- "$tmp"
  exit "$status"
fi
um=$(umask)
chmod "$(printf '%o' $(( 0666 & ~0$um )))" "$tmp" || {
  rm -f -- "$tmp"
  exit 1
}
ln "$tmp" "$2"
status=$?
if [ "$status" -eq 0 ]; then
  rm -f -- "$tmp"
  trap - EXIT TERM INT HUP
  exit 0
fi
if [ -e "$2" ] || [ -L "$2" ]; then
  rm -f -- "$tmp"
  exit 17
fi
rm -f -- "$tmp"
(set -C; : > "$2") || {
  status=$?
  if [ -e "$2" ] || [ -L "$2" ]; then exit 17; fi
  exit "$status"
}
cleanup=$2
cat "$1" > "$2"
status=$?
if [ "$status" -ne 0 ]; then
  rm -f -- "$2"
  exit "$status"
fi
trap - EXIT TERM INT HUP
exit 0
`;

export async function publishNew(run, must, src, folder, name, ext) {
  for (let n = 1; n <= 50; n++) {
    const dest = `${folder}/${name}${n === 1 ? "" : `-${n}`}.${ext}`;
    if ((await run("test", ["-e", dest]).catch(() => null))?.code === 0) continue;
    const r = await run("sh", ["-c", PUBLISH_SCRIPT, "sh", src, dest]);
    if (r.code === 0) {
      try {
        await must("Checking the saved file", "cmp", ["-s", src, dest]);
      } catch (e) {
        // Only this attempt's file: a nonzero publish never exits 0, so dest is one this attempt created.
        await run("rm", ["-f", "--", dest]).catch(() => {});
        throw e;
      }
      return dest;
    }
    if (r.code === 17) continue;
    throw new Error(`Saving failed${r.stderr ? `: ${r.stderr.trim()}` : ""}`);
  }
  throw new Error(`Too many files named ${name} in that folder`);
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
