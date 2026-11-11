// Story data for "Félicette — The First Cat in Space" — timed to felicette-voice
// (59.55 s, 30 fps, TOTAL 1786). True story: Paris stray, CERMA lab, Véronique
// AGI 47, Hammaguir (Algerian Sahara), 18 Oct 1963 — peak 157 km, recovered alive.
// Phrases: P1 0-131 hook | P2 176-304 paris | P3 341-490 chosen | P4 554-687
// training | P5 720-901 desert | P6 948-1064 launch | P7 1115-1221 100km |
// P8 1272-1419 weightless | P9 1458-1589 return | P10 1634-1763 finale.
// SHOTS are CONTIGUOUS 0..1785 (gaps belong to the outgoing section).
// World (built in main.js): desert pad at origin (rocket (0,0,-8), gantry
// (3.6,0,-8)); Paris alley at (44,0,-2); lab at (84,0,-4); training room at
// (118,0,-4) (spin rig (118,0,-6)); orbit capsule (0,100,150), Earth centre
// (0,30,230) r=85; capsule interior wall z=150.6, window (-1.2,101.3);
// return capsule descends over (0,~,-1) toward the pad apron.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30, TOTAL = 1786, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 175, light: 'night' },
  { id: 'paris', a: 176, b: 340, light: 'dawn' },
  { id: 'chosen', a: 341, b: 553, light: 'room' },
  { id: 'training', a: 554, b: 719, light: 'room' },
  { id: 'desert', a: 720, b: 947, light: 'desertdawn' },
  { id: 'launch', a: 948, b: 1114, light: 'desertdawn' },
  { id: 'space100', a: 1115, b: 1271, light: 'space' },
  { id: 'weightless', a: 1272, b: 1457, light: 'space' },
  { id: 'return', a: 1458, b: 1633, light: 'day' },
  { id: 'finale', a: 1634, b: 1785, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#16222e', waterShal: '#24384a', glint: '#cfe0ff' };
export const LIGHTS = {
  night: { az: 215, el: 26, sky: '#26334f', ground: '#171a24', hemi: 0.8, sun: '#b9ccff', sunI: 1.25, fog: '#1c2740', fogNear: 26, fogFar: 280,
    skyTop: '#070d1f', skyHor: '#2c3c5e', sunDisc: '#e8eeff', sunSize: 0.0028, sat: 1.03, vig: 0.3, shadowExt: 16, aurora: 0, ...WATER },
  dawn: { az: 95, el: 14, sky: '#8d9cc0', ground: '#4a4250', hemi: 1.0, sun: '#ffc37e', sunI: 2.1, fog: '#c8a58a', fogNear: 34, fogFar: 300,
    skyTop: '#4a6394', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0034, sat: 1.05, vig: 0.27, shadowExt: 20, aurora: 0, ...WATER },
  room: { az: 120, el: 40, sky: '#6a6f7d', ground: '#3a3230', hemi: 1.08, sun: '#ffd9a8', sunI: 1.5, fog: '#4c443c', fogNear: 16, fogFar: 140,
    skyTop: '#3d4250', skyHor: '#8a7a68', sunDisc: '#ffe9c4', sunSize: 0.003, sat: 1.02, vig: 0.34, shadowExt: 10, aurora: 0, ...WATER },
  desertdawn: { az: 100, el: 16, sky: '#93a7c8', ground: '#6a5638', hemi: 1.02, sun: '#ffc98a', sunI: 2.3, fog: '#d9b98c', fogNear: 40, fogFar: 340,
    skyTop: '#54719f', skyHor: '#ffdfae', sunDisc: '#fff3cf', sunSize: 0.0034, sat: 1.06, vig: 0.25, shadowExt: 26, aurora: 0, ...WATER },
  day: { az: 130, el: 44, sky: '#aebfe0', ground: '#7a6742', hemi: 1.15, sun: '#fff1d6', sunI: 2.0, fog: '#d8c9a4', fogNear: 48, fogFar: 360,
    skyTop: '#6f97cc', skyHor: '#f2e7c8', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.04, vig: 0.22, shadowExt: 22, aurora: 0, ...WATER },
  space: { az: 268, el: 34, sky: '#0a1024', ground: '#05070f', hemi: 0.5, sun: '#ffffff', sunI: 2.4, fog: '#04060d', fogNear: 130, fogFar: 950,
    skyTop: '#01020a', skyHor: '#0d1836', sunDisc: '#ffffff', sunSize: 0.0022, sat: 1.0, vig: 0.3, shadowExt: 30, aurora: 0, ...WATER },
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
  if (S.id === 'space100') return blendLight(LIGHTS.day, LIGHTS.space, smooth(ramp(f, 1130, 1260)));
  if (S.id === 'launch') return blendLight(LIGHTS.desertdawn, LIGHTS.day, smooth(ramp(f, 1020, 1114)));
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
export const IGNITION_F = 958; // "Fire, smoke..." — P6 opens f948; fire starts f958
export const rocketYAt = (f) => {
  if (f < 960) return 0;
  if (f <= 1114) return Math.pow(ramp(f, 960, 1114), 1.3) * 40; // accelerating climb the ground camera can track
  return 40 + Math.pow(ramp(f, 1114, 1271), 1.15) * 26; // keeps rising (monotonic) into the space beat
};
/** Mission altitude in km: 0 on the pad, crosses 100 inside P7, peaks at
 *  exactly 157 through the weightless beat, then the capsule descends. */
export const altitudeAt = (f) => Math.round(kf([
  [0, 0], [958, 0], [1115, 42], [1180, 101], [1221, 128], [1272, 157],
  [1457, 157], [1600, 0], [1785, 0],
], f) * 10) / 10;
/** Returning capsule height over the desert apron (P9 only). */
export const capsuleYAt = (f) => {
  if (f < 1458) return 30;
  if (f > 1605) return 1.15;
  return lerp(30, 1.15, M.smooth(ramp(f, 1458, 1605)));
};
export const parisCatZ = (f) => kf([[176, 5.2], [304, -0.6], [340, -0.6]], f);
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

export const heroPosAt = (f) => { // Félicette's card position (sweep + breath puffs)
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return [1.9, 0, -4.2];
    case 'paris': return [44, 0, parisCatZ(f)];
    case 'chosen': return [84, 0.51, -1.6];
    case 'training':
      if (f < 610) return [115.6, 0, -3.4];
      if (f < 672) return [118, 0.46, -6];
      return [116.2, 0, -3.1];
    case 'desert': return [1.2, 0.52, -5.8];
    case 'weightless': return [0.8, 100.55, 147];
    case 'finale': return [1.35, 0.62, -3.4];
    default: return null;
  }
};

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [7.6, 2.1, 6.8], look: [0.8, 2.6, -6.8], fov: 44 },
    { f: 90, pos: [5.2, 1.6, 3.2], look: [1.6, 1.0, -5.0], fov: 41, ease: 'surge' },
    { f: 175, pos: [4.1, 1.25, 1.2], look: [1.9, 0.72, -4.2], fov: 38 },
  ],
  paris: [
    { f: 176, pos: [44, 1.7, 12.5], look: [44, 0.9, 4.2], fov: 42 },
    { f: 262, pos: [43.4, 1.35, 7.6], look: [44, 0.72, 1.6], fov: 40, ease: 'surge' },
    { f: 340, pos: [43.2, 1.2, 5.2], look: [44, 0.68, -0.4], fov: 39 },
  ],
  chosen: [
    { f: 341, pos: [84, 1.6, 5.6], look: [84, 0.95, -2.2], fov: 44 },
    { f: 450, pos: [84.6, 1.42, 4.2], look: [84.1, 0.9, -1.9], fov: 42, ease: 'surge' },
    { f: 553, pos: [84.8, 1.38, 3.8], look: [84.1, 0.92, -1.8], fov: 41 },
  ],
  training: [
    { f: 554, pos: [112.4, 1.5, 1.8], look: [116.4, 0.9, -4.6], fov: 44 },
    { f: 616, pos: [113.4, 1.5, 1.2], look: [117.6, 0.95, -5.6], fov: 43, ease: 'surge' },
    { f: 672, pos: [113.6, 1.5, 1.2], look: [117.8, 0.95, -5.7], fov: 43 },
    { f: 719, pos: [114.6, 1.42, 1.8], look: [116.4, 0.85, -3.3], fov: 42, ease: 'surge' },
  ],
  desert: [
    { f: 720, pos: [11.5, 2.9, 11], look: [0, 4.6, -8], fov: 43 },
    { f: 830, pos: [8.2, 2.2, 7.4], look: [0.8, 3.2, -7.2], fov: 42, ease: 'surge' },
    { f: 947, pos: [6.4, 1.8, 5.2], look: [1.6, 1.6, -6.2], fov: 41 },
  ],
  launch: [
    { f: 948, pos: [6.6, 1.9, 5.6], look: [0.6, 2.2, -7.6], fov: 42 },
    { f: 1010, pos: [7.4, 2.4, 6.4], look: [0.2, 7.5, -7.9], fov: 42, ease: 'surge' },
    { f: 1064, pos: [8.2, 3.2, 7.2], look: [0, 19, -8], fov: 43, ease: 'surge' },
    { f: 1114, pos: [8.8, 3.8, 7.8], look: [0, 33, -8], fov: 44 },
  ],
  space100: [
    { f: 1115, pos: [7.2, 103.2, 137.8], look: [0, 97.6, 150.5], fov: 44 },
    { f: 1190, pos: [6.2, 102.5, 136.8], look: [-0.2, 97.2, 151.2], fov: 43, ease: 'surge' },
    { f: 1271, pos: [5.4, 102, 136.1], look: [-0.4, 97, 151.8], fov: 42 },
  ],
  weightless: [
    { f: 1272, pos: [1.7, 101.0, 141.3], look: [-0.3, 100.9, 149], fov: 36 },
    { f: 1360, pos: [1.62, 100.97, 141.45], look: [-0.28, 100.9, 149], fov: 35, ease: 'surge' },
    { f: 1457, pos: [1.52, 100.92, 141.6], look: [-0.25, 100.87, 149], fov: 34.5 },
  ],
  return: [
    { f: 1458, pos: [10.5, 2.6, 12.5], look: [0, 19, -1], fov: 43 },
    { f: 1540, pos: [9.6, 2.3, 11.6], look: [0, 12, -1], fov: 42, ease: 'surge' },
    { f: 1633, pos: [8.8, 2.0, 10.6], look: [0, 2.6, -1.2], fov: 41 },
  ],
  finale: [
    { f: 1634, pos: [8.4, 1.9, 10.2], look: [0.4, 1.8, -2.6], fov: 41 },
    { f: 1710, pos: [7.2, 1.7, 8.6], look: [0.9, 1.3, -3.2], fov: 40, ease: 'surge' },
    { f: 1785, pos: [9.8, 2.6, 12.8], look: [0.4, 1.6, -3.4], fov: 42, ease: 'surge' },
  ],
};
const SHADOW_AT = { hook: [0, 1, -6], paris: [44, 0.5, 1], chosen: [84, 0.5, -2], training: [117, 0.5, -4.5], desert: [0, 3, -8], launch: [0, 4, -8], space100: [0, 100, 150], weightless: [0, 100.5, 147], return: [0, 2, -1], finale: [0, 1, -3] };
const BRIDGES = { finale: 14 }; // only same-set enters blend; location jumps dip (laika rule)
const DIPS = [341, 554, 720, 1115, 1272, 1458];
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
  if (S.id === 'launch' && f >= IGNITION_F) { // liftoff rumble, fading as she climbs
    const amp = 0.03 * (1 - ramp(f, IGNITION_F, 1040));
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
    case 'hook': point = [1.9, 0.7, -4.2]; cinf = 9; break;
    case 'paris': point = [44, 0.6, parisCatZ(f)]; cinf = 9; break;
    case 'chosen': point = [84, 0.85, -1.8]; cinf = 7; break;
    case 'training': point = [117, 0.9, -4.8]; cinf = 7; break;
    case 'desert': point = [0.8, 3, -7.5]; cinf = 5; break;
    case 'launch': point = [0, 8 + rocketYAt(f) * 0.72, -8]; cinf = 4; break;
    case 'space100': point = [0, 98, 150]; cinf = 0.9; break;
    case 'weightless': point = [0.6, 100.8, 147.5]; cinf = 2.2; break;
    case 'return': point = [0, capsuleYAt(f) + 1, -1]; cinf = 5; break;
    case 'finale': point = [1, 1.2, -3.4]; cinf = 7; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, lanternSet: [], mist: 0.05, dustK: 0, windK: 0.4, starK: 0, winGlow: 0, earthK: 0, sparkleK: 0, breathK: 0 };
  switch (S.id) {
    case 'hook': W.starK = 1; W.windK = 0.5; W.dustK = 0.25; W.mist = 0.06; break;
    case 'paris': W.starK = 0.15; W.winGlow = 0.7; W.windK = 0.4; W.mist = 0.1; break;
    case 'chosen': W.winGlow = 0.5; W.windK = 0.05; break;
    case 'training': W.winGlow = 0.4; W.windK = 0.05; break;
    case 'desert': W.windK = 0.6; W.dustK = 0.4; W.mist = 0.05; break;
    case 'launch': W.windK = 0.7; W.dustK = 0.5 * (1 - ramp(f, 960, 1080)) + 0.15; break;
    case 'space100': W.starK = 1; W.sparkleK = 0.8; W.earthK = 1; W.windK = 0; break;
    case 'weightless': W.starK = 0.9; W.sparkleK = smooth(ramp(f, 1272, 1330)); W.earthK = 1; break;
    case 'return': W.windK = 0.5; W.dustK = 0.3 + 0.7 * ramp(f, 1520, 1605); break;
    case 'finale': W.windK = 0.35; W.dustK = 0.25; break;
  }
  return W;
};
/** Rocket fire + pad smoke/dust profile per frame (pure). */
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return { fireRate: 0, fireScale: 0.6, smokeRate: 0.7 }; // pad vent wisps under the stars
    case 'desert': return { fireRate: 0, fireScale: 0.6, smokeRate: 0.9 };
    case 'launch': {
      const on = f >= IGNITION_F && f < 1030;
      return { fireRate: on ? 46 : 0, fireScale: on ? 2.6 : 0.6, smokeRate: f >= IGNITION_F ? 26 : 0.9 };
    }
    case 'return': return { fireRate: 0, fireScale: 0.5, smokeRate: f > 1560 ? 7 : 0 }; // landing dust ring
    case 'finale': return { fireRate: 0, fireScale: 0.5, smokeRate: 1.2 };
    default: return { fireRate: 0, fireScale: 0.5, smokeRate: 0 };
  }
};

