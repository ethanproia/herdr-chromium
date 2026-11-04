// Pin migration for addresses stored before labels existed.
// A live terminal is pinned until `herdr.pinned` shows up. A dropped command is
// retried a few times, then dropped: retrying forever sends terminal.pin on every
// interval for a terminal that will never take the label. An offline terminal is
// kept and is not counted as an attempt, so a failed write does not erase it
// before the terminal comes back.

export const PIN_RETRY_MS = 5000;
export const PIN_ATTEMPT_MAX = 3;

export function nextPinMigration(pending, terminals, attempts, now) {
  const listed = new Map();
  for (const t of Array.isArray(terminals) ? terminals : []) {
    if (t && t.state === "live" && typeof t.address === "string" && t.address) listed.set(t.address, t);
  }
  const next = new Map(attempts instanceof Map ? attempts : []);
  const commands = [];
  const gaveUp = [];
  const keep = [];
  for (const address of Array.isArray(pending) ? pending : []) {
    const terminal = listed.get(address);
    if (!terminal) { keep.push(address); continue; }
    if (terminal.labels?.["herdr.pinned"]) { next.delete(address); continue; }
    const prev = next.get(address) ?? { at: 0, n: 0 };
    if (prev.n >= PIN_ATTEMPT_MAX) {
      if (now - prev.at > PIN_RETRY_MS) { next.delete(address); gaveUp.push(address); continue; }
      keep.push(address);
      continue;
    }
    if (now - prev.at > PIN_RETRY_MS) {
      next.set(address, { at: now, n: prev.n + 1 });
      commands.push(address);
    }
    keep.push(address);
  }
  return { pending: keep, attempts: next, commands, gaveUp };
}
