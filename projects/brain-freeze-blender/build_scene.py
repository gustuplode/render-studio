# Brain Freeze — Blender scene builder (deterministic, no handlers)
# Builds the ENTIRE animated scene from scratch and saves scene.blend next to this script.
# All animation = real keyframes/f-curves. CLI range render must work:
#   blender -b scene.blend -o frames/f_#### -s A -e B -a
# Timeline: 24 fps, frames 1..816 (33.962 s voice). Beats (phrase segments):
#  B1 1-112 hook/exterior+bite | B2 113-223 throat | B3 224-316 SPG nerve
#  B4 317-478 brain+artery swell/throb | B5 479-572 trigeminal | B6 573-686 pain peak
#  B7 687-816 payoff/pull-out/settle
import bpy, os, math, random
from mathutils import Vector

FPS = 24
TOTAL = 816
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
random.seed(42)

def F(t):  # seconds -> frame (1-based)
    return int(round(t * FPS)) + 1

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- helpers
def key(obj, path, frame, group=None):
    if group:
        obj.keyframe_insert(data_path=path, frame=frame, group=group)
    else:
        obj.keyframe_insert(data_path=path, frame=frame)

def set_key(obj, path, value, frame):
    setattr(obj, path, value) if not isinstance(value, (tuple, list)) else None
    if isinstance(value, (tuple, list)):
        for i, v in enumerate(value):
            obj.path_resolve(path)  # noqa
        # vector-style assignment
        attr = getattr(obj, path)
        for i, v in enumerate(value):
            attr[i] = v
    key(obj, path, frame)

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
               sss_radius=(1.0, 0.35, 0.2), emission=None, emission_strength=0.0,
               alpha=1.0, noise_bump=0.0, noise_scale=5.0, color_variation=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = sss
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = sss_radius
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        mat.surface_render_method = 'DITHERED' if hasattr(mat, 'surface_render_method') else mat.blend_method
    if emission is not None and 'Emission Color' in bsdf.inputs:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    if noise_bump > 0 or color_variation > 0:
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = noise_scale
        tex.inputs['Detail'].default_value = 6.0
        tex.inputs['Roughness'].default_value = 0.8
        if noise_bump > 0:
            bump = nt.nodes.new('ShaderNodeBump')
            bump.inputs['Strength'].default_value = noise_bump
            bump.inputs['Distance'].default_value = 0.25
            nt.links.new(tex.outputs['Fac'], bump.inputs['Height'])
            nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
        if color_variation > 0:
            ramp = nt.nodes.new('ShaderNodeValToRGB')
            ramp.color_ramp.elements[0].position = 0.35
            ramp.color_ramp.elements[0].color = tuple(max(0.0, c * (1 - color_variation)) for c in color) + (1.0,)
            ramp.color_ramp.elements[1].position = 0.75
            ramp.color_ramp.elements[1].color = tuple(min(1.0, c * (1 + color_variation)) for c in color) + (1.0,)
            nt.links.new(tex.outputs['Fac'], ramp.inputs['Fac'])
            nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    return mat

def inp(mat):
    return mat.node_tree.nodes.get('Principled BSDF').inputs

def key_input(node_input, value, frame):
    node_input.default_value = value
    node_input.keyframe_insert(data_path='default_value', frame=frame)

def make_empty(name, loc):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    bpy.context.collection.objects.link(e)
    return e

def curve_obj(name, points, bevel, mat, taper=None):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_mode = 'ROUND'
    cu.bevel_depth = bevel
    cu.bevel_resolution = 4
    spl = cu.splines.new('BEZIER')
    spl.bezier_points.add(len(points) - 1)
    for bp, co in zip(spl.bezier_points, points):
        bp.co = co
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    if mat:
        cu.materials.append(mat)
    return ob

# ---------------------------------------------------------------- render settings
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
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
try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'Medium Contrast'
except Exception:
    scene.view_settings.view_transform = 'Filmic'

# world: Nishita sky
world = bpy.data.worlds.new('World')
scene.world = world
world.use_nodes = True
wnt = world.node_tree
# Studio look (Zack-D style seamless backdrop): NO sky-texture sun - the
# Nishita sun disc blew the whole exterior to clipped white once the backdrop
# stopped shading the set (stills2/stills3). Area lights do the modelling.
bg = wnt.nodes.get('Background')
bg.inputs['Color'].default_value = (0.42, 0.66, 0.92, 1.0)
bg.inputs['Strength'].default_value = 0.55


