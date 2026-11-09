// "Enola Gay — The Plane That Dropped the Bomb" — coded 9:16 Short, plane-focused.
// The mission as machines and sky. The blast is a distant flash + cloud seen from the
// escaping plane; the city is only a far-below grid. NO victims, NO gore.
// STRUCTURE RULE: every timing flows from the ONE TIMING table below. All tracks are
// built from shot fractions (u = 0..1 of the shot) via K()/CK()/SP(), so the parent
// patches TIMING when the real voice lands and the whole film re-times itself.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3, spline } from './motion.js';

export const FPS = 30;
// ---------- THE timing table: [sectionId, startFrame, endFrame] (estimated; ~49 s) ----------
export const TIMING = [
  ['hook', 0, 51],
  ['name', 51, 160],
  ['takeoff', 160, 442],
  ['load', 442, 610],
  ['flight', 610, 679],
  ['drop', 679, 879],
  ['escape', 879, 1285],
];
export const TOTAL = TIMING[TIMING.length - 1][2]; // 1470 frames = 49 s @ 30 fps
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
const LIGHT_OF = { hook: 'night', name: 'night', takeoff: 'night', load: 'room', flight: 'dawn', drop: 'day', escape: 'dawn' };
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
  runway: [445, 6], park: [452, 1.7, 6],
  bay: [520, 1.6, 44],
  cityC: [600, 0], burst: [603, 17, 1],
  nagaC: [740, 0], burst2: [743, 15, 2],
  radio: [840, 0], flag: [858, -6],
  legacySea: [960, 0], legacyCloud: [992, -46],
  finalBoard: [762, 39, 47],
};

// ---------- lights ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 320,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 22, ...WATER },
  dawn: { az: 95, el: 12, sky: '#d9b8a8', ground: '#5c5648', hemi: 1.05, sun: '#ffb46c', sunI: 2.6, fog: '#e8c4a8', fogNear: 40, fogFar: 300,
    skyTop: '#5a6ea8', skyHor: '#ffc9a0', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.08, gain: '#fff2e2', vig: 0.26, shadowExt: 22, waterDeep: '#2c4c6c', waterShal: '#7a90b4', glint: '#ffe9c0' },
  room: { az: 60, el: 30, sky: '#8a7a66', ground: '#4c4438', hemi: 0.9, sun: '#ffd9a0', sunI: 1.7, fog: '#6a5c4a', fogNear: 26, fogFar: 150,
    skyTop: '#4a4238', skyHor: '#8a7a66', sat: 1.0, vig: 0.34, shadowExt: 14, ...WATER },
  night: { az: 220, el: 34, sky: '#33456b', ground: '#1c1a20', hemi: 0.95, sun: '#aebfff', sunI: 1.2, fog: '#232c40', fogNear: 16, fogFar: 190,
    skyTop: '#101a2e', skyHor: '#2c3a55', sat: 1.03, vig: 0.3, shadowExt: 16, waterDeep: '#16283c', waterShal: '#2c445c', glint: '#cfe0ff' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- hero object tracks (single source: actors, camera, world all read these) ----------
const cruise = (u) => u < 0.12 ? M.surge(u / 0.12) * 0.12 : u > 0.88 ? 0.88 + M.surge((u - 0.88) / 0.12) * 0.12 : u;
const SP = (id, pts) => (f) => spline(pts, cruise(ph(id, f)));
const takeoffPath = (f) => kf3(K('takeoff', [
  [0, [428, 1.7, 6]], [0.16, [428, 1.7, 6]], [0.42, [466, 1.8, 6], 'easeIn'], [0.60, [496, 3.5, 5.5], 'easeInOut'], [0.80, [528, 15, 3], 'easeInOut'], [1, [562, 33, -1], 'easeInOut'],
]), f);
const flightPath = SP('flight', [[-38, 17, -26], [-8, 18, -18], [24, 17.5, -10], [56, 18, -3]]);
const dropPath = SP('drop', [[548, 46, -4], [578, 47, -1], [605, 46, 2], [634, 44, 8], [666, 40, 16]]);
const escapePath = SP('escape', [[666, 40, 16], [704, 42, 24], [746, 46, 30], [790, 51, 35]]);
const mkState = (path, f, propsOn) => {
  const p = path(f);
  let p2 = path(f + 1.5), d = [p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]], sp = Math.hypot(...d);
  if (sp < 1e-4) { const p0 = path(f - 1.5); d = [p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]]; sp = Math.hypot(...d); }
  if (sp < 1e-4) { d = [1, 0, 0]; sp = 0; }
  return { p, d: d.map((v) => v / (sp || 1)), speed: sp / 1.5, props: propsOn ? (f * 1.9) % (Math.PI * 2) : 0 };
};
export const planeAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'hook' || S.id === 'name') return { p: [...LAYOUT.park], d: [1, 0, 0], speed: 0, props: (f * 0.45) % (Math.PI * 2) }; // parked, props idling
  if (S.id === 'takeoff') return mkState(takeoffPath, f, ph('takeoff', f) > 0.05);
  if (S.id === 'flight') return mkState(flightPath, f, true);
  if (S.id === 'drop') return mkState(dropPath, f, true);
  if (S.id === 'escape') return mkState(escapePath, f, true);
  return null;
};
export const plane2At = () => null;
// the falling bomb (tracked object)
const relF = Math.round(SEG.drop.a + 0.32 * SEG.drop.len), burstF = relF + 86;
const REL_P = dropPath(relF);
export const bombAt = (f) => {
  if (f < relF || f > burstF) return null;
  const u = (f - relF) / (burstF - relF);
  const p = lerp3(REL_P, LAYOUT.burst, u * u * 0.85 + u * 0.15); // gravity: slow start, fast end
  return { p, d: [0.1, -1, 0.02] };
};
export const bomb2At = () => null;
// mushroom cloud: rise + grow, uniform scale only (unit cloud in main.js)
const cloudState = (f, f0, base, maxS, growF, a0) => {
  if (f < f0) return null;
  const u = clamp((f - f0) / growF);
  const e = M.easeOut(u);
  return { p: base, s: 4 + (maxS - 4) * e, a: a0 * (1 - 0.25 * clamp((f - f0 - growF) / 2200)) };
};
export const cloudAt = (f) => { const id = shotAt(f).id; return (id === 'drop' || id === 'escape') ? cloudState(f, burstF, [LAYOUT.burst[0], 0, LAYOUT.burst[2]], 27, 520, 1) : null; };
export const cloud2At = () => null;
// key event frames
export const EV = { relF, burstF, bump1: burstF + 95, bump2: burstF + 185 };

