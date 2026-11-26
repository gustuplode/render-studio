import bpy, math, sys, os, json, random
from mathutils import Vector

# ================= WELL STORY — 'The Man Who Sold His Well' =================
# Daylight, ONE continuous tracking shot (no cuts), animation keyed to the
# N1 voice beats (vo/beats.json). Skills applied:
# - character-body-movement: planted feet (stride == hip travel), heel-toe
#   roll, knee peak in swing, pelvis bob 2/cycle, counter-rotation (shoulders
#   vs hips), head lag, moving holds (never frozen), grips/contact.
# - animation-principles: ease-in-out moves, anticipation, follow-through,
#   overlapping action, arcs.
# - blender-animation: blocking->spline (BEZIER keys), moving holds, polish.

BASE = os.path.dirname(os.path.abspath(__file__))
AADMI = os.path.join(BASE, 'assets', 'aadmi.glb')
FPS = 24
BEATS = {int(k): v for k, v in json.loads(open(os.path.join(BASE, 'vo', 'beats.json')).read()).items() if k != 'total'}
TOTAL_S = 52.63
TOTAL = int(TOTAL_S * FPS) + 2  # 1265 frames

def F(sec): return int(round(sec * FPS)) + 1  # seconds -> frame (1-based)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, TOTAL

# ---------------- materials ----------------
def mat(name, color, rough=0.9, metal=0.0, emission=None, estr=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes["Principled BSDF"]
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    if emission:
        bs.inputs["Emission Color"].default_value = (*emission, 1)
        bs.inputs["Emission Strength"].default_value = estr
    return m

DIRT = mat("Dirt", (0.40, 0.29, 0.17), 1.0)
PATHM = mat("Path", (0.17, 0.125, 0.07), 1.0)
GRASSM = mat("Grass", (0.035, 0.145, 0.02), 1.0)
GRASS2 = mat("Grass2", (0.055, 0.185, 0.03), 1.0)
STONE = mat("Stone", (0.115, 0.105, 0.095), 0.95)
STONE2 = mat("Stone2", (0.075, 0.07, 0.065), 0.95)
WOOD = mat("Wood", (0.155, 0.095, 0.045), 0.9)
WOOD2 = mat("Wood2", (0.115, 0.065, 0.03), 0.9)
THATCH = mat("Thatch", (0.29, 0.215, 0.095), 1.0)
WALLM = mat("Wall", (0.33, 0.26, 0.185), 0.95)
TERRA = mat("Terracotta", (0.20, 0.072, 0.028), 0.8)
TERRA2 = mat("Terracotta2", (0.165, 0.06, 0.024), 0.8)
WATERM = mat("Water", (0.015, 0.09, 0.11), 0.08, 0.1)
ROPEM = mat("Rope", (0.24, 0.19, 0.11), 1.0)
GOLDM = mat("Gold", (0.85, 0.60, 0.12), 0.3, 0.9)
LEAF = mat("Leaf", (0.06, 0.24, 0.04), 1.0)
LEAF2 = mat("Leaf2", (0.10, 0.30, 0.05), 1.0)
TRUNK = mat("Trunk", (0.13, 0.08, 0.04), 1.0)

def box(name, loc, size, material, bevel=0.0, rot=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object; o.name = name; o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rot: o.rotation_euler = rot
    if bevel:
        mod = o.modifiers.new("b", 'BEVEL'); mod.width = bevel; mod.segments = 2
    if material: o.data.materials.append(material)
    return o

def cyl(name, loc, r, h, material, vertices=20, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, vertices=vertices)
    o = bpy.context.object; o.name = name
    if rot: o.rotation_euler = rot
    if material: o.data.materials.append(material)
    return o

# ---------------- environment ----------------
# ground with procedural dirt variation
gm = bpy.data.materials.new("GroundTex"); gm.use_nodes = True
nt = gm.node_tree
bs = nt.nodes["Principled BSDF"]
noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 6.0
noise.inputs["Detail"].default_value = 4.0
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = (0.075, 0.05, 0.024, 1)
ramp.color_ramp.elements[1].position = 0.75; ramp.color_ramp.elements[1].color = (0.135, 0.095, 0.042, 1)
nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], bs.inputs["Base Color"])
bs.inputs["Roughness"].default_value = 1.0
bpy.ops.mesh.primitive_plane_add(size=90, location=(0, 0, 0))
ground = bpy.context.object; ground.name = "Ground"; ground.data.materials.append(gm)

# dirt path from SE to the well
for _i, (_px, _py, _pr) in enumerate([(4.3, -7.6, 1.9), (3.2, -4.9, 2.1), (2.0, -2.4, 2.0), (1.0, -0.6, 1.8)]):
    cyl(f"Path{_i}", (_px, _py, 0.010 + _i * 0.006), _pr, 0.02, PATHM, vertices=22)
