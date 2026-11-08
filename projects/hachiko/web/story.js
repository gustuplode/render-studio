// Shot plan for "The Dog Who Waited Every Day" (Hachiko) — timed to voice.mp3 (35.43 s, 30 fps, TOTAL 1063).
// Phrases (f): hook 0-143 | walk/ritual 163-380 | empty 406-605 | seasons 619-790 | kindness 817-901 | statue 965-1040.
// Sets (main.js zones): street x~-30, station x~0 (platform top y=0.55, dog spot x1.6 z0.9, tracks z=-6.9), plaza x~+30.
import { M, camFromKeys, idle, blinkAt, walk, q, clamp, lerp, ramp } from './motion.js';

export const FPS = 30, TOTAL = 1063, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 161, light: 'day' },
  { id: 'walk', a: 162, b: 330, light: 'morning' },
  { id: 'ritual', a: 331, b: 404, light: 'day' },
  { id: 'empty', a: 405, b: 618, light: 'overcast' },
  { id: 'seasons', a: 619, b: 816, light: 'seasons' },
  { id: 'kindness', a: 817, b: 964, light: 'golden' },
  { id: 'statue', a: 965, b: 1062, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;
const DOG = [1.6, 0.55, 0.9];

// ---------- lights ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 240,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sunDisc: '#000000', sunSize: 0, sat: 1.1, vig: 0.2, shadowExt: 16, gain: '#ffffff', ...WATER },
  morning: { az: 100, el: 16, sky: '#c9d4e8', ground: '#8a7a5c', hemi: 1.05, sun: '#ffd9a0', sunI: 2.6, fog: '#e6d3ac', fogNear: 35, fogFar: 200,
    skyTop: '#5f8fd0', skyHor: '#f2cf9e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.1, vig: 0.22, shadowExt: 14, gain: '#fff6e6', ...WATER },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 40, fogFar: 220,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, vig: 0.26, shadowExt: 16, gain: '#fff2e2', ...WATER },
  overcast: { az: 140, el: 52, sky: '#aebac4', ground: '#6a6a60', hemi: 1.18, sun: '#d8dde2', sunI: 1.4, fog: '#b4bcc2', fogNear: 25, fogFar: 130,
    skyTop: '#7e8b98', skyHor: '#c2c9ce', sunDisc: '#000000', sunSize: 0, sat: 0.82, vig: 0.26, shadowExt: 14, gain: '#f2f4f6', ...WATER },
  winter: { az: 150, el: 24, sky: '#c3ccd6', ground: '#8b93a0', hemi: 1.05, sun: '#e8ecf2', sunI: 1.5, fog: '#ccd4dc', fogNear: 30, fogFar: 170,
    skyTop: '#8ea2b8', skyHor: '#dde4ea', sunDisc: '#000000', sunSize: 0, sat: 0.9, vig: 0.22, shadowExt: 14, gain: '#f4f7fa', ...WATER },
  noon: { az: 170, el: 78, sky: '#cfdce8', ground: '#8a8262', hemi: 1.25, sun: '#fff4e0', sunI: 2.9, fog: '#d8e2ea', fogNear: 45, fogFar: 260,
    skyTop: '#4a86d8', skyHor: '#cfe0ee', sunDisc: '#000000', sunSize: 0, sat: 1.12, vig: 0.18, shadowExt: 14, gain: '#ffffff', ...WATER },
};
const NUMK = ['az', 'el', 'hemi', 'sunI', 'fogNear', 'fogFar', 'sat', 'vig', 'sunSize', 'shadowExt'];
const COLK = ['sky', 'ground', 'sun', 'fog', 'skyTop', 'skyHor', 'sunDisc', 'waterDeep', 'waterShal', 'glint', 'gain'];
const hexLerp = (a, b, t) => { const pa = [1, 3, 5].map((i) => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.substr(i, 2), 16)); return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join(''); };
const blendL = (A, B, t) => { const o = { ...A }; for (const k of NUMK) o[k] = lerp(A[k] ?? 0, B[k] ?? 0, t); for (const k of COLK) o[k] = hexLerp(A[k] || '#000000', B[k] || '#000000', t); return o; };
// seasons shot segments: rain | winter | summer | golden appointment
const SEASON_B = [646, 669, 733];
const SEASON_KEYS = ['overcast', 'winter', 'noon', 'golden'];
const seasonIdx = (f) => SEASON_B.filter((b) => f >= b).length;
export const lightFor = (S, f) => {
  if (S.id !== 'seasons') return { ...LIGHTS[S.light] };
  const idx = seasonIdx(f);
  let L = { ...LIGHTS[SEASON_KEYS[idx]] };
  const bNext = SEASON_B[idx];
  if (bNext !== undefined && f >= bNext - 14) L = blendL(LIGHTS[SEASON_KEYS[idx]], LIGHTS[SEASON_KEYS[idx + 1]], smooth(ramp(f, bNext - 14, bNext)));
  return L;
};

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [0.2, 1.35, -5.4], look: [1.6, 1.0, 0.9], fov: 38 },
    { f: 58, pos: [0.1, 1.32, -5.1], look: [1.6, 1.0, 0.9], fov: 37 },
    { f: 112, pos: [-1.5, 2.35, -9.6], look: [0.6, 1.7, 1.4], fov: 43, ease: 'easeOut' },
    { f: 161, pos: [-1.75, 2.5, -10.2], look: [0.5, 1.75, 1.5], fov: 43 },
  ],
  walk: [
    { f: 162, pos: [-38.6, 1.7, -6.8], look: [-36.7, 1.05, -0.2], fov: 40 },
    { f: 196, pos: [-37.2, 1.7, -6.8], look: [-35.3, 1.05, -0.2], fov: 40 },
    { f: 230, pos: [-35.8, 1.7, -6.8], look: [-33.9, 1.05, -0.2], fov: 40 },
    { f: 264, pos: [-34.4, 1.7, -6.8], look: [-32.5, 1.05, -0.2], fov: 40 },
    { f: 298, pos: [-32.9, 1.7, -6.8], look: [-31.0, 1.05, -0.2], fov: 40 },
    { f: 330, pos: [-31.6, 1.7, -6.8], look: [-29.7, 1.05, -0.2], fov: 40 },
  ],
  ritual: [
    { f: 331, pos: [5.2, 2.0, -12.6], look: [1.2, 1.05, 0.8], fov: 40 },
    { f: 372, pos: [5.0, 1.95, -12.2], look: [1.25, 1.03, 0.78], fov: 40 },
    { f: 404, pos: [4.35, 1.62, -9.05], look: [1.35, 1.0, 0.75], fov: 40 },
  ],
  empty: [
    { f: 405, pos: [4.4, 1.8, -12.4], look: [1.5, 1.0, 0.85], fov: 40 },
    { f: 470, pos: [4.2, 1.75, -12.0], look: [1.55, 0.98, 0.88], fov: 40 },
    { f: 540, pos: [3.15, 1.45, -8.7], look: [1.6, 0.95, 0.9], fov: 39 },
    { f: 618, pos: [2.65, 1.35, -7.1], look: [1.6, 0.92, 0.9], fov: 37 },
  ],
  seasons: [
    { f: 619, pos: [3.9, 1.6, -5.6], look: [2.2, 1.2, 1.0], fov: 44 },
    { f: 816, pos: [3.65, 1.55, -5.2], look: [2.25, 1.18, 1.0], fov: 43 },
  ],
  kindness: [
    { f: 817, pos: [-3.2, 1.5, -4.1], look: [1.5, 0.88, 1.0], fov: 41 },
    { f: 964, pos: [-3.75, 1.45, -3.9], look: [1.75, 0.85, 1.0], fov: 40 },
  ],
  statue: [
    { f: 965, pos: [25.9, 1.95, -9.2], look: [29.8, 1.5, 0.3], fov: 46 },
    { f: 1062, pos: [26.2, 1.9, -8.6], look: [29.8, 1.5, 0.3], fov: 45 },
  ],
};
const SHADOW_AT = { hook: [0, 1, 0], walk: [-31, 1, 0], ritual: [1.5, 1, 0], empty: [1.5, 1, 0], seasons: [1.5, 1, 0], kindness: [1.2, 1, 0.8], statue: [30, 1.2, 0.8] };
const FLASHY = { walk: 0.35, empty: 0.3, seasons: 0.35, statue: 0.4 };
export const camAt = (f) => {
  const S = shotAt(f);
  const c = camFromKeys(CAMS[S.id], f, {});
  const d = f - S.a, amp = FLASHY[S.id] || 0;
  c.flash = amp && d >= 0 && d < 5 ? (1 - d / 5) * amp : 0;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, [1.6, 1.1, 0.9]), cinf: lerp(10, 3, smooth(ramp(f, 58, 112))) };
    case 'walk': return { focus: dist(C.pos, [-31, 1.0, 0]), cinf: 6 };
    case 'ritual': return { focus: dist(C.pos, [1.6, 1.1, 0.9]), cinf: 5 };
    case 'empty': return { focus: dist(C.pos, [1.6, 1.05, 0.9]), cinf: lerp(7, 10, ramp(f, S.a, S.b)) };
    case 'seasons': return { focus: dist(C.pos, [1.6, 1.05, 0.9]), cinf: 7 };
    case 'kindness': return { focus: dist(C.pos, [1.4, 0.95, 1.1]), cinf: 9 };
    case 'statue': return { focus: dist(C.pos, [30, 1.6, 0.8]), cinf: 8 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, trainX: 60, steam: 0, clockHr: 90, clockMin: 0, calIdx: 0, calFlip: 0, snow: 0, puddle: 0, bowl: 0 };
  if (S.id === 'walk') { W.clockHr = 230; W.clockMin = 240; }
  if (S.id === 'ritual') { W.trainX = lerp(-36, 30, smooth(ramp(f, S.a + 2, S.a + 44))); W.steam = f < S.a + 48 ? 1 : 0.3; }
  if (S.id === 'empty') { W.trainX = lerp(-36, 38, ramp(f, S.a, S.a + 92)); W.steam = 0.9; }
  if (S.id === 'seasons') {
    const idx = seasonIdx(f);
    W.snow = idx === 1 ? 1 : 0; W.puddle = idx === 0 ? 1 : 0; W.calIdx = idx;
    for (const b of SEASON_B) if (f >= b - 8 && f < b + 8) W.calFlip = (f - (b - 8)) / 16;
  }
  if (S.id === 'kindness') { W.calIdx = 4; W.bowl = f >= S.a + 38 ? 1 : 0; }
  if (S.id === 'statue') { W.calIdx = 5; }
  return W;
};

