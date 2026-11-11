// Shot plan for "Togo — The Real Hero of Nome" — timed to togo-voice
// (49.45 s, 30 fps, TOTAL 1484). True story: Nome, Alaska, 1925 serum run.
// Phrases: P1 0-149 hook (Balto) | P2 183-308 Togo intro | P3 345-548 serum+map |
// P4 577-767 relay (20 teams, Togo 261 mi) | P5 767-921 Norton Sound ice |
// P6 948-1062 Seppala blind | P7 1094-1154 instinct whiteout |
// P8 1184-1306 handoff+sleep | P9 1339-1460 statue/finale. SHOTS contiguous (gaps hold tails).
// World (built in main.js): snow town — hospital cabin (-4.5,0,-7.6), door spot (-4.5,0,-5.2),
// brazier (1.5,0,-3.5), BALTO! sign (-2,0,-2.6), map board (12,0,0) facing -x,
// trail corridor x~=2 running z +26 -> -2, hero team staging: lead z 6.2/6.6, dogs 7.6/8.7,
// sled prop z 9.9, musher z 11.4. 261 MILES sign (4.9,0,7.6) facing -z.
// Statue park (-11,0,6), pedestal top y 0.97; finale board (-10.5,0,7.2).
// Ice plain + crack planes live in main.js, driven by worldAt iceK/crackK.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30, TOTAL = 1484, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 182, light: 'night' },
  { id: 'togo', a: 183, b: 344, light: 'night' },
  { id: 'serum', a: 345, b: 576, light: 'night' },
  { id: 'relay', a: 577, b: 766, light: 'grey' },
  { id: 'sound', a: 767, b: 947, light: 'nightlow' },
  { id: 'blind', a: 948, b: 1093, light: 'nightlow' },
  { id: 'instinct', a: 1094, b: 1183, light: 'nightlow' },
  { id: 'handoff', a: 1184, b: 1338, light: 'night' },
  { id: 'finale', a: 1339, b: 1483, light: 'day' },
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
  white: { az: 215, el: 30, sky: '#e8edf2', ground: '#c9d2da', hemi: 1.25, sun: '#ffffff', sunI: 0.7, fog: '#eef2f6', fogNear: 3, fogFar: 30,
    skyTop: '#dfe7ee', skyHor: '#f4f7fa', sunDisc: '#ffffff', sunSize: 0.002, sat: 0.92, vig: 0.18, shadowExt: 15, aurora: 0, ...WATER },
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
  if (S.id === 'handoff') return blendLight(LIGHTS.night, LIGHTS.dawn, smooth(ramp(f, 1210, 1306)));
  if (S.id === 'instinct') return blendLight(LIGHTS.nightlow, LIGHTS.white, smooth(ramp(f, 1094, 1128)));
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
export const DOOR = [-4.5, 0, -5.2];            // hospital door spot
export const TOGO_FRONT = [2, 0, 6.6];         // intro: lead-dog mark
export const TEAM_Z = { lead: 6.2, dog2: 7.6, dog3: 8.7, sled: 9.9, musher: 11.4 };
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
// Balto's hook trot: trail head -> down the street, past the brazier (travel -z)
export const baltoHookPos = (f) => kf3([[0, [3.4, 0, 3.8]], [70, [2.4, 0, -0.6], 'easeInOut'], [130, [1.7, 0, -3.4], 'easeInOut'], [182, [1.5, 0, -4.6]]], f);

// ---------- relay: 20 teams mustered in countable rows on the plain ----------
export const TEAM_COUNT = 20;
export const relayLayout = (f) => {
  const out = [];
  for (let i = 0; i < TEAM_COUNT; i++) {
    const col = i % 5, row = (i / 5) | 0;
    const x = -4.4 + col * 4.4 + ((i * 7) % 3 - 1) * 0.3;
    let z = 4.0 + row * 5.6;
    if (i === 2) z -= 2.6 * ramp(f, 700, 766); // one team launches as the dive lands
    out.push({ x, z, ry: ((i * 13) % 5 - 2) * 0.05, bob: Math.abs(Math.sin(f * 0.3 + i * 1.7)) * 0.03 });
  }
  return out;
};