# grass patches
random.seed(11)
for i in range(26):
    x = random.uniform(-14, 14); y = random.uniform(-13, 12)
    if (x * x + y * y) < 9 or (abs(x - 3.4) < 1.6 and y < 0): continue
    r = random.uniform(0.8, 2.2)
    cyl(f"Grass{i}", (x, y, 0.008 + (i % 7) * 0.004), r, 0.016, GRASSM if i % 2 else GRASS2, vertices=14)

# ---- the well (origin) ----
_wo = cyl("WellOuter", (0, 0, 0.5), 1.15, 1.0, STONE, vertices=24)
import bmesh as _bm0
_me0 = _wo.data; _b0 = _bm0.new(); _b0.from_mesh(_me0)
_top0 = max(f.calc_center_median().z for f in _b0.faces)
_bm0.ops.delete(_b0, geom=[f for f in _b0.faces if abs(f.calc_center_median().z - _top0) < 0.01], context='FACES')
_b0.to_mesh(_me0); _b0.free()
_iw = cyl("WellInner", (0, 0, 0.76), 0.93, 0.5, STONE2, vertices=24)
import bmesh as _bm
_me = _iw.data; _b = _bm.new(); _b.from_mesh(_me)
_top = max(f.calc_center_median().z for f in _b.faces)
_bot = min(f.calc_center_median().z for f in _b.faces)
_del = [f for f in _b.faces if abs(f.calc_center_median().z - _top) < 0.01 or abs(f.calc_center_median().z - _bot) < 0.01]
_bm.ops.delete(_b, geom=_del, context='FACES')
_b.to_mesh(_me); _b.free()
cyl("WellDepth", (0, 0, 0.44), 0.92, 0.03, mat("WellDark", (0.02, 0.02, 0.02), 1.0), vertices=24)
bpy.ops.mesh.primitive_torus_add(major_radius=1.06, minor_radius=0.09, location=(0, 0, 1.02),
                                 major_segments=24, minor_segments=10)
rim = bpy.context.object; rim.name = "WellRim"; rim.data.materials.append(STONE2)
cyl("WellWater", (0, 0, 0.74), 0.90, 0.03, WATERM, vertices=24)
box("WellPostL", (-0.95, 0, 1.55), (0.14, 0.14, 2.1), WOOD)
box("WellPostR", (0.95, 0, 1.55), (0.14, 0.14, 2.1), WOOD)
cyl("WellBar", (0, 0, 2.55), 0.06, 2.1, WOOD2, rot=(0, math.radians(90), 0))
cyl("WellRope", (0.25, 0, 1.95), 0.022, 1.2, ROPEM, vertices=8)
# bucket
cyl("Bucket", (0.25, 0, 1.28), 0.17, 0.26, WOOD2, vertices=14)
cyl("BucketWater", (0.25, 0, 1.40), 0.145, 0.02, WATERM, vertices=14)
# sitting stone for Malo + scattered stones
box("MaloStone", (-0.4, -1.78, 0.24), (0.85, 0.7, 0.48), STONE, bevel=0.05)
for i, (sx, sy) in enumerate([(2.3, 0.6), (-2.6, -0.8), (1.8, 2.4), (-1.2, -2.8)]):
    box(f"Stone{i}", (sx, sy, 0.09), (0.34, 0.26, 0.18), STONE2, bevel=0.04)

# hut behind-left
box("HutWall", (-6.5, 5.5, 1.5), (5.5, 0.35, 3.0), WALLM)
box("HutRoof", (-6.5, 5.35, 3.35), (6.3, 1.9, 0.18), THATCH, rot=(math.radians(24), 0, 0))
box("HutDoor", (-5.2, 5.28, 1.05), (1.0, 0.1, 2.1), WOOD2)
# fence along path
for i in range(6):
    t = i / 5
    fx = 5.6 - t * 1.4; fy = -8.6 + t * 6.4
    cyl(f"Fence{i}", (fx, fy, 0.45), 0.05, 0.9, WOOD, vertices=8)
box("FenceRail", (5.05, -5.4, 0.62), (0.06, 6.8, 0.09), WOOD, rot=(0, 0, math.radians(12)))

