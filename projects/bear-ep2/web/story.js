// Shot plan for "Bear Episode 2: The Bear Who Caught a Spy" — timed to bear-ep2-voice
// (43.33 s, 30 fps, TOTAL 1300). Same Wojtek + soldier cast as Bear v4 (locked designs).
// Phrases: P1 0-46 hook | P2 67-269 camp intro | P3 289-454 spy slips in | P4 473-631 spy hides |
// P5 652-749 Wojtek's favourite place | P6 767-938 splash + reveal | P7 962-1126 scream/sunrise |
// P8 1154-1276 honey. SHOTS are contiguous (gaps hold the previous shot's tail).
// World (built in main.js): Polish camp in Egypt at night — fire (0,0,-0.5), Wojtek's tent
// (-3.2,0,-3.4), shower tent (4.4,0,-2.2) with its low side screen at (3.8,0,-1.45),
// ammo crates (2.6,0,-1.35), trip crate (2.18,0,-0.5), tie/lantern post L2 (2.3,0,1.7).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1300, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 66, light: 'night' },
  { id: 'intro', a: 67, b: 288, light: 'fire' },
  { id: 'spy', a: 289, b: 472, light: 'nightlow' },
  { id: 'hide', a: 473, b: 651, light: 'nightlow' },
  { id: 'fav', a: 652, b: 766, light: 'nightlow' },
  { id: 'reveal', a: 767, b: 961, light: 'nightlow' },
  { id: 'scream', a: 962, b: 1153, light: 'night' },
  { id: 'honey', a: 1154, b: 1299, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#16222e', waterShal: '#24384a', glint: '#cfe0ff' };
export const LIGHTS = {
  night: { az: 215, el: 34, sky: '#2c3c5e', ground: '#14161f', hemi: 0.85, sun: '#b9ccff', sunI: 1.25, fog: '#1b2740', fogNear: 26, fogFar: 230,
    skyTop: '#0d1526', skyHor: '#27395c', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 1.04, vig: 0.3, shadowExt: 15, ...WATER },
  fire: { az: 215, el: 34, sky: '#46507a', ground: '#3a2a20', hemi: 1.0, sun: '#b9ccff', sunI: 1.1, fog: '#232038', fogNear: 24, fogFar: 220,
    skyTop: '#131a30', skyHor: '#3a3a58', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 1.07, vig: 0.28, shadowExt: 15, ...WATER },
  nightlow: { az: 215, el: 34, sky: '#232f4c', ground: '#101218', hemi: 0.62, sun: '#aebfff', sunI: 1.05, fog: '#16203a', fogNear: 20, fogFar: 200,
    skyTop: '#0a1220', skyHor: '#1f3050', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 1.02, vig: 0.34, shadowExt: 15, ...WATER },
  golden: { az: 100, el: 16, sky: '#9aa8d8', ground: '#6a5238', hemi: 1.12, sun: '#ffc37e', sunI: 2.35, fog: '#d9b28c', fogNear: 40, fogFar: 300,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.06, gain: '#ffedd6', vig: 0.24, shadowExt: 15,
    waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t);
  o.sunI = o.sunI * (1 - 0.45 * Math.sin(Math.PI * t)); // dip mid-blend masks the sun's swing across the sky
  return o;
};
export const lightFor = (S, f) => {
  if (S.id === 'scream') return blendLight(LIGHTS.night, LIGHTS.golden, smooth(ramp(f, 1005, 1126)));
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
export const TENT_DOOR = [-3.05, 0, -1.28];      // Wojtek's home spot: in FRONT of his tent's face (hook / sleep / fav start)
export const SHOWER_BEAR = [3.95, 0, -1.75];     // bear behind the shower side screen
export const SHOWER_FRONT = [3.5, 0, -1.0];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
const laugh = (f, a, b, amp) => (f >= a && f < b) ? Math.abs(Math.sin((f - a) * 0.55)) * amp * Math.min(1, (f - a) / 6) * Math.min(1, (b - f) / 6) : 0;

// ---------- bear tracks ----------
const bearIntroPos = (f) => kf3([
  [67, [0.15, 0, 0.45]], [105, [0.34, 0, 0.45]], [140, [0.04, 0, 0.45]], [172, [0.26, 0, 0.45]],
  [200, [0.18, 0, 0.45]], [226, [0.18, 0, 0.45]],
  [262, [...TENT_DOOR], 'easeInOut', [[-1.7, 0, -1.1]]], [288, [...TENT_DOOR]],
], f);
export const bearFavPos = (f) => kf3([
  [652, [...TENT_DOOR]], [668, [...TENT_DOOR]],
  [748, [...SHOWER_FRONT], 'easeInOut', [[0.2, 0, -0.9]]], [766, [...SHOWER_FRONT]],
], f);
const bearFavPhase = (f) => kf([[652, 0], [668, 0], [748, 5.4, 'easeInOut'], [766, 5.4]], f);
export const bearPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': case 'spy': case 'hide': return [...TENT_DOOR];
    case 'intro': return bearIntroPos(f);
    case 'fav': return bearFavPos(f);
    case 'reveal': case 'scream': return [...SHOWER_BEAR];
    case 'honey': return [0.25, 0, 0.35];
    default: return [0, 0, 0];
  }
};

