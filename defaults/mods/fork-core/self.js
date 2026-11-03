// This folder's own name, found from where the code runs, so a renamed folder (the fork's `fork-core`) keeps working.
// Every asset path is `mods/${SELF}/...` and every popup of core itself is `{ mod: SELF }`.
export const SELF = (/\/mods\/([^/]+)\/[^/]+\.js/.exec(new Error().stack || "") || /\/([^/]+)\/(?:roles\/)?[^/]+\.js/.exec(new Error().stack || ""))?.[1] ?? "fork-core";
export const asset = (path) => `mods/${SELF}/${path}`;
export const icon = (name) => `mods/${SELF}/icons/${name}.svg`;
