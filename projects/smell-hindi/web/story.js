// "खुशबू की कीमत" — Hindi trick batch 2, topic 4.
// Timed to the Hindi stem (47.851 s, 30 fps, TOTAL 1436). Beat map: two
// align_hi2 (faster-whisper small) phrase maps averaged, cross-checked
// against the stem's measured silence points (18.72-18.86, 29.54-29.68,
// 46.67-46.82) and onset bursts; clause anchors by word-proportion inside
// each phrase. Every shot starts on a clause boundary; every camera key
// lands on the word that names its subject. Camera Law: the camera TRACKS
// the voice-named subject (kebabs -> collar -> purse -> owner's ear),
// holds with a slow push-in, never freezes, never drifts aimlessly.
// Phrase map (s): L1 0.00 stall | L2 5.49 grab+shout | L3 12.27 drag |
// L4 15.81 crowd | L5 18.93 purse asked | L6 25.55 THE SHAKE |
// L7 30.05 suna? | L8 31.77 haan suna | L9 34.02 verdict |
// L10 38.25 purse back | L11 40.86 horses hook.
// Clause anchors (f): grab 204 | shout 231 | mangi 666 | kaanp 703 |
// kaan 807 | hilai 862 | clinks 869/877/884 | faisla 1030 | har-sikka 1187 |
// baap 1284 | satrah 1305 | jod-diya 1404 | kyon 1419.
import { M, camFromKeys, blinkAt, q, clamp, lerp, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1436, DECK = 0;
export const SHOTS = [
  { id: 'stall', a: 0, b: 164, light: 'golden' },
  { id: 'grab', a: 165, b: 367, light: 'golden' },
  { id: 'drag', a: 368, b: 475, light: 'golden' },
  { id: 'crowd', a: 476, b: 567, light: 'golden' },
  { id: 'purse', a: 568, b: 766, light: 'golden' },
  { id: 'shake', a: 767, b: 901, light: 'golden' },
  { id: 'suna', a: 902, b: 1020, light: 'golden' },
  { id: 'verdict', a: 1021, b: 1147, light: 'golden' },
  { id: 'return', a: 1148, b: 1225, light: 'golden' },
  { id: 'hook', a: 1226, b: 1435, light: 'day' },
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
const dragPos = (f) => kf3([[368, [9.0, 0, 1.7]], [475, [22.5, 0, 1.7]]], f);
const arrivePos = (who, f) => who === 't'
  ? kf3([[476, [24.2, 0, 4.15]], [505, [24.45, 0.17, 3.9]], [528, [24.65, 0.34, 3.35]], [548, [24.8, 0.5, 2.8]], [560, COURT_T]], f)
  : kf3([[476, [25.6, 0, 4.35]], [505, [25.85, 0.17, 4.1]], [528, [26.9, 0.34, 3.5]], [548, [27.05, 0.5, 2.95]], [560, COURT_O]], f);
const ownerGrabPos = (f) => kf3([[165, COUNTER], [196, [1.8, 0, -0.7]], [204, [1.06, 0, 0.68]]], f);
const ownerEarPos = (f) => kf3([[767, COURT_O], [807, [26.1, 0.5, -0.3]]], f);
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
    case 'hook': return f < 1404 ? [45.6, 1.2, 0.55] : [43.2, 1.3, 0.8];
    default: return [0, 1, 0];
  }
};

