// Cut-out character parts (Ricks-Clips / flat-cartoon look): every body part is painted ONCE into its own Canvas2D
// texture (cached by key) and mounted on an alpha-tested plane by rig.tsx. Units are metres; canvas drawings use a
// y-DOWN frame whose origin is the part's pivot (anchor).
import * as THREE from 'three';
export const INK = '#241726';

// ---------- skeleton (metres, adult, before Look.scale) ----------
export const SK = {
  T: 0.18, S: 0.18, FH: 0.035,          // FACES: thigh, shin, ankle height - legs ~0.8 head heights (RC 0.6-0.9; was 0.30/0.29 = 1.3-1.6)
  HX: 0.06,                             // hip half spacing (front view; narrower body)
  NECK: 0.49, HC: 0.205,                // neck pivot above hips, head centre above neck
  SX: 0.135, SY: 0.375,                 // shoulder (front view) relative to hips (arms hug the narrower body)
  UA: 0.215, FA: 0.2,                   // upper arm, forearm (hands hang at the hip line, not the knees)
  RX: 0.258, RY: 0.252,                 // FACES: head radii - white ball, h:w ~0.96 after SHAPES (RC 0.9-1.05)
  TOP: 0.56, BOT: 0.075,                // body top above hips / bottom below hips
};
/** FACES: leg length removed vs the old rig (m) - in-car seats and props that sat on the old hip height move up/down by this */
export const LEG_DROP = 0.23;
/** ENGINE v1.1: props sized to the short-legged cast. Shopping cart scale (handle 1.0 m -> 0.65 m, just above the hips; heads stay above the basket) */
export const CART_K = 0.65;
/** FACES: every head is an unlit near-white ball (RC #fcf7f4, luma 0.97-1.0); Look.skin is kept for big bare arms only */
export const FACE = '#fdf9f6';
const OUT = 0.0135;                     // main outline width (m) ~2.8% of head width (reference 2.5-3.2%)
const INK_DX = 0.005, INK_DY = 0.007;   // SHAPE: brush weight - ink is heavier on the lower/back edge (offset ink under the fill)
const LIMB = '#3a2a2c';                 // stick limbs (reference: dark sticks + ball hands)
const LIMB_INK = 0.0105;                // limb/hand/foot outline (was 9 mm)

export type Who = 'goldman' | 'woman' | 'man' | 'grandma' | 'youngman' | 'youngwoman' | 'shopper' | 'shopper2' | 'kid' | 'magee' | 'preacher' | 'rancher' | 'cop'
  | 'nurse' | 'teacher' | 'banker' | 'oldman' | 'paperboy' | 'mechanic' | 'baker';   // + 7 added for the free kit (20 total)
export type View = 'front' | 'side' | 'back';
type HairStyle = 'part' | 'bob' | 'bun' | 'slick' | 'kid' | 'wave';
type HatKind = 'fedora' | 'cloche' | 'cap' | 'boater';
type Outfit = 'suit' | 'vest' | 'overalls' | 'dress' | 'kid';
export type Look = {
  skin: string; hair: string; hairStyle: HairStyle; hat?: HatKind; hatCol?: string; hatBand?: string;
  outfit: Outfit; main: string; second: string; accent: string; pants?: string; apron?: boolean; dots?: string; lace?: boolean;
  glasses?: boolean; mustache?: boolean; bigArms?: boolean; scale?: number; headK?: number; wide?: number; shoe?: string;
};
// 1930s Oklahoma cast, palette kept to the set's oranges / teals / creams
export const LOOKS: Record<Who, Look> = {
  goldman: {skin: '#f7e4d2', hair: '#3a2a22', hairStyle: 'part', hat: 'fedora', hatCol: '#6b5240', hatBand: '#2a1f1a', outfit: 'suit', main: '#3d4a66', second: '#f4ead6', accent: '#d0532f', pants: '#2c3449', apron: true, glasses: true, shoe: '#2a1d1a'},
  woman: {skin: '#f8e6d6', hair: '#7a3b22', hairStyle: 'bob', hat: 'cloche', hatCol: '#2f6f73', hatBand: '#f2e3c0', outfit: 'dress', main: '#d0532f', second: '#f4ead6', accent: '#7a2f1c', dots: '#f2e3c0', shoe: '#4a2418'},
  man: {skin: '#f2d6bd', hair: '#2a1f1a', hairStyle: 'part', hat: 'cap', hatCol: '#5a5866', outfit: 'overalls', main: '#ece0c6', second: '#4f7fa0', accent: '#f2b234', bigArms: true, mustache: true, wide: 1.18, shoe: '#3a2620'},
  grandma: {skin: '#f8e9dc', hair: '#dedbe4', hairStyle: 'bun', outfit: 'dress', main: '#8f6aa8', second: '#f7f0e2', accent: '#f2b234', lace: true, glasses: true, scale: 0.95, shoe: '#2a1d1a'},
  youngman: {skin: '#f0d2b6', hair: '#2a1f1a', hairStyle: 'slick', hat: 'boater', hatCol: '#e8c878', hatBand: '#d0532f', outfit: 'vest', main: '#f2b234', second: '#f4ead6', accent: '#2f6f73', pants: '#384a6b', shoe: '#3a2620'},
  youngwoman: {skin: '#fbeadb', hair: '#e0a040', hairStyle: 'wave', outfit: 'dress', main: '#3f9a8c', second: '#f4ead6', accent: '#2f6f73', dots: '#bfe3d8', scale: 0.97, shoe: '#7a3b22'},
  shopper: {skin: '#f7e4d2', hair: '#4a2a1e', hairStyle: 'bob', hat: 'cloche', hatCol: '#d0532f', hatBand: '#f2b234', outfit: 'dress', main: '#5b7fb5', second: '#f4ead6', accent: '#2c3449', dots: '#e9dcc0', shoe: '#2a1d1a'},
  shopper2: {skin: '#dcae8c', hair: '#1e1612', hairStyle: 'part', hat: 'fedora', hatCol: '#4a4a58', hatBand: '#d0532f', outfit: 'suit', main: '#a8443a', second: '#f4ead6', accent: '#2f6f73', pants: '#3a3a48', mustache: true, shoe: '#2a1d1a'},
  kid: {skin: '#f8e6d6', hair: '#7a4a2a', hairStyle: 'kid', hat: 'cap', hatCol: '#2f6f73', outfit: 'kid', main: '#f2b234', second: '#4a6a9a', accent: '#7a3b22', scale: 0.64, headK: 1.12, shoe: '#3a2620'},
  magee: {skin: '#f4dcc6', hair: '#b8b4b0', hairStyle: 'part', hat: 'fedora', hatCol: '#8a6a48', hatBand: '#3a2a1e', outfit: 'suit', main: '#6b5440', second: '#f4ead6', accent: '#b2391f', pants: '#4a3a2c', glasses: true, mustache: true, shoe: '#2a1d1a'},
  preacher: {skin: '#f2d4b8', hair: '#2a2024', hairStyle: 'part', hat: 'fedora', hatCol: '#26242c', hatBand: '#4a4650', outfit: 'suit', main: '#2b2a33', second: '#f8f4ea', accent: '#f8f4ea', pants: '#24232a', shoe: '#1a1618'},
  rancher: {skin: '#e2b48e', hair: '#6a4a2a', hairStyle: 'part', hat: 'fedora', hatCol: '#c89a5a', hatBand: '#6a3a1e', outfit: 'vest', main: '#8a5a32', second: '#e8d8b8', accent: '#b2391f', pants: '#4a5a7a', mustache: true, wide: 1.1, shoe: '#5a3a22'},
  cop: {skin: '#f0d0b2', hair: '#2a1f1a', hairStyle: 'part', hat: 'cap', hatCol: '#26324e', outfit: 'suit', main: '#2e3c62', second: '#e8eaf0', accent: '#d8b040', pants: '#26324e', mustache: true, shoe: '#16161c'},
  // ---- 7 more for the free kit ----
  nurse: {skin: '#f8e6d6', hair: '#4a2a1e', hairStyle: 'bob', hat: 'cloche', hatCol: '#f8f4ea', hatBand: '#3f9a8c', outfit: 'dress', main: '#f4f1ea', second: '#3f9a8c', accent: '#3f9a8c', shoe: '#f4f1ea'},
  teacher: {skin: '#f6e0cc', hair: '#5a3a26', hairStyle: 'bun', outfit: 'dress', main: '#e0a040', second: '#f4ead6', accent: '#7a3b22', glasses: true, shoe: '#4a2418'},
  banker: {skin: '#f0d8c2', hair: '#2a2024', hairStyle: 'slick', hat: 'fedora', hatCol: '#1e1e26', hatBand: '#6a6a78', outfit: 'suit', main: '#4a4a58', second: '#f8f4ea', accent: '#b2391f', pants: '#3a3a46', mustache: true, shoe: '#16161c'},
  oldman: {skin: '#f4dcc6', hair: '#e6e2dc', hairStyle: 'part', hat: 'cap', hatCol: '#6b5240', outfit: 'vest', main: '#8a6a48', second: '#efe2c8', accent: '#2f6f73', pants: '#5a4a3a', glasses: true, scale: 0.96, shoe: '#3a2620'},
  paperboy: {skin: '#f2d6bd', hair: '#2a1f1a', hairStyle: 'kid', hat: 'cap', hatCol: '#b2391f', outfit: 'kid', main: '#e8d8b8', second: '#5a5866', accent: '#b2391f', scale: 0.7, headK: 1.1, shoe: '#2a1d1a'},
  mechanic: {skin: '#e8c4a4', hair: '#3a2a22', hairStyle: 'part', hat: 'cap', hatCol: '#2a5f9a', outfit: 'overalls', main: '#d8d0c0', second: '#2a5f9a', accent: '#d0532f', bigArms: true, wide: 1.12, shoe: '#2a1d1a'},
  baker: {skin: '#f8e6d6', hair: '#c89a5a', hairStyle: 'wave', outfit: 'dress', main: '#d0607a', second: '#fbf3e0', accent: '#8a3a5a', apron: true, dots: '#fbf3e0', shoe: '#7a3b22'},
};

// ---------- SHAPE language per character (see review_shape/SHAPE_GUIDE.md) ----------
/** head: w/h = width/height factor, jaw = widening toward the chin (+) or egg-narrowing (-), sq = superellipse exponent (2 = ellipse,
 *  >2 = squarer jaw), sk = shear (head leans, asymmetry). body: lean = top shift (front view), belly = front bulge (side view).
 *  hat: tilt (rad, front view; + = clockwise on screen). */