def make_open_tube(name, radius, depth, location, mat):
    """Open-ended cylinder with axis along X (caps deleted via bmesh)."""
    import bmesh
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth,
                                        location=location, rotation=(0, math.radians(90), 0))
    ob = bpy.context.object
    ob.name = name
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    caps = [f for f in bm.faces if abs(f.normal.z) > 0.99]
    bmesh.ops.delete(bm, geom=caps, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()
    if mat:
        ob.data.materials.append(mat)
    return ob

# ---------------------------------------------------------------- exterior set
ground_mat = principled('GroundMat', (0.52, 0.76, 0.92), roughness=0.95)
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=16, fill_type='NGON', location=(0, 0, 0))
ground = bpy.context.object
ground.name = 'Ground'
ground.data.materials.append(ground_mat)

# backdrop with vertical gradient (pale cyan)
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

# interior backdrop (dark maroon wall behind brain, faces -X)
dark_mat = principled('InteriorDark', (0.10, 0.02, 0.03), roughness=1.0)
bpy.ops.mesh.primitive_plane_add(size=10, location=(11.6, 0, 1.5), rotation=(0, math.radians(90), 0))
ibd = bpy.context.object
ibd.name = 'InteriorBackdrop'
ibd.data.materials.append(dark_mat)

# ---------------------------------------------------------------- lights
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

def point_light(name, loc, energy, color, radius=0.25):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = energy
    ld.color = color
    ld.shadow_soft_size = radius
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
throat_light1 = point_light('ThroatLight1', (3.6, 0, 1.5), 0.0, (1.0, 0.45, 0.4), 0.4)
throat_light2 = point_light('ThroatLight2', (5.8, 0, 1.55), 0.0, (1.0, 0.5, 0.45), 0.4)
brain_light = point_light('BrainLight', (9.6, 2.7, 3.4), 0.0, (1.0, 0.78, 0.78), 0.6)
pulse_light = point_light('PulseLight', (9.6, 0.45, 1.55), 0.0, (1.0, 0.15, 0.1), 0.5)
for L, keys_ in [
    (throat_light1, [(1, 0.0), (112, 0.0), (150, 10.0), (686, 10.0), (760, 5.0), (816, 0.0)]),
    (throat_light2, [(1, 0.0), (150, 0.0), (200, 9.0), (686, 9.0), (740, 0.0)]),
    (brain_light, [(1, 0.0), (270, 0.0), (330, 60.0), (686, 60.0), (760, 30.0), (816, 14.0)]),
]:
    for f, e in keys_:
        L.data.energy = e
        L.data.keyframe_insert(data_path='energy', frame=f)
# pain pulse light: strong throbbing in beat 6
pl_keys = [(1, 0.0), (478, 0.0), (520, 5.0)]
t = 573
while t < 686:
    pl_keys += [(t, 16.0), (t + 6, 3.0)]
    t += 12
pl_keys += [(700, 4.0), (760, 0.0), (816, 0.0)]
for f, e in pl_keys:
    pulse_light.data.energy = e
    pulse_light.data.keyframe_insert(data_path='energy', frame=f)

# ---------------------------------------------------------------- the boy
CANDIDATES = [
    os.path.join(SCRIPT_DIR, 'patient.glb'),
    os.path.join(SCRIPT_DIR, 'patient-plain.glb'),
    '/home/hatch/workspace/zackd-brain-freeze-blender/patient-plain.glb',
    '/home/hatch/workspace/zackd-brain-freeze/3d/assets/patient-opt.glb',
]
glb_path = next((p for p in CANDIDATES if os.path.exists(p)), None)
assert glb_path, 'patient GLB not found in any candidate path'
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=glb_path)
boy_meshes = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
assert boy_meshes, 'no mesh imported from GLB'
boy = boy_meshes[0]
boy.name = 'Boy'
for extra in boy_meshes[1:]:
    extra.name = 'BoyPart'