// ---------- spy track (single source for actors + camera + sweep) ----------
const SPY_OUTFIT = { tunic: '#262230', skin: '#e9c298', hair: '#17120e' };
export const spyPoseAt = (f) => {
  const P = { p: null, step: 0, tilt: 0, headTilt: 0, expr: 'nervous', L: 'hang', R: 'belly', yaw: 0, roll: 0 };
  if (f < 300) return null;
  if (f <= 454) { // spy_in: slip between the tents, duck behind the crates
    P.p = kf3([[300, [6.6, 0, 1.2]], [368, [4.7, 0, -0.5], 'easeInOut'], [438, [3.05, 0, -1.6], 'easeInOut'], [454, [2.95, -0.16, -1.7]]], f);
    P.step = kf([[300, 0], [438, 4.4]], f);
    P.tilt = f >= 440 ? 11 : 7;
    P.headTilt = kf([[300, 0], [340, -9], [380, 7], [420, -6], [454, 0]], f);
    P.R = f >= 380 ? 'reach' : 'belly';
    return P;
  }
  if (f <= 651) { // hide: crouch behind crates, peek, slip into the shower tent
    if (f < 545) {
      P.p = [2.95, -0.15, -1.72]; P.tilt = 10;
      P.headTilt = kf([[473, -4], [500, 9], [525, -8], [545, 4]], f);
      P.L = 'belly'; P.R = 'belly';
    } else if (f < 590) {
      P.p = kf3([[545, [2.95, -0.15, -1.72]], [590, [4.3, 0, -1.98], 'easeInOut']], f);
      P.step = kf([[545, 0], [590, 2.0]], f); P.tilt = 8; P.R = 'reach';
    } else {
      P.p = [kf([[600, 4.33], [615, 4.16], [631, 4.31]], f), 0, -2.42]; P.tilt = 9; P.headTilt = -5; P.L = 'belly'; P.R = 'belly';
    }
    return P;
  }
  if (f <= 766) return null; // inside the shower tent, unseen
  if (f <= 849) { // reveal A: at the door, turning toward the splash
    P.p = [4.28, 0, -2.05];
    P.yaw = kf([[767, 0.55], [800, 0.55], [838, -0.12, 'surge'], [849, -0.12]], f);
    P.headTilt = kf([[767, 0], [812, -4], [849, -7]], f);
    P.tilt = 5; P.L = 'belly'; P.R = 'reach';
    return P;
  }
  if (f <= 961) { // reveal CU: foreground, back three-quarter, stunned, looking up
    P.p = [3.18, 0, -0.26]; P.yaw = 2.65; P.expr = 'shock'; P.headTilt = -7; P.tilt = 3; P.L = 'hang'; P.R = 'hang';
    P.p[0] += Math.sin(f * 1.7) * 0.004; // tremble
    return P;
  }
  if (f <= 1153) { // scream: burst out, trip, scramble, tied to the post
    P.expr = 'shock'; P.L = 'up'; P.R = 'up';
    if (f < 988) {
      P.p = kf3([[962, [4.28, 0, -2.05]], [978, [3.2, 0, -0.95], 'easeIn'], [988, [2.32, 0, -0.55]]], f);
      P.step = kf([[962, 0], [988, 3.4]], f); P.tilt = -4;
    } else if (f < 1005) {
      P.p = [2.28, kf([[988, 0], [994, -0.34, 'easeIn'], [1005, -0.04]], f), -0.42];
      P.roll = kf([[988, 0], [994, 0.55], [1005, 0.1]], f); P.tilt = 12; P.step = 3.4;
    } else if (f < 1040) {
      P.p = kf3([[1005, [2.28, -0.04, -0.42]], [1040, [2.2, 0, 1.28], 'easeInOut']], f);
      P.step = kf([[1005, 3.4], [1040, 5.2]], f); P.tilt = 4; if (f >= 1030) { P.L = 'cross'; P.R = 'cross'; }
    } else {
      P.p = [2.2, 0, 1.3]; P.expr = 'dazed'; P.L = 'cross'; P.R = 'cross';
      P.tilt = 7; P.headTilt = 13; P.roll = Math.sin(f * 0.05) * 0.012; // bowed, swaying a little
    }
    return P;
  }
  return null;
};

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [-1.7, 1.52, 0.85], look: [-3.02, 1.36, -1.26], fov: 42 },
    { f: 46, pos: [-2.08, 1.45, 0.18], look: [-3.03, 1.4, -1.27], fov: 38, ease: 'surge' },
    { f: 66, pos: [-2.14, 1.44, 0.08], look: [-3.03, 1.4, -1.27], fov: 37 },
  ],
  intro: [ // continuous pull-back: starts exactly on the hook's end camera (tent CU) and glides out to the wide camp
    { f: 67, pos: [-2.14, 1.44, 0.08], look: [-3.03, 1.4, -1.27], fov: 37 },
    { f: 120, pos: [-1.2, 1.8, 3.4], look: [-0.9, 1.0, -1.2], fov: 40, ease: 'surge', path: [[-2.2, 1.6, 1.2]] },
    { f: 180, pos: [0.3, 1.9, 6.2], look: [-0.15, 0.88, -0.65], fov: 41.5, ease: 'surge' },
    { f: 288, pos: [0.1, 1.75, 5.6], look: [-0.3, 0.88, -0.8], fov: 40 },
  ],
  hide: [
    { f: 473, pos: [5.6, 1.7, 4.6], look: [3.3, 0.78, -1.95], fov: 41 },
    { f: 651, pos: [4.8, 1.5, 3.2], look: [3.45, 0.8, -2.0], fov: 38, ease: 'surge' },
  ],
  revealA: [
    { f: 767, pos: [5.35, 1.62, 2.7], look: [4.0, 1.05, -1.85], fov: 41 },
    { f: 849, pos: [4.95, 1.5, 1.8], look: [4.0, 1.1, -1.82], fov: 39, ease: 'surge' },
  ],
  revealB: [ // over the spy's shoulder: the bear has stepped OUT of the hut (no roof beam crosses his face); face centre ~1.8 m at s=1.25
    { f: 850, pos: [3.2, 1.78, 1.05], look: [3.88, 1.76, -1.1], fov: 37 },
    { f: 961, pos: [3.13, 1.76, 0.88], look: [3.9, 1.77, -1.12], fov: 35, ease: 'surge' },
  ],
  scream: [
    { f: 962, pos: [2.2, 1.95, 7.6], look: [2.9, 0.9, -1.0], fov: 44 },
    { f: 1040, pos: [1.7, 1.75, 6.1], look: [2.25, 0.92, 0.25], fov: 41, ease: 'surge' },
    { f: 1153, pos: [1.45, 1.68, 5.4], look: [2.2, 0.95, 0.75], fov: 39.5 },
  ],
  honey: [
    { f: 1154, pos: [0.5, 1.8, 6.1], look: [0.25, 0.95, -0.1], fov: 42 },
    { f: 1299, pos: [0.32, 1.58, 4.35], look: [0.26, 1.02, -0.05], fov: 36.5, ease: 'surge' },
  ],
};
const SHADOW_AT = { hook: [-3, 1, -1.3], intro: [0, 0.8, 0], spy: [3, 0.8, -1], hide: [3.6, 0.8, -2], fav: [0, 0.8, -1], reveal: [4, 1, -1.8], scream: [2.2, 0.9, 0], honey: [0.25, 0.9, 0] };
const BRIDGES = { reveal: 12, honey: 14 }; // intro is a continuous pull-back (its keys start on the hook cam); fav gets a hard cut (opposite ends of camp)
const DIPS = [289];
const shotCam = (id, f) => {
  if (id === 'spy') {
    const c = camFromKeys([
      { f: 289, pos: [6.4, 1.95, 6.6], look: [3.4, 0.85, -1.2], fov: 44 },
      { f: 472, pos: [5.3, 1.8, 5.2], look: [3.2, 0.85, -1.5], fov: 41, ease: 'surge' },
    ], f);
    const sp = spyPoseAt(Math.max(300, f));
    if (sp) c.look = lerp3(c.look, [sp.p[0], sp.p[1] + 1.0, sp.p[2]], 0.8); // strong tracking: the narrow vertical frame loses him otherwise
    return c;
  }
  if (id === 'fav') {
    const B = bearFavPos(f), off = kf3([[652, [0.75, 1.8, 5.1]], [766, [0.35, 1.62, 4.35]]], f);
    const lookB = [B[0], B[1] + 1.02, B[2]];
    const look = lerp3(lookB, [4.0, 1.0, -1.9], ramp(f, 745, 766) * 0.5);
    return { pos: [B[0] + off[0], off[1], B[2] + off[2]], look, fov: lerp(41, 39, ramp(f, 652, 766)), roll: 0 };
  }
  if (id === 'reveal') return camFromKeys(f < 850 ? CAMS.revealA : CAMS.revealB, f);
  return camFromKeys(CAMS[id], f);
};
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
  if (S.id === 'scream') { // camera leans onto the spy while he runs, then settles on the tableau
    const sp = spyPoseAt(f);
    if (sp && f < 1040) c.look = lerp3(c.look, [sp.p[0], sp.p[1] + 0.95, sp.p[2]], 0.5);
    const d = f - 988; // trip micro-shake
    if (d >= 0 && d < 4) { const m = 0.004 * [1, -0.62, 0.3, -0.12][d]; c.pos = [c.pos[0] + m * 0.5, c.pos[1] + m, c.pos[2]]; c.look = [c.look[0] + m * 0.8, c.look[1] + m * 1.4, c.look[2]]; }
  }
  let flash = 0;
  if (f < 9) flash = -0.95 * (1 - f / 9);
  for (const B of DIPS) { const d = f - B; if (d >= -3 && d <= 3) flash = Math.min(flash, -0.95 * Math.cos(d / 3 * Math.PI / 2)); }
  if (f >= 850 && f < 853) flash = Math.max(flash, 0.5 * (1 - (f - 850) / 3)); // reveal punch
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
    case 'hook': point = [-3.02, 1.42, -1.26]; cinf = 11; break;
    case 'intro': point = [0, 0.9, 0.2]; cinf = 3.5; break;
    case 'spy': { const sp = spyPoseAt(Math.max(300, f)); point = sp ? [sp.p[0], sp.p[1] + 1, sp.p[2]] : [3, 1, -1]; cinf = 6; break; }
    case 'hide': { const sp = spyPoseAt(f); point = sp ? [sp.p[0], sp.p[1] + 1, sp.p[2]] : [3.6, 1, -2]; cinf = 8; break; }
    case 'fav': { const B = bearFavPos(f); point = [B[0], B[1] + 1.05, B[2]]; cinf = 7; break; }
    case 'reveal': point = f < 850 ? [4.1, 1.1, -1.95] : [3.9, 1.8, -1.12]; cinf = f < 850 ? 8 : 12; break;
    case 'scream': { const sp = spyPoseAt(f); point = sp ? [sp.p[0], sp.p[1] + 0.95, sp.p[2]] : [2.2, 1, 0]; cinf = 5; break; }
    case 'honey': point = [0.25, 1.35, 0.3]; cinf = 8; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state (drives set pieces + FX in main.js worldState) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lanterns: 0, mist: 0.05, crateTip: 0, mapVis: false, mapT: 0, jarGlint: 0, starK: 1 };
  if (S.id === 'intro') { W.lanterns = 2; W.starK = 0.85; }
  if (S.id === 'spy') W.mist = 1.0;
  if (S.id === 'hide') W.mist = 0.6;
  if (S.id === 'fav') W.mist = 0.3;
  if (S.id === 'reveal') W.mist = 0.18;
  if (S.id === 'scream') {
    W.mist = 0.08;
    W.lanterns = f < 985 ? 0 : f < 1005 ? 1 : f < 1025 ? 2 : f < 1045 ? 3 : 4;
    W.crateTip = M.easeOut(ramp(f, 988, 1002));
    W.mapVis = f >= 1082; W.mapT = ramp(f, 1104, 1118);
    W.starK = 1 - ramp(f, 1040, 1126);
  }
  if (S.id === 'honey') { W.starK = 0; W.jarGlint = f < 1252 ? 0 : 0.9 * smooth(ramp(f, 1252, 1276)) + 0.05 * Math.sin(f * 0.3); } // NO idle base: a 0.3 base kept the additive glint sprite washing the jar white all shot (the "milky jar" bug)
  return W;
};
/** Campfire profile per frame (pure — main.js steps the FX sim with this). */
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'intro': return { fireRate: 24, fireScale: 1.0, smokeRate: 5 };
    case 'spy': case 'hide': return { fireRate: 5, fireScale: 0.55, smokeRate: 2.2 };
    case 'fav': case 'reveal': return { fireRate: 6, fireScale: 0.6, smokeRate: 2.6 };
    case 'scream': return { fireRate: 7, fireScale: 0.65, smokeRate: 3 };
    case 'honey': return { fireRate: 0, fireScale: 0.5, smokeRate: 1.0 };
    default: return { fireRate: 16, fireScale: 0.9, smokeRate: 5 };
  }
};

