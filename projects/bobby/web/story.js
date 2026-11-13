// Greyfriars Bobby — story (timing ESTIMATED from word counts until
// bobby-voice/timing.json lands; TIMING is the only block to re-tile).
// Beats are keyed in section fractions wherever practical so re-tiling is safe.
import { M, camFromKeys } from './motion.js';
import { bobbyCard } from './extras.js';

export const TIMING = [
  ['hook', 0, 201], ['buried', 202, 384], ['shadow', 385, 486], ['lasttime', 487, 610],
  ['chased', 611, 700], ['back', 701, 820], ['gun', 821, 963], ['crowds', 964, 1060],
  ['licence', 1061, 1253], ['collar', 1254, 1397], ['died', 1398, 1529], ['statue', 1530, 1735],
];
export const TOTAL = 1736;
const SEC = {}; TIMING.forEach(([id, a, b]) => { SEC[id] = { a, b }; });
export const shotAt = (f) => { for (const [id, a, b] of TIMING) if (f >= a && f <= b) return { id, a, b, u: (f - a) / (b - a) }; return { id: 'statue', a: 1530, b: 1735, u: 1 }; };
const ramp = (x, a, b) => { const t = (x - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const kf = (f, pts) => M.kf(f, pts);
const path = (pts, u) => { // polyline walk: pts [[x,z],...], u 0..1 by segment count
  const n = pts.length - 1, x = Math.min(0.9999, Math.max(0, u)) * n, i = Math.floor(x), t = ease(x - i);
  return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)];
};

// ---------------- Bobby's position / pose ----------------
// dinner route: grave -> gate -> eating-house doorway bowl -> back
const DINNER = [[0.35, 0.5], [-0.6, 2.6], [-0.85, 3.9], [1.8, 3.6], [4.35, 2.6]];
export const bobbyPosAt = (f) => {
  const S = shotAt(f), u = S.u;
  const greyLate = ramp(f, SEC.died.a, SEC.died.b) * 0.85 + (S.id === 'statue' ? 0 : 0);
  const collar = f >= SEC.collar.a ? 1 : 0;
  switch (S.id) {
    case 'hook': return { x: 0.12, z: 0.12, y: 0.14, pose: 'lie', step: 0, grey: 0.15, collar: 0, wagPh: u * 0.2 };
    case 'buried': return { x: -2.3 + u * 0.9, z: -1.7 + u * 0.5, y: 0, pose: 'side', step: u * 2.2, grey: 0, collar: 0, wagPh: u * 2 };
    case 'shadow': { const p = path([[-2.6, 2.9], [-1.2, 1.6], [0.1, 0.55]], u); return { x: p[0], z: p[1], y: 0, pose: 'side', step: u * 7, grey: 0, collar: 0, wagPh: u * 5 }; }
    case 'lasttime': {
      if (u < 0.55) { const p = path([[0.1, 0.55], [0.16, 0.3]], u / 0.55); return { x: p[0], z: p[1], y: 0, pose: 'side', step: u * 4, grey: 0, collar: 0, wagPh: u * 2 }; }
      return { x: 0.12, z: 0.12, y: 0.14, pose: 'lie', step: 0, grey: 0, collar: 0, wagPh: 0 };
    }
    case 'chased': { // ellipse run around the graves, out the gate at the end
      if (u < 0.78) { const a = u / 0.78 * Math.PI * 1.55; return { x: Math.sin(a) * 2.6, z: -1.4 + Math.cos(a) * 1.9 - 0.4, y: 0, pose: 'side', step: f / 30 * 2.6, grey: 0, collar: 0, wagPh: u * 9, flip: Math.cos(a) < -0.2 }; }
      const p = path([[2.45, -0.6], [0.4, 2.2], [-0.85, 3.8]], (u - 0.78) / 0.22); return { x: p[0], z: p[1], y: 0, pose: 'side', step: f / 30 * 3, grey: 0, collar: 0, wagPh: u * 9, flip: true };
    }
    case 'back': {
      if (u < 0.4) { const p = path([[-0.85, 3.8], [-0.4, 1.8], [0.1, 0.4]], u / 0.4); return { x: p[0], z: p[1], y: 0, pose: 'side', step: f / 30 * 2.4, grey: 0.05, collar: 0, wagPh: u * 4, flip: true }; }
      return { x: 0.12, z: 0.12, y: 0.14, pose: 'lie', step: 0, grey: 0.08, collar: 0, wagPh: 0 };
    }
    case 'gun': { // waits for the gun, then trots DINNER out; eats at the end
      if (u < 0.3) return { x: 0.3, z: 0.35, y: 0, pose: 'side', step: 0, grey: 0.05, collar: 0, wagPh: u * 2 };
      if (u < 0.82) { const p = path(DINNER, (u - 0.3) / 0.52); return { x: p[0], z: p[1], y: 0, pose: 'side', step: f / 30 * 2.8, grey: 0.05, collar: 0, wagPh: u * 8, flip: p[0] < -0.5 && u < 0.45 }; }
      return { x: 4.35, z: 2.6, y: 0, pose: 'side', step: 0, grey: 0.05, collar: 0, wagPh: 0, pant: (f % 40) < 22 };
    }
    case 'crowds': { // trots home through the watchers, settles on the grave
      if (u < 0.55) { const p = path([...DINNER].reverse(), u / 0.55); return { x: p[0], z: p[1], y: 0, pose: 'side', step: f / 30 * 2.8, grey: 0.05, collar: 0, wagPh: u * 8, flip: true }; }
      return { x: 0.12, z: 0.12, y: 0.14, pose: 'lie', step: 0, grey: 0.05, collar: 0, wagPh: u };
    }
    case 'licence': return { x: 0.12, z: 0.12, y: 0.14, pose: 'lie', step: 0, grey: 0.1, collar: 0, wagPh: 0 };
    case 'collar': return { x: 0.3, z: 0.4, y: 0, pose: 'front', step: 0, grey: 0.12, collar: 1, wagPh: u * 2 };
    case 'died': return { x: 0.12, z: 0.12, y: 0.14, pose: 'lie', step: 0, grey: greyLate, collar: 1, wagPh: 0 };
    case 'statue': return { x: 0.12, z: 0.12, y: 0.14, pose: 'lie', step: 0, grey: 0.9, collar: 1, wagPh: 0, alpha: 0 }; // living Bobby gone; the bronze speaks
    default: return { x: 0.12, z: 0.12, y: 0.14, pose: 'lie', step: 0, grey: 0, collar: 0, wagPh: 0 };
  }
};

