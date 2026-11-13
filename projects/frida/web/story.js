// Shot plan for "Frida — The Dog Who Found People in the Rubble" — timed to
// frida-voice (54.35 s, 30 fps, TOTAL 1630). Mexico City, Sept 2017: the yellow
// Labrador of the Mexican Navy rescue unit who crawled the rubble in goggles
// and boots and helped find more than fifty people.
// Phrases: P1 0-129 | P2 159-277 | P3 305-452 | P4 481-575 | P5 604-703 |
// P6 727-838 | P7 860-974 | P8 1006-1090 | P9 1111-1202 | P10 1228-1333 |
// P11 1366-1485 | P12 1518-1607 | P13 TEASE 1637-1799 (+tail to 1822):
// the spoken Capitán hook — statue at dusk, slow push-in as the question lands.
// Sections tile 0..1629 contiguously; inter-phrase gaps belong to the outgoing
// section. ONE set (street + collapsed building + rubble field at origin),
// ONE continuous camera flight: every section's first key == previous last key.
// Raised-surface law: hero slab top = 0.35, statue plinth top = 0.44 — both
// < 0.5 so the koko blob rule (a.y < 0.5) still draws the contact shadow, and
// the actor's y AND ground both sit at the surface height.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1823, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 158, light: 'dust' },
  { id: 'intro', a: 159, b: 304, light: 'dust' },
  { id: 'quake', a: 305, b: 480, light: 'day' },
  { id: 'sentin', a: 481, b: 603, light: 'day' },
  { id: 'gear', a: 604, b: 726, light: 'warm' },
  { id: 'crawl', a: 727, b: 859, light: 'warm' },
  { id: 'barkdig', a: 860, b: 1005, light: 'warm' },
  { id: 'fifty', a: 1006, b: 1110, light: 'golden' },
  { id: 'photos', a: 1111, b: 1227, light: 'day' },
  { id: 'retire', a: 1228, b: 1365, light: 'golden' },
  { id: 'mourn', a: 1366, b: 1517, light: 'cool' },
  { id: 'finale', a: 1518, b: 1636, light: 'golden' },
  { id: 'tease', a: 1637, b: 1822, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  dust: { az: 122, el: 38, sky: '#c2b49a', ground: '#6a5c48', hemi: 1.14, sun: '#ffe3b0', sunI: 2.1, fog: '#d8c8a8', fogNear: 40, fogFar: 320,
    skyTop: '#7d90b4', skyHor: '#efe0bc', sunDisc: '#fff3cf', sunSize: 0.003, sat: 1.03, vig: 0.24, shadowExt: 16, aurora: 0, gain: '#ffffff', ...WATER },
  day: { az: 128, el: 42, sky: '#b8c4d4', ground: '#5f5a4c', hemi: 1.18, sun: '#fff1d6', sunI: 2.15, fog: '#cfc8b4', fogNear: 44, fogFar: 350,
    skyTop: '#6f97cc', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.04, vig: 0.2, shadowExt: 16, aurora: 0, gain: '#ffffff', ...WATER },
  warm: { az: 112, el: 30, sky: '#c9bda2', ground: '#63543c', hemi: 1.14, sun: '#ffd9a0', sunI: 2.3, fog: '#ddd0a4', fogNear: 40, fogFar: 330,
    skyTop: '#7d90c2', skyHor: '#ffce96', sunDisc: '#ffe9bd', sunSize: 0.0032, sat: 1.06, vig: 0.23, shadowExt: 16, aurora: 0, gain: '#ffffff', ...WATER },
  cool: { az: 140, el: 26, sky: '#93a7c4', ground: '#4c4c44', hemi: 1.0, sun: '#cfd9e8', sunI: 1.55, fog: '#aeb8bc', fogNear: 36, fogFar: 300,
    skyTop: '#5d7595', skyHor: '#c3ced4', sunDisc: '#e8eef2', sunSize: 0.0026, sat: 0.9, vig: 0.3, shadowExt: 16, aurora: 0, gain: '#e8eef8', ...WATER },
  golden: { az: 95, el: 18, sky: '#d9b28c', ground: '#6a5a2c', hemi: 1.15, sun: '#ffb763', sunI: 2.5, fog: '#e5bd85', fogNear: 38, fogFar: 320,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.09, vig: 0.25, shadowExt: 16, aurora: 0, gain: '#ffedd6', ...WATER },
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
  if (S.id === 'tease') return blendLight(LIGHTS.golden, LIGHTS.cool, 0.38 * smooth(ramp(f, 1637, 1760))); // dusk settles over the statue
  if (S.id === 'mourn') return blendLight(LIGHTS.day, LIGHTS.cool, smooth(ramp(f, 1366, 1430)));
  if (S.id === 'finale') return blendLight(LIGHTS.cool, LIGHTS.golden, smooth(ramp(f, 1524, 1590)));
  if (S.id === 'fifty') return blendLight(LIGHTS.warm, LIGHTS.golden, smooth(ramp(f, 1006, 1060)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const HERO_SLAB = [1.2, 0.35, 0.8];       // [x, topY, z] proud-stand slab (P8)
export const PLINTH = [0.9, 0.44, -0.4];          // [x, topY, z] statue plinth (P11/P12)
export const DIG_A = [1.35, -1.15], DIG_B = [-1.5, -1.7];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

/** Frida's card position per frame: [x, y, z, groundY]. Moves are physical
 *  (kf3 walks/climbs) — section changes never teleport her. */
export const fridaPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return [...kf3([[0, [0, 0, 0.1]], [105, [0, 0, 2.05], 'linear'], [158, [0, 0, 2.2]]], f), 0];
    case 'intro': return [...kf3([[159, [0, 0, 2.2]], [215, [0, 0, 0.7], 'surge'], [304, [0, 0, 0.6]]], f), 0];
    case 'quake': return [-1.7, 0, 1.7, 0];
    case 'sentin': return [...kf3([[481, [-0.85, 0, 2.7]], [603, [-0.1, 0, 1.05], 'linear']], f), 0];
    case 'gear': return [0, 0, 0.9, 0];
    case 'crawl': return [...kf3([[727, [0, 0, 2.6]], [845, [0, 0, -1.5], 'linear'], [859, [0, 0, -1.55]]], f), 0];
    case 'barkdig': {
      if (f < 884) return [...kf3([[860, [0, 0, -1.55]], [884, [1.0, 0, -0.9], 'linear']], f), 0];
      if (f < 918) return [1.0, 0, -0.9, 0];
      if (f < 942) return [...kf3([[918, [1.0, 0, -0.9]], [942, [-1.15, 0, -1.55], 'linear']], f), 0];
      return [-1.15, 0, -1.55, 0];
    }
    case 'fifty': {
      if (f < 1042) { const p = kf3([[1006, [-1.15, 0, -1.55]], [1042, [1.2, 0.35, 0.8], 'surge']], f); return [p[0], p[1], p[2], p[1]]; }
      return [HERO_SLAB[0], HERO_SLAB[1], HERO_SLAB[2], HERO_SLAB[1]];
    }
    case 'photos': {
      if (f < 1132) { const p = kf3([[1111, [1.2, 0.35, 0.8]], [1132, [0, 0, 0.9], 'surge']], f); return [p[0], p[1], p[2], p[1]]; }
      return [0, 0, 0.9, 0];
    }
    case 'retire': return [0, 0, 0.55, 0];
    case 'mourn': return [...kf3([[1366, [0, 0, 0.55]], [1392, [-0.35, 0, 0.35], 'surge'], [1517, [-0.35, 0, 0.35]]], f), 0];
    case 'finale': case 'tease': return [PLINTH[0], PLINTH[1], PLINTH[2], PLINTH[1]];
    default: return [0, 0, 0, 0];
  }
};
export const heroPosAt = fridaPosAt;
/** Active dig site [x,z] while rescuers dig (barkdig windows), else null. */
export const digAt = (f) => {
  if (f >= 888 && f <= 916) return DIG_A;
  if (f >= 946 && f <= 976) return DIG_B;
  return null;
};
const barkPulse = (f) => {
  for (const w0 of [866, 938]) { const d = f - w0; if (d >= 0 && d < 22) return 0.04 * Math.abs(Math.sin(d * Math.PI / 7)); }
  return 0;
};

// ---------- cameras (boundary-matched continuous flight) ----------
const CAMS = {
  hook: [
    { f: 0, pos: [0, 1.05, 5.7], look: [0, 0.72, 1.0], fov: 46 },
    { f: 70, pos: [0, 0.95, 4.95], look: [0.16, 0.68, 1.8], fov: 42, ease: 'surge' },
    { f: 158, pos: [0.55, 1.03, 5.3], look: [0.42, 0.72, 1.8], fov: 43 },
  ],
  intro: [
    { f: 159, pos: [0.55, 1.03, 5.3], look: [0.42, 0.72, 1.8], fov: 43 },
    { f: 240, pos: [1.8, 1.5, 5.7], look: [0, 0.85, 0.5], fov: 44, ease: 'surge' },
    { f: 304, pos: [2.2, 1.5, 5.3], look: [0, 0.85, 0.35], fov: 44 },
  ],
  quake: [
    { f: 305, pos: [2.2, 1.5, 5.3], look: [0, 0.85, 0.35], fov: 44 },
    { f: 395, pos: [3.4, 2.6, 9.6], look: [-0.2, 1.0, -1.6], fov: 50, ease: 'surge' },
    { f: 480, pos: [3.0, 2.2, 8.7], look: [-0.3, 0.9, -1.2], fov: 48 },
  ],
  sentin: [
    { f: 481, pos: [3.0, 2.2, 8.7], look: [-0.3, 0.9, -1.2], fov: 48 },
    { f: 545, pos: [1.6, 1.5, 6.5], look: [0, 0.8, 0.7], fov: 44, ease: 'surge' },
    { f: 603, pos: [1.2, 1.35, 5.7], look: [0, 0.78, 0.85], fov: 43 },
  ],
  gear: [
    { f: 604, pos: [1.2, 1.35, 5.7], look: [0, 0.78, 0.85], fov: 43 },
    { f: 665, pos: [0.55, 0.78, 3.15], look: [0.05, 0.52, 0.9], fov: 38, ease: 'surge' },
    { f: 726, pos: [0.7, 0.88, 3.35], look: [0.05, 0.56, 0.85], fov: 39 },
  ],
  crawl: [
    { f: 727, pos: [0.7, 0.88, 3.35], look: [0.05, 0.56, 0.85], fov: 39 },
    { f: 795, pos: [0.95, 0.72, 1.1], look: [0, 0.42, 0.1], fov: 40, ease: 'linear' },
    { f: 859, pos: [1.15, 0.78, -0.7], look: [-0.1, 0.48, -1.45], fov: 40 },
  ],
  barkdig: [
    { f: 860, pos: [1.15, 0.78, -0.7], look: [-0.1, 0.48, -1.45], fov: 40 },
    { f: 905, pos: [2.1, 1.1, 2.3], look: [1.25, 0.55, -1.05], fov: 42, ease: 'surge' },
    { f: 958, pos: [-0.1, 1.1, 2.5], look: [-1.35, 0.55, -1.6], fov: 42, ease: 'surge' },
    { f: 1005, pos: [0.6, 1.3, 3.7], look: [0.3, 0.68, -0.7], fov: 43 },
  ],
  fifty: [
    { f: 1006, pos: [0.6, 1.3, 3.7], look: [0.3, 0.68, -0.7], fov: 43 },
    { f: 1052, pos: [1.35, 1.3, 4.7], look: [1.33, 0.95, 0.3], fov: 43, ease: 'surge' },
    { f: 1110, pos: [1.55, 1.38, 5.0], look: [1.32, 0.95, 0.32], fov: 43 },
  ],
  photos: [
    { f: 1111, pos: [1.55, 1.38, 5.0], look: [1.32, 0.95, 0.32], fov: 43 },
    { f: 1165, pos: [0.8, 1.2, 4.3], look: [0.1, 0.8, 0.9], fov: 42, ease: 'surge' },
    { f: 1227, pos: [0.5, 1.25, 4.5], look: [0.05, 0.82, 0.85], fov: 42 },
  ],
  retire: [
    { f: 1228, pos: [0.5, 1.25, 4.5], look: [0.05, 0.82, 0.85], fov: 42 },
    { f: 1295, pos: [0.2, 1.42, 5.7], look: [0, 0.92, 0.4], fov: 43, ease: 'surge' },
    { f: 1365, pos: [0.3, 1.45, 5.9], look: [0, 0.92, 0.35], fov: 43 },
  ],
  mourn: [
    { f: 1366, pos: [0.3, 1.45, 5.9], look: [0, 0.92, 0.35], fov: 43 },
    { f: 1445, pos: [0.0, 1.25, 4.9], look: [0.12, 0.68, -0.02], fov: 42, ease: 'surge' },
    { f: 1517, pos: [0.1, 1.3, 5.0], look: [0.2, 0.7, -0.1], fov: 42 },
  ],
  finale: [
    { f: 1518, pos: [0.1, 1.3, 5.0], look: [0.2, 0.7, -0.1], fov: 42 },
    { f: 1572, pos: [0.55, 1.15, 4.15], look: [0.75, 0.85, -0.4], fov: 41, ease: 'surge' },
    { f: 1636, pos: [0.8, 1.08, 3.75], look: [0.88, 0.9, -0.4], fov: 40 },
  ],
  tease: [
    { f: 1637, pos: [0.8, 1.08, 3.75], look: [0.88, 0.9, -0.4], fov: 40 },
    { f: 1730, pos: [0.82, 1.07, 3.8], look: [0.89, 0.93, -0.4], fov: 40.2, ease: 'surge' },
    { f: 1822, pos: [0.85, 1.05, 3.7], look: [0.9, 0.95, -0.4], fov: 40.5 },
  ],
};
const SHADOW_AT = { hook: [0, 0.7, 1.2], intro: [0, 0.7, 0.6], quake: [0, 0.8, -1], sentin: [0, 0.7, 0.8], gear: [0, 0.6, 0.9], crawl: [0, 0.5, 0], barkdig: [0.6, 0.6, -1.2], fifty: [1.2, 0.8, 0.6], photos: [0, 0.7, 0.9], retire: [0, 0.8, 0.4], mourn: [0.6, 0.6, 0], finale: [0.9, 0.8, -0.4], tease: [0.9, 0.8, -0.4] };
const shotCam = (id, f) => camFromKeys(CAMS[id], f);
export const camAt = (f) => {
  const S = shotAt(f);
  const c = shotCam(S.id, f);
  let flash = f < 9 ? -0.95 * (1 - f / 9) : 0;
  if (S.id === 'photos') for (const p of [1138, 1174, 1208]) { const d = f - p; if (d >= 0 && d < 5) flash = Math.max(flash, 0.88 * (1 - d / 5)); }
  { const d = f - 1518; if (d >= -3 && d <= 3) flash = Math.min(flash, -0.95 * Math.cos(d / 3 * Math.PI / 2)); } // dip into the statue reveal
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const fp = fridaPosAt(f);
  let cinf = 8;
  if (S.id === 'gear' || S.id === 'crawl') cinf = 5;
  if (S.id === 'quake') cinf = 10;
  if (S.id === 'finale' || S.id === 'tease') cinf = 6;
  return { focus: dist(C.pos, [fp[0], fp[1] + 0.55, fp[2]]), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, dust: 0.3, windK: 0.4, boardCity: 0, board50: 0, boardDuty: 0, lampK: 0.5, slabT: 0, medalK: 0 };
  switch (S.id) {
    case 'hook': W.dust = 0.34; break;
    case 'intro': W.dust = 0.3; break;
    case 'quake': W.boardCity = smooth(ramp(f, 335, 375)) * (1 - smooth(ramp(f, 448, 480))); W.slabT = smooth(ramp(f, 362, 398)); W.dust = 0.5; break;
    case 'sentin': W.dust = 0.42; break;
    case 'gear': W.dust = 0.36; W.lampK = 0.65; break;
    case 'crawl': W.dust = 0.4; W.lampK = 0.7; break;
    case 'barkdig': W.dust = 0.38; W.lampK = 0.65; break;
    case 'fifty': W.board50 = smooth(ramp(f, 1042, 1082)); W.dust = 0.26; break;
    case 'photos': W.dust = 0.2; break;
    case 'retire': W.medalK = smooth(ramp(f, 1262, 1300)); W.dust = 0.18; break;
    case 'mourn': W.dust = 0.1; W.windK = 0.25; W.lampK = 0.4; break;
    case 'finale': W.boardDuty = smooth(ramp(f, 1548, 1592)); W.dust = 0.16; W.lampK = 0.55; break;
    case 'tease': W.boardDuty = 1; W.dust = 0.12; W.windK = 0.25; W.lampK = 0.72; break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'quake': return { smokeRate: f >= 360 && f <= 415 ? 7 : 2.2, dustRate: 0.5 };
    case 'barkdig': return { smokeRate: digAt(f) ? 5 : 1.4, dustRate: 0.35 };
    case 'mourn': return { smokeRate: 0.4, dustRate: 0.08 };
    case 'tease': return { smokeRate: 0.5, dustRate: 0.1 };
    case 'retire': case 'finale': return { smokeRate: 0.7, dustRate: 0.15 };
    default: return { smokeRate: 1.5, dustRate: 0.3 };
  }
};

// ---------- actors ----------
const TINT = { dust: '#ffe9c4', day: '#ffffff', warm: '#ffe9c4', cool: '#dfe8f2', golden: '#ffd9a3' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
const OUTFITS = {
  rescuer: { jacket: '#e86a1e', pants: '#3a4149', boots: '#2e2a26', hat: 'cap', cap: '#f2f2f2', skin: '#f5c9a0' },
  rescuer2: { jacket: '#e86a1e', pants: '#33383f', boots: '#2e2a26', hat: 'cap', cap: '#ffd23e', skin: '#c99067' },
  navy: { jacket: '#274b73', pants: '#22344d', boots: '#1e1a16', hat: 'cap', cap: '#eef2f6', skin: '#ecd0b6' },
  navy2: { jacket: '#274b73', pants: '#22344d', boots: '#1e1a16', hat: 'cap', cap: '#eef2f6', skin: '#f5c9a0' },
};
const RF = (T, o, pos, extra = {}) => ({ key: 'frida' + JSON.stringify(o), draw: (p) => T.fridaCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? 0, ...extra });
const RW = (T, role, o, pos, extra = {}) => ({ key: 'work_' + role + JSON.stringify(o), draw: (p) => T.bodyFront(p, OUTFITS[role], o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const GEAR = { goggles: 1, boots: 1, vest: 1 };
const stepAt = (f, rate = 0.055) => q((f * rate) % 1, 2);
const digK = (f) => digAt(f) ? q(0.5 + 0.5 * Math.sin(f * 0.55), 2) : 0.12;
const runnerAt = (f, x0, z0, x1, z1, f0, f1) => kf3([[f0, [x0, 0, z0]], [f1, [x1, 0, z1], 'linear']], f);

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S);
  const fp = fridaPosAt(f);
  const F = (o, extra = {}) => { out.push(RF(T, o, fp, { tint, ...extra })); };
  switch (S.id) {
    case 'hook': { // BIG: goggled Frida walks INTO the rubble toward camera, frame 1
      F({ ...GEAR, step: stepAt(f, 0.06), pant: 1 }, { s: 1.28, yaw: -0.3 });
      break;
    }
    case 'intro': { // named: yellow Lab of the Navy unit, handler beside her
      const walking = f < 215;
      F({ ...GEAR, step: walking ? stepAt(f, 0.05) : 0, pant: 0 }, { s: 1.12, yaw: -0.25 });
      out.push(RW(T, 'rescuer', { expr: 'smile', mode: walking ? 'march' : 'stand', phase: q((f * 0.05) % 1, 2), blink: blinkAt(f, 31), facing: 1 }, [-1.15, 0, 0.75], { tint, s: 0.82, yaw: 0.3 }));
      break;
    }
    case 'quake': { // wide flattened street; Frida waits at the edge with her handler
      F({ ...GEAR, step: 0, pant: 1 }, { s: 1.0, yaw: -0.3 });
      out.push(RW(T, 'rescuer', { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), facing: 1 }, [-2.6, 0, 1.9], { tint, s: 0.82, yaw: 0.35 }));
      out.push(RW(T, 'rescuer2', { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 47), facing: -1 }, [2.9, 0, 0.6], { tint: '#e8e2d2', s: 0.8, yaw: -0.4 }));
      break;
    }
    case 'sentin': { // everyone runs OUT past camera; Frida is led IN
      F({ ...GEAR, step: stepAt(f, 0.065), pant: 1 }, { s: 1.08, yaw: -0.3 });
      out.push(RW(T, 'rescuer', { expr: 'stern', mode: 'march', phase: q((f * 0.065) % 1, 2), blink: blinkAt(f, 31), facing: 1 }, [fp[0] - 0.95, 0, fp[2] + 0.15], { tint, s: 0.82, yaw: 0.25 }));
      if (f < 575) {
        const r1 = runnerAt(f, -1.7, -3.0, -2.6, 5.6, 485, 568);
        const r2 = runnerAt(f, 1.9, -3.4, 3.1, 5.4, 492, 575);
        const r3 = runnerAt(f, 0.4, -4.2, 0.9, 5.8, 500, 572);
        out.push(RW(T, 'rescuer2', { expr: 'nervous', mode: 'march', phase: q((f * 0.09) % 1, 2), blink: blinkAt(f, 47) }, r1, { tint, s: 0.84, yaw: 0.1 }));
        out.push(RW(T, 'rescuer', { expr: 'stern', mode: 'march', phase: q((f * 0.095 + 0.4) % 1, 2), blink: blinkAt(f, 53), seed: 9 }, r2, { tint, s: 0.8, yaw: -0.1 }));
        out.push(RW(T, 'navy', { expr: 'nervous', mode: 'march', phase: q((f * 0.088 + 0.7) % 1, 2), blink: blinkAt(f, 59), seed: 13 }, r3, { tint, s: 0.78, yaw: 0 }));
      }
      break;
    }
    case 'gear': { // hero close-up: boots on paws, goggles over eyes
      F({ ...GEAR, step: 0, pant: 0 }, { s: 1.3, yaw: -0.22 });
      out.push(RW(T, 'rescuer', { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31), facing: 1, prop: [0, 0.1] }, [-1.05, 0, 1.15], { tint, s: 0.82, yaw: 0.4 }));
      break;
    }
    case 'crawl': { // at her level through the slab corridor, nose down, tail up
      const moving = f < 845;
      F({ ...GEAR, step: moving ? stepAt(f, 0.045) : 0, sniff: 1, pant: 1 }, { s: 1.02, yaw: -0.18, roll: q(0.045 * Math.sin(f * 0.3), 3) });
      break;
    }
    case 'barkdig': { // stop -> bark x3 -> rescuers dig; twice
      const walking = (f >= 860 && f < 884) || (f >= 918 && f < 942);
      const barkY = barkPulse(f);
      out.push(RF(T, { ...GEAR, step: walking ? stepAt(f, 0.06) : 0, pant: 1, sniff: walking ? 1 : 0 }, [fp[0], fp[1] + barkY, fp[2], fp[3]], { tint, s: 1.1, yaw: -0.28 }));
      const dig = digAt(f);
      const site = f < 918 ? DIG_A : DIG_B;
      out.push(RW(T, 'rescuer', { expr: 'stern', mode: 'stand', blink: blinkAt(f, 31), facing: 1, tilt: dig ? 7 : 2, prop: [0, digK(f)] }, [site[0] + 0.62, 0, site[1] - 0.25], { tint, s: 0.82, yaw: -0.5 }));
      out.push(RW(T, 'rescuer2', { expr: 'stern', mode: 'stand', blink: blinkAt(f, 47), facing: -1, tilt: dig ? 7 : 2, prop: [0, q(1 - digK(f), 2)] }, [site[0] - 0.66, 0, site[1] - 0.3], { tint, s: 0.8, yaw: 0.5 }));
      break;
    }
    case 'fifty': { // proud on the slab, crew around, board behind
      const climbing = f < 1042;
      F({ ...GEAR, step: climbing ? stepAt(f, 0.05) : 0, pant: 1 }, { s: 1.16, yaw: -0.25 });
      out.push(RW(T, 'rescuer', { expr: 'grin', mode: 'stand', blink: blinkAt(f, 31), facing: 1 }, [0.1, 0, 1.7], { tint, s: 0.82, yaw: 0.3 }));
      out.push(RW(T, 'rescuer2', { expr: 'smile', mode: 'stand', blink: blinkAt(f, 47), facing: -1 }, [2.35, 0, 1.55], { tint, s: 0.8, yaw: -0.35 }));
      out.push(RW(T, 'navy', { expr: 'smile', mode: 'stand', blink: blinkAt(f, 59), seed: 13 }, [-0.65, 0, -0.5], { tint, s: 0.8, yaw: 0.25 }));
      break;
    }
    case 'photos': { // the goggled dog the world photographed
      const stepping = f < 1132;
      F({ ...GEAR, step: stepping ? stepAt(f, 0.05) : 0, pant: 1 }, { s: 1.18, yaw: -0.25 });
      out.push(RW(T, 'rescuer2', { expr: 'grin', mode: 'stand', blink: blinkAt(f, 47), facing: -1 }, [1.35, 0, 0.4], { tint, s: 0.8, yaw: -0.45 }));
      break;
    }
    case 'retire': { // golden ceremony: seated, honours row behind, medal glint
      F({ ...GEAR, sit: true, pant: 0 }, { s: 1.12, yaw: -0.15 });
      out.push(RW(T, 'navy', { expr: 'smile', mode: 'stand', blink: blinkAt(f, 59), seed: 13 }, [-1.5, 0, -0.7], { tint, s: 0.82, yaw: 0.15 }));
      out.push(RW(T, 'navy2', { expr: 'smile', mode: 'stand', blink: blinkAt(f, 61), seed: 17 }, [-0.5, 0, -0.85], { tint, s: 0.82, yaw: 0.08 }));
      out.push(RW(T, 'navy', { expr: 'smile', mode: 'stand', blink: blinkAt(f, 67), seed: 21 }, [0.55, 0, -0.85], { tint, s: 0.82, yaw: -0.08 }));
      out.push(RW(T, 'rescuer', { expr: 'smile', mode: 'stand', blink: blinkAt(f, 31) }, [1.55, 0, -0.7], { tint, s: 0.82, yaw: -0.15 }));
      break;
    }
    case 'mourn': { // quiet: seated by the plinth, head low; wreath at its base
      F({ goggles: 1, boots: 0, vest: 0, sit: true, sniff: 1, pant: 0 }, { s: 1.05, yaw: -0.2, tint: '#cfd9e4' });
      break;
    }
    case 'finale': case 'tease': { // the statue: stone-tinted Frida on the plinth, goggles on
      out.push(RF(T, { goggles: 1, boots: 0, vest: 0, step: 0, pant: 0 }, fp, { tint: '#8f959c', s: 1.18, yaw: -0.2 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'quake' && f >= 362 && f <= 404) { // the slab shifts: dust burst at its base
    const t = q((f - 362) / 42, 2);
    out.push(FXC('slabpuff_' + t, (p) => T.fxDust(p, t, '#cfc0a0'), [-1.9, 0.25, -2.0], 1.0));
  }
  const dig = digAt(f);
  if (dig) { // dust puffs at the dig point, shovels landing
    const t = q(((f % 12) / 12), 2);
    out.push(FXC('digpuff_' + t, (p) => T.fxDust(p, t, '#d8c8a4'), [dig[0], 0.18, dig[1]], 0.7));
  }
  if (S.id === 'barkdig') { // bark bursts at her muzzle on each bark pulse
    for (const w0 of [866, 938]) for (let k = 0; k < 3; k++) {
      const bf = w0 + k * 7;
      if (f >= bf && f <= bf + 3) { const t = q((f - bf) / 3, 2); out.push(FXC('bark_' + bf + '_' + t, (p) => T.fxBurst(p, t, '#fff3b0', 6, 20, 90), [fp_bark(f)[0] + 0.55, 0.72, fp_bark(f)[2] + 0.1], 0.4)); }
    }
  }
  if (S.id === 'photos') { // two printed photos drift at the frame edges
    const ph = q(0.5 + 0.5 * Math.sin(f * 0.05), 2);
    out.push(FXC('photoA_' + ph, (p) => photoCard(p, ph), [-1.7, 1.15, 0.2], 0.55));
    out.push(FXC('photoB_' + ph, (p) => photoCard(p, q(1 - ph, 2)), [1.8, 1.3, -0.2], 0.5));
  }
  return out;
};
const fp_bark = (f) => fridaPosAt(f);
const photoCard = (p, ph) => { // a snapshot print: white border, sky, goggled dog head
  const g = p.g; g.save(); g.translate(300, 500); g.rotate((ph - 0.5) * 0.14);
  p.poly([[-190, -250], [190, -250], [190, 250], [-190, 250]], '#f6f3ec', 10);
  p.poly([[-160, -220], [160, -220], [160, 170], [-160, 170]], '#b8c8d8', 0);
  p.poly([[-160, 60], [160, 20], [160, 170], [-160, 170]], '#8a7a5c', 0);
  p.ell(10, 30, 95, 80, '#dfb45e', 8); p.ell(72, 48, 62, 34, '#dfb45e', 6);
  p.ell(30, 6, 26, 20, '#9fd4e8', 5); p.stroke([[-52, -8], [44, 8]], 16, '#37424e');
  p.dot(122, 40, 13, '#241726');
  g.restore();
};
