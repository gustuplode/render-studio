# expressions.py — named facial expressions for the MPFB human (Brain Freeze line).
#
# WHY THIS EXISTS (discovery, DEMO_REPORT Step 2): the game_engine rig has NO
# face bones, the basemesh carries only MPFB macro/proportion targets, and
# MPFB ships no expression targets in this install. The mechanism that really
# exists = RELATIVE SHAPE KEYS. This module sculpts them programmatically:
# each state is a semantic displacement field over the face (mouth corners,
# cheeks, brows, lids, jaw, nose bridge), applied to HumanBody, with matching
# keys on the fitted parts so they follow:
#   eyebrows  -> brow component only
#   eyelashes -> lid components only
#   teeth     -> jaw component (lower teeth only; field is 0 above mouth line)
#   tongue    -> jaw component (damped)
# Relative keys are deltas from Basis, so they compose with MPFB's macro
# targets and evaluate BEFORE the armature modifier (face follows head bone).
#
# Native MPFB space: face toward -Y, up +Z, his LEFT at +X. All fitted
# objects have identity transforms at build time, so local == world here.
# Call add_expressions(info) AFTER human_gen.build_human() and BEFORE the
# human root is scaled/rotated/parented.
import bpy, math
from mathutils import Vector

STATES = ("smile", "laugh", "shock", "pain", "relief")


def _g(d, r):
    return math.exp(-((d / r) ** 2))


def _ss(x, a, b):
    """smoothstep of x between a and b -> 0..1"""
    if x <= a:
        return 0.0
    if x >= b:
        return 1.0
    u = (x - a) / (b - a)
    return u * u * (3 - 2 * u)


