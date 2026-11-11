"""Stage 2 - MODEL: night bedroom set, tall-leg bed, kid asleep under it,
self-opening door (hinged), wall clock at 12, and the Stiff Man.
Real-world scale (meters). Saves blend/StiffMan_v002.blend"""
import bpy, os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import common
from common import box, cyl, sphere, empty, mat

PROJ = os.environ.get("STIFF_PROJ", os.path.expanduser("~/workspace/stiff-man-demo"))

# ---------------- materials ----------------
M_WALL   = mat("Wall_Plaster",  (0.16, 0.19, 0.26), rough=0.95)
M_FLOOR  = mat("Floor_Wood",    (0.10, 0.06, 0.035), rough=0.8)
M_WOOD   = mat("Bed_Wood",      (0.16, 0.09, 0.045), rough=0.65)
M_SHEET  = mat("Sheet_White",   (0.55, 0.56, 0.58), rough=0.9)
M_BLANK  = mat("Blanket_Blue",  (0.13, 0.22, 0.34), rough=0.95)
M_PAD    = mat("FloorPad_Rust", (0.30, 0.13, 0.09), rough=0.95)
M_RUG    = mat("Rug_Muted",     (0.20, 0.12, 0.14), rough=1.0)
M_SKIN_K = mat("Kid_Skin",      (0.62, 0.42, 0.30), rough=0.6)
M_HAIR   = mat("Kid_Hair",      (0.05, 0.03, 0.02), rough=0.85)
M_PJ     = mat("Kid_Pyjama",    (0.10, 0.30, 0.38), rough=0.9)
M_DARK   = mat("Dark_Cloth",    (0.05, 0.05, 0.06), rough=0.9)
M_COAT   = mat("Stiff_Coat",    (0.09, 0.09, 0.10), rough=0.85)
M_GREY   = mat("Stiff_Skin",    (0.52, 0.53, 0.55), rough=0.55)
M_BLACK  = mat("Near_Black",    (0.01, 0.01, 0.012), rough=0.4)
M_CLOCK  = mat("Clock_Face",    (0.75, 0.74, 0.70), rough=0.5)
M_MOONSKY= mat("Moon_Sky",      (0.10, 0.16, 0.30), rough=1.0,
               emit=(0.25, 0.38, 0.65), emit_strength=0.9)

# ---------------- room shell (ENV) ----------------
# Floor 5 x 4 m, ceiling 2.7 m
box("Env_Floor",   (0, 0, -0.05), (5.0, 4.0, 0.1), "ENV", M_FLOOR)
box("Env_Ceiling", (0, 0, 2.75),  (5.0, 4.0, 0.1), "ENV", M_WALL)
# Front wall (behind camera) and right wall (solid)
box("Env_WallFront", (0, -2.05, 1.35), (5.0, 0.1, 2.7), "ENV", M_WALL)
box("Env_WallRight", (2.55, 0, 1.35),  (0.1, 4.0, 2.7), "ENV", M_WALL)

# Left wall (x=-2.5) with window hole: window y in [-0.0,1.2] -> centered 0.6, z 0.95..2.05
box("Env_WallLeft_A", (-2.55, -1.4, 1.35), (0.1, 1.2, 2.7), "ENV", M_WALL)   # y -2..-0.8
box("Env_WallLeft_B", (-2.55,  1.6, 1.35), (0.1, 0.8, 2.7), "ENV", M_WALL)   # y 1.2..2
box("Env_WallLeft_C", (-2.55,  0.2, 0.475), (0.1, 2.0, 0.95), "ENV", M_WALL) # below sill (y -0.8..1.2)
box("Env_WallLeft_D", (-2.55,  0.2, 2.375), (0.1, 2.0, 0.65), "ENV", M_WALL) # above window

# Window frame + moonlit sky plane outside
box("Win_FrameTop",    (-2.5, 0.2, 2.06), (0.06, 2.06, 0.06), "PROPS", M_WOOD)
box("Win_FrameBottom", (-2.5, 0.2, 0.94), (0.06, 2.06, 0.06), "PROPS", M_WOOD)
box("Win_FrameMid",    (-2.5, 0.2, 1.50), (0.04, 2.0, 0.035), "PROPS", M_WOOD)
box("Win_SkyGlow",     (-3.4, 0.2, 1.5),  (0.05, 3.4, 2.6),  "ENV", M_MOONSKY)

