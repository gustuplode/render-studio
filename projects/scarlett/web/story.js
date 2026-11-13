// Shot plan for "Scarlett — The Cat Who Ran Into Fire Five Times" — timed to
// scarlett-voice (56.225 s, 30 fps, TOTAL 1687). True story: Brooklyn, 1996 —
// a stray calico raises five kittens in an old garage; when it burns she makes
// five trips through the flames, then counts her kittens by touch because her
// eyes are blistered shut. Firefighter David Giannelli gets them to a vet; one
// kitten is lost, Scarlett and four survive; she lives 12 more years at home.
// Phrases: P1 0-140 | P2 175-319 | P3 359-409 | P4 440-542 | P5 575-605 |
// P6 635-743 | P7 760-867 | P8 899-997 | P9 1025-1135 | P10 1166-1245 |
// P11 1279-1355 | P12 1384-1448 | P13 (tease) 1484-1645. Sections tile 0..1686
// inter-phrase gaps belong to the outgoing section. ONE set: a Brooklyn street
// at night — garage (open front) at z~-4..-7, pavement row at z=1.0, rescue /
// home doorway at x~5.45, z~-2.2. Continuous camera flight, boundary-matched.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1687, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 174, light: 'fireNight' },
  { id: 'garage', a: 175, b: 358, light: 'night' },
  { id: 'fire', a: 359, b: 439, light: 'fireNight' },
  { id: 'trip1', a: 440, b: 574, light: 'fireNight' },
  { id: 'backin', a: 575, b: 634, light: 'fireNight' },
  { id: 'trips', a: 635, b: 759, light: 'fireNight' },
  { id: 'eyes', a: 760, b: 898, light: 'fireNight' },
  { id: 'count', a: 899, b: 1024, light: 'fireNight' },
  { id: 'vet', a: 1025, b: 1165, light: 'fireNight' },
  { id: 'loss', a: 1166, b: 1279, light: 'dawn' },
  { id: 'adopt', a: 1280, b: 1383, light: 'dawn' },
  { id: 'home', a: 1384, b: 1483, light: 'home' },
  { id: 'tease', a: 1484, b: 1686, light: 'home' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t); // constant-speed tracking moves (kabang pattern)

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  night: { az: 205, el: 20, sky: '#39445c', ground: '#23211e', hemi: 0.66, sun: '#8fa8cc', sunI: 0.9, fog: '#161c2a', fogNear: 30, fogFar: 230,
    skyTop: '#0d1524', skyHor: '#33405a', sunDisc: '#dfe8f2', sunSize: 0.002, sat: 1.02, vig: 0.34, shadowExt: 18, aurora: 0, gain: '#dfe8f8', ...WATER },
  fireNight: { az: 165, el: 24, sky: '#4a3a30', ground: '#2a1e16', hemi: 0.74, sun: '#ffa050', sunI: 1.15, fog: '#201812', fogNear: 30, fogFar: 240,
    skyTop: '#131022', skyHor: '#54382a', sunDisc: '#ffc98a', sunSize: 0.0022, sat: 1.06, vig: 0.36, shadowExt: 18, aurora: 0, gain: '#ffe2c4', ...WATER },
  dawn: { az: 112, el: 22, sky: '#7a86a0', ground: '#3a3230', hemi: 0.98, sun: '#ffb763', sunI: 1.9, fog: '#5a4a3e', fogNear: 36, fogFar: 280,
    skyTop: '#3d5a8a', skyHor: '#e8a05c', sunDisc: '#ffd9a0', sunSize: 0.003, sat: 1.08, vig: 0.28, shadowExt: 18, aurora: 0, gain: '#ffedd6', ...WATER },
  home: { az: 100, el: 27, sky: '#a8b6cc', ground: '#4a4038', hemi: 1.12, sun: '#ffc37e', sunI: 2.2, fog: '#6a5540', fogNear: 40, fogFar: 300,
    skyTop: '#4f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0034, sat: 1.09, vig: 0.25, shadowExt: 18, aurora: 0, gain: '#fff0d8', ...WATER },
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
  if (S.id === 'fire') return blendLight(LIGHTS.night, LIGHTS.fireNight, smooth(ramp(f, 359, 412)));
  if (S.id === 'vet') return blendLight(LIGHTS.fireNight, LIGHTS.dawn, smooth(ramp(f, 1090, 1165)) * 0.55);
  if (S.id === 'home') return blendLight(LIGHTS.dawn, LIGHTS.home, smooth(ramp(f, 1384, 1450)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const ROW_Z = 1.0;
export const ROW_XS = [0.1, 0.62, 1.14, 1.66, 2.18];
const AP = (i) => [ROW_XS[i] - 0.52, 0, ROW_Z + 0.02]; // her stop point beside slot i
const MOUTH = [-0.9, 0, -2.55];
const CLUSTER = [[-1.35, 0, -3.35], [-0.55, 0, -3.2], [-1.0, 0, -3.62], [-0.35, 0, -3.55], [-1.52, 0, -3.72]];
const KCOLS = ['#d98a4a', '#e8e4da', '#7a6a58', '#9aa0a6', '#4a4038'];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

// Scarlett's position per frame — single source for actors, dof and sweep.
export const scarlettPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return [0, 0, 0.7];
    case 'garage': return [-0.9, 0, -2.3];
    case 'fire': return [-0.55, 0, -2.35];
    case 'trip1': return kf3([[440, [-0.9, 0, -3.05]], [472, [-0.9, 0, -2.45], 'linear'], [524, AP(0), 'linear'], [574, AP(0)]], f);
    case 'backin': return kf3([[575, AP(0)], [610, [-0.85, 0, -1.2], 'linear'], [634, [-0.9, 0, -3.1], 'linear']], f);
    case 'trips': return kf3([
      [635, [-0.9, 0, -3.1]], [652, AP(1), 'linear'], [654, AP(1)], [668, [-0.9, 0, -2.75], 'linear'],
      [670, [-0.9, 0, -2.75]], [685, AP(2), 'linear'], [687, AP(2)], [701, [-0.9, 0, -2.75], 'linear'],
      [703, [-0.9, 0, -2.75]], [718, AP(3), 'linear'], [720, AP(3)], [734, [-0.9, 0, -2.75], 'linear'],
      [736, [-0.9, 0, -2.75]], [756, AP(4), 'linear'], [759, AP(4)]], f);
    case 'eyes': return [0.38, 0, 1.3];
    case 'count': {
      const x = kf([[899, -0.45], [912, -0.45], [922, 0.07], [935, 0.07], [945, 0.59], [958, 0.59], [968, 1.11], [981, 1.11], [991, 1.63], [1024, 1.63]], f);
      const z = kf([[899, 1.3], [905, 1.17], [911, 1.3], [928, 1.17], [934, 1.3], [951, 1.17], [957, 1.3], [974, 1.17], [980, 1.3], [997, 1.17], [1003, 1.3], [1024, 1.3]], f);
      return [x, 0, z];
    }
    case 'vet': return kf3([[1025, [1.63, 0, 1.3]], [1090, [1.63, 0, 1.3]], [1155, [5.0, 0, -0.7], 'linear'], [1165, [5.0, 0, -0.7]]], f);
    default: return [5.45, 0, -1.15]; // loss / adopt / home: resting at the doorway
  }
};
export const heroPosAt = scarlettPosAt;
/** Firefighter Giannelli's position (null before he arrives). */
export const ffPosAt = (f) => {
  if (f < 1025) return null;
  return kf3([[1025, [7.4, 0, 1.7]], [1092, [3.35, 0, 1.4], 'linear'], [1105, [3.35, 0, 1.4]], [1155, [5.95, 0, -0.95], 'linear'], [1165, [5.95, 0, -0.95]]], f);
};

// ---------- cameras (boundary-matched continuous flight) ----------
const CAMS = {
  hook: [
    { f: 0, pos: [0.1, 1.28, 4.35], look: [0, 1.05, 0.55], fov: 40 },
    { f: 90, pos: [0.08, 1.3, 4.0], look: [0, 1.05, 0.55], fov: 39, ease: 'surge' },
    { f: 174, pos: [-0.4, 1.6, 5.6], look: [-0.7, 1.0, -1.4], fov: 44, ease: 'surge' },
  ],
  garage: [
    { f: 175, pos: [-0.4, 1.6, 5.6], look: [-0.7, 1.0, -1.4], fov: 44 },
    { f: 270, pos: [-0.5, 1.7, 6.4], look: [-0.8, 1.05, -2.2], fov: 46, ease: 'surge' },
    { f: 358, pos: [-0.6, 1.5, 5.4], look: [-0.85, 1.0, -2.2], fov: 43, ease: 'surge' },
  ],
  fire: [
    { f: 359, pos: [-0.6, 1.5, 5.4], look: [-0.85, 1.0, -2.2], fov: 43 },
    { f: 412, pos: [-0.75, 1.38, 4.9], look: [-0.9, 0.95, -2.4], fov: 41, ease: 'surge' },
    { f: 439, pos: [-0.55, 1.32, 4.7], look: [-0.6, 0.9, -1.6], fov: 40, ease: 'surge' },
  ],
  trip1: [
    { f: 440, pos: [-0.55, 1.32, 4.7], look: [-0.6, 0.9, -1.6], fov: 40 },
    { f: 500, pos: [0.15, 1.3, 5.1], look: [-0.5, 0.85, -1.1], fov: 41, ease: 'surge' },
    { f: 574, pos: [0.5, 1.25, 5.5], look: [-0.15, 0.8, 0.95], fov: 42, ease: 'surge' },
  ],
  backin: [
    { f: 575, pos: [0.5, 1.25, 5.5], look: [-0.15, 0.8, 0.95], fov: 42 },
    { f: 610, pos: [0.2, 1.35, 5.2], look: [-0.35, 0.9, -1.4], fov: 41, ease: 'surge' },
    { f: 634, pos: [-0.4, 1.4, 5.4], look: [-0.8, 0.95, -2.4], fov: 41, ease: 'surge' },
  ],
  trips: [
    { f: 635, pos: [-0.4, 1.4, 5.4], look: [-0.8, 0.95, -2.4], fov: 41 },
    { f: 690, pos: [0.45, 1.45, 5.4], look: [0.35, 0.85, -0.6], fov: 41, ease: 'surge' },
    { f: 735, pos: [0.85, 1.35, 5.2], look: [0.85, 0.85, 0.6], fov: 40, ease: 'surge' },
    { f: 759, pos: [1.05, 1.3, 4.7], look: [1.05, 0.9, 0.8], fov: 40, ease: 'surge' },
  ],
  eyes: [
    { f: 760, pos: [1.05, 1.3, 4.7], look: [1.05, 0.9, 0.8], fov: 40 },
    { f: 830, pos: [0.55, 1.22, 3.6], look: [0.42, 0.98, 1.2], fov: 38, ease: 'surge' },
    { f: 898, pos: [0.42, 1.18, 3.35], look: [0.4, 1.0, 1.25], fov: 37.5, ease: 'surge' },
  ],
  count: [
    { f: 899, pos: [0.42, 1.18, 3.35], look: [0.4, 1.0, 1.25], fov: 37.5 },
    { f: 935, pos: [0.0, 1.35, 5.7], look: [-0.05, 0.85, 1.0], fov: 42, ease: 'surge' },
    { f: 985, pos: [1.05, 1.35, 5.9], look: [1.25, 0.85, 1.0], fov: 42, ease: 'surge' },
    { f: 1024, pos: [2.05, 1.35, 5.9], look: [1.95, 0.85, 1.0], fov: 42, ease: 'surge' },
  ],
  vet: [
    { f: 1025, pos: [2.05, 1.35, 5.9], look: [1.95, 0.85, 1.0], fov: 42 },
    { f: 1090, pos: [2.7, 1.35, 5.7], look: [2.35, 0.88, 1.0], fov: 41, ease: 'surge' },
    { f: 1135, pos: [4.35, 1.38, 5.6], look: [4.55, 0.9, 0.1], fov: 41, ease: 'surge' },
    { f: 1165, pos: [5.05, 1.42, 5.2], look: [5.25, 0.95, -0.9], fov: 40, ease: 'surge' },
  ],
  loss: [
    { f: 1166, pos: [5.05, 1.42, 5.2], look: [5.25, 0.95, -0.9], fov: 40 },
    { f: 1225, pos: [5.3, 1.3, 3.9], look: [5.5, 0.9, -1.1], fov: 39, ease: 'surge' },
    { f: 1279, pos: [5.4, 1.32, 3.8], look: [5.5, 0.92, -1.1], fov: 39, ease: 'surge' },
  ],
  adopt: [
    { f: 1280, pos: [5.4, 1.32, 3.8], look: [5.5, 0.92, -1.1], fov: 39 },
    { f: 1330, pos: [5.2, 1.45, 4.6], look: [5.45, 0.95, -1.0], fov: 41, ease: 'surge' },
    { f: 1383, pos: [5.5, 1.55, 6.6], look: [5.8, 1.02, -1.0], fov: 44, ease: 'surge' },
  ],
  home: [
    { f: 1384, pos: [5.5, 1.55, 6.6], look: [5.8, 1.02, -1.0], fov: 44 },
    { f: 1445, pos: [5.55, 1.6, 7.0], look: [5.85, 1.05, -1.0], fov: 45, ease: 'surge' },
    { f: 1483, pos: [5.6, 1.62, 7.3], look: [5.9, 1.06, -1.0], fov: 45, ease: 'surge' },
  ],
  // P13 tease: same golden home set; the flight ends in a slow push-in on
  // her face while the Binti Jua question is asked (first key == home's last).
  tease: [
    { f: 1484, pos: [5.6, 1.62, 7.3], look: [5.9, 1.06, -1.0], fov: 45 },
    { f: 1590, pos: [5.5, 1.45, 3.6], look: [5.5, 1.05, -1.08], fov: 39, ease: 'surge' },
    { f: 1686, pos: [5.44, 1.32, 1.9], look: [5.46, 1.1, -1.12], fov: 36, ease: 'surge' },
  ],
};
const SHADOW_AT = { hook: [0, 0.8, 0], garage: [-0.8, 0.8, -2], fire: [-0.8, 0.8, -2], trip1: [0, 0.7, -0.5], backin: [-0.5, 0.7, -1], trips: [0.4, 0.7, -0.5], eyes: [0.4, 0.8, 1], count: [1, 0.7, 1], vet: [3, 0.7, 0.5], loss: [5.4, 0.7, -1], adopt: [5.4, 0.7, -1], home: [5.5, 0.8, -1], tease: [5.5, 0.8, -1] };
const shotCam = (id, f) => camFromKeys(CAMS[id], f);
export const camAt = (f) => {
  const S = shotAt(f);
  const c = shotCam(S.id, f);
  // one dip at the vet->aftermath transition (a fade the actors ride, kabang-style)
  const d = f - 1166;
  c.flash = (d >= -3 && d <= 3) ? -0.95 * Math.cos(d / 3 * Math.PI / 2) : 0;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), P0 = scarlettPosAt(f);
  const cinf = S.id === 'eyes' || S.id === 'tease' ? 5 : S.id === 'hook' || S.id === 'count' ? 6 : S.id === 'home' ? 7 : 8;
  return { focus: dist(C.pos, [P0[0], 0.9, P0[2]]), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, dust: 0.25, windK: 0.4, fireK: 0, smokeK: 0, dawnK: 0, boardHook: 0, boardCount: 0, boardFinale: 0, vetGlow: 0, lampK: 1 };
  switch (S.id) {
    case 'hook': W.fireK = 0.8; W.smokeK = 0.7; W.boardHook = 1; W.dust = 0.3; break;
    case 'garage': W.boardHook = 1; W.dust = 0.2; W.lampK = 0.9; break;
    case 'fire': W.fireK = ramp(f, 362, 405); W.smokeK = ramp(f, 370, 420) * 0.9; W.boardHook = 1 - ramp(f, 436, 448); break;
    case 'trip1': W.fireK = 1; W.smokeK = 0.9; W.boardHook = 1 - ramp(f, 436, 448); break;
    case 'backin': case 'trips': W.fireK = 1; W.smokeK = 0.9; break;
    case 'eyes': case 'count': W.fireK = 0.95; W.smokeK = 0.85; break;
    case 'vet': W.fireK = 1 - ramp(f, 1060, 1140); W.smokeK = (1 - ramp(f, 1060, 1140)) * 0.85; W.vetGlow = ramp(f, 1090, 1130); W.dawnK = ramp(f, 1100, 1165) * 0.5; break;
    case 'loss': W.dawnK = 0.65; W.vetGlow = 0.7; W.lampK = 0.7; W.dust = 0.18; break;
    case 'adopt': W.dawnK = 0.65 + ramp(f, 1280, 1340) * 0.2; W.vetGlow = 0.6; W.lampK = 0.6; break;
    case 'home': W.dawnK = 1; W.boardFinale = ramp(f, 1405, 1448) * (1 - ramp(f, 1458, 1482)); W.vetGlow = 0.5; W.lampK = 0.45; W.dust = 0.3; break;
    case 'tease': W.dawnK = 1; W.vetGlow = 0.5; W.lampK = 0.45; W.dust = 0.3; break;
  }
  if (S.id === 'count') W.boardCount = ramp(f, 944, 960) * (1 - ramp(f, 980, 1005));
  return W;
};
export const fxProfileAt = (f) => {
  const W = worldAt(f);
  return { smokeRate: 0.3 + W.fireK * 1.3, dustRate: 0.25 };
};

