# human_gen.py — realistic human generation via MPFB2 (MakeHuman) inside Blender.
# Used by build_scene.py (Brain Freeze v2). Deterministic: fixed phenotype,
# fixed asset set, fixed pose math. Requires MPFB extension enabled and the
# makehuman_system_assets pack present in MPFB's user data dir.
#
# Native MPFB space (MEASURED on the generated figure, test_human.py):
#   faces -Y (nose tip y=-0.176), up +Z, his RIGHT side at -X, LEFT at +X.
# Bone names are the game_engine rig's exact names (thigh_l, calf_r, ...).
import bpy, math, importlib, sys
from mathutils import Vector, Matrix

def _dyn(absolute_package_str, key):
    for amod in sys.modules:
        if amod.endswith(absolute_package_str):
            mod = importlib.import_module(amod)
            if hasattr(mod, key):
                return getattr(mod, key)
    raise ValueError("MPFB module not found: " + absolute_package_str)

MACRO = {
    "gender": 1.0,        # 1.0 = male (macro.json: low=female, high=male; verified by proportions/height)
    "age": 0.52,          # just past the "young" knot (0.5) = young adult, minimal aging
    "muscle": 0.5,
    "weight": 0.5,
    "proportions": 0.5,
    "height": 0.5,
    "cupsize": 0.5,
    "firmness": 0.5,
    "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0},
}

# (asset_subdir, filename, asset_type) — added AFTER the rig so they skin to it
BODYPARTS = [
    ("eyes",      "high-poly.mhclo",   "Eyes"),
    ("eyebrows",  "eyebrow008.mhclo",  "Eyebrows"),
    ("eyelashes", "eyelashes01.mhclo", "Eyelashes"),
    ("teeth",     "teeth_base.mhclo",  "Teeth"),
    ("tongue",    "tongue01.mhclo",    "Tongue"),
]
HAIR = ("hair", "short01.mhclo", "Hair")
CLOTHES = [
    ("clothes", "male_casualsuit05.mhclo", "Clothes"),
    ("clothes", "shoes01.mhclo",           "Clothes"),
]
SKIN_FILE = "young_caucasian_male.mhmat"

# relaxed stance directions, armature space (forward = -Y, up = +Z)
RELAXED = {
    "upperarm_l": (0.30, -0.05, -0.95),
    "upperarm_r": (-0.30, -0.05, -0.95),
    "lowerarm_l": (0.16, -0.22, -0.96),
    "lowerarm_r": (-0.16, -0.22, -0.96),
    "thigh_l": (0.0, -0.02, -1.0),
    "thigh_r": (0.0, -0.02, -1.0),
    "calf_l": (0.0, -0.05, -1.0),
    "calf_r": (0.0, -0.05, -1.0),
    "foot_l": (0.0, -0.97, -0.24),
    "foot_r": (0.0, -0.97, -0.24),
}
# right arm holds the ice-cream cone up at chest height (constant while walking)
HOLD = {
    "upperarm_r": (-0.38, -0.30, -0.86),
    "lowerarm_r": (-0.06, -0.62, 0.72),
}


def aim_pose_bone(arm, pb, target_dir):
    """Rotate pose bone pb (armature space) so its head->tail direction becomes
    target_dir. rotation_difference gives the shortest arc — no sign guessing."""
    bpy.context.view_layer.update()
    head = pb.head.copy()
    cur = pb.tail - pb.head
    if cur.length < 1e-6:
        return
    cur.normalize()
    delta = cur.rotation_difference(Vector(target_dir).normalized())
    m = Matrix.Translation(head) @ delta.to_matrix().to_4x4() @ Matrix.Translation(-head) @ pb.matrix
    pb.matrix = m
    bpy.context.view_layer.update()


def _key_bone(arm, name, frame):
    pb = arm.pose.bones[name]
    pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)
    pb.keyframe_insert(data_path="location", frame=frame)


def aim_and_key(arm, name, target_dir, frame):
    aim_pose_bone(arm, arm.pose.bones[name], target_dir)
    _key_bone(arm, name, frame)


