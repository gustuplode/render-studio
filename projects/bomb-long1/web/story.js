// "The Day America Dropped the Atomic Bomb on Japan" — coded 9:16 HYPER-EXPLAIN long (~6 min).
// Respectful factual treatment: strategy, science, machines, maps. NO victims, NO gore.
// The city's destruction is abstract: flash, shockwave rings over a stylised grid,
// a mushroom cloud, then an empty quiet grid at dawn.
//
// STRUCTURE RULE: every timing flows from the ONE TIMING table below. All tracks are built
// from shot fractions (u = 0..1 of the shot) via the K()/CK()/SP() helpers, so the parent
// patches TIMING when the real voice lands and the whole film re-times itself.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30;
// ---------- THE timing table: [sectionId, startFrame, endFrame] (FINAL — v2 voice, 349.54 s) ----------
export const TIMING = [
  ['hook', 0, 269],          // a single plane over a dawn sea + big title card
  ['war1945', 269, 860],     // Pacific map: island hops light up, WAR IN EUROPE OVER
  ['manhattan', 860, 1966],  // desert lab, hidden city, the Trinity test
  ['witness', 1966, 2765],   // INSERT: Trinity aftermath — witnesses watch the column, a window cracks
  ['decision', 2765, 2831],  // the order is given — one line over the target board, HIROSHIMA lit
  ['debate', 2831, 3797],    // INSERT: the debate — demonstrate first? surrender, or utter destruction
  ['verdict', 3797, 4280],   // the target committee: the list, the rules, HIROSHIMA chosen
  ['enolagay', 4280, 4985],  // silver B-29, Tinian runway at night, take-off 2:45
  ['thedrop', 4985, 5618],   // bomb bay opens, the fall, 8:15 — FLASH, fireball, the cloud
  ['aftermath', 5618, 6182], // shockwave rings over the grid, fires, black rain, quiet grid
  ['spared', 6182, 7103],    // INSERT: retrospective — the intact city, leaflets, the investigators
  ['secondbomb', 7103, 8080],// Kokura clouded over, the turn south, Nagasaki
  ['surrender', 8080, 8355], // radio waves, the Emperor speaks, WAR OVER
  ['sadako', 8355, 9974],    // INSERT: the peace park — Sadako and the thousand paper cranes
  ['legacy', 9974, 10486],   // the cloud fades into a peaceful dawn — NEVER AGAIN
];
export const TOTAL = TIMING[TIMING.length - 1][2]; // 10486 frames = 349.5 s @ 30 fps (v2 voice final)
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
const LIGHT_OF = { hook: 'dawn', war1945: 'day', manhattan: 'desert', witness: 'desert', decision: 'room', debate: 'room', verdict: 'room', enolagay: 'night', thedrop: 'day', aftermath: 'smoke', spared: 'dawn', secondbomb: 'overcast', surrender: 'golden', sadako: 'dawn', legacy: 'dawn' };
export const SHOTS = TIMING.map(([id, a, b]) => ({ id, a, b, light: LIGHT_OF[id] }));
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const ph = (id, f) => clamp((f - SEG[id].a) / SEG[id].len);
const smooth = M.smooth;
const K = (id, rows) => rows.map(([u, v, e, via]) => [Math.round(SEG[id].a + u * SEG[id].len), v, e, via]);
const CK = (id, rows) => rows.map(([u, pos, look, fov, ease, roll]) => ({ f: Math.round(SEG[id].a + u * SEG[id].len), pos, look, fov, ease, roll }));

// ---------- shared stage geometry (== main.js world build) ----------
export const LAYOUT = {
  sea0: [0, 0], mapC: [140, 5],
  hops: [[88, 28], [103, 20], [116, 13], [127, 6], [134, 0], [139, -6], [144, -12], [149, -18]],
  japan: [156, -27], hiroshimaM: [149, -24], kokuraM: [155, -30], nagasakiM: [143, -30],
  tower: [280, -10], lab: [280, -2],
  board: [370, -14],
  runway: [445, 6],
  cityC: [600, 0], burst: [603, 17, 1],
  nagaC: [740, 0], burst2: [743, 15, 2],
  radio: [840, 0], flag: [858, -6],
  legacySea: [960, 0], legacyCloud: [992, -46],
  watchers: [265, 19], winFrame: [269, 13], // witness: observer group + the window that cracks (desert zone)
  table: [366, -3],                          // debate: council table in front of the target board
  sparedC: [1130, 0],                        // spared: the second, untouched city grid (leaflets + investigators)
  parkC: [1250, 0],                          // sadako: the peace park
};

