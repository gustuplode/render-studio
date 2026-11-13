// Shot plan for "Parachute — Two People, One Parachute" (T2 of the trick
// batch) — timed to parachute-voice (40.69 s, 30 fps, TOTAL 1221).
// Phrases: P1 0-76 | P2 83-144 | P3 158-203 | P4 220-357 | P5 370-443 |
// P6 457-575 | P7 595-691 | P8 706-809 | P9 826-938 | P10 960-1059 |
// P11 TEASE 1077-1210 (the pilot question).
// World: EXT plane at origin (y=6, nose +x, right engine z+ burns);
// CABIN cutaway stage at x=30 (floor top y=6, back wall z=-2.7, open +z);
// FIELD stage far below at (6,-34,8). One continuous camera flight,
// boundary-matched keys throughout.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1221, DECK = 0;
export const SHOTS = [
  { id: 'takeoff', a: 0, b: 82, light: 'day' },
  { id: 'fire', a: 83, b: 157, light: 'day' },
  { id: 'panic', a: 158, b: 219, light: 'cabin' },
  { id: 'news', a: 220, b: 369, light: 'cabin' },
  { id: 'faces', a: 370, b: 456, light: 'cabin' },
  { id: 'boy', a: 457, b: 594, light: 'cabin' },
  { id: 'pair', a: 595, b: 705, light: 'cabin' },
  { id: 'jump', a: 706, b: 825, light: 'day' },
  { id: 'canopies', a: 826, b: 959, light: 'day' },
  { id: 'landing', a: 960, b: 1076, light: 'golden' },
  { id: 'pilot', a: 1077, b: 1220, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a72', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfdce8', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#e8f0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  cabin: { az: 118, el: 36, sky: '#c8ccd2', ground: '#5c564c', hemi: 1.12, sun: '#ffe9c4', sunI: 1.7, fog: '#d8d4c8', fogNear: 40, fogFar: 300,
    skyTop: '#7d90b4', skyHor: '#f2e8cc', sunDisc: '#fff3cf', sunSize: 0.0026, sat: 1.02, vig: 0.26, shadowExt: 14, aurora: 0, gain: '#fff4e0', ...WATER },
  golden: { az: 96, el: 20, sky: '#d9b28c', ground: '#5c5a34', hemi: 1.16, sun: '#ffb763', sunI: 2.4, fog: '#e5cf9e', fogNear: 40, fogFar: 340,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.08, vig: 0.22, shadowExt: 18, aurora: 0, gain: '#ffedd6', ...WATER },
  dusk: { az: 108, el: 16, sky: '#93a7c4', ground: '#44484a', hemi: 1.02, sun: '#cfd9e8', sunI: 1.5, fog: '#aeb8c8', fogNear: 38, fogFar: 320,
    skyTop: '#4d6488', skyHor: '#c8c2b2', sunDisc: '#e8eef2', sunSize: 0.0026, sat: 0.92, vig: 0.3, shadowExt: 18, aurora: 0, gain: '#e4ecf6', ...WATER },
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
  if (S.id === 'pilot') return blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 1077, 1160)));
  if (S.id === 'landing') return blendLight(LIGHTS.day, LIGHTS.golden, smooth(ramp(f, 960, 1030)));
  if (S.id === 'panic') return blendLight(LIGHTS.day, LIGHTS.cabin, smooth(ramp(f, 158, 200)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const PLANE = [0, 6, 0];            // fuselage centre
export const ENGINE_R = [1.6, 5.25, 3.1];   // burning right engine
export const DOOR = [3.4, 5.5, 1.15];       // jump door (front right)
export const CABIN = [30, 6, 0];            // cabin floor centre (top y=6)
export const BOY_SEAT = [31.3, 6.5, 0.15]; // boy stands on a seat dragged into the aisle (feet y)
export const FIELD = [6, -34, 8];           // landing field centre (top y=-34)
const planeBob = (f) => 0.07 * Math.sin(f * 0.045);

/** Focal point per frame (camera focus / DOF): [x,y,z]. */
export const heroPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'takeoff': case 'fire': return [PLANE[0], PLANE[1] + planeBob(f), PLANE[2]];
    case 'panic': case 'news': return [30, 6.9, -0.4];
    case 'faces': return [28.9, 6.95, 0.3];
    case 'boy': return [BOY_SEAT[0], BOY_SEAT[1] + 1.0, BOY_SEAT[2]];
    case 'pair': return [29.25, 6.9, 0.1];
    case 'jump': return [DOOR[0], DOOR[1], DOOR[2]];
    case 'canopies': return heroCanopyAt(f);
    case 'landing': return [6.4, -33.2, 8.2];
    case 'pilot': return [4.8, 6.6, 0.3];
    default: return [0, 6, 0];
  }
};
/** Hero canopy (with the real pair under it) drifting down, s9. */
export const heroCanopyAt = (f) => kf3([[826, [-1.5, 1.5, 0.5]], [959, [1.8, -7.5, 2.6], 'linear']], f);

