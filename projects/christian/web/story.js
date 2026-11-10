// Shot plan for "Christian — The Lion Who Never Forgot" — timed to christian-voice
// (49.725 s, 30 fps, TOTAL 1492). True story: Harrods cub 1969 -> Chelsea flat ->
// furniture shop -> too big -> Adamson/Kenya -> reunion one year later -> the hug.
// Phrases: P1 0-133 | P2 164-280 | P3 311-417 | P4 443-547 | P5 578-770 | P6 794-908 |
// P7 937-1056 | P8 1084-1196 | P9 1224-1327 | P10 1352-1466 (+tail). SHOTS contiguous:
// inter-phrase gaps belong to the outgoing section (its tail holds/blends forward).
// Staging (built in main.js): Harrods shop (0,0,-6); Chelsea flat (-16,0,4) with its
// door at (-13.4,0,4.4); furniture shop (-16,0,18); Adamson camp (20,0,-16);
// reunion clearing (19.5,0,3).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1492, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 163, light: 'shop' },
  { id: 'flat', a: 164, b: 310, light: 'warm' },
  { id: 'furniture', a: 311, b: 442, light: 'shopday' },
  { id: 'toobig', a: 443, b: 577, light: 'warm' },
  { id: 'kenya', a: 578, b: 793, light: 'savanna' },
  { id: 'return', a: 794, b: 936, light: 'late' },
  { id: 'warning', a: 937, b: 1083, light: 'late' },
  { id: 'run', a: 1084, b: 1223, light: 'golden' },
  { id: 'hug', a: 1224, b: 1351, light: 'golden' },
  { id: 'finale', a: 1352, b: 1491, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  shop: { az: 140, el: 30, sky: '#8a97b8', ground: '#4a3a2c', hemi: 1.05, sun: '#ffd9a0', sunI: 1.7, fog: '#6a5a48', fogNear: 30, fogFar: 260,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.003, sat: 1.05, vig: 0.26, shadowExt: 14, aurora: 0, gain: '#ffffff', ...WATER },
  warm: { az: 150, el: 26, sky: '#97a3c4', ground: '#54402c', hemi: 1.1, sun: '#ffcf96', sunI: 1.8, fog: '#7a6248', fogNear: 30, fogFar: 260,
    skyTop: '#66789f', skyHor: '#f4cf9a', sunDisc: '#fff3cf', sunSize: 0.003, sat: 1.06, vig: 0.25, shadowExt: 14, aurora: 0, gain: '#ffffff', ...WATER },
  shopday: { az: 130, el: 38, sky: '#aebfe0', ground: '#5a4a38', hemi: 1.18, sun: '#fff1d6', sunI: 2.0, fog: '#c3b49a', fogNear: 40, fogFar: 320,
    skyTop: '#6f97cc', skyHor: '#e8ddc4', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.04, vig: 0.22, shadowExt: 16, aurora: 0, gain: '#ffffff', ...WATER },
  savanna: { az: 120, el: 44, sky: '#bcd2ea', ground: '#7a6238', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#d8c9a2', fogNear: 45, fogFar: 380,
    skyTop: '#6f97cc', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.0032, sat: 1.05, vig: 0.2, shadowExt: 22, aurora: 0, gain: '#ffffff', ...WATER },
  late: { az: 105, el: 24, sky: '#c2b49a', ground: '#6a5232', hemi: 1.12, sun: '#ffc98a', sunI: 2.2, fog: '#ddbd8e', fogNear: 42, fogFar: 340,
    skyTop: '#7d90c2', skyHor: '#ffce96', sunDisc: '#ffe9bd', sunSize: 0.0032, sat: 1.07, vig: 0.24, shadowExt: 20, aurora: 0, gain: '#ffffff', ...WATER },
  golden: { az: 95, el: 17, sky: '#d9b28c', ground: '#6a4a2c', hemi: 1.14, sun: '#ffb763', sunI: 2.5, fog: '#e5bd85', fogNear: 40, fogFar: 320,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.09, gain: '#ffedd6', vig: 0.26, shadowExt: 18, aurora: 0, ...WATER },
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
  if (S.id === 'run') return blendLight(LIGHTS.late, LIGHTS.golden, smooth(ramp(f, 1084, 1160)));
  if (S.id === 'finale') return blendLight(LIGHTS.golden, LIGHTS.late, smooth(ramp(f, 1420, 1491)) * 0.45);
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
export const SHOP_CUB = [0.35, 0, -4.6];
export const FLAT_LION = [-15.4, 0, 3.6];
export const DOOR_POS = [-13.4, 0, 4.4];
export const CLEARING = [19.5, 0, 3.0];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

/** Christian's card position per frame (sweep + reference). */
export const lionPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return [...SHOP_CUB];
    case 'flat': return [...FLAT_LION];
    case 'furniture': { const p = kf3([[311, [-17.6, 0, 19.5]], [370, [-15.2, 0, 17.2], 'easeInOut'], [442, [-14.6, 0, 16.4]]], f); return p; }
    case 'toobig': return [...DOOR_POS];
    case 'kenya': { const p = kf3([[578, [17.5, 0, -13.5]], [680, [20.6, 0, -15.6], 'easeInOut'], [793, [22.6, 0, -17.6]]], f); return p; }
    case 'return': return [23.8, 0, -1.5]; // on the rise, watching
    case 'warning': return [23.8, 0, -1.5];
    case 'run': {
      if (f < 1130) return [21.5, 0, -4.2]; // the freeze
      const p = kf3([[1130, [21.5, 0, -4.2]], [1196, [20.2, 0, 0.6], 'easeIn'], [1223, [19.7, 0, 1.9]]], f); return p;
    }
    case 'hug': case 'finale': return [19.5, 0, 2.1];
    default: return null;
  }
};
/** Lion size stage per frame: cub -> young (furniture) -> adult (door gag onward). */
export const lionSizeAt = (f) => f < 311 ? 'cub' : f < 443 ? 'young' : f < 578 ? 'adult' : f < 700 ? 'young' : 'adult';

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [3.1, 1.9, 2.8], look: [-0.2, 1.15, -6.2], fov: 46 },
    { f: 133, pos: [1.0, 0.9, -2.6], look: [0.2, 0.5, -4.8], fov: 40, ease: 'surge' },
    { f: 163, pos: [0.95, 0.88, -2.45], look: [0.2, 0.5, -4.8], fov: 39.5 },
  ],
  flat: [
    { f: 164, pos: [-12.6, 1.6, 9.6], look: [-16.2, 0.9, 3.6], fov: 46 },
    { f: 280, pos: [-13.0, 1.4, 8.2], look: [-16.0, 0.85, 3.6], fov: 43, ease: 'surge' },
    { f: 310, pos: [-13.2, 1.38, 8.0], look: [-16.0, 0.85, 3.6], fov: 42.5 },
  ],
  furniture: [
    { f: 311, pos: [-12.6, 1.7, 23.5], look: [-16.2, 0.9, 17.6], fov: 44 },
    { f: 417, pos: [-13.2, 1.45, 22.2], look: [-15.6, 0.85, 17.2], fov: 41, ease: 'surge' },
    { f: 442, pos: [-13.4, 1.42, 22.0], look: [-15.5, 0.85, 17.0], fov: 40.5 },
  ],
  toobig: [
    { f: 443, pos: [-10.6, 1.6, 9.4], look: [-13.6, 1.15, 4.3], fov: 43 },
    { f: 547, pos: [-11.3, 1.48, 8.4], look: [-13.7, 1.18, 4.4], fov: 40, ease: 'surge' },
    { f: 577, pos: [-11.5, 1.44, 8.05], look: [-13.5, 1.2, 4.35], fov: 38.5 },
  ],
  kenya: [
    { f: 578, pos: [11.5, 3.4, -6.5], look: [19.5, 0.8, -15.5], fov: 47 },
    { f: 700, pos: [13.2, 2.4, -9.8], look: [19.6, 0.8, -15.4], fov: 44, ease: 'surge' },
    { f: 793, pos: [15.2, 2.1, -10.8], look: [21.6, 0.85, -16.8], fov: 42 },
  ],
  return: [
    { f: 794, pos: [25.6, 1.7, 11.2], look: [19.7, 1.0, 3.2], fov: 44 },
    { f: 908, pos: [24.6, 1.55, 9.6], look: [19.6, 1.05, 3.1], fov: 41, ease: 'surge' },
    { f: 936, pos: [24.4, 1.53, 9.4], look: [19.6, 1.05, 3.1], fov: 40.5 },
  ],
  warning: [
    { f: 937, pos: [15.8, 1.7, -9.8], look: [20.1, 1.15, -15.6], fov: 43 },
    { f: 1056, pos: [16.9, 1.55, -11.2], look: [19.9, 1.2, -15.5], fov: 40, ease: 'surge' },
    { f: 1083, pos: [17.1, 1.53, -11.4], look: [19.9, 1.2, -15.5], fov: 39.5 },
  ],
  run: [
    { f: 1084, pos: [16.2, 1.35, -1.2], look: [21.4, 0.85, -4.2], fov: 42 },
    { f: 1160, pos: [15.6, 1.32, 1.6], look: [21.2, 0.9, -3.2], fov: 41, ease: 'surge' },
    { f: 1223, pos: [15.9, 1.38, 5.0], look: [19.7, 1.0, 2.4], fov: 40 },
  ],
  hug: [
    { f: 1224, pos: [15.9, 1.38, 5.0], look: [19.7, 1.0, 2.4], fov: 40 },
    { f: 1280, pos: [19.3, 1.5, 10.4], look: [19.5, 1.2, 2.3], fov: 43, ease: 'surge' },
    { f: 1327, pos: [19.4, 1.45, 9.9], look: [19.5, 1.25, 2.3], fov: 41.5, ease: 'surge' },
    { f: 1351, pos: [19.4, 1.45, 9.75], look: [19.5, 1.25, 2.3], fov: 41 },
  ],
  finale: [
    { f: 1352, pos: [19.4, 1.45, 9.75], look: [19.5, 1.25, 2.3], fov: 41 },
    { f: 1466, pos: [20.2, 1.6, 12.6], look: [20.7, 1.3, 1.2], fov: 43, ease: 'surge' },
    { f: 1491, pos: [20.4, 1.7, 13.2], look: [20.9, 1.35, 1.0], fov: 43.5 },
  ],
};
const SHADOW_AT = { hook: [0, 0.6, -5.2], flat: [-15.4, 0.6, 3.6], furniture: [-15.6, 0.6, 17.4], toobig: [-13.4, 0.8, 4.4], kenya: [20, 0.6, -16], return: [19.6, 0.8, 3], warning: [20, 0.8, -15.5], run: [20.4, 0.6, -1], hug: [19.5, 0.9, 2.3], finale: [19.5, 0.9, 2.3] };
const BRIDGES = {}; // location changes enter through dips (balto pattern); hug/finale keys are continuous
const DIPS = [164, 311, 443, 578, 794, 937, 1084];
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
  let flash = 0;
  if (f < 9) flash = -0.95 * (1 - f / 9);
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
    case 'hook': point = [0.3, 0.6, -4.6]; cinf = 10; break;
    case 'flat': point = [-15.4, 0.7, 3.6]; cinf = 10; break;
    case 'furniture': point = [-15.6, 0.85, 17.4]; cinf = 9; break;
    case 'toobig': point = [-13.4, 1.2, 4.4]; cinf = 9; break;
    case 'kenya': point = [20.2, 0.85, -15.8]; cinf = 6; break;
    case 'return': point = [19.6, 1.05, 2.9]; cinf = 8; break;
    case 'warning': point = [19.9, 1.2, -15.5]; cinf = 9; break;
    case 'run': point = lionPosAt(f).map((v, i) => i === 1 ? 0.8 : v); cinf = 8; break;
    case 'hug': case 'finale': point = [19.5, 1.3, 2.3]; cinf = 7; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, dust: 0.15, windK: 0.5, boardT: 0, harrodsK: 0, winGlow: 0.6, glintK: 0, grassK: 0.4 };
  switch (S.id) {
    case 'hook': W.harrodsK = 1; W.winGlow = 1; W.glintK = 0.8; W.dust = 0.08; break;
    case 'flat': W.winGlow = 0.9; W.dust = 0.1; break;
    case 'furniture': W.winGlow = 0.8; W.glintK = 0.5; W.dust = 0.18; break;
    case 'toobig': W.winGlow = 0.9; W.dust = 0.12; break;
    case 'kenya': W.dust = 0.55; W.windK = 1.0; W.grassK = 1; break;
    case 'return': W.dust = 0.4; W.windK = 0.8; W.grassK = 0.9; break;
    case 'warning': W.dust = 0.35; W.windK = 0.7; W.grassK = 0.8; break;
    case 'run': W.dust = f < 1130 ? 0.3 : lerp(0.9, 0.5, ramp(f, 1130, 1223)); W.windK = 1.1; W.grassK = 1; break;
    case 'hug': W.dust = 0.45; W.windK = 0.5; W.grassK = 0.7; W.glintK = 0.6; break;
    case 'finale': W.dust = 0.3; W.windK = 0.4; W.grassK = 0.6; W.boardT = smooth(ramp(f, 1370, 1420)); break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'kenya': return { smokeRate: 2.6, dustRate: 0.6 };
    case 'run': return { smokeRate: f >= 1130 && f <= 1210 ? 7 : 1.6, dustRate: 0.5 };
    case 'hug': return { smokeRate: f < 1260 ? 4 : 1.2, dustRate: 0.4 };
    case 'finale': return { smokeRate: 1.0, dustRate: 0.3 };
    case 'return': case 'warning': return { smokeRate: 1.8, dustRate: 0.4 };
    default: return { smokeRate: 0, dustRate: 0.15 };
  }
};

