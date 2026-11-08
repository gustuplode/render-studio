// Shot plan for "The Octopus Who Escaped to the Ocean" — timed to voice.mp3 (30 fps), LOCKED to work/phrases.json (whisper).
// Voice 40.70s -> TOTAL 1221 frames. Phrases (frames): P1 0-53 aquarium/NZ | P2 70-124 Inky had a secret |
// P3 156-216 every night/visitors home | P4 232-310 squeezed out of a tiny gap | P5 326-404 slid across floor/drainpipe |
// P6 417-442 just to explore | P7 460-517 always came back before morning | P8 548-636 staff/trails/blamed the mop |
// P9 665-689 then one night | P10 699-734 chose the other pipe | P11 762-786 the long one |
// P12 803-863 ran straight out to the sea | P13 863-924 he never came back | P14 950-1015 searched every tank |
// P15 1039-1057 nothing | P16 1082-1116 just an empty tank | P17 1124-1197 a wet trail/and the whole ocean/finally his.
// Sets live in separate zones: aquarium room x~0, drainpipe interior x~30, open ocean x~60 (see main.js).
import { M, camFromKeys, idle, blinkAt, q, lerp, ramp } from './motion.js';

export const FPS = 30, TOTAL = 1221;
export const SHOTS = [
  { id: 'hook', a: 0, b: 155, light: 'day' },
  { id: 'nightfall', a: 156, b: 231, light: 'night' },
  { id: 'squeeze', a: 232, b: 325, light: 'night' },
  { id: 'slide', a: 326, b: 416, light: 'night' },
  { id: 'explore', a: 417, b: 459, light: 'pipe' },
  { id: 'return', a: 460, b: 547, light: 'dawn' },
  { id: 'staff', a: 548, b: 664, light: 'day' },
  { id: 'choice', a: 665, b: 862, light: 'night' },
  { id: 'pipe', a: 863, b: 949, light: 'pipe' },
  { id: 'empty', a: 950, b: 1123, light: 'dawn' },
  { id: 'finale', a: 1124, b: 1220, light: 'dawn' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;
const CUT = 1150; // finale: room recap before, ocean after (on "and the whole ocean")

// ---------- lights ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 130, el: 48, sky: '#cfe8f2', ground: '#5d7a72', hemi: 1.15, sun: '#fff3da', sunI: 2.4, fog: '#cfe4ee', fogNear: 40, fogFar: 230,
    skyTop: '#3f8ac4', skyHor: '#d6ecf6', sunDisc: '#fff3c8', sunSize: 0.003, sat: 1.1, vig: 0.2, shadowExt: 14, ...WATER },
  night: { az: 205, el: 34, sky: '#2c3c5c', ground: '#101820', hemi: 0.55, sun: '#8fb4e8', sunI: 0.7, fog: '#16222e', fogNear: 14, fogFar: 95,
    skyTop: '#0c1626', skyHor: '#22344c', sat: 1.02, vig: 0.34, shadowExt: 10, waterDeep: '#14242f', waterShal: '#28485c', glint: '#b9d9f2' },
  dawn: { az: 62, el: 17, sky: '#b8c8d8', ground: '#3c4650', hemi: 0.85, sun: '#ffc98a', sunI: 1.7, fog: '#a8bcc8', fogNear: 25, fogFar: 160,
    skyTop: '#5c7c9c', skyHor: '#f2cfa0', sunDisc: '#ffe9c0', sunSize: 0.003, sat: 1.05, vig: 0.27, shadowExt: 12, waterDeep: '#24506a', waterShal: '#4d90ac', glint: '#ffe9c8' },
  pipe: { az: 0, el: 60, sky: '#1a2833', ground: '#05090d', hemi: 0.4, sun: '#7fa8c8', sunI: 0.3, fog: '#0a1218', fogNear: 3, fogFar: 24,
    skyTop: '#06090d', skyHor: '#0d1822', sat: 0.95, vig: 0.42, shadowExt: 6, waterDeep: '#0d2733', waterShal: '#1d4256', glint: '#9fc8e8' },
  ocean: { az: 250, el: 52, sky: '#33526b', ground: '#0c1e2a', hemi: 0.8, sun: '#a9c8ff', sunI: 1.15, fog: '#10344c', fogNear: 16, fogFar: 110,
    skyTop: '#0a2438', skyHor: '#2c5a78', sat: 1.06, vig: 0.3, shadowExt: 12, waterDeep: '#0e3a54', waterShal: '#2e6c8c', glint: '#dff2ff' },
};
export const lightFor = (S, f) => S.id === 'finale' ? { ...(f < CUT ? LIGHTS.dawn : LIGHTS.ocean) } : { ...LIGHTS[S.light] };

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [0.25, 2.1, 6.6], look: [0, 1.7, -1.2], fov: 44 },
    { f: 70, pos: [0.15, 2.0, 4.6], look: [0.08, 1.6, -1.2], fov: 40, ease: 'easeOut' },
    { f: 155, pos: [0.1, 1.95, 3.9], look: [0.1, 1.65, -1.2], fov: 38 },
  ],
  nightfall: [
    { f: 156, pos: [2.0, 2.1, 3.6], look: [0.3, 1.9, -1.2], fov: 38 },
    { f: 231, pos: [1.6, 2.35, 2.6], look: [0.8, 2.7, -1.2], fov: 36 },
  ],
  squeeze: [
    { f: 232, pos: [1.7, 2.8, 3.1], look: [0.85, 2.95, -1.2], fov: 38 },
    { f: 300, pos: [1.6, 2.78, 2.8], look: [0.85, 3.02, -1.2], fov: 37 },
    { f: 325, pos: [1.55, 2.85, 2.6], look: [0.85, 3.12, -1.2], fov: 36 },
  ],
  slide: [
    { f: 326, pos: [2.6, 1.15, 4.6], look: [1.0, 1.6, -0.6], fov: 43 },
    { f: 370, pos: [2.9, 0.95, 4.3], look: [1.2, 0.25, 0.9], fov: 42 },
    { f: 416, pos: [3.1, 0.9, 4.15], look: [1.88, 0.1, 2.65], fov: 41 },
  ],
  explore: [
    { f: 417, pos: [30, 1.32, 5.2], look: [30, 0.9, 1.5], fov: 44 },
    { f: 459, pos: [30, 1.3, 3.4], look: [30, 0.85, 0.2], fov: 44 },
  ],
  return: [
    { f: 460, pos: [3.1, 1.0, 4.3], look: [1.9, 0.2, 2.7], fov: 42 },
    { f: 490, pos: [2.4, 1.5, 5.0], look: [1.1, 0.9, 0.6], fov: 42 },
    { f: 515, pos: [1.8, 2.6, 3.4], look: [0.85, 2.7, -1.2], fov: 40 },
    { f: 547, pos: [0.2, 2.3, 4.6], look: [0.3, 2.0, -1.2], fov: 41 },
  ],
  staff: [
    { f: 548, pos: [1.7, 1.95, 6.3], look: [1.6, 0.6, 1.85], fov: 44 },
    { f: 610, pos: [1.9, 1.8, 5.7], look: [2.0, 0.6, 1.8], fov: 43 },
    { f: 664, pos: [2.1, 1.7, 5.4], look: [2.6, 0.65, 1.65], fov: 42 },
  ],
  choice: [
    { f: 665, pos: [3.6, 2.0, 7.2], look: [-0.3, 0.25, 2.6], fov: 45 },
    { f: 745, pos: [3.2, 1.8, 6.6], look: [-0.4, 0.25, 2.65], fov: 44 },
    { f: 800, pos: [0.4, 1.5, 5.9], look: [-2.0, 0.2, 2.85], fov: 41 },
    { f: 862, pos: [-0.9, 1.35, 5.3], look: [-2.4, 0.1, 2.9], fov: 39 },
  ],
  pipe: [
    { f: 863, pos: [30, 1.32, 8.4], look: [30, 0.8, -0.5], fov: 46 },
    { f: 949, pos: [30, 1.32, -4.1], look: [30, 0.8, -13], fov: 46 },
  ],
  empty: [
    { f: 950, pos: [-0.3, 2.3, 7.6], look: [-0.3, 1.4, -0.6], fov: 45 },
    { f: 1039, pos: [-0.7, 2.15, 6.2], look: [-0.9, 1.5, -0.8], fov: 42 },
    { f: 1123, pos: [-0.8, 2.05, 5.2], look: [-1.0, 1.55, -0.9], fov: 40 },
  ],
  finaleRoom: [
    { f: 1124, pos: [2.6, 1.95, 4.9], look: [1.45, 0.6, 1.35], fov: 43 },
    { f: 1149, pos: [2.45, 1.85, 4.5], look: [1.5, 0.55, 1.45], fov: 42 },
  ],
  finaleOcean: [
    { f: 1150, pos: [55.9, 1.5, 0.1], look: [58.35, 1.05, -5.9], fov: 43 },
    { f: 1190, pos: [56.0, 1.5, -0.2], look: [58.0, 1.2, -4.6], fov: 44, ease: 'easeOut' },
    { f: 1220, pos: [56.2, 1.55, -0.6], look: [57.55, 1.45, -3.55], fov: 45 },
  ],
};
const KICKS = { squeeze: [{ f: 313, a: 0.05 }], finale: [{ f: 1152, a: 0.04 }] };
const SHADOW_AT = { hook: [0, 1.2, -1], nightfall: [0.6, 1.6, -1.2], squeeze: [0.85, 3.0, -1.2], slide: [1.5, 0.2, 1.6], explore: [30, 0.6, 1], return: [0, 1.2, -1], staff: [1.8, 0.6, 1.8], choice: [-0.6, 0.2, 2.5], pipe: [30, 0.6, -3], empty: [0, 1.2, -1] };
export const camAt = (f) => {
  const S = shotAt(f);
  let c;
  if (S.id === 'finale') {
    c = camFromKeys(f < CUT ? CAMS.finaleRoom : CAMS.finaleOcean, f, { kicks: KICKS.finale });
    c.shadowAt = f < CUT ? [0.8, 0.3, 1.2] : [57.8, 1.0, -4];
  } else {
    c = camFromKeys(CAMS[S.id], f, { kicks: KICKS[S.id] || [] });
    c.shadowAt = SHADOW_AT[S.id];
  }
  c.flash = f >= 460 && f < 466 ? (1 - (f - 460) / 6) * 0.5 : 0;
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, [0.1, 1.3, -1.2]), cinf: 7 };
    case 'nightfall': return { focus: dist(C.pos, [0.8, 2.2, -1.2]), cinf: 10 };
    case 'squeeze': return { focus: dist(C.pos, [0.85, 3.15, -1.2]), cinf: 9 };
    case 'slide': return { focus: dist(C.pos, [1.5, 0.3, 1.6]), cinf: 6 };
    case 'explore': return { focus: dist(C.pos, [30, 0.7, 2]), cinf: 4 };
    case 'return': return { focus: dist(C.pos, [0.2, 1.4, -1.2]), cinf: 5 };
    case 'staff': return { focus: dist(C.pos, [1.9, 0.9, 1.9]), cinf: 7 };
    case 'choice': return { focus: dist(C.pos, [-0.6, 0.3, 2.5]), cinf: 7 };
    case 'pipe': return { focus: dist(C.pos, [30, 0.7, -3]), cinf: 4 };
    case 'empty': return { focus: dist(C.pos, [0, 1.8, -1.2]), cinf: 8 };
    case 'finale': return f < CUT ? { focus: dist(C.pos, [0.8, 0.4, 1.2]), cinf: 5 } : { focus: dist(C.pos, [57.8, 1.4, -3.8]), cinf: lerp(7, 0, ramp(f, CUT + 45, TOTAL - 1)) };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state (drives set pieces in main.js worldState) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  return { shot: S.id, trail: S.id === 'staff' || S.id === 'empty' || (S.id === 'finale' && f < CUT) };
};

