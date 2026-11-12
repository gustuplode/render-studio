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
# The output path is set PER FRAME inside the loop with the number baked
# in (f_0001.png, f_0273.png, ...). Two failure modes proved this is the
# only safe way with bpy.ops.render.render(write_still=True):
#  - a placeholder-less path ("f_") overwrites the SAME file every frame —
#    run #1 collapsed 816 frames into 24 single files and the finish job
#    found only 1 merged frame;
#  - a "f_####" path is NOT expanded by write_still (local proof run saved
#    a literal "f_####.png", overwritten per frame) — #### expansion only
#    happens for animation renders (CLI -a, as in the demo2 workflow).
t0 = time.time()
mine = [f for f in range(1, 817) if (f - 1) % N == K]
for i, f in enumerate(mine):
    sc.frame_set(f)
    sc.render.filepath = os.path.join(outdir, "f_%04d" % f)
    bpy.ops.render.render(write_still=True)
    print("STRIDED %d/%d frame %d done (%.0fs elapsed)"
          % (i + 1, len(mine), f, time.time() - t0), flush=True)
print("STRIDED_DONE chunk %d: %d frames in %.0fs"
      % (K, len(mine), time.time() - t0))
# Self-check: every frame in `mine` must exist as its OWN PNG. If a naming
# regression ever collapses the output again, fail the job loudly here
# instead of uploading a near-empty artifact for the finish job to choke on.
pngs = sorted(fn for fn in os.listdir(outdir) if fn.endswith(".png"))
print("SELF_CHECK chunk %d: expected %d PNGs, found %d"
      % (K, len(mine), len(pngs)), flush=True)
if len(pngs) != len(mine):
    print("SELF_CHECK FAIL chunk %d: %s" % (K, pngs), flush=True)
    os._exit(1)