type Shape = {w: number; h: number; jaw: number; sq: number; sk: number; lean: number; tilt: number};
export const SHAPES: Record<Who, Shape> = {   // FACES: all heads are balls now (h:w 0.95-1.0, sq 2.0-2.45, widest at the cheeks)
  goldman:    {w: 1.03, h: 0.97, jaw: 0.1, sq: 2.2, sk: 0.03, lean: 0.018, tilt: 0.1},       // dumpling, proud
  woman:      {w: 1.0, h: 0.98, jaw: -0.04, sq: 2.05, sk: -0.03, lean: -0.014, tilt: 0.18},  // round egg, pert cloche
  man:        {w: 1.05, h: 0.97, jaw: 0.12, sq: 2.45, sk: 0.02, lean: 0.0, tilt: -0.13},     // squarish ball, strong
  grandma:    {w: 1.02, h: 0.96, jaw: 0.14, sq: 2.05, sk: -0.02, lean: 0.022, tilt: 0.0},    // soft pear
  youngman:   {w: 1.0, h: 1.0, jaw: -0.03, sq: 2.2, sk: 0.04, lean: -0.022, tilt: -0.2},     // ball, rakish boater
  youngwoman: {w: 1.0, h: 0.99, jaw: -0.06, sq: 2.0, sk: -0.03, lean: 0.018, tilt: 0.0},     // round egg
  shopper:    {w: 1.02, h: 0.98, jaw: 0.03, sq: 2.1, sk: 0.025, lean: 0.014, tilt: -0.16},   // round
  shopper2:   {w: 1.03, h: 0.98, jaw: 0.08, sq: 2.35, sk: -0.03, lean: -0.018, tilt: 0.14},  // squarish
  kid:        {w: 1.02, h: 0.97, jaw: 0.04, sq: 2.0, sk: 0.03, lean: 0.0, tilt: -0.22},      // round, cap askew
  magee:      {w: 0.99, h: 1.0, jaw: -0.03, sq: 2.2, sk: -0.04, lean: 0.022, tilt: -0.08},   // ball, inventor
  preacher:   {w: 0.98, h: 1.0, jaw: -0.05, sq: 2.3, sk: 0.02, lean: -0.011, tilt: 0.0},     // narrowest ball, stiff
  rancher:    {w: 1.05, h: 0.97, jaw: 0.14, sq: 2.45, sk: 0.03, lean: 0.018, tilt: 0.16},    // wide square jaw
  cop:        {w: 1.03, h: 0.98, jaw: 0.1, sq: 2.35, sk: 0.0, lean: 0.0, tilt: 0.0},         // square jaw, upright
  nurse:      {w: 1.0, h: 0.98, jaw: -0.03, sq: 2.05, sk: 0.02, lean: 0.0, tilt: 0.08},
  teacher:    {w: 1.01, h: 0.98, jaw: 0.04, sq: 2.1, sk: -0.02, lean: -0.012, tilt: 0.0},
  banker:     {w: 1.02, h: 0.99, jaw: 0.08, sq: 2.35, sk: 0.02, lean: -0.02, tilt: 0.06},
  oldman:     {w: 1.02, h: 0.96, jaw: 0.1, sq: 2.15, sk: -0.03, lean: 0.03, tilt: -0.1},
  paperboy:   {w: 1.02, h: 0.97, jaw: 0.02, sq: 2.0, sk: -0.03, lean: 0.0, tilt: 0.2},
  mechanic:   {w: 1.05, h: 0.97, jaw: 0.14, sq: 2.45, sk: 0.03, lean: 0.01, tilt: -0.12},
  baker:      {w: 1.02, h: 0.97, jaw: 0.06, sq: 2.05, sk: 0.03, lean: 0.016, tilt: 0.0},
};
type Pt = [number, number];
/** filled brush stroke along a quadratic curve p0-c-p1 with width w0 -> wm (middle) -> w1 (pointed or blunt ends) */
function brush(g: G, p0: Pt, c: Pt, p1: Pt, w0: number, wm: number, w1: number, col = INK) {
  const N = 18, L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), d = t * t;
    const x = a * p0[0] + b * c[0] + d * p1[0], y = a * p0[1] + b * c[1] + d * p1[1];
    const tx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]), ty = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]), n = Math.hypot(tx, ty) || 1;
    const tp = t < 0.42 ? t / 0.42 * 0.5 : 0.5 + (t - 0.42) / 0.58 * 0.5;   // LINEWEIGHT: peak at 42 % (heavier start), long taper to the tip
    const w = (tp < 0.5 ? w0 + (wm - w0) * Math.sin(Math.PI * tp) : w1 + (wm - w1) * Math.sin(Math.PI * tp)) / 2;
    L.push([x - (ty / n) * w, y + (tx / n) * w]); R.push([x + (ty / n) * w, y - (tx / n) * w]);
  }
  g.beginPath(); g.moveTo(...L[0]); for (const p of L.slice(1)) g.lineTo(...p); for (const p of R.reverse()) g.lineTo(...p); g.closePath(); g.fillStyle = col; g.fill();
  if (w0 > 0.004) { g.beginPath(); g.arc(p0[0], p0[1], w0 / 2, 0, 7); g.fill(); }
  if (w1 > 0.004) { g.beginPath(); g.arc(p1[0], p1[1], w1 / 2, 0, 7); g.fill(); }
}
/** brush-weight outline: the ink shape shifted down/back, painted UNDER the fill -> heavier lower edge, lighter top edge */
function inkUnder(g: G, path: () => void, k = 1) { g.save(); g.translate(INK_DX * k * 0.5, INK_DY * k * 0.5); rawInk++; g.beginPath(); path(); g.lineWidth = OUT * 0.6; g.strokeStyle = INK; g.stroke(); rawInk--; g.fillStyle = INK; g.fill(); g.restore(); }
function poly(g: G, pts: Pt[]) { g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); }
/** head silhouette: superellipse with jaw widening, shear and (side view) a forward chin */
function headPts(who: Who, view: View, rx: number, ry: number): Pt[] {
  const S = SHAPES[who], out: Pt[] = [], n = S.sq, N = 72, sk = view === 'back' ? -S.sk : S.sk;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);   // y down: +1 = chin
    x *= rx * S.w * (1 + S.jaw * y); y *= ry * S.h;
    x += sk * rx * (y / ry);
    if (view === 'side') x += 0.07 * rx * Math.max(0, y / ry) * Math.max(0, c) - 0.03 * rx * Math.max(0, -y / ry);   // chin forward, skull back
    out.push([x, y]);
  }
  return out;
}
/** body silhouette ("sack"): elliptical shoulders (us), profile through the widest point, rounded or sharp hem corners (ub) */
type Sack = {t: number; m: number; my: number; b: number; us: number; ub: number; hem: number; lean: number; fr: number; bk: number};
function sackPts(top: number, bot: number, S: Sack): Pt[] {
  const N = 48, h = bot - top, side = (sgn: number): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N; let w: number;
      if (u < S.my) { const k = u / S.my; w = S.t + (S.m - S.t) * Math.sin(k * Math.PI / 2); }
      else { const k = (u - S.my) / (1 - S.my); w = S.m + (S.b - S.m) * (1 - Math.cos(k * Math.PI / 2)); }
      const rs = Math.min(S.us * h, w), rb = Math.min(S.ub * h, w);                            // circular corner radii
      if (u < S.us) w -= rs * (1 - Math.sqrt(Math.max(0, 1 - Math.pow(1 - u / S.us, 2))));     // shoulder rounding
      if (u > 1 - S.ub) w -= rb * (1 - Math.sqrt(Math.max(0, 1 - Math.pow((u - 1 + S.ub) / S.ub, 2))));   // hem corner rounding
      w = Math.max(0, w);
      const bump = Math.sin(Math.PI * Math.min(1, u / 0.95)) ** 1.5;
      w *= sgn > 0 ? 1 + S.fr * bump : 1 - S.bk * bump;                                       // front belly / flatter back
      pts.push([sgn * w + S.lean * (1 - u), top + u * h]);
    }
    return pts;
  };
  const R = side(1), Lf = side(-1).reverse(), hem: Pt[] = [];
  for (let i = 1; i < 8; i++) { const x = R[N][0] + (Lf[0][0] - R[N][0]) * (i / 8); hem.push([x, bot + S.hem * Math.sin(Math.PI * i / 8)]); }
  return [...R, ...hem, ...Lf];
}


// ---------- LINEWEIGHT: variable-width ink (see SHAPE_GUIDE "Line weight") ----------
// Every Canvas2D stroke() on a part texture is intercepted: the current path (recorded by patched path methods) is re-drawn as a filled
// ribbon whose width varies along the path. Closed outlines: heavy on the lower/left (shadow) side, thin on the upper/right (light) side,
// slow hand-drawn wobble, offset slightly outward. Open thin lines: tapered to points at both ends, belly toward the start.
let rawInk = 0;                                   // >0: strokes are used as geometry (limb sticks, ink grow) -> pass through untouched
const LIGHT: Pt = [0.5, -0.866];                  // direction TOWARDS the light (screen, y down): upper right
type SubP = {pts: Pt[]; closed: boolean};
const hash = (x: number, y: number) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
function resample(pts: Pt[], closed: boolean, step: number): Pt[] {
  const out: Pt[] = [], n = pts.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(L / step));
    for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
function inkRibbon(g: G, sp: SubP, lw: number) {
  let pts = sp.pts.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-6);
  const closed = sp.closed && pts.length > 2; if (pts.length < 2) return;
  pts = resample(pts, closed, 0.0022); const n = pts.length; if (n < 3) return;
  // arc length, tangents (window +-2), orientation
  const s: number[] = [0]; for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = s[n - 1] + (closed ? Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : 0);
  const idx = (i: number) => closed ? (i + n * 4) % n : Math.min(n - 1, Math.max(0, i));
  let area = 0; if (closed) for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = closed ? (area > 0 ? 1 : -1) : 1, ph = hash(pts[0][0], pts[0][1]) * 6.283;
  const str = Math.min(1, Math.max(0.3, (lw - 0.003) / 0.009));     // thin interior lines vary less than silhouettes
  const Lh: Pt[] = [], Rh: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[idx(i - 2)], b = pts[idx(i + 2)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nx = ty * sgn, ny = -tx * sgn;                                // outward (closed) / left (open)
    let w: number, off = 0;
    if (closed) {
      const facing = nx * LIGHT[0] + ny * LIGHT[1];                     // +1 = faces the light
      let f = 1 - 0.46 * facing + (ny > 0.75 ? 0.12 : 0);               // 0.54 (lit top-right) .. 1.58 (shadow bottom-left)
      f = 1 + (f - 1) * str;
      const u = s[i];
      f *= 1 + 0.09 * Math.sin(6.283 * u / 0.31 + ph) + 0.05 * Math.sin(6.283 * u / 0.117 + 2 * ph);
      const a2 = pts[idx(i - 5)], b2 = pts[idx(i + 5)], c1x = pts[i][0] - a2[0], c1y = pts[i][1] - a2[1], c2x = b2[0] - pts[i][0], c2y = b2[1] - pts[i][1];
      const turn = Math.abs(Math.atan2(c1x * c2y - c1y * c2x, c1x * c2x + c1y * c2y)); f *= 1 - 0.14 * Math.min(1, turn / 1.2);   // sharp corners slim down
      w = lw * 1.08 * Math.max(0.52, f); off = 0.14 * w;
    } else {
      const u = s[i] / (tot || 1), up = u < 0.4 ? u / 0.4 * 0.5 : 0.5 + (u - 0.4) / 0.6 * 0.5;
      w = lw * (0.22 + 1.0 * Math.pow(Math.sin(Math.PI * up), 0.75));  // pointed ends, belly near the start
    }
    Lh.push([pts[i][0] + nx * (off + w / 2), pts[i][1] + ny * (off + w / 2)]); Rh.push([pts[i][0] + nx * (off - w / 2), pts[i][1] + ny * (off - w / 2)]);
  }
  g.beginPath();
  if (closed) { g.moveTo(...Lh[0]); for (const p of Lh) g.lineTo(...p); g.closePath(); g.moveTo(...Rh[n - 1]); for (let i = n - 1; i >= 0; i--) g.lineTo(...Rh[i]); g.closePath(); }
  else { g.moveTo(...Lh[0]); for (const p of Lh) g.lineTo(...p); for (let i = n - 1; i >= 0; i--) g.lineTo(...Rh[i]); g.closePath(); }
  g.fillStyle = g.strokeStyle as string; g.fill('nonzero');
}
function installInk(g: any) {
  let subs: SubP[] = [], cur: SubP | null = null;
  const wrap = (name: string, fn: (...a: any[]) => void) => { const o = g[name].bind(g); g[name] = (...a: any[]) => { if (!rawInk) fn(...a); return o(...a); }; };
  const last = (): Pt => cur && cur.pts.length ? cur.pts[cur.pts.length - 1] : [0, 0];
  const add = (x: number, y: number) => { if (!cur) { cur = {pts: [], closed: false}; subs.push(cur); } cur.pts.push([x, y]); };
  wrap('beginPath', () => { subs = []; cur = null; });
  wrap('moveTo', (x, y) => { cur = {pts: [[x, y]], closed: false}; subs.push(cur); });
  wrap('lineTo', (x, y) => add(x, y));
  wrap('quadraticCurveTo', (cx, cy, x, y) => { const p = last(); for (let i = 1; i <= 14; i++) { const t = i / 14, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), d = t * t; add(a * p[0] + b * cx + d * x, a * p[1] + b * cy + d * y); } });
  wrap('bezierCurveTo', (c1x, c1y, c2x, c2y, x, y) => { const p = last(); for (let i = 1; i <= 18; i++) { const t = i / 18, u = 1 - t; add(u * u * u * p[0] + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * p[1] + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y); } });
  const arcs = (x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw: boolean) => {
    let d = a1 - a0; if (!ccw && d < 0) d = d % (2 * Math.PI) + 2 * Math.PI; if (ccw && d > 0) d = d % (2 * Math.PI) - 2 * Math.PI; if (Math.abs(d) > 2 * Math.PI) d = Math.sign(d) * 2 * Math.PI;
    const N = Math.max(8, Math.ceil(Math.abs(d) * 14)), cr = Math.cos(rot), sr = Math.sin(rot);
    const full = Math.abs(Math.abs(d) - 2 * Math.PI) < 1e-3;
    for (let i = 0; i <= N - (full ? 1 : 0); i++) { const a = a0 + d * i / N, px = Math.cos(a) * rx, py = Math.sin(a) * ry; add(x + px * cr - py * sr, y + px * sr + py * cr); }
    if (full && cur) cur.closed = true;
  };
  wrap('arc', (x, y, r, a0, a1, ccw) => arcs(x, y, r, r, 0, a0, a1, !!ccw));
  wrap('ellipse', (x, y, rx, ry, rot, a0, a1, ccw) => arcs(x, y, rx, ry, rot, a0, a1, !!ccw));
  wrap('rect', (x, y, w, h) => { cur = {pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true}; subs.push(cur); cur = null; });
  wrap('closePath', () => { if (cur) { cur.closed = true; cur = null; } });
  const orig = g.stroke.bind(g);
  g.stroke = () => {
    if (rawInk || !subs.length || g.getLineDash().length) return orig();
    const lw = g.lineWidth as number; const keep = g.fillStyle;
    const open = subs.filter((q) => !q.closed && q.pts.length > 1), thick = lw > 0.0095;
    if (open.length && thick && open.length === subs.length) return orig();       // thick open lines are geometry (straps, belts, handles)
    const snap = subs.slice(); rawInk++;
    for (const q of snap) { if (q.pts.length < 2) continue; if (!q.closed && thick) { g.beginPath(); g.moveTo(...q.pts[0]); for (const p of q.pts.slice(1)) g.lineTo(...p); g.lineWidth = lw; orig(); } else inkRibbon(g, q, lw); }
    rawInk--; g.fillStyle = keep; g.lineWidth = lw; subs = snap;
  };
}

