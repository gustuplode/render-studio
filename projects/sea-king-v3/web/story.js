// "The King's Battle at Sea" — FX-showcase demo Short (61.164s, 1835 frames @30fps).
// Pure frame math only (no THREE, no DOM): TIMING, cameras, environment, fleet
// formations, volleys, debris. main.js renders; sweep.mjs verifies.
// Every pose is an analytic function of the frame — the FX pools in main.js add
// the transient smoke/fire/splash life on top.
import { clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30;
export const TOTAL = 1835; // frames 0..1834
// ---------- THE timing table: [id, startFrame, endFrame] (tuple rows) ----------
export const TIMING = [
  ['dawn', 0, 396], ['armada', 408, 601], ['bottle', 613, 797], ['order', 809, 945],
  ['battle', 957, 1129], ['burning', 1141, 1270], ['fireship', 1282, 1516],
  ['explosion', 1528, 1677], ['victory', 1689, 1835],
];
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
// section at frame f; gaps HOLD the previous section (u clamps to 1)
export const secAt = (f) => {
  let s = SEG[TIMING[0][0]];
  for (const [id, a] of TIMING) { if (f >= a) s = SEG[id]; else break; }
  return { id: s.id, a: s.a, b: s.b, u: clamp((f - s.a) / s.len) };
};
export const smooth = (u) => u * u * (3 - 2 * u);
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
// scalar keyframes [[frame, v], ...] linear
const k1 = (keys, f) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const [f0, v0] = keys[i - 1], [f1, v1] = keys[i]; return lerp(v0, v1, (f - f0) / Math.max(1, f1 - f0)); }
  }
  return keys[keys.length - 1][1];
};
// vec3 keyframes [[frame, [x,y,z]], ...] linear
const k3 = (keys, f) => {
  if (f <= keys[0][0]) return [...keys[0][1]];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const [f0, v0] = keys[i - 1], [f1, v1] = keys[i]; return lerp3(v0, v1, (f - f0) / Math.max(1, f1 - f0)); }
  }
  return [...keys[keys.length - 1][1]];
};
const rotY = ([lx, lz], ry) => [lx * Math.cos(ry) + lz * Math.sin(ry), -lx * Math.sin(ry) + lz * Math.cos(ry)];

// ---------- sea surface (EXACT replica of the fx.js water vertex shader) ----------
export const WAVE_AMP = 0.55;
export function waveH(x, z, t) {
  return WAVE_AMP * (Math.sin(x * 0.11 + t * 1.15) * 0.45 + Math.sin(z * 0.16 - t * 0.85) * 0.32 + Math.sin((x + z) * 0.055 + t * 0.5) * 0.55);
}
const bobFor = (x, z, t, k = 1) => ({
  y: waveH(x, z, t) * 0.62 * k - 0.30,
  pitch: Math.atan2(waveH(x, z + 2.2, t) - waveH(x, z - 2.2, t), 4.4) * 0.55 * k,
  roll: Math.atan2(waveH(x + 3, z, t) - waveH(x - 3, z, t), 6) * 0.55 * k,
});

