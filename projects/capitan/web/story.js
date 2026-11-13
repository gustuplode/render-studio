// Shot plan for "Capitán — The Dog Who Slept on His Owner's Grave for 11 Years"
// Timed to capitan-voice (59.625 s, 30 fps, TOTAL 1789, 13 phrases).
// Phrases: P1 0-122 | P2 155-263 | P3 304-413 | P4 444-545 | P5 575-656 | P6 683-802 |
// P7 827-931 | P8 964-1030 | P9 1060-1152 | P10 1180-1281 | P11 1311-1394 |
// P12 1423-1551 | P13 1551-1756. Sections tile 0..1788; gaps belong to the
// outgoing section. One world (house west, path, cemetery east), ONE continuous
// camera flight: every section's first camera key == previous section's last key.
// Set (main.js): grave (2.4,0,-2.2), plaque on the stone, easel (4.35,0,-1.15),
// gate (2.4,0,1.0), house door (-5.4,0,~3.6 world), path via (1.1,4.0)/(-1.4,5.6).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1789, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 154, light: 'night' },
  { id: 'intro', a: 155, b: 303, light: 'night' },
  { id: 'home', a: 304, b: 443, light: 'eve' },
  { id: 'gone', a: 444, b: 574, light: 'eve' },
  { id: 'search', a: 575, b: 682, light: 'dusk' },
  { id: 'found', a: 683, b: 826, light: 'night' },
  { id: 'alone', a: 827, b: 963, light: 'night' },
  { id: 'taken', a: 964, b: 1059, light: 'dusk' },
  { id: 'walk', a: 1060, b: 1179, light: 'eve' },
  { id: 'workers', a: 1180, b: 1310, light: 'night' },
  { id: 'years', a: 1311, b: 1422, light: 'night' },
  { id: 'dawn', a: 1423, b: 1550, light: 'dawn' },
  { id: 'tease', a: 1551, b: 1788, light: 'dawn' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  night: { az: 200, el: 18, sky: '#26314a', ground: '#1c2436', hemi: 0.55, sun: '#b9c8e8', sunI: 0.85, fog: '#232f47', fogNear: 30, fogFar: 260,
    skyTop: '#141d33', skyHor: '#3a4a6b', sunDisc: '#e8eef8', sunSize: 0.0028, sat: 0.94, vig: 0.34, shadowExt: 16, aurora: 0, gain: '#dfe8fa', ...WATER },
  cool: { az: 215, el: 15, sky: '#1f2a44', ground: '#18202f', hemi: 0.48, sun: '#aebfe0', sunI: 0.7, fog: '#1d2942', fogNear: 28, fogFar: 240,
    skyTop: '#101827', skyHor: '#31405f', sunDisc: '#dfe8f4', sunSize: 0.0026, sat: 0.88, vig: 0.36, shadowExt: 16, aurora: 0, gain: '#d4e0f4', ...WATER },
  eve: { az: 250, el: 22, sky: '#c9a58e', ground: '#4a4230', hemi: 0.95, sun: '#ffb763', sunI: 1.9, fog: '#c9a184', fogNear: 38, fogFar: 320,
    skyTop: '#5f6fb0', skyHor: '#ffbe86', sunDisc: '#ffdca8', sunSize: 0.0034, sat: 1.06, vig: 0.26, shadowExt: 16, aurora: 0, gain: '#ffedd6', ...WATER },
  dusk: { az: 262, el: 12, sky: '#6b5a72', ground: '#38303e', hemi: 0.72, sun: '#e8a06a', sunI: 1.2, fog: '#5c5468', fogNear: 34, fogFar: 290,
    skyTop: '#2e3d63', skyHor: '#c97e56', sunDisc: '#f4c48e', sunSize: 0.003, sat: 1.0, vig: 0.3, shadowExt: 16, aurora: 0, gain: '#f2ddc8', ...WATER },
  dawn: { az: 95, el: 14, sky: '#c9b49a', ground: '#4c4436', hemi: 0.88, sun: '#ffc98a', sunI: 1.6, fog: '#cbb49a', fogNear: 38, fogFar: 320,
    skyTop: '#5f7fc0', skyHor: '#ffd9a8', sunDisc: '#fff0cd', sunSize: 0.0034, sat: 1.04, vig: 0.27, shadowExt: 16, aurora: 0, gain: '#ffedd6', ...WATER },
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
  switch (S.id) {
    case 'intro': return blendLight(LIGHTS.night, LIGHTS.eve, smooth(ramp(f, 155, 260)));
    case 'gone': return blendLight(LIGHTS.eve, LIGHTS.dusk, smooth(ramp(f, 444, 530)));
    case 'search': return blendLight(LIGHTS.dusk, LIGHTS.night, smooth(ramp(f, 575, 660)));
    case 'walk': return blendLight(LIGHTS.eve, LIGHTS.night, smooth(ramp(f, 1060, 1150)));
    case 'years': {
      const t1 = smooth(ramp(f, 1311, 1355)), t2 = smooth(ramp(f, 1375, 1422));
      return blendLight(blendLight(LIGHTS.night, LIGHTS.cool, t1), LIGHTS.night, t2);
    }
    case 'dawn': return blendLight(LIGHTS.night, LIGHTS.dawn, smooth(ramp(f, 1423, 1505)));
    default: return { ...LIGHTS[S.light] };
  }
};

