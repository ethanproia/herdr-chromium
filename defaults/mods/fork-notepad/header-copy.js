// Copy contents from the folded header ••• menu.
// `item` calls this with the click context. The menu render has no cx of its own, and a note
// copy flushes first by waiting on cx.sleep. Building that wait from the argument is what
// keeps the flush off a free `cx` (a ReferenceError the menu's pending.catch would hide).
// The promise always settles: a failure notifies "Couldn't copy" instead of rejecting.

import { applyCopy } from "./copy-clip.js";

export function headerMenuCopyAction(spec, deps) {
  return (cx) => {
    const io = {
      hc: deps.hc,
      exec: deps.exec,
      writeTextFile: deps.writeTextFile,
      appHome: deps.appHome,
      shared: deps.shared,
      setShared: deps.setShared,
      run: deps.run,
      sleep: (ms) => cx.sleep(ms),
      stamp: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    };
    return applyCopy(spec, io).then((r) => deps.notify({
      title: r.code === 0 ? "Copied" : "Couldn't copy",
      body: r.code === 0 ? undefined : (r.stderr || "").trim().slice(0, 200),
      timeout: 1500,
    })).catch((e) => deps.notify({
      title: "Couldn't copy",
      body: String(e?.message || e).slice(0, 200),
      level: "error",
      timeout: 3000,
    }));
  };
}