// ---------- actors ----------
const TINT = { night: '#aebfe0', fireNight: '#ffc9a0', dawn: '#ffd9a3', home: '#ffe2b0' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
const RS = (T, o, pos, extra = {}) => ({ key: 'scar' + JSON.stringify(o), draw: (p) => T.scarlettCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RK = (T, i, o, pos, extra = {}) => ({ key: 'kit' + i + JSON.stringify(o), draw: (p) => T.kittenCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const carriedPos = (sp) => [sp[0] + 0.44, 0.48, sp[2] + 0.05];
const kitAt = (T, tint, i, pos, extra = {}) => RK(T, i, { color: KCOLS[i], tail: i !== 3 }, pos, { tint, s: 0.3, ...extra });

// one kitten's journey: cluster -> (optionally carried + dropped) -> row slot -> group move -> doorway
const kittenPosAt = (f, i) => {
  const S = shotAt(f), slot = [ROW_XS[i], 0, ROW_Z], cl = CLUSTER[i];
  const drop = (t0, t1, from) => f < t0 ? from : f > t1 ? slot : kf3([[t0, from], [t1, slot, 'smooth']], f);
  switch (S.id) {
    case 'hook': case 'garage': case 'fire': return cl;
    case 'trip1': {
      if (i > 0) return cl;
      const sp = scarlettPosAt(f);
      if (f < 448) return kf3([[440, cl], [448, carriedPos(scarlettPosAt(448)), 'smooth']], f);
      if (f < 530) return carriedPos(sp);
      return drop(530, 540, carriedPos(scarlettPosAt(530)));
    }
    case 'backin': return i === 0 ? slot : cl;
    case 'trips': {
      if (i === 0) return slot;
      // [pickupStart, outEnd/dropStart, dropEnd] per kitten
      const SEG = { 1: [635, 652, 659], 2: [670, 685, 692], 3: [703, 718, 725], 4: [736, 750, 758] };
      const [p0, d0, d1] = SEG[i];
      if (f < p0) return cl;
      if (f < p0 + 5) return kf3([[p0, cl], [p0 + 5, carriedPos(scarlettPosAt(p0 + 5)), 'smooth']], f);
      if (f < d0) return carriedPos(scarlettPosAt(f));
      return drop(d0, d1, carriedPos(scarlettPosAt(d0)));
    }
    case 'eyes': case 'count': return slot;
    case 'vet': {
      const home = [[4.55, 0, -0.55], [5.0, 0, -0.5], [5.45, 0, -0.55], [5.9, 0, -0.5], [6.3, 0, -0.55]][i];
      return f < 1105 ? slot : f > 1155 ? home : kf3([[1105, slot], [1155, home, 'linear']], f);
    }
    default: { // loss / adopt / home: FOUR kittens (index 4, the dark one, was lost at the vet)
      return [[4.5, 0, -0.45], [5.05, 0, -0.4], [6.0, 0, -0.4], [6.55, 0, -0.45], null][i];
    }
  }
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S);
  const sp = scarlettPosAt(f);
  const wagPh = q((f * 0.03) % 1, 2);
  const fadeOut = S.id === 'vet' ? 1 - ramp(f, 1148, 1165) : 1;
  const fadeIn = S.id === 'loss' ? ramp(f, 1166, 1180) : 1;
  const groupAlpha = Math.min(fadeOut, fadeIn);
  const runStep = q((f * 0.09) % 1, 2);
  switch (S.id) {
    case 'hook':
      out.push(RS(T, { view: 'front', expr: 'brave', blink: blinkAt(f, 7), wagPh }, sp, { tint, s: 1.08 }));
      break;
    case 'garage':
      out.push(RS(T, { view: 'front', expr: 'smile', blink: blinkAt(f, 7), wagPh }, sp, { tint, s: 0.98 }));
      break;
    case 'fire':
      out.push(RS(T, { view: 'side', expr: f < 400 ? 'shock' : 'nervous', blink: blinkAt(f, 7), wagPh, step: 0 }, sp, { tint, s: 0.98 }));
      break;
    case 'trip1':
      out.push(RS(T, { view: 'side', expr: 'brave', blink: blinkAt(f, 7), wagPh, step: runStep }, sp, { tint, s: 0.98 }));
      break;
    case 'backin':
      out.push(RS(T, { view: 'front', expr: 'pained', blink: blinkAt(f, 7), wagPh }, sp, { tint, s: 0.98 }));
      break;
    case 'trips': {
      const outbound = (f >= 635 && f < 654) || (f >= 670 && f < 687) || (f >= 703 && f < 720) || (f >= 736);
      if (outbound) out.push(RS(T, { view: 'side', expr: 'brave', blink: blinkAt(f, 7), wagPh, step: runStep }, sp, { tint, s: 0.98 }));
      else out.push(RS(T, { view: 'front', expr: 'pained', blink: blinkAt(f, 7), wagPh }, sp, { tint, s: 0.98 }));
      break;
    }
    case 'eyes':
      // eyes blistered shut: constant lid (blink=1) + pained — the painter draws shut-eye arcs
      out.push(RS(T, { view: 'front', expr: 'pained', blink: 1, wagPh }, sp, { tint, s: 1.04 }));
      break;
    case 'count': {
      const hold = (f >= 899 && f <= 912) || (f >= 922 && f <= 935) || (f >= 945 && f <= 958) || (f >= 968 && f <= 981) || (f >= 991);
      out.push(RS(T, { view: 'side', expr: 'neutral', blink: blinkAt(f, 7), wagPh, step: hold ? 0 : q((f * 0.06) % 1, 2) }, sp, { tint, s: 0.98 }));
      break;
    }
    case 'vet':
      out.push(RS(T, { view: 'front', expr: 'relief', blink: blinkAt(f, 7), wagPh }, sp, { tint, s: 1.0, alpha: groupAlpha }));
      break;
    case 'loss':
      out.push(RS(T, { view: 'front', expr: 'pained', blink: blinkAt(f, 7), wagPh, bandage: 1 }, sp, { tint, s: 1.02, alpha: groupAlpha }));
      break;
    case 'adopt':
      out.push(RS(T, { view: 'front', expr: 'smile', blink: blinkAt(f, 7), wagPh, bandage: 1 }, sp, { tint, s: 1.02 }));
      break;
    case 'home': case 'tease':
      out.push(RS(T, { view: 'front', expr: 'relief', blink: blinkAt(f, 7), wagPh }, sp, { tint, s: 1.04 }));
      break;
  }
  // kittens (carried ones ride at her mouth, blob=false, drawn after her)
  for (let i = 0; i < 5; i++) {
    const kp = kittenPosAt(f, i);
    if (!kp) continue;
    const carried = kp[1] > 0.2;
    const alpha = (S.id === 'vet' || S.id === 'loss') ? groupAlpha : 1;
    out.push(kitAt(T, tint, i, kp, carried ? { blob: false, roll: 0.55, order: 3, alpha } : { alpha }));
  }
  // Firefighter Giannelli (romanFront person in a turnout-dark coat + fire-yellow
  // cap; helmetCard itself is a loose helmet prop in this painter set, so his
  // spare helmet sits by the hydrant as he works — see below)
  if (S.id === 'vet') {
    const fp = ffPosAt(f);
    const walking = f < 1092;
    const o = { expr: f < 1092 ? 'nervous' : 'relief', L: 'belly', R: walking ? 'hang' : 'point', blink: blinkAt(f, 51), bob: q(breath(f, 51), 3), step: walking ? q((f * 0.06) % 1, 2) : 0 };
    out.push({ key: 'ff' + JSON.stringify(o), draw: (p) => T.romanFront(p, { tunic: '#5a2e22', skin: '#f5c9a0', cap: '#e8b13a', hair: '#2b211c' }, { ...o, seed: 51 }), x: fp[0], y: fp[1], z: fp[2], ground: 0, tint, s: 1.0, alpha: groupAlpha });
    // his helmet, set down on the pavement as he reaches the cats (10f fade-in)
    out.push({ key: 'helmet', draw: (p) => T.helmetCard(p), x: 3.15, y: 0, z: 1.85, ground: 0, tint, s: 0.34, alpha: ramp(f, 1085, 1095) * groupAlpha });
  }
  // neighbours who begged to adopt her (P11): two people walk in and keep a kind distance
  if (S.id === 'adopt' || S.id === 'home' || S.id === 'tease') {
    const v1 = S.id === 'adopt' ? kf3([[1280, [2.2, 0, 0.7]], [1315, [3.3, 0, 0.7], 'linear']], f) : [3.3, 0, 0.7];
    const v2 = S.id === 'adopt' ? kf3([[1280, [8.6, 0, 0.5]], [1318, [7.5, 0, 0.5], 'linear']], f) : [7.5, 0, 0.5];
    const o1 = { expr: 'smile', L: 'belly', R: 'wave', wv: q(f * 0.3, 1), blink: blinkAt(f, 61), bob: q(breath(f, 61), 3) };
    const o2 = { expr: 'grin', L: 'wave', R: 'belly', wv: q(f * 0.3 + 2, 1), blink: blinkAt(f, 67), bob: q(breath(f, 67), 3) };
    out.push({ key: 'vis1' + JSON.stringify(o1), draw: (p) => T.romanFront(p, { tunic: '#4f7fb8', skin: '#f5c9a0', hair: '#5a3b2a' }, { ...o1, seed: 61 }), x: v1[0], y: 0, z: v1[2], ground: 0, tint, s: 0.96, yaw: 0.3 });
    out.push({ key: 'vis2' + JSON.stringify(o2), draw: (p) => T.romanFront(p, { tunic: '#d9a441', skin: '#ffe2c2', hair: '#2b211c', dress: '#c25a7a' }, { ...o2, seed: 67 }), x: v2[0], y: 0, z: v2[2], ground: 0, tint, s: 0.94, yaw: -0.3 });
  }
  return out;
};

// ---------- 2D effects (cards) ----------
export const fxAt = (f, T) => [];
