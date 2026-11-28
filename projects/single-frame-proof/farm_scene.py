# Farm scene — single frame proof render (Blender 4.2, Cycles, headless)
# Builds a small but complete farm diorama in code: barn + silo, farmer,
# crates with apples, chickens, fence, hay bales, trees, dirt path.
# Real geometry, real materials, sun light + sky, soft shadows, depth.
import bpy
import math
import os
from mathutils import Vector

# ---------------------------------------------------------------- setup
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
    pass  # keep data simple; default cube/camera/light are gone with objects

OUT = os.path.join(os.getcwd(), "out")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- materials
def mat(name, color, rough=0.85, metal=0.0, noise_mix=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if noise_mix:
        tex = m.node_tree.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = 6.0
        tex.inputs["Detail"].default_value = 4.0
        mix = m.node_tree.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 0.45
        mix.inputs[1].default_value = (*color, 1.0)
        mix.inputs[2].default_value = (*noise_mix, 1.0)
        m.node_tree.links.new(tex.outputs["Fac"], mix.inputs[0])
        m.node_tree.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    return m

GRASS   = mat("Grass",  (0.16, 0.38, 0.10), 1.0, noise_mix=(0.55, 0.75, 0.45))
DIRT    = mat("Dirt",   (0.42, 0.30, 0.17), 1.0, noise_mix=(0.8, 0.68, 0.5))
BARNRED = mat("BarnRed",(0.48, 0.10, 0.08), 0.8, noise_mix=(0.75, 0.45, 0.4))
ROOF    = mat("Roof",   (0.23, 0.20, 0.19), 0.6, metal=0.35)
WHITE   = mat("Trim",   (0.92, 0.90, 0.86), 0.7)
WOOD    = mat("Wood",   (0.45, 0.30, 0.16), 0.9, noise_mix=(0.7, 0.55, 0.4))
WOOD_D  = mat("WoodDark",(0.30, 0.19, 0.10), 0.9)
METAL   = mat("Silo",   (0.62, 0.64, 0.66), 0.35, metal=0.85)
SKIN    = mat("Skin",   (0.85, 0.60, 0.42), 0.65)
SHIRT   = mat("Shirt",  (0.55, 0.14, 0.10), 0.9, noise_mix=(0.8, 0.5, 0.45))
JEANS   = mat("Jeans",  (0.13, 0.20, 0.38), 0.95)
STRAW   = mat("Straw",  (0.85, 0.66, 0.30), 1.0, noise_mix=(0.9, 0.8, 0.55))
HAY     = mat("Hay",    (0.78, 0.60, 0.25), 1.0, noise_mix=(0.85, 0.75, 0.5))
FEATHER = mat("Feather",(0.93, 0.92, 0.90), 0.9)
FEATHER2= mat("FeatherBrown",(0.55, 0.36, 0.20), 0.9)
ORANGE  = mat("Beak",   (0.95, 0.55, 0.10), 0.7)
RED     = mat("Comb",   (0.75, 0.08, 0.08), 0.7)
APPLE   = mat("Apple",  (0.72, 0.08, 0.06), 0.35)
LEAF    = mat("Leaf",   (0.14, 0.34, 0.10), 0.95, noise_mix=(0.5, 0.7, 0.4))
TRUNK   = mat("Trunk",  (0.32, 0.21, 0.12), 1.0)
GLASS   = mat("Window", (0.85, 0.72, 0.40), 0.25)

# ---------------------------------------------------------------- helpers
def box(name, loc, scale, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if material: o.data.materials.append(material)
    return o

def cyl(name, loc, radius, depth, material, rot=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if material: o.data.materials.append(material)
    return o

def ball(name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if material: o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth = True
    return o

def cone(name, loc, r1, r2, depth, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if material: o.data.materials.append(material)
    return o

def prism(name, loc, width, length, z0, z1, material):
    """Triangular prism (barn roof): cross-section triangle in XZ, extruded along Y."""
    w = width / 2.0; l = length / 2.0
    verts = [(-w, -l, z0), (w, -l, z0), (0, -l, z1),
             (-w,  l, z0), (w,  l, z0), (0,  l, z1)]
    faces = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces); me.update()
    o = bpy.data.objects.new(name, me); o.location = loc
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    return o

# ---------------------------------------------------------------- ground & path
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
ground = bpy.context.active_object; ground.name = "Ground"
ground.data.materials.append(GRASS)
box("DirtPath", (0.6, -3.4, 0.02), (1.1, 4.6, 0.04), DIRT)   # path from camera to barn/farmer

# ---------------------------------------------------------------- barn + silo
barn = box("Barn", (-3.6, 3.2, 1.3), (2.1, 2.6, 1.3), BARNRED)
prism("BarnRoof", (-3.6, 3.2, 0), 5.0, 5.9, 2.45, 3.95, ROOF)
# gable triangles are the prism ends (roof material) — add red gable fill below roof line
prism("BarnGable", (-3.6, 3.2, 0), 4.2, 5.2, 2.45, 3.55, BARNRED)
# door + white X trim on the front face (facing -Y)
box("BarnDoor", (-3.6, 0.55, 0.95), (0.85, 0.06, 0.95), WOOD_D)
box("DoorTrimV", (-3.6, 0.47, 0.95), (0.07, 0.03, 0.95), WHITE)
box("DoorTrimD1", (-3.6, 0.46, 0.95), (0.06, 0.03, 1.25), WHITE, rot=(0.72, 0, 0))
box("DoorTrimD2", (-3.6, 0.46, 0.95), (0.06, 0.03, 1.25), WHITE, rot=(-0.72, 0, 0))
box("LoftWindow", (-3.6, 0.52, 2.75), (0.42, 0.05, 0.42), GLASS)
box("LoftFrame", (-3.6, 0.54, 2.75), (0.5, 0.03, 0.5), WHITE)
# silo
cyl("Silo", (-6.9, 4.4, 2.4), 0.95, 4.8, METAL)
ball("SiloTop", (-6.9, 4.4, 4.8), (0.98, 0.98, 0.6), METAL)

# ---------------------------------------------------------------- farmer (mid-ground hero)
F = (0.6, -0.6)  # farmer x, y
cyl("LegL", (F[0] - 0.14, F[1], 0.45), 0.085, 0.9, JEANS)
cyl("LegR", (F[0] + 0.14, F[1], 0.45), 0.085, 0.9, JEANS)
box("BootL", (F[0] - 0.14, F[1] - 0.05, 0.05), (0.10, 0.17, 0.05), WOOD_D)
box("BootR", (F[0] + 0.14, F[1] - 0.05, 0.05), (0.10, 0.17, 0.05), WOOD_D)
box("Torso", (F[0], F[1], 1.22), (0.30, 0.17, 0.34), SHIRT)
# left arm down holding crate handle side; right arm raised waving
cyl("ArmL", (F[0] - 0.42, F[1], 1.18), 0.065, 0.72, SHIRT, rot=(0, 0, 0.25))
cyl("ArmR", (F[0] + 0.47, F[1], 1.52), 0.065, 0.72, SHIRT, rot=(0, 0, -0.85))
ball("HandR", (F[0] + 0.68, F[1], 1.85), (0.075, 0.075, 0.075), SKIN)
ball("Head", (F[0], F[1], 1.78), (0.155, 0.145, 0.17), SKIN)
cyl("HatBrim", (F[0], F[1], 1.90), 0.27, 0.03, STRAW)
cyl("HatTop", (F[0], F[1], 2.0), 0.15, 0.17, STRAW)

# ---------------------------------------------------------------- crates + apples
def crate(cx, cy, cz, s=0.34):
    box("Crate", (cx, cy, cz + s), (s, s, s), WOOD)
    for dx, dz in ((-s, -s), (s, -s), (-s, s), (s, s)):
        box("CrateEdge", (cx + dx * 0.92, cy, cz + s + dz * 0.0), (0.045, s * 1.02, 0.045), WOOD_D) if False else None
    box("CrateSlatT", (cx, cy - s - 0.01, cz + s * 1.7), (s, 0.02, 0.07), WOOD_D)
    box("CrateSlatB", (cx, cy - s - 0.01, cz + s * 0.35), (s, 0.02, 0.07), WOOD_D)
crate(1.55, -0.75, 0.0)
crate(1.55, -0.75, 0.68)   # stacked second crate
crate(2.35, -0.35, 0.0)
# apples in the top crate
import random
random.seed(7)
for i in range(7):
    ax = 1.55 + random.uniform(-0.18, 0.18); ay = -0.75 + random.uniform(-0.18, 0.18)
    ball("Apple", (ax, ay, 1.42), (0.055, 0.055, 0.05), APPLE)
for i in range(5):
    ax = 2.35 + random.uniform(-0.18, 0.18); ay = -0.35 + random.uniform(-0.18, 0.18)
    ball("Apple", (ax, ay, 0.74), (0.055, 0.055, 0.05), APPLE)

# ---------------------------------------------------------------- chickens
def chicken(cx, cy, rotz, material):
    g = bpy.data.objects.new("Chicken", None); g.location = (cx, cy, 0); g.rotation_euler = (0, 0, rotz)
    bpy.context.collection.objects.link(g)
    def part(fn, *a, **kw):
        o = fn(*a, **kw); o.parent = g; return o
    part(ball, "Body", (0, 0, 0.30), (0.20, 0.24, 0.17), material)
    part(ball, "HeadC", (0, -0.20, 0.47), (0.085, 0.085, 0.085), material)
    part(cone, "Beak", (0, -0.30, 0.46), 0.035, 0.0, 0.09, ORANGE, (math.radians(-90), 0, 0))
    part(ball, "Comb", (0, -0.20, 0.56), (0.03, 0.05, 0.035), RED)
    part(cone, "Tail", (0, 0.22, 0.42), 0.09, 0.01, 0.22, material, (math.radians(55), 0, 0))
    part(cyl, "LegC1", (-0.06, 0, 0.07), 0.012, 0.14, ORANGE)
    part(cyl, "LegC2", (0.06, 0, 0.07), 0.012, 0.14, ORANGE)
chicken(-0.9, -1.6, 0.5, FEATHER)
chicken(-1.5, -0.9, -0.4, FEATHER2)
chicken(0.1, -2.3, 0.9, FEATHER)
chicken(-2.6, 0.6, 1.4, FEATHER)

# ---------------------------------------------------------------- fence, hay, trees
for i in range(6):
    x = -4.4 + i * 1.15
    box("FencePost", (x, -3.1, 0.45), (0.07, 0.07, 0.45), WOOD_D)
box("FenceRail1", (-1.55, -3.1, 0.62), (2.95, 0.05, 0.07), WOOD)
box("FenceRail2", (-1.55, -3.1, 0.32), (2.95, 0.05, 0.07), WOOD)
cyl("HayBale1", (3.4, 1.6, 0.42), 0.42, 0.7, HAY, rot=(math.radians(90), 0, 0))
cyl("HayBale2", (4.15, 1.15, 0.42), 0.42, 0.7, HAY, rot=(math.radians(90), 0, 0.5))
def tree(tx, ty, s=1.0):
    cyl("Trunk", (tx, ty, 0.8 * s), 0.14 * s, 1.6 * s, TRUNK)
    ball("Canopy", (tx, ty, 2.1 * s), (0.95 * s, 0.95 * s, 0.85 * s), LEAF)
    ball("Canopy2", (tx + 0.55 * s, ty + 0.2, 1.7 * s), (0.6 * s, 0.6 * s, 0.55 * s), LEAF)
    ball("Canopy3", (tx - 0.5 * s, ty - 0.25, 1.75 * s), (0.55 * s, 0.55 * s, 0.5 * s), LEAF)
tree(4.6, 4.6, 1.15)
tree(-7.6, -0.6, 0.95)
tree(6.8, 0.4, 0.8)

# ---------------------------------------------------------------- light, sky, camera
sun_data = bpy.data.lights.new("Sun", "SUN")
sun_data.energy = 3.2; sun_data.angle = math.radians(4)
sun_data.color = (1.0, 0.92, 0.80)
sun = bpy.data.objects.new("Sun", sun_data)
sun.rotation_euler = (math.radians(52), math.radians(12), math.radians(-38))
bpy.context.collection.objects.link(sun)

world = bpy.data.worlds.new("World"); bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.45, 0.65, 0.92, 1.0)
bg.inputs[1].default_value = 0.55

cam_data = bpy.data.cameras.new("Camera"); cam_data.lens = 38
cam = bpy.data.objects.new("Camera", cam_data)
cam.location = (6.4, -7.6, 2.6)
target = Vector(( -0.6, 0.6, 1.1))
direction = target - Vector(cam.location)
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam
cam_data.dof.use_dof = True
cam_data.dof.focus_object = bpy.data.objects["Torso"]
cam_data.dof.aperture_fstop = 5.6

# ---------------------------------------------------------------- render
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.cycles.device = "CPU"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.path.join(OUT, "farm_frame.png")
scene.render.film_transparent = False
bpy.ops.render.render(write_still=True)
print("RENDER_DONE", scene.render.filepath, os.path.getsize(scene.render.filepath))
