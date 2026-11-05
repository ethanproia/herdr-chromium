// A space drag, resolved at release by ids in the current list. Pure (no herdr imports), so node
// can test it. `from` is what the press stored ({ id, machine }); `toId` is the space released on.
// Same space, or no press: select it. Either space gone, the source's machine changed mid-drag, or
// the two sit on different machines (a machine's spaces belong to its own order): nothing.
// Otherwise move `from` to `to`'s current 1-based place.
export function spaceDropPlan(from, toId, list) {
  if (!from || from.id === toId) return { name: "space.select", args: { id: toId } };
  const sp = Array.isArray(list) ? list : [];
  const src = sp.find((s) => s.id === from.id);
  const to = sp.find((s) => s.id === toId);
  if (!src || !to) return null;
  const on = (s) => s?.machine ?? null;
  if (on(src) !== on(from) || on(to) !== on(src)) return null;
  return { name: "space.move", args: { id: from.id, index: sp.indexOf(to) + 1 } };
}