// ---------------- cameras (one keyframed move per section, hero-tracked) ----------------
// motion.js camFromKeys(K, f): K = [{f, pos, look, fov}]. Look targets for the
// moving beats are sampled from bobbyPosAt AT the key frames, so the camera
// tracks the dog smoothly between keys.
const LK = (kf2, off = [0, 0.78, 0]) => { const B = bobbyPosAt(kf2); return [B.x + off[0], B.y + off[1], B.z + off[2]]; };
export const camAt = (f) => {
  const S = shotAt(f), u = S.u, a = S.a, b = S.b, m = Math.round((a + b) / 2);
  let c;
  switch (S.id) {
    case 'hook': c = camFromKeys([{ f: a, pos: [-0.7, 1.5, 4.6], look: LK(a), fov: 40 }, { f: b, pos: [-0.35, 1.15, 3.1], look: LK(b, [0, 0.7, 0]), fov: 37 }], f); c.shadowAt = [0, 0.3, 0]; return c;
    case 'buried': c = camFromKeys([{ f: a, pos: [-3.6, 1.7, 2.2], look: [-1.6, 0.8, -1.2], fov: 38 }, { f: b, pos: [-2.6, 1.5, 3.4], look: [-0.6, 0.7, -0.4], fov: 36 }], f); c.shadowAt = [-1, 0.3, -1]; return c;
    case 'shadow': c = camFromKeys([{ f: a, pos: [-3.4, 1.6, 5.2], look: LK(a, [0, 0.8, 0]), fov: 40 }, { f: b, pos: [-1.1, 1.25, 3.6], look: LK(b, [0, 0.75, 0]), fov: 37 }], f); c.shadowAt = [0, 0.3, 0]; return c;
    case 'lasttime': c = camFromKeys([{ f: a, pos: [-1.5, 1.35, 3.9], look: LK(a, [0, 0.72, 0]), fov: 39 }, { f: b, pos: [-0.55, 1.0, 2.7], look: LK(b, [0, 0.62, 0]), fov: 36 }], f); c.shadowAt = [0, 0.3, 0]; return c;
    case 'chased': c = camFromKeys([{ f: a, pos: [2.9, 1.9, 4.4], look: LK(a, [0, 0.8, 0]), fov: 41 }, { f: m, pos: [0.6, 1.7, 5.2], look: LK(m, [0, 0.8, 0]), fov: 40 }, { f: b, pos: [-2.2, 1.6, 6.0], look: LK(b, [0, 0.8, 0]), fov: 39 }], f); c.shadowAt = [0, 0.3, 0]; return c;
    case 'back': c = camFromKeys([{ f: a, pos: [-2.0, 1.8, 5.6], look: LK(a, [0, 0.8, 0]), fov: 40 }, { f: b, pos: [-0.6, 1.2, 3.3], look: LK(b, [0, 0.68, 0]), fov: 37 }], f); c.shadowAt = [0, 0.3, 0]; return c;
    case 'gun': c = camFromKeys([{ f: a, pos: [1.9, 1.5, 3.4], look: LK(a, [0, 0.85, 0]), fov: 38 }, { f: m, pos: [0.4, 1.7, 5.6], look: LK(m, [0, 0.8, 0]), fov: 39 }, { f: b, pos: [3.1, 1.35, 5.3], look: LK(b, [0, 0.78, 0]), fov: 37 }], f); c.shadowAt = [1, 0.3, 1]; if (f - a < 7) c.flash = 0.35 * (1 - (f - a) / 7); return c;
    case 'crowds': c = camFromKeys([{ f: a, pos: [3.4, 1.6, 6.2], look: LK(a, [0, 0.8, 0]), fov: 40 }, { f: b, pos: [0.9, 1.3, 4.2], look: LK(b, [0, 0.72, 0]), fov: 37 }], f); c.shadowAt = [0, 0.3, 0]; return c;
    case 'licence': c = camFromKeys([{ f: a, pos: [-3.3, 1.8, 5.4], look: [-1.2, 0.9, 2.6], fov: 39 }, { f: b, pos: [-2.2, 1.5, 4.4], look: [-0.7, 0.85, 1.6], fov: 37 }], f); c.shadowAt = [-1, 0.3, 1]; return c;
    case 'collar': c = camFromKeys([{ f: a, pos: [1.6, 1.28, 3.55], look: LK(a, [0, 0.8, 0]), fov: 38 }, { f: m, pos: [1.25, 1.1, 2.75], look: LK(m, [0, 0.78, 0]), fov: 36 }, { f: b, pos: [0.85, 0.95, 2.0], look: LK(b, [0, 0.74, 0]), fov: 34 }], f); c.shadowAt = [0, 0.3, 0]; return c;
    case 'died': c = camFromKeys([{ f: a, pos: [-1.3, 1.5, 4.3], look: LK(a, [0, 0.7, 0]), fov: 39 }, { f: b, pos: [-0.8, 1.25, 3.4], look: LK(b, [0, 0.66, 0]), fov: 37 }], f); c.shadowAt = [0, 0.3, 0]; return c;
    case 'statue': c = camFromKeys([{ f: a, pos: [-5.4, 1.7, 9.6], look: [-3.6, 1.35, 5.6], fov: 38 }, { f: b, pos: [-4.6, 1.9, 10.6], look: [-3.55, 1.3, 5.6], fov: 36 }], f); c.shadowAt = [-3, 0.3, 4]; return c;
    default: return { pos: [0, 1.4, 5], look: [0, 0.8, 0], fov: 38, shadowAt: [0, 0.3, 0] };
  }
};

