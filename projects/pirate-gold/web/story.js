// "The Pirate Who Threw His Gold Away" — enhanced-batch Short.
// Pure frame math only (no THREE, no DOM): TIMING, cameras, environment,
// ship paths, the literal chest count, toss arcs, volleys. main.js renders;
// sweep.mjs verifies. Every pose is an analytic function of the frame.
// TIMING / count-word frames are patched from the finished voice stem
// (timing.json + Whisper word timestamps) — see PATCH markers.
import { clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30;
// === PATCH:TOTAL ===
export const TOTAL = 1515; // frames 0..1514 — patched from final stem 50.509s x 30fps
// === PATCH:TIMING === [id, startFrame, endFrame] — one section per phrase
export const TIMING = [
  ['hook', 0, 104], ['load', 117, 240], ['chase', 252, 325], ['heavy', 337, 443],
  ['order', 455, 576], ['toss', 588, 813], ['laugh', 825, 940], ['kept', 952, 1049],
  ['escape', 1061, 1192], ['bank', 1204, 1329], ['deep', 1341, 1515],
];
// === PATCH:COUNTWORDS === frames where the voice says the count words (P5)
export const COUNT_F = { hundred: 660, sixty: 702, twenty: 729, kept: 975 };
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
export const secAt = (f) => {
  let s = SEG[TIMING[0][0]];
  for (const [id, a] of TIMING) { if (f >= a) s = SEG[id]; else break; }
  return { id: s.id, a: s.a, b: s.b, u: clamp((f - s.a) / s.len) };
};
const sf = (id, u) => SEG[id].a + (SEG[id].b - SEG[id].a) * u;
export const smooth = (u) => u * u * (3 - 2 * u);
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const k1 = (keys, f) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const [f0, v0] = keys[i - 1], [f1, v1] = keys[i]; return lerp(v0, v1, (f - f0) / Math.max(1, f1 - f0)); }
  }
  return keys[keys.length - 1][1];
};
const k3 = (keys, f) => {
  if (f <= keys[0][0]) return [...keys[0][1]];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) { const [f0, v0] = keys[i - 1], [f1, v1] = keys[i]; return lerp3(v0, v1, (f - f0) / Math.max(1, f1 - f0)); }
  }
  return [...keys[keys.length - 1][1]];
};
const rotY = ([lx, lz], ry) => [lx * Math.cos(ry) + lz * Math.sin(ry), -lx * Math.sin(ry) + lz * Math.cos(ry)];

// ---------- sea surface (EXACT replica of the fx.js water vertex shader) ----------
export const WAVE_AMP = 0.55;
export function waveH(x, z, t) {
  return WAVE_AMP * (Math.sin(x * 0.11 + t * 1.15) * 0.45 + Math.sin(z * 0.16 - t * 0.85) * 0.32 + Math.sin((x + z) * 0.055 + t * 0.5) * 0.55);
}
const bobFor = (x, z, t, k = 1) => ({
  y: waveH(x, z, t) * 0.62 * k - 0.30,
  pitch: Math.atan2(waveH(x, z + 2.2, t) - waveH(x, z - 2.2, t), 4.4) * 0.55 * k,
  roll: Math.atan2(waveH(x + 3, z, t) - waveH(x - 3, z, t), 6) * 0.55 * k,
});

