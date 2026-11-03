// Host grouping, pure (no host imports; `node spaces-browser/test-hosts.mjs`). Display only: hosts come from
// `hc machine ls --json` (field `host`). Hosts with 2+ machines get one heading with each machine a sub-row.

// "studio" (name equals its host) is the signed-in user's own core: "ethan". Else strip a "<host>-" prefix.
export const labelOf = (name, host) => (name === host ? "ethan" : name.startsWith(`${host}-`) ? name.slice(host.length + 1) : name);

// remote: machine names (no local); machines: [{name, host}]. Returns
//   shared: { host: [names, the host's own machine first then by name] } for hosts with 2+ machines (none while collapsed)
//   order: [null, name | "host:<h>", ...] where a host heading is followed by its machines, placed at the first member's spot
export function groupByHost(remote, machines, collapsed = false) {
  const hostOf = new Map(machines.map((k) => [k.name, k.host]));
  const byHost = {};
  for (const n of remote) { const h = hostOf.get(n); if (h) (byHost[h] ??= []).push(n); }
  const shared = collapsed ? {} : Object.fromEntries(Object.entries(byHost).filter(([, v]) => v.length > 1)
    .map(([h, v]) => [h, [...v].sort((a, b) => (b === h) - (a === h) || a.localeCompare(b))]));
  const sharedHost = (n) => { const h = hostOf.get(n); return h && shared[h] ? h : null; };
  const order = [null];
  for (const n of remote) {
    const h = sharedHost(n);
    if (!h) order.push(n);
    else if (!order.includes(`host:${h}`)) order.push(`host:${h}`, ...shared[h]);
  }
  return { shared, sharedHost, order };
}