// ---------- staging ----------
export const GRAVE_POS = [2.4, 0, -1.0];
export const DOOR_POS = [-5.2, 0, 4.8];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

const DOG_TRACKS = {
  gone: [[444, DOOR_POS], [490, [-3.4, 0, 5.9]], [520, [0.2, 0, 5.2]], [548, [2.4, 0, 1.9]], [574, [2.4, 0, -0.6]]],
  taken: [[964, GRAVE_POS], [990, [2.4, 0, 0.6]], [1008, [2.4, 0, 1.7]], [1020, [1.6, 0, 3.4]], [1035, [1.9, 0, 2.2]], [1059, [2.35, 0, 0.9]]],
  walk: [[1060, [2.35, 0, 0.9]], [1100, [2.4, 0, 0.2]], [1140, [2.4, 0, -0.5]], [1179, GRAVE_POS]],
  years: [[1311, [2.35, 0, 0.9]], [1360, [2.4, 0, 0.1]], [1395, [2.4, 0, -0.6]], [1422, GRAVE_POS]],
};
export const dogPosAt = (f) => {
  const S = shotAt(f);
  if (DOG_TRACKS[S.id]) return kf3(DOG_TRACKS[S.id], f);
  if (S.id === 'home') return [...DOOR_POS];
  return [...GRAVE_POS];
};
export const dogScaleAt = (f) => {
  if (f < 304) return 1.0;
  if (f < 434) return 0.6;                       // the young dog of 2005 (P3)
  if (f < 458) return lerp(0.6, 1.0, smooth((f - 434) / 24)); // growth across the eve->dusk light change
  return 1.0;
};
const dogLieAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'home': case 'taken': return 0;
    case 'gone': return smooth(ramp(f, 548, 568));
    case 'walk': return smooth(ramp(f, 1152, 1170));
    case 'years': return smooth(ramp(f, 1398, 1416));
    default: return 1;
  }
};
const dogHeadUpAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return f < 55 ? smooth(ramp(f, 18, 48)) : lerp(1, 0.55, smooth(ramp(f, 90, 140)));
    case 'found': return smooth(ramp(f, 740, 780));
    case 'workers': return smooth(ramp(f, 1235, 1265));
    case 'dawn': case 'tease': return 0.25;
    default: return 0.7;
  }
};
const dogGreyAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'years') return 0.55;
  if (S.id === 'dawn' || S.id === 'tease') return 0.7;
  return 0;
};
const SEARCH_TRACK = [[575, [-1.6, 0, 5.3]], [620, [0.2, 0, 5.0]], [682, [1.9, 0, 3.4]], [710, [1.8, 0, 0.6]], [760, [1.6, 0, 0.2]]];
export const searchPosAt = (f) => kf3(SEARCH_TRACK, f);

