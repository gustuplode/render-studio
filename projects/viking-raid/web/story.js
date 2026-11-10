// "The Viking Raid at Dawn" — enhanced-batch Short (4/4). Demo only.
// Pure frame math only (no THREE, no DOM): TIMING, cameras, environment,
// the literal 30-ship fleet, the chief's path, the bell's journey.
// main.js renders; sweep.mjs verifies. Every pose is an analytic function
// of the frame. Timing patched from the finished voice stem (47.667 s).
import { clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30;
// === PATCH:TOTAL ===
export const TOTAL = 1430; // frames 0..1429 — final stem 47.667s x 30fps
// === PATCH:TIMING === [id, startFrame, endFrame] — one section per phrase
export const TIMING = [
  ['hook', 0, 100], ['village', 112, 192], ['reveal', 204, 355], ['chief', 367, 569],
  ['signal', 581, 735], ['landing', 747, 860], ['wake', 873, 1004], ['want', 1016, 1110],
  ['carry', 1122, 1238], ['fog', 1250, 1430],
];
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
export const secAt = (f) => {
  let s = SEG[TIMING[0][0]];
  for (const [id, a] of TIMING) { if (f >= a) s = SEG[id]; else break; }
  return { id: s.id, a: s.a, b: s.b, u: clamp((f - s.a) / s.len) };
};
const sf = (id, u) => SEG[id].a + (SEG[id].b - SEG[id].a) * u;
export const smooth = (u) => u * u * (3 - 2 * u);
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const k1 = (keys, f) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const [f0, v0] = keys[i - 1], [f1, v1] = keys[i]; return lerp(v0, v1, (f - f0) / Math.max(1, f1 - f0)); }
  }
  return keys[keys.length - 1][1];
};
const k3 = (keys, f) => {
  if (f <= keys[0][0]) return [...keys[0][1]];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const [f0, v0] = keys[i - 1], [f1, v1] = keys[i]; return lerp3(v0, v1, (f - f0) / Math.max(1, f1 - f0)); }
  }
  return [...keys[keys.length - 1][1]];
};
const rotY = ([lx, lz], ry) => [lx * Math.cos(ry) + lz * Math.sin(ry), -lx * Math.sin(ry) + lz * Math.cos(ry)];

// ---------- world layout ----------
// Shoreline at x ~= 0: sea x<0, beach x 0..10, village x 14..42.
// Church at (26,-7) with open bell tower; storehouse (31,9); green (19,0).
export const LAND_Y = 0.55; // top of the land mass / village ground
export const groundYAt = (x) => x < 2 ? 0.26 : x < 12 ? lerp(0.26, LAND_Y, (x - 2) / 10) : LAND_Y;
export const BELL_TOWER = [26, 9.5, -7]; // bell centre while it hangs in the tower

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

