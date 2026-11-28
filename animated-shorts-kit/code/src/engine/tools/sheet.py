#!/usr/bin/env python3
"""ENGINE tool: watch a whole render without watching it in real time.
usage: python3 sheet.py <video.mp4> <outdir> [every=0.5]
 -> outdir/sheet_NN.jpg  contact sheets (5x4 thumbnails, one every `every` s, timestamp burned in)
 -> outdir/motion.txt    frame-to-frame change per 1/10 s: CUT (hard change), POP (sudden local change = something
                         appears / jumps inside a take), FREEZE (> 1 s with no motion)"""
import sys, os, subprocess, numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]; every = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
os.makedirs(out, exist_ok=True)
def frames(fps, w):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'fps={fps},scale={w}:-2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    h = None
    while True:
        if h is None:
            info = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]).decode().split(',')
            h = int(round(int(info[1]) * w / int(info[0]) / 2) * 2)
        b = p.stdout.read(w * h * 3)
        if len(b) < w * h * 3: break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)
th = list(frames(1 / every, 180)); n = 20
for s in range(0, len(th), n):
    chunk = th[s:s + n]; h, w = chunk[0].shape[:2]; im = Image.new('RGB', (5 * w, 4 * h), 'black'); d = ImageDraw.Draw(im)
    for k, f in enumerate(chunk):
        x, y = (k % 5) * w, (k // 5) * h; im.paste(Image.fromarray(f), (x, y)); d.rectangle([x, y, x + 46, y + 14], fill='black'); d.text((x + 2, y + 1), f'{(s + k) * every:.1f}s', fill='yellow')
    im.save(f'{out}/sheet_{s // n:02d}.jpg', quality=85)
mv = [f.astype(np.int16) for f in frames(30, 72)]
g = np.array([0.0] + [np.abs(mv[i] - mv[i - 1]).mean() for i in range(1, len(mv))])
loc = np.array([0.0] + [(np.abs(mv[i] - mv[i - 1]).mean(axis=2) > 50).mean() for i in range(1, len(mv))])
lines, still = [], 0
for i in range(2, len(g) - 2):
    nb = np.median(np.r_[g[max(1, i - 4):i], g[i + 1:i + 5]]); nl = np.median(np.r_[loc[max(1, i - 4):i], loc[i + 1:i + 5]])
    t = i / 30
    if g[i] > 18 and g[i] > 3 * nb + 4: lines.append(f'{t:6.2f}s CUT    change {g[i]:.0f} (around {nb:.0f})')
    elif loc[i] > 0.01 and loc[i] > 4 * nl + 0.006 and g[i] < 3 * nb + 4: lines.append(f'{t:6.2f}s POP    {loc[i] * 100:.1f}% of the frame jumped in one frame')
    still = still + 1 if g[i] < 0.3 else 0
    if still == 30: lines.append(f'{t - 1:6.2f}s FREEZE no motion for 1 s')
open(f'{out}/motion.txt', 'w').write('\n'.join(lines) + '\n'); print(len(th), 'thumbs,', len(lines), 'motion notes ->', out)
