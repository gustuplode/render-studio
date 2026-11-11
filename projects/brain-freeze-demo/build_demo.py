# build_demo.py — Brain Freeze DEMO scene (house skill: blender-scene-studio).
# ~12 s / 288 frames @ 24 fps, EXTERIOR ONLY, silent. Proves: MPFB character,
# procedural walk, named expressions (expressions.py shape keys), ONE
# continuous camera flight. Deterministic bpy; ALL animation = keyframes.
# Builds + saves demo_scene.blend next to this script (textures PACKED, so
# the blend renders standalone: blender -b demo_scene.blend -s A -e B -a).
#
# TURBO PROFILE (Abid 2026-11-11): Cycles samples cap 24, adaptive threshold
# 0.03, min 8, OIDN on, 640x1138 — see DEMO_REPORT for locked-vs-fast evidence.
# Colour: AgX + 'AgX - Medium High Contrast' (valid 4.2 enum; the plain
# 'Medium Contrast' string silently fell back to Filmic in v2 — documented).
import bpy, os, math, sys
from mathutils import Vector, Matrix

FPS = 24
TOTAL = 288
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)
PARENT = os.path.dirname(SCRIPT_DIR)
if PARENT not in sys.path:
    sys.path.insert(0, PARENT)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
import addon_utils
addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True, persistent=True)

# ---------------------------------------------------------------- helpers
def key(obj, path, frame):
    obj.keyframe_insert(data_path=path, frame=frame)

def loc_key(obj, loc, frame):
    obj.location = loc
    key(obj, 'location', frame)

def rot_key(obj, rot, frame):
    obj.rotation_euler = rot
    key(obj, 'rotation_euler', frame)

def scale_key(obj, scale, frame):
    if isinstance(scale, (int, float)):
        scale = (scale, scale, scale)
    obj.scale = scale
    key(obj, 'scale', frame)

def principled(name, color, roughness=0.6, metallic=0.0, sss=0.0,
               sss_radius=(1.0, 0.35, 0.2), noise_bump=0.0, noise_scale=5.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = sss
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = sss_radius
    if noise_bump > 0:
        tex = mat.node_tree.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = noise_scale
        tex.inputs['Detail'].default_value = 6.0
        tex.inputs['Roughness'].default_value = 0.8
        bump = mat.node_tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = noise_bump
        bump.inputs['Distance'].default_value = 0.25
        mat.node_tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat

def make_empty(name, loc):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    bpy.context.collection.objects.link(e)
    return e

# ---------------------------------------------------------------- render settings (FAST DEMO PROFILE)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.03
scene.cycles.adaptive_min_samples = 8
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
try:
    scene.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
except Exception:
    pass
scene.cycles.device = 'CPU'
scene.render.resolution_x = 640
scene.render.resolution_y = 1138
scene.render.resolution_percentage = 100
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = TOTAL
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 3
scene.cycles.glossy_bounces = 3
scene.cycles.transmission_bounces = 4
scene.cycles.transparent_max_bounces = 8
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = 0.5
scene.render.image_settings.file_format = 'PNG'
scene.display_settings.display_device = 'sRGB'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'

# ---------------------------------------------------------------- world + exterior set (from v2)
world = bpy.data.worlds.new('World')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.42, 0.66, 0.92, 1.0)
bg.inputs['Strength'].default_value = 0.55

ground_mat = principled('GroundMat', (0.52, 0.76, 0.92), roughness=0.95)
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=16, fill_type='NGON', location=(0, 0, 0))
ground = bpy.context.object
ground.name = 'Ground'
ground.data.materials.append(ground_mat)

