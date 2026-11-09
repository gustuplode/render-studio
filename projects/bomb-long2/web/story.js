// "The Man Who Survived Two Atomic Bombs" — the story of Tsutomu Yamaguchi, told with respect.
// A PERSON's story in the house character engine (coded 9:16, 30 fps). The blasts are OFF-SCREEN
// flashes (white flash + light through windows + dust) — never shown striking anyone. Cities are
// quiet stylised street sets; the hero stays a dignified round-head character throughout.
//
// STRUCTURE RULE: every timing flows from the TIMING table below. Shots, keyframe tracks, the
// TRACKDIR director and world state all read phrase boundaries via TF(id, t). Parent patches
// TIMING when the real voice lands and the whole edit retimes itself. Placeholder timings (30 fps).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30;
export const TIMING = [
  ['hook', 0, 395],
  ['engineer', 395, 881],
  ['aug6', 881, 1682],
  ['journey', 1682, 2308],
  ['aug9', 2308, 3424],
  ['recovery', 3424, 4774],
  ['speakingout', 4774, 5469],
  ['recognition', 5469, 6520],
  ['legacy', 6520, 7219],
];
export const TOTAL = TIMING[TIMING.length - 1][2]; // 8850 frames ≈ 4:55
const T0 = Object.fromEntries(TIMING.map(([id, a, b]) => [id, [a, b]]));
export const TF = (id, t) => Math.round(T0[id][0] + (T0[id][1] - T0[id][0]) * t);
const IN = (id, f, t0 = 0, t1 = 1) => f >= TF(id, t0) && f <= TF(id, t1);
const LIGHT_OF = { hook: 'morning', engineer: 'day', aug6: 'morning', journey: 'day', aug9: 'morning', recovery: 'indoor', speakingout: 'hall', recognition: 'golden', legacy: 'dawn' };
export const SHOTS = TIMING.map(([id, a, b]) => ({ id, a, b: b - 1, light: LIGHT_OF[id] }));
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  morning: { az: 118, el: 27, sky: '#d9c9a8', ground: '#8a8262', hemi: 1.08, sun: '#ffe3b0', sunI: 2.3, fog: '#e6d5ac', fogNear: 42, fogFar: 280,
    skyTop: '#7fa8d8', skyHor: '#f2ddae', sunDisc: '#fff0c8', sunSize: 0.003, sat: 1.08, vig: 0.22, shadowExt: 24, ...WATER },
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 280,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 24, ...WATER },
  smoke: { az: 100, el: 30, sky: '#9a8d7c', ground: '#5c554a', hemi: 0.9, sun: '#d8c2a0', sunI: 1.5, fog: '#8d8272', fogNear: 12, fogFar: 130,
    skyTop: '#6d6a63', skyHor: '#b09a7c', sat: 0.92, vig: 0.3, shadowExt: 20, waterDeep: '#3c4c55', waterShal: '#5c6a70', glint: '#d8c9a8' },
  night: { az: 60, el: 38, sky: '#33456b', ground: '#1c1a20', hemi: 0.95, sun: '#aebfff', sunI: 1.15, fog: '#232c40', fogNear: 10, fogFar: 80,
    skyTop: '#131c30', skyHor: '#2c3a55', sat: 1.03, vig: 0.3, shadowExt: 12, waterDeep: '#1c2c3c', waterShal: '#2c445c', glint: '#cfe0ff' },
  dawn: { az: 75, el: 10, sky: '#c9b8c8', ground: '#6a5a52', hemi: 1.0, sun: '#ffb98a', sunI: 2.4, fog: '#e8c4a8', fogNear: 38, fogFar: 280,
    skyTop: '#5f7ab0', skyHor: '#ffc9a0', sunDisc: '#ffe9c0', sunSize: 0.004, sat: 1.1, vig: 0.24, shadowExt: 26, ...WATER },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 40, fogFar: 240,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', vig: 0.26, shadowExt: 22, ...WATER },
  indoor: { az: 130, el: 40, sky: '#c4b498', ground: '#6b5a48', hemi: 1.12, sun: '#ffdfae', sunI: 2.0, fog: '#cbb79a', fogNear: 10, fogFar: 120,
    skyTop: '#8fa3b8', skyHor: '#e8d9b8', sat: 1.05, vig: 0.26, shadowExt: 16, ...WATER },
  hall: { az: 90, el: 55, sky: '#aebdd0', ground: '#4c4c55', hemi: 1.05, sun: '#ffffff', sunI: 2.2, fog: '#9aa7ba', fogNear: 15, fogFar: 170,
    skyTop: '#5d708c', skyHor: '#c3cfdd', sat: 1.04, vig: 0.28, shadowExt: 20, ...WATER },
};
export const lightFor = (S, f) => {
  let n = S.light;
  if (S.id === 'aug6') n = f < TF('aug6', 0.42) ? 'morning' : f < TF('aug6', 0.82) ? 'smoke' : 'night';
  if (S.id === 'journey' && f >= TF('journey', 0.8)) n = 'golden';
  if (S.id === 'aug9' && f >= TF('aug9', 0.40)) n = 'smoke';
  return { ...LIGHTS[n] };
};