// ---------- environment: dawn harbour -> day chase -> sunset escape -> the deep ----------
const C = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const ENV_KEYS = [
  [0,              { top: '#7580b4', hor: '#f2b8a0', fog: '#eec3ac', fn: 55, ff: 360, az: 100, el: 9,  sun: '#ffd9a8', sunI: 2.1, hSky: '#ffe2cc', hGnd: '#5d564c', hemi: 0.95, deep: '#1e4059', shal: '#6d8aa0', wsky: '#f2c4a8', mist: 0.15, cloud: '#ffd9c9', cop: 0.80 }],
  [sf('load', 0.5),  { top: '#5f8fce', hor: '#ffe3ba', fog: '#dfe4e2', fn: 60, ff: 430, az: 108, el: 17, sun: '#ffe9c4', sunI: 2.6, hSky: '#eaf4ff', hGnd: '#66604f', hemi: 1.05, deep: '#1d4e66', shal: '#3d84a8', wsky: '#bfe3f2', mist: 0.07, cloud: '#ffffff', cop: 0.85 }],
  [sf('heavy', 0),   { top: '#4a86d8', hor: '#d8ecf4', fog: '#cfdde8', fn: 65, ff: 460, az: 118, el: 34, sun: '#fff2d8', sunI: 2.9, hSky: '#eaf4ff', hGnd: '#6a6a5c', hemi: 1.10, deep: '#1a4a66', shal: '#3f8ab0', wsky: '#bfd9e8', mist: 0.05, cloud: '#ffffff', cop: 0.90 }],
  [sf('escape', 0.2), { top: '#5a6aa8', hor: '#f0a56a', fog: '#d8b090', fn: 58, ff: 400, az: 200, el: 13, sun: '#ffb066', sunI: 2.3, hSky: '#f4d8b8', hGnd: '#5c5044', hemi: 0.98, deep: '#22455c', shal: '#5d84a0', wsky: '#f0b183', mist: 0.06, cloud: '#f4c49a', cop: 0.82 }],
  [sf('bank', 0.9),  { top: '#6a4a7c', hor: '#f7b733', fog: '#eebd8a', fn: 55, ff: 400, az: 256, el: 7,  sun: '#ffc46b', sunI: 2.4, hSky: '#ffe0b0', hGnd: '#54483c', hemi: 0.95, deep: '#274b5e', shal: '#7d94a0', wsky: '#f7c46b', mist: 0.05, cloud: '#ffd9a0', cop: 0.80 }],
  [sf('deep', 0.16), { top: '#274b5e', hor: '#7d94a0', fog: '#33566b', fn: 30, ff: 170, az: 256, el: 7,  sun: '#d8b28a', sunI: 1.2, hSky: '#9fc0cc', hGnd: '#2c383c', hemi: 0.60, deep: '#12303f', shal: '#2c5a72', wsky: '#7d94a8', mist: 0.03, cloud: '#9fc8dd', cop: 0.30 }],
  [sf('deep', 0.45), { top: '#0d3d5c', hor: '#0a324e', fog: '#0a2e47', fn: 10, ff: 75,  az: 256, el: 20, sun: '#9fd4e8', sunI: 0.9, hSky: '#7fb2c9', hGnd: '#14242c', hemi: 0.64, deep: '#082638', shal: '#14506e', wsky: '#3d84a8', mist: 0.0,  cloud: '#9fc8dd', cop: 0.22 }],
  [TOTAL - 1,        { top: '#0d3d5c', hor: '#0a324e', fog: '#0a2e47', fn: 10, ff: 75,  az: 256, el: 20, sun: '#9fd4e8', sunI: 0.9, hSky: '#7fb2c9', hGnd: '#14242c', hemi: 0.64, deep: '#082638', shal: '#14506e', wsky: '#3d84a8', mist: 0.0,  cloud: '#9fc8dd', cop: 0.22 }],
];
const COL_FIELDS = ['top', 'hor', 'fog', 'sun', 'hSky', 'hGnd', 'deep', 'shal', 'wsky', 'cloud'];
const NUM_FIELDS = ['fn', 'ff', 'az', 'el', 'sunI', 'hemi', 'mist', 'cop'];
export const envAt = (f) => {
  let i = 0;
  while (i < ENV_KEYS.length - 2 && f > ENV_KEYS[i + 1][0]) i++;
  const [f0, A] = ENV_KEYS[i], [f1, B] = ENV_KEYS[i + 1];
  const u = clamp((f - f0) / Math.max(1, f1 - f0));
  const out = {};
  for (const k of COL_FIELDS) out[k] = lerp3(C(A[k]), C(B[k]), u);
  for (const k of NUM_FIELDS) out[k] = lerp(A[k], B[k], u);
  out.flash = 0;
  return out;
};
// mist bank the navy hides in: thick through the chase reveal, gone by mid-heavy
export const mistBankAt = (f) => 0.34 * smooth(ramp(f, sf('chase', 0), sf('chase', 0.35))) * (1 - smooth(ramp(f, sf('chase', 0.8), sf('heavy', 0.5))));