# trees: tapered trunk + jittered foliage blobs
def tree(name, x, y, s=1.0):
    cyl(name + "Trunk", (x, y, 1.1 * s), 0.16 * s, 2.2 * s, TRUNK, vertices=10)
    random.seed(int(x * 31 + y * 17))
    for j, (ox, oy, oz, r) in enumerate([(0, 0, 2.9, 1.5), (0.8, 0.3, 2.4, 1.05), (-0.75, -0.2, 2.5, 1.0), (0.1, -0.6, 3.3, 0.95)]):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r * s, location=(x + ox * s, y + oy * s, oz * s))
        o = bpy.context.object; o.name = f"{name}Leaf{j}"
        for v in o.data.vertices:
            n = v.co.normalized()
            v.co += n * random.uniform(-0.06, 0.16) * s
        o.data.materials.append(LEAF if j % 2 == 0 else LEAF2)
tree("TreeA", -6.4, -4.8, 1.15)   # shade tree near well (SW)
tree("TreeB", 6.8, 3.8, 1.0)
tree("TreeC", -9.5, -6.5, 1.25)
tree("TreeD", 10.5, -4.5, 0.9)
# bushes
for i, (bx, by) in enumerate([(-3.2, 2.6), (4.4, 1.2), (-5.8, -1.4), (7.6, -1.8), (2.8, 5.2)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.55, location=(bx, by, 0.42))
    o = bpy.context.object; o.name = f"Bush{i}"; o.scale = (1.2, 1.0, 0.72)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for v in o.data.vertices:
        v.co += v.co.normalized() * random.uniform(-0.04, 0.10)
    o.data.materials.append(LEAF2 if i % 2 else LEAF)

# clay pots (Dara's, animated later) + static pots near well
def pot(name, x, y, material):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.21, location=(x, y, 0.19), segments=18, ring_count=12)
    o = bpy.context.object; o.name = name; o.scale = (1.0, 1.0, 1.12)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    cyl(name + "Neck", (x, y, 0.44), 0.10, 0.10, material, vertices=14)
    o.data.materials.append(material)
    return o
pot("PotStatic1", 1.95, 0.35, TERRA2)
pot("PotStatic2", 2.22, 0.05, TERRA)

# ---------------- daylight ----------------
world = bpy.data.worlds["World"]; world.use_nodes = True
wnt = world.node_tree
bg = wnt.nodes["Background"]
sky = wnt.nodes.new("ShaderNodeTexSky"); sky.sky_type = 'NISHITA'
sky.sun_elevation = math.radians(38); sky.sun_rotation = math.radians(115)
sky.altitude = 0.12
wnt.links.new(sky.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.28
ld = bpy.data.lights.new("Sun", 'SUN'); ld.energy = 2.3; ld.color = (1.0, 0.94, 0.82)
ld.angle = math.radians(2.5)
so = bpy.data.objects.new("Sun", ld); bpy.context.collection.objects.link(so)
so.rotation_euler = (math.radians(52), math.radians(-18), math.radians(115 - 90))

# ---------------- characters ----------------
def add_man(name, tint=None):
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
    if tint:
        for o in meshes:
            for m in o.data.materials:
                if m and m.use_nodes:
                    bs = m.node_tree.nodes.get("Principled BSDF")
                    if bs:
                        tex = None
                        for l in bs.inputs["Base Color"].links: tex = l.from_node
                        mix = m.node_tree.nodes.new("ShaderNodeMixRGB")
                        mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
                        mix.inputs[2].default_value = (*tint, 1)
                        if tex: m.node_tree.links.new(tex.outputs[0], mix.inputs[1])
                        else: mix.inputs[1].default_value = (1, 1, 1, 1)
                        m.node_tree.links.new(mix.outputs[0], bs.inputs["Base Color"])
    bpy.context.view_layer.update()
    snap = {b.name: (b.rotation_mode, tuple(b.rotation_euler)) for b in arm.pose.bones}
    # ground offset at rest pose
    par.location = (0, 0, 0); bpy.context.view_layer.update()
    mn = Vector((1e9,) * 3)
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector((min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)))
    return {"par": par, "arm": arm, "meshes": meshes, "snap": snap, "gz": -mn.z + 0.02}

DARA = add_man("Dara")
MALO = add_man("Malo", tint=(0.62, 0.48, 0.40))
VIL1 = add_man("Villager1", tint=(0.80, 0.72, 0.55))
VIL2 = add_man("Villager2", tint=(0.55, 0.65, 0.60))

def restore(ch):
    for b in ch["arm"].pose.bones:
        if b.name in ch["snap"]:
            b.rotation_mode = ch["snap"][b.name][0]; b.rotation_euler = ch["snap"][b.name][1]

def apply_pose(ch, pose):
    restore(ch)
    pb = ch["arm"].pose.bones
    for name, (x, y, z) in pose.items():
        if name in pb:
            pb[name].rotation_mode = 'XYZ'
            pb[name].rotation_euler = (math.radians(x), math.radians(y), math.radians(z))

