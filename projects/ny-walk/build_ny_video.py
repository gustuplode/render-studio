import bpy, math, sys
from mathutils import Vector
import numpy as np

# ============ ANIMATION SKILL (iArt animation-principles) applied ============
# - No linear motion for events: ease-in-out for moves, ease-in for car exit pass,
#   ease-out for hero stopping at door; anticipation (lean-in), follow-through
#   (head turn lags shoulders), overlapping action (arms vs legs phase offset),
#   arcs/bob (secondary), ambient layer (lamp flicker none - steady, windows hold).
# - Walk cycle poses: CONTACT -> DOWN -> PASSING -> UP with sinusoidal spacing.

import os
BASE = os.path.dirname(os.path.abspath(__file__))
D = BASE + '/'
FRAMES_DIR = D + 'vid_frames/'
SEDAN = os.path.join(BASE, 'assets', 'generic_sedan.glb')
SUV = os.path.join(BASE, 'assets', 'suv_boxy.glb')
AADMI = os.path.join(BASE, 'assets', 'aadmi.glb')
FPS = 24
TOTAL = 672  # 28s

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, TOTAL

def mat(name, color, rough=0.85, metal=0.0, emission=None, estr=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes["Principled BSDF"]
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    if emission:
        bs.inputs["Emission Color"].default_value = (*emission, 1)
        bs.inputs["Emission Strength"].default_value = estr
    return m

ASPHALT = mat("Asphalt", (0.012, 0.012, 0.014), 0.97)
CONCRETE = mat("Concrete", (0.10, 0.10, 0.105), 0.95)
CURB = mat("Curb", (0.16, 0.16, 0.17), 0.9)
LINEY = mat("LineY", (0.55, 0.42, 0.08), 0.7)
DARKMETAL = mat("DarkMetal", (0.02, 0.02, 0.025), 0.5, 0.6)
LAMPGLASS = mat("LampGlass", (1.0, 0.72, 0.38), 0.4, 0.0, (1.0, 0.62, 0.25), 6.0)
BRICK = mat("Brick", (0.16, 0.075, 0.05), 0.95)
BRICK2 = mat("Brick2", (0.11, 0.06, 0.045), 0.95)
STONE = mat("Stone", (0.09, 0.085, 0.08), 0.92)
WINLIT = mat("WinLit", (1.0, 0.66, 0.26), 0.5, 0.0, (1.0, 0.60, 0.20), 2.2)
WINDARK = mat("WinDark", (0.03, 0.045, 0.07), 0.35, 0.1)

def box(name, loc, size, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object; o.name = name; o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("b", 'BEVEL'); mod.width = bevel; mod.segments = 2
    if material: o.data.materials.append(material)
    return o

def cyl(name, loc, r, h, material):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, vertices=16)
    o = bpy.context.object; o.name = name
    if material: o.data.materials.append(material)
    return o

# ---------- street ----------
box("Road", (0, -1.8, -0.02), (95, 5.6, 0.04), ASPHALT)
box("SidewalkNear", (0, 1.7, 0.03), (95, 2.8, 0.14), CONCRETE)
box("SidewalkFar", (0, -6.4, 0.03), (95, 2.2, 0.14), CONCRETE)
for i, x in enumerate(range(-42, 44, 4)):
    box(f"Dash{i}", (x, -1.8, 0.006), (1.8, 0.12, 0.012), LINEY)

import random as _r
def building(x, w, h, d, y, material, stoop=False):
    box(f"Bld{x}", (x, y, h / 2), (w, d, h), material)
    box(f"Cornice{x}", (x, y - d / 2 - 0.05, h - 0.25), (w + 0.3, 0.35, 0.5), CURB)
    _r.seed(int(x * 10) + 7)
    face_y = (y - d / 2 - 0.03) if y > 0 else (y + d / 2 + 0.03)
    for cx in range(int(w / 1.9)):
        for cy in range(int(h / 2.6)):
            m = WINLIT if _r.random() < 0.42 else WINDARK
            box(f"Win{x}_{cx}_{cy}", (x - w / 2 + 1.2 + cx * 1.9, face_y, 1.6 + cy * 2.6),
                (0.95, 0.05, 1.35), m)
    if stoop:
        box(f"Stoop{x}", (x, y - d / 2 - 0.9, 0.35), (2.6, 1.8, 0.7), CONCRETE)
        box(f"Door{x}", (x, y - d / 2 - 0.06, 1.15), (1.1, 0.12, 2.3), DARKMETAL)

building(-16, 13, 17, 6, 6.2, BRICK, stoop=True)
building(-3, 11, 21, 6, 6.2, BRICK2, stoop=True)
building(9, 12, 15, 6, 6.2, BRICK, stoop=True)
building(21, 12, 19, 6, 6.2, BRICK2, stoop=True)
building(-14, 12, 14, 6, -10.5, BRICK2)
building(-1, 13, 18, 6, -10.5, BRICK)
building(13, 12, 16, 6, -10.5, BRICK2)

lamp_objs = []
for x in range(-32, 34, 12):
    cyl(f"Pole{x}", (x, 0.55, 2.1), 0.05, 4.2, DARKMETAL)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.14, location=(x, 0.55, 4.28))
    bpy.context.object.data.materials.append(LAMPGLASS)
    ld = bpy.data.lights.new(f"Lamp{x}", 'POINT'); ld.energy = 240; ld.color = (1.0, 0.66, 0.30)
    ld.shadow_soft_size = 0.6; ld.use_shadow = True
    lo = bpy.data.objects.new(f"Lamp{x}", ld); bpy.context.collection.objects.link(lo); lo.location = (x, 0.55, 4.2)
    lamp_objs.append(lo)