// ---------- actors (2D cards) ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RB = (T, o, pos, extra = {}) => ({ key: 'bear' + JSON.stringify(o), draw: (p) => T.bearCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RS = (T, o, pos, extra = {}) => ({ key: 'spy' + JSON.stringify(o), draw: (p) => T.romanFront(p, SPY_OUTFIT, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { night: '#c3d2ff', fire: '#d8c8ff', nightlow: '#aebfff', golden: '#ffe9c4' };
const spyActor = (T, f, tint) => {
  const sp = spyPoseAt(f); if (!sp) return null;
  return RS(T, { seed: 31, expr: sp.expr, L: sp.L, R: sp.R, blink: sp.expr === 'shock' ? 0 : blinkAt(f, 31), bob: q(breath(f, 31), 3),
    tilt: q(sp.tilt, 1), headTilt: q(sp.headTilt, 1), step: q(sp.step) }, sp.p,
    { tint, s: 0.96, yaw: sp.yaw || 0, roll: sp.roll || 0 });
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  const spy = spyActor(T, f, tint);
  switch (S.id) {
    case 'hook': {
      // asleep in his tent doorway: eyes shut, a nodding head — then the eye opens, slow grin.
      const awake = f >= 17;
      out.push(RB(T, { expr: f < 26 ? 'curious' : 'grin', stripes: 2, blink: awake ? blinkAt(f, 5) : 1, step: 0 },
        [-3.05, kf([[0, -0.012], [12, -0.02], [26, 0.002], [66, 0.002]], f) + breath(f, 5) * 0.4, -1.28],
        { tint, s: 1.06, yaw: kf([[0, 0.14], [30, 0.02], [66, 0.02]], f), roll: kf([[0, 0.05], [40, 0.012], [66, 0.012]], f) }));
      break;
    }
    case 'intro': {
      // playful wrestling at the fire (lunge / pushed back / winning shove), laughs, then
      // Wojtek ambles home and plops into his tent doorway.
      const bp = bearIntroPos(f);
      const grapple = f >= 75 && f < 195;
      const walking = f >= 228 && f < 262;
      const bRoll = f < 226
        ? kf([[67, 0], [105, -0.16, 'easeIn'], [140, 0.14], [172, -0.07, 'easeIn'], [195, 0], [226, 0]], f)
        : kf([[262, 0], [268, 0.07], [288, 0.055]], f);
      const bY = bp[1] + (f >= 262 ? kf([[262, 0], [268, -0.05, 'easeIn'], [276, -0.018], [288, -0.018]], f) : 0) + breath(f, 8) * 0.4;
      const bStep = walking ? kf([[228, 0], [262, 2.6]], f) : kf([[67, 0], [105, 0.55], [140, 0.55], [172, 1.05], [200, 1.05]], f);
      out.push(RB(T, { expr: f < 195 ? 'grin' : f < 228 ? 'proud' : 'curious', stripes: 2, wrestle: grapple ? 1 : 0, blink: f >= 282 ? 1 : blinkAt(f, 8), step: q(bStep) },
        [bp[0], bY, bp[2]], { tint, s: 1.05, roll: bRoll, yaw: walking ? -0.35 : 0 }));
      if (f < 226) { // the wrestling partner + the laughing mate stay by the fire
        out.push(R(T, 'soldier44a', { seed: 11, expr: 'laugh', L: grapple ? 'reach' : 'belly', R: grapple ? 'reach' : 'belly', blink: 0, bob: q(breath(f, 11) + laugh(f, 195, 226, 0.025), 3), tilt: q(kf([[67, 0], [110, -8], [145, -2], [180, 0], [226, 0]], f), 1), headTilt: -3 },
          [kf([[67, 0.88], [110, 1.02], [145, 0.9], [180, 0.96], [226, 0.96]], f), 0, 0.3], { tint }));
        out.push(R(T, 'soldier44c', { seed: 13, expr: 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(breath(f, 13) + laugh(f, 90, 120, 0.014) + laugh(f, 150, 226, 0.03), 3), tilt: 2, headTilt: 3 }, [-1.05, 0, -0.5], { tint }));
      }
      break;
    }
    case 'spy': case 'hide': {
      // the camp sleeps: Wojtek out cold in his doorway, soldiers inside their tents.
      out.push(RB(T, { expr: 'curious', stripes: 2, blink: 1, step: 0 }, [-3.05, -0.015 + breath(f, 5) * 0.5, -1.28], { tint, s: 1.02, roll: 0.055 }));
      if (spy) out.push(spy);
      break;
    }
    case 'fav': {
      // Wojtek wakes and ambles happily across the moonlit camp to the shower tent.
      const B = bearFavPos(f), ph = bearFavPhase(f);
      const walking = f >= 668 && f < 748;
      const bounce = walking ? Math.abs(Math.sin(ph * Math.PI * 2)) * 0.035 : 0;
      out.push(RB(T, { expr: 'grin', stripes: 2, blink: f < 658 ? 1 : blinkAt(f, 9), step: q(ph) },
        [B[0], B[1] + bounce + breath(f, 9) * 0.3, B[2]], { tint, s: 0.98, yaw: walking ? -0.3 : -0.55, roll: walking ? Math.sin(ph * Math.PI * 2) * 0.02 : 0 }));
      break;
    }
    case 'reveal': {
      // Wojtek rises from behind the shower screen, dripping and grinning.
      const riseY = kf([[767, -0.62], [812, -0.62], [850, -0.02, 'easeOut'], [961, -0.02]], f);
      out.push(RB(T, { expr: 'grin', stripes: 2, blink: (f >= 855 && f <= 905) ? 0 : blinkAt(f, 10), step: 0 },
        f < 850 ? [SHOWER_BEAR[0], riseY + breath(f, 10) * 0.3, SHOWER_BEAR[2]] : [3.9, breath(f, 10) * 0.3, -1.05],
        { tint, s: f < 850 ? 1.0 : 1.25, roll: 0.04, yaw: -0.1 })); // CU: bear steps out in front of the hut — at s>=1.25 inside it, the roof slab (y 2.06) crossed his eyes
      if (spy) out.push(spy);
      break;
    }
    case 'scream': {
      if (spy) out.push(spy);
      // soldiers pour out of their tents and close in
      const pour = (f0, from, to) => { const t = clamp((f - f0) / 42); return { p: lerp3(from, to, M.easeInOut(t)), step: t > 0 && t < 1 ? kf([[f0, 0], [f0 + 42, 3.2]], f) : 0, run: t }; };
      const A = pour(1000, [3.5, 0, -3.2], [1.15, 0, 0.75]);
      const B = pour(1012, [-0.7, 0, -5.8], [3.3, 0, 0.85]);
      const C = pour(1024, [5.3, 0, -0.7], [3.15, 0, 1.15]);
      if (f >= 1000) out.push(R(T, 'soldier44a', { seed: 11, expr: f >= 1060 ? 'grin' : 'stern', L: 'hang', R: f >= 1082 ? 'belly' : 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11) + laugh(f, 1090, 1130, 0.02), 3), tilt: 0, headTilt: q(clamp((2.2 - A.p[0]) * 4, -6, 6), 1), step: q(A.step) }, A.p, { tint }));
      if (f >= 1012) out.push(R(T, 'soldier44b', { seed: 12, expr: 'stern', L: 'hip', R: 'hang', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), tilt: 0, headTilt: q(clamp((2.2 - B.p[0]) * 4, -6, 6), 1), step: q(B.step) }, B.p, { tint }));
      if (f >= 1024) out.push(R(T, 'soldier44c', { seed: 13, expr: f >= 1060 ? 'laugh' : 'smile', L: 'belly', R: 'belly', blink: 0, bob: q(breath(f, 13) + laugh(f, 1060, 1130, 0.026), 3), tilt: 0, headTilt: 3, step: q(C.step) }, C.p, { tint }));
      // Wojtek watches from the shower, delighted
      out.push(RB(T, { expr: f >= 1050 ? 'proud' : 'grin', stripes: 2, blink: blinkAt(f, 10), step: 0 },
        [SHOWER_BEAR[0], breath(f, 10) * 0.3, SHOWER_BEAR[2]], { tint, s: 1.0, yaw: q(clamp(((spyPoseAt(f) || { p: [3.95] }).p[0] - 3.95), -0.3, 0.3) * 0.4, 2), roll: 0.03 }));
      break;
    }
    case 'honey': {
      // golden morning: double scoop of honey, mates laughing around him.
      const dip = kf([[1154, 0], [1188, 0], [1196, -0.055, 'easeIn'], [1206, 0], [1232, 0], [1240, -0.055, 'easeIn'], [1250, 0], [1299, 0]], f);
      out.push(RB(T, { expr: f < 1180 ? 'proud' : 'grin', stripes: 2, blink: (f >= 1258 && f <= 1272) ? 1 : blinkAt(f, 16), step: 0 },
        [0.25, dip + breath(f, 16) * 0.4, 0.35], { tint, s: 1.03, roll: dip * -0.5, yaw: 0 }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(breath(f, 11) + laugh(f, 1160, 1299, 0.024), 3), tilt: 2, headTilt: -4 }, [-0.85, 0, 0.1], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(breath(f, 13) + laugh(f, 1180, 1299, 0.028), 3), tilt: 2, headTilt: 4 }, [1.35, 0, 0.05], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'smile', L: 'hang', R: 'belly', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), tilt: 0, headTilt: -2 }, [-0.25, 0, -1.5], { tint }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'spy' || S.id === 'hide' || (S.id === 'intro' && f >= 266)) {
    // Zzz over the sleeping bear and the soldiers' tent
    for (const [i, pos] of [[0, [-2.85, 1.9, -1.35]], [1, [3.75, 1.75, -3.6]]]) {
      const t = q(((f / 46) + i * 0.37) % 1, 2);
      out.push(FXC('z' + i + '_' + t, (p) => T.fxZ(p, t), pos, 0.42));
    }
  }
  if (S.id === 'reveal' && f >= 852 && f <= 938) {
    // water dripping off the bear
    const k = (f >> 3) % 2;
    out.push(FXC('drip' + k + '_' + (f >> 3), (p) => T.fxDrip(p), [k ? 4.08 : 3.72, 1.15, -1.0], 0.18)); // flanking the stepped-out bear's face in the CU
  }
  if (S.id === 'scream' && f >= 988 && f < 1000) {
    const t = q((f - 988) / 12, 2);
    out.push(FXC('tdust' + t, (p) => T.fxDust(p, t, '#cbb894'), [2.25, 0.25, -0.4], 0.3));
  }
  if (S.id === 'honey' && f >= 1252) {
    const t = q((f - 1252) / 47, 2);
    // (no star card: the jar's final glint is the 3D FX.glint sprite on jarG, driven by worldAt.jarGlint f1252-1276)
  }
  return out;
};
