// Empty and loading states for the Spaces list. Pure (no herdr imports), so node can test it.
// A list that is still loading after LOAD_TIMEOUT_MS stops saying "Loading…" and says why instead
// (Ethan 2026-11-04: a fresh home sat on "Loading…" forever; "terrible empty state").

export const LOAD_TIMEOUT_MS = 8000;

export const EMPTY_COPY = {
  title: "No spaces yet",
  body: "A space keeps one project's tabs, terminals and agents together.",
  newSpace: "New Space",
  openFolder: "Open Folder…",
  startAgent: "Start an Agent…",
};

// "loading" while within the timeout, "timeout" after it, "ready" when not loading.
// `since` is when this list was first seen loading (undefined: not loading before).
export function loadPhase(loading, since, now, timeout = LOAD_TIMEOUT_MS) {
  if (!loading) return "ready";
  if (since === undefined) return "loading";
  return now - since > timeout ? "timeout" : "loading";
}

// The rail's one empty state, for every machine key ("" is this computer), in list order.
// Welcome stays hidden while any list is still inside its timeout, so a loading remote
// is not covered by this computer's New Space tiles. A list that has already timed out
// still gets a reason tile in that same frame, including while another list is loading.
export function railEmpty(entries) {
  const loading = entries.some((e) => e.phase === "loading");
  const timeouts = [];
  for (const e of entries) {
    if (e.phase === "timeout" && !timeouts.includes(e.key)) timeouts.push(e.key);
  }
  return { loading, timeouts, welcome: !loading };
}

// Why a list stopped loading, in a few words. `machine` is the hc machine record (null for this computer).
export function timeoutReason(name, machine, timeout = LOAD_TIMEOUT_MS) {
  const secs = Math.round(timeout / 1000);
  if (!name) return `This computer's spaces didn't arrive after ${secs} s`;
  const state = typeof machine?.state === "string" ? machine.state.replace(/_/g, " ") : "";
  if (state && state !== "connected") return `${name} is ${state}`;
  return `${name} didn't send its spaces after ${secs} s`;
}

// The folder picked in the macOS chooser (osascript), or null when cancelled or failed.
export function pickedFolder(r) {
  if (!r || r.code !== 0) return null;
  const raw = String(r.stdout ?? "").trim();
  const p = raw.length > 1 ? raw.replace(/\/$/, "") : raw;   // "/" (the disk root) stays "/"
  return p ? p : null;
}

// Keep a stamp only for keys that are loading now. A key left out (it finished, its machine is gone,
// or this pass doesn't know it) loses its stamp, so a later load does not inherit a stale timeout.
// `started` is the keys whose stamp is new: arm one wake-up for each, once.
export function syncLoading(since, loadingKeys, now) {
  const next = {};
  const started = [];
  for (const key of loadingKeys) {
    if (Object.hasOwn(next, key)) continue;
    if (Object.hasOwn(since, key)) next[key] = since[key];
    else {
      next[key] = now;
      started.push(key);
    }
  }
  return { since: next, started };
}

// One redraw per stamp when the timeout flips, and one timer armed per stamp before that.
// Pass the returned `pending` and `notified` back in: a later call does not arm or notify again,
// so a poll that runs on every redraw cannot loop. Already past the timeout (the timer was missed,
// or this is the first look) notifies once, instead of hoping a tick lands in a window.
export function loadTimeoutPlan(since, now, pending = {}, notified = {}, timeout = LOAD_TIMEOUT_MS) {
  const arm = [];
  const notify = [];
  const nextPending = {};
  const nextNotified = {};
  for (const key of Object.keys(since)) {
    const stamp = since[key];
    if (notified[key] === stamp) {
      nextNotified[key] = stamp;
      continue;
    }
    if (now - stamp > timeout) {
      notify.push(key);
      nextNotified[key] = stamp;
      continue;
    }
    nextPending[key] = stamp;
    if (pending[key] !== stamp) arm.push({ key, since: stamp, wait: Math.max(0, stamp + timeout + 1 - now) });
  }
  return { arm, notify, pending: nextPending, notified: nextNotified };
}