// ---------------- lights per section ----------------
const LIGHTS = {
  hook:    { sky: '#aebfe0', ground: '#5a6470', sun: '#ffd9a8', hemi: 0.62, sunI: 1.1, az: -70, el: 9, fog: '#c8b8a4', fogNear: 30, fogFar: 220, sat: 0.98, sunDisc: '#ffcf8a', sunSize: 0.004, shadowExt: 14, vig: 0.34 },
  buried:  { sky: '#bcd2ea', ground: '#6a705c', sun: '#ffe2b0', hemi: 0.78, sunI: 1.7, az: -50, el: 22, fog: '#d8cbb2', fogNear: 34, fogFar: 280, sat: 1.04, sunDisc: '#ffd9a0', sunSize: 0.003, shadowExt: 14 },
  shadow:  { sky: '#c3d6ee', ground: '#707a62', sun: '#ffedbe', hemi: 0.95, sunI: 2.2, az: -38, el: 34, fog: '#cfd8ce', fogNear: 38, fogFar: 320, sat: 1.08, sunDisc: '#ffe9b0', sunSize: 0.0035, shadowExt: 14 },
  lasttime:{ sky: '#b9cadd', ground: '#66705e', sun: '#ffdca6', hemi: 0.8, sunI: 1.6, az: -55, el: 18, fog: '#d3c6ac', fogNear: 34, fogFar: 260, sat: 1.0, sunDisc: '#ffd9a0', sunSize: 0.003, shadowExt: 14 },
  chased:  { sky: '#5a6c8c', ground: '#3e4652', sun: '#aebfdf', hemi: 0.42, sunI: 0.55, az: -40, el: 10, fog: '#7787a0', fogNear: 24, fogFar: 170, sat: 0.9, sunDisc: '#8aa2c8', sunSize: 0, shadowExt: 14, vig: 0.38 },
  back:    { sky: '#cfdce8', ground: '#707a68', sun: '#ffeec4', hemi: 0.85, sunI: 1.5, az: 30, el: 16, fog: '#dcd8c8', fogNear: 30, fogFar: 240, sat: 1.0, sunDisc: '#ffeec0', sunSize: 0.003, shadowExt: 14 },
  gun:     { sky: '#c3d8f2', ground: '#707a62', sun: '#fff0c2', hemi: 1.0, sunI: 2.4, az: -20, el: 38, fog: '#d3dde2', fogNear: 40, fogFar: 340, sat: 1.09, sunDisc: '#ffedb8', sunSize: 0.004, shadowExt: 16 },
  crowds:  { sky: '#c3d8f2', ground: '#707a62', sun: '#ffedbe', hemi: 0.98, sunI: 2.3, az: -30, el: 34, fog: '#d3dde2', fogNear: 40, fogFar: 340, sat: 1.08, sunDisc: '#ffe9b0', sunSize: 0.0035, shadowExt: 16 },
  licence: { sky: '#bccbe0', ground: '#68705e', sun: '#ffe9c0', hemi: 0.88, sunI: 1.9, az: -42, el: 26, fog: '#ccd2cc', fogNear: 36, fogFar: 300, sat: 1.03, sunDisc: '#ffe4ae', sunSize: 0.003, shadowExt: 15 },
  collar:  { sky: '#c8daf0', ground: '#707a62', sun: '#fff0c2', hemi: 1.0, sunI: 2.4, az: -25, el: 36, fog: '#d3dde2', fogNear: 40, fogFar: 340, sat: 1.1, sunDisc: '#ffedb8', sunSize: 0.004, shadowExt: 12 },
  died:    { sky: '#c2ccd8', ground: '#666e60', sun: '#f2e3c2', hemi: 0.72, sunI: 1.2, az: -60, el: 13, fog: '#d8d4c6', fogNear: 28, fogFar: 220, sat: 0.94, sunDisc: '#f2ddae', sunSize: 0.003, shadowExt: 14, vig: 0.32 },
  statue:  { sky: '#b9c8e4', ground: '#5f6a5e', sun: '#ffd9a8', hemi: 0.66, sunI: 1.3, az: -75, el: 10, fog: '#cfc0aa', fogNear: 30, fogFar: 240, sat: 1.0, sunDisc: '#ffcf8a', sunSize: 0.004, shadowExt: 16, vig: 0.33 },
};
export const lightFor = (S, f) => {
  const L = { ...(LIGHTS[S.id] || LIGHTS.gun) };
  const seq = TIMING.map(([id]) => id);
  const i = seq.indexOf(S.id), prev = LIGHTS[seq[Math.max(0, i - 1)]], next = LIGHTS[seq[Math.min(seq.length - 1, i + 1)]];
  const mixL = (A, B, t) => { const o = {}; for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k] ?? A[k], t) : (t < 0.5 ? A[k] : B[k]); return o; };
  let out = L;
  if (S.u < 0.14 && i > 0) out = mixL(prev, L, ramp(S.u, 0, 0.14));
  if (S.u > 0.9 && i < seq.length - 1) out = mixL(out === L ? L : out, next, ramp(S.u, 0.9, 1));
  out.skyTop = out.sky; out.skyHor = out.fog;
  out.aurora = out.aurora || 0; out.vig = out.vig ?? 0.22; out.sunSize = out.sunSize || 0;
  return out;
};
export const dofAt = (f) => {
  const S = shotAt(f); const C = camAt(f); const B = bobbyPosAt(f);
  const d = Math.hypot(C.pos[0] - B.x, C.pos[1] - (B.y + 1), C.pos[2] - B.z);
  return { focus: S.id === 'statue' ? Math.hypot(C.pos[0] + 3.6, C.pos[1] - 2, C.pos[2] - 5.6) : Math.max(1.2, d), cinf: S.id === 'collar' ? 5 : 6.5, near: 1.6 };
};