// ---------- TRACKING DIRECTOR ----------
const cloudTop = (c) => c ? [c.p[0], c.s * 0.55, c.p[2]] : [LAYOUT.burst[0], 17, LAYOUT.burst[2]];
const TRACKDIR = {
  hook: [{ a: SEG.hook.a, b: SEG.hook.b, type: 'object', id: 'plane', pos: () => [...LAYOUT.park], w: 0.55 }],
  name: [{ a: SEG.name.a, b: SEG.name.b, type: 'subject', id: 'noseboards', pos: () => [456, 2.6, 13], w: 0.6 }],
  takeoff: [{ a: SEG.takeoff.a, b: SEG.takeoff.b, type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || [445, 2, 6], w: 0.68 }],
  load: [{ a: SEG.load.a, b: SEG.load.b, type: 'subject', id: 'baybomb', pos: () => [...LAYOUT.bay], w: 0.7 }],
  flight: [{ a: SEG.flight.a, b: SEG.flight.b, type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || [0, 17, -12], w: 0.55 }],
  drop: [
    { a: SEG.drop.a, b: relF, type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || [578, 47, -1], w: 0.6 },
    { a: relF, b: burstF, type: 'object', id: 'bomb', pos: (f) => (bombAt(f) || {}).p || LAYOUT.burst, w: 0.8 },
    { a: burstF, b: SEG.drop.b, type: 'object', id: 'cloud', pos: (f) => cloudTop(cloudAt(f)), w: 0.6 },
  ],
  escape: [
    { a: SEG.escape.a, b: SEG.escape.a + Math.round(0.55 * SEG.escape.len), type: 'object', id: 'plane', pos: (f) => (planeAt(f) || {}).p || [700, 43, 24], w: 0.6 },
    { a: SEG.escape.a + Math.round(0.55 * SEG.escape.len), b: SEG.escape.b, type: 'subject', id: 'finalboard', pos: () => [...LAYOUT.finalBoard], w: 0.45 },
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
    [0, [465, 3.0, 13], [459, 2.0, 6], 40], [0.55, [455, 2.7, 13.4], [450, 1.9, 6], 40, 'easeInOut'], [1, [447, 3.2, 13.8], [445, 2.1, 6], 39],
  ]),
  name: CK('name', [
    [0, [463, 3.2, 30], [456, 2.2, 10], 41], [1, [460, 2.8, 29.5], [454, 2.0, 9], 40, 'easeInOut'],
  ]),
  takeoff: CK('takeoff', [
    [0, [410, 3.6, 22], [430, 1.8, 6], 42], [0.42, [448, 4.0, 21.5], [470, 2, 5.5], 41, 'easeInOut'], [0.75, [492, 9, 17], [522, 9, 2], 41, 'easeInOut'], [1, [524, 17, 14], [556, 28, -1], 40],
  ]),
  load: CK('load', [
    [0, [520, 3.0, 58.5], [520, 2.0, 44], 42], [1, [520, 2.4, 53], [520, 1.8, 43.5], 40, 'surge'],
  ]),
  flight: CK('flight', [
    [0, [-40, 19, -9], [-30, 17, -24], 42], [0.5, [14, 19.5, 4], [16, 17.5, -11], 41, 'easeInOut'], [1, [58, 19.5, 13], [58, 18, -3], 40],
  ]),
  drop: CK('drop', [
    [0, [552, 43, 34], [560, 46, -2], 42], [0.35, [572, 39, 32], [584, 46, 0], 41, 'easeInOut'], [0.62, [582, 33, 32], [603, 26, 1], 40, 'easeInOut'], [1, [598, 35, 38], [636, 42, 9], 41],
  ]),
  escape: CK('escape', [
    [0, [700, 44, 38], [664, 40, 14], 42], [0.5, [742, 47, 44], [706, 43, 24], 41, 'easeInOut'], [1, [716, 49, 62], [766, 40, 46], 40, 'easeInOut'],
  ]),
};
const SHADOW_AT = { hook: [452, 0, 6], name: [452, 0, 6], takeoff: [480, 0, 4], load: [520, 2, 44], flight: [10, 10, -12], drop: [603, 10, 0], escape: [700, 20, 20] };
const flashPulse = (f, f0, peak, hold, decay) => {
  const d = f - f0; if (d < 0 || d > hold + decay) return 0;
  return d <= hold ? peak : peak * (1 - (d - hold) / decay);
};
const SHAKES = [{ f: EV.bump1, a: 0.005 }, { f: EV.bump2, a: 0.0035 }]; // the two distant shockwave bumps
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
  flash = Math.max(flash, flashPulse(f, burstF, 0.6, 5, 42)); // the distant flash, seen from the escaping plane
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CINF = { hook: 4, name: 4, takeoff: 6, load: 3, flight: 6, drop: 5, escape: 6 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  return { focus: dist(C.pos, dirAt(f).point), cinf: CINF[S.id] ?? 5 };
};

