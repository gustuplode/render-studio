// Shot plan for "Owen & Mzee — The Hippo and the Tortoise" — timed to voice
// (47.700 s, 30 fps, TOTAL 1431). Phrases (frames): P1 0-149 | P2 167-320 |
// P3 338-472 | P4 494-649 | P5 671-731 | P6 749-822 | P7 842-994 |
// P8 1015-1132 | P9 1147-1180 | P10 1198-1247 | P11 1273-1336 | P12 1352-1406
// (+tail to 1430). SHOTS contiguous: inter-phrase gaps belong to the outgoing
// section. Staging: COAST at origin (sea z<0, shore z>0); HALLER PARK clearing
// centred (28,0,1), Mzee home (30,0,0), pond at (24.5,0,5.5).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1431, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 166, light: 'coast' },
  { id: 'tsunami', a: 167, b: 337, light: 'storm' },
  { id: 'rescue', a: 338, b: 493, light: 'coastday' },
  { id: 'meet', a: 494, b: 670, light: 'park' },
  { id: 'movesaway', a: 671, b: 748, light: 'park' },
  { id: 'follow', a: 749, b: 841, light: 'park' },
  { id: 'together', a: 842, b: 1014, light: 'late' },
  { id: 'neck', a: 1015, b: 1146, light: 'golden' },
  { id: 'hippo', a: 1147, b: 1197, light: 'golden' },
  { id: 'friendship', a: 1198, b: 1272, light: 'golden' },
  { id: 'mother', a: 1273, b: 1351, light: 'golden' },
  { id: 'finale', a: 1352, b: 1430, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#1d4e66', waterShal: '#3a7d99', glint: '#ffe9c0' };
export const LIGHTS = {
  coast: { az: 130, el: 34, sky: '#aebfe0', ground: '#6a5a3c', hemi: 1.15, sun: '#fff1d6', sunI: 2.0, fog: '#c3b49a', fogNear: 40, fogFar: 340,
    skyTop: '#5f7fc0', skyHor: '#e8ddc4', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  storm: { az: 150, el: 22, sky: '#7d8794', ground: '#4c4c44', hemi: 1.12, sun: '#c9ccd2', sunI: 1.6, fog: '#8a929c', fogNear: 26, fogFar: 260,
    skyTop: '#4c5866', skyHor: '#9aa2ac', sunDisc: '#d8dde2', sunSize: 0.002, sat: 0.98, vig: 0.28, shadowExt: 16, aurora: 0, gain: '#e8ecf2', waterDeep: '#16323f', waterShal: '#2c5468', glint: '#cfd8de' },
  coastday: { az: 125, el: 42, sky: '#bcd2ea', ground: '#7a6238', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#d8c9a2', fogNear: 45, fogFar: 380,
    skyTop: '#6f97cc', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.0032, sat: 1.05, vig: 0.2, shadowExt: 20, aurora: 0, gain: '#ffffff', ...WATER },
  park: { az: 120, el: 40, sky: '#bcd2ea', ground: '#7a6238', hemi: 1.2, sun: '#fff3da', sunI: 2.15, fog: '#d8c9a2', fogNear: 45, fogFar: 380,
    skyTop: '#6f97cc', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.0032, sat: 1.06, vig: 0.21, shadowExt: 22, aurora: 0, gain: '#ffffff', ...WATER },
  late: { az: 105, el: 24, sky: '#c2b49a', ground: '#6a5232', hemi: 1.12, sun: '#ffc98a', sunI: 2.2, fog: '#ddbd8e', fogNear: 42, fogFar: 340,
    skyTop: '#7d90c2', skyHor: '#ffce96', sunDisc: '#ffe9bd', sunSize: 0.0032, sat: 1.07, vig: 0.24, shadowExt: 20, aurora: 0, gain: '#ffffff', ...WATER },
  golden: { az: 95, el: 17, sky: '#d9b28c', ground: '#6a4a2c', hemi: 1.14, sun: '#ffb763', sunI: 2.5, fog: '#e5bd85', fogNear: 40, fogFar: 320,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.09, gain: '#ffedd6', vig: 0.26, shadowExt: 18, aurora: 0, ...WATER },
  dusk: { az: 90, el: 10, sky: '#a88a9a', ground: '#54402e', hemi: 1.0, sun: '#f0a05e', sunI: 1.7, fog: '#c99a72', fogNear: 38, fogFar: 300,
    skyTop: '#46548c', skyHor: '#f2a868', sunDisc: '#ffd9a0', sunSize: 0.0034, sat: 1.06, gain: '#ffe4c4', vig: 0.3, shadowExt: 18, aurora: 0, ...WATER },
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
  if (S.id === 'follow') return blendLight(LIGHTS.park, LIGHTS.late, smooth(ramp(f, 780, 841)));
  if (S.id === 'finale') return blendLight(LIGHTS.golden, LIGHTS.dusk, smooth(ramp(f, 1380, 1430)));
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
export const SURF = [0, 0, -1.2];
export const MZEE_HOME = [30, 0, 0];
export const POND = [24.5, 0, 5.5];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

/** Owen's card position per frame (sweep + reference). */
export const owenPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': case 'tsunami': return [...SURF];
    case 'rescue': return [0.05, 0.55, 1.65]; // carried between villagers
    case 'meet': { const p = kf3([[494, [24.6, 0, 3.4]], [580, [27.2, 0, 1.4], 'easeInOut'], [670, [29.15, 0, 0.25]]], f); return p; }
    case 'movesaway': return [29.15, 0, 0.25];
    case 'follow': { const p = kf3([[749, [29.15, 0, 0.25]], [841, [29.9, 0, 0.15], 'easeInOut']], f); return p; }
    case 'together': {
      if (f < 905) return [29.4, 0, 1.0];
      if (f < 952) return [29.5, 0, 0.6];
      return [24.5, -0.12, 5.5]; // in the pond
    }
    case 'neck': return [29.2, 0, 0.9];
    case 'hippo': case 'friendship': return [29.3, 0, 0.8];
    case 'mother': return [29.35, 0, 0.7];
    case 'finale': return [29.45, 0, 0.6];
    default: return null;
  }
};
/** Mzee's card position per frame. */
export const mzeePosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'meet': case 'movesaway': {
      if (S.id === 'meet') return [...MZEE_HOME];
      const p = kf3([[671, [30, 0, 0]], [748, [31.2, 0, -0.5], 'easeInOut']], f); return p;
    }
    case 'follow': { const p = kf3([[749, [31.2, 0, -0.5]], [841, [30.7, 0, -0.2], 'easeInOut']], f); return p; }
    case 'together': {
      if (f < 905) return [30.5, 0, 0.6];
      if (f < 952) return [30.5, 0, 0.3];
      return [26.7, 0, 4.9]; // pond edge
    }
    case 'neck': return [30.3, 0, 0.5];
    case 'hippo': case 'friendship': return [30.4, 0, 0.5];
    case 'mother': return [30.4, 0, 0.4];
    case 'finale': return [30.4, 0, 0.35];
    default: return null; // coast sections: no tortoise
  }
};
/** Mzee neck extension 0..1 per frame (the money beat stretches in P8). */
export const neckAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'meet': return 0.3;
    case 'movesaway': return 0.2;
    case 'follow': return q(kf([[749, 0.2], [800, 0.45], [841, 0.55]], f), 2);
    case 'together': return f < 952 ? 0.35 : 0.7;
    case 'neck': return q(kf([[1015, 0.35], [1075, 1.0, 'easeInOut'], [1132, 1.0]], f), 2);
    case 'hippo': case 'friendship': return 0.8;
    case 'mother': return 0.6;
    case 'finale': return 0.1;
    default: return 0.3;
  }
};