// ---------- environment: grey-rose dawn fog -> slight thin -> fog closes ----------
const C = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const ENV_KEYS = [
  [0,              { top: '#596069', hor: '#d8a58f', fog: '#c7b3aa', fn: 16, ff: 150, az: 95, el: 8,  sun: '#e6c298', sunI: 1.5,  hSky: '#d9c4b4', hGnd: '#4c4a44', hemi: 0.78, deep: '#22382f', shal: '#476557', wsky: '#c4a894', mist: 0.50, cloud: '#cbb6ac', cop: 0.55 }],
  [sf('village', 0.5), { top: '#5d646e', hor: '#dbab94', fog: '#cab7ae', fn: 18, ff: 168, az: 96, el: 8,  sun: '#e8c69e', sunI: 1.6,  hSky: '#dcc8ba', hGnd: '#4e4c46', hemi: 0.80, deep: '#233a30', shal: '#496858', wsky: '#c8ab96', mist: 0.47, cloud: '#cfbab0', cop: 0.56 }],
  [sf('reveal', 0.6),  { top: '#626a74', hor: '#dcb096', fog: '#cfbcb2', fn: 22, ff: 212, az: 97, el: 9,  sun: '#ecc9a0', sunI: 1.8,  hSky: '#e2ccbc', hGnd: '#52504a', hemi: 0.84, deep: '#243c31', shal: '#4d6d5b', wsky: '#cdb09a', mist: 0.36, cloud: '#d6c2b6', cop: 0.60 }],
  [sf('landing', 0.5), { top: '#68727c', hor: '#e0bfa4', fog: '#d5c2b4', fn: 30, ff: 260, az: 99, el: 10, sun: '#ecc9a0', sunI: 2.0,  hSky: '#e8d2be', hGnd: '#56544c', hemi: 0.88, deep: '#263e33', shal: '#51705f', wsky: '#cfb49c', mist: 0.25, cloud: '#dccabc', cop: 0.62 }],
  [sf('wake', 0.5),    { top: '#68727c', hor: '#dfbca2', fog: '#d4c1b3', fn: 30, ff: 255, az: 100, el: 10, sun: '#ecc9a0', sunI: 2.0,  hSky: '#e8d2be', hGnd: '#56544c', hemi: 0.88, deep: '#263e33', shal: '#51705f', wsky: '#cfb49c', mist: 0.27, cloud: '#dccabc', cop: 0.62 }],
  [sf('carry', 0.6),   { top: '#646c75', hor: '#dbb294', fog: '#cfbab0', fn: 26, ff: 226, az: 101, el: 9, sun: '#e9c69c', sunI: 1.85, hSky: '#e2cbb8', hGnd: '#53514a', hemi: 0.85, deep: '#253d32', shal: '#4e6c5c', wsky: '#cbb098', mist: 0.34, cloud: '#d3beb2', cop: 0.58 }],
  [sf('fog', 0.45),    { top: '#596069', hor: '#d3a28b', fog: '#c2aea6', fn: 15, ff: 130, az: 100, el: 8, sun: '#e4bf98', sunI: 1.5,  hSky: '#d6c2b2', hGnd: '#4c4a44', hemi: 0.78, deep: '#23382f', shal: '#486659', wsky: '#c2a892', mist: 0.55, cloud: '#c9b4aa', cop: 0.50 }],
  [TOTAL - 1,          { top: '#565d66', hor: '#cf9c84', fog: '#bdaaa2', fn: 14, ff: 120, az: 100, el: 8, sun: '#e0ba94', sunI: 1.45, hSky: '#d2beb0', hGnd: '#4a4842', hemi: 0.76, deep: '#22362d', shal: '#466355', wsky: '#bfa48e', mist: 0.58, cloud: '#c6b0a6', cop: 0.48 }],
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
  out.flash = 0;
  return out;
};
// mist bank strength 0..1: strong in hook/reveal, dips at landing, returns for the finale
export const mistBankAt = (f) => k1([[0, 0.9], [sf('reveal', 1), 0.82], [sf('landing', 0.3), 0.34], [sf('wake', 0.5), 0.30], [sf('carry', 1), 0.46], [sf('fog', 0.5), 0.95], [TOTAL - 1, 1.0]], f);

// ---------- THE FLEET: exactly 30 longships ----------
// 3 hero slots lead (triangle), then 27 in 3 row-groups of 9 behind.
export const FLEET = [];
FLEET.push({ dx: 0, dz: 0, hero: true }, { dx: -7, dz: -12, hero: true }, { dx: -7, dz: 12, hero: true });
for (let k = 0; k < 9; k++) FLEET.push({ dx: -18, dz: -27 + k * 6.75, hero: false });
for (let k = 0; k < 9; k++) FLEET.push({ dx: -32, dz: -24 + k * 6, hero: false });
for (let k = 0; k < 9; k++) FLEET.push({ dx: -46, dz: -27 + k * 6.75, hero: false });
const heroLeadX = (f) => k1([[0, -64], [100, -48], [204, -44], [355, -36], [569, -25], [735, -15], [860, -7.6], [1250, -7.6], [1286, -9], [TOTAL - 1, -46]], f);
const fleetBaseX = (f) => k1([[0, -64], [735, -15], [860, -15.5], [1250, -15.5], [1286, -17], [TOTAL - 1, -54]], f);
// the signal turn: the whole formation swings as one, then straightens to beach
export const turnUAt = (f) => smooth(ramp(f, sf('signal', 0.12), sf('signal', 0.5))) * (1 - smooth(ramp(f, sf('signal', 0.82), sf('landing', 0.3))));
const formRot = (f) => 0.38 * turnUAt(f);
const groundUFor = (i, f) => smooth(ramp(f, sf('landing', 0.04) + i * 6, sf('landing', 0.55) + i * 6));
export const GROUND_F = [0, 1, 2].map((i) => Math.round(sf('landing', 0.30) + i * 6));

