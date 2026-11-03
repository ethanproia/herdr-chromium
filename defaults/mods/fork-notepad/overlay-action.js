// A popup menu item.
// Async work (a copy that awaits hc or pbcopy) has to start before the popup closes.
// Closing can tear the view down, and a promise that then awaits in that view never finishes,
// so the clipboard write and its notification are lost. The popup closes when that work settles.
// Sync items close first and then run, so Export still opens the next popup once this one is gone.
// hc, pbcopy and exec have no deadline (a note flush does, at 3s). The same wait covers Copy
// contents and a menu's link copy. After 10s the popup closes even if that work is still
// pending, so a hung read cannot leave it open. Giving up does not cancel the copy.
// Mods have no setTimeout (Herdr AGENTS.md): callers pass `sleep`, the click's cx.sleep. Without one
// (and without a global setTimeout, as in Node tests) the popup waits for the work only.

const OVERLAY_WAIT_MS = 10000;
const defaultSleep = typeof globalThis.setTimeout === "function" ? (ms) => new Promise((r) => globalThis.setTimeout(r, ms)) : null;

export function runOverlayItem(action, close, asyncWork, waitMs = OVERLAY_WAIT_MS, sleep = defaultSleep) {
  if (!asyncWork) {
    close();
    action();
    return undefined;
  }
  let pending;
  try {
    pending = action();
  } catch (e) {
    close();
    throw e;
  }
  // A sleep that throws (or is missing) must not close the popup early: it just means no limit.
  let limit = new Promise(() => {});
  if (typeof sleep === "function") {
    try { limit = Promise.resolve(sleep(waitMs)).catch(() => new Promise(() => {})); } catch { /* no limit */ }
  }
  // The copy promise is abandoned on timeout. A rejection that lands after that must not
  // become unhandled, and one that lands before it must still reject this wait.
  const work = Promise.resolve(pending);
  work.catch(() => {});
  return Promise.race([work, limit]).finally(close);
}
