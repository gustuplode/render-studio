// Alex — story (timing ESTIMATED from word counts until alex-voice/
// timing.json lands; TIMING is the only block to re-tile).
import { M, camFromKeys } from './motion.js';
import { alexCard } from './extras.js';

export const TIMING = [
  ['hook', 0, 121], ['petshop', 122, 266], ['question', 267, 411], ['thirty', 412, 508],
  ['hundred', 509, 632], ['tray', 633, 763], ['colour', 764, 894], ['away', 895, 995],
  ['sorry', 996, 1086], ['lastnight', 1087, 1196], ['morning', 1197, 1323], ['argue', 1324, 1553],
];
export const TOTAL = 1554;
const SEC = {}; TIMING.forEach(([id, a, b]) => { SEC[id] = { a, b }; });
export const shotAt = (f) => { for (const [id, a, b] of TIMING) if (f >= a && f <= b) return { id, a, b, u: (f - a) / (b - a) }; return { id: 'argue', a: 1324, b: 1553, u: 1 }; };
const ramp = (x, a, b) => { const t = (x - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

// perch geometry: main T-perch bar top y=1.52 at (0,0,-0.7); feet sit
// 0.146*s*2.25 above the card base -> base y for s=0.8 is 1.26.
const PERCH = { x: 0, y: 1.26, z: -0.7 };
const LOW = { x: -1.9, y: 0.86, z: 0.4 };
const CAGE = { x: -3.6, y: 1.07, z: -2.3 };
export const alexPosAt = (f) => {
  const S = shotAt(f), u = S.u;
  const talk = (rate = 0.5) => ((f % 40) < 14 ? Math.sin((f % 40) / 14 * Math.PI) * 0.8 : 0);
  switch (S.id) {
    case 'hook': return { ...PERCH, view: 'side', tilt: 0.25, beak: u > 0.45 && u < 0.8 ? Math.sin((u - 0.45) / 0.35 * Math.PI) * 0.85 : 0, step: 0, s: 0.8 };
    case 'petshop': return { ...CAGE, view: 'side', tilt: 0.4, beak: 0, step: u * 2, s: 0.55 };
    case 'question': return { ...PERCH, view: 'side', tilt: Math.sin(u * 3) * 0.3, beak: 0, step: 0, s: 0.8 };
    case 'thirty': return { ...PERCH, view: 'side', tilt: 0.2, beak: talk(), step: Math.sin(u * 6) * 0.3, s: 0.8 };
    case 'hundred': return { ...PERCH, view: 'front', tilt: Math.sin(u * 4.5) * 0.55, beak: talk(), step: 0, s: 0.84 };
    case 'tray': return { ...PERCH, view: 'side', tilt: 0.45, beak: talk(0.7), step: 0, s: 0.8 };
    case 'colour': return { ...PERCH, view: 'front', tilt: -0.85 + Math.sin(u * 2.5) * 0.15, beak: u > 0.55 ? Math.sin((u - 0.55) / 0.45 * Math.PI) * 0.9 : 0, step: 0, s: 0.86 };
    case 'away': {
      if (u < 0.4) { const t = u / 0.4, x = lerp(PERCH.x, LOW.x, ease(t)), z = lerp(PERCH.z, LOW.z, ease(t)), y = lerp(PERCH.y, LOW.y, ease(t)) + Math.sin(t * Math.PI) * 0.35; return { x, y, z, view: 'side', tilt: 0.1, beak: u > 0.3 ? 0.5 : 0, step: t * 2, s: 0.8, flip: true }; }
      return { ...LOW, view: 'side', tilt: 0.15, beak: 0, step: 0, s: 0.8, flip: true };
    }
    case 'sorry': return { ...LOW, view: 'side', tilt: 0.55, beak: (f % 55) < 16 ? Math.sin((f % 55) / 16 * Math.PI) * 0.55 : 0, step: 0, s: 0.8, flip: true };
    case 'lastnight': return { ...PERCH, view: 'front', tilt: 0.3, beak: u > 0.4 && u < 0.75 ? Math.sin((u - 0.4) / 0.35 * Math.PI) * 0.8 : 0, step: 0, s: 0.82 };
    default: return { ...PERCH, view: 'side', tilt: 0, beak: 0, step: 0, s: 0.8, alpha: 0 };
  }
};

// ---------------- cameras ----------------
const LK = (kf2, off = [0, 0.92, 0]) => { const B = alexPosAt(kf2); return [B.x + off[0], B.y + off[1], B.z + off[2]]; };
export const camAt = (f) => {
  const S = shotAt(f), u = S.u, a = S.a, b = S.b, m = Math.round((a + b) / 2);
  let c;
  switch (S.id) {
    case 'hook': c = camFromKeys([{ f: a, pos: [1.35, 1.95, 1.6], look: LK(a), fov: 38 }, { f: b, pos: [1.05, 1.85, 1.15], look: LK(b), fov: 35 }], f); c.shadowAt = [0, 1, -0.5]; return c;
    case 'petshop': c = camFromKeys([{ f: a, pos: [-1.7, 1.6, 0.6], look: LK(a, [0, 0.6, 0]), fov: 39 }, { f: b, pos: [-2.1, 1.5, 0.1], look: LK(b, [0, 0.6, 0]), fov: 37 }], f); c.shadowAt = [-3.4, 0.8, -2.2]; return c;
    case 'question': c = camFromKeys([{ f: a, pos: [2.3, 1.9, 2.2], look: LK(a), fov: 39 }, { f: b, pos: [1.9, 1.85, 1.7], look: LK(b), fov: 37 }], f); c.shadowAt = [0, 1, -0.5]; return c;
    case 'thirty': c = camFromKeys([{ f: a, pos: [2.0, 1.85, 2.4], look: LK(a), fov: 39 }, { f: b, pos: [1.6, 1.8, 1.9], look: LK(b), fov: 37 }], f); c.shadowAt = [0, 1, -0.5]; return c;
    case 'hundred': c = camFromKeys([{ f: a, pos: [1.15, 1.95, 1.75], look: LK(a), fov: 37 }, { f: b, pos: [0.95, 1.9, 1.4], look: LK(b), fov: 35 }], f); c.shadowAt = [0, 1, -0.5]; return c;
    case 'tray': c = camFromKeys([{ f: a, pos: [2.5, 1.8, 2.3], look: [0.8, 1.15, -0.3], fov: 39 }, { f: b, pos: [2.2, 1.7, 1.9], look: [0.85, 1.1, -0.3], fov: 37 }], f); c.shadowAt = [0.7, 0.8, 0]; return c;
    case 'colour': c = camFromKeys([{ f: a, pos: [1.05, 1.95, 1.5], look: LK(a), fov: 36 }, { f: b, pos: [0.9, 1.9, 1.25], look: LK(b), fov: 34 }], f); c.shadowAt = [0, 1, -0.5]; return c;
    case 'away': c = camFromKeys([{ f: a, pos: [1.6, 1.9, 2.2], look: LK(a), fov: 39 }, { f: m, pos: [0.2, 1.8, 2.6], look: LK(m), fov: 38 }, { f: b, pos: [-0.6, 1.65, 2.3], look: LK(b, [0, 0.8, 0]), fov: 37 }], f); c.shadowAt = [-1, 0.8, 0]; return c;
    case 'sorry': c = camFromKeys([{ f: a, pos: [-0.5, 1.6, 2.5], look: LK(a, [0, 0.8, 0]), fov: 38 }, { f: b, pos: [-0.75, 1.55, 2.2], look: LK(b, [0, 0.8, 0]), fov: 36 }], f); c.shadowAt = [-1.9, 0.7, 0.4]; return c;
    case 'lastnight': c = camFromKeys([{ f: a, pos: [1.5, 1.9, 1.9], look: LK(a), fov: 38 }, { f: b, pos: [1.2, 1.85, 1.5], look: LK(b), fov: 36 }], f); c.shadowAt = [0, 1, -0.5]; return c;
    case 'morning': c = camFromKeys([{ f: a, pos: [1.7, 1.95, 2.1], look: [0, 1.7, -0.7], fov: 39 }, { f: b, pos: [1.4, 1.9, 1.8], look: [0, 1.68, -0.7], fov: 37 }], f); c.shadowAt = [0, 1, -0.5]; return c;
    case 'argue': c = camFromKeys([{ f: a, pos: [-0.6, 1.8, 2.6], look: [-2.45, 1.05, 0.8], fov: 39 }, { f: b, pos: [-0.75, 1.8, 2.75], look: [-2.45, 1.03, 0.8], fov: 37 }], f); c.shadowAt = [-2, 0.8, 0.5]; return c;
    default: return { pos: [1.5, 1.9, 2], look: [0, 1.8, -0.7], fov: 38, shadowAt: [0, 1, -0.5] };
  }
};

// ---------------- lights ----------------
const DAY = { sky: '#dfe9f2', ground: '#8a8d90', sun: '#fff4d8', hemi: 1.05, sunI: 2.2, az: -35, el: 42, fog: '#e3e6e2', fogNear: 26, fogFar: 120, sat: 1.05, sunDisc: '#fff0c0', sunSize: 0.003, shadowExt: 9 };
const LIGHTS = {
  hook: { sky: '#8a97b5', ground: '#4c5058', sun: '#ffd9a8', hemi: 0.5, sunI: 0.8, az: -60, el: 12, fog: '#9aa0ac', fogNear: 20, fogFar: 90, sat: 0.97, sunDisc: '#ffcf8a', sunSize: 0.003, shadowExt: 9, vig: 0.36 },
  petshop: { ...DAY, hemi: 0.95, sunI: 1.9 },
  question: { ...DAY }, thirty: { ...DAY }, hundred: { ...DAY, sunI: 2.35 }, tray: { ...DAY }, colour: { ...DAY, sunI: 2.35 },
  away: { sky: '#b9c2d4', ground: '#62666c', sun: '#ffc98f', hemi: 0.68, sunI: 1.2, az: -55, el: 16, fog: '#c3c7cc', fogNear: 22, fogFar: 100, sat: 1.0, sunDisc: '#ffc98f', sunSize: 0.003, shadowExt: 9, vig: 0.3 },
  sorry: { sky: '#c2c9d8', ground: '#6a6e74', sun: '#ffd2a0', hemi: 0.74, sunI: 1.35, az: -50, el: 20, fog: '#ccd0d2', fogNear: 24, fogFar: 110, sat: 1.01, sunDisc: '#ffd2a0', sunSize: 0.003, shadowExt: 9, vig: 0.28 },
  lastnight: { sky: '#7d86a0', ground: '#454a52', sun: '#ffc98f', hemi: 0.44, sunI: 0.65, az: -60, el: 10, fog: '#8d929e', fogNear: 18, fogFar: 85, sat: 0.98, sunDisc: '#ffc98f', sunSize: 0.002, shadowExt: 9, vig: 0.38 },
  morning: { sky: '#c9d1da', ground: '#71767c', sun: '#e8e2d2', hemi: 0.78, sunI: 1.1, az: 20, el: 18, fog: '#d5d8d8', fogNear: 24, fogFar: 110, sat: 0.92, sunDisc: '#e8e2d2', sunSize: 0.002, shadowExt: 9, vig: 0.3 },
  argue: { ...DAY, hemi: 0.92, sunI: 1.8 },
};
export const lightFor = (S, f) => {
  const L = { ...(LIGHTS[S.id] || LIGHTS.thirty) };
  const seq = TIMING.map(([id]) => id);
  const i = seq.indexOf(S.id), prev = LIGHTS[seq[Math.max(0, i - 1)]], next = LIGHTS[seq[Math.min(seq.length - 1, i + 1)]];
  const mixL = (A, B, t) => { const o = {}; for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k] ?? A[k], t) : (t < 0.5 ? A[k] : B[k]); return o; };
  let out = L;
  if (S.u < 0.14 && i > 0) out = mixL(prev, L, ramp(S.u, 0, 0.14));
  if (S.u > 0.9 && i < seq.length - 1) out = mixL(out === L ? L : out, next, ramp(S.u, 0.9, 1));
  out.skyTop = out.sky; out.skyHor = out.fog;
  out.aurora = out.aurora || 0; out.vig = out.vig ?? 0.2; out.sunSize = out.sunSize || 0;
  return out;
};
export const dofAt = (f) => {
  const S = shotAt(f); const C = camAt(f);
  if (S.id === 'argue') return { focus: Math.hypot(C.pos[0] + 2.45, C.pos[1] - 1.05, C.pos[2] - 0.8), cinf: 5.5, near: 1.6 };
  const B = alexPosAt(f);
  const d = Math.hypot(C.pos[0] - B.x, C.pos[1] - (B.y + 0.9), C.pos[2] - B.z);
  return { focus: Math.max(1.1, d), cinf: 5.5, near: 1.6 };
};