bd_mat = bpy.data.materials.new('BackdropMat')
bd_mat.use_nodes = True
bnt = bd_mat.node_tree
bbsdf = bnt.nodes.get('Principled BSDF')
bbsdf.inputs['Roughness'].default_value = 1.0
tc = bnt.nodes.new('ShaderNodeTexCoord')
grad = bnt.nodes.new('ShaderNodeTexGradient')
ramp = bnt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.30, 0.58, 0.88, 1)
ramp.color_ramp.elements[1].color = (0.52, 0.76, 0.94, 1)
bnt.links.new(tc.outputs['Generated'], grad.inputs['Vector'])
bnt.links.new(grad.outputs['Fac'], ramp.inputs['Fac'])
bnt.links.new(ramp.outputs['Color'], bbsdf.inputs['Base Color'])
bpy.ops.mesh.primitive_plane_add(size=34, location=(0, -6.0, 4.0),
                                 rotation=(math.radians(-90), 0, 0))
backdrop = bpy.context.object
backdrop.name = 'Backdrop'
backdrop.data.materials.append(bd_mat)

def area_light(name, loc, energy, size, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.shape = 'DISK'
    ld.size = size
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    bpy.context.collection.objects.link(ob)
    return ob

def look_at(obj, target):
    d = Vector(target) - Vector(obj.location)
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

key_light = area_light('KeyLight', (2.6, 3.4, 4.2), 700, 3.0, (1.0, 0.97, 0.92))
look_at(key_light, (0, 0, 1.1))
fill_light = area_light('FillLight', (-3.2, 2.6, 2.2), 240, 2.5, (0.85, 0.92, 1.0))
look_at(fill_light, (0, 0, 1.1))
rim_light = area_light('RimLight', (-0.5, -3.6, 3.2), 380, 2.0, (0.8, 0.9, 1.0))
look_at(rim_light, (0, 0, 1.3))

# ---------------------------------------------------------------- the boy + expressions
import human_gen, expressions

boy_root = make_empty('BoyRoot', (0, 0, 0))
human_root, HINFO = human_gen.build_human()
rig = bpy.data.objects[HINFO["rig"]]
# expressions BEFORE any root transform use (mesh-local == native space)
BLOCKS = expressions.add_expressions(HINFO)
human_root.parent = boy_root
S = 1.65 / HINFO["span"]
human_root.scale = (S, S, S)
human_root.rotation_euler = (0, 0, math.pi)  # MPFB faces -Y; flip to face +Y
human_root.location = (0, 0, -HINFO["zmin"] * S)
bpy.context.view_layer.update()
MOUTH_LOCAL = human_root.matrix_world @ Vector(HINFO["mouth"])
print('HUMAN span %.3f scale %.3f mouth_local %s' % (
    HINFO["span"], S, tuple(round(v, 3) for v in MOUTH_LOCAL)))

# breathing (never frozen)
for f, s in [(1, 1.0), (48, 1.004), (96, 1.0), (150, 1.004), (200, 1.0),
             (240, 1.004), (288, 1.0)]:
    scale_key(boy_root, (s, s, 1.0 + (s - 1.0) * 1.6), f)

# lean + walk-yaw + pain shake on BoyRoot
lean = [(1, (0, 0, 0.357)), (60, (0.004, 0, 0.30)), (110, (0.015, 0, 0.12)),
        (140, (0.03, 0, 0)),
        (200, (0.040, 0.008, 0)), (206, (0.052, -0.008, 0)),
        (212, (0.040, 0.008, 0)), (218, (0.052, -0.008, 0)),
        (224, (0.040, 0.006, 0)), (230, (0.048, -0.005, 0)),
        (238, (0.020, 0, 0)),
        (246, (0.005, 0, 0.05)), (262, (0.004, 0, 0.30)), (288, (0, 0, 0.464))]
for f, r in sorted(lean):
    rot_key(boy_root, r, f)

# ---------------------------------------------------------------- walk system (copied pattern from v2)
LC = 0.92  # metres per full gait cycle
AMP = math.asin(min(0.45, LC / (4.0 * HINFO["leg_len"] * S)))

def _smooth(u):
    return u * u * (3 - 2 * u)

def path_pos(controls, f):
    if f <= controls[0][0]:
        return controls[0][1].copy()
    for (f0, p0), (f1, p1) in zip(controls, controls[1:]):
        if f <= f1:
            u = _smooth((f - f0) / (f1 - f0)) if f1 > f0 else 1.0
            return p0 + (p1 - p0) * u
    return controls[-1][1].copy()

def key_walk(controls, f_start, f_end):
    positions = {}
    dist = 0.0
    prev = None
    for f in range(f_start, f_end + 1):
        p = path_pos(controls, f)
        if prev is not None:
            dist += (p - prev).length
        prev = p
        positions[f] = (p, dist)
    for f in range(f_start, f_end + 1, 3):
        p, d = positions[f]
        phase = 2 * math.pi * d / LC
        f2 = min(f + 3, f_end)
        speed = (positions[f2][1] - d) / max(1, f2 - f) * FPS
        env = max(0.0, min(1.0, speed / 0.85))
        bob = 0.02 * (0.5 - 0.5 * math.cos(2 * phase)) * env
        boy_root.location = (p.x, p.y, p.z + bob)
        key(boy_root, 'location', f)
        bpy.context.scene.frame_set(f)
        human_gen.gait_pose(rig, phase, env, AMP)
        human_gen.gait_key(rig, f)
    p, d = positions[f_end]
    boy_root.location = (p.x, p.y, p.z)
    key(boy_root, 'location', f_end)

ORIGIN = Vector((0, 0, 0))
WALK1 = [(1, Vector((1.55, -4.15, 0))), (140, ORIGIN)]
WALK2 = [(246, ORIGIN), (288, Vector((-0.5, 1.05, 0)))]
key_walk(WALK1, 1, 140)
for f in (144, 152):
    bpy.context.scene.frame_set(f)
    human_gen.stance_key(rig, f)
loc_key(boy_root, (0, 0, 0), 152)
loc_key(boy_root, (0, 0, 0), 240)
bpy.context.scene.frame_set(242)
human_gen.stance_key(rig, 242)
key_walk(WALK2, 246, 288)

def boypos(f):
    if f <= 140:
        return path_pos(WALK1, f)
    if f < 246:
        return ORIGIN.copy()
    return path_pos(WALK2, f)

# ---------------------------------------------------------------- head support for expressions
head_pb = rig.pose.bones["head"]
def tilt_head(ang, frame):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    h = head_pb.head.copy()
    m = (Matrix.Translation(h) @ Matrix.Rotation(ang, 4, 'X')
         @ Matrix.Translation(-h) @ head_pb.matrix)
    head_pb.matrix = m
    bpy.context.view_layer.update()
    head_pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)
    head_pb.keyframe_insert(data_path="location", frame=frame)

