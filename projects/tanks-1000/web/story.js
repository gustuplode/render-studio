// "1000 Tanks vs 1000 Tanks" — comparison Short (USA vs China), tren voice.
// Pure frame math only (no THREE, no DOM): TIMING, environment, fleet grids
// (exactly 1000 vs 1000 in world data), hero tanks, the cannon duel, night
// fight, supply trucks, commander cards, boards, one continuous camera flight.
// main.js renders; sweep.mjs verifies. TIMING rows are PATCHED from
// tanks-1000-voice/timing.json after the voice build — every key below is a
// shot FRACTION (u) mapped through SEG, so patching re-times the whole film.
import { clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30;
// ---------- THE timing table: [id, startFrame, endFrame] (tuple rows) ----------
export const TIMING = [
  ['hook', 0, 150],
  ['us', 162, 256],
  ['armour', 268, 414],
  ['cn', 426, 603],
  ['speed', 615, 720],
  ['duel1', 732, 822],
  ['duel2', 834, 1041],
  ['night', 1053, 1136],
  ['nightfight', 1148, 1287],
  ['twist', 1299, 1423],
  ['trucks', 1435, 1636],
  ['verdict1', 1648, 1765],
  ['verdict2', 1777, 1865],
  ['verdict3', 1877, 1982],
];
export const TOTAL = TIMING[TIMING.length - 1][2]; // frames 0..TOTAL-1
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
// section at frame f; gaps HOLD the previous section (u clamps to 1)
export const secAt = (f) => {
  let s = SEG[TIMING[0][0]];
  for (const [id, a] of TIMING) { if (f >= a) s = SEG[id]; else break; }
  return { id: s.id, a: s.a, b: s.b, len: s.len, u: clamp((f - s.a) / s.len) };
};
export const smooth = (u) => u * u * (3 - 2 * u);
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) };
const ph = (id, f) => clamp((f - SEG[id].a) / SEG[id].len);
// fraction-keyed tracks: rows [u, value, ease?, via?] -> absolute-frame kf rows
const K3 = (id, rows) => rows.map(([u, p, e, via]) => [Math.round(SEG[id].a + u * SEG[id].len), p, e, via]);
const K1 = (id, rows) => rows.map(([u, v, e]) => [Math.round(SEG[id].a + u * SEG[id].len), v, e]);

// ---------- environment: desert day -> dusk -> NV night -> dawn gold ----------
const C = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const DAY = { top: '#5f97d6', hor: '#e8d9b0', fog: '#e3d3ac', fn: 90, ff: 720, az: 120, el: 42, sun: '#fff0d0', sunI: 2.9, hSky: '#ffe9c4', hGnd: '#8a6f4a', hemi: 1.05, nv: 0, dust: 0.5 };
const DUSK = { top: '#3d4a6b', hor: '#e8905c', fog: '#8a6a58', fn: 60, ff: 430, az: 250, el: 8, sun: '#ff9440', sunI: 1.7, hSky: '#c8a58c', hGnd: '#403a34', hemi: 0.8, nv: 0.3, dust: 0.35 };
const NIGHT = { top: '#071a10', hor: '#122e20', fog: '#0f2e1e', fn: 42, ff: 320, az: 250, el: 24, sun: '#9fd8b4', sunI: 0.55, hSky: '#356b4a', hGnd: '#10160f', hemi: 0.5, nv: 1, dust: 0.15 };
const PREDAWN = { top: '#46536e', hor: '#d9a06a', fog: '#9a8a76', fn: 62, ff: 460, az: 255, el: 6, sun: '#ffb46c', sunI: 1.6, hSky: '#c8b090', hGnd: '#4c4438', hemi: 0.8, nv: 0, dust: 0.3 };
const GOLD = { top: '#6a7ab0', hor: '#ffd9a0', fog: '#eebd8a', fn: 85, ff: 680, az: 262, el: 10, sun: '#ffc46b', sunI: 2.5, hSky: '#ffe0b0', hGnd: '#54483c', hemi: 1.0, nv: 0, dust: 0.45 };
const ENV_KEYS = [
  [0, DAY], [SEG.duel2.b, DAY],
  [Math.round(SEG.night.a + 0.55 * SEG.night.len), DUSK], [SEG.nightfight.a, NIGHT],
  [SEG.twist.a, PREDAWN], [Math.round(SEG.trucks.a + 0.4 * SEG.trucks.len), PREDAWN],
  [SEG.verdict1.a, GOLD], [TOTAL - 1, GOLD],
];
const COL_FIELDS = ['top', 'hor', 'fog', 'sun', 'hSky', 'hGnd'];
const NUM_FIELDS = ['fn', 'ff', 'az', 'el', 'sunI', 'hemi', 'nv', 'dust'];
export const envAt = (f) => {
  let i = 0;
  while (i < ENV_KEYS.length - 2 && f > ENV_KEYS[i + 1][0]) i++;
  const [f0, A] = ENV_KEYS[i], [f1, B] = ENV_KEYS[i + 1];
  const u = clamp((f - f0) / Math.max(1, f1 - f0));
  const out = {};
  for (const k of COL_FIELDS) out[k] = lerp3(C(A[k]), C(B[k]), u);
  for (const k of NUM_FIELDS) out[k] = lerp(A[k], B[k], u);
  return out;
};

