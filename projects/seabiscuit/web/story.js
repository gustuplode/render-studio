// Seabiscuit — story (timing ESTIMATED from word counts until
// seabiscuit-voice/timing.json lands; TIMING is the only block to re-tile).
import { M, camFromKeys } from './motion.js';
import { horseCard } from './extras.js';

export const TIMING = [
  ['hook', 0, 136], ['seventeen', 137, 294], ['smith', 295, 415], ['pollard', 416, 573],
  ['secret', 574, 691], ['winning', 692, 810], ['hero', 811, 959], ['match', 960, 1134],
  ['favourite', 1135, 1300], ['eye', 1301, 1428], ['won', 1429, 1560], ['prove', 1561, 1736],
];
export const TOTAL = 1737;
const SEC = {}; TIMING.forEach(([id, a, b]) => { SEC[id] = { a, b }; });
export const shotAt = (f) => { for (const [id, a, b] of TIMING) if (f >= a && f <= b) return { id, a, b, u: (f - a) / (b - a) }; return { id: 'prove', a: 1561, b: 1736, u: 1 }; };
const ramp = (x, a, b) => { const t = (x - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

// ---------------- Seabiscuit's position / state ----------------
const JOCKEY = { silks: '#b03a30', cap: '#b03a30' };
const JOCKEY_ADM = { silks: '#2c3e6a', cap: '#2c3e6a' };
export const biscuitPosAt = (f) => {
  const S = shotAt(f), u = S.u;
  switch (S.id) {
    case 'hook': return { x: -1.6, z: 0.9, gallop: 0, step: 0, tired: 0.85, jockey: null, s: 1.3 };
    case 'seventeen': { const x = lerp(-7.5, 8.5, ease(ramp(u, 0.05, 0.95))); return { x, z: -0.5, gallop: 0.85, step: f / 30 * 1.9, tired: u > 0.8 ? (u - 0.8) * 3 : 0, jockey: JOCKEY, s: 1.3 }; }
    case 'smith': return { x: -2.2, z: 0.6, gallop: 0, step: 0, tired: 0.6 - u * 0.45, jockey: null, s: 1.3 };
    case 'pollard': return { x: -1.8, z: 0.7, gallop: 0, step: 0, tired: 0.25, jockey: null, s: 1.3 };
    case 'secret': { const x = lerp(-8, 8, ease(ramp(u, 0.05, 0.95))); return { x, z: -0.6, gallop: 1, step: f / 30 * 2.1, tired: 0, jockey: JOCKEY, s: 1.3 }; }
    case 'winning': { const x = lerp(-6, 7.5, ease(ramp(u, 0.05, 0.95))); return { x, z: -0.55, gallop: 1, step: f / 30 * 2.1, tired: 0, jockey: JOCKEY, s: 1.3 }; }
    case 'hero': { const x = lerp(-5.5, 3.5, ease(u)); return { x, z: -0.4, gallop: 0.35, step: f / 30 * 1.1, tired: 0, jockey: JOCKEY, s: 1.3 }; }
    case 'match': return { x: -4.6, z: -0.35, gallop: 0, step: 0, tired: 0.1, jockey: JOCKEY, s: 1.3 };
    case 'favourite': return { x: -1.2, z: -0.3, gallop: 0, step: 0, tired: 0, jockey: JOCKEY, s: 1.3 };
    case 'eye': { // alongside the Admiral, then the surge
      const base = lerp(-6.5, 6.8, ease(ramp(u, 0.03, 0.97)));
      const surge = ramp(u, 0.62, 0.97) * 1.7;
      return { x: base + surge, z: -0.5, gallop: 1, step: f / 30 * 2.2, tired: 0, jockey: JOCKEY, s: 1.3 };
    }
    case 'won': { const x = lerp(5.2, 9.5, ease(ramp(u, 0, 0.6))); return { x, z: -0.5, gallop: u < 0.6 ? 0.9 : 0.3, step: f / 30 * (u < 0.6 ? 2.0 : 1.0), tired: 0, jockey: JOCKEY, s: 1.3 }; }
    case 'prove': return { x: 4.35, z: 2.1, gallop: 0, step: 0, tired: 0.15, jockey: JOCKEY, s: 1.32, flip: true };
    default: return { x: 0, z: 0, gallop: 0, step: 0, tired: 0, jockey: null, s: 1.3 };
  }
};
export const admiralPosAt = (f) => {
  const S = shotAt(f), u = S.u;
  switch (S.id) {
    case 'match': return { x: -3.3, z: -1.5, gallop: 0, step: 0, tired: 0, jockey: JOCKEY_ADM, s: 1.45, dark: 1 };
    case 'favourite': return { x: 0.6, z: -1.6, gallop: 0, step: 0, tired: 0, jockey: JOCKEY_ADM, s: 1.45, dark: 1 };
    case 'eye': { const x = lerp(-6.3, 7.0, ease(ramp(u, 0.03, 0.97))); return { x, z: -1.7, gallop: 1, step: f / 30 * 2.2 + 0.35, tired: u > 0.8 ? 0.3 : 0, jockey: JOCKEY_ADM, s: 1.45, dark: 1 }; }
    case 'won': { const x = lerp(4.6, 7.6, ease(ramp(u, 0, 0.6))); return { x, z: -1.7, gallop: 0.7, step: f / 30 * 1.7, tired: 0.4, jockey: JOCKEY_ADM, s: 1.45, dark: 1 }; }
    default: return { x: 0, z: -1.6, gallop: 0, step: 0, tired: 0, jockey: null, s: 1.45, dark: 1, alpha: 0 };
  }
};

// ---------------- cameras ----------------
const LK = (kf2, off = [0, 1.15, 0]) => { const B = biscuitPosAt(kf2); return [B.x + off[0], off[1], B.z + off[2]]; };
export const camAt = (f) => {
  const S = shotAt(f), u = S.u, a = S.a, b = S.b, m = Math.round((a + b) / 2);
  let c;
  switch (S.id) {
    case 'hook': c = camFromKeys([{ f: a, pos: [-3.9, 1.6, 4.6], look: LK(a), fov: 39 }, { f: b, pos: [-3.1, 1.45, 3.8], look: LK(b), fov: 37 }], f); c.shadowAt = [-1.6, 0.5, 0.9]; return c;
    case 'seventeen': c = camFromKeys([{ f: a, pos: [-6.2, 1.7, 4.4], look: LK(a), fov: 40 }, { f: m, pos: [-0.5, 1.6, 4.5], look: LK(m), fov: 39 }, { f: b, pos: [5.6, 1.55, 4.3], look: LK(b), fov: 38 }], f); c.shadowAt = [0, 0.5, -0.5]; return c;
    case 'smith': c = camFromKeys([{ f: a, pos: [-4.3, 1.6, 4.2], look: LK(a), fov: 39 }, { f: b, pos: [-3.6, 1.5, 3.6], look: LK(b), fov: 37 }], f); c.shadowAt = [-2.2, 0.5, 0.6]; return c;
    case 'pollard': c = camFromKeys([{ f: a, pos: [-3.8, 1.6, 4.3], look: LK(a), fov: 39 }, { f: b, pos: [-3.2, 1.5, 3.7], look: LK(b), fov: 37 }], f); c.shadowAt = [-1.8, 0.5, 0.7]; return c;
    case 'secret': c = camFromKeys([{ f: a, pos: [-6.8, 1.6, 4.2], look: LK(a), fov: 40 }, { f: m, pos: [-0.6, 1.55, 4.3], look: LK(m), fov: 39 }, { f: b, pos: [5.8, 1.5, 4.2], look: LK(b), fov: 38 }], f); c.shadowAt = [0, 0.5, -0.6]; return c;
    case 'winning': c = camFromKeys([{ f: a, pos: [-4.8, 1.65, 4.3], look: LK(a), fov: 40 }, { f: m, pos: [0.6, 1.6, 4.4], look: LK(m), fov: 39 }, { f: b, pos: [5.4, 1.55, 4.2], look: LK(b), fov: 38 }], f); c.shadowAt = [1, 0.5, -0.5]; return c;
    case 'hero': c = camFromKeys([{ f: a, pos: [-4.2, 1.8, 5.2], look: LK(a), fov: 39 }, { f: b, pos: [1.8, 1.7, 5.0], look: LK(b), fov: 38 }], f); c.shadowAt = [0, 0.5, -0.4]; return c;
    case 'match': c = camFromKeys([{ f: a, pos: [1.8, 2.0, 3.4], look: [6.4, 2.4, -7.5], fov: 40 }, { f: m, pos: [-1.5, 1.9, 4.4], look: [-4.0, 1.2, -0.9], fov: 39 }, { f: b, pos: [-5.6, 1.8, 4.0], look: [-3.9, 1.15, -0.9], fov: 38 }], f); c.shadowAt = [-4, 0.5, -0.9]; return c;
    case 'favourite': c = camFromKeys([{ f: a, pos: [-2.6, 1.75, 4.6], look: [-0.3, 1.15, -0.95], fov: 39 }, { f: b, pos: [-1.9, 1.65, 4.0], look: [-0.3, 1.1, -0.95], fov: 37 }], f); c.shadowAt = [-0.3, 0.5, -0.95]; return c;
    case 'eye': c = camFromKeys([{ f: a, pos: [-5.2, 1.6, 4.5], look: LK(a), fov: 40 }, { f: m, pos: [0.2, 1.55, 4.6], look: LK(m), fov: 39 }, { f: b, pos: [5.2, 1.5, 4.4], look: LK(b), fov: 38 }], f); c.shadowAt = [0, 0.5, -1]; return c;
    case 'won': c = camFromKeys([{ f: a, pos: [3.6, 1.6, 4.4], look: LK(a), fov: 39 }, { f: b, pos: [6.8, 1.55, 4.2], look: LK(b), fov: 37 }], f); c.shadowAt = [6, 0.5, -0.5]; return c;
    case 'prove': c = camFromKeys([{ f: a, pos: [1.6, 1.7, 6.6], look: [4.35, 1.15, 2.1], fov: 39 }, { f: b, pos: [2.2, 1.6, 5.9], look: [4.35, 1.1, 2.1], fov: 37 }], f); c.shadowAt = [4.35, 0.5, 2.1]; return c;
    default: return { pos: [0, 1.6, 5], look: [0, 1.1, 0], fov: 38, shadowAt: [0, 0.5, 0] };
  }
};

// ---------------- lights ----------------
const DAY = { sky: '#bfd9f2', ground: '#7a7a58', sun: '#fff0c2', hemi: 1.0, sunI: 2.4, az: -25, el: 36, fog: '#d8dfd8', fogNear: 42, fogFar: 340, sat: 1.09, sunDisc: '#ffedb8', sunSize: 0.004, shadowExt: 18 };
const LIGHTS = {
  hook: { ...DAY, hemi: 0.9, sunI: 2.0, sat: 1.02 },
  seventeen: { ...DAY },
  smith: { ...DAY, sunI: 2.2 },
  pollard: { ...DAY },
  secret: { sky: '#c8d4e4', ground: '#6e725e', sun: '#ffdfae', hemi: 0.78, sunI: 1.5, az: 40, el: 13, fog: '#dcd8c8', fogNear: 30, fogFar: 240, sat: 1.02, sunDisc: '#ffdfae', sunSize: 0.0035, shadowExt: 18 },
  winning: { ...DAY, sunI: 2.5 },
  hero: { ...DAY, sunI: 2.45 },
  match: { sky: '#c2d6ee', ground: '#767658', sun: '#ffeec2', hemi: 0.95, sunI: 2.2, az: -45, el: 24, fog: '#d5dbc9', fogNear: 38, fogFar: 300, sat: 1.07, sunDisc: '#ffe9b0', sunSize: 0.0035, shadowExt: 18 },
  favourite: { sky: '#c2d6ee', ground: '#767658', sun: '#ffeec2', hemi: 0.95, sunI: 2.25, az: -48, el: 22, fog: '#d5dbc9', fogNear: 38, fogFar: 300, sat: 1.07, sunDisc: '#ffe9b0', sunSize: 0.0035, shadowExt: 18 },
  eye: { sky: '#bccfe9', ground: '#726e54', sun: '#ffe3ac', hemi: 0.9, sunI: 2.1, az: -58, el: 18, fog: '#d8d2ba', fogNear: 36, fogFar: 290, sat: 1.06, sunDisc: '#ffe0a0', sunSize: 0.0035, shadowExt: 18 },
  won: { sky: '#bccfe9', ground: '#726e54', sun: '#ffe3ac', hemi: 0.92, sunI: 2.15, az: -60, el: 17, fog: '#d8d2ba', fogNear: 36, fogFar: 290, sat: 1.07, sunDisc: '#ffe0a0', sunSize: 0.0035, shadowExt: 18 },
  prove: { sky: '#c2d6ee', ground: '#767658', sun: '#ffedbe', hemi: 0.97, sunI: 2.3, az: -40, el: 26, fog: '#d5dbc9', fogNear: 38, fogFar: 300, sat: 1.08, sunDisc: '#ffe9b0', sunSize: 0.0035, shadowExt: 16 },
};
export const lightFor = (S, f) => {
  const L = { ...(LIGHTS[S.id] || LIGHTS.winning) };
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
  const C = camAt(f); const B = biscuitPosAt(f);
  const d = Math.hypot(C.pos[0] - B.x, C.pos[1] - 1.2, C.pos[2] - B.z);
  return { focus: Math.max(1.6, d), cinf: 6, near: 1.6 };
};

// ---------------- world state ----------------
export const worldAt = (f) => {
  const S = shotAt(f), u = S.u;
  return {
    boardHook: S.id === 'hook' ? ramp(u, 0.12, 0.35) * (1 - ramp(u, 0.45, 0.6)) : 0,
    boardOdds: S.id === 'favourite' ? ramp(u, 0.1, 0.3) * (1 - ramp(u, 0.25, 0.38)) : 0,
    boardMatch: S.id === 'match' ? ramp(u, 0.03, 0.07) * (1 - ramp(u, 0.09, 0.12)) : 0,
    boardFinale: S.id === 'prove' ? ramp(u, 0.05, 0.25) : 0,
  };
};
export const fxProfileAt = (f) => {
  const S = shotAt(f), B = biscuitPosAt(f);
  const galloping = ['seventeen', 'secret', 'winning', 'eye'].includes(S.id) || (S.id === 'won' && S.u < 0.6) || S.id === 'hero';
  return {
    smokeRate: 0,
    dustRate: galloping ? (S.id === 'hero' ? 7 : 16) : 0,
    dustPos: [B.x - 1.1, 0.25, B.z + 0.25],
  };
};

// ---------------- actors ----------------
const SMITH = { skin: '#d99e72', jacket: '#4c4238', pants: '#3c3630', boots: '#2c2822', build: 'adult', hair: '#8a8578' };
const POLLARD = { skin: '#eec39a', jacket: '#7a2e2e', pants: '#e9e6de', boots: '#2c2822', build: 'adult', hair: '#3a2a1a' };
const FOLK = [['#7a4a3a', '#4a3a5c'], ['#5d7a35', '#37455c'], ['#8a6a2a', '#5c2e2e'], ['#4a6a8a', '#3c3428'], ['#6a4a6e', '#37402e']];
export const actorsAt = (f, T) => {
  const S = shotAt(f), u = S.u, B = biscuitPosAt(f);
  const out = [];
  const horse = (P, o = {}) => {
    if ((P.alpha ?? 1) <= 0.02) return;
    const key = 'horse' + (o.id || '') + JSON.stringify({ g: Math.round((P.gallop || 0) * 3), s: Math.round((P.step || 0) * 3), t: Math.round((P.tired || 0) * 3), d: P.dark || 0, j: P.jockey ? P.jockey.silks : '', bl: (f % 89) < 3 ? 1 : 0 });
    out.push({ key, draw: (p) => T.horseCard(p, { gallop: P.gallop, step: P.step, tired: P.tired, dark: P.dark, jockey: P.jockey, blink: (f % 89) < 3, blaze: o.blaze ? 1 : 0 }),
      x: P.x, y: 0, z: P.z, ground: 0, s: P.s, flip: !!P.flip, tint: o.tint || '#ffffff', alpha: P.alpha ?? 1 });
  };
  horse(B, { id: 'bisc', blaze: true });
  const A = admiralPosAt(f);
  if (['match', 'favourite', 'eye', 'won'].includes(S.id)) horse(A, { id: 'adm' });
  if (S.id === 'seventeen') { // two rivals beat him home
    const r1x = lerp(-6.5, 10.6, ease(ramp(u, 0.05, 0.92)));
    horse({ x: r1x, z: -1.8, gallop: 0.95, step: f / 30 * 2.05, tired: 0, jockey: { silks: '#2c5a6a', cap: '#2c5a6a' }, s: 1.36 }, { id: 'r1', tint: '#d8dde2' });
    const r2x = lerp(-7.2, 9.8, ease(ramp(u, 0.05, 0.94)));
    horse({ x: r2x, z: -2.6, gallop: 0.9, step: f / 30 * 1.95 + 0.4, tired: 0, jockey: { silks: '#3a6a2c', cap: '#3a6a2c' }, s: 1.33 }, { id: 'r2', tint: '#6a5138' });
  }
  const man = (outfit, x, z, o = {}) => {
    const bp = { expr: o.expr || 'neutral', blink: (f % 91) < 3, step: o.step || 0, breathe: Math.sin(f * 0.05 + (o.phase || 0)) * 0.5 + 0.5, airY: o.bob || 0, arms: o.arms || 0 };
    return { key: 'man' + (o.id || '') + JSON.stringify(bp), draw: (p) => T.bodyFront(p, outfit, bp), x, y: 0, z, ground: 0, s: o.s || 1.0, flip: !!o.flip };
  };
  const folk = (i, x, z, o = {}) => { const [jk, pn] = FOLK[i % FOLK.length]; return man({ skin: '#eec39a', jacket: jk, pants: pn, boots: '#2c2822', build: 'adult', hair: '#3a2e20' }, x, z, { id: 'f' + i, ...o }); };
  if (S.id === 'smith') out.push(man(SMITH, -3.6, 1.9, { id: 'sm', expr: 'stern', arms: 0.15 }));
  if (S.id === 'pollard') { out.push(man(POLLARD, -0.7, 1.85, { id: 'po', expr: 'smile' })); out.push(man(SMITH, -3.4, 2.1, { id: 'sm', expr: 'neutral', phase: 2 })); }
  if (S.id === 'secret') out.push(man(SMITH, -4.4, 1.7, { id: 'sm', expr: 'stern', arms: 0.45 }));
  if (S.id === 'winning' || S.id === 'hero') {
    out.push(folk(0, -3.4, 3.1, { expr: 'grin', bob: S.id === 'hero' ? Math.abs(Math.sin(f * 0.22)) * 0.05 : 0 }));
    out.push(folk(1, -2.2, 3.3, { expr: 'smile', phase: 2 }));
    out.push(folk(3, 3.9, 3.2, { expr: 'grin', phase: 4 }));
    if (S.id === 'hero') { out.push(folk(2, 5.2, 3.4, { expr: 'smile', phase: 1 })); out.push(folk(4, -4.8, 3.4, { expr: 'neutral', phase: 3 })); }
  }
  if (S.id === 'favourite') { out.push(folk(0, -3.6, 3.2, { expr: 'neutral' })); out.push(folk(2, 3.4, 3.3, { expr: 'smile', phase: 2 })); }
  if (S.id === 'won') {
    out.push(folk(0, 3.2, 3.2, { expr: 'laugh', bob: Math.abs(Math.sin(f * 0.3)) * 0.07 }));
    out.push(folk(1, 4.6, 3.4, { expr: 'grin', phase: 2, bob: Math.abs(Math.sin(f * 0.3 + 1)) * 0.07 }));
    out.push(folk(3, 6.2, 3.3, { expr: 'laugh', phase: 4, bob: Math.abs(Math.sin(f * 0.3 + 2)) * 0.06 }));
  }
  if (S.id === 'prove') { out.push(man(POLLARD, 3.1, 3.3, { id: 'po', expr: 'grin' })); out.push(folk(4, 6.4, 3.6, { expr: 'smile', phase: 3 })); }
  return out;
};
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'won' && S.u > 0.25 && S.u < 0.7 && (f % 30) < 14) {
    const B = biscuitPosAt(f);
    out.push({ key: 'winflash', draw: (p) => T.fxSpark(p, { n: 6, r: 60, col: '#fff2b8' }), x: B.x + 0.8, y: 1.6, z: B.z + 0.5, ground: 1.6, s: 0.8, blob: false, shadow: false });
  }
  return out;
};
// Boards: single source of truth (matches main.js placements)
export const BOARDS = [
  { id: 'hook', key: 'boardHook', pos: [0.8, 1.45, -1.85], yaw: 0.14, w: 1.5, h: 0.92, check: [0, 136] },
  { id: 'odds', key: 'boardOdds', pos: [0.8, 1.45, -1.85], yaw: 0.14, w: 1.5, h: 0.92, check: [1135, 1300] },
  { id: 'match', key: 'boardMatch', pos: [6.4, 2.6, -7.5], yaw: -0.22, w: 3.1, h: 1.7, check: [960, 1134] },
  { id: 'finale', key: 'boardFinale', pos: [4.6, 0.78, 1.85], yaw: 0, w: 1.5, h: 0.92, check: [1561, 1736] },
];
