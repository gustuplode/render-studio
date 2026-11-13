"""Render a strided subset of frames from the packed train-stop blend.

Usage inside the Actions job:
  blender -b scene.blend -noaudio --python render_frames.py -- START STRIDE OUTDIR
Renders frames START, START+STRIDE, ... up to scene end at the scene's own
resolution (1080x1920) and Cycles settings baked into the blend (32 samples).
"""
import bpy
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
start, stride, outdir = int(argv[0]), int(argv[1]), argv[2]
os.makedirs(outdir, exist_ok=True)

scene = bpy.context.scene
scene.render.resolution_x = 1080
scene.render.resolution_y = 1920
scene.cycles.samples = 32
scene.render.image_settings.file_format = 'PNG'

for f in range(start, scene.frame_end + 1, stride):
    scene.frame_set(f)
    scene.render.filepath = os.path.join(outdir, 'f_%04d.png' % f)
    bpy.ops.render.render(write_still=True)
    print('RENDERED', f, flush=True)
print('CHUNK_DONE', start, stride)