for f, a in [(1, 0.0), (52, 0.0), (66, -0.055), (96, -0.04), (110, 0.02),
             (118, 0.10), (140, 0.05), (168, 0.0), (176, -0.075),
             (196, -0.02), (214, 0.10), (238, 0.08), (258, 0.0), (288, 0.0)]:
    tilt_head(a, f)

# ---------------------------------------------------------------- expression timeline (CONTRACT)
EXPR_KEYS = {
    # smile values boosted x~1.4 (shape keys may exceed 1.0): the sheet
    # gate rated smile WEAK (low-contrast lip seam); per the 2026-11-11
    # speed order this timeline boost replaces any further sheet cycle.
    "smile":  [(1, 0.0), (26, 1.15), (50, 1.25), (64, 0.35), (80, 0.0)],
    "laugh":  [(44, 0.0), (64, 1.0), (100, 1.0), (112, 0.0)],
    "shock":  [(168, 0.0), (178, 1.0), (196, 1.0), (208, 0.0)],
    "pain":   [(196, 0.0), (210, 1.0), (236, 1.0), (252, 0.0)],
    "relief": [(242, 0.0), (262, 0.85), (288, 0.85)],
}
for state, keys_ in EXPR_KEYS.items():
    for f, v in keys_:
        expressions.set_expr(BLOCKS, state, v, f)

