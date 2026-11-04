// Same encoder as notepad/mentions-core.js encodeLink.
// Copied into this mod: Herdr loads each mod from ~/.config/herdr-app/mods/<name>,
// and an import that climbs out of that folder does not resolve there.
// test-mentions.mjs checks this stays in step with the Notepad copy.

export function encodeLink(item) {
  const text = String(item.text).replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\)/g, "\\)");
  // CommonMark: a destination with spaces or parentheses goes in <...>.
  const href = /[\s()<>]/.test(item.href) ? `<${item.href}>` : item.href;
  return `[${text}](${href})`;
}
