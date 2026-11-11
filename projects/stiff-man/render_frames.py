"""Render script (local proofs + Kaggle GPU full render).
Usage: blender -b blend/StiffMan_v005.blend -P render_frames.py -- \
         OUT_DIR FSTART FEND SAMPLES RES_PCT
Sets Cycles, tries GPU (CUDA/OPTIX/HIP/METAL) then falls back to CPU,
denoise on, PNG sequence."""
import bpy, os, sys

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, FSTART, FEND, SAMPLES, RESP = argv[0], int(argv[1]), int(argv[2]), int(argv[3]), int(argv[4])
os.makedirs(OUT, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.015
scene.cycles.adaptive_min_samples = 32
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception:
    pass
scene.render.resolution_percentage = RESP
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.path.join(OUT, "frame_")
scene.frame_start, scene.frame_end = FSTART, FEND

# --- device selection: GPU if any, else CPU ---
device_set = "CPU"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for dtype in ("OPTIX", "CUDA", "HIP", "METAL"):
        try:
            prefs.compute_device_type = dtype
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == dtype]
            if gpus:
                for d in prefs.devices:
                    d.use = (d.type == dtype) or (d.type == "CPU")
                scene.cycles.device = "GPU"
                device_set = dtype
                break
        except Exception as e:
            print("device try failed:", dtype, e)
    if device_set == "CPU":
        scene.cycles.device = "CPU"
except Exception as e:
    print("GPU setup failed, CPU fallback:", e)
    scene.cycles.device = "CPU"

print(f"RENDER: device={device_set} frames {FSTART}-{FEND} samples={SAMPLES} res={RESP}% -> {OUT}")
bpy.ops.render.render(animation=True)
print("RENDER DONE")
