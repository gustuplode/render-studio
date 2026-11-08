// Shot plan for "The Pigeon Who Saved Two Hundred Men" — Cher Ami, 1918.
// Timed to voice.mp3 (30 fps). NOTE: SHOTS ranges are ESTIMATES until work/phrases.json
// lands from timing.py; every cam/actor/world beat derives from SHOTS, so retiming = editing SHOTS only.
// Sets: trench/dugout x~0, battery x~+40, dawn road x~-35, medal clearing x~+75. Ground y=0.
// Pigeon card (roman.js pigeonCard): fly centre = design (300,430) -> world offset a.y + 1.226*s; perch feet at soles.
import { M, camFromKeys, idle, blinkAt, walk, q, clamp, lerp, ramp, spline } from './motion.js';

export const FPS = 30, TOTAL = 1305, DECK = 0;
export const SHOTS = [
  { id: 'hook',    a: 0,    b: 140,  light: 'dusk'   },
  { id: 'trapped', a: 141,  b: 343,  light: 'grey'   },
  { id: 'shell',   a: 344,  b: 517,  light: 'grey'   },
  { id: 'hope',    a: 518,  b: 628,  light: 'grey'   },
  { id: 'burst',   a: 629,  b: 725,  light: 'grey'   },
  { id: 'flight',  a: 726,  b: 854,  light: 'grey'   },
  { id: 'kept',    a: 855,  b: 1020, light: 'grey'   },
  { id: 'stopped', a: 1021, b: 1077, light: 'grey'   },
  { id: 'home',    a: 1078, b: 1177, light: 'dawn'   },
  { id: 'medal',   a: 1178, b: 1304, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const S0 = (id) => SHOTS.find((s) => s.id === id);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 240,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 16, ...WATER },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 40, fogFar: 220,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', vig: 0.26, shadowExt: 16, ...WATER },
  night: { az: 60, el: 38, sky: '#33456b', ground: '#1c1a20', hemi: 0.95, sun: '#aebfff', sunI: 1.15, fog: '#232c40', fogNear: 16, fogFar: 95,
    skyTop: '#131c30', skyHor: '#2c3a55', sat: 1.03, vig: 0.3, shadowExt: 9, waterDeep: '#1c2c3c', waterShal: '#2c445c', glint: '#cfe0ff' },
  dusk: { az: 30, el: 20, sky: '#8d8578', ground: '#4c4438', hemi: 0.95, sun: '#ffb46c', sunI: 2.0, fog: '#9a8a76', fogNear: 30, fogFar: 160,
    skyTop: '#5c5648', skyHor: '#d9a06a', sunDisc: '#ffe9c0', sunSize: 0.003, sat: 1.04, vig: 0.3, shadowExt: 14, waterDeep: '#2c445c', waterShal: '#3a5a74', glint: '#ffe9c0' },
  grey: { az: 205, el: 52, sky: '#b7bec7', ground: '#5d5a4e', hemi: 1.05, sun: '#e9e5d8', sunI: 1.55, fog: '#aeb4ba', fogNear: 26, fogFar: 175,
    skyTop: '#79838f', skyHor: '#c6ccd2', sat: 0.92, vig: 0.3, shadowExt: 18, waterDeep: '#33454f', waterShal: '#546a74', glint: '#dfe8ee' },
  dawn: { az: 96, el: 13, sky: '#c9b8c4', ground: '#6a5646', hemi: 1.02, sun: '#ffc98a', sunI: 2.7, fog: '#eec39a', fogNear: 38, fogFar: 210,
    skyTop: '#7d7fb4', skyHor: '#ffd9a3', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.1, gain: '#fff4e0', vig: 0.24, shadowExt: 16, waterDeep: '#2c445c', waterShal: '#4a7086', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- shared flight path (burst climb -> flight -> kept -> landing) ----------
const FLY_PTS = [[-3.5, 1.35, -0.9], [-2.2, 4.4, -2.2], [6, 6.4, -4.6], [18, 7.6, -5.8], [29, 6.8, -5.2], [36, 5.4, -4.6], [38.8, 3.4, -3.2]];
const flySpan = () => { const a = S0('burst'), b = S0('kept'); return [a.a + Math.round((a.b - a.a) * 0.25), b.b]; };
const bulletF = () => { const s = S0('flight'); return s.a + Math.round((s.b - s.a) * 0.38); };
export const birdPos = (f) => {
  const [fa, fb] = flySpan();
  const u = clamp((f - fa) / (fb - fa));
  const p = spline(FLY_PTS, u);
  const bf = bulletF(); // falter: dip + shudder just after the bullet moment
  const d = Math.exp(-Math.pow((f - bf - 10) / 13, 2));
  p[1] -= 1.15 * d;
  p[0] += Math.sin(f * 0.9) * 0.05 * d;
  return p;
};
const birdFlap = (f) => {
  const bf = bulletF();
  if (f >= bf && f < bf + 16) return 0.45;                    // wings stall at the hit
  const rate = f < S0('kept').a ? 0.62 : 0.4;                 // frantic, then weary-steady
  const ph = f * rate + Math.max(0, (f - (bf + 16))) * 0.0;
  return q(0.5 - 0.5 * Math.cos(ph), 2);
};
const birdRoll = (f) => {
  const bf = bulletF();
  const d = Math.exp(-Math.pow((f - bf - 8) / 11, 2));
  return q(-0.5 * d + Math.sin(f * 0.14) * 0.05, 2);
};

// ---------- cameras ----------
const ck = (id, arr) => { const S = S0(id); return arr.map(([u, pos, look, fov, extra = {}]) => ({ f: Math.round(S.a + u * (S.b - S.a)), pos, look, fov, ...extra })); };
const CAMS = {
  hook: ck('hook', [
    [0.0, [-3.45, 1.24, 1.55], [-3.55, 0.8, -0.9], 37],
    [0.55, [-3.48, 1.12, 1.05], [-3.55, 0.79, -0.9], 36],
    [1.0, [-3.5, 1.08, 0.85], [-3.55, 0.78, -0.9], 35],
  ]),
  trapped: ck('trapped', [
    [0.0, [8.6, 3.4, 9.8], [0.5, 0.7, -1.4], 47, { ease: 'easeOut' }],
    [0.6, [6.4, 2.9, 8.2], [0.2, 0.75, -1.2], 46],
    [1.0, [5.2, 2.6, 7.4], [0.0, 0.8, -1.1], 45],
  ]),
  shell: ck('shell', [
    [0.0, [40.2, 2.1, 3.8], [39.8, 1.0, -5.0], 45],
    [0.3, [40.0, 2.0, 3.3], [39.9, 1.0, -4.9], 44],
    [0.45, [8.6, 1.7, 3.4], [9.4, 0.65, -2.5], 42, { ease: 'easeOut' }],
    [1.0, [9.4, 1.55, 2.9], [9.8, 0.6, -2.7], 41],
  ]),
  hope: ck('hope', [
    [0.0, [-3.0, 1.35, 2.5], [-3.35, 0.72, -1.0], 40, { ease: 'easeOut' }],
    [0.6, [-3.05, 1.26, 2.1], [-3.3, 0.72, -1.0], 39],
    [1.0, [-3.1, 1.2, 1.85], [-3.28, 0.72, -1.0], 38],
  ]),
  burst: ck('burst', [
    [0.0, [-3.35, 1.25, 2.7], [-3.5, 0.85, -0.9], 41],
    [0.3, [-3.3, 1.5, 2.6], [-3.1, 2.2, -1.5], 42],
    [1.0, [-3.1, 1.9, 2.5], [-2.0, 4.3, -2.2], 43],
  ]),
  stopped: ck('stopped', [
    [0.0, [42.6, 2.9, 2.4], [38.4, 1.05, -2.6], 49, { ease: 'easeOut' }],
    [1.0, [42.2, 2.7, 2.0], [38.3, 1.05, -2.5], 47],
  ]),
  home: ck('home', [
    [0.0, [-41.5, 1.9, 5.6], [-36.5, 1.0, 0.2], 44, { ease: 'easeOut' }],
    [1.0, [-30.5, 1.8, 5.4], [-27.5, 1.0, 0.2], 43],
  ]),
  medal: ck('medal', [
    [0.0, [74.3, 2.0, 3.4], [74.1, 1.5, -1.2], 44, { ease: 'easeOut' }],
    [0.6, [74.25, 1.95, 3.0], [74.1, 1.52, -1.2], 42],
    [1.0, [74.2, 1.9, 2.6], [74.1, 1.55, -1.2], 40, { roll: 2.0 }],
  ]),
};
const KICKS = { hook: [{ f: () => S0('hook').b - 18, a: 0.05 }] };
export const camAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'flight' || S.id === 'kept') {
    // tracking camera: flies alongside the bird, slightly below and behind-side
    const bp = birdPos(f), bp2 = birdPos(f + 2);
    const side = S.id === 'flight' ? 5.0 : 4.2;
    const pos = [bp[0] - 2.0, bp[1] - 0.2, bp[2] + side];
    return { pos, look: [bp2[0], bp2[1], bp2[2]], fov: S.id === 'flight' ? 42 : 40, roll: q(Math.sin(f * 0.1) * 1.2, 1), shadowAt: [bp[0], 0, bp[2]], flash: 0 };
  }
  const kicks = (KICKS[S.id] || []).map((k) => ({ f: typeof k.f === 'function' ? k.f() : k.f, a: k.a }));
  const c = camFromKeys(CAMS[S.id], f, { kicks });
  const bf = S0('shell').a + 26;
  c.flash = S.id === 'hook' && f >= S.b - 20 && f < S.b - 14 ? (1 - (f - (S.b - 20)) / 6) * 0.5 : 0;
  c.shadowAt = { hook: [-3.5, 0.8, -0.9], trapped: [1, 0.8, -1], shell: f < bf ? [40, 1, -4] : [10, 0.7, -3], hope: [-3.3, 0.7, -1], burst: [-3, 1.5, -1.5], stopped: [40, 1, -4], home: [-33, 1, 0], medal: [74.2, 1.3, -1.2] }[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  if (S.id === 'flight' || S.id === 'kept') return { focus: dist(C.pos, birdPos(f)), cinf: 8 };
  const shS = S0('shell'), shSplit = shS.a + Math.round((shS.b - shS.a) * 0.42);
  const T = { hook: [-3.55, 0.85, -0.9], trapped: [1, 1, -0.8], shell: f < shSplit ? [40, 1.2, -4.6] : [9.6, 0.7, -2.6], hope: [-3.2, 0.8, -1.1], burst: [-3, 2.2, -1.6], stopped: [39.5, 1.2, -3.4], home: [-33, 1.1, 0.2], medal: [74.15, 1.55, -1.2] }[S.id];
  const wide = S.id === 'trapped' || S.id === 'stopped';
  return { focus: dist(C.pos, T), cinf: wide ? 3 : 9 };
};

// ---------- world state ----------
const BURSTS = [ // shell bursts: frame offset fn -> resolved in worldAt via shot-relative anchors
  { shot: 'hook', u: 0.82, x: 7.5, y: 0, z: -6.0, max: 2.6 },
  { shot: 'trapped', u: 0.3, x: 12.5, y: 0, z: -8.5, max: 3.2 },
  { shot: 'trapped', u: 0.62, x: -5.5, y: 0, z: -7.0, max: 2.8 },
  { shot: 'trapped', u: 0.88, x: 5.0, y: 0, z: -5.5, max: 3.0 },
  { shot: 'shell', u: 0.52, x: 11.5, y: 0, z: -6.5, max: 3.4 },
  { shot: 'shell', u: 0.72, x: 6.5, y: 0, z: -5.0, max: 3.0 },
  { shot: 'flight', u: 0.34, dx: 5.5, dy: -3.4, dz: -4.5, max: 2.8 },
  { shot: 'flight', u: 0.75, x: 22, y: 0, z: -9, max: 3.4 },
];
const GUNFIRE = [ // battery firing times (absolute-ish, resolved from the shell + stopped shots)
  { shot: 'shell', u: 0.06, gun: 0 }, { shot: 'shell', u: 0.16, gun: 1 }, { shot: 'shell', u: 0.27, gun: 2 },
  { shot: 'stopped', u: 0.08, gun: 1 },
];
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lidT: 0, puffs: [], guns: [{}, {}, {}] };
  const bs = S0('burst');
  if (S.id === 'burst') W.lidT = 0.85 + 0.15 * ramp(f, bs.a + 2, bs.a + 10);
  else if (f > bs.a) W.lidT = 1;
  else W.lidT = 0.85;
  for (const b of BURSTS) {
    const sh = S0(b.shot); if (f < sh.a || f > sh.b + 40) continue;
    const t0 = sh.a + Math.round((sh.b - sh.a) * b.u), age = f - t0;
    if (age < 0 || age > 34) continue;
    const bp = b.dx !== undefined ? birdPos(t0) : null;
    const x = bp ? bp[0] + b.dx : b.x, y = bp ? bp[1] + b.dy : b.y, z = bp ? bp[2] + b.dz : b.z;
    const s = b.max * M.easeOut(clamp(age / 9)) * (age > 20 ? 1 - (age - 20) / 14 : 1);
    W.puffs.push({ x, y, z, s: q(s, 2), o: q(0.92 * (1 - Math.max(0, age - 16) / 18), 2) });
  }
  for (const g of GUNFIRE) {
    const sh = S0(g.shot); if (f < sh.a || f > sh.b + 30) continue;
    const t0 = sh.a + Math.round((sh.b - sh.a) * g.u), age = f - t0;
    if (age < 0 || age > 16) continue;
    W.guns[g.gun] = { flash: q(Math.max(0, 1 - age / 4), 2), recoil: q(Math.max(0, 1 - age / 11), 2) };
  }
  return W;
};