export function shipPoseAt(i, f) {
  const slot = FLEET[i], t = f / FPS;
  const base = slot.hero ? heroLeadX(f) : fleetBaseX(f);
  const rot = formRot(f);
  const [ox, oz] = rotY([slot.dx, slot.dz], rot);
  const x = base + ox;
  const z = oz + (slot.hero ? 0 : Math.sin(f * 0.008 + i * 2.4) * 0.7);
  const b = bobFor(x, z, t);
  const gU = slot.hero ? groundUFor(i, f) : 0;
  return {
    p: [x, lerp(b.y - 0.28, -0.02, gU), z],
    ry: rot * 0.9 + (hash(i * 7.3) - 0.5) * 0.05,
    pitch: b.pitch * (1 - gU), roll: b.roll * (1 - gU),
    hidden: false, hero: slot.hero, ground: gU,
  };
}
export const shipCountAt = (f) => (f >= 0 && f < TOTAL ? FLEET.length : 0); // the fleet is out there in the fog from frame 0
export function prowAt(i, f) {
  const pp = shipPoseAt(i, f);
  const [wx, wz] = rotY([6.9, 0], pp.ry);
  return [pp.p[0] + wx, pp.p[1] + 2.9, pp.p[2] + wz];
}
export function centroidAt(f) {
  let x = 0, z = 0;
  for (let i = 0; i < FLEET.length; i++) { const p = shipPoseAt(i, f).p; x += p[0]; z += p[2]; }
  return [x / FLEET.length, 1.5, z / FLEET.length];
}

// ---------- the chief ----------
// Card seed 15: toon headCenter(15) = 299.89 px (computed via node from
// toon.js) -> (975 - 299.89) / 1000 * 2.25 m above the soles at card scale 1.
export const CHIEF_SEED = 15;
export const CHIEF_HEAD_M = 1.5190;
const DECK_LOCAL = [5.0, 2.35]; // prow foredeck of the lead ship (x, deck-top y)
function chiefShipSoles(f) {
  const pp = shipPoseAt(0, f);
  const [wx, wz] = rotY([DECK_LOCAL[0], 0], pp.ry);
  return [pp.p[0] + wx, pp.p[1] + DECK_LOCAL[1], pp.p[2] + wz];
}
function chiefShoreAt(f) {
  if (f >= sf('carry', 0) && f < sf('fog', 0.02)) { // walks beside the bell, slightly ahead
    const b = bellAt(f);
    const x = b[0] + 2.4;
    return [x, groundYAt(x), b[2] - 3.4];
  }
  if (f >= sf('fog', 0.02)) return [4.2, groundYAt(4.2), 2.6];
  const p = k3([[sf('landing', 0.55), [0.5, 0, 1.2]], [sf('wake', 0.45), [10, 0, 0.6]], [sf('want', 0.02), [18.5, 0, 1.5]], [sf('want', 0.95), [18.5, 0, 1.5]]], f);
  return [p[0], groundYAt(p[0]), p[2]];
}
export function chiefSolesAt(f) {
  const shoreU = smooth(ramp(f, sf('landing', 0.55), sf('landing', 0.78))) * (1 - smooth(ramp(f, sf('fog', 0.03), sf('fog', 0.24))));
  return lerp3(chiefShipSoles(f), chiefShoreAt(f), shoreU);
}
export function chiefHeadAt(f) { const s = chiefSolesAt(f); return [s[0], s[1] + CHIEF_HEAD_M, s[2]]; }
// the raised hand of P4: rises across the signal's start, holds, lowers at its end
export const armUAt = (f) => smooth(ramp(f, sf('signal', 0.02), sf('signal', 0.30))) * (1 - smooth(ramp(f, sf('signal', 0.82), sf('signal', 0.99))));

