#!/usr/bin/env bash
# Headless check that a board clip keeps playing: a one-clip board (6 s, red and blue every 0.5 s)
# in a fresh fork-run home (welcome already seen), the clip clicked to play, and its colour sampled
# at +0.5, 1.5, 3 and 5 s. PASS when both colours appear at +3 s and later (it is still playing).
# Run with HERDR_APP_BIN set to the build; needs ffmpeg. Never shows a window.
#   HERDR_APP_BIN=<target>/debug/herdr-app scripts/test-board-video.sh
set -uo pipefail
cd "$(dirname "$0")/.."
: "${HERDR_APP_BIN:?set HERDR_APP_BIN}"
command -v ffmpeg >/dev/null || { echo "needs ffmpeg"; exit 2; }
T=$(mktemp -d); N=bvid$$
trap '[ -n "$KEEP_SHOT" ] && cp -R /tmp/hf-$N "$KEEP_SHOT/board-video-state" 2>/dev/null; HERDR_APP_BIN=$HERDR_APP_BIN sh scripts/fork-run.sh $N down >/dev/null 2>&1; rm -rf "$T" ~/.herdr-fork-home/$N /tmp/hf-$N' EXIT
mkdir -p "$T/clip.assets"
ffmpeg -loglevel error -y -f lavfi -i "color=c=red:s=320x240:r=30:d=0.5" -f lavfi -i "color=c=blue:s=320x240:r=30:d=0.5" \
  -filter_complex "[0][1]concat=n=2:v=1:a=0,loop=loop=11:size=30,format=yuv420p" -c:v libx264 -preset veryfast "$T/clip.assets/rb.mp4"