// ---------- trail scroll (metres travelled by the hero team) ----------
export const scrollAt = (f) => kf([[0, 0], [766, 0], [820, 1.5], [947, 6.5], [1093, 10], [1183, 13], [1483, 13.2]], f);

// ---------- hero sled prop ----------
export const heroSledAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'hook') { const p = baltoHookPos(f); return { x: p[0] + 0.1, z: p[2] + 4.0, ry: 0, bob: 0 }; }
  if (S.id === 'togo') return { x: 2.55, z: TEAM_Z.sled, ry: 0, bob: 0 };
  if (S.id === 'relay') return f >= 690 ? { x: 2.55, z: TEAM_Z.sled, ry: 0, bob: 0 } : null;
  if (S.id === 'sound' || S.id === 'instinct') return { x: 2.55, z: TEAM_Z.sled, ry: 0, bob: Math.abs(Math.sin(f * 0.55)) * 0.018 };
  if (S.id === 'blind') return { x: 2.55, z: 10.3, ry: 0, bob: Math.abs(Math.sin(f * 0.5)) * 0.015 };
  if (S.id === 'handoff') return { x: 2.3, z: 3.5, ry: 0.85, bob: 0 };
  return null;
};
export const heroPosAt = (f) => { // hero card position (sweep + reference): Togo, Balto in the hook
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return baltoHookPos(f);
    case 'togo': return [...TOGO_FRONT];
    case 'relay': return f >= 690 ? [2.1, 0, TEAM_Z.lead] : null;
    case 'sound': case 'instinct': return [2.1, 0, TEAM_Z.lead];
    case 'blind': return [2.3, 0, 7.4];
    case 'handoff': return [1.3, 0, 3.1];
    case 'finale': return [-11.2, 0, 8.8];
    default: return null;
  }
};