// ---------- shared stage geometry (== main.js world build) ----------
export const TITLE_BOARD = [0, 3.55, -4.5];        // hook: "SURVIVED TWO ATOMIC BOMBS"
export const CITY_H = [-4.7, 2.3, -3.4], CITY_N = [4.7, 2.3, -3.4]; // hook city name boards
export const DESK_ENG = [-60.3, 0.95, -0.8];      // engineer: drafting paper point (tracked object)
export const CASE_ENG = [-59.1, 0.35, 0.7];       // engineer: the packed suitcase
export const SHELTER = [-111.5, 1.1, -1.5];       // aug6: night shelter silhouette point
export const TRAIN_DOOR = [-178.6, 1.35, 3.0];    // journey: hero's spot at the train door
export const HOME_DOOR = [-170.6, 1.25, -18.6];   // journey: home door midpoint (hero + wife)
export const WINDOW9 = [-259.7, 2.0, -4.6];       // aug9: the office window the flash comes through
export const DESK9 = [-260.4, 0.9, -0.9];         // aug9: the desk the hero ducks under
export const CAL_POS = [-320.9, 2.3, -3.9];       // recovery: calendar on the wall
export const TABLE_REC = [-319.6, 0.9, -0.6];     // recovery: family table midpoint
export const MAP_BOARD = [-376.2, 2.7, -4.9];
export const MAP_DOT = [-374.42, 3.34, -5.36]; // the red Japan marker on the map board     // speakingout: world map board
export const EMBLEM = [-380, 3.45, -5.5];          // speakingout: peace backdrop emblem
export const CERT_BOARD = [-440, 3.1, -4.5];      // recognition: certificate board
export const CRANE_PROP = [-496.8, 0.86, 4.2];   // legacy: origami crane on the table
export const BAY_POINT = [-500, 1.6, -30];        // legacy: out over Nagasaki bay

const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
const laugh = (f, a, b, amp) => (f >= a && f < b) ? Math.abs(Math.sin((f - a) * 0.55)) * amp * Math.min(1, (f - a) / 6) * Math.min(1, (b - f) / 6) : 0;

// ---------- subject tracks (actors + camera + world read the SAME tracks) ----------
// aug6: the hero walks to work along the street, then the flash throws him down (comic-tumble
// envelope, no injury detail), he sits up in the dust, and at the end he stands and walks on.
export const heroWalk6X = (f) => kf([[TF('aug6', 0.03), -128.5], [TF('aug6', 0.40), -119.0, 'easeInOut'], [TF('aug6', 0.86), -119.0], [TF('aug6', 1), -114.5, 'easeInOut']], f);
export const fallE = (f) => kf([[TF('aug6', 0.415), 0], [TF('aug6', 0.445), 1, 'easeIn'], [TF('aug6', 0.60), 1], [TF('aug6', 0.70), 0.45, 'easeOut'], [TF('aug6', 0.86), 0.45], [TF('aug6', 0.95), 0, 'easeOut'], [TF('aug6', 1), 0]], f);
export const FLASH6 = () => TF('aug6', 0.42);
export const FLASH9 = () => TF('aug9', 0.40);
// journey: platform -> train door (the ride) -> the walk home -> the door
export const heroJourneyPos = (f) => {
  if (f < TF('journey', 0.16)) return [-176.8, 0, 6.0];
  if (f < TF('journey', 0.60)) return [TRAIN_DOOR[0], 0, TRAIN_DOOR[2]];
  if (f < TF('journey', 0.85)) return kf3([[TF('journey', 0.60), [-176.8, 0, 0.5]], [TF('journey', 0.85), [-171.2, 0, -17.8], 'easeInOut', [[-174.5, 0, -8], [-172.5, 0, -14]]]], f);
  return [-171.2, 0, -17.8];
};
// aug9: the duck under the desk (0 = standing tall, 1 = ducked behind the desk)
export const duckE = (f) => kf([[FLASH9() + 2, 0], [FLASH9() + 12, 1, 'easeIn'], [TF('aug9', 0.72), 1], [TF('aug9', 0.82), 0, 'easeOut'], [TF('aug9', 1), 0]], f);
// recovery: calendar flips — the years the audience watches fly past
export const CAL_YEARS = [1945, 1950, 1957, 1964, 1972, 1981, 1993, 2009];
const CAL_FLIPS = [0.08, 0.17, 0.26, 0.42, 0.58, 0.72, 0.86];
export const calState = (f) => {
  let started = 0, phase = 0;
  for (const t of CAL_FLIPS) {
    const f0 = TF('recovery', t);
    if (f >= f0) { started++; if (f < f0 + 14) phase = (f - f0) / 14; }
  }
  const done = CAL_FLIPS.filter((t) => f >= TF('recovery', t) + 14).length;
  return { show: Math.min(CAL_YEARS.length - 1, done + (phase > 0.5 ? 1 : 0)), page: Math.min(CAL_YEARS.length - 1, Math.max(0, started - 1)), flip: phase };
};