// ---------- environment: sky / fog / sun / water colours over the day ----------
const C = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const ENV_KEYS = [
  [0,    { top: '#7580b4', hor: '#f2b8a0', fog: '#eec3ac', fn: 55, ff: 360, az: 100, el: 9,  sun: '#ffd9a8', sunI: 2.1, hSky: '#ffe2cc', hGnd: '#5d564c', hemi: 0.95, deep: '#1e4059', shal: '#6d8aa0', wsky: '#f2c4a8', mist: 0.15, cloud: '#ffd9c9', cop: 0.80 }],
  [500,  { top: '#7180b8', hor: '#eeb9a4', fog: '#e8bfa9', fn: 50, ff: 330, az: 103, el: 11, sun: '#ffdcb0', sunI: 2.2, hSky: '#ffe2cc', hGnd: '#5d564c', hemi: 0.97, deep: '#264862', shal: '#7d94a8', wsky: '#efc0a4', mist: 0.17, cloud: '#ffd9c9', cop: 0.80 }],
  [750,  { top: '#5f8fce', hor: '#ffe3ba', fog: '#dfe4e2', fn: 60, ff: 430, az: 108, el: 17, sun: '#ffe9c4', sunI: 2.6, hSky: '#eaf4ff', hGnd: '#66604f', hemi: 1.05, deep: '#1d4e66', shal: '#3d84a8', wsky: '#bfe3f2', mist: 0.07, cloud: '#ffffff', cop: 0.85 }],
  [1000, { top: '#4a86d8', hor: '#d8ecf4', fog: '#cfdde8', fn: 65, ff: 460, az: 118, el: 38, sun: '#fff2d8', sunI: 2.9, hSky: '#eaf4ff', hGnd: '#6a6a5c', hemi: 1.10, deep: '#1a4a66', shal: '#3f8ab0', wsky: '#bfd9e8', mist: 0.05, cloud: '#ffffff', cop: 0.90 }],
  [1200, { top: '#6a5a52', hor: '#c9a184', fog: '#9a7a5e', fn: 42, ff: 300, az: 124, el: 26, sun: '#e8b083', sunI: 2.0, hSky: '#d8c4ae', hGnd: '#4c463f', hemi: 0.90, deep: '#26343c', shal: '#5d6a68', wsky: '#a8836a', mist: 0.12, cloud: '#cbb49e', cop: 0.80 }],
  [1400, { top: '#4a4460', hor: '#e8905c', fog: '#8a6a58', fn: 48, ff: 320, az: 248, el: 11, sun: '#ff9a4d', sunI: 1.9, hSky: '#c8a58c', hGnd: '#403a34', hemi: 0.80, deep: '#1d3038', shal: '#4d5a5c', wsky: '#d88a58', mist: 0.08, cloud: '#e8a37c', cop: 0.75 }],
  [1610, { top: '#453e55', hor: '#e07f4a', fog: '#7d5f4c', fn: 46, ff: 310, az: 250, el: 9,  sun: '#ff9440', sunI: 1.8, hSky: '#c09a7e', hGnd: '#3c3630', hemi: 0.78, deep: '#1c2e36', shal: '#4a585a', wsky: '#cf7f4e', mist: 0.09, cloud: '#dd9a72', cop: 0.72 }],
  [1760, { top: '#6a4a7c', hor: '#f7b733', fog: '#eebd8a', fn: 55, ff: 400, az: 256, el: 7,  sun: '#ffc46b', sunI: 2.4, hSky: '#ffe0b0', hGnd: '#54483c', hemi: 0.95, deep: '#274b5e', shal: '#7d94a0', wsky: '#f7c46b', mist: 0.05, cloud: '#ffd9a0', cop: 0.80 }],
  [1834, { top: '#6a4a7c', hor: '#f7b733', fog: '#eebd8a', fn: 55, ff: 400, az: 256, el: 7,  sun: '#ffc46b', sunI: 2.4, hSky: '#ffe0b0', hGnd: '#54483c', hemi: 0.95, deep: '#274b5e', shal: '#7d94a0', wsky: '#f7c46b', mist: 0.05, cloud: '#ffd9a0', cop: 0.80 }],
];
const COL_FIELDS = ['top', 'hor', 'fog', 'sun', 'hSky', 'hGnd', 'deep', 'shal', 'wsky', 'cloud'];
const NUM_FIELDS = ['fn', 'ff', 'az', 'el', 'sunI', 'hemi', 'mist', 'cop'];
export const envAt = (f) => {
  let i = 0;
  while (i < ENV_KEYS.length - 2 && f > ENV_KEYS[i + 1][0]) i++;
  const [f0, A] = ENV_KEYS[i], [f1, B] = ENV_KEYS[i + 1];
  const u = clamp((f - f0) / Math.max(1, f1 - f0));
  const out = {};
  for (const k of COL_FIELDS) out[k] = lerp3(C(A[k]), C(B[k]), u);
  for (const k of NUM_FIELDS) out[k] = lerp(A[k], B[k], u);
  out.flash = f >= 1600 ? Math.exp(-(f - 1600) / 6.5) : 0; // explosion light spike
  return out;
};
// enemy mist bank: thick for the armada reveal, thinning after
export const armadaMistAt = (f) => 0.34 * smooth(ramp(f, 408, 470)) * (1 - 0.82 * smooth(ramp(f, 601, 720)));

