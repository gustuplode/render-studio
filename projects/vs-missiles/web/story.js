// "US Missiles vs Chinese Missiles — the Collections" — coded 9:16 showcase short.
// Bear v4 / Pigeon v2 professional standard: keyframed flight paths + TRACKING DIRECTOR.
//
// STRUCTURE RULE: every timing in this file flows from the ONE TIMING table below.
// All keyframe tracks are built from shot fractions (u = 0..1 of the shot) via the K()/CK()
// helpers, so patching TIMING re-times the whole film — no hard-coded frames anywhere else.
// (The parent patches the estimated timings when the real voice lands.)
//
// Friendly airshow framing: launches, flight, and a Patriot "shield wall" whose hits burst
// as fireworks in the sky. No impacts on targets, no explosions on cities.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30;
// ---------- THE timing table: [phraseId, startFrame, endFrame] ----------
export const TIMING = [
  ['hook', 0, 122],        // two pads facing off, six hero missiles in two rows of three
  ['us', 122, 185],        // US side intro: officer + the American row
  ['tomahawk', 185, 308], // low, terrain-hugging cruise flight
  ['minuteman', 308, 395],// huge, steep sky arc to the stars
  ['trident', 395, 494],  // submarine launch, bursts out of the sea
  ['china', 494, 560],    // China side intro: officer + the Chinese row
  ['df21', 560, 678],     // high arc, dives past a carrier silhouette, splash far beyond
  ['df17', 678, 831],     // flat, super-fast glider skim with heat streaks
  ['df41', 831, 941],     // the biggest: slow majestic rise
  ['speed', 941, 1060],   // side-by-side race, MACH 10 board
  ['patriot', 1060, 1196],// the answer: interceptor arcs -> fireworks + laser test
  ['verdict', 1196, 1448],// both collections parked at dusk, crane pull-back
];
export const TOTAL = TIMING[TIMING.length - 1][2]; // 1350 frames = 45.0 s @ 30 fps
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
const LIGHT_OF = { hook: 'day', us: 'day', tomahawk: 'day', minuteman: 'golden', trident: 'golden', china: 'golden', df21: 'golden', df17: 'golden', df41: 'dusk', speed: 'dusk', patriot: 'dusk', verdict: 'dusk' };
export const SHOTS = TIMING.map(([id, a, b]) => ({ id, a, b, light: LIGHT_OF[id] }));
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const ph = (id, f) => clamp((f - SEG[id].a) / SEG[id].len);   // phase 0..1 inside a shot
const smooth = M.smooth;
// keyframe helpers: rows are [u, value, easeFromPrev?, via?] with u = shot fraction
const K = (id, rows) => rows.map(([u, v, e, via]) => [Math.round(SEG[id].a + u * SEG[id].len), v, e, via]);
const CK = (id, rows) => rows.map(([u, pos, look, fov, ease, roll]) => ({ f: Math.round(SEG[id].a + u * SEG[id].len), pos, look, fov, ease, roll }));