// ---------- actors ----------
const TINT = { shop: '#ffe3c2', warm: '#ffdcb2', shopday: '#ffffff', savanna: '#ffffff', late: '#ffe9c4', golden: '#ffd9a3' };
const tintFor = (S, f) => S.id === 'run' ? (f < 1160 ? TINT.late : TINT.golden) : (TINT[S.light] || '#ffffff');
const RH = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => (who === 'rendall' ? T.rendallCard(p, o) : who === 'bourke' ? T.bourkeCard(p, o) : T.adamsonCard(p, o)), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RL = (T, o, pos, extra = {}) => ({ key: 'lion' + JSON.stringify(o), draw: (p) => T.christianCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S, f);
  const lion = lionPosAt(f), size = lionSizeAt(f);
  switch (S.id) {
    case 'hook': {
      out.push(RL(T, { size: 'cub', pose: 'front', pant: 1 }, lion, { tint, s: 0.42 }));
      out.push(RH(T, 'rendall', { expr: 'grin', L: 'belly', R: 'point', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3), headTilt: -3 }, [-1.0, 0, -6.0], { tint, s: 1.0 }));
      out.push(RH(T, 'bourke', { expr: 'laugh', L: 'up', R: 'belly', blink: blinkAt(f, 47), bob: q(breath(f, 47), 3), headTilt: 3 }, [0.95, 0, -6.2], { tint, s: 0.97 }));
      break;
    }
    case 'flat': {
      out.push(RL(T, { size: 'cub', pose: 'side', step: q((f * 0.02) % 1, 2), pant: 1, headDown: q(0.3 + 0.2 * Math.sin(f * 0.05), 2) }, lion, { tint, s: 0.4, yaw: 0.35 }));
      out.push(RH(T, 'rendall', { expr: 'smile', L: 'hang', R: 'belly', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-16.9, 0, 2.9], { tint, s: 1.0, yaw: 0.4 }));
      out.push(RH(T, 'bourke', { expr: 'grin', L: 'belly', R: 'hang', blink: blinkAt(f, 47), bob: q(breath(f, 47), 3), headTilt: 2 }, [-14.2, 0, 4.9], { tint, s: 0.97, yaw: -0.3 }));
      break;
    }
    case 'furniture': {
      out.push(RL(T, { size: 'young', pose: 'side', step: q((f * 0.045) % 1, 2), pant: 1, pawUp: f > 380 ? 1 : 0 }, lion, { tint, s: 0.62, yaw: 0.2 }));
      out.push(RH(T, 'bourke', { expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 47), bob: q(breath(f, 47), 3) }, [-18.6, 0, 15.2], { tint, s: 0.97, yaw: 0.6 }));
      break;
    }
    case 'toobig': {
      // adult wedged at the flat door: scale pushes past the frame — the size gag
      const s = lerp(0.98, 1.12, ramp(f, 443, 547));
      out.push(RL(T, { size: 'adult', pose: 'front', pant: 1 }, lion, { tint, s }));
      out.push(RH(T, 'rendall', { expr: 'nervous', L: 'up', R: 'hang', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3), headTilt: q(kf([[443, 0], [500, -5], [547, 3]], f), 1) }, [-15.2, 0, 5.3], { tint, s: 1.0, yaw: 0.5 }));
      out.push(RH(T, 'bourke', { expr: 'shock', L: 'hang', R: 'up', blink: blinkAt(f, 47), bob: q(breath(f, 47), 3) }, [-11.8, 0, 5.7], { tint, s: 0.97, yaw: -0.5 }));
      break;
    }
    case 'kenya': {
      const running = f > 640 && f < 740;
      out.push(RL(T, { size, pose: 'side', step: q(running ? (f * 0.09) % 1 : (f * 0.015) % 1, 2), pant: running ? 1 : 0, headDown: q(f > 740 ? 0.35 : 0, 2) }, lion, { tint, s: size === 'adult' ? 0.95 : 0.66, yaw: -0.3 }));
      out.push(RH(T, 'adamson', { expr: 'smile', L: 'hang', R: 'point', blink: blinkAt(f, 8), bob: q(breath(f, 8), 3) }, [17.0, 0, -13.6], { tint, s: 1.02, yaw: 0.6 }));
      if (f < 660) { // the pride: two distant lionesses (same painter, small, side)
        out.push(RL(T, { size: 'adult', pose: 'side', step: 0 }, [26.5, 0, -19.5], { tint, s: 0.8, yaw: -0.4 }));
        out.push(RL(T, { size: 'young', pose: 'side', step: 0 }, [28.2, 0, -18.2], { tint, s: 0.55, yaw: -0.4 }));
      }
      break;
    }
    case 'return': {
      out.push(RH(T, 'rendall', { safari: true, expr: 'smile', L: 'hang', R: 'point', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3), step: q(kf([[794, 0], [880, 2.2]], f) > 0 && f < 880 ? (f * 0.06) % 1 : 0, 2) }, [18.7, 0, 3.1], { tint, s: 1.0, yaw: 0.2 }));
      out.push(RH(T, 'bourke', { safari: true, expr: 'grin', L: 'belly', R: 'hang', blink: blinkAt(f, 47), bob: q(breath(f, 47), 3) }, [20.6, 0, 4.2], { tint, s: 0.97, yaw: -0.2 }));
      out.push(RL(T, { size: 'adult', pose: 'side', step: 0 }, lion, { tint, s: 0.9, yaw: -0.9 })); // watching from the rise
      break;
    }
    case 'warning': {
      out.push(RH(T, 'adamson', { expr: 'stern', L: 'hang', R: 'up', blink: blinkAt(f, 8), bob: q(breath(f, 8), 3), headTilt: q(kf([[937, 2], [990, -5], [1020, 4], [1056, 0]], f), 1) }, [20.0, 0, -15.8], { tint, s: 1.02 }));
      out.push(RH(T, 'rendall', { safari: true, expr: 'nervous', L: 'belly', R: 'belly', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [18.7, 0, -14.6], { tint, s: 1.0, yaw: 0.35 }));
      out.push(RH(T, 'bourke', { safari: true, expr: 'nervous', L: 'hang', R: 'belly', blink: blinkAt(f, 47), bob: q(breath(f, 47), 3), headTilt: -3 }, [21.3, 0, -14.4], { tint, s: 0.97, yaw: -0.35 }));
      break;
    }
    case 'run': {
      const frozen = f < 1130;
      const running = f >= 1130;
      out.push(RL(T, { size: 'adult', pose: 'side', step: q(running ? (f * 0.11) % 1 : 0, 2), pant: running ? 1 : 0 }, lion, { tint, s: frozen ? 0.92 : 0.98, yaw: -0.5 }));
      out.push(RH(T, 'rendall', { safari: true, expr: f < 1150 ? 'nervous' : 'shock', L: 'hang', R: 'hang', blink: frozen ? 1 : blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [18.6, 0, 3.3], { tint, s: 1.0, yaw: -0.3 }));
      out.push(RH(T, 'bourke', { safari: true, expr: f < 1150 ? 'nervous' : 'shock', L: 'belly', R: 'hang', blink: frozen ? 1 : blinkAt(f, 47), bob: q(breath(f, 47), 3) }, [20.5, 0, 4.3], { tint, s: 0.97, yaw: 0.3 }));
      break;
    }
    case 'hug': case 'finale': {
      const settle = S.id === 'finale' ? 1 : smooth(ramp(f, 1224, 1260));
      out.push(RL(T, { size: 'adult', pose: 'hug', pant: 0 }, lion, { tint, s: 1.12 }));
      out.push(RH(T, 'rendall', { safari: true, expr: 'laugh', L: 'belly', R: 'up', blink: blinkAt(f, 31), bob: q(breath(f, 31) * settle, 3), headTilt: -4 }, [18.55, 0, 2.7], { tint, s: 1.0, yaw: 0.45 }));
      out.push(RH(T, 'bourke', { safari: true, expr: 'laugh', L: 'up', R: 'belly', blink: blinkAt(f, 47), bob: q(breath(f, 47) * settle, 3), headTilt: 4 }, [20.45, 0, 2.7], { tint, s: 0.97, yaw: -0.45 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => [];
