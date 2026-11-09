// "The Morning Hiroshima Changed Forever" — coded 9:16 Short. Respectful, abstract:
// a quiet stylised city at dawn, one plane high above, a tracked falling dot, a flash,
// a fireball and mushroom cloud, a shockwave ring — then a still, empty dawn city.
// No victims, no gore. Machines, sky, light and silence carry the story.
//
// STRUCTURE RULE: every timing flows from the ONE TIMING table below (shot fractions
// via the K()/CK() helpers). The parent patches TIMING when the real voice lands.
import { M, camFromKeys, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30;
// ---------- THE timing table: [shotId, startFrame, endFrame] ----------
export const TIMING = [
  ["hook",    0,    132 ],
  ["morning", 132,  226 ],
  ["plane",   226,  368 ],
  ["flash",   368,  570 ],
  ["shock",   570,  758 ],
  ["still",   758,  1096],
];
export const TOTAL = TIMING[TIMING.length - 1][2]; // 1440 frames = 48.0 s @ 30 fps
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
const LIGHT_OF = { hook: 'dawn', morning: 'morning', plane: 'morning', flash: 'bright', shock: 'ash', still: 'ashdawn' };
export const SHOTS = TIMING.map(([id, a, b]) => ({ id, a, b, light: LIGHT_OF[id] }));
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const ph = (id, f) => clamp((f - SEG[id].a) / SEG[id].len);   // phase 0..1 inside a shot
const smooth = M.smooth;
const K = (id, rows) => rows.map(([u, v, e, via]) => [Math.round(SEG[id].a + u * SEG[id].len), v, e, via]);
const CK = (id, rows) => rows.map(([u, pos, look, fov, ease, roll]) => ({ f: Math.round(SEG[id].a + u * SEG[id].len), pos, look, fov, ease, roll }));

// ---------- lights: dawn gold -> morning -> white-bright -> ash grey -> pale quiet dawn ----------
const WATER = { waterDeep: '#2c5a78', waterShal: '#7ab0c4', glint: '#ffe9c4' };
export const LIGHTS = {
  dawn: { az: 105, el: 7, sky: '#e8b9a0', ground: '#6b6258', hemi: 0.95, sun: '#ffd9a8', sunI: 2.2, fog: '#eecdb4', fogNear: 55, fogFar: 330,
    skyTop: '#7683b4', skyHor: '#f6c9a0', sunDisc: '#ffe9c0', sunSize: 0.004, sat: 1.06, gain: '#fff4e4', vig: 0.24, shadowExt: 36, ...WATER },
  morning: { az: 112, el: 17, sky: '#cfe0f2', ground: '#77705f', hemi: 1.1, sun: '#ffe9c4', sunI: 2.6, fog: '#d8e4ee', fogNear: 65, fogFar: 400,
    skyTop: '#4a86d8', skyHor: '#ffe0b8', sunDisc: '#fff3d0', sunSize: 0.0035, sat: 1.08, vig: 0.21, shadowExt: 36, ...WATER },
  bright: { az: 120, el: 42, sky: '#eef0f2', ground: '#8a8478', hemi: 1.25, sun: '#ffffff', sunI: 3.3, fog: '#e8e4da', fogNear: 45, fogFar: 320,
    skyTop: '#93a9cc', skyHor: '#f4ecd9', sunDisc: '#ffffff', sunSize: 0.006, sat: 1.02, vig: 0.2, shadowExt: 36, ...WATER },
  ash: { az: 118, el: 24, sky: '#9a938c', ground: '#4c463f', hemi: 0.9, sun: '#d8cbb2', sunI: 1.35, fog: '#8f887e', fogNear: 22, fogFar: 200,
    skyTop: '#5c564e', skyHor: '#b0a696', sat: 0.8, vig: 0.33, shadowExt: 36, waterDeep: '#3c4a52', waterShal: '#5c6a70', glint: '#cfc4ae' },
  ashdawn: { az: 106, el: 10, sky: '#cbb9a4', ground: '#5d564c', hemi: 0.95, sun: '#ffdcb0', sunI: 1.9, fog: '#cdbfae', fogNear: 40, fogFar: 300,
    skyTop: '#6a7488', skyHor: '#ecd2ac', sunDisc: '#ffe9c0', sunSize: 0.0035, sat: 0.94, vig: 0.27, shadowExt: 36, waterDeep: '#44545e', waterShal: '#6d7f88', glint: '#e8d9bc' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- shared stage geometry (== main.js world build) ----------
export const CENTRE = [0, 0, -2];            // city centre, under the burst
export const BURST = [0, 15, -2];             // the flash point in the air
export const CLOCK_POS = [7.5, 3.1, 12];      // "8:15" board
export const DATE_POS = [-8.0, 4.2, 13];      // "AUGUST 6, 1945" board (west bank, faces the still camera)
export const CHANGED_POS = [-15.5, 3.4, -4];  // "ONE MORNING CHANGED THE WORLD" board

// ---------- the plane: one high pass over the city, crossing the centre at release ----------
const PLANE_KEYS = [[0, [-27, 46, -15]], [300, [-10, 47, -9]], [528, [2, 47, -3]], [660, [17, 48, 1]], [780, [34, 49, 6]]];
export const planeAt = (f) => {
  if (f > 780) return null;
  const p = kf3(PLANE_KEYS, f);
  const p2 = kf3(PLANE_KEYS, Math.min(780, f + 2));
  const d = [p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]]; const sp = Math.hypot(...d) || 1;
  return { p, d: d.map((v) => v / sp) };
};
// ---------- the bomb: released at f=528, falls to the burst point at f=660 ----------
const REL_F = 528;
const BOMB_KEYS = [[REL_F, [2, 46.4, -3]], [585, [1.5, 36, -2.7], 'easeIn'], [625, [0.7, 25, -2.3], 'easeIn'], [660, BURST, 'easeIn']];
export const bombAt = (f) => (f >= REL_F && f < SEG.flash.a) ? { p: kf3(BOMB_KEYS, f) } : null;

// ---------- fireball + mushroom cloud growth (one global curve, read by camera + world) ----------
const cloudT = (f) => ramp(f, SEG.flash.a + 10, SEG.shock.b - 60); // 0 before the flash -> 1 late shock
const cloudAt = (f) => {
  if (f < SEG.flash.a) return null;
  const t = cloudT(f), e = M.easeOut(t);
  return {
    stemH: 16.5 + e * 15.5, stemR: 1.1 + e * 2.0,
    capY: 13.5 + e * 15.5, capR: 2.2 + e * 6.6, capFlat: 0.62 - e * 0.10,
    colT: clamp(t * 1.15),                                   // 0 = hot orange-grey -> 1 = ash grey
    drift: t * 3.2,                                          // slow eastward drift of the cap
    a: f > SEG.still.b - 30 ? Math.max(0.85, 1 - (f - (SEG.still.b - 30)) / 60) : 1,
  };
};
const fireballAt = (f) => {
  if (f < SEG.flash.a || f > SEG.flash.a + 110) return null;
  const u = (f - SEG.flash.a) / 110;
  const s = u < 0.22 ? lerp(1.5, 8.5, M.easeOut(u / 0.22)) : lerp(8.5, 5.5, (u - 0.22) / 0.78);
  return { p: [BURST[0], BURST[1] + u * 0.6, BURST[2]], s, a: u < 0.22 ? 1 : 1 - (u - 0.22) / 0.78 * 0.85 };
};
// ---------- shockwave rings over the grid ----------
const ringAt = (f) => {
  if (f < SEG.shock.a) return null;
  const u = ph('shock', f);
  const rings = [];
  for (const [delay, maxR, a0] of [[0, 58, 0.85], [0.16, 44, 0.55]]) {
    const t = clamp((u - delay) / 0.62); if (t <= 0 || t >= 1) continue;
    rings.push({ r: 2 + M.easeOut(t) * maxR, a: a0 * (1 - t) * (t < 0.06 ? t / 0.06 : 1), dust: t });
  }
  return rings.length ? rings : null;
};
// ---------- fires: orange points across the grid, lit as the ring passes ----------
const FIRES = [];
{ // deterministic scatter over the block grid (seeded LCG, same every run)
  let s = 1234567; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 42; i++) {
    const side = rnd() > 0.5 ? 1 : -1, x = side * (13 + rnd() * 26), z = -36 + rnd() * 72;
    const d = Math.hypot(x - CENTRE[0], z - CENTRE[2]);
    FIRES.push({ p: [x, 0.4 + rnd() * 1.6, z], at: clamp(d / 58, 0.04, 0.95), ph: rnd() * 6.28, s: 0.7 + rnd() * 0.9 });
  }
}
const firesAt = (f) => {
  if (f < SEG.shock.a) return [];
  const u = ph('shock', f), inStill = f >= SEG.still.a;
  return FIRES.map((F) => {
    const on = inStill ? 1 : ramp(u, F.at, F.at + 0.05);
    const flick = 0.82 + 0.18 * Math.sin(f * 0.55 + F.ph * 7);
    return { p: F.p, s: F.s * (inStill ? 0.45 : 1) * flick, a: on * (inStill ? 0.22 : 0.8) };
  }).filter((x) => x.a > 0.01);
};
// ---------- tiny walking figures (silhouettes on their morning way; gone after the flash) ----------
const FIG_PATHS = [
  { a: [-7.5, 1.25, 6], b: [7.5, 1.25, 6], sp: 0.055, off: 0.0 }, { a: [7.5, 1.25, 6], b: [-7.5, 1.25, 6], sp: 0.048, off: 0.4 },
  { a: [-7.5, 1.25, -8], b: [7.5, 1.25, -8], sp: 0.05, off: 0.7 }, { a: [8.6, 0, -30], b: [8.6, 0, 26], sp: 0.045, off: 0.2 },
  { a: [-8.6, 0, 28], b: [-8.6, 0, -28], sp: 0.052, off: 0.55 }, { a: [10, 0, 20], b: [30, 0, 20], sp: 0.042, off: 0.1 },
  { a: [-10, 0, -24], b: [-30, 0, -24], sp: 0.05, off: 0.8 }, { a: [-7.5, 1.25, -8], b: [7.5, 1.25, -8], sp: 0.06, off: 0.3 },
  { a: [-30, 0, 20], b: [-10, 0, 20], sp: 0.047, off: 0.65 }, { a: [7.5, 1.25, 6], b: [-7.5, 1.25, 6], sp: 0.058, off: 0.9 },
  { a: [10, 0, -24], b: [30, 0, -24], sp: 0.04, off: 0.25 }, { a: [-8.6, 0, -32], b: [-8.6, 0, 30], sp: 0.05, off: 0.45 },
];
const figuresAt = (f) => {
  if (f >= SEG.flash.a) return []; // the white-out ends their part of the story; never shown harmed
  return FIG_PATHS.map((P, i) => {
    const u = (f * P.sp / 30 + P.off) % 1, uu = u < 0.5 ? u * 2 : 2 - u * 2; // walk there and back
    const p = lerp3(P.a, P.b, uu);
    const dirx = (u < 0.5 ? 1 : -1) * Math.sign(P.b[0] - P.a[0] || 0.001), dirz = (u < 0.5 ? 1 : -1) * Math.sign(P.b[2] - P.a[2] || 0.001);
    return { p: [p[0], Math.abs(Math.sin(f * 0.32 + i * 1.7)) * 0.035, p[2]], yaw: Math.atan2(dirx, dirz), ph: i };
  });
};
const cityDarkAt = (f) => f < SEG.flash.a ? 0
  : ramp(f, SEG.flash.a + 60, SEG.flash.b) * 0.55 + ramp(f, SEG.shock.a, SEG.shock.a + 150) * 0.45;

// ---------- TRACKING DIRECTOR ----------
const TRACKDIR = {
  hook: [
    { a: SEG.hook.a, b: SEG.hook.a + 52, type: 'object', id: 'clock', pos: () => CLOCK_POS, w: 0.6 },
    { a: SEG.hook.a + 52, b: SEG.hook.b, type: 'subject', id: 'city', pos: () => [0, 3, 0], w: 0.4 },
  ],
  morning: [{ a: SEG.morning.a, b: SEG.morning.b, type: 'subject', id: 'bridge', w: 0.5,
    pos: (f) => kf3(K('morning', [[0, [-2, 1.2, 8]], [0.5, [0, 1.2, -4], 'smooth'], [1, [1, 1.4, -12]]]), f) }],
  plane: [
    { a: SEG.plane.a, b: REL_F, type: 'object', id: 'plane', pos: (f) => (planeAt(f) || { p: [0, 47, 0] }).p, w: 0.7 },
    { a: REL_F, b: SEG.plane.b, type: 'object', id: 'bomb', pos: (f) => (bombAt(f) || { p: BURST }).p, w: 0.72 },
  ],
  flash: [{ a: SEG.flash.a, b: SEG.flash.b, type: 'object', id: 'burst', pos: () => BURST, w: 0.8 }],
  shock: [{ a: SEG.shock.a, b: SEG.shock.b, type: 'subject', id: 'centre', pos: () => [0, 2, -2], w: 0.5 }],
  still: [{ a: SEG.still.a, b: SEG.still.b, type: 'subject', id: 'centre', pos: () => [0, 2.5, 0], w: 0.45 }],
};
const BLEND = 10;
export const dirFor = (id, f) => {
  const segs = TRACKDIR[id];
  let i = segs.findIndex((s) => f <= s.b); if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  let point = seg.pos(f), w = seg.w;
  const nx = segs[i + 1];
  if (nx && f >= nx.a - BLEND / 2) {
    const t = smooth(ramp(f, nx.a - BLEND / 2, nx.a + BLEND / 2));
    point = lerp3(point, nx.pos(f), t); w = lerp(w, nx.w, t);
  }
  return { point, w, seg };
};
export const dirAt = (f) => dirFor(shotAt(f).id, f);

// ---------- cameras ----------
const CAMS = {
  hook: CK('hook', [
    [0, [8.6, 3.3, 19.5], CLOCK_POS, 40], [0.30, [10.5, 3.8, 22], [3, 2.8, 6], 41, 'surge'],
    [0.62, [17, 6.5, 32], [0, 3.2, -2], 42, 'surge'], [1, [23, 10, 41], [0, 4.5, -4], 42],
  ]),
  morning: CK('morning', [
    [0, [16, 4.5, 14], [-6, 1.2, 4], 41], [0.45, [13, 3.6, -2], [-4, 1.2, -6], 40, 'surge'],
    [0.75, [11, 3.4, -13], [-5, 1.4, -10], 40, 'surge'], [1, [12, 4.2, -24], [-5, 1.8, -14], 41],
  ]),
  flash: CK('flash', [
    [0, [13, 5.5, 17], BURST, 42], [0.4, [22, 10, 30], BURST, 43, 'easeInOut'], [0.75, [29, 15, 42], [0, 10, -2], 44, 'easeInOut'], [1, [33, 18, 48], [0, 9, -2], 44],
  ]),
  shock: CK('shock', [
    [0, [33, 19, 47], [0, 1, -2], 44], [0.55, [38, 24, 53], [0, 1, -2], 44, 'easeInOut'], [1, [42, 27, 58], [0, 1.5, -2], 43],
  ]),
  still: CK('still', [
    [0, [24, 9, 40], [-4, 3, 0], 41], [0.45, [28, 11.5, 48], [-7.5, 3.5, -1], 42, 'easeInOut'], [1, [34, 15, 58], [-10.5, 4, -2], 43],
  ]),
};
// plane shot: a follow camera — beside the plane, then riding the falling bomb down.
// The two rigs are blended across +-6 frames at the release so the switch glides, never cuts.
const planeCam = (f) => {
  const camPlane = () => {
    const P = planeAt(f).p;
    const off = kf3(K('plane', [[0, [-13, -4.5, 15]], [0.45, [-11, -3.5, 13], 'smooth'], [1, [-9, -3, 12]]]), f);
    return { pos: [P[0] + off[0], Math.max(30, P[1] + off[1]), P[2] + off[2]], look: [P[0] + 2.5, P[1] - 0.5, P[2]], fov: 39, roll: 0 };
  };
  const camBomb = () => {
    const B = bombAt(f) ? bombAt(f).p : (() => { const P = planeAt(f).p; return [P[0], P[1] - 0.6, P[2]]; })();
    const t = ramp(f, REL_F, SEG.plane.b);
    const off = [lerp(7, 9, t), lerp(6.5, 10.5, t), lerp(11, 13.5, t)];
    const look = lerp3([B[0], B[1] - 1.5, B[2]], [BURST[0], BURST[1] - 6.5, BURST[2]], t * 0.5);
    return { pos: [B[0] + off[0], B[1] + off[1], B[2] + off[2]], look, fov: lerp(39, 42, t), roll: 0 };
  };
  if (f < REL_F - 6) return camPlane();
  if (f > REL_F + 6) return camBomb();
  const t = smooth(ramp(f, REL_F - 6, REL_F + 6)), a = camPlane(), b = camBomb();
  return { pos: lerp3(a.pos, b.pos, t), look: lerp3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t), roll: 0 };
};
const SHADOW_AT = { hook: [0, 1, 0], morning: [0, 1, 0], plane: [0, 1, -2], flash: [0, 1, -2], shock: [0, 1, -2], still: [0, 1, 0] };
const baseCam = (id, f) => id === 'plane' ? planeCam(f) : camFromKeys(CAMS[id], f, {});
const shotCam = (id, f) => {
  const c = baseCam(id, f);
  const D = dirFor(id, f);
  // in the plane shot the base camera IS the tracker — a gentle lean before the
  // release, a stronger one down the fall so the tracked dot holds the frame
  const w = id === 'plane' ? D.w * (f >= REL_F ? 0.6 : 0.18) : D.w;
  return { ...c, look: lerp3(c.look, D.point, w) };
};
export const camAt = (f) => {
  const S = shotAt(f);
  const c = shotCam(S.id, f);
  // impact shake as the flash lands, decaying fast
  const d0 = f - SEG.flash.a;
  if (d0 >= 0 && d0 < 7) { const m = 0.011 * [1, -0.62, 0.3, -0.12, 0.05, -0.02, 0.01][d0]; c.pos = [c.pos[0] + m * 0.5, c.pos[1] + m, c.pos[2]]; c.look = [c.look[0] + m * 0.8, c.look[1] + m * 1.4, c.look[2]]; }
  // the white flash itself + dips to black at every other shot boundary
  let flash = 0;
  if (f < 9) flash = -0.95 * (1 - f / 9);
  if (d0 >= 0 && d0 < 16) flash = Math.max(flash, 1 - d0 / 16);
  else if (d0 >= 16 && d0 < 22) flash = Math.max(flash, 0.18 * (1 - (d0 - 16) / 6)); // afterglow
  for (const [, a] of TIMING.slice(1)) { if (a === SEG.flash.a) continue; const d = f - a; if (d >= -3 && d <= 3) flash = Math.min(flash, -0.95 * Math.cos(d / 3 * Math.PI / 2)); }
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CINF = { hook: 6, morning: 5, plane: 4, flash: 6, shock: 8, still: 9 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  return { focus: dist(C.pos, dirAt(f).point), cinf: CINF[S.id] ?? 5 };
};

// ---------- world state (drives the 3D hardware in main.js) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    shot: S.id,
    plane: planeAt(f), bomb: bombAt(f), fireball: fireballAt(f), cloud: cloudAt(f),
    rings: ringAt(f), fires: firesAt(f), figures: figuresAt(f),
    cityDark: cityDarkAt(f),
    boards: { clock: true, date: f >= SEG.still.a, changed: f >= SEG.still.a + 55 },
    sway: f,
  };
};

