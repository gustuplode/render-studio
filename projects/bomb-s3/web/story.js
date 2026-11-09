// "Why Did America Drop a SECOND Bomb?" — coded 9:16 Short in the house engine
// (engine copied from bomb-long1: fixed director blend, boardTex auto-shrink,
// uniform-scale cloud, B-29 + painted Pacific map with Kokura cloud blob and the
// turn-south arrow are reused from that build).
// This film lives on the MAP + the DECISION: strategy and weather pick the city.
// Respectful/abstract — no victims, no gore. The Nagasaki flash is a distant
// valley flash seen across a stylised valley set, then map-wide quiet.
//
// STRUCTURE RULE: every timing flows from the ONE TIMING table below. All tracks
// are built from shot fractions (u = 0..1 of the shot) via the K()/CK()/SP()
// helpers, so the parent patches TIMING when the real voice lands and the
// whole film re-times itself.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30;
// ---------- THE timing table: [sectionId, startFrame, endFrame] (estimated; ~51 s) ----------
export const TIMING = [
  ['hook', 0, 138],
  ['refusal', 138, 247],
  ['oneonly', 247, 349],
  ['bockscar', 349, 531],
  ['kokura', 531, 735],
  ['turn', 735, 830],
  ['drop', 830, 1308],
];
export const TOTAL = TIMING[TIMING.length - 1][2]; // 1530 frames = 51.0 s @ 30 fps
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
const LIGHT_OF = { hook: 'day', refusal: 'day', oneonly: 'day', bockscar: 'dawn', kokura: 'overcast', turn: 'overcast', drop: 'overcast' };
export const SHOTS = TIMING.map(([id, a, b]) => ({ id, a, b, light: LIGHT_OF[id] }));
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const ph = (id, f) => clamp((f - SEG[id].a) / SEG[id].len);
const smooth = M.smooth;
const K = (id, rows) => rows.map(([u, v, e, via]) => [Math.round(SEG[id].a + u * SEG[id].len), v, e, via]);
const CK = (id, rows) => rows.map(([u, pos, look, fov, ease, roll]) => ({ f: Math.round(SEG[id].a + u * SEG[id].len), pos, look, fov, ease, roll }));

// ---------- shared stage geometry (== main.js world build; long1 layout + Tokyo + council) ----------
export const LAYOUT = {
  sea0: [0, 0], mapC: [140, 5],
  hops: [[88, 28], [103, 20], [116, 13], [127, 6], [134, 0], [139, -6], [144, -12], [149, -18]],
  japan: [156, -27], hiroshimaM: [149, -24], kokuraM: [155, -30], nagasakiM: [143, -30], tokyoM: [168, -36],
  council: [188, -16],
  tower: [280, -10], lab: [280, -2],
  board: [370, -14],
  runway: [445, 6],
  cityC: [600, 0], burst: [603, 17, 1],
  nagaC: [740, 0], burst2: [743, 15, 2],
  radio: [840, 0], flag: [858, -6],
  legacySea: [960, 0], legacyCloud: [992, -46],
};

