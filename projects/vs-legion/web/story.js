// "1000 Roman Legion vs 1000 US Marines" — fun comparison short (no gore: the shield wall
// pushes the Marines back with dust and comic stumbles; nobody dies). ONE connected
// battlefield valley, day -> golden -> night -> ring of fire -> dawn.
//
// RETENTION DESIGN (Abid's order): hook lands in the FIRST second (close on the two "1000"
// boards + front ranks, fast push-in), a visual beat changes every 2-3 s, constant motion
// (marching bob, flags, dust, torch flames), escalating scale, big title cards on key beats,
// and the mid-video TWIST staged BIG: the TORTOISE shield wall advancing like an iron mountain.
//
// STRUCTURE RULE: every timing in this file flows from the TIMING table below. Shots, keyframe
// tracks, the TRACKDIR director and world state all read phrase boundaries via TF(id, t)
// (frame at fraction t of a phrase). Parent patches TIMING when the real voice lands and the
// whole edit retimes itself. Estimated timings for now (30 fps).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30;
export const TIMING = [
  ['hook', 0, 193],          // "1000 Romans vs 1000 Marines" — boards + front ranks, fast push-in
  ['gearM', 193, 361],       // Marines gear close-up (smart rifle / NV goggles / helmet radio)
  ['gearR', 361, 522],       // Roman gear: short sword, giant shield, the 3-continent march
  ['charge', 522, 578],      // Round one: both lines advance, ground shakes
  ['tortoise', 578, 916],    // THE TWIST: shield wall forms + advances, strobes bounce off
  ['night', 916, 1032],      // Round two: night falls, Marines own the dark (NV green)
  ['fire', 1032, 1151],      // Romans light a RING OF FIRE — night turns bright as day
  ['verdict', 1151, 1403],   // eats / sleeps / marches montage + captains' handshake at dawn
];
export const TOTAL = TIMING[TIMING.length - 1][2]; // 1410
const T0 = Object.fromEntries(TIMING.map(([id, a, b]) => [id, [a, b]]));
export const TF = (id, t) => Math.round(T0[id][0] + (T0[id][1] - T0[id][0]) * t);
const IN = (id, f, t0 = 0, t1 = 1) => f >= TF(id, t0) && f <= TF(id, t1); // frame inside a phrase window
const LIGHT_OF = { hook: 'day', gearM: 'day', gearR: 'golden', charge: 'day', tortoise: 'golden', night: 'night', fire: 'nightfire', verdict: 'dawn' };
export const SHOTS = TIMING.map(([id, a, b]) => ({ id, a, b: b - 1, light: LIGHT_OF[id] }));
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;

