// "अठारहवाँ घोड़ा" — Hindi trick batch 2, topic 5.
// Timed DIRECTLY to the Hindi stem (39.371 s, 30 fps, TOTAL 1181) from the
// align_hi2 word timings (horses-hindi-voice/words.json). Every shot starts
// on a clause/line boundary; every camera key lands on the word that names
// its subject. Camera Law: the camera TRACKS the voice-named subject, holds
// with a slow push-in, never freezes, never drifts aimlessly.
// Clause map (s): L1 will 0.00 (वसीयत 1.90 | सत्रह घोड़े 2.68 | आधे 3.18 |
// तिहाई 4.16 | नौवाँ 4.78) || L2 seventeen 5.90 (आधा 7.00 | तिहाई 7.60 |
// नौवाँ 8.16) || L3 fight 8.96 (झगड़ा 9.88 | चतुर हार 10.70 | बेचकर 12.86 |
// ख़त्म 14.66) || L4 qazi 15.00 (क़ाज़ी 15.74 | झगड़ा सुना 16.58 | अपना घोड़ा
// लाकर 19.18-19.82 | जोड़ दिया 20.20) || L5 eighteen 20.62 (अठारह 21.32) ||
// L6 count 21.68 (नौ 23.08 | छह 24.52 | दो 25.82) || L7 sum 26.02 (कुल सत्रह
// 26.92) || L8 happy 27.42 (ज़्यादा 28.02 | वसीयत पूरी 28.74) || L9 ride
// 30.36 (घोड़े पर 31.44 | चढ़कर 32.50) || L10 hook 33.30 (वादा 34.76 |
// गधा 35.48 | सिखा देगा 36.24 | जश्न 38.30 | क्यों 39.04)
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';
import { mul, thickAngle } from './toon.js';