# ---------------------------------------------------------------- bite arm: IK-baked hand raise
# The cone is keyed to the mouth, so the HAND must travel there too (a
# floating cone fails the contract). A temporary IK constraint on
# lowerarm_r aims the hand at the cone grip; the result is baked to plain
# bone keys and the constraint is removed — the saved scene has no live IK.
BITE_POS = tuple(MOUTH_LOCAL + Vector((0.01, -0.07, -0.158)) + Vector((0, -0.002, -0.012)))
bite_tgt = make_empty('BiteHandTarget', (0, 0, 0))
bite_tgt.parent = boy_root
bite_tgt.matrix_parent_inverse = Matrix.Identity(4)
bite_tgt.location = BITE_POS
fore_pb = rig.pose.bones["lowerarm_r"]
ik = fore_pb.constraints.new('IK')
ik.target = bite_tgt
ik.chain_count = 2
for f, v in [(100, 0.0), (110, 0.0), (118, 1.0), (136, 1.0), (146, 0.0), (152, 0.0)]:
    ik.influence = v
    ik.keyframe_insert(data_path='influence', frame=f)
ARM_BONES = ("upperarm_r", "lowerarm_r", "hand_r")
act = rig.animation_data.action
for fc in act.fcurves:
    # transform channels ONLY — an earlier version matched the constraint
    # path too and deleted the IK influence keys, silently disabling the IK
    if any(fc.data_path == 'pose.bones["%s"].%s' % (b, ch)
           for b in ARM_BONES for ch in ('rotation_quaternion', 'location', 'scale')):
        for i in range(len(fc.keyframe_points) - 1, -1, -1):
            if 100 < fc.keyframe_points[i].co.x < 152:
                fc.keyframe_points.remove(fc.keyframe_points[i])
for f in range(100, 153, 4):
    bpy.context.scene.frame_set(f)
    bpy.context.view_layer.update()
    for bn in ARM_BONES:
        pb = rig.pose.bones[bn]
        pb.matrix_basis = rig.convert_space(pose_bone=pb, matrix=pb.matrix,
                                            from_space='POSE', to_space='LOCAL')
        pb.keyframe_insert(data_path='rotation_quaternion', frame=f)
        pb.keyframe_insert(data_path='location', frame=f)
fore_pb.constraints.remove(ik)
bpy.data.objects.remove(bite_tgt, do_unlink=True)
bpy.context.scene.frame_set(152)
bpy.context.view_layer.update()
print('BITE_IK_BAKED')

# ---------------------------------------------------------------- the cone in his right hand
bpy.context.scene.frame_set(152)
bpy.context.view_layer.update()
hand_local = boy_root.matrix_world.inverted() @ (rig.matrix_world @ rig.pose.bones["hand_r"].tail)
print('HAND_LOCAL', tuple(round(v, 3) for v in hand_local))
waffle = principled('ConeWaffle', (0.72, 0.47, 0.22), roughness=0.8,
                    noise_bump=0.5, noise_scale=18.0)
cone_root = make_empty('ConeRoot', tuple(hand_local))
cone_root.parent = boy_root
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.002, radius2=0.052, depth=0.17,
                                location=(0, 0, 0.085))
cone_mesh = bpy.context.object
cone_mesh.name = 'ConeMesh'
cone_mesh.data.materials.append(waffle)
cone_mesh.parent = cone_root
cone_scoop_cols = [(0.98, 0.62, 0.72), (0.99, 0.93, 0.80)]
cone_scoop_dat = [(0.072, (0, 0, 0.185)), (0.055, (0.012, 0, 0.252))]
for i, (c, (r, p)) in enumerate(zip(cone_scoop_cols, cone_scoop_dat)):
    sm = principled(f'ConeScoop{i}', c, roughness=0.35, sss=0.45)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=p)
    sc = bpy.context.object
    sc.name = f'ConeScoop{i}'
    sc.data.materials.append(sm)
    sc.parent = cone_root
