// Shot plan for "The Eighteenth Horse" (batch-2 topic 5, EN) — timed to
// the ACTUAL voice stem (54.17 s, 30 fps, TOTAL 1625), clause timings
// from faster-whisper alignment of horses-voice/timing.json (25 clauses):
// L1 0-77 will | L2 77-185 the quote (17 horses, 1/2 1/3 1/9) |
// L3 194-224 "Seventeen." | L4 233-268 half doesn't exist |
// L5 276-303 a third | L6 311-341 a ninth | L7 354-389 fought a week |
// L8 403-439 clever men gave up | L9 451-556 sell them all |
// L10 564-611 father's build | L11 635-676 judge hears |
// L12 689-725 nobody expected | L13 740-816 brought his own horse, added |
// L14 836-854 now eighteen | L15 854-928 nine to eldest |
// L16 945-985 six to middle | L17 995-1030 two to youngest |
// L18 1048-1105 9+6+2=17 | L19 1126-1171 more than expected |
// L20 1187-1247 word for word | L21 1262-1272 and the judge? |
// L22 1274-1375 rode away on his own | L23 1394-1520 donkey hook |
// L24 1520-1593 celebrating | L25 1600-1623 why?
// QUALITY RULES (owner, batch-2): shots change ONLY at clause
// boundaries; camera TRACKS the voice-named subject every beat, never
// freezes, never drifts; characters act in place — travel only via
// foot-locked march/gallop (phase from distance actually travelled);
// costumes by role; counts shown LITERALLY (drone proof of 9/6/2).
// World: cottage interior x=-22, farmyard+paddock x=0, counting field
// x=+26 (three fenced groups 9/6/2), palace square x=+56.
import { M, camFromKeys, blinkAt, walk, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';
import { horseCard } from './extras.js';

export const FPS = 30, TOTAL = 1625, DECK = 0;
export const SHOTS = [
  { id: 'will', a: 0, b: 232, light: 'lamp' },
  { id: 'impossible', a: 233, b: 353, light: 'day' },
  { id: 'fight', a: 354, b: 634, light: 'day' },
  { id: 'judge', a: 635, b: 853, light: 'day' },
  { id: 'count', a: 854, b: 1125, light: 'day' },
  { id: 'verdict', a: 1126, b: 1273, light: 'day' },
  { id: 'ride', a: 1274, b: 1393, light: 'day' },
  { id: 'hook', a: 1394, b: 1624, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  lamp: { az: 70, el: 32, sky: '#8a6a4c', ground: '#3c2c1e', hemi: 0.9, sun: '#ffc37a', sunI: 1.9, fog: '#caa27a', fogNear: 26, fogFar: 160,
    skyTop: '#3c3a55', skyHor: '#caa27a', sunDisc: '#ffe9c0', sunSize: 0.0026, sat: 1.05, vig: 0.3, shadowExt: 12, aurora: 0, gain: '#ffe2b8', ...WATER },
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  dusk: { az: 100, el: 19, sky: '#caa27a', ground: '#5c4a34', hemi: 1.06, sun: '#ffb763', sunI: 2.3, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
  golden: { az: 105, el: 24, sky: '#d9b28c', ground: '#5c5a34', hemi: 1.14, sun: '#ffb763', sunI: 2.4, fog: '#e5cf9e', fogNear: 42, fogFar: 340,
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
  if (S.id === 'fight') {   // a week of arguing: two quick day<->dusk cycles
    let L = LIGHTS.day;
    const seg = (a, b, c, d, A, B) => { if (f >= a && f < d) L = blendLight(A, B, smooth(ramp(f, a, b)) * (f < c ? 1 : 1 - smooth(ramp(f, c, d)))); };
    if (f >= 396 && f < 512) L = blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 396, 436)) * (1 - smooth(ramp(f, 472, 512))));
    else if (f >= 512 && f < 634) L = blendLight(LIGHTS.day, LIGHTS.dusk, smooth(ramp(f, 520, 556)) * (1 - smooth(ramp(f, 592, 632))));
    return { ...L };
  }
  if (S.id === 'ride') return blendLight(LIGHTS.day, LIGHTS.golden, smooth(ramp(f, 1330, 1393)) * 0.55);
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const BED = [-24.3, 0, -3.3];
export const GATE = [7.5, 0, 0.2];
export const G9C = [20.2, 0, -3.1], G6C = [27.3, 0, -3.1], G2C = [33.9, 0, -2.9];
export const POST = [33.5, 0, 1.6];   // where the judge's horse waits, apart

// yard herd: 17 horses, three loose rows inside the paddock
export const YARD17 = [];
for (let i = 0; i < 17; i++) {
  const row = i < 6 ? 0 : i < 12 ? 1 : 2;
  const col = i - (row === 0 ? 0 : row === 1 ? 6 : 12);
  const xs = [[-5, -3, -1, 1, 3, 5], [-5.5, -3.3, -1.1, 1.1, 3.3, 5.5], [-4.4, -2.2, 0, 2.2, 4.4]][row];
  YARD17.push({ x: xs[col] + ((i * 37) % 10 - 5) * 0.03, z: [-1.3, -3.1, -4.9][row], dark: i % 5 === 0 ? 1 : 0, blaze: i % 3 === 0 ? 1 : 0, flip: i % 2 === 1, s: 1.7 + ((i * 7) % 5) * 0.04, seed: 300 + i * 3 });
}
// counting groups: exact grids so the viewer can COUNT them
const grid = (xs, zs, seed0) => { const o = []; let i = 0; for (const z of zs) for (const x of xs) { o.push({ x, z, dark: i % 4 === 0 ? 1 : 0, blaze: i % 3 === 1 ? 1 : 0, flip: i % 2 === 1, s: 1.74 + ((i * 5) % 4) * 0.04, seed: seed0 + i * 3 }); i++; } return o; };
export const GROUP9 = grid([18.2, 20.2, 22.2], [-1.5, -3.2, -4.9], 410);
export const GROUP6 = grid([26.2, 28.4], [-1.5, -3.2, -4.9], 460);
export const GROUP2 = [{ x: 33.0, z: -2.2, dark: 0, blaze: 1, flip: false, s: 1.78, seed: 490 }, { x: 34.8, z: -3.6, dark: 1, blaze: 0, flip: true, s: 1.72, seed: 493 }];

// ---------- judge + horse travel (phase locked to distance) ----------
const pathDist = (keys, f) => {   // arc length of a kf3 path up to frame f
  let d = 0, prev = kf3(keys, keys[0][0]);
  for (let g = keys[0][0] + 2; g <= f; g += 2) { const p = kf3(keys, g); d += Math.hypot(p[0] - prev[0], p[2] - prev[2]); prev = p; }
  return d;
};
const ARRIVE = [[635, [-8.5, 0, 5.8]], [676, [4.9, 0, 5.8]]];
const DEPART = [[700, [4.9, 0, 5.8]], [742, [-13, 0, 5.8]]];
const RETURN = [[753, [-13, 0, 5.8]], [788, [-2, 0, 5.5]], [806, [4.5, 0, 3.4]], [818, [7.6, 0, 0.2]], [830, [6.2, 0, -1.2]], [840, [5.9, 0, -1.5]]];
const RIDE = [[1312, [33.5, 0, 1.6]], [1330, [38, 0, 5.4]], [1345, [44, 0, 5.6]], [1360, [50, 0, 5.75]], [1375, [56, 0, 5.85]], [1393, [63, 0, 5.9]]];
/** Judge's horse position + gait state at frame f. mode: 'off' hides it. */
export const judgeHorseAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'judge') {
    if (f < 676) { const p = kf3(ARRIVE, f); return { pos: p, gallop: 1, phase: q((pathDist(ARRIVE, f) / 3.4) % 1, 3), mounted: true, flip: false }; }
    if (f < 700) return { pos: [4.9, 0, 5.8], gallop: 0, phase: 0, mounted: false, flip: false };
    if (f < 743) { const p = kf3(DEPART, f); return { pos: p, gallop: 1, phase: q((pathDist(DEPART, f) / 3.4) % 1, 3), mounted: true, flip: true }; }
    if (f < 753) return { pos: [-13, 0, 5.8], gallop: 0, phase: 0, mounted: false, flip: true, off: true };
    if (f < 840) { const p = kf3(RETURN, f); const slow = f > 824; return { pos: p, gallop: slow ? 0.3 : 0.85, phase: q((pathDist(RETURN, f) / (slow ? 1.9 : 3.2)) % 1, 3), mounted: f < 826, flip: f < 806 ? false : true }; }
    return { pos: [5.9, 0, -1.5], gallop: 0, phase: 0, mounted: false, flip: true };
  }
  if (S.id === 'count' || S.id === 'verdict') return { pos: [...POST], gallop: 0, phase: 0, mounted: false, flip: true };
  if (S.id === 'ride') {
    if (f < 1312) return { pos: [...POST], gallop: 0, phase: 0, mounted: false, flip: true };
    const p = kf3(RIDE, f); return { pos: p, gallop: 1, phase: q((pathDist(RIDE, f) / 3.4) % 1, 3), mounted: true, flip: false };
  }
  return { pos: [5.9, 0, -1.5], gallop: 0, phase: 0, mounted: false, flip: true, off: true };
};
/** The judge himself when on foot (null while mounted). */
export const judgeManAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'judge') {
    if (f >= 676 && f < 700) return { pos: [5.6, 0, 4.7], mode: 'stand' };
    if (f >= 743 && f < 753) return null;
    if (f >= 826) return { pos: [7.2, 0, -1.2], mode: 'stand' };
    return null;
  }
  if (S.id === 'count') return { pos: [26.0, 0, 1.7], mode: 'stand' };
  if (S.id === 'verdict') return { pos: [26.6, 0, 0.3], mode: 'stand' };
  if (S.id === 'ride') {
    if (f >= 1312) return null;
    const from = [26.6, 0, 0.3], to = [31.8, 0, 1.0];
    const total = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const w = walk(f, 1274, total / (36 / 30), 0.8);
    const p = kf3([[1274, from], [1310, to]], f);
    return { pos: p, mode: f < 1308 ? 'march' : 'stand', phase: q(w.phase, 3) };
  }
  return null;
};

