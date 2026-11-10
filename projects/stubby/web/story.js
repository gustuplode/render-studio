// Shot plan for "Sergeant Stubby — The Dog Who Became a Soldier" — timed to
// stubby-voice (49.98 s, 30 fps, TOTAL 1499). True WWI story, respectful, no gore.
// Phrases: P1 0 hook | P2 179 adopt/ship | P3 317 trench | P4 482 gas | P5 619 shells |
// P6 729 night rescue | P7 884 spy | P8 1055 hospital | P9 1167 promotion |
// P10 1303 parade | P11 1397 finale. SHOTS are contiguous (b = next a - 1).
// World (built in main.js): training camp at origin (gate z=8, tents z=-8, parade
// ground z~-1), ship deck at (40,1.2,-30), trench corridor along x at z=30
// (walls z=26.8/33.2), night battlefield z=40..48, hospital tent at (-40,0,20).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30, TOTAL = 1499, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 178, light: 'dawn' },
  { id: 'adopt', a: 179, b: 316, light: 'day' },
  { id: 'trench', a: 317, b: 481, light: 'grey' },
  { id: 'gas', a: 482, b: 618, light: 'gas' },
  { id: 'shells', a: 619, b: 728, light: 'grey' },
  { id: 'night', a: 729, b: 883, light: 'night' },
  { id: 'spy', a: 884, b: 1054, light: 'nightlow' },
  { id: 'hospital', a: 1055, b: 1166, light: 'warm' },
  { id: 'promo', a: 1167, b: 1302, light: 'day' },
  { id: 'parade', a: 1303, b: 1396, light: 'day' },
  { id: 'finale', a: 1397, b: 1498, light: 'sunset' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
export const LIGHTS = {
  dawn: { az: 95, el: 15, sky: '#c8a888', ground: '#5a4632', hemi: 1.05, sun: '#ffc37e', sunI: 2.2, fog: '#d9b28c', fogNear: 42, fogFar: 320,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.06, vig: 0.24, shadowExt: 16, aurora: 0 },
  day: { az: 130, el: 38, sky: '#bcd2ea', ground: '#5f6248', hemi: 1.15, sun: '#fff1d6', sunI: 2.0, fog: '#c3cfc0', fogNear: 48, fogFar: 360,
    skyTop: '#6f97cc', skyHor: '#dfe9f2', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.03, vig: 0.2, shadowExt: 16, aurora: 0 },
  grey: { az: 250, el: 22, sky: '#77828f', ground: '#33302a', hemi: 0.95, sun: '#cfd4d8', sunI: 1.25, fog: '#4c4c44', fogNear: 26, fogFar: 240,
    skyTop: '#39424e', skyHor: '#6a7268', sunDisc: '#e8ecec', sunSize: 0.0028, sat: 0.96, vig: 0.3, shadowExt: 22, aurora: 0 },
  gas: { az: 250, el: 20, sky: '#77806a', ground: '#2f3026', hemi: 0.9, sun: '#c9cfae', sunI: 1.1, fog: '#5c6248', fogNear: 16, fogFar: 170,
    skyTop: '#333c30', skyHor: '#68704f', sunDisc: '#e4e8cc', sunSize: 0.0028, sat: 0.94, vig: 0.34, shadowExt: 22, aurora: 0 },
  night: { az: 215, el: 32, sky: '#33415e', ground: '#14161c', hemi: 0.84, sun: '#b9ccff', sunI: 1.15, fog: '#1b2233', fogNear: 20, fogFar: 200,
    skyTop: '#0c1424', skyHor: '#26334e', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 1.0, vig: 0.36, shadowExt: 18, aurora: 0 },
  nightlow: { az: 215, el: 28, sky: '#28324a', ground: '#101216', hemi: 0.5, sun: '#aebfff', sunI: 0.8, fog: '#131a28', fogNear: 10, fogFar: 110,
    skyTop: '#0a101d', skyHor: '#1d2a44', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 0.97, vig: 0.4, shadowExt: 18, aurora: 0 },
  warm: { az: 140, el: 30, sky: '#d8c2a0', ground: '#4a3a28', hemi: 1.1, sun: '#ffd9a0', sunI: 1.7, fog: '#cbb890', fogNear: 30, fogFar: 220,
    skyTop: '#7a6a52', skyHor: '#e8d3ac', sunDisc: '#ffedc8', sunSize: 0.003, sat: 1.05, vig: 0.26, shadowExt: 14, aurora: 0 },
  sunset: { az: 255, el: 10, sky: '#e0a878', ground: '#54402c', hemi: 1.0, sun: '#ff9e57', sunI: 2.1, fog: '#d99a68', fogNear: 40, fogFar: 300,
    skyTop: '#4a5a9c', skyHor: '#ffb37a', sunDisc: '#ffe3b0', sunSize: 0.0042, sat: 1.08, vig: 0.26, shadowExt: 16, aurora: 0 },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t);
  return o;
};
export const lightFor = (S, f) => {
  if (S.id === 'finale') return blendLight(LIGHTS.day, LIGHTS.sunset, smooth(ramp(f, 1400, 1475)));
  if (S.id === 'adopt') return blendLight(LIGHTS.dawn, LIGHTS.day, smooth(ramp(f, 179, 300)));
  if (S.id === 'gas') return blendLight(LIGHTS.grey, LIGHTS.gas, smooth(ramp(f, 482, 545)));
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
export const CAMP = [0, 0, 0], SHIP = [40, 1.2, -30], TRENCH_Z = 30;

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [0.2, 1.12, 11.2], look: [1.55, 0.35, 7.0], fov: 44 },
    { f: 90, pos: [0.5, 1.0, 10.4], look: [1.0, 0.35, 4.8], fov: 41, ease: 'surge' },
    { f: 178, pos: [0.6, 0.92, 8.2], look: [0.85, 0.4, 3.5], fov: 40 },
  ],
  adopt: [
    { f: 179, pos: [0.6, 0.92, 8.2], look: [0.85, 0.4, 3.5], fov: 40 },
    { f: 235, pos: [1.7, 0.95, 5.4], look: [0.85, 0.72, 2.3], fov: 38, ease: 'surge' },
    { f: 255, pos: [1.85, 0.95, 5.1], look: [0.85, 0.75, 2.25], fov: 37.5 },
    { f: 258, pos: [1.85, 0.95, 5.1], look: [0.85, 0.75, 2.25], fov: 37.5 },
    { f: 260, pos: [36.6, 2.6, -21.5], look: [40, 1.6, -28.6], fov: 42 },
    { f: 316, pos: [37.4, 2.3, -23.2], look: [40.1, 1.55, -28.8], fov: 40, ease: 'surge' },
  ],
  trench: [
    { f: 317, pos: [-8.6, 1.35, 27.6], look: [-1, 0.55, 30], fov: 43 },
    { f: 405, pos: [-3.4, 1.1, 27.9], look: [2.2, 0.5, 30.1], fov: 41, ease: 'surge' },
    { f: 481, pos: [0.2, 1.0, 27.6], look: [4.3, 0.5, 30.2], fov: 40 },
  ],
  gas: [
    { f: 482, pos: [0.2, 1.0, 27.6], look: [4.3, 0.5, 30.2], fov: 40 },
    { f: 545, pos: [1.2, 0.92, 27.5], look: [3.2, 0.54, 30.2], fov: 41, ease: 'surge' },
    { f: 618, pos: [1.5, 0.9, 27.5], look: [3.25, 0.56, 30.2], fov: 40 },
  ],
  shells: [
    { f: 619, pos: [1.5, 0.9, 27.5], look: [3.25, 0.56, 30.2], fov: 40 },
    { f: 652, pos: [1.3, 1.32, 28.0], look: [2.6, 0.68, 30.5], fov: 41, ease: 'surge' },
    { f: 728, pos: [0.9, 1.28, 27.8], look: [2.5, 0.62, 30.4], fov: 40 },
  ],
  night: [
    { f: 729, pos: [0.9, 1.28, 27.8], look: [2.5, 0.62, 30.4], fov: 40 },
    { f: 790, pos: [-1.8, 1.35, 33.5], look: [-2.1, 0.35, 42.5], fov: 42, ease: 'surge' },
    { f: 883, pos: [-2.6, 1.05, 37.5], look: [-2.2, 0.35, 43], fov: 39 },
  ],
  spy: [
    { f: 884, pos: [2.4, 1.6, 28.3], look: [9.3, 0.55, 30.8], fov: 41 },
    { f: 975, pos: [5.6, 1.35, 28.2], look: [10.45, 0.55, 30.9], fov: 40, ease: 'surge' },
    { f: 1054, pos: [6.6, 1.25, 28.0], look: [10.55, 0.6, 31.0], fov: 39 },
  ],
  hospital: [
    { f: 1055, pos: [-38.6, 1.5, 26.8], look: [-40.1, 0.72, 19.3], fov: 42 },
    { f: 1110, pos: [-38.9, 1.42, 25.6], look: [-40.0, 0.7, 19.3], fov: 40, ease: 'surge' },
    { f: 1166, pos: [-39.1, 1.38, 25.1], look: [-39.8, 0.7, 19.4], fov: 39 },
  ],
  promo: [
    { f: 1167, pos: [-3.6, 1.65, 4.8], look: [0.1, 0.9, -1.2], fov: 43 },
    { f: 1240, pos: [-2.2, 1.35, 3.4], look: [0.1, 0.8, -0.9], fov: 40, ease: 'surge' },
    { f: 1302, pos: [-1.3, 1.2, 2.7], look: [0.25, 0.78, -0.8], fov: 38 },
  ],
  parade: [
    { f: 1303, pos: [-1.3, 1.2, 2.7], look: [0.25, 0.78, -0.8], fov: 38 },
    { f: 1332, pos: [0.3, 1.2, 5.4], look: [0.1, 0.7, 0.2], fov: 40, ease: 'surge' },
    { f: 1396, pos: [0.45, 1.15, 5.6], look: [0.15, 0.72, 0.5], fov: 40 },
  ],
  finale: [
    { f: 1397, pos: [0.45, 1.15, 5.6], look: [0.15, 0.72, 0.5], fov: 40 },
    { f: 1450, pos: [0.5, 1.1, 5.2], look: [0.25, 0.8, 0.85], fov: 39, ease: 'surge' },
    { f: 1498, pos: [0.55, 1.05, 4.9], look: [0.25, 0.82, 0.85], fov: 38 },
  ],
};
const SHADOW_AT = { hook: [0, 0, 0], adopt: [0, 0, 1], trench: [0, 0, 30], gas: [3, 0, 30], shells: [2, 0, 30], night: [-2, 0, 42], spy: [10, 0, 31], hospital: [-40, 0, 19], promo: [0, 0, -1], parade: [0, 0, 0], finale: [0, 0, 0] };
export const BRIDGES = {}; // location changes go through DIPS (dip-to-black), never a fast cross-blend
export const DIPS = [256, 317, 884, 1055, 1167];
const shotCam = (id, f) => camFromKeys(CAMS[id], f);
export const camAt = (f) => {
  const S = shotAt(f);
  let c = shotCam(S.id, f);
  const bd = BRIDGES[S.id];
  if (bd && f - S.a < bd) {
    const P = SHOTS[SHOTS.indexOf(S) - 1];
    const pc = shotCam(P.id, P.b);
    const t = smooth(ramp(f, S.a, S.a + bd));
    c = { pos: lerp3(pc.pos, c.pos, t), look: lerp3(pc.look, c.look, t), fov: lerp(pc.fov, c.fov, t), roll: lerp(pc.roll || 0, c.roll || 0, t) };
  }
  let flash = 0; // no opening fade: frame 0 must already show the puppy + camp (hook law)
  for (const B of DIPS) { const d = f - B; if (d >= -3 && d <= 3) flash = Math.min(flash, -0.95 * Math.cos(d / 3 * Math.PI / 2)); }
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let point, cinf;
  switch (S.id) {
    case 'hook': point = [1.0, 0.35, 4.8]; cinf = 6; break;
    case 'adopt': point = f < 256 ? [0.85, 0.8, 2.3] : [40.1, 1.6, -28.8]; cinf = 9; break;
    case 'trench': point = [2, 0.5, 30]; cinf = 8; break;
    case 'gas': point = [3.55, 0.55, 30.1]; cinf = 10; break;
    case 'shells': point = [2.55, 0.6, 30.2]; cinf = 7; break;
    case 'night': point = [-2.2, 0.35, 43]; cinf = 8; break;
    case 'spy': point = [10.1, 0.6, 30.9]; cinf = 9; break;
    case 'hospital': point = [-40, 0.75, 19.2]; cinf = 9; break;
    case 'promo': point = [0.1, 0.8, -0.9]; cinf = 9; break;
    case 'parade': point = [0.15, 0.75, 0.6]; cinf = 8; break;
    case 'finale': point = [0.25, 0.8, 0.85]; cinf = 9; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lanternSet: [], mist: 0.12, gasK: 0, starK: 0, wakeK: 0, shellK: 0, boardPromo: 0, boardFinal: 0, flagK: 1 };
  switch (S.id) {
    case 'hook': W.mist = 0.22; break;
    case 'adopt': W.mist = 0.15; W.wakeK = f >= 256 ? 1 : 0; break;
    case 'trench': W.mist = 0.4; break;
    case 'gas': W.mist = 0.55; W.gasK = smooth(ramp(f, 495, 560)) * (1 - 0.35 * ramp(f, 585, 618)); break;
    case 'shells': W.mist = 0.4; W.shellK = 1; break;
    case 'night': W.mist = 0.3; W.starK = 1; W.lanternSet = [3]; break;
    case 'spy': W.mist = 0.35; W.starK = 0.8; W.lanternSet = f >= 985 ? [5] : []; break;
    case 'hospital': W.mist = 0.08; W.lanternSet = [4]; break;
    case 'promo': W.mist = 0.1; W.boardPromo = smooth(ramp(f, 1215, 1250)); break;
    case 'parade': W.mist = 0.08; W.boardPromo = 1; break;
    case 'finale': W.mist = 0.1; W.boardFinal = smooth(ramp(f, 1438, 1482)); break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { fireRate: 12, fireScale: 0.7, smokeRate: 2.4 };
    case 'adopt': return { fireRate: 8, fireScale: 0.6, smokeRate: 2.0 };
    case 'trench': return { fireRate: 0, fireScale: 0.5, smokeRate: 1.2 };
    case 'gas': return { fireRate: 0, fireScale: 0.5, smokeRate: 1.0 };
    case 'shells': return { fireRate: 0, fireScale: 0.5, smokeRate: 1.6 };
    case 'night': return { fireRate: 0, fireScale: 0.5, smokeRate: 0.8 };
    case 'spy': return { fireRate: 0, fireScale: 0.5, smokeRate: 0.8 };
    case 'hospital': return { fireRate: 5, fireScale: 0.45, smokeRate: 1.2 };
    case 'promo': return { fireRate: 10, fireScale: 0.7, smokeRate: 2.0 };
    case 'parade': return { fireRate: 10, fireScale: 0.7, smokeRate: 2.0 };
    case 'finale': return { fireRate: 14, fireScale: 0.8, smokeRate: 2.2 };
    default: return { fireRate: 8, fireScale: 0.6, smokeRate: 1.6 };
  }
};

