// Shot plan for "The Cat Who Sank Three Ships" (Unsinkable Sam) — timed to voice.mp3 (38.10 s, 30 fps, TOTAL 1143).
// Phrases (s): 0.00-3.48 hook | 4.06-8.96 rescue (1941, Bismarck, named Sam) | 9.60-12.18 Cossack mascot |
// 13.00-15.28 torpedo sinks Cossack (impact f437) | 15.84-20.00 plank, wet, furious, unhurt |
// 20.60-22.26 moves to Ark Royal | 23.12-24.40 "three weeks later, another torpedo" (impact f718) |
// 25.28-26.40 survived again | 27.02-34.10 retired to sailors' home | 34.82-37.26 chasing mice in peace.
// Sets: Cossack zone x~0, Ark Royal zone x~34, garden zone x~74. Sea y=0, ship deck y=2.64.
import { M, camFromKeys, idle, blinkAt, walk, q, clamp, lerp, ramp } from './motion.js';

export const FPS = 30, TOTAL = 1143, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 121, light: 'day' },
  { id: 'rescue', a: 122, b: 287, light: 'day' },
  { id: 'mascot', a: 288, b: 389, light: 'day' },
  { id: 'torp1', a: 390, b: 474, light: 'day' },
  { id: 'plank', a: 475, b: 617, light: 'dusk' },
  { id: 'ark', a: 618, b: 692, light: 'dusk' },
  { id: 'torp2', a: 693, b: 724, light: 'dusk' },
  { id: 'boatwait', a: 725, b: 757, light: 'dusk' },
  { id: 'dry', a: 758, b: 809, light: 'golden' },
  { id: 'retire', a: 810, b: 1043, light: 'golden' },
  { id: 'chase', a: 1044, b: 1142, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
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
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- shared boat paths (worldAt + actorsAt stay in sync) ----------
const boatAPos = (f) => {
  if (f < 122) return [7.5, 0, -4.2, -0.4, 0];
  if (f < 205) { const t = smooth(ramp(f, 122, 205)); return [lerp(7.5, 2.9, t), 0, lerp(-4.2, -2.4, t), lerp(-0.4, -0.15, t), 1]; }
  if (f < 288) return [2.9, 0, -2.4, -0.15, 0.15];
  if (f < 390) return [10.5, 0, -6.5, 0.4, 0];
  return null;
};
const boatLPos = (f, which) => {
  if (f < 475 || f > 617) return null;
  const t = clamp(ramp(f, 480, 612));
  return which === 1
    ? [lerp(9, -7, t), 0, lerp(-9.5, -5.2, t), -1.35, 1]
    : [lerp(12.5, -3.5, t), 0, lerp(-11, -7.0, t), -1.3, 1];
};
const boatBPos = (f) => {
  if (f < 758) return [39.6, 1.9, -11.05, 0, 0];
  if (f < 792) { const t = smooth(ramp(f, 758, 792)); return [lerp(39.6, 37.0, t), lerp(1.9, 0.02, t), lerp(-11.05, -8.2, t), 0, t > 0.85 ? 0.4 : 0]; }
  if (f < 810) { const t = smooth(ramp(f, 792, 810)); return [lerp(37.0, 34.5, t), 0.02, lerp(-8.2, -6.8, t), lerp(0, -0.5, t), 1]; }
  return null;
};

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [0.4, 1.05, 2.6], look: [0, 0.55, -0.7], fov: 40 },
    { f: 121, pos: [0.15, 0.95, 1.9], look: [0, 0.5, -0.8], fov: 37 },
  ],
  rescue: [
    { f: 122, pos: [2.6, 1.9, 5.2], look: [1.4, 0.45, -1.7], fov: 47 },
    { f: 287, pos: [1.8, 1.7, 4.4], look: [1.9, 0.5, -2.0], fov: 45 },
  ],
  mascot: [
    { f: 288, pos: [-0.3, 3.6, -1.4], look: [-0.4, 2.9, -11.55], fov: 34 },
    { f: 389, pos: [-0.7, 3.55, -1.8], look: [-0.9, 2.9, -11.55], fov: 34 },
  ],
  torp1: [
    { f: 390, pos: [-4.2, 3.6, 9.5], look: [-3.5, 1.5, -11.5], fov: 50 },
    { f: 437, pos: [-3.4, 3.4, 8.8], look: [-1.5, 1.5, -11.3], fov: 50 },
    { f: 474, pos: [-3.0, 3.3, 8.4], look: [-0.8, 1.7, -11.8], fov: 48 },
  ],
  plank: [
    { f: 475, pos: [0.7, 1.3, 2.7], look: [0.05, 0.55, -0.85], fov: 39 },
    { f: 617, pos: [0.45, 1.15, 2.15], look: [0, 0.5, -0.8], fov: 37 },
  ],
  ark: [
    { f: 618, pos: [33.3, 3.6, -1.4], look: [33.4, 2.9, -11.55], fov: 34 },
    { f: 692, pos: [33.7, 3.55, -1.8], look: [33.9, 2.9, -11.55], fov: 34 },
  ],
  torp2: [
    { f: 693, pos: [36.2, 2.5, -2.2], look: [38.6, 1.9, -11.0], fov: 38 },
    { f: 724, pos: [36.5, 2.45, -2.5], look: [38.8, 1.9, -11.0], fov: 37 },
  ],
  boatwait: [
    { f: 725, pos: [38.0, 3.0, -7.4], look: [39.6, 2.3, -11.05], fov: 41 },
    { f: 757, pos: [38.3, 2.9, -7.7], look: [39.6, 2.28, -11.05], fov: 39 },
  ],
  dry: [
    { f: 758, pos: [34.6, 1.7, -3.4], look: [38.0, 1.15, -9.4], fov: 43 },
    { f: 809, pos: [32.6, 1.5, -2.6], look: [34.7, 0.65, -6.9], fov: 41 },
  ],
  retire: [
    { f: 810, pos: [73.8, 2.6, 12.5], look: [74.0, 0.8, -3.0], fov: 47 },
    { f: 950, pos: [73.6, 2.3, 9.8], look: [73.8, 0.8, -2.8], fov: 46 },
    { f: 1043, pos: [73.5, 2.1, 8.2], look: [73.6, 0.75, -2.6], fov: 44 },
  ],
  chase: [
    { f: 1044, pos: [66.0, 1.15, -3.9], look: [67.2, 0.4, -7.7], fov: 42 },
    { f: 1108, pos: [77.2, 1.1, -4.1], look: [78.6, 0.4, -7.7], fov: 42 },
    { f: 1142, pos: [76.9, 1.05, -4.3], look: [77.9, 0.45, -7.5], fov: 40 },
  ],
};
const KICKS = { torp1: [{ f: 437, a: 0.07 }], torp2: [{ f: 718, a: 0.06 }] };
const SHADOW_AT = { hook: [0, 0.3, -0.8], rescue: [2.2, 0.2, -2.2], mascot: [0, 2.64, -11.55], torp1: [-1, 1.5, -12], plank: [0, 0.2, -0.8], ark: [32, 2.64, -11.55], torp2: [36, 1, -11], boatwait: [39.6, 2, -11], dry: [36, 0.3, -7.5], retire: [73.5, 0, -1.5], chase: [77.5, 0, -7.5] };
const mouseX = (f) => lerp(66.5, 79.0, clamp(ramp(f, 1048, 1108)));
export const camAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'chase') { // procedural tracking: keys lagged the mouse and lost both animals
    const mx = mouseX(f);
    let pos, look;
    if (f < 1108) { pos = [mx - 1.5, 1.1, -4.0]; look = [mx - 0.45, 0.3, -7.55]; }
    else { const t = smooth(ramp(f, 1108, 1125)); pos = [lerp(77.5, 76.9, t), 1.05, -4.3]; look = [lerp(78.55, 77.9, t), lerp(0.3, 0.45, t), lerp(-7.55, -7.5, t)]; }
    return { pos: pos.map(v => q(v)), look: look.map(v => q(v)), fov: 44, flash: 0, shadowAt: [q(mx), 0, -7.5] };
  }
  const c = camFromKeys(CAMS[S.id], f, { kicks: KICKS[S.id] || [] });
  let flash = 0;
  if (f >= 122 && f < 127) flash = (1 - (f - 122) / 5) * 0.35;
  if (f >= 437 && f < 443) flash = Math.max(flash, (1 - (f - 437) / 6) * 0.55);
  if (f >= 475 && f < 480) flash = Math.max(flash, (1 - (f - 475) / 5) * 0.3);
  if (f >= 618 && f < 623) flash = Math.max(flash, (1 - (f - 618) / 5) * 0.3);
  if (f >= 718 && f < 724) flash = Math.max(flash, (1 - (f - 718) / 6) * 0.5);
  if (f >= 810 && f < 816) flash = Math.max(flash, (1 - (f - 810) / 6) * 0.35);
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, [0, 0.6, -0.8]), cinf: 7 };
    case 'rescue': return { focus: dist(C.pos, [2.2, 0.5, -2.2]), cinf: 6 };
    case 'mascot': return { focus: dist(C.pos, [0, 3.1, -11.55]), cinf: 2 };
    case 'torp1': return { focus: dist(C.pos, [-1.2, 1.6, -11.2]), cinf: 3 };
    case 'plank': return { focus: dist(C.pos, [0, 0.6, -0.8]), cinf: 10 };
    case 'ark': return { focus: dist(C.pos, [32.2, 3.1, -11.55]), cinf: 2 };
    case 'torp2': return { focus: dist(C.pos, [39.6, 2.2, -11.05]), cinf: 3 };
    case 'boatwait': return { focus: dist(C.pos, [39.6, 2.3, -11.05]), cinf: 8 };
    case 'dry': return { focus: dist(C.pos, [36, 0.7, -7.5]), cinf: 6 };
    case 'retire': return { focus: dist(C.pos, [73.5, 0.7, -1.5]), cinf: 4 };
    case 'chase': return { focus: dist(C.pos, [mouseX(f), 0.4, -7.6]), cinf: 6 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state (drives set pieces in main.js worldState) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id };
  W.tiltA = q(ramp(f, 437, 530) * 0.17 + ramp(f, 530, 640) * 0.08);
  W.sinkA = q(ramp(f, 437, 640) * -0.95);
  W.tiltB = q(ramp(f, 718, 830) * 0.17);
  W.sinkB = q(ramp(f, 718, 870) * -0.5);
  W.splashA = q((f > 435 && f < 510) ? Math.sin(ramp(f, 437, 505) * Math.PI) * 1.3 : 0);
  W.splashB = q((f > 716 && f < 792) ? Math.sin(ramp(f, 718, 790) * Math.PI) * 1.3 : 0);
  W.torpA = q((f >= 395 && f < 437) ? lerp(-9.5, -1.2, M.easeIn(ramp(f, 395, 437))) : -999);
  W.torpB = q((f >= 696 && f < 718) ? lerp(24.5, 32.6, M.easeIn(ramp(f, 696, 718))) : -999);
  const bA = boatAPos(f); if (bA) W.boatA = bA.map(v => q(v));
  const l1 = boatLPos(f, 1); if (l1) W.boatL1 = l1.map(v => q(v));
  const l2 = boatLPos(f, 2); if (l2) W.boatL2 = l2.map(v => q(v));
  const bB = boatBPos(f); if (bB) W.boatB = bB.map(v => q(v));
  return W;
};

