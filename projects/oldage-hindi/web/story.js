// "कैदी जिसने अपनी मौत ख़ुद चुनी" — Hindi trick batch 2, topic 3.
// Timed DIRECTLY to the Hindi stem (48.77 s, 30 fps, TOTAL 1463) from the
// whisper word timings (oldage-hindi-voice/words.json + gap-clip recovery of
// the 11.3–24.4 s span the full-file pass dropped). Every shot starts on a
// clause boundary; every camera key lands on the word that names its
// subject. Camera Law: the camera TRACKS the voice-named subject, holds
// with a slow push-in, never freezes, never drifts aimlessly. The biggest
// push-in lands on the punch word बुढ़ापे (f667–682).
// Clause map (s): L1 caught 0.00 | astbal 0.92 | range-haathon 1.36 |
// pakda 1.84 | raja-bhadka 2.28 | misaal 3.96 | thaan-li 4.64 || L2 darbar
// 4.98 | dahada 6.38 | chalaki 7.60 | shauk 8.10 | faisla 9.34 | apni-maut
// 9.96 | khud-chun-lo 10.64 | zeher 11.56 | talwar 12.06 | faansi 12.48 |
// jo-chaaho 12.86 | vachan 14.00 | kanoon 14.44 | badloonga-nahi 15.18 ||
// L3 saans-rok 16.98 | jallad 18.14 | aage-badh 18.48 || L4 haath-jodkar
// 19.72 | shanti-se-kaha 20.28 | maharaj 21.16 | main… 21.88 | BUDHAPE
// 22.24 | marna-chahta-hoon 22.74 || L5 sannata 24.12 || L6 vachan-nikal
// 24.88 | ab-vapas-nahi 27.70 || L7 shahi-shart 30.08 | chhoda-gaya 30.66 |
// budhape-tak-jeena 32.10 || L8 mahal-se-azad 33.74 | nikla 35.06 | jallad-
// khali-haath 35.70 | ghar-laut 36.58 || L9 raja-vachan-rakha 37.42 |
// chor-ne-apni-jaan 39.24 || L10 chatur-shabdon 41.06 | ajeeb-bil 42.54 |
// bil-khane-ka-nahi 43.98 | khana-soonghne 45.26 | khushbu-ki-keemat 46.98.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1463, DECK = 0;
export const SHOTS = [
  { id: 'stable', a: 0, b: 149, light: 'day' },
  { id: 'decree', a: 150, b: 487, light: 'golden' },
  { id: 'breath', a: 488, b: 580, light: 'golden' },
  { id: 'punch', a: 581, b: 714, light: 'golden' },
  { id: 'silence', a: 715, b: 873, light: 'golden' },
  { id: 'release', a: 874, b: 996, light: 'golden' },
  { id: 'walkout', a: 997, b: 1122, light: 'golden' },
  { id: 'vachan', a: 1123, b: 1176, light: 'golden' },
  { id: 'jaan', a: 1177, b: 1203, light: 'day' },
  { id: 'hook', a: 1204, b: 1462, light: 'day' },
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
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const THIEF_STABLE = [-14.2, 0, 0.6];
export const KING = [0, 0.62, -3.55];
export const THIEF_COURT = [0, 0.5, -0.7];
export const STAND = [-2.7, 0.5, -2.5];
export const GATE_X = 12.5;
export const HOOK_MAN = [23.1, 0, -0.3];

const stableMarch = (f) => kf3([[128, THIEF_STABLE], [149, [-12.9, 0, 0.55]]], f);
const execBreathPos = (f) => kf3([[544, [7.6, 0.5, -1.6]], [576, [3.2, 0.5, -1.1]]], f);
const walkoutThief = (f) => kf3([[1000, [9.6, 0, -0.2]], [1090, [15.4, 0, -0.2]]], f);
const walkoutExec = (f) => f < 1100 ? kf3([[1005, [7.4, 0, -1.1]], [1075, [11.0, 0, -1.1]]], f)
  : kf3([[1100, [11.0, 0, -1.1]], [1122, [10.1, 0, -1.1]]], f);
const jaanThief = (f) => kf3([[1185, [15.4, 0, -0.2]], [1203, [17.0, 0, -0.2]]], f);

const heroPosAtInner = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'stable': { const p = f >= 128 ? stableMarch(f) : THIEF_STABLE; return [p[0], 1.35, p[2]]; }
    case 'decree': return (f >= 340 && f <= 400) ? [STAND[0], 1.35, STAND[2]] : [KING[0], 1.7, KING[2]];
    case 'breath': return f < 544 ? [THIEF_COURT[0], 1.95, THIEF_COURT[2]] : [3.2, 1.5, -1.1];
    case 'punch': return [THIEF_COURT[0], 2.0, THIEF_COURT[2]];
    case 'silence': return [KING[0], 1.7, KING[2]];
    case 'release': return f < 950 ? [KING[0], 1.7, KING[2]] : [THIEF_COURT[0], 1.92, THIEF_COURT[2]];
    case 'walkout': { const p = walkoutThief(f); return [p[0], 1.35, p[2]]; }
    case 'vachan': return [KING[0], 1.7, KING[2]];
    case 'jaan': { const p = jaanThief(f); return [p[0], 1.35, p[2]]; }
    case 'hook': return [HOOK_MAN[0], 1.45, HOOK_MAN[2]];
    default: return [0, 1, 0];
  }
};
export const heroPosAt = heroPosAtInner;

