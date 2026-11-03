// Data side of @ mentions: gathers dates, chats, tabs and files, and opens a clicked link.
import { agents, terminals, spaces, panes, focused, exec, run, home } from "herdr";
import { parseHref } from "./mentions-core.js";
import { openableUrl } from "./rows.js";
import { dateItems } from "./dates.js";   // Notion's date rows: Today, Now, Tomorrow, Yesterday

export const KIND_ICON = { date: "📅", agent: "💬", tab: "▤", file: "📄" };

const FILE_CAP = 5000;
const SKIP = ["node_modules", ".git"];
const base = (p) => p.slice(p.lastIndexOf("/") + 1);

function chats() {
  try {
    let names = {};
    try { for (const t of terminals()) if (t.name) names[t.address] = t.name; } catch { /* names are optional */ }
    return agents().filter((a) => !a.address.includes("/")).map((a) => {
      const label = names[a.address] || a.tab_name || a.title || a.address;
      return { kind: "agent", label, hint: a.space_name, href: "herdr:agent/" + a.address, text: label, terminal: a.address };
    });
  } catch { return []; }
}

function tabs() {
  try {
    const out = [];
    for (const s of spaces()) {
      if (s.machine) continue;
      for (const t of s.tabs) {
        const label = `${s.name} › ${t.name}`;
        out.push({ kind: "tab", label, hint: "", href: "herdr:tab/" + t.id, text: label, space: s.id });
      }
    }
    return out;
  } catch { return []; }
}

// The focused terminal's folder: this machine only.
function focusedCwd() {
  try {
    const f = focused();
    if (!f) return null;
    const sp = spaces().find((s) => s.id === f.space);
    if (sp && sp.machine) return null;
    if (f.cwd) return f.cwd;
    const p = panes().find((x) => x.pane === f.pane);
    return (p && p.cwd) || (sp && sp.folder) || null;
  } catch { return null; }
}

async function files() {
  try {
    const cwd = focusedCwd();
    if (!cwd) return [];
    let root = cwd, rels = null;
    const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd }).catch(() => null);
    if (top && top.code === 0 && top.stdout.trim()) {
      root = top.stdout.trim();
      const r = await exec("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root });
      if (r.code === 0) rels = r.stdout.split("\n").filter(Boolean);
    }
    // No project: a home or root folder would list thousands of unrelated files, so offer none.
    if (!rels && (root === home() || root === "/")) return [];
    if (!rels) {
      const args = [".", "-maxdepth", "4", ...SKIP.flatMap((n) => ["-name", n, "-prune", "-o"]), "-type", "f", "-print"];
      const r = await exec("find", args, { cwd: root });
      rels = r.stdout.split("\n").filter(Boolean).map((p) => p.replace(/^\.\//, ""));
    }
    return rels.slice(0, FILE_CAP).map((rel) => ({
      kind: "file", label: base(rel), hint: rel, href: root.replace(/\/$/, "") + "/" + rel, text: base(rel),
    }));
  } catch { return []; }
}

export async function loadItems() {
  let f = [];
  try { f = await files(); } catch { f = []; }
  return [...dateItems(new Date()), ...chats(), ...tabs(), ...f];
}

export function openHref(href, _cx) {
  try {
    const h = parseHref(href);
    if (h.kind === "agent") run("agent.focus", { terminal: h.id });
    else if (h.kind === "tab") {
      const sp = spaces().find((s) => s.tabs.some((t) => t.id === h.id));
      if (sp) run("space.select", { id: sp.id });
      run("tab.select", { id: h.id });
    } else if (h.kind === "file") run("pane.split", { direction: "right", mod: "fork-notepad-view", props: { view: h.path } });
    // Only web and mail links open (note text can come from agents). Other schemes do nothing.
    else if (h.kind === "url") { const url = openableUrl(h.id); if (url) exec("open", [url]).catch(() => {}); }
  } catch { /* a stale link does nothing */ }
}
