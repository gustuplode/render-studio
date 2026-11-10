// Shot plan for "Laika — The First Dog in Space" — timed to laika-voice
// (57.83 s, 30 fps, TOTAL 1735). True story: Moscow 1957, Sputnik 2.
// Phrases: P1 0-191 street | P2 238-372 chosen | P3 416-559 training |
// P4 611-675 the world watches | P5 722-886 launch | P6 932-1055 orbit |
// P7 1103-1208 never came home | P8 1251-1372 safely after her |
// P9 1409-1517 the door | P10 1566-1734 statue. SHOTS are contiguous
// (inter-phrase gaps hold the previous shot's tail, Balto-style).
// World (built in main.js): Moscow street at origin (street along z,
// board at (0.5,0,-12.5), cathedral silhouette (-11,0,-27)); training room
// at (34,0,-4) (capsule (32.5,~,-6.5), spin chair (36.5,0,-5.5), treat
// table (33.4,0,-3.2)); launch pad at (-38,0,6) (rocket base, gantry
// (-35.2,0,6), crowd fence z=19.5); orbit: capsule (0,100,150), Earth
// centre (0,30,230) r=85; capsule interior wall z=150.6, window (-1.2,101.3);
// statue park (26,0,34), plinth top y 0.97, board (26,0,30.6).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30, TOTAL = 1735, DECK = 0;
export const SHOTS = [
  { id: 'street', a: 0, b: 237, light: 'dusk' },
  { id: 'chosen', a: 238, b: 415, light: 'dusk' },
  { id: 'training', a: 416, b: 610, light: 'room' },
  { id: 'watches', a: 611, b: 721, light: 'dawn' },
  { id: 'launch', a: 722, b: 931, light: 'dawn' },
  { id: 'orbit', a: 932, b: 1102, light: 'space' },
  { id: 'window', a: 1103, b: 1250, light: 'space' },
  { id: 'door', a: 1251, b: 1565, light: 'day' },
  { id: 'statue', a: 1566, b: 1734, light: 'night' },
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
    skyTop: '#0d1526', skyHor: '#27395c', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 1.03, vig: 0.3, shadowExt: 15, aurora: 0.4, ...WATER },
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
  if (S.id === 'launch') return blendLight(LIGHTS.dawn, LIGHTS.day, smooth(ramp(f, 836, 931)));
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
export const IGNITION_F = 745; // "roared" lands at 24.78 s = f743; fire starts f745
export const rocketYAt = (f) => {
  if (f < 748) return 0;
  const u = ramp(f, 748, 931);
  return Math.pow(u, 1.35) * 46; // accelerating climb the ground camera can actually track (~46 m by the dip)
};
export const laikaStreetZ = (f) => kf([[0, 6.5], [191, 0.9], [237, 0.9]], f);
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

export const heroPosAt = (f) => { // Laika's card position (sweep + breath puffs)
  const S = shotAt(f);
  switch (S.id) {
    case 'street': return [0.8, 0, laikaStreetZ(f)];
    case 'chosen': return [0.8, 0, 0.4];
    case 'training':
      if (f < 478) return [32.9, 0, -4.55];
      if (f < 540) return [36.5, 0.42, -5.5];
      return [34.8, 0, -3.2];
    case 'orbit': return [0, 100.05, 148.72];
    case 'window': return [0.8, 100.55, 147];
    case 'statue': return [26, 0.97, 34];
    default: return null;
  }
};

