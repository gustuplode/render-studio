// Gander — story (timing ESTIMATED from word counts until gander-voice/
// timing.json lands; TIMING is the only block to re-tile).
import { M, camFromKeys } from './motion.js';
import { ganderCard } from './extras.js';

export const TIMING = [
  ['hook', 0, 177], ['pet', 178, 330], ['mascot', 331, 468], ['sailed', 469, 614],
  ['charges', 615, 755], ['landed', 756, 850], ['picked', 851, 931], ['ran', 932, 1060],
  ['blast', 1061, 1185], ['memorial', 1186, 1286], ['medal', 1287, 1497], ['question', 1498, 1661],
];
export const TOTAL = 1662;
const SEC = {}; TIMING.forEach(([id, a, b]) => { SEC[id] = { a, b }; });
export const shotAt = (f) => { for (const [id, a, b] of TIMING) if (f >= a && f <= b) return { id, a, b, u: (f - a) / (b - a) }; return { id: 'question', a: 1498, b: 1661, u: 1 }; };
const ramp = (x, a, b) => { const t = (x - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const path = (pts, u) => {
  const n = pts.length - 1, x = Math.min(0.9999, Math.max(0, u)) * n, i = Math.floor(x), t = ease(x - i);
  return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)];
};

// ---------------- Gander's position / pose ----------------
export const ganderPosAt = (f) => {
  const S = shotAt(f), u = S.u;
  switch (S.id) {
    case 'hook': { const p = path([[20.5, -1.1], [25.5, -1.25]], Math.min(1, u * 1.15)); return { x: p[0], z: p[1], y: 0, pose: 'charge', step: f / 30 * 3.4, grenade: 1, wagPh: u * 6 }; }
    case 'pet': return { x: 1.2, z: 1.3, y: 0, pose: 'side', step: 0, grenade: 0, wagPh: u * 3, pant: (f % 50) < 26 };
    case 'mascot': return { x: 0.6, z: 0.7, y: 0, pose: 'side', step: 0, grenade: 0, wagPh: u * 2 };
    case 'sailed': return { x: -3.4, z: 2.7, y: 0, pose: 'side', step: 0, grenade: 0, wagPh: 0, flip: true };
    case 'charges': {
      if (u < 0.42) { const p = path([[19.6, -1.15], [26.2, -1.3]], u / 0.42); return { x: p[0], z: p[1], y: 0, pose: 'charge', step: f / 30 * 3.4, grenade: 0, wagPh: u * 8 }; }
      if (u < 0.58) return { x: 25.4, z: -1.3, y: 0, pose: 'side', step: 0, grenade: 0, wagPh: 0, pant: true };
      const p = path([[25.4, -1.3], [27.6, -1.35]], (u - 0.58) / 0.42); return { x: p[0], z: p[1], y: 0, pose: 'charge', step: f / 30 * 3.4, grenade: 0, wagPh: u * 8 };
    }
    case 'landed': return { x: 19.9, z: -0.95, y: 0, pose: 'side', step: 0, grenade: 0, wagPh: 0 };
    case 'picked': {
      if (u < 0.5) { const p = path([[19.9, -0.95], [21.05, -1.0]], u / 0.5); return { x: p[0], z: p[1], y: 0, pose: 'side', step: f / 30 * 2.2, grenade: 0, wagPh: u * 3 }; }
      return { x: 21.05, z: -1.0, y: 0, pose: 'side', step: 0, grenade: 1, wagPh: 0 };
    }
    case 'ran': { const p = path([[21.05, -1.0], [27.6, -1.2]], ramp(u, 0.08, 0.92)); return { x: p[0], z: p[1], y: 0, pose: 'charge', step: f / 30 * 3.6, grenade: 1, wagPh: u * 8 }; }
    case 'blast': return { x: 27.6, z: -1.2, y: 0, pose: 'charge', step: 0, grenade: 1, wagPh: 0, alpha: u < 0.05 ? 1 : 0 };
    default: return { x: 0, z: 0, y: 0, pose: 'side', step: 0, grenade: 0, wagPh: 0, alpha: 0 };
  }
};

// enemy line position (driven back by the charges, scattering at the end)
export const enemyXAt = (f) => {
  const S = shotAt(f), u = S.u;
  if (S.id === 'charges') return u < 0.42 ? lerp(28.6, 30.4, ramp(u, 0.2, 0.42)) : u < 0.58 ? 30.4 : lerp(30.4, 32.2, ramp(u, 0.75, 1));
  if (S.id === 'landed' || S.id === 'picked') return 31.6;
  if (S.id === 'ran') return lerp(31.6, 34.5, ramp(u, 0.3, 0.95));
  if (S.id === 'hook') return 29.5;
  return 40;
};