// ---------- cameras (keys land on clause words; look = voice-named subject) ----------
const CAMS = {
  stable: [
    { f: 0, pos: [-8.4, 2.4, 7.6], look: [-14.2, 1.25, 0.2], fov: 44 },
    { f: 55, pos: [-10.4, 2.0, 5.2], look: [-14.2, 1.3, 0.45], fov: 40, ease: 'surge' },
    { f: 110, pos: [-11.2, 1.9, 4.4], look: [-14.0, 1.35, 0.5], fov: 38, ease: 'surge' },
    { f: 149, pos: [-11.4, 1.9, 4.3], look: [-13.2, 1.35, 0.5], fov: 38 },
  ],
  decree: [
    { f: 150, pos: [5.6, 2.7, 6.8], look: [0, 1.6, -2.2], fov: 44 },
    { f: 191, pos: [3.9, 2.2, 3.9], look: [0, 1.66, -3.5], fov: 38, ease: 'surge' },
    { f: 280, pos: [3.4, 2.05, 3.2], look: [0, 1.66, -3.5], fov: 36, ease: 'surge' },
    { f: 338, pos: [3.2, 2.0, 3.0], look: [-0.3, 1.62, -3.3], fov: 36, ease: 'surge' },
    { f: 347, pos: [0.4, 1.8, 1.8], look: [-3.2, 1.3, -2.5], fov: 34, ease: 'surge' },
    { f: 362, pos: [0.2, 1.8, 1.7], look: [-2.7, 1.38, -2.5], fov: 34, ease: 'surge' },
    { f: 374, pos: [0.0, 1.85, 1.6], look: [-2.2, 1.5, -2.5], fov: 34, ease: 'surge' },
    { f: 400, pos: [1.8, 1.95, 2.6], look: [-0.8, 1.5, -3.0], fov: 36, ease: 'surge' },
    { f: 419, pos: [2.9, 2.05, 3.1], look: [0, 1.66, -3.5], fov: 35, ease: 'surge' },
    { f: 487, pos: [2.6, 2.0, 2.8], look: [0, 1.66, -3.5], fov: 34 },
  ],
  breath: [
    { f: 488, pos: [6.4, 2.8, 8.2], look: [0.4, 1.5, -1.6], fov: 46 },
    { f: 538, pos: [6.0, 2.6, 7.6], look: [0.6, 1.5, -1.5], fov: 44, ease: 'surge' },
    { f: 560, pos: [5.2, 2.2, 5.6], look: [3.4, 1.35, -1.2], fov: 40, ease: 'surge' },
    { f: 580, pos: [4.8, 2.1, 5.0], look: [3.2, 1.4, -1.1], fov: 38 },
  ],
  punch: [
    { f: 581, pos: [1.7, 2.1, 3.6], look: [0, 1.95, -0.7], fov: 40 },
    { f: 628, pos: [1.15, 2.0, 2.3], look: [0, 1.98, -0.7], fov: 36, ease: 'surge' },
    { f: 656, pos: [0.8, 1.97, 2.3], look: [0, 2.0, -0.7], fov: 34, ease: 'surge' },
    { f: 682, pos: [0.5, 1.95, 1.9], look: [0, 2.02, -0.7], fov: 31, ease: 'surge' },
    { f: 714, pos: [0.42, 1.94, 1.7], look: [0, 2.02, -0.7], fov: 30 },
  ],
  silence: [
    { f: 715, pos: [5.0, 2.5, 5.6], look: [0.2, 1.5, -2.6], fov: 43 },
    { f: 768, pos: [4.4, 2.3, 4.6], look: [0, 1.62, -3.4], fov: 40, ease: 'surge' },
    { f: 822, pos: [3.6, 2.15, 3.4], look: [0, 1.6, -3.5], fov: 37, ease: 'surge' },
    { f: 873, pos: [3.3, 2.1, 3.1], look: [0, 1.58, -3.5], fov: 36 },
  ],
  release: [
    { f: 874, pos: [3.4, 2.1, 3.3], look: [0, 1.62, -3.5], fov: 37 },
    { f: 940, pos: [3.2, 2.05, 3.1], look: [0, 1.64, -3.5], fov: 36, ease: 'surge' },
    { f: 955, pos: [1.9, 2.0, 2.6], look: [0, 1.9, -0.7], fov: 36, ease: 'surge' },
    { f: 996, pos: [1.6, 1.95, 2.2], look: [0, 1.92, -0.7], fov: 35 },
  ],
  walkout: [
    { f: 997, pos: [4.6, 2.3, 5.6], look: [9.8, 1.3, -0.3], fov: 42 },
    { f: 1050, pos: [7.4, 2.1, 4.6], look: [12.9, 1.25, -0.2], fov: 40, ease: 'surge' },
    { f: 1085, pos: [9.4, 2.1, 4.4], look: [14.8, 1.3, -0.2], fov: 40, ease: 'surge' },
    { f: 1100, pos: [8.8, 2.1, 4.3], look: [11.6, 1.3, -0.8], fov: 39, ease: 'surge' },
    { f: 1122, pos: [8.6, 1.95, 3.4], look: [10.3, 1.4, -1.05], fov: 36 },
  ],
  vachan: [
    { f: 1123, pos: [3.6, 2.2, 3.8], look: [0, 1.66, -3.5], fov: 38 },
    { f: 1176, pos: [3.3, 2.1, 3.4], look: [0, 1.66, -3.5], fov: 36, ease: 'surge' },
  ],
  jaan: [
    { f: 1177, pos: [11.4, 2.2, 5.4], look: [16.9, 1.35, -0.2], fov: 40 },
    { f: 1203, pos: [12.2, 2.1, 4.8], look: [18.0, 1.35, -0.2], fov: 38, ease: 'surge' },
  ],
  hook: [
    { f: 1204, pos: [17.6, 2.5, 5.8], look: [23.6, 1.4, -1.2], fov: 44 },
    { f: 1265, pos: [19.6, 2.1, 4.0], look: [23.2, 1.35, -0.4], fov: 38, ease: 'surge' },
    { f: 1358, pos: [20.6, 1.95, 3.2], look: [23.5, 1.3, -0.9], fov: 36, ease: 'surge' },
    { f: 1397, pos: [19.0, 2.0, 4.9], look: [23.9, 1.38, -1.55], fov: 41, ease: 'surge' },
    { f: 1462, pos: [17.8, 2.0, 5.2], look: [23.9, 1.35, -1.5], fov: 42 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), hp = heroPosAtInner(f);
  let cinf = 5;
  if (S.id === 'punch' || S.id === 'silence' || S.id === 'release') cinf = 4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardDecree: 0, boardPunch: 0, boardHook: 0, gateOpen: 0 };
  // the king's offer, lettered over the throne while he speaks it
  if (S.id === 'decree') W.boardDecree = smooth(ramp(f, 284, 298)) * (1 - smooth(ramp(f, 316, 330)));
  // the punch word, on the plaque behind the thief
  if (S.id === 'punch') W.boardPunch = smooth(ramp(f, 650, 664)) * (1 - smooth(ramp(f, 682, 694)));
  // the hook question: fades in on the wide pull-back and STAYS — the video
  // ends on the question board
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1424, 1438));
  // the palace gate swings open for the walk-out and stays open
  if (S.id === 'walkout') W.gateOpen = smooth(ramp(f, 1002, 1032));
  if (S.id === 'jaan') W.gateOpen = 1;
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  return {
    smokeRate: 0.25,
    dustRate: S.id === 'stable' ? 0.3 : S.id === 'walkout' ? 0.45 : 0.1,
    steamRate: S.id === 'hook' ? 0.85 : 0,
  };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', golden: '#ffd9a3' };
