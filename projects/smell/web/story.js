// "The Price of a Smell" — trick batch 2, topic 4 (ENGLISH).
// Timed to the English stem (54.771 s, 30 fps, TOTAL 1644). Beat map:
// faster-whisper word alignment (align_lines.py, 194/194 words, match
// 0.954) on the real stem; every shot starts on a clause boundary and
// every camera key lands on the word that names its subject. Camera Law:
// the camera TRACKS the voice-named subject (kebabs -> collar -> purse ->
// owner's ear), holds with a slow push-in, never freezes, never drifts.
// Phrase map (s): L1 0.00 stall | L2 7.18 grab+shout | L3 14.58 drag |
// L4 17.58 crowd | L5 20.06 purse asked | L6 26.10 THE SHAKE |
// L7 31.84 hear? | L8 33.74 heard! | L9 36.20 verdict |
// L10 41.44 purse back | L11 45.20 horses hook.
// Clause anchors (f): grab 251 | shout 276 | pay 406 | dragged 482 |
// asked 652 | purse 681 | hands shook 719 | ear 858 | shook 875 |
// clinks 923/931/941 | hear 968 | heard 1028 | settled 1105 |
// sound 1148 | handed 1252 | every coin 1303 | father 1430 |
// seventeen 1469 | added 1561 | why 1612.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1644, DECK = 0;
export const SHOTS = [
  { id: 'stall', a: 0, b: 214, light: 'golden' },
  { id: 'grab', a: 215, b: 436, light: 'golden' },
  { id: 'drag', a: 437, b: 526, light: 'golden' },
  { id: 'crowd', a: 527, b: 601, light: 'golden' },
  { id: 'purse', a: 602, b: 782, light: 'golden' },
  { id: 'shake', a: 783, b: 954, light: 'golden' },
  { id: 'suna', a: 955, b: 1085, light: 'golden' },
  { id: 'verdict', a: 1086, b: 1242, light: 'golden' },
  { id: 'return', a: 1243, b: 1355, light: 'golden' },
  { id: 'hook', a: 1356, b: 1643, light: 'day' },
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

// ---------- staging (mirrors main.js set: stall origin, court x=26, farm x=48) ----------
export const STONE = [1.5, 0, 1.05];            // traveller's sitting-stone by the stall
export const COUNTER = [0.45, 0, -2.02];        // owner behind the counter
export const QAZI_SEAT = [26, 1.05, -1.7];      // seated on the takht (card y = hip rest)
export const COURT_T = [24.35, 0.5, 0.95];      // traveller before the qazi (front-left)
export const COURT_O = [27.65, 0.5, 0.95];      // owner before the qazi (front-right)
export const TRAV_WAIT = [22.6, 0, 3.4];      // traveller waits below the steps during shake/suna/verdict
const dragPos = (f) => kf3([[437, [9.0, 0, 1.7]], [526, [22.5, 0, 1.7]]], f);
const arrivePos = (who, f) => who === 't'
  ? kf3([[527, [24.2, 0, 4.15]], [551, [24.45, 0.17, 3.9]], [569, [24.65, 0.34, 3.35]], [586, [24.8, 0.5, 2.8]], [595, COURT_T]], f)
  : kf3([[527, [25.6, 0, 4.35]], [551, [25.85, 0.17, 4.1]], [569, [26.9, 0.34, 3.5]], [586, [27.05, 0.5, 2.95]], [595, COURT_O]], f);
const ownerGrabPos = (f) => kf3([[215, COUNTER], [244, [1.8, 0, -0.7]], [251, [1.06, 0, 0.68]]], f);
// the owner steps in close beside the qazi, at the SAME depth, so the
// qazi's raised purse can sit right at his ear (fix pass: at z -0.3 the
// owner loomed nearer/larger and the purse hung at counter height,
// far below and away from his ear).
export const EAR_POS = [26.28, 0.5, -1.0];
const ownerEarPos = (f) => kf3([[783, COURT_O], [858, EAR_POS]], f);
export const heroPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'stall': return [STONE[0], 1.1, STONE[2]];
    case 'grab': { const p = ownerGrabPos(f); return [p[0], 1.2, p[2]]; }
    case 'drag': { const p = dragPos(f); return [p[0], 1.1, p[2]]; }
    case 'crowd': { const p = arrivePos('t', f); return [p[0], 1.1, p[2]]; }
    case 'purse': return [COURT_T[0], 1.3, COURT_T[2]];
    case 'shake': case 'suna': case 'verdict': return [25.55, 1.6, -1.2];
    case 'return': return [COURT_T[0], 1.3, COURT_T[2]];
    case 'hook': return f < 1561 ? [45.6, 1.2, 0.55] : [43.2, 1.3, 0.8];
    default: return [0, 1, 0];
  }
};