// ---------------- cameras ----------------
const LK = (kf2, off = [0, 0.95, 0]) => { const B = ganderPosAt(kf2); return [B.x + off[0], B.y + off[1], B.z + off[2]]; };
export const camAt = (f) => {
  const S = shotAt(f), u = S.u, a = S.a, b = S.b, m = Math.round((a + b) / 2);
  let c;
  switch (S.id) {
    case 'hook': c = camFromKeys([{ f: a, pos: [19.2, 1.35, 3.6], look: LK(a), fov: 40 }, { f: b, pos: [23.8, 1.2, 3.4], look: LK(b), fov: 37 }], f); c.shadowAt = [22, 0.3, -1]; if (f > b - 6) c.flash = 0.5 * (1 - (b - f) / 6); return c;
    case 'pet': c = camFromKeys([{ f: a, pos: [3.1, 1.5, 5.0], look: LK(a), fov: 39 }, { f: b, pos: [2.4, 1.3, 4.2], look: LK(b, [0, 0.85, 0]), fov: 37 }], f); c.shadowAt = [1, 0.3, 1]; return c;
    case 'mascot': c = camFromKeys([{ f: a, pos: [2.6, 1.6, 4.6], look: [0.45, 1.05, -0.3], fov: 39 }, { f: b, pos: [1.9, 1.4, 3.8], look: [0.5, 1.0, -0.1], fov: 37 }], f); c.shadowAt = [0, 0.3, 0]; return c;
    case 'sailed': c = camFromKeys([{ f: a, pos: [0.5, 1.7, 6.4], look: [-3.6, 1.0, 1.8], fov: 40 }, { f: b, pos: [-0.6, 1.55, 5.6], look: [-3.8, 0.95, 2.0], fov: 38 }], f); c.shadowAt = [-2, 0.3, 1]; return c;
    case 'charges': c = camFromKeys([{ f: a, pos: [18.6, 1.5, 3.8], look: LK(a), fov: 41 }, { f: m, pos: [22.6, 1.4, 3.9], look: LK(m), fov: 40 }, { f: b, pos: [25.6, 1.35, 3.8], look: LK(b), fov: 38 }], f); c.shadowAt = [23, 0.3, -1]; return c;
    case 'landed': c = camFromKeys([{ f: a, pos: [18.2, 1.6, 3.4], look: [21.2, 0.7, -1.1], fov: 39 }, { f: b, pos: [19.0, 1.4, 3.0], look: [21.2, 0.65, -1.05], fov: 37 }], f); c.shadowAt = [21, 0.3, -1]; return c;
    case 'picked': c = camFromKeys([{ f: a, pos: [18.6, 1.35, 3.1], look: LK(a), fov: 38 }, { f: b, pos: [19.4, 1.2, 2.7], look: LK(b, [0, 0.85, 0]), fov: 36 }], f); c.shadowAt = [21, 0.3, -1]; return c;
    case 'ran': c = camFromKeys([{ f: a, pos: [19.6, 1.4, 3.7], look: LK(a), fov: 40 }, { f: m, pos: [23.2, 1.3, 3.8], look: LK(m), fov: 39 }, { f: b, pos: [26.2, 1.25, 3.7], look: LK(b), fov: 37 }], f); c.shadowAt = [24, 0.3, -1]; return c;
    case 'blast': c = camFromKeys([{ f: a, pos: [24.6, 1.5, 3.9], look: [26.8, 0.8, -1.2], fov: 39 }, { f: b, pos: [21.8, 1.8, 4.6], look: [21.6, 0.6, -1.0], fov: 38 }], f); c.shadowAt = [22, 0.3, -1]; if (f - a < 8) c.flash = 0.65 * (1 - (f - a) / 8); return c;
    case 'memorial': c = camFromKeys([{ f: a, pos: [-0.6, 1.6, 5.6], look: [-3.2, 1.1, 2.2], fov: 39 }, { f: b, pos: [-1.3, 1.45, 4.7], look: [-3.2, 1.05, 2.2], fov: 37 }], f); c.shadowAt = [-3, 0.3, 2]; return c;
    case 'medal': c = camFromKeys([{ f: a, pos: [-0.9, 1.7, 6.6], look: [-3.2, 1.1, 2.2], fov: 38 }, { f: b, pos: [-1.55, 1.5, 5.3], look: [-3.2, 1.05, 2.2], fov: 35 }], f); c.shadowAt = [-3, 0.3, 2]; return c;
    case 'question': c = camFromKeys([{ f: a, pos: [1.9, 2.0, 8.4], look: [-3.2, 1.1, 2.2], fov: 40 }, { f: b, pos: [0.7, 1.8, 7.0], look: [-3.2, 1.05, 2.2], fov: 37 }], f); c.shadowAt = [-3, 0.3, 2]; return c;
    default: return { pos: [0, 1.4, 5], look: [0, 0.9, 0], fov: 38, shadowAt: [0, 0.3, 0] };
  }
};