// ---------- texture cache ----------
type G = CanvasRenderingContext2D;
export type PartTex = {key: string; tex: THREE.Texture; w: number; h: number; ax: number; ay: number};
const cache = new Map<string, PartTex>();
function mk(key: string, w: number, h: number, ax: number, ay: number, ppm: number, draw: (g: G) => void): PartTex {
  const hit = cache.get(key); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * ppm); c.height = Math.ceil(h * ppm);
  const g = c.getContext('2d')!; g.lineJoin = 'round'; g.lineCap = 'round'; installInk(g);
  g.translate(ax * ppm, ay * ppm); g.scale(ppm, ppm); draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  const p = {key, tex: t, w, h, ax, ay}; cache.set(key, p); return p;
}
const inkS = (g: G, w = OUT, col = INK) => { g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
const fillInk = (g: G, col: string, w = OUT) => { g.fillStyle = col; g.fill(); inkS(g, w); };
const SHADE = '#cfc3d6';                     // multiply colour of the single cel band (cool lilac, like the set's toon ramp)
/** single cel band: multiply the crescent that is inside `path` but outside `path` shifted by (dx, dy) */
function celBand(g: G, path: () => void, dx: number, dy: number, col = SHADE) {
  g.save(); g.beginPath(); path(); g.clip();
  g.globalCompositeOperation = 'multiply'; g.beginPath(); path(); g.translate(dx, dy); path(); g.translate(-dx, -dy);
  g.fillStyle = col; g.fill('evenodd'); g.restore();
}
const ell = (g: G, x: number, y: number, rx: number, ry: number, rot = 0) => g.ellipse(x, y, Math.max(rx, 1e-4), Math.max(ry, 1e-4), rot, 0, Math.PI * 2);
let rs = 1; const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);

// ---------- primitive shapes (limbs, hands, feet): ink layer = same shapes grown by the outline width ----------
/** c circle, k stick, e ellipse, t TAPERED stick [x0,y0,x1,y1,w0,w1] (round caps), p polygon (round joins) */
type Prim = {c?: [number, number, number]; k?: [number, number, number, number, number]; e?: [number, number, number, number, number]; t?: [number, number, number, number, number, number]; p?: Pt[]};
function prims(g: G, ps: Prim[], col: string, grow: number) {
  rawInk++; try { primsRaw(g, ps, col, grow); } finally { rawInk--; }
}
function primsRaw(g: G, ps: Prim[], col: string, grow: number) {
  g.fillStyle = col; g.strokeStyle = col;
  for (const p of ps) {
    g.beginPath();
    if (p.c) { g.arc(p.c[0], p.c[1], p.c[2] + grow, 0, Math.PI * 2); g.fill(); }
    if (p.k) { g.moveTo(p.k[0], p.k[1]); g.lineTo(p.k[2], p.k[3]); g.lineWidth = p.k[4] + 2 * grow; g.stroke(); }
    if (p.e) { ell(g, p.e[0], p.e[1], p.e[2] + grow, p.e[3] + grow, p.e[4]); g.fill(); }
    if (p.t) { const [x0, y0, x1, y1, w0, w1] = p.t, d = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / d, ny = (x1 - x0) / d, a = w0 / 2 + grow, b = w1 / 2 + grow;
      g.moveTo(x0 + nx * a, y0 + ny * a); g.lineTo(x1 + nx * b, y1 + ny * b); g.lineTo(x1 - nx * b, y1 - ny * b); g.lineTo(x0 - nx * a, y0 - ny * a); g.closePath(); g.fill();
      g.beginPath(); g.arc(x0, y0, a, 0, 7); g.fill(); g.beginPath(); g.arc(x1, y1, b, 0, 7); g.fill(); }
    if (p.p) { poly(g, p.p); g.fill(); if (grow > 0) { g.lineWidth = 2 * grow; g.lineJoin = 'round'; g.stroke(); } }
  }
}
function primTex(key: string, ps: Prim[], col: string, inkW: number, box: [number, number, number, number], ppm = 900) {
  const [x0, y0, x1, y1] = box, pad = inkW * 1.7 + 0.012;
  return {
    ink: mk(key + ':ink', x1 - x0 + 2 * pad, y1 - y0 + 2 * pad, -x0 + pad, -y0 + pad, ppm, (g) => { prims(g, ps, INK, inkW * 0.58); g.save(); g.translate(-inkW * 0.38, inkW * 0.6); prims(g, ps, INK, inkW * 0.6); g.restore(); }),   // LINEWEIGHT: upper-right 0.58 inkW, lower-left ~1.1 inkW

    fill: mk(key + ':fill', x1 - x0 + 2 * pad, y1 - y0 + 2 * pad, -x0 + pad, -y0 + pad, ppm, (g) => prims(g, ps, col, 0)),
  };
}
export type InkFill = ReturnType<typeof primTex>;