// ---------- fleets: formations in fleet-local coords, blended over the day ----------
// king local offsets [lx (aft-/fore+), lz (side)] — flagship is index 0
const K_V =     [[0, 0], [-9, -6], [-9, 6], [-18, -12], [-18, 12], [-27, -6], [-27, 6]];
const K_LINE =  [[0, 0], [-9, 2], [-18, -2], [9, -2], [18, 2], [-27, -3], [27, 3]];
const K_VIC =   [[0, 0], [-13, -9], [-24, 2], [-13, 10], [-24, -14], [-52, -34], [0, 0]];
const E_APP =   [[0, 0], [-10, -11], [-10, 11], [-20, -21], [-20, 21], [-30, -10], [-30, 10], [-40, 0]];
const E_LINE =  E_APP.map((_, i) => [(i - 3.5) * 9.5, i % 2 ? 2.5 : -2.5]);
const K_ANCHOR = [[0, [-18, 0, 0]], [396, [-8, 0, 0]], [601, [-6, 0, 0]], [797, [-4, 0, 0]], [945, [-4, 0, 0]], [1015, [-15, 0, 0]], [1516, [-15, 0, 0]], [1690, [-15, 0, 0]], [1760, [-6, 0, 0]], [1834, [0, 0, 0]]];
const K_RY = [[0, 0], [945, 0], [1015, -Math.PI / 2], [1690, -Math.PI / 2], [1765, -0.45], [1834, 0]];
const E_ANCHOR = [[0, [150, 0, 8]], [408, [135, 0, 6]], [601, [98, 0, 4]], [797, [92, 0, 2]], [945, [88, 0, 0]], [1015, [42, 0, 0]], [1834, [42, 0, 0]]];
const E_RY = [[0, Math.PI], [945, Math.PI], [1015, Math.PI / 2], [1834, Math.PI / 2]];
const wLine = (f) => smooth(ramp(f, 945, 1015));
const wVic = (f) => smooth(ramp(f, 1700, 1770));
// fireship (king index 6) world path once it breaks away
const FS_POS = [[1282, [-18, 0, 27]], [1400, [-4, 0, 25]], [1516, [14, 0, 19]], [1600, [28, 0, 15]], [1640, [30, 0, 14]], [1677, [30, 0, 14]]];
const FS_RY = [[1282, -1.35], [1400, -0.9], [1516, -0.4], [1600, -0.2], [1677, 0.3]];
// enemy ships that race for the fireship (indices 1,2,3) — world targets
const E_CONV = { 1: [38, 0, 24], 2: [36, 0, 15], 3: [38, 0, 6] };