// ---------------- lights ----------------
const NIGHT = { sky: '#2c3a55', ground: '#232a33', sun: '#8fa8cc', hemi: 0.34, sunI: 0.4, az: -30, el: 12, fog: '#46586e', fogNear: 20, fogFar: 130, sat: 0.92, sunDisc: '#aebfdf', sunSize: 0.002, shadowExt: 16, vig: 0.4 };
const LIGHTS = {
  hook: { ...NIGHT },
  pet: { sky: '#c3d8f2', ground: '#707a62', sun: '#ffedbe', hemi: 0.98, sunI: 2.3, az: -30, el: 34, fog: '#d3dde2', fogNear: 40, fogFar: 340, sat: 1.08, sunDisc: '#ffe9b0', sunSize: 0.0035, shadowExt: 15 },
  mascot: { sky: '#c3d8f2', ground: '#707a62', sun: '#fff0c2', hemi: 1.0, sunI: 2.4, az: -22, el: 38, fog: '#d3dde2', fogNear: 40, fogFar: 340, sat: 1.09, sunDisc: '#ffedb8', sunSize: 0.004, shadowExt: 15 },
  sailed: { sky: '#b9c8e4', ground: '#5f6a5e', sun: '#ffd9a8', hemi: 0.66, sunI: 1.35, az: -72, el: 10, fog: '#cfc0aa', fogNear: 30, fogFar: 240, sat: 1.01, sunDisc: '#ffcf8a', sunSize: 0.004, shadowExt: 16, vig: 0.33 },
  charges: { ...NIGHT }, landed: { ...NIGHT, hemi: 0.3 }, picked: { ...NIGHT, hemi: 0.3, vig: 0.44 }, ran: { ...NIGHT },
  blast: { ...NIGHT, hemi: 0.36 },
  memorial: { sky: '#c8d2dc', ground: '#68705f', sun: '#ffe9c4', hemi: 0.8, sunI: 1.5, az: 35, el: 15, fog: '#ddd8c8', fogNear: 32, fogFar: 260, sat: 0.99, sunDisc: '#ffeec0', sunSize: 0.003, shadowExt: 15 },
  medal: { sky: '#cfdce8', ground: '#707a68', sun: '#ffefc2', hemi: 0.88, sunI: 1.8, az: 28, el: 20, fog: '#dedacd', fogNear: 34, fogFar: 280, sat: 1.03, sunDisc: '#ffedb8', sunSize: 0.0035, shadowExt: 13 },
  question: { sky: '#c3d8f2', ground: '#707a62', sun: '#ffedbe', hemi: 0.92, sunI: 2.0, az: -15, el: 27, fog: '#d3dde2', fogNear: 38, fogFar: 320, sat: 1.05, sunDisc: '#ffe9b0', sunSize: 0.0035, shadowExt: 16 },
};
export const lightFor = (S, f) => {
  const L = { ...(LIGHTS[S.id] || LIGHTS.pet) };
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
  const S = shotAt(f); const C = camAt(f); const B = ganderPosAt(f);
  const d = Math.hypot(C.pos[0] - B.x, C.pos[1] - (B.y + 1), C.pos[2] - B.z);
  const plaqueD = Math.hypot(C.pos[0] + 3.2, C.pos[1] - 1.1, C.pos[2] - 2.2);
  return { focus: (S.id === 'memorial' || S.id === 'medal') ? plaqueD : Math.max(1.4, d), cinf: 6, near: 1.6 };
};

