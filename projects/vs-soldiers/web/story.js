// "1000 Chinese Soldiers vs 1000 US Soldiers" — fun comparison short (no gore: dust, pushes,
// comic mud falls). ONE connected battlefield valley, day -> dusk -> night/fog -> dawn.
//
// STRUCTURE RULE: every timing in this file flows from the TIMING table below. Shots, keyframe
// tracks, the TRACKDIR director and world state all read phrase boundaries via TF(id, t)
// (frame at fraction t of a phrase). Parent patches TIMING when the real voice lands and the
// whole edit retimes itself. Estimated timings for now (30 fps).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30;
export const TIMING = [
  ['hook', 0, 151],        // "1000 vs 1000" — two armies face off
  ['gearUS', 151, 350],    // US gear close-up (goggles / radio / sight)
  ['gearCN', 350, 497],   // China gear + lockstep march
  ['charge', 497, 679],   // both lines charge, dust, front-runner tracking
  ['hold', 679, 802],     // the lines hold, captains face off
  ['night', 802, 1013],    // night falls, fog, night-vision beat
  ['mud', 1013, 1086],      // dawn mud: comic slips, courage
  ['verdict', 1086, 1441], // supply-race montage + handshake at dawn
];
export const TOTAL = TIMING[TIMING.length - 1][2]; // 1170
const T0 = Object.fromEntries(TIMING.map(([id, a, b]) => [id, [a, b]]));
export const TF = (id, t) => Math.round(T0[id][0] + (T0[id][1] - T0[id][0]) * t);
const IN = (id, f, t0 = 0, t1 = 1) => f >= TF(id, t0) && f <= TF(id, t1); // frame inside a phrase window
const LIGHT_OF = { hook: 'day', gearUS: 'day', gearCN: 'golden', charge: 'day', hold: 'dusk', night: 'night', mud: 'golden', verdict: 'golden' };
export const SHOTS = TIMING.map(([id, a, b]) => ({ id, a, b: b - 1, light: LIGHT_OF[id] }));
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;