export const FPS = 30, TOTAL = 1181, DECK = 0;
export const SHOTS = [
  { id: 'will', a: 0, b: 176, light: 'golden' },
  { id: 'seventeen', a: 177, b: 268, light: 'day' },
  { id: 'fight', a: 269, b: 449, light: 'golden' },
  { id: 'qazi', a: 450, b: 617, light: 'golden' },
  { id: 'eighteen', a: 618, b: 649, light: 'day' },
  { id: 'count', a: 650, b: 780, light: 'day' },
  { id: 'sum', a: 781, b: 821, light: 'day' },
  { id: 'happy', a: 822, b: 910, light: 'golden' },
  { id: 'ride', a: 911, b: 998, light: 'golden' },
  { id: 'hook', a: 999, b: 1180, light: 'day' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  golden: { az: 100, el: 21, sky: '#d9b28c', ground: '#5c5a34', hemi: 1.14, sun: '#ffb763', sunI: 2.4, fog: '#e5cf9e', fogNear: 42, fogFar: 340,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.08, vig: 0.22, shadowExt: 18, aurora: 0, gain: '#ffedd6', ...WATER },
  night: { az: 210, el: 38, sky: '#2c3a55', ground: '#1c221c', hemi: 0.62, sun: '#bcd2ff', sunI: 1.15, fog: '#1a2438', fogNear: 34, fogFar: 260,
    skyTop: '#131f38', skyHor: '#2c3c5c', sunDisc: '#dfe9ff', sunSize: 0.0022, sat: 0.94, vig: 0.32, shadowExt: 16, aurora: 0, gain: '#cfe0ff', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const FATHER = [-4.0, 0.5, 0.7];
export const PEN_A = [3.0, -2.2], PEN_B = [6.6, -2.2], PEN_C = [9.55, -2.2];
export const PLATFORM = [6.0, 0.22, 1.9];
export const QH_SPOT = [13.2, 0, 1.9];
export const HOOK_MAN = [23.426, 0, 2.523], HOOK_DONKEY = [25.1, 0, 1.5];

// the travelling pair (qazi shot): walks in from the east gate path
const qaziWalk = (f) => kf3([[520, [12.6, 0, 2.5]], [560, [8.6, 0, 2.0]], [600, [5.2, 0, 0.9]]], f);
const qHorseWalk = (f) => kf3([[520, [14.3, 0, 1.2]], [560, [10.2, 0, 1.0]], [600, [6.0, 0, -0.6]]], f);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
// ride-away: the qazi's horse leaves east along the dirt path
const rideX = (f) => 13.2 + 11.3 * smooth(ramp(f, 948, 998));
const heroPosAtInner = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'will': return [-4.0, 1.1, 0.7];
    case 'seventeen': return [5.5, 1.0, -2.5];
    case 'fight': return [0.9, 1.1, 1.9];
    case 'qazi': { const p = qaziWalk(f); return [p[0] + 0.6, 1.1, p[2]]; }
    case 'eighteen': return [6.0, 1.0, -2.0];
    case 'count': return f < 727 ? [PEN_A[0], 1.0, PEN_A[1]] : f < 769 ? [PEN_B[0], 1.0, PEN_B[1]] : [PEN_C[0], 1.0, PEN_C[1]];
    case 'sum': return [6.0, 1.2, -2.0];
    case 'happy': return [6.3, 1.1, 1.6];
    case 'ride': return [rideX(f), 1.15, 2.0];
    case 'hook': return [HOOK_MAN[0], 1.1, HOOK_MAN[2]];
    default: return [0, 1, 0];
  }
};
export const heroPosAt = heroPosAtInner;

// ---------- cameras (keys land on clause words; look = voice-named subject) ----------
const CAMS = {
  will: [
    { f: 0, pos: [2.6, 3.1, 9.6], look: [-3.8, 1.0, 0.1], fov: 50 },
    { f: 57, pos: [0.2, 1.9, 5.4], look: [-3.9, 0.95, 0.5], fov: 40, ease: 'surge' },
    { f: 95, pos: [-0.4, 1.75, 4.7], look: [-3.95, 1.0, 0.6], fov: 38, ease: 'surge' },
    { f: 143, pos: [-0.9, 1.65, 4.2], look: [-4.0, 1.05, 0.7], fov: 36, ease: 'surge' },
    { f: 176, pos: [-1.1, 1.7, 4.3], look: [-4.0, 1.05, 0.7], fov: 36 },
  ],
  seventeen: [
    { f: 177, pos: [6.0, 2.7, 10.2], look: [5.6, 1.0, -2.4], fov: 47 },
    { f: 210, pos: [4.2, 2.25, 7.8], look: [4.4, 1.05, -2.5], fov: 44, ease: 'surge' },
    { f: 228, pos: [6.0, 2.25, 7.6], look: [6.0, 1.05, -2.6], fov: 44, ease: 'surge' },
    { f: 245, pos: [7.8, 2.25, 7.4], look: [7.5, 1.05, -2.7], fov: 44, ease: 'surge' },
    { f: 268, pos: [7.4, 2.4, 7.8], look: [7.2, 1.05, -2.6], fov: 44 },
  ],
  fight: [
    { f: 269, pos: [0.9, 2.3, 8.8], look: [0.9, 1.0, 1.8], fov: 44 },
    { f: 321, pos: [0.1, 2.1, 7.9], look: [-0.6, 1.0, 1.3], fov: 42, ease: 'surge' },
    { f: 386, pos: [2.9, 2.5, 7.6], look: [4.8, 0.9, -0.8], fov: 43, ease: 'surge' },
    { f: 440, pos: [1.5, 2.1, 7.9], look: [0.9, 0.98, 1.85], fov: 41, ease: 'surge' },
    { f: 449, pos: [1.6, 2.1, 8.0], look: [1.0, 0.98, 1.85], fov: 41 },
  ],
  qazi: [
    { f: 450, pos: [8.4, 2.4, 8.4], look: [12.6, 1.1, 1.9], fov: 44 },
    { f: 497, pos: [9.6, 2.1, 6.8], look: [11.9, 1.1, 1.9], fov: 41, ease: 'surge' },
    { f: 560, pos: [6.4, 2.2, 6.6], look: [8.8, 1.05, 1.2], fov: 41, ease: 'surge' },
    { f: 600, pos: [4.8, 2.3, 6.9], look: [6.4, 1.0, 0.1], fov: 40, ease: 'surge' },
    { f: 617, pos: [4.9, 2.3, 7.0], look: [6.4, 1.0, 0.1], fov: 40 },
  ],
  eighteen: [
    { f: 618, pos: [6.0, 2.8, 10.4], look: [6.0, 1.0, -2.2], fov: 47 },
    { f: 640, pos: [6.0, 2.4, 8.6], look: [6.2, 1.0, -2.0], fov: 44, ease: 'surge' },
    { f: 649, pos: [6.0, 2.4, 8.5], look: [6.2, 1.0, -2.0], fov: 44 },
  ],
  count: [
    { f: 650, pos: [6.0, 7.6, 14.6], look: [6.0, 0.3, -2.2], fov: 56 },
    { f: 692, pos: [3.0, 3.6, 7.6], look: [3.0, 0.7, -2.4], fov: 46, ease: 'surge' },
    { f: 718, pos: [3.0, 3.6, 7.6], look: [3.0, 0.7, -2.4], fov: 46 },
    { f: 736, pos: [6.6, 3.6, 7.4], look: [6.6, 0.7, -2.5], fov: 46, ease: 'surge' },
    { f: 758, pos: [6.6, 3.6, 7.4], look: [6.6, 0.7, -2.5], fov: 46 },
    { f: 780, pos: [9.55, 3.4, 7.0], look: [9.55, 0.7, -2.5], fov: 46, ease: 'surge' },
  ],
  sum: [
    { f: 781, pos: [6.0, 6.4, 12.2], look: [6.0, 0.5, -2.0], fov: 52 },
    { f: 808, pos: [6.0, 4.2, 9.0], look: [6.0, 0.9, -1.4], fov: 46, ease: 'surge' },
    { f: 821, pos: [6.0, 4.1, 8.9], look: [6.0, 0.9, -1.4], fov: 46 },
  ],
  happy: [
    { f: 822, pos: [6.3, 3.8, 13.2], look: [6.3, 1.0, 1.45], fov: 52 },
    { f: 862, pos: [5.2, 2.7, 10.2], look: [5.6, 1.05, 1.55], fov: 47, ease: 'surge' },
    { f: 900, pos: [7.4, 2.7, 10.2], look: [7.8, 1.05, 1.55], fov: 47, ease: 'surge' },
    { f: 910, pos: [7.5, 2.7, 10.3], look: [7.8, 1.05, 1.55], fov: 47 },
  ],
  ride: [
    { f: 911, pos: [8.6, 2.2, 8.2], look: [12.9, 1.1, 2.0], fov: 43 },
    { f: 950, pos: [9.6, 2.1, 7.6], look: [13.9, 1.15, 2.0], fov: 41, ease: 'surge' },
    { f: 975, pos: [15.6, 2.2, 8.4], look: [20.4, 1.15, 2.1], fov: 41, ease: 'surge' },
    { f: 998, pos: [20.8, 2.3, 8.8], look: [25.2, 1.15, 2.2], fov: 41 },
  ],
  hook: [
    { f: 999, pos: [19.6, 2.4, 8.8], look: [24.0, 1.1, 2.2], fov: 44 },
    { f: 1064, pos: [21.4, 2.0, 7.2], look: [24.7, 0.9, 1.7], fov: 40, ease: 'surge' },
    { f: 1149, pos: [21.0, 2.1, 7.6], look: [23.7, 1.15, 2.5], fov: 40, ease: 'surge' },
    { f: 1171, pos: [21.9, 1.9, 6.5], look: [23.7, 1.15, 2.55], fov: 37, ease: 'surge' },
    { f: 1180, pos: [22.0, 1.9, 6.4], look: [23.7, 1.15, 2.55], fov: 37 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAtInner(f);
  let cinf = 4;
  if (S.id === 'will' || S.id === 'hook') cinf = 4.5;
  if (S.id === 'seventeen' || S.id === 'eighteen' || S.id === 'count' || S.id === 'sum') cinf = 0;
  if (S.id === 'happy') cinf = 3.5;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state (boards only; the farm is static) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardWill: 0, board17: 0, board18: 0, boardCount9: 0, boardCount6: 0, boardCount2: 0, boardSum: 0, boardHook: 0 };
  if (S.id === 'will') W.boardWill = smooth(ramp(f, 60, 78)) * (1 - smooth(ramp(f, 146, 162)));
  if (S.id === 'seventeen') W.board17 = smooth(ramp(f, 182, 198)) * (1 - smooth(ramp(f, 214, 230)));
  if (S.id === 'eighteen') W.board18 = smooth(ramp(f, 624, 640));
  if (S.id === 'count') { // each count board lives inside its pen's camera hold only
    W.boardCount9 = smooth(ramp(f, 684, 696)) * (1 - smooth(ramp(f, 700, 716)));
    W.boardCount6 = smooth(ramp(f, 728, 740)) * (1 - smooth(ramp(f, 742, 756)));
    W.boardCount2 = smooth(ramp(f, 772, 784));
  }
  if (S.id === 'sum') {
    W.boardSum = smooth(ramp(f, 788, 804));
  }
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1096, 1114));
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const dusty = ['seventeen', 'eighteen', 'count', 'ride', 'qazi'].includes(S.id);
  return { smokeRate: 0.25, dustRate: dusty ? 0.45 : 0.12 };
};