// ---------- cameras (ONE continuous flight; dips only at serum/relay/finale) ----------
const CAMS = {
  hook: [
    { f: 0, pos: [-1.6, 2.2, 7.6], look: [3.2, 0.9, 3.4], fov: 44 },
    { f: 70, pos: [-0.7, 1.7, 3.2], look: [2.4, 0.85, -0.6], fov: 41, ease: 'surge' },
    { f: 130, pos: [3.6, 1.5, 1.8], look: [0.2, 0.9, -3.2], fov: 40, ease: 'surge' },
    { f: 182, pos: [2.0, 0.98, 3.6], look: [2.0, 0.85, 7.5], fov: 38, ease: 'surge' },
  ],
  togo: [
    { f: 183, pos: [2.0, 0.98, 3.6], look: [2.0, 0.85, 7.5], fov: 38 },
    { f: 260, pos: [2.0, 1.0, 4.1], look: [2.02, 0.8, 6.7], fov: 37, ease: 'surge' },
    { f: 344, pos: [2.0, 0.94, 4.9], look: [2.05, 0.72, 6.6], fov: 35.5, ease: 'surge' },
  ],
  serum: [
    { f: 345, pos: [-0.6, 2.0, 3.4], look: [-4.2, 1.15, -6.2], fov: 44 },
    { f: 430, pos: [-2.9, 1.6, -1.4], look: [-4.45, 1.32, -5.25], fov: 39, ease: 'surge' },
    { f: 475, pos: [-3.85, 1.44, -3.15], look: [-4.42, 1.28, -5.2], fov: 36.5, ease: 'surge' },
    { f: 560, pos: [1.2, 2.5, 0.9], look: [11.7, 2.1, -0.3], fov: 42, ease: 'surge' },
    { f: 576, pos: [1.9, 2.45, 0.7], look: [11.7, 2.15, -0.3], fov: 41.5 },
  ],
  relay: [
    { f: 577, pos: [-10, 27, 42], look: [4.4, 0, 12], fov: 47 },
    { f: 620, pos: [-9.6, 25.8, 40.5], look: [4.4, 0, 12], fov: 46, ease: 'surge' },
    { f: 693, pos: [-4.5, 13, 21], look: [3.8, 0.3, 9.8], fov: 44, ease: 'surge' },
    { f: 766, pos: [0.4, 1.9, 2.2], look: [2.7, 0.85, 7.0], fov: 42, ease: 'surge' },
  ],
  sound: [
    { f: 767, pos: [0.6, 0.72, 3.3], look: [2.2, 0.62, 6.9], fov: 41 },
    { f: 860, pos: [0.8, 0.68, 3.7], look: [2.25, 0.6, 7.1], fov: 40.5, ease: 'surge' },
    { f: 947, pos: [0.95, 0.66, 3.95], look: [2.25, 0.6, 7.2], fov: 40 },
  ],
  blind: [
    { f: 948, pos: [1.9, 1.0, 3.2], look: [2.35, 0.95, 8.8], fov: 41 },
    { f: 1000, pos: [2.0, 1.12, 5.4], look: [2.45, 1.25, 10.4], fov: 39, ease: 'surge' },
    { f: 1062, pos: [2.1, 1.35, 8.2], look: [2.55, 1.5, 11.4], fov: 36, ease: 'surge' },
    { f: 1093, pos: [2.15, 1.42, 8.85], look: [2.55, 1.55, 11.4], fov: 35 },
  ],
  instinct: [
    { f: 1094, pos: [1.05, 0.75, 3.05], look: [2.25, 0.7, 7.3], fov: 41 },
    { f: 1150, pos: [0.92, 0.66, 3.3], look: [2.2, 0.55, 6.6], fov: 40, ease: 'surge' },
    { f: 1183, pos: [0.85, 0.62, 3.2], look: [2.2, 0.5, 6.5], fov: 39.5 },
  ],
  handoff: [
    { f: 1184, pos: [-1.6, 1.7, 7.8], look: [1.6, 0.8, 1.4], fov: 44 },
    { f: 1270, pos: [-1.2, 1.6, 6.8], look: [1.7, 0.82, 1.3], fov: 41, ease: 'surge' },
    { f: 1338, pos: [-0.85, 1.52, 6.15], look: [1.9, 0.8, 1.2], fov: 39.5 },
  ],
  finale: [
    { f: 1339, pos: [-11, 1.8, 13.4], look: [-11, 1.75, 6], fov: 42 },
    { f: 1400, pos: [-10.9, 1.62, 12.4], look: [-11.1, 1.45, 6.6], fov: 40, ease: 'surge' },
    { f: 1483, pos: [-10.6, 1.45, 11.8], look: [-11.3, 1.0, 7.9], fov: 37.5, ease: 'surge' },
  ],
};
const SHADOW_AT = { hook: [1.5, 0.7, -2], togo: [2, 0.6, 7.5], serum: [-4.4, 1, -5.4], relay: [0, 0, 0], sound: [2, 0.5, 7], blind: [2.4, 0.8, 10], instinct: [2, 0.5, 7], handoff: [1.2, 0.7, 1.5], finale: [-11, 1, 6] };
const BRIDGES = { sound: 18, blind: 18, instinct: 44, handoff: 36 }; // serum/relay/finale enter through dips (location changes)
const DIPS = [345, 577, 1339];
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
  if (S.id === 'sound' || S.id === 'blind' || S.id === 'instinct') { // wind buffet: tiny deterministic shake
    const amp = S.id === 'sound' ? 0.012 : 0.008;
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
    case 'hook': point = [2.2, 0.85, -0.5]; cinf = 10; break;
    case 'togo': point = [2, 0.8, 6.6]; cinf = 9; break;
    case 'serum': point = f < 475 ? [-4.42, 1.3, -5.2] : [11.7, 2.1, -0.3]; cinf = f < 475 ? 12 : 5; break;
    case 'relay': point = f < 660 ? [4.4, 0, 12] : [2.1, 0.7, 6.2]; cinf = f < 660 ? 3 : 6; break;
    case 'sound': point = [2.2, 0.6, 6.8]; cinf = 8; break;
    case 'blind': point = [2.55, 1.4, 11.5]; cinf = 7; break;
    case 'instinct': point = [2.15, 0.5, 6.2]; cinf = 8; break;
    case 'handoff': point = [2.2, 0.85, 1.3]; cinf = 6; break;
    case 'finale': point = f < 1400 ? [-11, 2.25, 6] : [-11.2, 1.0, 8.2]; cinf = 8; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state (drives set pieces + FX in main.js worldState) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lanternSet: [], mist: 0.1, snowK: 0.5, windK: 0.6, scentK: 0, mapT: 0, starK: 0.9, winGlow: 0.8, statueGlint: 0, bottleK: 0, bottleGlint: 0, iceK: 0, crackK: 0 };
  switch (S.id) {
    case 'hook': W.lanternSet = [0, 2]; W.mist = 0.25; W.snowK = 0.55; W.starK = 1; W.winGlow = 1; break;
    case 'togo': W.lanternSet = [0, 1]; W.mist = 0.3; W.snowK = 0.55; W.windK = 0.7; W.winGlow = 0.8; break;
    case 'serum':
      W.lanternSet = f < 475 ? [2] : [3]; W.mist = 0.2; W.snowK = 0.5; W.winGlow = 1;
      W.mapT = f < 475 ? 0 : M.easeInOut(ramp(f, 478, 565)); break;
    case 'relay': W.mist = 0.35; W.snowK = 0.7; W.windK = 1.2; W.starK = 0.5; W.winGlow = 0.5; W.mapT = 1; break;
    case 'sound':
      W.mist = 0.9; W.snowK = 1.0; W.windK = 3.0; W.starK = 0.2; W.winGlow = 0.35; W.mapT = 1;
      W.iceK = 1; W.crackK = clamp(ramp(f, 795, 925)); break;
    case 'blind':
      W.mist = 0.85; W.snowK = 0.95; W.windK = 2.8; W.starK = 0.25; W.winGlow = 0.4; W.mapT = 1;
      W.iceK = 1; W.crackK = 1; break;
    case 'instinct':
      W.mist = 1; W.snowK = 1.0; W.windK = 2.4; W.starK = 0; W.winGlow = 0.3; W.mapT = 1;
      W.iceK = 1; W.crackK = 1; W.scentK = smooth(ramp(f, 1110, 1165)); break;
    case 'handoff': W.lanternSet = [0, 1, 2]; W.mist = 0.15; W.snowK = 0.35; W.windK = 0.4; W.starK = 0; W.winGlow = 0.9; W.mapT = 1; break;
    case 'finale':
      W.lanternSet = [4]; W.mist = 0.05; W.snowK = 0.3; W.windK = 0.3; W.starK = 0; W.winGlow = 0.35; W.mapT = 1;
      W.statueGlint = 0.95 * smooth(ramp(f, 1425, 1462)); break;
  }
  return W;
};
/** Brazier/chimney profile per frame (pure — main.js steps the FX sim with this). */
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { fireRate: 20, fireScale: 0.95, smokeRate: 2.2 };
    case 'togo': return { fireRate: 14, fireScale: 0.8, smokeRate: 2.2 };
    case 'serum': return { fireRate: 10, fireScale: 0.7, smokeRate: 2.0 };
    case 'relay': return { fireRate: 0, fireScale: 0.5, smokeRate: 3.0 };
    case 'sound': return { fireRate: 3, fireScale: 0.5, smokeRate: 4.5 };
    case 'blind': return { fireRate: 3, fireScale: 0.5, smokeRate: 4.2 };
    case 'instinct': return { fireRate: 5, fireScale: 0.55, smokeRate: 3.5 };
    case 'handoff': return { fireRate: 22, fireScale: 1.0, smokeRate: 2.4 };
    case 'finale': return { fireRate: 0, fireScale: 0.5, smokeRate: 1.2 };
    default: return { fireRate: 10, fireScale: 0.7, smokeRate: 2.2 };
  }
};