// ---------- the bell ----------
// In the tower through wake (swinging wild in P6), lowered during want,
// carried slung at 1.6 m above the ground during carry, on the lead deck in fog.
const wildAmpAt = (f) => smooth(ramp(f, sf('wake', 0.06), sf('wake', 0.28))) * (1 - smooth(ramp(f, sf('want', 0.0), sf('want', 0.16))));
const tollEnvAt = (f) => { const a = sf('fog', 0.52); return f > a ? Math.exp(-(f - a) / 110) * (1 - smooth(ramp(f, sf('fog', 0.97), TOTAL - 1))) : 0; };
export const swingUAt = (f) => clamp(Math.max(wildAmpAt(f), tollEnvAt(f) * 0.8), 0, 1);
export const bellSwingAt = (f) => { // radians, for the mesh rotation in main.js
  const a = sf('fog', 0.52);
  const toll = f > a ? Math.sin((f - a) * 0.09) * 0.42 * Math.exp(-(f - a) / 110) : 0;
  return Math.sin(f * 0.32) * 0.40 * wildAmpAt(f) + toll;
};
const BELL_GROUND = [24, LAND_Y + 0.75, -5]; // lowered, in front of the church
const BELL_BEACH = [3, groundYAt(3) + 0.75, 0]; // set down on the sand at carry's end
const CARRY_PTS = [[24, -5], [20.5, -2.5], [17, 0], [10, 0.5], [3, 0]];
function bellDeckAt(f) {
  const pp = shipPoseAt(0, f);
  const [wx, wz] = rotY([0.8, 0], pp.ry);
  return [pp.p[0] + wx, pp.p[1] + 2.12 + 0.75, pp.p[2] + wz];
}
export function bellAt(f) {
  if (f < sf('want', 0.10)) { // hanging in the tower, swinging by swingUAt
    const a = bellSwingAt(f);
    return [BELL_TOWER[0] + Math.sin(a) * 0.9, BELL_TOWER[1] - (1 - Math.cos(a)) * 0.5, BELL_TOWER[2]];
  }
  if (f < sf('carry', 0)) { // lowered during want
    const u = smooth(ramp(f, sf('want', 0.10), sf('want', 0.75)));
    return lerp3(BELL_TOWER, BELL_GROUND, u);
  }
  if (f < sf('fog', 0)) { // carried on poles, church -> green -> beach
    const u = clamp((f - sf('carry', 0.04)) / (sf('carry', 0.96) - sf('carry', 0.04)));
    const sp = spline(CARRY_PTS.map(([px, pz]) => [px, 0, pz]), u);
    const x = sp[0], z = sp[2];
    const y = u < 0.12 ? lerp(BELL_GROUND[1], LAND_Y + 1.6, u / 0.12) : u > 0.90 ? lerp(LAND_Y + 1.6, BELL_BEACH[1], (u - 0.90) / 0.10) : LAND_Y + 1.6;
    return [x, y, z];
  }
  // fog: hauled aboard, then rides the lead ship out
  const loadU = smooth(ramp(f, sf('fog', 0.04), sf('fog', 0.40)));
  return lerp3(BELL_BEACH, bellDeckAt(f), loadU);
}