// ---------- the horse painter (adapted from the Seabiscuit racehorse card) ----------
const rad = (d) => d * Math.PI / 180;
const ellPts = (cx, cy, rx, ry, a0 = 0, a1 = 360, rot = 0, n = 48) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
};
const curve = (a, k, b, n = 10) => {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * k[0] + t * t * b[0], u * u * a[1] + 2 * u * t * k[1] + t * t * b[1]]); }
  return pts;
};
/** Horse — opts: gallop 0..1, step (gallop phase), blink, dark, blaze, tired, coat/mane overrides */
export const horsePainter = (p, o = {}) => {
  const light = rad(-120), thick = thickAngle(light), ow = 5.5;
  const coat = o.coat || (o.dark ? '#4e2e20' : '#7a4632'), coatDk = mul(coat, [0.66, 0.66, 0.72]), coatLt = mul(coat, [1.24, 1.2, 1.14]);
  const mane = o.mane || '#241a14', ground = 975;
  const g = o.gallop || 0, ph = (o.step || 0) * Math.PI * 2;
  const bobY = g ? Math.sin(ph * 2) * 14 - 6 : 0;
  const stretch = g ? Math.sin(ph) * 0.5 + 0.5 : 0;
  const eye = (x, y, s = 1) => {
    if (o.blink) { p.arc(x, y, 9 * s, 5.5 * s, 200, 340, 3.8 * s, '#17120e'); return; }
    p.dot(x, y, 7.6 * s, '#17120e'); p.dot(x + 2.2 * s, y - 2.6 * s, 2.4 * s, '#ffffff');
  };
  const leg = (hx, hy, a1, a2, hoof = true) => {
    const k = [hx + Math.sin(a1) * 88, hy + Math.cos(a1) * 88];
    const f = [k[0] + Math.sin(a2) * 82, k[1] + Math.cos(a2) * 82];
    p.stroke([[hx, hy], k], 15, coatDk); p.stroke([k, f], 11.5, coat);
    if (hoof) p.ell(f[0] + 5, Math.min(f[1], ground - 2), 13, 6.5, '#2e2c30', 2);
    return f;
  };
  const legPose = (front, phaseOff) => {
    if (!g) return front ? [0.06, 0.05] : [-0.05, 0.1];
    const s = Math.sin(ph + phaseOff);
    return front ? [s * 0.85, s * 0.85 + (s > 0 ? -0.5 : 0.65)] : [-s * 0.85, -s * 0.85 + (s > 0 ? 0.55 : -0.6)];
  };
  const Y = 690 + bobY;
  const tw = Math.sin(ph * 2 + 1) * (g ? 22 : 7);
  p.stroke(curve([112, Y - 66], [52, Y - 30], [40 + tw, Y + 92]), 17, mane);
  p.stroke(curve([112, Y - 60], [66, Y - 6], [64 + tw, Y + 104]), 13, mane);
  leg(168, Y + 58, ...legPose(false, 0.5));
  leg(428, Y + 58, ...legPose(true, 0.5));
  const bp = ellPts(300, Y, 196, 96, 0, 360, -0.03, 48);
  p.shadedFill(bp, coat, mul(coat, [0.8, 0.8, 0.86]), light, 172, 0.38); p.inkRing(bp, ow, thick);
  p.clip(bp, () => { p.ell(216, Y - 34, 118, 44, coatLt, 0); p.ell(404, Y + 40, 70, 40, coatDk, 0); });
  p.inkRing(bp, ow, thick);
  const tired = o.tired || 0;
  const nx = 452, ny = Y - 62 + tired * 26 - g * stretch * 6;
  const hx = 540 + g * stretch * 26, hy = Y - 128 + tired * 52 + g * (10 - stretch * 16);
  p.stroke(curve([nx - 30, ny + 30], [nx + 26, ny - 44], [hx - 52, hy + 22]), 44, coat);
  p.stroke(curve([nx - 34, ny + 36], [nx + 20, ny - 40], [hx - 56, hy + 28]), 46, mul(coat, [0.86, 0.86, 0.9]));
  p.stroke(curve([nx - 6, ny - 52], [nx + 34, ny - 66], [hx - 44, hy - 2]), 13, mane);
  for (let i = 0; i < 5; i++) { const t = i / 4, x = nx + 2 + t * (hx - nx - 40), y = ny - 56 + t * (hy - ny + 52); p.stroke([[x, y], [x - 8, y + 22]], 6, mane); }
  const hp = ellPts(hx, hy, 62, 34, 0, 360, 0.5, 36);
  p.shadedFill(hp, coat, mul(coat, [0.82, 0.82, 0.88]), light, 54, 0.35); p.inkRing(hp, ow * 0.85, thick);
  p.poly([[hx - 38, hy - 26], [hx - 20, hy - 56], [hx - 6, hy - 24]], coatDk, 3.4);
  if (o.blaze) p.poly([[hx + 16, hy - 20], [hx + 30, hy - 14], [hx + 44, hy + 16], [hx + 30, hy + 20]], '#e9e2d2', 0);
  p.ell(hx + 48, hy + 12, 8.5, 6.5, '#33231c', 2);
  eye(hx + 8, hy - 8);
  leg(150, Y + 62, ...legPose(false, 0));
  leg(446, Y + 62, ...legPose(true, 0));
  if (o.rider) { // the qazi, seated upright in robe + pagdi over the withers
    const R = o.rider, robe = R.robe, pag = R.pagdi, skin = R.skin;
    p.stroke([[322, Y - 128], [336, Y - 40]], 12, mul(robe, [0.78, 0.78, 0.84])); // far leg
    const tp = [[268, Y - 110], [334, Y - 110], [324, Y - 238], [280, Y - 242]];
    p.shadedFill(tp, robe, mul(robe, [0.78, 0.78, 0.84]), light, 92, 0.38); p.inkRing(tp, 5, thick);
    p.stroke([[318, Y - 222], [398, Y - 172]], 11, robe); // arm reaching forward
    p.stroke([[398, Y - 172], [hx - 30, hy + 30]], 2.6, '#3a3236'); // rein
    p.stroke([[302, Y - 112], [344, Y - 34]], 13, robe); // near leg
    p.ell(350, Y - 28, 13, 6, '#2e2c30', 2); // boot
    p.dot(300, Y - 272, 25, skin); // head
    p.dot(313, Y - 272, 3.2, '#17120e'); // eye
    p.ell(300, Y - 292, 36, 15, pag, 3); // pagdi dome
    p.ell(300, Y - 283, 33, 11, pag, 0);
    p.poly([[330, Y - 296], [354, Y - 270], [332, Y - 264]], pag, 3); // pagdi tail
  }
};

