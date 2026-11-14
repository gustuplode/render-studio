// Motion helpers: smooth, continuous, "animated" movement for cameras and cards.
// Import in story.js:  import { M } from './motion.js';
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
export const ramp = (f, a, b) => clamp((f - a) / (b - a));
export const M = {
  smooth: (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); },           // smootherstep (glides)
  easeOut: (t) => 1 - Math.pow(1 - clamp(t), 3),                                          // fast start, soft land (reference "burst" moves)
  easeIn: (t) => Math.pow(clamp(t), 3),
  easeInOut: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }, // cubic in-out: slow ends, fast middle (flights, punch-ins)
  surge: (t) => { t = clamp(t); return t * t * (3 - 2 * t); },                                            // smoothstep: gentle accel, soft settle (dramatic push-ins)
  back: (t, s = 1.7) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; },        // overshoot then settle (pops, arrivals)
  anticip: (t, s = 0.12) => { t = clamp(t); return t < 0.25 ? -s * Math.sin(t / 0.25 * Math.PI) : M.back((t - 0.25) / 0.75); }, // wind-up then go
  spring: (t, freq = 3, damp = 5) => { t = Math.max(0, t); return 1 - Math.exp(-damp * t) * Math.cos(freq * 2 * Math.PI * t); },  // settle wobble (t in s)
};
/** Centripetal Catmull-Rom through 3D points; u in [0,1] over the whole path (constant-ish speed). */
export const spline = (pts, u) => {
  const n = pts.length - 1, x = clamp(u) * n, i = Math.min(n - 1, Math.floor(x)), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
};
/** Camera from keys {f,pos,look,fov,roll,ease?}. 3+ keys inside one glide use a spline (no corners).
 *  Every hold creeps (push-in) so nothing ever freezes; add kicks for impacts. */
export const camFromKeys = (K, f, { creep = 0.0012, kicks = [] } = {}) => {
  let c;
  if (f <= K[0].f) c = { ...K[0] };
  else if (f >= K[K.length - 1].f) c = { ...K[K.length - 1] };
  else {
    const i = K.findIndex((k, j) => f >= k.f && f <= K[j + 1].f), a = K[i], b = K[i + 1];
    const ease = M[b.ease || 'smooth'], t = ease((f - a.f) / (b.f - a.f));
    if (b.path) { // optional via-points for curved moves: b.path = [[x,y,z], ...]
      const pts = [a.pos, ...b.path, b.pos]; c = { pos: spline(pts, t), look: lerp3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll || 0, b.roll || 0, t) };
    } else c = { pos: lerp3(a.pos, b.pos, t), look: lerp3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll || 0, b.roll || 0, t) };
  }
  c.fov *= 1 - creep * Math.max(0, f - K[0].f) * 0.15; // gentle push-in during holds
  for (const k of kicks) { const d = f - k.f; if (d >= 0 && d < 7) { const s = (d % 2 ? -1 : 1) * k.a * (1 - d / 7); c.look = [c.look[0], c.look[1] + s * 3, c.look[2] + s * 2]; c.roll = (c.roll || 0) + s * 20; } }
  return c;
};
/** Idle life for a card: breathing bob + small sway, deterministic per seed. Use on EVERY on-screen character. */
export const idle = (f, seed = 1) => ({
  bob: 0.006 * Math.sin((f + seed * 11) * 0.11),
  tilt: 1.2 * Math.sin((f + seed * 7) * 0.05),
  headTilt: 1.5 * Math.sin((f + seed * 5) * 0.037 + 1),
});
/** Blink: 4-frame lid every 0.5-2.3 s. */
export const blinkAt = (f, seed) => { const per = 38 + (seed * 17) % 31, ph = (f + seed * 13) % per; return ph < 2 ? 0.5 : ph < 4 ? 1 : 0; };
/** Walk: phase for step cycles + planted travel. speed m/s, stride m. */
export const walk = (f, f0, speed = 1.1, stride = 0.8) => { const t = Math.max(0, f - f0) / 30; return { dist: t * speed, phase: (t * speed / (2 * stride)) % 1 }; };
/** Round values used in card keys so canvas redraws happen only when the pose visibly changes. */
export const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
/** Scalar keyframe track. Keys: [frame, value, easeFromPrev?] — ease names an M curve applied
 *  across the segment ENDING at that key (same convention as camFromKeys). Holds outside range. */
