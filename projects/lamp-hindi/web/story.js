// "लड़का जिसने एक दीये से हॉल भर दिया" — Hindi trick batch 2, topic 2.
// Timed DIRECTLY to the Hindi stem (53.49 s, 30 fps, TOTAL 1605) from the
// align_lamp clause map (lamp-hindi-voice/timing.json, char match 0.845).
// Every shot starts on a clause boundary; every camera key lands on the
// word that names its subject. Camera Law: the camera TRACKS the
// voice-named subject, holds with a slow push-in, never freezes, never
// drifts aimlessly. Characters are planted unless the story moves them.
// Clause map (f): sikka 0 | hall 27 | zamindar-bola 77 | bhar-do 112 |
// zameen-wapas 174 | na-bhar 224 | muft-seva 249 || baap-zameen 295 |
// aakhri-mauka 387 || gaon-aaya 440 | koshish 476 | ghaas-laaye 531 |
// nigal-gaya 584 | kone-khaali 620 | rui-aaye 660 | phir-na-bhara 695 ||
// bazaar-gaya 730 | na-ghaas 801 | na-rui 833 || khareeda 848 | diya 879 |
// tel 913 || shaam 939 | beech-rakhkar 971 | jala-diya 1019 || roshni-kone
// 1035 | daraar 1086 | har-inch 1102 | andhera-nahi 1158 | bhar-gaya 1202 |
// poora 1215 || shart-saamne 1239 | zameen-wapas 1295 || chor 1339 |
// raja-bola 1460 | maut-chun-lo 1477 | koi-si-bhi 1511 | muskuraya 1530 |
// kaun-si-maut 1565.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1605, DECK = 0;
export const SHOTS = [
  { id: 'bet', a: 0, b: 293, light: 'day' },
  { id: 'stakes', a: 294, b: 438, light: 'day' },
  { id: 'crowd', a: 439, b: 530, light: 'day' },
  { id: 'hay', a: 531, b: 658, light: 'golden' },
  { id: 'cotton', a: 659, b: 728, light: 'golden' },
  { id: 'market', a: 729, b: 847, light: 'golden' },
  { id: 'lampbuy', a: 848, b: 938, light: 'golden' },
  { id: 'lampplace', a: 939, b: 1034, light: 'dusk' },
  { id: 'light', a: 1035, b: 1238, light: 'dusk' },
  { id: 'verdict', a: 1239, b: 1338, light: 'golden' },
  { id: 'hook', a: 1339, b: 1604, light: 'night' },
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
  dusk: { az: 96, el: 10, sky: '#6d7396', ground: '#35332c', hemi: 0.72, sun: '#e8975a', sunI: 1.15, fog: '#4c4660', fogNear: 38, fogFar: 300,
    skyTop: '#2e3c66', skyHor: '#c97e52', sunDisc: '#ffdcb0', sunSize: 0.003, sat: 0.99, vig: 0.3, shadowExt: 18, aurora: 0, gain: '#ccd2ff', ...WATER },
  night: { az: 210, el: 38, sky: '#2c3a55', ground: '#1c221c', hemi: 0.62, sun: '#bcd2ff', sunI: 1.15, fog: '#1a2438', fogNear: 34, fogFar: 260,
    skyTop: '#131f38', skyHor: '#2c3c5c', sunDisc: '#dfe9ff', sunSize: 0.0022, sat: 0.94, vig: 0.32, shadowExt: 16, aurora: 0, gain: '#cfe0ff', ...WATER },
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
export const lightFor = (S, f) => {
  // the light shot: as the lamp's glow spreads, the whole hall warms
  if (S.id === 'light') {
    const gk = smooth(ramp(f, 1040, 1170));
    const L = blendLight(LIGHTS.dusk, LIGHTS.golden, 0.38 * gk);
    L.hemi = lerp(LIGHTS.dusk.hemi, 0.95, gk); L.vig = lerp(0.3, 0.24, gk);
    return L;
  }
  if (S.id === 'lampplace') return blendLight(LIGHTS.golden, LIGHTS.dusk, smooth(ramp(f, 945, 1005)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const LANDLORD = [3.35, 0, 3.35];
export const BOY_FRONT = [1.15, 0, 3.85];
export const LAMP_POS = [0, 0, -9.2];
const boyMarketZ = (f) => kf([[736, 4.4], [798, 0.6]], f);
const heroPosAtInner = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'bet': return f < 77 ? [BOY_FRONT[0], 1.0, BOY_FRONT[2]] : [LANDLORD[0], 1.35, LANDLORD[2]];
    case 'stakes': return [BOY_FRONT[0], 1.05, BOY_FRONT[2]];
    case 'crowd': return [0.4, 1.15, 0.3];
    case 'hay': return f < 584 ? [-0.6, 1.0, -7.0] : [-4.5, 0.8, -11.0];
    case 'cotton': return [5.4, 0.9, -8.6];
    case 'market': return [-17.6, 1.0, boyMarketZ(f)];
    case 'lampbuy': return [-20.2, 1.05, -5.2];
    case 'lampplace': return [0.1, 0.5, -9.2];
    case 'light': return [0, 0.5, -9.2];
    case 'verdict': return [2.2, 1.3, 3.5];
    case 'hook': return f >= 1460 && f < 1530 ? [11.8, 1.4, 4.6] : [8.6, 1.25, 2.6];
    default: return [0, 1, 0];
  }
};
export const heroPosAt = heroPosAtInner;

// ---------- cameras (keys land on clause words; look = voice-named subject) ----------
const CAMS = {
  bet: [
    { f: 0, pos: [7.8, 3.4, 11.5], look: [0.5, 2.2, -1.0], fov: 46 },
    { f: 27, pos: [6.2, 2.7, 10.2], look: [0.2, 3.1, -0.8], fov: 48, ease: 'surge' },
    { f: 77, pos: [6.1, 2.0, 7.3], look: [3.32, 1.35, 3.3], fov: 40, ease: 'surge' },
    { f: 112, pos: [6.9, 2.2, 8.15], look: [4.3, 1.55, 2.9], fov: 43, ease: 'surge' },
    { f: 174, pos: [6.7, 2.15, 7.9], look: [4.3, 1.55, 2.9], fov: 42, ease: 'surge' },
    { f: 224, pos: [6.2, 2.05, 7.4], look: [3.34, 1.42, 3.28], fov: 38, ease: 'surge' },
    { f: 293, pos: [5.9, 2.0, 7.1], look: [3.34, 1.42, 3.28], fov: 37 },
  ],
  stakes: [
    { f: 294, pos: [-1.9, 1.9, 8.6], look: [1.15, 1.05, 3.85], fov: 40 },
    { f: 350, pos: [-1.6, 1.8, 7.9], look: [1.15, 1.08, 3.85], fov: 39, ease: 'surge' },
    { f: 387, pos: [-1.3, 1.7, 7.2], look: [1.15, 1.12, 3.85], fov: 36, ease: 'surge' },
    { f: 438, pos: [-1.2, 1.68, 7.0], look: [1.15, 1.12, 3.85], fov: 35 },
  ],
  crowd: [
    { f: 439, pos: [8.4, 3.1, 12.6], look: [-0.2, 1.25, 3.4], fov: 47 },
    { f: 476, pos: [6.1, 2.4, 9.6], look: [0.3, 1.2, 3.2], fov: 42, ease: 'surge' },
    { f: 530, pos: [5.6, 2.3, 9.0], look: [0.2, 1.2, 3.1], fov: 41 },
  ],
  hay: [
    { f: 531, pos: [6.4, 2.7, -2.2], look: [-2.6, 0.95, -7.6], fov: 45 },
    { f: 584, pos: [6.9, 3.5, -3.1], look: [-2.2, 0.8, -10.6], fov: 47, ease: 'surge' },
    { f: 620, pos: [2.9, 2.2, -9.4], look: [-7.4, 0.7, -15.2], fov: 40, ease: 'surge' },
    { f: 658, pos: [2.7, 2.15, -9.2], look: [-7.4, 0.7, -15.2], fov: 39 },
  ],
  cotton: [
    { f: 659, pos: [-4.2, 2.4, -3.2], look: [5.6, 0.9, -9.0], fov: 44 },
    { f: 695, pos: [-5.2, 3.1, -2.8], look: [3.4, 1.0, -10.4], fov: 47, ease: 'surge' },
    { f: 728, pos: [-5.4, 3.15, -2.7], look: [3.5, 1.0, -10.4], fov: 46 },
  ],
  market: [
    { f: 729, pos: [-13.6, 2.2, 8.6], look: [-17.6, 1.05, 4.4], fov: 43 },
    { f: 765, pos: [-13.8, 2.1, 5.4], look: [-17.6, 1.05, 2.4], fov: 41, ease: 'surge' },
    { f: 801, pos: [-14.4, 1.95, 4.1], look: [-20.4, 1.25, 3.3], fov: 41, ease: 'surge' },
    { f: 833, pos: [-14.4, 1.95, 1.1], look: [-20.4, 1.25, -0.8], fov: 41, ease: 'surge' },
    { f: 847, pos: [-14.5, 1.95, 0.6], look: [-19.6, 1.2, -2.6], fov: 40 },
  ],
  lampbuy: [
    { f: 848, pos: [-14.6, 2.2, -0.4], look: [-20.2, 1.1, -5.2], fov: 44 },
    { f: 879, pos: [-16.2, 1.75, -2.2], look: [-20.3, 1.05, -5.3], fov: 39, ease: 'surge' },
    { f: 913, pos: [-16.0, 1.7, -1.9], look: [-20.5, 1.12, -5.5], fov: 38, ease: 'surge' },
    { f: 938, pos: [-15.9, 1.7, -1.8], look: [-20.5, 1.12, -5.5], fov: 38 },
  ],
  lampplace: [
    { f: 939, pos: [4.6, 2.0, -4.6], look: [0.2, 0.7, -9.0], fov: 42 },
    { f: 971, pos: [3.9, 1.8, -5.2], look: [0.1, 0.6, -9.1], fov: 40, ease: 'surge' },
    { f: 1019, pos: [3.1, 1.5, -5.9], look: [0.05, 0.45, -9.15], fov: 37, ease: 'surge' },
    { f: 1034, pos: [3.0, 1.5, -6.0], look: [0.05, 0.45, -9.15], fov: 37 },
  ],
  light: [
    { f: 1035, pos: [3.0, 1.5, -6.0], look: [0.05, 0.45, -9.15], fov: 37 },
    { f: 1086, pos: [2.4, 2.1, -5.2], look: [-3.4, 0.9, -13.2], fov: 42, ease: 'surge' },
    { f: 1102, pos: [-2.4, 2.15, -5.2], look: [3.4, 0.9, -13.4], fov: 43, ease: 'surge' },
    { f: 1158, pos: [0, 3.5, -2.6], look: [0.3, 0.8, -10.4], fov: 47, ease: 'surge' },
    { f: 1202, pos: [0.4, 2.9, -3.6], look: [0.55, 0.95, -9.9], fov: 44, ease: 'surge' },
    { f: 1238, pos: [0.4, 2.85, -3.8], look: [0.55, 0.95, -9.9], fov: 43 },
  ],
  verdict: [
    { f: 1239, pos: [7.3, 2.4, 10.6], look: [2.2, 1.3, 3.6], fov: 44 },
    { f: 1295, pos: [6.4, 2.1, 9.4], look: [2.2, 1.35, 3.6], fov: 40, ease: 'surge' },
    { f: 1338, pos: [6.2, 2.05, 9.2], look: [2.2, 1.35, 3.6], fov: 39 },
  ],
  hook: [
    { f: 1339, pos: [2.2, 2.7, 12.2], look: [8.3, 1.3, 3.6], fov: 48 },
    { f: 1460, pos: [4.9, 2.05, 8.9], look: [10.75, 1.42, 5.2], fov: 40, ease: 'surge' },
    { f: 1477, pos: [5.6, 1.95, 8.5], look: [10.8, 1.42, 5.2], fov: 37, ease: 'surge' },
    { f: 1530, pos: [4.7, 1.85, 7.5], look: [7.75, 1.26, 3.2], fov: 36, ease: 'surge' },
    { f: 1565, pos: [4.9, 1.85, 7.7], look: [8.6, 1.3, 3.4], fov: 38, ease: 'surge' },
    { f: 1604, pos: [4.8, 1.85, 7.8], look: [8.6, 1.3, 3.4], fov: 37 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAtInner(f);
  let cinf = 5;
  if (S.id === 'lampbuy' || S.id === 'lampplace' || S.id === 'stakes') cinf = 4;
  if (S.id === 'crowd' || S.id === 'light') cinf = 3;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardBet: 0, boardLamp: 0, boardHook: 0, lampK: 0, glowK: 0, hayK: 0, cottonK: 0, hayCartZ: 3.8, cartX: 0, lampBowlK: 0 };
  // the bet board: up while the landlord spells out the wager
  if (S.id === 'bet') W.boardBet = smooth(ramp(f, 116, 134)) * (1 - smooth(ramp(f, 172, 184)));
  // the purchase board at the lamp stall
  if (S.id === 'lampbuy') W.boardLamp = smooth(ramp(f, 884, 900)) * (1 - smooth(ramp(f, 924, 938)));
  // the hook board by the thief: fades in over the thief's exit, then HOLDS
  // at full opacity through the final frame f1604 — the video must END on
  // the board (fix 2026-11-14: the old fade-out 1590-1604 left the last
  // frame an empty yard with no board at all)
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1562, 1580));
  // hay: the cart stands loaded inside; piles grow as the men unload
  if (S.id === 'hay' || S.id === 'cotton' || S.id === 'lampplace' || S.id === 'light') W.hayK = 3;
  if (S.id === 'hay') W.hayK = 3 * ramp(f, 545, 640);
  // cotton bales stack up one by one
  if (S.id === 'cotton') W.cottonK = 6 * ramp(f, 664, 722);
  if (f >= 729) W.cottonK = 6;
  // the emptied cart is parked against the west wall before the lamp scenes
  if (S.id === 'cotton') W.cartX = -6.0;
  if (f >= 729) W.cartX = -6.0;
  // the lamp: carried in, set down at the centre, struck at "जला दिया"
  if (S.id === 'lampplace') W.lampBowlK = smooth(ramp(f, 975, 1000));
  if (S.id === 'light' || S.id === 'verdict' || S.id === 'hook') W.lampBowlK = 1;
  if (f >= 1022) W.lampK = smooth(ramp(f, 1022, 1033));
  // the light runs outward into every corner (soft, staggered by glowK)
  if (S.id === 'light') W.glowK = smooth(ramp(f, 1038, 1172));
  if (f > 1238) W.glowK = 1;
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const interior = S.id === 'hay' || S.id === 'cotton' || S.id === 'lampplace' || S.id === 'light';
  return { smokeRate: interior ? 0.05 : 0.3, dustRate: interior ? 0.45 : 0.12 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', golden: '#ffd9a3', dusk: '#9aa4cc', night: '#aebedd' };
const tintFor = (S, f) => {
  if (S.id === 'light') return hexLerp('#9aa4cc', '#ffce96', smooth(ramp(f, 1040, 1170)));
  if (S.id === 'lampplace') return hexLerp('#ffd9a3', '#9aa4cc', smooth(ramp(f, 945, 1005)));
  return TINT[S.light] || '#ffffff';
};
export const OUTFITS = {
  // ज़मींदार: rich maroon kurta, golden topi, stout build (shawl + necklace drawn as extras)
  landlord: { jacket: '#6d1f3c', pants: '#c9a86a', boots: '#3a2415', hat: 'cap', cap: '#d9a441', skin: '#b57a4e', build: 'stout', belt: true },
  // लड़का: poor faded clothes, kid build
  boy: { jacket: '#a08c62', pants: '#5d4c36', boots: '#4a3a28', hat: 'hair', hair: '#2a2018', skin: '#c98a5a', build: 'kid' },
  carrier1: { jacket: '#8a6f4d', pants: '#54432e', boots: '#33261a', hat: 'hair', hair: '#241a10', skin: '#a06a3e' },
  carrier2: { jacket: '#7d6244', pants: '#4c3b28', boots: '#33261a', hat: 'hair', hair: '#1d150d', skin: '#c98a5a' },
  sellerLamp: { jacket: '#2e6a6a', pants: '#3c3630', boots: '#2a2018', hat: 'cap', cap: '#e8e2d2', skin: '#b57a4e' },
  sellerHay: { jacket: '#5d7038', pants: '#4c4230', boots: '#33261a', hat: 'hair', hair: '#241a10', skin: '#a06a3e' },
  sellerCotton: { jacket: '#4a5a78', pants: '#3c3630', boots: '#2a2018', hat: 'hair', hair: '#1d150d', skin: '#d9a878' },
  villager1: { jacket: '#7a6248', pants: '#55452e', boots: '#33261a', hat: 'hair', hair: '#241a10', skin: '#b57a4e' },
  villager2: { jacket: '#5f6a52', pants: '#463c2c', boots: '#33261a', hat: 'cap', cap: '#cbb98f', skin: '#a06a3e' },
  villager3: { jacket: '#8a5a3c', pants: '#55452e', boots: '#2a2018', hat: 'hair', hair: '#1d150d', skin: '#d9a878' },
  villager4: { jacket: '#68604f', pants: '#4c4230', boots: '#33261a', hat: 'hair', hair: '#2a2018', skin: '#c98a5a' },
  // राजा (hook): royal purple + crown extra
  king: { jacket: '#5a2a7a', pants: '#c9a86a', boots: '#3a2415', hat: 'cap', cap: '#d9a441', skin: '#b57a4e', build: 'stout', belt: true },
  thief: { jacket: '#33302e', pants: '#26221f', boots: '#1c1a18', hat: 'hair', hair: '#241c14', skin: '#c98a5a' },
  guard: { jacket: '#8c2f2a', pants: '#3a2c2c', boots: '#241a14', hat: 'cap', cap: '#7a1f1f', skin: '#b57a4e', belt: true, pagdi: '#a52a24' },
  guard2: { jacket: '#8c2f2a', pants: '#3a2c2c', boots: '#241a14', hat: 'cap', cap: '#7a1f1f', skin: '#d9a878', belt: true, pagdi: '#a52a24' },
};
const propPt = (k) => [435.5 + 45.7 * k, 311.7 + 203.6 * k];
const drawFigure = (T, o, opts, extra) => (p) => {
  if (extra.spear) {
    p.stroke([[424, 84], [424, 974]], 7.5, '#6d4a2a');
    p.poly([[424, 26], [411, 90], [437, 90]], '#b9c1c9', 4);
  }
  T.bodyFront(p, o, opts);
  if (extra.shawl) { // the landlord's gold-bordered shawl, slung over one shoulder
    p.band([[232, 398], [368, 598]], '#7d2a48', 34, 3, 'round');
    p.band([[232, 398], [368, 598]], '#d9a441', 5, 2, 'round');
  }
  if (extra.necklace) { // gold chain with a pendant, on the chest
    p.arc(300, 372, 62, 52, 15, 165, 4, '#d9a441');
    p.dot(300, 428, 9, '#d9a441'); p.dot(300, 428, 4.5, '#a02318');
  }
  if (extra.crown) { // the king's crown: band + three points + jewel
    p.poly([[212, 196], [388, 196], [388, 158], [212, 158]], '#d9a441', 4);
    p.poly([[218, 158], [240, 106], [262, 158]], '#e9bc55', 3);
    p.poly([[272, 158], [300, 96], [328, 158]], '#e9bc55', 3);
    p.poly([[338, 158], [360, 106], [382, 158]], '#e9bc55', 3);
    p.dot(300, 176, 8, '#a02318');
  }
  if (extra.pagdi) {
    const cy = extra.pagdi;
    p.ell(300, cy - 2, 105, 49, o.pagdi, 6);
    p.arc(300, cy + 4, 97, 41, 195, 345, 5, '#7c1d18');
    p.arc(300, cy - 14, 99, 44, 200, 340, 4, '#c8453c');
    p.dot(398, cy - 16, 15, o.pagdi);
    p.poly([[398, cy - 30], [424, cy + 26], [392, cy + 20]], o.pagdi, 4);
  }
  if (extra.ring) {
    const pt = opts.prop ? propPt(opts.prop[1]) : [416, 645];
    p.ell(pt[0], pt[1], 15, 15, '#d9a441', 5);
    p.ell(pt[0], pt[1], 7.5, 7.5, '#a02318', 3);
  }
  if (extra.coin) { // the ONE coin, pinched in the boy's hand
    const pt = [416, 645];
    p.ell(pt[0], pt[1], 17, 17, '#d9a441', 4);
    p.ell(pt[0], pt[1], 10, 10, '#e9bc55', 2.5);
  }
  if (extra.paper) { // the land deed, in the landlord's hand
    const pt = [416, 645];
    p.poly([[pt[0] - 34, pt[1] - 52], [pt[0] + 30, pt[1] - 58], [pt[0] + 36, pt[1] + 40], [pt[0] - 28, pt[1] + 46]], '#e8dcc0', 3.5);
    p.stroke([[pt[0] - 22, pt[1] - 28], [pt[0] + 22, pt[1] - 32]], 3, '#8a7a5c');
    p.stroke([[pt[0] - 20, pt[1] - 6], [pt[0] + 24, pt[1] - 10]], 3, '#8a7a5c');
    p.dot(pt[0] + 16, pt[1] + 22, 8, '#a02318');
  }
  if (extra.bundle) { // a bundle of hay carried at the side
    p.ell(416, 656, 31, 21, '#c9a84c', 3);
    p.stroke([[392, 644], [440, 640]], 2.5, '#8a6d2f');
    p.stroke([[390, 658], [442, 656]], 2.5, '#8a6d2f');
    p.stroke([[396, 672], [438, 674]], 2.5, '#8a6d2f');
    p.band([[416, 634], [416, 680]], '#6e5226', 5, 1.5, 'round');
  }
  if (extra.baleChunk) { // a chunk of cotton carried at the side
    p.ell(416, 656, 30, 22, '#efe6d0', 3);
    p.arc(416, 656, 22, 15, 20, 160, 2, '#c9bda6');
    p.arc(416, 664, 24, 16, 200, 340, 2, '#c9bda6');
  }
  if (extra.lampHand) { // the little clay lamp, carried at the boy's side
    const pt = [416, 645];
    p.ell(pt[0], pt[1] + 8, 26, 11, '#9a5a34', 3.5);
    p.dot(pt[0], pt[1] - 4, 5, '#6e3d20');
  }
};
const A = (T, o, opts, pos, extra = {}) => ({
  key: (extra.tag || 'fig') + JSON.stringify(o) + JSON.stringify(opts) + JSON.stringify(extra),
  draw: drawFigure(T, o, opts, extra),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra.out,
});
const idleTilt = (f, seed) => q(1.5 * Math.sin(f * 0.037 + seed * 1.3), 1);
const fig = (T, tint, f, oName, expr, pos, opts = {}, extra = {}, out = {}) =>
  A(T, OUTFITS[oName], { expr, mode: 'stand', blink: blinkAt(f, extra.seed || 71), seed: extra.seed || 71, headTilt: idleTilt(f, extra.seed || 71), ...opts }, pos, { tag: oName, ...extra, out: { tint, ...out } });
const crowdAt = (T, tint, f, out, which) => {
  const spots = [[-4.9, 6.3, 'villager1', 81], [-3.1, 7.0, 'villager3', 82], [7.2, 6.5, 'villager2', 84], [8.8, 5.5, 'villager1', 85], [2.9, 7.6, 'villager4', 83]];
  for (const [vx, vz, vn, sd] of spots.slice(0, which)) out.push(fig(T, tint, f, vn, 'neutral', [vx, 0, vz], {}, { seed: sd }, { yaw: vx < 2 ? 0.25 : -0.3 }));
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  switch (S.id) {
    case 'bet': {
      const laugh = f >= 77 && f < 224;
      out.push(fig(T, tint, f, 'landlord', laugh ? 'laugh' : 'stern', LANDLORD, laugh ? { wave: 0.4 } : {}, { seed: 71, shawl: true, necklace: true, ring: true }, { yaw: -0.3 }));
      out.push(fig(T, tint, f, 'boy', 'nervous', BOY_FRONT, {}, { seed: 75, coin: 0.45 }, { yaw: 0.45 }));
      crowdAt(T, tint, f, out, 3);
      break;
    }
    case 'stakes': {
      const determined = f >= 387;
      out.push(fig(T, tint, f, 'boy', determined ? 'stern' : 'nervous', BOY_FRONT, { headTilt: q(determined ? -3 : 3, 1) }, { seed: 75, coin: 0.45 }, { yaw: 0.45 }));
      out.push(fig(T, tint, f, 'landlord', 'stern', LANDLORD, {}, { seed: 71, shawl: true, necklace: true, ring: true }, { yaw: -0.3 }));
      break;
    }
    case 'crowd': {
      out.push(fig(T, tint, f, 'landlord', 'stern', LANDLORD, {}, { seed: 71, shawl: true, necklace: true, ring: true }, { yaw: -0.2 }));
      out.push(fig(T, tint, f, 'boy', 'nervous', BOY_FRONT, {}, { seed: 75 }, { yaw: 0.4 }));
      const bowPulse = f >= 486 ? q(6 + 2 * Math.sin(ramp(f, 486, 524) * Math.PI * 2), 1) : q(0, 1);
      out.push(fig(T, tint, f, 'carrier1', 'neutral', [1.5, 0, 3.1], f >= 486 ? { headTilt: bowPulse } : {}, { seed: 76, bundle: f >= 486 }, { yaw: 0.15 }));
      out.push(fig(T, tint, f, 'carrier2', 'neutral', [-1.5, 0, 3.1], f >= 486 ? { headTilt: bowPulse } : {}, { seed: 77, bundle: f >= 486 }, { yaw: -0.15 }));
      crowdAt(T, tint, f, out, 5);
      break;
    }
    case 'hay': {
      const bob1 = q(5 + 2 * Math.sin(f * 0.22), 1), bob2 = q(5 + 2 * Math.sin(f * 0.22 + 2.2), 1);
      out.push(fig(T, tint, f, 'carrier1', 'neutral', [2.6, 0, -5.4], { headTilt: bob1 }, { seed: 76, bundle: true }, { yaw: 0.8 }));
      out.push(fig(T, tint, f, 'carrier2', 'neutral', [-4.3, 0, -9.9], { headTilt: bob2 }, { seed: 77, bundle: true }, { yaw: -0.7 }));
      out.push(fig(T, tint, f, 'landlord', 'stern', [5.3, 0, -8.6], {}, { seed: 71, shawl: true, necklace: true, ring: true }, { yaw: 0.5 }));
      out.push(fig(T, tint, f, 'boy', 'nervous', [-3.3, 0, -4.5], {}, { seed: 75 }, { yaw: -0.4 }));
      break;
    }
    case 'cotton': {
      const bob1 = q(5 + 2 * Math.sin(f * 0.2), 1), bob2 = q(5 + 2 * Math.sin(f * 0.2 + 2.6), 1);
      out.push(fig(T, tint, f, 'carrier1', 'neutral', [4.3, 0, -8.2], { headTilt: bob1 }, { seed: 76, baleChunk: true }, { yaw: -0.8 }));
      out.push(fig(T, tint, f, 'carrier2', 'neutral', [6.6, 0, -11.4], { headTilt: bob2 }, { seed: 77 }, { yaw: 0.7 }));
      out.push(fig(T, tint, f, 'boy', 'stern', [-2.6, 0, -6.4], {}, { seed: 75 }, { yaw: -0.4 }));
      break;
    }
    case 'market': {
      const walking = f >= 736 && f < 798;
      const bz = boyMarketZ(f);
      const shake = (f >= 806 && f < 830) || (f >= 836 && f < 847) ? q(4 * Math.sin(f * 0.9), 1) : idleTilt(f, 75);
      out.push(fig(T, tint, f, 'boy', walking ? 'neutral' : 'stern', [-17.6, 0, bz],
        walking ? { mode: 'march', phase: q((f * 0.085) % 1, 2), headTilt: q(2, 1) } : { headTilt: shake }, { seed: 75 }, { yaw: walking ? 0.95 : -0.85 }));
      out.push(fig(T, tint, f, 'sellerHay', 'neutral', [-21.9, 0, 3.3], {}, { seed: 86 }, { yaw: 0.9 }));
      out.push(fig(T, tint, f, 'sellerCotton', 'neutral', [-21.9, 0, -0.9], {}, { seed: 87 }, { yaw: 0.9 }));
      break;
    }
    case 'lampbuy': {
      const give = smooth(ramp(f, 884, 906));
      out.push(fig(T, tint, f, 'sellerLamp', 'smile', [-21.9, 0, -5.3], give > 0 ? { wave: 0.5, headTilt: q(5, 1) } : {}, { seed: 88 }, { yaw: 0.9 }));
      out.push(fig(T, tint, f, 'boy', f >= 879 ? 'smile' : 'neutral', [-18.5, 0, -4.5], f >= 906 ? {} : { wave: 0.45 }, { seed: 75, lampHand: f >= 906 ? 0.5 : 0 }, { yaw: -0.85 }));
      break;
    }
    case 'lampplace': {
      const setting = f >= 975 && f < 1019;
      const dip = setting ? q(0.55 + 0.25 * Math.sin(ramp(f, 975, 1019) * Math.PI), 2) : 0.5;
      out.push(fig(T, tint, f, 'boy', f >= 1019 ? 'smile' : 'neutral', [1.35, 0, -8.2],
        f < 975 ? {} : setting ? { headTilt: q(10, 1) } : {}, { seed: 75, lampHand: f < 975 ? 0.5 : 0 }, { yaw: 0.9 }));
      out.push(fig(T, tint, f, 'villager1', 'neutral', [-2.3, 0, -3.9], {}, { seed: 81 }, { yaw: -0.2 }));
      out.push(fig(T, tint, f, 'villager3', 'neutral', [2.5, 0, -4.1], {}, { seed: 82 }, { yaw: 0.2 }));
      break;
    }
    case 'light': {
      out.push(fig(T, tint, f, 'boy', f >= 1202 ? 'smile' : 'neutral', [1.3, 0, -8.15], {}, { seed: 75 }, { yaw: 0.5 }));
      break;
    }
    case 'verdict': {
      out.push(fig(T, tint, f, 'landlord', f >= 1295 ? 'nervous' : 'stern', LANDLORD, {}, { seed: 71, shawl: true, necklace: true, ring: true, paper: 0.55 }, { yaw: -0.35 }));
      out.push(fig(T, tint, f, 'boy', 'smile', [1.1, 0, 3.75], { wave: 0.4 }, { seed: 75 }, { yaw: 0.5 }));
      crowdAt(T, tint, f, out, 4);
      break;
    }
    case 'hook': {
      out.push(fig(T, tint, f, 'king', 'stern', [10.4, 0, 5.1], f >= 1460 && f < 1530 ? { wave: 0.35 } : {}, { seed: 89, crown: true, ring: true }, { yaw: -0.95 }));
      // the prisoner grins through his beat (1538-1555), then walks out of
      // frame left (march, like the boy's market walk) as the hook board
      // fades in — so the final settle holds the board alone, 100% clear
      const tWalk = f >= 1556 && f < 1588;
      const tPos = [kf([[1556, 7.7], [1588, 6.86]], f), 0, kf([[1556, 3.2], [1588, 2.68]], f)];
      out.push(fig(T, tint, f, 'thief', f >= 1538 ? 'grin' : 'nervous', tPos,
        tWalk ? { mode: 'march', phase: q((f * 0.045) % 1, 2) } : {}, { seed: 72 }, { yaw: tWalk ? 0.95 : 0.15 }));
      out.push(fig(T, tint, f, 'guard', 'stern', [5.8, 0, 1.9], {}, { seed: 73, spear: true, pagdi: 231 }, { yaw: 0.4 }));
      out.push(fig(T, tint, f, 'guard2', 'stern', [13.12, 0, 0.66], {}, { seed: 74, spear: true, pagdi: 222 }, { yaw: -0.4 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, s, t, col) => out.push({ key, draw: (p) => T.fxBurst(p, t, col, 9, 26, 140), x, y, z, blob: false, shadow: false });
  if (f >= 8 && f <= 24) burst('coin_' + q((f - 8) / 16, 2), BOY_FRONT[0] + 0.40, 1.02, BOY_FRONT[2] + 0.05, 0.4, q((f - 8) / 16, 2), '#ffe066');
  if (f >= 1023 && f <= 1041) burst('strike_' + q((f - 1023) / 18, 2), 0, 0.55, -9.2, 0.5, q((f - 1023) / 18, 2), '#ffca6a');
  if (f >= 1296 && f <= 1312) burst('deed_' + q((f - 1296) / 16, 2), 3.75, 1.02, 3.4, 0.4, q((f - 1296) / 16, 2), '#ffe066');
  if (f >= 1540 && f <= 1554) burst('grin_' + q((f - 1540) / 14, 2), 7.7, 1.55, 3.2, 0.35, q((f - 1540) / 14, 2), '#ffe9c0');
  return out;
};