HOLD_POS = tuple(hand_local)
# MEASURED mouth correction (measure_mouth.py): human_gen's mouth estimate
# is 13 mm above the true lip seam -> shift the bite target down/back by the
# measured delta (native (0,-0.002,-0.013) x scale S), on top of v2's offset.
# (BITE_POS itself is defined once, in the bite-arm IK block above.)
MID_POS = tuple((Vector(HOLD_POS) + Vector(BITE_POS)) / 2 + Vector((0, 0.02, 0.03)))
for f, l in [(1, HOLD_POS), (100, HOLD_POS), (110, MID_POS), (118, BITE_POS),
             (136, BITE_POS), (152, HOLD_POS), (288, HOLD_POS)]:
    loc_key(cone_root, l, f)
for f, r in [(1, (0, 0, 0)), (106, (0, 0, 0)), (118, (-0.6, 0, 0)),
             (142, (-0.6, 0, 0)), (155, (0, 0, 0)), (288, (0, 0, 0))]:
    rot_key(cone_root, r, f)

# ---------------------------------------------------------------- camera: ONE continuous flight
cam_data = bpy.data.cameras.new('Camera')
cam_data.lens = 42
cam_data.clip_start = 0.05
cam_data.clip_end = 120
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 3.2
cam_data.dof.aperture_blades = 6
cam = bpy.data.objects.new('Camera', cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam
target = make_empty('CamTarget', (0, 0, 1.42))
con = cam.constraints.new('TRACK_TO')
con.target = target
con.track_axis = 'TRACK_NEGATIVE_Z'
con.up_axis = 'UP_Y'

# (frame, cam offset x/y from boy, cam z, target offset x/y, target z)
CAM_KEYS = [
    (1,   (0.35, 2.65), 1.78, (-0.05, 0.25), 1.34),
    (48,  (0.75, 2.20), 1.72, (0.00, 0.12), 1.40),
    (96,  (0.55, 1.75), 1.66, (0.00, 0.10), 1.45),
    (124, (0.52, 0.88), 1.58, (0.00, 0.15), 1.48),
    (152, (0.42, 0.74), 1.555, (0.00, 0.155), 1.495),
    (182, (0.08, 0.66), 1.545, (0.00, 0.16), 1.50),
    (215, (0.05, 0.58), 1.54, (0.00, 0.16), 1.50),
    (250, (0.05, 0.85), 1.58, (-0.02, 0.14), 1.48),
    (288, (-0.80, 0.90), 1.66, (-0.10, 0.10), 1.44),
]
for f, (ox, oy), cz, (tx, ty), tz in CAM_KEYS:
    bp = boypos(f)
    cam_loc = (bp.x + ox, bp.y + oy, cz)
    tgt_loc = (bp.x + tx, bp.y + ty, tz)
    loc_key(cam, cam_loc, f)
    loc_key(target, tgt_loc, f)
    cam_data.dof.focus_distance = (Vector(cam_loc) - Vector(tgt_loc)).length
    cam_data.dof.keyframe_insert(data_path='focus_distance', frame=f)
for f, v in [(1, 3.4), (96, 3.0), (124, 2.8), (182, 2.8), (215, 2.8),
             (250, 2.8), (288, 3.4)]:
    cam_data.dof.aperture_fstop = v
    cam_data.dof.keyframe_insert(data_path='aperture_fstop', frame=f)

# ---------------------------------------------------------------- save PACKED (GPU-lane artifact)
scene.render.filepath = os.path.join(SCRIPT_DIR, 'frames', 'f_')
os.makedirs(os.path.join(SCRIPT_DIR, 'frames'), exist_ok=True)
out = os.path.join(SCRIPT_DIR, 'demo_scene.blend')
bpy.ops.wm.save_as_mainfile(filepath=out)
try:
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=out)
    print('PACKED_OK')
except Exception as e:
    print('PACK_FAILED', e)
print('DEMO_BUILD_DONE', out, 'objects:', len(bpy.data.objects))