// ---------- lights (Bear v4 palettes) ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 260,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 18, ...WATER },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 40, fogFar: 240,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', vig: 0.26, shadowExt: 18, ...WATER },
  dusk: { az: 30, el: 20, sky: '#8d8578', ground: '#4c4438', hemi: 0.95, sun: '#ffb46c', sunI: 2.0, fog: '#9a8a76', fogNear: 30, fogFar: 190,
    skyTop: '#5c5648', skyHor: '#d9a06a', sunDisc: '#ffe9c0', sunSize: 0.003, sat: 1.04, vig: 0.3, shadowExt: 16, waterDeep: '#2c445c', waterShal: '#3a5a74', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- missile flight paths (single source: actors, camera, trails, smoke all read these) ----------
// US range x~40 · Trident sea x~133 · China range x~210 · carrier sea x~272 · Patriot x~330.
const T3 = (keys) => (f) => kf3(keys, f);
// Flight paths are Catmull-Rom splines through control points, driven by a cruise phase
// (gentle launch settle + gentle exit, near-constant speed between) — no per-key speed pulsing.
const cruise = (u) => u < 0.12 ? M.surge(u / 0.12) * 0.12 : u > 0.88 ? 0.88 + M.surge((u - 0.88) / 0.12) * 0.12 : u;
const SP = (id, pts) => (f) => spline(pts, cruise(ph(id, f)));
const PATH = {
  tomahawk: SP('tomahawk', [[36, 0.9, -4], [37, 3.0, -4.2], [40, 5.2, -5], [56, 4.2, -7], [76, 3.4, -9.5], [98, 4.6, -12]]),
  minuteman: SP('minuteman', [[47, 1.2, 13], [48.5, 16, 12.5], [53, 34, 11], [61, 56, 8], [71, 76, 5]]),
  trident: SP('trident', [[133, -2.5, 8], [133, 1.5, 8], [136, 13, 7], [145, 32, 4.5], [159, 54, 0]]),
  df21: SP('df21', [[204, 1, -6], [210, 20, -7.5], [226, 40, -13], [246, 34, -19], [266, 12, -25], [282, 2.5, -28.5], [291, 0.2, -30]]),
  df17: SP('df17', [[204, 0.9, 14], [208, 7, 13.6], [220, 12.5, 13], [248, 13.2, 12], [274, 12.6, 11], [298, 13.5, 10]]),
  df41: SP('df41', [[214, 1.6, 4], [215, 13, 4], [219, 32, 3.4], [226, 52, 2.6], [234, 68, 1.8]]),
  streakUS: SP('speed', [[52, 34, -16], [124, 34, -16], [196, 34, -16]]),
  streakCN: SP('speed', [[52, 39, -22], [124, 39, -22], [196, 39, -22]]),
};
// Patriot shield wall: practice targets arc in, interceptors rise to meet them (hits = fireworks).
const B1 = [326, 17, -2], B2 = [333, 20, -7];
const PATH2 = {
  tgt1: T3(K('patriot', [[0.00, [300, 19, -12]], [0.40, B1, 'easeIn']])),
  tgt2: T3(K('patriot', [[0.18, [298, 23, -16]], [0.64, B2, 'easeIn']])),
  int1: T3(K('patriot', [[0.18, [330, 1.2, 2]], [0.40, B1, 'easeInOut', [[328, 9, -1]]]])),
  int2: T3(K('patriot', [[0.42, [330, 1.2, 2]], [0.64, B2, 'easeInOut', [[331, 10, -3]]]])),
};
const pathOf = (id) => PATH[id] || PATH2[id];
/** Missile state at f: position, unit direction, speed (m/frame), flame 0..1. */
const mkState = (path, f, flame) => {
  const p = path(f);
  let p2 = path(f + 1.5), d = [p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]], sp = Math.hypot(...d);
  if (sp < 1e-4) { const p0 = path(f - 1.5); d = [p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]]; sp = Math.hypot(...d) || 1e-4; }
  return { p, d: d.map((v) => v / sp), speed: sp / 1.5, flame };
};
const FLAME = {
  tomahawk: (f) => (ph('tomahawk', f) < 0.14 ? 1 : 0.5),            // boost pop, then cruise jet
  minuteman: () => 1,
  trident: (f) => (ph('trident', f) < 0.07 ? 0 : 1),                // lights as it breaches
  df21: (f) => (ph('df21', f) < 0.9 ? 1 : 0.35),
  df17: (f) => (ph('df17', f) < 0.16 ? 1 : 0.22),                   // boost, then the glider coasts
  df41: () => 1,
  streakUS: () => 0.7, streakCN: () => 0.85,
  int1: () => 1, int2: () => 1, tgt1: () => 0.15, tgt2: () => 0.15,
};
const SPIN = { minuteman: 0.020, df41: 0.016, trident: 0.010 };    // rad/frame roll about the axis
const TRAILERS = ['minuteman', 'trident', 'df21', 'df41'];         // smoky ones get puff trails
const trailOf = (id, f) => {
  const a = SEG[id].a, out = [];
  for (let k = 1; k <= 8; k++) { const ff = f - k * 3; if (ff < a) break; const u = k / 8; out.push({ p: pathOf(id)(ff), s: 0.5 + u * 1.6, a: (1 - u) * 0.45 }); }
  return out;
};
// which flight shot owns which missile, and the frame window it is visible in
const FLIGHTS = [
  { id: 'tomahawk', shot: 'tomahawk' }, { id: 'minuteman', shot: 'minuteman' }, { id: 'trident', shot: 'trident' },
  { id: 'df21', shot: 'df21' }, { id: 'df17', shot: 'df17' }, { id: 'df41', shot: 'df41' },
  { id: 'streakUS', shot: 'speed' }, { id: 'streakCN', shot: 'speed' },
  { id: 'tgt1', shot: 'patriot' }, { id: 'tgt2', shot: 'patriot' }, { id: 'int1', shot: 'patriot' }, { id: 'int2', shot: 'patriot' },
];
const missileAt = (id, f) => {
  const fl = FLIGHTS.find((x) => x.id === id); if (!fl) return null;
  const S = SEG[fl.shot]; if (f < S.a || f > S.b) return null;
  if (id === 'tgt1' && f >= SEG.patriot.a + 0.40 * SEG.patriot.len) return null;   // met by the shield
  if (id === 'tgt2' && f >= SEG.patriot.a + 0.64 * SEG.patriot.len) return null;
  if (id === 'int1' && (f < SEG.patriot.a + 0.18 * SEG.patriot.len || f >= SEG.patriot.a + 0.40 * SEG.patriot.len)) return null;
  if (id === 'int2' && (f < SEG.patriot.a + 0.42 * SEG.patriot.len || f >= SEG.patriot.a + 0.64 * SEG.patriot.len)) return null;
  if (id === 'streakUS' && (ph('speed', f) < 0.06 || ph('speed', f) > 0.94)) return null;
  if (id === 'streakCN' && (ph('speed', f) < 0.15 || ph('speed', f) > 0.90)) return null;
  const st = mkState(pathOf(id), f, FLAME[id](f));
  st.spin = (SPIN[id] || 0) * (f - S.a);
  if (TRAILERS.includes(id)) st.trail = trailOf(id, f);
  return st;
};
// laser-test drone: flies in during the patriot shot, wing is melted, glides down, lands safe.
const droneAt = (f) => {
  const S = SEG.patriot; if (f < S.a || f > S.b) return null;
  const u = ph('patriot', f); if (u < 0.60) return null;
  const p = kf3(K('patriot', [
    [0.60, [302, 7, 14]], [0.78, [328, 6.6, 14]], [0.90, [343, 3.6, 15], 'easeInOut'], [0.985, [350, 0.78, 16], 'easeOut'],
  ]), f);
  let y = p[1]; const landF = S.a + 0.985 * S.len;
  if (f > landF) y += Math.abs(Math.sin((f - landF) * 0.9)) * 0.12 * Math.max(0, 1 - (f - landF) / 6); // comic bounce
  const tilt = 0.55 * smooth(ramp(f, S.a + 0.74 * S.len, S.a + 0.92 * S.len));
  return { p: [p[0], y, p[2]], tilt };
};
const laserAt = (f) => {
  const S = SEG.patriot, on = f >= S.a + 0.70 * S.len && f <= S.a + 0.90 * S.len;
  const D = droneAt(f);
  return { on: on && !!D, a: [334, 2.3, 10], b: D ? D.p : [334, 2.3, 10] };
};
// launch smoke emitters: {p, t 0..1, r} — one per launch, 26-frame life
const LAUNCHES = [
  { shot: 'tomahawk', p: [36, 0.3, -4], r: 1.6, at: 0 }, { shot: 'minuteman', p: [47, 0.3, 13], r: 2.6, at: 0 },
  { shot: 'trident', p: [133, 0.2, 8], r: 2.0, at: 0.06 }, { shot: 'df21', p: [204, 0.3, -6], r: 1.8, at: 0 },
  { shot: 'df17', p: [204, 0.3, 14], r: 1.6, at: 0 }, { shot: 'df41', p: [214, 0.3, 4], r: 3.0, at: 0 },
  { shot: 'patriot', p: [330, 0.4, 2], r: 1.2, at: 0.18 }, { shot: 'patriot', p: [330, 0.4, 2], r: 1.2, at: 0.42 },
];
const smokeAt = (f) => LAUNCHES.map((L) => {
  const S = SEG[L.shot], f0 = S.a + L.at * S.len, age = f - f0;
  return (age >= 0 && age < 26) ? { p: L.p, t: age / 26, r: L.r } : null;
}).filter(Boolean);