// ---------- TRACKING DIRECTOR ----------
const TRACKDIR = {
  hook: [
    { a: TF('hook', 0), b: TF('hook', 0.38), type: 'subject', id: 'hero', pos: () => [0, 1.35, 1.5], w: 0.55 },
    { a: TF('hook', 0.38), b: TF('hook', 0.66), type: 'object', id: 'title', pos: () => TITLE_BOARD, w: 0.6, blend: 26 },
    { a: TF('hook', 0.66), b: TF('hook', 1), type: 'subject', id: 'hero', pos: () => [0, 1.35, 1.5], w: 0.6, blend: 26 },
  ],
  engineer: [
    { a: TF('engineer', 0), b: TF('engineer', 0.30), type: 'character', id: 'hero', pos: () => [-60.7, 1.2, -0.4], w: 0.5 },
    { a: TF('engineer', 0.30), b: TF('engineer', 0.55), type: 'object', id: 'drafting', pos: () => DESK_ENG, w: 0.6 },
    { a: TF('engineer', 0.55), b: TF('engineer', 0.78), type: 'character', id: 'colleague', pos: () => [-57.2, 1.2, -1.6], w: 0.5 },
    { a: TF('engineer', 0.78), b: TF('engineer', 1), type: 'object', id: 'suitcase', pos: () => [-59.9, 0.5, 0.2], w: 0.5 },
  ],
  aug6: [
    { a: TF('aug6', 0), b: TF('aug6', 0.42), type: 'subject', id: 'hero', pos: (f) => [heroWalk6X(f), 1.25, 2.6], w: 0.6 },
    { a: TF('aug6', 0.42), b: TF('aug6', 0.62), type: 'subject', id: 'heroDown', pos: () => [-119.0, 0.55, 2.6], w: 0.62 },
    { a: TF('aug6', 0.62), b: TF('aug6', 0.85), type: 'character', id: 'hero', pos: () => [-119.0, 1.0, 2.6], w: 0.55 },
    { a: TF('aug6', 0.85), b: TF('aug6', 1), type: 'object', id: 'shelter', pos: () => SHELTER, w: 0.5 },
  ],
  journey: [
    { a: TF('journey', 0), b: TF('journey', 0.18), type: 'character', id: 'hero', pos: () => [-176.8, 1.25, 6.0], w: 0.5 },
    { a: TF('journey', 0.18), b: TF('journey', 0.60), type: 'subject', id: 'trainDoor', pos: () => TRAIN_DOOR, w: 0.62 },
    { a: TF('journey', 0.60), b: TF('journey', 0.85), type: 'subject', id: 'hero', pos: (f) => { const p = heroJourneyPos(f); return [p[0], 1.25, p[2]]; }, w: 0.6 },
    { a: TF('journey', 0.85), b: TF('journey', 1), type: 'character', id: 'doorway', pos: () => HOME_DOOR, w: 0.5 },
  ],
  aug9: [
    { a: TF('aug9', 0), b: TF('aug9', 0.25), type: 'character', id: 'hero', pos: () => [-261.8, 1.25, 0.8], w: 0.5 },
    { a: TF('aug9', 0.25), b: TF('aug9', 0.40), type: 'character', id: 'boss', pos: () => [-257.9, 1.25, 0.1], w: 0.5 },
    { a: TF('aug9', 0.40), b: TF('aug9', 0.60), type: 'object', id: 'window', pos: () => WINDOW9, w: 0.6 },
    { a: TF('aug9', 0.60), b: TF('aug9', 0.85), type: 'subject', id: 'heroDesk', pos: () => DESK9, w: 0.6 },
    { a: TF('aug9', 0.85), b: TF('aug9', 1), type: 'character', id: 'hero', pos: () => [-260.6, 1.2, -0.9], w: 0.55 },
  ],
  recovery: [
    { a: TF('recovery', 0), b: TF('recovery', 0.30), type: 'object', id: 'calendar', pos: () => CAL_POS, w: 0.6 },
    { a: TF('recovery', 0.30), b: TF('recovery', 0.55), type: 'character', id: 'hero', pos: () => [-316.9, 1.2, -1.1], w: 0.5 },
    { a: TF('recovery', 0.55), b: TF('recovery', 0.80), type: 'subject', id: 'family', pos: () => TABLE_REC, w: 0.5 },
    { a: TF('recovery', 0.80), b: TF('recovery', 1), type: 'character', id: 'heroOld', pos: () => [-316.9, 1.2, -1.1], w: 0.55 },
  ],
  speakingout: [
    { a: TF('speakingout', 0), b: TF('speakingout', 0.30), type: 'character', id: 'hero', pos: () => [-380, 1.55, -0.6], w: 0.5 },
    { a: TF('speakingout', 0.30), b: TF('speakingout', 0.50), type: 'object', id: 'map', pos: () => MAP_DOT, w: 0.62 },
    { a: TF('speakingout', 0.50), b: TF('speakingout', 0.75), type: 'subject', id: 'hero', pos: () => [-380, 1.55, -0.6], w: 0.55 },
    { a: TF('speakingout', 0.75), b: TF('speakingout', 1), type: 'object', id: 'emblem', pos: () => EMBLEM, w: 0.5 },
  ],
  recognition: [
    { a: TF('recognition', 0), b: TF('recognition', 0.45), type: 'object', id: 'certificate', pos: () => CERT_BOARD, w: 0.55 },
    { a: TF('recognition', 0.45), b: TF('recognition', 1), type: 'subject', id: 'hero', pos: () => [-440, 1.35, 0], w: 0.55 },
  ],
  legacy: [
    { a: TF('legacy', 0), b: TF('legacy', 0.35), type: 'subject', id: 'hero', pos: () => [-500, 1.35, 0.5], w: 0.55 },
    { a: TF('legacy', 0.35), b: TF('legacy', 0.70), type: 'object', id: 'crane', pos: () => CRANE_PROP, w: 0.62 },
    { a: TF('legacy', 0.70), b: TF('legacy', 1), type: 'subject', id: 'bay', pos: () => BAY_POINT, w: 0.4 },
  ],
};
const BLEND = 10;
export const dirFor = (id, f) => {
  const segs = TRACKDIR[id];
  let i = segs.findIndex((s) => f <= s.b); if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  let point = seg.pos(f), w = seg.w;
  const pv = segs[i - 1], nx = segs[i + 1];
  if (nx && f >= nx.a - (nx.blend || BLEND) / 2) {
    const B = nx.blend || BLEND, t = smooth(ramp(f, nx.a - B / 2, nx.a + B / 2));
    point = lerp3(point, nx.pos(f), t); w = lerp(w, nx.w, t);
  } else if (pv && f < seg.a + (seg.blend || BLEND) / 2) {
    const B = seg.blend || BLEND, t = smooth(ramp(f, seg.a - B / 2, seg.a + B / 2));
    point = lerp3(pv.pos(f), point, t); w = lerp(pv.w, w, t);
  }
  return { point, w, seg };
};
export const dirAt = (f) => dirFor(shotAt(f).id, f);

