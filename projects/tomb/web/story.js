// Shot plan for "The Tomb That Fooled Every Robber" (T1 of the trick
// batch) — timed to tomb-voice (79.49 s, 30 fps, TOTAL 2385).
// Phrases: L1 0-142 | L2 164-272 | L3 288-458 | L4 478-719 | L5 731-970 |
// L6 984-1235 | L7 1247-1391 | L8 1405-1507 | L9 1519-1638 | L10 1656-1849 |
// L11 1865-1975 | L12 1995-2146 | L13 TEASE 2169-2380 (the plane hook).
// World: ONE valley set. Mound+coffin SW, mortar yard W, seven-storey
// stupa S, worship hall N (secret passage under it), river E, wall ring
// with two gates. One continuous camera flight, boundary-matched keys.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 2385, DECK = 0;
export const SHOTS = [
  { id: 'intro', a: 0, b: 163, light: 'day' },
  { id: 'rain', a: 164, b: 287, light: 'storm' },
  { id: 'coffin', a: 288, b: 477, light: 'day' },
  { id: 'mortar', a: 478, b: 730, light: 'day' },
  { id: 'stupa', a: 731, b: 983, light: 'day' },
  { id: 'passage', a: 984, b: 1246, light: 'golden' },
  { id: 'decoy', a: 1247, b: 1404, light: 'golden' },
  { id: 'geography', a: 1405, b: 1518, light: 'golden' },
  { id: 'robbers', a: 1519, b: 1655, light: 'dusk' },
  { id: 'wall', a: 1656, b: 1864, light: 'dusk' },
  { id: 'gate', a: 1865, b: 1994, light: 'dusk' },
  { id: 'reveal', a: 1995, b: 2168, light: 'dusk' },
  { id: 'hook', a: 2169, b: 2384, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 48, fogFar: 400,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 22, aurora: 0, gain: '#ffffff', ...WATER },
  storm: { az: 140, el: 30, sky: '#8a9cb2', ground: '#4c5248', hemi: 1.0, sun: '#c8d4e2', sunI: 1.35, fog: '#a8b4bc', fogNear: 34, fogFar: 300,
    skyTop: '#546a86', skyHor: '#c2ccd2', sunDisc: '#dfe8ee', sunSize: 0.0024, sat: 0.88, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#dde6f0', ...WATER },
  golden: { az: 100, el: 22, sky: '#d9b28c', ground: '#5c5a34', hemi: 1.16, sun: '#ffb763', sunI: 2.4, fog: '#e5cf9e', fogNear: 44, fogFar: 380,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.08, vig: 0.22, shadowExt: 22, aurora: 0, gain: '#ffedd6', ...WATER },
  dusk: { az: 108, el: 15, sky: '#93a7c4', ground: '#44484a', hemi: 1.02, sun: '#cfd9e8', sunI: 1.5, fog: '#aeb8c8', fogNear: 40, fogFar: 340,
    skyTop: '#46587a', skyHor: '#c8b498', sunDisc: '#e8eef2', sunSize: 0.0026, sat: 0.94, vig: 0.3, shadowExt: 22, aurora: 0, gain: '#e4ecf6', ...WATER },
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
  if (S.id === 'rain') return blendLight(LIGHTS.day, LIGHTS.storm, smooth(ramp(f, 164, 210)));
  if (S.id === 'coffin') return blendLight(LIGHTS.storm, LIGHTS.day, smooth(ramp(f, 288, 340)));
  if (S.id === 'passage') return blendLight(LIGHTS.day, LIGHTS.golden, smooth(ramp(f, 984, 1060)));
  if (S.id === 'robbers') return blendLight(LIGHTS.golden, LIGHTS.dusk, smooth(ramp(f, 1519, 1600)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const MOUND = [-7, 0, 3];            // burial mound centre
export const COFFIN0 = [-7, 0.35, 6.6];     // coffin on its slab (start)
export const YARD = [-10.5, 0, -3];         // mortar yard
export const STUPA = [1.5, 0, 12];          // seven-storey stupa
export const HALL = [0, 0, -13];            // worship hall (passage under it)
export const CHEST = [4.8, 0, 15.6];        // decoy treasure chest
export const GATE_S = [0, 0, 17];
export const GATE_N = [0, 0, -19];

/** Coffin position while it is carried to the secret chamber (s7). */
export const coffinAt = (f) => {
  const k = smooth(ramp(f, 1060, 1210));
  return kf3([[0, COFFIN0], [0.45, [-3.5, 0.35, -1.5]], [1, [0, 0.35, -9.4]]], k);
};

export const heroPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'intro': return [-7, 0.8, 6];
    case 'rain': return [-7, 0.8, 5.6];
    case 'coffin': return [-7, 0.75, 6.4];
    case 'mortar': return [-10.4, 0.6, -2.9];
    case 'stupa': return [1.5, 3.0, 12];
    case 'passage': { const cp = coffinAt(f); return f < 1130 ? [cp[0], 0.8, cp[2]] : [0, 1.1, -10.6]; }
    case 'decoy': return [4.7, 0.6, 15.5];
    case 'geography': return [0, 0, 0];
    case 'robbers': return [3.8, 0.5, 16.2];
    case 'wall': return [0, 1.4, 12];
    case 'gate': return [2, 0.8, 7.5];
    case 'reveal': return [0, 0.5, 2];
    case 'hook': return [-4, 20, -24];
    default: return [0, 1, 0];
  }
};

// ---------- cameras (boundary-matched continuous flight) ----------
const CAMS = {
  intro: [
    { f: 0, pos: [6.5, 4.2, 16.5], look: [-6, 0.9, 5.2], fov: 46 },
    { f: 163, pos: [0.5, 3.4, 13.5], look: [-6.8, 0.9, 5.6], fov: 42 },
  ],
  rain: [
    { f: 164, pos: [0.5, 3.4, 13.5], look: [-6.8, 0.9, 5.6], fov: 42 },
    { f: 228, pos: [-12.5, 3.0, 11.5], look: [-2, 0.7, 5.2], fov: 46, ease: 'surge' },
    { f: 287, pos: [-2, 3.0, 12.5], look: [-7, 0.8, 5.8], fov: 42 },
  ],
  coffin: [
    { f: 288, pos: [-2, 3.0, 12.5], look: [-7, 0.8, 5.8], fov: 42 },
    { f: 380, pos: [-4.2, 2.2, 10.5], look: [-7, 0.75, 6.4], fov: 38, ease: 'surge' },
    { f: 477, pos: [-4.6, 2.3, 10.8], look: [-7, 0.8, 6.3], fov: 38 },
  ],
  mortar: [
    { f: 478, pos: [-4.6, 2.3, 10.8], look: [-7, 0.8, 6.3], fov: 38 },
    { f: 600, pos: [-6.4, 2.4, 2.5], look: [-10.3, 0.6, -2.8], fov: 40, ease: 'surge' },
    { f: 730, pos: [-6.8, 2.3, 2.2], look: [-10.4, 0.6, -2.9], fov: 40 },
  ],
  stupa: [
    { f: 731, pos: [-6.8, 2.3, 2.2], look: [-10.4, 0.6, -2.9], fov: 40 },
    { f: 860, pos: [10.5, 3.2, 20], look: [1.5, 2.6, 12], fov: 42, ease: 'surge' },
    { f: 983, pos: [8.6, 4.6, 19.5], look: [1.2, 3.0, 11.8], fov: 42 },
  ],
  passage: [
    { f: 984, pos: [8.6, 4.6, 19.5], look: [1.2, 3.0, 11.8], fov: 42 },
    { f: 1100, pos: [-12.9, 2.2, 2.8], look: [-6.4, 0.6, 5.4], fov: 42, ease: 'surge' },
    { f: 1246, pos: [-4.4, 2.4, -4.6], look: [0, 1.1, -10.6], fov: 40 },
  ],
  decoy: [
    { f: 1247, pos: [-4.4, 2.4, -4.6], look: [0, 1.1, -10.6], fov: 40 },
    { f: 1330, pos: [8.8, 2.6, 8], look: [4.6, 0.7, 15.2], fov: 42, ease: 'surge' },
    { f: 1404, pos: [8.2, 2.2, 10.5], look: [4.7, 0.6, 15.5], fov: 40 },
  ],
  geography: [
    { f: 1405, pos: [8.2, 2.2, 10.5], look: [4.7, 0.6, 15.5], fov: 40 },
    { f: 1518, pos: [16, 17, 26], look: [0, 0, -2], fov: 44 },
  ],
  robbers: [
    { f: 1519, pos: [16, 17, 26], look: [0, 0, -2], fov: 44 },
    { f: 1580, pos: [9.5, 3.4, 19], look: [3.2, 0.5, 15.4], fov: 42, ease: 'surge' },
    { f: 1655, pos: [9.2, 2.6, 19.2], look: [3.4, 0.5, 15.6], fov: 40 },
  ],
  wall: [
    { f: 1656, pos: [9.2, 2.6, 19.2], look: [3.4, 0.5, 15.6], fov: 40 },
    { f: 1760, pos: [13, 6.5, 24], look: [0, 1.9, 12], fov: 44, ease: 'surge' },
    { f: 1864, pos: [11, 5.5, 23], look: [0, 2.3, 15.5], fov: 44 },
  ],
  gate: [
    { f: 1865, pos: [11, 5.5, 23], look: [0, 2.3, 15.5], fov: 44 },
    { f: 1930, pos: [4.5, 2.8, 12.5], look: [1.5, 0.8, 8], fov: 42, ease: 'surge' },
    { f: 1994, pos: [4.2, 2.6, 12], look: [2.2, 0.8, 7.2], fov: 42 },
  ],
  reveal: [
    { f: 1995, pos: [4.2, 2.6, 12], look: [2.2, 0.8, 7.2], fov: 42 },
    { f: 2080, pos: [12, 7.5, 26], look: [-1, 0.8, 6], fov: 44, ease: 'surge' },
    { f: 2168, pos: [13.5, 8.5, 28], look: [-1, 0.6, 4], fov: 44 },
  ],
  hook: [
    { f: 2169, pos: [13.5, 8.5, 28], look: [-1, 0.6, 4], fov: 44 },
    { f: 2270, pos: [10, 12, 24], look: [-2, 14, -18], fov: 42, ease: 'surge' },
    { f: 2384, pos: [6, 10, 20], look: [-4, 20, -24], fov: 40 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 6;
  if (S.id === 'coffin' || S.id === 'mortar' || S.id === 'decoy') cinf = 4.5;
  if (S.id === 'geography' || S.id === 'reveal') cinf = 3.5;
  if (S.id === 'hook') cinf = 4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardStupa: 0, boardCity: 0, boardXia: 0, rainK: 0, floodK: 0, itemK: 0, tierK: 0, slabK: 0, chestK: 0, wallK: 0, planeK: 0, glowK: 0 };
  switch (S.id) {
    case 'intro': break;
    case 'rain': W.rainK = smooth(ramp(f, 170, 200)) * (1 - smooth(ramp(f, 262, 287))); W.floodK = smooth(ramp(f, 200, 272)); break;
    case 'coffin': W.itemK = smooth(ramp(f, 320, 440)); break;
    case 'mortar': W.itemK = 1; break;
    case 'stupa': W.itemK = 1; W.tierK = smooth(ramp(f, 745, 965)); break;
    case 'passage': W.itemK = 1; W.tierK = 1; W.slabK = smooth(ramp(f, 1000, 1050)); W.glowK = W.slabK; break;
    case 'decoy': W.itemK = 1; W.tierK = 1; W.slabK = 1; W.chestK = 0.6 + 0.4 * Math.sin(f * 0.3); break;
    case 'geography': W.itemK = 1; W.tierK = 1; W.slabK = 1; W.boardStupa = smooth(ramp(f, 1458, 1485)); break;
    case 'robbers': W.itemK = 1; W.tierK = 1; W.boardStupa = 0; W.slabK = 1; break;
    case 'wall': W.itemK = 1; W.tierK = 1; W.slabK = 1; W.wallK = smooth(ramp(f, 1670, 1800)); W.boardCity = smooth(ramp(f, 1840, 1862)); break;
    case 'gate': W.itemK = 1; W.tierK = 1; W.slabK = 1; W.wallK = 1; W.boardCity = 1 - smooth(ramp(f, 1865, 1875)); break;
    case 'reveal': W.itemK = 1; W.tierK = 1; W.slabK = 1; W.wallK = 1; W.boardXia = smooth(ramp(f, 2075, 2110)); break;
    case 'hook': W.itemK = 1; W.tierK = 1; W.slabK = 1; W.wallK = 1; W.boardXia = 1 - ramp(f, 2169, 2177); W.planeK = ramp(f, 2190, 2370); break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f), W = worldAt(f);
  return {
    smokeRate: 0.4, dustRate: 0.12,
    digRate: S.id === 'robbers' && f < 1600 ? 9 : 0,
    dirtRate: S.id === 'mortar' ? 1.2 : 0,
    rainK: W.rainK,
  };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', storm: '#dfe8f2', golden: '#ffd9a3', dusk: '#d8e2f0' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  king: { jacket: '#7a1f2b', pants: '#3a2c22', boots: '#2e2118', hat: 'cap', cap: '#e8b53a', skin: '#c99067' },
  attendant: { jacket: '#54687e', pants: '#33383f', boots: '#2e2a26', skin: '#f0c297' },
  attendant2: { jacket: '#5d7a4a', pants: '#3c3a44', boots: '#2e2a26', skin: '#8a5a3b' },
  mason: { jacket: '#8a6a42', pants: '#4a4238', boots: '#2e2a26', skin: '#c99067' },
  robber: { jacket: '#2e3440', pants: '#22262e', boots: '#1c1a17', hat: 'cap', cap: '#22262e', skin: '#e8b98d' },
  robber2: { jacket: '#3a3230', pants: '#26221f', boots: '#1c1a17', hat: 'cap', cap: '#3a3230', skin: '#a8763e' },
  guard: { jacket: '#31517d', pants: '#22344d', boots: '#1e1a16', hat: 'cap', cap: '#c8ccd4', skin: '#f5c9a0' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: pos[1], ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const stand = (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
  switch (S.id) {
    case 'intro': {
      out.push(stand(OUTFITS.king, 'pained', 31, [-5.4, 0, 5.2], { yaw: -0.5, s: 1.05 }));
      out.push(stand(OUTFITS.attendant, 'stern', 32, [-8.6, 0, 5.4], { yaw: 0.4 }));
      out.push(stand(OUTFITS.attendant2, 'stern', 33, [-5.2, 0, 7.6], { yaw: -0.9 }));
      break;
    }
    case 'rain': {
      const jit = q(0.5 + 0.5 * Math.sin(f * 0.9), 2);
      out.push(RW(T, OUTFITS.king, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 31), seed: 31, headTilt: -3 }, [-5.4, 0, 5.2], { tint, yaw: 0.85, s: 1.05 }));
      out.push(stand(OUTFITS.attendant, 'nervous', 32, [-8.6, 0, 5.4], { yaw: 0.7 }));
      out.push(stand(OUTFITS.attendant2, 'nervous', 33, [-5.2, 0, 7.6], { yaw: 0.5 }));
      break;
    }
    case 'coffin': {
      const place = f > 360 && f < 450 ? q(0.5 + 0.5 * Math.sin(f * 0.45), 2) : 0;
      out.push(RW(T, OUTFITS.attendant, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 32), seed: 32, wave: place }, [-8.35, 0, 6.5], { tint, yaw: 0.5 }));
      out.push(RW(T, OUTFITS.attendant2, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 33), seed: 33, wave: f > 330 && f < 420 ? q(0.5 + 0.5 * Math.sin(f * 0.45 + 2), 2) : 0 }, [-5.65, 0, 6.5], { tint, yaw: -0.5 }));
      out.push(stand(OUTFITS.king, 'pained', 31, [-7, 0, 8.4], { yaw: 0, s: 1.05 }));
      break;
    }
    case 'mortar': {
      const stir = q(0.5 + 0.5 * Math.sin(f * 0.6), 2);
      out.push(RW(T, OUTFITS.mason, { expr: f > 640 ? 'grin' : 'stern', mode: 'stand', blink: blinkAt(f, 34), seed: 34, wave: stir, headTilt: 4 }, [-9.7, 0, -2.1], { tint, yaw: -0.4 }));
      out.push(stand(OUTFITS.king, 'stern', 31, [-8.9, 0, -5.8], { yaw: 0.9, s: 1.05 }));
      out.push(stand(OUTFITS.attendant, 'neutral', 32, [-11.6, 0, -4.4], { yaw: 1.2 }));
      break;
    }
    case 'stupa': {
      out.push(RW(T, OUTFITS.attendant, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 32), seed: 32, wave: q(0.5 + 0.5 * Math.sin(f * 0.35), 2) }, [0.1, 0, 9.4], { tint, yaw: 0.3 }));
      out.push(stand(OUTFITS.attendant2, 'neutral', 33, [3.6, 0, 10.0], { yaw: -0.4 }));
      out.push(stand(OUTFITS.king, 'stern', 31, [6.0, 0, 8.4], { yaw: -0.8, s: 1.05 }));
      break;
    }
    case 'passage': {
      const cp = coffinAt(f);
      const moving = f >= 1060 && f <= 1210;
      const ph = q((f * 0.055) % 1, 2);
      const fade = f > 1210 ? Math.max(0, 1 - (f - 1210) / 25) : 1;
      if (fade > 0) {
        out.push(RW(T, OUTFITS.attendant, { expr: 'stern', mode: moving ? 'march' : 'stand', phase: ph, blink: blinkAt(f, 32), seed: 32 }, [cp[0] - 1.35, 0, cp[2]], { tint, yaw: 0.35, alpha: fade }));
        out.push(RW(T, OUTFITS.attendant2, { expr: 'stern', mode: moving ? 'march' : 'stand', phase: ph, blink: blinkAt(f, 33), seed: 33 }, [cp[0] + 1.35, 0, cp[2]], { tint, yaw: 0.35, alpha: fade }));
      }
      out.push(stand(OUTFITS.king, 'pained', 31, [-2.5, 0, -6.4], { yaw: 0.4, s: 1.05 }));
      break;
    }
    case 'decoy': {
      out.push(RW(T, OUTFITS.robber, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), seed: 41, headTilt: 5, wave: q(0.5 + 0.5 * Math.sin(f * 0.3), 2) }, [4.1, 0, 14.4], { tint, yaw: 0.5, s: 0.97 }));
      out.push(stand(OUTFITS.robber2, 'grin', 42, [6.3, 0, 16.8], { yaw: -0.7, s: 0.97 }));
      break;
    }
    case 'geography': {
      out.push(stand(OUTFITS.king, 'stern', 31, [0, 0, 2], { s: 1.05 }));
      break;
    }
    case 'robbers': {
      if (f < 1600) {
        const dig = q(0.5 + 0.5 * Math.sin(f * 1.4), 2);
        out.push(RW(T, OUTFITS.robber, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41, wave: dig, headTilt: 7 }, [3.0, 0, 16.4], { tint, yaw: 0.4, s: 0.97 }));
        out.push(RW(T, OUTFITS.robber2, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 42), seed: 42, wave: q(0.5 + 0.5 * Math.sin(f * 1.4 + 2.5), 2), headTilt: 7 }, [4.6, 0, 17.0], { tint, yaw: -0.3, s: 0.97 }));
      } else {
        const k = ramp(f, 1600, 1655), ph = q((f * 0.055) % 1, 2);
        out.push(RW(T, OUTFITS.robber, { expr: 'pained', mode: 'march', phase: ph, blink: blinkAt(f, 41), seed: 41 }, [3.0 + 4.5 * k, 0, 16.4 + 1.0 * k], { tint, yaw: 1.2, s: 0.97 }));
        out.push(RW(T, OUTFITS.robber2, { expr: 'pained', mode: 'march', phase: ph, blink: blinkAt(f, 42), seed: 42 }, [4.6 + 4.5 * k, 0, 17.0 + 1.0 * k], { tint, yaw: 1.2, s: 0.97 }));
      }
      break;
    }
    case 'wall': {
      out.push(stand(OUTFITS.guard, 'stern', 51, [-1.9, 0, 16.4], { yaw: 0 }));
      out.push(stand(OUTFITS.guard, 'stern', 52, [1.9, 0, 16.4], { yaw: 0 }));
      out.push(stand(OUTFITS.king, 'stern', 31, [0, 0, 13.2], { yaw: 0, s: 1.05 }));
      break;
    }
    case 'gate': {
      const rp = kf3([[1865, [0, 0, 15.2]], [1920, [2.5, 0, 10]], [1960, [6.5, 0, 6.5]], [1994, [3.2, 0, 3.2]]], f);
      out.push(RW(T, OUTFITS.robber, { expr: f > 1955 ? 'nervous' : 'grin', mode: 'march', phase: q((f * 0.055) % 1, 2), blink: blinkAt(f, 41), seed: 41 }, rp, { tint, yaw: 0.8, s: 0.97 }));
      out.push(stand(OUTFITS.guard, 'stern', 51, [-1.9, 0, 16.4], { yaw: 0 }));
      out.push(stand(OUTFITS.guard, 'stern', 52, [1.9, 0, 16.4], { yaw: 0 }));
      break;
    }
    case 'reveal': {
      out.push(stand(OUTFITS.guard, 'stern', 51, [-1.9, 0, 16.4], {}));
      out.push(stand(OUTFITS.guard, 'stern', 52, [1.9, 0, 16.4], {}));
      out.push(stand(OUTFITS.king, 'stern', 31, [0, 0, 10], { s: 1.05 }));
      break;
    }
    case 'hook': break;
  }
  return out;
};
export const fxAt = (f, T) => [];