// ---------- cameras (boundary-matched continuous flight) ----------
const CAMS = {
  takeoff: [
    { f: 0, pos: [13.5, 8.6, 13.5], look: [0, 6.2, 0], fov: 46 },
    { f: 82, pos: [10.5, 7.6, 10.5], look: [0.4, 6.2, 0.2], fov: 44 },
  ],
  fire: [
    { f: 83, pos: [10.5, 7.6, 10.5], look: [0.4, 6.2, 0.2], fov: 44 },
    { f: 120, pos: [6.6, 6.9, 9.6], look: [1.9, 5.3, 2.9], fov: 42, ease: 'surge' },
    { f: 157, pos: [7.6, 7.1, 11.2], look: [2.1, 5.5, 2.7], fov: 42 },
  ],
  panic: [
    { f: 158, pos: [7.6, 7.1, 11.2], look: [2.1, 5.5, 2.7], fov: 42 },
    { f: 188, pos: [30.2, 7.7, 10.6], look: [30, 6.9, -0.5], fov: 46, ease: 'surge' },
    { f: 219, pos: [30, 7.3, 8.8], look: [29.7, 6.85, -0.6], fov: 44 },
  ],
  news: [
    { f: 220, pos: [30, 7.3, 8.8], look: [29.7, 6.85, -0.6], fov: 44 },
    { f: 295, pos: [28.6, 8.7, 9.4], look: [31.8, 7.7, -1.8], fov: 43, ease: 'surge' },
    { f: 369, pos: [28.8, 8.55, 9.2], look: [31.6, 7.65, -1.6], fov: 43 },
  ],
  faces: [
    { f: 370, pos: [28.8, 8.55, 9.2], look: [31.6, 7.65, -1.6], fov: 43 },
    { f: 415, pos: [28.5, 7.05, 6.3], look: [28.95, 6.9, 0.25], fov: 38, ease: 'surge' },
    { f: 456, pos: [28.7, 7.1, 6.1], look: [29.0, 6.92, 0.3], fov: 38 },
  ],
  boy: [
    { f: 457, pos: [28.7, 7.1, 6.1], look: [29.0, 6.92, 0.3], fov: 38 },
    { f: 505, pos: [31.1, 7.5, 6.6], look: [31.3, 7.35, 0.1], fov: 40, ease: 'surge' },
    { f: 594, pos: [31.25, 7.4, 5.4], look: [31.3, 7.4, 0.12], fov: 40 },
  ],
  pair: [
    { f: 595, pos: [31.15, 7.4, 5.7], look: [31.3, 7.4, 0.4], fov: 40 },
    { f: 645, pos: [29.2, 7.25, 6.6], look: [29.25, 6.9, 0.2], fov: 42, ease: 'surge' },
    { f: 705, pos: [29.35, 7.2, 6.3], look: [29.3, 6.9, 0.25], fov: 42 },
  ],
  jump: [
    { f: 706, pos: [29.35, 7.2, 6.3], look: [29.3, 6.9, 0.25], fov: 42 },
    { f: 752, pos: [8.6, 7.6, 9.2], look: [2.6, 5.7, 1.3], fov: 44, ease: 'surge' },
    { f: 825, pos: [9.6, 6.4, 10.6], look: [0.5, 3.2, 0.6], fov: 45 },
  ],
  canopies: [
    { f: 826, pos: [9.6, 6.4, 10.6], look: [0.5, 3.2, 0.6], fov: 45 },
    { f: 895, pos: [12.5, 1.5, 14.5], look: [0, -5.5, 0.8], fov: 50, ease: 'surge' },
    { f: 959, pos: [11.5, -0.5, 13.5], look: [0.8, -7.0, 1.6], fov: 48 },
  ],
  landing: [
    { f: 960, pos: [11.5, -0.5, 13.5], look: [0.8, -7.0, 1.6], fov: 48 },
    { f: 1010, pos: [7.2, -31.9, 16.5], look: [6.2, -33.5, 8.0], fov: 44, ease: 'surge' },
    { f: 1076, pos: [6.8, -32.3, 15.2], look: [6.3, -33.4, 8.1], fov: 43 },
  ],
  pilot: [
    { f: 1077, pos: [6.8, -32.3, 15.2], look: [6.3, -33.4, 8.1], fov: 43 },
    { f: 1135, pos: [10.6, 7.7, 7.6], look: [4.6, 6.6, 0.3], fov: 40, ease: 'surge' },
    { f: 1220, pos: [9.3, 7.4, 6.3], look: [4.85, 6.62, 0.25], fov: 40 },
  ],
};
const SHADOW_AT = { takeoff: [0, 6, 0], fire: [1, 5.5, 2], panic: [30, 6.5, 0], news: [30, 6.5, -0.5], faces: [29, 6.5, 0], boy: [31, 7, 0.4], pair: [29, 6.5, 0.8], jump: [3, 5.5, 1], canopies: [0, -4, 0], landing: [6, -33.5, 8], pilot: [4.5, 6.5, 0] };
export const camAt = (f) => {
  const S = shotAt(f);
  const c = camFromKeys(CAMS[S.id], f);
  let flash = f < 9 ? -0.95 * (1 - f / 9) : 0;
  if (S.id === 'fire') flash = Math.max(flash, 0.10 + 0.07 * Math.sin(f * 1.31) * Math.sin(f * 0.47)); // engine-fire glow breathing
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 7;
  if (S.id === 'faces' || S.id === 'boy') cinf = 4.5;
  if (S.id === 'fire' || S.id === 'takeoff') cinf = 5;
  if (S.id === 'canopies') cinf = 9;
  if (S.id === 'pilot') cinf = 5;
  return { focus: dist(C.pos, hp), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardRoute: 0, boardChute: 0, boardSafe: 0, fireK: 0, doorK: 0, cloudK: 0.5 };
  switch (S.id) {
    case 'takeoff': W.cloudK = 0.65; break;
    case 'fire': W.fireK = smooth(ramp(f, 92, 118)); W.cloudK = 0.6; break;
    case 'panic': W.boardRoute = f >= 186 ? 1 : 0; W.fireK = 1; break;
    case 'news': W.boardChute = smooth(ramp(f, 300, 330)); W.fireK = 1; break;
    case 'faces': W.boardChute = 0; W.fireK = 1; break;
    case 'boy': W.fireK = 1; break;
    case 'pair': W.fireK = 1; break;
    case 'jump': W.doorK = smooth(ramp(f, 716, 736)); W.fireK = 1; W.cloudK = 0.6; break;
    case 'canopies': W.doorK = 1; W.fireK = 0.85; W.cloudK = 0.55; break;
    case 'landing': W.boardSafe = smooth(ramp(f, 1008, 1036)); W.fireK = 0.3; W.cloudK = 0.4; break;
    case 'pilot': W.fireK = 0.45; W.cloudK = 0.35; break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const W = worldAt(f);
  return { smokeRate: 0.5, dustRate: 0.1, fireRate: W.fireK * 16, trailRate: W.fireK * 6 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', cabin: '#ffe9c4', golden: '#ffd9a3', dusk: '#dfe8f2' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  boy: { jacket: '#f2b01e', pants: '#2e5aa8', boots: '#5a3a22', hat: 'cap', cap: '#d8453a', skin: '#c99067', build: 'kid' },
  heavy: { jacket: '#7a4a8c', pants: '#3c3a44', boots: '#2e2a26', skin: '#f5c9a0', build: 'stout' },
  thin: { jacket: '#3f8a5f', pants: '#4a4238', boots: '#2e2a26', skin: '#ecd0b6' },
  pilot: { jacket: '#2c3e57', pants: '#22344d', boots: '#1e1a16', cap: '#eef2f6', skin: '#f5c9a0' },
  crew: { jacket: '#b03a5b', pants: '#33383f', boots: '#2e2a26', skin: '#c99067' },
};
const PASS = [
  { jacket: '#4f7fb8', pants: '#3a4149', boots: '#2e2a26', skin: '#f5c9a0' },
  { jacket: '#c25a7a', pants: '#4a4238', boots: '#2e2a26', skin: '#c99067', dress: '#c25a7a' },
  { jacket: '#5d8a3a', pants: '#33383f', boots: '#2e2a26', skin: '#ecd0b6' },
  { jacket: '#d9a441', pants: '#3c3a44', boots: '#2e2a26', skin: '#8a5a3b' },
  { jacket: '#54687e', pants: '#2e3440', boots: '#2e2a26', skin: '#f0c297' },
  { jacket: '#9c4a3c', pants: '#4a4238', boots: '#2e2a26', skin: '#ffe2c2', dress: '#9c4a3c' },
];
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stepAt = (f, rate = 0.055) => q((f * rate) % 1, 2);
const jitter = (f, seed) => q(0.5 + 0.5 * Math.sin(f * 0.9 + seed * 2.7), 2); // panic tremble 0..1

// seated/standing passenger slots inside the cabin (aisle z~0, rows x)
const SLOTS = [
  [27.4, -1.15, 0], [27.4, 1.2, 1], [28.9, -1.2, 2], [28.9, 1.15, 3],
  [30.4, -1.15, 4], [30.4, 1.2, 5], [32.6, -1.2, 0], [32.6, 1.15, 2],
  [33.9, -1.1, 3], [33.9, 1.25, 4], [29.6, 0.1, 5], [32.0, -0.2, 1],
];
const paxAt = (T, tint, f, mood) => SLOTS.map(([x, z, v], i) => {
  const o = PASS[v];
  const standing = mood !== 'seated';
  const expr = mood === 'panic' ? (i % 3 === 0 ? 'shock' : 'nervous') : mood === 'fallen' ? (i % 2 ? 'dazed' : 'nervous') : mood === 'relief' ? (i % 2 ? 'relief_open' : 'smile') : 'neutral';
  return RW(T, o, { expr, mode: standing ? 'stand' : 'sit', phase: jitter(f, i + 3), blink: blinkAt(f, 31 + i * 7), facing: i % 2 ? -1 : 1, seed: 3 + i * 5, tilt: mood === 'panic' ? (i % 2 ? 2 : -2) : 0 },
    [x, CABIN[1], z], { tint, s: 0.8, yaw: (i % 2 ? -0.14 : 0.14) });
});

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S);
  switch (S.id) {
    case 'takeoff': case 'fire': case 'pilot': break; // the 3D plane is the actor here (pilot = silhouette head inside the cockpit glass, in main.js)
    case 'panic': out.push(...paxAt(T, tint, f, 'panic')); break;
    case 'news': out.push(...paxAt(T, tint, f, 'panic')); break;
    case 'faces': { // two faces BIG: the news lands
      out.push(...paxAt(T, tint, f, 'fallen').slice(0, 6));
      out.push(RW(T, PASS[0], { expr: 'shock', mode: 'stand', blink: blinkAt(f, 31), facing: 1, seed: 3 }, [28.35, CABIN[1], 0.95], { tint, s: 1.02, yaw: 0.1 }));
      out.push(RW(T, PASS[1], { expr: 'dazed', mode: 'stand', blink: blinkAt(f, 43), facing: -1, seed: 8 }, [29.55, CABIN[1], -0.55], { tint, s: 1.0, yaw: -0.1 }));
      break;
    }
    case 'boy': { // THE BOY stands on his seat and shouts the idea
      out.push(...paxAt(T, tint, f, 'fallen').filter((a, i) => i !== 5 && i !== 10));
      const up = f < 470 ? smooth(ramp(f, 457, 470)) : 1;
      out.push(RW(T, OUTFITS.boy, { expr: f < 520 ? 'stern' : 'grin', mode: 'stand', blink: blinkAt(f, 19), seed: 5, wave: f >= 500 && f < 560 ? q(0.5 + 0.5 * Math.sin(f * 0.5), 2) : 0, headTilt: -4 },
        [BOY_SEAT[0], CABIN[1] + 0.5 * up, BOY_SEAT[2]], { tint, s: 1.06, yaw: -0.06, ground: CABIN[1] + 0.5 }));
      out.push(RW(T, OUTFITS.crew, { expr: 'shock', mode: 'stand', blink: blinkAt(f, 53), facing: 1, seed: 11 }, [33.6, CABIN[1], 0.9], { tint, s: 0.84, yaw: 0.3 }));
      break;
    }
    case 'pair': { // heavy + thin pair up, strap the pack, boy directs
      out.push(...paxAt(T, tint, f, 'relief').slice(0, 5));
      out.push(RW(T, OUTFITS.heavy, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 37), facing: 1, seed: 7 }, [28.75, CABIN[1], 0.1], { tint, s: 0.95, yaw: 0.12 }));
      out.push(RW(T, OUTFITS.thin, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), facing: -1, seed: 9 }, [29.75, CABIN[1], 0.05], { tint, s: 0.92, yaw: -0.12 }));
      out.push(RW(T, OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 19), seed: 5, wave: q(0.5 + 0.5 * Math.sin(f * 0.4), 2) }, [30.8, CABIN[1], 0.95], { tint, s: 0.9, yaw: -0.35 }));
      break;
    }
    case 'jump': { // pairs leap from the door, two by two
      const J = [[716, 0], [748, 2], [780, 4]];
      for (const [f0, v] of J) {
        if (f < f0 || f > f0 + 62) continue;
        const p = kf3([[f0, [DOOR[0], DOOR[1] - 0.4, DOOR[2]]], [f0 + 26, [DOOR[0] + 2.6, DOOR[1] - 2.6, DOOR[2] + 2.6], 'linear'], [f0 + 62, [DOOR[0] + 5.2, DOOR[1] - 9.5, DOOR[2] + 5.2], 'linear']], f);
        out.push(RW(T, PASS[v], { expr: 'shock', mode: 'fall', blink: 0, seed: 3 + v * 5 }, [p[0], p[1], p[2]], { tint, s: 0.78, yaw: 0.5, blob: false, shadow: false }));
        out.push(RW(T, PASS[(v + 3) % 6], { expr: 'nervous', mode: 'fall', blink: 0, seed: 8 + v * 5 }, [p[0] + 0.42, p[1] - 0.25, p[2] + 0.3], { tint, s: 0.78, yaw: 0.55, blob: false, shadow: false }));
      }
      break;
    }
    case 'canopies': { // the hero pair hangs under the big canopy, real cards
      const hp = heroCanopyAt(f);
      out.push(RW(T, OUTFITS.heavy, { expr: 'relief_open', mode: 'fall', blink: blinkAt(f, 37), seed: 7 }, [hp[0] - 0.38, hp[1] - 0.1, hp[2]], { tint, s: 0.6, yaw: 0.1, blob: false, shadow: false }));
      out.push(RW(T, OUTFITS.thin, { expr: 'grin', mode: 'fall', blink: blinkAt(f, 41), seed: 9 }, [hp[0] + 0.38, hp[1] - 0.05, hp[2] + 0.1], { tint, s: 0.6, yaw: -0.08, blob: false, shadow: false }));
      break;
    }
    case 'landing': { // pairs touch down in the field, safe
      const pairs = [[5.2, 8.6, 0], [7.6, 7.2, 2], [8.9, 5.6, 4]];
      pairs.forEach(([x, z, v], i) => {
        const down = smooth(ramp(f, 962 + i * 16, 1010 + i * 16));
        const y = FIELD[1] + (1 - down) * 2.6;
        out.push(RW(T, PASS[v], { expr: 'relief_open', mode: down > 0.92 ? 'stand' : 'fall', blink: blinkAt(f, 31 + i * 13), seed: 3 + v * 5 }, [x, y, z], { tint, s: 0.85, yaw: 0.15, ground: FIELD[1] }));
        out.push(RW(T, PASS[(v + 3) % 6], { expr: 'smile', mode: down > 0.92 ? 'stand' : 'fall', blink: blinkAt(f, 47 + i * 11), seed: 8 + v * 5 }, [x + 0.75, y, z + 0.25], { tint, s: 0.85, yaw: -0.12, ground: FIELD[1] }));
      });
      out.push(RW(T, OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 19), seed: 5, wave: q(0.5 + 0.5 * Math.sin(f * 0.35), 2) }, [6.6, FIELD[1], 9.6], { tint, s: 0.92, yaw: -0.2, ground: FIELD[1] }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: pos[1], ...extra });