// ---------- THE COUNT: exactly 1000 + 1000 tanks, in countable grid rows ----------
// US grid west (faces +x, ry=0), CN grid east (faces -x, ry=PI). 25 cols x 40 rows.
export const US_N = 1000, CN_N = 1000;
const COLS = 25, ROWS = 40, DX = 12, DZ = 7;
export function fleetPosAt(side, i) {
  const col = i % COLS, row = (i / COLS) | 0;
  const z = -136.5 + row * DZ;
  const turret = (hash(i * 3 + (side === 'US' ? 7 : 13)) - 0.5) * 0.35;
  if (side === 'US') return { p: [-318 + col * DX, 0, z], ry: 0, turret };
  return { p: [318 - col * DX, 0, z], ry: Math.PI, turret };
}
export const countAt = (side) => (side === 'US' ? US_N : CN_N); // fleets never hide: the count is literal, always

// ---------- hero tanks ----------
// Heading convention: local forward = +X; world dir = [cos(ry), 0, -sin(ry)].
const aimYaw = (p, t) => Math.atan2(-(t[2] - p[2]), t[0] - p[0]);
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const US_HOME = [-20, 0, -6], CN_HOME = [20, 0, 6];
// duel spots sit in the OPEN plain east/west of the grids (US grid east edge is
// x=-30, CN grid west edge is x=+30) so the heroes never hide inside the rows.
const US_DUEL = [-16, 0, -98], CN_DUEL = [16, 0, -118];
const usDrivePath = (f) => kf3(K3('duel1', [[0, US_HOME], [0.45, US_DUEL, 'easeInOut', [[-24, 0, -52]]], [1, US_DUEL]]), f);
const cnDrivePath = (f) => kf3(K3('speed', [[0, CN_HOME], [0.18, [21, 0, -22]], [0.52, [19, 0, -72]], [0.8, CN_DUEL], [1, CN_DUEL]]), f);
const pathYaw = (pathFn, f) => {
  const a = pathFn(f), b = pathFn(Math.min(f + 2, TOTAL - 1));
  const dx = b[0] - a[0], dz = b[2] - a[2];
  return Math.hypot(dx, dz) < 1e-6 ? null : Math.atan2(-dz, dx);
};
const pathSpeed = (pathFn, f) => {
  const a = pathFn(f), b = pathFn(Math.min(f + 1, TOTAL - 1));
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
};
// fire / hit frames (derived from SEG — patching TIMING re-times the duel)
export const FIRE_US = Math.round(SEG.duel1.a + 0.55 * SEG.duel1.len);
export const FIRE_CN = Math.round(SEG.duel2.a + 0.40 * SEG.duel2.len);
export const ARM_HIT = Math.round(SEG.armour.a + 0.55 * SEG.armour.len);
export const SHELL_FLIGHT = 16;
export const HIT_CN = FIRE_US + SHELL_FLIGHT;
export const HIT_US = FIRE_CN + SHELL_FLIGHT;
export const NF1 = Math.round(SEG.nightfight.a + 0.30 * SEG.nightfight.len);
export const NF2 = Math.round(SEG.nightfight.a + 0.68 * SEG.nightfight.len);
const rockAt = (f, f0, amp) => (f >= f0 && f < f0 + 18) ? amp * Math.sin((f - f0) * 0.9) * Math.exp(-(f - f0) / 6) : 0;
const recoilAt = (f, f0) => (f >= f0 && f < f0 + 12) ? Math.sin(Math.PI * (f - f0) / 12) * 0.5 : 0;