// ---------- cameras (continuous within each location; park chain is key-matched) ----------
const CAMS = {
  hook: [
    { f: 0, pos: [2.8, 2.0, 6.0], look: [0, 1.5, -4.5], fov: 44 },
    { f: 70, pos: [2.0, 1.5, 4.4], look: [0, 1.0, -3.0], fov: 42, ease: 'surge' },
    { f: 149, pos: [1.1, 1.0, 2.9], look: [0, 0.6, -1.4], fov: 40, ease: 'surge' },
    { f: 166, pos: [1.05, 0.98, 2.8], look: [0, 0.6, -1.4], fov: 39.5 },
  ],
  tsunami: [
    { f: 167, pos: [6, 10.5, 13.5], look: [0, 0.2, -4], fov: 50 },
    { f: 260, pos: [4.5, 5.5, 7.5], look: [0, 0.5, -2.5], fov: 46, ease: 'surge' },
    { f: 320, pos: [1.4, 1.9, 6.6], look: [0.02, 0.75, 0.6], fov: 42, ease: 'surge' },
    { f: 337, pos: [0.5, 1.6, 8.4], look: [0.05, 0.9, 1.9], fov: 42 },
  ],
  rescue: [
    { f: 338, pos: [0.5, 1.6, 8.4], look: [0.05, 0.9, 1.9], fov: 42 },
    { f: 472, pos: [0.1, 1.4, 7.2], look: [0.05, 0.85, 1.8], fov: 41, ease: 'surge' },
    { f: 493, pos: [0.05, 1.38, 7.0], look: [0.05, 0.85, 1.8], fov: 40.5 },
  ],
  meet: [
    { f: 494, pos: [21.5, 2.2, 11.5], look: [28.8, 0.9, 0.3], fov: 46 },
    { f: 580, pos: [24.2, 1.5, 7.8], look: [29.3, 0.9, 0.2], fov: 42, ease: 'surge' },
    { f: 649, pos: [24.9, 1.3, 6.8], look: [29.7, 0.85, 0.1], fov: 40, ease: 'surge' },
    { f: 670, pos: [24.9, 1.3, 6.8], look: [29.7, 0.85, 0.1], fov: 40 },
  ],
  movesaway: [
    { f: 671, pos: [24.9, 1.3, 6.8], look: [29.7, 0.85, 0.1], fov: 40 },
    { f: 731, pos: [25.6, 1.35, 7.2], look: [30.2, 0.85, -0.1], fov: 40, ease: 'surge' },
    { f: 748, pos: [25.8, 1.4, 7.4], look: [30.3, 0.85, -0.15], fov: 40 },
  ],
  follow: [
    { f: 749, pos: [25.8, 1.4, 7.4], look: [30.3, 0.85, -0.15], fov: 40 },
    { f: 822, pos: [25.5, 1.4, 7.9], look: [30.0, 0.85, 0.1], fov: 40, ease: 'surge' },
    { f: 841, pos: [25.4, 1.4, 8.1], look: [29.9, 0.85, 0.15], fov: 40 },
  ],
  together: [
    { f: 842, pos: [25.4, 1.4, 8.1], look: [29.9, 0.85, 0.15], fov: 40 },
    { f: 900, pos: [24.6, 1.3, 8.6], look: [29.9, 0.8, 0.8], fov: 41, ease: 'surge' },
    { f: 952, pos: [23.6, 1.4, 10.0], look: [25.8, 0.72, 5.1], fov: 42, ease: 'surge' },
    { f: 994, pos: [21.8, 1.5, 11.2], look: [25.3, 0.7, 5.3], fov: 43, ease: 'surge' },
    { f: 1014, pos: [22.2, 1.4, 10.4], look: [26.2, 0.8, 3.6], fov: 42 },
  ],
  neck: [
    { f: 1015, pos: [22.2, 1.4, 10.4], look: [26.2, 0.8, 3.6], fov: 42 },
    { f: 1080, pos: [25.4, 1.12, 6.2], look: [29.6, 0.92, 0.65], fov: 37, ease: 'surge' },
    { f: 1132, pos: [25.8, 1.08, 5.8], look: [29.7, 0.92, 0.65], fov: 36.5, ease: 'surge' },
    { f: 1146, pos: [25.8, 1.08, 5.8], look: [29.7, 0.92, 0.65], fov: 36.5 },
  ],
  hippo: [
    { f: 1147, pos: [25.8, 1.08, 5.8], look: [29.7, 0.92, 0.65], fov: 36.5 },
    { f: 1180, pos: [24.9, 1.3, 7.4], look: [29.8, 0.92, 0.6], fov: 40, ease: 'surge' },
    { f: 1197, pos: [24.5, 1.45, 8.4], look: [29.8, 0.92, 0.55], fov: 41 },
  ],
  friendship: [
    { f: 1198, pos: [24.5, 1.45, 8.4], look: [29.8, 0.92, 0.55], fov: 41 },
    { f: 1247, pos: [24.2, 1.5, 9.0], look: [29.8, 0.95, 0.5], fov: 41.5, ease: 'surge' },
    { f: 1272, pos: [24.1, 1.55, 9.3], look: [29.8, 0.95, 0.45], fov: 42 },
  ],
  mother: [
    { f: 1273, pos: [24.1, 1.55, 9.3], look: [29.8, 0.95, 0.45], fov: 42 },
    { f: 1336, pos: [24.5, 1.5, 8.9], look: [29.9, 0.9, 0.5], fov: 41, ease: 'surge' },
    { f: 1351, pos: [24.7, 1.48, 8.7], look: [29.9, 0.9, 0.45], fov: 41 },
  ],
  finale: [
    { f: 1352, pos: [24.7, 1.48, 8.7], look: [29.9, 0.9, 0.45], fov: 41 },
    { f: 1406, pos: [25.0, 1.6, 10.6], look: [30.3, 1.0, 0.0], fov: 43, ease: 'surge' },
    { f: 1430, pos: [25.3, 1.65, 11.2], look: [30.5, 1.05, -0.2], fov: 43.5 },
  ],
};
const SHADOW_AT = { hook: [0, 0.6, -1.5], tsunami: [0, 0.6, -1.5], rescue: [0, 0.6, 1.8], meet: [29, 0.6, 0.2], movesaway: [29.5, 0.6, 0], follow: [29.5, 0.6, 0.2], together: [27, 0.6, 2.5], neck: [29, 0.8, 1.1], hippo: [29, 0.8, 1], friendship: [29, 0.8, 0.9], mother: [29.2, 0.8, 0.7], finale: [29.5, 0.8, 0.4] };
const DIPS = [494]; // the one location change: coast -> Haller Park
const shotCam = (id, f) => camFromKeys(CAMS[id], f);
export const camAt = (f) => {
  const S = shotAt(f);
  const c = shotCam(S.id, f);
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
    case 'hook': point = [0, 0.6, -1.2]; cinf = 5.5; break;
    case 'tsunami': point = [0, 0.6, -1.2]; cinf = 9; break;
    case 'rescue': point = [0.1, 0.9, 1.6]; cinf = 9; break;
    case 'together': point = f < 952 ? [29, 0.8, 1.4] : [24.5, 0.6, 5.5]; cinf = 8; break;
    case 'neck': point = [29, 0.95, 1.1]; cinf = 7; break;
    default: { const mp = mzeePosAt(f), op = owenPosAt(f); point = mp && op ? [(mp[0] + op[0]) / 2, 0.85, (mp[2] + op[2]) / 2] : (op || [0, 1, 0]); cinf = 8; }
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, dust: 0.15, windK: 0.5, boardT: 0, waveK: 0, surfK: 0.4, glintK: 0, grassK: 0.4, pondK: 0 };
  switch (S.id) {
    case 'hook': W.waveK = smooth(ramp(f, 10, 70)); W.surfK = 0.9; W.windK = 1.2; W.dust = 0.1; break;
    case 'tsunami': W.waveK = f < 260 ? 1 : lerp(1, 0.45, ramp(f, 260, 337)); W.surfK = 1; W.windK = 1.6; W.dust = 0.2; break;
    case 'rescue': W.waveK = 0.3; W.surfK = 0.6; W.windK = 0.8; W.dust = 0.15; break;
    case 'meet': W.dust = 0.35; W.windK = 0.7; W.grassK = 0.9; break;
    case 'movesaway': W.dust = 0.35; W.windK = 0.7; W.grassK = 0.9; break;
    case 'follow': W.dust = 0.45; W.windK = 0.8; W.grassK = 1; W.glintK = 0.4; break;
    case 'together': W.dust = 0.5; W.windK = 0.9; W.grassK = 1; W.pondK = f >= 952 ? 1 : 0; break;
    case 'neck': W.dust = 0.4; W.windK = 0.5; W.grassK = 0.7; W.glintK = 0.6; break;
    case 'hippo': case 'friendship': W.dust = 0.35; W.windK = 0.5; W.grassK = 0.7; break;
    case 'mother': W.dust = 0.3; W.windK = 0.4; W.grassK = 0.6; break;
    case 'finale': W.dust = 0.25; W.windK = 0.35; W.grassK = 0.55; W.boardT = smooth(ramp(f, 1372, 1422)); break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { smokeRate: 0, dustRate: 0.1 };
    case 'tsunami': return { smokeRate: 0, dustRate: 0.15 };
    case 'rescue': return { smokeRate: 0, dustRate: 0.15 };
    case 'together': return { smokeRate: 2.2, dustRate: 0.5 };
    case 'neck': return { smokeRate: 1.4, dustRate: 0.4 };
    case 'finale': return { smokeRate: 0.9, dustRate: 0.3 };
    case 'meet': case 'movesaway': case 'follow': return { smokeRate: 1.8, dustRate: 0.4 };
    default: return { smokeRate: 1.2, dustRate: 0.35 };
  }
};

