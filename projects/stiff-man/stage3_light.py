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
moon = add_light("Light_MoonSpot", "SPOT", (-3.6, 0.3, 2.5), 260.0,
                 (0.55, 0.68, 1.0), spot_size=0.62, shadow_soft_size=0.4)
point_at(moon, (-0.5, 0.1, 0.05))

# Very dim cool fill from the camera side so shadows are not pure black
fill = add_light("Light_FillDim", "AREA", (1.6, -1.7, 2.2), 6.0,
                 (0.45, 0.55, 0.85), shape="DISK", size=2.5)
point_at(fill, (-0.8, 0.4, 0.4))

# Faint warm practical near the ceiling centre (barely-there base light)
warm = add_light("Light_RoomDim", "POINT", (0.3, -0.3, 2.45), 2.2,
                 (1.0, 0.75, 0.5), shadow_soft_size=0.5)

# Cold hallway light behind the Stiff Man (energy keyframed in stage 5)
hall = add_light("Light_HallCold", "SPOT", (1.4, 3.5, 1.7), 0.0,
                 (0.65, 0.78, 1.0), spot_size=0.9, shadow_soft_size=0.3)
point_at(hall, (1.4, 1.6, 1.1))

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROJ, "blend", "StiffMan_v003.blend"))
print("STAGE3 OK - lights saved")