// ---------- warriors ----------
// 8 land during landing (leap from the 3 beached heroes, run beach -> green);
// 6 of them carry the bell during carry. warriorAt(k,f) -> {p, mode}.
const RUN_ENDS = [[19, -2.5], [21, 1.5], [17.5, 3.5], [22, -5], [18.5, -1], [20.5, 5], [16.5, 0.5], [23, -2]];
const GATHER = [[21.8, -6.4], [21.8, -3.6], [24, -6.9], [24, -3.1], [26.2, -6.4], [26.2, -3.6]];
export const runStartAt = (k) => sf('landing', 0.05 + 0.05 * k);
export const runDurAt = (k) => 55 + ((k * 13) % 16);
function deckWorld(shipI, f, lx, ly, lz) {
  const pp = shipPoseAt(shipI, f);
  const [wx, wz] = rotY([lx, lz], pp.ry);
  return [pp.p[0] + wx, pp.p[1] + ly, pp.p[2] + wz];
}
export function warriorAt(k, f) {
  if (f >= sf('fog', 0.06)) return { p: [0, -99, 0], mode: 'hidden' };
  const s = runStartAt(k), d = runDurAt(k), heroI = k % 3;
  if (f < s) { // riding their hero ship (visible from the reveal on)
    if (f < sf('reveal', 0)) return { p: [0, -99, 0], mode: 'hidden' };
    return { p: deckWorld(heroI, f, 2.2, 2.12, k % 2 ? 0.85 : -0.85), mode: 'idle' };
  }
  if (f < sf('carry', 0)) {
    const u = clamp((f - s) / d);
    if (u < 1) { // the run ashore
      const start = deckWorld(heroI, s, 5.6, 2.0, 0);
      const end = RUN_ENDS[k];
      const p = lerp3(start, [end[0], groundYAt(end[0]), end[1]], u);
      p[1] = lerp(start[1], groundYAt(end[0]), Math.min(1, u * 2.2)) + Math.sin(Math.min(1, u / 0.3) * Math.PI) * 0.35 * (u < 0.3 ? 1 : 0);
      p[2] += Math.sin(u * Math.PI) * 0.8 * (k % 2 ? 1 : -1);
      return { p, mode: 'run' };
    }
    if (f >= sf('want', 0) && k < 6) { // gather at the lowered bell
      const g = GATHER[k], e = RUN_ENDS[k];
      const u = smooth(ramp(f, sf('want', 0.05), sf('want', 0.55)));
      const p = lerp3([e[0], groundYAt(e[0]), e[1]], [g[0], groundYAt(g[0]), g[1]], u);
      return { p, mode: 'idle' };
    }
    const e = RUN_ENDS[k];
    return { p: [e[0], groundYAt(e[0]), e[1]], mode: 'idle' };
  }
  if (k >= 6) { const e = RUN_ENDS[k]; return { p: [e[0], groundYAt(e[0]), e[1]], mode: 'idle' }; }
  // carry: flank the bell, 3 to a side along the poles
  const b = bellAt(f), b2 = bellAt(Math.min(TOTAL - 1, f + 6));
  let dx = b2[0] - b[0], dz = b2[2] - b[2];
  const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const side = k % 2 ? 1 : -1, along = (Math.floor(k / 2) - 1) * 1.7;
  const x = b[0] + dx * along + (-dz) * side * 1.18;
  const z = b[2] + dz * along + dx * side * 1.18;
  return { p: [x, groundYAt(x), z], mode: 'carry' };
}

// ---------- villagers ----------
// 5 villagers: asleep at home, flee for the hills during wake, watch after.
const HOMES = [[16, -6], [20, 7], [19, 0.5], [24, 5], [25, -3.5]];
const HILLS = [[36, -9], [39, -3], [37, 4], [41, 8], [35, 10]];
export const fleeUAt = (f) => smooth(ramp(f, sf('wake', 0.10), sf('wake', 0.75)));
export function villagerAt(k, f) {
  const fs = sf('wake', 0.12 + 0.07 * k), dur = 55 + ((k * 17) % 25);
  const h = HOMES[k], hl = HILLS[k];
  if (f < fs) return { p: [h[0], LAND_Y, h[1]], mode: 'idle' };
  const u = clamp((f - fs) / dur);
  if (u >= 1) return { p: [hl[0], LAND_Y, hl[1]], mode: 'idle' };
  const p = lerp3([h[0], LAND_Y, h[1]], [hl[0], LAND_Y, hl[1]], u);
  p[2] += Math.sin(u * Math.PI) * 1.5;
  return { p, mode: 'flee' };
}

