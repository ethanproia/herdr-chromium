// The agent tools are not a trust source: a forged open can't claim someone else's tab, and an MCP
// call's operation comes from its tool name only. Run: node --test scripts/herdr-browser/trust.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import register, { origin } from "./agent.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("open records only the id the app made, never the asked-for one", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hb-trust-"));
  const victim = { id: "persons-tab", state: {}, send() {} };
  const sessions = new Map([["persons-tab", Promise.resolve(victim)]]);
  let handler;
  register({
    sessions, dir, onEvent() {}, onOpen() {}, targets: async () => [],
    route: (_m, _p, h) => (handler = h),
    openTab: async () => ({ id: "agent-made-1", state: {}, send() {} }),
    closeTab: async () => {},
  });
  const call = (body) => new Promise((done) => {
    const res = { statusCode: 200, setHeader() {}, end: (t) => done({ status: res.statusCode, ...JSON.parse(t) }) };
    handler({}, res, JSON.stringify(body));
  });
  const opened = await call({ cmd: "open", tab: "persons-tab" });
  assert.equal(opened.tab, "agent-made-1");
  const r = await call({ cmd: "text", tab: "persons-tab" });
  assert.equal(r.ok, false);
  assert.match(r.error, /not agent-controllable/);
});

function mcpCall(name, args) {
  return new Promise((done, fail) => {
    const home = mkdtempSync(join(tmpdir(), "hb-mcp-"));
    const p = spawn(process.execPath, [join(here, "bin/herdr-browser"), "mcp"], { env: { ...process.env, HERDR_APP_HOME: home, HERDR_BROWSER_DIR: join(home, "browser") } });
    let out = "";
    p.stdout.on("data", (d) => {
      out += d;
      const line = out.split("\n").find((l) => l.includes('"id":1'));
      if (line) { p.kill(); done(JSON.parse(line).result); }
    });
    p.on("error", fail);
    p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) + "\n");
  });
}

test("an MCP argument can't change the operation or smuggle other fields", async () => {
  for (const [name, args, want] of [
    ["browser_snapshot", { cmd: "close" }, /takes no argument cmd/],
    ["browser_snapshot", { expression: "document.cookie" }, /takes no argument expression/],
    ["browser_navigate", { url: 5 }, /url must be string/],
    ["browser_navigate", {}, /needs url/],
    ["browser_nope", {}, /no tool browser_nope/],
  ]) {
    const r = await mcpCall(name, args);
    assert.equal(r.isError, true, name);
    assert.match(r.content[0].text, want, `${name} ${JSON.stringify(args)}`);
  }
});

test("the person's tabs are listed by origin only: no path, query, fragment or file path", () => {
  assert.equal(origin("https://bank.example/acct/42?token=abc#frag"), "https://bank.example");
  assert.equal(origin("file:///Users/x/secret.html"), "file:");
  assert.equal(origin("not a url"), "");
});