// ---------- TRACKING DIRECTOR ----------
const ROW_US = [-9, 3.4, 0], ROW_CN = [9, 3.4, 0], PLAZA = [0, 3.2, 0];
const OFF_US = [34, 1.5, 7.2], OFF_CN = [198.5, 1.5, 7.2], OFF_PAT = [325, 1.5, 7.7];
const leadAt = (f) => { // speed test: track whichever streak is ahead
  const a = missileAt('streakUS', f), b = missileAt('streakCN', f);
  if (a && b) return lerp3(b.p, a.p, 0.5 + 0.45 * Math.tanh((a.p[0] - b.p[0]) / 4)); // smooth handover as they pass
  return (a || b || { p: pathOf('streakUS')(f) }).p; // pre-launch: sit at the streak start, no jump
};
const TRACKDIR = {
  hook: [{ a: SEG.hook.a, b: SEG.hook.b, type: 'subject', id: 'rows', pos: () => PLAZA, w: 0.45 }],
  us: [
    { a: SEG.us.a, b: SEG.us.a + 34, type: 'character', id: 'officer-us', pos: () => OFF_US, w: 0.6 },
    { a: SEG.us.a + 34, b: SEG.us.b, type: 'subject', id: 'us-row', pos: () => [41, 3.4, 0], w: 0.5 },
  ],
  tomahawk: [{ a: SEG.tomahawk.a, b: SEG.tomahawk.b, type: 'object', id: 'tomahawk', pos: (f) => pathOf('tomahawk')(f), w: 0.75 }],
  minuteman: [{ a: SEG.minuteman.a, b: SEG.minuteman.b, type: 'object', id: 'minuteman', pos: (f) => pathOf('minuteman')(f), w: 0.75 }],
  trident: [{ a: SEG.trident.a, b: SEG.trident.b, type: 'object', id: 'trident', pos: (f) => pathOf('trident')(f), w: 0.75 }],
  china: [
    { a: SEG.china.a, b: SEG.china.a + 34, type: 'character', id: 'officer-cn', pos: () => OFF_CN, w: 0.6 },
    { a: SEG.china.a + 34, b: SEG.china.b, type: 'subject', id: 'cn-row', pos: () => [211, 3.4, 0], w: 0.5 },
  ],
  df21: [{ a: SEG.df21.a, b: SEG.df21.b, type: 'object', id: 'df21', pos: (f) => pathOf('df21')(f), w: 0.75 }],
  df17: [{ a: SEG.df17.a, b: SEG.df17.b, type: 'object', id: 'df17', pos: (f) => pathOf('df17')(f), w: 0.75 }],
  df41: [{ a: SEG.df41.a, b: SEG.df41.b, type: 'object', id: 'df41', pos: (f) => pathOf('df41')(f), w: 0.75 }],
  speed: [{ a: SEG.speed.a, b: SEG.speed.b, type: 'object', id: 'leader', pos: leadAt, w: 0.7, posW: 0.5 }],
  patriot: [
    { a: SEG.patriot.a, b: SEG.patriot.a + 16, type: 'character', id: 'officer-pat', pos: () => OFF_PAT, w: 0.55 },
    { a: SEG.patriot.a + 16, b: SEG.patriot.a + 42, type: 'object', id: 'int1', pos: (f) => pathOf('int1')(f), w: 0.5 },
    { a: SEG.patriot.a + 42, b: SEG.patriot.b, type: 'object', id: 'shield-drone', w: 0.52,
      // int2 flight -> hold at the burst -> long smooth glide down to the laser drone beat
      pos: (f) => {
        const A = SEG.patriot.a, hit = A + 0.64 * SEG.patriot.len, glide0 = hit - 4, glide1 = hit + 26;
        if (f < glide0) return pathOf('int2')(f); // holds at the pad pre-launch, flies, holds at B2
        const D = droneAt(f), P = D ? D.p : [350, 0.78, 16];
        return f < glide1 ? lerp3(B2, P, smooth(ramp(f, glide0, glide1))) : P;
      } },
  ],
  verdict: [{ a: SEG.verdict.a, b: SEG.verdict.b, type: 'subject', id: 'rows', pos: () => PLAZA, w: 0.5 }],
};
const BLEND = 10;
export const dirFor = (id, f) => {
  const segs = TRACKDIR[id];
  let i = segs.findIndex((s) => f <= s.b); if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  let point = seg.pos(f), w = seg.w;
  const nx = segs[i + 1];
  if (nx && f >= nx.a - BLEND / 2) {
    const t = smooth(ramp(f, nx.a - BLEND / 2, nx.a + BLEND / 2));
    point = lerp3(point, nx.pos(f), t); w = lerp(w, nx.w, t);
  }
  return { point, w, seg };
};
export const dirAt = (f) => dirFor(shotAt(f).id, f);