// ---------- lights ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 320,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 22, ...WATER },
  dawn: { az: 95, el: 12, sky: '#d9b8a8', ground: '#5c5648', hemi: 1.05, sun: '#ffb46c', sunI: 2.6, fog: '#e8c4a8', fogNear: 40, fogFar: 300,
    skyTop: '#5a6ea8', skyHor: '#ffc9a0', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.08, gain: '#fff2e2', vig: 0.26, shadowExt: 22, waterDeep: '#2c4c6c', waterShal: '#7a90b4', glint: '#ffe9c0' },
  desert: { az: 150, el: 52, sky: '#d8c9a8', ground: '#9a7c52', hemi: 1.1, sun: '#fff3da', sunI: 2.6, fog: '#e3d3ae', fogNear: 50, fogFar: 320,
    skyTop: '#5a90cc', skyHor: '#ecd9ae', sat: 1.06, vig: 0.2, shadowExt: 20, ...WATER },
  room: { az: 60, el: 30, sky: '#8a7a66', ground: '#4c4438', hemi: 0.9, sun: '#ffd9a0', sunI: 1.7, fog: '#6a5c4a', fogNear: 26, fogFar: 150,
    skyTop: '#4a4238', skyHor: '#8a7a66', sat: 1.0, vig: 0.34, shadowExt: 14, ...WATER },
  night: { az: 220, el: 34, sky: '#33456b', ground: '#1c1a20', hemi: 0.95, sun: '#aebfff', sunI: 1.2, fog: '#232c40', fogNear: 16, fogFar: 190,
    skyTop: '#101a2e', skyHor: '#2c3a55', sat: 1.03, vig: 0.3, shadowExt: 16, waterDeep: '#16283c', waterShal: '#2c445c', glint: '#cfe0ff' },
  smoke: { az: 40, el: 26, sky: '#9a8a7c', ground: '#4c443c', hemi: 0.95, sun: '#ffb46c', sunI: 1.8, fog: '#8a7a6c', fogNear: 30, fogFar: 240,
    skyTop: '#5c564e', skyHor: '#c9a184', sunDisc: '#ffe9c0', sunSize: 0.003, sat: 0.98, vig: 0.3, shadowExt: 20, waterDeep: '#2c445c', waterShal: '#3a5a74', glint: '#ffe9c0' },
  overcast: { az: 120, el: 40, sky: '#b9c1c9', ground: '#6a6e66', hemi: 1.1, sun: '#e8ecf2', sunI: 1.7, fog: '#c3cbd2', fogNear: 40, fogFar: 280,
    skyTop: '#7a8894', skyHor: '#ccd3da', sat: 0.96, vig: 0.22, shadowExt: 20, ...WATER },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 40, fogFar: 280,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', vig: 0.26, shadowExt: 20, ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- hero object tracks (single source: actors, camera, world all read these) ----------
const cruise = (u) => u < 0.12 ? M.surge(u / 0.12) * 0.12 : u > 0.88 ? 0.88 + M.surge((u - 0.88) / 0.12) * 0.12 : u;
const SP = (id, pts) => (f) => spline(pts, cruise(ph(id, f)));
const hookPath = SP('hook', [[-46, 15, -14], [-20, 16, -6], [5, 15, 2], [34, 16, 10], [58, 15, 16]]);
const enolaPath = (f) => kf3(K('enolagay', [
  [0, [445, 1.7, 6]], [0.22, [445, 1.7, 6]], [0.38, [478, 1.9, 4.5], 'easeIn'], [0.48, [506, 7, 1], 'easeInOut'], [0.68, [545, 27, -3], 'easeInOut'], [1, [578, 44, -3], 'easeInOut'],
]), f);
const dropPath = SP('thedrop', [[578, 45, -3], [596, 47, 0], [622, 46, 2], [655, 44, 6]]);
const bockPath = SP('secondbomb', [[640, 34, -26], [690, 39, -12], [724, 41, -2], [762, 40, 6], [806, 37, 16]]);
const mkState = (path, f, propsOn) => {
  const p = path(f);
  let p2 = path(f + 1.5), d = [p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]], sp = Math.hypot(...d);
  if (sp < 1e-4) { const p0 = path(f - 1.5); d = [p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]]; sp = Math.hypot(...d); }
  if (sp < 1e-4) { d = [1, 0, 0]; sp = 0; }
  return { p, d: d.map((v) => v / (sp || 1)), speed: sp / 1.5, props: propsOn ? (f * 1.9) % (Math.PI * 2) : 0 };
};
export const planeAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'hook') return mkState(hookPath, f, true);
  if (S.id === 'enolagay') return mkState(enolaPath, f, ph('enolagay', f) > 0.16);
  if (S.id === 'thedrop') return mkState(dropPath, f, true);
  return null;
};
export const plane2At = (f) => {
  const S = shotAt(f);
  if (S.id !== 'secondbomb' || ph('secondbomb', f) < 0.42) return null;
  return mkState(bockPath, f, true);
};
// the falling bombs (tracked objects)
const relF = Math.round(SEG.thedrop.a + 0.30 * SEG.thedrop.len), burstF = Math.round(SEG.thedrop.a + 0.52 * SEG.thedrop.len);
const REL_P = dropPath(relF);
export const bombAt = (f) => {
  if (f < relF || f > burstF) return null;
  const u = (f - relF) / (burstF - relF);
  const p = lerp3(REL_P, LAYOUT.burst, u * u * 0.85 + u * 0.15); // gravity: slow start, fast end
  return { p, d: [0.12, -1, 0.02] };
};
const rel2F = Math.round(SEG.secondbomb.a + 0.66 * SEG.secondbomb.len), burst2F = Math.round(SEG.secondbomb.a + 0.80 * SEG.secondbomb.len);
const REL2_P = bockPath(rel2F);
export const bomb2At = (f) => {
  if (f < rel2F || f > burst2F) return null;
  const u = (f - rel2F) / (burst2F - rel2F);
  const p = lerp3(REL2_P, LAYOUT.burst2, u * u * 0.85 + u * 0.15);
  return { p, d: [0.12, -1, 0.02] };
};
// mushroom clouds: rise + grow, then a long slow settle. s = UNIFORM scale of the unit
// cloud in main.js (unit height ~1.05, cap radius ~0.55) — never scale x/y non-uniformly.
const cloudState = (f, f0, base, maxS, growF, a0) => {
  if (f < f0) return null;
  const u = clamp((f - f0) / growF);
  const e = M.easeOut(u);
  return { p: base, s: 4 + (maxS - 4) * e, a: a0 * (1 - 0.25 * clamp((f - f0 - growF) / 2200)) };
};
export const cloudAt = (f) => { const id = shotAt(f).id; return (id === 'thedrop' || id === 'aftermath') ? cloudState(f, burstF, [LAYOUT.burst[0], 0, LAYOUT.burst[2]], 30, 620, 1) : null; };
export const cloud2At = (f) => shotAt(f).id === 'secondbomb' ? cloudState(f, burst2F, [LAYOUT.burst2[0], 0, LAYOUT.burst2[2]], 20, 420, 0.95) : null;
// key event frames (exported for main.js shakes/glows)
export const EV = { triF: Math.round(SEG.manhattan.a + 0.55 * SEG.manhattan.len), relF, burstF, rel2F, burst2F };