# ---------- cars ----------
def add_car(path, loc, rotz, name):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.context.scene.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    mins = Vector((1e9,) * 3)
    for o in new:
        if o.type == 'MESH':
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                mins = Vector((min(mins.x, w.x), min(mins.y, w.y), min(mins.z, w.z)))
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    par = bpy.context.object; par.name = name
    for r in roots: r.parent = par
    par.rotation_euler = (0, 0, rotz)
    par.location = (loc[0], loc[1], loc[2] - mins.z)
    bpy.context.view_layer.update()
    return par

add_car(SEDAN, (-11, -3.4, 0), math.radians(90), "ParkedSedan")
add_car(SUV, (20.5, -3.6, 0), math.radians(90), "ParkedSUV")
DRIVE = add_car(SEDAN, (-40, -1.55, 0), math.radians(-90), "DriveSedan")
hl_spots = []
HLGLOW = mat("HLGlow", (1.0, 0.95, 0.85), 0.4, 0.0, (1.0, 0.92, 0.75), 3.5)
for dy in (-0.62, 0.62):
    ld = bpy.data.lights.new("HLpt", 'POINT'); ld.energy = 55; ld.color = (1.0, 0.93, 0.78)
    ld.shadow_soft_size = 0.3; ld.use_shadow = False
    lo = bpy.data.objects.new("HLpt", ld); bpy.context.collection.objects.link(lo)
    lo.parent = DRIVE
    lo.location = (-2.55, dy, 0.62)
    hl_spots.append(lo)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(0, 0, 0))
    bulb = bpy.context.object; bulb.name = "HLbulb"
    bulb.data.materials.append(HLGLOW)
    bulb.parent = DRIVE; bulb.location = (-2.44, dy, 0.62)

