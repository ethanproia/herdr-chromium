#!/usr/bin/env python3
"""Joins a browser block's frame trace (HERDR_BROWSER_TRACE=1) and says where the time goes.

  scripts/browser-trace.py <trace-host.log> <trace-app.log> [--gap-ms 33] [--from-ns N --to-ns N]

Both logs are stamped on CLOCK_UPTIME_RAW (ns), so one timeline covers CEF's paint callback, the
host's copy, the send, the app's arrival (after import), its draw and present, and the acks. For
every gap between presented frames longer than --gap-ms, it names the stage that was idle: no
CEF callback (Chromium produced nothing), a frame held for credit, in flight, or arrived but not
drawn or presented (the app). Headless runs have no real present: there "presented" is the
harness's pump, so the producer side is what such a run can judge.
"""
import argparse
import re
import statistics


def read(path):
    out = []
    for line in open(path, errors="replace"):
        parts = line.split(" ", 2)
        if len(parts) < 2 or not parts[0].isdigit():
            continue
        out.append((int(parts[0]), parts[1], parts[2].strip() if len(parts) > 2 else ""))
    return out


def seq_of(fields):
    m = re.search(r"seq=?(\d+)", fields)
    return int(m.group(1)) if m else None


def pct(v, p):
    if not v:
        return 0.0
    v = sorted(v)
    return v[min(len(v) - 1, round((len(v) - 1) * p))]


def summary(name, ms):
    if not ms:
        return f"{name}: none"
    return f"{name}: n={len(ms)} p50={pct(ms, .5):.1f} p95={pct(ms, .95):.1f} max={max(ms):.1f} ms"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("host")
    ap.add_argument("app")
    ap.add_argument("--gap-ms", type=float, default=33.0)
    ap.add_argument("--idle-ms", type=float, default=200.0, help="a callback gap this long splits active stretches")
    ap.add_argument("--from-ns", type=int, default=0)
    ap.add_argument("--to-ns", type=int, default=1 << 62)
    args = ap.parse_args()
    keep = lambda e: args.from_ns <= e[0] <= args.to_ns
    host = [e for e in read(args.host) if keep(e)]
    app = [e for e in read(args.app) if keep(e)]

    callbacks = [t for t, ev, f in host if ev == "callback" and "layer=page" in f]
    copies = [int(re.search(r"us=(\d+)", f).group(1)) / 1000 for t, ev, f in host if ev == "copied" and "us=" in f]
    held = sum(1 for t, ev, f in host if ev == "copied" and "out=held" in f)
    first = {}
    for t, ev, f in host + app:
        s = seq_of(f)
        if s is not None and ev in ("copied", "sent", "arrive", "drawn", "presented", "acked", "ack"):
            first.setdefault((ev, s), t)
    sent = sorted((t, s) for (ev, s), t in first.items() if ev == "sent")
    presented = sorted(t for (ev, s), t in first.items() if ev == "presented")
    ms = lambda d: d / 1e6

    def stage(x, y):
        return [ms(first[(y, s)] - first[(x, s)]) for (ev, s) in first if ev == x and (y, s) in first and first[(y, s)] >= first[(x, s)]]

    span = (max(e[0] for e in host + app) - min(e[0] for e in host + app)) / 1e9 if host and app else 0
    print(f"span {span:.1f} s")
    print(f"CEF page callbacks: {len(callbacks)} ({len(callbacks) / span:.1f}/s)" if span else "no events")
    # The span includes page load and idle before the input starts: the rate that matters is over
    # the longest stretch of callbacks with no gap of --idle-ms or more.
    runs, start = [], 0
    for i in range(1, len(callbacks) + 1):
        if i == len(callbacks) or ms(callbacks[i] - callbacks[i - 1]) >= args.idle_ms:
            runs.append((start, i - 1))
            start = i
    a, b = max(runs, key=lambda r: callbacks[r[1]] - callbacks[r[0]], default=(0, 0))
    if b > a:
        active = (callbacks[b] - callbacks[a]) / 1e9
        print(f"  active stretch: {b - a + 1} callbacks in {active:.2f} s ({(b - a) / active:.1f}/s)")
    print(summary("  interval between callbacks", [ms(q - p) for p, q in zip(callbacks, callbacks[1:])]))
    print(summary("  copy (incl. GPU wait)", copies) + f"; held for credit: {held}")
    print(f"frames sent {len(sent)} ({len(sent) / span:.1f}/s), presented {len(presented)} ({len(presented) / span:.1f}/s)" if span else "")
    for x, y, label in [("copied", "sent", "copied -> sent (credit wait)"), ("sent", "arrive", "sent -> arrived (IPC)"), ("arrive", "drawn", "arrived -> drawn"), ("drawn", "presented", "drawn -> presented"), ("presented", "acked", "presented -> ack sent"), ("acked", "ack", "ack sent -> host got it")]:
        print(summary("  " + label, stage(x, y)))
    gaps = [(p, q) for p, q in zip(presented, presented[1:]) if ms(q - p) > args.gap_ms]
    print(f"presented gaps over {args.gap_ms:.0f} ms: {len(gaps)}")
    # For each gap: when was the frame shown at its end captured, and how long did each stage take?
    # Blame the stage that took the most of the gap.
    pres_seq = sorted((t, s) for (ev, s), t in first.items() if ev == "presented")
    t2s = dict(pres_seq)
    cb_of = {}
    copied = sorted((t, s) for (ev, s), t in first.items() if ev == "copied")
    for t, s in copied:
        prior = [c for c in callbacks if c <= t]
        if prior:
            cb_of[s] = prior[-1]
    blame = {}
    pumps = [(t, f) for t, ev, f in host if ev == "pump"]
    for g0, g1 in gaps:
        s = t2s[g1]
        stages = {}
        if s in cb_of:
            stages["CEF capture late (producer)"] = cb_of[s] - g0
            stages["copy"] = first.get(("copied", s), cb_of[s]) - cb_of[s]
        stages["credit wait"] = first.get(("sent", s), 0) - first.get(("copied", s), 0) if ("sent", s) in first and ("copied", s) in first else 0
        stages["IPC/import"] = first[("arrive", s)] - first[("sent", s)] if ("arrive", s) in first and ("sent", s) in first else 0
        stages["app draw/present"] = g1 - first.get(("arrive", s), g1)
        why = max(stages, key=lambda k: stages[k])
        blame[why] = blame.get(why, 0) + 1
    for why, n in sorted(blame.items(), key=lambda x: -x[1]):
        print(f"  {n:4d}  {why}")
    if pumps:
        print(summary("slow pump passes (>8 ms)", [int(re.search(r'work_us=(\d+)', f).group(1)) / 1000 for t, f in pumps]))


if __name__ == "__main__":
    main()