// ---------- lights (Bear v4 values + nightfire / dawn for the twist) ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 240,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 18, ...WATER },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 40, fogFar: 220,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', vig: 0.26, shadowExt: 18, ...WATER },
  night: { az: 60, el: 38, sky: '#33456b', ground: '#1c1a20', hemi: 0.95, sun: '#aebfff', sunI: 1.15, fog: '#232c40', fogNear: 10, fogFar: 70,
    skyTop: '#131c30', skyHor: '#2c3a55', sat: 1.03, vig: 0.3, shadowExt: 10, waterDeep: '#1c2c3c', waterShal: '#2c445c', glint: '#cfe0ff' },
  nightfire: { az: 60, el: 38, sky: '#4a3428', ground: '#3a2418', hemi: 1.0, sun: '#ffb46c', sunI: 1.5, fog: '#4a3424', fogNear: 12, fogFar: 90,
    skyTop: '#241a20', skyHor: '#7a4a2a', sunDisc: '#ffb46c', sunSize: 0.002, sat: 1.08, gain: '#ffdcb0', vig: 0.3, shadowExt: 12, waterDeep: '#2c2018', waterShal: '#4a3424', glint: '#ffb46c' },
  dawn: { az: 30, el: 14, sky: '#a8a0cc', ground: '#6a5040', hemi: 1.05, sun: '#ffc27e', sunI: 2.7, fog: '#e8c39a', fogNear: 42, fogFar: 230,
    skyTop: '#7a86c0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.1, gain: '#fff2e2', vig: 0.24, shadowExt: 18, ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- shared stage geometry (== main.js world build) ----------
export const BOARD_US = [-7.7, 3.4, -4.2], BOARD_RM = [7.7, 3.4, -4.2];   // the giant "1000" boards
const US_FRONT0 = -4.8, RM_FRONT0 = 4.8;                                  // rank front lines (main.js ranks sit here)
export const STACK_AT = [-1.5, 0.45, -2.9];                               // Marines' supply-crate stack (verdict)
export const RM_STACK_AT = [1.5, 0.45, -2.9];                             // Romans' grain-sack stack (verdict)
export const SHAKE_AT = [0, 0.8, 0.9];                                    // handshake crate at the finale
// ring of fire around the Roman line (x ~ +2..+3.8, facing the Marines): torch poles + fire pits
export const TORCHES = [[2.6, -3.4], [2.2, -1.2], [2.0, 1.0], [3.1, 3.6], [2.8, 5.2], [3.6, -5.2], [3.8, 7.0]];
export const FIRE_PITS = [[2.4, -2.2], [2.2, 0.2], [2.4, 2.6], [2.8, 4.8]];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
const laugh = (f, a, b, amp) => (f >= a && f < b) ? Math.abs(Math.sin((f - a) * 0.55)) * amp * Math.min(1, (f - a) / 6) * Math.min(1, (b - f) / 6) : 0;

// ---------- subject tracks (actors + camera + world read the SAME tracks) ----------
// Charge: Marines surge fast, Romans advance in lockstep; the lines close to ~4.5 m.
export const usFrontX = (f) => kf([[TF('charge', 0), US_FRONT0], [TF('charge', 0.7), -2.2, 'easeInOut'], [TF('charge', 1), -2.2],
  [TF('tortoise', 0.55), -2.2], [TF('tortoise', 0.85), -3.1, 'smooth'], [TF('tortoise', 1), -3.1]], f);
export const rmFrontX = (f) => kf([[TF('charge', 0), RM_FRONT0], [TF('charge', 0.85), 2.6, 'smooth'], [TF('charge', 1), 2.6],
  [TF('tortoise', 0), 2.6], [TF('tortoise', 0.85), 0.9, 'smooth'], [TF('tortoise', 1), 0.9]], f);
// The Marine front runner the camera rides with (charge in, comic retreat before the wall).
export const usRunner = (f) => {
  const x = kf([[TF('charge', 0), -4.0], [TF('charge', 0.7), -1.6, 'easeInOut'], [TF('charge', 1), -1.6],
    [TF('tortoise', 0.55), -1.6], [TF('tortoise', 0.8), -2.5, 'smooth'], [TF('tortoise', 1), -2.5]], f);
  const run = (IN('charge', f, 0.02, 0.78) || IN('tortoise', f, 0.55, 0.85)) ? Math.abs(Math.sin((f - TF('charge', 0)) * 0.55)) * 0.07 : 0;
  return { pos: [x, run, 0.8], phase: ((f - TF('charge', 0)) * 0.045) % 1 };
};
// Roman lockstep group (gearR): one shared phase — the whole group marches as one body.
export const rmMarch = (f) => {
  const x = kf([[TF('gearR', 0), 3.9], [TF('gearR', 1), 2.6, 'smooth']], f);
  return { x, phase: ((f - TF('gearR', 0)) * 0.036) % 1, bob: Math.abs(Math.sin((f - TF('gearR', 0)) * 0.55)) * 0.035 };
};
// Tortoise formation envelope: 0 = open ranks, 1 = full shield wall (front + roof).
export const WALL_FORM = (f) => kf([[TF('tortoise', 0), 0], [TF('tortoise', 0.35), 1, 'surge'], [TF('tortoise', 1), 1]], f);
// Captains walk to the centre for the dawn handshake (verdict finale).
export const usCapX = (f) => kf([[TF('verdict', 0.72), -3.4], [TF('verdict', 0.9), -0.46, 'easeInOut'], [TF('verdict', 1), -0.46]], f);
export const rmCapX = (f) => kf([[TF('verdict', 0.72), 3.4], [TF('verdict', 0.9), 0.46, 'easeInOut'], [TF('verdict', 1), 0.46]], f);
// Verdict montage: Marine shuttles crates to his stack; a Roman marches grain sacks in, steady as a clock.
export const usRacer = (f) => ({ x: kf([[TF('verdict', 0.04), -2.9], [TF('verdict', 0.3), -0.6, 'easeInOut'], [TF('verdict', 0.38), -0.6], [TF('verdict', 0.6), -2.9, 'easeInOut'], [TF('verdict', 0.68), -2.9]], f), phase: ((f - TF('verdict', 0)) * 0.04) % 1 });
export const rmRacer = (f) => ({ x: kf([[TF('verdict', 0.06), 2.9], [TF('verdict', 0.64), -0.2, 'smooth'], [TF('verdict', 0.7), -0.2]], f), phase: ((f - TF('verdict', 0)) * 0.036) % 1, bob: Math.abs(Math.sin((f - TF('verdict', 0)) * 0.55)) * 0.035 });

// ---------- TRACKING DIRECTOR ----------
const US_HERO_HD = [-2.9, 1.5, 2.2]; // Marine hero's head (goggles ride here)
const TRACKDIR = {
  hook: [
    { a: TF('hook', 0), b: TF('hook', 0.3), type: 'object', id: 'boardUS', pos: () => BOARD_US, w: 0.5, blend: 20 },
    { a: TF('hook', 0.3), b: TF('hook', 0.56), type: 'subject', id: 'rmFront', pos: () => [4.55, 1.2, -0.5], w: 0.45, blend: 20 },
    { a: TF('hook', 0.56), b: TF('hook', 1), type: 'object', id: 'boardRM', pos: () => BOARD_RM, w: 0.5, blend: 20 },
  ],
  gearM: [
    { a: TF('gearM', 0), b: TF('gearM', 0.45), type: 'character', id: 'usHero', pos: () => [-2.9, 1.15, 2.2], w: 0.5 },
    { a: TF('gearM', 0.45), b: TF('gearM', 0.82), type: 'object', id: 'goggles', pos: () => US_HERO_HD, w: 0.62 },
    { a: TF('gearM', 0.82), b: TF('gearM', 1), type: 'character', id: 'usHero', pos: () => [-2.9, 1.15, 2.2], w: 0.5 },
  ],
  gearR: [
    { a: TF('gearR', 0), b: TF('gearR', 0.4), type: 'object', id: 'sword', pos: (f) => [rmMarch(f).x - 0.75, 1.0, 2.2], w: 0.55 },
    { a: TF('gearR', 0.4), b: TF('gearR', 1), type: 'character', id: 'rmHero', pos: (f) => [rmMarch(f).x - 0.7, 1.15, 2.2], w: 0.55 },
  ],
  charge: [
    { a: TF('charge', 0), b: TF('charge', 0.8), type: 'subject', id: 'usRunner', pos: (f) => { const r = usRunner(f); return [r.pos[0], 1.2, r.pos[2]]; }, w: 0.68, posW: 0.35 },
    { a: TF('charge', 0.8), b: TF('charge', 1), type: 'subject', id: 'rmFront', pos: (f) => [rmFrontX(f), 1.1, 0.4], w: 0.5 },
  ],
  tortoise: [
    { a: TF('tortoise', 0), b: TF('tortoise', 0.45), type: 'object', id: 'wall', pos: (f) => [rmFrontX(f) - 0.35, 1.05, 0.2], w: 0.6 },
    { a: TF('tortoise', 0.45), b: TF('tortoise', 0.78), type: 'object', id: 'wallClose', pos: (f) => [rmFrontX(f) - 0.3, 0.95, 0.9], w: 0.72 },
    { a: TF('tortoise', 0.78), b: TF('tortoise', 1), type: 'subject', id: 'usRunner', pos: (f) => { const r = usRunner(f); return [r.pos[0], 1.15, r.pos[2]]; }, w: 0.55 },
  ],
  night: [
    { a: TF('night', 0), b: TF('night', 0.55), type: 'subject', id: 'usHero', pos: () => [-1.5, 1.2, 1.6], w: 0.55 },
    { a: TF('night', 0.55), b: TF('night', 1), type: 'subject', id: 'rmHero', pos: () => [1.5, 1.2, 1.6], w: 0.55 },
  ],
  fire: [
    { a: TF('fire', 0), b: TF('fire', 0.5), type: 'subject', id: 'rmHero', pos: () => [0.4, 1.15, 1.8], w: 0.55 },
    { a: TF('fire', 0.5), b: TF('fire', 1), type: 'object', id: 'ringCentre', pos: () => [2.4, 1.0, 0.8], w: 0.45 },
  ],
  verdict: [
    { a: TF('verdict', 0), b: TF('verdict', 0.5), type: 'object', id: 'crate', pos: () => STACK_AT, w: 0.55 },
    { a: TF('verdict', 0.5), b: TF('verdict', 0.82), type: 'character', id: 'racers', pos: (f) => [(usRacer(f).x + rmRacer(f).x) / 2, 1.0, -2.6], w: 0.45 },
    { a: TF('verdict', 0.82), b: TF('verdict', 1), type: 'object', id: 'shakeCrate', pos: () => SHAKE_AT, w: 0.6 },
  ],
};
const BLEND = 10;
export const dirFor = (id, f) => {
  const segs = TRACKDIR[id];
  let i = segs.findIndex((s) => f <= s.b); if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  let point = seg.pos(f), w = seg.w;
  const pv = segs[i - 1], nx = segs[i + 1];
  // seam-centred handoff: the SAME t curve is evaluated from both sides of the seam, so the
  // tracked point is continuous across it (a segment may ask for a longer blend, e.g. the hook)
  if (nx && f >= nx.a - (nx.blend || BLEND) / 2) {
    const B = nx.blend || BLEND, t = smooth(ramp(f, nx.a - B / 2, nx.a + B / 2));
    point = lerp3(point, nx.pos(f), t); w = lerp(w, nx.w, t);
  } else if (pv && f < seg.a + (seg.blend || BLEND) / 2) {
    const B = seg.blend || BLEND, t = smooth(ramp(f, seg.a - B / 2, seg.a + B / 2));
    point = lerp3(pv.pos(f), point, t); w = lerp(pv.w, w, t);
  }
  return { point, w, seg };
};
export const dirAt = (f) => dirFor(shotAt(f).id, f);

// ---------- cameras (base dollies keyed by phrase fraction) ----------
const CK = (id, rows) => rows.map(([t, pos, look, fov, ease]) => ({ f: TF(id, t), pos, look, fov, ease }));
const BASECAM = {
  hook: () => CK('hook', [ // FAST push-in on the boards + ranks in the first second, then a swing to the Roman board
    [0, [0, 1.9, 11.2], [-3.4, 1.9, -3.4], 44], [0.3, [0, 2.0, 13.6], [-1.0, 1.8, -3.6], 45, 'easeInOut'],
    [0.56, [0.6, 2.0, 12.6], [2.6, 1.7, -2.6], 44, 'easeInOut'], [1, [0, 2.2, 15.2], [1.4, 1.8, -3.4], 45, 'easeInOut']]),
  gearM: () => CK('gearM', [
    [0, [-1.9, 1.5, 6.4], [-2.9, 1.15, 2.2], 40], [0.5, [-2.25, 1.55, 5.2], [-2.9, 1.3, 2.2], 36, 'easeInOut'], [1, [-2.45, 1.5, 5.8], [-2.9, 1.2, 2.2], 38, 'easeInOut']]),
  gearR: () => CK('gearR', [
    [0, [1.5, 1.5, 6.6], [2.9, 1.1, 2.2], 40], [0.5, [1.15, 1.5, 5.6], [2.5, 1.15, 2.2], 37, 'easeInOut'], [1, [0.85, 1.45, 6.0], [2.1, 1.1, 2.2], 39, 'easeInOut']]),
  charge: () => CK('charge', [
    [0, [-3.4, 1.7, 7.8], [-2.8, 1.1, 0.6], 44], [0.5, [-2.0, 1.6, 6.8], [-1.5, 1.1, 0.7], 42, 'easeInOut'], [1, [-0.4, 1.8, 7.6], [0.5, 1.1, 0.4], 43, 'easeInOut']]),
  tortoise: () => CK('tortoise', [ // wide on the forming wall -> close on the shield faces -> the Marine backing away
    [0, [-1.2, 1.6, 8.8], [1.2, 1.0, 0.2], 42], [0.45, [-0.9, 1.5, 7.6], [1.4, 0.95, 0.4], 40, 'easeInOut'],
    [0.78, [-1.3, 1.45, 6.9], [0.9, 0.95, 0.9], 39, 'easeInOut'], [1, [-1.7, 1.6, 7.8], [-0.6, 1.0, 0.6], 41, 'easeInOut']]),
  night: () => CK('night', [
    [0, [-0.7, 1.5, 6.8], [-1.5, 1.15, 1.6], 41], [0.55, [0.18, 1.5, 6.4], [-0.26, 1.15, 1.6], 40, 'easeInOut'], [1, [0.8, 1.5, 6.6], [1.5, 1.15, 1.6], 41, 'easeInOut']]),
  fire: () => CK('fire', [
    [0, [0.4, 1.6, 8.2], [1.9, 1.05, 0.6], 42], [0.5, [0.2, 1.55, 7.4], [2.3, 1.0, 0.7], 40, 'easeInOut'], [1, [-0.2, 1.7, 8.6], [2.2, 1.05, 0.7], 42, 'easeInOut']]),
  verdict: () => CK('verdict', [
    [0, [-0.8, 1.7, 4.6], [-1.3, 0.8, -2.9], 43], [0.4, [0.7, 1.6, 3.4], [0, 0.9, -2.6], 41, 'easeInOut'],
    [0.8, [0, 1.8, 7.6], [0, 1.0, -0.6], 42, 'easeInOut'], [1, [0, 1.75, 6.4], [0, 1.05, 0.9], 40, 'easeInOut']]),
};
const CAMS = Object.fromEntries(Object.keys(BASECAM).map((k) => [k, BASECAM[k]()]));
const SHADOW_AT = { hook: [0, 1, -3], gearM: [-2.9, 1, 2.2], gearR: [2.4, 1, 2.2], charge: [-1.3, 1, 0.6], tortoise: [0.5, 1, 0.4], night: [0, 1, 1.6], fire: [1.5, 1, 0.7], verdict: [0, 1, -1] };
const BRIDGE = 12; // frames: camera glides from the previous shot's end pose (one connected valley, no jump cuts)
const fovFeel = (f) => { // speed feel: widen on the charge, the wall's advance and the fire flare
  let b = 0; const bump = (id, t0, t1, peak) => { if (IN(id, f, t0, t1)) b += peak * Math.sin(Math.PI * ramp(f, TF(id, t0), TF(id, t1))); };
  bump('charge', 0, 0.8, 3.2); bump('tortoise', 0.1, 0.9, 2.2); bump('fire', 0.35, 0.75, 1.6); bump('verdict', 0.85, 1, 1.8); return b;
};
const SHAKES = [{ f: TF('charge', 0.03), a: 0.003 }, { f: TF('tortoise', 0.3), a: 0.004 }, { f: TF('tortoise', 0.47), a: 0.004 }, { f: TF('tortoise', 0.64), a: 0.0045 }];
const SHAKE_SHAPE = [1, -0.62, 0.3, -0.12];
const shotCam = (id, f) => {
  let c = camFromKeys(CAMS[id], f, { creep: 0.0009 });
  const D = dirFor(id, f);
  c = { ...c, look: lerp3(c.look, D.point, D.w) };
  if (D.seg.posW && f >= D.seg.a && f <= D.seg.b) {
    const fade = smooth(ramp(f, D.seg.a, D.seg.a + 5)) * (1 - smooth(ramp(f, D.seg.b - 5, D.seg.b)));
    const p0 = D.seg.pos(D.seg.a), p1 = D.seg.pos(f);
    if (fade > 0) c.pos = c.pos.map((v, i) => v + (p1[i] - p0[i]) * D.seg.posW * fade);
  }
  return c;
};
export const camAt = (f) => {
  const S = shotAt(f);
  let c = shotCam(S.id, f);
  if (f - S.a < BRIDGE && S.a > 0) {
    const P = SHOTS[SHOTS.indexOf(S) - 1];
    const pc = shotCam(P.id, P.b);
    const t = smooth(ramp(f, S.a, S.a + BRIDGE));
    c = { pos: lerp3(pc.pos, c.pos, t), look: lerp3(pc.look, c.look, t), fov: lerp(pc.fov, c.fov, t), roll: lerp(pc.roll || 0, c.roll || 0, t) };
  }
  c.fov += fovFeel(f);
  for (const s of SHAKES) { const d = f - s.f; if (d >= 0 && d < 4) { const m = s.a * SHAKE_SHAPE[d]; c.pos = [c.pos[0] + m * 0.5, c.pos[1] + m, c.pos[2]]; c.look = [c.look[0] + m * 0.8, c.look[1] + m * 1.4, c.look[2]]; } }
  let flash = 0;
  if (f < 9) flash = -0.95 * (1 - f / 9); // fade in from black only
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const cinf = { hook: 4, gearM: 10, gearR: 10, charge: 6, tortoise: 6, night: 8, fire: 7, verdict: 8 }[S.id] ?? 0;
  return { focus: dist(C.pos, dirAt(f).point), cinf };
};

// ---------- world state (drives the battlefield in main.js worldState) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, usOff: 0, rmOff: 0, runMode: 0, fogA: 0, wall: 0, fire: 0, fireGlow: 0, stack: 0, rmStack: 0, sway: f };
  if (S.id === 'charge' || S.id === 'tortoise') { W.usOff = usFrontX(f) - US_FRONT0; W.rmOff = rmFrontX(f) - RM_FRONT0; }
  if (S.id === 'fire' || S.id === 'verdict') W.rmOff = rmFrontX(f) - RM_FRONT0;
  if (S.id === 'fire') W.wall = 1;
  if (S.id === 'verdict') W.wall = 1 - smooth(ramp(f, TF('verdict', 0.02), TF('verdict', 0.18))); // dawn: the legion grounds its shields
  if (S.id === 'gearR') W.runMode = 1;                       // lockstep march past the camera
  if (S.id === 'charge') W.runMode = 2;                      // full run
  if (S.id === 'tortoise') W.wall = WALL_FORM(f);
  if (S.id === 'night') W.fogA = smooth(ramp(f, TF('night', 0.2), TF('night', 0.45))) * 0.8 * (1 - smooth(ramp(f, TF('night', 0.93), TF('night', 1))));
  if (S.id === 'fire') { W.fire = smooth(ramp(f, TF('fire', 0.08), TF('fire', 0.3))); W.fireGlow = smooth(ramp(f, TF('fire', 0.15), TF('fire', 0.55))); W.fogA = 0.8 * (1 - smooth(ramp(f, TF('fire', 0.1), TF('fire', 0.55)))); }
  if (S.id === 'verdict') { W.fire = 1; W.fireGlow = 1; W.stack = Math.min(5, Math.floor(ramp(f, TF('verdict', 0.05), TF('verdict', 0.68)) * 5.99)); W.rmStack = Math.min(4, Math.floor(ramp(f, TF('verdict', 0.1), TF('verdict', 0.7)) * 4.99)); if (f >= TF('verdict', 0.78)) W.shake = 1; }
  return W;
};