def key_pose(ch, frame):
    for b in ch["arm"].pose.bones:
        b.keyframe_insert(data_path="rotation_euler", frame=frame)

def key_root(ch, frame, x, y, zoff=0.0, rotz=None):
    ch["par"].location = (x, y, ch["gz"] + zoff)
    if rotz is not None: ch["par"].rotation_euler = (0, 0, math.radians(rotz))
    ch["par"].keyframe_insert(data_path="location", frame=frame)
    if rotz is not None: ch["par"].keyframe_insert(data_path="rotation_euler", frame=frame)

def rotz_for_dir(dx, dy): return math.degrees(math.atan2(dx, -dy))
def sstep(u): u = max(0.0, min(1.0, u)); return u * u * (3 - 2 * u)
def prof(p, pts):
    # piecewise smooth profile over phase p in [0,1): pts = [(phase, value), ...] sorted
    for i in range(len(pts) - 1):
        p0, v0 = pts[i]; p1, v1 = pts[i + 1]
        if p0 <= p <= p1:
            return v0 + (v1 - v0) * sstep((p - p0) / max(1e-6, (p1 - p0)))
    return pts[-1][1]

LEG_LEN = 0.86
CYCLE_F = 22.0
def walk_pose(phase, amp=1.0, amp_deg=19.0):
    t = 2 * math.pi * phase
    A = amp_deg * amp
    pose = {}
    for side, ph in (("L", phase), ("R", phase + 0.5)):
        p = ph % 1.0
        pose[f"upperleg01.{side}"] = (-A * math.sin(2 * math.pi * p), 0, 0)
        if p < 0.5:  # stance: small knee give
            knee = 6 + 3 * math.sin(math.pi * p / 0.5)
        else:        # swing: knee peaks mid-swing
            knee = 6 + 27 * (math.sin(math.pi * (p - 0.5) / 0.5) ** 2)
        pose[f"lowerleg01.{side}"] = (knee * max(amp, 0.35), 0, 0)
        # heel-toe roll (skill): heel strike -> flat -> toe-off -> pointed swing -> level
        roll = prof(p, [(0.0, -16), (0.15, 0), (0.42, 10), (0.5, 28), (0.72, 20), (0.95, -8), (1.0, -16)])
        pose[f"foot.{side}"] = (roll * max(amp, 0.4), 0, 0)
        # arms counter-swing opposite to same-side leg, elbow pumps mid-swing
        arm_ph = (p + 0.5) % 1.0
        pose[f"upperarm01.{side}"] = (-15 * amp * math.sin(2 * math.pi * arm_ph), 0, -20 if side == "L" else 20)
        elb = -14 - 10 * amp * max(0.0, math.sin(2 * math.pi * arm_ph - 0.7))
        pose[f"lowerarm01.{side}"] = (elb, 0, 0)
    pose["spine01"] = (0, 5 * amp * math.sin(t), 0)                    # pelvis counter-rotation
    pose["spine02"] = (4, -6 * amp * math.sin(t), 0)                   # shoulders oppose hips
    pose["spine03"] = (0, 2.5 * amp * math.sin(t - 0.6), 0)            # head lags
    return pose

def bob_z(phase, amp=1.0):
    dip = 0.5 + 0.5 * math.cos(4 * math.pi * (phase - 0.06))
    return (-0.032 * dip + 0.016) * amp

def idle_pose(tsec, seed=0.0):
    br = math.sin(2 * math.pi * tsec / 3.8 + seed)
    sw = math.sin(2 * math.pi * tsec / 6.7 + seed * 2.0)
    return {
        "upperarm01.L": (-2, 0, -24), "upperarm01.R": (-2, 0, 24),
        "lowerarm01.L": (-11, 0, 0), "lowerarm01.R": (-11, 0, 0),
        "spine02": (3.5 + 1.3 * br, 0, 0.9 * sw),
        "spine03": (0, 5 * math.sin(2 * math.pi * tsec / 9.0 + seed), 0),
        "upperleg01.L": (-1, 0, 0), "upperleg01.R": (1, 0, 0),
        "lowerleg01.L": (3, 0, 0), "lowerleg01.R": (3, 0, 0),
    }

def merge(base, over, w=1.0):
    out = dict(base)
    for k, v in over.items():
        if k in out:
            b = out[k]
            out[k] = tuple(b[i] + (v[i] - b[i]) * w for i in range(3))
        else:
            out[k] = tuple(v[i] * w for i in range(3))
    return out

