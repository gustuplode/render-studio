// Shot plan for "Balto — The Dog Who Saved a Town" — timed to balto-voice
// (45.28 s, 30 fps, TOTAL 1358). True story: Nome, Alaska, 1925 serum run.
// Phrases: P1 0-139 hook | P2 160-306 no serum | P3 328-452 map | P4 475-586 relay (20 teams) |
// P5 607-745 Balto intro | P6 769-887 storm/blind | P7 918-1021 scent trail |
// P8 1045-1174 arrival | P9 1204-1334 statue. SHOTS are contiguous (gaps hold the tail).
// World (built in main.js): snow town — hospital cabin (-4.5,0,-7.6), door spot (-4.5,0,-5.2),
// brazier (1.5,0,-3.5), map board (12,0,0) facing -x, trail corridor x~=2 running z +26 -> -2,
// hero team staging: Balto lead z 6.6, dogs 7.9/8.9, sled prop z 9.9, musher z 11.4.
// Statue park (-11,0,6), pedestal top y 0.97 (cap slab top ~1.06; card base set 0.97 w/ blob on cap).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30, TOTAL = 1358, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 159, light: 'night' },
  { id: 'serum', a: 160, b: 327, light: 'night' },
  { id: 'map', a: 328, b: 474, light: 'night' },
  { id: 'relay', a: 475, b: 606, light: 'grey' },
  { id: 'intro', a: 607, b: 768, light: 'night' },
  { id: 'storm', a: 769, b: 917, light: 'nightlow' },
  { id: 'scent', a: 918, b: 1044, light: 'nightlow' },
  { id: 'arrival', a: 1045, b: 1203, light: 'night' },
  { id: 'statue', a: 1204, b: 1357, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#16222e', waterShal: '#24384a', glint: '#cfe0ff' };
export const LIGHTS = {
  night: { az: 215, el: 34, sky: '#2c3c5e', ground: '#14161f', hemi: 0.85, sun: '#b9ccff', sunI: 1.25, fog: '#1b2740', fogNear: 26, fogFar: 230,
    skyTop: '#0d1526', skyHor: '#27395c', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 1.04, vig: 0.3, shadowExt: 15, aurora: 0.9, ...WATER },
  nightlow: { az: 215, el: 30, sky: '#232f4c', ground: '#101218', hemi: 0.55, sun: '#aebfff', sunI: 0.9, fog: '#141e30', fogNear: 9, fogFar: 95,
    skyTop: '#0a1220', skyHor: '#1f3050', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 0.98, vig: 0.36, shadowExt: 15, aurora: 0.15, ...WATER },
  grey: { az: 250, el: 20, sky: '#54657f', ground: '#232a36', hemi: 0.95, sun: '#cfd8ea', sunI: 1.3, fog: '#2c3a50', fogNear: 30, fogFar: 260,
    skyTop: '#131f38', skyHor: '#3d4f6e', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 1.0, vig: 0.28, shadowExt: 30, aurora: 0.35, ...WATER },
  dawn: { az: 100, el: 16, sky: '#9aa8d8', ground: '#6a5238', hemi: 1.12, sun: '#ffc37e', sunI: 2.35, fog: '#d9b28c', fogNear: 40, fogFar: 300,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.06, gain: '#ffedd6', vig: 0.24, shadowExt: 15, aurora: 0,
    waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' },
  day: { az: 130, el: 38, sky: '#aebfe0', ground: '#5a6a80', hemi: 1.15, sun: '#fff1d6', sunI: 2.0, fog: '#c3cfdf', fogNear: 45, fogFar: 340,
    skyTop: '#6f97cc', skyHor: '#dfe9f2', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.03, vig: 0.2, shadowExt: 15, aurora: 0,
    waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' },
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
  if (S.id === 'arrival') return blendLight(LIGHTS.night, LIGHTS.dawn, smooth(ramp(f, 1057, 1174)));
  if (S.id === 'scent') return blendLight(LIGHTS.nightlow, LIGHTS.night, smooth(ramp(f, 918, 1021)));
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
export const DOOR = [-4.5, 0, -5.2];            // hospital door spot
export const BALTO_FRONT = [2, 0, 6.6];        // intro: lead-dog mark
export const TEAM_Z = { balto: 6.2, dog2: 7.6, dog3: 8.7, sled: 9.9, musher: 11.4 };
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

// ---------- relay: 20 teams mustered in countable rows on the plain ----------
// (portrait frame cannot hold a 57 m line — the count is staged as 4 rows x 5,
//  sea-king style; the middle front team launches toward town at the end)
export const TEAM_COUNT = 20;
export const relayLayout = (f) => {
  const out = [];
  for (let i = 0; i < TEAM_COUNT; i++) {
    const col = i % 5, row = (i / 5) | 0;
    const x = -4.4 + col * 4.4 + ((i * 7) % 3 - 1) * 0.3;
    let z = 4.0 + row * 5.6; // row pitch > team length (~5.1 m) so all 20 read as separate teams
    if (i === 2) z -= 2.6 * ramp(f, 556, 606); // handoff: the next team launches
    out.push({ x, z, ry: ((i * 13) % 5 - 2) * 0.05, bob: Math.abs(Math.sin(f * 0.3 + i * 1.7)) * 0.03 });
  }
  return out;
};

// ---------- trail scroll (metres travelled by the hero team) ----------
export const scrollAt = (f) => kf([[0, 0], [768, 0], [800, 1.2], [887, 7.5], [917, 9.3], [1021, 14.6], [1044, 15.4], [1120, 16.4], [1357, 16.6]], f);

// ---------- hero sled prop ----------
export const heroSledAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'intro') return { x: 2.55, z: TEAM_Z.sled, ry: 0, bob: 0 };
  if (S.id === 'storm' || S.id === 'scent') return { x: 2.55, z: TEAM_Z.sled, ry: 0, bob: Math.abs(Math.sin(f * 0.55)) * 0.018 };
  if (S.id === 'arrival') return { x: 2.3, z: 3.5, ry: 0.85, bob: 0 };
  return null;
};
export const heroPosAt = (f) => { // Balto's card position (sweep + reference)
  const S = shotAt(f);
  switch (S.id) {
    case 'intro': return [...BALTO_FRONT];
    case 'storm': case 'scent': return [2.1, 0, TEAM_Z.balto];
    case 'arrival': return [1.2, 0, 1.2];
    case 'statue': return [-11, 0.97, 6];
    default: return null;
  }
};

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [-0.6, 2.0, 3.4], look: [-4.2, 1.15, -6.2], fov: 44 },
    { f: 139, pos: [-2.9, 1.6, -1.4], look: [-4.45, 1.32, -5.25], fov: 39, ease: 'surge' },
    { f: 159, pos: [-3.0, 1.58, -1.2], look: [-4.45, 1.32, -5.25], fov: 38.5 },
  ],
  serum: [
    { f: 160, pos: [-3.0, 1.58, -1.2], look: [-4.45, 1.32, -5.25], fov: 38.5 },
    { f: 250, pos: [-3.75, 1.45, -3.3], look: [-4.42, 1.28, -5.2], fov: 37, ease: 'surge' },
    { f: 327, pos: [-3.85, 1.44, -3.15], look: [-4.42, 1.28, -5.2], fov: 36 },
  ],
  map: [
    { f: 328, pos: [0.6, 3.1, 1.8], look: [11.8, 2.5, -0.5], fov: 45 },
    { f: 452, pos: [2.2, 2.8, 0.6], look: [11.9, 2.55, -0.5], fov: 42, ease: 'surge' },
    { f: 474, pos: [2.6, 2.75, 0.4], look: [11.9, 2.55, -0.5], fov: 41.5 },
  ],
  relay: [
    { f: 475, pos: [-10, 27, 42], look: [4.4, 0, 12], fov: 47 },
    { f: 560, pos: [-9.5, 25.5, 40], look: [4.4, 0, 12], fov: 46, ease: 'surge' },
    { f: 606, pos: [-9, 24.5, 38.5], look: [4.6, 0, 11.6], fov: 45 },
  ],
  intro: [
    { f: 607, pos: [2.0, 0.98, 3.6], look: [2.0, 0.8, 6.6], fov: 38 },
    { f: 700, pos: [2.0, 1.05, 2.2], look: [2.05, 0.82, 7.0], fov: 40, ease: 'surge' },
    { f: 768, pos: [2.0, 1.15, 0.9], look: [2.1, 0.85, 7.4], fov: 42 },
  ],
  storm: [
    { f: 769, pos: [0.85, 0.8, 2.5], look: [2.2, 0.72, 7.2], fov: 42 },
    { f: 887, pos: [1.0, 0.76, 2.9], look: [2.25, 0.7, 7.3], fov: 41, ease: 'surge' },
    { f: 917, pos: [1.05, 0.75, 3.05], look: [2.25, 0.7, 7.3], fov: 41 },
  ],
  scent: [
    { f: 918, pos: [1.05, 0.75, 3.05], look: [2.25, 0.7, 7.3], fov: 41 },
    { f: 1000, pos: [0.9, 0.66, 3.3], look: [2.2, 0.55, 6.6], fov: 40, ease: 'surge' },
    { f: 1044, pos: [0.85, 0.62, 3.2], look: [2.2, 0.5, 6.5], fov: 39.5 },
  ],
  arrival: [
    { f: 1045, pos: [-1.6, 1.7, 7.8], look: [1.3, 0.8, 1.5], fov: 44 },
    { f: 1174, pos: [-0.9, 1.55, 6.2], look: [1.2, 0.85, 1.4], fov: 40, ease: 'surge' },
    { f: 1203, pos: [-0.8, 1.5, 6.1], look: [1.2, 0.85, 1.4], fov: 39.5 },
  ],
  statue: [
    { f: 1204, pos: [-11, 1.75, 13.2], look: [-11, 1.7, 6], fov: 42 },
    { f: 1334, pos: [-11, 1.5, 9.6], look: [-11, 1.95, 6], fov: 38, ease: 'surge' },
    { f: 1357, pos: [-11, 1.48, 9.3], look: [-11, 2.0, 6], fov: 37.5 },
  ],
};
const SHADOW_AT = { hook: [-4.4, 1, -5.4], serum: [-4.4, 1, -5.4], map: [11, 1.5, 0], relay: [0, 0, 0], intro: [2, 0.6, 7.5], storm: [2, 0.5, 7], scent: [2, 0.5, 7], arrival: [1.2, 0.7, 1.5], statue: [-11, 1, 6] };
const BRIDGES = { storm: 14, arrival: 36 }; // map/relay/intro/statue enter through dips (location changes); serum/scent keys are continuous
const DIPS = [328, 475, 607, 1204];
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
  if (S.id === 'storm' || S.id === 'scent') { // wind buffet: tiny deterministic shake, stronger in the storm
    const amp = S.id === 'storm' ? 0.012 : 0.006;
    c.pos = [c.pos[0] + Math.sin(f * 1.31) * amp, c.pos[1] + Math.sin(f * 1.73 + 1) * amp * 0.7, c.pos[2]];
    c.look = [c.look[0] + Math.sin(f * 1.53 + 2) * amp, c.look[1], c.look[2]];
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
    case 'hook': point = [-4.45, 1.35, -5.2]; cinf = 10; break;
    case 'serum': point = [-4.42, 1.3, -5.2]; cinf = 12; break;
    case 'map': point = [11.9, 2.55, -0.5]; cinf = 5; break;
    case 'relay': point = [4.4, 0, 12]; cinf = 3; break;
    case 'intro': point = [2, 0.85, 6.6]; cinf = 9; break;
    case 'storm': point = [2.2, 0.6, 6.2]; cinf = 8; break;
    case 'scent': point = [2.15, 0.5, 6.2]; cinf = 8; break;
    case 'arrival': point = [1.45, 0.85, 1.4]; cinf = 6; break;
    case 'statue': point = [-11, 2.25, 6]; cinf = 8; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state (drives set pieces + FX in main.js worldState) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lanternSet: [], mist: 0.1, snowK: 0.5, windK: 0.6, scentK: 0, mapT: 0, starK: 0.9, winGlow: 0.8, statueGlint: 0, bottleK: 0, bottleGlint: 0 };
  switch (S.id) {
    case 'hook': W.lanternSet = [0, 2]; W.mist = 0.25; W.snowK = 0.55; W.starK = 1; W.winGlow = 1; break;
    case 'serum':
      W.lanternSet = [2]; W.mist = 0.2; W.snowK = 0.5; W.winGlow = 1; break; // bottle prop parked: the FX message-bottle read wrong at CU range; the beat is the doctor's face + the faint audio clink
    case 'map': W.lanternSet = [3]; W.mist = 0.3; W.snowK = 0.6; W.windK = 0.8; W.winGlow = 0.7; W.mapT = M.easeInOut(ramp(f, 340, 465)); break;
    case 'relay': W.mist = 0.35; W.snowK = 0.7; W.windK = 1.2; W.starK = 0.5; W.winGlow = 0.5; W.mapT = 1; break;
    case 'intro': W.lanternSet = [0, 1]; W.mist = 0.3; W.snowK = 0.55; W.windK = 0.7; W.winGlow = 0.8; break;
    case 'storm': W.mist = 0.9; W.snowK = 1.0; W.windK = 3.2; W.starK = 0.25; W.winGlow = 0.4; break;
    case 'scent':
      W.mist = lerp(0.6, 0.35, ramp(f, 918, 1021)); W.snowK = lerp(0.85, 0.6, ramp(f, 918, 1021));
      W.windK = lerp(2.2, 1.2, ramp(f, 918, 1021)); W.starK = 0.4; W.winGlow = 0.5;
      W.scentK = smooth(ramp(f, 930, 985)); break;
    case 'arrival': W.lanternSet = [0, 1, 2]; W.mist = 0.15; W.snowK = 0.35; W.windK = 0.4; W.starK = 0; W.winGlow = 0.9; break;
    case 'statue':
      W.lanternSet = [4]; W.mist = 0.05; W.snowK = 0.3; W.windK = 0.3; W.starK = 0; W.winGlow = 0.35;
      W.statueGlint = f < 1300 ? 0 : 0.95 * smooth(ramp(f, 1300, 1334)); break;
  }
  return W;
};
/** Brazier/chimney profile per frame (pure — main.js steps the FX sim with this). */
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { fireRate: 14, fireScale: 0.8, smokeRate: 2.2 };
    case 'serum': return { fireRate: 10, fireScale: 0.7, smokeRate: 2.0 };
    case 'map': return { fireRate: 8, fireScale: 0.6, smokeRate: 2.4 };
    case 'relay': return { fireRate: 0, fireScale: 0.5, smokeRate: 3.0 };
    case 'intro': return { fireRate: 16, fireScale: 0.85, smokeRate: 2.2 };
    case 'storm': return { fireRate: 4, fireScale: 0.5, smokeRate: 4.5 };
    case 'scent': return { fireRate: 6, fireScale: 0.55, smokeRate: 3.5 };
    case 'arrival': return { fireRate: 22, fireScale: 1.0, smokeRate: 2.4 };
    case 'statue': return { fireRate: 0, fireScale: 0.5, smokeRate: 1.2 };
    default: return { fireRate: 10, fireScale: 0.7, smokeRate: 2.2 };
  }
};

