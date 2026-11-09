// Shot plan for "The Pigeon Who Saved Two Hundred Men" — Cher Ami, 1918.
// Timed to voice.mp3 (43.50 s, 30 fps, TOTAL 1305). Sets: trench/dugout x~0, battery x~+40,
// dawn road x~-35, medal clearing x~+75. Ground y=0.
// Pigeon card (roman.js pigeonCard): fly centre = design (300,430) -> world offset a.y + 1.226*s; perch feet at soles.
//
// V2 — PROFESSIONAL KEYFRAMED ANIMATION + TRACKING DIRECTOR (Bear v4 standard):
// * Every actor action is a deliberate keyframe track (kf/kf3): perch hops/pecks, keyed duck
//   under shell bursts, the runner's run-stumble-fall, the officer's reach/stop/point, the
//   home circle as a kf3 track, the medal salute — timed to the phrase beats. Only a faint
//   breathing layer sits under held poses.
// * Subject tracks (birdPos, homeBirdPos, runnerPos3, birdStoppedAt...) are the SINGLE source
//   of truth: actorsAt places the actors from them, camAt TRACKS the same tracks.
// * TRACKDIR table: per frame-range the camera locks onto a SUBJECT (the pigeon), a CHARACTER
//   (officer / trapped men / runner) or an OBJECT (capsule, basket, medal). Looks steer onto
//   the target's LIVE position; posW beats let the dolly ride the target's motion. Targets
//   hand off over BLEND=10 frames — no jumps. DOF focus follows the target.
// * VFX tied to tracking: warm glow pulse on the tracked object, dust on takeoff/landing,
//   impact micro-shakes (launch, shell burst, bullet hit, touchdown), FOV widening on the
//   fastest flight moves, medal glint on its track beat.
import { M, camFromKeys, idle, blinkAt, walk, q, clamp, lerp, lerp3, ramp, spline, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1305, DECK = 0;
export const SHOTS = [
  { id: 'hook',    a: 0,    b: 140,  light: 'dusk'   },
  { id: 'trapped', a: 141,  b: 343,  light: 'grey'   },
  { id: 'shell',   a: 344,  b: 517,  light: 'grey'   },
  { id: 'hope',    a: 518,  b: 628,  light: 'grey'   },
  { id: 'burst',   a: 629,  b: 725,  light: 'grey'   },
  { id: 'flight',  a: 726,  b: 854,  light: 'grey'   },
  { id: 'kept',    a: 855,  b: 1020, light: 'grey'   },
  { id: 'stopped', a: 1021, b: 1077, light: 'grey'   },
  { id: 'home',    a: 1078, b: 1177, light: 'dawn'   },
  { id: 'medal',   a: 1178, b: 1304, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const S0 = (id) => SHOTS.find((s) => s.id === id);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 240,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 16, ...WATER },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 40, fogFar: 220,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', vig: 0.26, shadowExt: 16, ...WATER },
  night: { az: 60, el: 38, sky: '#33456b', ground: '#1c1a20', hemi: 0.95, sun: '#aebfff', sunI: 1.15, fog: '#232c40', fogNear: 16, fogFar: 95,
    skyTop: '#131c30', skyHor: '#2c3a55', sat: 1.03, vig: 0.3, shadowExt: 9, waterDeep: '#1c2c3c', waterShal: '#2c445c', glint: '#cfe0ff' },
  dusk: { az: 30, el: 20, sky: '#8d8578', ground: '#4c4438', hemi: 0.95, sun: '#ffb46c', sunI: 2.0, fog: '#9a8a76', fogNear: 30, fogFar: 160,
    skyTop: '#5c5648', skyHor: '#d9a06a', sunDisc: '#ffe9c0', sunSize: 0.003, sat: 1.04, vig: 0.3, shadowExt: 14, waterDeep: '#2c445c', waterShal: '#3a5a74', glint: '#ffe9c0' },
  grey: { az: 205, el: 52, sky: '#b7bec7', ground: '#5d5a4e', hemi: 1.05, sun: '#e9e5d8', sunI: 1.55, fog: '#aeb4ba', fogNear: 26, fogFar: 175,
    skyTop: '#79838f', skyHor: '#c6ccd2', sat: 0.92, vig: 0.3, shadowExt: 18, waterDeep: '#33454f', waterShal: '#546a74', glint: '#dfe8ee' },
  dawn: { az: 96, el: 13, sky: '#c9b8c4', ground: '#6a5646', hemi: 1.02, sun: '#ffc98a', sunI: 2.7, fog: '#eec39a', fogNear: 38, fogFar: 210,
    skyTop: '#7d7fb4', skyHor: '#ffd9a3', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.1, gain: '#fff4e0', vig: 0.24, shadowExt: 16, waterDeep: '#2c445c', waterShal: '#4a7086', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- v2 subject tracks (actors + camera read the SAME tracks) ----------
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11); // faint breathing under held poses

// the perch (basket top at the dugout, [-3.55, 0.78, -0.9]): keyed hops + pecks + looks
const PERCH = [-3.55, 0.78, -0.9];
const perchYAt = (f) => kf([[0, 0], [42, 0], [48, 0.055, 'easeOut'], [54, 0], [58, 0.05, 'easeOut'], [64, 0], [518, 0], [552, 0], [558, 0.05, 'easeOut'], [564, 0], [629, 0], [635, -0.03, 'easeIn'], [637, 0], [725, 0]], f);
const perchRollAt = (f) => kf([[0, 0], [92, 0], [97, 0.16, 'easeIn'], [103, 0], [110, 0], [115, 0.16, 'easeIn'], [121, 0], [518, 0], [545, 0], [550, 0.13, 'easeIn'], [556, 0], [725, 0]], f); // pecks
const perchYawAt = (f) => kf([[0, -0.15], [30, -0.15], [40, 0.2, 'surge'], [80, 0.2], [95, -0.1], [140, -0.1], [518, -0.1], [540, -0.38, 'surge'], [600, -0.38], [628, -0.2]], f); // turns to the officer for the capsule
export const perchTrk = (f) => [PERCH[0], PERCH[1] + perchYAt(f) + 0.22, PERCH[2]]; // bird centre on the perch

// shared flight path (burst climb -> flight -> kept -> landing), v1 spline kept as the track
const FLY_PTS = [[-3.5, 1.35, -0.9], [-2.2, 4.4, -2.2], [6, 6.4, -4.6], [18, 7.6, -5.8], [29, 6.8, -5.2], [36, 5.4, -4.6], [38.8, 3.4, -3.2]];
const flySpan = () => { const a = S0('burst'), b = S0('kept'); return [a.a + Math.round((a.b - a.a) * 0.25), b.b]; };
const bulletF = () => { const s = S0('flight'); return s.a + Math.round((s.b - s.a) * 0.38); };
export const birdPos = (f) => {
  const [fa, fb] = flySpan();
  const u = clamp((f - fa) / (fb - fa));
  const p = spline(FLY_PTS, u);
  const bf = bulletF(); // falter: dip + shudder just after the bullet moment
  const d = Math.exp(-Math.pow((f - bf - 10) / 13, 2));
  p[1] -= 1.15 * d;
  p[0] += Math.sin(f * 0.9) * 0.05 * d;
  return p;
};
const flapAmpAt = (f) => kf([[629, 1], [726, 1], [855, 0.9], [1020, 0.8]], f); // frantic climb -> weary-steady
const birdFlapRaw = (f) => {
  const bf = bulletF();
  if (f >= bf && f < bf + 16) return 0.45;                    // wings stall at the hit
  const rate = f < S0('kept').a ? 0.62 : 0.4;                 // frantic, then weary-steady
  const ph = f * rate + Math.max(0, (f - (bf + 16))) * 0.0;
  return q(0.5 - 0.5 * Math.cos(ph), 2);
};
const birdFlap = (f) => q(0.5 + (birdFlapRaw(f) - 0.5) * flapAmpAt(f), 2);
const birdRoll = (f) => {
  const bf = bulletF();
  const d = Math.exp(-Math.pow((f - bf - 8) / 11, 2));
  return q(-0.5 * d + Math.sin(f * 0.14) * 0.05, 2);
};
const birdSpeed = (f) => { const a = birdPos(f - 1), b = birdPos(f + 1); return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2; }; // m per frame
// the message capsule: hangs below the breast in flight (card design ~(328,548) vs centre (300,430)); banded on the leg at perch
const capsuleFlyAt = (f) => { const bp = birdPos(f); return [bp[0] + 0.03, bp[1] - 0.14, bp[2]]; };
const CAPSULE_PERCH = [-3.57, 0.87, -0.84];
const BASKET_AT = [-3.55, 0.52, -0.9];
const MEDAL_AT = [74.15, 1.74, -1.15]; // on the perched bird's breast (card design (344,648), s 0.42 at [74.1,1.42,-1.2])

// trapped: the men's keyed duck, spiking after each shell burst in the shot (f202 / f266 / f319)
const duckAt = (f) => kf([[141, 0.16], [202, 0.16], [205, 0.27, 'easeIn'], [217, 0.17], [266, 0.17], [269, 0.28, 'easeIn'], [281, 0.18], [319, 0.18], [322, 0.27, 'easeIn'], [334, 0.17], [343, 0.17]], f);
// shell (battery half): recoil dips keyed to the battery's own gunfire (f354 / f372 / f391)
const recoilBobAt = (f) => kf([[344, 0], [354, 0], [356, -0.03, 'easeIn'], [362, 0], [372, 0], [374, -0.03, 'easeIn'], [380, 0], [391, 0], [393, -0.03, 'easeIn'], [399, 0], [417, 0]], f);
// shell (runner half): run -> stumble -> fall, one kf3 path (split f417, fallen f479)
const SPLIT = 344 + Math.round((517 - 344) * 0.42);
const runnerPos3 = (f) => kf3([[SPLIT, [7.6, 0, -0.5]], [SPLIT + 30, [9.3, 0, -2.05], 'easeInOut'], [SPLIT + 62, [10.35, 0, -3.15], 'easeIn'], [517, [10.35, 0, -3.15]]], f);
const runnerHeadAt = (f) => { const p = runnerPos3(f); return [p[0], f >= SPLIT + 62 ? 0.7 : 0.95, p[2]]; };
const runnerRollAt = (f) => kf([[SPLIT, 0], [SPLIT + 52, 0], [SPLIT + 58, 0.35, 'easeIn'], [SPLIT + 62, 1.25, 'easeIn'], [517, 1.25]], f);
const runnerPhaseAt = (f) => kf([[SPLIT, 0], [SPLIT + 62, 3.1], [517, 3.1]], f);
// stopped: the bird's landing glide centre, then settling onto the crate (shares the actors' math)
export const birdStoppedAt = (f) => {
  const S = S0('stopped'), land = ramp(f, S.a + 6, S.a + 30);
  if (land < 1) { const e = M.easeOut(land); return [lerp(41.5, 38.3, e), lerp(3.4, 1.55, e), lerp(-3.6, -2.1, land)]; }
  return [38.3, lerp(1.55, 1.15, smooth(ramp(f, S.a + 30, S.a + 42))), -2.1];
};
const officerStopX = (f) => kf([[1025, 45.6], [1055, 42.6, 'easeInOut'], [1077, 42.6]], f); // walks in, halts as she lands
// home: her one lazy circle above the column, as a kf3 track (samples of the v1 ellipse)
const homeBirdPos = (f) => kf3([[1078, [-29.46, 6.2, 0.42]], [1094, [-32.98, 6.46, 1.84], 'surge'], [1111, [-37.11, 6.46, 1.30], 'surge'], [1128, [-39.41, 6.2, -0.89], 'surge'], [1144, [-38.54, 5.94, -3.42], 'surge'], [1161, [-34.96, 5.94, -4.85], 'surge'], [1177, [-30.86, 6.19, -4.29], 'surge']], f);
const homeRollAt = (f) => kf([[1078, 0.25], [1128, -0.3], [1177, 0.17]], f);
const crewHeadAt = (f) => kf3([[1078, [-35.3, 1.5, 0.35]], [1177, [-31.5, 1.5, 0.35]]], f);

// ---------- cameras (v1 dolly keys kept as the base move; the director steers on top) ----------
const ck = (id, arr) => { const S = S0(id); return arr.map(([u, pos, look, fov, extra = {}]) => ({ f: Math.round(S.a + u * (S.b - S.a)), pos, look, fov, ...extra })); };
const CAMS = {
  hook: ck('hook', [
    [0.0, [-3.45, 1.24, 1.55], [-3.55, 0.8, -0.9], 37],
    [0.55, [-3.48, 1.12, 1.05], [-3.55, 0.79, -0.9], 36],
    [1.0, [-3.5, 1.08, 0.85], [-3.55, 0.78, -0.9], 35],
  ]),
  trapped: ck('trapped', [
    [0.0, [8.6, 3.4, 9.8], [0.5, 0.7, -1.4], 47, { ease: 'easeOut' }],
    [0.6, [6.4, 2.9, 8.2], [0.2, 0.75, -1.2], 46],
    [1.0, [5.2, 2.6, 7.4], [0.0, 0.8, -1.1], 45],
  ]),
  shell: ck('shell', [
    [0.0, [40.2, 2.1, 3.8], [39.8, 1.0, -5.0], 45],
    [0.3, [40.0, 2.0, 3.3], [39.9, 1.0, -4.9], 44],
    [0.45, [8.6, 1.7, 3.4], [9.4, 0.65, -2.5], 42, { ease: 'easeOut' }],
    [1.0, [9.4, 1.55, 2.9], [9.8, 0.6, -2.7], 41],
  ]),
  hope: ck('hope', [
    [0.0, [-3.0, 1.35, 2.5], [-3.35, 0.72, -1.0], 40, { ease: 'easeOut' }],
    [0.6, [-3.05, 1.26, 2.1], [-3.3, 0.72, -1.0], 39],
    [1.0, [-3.1, 1.2, 1.85], [-3.28, 0.72, -1.0], 38],
  ]),
  burst: ck('burst', [
    [0.0, [-3.35, 1.25, 2.7], [-3.5, 0.85, -0.9], 41],
    [0.3, [-3.3, 1.5, 2.6], [-3.1, 2.2, -1.5], 42],
    [1.0, [-3.1, 1.9, 2.5], [-2.0, 4.3, -2.2], 43],
  ]),
  stopped: ck('stopped', [
    [0.0, [42.6, 2.9, 2.4], [38.4, 1.05, -2.6], 49, { ease: 'easeOut' }],
    [1.0, [42.2, 2.7, 2.0], [38.3, 1.05, -2.5], 47],
  ]),
  home: ck('home', [
    [0.0, [-41.5, 1.9, 5.6], [-36.5, 1.0, 0.2], 44, { ease: 'easeOut' }],
    [1.0, [-30.5, 1.8, 5.4], [-27.5, 1.0, 0.2], 43],
  ]),
  medal: ck('medal', [
    [0.0, [74.3, 2.0, 3.4], [74.1, 1.5, -1.2], 44, { ease: 'easeOut' }],
    [0.6, [74.25, 1.95, 3.0], [74.1, 1.52, -1.2], 42],
    [1.0, [74.2, 1.9, 2.6], [74.1, 1.55, -1.2], 40, { roll: 2.0 }],
  ]),
};
const KICKS = { hook: [{ f: () => S0('hook').b - 18, a: 0.05 }] };

// ---------- v2 TRACKING DIRECTOR ----------
// {a, b, type: 'subject'|'character'|'object', id, pos(f) -> live target, w: look weight,
//  posW: optional camera-position follow weight (target motion is added to the dolly)}.
const TRACKDIR = {
  hook: [
    { a: 0, b: 140, type: 'subject', id: 'pigeon', pos: perchTrk, w: 0.5 },
  ],
  trapped: [
    { a: 141, b: 258, type: 'character', id: 'soldiers', pos: () => [1.8, 1.05, -0.6], w: 0.35 }, // the trapped men, ducking under the bursts
    { a: 258, b: 343, type: 'character', id: 'officer', pos: () => [-3.9, 1.45, 0.15], w: 0.5 },  // the officer takes charge
  ],
  shell: [
    { a: 344, b: 417, type: 'character', id: 'battery', pos: () => [40.2, 1.25, -3.6], w: 0.4 },  // the battery firing on its own men
    { a: 417, b: 517, type: 'character', id: 'runner', pos: runnerHeadAt, w: 0.55 },               // the last runner, tracked into his fall
  ],
  hope: [
    { a: 518, b: 548, type: 'character', id: 'officer', pos: () => [-4.35, 1.3, -0.15], w: 0.45 }, // he steps to the basket
    { a: 548, b: 592, type: 'object', id: 'capsule', pos: () => CAPSULE_PERCH, w: 0.6, posW: 0.2 }, // the message capsule is tied on
    { a: 592, b: 628, type: 'subject', id: 'pigeon', pos: perchTrk, w: 0.5 },                       // hand back to her before the launch
  ],
  burst: [
    { a: 629, b: 652, type: 'object', id: 'basket', pos: () => BASKET_AT, w: 0.55 },               // the basket at the release
    { a: 652, b: 725, type: 'subject', id: 'bird', pos: (f) => birdPos(f), w: 0.6, posW: 0.3 },    // the climb: dolly rides her rise
  ],
  flight: [
    { a: 726, b: 854, type: 'subject', id: 'bird', pos: (f) => birdPos(f), w: 0.7 },               // true tracking dolly in the air (camAt)
  ],
  kept: [
    { a: 855, b: 940, type: 'subject', id: 'bird', pos: (f) => birdPos(f), w: 0.6 },
    { a: 940, b: 1020, type: 'object', id: 'capsule', pos: capsuleFlyAt, w: 0.5 },                 // "the message still tied to her wounded leg"
  ],
  stopped: [
    { a: 1021, b: 1058, type: 'subject', id: 'bird', pos: birdStoppedAt, w: 0.6 },                 // tracked down the landing glide + touchdown
    { a: 1058, b: 1077, type: 'character', id: 'officer', pos: () => [39.6, 1.2, -2.75], w: 0.45 }, // he reaches her: a gentle shift toward him — the officer stands almost under this camera, so the target is the composed midpoint (v1 framing holds them both); a full lock-on ejects the bird from the portrait frame
  ],
  home: [
    { a: 1078, b: 1130, type: 'subject', id: 'bird', pos: homeBirdPos, w: 0.55 },                  // her victory circle
    { a: 1130, b: 1177, type: 'character', id: 'crew', pos: crewHeadAt, w: 0.4 },                  // the men marching home
  ],
  medal: [
    { a: 1178, b: 1212, type: 'subject', id: 'pigeon', pos: () => [74.1, 1.85, -1.2], w: 0.45 },
    { a: 1212, b: 1262, type: 'object', id: 'medal', pos: () => MEDAL_AT, w: 0.6, posW: 0.15 },    // the medal on her breast
    { a: 1262, b: 1304, type: 'subject', id: 'pigeon', pos: () => [74.1, 1.85, -1.2], w: 0.5 },
  ],
};
const BLEND = 10; // frames: tracked targets hand off over this window (centred on the boundary)
export const dirFor = (id, f) => {
  const segs = TRACKDIR[id];
  let i = segs.findIndex((s) => f <= s.b); if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  let point = seg.pos(f), w = seg.w;
  const pv = segs[i - 1];
  if (pv && f <= seg.a + BLEND / 2) { // first half of this segment: still blending IN from the previous target (same ramp as its forward blend — continuous across the flip)
    const t = smooth(ramp(f, seg.a - BLEND / 2, seg.a + BLEND / 2));
    point = lerp3(pv.pos(f), point, t); w = lerp(pv.w, w, t);
  }
  const nx = segs[i + 1];
  if (nx && f >= nx.a - BLEND / 2) {
    const t = smooth(ramp(f, nx.a - BLEND / 2, nx.a + BLEND / 2));
    point = lerp3(point, nx.pos(f), t); w = lerp(w, nx.w, t);
  }
  return { point, w, seg };
};
export const dirAt = (f) => dirFor(shotAt(f).id, f);
// FOV speed feel: brief widening on the fastest moves (takeoff, the climb, the bullet beat, the home swoop).
const fovFeel = (f) => {
  let b = 0;
  const bump = (a, bb, peak) => { if (f >= a && f <= bb) b += peak * Math.sin(Math.PI * ramp(f, a, bb)); };
  bump(637, 660, 2.0); bump(660, 706, 2.4); bump(770, 792, 1.6); bump(1100, 1132, 1.8);
  return b;
};
// Impact micro-shake: 4-frame decaying tremor (peak ~0.004 m at the camera ~ a few px on screen).
const SHAKES = [{ f: 637, a: 0.003 }, { f: 434, a: 0.0028 }, { f: 777, a: 0.004 }, { f: 1052, a: 0.0035 }];
const SHAKE_SHAPE = [1, -0.62, 0.3, -0.12];

export const camAt = (f) => {
  const S = shotAt(f);
  let c;
  if (S.id === 'flight' || S.id === 'kept') {
    // tracking camera: flies alongside the bird, slightly below and behind-side (v1 dolly kept);
    // the director locks the look onto its live target — the bird, then the capsule she carries.
    const bp = birdPos(f), bp2 = birdPos(f + 2);
    const side = S.id === 'flight' ? 5.0 : 4.2;
    const pos = [bp[0] - 2.0, bp[1] - 0.2, bp[2] + side];
    c = { pos, look: [bp2[0], bp2[1], bp2[2]], fov: S.id === 'flight' ? 42 : 40, roll: q(Math.sin(f * 0.1) * 1.2, 1), shadowAt: [bp[0], 0, bp[2]], flash: 0 };
    const D = dirFor(S.id, f);
    const lead = S.id === 'flight' ? birdPos(f + 3) : D.point;
    c.look = lerp3(c.look, lead, D.w * 0.5);
    c.fov += clamp((birdSpeed(f) - 0.10) * 30, 0, 3); // FOV breathes with her airspeed
  } else {
    const kicks = (KICKS[S.id] || []).map((k) => ({ f: typeof k.f === 'function' ? k.f() : k.f, a: k.a }));
    c = camFromKeys(CAMS[S.id], f, { kicks });
    // v2 TRACKING DIRECTOR: steer the look onto the tracked subject/character/object (TRACKDIR).
    const D = dirFor(S.id, f);
    c.look = lerp3(c.look, D.point, D.w);
    if (D.seg.posW && f >= D.seg.a && f <= D.seg.b) { // marked beats: the dolly rides the target's own motion
      const fade = smooth(ramp(f, D.seg.a, D.seg.a + 5)) * (1 - smooth(ramp(f, D.seg.b - 5, D.seg.b)));
      const p0 = D.seg.pos(D.seg.a), p1 = D.seg.pos(f);
      if (fade > 0) c.pos = c.pos.map((v, i) => v + (p1[i] - p0[i]) * D.seg.posW * fade);
    }
    c.flash = S.id === 'hook' && f >= S.b - 20 && f < S.b - 14 ? (1 - (f - (S.b - 20)) / 6) * 0.5 : 0;
    c.shadowAt = { hook: [-3.5, 0.8, -0.9], trapped: [1, 0.8, -1], shell: f < SPLIT ? [40, 1, -4] : [10, 0.7, -3], hope: [-3.3, 0.7, -1], burst: [-3, 1.5, -1.5], stopped: [40, 1, -4], home: [-33, 1, 0], medal: [74.2, 1.3, -1.2] }[S.id];
  }
  c.fov += fovFeel(f); // v2 speed feel on the fastest tracking moves
  for (const s of SHAKES) { // v2 impact micro-shake (launch, shell burst, bullet hit, touchdown)
    const d = f - s.f;
    if (d >= 0 && d < 4) { const m = s.a * SHAKE_SHAPE[d]; c.pos = [c.pos[0] + m * 0.5, c.pos[1] + m, c.pos[2]]; c.look = [c.look[0] + m * 0.8, c.look[1] + m * 1.4, c.look[2]]; }
  }
  return c;
};

// ---------- lens (focus distance tracks the target too) ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const wide = S.id === 'trapped' || S.id === 'stopped';
  const cinf = (S.id === 'flight' || S.id === 'kept') ? 8 : wide ? 3 : 9;
  return { focus: dist(C.pos, dirAt(f).point), cinf }; // v2: focus rides the tracked target, like the look
};

// ---------- world state ----------
const BURSTS = [ // shell bursts: frame offset fn -> resolved in worldAt via shot-relative anchors
  { shot: 'hook', u: 0.82, x: 7.5, y: 0, z: -6.0, max: 2.6 },
  { shot: 'trapped', u: 0.3, x: 12.5, y: 0, z: -8.5, max: 3.2 },
  { shot: 'trapped', u: 0.62, x: -5.5, y: 0, z: -7.0, max: 2.8 },
  { shot: 'trapped', u: 0.88, x: 5.0, y: 0, z: -5.5, max: 3.0 },
  { shot: 'shell', u: 0.52, x: 11.5, y: 0, z: -6.5, max: 3.4 },
  { shot: 'shell', u: 0.72, x: 6.5, y: 0, z: -5.0, max: 3.0 },
  { shot: 'flight', u: 0.34, dx: 5.5, dy: -3.4, dz: -4.5, max: 2.8 },
  { shot: 'flight', u: 0.75, x: 22, y: 0, z: -9, max: 3.4 },
];
const GUNFIRE = [ // battery firing times (absolute-ish, resolved from the shell + stopped shots)
  { shot: 'shell', u: 0.06, gun: 0 }, { shot: 'shell', u: 0.16, gun: 1 }, { shot: 'shell', u: 0.27, gun: 2 },
  { shot: 'stopped', u: 0.08, gun: 1 },
];
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lidT: 0, puffs: [], guns: [{}, {}, {}] };
  const bs = S0('burst');
  if (S.id === 'burst') W.lidT = 0.85 + 0.15 * ramp(f, bs.a + 2, bs.a + 10);
  else if (f > bs.a) W.lidT = 1;
  else W.lidT = 0.85;
  for (const b of BURSTS) {
    const sh = S0(b.shot); if (f < sh.a || f > sh.b + 40) continue;
    const t0 = sh.a + Math.round((sh.b - sh.a) * b.u), age = f - t0;
    if (age < 0 || age > 34) continue;
    const bp = b.dx !== undefined ? birdPos(t0) : null;
    const x = bp ? bp[0] + b.dx : b.x, y = bp ? bp[1] + b.dy : b.y, z = bp ? bp[2] + b.dz : b.z;
    const s = b.max * M.easeOut(clamp(age / 9)) * (age > 20 ? 1 - (age - 20) / 14 : 1);
    W.puffs.push({ x, y, z, s: q(s, 2), o: q(0.92 * (1 - Math.max(0, age - 16) / 18), 2) });
  }
  for (const g of GUNFIRE) {
    const sh = S0(g.shot); if (f < sh.a || f > sh.b + 30) continue;
    const t0 = sh.a + Math.round((sh.b - sh.a) * g.u), age = f - t0;
    if (age < 0 || age > 16) continue;
    W.guns[g.gun] = { flash: q(Math.max(0, 1 - age / 4), 2), recoil: q(Math.max(0, 1 - age / 11), 2) };
  }
  return W;
};