# gesture overlays (degrees)
G_POINT_R = {"upperarm01.R": (-84, 0, -4), "lowerarm01.R": (-6, 0, 0), "spine03": (0, -8, 0)}
G_POINT_DOWN_R = {"upperarm01.R": (-42, 0, -4), "lowerarm01.R": (-10, 0, 0), "spine02": (10, 0, 0), "spine03": (14, 0, 0)}
G_PALM_R = {"upperarm01.R": (-48, 0, -10), "lowerarm01.R": (-26, 0, 0)}
G_HIP_L = {"upperarm01.L": (6, 0, 30), "lowerarm01.L": (-88, 18, 0)}
G_CROSS = {"upperarm01.L": (-30, 0, 20), "lowerarm01.L": (-72, -22, 0),
           "upperarm01.R": (-30, 0, -20), "lowerarm01.R": (-72, 22, 0), "spine02": (5, 0, 0)}
G_SCRATCH = {"upperarm01.R": (-18, 0, -52), "lowerarm01.R": (-128, 0, 0), "spine03": (6, 0, 5)}
G_BEND = {"spine02": (19, 0, 0), "upperarm01.L": (-38, 0, 4), "upperarm01.R": (-38, 0, -4),
          "lowerarm01.L": (-14, 0, 0), "lowerarm01.R": (-14, 0, 0)}
G_SLUMP = {"spine02": (12, 0, 0), "spine03": (16, 0, 0), "upperarm01.L": (-3, 0, 3), "upperarm01.R": (-3, 0, -3)}
G_COUNT_R = {"upperarm01.R": (-56, 0, -8), "lowerarm01.R": (-16, 0, 0), "spine03": (8, 0, 0)}
G_GIVE_R = {"upperarm01.R": (-52, 0, -4), "lowerarm01.R": (-12, 0, 0)}
G_RECEIVE_R = {"upperarm01.R": (-46, 0, -6), "lowerarm01.R": (-30, 0, 0)}
SIT_POSE = {"upperleg01.L": (-88, 0, 0), "upperleg01.R": (-88, 0, 0),
            "lowerleg01.L": (86, 0, 0), "lowerleg01.R": (86, 0, 0),
            "foot.L": (-2, 0, 0), "foot.R": (-2, 0, 0),
            "spine02": (7, 0, 0), "upperarm01.L": (-32, 0, 6), "upperarm01.R": (-32, 0, -6),
            "lowerarm01.L": (-36, 0, 0), "lowerarm01.R": (-36, 0, 0)}

def do_idle(ch, f0, f1, x, y, rotz, gesture=None, g_in=0.35, g_out=0.35, extra=None, step=6):
    for f in range(f0, f1 + 1, step):
        t = (f - 1) / FPS
        pose = idle_pose(t, seed=x * 1.7 + y)
        if gesture:
            w = 1.0
            fin = g_in * FPS; fout = g_out * FPS
            if f < f0 + fin: w = sstep((f - f0) / fin)
            if f > f1 - fout: w = sstep((f1 - f) / fout)
            pose = merge(pose, gesture, w)
        if extra: pose = merge(pose, extra, 1.0)
        apply_pose(ch, pose)
        key_pose(ch, f)
        key_root(ch, f, x, y, 0.0, rotz)
    # ensure exact end key
    t = (f1 - 1) / FPS
    pose = idle_pose(t, seed=x * 1.7 + y)
    if gesture: pose = merge(pose, gesture, 0.0)
    if extra: pose = merge(pose, extra, 1.0)
    apply_pose(ch, pose); key_pose(ch, f1); key_root(ch, f1, x, y, 0.0, rotz)

def do_walk(ch, f0, f1, waypoints, rotz_end, amp_deg=19.0, head_extra=None):
    # waypoints: [(x,y), ...]; constant stride-matched speed with ease edges.
    stride_cycle = 2 * LEG_LEN * math.sin(math.radians(amp_deg)) * 2  # per full cycle (2 steps)
    v = stride_cycle / (CYCLE_F / FPS)
    pts = [Vector(p) for p in waypoints]
    total_len = sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))
    n = f1 - f0
    dist = 0.0; phase = 0.0
    prev_u = 0.0
    for i in range(0, n + 1, 2):
        f = f0 + i
        u = i / max(1, n)
        env = sstep(min(1.0, u / 0.10)) * sstep(min(1.0, (1 - u) / 0.10))
        du = u - prev_u; prev_u = u
        step_d = v * env * (du * n / FPS)
        dist += step_d
        phase += step_d / stride_cycle
        d = min(dist, total_len)
        # locate on polyline
        acc = 0.0; pos = pts[-1]; heading = pts[-1] - pts[-2]
        for j in range(len(pts) - 1):
            seg = (pts[j + 1] - pts[j]).length
            if d <= acc + seg:
                w = 0 if seg == 0 else (d - acc) / seg
                pos = pts[j] + (pts[j + 1] - pts[j]) * w
                heading = pts[j + 1] - pts[j]
                break
            acc += seg
        amp = 0.25 + 0.75 * env
        pose = walk_pose(phase, amp=amp, amp_deg=amp_deg)
        if head_extra: pose = merge(pose, head_extra, 1.0)
        apply_pose(ch, pose)
        key_pose(ch, f)
        rz = rotz_for_dir(heading.x, heading.y)
        if u > 0.88:  # blend heading to final facing
            w = sstep((u - 0.88) / 0.12)
            rz = rz + (rotz_end - rz) * w
        key_root(ch, f, pos.x, pos.y, bob_z(phase, amp), rz)
    return phase