// ---------- cameras (keys by phrase fraction; director-tracking look blending) ----------
const CK = (id, rows) => rows.map(([t, pos, look, fov, ease]) => ({ f: TF(id, t), pos, look, fov, ease }));
const BASECAM = {
  hook: CK('hook', [
    [0, [0, 2.5, 11.5], [0, 1.75, -2], 46],
    [0.4, [0, 2.3, 9.8], [0, 1.8, -2.2], 44],
    [0.7, [0, 2.15, 8.6], [0, 1.7, -1.6], 43],
    [1, [0, 2.0, 7.6], [0, 1.65, -1.2], 42],
  ]),
  engineer: CK('engineer', [
    [0, [-54.8, 2.3, 8.2], [-59.8, 1.25, -1.2], 46],
    [0.3, [-55.8, 2.1, 6.8], [-60.1, 1.1, -0.9], 43],
    [0.6, [-56.6, 2.15, 7.2], [-58.2, 1.2, -1.5], 44],
    [1, [-57.4, 2.05, 6.6], [-59.3, 1.05, -0.5], 43],
  ]),
  aug6: CK('aug6', [
    [0, [-131, 2.1, 10.5], [-124, 1.2, 0], 46],
    [0.42, [-124.8, 1.8, 8.2], [-119.3, 1.0, 1.8], 42],
    [0.7, [-121.5, 1.6, 7.2], [-118.2, 0.85, 2.2], 40],
    [1, [-118.5, 1.7, 8.8], [-113.5, 1.0, -0.8], 42],
  ]),
  journey: CK('journey', [
    [0, [-170.8, 2.1, 14.5], [-177.5, 1.4, 5], 45],
    [0.3, [-170.4, 1.95, 10.5], [-178.2, 1.3, 3.2], 42],
    [0.6, [-169.2, 2.2, 0.5], [-177.5, 1.25, 0.8], 44],
    [0.8, [-167.4, 1.9, -11.5], [-171, 1.2, -18], 42],
    [1, [-167.6, 1.85, -14.8], [-170.4, 1.25, -18.8], 42],
  ]),
  aug9: CK('aug9', [
    [0, [-263.8, 2.0, 6.8], [-260, 1.25, -0.5], 43],
    [0.3, [-262.8, 1.9, 5.8], [-258.6, 1.25, -0.2], 41],
    [0.55, [-261.4, 1.7, 5.2], [-259.9, 1.0, -1], 40],
    [1, [-262.2, 1.85, 6.2], [-260.4, 1.2, -0.6], 42],
  ]),
  recovery: CK('recovery', [
    [0, [-324.2, 2.0, 4.8], [-321, 1.5, -2.2], 44],
    [0.35, [-321.5, 1.8, 4.0], [-319.8, 1.25, -1], 41],
    [0.7, [-318.2, 1.85, 4.4], [-318.6, 1.2, -0.9], 41],
    [1, [-319.2, 1.9, 5.2], [-319.2, 1.3, -1.1], 42],
  ]),
  speakingout: CK('speakingout', [
    [0, [-376.2, 2.2, 5.0], [-380, 1.6, -1.8], 43],
    [0.35, [-377.2, 2.05, 3.8], [-380, 1.55, -1.4], 40],
    [0.45, [-374.8, 2.2, 5.8], [-376.8, 1.9, -3.4], 45],
    [0.7, [-378.5, 2.1, 4.6], [-379.8, 1.55, -1.2], 41],
    [1, [-379, 2.3, 6.5], [-380, 1.8, -2.6], 43],
  ]),
  recognition: CK('recognition', [
    [0, [-435.6, 2.3, 9.5], [-440, 1.7, -2], 44],
    [0.5, [-437.2, 2.05, 7.2], [-440, 1.5, -1], 41],
    [1, [-438.4, 1.95, 6.2], [-440, 1.4, -0.4], 40],
  ]),
  legacy: CK('legacy', [
    [0, [-495.2, 2.0, 10.5], [-499.5, 1.4, -2], 44],
    [0.4, [-496.6, 1.7, 7.2], [-498, 1.1, 0.5], 41],
    [0.7, [-497.4, 2.6, 11], [-499, 1.6, -8], 43],
    [1, [-498, 4.4, 16.5], [-499.5, 1.8, -25], 46],
  ]),
};
const SHADOW_AT = { hook: [0, 1, -1], engineer: [-60, 1, -1], aug6: [-120, 1, 0], journey: [-176, 1, -4], aug9: [-260, 1, -0.5], recovery: [-320, 1, -1], speakingout: [-380, 1, -1], recognition: [-440, 1, -0.5], legacy: [-499, 1, -4] };
const SHAKES = [
  { a: FLASH6(), amp: 0.05 }, { a: FLASH9(), amp: 0.045 },
];
const SHAKE_SHAPE = [1, -0.62, 0.3, -0.12];
const BRIDGE = 12; // frames of camera glide across a shot boundary — no jump cuts
const fovFeel = (f) => { let v = 0; if (f < 40) v += 1.5 * (1 - f / 40); if (IN('legacy', f, 0.8)) v += 2 * ramp(f, TF('legacy', 0.8), TF('legacy', 1)); return v; };