# --- face direction detection (nose protrusion in head band, world space)
# MEASURED 2026-11-11 by two-sided test renders (face_minusY.png shows eyes/nose/mouth;
# face_plusY.png shows the back of the head): the model's face is at -Y.
# (A nose-protrusion heuristic was tried first and got it WRONG - hair mass won.)
face_is_plus_y = False
print('BOY face_is_plus_y =', face_is_plus_y)

boy_root = make_empty('BoyRoot', (0, 0, 0))
boy.parent = boy_root
if not face_is_plus_y:
    # Flip the GEOMETRY DATA itself. Root-level euler flip (round 1) was wiped
    # by the lean keyframes; mesh-level euler flip (round 2) was a NO-OP because
    # the glTF importer sets this object's rotation_mode='QUATERNION' with an
    # identity quaternion, so rotation_euler writes are ignored (verified in the
    # saved blend: rot_euler z=pi but evaluated basis unchanged, face still -Y).
    # A geometry transform cannot be overridden by any of that.
    from mathutils import Matrix
    _flip = Matrix.Rotation(math.pi, 4, 'Z')
    for m in boy_meshes:
        m.data.transform(_flip)
        m.data.update()

# --- material rebuild: keep the 2048px atlas textures (real detail), add SSS + sheen feel
for mesh in boy_meshes:
    for slot in mesh.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        if not bsdf:
            continue
        if 'Subsurface Weight' in bsdf.inputs:
            bsdf.inputs['Subsurface Weight'].default_value = 0.22
        if 'Subsurface Radius' in bsdf.inputs:
            bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.38, 0.22)
        if 'Specular IOR Level' in bsdf.inputs:
            bsdf.inputs['Specular IOR Level'].default_value = 0.35
        # the atlas already feeds Roughness via an ORM split; leave textures untouched

# --- boy life: breathing (scale) + subtle lean + pain micro-shake in beat 6
for f, s in [(1, 1.0), (60, 1.004), (112, 1.0), (300, 1.004), (478, 1.0),
             (600, 1.004), (686, 1.0), (760, 1.003), (816, 1.0)]:
    scale_key(boy_root, (s, s, 1.0 + (s - 1.0) * 1.6), f)
lean = [(1, (0, 0, 0)), (80, (0.012, 0, 0.006)), (112, (0.03, 0, 0)),
        (478, (0.01, 0, 0)), (573, (0.035, 0, 0.004))]
tt = 585
while tt < 680:
    lean += [(tt, (0.045, 0.006, 0)), (tt + 4, (0.028, -0.005, 0))]
    tt += 9
lean += [(700, (0.012, 0, 0)), (816, (0, 0, 0))]
for f, r in sorted(lean):
    rot_key(boy_root, r, f)

# ---------------------------------------------------------------- table + bowl + scoops
ceramic = principled('Ceramic', (0.96, 0.97, 0.98), roughness=0.22, sss=0.1)
table_mat = principled('TableMat', (0.92, 0.94, 0.96), roughness=0.35)
bpy.ops.mesh.primitive_cylinder_add(radius=0.52, depth=0.05, location=(-0.58, 0.78, 0.93))
table_top = bpy.context.object; table_top.name = 'TableTop'
table_top.data.materials.append(table_mat)
bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=0.93, location=(-0.58, 0.78, 0.465))
table_leg = bpy.context.object; table_leg.name = 'TableLeg'
table_leg.data.materials.append(table_mat)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.27, location=(-0.58, 0.78, 0.99))
bowl = bpy.context.object; bowl.name = 'Bowl'
bowl.scale = (1, 1, 0.55)
bowl.data.materials.append(ceramic)
scoop_cols = [(0.98, 0.62, 0.72), (0.62, 0.9, 0.72), (0.99, 0.93, 0.8)]
scoop_pos = [(-0.48, 0.70, 1.10), (-0.69, 0.82, 1.11), (-0.57, 0.90, 1.08)]
for i, (c, p) in enumerate(zip(scoop_cols, scoop_pos)):
    sm = principled(f'Scoop{i}', c, roughness=0.35, sss=0.45)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.115, location=p)
    sc = bpy.context.object; sc.name = f'Scoop{i}'
    sc.data.materials.append(sm)