// ---------- THE CHEST COUNT (the literal hundred) ----------
// Toss events remove batches: 100 --(8x5)--> 60 at the "Sixty!" word,
// --(8x5)--> 20 at "Twenty!", --(4x2)--> 12 across the crew's horror (P6),
// then the captain takes ONE for himself at the "kept" beat (P7) -> 11 + his 1.
const TOSS_EVENTS = [];
{
  const spread = (a, b, n, size) => { for (let i = 0; i < n; i++) TOSS_EVENTS.push({ f: Math.round(lerp(a, b, (i + 0.5) / n)), n: size }); };
  spread(COUNT_F.hundred + 4, COUNT_F.sixty, 8, 5);
  spread(COUNT_F.sixty + 4, COUNT_F.twenty, 8, 5);
  spread(sf('laugh', 0.05), sf('laugh', 0.85), 4, 2);
  TOSS_EVENTS.push({ f: COUNT_F.kept, n: 1, kept: true });
  TOSS_EVENTS.sort((x, y) => x.f - y.f);
  TOSS_EVENTS.forEach((e, i) => { e.ix = i; });
}
export const tossEvents = TOSS_EVENTS;
export const chestCountAt = (f) => 100 - TOSS_EVENTS.reduce((s, e) => s + (f >= e.f ? e.n : 0), 0);
export const keptOutAt = (f) => f >= COUNT_F.kept; // the captain's own chest sits by the wheel

// ---------- ship paths ----------
const P_ANCHOR = [
  [0, [-105, 0, 6]], [sf('load', 1), [-88, 0, 2]], [sf('chase', 1), [-56, 0, 0]],
  [sf('heavy', 1), [-22, 0, -2]], [sf('order', 1), [-2, 0, -2.5]], [sf('toss', 1), [24, 0, -3]],
  [sf('laugh', 1), [40, 0, -3.5]], [sf('kept', 1), [58, 0, -4]], [sf('escape', 1), [96, 0, -4.5]],
  [sf('bank', 1), [128, 0, -5]], [TOTAL - 1, [146, 0, -5]],
];
const P_RY = [[0, 0.30], [sf('load', 0.4), 0.10], [sf('chase', 0), 0.02], [sf('escape', 0), 0.0], [TOTAL - 1, -0.05]];
// how light she rides: 0 = laden (deep draft), 1 = empty (high + fast handled by anchors)
export const lightUAt = (f) => clamp((100 - chestCountAt(f)) / 88);
export function piratePoseAt(f) {
  const t = f / FPS;
  const a = k3(P_ANCHOR, f), ry = k1(P_RY, f);
  const b = bobFor(a[0], a[2], t);
  const draft = lerp(-0.42, 0.30, lightUAt(f));
  return { p: [a[0], b.y + draft, a[2]], ry, pitch: b.pitch, roll: b.roll, hidden: false };
}
const N_ANCHOR = [ // per navy ship: [side offset z, astern gap keys]
  { z: 13, gap: [[0, 62], [sf('chase', 1), 44], [sf('heavy', 1), 30], [sf('toss', 1), 26], [sf('escape', 0.4), 34], [sf('escape', 1), 62], [sf('bank', 1), 96], [TOTAL - 1, 110]] },
  { z: -14, gap: [[0, 70], [sf('chase', 1), 50], [sf('heavy', 1), 36], [sf('toss', 1), 31], [sf('escape', 0.4), 40], [sf('escape', 1), 70], [sf('bank', 1), 104], [TOTAL - 1, 118]] },
];
export function navyPoseAt(i, f) {
  const t = f / FPS;
  if (f < sf('chase', 0.02)) return { p: [0, -99, 0], ry: 0, pitch: 0, roll: 0, hidden: true };
  const pa = k3(P_ANCHOR, f);
  const gap = k1(N_ANCHOR[i].gap, f);
  const x = pa[0] - gap, z = pa[2] + N_ANCHOR[i].z + Math.sin(f * 0.01 + i * 2.4) * 0.8;
  const b = bobFor(x, z, t);
  return { p: [x, b.y - 0.1, z], ry: 0.02 + (i ? -0.03 : 0.03), pitch: b.pitch, roll: b.roll, hidden: false };
}

// ---------- the captain in world space (card on the sterncastle, scale 1.15) ----------
// head centre for seed 11 sits CAP_HEAD_M above the soles (toon headCenter(11)).
export const CAP_HEAD_M = 1.50; // headCenter(11) = 310.0 px -> (975-310)/1000*2.25
export function capSolesAt(f) { // on the sterncastle deck (local -4.6, deck top 3.06), scale 1.15
  const pp = piratePoseAt(f);
  const [wx, wz] = rotY([-4.6 * 1.15, 0], pp.ry);
  return [pp.p[0] + wx, pp.p[1] + 3.06 * 1.15, pp.p[2] + wz];
}
export function capHeadAt(f) { const s = capSolesAt(f); return [s[0], s[1] + CAP_HEAD_M, s[2]]; }
export function capChestAt(f) { // CENTRE of the captain's kept chest, beside the wheel (local -3.45, 3.06+0.30, 1.0)
  const pp = piratePoseAt(f);
  const [wx, wz] = rotY([-3.45 * 1.15, 1.0 * 1.15], pp.ry);
  return [pp.p[0] + wx, pp.p[1] + (3.06 + 0.30) * 1.15, pp.p[2] + wz];
}
// his pointing arm: rises on "throw the gold overboard!" (2nd chunk of P4)
export const pointUAt = (f) => smooth(ramp(f, sf('order', 0.52), sf('order', 0.66))) * (1 - smooth(ramp(f, sf('order', 0.94), sf('order', 1.06))));