// ---------- V2 far fleets: REAL counts — 40 king ships, 60 enemy ships ----------
// Heroes are indices K 0..6 / E 0..7; the far tier (K 7..39 = 33, E 8..59 = 52)
// sails in countable ROWS behind them (drone-reveal formations), then blends to
// a line-support formation for the battle and scatters for the victory.
export const KING_N = 40, ENEMY_N = 60;
const gridRows = (rows) => { const out = []; for (const [lx, n, lz0, step] of rows) for (let c = 0; c < n; c++) out.push([lx, lz0 + c * step]); return out; };
const FAR_K_GRID = gridRows([[-38, 7, -30, 10], [-49, 7, -30, 10], [-60, 7, -30, 10], [-71, 6, -25, 10], [-82, 6, -25, 10]]); // 33
const FAR_E_GRID = gridRows([[-52, 9, -40, 10], [-64, 9, -40, 10], [-76, 9, -40, 10], [-88, 9, -40, 10], [-100, 9, -40, 10], [-112, 7, -30, 10]]); // 52
// battle line-support offsets (fleet-local): parked behind each fleet's hero line
const FAR_K_LINE = FAR_K_GRID.map((_, j) => { const row = Math.floor(j / 12), col = j % 12; return [-55 + col * 10, 22 + row * 9]; });
const FAR_E_LINE = FAR_E_GRID.map((_, j) => { const row = Math.floor(j / 12), col = j % 12; return [55 - col * 10, 22 + row * 9]; });
const FAR_K_VIC = FAR_K_GRID.map(([lx, lz]) => [lx * 1.05 - 10, lz * 1.25]);
const kingOffAt = (i, f) => i < 7
  ? lerp3(lerp3(K_V[i], K_LINE[i], wLine(f)), K_VIC[i], i === 6 ? 0 : wVic(f))
  : lerp3(lerp3(FAR_K_GRID[i - 7], FAR_K_LINE[i - 7], wLine(f)), FAR_K_VIC[i - 7], wVic(f));
const enemyOffAt = (i, f) => i < 8
  ? lerp3(E_APP[i], E_LINE[i], wLine(f))
  : lerp3(FAR_E_GRID[i - 8], FAR_E_LINE[i - 8], wLine(f));

export const BURST_F = 1600;
export const FUSE_START = 1300;

export function kingPoseAt(i, f) {
  const t = f / FPS;
  if (i === 6 && f >= 1282) { // the fireship sails alone
    if (f >= 1678) return { p: [30, -99, 14], ry: 0.3, pitch: 0, roll: 0, hidden: true };
    const p = k3(FS_POS, f), ry = k1(FS_RY, f);
    const sink = smooth(ramp(f, 1606, 1677));
    const b = bobFor(p[0], p[2], t, 1 - sink);
    return { p: [p[0], b.y - sink * 3.4, p[2]], ry, pitch: b.pitch + sink * 0.18, roll: b.roll + sink * 0.55, hidden: false };
  }
  const anchor = k3(K_ANCHOR, f), ry = k1(K_RY, f);
  const off = kingOffAt(i, f);
  const [wx, wz] = rotY(off, ry);
  const sway = Math.sin(f * 0.011 + i * 1.7) * 0.35;
  const x = anchor[0] + wx, z = anchor[2] + wz + sway * (f > 957 && f < 1690 ? 1 : 0.3);
  const b = bobFor(x, z, t);
  return { p: [x, b.y, z], ry, pitch: b.pitch, roll: b.roll, hidden: false };
}
export function enemyPoseAt(i, f) {
  const t = f / FPS;
  if (f >= 1689) { // victory: only two wrecks remain
    if (i === 2) return { p: [36, -1.7, 15], ry: 1.2, pitch: 0.1, roll: 0.48, hidden: false, wreck: true };
    if (i === 5) { const b = bobFor(56, -14, t, 0.3); return { p: [56, -1.5, -14], ry: 1.5, pitch: 0, roll: -0.36, hidden: false, wreck: true }; }
    return { p: [0, -99, 0], ry: 0, pitch: 0, roll: 0, hidden: true };
  }
  const anchor = k3(E_ANCHOR, f), ry = k1(E_RY, f);
  const off = enemyOffAt(i, f);
  const [wx, wz] = rotY(off, ry);
  let x = anchor[0] + wx, z = anchor[2] + wz;
  if (E_CONV[i] && f >= 1528) { // converge on the fireship
    const u = smooth(ramp(f, 1528, 1595));
    x = lerp(x, E_CONV[i][0], u); z = lerp(z, E_CONV[i][2], u);
    if (f > BURST_F) { const s = smooth(ramp(f, BURST_F + 6, 1677)); var sinkY = s * (i === 2 ? 1.1 : 0.55), list = s * (i === 2 ? 0.3 : 0.14); }
  }
  const b = bobFor(x, z, t);
  return { p: [x, b.y - (sinkY || 0), z], ry, pitch: b.pitch, roll: b.roll + (list || 0), hidden: f < 408 };
}