# ---------- characters ----------
def add_man(name, darken=1.0):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=AADMI)
    new = [o for o in bpy.context.scene.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    arm = [o for o in new if o.type == 'ARMATURE'][0]
    meshes = [o for o in new if o.type == 'MESH']
    mins = Vector((1e9,) * 3); maxs = Vector((-1e9,) * 3)
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mins = Vector((min(mins.x, w.x), min(mins.y, w.y), min(mins.z, w.z)))
            maxs = Vector((max(maxs.x, w.x), max(maxs.y, w.y), max(maxs.z, w.z)))
    s = 1.76 / (maxs.z - mins.z)
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    par = bpy.context.object; par.name = name
    for r in roots: r.parent = par
    par.scale = (s, s, s)
    if darken < 1.0:
        for o in meshes:
            for m in o.data.materials:
                if m and m.use_nodes:
                    bs = m.node_tree.nodes.get("Principled BSDF")
                    if bs:
                        tex = None
                        for l in bs.inputs["Base Color"].links: tex = l.from_node
                        mix = m.node_tree.nodes.new("ShaderNodeMixRGB")
                        mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
                        mix.inputs[2].default_value = (darken, darken, darken * 1.1, 1)
                        if tex: m.node_tree.links.new(tex.outputs[0], mix.inputs[1])
                        m.node_tree.links.new(mix.outputs[0], bs.inputs["Base Color"])
    bpy.context.view_layer.update()
    snap = {b.name: (b.rotation_mode, tuple(b.rotation_euler)) for b in arm.pose.bones}
    return par, arm, meshes, snap

HERO, HERO_ARM, HERO_M, HERO_SNAP = add_man("Hero")
SHAD, SHAD_ARM, SHAD_M, SHAD_SNAP = add_man("Shadow", darken=0.30)

def restore(arm, snap):
    for b in arm.pose.bones:
        if b.name in snap:
            b.rotation_mode = snap[b.name][0]; b.rotation_euler = snap[b.name][1]

# ---- walk cycle: pose from phase (animation skill: contact/down/passing/up) ----
def walk_pose(arm, snap, phase, amp=1.0, lean=5.0):
    restore(arm, snap)
    pb = arm.pose.bones
    t = 2 * math.pi * phase
    def R(name, x=0.0, y=0.0, z=0.0):
        if name in pb:
            pb[name].rotation_mode = 'XYZ'
            pb[name].rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
    R('upperleg01.L', 26 * math.sin(t) * amp)
    R('upperleg01.R', 26 * math.sin(t + math.pi) * amp)
    R('lowerleg01.L', (10 + 15 * max(0.0, math.sin(t - 2.0))) * amp)
    R('lowerleg01.R', (10 + 15 * max(0.0, math.sin(t + math.pi - 2.0))) * amp)
    R('foot.L', -8 * math.sin(t - 0.5) * amp)
    R('foot.R', -8 * math.sin(t + math.pi - 0.5) * amp)
    R('upperarm01.L', -20 * math.sin(t) * amp)   # arms opposite to same-side leg
    R('upperarm01.R', -20 * math.sin(t + math.pi) * amp)
    R('lowerarm01.L', -12 - 4 * math.sin(t) * amp)
    R('lowerarm01.R', -12 - 4 * math.sin(t + math.pi) * amp)
    R('spine02', lean, 0, 2.5 * math.sin(t) * amp)
    R('spine01', 0, 4 * math.sin(t) * amp, 0)

def key_pose(arm, frame):
    for b in arm.pose.bones:
        b.keyframe_insert(data_path="rotation_euler", frame=frame)

def ground_offset(par, meshes):
    bpy.context.view_layer.update()
    mins = Vector((1e9,) * 3)
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mins = Vector((min(mins.x, w.x), min(mins.y, w.y), min(mins.z, w.z)))
    return mins.z

def smooth(a, b, t):  # ease-in-out (skill: moves use ease-in-out)
    t = max(0.0, min(1.0, t)); s = t * t * (3 - 2 * t)
    return a + (b - a) * s

CYCLE = 20.0  # frames per full walk cycle
def animate_walker(par, arm, meshes, snap, f0, f1, x0, x1, y, rotz_deg, speed_profile='const',
                   phase0=0.0, amp_profile=None, lookback=False):
    base_z = None
    for f in range(f0, f1 + 1, 2):
        u = (f - f0) / max(1, (f1 - f0))
        if speed_profile == 'ease_out':
            uu = 1 - (1 - u) ** 2
        elif speed_profile == 'ease_in_out':
            uu = u * u * (3 - 2 * u)
        else:
            uu = u
        x = x0 + (x1 - x0) * uu
        amp = 1.0
        if amp_profile == 'fade_out':
            amp = max(0.0, 1.0 - max(0.0, (u - 0.55) / 0.45))
        phase = phase0 + (f - f0) / CYCLE
        walk_pose(arm, snap, phase, amp=amp)
        if lookback and u > 0.62:
            lu = (u - 0.62) / 0.38
            lu = lu * lu * (3 - 2 * lu)
            pb = arm.pose.bones
            if 'spine02' in pb:
                e = pb['spine02'].rotation_euler
                pb['spine02'].rotation_euler = (e.x, math.radians(38 * lu), e.z)
            if 'spine03' in pb:
                pb['spine03'].rotation_mode = 'XYZ'
                pb['spine03'].rotation_euler = (0, math.radians(18 * lu), 0)
        bob = 0.03 * (0.5 - 0.5 * math.cos(4 * math.pi * (phase))) * amp
        par.rotation_euler = (0, 0, math.radians(rotz_deg))
        par.location = (x, y, 0)
        bpy.context.view_layer.update()
        if base_z is None:
            base_z = ground_offset(par, meshes)
        par.location.z = 0.10 - base_z + bob
        par.keyframe_insert(data_path="location", frame=f)
        par.keyframe_insert(data_path="rotation_euler", frame=f)
        key_pose(arm, f)
    sc.frame_set(f0)

# ---------- world / render ----------
world = bpy.data.worlds["World"]; world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.012, 0.02, 0.045, 1); bg.inputs["Strength"].default_value = 0.5
ld = bpy.data.lights.new("Moon", 'SUN'); ld.energy = 0.4; ld.color = (0.55, 0.68, 1.0); ld.angle = math.radians(4)
so = bpy.data.objects.new("Moon", ld); bpy.context.collection.objects.link(so)
so.rotation_euler = (math.radians(58), 0, math.radians(-30))

cam_data = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
sc.camera = cam
cam_data.clip_end = 200

def cam_key(f, loc, target, lens=35):
    sc.frame_set(f)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    cam.keyframe_insert(data_path="location", frame=f)
    cam.keyframe_insert(data_path="rotation_euler", frame=f)
    cam_data.keyframe_insert(data_path="lens", frame=f)

