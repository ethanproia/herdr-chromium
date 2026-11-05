// Cached git for the spaces list: answers, stamps, queued looks, and local repo watches.
// Pure (no herdr imports), so node can test it.
//
// `keys` are the places a space lives in right now. A place that has left that set is gone,
// and its cache goes with it, except when it sits on a remote machine that is still listed
// and whose layout is not "ready". That machine's spaces are absent from the list while it
// reconnects; the branch already shown stays until the machine is ready and the place is
// still missing. A machine that has left the list (removed or renamed) is gone too: a missing
// entry is not the same as a layout that has not become "ready".
// This computer's own places are always complete, so a local place that left the list is gone.
//
// Watches cover local repos only. They drop once every live local place has an answer
// (an entry in `git`, including "not a repo") and no remaining local answer names that repo.
// A place still waiting on its first look can sit inside a watched repo.

export function pruneGitState({ keys, git, checked, unsure, pending, watching, machines }) {
  const keep = (k) => {
    if (keys.has(k)) return true;
    const on = JSON.parse(k)[0];
    if (!on) return false;
    const machine = machines.find((m) => m.name === on);
    return !!machine && machine.layout !== "ready";
  };
  const pick = (obj) => {
    const next = {};
    for (const k of Object.keys(obj)) if (keep(k)) next[k] = obj[k];
    return next;
  };
  const pickSet = (set) => {
    const next = new Set();
    for (const k of set) if (keep(k)) next.add(k);
    return next;
  };
  const nextGit = pick(git);
  let nextWatching = watching;
  // Same test the list used before this was extracted: a local place with no answer yet.
  if (![...keys].some((k) => !JSON.parse(k)[0] && !(k in nextGit))) {
    const used = new Set(Object.values(nextGit).filter(Boolean).map((g) => JSON.parse(g.repo)).filter(([on]) => !on).map(([, repo]) => repo));
    nextWatching = new Map();
    for (const [repo, tag] of watching) if (used.has(repo)) nextWatching.set(repo, tag);
  }
  return { git: nextGit, checked: pick(checked), unsure: pickSet(unsure), pending: pickSet(pending), watching: nextWatching };
}