def key_bone(ch, bone, frame, euler_deg):
    sc.frame_set(frame)
    pb = ch["arm"].pose.bones[bone]
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = tuple(math.radians(v) for v in euler_deg)
    pb.keyframe_insert(data_path="rotation_euler", frame=frame)

def fc_eval(obj, path, frame, index=0):
    if not obj.animation_data or not obj.animation_data.action: return 0.0
    for fc in obj.animation_data.action.fcurves:
        if fc.data_path == path and fc.array_index == index:
            return fc.evaluate(frame)
    return 0.0

# ================= TIMELINES (frames from voice beats) =================
FACE_DM = rotz_for_dir(-1.9, -1.1)   # Dara -> Malo
FACE_MD = rotz_for_dir(1.9, 1.1)     # Malo -> Dara
FACE_WELL_D = rotz_for_dir(-0.85, 0.35)

# ---- DARA ----
do_walk(DARA, F(0.2), F(7.3), [(4.6, -8.2), (3.0, -4.4), (1.5, -0.6)], FACE_DM)
do_idle(DARA, F(7.3), F(8.6), 1.5, -0.6, FACE_DM, gesture=G_BEND, g_in=0.3, g_out=0.4)
do_idle(DARA, F(8.6), F(18.4), 1.5, -0.6, FACE_DM)
do_idle(DARA, F(18.6), F(20.6), 1.5, -0.6, FACE_DM, gesture=G_SCRATCH)
do_idle(DARA, F(20.6), F(21.8), 1.5, -0.6, FACE_DM)
do_idle(DARA, F(21.9), F(25.3), 1.5, -0.6, FACE_DM, gesture=G_CROSS, g_in=0.5, g_out=0.5)
do_idle(DARA, F(25.5), F(29.6), 1.5, -0.6, FACE_DM, gesture=G_PALM_R)
for i, fx in enumerate((F(26.3), F(26.8), F(27.3), F(27.8))):
    key_bone(DARA, "spine03", fx, (7 if i % 2 == 0 else 0, -4, 0))  # nods
do_walk(DARA, F(29.8), F(30.9), [(1.5, -0.6), (0.85, -0.35)], FACE_WELL_D)
do_idle(DARA, F(30.9), F(31.7), 0.85, -0.35, FACE_WELL_D, gesture=G_POINT_DOWN_R, g_in=0.25, g_out=0.25)
do_idle(DARA, F(31.9), F(32.9), 0.85, -0.35, FACE_WELL_D)
do_idle(DARA, F(32.9), F(35.5), 0.85, -0.35, FACE_DM, gesture=merge(G_PALM_R, G_HIP_L))
do_idle(DARA, F(35.5), F(39.0), 0.85, -0.35, FACE_DM)
do_idle(DARA, F(39.1), F(42.7), 0.85, -0.35, FACE_DM, gesture=G_COUNT_R)
do_idle(DARA, F(43.2), F(46.6), 0.85, -0.35, FACE_DM, gesture=G_RECEIVE_R)
do_idle(DARA, F(46.6), F(47.6), 0.85, -0.35, FACE_DM)
do_idle(DARA, F(47.6), F(50.0), 0.85, -0.35, -95, gesture=G_CROSS, g_in=0.5, g_out=0.6)
do_idle(DARA, F(50.0), TOTAL, 0.85, -0.35, -95, gesture=G_CROSS, g_in=0.5, g_out=0.6)

# ---- MALO ----
for f in range(1, F(9.7) + 1, 6):
    t = (f - 1) / FPS
    pose = merge(idle_pose(t, seed=3.1), SIT_POSE, 0.92)
    apply_pose(MALO, pose); key_pose(MALO, f)
    key_root(MALO, f, -0.4, -1.7, -0.46, FACE_MD)