// positions/yaws are standalone (no turret aim) so the two heroes can aim at
// each other without mutual recursion.
function usPosAt(f) {
  if (f < SEG.duel1.a) return [...US_HOME];
  if (f <= SEG.duel1.b) return usDrivePath(f);
  return [...US_DUEL];
}
function cnPosAt(f) {
  if (f < SEG.speed.a) return [...CN_HOME];
  if (f <= SEG.speed.b) return cnDrivePath(f);
  return [...CN_DUEL];
}
function usYawAt(f) {
  if (f < SEG.duel1.a) return 0;
  if (f <= SEG.duel1.b) return ph('duel1', f) > 0.45 ? 0.56 : (pathYaw(usDrivePath, f) ?? 0);
  return 0.56;
}
function cnYawAt(f) {
  if (f < SEG.speed.a) return Math.PI;
  if (f <= SEG.speed.b) return pathYaw(cnDrivePath, f) ?? Math.PI;
  return 2.58;
}
export function heroUSAt(f) {
  const p = usPosAt(f), ry = usYawAt(f);
  const speed = (f >= SEG.duel1.a && f <= SEG.duel1.b) ? pathSpeed(usDrivePath, f) : 0;
  // turret: scans while parked early, then locks onto the CN hero
  const turret = f < SEG.cn.a ? 0.22 * Math.sin(f * 0.013) : wrapPi(aimYaw(p, cnPosAt(f)) - ry);
  return { p, ry, turret, pitch: 0.05, recoil: recoilAt(f, FIRE_US), rock: rockAt(f, HIT_US, 0.02) + rockAt(f, ARM_HIT, 0.015), speed };
}
export function heroCNAt(f) {
  const p = cnPosAt(f), ry = cnYawAt(f);
  const speed = (f >= SEG.speed.a && f <= SEG.speed.b) ? pathSpeed(cnDrivePath, f) : 0;
  const turret = f < SEG.duel1.a ? 0.22 * Math.sin(f * 0.011 + 2) : wrapPi(aimYaw(p, usPosAt(f)) - ry);
  return { p, ry, turret, pitch: 0.05, recoil: recoilAt(f, FIRE_CN), rock: rockAt(f, HIT_CN, 0.035), speed };
}
export function heroPosAt(side, f) { return side === 'US' ? usPosAt(f) : cnPosAt(f); }

/** Muzzle world position for a firing side at frame f (heroes + night fleet shots). */
export function muzzleAt(side, f) {
  if (f === NF1 || f === NF2) {
    const i = side === 'US' ? 437 : 612;
    const fp = fleetPosAt(side, i);
    const d = side === 'US' ? [1, 0, 0] : [-1, 0, 0];
    return [fp.p[0] + d[0] * 4.6, 2.3, fp.p[2] + d[2] * 4.6];
  }
  const h = side === 'US' ? heroUSAt(f) : heroCNAt(f);
  const wy = h.ry + h.turret;
  return [h.p[0] + Math.cos(wy) * 4.9, 2.35, h.p[2] - Math.sin(wy) * 4.9];
}