// ---------- cast ----------
export const US_KIT = { tunic: '#5c6647', skin: '#f5c9a0', helmet: 'ww2', hair: '#3b2a20' };            // Marines: green kit, steel helmet
export const US_CAP = { tunic: '#4c563e', skin: '#f5c9a0', cap: '#3f4a34', moustache: '#3a2a1c' };        // Marine captain: peaked cap
export const RM_KIT = 'legion';                                                                          // Romans: the roman.js legion outfit (red tunic, galea, armor, scutum)
export const RM_CAP = { tunic: '#b8322f', cape: '#8f2228', skin: '#ecd0b6', helmet: true, armor: true, spear: false, shield: false, moustache: '#241a14' }; // centurion
const R = (T, who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'o' + JSON.stringify(who)) + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { day: '#ffffff', golden: '#ffe2c8', night: '#b9c8ff', nightfire: '#ffd9ae', dawn: '#ffe9cf' };

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  const A = (who, o, pos, extra) => out.push(R(T, who, o, pos, { tint, ...extra }));
  switch (S.id) {
    case 'hook': {
      // both captains at their front lines: point at the enemy army, then fold arms, unblinking
      const pt = IN('hook', f, 0.12, 0.55);
      A(US_CAP, { seed: 21, expr: 'stubborn', L: 'hip', R: pt ? 'point' : 'cross', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), headTilt: -4 }, [-4.45, 0, 1.3], { s: 0.98 });
      A(US_KIT, { seed: 14, expr: 'stern', L: 'hang', R: 'hang', blink: blinkAt(f, 14), bob: q(breath(f, 14), 3) }, [-5.35, 0, 0.6], { s: 0.95 });
      A(RM_CAP, { seed: 22, expr: 'stubborn', L: pt ? 'point' : 'cross', R: 'hip', blink: blinkAt(f, 22), bob: q(breath(f, 22), 3), headTilt: 4 }, [4.45, 0, 1.3], { s: 0.98 });
      A(RM_KIT, { seed: 15, expr: 'stern', L: 'shield', R: 'spear', blink: blinkAt(f, 15), bob: q(breath(f, 15), 3) }, [5.35, 0, 0.6], { s: 0.95 });
      break;
    }
    case 'gearM': {
      // the Marine gear demo: scans the field, pulls the night-vision goggles down on the beat, grins
      const scan = kf([[TF('gearM', 0), -6], [TF('gearM', 0.3), 7], [TF('gearM', 0.55), 0], [TF('gearM', 1), -3]], f);
      const raise = IN('gearM', f, 0.34, 0.62);
      A(US_KIT, { seed: 11, expr: f >= TF('gearM', 0.8) ? 'grin' : 'stern', L: 'hang', R: raise ? 'up' : 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), headTilt: q(scan, 1), step: 0 }, [-2.9, 0, 2.2], { s: 1.12 });
      break;
    }
    case 'gearR': {
      // the Roman gear demo: hero with shield + short sword, three legionaries in PERFECT lockstep behind
      const m = rmMarch(f);
      A(RM_KIT, { seed: 12, expr: 'stern', L: 'shield', R: 'hang', blink: blinkAt(f, 12), bob: q(m.bob, 3), headTilt: 0, step: q(m.phase, 2) }, [m.x - 0.7, 0, 2.2], { s: 1.12 });
      for (let i = 0; i < 3; i++) A(RM_KIT, { seed: 13 + i, expr: 'neutral', L: 'shield', R: 'spear', blink: blinkAt(f, 13 + i), bob: q(m.bob, 3), headTilt: 0, step: q(m.phase, 2) }, [m.x + 0.55 + i * 0.85, 0, 1.1 - (i % 2) * 0.5], { s: 0.98 });
      break;
    }
    case 'charge': {
      // the Marine front runner (tracked subject) + the Roman front man in lockstep; dust in fxAt
      const r = usRunner(f);
      A(US_KIT, { seed: 11, expr: 'stern', L: 'hang', R: 'hang', blink: 0, bob: 0, headTilt: 2, step: q(r.phase, 2) }, r.pos, { s: 1.08, roll: -0.05 });
      A(RM_KIT, { seed: 12, expr: 'stern', L: 'shield', R: 'spear', blink: 0, bob: q(Math.abs(Math.sin((f - TF('charge', 0)) * 0.55)) * 0.03, 3), headTilt: 2, step: q(((f - TF('charge', 0)) * 0.036) % 1, 2) }, [rmFrontX(f) + 0.6, 0, 0.9], { s: 1.08, roll: 0.05 });
      break;
    }
    case 'tortoise': {
      // the centurion urges the wall on from behind it; late in the shot the tracked Marine backs away, wide-eyed
      A(RM_CAP, { seed: 22, expr: 'stern', L: 'point', R: 'hip', blink: blinkAt(f, 22), bob: q(breath(f, 22), 3), headTilt: 3 }, [rmFrontX(f) + 1.15, 0, 0.3], { s: 1.0 });
      if (f >= TF('tortoise', 0.5)) { const r = usRunner(f); A(US_KIT, { seed: 11, expr: 'shock', L: 'reach', R: 'reach', blink: 0, bob: 0, headTilt: -2, step: q(r.phase, 2) }, r.pos, { s: 1.05, roll: 0.04 }); }
      break;
    }
    case 'night': {
      // dark + fog: the Marine's goggles glow (fxAt); the Roman feels around blindly, comic-slow
      const feel = Math.sin((f - TF('night', 0)) * 0.05) * 6;
      A(US_KIT, { seed: 11, expr: f < TF('night', 0.4) ? 'shock' : 'grin', L: 'reach', R: 'reach', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), headTilt: q(feel, 1) }, [-1.5, 0, 1.6], { s: 1.05 });
      A(RM_KIT, { seed: 12, expr: f < TF('night', 0.4) ? 'shock' : 'dazed', L: 'reach', R: 'reach', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: q(-feel, 1) }, [1.5, 0, 1.6], { s: 1.05 });
      break;
    }
    case 'fire': {
      // the Roman hero raises his torch as the ring catches; the Marine squints into the sudden light
      const lit = f >= TF('fire', 0.3);
      A(RM_KIT, { seed: 12, expr: lit ? 'grin' : 'stern', L: 'shield', R: lit ? 'lift' : 'reach', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: 2 }, [0.4, 0, 1.8], { s: 1.08 });
      A(US_KIT, { seed: 11, expr: lit ? 'squint' : 'shock', L: 'reach', R: 'reach', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), headTilt: -3 }, [-1.3, 0, 1.8], { s: 1.05 });
      break;
    }
    case 'verdict': {
      // discipline montage: crate shuttle vs the clockwork grain march; one sleeper per side works the night shift;
      // finale: captains shake hands over a crate, both heroes flank them laughing
      const fin = f >= TF('verdict', 0.76);
      if (!fin) {
        const ur = usRacer(f), rr = rmRacer(f);
        const carryU = IN('verdict', f, 0.04, 0.34) || IN('verdict', f, 0.4, 0.64);
        A(US_KIT, { seed: 11, expr: 'stern', L: carryU ? 'lift' : 'hang', R: carryU ? 'lift' : 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), step: q(ur.phase, 2) }, [ur.x, 0, -2.6], { s: 1.02 });
        A(RM_KIT, { seed: 12, expr: 'stern', L: 'shield', R: 'spear', blink: blinkAt(f, 12), bob: q(rr.bob, 3), step: q(rr.phase, 2) }, [rr.x, 0, -2.6], { s: 1.02 });
        A(US_KIT, { seed: 14, expr: 'snore', L: 'hang', R: 'hang', blink: 1, bob: q(breath(f, 14) * 1.6, 3), headTilt: 6 }, [-2.3, -0.55, -3.3], { s: 0.95, roll: 0.5 });
        A(RM_KIT, { seed: 16, expr: 'snore', L: 'hang', R: 'hang', blink: 1, bob: q(breath(f, 16) * 1.6, 3), headTilt: -6 }, [2.3, -0.5, -3.3], { s: 0.95, roll: -0.45 });
      } else {
        A(US_CAP, { seed: 21, expr: 'grin', L: 'hip', R: 'reach', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), headTilt: -2 }, [usCapX(f), 0, 0.9], { s: 1.05 });
        A(RM_CAP, { seed: 22, expr: 'grin', L: 'reach', R: 'hip', blink: blinkAt(f, 22), bob: q(breath(f, 22), 3), headTilt: 2 }, [rmCapX(f), 0, 0.9], { s: 1.05 });
        A(US_KIT, { seed: 11, expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 11), bob: q(breath(f, 11) + laugh(f, TF('verdict', 0.86), TF('verdict', 1), 0.02), 3) }, [-1.35, 0, 0.1], { s: 1.0 });
        A(RM_KIT, { seed: 12, expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 12), bob: q(breath(f, 12) + laugh(f, TF('verdict', 0.86), TF('verdict', 1), 0.02), 3) }, [1.35, 0, 0.1], { s: 1.0 });
      }
      break;
    }
  }
  return out;
};