// ---------- the KING in world space (V3: a bear-line CARD — romanFront 'king',
// seed 7 — standing on the flagship's stern deck; bow walk f1700-1770,
// flagship scale 1.15. The drawn head centre (toon headCenter(7) = 295.0
// canvas px, soles at 975) sits 1.53 m above the card's soles; the crown
// band centre sits 1.80 m up — the FX glint anchor.) ----------
const KING_HEAD_M = 1.53, KING_CROWN_M = 1.80;
export function kingSolesAt(f) {
  const fp = kingPoseAt(0, f);
  const ws = smooth(ramp(f, 1700, 1770));
  const lx = (-5.6 + 10.6 * ws) * 1.15, ly = (3.06 - 0.8 * ws) * 1.15;
  const [wx, wz] = rotY([lx, 0], fp.ry);
  return [fp.p[0] + wx, fp.p[1] + ly, fp.p[2] + wz];
}
export function kingHeadAt(f) {
  const s = kingSolesAt(f);
  return [s[0], s[1] + KING_HEAD_M, s[2]];
}
export function kingCrownAt(f) {
  const s = kingSolesAt(f);
  return [s[0], s[1] + KING_CROWN_M, s[2]];
}

// ---------- the bottle ----------
const BOT_POS = [[613, [14, 0, 13]], [680, [8, 0, 8]], [740, [2.4, 0, 3.6]], [762, [3.0, 0, 4.3]], [797, [2.8, 0, 4.0]]];
export const BUMP_F = 740;
export function bottleAt(f) {
  if (f < 613 || f > 797) return null;
  const p = k3(BOT_POS, f), t = f / FPS;
  return { p: [p[0], waveH(p[0], p[2], t) * 0.85 - 0.28, p[2]], tilt: Math.sin(t * 1.4) * 0.22, spin: t * 0.25 };
}

// ---------- cannon battle: volleys, balls, impacts (all analytic) ----------
const FLIGHT = 26;
export const VOLLEYS = [
  { f: 1000, side: 'K', ships: [0, 1, 3, 4] },
  { f: 1036, side: 'E', ships: [1, 2, 4, 5] },
  { f: 1072, side: 'K', ships: [0, 2, 3, 5] },
  { f: 1108, side: 'E', ships: [0, 2, 3, 6] },
];
const portWorld = (side, ship, f) => {
  const pose = side === 'K' ? kingPoseAt(ship, f) : enemyPoseAt(ship, f);
  const local = [0.5, 2.05, side === 'K' ? 1.85 : -1.85];
  const [wx, wz] = rotY([local[0], local[2]], pose.ry);
  return [pose.p[0] + wx, local[1], pose.p[2] + wz];
};
const ballTarget = (side, ship, j) => {
  const foe = side === 'K' ? enemyPoseAt([1, 2, 4, 5, 3][(ship + j) % 5], 1030) : kingPoseAt([0, 1, 3, 4, 2][(ship + j) % 5], 1030);
  const hit = hash(ship * 31 + j * 7 + (side === 'K' ? 3 : 11)) < 0.42;
  if (hit) return { p: [foe.p[0] + (hash(ship + j) - 0.5) * 3, 1.9, foe.p[2] + (hash(ship * 3 + j) - 0.5) * 3], kind: 'hull' };
  return { p: [foe.p[0] + (side === 'K' ? -1 : 1) * (6 + hash(ship * 13 + j) * 9), 0, foe.p[2] + (hash(ship * 7 + j * 3) - 0.5) * 10], kind: 'water' };
};
export const ballsAt = (f) => {
  const out = [];
  for (const v of VOLLEYS) {
    const u = (f - v.f) / FLIGHT;
    if (u < 0 || u > 1) continue;
    for (const s of v.ships) for (let j = 0; j < 2; j++) {
      const st = portWorld(v.side, s, v.f), tg = ballTarget(v.side, s, j);
      const p = lerp3(st, tg.p, u); p[1] = lerp(st[1], tg.p[1], u) + Math.sin(u * Math.PI) * 5.2;
      out.push({ p, impact: f === v.f + FLIGHT, target: tg });
    }
  }
  return out;
};
export const volleyAt = (f) => VOLLEYS.filter((v) => v.f === f);