const HERO = {
  will: () => [-24.2, 0.75, -3.3],
  impossible: (f) => f < 276 ? [0, 1.0, -2.8] : lerp3([0, 1.0, -2.8], [0.2, 1.05, 1.85], smooth(ramp(f, 276, 303))),
  fight: (f) => f < 564 ? [0.6, 1.05, 2.0] : [-0.5, 1.7, -7.0],
  judge: (f) => { const h = judgeHorseAt(f); return h.off ? [0, 1.0, 2.0] : [h.pos[0], 1.2, h.pos[2]]; },
  count: (f) => f < 945 ? [...G9C].map((v, i) => i === 1 ? 0.8 : v) : f < 995 ? [G6C[0], 0.8, G6C[2]] : f < 1048 ? [G2C[0], 0.8, G2C[2]] : [26, 0.5, -2.9],
  verdict: () => [26.6, 1.1, 0.25],
  ride: (f) => { const h = judgeHorseAt(f); return [h.pos[0], 1.25, h.pos[2]]; },
  hook: (f) => f < 1600 ? [55.2, 1.05, 0.3] : [57.05, 1.0, 0.15],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it.
const CAMS = {
  will: [
    { f: 0, pos: [-18.8, 2.1, 2.4], look: [-23.2, 1.0, -3.2], fov: 44 },
    { f: 77, pos: [-20.1, 1.8, 1.5], look: [-24.0, 0.95, -3.3], fov: 42, ease: 'surge' },
    { f: 150, pos: [-19.5, 1.95, 2.0], look: [-22.75, 1.4, -3.75], fov: 47, ease: 'surge' },
    { f: 232, pos: [-19.8, 1.9, 1.8], look: [-22.95, 1.35, -3.65], fov: 46 },
  ],
  impossible: [
    { f: 233, pos: [-19.8, 1.9, 1.8], look: [-23.3, 1.35, -3.65], fov: 46 },
    { f: 262, pos: [0.0, 5.6, 12.6], look: [0, 0.9, -2.8], fov: 47, ease: 'surge' },
    { f: 303, pos: [3.0, 2.4, 6.3], look: [0.2, 1.05, 1.75], fov: 40, ease: 'surge' },
    { f: 353, pos: [3.4, 2.5, 6.9], look: [0.4, 1.05, 1.3], fov: 41 },
  ],
  fight: [
    { f: 354, pos: [3.4, 2.5, 6.9], look: [0.4, 1.05, 1.3], fov: 41 },
    { f: 403, pos: [5.4, 2.3, 7.8], look: [2.6, 1.05, 1.6], fov: 42, ease: 'surge' },
    { f: 470, pos: [1.0, 2.1, 6.1], look: [-0.5, 1.0, 1.4], fov: 40, ease: 'surge' },
    { f: 564, pos: [-2.8, 3.1, 9.8], look: [-1.0, 1.7, -6.5], fov: 44, ease: 'surge' },
    { f: 634, pos: [-2.3, 2.9, 9.2], look: [-0.7, 1.5, -4.8], fov: 43 },
  ],
  judge: [
    { f: 635, pos: [-2.3, 2.9, 9.2], look: [-0.7, 1.5, -4.8], fov: 43 },
    { f: 652, pos: [0.2, 2.5, 10.8], look: [-3.1, 1.15, 5.7], fov: 41, ease: 'surge' },
    { f: 676, pos: [5.4, 2.1, 11.0], look: [4.9, 1.15, 5.4], fov: 40, ease: 'surge' },
    { f: 720, pos: [3.4, 2.2, 10.4], look: [1.5, 1.05, 5.2], fov: 41, ease: 'surge' },
    { f: 790, pos: [-1.5, 2.3, 10.8], look: [-3.5, 1.05, 5.2], fov: 42, ease: 'surge' },
    { f: 824, pos: [5.6, 2.4, 10.8], look: [6.4, 1.0, 1.6], fov: 42, ease: 'surge' },
    { f: 844, pos: [0, 6.4, 13.6], look: [0.4, 0.8, -2.2], fov: 47, ease: 'surge' },
    { f: 853, pos: [0, 6.55, 13.9], look: [0.4, 0.8, -2.2], fov: 47 },
  ],
  count: [
    { f: 854, pos: [0, 6.55, 13.9], look: [0.4, 0.8, -2.2], fov: 47 },
    { f: 884, pos: [20.2, 7.6, 7.6], look: [20.2, 0.6, -2.9], fov: 44, ease: 'surge' },
    { f: 930, pos: [20.2, 7.6, 7.6], look: [20.2, 0.6, -2.9], fov: 44 },
    { f: 945, pos: [27.3, 7.2, 7.2], look: [27.3, 0.6, -2.9], fov: 44, ease: 'surge' },
    { f: 988, pos: [27.3, 7.2, 7.2], look: [27.3, 0.6, -2.9], fov: 44 },
    { f: 995, pos: [33.6, 6.2, 6.2], look: [33.6, 0.6, -2.9], fov: 43, ease: 'surge' },
    { f: 1032, pos: [33.6, 6.2, 6.2], look: [33.6, 0.6, -2.9], fov: 43 },
    { f: 1048, pos: [26, 33, 14], look: [26, 0, -2.8], fov: 58, ease: 'surge' },
    { f: 1125, pos: [25.5, 24, 11], look: [26, 0.3, -2.9], fov: 54 },
  ],
  verdict: [
    { f: 1126, pos: [25.5, 24, 11], look: [26, 0.3, -2.9], fov: 54 },
    { f: 1160, pos: [24.8, 6, 7.5], look: [26.2, 0.9, -0.5], fov: 44, ease: 'surge' },
    { f: 1187, pos: [24.4, 1.9, 4.8], look: [26.4, 1.05, -0.2], fov: 40, ease: 'surge' },
    { f: 1262, pos: [28.2, 1.8, 4.6], look: [26.7, 1.12, 0.25], fov: 38, ease: 'surge' },
    { f: 1273, pos: [28.8, 1.85, 5.0], look: [27.2, 1.1, 0.0], fov: 39 },
  ],
  ride: [
    { f: 1274, pos: [28.8, 1.85, 5.0], look: [27.2, 1.1, 0.0], fov: 39 },
    { f: 1312, pos: [30.5, 2.3, 6.8], look: [33.2, 1.15, 1.4], fov: 41, ease: 'surge' },
    { f: 1330, pos: [32.5, 2.8, 13.9], look: [38.6, 1.25, 5.4], fov: 42, ease: 'surge' },
    { f: 1345, pos: [38.5, 2.8, 14.1], look: [44.6, 1.25, 5.6], fov: 42, ease: 'surge' },
    { f: 1360, pos: [44.5, 2.8, 14.25], look: [50.6, 1.25, 5.75], fov: 43, ease: 'surge' },
    { f: 1375, pos: [50.5, 2.8, 14.35], look: [56.6, 1.25, 5.85], fov: 43, ease: 'surge' },
    { f: 1393, pos: [57.5, 2.8, 14.4], look: [63.6, 1.25, 5.9], fov: 44 },
  ],
  hook: [
    { f: 1394, pos: [57.5, 2.8, 14.4], look: [63.6, 1.25, 5.9], fov: 44 },
    { f: 1450, pos: [51.3, 2.2, 7.6], look: [55.8, 1.2, -1.2], fov: 42, ease: 'surge' },
    { f: 1520, pos: [52.4, 1.9, 5.8], look: [55.3, 1.15, -0.2], fov: 40, ease: 'surge' },
    { f: 1600, pos: [53.6, 1.6, 4.7], look: [56.9, 1.02, 0.1], fov: 38, ease: 'surge' },
    { f: 1624, pos: [54.1, 1.55, 4.3], look: [57.05, 1.02, 0.12], fov: 37 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAt(f);
  let cinf = 4.5;
  if (S.id === 'will') cinf = 3.2;
  if (S.id === 'count') cinf = f >= 1048 ? 0 : 3.0;
  if (S.id === 'verdict' || S.id === 'hook') cinf = 3.6;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardWill: 0, boardAdd: 0, boardCount: 0, gateK: 0, goldK: 0, glowA: 0, glowB: 0, glowC: 0 };
  if (S.id === 'will') {
    W.boardWill = smooth(ramp(f, 150, 162)) * (1 - smooth(ramp(f, 200, 212)));
    W.goldK = 0.4 + 0.3 * Math.sin(f * 0.2);
  }
  if (S.id === 'judge') {
    W.gateK = smooth(ramp(f, 798, 816));
    W.boardAdd = smooth(ramp(f, 846, 850));
  }
  if (S.id === 'count') {
    if (f < 945) W.glowA = smooth(ramp(f, 884, 900)) * (1 - smooth(ramp(f, 928, 944)));
    if (f >= 945 && f < 995) W.glowB = smooth(ramp(f, 945, 958)) * (1 - smooth(ramp(f, 978, 994)));
    if (f >= 995 && f < 1048) W.glowC = smooth(ramp(f, 995, 1008)) * (1 - smooth(ramp(f, 1032, 1047)));
    W.boardCount = smooth(ramp(f, 1052, 1062)) * (1 - smooth(ramp(f, 1168, 1180)));
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: 0.3, dustRate: S.id === 'ride' && f >= 1312 ? 0.45 : 0.12 };
};

// ---------- actors ----------
const TINT = { lamp: '#ffcf96', day: '#ffffff', golden: '#ffd9a3' };
const tintFor = (S, f) => (S.id === 'ride' && f > 1360 ? TINT.golden : TINT[S.light] || '#ffffff');
// COSTUMES BY ROLE — brothers in plain farmer clothes, told apart by
// colour; the judge in a travelling robe + turban; old men in grey.
export const OUTFITS = {
  eldest: { jacket: '#7a4a2a', pants: '#4a3626', boots: '#2e2118', hat: 'hair', hair: '#241a12', skin: '#e8b08a' },
  middle: { jacket: '#3f6186', pants: '#2e3a4a', boots: '#241a12', hat: 'hair', hair: '#17120c', skin: '#c98a5a' },
  youngest: { jacket: '#5d7a3a', pants: '#3d4a2a', boots: '#2e2118', hat: 'hair', hair: '#2c1e10', skin: '#e8b08a' },
  judge: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'cap', cap: '#e8ddc4', skin: '#c98a5a' },
  oldman1: { jacket: '#6a6a66', pants: '#3d3d3a', boots: '#241a12', hat: 'cap', cap: '#d8d2c2', skin: '#e8b08a' },
  oldman2: { jacket: '#59544c', pants: '#33302a', boots: '#1c1a17', hat: 'cap', cap: '#c9c2ae', skin: '#d9a878' },
  man: { jacket: '#8a6a34', pants: '#54432a', boots: '#2e2118', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  king: { jacket: '#a02525', pants: '#4a2430', boots: '#241a12', hat: 'cap', cap: '#d9a441', skin: '#e8b08a' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
// turban wrap drawn over the judge's cap (head centre cy tuned per seed)
const turban = (T, o, opts, pos, extra = {}) => ({
  key: 'judge' + JSON.stringify(o) + JSON.stringify(opts),
  draw: (p) => {
    T.bodyFront(p, o, opts);
    p.ell(300, 232, 108, 50, '#e8ddc4', 6);
    p.arc(300, 240, 100, 42, 195, 345, 5, '#c9b992');
    p.arc(300, 218, 102, 45, 200, 340, 4, '#f4ecd8');
    p.dot(402, 214, 15, '#e8ddc4');
    p.ell(300, 196, 15, 10, '#d9a441', 3);
  },
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra,
});
const judgeFig = (T, tint, f, expr, pos, opts = {}, extra = {}) => turban(T, OUTFITS.judge, { expr, mode: 'stand', blink: blinkAt(f, 51), seed: 51, ...opts }, pos, { tint, ...extra });
// the dying father, lying in bed: pillow, grey head, blanket mound
const fatherFig = (T, tint, pos) => ({
  key: 'fatherLying',
  draw: (p) => {
    p.ell(85, 748, 92, 44, '#f2ead8', 5);                        // pillow
    p.ell(290, 872, 235, 108, '#7a3038', 6);                     // blanket mound
    p.ell(290, 838, 235, 96, '#8c3640', 0);
    p.stroke([[73, 806], [245, 782], [465, 800]], 7, '#5d242b');
    p.dot(95, 688, 54, '#e3ac84');                               // head
    p.arc(95, 672, 50, 40, 180, 340, 9, '#cfd0cc');              // grey hair
    p.arc(73, 692, 13, 8, 200, 340, 4, '#241726');               // closed eye
    p.arc(121, 692, 13, 8, 200, 340, 4, '#241726');
    p.stroke([[85, 726], [107, 726]], 4, '#8a5a3a');             // mouth
    p.ell(255, 806, 21, 13, '#e3ac84', 3);                       // hand on blanket
  },
  x: pos[0], y: pos[1] + 0.35, z: pos[2], ground: pos[2], tint, blob: false, shadow: false, flip: true,
});
const horse = (T, tint, h, extra = {}) => ({
  key: 'horse' + h.seed + JSON.stringify({ d: h.dark, b: h.blaze, g: 0, s: 0, bl: h.blink || 0, j: 0 }),
  draw: (p) => horseCard(p, { dark: h.dark, blaze: h.blaze, blink: h.blink || 0, gallop: 0, step: 0 }),
  x: h.x, y: 0, z: h.z, ground: 0, s: h.s, flip: h.flip, tint, ...extra,
});
const judgeHorse = (T, tint, f) => {
  const h = judgeHorseAt(f);
  if (h.off) return null;
  const o = { dark: 1, blaze: 0, blink: blinkAt(f, 77), gallop: h.gallop, step: h.phase, ...(h.mounted ? { jockey: { silks: '#5d3a6e', cap: '#e8ddc4' } } : {}) };
  return { key: 'judgehorse' + JSON.stringify(o), draw: (p) => horseCard(p, o), x: h.pos[0], y: 0, z: h.pos[2], ground: 0, s: 1.82, flip: h.flip, tint };
};
const sonsAtFence = (T, tint, f, exprs = ['nervous', 'nervous', 'nervous']) => {
  const st = stand(T, tint, f);
  return [
    st(OUTFITS.eldest, exprs[0], 41, [-1.6, 0, 1.8], { yaw: 0.12 }),
    st(OUTFITS.middle, exprs[1], 42, [0.2, 0, 1.9], { yaw: 0 }),
    st(OUTFITS.youngest, exprs[2], 43, [1.9, 0, 1.8], { yaw: -0.12, s: 0.94 }),
  ];
};
const marchTo = (T, tint, f, o, expr, seed, from, to, f0, f1, extra = {}) => {
  const total = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const w = walk(f, f0, (total / ((f1 - f0) / 30)), 0.8);
  const p = kf3([[f0, from], [f1, to]], f);
  const moving = f > f0 && f < f1;
  return RW(T, o, { expr, mode: moving ? 'march' : 'stand', phase: q(w.phase, 3), blink: blinkAt(f, seed), seed }, p, { tint, ...extra });
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const st = stand(T, tint, f);
  switch (S.id) {
    case 'will': {
      out.push(fatherFig(T, tint, BED));
      out.push(RW(T, OUTFITS.eldest, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 41), seed: 41, prop: ['letter', 0.3] }, [-22.3, 0, -1.5], { tint, yaw: 0.45 }));
      out.push(st(OUTFITS.middle, 'nervous', 42, [-21.4, 0, -1.2], { yaw: 0.3 }));
      out.push(st(OUTFITS.youngest, 'nervous', 43, [-20.6, 0, -1.6], { yaw: 0.2, s: 0.94 }));
      break;
    }
    case 'impossible': {
      for (const h of YARD17) out.push(horse(T, tint, { ...h, blink: blinkAt(f, h.seed) }));
      out.push(...sonsAtFence(T, tint, f));
      break;
    }
    case 'fight': {
      for (const h of YARD17) out.push(horse(T, tint, { ...h, blink: blinkAt(f, h.seed) }));
      if (f < 403) { out.push(...sonsAtFence(T, tint, f, ['stern', 'stern', 'nervous'])); break; }
      const wv = q(0.5 + 0.5 * Math.sin(f * 0.3), 2);
      out.push(RW(T, OUTFITS.eldest, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 41), seed: 41, wave: f < 560 ? wv : 0, headTilt: f >= 564 ? 9 : 0 }, [-0.8, 0, 2.2], { tint, yaw: 0.3 }));
      out.push(RW(T, OUTFITS.middle, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 42), seed: 42, wave: f < 560 ? q(0.5 + 0.5 * Math.sin(f * 0.3 + 2), 2) : 0, headTilt: f >= 564 ? 9 : 0 }, [1.4, 0, 2.3], { tint, yaw: -0.3 }));
      out.push(st(OUTFITS.youngest, 'nervous', 43, [3.1, 0, 2.0], { yaw: -0.2, s: 0.94, ...(f >= 564 ? { headTilt: 9 } : {}) }));
      out.push(marchTo(T, tint, f, OUTFITS.oldman1, 'neutral', 61, [10.5, 0, 2.4], [5.6, 0, 2.2], 403, 436, { yaw: -0.25 }));
      out.push(marchTo(T, tint, f, OUTFITS.oldman2, 'dazed', 62, [11.5, 0, 1.8], [6.9, 0, 1.9], 410, 443, { yaw: -0.3 }));
      break;
    }
    case 'judge': {
      for (const h of YARD17) out.push(horse(T, tint, { ...h, blink: blinkAt(f, h.seed) }));
      const jh = judgeHorse(T, tint, f); if (jh) out.push(jh);
      const jm = judgeManAt(f);
      if (jm) out.push(judgeFig(T, tint, f, f >= 826 ? 'grin' : 'neutral', jm.pos, jm.mode === 'march' ? { mode: 'march', phase: jm.phase } : {}, { yaw: f >= 826 ? 0.5 : -0.35 }));
      // (the added horse itself is judgeHorse above — standing in the
      // paddock from f=840, so the yard reads 18 from the wide key on)
      // sons: at the fence, then hurry to the roadside to meet him, then watch
      if (f < 650) out.push(...sonsAtFence(T, tint, f, ['neutral', 'neutral', 'neutral']));
      else if (f < 700) {
        out.push(marchTo(T, tint, f, OUTFITS.eldest, 'neutral', 41, [-1.6, 0, 1.8], [3.6, 0, 4.3], 650, 678, { yaw: -0.3 }));
        out.push(marchTo(T, tint, f, OUTFITS.middle, 'neutral', 42, [0.2, 0, 1.9], [6.9, 0, 4.5], 652, 682, { yaw: 0.3 }));
        out.push(marchTo(T, tint, f, OUTFITS.youngest, 'neutral', 43, [1.9, 0, 1.8], [5.3, 0, 3.8], 654, 680, { yaw: 0, s: 0.94 }));
      } else {
        const ex = f >= 743 && f < 790 ? 'nervous' : 'neutral';
        out.push(st(OUTFITS.eldest, ex, 41, [3.6, 0, 4.3], { yaw: -0.55 }));
        out.push(st(OUTFITS.middle, ex, 42, [6.9, 0, 4.5], { yaw: 0.5 }));
        out.push(st(OUTFITS.youngest, ex, 43, [5.3, 0, 3.8], { yaw: 0.1, s: 0.94 }));
      }
      break;
    }
    case 'count': {
      for (const h of GROUP9) out.push(horse(T, tint, { ...h, blink: blinkAt(f, h.seed) }));
      for (const h of GROUP6) out.push(horse(T, tint, { ...h, blink: blinkAt(f, h.seed) }));
      for (const h of GROUP2) out.push(horse(T, tint, { ...h, blink: blinkAt(f, h.seed) }));
      const jh = judgeHorse(T, tint, f); if (jh) out.push(jh);
      out.push(st(OUTFITS.eldest, 'neutral', 41, [20.2, 0, 1.3], { yaw: 0.1 }));
      out.push(st(OUTFITS.middle, 'neutral', 42, [27.3, 0, 1.3], { yaw: 0 }));
      out.push(st(OUTFITS.youngest, 'neutral', 43, [33.6, 0, 1.1], { yaw: -0.1, s: 0.94 }));
      out.push(judgeFig(T, tint, f, 'stern', [26.0, 0, 1.7], {}, { yaw: 0 }));
      break;
    }
    case 'verdict': {
      for (const h of GROUP9) out.push(horse(T, tint, { ...h, blink: blinkAt(f, h.seed) }));
      for (const h of GROUP6) out.push(horse(T, tint, { ...h, blink: blinkAt(f, h.seed) }));
      for (const h of GROUP2) out.push(horse(T, tint, { ...h, blink: blinkAt(f, h.seed) }));
      const jh = judgeHorse(T, tint, f); if (jh) out.push(jh);
      const jm = judgeManAt(f);
      const handing = f >= 1187 && f < 1247;
      if (jm) out.push(judgeFig(T, tint, f, f >= 1262 ? 'grin' : 'neutral', jm.pos, jm.mode === 'march' ? { mode: 'march', phase: jm.phase } : handing ? { prop: ['letter', 0.35] } : {}, { yaw: -0.3 }));
      out.push(RW(T, OUTFITS.eldest, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), seed: 41, ...(handing ? { prop: ['letter', 0.3] } : {}) }, [25.2, 0, 0.7], { tint, yaw: 0.35 }));
      out.push(st(OUTFITS.middle, 'smile', 42, [28.3, 0, 0.9], { yaw: -0.2 }));
      out.push(st(OUTFITS.youngest, 'grin', 43, [29.6, 0, 0.4], { yaw: -0.3, s: 0.94 }));
      break;
    }
    case 'ride': {
      const jh = judgeHorse(T, tint, f); if (jh) out.push(jh);
      const jm = judgeManAt(f);
      if (jm) out.push(judgeFig(T, tint, f, 'grin', jm.pos, jm.mode === 'march' ? { mode: 'march', phase: jm.phase } : {}, { yaw: -0.5 }));
      out.push(st(OUTFITS.eldest, 'smile', 41, [25.2, 0, 0.7], { yaw: 0.4 }));
      break;
    }
    case 'hook': {
      out.push(RW(T, OUTFITS.king, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 95), seed: 95 }, [56, 0.78, -5.35, 0.78], { tint: '#cbb490', yaw: 0, blob: false }));
      const wv = f >= 1520 ? q(0.55 + 0.45 * Math.sin(f * 0.32), 2) : 0;
      out.push(RW(T, OUTFITS.man, { expr: f >= 1520 ? 'grin' : 'smile', mode: 'stand', blink: blinkAt(f, 91), seed: 91, wave: wv }, [55.2, 0, 0.3], { tint, yaw: 0.3 }));
      out.push({
        key: 'donkey' + blinkAt(f, 97),
        draw: (p) => {
          horseCard(p, { dark: 1, blaze: 0, blink: blinkAt(f, 97), gallop: 0, step: 0 });
          p.poly([[492, 524], [472, 388], [508, 396], [516, 514]], '#4e2e20', 3.5);   // long ears
          p.poly([[522, 512], [524, 380], [554, 398], [540, 506]], '#4e2e20', 3.5);
        },
        x: 57.05, y: 0, z: 0.15, ground: 0, s: 1.18, flip: true, tint: '#a3aab4',
      });
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, t) => out.push({ key, draw: (p) => T.fxBurst(p, t, '#ffe066', 8, 20, 110), x, y, z, blob: false, shadow: false });
  const win = (f0, x, z) => { if (f >= f0 && f <= f0 + 14) burst('cnt' + f0 + '_' + q((f - f0) / 14, 2), x, 2.3, z, q((f - f0) / 14, 2)); };
  win(862, G9C[0], G9C[2]); win(952, G6C[0], G6C[2]); win(1002, G2C[0], G2C[2]);
  if (f >= 1606 && f <= 1622) burst('why_' + q((f - 1606) / 16, 2), 57.0, 1.7, 0.4, q((f - 1606) / 16, 2));
  return out;
};