// ---------- lights (long1 set, verbatim) ----------
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
// BOCKSCAR: dawn take-off from the Tinian runway (the engine's proven Enola Gay
// framing from long1 — the runway reads east; the dip-cut to the map covers the rest)
const bockPath = (f) => kf3(K('bockscar', [
  [0, [445, 1.7, 6]], [0.22, [445, 1.7, 6]], [0.38, [478, 1.9, 4.5], 'easeIn'], [0.48, [506, 7, 1], 'easeInOut'], [0.68, [545, 27, -3], 'easeInOut'], [1, [578, 44, -3], 'easeInOut'],
]), f);
// KOKURA: descend onto a holding circle over the cloud blob — TWO full loops (the frustration beat)
const KC = LAYOUT.kokuraM, KR = 13, KALT = 8.6;
const circPt = (ang) => [KC[0] + KR * Math.cos(ang), KALT + 0.5 * Math.sin(ang * 2), KC[1] + KR * Math.sin(ang)];
const kokuraPath = (f) => {
  const u = ph('kokura', f);
  if (u < 0.10) return lerp3([206, 22, -26], circPt(-0.5), smooth(ramp(u, 0, 0.10)));
  if (u > 0.88) return lerp3(circPt(-0.5), [152, 9.2, -27], smooth(ramp(u, 0.88, 1)));
  return circPt(-0.5 + (u - 0.10) / 0.78 * Math.PI * 4);
};
// TURN: one last slow arc, then the dive SOUTH onto the Nagasaki marker, hover
const turnPath = (f) => kf3(K('turn', [
  [0, [152, 9.2, -27]], [0.22, [146, 8.8, -20.8]], [0.45, [142.5, 9.4, -25]], [0.7, [143.5, 9.8, -29.5]], [1, [144, 9.6, -29.5]],
]), f);
// DROP: high pass over the Nagasaki valley, exiting east; the bomb leaves at u=0.30
const dropPath = SP('drop', [[700, 34, -40], [722, 32, -20], [740, 30, -6], [758, 31, 4], [778, 34, 14], [798, 38, 24]]);
const mkState = (path, f, propsOn) => {
  const p = path(f);
  let p2 = path(f + 1.5), d = [p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]], sp = Math.hypot(...d);
  if (sp < 1e-4) { const p0 = path(f - 1.5); d = [p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]]; sp = Math.hypot(...d); }
  if (sp < 1e-4) { d = [1, 0, 0]; sp = 0; }
  return { p, d: d.map((v) => v / (sp || 1)), speed: sp / 1.5, props: propsOn ? (f * 1.9) % (Math.PI * 2) : 0 };
};
export const planeAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'bockscar') return mkState(bockPath, f, ph('bockscar', f) > 0.14);
  if (S.id === 'kokura') return mkState(kokuraPath, f, true);
  if (S.id === 'turn') return mkState(turnPath, f, true);
  if (S.id === 'drop') return ph('drop', f) < 0.52 ? mkState(dropPath, f, true) : null;
  return null;
};
export const plane2At = () => null;
// the falling bomb (tracked object): released over the valley, falls through the cloud gap
const relF = Math.round(SEG.drop.a + 0.30 * SEG.drop.len);   // 1369
const burstF = Math.round(SEG.drop.a + 0.52 * SEG.drop.len); // 1420
const JUMP = burstF + 28; // the cut back to the map hides inside the burst's white flash (~67% white); the gap lets the young cloud show through the wash first
const REL_P = dropPath(relF);
export const bombAt = (f) => {
  if (f < relF || f > burstF) return null;
  const u = (f - relF) / (burstF - relF);
  const p = lerp3(REL_P, LAYOUT.burst2, u * u * 0.85 + u * 0.15); // gravity: slow start, fast end
  return { p, d: [0.12, -1, 0.02] };
};
export const bomb2At = () => null;
// mushroom cloud: rise + grow with a UNIFORM scale (long1 cloudState, verbatim rule)
const cloudState = (f, f0, base, maxS, growF, a0) => {
  if (f < f0) return null;
  const u = clamp((f - f0) / growF);
  const e = M.easeOut(u);
  return { p: base, s: 4 + (maxS - 4) * e, a: a0 * (1 - 0.25 * clamp((f - f0 - growF) / 2200)) };
};
export const cloudAt = () => null;
export const cloud2At = (f) => (shotAt(f).id === 'drop' && f < JUMP) ? cloudState(f, burstF, [LAYOUT.burst2[0], 0, LAYOUT.burst2[2]], 17, 140, 0.95) : null;
// key event frames (exported for main.js shakes/glows + the sweep's jump exclusion)
export const EV = { relF, burstF, jumpF: JUMP };

