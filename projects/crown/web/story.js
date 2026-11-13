// Shot plan for "The Crown That Lied — Archimedes' Trick" (T4 of the
// trick batch) — timed to crown-voice (55.37 s, 30 fps, TOTAL 1661).
// Phrases: L1 0-110 | L2 125-274 | L3 289-395 | L4 410-503 | L5 522-637 |
// L6 650-723 | L7 736-884 | L8 884-1013 | L9 1027-1176 | L10 1198-1293 |
// L11 1316-1465 | L12 TEASE 1484-1643 (the well hook).
// World: ONE palace courtyard. Throne + crown pedestal + gold ingot west;
// the wise man's tub, vessel and measuring jars east; a well at the far
// east edge (the next story). Crown and ingot TRAVEL to the vessel.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1661, DECK = 0;
export const SHOTS = [
  { id: 'gift', a: 0, b: 124, light: 'day' },
  { id: 'suspect', a: 125, b: 288, light: 'day' },
  { id: 'rule', a: 289, b: 409, light: 'day' },
  { id: 'think', a: 410, b: 521, light: 'day' },
  { id: 'bath', a: 522, b: 649, light: 'day' },
  { id: 'run', a: 650, b: 735, light: 'day' },
  { id: 'dipcrown', a: 736, b: 883, light: 'day' },
  { id: 'dipgold', a: 884, b: 1026, light: 'day' },
  { id: 'verdict', a: 1027, b: 1197, light: 'golden' },
  { id: 'caught', a: 1198, b: 1315, light: 'golden' },
  { id: 'explain', a: 1316, b: 1483, light: 'golden' },
  { id: 'hook', a: 1484, b: 1660, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  golden: { az: 100, el: 22, sky: '#d9b28c', ground: '#5c5a34', hemi: 1.16, sun: '#ffb763', sunI: 2.4, fog: '#e5cf9e', fogNear: 42, fogFar: 340,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.08, vig: 0.22, shadowExt: 18, aurora: 0, gain: '#ffedd6', ...WATER },
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
  if (S.id === 'verdict') return blendLight(LIGHTS.day, LIGHTS.golden, smooth(ramp(f, 1027, 1100)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const THRONE = [-5.5, 0, -2];
export const CROWN_PED = [-2.8, 1.24, -1.6];
export const GOLD_PED = [-4.2, 0.62, 0.8];
export const TUB = [3.4, 0, 1.8];
export const VESSEL = [2.6, 0, -1.8];
export const WELL = [8.6, 0, 2.6];

/** Crown position: pedestal -> carried -> dipped in the vessel -> back. */
export const crownAt = (f) => {
  if (f < 736) return [...CROWN_PED];
  if (f < 770) { const k = smooth(ramp(f, 736, 770)); return kf3([[0, CROWN_PED], [1, [0.2, 1.7, -0.2]]], k); }
  if (f < 800) { const k = smooth(ramp(f, 770, 800)); return kf3([[0, [0.2, 1.7, -0.2]], [1, [2.6, 1.85, -1.8]]], k); }
  if (f < 838) { const k = Math.sin(ramp(f, 800, 838) * Math.PI); return [2.6, 1.85 - 0.55 * k, -1.8]; } // the dip
  if (f < 884) { const k = smooth(ramp(f, 838, 884)); return kf3([[0, [2.6, 1.85, -1.8]], [1, CROWN_PED]], k); }
  return [...CROWN_PED];
};
/** The 1-kilo ingot: pedestal -> dipped (s8) -> back. */
export const goldAt = (f) => {
  if (f < 884) return [...GOLD_PED];
  if (f < 918) { const k = smooth(ramp(f, 884, 918)); return kf3([[0, GOLD_PED], [1, [2.6, 1.8, -1.8]]], k); }
  if (f < 956) { const k = Math.sin(ramp(f, 918, 956) * Math.PI); return [2.6, 1.8 - 0.55 * k, -1.8]; }
  if (f < 1002) { const k = smooth(ramp(f, 956, 1002)); return kf3([[0, [2.6, 1.8, -1.8]], [1, GOLD_PED]], k); }
  return [...GOLD_PED];
};

export const heroPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'gift': return [-3.4, 1.2, -0.6];
    case 'suspect': return [-3.0, 1.5, -1.6];
    case 'rule': return [-2.8, 1.4, -1.6];
    case 'think': return [1.8, 1.1, 0.6];
    case 'bath': return [TUB[0], 0.8, TUB[2]];
    case 'run': return [0.5, 1.0, 1.2];
    case 'dipcrown': case 'dipgold': return [2.6, 1.3, -1.8];
    case 'verdict': return [3.6, 1.0, -1.8];
    case 'caught': return [-3.4, 1.1, -0.4];
    case 'explain': return [2.8, 1.2, -1.6];
    case 'hook': return [WELL[0], 1.0, WELL[2]];
    default: return [0, 1, 0];
  }
};

// ---------- cameras ----------
const CAMS = {
  gift: [
    { f: 0, pos: [3.8, 3.0, 6.8], look: [-3.6, 1.0, -0.8], fov: 44 },
    { f: 124, pos: [1.8, 2.5, 5.2], look: [-3.8, 1.1, -0.9], fov: 42 },
  ],
  suspect: [
    { f: 125, pos: [1.8, 2.5, 5.2], look: [-3.8, 1.1, -0.9], fov: 42 },
    { f: 205, pos: [-0.4, 2.2, 3.9], look: [-2.9, 1.45, -1.6], fov: 40, ease: 'surge' },
    { f: 288, pos: [-0.7, 2.2, 4.1], look: [-2.9, 1.45, -1.6], fov: 40 },
  ],
  rule: [
    { f: 289, pos: [-0.7, 2.2, 4.1], look: [-2.9, 1.45, -1.6], fov: 40 },
    { f: 409, pos: [-0.9, 2.1, 4.3], look: [-2.85, 1.4, -1.6], fov: 39 },
  ],
  think: [
    { f: 410, pos: [-0.9, 2.1, 4.3], look: [-2.85, 1.4, -1.6], fov: 39 },
    { f: 470, pos: [3.4, 2.2, 5.0], look: [1.9, 1.05, 0.4], fov: 40, ease: 'surge' },
    { f: 521, pos: [3.6, 2.2, 5.2], look: [2.0, 1.05, 0.5], fov: 40 },
  ],
  bath: [
    { f: 522, pos: [3.6, 2.2, 5.2], look: [2.0, 1.05, 0.5], fov: 40 },
    { f: 580, pos: [4.6, 2.0, 5.4], look: [3.4, 0.7, 1.8], fov: 40, ease: 'surge' },
    { f: 649, pos: [4.4, 2.0, 5.6], look: [3.4, 0.75, 1.8], fov: 40 },
  ],
  run: [
    { f: 650, pos: [4.4, 2.0, 5.6], look: [3.4, 0.75, 1.8], fov: 40 },
    { f: 695, pos: [1.2, 2.1, 6.2], look: [-0.6, 1.0, 1.0], fov: 42, ease: 'surge' },
    { f: 735, pos: [0.4, 2.1, 6.0], look: [0.8, 1.1, -0.6], fov: 42 },
  ],
  dipcrown: [
    { f: 736, pos: [0.4, 2.1, 6.0], look: [0.8, 1.1, -0.6], fov: 42 },
    { f: 800, pos: [3.4, 2.3, 3.4], look: [2.6, 1.25, -1.8], fov: 40, ease: 'surge' },
    { f: 883, pos: [3.6, 2.3, 3.6], look: [2.6, 1.25, -1.8], fov: 40 },
  ],
  dipgold: [
    { f: 884, pos: [3.6, 2.3, 3.6], look: [2.6, 1.25, -1.8], fov: 40 },
    { f: 1026, pos: [3.8, 2.3, 3.8], look: [2.7, 1.25, -1.8], fov: 40 },
  ],
  verdict: [
    { f: 1027, pos: [3.8, 2.3, 3.8], look: [2.7, 1.25, -1.8], fov: 40 },
    { f: 1110, pos: [4.9, 2.1, 3.2], look: [4.05, 0.95, -1.8], fov: 40, ease: 'surge' },
    { f: 1197, pos: [5.1, 2.1, 3.4], look: [4.05, 0.95, -1.8], fov: 40 },
  ],
  caught: [
    { f: 1198, pos: [5.1, 2.1, 3.4], look: [4.05, 0.95, -1.8], fov: 40 },
    { f: 1255, pos: [-0.8, 2.3, 5.0], look: [-3.6, 1.05, -0.5], fov: 41, ease: 'surge' },
    { f: 1315, pos: [-1.0, 2.3, 5.2], look: [-3.6, 1.05, -0.5], fov: 41 },
  ],
  explain: [
    { f: 1316, pos: [-1.0, 2.3, 5.2], look: [-3.6, 1.05, -0.5], fov: 41 },
    { f: 1400, pos: [3.2, 2.4, 4.6], look: [2.8, 1.2, -1.7], fov: 41, ease: 'surge' },
    { f: 1483, pos: [3.4, 2.4, 4.8], look: [2.8, 1.2, -1.7], fov: 41 },
  ],
  hook: [
    { f: 1484, pos: [3.4, 2.4, 4.8], look: [2.8, 1.2, -1.7], fov: 41 },
    { f: 1560, pos: [5.6, 2.2, 5.6], look: [8.4, 0.9, 2.6], fov: 41, ease: 'surge' },
    { f: 1660, pos: [5.9, 2.1, 5.9], look: [8.55, 0.95, 2.6], fov: 40 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (S.id === 'suspect' || S.id === 'rule' || S.id === 'verdict') cinf = 4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardKilo: 0, boardVs: 0, boardMore: 0, bathK: 0, crownDip: 0, goldDip: 0, jarAK: 0, jarBK: 0, crownK: 0, wellK: 0 };
  switch (S.id) {
    case 'gift': W.boardKilo = smooth(ramp(f, 40, 75)); W.crownK = 0.5; break;
    case 'suspect': W.boardKilo = 1 - smooth(ramp(f, 125, 150)); W.crownK = 0.5 + 0.3 * Math.sin(f * 0.2); break;
    case 'rule': break;
    case 'think': break;
    case 'bath': W.bathK = smooth(ramp(f, 545, 575)); break;
    case 'run': W.bathK = 1; break;
    case 'dipcrown': W.bathK = 1; W.boardVs = smooth(ramp(f, 792, 815)); W.crownDip = f >= 800 && f <= 838 ? Math.sin(ramp(f, 800, 838) * Math.PI) : 0; W.jarAK = smooth(ramp(f, 812, 845)); break;
    case 'dipgold': W.bathK = 1; W.boardVs = 1; W.jarAK = 1; W.goldDip = f >= 918 && f <= 956 ? Math.sin(ramp(f, 918, 956) * Math.PI) : 0; W.jarBK = smooth(ramp(f, 930, 963)); break;
    case 'verdict': W.bathK = 1; W.jarAK = 1; W.jarBK = 1; W.boardMore = smooth(ramp(f, 1096, 1115)) * (1 - smooth(ramp(f, 1180, 1197))); break;
    case 'caught': W.bathK = 1; W.jarAK = 1; W.jarBK = 1; break;
    case 'explain': W.bathK = 1; W.jarAK = 1; W.jarBK = 1; break;
    case 'hook': W.bathK = 1; W.jarAK = 1; W.jarBK = 1; W.wellK = 0.6 + 0.4 * Math.sin(f * 0.3); break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.35, dustRate: 0.1, splashRate: S.id === 'bath' && f >= 545 && f <= 590 ? 14 : (S.id === 'dipcrown' && f >= 806 && f <= 832 ? 8 : (S.id === 'dipgold' && f >= 924 && f <= 950 ? 8 : 0)) };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', golden: '#ffd9a3' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  king: { jacket: '#7a1f2b', pants: '#3a2c22', boots: '#2e2118', hat: 'cap', cap: '#e8b53a', skin: '#c99067' },
  smith: { jacket: '#6a4a2e', pants: '#3c3226', boots: '#2e2a26', skin: '#8a5a3b' },
  wise: { jacket: '#e3ded2', pants: '#b8b0a0', boots: '#5a5148', hat: 'hair', hair: '#cfd0cc', skin: '#e8b98d' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const st = stand(T, tint, f);
  switch (S.id) {
    case 'gift': {
      out.push(st(OUTFITS.king, 'stern', 81, [-5.2, 0, -0.9], { yaw: 0.5, s: 1.05 }));
      out.push(RW(T, OUTFITS.smith, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 82), seed: 82, wave: q(0.5 + 0.5 * Math.sin(f * 0.3), 2) }, [-3.6, 0, 0.2], { tint, yaw: -0.4 }));
      break;
    }
    case 'suspect': {
      out.push(st(OUTFITS.king, 'stern', 81, [-4.6, 0, -0.6], { yaw: 0.45, s: 1.05 }));
      out.push(st(OUTFITS.smith, 'nervous', 82, [-3.4, 0, 0.6], { yaw: -0.5 }));
      break;
    }
    case 'rule': {
      out.push(st(OUTFITS.king, 'stern', 81, [-4.6, 0, -0.6], { yaw: 0.45, s: 1.05 }));
      out.push(st(OUTFITS.smith, 'nervous', 82, [-3.4, 0, 0.6], { yaw: -0.5 }));
      break;
    }
    case 'think': {
      out.push(RW(T, OUTFITS.wise, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 83), seed: 83, headTilt: q(Math.sin(f * 0.04) * 5, 1) }, [1.9, 0, 0.5], { tint, yaw: -0.3 }));
      out.push(st(OUTFITS.king, 'stern', 81, [-4.6, 0, -0.6], { yaw: 0.45, s: 1.05 }));
      break;
    }
    case 'bath': {
      const inK = smooth(ramp(f, 540, 560));
      out.push(RW(T, OUTFITS.wise, { expr: f > 560 ? 'laugh' : 'stern', mode: 'stand', blink: blinkAt(f, 83), seed: 83, wave: f > 560 ? q(0.5 + 0.5 * Math.sin(f * 0.5), 2) : 0 }, [TUB[0], -0.55 * inK, TUB[2]], { tint, yaw: -0.2, ground: 0 }));
      break;
    }
    case 'run': {
      const rp = kf3([[650, [3.0, 0, 1.6]], [695, [0.2, 0, 1.1]], [735, [-1.6, 0, 0.2]]], f);
      out.push(RW(T, OUTFITS.wise, { expr: 'laugh', mode: 'march', phase: q((f * 0.09) % 1, 2), blink: blinkAt(f, 83), seed: 83, wave: 1 }, rp, { tint, yaw: -1.2 }));
      break;
    }
    case 'dipcrown': case 'dipgold': {
      out.push(RW(T, OUTFITS.wise, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 83), seed: 83, wave: q(0.5 + 0.5 * Math.sin(f * 0.35), 2) }, [1.5, 0, -0.7], { tint, yaw: 0.55 }));
      out.push(st(OUTFITS.king, 'stern', 81, [-0.6, 0, 0.9], { yaw: 0.9, s: 1.05 }));
      break;
    }
    case 'verdict': {
      out.push(st(OUTFITS.wise, 'grin', 83, [2.9, 0, -0.5], { yaw: 0.5 }));
      out.push(st(OUTFITS.smith, 'nervous', 82, [5.7, 0, -0.6], { yaw: -0.5 }));
      out.push(st(OUTFITS.king, 'stern', 81, [-0.6, 0, 0.9], { yaw: 0.9, s: 1.05 }));
      break;
    }
    case 'caught': {
      out.push(st(OUTFITS.smith, 'pained', 82, [-3.4, 0, 0.4], { yaw: -0.3 }));
      out.push(st(OUTFITS.king, 'stern', 81, [-4.8, 0, -0.7], { yaw: 0.5, s: 1.05 }));
      out.push(st(OUTFITS.wise, 'grin', 83, [-1.8, 0, 0.8], { yaw: 0.7 }));
      break;
    }
    case 'explain': {
      out.push(RW(T, OUTFITS.wise, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 83), seed: 83, wave: q(0.5 + 0.5 * Math.sin(f * 0.3), 2) }, [1.7, 0, -0.6], { tint, yaw: 0.5 }));
      out.push(st(OUTFITS.king, 'smile', 81, [-0.4, 0, 0.9], { yaw: 0.85, s: 1.05 }));
      break;
    }
    case 'hook': {
      out.push(st(OUTFITS.wise, 'smile', 83, [5.4, 0, 1.4], { yaw: 0.8 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