/** a limb segment hanging DOWN from its pivot (length len). kinds: arm / leg / bigU (strong upper arm) / bigF */
// SHAPE: limbs taper toward the extremity (thigh 32->28 mm, shin 28->23, upper arm 27->23, forearm 23->19); widths match at the joints
const LIMB_W: Record<string, [number, number]> = {leg: [0.032, 0.028], shin: [0.028, 0.023], arm: [0.027, 0.023], fore: [0.023, 0.019], bigU: [0.095, 0.08], bigF: [0.082, 0.062]};
export function limbTex(kind: 'arm' | 'fore' | 'leg' | 'shin' | 'bigU' | 'bigF', len: number, skin = '#f2d6bd'): InkFill {
  const [w, w1] = LIMB_W[kind];
  const col = kind === 'bigU' || kind === 'bigF' ? skin : LIMB;
  const ps: Prim[] = [{t: [0, 0, 0, len, w, w1]}];
  if (kind === 'bigU') ps.push({e: [0.012, len * 0.45, 0.058, 0.08, 0]});   // biceps bulge
  const t = primTex(`limb:${kind}:${len.toFixed(3)}:${col}`, ps, col, LIMB_INK, [-w, -w / 2, w + 0.06, len + w / 2]);
  if (kind === 'bigU') { // rolled cream sleeve over the shoulder end (drawn into the fill layer)
    const k2 = `limb:bigU:${len.toFixed(3)}:${col}:sleeve`;
    const f = t.fill; t.fill = mk(k2, f.w, f.h, f.ax, f.ay, 900, (g) => {
      prims(g, ps, col, 0);
      g.save(); g.beginPath(); g.rect(-0.08, -0.07, 0.17, 0.13); g.clip(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.lineWidth = w + 0.004; g.strokeStyle = '#ece0c6'; g.stroke();
      g.beginPath(); g.moveTo(-w / 2 - 0.004, 0.055); g.quadraticCurveTo(0, 0.07, w / 2 + 0.004, 0.055); g.lineWidth = 0.008; g.strokeStyle = INK; g.stroke(); g.restore();
    });
  }
  return t;
}
export type HandK = 'fist' | 'open' | 'point' | 'thumb';
export function handTex(kind: HandK, big = false, skin = '#f2d6bd'): InkFill {
  const r = big ? 0.048 : 0.03, col = big ? skin : LIMB;
  const ps: Prim[] = [];
  if (kind === 'fist') ps.push({c: [0, 0.008, r]});
  if (kind === 'open') ps.push({e: [0, 0.018, r * 1.05, r * 1.3, 0]}, {e: [r * 0.95, 0.0, r * 0.38, r * 0.62, -0.7]});
  if (kind === 'point') ps.push({c: [0, 0.006, r]}, {k: [0, 0.01, 0, r + 0.05, r * 0.5]});
  if (kind === 'thumb') ps.push({c: [0, 0.008, r * 1.05]}, {k: [0, 0, 0, r + 0.035, r * 0.75]});
  return primTex(`hand:${kind}:${big}:${col}`, ps, col, big ? 0.011 : LIMB_INK, [-r * 1.6, -r * 1.4, r * 1.6, r * 1.6 + 0.06]);
}
/** shoe at the ankle; side view points to +x. SHAPE: a wedge - square heel, tapered toe that tips up (was an ellipse) */
export function footTex(view: View, col: string, small = false): InkFill {
  const k = small ? 0.8 : 1;
  const ps: Prim[] = view === 'side'
    ? [{p: [[-0.03 * k, -0.002], [0.025 * k, -0.006], [0.07 * k, 0.004], [0.098 * k, 0.012 * k], [0.09 * k, 0.03 * k], [-0.026 * k, 0.03 * k], [-0.034 * k, 0.02 * k]]}, {t: [0, -0.01, 0, 0.006, 0.025, 0.025]}]
    : [{p: [[-0.024 * k, -0.002], [0.024 * k, -0.002], [0.044 * k, 0.026 * k], [0.03 * k, 0.034 * k], [-0.03 * k, 0.034 * k], [-0.044 * k, 0.026 * k]]}, {t: [0, -0.01, 0, 0.006, 0.025, 0.025]}];
  return primTex(`foot2:${view}:${col}:${k}`, ps, col, LIMB_INK, [-0.08, -0.03, 0.11, 0.05]);
}

// ---------- body (anchor = hips) ----------
function bean(g: G, wt: number, wb: number, top: number, bot: number, bulge = 1.05) {
  const h = bot - top, rt = Math.min(wt / 2, h * 0.36), rb = Math.min(wb / 2, h * 0.2);
  const mx = (Math.max(wt, wb) / 2) * bulge, my = top + h * 0.55;
  g.moveTo(0, top);
  g.bezierCurveTo(wt * 0.36, top, wt / 2, top + rt * 0.3, wt / 2, top + rt);
  g.bezierCurveTo(mx, my - h * 0.15, mx, my + h * 0.12, wb / 2, bot - rb);
  g.bezierCurveTo(wb / 2, bot - rb * 0.2, wb * 0.32, bot, 0, bot);
  g.bezierCurveTo(-wb * 0.32, bot, -wb / 2, bot - rb * 0.2, -wb / 2, bot - rb);
  g.bezierCurveTo(-mx, my + h * 0.12, -mx, my - h * 0.15, -wt / 2, top + rt);
  g.bezierCurveTo(-wt / 2, top + rt * 0.3, -wt * 0.36, top, 0, top);
  g.closePath();
}
export function bodyDims(L: Look, view: View) {
  const wd = (L.wide ?? 1) * 0.84, dress = L.outfit === 'dress';   // FACES: bodies 16 % narrower -> head ~1.15-1.25x body width
  return view === 'side' ? {wt: 0.27 * wd, wb: (dress ? 0.42 : 0.31) * wd} : {wt: 0.36 * wd, wb: (dress ? 0.52 : 0.41) * wd};
}
/** SHAPE: one silhouette family per outfit (see SHAPE_GUIDE): suit = trapezoid sack with firm shoulders and squared hem corners,
 *  dress = A-line (narrow rounded shoulders, flared sharp-cornered hem), overalls = broad barrel, vest = long capsule, kid = round pod.
 *  Side view: belly bulges forward, back is flatter. Front view: a small per-character lean (asymmetry). */
export function sackFor(who: Who, view: View): Sack {
  const L = LOOKS[who], {wt, wb} = bodyDims(L, view), side = view === 'side', ln = view === 'front' ? SHAPES[who].lean : view === 'back' ? -SHAPES[who].lean : 0.012;
  const fr = side ? 0.1 : 0, bk = side ? 0.07 : 0;
  switch (L.outfit) {
    case 'suit': return {t: wt / 2, m: wb / 2 * 1.04, my: 0.6, b: wb / 2 * 0.95, us: 0.2, ub: 0.07, hem: 0.006, lean: ln, fr, bk};
    case 'dress': return {t: wt / 2 * 0.88, m: wb / 2 * 0.98, my: 0.97, b: wb / 2, us: 0.24, ub: 0.03, hem: 0.016, lean: ln, fr: side ? 0.06 : 0, bk: side ? 0.05 : 0};
    case 'overalls': return {t: wt / 2 * 1.04, m: wb / 2 * 1.05, my: 0.45, b: wb / 2 * 0.9, us: 0.17, ub: 0.14, hem: 0.004, lean: ln, fr: side ? 0.12 : 0, bk};
    case 'vest': return {t: wt / 2 * 0.98, m: wb / 2 * 1.02, my: 0.58, b: wb / 2 * 0.9, us: 0.26, ub: 0.16, hem: 0.004, lean: ln, fr, bk};
    default: return {t: wt / 2, m: wb / 2 * 1.06, my: 0.55, b: wb / 2 * 0.88, us: 0.32, ub: 0.2, hem: 0.0, lean: ln, fr, bk};
  }
}
export function bodyTex(who: Who, view: View): PartTex {
  const L = LOOKS[who], {wt, wb} = bodyDims(L, view), top = -SK.TOP, bot = SK.BOT, W = Math.max(wt, wb) * 1.3 + 0.1;
  const pts = sackPts(top, bot, sackFor(who, view));
  return mk(`body:${who}:${view}`, W, SK.TOP + SK.BOT + 0.1, W / 2, SK.TOP + 0.04, 900, (g) => {
    const P = () => poly(g, pts);
    inkUnder(g, P);
    const side = view === 'side', back = view === 'back', fx = side ? 1 : 0; // fx: details shift to the front edge in side view
    g.beginPath(); P(); g.fillStyle = L.main; g.fill();
    g.save(); g.beginPath(); P(); g.clip();
    const thin = 0.0075;
    const lineP = (pts: [number, number][], w = thin, col = INK) => { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
    const band = (y0: number, y1: number, col: string) => { g.fillStyle = col; g.fillRect(-0.5, y0, 1, y1 - y0); lineP([[-0.5, y0], [0.5, y0]]); };
    if (L.outfit === 'suit') {
      band(bot - 0.085, bot + 0.1, L.pants!);
      if (!side && !back) lineP([[0, bot - 0.08], [0, bot]], 0.005, 'rgba(36,23,38,.5)');
      if (L.apron) { // grocer's apron over the suit
        if (back) { lineP([[-0.3, -0.2], [0.3, -0.2]], 0.02, '#efe4cc'); lineP([[-0.04, -0.2], [-0.07, -0.12]], 0.014, '#efe4cc'); lineP([[0.04, -0.2], [0.07, -0.12]], 0.014, '#efe4cc'); }
        else {
          g.beginPath(); if (side) { g.moveTo(-0.02, -0.22); g.lineTo(0.3, -0.22); g.lineTo(0.3, bot + 0.02); g.lineTo(0.0, bot + 0.02); g.closePath(); }
          else { g.moveTo(-0.15, -0.22); g.lineTo(0.15, -0.22); g.lineTo(0.17, bot - 0.005); g.quadraticCurveTo(0, bot + 0.01, -0.17, bot - 0.005); g.closePath(); }
          g.fillStyle = '#efe4cc'; g.fill(); g.lineWidth = thin; g.strokeStyle = INK; g.stroke();
          lineP([[-0.3, -0.225], [0.3, -0.225]], 0.014, '#efe4cc'); lineP([[-0.3, -0.232], [0.3, -0.232]], 0.004); lineP([[-0.3, -0.216], [0.3, -0.216]], 0.004);
          if (!side) { g.beginPath(); g.rect(-0.07, -0.15, 0.14, 0.07); g.lineWidth = 0.005; g.strokeStyle = 'rgba(36,23,38,.6)'; g.stroke(); }
        }
      }
      if (back) { lineP([[0, top + 0.06], [0, bot - 0.09]], 0.005, 'rgba(36,23,38,.45)'); g.beginPath(); g.ellipse(0, top + 0.01, 0.07, 0.035, 0, 0, Math.PI); g.fillStyle = L.second; g.fill(); }
      else {
        const cx = fx * 0.085, vw = side ? 0.04 : 0.078;
        g.beginPath(); g.moveTo(cx - vw, top + 0.015); g.lineTo(cx + (side ? 0.01 : 0), top + 0.2); g.lineTo(cx + vw + (side ? 0.06 : 0), top + 0.015); g.closePath(); fillInk(g, L.second, thin);
        // tie
        const tx = cx + (side ? 0.035 : 0);
        g.beginPath(); g.moveTo(tx - 0.02, top + 0.035); g.lineTo(tx + 0.02, top + 0.035); g.lineTo(tx + 0.013, top + 0.062); g.lineTo(tx - 0.013, top + 0.062); g.closePath(); fillInk(g, L.accent, 0.006);
        g.beginPath(); g.moveTo(tx - 0.013, top + 0.062); g.lineTo(tx - 0.027, top + 0.19); g.lineTo(tx, top + 0.225); g.lineTo(tx + 0.027, top + 0.19); g.lineTo(tx + 0.013, top + 0.062); g.closePath(); fillInk(g, L.accent, 0.006);
        lineP([[tx - 0.018, top + 0.12], [tx + 0.022, top + 0.1]], 0.006, 'rgba(255,255,255,.35)');
        // lapels + opening + buttons
        lineP([[cx - vw, top + 0.015], [cx - 0.02, top + 0.22]], thin); if (!side) lineP([[cx + vw, top + 0.015], [cx + 0.02, top + 0.22]], thin);
        if (!side) { lineP([[0, top + 0.21], [0, L.apron ? -0.22 : bot - 0.085]], 0.005, 'rgba(36,23,38,.55)'); for (const y of [top + 0.27, top + 0.36]) { g.beginPath(); g.arc(0.012, y, 0.011, 0, 7); fillInk(g, '#d9c9a8', 0.004); } }
        else for (const y of [top + 0.27, top + 0.36]) { g.beginPath(); g.arc(0.115, y, 0.01, 0, 7); fillInk(g, '#d9c9a8', 0.004); }
        if (!side) { g.beginPath(); g.moveTo(-0.13, top + 0.16); g.lineTo(-0.095, top + 0.13); g.lineTo(-0.08, top + 0.16); g.closePath(); fillInk(g, '#f4ead6', 0.004); lineP([[-0.14, top + 0.163], [-0.07, top + 0.163]], 0.005); }
      }
    } else if (L.outfit === 'vest') {
      // cream shirt, mustard sweater vest, bow tie, trousers
      g.fillStyle = L.second; g.fillRect(-0.5, top - 0.1, 1, 0.8);
      band(-0.075, bot + 0.1, L.pants!);
      g.beginPath();
      if (back) { g.rect(-0.5, top + 0.06, 1, -0.075 - top - 0.06); }
      else if (side) { g.moveTo(-0.5, top + 0.06); g.lineTo(0.06, top + 0.05); g.lineTo(0.13, top + 0.2); g.lineTo(0.5, top + 0.2); g.lineTo(0.5, -0.075); g.lineTo(-0.5, -0.075); g.closePath(); }
      else { g.moveTo(-0.5, top + 0.06); g.lineTo(-0.07, top + 0.04); g.lineTo(0, top + 0.21); g.lineTo(0.07, top + 0.04); g.lineTo(0.5, top + 0.06); g.lineTo(0.5, -0.07); g.lineTo(0.05, -0.07); g.lineTo(0, -0.04); g.lineTo(-0.05, -0.07); g.lineTo(-0.5, -0.07); g.closePath(); }
      g.fillStyle = L.main; g.fill(); g.lineWidth = thin; g.strokeStyle = INK; g.stroke();
      // knit ribbing
      g.save(); g.clip(); for (let x = -0.3; x < 0.3; x += 0.022) lineP([[x, top], [x, 0]], 0.003, 'rgba(36,23,38,.12)'); g.restore();
      if (!back) {
        const bx = side ? 0.115 : 0;
        if (!side) for (const y of [top + 0.26, top + 0.33, top + 0.4]) { g.beginPath(); g.arc(0, y, 0.009, 0, 7); fillInk(g, '#f4ead6', 0.004); }
        g.beginPath(); g.moveTo(bx, top + 0.045); g.lineTo(bx - 0.05, top + 0.02); g.lineTo(bx - 0.05, top + 0.075); g.closePath(); fillInk(g, L.accent, 0.006);
        g.beginPath(); g.moveTo(bx, top + 0.045); g.lineTo(bx + 0.05, top + 0.02); g.lineTo(bx + 0.05, top + 0.075); g.closePath(); fillInk(g, L.accent, 0.006);
        g.beginPath(); g.arc(bx, top + 0.047, 0.013, 0, 7); fillInk(g, L.accent, 0.005);
      }
      lineP([[-0.5, -0.06], [0.5, -0.06]], 0.016, '#5a3a24'); g.fillStyle = '#e8c060'; if (!back) g.fillRect((side ? 0.1 : 0) - 0.014, -0.069, 0.028, 0.018);
    } else if (L.outfit === 'overalls') {
      // collar of the work shirt
      if (!back) { g.beginPath(); const cx = side ? 0.09 : 0; g.moveTo(cx - 0.08, top + 0.01); g.lineTo(cx - 0.01, top + 0.07); g.lineTo(cx - 0.05, top + 0.09); g.closePath(); fillInk(g, '#f6eedc', 0.006);
        g.beginPath(); g.moveTo(cx + 0.08, top + 0.01); g.lineTo(cx + 0.01, top + 0.07); g.lineTo(cx + 0.05, top + 0.09); g.closePath(); fillInk(g, '#f6eedc', 0.006);
        for (const y of [top + 0.1, top + 0.15]) { g.beginPath(); g.arc(cx, y, 0.008, 0, 7); fillInk(g, '#fff', 0.004); } }
      // plaid hint
      for (let x = -0.3; x < 0.3; x += 0.06) lineP([[x, top], [x, 0]], 0.006, 'rgba(208,83,47,.22)');
      for (let y = top; y < 0; y += 0.06) lineP([[-0.3, y], [0.3, y]], 0.006, 'rgba(208,83,47,.22)');
      band(-0.17, bot + 0.1, L.second);
      const strap = (x0: number, y0: number, x1: number, y1: number) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = 0.05; g.strokeStyle = INK; g.stroke(); g.lineWidth = 0.035; g.strokeStyle = L.second; g.stroke(); };
      if (back) { strap(-0.13, top + 0.02, 0.08, -0.17); strap(0.13, top + 0.02, -0.08, -0.17); }
      else {
        const bx = side ? 0.06 : 0, bw = side ? 0.1 : 0.12;
        strap(bx - bw + 0.02, top + 0.19, side ? -0.06 : -0.14, top + 0.0); if (!side) strap(bx + bw - 0.02, top + 0.19, 0.14, top + 0.0);
        g.beginPath(); g.rect(bx - bw, top + 0.17, bw * 2 + (side ? 0.2 : 0), -0.16 - top - 0.17); fillInk(g, L.second, thin);
        g.beginPath(); g.rect(bx - 0.055, top + 0.23, 0.11, 0.08); g.setLineDash([0.008, 0.007]); g.lineWidth = 0.004; g.strokeStyle = '#e8c060'; g.stroke(); g.setLineDash([]);
        for (const x of side ? [bx - bw + 0.02] : [bx - bw + 0.02, bx + bw - 0.02]) { g.beginPath(); g.arc(x, top + 0.19, 0.014, 0, 7); fillInk(g, L.accent, 0.005); }
        if (!side) lineP([[0, -0.1], [0, bot]], 0.005, 'rgba(36,23,38,.45)');
      }
    } else if (L.outfit === 'dress') {
      if (L.dots) { g.fillStyle = L.dots; let r = 0; for (let y = top + 0.03; y < bot; y += 0.055, r++) for (let x = -0.33 + (r % 2) * 0.0325; x < 0.34; x += 0.065) { g.beginPath(); g.arc(x, y, 0.0085, 0, 7); g.fill(); } }
      // belt
      g.fillStyle = L.accent; g.fillRect(-0.5, -0.215, 1, 0.032); lineP([[-0.5, -0.215], [0.5, -0.215]], 0.006); lineP([[-0.5, -0.183], [0.5, -0.183]], 0.006);
      if (!back) { g.beginPath(); g.rect((side ? 0.1 : 0) - 0.022, -0.222, 0.044, 0.046); fillInk(g, '#f2e3c0', 0.005); }
      else { g.beginPath(); g.ellipse(-0.035, -0.2, 0.035, 0.02, 0.3, 0, 7); fillInk(g, L.accent, 0.005); g.beginPath(); g.ellipse(0.035, -0.2, 0.035, 0.02, -0.3, 0, 7); fillInk(g, L.accent, 0.005); }
      // skirt pleats + hem
      for (const x of [-0.12, -0.04, 0.04, 0.12]) lineP([[x * 0.8, -0.16], [x * 1.25, bot - 0.02]], 0.004, 'rgba(36,23,38,.28)');
      g.beginPath(); for (let x = -0.3; x <= 0.3; x += 0.03) g.lineTo(x, bot - 0.04 + Math.sin(x * 100) * 0.006); g.lineWidth = 0.005; g.strokeStyle = 'rgba(36,23,38,.4)'; g.stroke();
      // collar
      if (!back) {
        const cx = side ? 0.08 : 0;
        const petal = (s: number) => { g.beginPath(); g.moveTo(cx, top + 0.03); g.quadraticCurveTo(cx + s * 0.1, top + 0.0, cx + s * 0.11, top + 0.055); g.quadraticCurveTo(cx + s * 0.07, top + 0.11, cx, top + 0.06); g.closePath(); fillInk(g, L.second, 0.0065);
          if (L.lace) { for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(cx + s * (0.02 + k * 0.026), top + 0.085 - k * 0.006, 0.011, 0, Math.PI); g.lineWidth = 0.004; g.strokeStyle = INK; g.stroke(); } } };
        if (!side) petal(-1); petal(1);
        if (L.lace) { g.beginPath(); g.ellipse(cx + (side ? 0.03 : 0), top + 0.11, 0.022, 0.028, 0, 0, 7); fillInk(g, L.accent, 0.005); g.beginPath(); g.ellipse(cx + (side ? 0.03 : 0), top + 0.11, 0.011, 0.015, 0, 0, 7); g.fillStyle = '#fff6e0'; g.fill(); }
        else for (const y of [top + 0.13, top + 0.19, top + 0.25]) { g.beginPath(); g.arc(cx + (side ? 0.04 : 0), y, 0.009, 0, 7); fillInk(g, L.second, 0.004); }
      } else { g.beginPath(); g.ellipse(0, top + 0.02, 0.09, 0.04, 0, 0, Math.PI); fillInk(g, L.second, 0.006); }
    } else if (L.outfit === 'kid') {
      // striped shirt, shorts, suspenders
      for (let y = top + 0.04; y < -0.1; y += 0.07) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-0.5, y, 1, 0.025); }
      band(-0.12, bot + 0.1, L.second);
      const sus = (x0: number, x1: number) => { g.beginPath(); g.moveTo(x0, top); g.lineTo(x1, -0.12); g.lineWidth = 0.032; g.strokeStyle = INK; g.stroke(); g.lineWidth = 0.02; g.strokeStyle = L.accent; g.stroke(); };
      if (back) { sus(-0.12, 0.08); sus(0.12, -0.08); }
      else if (side) sus(0.0, 0.07);
      else { sus(-0.1, -0.085); sus(0.1, 0.085); for (const x of [-0.085, 0.085]) { g.beginPath(); g.arc(x, -0.12, 0.012, 0, 7); fillInk(g, '#f2e3c0', 0.004); } }
    }
    g.restore();
    celBand(g, P, 0.035, -0.02);
    g.beginPath(); P(); inkS(g);
  });
}

