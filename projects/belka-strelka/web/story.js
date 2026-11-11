// Shot plan for "Belka & Strelka — The Dogs Who Came Back From Space"
// (57.075 s, 30 fps, TOTAL 1712). True story: Moscow 1960, Korabl-Sputnik 2.
// Phrases (voice timing): P1 0-130 hook | P2 182-283 rescue | P3 334-441 echo |
// P4 487-601 loading | P5 652-748 launch | P6 797-932 orbit x17 |
// P7 982-1088 window | P8 1141-1238 re-entry | P9 1282-1385 parachute |
// P10 1438-1550 puppies | P11 1600-1711 finale. SHOTS tile 0-1711 CONTIGUOUSLY
// (inter-phrase gaps belong to the running section).
// World (built in main.js): Moscow street at origin (board (-1.6,2.5,-12.8));
// statue park (26,0,34) plinth top y 0.97, board (26,2.9,30.2); training room
// (34,0,-4), capsule mock world (32.5,~,-6.5); launch pad (-38,0,6), gantry
// (-34.4,0,6), crowd fence z=19.5; orbit: Earth centre (0,30,230) r=85,
// capsule loop centre (0,92,158) R=30, park (0,100,150), counter board
// (-36,124,150); capsule interior wall z=150.6, window (-1.2,101.3);
// steppe (75,0,65) landing capsule; garden (-72,0,42).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30, TOTAL = 1712, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 181, light: 'dusk' },
  { id: 'rescue', a: 182, b: 333, light: 'dusk' },
  { id: 'echo', a: 334, b: 486, light: 'night' },
  { id: 'loading', a: 487, b: 651, light: 'room' },
  { id: 'launch', a: 652, b: 796, light: 'dawn' },
  { id: 'orbit', a: 797, b: 981, light: 'space' },
  { id: 'window', a: 982, b: 1140, light: 'space' },
  { id: 'reentry', a: 1141, b: 1281, light: 'fire' },
  { id: 'parachute', a: 1282, b: 1437, light: 'gold' },
  { id: 'puppies', a: 1438, b: 1599, light: 'day' },
  { id: 'finale', a: 1600, b: 1711, light: 'gold' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#16222e', waterShal: '#24384a', glint: '#cfe0ff' };
export const LIGHTS = {
  dusk: { az: 262, el: 13, sky: '#4a5570', ground: '#2a2438', hemi: 0.78, sun: '#ffb37a', sunI: 1.7, fog: '#463d55', fogNear: 24, fogFar: 230,
    skyTop: '#1d2745', skyHor: '#e88d5f', sunDisc: '#ffcf9a', sunSize: 0.004, sat: 1.05, vig: 0.3, shadowExt: 16, aurora: 0, ...WATER },
  room: { az: 120, el: 40, sky: '#6a6f7d', ground: '#3a3230', hemi: 1.08, sun: '#ffd9a8', sunI: 1.5, fog: '#4c443c', fogNear: 16, fogFar: 130,
    skyTop: '#3d4250', skyHor: '#8a7a68', sunDisc: '#ffe9c4', sunSize: 0.003, sat: 1.02, vig: 0.34, shadowExt: 10, aurora: 0, ...WATER },
  dawn: { az: 95, el: 15, sky: '#8d9cc0', ground: '#4a4250', hemi: 1.0, sun: '#ffc37e', sunI: 2.2, fog: '#c8a58a', fogNear: 38, fogFar: 330,
    skyTop: '#54719f', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0034, sat: 1.05, vig: 0.26, shadowExt: 24, aurora: 0, ...WATER },
  day: { az: 130, el: 42, sky: '#aebfe0', ground: '#5a6a80', hemi: 1.15, sun: '#fff1d6', sunI: 2.0, fog: '#c3cfdf', fogNear: 45, fogFar: 340,
    skyTop: '#6f97cc', skyHor: '#dfe9f2', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.03, vig: 0.22, shadowExt: 20, aurora: 0, ...WATER },
  space: { az: 268, el: 34, sky: '#0a1024', ground: '#05070f', hemi: 0.5, sun: '#ffffff', sunI: 2.4, fog: '#04060d', fogNear: 130, fogFar: 950,
    skyTop: '#01020a', skyHor: '#0d1836', sunDisc: '#ffffff', sunSize: 0.0022, sat: 1.0, vig: 0.3, shadowExt: 30, aurora: 0, ...WATER },
  night: { az: 215, el: 30, sky: '#2c3c5e', ground: '#14161f', hemi: 0.82, sun: '#b9ccff', sunI: 1.2, fog: '#1b2740', fogNear: 26, fogFar: 260,
    skyTop: '#0d1526', skyHor: '#27395c', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 1.03, vig: 0.3, shadowExt: 15, aurora: 0.35, ...WATER },
  gold: { az: 245, el: 12, sky: '#7a5a70', ground: '#3a2c22', hemi: 0.85, sun: '#ffb35e', sunI: 2.1, fog: '#a8765a', fogNear: 30, fogFar: 300,
    skyTop: '#35406e', skyHor: '#ffab5e', sunDisc: '#ffd9a0', sunSize: 0.0042, sat: 1.08, vig: 0.28, shadowExt: 22, aurora: 0, ...WATER },
  fire: { az: 250, el: 20, sky: '#4a2430', ground: '#1c0d10', hemi: 0.55, sun: '#ff8a3c', sunI: 2.3, fog: '#571f14', fogNear: 60, fogFar: 700,
    skyTop: '#1c0812', skyHor: '#e85a1e', sunDisc: '#ffb37a', sunSize: 0.003, sat: 1.06, vig: 0.32, shadowExt: 26, aurora: 0, ...WATER },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t);
  o.sunI = o.sunI * (1 - 0.45 * Math.sin(Math.PI * t));
  return o;
};
export const lightFor = (S, f) => {
  if (S.id === 'launch') return blendLight(LIGHTS.dawn, LIGHTS.day, smooth(ramp(f, 726, 796)));
  if (S.id === 'reentry') return blendLight(LIGHTS.space, LIGHTS.fire, smooth(ramp(f, 1141, 1210)));
  if (S.id === 'finale') return blendLight(LIGHTS.gold, LIGHTS.night, 0.5 * smooth(ramp(f, 1648, 1711)));
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
export const IGNITION_F = 672; // "roared skyward" — fire starts here
export const rocketYAt = (f) => {
  if (f < 675) return 0;
  const u = ramp(f, 675, 796);
  return Math.pow(u, 1.35) * 44;
};
export const dogsStreetZ = (f) => kf([[0, 6.5], [130, 1.1], [181, 1.1]], f);
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

/** Orbit counter: completed loops. 0 before orbit; ticks 1..17 across
 *  f797-932 (== floor of loops flown); 17 from f932 on. */
export const orbitCountAt = (f) => {
  if (f < 797) return 0;
  if (f >= 932) return 17;
  return Math.min(17, Math.floor(17 * ramp(f, 797, 932)));
};
const LOOP_C = [0, 96, 146], LOOP_R = 11, PARK = [0, 100, 138];
/** Capsule exterior position: loops the Earth 17x during P6, then settles
 *  to the park position for the cabin cutaway at the section tail. */
export const capsulePosAt = (f) => {
  if (f < 797) return [...PARK];
  if (f <= 932) {
    const loops = 17 * ramp(f, 797, 932);
    const a = -Math.PI / 2 + loops * Math.PI * 2;
    return [LOOP_C[0] + Math.cos(a) * LOOP_R, LOOP_C[1] + Math.sin(a) * LOOP_R * 0.92, LOOP_C[2]];
  }
  if (f < 958) { // settle from loop end (bottom of the last loop) to park
    const end = [LOOP_C[0], LOOP_C[1] - LOOP_R * 0.92, LOOP_C[2]];
    return lerp3(end, PARK, smooth(ramp(f, 932, 958)));
  }
  return [...PARK];
};
/** Re-entry fall track (P8): high bright point -> low, slowing as air bites. */
export const reentryPosAt = (f) => kf3([[1141, [28, 138, 168]], [1210, [14, 116, 159], 'surge'], [1281, [2, 100, 152], 'surge']], f);
/** Parachute descent (P9): capsule altitude over the steppe; 0 = touchdown (~f1402). */
export const descentAt = (f) => {
  if (f < 1282) return 30;
  if (f >= 1402) return 0;
  const u = ramp(f, 1282, 1402);
  return 30 * (1 - u * u * (3 - 2 * u)) * (1 - 0.12 * u); // smoothstep fall, easing in
};
export const heroPosAt = (f) => { // Belka's card position (breath puffs on the cold street)
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return [-0.55, 0, dogsStreetZ(f)];
    case 'rescue': return [-0.7, 0, 0.4];
    case 'echo': return [24.9, 0, 37.6];
    case 'window': return [0.95, 100.55, 147];
    default: return null;
  }
};

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [3.8, 1.15, 12.6], look: [0.05, 0.66, 5.2], fov: 43 },
    { f: 130, pos: [2.8, 0.97, 6.0], look: [0, 0.62, 1.0], fov: 38, ease: 'surge' },
    { f: 181, pos: [2.7, 0.96, 5.5], look: [0.02, 0.62, 0.6], fov: 37.5 },
  ],
  rescue: [
    { f: 182, pos: [2.7, 0.96, 5.5], look: [0.02, 0.62, 0.6], fov: 37.5 },
    { f: 283, pos: [3.1, 1.15, 5.5], look: [0.1, 0.85, -0.3], fov: 44, ease: 'surge' },
    { f: 333, pos: [3.2, 1.2, 5.7], look: [0.12, 0.88, -0.35], fov: 44 },
  ],
  echo: [
    { f: 334, pos: [26, 2.1, 47.5], look: [26, 2.3, 33.6], fov: 40 },
    { f: 441, pos: [26, 1.9, 45.6], look: [26, 2.35, 33.8], fov: 40, ease: 'surge' },
    { f: 486, pos: [26, 1.85, 45.0], look: [26, 2.4, 33.9], fov: 39.5 },
  ],
  loading: [
    { f: 487, pos: [38.6, 1.7, 3.4], look: [33.3, 0.8, -4.6], fov: 50 },
    { f: 560, pos: [38.2, 1.6, 3.0], look: [33.25, 0.8, -4.55], fov: 49 },
    { f: 601, pos: [37.8, 1.55, 3.2], look: [33.5, 0.78, -4.3], fov: 48, ease: 'surge' },
    { f: 651, pos: [37.6, 1.5, 3.3], look: [33.55, 0.78, -4.25], fov: 48 },
  ],
  launch: [
    { f: 652, pos: [-21.8, 2.8, 32.2], look: [-37.2, 4.8, 7], fov: 42 },
    { f: 730, pos: [-22.6, 3.6, 30.8], look: [-37.5, 10, 6.7], fov: 42, ease: 'surge' },
    { f: 796, pos: [-24.2, 5.0, 29.4], look: [-38, 30, 6.2], fov: 44, ease: 'surge' },
  ],
  orbit: [
    { f: 797, pos: [0, 99, 84], look: [0, 91, 150], fov: 46 },
    { f: 880, pos: [1.5, 99.6, 98], look: [0, 94, 146], fov: 45, ease: 'surge' },
    { f: 950, pos: [3.6, 100.8, 116], look: [0, 98.6, 138], fov: 43, ease: 'surge' },
    { f: 981, pos: [4.4, 101.2, 120], look: [-0.2, 98.4, 138.5], fov: 42 },
  ],
  window: [
    { f: 982, pos: [0.2, 101.0, 138.2], look: [0.05, 100.9, 149], fov: 37 },
    { f: 1088, pos: [0.25, 100.95, 138.6], look: [0.08, 100.88, 149], fov: 36, ease: 'surge' },
    { f: 1140, pos: [0.3, 100.9, 138.8], look: [0.1, 100.85, 149], fov: 35.5 },
  ],
  reentry: [
    { f: 1141, pos: [12, 116, 115], look: [18, 120, 160], fov: 42 },
    { f: 1210, pos: [7, 105, 112], look: [8, 114, 155], fov: 42, ease: 'surge' },
    { f: 1281, pos: [1, 94, 110], look: [0, 106, 151], fov: 41, ease: 'surge' },
  ],
  parachute: [
    { f: 1282, pos: [62, 8.5, 44], look: [75, 23, 65], fov: 42 },
    { f: 1340, pos: [63.5, 6, 46], look: [74.5, 12.5, 65], fov: 42, ease: 'surge' },
    { f: 1402, pos: [65, 3.4, 49], look: [74, 2.2, 65], fov: 41, ease: 'surge' },
    { f: 1437, pos: [65.6, 3.0, 50], look: [73.8, 1.9, 65], fov: 40 },
  ],
  puppies: [
    { f: 1438, pos: [-66.5, 1.7, 33.5], look: [-71.6, 0.8, 41.6], fov: 42 },
    { f: 1550, pos: [-67.2, 1.55, 34.6], look: [-71.4, 0.78, 41.4], fov: 40, ease: 'surge' },
    { f: 1599, pos: [-67.5, 1.5, 35.0], look: [-71.3, 0.78, 41.3], fov: 39.5 },
  ],
  finale: [
    { f: 1600, pos: [68.5, 2.3, 55.5], look: [74.3, 1.7, 63.8], fov: 41 },
    { f: 1711, pos: [69.8, 2.0, 57.5], look: [74.4, 1.9, 63.6], fov: 40, ease: 'surge' },
  ],
};
const SHADOW_AT = { hook: [0, 0.5, 2], rescue: [0.4, 0.5, 0], echo: [26, 1, 34], loading: [34, 0.5, -4.5], launch: [-38, 4, 6], orbit: [0, 98, 152], window: [0, 100.5, 147], reentry: [8, 108, 152], parachute: [75, 2, 65], puppies: [-72, 0.5, 42], finale: [75, 1, 65] };
const BRIDGES = { rescue: 14 }; // same-set enter (street -> street)
const DIPS = [334, 487, 652, 797, 982, 1141, 1282, 1438, 1600];
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
  if (S.id === 'launch' && f >= IGNITION_F) {
    const amp = 0.03 * (1 - ramp(f, IGNITION_F, 780));
    c.pos = [c.pos[0] + Math.sin(f * 1.71) * amp, c.pos[1] + Math.sin(f * 2.13 + 1) * amp * 0.8, c.pos[2]];
    c.look = [c.look[0] + Math.sin(f * 1.93 + 2) * amp, c.look[1], c.look[2]];
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
    case 'hook': point = [0, 0.6, dogsStreetZ(f)]; cinf = 10; break;
    case 'rescue': point = [0.2, 0.9, 0]; cinf = 9; break;
    case 'echo': point = [26, 2.1, 34]; cinf = 8; break;
    case 'loading': point = [33.6, 0.9, -4.6]; cinf = 7; break;
    case 'launch': point = [-38.3, 8 + rocketYAt(f) * 0.7, 6.3]; cinf = 4; break;
    case 'orbit': point = capsulePosAt(f); cinf = 1.4; break;
    case 'window': point = [0.2, 100.8, 147.5]; cinf = 2.2; break;
    case 'reentry': point = reentryPosAt(f); cinf = 2.5; break;
    case 'parachute': point = [74.5, 2 + descentAt(f), 65]; cinf = 5; break;
    case 'puppies': point = [-71.5, 0.7, 41.5]; cinf = 6; break;
    case 'finale': point = [74.3, 1.2, 64.5]; cinf = 7; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lanternSet: [], mist: 0.08, snowK: 0, windK: 0.4, starK: 0, winGlow: 0, statueGlint: 0, breathK: 0, sparkleK: 0, earthK: 0, capGlow: 0 };
  switch (S.id) {
    case 'hook': W.lanternSet = [0, 1, 2]; W.snowK = 0.55; W.windK = 0.7; W.starK = 0.25; W.winGlow = 0.9; W.breathK = 1; W.mist = 0.14; break;
    case 'rescue': W.lanternSet = [0, 1]; W.snowK = 0.5; W.windK = 0.6; W.starK = 0.25; W.winGlow = 0.9; W.breathK = 0.7; W.mist = 0.12; break;
    case 'echo': W.lanternSet = [5, 6]; W.snowK = 0.25; W.windK = 0.25; W.starK = 1; W.mist = 0.05; W.breathK = 0.5;
      W.statueGlint = 0.4 + 0.4 * smooth(ramp(f, 400, 486)); break;
    case 'loading': W.snowK = 0; W.windK = 0.05; W.starK = 0; W.winGlow = 0.4; break;
    case 'launch': W.snowK = 0.1 * (1 - ramp(f, 675, 780)); W.windK = 0.6; W.mist = 0.08; break;
    case 'orbit': W.starK = 1; W.sparkleK = 0.8; W.earthK = 1; W.windK = 0; W.capGlow = 0.7; break;
    case 'window': W.starK = 0.9; W.sparkleK = smooth(ramp(f, 982, 1040)); W.earthK = 1; break;
    case 'reentry': W.starK = 0.4; W.earthK = 0.6; W.capGlow = 1; W.windK = 0.2; break;
    case 'parachute': W.windK = 0.5; W.starK = 0; W.mist = 0.04; break;
    case 'puppies': W.windK = 0.3; W.mist = 0.03; break;
    case 'finale': W.lanternSet = []; W.windK = 0.3; W.starK = 0.35 + 0.65 * smooth(ramp(f, 1648, 1711)); W.mist = 0.04; break;
  }
  return W;
};
/** Rocket fire + pad steam / chimney smoke profile per frame. */
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': case 'rescue': return { fireRate: 0, fireScale: 0.6, smokeRate: 1.6 };
    case 'echo': case 'loading': return { fireRate: 0, fireScale: 0.5, smokeRate: 0 };
    case 'launch': {
      const on = f >= IGNITION_F && f < 745;
      return { fireRate: on ? 46 : 0, fireScale: on ? 2.6 : 0.6, smokeRate: f >= IGNITION_F ? 26 : 0.8 };
    }
    default: return { fireRate: 0, fireScale: 0.5, smokeRate: 0 };
  }
};