export const camAt = (f) => {
  const S = shotAt(f), t = f - S.a, len = S.b - S.a + 1;
  const keys = BASECAM[S.id].map((k) => ({ ...k, f: k.f - S.a }));
  let c = camFromKeys(keys, t, len);
  const D = dirFor(S.id, f);
  c.look = lerp3(c.look, D.point, D.w);
  c.fov += fovFeel(f);
  let flash = f < 9 ? -0.95 * (1 - f / 9) : 0; // gentle fade-in from black on frame 0
  if (S.a > 0 && t < 6) flash = Math.min(flash, -0.92 * (1 - t / 6)); // dip in on a location cut
  const rem = len - 1 - t, si2 = SHOTS.indexOf(S);
  if (si2 < SHOTS.length - 1 && rem < 6) flash = Math.min(flash, -0.92 * (1 - rem / 6)); // dip out
  const d6 = f - FLASH6();
  if (d6 >= 0 && d6 < 40) flash = Math.max(flash, d6 < 3 ? 1 : Math.exp(-(d6 - 3) / 7)); // Aug 6: the flash is a wall of light
  const d9 = f - FLASH9();
  if (d9 >= 0 && d9 < 30) flash = Math.max(flash, d9 < 2 ? 0.92 : 0.92 * Math.exp(-(d9 - 2) / 5)); // Aug 9: light bursts through the window
  c.flash = flash;
  for (const sh of SHAKES) { const k = f - sh.a; if (k >= 0 && k < 4) { c.pos = [c.pos[0] + SHAKE_SHAPE[k] * sh.amp, c.pos[1] + SHAKE_SHAPE[k] * sh.amp * 0.6, c.pos[2]]; } }
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};
const CINF = { hook: 4, engineer: 9, aug6: 6, journey: 5, aug9: 7, recovery: 9, speakingout: 6, recognition: 5, legacy: 3 };
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => ({ focus: dist3(camAt(f).pos, dirAt(f).point), cinf: CINF[shotAt(f).id] });

// ---------- world state (dynamic set pieces) ----------
export const worldAt = (f) => {
  const S = shotAt(f), cal = calState(f);
  return {
    shot: S.id,
    tramX: kf([[TF('aug6', 0.02), -138], [TF('aug6', 0.40), -102, 'easeInOut']], f), // the morning tram rolls through and is gone before the flash
    fireA: ramp(f, TF('aug6', 0.46), TF('aug6', 0.62)) * (1 - ramp(f, TF('aug6', 0.97), TF('aug6', 1))), // distant fires: glow points only, far away
    scroll: kf([[TF('journey', 0.16), 0], [TF('journey', 0.60), 260, 'easeInOut']], f), // telegraph poles stream past on the ride home
    shardT: ramp(f, FLASH9(), FLASH9() + 16), // aug9 window panes burst inward as stylised light shards
    calShow: cal.show, calPage: cal.page, calF: cal.flip,
    packed: f >= TF('engineer', 0.72), // the suitcase appears, packed for the trip home
    fallE: fallE(f), duckE: duckE(f),
  };
};

// ---------- cast (1945 costumes in the same round-head style) ----------
export const HERO_Y = { seed: 11, skin: '#f5c9a0', hair: '#241a14', brows: '#241a14', tunic: '#5f707a', trim: '#3e4c55', belt: '#4a3826', shirt: '#f4ecd8', collar: '#e8dfc8', collarLine: '#c9bda0', shoulder: '#48565f', knot: '#7a3b2e', shoe: '#3a2c20' };           // young engineer: work shirt + satchel-brown belt
export const HERO_M = { ...HERO_Y, hair: '#6a625a', brows: '#7a7268', skin: '#f4cfa8' };   // middle years: hair greying
export const HERO_O = { ...HERO_Y, hair: '#d9d6cf', brows: '#e8e6e0', skin: '#f3d6bb', tunic: '#46464e', trim: '#34343c', shoulder: '#3c3c44', shirt: '#efe9dc' }; // elderly: silver hair, dark jacket
export const BOSS = { seed: 23, skin: '#eeb98c', hair: '#17120e', brows: '#17120e', moustache: true, stout: true, tunic: '#4c4438', trim: '#37312a', belt: '#33261a', shirt: '#efe6d2', knot: '#5c2e22', shoe: '#2c2118' }; // the office boss
export const WIFE = { seed: 7, skin: '#f7cfa5', hair: '#1e1714', brows: '#1e1714', dress: '#8a5a6a', tunic: '#8a5a6a', trim: '#6e4453', belt: '#54343f', shirt: '#f2e4d5', knot: '#8a5a6a', shoe: '#33241e' }; // his wife, in a dress
export const COLLEAGUE = { seed: 31, skin: '#eebd90', hair: '#2e2015', brows: '#2e2015', tunic: '#6b6a58', trim: '#4e4d3f', belt: '#4a3826', shirt: '#e9dfc9', knot: '#44503f', shoe: '#3a2c20' };
export const SON = { seed: 41, skin: '#f5c9a0', hair: '#241a14', brows: '#241a14', tunic: '#5a6e52', trim: '#42533c', belt: '#4a3826', shirt: '#f0e8d2', knot: '#5a6e52', shoe: '#3a2c20' };
export const DAUGHTER = { seed: 53, skin: '#f7cfa5', hair: '#33231a', brows: '#33231a', dress: '#7a6a8a', tunic: '#7a6a8a', trim: '#5c4f6b', belt: '#463a52', shirt: '#f2e9da', knot: '#7a6a8a', shoe: '#33241e' };
export const TOWNSFOLK = { seed: 61, skin: '#eebd90', hair: '#2e2015', brows: '#2e2015', stout: true, tunic: '#71604a', trim: '#554734', belt: '#43331f', shirt: '#e9dfc9', knot: '#71604a', shoe: '#3a2c20' };
export const AUDIENCE = { seed: 71, skin: '#c9c2b8', hair: '#3a3a42', brows: '#3a3a42', tunic: '#3c3c46', trim: '#2e2e36', belt: '#26262e', shirt: '#8a8a92', knot: '#3c3c46', shoe: '#26262e' };