// ---------- world state (drives the 3D hardware in main.js) ----------
export const worldAt = (f) => {
  const S = shotAt(f), u = ph(S.id, f);
  const burstAge = f - burstF;
  return {
    shot: S.id,
    plane: planeAt(f), plane2: null, bomb: bombAt(f), bomb2: null,
    cloud: cloudAt(f), cloud2: null,
    legacyCloud: null,
    trinity: null,
    city: {
      rings: burstAge >= 0 ? [clamp(burstAge / 120), clamp((burstAge - 40) / 160)] : [0, 0],
      fires: S.id === 'escape' ? 0.35 * (1 - u * 0.5) : 0, dark: 0, rain: 0,
    },
    city2: { rings: [0], fires: 0 },
    map: { hops: 0, kokura: 0, arrow: 0, flag: 0 },
    radio: { waves: 0 },
    boards: {
      enolagay: (S.id === 'hook' && u > 0.06) || S.id === 'name',
      tibbets: S.id === 'name' && u > 0.15,
      littleboy: S.id === 'name' && u < 0.6,
      clock245: S.id === 'takeoff' && u < 0.4,
      tnt: S.id === 'load',
      clock815: S.id === 'drop' && f > relF - 50 && f < burstF + 30,
      neversame: S.id === 'escape' && u > 0.5,
    },
    sway: f, helmet: null,
  };
};

// ---------- actors (2D cards): the crew by the nose, kept minimal ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { day: '#ffffff', dawn: '#ffd9c4', room: '#ffe6c4', night: '#aebfe8' };
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  if (S.id === 'name') {
    out.push(R(T, 'soldier44a', { seed: 51, expr: 'smile', L: 'hang', R: 'up', blink: blinkAt(f, 51), bob: q(breath(f, 51), 3), tilt: 0, headTilt: 2 }, [447, 0, 17.2], { tint }));
    out.push(R(T, 'soldier44b', { seed: 53, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 53), bob: q(breath(f, 53), 3), tilt: 0, headTilt: -2 }, [451.5, 0, 18], { tint }));
    out.push(R(T, 'officer44', { seed: 57, expr: 'stern', L: 'belly', R: 'hang', blink: blinkAt(f, 57), bob: q(breath(f, 57), 3), tilt: 0, headTilt: 3 }, [456, 0, 17.2], { tint }));
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const glow = (tp, s, a) => out.push(FX('glow' + q(a, 2) + '_' + q(tp[0], 1), (p) => fxGlow(p, a), [tp[0], tp[1] - 0.81 * s, tp[2] + 0.12], s));
  const pl = planeAt(f);
  if (pl && (S.id === 'hook' || S.id === 'name' || S.id === 'flight')) glow(pl.p, 1.7, 0.10 + 0.03 * Math.sin(f * 0.4)); // tracked hero plane gets the eye
  if (S.id === 'escape' && f >= burstF && f < burstF + 260) { const t = (f - burstF) / 260; glow([LAYOUT.burst[0], LAYOUT.burst[1], LAYOUT.burst[2]], 3.4, 0.24 * (1 - t)); }
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
