import bpy, os, sys, time
argv = sys.argv[sys.argv.index("--") + 1:]
K, N = int(argv[0]), int(argv[1])
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.cycles.samples = 48
outdir = os.path.join(os.getcwd(), "frames")
os.makedirs(outdir, exist_ok=True)
t0 = time.time()
mine = [f for f in range(1, 151) if (f - 1) % N == K]
for i, f in enumerate(mine):
    sc.frame_set(f)
    sc.render.filepath = os.path.join(outdir, "f_%04d" % f)
    bpy.ops.render.render(write_still=True)
    print("STRIDED %d/%d frame %d done (%.0fs elapsed)" % (i + 1, len(mine), f, time.time() - t0), flush=True)
print("STRIDED_DONE chunk %d: %d frames in %.0fs" % (K, len(mine), time.time() - t0))
pngs = sorted(fn for fn in os.listdir(outdir) if fn.endswith(".png"))
print("SELF_CHECK chunk %d: expected %d PNGs, found %d" % (K, len(mine), len(pngs)), flush=True)
if len(pngs) != len(mine):
    print("SELF_CHECK FAIL chunk %d: %s" % (K, pngs), flush=True)
    os._exit(1)