// ---------------- world state ----------------
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    board1858: S.id === 'buried' ? ramp(S.u, 0.05, 0.15) * (1 - ramp(S.u, 0.2, 0.33)) : 0,
    boardStay: S.id === 'collar' ? ramp(S.u, 0.05, 0.15) * (1 - ramp(S.u, 0.2, 0.28)) : 0,
    boardFinale: S.id === 'statue' ? ramp(S.u, 0.06, 0.3) : 0,
    gateT: (S.id === 'chased' && S.u > 0.8 ? ramp(S.u, 0.8, 0.88) * (1 - ramp(S.u, 0.96, 1)) : 0)
      + (S.id === 'gun' && S.u > 0.38 && S.u < 0.62 ? Math.sin(ramp(S.u, 0.38, 0.62) * Math.PI) : 0)
      + (S.id === 'crowds' && S.u < 0.3 ? Math.sin(ramp(S.u, 0, 0.3) * Math.PI) : 0),
    bowlT: (S.id === 'gun' && S.u > 0.6) || S.id === 'crowds' && S.u < 0.2 ? 1 : 0,
    lampT: S.id === 'hook' ? 1 : S.id === 'chased' ? 0.9 : 0,
    mistT: S.id === 'back' ? 0.7 : S.id === 'hook' ? 0.35 : S.id === 'died' ? 0.4 : 0,
    grassK: 0.5, windK: S.id === 'back' ? 0.7 : 0,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const gunBurst = S.id === 'gun' && S.u < 0.14 ? 30 * (1 - S.u / 0.14) : 0;
  return { smokeRate: gunBurst, dustRate: 0 };
};