// ---------- actors (2D cards) ----------
export const CONROY = { tunic: '#6f6c48', skin: '#f5c9a0', cap: '#5d5a40', hair: '#3b2a20' };
export const OFFICER = { tunic: '#5d5a40', skin: '#f5c9a0', cap: '#4c4a38', moustache: '#3a2a1c' };
export const SPY = { tunic: '#3c3a36', skin: '#ecd0b6', hair: '#241a14' };
export const MEDIC = { tunic: '#7a7a68', skin: '#c99067', cap: '#6a6a58', hair: '#1e1714' };
const RD = (T, o, pos, extra = {}) => ({ key: 'stubby' + JSON.stringify(o), draw: (p) => T.stubbyCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const RH = (T, o, pos, extra = {}) => ({ key: 'soldier' + JSON.stringify(o), draw: (p) => T.stubbySoldier(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const TINT = { dawn: '#ffe9c4', day: '#ffffff', grey: '#ccd2d8', gas: '#d4dcbc', night: '#b9c8ee', nightlow: '#aebfff', warm: '#ffe2b8', sunset: '#ffd2a0' };
const tintFor = (S, f) => S.id === 'finale' ? (f < 1440 ? TINT.day : TINT.sunset) : S.id === 'adopt' ? (f < 240 ? TINT.dawn : TINT.day) : (TINT[S.light] || '#ffffff');
const barkPulse = (f, every = 17) => ((f % every) < 8 ? 1 : 0);

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S, f);
  switch (S.id) {
    case 'hook': {
      // puppy trots in through the gate toward camera; camp drills far behind
      const px = kf([[0, 1.7], [120, 0.95], [178, 0.8]], f), pz = kf([[0, 7.6], [120, 4.1], [178, 3.35]], f);
      const ph = q((f * 0.09) % 1, 2);
      out.push(RD(T, { step: ph, pant: 1 }, [px, 0, pz], { tint, s: 0.66, yaw: 0.35 }));
      for (let i = 0; i < 4; i++) out.push(RH(T, { outfit: 'soldier44a', seed: 30 + i * 3, expr: 'stern', L: 'hang', R: 'hang', blink: blinkAt(f, 30 + i), bob: q(breath(f, 30 + i), 3), step: q((f * 0.03 + i * 0.25) % 1, 2) },
        [-5 + i * 3.0, 0, -4.2 - (i % 2) * 0.8], { tint, s: 0.9 }));
      out.push(RH(T, { outfit: CONROY, seed: 41, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3) },
        [2.6, 0, 0.6], { tint, s: 0.92, yaw: -0.5 }));
      break;
    }
    case 'adopt': {
      if (f < 256) {
        const jump = f < 200 ? 0 : Math.abs(Math.sin((f - 200) * 0.22)) * 0.16 * (f < 232 ? 1 : 0.4);
        out.push(RH(T, { outfit: CONROY, seed: 41, expr: 'grin', L: 'belly', R: 'reach', lift: 0.15, blink: blinkAt(f, 41), bob: q(breath(f, 41), 3), headTilt: -3 },
          [0.85, 0, 2.25], { tint, s: 0.94 }));
        out.push(RD(T, { step: q((f * 0.09) % 1, 2), pant: 1 }, [kf([[179, 1.6], [205, 1.05], [255, 1.0]], f), jump, kf([[179, 3.6], [205, 2.75], [255, 2.7]], f)], { tint, s: 0.66, yaw: 0.35 }));
      } else {
        // ship deck: Conroy with kit bag, Stubby's nose peeking out of the bag at his side
        out.push(RH(T, { outfit: CONROY, seed: 41, expr: 'smile', L: 'belly', R: 'belly', blink: blinkAt(f, 41), bob: q(breath(f, 41) + Math.sin(f * 0.05) * 0.004, 3), headTilt: 3 },
          [40, 1.2, -28.6], { tint, s: 0.94 }));
        out.push(RD(T, { view: 'front', pant: 1, blink: blinkAt(f, 7) }, [40.98, 1.3, -27.95], { tint, s: 0.44, yaw: -0.4 }));
        out.push(RH(T, { outfit: 'soldier44b', seed: 33, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 33), bob: q(breath(f, 33), 3) },
          [42.5, 1.2, -29.8], { tint, s: 0.9, yaw: 0.6 }));
      }
      break;
    }
    case 'trench': {
      const sx = kf([[317, -2.6], [481, 4.4]], f);
      out.push(RD(T, { step: q((f * 0.085) % 1, 2), pant: 1 }, [sx, 0, 30.1], { tint, s: 0.64 }));
      out.push(RH(T, { outfit: 'soldier44a', seed: 51, expr: 'smile', L: 'hang', R: 'wave', wv: q(f * 0.2, 1), blink: blinkAt(f, 51), bob: q(breath(f, 51), 3) },
        [-1.8, 0, 31.6], { tint, s: 0.92, yaw: 0.3 }));
      out.push(RH(T, { outfit: 'soldier44c', seed: 57, expr: 'neutral', L: 'belly', R: 'belly', blink: blinkAt(f, 57), bob: q(breath(f, 57), 3) },
        [3.4, 0, 28.6], { tint, s: 0.92, yaw: -0.3 }));
      out.push(RH(T, { outfit: 'soldier44b', seed: 53, expr: 'stern', L: 'hang', R: 'hang', blink: blinkAt(f, 53), bob: q(breath(f, 53), 3) },
        [6.8, 0, 31.8], { tint, s: 0.92, yaw: 0.3 }));
      break;
    }
    case 'gas': {
      const bark = f >= 528 ? barkPulse(f) : 0;
      out.push(RD(T, { noseUp: q(ramp(f, 490, 528), 2), bark, earsUp: 1 }, [3.5, 0, 30.1], { tint, s: 0.72 }));
      out.push(RH(T, { outfit: 'soldier44a', seed: 51, expr: 'nervous', gasMask: f >= 545, L: 'hang', R: f >= 545 ? 'belly' : 'reach', blink: blinkAt(f, 51), bob: q(breath(f, 51), 3) },
        [2.4, 0, 31.8], { tint, s: 0.92, yaw: 0.3 }));
      out.push(RH(T, { outfit: 'soldier44c', seed: 57, expr: 'nervous', gasMask: f >= 568, L: 'reach', R: 'hang', blink: blinkAt(f, 57), bob: q(breath(f, 57), 3) },
        [4.9, 0, 29.6], { tint, s: 0.92, yaw: -0.3 }));
      out.push(RH(T, { outfit: 'soldier44b', seed: 53, expr: 'shock', gasMask: f >= 590, L: 'up', R: 'up', blink: blinkAt(f, 53), bob: q(breath(f, 53), 3) },
        [0.4, 0, 29.0], { tint, s: 0.92, yaw: -0.3 }));
      break;
    }
    case 'shells': {
      const duck = (f > 648 && f < 668) || (f > 694 && f < 714) ? -0.13 : 0;
      out.push(RD(T, { earsUp: 1, bark: barkPulse(f, 19), noseUp: 0.4 }, [2.5, 0, 30.15], { tint, s: 0.7 }));
      out.push(RH(T, { outfit: 'soldier44a', seed: 51, expr: 'nervous', L: 'belly', R: 'belly', blink: blinkAt(f, 51), bob: q(breath(f, 51), 3), headTilt: 4 },
        [1.4, duck, 31.9], { tint, s: 0.92, yaw: 0.3 }));
      out.push(RH(T, { outfit: 'soldier44c', seed: 57, expr: 'nervous', L: 'hang', R: 'hang', blink: blinkAt(f, 57), bob: q(breath(f, 57), 3), headTilt: -4 },
        [4.6, duck, 29.0], { tint, s: 0.92, yaw: -0.3 }));
      break;
    }
    case 'night': {
      // wounded soldier lying on the field (no wounds drawn); Stubby stays beside him
      out.push(RH(T, { outfit: 'soldier44b', seed: 53, expr: 'pained', L: 'hang', R: 'hang', blink: blinkAt(f, 53) },
        [-2.3, 0.12, 43.2], { tint, s: 0.92, roll: 1.52, yaw: 0.4, blob: false, shadow: false }));
      const sitDog = f < 770;
      const dp = sitDog ? [-1.5, 0, 41.95] : kf3([[770, [-1.5, 0, 41.95]], [800, [-1.6, 0, 42.0]], [883, [-1.6, 0, 42.0]]], f);
      out.push(RD(T, sitDog ? { sit: true, blink: blinkAt(f, 7) } : { lie: true, blink: blinkAt(f, 7) }, dp, { tint, s: 0.68, yaw: 0.4 }));
      if (f >= 795) {
        const mp = kf3([[795, [-7.5, 0, 38.5]], [862, [-3.9, 0, 41.6], 'easeInOut'], [883, [-3.9, 0, 41.6]]], f);
        const walking = f < 862;
        out.push(RH(T, { outfit: MEDIC, medic: true, seed: 61, expr: 'stern', L: 'hang', R: 'reach', blink: blinkAt(f, 61), bob: q(breath(f, 61), 3), step: q(walking ? kf([[795, 0], [862, 5.2]], f) : 0, 2) },
          mp, { tint, s: 0.92, yaw: 0.7 }));
      }
      break;
    }
    case 'spy': {
      const bite = f >= 952 ? 1 : 0;
      out.push(RH(T, { outfit: SPY, mapPaper: !bite, seed: 71, expr: bite ? 'shock' : 'nervous', L: bite ? 'up' : 'belly', R: bite ? 'up' : 'belly', blink: blinkAt(f, 71), bob: q(breath(f, 71), 3), headTilt: bite ? -4 : 4 },
        [10.6, 0, 31.1], { tint, s: 0.94, yaw: 0.6 }));
      const dp = f < 920 ? kf3([[884, [6.4, 0, 30.2]], [920, [9.3, 0, 31.0], 'easeInOut']], f)
        : f < 952 ? [9.3, 0, 31.0] : [9.85, 0, 31.08];
      out.push(RD(T, { step: q(f < 920 ? (f * 0.1) % 1 : 0, 2), bite, bark: f >= 985 ? barkPulse(f, 21) : 0, earsUp: 1 }, dp, { tint, s: 0.66, yaw: Math.PI }));
      if (f >= 978) {
        const sp = kf3([[978, [3.4, 0, 29.6]], [1030, [7.6, 0, 30.2], 'easeInOut'], [1054, [7.6, 0, 30.2]]], f);
        const walking = f < 1030;
        out.push(RH(T, { outfit: 'soldier44a', seed: 51, expr: 'stern', L: 'hang', R: 'point', blink: blinkAt(f, 51), bob: q(breath(f, 51), 3), step: q(walking ? kf([[978, 0], [1030, 4.4]], f) : 0, 2) },
          sp, { tint, s: 0.92 }));
        out.push(RH(T, { outfit: CONROY, seed: 41, expr: 'stern', L: 'hang', R: 'hang', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3), step: q(walking ? kf([[978, 0.4], [1030, 4.8]], f) : 0, 2) },
          [sp[0] - 1.5, 0, 31.9], { tint, s: 0.92, yaw: 0.3 }));
      }
      break;
    }
    case 'hospital': {
      if (f < 1112) {
        out.push(RD(T, { lie: true, bandage: true, blink: blinkAt(f, 7) }, [-40.1, 0.52, 19.1], { tint, s: 0.6, yaw: 0.5, blob: false }));
        out.push(RH(T, { outfit: CONROY, seed: 41, expr: 'relief', L: 'belly', R: 'reach', lift: 0.1, blink: blinkAt(f, 41), bob: q(breath(f, 41), 3), headTilt: -2 },
          [-38.9, 0, 19.9], { tint, s: 0.92, yaw: -0.6 }));
        out.push(RH(T, { outfit: MEDIC, medic: true, seed: 61, expr: 'smile', L: 'hang', R: 'belly', blink: blinkAt(f, 61), bob: q(breath(f, 61), 3) },
          [-41.6, 0, 20.4], { tint, s: 0.92, yaw: 0.7 }));
      } else {
        // healed: Stubby trots out of the tent, back toward his men
        const dp = kf3([[1112, [-40.4, 0, 19.6]], [1166, [-38.2, 0, 23.8], 'easeInOut']], f);
        out.push(RD(T, { step: q((f * 0.09) % 1, 2), bandage: true, pant: 1 }, dp, { tint, s: 0.62, yaw: 0.9 }));
        out.push(RH(T, { outfit: CONROY, seed: 41, expr: 'grin', L: 'hang', R: 'wave', wv: q(f * 0.25, 1), blink: blinkAt(f, 41), bob: q(breath(f, 41), 3) },
          [-39.8, 0, 20.6], { tint, s: 0.92, yaw: 0.9 }));
      }
      break;
    }
    case 'promo': {
      const coated = f >= 1232;
      out.push(RD(T, { view: 'front', coat: coated, blink: blinkAt(f, 7), pant: coated ? 1 : 0 }, [0.1, 0, -0.85], { tint, s: 0.74 }));
      out.push(RH(T, { outfit: OFFICER, chevrons: 0, seed: 81, expr: 'stern', L: 'hang', R: f >= 1218 && f < 1260 ? 'reach' : 'hang', lift: 0.22, blink: blinkAt(f, 81), bob: q(breath(f, 81), 3) },
        [1.35, 0, -1.15], { tint, s: 0.95, yaw: -0.55 }));
      out.push(RH(T, { outfit: CONROY, seed: 41, expr: 'grin', L: 'belly', R: 'belly', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3) },
        [-1.5, 0, -1.3], { tint, s: 0.92, yaw: 0.5 }));
      for (let i = 0; i < 3; i++) out.push(RH(T, { outfit: i % 2 ? 'soldier44c' : 'soldier44a', seed: [51, 57, 53][i], expr: coated ? 'smile' : 'neutral', L: coated ? 'up' : 'hang', R: coated ? 'up' : 'hang', blink: blinkAt(f, [51, 57, 53][i]), bob: q(breath(f, [51, 57, 53][i]), 3) },
        [-3.4 + i * 3.6, 0, -3.6], { tint, s: 0.9 }));
      break;
    }
    case 'parade': {
      const ph = q((f * 0.075) % 1, 2);
      const mz = kf([[1303, -1.6], [1396, 1.05]], f);
      out.push(RD(T, { step: ph, coat: true, pant: 1 }, [-0.35, 0, mz], { tint, s: 0.68 }));
      out.push(RH(T, { outfit: CONROY, seed: 41, expr: 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3), step: ph },
        [0.75, 0, mz + 0.25], { tint, s: 0.93 }));
      out.push(RH(T, { outfit: OFFICER, seed: 81, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 81), bob: q(breath(f, 81), 3), step: q((ph + 0.5) % 1, 2) },
        [1.6, 0, mz + 0.5], { tint, s: 0.93 }));
      for (let i = 0; i < 3; i++) out.push(RH(T, { outfit: 'civA', seed: 14 + i * 3, expr: 'laugh', L: 'wave', R: 'belly', wv: q(f * 0.3 + i, 1), blink: 0, bob: q(breath(f, 14 + i), 3) },
        [-2.6, 0, -1.5 + i * 1.7], { tint, s: 0.9, yaw: 0.5 }));
      for (let i = 0; i < 2; i++) out.push(RH(T, { outfit: 'civC', seed: 19 + i * 5, expr: 'grin', L: 'belly', R: 'wave', wv: q(f * 0.27 + i * 2, 1), blink: 0, bob: q(breath(f, 19 + i), 3) },
        [2.9, 0, -0.9 + i * 1.9], { tint, s: 0.9, yaw: -0.5 }));
      break;
    }
    case 'finale': {
      out.push(RD(T, { view: 'front', coat: true, pant: 1, blink: blinkAt(f, 7) }, [0.25, 0, 0.9], { tint, s: 0.78 }));
      out.push(RH(T, { outfit: CONROY, seed: 41, expr: 'smile', L: 'belly', R: 'belly', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3), headTilt: -2 },
        [1.0, 0, 1.0], { tint, s: 0.93, yaw: -0.55 }));
      out.push(RH(T, { outfit: 'soldier44a', seed: 51, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 51), bob: q(breath(f, 51), 3) },
        [-0.55, 0, 1.1], { tint, s: 0.9, yaw: 0.5 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: pos[1], ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if ((S.id === 'gas' && f >= 528) || (S.id === 'shells')) { // bark bursts at Stubby's head
    const cyc = S.id === 'gas' ? 17 : 19;
    if ((f % cyc) < 8) {
      const t = q(((f % cyc) / 8), 2);
      const hx = S.id === 'gas' ? 4.35 : 3.35;
      out.push(FXC('bark_' + S.id + t, (p) => T.fxBurst(p, t, '#fff3b0', 8, 26, 150), [hx, 0.62, 30.1], 0.5));
    }
  }
  return out;
};
export const heroPosAt = (f) => { // Stubby's card position (sweep + reference)
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return [0.8, 0, 3.35];
    case 'adopt': return f < 256 ? [1.0, 0, 2.7] : [40.62, 1.32, -28.15];
    case 'trench': case 'gas': case 'shells': return [3.5, 0, 30.1];
    case 'night': return [-1.5, 0, 42.9];
    case 'spy': return [9.05, 0, 31.05];
    case 'hospital': return [-40.1, 0.52, 19.1];
    case 'promo': return [0.1, 0, -0.85];
    case 'parade': return [-0.55, 0, 0];
    case 'finale': return [0.25, 0, 0.9];
    default: return null;
  }
};
