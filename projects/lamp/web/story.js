// Shot plan for "The Boy Who Filled the Hall" (batch-2 topic 2, EN) —
// timed to the ACTUAL voice stem (54.65 s, 30 fps, TOTAL 1640), clause
// timings from faster-whisper alignment (match_ratio 0.974, 25 clauses):
// C1 0-18 one coin | C2 29-54 giant hall | C3 62-144 fill it, laughed |
// C4 155-190 land yours again | C5 200-253 fail = serve for life |
// C6 268-322 father lost all | C7 335-372 only chance | C8 394-428 village |
// C9 446-521 cart after cart of hay | C10 533-596 swallowed, corners empty |
// C11 609-694 cotton bales, still not full | C12 714-779 boy to market |
// C13 793-814 not hay | C14 823-843 not cotton | C15 843-914 lamp + oil |
// C16 932-1004 lit the lamp at dusk | C17 1018-1136 light ran to corners |
// C18 1150-1190 no dark spot | C19 1204-1258 hall FULL | C20 1277-1328
// spoken before the village | C21 1339-1366 land came back | C22 1384-1471
// next town, captured thief | C23 1484-1541 choose any death | C24 1554-1571
// thief smiled | C25 1591-1629 what death could he choose?
// QUALITY RULES (owner, batch-2): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat, never frozen, never
// drifting; characters act in place — travel only via foot-locked march;
// costumes by role; the lamp light is SOFT (brightest at the lamp, radial
// falloff into the corners — no hard-edged wedge, lighthouse rule).
// World: village square + hall facade x=0, hall INTERIOR x=-30,
// market x=+26, next-town court x=+52.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1640, DECK = 0;
export const SHOTS = [
  { id: 'bet', a: 0, b: 267, light: 'day' },
  { id: 'chance', a: 268, b: 445, light: 'day' },
  { id: 'hay', a: 446, b: 608, light: 'hall' },
  { id: 'cotton', a: 609, b: 713, light: 'hall' },
  { id: 'market', a: 714, b: 931, light: 'day' },
  { id: 'dusk', a: 932, b: 1017, light: 'dusk' },
  { id: 'light', a: 1018, b: 1258, light: 'lamp' },
  { id: 'land', a: 1259, b: 1383, light: 'day' },
  { id: 'hook', a: 1384, b: 1639, light: 'night' },
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
  hall: { az: 100, el: 30, sky: '#9a8a72', ground: '#4a3b2a', hemi: 0.94, sun: '#ffd9a0', sunI: 1.7, fog: '#8a7a5e', fogNear: 34, fogFar: 240,
    skyTop: '#4c4a58', skyHor: '#a08a68', sunDisc: '#ffe9c0', sunSize: 0.0024, sat: 1.04, vig: 0.3, shadowExt: 16, aurora: 0, gain: '#ffe4bb', ...WATER },
  duskIn: { az: 80, el: 12, sky: '#5e5a72', ground: '#2e2620', hemi: 0.52, sun: '#c98a5a', sunI: 0.8, fog: '#4a4238', fogNear: 26, fogFar: 170,
    skyTop: '#2c2c44', skyHor: '#7a5a44', sunDisc: '#ffb763', sunSize: 0.002, sat: 1.02, vig: 0.42, shadowExt: 14, aurora: 0, gain: '#d8c4a8', ...WATER },
  lampLit: { az: 80, el: 12, sky: '#7a6a52', ground: '#3c2e1e', hemi: 0.78, sun: '#ffb763', sunI: 0.9, fog: '#5e5040', fogNear: 30, fogFar: 200,
    skyTop: '#35354c', skyHor: '#9a7a52', sunDisc: '#ffb763', sunSize: 0.002, sat: 1.07, vig: 0.34, shadowExt: 14, aurora: 0, gain: '#ffe0ae', ...WATER },
  night: { az: 60, el: 16, sky: '#4a5570', ground: '#232028', hemi: 0.55, sun: '#ffb763', sunI: 1.1, fog: '#33323e', fogNear: 30, fogFar: 220,
    skyTop: '#1c2438', skyHor: '#5e4a3a', sunDisc: '#ffd9a0', sunSize: 0.002, sat: 1.03, vig: 0.4, shadowExt: 15, aurora: 0, gain: '#ffd9ae', ...WATER },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t);
  return o;
};
/** Lamp strength 0..1: struck ~f955, a small flame through dusk, then the
 *  C17 surge — light RUNS to the corners in about a second and settles. */
