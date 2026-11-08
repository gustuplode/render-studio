// Shot plan for "The Bear Who Became a Corporal" — timed to voice.mp3 (36.33 s, 30 fps, TOTAL 1090).
// Phrases (s): 0.00-2.76 rank hook | 3.36-8.84 cub found 1942 | 9.46-11.78 wrestled/marched |
// 12.42-15.04 sailed for Italy, rule | 15.88-16.76 "No pets on the ship" | 17.34-19.38 only thing they could |
// 20.02-20.94 enlisted the bear | 21.76-24.44 Private Wojtek, paybook, number |
// 25.10-27.44 Monte Cassino, copied the men | 27.76-31.44 carrying crates, never dropped one |
// 32.22-35.74 twist: came home a corporal.
// Sets live in separate zones: camp x~0, port x~+30, office x~60, cassino x~90. Ground y=0 everywhere
// (the port quay deck is y=0.55).
import { M, camFromKeys, idle, blinkAt, walk, q, clamp, lerp, ramp } from './motion.js';

export const FPS = 30, TOTAL = 1090, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 100, light: 'day' },
  { id: 'cub', a: 101, b: 283, light: 'day' },
  { id: 'camp', a: 284, b: 372, light: 'golden' },
  { id: 'port', a: 373, b: 519, light: 'day' },
  { id: 'enlist', a: 520, b: 752, light: 'night' },
  { id: 'cassino', a: 753, b: 832, light: 'dusk' },
  { id: 'carry', a: 833, b: 966, light: 'dusk' },
  { id: 'emblem', a: 967, b: 1089, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
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
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [-0.9, 1.5, 4.35], look: [-0.85, 1.12, -0.2], fov: 36 },
    { f: 34, pos: [-0.88, 1.47, 4.5], look: [-0.85, 1.1, -0.2], fov: 35.5 },
    { f: 72, pos: [-0.5, 2.2, 7.9], look: [0.0, 0.95, -0.9], fov: 44, ease: 'easeOut' },
    { f: 100, pos: [-0.45, 2.3, 8.3], look: [0.05, 0.95, -0.9], fov: 44 },
  ],
  cub: [
    { f: 101, pos: [0.6, 1.4, 4.7], look: [0.55, 0.5, 0.9], fov: 38 },
    { f: 190, pos: [0.58, 1.3, 4.1], look: [0.55, 0.48, 0.9], fov: 37 },
    { f: 283, pos: [0.55, 1.22, 3.55], look: [0.55, 0.46, 0.9], fov: 36 },
  ],
  camp: [
    { f: 284, pos: [0.4, 1.55, 4.9], look: [0.4, 0.75, 0.2], fov: 40 },
    { f: 372, pos: [0.25, 1.5, 4.6], look: [0.35, 0.72, 0.2], fov: 39 },
  ],
  port: [
    { f: 373, pos: [29.9, 2.05, 3.6], look: [29.8, 1.05, -1.9], fov: 44 },
    { f: 460, pos: [29.85, 1.95, 3.1], look: [29.8, 1.02, -1.8], fov: 42 },
    { f: 519, pos: [29.8, 1.9, 2.8], look: [29.8, 1.0, -1.7], fov: 41 },
  ],
  enlist: [
    { f: 520, pos: [60.3, 1.66, 3.35], look: [60.4, 1.06, -0.85], fov: 42 },
    { f: 640, pos: [60.25, 1.6, 3.0], look: [60.35, 1.07, -0.8], fov: 40 },
    { f: 752, pos: [60.2, 1.56, 2.8], look: [60.3, 1.08, -0.75], fov: 38 },
  ],
  cassino: [
    { f: 753, pos: [89.9, 1.95, 4.7], look: [89.9, 0.95, -1.7], fov: 43 },
    { f: 832, pos: [90.1, 1.85, 4.3], look: [90.2, 0.92, -1.6], fov: 41 },
  ],
  carry: [
    { f: 833, pos: [89.0, 1.8, 4.6], look: [88.9, 1.0, -0.4], fov: 40 },
    { f: 900, pos: [90.3, 1.8, 4.6], look: [90.2, 1.0, -0.6], fov: 40 },
    { f: 966, pos: [91.6, 1.75, 4.4], look: [91.5, 1.0, -0.8], fov: 39 },
  ],
  emblem: [
    { f: 967, pos: [97.9, 1.72, 1.6], look: [95.9, 1.25, -2.9], fov: 42 },
    { f: 1030, pos: [97.7, 1.68, 1.25], look: [96.0, 1.28, -2.9], fov: 41 },
    { f: 1089, pos: [97.5, 1.64, 1.0], look: [96.1, 1.3, -2.85], fov: 40, roll: 2.5 },
  ],
};
const KICKS = { emblem: [{ f: 967, a: 0.05 }], carry: [{ f: 905, a: 0.04 }, { f: 963, a: 0.04 }] };
const SHADOW_AT = { hook: [0, 1, 0], cub: [0.5, 0.6, 0.9], camp: [0.4, 0.8, 0.2], port: [29.9, 1, -1.6], enlist: [60.2, 1, -0.6], cassino: [90, 1, -1.2], carry: [90, 1, -0.6], emblem: [96.0, 1.2, -2.9] };
export const camAt = (f) => {
  const S = shotAt(f);
  const c = camFromKeys(CAMS[S.id], f, { kicks: KICKS[S.id] || [] });
  c.flash = f >= 101 && f < 106 ? (1 - (f - 101) / 5) * 0.7 : f >= 967 && f < 970 ? 0.3 * (1 - (f - 967) / 3) : 0;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, [-0.85, 1.2, -0.2]), cinf: lerp(11, 0, smooth(ramp(f, 34, 68))) };
    case 'cub': return { focus: dist(C.pos, [0.55, 0.55, 0.9]), cinf: 9 };
    case 'camp': return { focus: dist(C.pos, [0.4, 0.8, 0.3]), cinf: 7 };
    case 'port': return { focus: dist(C.pos, [29.9, 1.1, -1.5]), cinf: 6 };
    case 'enlist': return { focus: dist(C.pos, [60.1, 1.15, -0.5]), cinf: 11 };
    case 'cassino': return { focus: dist(C.pos, [90.0, 1.0, -1.4]), cinf: 5 };
    case 'carry': return { focus: dist(C.pos, [90.2, 1.1, -0.5]), cinf: 8 };
    case 'emblem': return { focus: dist(C.pos, [96.1, 1.3, -2.9]), cinf: 9 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state (drives set pieces in main.js worldState) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, stack: 0, haulT: 0, stamp: 0, sway: f };
  if (S.id === 'enlist') W.stamp = f < 612 ? 0 : f < 620 ? (f - 612) / 8 : f < 630 ? 1 - (f - 620) / 10 : 0;
  if (S.id === 'cassino') { W.haulT = ramp(f, 758, 826); W.stack = f >= 828 ? 3 : 2; }
  if (S.id === 'carry') W.stack = 3 + (f >= 907 ? 1 : 0) + (f >= 965 ? 1 : 0);
  if (S.id === 'emblem') W.stack = 5;
  return W;
};

