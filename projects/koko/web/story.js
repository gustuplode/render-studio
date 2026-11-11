// Shot plan for "Koko — The Gorilla Who Learned to Talk" — timed to koko-voice
// (51.075 s, 30 fps, TOTAL 1532). One enclosure set, ONE continuous camera flight:
// every section's first camera key == the previous section's last key (no cuts).
// Phrases: P1 0-109 | P2 140-310 | P3 340-446 | P4 477-618 | P5 650-714 | P6 739-811 |
// P7 829-925 | P8 955-1036 | P9 1066-1134 | P10 1166-1251 | P11 1289-1378 | P12 1413-1509.
// Sections tile 0..1531 contiguously; inter-phrase gaps belong to the outgoing section.
// Staging (built in main.js): enclosure clearing at origin; Koko at (0,0,0);
// Patterson's chair (-1.7,0,0.9); blanket (1.7,0,1.4); word easel (1.18,0,0.55);
// big-board easel (1.31,0,-0.45); glass wall z=-5.5 (visitors behind it, S11).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1532, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 139, light: 'day' },
  { id: 'young', a: 140, b: 339, light: 'day' },
  { id: 'teach', a: 340, b: 476, light: 'day' },
  { id: 'signs', a: 477, b: 649, light: 'day' },
  { id: 'feel', a: 650, b: 738, light: 'warm' },
  { id: 'ask', a: 739, b: 828, light: 'warm' },
  { id: 'choose', a: 829, b: 954, light: 'warm' },
  { id: 'cradle', a: 955, b: 1065, light: 'warm' },
  { id: 'loss', a: 1066, b: 1165, light: 'cool' },
  { id: 'told', a: 1166, b: 1288, light: 'cool' },
  { id: 'loved', a: 1289, b: 1412, light: 'golden' },
  { id: 'finale', a: 1413, b: 1531, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 42, sky: '#bcd2ea', ground: '#5a6a3a', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfe0c8', fogNear: 45, fogFar: 380,
    skyTop: '#6f97cc', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.0032, sat: 1.05, vig: 0.2, shadowExt: 16, aurora: 0, gain: '#ffffff', ...WATER },
  warm: { az: 112, el: 30, sky: '#c9c2a4', ground: '#5f6136', hemi: 1.16, sun: '#ffd9a0', sunI: 2.3, fog: '#ddd0a4', fogNear: 42, fogFar: 340,
    skyTop: '#7d90c2', skyHor: '#ffce96', sunDisc: '#ffe9bd', sunSize: 0.0032, sat: 1.07, vig: 0.23, shadowExt: 16, aurora: 0, gain: '#ffffff', ...WATER },
  cool: { az: 140, el: 26, sky: '#93a7c4', ground: '#46523e', hemi: 1.02, sun: '#cfd9e8', sunI: 1.6, fog: '#aebdc9', fogNear: 38, fogFar: 300,
    skyTop: '#5d7595', skyHor: '#c3ced4', sunDisc: '#e8eef2', sunSize: 0.0026, sat: 0.92, vig: 0.3, shadowExt: 16, aurora: 0, gain: '#e8eef8', ...WATER },
  golden: { az: 95, el: 18, sky: '#d9b28c', ground: '#6a5a2c', hemi: 1.15, sun: '#ffb763', sunI: 2.5, fog: '#e5bd85', fogNear: 40, fogFar: 320,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.09, vig: 0.25, shadowExt: 16, aurora: 0, gain: '#ffedd6', ...WATER },
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
  if (S.id === 'loss') return blendLight(LIGHTS.warm, LIGHTS.cool, smooth(ramp(f, 1066, 1130)));
  if (S.id === 'loved') return blendLight(LIGHTS.cool, LIGHTS.golden, smooth(ramp(f, 1289, 1360)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const KOKO_POS = [0, 0, 0];
export const PAT_POS = [-0.95, 0, 0.5];
export const BLANKET = [1.7, 0, 1.4];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
export const kokoPosAt = (f) => [...KOKO_POS];
export const kokoScaleAt = (f) => f < 340 ? 0.74 : f < 477 ? 0.9 : 1.14;
const signPoseAt = (f, every = 13) => ['signA', 'signB', 'signC'][Math.floor(f / every) % 3];

// ---------- cameras (boundary-matched continuous flight) ----------
const CAMS = {
  hook: [
    { f: 0, pos: [0, 1.22, 4.1], look: [0, 1.12, 0], fov: 42 },
    { f: 80, pos: [0, 1.3, 3.5], look: [0, 1.12, 0], fov: 40, ease: 'surge' },
    { f: 139, pos: [0, 1.3, 3.4], look: [0, 1.12, 0], fov: 40 },
  ],
  young: [
    { f: 140, pos: [0, 1.3, 3.4], look: [0, 1.12, 0], fov: 40 },
    { f: 205, pos: [0.5, 2.6, 9.2], look: [0, 0.9, -0.7], fov: 47, ease: 'surge' },
    { f: 300, pos: [-0.3, 1.5, 5.8], look: [-0.3, 0.98, 0.1], fov: 43, ease: 'surge' },
    { f: 339, pos: [-0.5, 1.4, 6.4], look: [-0.5, 1.02, 0.3], fov: 44 },
  ],
  teach: [
    { f: 340, pos: [-0.5, 1.4, 6.4], look: [-0.5, 1.02, 0.3], fov: 44 },
    { f: 446, pos: [-0.52, 1.36, 6.1], look: [-0.52, 1.01, 0.32], fov: 43, ease: 'surge' },
    { f: 476, pos: [-0.5, 1.32, 4.6], look: [-0.5, 1.02, 0.3], fov: 41 },
  ],
  signs: [
    { f: 477, pos: [-0.5, 1.32, 4.6], look: [-0.5, 1.02, 0.3], fov: 41 },
    { f: 545, pos: [-0.15, 1.35, 3.9], look: [-0.1, 1.05, 0.1], fov: 40, ease: 'surge' },
    { f: 618, pos: [0.45, 1.48, 7.3], look: [0.45, 1.08, -0.2], fov: 45, ease: 'surge' },
    { f: 649, pos: [0.45, 1.46, 7.15], look: [0.45, 1.07, -0.2], fov: 45 },
  ],
  feel: [
    { f: 650, pos: [0.45, 1.46, 7.15], look: [0.45, 1.07, -0.2], fov: 45 },
    { f: 690, pos: [0.5, 1.42, 7.5], look: [0.52, 1.05, -0.05], fov: 45, ease: 'surge' },
    { f: 738, pos: [0.52, 1.42, 7.45], look: [0.53, 1.05, -0.02], fov: 45 },
  ],
  ask: [
    { f: 739, pos: [0.52, 1.42, 7.45], look: [0.53, 1.05, -0.02], fov: 45 },
    { f: 790, pos: [-0.3, 1.36, 6.6], look: [-0.35, 1.03, 0.3], fov: 44, ease: 'surge' },
    { f: 828, pos: [-0.28, 1.38, 6.5], look: [-0.33, 1.03, 0.32], fov: 44 },
  ],
  choose: [
    { f: 829, pos: [-0.28, 1.38, 6.5], look: [-0.33, 1.03, 0.32], fov: 44 },
    { f: 900, pos: [1.0, 1.65, 7.4], look: [1.02, 0.88, 0.95], fov: 45, ease: 'surge' },
    { f: 954, pos: [1.05, 1.6, 7.55], look: [1.05, 0.86, 0.98], fov: 45 },
  ],
  cradle: [
    { f: 955, pos: [1.05, 1.6, 7.55], look: [1.05, 0.86, 0.98], fov: 45 },
    { f: 1005, pos: [0.1, 1.26, 3.95], look: [0, 1.0, 0.25], fov: 40, ease: 'surge' },
    { f: 1065, pos: [0.45, 1.37, 7.2], look: [0.5, 1.03, -0.02], fov: 45, ease: 'surge' },
  ],
  loss: [
    { f: 1066, pos: [0.45, 1.37, 7.2], look: [0.5, 1.03, -0.02], fov: 45 },
    { f: 1134, pos: [0.4, 1.45, 6.2], look: [0.55, 0.82, 0.75], fov: 43, ease: 'surge' },
    { f: 1165, pos: [0.38, 1.42, 6.4], look: [0.5, 0.86, 0.7], fov: 43 },
  ],
  told: [
    { f: 1166, pos: [0.38, 1.42, 6.4], look: [0.5, 0.86, 0.7], fov: 43 },
    { f: 1200, pos: [-0.05, 1.38, 6.6], look: [-0.2, 1.0, 0.45], fov: 44, ease: 'surge' },
    { f: 1245, pos: [0.35, 1.38, 7.0], look: [0.3, 1.01, 0.1], fov: 45, ease: 'surge' },
    { f: 1288, pos: [0.5, 1.4, 7.3], look: [0.52, 1.03, -0.05], fov: 45 },
  ],
  loved: [
    { f: 1289, pos: [0.5, 1.4, 7.3], look: [0.52, 1.03, -0.05], fov: 45 },
    { f: 1360, pos: [0.45, 1.46, 7.3], look: [0.45, 1.06, -0.25], fov: 45, ease: 'surge' },
    { f: 1412, pos: [0.48, 1.48, 7.5], look: [0.47, 1.08, -0.22], fov: 45 },
  ],
  finale: [
    { f: 1413, pos: [0.48, 1.48, 7.5], look: [0.47, 1.08, -0.22], fov: 45 },
    { f: 1470, pos: [0.5, 1.5, 7.8], look: [0.5, 1.1, -0.2], fov: 45, ease: 'surge' },
    { f: 1531, pos: [0.52, 1.52, 7.9], look: [0.5, 1.1, -0.2], fov: 45 },
  ],
};
const SHADOW_AT = { hook: [0, 0.8, 0], young: [0, 0.6, -0.5], teach: [-0.6, 0.8, 0.4], signs: [0.4, 0.8, 0], feel: [0.4, 0.8, 0.4], ask: [-0.5, 0.8, 0.4], choose: [0.9, 0.6, 1], cradle: [0, 0.8, 0.2], loss: [0.5, 0.6, 0.7], told: [0.3, 0.8, 0.4], loved: [0.4, 0.8, 0], finale: [0.5, 0.9, 0] };
const shotCam = (id, f) => camFromKeys(CAMS[id], f);
export const camAt = (f) => {
  const S = shotAt(f);
  const c = shotCam(S.id, f);
  c.flash = f < 9 ? -0.95 * (1 - f / 9) : 0;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let point, cinf;
  switch (S.id) {
    case 'signs': case 'loved': case 'finale': point = [0.6, 1.1, -0.2]; cinf = 5; break;
    case 'feel': case 'told': point = [0.6, 1.1, -0.1]; cinf = 5; break;
    case 'choose': point = [0.9, 0.8, 1.0]; cinf = 6; break;
    case 'loss': point = [0.5, 0.85, 0.7]; cinf = 7; break;
    default: point = [0, 1.05, 0]; cinf = 9;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, dust: 0.3, windK: 0.5, grassK: 0.6, boardSigns: 0, boardSAD: 0, boardCAT: 0, boardLOVE: 0, boardKOKO: 0, boardFinale: 0, giftT: 0, glassT: 0 };
  switch (S.id) {
    case 'hook': W.dust = 0.22; break;
    case 'young': W.dust = 0.34; W.grassK = 0.9; break;
    case 'teach': W.dust = 0.26; break;
    case 'signs': W.boardSigns = smooth(ramp(f, 560, 610)); W.dust = 0.3; break;
    case 'feel': W.boardSAD = 1; W.dust = 0.26; break;
    case 'ask': W.giftT = smooth(ramp(f, 745, 790)); W.dust = 0.26; break;
    case 'choose': W.boardCAT = 1; W.dust = 0.3; break;
    case 'cradle': W.boardLOVE = smooth(ramp(f, 1020, 1060)); W.dust = 0.3; break;
    case 'loss': W.dust = 0.14; W.windK = 0.3; W.grassK = 0.35; break;
    case 'told': W.boardSAD = 1; W.dust = 0.12; W.windK = 0.3; break;
    case 'loved': W.boardKOKO = smooth(ramp(f, 1300, 1350)); W.glassT = 1; W.dust = 0.34; break;
    case 'finale': W.boardFinale = 1; W.glassT = 0.7; W.dust = 0.3; W.windK = 0.4; break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'loss': case 'told': return { smokeRate: 0.5, dustRate: 0.2 };
    case 'loved': case 'finale': return { smokeRate: 1.5, dustRate: 0.4 };
    default: return { smokeRate: 1.0, dustRate: 0.3 };
  }
};

// ---------- actors ----------
const TINT = { day: '#ffffff', warm: '#ffe9c4', cool: '#dfe8f2', golden: '#ffd9a3' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
const RK = (T, o, pos, extra = {}) => ({ key: 'koko' + JSON.stringify(o), draw: (p) => T.kokoCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RP = (T, o, pos, extra = {}) => ({ key: 'pat' + JSON.stringify(o), draw: (p) => T.pattersonCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RKP = (T, o, pos, extra = {}) => ({ key: 'keep' + JSON.stringify(o), draw: (p) => T.keeperCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RKT = (T, o, pos, extra = {}) => ({ key: 'kit' + JSON.stringify(o), draw: (p) => T.kittenCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RV = (T, o, pos, extra = {}) => ({ key: 'vis' + JSON.stringify(o), draw: (p) => T.visitorCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const patBase = (f, extra = {}) => ({ expr: 'smile', L: 'belly', R: 'point', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3), ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S);
  const ks = kokoScaleAt(f);
  switch (S.id) {
    case 'hook': {
      // BIG front close-up; hands rise and cycle sign shapes toward camera
      const pose = f < 30 ? 'sit' : signPoseAt(f, 16);
      out.push(RK(T, { pose, expr: f < 60 ? 'neutral' : 'smile', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3), young: 1 }, KOKO_POS, { tint, s: 1.12 }));
      break;
    }
    case 'young': {
      const pose = f < 250 ? 'knuckle' : 'sit';
      out.push(RK(T, { pose, expr: 'smile', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3), young: 1 }, KOKO_POS, { tint, s: ks }));
      if (f > 215) { // background visitors at the fence, small
        out.push(RV(T, { expr: 'smile', L: 'down', R: 'down', blink: 0, seed: 91 }, [-2.6, 0, -5.9], { tint: '#aebdd0', s: 0.92, shadow: false }));
        out.push(RV(T, { expr: 'neutral', L: 'down', R: 'down', blink: 0, seed: 97, tunic: '#7a5a6e' }, [2.9, 0, -5.9], { tint: '#aebdd0', s: 0.88, shadow: false }));
      }
      break;
    }
    case 'teach': {
      const pose = f < 395 ? 'sit' : (Math.floor(f / 18) % 2 ? 'signA' : 'signC'); // watching, then copying a hand shape
      out.push(RK(T, { pose, expr: 'neutral', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3), young: 1 }, KOKO_POS, { tint, s: ks }));
      out.push(RP(T, patBase(f, { expr: 'smile', R: f < 395 ? 'point' : 'up' }), PAT_POS, { tint, s: 1.0, yaw: 0.55 }));
      break;
    }
    case 'signs': {
      // signing montage: DISTINCT shapes cycling fast; board fades in late (worldAt)
      out.push(RK(T, { pose: signPoseAt(f, 11), expr: f > 560 ? 'grin' : 'smile', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3) }, KOKO_POS, { tint, s: ks }));
      break;
    }
    case 'feel': {
      // SAD board beat, then the joke: expression turns grin/laugh after P5's "joked" (~f692)
      const joke = f >= 692;
      out.push(RK(T, { pose: joke ? 'signB' : 'signA', expr: joke ? (f > 712 ? 'laugh' : 'grin') : 'pained', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3) }, KOKO_POS, { tint, s: ks }));
      break;
    }
    case 'ask': {
      out.push(RK(T, { pose: signPoseAt(f, 18), expr: 'neutral', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3) }, KOKO_POS, { tint, s: ks, yaw: -0.18 }));
      out.push(RP(T, patBase(f, { expr: 'smile', R: 'belly' }), PAT_POS, { tint, s: 1.0, yaw: 0.55 }));
      break;
    }
    case 'choose': {
      out.push(RK(T, { pose: f < 895 ? 'signC' : 'cradle', expr: 'smile', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3) }, KOKO_POS, { tint, s: ks, yaw: 0.22 }));
      out.push(RKP(T, { expr: 'smile', L: 'belly', R: 'point', blink: blinkAt(f, 53), bob: q(breath(f, 53), 3) }, [2.2, 0, 0.15], { tint, s: 1.0, yaw: -0.7 }));
      // the kitten group on the blanket: orange (tail), white (tail), tabby (tail), GREY TAILLESS
      out.push(RKT(T, { color: '#d98a4a', tail: true }, [1.18, 0, 1.62], { tint, s: 0.17, yaw: -0.3 }));
      out.push(RKT(T, { color: '#e8e4da', tail: true }, [2.24, 0, 1.66], { tint, s: 0.17, yaw: 0.3 }));
      out.push(RKT(T, { color: '#7a6a58', tail: true }, [1.95, 0, 1.05], { tint, s: 0.16, yaw: 0.1 }));
      out.push(RKT(T, { color: '#9aa0a6', tail: false }, [1.52, 0, 1.28], { tint, s: 0.18, yaw: -0.1 })); // All Ball
      break;
    }
    case 'cradle': {
      const rock = q(0.02 * Math.sin(f * 0.07), 3);
      out.push(RK(T, { pose: 'cradle', expr: 'smile', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3) }, KOKO_POS, { tint, s: ks, roll: rock }));
      out.push(RKT(T, { color: '#9aa0a6', tail: false }, [0, 0.6, 0.34], { tint, s: 0.17, blob: false }));
      break;
    }
    case 'loss': {
      // quiet: Koko alone, bowed, looking toward the EMPTY blanket (no kitten actors)
      out.push(RK(T, { pose: 'sad', expr: 'pained', blink: blinkAt(f, 7), bob: q(breath(f, 7) * 0.5, 3) }, KOKO_POS, { tint, s: ks, yaw: 0.3 }));
      break;
    }
    case 'told': {
      const pose = f < 1200 ? 'sad' : (Math.floor(f / 30) % 2 ? 'signA' : 'signC'); // slow signing: bad, sad, bad
      out.push(RK(T, { pose, expr: 'pained', blink: blinkAt(f, 7), bob: q(breath(f, 7) * 0.5, 3), tear: f > 1210 ? 1 : 0 }, KOKO_POS, { tint, s: ks }));
      out.push(RP(T, patBase(f, { expr: 'pained', R: 'belly', L: 'belly' }), PAT_POS, { tint, s: 1.0, yaw: 0.55 }));
      break;
    }
    case 'loved': {
      out.push(RK(T, { pose: 'sit', expr: 'smile', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3) }, KOKO_POS, { tint, s: ks }));
      // visitors behind the glass (z=-5.9, glass wall at z=-5.5 in main.js)
      out.push(RV(T, { expr: 'smile', L: 'down', R: 'wave', blink: 0, seed: 91 }, [-2.2, 0, -5.95], { tint: '#8a97ad', s: 0.95, shadow: false }));
      out.push(RV(T, { expr: 'grin', L: 'down', R: 'down', blink: 0, seed: 97, tunic: '#7a5a6e' }, [-0.6, 0, -6.05], { tint: '#8a97ad', s: 0.9, shadow: false }));
      out.push(RV(T, { expr: 'smile', L: 'wave', R: 'down', blink: 0, seed: 103, tunic: '#4a6a52' }, [1.1, 0, -5.95], { tint: '#8a97ad', s: 0.93, shadow: false }));
      out.push(RV(T, { expr: 'neutral', L: 'down', R: 'down', blink: 0, seed: 109, tunic: '#6e5636' }, [2.6, 0, -6.05], { tint: '#8a97ad', s: 0.89, shadow: false }));
      break;
    }
    case 'finale': {
      const rock = q(0.015 * Math.sin(f * 0.05), 3);
      out.push(RK(T, { pose: 'cradle', expr: 'smile', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3) }, KOKO_POS, { tint, s: ks, roll: rock }));
      out.push(RKT(T, { color: '#9aa0a6', tail: false }, [0, 0.6, 0.34], { tint, s: 0.17, blob: false }));
      out.push(RV(T, { expr: 'smile', L: 'down', R: 'down', blink: 0, seed: 91 }, [-1.9, 0, -5.95], { tint: '#93a2b8', s: 0.95, shadow: false }));
      out.push(RV(T, { expr: 'smile', L: 'down', R: 'wave', blink: 0, seed: 103, tunic: '#4a6a52' }, [1.6, 0, -5.95], { tint: '#93a2b8', s: 0.93, shadow: false }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
export const fxAt = (f, T) => [];