export const lampKAt = (f) => {
  if (f < 955) return 0;
  if (f < 1018) return 0.35 * smooth(ramp(f, 955, 985));
  if (f <= 1258) return lerp(0.35, 1, smooth(ramp(f, 1018, 1075)));
  return 0;
};
export const lightFor = (S, f) => {
  if (S.id === 'dusk') return blendLight(LIGHTS.day, LIGHTS.duskIn, smooth(ramp(f, 940, 1005)));
  if (S.id === 'light') return blendLight(LIGHTS.duskIn, LIGHTS.lampLit, lampKAt(f));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const BOY0 = [1.6, 0, 0.4];
export const LORD0 = [-1.8, 0, -0.9];
export const LAMPP = [-30, 0, -3.2];        // lamp spot, hall centre
export const PILEP = [-29.5, 0, -7.2];      // hay pile spot
export const STACKP = [-34.0, 0, -6.4];     // cotton stack spot (west end)
export const DOORP = [-24, 0, -9.2];        // interior door (back wall)

/** Hay carts: A rolls in, is forked empty, rolls out; B follows. Path =
 *  door (-24,-11.6) -> inside stop. Returns {A:[x,z], B:[x,z], loadA, loadB}. */
export const hayCartAt = (f) => {
  const path = (tin, tout) => {
    if (f < tin[0]) return { p: [-24, 0, -11.6], d: 0 };
    if (f < tin[1]) { const k = smooth(ramp(f, tin[0], tin[1])); return { p: lerp3([-24, 0, -11.6], [-26.8, 0, -7.2], k), d: k * 5.6 }; }
    if (f < tout[0]) return { p: [-26.8, 0, -7.2], d: 5.6 };
    if (f < tout[1]) { const k = smooth(ramp(f, tout[0], tout[1])); return { p: lerp3([-26.8, 0, -7.2], [-24, 0, -11.6], k), d: 5.6 + k * 5.6 }; }
    return { p: [-24, 0, -11.6], d: 11.2 };
  };
  const A = path([452, 492], [540, 575]);
  const B = path([498, 535], [565, 600]);
  const loadA = 1 - smooth(ramp(f, 478, 520));
  const loadB = f < 498 ? 1 : 1 - smooth(ramp(f, 520, 552));
  return { A: A.p, Ad: A.d, B: [B.p[0] + 1.9, 0, B.p[2] + 0.4], Bd: B.d, loadA, loadB };
};
/** Hay pile growth: two forked loads land (bumps at each offload). */
export const hayKAt = (f) => clamp(smooth(ramp(f, 480, 522)) * 0.55 + smooth(ramp(f, 522, 555)) * 0.45, 0, 1);
/** Cotton carriers: two men walk the SOUTH route (clear of the hay pile)
 *  from the door to the west stack, place one bale each, step back.
 *  Each entry: {p:[x,y,z], d (distance walked), moving, carrying}. */
export const carrierAt = (f) => {
  const DOOR = [-24.6, 0, -8.7], VIA = [-29.5, 0, -5.0], ROUTE = 9.7;
  const one = (place, tIn, tPlace, seedOff) => {
    if (f < tIn[0]) return { p: [...DOOR], d: 0, moving: false, carrying: true };
    if (f < tIn[1]) {
      const p = kf3([[tIn[0], DOOR], [tIn[1], place, 'smooth', [VIA]]], f);
      const d = ramp(f, tIn[0], tIn[1]) * ROUTE;
      return { p, d, moving: f > tIn[0] + 2 && f < tIn[1] - 2, carrying: true };
    }
    if (f < tPlace) return { p: [...place], d: ROUTE, moving: false, carrying: f < tPlace - 6 };
    // step back east to admire the (still small) stack
    const back = lerp3(place, [place[0] + 1.7, 0, place[2] + 0.7], smooth(ramp(f, tPlace, tPlace + 18)));
    return { p: back, d: ROUTE + ramp(f, tPlace, tPlace + 18) * 1.8, moving: f > tPlace + 1 && f < tPlace + 17, carrying: false };
  };
  return [one([-32.9, 0, -5.8], [610, 668], 682, 0), one([-32.9, 0, -7.0], [614, 672], 686, 1)];
};
/** Cotton stack count: 2 pre-stacked + 1 per placement. */
export const baleKAt = (f) => 2 + (f >= 676 ? 1 : 0) + (f >= 680 ? 1 : 0);
/** The boy's market walk + interior walk to the lamp spot. */
export const boyWalkAt = (f) => {
  if (f >= 714 && f < 765) { const k = smooth(ramp(f, 714, 765)); return { p: lerp3([16.2, 0, -0.8], [19.9, 0, -1.7], k), d: k * 3.9, moving: f > 716 && f < 763 }; }
  if (f >= 812 && f < 838) { const k = smooth(ramp(f, 812, 838)); return { p: lerp3([19.9, 0, -1.7], [23.9, 0, -1.7], k), d: 3.9 + k * 4.0, moving: true }; }
  if (f >= 843 && f < 870) { const k = smooth(ramp(f, 843, 870)); return { p: lerp3([23.9, 0, -1.7], [28.9, 0, -1.9], k), d: 7.9 + k * 5.0, moving: true }; }
  if (f >= 932 && f < 955) { const k = smooth(ramp(f, 932, 955)); return { p: lerp3([-25.3, 0, -1.6], [-29.1, 0, -2.5], k), d: k * 3.9, moving: f > 934 && f < 953 }; }
  return null;
};
export const boyPosAt = (f) => {
  const S = shotAt(f), w = boyWalkAt(f);
  if (w) return w.p;
  switch (S.id) {
    case 'bet': case 'chance': return [...BOY0];
    case 'hay': return [-35.5, 0, -1.0];
    case 'cotton': return [-27.0, 0, -0.6];
    case 'market': {
      if (f < 812) return [19.9, 0, -1.7];
      if (f < 843) return [23.9, 0, -1.7];
      return [28.9, 0, -1.9];
    }
    case 'dusk': case 'light': return [-29.1, 0, -2.5];
    case 'land': return [0.9, 0, 0.3];
    case 'hook': return [52, 0, -0.6];
    default: return [...BOY0];
  }
};

const HERO = {
  bet: (f) => {
    if (f < 29) return [1.35, 1.0, 0.55];
    if (f < 62) return lerp3([1.35, 1.0, 0.55], [0, 3.6, -8.5], smooth(ramp(f, 34, 56)));
    if (f < 155) return lerp3([0, 3.6, -8.5], [-1.8, 1.5, -0.9], smooth(ramp(f, 70, 96)));
    if (f < 200) return lerp3([-1.8, 1.5, -0.9], [0, 1.25, -0.2], smooth(ramp(f, 160, 185)));
    return [-1.8, 1.5, -0.9];
  },
  chance: (f) => f < 394 ? [1.55, 1.1, 0.55] : lerp3([1.55, 1.1, 0.55], [0.2, 1.2, 1.6], smooth(ramp(f, 398, 425))),
  hay: (f) => {
    if (f < 533) { const c = hayCartAt(f); return f < 478 ? [c.A[0], 0.9, c.A[2]] : [PILEP[0], 0.7, PILEP[2]]; }
    return lerp3([PILEP[0], 0.7, PILEP[2]], [-37.8, 0.6, -8.4], smooth(ramp(f, 560, 596)));
  },
  cotton: (f) => {
    if (f < 660) { const cs = carrierAt(f); return [(cs[0].p[0] + cs[1].p[0]) / 2, 1.1, (cs[0].p[2] + cs[1].p[2]) / 2]; }
    return [STACKP[0], 0.9, STACKP[2]];
  },
  market: (f) => {
    const bp = boyPosAt(f);
    if (f >= 870) return lerp3([bp[0], 1.05, bp[2]], [29.6, 0.95, -3.5], smooth(ramp(f, 880, 905)));
    return [bp[0], 1.05, bp[2]];
  },
  dusk: (f) => { const bp = boyPosAt(f); return lerp3([bp[0], 1.0, bp[2]], [LAMPP[0], 0.45, LAMPP[2]], smooth(ramp(f, 958, 990))); },
  light: (f) => {
    if (f < 1060) return [LAMPP[0], 0.6, LAMPP[2]];
    if (f < 1136) return lerp3([-37.6, 0.7, -8.4], [-22.8, 0.7, -8.4], smooth(ramp(f, 1065, 1130)));
    if (f < 1204) return [-30, 1.0, -4.2];
    return [-23.4, 1.25, -2.1];
  },
  land: (f) => f < 1339 ? [-0.9, 1.35, -0.5] : [0.05, 1.1, 0.1],
  hook: (f) => {
    if (f < 1484) return [51.9, 1.3, -3.2];
    if (f < 1554) return [51.9, 1.55, -4.4];
    return [52, 1.15, -0.6];
  },
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// at each clause boundary and settles into a slow push-in on it.
const CAMS = {
  bet: [
    { f: 0, pos: [3.1, 1.35, 3.4], look: [1.42, 1.02, 0.5], fov: 34 },
    { f: 29, pos: [2.9, 1.6, 4.1], look: [1.2, 1.3, -0.6], fov: 37, ease: 'surge' },
    { f: 56, pos: [1.2, 2.6, 8.5], look: [0, 3.6, -8.5], fov: 46, ease: 'surge' },
    { f: 96, pos: [2.2, 1.7, 3.4], look: [-1.6, 1.45, -0.8], fov: 38, ease: 'surge' },
    { f: 144, pos: [1.8, 1.62, 2.9], look: [-1.75, 1.42, -0.88], fov: 36 },
    { f: 190, pos: [2.6, 1.6, 3.9], look: [0, 1.25, -0.2], fov: 40, ease: 'surge' },
    { f: 225, pos: [0.9, 1.55, 2.2], look: [-1.8, 1.45, -0.9], fov: 34, ease: 'surge' },
    { f: 267, pos: [0.6, 1.5, 1.9], look: [-1.82, 1.44, -0.9], fov: 33 },
  ],
  chance: [
    { f: 268, pos: [0.6, 1.5, 1.9], look: [-1.82, 1.44, -0.9], fov: 33 },
    { f: 300, pos: [3.3, 1.5, 3.1], look: [1.55, 1.15, 0.5], fov: 36, ease: 'surge' },
    { f: 330, pos: [3.0, 1.45, 2.8], look: [1.58, 1.12, 0.55], fov: 35 },
    { f: 372, pos: [2.7, 1.42, 2.5], look: [1.6, 1.14, 0.55], fov: 34, ease: 'surge' },
    { f: 410, pos: [5.2, 2.3, 6.8], look: [0.2, 1.2, 0.2], fov: 44, ease: 'surge' },
    { f: 445, pos: [5.6, 2.4, 7.4], look: [0, 1.25, 0], fov: 45 },
  ],
  hay: [
    { f: 446, pos: [5.6, 2.4, 7.4], look: [0, 1.25, 0], fov: 45 },
    { f: 470, pos: [-6, 3.0, 8.8], look: [-22, 1.2, -5.5], fov: 46, ease: 'surge' },
    { f: 498, pos: [-18.5, 2.4, 4.4], look: [-25.8, 1.1, -7.2], fov: 42, ease: 'surge' },
    { f: 512, pos: [-19.5, 2.2, 3.4], look: [-25.5, 1.2, -7.6], fov: 42, ease: 'surge' },
    { f: 545, pos: [-21.8, 2.0, 2.2], look: [-28, 0.9, -6.9], fov: 40, ease: 'surge' },
    { f: 575, pos: [-24, 1.9, 1.4], look: [-30, 0.8, -7], fov: 40 },
    { f: 596, pos: [-30.5, 1.8, 2.8], look: [-37.6, 0.7, -8.2], fov: 38, ease: 'surge' },
    { f: 608, pos: [-31, 1.8, 2.6], look: [-37.8, 0.65, -8.4], fov: 37 },
  ],
  cotton: [
    { f: 609, pos: [-31, 1.8, 2.6], look: [-37.8, 0.65, -8.4], fov: 37 },
    { f: 640, pos: [-25.2, 2.0, 2.8], look: [-29.2, 1.15, -5.2], fov: 40, ease: 'surge' },
    { f: 665, pos: [-24.5, 1.95, 1.8], look: [-32.2, 1.05, -6.3], fov: 39, ease: 'surge' },
    { f: 694, pos: [-22.5, 2.3, 4.6], look: [-30.5, 1.3, -6.5], fov: 44, ease: 'surge' },
    { f: 713, pos: [-22.2, 2.35, 5.0], look: [-30.5, 1.35, -6.4], fov: 45 },
  ],
  market: [
    { f: 714, pos: [-22.2, 2.35, 5.0], look: [-30.5, 1.35, -6.4], fov: 45 },
    { f: 762, pos: [17.6, 1.6, 2.2], look: [19.75, 1.05, -1.55], fov: 36, ease: 'surge' },
    { f: 779, pos: [17.9, 1.58, 2.3], look: [19.8, 1.06, -1.58], fov: 35 },
    { f: 814, pos: [17.9, 1.62, 2.4], look: [19.95, 1.12, -1.6], fov: 36, ease: 'surge' },
    { f: 843, pos: [21.3, 1.62, 2.4], look: [23.9, 1.12, -1.6], fov: 36, ease: 'surge' },
    { f: 880, pos: [26.2, 1.65, 2.5], look: [28.9, 1.05, -2.2], fov: 36, ease: 'surge' },
    { f: 914, pos: [26.8, 1.55, 2.3], look: [29.3, 0.95, -3.3], fov: 34, ease: 'surge' },
    { f: 931, pos: [27.1, 1.58, 2.5], look: [29.2, 1.0, -3.1], fov: 34 },
  ],
  dusk: [
    { f: 932, pos: [27.1, 1.58, 2.5], look: [29.2, 1.0, -3.1], fov: 34 },
    { f: 968, pos: [-6, 2.4, 6.5], look: [-20, 1.2, -2.5], fov: 44, ease: 'surge' },
    { f: 995, pos: [-24.6, 1.7, 1.6], look: [-29.3, 0.75, -2.9], fov: 36, ease: 'surge' },
    { f: 1017, pos: [-25.6, 1.35, 0.9], look: [-29.85, 0.5, -3.15], fov: 33 },
  ],
  light: [
    { f: 1018, pos: [-25.6, 1.35, 0.9], look: [-29.85, 0.5, -3.15], fov: 33 },
    { f: 1052, pos: [-24.2, 1.9, 3.4], look: [-30, 0.9, -3.4], fov: 42, ease: 'surge' },
    { f: 1092, pos: [-27.5, 2.0, 2.2], look: [-37.4, 0.9, -8.2], fov: 40, ease: 'surge' },
    { f: 1136, pos: [-32, 2.0, 2.4], look: [-22.8, 0.9, -8.2], fov: 40, ease: 'surge' },
    { f: 1175, pos: [-30, 2.2, 4.6], look: [-30, 1.1, -4.5], fov: 46, ease: 'surge' },
    { f: 1203, pos: [-29.6, 2.1, 4.2], look: [-29, 1.2, -4.2], fov: 44 },
    { f: 1235, pos: [-25.2, 1.8, 2.6], look: [-23.4, 1.25, -2.2], fov: 38, ease: 'surge' },
    { f: 1258, pos: [-24.6, 1.85, 3.0], look: [-23.2, 1.3, -2.0], fov: 38 },
  ],
  land: [
    { f: 1259, pos: [-24.6, 1.85, 3.0], look: [-23.2, 1.3, -2.0], fov: 38 },
    { f: 1300, pos: [-8, 2.5, 6.0], look: [-1, 1.3, -0.5], fov: 44, ease: 'surge' },
    { f: 1328, pos: [3.4, 1.9, 4.6], look: [-0.6, 1.3, -0.6], fov: 40, ease: 'surge' },
    { f: 1366, pos: [2.2, 1.6, 3.0], look: [0.1, 1.15, 0.1], fov: 36, ease: 'surge' },
    { f: 1383, pos: [2.0, 1.62, 2.8], look: [0.2, 1.18, 0.15], fov: 35 },
  ],
  hook: [
    { f: 1384, pos: [2.0, 1.62, 2.8], look: [0.2, 1.18, 0.15], fov: 35 },
    { f: 1435, pos: [24, 2.8, 7.5], look: [40, 1.5, -3], fov: 46, ease: 'surge' },
    { f: 1471, pos: [46.5, 2.2, 3.8], look: [51.8, 1.4, -3.4], fov: 42, ease: 'surge' },
    { f: 1510, pos: [48.6, 1.8, 2.4], look: [51.9, 1.5, -4.3], fov: 36, ease: 'surge' },
    { f: 1541, pos: [48.9, 1.82, 2.6], look: [51.9, 1.5, -4.3], fov: 36 },
    { f: 1562, pos: [49.9, 1.6, 2.0], look: [51.95, 1.15, -0.7], fov: 34, ease: 'surge' },
    { f: 1591, pos: [50.2, 1.58, 1.8], look: [51.98, 1.16, -0.68], fov: 33, ease: 'surge' },
    { f: 1639, pos: [50.5, 1.55, 1.6], look: [52.0, 1.17, -0.66], fov: 32 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['bet', 'dusk', 'light', 'market'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook') cinf = 3.8;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardBet: 0, boardHall: 0, hayK: hayKAt(f), baleK: baleKAt(f), lampK: lampKAt(f), soldLamp: 0 };
  if (S.id === 'bet') W.boardBet = smooth(ramp(f, 96, 112)) * (1 - smooth(ramp(f, 140, 152)));
  if (S.id === 'hay') W.boardHall = smooth(ramp(f, 472, 482)) * (1 - smooth(ramp(f, 480, 488)));
  if (S.id === 'light') W.boardHall = smooth(ramp(f, 1167, 1180)) * (1 - smooth(ramp(f, 1196, 1206)));
  if (S.id === 'market' && f >= 885) W.soldLamp = 1;   // leaves the stall stand the same frame it appears in the boy's hand (his lamp prop starts f885)
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return { smokeRate: (S.id === 'light' || S.id === 'dusk') ? 0.12 : 0.22, dustRate: (S.id === 'hay' || S.id === 'cotton') ? 0.3 : 0.08, splashRate: 0 };
};

// ---------- actors ----------
// COSTUMES BY ROLE — landlord: rich plum + gold belt + top hat + stout
// build + moustache. Boy: worn beige, kid build, bare head of hair.
// Labourers/keepers: plain work clothes + cloth caps. King: romanFront
// royal red + crown. Guards: red uniform + shako. Thief: near-black.
const TINT = { day: '#ffffff', hall: '#ffdfae', dusk: '#c9a887', lamp: '#ffc98a', night: '#d8b28a' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  landlord: { jacket: '#6e2a4a', pants: '#3a2430', boots: '#241a12', hat: 'tophat', belt: '#e8c45a', skin: '#e8b08a', moustache: '#2a1c10', build: 'stout' },
  boy: { jacket: '#a08b6d', pants: '#6e5a41', boots: '#4a3a28', hat: 'hair', hair: '#241a12', skin: '#c98a5a', build: 'kid' },
  labA: { jacket: '#7a6a4f', pants: '#54452e', boots: '#3a2c1c', hat: 'cap', cap: '#8a5a34', skin: '#c98a5a' },
  labB: { jacket: '#5f7050', pants: '#453b28', boots: '#33281a', hat: 'cap', cap: '#6e5136', skin: '#a06a3c' },
  keepHay: { jacket: '#8a6a3a', pants: '#5e4a2c', boots: '#3a2c1c', hat: 'cap', cap: '#a8842e', skin: '#e8b08a' },
  keepCot: { jacket: '#7d7a72', pants: '#4c4a44', boots: '#33281a', hat: 'cap', cap: '#d8d2c2', skin: '#c98a5a' },
  keepLamp: { jacket: '#4a5e7a', pants: '#2e3a4a', boots: '#241c14', hat: 'cap', cap: '#3a4a63', skin: '#e8b08a' },
  vilA: { jacket: '#77685a', pants: '#4e4234', boots: '#3a2c1c', hat: 'hair', hair: '#1c140e', skin: '#c98a5a' },
  vilB: { jacket: '#5e6250', pants: '#40382a', boots: '#33281a', hat: 'cap', cap: '#7a6a4a', skin: '#a06a3c' },
  vilC: { jacket: '#84705a', pants: '#574a38', boots: '#3a2c1c', hat: 'hair', hair: '#2e2015', skin: '#e8b08a' },
  vilD: { jacket: '#6a5a68', pants: '#463c44', boots: '#2c2118', hat: 'cap', cap: '#5a4a56', skin: '#c98a5a' },
  guardL: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  guardR: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#c98a5a' },
  thief: { jacket: '#2b2b33', pants: '#1e1e24', boots: '#141416', hat: 'cap', cap: '#1b1b21', skin: '#c98a5a' },
};
export const KING = { tunic: '#a51f24', cape: '#5e1220', skin: '#f5c9a0', beard: '#4a2c18', beardShort: true, crown: true, collar: '#f6efdd', trim: '#e8b64c' };
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const marchA = (T, tint, f) => (o, expr, seed, pos, dist, extra = {}) => RW(T, o, { expr, mode: 'march', phase: q((dist / 1.6) % 1, 3), blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const shakeK = (f, a, b) => q(Math.sin(ramp(f, a, b) * Math.PI * 4) * 8 * Math.sin(ramp(f, a, b) * Math.PI), 1); // head-shake "no"

const CROWD = [
  [OUTFITS.vilA, 71, [-3.6, 0, 1.9], 7.5], [OUTFITS.vilB, 72, [-1.3, 0, 2.7], 4.5],
  [OUTFITS.vilC, 73, [1.1, 0, 2.9], 4.2], [OUTFITS.vilD, 74, [3.4, 0, 2.1], 7.2],
];
export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const st = stand(T, tint, f), mc = marchA(T, tint, f);
  switch (S.id) {
    case 'bet': {
      const laugh = f >= 92 && f < 150;
      const threat = f >= 200;
      out.push(RW(T, OUTFITS.landlord, { expr: laugh ? 'laugh' : threat ? 'stern' : 'grin', mode: 'stand', blink: blinkAt(f, 95), seed: 95, ...(threat ? { prop: ['point', 0.55] } : {}) }, LORD0, { tint, yaw: 0.25 }));
      out.push(RW(T, OUTFITS.boy, { expr: f < 62 ? 'neutral' : 'nervous', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['coin', 0.35] }, BOY0, { tint, yaw: -0.2, s: 0.85 }));
      break;
    }
    case 'chance': {
      out.push(st(OUTFITS.landlord, 'grin', 95, LORD0, { yaw: 0.25 }));
      out.push(RW(T, OUTFITS.boy, { expr: f < 335 ? 'pained' : 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['coin', 0.9] }, BOY0, { tint, yaw: -0.2, s: 0.85 }));
      if (f >= 394) for (const [o, seed, post, fromX] of CROWD) {
        const start = [fromX, 0, post[2] + 0.6], total = Math.hypot(post[0] - start[0], post[2] - start[2]);
        const dist = smooth(ramp(f, 396, 428)) * total;
        const p = kf3([[396, start], [428, post]], f);
        out.push(f > 398 && f < 426 ? mc(o, 'neutral', seed, p, dist, { yaw: 0 }) : st(o, 'neutral', seed, post, { yaw: 0 }));
      }
      break;
    }
    case 'hay': {
      const hc = hayCartAt(f);
      const pusher = (cartP, dist, seed, moving) => RW(T, seed === 81 ? OUTFITS.labA : OUTFITS.labB,
        { expr: 'stern', mode: moving ? 'march' : 'stand', phase: q((dist / 1.6) % 1, 3), blink: blinkAt(f, seed), seed, prop: ['push', 0.85] },
        [cartP[0] - 0.58, 0, cartP[2] + 1.6], { tint, yaw: -0.3 });
      out.push(pusher(hc.A, hc.Ad, 81, (f >= 452 && f < 492) || (f >= 540 && f < 575)));
      if (f >= 490) out.push(pusher([hc.B[0], 0, hc.B[2]], hc.Bd, 82, (f >= 498 && f < 535) || (f >= 565 && f < 600)));
      if (f >= 470 && f < 560) { const fk = q(0.3 + 0.45 * (0.5 + 0.5 * Math.sin(f * 0.45)), 2); out.push(RW(T, OUTFITS.labB, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 83), seed: 83, prop: ['fork', fk] }, [-28.2, 0, -6.1], { tint, yaw: -0.5 })); }
      out.push(st(OUTFITS.landlord, 'grin', 95, [-21.9, 0, -4.6], { yaw: -0.4 }));
      out.push(st(OUTFITS.boy, 'nervous', 91, [-35.5, 0, -1.0], { yaw: 0.4, s: 0.85 }));
      break;
    }
    case 'cotton': {
      const cs = carrierAt(f);
      cs.forEach((c, i) => {
        const o = i === 0 ? OUTFITS.labA : OUTFITS.labB;
        out.push(RW(T, o, { expr: 'stern', mode: c.moving ? 'march' : 'stand', phase: q((c.d / 1.6) % 1, 3), blink: blinkAt(f, 81 + i), seed: 81 + i }, c.p, { tint, yaw: i === 0 ? -0.2 : 0.2 }));
      });
      out.push(st(OUTFITS.landlord, 'grin', 95, [-21.9, 0, -4.6], { yaw: -0.4 }));
      out.push(st(OUTFITS.boy, f >= 700 ? 'grin' : 'stern', 91, [-27.0, 0, -0.6], { yaw: 0.3, s: 0.85 }));
      break;
    }
    case 'market': {
      const w = boyWalkAt(f);
      if (w && w.moving) out.push(mc(OUTFITS.boy, 'neutral', 91, w.p, w.d, { yaw: 0.15, s: 0.85 }));
      else if (f >= 885) out.push(RW(T, OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['lamp', 0.5] }, boyPosAt(f), { tint, yaw: -0.3, s: 0.85 }));
      else if (f >= 760 && f < 812) out.push(RW(T, OUTFITS.boy, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['coin', 0.3] }, boyPosAt(f), { tint, yaw: -0.2, s: 0.85 }));
      else out.push(st(OUTFITS.boy, f < 843 ? 'nervous' : 'neutral', 91, boyPosAt(f), { yaw: -0.2, s: 0.85 }));
      out.push(RW(T, OUTFITS.keepHay, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 84), seed: 84, ...(f >= 795 && f < 814 ? { headTilt: shakeK(f, 795, 814) } : {}) }, [20.5, 0, -4.7], { tint, yaw: 0 }));
      out.push(RW(T, OUTFITS.keepCot, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 85), seed: 85, ...(f >= 836 && f < 852 ? { headTilt: shakeK(f, 836, 852) } : {}) }, [24.5, 0, -4.7], { tint, yaw: 0 }));
      out.push(st(OUTFITS.keepLamp, f >= 885 ? 'smile' : 'neutral', 86, [30.2, 0, -4.7], { yaw: 0 }));
      break;
    }
    case 'dusk': {
      const w = boyWalkAt(f);
      // ONE lamp in the story world: he carries it in (march + the first
      // standing frames), then sets it down at LAMPP at f955 — from that
      // frame the floor lampGroup (main.js, visible f>=955) is the single
      // lamp and his hand is empty. (Fix: previously the held prop ran to
      // f1017 while the floor lamp was also visible from f950 — two lamps.)
      if (w && w.moving) out.push(RW(T, OUTFITS.boy, { expr: 'neutral', mode: 'march', phase: q((w.d / 1.6) % 1, 3), blink: blinkAt(f, 91), seed: 91, prop: ['lamp', 0.6] }, w.p, { tint, yaw: -0.3, s: 0.85 }));
      else if (f >= 950 && f < 955) out.push(RW(T, OUTFITS.boy, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 91), seed: 91, prop: ['lamp', 0.75] }, boyPosAt(f), { tint, yaw: -0.35, s: 0.85 }));
      else out.push(st(OUTFITS.boy, 'neutral', 91, boyPosAt(f), { yaw: -0.3, s: 0.85 }));
      break;
    }
    case 'light': {
      out.push(RW(T, OUTFITS.boy, { expr: f >= 1204 ? 'grin' : 'neutral', mode: 'stand', blink: blinkAt(f, 91), seed: 91 }, [-29.1, 0, -2.5], { tint, yaw: -0.3, s: 0.85 }));
      // the village watches from the east opening — dark shapes in the glow
      const sil = '#8a6a4c';
      out.push(st(OUTFITS.landlord, f >= 1204 ? 'shock' : 'stern', 95, [-23.1, 0, -2.1], { yaw: -0.3, tint: f >= 1204 ? tint : sil }));
      out.push(st(OUTFITS.vilA, 'shock', 71, [-22.3, 0, -3.4], { yaw: -0.2, tint: sil }));
      out.push(st(OUTFITS.vilC, 'shock', 73, [-22.5, 0, -0.9], { yaw: -0.2, tint: sil }));
      break;
    }
    case 'land': {
      const give = smooth(ramp(f, 1342, 1362));
      out.push(RW(T, OUTFITS.landlord, { expr: f < 1339 ? 'stern' : 'neutral', mode: 'stand', blink: blinkAt(f, 95), seed: 95, ...(f >= 1339 ? { prop: ['deed', q(lerp(0.25, 0.8, give), 2)] } : {}) }, [-0.9, 0, -0.5], { tint, yaw: 0.3 }));
      out.push(RW(T, OUTFITS.boy, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 91), seed: 91, ...(f >= 1362 ? { prop: ['deed', 0.7] } : { prop: ['coin', 0.9] }) }, [0.9, 0, 0.3], { tint, yaw: -0.25, s: 0.85 }));
      for (const [o, seed, post] of CROWD) out.push(st(o, f >= 1339 ? 'smile' : 'neutral', seed, post, { yaw: 0 }));
      break;
    }
    case 'hook': {
      const kingOpts = { expr: f >= 1484 && f < 1541 ? 'stern' : 'neutral', blink: blinkAt(f, 97), seed: 97, L: 'hang', R: f >= 1490 && f < 1545 ? 'point' : 'hang', headTilt: 0, bob: 0 };
      out.push({ key: 'king' + JSON.stringify(kingOpts), draw: (p) => T.romanFront(p, KING, kingOpts), x: 52, y: 0.42, z: -4.9, ground: 0.42, tint, yaw: 0, s: 1.02 });
      out.push(st(OUTFITS.guardL, 'stern', 61, [49.5, 0, -2.7], { yaw: 0.2 }));
      out.push(st(OUTFITS.guardR, 'stern', 62, [54.5, 0, -2.7], { yaw: -0.2 }));
      out.push(RW(T, OUTFITS.thief, { expr: f >= 1554 ? 'grin' : 'nervous', mode: 'stand', blink: blinkAt(f, 88), seed: 88, ...(f >= 1554 ? { headTilt: 6 } : {}) }, [52, 0, -0.6], { tint, yaw: 0 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
