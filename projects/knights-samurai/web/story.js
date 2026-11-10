// "1000 KNIGHTS vs 1000 SAMURAI" — every position, count, camera move and event is a pure
// function of the frame number, computed from the voice timing. Armies: knights WEST (steel,
// red crosses, lances, shields) vs samurai EAST (indigo lamellar, bows, katanas, banners).
// The charge, the arrow storm, the duel, the sunset bow — all keyed to the narration.
import { clamp, lerp, ramp, kf, kf3, M } from './motion.js';

// rows: [section, startFrame, endFrame] — patched by tools/patch_timing.mjs from the voice.
export const TIMING = [
  ["hook", 0, 145],
  ["knight", 156, 255],
  ["armour", 266, 369],
  ["warhorse", 380, 463],
  ["samurai", 474, 593],
  ["katana", 604, 670],
  ["light", 681, 745],
  ["charge", 757, 863],
  ["arrows", 874, 989],
  ["duel", 1000, 1151],
  ["sunset", 1162, 1294],
  ["honour", 1305, 1446],
  ["verdict", 1457, 1575],
  ["poets", 1586, 1701],
];
export const TOTAL = 1701, FPS = 30;
const SEC = {}; TIMING.forEach(([id, a], i) => { SEC[id] = [a, i + 1 < TIMING.length ? TIMING[i + 1][1] : TOTAL]; }); // contiguous: inter-phrase silence belongs to the outgoing section
export const SECTION = SEC;
export function secAt(f) { for (const [id, [a, b]] of Object.entries(SEC)) if (f >= a && f < b) return id; return 'poets'; }
export function secProg(f) { const [a, b] = SEC[secAt(f)]; return clamp((f - a) / Math.max(1, b - a), 0, 1); }
const secU = (id, f) => { const [a, b] = SEC[id]; return clamp((f - a) / Math.max(1, b - a), 0, 1); };
const win = (range, u0, u1) => [Math.round(range[0] + (range[1] - range[0]) * u0), Math.round(range[0] + (range[1] - range[0]) * u1)];
const h1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- armies
export const COLS = 25, ROWS = 40, N_SIDE = COLS * ROWS; // exactly 1000 per side
const DX = 12, DZ = 7, GAP = 30;
export const gridX = i => GAP + Math.floor(i / ROWS) * DX;             // distance from centre line
export const gridZ = i => (i % ROWS - (ROWS - 1) / 2) * DZ;
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
// knight advance: charge carries the whole army east; the arrow storm halts it; sunset settles.
export function shiftAt(side, f) {
  if (side === 'sam') { return 5 * sstep(SEC.sunset[0], SEC.sunset[1], f); } // samurai step back at dusk
  let s = 62 * sstep(SEC.charge[0], SEC.charge[0] + (SEC.charge[1] - SEC.charge[0]) * 0.8, f);
  s -= 6 * sstep(SEC.sunset[0], SEC.sunset[1], f);                        // knights ease back at dusk
  return s;
}
export function fleetPosAt(side, i, f) {
  const gx = gridX(i), sh = shiftAt(side, f);
  const charging = side === 'kni' && f >= SEC.charge[0] && f < SEC.arrows[0];
  const bob = charging ? Math.abs(Math.sin(f * 0.45 + i * 1.7)) * 0.07 : 0;
  if (side === 'sam') return [gx + sh, 0, gridZ(i)];
  let x = -gx + sh; const z = gridZ(i);
  // the duel clearing: once the charge carries knights into the ellipse around the duel
  // ground, they crowd onto its rim instead of overrunning it — a ring watching the duel.
  const dx = x / 13.5, dz = (z + 40) / 11.5, q = dx * dx + dz * dz;
  if (q < 1 && q > 1e-6) { const s = 1 / Math.sqrt(q); x = dx * 13.5 * s; return [x, bob, -40 + dz * 11.5 * s]; }
  return [x, bob, z];
}
export const countAt = (side, f) => N_SIDE;
export const chargeFrontAt = f => -GAP + shiftAt('kni', f);            // knight front-rank x
export const fleetShieldAt = f => ramp(f, SEC.arrows[0], SEC.arrows[0] + 26) * (1 - ramp(f, SEC.duel[0] - 14, SEC.duel[0] + 8)); // knights turtle under the storm
export const bannerIdx = i => i % 100 === 0;                            // 10 banner poles per side