// ---------- actors (2D cards) ----------
const DOCTOR = { tunic: '#39424e', skin: '#f5c9a0', hair: '#2b211c', shirt: '#eef0ea', moustache: '#241a14' };
const ELDER = { tunic: '#5d4a38', skin: '#ecd0b6', hair: '#e8e2d4', beard: '#e8e2d4', brows: '#e8e2d4', stout: true };
const KID = { tunic: '#b8524a', skin: '#f5c9a0', hair: '#3b2a20' };
const R = (T, who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'obj') + JSON.stringify(o) + JSON.stringify(who), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RM = (T, o, pos, extra = {}) => ({ key: 'musher' + JSON.stringify(o), draw: (p) => T.musherFront(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RD = (T, o, pos, extra = {}) => ({ key: 'balto' + JSON.stringify(o), draw: (p) => T.baltoCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { night: '#c3d2ff', nightlow: '#aebfff', grey: '#c9d4ea', dawn: '#ffe9c4', day: '#ffffff' };
const tintFor = (S, f) => S.id === 'arrival' ? (f < 1110 ? TINT.night : TINT.dawn) : (TINT[S.light] || '#ffffff');

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S, f);
  switch (S.id) {
    case 'hook': {
      out.push(R(T, DOCTOR, { seed: 41, expr: 'nervous', L: 'belly', R: 'hang', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3),
        headTilt: q(kf([[0, 2], [70, -4], [110, -2], [159, 3]], f), 1), tilt: 1 },
        [...DOOR], { tint, s: 1.0 }));
      out.push(R(T, 'civB', { seed: 14, expr: 'nervous', L: 'belly', R: 'belly', blink: blinkAt(f, 14), bob: q(breath(f, 14), 3), headTilt: 4 },
        [-3.2, 0, -4.7], { tint, s: 0.94 }));
      break;
    }
    case 'serum': {
      // the doctor holds up the last bottle — empty. The elder shakes his head.
      out.push(R(T, DOCTOR, { seed: 41, expr: 'nervous', L: 'hang', R: 'reach', lift: 0.32, blink: blinkAt(f, 21), bob: q(breath(f, 21), 3),
        headTilt: q(kf([[160, 3], [230, -3], [300, 2], [327, 2]], f), 1), tilt: 1 },
        [...DOOR], { tint, s: 1.0 }));
      out.push(R(T, ELDER, { seed: 8, expr: 'stern', L: 'hang', R: 'hang', blink: blinkAt(f, 8), bob: q(breath(f, 8), 3),
        headTilt: q(kf([[160, 2], [215, -6], [245, 5], [275, -5], [305, 3], [327, 2]], f), 1) },
        [-5.75, 0, -4.5], { tint, s: 0.97 }));
      break;
    }
    case 'map': {
      out.push(R(T, DOCTOR, { seed: 41, expr: 'stern', L: 'hang', R: 'point', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), headTilt: -2 },
        [10.7, 0, 0.9], { tint, s: 1.0, yaw: -0.55 }));
      out.push(R(T, ELDER, { seed: 8, expr: 'nervous', L: 'belly', R: 'belly', blink: blinkAt(f, 8), bob: q(breath(f, 8), 3), headTilt: 3 },
        [10.35, 0, 1.9], { tint, s: 0.97, yaw: -0.4 }));
      break;
    }
    case 'relay': break; // drone: the 20 teams are 3D props (relayLayout)
    case 'intro': {
      const pant = f > 700 ? 1 : 0;
      out.push(RD(T, { view: 'front', pant }, [BALTO_FRONT[0], breath(f, 3) * 0.5, BALTO_FRONT[2]],
        { tint, s: 0.8, roll: kf([[607, 0], [660, -0.018], [745, 0]], f) }));
      out.push(RD(T, { furC: '#4a4d55' }, [1.5, 0, 7.9], { tint, s: 0.58, yaw: 0.5 }));
      out.push(RD(T, { furC: '#33261e', markC: '#d8cfc0' }, [2.55, 0, 8.9], { tint, s: 0.58, yaw: -0.4 }));
      out.push(RM(T, { expr: 'stern', L: 'hang', R: 'hang', blink: blinkAt(f, 5), bob: q(breath(f, 5), 3) },
        [2.55, 0.14, TEAM_Z.musher], { tint, s: 0.98, ground: 0.14 }));
      break;
    }
    case 'storm': {
      const ph = q((f * 0.055) % 1, 2), bobY = Math.abs(Math.sin(f * 0.55)) * 0.03;
      out.push(RD(T, { step: ph, headDown: 0.15, pant: 1 }, [2.1, bobY, TEAM_Z.balto], { tint, s: 0.66 }));
      out.push(RD(T, { furC: '#4a4d55', step: q((f * 0.055 + 0.33) % 1, 2) }, [1.65, bobY * 0.8, TEAM_Z.dog2], { tint, s: 0.58, yaw: 0.15 }));
      out.push(RD(T, { furC: '#33261e', markC: '#d8cfc0', step: q((f * 0.055 + 0.66) % 1, 2) }, [2.5, bobY * 0.8, TEAM_Z.dog3], { tint, s: 0.58, yaw: -0.15 }));
      out.push(RM(T, { expr: 'stern', L: 'hold', R: 'hold', frost: q(ramp(f, 790, 855), 2), blink: 1, bob: q(breath(f, 5), 3), headTilt: 3 },
        [2.55, 0.14, TEAM_Z.musher], { tint, s: 0.98, ground: 0.14 }));
      break;
    }
    case 'scent': {
      const ph = q((f * 0.038) % 1, 2), bobY = Math.abs(Math.sin(f * 0.4)) * 0.02;
      const hd = f < 990 ? lerp(0.15, 0.85, smooth(ramp(f, 925, 990))) : lerp(0.85, 0.6, ramp(f, 990, 1044));
      out.push(RD(T, { step: ph, headDown: q(hd, 2), pant: 1 }, [2.1, bobY, TEAM_Z.balto], { tint, s: 0.66 }));
      out.push(RD(T, { furC: '#4a4d55', step: q((f * 0.038 + 0.33) % 1, 2) }, [1.65, bobY * 0.8, TEAM_Z.dog2], { tint, s: 0.58, yaw: 0.15 }));
      out.push(RD(T, { furC: '#33261e', markC: '#d8cfc0', step: q((f * 0.038 + 0.66) % 1, 2) }, [2.5, bobY * 0.8, TEAM_Z.dog3], { tint, s: 0.58, yaw: -0.15 }));
      out.push(RM(T, { expr: 'stern', L: 'hold', R: 'hold', frost: 1, blink: 1, bob: q(breath(f, 5), 3), headTilt: 3 },
        [2.55, 0.14, TEAM_Z.musher], { tint, s: 0.98, ground: 0.14 }));
      break;
    }
    case 'arrival': {
      out.push(RD(T, { view: 'front', pant: 1 }, [1.2, breath(f, 3) * 0.5, 1.2], { tint, s: 0.85 }));
      out.push(RD(T, { furC: '#4a4d55', pant: 1 }, [0.2, 0, 3.4], { tint, s: 0.56, yaw: 0.7 }));
      out.push(RM(T, { expr: 'relief', L: 'hold', R: 'hold', carryBox: true, blink: blinkAt(f, 5), bob: q(breath(f, 5), 3) },
        [1.7, 0, 1.6], { tint, s: 0.98 }));
      // the doctor hurries in from the hospital side to take the serum
      const dp = kf3([[1045, [-3.9, 0, -3.6]], [1130, [-0.5, 0, 0.6], 'easeInOut'], [1203, [-0.5, 0, 0.6]]], f);
      const walking = f >= 1045 && f < 1130;
      out.push(R(T, DOCTOR, { seed: 41, expr: f >= 1120 ? 'grin' : 'stern', L: 'hang', R: f >= 1130 ? 'reach' : 'hang', lift: 0.2,
        blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), step: q(walking ? kf([[1045, 0], [1130, 4.6]], f) : 0) },
        dp, { tint, s: 1.0, yaw: 0.5 }));
      // the town pours out, waving
      out.push(R(T, 'civB', { seed: 14, expr: 'laugh', L: 'wave', R: 'belly', wv: q(f * 0.3, 1), blink: 0, bob: q(breath(f, 14), 3), headTilt: -3 },
        [-2.0, 0, -0.8], { tint, s: 0.94 }));
      out.push(R(T, 'civA', { seed: 17, expr: 'grin', L: 'up', R: 'up', blink: blinkAt(f, 17), bob: q(breath(f, 17), 3) },
        [-2.6, 0, 0.9], { tint, s: 0.97 }));
      out.push(R(T, 'civC', { seed: 19, expr: 'laugh', L: 'belly', R: 'wave', wv: q(f * 0.26 + 2, 1), blink: 0, bob: q(breath(f, 19), 3), headTilt: 3 },
        [4.1, 0, -0.5], { tint, s: 0.97 }));
      out.push(R(T, KID, { seed: 23, expr: 'grin', L: 'up', R: 'wave', wv: q(f * 0.45, 1), blink: blinkAt(f, 23), bob: q(Math.abs(Math.sin(f * 0.3)) * 0.012, 3) },
        [2.9, 0, 0.6], { tint, s: 0.62 }));
      break;
    }
    case 'statue': {
      out.push(RD(T, { view: 'front', statue: 1 }, [-11, 0.97, 6], { tint, s: 1.02, ground: 0.99, blob: true }));
      out.push(R(T, KID, { seed: 23, expr: 'grin', L: 'hang', R: 'point', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3), headTilt: -3 },
        [-10.4, 0, 8.3], { tint, s: 0.62 }));
      out.push(R(T, 'civB', { seed: 14, expr: 'smile', L: 'belly', R: 'belly', blink: blinkAt(f, 14), bob: q(breath(f, 14), 3), headTilt: 2 },
        [-11.7, 0, 8.7], { tint, s: 0.95 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' || S.id === 'serum') {
    // Zzz over the hospital: the sick children sleep inside
    const t = q(((f / 46) + 0.37) % 1, 2);
    out.push(FXC('zh_' + t, (p) => T.fxZ(p, t), [-5.9, 1.85, -5.6], 0.4));
  }
  if (S.id === 'arrival' && f >= 1057 && f <= 1085) {
    const t = q((f - 1057) / 28, 2);
    out.push(FXC('burst_' + t, (p) => T.fxBurst(p, t, '#ffe9a8', 10, 30, 210), [1.2, 1.1, 0.9], 0.85));
  }
  return out;
};