for f in range(F(9.7), F(11.0) + 1, 3):
    t = (f - 1) / FPS
    u = sstep((f - F(9.7)) / (F(11.0) - F(9.7)))
    poseA = merge(idle_pose(t, seed=3.1), SIT_POSE, 0.92)
    pose = merge(poseA, idle_pose(t, seed=3.1), u)
    apply_pose(MALO, pose); key_pose(MALO, f)
    key_root(MALO, f, -0.4, -1.7, -0.46 * (1 - u) - 0.05 * math.sin(math.pi * u), FACE_MD)
do_walk(MALO, F(11.0), F(11.55), [(-0.4, -1.7), (-0.75, -1.35)], FACE_MD)
do_idle(MALO, F(11.55), F(12.2), -0.75, -1.35, FACE_MD)
do_idle(MALO, F(12.2), F(14.9), -0.75, -1.35, FACE_MD, gesture=G_POINT_R)
do_idle(MALO, F(15.2), F(18.2), -0.75, -1.35, FACE_MD, gesture=G_PALM_R)
do_idle(MALO, F(18.2), F(19.0), -0.75, -1.35, FACE_MD)
do_idle(MALO, F(19.0), F(25.4), -0.75, -1.35, FACE_MD, gesture=G_CROSS, g_in=0.5, g_out=0.5)
do_idle(MALO, F(25.4), F(31.8), -0.75, -1.35, FACE_MD)
do_idle(MALO, F(31.8), F(35.5), -0.75, -1.35, FACE_MD, extra={"spine02": (-2, 0, 0)})
do_idle(MALO, F(35.9), F(38.8), -0.75, -1.35, FACE_MD, gesture=G_SLUMP, g_in=0.6, g_out=0.4)
do_idle(MALO, F(39.1), F(42.7), -0.75, -1.35, FACE_MD, gesture=G_SLUMP, g_in=0.4, g_out=0.4)
for i, fx in enumerate((F(39.8), F(40.8), F(41.8), F(42.6))):
    key_bone(MALO, "spine03", fx, (16, 7 if i % 2 == 0 else -7, 0))  # head shake
do_idle(MALO, F(43.2), F(46.6), -0.75, -1.35, FACE_MD,
        gesture={**G_GIVE_R, "spine02": (6, 0, 0), "spine03": (8, 0, 0)})
do_idle(MALO, F(46.6), F(47.6), -0.75, -1.35, FACE_MD)
do_walk(MALO, F(47.6), TOTAL, [(-0.75, -1.35), (1.3, -2.1), (3.2, -4.2)], 81,
        amp_deg=15.0, head_extra={"spine03": (13, 0, 0)})

# ---- VILLAGERS ----
do_idle(VIL1, 1, F(18.6), 6.5, 3.8, -60)
do_walk(VIL1, F(18.6), F(21.3), [(6.5, 3.8), (3.3, 1.9)], -60)
do_idle(VIL1, F(21.3), F(35.8), 3.3, 1.9, -60)
do_idle(VIL1, F(35.8), F(37.4), 3.3, 1.9, -60, gesture={"spine02": (-7, 0, 0)}, g_in=0.12, g_out=0.2)
do_idle(VIL1, F(37.4), TOTAL, 3.3, 1.9, -60)
do_idle(VIL2, 1, F(19.2), -6.8, -4.6, 124)
do_walk(VIL2, F(19.2), F(22.0), [(-6.8, -4.6), (-3.5, -2.3)], 123)
do_idle(VIL2, F(22.0), F(35.8), -3.5, -2.3, 123)
do_idle(VIL2, F(35.8), F(37.4), -3.5, -2.3, 123, gesture={"spine02": (-7, 0, 0)}, g_in=0.12, g_out=0.2)
do_idle(VIL2, F(37.4), TOTAL, -3.5, -2.3, 123)

# ---- carried pots (follow Dara's keyed root, then set down) ----
def pot_group(name, material):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    par = bpy.context.object; par.name = name
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.17, location=(0, 0, 0.155), segments=18, ring_count=12)
    body = bpy.context.object; body.scale = (1.0, 1.0, 1.12)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    body.data.materials.append(material); body.parent = par
    bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=0.09, location=(0, 0, 0.36), vertices=14)
    neck = bpy.context.object; neck.data.materials.append(material); neck.parent = par
    return par