// ---------------- world state ----------------
export const worldAt = (f) => {
  const S = shotAt(f), u = S.u;
  return {
    boardWords: (S.id === 'hundred' ? ramp(u, 0.1, 0.3) * (1 - ramp(u, 0.4, 0.55)) : 0) + (S.id === 'tray' ? 0.9 * (1 - ramp(u, 0.5, 0.7)) : 0) + (S.id === 'colour' ? 0.45 : 0),
    boardDifferent: 0,
    boardFinale: S.id === 'argue' ? ramp(u, 0.12, 0.35) : 0,
    lampT: S.id === 'lastnight' ? 1 : S.id === 'hook' ? 0.5 : 0,
    trayT: 1,
  };
};
export const fxProfileAt = () => ({ smokeRate: 0, dustRate: 0 });

// ---------------- actors ----------------
const IRENE = { skin: '#f2c398', jacket: '#e8e6e0', pants: '#4a4a52', boots: '#333338', build: 'adult', hair: '#6a4a30' };
const ASSIST = { skin: '#d99e72', jacket: '#5a6a7a', pants: '#3c4048', boots: '#2c2c30', build: 'adult', hair: '#2c2620' };
export const actorsAt = (f, T) => {
  const S = shotAt(f), u = S.u, B = alexPosAt(f);
  const out = [];
  const blinkB = (f % 83) < 3;
  if ((B.alpha ?? 1) > 0.02) out.push({ key: 'alex' + JSON.stringify({ v: B.view, t: Math.round((B.tilt || 0) * 4), b: Math.round((B.beak || 0) * 4), s: Math.round((B.step || 0) * 3), bl: blinkB ? 1 : 0 }),
    draw: (p) => T.alexCard(p, { view: B.view, tilt: B.tilt, beak: B.beak, step: B.step, blink: blinkB, wagPh: u }),
    x: B.x, y: B.y, z: B.z, ground: B.y, s: B.s, flip: !!B.flip, alpha: B.alpha ?? 1, blob: false });
  const person = (outfit, x, z, o = {}) => {
    const bp = { expr: o.expr || 'neutral', blink: (f % 91) < 3, step: o.step || 0, breathe: Math.sin(f * 0.05 + (o.phase || 0)) * 0.5 + 0.5, airY: 0, arms: o.arms || 0 };
    return { key: 'person' + (o.id || '') + JSON.stringify(bp), draw: (p) => T.bodyFront(p, outfit, bp), x, y: 0, z, ground: 0, s: o.s || 1.0, flip: !!o.flip, alpha: o.alpha ?? 1 };
  };
  if (S.id === 'question') out.push(person(IRENE, 1.15, 0.35, { id: 'ir', expr: 'wonder', arms: 0.25 }));
  if (S.id === 'thirty') { out.push(person(IRENE, 1.05, 0.5, { id: 'ir', expr: 'smile', arms: Math.sin(u * 6) * 0.2 + 0.3 })); out.push(person(ASSIST, 2.6, -0.9, { id: 'as', expr: 'neutral', phase: 2, s: 0.97 })); }
  if (S.id === 'hundred') out.push(person(IRENE, 1.3, 0.75, { id: 'ir', expr: 'smile', arms: 0.35 }));
  if (S.id === 'tray') out.push(person(IRENE, 2.15, 0.95, { id: 'ir', expr: 'neutral', arms: 0.45, phase: 1 }));
  if (S.id === 'sorry') out.push(person(IRENE, -0.95, 1.35, { id: 'ir', expr: 'pained', s: 1.02 }));
  if (S.id === 'lastnight') out.push(person(IRENE, -1.5, 0.9, { id: 'ir', expr: 'smile', phase: 3 }));
  if (S.id === 'morning') out.push(person(IRENE, 0.75, 0.15, { id: 'ir', expr: 'pained', phase: 1 }));
  if (S.id === 'argue') { out.push(person(ASSIST, 1.7, -1.6, { id: 'as', expr: 'stern', arms: 0.3 })); out.push(person(IRENE, -3.3, 1.9, { id: 'ir', expr: 'pained', s: 0.98, phase: 2 })); }
  return out;
};
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'tray') { // a glint walks the objects as he names them
    const spots = [[1.03, 0.95, 0.2], [1.5, 0.98, -0.05], [1.83, 0.92, 0.28], [1.4, 0.95, 0.32]];
    const i = Math.min(3, Math.floor(S.u * 4)), ph = (S.u * 4) % 1;
    if (ph < 0.55) { const [x, y, z] = spots[i]; out.push({ key: 'trayglint' + i, draw: (p) => T.fxSpark(p, { n: 4, r: 40, col: '#fff2b8' }), x, y, z, ground: y, s: 0.55, blob: false, shadow: false }); }
  }
  if (S.id === 'lastnight' && S.u > 0.4 && S.u < 0.75 && (f % 36) < 14) {
    const B = alexPosAt(f);
    out.push({ key: 'heart', draw: (p) => T.fxSpark(p, { n: 4, r: 34, col: '#ffd9c9' }), x: B.x + 0.3, y: B.y + 1.0, z: B.z + 0.25, ground: B.y + 1.0, s: 0.5, blob: false, shadow: false });
  }
  return out;
};
// Boards: single source of truth (matches main.js placements)
export const BOARDS = [
  { id: 'words', key: 'boardWords', pos: [-0.9, 1.75, -3.24], yaw: 0, w: 1.3, h: 0.85, check: [509, 763] },
  { id: 'finale', key: 'boardFinale', pos: [-2.45, 1.12, 0.815], yaw: 0.55, w: 0.85, h: 0.55, check: [1324, 1553] },
];