# Back wall (y=2) with door hole: door x 0.94..1.86 (0.92 wide), height 2.2
box("Env_WallBack_A", (-0.78, 2.05, 1.35), (3.44, 0.1, 2.7), "ENV", M_WALL)  # x -2.5..0.94
box("Env_WallBack_B", ( 2.18, 2.05, 1.35), (0.64, 0.1, 2.7), "ENV", M_WALL)  # x 1.86..2.5
box("Env_WallBack_C", ( 1.40, 2.05, 2.45), (0.92, 0.1, 0.5), "ENV", M_WALL)  # lintel above door
# Door frame trim
box("Door_TrimL", (0.92, 2.0, 1.10), (0.07, 0.14, 2.24), "PROPS", M_WOOD)
box("Door_TrimR", (1.88, 2.0, 1.10), (0.07, 0.14, 2.24), "PROPS", M_WOOD)
box("Door_TrimT", (1.40, 2.0, 2.23), (1.03, 0.14, 0.07), "PROPS", M_WOOD)

# Dark hallway box behind the door (so doorway is not a void)
box("Hall_Floor", (1.4, 2.9, -0.05), (1.6, 1.9, 0.1), "ENV", M_DARK)
box("Hall_Back",  (1.4, 3.85, 1.35), (1.6, 0.1, 2.7), "ENV", M_DARK)
box("Hall_Left",  (0.55, 2.9, 1.35), (0.1, 1.9, 2.7), "ENV", M_DARK)
box("Hall_Right", (2.25, 2.9, 1.35), (0.1, 1.9, 2.7), "ENV", M_DARK)
box("Hall_Top",   (1.4, 2.9, 2.75),  (1.6, 1.9, 0.1), "ENV", M_DARK)

# Rug in room centre
box("Prop_Rug", (0.2, -0.1, 0.012), (2.3, 1.7, 0.024), "PROPS", M_RUG, bevel=0.01)

# ---------------- door on hinge (PROPS) ----------------
hinge = empty("Prop_Door_Hinge", (0.94, 2.0, 0.0), "PROPS")
panel = box("Prop_Door", (1.40, 2.0, 1.10), (0.92, 0.05, 2.16), "PROPS",
            mat("Door_Painted", (0.23, 0.16, 0.10), rough=0.6), bevel=0.008)
knob = sphere("Prop_DoorKnob", (1.76, 1.94, 1.05), (0.035, 0.035, 0.035),
              "PROPS", mat("Knob_Brass", (0.45, 0.32, 0.10), rough=0.35, metal=0.9),
              subsurf=1)
for child in (panel, knob):
    child.parent = hinge
    child.matrix_parent_inverse = hinge.matrix_world.inverted()

# ---------------- tall-leg bed (PROPS), nobody sleeps IN it ----------------
for i, (lx, ly) in enumerate([(-2.06, -0.82), (-1.04, -0.82),
                              (-2.06, 1.02), (-1.04, 1.02)]):
    cyl(f"Bed_Leg{i+1}", (lx, ly, 0.275), 0.04, 0.55, "PROPS", M_WOOD)
box("Prop_Bed_TallLegs", (-1.55, 0.10, 0.575), (1.16, 2.0, 0.09), "PROPS", M_WOOD, bevel=0.01)
box("Bed_Mattress", (-1.55, 0.10, 0.70), (1.10, 1.95, 0.16), "PROPS", M_SHEET, bevel=0.03)
box("Bed_BlanketMade", (-1.55, 0.42, 0.795), (1.12, 1.28, 0.05), "PROPS", M_BLANK, bevel=0.02)
box("Bed_BlanketFold", (-1.55, -0.20, 0.81), (1.12, 0.16, 0.06), "PROPS", M_BLANK, bevel=0.02)
box("Bed_Pillow", (-1.55, -0.70, 0.80), (0.62, 0.36, 0.09), "PROPS", M_SHEET, bevel=0.035)
box("Bed_Headboard", (-1.55, -0.95, 0.95), (1.16, 0.06, 0.95), "PROPS", M_WOOD, bevel=0.01)

# ---------------- kid asleep UNDER the bed (HERO) ----------------
box("Kid_FloorPad", (-1.55, 0.10, 0.025), (0.58, 1.55, 0.05), "PROPS", M_PAD, bevel=0.015)
# lying on his side, length along Y, face toward +X (room centre)
sphere("Hero_Kid_Torso", (-1.58, 0.02, 0.17), (0.155, 0.40, 0.125), "HERO", M_PJ)
sphere("Hero_Kid_Head", (-1.50, 0.50, 0.185), (0.105, 0.115, 0.105), "HERO", M_SKIN_K)
sphere("Kid_Hair", (-1.545, 0.50, 0.225), (0.108, 0.118, 0.10), "HERO", M_HAIR)
# closed eyes: two small dark flattened discs on the +X face
for i, ey in enumerate((0.545, 0.465)):
    sphere(f"Kid_EyeClosed{i+1}", (-1.405, ey, 0.20), (0.012, 0.026, 0.008),
           "HERO", M_BLACK, subsurf=1)