// ---------- actors (2D cards) ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const RD = (T, o, pos, extra = {}) => ({ key: 'akita' + JSON.stringify(o), draw: (p) => T.akitaCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const TINT = { day: '#ffffff', morning: '#ffe9c4', golden: '#ffe2c8', overcast: '#dfe4ea', seasons: '#f4f6fa' };
const pathPos = (pts, t) => { const n = pts.length - 1, x = clamp(t) * n, i = Math.min(n - 1, Math.floor(x)), u = x - i; return pts[i].map((v, k) => lerp(v, pts[i + 1][k], u)); };
const staffAt = (T, f, tint, sad = 0) => { const id = idle(f, 31); return R(T, 'staff25', { seed: 31, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 31), bob: q(id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(sad ? -3 : id.headTilt, 1) }, [-1.9, 0.55, 2.95], { tint }); };

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  const id = idle(f, 5);
  switch (S.id) {
    case 'hook': {
      out.push(RD(T, { sit: true, wag: q(Math.sin(f * 0.13) * 0.7, 2), headDip: 0.05 }, DOG, { tint, s: 0.72 }));
      out.push(staffAt(T, f, tint));
      if (f < 70) { const t = ramp(f, 4, 66); out.push(R(T, 'lady25', { seed: 41, expr: 'smile', L: 'hang', R: 'hang', step: q(walk(f, 4, 1.0, 0.62).phase), blink: blinkAt(f, 41), bob: q(id.bob, 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(2, 1) }, [lerp(-4.5, -8.5, t), 0.55, 1.9], { tint })); }
      break;
    }
    case 'walk': {
      const wk = walk(f, S.a, 1.25, 0.62), profX = -36.3 + wk.dist;
      out.push(R(T, 'prof25', { seed: 7, expr: 'smile', L: 'hang', R: 'hang', step: q(wk.phase), blink: blinkAt(f, 7), bob: q(0.012 + id.bob, 3), tilt: q(id.tilt * 0.4, 1), headTilt: q(3 * Math.sin(f * 0.021), 1) }, [profX, 0, 0.15], { tint, s: 0.95 }));
      out.push(RD(T, { step: q(wk.phase + 0.05), wag: q(0.6 + 0.4 * Math.sin(f * 0.2), 2) }, [profX - 0.85, 0, -0.8], { tint, s: 0.55, flip: true }));
      break;
    }
    case 'ritual': {
      const a = S.a;
      const profT = smooth(ramp(f, a + 28, a + 60));
      const profPos = pathPos([[6.8, 0.55, -0.9], [3.6, 0.55, 0.5], [2.52, 0.55, 0.78]], profT);
      const arrived = f >= a + 60, stand = f >= a + 56;
      const bounce = stand && f < a + 74 ? Math.abs(Math.sin((f - a - 56) * 0.32)) * 0.045 * (1 - (f - a - 56) / 18) : 0;
      out.push(RD(T, { sit: !stand, wag: q(stand ? 1 : 0.4 + profT * 0.5, 2), headDip: stand ? 0 : 0.05 }, [DOG[0], 0.55 + bounce, DOG[2]], { tint, s: 0.72, flip: true }));
      if (f >= a + 26) out.push(R(T, 'prof25', { seed: 7, expr: 'grin', L: 'hang', R: arrived ? 'reach' : 'hang', lift: arrived ? 0.4 : 0, step: arrived ? 0 : q(walk(f, a + 28, 1.25, 0.65).phase), blink: blinkAt(f, 7), bob: q(id.bob + (arrived ? 0 : 0.012), 3), tilt: q(arrived ? 9 : id.tilt * 0.4, 1), headTilt: q(arrived ? 5 : id.headTilt, 1) }, profPos, { tint, s: 0.95 }));
      const crowd = [['lady25', 41, a + 20, 44, -1.5], ['civC', 43, a + 30, 46, -1.9]];
      for (const [who, seed, st, dur, zo] of crowd) {
        if (f < st) continue; const t = ramp(f, st, st + dur); if (t >= 1) continue;
        const pos = pathPos([[6.6, 0.55, zo], [3.9, 0.55, 1.0], [0.5, 0.55, 3.15]], smooth(t));
        out.push(R(T, who, { seed, expr: 'smile', L: 'hang', R: 'hang', step: q(walk(f, st, 1.3, 0.65).phase), blink: blinkAt(f, seed), bob: q(id.bob + 0.012, 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, pos, { tint }));
      }
      break;
    }
    case 'empty': {
      const a = S.a;
      out.push(RD(T, { sit: true, wag: q(f < a + 92 ? 0.5 : 0, 2), earsDown: q(ramp(f, a + 100, a + 130), 2), headDip: q(ramp(f, a + 110, a + 150) * 0.55, 2) }, DOG, { tint, s: 0.72 }));
      out.push(staffAt(T, f, tint, f > a + 125 ? 1 : 0));
      const cross = [['civA', 51, a + 14, 42, -1.3], ['lady25', 41, a + 24, 42, -1.8], ['civB', 52, a + 34, 44, -1.1]];
      for (const [who, seed, st, dur, zo] of cross) {
        if (f < st) continue; const t = ramp(f, st, st + dur); if (t >= 1) continue;
        const pos = pathPos([[6.6, 0.55, zo], [3.9, 0.55, 1.0], [0.5, 0.55, 3.15]], smooth(t));
        out.push(R(T, who, { seed, expr: 'neutral', L: 'hang', R: 'hang', step: q(walk(f, st, 1.5, 0.65).phase), blink: blinkAt(f, seed), bob: q(id.bob + 0.012, 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, pos, { tint }));
      }
      break;
    }
    case 'seasons': {
      const idx = seasonIdx(f);
      const grey = q(lerp(0.05, 0.85, smooth(ramp(f, S.a, S.b))), 2);
      const shake = (f >= 638 && f < 654) ? q(Math.sin((f - 638) * 2.4) * 0.05 * (1 - (f - 638) / 16), 3) : 0;
      out.push(RD(T, { sit: true, grey, pant: idx === 2 ? 1 : 0, earsDown: idx === 0 ? 0.5 : 0, headDip: idx === 1 ? 0.6 : idx === 0 ? 0.3 : 0.08, wag: idx === 3 ? 0.15 : 0 }, DOG, { tint, s: 0.72, roll: shake }));
      break;
    }
    case 'kindness': {
      const a = S.a;
      out.push(RD(T, { sit: true, grey: 0.9, wag: q(f > a + 40 ? 0.35 : 0.1, 2), headDip: q(f >= a + 34 && f < a + 52 ? 0.35 : 0.1, 2) }, DOG, { tint, s: 0.72 }));
      // vendor: in with the bowl, bend, out again
      if (f >= a + 4 && f < a + 84) {
        const moving = (f >= a + 4 && f < a + 30) || (f >= a + 58 && f < a + 84);
        const pos = f < a + 30 ? pathPos([[-0.7, 0.55, 0.3], [0.5, 0.55, 1.35]], smooth(ramp(f, a + 4, a + 30)))
          : f < a + 58 ? [0.5, 0.55, 1.35] : pathPos([[0.5, 0.55, 1.35], [-0.7, 0.55, 0.3]], smooth(ramp(f, a + 58, a + 84)));
        const bend = 10 * (ramp(f, a + 30, a + 36) - ramp(f, a + 52, a + 58));
        out.push(R(T, 'vendor25', { seed: 61, expr: 'smile', L: 'hang', R: 'hang', step: moving ? q(walk(f, a + 4, 1.1, 0.62).phase) : 0, blink: blinkAt(f, 61), bob: q(id.bob + (moving ? 0.012 : 0), 3), tilt: q(bend + id.tilt * 0.3, 1), headTilt: q(bend ? 6 : id.headTilt, 1) }, pos, { tint }));
      }
      // mother + child: the child pets him
      if (f >= a + 48) {
        const mPos = pathPos([[4.6, 0.55, -0.5], [2.75, 0.55, 0.35]], smooth(ramp(f, a + 48, a + 70)));
        out.push(R(T, 'lady25', { seed: 41, expr: 'smile', L: 'hang', R: 'hang', step: f < a + 70 ? q(walk(f, a + 48, 1.1, 0.62).phase) : 0, blink: blinkAt(f, 41), bob: q(id.bob, 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(3, 1) }, mPos, { tint }));
        const kPos = pathPos([[4.4, 0.55, 0.2], [2.45, 0.55, 1.2]], smooth(ramp(f, a + 50, a + 78)));
        const kArr = f >= a + 78;
        out.push(R(T, 'civA', { seed: 71, expr: 'grin', L: 'hang', R: kArr ? 'reach' : 'hang', lift: kArr ? 0.5 : 0, step: kArr ? 0 : q(walk(f, a + 50, 1.15, 0.55).phase), blink: blinkAt(f, 71), bob: q(id.bob + (kArr ? 0 : 0.012), 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(4, 1) }, kPos, { tint, s: 0.62 }));
      }
      break;
    }
    case 'statue': {
      const a = S.a;
      out.push(RD(T, { sit: true, statue: true }, [30, 1.19, 0.8], { tint, s: 0.7, blob: false }));
      const w1 = lerp(27.3, 34.6, ramp(f, a, S.b)), w2 = lerp(26.4, 33.7, ramp(f, a + 6, S.b));
      out.push(R(T, 'civC', { seed: 61, expr: 'neutral', L: 'hang', R: 'hang', step: q(walk(f, a, 1.5, 0.7).phase), blink: blinkAt(f, 61), bob: q(id.bob + 0.012, 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [w1, 0, -1.7], { tint }));
      out.push(R(T, 'lady25', { seed: 41, expr: 'smile', L: 'hang', R: 'hang', step: q(walk(f, a + 6, 1.5, 0.7).phase), blink: blinkAt(f, 41), bob: q(id.bob + 0.012, 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(id.headTilt, 1) }, [w2, 0, -2.4], { tint }));
      if (f >= a + 24) {
        out.push(R(T, 'lady25', { seed: 43, expr: 'smile', L: 'hang', R: 'hang', blink: blinkAt(f, 43), bob: q(id.bob, 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(3, 1) }, [27.6, 0, -1.1], { tint }));
        out.push(R(T, 'civA', { seed: 71, expr: 'grin', L: 'hang', R: 'point', blink: blinkAt(f, 71), bob: q(id.bob, 3), tilt: q(id.tilt * 0.3, 1), headTilt: q(-4, 1) }, [28.7, 0, -0.35], { tint, s: 0.62 }));
      }
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const petal = (i, cx, cz, span) => { const t = ((f * 0.008 + i / 7) % 1); out.push(FX('petal' + (i % 3), (p) => T.fxLeaf(p, i % 2 ? '#e9a8c0' : '#f2c4d4'), [cx - span / 2 + t * span, 3.1 - t * 2.7, cz + (i % 4) * 0.5 - 0.7], 0.1, { roll: q(t * 9 + i, 1), alpha: 0.9 })); };
  if (S.id === 'walk') for (let i = 0; i < 7; i++) petal(i, -31, -0.5, 9);
  if (S.id === 'hook') for (let i = 0; i < 4; i++) petal(i, 1, 0.5, 6);
  if (S.id === 'seasons') {
    const idx = seasonIdx(f);
    if (idx === 0) for (let i = 0; i < 22; i++) { const y = 3.8 - ((f * 0.5 + i * 1.61) % 3.6); out.push(FX('rain' + (i % 5), (p) => p.ell(300, 470, 9, 140, '#b8cadd', 0), [0.1 + (i * 0.83) % 3.6, y, -0.9 + (i % 5) * 0.55], 0.32, { alpha: 0.7 })); }
    if (idx === 1) for (let i = 0; i < 18; i++) { const cyc = ((f * 0.055 + i * 7.7) % 4.2); out.push(FX('snow' + (i % 4), (p) => p.ell(300, 500, 17, 17, '#ffffff', 0), [0.1 + (i * 0.97) % 3.8 + Math.sin(f * 0.02 + i) * 0.2, 4.3 - cyc, -0.9 + (i % 4) * 0.6], 0.3, { alpha: 0.95 })); }
  }
  if (S.id === 'statue' && f >= S.a + 70 && f < S.a + 90) { const t = q((f - S.a - 70) / 20, 2); out.push(FX('glint' + t, (p) => T.fxStars(p, t), [29.55, 2.02, 0.7], 0.3)); }
  return out;
};
