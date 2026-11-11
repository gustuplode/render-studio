"""Stage 3 - LIGHT/STUDIO (night): moonlight spot through the window,
faint cool fill, dim warm practical, cold hallway light behind the door
(animated in stage 5). Saves blend/StiffMan_v003.blend"""
import bpy, os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import common
from common import move_to, point_at

PROJ = os.environ.get("STIFF_PROJ", os.path.expanduser("~/workspace/stiff-man-demo"))


def add_light(name, ltype, loc, energy, color, col="LIGHTS", **kw):
    data = bpy.data.lights.new(name, ltype)
    data.energy = energy
    data.color = color
    for k, v in kw.items():
        setattr(data, k, v)
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    bpy.context.scene.collection.objects.link(obj)
    move_to(obj, col)
    return obj


# Moonlight: spot outside the window, raking across the bed
moon = add_light("Light_MoonSpot", "SPOT", (-3.6, 0.3, 2.5), 340.0,
                 (0.55, 0.68, 1.0), spot_size=0.75, shadow_soft_size=0.4)
point_at(moon, (-0.5, 0.1, 0.05))

# Moonlight spill: low raking spot across the floor INTO the open side of
# the under-bed space, so the sleeping kid reads clearly (still night).
spill = add_light("Light_KidSpill", "SPOT", (-0.55, -1.55, 0.55), 65.0,
                  (0.55, 0.68, 1.0), spot_size=0.62, shadow_soft_size=0.6)
point_at(spill, (-1.55, 0.1, 0.16))

# Faint local lift right at the kid (moon bounce) - subtle, keeps him readable
glow = add_light("Light_UnderBedGlow", "POINT", (-1.15, 0.05, 0.30), 1.4,
                 (0.55, 0.68, 1.0), shadow_soft_size=0.4)

# Very dim cool fill from the camera side so shadows are not pure black
fill = add_light("Light_FillDim", "AREA", (1.6, -1.7, 2.2), 9.0,
                 (0.45, 0.55, 0.85), shape="DISK", size=2.5)
point_at(fill, (-0.8, 0.4, 0.4))

# Faint warm practical near the ceiling centre (barely-there base light)
warm = add_light("Light_RoomDim", "POINT", (0.3, -0.3, 2.45), 2.2,
                 (1.0, 0.75, 0.5), shadow_soft_size=0.5)

# Cold hallway light behind the Stiff Man (energy keyframed in stage 5)
hall = add_light("Light_HallCold", "SPOT", (1.4, 3.5, 1.7), 0.0,
                 (0.65, 0.78, 1.0), spot_size=1.05, shadow_soft_size=0.3)
point_at(hall, (1.4, 1.6, 1.1))

# Hallway glow point: lifts the whole doorway so his silhouette and long
# arms separate from the dark hall (energy keyframed in stage 5)
door_glow = add_light("Light_DoorGlow", "POINT", (1.4, 2.9, 1.95), 0.0,
                      (0.65, 0.78, 1.0), shadow_soft_size=0.5)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROJ, "blend", "StiffMan_v003.blend"))
print("STAGE3 OK - lights saved")