// ---------- toss arcs: one visual chest per event, deck edge -> sea -> sinking ----------
export const TOSS_DUR = 30; // frames of flight+sink per visual chest
export function tossArcAt(ev, f) {
  const u = (f - ev.f) / TOSS_DUR;
  if (u < 0 || u > 1) return null;
  const pp = piratePoseAt(ev.f);
  const side = -1; // always over the camera-side rail (-z local)
  const [sx, sz] = rotY([0.5 * 1.15, side * 1.35 * 1.15], pp.ry);
  const start = [pp.p[0] + sx, pp.p[1] + 3.1 * 1.15, pp.p[2] + sz];
  const [ex, ez] = rotY([(-1.0 - (ev.ix % 3)) * 1.15, side * (6.5 + (ev.ix % 4)) * 1.15], pp.ry); // astern-port: lands ON the toss camera's axis
  const end = [pp.p[0] + ex, 0, pp.p[2] + ez];
  const fly = clamp(u / 0.45);
  const p = lerp3(start, end, fly);
  p[1] = lerp(start[1], 0.1, fly) + Math.sin(fly * Math.PI) * 2.1;
  if (u > 0.45) { // sinking after the splash
    const s = (u - 0.45) / 0.55;
    p[1] = 0.1 - s * s * 2.6;
    p[0] = end[0]; p[2] = end[2];
  }
  return { p, rot: [u * 5.2 * (ev.ix % 3 + 1), u * 3.1, u * 4.3], splashF: ev.f + Math.round(0.45 * TOSS_DUR), sx: end[0], sz: end[2] };
}

// ---------- navy cannon volleys (the chase bites) ----------
const FLIGHT = 24;
export const VOLLEYS = [
  { f: Math.round(sf('heavy', 0.45)), ship: 0 },
  { f: Math.round(sf('heavy', 0.82)), ship: 1 },
  { f: Math.round(sf('toss', 0.30)), ship: 0 },
];
export const volleyAt = (f) => VOLLEYS.filter((v) => v.f === f);
export const ballsAt = (f) => {
  const out = [];
  for (const v of VOLLEYS) {
    const u = (f - v.f) / FLIGHT;
    if (u < 0 || u > 1) continue;
    const np = navyPoseAt(v.ship, v.f), pp = piratePoseAt(v.f + FLIGHT);
    const [sx, sz] = rotY([0.5, v.ship === 0 ? -1.85 : 1.85], np.ry);
    const st = [np.p[0] + sx, 2.05, np.p[2] + sz];
    const hit = v === VOLLEYS[1]; // the second volley strikes the pirate's hull
    const tg = hit
      ? { p: [pp.p[0] - 1, 1.9, pp.p[2] + (v.ship === 0 ? -1.6 : 1.6)], kind: 'hull' }
      : { p: [pp.p[0] + (hash(v.f) - 0.5) * 10 - 4, 0, pp.p[2] + (v.ship === 0 ? -5.5 : 5.5)], kind: 'water' };
    for (let j = 0; j < 2; j++) {
      const t2 = { p: [tg.p[0] + j * 1.8 - 0.9, tg.p[1], tg.p[2] + j * 1.2 - 0.6], kind: tg.kind };
      const p = lerp3(st, t2.p, u); p[1] = lerp(st[1], t2.p[1], u) + Math.sin(u * Math.PI) * 4.6;
      out.push({ p, impact: f === v.f + FLIGHT, target: t2 });
    }
  }
  return out;
};