# spoon (animated): handle = thin box, bowl = flattened sphere, grouped under SpoonRoot
metal = principled('SpoonMetal', (0.9, 0.92, 0.95), roughness=0.25, metallic=1.0)
spoon_root = make_empty('SpoonRoot', (-0.58, 0.78, 1.22))
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.16, 0.005))
handle = bpy.context.object; handle.name = 'SpoonHandle'
handle.scale = (0.016, 0.17, 0.006)
bpy.ops.object.transform_apply(scale=True)
handle.data.materials.append(metal)
handle.parent = spoon_root
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, location=(0, 0.05, 0))
sbowl = bpy.context.object; sbowl.name = 'SpoonBowl'
sbowl.scale = (0.75, 1.1, 0.32)
bpy.ops.object.transform_apply(scale=True)
sbowl.data.materials.append(metal)
sbowl.parent = spoon_root
# dollop riding the spoon for beat 1
dollop_mat = principled('Dollop', (0.98, 0.66, 0.76), roughness=0.3, sss=0.5)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(0, 0.05, 0.022))
dollop = bpy.context.object; dollop.name = 'Dollop'
dollop.scale = (0.85, 1.0, 0.62)
bpy.ops.object.transform_apply(scale=True)
dollop.data.materials.append(dollop_mat)
dollop.parent = spoon_root
# spoon path: bowl -> mouth (mouth at approx (0, 0.17, 1.45)); beat 1 ends with the bite
spoon_keys = [
    (1,   (-0.58, 0.78, 1.22), (0.5, 0, 0)),
    (40,  (-0.52, 0.76, 1.30), (0.42, 0, 0)),
    (70,  (-0.28, 0.60, 1.42), (0.25, 0, 0)),
    (95,  (-0.08, 0.34, 1.47), (0.08, 0, 0)),
    (108, (0.03, 0.235, 1.455), (0.0, 0, 0)),
    (112, (0.02, 0.225, 1.452), (0.0, 0, 0)),
    (126, (-0.14, 0.42, 1.30), (-0.3, 0, 0)),
    (150, (-0.30, 0.66, 1.10), (-0.5, 0, 0)),
    (200, (-0.40, 0.76, 1.05), (-0.5, 0, 0)),
]
for f, l, r in spoon_keys:
    spoon_root.location = l
    spoon_root.rotation_euler = r
    key(spoon_root, 'location', f); key(spoon_root, 'rotation_euler', f)
# dollop is eaten: shrink to nothing at the bite, stay gone
for f, s in [(1, 1.0), (108, 1.0), (118, 0.25), (126, 0.001), (816, 0.001)]:
    scale_key(dollop, s, f)

# forehead glow disc (pain referred to the forehead; appears beat 5-6, fades in payoff)
glow_mat = principled('ForeheadGlow', (1.0, 0.35, 0.2), roughness=0.6,
                      emission=(1.0, 0.25, 0.12), emission_strength=0.0)
_gy = 0.148  # face is at +Y after the geometry flip
bpy.ops.mesh.primitive_circle_add(vertices=24, radius=0.06, fill_type='NGON',
                                  location=(0, _gy, 1.555), rotation=(math.radians(90), 0, 0))
glow = bpy.context.object; glow.name = 'ForeheadGlow'
glow.data.materials.append(glow_mat)
glow.parent = boy_root
gi = inp(glow_mat)['Emission Strength']
for f, e in [(1, 0.0), (478, 0.0), (530, 1.4), (600, 2.6), (686, 2.2), (730, 0.8), (790, 0.0), (816, 0.0)]:
    key_input(gi, e, f)
# the disc must be INVISIBLE until the pain is referred to the forehead:
# v-stills3 showed it as an opaque peach mask over the face from frame 1
try:
    glow_mat.surface_render_method = 'BLENDED'
except Exception:
    pass
ga = inp(glow_mat)['Alpha']
for f, a in [(1, 0.0), (478, 0.0), (530, 0.55), (686, 0.55), (750, 0.0), (816, 0.0)]:
    key_input(ga, a, f)

# ---------------------------------------------------------------- throat interior
tissue = principled('ThroatTissue', (0.42, 0.10, 0.11), roughness=0.5, sss=0.55, sss_radius=(0.35, 0.12, 0.08),
                     noise_bump=0.35, noise_scale=5.0, color_variation=0.18)