// ---------- actors (2D cards) ----------
const DOCTOR = { tunic: '#39424e', skin: '#f5c9a0', hair: '#2b211c', shirt: '#eef0ea', moustache: '#241a14' };
const ELDER = { tunic: '#5d4a38', skin: '#ecd0b6', hair: '#e8e2d4', beard: '#e8e2d4', brows: '#e8e2d4', stout: true };
const KID = { tunic: '#b8524a', skin: '#f5c9a0', hair: '#3b2a20' };
const SEPPALA_PARKA = '#43302a';   // dark-brown heavy parka (musherFront IS the fur-parka system)
const NEXT_PARKA = '#2e4a4a';      // next musher: teal parka
const R = (T, who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'obj') + JSON.stringify(o) + JSON.stringify(who), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RM = (T, o, pos, extra = {}) => ({ key: 'musher' + JSON.stringify(o), draw: (p) => T.musherFront(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RD = (T, o, pos, extra = {}) => ({ key: 'balto' + JSON.stringify(o), draw: (p) => T.baltoCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RT = (T, o, pos, extra = {}) => ({ key: 'togo' + JSON.stringify(o), draw: (p) => T.togoCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { night: '#c3d2ff', nightlow: '#aebfff', grey: '#c9d4ea', dawn: '#ffe9c4', day: '#ffffff' };
const tintFor = (S, f) => S.id === 'handoff' ? (f < 1240 ? TINT.night : TINT.dawn) : S.id === 'instinct' ? '#ffffff' : (TINT[S.light] || '#ffffff');
// Togo's team mates (generic huskies via the Balto painter, recoloured)
const teamDogs = (T, f, tint, phMul, leadZ = TEAM_Z) => {
  const bobY = Math.abs(Math.sin(f * 0.55)) * 0.025;
  return [
    RD(T, { furC: '#4a4d55', step: q((f * phMul + 0.33) % 1, 2) }, [1.65, bobY * 0.8, leadZ.dog2], { tint, s: 0.58, yaw: 0.15 }),
    RD(T, { furC: '#33261e', markC: '#d8cfc0', step: q((f * phMul + 0.66) % 1, 2) }, [2.5, bobY * 0.8, leadZ.dog3], { tint, s: 0.58, yaw: -0.15 }),
  ];
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S, f);
  switch (S.id) {
    case 'hook': {
      // the famous Balto team trots in past the brazier; the town admires
      const bp = baltoHookPos(f), ph = q((f * 0.06) % 1, 2), bobY = Math.abs(Math.sin(f * 0.55)) * 0.025;
      out.push(RD(T, { step: ph, pant: 1 }, [bp[0], bobY, bp[2]], { tint, s: 0.8 }));
      out.push(RD(T, { furC: '#4a4d55', step: q((f * 0.06 + 0.33) % 1, 2) }, [bp[0] - 0.45, bobY * 0.8, bp[2] + 1.4], { tint, s: 0.58, yaw: 0.15 }));
      out.push(RD(T, { furC: '#33261e', markC: '#d8cfc0', step: q((f * 0.06 + 0.66) % 1, 2) }, [bp[0] + 0.4, bobY * 0.8, bp[2] + 2.7], { tint, s: 0.58, yaw: -0.15 }));
      out.push(RM(T, { expr: 'stern', L: 'hold', R: 'hold', blink: blinkAt(f, 5), bob: q(breath(f, 5), 3) },
        [bp[0] + 0.15, 0.14, bp[2] + 5.4], { tint, s: 0.98, ground: 0.14 }));
      out.push(R(T, 'civB', { seed: 14, expr: 'grin', L: 'belly', R: 'point', blink: blinkAt(f, 14), bob: q(breath(f, 14), 3), headTilt: -3 },
        [0.6, 0, -6.2], { tint, s: 0.94 }));
      out.push(R(T, 'civA', { seed: 17, expr: 'grin', L: 'up', R: 'up', blink: blinkAt(f, 17), bob: q(breath(f, 17), 3) },
        [-0.7, 0, -5.3], { tint, s: 0.97 }));
      out.push(R(T, KID, { seed: 23, expr: 'grin', L: 'hang', R: 'wave', wv: q(f * 0.45, 1), blink: blinkAt(f, 23), bob: q(Math.abs(Math.sin(f * 0.3)) * 0.012, 3) },
        [1.3, 0, -5.7], { tint, s: 0.62 }));
      break;
    }
    case 'togo': {
      // Togo staged on the trail: smaller, darker lead; Seppala in the heavy parka behind
      const pant = f > 262 ? 1 : 0; // "fearless" push-in lands as he starts to pant, steady
      out.push(RT(T, { view: 'front', pant }, [TOGO_FRONT[0], breath(f, 3) * 0.5, TOGO_FRONT[2]],
        { tint, s: 0.70, roll: kf([[183, 0], [250, -0.015], [344, 0]], f) }));
      out.push(RD(T, { furC: '#4a4d55' }, [1.5, 0, 7.9], { tint, s: 0.56, yaw: 0.5 }));
      out.push(RD(T, { furC: '#33261e', markC: '#d8cfc0' }, [2.55, 0, 8.9], { tint, s: 0.56, yaw: -0.4 }));
      out.push(RM(T, { expr: 'stern', L: 'hang', R: 'hang', parka: SEPPALA_PARKA, blink: blinkAt(f, 5), bob: q(breath(f, 5), 3), headTilt: 2 },
        [2.55, 0.14, TEAM_Z.musher], { tint, s: 0.98, ground: 0.14 }));
      break;
    }
    case 'serum': {
      if (f < 475) { // hospital cabin: the children are sick, the serum is far away
        out.push(R(T, DOCTOR, { seed: 41, expr: 'nervous', L: 'hang', R: 'reach', lift: 0.3, blink: blinkAt(f, 21), bob: q(breath(f, 21), 3),
          headTilt: q(kf([[345, 3], [410, -3], [475, 2]], f), 1), tilt: 1 },
          [...DOOR], { tint, s: 1.0 }));
        out.push(R(T, 'civB', { seed: 14, expr: 'nervous', L: 'belly', R: 'belly', blink: blinkAt(f, 14), bob: q(breath(f, 14), 3), headTilt: 4 },
          [-3.2, 0, -4.7], { tint, s: 0.94 }));
        out.push(R(T, KID, { seed: 23, expr: 'nervous', L: 'hang', R: 'hang', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3), headTilt: -2 },
          [-5.8, 0, -4.4], { tint, s: 0.6 }));
      } else { // the map board: the 674-mile route draws itself, LONG across the board
        out.push(R(T, DOCTOR, { seed: 41, expr: 'stern', L: 'hang', R: 'point', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), headTilt: -2 },
          [10.7, 0, 0.9], { tint, s: 1.0, yaw: -0.55 }));
        out.push(R(T, ELDER, { seed: 8, expr: 'nervous', L: 'belly', R: 'belly', blink: blinkAt(f, 8), bob: q(breath(f, 8), 3), headTilt: 3 },
          [10.35, 0, 1.9], { tint, s: 0.97, yaw: -0.4 }));
      }
      break;
    }
    case 'relay': {
      if (f >= 690) { // the dive lands on Togo's team + the 261 MILES sign
        out.push(RT(T, { step: 0, pant: 1 }, [2.1, 0, TEAM_Z.lead], { tint, s: 0.68 }));
        out.push(...teamDogs(T, f, tint, 0));
        out.push(RM(T, { expr: 'stern', L: 'hold', R: 'hold', parka: SEPPALA_PARKA, blink: blinkAt(f, 5), bob: q(breath(f, 5), 3) },
          [2.55, 0.14, TEAM_Z.musher], { tint, s: 0.95, ground: 0.14 }));
      }
      break; // before the dive: drone only — the 20 teams are 3D props (relayLayout)
    }
    case 'sound': {
      // Norton Sound: slow, careful crossing at action level, cracks growing under them
      const ph = q((f * 0.04) % 1, 2), bobY = Math.abs(Math.sin(f * 0.42)) * 0.022;
      out.push(RT(T, { step: ph, headDown: 0.12, pant: 1 }, [2.1, bobY, TEAM_Z.lead], { tint, s: 0.66 }));
      out.push(...teamDogs(T, f, tint, 0.04));
      out.push(RM(T, { expr: 'nervous', L: 'hold', R: 'hold', parka: SEPPALA_PARKA, frost: q(ramp(f, 800, 900) * 0.35, 2), blink: blinkAt(f, 5), bob: q(breath(f, 5), 3), headTilt: 3 },
        [2.55, 0.14, TEAM_Z.musher], { tint, s: 0.98, ground: 0.14 }));
      break;
    }
    case 'blind': {
      // the push passes Togo (he looks BACK at Seppala) and lands close on the blinded musher
      const ph = q((f * 0.035) % 1, 2), bobY = Math.abs(Math.sin(f * 0.4)) * 0.02;
      const hb = q(kf([[948, 0], [985, 0], [1018, 1], [1062, 1], [1093, 0.55]], f), 2);
      out.push(RT(T, { step: ph, headDown: 0.1, headBack: hb, pant: 1 }, [2.3, bobY, 7.4], { tint, s: 0.66 }));
      out.push(RD(T, { furC: '#4a4d55', step: q((f * 0.035 + 0.33) % 1, 2) }, [1.85, bobY * 0.8, 8.6], { tint, s: 0.58, yaw: 0.15 }));
      out.push(RD(T, { furC: '#33261e', markC: '#d8cfc0', step: q((f * 0.035 + 0.66) % 1, 2) }, [2.65, bobY * 0.8, 9.5], { tint, s: 0.58, yaw: -0.15 }));
      const reach = f >= 1005 && f < 1075; // mitten raised to the frozen eyes, then lowered
      out.push(RM(T, { expr: 'pained', L: 'hold', R: reach ? 'reach' : 'hold', parka: SEPPALA_PARKA,
        frost: q(ramp(f, 955, 1035), 2), blink: 1, bob: q(breath(f, 5), 3),
        headTilt: q(kf([[948, 3], [1010, 6], [1062, 9], [1093, 7]], f), 1) },
        [2.55, 0.14, 11.6], { tint, s: 0.98, ground: 0.14 }));
      break;
    }
    case 'instinct': {
      // whiteout: Togo's dark silhouette leads by scent, nose forward, team on his line
      const ph = q((f * 0.038) % 1, 2), bobY = Math.abs(Math.sin(f * 0.4)) * 0.02;
      const hd = kf([[1094, 0.3], [1140, 0.55], [1183, 0.45]], f);
      out.push(RT(T, { step: ph, headDown: q(hd, 2), pant: 1 }, [2.1, bobY, TEAM_Z.lead], { tint, s: 0.68 }));
      out.push(...teamDogs(T, f, tint, 0.038));
      out.push(RM(T, { expr: 'stern', L: 'hold', R: 'hold', parka: SEPPALA_PARKA, frost: 0.85, blink: 1, bob: q(breath(f, 5), 3), headTilt: 4 },
        [2.55, 0.14, TEAM_Z.musher], { tint, s: 0.98, ground: 0.14 }));
      break;
    }
    case 'handoff': {
      // the relay station: Seppala passes the serum crate on, Togo rests, Balto launches
      const passed = f >= 1252;
      out.push(RM(T, { expr: 'relief', L: 'hold', R: 'hold', parka: SEPPALA_PARKA, carryBox: !passed, blink: blinkAt(f, 5), bob: q(breath(f, 5), 3) },
        [1.7, 0, 1.6], { tint, s: 0.98 }));
      out.push(RM(T, { expr: 'stern', L: 'hang', R: passed ? 'hold' : 'reach', parka: NEXT_PARKA, carryBox: passed, blink: blinkAt(f, 9), bob: q(breath(f, 9), 3) },
        [0.0, 0, 3.4], { tint, s: 0.98 }));
      if (!passed) out.push(RT(T, { view: 'front', pant: 1 }, [1.3, breath(f, 3) * 0.5, 3.1], { tint, s: 0.72 }));
      else out.push(RT(T, { lying: true }, [1.3, 0, 3.1], { tint, s: 0.72 })); // curled asleep in the foreground, spent
      if (f >= 1268) { // Balto's fresh team launches past into the brightening street
        const bp = kf3([[1268, [5.2, 0, 5.6]], [1306, [3.4, 0, 2.6], 'easeInOut'], [1338, [1.2, 0, -0.6]]], f);
        const ph2 = q((f * 0.09) % 1, 2), bobY = Math.abs(Math.sin(f * 0.6)) * 0.03;
        out.push(RD(T, { step: ph2, pant: 1 }, [bp[0], bobY, bp[2]], { tint, s: 0.8 }));
        out.push(RD(T, { furC: '#4a4d55', step: q((f * 0.09 + 0.33) % 1, 2) }, [bp[0] + 0.5, bobY * 0.8, bp[2] + 1.3], { tint, s: 0.58, yaw: -0.15 }));
      }
      break;
    }
    case 'finale': {
      out.push(RD(T, { view: 'front', statue: 1 }, [-11, 0.97, 6], { tint, s: 1.02, ground: 0.99, blob: true })); // Balto's statue
      out.push(RT(T, { view: 'front', pant: 0 }, [-11.2, breath(f, 3) * 0.5, 8.8], { tint, s: 0.62 })); // Togo, alive, in front of it
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'serum' && f < 475) {
    // Zzz over the hospital: the sick children sleep inside
    const t = q(((f / 46) + 0.37) % 1, 2);
    out.push(FXC('zh_' + t, (p) => T.fxZ(p, t), [-5.9, 1.85, -5.6], 0.4));
  }
  if (S.id === 'sound') {
    // creak accents exactly as each crack step lands (crackK fifths at ~f821/847/873/899/912)
    for (const s0 of [808, 834, 860, 886, 912]) {
      if (f >= s0 && f < s0 + 16) { const t = q((f - s0) / 16, 2); out.push(FXC('creak_' + s0 + '_' + t, (p) => T.fxCreak(p, t), [3.3, 0.05, 4.9], 0.55)); }
    }
  }
  if (S.id === 'handoff' && f >= 1262) {
    // Zzz over the sleeping Togo
    const t = q(((f / 46) + 0.37) % 1, 2);
    out.push(FXC('zs_' + t, (p) => T.fxZ(p, t), [2.0, 1.15, 3.0], 0.38));
  }
  if (S.id === 'handoff' && f >= 1268 && f <= 1296) {
    const t = q((f - 1268) / 28, 2);
    out.push(FXC('burst_' + t, (p) => T.fxBurst(p, t, '#ffe9a8', 10, 30, 210), [4.4, 1.1, 5.0], 0.85));
  }
  return out;
};