// ---------- actors ----------
const TINT = { coast: '#ffffff', storm: '#dfe6ee', coastday: '#ffffff', park: '#ffffff', late: '#ffe9c4', golden: '#ffd9a3' };
const tintFor = (S, f) => S.id === 'finale' ? (f > 1400 ? '#ffc9a0' : TINT.golden) : (TINT[S.light] || '#ffffff');
const RO = (T, o, pos, extra = {}) => ({ key: 'owen' + JSON.stringify(o), draw: (p) => T.owenCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RM = (T, o, pos, extra = {}) => ({ key: 'mzee' + JSON.stringify(o), draw: (p) => T.mzeeCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RHu = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => (who === 'ranger' ? T.rangerCard(p, o) : T.villagerCard(p, o)), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S, f);
  const owen = owenPosAt(f), mzee = mzeePosAt(f), neck = neckAt(f);
  switch (S.id) {
    case 'hook': {
      out.push(RO(T, { pose: 'side', step: q((f * 0.03) % 1, 2), headDown: 0.2 }, owen, { tint, s: 0.72, yaw: 0.3 }));
      break;
    }
    case 'tsunami': {
      out.push(RO(T, { pose: f < 260 ? 'front' : 'side', step: 0, headDown: 0.3 }, owen, { tint, s: 0.66, yaw: 0.2 }));
      break;
    }
    case 'rescue': {
      // Owen carried between two villagers (lifted y), ranger guiding, third villager behind
      out.push(RHu(T, 'villager', { v: 0, expr: 'nervous', L: 'belly', R: 'belly', blink: blinkAt(f, 71), bob: q(breath(f, 71), 3) }, [-0.95, 0, 1.75], { tint, s: 1.0, yaw: 0.3 }));
      out.push(RHu(T, 'villager', { v: 1, expr: 'nervous', L: 'belly', R: 'belly', blink: blinkAt(f, 83), bob: q(breath(f, 83), 3) }, [1.1, 0, 1.75], { tint, s: 0.98, yaw: -0.3 }));
      out.push(RO(T, { pose: 'side', step: 0, headDown: 0.4 }, owen, { tint, s: 0.52, yaw: 0.1 }));
      out.push(RHu(T, 'ranger', { expr: 'smile', L: 'hang', R: 'point', blink: blinkAt(f, 61), bob: q(breath(f, 61), 3) }, [1.85, 0, 2.9], { tint, s: 1.02, yaw: -0.5 }));
      out.push(RHu(T, 'villager', { v: 2, expr: 'smile', L: 'hang', R: 'up', blink: blinkAt(f, 97), bob: q(breath(f, 97), 3) }, [-1.85, 0, 3.0], { tint, s: 0.96, yaw: 0.5 }));
      break;
    }
    case 'meet': {
      out.push(RM(T, { pose: 'side', neck, step: 0 }, mzee, { tint, s: 1.35, yaw: -0.25 }));
      const hiding = f >= 600;
      out.push(RO(T, { pose: hiding ? 'hide' : 'side', step: q(hiding ? 0 : (f * 0.05) % 1, 2), headDown: q(hiding ? 0.5 : 0.15, 2) }, owen, { tint, s: 0.55, yaw: 0.3 }));
      break;
    }
    case 'movesaway': {
      out.push(RM(T, { pose: 'side', neck, step: q((f * 0.02) % 1, 2) }, mzee, { tint, s: 1.35, yaw: -0.2 }));
      out.push(RO(T, { pose: 'side', step: 0, headDown: 0.45 }, owen, { tint, s: 0.55, yaw: 0.35 }));
      break;
    }
    case 'follow': {
      out.push(RM(T, { pose: 'side', neck, step: q((f * 0.018) % 1, 2) }, mzee, { tint, s: 1.35, yaw: 0.2, flip: true }));
      out.push(RO(T, { pose: 'side', step: q((f * 0.055) % 1, 2), headDown: 0.1 }, owen, { tint, s: 0.55, yaw: 0.3 }));
      break;
    }
    case 'together': {
      if (f < 905) { // eat: both heads down at the grass
        out.push(RM(T, { pose: 'side', neck: 0.5, step: 0 }, mzee, { tint, s: 1.35, yaw: 0.25, flip: true }));
        out.push(RO(T, { pose: 'side', step: 0, headDown: 0.75 }, owen, { tint, s: 0.55, yaw: 0.3 }));
      } else if (f < 952) { // sleep: both low and still, side by side
        out.push(RM(T, { pose: 'side', neck: 0.05, step: 0 }, mzee, { tint, s: 1.35, yaw: 0.25, flip: true }));
        out.push(RO(T, { pose: 'hide', step: 0, headDown: 0.6 }, owen, { tint, s: 0.55, yaw: 0.3 }));
      } else { // swim: Owen in the pond, Mzee at the edge with neck out
        out.push(RM(T, { pose: 'side', neck, step: 0 }, mzee, { tint, s: 1.3, yaw: 0.45, flip: true }));
        out.push(RO(T, { pose: 'swim', step: q((f * 0.06) % 1, 2) }, owen, { tint, s: 0.58, yaw: 0.4 }));
      }
      break;
    }
    case 'neck': {
      out.push(RM(T, { pose: 'side', neck, step: 0 }, mzee, { tint, s: 1.4, yaw: 0.3, flip: true }));
      out.push(RO(T, { pose: 'side', step: 0, headDown: 0, lick: f >= 1075 ? 1 : 0 }, owen, { tint, s: 0.6, yaw: 0.45 }));
      break;
    }
    case 'hippo': case 'friendship': {
      out.push(RM(T, { pose: 'side', neck, step: 0 }, mzee, { tint, s: 1.38, yaw: 0.3, flip: true }));
      out.push(RO(T, { pose: 'front', lick: 0 }, owen, { tint, s: 0.58, yaw: 0.15 }));
      break;
    }
    case 'mother': {
      out.push(RM(T, { pose: 'side', neck, step: 0 }, mzee, { tint, s: 1.38, yaw: 0.3, flip: true }));
      out.push(RO(T, { pose: 'side', step: 0, headDown: 0.3 }, owen, { tint, s: 0.57, yaw: 0.35 }));
      break;
    }
    case 'finale': {
      out.push(RM(T, { pose: 'side', neck, step: 0 }, mzee, { tint, s: 1.38, yaw: 0.3, flip: true }));
      out.push(RO(T, { pose: 'hide', step: 0, headDown: 0.65 }, owen, { tint, s: 0.57, yaw: 0.35 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
export const fxAt = (f, T) => [];