// ---------- TRACKING DIRECTOR ----------
const hopPos = (f) => { // war1945: the look target travels the island chain as hops light up
  const u = ph('war1945', f) * 8.6, i = Math.min(7, Math.floor(u)), t = smooth(clamp(u - i));
  const A = LAYOUT.hops[i], B = LAYOUT.hops[Math.min(8, i + 1)] || LAYOUT.japan;
  return [lerp(A[0], B[0], t), 1.2, lerp(A[1], B[1], t)];
};
const cloudTop = (c) => c ? [c.p[0], c.s * 0.55, c.p[2]] : [LAYOUT.burst[0], 17, LAYOUT.burst[2]];
const TRACKDIR = {
  hook: [{ a: SEG.hook.a, b: SEG.hook.b, type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || [0, 15, 0], w: 0.62 }],
  war1945: [{ a: SEG.war1945.a, b: SEG.war1945.b, type: 'subject', id: 'map-hops', pos: hopPos, w: 0.55 }],
  manhattan: [{ a: SEG.manhattan.a, b: SEG.manhattan.b, type: 'object', id: 'tower', pos: () => [LAYOUT.tower[0], 9, LAYOUT.tower[1]], w: 0.6 }],
  witness: [
    { a: SEG.witness.a, b: SEG.witness.a + Math.round(0.5 * SEG.witness.len), type: 'object', id: 'firecolumn', pos: () => [LAYOUT.tower[0], 11, LAYOUT.tower[1]], w: 0.55 },
    { a: SEG.witness.a + Math.round(0.5 * SEG.witness.len), b: SEG.witness.b, type: 'subject', id: 'watchers', pos: () => [LAYOUT.watchers[0], 2.2, LAYOUT.watchers[1]], w: 0.6 },
  ],
  decision: [
    { a: SEG.decision.a, b: SEG.decision.a + Math.round(0.45 * SEG.decision.len), type: 'subject', id: 'board', pos: () => [LAYOUT.board[0], 5.5, LAYOUT.board[1]], w: 0.55 },
    { a: SEG.decision.a + Math.round(0.45 * SEG.decision.len), b: SEG.decision.b, type: 'object', id: 'hiroshima-card', pos: () => [LAYOUT.board[0] - 1.5, 6.8, LAYOUT.board[1]], w: 0.66 },
  ],
  verdict: [
    { a: SEG.verdict.a, b: SEG.verdict.a + Math.round(0.45 * SEG.verdict.len), type: 'subject', id: 'board', pos: () => [LAYOUT.board[0], 5.5, LAYOUT.board[1]], w: 0.55 },
    { a: SEG.verdict.a + Math.round(0.45 * SEG.verdict.len), b: SEG.verdict.b, type: 'object', id: 'hiroshima-card', pos: () => [LAYOUT.board[0] - 1.5, 6.8, LAYOUT.board[1]], w: 0.66 },
  ],
  debate: [
    { a: SEG.debate.a, b: SEG.debate.a + Math.round(0.48 * SEG.debate.len), type: 'subject', id: 'board', pos: () => [LAYOUT.board[0], 6, LAYOUT.board[1]], w: 0.55 },
    { a: SEG.debate.a + Math.round(0.48 * SEG.debate.len), b: SEG.debate.b, type: 'subject', id: 'council', pos: () => [LAYOUT.table[0], 2.2, LAYOUT.table[1]], w: 0.62 },
  ],
  enolagay: [{ a: SEG.enolagay.a, b: SEG.enolagay.b, type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || [445, 2, 6], w: 0.66 }],
  thedrop: [
    { a: SEG.thedrop.a, b: relF, type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || [596, 47, 0], w: 0.6 },
    { a: relF, b: burstF, type: 'object', id: 'bomb', pos: (f) => (bombAt(f) || {}).p || LAYOUT.burst, w: 0.78 },
    { a: burstF, b: SEG.thedrop.b, type: 'object', id: 'cloud', pos: (f) => cloudTop(cloudAt(f)), w: 0.62 },
  ],
  aftermath: [{ a: SEG.aftermath.a, b: SEG.aftermath.b, type: 'subject', id: 'city-cloud', pos: (f) => { const c = cloudAt(f); return c ? [c.p[0], c.s * 0.5, c.p[2]] : [LAYOUT.cityC[0], 16, LAYOUT.cityC[1]]; }, w: 0.55 }],
  spared: [
    { a: SEG.spared.a, b: SEG.spared.a + Math.round(0.34 * SEG.spared.len), type: 'subject', id: 'city-intact', pos: () => [LAYOUT.cityC[0], 3, LAYOUT.cityC[1]], w: 0.55 },
    { a: SEG.spared.a + Math.round(0.34 * SEG.spared.len), b: SEG.spared.a + Math.round(0.72 * SEG.spared.len), type: 'subject', id: 'leaflets', pos: () => [LAYOUT.sparedC[0], 5, LAYOUT.sparedC[1]], w: 0.5 },
    { a: SEG.spared.a + Math.round(0.72 * SEG.spared.len), b: SEG.spared.b, type: 'subject', id: 'investigators', pos: () => [LAYOUT.sparedC[0] - 8, 2, LAYOUT.sparedC[1] + 11], w: 0.62 },
  ],
  secondbomb: [
    { a: SEG.secondbomb.a, b: SEG.secondbomb.a + Math.round(0.42 * SEG.secondbomb.len), type: 'subject', id: 'kokura', pos: () => [LAYOUT.kokuraM[0], 1.2, LAYOUT.kokuraM[1]], w: 0.55 },
    { a: SEG.secondbomb.a + Math.round(0.42 * SEG.secondbomb.len), b: burst2F, type: 'object', id: 'plane2', pos: (f) => (plane2At(f) || bomb2At(f) || { p: bockPath(f) }).p, w: 0.62 },
    { a: burst2F, b: SEG.secondbomb.b, type: 'object', id: 'cloud2', pos: (f) => cloudTop(cloud2At(f)), w: 0.6 },
  ],
  surrender: [
    { a: SEG.surrender.a, b: SEG.surrender.a + Math.round(0.55 * SEG.surrender.len), type: 'object', id: 'radio', pos: () => [LAYOUT.radio[0], 24, LAYOUT.radio[1]], w: 0.55 },
    { a: SEG.surrender.a + Math.round(0.55 * SEG.surrender.len), b: SEG.surrender.b, type: 'subject', id: 'flag', pos: () => [LAYOUT.flag[0], 5, LAYOUT.flag[1]], w: 0.6 },
  ],
  sadako: [{ a: SEG.sadako.a, b: SEG.sadako.b, type: 'subject', id: 'statue', pos: () => [LAYOUT.parkC[0], 3.6, LAYOUT.parkC[1]], w: 0.55 }],
  legacy: [{ a: SEG.legacy.a, b: SEG.legacy.b, type: 'subject', id: 'legacy-cloud', pos: () => [LAYOUT.legacyCloud[0], 13, LAYOUT.legacyCloud[1]], w: 0.5 }],
};
const BLEND = 12;
export const dirFor = (id, f) => {
  const segs = TRACKDIR[id];
  let i = segs.findIndex((s) => f <= s.b); if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  let point = seg.pos(f), w = seg.w;
  const pv = segs[i - 1];
  if (pv && f < seg.a + BLEND / 2) { // complete the handoff blend AFTER crossing into this segment
    const t = smooth(ramp(f, seg.a - BLEND / 2, seg.a + BLEND / 2));
    point = lerp3(pv.pos(f), point, t); w = lerp(pv.w, w, t);
  } else {
    const nx = segs[i + 1];
    if (nx && f >= nx.a - BLEND / 2) {
      const t = smooth(ramp(f, nx.a - BLEND / 2, nx.a + BLEND / 2));
      point = lerp3(point, nx.pos(f), t); w = lerp(w, nx.w, t);
    }
  }
  return { point, w, seg };
};
export const dirAt = (f) => dirFor(shotAt(f).id, f);