// ---------- cameras ----------
const CAMS = {
  street: [
    { f: 0, pos: [3.4, 1.05, 10.6], look: [0.8, 0.68, 4.6], fov: 42 },
    { f: 191, pos: [2.6, 0.92, 5.4], look: [0.8, 0.64, 0.7], fov: 38, ease: 'surge' },
    { f: 237, pos: [2.55, 0.92, 4.9], look: [0.85, 0.64, 0.45], fov: 37.5 },
  ],
  chosen: [
    { f: 238, pos: [2.55, 0.92, 4.9], look: [0.85, 0.64, 0.45], fov: 37.5 },
    { f: 320, pos: [2.95, 1.12, 5.3], look: [1.0, 0.85, -0.25], fov: 44, ease: 'surge' },
    { f: 415, pos: [3.1, 1.18, 5.5], look: [0.95, 0.88, -0.3], fov: 44 },
  ],
  training: [
    { f: 416, pos: [37.2, 1.35, 0.9], look: [32.9, 0.8, -4.9], fov: 44 },
    { f: 470, pos: [36.9, 1.32, 0.6], look: [32.9, 0.82, -4.85], fov: 44 },
    { f: 508, pos: [40.3, 1.6, 0.8], look: [35.9, 0.85, -4.9], fov: 44, ease: 'surge' },
    { f: 540, pos: [40.3, 1.6, 0.8], look: [35.9, 0.85, -4.9], fov: 44 },
    { f: 578, pos: [38.2, 1.4, 1.6], look: [34.7, 0.8, -3.1], fov: 42, ease: 'surge' },
    { f: 610, pos: [37.9, 1.36, 1.4], look: [34.7, 0.82, -3.12], fov: 42 },
  ],
  watches: [
    { f: 611, pos: [-21.5, 2.2, 31.5], look: [-36.8, 3.8, 7.8], fov: 42 },
    { f: 675, pos: [-22.0, 2.25, 31.1], look: [-37.0, 3.9, 7.7], fov: 42, ease: 'surge' },
    { f: 721, pos: [-22.3, 2.3, 30.8], look: [-37.2, 4.0, 7.6], fov: 42 },
  ],
  launch: [
    { f: 722, pos: [-21.8, 2.8, 32.2], look: [-37.2, 4.8, 7], fov: 42 },
    { f: 800, pos: [-22.6, 3.6, 30.8], look: [-37.5, 11, 6.7], fov: 42, ease: 'surge' },
    { f: 886, pos: [-24.8, 5.2, 29.2], look: [-38, 29, 6.2], fov: 44, ease: 'surge' },
    { f: 931, pos: [-25.6, 6.0, 28.6], look: [-38, 41, 6], fov: 44 },
  ],
  orbit: [
    { f: 932, pos: [6.8, 102.6, 137.5], look: [0, 97.2, 151], fov: 44 },
    { f: 1055, pos: [5.4, 101.9, 136.2], look: [-0.4, 96.8, 152], fov: 42, ease: 'surge' },
    { f: 1102, pos: [5.1, 101.8, 135.9], look: [-0.5, 96.8, 152.2], fov: 41.5 },
  ],
  window: [
    { f: 1103, pos: [1.7, 101.0, 141.3], look: [-0.3, 100.9, 149], fov: 36 },
    { f: 1208, pos: [1.6, 100.95, 141.5], look: [-0.28, 100.88, 149], fov: 35, ease: 'surge' },
    { f: 1250, pos: [1.5, 100.9, 141.6], look: [-0.25, 100.85, 149], fov: 34.5 },
  ],
  door: [
    { f: 1251, pos: [-25.8, 2.3, 22.5], look: [-36.2, 2.4, 8.5], fov: 44 },
    { f: 1409, pos: [-27.4, 2.0, 20.2], look: [-35.6, 2.8, 9.2], fov: 41, ease: 'surge' },
    { f: 1517, pos: [-28.4, 1.9, 19.2], look: [-35.2, 3.1, 9.6], fov: 39, ease: 'surge' },
    { f: 1565, pos: [-28.7, 1.85, 18.9], look: [-35.1, 3.2, 9.7], fov: 38.5 },
  ],
  statue: [
    { f: 1566, pos: [26, 2.0, 47.0], look: [26, 2.4, 33.4], fov: 40 },
    { f: 1734, pos: [26, 1.8, 44.8], look: [26, 2.35, 33.6], fov: 40, ease: 'surge' },
  ],
};
const SHADOW_AT = { street: [0.8, 0.5, 2], chosen: [1.2, 0.5, 0], training: [34, 0.5, -4.5], watches: [-38, 4, 6], launch: [-38, 4, 6], orbit: [0, 100, 150], window: [0, 100.5, 147], door: [-35, 1, 10], statue: [26, 1, 34] };
const BRIDGES = { chosen: 14, launch: 12 }; // same-set or continuous enters; location changes dip
const DIPS = [416, 611, 932, 1103, 1251, 1566];
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
  if (S.id === 'launch' && f >= IGNITION_F) { // liftoff rumble: tiny deterministic shake, fading as she climbs
    const amp = 0.03 * (1 - ramp(f, IGNITION_F, 860));
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
    case 'street': point = [0.8, 0.6, laikaStreetZ(f)]; cinf = 10; break;
    case 'chosen': point = [1.1, 0.9, 0]; cinf = 9; break;
    case 'training': point = [34.2, 0.9, -4.8]; cinf = 7; break;
    case 'watches': point = [-38, 6.5, 6.5]; cinf = 3; break;
    case 'launch': point = [-38.3, 8 + rocketYAt(f) * 0.7, 6.3]; cinf = 4; break;
    case 'orbit': point = [0, 98, 150]; cinf = 0.9; break;
    case 'window': point = [0.6, 100.8, 147.5]; cinf = 2.2; break;
    case 'door': point = [-34.8, 1.6, 11]; cinf = 6; break;
    case 'statue': point = [26, 2.1, 34]; cinf = 8; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state (drives set pieces + FX in main.js worldState) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lanternSet: [], mist: 0.08, snowK: 0, windK: 0.4, starK: 0, winGlow: 0, statueGlint: 0, breathK: 0, sparkleK: 0, earthK: 0 };
  switch (S.id) {
    case 'street': W.lanternSet = [0, 1, 2]; W.snowK = 0.55; W.windK = 0.7; W.starK = 0.25; W.winGlow = 0.9; W.breathK = 1; W.mist = 0.14; break;
    case 'chosen': W.lanternSet = [0, 1]; W.snowK = 0.5; W.windK = 0.6; W.starK = 0.25; W.winGlow = 0.9; W.breathK = 0.7; W.mist = 0.12; break;
    case 'training': W.snowK = 0; W.windK = 0.05; W.starK = 0; W.winGlow = 0.4; break;
    case 'watches': W.snowK = 0.12; W.windK = 0.5; W.starK = 0; W.mist = 0.1; break;
    case 'launch': W.snowK = 0.1 * (1 - ramp(f, 748, 860)); W.windK = 0.6; W.mist = 0.08; break;
    case 'orbit': W.starK = 1; W.sparkleK = 0.8; W.earthK = 1; W.windK = 0; break;
    case 'window': W.starK = 0.9; W.sparkleK = smooth(ramp(f, 1103, 1160)); W.earthK = 1; break;
    case 'door': W.snowK = 0; W.windK = 0.35; W.starK = 0; break;
    case 'statue':
      W.lanternSet = [5, 6]; W.snowK = 0.25; W.windK = 0.25; W.starK = 1; W.mist = 0.05;
      W.statueGlint = f < 1650 ? 0 : 0.95 * smooth(ramp(f, 1650, 1700)); break;
  }
  return W;
};
/** Rocket fire + pad steam profile per frame (pure — main.js steps the FX sim). */
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'street': case 'chosen': return { fireRate: 0, fireScale: 0.6, smokeRate: 1.6 }; // building chimneys
    case 'training': return { fireRate: 0, fireScale: 0.5, smokeRate: 0 };
    case 'watches': return { fireRate: 0, fireScale: 0.6, smokeRate: 0.8 }; // pad vent wisps
    case 'launch': {
      const on = f >= IGNITION_F && f < 812;
      return { fireRate: on ? 46 : 0, fireScale: on ? 2.6 : 0.6, smokeRate: f >= IGNITION_F ? 26 : 0.8 };
    }
    default: return { fireRate: 0, fireScale: 0.5, smokeRate: 0 };
  }
};