# legs stretched along -Y, pyjama
cyl("Kid_LegL", (-1.60, -0.42, 0.13), 0.048, 0.52, "HERO", M_PJ, rot=(1.5708, 0, 0))
cyl("Kid_LegR", (-1.52, -0.42, 0.09), 0.048, 0.52, "HERO", M_PJ, rot=(1.5708, 0, 0))
# one arm along the body
cyl("Kid_Arm", (-1.44, 0.05, 0.13), 0.036, 0.42, "HERO", M_PJ, rot=(1.5708, 0, 0.15))
# blanket over lower body
box("Kid_Blanket", (-1.57, -0.28, 0.185), (0.46, 0.62, 0.05), "HERO", M_BLANK, bevel=0.02)

# ---------------- wall clock showing 12:00 (PROPS) ----------------
cyl("Prop_WallClock", (0.15, 1.96, 1.95), 0.17, 0.045, "PROPS", M_WOOD,
    rot=(1.5708, 0, 0), subsurf=1)
cyl("Clock_Face", (0.15, 1.935, 1.95), 0.15, 0.012, "PROPS", M_CLOCK,
    rot=(1.5708, 0, 0), subsurf=1)
box("Clock_MinuteHand", (0.15, 1.925, 2.01), (0.014, 0.008, 0.125), "PROPS", M_BLACK)
box("Clock_HourHand", (0.15, 1.925, 2.005), (0.02, 0.008, 0.085), "PROPS", M_BLACK)

# ---------------- THE STIFF MAN (HERO) ----------------
# ~2.18 m tall - as tall as the door. Stands in doorway plane (y ~2.06),
# faces -Y into the room. Legs perfectly straight, arms hang to his ankles.
SX, SY = 1.40, 2.06
cyl("Stiff_LegL", (SX - 0.11, SY, 0.53), 0.055, 1.06, "HERO", M_COAT)
cyl("Stiff_LegR", (SX + 0.11, SY, 0.53), 0.055, 1.06, "HERO", M_COAT)
box("Stiff_ShoeL", (SX - 0.11, SY - 0.05, 0.03), (0.09, 0.24, 0.06), "HERO", M_BLACK, bevel=0.01)
box("Stiff_ShoeR", (SX + 0.11, SY - 0.05, 0.03), (0.09, 0.24, 0.06), "HERO", M_BLACK, bevel=0.01)
# long coat: cone, wide skirt at bottom, narrower at shoulders
cyl("Hero_StiffMan_Torso", (SX, SY, 1.42), 0.20, 0.98, "HERO", M_COAT,
    radius_top=0.135)
sphere("Stiff_Shoulders", (SX, SY, 1.885), (0.235, 0.115, 0.085), "HERO", M_COAT)
# arms: shoulders (z 1.86) straight down to the ankles (z ~0.14) - never bend
cyl("Stiff_ArmL", (SX - 0.255, SY, 1.00), 0.034, 1.72, "HERO", M_COAT)
cyl("Stiff_ArmR", (SX + 0.255, SY, 1.00), 0.034, 1.72, "HERO", M_COAT)
sphere("Stiff_HandL", (SX - 0.255, SY, 0.11), (0.045, 0.05, 0.075), "HERO", M_GREY)
sphere("Stiff_HandR", (SX + 0.255, SY, 0.11), (0.045, 0.05, 0.075), "HERO", M_GREY)
cyl("Stiff_Neck", (SX, SY, 1.96), 0.045, 0.10, "HERO", M_GREY)
sphere("Hero_StiffMan_Head", (SX, SY, 2.075), (0.088, 0.092, 0.125), "HERO", M_GREY)
# hollow dark eyes on the -Y face
for i, ex in enumerate((SX - 0.036, SX + 0.036)):
    sphere(f"Stiff_Eye{i+1}", (ex, SY - 0.082, 2.10), (0.013, 0.010, 0.02),
           "HERO", M_BLACK, subsurf=1)
# thin straight mouth line
box("Stiff_Mouth", (SX, SY - 0.088, 2.02), (0.045, 0.008, 0.006), "HERO", M_BLACK)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROJ, "blend", "StiffMan_v002.blend"))
print("STAGE2 OK - model saved")