// ---------- shells (analytic tracers) ----------
const shellSeg = (from, to, f0, flight, f) => {
  if (f0 === null || f < f0 || f > f0 + flight) return null;
  const u = (f - f0) / flight;
  const p = lerp3(from, to, u); p[1] = lerp(from[1], to[1], u) + Math.sin(u * Math.PI) * 1.1;
  return { p, u };
};
export function shellsAt(f) {
  const out = [];
  // armour test shot: streaks in from the east, clangs off the Abrams' front
  const usH = heroUSAt(f), cnH = heroCNAt(f);
  const testFrom = [70, 3.2, -6], testTo = [usH.p[0] + 3.4, 1.9, usH.p[2]];
  const s0 = shellSeg(testFrom, testTo, ARM_HIT - SHELL_FLIGHT, SHELL_FLIGHT, f);
  if (s0) out.push({ id: 'test', ...s0 });
  const s1 = shellSeg(muzzleAt('US', FIRE_US), [cnH.p[0] - 2.6, 1.9, cnH.p[2]], FIRE_US, SHELL_FLIGHT, f);
  if (s1) out.push({ id: 'us', ...s1 });
  const s2 = shellSeg(muzzleAt('CN', FIRE_CN), [usH.p[0] + 2.8, 1.9, usH.p[2]], FIRE_CN, SHELL_FLIGHT, f);
  if (s2) out.push({ id: 'cn', ...s2 });
  const nfFrom1 = muzzleAt('US', NF1), nfFrom2 = muzzleAt('CN', NF2);
  const s3 = shellSeg(nfFrom1, [nfFrom1[0] + 55, 1.2, nfFrom1[2] + 6], NF1, 20, f);
  if (s3) out.push({ id: 'nf1', ...s3 });
  const s4 = shellSeg(nfFrom2, [nfFrom2[0] - 55, 1.2, nfFrom2[2] - 6], NF2, 20, f);
  if (s4) out.push({ id: 'nf2', ...s4 });
  return out;
}
export const EVENTS = [
  { f: ARM_HIT - SHELL_FLIGHT, type: 'fireFar', side: 'CN', at: [70, 3.2, -6] },
  { f: ARM_HIT, type: 'hitTest', side: 'US' },
  { f: FIRE_US, type: 'fire', side: 'US' },
  { f: HIT_CN, type: 'hit', side: 'CN' },
  { f: FIRE_CN, type: 'fire', side: 'CN' },
  { f: HIT_US, type: 'hit', side: 'US' },
  { f: NF1, type: 'fire', side: 'US', fleet: true },
  { f: NF1 + 20, type: 'dustFar', side: 'US' },
  { f: NF2, type: 'fire', side: 'CN', fleet: true },
  { f: NF2 + 20, type: 'dustFar', side: 'CN' },
];

// ---------- supply trucks: parked depot rows + a two-lane convoy ----------
export const TRUCK_N = 30;
export function truckAt(i, f) {
  if (i < 16) { // parked at the depot, 2 rows of 8
    const col = i % 8, row = (i / 8) | 0;
    return { p: [-120 + col * 13, 0, -208 + row * 11], ry: 0, moving: 0 };
  }
  const k = i - 16; // 14 convoy trucks
  if (k % 2 === 0) { // eastbound lane z=-176
    const x = -300 + ((k * 43 + f * 0.26) % 600);
    return { p: [x, 0, -176], ry: 0, moving: 1 };
  }
  const x = 300 - ((k * 51 + f * 0.22) % 600); // westbound lane z=-188
  return { p: [x, 0, -188], ry: Math.PI, moving: 1 };
}

// ---------- commander cards (placement + acting, per section) ----------
const cmdr = (who, p, expr, L, R, seed, s = 1) => ({ who, p, expr, L, R, seed, s });
export function cmdrAt(f) {
  const S = secAt(f), u = S.u, out = [];
  switch (S.id) {
    case 'us':
      out.push(cmdr('cmdUS', [-13, 0, 5], u > 0.55 ? 'grin' : 'stern', 'hang', (u > 0.25 && u < 0.8) ? 'point' : 'hang', 31));
      break;
    case 'armour':
      out.push(cmdr('cmdUS', [-13, 0, 5], 'stern', 'hip', 'hang', 31));
      break;
    case 'cn':
      out.push(cmdr('cmdCN', [13, 0, -5], u > 0.55 ? 'grin' : 'stern', (u > 0.25 && u < 0.8) ? 'point' : 'hang', 'hang', 47));
      break;
    case 'duel1':
      out.push(cmdr('cmdUS', [-30, 0, -88], 'stern', 'hang', u > 0.4 ? 'point' : 'hang', 31));
      break;
    case 'duel2':
      out.push(cmdr('cmdCN', [23, 0, -110], f < HIT_CN + 26 ? 'shock' : 'stern', 'hang', (f > FIRE_CN - 12 && f < FIRE_CN + 16) ? 'point' : 'hang', 47));
      break;
    case 'nightfight':
      out.push(cmdr('cmdUS', [-30, 0, -88], 'stern', 'hip', 'hang', 31));
      break;
    case 'trucks':
      out.push(cmdr('cmdUS', [-64, 0, -196], 'smile', 'hang', (u > 0.3 && u < 0.75) ? 'point' : 'hang', 31));
      break;
    case 'verdict1':
      out.push(cmdr('cmdUS', [-60, 0, 63], 'grin', 'hang', 'up', 31));
      break;
    case 'verdict2':
      out.push(cmdr('cmdCN', [60, 0, -63], 'grin', 'up', 'hang', 47));
      break;
    case 'verdict3':
      out.push(cmdr('cmdUS', [0.06, 0, -41.1], 'laugh', 'hang', 'wave', 31));
      out.push(cmdr('cmdCN', [2.64, 0, -38.9], 'laugh', 'wave', 'hang', 47));
      break;
  }
  return out;
}