// ---------- cameras ----------
const CAMS = {
  hook: CK('hook', [
    [0, [-40, 11, 36], [-30, 14, -8], 44], [0.5, [-6, 12, 34], [8, 15, 2], 42, 'easeInOut'], [1, [30, 13, 30], [52, 15, 14], 42],
  ]),
  war1945: CK('war1945', [
    [0, [84, 54, 68], [128, 0, -2], 46], [0.45, [116, 44, 54], [142, 0, -12], 44, 'easeInOut'], [1, [148, 38, 44], [153, 0, -24], 43],
  ]),
  manhattan: CK('manhattan', [
    [0, [236, 7, 32], [280, 8, -10], 43], [0.4, [250, 6, 24], [280, 10, -10], 42, 'surge'], [0.62, [258, 5.5, 18], [280, 11, -10], 41, 'surge'], [1, [266, 6, 20], [280, 9, -10], 41],
  ]),
  witness: CK('witness', [ // slow push-in: from the fire column, settling behind the watchers
    [0, [246, 5.5, 38], [280, 10, -10], 43], [0.5, [253, 4.5, 32], [274, 7, 0], 42, 'easeInOut'], [1, [259, 3.8, 27], [266, 3, 15], 41],
  ]),
  decision: CK('decision', [
    [0, [350, 4.5, 18], [370, 5, -14], 42], [0.5, [359, 4.5, 11], [371, 5.5, -14], 41, 'surge'], [1, [365, 5, 7], [369, 6.5, -14], 40],
  ]),
  verdict: CK('verdict', [ // the decision set again: the committee reads the list, HIROSHIMA is chosen
    [0, [350, 4.5, 18], [370, 5, -14], 42], [0.5, [359, 4.5, 11], [371, 5.5, -14], 41, 'surge'], [1, [365, 5, 7], [369, 6.5, -14], 40],
  ]),
  debate: CK('debate', [ // alternates: board wall -> council table -> board -> table (radio beat)
    [0, [352, 5, 16], [368, 6, -14], 42], [0.3, [359, 4, 9], [366, 2.5, -4], 41, 'surge'], [0.55, [356, 4.5, 13], [371, 6, -14], 41, 'easeInOut'], [0.78, [361, 3.5, 8], [366, 2.2, -3], 40, 'surge'], [1, [363, 3.2, 6], [366, 2.2, -3], 40],
  ]),
  enolagay: CK('enolagay', [
    [0, [424, 5, 30], [445, 3, 6], 43], [0.3, [434, 5.5, 27], [455, 3, 5], 42, 'surge'], [0.62, [488, 11, 21], [524, 17, -2], 42, 'easeInOut'], [1, [522, 21, 17], [568, 40, -3], 41],
  ]),
  thedrop: CK('thedrop', [
    [0, [546, 40, 27], [584, 45, -2], 42], [0.32, [564, 38, 23], [600, 41, 0], 41, 'easeInOut'], [0.55, [578, 30, 21], [603, 20, 1], 40, 'easeInOut'], [0.8, [574, 26, 44], [601, 22, 0], 41, 'surge'], [1, [580, 30, 50], [601, 24, 0], 42],
  ]),
  aftermath: CK('aftermath', [
    [0, [544, 26, 58], [600, 10, 0], 44], [0.5, [556, 32, 66], [600, 14, 0], 43, 'easeInOut'], [1, [566, 38, 72], [600, 16, 0], 43],
  ]),
  spared: CK('spared', [ // dawn over the intact city, a long crane flight east, leaflets, then the investigators
    [0, [538, 17, 48], [600, 2, 0], 44], [0.3, [554, 14, 41], [600, 2.5, 0], 43, 'easeInOut'], [0.52, [850, 30, 34], [1010, 4, 0], 44, 'easeInOut'], [0.74, [1092, 13, 34], [1130, 4, 0], 42, 'easeInOut'], [1, [1110, 3.5, 19], [1122, 2, 10], 40],
  ]),
  secondbomb: CK('secondbomb', [
    [0, [118, 31, 36], [150, 0, -28], 44], [0.3, [146, 35, 32], [150, 0, -29], 43, 'surge'], [0.55, [556, 46, 38], [648, 32, -12], 44, 'easeInOut'], [0.78, [688, 31, 31], [742, 22, 2], 41, 'easeInOut'], [1, [704, 27, 35], [742, 20, 2], 42],
  ]),
  surrender: CK('surrender', [
    [0, [804, 9, 31], [840, 16, 0], 43], [0.4, [819, 7.5, 25], [840, 21, 0], 42, 'surge'], [0.7, [836, 6.5, 21], [858, 4.5, -6], 41, 'surge'], [1, [829, 9.5, 29], [852, 6, -4], 42],
  ]),
  sadako: CK('sadako', [ // one very gentle crane-in on the statue; nothing hurries here
    [0, [1216, 7.5, 35], [1250, 4.5, 0], 42], [0.5, [1230, 5.5, 26], [1250, 4, 0], 41, 'easeInOut'], [1, [1240, 4.2, 18], [1250, 3.8, -1], 40],
  ]),
  legacy: CK('legacy', [
    [0, [916, 8, 27], [985, 14, -42], 42], [0.5, [929, 12, 21], [988, 13, -44], 41, 'easeInOut'], [1, [945, 18, 15], [990, 12, -45], 40],
  ]),
};
const SHADOW_AT = { hook: [0, 8, 0], war1945: [140, 0, 0], manhattan: [280, 4, -6], witness: [268, 2, 8], decision: [370, 4, -10], debate: [368, 3, -6], verdict: [370, 4, -10], enolagay: [470, 2, 4], thedrop: [600, 20, 0], aftermath: [600, 8, 0], spared: [1124, 2, 4], secondbomb: [742, 8, 0], surrender: [845, 6, -2], sadako: [1250, 3, 0], legacy: [965, 6, -20] };
const flashPulse = (f, f0, peak, hold, decay) => {
  const d = f - f0; if (d < 0 || d > hold + decay) return 0;
  return d <= hold ? peak : peak * (1 - (d - hold) / decay);
};
const SHAKES = [{ f: EV.triF + 1, a: 0.004 }, { f: burstF + 1, a: 0.0075 }, { f: burst2F + 1, a: 0.0045 }];
const SHAKE_SHAPE = [1, -0.62, 0.3, -0.12];
const DIPS = TIMING.slice(1).map(([, a]) => a);
export const camAt = (f) => {
  const S = shotAt(f);
  let c = camFromKeys(CAMS[S.id], f, {});
  const D = dirFor(S.id, f);
  c = { ...c, look: lerp3(c.look, D.point, D.w) };
  for (const s of SHAKES) {
    const d = f - s.f;
    if (d >= 0 && d < 4) { const m = s.a * SHAKE_SHAPE[d]; c.pos = [c.pos[0] + m * 0.5, c.pos[1] + m, c.pos[2]]; c.look = [c.look[0] + m * 0.8, c.look[1] + m * 1.4, c.look[2]]; }
  }
  let flash = 0;
  if (f < 9) flash = -0.95 * (1 - f / 9);
  for (const B of DIPS) { const d = f - B; if (d >= -3 && d <= 3) flash = Math.min(flash, -0.95 * Math.cos(d / 3 * Math.PI / 2)); }
  flash = Math.max(flash, flashPulse(f, EV.triF, 0.85, 4, 30));
  flash = Math.max(flash, flashPulse(f, burstF, 1.0, 6, 46));
  flash = Math.max(flash, flashPulse(f, burst2F, 0.8, 4, 34));
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CINF = { hook: 6, war1945: 8, manhattan: 6, witness: 5, decision: 4, debate: 4, verdict: 4, enolagay: 6, thedrop: 5, aftermath: 7, spared: 6, secondbomb: 6, surrender: 6, sadako: 4, legacy: 4 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  return { focus: dist(C.pos, dirAt(f).point), cinf: CINF[S.id] ?? 5 };
};

// ---------- world state (drives the 3D hardware in main.js) ----------
export const worldAt = (f) => {
  const S = shotAt(f), u = ph(S.id, f);
  const triAge = f - EV.triF;
  const burstAge = f - burstF, burst2Age = f - burst2F;
  const cityFires = S.id === 'aftermath' ? clamp(ramp(f, SEG.aftermath.a + 90, SEG.aftermath.a + 420) * (1 - 0.45 * ph('aftermath', f))) : (S.id === 'thedrop' && f > burstF ? 0.7 : 0);
  return {
    shot: S.id,
    plane: planeAt(f), plane2: plane2At(f), bomb: bombAt(f), bomb2: bomb2At(f),
    cloud: cloudAt(f), cloud2: cloud2At(f),
    legacyCloud: S.id === 'legacy' ? { p: [LAYOUT.legacyCloud[0], 0, LAYOUT.legacyCloud[1]], s: 1 - 0.18 * u, a: 0.66 - 0.3 * u } : null,
    trinity: triAge >= 0 && S.id === 'manhattan' ? { fb: clamp(triAge / 110), ring: clamp(triAge / 160) } : null,
    city: {
      rings: burstAge >= 0 ? [clamp(burstAge / 130), clamp((burstAge - 42) / 175)] : [0, 0],
      fires: cityFires, dark: S.id === 'aftermath' ? 0.38 * smooth(ramp(f, SEG.aftermath.a + 60, SEG.aftermath.a + 500)) : 0,
      rain: S.id === 'aftermath' ? clamp(ramp(f, SEG.aftermath.a + Math.round(0.52 * SEG.aftermath.len), SEG.aftermath.a + Math.round(0.74 * SEG.aftermath.len))) * (1 - ph('aftermath', f) * 0.4) : 0,
    },
    city2: {
      rings: burst2Age >= 0 ? [clamp(burst2Age / 110)] : [0],
      fires: S.id === 'secondbomb' && burst2Age > 0 ? 0.55 * (1 - ph('secondbomb', f) * 0.3) : 0,
    },
    map: {
      hops: S.id === 'war1945' ? clamp(u * 8.6) : (S.id === 'hook' ? 0 : 8),
      kokura: S.id === 'secondbomb' ? smooth(ramp(f, SEG.secondbomb.a + 60, SEG.secondbomb.a + 260)) : 0,
      arrow: S.id === 'secondbomb' ? smooth(ramp(f, SEG.secondbomb.a + Math.round(0.30 * SEG.secondbomb.len), SEG.secondbomb.a + Math.round(0.48 * SEG.secondbomb.len))) : 0,
      flag: S.id === 'surrender' ? smooth(ramp(f, SEG.surrender.a + Math.round(0.30 * SEG.surrender.len), SEG.surrender.a + Math.round(0.55 * SEG.surrender.len))) : 0,
    },
    radio: { waves: S.id === 'surrender' ? clamp(ramp(f, SEG.surrender.a + Math.round(0.08 * SEG.surrender.len), SEG.surrender.a + Math.round(0.67 * SEG.surrender.len))) : 0 },
    witness: S.id === 'witness' ? {
      fire: 1 - 0.45 * u, // the Trinity column still stands, slowly dimming as they watch
      crack: smooth(ramp(f, SEG.witness.a + Math.round(0.42 * SEG.witness.len), SEG.witness.a + Math.round(0.58 * SEG.witness.len))),
    } : null,
    debate: S.id === 'debate' ? {
      radio: clamp(ramp(f, SEG.debate.a + Math.round(0.52 * SEG.debate.len), SEG.debate.a + Math.round(0.72 * SEG.debate.len))), // the Potsdam broadcast beat
    } : null,
    spared: S.id === 'spared' ? {
      leaflets: clamp(ramp(f, SEG.spared.a + Math.round(0.36 * SEG.spared.len), SEG.spared.a + Math.round(0.78 * SEG.spared.len))),
    } : null,
    sadako: S.id === 'sadako' ? { cranes: u } : null,
    boards: {
      title: S.id === 'hook' && u < 0.82,
      warover: S.id === 'war1945' && u > 0.55,
      oppenheimer: S.id === 'manhattan' && f > EV.triF + 130,
      twosuns: S.id === 'witness' && u > 0.22 && u < 0.58,
      miles120: S.id === 'witness' && u >= 0.58,
      demonstrate: S.id === 'debate' && u > 0.06 && u < 0.5,
      ultimatum: S.id === 'debate' && u >= 0.5,
      measurebomb: S.id === 'spared' && u > 0.74,
      sadako1: S.id === 'sadako' && u > 0.42 && u < 0.72,
      cranes1000: S.id === 'sadako' && u > 0.70 && u < 0.95,
      hiroshimaHi: (S.id === 'decision' && u > 0.45) || (S.id === 'verdict' && u > 0.35),
      littleboy: S.id === 'enolagay' && u > 0.04 && u < 0.5,
      clock245: S.id === 'enolagay' && u > 0.18 && u < 0.46,
      clock815: S.id === 'thedrop' && f > relF - 60 && f < burstF + 40,
      nagasaki: S.id === 'secondbomb' && u > 0.5 && u < 0.9,
      emperor: S.id === 'surrender' && u > 0.12 && u < 0.52,
      warend: S.id === 'surrender' && u > 0.55,
      neveragain: S.id === 'legacy' && u > 0.28,
    },
    sway: f, helmet: null,
  };
};

// ---------- actors (2D cards): a few human beats, kept minimal and respectful ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { day: '#ffffff', dawn: '#ffd9c4', desert: '#fff2dc', room: '#ffe6c4', night: '#aebfe8', smoke: '#e8c9a8', overcast: '#eef1f5', golden: '#ffe2c8' };
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  if (S.id === 'manhattan') {
    const after = f > EV.triF;
    out.push(R(T, 'officer44', { seed: 31, expr: after ? 'shock' : 'nervous', L: 'hang', R: 'hang', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3), tilt: 0, headTilt: -3 }, [267, 0, 7], { tint }));
    out.push(R(T, 'soldier44a', { seed: 33, expr: after ? 'dazed' : 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 33), bob: q(breath(f, 33), 3), tilt: 0, headTilt: 3 }, [270.5, 0, 8], { tint }));
  } else if (S.id === 'witness') {
    const sil = '#463830'; // dark against the fire column — they read as silhouettes
    out.push(R(T, 'officer44', { seed: 35, expr: 'shock', L: 'hang', R: 'up', blink: blinkAt(f, 35), bob: q(breath(f, 35), 3), tilt: 0, headTilt: -5 }, [262.5, 0, 20.5], { tint: sil }));
    out.push(R(T, 'soldier44a', { seed: 37, expr: 'dazed', L: 'hang', R: 'hang', blink: blinkAt(f, 37), bob: q(breath(f, 37), 3), tilt: 0, headTilt: 4 }, [265.5, 0, 17.5], { tint: sil }));
    out.push(R(T, 'officer44', { seed: 39, expr: 'nervous', L: 'belly', R: 'hang', blink: blinkAt(f, 39), bob: q(breath(f, 39), 3), tilt: 0, headTilt: -2 }, [268.5, 0, 21], { tint: sil }));
  } else if (S.id === 'decision' || S.id === 'verdict') {
    const u = ph(S.id, f);
    const pointing = S.id === 'verdict' ? (u > 0.3 && u < 0.8) : (u > 0.4 && u < 0.85);
    out.push(R(T, 'officer44', { seed: 41, expr: 'stern', L: 'belly', R: pointing ? 'point' : 'hang', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3), tilt: 0, headTilt: q(kf(K(S.id, [[0, 0], [0.4, -4], [1, -4]]), f), 1) }, [363, 0, -5], { tint }));
  } else if (S.id === 'debate') {
    const u = ph('debate', f);
    out.push(R(T, 'officer44', { seed: 51, expr: 'stern', L: 'belly', R: u > 0.5 ? 'point' : 'hang', blink: blinkAt(f, 51), bob: q(breath(f, 51), 3), tilt: 0, headTilt: -3 }, [363.2, 0, -5.6], { tint }));
    out.push(R(T, 'soldier44a', { seed: 53, expr: 'nervous', L: 'hang', R: 'hang', blink: blinkAt(f, 53), bob: q(breath(f, 53), 3), tilt: 0, headTilt: q(kf(K('debate', [[0, 2], [0.5, 2], [0.62, -5], [1, -5]]), f), 1) }, [366.2, 0, -5.8], { tint }));
    out.push(R(T, 'officer44', { seed: 55, expr: 'neutral', L: 'hang', R: 'belly', blink: blinkAt(f, 55), bob: q(breath(f, 55), 3), tilt: 0, headTilt: 3 }, [369.2, 0, -5.6], { tint }));
  } else if (S.id === 'spared') {
    if (ph('spared', f) > 0.66) { // the investigators arrive at the untouched grid's edge
      out.push(R(T, 'officer44', { seed: 61, expr: 'neutral', L: 'belly', R: 'hang', blink: blinkAt(f, 61), bob: q(breath(f, 61), 3), tilt: 0, headTilt: -3 }, [1120, 0, 12], { tint }));
      out.push(R(T, 'soldier44a', { seed: 63, expr: 'stern', L: 'hang', R: 'point', blink: blinkAt(f, 63), bob: q(breath(f, 63), 3), tilt: 0, headTilt: 2 }, [1124.5, 0, 9.5], { tint }));
    }
  } else if (S.id === 'enolagay') {
    const u = ph('enolagay', f);
    if (u < 0.34) out.push(R(T, 'soldier44a', { seed: 43, expr: 'smile', L: 'hang', R: 'up', blink: blinkAt(f, 43), bob: q(breath(f, 43), 3), tilt: 0, headTilt: 2 }, [439, 0, 13], { tint }));
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const glow = (tp, s, a) => out.push(FX('glow' + q(a, 2) + '_' + q(tp[0], 1), (p) => fxGlow(p, a), [tp[0], tp[1] - 0.81 * s, tp[2] + 0.12], s));
  if (S.id === 'manhattan' && f >= EV.triF && f < EV.triF + 130) { const t = (f - EV.triF) / 130; glow([LAYOUT.tower[0], 10, LAYOUT.tower[1]], 3.2, 0.3 * (1 - t)); }
  if (S.id === 'witness') glow([LAYOUT.tower[0], 11.5, LAYOUT.tower[1]], 3.4, 0.20 * (1 - 0.45 * ph('witness', f))); // the column the watchers cannot stop looking at
  if ((S.id === 'thedrop' || S.id === 'aftermath') && f >= burstF && f < burstF + 320) { const t = (f - burstF) / 320; glow([LAYOUT.burst[0], LAYOUT.burst[1], LAYOUT.burst[2]], 3.6, 0.26 * (1 - t)); }
  if (S.id === 'secondbomb' && f >= burst2F && f < burst2F + 240) { const t = (f - burst2F) / 240; glow([LAYOUT.burst2[0], LAYOUT.burst2[1], LAYOUT.burst2[2]], 2.8, 0.22 * (1 - t)); }
  const pl = planeAt(f);
  if (pl && (S.id === 'hook' || S.id === 'thedrop')) glow(pl.p, 1.7, 0.10 + 0.03 * Math.sin(f * 0.4)); // tracked hero plane gets the eye
  return out;
};
const fxGlow = (p, a) => {
  const g = p.g;
  const gr = g.createRadialGradient(300, 640, 12, 300, 640, 300);
  gr.addColorStop(0, `rgba(255,208,112,${a.toFixed(3)})`);
  gr.addColorStop(0.55, `rgba(255,182,84,${(a * 0.45).toFixed(3)})`);
  gr.addColorStop(1, 'rgba(255,182,84,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 600, 1000);
};
