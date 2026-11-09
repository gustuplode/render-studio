// Shot plan for "Mirror Bear — The Horse Race Trick" (Bear-v2 engine + cast).
// SAME reference audio as the Mirror Horse demo (64.07 s, 30 fps, TOTAL 1922),
// SAME Camera-Bible beats, but the Bear line's characters (Wojtek the bear hero,
// soldier bettors, officer clerk) and its painted 3D toon world.
// Zones: track x~0 | hill x~30 | betting room x~60 (office set) | street x~90.
import { M, camFromKeys, idle, blinkAt, walk, q, clamp, lerp, lerp3, ramp } from './motion.js';
import { horseCard, cartCard } from './horse.js';

export const FPS = 30, TOTAL = 1922, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 51, light: 'day' },
  { id: 'roomwide', a: 52, b: 168, light: 'day' },
  { id: 'pushin', a: 169, b: 309, light: 'day' },
  { id: 'question', a: 310, b: 381, light: 'day' },
  { id: 'hill', a: 382, b: 549, light: 'day' },
  { id: 'pov', a: 550, b: 590, light: 'day' },
  { id: 'tally', a: 591, b: 645, light: 'day' },
  { id: 'roombet', a: 646, b: 720, light: 'day' },
  { id: 'taunt', a: 721, b: 819, light: 'day' },
  { id: 'race', a: 820, b: 960, light: 'golden' },
  { id: 'parking', a: 961, b: 1044, light: 'golden' },
  { id: 'flash', a: 1045, b: 1110, light: 'day' },
  { id: 'betwalk', a: 1111, b: 1170, light: 'day' },
  { id: 'clerk', a: 1171, b: 1290, light: 'golden' },
  { id: 'milkcart', a: 1291, b: 1395, light: 'dusk' },
  { id: 'telegraph', a: 1396, b: 1575, light: 'night' },
  { id: 'steal', a: 1576, b: 1722, light: 'dusk' },
  { id: 'finale', a: 1723, b: 1921, light: 'night' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;

const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 240, skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 16, ...WATER },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 40, fogFar: 220, skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', vig: 0.26, shadowExt: 16, ...WATER },
  night: { az: 60, el: 38, sky: '#33456b', ground: '#1c1a20', hemi: 0.95, sun: '#aebfff', sunI: 1.15, fog: '#232c40', fogNear: 16, fogFar: 95, skyTop: '#131c30', skyHor: '#2c3a55', sat: 1.03, vig: 0.3, shadowExt: 9, waterDeep: '#1c2c3c', waterShal: '#2c445c', glint: '#cfe0ff' },
  dusk: { az: 30, el: 20, sky: '#8d8578', ground: '#4c4438', hemi: 0.95, sun: '#ffb46c', sunI: 2.0, fog: '#9a8a76', fogNear: 30, fogFar: 160, skyTop: '#5c5648', skyHor: '#d9a06a', sunDisc: '#ffe9c0', sunSize: 0.003, sat: 1.04, vig: 0.3, shadowExt: 14, waterDeep: '#2c445c', waterShal: '#3a5a74', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- cameras (multi-key, shaped easing — Bear v2 standard) ----------
const CAMS = {
  hook: [
    { f: 0, pos: [-2.7, 1.55, 5.3], look: [-0.7, 1.1, 0.2], fov: 41 },
    { f: 30, pos: [-2.0, 1.45, 4.3], look: [-0.7, 1.12, 0.2], fov: 38, ease: 'surge' },
    { f: 51, pos: [-1.7, 1.42, 3.9], look: [-0.68, 1.12, 0.2], fov: 37, ease: 'surge' },
  ],
  roomwide: [
    { f: 52, pos: [56.6, 1.95, 6.6], look: [59.9, 1.0, 0.4], fov: 46 },
    { f: 168, pos: [57.5, 1.8, 5.3], look: [59.9, 1.02, 0.8], fov: 43, ease: 'surge' },
  ],
  pushin: [ // THE unbroken push-in: group -> bear's face, no cut
    { f: 169, pos: [57.5, 1.8, 5.3], look: [59.9, 1.02, 0.8], fov: 43 },
    { f: 240, pos: [58.7, 1.6, 3.9], look: [59.9, 1.08, 1.05], fov: 38, ease: 'surge' },
    { f: 309, pos: [59.5, 1.45, 2.45], look: [59.92, 1.14, 1.12], fov: 33, ease: 'surge' },
  ],
  question: [ // two-shot, then dive INTO the hand mirror (portal)
    { f: 310, pos: [58.6, 1.6, 4.1], look: [59.6, 1.05, 1.1], fov: 40 },
    { f: 345, pos: [59.2, 1.35, 3.0], look: [60.1, 0.85, 1.2], fov: 34, ease: 'surge' },
    { f: 381, pos: [60.05, 0.78, 1.95], look: [60.38, 0.55, 1.26], fov: 24, ease: 'easeIn' },
  ],
  hill: [ // crane down the hill to the buddy + giant mirror
    { f: 382, pos: [25.0, 5.4, 9.8], look: [30.6, 1.0, -1.2], fov: 45 },
    { f: 470, pos: [27.0, 2.8, 6.4], look: [30.8, 1.18, -1.2], fov: 42, ease: 'surge', path: [[26.0, 4.2, 8.2]] },
    { f: 549, pos: [28.7, 1.9, 4.7], look: [31.0, 1.22, -1.15], fov: 39, ease: 'surge' },
  ],
  pov: [ // the buddy's long view of the track: tight telephoto
    { f: 550, pos: [29.2, 2.3, 2.6], look: [5.5, 0.9, -2.2], fov: 11 },
    { f: 590, pos: [29.2, 2.3, 2.6], look: [7.5, 0.9, -2.2], fov: 11 },
  ],
  tally: [
    { f: 591, pos: [29.0, 1.75, 4.6], look: [31.5, 1.1, -0.8], fov: 40 },
    { f: 645, pos: [29.7, 1.65, 3.9], look: [31.6, 1.08, -0.8], fov: 38, ease: 'surge' },
  ],
  roombet: [
    { f: 646, pos: [57.0, 1.85, 5.8], look: [58.7, 0.95, 0.5], fov: 44 },
    { f: 720, pos: [57.9, 1.72, 4.9], look: [58.8, 0.98, 0.55], fov: 41, ease: 'surge' },
  ],
  taunt: [
    { f: 721, pos: [58.0, 1.62, 4.9], look: [59.5, 1.05, 1.13], fov: 44 },
    { f: 819, pos: [58.6, 1.56, 4.1], look: [59.55, 1.06, 1.14], fov: 41, ease: 'surge' },
  ],
  race: [ // tracking: camera rides with the favourite
    { f: 820, pos: [-4.2, 1.65, 4.9], look: [-3.2, 0.95, -1.4], fov: 42 },
    { f: 960, pos: [3.6, 1.6, 4.9], look: [4.6, 0.95, -1.4], fov: 42, ease: 'easeInOut' },
  ],
  parking: [ // long pull toward hopeless horse 9, far away
    { f: 961, pos: [3.2, 1.75, 6.4], look: [7.4, 0.8, -2.7], fov: 40 },
    { f: 1044, pos: [5.4, 1.5, 4.7], look: [7.7, 0.82, -2.75], fov: 32, ease: 'surge' },
  ],
  flash: [
    { f: 1045, pos: [58.1, 1.62, 4.9], look: [59.5, 1.05, 1.13], fov: 44 },
    { f: 1110, pos: [58.7, 1.56, 4.1], look: [59.55, 1.08, 1.14], fov: 41, ease: 'surge' },
  ],
  betwalk: [
    { f: 1111, pos: [57.4, 1.6, 3.9], look: [58.5, 1.05, 0.9], fov: 40 },
    { f: 1170, pos: [59.2, 1.58, 3.7], look: [60.3, 1.05, 0.4], fov: 39, ease: 'easeInOut' },
  ],
  clerk: [
    { f: 1171, pos: [59.9, 1.55, 1.7], look: [61.2, 1.2, -1.8], fov: 38 },
    { f: 1290, pos: [60.45, 1.48, 0.95], look: [61.32, 1.24, -1.85], fov: 31, ease: 'surge' },
  ],
  milkcart: [
    { f: 1291, pos: [84.6, 1.85, 6.8], look: [85.9, 0.95, -0.6], fov: 43 },
    { f: 1395, pos: [92.8, 1.8, 6.8], look: [94.1, 0.95, -0.6], fov: 43, ease: 'easeInOut' },
  ],
  telegraph: [ // the slow explainer: camera nearly rests
    { f: 1396, pos: [59.0, 1.65, 3.0], look: [60.4, 1.0, -1.0], fov: 41 },
    { f: 1575, pos: [60.1, 1.58, 2.3], look: [60.7, 1.02, -1.05], fov: 39, ease: 'surge' },
  ],
  steal: [
    { f: 1576, pos: [-1.2, 1.65, 5.0], look: [0.2, 0.95, -1.4], fov: 42 },
    { f: 1722, pos: [2.4, 1.58, 4.5], look: [3.6, 0.95, -1.4], fov: 40, ease: 'easeInOut' },
  ],
  finale: [
    { f: 1723, pos: [57.2, 1.9, 6.1], look: [59.9, 1.0, 0.9], fov: 44 },
    { f: 1830, pos: [58.3, 1.75, 4.9], look: [59.9, 1.04, 1.05], fov: 41, ease: 'surge' },
    { f: 1921, pos: [58.7, 1.72, 4.6], look: [59.92, 1.05, 1.08], fov: 40, ease: 'surge' },
  ],
};
const SHADOW_AT = { hook: [-0.7, 1, 0.2], roomwide: [60, 1, 0.5], pushin: [60, 1, 1], question: [60, 1, 1.1], hill: [30.5, 1, -1], pov: [5, 1, -2], tally: [30.5, 1, -1], roombet: [58.7, 1, 0.5], taunt: [59.7, 1, 1.1], race: [0, 1, -1.4], parking: [7.6, 1, -2.7], flash: [60, 1, 1.1], betwalk: [59.5, 1, 0.6], clerk: [61.2, 1, -1.8], milkcart: [90, 1, -0.6], telegraph: [60.5, 1, -1], steal: [2, 1, -1.4], finale: [60, 1, 0.9] };
export const camAt = (f) => {
  const S = shotAt(f);
  const c = camFromKeys(CAMS[S.id], f, {});
  let flash = 0;
  if (f < 9) flash = -0.95 * (1 - f / 9);
  if (f >= 374 && f <= 388) flash = 0.9 * Math.sin((f - 374) / 14 * Math.PI);            // mirror portal white-out
  if (f >= 1050 && f <= 1066) flash = 0.65 * Math.sin((f - 1050) / 16 * Math.PI);          // the hill flash, seen in the room
  if (f >= 1816 && f <= 1824) flash = 0.3 * Math.sin((f - 1816) / 8 * Math.PI);            // board flip pop
  if ((f >= 1288 && f <= 1294) || (f >= 1393 && f <= 1399)) flash = -0.9;                  // dips into street / night room
  c.flash = flash; c.shadowAt = SHADOW_AT[S.id];
  return c;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const T = { hook: [-0.7, 1.2, 0.2], roomwide: [59.9, 1.1, 1], pushin: [59.9, 1.2, 1.1], question: [60.2, 0.9, 1.2], hill: [30.8, 1.2, -1.2], pov: [6, 1, -2.2], tally: [30.8, 1.2, -1], roombet: [58.7, 1, 0.5], taunt: [59.8, 1.1, 1.1], race: [1, 1, -1.4], parking: [7.7, 0.9, -2.7], flash: [59.9, 1.1, 1.1], betwalk: [59.8, 1.1, 0.6], clerk: [61.3, 1.3, -1.85], milkcart: [90, 1, -0.6], telegraph: [60.6, 1.1, -1], steal: [3, 1, -1.4], finale: [59.9, 1.1, 1] }[S.id];
  return { focus: dist(C.pos, T), cinf: S.id === 'pov' ? 3 : 8 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, stack: 0, haulT: 0, stamp: 0, sway: f,
    piggy: S.id === 'hook' && f < 30 ? 1 : 0,
    tally: S.id === 'tally' ? (f < 618 ? 1 : 2) : S.id === 'hill' || S.id === 'pov' ? 0 : 2,
    board: S.id === 'telegraph' ? 2 : (S.id === 'finale' && f >= 1818 ? 1 : 0),
    cartX: S.id === 'milkcart' ? ramp(f, 1291, 1395) : -1,
    moneyPile: S.id === 'finale' && f >= 1818 ? 1 : 0,
    mirrorDark: S.id === 'tally' ? 1 : 0,
    mirrorHand: ['pushin', 'question', 'taunt', 'flash'].includes(S.id) ? 1 : 0,
  };
  return W;
};

// ---------- actors ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RB = (T, o, pos, extra = {}) => ({ key: 'bear' + JSON.stringify(o), draw: (p) => T.bearCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const H = (o, pos, extra = {}) => ({ key: 'horse' + JSON.stringify(o), draw: (p) => horseCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { day: '#ffffff', golden: '#ffe2c8', night: '#b9c8ff', dusk: '#ffd9ae' };
const gal = (f, sp = 0.55) => q(((f * sp / 30) % 1 + 1) % 1, 2);

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  const id = idle(f, 5);
  switch (S.id) {
    case 'hook': {
      out.push(RB(T, { expr: f >= 30 ? 'grin' : 'determined', blink: blinkAt(f, 5), step: 0 }, [-0.7, 0, 0.25], { tint, s: 0.98 }));
      out.push(H({ col: '#8a5a30', num: '1', saddle: '#c23b2e', step: gal(f, 3.4), gallop: true }, [-4.6 + (f / 51) * 12, 0, -2.2], { tint, s: 0.8 }));
      out.push(H({ col: '#5b4a3a', num: '4', saddle: '#2b6cb0', step: gal(f + 9, 3.4), gallop: true }, [-6.6 + (f / 51) * 12, 0, -2.9], { tint, s: 0.74 }));
      break;
    }
    case 'roomwide': {
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.3)) * 0.02, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [57.6, 0, 0.7], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.3 + 2)) * 0.02, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(3, 1) }, [58.6, 0, 1.5], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'grin', L: 'hang', R: 'point', blink: blinkAt(f, 12), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [62.3, 0, 0.9], { tint }));
      out.push(R(T, 'officer44', { seed: 21, expr: 'laugh', L: 'belly', R: 'hang', blink: 0, bob: q(Math.abs(Math.sin(f * 0.28 + 1)) * 0.02, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [61.6, 0, 1.6], { tint }));
      out.push(RB(T, { expr: 'proud', blink: blinkAt(f, 5), step: 0 }, [59.9, 0, 1.15], { tint, s: 0.95 }));
      break;
    }
    case 'pushin': {
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.3)) * 0.02, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [57.3, 0, 0.8], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.3 + 1)) * 0.02, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [62.6, 0, 0.8], { tint }));
      out.push(RB(T, { expr: 'proud', blink: blinkAt(f, 5), step: 0 }, [59.9, 0, 1.15], { tint, s: 0.95 }));
      break;
    }
    case 'question': {
      const enter = M.smooth(ramp(f, 310, 336));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'smile', L: 'hang', R: 'point', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(6 + id.tilt * 0.3, 1), headTilt: q(5, 1) }, [lerp(57.6, 58.8, enter), 0, 1.2], { tint }));
      out.push(RB(T, { expr: 'proud', blink: blinkAt(f, 5), step: 0 }, [60.15, 0, 1.15], { tint, s: 0.95 }));
      break;
    }
    case 'hill': {
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'smile', L: 'hang', R: f > 480 ? 'up' : 'hang', blink: blinkAt(f, 13), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [30.0, 0, -0.45], { tint }));
      break;
    }
    case 'pov': {
      const hx1 = 3.4 + (f - 550) / 40 * 6.4, hx2 = hx1 - 2.6;
      const yawFor = (hx) => q(-Math.atan2(29.2 - hx, 4.8), 3);
      out.push(H({ col: '#8a5a30', num: '1', saddle: '#c23b2e', step: gal(f, 3.4), gallop: true }, [hx1, 0, -2.2], { tint, s: 0.82, yaw: yawFor(hx1) }));
      out.push(H({ col: '#5b4a3a', num: '4', saddle: '#2b6cb0', step: gal(f + 7, 3.4), gallop: true }, [hx2, 0, -2.9], { tint, s: 0.76, yaw: yawFor(hx2) }));
      break;
    }
    case 'tally': {
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'neutral', L: 'hang', R: 'reach', blink: blinkAt(f, 13), bob: q(id.bob, 3), tilt: q(4 + id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [30.0, 0, -0.45], { tint }));
      break;
    }
    case 'roombet': {
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'grin', L: 'reach', R: 'reach', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(5 + id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [57.7, 0, 0.15], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'smile', L: 'reach', R: 'hang', blink: blinkAt(f, 12), bob: q(id.bob, 3), tilt: q(5 + id.tilt * 0.3, 1), headTilt: q(3, 1) }, [59.6, 0, 0.1], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'laugh', L: 'belly', R: 'hang', blink: 0, bob: q(Math.abs(Math.sin(f * 0.3)) * 0.02, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [58.7, 0, 1.35], { tint }));
      out.push(RB(T, { expr: 'proud', blink: blinkAt(f, 5), step: 0 }, [62.1, 0, 1.6], { tint, s: 0.68 }));
      break;
    }
    case 'taunt': {
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'laugh', L: 'hang', R: 'reach', blink: 0, bob: q(Math.abs(Math.sin(f * 0.3)) * 0.015, 3), tilt: q(5 + id.tilt * 0.3, 1), headTilt: q(4, 1) }, [58.8, 0, 1.2], { tint }));
      out.push(RB(T, { expr: 'curious', blink: blinkAt(f, 5), step: 0 }, [60.2, 0, 1.15], { tint, s: 0.95 }));
      break;
    }
    case 'race': {
      const hx = -3.2 + (f - 820) / 140 * 7.8;
      out.push(H({ col: '#8a5a30', num: '1', saddle: '#c23b2e', step: gal(f, 3.6), gallop: true }, [hx, 0, -1.4], { tint, s: 0.92 }));
      out.push(H({ col: '#5b4a3a', num: '4', saddle: '#2b6cb0', step: gal(f + 8, 3.6), gallop: true }, [hx - 1.9, 0, -1.95], { tint, s: 0.84 }));
      break;
    }
    case 'parking': {
      out.push(H({ col: '#b9b3a4', spots: true, num: '9', saddle: '#3f7a3a', step: gal(f, 0.35) }, [7.8, 0, -2.8], { tint, s: 0.52 }));
      break;
    }
    case 'flash': {
      out.push(R(T, 'soldier44a', { seed: 11, expr: f >= 1058 ? 'shock' : 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [58.8, 0, 1.2], { tint }));
      out.push(RB(T, { expr: f >= 1052 ? 'grin' : 'proud', blink: blinkAt(f, 5), step: 0 }, [60.2, 0, 1.15], { tint, s: 0.95 }));
      break;
    }
    case 'betwalk': {
      const w = walk(f, 1111, 0.85, 0.5), bx = lerp(58.2, 60.0, M.smooth(ramp(f, 1111, 1170)));
      out.push(RB(T, { expr: 'determined', carry: true, blink: blinkAt(f, 5), step: q(w.phase) }, [bx, 0, 0.95], { tint, s: 0.95 }));
      out.push(R(T, 'officer44', { seed: 21, expr: 'neutral', L: 'belly', R: 'hang', blink: blinkAt(f, 21), bob: q(id.bob, 3), tilt: q(3 + id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [61.35, 0, -1.95], { tint }));
      break;
    }
    case 'clerk': {
      out.push(R(T, 'officer44', { seed: 21, expr: f >= 1258 ? 'shock' : 'nervous', L: 'belly', R: f >= 1200 && f < 1246 ? 'point' : 'hang', blink: blinkAt(f, 21), bob: q(id.bob, 3), tilt: q(3 + id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [61.35, 0, -1.95], { tint, s: 1.05 }));
      out.push(RB(T, { expr: 'proud', blink: blinkAt(f, 5), step: 0 }, [59.7, 0, 0.6], { tint, s: 0.8 }));
      break;
    }
    case 'milkcart': {
      const cx = 84.5 + ramp(f, 1291, 1395) * 8.2;
      out.push({ key: 'cart' + q(cx, 1), draw: (p) => cartCard(p, {}), x: cx, y: 0, z: -0.6, ground: 0, tint, s: 0.95 });
      out.push(H({ col: '#ddd6c4', num: '', step: gal(f, 0.8) }, [cx + 2.75, 0, -0.6], { tint, s: 0.82 }));
      break;
    }
    case 'telegraph': {
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'neutral', L: 'hang', R: 'reach', blink: blinkAt(f, 12), bob: q(id.bob, 3), tilt: q(6 + id.tilt * 0.3, 1), headTilt: q(4, 1) }, [61.0, 0, -1.9], { tint }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [59.1, 0, 0.7], { tint }));
      break;
    }
    case 'steal': {
      const fav = 0.6 + (f - 1576) / 146 * 2.6;
      const nine = -5.2 + M.easeOut(ramp(f, 1576, 1700)) * 9.6;
      out.push(H({ col: '#8a5a30', num: '1', saddle: '#c23b2e', step: gal(f, 3.6), gallop: true }, [fav, 0, -1.5], { tint, s: 0.92 }));
      out.push(H({ col: '#b9b3a4', spots: true, num: '9', saddle: '#3f7a3a', step: gal(f + 4, 3.9), gallop: true }, [nine, 0, -1.15], { tint, s: 0.9 }));
      break;
    }
    case 'finale': {
      const after = f >= 1818;
      out.push(R(T, 'soldier44a', { seed: 11, expr: after ? 'shock' : 'laugh', L: after ? 'hang' : 'belly', R: after ? 'hang' : 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.3)) * 0.02, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [58.3, 0, 1.2], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: after ? 'shock' : 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(Math.abs(Math.sin(f * 0.3 + 2)) * 0.02, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(3, 1) }, [61.5, 0, 1.25], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: after ? 'shock' : 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 12), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [60.9, 0, 0.15], { tint }));
      out.push(RB(T, { expr: 'proud', blink: blinkAt(f, 5), step: 0 }, [59.9, 0, 1.15], { tint, s: 0.98 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
const noteCard = (p) => { p.poly([[190, 400], [410, 400], [410, 560], [190, 560]], '#7fae5a', 5); p.poly([[215, 425], [385, 425], [385, 535], [215, 535]], '#a9d18e', 2.5); const g = p.g; g.save(); g.fillStyle = '#2e5b28'; g.font = "900 92px 'Arial Black', Arial"; g.textAlign = 'center'; g.fillText('$', 300, 520); g.restore(); };
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' && f >= 30 && f < 48) { const t = q((f - 30) / 18, 2); out.push(FX('burst' + t, (p) => T.fxBurst(p, t, '#ffd23e'), [-1.48, 0.72, 0.5], 0.34)); }
  if (S.id === 'pushin' && f >= 283 && f < 305) { const t = q((f - 283) / 22, 2); out.push(FX('glint' + t, (p) => T.fxStars(p, t), [60.42, 0.66, 1.34], 0.2)); }
  if (S.id === 'hill' && f >= 503 && f < 530) { const t = q((f - 503) / 27, 2); out.push(FX('hglint' + t, (p) => T.fxStars(p, t), [31.3, 1.55, -1.55], 0.42)); }
  if ((S.id === 'race' || S.id === 'steal') && f % 12 < 9) { const t = q((f % 12) / 12, 2); const hx = S.id === 'race' ? -3.2 + (f - 820) / 140 * 7.8 : -5.2 + M.easeOut(ramp(f, 1576, 1700)) * 9.6; out.push(FX('dust' + S.id + t, (p) => T.fxDust(p, t, '#cbb894'), [hx - 0.8, 0.25, -1.3], 0.3)); }
  if (S.id === 'clerk' && f >= 1246 && f < 1290) {
    const k = M.easeOut(ramp(f, 1246, 1262)); const nx = lerp(59.8, 61.52, k), ny = lerp(1.35, 1.66, k) - Math.sin(k * Math.PI) * 0.22;
    out.push(FX('note' + q(k, 2), (p) => noteCard(p), [nx, ny - 0.42, -1.7], 0.16, { roll: q(k * 1.2, 2) }));
  }
  if (S.id === 'finale' && f >= 1824) {
    for (let i = 0; i < 10; i++) {
      const cyc = ((f - 1824) * 0.008 + i * 0.173) % 1; const nx = 58.2 + (i * 0.37) % 3.6, ny = 3.3 - cyc * 3.0;
      out.push(FX('rain' + i + q(cyc, 2), (p) => noteCard(p), [nx, ny, 1.5 - (i % 3) * 0.3], 0.17, { roll: q(cyc * 2 + i, 1) }));
    }
  }
  if (S.id === 'steal' && f >= 1696 && f < 1714) { const t = q((f - 1696) / 18, 2); out.push(FX('finburst' + t, (p) => T.fxBurst(p, t, '#fff3b0'), [4.7, 1.0, -1.4], 0.3)); }
  return out;
};