// ---------- title / message boards ----------
export const boardAt = (f) => {
  const fade = (a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
  if (f > sf('hook', 0.12) && f < sf('hook', 0.97)) return { text: '100 CHESTS OF GOLD!', alpha: fade(sf('hook', 0.12), sf('hook', 0.25), sf('hook', 0.85), sf('hook', 0.97)) };
  if (f > sf('order', 0.45) && f < sf('order', 1.0)) return { text: 'THROW THE GOLD OVERBOARD!', alpha: fade(sf('order', 0.45), sf('order', 0.55), sf('order', 0.92), sf('order', 1.0)) };
  if (f >= COUNT_F.hundred - 6 && f < COUNT_F.sixty - 4) return { text: '100 CHESTS', alpha: fade(COUNT_F.hundred - 6, COUNT_F.hundred + 2, COUNT_F.sixty - 12, COUNT_F.sixty - 4) };
  if (f >= COUNT_F.sixty - 4 && f < COUNT_F.twenty - 4) return { text: '60 LEFT!', alpha: fade(COUNT_F.sixty - 4, COUNT_F.sixty + 3, COUNT_F.twenty - 12, COUNT_F.twenty - 4) };
  if (f >= COUNT_F.twenty - 4 && f < sf('toss', 0.97)) return { text: 'ONLY 20 LEFT!', alpha: fade(COUNT_F.twenty - 4, COUNT_F.twenty + 3, sf('toss', 0.88), sf('toss', 0.97)) };
  if (f > sf('bank', 0.10) && f < sf('bank', 0.95)) return { text: 'THE SEA IS MY BANK!', alpha: fade(sf('bank', 0.10), sf('bank', 0.22), sf('bank', 0.82), sf('bank', 0.95)) };
  if (f > sf('deep', 0.02) && f < sf('deep', 0.30)) return { text: '300 YEARS LATER', alpha: fade(sf('deep', 0.02), sf('deep', 0.07), sf('deep', 0.24), sf('deep', 0.30)) };
  return null;
};

// ---------- CAMERA: one continuous flight, voice-tracked (V2 doctrine) ----------
const BK = 9;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const CAMSEGS = [
  { a: 0, fn: (f) => { // HOOK — dawn harbour: push in CLOSE on the grinning captain + his gold
    const ch = capHeadAt(f);
    const off = kf3([[0, [-11.5, 3.0, -10.5]], [sf('hook', 0.5), [-8.2, 1.9, -7.4]], [sf('hook', 1), [-6.4, 1.35, -5.4]]], f);
    return { pos: add3(ch, off), look: lerp3(add3(piratePoseAt(f).p, [0, 3.2, 0]), ch, ramp(f, sf('hook', 0.05), sf('hook', 0.45))), fov: 46 };
  } },
  { a: SEG.load.a, fn: (f) => ({ // LOAD — climb to the drone: the literal 100 chests in their grid + the quay below
    pos: kf3([[SEG.load.a, [-99.5, 5.9, -2.9]], [sf('load', 0.5), [-103, 25, -17]], [sf('load', 1), [-90, 29, -21]]], f),
    look: add3(piratePoseAt(f).p, [0, 2.6, 0]), fov: 55 }) },
  { a: SEG.chase.a, fn: (f) => { // CHASE — swing wide and high: two navy sails break out of the mist bank
    const pp = piratePoseAt(f).p, nv = navyPoseAt(0, f);
    return { pos: kf3([[SEG.chase.a, [-90, 29, -21]], [sf('chase', 0.5), [-72, 19, -35]], [sf('chase', 1), [-54, 10, -27]]], f),
    look: lerp3(pp, nv.hidden ? pp : nv.p, 0.45 * ramp(f, sf('chase', 0.02), sf('chase', 0.5))), fov: 54 };
  } },
  { a: SEG.heavy.a, fn: (f) => { // HEAVY — stern-quarter ride: laden stack + captain fill the frame, volleys streak in
    const pp = piratePoseAt(f).p;
    const off = kf3([[SEG.heavy.a, [-16, 5.4, -11.5]], [sf('heavy', 0.5), [-14, 5.4, -10.5]], [sf('heavy', 1), [-12, 5.6, -9.5]]], f);
    return { pos: add3(pp, off), look: add3(pp, [-1.5, 2.6, 0]), fov: 50 };
  } },
  { a: SEG.order.a, fn: (f) => { // ORDER — deck-level push-in locked on the captain's head, arm rising
    const ch = capHeadAt(f);
    const off = kf3([[SEG.order.a, [8.5, 2.0, 7.5]], [sf('order', 0.6), [5.2, 1.25, 4.8]], [sf('order', 1), [4.4, 1.05, 4.0]]], f);
    return { pos: add3(ch, off), look: ch, fov: kf([[SEG.order.a, 46], [sf('order', 1), 40]], f) };
  } },
  { a: SEG.toss.a, fn: (f) => { // TOSS — wide rail ride: deck, arcs AND the splash zone all in frame
    const pp = piratePoseAt(f).p;
    const off = kf3([[SEG.toss.a, [-13, 5.2, -17]], [sf('toss', 0.5), [-10.5, 4.8, -18]], [sf('toss', 1), [-7, 5.4, -17]]], f);
    return { pos: add3(pp, off), look: add3(pp, [2.2, 2.0, -1.5]), fov: 52 };
  } },
  { a: SEG.laugh.a, fn: (f) => { // LAUGH — push in on the laughing captain, horrified crew at his shoulders
    const ch = capHeadAt(f);
    const off = kf3([[SEG.laugh.a, [8.5, 2.3, 8.5]], [sf('laugh', 1), [5.6, 1.5, 5.4]]], f);
    return { pos: add3(ch, off), look: ch, fov: 44 };
  } },
  { a: SEG.kept.a, fn: (f) => { // KEPT — tight on the captain + the ONE chest he would not throw
    const ch = capHeadAt(f), cc = capChestAt(f);
    const off = kf3([[SEG.kept.a, [5.6, 1.5, 5.4]], [sf('kept', 1), [4.8, 1.0, 3.6]]], f);
    return { pos: add3(ch, off), look: lerp3(ch, cc, 0.38), fov: 42 };
  } },
  { a: SEG.escape.a, fn: (f) => { // ESCAPE — chase cam astern: she flies, the navy shrinks behind
    const pp = piratePoseAt(f).p;
    const off = kf3([[SEG.escape.a, [-17, 5.5, -13.5]], [sf('escape', 0.5), [-21, 6.5, -16.5]], [sf('escape', 1), [-25, 7.5, -14.5]]], f);
    return { pos: add3(pp, off), look: add3(pp, [5, 2.6, 0]), fov: 54 };
  } },
  { a: SEG.bank.a, fn: (f) => { // BANK — close on the laughing captain at the stern rail, sunset behind him
    const pp = piratePoseAt(f).p, ch = capHeadAt(f);
    const off = kf3([[SEG.bank.a, [-25, 7.5, -14.5]], [sf('bank', 1), [-12.5, 4.6, -9.5]]], f);
    return { pos: add3(pp, off), look: lerp3(add3(pp, [0, 3, 0]), ch, ramp(f, sf('bank', 0.15), sf('bank', 0.6))), fov: 48 };
  } },
  { a: SEG.deep.a, fn: (f) => ({ // DEEP — leave the ship, arc back over the sea and DIVE to the buried gold + the diver's lamp
    pos: kf3([[SEG.deep.a, [115.5, 4.6, -14.5]], [sf('deep', 0.16), [88, 7.5, -17]], [sf('deep', 0.36), [95, 2.0, -9]], [sf('deep', 0.54), [99, -4.5, -4.5]], [sf('deep', 0.78), [103, -9.8, 0.5]], [TOTAL - 1, [106.0, -10.6, 4.2]]], f),
    look: kf3([[SEG.deep.a, [122, 4.5, -5]], [sf('deep', 0.3), [99, -1, -2]], [sf('deep', 0.55), [106, -11.5, 0]], [TOTAL - 1, [114.5, -11.2, -1.6]]], f), fov: 50 }) },
];
export function camAt(f) {
  let i = 0;
  for (let k = 0; k < CAMSEGS.length; k++) if (f >= CAMSEGS[k].a) i = k;
  let c = CAMSEGS[i].fn(f);
  const blendTo = (other, w) => { c = { pos: lerp3(c.pos, other.pos, w), look: lerp3(c.look, other.look, w), fov: lerp(c.fov, other.fov, w) }; };
  if (i + 1 < CAMSEGS.length && f > CAMSEGS[i + 1].a - BK) {
    blendTo(CAMSEGS[i + 1].fn(f), smooth(clamp((f - (CAMSEGS[i + 1].a - BK)) / (2 * BK))));
  } else if (i > 0 && f < CAMSEGS[i].a + BK) {
    const p = CAMSEGS[i - 1].fn(f), w = smooth(clamp((f - (CAMSEGS[i].a - BK)) / (2 * BK)));
    c = { pos: lerp3(p.pos, c.pos, w), look: lerp3(p.look, c.look, w), fov: lerp(p.fov, c.fov, w) };
  }
  let { pos, look, fov } = c;
  const t = f / FPS;
  pos = [pos[0] + Math.sin(t * 0.5) * 0.15, pos[1] + Math.sin(t * 0.8) * 0.08, pos[2]];
  return { pos, look, fov };
}