// ---------- actors ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const PG = (T, o, pos, extra = {}) => ({ key: 'pigeon' + JSON.stringify(o), draw: (p) => T.pigeonCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, blob: false, shadow: false, ...extra });
const TINT = { day: '#ffffff', golden: '#ffe2c8', night: '#b9c8ff', dusk: '#ffd9ae', grey: '#e3e6e2', dawn: '#ffdfba' };
const flyCard = (f, T, tint, o = {}) => {
  const bp = birdPos(f), s = o.s || 0.5;
  return PG(T, { mode: 'fly', flap: birdFlap(f), blink: blinkAt(f, 41), expr: o.expr || 'determined', capsule: true, bandage: f >= bulletF(), ...o }, [bp[0], bp[1] - 1.226 * s, bp[2]], { tint, s, roll: birdRoll(f) });
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  const u = (f - S.a) / Math.max(1, S.b - S.a);
  switch (S.id) {
    case 'hook': {
      const id = idle(f, 5);
      out.push(PG(T, { mode: 'perch', blink: blinkAt(f, 41), expr: 'alert', capsule: true, bandage: true }, [-3.55, 0.78, -0.9], { tint, s: 0.3 }));
      out.push(R(T, 'officer44', { seed: 21, expr: 'stubborn', L: 'hip', R: 'hang', blink: blinkAt(f, 21), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [-4.5, 0, -0.35], { tint }));
      break;
    }
    case 'trapped': {
      const duck = 0.16 + 0.05 * Math.sin(f * 0.07);
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'stubborn', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(-duck, 3), tilt: q(4, 1), headTilt: q(-3, 1) }, [2.5, 0, -0.55], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'squint', L: 'belly', R: 'hang', blink: blinkAt(f, 12), bob: q(-duck - 0.02, 3), tilt: q(5, 1), headTilt: q(2, 1) }, [3.6, 0, -0.85], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'neutral', L: 'hang', R: 'belly', blink: blinkAt(f, 13), bob: q(-duck + 0.01, 3), tilt: q(3, 1), headTilt: q(-2, 1) }, [-0.6, 0, -0.3], { tint }));
      out.push(R(T, 'officer44', { seed: 21, expr: 'stubborn', L: 'hip', R: 'point', blink: blinkAt(f, 21), bob: q(-duck, 3), tilt: q(3, 1), headTilt: q(3, 1) }, [-3.9, 0, 0.15], { tint }));
      break;
    }
    case 'shell': {
      const split = S.a + Math.round((S.b - S.a) * 0.42);
      if (f < split) { // the battery, firing on its own men by mistake
        out.push(R(T, 'soldier44a', { seed: 11, expr: 'stubborn', L: 'reach', R: 'reach', blink: blinkAt(f, 11), bob: q(idle(f, 11).bob, 3), tilt: q(5, 1) }, [36.8, 0, -3.2], { tint }));
        out.push(R(T, 'soldier44b', { seed: 12, expr: 'neutral', L: 'lift', R: 'lift', blink: blinkAt(f, 12), bob: q(idle(f, 12).bob, 3), tilt: q(6, 1) }, [41.9, 0, -3.6], { tint }));
        out.push(R(T, 'officer44', { seed: 21, expr: 'neutral', L: 'hip', R: 'point', blink: blinkAt(f, 21), bob: q(idle(f, 21).bob, 3), tilt: q(2, 1) }, [43.8, 0, -1.6], { tint }));
      } else { // the runner
        const rf = split, run = ramp(f, rf, rf + 62);
        const rx = lerp(7.6, 10.35, M.easeOut(run)), rz = lerp(-0.5, -3.15, run);
        const fallen = f >= rf + 62;
        const stp = fallen ? 0 : q(walk(f, rf, 2.6, 0.75).phase);
        out.push(R(T, 'soldier44b', { seed: 12, expr: fallen ? 'pained' : 'stubborn', L: fallen ? 'hang' : 'belly', R: fallen ? 'hang' : 'belly', blink: blinkAt(f, 12), bob: q(fallen ? -0.1 : Math.abs(Math.sin(f * 0.5)) * 0.02, 3), tilt: q(fallen ? 9 : 6, 1), headTilt: q(fallen ? -6 : 0, 1), step: stp }, [rx, 0, rz], { tint, roll: fallen ? 1.25 : 0 }));
        out.push(R(T, 'soldier44a', { seed: 11, expr: 'pained', L: 'hang', R: 'point', blink: blinkAt(f, 11), bob: q(idle(f, 11).bob, 3), tilt: q(3, 1) }, [6.4, 0, -0.2], { tint }));
      }
      break;
    }
    case 'hope': {
      const id = idle(f, 8);
      out.push(R(T, 'officer44', { seed: 21, expr: f > S.a + 60 ? 'smile' : 'neutral', L: 'belly', R: 'reach', blink: blinkAt(f, 21), bob: q(-0.06 + id.bob, 3), tilt: q(7, 1), headTilt: q(4, 1) }, [-4.35, 0, -0.15], { tint }));
      out.push(PG(T, { mode: 'perch', blink: blinkAt(f, 41), expr: 'alert', capsule: true, bandage: true }, [-3.55, 0.78, -0.9], { tint, s: 0.3 }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(2, 1), headTilt: q(-3, 1) }, [-1.5, 0, 0.35], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'grin', L: 'hang', R: 'up', blink: blinkAt(f, 13), bob: q(id.bob, 3), tilt: q(2, 1), headTilt: q(3, 1) }, [-5.6, 0, 0.5], { tint }));
      break;
    }
    case 'burst': {
      const bs = S;
      if (f < bs.a + 8) out.push(PG(T, { mode: 'perch', blink: 0, expr: 'determined', capsule: true, bandage: true }, [-3.55, 0.78, -0.9], { tint, s: 0.3 }));
      else out.push(flyCard(f, T, tint, { s: 0.46 }));
      out.push(R(T, 'officer44', { seed: 21, expr: 'smile', L: 'hang', R: 'up', blink: blinkAt(f, 21), bob: q(idle(f, 21).bob, 3), tilt: q(-2, 1), headTilt: q(-6, 1) }, [-4.4, 0, 0.1], { tint }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'grin', L: 'up', R: 'up', blink: blinkAt(f, 11), bob: q(Math.abs(Math.sin(f * 0.3)) * 0.02, 3) }, [-2.2, 0, 0.3], { tint }));
      break;
    }
    case 'flight': case 'kept': {
      out.push(flyCard(f, T, tint, { s: S.id === 'flight' ? 0.52 : 0.56, expr: f > bulletF() ? 'tired' : 'determined' }));
      break;
    }
    case 'stopped': {
      const land = ramp(f, S.a + 6, S.a + 30);
      if (land < 1) { // she glides in and lands on the ammo crate
        const lx = lerp(41.5, 38.3, M.easeOut(land)), ly = lerp(3.4, 1.55, M.easeOut(land)), lz = lerp(-3.6, -2.1, land);
        const s = 0.44;
        out.push(PG(T, { mode: 'fly', flap: q(0.5 - 0.5 * Math.cos(f * 0.5), 2), blink: blinkAt(f, 41), expr: 'tired', capsule: true, bandage: true }, [lx, ly - 1.226 * s, lz], { tint, s, roll: q(-0.12 * (1 - land), 2) }));
      } else {
        out.push(PG(T, { mode: 'perch', blink: blinkAt(f, 41), expr: 'tired', capsule: true, bandage: true }, [38.3, 0.88, -2.1], { tint, s: 0.32 }));
      }
      const wk = walk(f, S.a + 4, 1.7, 0.8);
      const ox = lerp(45.6, 42.6, clamp(wk.dist / 3.0));
      out.push(R(T, 'officer44', { seed: 21, expr: 'smile', L: 'up', R: 'point', blink: blinkAt(f, 21), bob: q(Math.abs(Math.sin(f * 0.32)) * 0.02, 3), tilt: q(2, 1), step: q(wk.phase) }, [ox, 0, -2.9], { tint }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(idle(f, 11).bob - 0.03, 3), tilt: q(4, 1) }, [36.8, 0, -3.2], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'smile', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.28)) * 0.02, 3) }, [41.9, 0, -3.6], { tint }));
      break;
    }
    case 'home': {
      const crew = [['soldier44a', 11, -39.5, 'smile'], ['soldier44b', 12, -36.8, 'neutral'], ['soldier44c', 13, -34.2, 'grin'], ['soldier44a', 14, -31.8, 'smile']];
      for (const [who, seed, x0, expr] of crew) {
        const wk = walk(f, S.a, 1.15, 0.8);
        out.push(R(T, who, { seed, expr, L: 'hang', R: 'hang', blink: blinkAt(f, seed), bob: q(Math.abs(Math.sin(f * 0.26 + seed)) * 0.018, 3), step: q(wk.phase + seed * 0.13, 2) }, [x0 + wk.dist, 0, 0.35 + (seed % 3) * 0.35], { tint }));
      }
      const ca = u * Math.PI * 1.5 + 0.6; // one lazy circle above the column
      const bx = -34 + Math.cos(ca) * 5.5, by = 6.2 + Math.sin(u * 6.28) * 0.3, bz = -1.5 + Math.sin(ca) * 3.4;
      const s = 0.42;
      out.push(PG(T, { mode: 'fly', flap: q(0.5 - 0.5 * Math.cos(f * 0.42), 2), blink: blinkAt(f, 41), expr: 'proud', capsule: false, bandage: true }, [bx, by - 1.226 * s, bz], { tint, s, roll: q(Math.cos(ca) * 0.3, 2) }));
      break;
    }
    case 'medal': {
      const id = idle(f, 16);
      out.push(PG(T, { mode: 'perch', blink: blinkAt(f, 41), expr: 'proud', capsule: true, bandage: false, medal: true, pegleg: true }, [74.1, 1.42, -1.2], { tint, s: 0.42 }));
      out.push(R(T, 'officer44', { seed: 21, expr: 'smile', L: 'hang', R: 'temple', blink: blinkAt(f, 21), bob: q(id.bob, 3), tilt: q(1, 1), headTilt: q(2, 1) }, [72.7, 0.26, -0.45], { tint, ground: 0.26 }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'grin', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.26)) * 0.02, 3) }, [75.7, 0.26, -0.4], { tint, ground: 0.26 }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'smile', L: 'hang', R: 'up', blink: blinkAt(f, 13), bob: q(id.bob, 3) }, [76.6, 0.26, -1.9], { tint, ground: 0.26 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'medal' && f >= S.b - 50 && f < S.b - 26) { // warm glint on the medal reveal
    const t = q((f - (S.b - 50)) / 24, 2);
    out.push(FX('glint' + t, (p) => T.fxStars(p, t), [74.35, 2.35, -1.1], 0.3));
  }
  if ((S.id === 'trapped' || S.id === 'shell') && f % 47 < 10) { // drifting ash/leaves over the trench
    for (let i = 0; i < 3; i++) {
      const t = ((f - 5) * 0.012 + i / 3) % 1; if (t < 0) continue;
      out.push(FX('leaf' + i, (p) => T.fxLeaf(p, '#8a7a52'), [-2 + t * 9, 2.6 - t * 2.2, -0.6 + i * 0.5], 0.1, { roll: q(t * 8 + i, 1) }));
    }
  }
  return out;
};