// ---------- TRACKING DIRECTOR (long1 fixed blend, verbatim) ----------
const cloudTop = (c) => c ? [c.p[0], c.s * 0.55, c.p[2]] : [LAYOUT.burst2[0], 3, LAYOUT.burst2[2]]; // fallback ≈ the young cloud's top, so the pre-burst blend does not pre-aim
const TRACKDIR = {
  hook: [{ a: SEG.hook.a, b: SEG.hook.b, type: 'subject', id: 'hiroshima-marker', pos: () => [LAYOUT.hiroshimaM[0], 1.2, LAYOUT.hiroshimaM[1]], w: 0.6 }],
  refusal: [
    { a: SEG.refusal.a, b: SEG.refusal.a + Math.round(0.48 * SEG.refusal.len), type: 'subject', id: 'tokyo', pos: () => [LAYOUT.tokyoM[0], 1.2, LAYOUT.tokyoM[1]], w: 0.52 },
    { a: SEG.refusal.a + Math.round(0.48 * SEG.refusal.len), b: SEG.refusal.b, type: 'subject', id: 'council', pos: () => [LAYOUT.council[0], 1.8, LAYOUT.council[1]], w: 0.64 },
  ],
  oneonly: [{ a: SEG.oneonly.a, b: SEG.oneonly.b, type: 'subject', id: 'map-question', pos: () => [149, 2, -27], w: 0.55 }],
  bockscar: [{ a: SEG.bockscar.a, b: SEG.bockscar.b, type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || [445, 2, 6], w: 0.66 }],
  kokura: [{ a: SEG.kokura.a, b: SEG.kokura.b, type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || circPt(-0.5), w: 0.7 }],
  turn: [
    { a: SEG.turn.a, b: SEG.turn.a + Math.round(0.55 * SEG.turn.len), type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || [146, 9, -24], w: 0.6 },
    { a: SEG.turn.a + Math.round(0.55 * SEG.turn.len), b: SEG.turn.b, type: 'subject', id: 'nagasaki-marker', pos: () => [LAYOUT.nagasakiM[0], 1.2, LAYOUT.nagasakiM[1]], w: 0.6 },
  ],
  drop: [
    { a: SEG.drop.a, b: relF, type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || [740, 30, -6], w: 0.6 },
    { a: relF, b: burstF, type: 'object', id: 'bomb', pos: (f) => { const b = (bombAt(f) || {}).p || REL_P; return [b[0], b[1] - 6, b[2]]; }, w: 0.78 }, // aim 6 m UNDER the bomb: it rides upper-frame and the valley stays in view below; fallback = release point, so the handoff cannot snap
    { a: burstF, b: JUMP, type: 'object', id: 'cloud2', pos: (f) => cloudTop(cloud2At(f)), w: 0.62 },
    { a: JUMP, b: SEG.drop.b, type: 'subject', id: 'tokyo-quiet', pos: () => [LAYOUT.tokyoM[0], 1.2, LAYOUT.tokyoM[1]], w: 0.55 },
  ],
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
    [0, [133, 15, 0], [149, 1, -24], 41], [0.45, [138, 20, 12], [149, 0.5, -24], 42, 'easeInOut'], [1, [140, 46, 44], [146, 0, -22], 44],
  ]),
  refusal: CK('refusal', [
    [0, [156, 17, 10], [168, 1, -33], 44], [0.48, [170, 8, 2], [178, 1.5, -24], 43, 'easeInOut'], [1, [179.5, 3.2, 0.5], [188, 1.8, -17.8], 42],
  ]),
  oneonly: CK('oneonly', [
    [0, [128, 32, 28], [146, 1, -24], 44], [0.55, [136, 26, 20], [148, 2, -26], 43, 'surge'], [1, [141, 22, 15], [150, 2, -27], 42],
  ]),
  bockscar: CK('bockscar', [
    [0, [424, 5, 30], [445, 3, 6], 43], [0.3, [434, 5.5, 27], [455, 3, 5], 42, 'surge'], [0.62, [488, 11, 21], [524, 17, -2], 42, 'easeInOut'], [1, [522, 21, 17], [568, 40, -3], 41],
  ]),
  kokura: CK('kokura', [
    [0, [149, 56, 32], [153, 0, -29], 45], [0.3, [147, 46, 26], [155, 2, -30], 44, 'easeInOut'], [0.78, [149, 42, 24], [155, 2, -30], 44], [1, [146, 36, 20], [150, 3, -28], 43],
  ]),
  turn: CK('turn', [
    [0, [138, 44, 40], [150, 0, -28], 45], [0.5, [140, 36, 30], [146, 1, -29], 44, 'easeInOut'], [1, [141, 26, 16], [143, 1, -30], 43],
  ]),
  // drop has TWO key sets: the valley (before the flash) and the quiet map (after it)
  dropA: CK('drop', [
    [0, [698, 30, 52], [740, 12, -2], 43], [0.35, [708, 24, 40], [743, 12, 0], 42, 'easeInOut'], [1, [714, 24, 40], [743, 14, 2], 42],
  ]),
  dropB: CK('drop', [
    [0, [143, 40, 34], [150, 0, -27], 44], [1, [144, 30, 21], [150, 0, -28], 43],
  ]),
};
const SHADOW_AT = { hook: [149, 0, -24], refusal: [172, 0, -24], oneonly: [147, 0, -24], bockscar: [470, 2, 4], kokura: [155, 0, -30], turn: [149, 0, -28] };
const flashPulse = (f, f0, peak, hold, decay) => {
  const d = f - f0; if (d < 0 || d > hold + decay) return 0;
  return d <= hold ? peak : peak * (1 - (d - hold) / decay);
};
const SHAKES = [{ f: burstF + 1, a: 0.006 }];
const SHAKE_SHAPE = [1, -0.62, 0.3, -0.12];
const DIPS = TIMING.slice(1).map(([, a]) => a);
export const camAt = (f) => {
  const S = shotAt(f);
  let c;
  if (S.id === 'drop') c = camFromKeys(f < JUMP ? CAMS.dropA : CAMS.dropB, f, {});
  else c = camFromKeys(CAMS[S.id], f, {});
  const D = dirFor(S.id, f);
  c = { ...c, look: lerp3(c.look, D.point, D.w) };
  if (S.id === 'kokura') { // RIDE CAMERA: swing out beside the circling plane, then back wide
    const u = ph('kokura', f);
    const wRide = smooth(ramp(u, 0.33, 0.48)) * (1 - smooth(ramp(u, 0.62, 0.77)));
    if (wRide > 0.001) {
      const pl = planeAt(f);
      if (pl) {
        const hd = Math.atan2(pl.d[2], pl.d[0]);
        const back = [-Math.cos(hd), -Math.sin(hd)], side = [-Math.sin(hd), Math.cos(hd)];
        const rp = [pl.p[0] + back[0] * 11 + side[0] * 6.5, pl.p[1] + 3.5, pl.p[2] + back[1] * 11 + side[1] * 6.5];
        const rl = [pl.p[0] + pl.d[0] * 4, pl.p[1] - 0.3, pl.p[2] + pl.d[2] * 4];
        c.pos = lerp3(c.pos, rp, wRide); c.look = lerp3(c.look, rl, wRide); c.fov = lerp(c.fov, 40, wRide);
      }
    }
  }
  for (const s of SHAKES) {
    const d = f - s.f;
    if (d >= 0 && d < 4) { const m = s.a * SHAKE_SHAPE[d]; c.pos = [c.pos[0] + m * 0.5, c.pos[1] + m, c.pos[2]]; c.look = [c.look[0] + m * 0.8, c.look[1] + m * 1.4, c.look[2]]; }
  }
  let flash = 0;
  if (f < 9) flash = -0.95 * (1 - f / 9);
  for (const B of DIPS) { const d = f - B; if (d >= -3 && d <= 3) flash = Math.min(flash, -0.95 * Math.cos(d / 3 * Math.PI / 2)); }
  flash = Math.max(flash, flashPulse(f, burstF, 1.0, 10, 55)); // long white tail: hides the map cut at JUMP
  c.flash = flash;
  c.shadowAt = S.id === 'drop' ? (f < JUMP ? [742, 8, 0] : [149, 0, -24]) : SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CINF = { hook: 5, refusal: 5, oneonly: 6, bockscar: 6, kokura: 6, turn: 6, drop: 6 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  return { focus: dist(C.pos, dirAt(f).point), cinf: CINF[S.id] ?? 5 };
};

// ---------- world state (drives the 3D hardware in main.js) ----------
export const worldAt = (f) => {
  const S = shotAt(f), u = ph(S.id, f);
  const burstAge = f - burstF;
  const inDropValley = S.id === 'drop' && f < JUMP;
  const hookPulse = S.id === 'hook' ? (u * 2) % 1 : 0; // two fading flash-ring pulses over Hiroshima
  const bomberLit = f >= SEG.oneonly.a + Math.round(0.45 * SEG.oneonly.len)
    ? smooth(ramp(f, SEG.oneonly.a + Math.round(0.45 * SEG.oneonly.len), SEG.oneonly.a + Math.round(0.62 * SEG.oneonly.len))) : 0;
  const nagaPart = S.id === 'turn' ? smooth(ramp(u, 0.55, 0.95)) : S.id === 'drop' ? smooth(ramp(u, 0.02, 0.28)) : 0;
  return {
    shot: S.id,
    plane: planeAt(f), plane2: plane2At(f), bomb: bombAt(f), bomb2: bomb2At(f),
    cloud: cloudAt(f), cloud2: cloud2At(f),
    legacyCloud: null,
    trinity: null,
    city: { rings: [0, 0], fires: 0, dark: 0, rain: 0 },
    city2: {
      rings: inDropValley && burstAge >= 0 ? [clamp(burstAge / 110)] : [0],
      fires: inDropValley && burstAge > 0 ? 0.5 : 0,
    },
    map: {
      hops: 8, // the island chain is fully lit by August 1945
      kokura: S.id === 'kokura' || S.id === 'turn' ? smooth(ramp(f, SEG.kokura.a + 20, SEG.kokura.a + 120)) : 0,
      arrow: f >= SEG.turn.a + Math.round(0.18 * SEG.turn.len) ? smooth(ramp(f, SEG.turn.a + Math.round(0.18 * SEG.turn.len), SEG.turn.a + Math.round(0.50 * SEG.turn.len))) : 0,
      flag: f >= JUMP + 30 ? smooth(ramp(f, JUMP + 30, JUMP + 72)) : 0,
      hiroRing: hookPulse,
      bomber2: bomberLit,
      nagaPart,
    },
    radio: { waves: 0 },
    boards: {
      bombOne: S.id === 'hook' && u < 0.85,
      refusal: S.id === 'refusal',
      onlyOne: S.id === 'oneonly' && u > 0.06,
      onlyQ: S.id === 'oneonly' && u > 0.30,
      bockscar: S.id === 'bockscar' && u > 0.03 && u < 0.55,
      fatman: S.id === 'bockscar' && u > 0.10 && u < 0.60,
      fuelFull: S.id === 'kokura' && u < 0.40,
      fuelMid: S.id === 'kokura' && u >= 0.40 && u < 0.72,
      fuelLow: (S.id === 'kokura' && u >= 0.72) || (S.id === 'turn' && u < 0.25),
      nagasaki: inDropValley,
      clock1102: S.id === 'drop' && f > relF - 50 && f < JUMP,
      surrender6: S.id === 'drop' && f > JUMP + 18,
    },
    sway: f, helmet: null,
  };
};

// ---------- actors (2D cards): the council at their table; one crewman at the runway ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { day: '#ffffff', dawn: '#ffd9c4', overcast: '#eef1f5' };
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'refusal') {
    const u = ph('refusal', f), tint = '#a79c8d'; // dimmed: silhouettes around the council table
    const cz = LAYOUT.council[1] - 2.9; // just behind the table (north side); the low camera + tabletop crop them seated
    out.push(R(T, 'officer44', { seed: 51, expr: 'stern', L: 'hang', R: 'hang', blink: blinkAt(f, 51), bob: q(breath(f, 51), 3), tilt: 0, headTilt: -3 }, [LAYOUT.council[0] - 3.4, 0, cz], { tint, s: 1.15 }));
    out.push(R(T, 'officer44', { seed: 53, expr: 'neutral', L: 'belly', R: u > 0.35 && u < 0.75 ? 'point' : 'hang', blink: blinkAt(f, 53), bob: q(breath(f, 53), 3), tilt: 0, headTilt: 2 }, [LAYOUT.council[0], 0, cz], { tint, s: 1.15 }));
    out.push(R(T, 'soldier44b', { seed: 57, expr: 'nervous', L: 'hang', R: 'hang', blink: blinkAt(f, 57), bob: q(breath(f, 57), 3), tilt: 0, headTilt: 4 }, [LAYOUT.council[0] + 3.4, 0, cz], { tint, s: 1.15 }));
  } else if (S.id === 'bockscar') {
    const u = ph('bockscar', f);
    if (u < 0.30) out.push(R(T, 'soldier44a', { seed: 43, expr: 'smile', L: 'hang', R: 'up', blink: blinkAt(f, 43), bob: q(breath(f, 43), 3), tilt: 0, headTilt: 2 }, [439, 0, 13], { tint: TINT[S.light] || '#ffffff' }));
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const glow = (tp, s, a) => out.push(FX('glow' + q(a, 2) + '_' + q(tp[0], 1), (p) => fxGlow(p, a), [tp[0], tp[1] - 0.81 * s, tp[2] + 0.12], s));
  if (S.id === 'drop' && f >= burstF && f < JUMP) { const t = (f - burstF) / Math.max(1, JUMP - burstF); glow([LAYOUT.burst2[0], LAYOUT.burst2[1], LAYOUT.burst2[2]], 3.4, 0.3 * (1 - t)); }
  const pl = planeAt(f);
  if (pl && (S.id === 'bockscar' || S.id === 'kokura' || S.id === 'turn' || S.id === 'drop')) glow(pl.p, 1.7, 0.10 + 0.03 * Math.sin(f * 0.4)); // tracked hero plane gets the eye
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