const tintFor = (S, f) => TINT[S.light] || '#ffffff';
export const OUTFITS = {
  // राजा: royal maroon + gold belt, stout build — crown drawn as an extra
  king: { jacket: '#7d1f2d', pants: '#43222c', boots: '#2a1a12', hat: 'hair', hair: '#241a12', skin: '#eec39b', belt: '#d9a441', moustache: '#241a12', build: 'stout' },
  // चोर: dark simple clothes — the same thief as the treasury story
  thief: { jacket: '#33302e', pants: '#26221f', boots: '#1c1a18', hat: 'hair', hair: '#241c14', skin: '#c98a5a' },
  // जल्लाद: big build, near-black clothes — hood + axe drawn as extras
  exec: { jacket: '#292630', pants: '#1e1c22', boots: '#131116', hat: 'hair', hair: '#171310', skin: '#c08a5c', build: 'stout' },
  guard: { jacket: '#8c2f2a', pants: '#3a2c2c', boots: '#241a14', hat: 'cap', cap: '#7a1f1f', skin: '#b57a4e', belt: true, pagdi: '#a52a24' },
  guard2: { jacket: '#8c2f2a', pants: '#3a2c2c', boots: '#241a14', hat: 'cap', cap: '#7a1f1f', skin: '#d9a878', belt: true, pagdi: '#a52a24' },
  court1: { jacket: '#5d4a7a', pants: '#3a2f4a', boots: '#241a14', hat: 'cap', cap: '#caa64f', skin: '#d9a878' },
  court2: { jacket: '#2e5a6a', pants: '#24404a', boots: '#241a14', hat: 'cap', cap: '#caa64f', skin: '#b57a4e' },
  hookman: { jacket: '#a08b62', pants: '#5f5142', boots: '#4a3a28', hat: 'hair', hair: '#2a2018', skin: '#d9a878' },
  cook: { jacket: '#e3d7bd', pants: '#6a5a44', boots: '#4a3a28', hat: 'cap', cap: '#f4efe4', skin: '#c98a5a' },
};
// Head anchors in pen space (600x1000), from bodyFront's own math:
// adult build: chin = 975 − 5.0·b, head centre hc = 975 − 6.0·b, top = 975 − 7.0·b
// stout build: chin = 975 − 4.94·b, hc = 975 − 5.94·b, top = 975 − 6.94·b (b = headBlob b)
const headGeom = (T, seed, build, sit = false) => {
  const b = T.headBlob(seed, 118, 0).b;
  if (sit) { // bodyFront sit pose: torsoBot = sole − 0.2·HH — the head rides ~2.3b lower
    return build === 'stout'
      ? { chin: 975 - 2.7 * b, hc: 975 - 3.7 * b, top: 975 - 4.7 * b }
      : { chin: 975 - 2.6 * b, hc: 975 - 3.6 * b, top: 975 - 4.6 * b };
  }
  return build === 'stout'
    ? { chin: 975 - 4.94 * b, hc: 975 - 5.94 * b, top: 975 - 6.94 * b }
    : { chin: 975 - 5.0 * b, hc: 975 - 6.0 * b, top: 975 - 7.0 * b };
};
const drawFigure = (T, o, opts, extra) => (p) => {
  if (extra.spear) { // spear first: the hand overdrawing the shaft reads as a grip
    p.stroke([[424, 84], [424, 974]], 7.5, '#6d4a2a');
    p.poly([[424, 26], [411, 90], [437, 90]], '#b9c1c9', 4);
  }
  if (extra.axe) { // the executioner's axe, gripped at the hang hand (416,645)
    if (extra.axe === 'down') { // resting, head down — the empty-handed return
      p.stroke([[424, 585], [446, 948]], 9, '#5d4026');
      p.poly([[420, 580], [502, 598], [498, 660], [418, 644]], '#aeb6bf', 4);
      p.poly([[502, 598], [498, 660], [484, 650], [486, 606]], '#d5dbe2', 2);
    } else { // raised, head high
      p.stroke([[436, 318], [412, 905]], 9, '#5d4026');
      p.poly([[430, 312], [522, 344], [528, 424], [438, 400]], '#aeb6bf', 4);
      p.poly([[522, 344], [528, 424], [506, 414], [504, 354]], '#d5dbe2', 2);
    }
  }
  if (extra.hood) { // hood halo behind the head; the face overdraws it
    const G = headGeom(T, opts.seed, o.build);
    p.ell(300, G.hc + 14, 152, G.hc - G.top + 62, '#1d1a20', 5);
  }
  T.bodyFront(p, o, opts);
  if (extra.hood) { // hood point + shoulder drape over the torso
    const G = headGeom(T, opts.seed, o.build);
    p.poly([[300, G.top - 44], [258, G.top + 22], [342, G.top + 22]], '#1d1a20', 4);
    p.poly([[226, G.chin + 26], [374, G.chin + 26], [400, G.chin + 168], [200, G.chin + 168]], '#232028', 4);
  }
  if (extra.crown) { // the king's crown: gold band, five spikes, red jewel
    const G = headGeom(T, opts.seed, o.build, opts.mode === 'sit');
    const y0 = G.top + 30;
    p.poly([[222, y0 + 26], [378, y0 + 26], [370, y0 - 6], [230, y0 - 6]], '#d9a441', 4);
    for (const sx of [-64, -32, 0, 32, 64]) p.poly([[300 + sx - 11, y0 - 4], [300 + sx + 11, y0 - 4], [300 + sx, y0 - 38 - (sx === 0 ? 8 : 0)]], '#d9a441', 3);
    for (const sx of [-64, -32, 0, 32, 64]) p.dot(300 + sx, y0 - 42 - (sx === 0 ? 8 : 0), 5, '#ffe9a8');
    p.ell(300, y0 + 10, 11, 13, '#a02318', 3);
    p.dot(264, y0 + 10, 6, '#2e7d3a'); p.dot(336, y0 + 10, 6, '#2e5a8c');
  }
  if (extra.decree > 0.02) { // the royal decree gesture: forearm + sceptre rise
    // (bodyFront's sit pose has no wave — the gesture is drawn as an overlay)
    const k = extra.decree, G = headGeom(T, opts.seed, o.build, true);
    const hx = lerp(398, 472, k), hy = lerp(806, 512, k);
    p.stroke([[384, G.chin + 52], [lerp(404, 442, k), lerp(748, 596, k)], [hx, hy]], 25, '#5d1620');
    p.dot(hx, hy, 14, o.skin);
    p.stroke([[hx, hy], [hx + 26, hy - 116]], 7, '#d9a441');
    p.dot(hx + 28, hy - 124, 11, '#d9a441'); p.dot(hx + 28, hy - 124, 5, '#a02318');
  }
  if (extra.namaste) { // folded hands, pressed together at the chest (k: 0→1)
    const k = extra.namaste;
    if (k > 0.02) {
      const arm = '#4a423c';
      const lp = [lerp(184, 289, k), lerp(645, 552, k)], rp = [lerp(416, 311, k), lerp(645, 552, k)];
      p.stroke([[206, 634], lp], 25, arm);
      p.stroke([[394, 634], rp], 25, arm);
      p.poly([[289, 520], [301, 552], [289, 584], [277, 552]], o.skin, 3);
      p.poly([[311, 520], [323, 552], [311, 584], [299, 552]], o.skin, 3);
    }
  }
  if (extra.bill) { // the strangest bill — a paper sheet in the raised hand
    p.poly([[148, 596], [222, 596], [222, 676], [148, 676]], '#e8e0cc', 3);
    p.stroke([[158, 618], [212, 618]], 3, '#8a7a5c');
    p.stroke([[158, 636], [212, 636]], 3, '#8a7a5c');
    p.stroke([[158, 654], [196, 654]], 3, '#8a7a5c');
  }
  if (extra.pagdi) { // wrapped pagdi over the cap: dome + wrap lines + side knot
    const cy = extra.pagdi;
    p.ell(300, cy - 2, 105, 49, o.pagdi, 6);
    p.arc(300, cy + 4, 97, 41, 195, 345, 5, '#7c1d18');
    p.arc(300, cy - 14, 99, 44, 200, 340, 4, '#c8453c');
    p.dot(398, cy - 16, 15, o.pagdi);
    p.poly([[398, cy - 30], [424, cy + 26], [392, cy + 20]], o.pagdi, 4);
  }
};
const A = (T, o, opts, pos, extra = {}) => ({
  key: (extra.tag || 'fig') + JSON.stringify(o) + JSON.stringify(opts) + (extra.crown ? 'C' : '') + (extra.decree ? 'D' + q(extra.decree, 2) : '') + (extra.hood ? 'H' : '') + (extra.axe || '') + (extra.namaste ? 'N' + q(extra.namaste, 2) : '') + (extra.bill ? 'B' : '') + (extra.spear ? 'S' : '') + (extra.pagdi || ''),
  draw: drawFigure(T, o, opts, extra),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra.out,
});
const idleTilt = (f, seed) => q(1.5 * Math.sin(f * 0.037 + seed * 1.3), 1);
const guardAt = (T, tint, f, which, expr, pos, opts = {}, out = {}) => A(T, which === 1 ? OUTFITS.guard : OUTFITS.guard2, { expr, mode: 'stand', blink: blinkAt(f, which === 1 ? 73 : 74), seed: which === 1 ? 73 : 74, headTilt: idleTilt(f, which === 1 ? 73 : 74), ...opts }, pos, { tag: 'grd' + which, spear: opts.spear !== false, pagdi: which === 1 ? 231 : 222, out: { tint, ...out } });
const kingAt = (T, tint, f, expr, opts = {}, out = {}) => { const { decreeK = 0, ...rest } = opts; return A(T, OUTFITS.king, { expr, mode: 'sit', blink: blinkAt(f, 80), seed: 80, headTilt: idleTilt(f, 80), ...rest }, KING, { tag: 'king', crown: true, decree: q(decreeK, 2), out: { tint, s: 1.12, ...out } }); };
const thiefAt = (T, tint, f, expr, pos, opts = {}, out = {}, extra = {}) => A(T, OUTFITS.thief, { expr, mode: 'stand', blink: blinkAt(f, 72), seed: 72, headTilt: idleTilt(f, 72), ...opts }, pos, { tag: 'thf', ...extra, out: { tint, ...out } });
const execAt = (T, tint, f, expr, pos, opts = {}, out = {}) => A(T, OUTFITS.exec, { expr, mode: 'stand', blink: blinkAt(f, 81), seed: 81, headTilt: idleTilt(f, 81), ...opts }, pos, { tag: 'exe', hood: true, axe: opts.axe || 'up', out: { tint, ...out } });

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S, f), out = [];
  const courtCast = (kingExpr, thiefExpr, extraC = {}) => {
    out.push(kingAt(T, tint, f, kingExpr, extraC.kingOpts || {}, extraC.kingOut || {}));
    out.push(thiefAt(T, tint, f, thiefExpr, THIEF_COURT, extraC.thiefOpts || {}, extraC.thiefOut || {}, extraC.thiefExtra || {}));
    out.push(guardAt(T, tint, f, 1, extraC.gExpr || 'stern', [-2.3, 0.5, -0.7], {}, { yaw: 0.35 }));
    out.push(guardAt(T, tint, f, 2, extraC.gExpr || 'stern', [2.3, 0.5, -0.7], {}, { yaw: -0.35 }));
    out.push(A(T, OUTFITS.court1, { expr: extraC.cExpr || 'neutral', mode: 'stand', blink: blinkAt(f, 76), seed: 76, headTilt: idleTilt(f, 76) }, [-3.7, 0.5, -3.3], { tag: 'ct1', out: { tint, yaw: 0.3 } }));
    out.push(A(T, OUTFITS.court2, { expr: extraC.cExpr || 'neutral', mode: 'stand', blink: blinkAt(f, 77), seed: 77, headTilt: idleTilt(f, 77) }, [3.7, 0.5, -3.3], { tag: 'ct2', out: { tint, yaw: -0.3 } }));
  };
  switch (S.id) {
    case 'stable': {
      // caught red-handed: two guards hold the thief by the stable door;
      // in the last beat they march him out toward the court (east)
      const marching = f >= 128;
      const p = marching ? stableMarch(f) : THIEF_STABLE;
      const ph = q((f * 0.09) % 1, 2);
      const mo = marching ? { mode: 'march', phase: ph } : {};
      out.push(thiefAt(T, tint, f, 'nervous', p, { headTilt: q(4 + 1.5 * Math.sin(f * 0.06), 1), ...mo }, { yaw: 0.3 }));
      const g1 = marching ? [p[0] - 1.1, 0, p[2] + 0.1] : [-15.3, 0, 0.7];
      const g2 = marching ? [p[0] + 1.1, 0, p[2] - 0.1] : [-13.1, 0, 0.5];
      out.push(guardAt(T, tint, f, 1, 'stern', g1, mo, { yaw: 0.5 }));
      out.push(guardAt(T, tint, f, 2, 'stern', g2, mo, { yaw: -0.5 }));
      break;
    }
    case 'decree': {
      // the roar (दहाड़ा f191) and the offer: the king gestures with a raised
      // hand; the court bows as he is presented; nobody walks
      const bow = smooth(ramp(f, 152, 172)) * (1 - smooth(ramp(f, 200, 218)));
      const roar = smooth(ramp(f, 186, 200)) * (1 - smooth(ramp(f, 232, 250)));
      const offer = smooth(ramp(f, 296, 312)) * (1 - smooth(ramp(f, 386, 402)));
      const vow = smooth(ramp(f, 414, 430)) * (1 - smooth(ramp(f, 462, 478)));
      const wave = q(Math.max(roar * 0.75, offer * 0.55, vow * 0.7), 2);
      courtCast('stern', 'nervous', {
        kingOpts: { decreeK: wave, headTilt: q(3 * roar + 5 * offer + idleTilt(f, 80) * 0.4, 1) },
        thiefOpts: { headTilt: q(14 * bow + 3, 1) },
        cExpr: f >= 296 ? 'nervous' : 'neutral',
      });
      break;
    }
    case 'breath': {
      // the whole court holds its breath — near-frozen; then जल्लाद steps in
      courtCast('stern', 'nervous', {
        kingOpts: { headTilt: q(2, 1) },
        thiefOpts: { headTilt: q(4, 1) },
        cExpr: 'nervous',
      });
      const stepping = f >= 544 && f < 576;
      const ep = execBreathPos(f);
      out.push(execAt(T, tint, f, 'stern', ep, stepping ? { mode: 'march', phase: q((f * 0.09) % 1, 2) } : {}, { yaw: -0.25 }));
      break;
    }
    case 'punch': {
      // the thief alone in frame: hands fold (हाथ जोड़कर f591–608), then the
      // calm face for महाराज… मैं… बुढ़ापे — nobody else, no movement but his
      const fold = smooth(ramp(f, 591, 610));
      const expr = f < 620 ? 'nervous' : f < 656 ? 'neutral' : 'smile';
      out.push(thiefAt(T, tint, f, expr, THIEF_COURT,
        { headTilt: q(6 * fold + idleTilt(f, 72) * (1 - fold), 1) }, {}, { namaste: q(fold, 2) }));
      break;
    }
    case 'silence': {
      // सन्नाटा — the court's shocked faces; the king, trapped by his own
      // word, sinks as अब वापस नहीं हो सकता था lands (f822+)
      const sink = smooth(ramp(f, 822, 852));
      courtCast(f < 800 ? 'shock' : 'pained', 'smile_closed', {
        kingOpts: { headTilt: q(2 + 9 * sink, 1) },
        thiefOpts: { headTilt: q(3, 1) },
        gExpr: 'shock', cExpr: 'shock',
      });
      out.push(execAt(T, tint, f, f < 822 ? 'stern' : 'dazed', [3.2, 0.5, -1.1], {}, { yaw: -0.25 }));
      break;
    }
    case 'release': {
      // the royal condition: the king decrees with a slow, reluctant wave;
      // the thief kneels (seated) until the camera finds him standing, free
      const decree = smooth(ramp(f, 892, 912)) * (1 - smooth(ramp(f, 940, 952)));
      out.push(kingAt(T, tint, f, 'stern', { decreeK: q(0.6 * decree, 2), headTilt: q(4 + 5 * (1 - decree) * ramp(f, 920, 950), 1) }));
      if (f < 950) {
        out.push(A(T, OUTFITS.thief, { expr: 'neutral', mode: 'sit', blink: blinkAt(f, 72), seed: 72, headTilt: q(5, 1) }, THIEF_COURT, { tag: 'thf', out: { tint } }));
      } else {
        const rise = smooth(ramp(f, 950, 962));
        out.push(thiefAt(T, tint, f, 'relief', THIEF_COURT, { headTilt: q(3 - 2 * rise, 1) }));
      }
      out.push(guardAt(T, tint, f, 1, 'stern', [-2.3, 0.5, -0.7], {}, { yaw: 0.35 }));
      out.push(guardAt(T, tint, f, 2, 'stern', [2.3, 0.5, -0.7], {}, { yaw: -0.35 }));
      out.push(execAt(T, tint, f, 'dazed', [3.2, 0.5, -1.1], {}, { yaw: -0.25 }));
      break;
    }
    case 'walkout': {
      // out of the palace a free man — a SHORT planted walk through the gate;
      // the executioner follows a few steps, stops, and turns back alone
      const marching = f >= 1000 && f < 1090;
      const tp = walkoutThief(f);
      const turned = smooth(ramp(f, 1096, 1114));
      out.push(thiefAt(T, tint, f, f < 1052 ? 'smile' : 'grin', tp,
        marching ? { mode: 'march', phase: q((f * 0.09) % 1, 2) } : { headTilt: idleTilt(f, 72) },
        { yaw: q(0.25 - 0.9 * turned, 2) }));
      const em = (f >= 1005 && f < 1075) || f >= 1100;
      const ep = walkoutExec(f);
      out.push(execAt(T, tint, f, f < 1082 ? 'stern' : 'dazed', ep,
        { ...(em ? { mode: 'march', phase: q((f * 0.09) % 1, 2) } : {}), axe: f >= 1085 ? 'down' : 'up' },
        { yaw: q(-0.2 + (f >= 1092 ? 2.6 * smooth(ramp(f, 1092, 1112)) : 0), 2) }));
      break;
    }
    case 'vachan': {
      // राजा ने अपना वचन रख लिया — a single dignified nod
      const nod = Math.sin(ramp(f, 1144, 1170) * Math.PI);
      out.push(kingAt(T, tint, f, 'neutral', { headTilt: q(2 + 7 * nod, 1) }));
      out.push(guardAt(T, tint, f, 1, 'neutral', [-2.3, 0.5, -0.7], {}, { yaw: 0.35 }));
      out.push(guardAt(T, tint, f, 2, 'neutral', [2.3, 0.5, -0.7], {}, { yaw: -0.35 }));
      break;
    }
    case 'jaan': {
      // …और चोर ने अपनी जान — outside the gate, free, grinning east
      const marching = f >= 1185;
      const tp = jaanThief(f);
      out.push(thiefAt(T, tint, f, 'grin', tp,
        marching ? { mode: 'march', phase: q((f * 0.09) % 1, 2) } : { headTilt: idleTilt(f, 72) },
        { yaw: 0.25 }));
      break;
    }
    case 'hook': {
      // the next story: a poor man, a food stall, and a bill for a SMELL —
      // he reads the paper (f1265), leans in and sniffs the steam (f1358)
      const hasBill = f >= 1252;
      const sniff = smooth(ramp(f, 1352, 1372)) * (1 - smooth(ramp(f, 1392, 1410)));
      out.push(A(T, OUTFITS.hookman, { expr: f < 1319 ? 'neutral' : f < 1397 ? 'nervous' : 'dazed', mode: 'stand', blink: blinkAt(f, 78), seed: 78, headTilt: q(3 + 11 * sniff, 1), wave: hasBill ? 0.4 : undefined }, HOOK_MAN, { tag: 'man', bill: hasBill, out: { tint, yaw: 0.3 } }));
      out.push(A(T, OUTFITS.cook, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 79), seed: 79, headTilt: idleTilt(f, 79), wave: f >= 1440 ? 0.5 : undefined }, [25.7, 0, -3.05], { tag: 'cook', out: { tint, yaw: -0.2 } }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, s, t) => out.push({ key, draw: (p) => T.fxBurst(p, t, '#ffe066', 9, 26, 140), x, y, z, blob: false, shadow: false });
  if (f >= 664 && f <= 682) burst('punch_' + q((f - 664) / 18, 2), -0.2, 2.62, -1.15, 0.4, q((f - 664) / 18, 2));
  if (f >= 1319 && f <= 1335) burst('bill_' + q((f - 1319) / 16, 2), 22.9, 1.55, -0.25, 0.3, q((f - 1319) / 16, 2));
  return out;
};