export const kf = (keys, f) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i];
      return lerp(a[1], b[1], M[b[2] || 'smooth']((f - a[0]) / (b[0] - a[0])));
    }
  }
  return keys[keys.length - 1][1];
};
/** 3D keyframe track. Keys: [frame, [x,y,z], easeFromPrev?, viaPoints?] — via points curve the move (spline). */
export const kf3 = (keys, f) => {
  if (f <= keys[0][0]) return [...keys[0][1]];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], t = M[b[2] || 'smooth']((f - a[0]) / (b[0] - a[0]));
      return b[3] ? spline([a[1], ...b[3], b[1]], t) : lerp3(a[1], b[1], t);
    }
  }
  return [...keys[keys.length - 1][1]];
};

// ============================================================
// v2 (2026-11-12) — BODY MOVEMENT toolkit: anticipation, squash & stretch, spring
// secondary motion, weighted walk, breathing, smooth blinks, gusts. All frame-driven
// and deterministic. Pair with toon.js v2 (Emotion / Blink / faceFrontP / bodyFront
// opts {exprP, airY, squash, lookY}).
// ============================================================
/** Extra easings (the v1 set above stays untouched). */
M.easeInBack = (t, s = 1.7) => { t = clamp(t); return (s + 1) * t * t * t - s * t * t; }; // pull back before going (wind-up)
M.elastic = (t) => { t = clamp(t); return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1; };
M.bounce = (t) => { t = clamp(t); const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375; };
M.expo = (t) => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };

/** Damped spring (1D) — the engine of ALL secondary motion: ears, tails, caps, cloth
 *  tips, held props. Step it once per frame with dt in seconds; read .x for the value,
 *  .v for velocity (handy for lean/tilt). stiff ~90-160, damp ~9-14 reads cartoon-right. */
export class Spring {
  constructor(x = 0, stiff = 120, damp = 11) { this.x = x; this.v = 0; this.target = x; this.stiff = stiff; this.damp = damp; }
  set(target) { this.target = target; return this; }
  update(dt) {
    const a = (this.target - this.x) * this.stiff - this.v * this.damp;
    this.v += a * dt; this.x += this.v * dt;
    return this.x;
  }
}
/** 2D spring follower: a point that chases an anchor with lag + overshoot. Use for a
 *  cap/ear/tail tip: tip = follower.at(anchorX, anchorY, dt) — draw the part at the tip,
 *  rotated by follower.angle() so it trails the motion. */
export class Spring2 {
  constructor(x = 0, y = 0, stiff = 110, damp = 10) { this.sx = new Spring(x, stiff, damp); this.sy = new Spring(y, stiff, damp); }
  at(ax, ay, dt) { return [this.sx.set(ax).update(dt), this.sy.set(ay).update(dt)]; }
  vel() { return [this.sx.v, this.sy.v]; }
}

/** Jump with the full experienced arc: ANTICIPATION crouch -> launch stretch -> air ->
 *  landing SQUASH -> springy recover. Returns values for bodyFront opts {airY, squash}
 *  plus phase name. Units: frames + pixels (card space, 600x1000). */