// ---------- cameras (boundary-matched continuous flight) ----------
const CAMS = {
  hook: [
    { f: 0, pos: [2.35, 0.72, 1.35], look: [2.4, 0.5, -1.35], fov: 40 },
    { f: 70, pos: [2.38, 0.7, 0.95], look: [2.4, 0.52, -1.35], fov: 38, ease: 'surge' },
    { f: 154, pos: [2.38, 0.72, 0.9], look: [2.4, 0.52, -1.35], fov: 38 },
  ],
  intro: [
    { f: 155, pos: [2.38, 0.72, 0.9], look: [2.4, 0.52, -1.35], fov: 38 },
    { f: 230, pos: [0.5, 3.4, 9.5], look: [1.2, 0.6, -2.5], fov: 47, ease: 'surge' },
    { f: 303, pos: [-3.4, 2.2, 10.5], look: [-4.6, 1.0, 4.2], fov: 46 },
  ],
  home: [
    { f: 304, pos: [-3.4, 2.2, 10.5], look: [-4.6, 1.0, 4.2], fov: 46 },
    { f: 370, pos: [-5.0, 1.5, 9.6], look: [-5.3, 1.0, 4.4], fov: 43, ease: 'surge' },
    { f: 443, pos: [-5.15, 1.25, 8.6], look: [-5.3, 0.95, 4.5], fov: 41 },
  ],
  gone: [
    { f: 444, pos: [-5.15, 1.25, 8.6], look: [-5.3, 0.95, 4.5], fov: 41 },
    { f: 500, pos: [-3.2, 1.7, 10.8], look: [-3.6, 0.9, 4.8], fov: 45, ease: 'surge' },
    { f: 574, pos: [0.8, 2.4, 10.2], look: [1.4, 0.7, 2.2], fov: 46 },
  ],
  search: [
    { f: 575, pos: [0.8, 2.4, 10.2], look: [1.4, 0.7, 2.2], fov: 46 },
    { f: 620, pos: [0.4, 1.5, 10.6], look: [0.2, 0.9, 4.6], fov: 44, ease: 'surge' },
    { f: 682, pos: [1.8, 1.6, 8.8], look: [2.2, 0.8, 1.8], fov: 45 },
  ],
  found: [
    { f: 683, pos: [1.8, 1.6, 8.8], look: [2.2, 0.8, 1.8], fov: 45 },
    { f: 740, pos: [2.5, 1.5, 5.4], look: [2.45, 0.6, -0.6], fov: 44, ease: 'surge' },
    { f: 826, pos: [2.4, 1.0, 3.1], look: [2.4, 0.5, -1.4], fov: 41 },
  ],
  alone: [
    { f: 827, pos: [2.4, 1.0, 3.1], look: [2.4, 0.5, -1.4], fov: 41 },
    { f: 885, pos: [2.55, 1.02, 5.1], look: [1.58, 0.7, -2.3], fov: 46, ease: 'surge' },
    { f: 946, pos: [2.55, 1.02, 5.1], look: [1.58, 0.7, -2.3], fov: 46 },
    { f: 963, pos: [2.92, 1.05, 3.55], look: [2.9, 0.72, -2.55], fov: 42 },
  ],
  taken: [
    { f: 964, pos: [2.92, 1.05, 3.55], look: [2.9, 0.72, -2.55], fov: 42 },
    { f: 1010, pos: [2.5, 1.2, 4.6], look: [2.4, 0.6, 0.6], fov: 43, ease: 'surge' },
    { f: 1059, pos: [0.6, 1.5, 8.6], look: [0.2, 0.8, 4.4], fov: 44 },
  ],
  walk: [
    { f: 1060, pos: [0.6, 1.5, 8.6], look: [0.2, 0.8, 4.4], fov: 44 },
    { f: 1120, pos: [1.9, 1.3, 5.2], look: [2.2, 0.55, 0.4], fov: 43, ease: 'surge' },
    { f: 1179, pos: [2.35, 0.9, 2.9], look: [2.4, 0.5, -1.3], fov: 40 },
  ],
  workers: [
    { f: 1180, pos: [2.35, 0.9, 2.9], look: [2.4, 0.5, -1.3], fov: 40 },
    { f: 1240, pos: [2.9, 1.05, 3.1], look: [2.7, 0.55, -1.2], fov: 41, ease: 'surge' },
    { f: 1310, pos: [2.95, 1.0, 3.0], look: [2.7, 0.55, -1.2], fov: 41 },
  ],
  years: [
    { f: 1311, pos: [2.95, 1.0, 3.0], look: [2.7, 0.55, -1.2], fov: 41 },
    { f: 1360, pos: [2.2, 1.1, 3.6], look: [2.35, 0.55, -1.2], fov: 42, ease: 'surge' },
    { f: 1422, pos: [2.35, 0.95, 3.0], look: [2.4, 0.52, -1.3], fov: 40 },
  ],
  dawn: [
    { f: 1423, pos: [2.35, 0.95, 3.0], look: [2.4, 0.52, -1.3], fov: 40 },
    { f: 1490, pos: [2.55, 1.02, 5.1], look: [1.58, 0.7, -2.3], fov: 46, ease: 'surge' },
    { f: 1550, pos: [2.56, 1.0, 5.05], look: [1.61, 0.7, -2.3], fov: 46 },
  ],
  tease: [
    { f: 1551, pos: [2.56, 1.0, 5.05], look: [1.61, 0.7, -2.3], fov: 46 },
    { f: 1680, pos: [2.58, 1.0, 5.0], look: [1.65, 0.68, -2.3], fov: 45.5, ease: 'surge' },
    { f: 1788, pos: [2.6, 0.98, 4.95], look: [1.68, 0.68, -2.3], fov: 45.5 },
  ],
};
const SHADOW_AT = { hook: [2.4, 0.5, -1], intro: [1, 0.5, -2], home: [-5.3, 0.8, 4.5], gone: [-2, 0.6, 4], search: [0.4, 0.6, 4], found: [2.4, 0.5, -1], alone: [2.7, 0.6, -1.8], taken: [2.2, 0.5, 1], walk: [2.4, 0.5, -0.5], workers: [2.7, 0.5, -1], years: [2.4, 0.5, -0.8], dawn: [2.4, 0.5, -1], tease: [2.4, 0.5, -1] };
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
    case 'home': point = [-5.3, 0.9, 4.6]; cinf = 5; break;
    case 'search': point = searchPosAt(f); cinf = 6; break;
    case 'gone': case 'taken': case 'walk': case 'years': point = dogPosAt(f); cinf = 6; break;
    case 'alone': point = [2.7, 0.7, -2.0]; cinf = 5; break;
    default: point = [2.4, 0.55, -1.2]; cinf = 5;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, dust: 0.2, windK: 0.4, grassK: 0.5, boardAlone: 0, boardFinale: 0, plaqueT: 0, doorGlow: 0.05, gateT: 0.3, bowlT: 0, lanternT: 0, ambT: 0.12 };
  switch (S.id) {
    case 'hook': W.plaqueT = 1; W.doorGlow = 0; break;
    case 'intro': W.doorGlow = 0.2; break;
    case 'home': W.doorGlow = 0.95; W.gateT = 0; W.grassK = 0.8; break;
    case 'gone': W.doorGlow = 0.6; W.gateT = smooth(ramp(f, 470, 505)); break;
    case 'search': W.doorGlow = 0.25; W.gateT = 1; W.lanternT = smooth(ramp(f, 578, 600)) * (1 - smooth(ramp(f, 655, 682))); W.dust = 0.14; break;
    case 'found': W.doorGlow = 0.1; W.gateT = 1; W.lanternT = 0.5 * (1 - smooth(ramp(f, 683, 715))); W.plaqueT = smooth(ramp(f, 745, 790)); break;
    case 'alone': W.doorGlow = 0.1; W.gateT = 1; W.boardAlone = smooth(ramp(f, 888, 918)) * (1 - smooth(ramp(f, 928, 946))); W.plaqueT = smooth(ramp(f, 890, 915)); break;
    case 'taken': W.doorGlow = 0.3; W.gateT = 1; W.boardAlone = 0; break;
    case 'walk': W.doorGlow = 0.35; W.gateT = 1; W.grassK = 0.8; W.plaqueT = smooth(ramp(f, 1135, 1170)); break;
    case 'workers': W.doorGlow = 0.1; W.gateT = 1; W.bowlT = smooth(ramp(f, 1228, 1252)); W.plaqueT = 1; break;
    case 'years': W.doorGlow = 0.1; W.gateT = 1; W.bowlT = 1; W.ambT = 0.8; W.grassK = 0.35; W.plaqueT = smooth(ramp(f, 1375, 1410)); break;
    case 'dawn': W.doorGlow = 0.2; W.gateT = 1; W.bowlT = 1; W.ambT = 0.35; W.boardFinale = smooth(ramp(f, 1492, 1530)); W.plaqueT = 1; break;
    case 'tease': W.doorGlow = 0.2; W.gateT = 1; W.bowlT = 1; W.ambT = 0.3; W.boardFinale = 1; W.plaqueT = 1; break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'years': return { smokeRate: 1.3, dustRate: 0.5 };
    case 'search': case 'gone': return { smokeRate: 0.5, dustRate: 0.2 };
    case 'dawn': case 'tease': return { smokeRate: 0.9, dustRate: 0.35 };
    default: return { smokeRate: 0.7, dustRate: 0.25 };
  }
};