// ---------------- world state ----------------
export const worldAt = (f) => {
  const S = shotAt(f), u = S.u;
  // the grenade's arc onto the shore, then it lies ticking until he takes it
  let gT = 0, gPos = [21.3, 0.09, -1.0];
  if (S.id === 'landed') {
    if (u > 0.12 && u < 0.5) { const t = (u - 0.12) / 0.38; gT = 1; gPos = [lerp(27.5, 21.3, t), 0.09 + Math.sin(t * Math.PI) * 1.5 * (1 - t * 0.4), lerp(-1.3, -1.0, t)]; }
    else if (u >= 0.5) gT = 1;
  }
  if (S.id === 'picked' && u < 0.52) gT = 1;
  return {
    boardHook: S.id === 'mascot' ? ramp(u, 0.08, 0.25) * (1 - ramp(u, 0.8, 0.95)) : 0,
    boardAway: S.id === 'landed' ? ramp(u, 0.05, 0.2) * (1 - ramp(u, 0.55, 0.75)) : 0,
    boardMedal: S.id === 'memorial' ? ramp(u, 0.15, 0.4) : (S.id === 'medal' || S.id === 'question') ? 1 : 0,
    grenadeT: gT, grenadePos: gPos,
    lampT: S.id === 'sailed' ? 0.8 : S.id === 'hook' ? 0.25 : 0,
    mistT: S.id === 'memorial' ? 0.5 : S.id === 'charges' ? 0.3 : S.id === 'question' ? 0.3 : 0,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f), u = S.u;
  return {
    smokeRate: S.id === 'sailed' ? 7 : S.id === 'question' ? 4 : 0,
    blastRate: S.id === 'blast' && u < 0.3 ? 70 * (1 - u / 0.3) : S.id === 'charges' ? 4 : 0,
    dustRate: 0,
  };
};