// ---------- props (overlay cards drawn in the hero's design space; order 3 = on top) ----------
const PROP = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 3, ground: 0, ...extra });
const propGoggles = (p, down) => { // strap + twin NV lenses over the eyes (head centre ~ (300, 276) in design space)
  p.poly([[212, 252], [388, 252], [388, 272], [212, 272]], '#2c2f33', 4);
  if (down > 0) { p.ell(258, 284, 34, 26, '#1d3a26', 6); p.ell(342, 284, 34, 26, '#1d3a26', 6); p.ell(258, 284, 24, 17, '#39d97e', 0); p.ell(342, 284, 24, 17, '#39d97e', 0); p.ell(250, 278, 7, 5, '#c8ffe2', 0); p.ell(334, 278, 7, 5, '#c8ffe2', 0); }
};
const propRadio = (p) => { // shoulder radio: box + whip antenna + speaker grille
  p.poly([[392, 452], [444, 452], [444, 528], [392, 528]], '#33373c', 5);
  p.stroke([[428, 452], [452, 318]], 5, '#22252a'); p.dot(452, 314, 5, '#c8ccd2');
  for (let i = 0; i < 3; i++) p.stroke([[400, 470 + i * 12], [436, 470 + i * 12]], 3, '#191c20');
  p.dot(404, 512, 5, '#d94f3d');
};
const propRifle = (p) => { // smart rifle held diagonal: body, optic sight, mag, barrel
  p.stroke([[196, 706], [404, 470]], 26, '#3a3f45'); p.stroke([[196, 706], [404, 470]], 12, '#565d66');
  p.stroke([[404, 470], [452, 424]], 9, '#22252a');
  p.poly([[296, 548], [330, 566], [318, 606], [286, 586]], '#2c3036', 4);
  p.poly([[330, 500], [368, 522], [360, 544], [324, 524]], '#22252a', 4);
  p.ell(349, 512, 9, 9, '#7fd4ff', 2);
  p.poly([[238, 640], [272, 660], [258, 690], [226, 668]], '#4a3a28', 4);
};
const propSword = (p) => { // gladius: short broad blade angled down from the right hand, brass guard, wooden grip
  p.stroke([[352, 452], [384, 488]], 9, '#5a3a24');
  p.poly([[366, 478], [404, 460], [414, 478], [376, 496]], '#d9a845', 3);
  p.stroke([[392, 492], [480, 664]], 11, '#cfd6dd'); p.stroke([[398, 496], [482, 660]], 3, '#8f979f');
  p.stroke([[386, 486], [470, 640]], 2.5, '#ffffff88');
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
const fxGlowCol = (p, a, rgb) => {
  const g = p.g;
  const gr = g.createRadialGradient(300, 640, 12, 300, 640, 300);
  gr.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`);
  gr.addColorStop(0.55, `rgba(${rgb},${(a * 0.45).toFixed(3)})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 600, 1000);
};
const fxFlame = (p, t) => { // torch flame: three nested teardrops, flicker phase t
  const fl = 1 + 0.16 * Math.sin(t * Math.PI * 4);
  p.ell(300, 486, 58, 118 * fl, '#ff7a26', 0);
  p.ell(300, 524, 40, 82 * fl, '#ffb03a', 0);
  p.ell(300, 556, 22, 46, '#ffe9a8', 0);
};
const cardDraw = (lines, bg, fg) => (p) => { // big retention title card (design space 600x1000)
  const g = p.g, w = 548, h = 108 + lines.length * 116, x = 300 - w / 2, y = 452 - h / 2;
  g.save();
  g.beginPath(); g.roundRect(x, y, w, h, 26); g.fillStyle = bg; g.fill(); g.lineWidth = 10; g.strokeStyle = fg; g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((ln, i) => { g.font = `900 ${ln[1]}px Arial, sans-serif`; g.fillText(ln[0], 300, y + 74 + i * 116); });
  g.restore();
};
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const glow = (tp, s, a, rgb = '255,208,112') => out.push(FX('glow' + rgb + q(a, 2) + '_' + q(tp[0], 1), (p) => fxGlowCol(p, a, rgb), [tp[0], tp[1] - 0.81 * s, tp[2] + 0.12], s));
  const beat = (id, t0, t1, lines, pos, bg, fg, s = 1) => { // title card with a pop-in scale
    if (IN(id, f, t0, t1)) { const pop = 0.85 + 0.15 * M.back(Math.min(1, (f - TF(id, t0)) / 10)); out.push(FX('card' + id + t0, cardDraw(lines, bg, fg), pos, s * pop)); }
  };
  // ---- tracked-object glow: the eye follows whatever the director is tracking ----
  const D = dirAt(f);
  if (D.seg.type === 'object') glow(D.point, (D.seg.id === 'boardUS' || D.seg.id === 'boardRM') ? 1.6 : 0.7, 0.16 + 0.05 * Math.sin(f * 0.35));
  // ---- retention title cards on the key beats ----
  beat('hook', 0.55, 0.92, [['1000', 118], ['ROMANS', 62]], [2.1, 2.5, 7.2], '#7c241c', '#ffe9a8', 1.3);
  beat('gearR', 0.03, 0.2, [['MARCHED', 62], ['3 CONTINENTS', 62]], [3.31, 0.95, 1.42], '#7c241c', '#ffe9a8', 1.05);
  beat('tortoise', 0.06, 0.3, [['THE', 52], ['TORTOISE!', 104]], [1.1, 1.3, 2.1], '#5a4632', '#ffd98a', 1.32);
  beat('fire', 0.3, 0.62, [['RING OF FIRE!', 82]], [1.8, 1.25, 1.1], '#8a3a14', '#ffe9a8', 1.25);
  // ---- gear props ----
  if (S.id === 'gearM') {
    const down = smooth(ramp(f, TF('gearM', 0.42), TF('gearM', 0.52))) * (1 - smooth(ramp(f, TF('gearM', 0.74), TF('gearM', 0.84))));
    out.push(PROP('radio', propRadio, [-2.9, 0, 2.21], 1.12));
    out.push(PROP('rifle', propRifle, [-2.9, 0, 2.21], 1.12));
    out.push(PROP('gog' + q(down, 2), (p) => propGoggles(p, down), [-2.9, 0, 2.22], 1.12));
  }
  if (S.id === 'gearR') { const m = rmMarch(f); out.push(PROP('sword', propSword, [m.x - 0.7, 0, 2.21], 1.12)); }
  // ---- charge: dust at both front lines + muzzle-flash light bursts (light only, nobody is hit) ----
  if (S.id === 'charge' && IN('charge', f, 0.03, 0.85)) {
    for (let i = 0; i < 4; i++) {
      const cyc = ((f - TF('charge', 0)) * 0.05 + i * 0.27) % 1;
      out.push(FX('dustU' + i + q(cyc, 2), (p) => T.fxDust(p, cyc, '#cbb894'), [usFrontX(f) - 0.4 - (i % 2) * 0.9, 0.25, 0.4 + i * 0.55], 0.4));
      out.push(FX('dustR' + i + q(cyc, 2), (p) => T.fxDust(p, cyc, '#cbb894'), [rmFrontX(f) + 0.4 + (i % 2) * 0.9, 0.25, 0.4 + i * 0.55], 0.4));
    }
    { const rp = usRunner(f).pos; for (let i = 0; i < 2; i++) { const cyc = ((f - TF('charge', 0)) * 0.06 + i * 0.5) % 1;
      out.push(FX('dustRun' + i + q(cyc, 2), (p) => T.fxDust(p, cyc, '#cbb894'), [rp[0] - 0.25 - i * 0.3, 0.22, rp[2]], 0.34)); } }
    if (f % 8 < 2) out.push(FX('muzU' + f, (p) => T.fxStars(p, 0.4), [usFrontX(f) + 0.3, 1.15, 0.7], 0.35));
  }
  // ---- tortoise: strobes BOUNCE off the shield faces + dust boils at the wall's base ----
  if (S.id === 'tortoise') {
    if (IN('tortoise', f, 0.3, 0.95) && f % 7 < 2) {
      const wx = rmFrontX(f) - 0.55, wy = 0.9 + ((f * 7) % 3) * 0.28, wz = 0.2 + ((f * 13) % 5) * 0.35;
      out.push(FX('spark' + f, (p) => T.fxStars(p, 0.5), [wx, wy, wz], 0.3));
    }
    if (IN('tortoise', f, 0.35, 1)) for (let i = 0; i < 3; i++) {
      const cyc = ((f - TF('tortoise', 0)) * 0.045 + i * 0.36) % 1;
      out.push(FX('dustW' + i + q(cyc, 2), (p) => T.fxDust(p, cyc, '#cbb894'), [rmFrontX(f) - 0.3 - (i % 2) * 0.5, 0.22, -0.3 + i * 0.7], 0.42));
    }
    if (f >= TF('tortoise', 0.55)) { const rp = usRunner(f).pos; const cyc = ((f - TF('tortoise', 0)) * 0.06) % 1; // retreat dust at the Marine's heels
      out.push(FX('dustRet' + q(cyc, 2), (p) => T.fxDust(p, cyc, '#cbb894'), [rp[0] + 0.3, 0.22, rp[2]], 0.32)); }
  }
  // ---- night: the goggles' green glow lights the Marine hero's face ----
  if (S.id === 'night' && IN('night', f, 0.3, 0.8)) glow([-1.5, 1.45, 1.6], 0.55, 0.2 + 0.05 * Math.sin(f * 0.4), '80,255,150');
  // ---- ring of fire: flames on every torch + pit once lit (fire shot lights progressively, verdict stays lit) ----
  const W = worldAt(f);
  if (W.fire > 0) {
    TORCHES.forEach(([tx, tz], i) => { if (W.fire > i / TORCHES.length) { const t = q(((f + i * 7) % 18) / 18, 2); out.push(FX('flT' + i + t, (p) => fxFlame(p, t), [tx, 0, tz], 0.5)); } });
    FIRE_PITS.forEach(([px, pz], i) => { if (W.fire > 0.4 + i * 0.12) { const t = q(((f + i * 11 + 5) % 18) / 18, 2); out.push(FX('flP' + i + t, (p) => fxFlame(p, t), [px, -0.55, pz], 0.85)); } });
    if (W.fireGlow > 0) glow([2.4, 1.3, 0.8], 2.2, (0.1 + 0.22 * W.fireGlow) * (0.92 + 0.08 * Math.sin(f * 0.5)), '255,160,60');
  }
  if (S.id === 'fire' && f >= TF('fire', 0.3)) { const t = q((f % 18) / 18, 2); out.push(FX('flHand' + t, (p) => fxFlame(p, t), [0.85, 0.95, 1.9], 0.42)); } // the hero's raised torch
  // ---- verdict: sleepers' Zzz + set-down dust at both stacks + finale glint on the handshake crate ----
  if (S.id === 'verdict' && f < TF('verdict', 0.76)) {
    const t = q(((f - TF('verdict', 0)) % 45) / 45, 2);
    out.push(FX('zzzU' + t, (p) => T.fxZ(p, t), [-2.05, 1.15, -3.2], 0.3));
    out.push(FX('zzzR' + t, (p) => T.fxZ(p, (t + 0.5) % 1), [2.55, 1.1, -3.2], 0.3));
    for (const td of [0.3, 0.62]) if (f >= TF('verdict', td) && f < TF('verdict', td) + 10) { const t2 = q((f - TF('verdict', td)) / 10, 2); out.push(FX('sdust' + td + t2, (p) => T.fxDust(p, t2, '#cbb894'), [STACK_AT[0] + 0.3, 0.3, -2.7], 0.3)); }
    for (const td of [0.34, 0.66]) if (f >= TF('verdict', td) && f < TF('verdict', td) + 10) { const t2 = q((f - TF('verdict', td)) / 10, 2); out.push(FX('rdust' + td + t2, (p) => T.fxDust(p, t2, '#cbb894'), [RM_STACK_AT[0] - 0.3, 0.3, -2.7], 0.3)); }
  }
  if (S.id === 'verdict' && IN('verdict', f, 0.86, 1)) { const t = q(ramp(f, TF('verdict', 0.86), TF('verdict', 1)), 2); out.push(FX('vglint' + t, (p) => T.fxStars(p, t), [0, 1.35, 1.0], 0.32)); }
  return out;
};