// ---------- actors (2D cards) ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const INKY = (T, o, pos, extra = {}) => ({ key: 'inky' + JSON.stringify(o), draw: (p) => T.octopusCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { day: '#ffffff', night: '#a9c2e8', dawn: '#e9edf2', pipe: '#86a6bf', ocean: '#b9d9f2' };

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = S.id === 'finale' ? (f < CUT ? TINT.dawn : TINT.ocean) : (TINT[S.light] || '#ffffff');
  switch (S.id) {
    case 'hook': {
      const id = idle(f, 5);
      out.push(INKY(T, { expr: f < 100 ? 'happy' : 'sneaky', pose: 'wave', wv: q(f * 0.22, 1), blink: blinkAt(f, 5) }, [0.1, 1.05, -1.2], { tint, s: 0.7, ground: 0.7 }));
      out.push(R(T, 'kidA', { seed: 31, expr: 'grin', L: 'wave', R: 'wave', wv: q(f * 0.35, 1), blink: blinkAt(f, 31), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [0.55, 0, 1.45], { tint, s: 0.6 }));
      out.push(R(T, 'keeperA', { seed: 11, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [-1.0, 0, 1.75], { tint, s: 0.92 }));
      break;
    }
    case 'nightfall': {
      const t = smooth(ramp(f, 165, 228));
      out.push(INKY(T, { expr: f < 215 ? 'curious' : 'determined', pose: 'swim', wv: q(f * 0.28, 1), blink: blinkAt(f, 5) }, [lerp(0.1, 0.78, t), lerp(0.98, 1.95, t), -1.2], { tint, s: 0.62, blob: false, shadow: false }));
      break;
    }
    case 'squeeze': {
      if (f < 259) { // rise to the lid inside the water
        const t = smooth(ramp(f, 232, 258));
        out.push(INKY(T, { expr: 'determined', pose: 'swim', wv: q(f * 0.3, 1), blink: blinkAt(f, 5) }, [lerp(0.78, 0.85, t), lerp(1.95, 2.42, t), -1.2], { tint, s: 0.62, blob: false, shadow: false }));
      } else if (f < 311) { // THE GAG: he stretches thin and tall, face straining just under the rim
        const p = smooth(ramp(f, 259, 310));
        out.push(INKY(T, { expr: 'determined', pose: 'squeeze', sx: q(lerp(1, 0.38, p), 2), sy: q(lerp(1, 1.85, p), 2), blink: blinkAt(f, 5) }, [0.85, lerp(2.42, 2.55, p), -1.2], { tint, s: 0.62, blob: false, shadow: false }));
      } else { // pop out on top of the lid, jelly wobble, wave
        const k = ramp(f, 311, 324);
        out.push(INKY(T, { expr: 'joy', pose: f < 318 ? 'squeeze' : 'wave', wv: q(f * 0.3, 1), sx: q(lerp(0.38, 1, M.back(k)), 2), sy: q(lerp(1.85, 1, M.back(k)), 2), blink: blinkAt(f, 5) }, [0.85, lerp(2.55, 3.27, M.back(k)), -1.2], { tint, s: 0.62, blob: false, shadow: false }));
      }
      break;
    }
    case 'slide': {
      if (f < 361) { // slide down the cabinet front
        const t = ramp(f, 326, 360), te = t * t;
        out.push(INKY(T, { expr: 'determined', pose: f < 338 ? 'hang' : 'slide', wv: q(f * 0.3, 1), blink: blinkAt(f, 5) }, [lerp(0.85, 1.02, t), lerp(3.27, 0, te), lerp(-1.15, 0.72, t)], { tint, s: 0.62, blob: false, shadow: false }));
      } else if (f < 405) { // the great floor glide (landing squash settles first)
        const t = smooth(ramp(f, 368, 404));
        const w = M.spring((f - 361) / 15, 4, 4);
        out.push(INKY(T, { expr: 'sneaky', pose: 'slide', wv: q(f * 0.3, 1), sx: q(lerp(1.25, 1, w), 2), sy: q(lerp(0.78, 1, w), 2), blink: blinkAt(f, 5) }, [lerp(1.02, 1.72, t), 0, lerp(0.72, 2.05, t)], { tint, s: 0.62, yaw: -0.3 }));
      } else { // spiral down drain A
        const t = ramp(f, 405, 416);
        out.push(INKY(T, { expr: 'joy', pose: 'slide', wv: q(f * 0.35, 1), blink: blinkAt(f, 5) }, [lerp(1.78, 1.9, t), lerp(0, -0.55, t), lerp(2.2, 2.7, t)], { tint, s: lerp(0.62, 0.45, t), roll: q(t * 6.2, 2), blob: false, shadow: false }));
      }
      break;
    }
    case 'explore': { // "just to explore": a happy spin inside the pipe
      out.push(INKY(T, { expr: 'joy', pose: 'swim', wv: q(f * 0.3, 1), blink: blinkAt(f, 5) }, [30, 0.42 + Math.sin(f * 0.18) * 0.05, lerp(3.4, 0.6, smooth(ramp(f, 417, 459)))], { tint, s: 0.8, blob: false, shadow: false }));
      break;
    }
    case 'return': {
      if (f < 477) { // pop back up out of drain A
        const t = ramp(f, 460, 476);
        out.push(INKY(T, { expr: 'sneaky', pose: 'slide', wv: q(f * 0.3, 1), blink: blinkAt(f, 5) }, [1.9, lerp(-0.55, 0, t), 2.7], { tint, s: lerp(0.45, 0.62, t), blob: false, shadow: false }));
      } else if (f < 501) { // hurry back across the floor
        const t = smooth(ramp(f, 477, 500));
        out.push(INKY(T, { expr: 'sneaky', pose: 'slide', wv: q(f * 0.34, 1), blink: blinkAt(f, 5) }, [lerp(1.9, 1.05, t), 0, lerp(2.7, 0.75, t)], { tint, s: 0.62, yaw: 0.3 }));
      } else if (f < 521) { // climb the cabinet front
        const t = ramp(f, 501, 520), te = t * t;
        out.push(INKY(T, { expr: 'determined', pose: 'hang', wv: q(f * 0.3, 1), blink: blinkAt(f, 5) }, [lerp(1.02, 0.85, t), lerp(0, 3.27, te), lerp(0.72, -1.15, t)], { tint, s: 0.62, blob: false, shadow: false }));
      } else if (f < 539) { // drop back in through the gap
        const t = ramp(f, 521, 538), te = 1 - (1 - t) * (1 - t);
        out.push(INKY(T, { expr: 'curious', pose: 'swim', wv: q(f * 0.32, 1), blink: blinkAt(f, 5) }, [0.85, lerp(3.27, 1.55, te), -1.2], { tint, s: 0.62, blob: false, shadow: false }));
      } else { // settle on the tank floor, innocence itself
        const t = smooth(ramp(f, 539, 547));
        out.push(INKY(T, { expr: 'innocent', pose: 'fold', wv: q(f * 0.06, 1), blink: blinkAt(f, 5) }, [lerp(0.85, 0.15, t), lerp(1.55, 0.95, t), -1.2], { tint, s: 0.62, ground: 0.7 }));
      }
      break;
    }
    case 'staff': {
      const id = idle(f, 7);
      const accuse = f >= 608;
      out.push(INKY(T, { expr: 'innocent', pose: 'fold', wv: q(f * 0.05, 1), blink: blinkAt(f, 5) }, [0.35, 0.92, -1.2], { tint, s: 0.62, ground: 0.7 }));
      out.push(R(T, 'keeperA', { seed: 11, expr: 'stern', L: 'hang', R: accuse ? 'point' : 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(4 + id.tilt * 0.3, 1), headTilt: q(5, 1) }, [1.35, 0, 2.0], { tint, s: 0.92 }));
      out.push(R(T, 'keeperB', { seed: 13, expr: accuse ? 'stern' : 'squint', L: 'hang', R: accuse ? 'point' : 'temple', blink: blinkAt(f, 13), bob: q(id.bob, 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [2.45, 0, 2.15], { tint, s: 0.92 }));
      break;
    }
    case 'choice': {
      if (f < 698) { // slide in from the tank side
        const t = smooth(ramp(f, 665, 697));
        out.push(INKY(T, { expr: 'sneaky', pose: 'slide', wv: q(f * 0.3, 1), blink: blinkAt(f, 5) }, [lerp(0.7, 0.15, t), 0, lerp(1.1, 2.05, t)], { tint, s: 0.62, yaw: -0.2 }));
      } else if (f < 756) { // the pause between two drains
        out.push(INKY(T, { expr: 'curious', pose: 'hang', wv: q(f * 0.07, 1), blink: blinkAt(f, 5) }, [0.1, 0, 2.15], { tint, s: 0.62, roll: q(Math.sin(f * 0.05) * 0.04, 2) }));
      } else if (f < 801) { // decision made: slide to the long one
        const t = smooth(ramp(f, 758, 800));
        out.push(INKY(T, { expr: 'determined', pose: 'slide', wv: q(f * 0.26, 1), blink: blinkAt(f, 5) }, [lerp(0.05, -1.95, t), 0, lerp(2.15, 2.78, t)], { tint, s: 0.62, yaw: 0.25 }));
      } else if (f < 839) { // at the rim of the long pipe, looking down
        out.push(INKY(T, { expr: 'determined', pose: 'hang', wv: q(f * 0.07, 1), blink: blinkAt(f, 5) }, [-2.12, 0, 2.82], { tint, s: 0.62, roll: q(Math.sin(f * 0.06) * 0.03, 2) }));
      } else { // slip away down the long pipe
        const t = ramp(f, 839, 864);
        out.push(INKY(T, { expr: 'joy', pose: 'slide', wv: q(f * 0.35, 1), blink: blinkAt(f, 5) }, [lerp(-2.2, -2.4, t), lerp(0, -0.45, t), lerp(2.85, 2.9, t)], { tint, s: lerp(0.62, 0.5, t), roll: q(Math.sin(t * Math.PI) * 0.35, 2), blob: false, shadow: false }));
      }
      break;
    }
    case 'pipe': {
      const t = smooth(ramp(f, 863, 949));
      out.push(INKY(T, { expr: f < 915 ? 'determined' : 'joy', pose: 'swim', wv: q(f * 0.32, 1), blink: blinkAt(f, 5) }, [30, 0.34 + Math.sin(f * 0.2) * 0.04, lerp(3.2, -9.4, t)], { tint, s: 0.8, blob: false, shadow: false }));
      break;
    }
    case 'empty': {
      const id = idle(f, 8);
      const found = f >= 1025, sag = f >= 1075;
      out.push(R(T, 'keeperA', { seed: 11, expr: sag ? 'pained' : found ? 'shock' : 'squint', L: sag ? 'hang' : 'temple', R: sag ? 'hang' : 'up', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q((sag ? 6 : 2) + id.tilt * 0.3, 1), headTilt: q(sag ? 7 : id.headTilt, 1) }, [lerp(0.95, -1.55, smooth(ramp(f, 955, 1035))), 0, 0.95], { tint, s: 0.92 }));
      out.push(R(T, 'keeperB', { seed: 13, expr: sag ? 'pained' : 'squint', L: 'hang', R: sag ? 'hang' : 'reach', blink: blinkAt(f, 13), bob: q(id.bob, 3), tilt: q((sag ? 6 : 3) + id.tilt * 0.3, 1), headTilt: q(sag ? 7 : id.headTilt, 1) }, [1.5, 0, 1.4], { tint, s: 0.92 }));
      break;
    }
    case 'finale': {
      if (f < CUT) { // the empty tank, one last quiet look
        const id = idle(f, 8);
        out.push(R(T, 'keeperA', { seed: 11, expr: 'pained', L: 'hang', R: 'hang', blink: blinkAt(f, 11), bob: q(id.bob, 3), tilt: q(6 + id.tilt * 0.3, 1), headTilt: q(7, 1) }, [2.2, 0, 1.9], { tint, s: 0.92 }));
      } else { // THE PAYOFF: out of the pipe, into the whole ocean
        const pb = ramp(f, CUT, CUT + 34), pe = M.easeOut(pb);
        const spread = pb >= 1;
        out.push(INKY(T, { expr: 'joy', pose: spread ? 'spread' : 'swim', wv: q(f * (spread ? 0.1 : 0.3), 1), blink: blinkAt(f, 5) }, [lerp(58.4, 57.55, pe), lerp(0.95, 1.5, pe) + Math.sin(pb * Math.PI) * 0.25, lerp(-5.9, -3.55, pe)], { tint, s: 0.85, blob: false, shadow: false }));
      }
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'nightfall' && f >= 208 && f < 228) { // a glint on the gap as he spots it
    const t = q((f - 208) / 20, 2);
    out.push(FX('burst' + t, (p) => T.fxBurst(p, t, '#ffe9a8'), [0.85, 3.3, -1.1], 0.26));
  }
  if (S.id === 'squeeze' && f >= 311 && f < 327) { // droplets as he pops through
    const t = q((f - 311) / 16, 2);
    out.push(FX('splash' + t, (p) => T.fxSplash(p, t), [0.85, 3.05, -1.05], 0.34));
  }
  if (S.id === 'slide' && f >= 405 && f < 421) { // drain A swallows him
    const t = q((f - 405) / 16, 2);
    out.push(FX('splash' + t, (p) => T.fxSplash(p, t), [1.9, 0.02, 2.7], 0.4));
  }
  if (S.id === 'return' && f >= 524 && f < 540) { // back into the water
    const t = q((f - 524) / 16, 2);
    out.push(FX('splash' + t, (p) => T.fxSplash(p, t), [0.85, 2.95, -1.05], 0.34));
  }
  if (S.id === 'choice' && f >= 846 && f < 862) { // the long pipe takes him
    const t = q((f - 846) / 16, 2);
    out.push(FX('splash' + t, (p) => T.fxSplash(p, t), [-2.4, 0.02, 2.9], 0.4));
  }
  if (S.id === 'finale' && f >= CUT && f < CUT + 18) { // the ocean receives him
    const t = q((f - CUT) / 18, 2);
    out.push(FX('splash' + t, (p) => T.fxSplash(p, t), [58.35, 0.5, -5.6], 0.55));
  }
  if (S.id === 'finale' && f >= CUT + 32 && f < CUT + 54) { // sparkle burst on the spread
    const t = q((f - CUT - 32) / 22, 2);
    out.push(FX('burst' + t, (p) => T.fxBurst(p, t, '#cfeaff'), [57.55, 1.9, -3.4], 0.42));
  }
  return out;
};
