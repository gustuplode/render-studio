"""Shared helpers for Stiff Man demo stage scripts (Blender 4.2, bpy)."""
import bpy
from mathutils import Vector

COLS = {}


def make_collections(scene):
    names = ["CAM", "LIGHTS", "ENV", "HERO", "PROPS", "FX", "TRACK", "REF"]
    for n in names:
        c = bpy.data.collections.new(n)
        scene.collection.children.link(c)
        COLS[n] = c
    return COLS


def move_to(obj, colname):
    col = COLS[colname]
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def mat(name, color, rough=0.7, metal=0.0, emit=None, emit_strength=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1.0)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit is not None:
        try:
            p.inputs["Emission Color"].default_value = (*emit, 1.0)
        except KeyError:
            p.inputs["Emission"].default_value = (*emit, 1.0)
        p.inputs["Emission Strength"].default_value = emit_strength
    return m


def _finish(obj, name, colname, material=None, subsurf=0, bevel=0.0):
    obj.name = name
    if material:
        obj.data.materials.append(material)
    if subsurf:
        mod = obj.modifiers.new("Subsurf", "SUBSURF")
        mod.levels = 2
        mod.render_levels = 2
        for p in obj.data.polygons:
            p.use_smooth = True
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    move_to(obj, colname)
    return obj


def box(name, loc, dims, colname, material=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, name, colname, material, bevel=bevel)


def cyl(name, loc, radius, depth, colname, material=None, subsurf=0,
        rot=(0, 0, 0), radius_top=None):
    if radius_top is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth,
                                            location=loc, rotation=rot,
                                            vertices=24)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=radius, radius2=radius_top,
                                        depth=depth, location=loc,
                                        rotation=rot, vertices=24)
    obj = bpy.context.active_object
    return _finish(obj, name, colname, material, subsurf=subsurf)


def sphere(name, loc, scale, colname, material=None, subsurf=2):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=loc,
                                         segments=32, ring_count=16)
    obj = bpy.context.active_object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, name, colname, material, subsurf=subsurf)


def empty(name, loc, colname):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    COLS[colname].objects.link(e)
    return e


def point_at(obj, target):
    """Rotate obj so its -Z axis aims at target (lights/cameras)."""
    direction = Vector(target) - Vector(obj.location)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