// ---------- actors ----------
const TINT = { day: '#ffffff', golden: '#ffd9a3', night: '#aebedd' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  father: { jacket: '#e6ddc8', pants: '#cbbfa5', boots: '#5a4632', hat: 'hair', hair: '#d8d2c4', skin: '#b57a4e' },
  son1: { jacket: '#a03c2a', pants: '#6a5138', boots: '#3a2a1a', hat: 'hair', hair: '#241c14', skin: '#c98a5a' },
  son2: { jacket: '#2a6a7a', pants: '#5d4a33', boots: '#3a2a1a', hat: 'hair', hair: '#1e1710', skin: '#b57a4e' },
  son3: { jacket: '#c9973a', pants: '#6a5138', boots: '#3a2a1a', hat: 'hair', hair: '#241c14', skin: '#d9a878' },
  qazi: { jacket: '#4a2c5a', pants: '#3a2c44', boots: '#241a2e', hat: 'cap', cap: '#e8dcc0', skin: '#c98a5a', belt: true, pagdi: '#e8dcc0' },
  elder1: { jacket: '#7a6a52', pants: '#5d4a33', boots: '#3a2a1a', hat: 'hair', hair: '#cfc8bd', skin: '#b57a4e' },
  elder2: { jacket: '#5d5a4a', pants: '#4a4238', boots: '#3a2a1a', hat: 'hair', hair: '#bfb8ac', skin: '#a06a42' },
  hookman: { jacket: '#b3542e', pants: '#6a5138', boots: '#3a2a1a', hat: 'hair', hair: '#241c14', skin: '#c98a5a' },
};
const drawFigure = (T, o, opts, extra) => (p) => {
  T.bodyFront(p, o, opts);
  if (extra.pagdi) { // wrapped pagdi over the cap: dome + wrap lines + side knot
    const cy = extra.pagdi;
    p.ell(300, cy - 2, 105, 49, o.pagdi, 6);
    p.arc(300, cy + 4, 97, 41, 195, 345, 5, '#cbbfa5');
    p.arc(300, cy - 14, 99, 44, 200, 340, 4, '#f4ecd8');
    p.dot(398, cy - 16, 15, o.pagdi);
    p.poly([[398, cy - 30], [424, cy + 26], [392, cy + 20]], o.pagdi, 4);
  }
};
const A = (T, o, opts, pos, extra = {}) => ({
  key: (extra.tag || 'fig') + JSON.stringify(o) + JSON.stringify(opts) + (extra.pagdi ? 'P' : ''),
  draw: drawFigure(T, o, opts, extra),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra.out,
});
const idleTilt = (f, seed) => q(1.5 * Math.sin(f * 0.037 + seed * 1.3), 1);
const fig = (T, tint, f, outfit, expr, pos, opts = {}, out = {}, extra = {}) =>
  A(T, outfit, { expr, mode: 'stand', blink: blinkAt(f, extra.seed || 71), seed: extra.seed || 71, headTilt: idleTilt(f, extra.seed || 71), ...opts }, pos, { ...extra, out: { tint, ...out } });
