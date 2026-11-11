"""Stage 1 - SETUP: fresh scene, units, 1080x1920 @24fps, frames 1-480,
AgX, dark night world, standard collections. Saves blend/StiffMan_v001.blend"""
import bpy, os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import common

PROJ = os.environ.get("STIFF_PROJ", os.path.expanduser("~/workspace/stiff-man-demo"))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "StiffMan_Night"

# Units: metric, 1 unit = 1 m
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0

# Vertical short, cinematic fps, 20 s = 480 frames
scene.render.resolution_x, scene.render.resolution_y = 1080, 1920
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 480

# Cycles (EEVEE has no libEGL on this VM); device chosen in render script
scene.render.engine = "CYCLES"
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
try:
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception:
    pass

# AgX view transform (4.x), medium-high contrast look
for vt in ("AgX", "Filmic"):
    try:
        scene.view_settings.view_transform = vt
        break
    except TypeError:
        continue
try:
    scene.view_settings.look = "Medium High Contrast"
except Exception:
    pass

# Very dark blue night world
world = bpy.data.worlds.new("Night_World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.004, 0.008, 0.02, 1.0)
bg.inputs["Strength"].default_value = 0.5

common.make_collections(scene)

os.makedirs(os.path.join(PROJ, "blend"), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROJ, "blend", "StiffMan_v001.blend"))
print("STAGE1 OK - setup saved")