// ---------- title / message boards ----------
export const boardAt = (f) => {
  const fade = (a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
  if (f > sf('reveal', 0.10) && f < sf('reveal', 0.92)) return { text: '30 DRAGON SHIPS!', alpha: fade(sf('reveal', 0.10), sf('reveal', 0.20), sf('reveal', 0.82), sf('reveal', 0.92)) };
  if (f > sf('want', 0.15) && f < sf('want', 0.95)) return { text: 'THE GREAT GOLDEN BELL', alpha: fade(sf('want', 0.15), sf('want', 0.25), sf('want', 0.85), sf('want', 0.95)) };
  if (f > sf('fog', 0.28) && f < sf('fog', 0.62)) return { text: 'THE BELL OF ST. BRIDE', alpha: fade(sf('fog', 0.28), sf('fog', 0.36), sf('fog', 0.55), sf('fog', 0.62)) };
  if (f >= sf('fog', 0.62) && f < sf('fog', 0.99)) return { text: 'NEVER SEEN AGAIN', alpha: fade(sf('fog', 0.62), sf('fog', 0.70), sf('fog', 0.92), sf('fog', 0.99)) };
  return null;
};

// ---------- CAMERA: one continuous flight, voice-tracked (pirate machinery) ----------
const BK = 9;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const CAMSEGS = [
  { a: 0, fn: (f) => { // HOOK — water level inside the fog: a dragon prow slides past close
    const prow = prowAt(0, f);
    return { pos: kf3([[0, [-41, 1.5, -8.5]], [50, [-38.5, 1.35, -7.8]], [100, [-35.5, 1.25, -7.2]]], f), look: [prow[0], prow[1] - 0.3, prow[2]], fov: 50 };
  } },
  { a: SEG.village.a, fn: (f) => ({ // VILLAGE — rise from the sea over the beach, drift over rooftops to the church
    pos: kf3([[SEG.village.a, [-40, 2, -6]], [sf('village', 0.5), [6, 3.2, -6]], [sf('village', 1), [14, 3.6, -5]]], f),
    look: kf3([[SEG.village.a, [-38, 3.5, 0]], [sf('village', 0.55), [19, 2.2, -1]], [sf('village', 1), [25.5, 6.5, -6.8]]], f), fov: 52 }) },
  { a: SEG.reveal.a, fn: (f) => ({ // REVEAL — long climb out to the drone: all 30 ships in their rows
    pos: kf3([[SEG.reveal.a, [18, 8, -12]], [sf('reveal', 0.4), [-34, 17, -24]], [sf('reveal', 1), [-105, 48, -34]]], f),
    look: lerp3([26, 8, -7], centroidAt(f), smooth(ramp(f, sf('reveal', 0.05), sf('reveal', 0.45)))), fov: 56 }) },
  { a: SEG.chief.a, fn: (f) => { // CHIEF — fly in from the drone, then push in locked on the chief's head
    const head = chiefHeadAt(f);
    const flight = kf3([[SEG.chief.a, [-102, 44, -32]], [sf('chief', 0.31), [-58, 16, -12]], [sf('chief', 0.51), [-19.8, 6.0, 5.9]]], f);
    const close = add3(head, kf3([[SEG.chief.a, [6.6, 1.6, 5.8]], [sf('chief', 0.76), [5.0, 1.2, 4.5]], [sf('chief', 1), [4.2, 1.0, 3.8]]], f));
    return {
      pos: lerp3(flight, close, smooth(ramp(f, sf('chief', 0.44), sf('chief', 0.60)))),
      look: lerp3(add3(centroidAt(f), [0, 1, 0]), head, smooth(ramp(f, SEG.chief.a, sf('chief', 0.31)))),
      fov: kf([[SEG.chief.a, 46], [sf('chief', 1), 40]], f) };
  } },
  { a: SEG.signal.a, fn: (f) => { // SIGNAL — pull back along the fleet's flank as all 30 turn as one
    const pp = shipPoseAt(0, f).p;
    const off = kf3([[SEG.signal.a, [9, 5.2, 4.6]], [sf('signal', 0.5), [-6, 6, -24]], [sf('signal', 1), [-24, 7, -26]]], f);
    return { pos: add3(pp, off), look: lerp3(chiefHeadAt(f), [heroLeadX(f) - 13, 2, 0], smooth(ramp(f, sf('signal', 0.25), sf('signal', 0.90)))), fov: 54 };
  } },
  { a: SEG.landing.a, fn: (f) => { // LANDING — dive to beach level, then track beside the lead runners
    const r0 = warriorAt(0, f).p;
    const track = [r0[0] + 6.5, 1.75, r0[2] + 2.2];
    return {
      pos: lerp3([-41, 5.2, -15], track, smooth(ramp(f, SEG.landing.a, sf('landing', 0.47)))),
      look: lerp3([heroLeadX(f) - 2, 2.2, 0], [r0[0] - 7, 1.55, r0[2] - 0.6], smooth(ramp(f, sf('landing', 0.11), sf('landing', 0.38)))),
      fov: 50 };
  } },
  { a: SEG.wake.a, fn: (f) => ({ // WAKE — swing to the village: bell tower centred, bell swinging, villagers fleeing across frame
    pos: kf3([[SEG.wake.a, [12.5, 2.0, 7]], [sf('wake', 0.5), [14.5, 2.6, 2.5]], [sf('wake', 1), [16.5, 2.7, 0.5]]], f),
    look: kf3([[SEG.wake.a, [21, 2, -2]], [sf('wake', 0.28), [25, 7, -6.5]], [sf('wake', 1), [26, 7.6, -7]]], f), fov: 50 }) },
  { a: SEG.want.a, fn: (f) => { // WANT — chief close in the green; the look lerps chief -> bell on "golden bell"
    const head = chiefHeadAt(f), bell = bellAt(f);
    const u = smooth(ramp(f, sf('want', 0.45), sf('want', 0.85)));
    const chiefPos = add3(head, kf3([[SEG.want.a, [4.6, 1.25, 3.9]], [sf('want', 1), [4.0, 1.0, 3.2]]], f));
    const bellPos = [bell[0] + 5.5, bell[1] + 2.6, bell[2] + 5.5];
    return { pos: lerp3(chiefPos, bellPos, u * 0.55), look: lerp3(head, bell, u), fov: kf([[SEG.want.a, 44], [sf('want', 1), 40]], f) };
  } },
  { a: SEG.carry.a, fn: (f) => { // CARRY — tracked side-shot at carrier height, following the bell
    const bell = bellAt(f);
    return { pos: [bell[0] - 3.5, 2.0, bell[2] + 10.5], look: bell, fov: 48 };
  } },
  { a: SEG.fog.a, fn: (f) => { // FOG — pull back and rise over the water; the fleet fades, village behind the ships
    const bell = bellAt(f);
    return {
      pos: kf3([[SEG.fog.a, [0, 2.7, 9]], [sf('fog', 0.5), [-26, 6, -16]], [TOTAL - 1, [-66, 11, -36]]], f),
      look: lerp3([3, 1.8, 0], [bell[0], bell[1] + 0.4, bell[2]], smooth(ramp(f, SEG.fog.a, sf('fog', 0.44)))),
      fov: 52 };
  } },
];
export function camAt(f) {
  let i = 0;
  for (let k = 0; k < CAMSEGS.length; k++) if (f >= CAMSEGS[k].a) i = k;
  let c = CAMSEGS[i].fn(f);
  const blendTo = (other, w) => { c = { pos: lerp3(c.pos, other.pos, w), look: lerp3(c.look, other.look, w), fov: lerp(c.fov, other.fov, w) }; };
  if (i + 1 < CAMSEGS.length && f > CAMSEGS[i + 1].a - BK) {
    blendTo(CAMSEGS[i + 1].fn(f), smooth(clamp((f - (CAMSEGS[i + 1].a - BK)) / (2 * BK))));
  } else if (i > 0 && f < CAMSEGS[i].a + BK) {
    const p = CAMSEGS[i - 1].fn(f), w = smooth(clamp((f - (CAMSEGS[i].a - BK)) / (2 * BK)));
    c = { pos: lerp3(p.pos, c.pos, w), look: lerp3(p.look, c.look, w), fov: lerp(p.fov, c.fov, w) };
  }
  let { pos, look, fov } = c;
  const t = f / FPS;
  pos = [pos[0] + Math.sin(t * 0.5) * 0.15, pos[1] + Math.sin(t * 0.8) * 0.08, pos[2]];
  return { pos, look, fov };
}