throat = make_open_tube('ThroatTube', 0.55, 5.4, (4.9, 0, 1.5), tissue)
ring_mat = principled('MuscleRing', (0.62, 0.22, 0.24), roughness=0.45, sss=0.6, sss_radius=(0.3, 0.1, 0.07),
                      noise_bump=0.2, noise_scale=7.0)
rings = []
for i in range(6):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.47, minor_radius=0.075,
                                     major_segments=32, minor_segments=12,
                                     location=(2.75 + i * 0.82, 0, 1.5),
                                     rotation=(0, math.radians(90), 0))
    r = bpy.context.object; r.name = f'ThroatRing{i}'
    r.data.materials.append(ring_mat)
    rings.append(r)
    # gentle peristalsis pulse travelling down the tube during beats 2-4
    f0 = 118 + i * 9
    while f0 < 470:
        scale_key(r, (1.0, 0.90, 0.90), f0)
        scale_key(r, (1.0, 1.0, 1.0), f0 + 14)
        f0 += 55

# palate disc at the throat entrance (top) — colour keyframed: pink -> frost -> warm
palate_mat = principled('Palate', (0.72, 0.36, 0.36), roughness=0.5, sss=0.5)
bpy.ops.mesh.primitive_circle_add(vertices=32, radius=0.34, fill_type='NGON',
                                  location=(2.5, 0, 1.93))
palate = bpy.context.object; palate.name = 'PalateDisc'
palate.data.materials.append(palate_mat)
pb = inp(palate_mat)['Base Color']
for f, c in [(1, (0.72, 0.36, 0.36, 1)), (130, (0.72, 0.36, 0.36, 1)),
             (200, (0.78, 0.87, 1.0, 1)), (640, (0.78, 0.87, 1.0, 1)),
             (730, (1.0, 0.62, 0.34, 1)), (816, (0.98, 0.55, 0.30, 1))]:
    key_input(pb, c, f)
pr = inp(palate_mat)['Roughness']
for f, v in [(1, 0.5), (200, 0.16), (640, 0.16), (760, 0.45), (816, 0.45)]:
    key_input(pr, v, f)

# the bite: frosted sphere travelling mouth -> throat -> SPG, then dissolves
bite_mat = principled('Bite', (0.88, 0.94, 1.0), roughness=0.15, sss=0.65,
                      sss_radius=(0.6, 0.8, 1.0))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, location=(0.02, 0.10, 1.45))
bite = bpy.context.object; bite.name = 'Bite'
bite.data.materials.append(bite_mat)
bite_keys = [
    (108, (0.02, 0.10, 1.45)), (126, (0.55, 0.03, 1.48)), (155, (1.5, 0.0, 1.5)),
    (185, (2.6, 0.0, 1.5)), (223, (4.3, 0.0, 1.5)), (255, (5.6, 0.0, 1.5)),
    (285, (6.6, 0.02, 1.53)), (305, (7.05, 0.03, 1.56)),
]
for f, l in bite_keys:
    loc_key(bite, l, f)
for f, s in [(1, 0.001), (100, 0.001), (108, 0.7), (126, 1.0), (290, 1.0), (312, 0.35), (320, 0.001), (816, 0.001)]:
    scale_key(bite, s, f)

# cold mist burst at the bite moment (18 instanced spheres, deterministic)
mist_mat = principled('Mist', (0.9, 0.96, 1.0), roughness=0.9, alpha=0.55)
for i in range(18):
    ang = (i / 18.0) * math.tau + random.uniform(-0.2, 0.2)
    dist = random.uniform(0.10, 0.30)
    dx, dy, dz = math.cos(ang) * dist * 0.6, math.sin(ang) * dist, random.uniform(-0.05, 0.16)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.02, 0.045),
                                         location=(0.02, 0.20, 1.46))
    m = bpy.context.object; m.name = f'Mist{i}'
    m.data.materials.append(mist_mat)
    loc_key(m, (0.02, 0.20, 1.46), 104)
    scale_key(m, 0.001, 104)
    loc_key(m, (0.02 + dx, 0.20 + dy, 1.46 + dz), 122)
    scale_key(m, 1.0, 118)
    loc_key(m, (0.02 + dx * 1.7, 0.20 + dy * 1.7, 1.46 + dz * 1.6 + 0.05), 145)
    scale_key(m, 0.001, 145)