// ---------------------------------------------------------------- heroes
export const KNIGHT_HOME = [-20, 0, -6], SAMURAI_HOME = [20, 0, 6];
export const DUEL_K = [-8, 0, -40], DUEL_S = [8, 0, -40];
export const armHitFrame = () => Math.round(SEC.armour[0] + (SEC.armour[1] - SEC.armour[0]) * 0.55);
export const leafCutFrame = () => Math.round(SEC.katana[0] + (SEC.katana[1] - SEC.katana[0]) * 0.62);
export const clashFrames = () => [0.5, 0.78].map(u => Math.round(SEC.duel[0] + (SEC.duel[1] - SEC.duel[0]) * u));

function knightRideOut(f) { // warhorse beat: the lone charge across the field
  const u = secU('warhorse', f);
  const x = kf([[0, -24], [0.25, -16], [0.7, 12], [1, 24]], u, M.easeInOut);
  return { mode: 'horse', p: [x, Math.abs(Math.sin(f * 0.55)) * 0.16, -6 + Math.sin(u * 9) * 1.2], ry: 0, sword: 0.9, bow: 0, shieldUp: 0, gallop: 1 };
}
function knightRideBack(f) { // off-camera return along the south lane while the samurai are introduced
  const a = SEC.samurai[0], b = SEC.light[1];
  const u = clamp((f - a) / (b - a), 0, 1);
  const x = lerp(24, KNIGHT_HOME[0], M.easeInOut(u));
  const z = lerp(-6, -6, u) + Math.sin(u * Math.PI) * 34; // swings wide south, out of the east-side shots
  return { mode: 'horse', p: [x, Math.abs(Math.sin(f * 0.5)) * 0.13, z], ry: u < 0.5 ? Math.PI : Math.PI, sword: 0.4, bow: 0, shieldUp: 0, gallop: 0.8 };
}
export function heroKnightAt(f) {
  const sec = secAt(f), AH = armHitFrame();
  if (sec === 'warhorse') return knightRideOut(f);
  if (sec === 'samurai' || sec === 'katana' || sec === 'light') return knightRideBack(f);
  if (sec === 'charge' || sec === 'arrows') {
    const front = chargeFrontAt(f);
    return { mode: 'horse', p: [front + 7, Math.abs(Math.sin(f * 0.55)) * (sec === 'charge' ? 0.16 : 0.05), -10], ry: 0, sword: sec === 'charge' ? 1 : 0.5, bow: 0, shieldUp: fleetShieldAt(f), gallop: sec === 'charge' ? 1 : 0.15 };
  }
  if (sec === 'duel' || sec === 'sunset' || sec === 'honour' || sec === 'verdict' || sec === 'poets') {
    return duelHero(f, 'kni');
  }
  // hook / knight / armour: on foot at home, in front of his army.
  // He turns through the beats: faces the south cameras for his intro, then squares up EAST to the arrow.
  const ry = sec === 'knight' ? lerp(-1.15, -0.55, secU('knight', f))
    : sec === 'armour' ? lerp(-0.55, 0.15, Math.min(1, secU('armour', f) * 1.5))
    : -0.9;
  const flinch = (f >= AH && f <= AH + 7 && sec === 'armour') ? Math.sin((f - AH) / 7 * Math.PI) * 0.12 : 0;
  return { mode: 'foot', p: [KNIGHT_HOME[0], -flinch, KNIGHT_HOME[2]], ry, sword: sec === 'armour' ? 0.85 : 0.35, bow: 0, shieldUp: sec === 'armour' ? 0.7 : 0.25, gallop: 0 };
}
export function heroSamuraiAt(f) {
  const sec = secAt(f);
  if (sec === 'duel' || sec === 'sunset' || sec === 'honour' || sec === 'verdict' || sec === 'poets') return duelHero(f, 'sam');
  // bow draw cycles keyed to the volleys while he shoots; katana draw on the katana beat
  let draw = 0;
  if (sec === 'light' || sec === 'charge' || sec === 'arrows') {
    const cyc = sec === 'arrows' ? 22 : 44;
    const ph = (f % cyc) / cyc;
    draw = ph < 0.62 ? M.easeOut(ph / 0.62) : Math.max(0, 1 - (ph - 0.62) / 0.1);
  }
  const sword = sec === 'katana' ? ramp(f, SEC.katana[0] + 8, leafCutFrame()) : 0.15;
  const ry = sec === 'samurai' ? lerp(2.95, 2.35, secU('samurai', f)) : sec === 'katana' ? 2.8 : sec === 'light' ? 2.5 : Math.PI - 0.3;
  return { mode: 'foot', p: SAMURAI_HOME, ry, sword, bow: 0, shieldUp: 0, gallop: 0, draw };
}
function duelHero(f, side) {
  const sgn = side === 'kni' ? -1 : 1;
  const D = SEC.duel, S = SEC.sunset;
  let x, sword = 0.3, bowB = 0;
  if (f < D[0]) { x = sgn * 8; }
  else if (f <= D[1]) {
    const u = secU('duel', f), [c1, c2] = [0.5, 0.78];
    x = sgn * kf([[0, 8], [0.35, 3.4], [0.46, 2.6], [c1, 1.15], [0.58, 2.3], [0.72, 2.5], [c2, 1.3], [0.86, 2.6], [1, 3]], u, M.easeInOut);
    sword = kf([[0, 0.3], [0.3, 0.75], [0.46, 1], [c1, 1], [0.6, 0.8], [0.74, 1], [c2, 1], [0.88, 0.55], [1, 0.35]], u, M.easeInOut);
  } else if (f <= S[1]) {
    const u = secU('sunset', f);
    x = sgn * lerp(3, 2.5, M.easeInOut(u)); sword = lerp(0.35, -0.15, u);
  } else {
    x = sgn * 2.5; sword = -0.15;
    if (secAt(f) === 'honour') { const u = secU('honour', f); bowB = sstep(0.38, 0.55, u) * (1 - sstep(0.8, 0.97, u)); }
    if (secAt(f) === 'poets') { const u = secU('poets', f); sword = u > 0.45 ? lerp(-0.15, 1.05, sstep(0.45, 0.62, u)) : -0.15; } // final salute
  }
  const z = -40, ry = side === 'kni' ? 0 : Math.PI;
  return { mode: 'foot', p: [x, 0, z], ry, sword, bow: bowB, shieldUp: 0, gallop: 0, draw: 0 };
}

