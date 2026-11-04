// The notification calls, feature-detected. Stock Herdr has no notifications, markRead, clearNotifications
// or setNotificationMute export: a named import of a missing export fails the whole module, so this file reads them off
// the namespace and every caller gets null / a no-op on stock (the bell does not render, nothing throws).
import * as herdr from "herdr";
import { normalizeSnapshot } from "./inbox-pure.js";

export const hasInbox = () => typeof herdr.notifications === "function";

// The cleaned snapshot, or null without the API. Read in render: the host re-renders on change.
export function inboxSnapshot() {
  if (!hasInbox()) return null;
  try { return normalizeSnapshot(herdr.notifications()); } catch { return null; }
}

export function markRead(target) {
  if (typeof herdr.markRead === "function") try { herdr.markRead(target); } catch { /* gone: nothing to mark */ }
}

export function clearNotifications(target) {
  if (typeof herdr.clearNotifications === "function") try { herdr.clearNotifications(target); } catch { /* gone */ }
}

export function setDnd(on) {
  if (typeof herdr.setNotificationMute === "function") try { herdr.setNotificationMute({ dnd: on === true }); } catch { /* no permission */ }
}
