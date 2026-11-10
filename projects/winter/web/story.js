// Shot plan for "Winter — The Dolphin Who Got a New Tail" — timed to winter-voice
// (59.775 s, 30 fps, TOTAL 1793). True story: Clearwater Marine Aquarium, 2005-2011.
// Phrases: P1 0-148 hook | P2 167-341 rescue | P3 360-538 aquarium | P4 559-676 fish-swim |
// P5 696-783 warning | P6 812-972 question | P7 994-1129 fitting | P8 1148-1265 wobbly |
// P9 1283-1405 breakthrough | P10 1426-1583 gel | P11 1583-1772 finale (+tail to 1792).
// Sections are CONTIGUOUS (pauses belong to the neighbouring section) and cover 0->1792.
// World layout: SEA set centred z=-50 (surface y=0, Winter baby at (0,-1.6,-50), boat NW).
// POOL set centred z=0: water x[-5,5] z[-11,11], surface y=0, floor y=-3, deck top y=0.30.
// Workshop bench + drawing board on the east deck at (6.1,*,-8). Fitting edge at (3.55,-0.28,-6).
// CLINIC set centred z=38 (floor y=0). Poster boards on the pool deck for the finale.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';
import * as P2 from './painters2.js';

export const FPS = 30, TOTAL = 1793, DECK = 0.3;
export const FIT_FRAME = 1062;                    // prosthetic first appears (inside P7, "fitted her with...")
export const SLIP_A = 1196, SLIP_B = 1252;        // fluke detached window (inside wobbly)
export const SHOTS = [
  { id: 'hook', a: 0, b: 166, light: 'seaDawn' },
  { id: 'rescue', a: 167, b: 359, light: 'seaDawn' },
  { id: 'aquarium', a: 360, b: 558, light: 'pool' },
  { id: 'fish', a: 559, b: 695, light: 'pool' },
  { id: 'warning', a: 696, b: 811, light: 'pool' },
  { id: 'question', a: 812, b: 993, light: 'workshop' },
  { id: 'fitting', a: 994, b: 1147, light: 'workshop' },
  { id: 'wobbly', a: 1148, b: 1282, light: 'pool' },
  { id: 'breakthrough', a: 1283, b: 1425, light: 'pool' },
  { id: 'gel', a: 1426, b: 1582, light: 'clinic' },
  { id: 'finale', a: 1583, b: 1792, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const BASE = { sunDisc: '#fff3cf', sunSize: 0.003, aurora: 0 };
export const LIGHTS = {
  seaDawn: { az: 118, el: 20, sky: '#7fb2d9', ground: '#1d3a4a', hemi: 0.95, sun: '#ffd9a8', sunI: 1.9, fog: '#39657f', fogNear: 16, fogFar: 170,
    skyTop: '#2c5a80', skyHor: '#a8c8dc', sat: 1.05, vig: 0.27, shadowExt: 22, gain: '#fff1dc', waterDeep: '#14425e', waterShal: '#2e7ea6', glint: '#ffe9c0', ...BASE },
  seaDeep: { az: 118, el: 26, sky: '#4a7ea6', ground: '#12242e', hemi: 0.8, sun: '#cfe4ff', sunI: 1.5, fog: '#26506a', fogNear: 10, fogFar: 120,
    skyTop: '#173c58', skyHor: '#5d8cae', sat: 1.03, vig: 0.32, shadowExt: 22, waterDeep: '#0f3650', waterShal: '#256d8f', glint: '#d8ecff', ...BASE },
  seaMorning: { az: 122, el: 30, sky: '#a8d2ec', ground: '#2c4a56', hemi: 1.1, sun: '#ffe9bc', sunI: 2.0, fog: '#7fa8bc', fogNear: 26, fogFar: 240,
    skyTop: '#4a86bc', skyHor: '#dff0f8', sat: 1.05, vig: 0.22, shadowExt: 24, gain: '#fff4e0', waterDeep: '#185a74', waterShal: '#3596b4', glint: '#ffedbe', ...BASE },
  pool: { az: 130, el: 42, sky: '#bfe3f2', ground: '#3a6a7c', hemi: 1.15, sun: '#fff3da', sunI: 2.1, fog: '#a8c8d4', fogNear: 30, fogFar: 210,
    skyTop: '#5f97cc', skyHor: '#dff2f8', sat: 1.04, vig: 0.2, shadowExt: 18, waterDeep: '#1a5a74', waterShal: '#2f96b4', glint: '#ffffff', ...BASE },
  poolCool: { az: 150, el: 34, sky: '#9fb8c8', ground: '#2e4a56', hemi: 0.95, sun: '#dfe8f2', sunI: 1.5, fog: '#8aa4b4', fogNear: 22, fogFar: 170,
    skyTop: '#466a86', skyHor: '#c3d4de', sat: 0.96, vig: 0.3, shadowExt: 18, waterDeep: '#174a5e', waterShal: '#2a7a96', glint: '#e8f2ff', ...BASE },
  workshop: { az: 105, el: 30, sky: '#ffd9a8', ground: '#4a5a52', hemi: 1.1, sun: '#ffc37e', sunI: 2.2, fog: '#d9c8a8', fogNear: 30, fogFar: 220,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sat: 1.06, vig: 0.23, shadowExt: 18, gain: '#ffedd6', waterDeep: '#1d5f74', waterShal: '#35a0ba', glint: '#ffe9c0', ...BASE },
  clinic: { az: 90, el: 38, sky: '#f2ddba', ground: '#6a5a44', hemi: 1.2, sun: '#ffca7a', sunI: 1.9, fog: '#e8d3ae', fogNear: 20, fogFar: 130,
    skyTop: '#c9a86a', skyHor: '#f7e8cc', sat: 1.05, vig: 0.24, shadowExt: 16, gain: '#fff0d0', waterDeep: '#1a5a74', waterShal: '#2f96b4', glint: '#ffffff', ...BASE },
  golden: { az: 96, el: 15, sky: '#ffc98a', ground: '#4a5a5a', hemi: 1.05, sun: '#ffb45e', sunI: 2.35, fog: '#e8b98a', fogNear: 30, fogFar: 230,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sat: 1.07, vig: 0.24, shadowExt: 18, gain: '#ffedd6', waterDeep: '#1d5f74', waterShal: '#35a0ba', glint: '#ffd9a0', ...BASE },
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
  switch (S.id) {
    case 'hook': return blendLight(LIGHTS.seaDeep, LIGHTS.seaDawn, 0.45);
    case 'rescue': return blendLight(LIGHTS.seaDawn, LIGHTS.seaMorning, smooth(ramp(f, 200, 345)));
    case 'warning': return blendLight(LIGHTS.pool, LIGHTS.poolCool, smooth(ramp(f, 700, 765)));
    case 'question': case 'fitting': return blendLight(LIGHTS.pool, LIGHTS.workshop, 0.8);
    case 'wobbly': { const t = Math.sin(Math.PI * ramp(f, 1148, 1282)); return blendLight(LIGHTS.pool, LIGHTS.workshop, 0.55 * t); }
    case 'breakthrough': return blendLight(LIGHTS.pool, LIGHTS.golden, 0.3 * ramp(f, 1283, 1425));
    default: return { ...LIGHTS[S.light] };
  }
};

// ---------- Winter herself (pure): position / heading / tail state ----------
export const winterAt = (f) => {
  const S = shotAt(f);
  const W = { pos: [0, -0.8, 0], yaw: 0, pitch: 0, tailMode: 'none', swimK: 0.3, scale: 1, detached: false, flukePos: null, flukeSpin: 0, visible: true };
  switch (S.id) {
    case 'hook':
      W.pos = kf3([[0, [0.7, -1.75, -48.4]], [80, [0, -1.55, -50.0]], [166, [0.3, -1.7, -50.4]]], f);
      W.yaw = 1.25 + Math.sin(f * 0.05) * 0.07; W.swimK = 0.22; W.scale = 0.45; break;
    case 'rescue':
      W.pos = kf3([[167, [0.3, -1.6, -50.4]], [230, [0.2, -0.9, -50.7]], [300, [0, 0.12, -51.1]], [359, [0, 0.14, -51.3]]], f); // lifted HALF OUT of the water in the sling (real rescue posture — and visible above the opaque surface)
      W.yaw = 1.1 + Math.sin(f * 0.04) * 0.05; W.swimK = 0.35; W.scale = 0.45; break;
    case 'aquarium': {
      const u = ramp(f, 360, 558), ang = 0.6 + u * Math.PI * 1.6, r = 3.4;
      W.pos = [Math.sin(ang) * r, -0.85 + 0.13 * Math.sin(f * 0.05), -1 + Math.cos(ang) * r * 0.9];
      W.yaw = Math.atan2(Math.cos(ang), -0.9 * Math.sin(ang)); W.swimK = 0.3; break;
    }
    case 'fish': {
      const u = ramp(f, 559, 695), e = M.surge(u); // starts where the aquarium circle ended (z~1.4) — no subject teleport
      W.pos = [Math.sin(u * Math.PI * 4) * 1.1, -0.8 + 0.06 * Math.sin(f * 0.09), lerp(1.2, 9.2, e)];
      W.yaw = Math.atan2(1.1 * 4 * Math.PI * Math.cos(u * Math.PI * 4) / 8, 1) * 0.55; W.swimK = 0.85; break;
    }
    case 'warning':
      W.pos = kf3([[696, [0.5, -0.5, -1.0]], [760, [0.1, -0.35, -2.0]], [811, [-0.2, -0.4, -2.4]]], f);
      W.yaw = 1.85; W.swimK = 0.12; break;
    case 'question': {
      const ang = f * 0.008, r = 1.8;
      W.pos = [-1.5 + Math.sin(ang) * r, -0.9, 3.5 + Math.cos(ang) * r * 0.8];
      W.yaw = Math.atan2(Math.cos(ang), -0.8 * Math.sin(ang)); W.swimK = 0.25; break;
    }
    case 'fitting':
      W.pos = [3.55, -0.28 + 0.05 * Math.sin(f * 0.06), -6];
      W.yaw = 1.35; W.swimK = 0.15; W.tailMode = f >= FIT_FRAME ? 'prosthetic' : 'none'; break;
    case 'wobbly':
      W.tailMode = 'prosthetic';
      if (f <= SLIP_B) {
        const u = ramp(f, 1148, 1252), e = M.easeInOut(u);
        W.pos = [lerp(0, 1.5, u) + Math.sin(u * 9) * 0.2, -0.55, lerp(-7.5, 4.5, e)];
        W.yaw = 0.15 * Math.sin(u * 9); W.swimK = f >= SLIP_A ? 0.3 : 0.55;
        if (f >= SLIP_A) {
          W.detached = true;
          W.flukePos = kf3([[SLIP_A, [1.05, -0.65, 0.4]], [SLIP_B, [1.3, -2.55, 1.3]]], f);
          W.flukeSpin = ramp(f, SLIP_A, SLIP_B) * 2.4;
        }
      } else {
        W.pos = kf3([[1253, [1.5, -0.5, 4.5]], [1282, [3.55, -0.3, -6.0]]], f);
        W.yaw = lerp(0.15, 1.35, ramp(f, 1253, 1282)); W.swimK = 0.2;
      }
      break;
    case 'breakthrough': {
      const u = ramp(f, 1299, 1425), e = M.surge(u); // holds at the wall 1283-1299 while the bridge camera travels to her
      W.pos = [Math.sin(u * Math.PI * 2) * 0.4, -0.95 + Math.sin(u * Math.PI) * 0.8, lerp(-10.3, 9.8, e)];
      W.yaw = 0.06 * Math.sin(u * 9); W.pitch = -0.1 + 0.08 * Math.sin(u * 12); W.swimK = 0.55 + 0.45 * Math.sin(u * Math.PI); W.tailMode = 'prosthetic'; break;
    }
    case 'gel':
      W.pos = [0, -0.8, 2]; W.yaw = 0; W.swimK = 0.1; W.tailMode = 'prosthetic'; W.visible = false; break;
    case 'finale': {
      W.tailMode = 'prosthetic';
      if (f < 1701) {
        const u = ramp(f, 1583, 1700), ang = -0.5 + u * 3.1, r = 3.2;
        W.pos = [Math.sin(ang) * r, -0.7 + 0.1 * Math.sin(f * 0.05), 0.5 + Math.cos(ang) * r * 0.85];
        W.yaw = Math.atan2(Math.cos(ang), -0.85 * Math.sin(ang)); W.swimK = 0.7;
      } else {
        W.pos = kf3([[1701, [1.65, -0.7, -1.83]], [1740, [0.8, -0.6, 1.8]], [1792, [0, -0.55, 2.6]]], f);
        W.yaw = lerp(-2.04, 0, smooth(ramp(f, 1701, 1772))); W.swimK = lerp(0.7, 0.32, ramp(f, 1701, 1792)); // yaw 0 = facing +z = toward the settle camera
      }
      break;
    }
  }
  return W;
};

// ---------- rescue boat ----------
export const boatAt = (f) => {
  const pos = kf3([[0, [-16, 0, -64]], [167, [-15, 0, -63]], [260, [-7.5, 0, -56]], [330, [-4.2, 0, -52.6]], [359, [-4.0, 0, -52.4]], [1792, [-4.0, 0, -52.4]]], f);
  const yaw = kf([[0, 0.7], [167, 0.7], [300, 1.2], [359, 1.3], [1792, 1.3]], f);
  const speed = kf([[0, 0], [167, 1], [260, 1], [320, 0.15], [359, 0.05], [1792, 0.05]], f);
  return { pos, yaw, speed };
};

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [5.5, -0.6, -41.5], look: [0.5, -1.6, -49.3], fov: 45 },
    { f: 90, pos: [3.4, -0.9, -44.3], look: [0.15, -1.6, -50], fov: 41, ease: 'surge' },
    { f: 166, pos: [2.3, -1.0, -46.6], look: [0.25, -1.65, -50.35], fov: 38 },
  ],
  rescue: [
    { f: 167, pos: [2.3, -0.8, -46.6], look: [0.25, -1.5, -50.35], fov: 39 },
    { f: 225, pos: [2.2, 1.5, -45.2], look: [0.1, -0.6, -50.9], fov: 42, ease: 'surge' },
    { f: 285, pos: [-2.6, 7.2, -37.5], look: [-2.2, -0.3, -52.7], fov: 50 },
    { f: 330, pos: [-0.5, 1.9, -43.8], look: [0.5, 0.2, -52.4], fov: 42, ease: 'surge' },
    { f: 359, pos: [-0.7, 1.75, -44.2], look: [0.5, 0.22, -52.5], fov: 41 },
  ],
  warning: [
    { f: 696, pos: [1.6, 0.75, -6.4], look: [5.7, 1.75, -3.2], fov: 40 },
    { f: 748, pos: [3.3, 1.15, -4.9], look: [5.7, 1.8, -3.2], fov: 35, ease: 'surge' },
    { f: 782, pos: [2.3, 0.25, -6.6], look: [0.35, -0.35, -2.5], fov: 37 },
    { f: 811, pos: [2.45, 0.28, -6.5], look: [0.45, -0.35, -2.55], fov: 37 },
  ],
  question: [
    { f: 812, pos: [0.4, 1.0, -2.6], look: [5.0, 1.35, -7.8], fov: 43 },
    { f: 900, pos: [1.4, 1.1, -4.4], look: [5.6, 1.4, -8], fov: 39, ease: 'surge' },
    { f: 993, pos: [2.2, 1.2, -5.4], look: [6.4, 1.6, -7.3], fov: 36 },
  ],
  fitting: [
    { f: 994, pos: [-0.6, 1.1, -12.6], look: [3.4, -0.1, -6.2], fov: 43 },
    { f: 1062, pos: [-0.2, 1.05, -12.2], look: [3.9, 0, -6.4], fov: 41, ease: 'surge' },
    { f: 1147, pos: [0.2, 0.95, -11.8], look: [4.0, 0, -6.5], fov: 40 },
  ],
  wobbly: [ // look keys sit ON Winter's eased lap positions at their key times (1148/1200/1252 = her u 0/0.5/1)
    { f: 1148, pos: [-1.8, 0.7, -12.8], look: [0, -0.5, -7.5], fov: 43 },
    { f: 1200, pos: [-3.3, 0.62, -9.3], look: [1.31, -0.5, -1.5], fov: 41, ease: 'easeIn' },
    { f: 1252, pos: [-3.5, 0.6, -5.6], look: [0.2, -0.5, 4.4], fov: 40, ease: 'easeOut' },
    { f: 1267, pos: [-2.2, 0.6, -6.4], look: [2.2, -0.4, -1.5], fov: 39, ease: 'lin' },
    { f: 1282, pos: [0.9, 0.55, -9.0], look: [3.55, -0.25, -6], fov: 38, ease: 'lin' },
  ],
  gel: [ // each beat CENTRES its subject: gel hero -> child steps -> veteran -> wide settle
    { f: 1426, pos: [0.4, 1.3, 31.0], look: [-2.1, 0.9, 37.8], fov: 40 },
    { f: 1470, pos: [-0.9, 1.15, 33.0], look: [-2.0, 0.9, 37.7], fov: 37, ease: 'surge' },
    { f: 1510, pos: [0.1, 1.1, 33.4], look: [-0.9, 0.55, 37.4], fov: 38, ease: 'surge' },
    { f: 1545, pos: [0.5, 1.1, 34.2], look: [1.7, 0.7, 38.8], fov: 38, ease: 'surge' },
    { f: 1582, pos: [0.4, 1.3, 31.6], look: [0.3, 0.6, 38.2], fov: 45 },
  ],
  finale: [ // keyed opening HOLDS the poster (west deck), pans 1626-1656, hands over to the orbit dynCam at f1656 (key == orbit values there)
    { f: 1583, pos: [0.8, 1.6, 13.8], look: [-5.9, 1.0, 8.9], fov: 42 },
    { f: 1626, pos: [0.2, 1.65, 13.6], look: [-5.9, 1.0, 8.9], fov: 42 },
    { f: 1656, pos: [-2.39, 1.9, 12.37], look: [3.17, -0.5, 0.87], fov: 41, ease: 'lin' },
  ],
};
const dynCam = (id, f) => {
  const w = winterAt(f);
  switch (id) {
    case 'aquarium': { const a = f * 0.004 + 1; return { pos: [clamp(w.pos[0] + Math.sin(a) * 5.6, -5.0, 5.0), w.pos[1] + 1.15, clamp(w.pos[2] + Math.cos(a) * 5.6, -10.8, 10.8)], look: [w.pos[0], w.pos[1] + 0.1, w.pos[2]], fov: 44, roll: 0 }; }
    case 'fish': return { pos: [Math.max(w.pos[0] - 4.4, -5.0), w.pos[1] + 0.55, w.pos[2] + 2.8], look: [w.pos[0] + Math.sin(w.yaw || 0) * 0.35, w.pos[1] + 0.05, w.pos[2] + Math.cos(w.yaw || 0) * 0.35], fov: 43, roll: 0 };
    case 'breakthrough': return { pos: [Math.min(w.pos[0] + 4.6, 4.95), w.pos[1] + 0.9, Math.max(w.pos[2] - 2.4, -10.8)], look: [w.pos[0], w.pos[1] + 0.1, w.pos[2] + 0.3], fov: 42, roll: 0 };
    case 'finale': {
      if (f < 1656) return camFromKeys(CAMS.finale, f);
      if (f < 1701) return { pos: [w.pos[0] * 0.35 - 3.5, 1.9, w.pos[2] + 11.5], look: [w.pos[0], -0.5, w.pos[2]], fov: 41, roll: 0 };
      const d0 = dynCam('finale', 1700);
      return camFromKeys([{ f: 1701, ...d0 }, { f: 1772, pos: [0.4, 1.55, 15.2], look: [0.5, -0.3, 3.0], fov: 44, ease: 'surge' }], f); // settle ARRIVES by voice-end 1772, then holds
    }
    default: return camFromKeys(CAMS[id], f);
  }
};
export const BRIDGES = { rescue: 20, fish: 34, question: 40, fitting: 40, wobbly: 36, breakthrough: 20 };
export const DIPS = [360, 696, 1426, 1583]; // set changes + the vet cut enter through dip-to-black (balto doctrine)
const SHADOW_AT = { hook: [0, -1, -50], rescue: [0, 0, -51], aquarium: [0, 0, 0], fish: [0, 0, 0], warning: [3, 0, -3], question: [5, 0, -8], fitting: [3.5, 0, -6], wobbly: [0, 0, 0], breakthrough: [0, 0, 0], gel: [0, 0, 38], finale: [0, 0, 2] };
export const camAt = (f) => {
  const S = shotAt(f);
  let c = dynCam(S.id, f);
  const bd = BRIDGES[S.id];
  if (bd && f - S.a < bd) {
    const P = SHOTS[SHOTS.indexOf(S) - 1];
    const pc = dynCam(P.id, P.b);
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
  const S = shotAt(f), C = camAt(f), w = winterAt(f);
  let point = w.pos, cinf = 7;
  switch (S.id) {
    case 'hook': cinf = 8; break;
    case 'rescue': cinf = 5; break;
    case 'warning': point = f < 765 ? [5.7, 1.8, -3.2] : w.pos; cinf = 9; break;
    case 'question': point = [5.9, 1.4, -8]; cinf = 6; break;
    case 'gel': point = [0, 1, 38.2]; cinf = 7; break;
    case 'breakthrough': cinf = 6; break;
    case 'finale': if (f < 1656) point = [-6.9, 1.0, 8.8]; cinf = 6; break;
    default: break;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, bubbleK: 0.4, spineGlow: 0, slingK: 0, posterK: 0, finalBoardK: 0, gelGlint: 0 };
  switch (S.id) {
    case 'hook': W.bubbleK = 0.9; break;
    case 'rescue': W.bubbleK = 0.5; W.slingK = smooth(ramp(f, 285, 320)); break;
    case 'aquarium': W.bubbleK = 0.5; break;
    case 'fish': W.bubbleK = 0.85; break;
    case 'warning': W.bubbleK = 0.3; W.spineGlow = Math.sin(Math.PI * ramp(f, 696, 811)); break;
    case 'question': W.bubbleK = 0.3; break;
    case 'fitting': W.bubbleK = 0.5; break;
    case 'wobbly': W.bubbleK = 0.6; break;
    case 'breakthrough': W.bubbleK = 0.9; break;
    case 'gel': W.bubbleK = 0; W.gelGlint = 0.6 + 0.4 * Math.sin(f * 0.11); break;
    case 'finale': W.bubbleK = 0.5; W.posterK = 1; W.finalBoardK = smooth(ramp(f, 1640, 1700)); break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const W = worldAt(f);
  return { bubbleRate: W.bubbleK * 20, splashRate: 0, spineGlow: W.spineGlow };
};

// ---------- actors (2D cards) ----------
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
const A = (fn, o, pos, extra = {}) => ({ key: fn.name + JSON.stringify(o) + JSON.stringify(pos), draw: (p) => fn(p, o), x: pos[0], y: pos[1], z: pos[2], ground: extra.ground ?? pos[1], ...extra });
const TINT = { sea: '#d6e8ff', pool: '#ffffff', warm: '#ffedcb' };
const rot2 = (lx, lz, yaw) => [lx * Math.cos(yaw) + lz * Math.sin(yaw), -lx * Math.sin(yaw) + lz * Math.cos(yaw)];

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  switch (S.id) {
    case 'hook': break;
    case 'rescue': {
      const b = boatAt(f), tint = TINT.sea;
      const p1 = rot2(0.55, 0.5, b.yaw), p2 = rot2(-0.55, -0.6, b.yaw);
      out.push(A(P2.rescuerFront, { seed: 31, expr: f > 300 ? 'relief' : 'nervous', L: 'hang', R: f > 280 ? 'reach' : 'point', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3), tilt: f > 270 ? 5 : 1, headTilt: -2 },
        [b.pos[0] + p1[0], 0.62, b.pos[2] + p1[1]], { tint, s: 1.0, ground: 0.62 }));
      out.push(A(P2.rescuerFront, { seed: 17, alt: true, expr: 'stern', L: 'belly', R: 'hang', blink: blinkAt(f, 17), bob: q(breath(f, 17), 3), headTilt: 3 },
        [b.pos[0] + p2[0], 0.62, b.pos[2] + p2[1]], { tint, s: 0.97, ground: 0.62 }));
      break;
    }
    case 'aquarium': {
      const tint = TINT.pool;
      out.push(A(P2.keeperFront, { seed: 12, expr: 'smile', L: 'belly', R: 'hang', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: 2 }, [5.9, DECK, -2.5], { tint, s: 1.0 }));
      out.push(A(P2.vetFront, { seed: 41, expr: 'neutral', L: 'hip', R: 'hang', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3), headTilt: -2 }, [5.9, DECK, 1.8], { tint, s: 1.0 }));
      break;
    }
    case 'fish': {
      const z = lerp(0, 8.5, ramp(f, 559, 695));
      out.push(A(P2.keeperFront, { seed: 12, expr: 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), step: q((f * 0.045) % 1, 2) }, [5.9, DECK, z], { tint: TINT.pool, s: 1.0 }));
      break;
    }
    case 'warning': {
      const tint = TINT.pool;
      out.push(A(P2.vetFront, { seed: 41, expr: f < 740 ? 'pained' : 'stern', L: 'hang', R: 'hang', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3),
        headTilt: q(kf([[696, 0], [715, -5], [730, 4], [745, -4], [760, 0], [811, 0]], f), 1) }, [5.7, DECK, -3.2], { tint, s: 1.02 }));
      out.push(A(P2.keeperFront, { seed: 12, expr: 'nervous', L: 'belly', R: 'belly', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: 3 }, [5.9, DECK, 0.6], { tint, s: 0.97 }));
      break;
    }
    case 'question': {
      const tint = TINT.warm;
      out.push(A(P2.kevinFront, { seed: 27, expr: f > 925 ? 'grin' : 'stern', L: 'hang', R: 'point', blink: blinkAt(f, 27), bob: q(breath(f, 27), 3), headTilt: -2 }, [4.85, DECK, -8.7], { tint, s: 1.0, yaw: 0.35 }));
      break;
    }
    case 'fitting': {
      const tint = TINT.warm;
      out.push(A(P2.keeperFront, { seed: 12, expr: f > 1080 ? 'relief' : 'stern', L: 'reach', R: 'reach', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), tilt: 5, headTilt: 2 }, [5.55, DECK, -7.4], { tint, s: 1.0 }));
      out.push(A(P2.keeperFront, { seed: 19, alt: true, expr: 'nervous', L: 'belly', R: 'reach', blink: blinkAt(f, 19), bob: q(breath(f, 19), 3), tilt: 4 }, [5.55, DECK, -4.7], { tint, s: 0.97 }));
      out.push(A(P2.vetFront, { seed: 41, expr: 'smile', L: 'hip', R: 'hang', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3) }, [5.9, DECK, -9.6], { tint, s: 1.0 }));
      break;
    }
    case 'wobbly': {
      const tint = TINT.pool, w = winterAt(f);
      if (f <= 1252) {
        out.push(A(P2.keeperFront, { seed: 12, expr: f >= SLIP_A ? 'shock' : 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), step: q((f * 0.045) % 1, 2) }, [5.9, DECK, clamp(w.pos[2], -7, 5)], { tint, s: 1.0 }));
      } else {
        out.push(A(P2.keeperFront, { seed: 12, expr: 'relief', L: 'reach', R: 'reach', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), tilt: 5 }, [5.55, DECK, -7.4], { tint, s: 1.0 }));
        out.push(A(P2.keeperFront, { seed: 19, alt: true, expr: 'grin', L: 'belly', R: 'reach', blink: blinkAt(f, 19), bob: q(breath(f, 19), 3), tilt: 4 }, [5.55, DECK, -4.7], { tint, s: 0.97 }));
      }
      break;
    }
    case 'breakthrough': {
      const tint = TINT.pool, w = winterAt(f);
      if (f < 1360) {
        out.push(A(P2.keeperFront, { seed: 12, expr: 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), step: q((f * 0.05) % 1, 2) }, [5.9, DECK, clamp(w.pos[2] - 1, -8, 8)], { tint, s: 1.0 }));
      } else {
        out.push(A(P2.keeperFront, { seed: 12, expr: 'laugh', L: 'up', R: 'wave', wv: q(f * 0.3, 1), blink: 0, bob: q(breath(f, 12), 3), headTilt: -3 }, [5.9, DECK, 7.6], { tint, s: 1.0 }));
        out.push(A(P2.vetFront, { seed: 41, expr: 'grin', L: 'up', R: 'up', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3) }, [5.9, DECK, 9.4], { tint, s: 1.0 }));
      }
      break;
    }
    case 'gel': {
      const tint = TINT.warm;
      out.push(A(P2.childFront, { seed: 23, expr: 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3), step: q((f * 0.035) % 1, 2) }, [-0.9, 0, 37.4], { tint, s: 0.62, ground: 0 }));
      out.push(A(P2.veteranFront, { seed: 8, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 8), bob: q(breath(f, 8), 3), step: q(((f + 9) * 0.03) % 1, 2) }, [1.7, 0, 38.8], { tint, s: 1.0, ground: 0 }));
      break;
    }
    case 'finale': {
      const tint = TINT.warm;
      out.push(A(P2.childFront, { seed: 23, expr: 'laugh', L: 'up', R: 'wave', wv: q(f * 0.3, 1), blink: 0, bob: q(Math.abs(Math.sin(f * 0.3)) * 0.012, 3) }, [-5.3, DECK, 7.9], { tint, s: 0.62 }));
      out.push(A(P2.childFront, { seed: 29, alt: true, expr: 'grin', L: 'wave', R: 'up', wv: q(f * 0.26 + 2, 1), blink: blinkAt(f, 29), bob: q(breath(f, 29), 3) }, [-5.5, DECK, 10.3], { tint, s: 0.6 }));
      out.push(A(P2.keeperFront, { seed: 12, expr: 'smile', L: 'belly', R: 'belly', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: 2 }, [2.8, DECK, 12.2], { tint, s: 1.0 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'breakthrough' && f >= 1392 && f <= 1420) {
    const w = winterAt(f), t = q((f - 1392) / 28, 2);
    out.push(FXC('burst_' + t, (p) => T.fxBurst(p, t, '#ffe9a8', 10, 30, 210), [w.pos[0], w.pos[1] + 1.1, w.pos[2]], 0.85));
  }
  return out;
};