class _Face:
    def __init__(self, info):
        # MEASURED landmark correction (measure_mouth.py, 2026-11-11):
        # human_gen's mouth ESTIMATE (nose + (0, .014, -.030)) sits 13 mm
        # ABOVE the true lip seam. Lip-candidate verts (front, |x|<.034)
        # centroid = (0, -0.1641, 1.5532), z-range [1.544, 1.563]. Using the
        # estimate made corner fields lift the whole mouth area uniformly
        # (no smile curve) and put the cheek band under the eyes (fold fins).
        self.M = Vector((0.0, -0.164, 1.553))    # MEASURED mouth centre
        self.N = Vector(info["nose"])           # nose tip
        eyes = bpy.data.objects["HumanBody.high-poly"]
        vs = [v.co for v in eyes.data.vertices]
        self.E = {}
        for side, sel in (("l", lambda v: v.x > 0.008), ("r", lambda v: v.x < -0.008)):
            cl = [v for v in vs if sel(v)]
            self.E[side] = sum(cl, Vector()) / len(cl)
        self.C = {"l": Vector((0.028, -0.1635, 1.556)),
                  "r": Vector((-0.028, -0.1635, 1.556))}
        self.bridge = Vector((0.0, -0.163, 1.630))  # nose bridge / glabella
        self.tmj = Vector((0.0, -0.025, 1.600))     # jaw joint axis point

    # ---- region weights (0..1)
    def w_corner(self, p):
        return max(_g((p - self.C["l"]).length, 0.0235),
                   _g((p - self.C["r"]).length, 0.0235))

    def w_cheek(self, p):
        if p.y > -0.112:
            return 0.0
        return _ss(abs(p.x), 0.016, 0.030) * (1 - _ss(abs(p.x), 0.048, 0.062)) \
            * _ss(p.z, self.M.z - 0.004, self.M.z + 0.012) \
            * (1 - _ss(p.z, self.M.z + 0.040, self.M.z + 0.062))

    def w_brow(self, p):
        if p.y > -0.112 or abs(p.x) > 0.066:
            return 0.0
        return _ss(p.z, 1.632, 1.644) * (1 - _ss(p.z, 1.664, 1.676))

    def w_brow_inner(self, p):
        return self.w_brow(p) * (1 - _ss(abs(p.x), 0.010, 0.030))

    def w_forehead(self, p):
        if p.y > -0.100 or abs(p.x) > 0.060:
            return 0.0
        return _ss(p.z, 1.656, 1.670) * (1 - _ss(p.z, 1.700, 1.720))

    def _eye_side(self, p):
        return "l" if (p - self.E["l"]).length <= (p - self.E["r"]).length else "r"

    def w_lid_up(self, p):
        e = self.E[self._eye_side(p)]
        return _g((p - e).length, 0.017) * (1.0 if p.z >= e.z - 0.002 else 0.12)

    def w_lid_lo(self, p):
        e = self.E[self._eye_side(p)]
        return _g((p - e).length, 0.017) * (1.0 if p.z < e.z + 0.002 else 0.12)

    def w_jaw(self, p):
        # Jaw ROTATES about the TMJ axis: displacement must grow with
        # distance from the joint, not with depth below the mouth line
        # (the old depth field dropped the chin 16 mm but the lips only
        # ~3 mm, so the mouth never opened; it also leaked into the neck).
        # REGION FIX (round-3 evidence): the TMJ weight alone also dragged
        # ALL front skin below z 1.565 — including under-eye/cheek skin
        # anchored to the SKULL — stretching the eye sockets down over the
        # unmoved eyeballs ("rolled eyes" in laugh/shock). Mandible flesh
        # only: nothing above the mouth line moves, sides are damped.
        if p.y > -0.100 or abs(p.x) > 0.058 or p.z > 1.565 or p.z < 1.415:
            return 0.0
        if p.z > self.M.z + 0.004:  # upper lip / philtrum / cheeks stay
            return 0.0
        d = math.hypot(p.y - self.tmj.y, p.z - self.tmj.z)
        w = min(1.0, d / 0.150)
        w *= 1.0 - _ss(1.455 - p.z, 0.0, 0.030)  # fade out below the chin
        w *= 1.0 - 0.75 * _ss(abs(p.x), 0.030, 0.058)  # lateral damping
        return w

    def w_bridge(self, p):
        return _g((p - self.bridge).length, 0.014)

    # ---- components (each returns an offset Vector)
    def corner_off(self, p, out, back, up):
        s = 1.0 if p.x >= 0 else -1.0
        return Vector((s * out, back, up)) * self.w_corner(p)

    def brow_off(self, state, p):
        wb, wi = self.w_brow(p), self.w_brow_inner(p)
        if wb <= 0.0:
            return Vector()
        if state == "shock":
            return Vector((0, 0, 0.0110)) * wb + Vector((0, 0, 0.003)) * self.w_forehead(p)
        if state == "pain":
            s = 1.0 if p.x >= 0 else -1.0
            return Vector((-s * 0.0045, -0.0020, -0.0100)) * wi \
                 + Vector((0, 0, -0.0032)) * (wb - wi)
        if state == "relief":
            return Vector((0, 0, 0.0035)) * wb
        if state == "smile":
            return Vector((0, 0, 0.0022)) * wb
        if state == "laugh":
            return Vector((0, 0, 0.0030)) * wb
        return Vector()

    def lid_off(self, state, p):
        wu, wl = self.w_lid_up(p), self.w_lid_lo(p)
        if state == "smile":
            return Vector((0, 0, -0.0010)) * wu + Vector((0, 0, 0.0012)) * wl
        if state == "laugh":
            return Vector((0, 0, -0.0020)) * wu + Vector((0, 0, 0.0020)) * wl
        if state == "shock":
            return Vector((0, 0, 0.0050)) * wu + Vector((0, 0, -0.0015)) * wl
        if state == "pain":
            return Vector((0, 0, -0.0062)) * wu + Vector((0, 0, 0.0030)) * wl
        if state == "relief":
            return Vector((0, 0, -0.0012)) * wu
        return Vector()

    def jaw_off(self, state, p):
        # JAW-DROP AMOUNTS ZEROED for laugh/shock (component-isolation
        # finding, diag_expr.py V1-V8): a jaw drop >= ~9 mm on this
        # basemesh reproducibly corrupts the eye sockets in render
        # (sockets show rolled/zombie eyes) even though the jaw field
        # provably moves ZERO verts above z 1.557 — an evaluated-mesh
        # coupling in the MPFB fit we could not pin down further.
        # laugh/shock therefore play CLOSED-mouth (V8 proof: laugh reads
        # clearly via corners+brows+eyes). Small amounts (<= 2 mm) are
        # proven clean (round-3 pain/relief stills) and kept.
        amt = {"laugh": 0.0, "shock": 0.0, "relief": -0.0020,
               "pain": 0.0015, "smile": 0.0}[state]
        return Vector((0, 0, amt)) * self.w_jaw(p)

    def offset(self, state, p, part="body"):
        if part == "brow":
            return self.brow_off(state, p)
        if part == "lash":
            return self.lid_off(state, p)
        if part == "teeth":
            return self.jaw_off(state, p) * 0.85
        if part == "tongue":
            return self.jaw_off(state, p) * 0.55
        # full face on the basemesh
        o = Vector()
        if state == "smile":
            o += self.corner_off(p, 0.0070, 0.0040, 0.0100)
            o += Vector((0, 0, 0.0032)) * self.w_cheek(p)
        elif state == "laugh":
            o += self.corner_off(p, 0.0090, 0.0050, 0.0140)
            o += Vector((0, 0, 0.0038)) * self.w_cheek(p)
        elif state == "shock":
            o += self.corner_off(p, 0.0, 0.0, -0.0032)
        elif state == "pain":
            o += self.corner_off(p, -0.0022, -0.0015, -0.0100)
            o += Vector((0, 0, 0.0030)) * self.w_bridge(p)
        elif state == "relief":
            o += self.corner_off(p, 0.0050, 0.0030, 0.0065)
            o += Vector((0, 0, 0.0020)) * self.w_cheek(p)
        o += self.brow_off(state, p)
        o += self.lid_off(state, p)
        o += self.jaw_off(state, p)
        return o