def build_human():
    """Generate the character. Returns (root_empty, info_dict).
    Unscaled, native orientation (faces -Y), origin near feet.
    Caller grounds/scales/rotates the root."""
    HumanService = _dyn("mpfb.services.humanservice", "HumanService")
    AssetService = _dyn("mpfb.services.assetservice", "AssetService")

    basemesh = HumanService.create_human(macro_detail_dict=dict(MACRO, race=dict(MACRO["race"])))
    basemesh.name = "HumanBody"

    rig = HumanService.add_builtin_rig(basemesh, "game_engine")
    assert rig is not None, "MPFB rig creation failed"
    rig.name = "HumanRig"
    # CRITICAL: pose bones default to XYZ euler mode, in which case
    # rotation_quaternion keyframes are silently IGNORED and the pose freezes
    # at whatever pb.matrix last held (bit the first walk test: legs locked in
    # one stride at every frame). All posing here keys quaternions.
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'

    skin_path = AssetService.find_asset_absolute_path(SKIN_FILE, asset_subdir="skins")
    assert skin_path, "skin not found: " + SKIN_FILE
    HumanService.set_character_skin(skin_path, basemesh)  # default ENHANCED_SSS

    fitted = []
    for subdir, fname, atype in BODYPARTS + [HAIR] + CLOTHES:
        path = AssetService.find_asset_absolute_path(fname, asset_subdir=subdir)
        assert path, f"asset not found: {subdir}/{fname}"
        obj = HumanService.add_mhclo_asset(path, basemesh, asset_type=atype)
        fitted.append((fname, obj.name if obj else None))

    # ---- measurements over the WHOLE hierarchy (shoes/hair included)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    all_verts = []
    for ob in bpy.data.objects:
        if ob.type == 'MESH' and (ob.parent == rig or ob == basemesh):
            ev = ob.evaluated_get(deps)
            all_verts += [ev.matrix_world @ v.co for v in ev.data.vertices]
    zmin = min(v.z for v in all_verts); zmax = max(v.z for v in all_verts)
    xmin = min(v.x for v in all_verts); xmax = max(v.x for v in all_verts)
    # nose/mouth from the basemesh head region (MiVic method)
    ev = basemesh.evaluated_get(deps)
    bverts = [ev.matrix_world @ v.co for v in ev.data.vertices]
    head_bone = rig.pose.bones["head"]
    head_pos = rig.matrix_world @ head_bone.head
    near = [v for v in bverts if (v - head_pos).length < 0.16]
    nose = min(near, key=lambda v: v.y)
    mouth = nose + Vector((0.0, 0.014, -0.030))  # 30 mm below, 14 mm behind nose tip
    thigh_head_z = (rig.matrix_world @ rig.pose.bones["thigh_l"].head).z
    foot_head_z = (rig.matrix_world @ rig.pose.bones["foot_l"].head).z
    info = {
        "span": zmax - zmin, "zmin": zmin, "zmax": zmax,
        "xmin": xmin, "xmax": xmax,
        "nose": tuple(nose), "mouth": tuple(mouth),
        "head_bone": tuple(head_pos),
        "leg_len": thigh_head_z - foot_head_z,
        "fitted": fitted, "rig": rig.name,
        "basemesh_verts": len(basemesh.data.vertices),
        "total_verts": sum(len(o.data.vertices) for o in bpy.data.objects if o.type == 'MESH'),
    }

    # ---- relaxed stance (exact bone names), keyframed at frame 1
    for name, d in RELAXED.items():
        aim_and_key(rig, name, Vector(d), 1)
    info["pose_applied"] = True

    # ---- group everything under one root empty
    root = bpy.data.objects.new("HumanRootGen", None)
    bpy.context.collection.objects.link(root)
    top = basemesh
    while top.parent is not None:
        top = top.parent
    top.parent = root
    info["top_object"] = top.name
    return root, info


def _dir(alpha, sx=0.0):
    """Direction in the sagittal plane: alpha>0 swings toward forward (-Y)."""
    return Vector((sx, -math.sin(alpha), -math.cos(alpha)))


def gait_pose(arm, phase, env, swing_amp, hold_right=True):
    """Aim all gait bones for one keyframe. phase: radians (leg L angle =
    swing_amp*sin(phase)); env: 0..1 amplitude envelope. Caller must
    frame_set() BEFORE calling and keyframe_insert happens inside."""
    a_l = swing_amp * math.sin(phase) * env
    a_r = swing_amp * math.sin(phase + math.pi) * env
    for side, a, ph in (("l", a_l, phase), ("r", a_r, phase + math.pi)):
        aim_pose_bone(arm, arm.pose.bones[f"thigh_{side}"], _dir(a, 0.0))
        bump = max(0.0, math.cos(ph - 0.55)) ** 1.3
        flex = (0.07 + 0.60 * bump + 0.35 * max(0.0, -math.sin(ph))) * env + 0.03
        aim_pose_bone(arm, arm.pose.bones[f"calf_{side}"], _dir(a - flex, 0.0))
        fa = 1.10 - 0.42 * math.sin(ph + 0.7) * env - 0.18 * (1 - env)
        aim_pose_bone(arm, arm.pose.bones[f"foot_{side}"], _dir(fa, 0.0))
    # left arm counter-swings against the left leg; right arm holds the cone
    swing = -0.34 * math.sin(phase + math.pi) * env
    aim_pose_bone(arm, arm.pose.bones["upperarm_l"],
                  Vector((0.30, -0.05 + swing, -0.95)))
    aim_pose_bone(arm, arm.pose.bones["lowerarm_l"],
                  Vector((0.16, -0.22 + 0.5 * swing, -0.96)))
    if hold_right:
        aim_pose_bone(arm, arm.pose.bones["upperarm_r"], Vector(HOLD["upperarm_r"]))
        aim_pose_bone(arm, arm.pose.bones["lowerarm_r"], Vector(HOLD["lowerarm_r"]))


def gait_key(arm, frame):
    for name in ("thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r",
                 "upperarm_l", "lowerarm_l", "upperarm_r", "lowerarm_r"):
        _key_bone(arm, name, frame)


def stance_key(arm, frame, hold_right=True):
    """Neutral standing pose keyframe (legs straight, left arm relaxed,
    right arm still holding the cone)."""
    for name, d in RELAXED.items():
        if hold_right and name in HOLD:
            aim_and_key(arm, name, Vector(HOLD[name]), frame)
        else:
            aim_and_key(arm, name, Vector(d), frame)