// ---------------------------------------------------------------- the leaf (katana beat)
export function leafAt(f) {
  const K = SEC.katana, CUT = leafCutFrame();
  const t0 = K[0] + (K[1] - K[0]) * 0.18;
  if (f < t0) return null;
  if (f < CUT) {
    const u = (f - t0) / (CUT - t0);
    return { p: [18.6 + Math.sin(f * 0.22) * 0.5, lerp(3.6, 1.5, u * u * 0.4 + u * 0.6), 4.6 + Math.cos(f * 0.17) * 0.4], split: 0, rot: f * 0.05, fall: 0 };
  }
  const u = clamp((f - CUT) / 40, 0, 1);
  return { p: [18.6, Math.max(0.06, 1.5 - u * u * 1.5), 4.6], split: Math.min(1, u * 2.2), rot: CUT * 0.05 + u * 2.4, fall: u };
}

// ---------------------------------------------------------------- arrows
const VOLLEY_GAP = 22, ARROW_FLY = 34;
export function volleyFrames() {
  const out = [];
  const L = SEC.light; out.push(Math.round(L[0] + (L[1] - L[0]) * 0.35), Math.round(L[0] + (L[1] - L[0]) * 0.78));
  for (let f = SEC.arrows[0] + 4; f < SEC.arrows[1] - 6; f += VOLLEY_GAP) out.push(f);
  out.push(armHitFrame() - 16); // the lone arrow that pings off the knight's armour
  return out.sort((a, b) => a - b);
}
export function arrowsAt(f) {
  const out = [], AH = armHitFrame();
  for (const L0 of volleyFrames()) {
    const age = f - L0;
    if (age < 0 || age > ARROW_FLY + 14) continue;
    const lone = L0 === AH - 16;
    const n = lone ? 1 : 24;
    for (let k = 0; k < n; k++) {
      const seed = L0 * 31 + k * 7;
      let x0, y0 = 1.8, z0, x1, y1;
      if (lone) { x0 = 26; z0 = -16; x1 = KNIGHT_HOME[0] + 0.8; y1 = 1.35; }
      else {
        z0 = -75 + h1(seed) * 120;
        x0 = GAP + 2 + h1(seed + 1) * 8;
        x1 = -GAP + shiftAt('kni', L0) - 4 + h1(seed + 2) * 26; y1 = 0.9;
        z0 = z0; // archer line z
      }
      const z1 = lone ? KNIGHT_HOME[2] : z0 * 0.94 + (h1(seed + 3) - 0.5) * 6;
      if (age <= ARROW_FLY) {
        const u = age / ARROW_FLY, apex = lone ? 3.2 : 15 + h1(seed + 4) * 9;
        const x = lerp(x0, x1, u), z = lerp(z0, z1, u);
        const y = lerp(y0, y1, u) + Math.sin(u * Math.PI) * apex;
        const vy = (y1 - y0) / ARROW_FLY + Math.cos(u * Math.PI) * Math.PI * apex / ARROW_FLY;
        const vx = (x1 - x0) / ARROW_FLY;
        out.push({ p: [x, y, z], ang: Math.atan2(vy, vx), stuck: false });
      } else if (lone && age <= ARROW_FLY + 12) { // the armour arrow drops, spent, at his feet
        const u = (age - ARROW_FLY) / 12;
        out.push({ p: [x1 + 0.4, Math.max(0.15, y1 - u * u * 1.3), KNIGHT_HOME[2] + 0.4], ang: -1.2 - u, stuck: true });
      }
    }
  }
  return out;
}
export function arrowFocusAt(f) {
  const live = arrowsAt(f);
  if (!live.length) return [chargeFrontAt(f) + 10, 2, -20];
  let cx = 0, cy = 0, cz = 0; for (const a of live) { cx += a.p[0]; cy += a.p[1]; cz += a.p[2]; }
  return [cx / live.length, cy / live.length, cz / live.length];
}