// ---------- cameras (keys land on clause words; look = voice-named subject) ----------
const CAMS = {
  stall: [ // wide stall + board -> the grill -> the traveller eating dry bread
    { f: 0, pos: [-5.6, 2.95, 8.0], look: [0.85, 1.52, -1.15], fov: 46 },
    { f: 102, pos: [-2.8, 2.0, 5.2], look: [1.2, 1.05, 0.6], fov: 40, ease: 'surge' },
    { f: 180, pos: [0.4, 1.65, 4.3], look: [1.45, 1.1, 0.95], fov: 37, ease: 'surge' },
    { f: 214, pos: [0.7, 1.6, 4.05], look: [1.45, 1.12, 0.95], fov: 36 },
  ],
  grab: [ // owner behind the counter -> he comes around -> COLLAR (side-on) -> the shout
    { f: 215, pos: [4.9, 2.1, 5.0], look: [0.45, 1.25, -2.0], fov: 42 },
    { f: 245, pos: [3.4, 1.85, 4.6], look: [1.35, 1.15, 0.1], fov: 39, ease: 'surge' },
    { f: 251, pos: [-0.7, 1.65, 3.5], look: [1.34, 1.3, 0.9], fov: 36, ease: 'surge' },
    { f: 276, pos: [-0.45, 1.6, 3.3], look: [1.3, 1.32, 0.88], fov: 35, ease: 'surge' },
    { f: 436, pos: [-0.3, 1.62, 3.35], look: [1.3, 1.3, 0.88], fov: 35 },
  ],
  drag: [ // side-tracking dolly: the pair marches the dirt road to the court
    { f: 437, pos: [4.6, 2.1, 6.6], look: [9.5, 1.1, 1.6], fov: 43 },
    { f: 526, pos: [18.2, 2.1, 6.6], look: [22.8, 1.1, 1.5], fov: 43 },
  ],
  crowd: [ // court wide: the crowd gathers, the pair climbs the steps
    { f: 527, pos: [20.8, 3.1, 10.4], look: [26.3, 1.2, 0.2], fov: 46 },
    { f: 569, pos: [21.6, 2.8, 9.4], look: [26.35, 1.25, 0.3], fov: 44, ease: 'surge' },
    { f: 601, pos: [22.3, 2.6, 8.6], look: [26.4, 1.25, 0.4], fov: 42 },
  ],
  purse: [ // the qazi listens; the purse is asked; the hands shake
    { f: 602, pos: [23.1, 2.0, 3.9], look: [25.9, 1.5, -1.7], fov: 40 },
    { f: 652, pos: [23.7, 1.88, 3.1], look: [25.4, 1.45, -1.1], fov: 37, ease: 'surge' },
    { f: 719, pos: [23.7, 1.86, 3.05], look: [25.25, 1.42, -0.95], fov: 36, ease: 'surge' },
    { f: 782, pos: [23.8, 1.87, 3.0], look: [25.25, 1.42, -0.95], fov: 36 },
  ],
  shake: [ // THE BEAT: purse to the owner's ear — the closest push-in of the film, side-on pair
    { f: 783, pos: [24.7, 2.1, 4.4], look: [25.8, 1.6, -1.0], fov: 42 },
    { f: 858, pos: [25.1, 2.0, 3.9], look: [25.8, 1.7, -0.85], fov: 40, ease: 'surge' },
    { f: 875, pos: [25.35, 1.95, 3.5], look: [25.8, 1.78, -0.75], fov: 40, ease: 'surge' },
    { f: 954, pos: [25.45, 1.95, 3.45], look: [25.8, 1.78, -0.75], fov: 40 },
  ],
  suna: [ // "Did you hear that?" on the qazi -> swing to the stunned owner: "Yes, I heard it!"
    { f: 955, pos: [23.9, 1.92, 2.2], look: [25.7, 1.6, -1.3], fov: 37 },
    { f: 1028, pos: [24.3, 1.88, 1.7], look: [25.9, 1.75, -0.35], fov: 35, ease: 'surge' },
    { f: 1085, pos: [24.4, 1.88, 1.65], look: [25.9, 1.75, -0.35], fov: 35 },
  ],
  verdict: [ // the verdict, with the PRICE board rising over the takht
    { f: 1086, pos: [25.2, 2.4, 5.2], look: [26.0, 2.1, -2.6], fov: 41 },
    { f: 1171, pos: [25.35, 2.35, 4.8], look: [25.95, 2.0, -2.4], fov: 40, ease: 'surge' },
    { f: 1242, pos: [25.4, 2.35, 4.75], look: [25.95, 2.0, -2.4], fov: 40 },
  ],
  return: [ // the purse comes back — every coin inside
    { f: 1243, pos: [23.3, 1.95, 3.6], look: [25.0, 1.4, 0.2], fov: 38 },
    { f: 1303, pos: [23.8, 1.9, 3.2], look: [24.75, 1.45, 0.6], fov: 36, ease: 'surge' },
    { f: 1355, pos: [23.9, 1.9, 3.15], look: [24.75, 1.45, 0.6], fov: 36 },
  ],
  hook: [ // the farm: father, three sons, the horse pen — then the judge's own horse
    { f: 1356, pos: [38.6, 2.8, 7.4], look: [46.0, 1.15, -1.6], fov: 46 },
    { f: 1430, pos: [41.3, 2.1, 4.6], look: [45.9, 1.2, 0.2], fov: 40, ease: 'surge' },
    { f: 1561, pos: [40.9, 1.95, 3.6], look: [43.4, 1.3, 0.7], fov: 37, ease: 'surge' },
    { f: 1612, pos: [41.2, 2.05, 4.6], look: [48.6, 1.5, -1.4], fov: 40, ease: 'surge' },
    { f: 1643, pos: [41.35, 2.05, 4.65], look: [48.7, 1.5, -1.4], fov: 40 },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
const SUBJECT = {
  stall: [1.5, 1.1, 1.05], grab: [1.3, 1.3, 0.85], crowd: [25.2, 1.2, 1.2],
  purse: [25.3, 1.45, -1.1], shake: [25.8, 1.8, -0.7], suna: [25.5, 1.7, -0.8],
  verdict: [26, 1.65, -1.9], return: [24.85, 1.3, 0.55], hook: [45.9, 1.2, 0.2],
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let sub = SUBJECT[S.id];
  if (S.id === 'drag') { const p = dragPos(f); sub = [p[0], 1.15, p[2]]; }
  if (S.id === 'hook' && f >= 1561) sub = [43.2, 1.3, 0.7];
  const d = Math.hypot(C.pos[0] - sub[0], C.pos[1] - sub[1], C.pos[2] - sub[2]);
  return { focus: d, cinf: (S.id === 'shake' || S.id === 'suna') ? 4 : 5 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardStall: 0, boardVerdict: 0, boardHook: 0, emberK: 0 };
  if (S.id === 'stall') W.boardStall = 1 - smooth(ramp(f, 107, 128));
  if (S.id === 'verdict') W.boardVerdict = smooth(ramp(f, 1105, 1120)) * (1 - smooth(ramp(f, 1218, 1238)));
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1603, 1617));
  W.emberK = (S.id === 'stall' || S.id === 'grab') ? 1 : S.id === 'drag' ? 0.3 : 0;
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  const grill = { stall: 0.9, grab: 0.5, drag: 0.15, crowd: 0.06, purse: 0.06, shake: 0.06, suna: 0.06, verdict: 0.06, return: 0.06, hook: 0.06 }[S.id];
  const haze = { stall: 0.22, grab: 0.22, drag: 0.3, crowd: 0.18, purse: 0.18, shake: 0.18, suna: 0.18, verdict: 0.18, return: 0.18, hook: 0.22 }[S.id];
  return { grillRate: grill, smokeRate: haze };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', golden: '#ffd9a3', night: '#aebedd' };
export const OUTFITS = {
  // the poor traveller: faded worn kurta, hair, his purse in hand
  traveller: { jacket: '#8a7a5c', pants: '#6a5a44', boots: '#4a3a28', hat: 'hair', hair: '#2a2018', skin: '#b57a4e' },
  // the rich stall owner: clean cream kurta + topi, prosperous
  owner: { jacket: '#efe6cf', pants: '#7a6a4f', boots: '#5a4630', hat: 'cap', cap: '#f4efe4', skin: '#c98a5a' },
  // the judge (qazi): deep-green judge's robe; pagdi drawn as an overlay (stand cy 231, sit cy 439, seed 73)
  qazi: { jacket: '#274435', pants: '#1f2a22', boots: '#241a14', hat: 'cap', cap: '#f4efe4', skin: '#d9a878' },
  crowd1: { jacket: '#7a6248', pants: '#54432e', boots: '#3a2c1c', hat: 'hair', hair: '#1f180f', skin: '#a06a3e' },
  crowd2: { jacket: '#5d6a72', pants: '#3e4a44', boots: '#2e2a24', hat: 'cap', cap: '#cbbfa5', skin: '#c98a5a' },
  crowd3: { jacket: '#96754a', pants: '#5e4c30', boots: '#40321e', hat: 'hair', hair: '#33261a', skin: '#8a5a34' },
  father: { jacket: '#6e5136', pants: '#4a3826', boots: '#33261a', hat: 'hair', hair: '#3a2c1c', skin: '#b57a4e' },
  son1: { jacket: '#7d8a5a', pants: '#55603c', boots: '#3c3423', hat: 'hair', hair: '#241c14', skin: '#c98a5a', build: 'kid' },
  son2: { jacket: '#94714a', pants: '#66502f', boots: '#453520', hat: 'hair', hair: '#2a2018', skin: '#a06a3e' },
  son3: { jacket: '#687d94', pants: '#47586c', boots: '#2f3a46', hat: 'cap', cap: '#d8cdb2', skin: '#d9a878' },
};
const drawFigure = (T, o, opts, extra) => (p) => {
  T.bodyFront(p, o, opts);
  if (extra.breadLap) { // the dry bread in the seated traveller's lap (sit mode draws no held props)
    p.ell(392, 928, 37, 28, '#b98d54', 3);
    p.ell(392, 928, 31, 22, '#dcb87e', 0);
    p.dot(380, 920, 4, '#a87c44'); p.dot(402, 934, 3.4, '#a87c44'); p.dot(396, 916, 2.8, '#a87c44');
  }
  if (extra.pagdi) { // wrapped pagdi over the cap: dome + wrap lines + side knot
    const cy = extra.pagdi;
    p.ell(300, cy - 2, 105, 49, '#1e4630', 6);
    p.arc(300, cy + 4, 97, 41, 195, 345, 5, '#12291c');
    p.arc(300, cy - 14, 99, 44, 200, 340, 4, '#c9a44a');
    p.dot(398, cy - 16, 15, '#1e4630');
    p.poly([[398, cy - 30], [424, cy + 26], [392, cy + 20]], '#1e4630', 4);
  }
};
const A = (T, o, opts, pos, extra = {}) => ({
  key: (extra.tag || 'fig') + JSON.stringify(o) + JSON.stringify(opts) + (extra.pagdi || '') + (extra.breadLap ? 'B' : ''),
  draw: drawFigure(T, o, opts, extra),
  x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra.out,
});
const idleTilt = (f, seed) => q(1.5 * Math.sin(f * 0.037 + seed * 1.3), 1);
const qaziSit = (T, tint, f, expr, opts = {}) => A(T, OUTFITS.qazi, { expr, mode: 'sit', blink: blinkAt(f, 73), seed: 73, headTilt: idleTilt(f, 73), ...opts }, QAZI_SEAT, { tag: 'qaz', pagdi: 498, out: { tint } });
const qaziStand = (T, tint, f, expr, pos, opts = {}, out = {}) => A(T, OUTFITS.qazi, { expr, mode: 'stand', blink: blinkAt(f, 73), seed: 73, headTilt: idleTilt(f, 73), ...opts }, pos, { tag: 'qaz', pagdi: 231, out: { tint, ...out } });
const travellerAt = (T, tint, f, expr, pos, opts = {}, out = {}) => A(T, OUTFITS.traveller, { expr, blink: blinkAt(f, 72), seed: 72, headTilt: idleTilt(f, 72), ...opts }, pos, { tag: 'trv', out: { tint, ...out } });
const ownerAt = (T, tint, f, expr, pos, opts = {}, out = {}) => A(T, OUTFITS.owner, { expr, blink: blinkAt(f, 71), seed: 71, headTilt: idleTilt(f, 71), ...opts }, pos, { tag: 'own', out: { tint, ...out } });

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = TINT[S.light] || '#ffffff', out = [];
  switch (S.id) {
    case 'stall': {
      // owner tends the grill behind the counter, skewer in hand
      out.push(ownerAt(T, tint, f, 'neutral', COUNTER, { mode: 'stand', prop: ['skewer', q(0.45 + 0.08 * Math.sin(f * 0.21), 2)], headTilt: q(6, 1) }, { yaw: 0.15 }));
      // the traveller sits on his stone, dry bread in his lap; the smell reaches him
      const dreamy = f >= 132;
      out.push(A(T, OUTFITS.traveller, { expr: dreamy ? 'smile' : 'neutral', mode: 'sit', blink: blinkAt(f, 72), seed: 72, headTilt: q(dreamy ? -3 : 7, 1) }, [STONE[0], 0.16, STONE[2]], { tag: 'trv', breadLap: true, out: { tint, yaw: -0.2 } }));
      break;
    }
    case 'grab': {
      const marching = f < 251;
      const p = ownerGrabPos(f);
      out.push(ownerAt(T, tint, f, 'stern', p, marching
        ? { mode: 'march', phase: q((f * 0.09) % 1, 2) }
        : { mode: 'stand', wave: 0.72, headTilt: q(5, 1) }, { yaw: -0.3 }));
      // the traveller scrambles up off the stone as the hand lands on his collar
      const up = f >= 247;
      const tp = up ? [1.62, 0, 1.14] : [STONE[0], 0.16, STONE[2]];
      out.push(travellerAt(T, tint, f, f < 251 ? 'neutral' : f < 276 ? 'shock' : 'nervous', tp,
        up ? { mode: 'stand', headTilt: q(-7, 1) } : { mode: 'sit', headTilt: q(7, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'drag': {
      // a short planted-foot march: the owner hauls, the traveller resists
      const p = dragPos(f), ph = q((f * 0.09) % 1, 2);
      out.push(ownerAt(T, tint, f, 'stern', [p[0] + 0.55, 0, p[2] - 0.25], { mode: 'march', phase: ph, wave: 0.55, headTilt: q(6, 1) }, { yaw: 0.1 }));
      out.push(travellerAt(T, tint, f, 'nervous', [p[0] - 0.55, 0, p[2] + 0.3], { mode: 'march', phase: q((ph + 0.5) % 1, 2), prop: ['purse', 0.3], headTilt: q(-5, 1) }, { yaw: 0.1 }));
      break;
    }
    case 'crowd': {
      out.push(qaziSit(T, tint, f, 'stern'));
      const tp = arrivePos('t', f), op = arrivePos('o', f);
      const marching = f < 595;
      out.push(ownerAt(T, tint, f, 'stern', op, marching ? { mode: 'march', phase: q((f * 0.09) % 1, 2), wave: 0.5 } : { mode: 'stand', wave: 0.5 }, { yaw: -0.2 }));
      out.push(travellerAt(T, tint, f, 'nervous', tp, marching ? { mode: 'march', phase: q(((f * 0.09) + 0.5) % 1, 2), prop: ['purse', 0.3] } : { mode: 'stand', prop: ['purse', 0.3], headTilt: q(-4, 1) }, { yaw: 0.2 }));
      // the crowd gathers at the platform's edges — sure the poor man is finished
      out.push(A(T, OUTFITS.crowd1, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 76), seed: 76, headTilt: idleTilt(f, 76) }, [22.2, 0, 6.2], { tag: 'cr1', out: { tint, yaw: 0.45 } }));
      out.push(A(T, OUTFITS.crowd2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 77), seed: 77, headTilt: idleTilt(f, 77), wave: f >= 563 ? 0.45 : 0 }, [28.8, 0, 6.3], { tag: 'cr2', out: { tint, yaw: -0.3 } }));
      out.push(A(T, OUTFITS.crowd3, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 78), seed: 78, headTilt: idleTilt(f, 78) }, [30.3, 0, 5.6], { tag: 'cr3', out: { tint, yaw: -0.5 } }));
      break;
    }
    case 'purse': {
      // the qazi listens in silence; at ASKED the traveller holds out his purse;
      // through HANDS SHOOK his hands tremble — the purse trembles with them
      const asked = f >= 652;
      const tremble = f >= 713 && f < 763 ? q(0.045 * Math.sin(f * 1.7), 3) : 0;
      out.push(qaziSit(T, tint, f, f < 667 ? 'neutral' : 'stern', { headTilt: q(f < 652 ? 5 : 2, 1) }));
      out.push(ownerAt(T, tint, f, 'stern', COURT_O, { mode: 'stand' }, { yaw: -0.25 }));
      out.push(travellerAt(T, tint, f, f < 652 ? 'nervous' : 'pained', COURT_T,
        { mode: 'stand', prop: ['purse', q((asked ? 0.58 : 0.3) + tremble, 3)], headTilt: q(asked ? 10 + (tremble ? 2 * Math.sin(f * 1.7) : 0) : 4, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'shake': {
      // the qazi RISES with the purse, steps to the takht's edge and holds it
      // UP by the owner's ear; at SHOOK he shakes — clink, clink, clink.
      // earK/earL drive the kit's prop arm (low k = hand raised; prop[2] =
      // extra reach height in HH, see toon.js PATCH 2). The purse lifts as
      // the owner arrives (845->858), jiggles through the clinks and stays
      // up at the ear into 'suna' (fix pass: k was ~0.6 with no lift, which
      // hung the hand — and the purse — down at waist/counter height).
      // The qazi also steps a touch toward the owner as he rises (25.68).
      const risen = f >= 800;
      const earK = f < 845 ? 0.5
        : f < 858 ? q(lerp(0.5, 0.05, smooth(ramp(f, 845, 858))), 3)
        : f < 875 ? 0.05
        : f < 950 ? q(0.06 + 0.04 * Math.sin((f - 875) * 2.1), 3) : 0.07;
      const earL = f < 845 ? 0
        : f < 858 ? q(lerp(0, 0.45, smooth(ramp(f, 845, 858))), 3) : 0.45;
      if (!risen) out.push(qaziSit(T, tint, f, 'stern', { headTilt: q(4, 1) }));
      else out.push(qaziStand(T, tint, f, 'stern', [25.68, 0.5, -1.2], { prop: ['purse', earK, earL], headTilt: q(7, 1) }, { yaw: 0.3 }));
      const op = ownerEarPos(f);
      const omarch = f < 858;
      out.push(ownerAt(T, tint, f, f < 923 ? 'neutral' : 'shock', op, omarch ? { mode: 'march', phase: q((f * 0.09) % 1, 2) } : { mode: 'stand', headTilt: q(3, 1) }, { yaw: -0.35 }));
      // until the qazi rises and takes it, the purse hangs in the waiting traveller's hand
      out.push(travellerAt(T, tint, f, 'nervous', TRAV_WAIT, risen ? { mode: 'stand', headTilt: q(6, 1) } : { mode: 'stand', prop: ['purse', 0.32], headTilt: q(6, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'suna': {
      // the purse stays UP at the owner's ear while the qazi asks (fix pass)
      out.push(qaziStand(T, tint, f, 'stern', [25.68, 0.5, -1.2], { prop: ['purse', 0.05, 0.45], headTilt: q(3, 1) }, { yaw: 0.3 }));
      // the owner's stunned nod at "Yes, I heard it!"
      const nod = f >= 1028 && f < 1060 ? q(7 * Math.sin((f - 1028) * 0.32), 1) : 0;
      out.push(ownerAt(T, tint, f, f < 1028 ? 'neutral' : 'shock', EAR_POS, { mode: 'stand', headTilt: nod }, { yaw: -0.35 }));
      out.push(travellerAt(T, tint, f, 'nervous', TRAV_WAIT, { mode: 'stand', headTilt: q(5, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'verdict': {
      // the qazi lowers the purse from the ear as the verdict begins and
      // the owner steps back to his place (both settle by SETTLED, f1105)
      const vK = f < 1105 ? q(lerp(0.05, 0.5, smooth(ramp(f, 1086, 1105))), 3) : 0.5;
      const vL = f < 1105 ? q(lerp(0.45, 0, smooth(ramp(f, 1086, 1105))), 3) : 0;
      out.push(qaziStand(T, tint, f, f < 1184 ? 'stern' : 'smile', [25.68, 0.5, -1.2], { prop: ['purse', vK, vL], headTilt: q(2, 1) }, { yaw: 0.25 }));
      const vop = kf3([[1086, EAR_POS], [1105, [26.1, 0.5, -0.3]]], f);
      out.push(ownerAt(T, tint, f, 'dazed', vop, f < 1105 ? { mode: 'march', phase: q((f * 0.09) % 1, 2), headTilt: q(9, 1) } : { mode: 'stand', headTilt: q(9, 1) }, { yaw: -0.3 }));
      out.push(travellerAt(T, tint, f, f < 1184 ? 'nervous' : 'relief', TRAV_WAIT, { mode: 'stand', headTilt: q(4, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'return': {
      // the purse changes hands one last time — back to its owner, coins inside
      const back = f >= 1247;
      out.push(qaziStand(T, tint, f, 'smile', [25.55, 0.5, -1.2], back ? {} : { prop: ['purse', 0.5] }, { yaw: 0.25 }));
      out.push(ownerAt(T, tint, f, 'dazed', [26.1, 0.5, -0.3], { mode: 'stand', headTilt: q(12, 1) }, { yaw: -0.5 }));
      out.push(travellerAt(T, tint, f, f < 1303 ? 'relief' : 'smile', COURT_T,
        back ? { mode: 'stand', prop: ['purse', q(0.5 + 0.04 * Math.sin(f * 0.25), 2)], headTilt: q(-2, 1) } : { mode: 'stand', headTilt: q(4, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'hook': {
      // father + three sons by the pen, baffled by seventeen horses
      out.push(A(T, OUTFITS.father, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 79), seed: 79, headTilt: q(6 + 1.5 * Math.sin(f * 0.04), 1), wave: f >= 1469 && f < 1525 ? 0.35 : 0 }, [45.6, 0, 0.55], { tag: 'fth', out: { tint, yaw: -0.2 } }));
      out.push(A(T, OUTFITS.son1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 80), seed: 80, headTilt: idleTilt(f, 80) }, [44.2, 0, 0.5], { tag: 'sn1', out: { tint, yaw: 0.15 } }));
      out.push(A(T, OUTFITS.son2, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 81), seed: 81, headTilt: idleTilt(f, 81) }, [47.0, 0, 0.6], { tag: 'sn2', out: { tint, yaw: -0.1 } }));
      out.push(A(T, OUTFITS.son3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 82), seed: 82, headTilt: idleTilt(f, 82) }, [48.3, 0, 0.45], { tag: 'sn3', out: { tint, yaw: -0.25 } }));
      // the qazi stands by his OWN horse; at ADDED he steps up and presents it
      const stepped = f >= 1561;
      const qp = stepped ? kf3([[1561, [42.85, 0, 0.85]], [1577, [43.6, 0, 0.8]]], f) : [42.85, 0, 0.85];
      out.push(qaziStand(T, tint, f, stepped ? 'smile' : 'neutral', qp, stepped ? { mode: f < 1577 ? 'march' : 'stand', phase: q((f * 0.09) % 1, 2), wave: f >= 1577 ? 0.5 : 0 } : {}, { yaw: 0.45 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, s, t) => out.push({ key, draw: (p) => T.fxBurst(p, t, '#ffe066', 9, 26, 140), x, y, z, blob: false, shadow: false });
  // coin glints riding the spoken clink-clink-clink, at the purse by the owner's ear
  for (const [f0, nm] of [[923, 'c1'], [931, 'c2'], [941, 'c3']])
    if (f >= f0 && f <= f0 + 14) burst(nm + '_' + q((f - f0) / 14, 2), 25.85, 1.98, -0.62, 0.34, q((f - f0) / 14, 2));
  // every coin still inside: a glint at the returned purse
  if (f >= 1303 && f <= 1317) burst('safe_' + q((f - 1303) / 14, 2), 24.15, 1.32, 1.1, 0.3, q((f - 1303) / 14, 2));
  // the added horse: a glint by its head as the qazi presents it
  if (f >= 1563 && f <= 1577) burst('horse_' + q((f - 1563) / 14, 2), 42.8, 1.72, 1.15, 0.3, q((f - 1563) / 14, 2));
  return out;
};