// ---------- cameras ----------
const CAMS = {
  hook: CK('hook', [
    [0, [30, 5.5, 50], [0, 3.6, -1], 44], [0.6, [27, 5.0, 46], [0, 3.5, -1], 43, 'surge'], [1, [24, 4.6, 42], [0, 3.4, -1], 42],
  ]),
  us: CK('us', [
    [0, [30.5, 2.1, 13.5], [34, 1.4, 7.2], 41], [0.38, [31.5, 2.3, 12], [37, 2.2, 3], 40, 'surge'], [1, [33, 2.6, 11], [41, 3.4, 0], 39, 'surge'],
  ]),
  china: CK('china', [
    [0, [195, 2.1, 13.5], [198.5, 1.4, 7.2], 41], [0.38, [196, 2.3, 12], [204, 2.2, 3], 40, 'surge'], [1, [198, 2.6, 11], [211, 3.4, 0], 39, 'surge'],
  ]),
  speed: CK('speed', [
    [0, [94, 37, 15], [110, 36, -19], 44], [0.55, [128, 37, 15], [140, 36.5, -19], 42, 'easeInOut'], [1, [152, 37, 15], [168, 36, -19], 41],
  ]),
  patriot: CK('patriot', [
    [0, [306, 7, 34], [328, 6, 0], 44], [0.45, [310, 6.5, 31], [329, 7, -2], 42.5, 'surge'], [0.75, [318, 5.5, 26], [335, 4, 6], 41, 'surge'], [1, [324, 5, 22], [340, 3, 12], 40],
  ]),
  verdict: CK('verdict', [
    [0, [13, 3.0, 25], [0, 3.4, -1], 41], [0.55, [19, 6.0, 37], [0, 3.3, -1], 42.5, 'easeInOut'], [1, [26, 10, 48], [0, 3.2, -1], 44, 'easeInOut'],
  ]),
};
// ride cameras: position = missile pos + keyframed offset; look = missile pos + velocity lead.
const RIDE = {
  tomahawk: { off: [[0, [-4.5, 1.4, 5.5]], [0.3, [-6, 0.9, 6.5], 'easeInOut'], [1, [-7, 1.6, 7]]], lead: 0.8, fov: 41 },
  minuteman: { off: [[0, [-7, -2, 9]], [0.5, [-8.5, 1, 10.5], 'easeInOut'], [1, [-9.5, 3, 11]]], lead: 0.8, fov: 40 },
  trident: { off: [[0, [-5.5, 3.5, 8.5]], [0.3, [-7.5, 1.5, 9], 'easeInOut'], [1, [-8.5, 2, 9.5]]], lead: 0.8, fov: 41 },
  df21: { off: [[0, [-6, 1.5, 7]], [0.6, [-7.5, 2.5, 8], 'easeInOut'], [1, [-6, 4, 7]]], lead: 0.8, fov: 41 },
  df17: { off: [[0, [-2, 1, 10.5]], [1, [-3, 1.2, 11]]], lead: 0.8, fov: 43 },
  df41: { off: [[0, [-8, -3.5, 10]], [0.5, [-9.5, -1, 11.5], 'easeInOut'], [1, [-10.5, 1, 12]]], lead: 0.8, fov: 40 },
};
for (const id of Object.keys(RIDE)) RIDE[id].offK = T3(K(id, RIDE[id].off.map(([u, v, e]) => [u, v, e])));
const RIDE_SHOT = { tomahawk: 'tomahawk', minuteman: 'minuteman', trident: 'trident', df21: 'df21', df17: 'df17', df41: 'df41' };
const SHADOW_AT = { hook: [0, 1, 0], us: [40, 1, 2], tomahawk: [55, 1, -6], minuteman: [52, 1, 10], trident: [140, 1, 4], china: [208, 1, 2], df21: [240, 1, -16], df17: [245, 1, 12], df41: [220, 1, 3], speed: [124, 30, -20], patriot: [330, 1, 0], verdict: [0, 1, 0] };
const baseCam = (id, f) => {
  const mid = RIDE_SHOT[id];
  if (mid) {
    const st = missileAt(mid, f) || mkState(pathOf(mid), f, 0);
    const R = RIDE[mid], off = R.offK(f);
    return { pos: [st.p[0] + off[0], Math.max(0.7, st.p[1] + off[1]), st.p[2] + off[2]], look: [st.p[0] + st.d[0] * R.lead, st.p[1] + st.d[1] * R.lead, st.p[2] + st.d[2] * R.lead], fov: R.fov, roll: 0 };
  }
  return camFromKeys(CAMS[id], f, {});
};
// FOV speed feel: widening on launches + proportional to tracked-missile speed on ride shots.
const fovFeel = (f) => {
  let b = 0;
  for (const id of ['tomahawk', 'minuteman', 'trident', 'df21', 'df17', 'df41']) {
    const a = SEG[id].a; if (f >= a && f <= a + 16) b += 3 * Math.sin(Math.PI * ramp(f, a, a + 16));
  }
  return b;
};
const SHAKES = [];
for (const id of ['tomahawk', 'minuteman', 'trident', 'df21', 'df17', 'df41']) SHAKES.push({ f: SEG[id].a + 1, a: 0.0045 });
SHAKES.push({ f: Math.round(SEG.trident.a + 0.07 * SEG.trident.len), a: 0.0035 });
SHAKES.push({ f: Math.round(SEG.patriot.a + 0.40 * SEG.patriot.len), a: 0.003 });
SHAKES.push({ f: Math.round(SEG.patriot.a + 0.64 * SEG.patriot.len), a: 0.003 });
SHAKES.push({ f: SEG.df21.b - 3, a: 0.0025 });
const SHAKE_SHAPE = [1, -0.62, 0.3, -0.12];
const DIPS = TIMING.slice(1).map(([, a]) => a);
const shotCam = (id, f) => {
  let c = baseCam(id, f);
  const D = dirFor(id, f);
  c = { ...c, look: lerp3(c.look, D.point, D.w) };
  if (D.seg.posW && f >= D.seg.a && f <= D.seg.b) {
    const fade = smooth(ramp(f, D.seg.a, D.seg.a + 5)) * (1 - smooth(ramp(f, D.seg.b - 5, D.seg.b)));
    const p0 = D.seg.pos(D.seg.a), p1 = D.seg.pos(f);
    if (fade > 0) c.pos = c.pos.map((v, i) => v + (p1[i] - p0[i]) * D.seg.posW * fade);
  }
  return c;
};
export const camAt = (f) => {
  const S = shotAt(f);
  let c = shotCam(S.id, f);
  c.fov += fovFeel(f);
  const mid = RIDE_SHOT[S.id];
  if (mid) { const st = missileAt(mid, f); if (st) c.fov += clamp(st.speed * 0.9, 0, 6); } // FOV breathes with missile speed
  for (const s of SHAKES) {
    const d = f - s.f;
    if (d >= 0 && d < 4) { const m = s.a * SHAKE_SHAPE[d]; c.pos = [c.pos[0] + m * 0.5, c.pos[1] + m, c.pos[2]]; c.look = [c.look[0] + m * 0.8, c.look[1] + m * 1.4, c.look[2]]; }
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
const CINF = { hook: 9, us: 8, tomahawk: 4, minuteman: 5, trident: 5, china: 8, df21: 5, df17: 4, df41: 5, speed: 3, patriot: 6, verdict: 9 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  return { focus: dist(C.pos, dirAt(f).point), cinf: CINF[S.id] ?? 5 };
};

// ---------- world state (drives the 3D hardware in main.js) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const missiles = {};
  for (const fl of FLIGHTS) { const st = missileAt(fl.id, f); if (st) missiles[fl.id] = st; }
  const tri = ph('trident', f);
  return {
    shot: S.id, missiles, smoke: smokeAt(f), drone: droneAt(f), laser: laserAt(f),
    stars: (S.id === 'minuteman' && ph('minuteman', f) > 0.22) ? 1 : 0,
    mach: (S.id === 'speed' && ph('speed', f) > 0.44) ? 1 : 0,
    foam: (S.id === 'trident' && tri > 0.04 && tri < 0.4) ? { p: [133, 0.05, 8], t: ramp(f, SEG.trident.a + 0.04 * SEG.trident.len, SEG.trident.a + 0.4 * SEG.trident.len) } : null,
    sway: f,
  };
};

// ---------- actors (2D cards): the two launch officers + ground crew ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { day: '#ffffff', golden: '#ffe2c8', dusk: '#ffd9ae' };
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  const u = ph(S.id, f);
  switch (S.id) {
    case 'hook': {
      // both officers at their consoles, presenting their rows; crew stand by the pads.
      out.push(R(T, 'officer44', { seed: 21, expr: 'smile', L: 'hang', R: (u > 0.2 && u < 0.65) ? 'up' : 'hang', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), tilt: 0, headTilt: q(kf(K('hook', [[0, 0], [0.4, -4], [1, -4]]), f), 1) }, [-3.2, 0, 6.9], { tint }));
      out.push(R(T, 'officer44', { seed: 23, expr: 'smile', L: (u > 0.45 && u < 0.9) ? 'up' : 'hang', R: 'hang', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3), tilt: 0, headTilt: q(kf(K('hook', [[0, 0], [0.55, 4], [1, 4]]), f), 1) }, [3.2, 0, 6.9], { tint }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), tilt: 0, headTilt: 2 }, [-11.8, 0, 2.6], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 13), bob: q(breath(f, 13), 3), tilt: 0, headTilt: -2 }, [11.8, 0, 2.6], { tint }));
      break;
    }
    case 'us': {
      out.push(R(T, 'officer44', { seed: 21, expr: 'smile', L: 'belly', R: u > 0.3 ? 'point' : 'hang', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), tilt: 0, headTilt: q(kf(K('us', [[0, 0], [0.35, -5], [1, -5]]), f), 1) }, [34, 0, 7.2], { tint }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), tilt: 0, headTilt: 3 }, [33, 0, -5.5], { tint }));
      break;
    }
    case 'china': {
      out.push(R(T, 'officer44', { seed: 23, expr: 'smile', L: u > 0.3 ? 'point' : 'hang', R: 'belly', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3), tilt: 0, headTilt: q(kf(K('china', [[0, 0], [0.35, 5], [1, 5]]), f), 1) }, [198.5, 0, 7.2], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 13), bob: q(breath(f, 13), 3), tilt: 0, headTilt: -3 }, [202, 0, -8], { tint }));
      break;
    }
    case 'patriot': {
      const cheer = u > 0.42;
      out.push(R(T, 'officer44', { seed: 21, expr: cheer ? 'laugh' : 'stubborn', L: 'hang', R: u < 0.2 ? 'point' : cheer ? 'up' : 'hang', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), tilt: 0, headTilt: q(kf(K('patriot', [[0, 0], [0.25, -6], [0.7, -6], [1, 0]]), f), 1) }, [325, 0, 7.7], { tint }));
      break;
    }
    case 'verdict': {
      // both officers out front, arms up — a friendly airshow finish.
      out.push(R(T, 'officer44', { seed: 21, expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), tilt: 0, headTilt: 0 }, [-4.6, 0, 3.6], { tint }));
      out.push(R(T, 'officer44', { seed: 23, expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3), tilt: 0, headTilt: 0 }, [4.6, 0, 3.6], { tint }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'grin', L: 'up', R: 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), tilt: 0, headTilt: 2 }, [-11.8, 0, 1.5], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'grin', L: 'hang', R: 'up', blink: blinkAt(f, 13), bob: q(breath(f, 13), 3), tilt: 0, headTilt: -2 }, [11.8, 0, 1.5], { tint }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