const TINT = { morning: '#fff2dd', day: '#ffffff', smoke: '#d8c9b8', night: '#aebfe8', golden: '#ffe2c8', indoor: '#ffe9cf', hall: '#eef2ff', dawn: '#ffe4d0' };
const tintAt = (f) => TINT[lightFor(shotAt(f), f) === LIGHTS.night ? 'night' : shotAt(f).id === 'aug6' ? (f < TF('aug6', 0.42) ? 'morning' : f < TF('aug6', 0.82) ? 'smoke' : 'night') : shotAt(f).id === 'journey' && f >= TF('journey', 0.8) ? 'golden' : shotAt(f).id === 'aug9' && f >= TF('aug9', 0.40) ? 'smoke' : shotAt(f).light];

function R(T, who, o, pos, extra = {}) {
  const a = { key: who + '|' + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, s: 1, tint: '#ffffff', roll: 0, flip: false, order: 2, blob: true, shadow: true, ...extra };
  return a;
}
const bowAt = (f, a, b, depth) => (f >= a && f < b) ? Math.sin(Math.PI * ramp(f, a, b)) * depth : 0;

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintAt(f), out = [];
  const A = (who, o, pos, extra) => { const a = R(T, who, o, pos, extra); a.tint = tint; out.push(a); return a; };
  const blink = blinkAt(f, 3), blink2 = blinkAt(f, 17);

  if (S.id === 'hook') {
    const ex = f < TF('hook', 0.66) ? 'smile' : 'grin';
    A(HERO_Y, { expr: ex, blink, tilt: 0.01, bob: breath(f, 1) }, [0, 0, 1.5], { s: 1.18 });
    A(TOWNSFOLK, { expr: 'neutral', blink: blink2 }, [-3.6, 0, -1.2], { s: 0.95 });
    A(COLLEAGUE, { expr: 'smile', blink }, [3.6, 0, -1.2], { s: 0.98 });
  }

  if (S.id === 'engineer') {
    const late = f >= TF('engineer', 0.72);
    A(HERO_Y, { expr: late ? 'smile' : 'neutral', blink, tilt: late ? 0.02 : 0.06, headTilt: late ? 0 : 0.05, bob: breath(f, 1) }, [-60.7, 0, -0.4], { s: 1.1 });
    A(COLLEAGUE, { expr: 'smile', blink: blink2, R: f > TF('engineer', 0.55) && f < TF('engineer', 0.72) ? 'point' : 'hang', bob: breath(f, 4) }, [-57.2, 0, -1.6], { s: 1.0 });
  }

  if (S.id === 'aug6') {
    const e = fallE(f), fl = FLASH6();
    const walking = (f < fl && f >= TF('aug6', 0.03)) || f >= TF('aug6', 0.95);
    const ex = f < fl ? 'neutral' : f < TF('aug6', 0.52) ? 'shock' : f < TF('aug6', 0.78) ? 'dazed' : f < TF('aug6', 0.9) ? 'pained' : 'relief';
    A(HERO_Y, { expr: ex, blink: e > 0.3 ? 0.4 : blink, tilt: 0.02, step: walking ? (f * 0.045) % 1 : 0, bob: breath(f, 1) + (walking ? Math.abs(Math.sin(f * 0.28)) * 0.02 : 0) },
      [heroWalk6X(f), -0.30 * e, 2.6], { s: 1.08, roll: -1.25 * e });
    if (f < fl) A(TOWNSFOLK, { expr: 'neutral', blink: blink2, step: (f * 0.04 + 0.5) % 1 }, [-124.5, 0, -0.8], { s: 0.96, flip: true });
  }

  if (S.id === 'journey') {
    const p = heroJourneyPos(f);
    const walking = f >= TF('journey', 0.60) && f < TF('journey', 0.85);
    const ex = f < TF('journey', 0.6) ? 'smile' : f < TF('journey', 0.85) ? 'neutral' : 'grin';
    A(HERO_Y, { expr: ex, blink, tilt: 0.015, step: walking ? (f * 0.045) % 1 : 0, headTilt: f >= TF('journey', 0.18) && f < TF('journey', 0.6) ? 0.04 * Math.sin(f * 0.06) : 0, bob: breath(f, 1) + (walking ? Math.abs(Math.sin(f * 0.28)) * 0.02 : 0) }, [p[0], p[1], p[2]], { s: 1.08 });
    if (f >= TF('journey', 0.82)) A(WIFE, { expr: 'grin', blink: blink2, R: 'wave', wv: q(f * 0.22, 2), bob: breath(f, 6) }, [-169.9, 0, -18.9], { s: 1.02 });
  }

  if (S.id === 'aug9') {
    const fl = FLASH9(), d = duckE(f);
    const telling = f >= TF('aug9', 0.08) && f < TF('aug9', 0.38);
    const hEx = f < fl ? 'smile' : f < TF('aug9', 0.52) ? 'shock' : d > 0.3 ? 'dazed' : f < TF('aug9', 0.9) ? 'relief' : 'smile_closed';
    const hPos = d > 0.02 ? lerp3([-261.8, 0, 0.8], [-260.6, -0.55, -0.9], d) : [-261.8, 0, 0.8];
    A(HERO_Y, { expr: hEx, blink, R: telling && f % 90 < 45 ? 'point' : 'hang', L: telling && f % 90 >= 45 ? 'up' : 'hang', tilt: 0.02, bob: breath(f, 1) }, hPos, { s: 1.08 });
    const bEx = f < TF('aug9', 0.28) ? 'stern' : f < fl ? 'laugh' : f < TF('aug9', 0.55) ? 'shock' : 'dazed';
    A(BOSS, { expr: bEx, blink: blink2, bob: breath(f, 2) + laugh(f, TF('aug9', 0.30), TF('aug9', 0.40), 0.05) + (d > 0.3 ? 0.01 : 0), tilt: d > 0.3 ? 0.12 : 0 }, [-257.9, d > 0.3 ? -0.35 : 0, 0.1], { s: 1.05 });
    A(COLLEAGUE, { expr: f < fl ? 'smile' : 'dazed', blink, tilt: d > 0.3 ? 0.15 : 0.02, bob: breath(f, 5) }, [-263.6, d > 0.3 ? -0.4 : 0, -1.6], { s: 1.0 });
  }

  if (S.id === 'recovery') {
    const who = f < TF('recovery', 0.55) ? HERO_M : HERO_O;
    const fam = f >= TF('recovery', 0.5) && f < TF('recovery', 0.82);
    A(who, { expr: fam ? 'smile' : f < TF('recovery', 0.3) ? 'neutral' : 'smile_closed', blink, tilt: 0.05, headTilt: 0.04, bob: breath(f, 1) }, fam ? [-320.5, 0, 0.75] : [-316.9, 0, -1.1], { s: 1.06 });
    if (fam) {
      A(WIFE, { expr: 'smile', blink: blink2, bob: breath(f, 6) }, [-320.7, 0, -1.3], { s: 1.0 });
      A(SON, { expr: 'grin', blink, bob: breath(f, 8) }, [-318.5, 0, -1.2], { s: 0.92 });
      A(DAUGHTER, { expr: 'smile', blink: blink2, R: 'wave', wv: q(f * 0.2, 2), bob: breath(f, 9) }, [-318.7, 0, 0.7], { s: 0.9 });
    }
  }

  if (S.id === 'speakingout') {
    const gesture = (f >= TF('speakingout', 0.1) && f < TF('speakingout', 0.28)) || (f >= TF('speakingout', 0.55) && f < TF('speakingout', 0.72));
    A(HERO_O, { expr: f < TF('speakingout', 0.78) ? 'stern' : 'smile', blink, R: gesture ? 'up' : 'hang', tilt: 0.015, bob: breath(f, 1) }, [-380, 0.3, -0.6], { s: 1.1 });
    for (let i = 0; i < 6; i++) {
      const ax = -384.6 + i * 1.85;
      A({ ...AUDIENCE, seed: 71 + i * 3 }, { expr: 'neutral', blink: blinkAt(f, 40 + i * 7) }, [ax, -1.28, 2.7], { s: 0.95, ground: -1.28, shadow: false });
    }
  }

  if (S.id === 'recognition') {
    A(HERO_O, { expr: 'grin', blink, tilt: 0.01, bob: breath(f, 1) }, [-440, 0, 0], { s: 1.12 });
    A(WIFE, { expr: 'smile', blink: blink2, R: f >= TF('recognition', 0.6) ? 'wave' : 'hang', wv: q(f * 0.22, 2), bob: breath(f, 6) }, [-441.9, 0, 0.5], { s: 1.02 });
    A(SON, { expr: 'smile', blink, bob: breath(f, 8) }, [-438.1, 0, 0.5], { s: 1.0 });
  }

  if (S.id === 'legacy') {
    A(HERO_O, { expr: 'smile_closed', blink, tilt: 0.01, bob: breath(f, 1) }, [-500, 0, 0.5], { s: 1.06 });
  }

  return out;
};