// ---------- lights (Bear v4 values) ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 240,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 18, ...WATER },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 40, fogFar: 220,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', vig: 0.26, shadowExt: 18, ...WATER },
  night: { az: 60, el: 38, sky: '#33456b', ground: '#1c1a20', hemi: 0.95, sun: '#aebfff', sunI: 1.15, fog: '#232c40', fogNear: 10, fogFar: 70,
    skyTop: '#131c30', skyHor: '#2c3a55', sat: 1.03, vig: 0.3, shadowExt: 10, waterDeep: '#1c2c3c', waterShal: '#2c445c', glint: '#cfe0ff' },
  dusk: { az: 30, el: 20, sky: '#8d8578', ground: '#4c4438', hemi: 0.95, sun: '#ffb46c', sunI: 2.0, fog: '#9a8a76', fogNear: 30, fogFar: 160,
    skyTop: '#5c5648', skyHor: '#d9a06a', sunDisc: '#ffe9c0', sunSize: 0.003, sat: 1.04, vig: 0.3, shadowExt: 16, waterDeep: '#2c445c', waterShal: '#3a5a74', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- shared stage geometry (== main.js world build) ----------
export const BOARD_US = [-7.7, 3.4, -4.2], BOARD_CN = [7.7, 3.4, -4.2]; // the giant "1000" boards
const US_FRONT0 = -4.8, CN_FRONT0 = 4.8;                                     // rank front lines (main.js ranks sit here)
export const STACK_AT = [-1.5, 0.45, -2.9];                                // supply-crate stack (verdict)
export const SHAKE_AT = [0, 0.8, 0.9];                                     // handshake crate at the finale
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
const laugh = (f, a, b, amp) => (f >= a && f < b) ? Math.abs(Math.sin((f - a) * 0.55)) * amp * Math.min(1, (f - a) / 6) * Math.min(1, (b - f) / 6) : 0;

// ---------- subject tracks (actors + camera + world read the SAME tracks) ----------
// Charge: both front lines advance (US ragged-fast, CN lockstep-steady) and stop 4 m apart.
export const usFrontX = (f) => kf([[TF('charge', 0), US_FRONT0], [TF('charge', 0.72), -2.0, 'easeInOut'], [TF('charge', 1), -4.6]], f);
export const cnFrontX = (f) => kf([[TF('charge', 0), CN_FRONT0], [TF('charge', 0.8), 2.0, 'smooth'], [TF('charge', 1), 4.6]], f);
// The US front runner the camera rides with during the charge.
export const usRunner = (f) => {
  const x = kf([[TF('charge', 0), -4.2], [TF('charge', 0.72), -1.05, 'easeInOut'], [TF('charge', 1), -1.05], [TF('hold', 0.35), -0.9, 'smooth']], f);
  const run = IN('charge', f, 0.02, 0.78) ? Math.abs(Math.sin((f - TF('charge', 0)) * 0.55)) * 0.07 : 0;
  return { pos: [x, run, 0.8], phase: ((f - TF('charge', 0)) * 0.045) % 1 };
};
// CN lockstep group (gearCN): one shared phase — the whole group marches as one body.
export const cnMarch = (f) => {
  const x = kf([[TF('gearCN', 0), 3.8], [TF('gearCN', 1), 2.4, 'smooth']], f);
  return { x, phase: ((f - TF('gearCN', 0)) * 0.036) % 1, bob: Math.abs(Math.sin((f - TF('gearCN', 0)) * 0.55)) * 0.035 };
};
// Captains walk to the centre for the stand-off (hold) and again for the handshake (verdict).
export const usCapX = (f) => kf([[TF('hold', 0.05), -4.2], [TF('hold', 0.42), -0.95, 'easeInOut'], [TF('hold', 1), -0.95],
  [TF('verdict', 0.78), -0.95], [TF('verdict', 0.92), -0.46, 'easeInOut'], [TF('verdict', 1), -0.46]], f);
export const cnCapX = (f) => kf([[TF('hold', 0.05), 4.2], [TF('hold', 0.42), 0.95, 'easeInOut'], [TF('hold', 1), 0.95],
  [TF('verdict', 0.78), 0.95], [TF('verdict', 0.92), 0.46, 'easeInOut'], [TF('verdict', 1), 0.46]], f);
// Mud falls: roll + sink envelopes for the two heroes (US falls first, CN second).
export const usFall = (f) => kf([[TF('mud', 0.22), 0], [TF('mud', 0.32), 1, 'easeIn'], [TF('mud', 0.52), 1], [TF('mud', 0.66), 0, 'easeOut'], [TF('mud', 1), 0]], f);
export const cnFall = (f) => kf([[TF('mud', 0.55), 0], [TF('mud', 0.65), 1, 'easeIn'], [TF('mud', 0.8), 1], [TF('mud', 0.92), 0, 'easeOut'], [TF('mud', 1), 0]], f);
// Verdict supply race: heroes shuttle crates across the back lane (z = -2.6).
export const usRacer = (f) => ({ x: kf([[TF('verdict', 0.04), -2.8], [TF('verdict', 0.3), 0.8, 'easeInOut'], [TF('verdict', 0.38), 0.8], [TF('verdict', 0.62), -2.8, 'easeInOut'], [TF('verdict', 0.7), -2.8]], f), phase: ((f - TF('verdict', 0)) * 0.04) % 1 });
export const cnRacer = (f) => ({ x: kf([[TF('verdict', 0.1), 2.8], [TF('verdict', 0.36), -0.8, 'easeInOut'], [TF('verdict', 0.44), -0.8], [TF('verdict', 0.68), 2.8, 'easeInOut'], [TF('verdict', 0.74), 2.8]], f), phase: ((f - TF('verdict', 0)) * 0.04 + 0.5) % 1 });

// ---------- TRACKING DIRECTOR ----------
const US_HERO_HD = [-2.9, 1.5, 2.2], CN_HERO_HD = [2.6, 1.5, 2.2]; // gear heroes' heads (goggles ride here)
const TRACKDIR = {
  hook: [
    { a: TF('hook', 0), b: TF('hook', 0.38), type: 'object', id: 'boardUS', pos: () => BOARD_US, w: 0.5 },
    { a: TF('hook', 0.38), b: TF('hook', 0.62), type: 'subject', id: 'midfield', pos: () => [0, 1.5, -2], w: 0.35, blend: 26 },
    { a: TF('hook', 0.62), b: TF('hook', 1), type: 'object', id: 'boardCN', pos: () => BOARD_CN, w: 0.5, blend: 26 },
  ],
  gearUS: [
    { a: TF('gearUS', 0), b: TF('gearUS', 0.42), type: 'character', id: 'usHero', pos: () => [-2.9, 1.15, 2.2], w: 0.5 },
    { a: TF('gearUS', 0.42), b: TF('gearUS', 0.8), type: 'object', id: 'goggles', pos: () => US_HERO_HD, w: 0.62 },
    { a: TF('gearUS', 0.8), b: TF('gearUS', 1), type: 'character', id: 'usHero', pos: () => [-2.9, 1.15, 2.2], w: 0.5 },
  ],
  gearCN: [
    { a: TF('gearCN', 0), b: TF('gearCN', 0.38), type: 'object', id: 'rifle', pos: (f) => [cnMarch(f).x - 0.7, 1.05, 2.2], w: 0.55 },
    { a: TF('gearCN', 0.38), b: TF('gearCN', 1), type: 'character', id: 'cnHero', pos: (f) => [cnMarch(f).x - 0.7, 1.15, 2.2], w: 0.55 },
  ],
  charge: [
    { a: TF('charge', 0), b: TF('charge', 0.78), type: 'subject', id: 'usRunner', pos: (f) => { const r = usRunner(f); return [r.pos[0], 1.2, r.pos[2]]; }, w: 0.68, posW: 0.35 },
    { a: TF('charge', 0.78), b: TF('charge', 1), type: 'subject', id: 'cnFront', pos: (f) => [cnFrontX(f), 1.1, 0.4], w: 0.5 },
  ],
  hold: [
    { a: TF('hold', 0), b: TF('hold', 0.55), type: 'character', id: 'usCap', pos: (f) => [usCapX(f), 1.25, 0.6], w: 0.22 },
    { a: TF('hold', 0.55), b: TF('hold', 1), type: 'character', id: 'cnCap', pos: (f) => [cnCapX(f), 1.25, 0.6], w: 0.22 },
  ],
  night: [
    { a: TF('night', 0), b: TF('night', 0.55), type: 'subject', id: 'usHero', pos: () => [-1.5, 1.2, 1.6], w: 0.55 },
    { a: TF('night', 0.55), b: TF('night', 1), type: 'subject', id: 'cnHero', pos: () => [1.5, 1.2, 1.6], w: 0.55 },
  ],
  mud: [
    { a: TF('mud', 0), b: TF('mud', 0.55), type: 'subject', id: 'usHero', pos: () => [-1.15, 0.9, 1.2], w: 0.3 },
    { a: TF('mud', 0.55), b: TF('mud', 1), type: 'subject', id: 'cnHero', pos: () => [1.15, 0.9, 1.2], w: 0.3 },
  ],
  verdict: [
    { a: TF('verdict', 0), b: TF('verdict', 0.55), type: 'object', id: 'crate', pos: () => STACK_AT, w: 0.55 },
    { a: TF('verdict', 0.55), b: TF('verdict', 0.85), type: 'character', id: 'racers', pos: (f) => [(usRacer(f).x + cnRacer(f).x) / 2, 1.0, -2.6], w: 0.45 },
    { a: TF('verdict', 0.85), b: TF('verdict', 1), type: 'object', id: 'shakeCrate', pos: () => SHAKE_AT, w: 0.6 },
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
  hook: () => CK('hook', [
    [0, [0, 2.7, 19.5], [0, 1.6, -3], 50], [0.55, [0, 2.3, 16], [-1.3, 1.7, -3.5], 46, 'easeInOut'], [1, [0, 2.1, 12.5], [1.3, 1.7, -3.5], 44, 'easeInOut']]),
  gearUS: () => CK('gearUS', [
    [0, [-1.9, 1.5, 6.4], [-2.9, 1.15, 2.2], 40], [0.5, [-2.25, 1.55, 5.2], [-2.9, 1.3, 2.2], 36, 'easeInOut'], [1, [-2.45, 1.5, 5.8], [-2.9, 1.2, 2.2], 38, 'easeInOut']]),
  gearCN: () => CK('gearCN', [
    [0, [1.5, 1.5, 6.6], [2.8, 1.1, 2.2], 40], [0.5, [1.15, 1.5, 5.6], [2.4, 1.15, 2.2], 37, 'easeInOut'], [1, [0.85, 1.45, 6.0], [2.0, 1.1, 2.2], 39, 'easeInOut']]),
  charge: () => CK('charge', [
    [0, [-3.2, 1.7, 7.6], [-2.6, 1.1, 0.6], 44], [0.5, [-1.85, 1.6, 6.6], [-1.3, 1.1, 0.7], 42, 'easeInOut'], [1, [-0.26, 1.8, 7.4], [0.66, 1.1, 0.4], 43, 'easeInOut']]),
  hold: () => CK('hold', [
    [0, [0, 1.7, 9.6], [0, 1.2, 0.5], 42], [0.55, [0, 1.6, 9.0], [-0.3, 1.25, 0.6], 39, 'easeInOut'], [1, [0, 1.6, 9.0], [0.3, 1.25, 0.6], 39, 'easeInOut']]),
  night: () => CK('night', [
    [0, [-0.7, 1.5, 6.8], [-1.5, 1.15, 1.6], 41], [0.55, [0.18, 1.5, 6.4], [-0.26, 1.15, 1.6], 40, 'easeInOut'], [1, [0.8, 1.5, 6.6], [1.5, 1.15, 1.6], 41, 'easeInOut']]),
  mud: () => CK('mud', [
    [0, [-0.35, 1.7, 10.6], [-1.15, 0.95, 1.2], 42], [0.55, [0.09, 1.65, 10.2], [0.18, 0.95, 1.2], 40, 'easeInOut'], [1, [0.44, 1.7, 10.6], [1.15, 0.95, 1.2], 42, 'easeInOut']]),
  verdict: () => CK('verdict', [
    [0, [-0.8, 1.7, 4.6], [-1.5, 0.8, -2.9], 43], [0.4, [0.7, 1.6, 3.4], [-0.22, 0.9, -2.6], 41, 'easeInOut'],
    [0.8, [0, 1.8, 7.6], [0, 1.0, -0.6], 42, 'easeInOut'], [1, [0, 1.75, 6.4], [0, 1.05, 0.9], 40, 'easeInOut']]),
};
const CAMS = Object.fromEntries(Object.keys(BASECAM).map((k) => [k, BASECAM[k]()]));
const SHADOW_AT = { hook: [0, 1, -3], gearUS: [-2.9, 1, 2.2], gearCN: [2.4, 1, 2.2], charge: [-1.3, 1, 0.6], hold: [0, 1, 0.6], night: [0, 1, 1.6], mud: [0, 1, 1.2], verdict: [0, 1, -1] };
const BRIDGE = 12; // frames: camera glides from the previous shot's end pose (one connected valley, no jump cuts)
const fovFeel = (f) => { // speed feel: widen on the charge + the verdict finale push
  let b = 0; const bump = (id, t0, t1, peak) => { if (IN(id, f, t0, t1)) b += peak * Math.sin(Math.PI * ramp(f, TF(id, t0), TF(id, t1))); };
  bump('charge', 0, 0.8, 3.2); bump('verdict', 0.85, 1, 1.8); return b;
};
const SHAKES = [{ f: TF('mud', 0.32), a: 0.0045 }, { f: TF('mud', 0.65), a: 0.0045 }, { f: TF('charge', 0.03), a: 0.003 }];
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
  const cinf = { hook: 4, gearUS: 10, gearCN: 10, charge: 6, hold: 7, night: 8, mud: 7, verdict: 8 }[S.id] ?? 0;
  return { focus: dist(C.pos, dirAt(f).point), cinf };
};

// ---------- world state (drives the battlefield in main.js worldState) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, usOff: 0, cnOff: 0, runMode: 0, fogA: 0, stack: 0, sway: f };
  if (S.id === 'charge' || S.id === 'hold') { W.usOff = usFrontX(f) - US_FRONT0; W.cnOff = cnFrontX(f) - CN_FRONT0; }
  if (S.id === 'gearCN') W.runMode = 1;                       // lockstep march past the camera
  if (S.id === 'charge') W.runMode = 2;                      // full run
  if (S.id === 'night') W.fogA = smooth(ramp(f, TF('night', 0.25), TF('night', 0.5))) * (1 - smooth(ramp(f, TF('night', 0.92), TF('night', 1))));
  if (S.id === 'verdict') { W.stack = Math.min(6, Math.floor(ramp(f, TF('verdict', 0.05), TF('verdict', 0.7)) * 6.99)); if (f >= TF('verdict', 0.8)) W.shake = 1; }
  return W;
};