// ---------- actors (v2: every action keyframed to the phrase beats) ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const PG = (T, o, pos, extra = {}) => ({ key: 'pigeon' + JSON.stringify(o), draw: (p) => T.pigeonCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, blob: false, shadow: false, ...extra });
const TINT = { day: '#ffffff', golden: '#ffe2c8', night: '#b9c8ff', dusk: '#ffd9ae', grey: '#e3e6e2', dawn: '#ffdfba' };
const flyCard = (f, T, tint, o = {}) => {
  const bp = birdPos(f), s = o.s || 0.5;
  return PG(T, { mode: 'fly', flap: birdFlap(f), blink: blinkAt(f, 41), expr: o.expr || 'determined', capsule: true, bandage: f >= bulletF(), ...o }, [bp[0], bp[1] - 1.226 * s, bp[2]], { tint, s, roll: birdRoll(f) });
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  switch (S.id) {
    case 'hook': {
      const id = idle(f, 5);
      out.push(PG(T, { mode: 'perch', blink: blinkAt(f, 41), expr: 'alert', capsule: true, bandage: true }, [PERCH[0], PERCH[1] + perchYAt(f), PERCH[2]], { tint, s: 0.3, roll: q(perchRollAt(f), 2), yaw: q(perchYawAt(f), 2) }));
      out.push(R(T, 'officer44', { seed: 21, expr: 'stubborn', L: 'hip', R: 'hang', blink: blinkAt(f, 21), bob: q(id.bob + breath(f, 21), 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt + kf([[0, 0], [30, 0], [45, -4, 'surge'], [140, -4]], f), 1) }, [-4.5, 0, -0.35], { tint }));
      break;
    }
    case 'trapped': {
      const duck = duckAt(f); // keyed to the shot's own shell bursts
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'stubborn', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(-duck, 3), tilt: q(4, 1), headTilt: q(-3, 1) }, [2.5, 0, -0.55], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'squint', L: 'belly', R: 'hang', blink: blinkAt(f, 12), bob: q(-duck - 0.02, 3), tilt: q(5, 1), headTilt: q(2, 1) }, [3.6, 0, -0.85], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'neutral', L: 'hang', R: 'belly', blink: blinkAt(f, 13), bob: q(-duck + 0.01, 3), tilt: q(3, 1), headTilt: q(-2, 1) }, [-0.6, 0, -0.3], { tint }));
      out.push(R(T, 'officer44', { seed: 21, expr: 'stubborn', L: 'hip', R: 'point', blink: blinkAt(f, 21), bob: q(-duck, 3), tilt: q(3, 1), headTilt: q(kf([[141, -3], [258, -3], [266, 3, 'surge'], [343, 3]], f), 1) }, [-3.9, 0, 0.15], { tint }));
      break;
    }
    case 'shell': {
      if (f < SPLIT) { // the battery, firing on its own men by mistake — recoil dips keyed to its gunfire
        const rb = recoilBobAt(f);
        out.push(R(T, 'soldier44a', { seed: 11, expr: 'stubborn', L: 'reach', R: 'reach', blink: blinkAt(f, 11), bob: q(idle(f, 11).bob + rb, 3), tilt: q(5, 1) }, [36.8, 0, -3.2], { tint }));
        out.push(R(T, 'soldier44b', { seed: 12, expr: 'neutral', L: 'lift', R: 'lift', blink: blinkAt(f, 12), bob: q(idle(f, 12).bob + rb, 3), tilt: q(6, 1) }, [41.9, 0, -3.6], { tint }));
        out.push(R(T, 'officer44', { seed: 21, expr: 'neutral', L: 'hip', R: 'point', blink: blinkAt(f, 21), bob: q(idle(f, 21).bob + rb * 0.5, 3), tilt: q(2, 1) }, [43.8, 0, -1.6], { tint }));
      } else { // the runner: kf3 run -> stumble -> fall (actors and camera read the same runnerPos3)
        const rp = runnerPos3(f), fallen = f >= SPLIT + 62;
        const stp = fallen ? 0 : q(runnerPhaseAt(f) % 1, 2);
        out.push(R(T, 'soldier44b', { seed: 12, expr: fallen ? 'pained' : 'stubborn', L: fallen ? 'hang' : 'belly', R: fallen ? 'hang' : 'belly', blink: blinkAt(f, 12), bob: q(fallen ? -0.1 : Math.abs(Math.sin(runnerPhaseAt(f) * Math.PI)) * 0.02, 3), tilt: q(fallen ? 9 : 6, 1), headTilt: q(fallen ? -6 : 0, 1), step: stp }, rp, { tint, roll: q(runnerRollAt(f), 2) }));
        out.push(R(T, 'soldier44a', { seed: 11, expr: 'pained', L: 'hang', R: 'point', blink: blinkAt(f, 11), bob: q(idle(f, 11).bob, 3), tilt: q(3, 1) }, [6.4, 0, -0.2], { tint }));
      }
      break;
    }
    case 'hope': {
      const id = idle(f, 8);
      // the officer leans in on the capsule beat (548-592) as he ties the message on
      const lean = kf([[518, 7], [548, 7], [575, 11, 'surge'], [600, 8], [628, 8]], f);
      out.push(R(T, 'officer44', { seed: 21, expr: f > S.a + 60 ? 'smile' : 'neutral', L: 'belly', R: 'reach', blink: blinkAt(f, 21), bob: q(-0.06 + id.bob, 3), tilt: q(lean, 1), headTilt: q(kf([[518, 4], [560, 9, 'surge'], [628, 6]], f), 1) }, [-4.35, 0, -0.15], { tint }));
      out.push(PG(T, { mode: 'perch', blink: blinkAt(f, 41), expr: 'alert', capsule: true, bandage: true }, [PERCH[0], PERCH[1] + perchYAt(f), PERCH[2]], { tint, s: 0.3, roll: q(perchRollAt(f), 2), yaw: q(perchYawAt(f), 2) }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(2, 1), headTilt: q(-3, 1) }, [-1.5, 0, 0.35], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'grin', L: 'hang', R: f >= 585 ? 'up' : 'hang', blink: blinkAt(f, 13), bob: q(id.bob, 3), tilt: q(2, 1), headTilt: q(3, 1) }, [-5.6, 0, 0.5], { tint }));
      break;
    }
    case 'burst': {
      const bs = S;
      if (f < bs.a + 8) out.push(PG(T, { mode: 'perch', blink: 0, expr: 'determined', capsule: true, bandage: true }, [PERCH[0], PERCH[1] + perchYAt(f), PERCH[2]], { tint, s: 0.3, roll: q(perchRollAt(f), 2) }));
      else out.push(flyCard(f, T, tint, { s: 0.46 }));
      // the cheer is keyed to the launch (f = bs.a + 10/12), not held from the shot start
      out.push(R(T, 'officer44', { seed: 21, expr: 'smile', L: 'hang', R: f >= bs.a + 12 ? 'up' : 'hang', blink: blinkAt(f, 21), bob: q(idle(f, 21).bob, 3), tilt: q(-2, 1), headTilt: q(kf([[629, 0], [641, -6, 'surge'], [725, -6]], f), 1) }, [-4.4, 0, 0.1], { tint }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'grin', L: f >= bs.a + 10 ? 'up' : 'hang', R: f >= bs.a + 10 ? 'up' : 'hang', blink: blinkAt(f, 11), bob: q(Math.abs(Math.sin(f * 0.3)) * 0.02, 3) }, [-2.2, 0, 0.3], { tint }));
      break;
    }
    case 'flight': case 'kept': {
      out.push(flyCard(f, T, tint, { s: S.id === 'flight' ? 0.52 : 0.56, expr: f > bulletF() ? 'tired' : 'determined' }));
      break;
    }
    case 'stopped': {
      const land = ramp(f, S.a + 6, S.a + 30);
      if (land < 1) { // she glides in and lands on the ammo crate
        const lx = lerp(41.5, 38.3, M.easeOut(land)), ly = lerp(3.4, 1.55, M.easeOut(land)), lz = lerp(-3.6, -2.1, land);
        const s = 0.44;
        out.push(PG(T, { mode: 'fly', flap: q(0.5 - 0.5 * Math.cos(f * 0.5), 2), blink: blinkAt(f, 41), expr: 'tired', capsule: true, bandage: true }, [lx, ly - 1.226 * s, lz], { tint, s, roll: q(-0.12 * (1 - land), 2) }));
      } else {
        out.push(PG(T, { mode: 'perch', blink: blinkAt(f, 41), expr: 'tired', capsule: true, bandage: true }, [38.3, 0.88, -2.1], { tint, s: 0.32 }));
      }
      // the officer walks in on a keyed phase and HALTS as she lands (v1 stepped in place forever)
      const walking = f < 1055, ph = kf([[1025, 0], [1055, 1.9], [1077, 1.9]], f);
      out.push(R(T, 'officer44', { seed: 21, expr: 'smile', L: 'up', R: 'point', blink: blinkAt(f, 21), bob: q(walking ? Math.abs(Math.sin(ph * Math.PI)) * 0.02 : idle(f, 21).bob, 3), tilt: q(2, 1), step: q(walking ? ph % 1 : 0, 2) }, [officerStopX(f), 0, -2.9], { tint }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(idle(f, 11).bob - 0.03, 3), tilt: q(4, 1) }, [36.8, 0, -3.2], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'smile', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.28)) * 0.02, 3) }, [41.9, 0, -3.6], { tint }));
      break;
    }
    case 'home': {
      const crew = [['soldier44a', 11, -39.5, 'smile'], ['soldier44b', 12, -36.8, 'neutral'], ['soldier44c', 13, -34.2, 'grin'], ['soldier44a', 14, -31.8, 'smile']];
      for (const [who, seed, x0, expr] of crew) {
        const wk = walk(f, S.a, 1.15, 0.8);
        out.push(R(T, who, { seed, expr, L: 'hang', R: 'hang', blink: blinkAt(f, seed), bob: q(Math.abs(Math.sin(f * 0.26 + seed)) * 0.018, 3), step: q(wk.phase + seed * 0.13, 2) }, [x0 + wk.dist, 0, 0.35 + (seed % 3) * 0.35], { tint }));
      }
      // her circle is the kf3 homeBirdPos track — actor and camera read the same points
      const hp = homeBirdPos(f), s = 0.42;
      out.push(PG(T, { mode: 'fly', flap: q(0.5 - 0.5 * Math.cos(f * 0.42), 2), blink: blinkAt(f, 41), expr: 'proud', capsule: false, bandage: true }, [hp[0], hp[1] - 1.226 * s, hp[2]], { tint, s, roll: q(homeRollAt(f), 2) }));
      break;
    }
    case 'medal': {
      const id = idle(f, 16);
      // she swells proud as the medal beat lands (1235-1258); the officer's salute is keyed at 1212
      const swell = kf([[1178, 0.42], [1235, 0.42], [1258, 0.438, 'surge'], [1304, 0.435]], f);
      out.push(PG(T, { mode: 'perch', blink: blinkAt(f, 41), expr: 'proud', capsule: true, bandage: false, medal: true, pegleg: true }, [74.1, 1.42, -1.2], { tint, s: swell }));
      const saluteDip = kf([[1178, 0], [1206, 0], [1212, -0.02, 'easeIn'], [1220, 0], [1304, 0]], f);
      out.push(R(T, 'officer44', { seed: 21, expr: 'smile', L: 'hang', R: f >= 1212 ? 'temple' : 'hang', blink: blinkAt(f, 21), bob: q(id.bob + saluteDip, 3), tilt: q(1, 1), headTilt: q(2, 1) }, [72.7, 0.26, -0.45], { tint, ground: 0.26 }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'grin', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.26)) * 0.02, 3) }, [75.7, 0.26, -0.4], { tint, ground: 0.26 }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'smile', L: 'hang', R: f >= 1240 ? 'up' : 'hang', blink: blinkAt(f, 13), bob: q(id.bob, 3) }, [76.6, 0.26, -1.9], { tint, ground: 0.26 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'medal' && f >= S.b - 50 && f < S.b - 26) { // warm glint on the medal reveal
    const t = q((f - (S.b - 50)) / 24, 2);
    out.push(FX('glint' + t, (p) => T.fxStars(p, t), [74.35, 2.35, -1.1], 0.3));
  }
  if ((S.id === 'trapped' || S.id === 'shell') && f % 47 < 10) { // drifting ash/leaves over the trench
    for (let i = 0; i < 3; i++) {
      const t = ((f - 5) * 0.012 + i / 3) % 1; if (t < 0) continue;
      out.push(FX('leaf' + i, (p) => T.fxLeaf(p, '#8a7a52'), [-2 + t * 9, 2.6 - t * 2.2, -0.6 + i * 0.5], 0.1, { roll: q(t * 8 + i, 1) }));
    }
  }
  // ---- v2 tracking VFX: the eye is led to whatever the camera is tracking ----
  const glow = (tp, s, a) => out.push(FX('glow' + q(a, 2) + '_' + q(tp[0], 1), (p) => fxGlow(p, a), [tp[0], tp[1] - 0.81 * s, tp[2] + 0.12], s));
  if (S.id === 'hope' && f >= 548 && f < 592) glow(CAPSULE_PERCH, 0.34, 0.16 + 0.06 * Math.sin((f - 548) * 0.35)); // capsule tied on
  if (S.id === 'burst' && f >= 629 && f < 652) glow([BASKET_AT[0], BASKET_AT[1] + 0.3, BASKET_AT[2]], 0.8, 0.15 + 0.05 * Math.sin((f - 629) * 0.35)); // the basket at release
  if (S.id === 'burst' && f >= 637 && f < 649) { // dust burst on takeoff
    const t = q((f - 637) / 12, 2);
    out.push(FX('tdust' + t, (p) => T.fxDust(p, t, '#cbb894'), [BASKET_AT[0], BASKET_AT[1] + 0.15, BASKET_AT[2] + 0.1], 0.3));
  }
  if (S.id === 'kept' && f >= 940 && f < 1020) { const cp = capsuleFlyAt(f); glow(cp, 0.5, 0.15 + 0.05 * Math.sin((f - 940) * 0.3)); } // capsule in flight
  if (S.id === 'stopped' && f >= 1052 && f < 1064) { // dust burst on touchdown
    const t = q((f - 1052) / 12, 2);
    out.push(FX('ldust' + t, (p) => T.fxDust(p, t, '#cbb894'), [38.3, 0.35, -2.0], 0.34));
  }
  if (S.id === 'medal' && f >= 1212 && f < 1262) glow(MEDAL_AT, 0.4, 0.16 + 0.06 * Math.sin((f - 1212) * 0.35)); // the medal, on its track beat
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
