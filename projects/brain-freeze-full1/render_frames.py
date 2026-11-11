# render_frames.py — strided frame renderer for the full1 GitHub jobs.
# Job k renders frames f in 1..816 with (f-1) % N == k, so heavy anatomy
# frames spread evenly across all 24 jobs (contiguous chunks would
# strand the throat/brain-heavy ranges in a few jobs).
#   blender -b scene.blend -P render_frames.py -- <chunk> <njobs>
import bpy, os, sys, time

argv = sys.argv[sys.argv.index("--") + 1:]
K, N = int(argv[0]), int(argv[1])
sc = bpy.context.scene
outdir = os.path.join(os.getcwd(), "frames")
os.makedirs(outdir, exist_ok=True)
sc.render.filepath = os.path.join(outdir, "f_")
t0 = time.time()
mine = [f for f in range(1, 817) if (f - 1) % N == K]
for i, f in enumerate(mine):
    sc.frame_set(f)
    bpy.ops.render.render(write_still=True)
    print("STRIDED %d/%d frame %d done (%.0fs elapsed)"
          % (i + 1, len(mine), f, time.time() - t0), flush=True)
print("STRIDED_DONE chunk %d: %d frames in %.0fs"
      % (K, len(mine), time.time() - t0))