# ---------------------------------------------------------------- SPG nerve (beat 3)
nerve_mat = principled('NerveGreen', (0.10, 0.5, 0.18), roughness=0.4,
                       emission=(0.25, 1.0, 0.4), emission_strength=1.1)
spg_main = curve_obj('SPGNerve', [(6.95, 0, 1.55), (7.45, 0.08, 1.66), (7.95, 0.05, 1.60),
                                  (8.45, 0.1, 1.55), (8.85, 0.15, 1.52)], 0.045, nerve_mat)
branch_pts = [
    [(7.3, 0.05, 1.62), (7.5, 0.3, 1.85), (7.62, 0.5, 1.98)],
    [(7.45, 0.06, 1.64), (7.62, -0.25, 1.9), (7.7, -0.42, 2.02)],
    [(7.6, 0.05, 1.62), (7.85, 0.22, 1.38), (7.95, 0.38, 1.26)],
    [(7.35, 0.04, 1.6), (7.5, -0.2, 1.35), (7.6, -0.35, 1.22)],
]
for i, pts in enumerate(branch_pts):
    curve_obj(f'SPGBranch{i}', pts, 0.02, nerve_mat)
ne = inp(nerve_mat)['Emission Strength']
for f, e in [(1, 1.1), (240, 1.1), (262, 2.8), (290, 1.6), (316, 2.6), (360, 1.2), (816, 1.2)]:
    key_input(ne, e, f)
# pulse sphere travelling the SPG nerve
pulse_mat = principled('PulseBall', (0.5, 1.0, 0.6), roughness=0.3,
                       emission=(0.35, 1.0, 0.45), emission_strength=4.0)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(6.95, 0, 1.55))
spg_pulse = bpy.context.object; spg_pulse.name = 'SPGPulse'
spg_pulse.data.materials.append(pulse_mat)
spg_travel = [(224, (6.95, 0, 1.55)), (248, (7.45, 0.08, 1.66)), (272, (7.95, 0.05, 1.60)),
              (296, (8.45, 0.1, 1.55)), (316, (8.85, 0.15, 1.52))]
for f, l in spg_travel:
    loc_key(spg_pulse, l, f)
for f, s in [(1, 0.001), (220, 0.001), (230, 1.0), (310, 1.0), (322, 0.001), (816, 0.001)]:
    scale_key(spg_pulse, s, f)

# ---------------------------------------------------------------- brain chamber (beat 4-6)
BC = Vector((9.6, 0, 1.55))
brain_mat = principled('Brain', (0.72, 0.30, 0.30), roughness=0.58, sss=0.3, sss_radius=(0.25, 0.08, 0.05),
                        noise_bump=0.3, noise_scale=3.2, color_variation=0.12)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=0.78, location=tuple(BC))
brain = bpy.context.object; brain.name = 'Brain'
brain.scale = (0.92, 1.0, 0.86)
bpy.ops.object.transform_apply(scale=True)
brain.data.materials.append(brain_mat)
# procedural displacement for gyri (real geometry detail, deterministic clouds texture)
dtex = bpy.data.textures.new('BrainDisplace', type='CLOUDS')
dtex.noise_scale = 0.18
dtex.noise_depth = 3
disp = brain.modifiers.new('Gyri', 'DISPLACE')
disp.texture = dtex
disp.strength = 0.09
disp.mid_level = 0.5
# brain throb: gentle scale pulse, strongest in beats 4-6
throb = [(316, 1.0)]
tt = 330
while tt < 690:
    amp = 0.016 if tt < 573 else 0.024
    throb += [(tt, 1.0 + amp), (tt + 7, 1.0)]
    tt += 14
throb += [(720, 1.0), (816, 1.0)]
for f, s in sorted(throb):
    scale_key(brain, s, f)

# translucent skull shell
skull_mat = principled('Skull', (0.90, 0.94, 1.0), roughness=0.15, alpha=0.09)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=0.99, location=tuple(BC))
skull = bpy.context.object; skull.name = 'SkullShell'
skull.scale = (0.94, 1.02, 0.9)
bpy.ops.object.transform_apply(scale=True)
skull.data.materials.append(skull_mat)
inp(skull_mat)['Specular IOR Level'].default_value = 0.25

