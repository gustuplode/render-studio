"""Build runner: execs stage1..stage5 in one Blender session, in order."""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
for stage in ("stage1_setup", "stage2_model", "stage3_light",
              "stage4_camera", "stage5_animate"):
    path = os.path.join(HERE, stage + ".py")
    print(f"===== RUNNING {stage} =====")
    with open(path) as f:
        exec(compile(f.read(), path, "exec"), {"__file__": path})
print("BUILD ALL OK")