// ---------- actors (2D cards) ----------
const SCI = 'scientist', SCI_B = 'scientistB';
const KID = { tunic: '#b8524a', skin: '#f5c9a0', hair: '#3b2a20' };
const R = (T, who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'obj') + JSON.stringify(o) + JSON.stringify(who), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RB = (T, o, pos, extra = {}) => ({ key: 'belka' + JSON.stringify(o), draw: (p) => T.belkaCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RS = (T, o, pos, extra = {}) => ({ key: 'strelka' + JSON.stringify(o), draw: (p) => T.strelkaCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RL = (T, o, pos, extra = {}) => ({ key: 'laika' + JSON.stringify(o), draw: (p) => T.laikaCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RM = (T, o, pos, extra = {}) => ({ key: 'mouse' + JSON.stringify(o), draw: (p) => T.mouseCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RP = (T, o, pos, extra = {}) => ({ key: 'plant' + JSON.stringify(o), draw: (p) => T.plantCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { dusk: '#ffd9b8', room: '#ffe4c4', dawn: '#ffe9c4', day: '#ffffff', space: '#dfe8ff', night: '#c3d2ff', gold: '#ffd9a8', fire: '#ffc9a0' };
const tintFor = (S) => TINT[S.light] || '#ffffff';

const CROWD = [
  [-44.5, 'civA', 'grin', 31], [-42.4, 'civB', 'smile', 14], [-40.3, 'civC', 'neutral', 19],
  [-38.2, 'civA', 'smile', 23], [-36.1, 'civB', 'grin', 27], [-34.0, 'civC', 'grin', 11],
  [-31.9, 'civA', 'neutral', 36], [-29.8, 'civB', 'smile', 41],
];

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S);
  switch (S.id) {
    case 'hook': {
      const z = dogsStreetZ(f);
      const step = q((f * 0.085) % 1, 2), sniff = f > 96 && f < 122;
      out.push(RB(T, { view: 'side', step, headDown: sniff ? 0.5 : 0.05, earsUp: 0.85, wag: 0.4, pant: 0, blink: blinkAt(f, 7) },
        [-0.55, 0, z], { tint, s: 0.66 }));
      out.push(RS(T, { view: 'side', step: q(((f + 9) * 0.085) % 1, 2), headDown: 0.05, earsUp: 0.9, wag: 0.5, wagPh: 0.4, pant: 1, blink: blinkAt(f, 11) },
        [1.0, 0, z + 0.55], { tint, s: 0.62 }));
      break;
    }
    case 'rescue': {
      out.push(RB(T, { view: 'front', expr: f < 250 ? 'nervous' : 'relief', earsUp: 1, wag: 0.8, wagPh: q((f * 0.05) % 1, 2), pant: 1, blink: blinkAt(f, 7) },
        [-0.7, breath(f, 3) * 0.5, 0.4], { tint, s: 0.68 }));
      out.push(RS(T, { view: 'front', expr: f < 250 ? 'nervous' : 'smile', earsUp: 0.9, wag: 0.7, wagPh: q((f * 0.045 + 0.3) % 1, 2), pant: 0, blink: blinkAt(f, 11) },
        [0.95, breath(f, 5) * 0.5, 0.75], { tint, s: 0.64 }));
      out.push(R(T, SCI, { seed: 12, expr: 'smile', L: 'hang', R: 'reach', lift: 0.35, blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: -3 },
        [1.85, 0, 0.55], { tint, s: 1.0, yaw: -0.4 }));
      out.push(R(T, SCI_B, { seed: 21, expr: 'grin', L: 'belly', R: 'belly', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), headTilt: 2 },
        [-1.95, 0, -1.55], { tint, s: 0.98, yaw: 0.3 }));
      break;
    }
    case 'echo': {
      out.push(RL(T, { view: 'front', statue: 1, expr: 'calm', earsUp: 1 },
        [26, 0.97, 34], { tint, s: 1.05, ground: 0.99, blob: true }));
      out.push(RB(T, { view: 'front', expr: 'smile', earsUp: 1, wag: 0.3, blink: blinkAt(f, 7) },
        [24.9, 0, 37.6], { tint, s: 0.62 }));
      out.push(RS(T, { view: 'front', expr: 'relief', earsUp: 1, wag: 0.4, wagPh: 0.3, blink: blinkAt(f, 11) },
        [27.2, 0, 37.7], { tint, s: 0.58 }));
      out.push(R(T, SCI, { seed: 12, expr: 'smile', L: 'belly', R: 'point', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: -2 },
        [23.4, 0, 39.3], { tint, s: 0.96, yaw: 0.25 }));
      break;
    }
    case 'loading': {
      out.push(RB(T, { view: 'front', expr: 'grin', earsUp: 1, wag: 0.7, wagPh: q((f * 0.05) % 1, 2), suit: 1, blink: blinkAt(f, 7) },
        [32.6, 0, -4.35], { tint, s: 0.64 }));
      out.push(RS(T, { view: 'front', expr: 'smile', earsUp: 0.95, wag: 0.6, wagPh: q((f * 0.04 + 0.2) % 1, 2), suit: 1, blink: blinkAt(f, 11) },
        [34.15, 0, -4.3], { tint, s: 0.6 }));
      out.push(RM(T, { step: q((f * 0.03) % 1, 2) }, [32.9, 0, -2.55], { tint, s: 0.45 }));
      out.push(RM(T, { step: q((f * 0.026 + 0.5) % 1, 2) }, [34.7, 0, -2.5], { tint, s: 0.42, flip: true }));
      out.push(RP(T, { ph: q((f * 0.01) % 1, 2) }, [31.7, 0, -4.75], { tint, s: 0.5 }));
      out.push(RP(T, { ph: q((f * 0.01 + 0.4) % 1, 2) }, [35.3, 0, -4.7], { tint, s: 0.44 }));
      out.push(R(T, SCI, { seed: 12, expr: 'stern', L: 'hang', R: 'point', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: -2 },
        [36.3, 0, -3.1], { tint, s: 1.0, yaw: -0.3 }));
      break;
    }
    case 'launch': {
      const cheer = f >= IGNITION_F;
      CROWD.forEach(([x, who, expr, seed], i) => {
        out.push(R(T, who, { seed, expr: cheer ? (i % 2 ? 'laugh' : 'grin') : expr,
          L: cheer || i % 3 === 0 ? 'wave' : 'hang', R: cheer || i % 4 === 1 ? 'up' : 'hang',
          wv: q(f * 0.3 + i, 1), blink: blinkAt(f, seed), bob: q(breath(f, seed), 3), headTilt: (i % 5) - 2 },
          [x, 0, 19.5], { tint, s: 0.92 + (i % 3) * 0.04 }));
      });
      out.push(R(T, KID, { seed: 23, expr: 'grin', L: 'up', R: 'wave', wv: q(f * 0.45, 1), blink: blinkAt(f, 23), bob: q(Math.abs(Math.sin(f * 0.3)) * 0.012, 3) },
        [-33.5, 0, 18.4], { tint, s: 0.6 }));
      out.push(R(T, SCI, { seed: 12, expr: 'stern', L: 'belly', R: 'point', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3) },
        [-34.2, 0, 14.5], { tint, s: 1.0, yaw: 0.4 }));
      break;
    }
    case 'orbit': {
      if (f >= 950) { // cabin cutaway at the parked capsule: both dogs at the window, calm
        const cp = capsulePosAt(f);
        out.push(RB(T, { view: 'front', expr: 'smile', earsUp: 0.9, wag: 0.25, suit: 1, float: 1, blink: blinkAt(f, 7) },
          [cp[0] - 0.42, cp[1] - 0.72, cp[2] - 2.0], { tint: '#ffe9d2', s: 0.72, blob: false, shadow: false }));
        out.push(RS(T, { view: 'front', expr: 'relief', earsUp: 0.9, wag: 0.3, wagPh: 0.3, suit: 1, float: 1, blink: blinkAt(f, 11) },
          [cp[0] + 0.48, cp[1] - 0.76, cp[2] - 2.0], { tint: '#ffe9d2', s: 0.68, blob: false, shadow: false }));
      }
      break;
    }
    case 'window': {
      out.push(RB(T, { view: 'front', expr: f < 1050 ? 'shock' : 'smile', earsUp: 1, wag: 0.3, suit: 1, float: 1, blink: blinkAt(f, 7) },
        [0.95, 100.55 + q(Math.sin(f * 0.045) * 0.05, 3), 147], { tint: '#ffe9d2', s: 0.82, roll: q(Math.sin(f * 0.03) * 0.04, 3), blob: false, shadow: false }));
      out.push(RS(T, { view: 'front', expr: 'smile', earsUp: 0.9, wag: 0.35, wagPh: 0.3, suit: 1, float: 1, blink: blinkAt(f, 11) },
        [-0.75, 100.3 + q(Math.sin(f * 0.04 + 1) * 0.05, 3), 147.2], { tint: '#ffe9d2', s: 0.74, roll: q(Math.sin(f * 0.028 + 1) * 0.04, 3), blob: false, shadow: false }));
      break;
    }
    case 'reentry': break; // the glowing capsule carries the beat
    case 'parachute': {
      if (f >= 1412) { // touched down: both dogs out on the steppe, shaking off the flight
        out.push(RB(T, { view: 'front', expr: 'relief', earsUp: 1, wag: 1, wagPh: q((f * 0.06) % 1, 2), pant: 1, blink: blinkAt(f, 7) },
          [72.2, 0, 62.6], { tint, s: 0.66 }));
        out.push(RS(T, { view: 'front', expr: 'grin', earsUp: 1, wag: 1, wagPh: q((f * 0.055 + 0.3) % 1, 2), pant: 1, blink: blinkAt(f, 11) },
          [74.6, 0, 62.4], { tint, s: 0.62 }));
      }
      break;
    }
    case 'puppies': {
      out.push(RS(T, { view: 'front', expr: 'smile', earsUp: 0.9, wag: 0.6, wagPh: q((f * 0.04) % 1, 2), pant: 1, blink: blinkAt(f, 11) },
        [-72.6, 0, 41.8], { tint, s: 0.66 })); // grown Strelka, the mother
      out.push(RS(T, { view: 'front', expr: 'grin', earsUp: 1, wag: 1, wagPh: q((f * 0.07) % 1, 2), blink: blinkAt(f, 3) },
        [-73.6, 0, 42.6], { tint, s: 0.32 })); // puppy 1 (patched, like mum)
      out.push(RB(T, { view: 'front', expr: 'grin', earsUp: 1, wag: 1, wagPh: q((f * 0.075 + 0.4) % 1, 2), blink: blinkAt(f, 5) },
        [-71.9, 0, 42.9], { tint, s: 0.3 })); // puppy 2 (pale)
      out.push(RS(T, { view: 'front', expr: 'smile', earsUp: 1, wag: 0.8, wagPh: q((f * 0.06 + 0.2) % 1, 2), blink: blinkAt(f, 9) },
        [-69.9, 0.42, 40.9], { tint, s: 0.34, ground: 0.42 })); // Pushinka, presented on the stand
      out.push(R(T, SCI, { seed: 12, expr: 'smile', L: 'hang', R: 'point', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: -3 },
        [-68.7, 0, 40.2], { tint, s: 1.0, yaw: 0.3 }));
      break;
    }
    case 'finale': {
      out.push(RB(T, { view: 'front', expr: 'relief', earsUp: 1, wag: 0.5, wagPh: q((f * 0.03) % 1, 2), blink: blinkAt(f, 7) },
        [73.4, 0, 63.2], { tint, s: 0.7 }));
      out.push(RS(T, { view: 'front', expr: 'smile', earsUp: 1, wag: 0.55, wagPh: q((f * 0.032 + 0.3) % 1, 2), blink: blinkAt(f, 11) },
        [75.5, 0, 63.3], { tint, s: 0.66 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if ((S.id === 'orbit' || S.id === 'window')) {
    for (let i = 0; i < 2; i++) {
      const t = q(((f / 130) + i * 0.47 + 0.13) % 1, 2);
      const base = S.id === 'orbit' ? [3.5 - i * 6.5, 102.6 - i * 3.4, 146] : [2.6 - i * 4.6, 101.9 - i * 1.4, 146.2];
      out.push(FXC('spk' + i + '_' + t, (p) => T.fxStars(p, t), base, 0.34));
    }
  }
  if (S.id === 'parachute' && f >= 1402 && f < 1445) { // touchdown dust bloom
    const t = q((f - 1402) / 43, 2);
    out.push(FXC('dust_' + t, (p) => T.fxDust(p, t, '#e8d5a8'), [74.8, 0.1, 65.8], 1.5));
  }
  if (S.id === 'finale' && f >= 1658) { // a soft star burst blooms over the pair at the close
    const t = q((f - 1658) / 53, 2);
    out.push(FXC('burst_' + t, (p) => T.fxBurst(p, t, '#ffe9a8', 10, 30, 210), [74.4, 3.0, 62.6], 0.8));
  }
  return out;
};
