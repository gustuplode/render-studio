"""Stage 5 - ANIMATE:
- Door opens BY ITSELF: hinge rotation f150 -> f270 (slow, creepy), holds.
- Hallway cold light fades up as the door opens.
- Stiff Man: whole-body stiff glide 18 cm into the room + tiny sway.
  He NEVER bends - every part moves identically, legs stay straight.
- Kid: subtle breathing (torso scale) during beat 1.
Saves blend/StiffMan_v005.blend (final build)"""
import bpy, os

PROJ = os.environ.get("STIFF_PROJ", os.path.expanduser("~/workspace/stiff-man-demo"))
O = bpy.data.objects

# ---- door ----
hinge = O["Prop_Door_Hinge"]
hinge.rotation_euler = (0, 0, 0)
hinge.keyframe_insert("rotation_euler", frame=1)
hinge.keyframe_insert("rotation_euler", frame=150)
hinge.rotation_euler = (0, 0, -1.85)
hinge.keyframe_insert("rotation_euler", frame=270)
hinge.keyframe_insert("rotation_euler", frame=480)

# ---- hallway light energy ----
hall = O["Light_HallCold"].data
hall.energy = 0.0
hall.keyframe_insert("energy", frame=1)
hall.keyframe_insert("energy", frame=150)
hall.energy = 190.0
hall.keyframe_insert("energy", frame=270)
hall.keyframe_insert("energy", frame=480)

# ---- doorway glow energy (same ramp as the hall spot) ----
dglow = O["Light_DoorGlow"].data
dglow.energy = 0.0
dglow.keyframe_insert("energy", frame=1)
dglow.keyframe_insert("energy", frame=150)
dglow.energy = 15.0
dglow.keyframe_insert("energy", frame=270)
dglow.keyframe_insert("energy", frame=480)

# ---- stiff man: rigid whole-body drift (no bending, ever) ----
STIFF_PARTS = ["Stiff_LegL", "Stiff_LegR", "Stiff_ShoeL", "Stiff_ShoeR",
               "Hero_StiffMan_Torso", "Stiff_Shoulders", "Stiff_ArmL",
               "Stiff_ArmR", "Stiff_HandL", "Stiff_HandR", "Stiff_Neck",
               "Hero_StiffMan_Head", "Stiff_Eye1", "Stiff_Eye2", "Stiff_Mouth"]
for name in STIFF_PARTS:
    o = O[name]
    base = o.location.copy()
    o.keyframe_insert("location", frame=1)
    o.keyframe_insert("location", frame=312)
    o.location = (base.x + 0.006, base.y - 0.09, base.z)
    o.keyframe_insert("location", frame=396)
    o.location = (base.x - 0.004, base.y - 0.18, base.z)
    o.keyframe_insert("location", frame=480)
    o.location = base

# ---- kid breathing, beat 1 only ----
torso = O["Hero_Kid_Torso"]
for f, s in ((1, 1.0), (36, 1.06), (72, 1.0), (108, 1.06), (144, 1.0)):
    torso.scale = (1.0, 1.0, s)
    torso.keyframe_insert("scale", frame=f)
torso.scale = (1.0, 1.0, 1.0)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROJ, "blend", "StiffMan_v005.blend"))
print("STAGE5 OK - animation saved")