const canopyCard = (p, seedHue, sway, withFigs = true) => { // parachute canopy + lines + two mini figures
  const g = p.g; g.save(); g.translate(300, 430); g.rotate(sway * 0.05);
  const cols = ['#e8542e', '#f2f2f2', '#e8542e', '#f2f2f2', '#e8542e'];
  for (let i = 0; i < 5; i++) {
    const a0 = Math.PI * (1 - i / 5), a1 = Math.PI * (1 - (i + 1) / 5);
    p.poly([[0, 0], [Math.cos(a0) * 265, -Math.sin(a0) * 150], [Math.cos(a1) * 265, -Math.sin(a1) * 150]], cols[i], 7);
  }
  p.stroke([[-258, -12], [-26, 168], [258, -12], [26, 168], [-120, -105], [-14, 168], [120, -105], [14, 168]], 3.5, '#3a3230');
  if (withFigs) for (const dx of [-30, 30]) { // mini pair
    p.ell(dx, 196, 21, 24, '#f5c9a0', 5);
    p.stroke([[dx, 218], [dx - 4, 268]], 11, '#3a4a6a');
    p.stroke([[dx - 4, 268], [dx - 16, 318], [dx - 4, 268], [dx + 12, 316]], 9, '#2e2a26');
    p.stroke([[dx, 226], [dx + (dx < 0 ? -20 : 20), 248]], 8, '#7a4a8c');
  }
  g.restore();
};
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'canopies' || S.id === 'landing') {
    const lanes = [[-8.5, 3.2, -2.5, 0], [-5.5, 1.2, 2.2, 1], [6.5, 2.4, -1.8, 2], [9.0, 0.4, 3.0, 3], [-2.5, 4.4, 4.2, 4], [3.8, 5.2, -4.0, 5], [-10.5, -0.6, 1.0, 1], [11.5, 3.8, -3.2, 2]];
    lanes.forEach(([x0, y0, z, v], i) => {
      const t = clamp((f - 826) / 210 + i * 0.012);
      const x = x0 + t * 2.2, y = y0 - t * (S.id === 'landing' ? 30 : 9.5), yy = S.id === 'landing' ? Math.max(FIELD[1] + 3.1, y) : y;
      const sway = q(Math.sin(f * 0.03 + i * 1.7), 2);
      out.push(FXC('canopy' + i + '_' + sway + '_' + q(yy, 1), (p) => canopyCard(p, v, sway), [x, yy, z], 1.05, { alpha: S.id === 'landing' && yy <= FIELD[1] + 3.15 ? 0.0 : 0.96 }));
    });
    const hp = heroCanopyAt(f);
    const sway = q(Math.sin(f * 0.028), 2);
    out.push(FXC('herocanopy_' + sway, (p) => canopyCard(p, 0, sway, false), [hp[0], hp[1], hp[2]], 1.5));
    if (S.id === 'canopies') for (const bf of [838, 872, 908]) { // opening pops
      if (f >= bf && f <= bf + 3) { const t = q((f - bf) / 3, 2); out.push(FXC('pop_' + bf + '_' + t, (p) => T.fxBurst(p, t, '#ffffff', 8, 30, 130), [lanes[bf % 5][0], lanes[bf % 5][1] + 1.2, lanes[bf % 5][2]], 0.7)); }
    }
  }
  if (S.id === 'boy') { // idea sparkle over the boy's head as the plan lands
    const bf = 512;
    if (f >= bf && f <= bf + 14) { const t = q((f - bf) / 14, 2); out.push(FXC('idea_' + t, (p) => T.fxBurst(p, t, '#ffe066', 10, 26, 150), [BOY_SEAT[0], BOY_SEAT[1] + 2.6, BOY_SEAT[2]], 0.55)); }
  }
  return out;
};