// ---------- burning mast fall + explosion debris ----------
// shipKey: 'K3' (burning), 'E1'/'E2' (blasted). Returns tilt angle (rad) or 0.
export function mastFallAt(key, f) {
  const spec = { K3: [1216, 54, 1.25], E2: [1612, 40, 1.30], E1: [1628, 44, 1.15] }[key];
  if (!spec) return 0;
  const [f0, dur, max] = spec;
  const u = clamp((f - f0) / dur);
  return max * u * u;
}
export const MAST_SPLASH = [ // [frame, shipKey] — splash when the falling mast hits the sea
  [1256, 'K3'], [1650, 'E2'], [1668, 'E1'],
];
const DEBRIS_N = 10;
export function debrisAt(f) {
  const out = [];
  if (f < BURST_F || f > 1700) return out;
  for (let k = 0; k < DEBRIS_N; k++) {
    const t0 = BURST_F + (k % 3), tt = (f - t0) / FPS;
    if (tt < 0) continue;
    const a = hash(k * 3 + 1) * Math.PI * 2, sp = 3.5 + hash(k * 5 + 2) * 6.5, vy = 9 + hash(k * 7 + 3) * 6.5;
    const x = 29 + Math.cos(a) * sp * tt, z = 14.5 + Math.sin(a) * sp * tt;
    const y = 2.6 + vy * tt - 6.25 * tt * tt;
    const tHit = (vy + Math.sqrt(vy * vy + 4 * 6.25 * 2.6)) / (2 * 6.25);
    out.push({ p: [x, Math.max(y, -1.2), z], rot: [tt * (2 + k % 3), tt * 1.3, tt * 0.7], barrel: k % 2 === 0, splashF: Math.round(t0 + tHit * FPS), sx: 29 + Math.cos(a) * sp * tHit, sz: 14.5 + Math.sin(a) * sp * tHit, gone: tt > tHit + 0.25 });
  }
  return out;
}
export const ringAt = (f) => { // explosion shockwave ring
  if (f < BURST_F || f > 1700) return null;
  const u = (f - BURST_F) / 100;
  return { r: 2 + u * 95, a: 0.8 * Math.max(0, 1 - u) };
};
// the king's raised arm (his order, then the victory salute)
export const armUAt = (f) => Math.max(smooth(ramp(f, 852, 880)) * (1 - smooth(ramp(f, 918, 942))), smooth(ramp(f, 1705, 1745)));