// ---------- head (anchor = head centre); hair painted into the head texture ----------
function hairFront(g: G, L: Look, rx: number, ry: number) {
  const st = L.hairStyle, col = L.hair;
  g.beginPath(); hairFront2(g, L, rx, ry); g.fillStyle = col; g.fill();
  const P = () => hairFront2(g, L, rx, ry);
  celBand(g, P, 0.03, 0.02, '#c9bccc'); g.beginPath(); P(); inkS(g);
  // strands
  g.lineWidth = 0.0055; g.strokeStyle = 'rgba(36,23,38,.55)';
  const SC = 'rgba(36,23,38,.55)';   // SHAPE: strands are tapered brush strokes that follow the swoop
  if (st === 'part' || st === 'slick' || st === 'kid') { brush(g, [-rx * 0.26, -ry * 0.86], [rx * 0.25, -ry * 0.82], [rx * 0.62, -ry * 0.48], 0.002, 0.009, 0.001, SC); brush(g, [-rx * 0.05, -ry * 1.0], [rx * 0.5, -ry * 0.92], [rx * 0.86, -ry * 0.55], 0.002, 0.007, 0.001, SC); }
  if (st === 'slick') { g.beginPath(); g.moveTo(-rx * 0.5, -ry * 0.85); g.quadraticCurveTo(0, -ry * 1.05, rx * 0.5, -ry * 0.88); g.lineWidth = 0.012; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke(); }
  if (st === 'bob' || st === 'wave' || st === 'bun') { brush(g, [rx * 0.22, -ry * 0.82], [-rx * 0.35, -ry * 0.75], [-rx * 0.85, -ry * 0.2], 0.002, 0.008, 0.001, SC); brush(g, [rx * 0.32, -ry * 0.8], [rx * 0.8, -ry * 0.7], [rx * 0.98, -ry * 0.15], 0.002, 0.007, 0.001, SC); }
  if (st === 'wave') { g.lineWidth = 0.007; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * rx * 1.05, -ry * 0.1); g.quadraticCurveTo(s * rx * 0.92, ry * 0.05, s * rx * 1.08, ry * 0.2); g.quadraticCurveTo(s * rx * 1.2, ry * 0.32, s * rx * 1.0, ry * 0.45); g.stroke(); } }
  if (st === 'kid') { for (const [x, a] of [[-0.3, -0.5], [0.0, 0], [0.32, 0.5]]) { g.save(); g.translate(rx * x, -ry * 1.04); g.rotate(a); g.beginPath(); g.moveTo(-0.025, 0.02); g.lineTo(0.0, -0.05); g.lineTo(0.025, 0.02); g.closePath(); fillInk(g, col, 0.009); g.restore(); } }
}
// path-only twin of hairFront (for the cel band + outline)
function hairFront2(g: G, L: Look, rx: number, ry: number) {
  const st = L.hairStyle;
  if (st === 'bob' || st === 'wave') {
    g.moveTo(-rx * 1.14, ry * 0.5); g.quadraticCurveTo(-rx * 1.24, -ry * 0.2, -rx * 1.06, -ry * 0.25);
    g.ellipse(0, -ry * 0.1, rx * 1.08, ry * 1.02, 0, Math.PI * 1.03, Math.PI * 1.97);
    g.quadraticCurveTo(rx * 1.24, -ry * 0.2, rx * 1.14, ry * 0.5); g.lineTo(rx * 1.24, ry * 0.66); g.quadraticCurveTo(rx * 0.98, ry * 0.6, rx * 0.8, ry * 0.46);
    g.quadraticCurveTo(rx * 0.84, -ry * 0.05, rx * 0.6, -ry * 0.48); g.lineTo(rx * 0.28, -ry * 0.74);   // SHAPE: side part notch + swept bang
    g.quadraticCurveTo(-rx * 0.1, -ry * 0.36, -rx * 0.68, -ry * 0.28); g.quadraticCurveTo(-rx * 0.86, -ry * 0.05, -rx * 0.8, ry * 0.46);
    g.quadraticCurveTo(-rx * 0.98, ry * 0.6, -rx * 1.24, ry * 0.66); g.lineTo(-rx * 1.14, ry * 0.5);
  } else if (st === 'bun') {
    g.moveTo(-rx * 1.0, -ry * 0.02); g.ellipse(0, -ry * 0.06, rx * 1.04, ry * 1.0, 0, Math.PI * 1.0, Math.PI * 2.0);
    g.quadraticCurveTo(rx * 0.95, -ry * 0.5, rx * 0.45, -ry * 0.55); g.quadraticCurveTo(rx * 0.12, -ry * 0.6, 0, -ry * 0.78);
    g.quadraticCurveTo(-rx * 0.12, -ry * 0.6, -rx * 0.45, -ry * 0.55); g.quadraticCurveTo(-rx * 0.95, -ry * 0.5, -rx * 1.0, -ry * 0.02);
  } else {
    // SHAPE: off-centre parting (x = -0.3 rx) with a sharp notch, a fringe that swoops to a pointed lock at the right temple,
    // a short pointed lock left of the part and pointed sideburns (was a symmetric rounded scallop)
    // FACES: under a hat the sides stop high (short pointed sideburn) -> no "wig / ear-muff" flaps below the brim
    const hi = st === 'slick' ? 0.08 : L.hat ? 0.24 : 0, k = st === 'kid' ? 1.06 : 1.03;
    g.moveTo(-rx * 1.0, ry * (0.06 - hi)); g.lineTo(-rx * k, -ry * 0.08); g.ellipse(0, -ry * 0.08, rx * k, ry * k, 0, Math.PI * 1.0, Math.PI * 2.0);
    g.lineTo(rx * 0.99, ry * (0.04 - hi)); g.quadraticCurveTo(rx * 0.9, -ry * (0.2 + hi), rx * 0.8, -ry * (0.36 + hi));
    g.quadraticCurveTo(rx * 0.35, -ry * (0.34 + hi), -rx * 0.14, -ry * (0.6 + hi));
    g.lineTo(-rx * 0.3, -ry * (0.76 + hi));
    g.quadraticCurveTo(-rx * 0.4, -ry * (0.6 + hi), -rx * 0.52, -ry * (0.47 + hi));
    g.quadraticCurveTo(-rx * 0.66, -ry * (0.62 + hi), -rx * 0.84, -ry * (0.5 + hi));
    g.quadraticCurveTo(-rx * 0.92, -ry * (0.25 + hi), -rx * 1.0, ry * (0.06 - hi));
  }
  g.closePath();
}
/** side view: hair covers top + back (face points +x); back view: hair covers everything but the nape */
function hairSideBack(g: G, L: Look, rx: number, ry: number, view: View) {
  const P = () => {
    if (view === 'back') {
      if (L.hairStyle === 'bob' || L.hairStyle === 'wave') { g.moveTo(-rx * 1.14, ry * 0.5); g.ellipse(0, -ry * 0.08, rx * 1.12, ry * 1.04, 0, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(rx * 0.5, ry * 0.42); g.lineTo(0, ry * 0.56); g.lineTo(-rx * 0.5, ry * 0.42); g.closePath(); }
      else { // FACES: RC back of head = white ball under a dark hair CAP: lower edge at ear height with a pointed nape, crown whorl
        const lo = L.hat ? 0.36 : 0.4;   // rounded hairline below the equator, short point at the nape (no up-notch -> no "mask")
        g.moveTo(-rx * 1.0, ry * lo); g.ellipse(0, -ry * 0.04, rx * 1.04, ry * 1.0, 0, Math.PI * 0.97, Math.PI * 2.03);
        g.quadraticCurveTo(rx * 0.6, ry * (lo + 0.24), rx * 0.12, ry * (lo + 0.3)); g.lineTo(0, ry * (lo + 0.38)); g.lineTo(-rx * 0.12, ry * (lo + 0.3));
        g.quadraticCurveTo(-rx * 0.6, ry * (lo + 0.24), -rx * 1.0, ry * lo); }
    } else {
      const long = L.hairStyle === 'bob' || L.hairStyle === 'wave';
      g.moveTo(rx * 0.55, -ry * 0.82);
      g.quadraticCurveTo(rx * 0.1, -ry * 0.45, -rx * 0.12, -ry * 0.2);
      g.quadraticCurveTo(-rx * 0.3, long ? ry * 0.3 : ry * 0.05, long ? -rx * 0.3 : -rx * 0.45, long ? ry * 0.7 : ry * 0.6);
      if (long) g.quadraticCurveTo(-rx * 1.1, ry * 0.75, -rx * 1.07, 0);
      else { g.lineTo(-rx * 0.86, ry * 0.56); g.quadraticCurveTo(-rx * 1.02, ry * 0.3, -rx * 1.07, 0); }   // SHAPE: pointed nape
      g.ellipse(0, -ry * 0.04, rx * 1.07, ry * 1.04, 0, Math.PI, Math.PI * 1.72);
      g.lineTo(rx * 0.9, -ry * 0.6); g.quadraticCurveTo(rx * 0.7, -ry * 0.72, rx * 0.55, -ry * 0.82);   // SHAPE: forelock tip
    }
    g.closePath();
  };
  g.beginPath(); P(); g.fillStyle = L.hair; g.fill(); celBand(g, P, 0.03, 0.02, '#c9bccc'); g.beginPath(); P(); inkS(g);
  g.lineWidth = 0.0055; g.strokeStyle = 'rgba(36,23,38,.5)';
  if (view === 'back') { brush(g, [rx * 0.05, -ry * 0.75], [-rx * 0.2, -ry * 0.55], [-rx * 0.1, -ry * 0.3], 0.002, 0.008, 0.001, 'rgba(255,255,255,.22)'); return; }   // FACES: parting/whorl highlight
  g.beginPath(); g.moveTo(-rx * 0.2, -ry * 0.8); g.quadraticCurveTo(-rx * 0.7, -ry * 0.6, -rx * 0.8, -ry * 0.1); g.stroke();
}
export function headTex(who: Who, view: View): PartTex {
  const L = LOOKS[who], k = L.headK ?? 1, rx = SK.RX * k, ry = SK.RY * k;
  return mk(`head:${who}:${view}`, rx * 2.8, ry * 3.0, rx * 1.4, ry * 1.6, 1150, (g) => {
    // hair behind the head (bun, bob volume)
    if (L.hairStyle === 'bun') { const bx = view === 'side' ? -rx * 0.75 : 0, by = view === 'side' ? -ry * 0.75 : -ry * 1.02; g.beginPath(); g.arc(bx, by, 0.075 * k, 0, 7); fillInk(g, L.hair);
      g.beginPath(); g.arc(bx, by, 0.045 * k, 0.5, 2.6); g.lineWidth = 0.005; g.strokeStyle = 'rgba(36,23,38,.5)'; g.stroke(); }
    const hp = headPts(who, view, rx, ry), P = () => poly(g, hp);
    inkUnder(g, P);
    g.beginPath(); P(); g.fillStyle = FACE; g.fill();   // FACES: near-white ball for everybody
    celBand(g, P, 0.03, -0.035, '#ebe7ee');               // FACES: barely-there cel band (RC faces stay white)
    g.beginPath(); P(); inkS(g);
    if (view === 'front') hairFront(g, L, rx, ry);
    else hairSideBack(g, L, rx, ry, view);
    if (view === 'side') { g.beginPath(); ell(g, -rx * 0.18, ry * 0.12, 0.03 * k, 0.042 * k); fillInk(g, L.skin, 0.009); g.beginPath(); g.arc(-rx * 0.18, ry * 0.12, 0.016 * k, -1.2, 1.2); g.lineWidth = 0.005; g.stroke(); }
    if (view === 'back' && L.hairStyle !== 'bob' && L.hairStyle !== 'wave') for (const sx of [-1, 1]) { g.beginPath(); ell(g, sx * rx * 1.0, ry * 0.12, 0.028 * k, 0.04 * k); fillInk(g, FACE, 0.009); }   // FACES: ears = "back of the head" cue
    if (view === 'back') { g.beginPath(); g.moveTo(-0.05, ry * 0.86); g.quadraticCurveTo(0, ry * 0.68, 0.05, ry * 0.75); g.lineWidth = 0.005; g.strokeStyle = 'rgba(36,23,38,.4)'; g.stroke(); }
  });
}
/** hats: anchor = head centre (same frame as the head texture) */
export function hatTex(who: Who, view: View): PartTex | null {
  const L = LOOKS[who]; if (!L.hat) return null;
  const k = L.headK ?? 1, rx = SK.RX * k, ry = SK.RY * k, col = L.hatCol!, band = L.hatBand ?? INK, by0 = -ry * 0.58;
  const sd = view === 'side' ? 1 : 0;
  // SHAPE: hats sit askew (front: per-character tilt; side: brim snapped down at the front), brims are lenses with pointed,
  // up-turned tips (was flat ellipses), crowns are tapered with a pinch (was rounded domes)
  const tilt = view === 'side' ? (L.hat === 'cloche' ? 0.04 : 0.07) : view === 'back' ? -SHAPES[who].tilt : SHAPES[who].tilt;
  return mk(`hat:${who}:${view}`, rx * 3.2, ry * 2.6, rx * 1.6, ry * 1.85, 1100, (g) => {
    const by = L.hat === 'cloche' ? by0 - 0.025 : L.hat === 'cap' ? by0 + 0.01 : by0;
    g.translate(0, by); g.rotate(tilt); g.translate(0, -by);
    /** brim lens: pointed tips lifted by `up`; half = front (lower) half only */
    const lens = (cx: number, hw: number, th: number, up: number, half: boolean) => {
      g.beginPath(); g.moveTo(cx - hw, by - up);
      if (!half) g.quadraticCurveTo(cx, by - th * 1.9, cx + hw, by - up); else g.quadraticCurveTo(cx, by + th * 0.1, cx + hw, by - up);
      g.quadraticCurveTo(cx, by + th * 2.1, cx - hw, by - up); g.closePath(); fillInk(g, col);
    };
    if (L.hat === 'fedora') {
      lens(sd * 0.03, rx * 1.42, 0.036, 0.03, false);
      const C = () => { g.moveTo(-rx * 0.78, by); g.lineTo(-rx * 0.68, by - 0.15); g.quadraticCurveTo(-rx * 0.56, by - 0.205, -rx * 0.22, by - 0.19); g.lineTo(-rx * 0.02, by - 0.155);
        g.lineTo(rx * 0.2, by - 0.195); g.quadraticCurveTo(rx * 0.58, by - 0.205, rx * 0.7, by - 0.15); g.lineTo(rx * 0.8, by); g.closePath(); };
      inkUnder(g, C, 0.6);
      g.beginPath(); C(); g.fillStyle = col; g.fill(); celBand(g, C, 0.04, 0.0, '#c8bccf');
      g.save(); g.beginPath(); C(); g.clip(); g.fillStyle = band; g.beginPath(); g.moveTo(-rx, by - 0.05); g.lineTo(rx, by - 0.058); g.lineTo(rx, by - 0.008); g.lineTo(-rx, by - 0.008); g.closePath(); g.fill(); g.restore();
      g.beginPath(); C(); inkS(g);
      brush(g, [-rx * 0.12, by - 0.17], [-rx * 0.06, by - 0.13], [-rx * 0.02, by - 0.11], 0.002, 0.007, 0.001);
      lens(sd * 0.03, rx * 1.42, 0.036, 0.03, true);
    } else if (L.hat === 'boater') {
      lens(sd * 0.02, rx * 1.34, 0.032, 0.012, false);
      const C = () => { g.moveTo(-rx * 0.74, by); g.lineTo(-rx * 0.66, by - 0.125); g.lineTo(rx * 0.66, by - 0.125); g.lineTo(rx * 0.74, by); g.closePath(); };
      inkUnder(g, C, 0.6);
      g.beginPath(); C(); g.fillStyle = col; g.fill(); g.save(); g.beginPath(); C(); g.clip(); g.fillStyle = band; g.fillRect(-rx, by - 0.062, rx * 2, 0.042);
      g.lineWidth = 0.004; g.strokeStyle = 'rgba(122,59,34,.45)'; for (let x = -rx * 0.7; x < rx * 0.7; x += 0.02) { g.beginPath(); g.moveTo(x, by - 0.125); g.lineTo(x + 0.01, by - 0.062); g.stroke(); } g.restore();
      g.beginPath(); C(); inkS(g); g.beginPath(); ell(g, 0, by - 0.125, rx * 0.66, 0.026); fillInk(g, col);
      lens(sd * 0.02, rx * 1.34, 0.032, 0.012, true);
    } else if (L.hat === 'cloche') {
      // bell pulled down on one side (asymmetric hem dipping toward the flower)
      const C = () => { g.moveTo(-rx * 1.12, by + 0.05); g.bezierCurveTo(-rx * 1.2, by - 0.24, rx * 1.14, by - 0.22, rx * 1.14, by + 0.09); g.lineTo(rx * 1.22, by + 0.13);
        g.quadraticCurveTo(rx * 0.3, by + 0.02, -rx * 1.0, by + 0.09); g.lineTo(-rx * 1.12, by + 0.05); g.closePath(); };
      inkUnder(g, C, 0.6);
      g.beginPath(); C(); g.fillStyle = col; g.fill(); celBand(g, C, 0.04, 0.02, '#c8bccf');
      g.save(); g.beginPath(); C(); g.clip(); g.beginPath(); g.moveTo(-rx * 1.2, by + 0.01); g.quadraticCurveTo(0, by - 0.06, rx * 1.2, by + 0.05); g.lineWidth = 0.035; g.strokeStyle = band; g.stroke(); g.restore();
      g.beginPath(); C(); inkS(g);
      const fx = sd ? -rx * 0.45 : rx * 0.62; // flower
      for (let i = 0; i < 5; i++) { const a = i * 1.2566; g.beginPath(); g.arc(fx + Math.cos(a) * 0.022, by - 0.04 + Math.sin(a) * 0.022, 0.019, 0, 7); fillInk(g, '#f2e3c0', 0.005); }
      g.beginPath(); g.arc(fx, by - 0.04, 0.014, 0, 7); fillInk(g, '#f2b234', 0.005);
    } else if (L.hat === 'cap') {
      // crown puffs forward over a pointed peak (side) / a shield-shaped peak (front)
      const C = sd ? () => { g.moveTo(-rx * 1.06, by + 0.02); g.bezierCurveTo(-rx * 1.2, by - 0.2, rx * 1.0, by - 0.23, rx * 1.22, by - 0.01); g.quadraticCurveTo(0, by + 0.05, -rx * 1.06, by + 0.02); g.closePath(); }
        : () => { g.moveTo(-rx * 1.08, by + 0.02); g.bezierCurveTo(-rx * 1.24, by - 0.17, rx * 1.1, by - 0.21, rx * 1.14, by - 0.0); g.quadraticCurveTo(0, by + 0.05, -rx * 1.08, by + 0.02); g.closePath(); };
      inkUnder(g, C, 0.6);
      g.beginPath(); C(); g.fillStyle = col; g.fill(); celBand(g, C, 0.04, 0.02, '#c8bccf');
      g.save(); g.beginPath(); C(); g.clip(); g.lineWidth = 0.004; g.strokeStyle = 'rgba(36,23,38,.35)';
      for (const a of [-0.6, -0.2, 0.2, 0.6]) { g.beginPath(); g.moveTo(sd * rx * 0.1, by - 0.13); g.lineTo(a * rx * 1.4, by + 0.03); g.stroke(); } g.restore();
      g.beginPath(); C(); inkS(g);
      g.beginPath(); g.arc(sd * rx * 0.1, by - 0.13, 0.016, 0, 7); fillInk(g, col, 0.006);
      g.beginPath();
      if (sd) { g.moveTo(rx * 0.2, by + 0.015); g.lineTo(rx * 1.5, by + 0.07); g.quadraticCurveTo(rx * 1.0, by + 0.075, rx * 0.25, by + 0.05); g.closePath(); }
      else { g.moveTo(-rx * 0.8, by + 0.02); g.quadraticCurveTo(0, by - 0.005, rx * 0.8, by + 0.02); g.lineTo(rx * 0.66, by + 0.06); g.quadraticCurveTo(0, by + 0.09, -rx * 0.66, by + 0.06); g.closePath(); }
      fillInk(g, col);
    }
  });
}

// ---------- face layers (shared by everybody; anchor = their own centre) ----------
export type Expr = 'neutral' | 'happy' | 'fake' | 'sad' | 'smirk' | 'worried' | 'surprised' | 'closed' | 'wink' | 'angry' | 'smug' | 'tired' | 'proud'
  | 'rage' | 'grin' | 'shock'   // FACES: peak-only expressions (teeth grid / big open mouth) - the defaults are small asymmetric mouths
  | 'cocky' | 'determined';   // HOOK PASS: one-brow-cocked smugness / knit-brow grit - big-read faces for hook beats
type EyeK = 'dot' | 'happy' | 'wide' | 'half' | 'closed' | 'wink' | 'tired' | 'blink' | 'lid';
type BrowK = 'flat' | 'up' | 'high' | 'worried' | 'angry' | 'smirk' | 'cocky';
export type MouthK = 'line' | 'smile' | 'grin' | 'teeth' | 'frown' | 'smirk' | 'o' | 'wavy' | 'pant' | 'grit';
// FACES: RC default = lidded deadpan eye + thick angled brow + small (10-15 % HW) asymmetric mouth; teeth grids only for rage / fake / grin
export const EXPR: Record<Expr, {e: EyeK; b: BrowK; m: MouthK}> = {
  neutral: {e: 'lid', b: 'flat', m: 'line'}, happy: {e: 'happy', b: 'up', m: 'smile'}, fake: {e: 'wide', b: 'high', m: 'teeth'},
  sad: {e: 'dot', b: 'worried', m: 'frown'}, smirk: {e: 'half', b: 'smirk', m: 'smirk'}, worried: {e: 'wide', b: 'worried', m: 'wavy'},
  surprised: {e: 'wide', b: 'high', m: 'o'}, closed: {e: 'closed', b: 'flat', m: 'smile'}, wink: {e: 'wink', b: 'smirk', m: 'smirk'},
  angry: {e: 'lid', b: 'angry', m: 'frown'}, smug: {e: 'half', b: 'smirk', m: 'smile'}, tired: {e: 'tired', b: 'worried', m: 'pant'}, proud: {e: 'lid', b: 'up', m: 'smirk'},
  rage: {e: 'dot', b: 'angry', m: 'grit'}, grin: {e: 'wide', b: 'up', m: 'grin'}, shock: {e: 'wide', b: 'high', m: 'teeth'},
  cocky: {e: 'half', b: 'cocky', m: 'smirk'}, determined: {e: 'lid', b: 'angry', m: 'grit'},
};
export type Vis = 'M' | 'A' | 'E' | 'O';
const EX = 0.075;   // eye half spacing
/** q = pupil offset step (-2..2, toward the gaze target) for eyes that have whites; black-oval eyes move as a whole (rig) */
export function eyesTex(k: EyeK, q = 0): PartTex {
  q = Math.max(-2, Math.min(2, Math.round(q))); const px = q * 0.0085;
  return mk(`eyes:${k}:${q}`, 0.32, 0.16, 0.16, 0.08, 1300, (g) => {
    for (const s of [-1, 1]) {
      const x = s * EX; let kk = k;
      if (k === 'wink') kk = s > 0 ? 'happy' : 'dot';
      g.beginPath();
      if (kk === 'dot') { ell(g, x, 0, 0.019, 0.027); g.fillStyle = INK; g.fill(); g.beginPath(); g.arc(x - 0.006, -0.01, 0.0055, 0, 7); g.fillStyle = '#fff'; g.fill(); }
      else if (kk === 'wide') { ell(g, x, 0, 0.034, 0.038); fillInk(g, '#fff', 0.008); g.beginPath(); g.arc(x + px, 0.004, 0.014, 0, 7); g.fillStyle = INK; g.fill(); g.beginPath(); g.arc(x + px - 0.004, -0.001, 0.004, 0, 7); g.fillStyle = '#fff'; g.fill(); }
      else if (kk === 'lid') { // FACES: RC deadpan - tall black oval, flat upper lid cutting across the top third, lid bar tilts down toward the nose
        g.save(); g.beginPath(); g.moveTo(x - 0.05, -0.006 + s * 0.002); g.lineTo(x + 0.05, -0.006 - s * 0.002); g.lineTo(x + 0.05, 0.06); g.lineTo(x - 0.05, 0.06); g.closePath(); g.clip();
        g.beginPath(); ell(g, x, 0.004, 0.0205, 0.03); g.fillStyle = INK; g.fill(); g.restore();
        brush(g, [x - s * 0.031, -0.0075 - 0.0005], [x, -0.0075], [x + s * 0.031, -0.0055], 0.009, 0.0095, 0.004); }
      else if (kk === 'happy') brush(g, [x - 0.026, 0.0075], [x, -0.0315], [x + 0.026, 0.0075], 0.004, 0.013, 0.004);   // SHAPE: tapered arcs
      else if (kk === 'closed') brush(g, [x - 0.0224, -0.003], [x, 0.027], [x + 0.0224, -0.003], 0.004, 0.012, 0.004);
      else if (kk === 'blink') { g.moveTo(x - 0.022, 0.004); g.quadraticCurveTo(x, 0.01, x + 0.022, 0.004); g.lineWidth = 0.01; g.strokeStyle = INK; g.stroke(); }
      else if (kk === 'half' || kk === 'tired') {
        g.ellipse(x, 0, 0.02, 0.026, 0, 0, Math.PI); g.closePath(); g.fillStyle = INK; g.fill();
        g.beginPath(); g.moveTo(x - 0.03, -0.001); g.lineTo(x + 0.03, -0.001); g.lineWidth = 0.009; g.strokeStyle = INK; g.stroke();
        if (kk === 'tired') { g.beginPath(); g.arc(x, 0.012, 0.026, Math.PI * 0.2, Math.PI * 0.8); g.lineWidth = 0.004; g.strokeStyle = 'rgba(36,23,38,.6)'; g.stroke(); }
      }
    }
  });
}
/** SHAPE: brows are wedges - thick blunt inner end (24 mm), tapering to a point outside (was a uniform 15 mm stroke) */
export function browsTex(k: BrowK): PartTex {
  return mk(`brows3:${k}`, 0.36, 0.15, 0.18, 0.075, 1300, (g) => {
    for (const s of [-1, 1]) {
      // FACES: RC brows are blunt dark slabs 4-6 % HW thick, ~23 % HW long, close to the eyes, always tilted
      const i = s * 0.022, o = s * 0.134, W0 = 0.029, WM = 0.026, W1 = 0.011;
      const b = (y0: number, cy: number, y1: number, w0 = W0) => brush(g, [i, y0], [(i + o) / 2, cy], [o, y1], w0, WM, W1);
      if (k === 'flat') b(0.01, -0.004, -0.004);
      else if (k === 'up') b(0.002, -0.026, -0.002);
      else if (k === 'high') b(-0.016, -0.044, -0.018);
      else if (k === 'worried') b(-0.024, -0.008, 0.012);
      else if (k === 'angry') b(0.022, 0.002, -0.014, 0.028);
      else if (k === 'smirk') { if (s > 0) b(-0.012, -0.042, -0.014); else b(0.012, 0.008, 0.004); }
      else if (k === 'cocky') { if (s > 0) b(-0.02, -0.048, -0.02); else b(0.02, 0.004, -0.012, 0.028); }   // one brow cocked high, the other pressed low
    }
  });
}
export function mouthTex(m: MouthK, v: Vis): PartTex {
  return mk(`mouth2:${m}:${v}`, 0.28, 0.2, 0.14, 0.08, 1300, (g) => {
    const L = 0.0095; g.strokeStyle = INK; g.lineWidth = L;
    const openD = (w: number, h: number, teeth = true) => { // open "D" mouth with tongue + top teeth
      const P = () => { g.moveTo(-w, -0.012); g.quadraticCurveTo(0, -0.022, w, -0.012); g.quadraticCurveTo(w * 0.95, h, 0, h); g.quadraticCurveTo(-w * 0.95, h, -w, -0.012); g.closePath(); };
      g.beginPath(); P(); g.fillStyle = '#6a1e2a'; g.fill();
      g.save(); g.beginPath(); P(); g.clip(); g.beginPath(); ell(g, 0, h, w * 0.65, h * 0.5); g.fillStyle = '#e8737a'; g.fill();
      if (teeth) { g.fillStyle = '#fff'; g.fillRect(-w, -0.03, w * 2, 0.026); }
      g.restore(); g.beginPath(); P(); inkS(g, L);
    };
    const teethBox = (w: number, h: number, gap: number) => { // rounded box of teeth (reference "grin")
      const P = () => { const r = Math.min(h / 2, 0.02); g.moveTo(-w + r, -h / 2); g.lineTo(w - r, -h / 2); g.quadraticCurveTo(w, -h / 2, w, -h / 2 + r); g.lineTo(w, h / 2 - r); g.quadraticCurveTo(w, h / 2, w - r, h / 2); g.lineTo(-w + r, h / 2); g.quadraticCurveTo(-w, h / 2, -w, h / 2 - r); g.lineTo(-w, -h / 2 + r); g.quadraticCurveTo(-w, -h / 2, -w + r, -h / 2); g.closePath(); };
      g.beginPath(); P(); g.fillStyle = gap > 0 ? '#6a1e2a' : '#fff'; g.fill();
      g.save(); g.beginPath(); P(); g.clip(); g.fillStyle = '#fff';
      if (gap > 0) { g.fillRect(-w, -h / 2, w * 2, (h - gap) / 2); g.fillRect(-w, gap / 2, w * 2, (h - gap) / 2); }
      g.lineWidth = 0.005; g.strokeStyle = INK; const n = Math.round(w / 0.019);
      for (let i = -n + 1; i < n; i++) { g.beginPath(); g.moveTo(i * (w / n), -h / 2); g.lineTo(i * (w / n), h / 2); g.stroke(); }
      g.beginPath(); g.moveTo(-w, gap > 0 ? -gap / 2 : 0); g.lineTo(w, gap > 0 ? -gap / 2 : 0); if (gap > 0) { g.moveTo(-w, gap / 2); g.lineTo(w, gap / 2); } g.stroke();
      g.restore(); g.beginPath(); P(); inkS(g, L);
    };
    const talkOpen = v !== 'M';
    if (m === 'teeth' || m === 'grit') {
      const w = m === 'teeth' ? 0.06 : 0.048;   // FACES: peak-only (rage / fake / shock)
      teethBox(w, v === 'A' ? 0.06 : v === 'O' ? 0.055 : 0.042, v === 'A' ? 0.022 : v === 'O' ? 0.016 : v === 'E' ? 0.008 : 0);
      if (m === 'teeth') { g.beginPath(); g.moveTo(-w - 0.012, -0.016); g.quadraticCurveTo(-w - 0.004, -0.004, -w, 0.0); g.moveTo(w + 0.012, -0.016); g.quadraticCurveTo(w + 0.004, -0.004, w, 0.0); g.lineWidth = 0.007; g.stroke(); }
      return;
    }
    if (talkOpen) {
      // FACES: talking shapes stay small (A ~14 % HW); only 'grin' opens wide
      if (v === 'A') openD(m === 'grin' ? 0.058 : 0.036, m === 'grin' ? 0.065 : 0.045, m === 'grin');
      else if (v === 'E') openD(m === 'grin' ? 0.06 : 0.038, 0.026, m === 'grin');
      else { g.beginPath(); ell(g, 0.003, 0.01, 0.019, 0.025); g.fillStyle = '#6a1e2a'; g.fill(); inkS(g, L); }
      return;
    }
    g.beginPath();
    // FACES: RC mouths are SMALL (10-15 % HW = 50-75 mm) and asymmetric - one corner higher / off-centre
    if (m === 'line') brush(g, [-0.024, 0.005], [0.004, 0.008], [0.03, -0.005], 0.004, 0.0105, 0.005);
    else if (m === 'smile') brush(g, [-0.03, -0.002], [0.0, 0.024], [0.036, -0.016], 0.004, 0.0115, 0.005);
    else if (m === 'grin') openD(0.058, 0.065);
    else if (m === 'frown') brush(g, [-0.03, 0.01], [-0.004, -0.012], [0.028, 0.018], 0.005, 0.011, 0.004);
    else if (m === 'smirk') { brush(g, [-0.026, 0.008], [0.008, 0.014], [0.036, -0.012], 0.004, 0.0105, 0.006); g.beginPath(); g.moveTo(0.032, -0.02); g.quadraticCurveTo(0.043, -0.011, 0.038, -0.003); g.lineWidth = 0.0055; g.stroke(); }
    else if (m === 'o') { ell(g, 0.004, 0.008, 0.016, 0.021); g.fillStyle = '#6a1e2a'; g.fill(); inkS(g, L); }
    else if (m === 'wavy') { g.moveTo(-0.03, 0.006); for (let i = 1; i <= 5; i++) g.lineTo(-0.03 + i * 0.0125, (i % 2 ? -0.005 : 0.005) - i * 0.0015); g.lineWidth = 0.0075; g.stroke(); }
    else if (m === 'pant') { ell(g, 0, 0.012, 0.03, 0.026); g.fillStyle = '#6a1e2a'; g.fill(); g.save(); g.clip(); g.beginPath(); ell(g, 0, 0.034, 0.02, 0.014); g.fillStyle = '#e8737a'; g.fill(); g.restore(); g.beginPath(); ell(g, 0, 0.012, 0.03, 0.026); inkS(g, L); }
  });
}
/** per-character face accessories that move with the face: glasses, mustache (anchor = head centre).
    V3: the old static blush is GONE from here — cheeks are a live layer now (cheekTex, driven by the pose). */
export function accTex(who: Who): PartTex {
  const L = LOOKS[who];
  return mk(`acc2:${who}`, 0.44, 0.32, 0.22, 0.16, 1200, (g) => {
    if (L.mustache) { const P = () => { g.moveTo(0, 0.045); g.bezierCurveTo(-0.02, 0.03, -0.065, 0.03, -0.07, 0.065); g.quadraticCurveTo(-0.035, 0.062, 0, 0.07); g.quadraticCurveTo(0.035, 0.062, 0.07, 0.065); g.bezierCurveTo(0.065, 0.03, 0.02, 0.03, 0, 0.045); g.closePath(); };
      g.beginPath(); P(); fillInk(g, L.hair === '#dedbe4' ? '#bfbac6' : L.hair, 0.007); }
    if (L.glasses) { for (const s of [-1, 1]) { g.beginPath(); g.arc(s * EX, 0.006, 0.043, 0, 7); g.lineWidth = 0.0075; g.strokeStyle = INK; g.stroke(); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(); }
      g.beginPath(); g.moveTo(-EX + 0.043, 0.001); g.quadraticCurveTo(0, -0.011, EX - 0.043, 0.001); g.lineWidth = 0.0065; g.stroke(); }
  });
}
/** V3 DYNAMIC CHEEKS — soft cheek masses whose size, height and colour swell with `amp`
    (0 = resting, 1 = full grin / loud speech). The rig feeds amp from the pose every frame:
    expression base + smoothed mouth openness while talking + step jiggle while walking.
    Quantised to 0.05 steps for the texture cache. Same frame as accTex (anchor = head centre). */
export function cheekTex(amp: number): PartTex {
  // HOOK PASS: amp may now run to 1.8 (the rig's `emo` intensity pushes past the old cap so the
  // swell READS at phone size). q <= 1 renders byte-identical to the original curve; past 1 the
  // cheek mass keeps growing / rising / saturating instead of clipping at the old ceiling.
  const q = Math.round(Math.min(1.8, Math.max(0, amp)) * 20) / 20, q1 = Math.min(q, 1), qx = Math.max(0, q - 1);
  return mk(`accCheek:${q.toFixed(2)}`, 0.44, 0.32, 0.22, 0.16, 1200, (g) => {
    for (const s of [-1, 1]) {
      const cx = s * (0.128 + 0.006 * qx), cy = 0.060 - 0.016 * q1 - 0.007 * qx;                    // cheeks RISE as they swell
      const rx = 0.028 + 0.017 * q1 + 0.015 * qx, ry = 0.016 + 0.012 * q1 + 0.011 * qx;
      g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0.5, 0, 0, rx);
      gr.addColorStop(0, `rgba(228,104,92,${0.10 + 0.30 * q1 + 0.09 * qx})`); gr.addColorStop(0.62, `rgba(230,116,100,${0.06 + 0.17 * q1 + 0.05 * qx})`); gr.addColorStop(1, 'rgba(230,116,100,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore();
      // bright core, high and toward the nose (the apple of the cheek)
      g.save(); g.translate(cx - s * 0.006, cy - 0.006); g.scale(1, 0.72);
      const gr2 = g.createRadialGradient(0, 0, 0.3, 0, 0, rx * 0.52);
      gr2.addColorStop(0, `rgba(238,128,110,${0.05 + 0.22 * q1 + 0.07 * qx})`); gr2.addColorStop(1, 'rgba(238,128,110,0)');
      g.fillStyle = gr2; g.beginPath(); g.arc(0, 0, rx * 0.52, 0, 7); g.fill(); g.restore();
      // smile crease: a faint arc from the mouth corner up to the cheek when the swell is strong
      if (q > 0.5) { g.beginPath(); g.arc(cx - s * 0.052, cy + 0.028, 0.052, s > 0 ? Math.PI * 1.08 : Math.PI * 0.62, s > 0 ? Math.PI * 1.5 : Math.PI * 1.1, s < 0); g.lineWidth = 0.0035; g.strokeStyle = `rgba(120,50,45,${0.20 * (Math.min(q, 1.5) - 0.5) * 2})`; g.stroke(); }
    }
  });
}
// ---------- props ----------
/** wicker basket hanging from the hand (anchor = top of the handle) */
export function basketTex(): PartTex {
  return mk('basket', 0.4, 0.36, 0.2, 0.03, 900, (g) => {
    g.beginPath(); g.arc(0, 0.13, 0.12, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = 0.026; g.strokeStyle = INK; g.stroke(); g.lineWidth = 0.012; g.strokeStyle = '#a8703a'; g.stroke();
    for (const [x, y, r, c] of [[-0.07, 0.115, 0.045, '#e8483a'], [0.05, 0.1, 0.05, '#f2b234'], [-0.01, 0.1, 0.04, '#7aa04a'], [0.1, 0.12, 0.035, '#d0532f']] as [number, number, number, string][]) { g.beginPath(); g.arc(x, y, r, 0, 7); fillInk(g, c, 0.008); }
    g.beginPath(); g.moveTo(-0.07, 0.07); g.lineTo(-0.06, 0.045); g.lineWidth = 0.008; g.strokeStyle = INK; g.stroke();
    const P = () => { g.moveTo(-0.16, 0.13); g.lineTo(0.16, 0.13); g.lineTo(0.13, 0.3); g.quadraticCurveTo(0, 0.315, -0.13, 0.3); g.closePath(); };
    g.beginPath(); P(); g.fillStyle = '#c8914a'; g.fill();
    g.save(); g.beginPath(); P(); g.clip(); g.lineWidth = 0.006; g.strokeStyle = 'rgba(36,23,38,.45)';
    for (let y = 0.15; y < 0.31; y += 0.03) { g.beginPath(); for (let x = -0.16; x <= 0.16; x += 0.02) g.lineTo(x, y + Math.sin(x * 160) * 0.006); g.stroke(); }
    for (let x = -0.15; x < 0.16; x += 0.04) { g.beginPath(); g.moveTo(x, 0.13); g.lineTo(x * 0.85, 0.31); g.stroke(); } g.restore();
    celBand(g, P, 0.03, -0.01);
    g.beginPath(); P(); inkS(g, 0.01);
    g.beginPath(); g.rect(-0.17, 0.12, 0.34, 0.03); fillInk(g, '#a8703a', 0.008);
  });
}
export function sweatTex(): PartTex {
  return mk('sweat', 0.07, 0.1, 0.035, 0.02, 900, (g) => {
    g.beginPath(); g.moveTo(0, -0.008); g.quadraticCurveTo(0.03, 0.035, 0.018, 0.055); g.quadraticCurveTo(0, 0.07, -0.018, 0.055); g.quadraticCurveTo(-0.03, 0.035, 0, -0.008); g.closePath(); fillInk(g, '#9fd8f0', 0.007);
    g.beginPath(); ell(g, -0.007, 0.042, 0.005, 0.009); g.fillStyle = '#fff'; g.fill();
  });
}