// ---------- cast ----------
export const US_KIT = { tunic: '#5c6647', skin: '#f5c9a0', helmet: 'ww2', hair: '#3b2a20' };            // green/tan kit, steel helmet
export const US_CAP = { tunic: '#4c563e', skin: '#f5c9a0', cap: '#3f4a34', moustache: '#3a2a1c' };        // US captain: peaked cap
export const CN_KIT = { tunic: '#8a744e', skin: '#f0c8a0', cap: '#93302a', hair: '#1e1714' };             // khaki-tan kit, red-accent cap
export const CN_CAP = { tunic: '#77643f', skin: '#ecd0b6', cap: '#7c2a24', moustache: '#241a14' };       // CN captain
const R = (T, who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'o' + JSON.stringify(who)) + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { day: '#ffffff', golden: '#ffe2c8', night: '#b9c8ff', dusk: '#ffd9ae' };

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  const A = (who, o, pos, extra) => out.push(R(T, who, o, pos, { tint, ...extra }));
  switch (S.id) {
    case 'hook': {
      // both captains at their front lines: point at the enemy army, then fold arms, unblinking
      const pt = IN('hook', f, 0.15, 0.6);
      A(US_CAP, { seed: 21, expr: 'stubborn', L: 'hip', R: pt ? 'point' : 'cross', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), headTilt: q(kf([[TF('hook', 0), 0], [TF('hook', 0.5), -4], [TF('hook', 1), -4]], f), 1) }, [-4.45, 0, 1.3], { s: 0.98 });
      A(CN_CAP, { seed: 22, expr: 'stubborn', L: pt ? 'point' : 'cross', R: 'hip', blink: blinkAt(f, 22), bob: q(breath(f, 22), 3), headTilt: q(kf([[TF('hook', 0), 0], [TF('hook', 0.5), 4], [TF('hook', 1), 4]], f), 1) }, [4.45, 0, 1.3], { s: 0.98 });
      break;
    }
    case 'gearUS': {
      // the US gear demo: scans the field, pulls the night-vision goggles down on the beat,
      // grins — every gadget in the book (radio + goggles ride as prop overlays in fxAt)
      const scan = kf([[TF('gearUS', 0), -6], [TF('gearUS', 0.3), 7], [TF('gearUS', 0.55), 0], [TF('gearUS', 1), -3]], f);
      const raise = IN('gearUS', f, 0.34, 0.62);
      A(US_KIT, { seed: 11, expr: f >= TF('gearUS', 0.8) ? 'grin' : 'stern', L: 'hang', R: raise ? 'up' : 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), headTilt: q(scan, 1), step: 0 }, [-2.9, 0, 2.2], { s: 1.12 });
      break;
    }
    case 'gearCN': {
      // the CN gear demo: hero with the smart rifle + three marchers in PERFECT lockstep behind
      const m = cnMarch(f);
      A(CN_KIT, { seed: 12, expr: 'stern', L: 'hang', R: 'hang', blink: blinkAt(f, 12), bob: q(m.bob, 3), headTilt: 0, step: q(m.phase, 2) }, [m.x - 0.7, 0, 2.2], { s: 1.12 });
      for (let i = 0; i < 3; i++) A(CN_KIT, { seed: 13 + i, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 13 + i), bob: q(m.bob, 3), headTilt: 0, step: q(m.phase, 2) }, [m.x + 0.55 + i * 0.85, 0, 1.1 - (i % 2) * 0.5], { s: 0.98 });
      break;
    }
    case 'charge': {
      // the US front runner (tracked subject) + the CN front man in lockstep; dust in fxAt
      const r = usRunner(f);
      A(US_KIT, { seed: 11, expr: 'stern', L: 'hang', R: 'hang', blink: 0, bob: 0, headTilt: 2, step: q(r.phase, 2) }, r.pos, { s: 1.08, roll: -0.05 });
      A(CN_KIT, { seed: 12, expr: 'stern', L: 'hang', R: 'hang', blink: 0, bob: q(Math.abs(Math.sin((f - TF('charge', 0)) * 0.55)) * 0.03, 3), headTilt: 2, step: q(((f - TF('charge', 0)) * 0.036) % 1, 2) }, [cnFrontX(f) + 0.6, 0, 0.9], { s: 1.08, roll: 0.05 });
      break;
    }
    case 'hold': {
      // the stand-off: captains meet in the middle, point, cross arms, stare — nobody blinks first
      const met = f >= TF('hold', 0.42);
      const pose = !met ? 'point' : (IN('hold', f, 0.42, 0.7) ? 'point' : 'cross');
      A(US_CAP, { seed: 21, expr: 'stern', L: 'hip', R: pose, blink: met ? 0 : blinkAt(f, 21), bob: q(breath(f, 21), 3), headTilt: -3, step: q(met ? 0 : ((f - TF('hold', 0.05)) * 0.04) % 1, 2) }, [usCapX(f), 0, 0.6], { s: 1.02 });
      A(CN_CAP, { seed: 22, expr: 'stern', L: pose, R: 'hip', blink: met ? 0 : blinkAt(f, 22), bob: q(breath(f, 22), 3), headTilt: 3, step: q(met ? 0 : ((f - TF('hold', 0.05)) * 0.04) % 1, 2) }, [cnCapX(f), 0, 0.6], { s: 1.02 });
      break;
    }
    case 'night': {
      // fog + dark: US hero's goggles glow (fxAt); both feel around blindly, comic-slow
      const feel = Math.sin((f - TF('night', 0)) * 0.05) * 6;
      A(US_KIT, { seed: 11, expr: f < TF('night', 0.4) ? 'shock' : 'dazed', L: 'reach', R: 'reach', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), headTilt: q(feel, 1) }, [-1.5, 0, 1.6], { s: 1.05 });
      A(CN_KIT, { seed: 12, expr: f < TF('night', 0.4) ? 'shock' : 'dazed', L: 'reach', R: 'reach', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: q(-feel, 1) }, [1.5, 0, 1.6], { s: 1.05 });
      break;
    }
    case 'mud': {
      // dawn courage: each hero charges the mud, slips flat (roll envelope), climbs up laughing
      const uf = usFall(f), cf = cnFall(f);
      A(US_KIT, { seed: 11, expr: uf > 0.5 ? 'dazed' : (f > TF('mud', 0.66) ? 'laugh' : 'stern'), L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11) + laugh(f, TF('mud', 0.68), TF('mud', 0.85), 0.02), 3), headTilt: 0, step: q(uf > 0.05 ? 0 : ((f - TF('mud', 0)) * 0.045) % 1, 2) },
        [-1.15, -0.25 * uf, 1.2], { s: 1.05, roll: q(-1.25 * uf, 2) });
      A(CN_KIT, { seed: 12, expr: cf > 0.5 ? 'dazed' : (f > TF('mud', 0.92) ? 'laugh' : 'stern'), L: 'hang', R: 'hang', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: 0, step: q(cf > 0.05 ? 0 : ((f - TF('mud', 0)) * 0.045 + 0.5) % 1, 2) },
        [1.15, -0.25 * cf, 1.2], { s: 1.05, roll: q(1.25 * cf, 2) });
      break;
    }
    case 'verdict': {
      // supply race: both heroes shuttle crates; a sleeper works the night shift (fxAt Zzz);
      // finale: captains shake hands over a crate, both heroes flank them grinning
      const fin = f >= TF('verdict', 0.8);
      if (!fin) {
        const ur = usRacer(f), cr = cnRacer(f);
        const carryU = IN('verdict', f, 0.04, 0.34) || IN('verdict', f, 0.4, 0.64);
        const carryC = IN('verdict', f, 0.1, 0.4) || IN('verdict', f, 0.46, 0.7);
        A(US_KIT, { seed: 11, expr: 'stern', L: carryU ? 'lift' : 'hang', R: carryU ? 'lift' : 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), step: q(ur.phase, 2) }, [ur.x, 0, -2.6], { s: 1.02 });
        A(CN_KIT, { seed: 12, expr: 'stern', L: carryC ? 'lift' : 'hang', R: carryC ? 'lift' : 'hang', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), step: q(cr.phase, 2) }, [cr.x, 0, -2.6], { s: 1.02 });
        A(US_KIT, { seed: 14, expr: 'snore', L: 'hang', R: 'hang', blink: 1, bob: q(breath(f, 14) * 1.6, 3), headTilt: 6 }, [-2.0, -0.55, -3.3], { s: 0.95, roll: 0.5 }); // night-shift sleeper, slumped by the stack
      } else {
        A(US_CAP, { seed: 21, expr: 'grin', L: 'hip', R: 'reach', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), headTilt: -2 }, [usCapX(f), 0, 0.9], { s: 1.05 });
        A(CN_CAP, { seed: 22, expr: 'grin', L: 'reach', R: 'hip', blink: blinkAt(f, 22), bob: q(breath(f, 22), 3), headTilt: 2 }, [cnCapX(f), 0, 0.9], { s: 1.05 });
        A(US_KIT, { seed: 11, expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 11), bob: q(breath(f, 11) + laugh(f, TF('verdict', 0.9), TF('verdict', 1), 0.02), 3) }, [-1.0, 0, 0.2], { s: 1.0 });
        A(CN_KIT, { seed: 12, expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 12), bob: q(breath(f, 12) + laugh(f, TF('verdict', 0.9), TF('verdict', 1), 0.02), 3) }, [1.0, 0, 0.2], { s: 1.0 });
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
  p.poly([[296, 548], [330, 566], [318, 606], [286, 586]], '#2c3036', 4);            // magazine
  p.poly([[330, 500], [368, 522], [360, 544], [324, 524]], '#22252a', 4);            // optic housing
  p.ell(349, 512, 9, 9, '#7fd4ff', 2);                                              // optic glass
  p.poly([[238, 640], [272, 660], [258, 690], [226, 668]], '#4a3a28', 4);            // wooden grip
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
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const glow = (tp, s, a, rgb = '255,208,112') => out.push(FX('glow' + rgb + q(a, 2) + '_' + q(tp[0], 1), (p) => fxGlowCol(p, a, rgb), [tp[0], tp[1] - 0.81 * s, tp[2] + 0.12], s));
  // ---- tracked-object glow: the eye follows whatever the director is tracking ----
  const D = dirAt(f);
  if (D.seg.type === 'object') glow(D.point, (D.seg.id === 'boardUS' || D.seg.id === 'boardCN') ? 1.6 : 0.7, 0.16 + 0.05 * Math.sin(f * 0.35));
  // ---- gear props ----
  if (S.id === 'gearUS') {
    const down = smooth(ramp(f, TF('gearUS', 0.42), TF('gearUS', 0.52))) * (1 - smooth(ramp(f, TF('gearUS', 0.74), TF('gearUS', 0.84))));
    out.push(PROP('radio', propRadio, [-2.9, 0, 2.21], 1.12));
    out.push(PROP('gog' + q(down, 2), (p) => propGoggles(p, down), [-2.9, 0, 2.22], 1.12));
  }
  if (S.id === 'gearCN') { const m = cnMarch(f); out.push(PROP('rifle', propRifle, [m.x - 0.7, 0, 2.21], 1.12)); }
  // ---- charge: dust at both front lines + muzzle-flash light bursts (no hits, just light) ----
  if (S.id === 'charge' && IN('charge', f, 0.03, 0.8)) {
    for (let i = 0; i < 4; i++) {
      const cyc = ((f - TF('charge', 0)) * 0.05 + i * 0.27) % 1;
      out.push(FX('dustU' + i + q(cyc, 2), (p) => T.fxDust(p, cyc, '#cbb894'), [usFrontX(f) - 0.4 - (i % 2) * 0.9, 0.25, 0.4 + i * 0.55], 0.4));
      out.push(FX('dustC' + i + q(cyc, 2), (p) => T.fxDust(p, cyc, '#cbb894'), [cnFrontX(f) + 0.4 + (i % 2) * 0.9, 0.25, 0.4 + i * 0.55], 0.4));
    }
    { const rp = usRunner(f).pos; for (let i = 0; i < 2; i++) { const cyc = ((f - TF('charge', 0)) * 0.06 + i * 0.5) % 1; // dust kicked up at the tracked runner's feet
      out.push(FX('dustR' + i + q(cyc, 2), (p) => T.fxDust(p, cyc, '#cbb894'), [rp[0] - 0.25 - i * 0.3, 0.22, rp[2]], 0.34)); } }
    if (f % 9 < 2) { // strobe light bursts along the lines — pure light, nobody is hit
      out.push(FX('muzU' + f, (p) => T.fxStars(p, 0.4), [usFrontX(f) + 0.3, 1.15, 0.7], 0.35));
      out.push(FX('muzC' + f, (p) => T.fxStars(p, 0.4), [cnFrontX(f) - 0.3, 1.15, 0.7], 0.35));
    }
  }
  // ---- night: the goggles' green glow lights the US hero's face ----
  if (S.id === 'night' && IN('night', f, 0.3, 0.75)) glow([-1.5, 1.45, 1.6], 0.55, 0.2 + 0.05 * Math.sin(f * 0.4), '80,255,150');
  // ---- mud: brown splats on the falls ----
  for (const [fall, fx0, x] of [[usFall(f), TF('mud', 0.32), -1.15], [cnFall(f), TF('mud', 0.65), 1.15]]) {
    if (f >= fx0 && f < fx0 + 12) { const t = q((f - fx0) / 12, 2); out.push(FX('mud' + x + t, (p) => T.fxDust(p, t, '#8a6a44'), [x, 0.22, 1.1], 0.42)); }
  }
  // ---- verdict: sleeper's Zzz + set-down dust at the stack + finale glint on the handshake crate ----
  if (S.id === 'verdict' && f < TF('verdict', 0.8)) {
    const t = q(((f - TF('verdict', 0)) % 45) / 45, 2);
    out.push(FX('zzz' + t, (p) => T.fxZ(p, t), [-1.75, 1.15, -3.2], 0.3));
    for (const td of [0.3, 0.62]) if (f >= TF('verdict', td) && f < TF('verdict', td) + 10) { const t2 = q((f - TF('verdict', td)) / 10, 2); out.push(FX('sdust' + td + t2, (p) => T.fxDust(p, t2, '#cbb894'), [STACK_AT[0] + 0.3, 0.3, -2.7], 0.3)); }
  }
  if (S.id === 'verdict' && IN('verdict', f, 0.9, 1)) { const t = q(ramp(f, TF('verdict', 0.9), TF('verdict', 1)), 2); out.push(FX('vglint' + t, (p) => T.fxStars(p, t), [0, 1.35, 1.0], 0.32)); }
  return out;
};