// ---------- actors ----------
const TINT = { night: '#cdd8ea', eve: '#ffe9c4', dusk: '#f2d4b8', dawn: '#ffd9a3' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
const RD = (T, o, pos, extra = {}) => ({ key: 'dog' + JSON.stringify(o), draw: (p) => T.dogCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RP = (T, o, pos, extra = {}) => ({ key: 'pat' + JSON.stringify(o), draw: (p) => T.pattersonCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RK = (T, o, pos, extra = {}) => ({ key: 'keep' + JSON.stringify(o), draw: (p) => T.keeperCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RV = (T, o, pos, extra = {}) => ({ key: 'vis' + JSON.stringify(o), draw: (p) => T.visitorCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const humBase = (f, seed, extra = {}) => ({ expr: 'smile', L: 'belly', R: 'point', blink: blinkAt(f, seed), bob: q(breath(f, seed), 3), ...extra });
const walkStep = (f, rate = 0.045) => q((f * rate) % 1, 3);

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S);
  const ds = dogScaleAt(f), lie = dogLieAt(f), headUp = dogHeadUpAt(f), grey = dogGreyAt(f);
  const dPos = dogPosAt(f);
  const dogWalk = ['gone', 'taken', 'walk', 'years'].includes(S.id) && lie < 0.05;
  const dogO = { lie: q(lie, 3), headUp: q(headUp, 3), grey, step: dogWalk ? walkStep(f, S.id === 'years' ? 0.03 : 0.045) : 0, pant: 0, sit: false, burrs: 0 };
  const dogExtra = { tint, s: 0.62 * ds, blobW: 1.5 };
  switch (S.id) {
    case 'hook': {
      out.push(RD(T, dogO, dPos, { ...dogExtra, s: 0.78 })); // BIG in the hook frame
      break;
    }
    case 'intro': out.push(RD(T, dogO, dPos, dogExtra)); break;
    case 'home': {
      out.push(RD(T, { ...dogO, lie: 0, step: 0 }, dPos, dogExtra));
      out.push(RP(T, humBase(f, 41, { expr: 'smile', R: f < 380 ? 'point' : 'belly' }), [-4.5, 0, 4.95], { tint, s: 0.78, yaw: -0.55 }));
      break;
    }
    case 'gone': out.push(RD(T, dogO, dPos, dogExtra)); break;
    case 'search': {
      out.push(RD(T, dogO, dPos, dogExtra)); // at the grave, off-camera, all along
      const sp = searchPosAt(f);
      out.push(RP(T, humBase(f, 41, { expr: 'nervous', R: 'point', step: walkStep(f) }), sp, { tint, s: 0.78 }));
      out.push(RV(T, { expr: 'nervous', L: 'down', R: 'down', blink: blinkAt(f, 97), seed: 97, step: walkStep(f + 9) }, [sp[0] - 1.1, 0, sp[2] + 0.8], { tint, s: 0.75 }));
      break;
    }
    case 'found': {
      out.push(RD(T, dogO, dPos, dogExtra));
      const fp = kf3([[683, [2.2, 0, 2.4]], [740, [1.9, 0, 0.7]], [800, [1.45, 0, 0.05]]], f);
      out.push(RP(T, humBase(f, 41, { expr: f > 770 ? 'relief' : 'nervous', R: 'belly' }), fp, { tint, s: 0.78, yaw: 0.3 }));
      out.push(RV(T, { expr: f > 770 ? 'relief' : 'nervous', L: 'down', R: 'down', blink: blinkAt(f, 97), seed: 97 }, [fp[0] - 0.85, 0, fp[2] + 0.55], { tint, s: 0.75, yaw: 0.3 }));
      break;
    }
    case 'alone': out.push(RD(T, dogO, dPos, dogExtra)); break;
    case 'taken': {
      out.push(RD(T, dogO, dPos, dogExtra));
      const pp = f < 1020 ? [dPos[0] - 0.62, 0, dPos[2] + 0.4] : [2.75, 0, 2.15]; // walks beside him, then stays at the gate
      out.push(RP(T, humBase(f, 41, { expr: f > 1015 ? 'pained' : 'smile', R: 'belly', step: f < 1015 ? walkStep(f) : 0 }), pp, { tint, s: 0.78, yaw: 0.25 }));
      break;
    }
    case 'walk': out.push(RD(T, dogO, dPos, dogExtra)); break;
    case 'workers': {
      out.push(RD(T, dogO, dPos, dogExtra));
      const kp = kf3([[1180, [2.4, 0, 0.9]], [1225, [2.85, 0, 0.1]], [1252, [3.08, 0, -0.42]]], f);
      out.push(RK(T, humBase(f, 53, { expr: 'smile', R: f < 1252 ? 'belly' : 'point', step: f < 1252 ? walkStep(f) : 0 }), kp, { tint, s: 0.78, yaw: -0.5 }));
      break;
    }
    case 'years': {
      out.push(RD(T, dogO, dPos, dogExtra));
      out.push(RK(T, humBase(f, 53, { expr: 'neutral', R: 'belly' }), [4.9, 0, 0.45], { tint: '#aebdd0', s: 0.78, yaw: -0.4 }));
      break;
    }
    case 'dawn': case 'tease': {
      out.push(RD(T, dogO, dPos, dogExtra));
      out.push(RK(T, humBase(f, 53, { expr: 'neutral', L: 'belly', R: 'belly' }), [4.7, 0, 0.35], { tint, s: 0.78, yaw: -0.45 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
export const fxAt = (f, T) => [];