# anterior cerebral artery: bevelled curve across the FRONT (+Y) of the brain
artery_mat = principled('Artery', (0.55, 0.045, 0.045), roughness=0.3, sss=0.35,
                         sss_radius=(0.06, 0.02, 0.015))
artery = curve_obj('Artery', [(8.92, 0.55, 1.18), (9.35, 0.78, 1.33), (9.68, 0.83, 1.58),
                              (9.98, 0.72, 1.72), (10.22, 0.48, 1.45)], 0.085, artery_mat)
# SWELL x1.5 via bevel_depth (13.18-17.31s), then THROB, peak in beat 6, release in payoff
bv = [(1, 0.085), (316, 0.085), (360, 0.105), (415, 0.128)]
tt = 422
while tt < 686:
    bv += [(tt, 0.134), (tt + 6, 0.124)]
    tt += 12
bv += [(700, 0.118), (745, 0.098), (790, 0.086), (816, 0.085)]
for f, v in sorted(bv):
    artery.data.bevel_depth = v
    artery.data.keyframe_insert(data_path='bevel_depth', frame=f)

# pressure rings inside the skull (scale-up + emissive fade cycles)
ring2_mat = principled('PressureRing', (1.0, 0.6, 0.55), roughness=0.4,
                        emission=(1.0, 0.3, 0.2), emission_strength=0.0)
for i in range(3):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.88, minor_radius=0.012,
                                     major_segments=48, minor_segments=8,
                                     location=tuple(BC), rotation=(0.3 * i, 0.5 * i, 0))
    pring = bpy.context.object; pring.name = f'PressureRing{i}'
    pring.data.materials.append(ring2_mat)
    cyc = 400 + i * 26
    while cyc < 690:
        scale_key(pring, 0.72, cyc)
        scale_key(pring, 1.04, cyc + 22)
        cyc += 46
    scale_key(pring, 0.9, 816)
pe = inp(ring2_mat)['Emission Strength']
for f, e in [(1, 0.0), (380, 0.0), (430, 1.6), (573, 2.4), (686, 1.8), (740, 0.3), (816, 0.0)]:
    key_input(pe, e, f)

# blood-cell cutaway: translucent artery segment in front of the brain + real flowing cells
glass_mat = principled('ArteryGlass', (0.85, 0.3, 0.28), roughness=0.1, alpha=0.32)
cut = make_open_tube('ArteryCutaway', 0.17, 1.15, (9.6, 1.02, 1.52), glass_mat)
cell_mat = principled('BloodCell', (0.62, 0.05, 0.05), roughness=0.25, sss=0.3)
NCELL = 22
for i in range(NCELL):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.052, location=(9.1, 1.02, 1.52))
    cell = bpy.context.object; cell.name = f'BloodCell{i}'
    cell.data.materials.append(cell_mat)
    cell.scale = (1.25, 0.55, 1.25)
    bpy.ops.object.transform_apply(scale=True)
    y0 = 1.02 + random.uniform(-0.075, 0.075)
    z0 = 1.52 + random.uniform(-0.075, 0.075)
    period = random.choice([44, 50, 56])
    off = (i / NCELL) * period
    f = 300
    while f < 800:
        u = ((f - 300 + off) % period) / period
        loc_key(cell, (9.08 + u * 1.04, y0, z0), f)
        f += 8
    for f2, sc in [(1, 0.001), (290, 0.001), (306, 1.0), (780, 1.0), (800, 0.001)]:
        scale_key(cell, sc, f2)

# ---------------------------------------------------------------- trigeminal nerve (beat 5)
tri_mat = principled('Trigeminal', (0.55, 0.42, 0.1), roughness=0.4,
                      emission=(1.0, 0.75, 0.25), emission_strength=0.7)
tri = curve_obj('TrigeminalNerve', [(2.6, 0.05, 1.86), (4.4, 0.35, 2.35), (6.4, 0.5, 2.6),
                                    (8.2, 0.55, 2.62), (9.3, 0.62, 2.42)], 0.028, tri_mat)
te = inp(tri_mat)['Emission Strength']
for f, e in [(1, 0.7), (470, 0.7), (520, 2.2), (620, 2.8), (686, 2.0), (750, 0.8), (816, 0.7)]:
    key_input(te, e, f)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(2.6, 0.05, 1.86))