// ---------- cameras (keys land on clause words; look = voice-named subject) ----------
const CAMS = {
  stall: [ // wide stall + board -> the grill -> the traveller eating dry bread
    { f: 0, pos: [-5.6, 2.95, 8.0], look: [0.85, 1.52, -1.15], fov: 46 },
    { f: 78, pos: [-2.8, 2.0, 5.2], look: [1.2, 1.05, 0.6], fov: 40, ease: 'surge' },
    { f: 138, pos: [0.4, 1.65, 4.3], look: [1.45, 1.1, 0.95], fov: 37, ease: 'surge' },
    { f: 164, pos: [0.7, 1.6, 4.05], look: [1.45, 1.12, 0.95], fov: 36 },
  ],
  grab: [ // owner behind the counter -> he comes around -> COLLAR (side-on) -> the shout
    { f: 165, pos: [4.9, 2.1, 5.0], look: [0.45, 1.25, -2.0], fov: 42 },
    { f: 192, pos: [3.4, 1.85, 4.6], look: [1.35, 1.15, 0.1], fov: 39, ease: 'surge' },
    { f: 204, pos: [-0.7, 1.65, 3.5], look: [1.34, 1.3, 0.9], fov: 36, ease: 'surge' },
    { f: 231, pos: [-0.45, 1.6, 3.3], look: [1.3, 1.32, 0.88], fov: 35, ease: 'surge' },
    { f: 367, pos: [-0.3, 1.62, 3.35], look: [1.3, 1.3, 0.88], fov: 35 },
  ],
  drag: [ // side-tracking dolly: the pair marches the dirt road to the court
    { f: 368, pos: [4.6, 2.1, 6.6], look: [9.5, 1.1, 1.6], fov: 43 },
    { f: 475, pos: [18.2, 2.1, 6.6], look: [22.8, 1.1, 1.5], fov: 43 },
  ],
  crowd: [ // court wide: the crowd gathers, the pair climbs the steps
    { f: 476, pos: [20.8, 3.1, 10.4], look: [26.3, 1.2, 0.2], fov: 46 },
    { f: 528, pos: [21.6, 2.8, 9.4], look: [26.35, 1.25, 0.3], fov: 44, ease: 'surge' },
    { f: 567, pos: [22.3, 2.6, 8.6], look: [26.4, 1.25, 0.4], fov: 42 },
  ],
  purse: [ // the qazi listens; the potli is asked; the hands shake
    { f: 568, pos: [23.1, 2.0, 3.9], look: [25.9, 1.5, -1.7], fov: 40 },
    { f: 666, pos: [23.7, 1.88, 3.1], look: [25.4, 1.45, -1.1], fov: 37, ease: 'surge' },
    { f: 703, pos: [23.7, 1.86, 3.05], look: [25.25, 1.42, -0.95], fov: 36, ease: 'surge' },
    { f: 766, pos: [23.8, 1.87, 3.0], look: [25.25, 1.42, -0.95], fov: 36 },
  ],
  shake: [ // THE BEAT: purse to the owner's ear — the closest push-in of the film, side-on pair
    { f: 767, pos: [24.7, 2.1, 4.4], look: [25.8, 1.6, -1.0], fov: 42 },
    { f: 807, pos: [25.1, 2.0, 3.9], look: [25.8, 1.7, -0.85], fov: 40, ease: 'surge' },
    { f: 862, pos: [25.35, 1.95, 3.5], look: [25.8, 1.78, -0.75], fov: 40, ease: 'surge' },
    { f: 901, pos: [25.45, 1.95, 3.45], look: [25.8, 1.78, -0.75], fov: 40 },
  ],
  suna: [ // "suna tumne?" on the qazi -> swing to the stunned owner: "haan, suna!"
    { f: 902, pos: [23.9, 1.92, 2.2], look: [25.7, 1.6, -1.3], fov: 37 },
    { f: 953, pos: [24.3, 1.88, 1.7], look: [25.9, 1.75, -0.35], fov: 35, ease: 'surge' },
    { f: 1020, pos: [24.4, 1.88, 1.65], look: [25.9, 1.75, -0.35], fov: 35 },
  ],
  verdict: [ // the verdict, with the KEEMAT board rising over the takht
    { f: 1021, pos: [25.2, 2.4, 5.2], look: [26.0, 2.1, -2.6], fov: 41 },
    { f: 1090, pos: [25.35, 2.35, 4.8], look: [25.95, 2.0, -2.4], fov: 40, ease: 'surge' },
    { f: 1147, pos: [25.4, 2.35, 4.75], look: [25.95, 2.0, -2.4], fov: 40 },
  ],
  return: [ // the potli comes back — every coin inside
    { f: 1148, pos: [23.3, 1.95, 3.6], look: [25.0, 1.4, 0.2], fov: 38 },
    { f: 1187, pos: [23.8, 1.9, 3.2], look: [24.75, 1.45, 0.6], fov: 36, ease: 'surge' },
    { f: 1225, pos: [23.9, 1.9, 3.15], look: [24.75, 1.45, 0.6], fov: 36 },
  ],
  hook: [ // the farm: father, three sons, the horse pen — then the qazi's own horse
    { f: 1226, pos: [38.6, 2.8, 7.4], look: [46.0, 1.15, -1.6], fov: 46 },
    { f: 1284, pos: [41.3, 2.1, 4.6], look: [45.9, 1.2, 0.2], fov: 40, ease: 'surge' },
    { f: 1404, pos: [40.9, 1.95, 3.6], look: [43.4, 1.3, 0.7], fov: 37, ease: 'surge' },
    { f: 1419, pos: [41.2, 2.05, 4.6], look: [48.6, 1.5, -1.4], fov: 40, ease: 'surge' },
    { f: 1435, pos: [41.35, 2.05, 4.65], look: [48.7, 1.5, -1.4], fov: 40 },
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
  if (S.id === 'hook' && f >= 1404) sub = [43.2, 1.3, 0.7];
  const d = Math.hypot(C.pos[0] - sub[0], C.pos[1] - sub[1], C.pos[2] - sub[2]);
  return { focus: d, cinf: (S.id === 'shake' || S.id === 'suna') ? 4 : 5 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { boardStall: 0, boardVerdict: 0, boardHook: 0, emberK: 0 };
  if (S.id === 'stall') W.boardStall = 1 - smooth(ramp(f, 82, 98));
  if (S.id === 'verdict') W.boardVerdict = smooth(ramp(f, 1030, 1044)) * (1 - smooth(ramp(f, 1128, 1144)));
  if (S.id === 'hook') W.boardHook = smooth(ramp(f, 1413, 1427));
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
  // ग़रीब मुसाफ़िर: faded worn kurta, hair, his potli in hand
  traveller: { jacket: '#8a7a5c', pants: '#6a5a44', boots: '#4a3a28', hat: 'hair', hair: '#2a2018', skin: '#b57a4e' },
  // अमीर दुकानदार: clean cream kurta + topi, prosperous
  owner: { jacket: '#efe6cf', pants: '#7a6a4f', boots: '#5a4630', hat: 'cap', cap: '#f4efe4', skin: '#c98a5a' },
  // क़ाज़ी: deep-green judge's robe; pagdi drawn as an overlay (stand cy 231, sit cy 439, seed 73)
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
  if (extra.breadLap) { // the dry roti in the seated traveller's lap (sit mode draws no held props)
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
      // the traveller sits on his stone, dry roti in his lap; the smell reaches him
      const dreamy = f >= 118;
      out.push(A(T, OUTFITS.traveller, { expr: dreamy ? 'smile' : 'neutral', mode: 'sit', blink: blinkAt(f, 72), seed: 72, headTilt: q(dreamy ? -3 : 7, 1) }, [STONE[0], 0.16, STONE[2]], { tag: 'trv', breadLap: true, out: { tint, yaw: -0.2 } }));
      break;
    }
    case 'grab': {
      const marching = f < 204;
      const p = ownerGrabPos(f);
      out.push(ownerAt(T, tint, f, 'stern', p, marching
        ? { mode: 'march', phase: q((f * 0.09) % 1, 2) }
        : { mode: 'stand', wave: 0.72, headTilt: q(5, 1) }, { yaw: -0.3 }));
      // the traveller scrambles up off the stone as the hand lands on his collar
      const up = f >= 200;
      const tp = up ? [1.62, 0, 1.14] : [STONE[0], 0.16, STONE[2]];
      out.push(travellerAt(T, tint, f, f < 204 ? 'neutral' : f < 231 ? 'shock' : 'nervous', tp,
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
      const marching = f < 560;
      out.push(ownerAt(T, tint, f, 'stern', op, marching ? { mode: 'march', phase: q((f * 0.09) % 1, 2), wave: 0.5 } : { mode: 'stand', wave: 0.5 }, { yaw: -0.2 }));
      out.push(travellerAt(T, tint, f, 'nervous', tp, marching ? { mode: 'march', phase: q(((f * 0.09) + 0.5) % 1, 2), prop: ['purse', 0.3] } : { mode: 'stand', prop: ['purse', 0.3], headTilt: q(-4, 1) }, { yaw: 0.2 }));
      // the crowd gathers at the platform's edges — sure the poor man is finished
      out.push(A(T, OUTFITS.crowd1, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 76), seed: 76, headTilt: idleTilt(f, 76) }, [22.2, 0, 6.2], { tag: 'cr1', out: { tint, yaw: 0.45 } }));
      out.push(A(T, OUTFITS.crowd2, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 77), seed: 77, headTilt: idleTilt(f, 77), wave: f >= 520 ? 0.45 : 0 }, [28.8, 0, 6.3], { tag: 'cr2', out: { tint, yaw: -0.3 } }));
      out.push(A(T, OUTFITS.crowd3, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 78), seed: 78, headTilt: idleTilt(f, 78) }, [30.3, 0, 5.6], { tag: 'cr3', out: { tint, yaw: -0.5 } }));
      break;
    }
    case 'purse': {
      // the qazi listens in silence; at MANGI the traveller holds out his potli;
      // through KAANP his hands shake — the purse trembles with them
      const asked = f >= 666;
      const tremble = f >= 690 && f < 745 ? q(0.045 * Math.sin(f * 1.7), 3) : 0;
      out.push(qaziSit(T, tint, f, f < 640 ? 'neutral' : 'stern', { headTilt: q(f < 666 ? 5 : 2, 1) }));
      out.push(ownerAt(T, tint, f, 'stern', COURT_O, { mode: 'stand' }, { yaw: -0.25 }));
      out.push(travellerAt(T, tint, f, f < 666 ? 'nervous' : 'pained', COURT_T,
        { mode: 'stand', prop: ['purse', q((asked ? 0.58 : 0.3) + tremble, 3)], headTilt: q(asked ? 10 + (tremble ? 2 * Math.sin(f * 1.7) : 0) : 4, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'shake': {
      // the qazi RISES with the potli, steps to the takht's edge and holds it
      // by the owner's ear; at HILAI he shakes — khun-khun-khun
      const risen = f >= 780;
      const shakeK = f < 862 ? 0.5 : f < 892 ? q(0.62 + 0.055 * Math.sin((f - 862) * 2.1), 3) : 0.6;
      if (!risen) out.push(qaziSit(T, tint, f, 'stern', { headTilt: q(4, 1) }));
      else out.push(qaziStand(T, tint, f, 'stern', [25.55, 0.5, -1.2], { prop: ['purse', shakeK], headTilt: q(7, 1) }, { yaw: 0.3 }));
      const op = ownerEarPos(f);
      const omarch = f < 807;
      out.push(ownerAt(T, tint, f, f < 862 ? 'neutral' : 'shock', op, omarch ? { mode: 'march', phase: q((f * 0.09) % 1, 2) } : { mode: 'stand', headTilt: q(3, 1) }, { yaw: -0.35 }));
      // until the qazi rises and takes it, the potli hangs in the waiting traveller's hand
      out.push(travellerAt(T, tint, f, 'nervous', TRAV_WAIT, risen ? { mode: 'stand', headTilt: q(6, 1) } : { mode: 'stand', prop: ['purse', 0.32], headTilt: q(6, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'suna': {
      out.push(qaziStand(T, tint, f, 'stern', [25.55, 0.5, -1.2], { prop: ['purse', 0.55], headTilt: q(3, 1) }, { yaw: 0.3 }));
      // the owner's stunned nod at "haan, suna!"
      const nod = f >= 953 && f < 985 ? q(7 * Math.sin((f - 953) * 0.32), 1) : 0;
      out.push(ownerAt(T, tint, f, f < 953 ? 'neutral' : 'shock', [26.1, 0.5, -0.3], { mode: 'stand', headTilt: nod }, { yaw: -0.35 }));
      out.push(travellerAt(T, tint, f, 'nervous', TRAV_WAIT, { mode: 'stand', headTilt: q(5, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'verdict': {
      out.push(qaziStand(T, tint, f, f < 1100 ? 'stern' : 'smile', [25.55, 0.5, -1.2], { prop: ['purse', 0.5], headTilt: q(2, 1) }, { yaw: 0.25 }));
      out.push(ownerAt(T, tint, f, 'dazed', [26.1, 0.5, -0.3], { mode: 'stand', headTilt: q(9, 1) }, { yaw: -0.3 }));
      out.push(travellerAt(T, tint, f, f < 1100 ? 'nervous' : 'relief', TRAV_WAIT, { mode: 'stand', headTilt: q(4, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'return': {
      // the potli changes hands one last time — back to its owner, coins inside
      const back = f >= 1152;
      out.push(qaziStand(T, tint, f, 'smile', [25.55, 0.5, -1.2], back ? {} : { prop: ['purse', 0.5] }, { yaw: 0.25 }));
      out.push(ownerAt(T, tint, f, 'dazed', [26.1, 0.5, -0.3], { mode: 'stand', headTilt: q(12, 1) }, { yaw: -0.5 }));
      out.push(travellerAt(T, tint, f, f < 1187 ? 'relief' : 'smile', COURT_T,
        back ? { mode: 'stand', prop: ['purse', q(0.5 + 0.04 * Math.sin(f * 0.25), 2)], headTilt: q(-2, 1) } : { mode: 'stand', headTilt: q(4, 1) }, { yaw: 0.25 }));
      break;
    }
    case 'hook': {
      // father + three sons by the pen, baffled by seventeen horses
      out.push(A(T, OUTFITS.father, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 79), seed: 79, headTilt: q(6 + 1.5 * Math.sin(f * 0.04), 1), wave: f >= 1305 && f < 1360 ? 0.35 : 0 }, [45.6, 0, 0.55], { tag: 'fth', out: { tint, yaw: -0.2 } }));
      out.push(A(T, OUTFITS.son1, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 80), seed: 80, headTilt: idleTilt(f, 80) }, [44.2, 0, 0.5], { tag: 'sn1', out: { tint, yaw: 0.15 } }));
      out.push(A(T, OUTFITS.son2, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 81), seed: 81, headTilt: idleTilt(f, 81) }, [47.0, 0, 0.6], { tag: 'sn2', out: { tint, yaw: -0.1 } }));
      out.push(A(T, OUTFITS.son3, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 82), seed: 82, headTilt: idleTilt(f, 82) }, [48.3, 0, 0.45], { tag: 'sn3', out: { tint, yaw: -0.25 } }));
      // the qazi stands by his OWN horse; at JOD DIYA he steps up and presents it
      const stepped = f >= 1404;
      const qp = stepped ? kf3([[1404, [42.85, 0, 0.85]], [1420, [43.6, 0, 0.8]]], f) : [42.85, 0, 0.85];
      out.push(qaziStand(T, tint, f, stepped ? 'smile' : 'neutral', qp, stepped ? { mode: f < 1420 ? 'march' : 'stand', phase: q((f * 0.09) % 1, 2), wave: f >= 1420 ? 0.5 : 0 } : {}, { yaw: 0.45 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => {
  const out = [];
  const burst = (key, x, y, z, s, t) => out.push({ key, draw: (p) => T.fxBurst(p, t, '#ffe066', 9, 26, 140), x, y, z, blob: false, shadow: false });
  // coin glints riding the spoken khun-khun-khun, at the purse by the owner's ear
  for (const [f0, nm] of [[869, 'c1'], [877, 'c2'], [884, 'c3']])
    if (f >= f0 && f <= f0 + 14) burst(nm + '_' + q((f - f0) / 14, 2), 25.85, 1.98, -0.62, 0.34, q((f - f0) / 14, 2));
  // every coin still inside: a glint at the returned potli
  if (f >= 1187 && f <= 1201) burst('safe_' + q((f - 1187) / 14, 2), 24.15, 1.32, 1.1, 0.3, q((f - 1187) / 14, 2));
  // the added horse: a glint by its head as the qazi presents it
  if (f >= 1406 && f <= 1420) burst('horse_' + q((f - 1406) / 14, 2), 42.8, 1.72, 1.15, 0.3, q((f - 1406) / 14, 2));
  return out;
};