POTA = pot_group("PotA", TERRA); POTB = pot_group("PotB", TERRA2)
setA, setB = (1.95, -0.15), (2.22, -0.42)
for f in range(1, TOTAL + 1, 4):
    dx = fc_eval(DARA["par"], "location", f, 0); dy = fc_eval(DARA["par"], "location", f, 1)
    rz = math.radians(fc_eval(DARA["par"], "rotation_euler", f, 2))
    fx_, fy_ = math.sin(rz), -math.cos(rz)
    rx, ry = -fy_, fx_  # right vector = (fy, -fx) -> use (-fy_, fx_)?? right = rotate facing by -90: (fy, -fx)
    rx, ry = fy_, -fx_
    for par, side, st in ((POTA, 0.33, setA), (POTB, -0.33, setB)):
        cx, cy, cz = dx + rx * side, dy + ry * side, 0.42
        if f >= F(7.9):
            cx, cy, cz = st[0], st[1], 0.0
        elif f >= F(7.3):
            u = sstep((f - F(7.3)) / (F(7.9) - F(7.3)))
            cx = cx + (st[0] - cx) * u; cy = cy + (st[1] - cy) * u; cz = cz * (1 - u)
        par.location = (cx, cy, cz)
        par.keyframe_insert(data_path="location", frame=f)

# ---- coin ----
cyl("Coin", (0, 0, -1), 0.05, 0.014, GOLDM, vertices=16, rot=(math.radians(90), 0, 0))
coin = bpy.context.object
for f, loc, s in ((1, (0, 0, -1), 0.001), (F(44.4), (-0.39, -1.14, 0.95), 0.001),
                  (F(44.6), (-0.39, -1.14, 0.95), 1.0), (F(46.0), (0.30, -0.95, 1.0), 1.0),
                  (F(46.5), (0.49, -0.57, 0.95), 1.0), (F(47.2), (0.49, -0.57, 0.95), 0.001),
                  (TOTAL, (0.49, -0.57, 0.95), 0.001)):
    coin.location = loc; coin.scale = (s, s, s)
    coin.keyframe_insert(data_path="location", frame=f)
    coin.keyframe_insert(data_path="scale", frame=f)

# ================= CAMERA — one continuous shot =================
cam_data = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
sc.camera = cam; cam_data.clip_end = 200; cam_data.lens = 33
ANCH = [
    (0.0, (8.8, -11.0, 3.1), (0, 0, 1.0)),
    (4.82, (6.0, -7.6, 2.2), (2.2, -3.0, 1.0)),
    (9.53, (4.6, -5.2, 2.0), (0.5, -0.9, 1.05)),
    (14.93, (2.6, -5.0, 1.95), (0.4, -0.9, 1.05)),
    (18.19, (0.7, -5.3, 1.9), (0.4, -0.9, 1.05)),
    (21.55, (-1.5, -4.9, 1.9), (0.4, -0.9, 1.05)),
    (25.20, (-3.0, -3.6, 1.9), (0.3, -0.8, 1.0)),
    (29.51, (-4.6, -1.6, 1.9), (0.3, -0.7, 1.0)),
    (31.58, (-4.2, 1.4, 1.85), (0.2, -0.3, 0.85)),
    (35.55, (-2.4, 4.6, 2.3), (0.4, -0.9, 1.0)),
    (38.80, (-1.2, 4.9, 2.3), (0.4, -0.9, 1.0)),
    (42.77, (-2.8, 4.2, 2.2), (0.4, -0.8, 1.0)),
    (47.32, (-2.2, 2.8, 1.9), (0.3, -0.4, 0.9)),
    (52.63, (-1.6, 1.9, 1.55), (0, -0.2, 0.55)),
]
for f in range(1, TOTAL + 1, 6):
    t = (f - 1) / FPS
    for i in range(len(ANCH) - 1):
        t0, p0, g0 = ANCH[i]; t1, p1, g1 = ANCH[i + 1]
        if t0 <= t <= t1:
            u = sstep((t - t0) / (t1 - t0))
            pos = tuple(p0[k] + (p1[k] - p0[k]) * u for k in range(3))
            tgt = tuple(g0[k] + (g1[k] - g0[k]) * u for k in range(3))
            break
    else:
        pos, tgt = ANCH[-1][1], ANCH[-1][2]
    cam.location = pos
    cam.rotation_euler = (Vector(tgt) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert(data_path="location", frame=f)
    cam.keyframe_insert(data_path="rotation_euler", frame=f)
sc.frame_set(1)

# ================= render settings =================
sc.render.engine = 'CYCLES'
sc.cycles.samples = 32
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.03
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.device = 'CPU'
sc.render.resolution_x = 720; sc.render.resolution_y = 1280
sc.view_settings.view_transform = 'AgX'
sc.view_settings.exposure = -0.55
sc.render.image_settings.file_format = 'PNG'

mode = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'build'
if mode == 'test':
    for f in (48, 300, 620, 900, 1150):
        sc.frame_set(f)
        sc.render.filepath = os.path.join(BASE, f'test_{f}.png')
        bpy.ops.render.render(write_still=True)
        print("TEST FRAME DONE", f)
else:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, 'scene.blend'))
    print("SCENE SAVED")