// ---------------- actors ----------------
const RIFLE = { skin: '#d99e72', jacket: '#6a6248', pants: '#5d563e', boots: '#3a3428', build: 'adult', hair: '#3a2e1e' };
const RIFLE2 = { skin: '#eec39a', jacket: '#6a6248', pants: '#5d563e', boots: '#3a3428', build: 'stout', hair: '#574433' };
const ENEMY = { skin: '#8a6a52', jacket: '#2e3138', pants: '#26282e', boots: '#1e2024', build: 'adult', hair: '#17181c' };
const FAMILY_M = { skin: '#d99e72', jacket: '#4a5a74', pants: '#3c3630', boots: '#2c2822', build: 'adult', hair: '#4a3a28' };
const FAMILY_W = { skin: '#f2c398', jacket: '#7a4a52', pants: '#4c4238', boots: '#33302a', build: 'adult', hair: '#6a4a30' };
export const actorsAt = (f, T) => {
  const S = shotAt(f), u = S.u, B = ganderPosAt(f);
  const out = [];
  const blinkB = (f % 97) < 3;
  if ((B.alpha ?? 1) > 0.02) out.push({ key: 'gander' + JSON.stringify({ p: B.pose, s: Math.round((B.step || 0) * 3), g: B.grenade || 0, bl: blinkB ? 1 : 0, pant: B.pant ? 1 : 0 }),
    draw: (p) => T.ganderCard(p, { pose: B.pose, step: B.step, blink: blinkB, grenade: B.grenade, wagPh: B.wagPh, pant: B.pant }),
    x: B.x, y: B.y, z: B.z, ground: B.y, s: 0.78, flip: !!B.flip, alpha: B.alpha ?? 1 });
  const man = (outfit, x, z, o = {}) => {
    const bp = { expr: o.expr || 'neutral', blink: (f % 89) < 3, step: o.step || 0, breathe: Math.sin(f * 0.05 + (o.phase || 0)) * 0.5 + 0.5, airY: 0, arms: o.arms || 0 };
    return { key: 'man' + (o.id || '') + JSON.stringify(bp) + (o.roll || 0), draw: (p) => T.bodyFront(p, outfit, bp), x, y: o.y || 0, z, ground: 0, s: o.s || 1.0, flip: !!o.flip, roll: o.roll || 0, alpha: o.alpha ?? 1 };
  };
  if (S.id === 'pet') { out.push(man(FAMILY_M, 0.2, 2.1, { id: 'fm', expr: 'smile' })); out.push(man(FAMILY_W, 2.3, 2.2, { id: 'fw', expr: 'smile', phase: 2 })); }
  if (S.id === 'mascot') {
    out.push(man(RIFLE, -0.9, 1.9, { id: 'r1', expr: 'smile' }));
    out.push(man(RIFLE2, 2.2, 2.0, { id: 'r2', expr: 'grin', phase: 3 }));
    out.push(man(RIFLE, 1.4, 3.1, { id: 'r3', expr: 'neutral', phase: 1, s: 0.97 }));
  }
  if (S.id === 'sailed') { // the company marches past him toward the gangway
    const mx = lerp(-6.5, 1.5, u);
    out.push(man(RIFLE, mx, 1.6, { id: 'm1', step: f / 30 * 2.6, s: 0.99 }));
    out.push(man(RIFLE2, mx - 1.1, 1.75, { id: 'm2', step: f / 30 * 2.6 + 0.5, phase: 2 }));
    out.push(man(RIFLE, mx - 2.2, 1.55, { id: 'm3', step: f / 30 * 2.6 + 1, phase: 4, s: 0.98 }));
  }
  const battle = ['charges', 'landed', 'picked', 'ran', 'blast', 'hook'].includes(S.id);
  if (battle) {
    // the wounded, by the stretchers behind the wall
    out.push(man(RIFLE, 20.75, -1.7, { id: 'w1', roll: -1.45, y: 0.1, s: 0.97, expr: 'pained' }));
    out.push(man(RIFLE2, 22.45, -0.85, { id: 'w2', roll: -1.5, y: 0.1, expr: 'pained', phase: 2 }));
    if (S.id === 'blast' && u > 0.3) out.push(man(RIFLE, 21.7, -1.9, { id: 'med', expr: 'relief', s: 0.95 }));
    else out.push(man(RIFLE, 21.7, -1.9, { id: 'med', expr: 'nervous', s: 0.95, arms: 0.3 }));
    // the enemy line
    const ex = enemyXAt(f);
    const scat = S.id === 'ran' ? ramp(u, 0.3, 0.95) : 0;
    out.push(man(ENEMY, ex, -1.5 - scat * 1.6, { id: 'e1', s: 1.0, alpha: 0.92, flip: true, step: scat > 0 ? f / 30 * 2.4 : 0 }));
    out.push(man(ENEMY, ex + 0.9, -0.7 + scat * 1.8, { id: 'e2', s: 1.02, alpha: 0.92, flip: true, step: scat > 0 ? f / 30 * 2.4 + 0.4 : 0 }));
    out.push(man(ENEMY, ex + 0.4, -2.3 - scat * 0.8, { id: 'e3', s: 0.98, alpha: 0.9, flip: true }));
  }
  if (S.id === 'memorial' || S.id === 'medal') { // his men stand quiet by the plaque
    out.push(man(RIFLE, -1.7, 3.6, { id: 'q1', expr: 'pained', s: 0.99 }));
    out.push(man(RIFLE2, -0.7, 3.8, { id: 'q2', expr: 'stern', phase: 2 }));
    if (S.id === 'memorial') out.push(man(RIFLE, 0.3, 3.65, { id: 'q3', expr: 'pained', phase: 4, s: 0.97 }));
  }
  return out;
};
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (['charges', 'landed', 'ran', 'hook'].includes(S.id) && (f % 47) < 5) { // distant muzzle glints
    const ex = enemyXAt(f);
    out.push({ key: 'muzzle' + (f % 47), draw: (p) => T.fxSpark(p, { n: 5, r: 52, col: '#ffd98a' }), x: ex + 0.3, y: 1.25, z: -1.4, ground: 1.25, s: 0.8, blob: false, shadow: false });
  }
  if (S.id === 'medal' && S.u > 0.35 && S.u < 0.8 && (f % 34) < 13) { // the medal catches the light
    out.push({ key: 'medalglint', draw: (p) => T.fxSpark(p, { n: 5, r: 55, col: '#ffe9a8' }), x: -3.2, y: 0.55, z: 2.32, ground: 0.55, s: 0.7, blob: false, shadow: false });
  }
  return out;
};
// Boards: single source of truth (matches main.js placements)
export const BOARDS = [
  { id: 'hook', key: 'boardHook', pos: [0.2, 1.5, -1.9], yaw: 0.1, w: 1.15, h: 0.78, check: [331, 468] },
  { id: 'away', key: 'boardAway', pos: [22.6, 1.35, -3.1], yaw: -0.15, w: 1.2, h: 0.8, check: [756, 850] },
  { id: 'medal', key: 'boardMedal', pos: [-3.2, 1.22, 2.2], yaw: 0.42, w: 0.95, h: 0.68, check: [1186, 1661] },
];