// ---------- actors: none (the figures are 3D silhouettes in main.js) ----------
export const actorsAt = (f, T) => [];

// ---------- 2D effects: the falling dot's tracking glow + shock-front dust ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const glow = (tp, s, a) => out.push(FX('glow' + q(a, 2) + '_' + q(tp[0], 1), (p) => fxGlow(p, a), [tp[0], tp[1] - 0.81 * s, tp[2] + 0.12], s));
  const B = bombAt(f);
  if (B) glow(B.p, 0.85, 0.20 + 0.05 * Math.sin(f * 0.4));            // the tracked dot
  const FB = fireballAt(f);
  if (FB) glow(FB.p, FB.s * 0.42, 0.30 * FB.a);                        // fireball halo
  if (S.id === 'shock') {                                              // dust riding the ring front
    const rings = ringAt(f) || [];
    for (const R of rings) for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.35, t = q(R.dust, 2);
      out.push(FX('rd' + k + t, (p) => T.fxDust(p, t, '#cbb99e'), [CENTRE[0] + Math.cos(a) * R.r, 0.5, CENTRE[2] + Math.sin(a) * R.r], 2.0));
    }
  }
  if (S.id === 'still' && f > SEG.still.b - 50) {                      // one last glint of dawn on the river
    const t = q(((f - (SEG.still.b - 50)) % 25) / 25, 2);
    out.push(FX('sglint' + t, (p) => T.fxStars(p, t), [1.5, 1.1, 14], 0.55));
  }
  return out;
};
// soft radial warm glow (design-space centre 300,640 -> 0.81 m above the card origin at s=1)
const fxGlow = (p, a) => {
  const g = p.g;
  const gr = g.createRadialGradient(300, 640, 12, 300, 640, 300);
  gr.addColorStop(0, `rgba(255,208,112,${a.toFixed(3)})`);
  gr.addColorStop(0.55, `rgba(255,182,84,${(a * 0.45).toFixed(3)})`);
  gr.addColorStop(1, 'rgba(255,182,84,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 600, 1000);
};