export const jumpArc = (f, f0, o = {}) => {
  const crouch = o.crouch ?? 6, air = o.air ?? 18, settle = o.settle ?? 9, h = o.height ?? 130, amt = o.amt ?? 0.16;
  const d = f - f0;
  if (d < 0) return { airY: 0, squash: 0, phase: 'idle', t: 0 };
  if (d < crouch) { const u = d / crouch; return { airY: 0, squash: amt * M.surge(u), phase: 'crouch', t: u }; }        // wind-up: sink first
  if (d < crouch + air) {
    const u = (d - crouch) / air, y = Math.sin(u * Math.PI) * h;
    const stretch = u < 0.3 ? -amt * 0.8 * (1 - u / 0.3) : 0;                                                          // stretched just after launch
    return { airY: y, squash: stretch, phase: u < 0.5 ? 'rise' : 'fall', t: u };
  }
  const dLand = d - crouch - air;
  if (dLand < settle) { const u = dLand / settle; return { airY: 0, squash: amt * 1.25 * (1 - u) * Math.cos(u * Math.PI * 0.5), phase: 'land', t: u }; } // squash, then ease out
  return { airY: 0, squash: 0, phase: 'done', t: 1 };
};
/** One-off landing squash that rings down like a spring (use after falls/drops). */
export const landSquash = (f, fLand, amt = 0.18) => {
  const d = (f - fLand) / 30; if (d < 0) return 0;
  return amt * Math.exp(-5.5 * d) * Math.cos(d * 14) * (d < 0.12 ? d / 0.12 : 1);
};
/** Weighted walk, richer than walk(): bob has TWO beats per cycle (one per footfall) with
 *  a soft dwell at the bottom, the body LEANS into the travel, feet LIFT on their swing.
 *  phase in [0,1) like bodyFront's. Returns {bob (fraction of height, subtract from y),
 *  lean (deg), liftL, liftR (0..1 foot lift), sway (deg)}. */
export const walkCycle2 = (phase, o = {}) => {
  const two = Math.PI * 2, sp = o.speed ?? 1;
  const bob = (0.020 + 0.006 * Math.sin(two * phase)) * (0.5 - 0.5 * Math.cos(2 * two * phase)) + 0.008 * (0.5 - 0.5 * Math.cos(2 * two * phase));
  return {
    bob,
    lean: 2.2 * sp + 0.7 * Math.sin(two * phase),
    liftL: Math.max(0, Math.sin(two * phase)),
    liftR: Math.max(0, Math.sin(two * phase + Math.PI)),
    sway: 1.6 * Math.sin(two * phase),
  };
};
/** Idle BREATHING v2: slow chest rise + head settle, ~3.6s cycle, per-seed phase.
 *  Returns {chest 0..1 (scale torso by 1+0.02*chest), headY px in card space, shoulder 0..1}. */
export const breathe = (f, seed = 1) => {
  const u = 0.5 + 0.5 * Math.sin((f + seed * 23) * (Math.PI * 2 / 108) - Math.PI / 2);
  const e = u * u * (3 - 2 * u);
  return { chest: e, headY: -2.2 * e, shoulder: e };
};
/** Smooth blink v2: pseudo-random interval per seed (2-4.5s), 6-frame curve
 *  (2 close / 1 shut / 3 open, eased) + an occasional double-blink. Returns lid 0..1
 *  CONTINUOUS — replaces blinkAt's hard 0.5 steps where a soft lid matters. */
export const blink2 = (f, seed = 1) => {
  const hash = (n) => { const x = Math.sin(seed * 91.7 + n * 47.3) * 43758.5453; return x - Math.floor(x); };
  let start = 0, cyc = 0;
  while (true) {
    const len = 62 + Math.floor(hash(cyc) * 72);            // 62..134 frames between blinks
    const dbl = hash(cyc + 50) < 0.22;
    const lidAt = (ph) => {
      const one = (b) => ph < b ? 0 : ph < b + 2 ? M.surge((ph - b) / 2) : ph < b + 3 ? 1 : ph < b + 6 ? 1 - M.surge((ph - b - 3) / 3) : 0;
      return Math.max(one(len - 8), dbl ? one(len + 4) : 0);
    };
    const span = len + (dbl ? 12 : 0);
    if (f < start + span) return lidAt(f - start);
    start += span; cyc++;
  }
};
/** Wind GUST envelope: mostly calm with slow swells — for grass, cloth (clothWave2),
 *  cloud drift boosts. Never a uniform wave. Returns ~0.15..1. */
export const gust = (t, seed = 1) => clamp(0.42 + 0.34 * Math.sin(t * 0.53 + seed * 2.1) * Math.sin(t * 0.21 + seed) + 0.24 * Math.sin(t * 1.31 + seed * 4.7), 0.05, 1);
/** Pupil LOOK-AT: given a face centre and a target point (same coordinate space),
 *  returns {x, y} in [-1, 1] for faceFrontP lookX/lookY (and story-side pupil math). */
export const lookAt = (fx, fy, tx, ty, maxD = 260) => ({ x: clamp((tx - fx) / maxD, -1, 1), y: clamp((ty - fy) / maxD, -1, 1) });
