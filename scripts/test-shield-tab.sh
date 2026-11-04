#!/usr/bin/env bash
# The S29 shield shows in a browser opened as a TAB (the + menu's Browser, `browser.new`),
# not only in a layout block: a headless fork window on a fresh home, light appearance (as
# Ethan's session), a window shot before and after opening the tab; the shield's gray
# (SHIELD_OFF in src/browser/view.rs) appears once the tab is there.
# Run with HERDR_APP_BIN (the app) and HERDR_BROWSER_HOST (a host: the stub is enough).
#   scripts/test-shield-tab.sh
set -uo pipefail
cd "$(dirname "$0")/.."
: "${HERDR_APP_BIN:?set HERDR_APP_BIN}"
fails=0
ok() { echo "ok   $*"; }
bad() { echo "FAIL $*"; fails=$((fails + 1)); }
n=tst$$ root=$HOME/.herdr-fork-home/tst$$
mkdir -p "$root/home"
printf '{"frame.welcomed":"skipped"}\n' > "$root/home/shared.json"
printf '{ "last_run": "999.0.0" }\n' > "$root/home/update-notes.json"
printf '{ "appearance": "light" }\n' > "$root/home/settings.json"
R() { scripts/fork-run.sh $n "$@"; }
shots=$(mktemp -d)
# Shield-gray pixels in a PNG (RGBA or RGB, 8-bit, non-interlaced), standard library only.
gray() {
  python3 - "$1" <<'PY'
import struct, sys, zlib
data = open(sys.argv[1], "rb").read()
pos, chunks, w = 8, [], 0
while pos < len(data):
    n, kind = struct.unpack(">I4s", data[pos:pos + 8])
    body = data[pos + 8:pos + 8 + n]
    if kind == b"IHDR":
        w, h, depth, ctype = struct.unpack(">IIBB", body[:10])
    elif kind == b"IDAT":
        chunks.append(body)
    pos += 12 + n
bpp = 4 if ctype == 6 else 3
raw, stride, prev, count = zlib.decompress(b"".join(chunks)), w * bpp, bytearray(w * bpp), 0
for y in range(h):
    f, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
    for i in range(stride):
        a = line[i - bpp] if i >= bpp else 0
        b, c = prev[i], prev[i - bpp] if i >= bpp else 0
        if f == 1: line[i] = (line[i] + a) & 255
        elif f == 2: line[i] = (line[i] + b) & 255
        elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
        elif f == 4:
            p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
            line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
    for x in range(0, stride, bpp):
        if abs(line[x] - 0x8e) <= 6 and abs(line[x + 1] - 0x8e) <= 6 and abs(line[x + 2] - 0x93) <= 6:
            count += 1
    prev = line
print(count)
PY
}
R up >/dev/null || bad "start $n"
R do space.new '{"name":"shield"}' >/dev/null || bad "space.new"
sleep 2
R shot "$shots/before.png" >/dev/null && before=$(gray "$shots/before.png") || bad "shot before"
r=$(R do browser.new '{"url":"about:blank"}')
[[ $r != *error* ]] && ok "browser.new opened a tab ($r)" || bad "browser.new: $r"
sleep 3
R shot "$shots/after.png" >/dev/null && after=$(gray "$shots/after.png") || bad "shot after"
[[ $(( ${after:-0} - ${before:-0} )) -gt 30 ]] && ok "the tab's bar shows the shield (+$(( after - before )) shield-gray pixels, light appearance)" || bad "no shield in the tab: before ${before:-?}, after ${after:-?} (shots in $shots)"
R down >/dev/null
[[ $fails == 0 ]] && rm -rf "$shots" "$root"
echo "failures: $fails"
exit $((fails > 0))