// ---------------------------------------------------------------- environment (morning mist -> day -> gold -> sunset -> dusk)
const ENV_KEYS = [
  [0.00, { sky: '#93a9c4', hor: '#e6d3a8', fog: '#c3ced4', fogFar: 430, sun: '#ffd9a0', sunEl: 16, sunI: 1.7, amb: 0.5, hemi: 0.5, exp: 1.0, cloud: '#f7ecd4', sunAz: 55 }],
  [0.16, { sky: '#5f9fd8', hor: '#cfe6f2', fog: '#bcd2de', fogFar: 640, sun: '#fff1d6', sunEl: 48, sunI: 2.7, amb: 0.55, hemi: 0.68, exp: 1.05, cloud: '#ffffff', sunAz: 40 }],
  [0.55, { sky: '#6f9fd0', hor: '#f2d9a4', fog: '#c8cfc8', fogFar: 600, sun: '#ffe9bb', sunEl: 30, sunI: 2.4, amb: 0.52, hemi: 0.6, exp: 1.04, cloud: '#fdf3da', sunAz: 8 }],
  [0.78, { sky: '#5d6ba6', hor: '#ff9e57', fog: '#c9a184', fogFar: 520, sun: '#ff9440', sunEl: 7, sunI: 1.8, amb: 0.4, hemi: 0.42, exp: 1.0, cloud: '#ffb37a', sunAz: -38 }],
  [0.94, { sky: '#2f3860', hor: '#c96f4a', fog: '#6f5f74', fogFar: 400, sun: '#ff7a30', sunEl: 2, sunI: 0.8, amb: 0.3, hemi: 0.28, exp: 0.97, cloud: '#8a7f9a', sunAz: -55 }],
  [1.01, { sky: '#2f3860', hor: '#c96f4a', fog: '#6f5f74', fogFar: 400, sun: '#ff7a30', sunEl: 2, sunI: 0.8, amb: 0.3, hemi: 0.28, exp: 0.97, cloud: '#8a7f9a', sunAz: -55 }],
];
export function envAt(f) {
  const u = f / TOTAL;
  let a = ENV_KEYS[0], b = ENV_KEYS[ENV_KEYS.length - 1];
  for (let i = 0; i < ENV_KEYS.length - 1; i++) if (u >= ENV_KEYS[i][0] && u <= ENV_KEYS[i + 1][0]) { a = ENV_KEYS[i]; b = ENV_KEYS[i + 1]; break; }
  const t = clamp((u - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1), o = {};
  for (const k of Object.keys(a[1])) o[k] = typeof a[1][k] === 'number' ? lerp(a[1][k], b[1][k], t) : (t < 0.5 ? a[1][k] : b[1][k]);
  return o;
}

// ---------------------------------------------------------------- commanders (2D cards)
const K_CMD = [-13, 0, 5], S_CMD = [13, 0, -5];
const VK_CMD = [-6.5, 0, -34.5], VS_CMD = [6.5, 0, -45.5]; // inside the duel clearing, beside the heroes
const FIN_K = [-2.6, 0, -42], FIN_S = [2.6, 0, -38];
export function cmdrAt(side, f) {
  const sec = secAt(f), K = side === 'cmdKnight';
  const base = K ? K_CMD : S_CMD;
  if (sec === 'verdict' || sec === 'poets') {
    const V = SEC.verdict, u = f <= V[1] ? secU('verdict', f) : 1;
    if (u < 0.44) return K ? { p: VK_CMD, ry: 2.6, expr: 'grin', R: 'up', L: 'hang' } : null;
    if (u < 0.6 && f <= V[1]) return null;
    if (f <= V[1]) return K ? null : { p: VS_CMD, ry: -2.6, expr: 'grin', R: 'up', L: 'hang' };
    return K ? { p: FIN_K, ry: 2.9, expr: 'laugh', R: 'wave', L: 'hang' } : { p: FIN_S, ry: -2.9, expr: 'laugh', R: 'wave', L: 'hang' };
  }
  if (sec === 'sunset' || sec === 'honour') return K ? { p: [-7.5, 0, -33], ry: 2.8, expr: 'smile', R: 'hang', L: 'hang' } : { p: [7.5, 0, -47], ry: -2.8, expr: 'smile', R: 'hang', L: 'hang' };
  if (sec === 'duel') { const [c1] = clashFrames(); const shock = Math.abs(f - c1) < 12; return K ? { p: [-5.5, 0, -31], ry: 2.7, expr: shock ? 'shock' : 'stern', R: 'hip', L: 'hang' } : { p: [5.5, 0, -49], ry: -2.7, expr: shock ? 'shock' : 'stern', R: 'hip', L: 'hang' }; }
  if (K) {
    switch (sec) {
      case 'hook': return { p: base, ry: 2.7, expr: 'stern', R: 'point', L: 'hip' };
      case 'knight': return { p: base, ry: 2.7, expr: 'stern', R: 'point', L: 'hip' };
      case 'armour': return { p: base, ry: 2.7, expr: 'stern', R: 'hip', L: 'hang' };
      case 'warhorse': return { p: [-32, 0, 16], ry: 2.6, expr: 'grin', R: 'up', L: 'hang' };
      case 'charge': return { p: [-42, 0, 52], ry: 2.6, expr: 'grin', R: 'up', L: 'hang' };
      case 'arrows': return { p: [-18, 0, 12], ry: 2.7, expr: 'nervous', R: 'shield', L: 'hang' };
      default: return null;
    }
  }
  switch (sec) {
    case 'samurai': return { p: base, ry: -2.7, expr: 'stern', R: 'point', L: 'hip' };
    case 'katana': return { p: base, ry: -2.7, expr: 'smile', R: 'point', L: 'hang' };
    case 'light': return { p: base, ry: -2.7, expr: 'stern', R: 'hip', L: 'hang' };
    case 'charge': return { p: [42, 0, -52], ry: -2.6, expr: 'stern', R: 'hip', L: 'hang' };
    case 'arrows': return { p: [28, 0, -16], ry: -2.7, expr: 'stern', R: 'point', L: 'hang' };
    default: return null;
  }
}

// ---------------------------------------------------------------- board (stat cards)
export function boardAt(f) {
  const sec = secAt(f);
  const B = (text, fs, u0, u1, y = 6.4) => { const u = secU(sec, f); return (u >= u0 && u <= u1) ? { text, fs, y, s: Math.min(ramp(u, u0, u0 + 0.1), 1 - ramp(u, u1 - 0.06, u1)) } : null; };
  switch (sec) {
    case 'hook': return B('1000 vs 1000', 150, 0.04, 0.97, 7.2);
    case 'knight': return B('THE KNIGHT', 120, 0.08, 0.94);
    case 'armour': return B('A WALKING FORTRESS', 96, 0.1, 0.94);
    case 'samurai': return B('THE SAMURAI', 120, 0.08, 0.94);
    case 'katana': return B('THE KATANA', 118, 0.08, 0.94);
    case 'charge': return B('THE CHARGE!', 126, 0.05, 0.95);
    case 'arrows': return B('ARROW STORM!', 118, 0.05, 0.95);
    case 'duel': return B('SWORD vs KATANA', 104, 0.06, 0.96);
    case 'honour': return B('HONOR STOPS THE WAR', 92, 0.08, 0.95);
    case 'verdict': { const u = secU(sec, f); return u < 0.5 ? B('KNIGHT: POWER + ARMOR', 92, 0.03, 0.49) : B('SAMURAI: SPEED + SKILL', 92, 0.51, 0.97); }
    case 'poets': return B('THE POETS WIN!', 118, 0.1, 0.96, 7);
    default: return null;
  }
}

// ---------------------------------------------------------------- camera
const DUEL_C = [0, 1.4, -40];
const CAMSEGS = [
  { sec: 'hook', pts: [[0, [-150, 7, 95]], [0.36, [-64, 92, 40]], [0.7, [34, 80, -50]], [1, [-26, 6, 14]]], look: [[0, [-165, 1, 0]], [0.36, [-46, 0, 0]], [0.7, [55, 0, -8]], [1, KNIGHT_HOME]] },
  { sec: 'knight', pts: [[0, [-26, 6, 14]], [0.55, [-15.8, 1.9, -1.6]], [1, [-28, 3.2, -1]]], look: [[0, K_CMD], [0.55, KNIGHT_HOME], [1, KNIGHT_HOME]] },
  { sec: 'armour', pts: [[0, [-26, 3.0, -0.5]], [0.5, [-24.5, 2.0, 1.5]], [1, [-15.5, 1.9, 0.5]]], look: [[0, [-20, 1.35, -6]], [0.5, [-20, 1.35, -6]], [1, K_CMD]] },
  { sec: 'samurai', pts: [[0, [-13.5, 2, -13.5]], [0.3, [8, 3.4, -16]], [0.62, [15.5, 2.2, -9.5]], [1, [14.5, 1.9, 11.5]]], look: [[0, K_CMD], [0.3, [10, 1, -2]], [0.62, [13, 1.0, -5]], [1, [20, 1.0, 6]]] },
  { sec: 'katana', pts: [[0, [14.5, 1.9, 11.5]], [0.5, [14.2, 1.8, 11]], [1, [13.5, 1.9, 13.0]]], look: [[0, SAMURAI_HOME], [0.5, [18.6, 1.6, 4.6]], [1, [19.3, 1.4, 5.3]]] },
  { sec: 'light', pts: [[0, [32, 3.4, 32]], [0.45, [26.5, 2.4, 13.5]], [1, [25.5, 2.1, 12.5]]], look: [[0, [24, 1.6, 10]], [1, [20, 1.4, 6]]] },
  { sec: 'duel', pts: [[0, [-11.5, 2.9, -30.5]], [0.4, [-4.5, 2.0, -31.5]], [0.75, [7.5, 1.8, -32.5]], [1, [12, 2.2, -35]]], look: [[0, DUEL_C], [1, DUEL_C]] },
  { sec: 'sunset', pts: [[0, [12, 2.2, -35]], [0.55, [0, 13, -70]], [1, [0, 25, -94]]], look: [[0, DUEL_C], [0.55, [0, 1, -28]], [1, [0, 1, -8]]] },
  { sec: 'honour', pts: [[0, [0, 25, -94]], [0.35, [0, 8, -63]], [0.62, [-1.2, 3.4, -56]], [1, [-1.8, 2.6, -51.8]]], look: [[0, [0, 1, -8]], [0.5, [0, 1.2, -40]], [1, [0, 1.25, -40]]] },
  { sec: 'verdict1', from: win(SEC.verdict, 0, 0.44)[0], to: win(SEC.verdict, 0, 0.44)[1], pts: [[0, [-15, 4.5, -27]], [1, [-10.5, 2.8, -33.5]]], look: [[0, [-6.5, 1.0, -34.5]], [1, [-6.5, 1.0, -34.5]]] },
  { sec: 'verdict2', from: win(SEC.verdict, 0.44, 0.62)[0], to: win(SEC.verdict, 0.44, 0.62)[1], pts: [[0, [-10.5, 2.8, -33.5]], [1, [10.5, 2.8, -46.5]]], look: [[0, [0, 1.5, -40]], [1, [0, 1.5, -40]]] },
  { sec: 'verdict3', from: win(SEC.verdict, 0.62, 1.01)[0], to: SEC.verdict[1], pts: [[0, [10.5, 2.8, -46.5]], [0.6, [12.5, 3.6, -48]], [1, [10, 3.0, -44.5]]], look: [[0, [6.5, 1.0, -45.5]], [1, [6.5, 1.0, -45.5]]] },
  { sec: 'poets', pts: [[0, [10, 3.0, -44.5]], [0.5, [-8, 4.2, -29]], [1, [-1.2, 2.6, -29.5]]], look: [[0, VS_CMD], [0.5, [0, 1.3, -40]], [1, [0, 1.3, -40]]] },
];
const BK = 9; // cross-blend frames at section joins
function camSegRaw(seg, f) {
  const [a, b] = seg.from !== undefined ? [seg.from, seg.to] : SEC[seg.sec];
  const u = clamp((f - a) / Math.max(1, b - a), 0, 1);
  return { pos: kf3(seg.pts, u), look: kf3(seg.look, u) };
}
function baseCam(f) {
  for (const s of CAMSEGS) if (s.from !== undefined && f >= s.from && f <= s.to) return camSegRaw(s, f);
  const sec = secAt(f);
  if (sec === 'warhorse') { const h = heroKnightAt(f); return { pos: [h.p[0] - 9, 2.6, h.p[2] + 7.5], look: [h.p[0] + 5.5, 1.5, h.p[2] - 0.5] }; }
  if (sec === 'charge') { const fr = chargeFrontAt(f); return { pos: [fr - 13, 3.1, -33 + Math.sin(f * 0.011) * 7], look: [fr + 27, 1.4, -8] }; }
  if (sec === 'arrows') { const fo = arrowFocusAt(f); return { pos: kf3([[0, [66, 30, -72]], [0.5, [22, 15, -54]], [1, [-14, 8.5, -27]]], secU('arrows', f)), look: fo }; }
  const seg = CAMSEGS.find(s => s.sec === sec);
  return seg ? camSegRaw(seg, f) : { pos: [0, 10, 60], look: [0, 1, 0] };
}
export function camAt(f) {
  let { pos, look } = baseCam(f);
  for (const [id, [a, b]] of Object.entries(SEC)) {
    if (a > 0 && f > a - BK && f < a + BK && f > 0) {
      const u = (f - (a - BK)) / (2 * BK), w = u * u * (3 - 2 * u);
      const prev = baseCam(a - BK), cur = baseCam(a + BK);
      pos = [lerp(prev.pos[0], cur.pos[0], w), lerp(prev.pos[1], cur.pos[1], w), lerp(prev.pos[2], cur.pos[2], w)];
      look = [lerp(prev.look[0], cur.look[0], w), lerp(prev.look[1], cur.look[1], w), lerp(prev.look[2], cur.look[2], w)];
      break;
    }
  }
  const shake = [...clashFrames(), armHitFrame()].some(cf => Math.abs(f - cf) <= 2) ? 0.14 : 0;
  pos = [pos[0] + Math.sin(f * 0.021) * 0.3, pos[1] + Math.sin(f * 0.017 + 2) * 0.2 + (shake ? Math.sin(f * 9.1) * shake : 0), pos[2] + Math.cos(f * 0.019) * 0.3];
  return { pos, look };
}
export const EVENTS = () => ({ volleys: volleyFrames(), armHit: armHitFrame(), leafCut: leafCutFrame(), clashes: clashFrames(), charge: SEC.charge[0], sections: Object.fromEntries(Object.entries(SEC).map(([k, v]) => [k, { start: v[0], end: v[1] }])) });