// ---------- actors (2D cards) ----------
const SCI = 'scientist', SCI_B = 'scientistB';
const KID = { tunic: '#b8524a', skin: '#f5c9a0', hair: '#3b2a20' };
const R = (T, who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'obj') + JSON.stringify(o) + JSON.stringify(who), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RL = (T, o, pos, extra = {}) => ({ key: 'laika' + JSON.stringify(o), draw: (p) => T.laikaCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { dusk: '#ffd9b8', room: '#ffe4c4', dawn: '#ffe9c4', day: '#ffffff', space: '#dfe8ff', night: '#c3d2ff' };
const tintFor = (S) => TINT[S.light] || '#ffffff';

const CROWD = [ // the world at the fence (watches/launch): x, outfit, expr, seed
  [-44.5, 'civA', 'grin', 31], [-42.4, 'civB', 'smile', 14], [-40.3, 'civC', 'neutral', 19],
  [-38.2, 'civA', 'smile', 23], [-36.1, 'civB', 'grin', 27], [-34.0, 'civC', 'grin', 11],
  [-31.9, 'civA', 'neutral', 36], [-29.8, 'civB', 'smile', 41],
];

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S);
  switch (S.id) {
    case 'street': {
      const z = laikaStreetZ(f);
      const sniffing = f > 128 && f < 168;
      out.push(RL(T, { view: 'side', step: q((f * 0.085) % 1, 2), headDown: sniffing ? 0.55 : 0.06,
        earsUp: sniffing ? 0.4 : 0.85, wag: 0.35, pant: 0, blink: blinkAt(f, 7) },
        [0.8, 0, z], { tint, s: 0.66 }));
      break;
    }
    case 'chosen': {
      out.push(RL(T, { view: 'front', expr: 'happy', earsUp: 1, wag: 1, wagPh: q((f * 0.055) % 1, 2), pant: 1, blink: blinkAt(f, 7) },
        [0.8, breath(f, 3) * 0.5, 0.4], { tint, s: 0.7 }));
      out.push(R(T, SCI, { seed: 12, expr: 'smile', L: 'hang', R: 'reach', lift: 0.1, blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: -3 },
        [1.95, 0, -0.95], { tint, s: 1.0, yaw: -0.3 }));
      out.push(R(T, SCI_B, { seed: 21, expr: 'grin', L: 'belly', R: 'belly', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), headTilt: 2 },
        [-0.55, 0, -1.7], { tint, s: 0.98, yaw: 0.3 }));
      break;
    }
    case 'training': {
      out.push(R(T, SCI, { seed: 12, expr: f >= 540 ? 'smile' : 'stern', L: 'hang', R: f >= 540 ? 'reach' : 'point', lift: 0.12,
        blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: -2 },
        f >= 540 ? [34.0, 0, -2.3] : [32.2, 0, -3.3], { tint, s: 1.0, yaw: f >= 540 ? 0.5 : -0.5 }));
      if (f < 478) { // at the capsule: brave, ears up
        out.push(RL(T, { view: 'front', expr: 'brave', earsUp: 1, wag: 0.3, blink: blinkAt(f, 7) },
          [32.9, 0, -4.55], { tint, s: 0.66 }));
      } else if (f < 540) { // on the spin chair: brave, slight sway
        out.push(RL(T, { view: 'front', expr: 'brave', earsUp: 0.9, wag: 0.2, blink: blinkAt(f, 7),
          wagPh: q((f * 0.03) % 1, 2) },
          [36.5, 0.42, -5.5], { tint, s: 0.62, ground: 0.42, roll: q(Math.sin(f * 0.05) * 0.03, 3) }));
      } else { // treats!
        out.push(RL(T, { view: 'front', expr: 'happy', earsUp: 1, wag: 1, wagPh: q((f * 0.06) % 1, 2), pant: 1, blink: blinkAt(f, 7) },
          [34.8, breath(f, 3) * 0.5, -3.2], { tint, s: 0.66 }));
      }
      break;
    }
    case 'watches': case 'launch': {
      const cheer = S.id === 'launch' && f >= IGNITION_F;
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
    case 'orbit': break; // exterior: the capsule + its lit window carry the beat; her face gets the P7 interior close-up
    case 'window': {
      const won = f < 1175;
      out.push(RL(T, { view: 'front', expr: won ? 'wonder' : 'calm', earsUp: won ? 1 : 0.8, wag: 0.3,
        wagPh: q((f * 0.02) % 1, 2), suit: 1, float: 1, blink: blinkAt(f, 7) },
        [0.8, 100.55 + q(Math.sin(f * 0.045) * 0.05, 3), 147], { tint: '#ffe9d2', s: 0.85, roll: q(Math.sin(f * 0.03) * 0.045, 3), blob: false, shadow: false }));
      break;
    }
    case 'door': {
      out.push(R(T, 'astro', { seed: 9, expr: 'grin', L: 'wave', R: 'hang', wv: q(f * 0.28, 1), blink: blinkAt(f, 9), bob: q(breath(f, 9), 3), headTilt: -4 },
        [-34.5, 0, 11.5], { tint, s: 1.02 }));
      out.push(R(T, SCI, { seed: 12, expr: 'smile', L: 'hang', R: 'point', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: -3 },
        [-32.4, 0, 13.6], { tint, s: 1.0, yaw: 0.35 }));
      out.push(R(T, KID, { seed: 23, expr: 'grin', L: 'up', R: 'up', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3) },
        [-34.9, 0, 13.1], { tint, s: 0.62 }));
      break;
    }
    case 'statue': {
      out.push(RL(T, { view: 'front', statue: 1, expr: 'calm', earsUp: 1 },
        [26, 0.97, 34], { tint, s: 1.05, ground: 0.99, blob: true }));
      out.push(R(T, SCI, { seed: 12, expr: 'smile', L: 'belly', R: 'belly', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: -2 },
        [24.3, 0, 38.7], { tint, s: 0.98, yaw: 0.25 }));
      out.push(R(T, KID, { seed: 23, expr: 'grin', L: 'hang', R: 'point', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3), headTilt: -3 },
        [27.9, 0, 39.0], { tint, s: 0.62, yaw: -0.2 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if ((S.id === 'orbit' || S.id === 'window')) { // zero-g sparkles drifting past
    for (let i = 0; i < 2; i++) {
      const t = q(((f / 130) + i * 0.47 + 0.13) % 1, 2);
      const base = S.id === 'orbit' ? [3.5 - i * 6.5, 102.6 - i * 3.4, 146] : [2.6 - i * 4.6, 101.9 - i * 1.4, 146.2];
      out.push(FXC('spk' + i + '_' + t, (p) => T.fxStars(p, t), base, 0.34));
    }
  }
  if (S.id === 'statue' && f >= 1650) { // a soft star burst blooms over the statue at the close
    const t = q((f - 1650) / 84, 2);
    out.push(FXC('burst_' + t, (p) => T.fxBurst(p, t, '#ffe9a8', 10, 30, 210), [26, 3.1, 33.4], 0.8));
  }
  return out;
};
