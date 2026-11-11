"""Stage 4 - CAMERA: one camera + Track-To target empty, DOF on.
Camera path is keyframed here (positions); the target is keyframed here too.
One continuous shot, no cuts - moves follow the narration beats:
  f1-144   push-in on the kid under the bed
  f144-312 glide across the room to the doorway
  f312-480 low-angle slow push-in on the Stiff Man
Saves blend/StiffMan_v004.blend"""
import bpy, os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import common
from common import COLS, empty

PROJ = os.environ.get("STIFF_PROJ", os.path.expanduser("~/workspace/stiff-man-demo"))
scene = bpy.context.scene

cam_data = bpy.data.cameras.new("Cam_Main")
cam_data.lens = 32.0
cam_data.sensor_width = 36.0
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("Cam_Main", cam_data)
scene.collection.objects.link(cam)
for c in list(cam.users_collection):
    c.objects.unlink(cam)
COLS["CAM"].objects.link(cam)
scene.camera = cam

target = empty("Cam_Target", (-1.45, 0.15, 0.30), "CAM")
target.hide_render = True
cam_data.dof.focus_object = target

con = cam.constraints.new("TRACK_TO")
con.target = target
con.track_axis = "TRACK_NEGATIVE_Z"
con.up_axis = "UP_Y"

CAM_KEYS = [  # (frame, location)
    (1,   (1.85, -1.85, 1.12)),
    (96,  (1.15, -1.45, 0.92)),
    (144, (0.55, -1.05, 0.78)),
    (216, (0.05, -0.35, 0.95)),
    (312, (-0.25, 0.35, 1.00)),
    (384, (0.15, 0.75, 0.62)),
    (480, (0.72, 1.18, 0.55)),
]
TGT_KEYS = [  # (frame, location)
    (1,   (-1.45, 0.15, 0.30)),
    (96,  (-1.50, 0.15, 0.28)),
    (144, (-1.50, 0.20, 0.26)),
    (216, (1.35, 1.90, 1.25)),
    (312, (1.40, 2.00, 1.30)),
    (384, (1.40, 2.00, 1.32)),
    (480, (1.40, 2.00, 1.30)),
]
for f, loc in CAM_KEYS:
    cam.location = loc
    cam.keyframe_insert("location", frame=f)
for f, loc in TGT_KEYS:
    target.location = loc
    target.keyframe_insert("location", frame=f)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROJ, "blend", "StiffMan_v004.blend"))
print("STAGE4 OK - camera saved")