// ---------------- actors ----------------
const GRAY = { skin: '#e8b48c', jacket: '#5a4632', pants: '#4c4238', boots: '#33302a', build: 'adult', hair: '#c9c2b4' };
const KEEPER = { skin: '#d99e72', jacket: '#3f4a3a', pants: '#3c3830', boots: '#2c2822', build: 'stout', hair: '#4a3a28' };
const PROVOST = { skin: '#eec39a', jacket: '#2c2c34', pants: '#2e2c30', boots: '#211f24', build: 'stout', hair: '#8a8578' };
const OFFICIAL = { skin: '#e0aa7e', jacket: '#37455c', pants: '#333a48', boots: '#26262c', build: 'adult', hair: '#2c2620' };
const FOLK = [['#7a4a3a', '#4a3a5c'], ['#5d7a35', '#37455c'], ['#8a6a2a', '#5c2e2e'], ['#4a6a8a', '#3c3428']];
export const actorsAt = (f, T) => {
  const S = shotAt(f), u = S.u, B = bobbyPosAt(f);
  const out = [];
  const blinkB = (f % 97) < 3 || (f % 61) < 2;
  const bob = { key: 'bobby' + JSON.stringify({ p: B.pose, s: Math.round((B.step || 0) * 4), g: Math.round((B.grey || 0) * 6), c: B.collar || 0, bl: blinkB ? 1 : 0, pant: B.pant ? 1 : 0 }),
    draw: (p) => T.bobbyCard(p, { pose: B.pose, step: B.step, blink: blinkB, grey: B.grey, collar: B.collar, wagPh: B.wagPh, pant: B.pant }),
    x: B.x, y: B.y, z: B.z, ground: B.y, s: 0.62, flip: !!B.flip, alpha: B.alpha ?? 1 };
  if ((B.alpha ?? 1) > 0.02) out.push(bob);
  const folk = (i, x, z, s = 0.98, expr = 'neutral', phase = 0) => {
    const [jk, pn] = FOLK[i % FOLK.length];
    const outfit = { skin: '#eec39a', jacket: jk, pants: pn, boots: '#2c2822', build: 'adult', hair: '#3a2e20' };
    const bp = { expr, blink: (f % 89) < 3, step: 0, breathe: Math.sin(f * 0.05 + phase) * 0.5 + 0.5, airY: 0 };
    return { key: 'folk' + i + JSON.stringify(bp), draw: (p) => T.bodyFront(p, outfit, bp), x, y: 0, z, ground: 0, s };
  };
  if (S.id === 'buried') { // mourners stand round the fresh grave; Bobby sits apart
    out.push(folk(0, -1.5, -1.9, 0.98, 'stern'));
    out.push(folk(1, -0.7, -2.2, 0.95, 'stern', 2));
    out.push(folk(2, 0.8, -2.0, 0.97, 'pained', 4));
  }
  if (S.id === 'shadow') { // John Gray walks; Bobby at his heels (already in B path)
    const g = path([[-2.9, 3.1], [-1.5, 1.8], [-0.15, 0.75]], Math.min(1, u * 1.06));
    const bp = { expr: 'neutral', blink: (f % 101) < 3, step: u * 7, breathe: 0.5, airY: 0 };
    out.push({ key: 'gray' + JSON.stringify(bp), draw: (p) => T.bodyFront(p, GRAY, bp), x: g[0], y: 0, z: g[1], ground: 0, s: 1.0, flip: true });
  }
  if (S.id === 'lasttime') { // Gray's figure stands at the grave, fading as Bobby settles
    const bp = { expr: 'smile', blink: false, step: 0, breathe: 0.5, airY: 0 };
    out.push({ key: 'grayfade', draw: (p) => T.bodyFront(p, GRAY, bp), x: -0.75, y: 0, z: -0.5, ground: 0, s: 1.0, alpha: Math.max(0, 0.55 * (1 - ramp(u, 0.25, 0.8))) });
  }
  if (S.id === 'chased') { // the keeper runs after him, broom in hand
    const a = Math.max(0, u / 0.78) * Math.PI * 1.55 - 0.5;
    const kx = Math.sin(a) * 2.9, kz = -1.4 + Math.cos(a) * 2.1 - 0.4;
    const bp = { expr: 'stern', blink: (f % 83) < 3, step: f / 30 * 2.6, breathe: 0.6, airY: 0 };
    if (u < 0.85) out.push({ key: 'keeper' + JSON.stringify(bp), draw: (p) => T.bodyFront(p, KEEPER, bp), x: kx, y: 0, z: kz, ground: 0, s: 1.02, flip: Math.cos(a) > 0.2 });
  }
  if (S.id === 'crowds') { // watchers line the fence and gate
    out.push(folk(0, -2.2, 4.15, 0.98, 'smile'));
    out.push(folk(1, -1.4, 4.3, 0.94, 'neutral', 2));
    out.push(folk(3, 0.6, 4.25, 0.99, 'smile', 4));
    out.push(folk(2, 1.5, 4.1, 0.95, 'neutral', 1));
  }
  if (S.id === 'licence') { // Provost + official at the gate, keeper between
    const bp1 = { expr: 'stern', blink: (f % 91) < 3, step: 0, breathe: 0.5, airY: 0, arms: Math.sin(Math.min(1, u * 1.4) * Math.PI) * 0.6 };
    out.push({ key: 'provost' + JSON.stringify(bp1), draw: (p) => T.bodyFront(p, PROVOST, bp1), x: -1.15, y: 0, z: 2.75, ground: 0, s: 1.04 });
    const bp2 = { expr: 'neutral', blink: (f % 87) < 3, step: 0, breathe: 0.5, airY: 0 };
    out.push({ key: 'official' + JSON.stringify(bp2), draw: (p) => T.bodyFront(p, OFFICIAL, bp2), x: -0.35, y: 0, z: 2.9, ground: 0, s: 1.0 });
    const bp3 = { expr: 'nervous', blink: (f % 79) < 3, step: 0, breathe: 0.6, airY: 0 };
    out.push({ key: 'keeper2' + JSON.stringify(bp3), draw: (p) => T.bodyFront(p, KEEPER, bp3), x: 0.65, y: 0, z: 2.7, ground: 0, s: 1.0 });
  }
  if (S.id === 'collar') out.push(folk(1, -2.1, 3.6, 0.95, 'smile', 3));
  if (S.id === 'died') { // the city stands quiet at the gate
    out.push(folk(0, -1.8, 4.2, 0.98, 'pained'));
    out.push(folk(2, -0.8, 4.35, 0.95, 'stern', 2));
    out.push(folk(1, 0.4, 4.25, 0.97, 'pained', 5));
  }
  if (S.id === 'statue') { // THE BRONZE BOBBY on his plinth, sitting tall forever
    out.push({ key: 'bronze' + JSON.stringify({ bl: 0 }), draw: (p) => T.bobbyCard(p, { pose: 'front', step: 0, blink: false, grey: 0, collar: 1, wagPh: 0 }),
      x: -3.6, y: 1.02, z: 5.6, ground: 1.02, s: 0.6, tint: '#c09a58', blob: false });
    out.push(folk(3, -5.3, 7.6, 0.96, 'smile', 1));
  }
  return out;
};
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'gun' && f - S.a < 8) { // the gun's flash, far over the castle wall
    out.push({ key: 'gunflash', draw: (p) => T.fxSpark(p, { n: 9, r: 130, col: '#ffd98a' }), x: 8.0, y: 4.8, z: -15.9, ground: 4.8, s: 1.4, blob: false, shadow: false });
  }
  if (S.id === 'collar' && S.u > 0.3 && S.u < 0.75 && (f % 30) < 12) { // the brass tag catches the sun
    const B = bobbyPosAt(f);
    out.push({ key: 'tagglint', draw: (p) => T.fxSpark(p, { n: 4, r: 46, col: '#ffe9a8' }), x: B.x + 0.05, y: 0.62, z: B.z + 0.3, ground: 0.62, s: 0.6, blob: false, shadow: false });
  }
  return out;
};
// Boards: single source of truth (matches main.js placements)
export const BOARDS = [
  { id: 'y1858', key: 'board1858', pos: [-1.25, 1.12, -1.55], yaw: 0.15, w: 1.5, h: 0.95, check: [202, 384] },
  { id: 'stay', key: 'boardStay', pos: [-0.15, 1.0, -1.6], yaw: 0.05, w: 1.1, h: 0.72, check: [1254, 1397] },
  { id: 'finale', key: 'boardFinale', pos: [-3.6, 0.62, 6.09], yaw: 0, w: 0.95, h: 0.5, check: [1530, 1735] },
];