// ---------- title / message boards ----------
export const boardAt = (f) => {
  const fade = (a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
  if (f < 80) return { text: "THE KING'S BATTLE AT SEA", alpha: fade(4, 16, 62, 80) };
  if (f >= 652 && f < 748) return { text: 'GIVE UP YOUR CROWN — OR FEED THE FISH', alpha: fade(652, 664, 730, 748) };
  if (f >= 836 && f < 914) return { text: 'LOAD EVERY CANNON!', alpha: fade(836, 848, 896, 914) };
  if (f >= 1766) return { text: 'THE SEA KING', alpha: smooth(ramp(f, 1766, 1784)) };
  return null;
};

// ---------- V2 CAMERA DOCTRINE: one continuous flight, voice-tracked ----------
// No jump cuts: the camera is a chain of segment functions (drone reveals,
// subject/object tracking, action rides) whose endpoints meet, cross-blended
// over ±BK frames at every boundary. The camera tracks what the narration
// names: "forty warships" -> drone reveal of all 40 in rows; "sixty tall
// ships" -> drone sweep over all 60; the bottle, the king, the fireship are
// followed at their own speed; battle volleys are ridden alongside the firing
// ship, then the look whips to the impact.
const BK = 9; // boundary cross-blend half-window (frames)
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const CAMSEGS = [
  { a: 0, fn: (f) => ({ // DAWN DRONE — climb off the flagship's bow, then an OBLIQUE sweep along the rows: all 40 revealed
    pos: kf3([[0, [-26, 3, 24]], [45, [-30, 14, 38]], [110, [-24, 20, 50]], [200, [-44, 23, 52]], [300, [-56, 26, 28]]], f),
    look: kf3([[0, [-14, 3, 0]], [110, [-38, 2, 0]], [200, [-52, 2, -4]], [300, [-34, 3, 6]]], f), fov: 55 }) },
  { a: 300, fn: (f) => ({ // DESCEND — dive from the drone to the flagship's stern, skim past the king, fly out to sea
    pos: kf3([[300, [-56, 26, 28]], [380, [-14, 10, 16]], [470, [38, 15, -19]]], f),
    look: kf3([[300, [-34, 3, 6]], [380, [-10, 4, 0]], [470, [110, 3, -6]]], f), fov: 52 }) },
  { a: 470, fn: (f) => ({ // ARMADA DRONE — rise over the mist bank, sweep across all 60 black sails, dive back to sea level
    pos: kf3([[470, [38, 15, -19]], [515, [66, 34, -36]], [575, [88, 40, -20]], [640, [72, 19, 25]]], f),
    look: kf3([[470, [110, 3, -6]], [515, [125, 2, 0]], [575, [135, 2, 5]], [640, [45, 2, 8]]], f), fov: 54 }) },
  { a: 640, fn: (f) => { // BOTTLE TRACK — water level, riding with the bottle as it floats to the flagship
    const b = bottleAt(Math.min(Math.max(f, 613), 797)) || { p: [2.8, 0, 4] };
    const off = kf3([[640, [16, 10, 16]], [680, [9.5, 1.9, 12]], [740, [7, 1.7, 9]], [770, [6.8, 2.6, 8.6]], [810, [7.5, 5.5, 9.5]]], f);
    return { pos: add3(b.p, off), look: lerp3([b.p[0], 0.3, b.p[2]], [-4, 3.2, 0], ramp(f, 758, 800)), fov: 47 };
  } },
  { a: 800, fn: (f) => ({ // THE ORDER — deck-level push-in locked on the king's head as he raises his arm
    pos: kf3([[800, [3, 6.5, 12.5]], [852, [-4.5, 5.4, 8]], [900, [-6.9, 4.9, 5.4]], [950, [-7.4, 4.6, 4.6]]], f),
    look: kingHeadAt(f), fov: kf([[800, 46], [950, 40]], f) }) },
  { a: 950, fn: (f) => ({ // BATTLE — low over the water beside the firing flagship; the look whips to each impact
    pos: kf3([[950, [-7.4, 4.6, 4.6]], [985, [-6, 3.4, 7]], [1013, [6, 4, 10]], [1036, [22, 3.6, 22]], [1062, [8, 4, 14]], [1072, [-6, 3.4, 0]], [1098, [10, 4, 6]], [1108, [22, 3.6, 24]], [1121, [14, 5, 14]], [1140, [20, 9, 20]]], f),
    look: kf3([[950, [-15, 3, 0]], [985, [-15, 2.5, 0]], [1000, [-13, 2.5, 2]], [1013, [36, 2, 24]], [1036, [39, 2.5, 31]], [1049, [-14, 2, 8]], [1072, [-14, 2.5, -2]], [1085, [36, 2, 26]], [1108, [39, 2.5, 31]], [1121, [0, 1.5, 8]], [1140, [-14, 2.5, 0]]], f), fov: 55 }) },
  { a: 1140, fn: (f) => ({ // BURNING — crane up off the battle and track along the king's line past the fires to K3's falling mast
    pos: kf3([[1140, [20, 9, 20]], [1190, [0, 6.5, 17]], [1240, [-6, 5.5, 15]], [1290, [-27, 5.5, 35]]], f),
    look: kf3([[1140, [-14, 2.5, 0]], [1200, [-15, 3, -6]], [1240, [-13, 3, 9]], [1290, [-18, 2.5, 27]]], f), fov: 50 }) },
  { a: 1290, fn: (f) => { // FIRESHIP TRACK — ride alongside the lone ship at its own speed, pulling back as the enemy closes in
    const fs = kingPoseAt(6, f);
    const off = kf3([[1290, [-11, 3.4, 10]], [1400, [-13, 4.4, 12]], [1516, [-12, 4.2, 11]], [1540, [-19, 6.5, 17]]], f);
    return { pos: add3(fs.p, off), look: add3(fs.p, [3, 2.2, 0]), fov: 50 };
  } },
  { a: 1540, fn: (f) => ({ // EXPLOSION — hold the vantage on the converging enemy, the burst (f1600, shake below), the wrecks
    pos: kf3([[1540, [-1, 6.5, 35]], [1585, [4, 10, 35]], [1640, [14, 9, 30]], [1690, [22, 8, 25]]], f),
    look: kf3([[1540, [24, 2.5, 16]], [1600, [29, 3, 14.5]], [1650, [33, 2, 15]], [1690, [0, 2.5, 0]]], f), fov: 52 }) },
  { a: 1690, fn: (f) => { // VICTORY — fly to the flagship's bow quarter, track her home, end in a push-in on the crowned king
    const fs = kingPoseAt(0, f);
    const off = kf3([[1690, [37, 8, 25]], [1720, [24, 6, 20]], [1770, [19, 5.2, 16.5]], [1834, [16, 4.8, 14]]], f);
    const kh = kingHeadAt(f);
    const pos = lerp3(add3(fs.p, off), add3(kh, [5.5, 2, 5.5]), ramp(f, 1790, 1835) * 0.8);
    return { pos, look: lerp3(add3(fs.p, [0, 3, 0]), kh, ramp(f, 1740, 1790)), fov: lerp(50, 42, ramp(f, 1740, 1835)) };
  } },
];
export function camAt(f) {
  let i = 0;
  for (let k = 0; k < CAMSEGS.length; k++) if (f >= CAMSEGS[k].a) i = k;
  let c = CAMSEGS[i].fn(f);
  // Cross-blend across every boundary (window b-BK..b+BK, weight 0->1) — the
  // same blend value is produced from BOTH sides of the boundary, so the
  // camera path is continuous everywhere: no jump cuts, ever.
  const blendTo = (other, w) => { c = { pos: lerp3(c.pos, other.pos, w), look: lerp3(c.look, other.look, w), fov: lerp(c.fov, other.fov, w) }; };
  if (i + 1 < CAMSEGS.length && f > CAMSEGS[i + 1].a - BK) {
    blendTo(CAMSEGS[i + 1].fn(f), smooth(clamp((f - (CAMSEGS[i + 1].a - BK)) / (2 * BK))));
  } else if (i > 0 && f < CAMSEGS[i].a + BK) {
    const p = CAMSEGS[i - 1].fn(f), w = smooth(clamp((f - (CAMSEGS[i].a - BK)) / (2 * BK)));
    c = { pos: lerp3(p.pos, c.pos, w), look: lerp3(p.look, c.look, w), fov: lerp(p.fov, c.fov, w) };
  }
  let { pos, look, fov } = c;
  if (f >= BURST_F && f < BURST_F + 22) { // explosion camera shake, decaying
    const a = 1.5 * (1 - (f - BURST_F) / 22);
    pos = [pos[0] + Math.sin(f * 39.7) * a * 0.4, pos[1] + Math.sin(f * 47.3) * a * 0.3, pos[2] + Math.cos(f * 43.1) * a * 0.4];
    look = [look[0] + Math.sin(f * 51.9) * a * 0.5, look[1] + Math.cos(f * 45.7) * a * 0.4, look[2]];
  }
  const t = f / FPS;
  pos = [pos[0] + Math.sin(t * 0.5) * 0.15, pos[1] + Math.sin(t * 0.8) * 0.08, pos[2]]; // handheld breath
  return { pos, look, fov };
}