// ---------- actors (2D cards) ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const CAT = (T, o, pos, extra = {}) => ({ key: 'sam' + JSON.stringify(o), draw: (p) => T.catCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const TINT = { day: '#ffffff', golden: '#ffe2c8', night: '#b9c8ff', dusk: '#ffd9ae' };
const rowTilt = (f, amp = 3) => q(Math.sin(f * 0.11) * amp, 1);

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  switch (S.id) {
    case 'hook': {
      out.push(CAT(T, { expr: 'smug', lick: 1, sit: true, blink: q(blinkAt(f, 5), 2), tailA: q(Math.sin(f * 0.05) * 0.4, 2) }, [0, 0.14, -0.8], { tint, s: 0.5, ground: 0.08 }));
      break;
    }
    case 'rescue': {
      const bA = boatAPos(f), id = idle(f, 11);
      // Sam: on the plank, then lifted into the boat
      if (f < 215) out.push(CAT(T, { expr: 'unimpressed', wet: 1, sit: true, blink: q(blinkAt(f, 5), 2) }, [0, 0.14, -0.8], { tint, s: 0.42, ground: 0.08 }));
      else if (f < 248) { const t = smooth(ramp(f, 215, 248)); out.push(CAT(T, { expr: 'alert', wet: 1, blink: 0 }, [lerp(0, 2.75, t), lerp(0.14, 0.44, t) + Math.sin(t * Math.PI) * 0.35, lerp(-0.8, -2.35, t)], { tint, s: 0.42, blob: false, roll: q(Math.sin(t * Math.PI) * 0.14, 0.01) })); }
      else out.push(CAT(T, { expr: f > 268 ? 'calm' : 'unimpressed', wet: 1, sit: true, blink: q(blinkAt(f, 5), 2) }, [2.75, 0.4, -2.35], { tint, s: 0.42, blob: false }));
      // bow sailor: spots, hauls, celebrates
      const bowO = f < 205 ? { expr: 'wonder', L: 'hang', R: 'point' } : f < 248 ? { expr: 'stern', L: 'hang', R: 'reach', lift: 1 } : { expr: 'grin', L: 'hang', R: 'thumb' };
      out.push(R(T, 'sailor41a', { seed: 41, blink: q(blinkAt(f, 41), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1), ...bowO }, [bA[0] + 0.68, 0.34, bA[2] + 0.08], { tint, blob: false }));
      // stern sailor rows
      out.push(R(T, 'sailor41b', { seed: 42, expr: f > 248 ? 'smile' : 'neutral', L: 'reach', R: 'reach', blink: q(blinkAt(f, 42), 2), bob: q(id.bob, 3), tilt: f < 205 ? rowTilt(f) : q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [bA[0] - 0.72, 0.34, bA[2] - 0.08], { tint, blob: false }));
      break;
    }
    case 'mascot': {
      const id = idle(f, 12);
      const sx = lerp(-2.6, 2.4, smooth(ramp(f, 295, 380)));
      const stp = (f > 295 && f < 380) ? q(walk(f, 295, 0.85, 0.34).phase) : 0;
      out.push(CAT(T, { expr: 'smug', step: stp, blink: q(blinkAt(f, 5), 2), tailA: q(Math.sin(f * 0.07) * 0.5, 2) }, [sx, 2.94, -11.52], { tint, s: 0.38, ground: 2.94 }));
      out.push(R(T, 'sailor41a', { seed: 41, expr: 'smile', L: 'hang', R: 'up', blink: q(blinkAt(f, 41), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [-1.5, 2.64, -11.52], { tint, ground: 2.64 }));
      out.push(R(T, 'sailor41c', { seed: 43, expr: 'grin', L: 'up', R: 'hang', blink: q(blinkAt(f, 43), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [0.9, 2.64, -11.52], { tint, ground: 2.64 }));
      out.push(R(T, 'officer41', { seed: 44, expr: f > 348 ? 'smile' : 'stern', L: 'hip', R: 'hang', blink: q(blinkAt(f, 44), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [3.3, 2.64, -11.52], { tint, ground: 2.64 }));
      break;
    }
    case 'torp1': {
      const id = idle(f, 13);
      out.push(R(T, 'sailor41b', { seed: 42, expr: f >= 408 ? 'shock' : 'neutral', L: 'hang', R: f >= 408 ? 'point' : 'hang', blink: q(blinkAt(f, 42), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [-3.4, 2.64, -11.85], { tint, ground: 2.64 }));
      out.push(R(T, 'officer41', { seed: 44, expr: 'stern', L: 'point', R: 'hang', blink: q(blinkAt(f, 44), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [-4.6, 2.64, -11.9], { tint, ground: 2.64 }));
      out.push(CAT(T, { expr: f >= 437 ? 'alert' : 'calm', sit: true, blink: q(blinkAt(f, 5), 2) }, [1.9, 2.64, -11.8], { tint, s: 0.36, ground: 2.64 }));
      break;
    }
    case 'plank': {
      out.push(CAT(T, { expr: 'furious', wet: 1, blink: 0, tailA: q(Math.sin(f * 0.3) * 0.9, 2) }, [0, 0.14, -0.8], { tint, s: 0.46, ground: 0.08 }));
      const l1 = boatLPos(f, 1), l2 = boatLPos(f, 2), id = idle(f, 14);
      if (l1) {
        out.push(R(T, 'sailor41a', { seed: 41, expr: 'stern', L: 'reach', R: 'reach', blink: q(blinkAt(f, 41), 2), bob: q(id.bob, 3), tilt: rowTilt(f), headTilt: q(id.headTilt, 1) }, [l1[0] + 0.55, 0.34, l1[2] + 0.05], { tint, s: 0.68, blob: false }));
        out.push(R(T, 'sailor41b', { seed: 42, expr: 'neutral', L: 'reach', R: 'reach', blink: q(blinkAt(f, 42), 2), bob: q(id.bob, 3), tilt: rowTilt(f + 9), headTilt: q(id.headTilt, 1) }, [l1[0] - 0.55, 0.34, l1[2] - 0.05], { tint, s: 0.68, blob: false }));
      }
      if (l2) {
        out.push(R(T, 'sailor41c', { seed: 43, expr: 'smile', L: 'reach', R: 'reach', blink: q(blinkAt(f, 43), 2), bob: q(id.bob, 3), tilt: rowTilt(f + 4), headTilt: q(id.headTilt, 1) }, [l2[0] + 0.55, 0.34, l2[2] + 0.05], { tint, s: 0.68, blob: false }));
        out.push(R(T, 'officer41', { seed: 44, expr: 'stern', L: 'hang', R: 'point', blink: q(blinkAt(f, 44), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [l2[0] - 0.55, 0.34, l2[2] - 0.05], { tint, s: 0.68, blob: false }));
      }
      break;
    }
    case 'ark': {
      const id = idle(f, 15);
      const sx = lerp(30.9, 33.4, smooth(ramp(f, 622, 685)));
      const stp = (f > 622 && f < 685) ? q(walk(f, 622, 0.8, 0.34).phase) : 0;
      out.push(CAT(T, { expr: 'calm', step: stp, blink: q(blinkAt(f, 5), 2) }, [sx, 2.94, -11.52], { tint, s: 0.38, ground: 2.94 }));
      out.push(R(T, 'sailor41c', { seed: 43, expr: 'squint', L: 'hang', R: 'cheek', blink: q(blinkAt(f, 43), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [34.8, 2.64, -11.52], { tint, ground: 2.64 }));
      out.push(R(T, 'officer41', { seed: 44, expr: 'stern', L: 'cross', R: 'cross', blink: q(blinkAt(f, 44), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [36.3, 2.64, -11.52], { tint, ground: 2.64 }));
      break;
    }
    case 'torp2': {
      const id = idle(f, 16);
      out.push(R(T, 'officer41', { seed: 44, expr: 'shock', L: 'hang', R: 'point', blink: q(blinkAt(f, 44), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [30.3, 2.64, -11.85], { tint, s: 0.7, ground: 2.64 }));
      // the joke beat: Sam is ALREADY in the lifeboat, waiting, while the torpedo approaches
      out.push(CAT(T, { expr: 'smug', lick: 1, sit: true, blink: q(blinkAt(f, 5), 2), tailA: q(Math.sin(f * 0.06) * 0.4, 2) }, [39.6, 2.24, -11.05], { tint, s: 0.42, blob: false }));
      break;
    }
    case 'boatwait': {
      const id = idle(f, 17);
      out.push(CAT(T, { expr: 'smug', lick: 1, sit: true, blink: q(blinkAt(f, 5), 2), tailA: q(Math.sin(f * 0.06) * 0.4, 2) }, [39.6, 2.24, -11.05], { tint, s: 0.42, blob: false }));
      out.push(R(T, 'sailor41b', { seed: 42, expr: 'shock', L: 'hang', R: 'reach', blink: q(blinkAt(f, 42), 2), bob: q(id.bob, 3), tilt: q(7, 1), headTilt: q(id.headTilt, 1) }, [38.3, 2.64, -11.85], { tint, ground: 2.64 }));
      break;
    }
    case 'dry': {
      const bB = boatBPos(f), id = idle(f, 18);
      const rowing = f >= 792;
      out.push(CAT(T, { expr: 'unimpressed', sit: true, blink: q(blinkAt(f, 5), 2) }, [bB[0], bB[1] + 0.36, bB[2]], { tint, s: 0.52, blob: false }));
      out.push(R(T, 'sailor41a', { seed: 41, expr: 'smile', L: 'reach', R: 'reach', blink: q(blinkAt(f, 41), 2), bob: q(id.bob, 3), tilt: rowing ? rowTilt(f) : q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [bB[0] - 0.85, bB[1] + 0.34, bB[2]], { tint, s: 0.62, blob: false }));
      out.push(R(T, 'sailor41c', { seed: 43, expr: 'pained', L: 'reach', R: 'reach', blink: q(blinkAt(f, 43), 2), bob: q(id.bob, 3), tilt: rowing ? rowTilt(f + 9) : q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [bB[0] + 0.85, bB[1] + 0.34, bB[2]], { tint: '#c9d6ff', s: 0.62, blob: false }));
      break;
    }
    case 'retire': {
      const id = idle(f, 19);
      if (f < 950) { const t = smooth(ramp(f, 815, 950)); const stp = q(walk(f, 815, 0.75, 0.34).phase); out.push(CAT(T, { expr: 'calm', step: stp, blink: q(blinkAt(f, 5), 2) }, [lerp(73.3, 73.0, t), 0, lerp(5.2, -1.5, t)], { tint, s: 0.46, ground: 0 })); }
      else out.push(CAT(T, { expr: 'smug', sit: true, lick: f > 1000 ? 1 : 0, blink: q(blinkAt(f, 5), 2), tailA: q(Math.sin(f * 0.05) * 0.4, 2) }, [72.7, 0, -2.2], { tint, s: 0.48, ground: 0 }));
      out.push(R(T, 'retireA', { seed: 31, expr: 'smile_closed', L: 'belly', R: 'belly', blink: q(blinkAt(f, 31), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [76.8, 0, -3.6], { tint, ground: 0 }));
      out.push(R(T, 'retireB', { seed: 32, expr: 'smile', L: 'hang', R: f < 950 ? 'wave' : 'hip', wv: q(f * 0.1, 2), blink: q(blinkAt(f, 32), 2), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(id.headTilt, 1) }, [72.9, 0, -10.2], { tint, ground: 0 }));
      break;
    }
    case 'chase': {
      const mx = mouseX(f);
      if (f < 1108) { const stp = q(walk(f, 1048, 1.6, 0.34).phase); out.push(CAT(T, { expr: 'alert', step: stp, blink: 0 }, [mx - 1.1, 0, -7.45], { tint, s: 0.46, ground: 0 })); }
      else out.push(CAT(T, { expr: 'smug', sit: true, lick: f >= 1120 ? 1 : 0, blink: q(blinkAt(f, 5), 2) }, [77.7, 0, -7.35], { tint, s: 0.46, ground: 0 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const flap = (i) => q(((f * 0.055) + i * 0.37) % 1, 2);
  if (S.id === 'hook') {
    out.push(FX('gull0', (p) => T.fxGull(p, flap(0)), [-2.6, 3.2, -5.5], 0.55));
    out.push(FX('gull1', (p) => T.fxGull(p, flap(1)), [2.8, 3.9, -8], 0.7));
  }
  if (S.id === 'rescue') out.push(FX('gull0', (p) => T.fxGull(p, flap(0)), [4.5, 3.4, -6], 0.6));
  if (S.id === 'torp1') out.push(FX('gull0', (p) => T.fxGull(p, flap(0)), [-6, 4.5, -9], 0.8));
  if (S.id === 'plank') out.push(FX('gull0', (p) => T.fxGull(p, flap(0)), [-3.5, 3.0, -6.5], 0.6));
  if (S.id === 'retire' || S.id === 'chase') { // drifting leaves in the garden
    for (let i = 0; i < 4; i++) {
      const t = ((f - 810) * 0.009 + i / 4) % 1; if (t < 0) continue;
      const cols = ['#7fae4c', '#a8c256', '#e0a83e'];
      out.push(FX('leaf' + (i % 3), (p) => T.fxLeaf(p, cols[i % 3]), [70 + t * 8, 2.6 - t * 2.2, -1.5 + i * 0.5], 0.11, { roll: q(t * 8 + i, 1) }));
    }
  }
  if (S.id === 'chase') { // the mouse
    const running = f < 1108;
    const mx = running ? lerp(66.5, 79.0, clamp(ramp(f, 1048, 1108))) : 79.4;
    const ph = running ? q(((f - 1048) * 0.09) % 1, 2) : 0;
    out.push(FX('mouse' + ph, (p) => T.fxMouse(p, ph), [mx, running ? 0 : 0.02, running ? -7.7 : -8.15], running ? 0.34 : 0.3));
  }
  return out;
};