// ---------- actors (2D cards) ----------
const SCI = 'scientist', SCI_B = 'scientistB', ENG = 'engineer41';
const R = (T, who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'obj') + JSON.stringify(o) + JSON.stringify(who), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RC = (T, o, pos, extra = {}) => ({ key: 'felicette' + JSON.stringify(o), draw: (p) => T.felicetteCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RP = (T, o, pos, extra = {}) => ({ key: 'pigeon' + JSON.stringify(o), draw: (p) => T.pigeonCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { night: '#c3d2ff', dawn: '#ffe9c4', room: '#ffe4c4', desertdawn: '#ffe9c4', day: '#ffffff', space: '#dfe8ff' };
const tintFor = (S) => TINT[S.light] || '#ffffff';

const TEAM = [ // desert team cards (desert/launch/return/finale): x, z, outfit, expr, seed
  [-3.4, -3.0, SCI, 'smile', 12], [-1.8, -1.2, ENG, 'grin', 31], [3.9, -2.6, SCI_B, 'neutral', 21],
  [5.2, -0.8, SCI, 'grin', 17], [-4.8, -0.6, SCI_B, 'smile', 27],
];
const teamCards = (T, f, tint, cheer, list = TEAM) => list.map(([x, z, who, expr, seed], i) => R(T, who,
  { seed, expr: cheer ? (i % 2 ? 'laugh' : 'grin') : expr, L: cheer || i % 3 === 0 ? 'wave' : 'hang', R: cheer ? 'up' : (i % 4 === 1 ? 'point' : 'hang'),
    wv: q(f * 0.3 + i, 1), blink: blinkAt(f, seed), bob: q(breath(f, seed), 3), headTilt: (i % 5) - 2 },
  [x, 0, z], { tint, s: 0.98 + (i % 3) * 0.03 }));

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S);
  switch (S.id) {
    case 'hook': { // THE cat, front and centre beside the rocket — frame 1 is the hook
      out.push(RC(T, { view: 'front', expr: 'smile', earsUp: 1, wag: 0.6, wagPh: q((f * 0.04) % 1, 2), blink: blinkAt(f, 7) },
        [1.9, breath(f, 3) * 0.5, -4.2], { tint, s: 0.92 }));
      out.push(R(T, SCI, { seed: 12, expr: 'neutral', L: 'belly', R: 'belly', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3) },
        [-2.6, 0, -3.2], { tint, s: 1.0, yaw: 0.3 }));
      break;
    }
    case 'paris': {
      const z = parisCatZ(f);
      out.push(RC(T, { view: 'side', step: q((f * 0.07) % 1, 2), expr: 'neutral', earsUp: 0.9, wag: 0.4, blink: blinkAt(f, 7) },
        [44, 0, z], { tint, s: 0.66 }));
      // pigeons: pecking, then scatter up as she passes (f>=252)
      for (let i = 0; i < 3; i++) {
        const fly = Math.max(0, (f - 252 - i * 7) / 26);
        out.push(RP(T, { seed: i + 2, fly: q(Math.min(1, fly), 2), flap: q((f * 0.3 + i) % 1, 2) },
          [42.9 + i * 0.75, fly * fly * 2.6, 1.9 - i * 0.5 - fly * 1.4], { tint, s: 0.34, blob: fly > 0.1 ? false : undefined, shadow: fly <= 0.1 }));
      }
      break;
    }
    case 'chosen': { // the row of fourteen (five cards read the row) — Félicette centre, chosen
      const variants = [
        { fur: '#c07a35', mark: '#f3e2c8', tabby: 1 }, { fur: '#7d838c', mark: '#c9ced4' },
        null, // Félicette herself
        { fur: '#f2efe8', mark: '#f2efe8' }, { fur: '#3a363e', mark: '#3a363e' },
      ];
      variants.forEach((v, i) => {
        const x = 81.8 + i * 1.1;
        if (!v) out.push(RC(T, { view: 'front', expr: 'smile', earsUp: 1, wag: 0.8, wagPh: q((f * 0.05) % 1, 2), blink: blinkAt(f, 7) },
          [84, 0.51 + breath(f, 3) * 0.5, -1.6], { tint, s: 0.68, ground: 0.51 }));
        else out.push(RC(T, { view: 'front', expr: i % 2 ? 'neutral' : 'nervous', earsUp: 0.8, wag: 0.25, fur: v.fur, mark: v.mark, tabby: v.tabby || 0, blink: blinkAt(f, 20 + i) },
          [x, 0.51, -1.7], { tint, s: 0.62, ground: 0.51 }));
      });
      out.push(R(T, SCI, { seed: 12, expr: 'smile', L: 'hang', R: 'point', blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: -3 },
        [85.9, 0, -3.1], { tint, s: 1.0, yaw: -0.35 }));
      out.push(R(T, SCI_B, { seed: 21, expr: 'grin', L: 'belly', R: 'belly', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), headTilt: 2 },
        [82.2, 0, -3.4], { tint, s: 0.98, yaw: 0.3 }));
      break;
    }
    case 'training': {
      out.push(R(T, SCI, { seed: 12, expr: f >= 672 ? 'smile' : 'stern', L: 'hang', R: f >= 672 ? 'reach' : 'point', lift: 0.12,
        blink: blinkAt(f, 12), bob: q(breath(f, 12), 3), headTilt: -2 },
        f >= 672 ? [115.2, 0, -2.2] : [115.4, 0, -3.6], { tint, s: 1.0, yaw: 0.45 }));
      out.push(R(T, ENG, { seed: 31, expr: 'neutral', L: 'belly', R: 'belly', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) },
        [120.6, 0, -3.8], { tint, s: 0.97, yaw: -0.3 }));
      if (f < 610) { // calm at the capsule rig
        out.push(RC(T, { view: 'front', expr: 'neutral', earsUp: 1, wag: 0.25, blink: blinkAt(f, 7) },
          [115.6, 0, -3.4], { tint, s: 0.64 }));
      } else if (f < 672) { // spinning — calm inside the whirling capsule chair
        out.push(RC(T, { view: 'front', expr: 'stubborn', earsUp: 0.9, wag: 0.1, blink: blinkAt(f, 7), harness: 1 },
          [118, 0.46, -6], { tint, s: 0.6, ground: 0.46, roll: q(Math.sin(f * 0.06) * 0.04, 3) }));
      } else { // treats after — brave and pleased
        out.push(RC(T, { view: 'front', expr: 'lick', earsUp: 1, wag: 1, wagPh: q((f * 0.06) % 1, 2), blink: blinkAt(f, 7) },
          [116.2, breath(f, 3) * 0.5, -3.1], { tint, s: 0.64 }));
      }
      break;
    }
    case 'desert': { // Félicette carried in her capsule box toward the rocket
      out.push(...teamCards(T, f, tint, false));
      out.push(RC(T, { view: 'front', expr: 'nervous', earsUp: 1, wag: 0.3, harness: 1, blink: blinkAt(f, 7) },
        [1.2, 0.52, -5.8], { tint, s: 0.7, ground: 0.52, blob: false, shadow: false }));
      break;
    }
    case 'launch': {
      out.push(...teamCards(T, f, tint, f >= IGNITION_F, TEAM.slice(1, 4)));
      if (f >= 940) { // her face at the capsule window, riding the climb
        out.push(RC(T, { view: 'front', expr: f >= IGNITION_F ? 'shock' : 'nervous', earsUp: 1, wag: 0, harness: 1, blink: blinkAt(f, 7) },
          [0, 7.6 + rocketYAt(f), -7.12], { tint, s: 0.4, blob: false, shadow: false }));
      }
      break;
    }
    case 'space100': { // her face at the capsule window as the counter climbs
      out.push(RC(T, { view: 'front', expr: 'shock', earsUp: 1, wag: 0.1, harness: 1, blink: blinkAt(f, 7) },
        [0, 100.1, 148.7], { tint: '#ffe9d2', s: 0.62, blob: false, shadow: false }));
      break;
    }
    case 'weightless': { // FLOATING inside the capsule — slow playful tumble
      const fy = 100.55 + Math.sin(f * 0.045) * 0.07, roll = Math.sin(f * 0.028) * 0.09;
      out.push(RC(T, { view: 'front', expr: 'grin', earsUp: 1, wag: 0.5, wagPh: q((f * 0.02) % 1, 2), harness: 1, float: 1, blink: blinkAt(f, 7) },
        [0.8, q(fy, 3), 147], { tint: '#ffe9d2', s: 0.85, roll: q(roll, 3), blob: false, shadow: false }));
      break;
    }
    case 'return': { // her face at the descending capsule's window
      out.push(...teamCards(T, f, tint, f > 1560));
      out.push(RC(T, { view: 'front', expr: 'relief', earsUp: 0.9, wag: 0.3, harness: 1, blink: blinkAt(f, 7) },
        [0, capsuleYAt(f) + 0.55, -0.02], { tint, s: 0.44, blob: false, shadow: false }));
      break;
    }
    case 'finale': { // lifted out safe, grinning team around her
      out.push(...teamCards(T, f, tint, true));
      out.push(RC(T, { view: 'front', expr: 'grin', earsUp: 1, wag: 1, wagPh: q((f * 0.06) % 1, 2), harness: 1, blink: blinkAt(f, 7) },
        [1.35, 0.62, -3.4], { tint, s: 0.72, ground: 0.62, blob: false, shadow: false }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards): boards + sparkles ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'chosen' && f >= 430) { // the number board lands as the voice names it
    out.push(FXC('c341', (p) => T.boardCard(p, ['C 341'], '#ffd23e'), [84.9, 0.55, -4.6], 1.05));
  }
  if (S.id === 'space100' || S.id === 'weightless') { // in-world altitude counter board
    const alt = Math.round(altitudeAt(f));
    out.push(FXC('alt' + alt, (p) => T.boardCard(p, ['ALTITUDE', alt + ' KM'], '#7ab5ff'), [1.8, 100.5, 148.5], 1.5));
    for (let i = 0; i < 2; i++) { // zero-g sparkles drifting past
      const t = q(((f / 130) + i * 0.47 + 0.13) % 1, 2);
      const base = S.id === 'space100' ? [3.5 - i * 6.5, 102.6 - i * 3.4, 146] : [2.6 - i * 4.6, 101.9 - i * 1.4, 146.2];
      out.push(FXC('spk' + i + '_' + t, (p) => T.fxStars(p, t), base, 0.34));
    }
  }
  if (S.id === 'space100') { // the glowing line where space begins, crossed mid-P7
    out.push(FXC('band100', (p) => T.boardCard(p, ['100 KM', 'SPACE BEGINS'], '#8affd8'), [2.6, 97.8, 148.5], 1.6));
  }
  if (S.id === 'finale' && f >= 1690) { // the ending board grows out of the scene
    out.push(FXC('onlycat', (p) => T.boardCard(p, ['THE ONLY CAT', 'IN SPACE'], '#ffd23e'), [-5.6, 0.7, -7.6], 1.9));
  }
  if (S.id === 'return' && f > 1560) { // dust puffs kicked up on approach
    for (let i = 0; i < 2; i++) {
      const t = q(((f - 1560) / 60 + i * 0.5) % 1, 2);
      out.push(FXC('dust' + i + '_' + t, (p) => T.fxDust(p, t, '#e3cf9f'), [-1.6 + i * 3.2, 0.1, -0.6], 1.1));
    }
  }
  return out;
};