tri_pulse = bpy.context.object; tri_pulse.name = 'TriPulse'
tri_pulse.data.materials.append(pulse_mat)
for f, l in [(479, (2.6, 0.05, 1.86)), (520, (4.4, 0.35, 2.35)), (548, (6.4, 0.5, 2.6)),
             (572, (8.2, 0.55, 2.62)), (600, (9.3, 0.62, 2.42))]:
    loc_key(tri_pulse, l, f)
for f, s in [(1, 0.001), (470, 0.001), (486, 1.0), (610, 1.0), (640, 0.001), (816, 0.001)]:
    scale_key(tri_pulse, s, f)

# ---------------------------------------------------------------- exterior dust motes
mote_mat = principled('Mote', (1.0, 0.98, 0.9), roughness=0.8,
                       emission=(1.0, 0.95, 0.8), emission_strength=0.2)
for i in range(26):
    x0 = random.uniform(-1.6, 1.8); y0 = random.uniform(0.4, 2.6); z0 = random.uniform(0.4, 2.4)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.004, 0.009), location=(x0, y0, z0))
    mo = bpy.context.object; mo.name = f'Mote{i}'
    mo.data.materials.append(mote_mat)
    f = 1
    cx, cy, cz = x0, y0, z0
    while f <= 816:
        loc_key(mo, (cx, cy, cz), f)
        cx += random.uniform(-0.07, 0.07); cy += random.uniform(-0.07, 0.07); cz += random.uniform(-0.05, 0.05)
        f += 120

# ---------------------------------------------------------------- camera (ONE continuous flight)
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

CAM_KEYS = [
    (1,   (0.30, 3.60, 1.60), (-0.10, 0, 1.42)),
    (60,  (0.15, 2.60, 1.58), (-0.06, 0.02, 1.46)),
    (112, (0.10, 1.02, 1.54), (0.02, 0.18, 1.50)),
    (150, (1.05, 0.30, 1.52), (2.60, 0, 1.50)),
    (223, (4.35, 0.12, 1.50), (6.20, 0, 1.52)),
    (270, (5.90, 0.30, 1.55), (7.45, 0.05, 1.62)),
    (316, (6.75, 0.55, 1.66), (8.60, 0.10, 1.55)),
    (380, (7.30, 2.30, 2.10), (9.60, 0.15, 1.50)),
    (478, (7.50, 2.40, 2.00), (9.60, 0.20, 1.48)),
    (572, (7.40, 2.30, 2.30), (9.45, 0.25, 1.62)),
    (686, (7.55, 2.35, 2.05), (9.60, 0.25, 1.50)),
    (740, (5.20, 0.70, 1.62), (2.00, 0.10, 1.50)),
    (790, (1.40, 1.90, 1.58), (0, 0, 1.45)),
    (816, (0.45, 3.30, 1.55), (0, 0, 1.42)),
]
for f, l, tg in CAM_KEYS:
    loc_key(cam, l, f)
    loc_key(target, tg, f)
    cam_data.dof.focus_distance = (Vector(l) - Vector(tg)).length
    cam_data.dof.keyframe_insert(data_path='focus_distance', frame=f)
# aperture: wider (shallower DOF) inside the body, deeper outside
for f, v in [(1, 3.4), (112, 2.4), (316, 2.2), (478, 2.6), (686, 2.8), (790, 3.4), (816, 3.6)]:
    cam_data.dof.aperture_fstop = v
    cam_data.dof.keyframe_insert(data_path='aperture_fstop', frame=f)

# linear interpolation for the small fast particles (cells/mist) so wraps read as flow
for ob in bpy.data.objects:
    if ob.name.startswith(('BloodCell', 'Mist')) and ob.animation_data and ob.animation_data.action:
        for fc in ob.animation_data.action.fcurves:
            if fc.data_path == 'location':
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'

scene.render.filepath = os.path.join(SCRIPT_DIR, 'frames', 'f_')
os.makedirs(os.path.join(SCRIPT_DIR, 'frames'), exist_ok=True)
out = os.path.join(SCRIPT_DIR, 'scene.blend')
bpy.ops.wm.save_as_mainfile(filepath=out)
print('SCENE_SAVED', out, 'objects:', len(bpy.data.objects))