// ---------- boards (big stat cards, shown on their voice words) ----------
export function boardAt(f) {
  const S = secAt(f), u = S.u;
  const win = (a, b) => (u >= a && u <= b) ? smooth(ramp(f, S.a + a * S.len, S.a + a * S.len + 8)) * (b >= 1 ? 1 : (1 - smooth(ramp(f, S.b - (1 - b) * S.len - 8, S.b - (1 - b) * S.len)))) : 0;
  const US = { bg: '#1c3050', fg: '#ffd76a' }, CN = { bg: '#501c1c', fg: '#ffd76a' }, NT = { bg: '#20242c', fg: '#ffd76a' };
  switch (S.id) {
    case 'hook': { const a = win(0.04, 0.94); return a > 0 ? { text: '1000 vs 1000', alpha: a, ...NT } : null; }
    case 'us': { const a = win(0.1, 0.88); return a > 0 ? { text: 'THE ABRAMS', alpha: a, ...US } : null; }
    case 'armour': { const a = win(0.28, 0.92); return a > 0 ? { text: 'STEEL-SANDWICH ARMOUR', alpha: a, ...US } : null; }
    case 'cn': { const a = win(0.1, 0.88); return a > 0 ? { text: 'TYPE 99', alpha: a, ...CN } : null; }
    case 'speed': { const a = win(0.25, 0.92); return a > 0 ? { text: '75 KM/H', alpha: a, ...CN } : null; }
    case 'duel2': { const a = win(0.52, 0.96); return a > 0 ? { text: 'RANGE: 4 KM', alpha: a, ...NT } : null; }
    case 'twist': { const a = win(0.3, 0.94); return a > 0 ? { text: 'HALF THE BATTLE IS THE TRUCK', alpha: a, ...NT } : null; }
    case 'verdict1': { const a = win(0.15, 0.92); return a > 0 ? { text: 'USA: ARMOUR + CREWS', alpha: a, ...US } : null; }
    case 'verdict2': { const a = win(0.15, 0.92); return a > 0 ? { text: 'CHINA: SPEED + NUMBERS', alpha: a, ...CN } : null; }
    case 'verdict3': { const a = win(0.2, 1.0); return a > 0 ? { text: 'STILL RUNNING ON DAY THREE!', alpha: a, ...NT } : null; }
  }
  return null;
}