const PAD = { tomahawk: [36, 0.35, -4], minuteman: [47, 0.35, 13], trident: [133, 0.3, 8], df21: [204, 0.35, -6], df17: [204, 0.35, 14], df41: [214, 0.35, 4] };
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const glow = (tp, s, a) => out.push(FX('glow' + q(a, 2) + '_' + q(tp[0], 1), (p) => fxGlow(p, a), [tp[0], tp[1] - 0.81 * s, tp[2] + 0.12], s));
  // tracked-missile glow on every flight beat (the director's object gets the eye)
  const mid = RIDE_SHOT[S.id];
  if (mid) { const st = missileAt(mid, f); if (st && st.flame > 0.1) glow(st.p, (mid === 'df41' || mid === 'minuteman') ? 2.0 : 1.5, 0.15 + 0.05 * Math.sin(f * 0.4)); }
  if (S.id === 'speed') { for (const id of ['streakUS', 'streakCN']) { const st = missileAt(id, f); if (st) glow(st.p, 1.6, 0.16); } }
  // launch dust at the pad (first fifth of each flight shot)
  if (mid && ph(S.id, f) < 0.2) {
    const t = q(ph(S.id, f) / 0.2, 2);
    out.push(FX('ldust' + t, (p) => T.fxDust(p, t, '#d8c49a'), [PAD[mid][0], 0.35, PAD[mid][2]], 1.5));
    if (mid === 'trident') out.push(FX('splash' + t, (p) => T.fxDust(p, t, '#eaf6ff'), [133, 0.4, 8], 1.3)); // sea burst
  }
  // DF-21's distant splash beyond the carrier
  if (S.id === 'df21' && ph(S.id, f) > 0.93) {
    const t = q((ph(S.id, f) - 0.93) / 0.07, 2);
    out.push(FX('dsplash' + t, (p) => T.fxDust(p, t, '#eaf6ff'), [291, 0.4, -30], 1.4));
  }
  // Patriot shield hits burst as fireworks
  const P = SEG.patriot;
  for (const [B, fu] of [[B1, 0.40], [B2, 0.64]]) {
    const f0 = P.a + fu * P.len;
    if (f >= f0 && f < f0 + 16) {
      const t = q((f - f0) / 16, 2);
      out.push(FX('fw' + fu + t, (p) => T.fxStars(p, t), B, 2.4));
      glow(B, 2.6, 0.2 * (1 - t));
    }
  }
  // hero-missile glints in the verdict's last stretch
  if (S.id === 'verdict' && f > SEG.verdict.b - 40) {
    const t = q(((f - (SEG.verdict.b - 40)) % 20) / 20, 2);
    out.push(FX('vglint' + t, (p) => T.fxStars(p, t), [-9, 7.6, 0], 0.5));
    out.push(FX('vglint2' + t, (p) => T.fxStars(p, t), [9, 8.6, 5.2], 0.5));
  }
  return out;
};
// soft radial warm glow (design-space centre 300,640 -> 0.81 m above the card origin at s=1)
const fxGlow = (p, a) => {
  const g = p.g;
  const gr = g.createRadialGradient(300, 640, 12, 300, 640, 300);
  gr.addColorStop(0, `rgba(255,208,112,${a.toFixed(3)})`);
  gr.addColorStop(0.55, `rgba(255,182,84,${(a * 0.45).toFixed(3)})`);
  gr.addColorStop(1, 'rgba(255,182,84,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 600, 1000);
};