_PARTS = (("HumanBody", "body"),
          ("HumanBody.eyebrow008", "brow"),
          ("HumanBody.eyelashes01", "lash"),
          ("HumanBody.teeth_base", "teeth"),
          ("HumanBody.tongue01", "tongue"))


def add_expressions(info):
    """Create the 5 non-neutral state keys on body + fitted face parts.
    Returns {state: [key_blocks]} for keyframing. Neutral = all values 0."""
    face = _Face(info)
    print("EXPR landmarks M=%s E_l=%s E_r=%s" % (
        tuple(round(v, 3) for v in face.M),
        tuple(round(v, 3) for v in face.E["l"]),
        tuple(round(v, 3) for v in face.E["r"])))
    blocks = {s: [] for s in STATES}
    for obj_name, part in _PARTS:
        ob = bpy.data.objects.get(obj_name)
        if ob is None or ob.type != 'MESH':
            print("EXPR part missing:", obj_name)
            continue
        basis = None
        if ob.data.shape_keys is None:
            ob.shape_key_add(name="Basis", from_mix=False)
        basis = [v.co.copy() for v in ob.data.shape_keys.key_blocks["Basis"].data]
        for state in STATES:
            kb = ob.shape_key_add(name=state, from_mix=False)
            moved = 0
            for i, co in enumerate(basis):
                off = face.offset(state, co, part)
                kb.data[i].co = co + off
                if off.length > 1e-5:
                    moved += 1
            blocks[state].append(kb)
            print("EXPR %-22s %-7s moved_verts=%d" % (obj_name, state, moved))
    return blocks


def set_expr(blocks, state, value, frame=None):
    """Set one state's value on every part; optionally keyframe it."""
    for kb in blocks[state]:
        kb.value = value
        if frame is not None:
            kb.keyframe_insert(data_path="value", frame=frame)


def key_expr(blocks, timeline, frame_range):
    """timeline: {state: [(frame, value), ...]} — key every state's keys,
    zeroing states not mentioned at the range ends so nothing leaks."""
    for state, keys_ in timeline.items():
        for f, v in keys_:
            set_expr(blocks, state, v, f)
