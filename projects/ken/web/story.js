// Shot plan for "Ken Allen — The Orangutan Who Kept Escaping the Zoo" — timed to
// ken-voice (30 fps). One zoo set, ONE continuous camera flight: every section's
// first camera key == the previous section's last key (no cuts). Sections tile
// 0..TOTAL-1; inter-phrase gaps belong to the outgoing section.
// Set (main.js): enclosure at origin, glass front z=2.2, bolted door x=-2.6,
// visitor path z=3..6.6, fenced dog yard across the path, keeper deck inside.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1843, DECK = 0.99;
export const SHOTS = [
  { id: 'hook', a: 0, b: 171, light: 'day' },
  { id: 'home', a: 172, b: 309, light: 'day' },
  { id: 'found', a: 310, b: 485, light: 'day' },
  { id: 'bolts', a: 486, b: 613, light: 'day' },
  { id: 'again', a: 614, b: 728, light: 'day' },
  { id: 'stroll', a: 729, b: 828, light: 'day' },
  { id: 'gentle', a: 829, b: 960, light: 'day' },
  { id: 'watched', a: 961, b: 1114, light: 'day' },
  { id: 'undercover', a: 1115, b: 1237, light: 'day' },
  { id: 'reveal', a: 1238, b: 1380, light: 'day' },
  { id: 'fixed', a: 1381, b: 1519, light: 'day' },
  { id: 'finale', a: 1520, b: 1663, light: 'golden' },
  { id: 'tease', a: 1664, b: 1842, light: 'golden' }
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 46, sky: '#bcd2ea', ground: '#5a6a3a', hemi: 1.24, sun: '#fff3da', sunI: 2.2, fog: '#cfe0c8', fogNear: 45, fogFar: 380,
    skyTop: '#6f97cc', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.0032, sat: 1.05, vig: 0.2, shadowExt: 16, aurora: 0, gain: '#ffffff', ...WATER },
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
  if (S.id === 'finale') return blendLight(LIGHTS.day, LIGHTS.golden, smooth(ramp(f, S.a, S.a + (S.b - S.a) * 0.4)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const KEN_HOME = [0, 0, 0];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
const secT = (S, f) => (f - S.a) / Math.max(1, S.b - S.a);
export const kenPosAt = (f) => {
  const S = shotAt(f), t = secT(S, f);
  if (S.id === 'home') {
    if (t < 0.5) return lerp3([0.7, 0, 0.5], [-1.1, 0, -3.2], smooth(t / 0.5));
    if (t < 0.72) return lerp3([-1.1, 0, -3.2], [-1.6, DECK, -4.15], smooth((t - 0.5) / 0.22));
    return [-1.6, DECK, -4.15];
  }
  if (S.id === 'again' && t > 0.62) return lerp3([-2.6, 0, 1.15], [-2.6, 0, 3.65], smooth((t - 0.62) / 0.38));
  if (S.id === 'stroll') return t < 0.68 ? lerp3([-2.2, 0, 4.9], [4.35, 0, 4.9], smooth(t / 0.68)) : [4.6, 0, 4.9];
  if (S.id === 'undercover') return lerp3([0.2, 0, 4.9], [3.4, 0, 4.9], smooth(t));
  return [...KEN_HOME];
};

// ---------- cameras (boundary-matched continuous flight) ----------
const CAMS = {"hook": [{"f": 0, "pos": [-2.2, 1.22, 7.3], "look": [-2.35, 1.02, 3.4], "fov": 41}, {"f": 94, "pos": [-2.28, 1.28, 6.5], "look": [-2.35, 1.05, 3.45], "fov": 40, "ease": "surge"}, {"f": 171, "pos": [-2.3, 1.3, 6.3], "look": [-2.35, 1.05, 3.45], "fov": 40}], "home": [{"f": 172, "pos": [-2.3, 1.3, 6.3], "look": [-2.35, 1.05, 3.45], "fov": 40}, {"f": 224, "pos": [0.6, 3.1, 11.8], "look": [-1.15, 0.85, -1.1], "fov": 47, "ease": "surge"}, {"f": 271, "pos": [0.55, 3.05, 11.6], "look": [-1.15, 0.85, -1.1], "fov": 47}, {"f": 309, "pos": [0.2, 1.6, 6.9], "look": [0, 1.0, -0.2], "fov": 44, "ease": "surge"}], "found": [{"f": 310, "pos": [0.2, 1.6, 6.9], "look": [0, 1.0, -0.2], "fov": 44}, {"f": 380, "pos": [-1.4, 1.55, 6.6], "look": [-1.2, 1.0, 0.2], "fov": 44, "ease": "surge"}, {"f": 485, "pos": [3.2, 1.55, 0.7], "look": [5.25, 0.95, 5.0], "fov": 45, "ease": "surge"}], "bolts": [{"f": 486, "pos": [3.2, 1.55, 0.7], "look": [5.25, 0.95, 5.0], "fov": 45}, {"f": 543, "pos": [-1.6, 1.0, 5.2], "look": [-2.4, 0.5, 3.0], "fov": 42, "ease": "surge"}, {"f": 613, "pos": [-2.42, 0.62, 4.35], "look": [-2.4, 0.3, 3.05], "fov": 38, "ease": "surge"}], "again": [{"f": 614, "pos": [-2.42, 0.62, 4.35], "look": [-2.4, 0.3, 3.05], "fov": 38}, {"f": 660, "pos": [-2.7, 1.5, 7.3], "look": [-2.6, 1.0, 2.3], "fov": 45, "ease": "surge"}, {"f": 728, "pos": [-2.7, 1.5, 7.3], "look": [-2.6, 1.0, 2.3], "fov": 45}], "stroll": [{"f": 729, "pos": [-2.7, 1.5, 7.3], "look": [-2.6, 1.0, 2.3], "fov": 45}, {"f": 764, "pos": [-0.4, 1.7, 1.1], "look": [1.6, 1.0, 4.85], "fov": 45, "ease": "surge"}, {"f": 798, "pos": [2.2, 1.65, 1.2], "look": [4.3, 1.0, 4.9], "fov": 45, "ease": "surge"}, {"f": 828, "pos": [3.9, 1.6, 1.3], "look": [4.62, 1.0, 4.9], "fov": 44}], "gentle": [{"f": 829, "pos": [3.9, 1.6, 1.3], "look": [4.62, 1.0, 4.9], "fov": 44}, {"f": 894, "pos": [3.75, 1.55, 1.15], "look": [5.35, 1.25, 8.3], "fov": 44, "ease": "surge"}, {"f": 960, "pos": [3.6, 1.5, 1.1], "look": [3.35, 1.0, 4.55], "fov": 44, "ease": "surge"}], "watched": [{"f": 961, "pos": [3.6, 1.5, 1.1], "look": [3.35, 1.0, 4.55], "fov": 44}, {"f": 1038, "pos": [0.5, 1.6, 6.2], "look": [0.15, 1.0, -0.3], "fov": 43, "ease": "surge"}, {"f": 1114, "pos": [0.25, 1.45, 5.4], "look": [0.1, 1.02, 0], "fov": 42}], "undercover": [{"f": 1115, "pos": [0.25, 1.45, 5.4], "look": [0.1, 1.02, 0], "fov": 42}, {"f": 1170, "pos": [0.9, 1.6, 3.1], "look": [1.8, 1.0, 4.85], "fov": 44, "ease": "surge"}, {"f": 1237, "pos": [2.6, 1.6, 2.4], "look": [3.3, 1.0, 4.9], "fov": 44, "ease": "surge"}], "reveal": [{"f": 1238, "pos": [2.6, 1.6, 2.4], "look": [3.3, 1.0, 4.9], "fov": 44}, {"f": 1295, "pos": [0.3, 1.45, 4.6], "look": [-1.2, 1.1, 1.55], "fov": 39, "ease": "surge"}, {"f": 1380, "pos": [-0.4, 1.42, 6.9], "look": [-1.35, 1.15, 1.6], "fov": 39}], "fixed": [{"f": 1381, "pos": [-0.4, 1.42, 6.9], "look": [-1.35, 1.15, 1.6], "fov": 39}, {"f": 1443, "pos": [-0.4, 1.9, 8.8], "look": [-0.7, 1.35, 2.2], "fov": 46, "ease": "surge"}, {"f": 1519, "pos": [0.1, 1.7, 8.2], "look": [-0.3, 1.2, 2.0], "fov": 45}], "finale": [{"f": 1520, "pos": [0.1, 1.7, 8.2], "look": [-0.3, 1.2, 2.0], "fov": 45}, {"f": 1592, "pos": [0.15, 1.6, 8.45], "look": [0.38, 1.05, -0.3], "fov": 44, "ease": "surge"}, {"f": 1663, "pos": [0.2, 1.5, 8.6], "look": [0.35, 1.06, -0.3], "fov": 44}], "tease": [{"f": 1664, "pos": [0.2, 1.5, 8.6], "look": [0.35, 1.06, -0.3], "fov": 44}, {"f": 1842, "pos": [0.2, 1.45, 7.8], "look": [0.33, 1.05, -0.2], "fov": 42, "ease": "surge"}]};
const SHADOW_AT = { hook: [-2.3, 0.8, 3.4], home: [0, 0.6, -0.5], found: [0, 0.8, 0.6], bolts: [-2.5, 0.4, 2.9], again: [-2.6, 0.8, 2.2], stroll: [1, 0.8, 4.9], gentle: [4.1, 0.8, 4.7], watched: [0, 0.8, 0], undercover: [1.8, 0.8, 4.9], reveal: [-1.7, 0.8, 1.6], fixed: [-0.5, 0.8, 2.2], finale: [0, 0.9, 0], tease: [0, 0.9, 0] };
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
    case 'hook': point = [-2.35, 1.05, 3.5]; cinf = 5; break;
    case 'bolts': point = [-2.42, 0.45, 3.0]; cinf = 5; break;
    case 'reveal': point = [-1.9, 1.0, 1.9]; cinf = 5; break;
    case 'found': point = [2.5, 1.0, 3.0]; cinf = 7; break;
    case 'stroll': case 'gentle': case 'undercover': point = [2.2, 1.0, 4.9]; cinf = 7; break;
    default: point = [0, 1.05, 0]; cinf = 9;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), t = secT(S, f);
  const W = { shot: S.id, dust: 0.3, windK: 0.5, grassK: 0.6, boardZoo: 0, boardHoudini: 0, boardFinale: 0, doorOpen: 0, boltsOn: 1, pileT: 0, boltTurn: 0, wallT: 0, glassT: 0.3 };
  switch (S.id) {
    case 'hook': W.doorOpen = 0.55; W.glassT = 0.4; break;
    case 'home': W.boardZoo = smooth(ramp(f, S.a + (S.b - S.a) * 0.45, S.a + (S.b - S.a) * 0.58)) * (1 - smooth(ramp(f, S.a + (S.b - S.a) * 0.62, S.a + (S.b - S.a) * 0.74))); W.grassK = 0.9; break;
    case 'found': W.doorOpen = 0.5; break;
    case 'bolts': W.doorOpen = 0.7; W.boltsOn = 0; W.pileT = 1; W.dust = 0.2; break;
    case 'again': W.doorOpen = smooth(ramp(f, S.a + (S.b - S.a) * 0.62, S.a + (S.b - S.a) * 0.8)); break;
    case 'stroll': W.doorOpen = 0.85; W.boltsOn = 0; break;
    case 'gentle': W.doorOpen = 0.85; W.boltsOn = 0; W.boardHoudini = smooth(ramp(f, S.a + (S.b - S.a) * 0.3, S.a + (S.b - S.a) * 0.45)) * (1 - smooth(ramp(f, S.a + (S.b - S.a) * 0.6, S.a + (S.b - S.a) * 0.73))); break;
    case 'watched': W.dust = 0.16; W.windK = 0.3; W.grassK = 0.35; break;
    case 'undercover': W.doorOpen = 0.6; W.boltsOn = 0; break;
    case 'reveal': W.doorOpen = 0.12; W.boltTurn = smooth(ramp(f, S.a + (S.b - S.a) * 0.3, S.a + (S.b - S.a) * 0.75)); W.dust = 0.2; break;
    case 'fixed': W.boltsOn = 1 - ramp(f, S.a + (S.b - S.a) * 0.1, S.a + (S.b - S.a) * 0.3); W.wallT = smooth(ramp(f, S.a + (S.b - S.a) * 0.25, S.a + (S.b - S.a) * 0.7)); break;
    case 'finale': W.wallT = 1; W.boltsOn = 0; W.boardFinale = smooth(ramp(f, S.a + (S.b - S.a) * 0.45, S.a + (S.b - S.a) * 0.6)); W.glassT = 0.8; break;
    case 'tease': W.wallT = 1; W.boltsOn = 0; W.boardFinale = 1 - smooth(ramp(f, S.a + (S.b - S.a) * 0.05, S.a + (S.b - S.a) * 0.25)); W.glassT = 0.8; W.dust = 0.34; break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'watched': return { smokeRate: 0.5, dustRate: 0.2 };
    case 'finale': case 'tease': return { smokeRate: 1.5, dustRate: 0.4 };
    default: return { smokeRate: 1.0, dustRate: 0.3 };
  }
};