// ---------- props + fx ----------
// The bandage: a simple white band wrap around the hero's head (drawn in face-card design space,
// forehead band + side knot + a small cheek patch). A wrap, never a wound — no blood, no injury.
function propBandage(pos, s, tint) {
  return {
    key: 'bandage', order: 3, x: pos[0], y: pos[1], z: pos[2], s, tint,
    draw: (pp) => {
      const g = pp.g; g.save();
      g.fillStyle = '#f7f3e9'; g.strokeStyle = pp.ink; g.lineWidth = 5;
      g.beginPath(); // main wrap across the forehead
      g.moveTo(176, 252); g.quadraticCurveTo(300, 208, 424, 252); g.lineTo(424, 288); g.quadraticCurveTo(300, 244, 176, 288); g.closePath();
      g.fill(); g.stroke();
      g.lineWidth = 3; g.strokeStyle = 'rgba(120,110,95,0.55)';
      g.beginPath(); g.moveTo(196, 268); g.quadraticCurveTo(300, 230, 404, 268); g.stroke(); // wrap seam
      g.beginPath(); g.moveTo(240, 224); g.lineTo(252, 264); g.moveTo(348, 222); g.lineTo(340, 262); g.stroke(); // cross wraps
      g.fillStyle = '#efe9da'; g.strokeStyle = pp.ink; g.lineWidth = 4; // side knot
      g.beginPath(); g.arc(420, 268, 17, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#f7f3e9'; g.lineWidth = 4;
      g.beginPath(); g.roundRect(346, 330, 42, 34, 8); g.fill(); g.stroke(); // cheek patch
      g.restore();
    },
  };
}
// The packed suitcase (engineer): a brown case with straps, waiting by the desk.
function propSuitcase(pos, s, tint) {
  return {
    key: 'suitcase', order: 3, x: pos[0], y: pos[1], z: pos[2], s, tint,
    draw: (pp) => {
      const g = pp.g; g.save();
      g.fillStyle = '#7a5230'; g.strokeStyle = pp.ink; g.lineWidth = 6;
      g.beginPath(); g.roundRect(418, 792, 132, 158, 14); g.fill(); g.stroke();
      g.fillStyle = '#8f6539'; g.fillRect(424, 836, 120, 10);
      g.fillStyle = '#5c3d20'; g.fillRect(452, 792, 16, 158); g.fillRect(508, 792, 16, 158); // straps
      g.strokeStyle = pp.ink; g.lineWidth = 6; g.beginPath(); g.arc(484, 786, 20, Math.PI, 0); g.stroke(); // handle
      g.fillStyle = '#d8c9a8'; g.beginPath(); g.roundRect(522, 872, 26, 34, 4); g.fill(); g.stroke(); // travel tag
      g.restore();
    },
  };
}

export const fxAt = (f, T) => {
  const S = shotAt(f), tint = tintAt(f), out = [];
  const PROP = (pf, pos, s = 1) => out.push(pf(pos, s, tint));
  const FX = (kind, draw, pos, s = 1, key = '') => out.push({ key: kind + key + '|' + draw + '|' + s, draw: (p) => draw(p.g, p), x: pos[0], y: pos[1], z: pos[2], s, tint, order: 5, blob: false, shadow: false });

  // hero props: the bandage rides with him from the train home through the second office day,
  // and for the first quiet days of recovery. The suitcase waits packed in the Hiroshima office.
  if (S.id === 'journey') { const p = heroJourneyPos(f); PROP(propBandage, [p[0], p[1], p[2]], 1.08); }
  if (S.id === 'aug9') { const d = duckE(f); PROP(propBandage, d > 0.02 ? lerp3([-261.8, 0, 0.8], [-260.6, -0.55, -0.9], d) : [-261.8, 0, 0.8], 1.08); }
  if (S.id === 'recovery' && f < TF('recovery', 0.25)) PROP(propBandage, [-316.9, 0, -1.1], 1.06);

  // tracked-object glow halo (signature of this engine): when the director watches an object,
  // a soft ring of light sits on it so the eye knows where to look.
  const D = dirFor(S.id, f);
  if (D.seg.type === 'object' && D.seg.id !== 'shelter' && D.seg.id !== 'bay') {
    const pl = D.point, pl2 = [pl[0], pl[1] - 2.02, pl[2]];
    FX('glow', (g, p) => {
      const pu = 0.75 + 0.25 * Math.sin(f * 0.18), r = 205 * pu;
      const gr = g.createRadialGradient(300, 500, 10, 300, 500, r);
      gr.addColorStop(0, 'rgba(255,236,180,0)'); gr.addColorStop(0.72, 'rgba(255,236,180,0)');
      gr.addColorStop(0.85, 'rgba(255,236,180,0.34)'); gr.addColorStop(1, 'rgba(255,236,180,0)');
      g.fillStyle = gr; g.fillRect(300 - r, 500 - r, r * 2, r * 2);
    }, pl2, 1.8, D.seg.id);
  }

  // AUG 6 — the flash throws up dust around the hero; afterwards only distant glow and settling dust.
  if (S.id === 'aug6') {
    const fl = FLASH6();
    if (f >= fl + 1 && f < fl + 16) for (let i = 0; i < 3; i++) FX('dust' + i, (g, p) => T.fxDust(p, clamp((f - fl - 1) / 15, 0, 1), '#e8dcc4'), [heroWalk6X(f) - 0.9 + i * 0.9, 0.12, 2.9], 0.9 + i * 0.25, 'a' + i);
    if (f >= TF('aug6', 0.55) && f < TF('aug6', 0.8)) FX('dustS', (g, p) => T.fxDust(p, ((f - TF('aug6', 0.55)) % 60) / 60, '#ddd2bc'), [-119, 0.1, 3.0], 1.4, 'settle');
    if (f >= TF('aug6', 0.85)) FX('shelterGlow', (g, p) => { // one warm lamp glow inside the night shelter
      const gr = g.createRadialGradient(300, 500, 8, 300, 500, 190);
      gr.addColorStop(0, 'rgba(255,196,110,0.5)'); gr.addColorStop(1, 'rgba(255,196,110,0)');
      g.fillStyle = gr; g.fillRect(110, 310, 380, 380);
    }, [SHELTER[0], -0.07, SHELTER[2]], 0.95, 'lamp');
  }

  // JOURNEY — soft steam puffs as the train pulls away.
  if (S.id === 'journey' && f >= TF('journey', 0.16) && f < TF('journey', 0.34)) {
    for (let i = 0; i < 2; i++) FX('steam' + i, (g, p) => T.fxDust(p, ((f - TF('journey', 0.16) + i * 13) % 26) / 26, '#eef0ee'), [-180, 2.6, 12.5], 0.8 + i * 0.3, 's' + i);
  }

  // AUG 9 — sparkle where the window light burst in, and dust settling over the desk.
  if (S.id === 'aug9') {
    const fl = FLASH9();
    if (f >= fl + 2 && f < fl + 22) FX('burst', (g, p) => T.fxStars(p, clamp((f - fl - 2) / 20, 0, 1)), [WINDOW9[0], WINDOW9[1] - 0.55, WINDOW9[2] + 0.8], 2.2, 'burst');
    if (f >= fl + 8 && f < fl + 40) FX('dust9', (g, p) => T.fxDust(p, clamp((f - fl - 8) / 32, 0, 1), '#ddd2bc'), [-260.4, 0.5, -0.4], 1.3, 'dust');
  }

  // SPEAKING OUT — press camera flashes pop in the audience.
  if (S.id === 'speakingout' && f >= TF('speakingout', 0.12) && f < TF('speakingout', 0.92) && (f * 7) % 53 < 2) {
    const i = f % 6;
    FX('camflash', (g, p) => T.fxStars(p, 0.5), [-384.6 + i * 1.85, 0.35, 2.7], 0.55, 'cf' + i);
  }

  // RECOGNITION — a gentle glint travels the certificate seal.
  if (S.id === 'recognition' && ((f >= TF('recognition', 0.18) && f < TF('recognition', 0.26)) || (f >= TF('recognition', 0.62) && f < TF('recognition', 0.7)))) {
    FX('seal', (g, p) => T.fxStars(p, 0.5), [CERT_BOARD[0], CERT_BOARD[1] - 0.55, CERT_BOARD[2] + 0.4], 0.8, 'seal');
  }

  return out;
};