// ---------- CAMERA: one continuous flight, voice-tracked (V2 doctrine) ----------
const BK = 9; // boundary cross-blend half-window (frames)
const CAMSEGS = [
  { id: 'hook', fn: (f) => ({
    pos: kf3(K3('hook', [[0, [-150, 7, 95]], [0.26, [-205, 55, 70]], [0.62, [-60, 128, 30]], [0.8, [40, 112, -40]], [0.91, [-2, 58, -12]], [1, [-26, 6, 14]]]), f),
    look: kf3(K3('hook', [[0, [-40, 0, 0]], [0.3, [-120, 0, 0]], [0.6, [30, 0, 0]], [0.82, [80, 0, 0]], [1, [-13, 1.6, 5]]]), f), fov: kf(K1('hook', [[0, 55], [1, 50]]), f) }) },
  { id: 'us', fn: (f) => ({
    pos: kf3(K3('us', [[0, [-26, 6, 14]], [0.3, [-17.6, 2.0, 9.6]], [0.6, [-18.6, 1.9, 8.8]], [1, [-28, 3.2, -1]]]), f),
    look: kf3(K3('us', [[0, [-13, 1.6, 5]], [0.55, [-13, 1.6, 5]], [1, [-20, 1.8, -6]]]), f), fov: 46 }) },
  { id: 'armour', fn: (f) => ({
    pos: kf3(K3('armour', [[0, [-28, 3.2, -1]], [0.5, [-27, 2.4, -12]], [1, [-13, 2.2, -13]]]), f),
    look: kf3(K3('armour', [[0, [-20, 1.8, -6]], [1, [-17, 1.7, -6]]]), f), fov: 48 }) },
  { id: 'cn', fn: (f) => ({
    pos: kf3(K3('cn', [[0, [-13, 2.2, -13]], [0.3, [0, 7, -18]], [0.55, [19, 2.3, -11]], [0.8, [17, 2.2, -9]], [1, [12, 1.8, 14]]]), f),
    look: kf3(K3('cn', [[0, [-17, 1.7, -6]], [0.4, [13, 1.6, -5]], [0.8, [13, 1.6, -5]], [1, [20, 1.8, 6]]]), f), fov: 46 }) },
  { id: 'speed', fn: (f) => { // ride at tread level beside the racing Type 99
    const h = heroCNAt(f);
    return { pos: [h.p[0] - 8, 1.8, h.p[2] + 8], look: [h.p[0], 1.3, h.p[2] - 8], fov: 54 };
  } },
  { id: 'duel1', fn: (f) => { // track the advancing Abrams, then whip to the Type 99 as the shell flies
    const usH = heroUSAt(f), cnH = heroCNAt(f);
    const w = smooth(ramp(f, FIRE_US + 3, HIT_CN - 1));
    return { pos: kf3(K3('duel1', [[0, [8, 1.8, -110]], [0.3, [-2, 4, -95]], [0.6, [-14, 3, -90]], [1, [0, 2.6, -104]]]), f),
      look: lerp3([usH.p[0] + 2.5, 1.7, usH.p[2]], [cnH.p[0], 1.6, cnH.p[2]], w), fov: 50 };
  } },
  { id: 'duel2', fn: (f) => { // watch the Type 99 fire, then whip to the Abrams as the shell lands
    const cnH = heroCNAt(f), usH = heroUSAt(f);
    const w = smooth(ramp(f, FIRE_CN + 2, FIRE_CN + 12));
    return { pos: kf3(K3('duel2', [[0, [0, 2.6, -104]], [0.35, [-2, 3.4, -100]], [0.7, [8, 2.8, -106]], [1, [9, 2.6, -108]]]), f),
      look: lerp3([cnH.p[0], 1.6, cnH.p[2]], [usH.p[0], 1.6, usH.p[2]], w), fov: 50 };
  } },
  { id: 'night', fn: (f) => ({
    pos: kf3(K3('night', [[0, [9, 2.6, -108]], [0.5, [0, 26, -95]], [1, [-16, 34, -70]]]), f),
    look: kf3(K3('night', [[0, [-16, 1.6, -98]], [0.5, [0, 2, -100]], [1, [0, 2, -60]]]), f), fov: 52 }) },
  { id: 'nightfight', fn: (f) => {
    const usH = heroUSAt(f), cnH = heroCNAt(f), u = ph('nightfight', f);
    const w = smooth(ramp(u, 0.5, 0.72));
    return { pos: kf3(K3('nightfight', [[0, [-16, 34, -70]], [0.4, [-26, 3, -90]], [1, [-24, 2.4, -104]]]), f),
      look: lerp3([usH.p[0], 1.8, usH.p[2]], [cnH.p[0], 1.8, cnH.p[2]], w), fov: 50 };
  } },
  { id: 'twist', fn: (f) => ({
    pos: kf3(K3('twist', [[0, [-24, 2.4, -104]], [0.35, [0, 20, -140]], [0.7, [-30, 10, -168]], [1, [-52, 4, -178]]]), f),
    look: kf3(K3('twist', [[0, [26, 1.8, -118]], [0.4, [0, 1, -160]], [1, [-90, 1.5, -190]]]), f), fov: 50 }) },
  { id: 'trucks', fn: (f) => ({
    pos: kf3(K3('trucks', [[0, [-52, 2.4, -184]], [0.5, [-10, 2.0, -186]], [1, [38, 2.2, -186.5]]]), f),
    look: kf3(K3('trucks', [[0, [-90, 1.3, -190]], [0.5, [-40, 1.1, -192]], [1, [0, 1.1, -196]]]), f), fov: 50 }) },
  { id: 'verdict1', fn: (f) => ({
    pos: kf3(K3('verdict1', [[0, [38, 2.2, -186.5]], [0.35, [-2, 52, -148]], [0.6, [-58, 34, -40]], [0.8, [-88, 20, 28]], [1, [-96, 10, 55]]]), f),
    look: kf3(K3('verdict1', [[0, [0, 1.2, -196]], [0.5, [-120, 0, 0]], [1, [-60, 1.5, 63]]]), f), fov: 50 }) },
  { id: 'verdict2', fn: (f) => ({
    pos: kf3(K3('verdict2', [[0, [-96, 10, 55]], [0.45, [0, 60, -10]], [1, [96, 10, -55]]]), f),
    look: kf3(K3('verdict2', [[0, [-60, 1.5, 63]], [0.5, [40, 0, 0]], [1, [60, 1.5, -63]]]), f), fov: 50 }) },
  { id: 'verdict3', fn: (f) => ({
    pos: kf3(K3('verdict3', [[0, [96, 10, -55]], [0.5, [30, 14, -60]], [1, [10, 3, -50]]]), f),
    look: kf3(K3('verdict3', [[0, [60, 1.5, -63]], [0.5, [10, 2, -46]], [1, [2.2, 1.5, -41]]]), f), fov: kf(K1('verdict3', [[0, 50], [1, 44]]), f) }) },
];
const SEG_OF = {}; CAMSEGS.forEach((s) => { SEG_OF[s.id] = s; });
export function camAt(f) {
  const S = secAt(f);
  let i = CAMSEGS.findIndex((s) => s.id === S.id); if (i < 0) i = 0;
  let c = CAMSEGS[i].fn(f);
  const blendTo = (other, w) => { c = { pos: lerp3(c.pos, other.pos, w), look: lerp3(c.look, other.look, w), fov: lerp(c.fov, other.fov, w) }; };
  if (i + 1 < CAMSEGS.length && f > SEG[CAMSEGS[i + 1].id].a - BK) {
    blendTo(CAMSEGS[i + 1].fn(f), smooth(clamp((f - (SEG[CAMSEGS[i + 1].id].a - BK)) / (2 * BK))));
  } else if (i > 0 && f < SEG[CAMSEGS[i].id].a + BK) {
    const p = CAMSEGS[i - 1].fn(f), w = smooth(clamp((f - (SEG[CAMSEGS[i].id].a - BK)) / (2 * BK)));
    c = { pos: lerp3(p.pos, c.pos, w), look: lerp3(p.look, c.look, w), fov: lerp(p.fov, c.fov, w) };
  }
  let { pos, look, fov } = c;
  for (const hf of [HIT_CN, HIT_US, ARM_HIT]) { // impact shake, decaying
    if (f >= hf && f < hf + 12) {
      const a = 0.55 * (1 - (f - hf) / 12);
      pos = [pos[0] + Math.sin(f * 39.7) * a * 0.35, pos[1] + Math.sin(f * 47.3) * a * 0.26, pos[2] + Math.cos(f * 43.1) * a * 0.35];
      look = [look[0] + Math.sin(f * 51.9) * a * 0.4, look[1] + Math.cos(f * 45.7) * a * 0.3, look[2]];
    }
  }
  const t = f / FPS;
  pos = [pos[0] + Math.sin(t * 0.5) * 0.12, pos[1] + Math.sin(t * 0.8) * 0.06, pos[2]]; // handheld breath
  return { pos, look, fov };
}