const qaziFig = (T, tint, f, expr, pos, opts = {}, out = {}) =>
  fig(T, tint, f, OUTFITS.qazi, expr, pos, opts, out, { tag: 'qaz', seed: 81, pagdi: 228 });

// horse actor helper: quantized key (redraws only on blink/phase steps)
const horse = (out, id, x, z, o = {}) => {
  const g = o.gallop || 0, step = o.step || 0;
  const key = 'horse' + id + JSON.stringify({ g: Math.round(g * 4), s: Math.round(step * 3), t: Math.round((o.tired || 0) * 3), d: o.dark || 0, b: o.blaze ? 1 : 0, bl: o.blink ? 1 : 0, r: o.rider ? 1 : 0, c: o.coat || '' });
  out.push({
    key, x, y: 0, z, s: o.s || 1.18, flip: !!o.flip, tint: o.tint || '#ffffff', blob: false, small: true,
    draw: (p) => horsePainter(p, { gallop: g, step, blink: !!o.blink, dark: o.dark || 0, blaze: o.blaze || 0, tired: o.tired || 0, coat: o.coat, mane: o.mane, rider: o.rider }),
  });
};
// loose herd of 17 in the paddock (L2/L5 framings)
const HERD17 = [
  [1.8, -1.25, 0, '#ffffff', 1.04], [3.6, -1.4, 1, '#e8d9c8', 1.09], [5.4, -1.25, 0, '#d8c2ae', 1.02], [7.2, -1.4, 0, '#ffffff', 1.07], [9.0, -1.25, 1, '#efe2d2', 1.03], [10.6, -1.4, 0, '#ffffff', 1.08],
  [2.4, -2.85, 1, '#efe2d2', 1.1], [4.3, -3.0, 0, '#ffffff', 1.04], [6.1, -2.85, 0, '#d8c2ae', 1.09], [7.9, -3.0, 1, '#ffffff', 1.02], [9.8, -2.85, 0, '#e8d9c8', 1.07], [10.7, -3.0, 0, '#ffffff', 1.05],
  [1.9, -4.3, 0, '#ffffff', 1.12], [3.9, -4.35, 1, '#e8d9c8', 1.13], [5.9, -4.3, 0, '#ffffff', 1.11], [7.9, -4.35, 0, '#efe2d2', 1.12], [9.9, -4.3, 0, '#ffffff', 1.13],
];
// the count: literal groups 9 / 6 / 2 in the three pens
const PEN9 = [[1.75, -1.35], [3.05, -1.35], [4.35, -1.35], [1.75, -2.75], [3.05, -2.75], [4.35, -2.75], [1.75, -4.1], [3.05, -4.1], [4.35, -4.1]];
const PEN6 = [[5.8, -1.6], [6.9, -1.6], [7.95, -1.6], [5.8, -3.5], [6.9, -3.5], [7.95, -3.5]];
const PEN2 = [[9.15, -2.5], [10.25, -2.5]];
const herdIn = (out, f, list, sMul = 1) => list.forEach(([hx, hz, fl, tint, s], i) => {
  horse(out, 'h' + i + '_' + hx + '_' + hz, hx, hz, { flip: !!fl, tint, s: s * sMul, dark: i % 5 === 3 ? 1 : 0, blaze: i % 6 === 2, blink: ((f + i * 23) % 89) < 3, step: (i * 37 % 10) / 10 });
});
const pensIn = (out, f) => {
  PEN9.forEach(([hx, hz], i) => horse(out, 'a' + i, hx, hz, { s: 1.05, flip: i % 3 === 1, dark: i % 5 === 3 ? 1 : 0, blaze: i % 6 === 2, tint: ['#ffffff', '#e8d9c8', '#efe2d2'][i % 3], blink: ((f + i * 23) % 89) < 3, step: (i * 37 % 10) / 10 }));
  PEN6.forEach(([hx, hz], i) => horse(out, 'b' + i, hx, hz, { s: 1.05, flip: i % 2 === 0, dark: i % 4 === 2 ? 1 : 0, tint: ['#ffffff', '#d8c2ae', '#e8d9c8'][i % 3], blink: ((f + i * 31) % 89) < 3, step: (i * 53 % 10) / 10 }));
  PEN2.forEach(([hx, hz], i) => horse(out, 'c' + i, hx, hz, { s: 1.06, flip: i === 0, dark: 0, blaze: i === 1, tint: '#ffffff', blink: ((f + i * 41) % 89) < 3, step: 0.3 }));
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const sons = (exprs, poses = {}) => {
    out.push(fig(T, tint, f, OUTFITS.son1, exprs[0], poses.s1 || [0.2, 0, 1.9], poses.o1 || {}, { yaw: 0.3 }, { tag: 's1', seed: 72 }));
    out.push(fig(T, tint, f, OUTFITS.son2, exprs[1], poses.s2 || [1.7, 0, 1.75], poses.o2 || {}, { yaw: -0.3 }, { tag: 's2', seed: 73 }));
    out.push(fig(T, tint, f, OUTFITS.son3, exprs[2], poses.s3 || [0.95, 0, 3.1], poses.o3 || {}, {}, { tag: 's3', seed: 74 }));
  };
  switch (S.id) {
    case 'will': {
      out.push(fig(T, tint, f, OUTFITS.father, 'pained', FATHER, { mode: 'sit', headTilt: q(6, 1) }, { blob: false }, { tag: 'fth', seed: 70 }));
      out.push(fig(T, tint, f, OUTFITS.son1, 'neutral', [-2.6, 0, -0.6], {}, { yaw: -0.3 }, { tag: 's1', seed: 72 }));
      out.push(fig(T, tint, f, OUTFITS.son2, 'neutral', [-5.9, 0, 0.3], {}, { yaw: 0.35 }, { tag: 's2', seed: 73 }));
      out.push(fig(T, tint, f, OUTFITS.son3, 'nervous', [-4.6, 0, -0.75], {}, { yaw: 0.05 }, { tag: 's3', seed: 74 }));
      break;
    }
    case 'seventeen': {
      herdIn(out, f, HERD17);
      break;
    }
    case 'fight': {
      herdIn(out, f, HERD17);
      const arg = (c) => q(Math.max(0, Math.sin(ramp(f, c - 14, c + 16) * Math.PI)) * 0.6, 2);
      const wv = Math.max(arg(296), arg(360), arg(415));
      sons(['stern', 'stern', 'nervous'], { o1: { wave: wv }, o2: { wave: q(wv * 0.8, 2) } });
      const shake = q(3.5 * Math.sin(f * 0.22), 1);
      out.push(fig(T, tint, f, OUTFITS.elder1, 'dazed', [-1.3, 0, 1.15], { headTilt: shake }, { yaw: 0.3 }, { tag: 'e1', seed: 75 }));
      out.push(fig(T, tint, f, OUTFITS.elder2, 'neutral', [2.95, 0, 1.05], { headTilt: q(-shake, 1) }, { yaw: -0.3 }, { tag: 'e2', seed: 76 }));
      break;
    }
    case 'qazi': {
      herdIn(out, f, HERD17);
      const walking = f >= 520 && f < 600;
      const qp = walking || f >= 600 ? qaziWalk(f) : [12.6, 0, 2.5];
      const hp = walking || f >= 600 ? qHorseWalk(f) : [14.3, 0, 1.2];
      const listen = f >= 497 && f < 520;
      out.push(qaziFig(T, tint, f, listen ? 'stern' : 'neutral', qp,
        walking ? { mode: 'march', phase: q((f * 0.09) % 1, 2) } : listen ? { headTilt: q(9, 1) } : {}, { yaw: walking ? -0.5 : -0.3 }));
      const step = walking ? q((f - 520) * 0.058, 2) : 0; // ~2.96 m/s over a 1.7 m stride — feet track the ground
      horse(out, 'qh', hp[0], hp[2], { s: 1.24, dark: 1, flip: true, gallop: walking ? 0.35 : 0, step, blink: ((f + 7) % 89) < 3, tint: '#e8ddcf' });
      sons(['stern', 'stern', 'nervous'], { s1: [-1.8, 0, 2.2], s2: [-0.4, 0, 2.0], s3: [-1.1, 0, 3.2] });
      break;
    }
    case 'eighteen': {
      herdIn(out, f, HERD17);
      horse(out, 'qh', 6.0, -0.55, { s: 1.24, dark: 1, flip: false, blink: ((f + 7) % 89) < 3, tint: '#e8ddcf' });
      break;
    }
    case 'count': {
      pensIn(out, f);
      out.push(qaziFig(T, tint, f, 'neutral', PLATFORM, { wave: f >= 688 ? 0.55 : 0 }, { yaw: 0 }));
      out.push(fig(T, tint, f, OUTFITS.son1, 'neutral', [2.6, 0, 1.7], {}, { yaw: 0.25 }, { tag: 's1', seed: 72 }));
      out.push(fig(T, tint, f, OUTFITS.son2, 'neutral', [5.0, 0, 1.85], {}, { yaw: -0.2 }, { tag: 's2', seed: 73 }));
      out.push(fig(T, tint, f, OUTFITS.son3, 'nervous', [8.6, 0, 1.7], {}, { yaw: -0.25 }, { tag: 's3', seed: 74 }));
      horse(out, 'qh', QH_SPOT[0], QH_SPOT[2], { s: 1.24, dark: 1, flip: true, blink: ((f + 7) % 89) < 3, tint: '#e8ddcf' });
      break;
    }
    case 'sum': {
      pensIn(out, f);
      out.push(qaziFig(T, tint, f, 'smile', PLATFORM, {}, { yaw: 0 }));
      out.push(fig(T, tint, f, OUTFITS.son1, 'smile', [2.6, 0, 1.7], {}, { yaw: 0.25 }, { tag: 's1', seed: 72 }));
      out.push(fig(T, tint, f, OUTFITS.son2, 'smile', [5.0, 0, 1.85], {}, { yaw: -0.2 }, { tag: 's2', seed: 73 }));
      out.push(fig(T, tint, f, OUTFITS.son3, 'smile', [8.6, 0, 1.7], {}, { yaw: -0.25 }, { tag: 's3', seed: 74 }));
      horse(out, 'qh', QH_SPOT[0], QH_SPOT[2], { s: 1.24, dark: 1, flip: true, blink: ((f + 7) % 89) < 3, tint: '#e8ddcf' });
      break;
    }
    case 'happy': {
      pensIn(out, f);
      const wv = q(Math.max(0, Math.sin(ramp(f, 845, 880) * Math.PI)) * 0.7, 2);
      out.push(fig(T, tint, f, OUTFITS.son1, 'grin', [3.0, 0, 1.65], { wave: wv }, { yaw: 0.2 }, { tag: 's1', seed: 72 }));
      out.push(fig(T, tint, f, OUTFITS.son2, 'smile', [6.6, 0, 1.65], { wave: q(wv * 0.7, 2) }, { yaw: 0 }, { tag: 's2', seed: 73 }));
      out.push(fig(T, tint, f, OUTFITS.son3, 'grin', [9.55, 0, 1.65], { wave: wv }, { yaw: -0.2 }, { tag: 's3', seed: 74 }));
      out.push(qaziFig(T, tint, f, 'smile', PLATFORM, {}, { yaw: 0 }));
      horse(out, 'qh', QH_SPOT[0], QH_SPOT[2], { s: 1.24, dark: 1, flip: true, blink: ((f + 7) % 89) < 3, tint: '#e8ddcf' });
      break;
    }
    case 'ride': {
      pensIn(out, f);
      if (f < 948) {
        horse(out, 'qh', QH_SPOT[0], QH_SPOT[2], { s: 1.24, dark: 1, flip: false, blink: ((f + 7) % 89) < 3, tint: '#e8ddcf' });
        out.push(qaziFig(T, tint, f, 'smile', [12.2, 0, 2.6], {}, { yaw: 0.4 }));
      } else {
        const step = q((f - 948) / 30 * 6.5 / 2.4, 2);
        horse(out, 'qhr', rideX(f), 2.0, { s: 1.24, dark: 1, gallop: 0.75, step, blink: ((f + 7) % 89) < 3, tint: '#e8ddcf',
          rider: { robe: '#4a2c5a', pagdi: '#e8dcc0', skin: '#c98a5a' } });
      }
      break;
    }
    case 'hook': {
      const wv = f >= 1149 ? 0.85 : 0;
      out.push(fig(T, tint, f, OUTFITS.hookman, f >= 1149 ? 'laugh' : 'grin', HOOK_MAN, { wave: wv }, { yaw: -0.2 }, { tag: 'hm', seed: 82 }));
      horse(out, 'dnk', HOOK_DONKEY[0], HOOK_DONKEY[2], { s: 0.86, coat: '#8d8578', mane: '#4a4238', tired: 0.55, flip: true, blink: ((f + 19) % 89) < 3, tint: '#e6e2da' });
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, t) => out.push({ key, draw: (p) => T.fxBurst(p, t, '#ffe066', 9, 26, 130), x, y, z, blob: false, shadow: false });
  if (f >= 638 && f <= 654) burst('b18_' + q((f - 638) / 16, 2), 6.2, 1.6, -1.6, q((f - 638) / 16, 2));
  if (f >= 692 && f <= 706) burst('b9_' + q((f - 692) / 14, 2), PEN_A[0], 1.6, PEN_A[1], q((f - 692) / 14, 2));
  if (f >= 736 && f <= 750) burst('b6_' + q((f - 736) / 14, 2), PEN_B[0], 1.6, PEN_B[1], q((f - 736) / 14, 2));
  if (f >= 774 && f <= 788) burst('b2_' + q((f - 774) / 14, 2), PEN_C[0], 1.6, PEN_C[1], q((f - 774) / 14, 2));
  if (f >= 1166 && f <= 1180) burst('bq_' + q((f - 1166) / 14, 2), HOOK_MAN[0] + 0.4, 1.7, HOOK_MAN[2], q((f - 1166) / 14, 2));
  return out;
};