def cam_move(f0, f1, loc0, loc1, tgt0, tgt1, lens=35, step=8):
    for f in range(f0, f1 + 1, step):
        u = (f - f0) / max(1, (f1 - f0))
        loc = tuple(smooth(loc0[i], loc1[i], u) for i in range(3))
        tgt = tuple(smooth(tgt0[i], tgt1[i], u) for i in range(3))
        cam_key(f, loc, tgt, lens)
    cam_key(f1, loc1, tgt1, lens)

# ================= SHOTS =================
# S1 (1-120) wide push-in; hero -6 -> 0.5
animate_walker(HERO, HERO_ARM, HERO_M, HERO_SNAP, 1, 672, 0, 0, 1.5, 90)  # placeholder replaced below
# clear hero keys: rebuild properly per shot segments
HERO.animation_data_clear(); HERO_ARM.animation_data_clear()
SHAD.animation_data_clear(); SHAD_ARM.animation_data_clear()

# hero path segments (walk throughout, door stop at end)
animate_walker(HERO, HERO_ARM, HERO_M, HERO_SNAP, 1, 120, -6.0, 0.5, 1.5, 90)
animate_walker(HERO, HERO_ARM, HERO_M, HERO_SNAP, 121, 288, 0.5, 9.6, 1.5, 90, phase0=120 / CYCLE)
animate_walker(HERO, HERO_ARM, HERO_M, HERO_SNAP, 289, 456, 9.6, 16.6, 1.5, 90, phase0=288 / CYCLE)
animate_walker(HERO, HERO_ARM, HERO_M, HERO_SNAP, 457, 576, 16.6, 22.3, 1.5, 90, phase0=456 / CYCLE)
animate_walker(HERO, HERO_ARM, HERO_M, HERO_SNAP, 577, 672, 22.3, 22.55, 1.9, 90,
               speed_profile='ease_out', phase0=576 / CYCLE, amp_profile='fade_out', lookback=True)
# follower: hidden till 288 (park him far away + scale keys not needed; place offscreen)
animate_walker(SHAD, SHAD_ARM, SHAD_M, SHAD_SNAP, 1, 288, -60.0, -60.0, 1.7, 90)
animate_walker(SHAD, SHAD_ARM, SHAD_M, SHAD_SNAP, 289, 456, 2.6, 10.4, 1.7, 90, phase0=0.5)
animate_walker(SHAD, SHAD_ARM, SHAD_M, SHAD_SNAP, 457, 672, 10.4, 15.2, 1.7, 90, phase0=168 / CYCLE)

# driving car: ease-in pass during S3 (frames 320-404), else parked offscreen
for f in range(1, TOTAL + 1, 4):
    if f < 320:
        x = 42.0
    elif f <= 404:
        u = (f - 320) / 84.0
        x = 26.0 - 50.0 * (u * u)  # ease-in: accelerates away (skill); car faces -X
    else:
        x = -60.0
    DRIVE.location = (x, -1.55, DRIVE.location.z)
    DRIVE.keyframe_insert(data_path="location", frame=f)

# camera per shot
cam_move(1, 120, (-8.5, -6.8, 1.7), (-7.4, -6.0, 1.68), (2.0, 1.5, 1.1), (2.6, 1.5, 1.1), 32)
cam_move(121, 288, (-3.7, 2.9, 1.62), (5.4, 2.9, 1.62), (0.5, 1.2, 1.0), (9.6, 1.2, 1.0), 34)
cam_move(289, 456, (7.2, -5.2, 1.75), (9.0, -5.0, 1.72), (13.5, 1.2, 1.0), (16.0, 1.2, 1.0), 30)
cam_move(457, 576, (17.5, -3.6, 1.55), (18.6, -3.4, 1.6), (21.5, 3.0, 1.3), (22.0, 3.2, 6.2), 34)
cam_move(577, 672, (18.4, -1.9, 1.65), (19.4, -1.5, 1.62), (22.5, 2.1, 1.25), (22.55, 2.1, 1.3), 40)
sc.frame_set(1)

# ---------- render settings: Cycles (CPU; GitHub runners have no GPU) ----------
sc.render.engine = 'CYCLES'
sc.cycles.samples = 32
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.03
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.device = 'CPU'
sc.render.resolution_x = 720; sc.render.resolution_y = 1280
sc.view_settings.view_transform = 'AgX'
sc.render.image_settings.file_format = 'PNG'
sc.render.filepath = FRAMES_DIR + 'f_'
sc.render.use_file_extension = True

os.makedirs(FRAMES_DIR, exist_ok=True)
mode = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'build'
if mode == 'test':
    for f in (200, 360):
        sc.frame_set(f)
        sc.render.filepath = D + f'vtest_{f}.png'
        bpy.ops.render.render(write_still=True)
        print("TEST FRAME DONE", f)
else:
    bpy.ops.wm.save_as_mainfile(filepath=D + 'scene.blend')
    print("SCENE SAVED", D + 'scene.blend')