cat > "$T/clip.board" <<'JSON'
{"type":"excalidraw","version":2,"source":"herdr-board","elements":[{"id":"v1","type":"image","x":100,"y":100,"width":320,"height":240,"angle":0,"strokeColor":"transparent","backgroundColor":"transparent","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":0,"opacity":100,"groupIds":[],"frameId":null,"roundness":null,"seed":1,"version":1,"versionNonce":1,"isDeleted":false,"boundElements":null,"updated":1,"link":null,"locked":false,"status":"saved","fileId":"f1","scale":[1,1],"customData":{"kind":"video"}}],"appState":{"viewBackgroundColor":"#ffffff"},"files":{"f1":{"id":"f1","mimeType":"video/mp4","created":1,"path":"clip.assets/rb.mp4","name":"rb.mp4","kind":"video"}}}
JSON
export HERDR_APP_TEST_INPUT=1
R() { HERDR_APP_BIN=$HERDR_APP_BIN sh scripts/fork-run.sh $N "$@"; }
# A fresh home opens the welcome, and a later start "What's new", over the board. Start once (a
# first install records this version's notes as seen), then mark the welcome seen and start again.
R up >/dev/null || { echo "FAIL: up"; exit 1; }
R down >/dev/null
python3 - ~/.herdr-fork-home/$N/home/shared.json <<'PY'
import json, os, sys
p = sys.argv[1]
d = json.load(open(p)) if os.path.exists(p) else {}
d["frame.welcomed"] = True
json.dump(d, open(p, "w"))
PY
R up >/dev/null || { echo "FAIL: up"; exit 1; }
R do space.new >/dev/null
pane=$(R do tab.new --mod fork-board --props "{\"file\":\"$T/clip.board\"}" | grep -o '"pane": *"[^"]*' | cut -d'"' -f4)
# The first frame (the clip at rest) can take a few seconds to show: shoot until it does.
# locate SHOT: the clip box (red or blue, x0 y0 x1 y1) and the slot origin (sx sy) in device pixels.
locate() {
read -r x0 y0 x1 y1 sx sy <<<"$(python3 - "$1" <<'PY'
import sys, struct, zlib
def load(p):
    d=open(p,'rb').read(); i=8; z=b''
    while i<len(d):
        n=struct.unpack('>I',d[i:i+4])[0]; t=d[i+4:i+8]; c=d[i+8:i+8+n]; i+=12+n
        if t==b'IHDR': w,h=struct.unpack('>II',c[:8])
        elif t==b'IDAT': z+=c
    raw=zlib.decompress(z); s=w*4; rows=[]; prev=bytearray(s); k=0
    for _ in range(h):
        f=raw[k]; k+=1; ln=bytearray(raw[k:k+s]); k+=s
        for j in range(s):
            a=ln[j-4] if j>=4 else 0; b=prev[j]; c=prev[j-4] if j>=4 else 0
            if f==1: ln[j]=(ln[j]+a)&255
            elif f==2: ln[j]=(ln[j]+b)&255
            elif f==3: ln[j]=(ln[j]+((a+b)>>1))&255
            elif f==4:
                q=a+b-c; pa,pb,pc=abs(q-a),abs(q-b),abs(q-c); ln[j]=(ln[j]+(a if pa<=pb and pa<=pc else b if pb<=pc else c))&255
        rows.append(ln); prev=ln
    return w,h,rows
w,h,rows=load(sys.argv[1]); xs=[]; ys=[]
for y in range(0,h*85//100,4):  # above the toolbar (its swatches are red and blue too)
    for x in range(0,w,4):
        r,g,b=rows[y][x*4:x*4+3]
        if (r>200 and g<60 and b<60) or (b>200 and r<60 and g<60): xs.append(x); ys.append(y)
if len(xs)<=100:
    print(0,0,0,0,0,0); sys.exit()
x0,y0,x1,y1=min(xs),min(ys),max(xs),max(ys); cx,cy=(x0+x1)//2,(y0+y1)//2
# The focus border (blue) of the board pane bounds its slot: walk out from the clip to find it.
blue=lambda p: p[2]>170 and p[0]<130 and 60<p[1]<200
sx=next((x+1 for x in range(x0-3,0,-1) if blue(rows[cy][x*4:x*4+3])),0)
sy=next((y+1 for y in range(y0-3,0,-1) if blue(rows[y][cx*4:cx*4+3])),0)
print(x0,y0,x1,y1,sx,sy)
PY
)"
}
for try in 1 2 3 4 5 6; do sleep 2; rm -f "$T/s0.png"; R shot "$T/s0.png" >/dev/null; locate "$T/s0.png"; [ "$x1" -gt 0 ] && break; done
[ "$x1" -gt 0 ] || { cp "$T/s0.png" "${KEEP_SHOT:-/tmp}/board-video-s0.png" 2>/dev/null; echo "FAIL: the clip is not on screen (first shot kept at ${KEEP_SHOT:-/tmp}/board-video-s0.png)"; exit 1; }
cx=$(( (x0 + x1) / 2 )); cy=$(( (y0 + y1) / 2 ))
[ "$sx" -gt 0 ] && [ "$sy" -gt 0 ] || echo "note: no pane border found; clicking with the window origin"
# Shots are device pixels; mod.click takes points (SCALE device pixels each, 2 on Retina).
SCALE=${SCALE:-2}
# mod.click takes points from the slot top left (inside the focus border). A click on the clip
# selects it and shows its control bar; the play button at the left of that bar starts it.
click() { R do mod.click --copy "$pane" --x $(( ($1 - sx) / SCALE )) --y $(( ($2 - sy) / SCALE )) >/dev/null; }
click $cx $cy; sleep 1
rm -f "$T/s1.png"; R shot "$T/s1.png" >/dev/null; locate "$T/s1.png"
# The bar (dark, so outside the found box) sits just below it: its play button is 13 points in.
echo "selected box $x0,$y0-$x1,$y1"; cp "$T/s1.png" "${KEEP_SHOT:-/tmp}/board-video-s1.png"; click $(( x0 + 13 * SCALE )) $(( y1 + 14 * SCALE )); sleep 0.3; rm -f "$T/s2.png"; R shot "$T/s2.png" >/dev/null; cp "$T/s2.png" "${KEEP_SHOT:-/tmp}/board-video-s2.png"
# Sample a quarter of the way down the clip: its centre holds the play button while paused.
sy_=$(( y0 + (y1 - y0) / 4 ))
samples=""
for wait in 0.5 1 1.5 2; do sleep $wait; f="$T/s$RANDOM.png"; R shot "$f" >/dev/null
  c=$(python3 -c "
import sys,struct,zlib
d=open('$f','rb').read();i=8;z=b''
while i<len(d):
    n=struct.unpack('>I',d[i:i+4])[0];t=d[i+4:i+8];c=d[i+8:i+8+n];i+=12+n
    if t==b'IHDR': w,h=struct.unpack('>II',c[:8])
    elif t==b'IDAT': z+=c
raw=zlib.decompress(z);s=w*4;prev=bytearray(s);k=0
for y in range($sy_+1):
    f=raw[k];k+=1;ln=bytearray(raw[k:k+s]);k+=s
    for j in range(s):
        a=ln[j-4] if j>=4 else 0;b=prev[j];cc=prev[j-4] if j>=4 else 0
        if f==1: ln[j]=(ln[j]+a)&255
        elif f==2: ln[j]=(ln[j]+b)&255
        elif f==3: ln[j]=(ln[j]+((a+b)>>1))&255
        elif f==4:
            q=a+b-cc;pa,pb,pc=abs(q-a),abs(q-b),abs(q-cc);ln[j]=(ln[j]+(a if pa<=pb and pa<=pc else b if pb<=pc else cc))&255
    prev=ln
r,g,b=prev[$cx*4:$cx*4+3]
print('red' if r>200 and g<80 and b<80 else 'blue' if b>200 and r<80 and g<80 else 'other(%d,%d,%d)'%(r,g,b))")
  samples="$samples $c"; done
echo "colours at +0.5/1.5/3/5 s:$samples"
late=$(echo $samples | cut -d' ' -f3-)
case "$late" in *red*blue*|*blue*red*) echo "PASS: still playing at +3 s and +5 s";; *) cp "$f" "${KEEP_SHOT:-/tmp}/board-video-last.png" 2>/dev/null; echo "FAIL: stopped (or never started) (last shot kept at ${KEEP_SHOT:-/tmp}/board-video-last.png)"; exit 1;; esac