// ---------- actors ----------
const TINT = { day: '#ffffff', golden: '#ffd9a3' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
const RK = (T, o, pos, extra = {}) => ({ key: 'ken' + JSON.stringify(o), draw: (p) => T.orangutanCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const RKP = (T, o, pos, extra = {}) => ({ key: 'keep' + JSON.stringify(o), draw: (p) => T.keeperCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const RV = (T, o, pos, extra = {}) => ({ key: 'vis' + JSON.stringify(o), draw: (p) => T.visitorCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const RD = (T, o, pos, extra = {}) => ({ key: 'dog' + JSON.stringify(o), draw: (p) => T.dogCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const kenBase = (f, extra = {}) => ({ pose: 'sit', expr: 'neutral', blink: blinkAt(f, 7), bob: q(breath(f, 7), 3), ...extra });
const keepBase = (f, seed, extra = {}) => ({ expr: 'smile', L: 'belly', R: 'point', blink: blinkAt(f, seed), bob: q(breath(f, seed), 3), ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S), t = secT(S, f);
  switch (S.id) {
    case 'hook': {
      out.push(RK(T, kenBase(f, { expr: f < (S.a + S.b) / 2 ? 'neutral' : 'smile' }), [-2.35, 0, 3.55], { tint, s: 1.12 }));
      break;
    }
    case 'home': {
      const pos = kenPosAt(f);
      const pose = t < 0.7 ? 'knuckle' : 'sit';
      out.push(RK(T, kenBase(f, { pose, expr: 'smile' }), pos, { tint, s: t < 0.7 ? 0.95 : 0.82, ground: pos[1] }));
      break;
    }
    case 'found': {
      out.push(RKP(T, keepBase(f, 53, { expr: 'shock', R: 'point' }), [-1.1, 0, 0.9], { tint, s: 1.0, yaw: 0.6 }));
      out.push(RKP(T, keepBase(f, 59, { expr: 'nervous', L: 'belly', R: 'belly' }), [1.0, 0, 1.3], { tint, s: 1.0, yaw: -0.5 }));
      out.push(RK(T, kenBase(f, { expr: 'neutral' }), [5.3, 0, 5.0], { tint, s: 1.02, yaw: -0.25 }));
      out.push(RD(T, { sit: true }, [5.3, 0, 10.7], { tint, s: 0.55, shadow: false }));
      break;
    }
    case 'bolts': {
      out.push(RK(T, kenBase(f, { pose: 'signC', expr: 'stubborn' }), [-4.15, 0, 3.35], { tint, s: 0.95, yaw: 0.35 }));
      break;
    }
    case 'again': {
      out.push(RKP(T, keepBase(f, 53, { expr: 'stern', R: 'up' }), [-3.55, 0, 1.25], { tint, s: 1.0, yaw: -0.7 }));
      if (t <= 0.62) out.push(RK(T, kenBase(f, { expr: 'neutral' }), [0.2, 0, 0.2], { tint, s: 1.0 }));
      else { const pos = kenPosAt(f); out.push(RK(T, kenBase(f, { pose: 'knuckle', expr: 'smile' }), pos, { tint, s: 0.98 })); }
      break;
    }
    case 'stroll': {
      const pos = kenPosAt(f);
      const pose = t < 0.68 ? 'knuckle' : 'sit';
      out.push(RK(T, kenBase(f, { pose, expr: t < 0.68 ? 'neutral' : 'smile' }), pos, { tint, s: 1.0, yaw: t < 0.68 ? 0 : -0.3 }));
      out.push(RD(T, { sit: true }, [5.3, 0, 10.7], { tint, s: 0.55, shadow: false }));
      break;
    }
    case 'gentle': {
      const gpos = t < 0.25 ? lerp3([4.6, 0, 4.9], [3.3, 0, 4.4], smooth(t / 0.25)) : [3.3, 0, 4.4];
      out.push(RK(T, kenBase(f, { pose: t < 0.25 ? 'knuckle' : (t > 0.45 ? 'signB' : 'sit'), expr: 'smile' }), gpos, { tint, s: 1.02, yaw: -0.2, ground: 0 }));
      out.push(RV(T, { expr: 'smile', L: 'down', R: 'down', blink: blinkAt(f, 91), seed: 91 }, [7.1, 0, 4.6], { tint, s: 0.95 }));
      out.push(RV(T, { expr: 'grin', L: 'down', R: 'wave', blink: blinkAt(f, 97), seed: 97, tunic: '#7a5a6e' }, [6.3, 0, 5.5], { tint, s: 0.6 }));
      out.push(RD(T, { sit: true }, [5.3, 0, 10.7], { tint, s: 0.55, shadow: false }));
      break;
    }
    case 'watched': {
      // statue-still joke: no blink, no bob; ONE tiny shift while a keeper looks away
      const shiftW = t > 0.45 && t < 0.6 ? Math.sin((t - 0.45) / 0.15 * Math.PI) : 0;
      out.push(RK(T, { pose: 'sit', expr: 'neutral', blink: t < 0.12 ? blinkAt(f, 7) : 0, bob: 0 }, [0.09 * shiftW, 0, 0], { tint, s: 1.05 }));
      out.push(RKP(T, keepBase(f, 53, { expr: 'stern', R: 'belly' }), [3.5, DECK, -5.7], { tint, s: 0.92, ground: DECK }));
      out.push(RKP(T, keepBase(f, 59, { expr: 'neutral', L: 'belly', R: 'belly' }), [4.7, DECK, -5.75], { tint, s: 0.92, ground: DECK, yaw: shiftW > 0.2 ? 1.25 : 0.25 }));
      break;
    }
    case 'undercover': {
      const pos = kenPosAt(f);
      const duck = t > 0.55 && t < 0.72 ? Math.sin((t - 0.55) / 0.17 * Math.PI) : 0;
      const fx1 = lerp(pos[0] - 1.9, 2.3, duck), fz1 = lerp(5.1, 7.1, duck);
      const fx2 = lerp(pos[0] - 2.7, 3.0, duck), fz2 = lerp(4.6, 7.2, duck);
      out.push(RK(T, kenBase(f, { pose: 'knuckle', expr: 'neutral' }), pos, { tint, s: 1.0, yaw: t > 0.55 && t < 0.72 ? 0.85 : 0 }));
      out.push(RV(T, { expr: 'neutral', L: 'down', R: 'down', blink: blinkAt(f, 121), seed: 121, tunic: '#8a6a3a' }, [fx1, 0, fz1], { tint, s: 0.95 }));
      out.push(RKP(T, keepBase(f, 131, { expr: 'neutral', L: 'down', R: 'down' }), [fx2, 0, fz2], { tint, s: 0.97 }));
      break;
    }
    case 'reveal': {
      out.push(RK(T, kenBase(f, { pose: 'signC', expr: t > 0.7 ? 'stubborn' : 'neutral' }), [-1.15, 0, 1.15], { tint, s: 1.02, yaw: 0.15 }));
      break;
    }
    case 'fixed': {
      out.push(RKP(T, keepBase(f, 53, { expr: 'stern', R: 'up' }), [-1.3, 0, 3.5], { tint, s: 1.0, yaw: 0.2 }));
      out.push(RKP(T, keepBase(f, 59, { expr: 'neutral', L: 'up', R: 'belly' }), [0.7, 0, 3.6], { tint, s: 1.0, yaw: -0.2 }));
      out.push(RK(T, kenBase(f, { pose: t < 0.55 ? 'signB' : 'sit', expr: t > 0.75 ? 'smile' : 'stubborn' }), [0.3, 0, 1.45], { tint, s: 1.0 }));
      break;
    }
    case 'finale': case 'tease': {
      out.push(RK(T, kenBase(f, { pose: 'sit', expr: 'grin' }), [0, 0, 0], { tint, s: 1.1 }));
      out.push(RV(T, { expr: 'smile', L: 'down', R: 'wave', blink: blinkAt(f, 91), seed: 91 }, [-3.6, 0, 4.5], { tint, s: 0.95 }));
      out.push(RV(T, { expr: 'grin', L: 'wave', R: 'down', blink: blinkAt(f, 103), seed: 103, tunic: '#4a6a52' }, [3.9, 0, 4.5], { tint, s: 0.93 }));
      if (S.id === 'tease') out.push(RV(T, { expr: 'smile', L: 'down', R: 'wave', blink: blinkAt(f, 97), seed: 97, tunic: '#7a5a6e' }, [2.9, 0, 5.3], { tint, s: 0.6 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
export const fxAt = (f, T) => [];