// ---------- actors (2D cards) ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RB = (T, o, pos, extra = {}) => ({ key: 'bear' + JSON.stringify(o), draw: (p) => T.bearCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { day: '#ffffff', golden: '#ffe2c8', night: '#b9c8ff', dusk: '#ffd9ae' };

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  switch (S.id) {
    case 'hook': {
      const id = idle(f, 5);
      out.push(RB(T, { expr: 'proud', stripes: 2, blink: blinkAt(f, 5), step: 0 }, [-0.9, 0, -0.2], { tint, s: 0.98 }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(id.tilt * 0.5, 1), headTilt: q(id.headTilt, 1) }, [-1.85, 0, -0.55], { tint }));
      break;
    }
    case 'cub': {
      const id = idle(f, 7);
      const wig = q(Math.sin(f * 0.09) * 0.05, 3);
      out.push(RB(T, { expr: 'curious', blink: blinkAt(f, 7) }, [0.55, 0.3, 0.92], { tint, s: 0.42, roll: wig }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'smile', L: 'belly', R: 'point', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(6 + id.tilt * 0.3, 1), headTilt: q(4, 1) }, [1.55, 0, 0.15], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 13), bob: q(id.bob, 3), tilt: q(5 + id.tilt * 0.3, 1), headTilt: q(3, 1) }, [-0.42, 0, 0.05], { tint }));
      break;
    }
    case 'camp': {
      const id = idle(f, 8);
      const wr = f < 338 ? q(Math.sin((f - 284) * 0.11) * 0.26, 3) : 0;
      out.push(RB(T, { expr: f < 338 ? 'grin' : 'proud', wrestle: f < 338 ? 1 : 0, blink: f < 338 ? 0 : blinkAt(f, 8), step: 0 }, [0.15, 0, 0.5], { tint, s: 0.68, roll: wr }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.3)) * 0.02, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [1.05, 0, 0.35], { tint, roll: q(-wr * 0.7, 3) }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.3 + 2)) * 0.02, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [-0.85, 0, -0.45], { tint }));
      break;
    }
    case 'port': {
      const id = idle(f, 9);
      const shake = (f >= 448 && f < 472) || (f >= 484 && f < 504) ? q(Math.sin(f * 0.9) * 2.4, 1) : 0;
      out.push(R(T, 'officer44', { seed: 21, expr: 'stubborn', L: 'hip', R: f < 448 ? 'point' : 'cross', blink: blinkAt(f, 21), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: shake }, [30.7, 0.55, -1.6], { tint }));
      out.push(RB(T, { expr: f >= 476 ? 'sad' : 'curious', blink: blinkAt(f, 9), step: 0 }, [29.8, 0.55, -1.15], { tint, s: 0.8 }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [28.85, 0.55, -1.8], { tint }));
      break;
    }
    case 'enlist': {
      const id = idle(f, 10);
      out.push(R(T, 'officer44', { seed: 21, expr: f >= 612 ? 'smile' : 'neutral', L: 'belly', R: f >= 600 && f < 640 ? 'point' : 'hang', blink: blinkAt(f, 21), bob: q(id.bob, 3), tilt: q(3 + id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [61.35, 0, -1.95], { tint }));
      out.push(RB(T, { expr: f >= 653 ? 'proud' : 'curious', blink: blinkAt(f, 10), step: 0 }, [59.95, 0, 0.35], { tint, s: 0.85 }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [60.95, 0, -0.25], { tint }));
      break;
    }
    case 'cassino': {
      const id = idle(f, 14);
      const strain = q(Math.sin(f * 0.16) * 0.012, 3);
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'stubborn', L: 'lift', R: 'lift', blink: blinkAt(f, 11), bob: strain, tilt: q(5 + id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [87.85, 0, -1.35], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'stubborn', L: 'reach', R: 'reach', blink: blinkAt(f, 12), bob: strain, tilt: q(6 + id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [89.75, 0, -1.6], { tint }));
      out.push(RB(T, { expr: 'determined', blink: blinkAt(f, 14), step: 0 }, [90.9, 0, 0.15], { tint, s: 0.95 }));
      break;
    }
    case 'carry': {
      const id = idle(f, 15);
      // trip 1: carry 838-905 (x 88.4 -> 91.3); walk back 908-935; trip 2: carry 938-963
      let bx, carry = false, stp = 0;
      if (f < 908) { const t = smooth(ramp(f, 838, 905)); bx = lerp(88.4, 91.3, t); carry = f >= 838; stp = carry ? q(walk(f, 838, 0.9, 0.55).phase) : 0; }
      else if (f < 938) { const t = smooth(ramp(f, 908, 935)); bx = lerp(91.3, 88.6, t); stp = q(walk(f, 908, 0.9, 0.55).phase); }
      else { const t = smooth(ramp(f, 938, 963)); bx = lerp(88.6, 91.3, t); carry = true; stp = q(walk(f, 938, 0.9, 0.55).phase); }
      out.push(RB(T, { expr: carry ? 'determined' : 'proud', carry, blink: blinkAt(f, 15), step: stp }, [bx, 0, -0.35], { tint, s: 0.98 }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: f >= 905 ? 'grin' : 'neutral', L: 'hang', R: f >= 940 ? 'up' : 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [87.8, 0, -1.3], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: f >= 905 ? 'laugh' : 'smile', L: f >= 940 ? 'up' : 'hang', R: f >= 940 ? 'up' : 'belly', blink: blinkAt(f, 13), bob: q(id.bob + (f >= 940 ? Math.abs(Math.sin(f * 0.3)) * 0.02 : 0), 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [92.7, 0, -0.85], { tint }));
      break;
    }
    case 'emblem': {
      const id = idle(f, 16);
      out.push(RB(T, { expr: 'proud', stripes: 2, blink: blinkAt(f, 16), step: 0 }, [96.4, 0, -2.2], { tint, s: 0.98 }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'grin', L: 'hang', R: 'up', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [95.0, 0, -0.9], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'smile', L: 'up', R: 'hang', blink: blinkAt(f, 12), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [97.7, 0, -1.1], { tint }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' || S.id === 'cub') { // drifting leaves on the hill breeze
    for (let i = 0; i < 5; i++) {
      const t = ((f - 10) * 0.011 + i / 5) % 1; if (t < 0) continue;
      const cols = ['#d9822b', '#c4452c', '#e6b13a'];
      out.push(FX('leaf' + (i % 3), (p) => T.fxLeaf(p, cols[i % 3]), [-3.2 + t * 7.5, 2.8 - t * 2.6, -1.0 + i * 0.45], 0.11, { roll: q(t * 8 + i, 1) }));
    }
  }
  if (S.id === 'carry' && ((f >= 903 && f < 915) || (f >= 961 && f < 973))) { // crate stack thud dust
    const base = f >= 961 ? 961 : 903, t = q((f - base) / 12, 2);
    out.push(FX('dust' + t, (p) => T.fxDust(p, t, '#cbb894'), [91.8, 0.3, -0.9], 0.32));
  }
  if (S.id === 'emblem' && f >= 1040 && f < 1060) { // warm glint on the corporal reveal
    const t = q((f - 1040) / 20, 2);
    out.push(FX('glint' + t, (p) => T.fxStars(p, t), [96.2, 1.62, -2.0], 0.3));
  }
  return out;
};
