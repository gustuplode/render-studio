// Shot plan for "The Prisoner Who Chose His Own Death" (batch-2 topic 3, EN)
// — timed to the ACTUAL voice stem (55.05 s, 30 fps, TOTAL 1652), clause
// timings from faster-whisper word alignment (184 words, full script match):
// C1 0-76 caught in stables | C2 82-171 king furious | C3 180-214 bring him
// to court | C4 224-294 you love clever tricks | C5 305-342 choose any death
// C6 354-406 poison/sword/hanging | C7 418-490 my word is law |
// C8 490-521 court held breath | C9 532-573 executioner stepped forward |
// C10 588-644 folded his hands | C11 657-753 "I choose to die... of old age"
// (old 721, age 735-753) | C12 772-786 Silence | C13 813-890 word spoken
// before entire court | C14 900-938 could not be taken back |
// C15 947-1104 set free on one condition | C16 1117-1174 walked out free |
// C17 1177-1233 executioner empty-handed | C18 1247-1320 king kept his word /
// thief kept his life | C19 1338-1464 strangest bill in history |
// C20 1480-1579 food he only smelled | C21 1597-1640 pay for a smell?
// QUALITY RULES (owner, batch-2): shots change ONLY at clause boundaries;
// camera TRACKS the voice-named subject every beat (biggest/centred), never
// freezes (camFromKeys creep), never drifts aimlessly; push-in = importance
// (the OLD AGE line gets the longest, deepest push); characters act in
// place — travel only via foot-locked march; costumes by role.
// World: stables x=-16, royal court x=0 (throne z=-2.7), palace gate x=+16,
// cookshop x=+32.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1652, DECK = 0;
export const SHOTS = [
  { id: 'stables', a: 0, b: 81, light: 'lamp' },
  { id: 'court', a: 82, b: 223, light: 'court' },
  { id: 'offer', a: 224, b: 489, light: 'court' },
  { id: 'breath', a: 490, b: 531, light: 'court' },
  { id: 'executioner', a: 532, b: 587, light: 'court' },
  { id: 'punch', a: 588, b: 771, light: 'court' },
  { id: 'silence', a: 772, b: 946, light: 'court' },
  { id: 'free', a: 947, b: 1116, light: 'court' },
  { id: 'walkout', a: 1117, b: 1246, light: 'day' },
  { id: 'kept', a: 1247, b: 1337, light: 'court' },
  { id: 'hook', a: 1338, b: 1651, light: 'dusk' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t);

// ---------- lights ----------
const WATER = { waterDeep: '#223c4e', waterShal: '#2c4a63', glint: '#ffe9c0' };
export const LIGHTS = {
  court: { az: 115, el: 38, sky: '#e8d9b0', ground: '#6a5138', hemi: 1.12, sun: '#ffdf9e', sunI: 2.2, fog: '#e6d3ac', fogNear: 42, fogFar: 300,
    skyTop: '#7d90b8', skyHor: '#ffe3ae', sunDisc: '#fff3cf', sunSize: 0.003, sat: 1.06, vig: 0.22, shadowExt: 16, aurora: 0, gain: '#ffedd6', ...WATER },
  lamp: { az: 70, el: 27, sky: '#8a6a4c', ground: '#3c2c1e', hemi: 0.92, sun: '#ffc37a', sunI: 1.9, fog: '#caa27a', fogNear: 30, fogFar: 200,
    skyTop: '#3c3a55', skyHor: '#caa27a', sunDisc: '#ffe9c0', sunSize: 0.0026, sat: 1.05, vig: 0.3, shadowExt: 13, aurora: 0, gain: '#ffe2b8', ...WATER },
  day: { az: 125, el: 44, sky: '#bcd2e8', ground: '#5f6a52', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#cfd8c2', fogNear: 46, fogFar: 380,
    skyTop: '#5f97d6', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.05, vig: 0.18, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  dusk: { az: 100, el: 19, sky: '#caa27a', ground: '#5c4a34', hemi: 1.06, sun: '#ffb763', sunI: 2.3, fog: '#e0c9a0', fogNear: 40, fogFar: 320,
    skyTop: '#54689c', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffe9d2', ...WATER },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- staging ----------
export const KINGP = [0, 0.62, -2.7];       // seated on the throne (card y = seat top)
export const THIEFP = [0, 0, 0.95];          // the prisoner, centre of the court
export const EXECPOST = [3.3, 0, -0.9];      // executioner's post, right of the throne
export const EXECFWD = [2.2, 0, 0.35];       // where he steps to at C9
export const DOORP = [3.3, 0, -2.6];         // court side door (entry + the kept-word view)
export const PROPP = [1.6, 0.82, -0.9];      // the death-props table surface

/** Foot-locked march: eased position + step phase from distance travelled. */
const marcher = (from, to, f0, f1, f) => {
  const total = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const d = smooth(ramp(f, f0, f1)) * total;
  return { pos: kf3([[f0, from], [f1, to]], f), phase: q((d / 1.6) % 1, 3), moving: f > f0 && f < f1 };
};
// the prisoner's entry: dragged in through the side door to the court centre
export const entryAt = (who, f) => {
  if (who === 'thief') return marcher([3.3, 0, -2.6], [...THIEFP], 182, 246, f);
  if (who === 'gl') return marcher([2.3, 0, -2.75], [-1.95, 0, -1.7], 182, 246, f);
  return marcher([4.3, 0, -2.45], [1.95, 0, -1.7], 182, 246, f);
};
export const execPosAt = (f) => marcher(EXECPOST, EXECFWD, 536, 572, f).pos;
// the free man's walk out of the palace
export const walkoutAt = (f) => marcher([16, 0, -1.85], [19.6, 0, 1.9], 1150, 1232, f);
// the distant thief seen through the court door in 'kept' (second half)
export const miniThiefAt = (f) => marcher([3.3, 0, -3.5], [3.9, 0, -5.05], 1286, 1337, f);

const HERO = {
  stables: () => [-16, 1.1, -0.6],
  court: (f) => f < 180 ? [0, 1.5, -2.7] : lerp3([0, 1.5, -2.7], [2.4, 1.1, -1.6], smooth(ramp(f, 180, 205))),
  offer: () => [0, 1.5, -2.7],
  breath: () => [0, 1.1, 0.2],
  executioner: (f) => { const p = execPosAt(f); return [p[0], 1.25, p[2]]; },
  punch: () => [0, 1.3, 0.95],
  silence: (f) => kf3([[772, [0, 1.3, 0.95]], [830, [-3.2, 1.15, -0.8]], [900, [0, 1.55, -2.7]]], f),
  free: () => [0, 1.2, 0.95],
  walkout: (f) => f < 1177 ? (() => { const p = walkoutAt(f).pos; return [p[0], 1.1, p[2]]; })()
    : lerp3([19.6, 1.1, 1.9], [14.2, 1.2, -1.6], smooth(ramp(f, 1177, 1205))),
  kept: (f) => lerp3([0, 1.5, -2.7], [3.3, 1.15, -3.0], smooth(ramp(f, 1300, 1330))),
  hook: () => [32.2, 1.15, -0.9],
};
export const heroPosAt = (f) => HERO[shotAt(f).id](f);

// ---------- cameras ----------
// Every shot's first key repeats the previous shot's last key (continuous
// flight, no cuts); inside a shot the camera surges TO the clause subject
// and settles into a slow push-in on it. Clause boundaries inside a shot
// (C2->C3, C10->C11, C16->C17, C19/20/21) get a key exactly on the boundary.
const CAMS = {
  stables: [
    { f: 0, pos: [-11.2, 2.6, 5.4], look: [-16, 1.2, -1.6], fov: 44 },
    { f: 40, pos: [-12.9, 2.0, 3.4], look: [-16, 1.15, -0.8], fov: 40, ease: 'surge' },
    { f: 81, pos: [-13.8, 1.8, 2.4], look: [-16, 1.1, -0.6], fov: 38, ease: 'surge' },
  ],
  court: [
    { f: 82, pos: [-13.8, 1.8, 2.4], look: [-16, 1.1, -0.6], fov: 38 },
    { f: 112, pos: [-6.5, 2.6, 5.5], look: [-4, 1.4, -2], fov: 42, ease: 'easeInOut' },
    { f: 145, pos: [1.8, 2.1, 3.9], look: [0, 1.55, -2.7], fov: 39, ease: 'surge' },
    { f: 171, pos: [1.2, 1.95, 3.1], look: [0, 1.6, -2.7], fov: 37, ease: 'surge' },
    { f: 180, pos: [1.6, 1.9, 3.6], look: [1.8, 1.2, -2.4], fov: 38, ease: 'surge' },
    { f: 214, pos: [2.2, 1.85, 3.4], look: [2.2, 1.05, -1.2], fov: 37, ease: 'surge' },
    { f: 223, pos: [1.4, 1.8, 3.2], look: [0.6, 1.1, 0.2], fov: 37, ease: 'surge' },
  ],
  offer: [
    { f: 224, pos: [1.4, 1.8, 3.2], look: [0.6, 1.1, 0.2], fov: 37 },
    { f: 262, pos: [2.6, 1.9, 4.6], look: [0, 1.45, -2.2], fov: 39, ease: 'surge' },
    { f: 305, pos: [1.7, 1.95, 3.4], look: [0, 1.6, -2.7], fov: 37, ease: 'surge' },
    { f: 354, pos: [2.3, 1.6, 2.2], look: [1.6, 0.85, -0.9], fov: 36, ease: 'surge' },
    { f: 406, pos: [2.0, 1.8, 3.0], look: [0.6, 1.4, -2.2], fov: 38, ease: 'surge' },
    { f: 445, pos: [1.1, 2.0, 3.3], look: [0, 1.7, -2.7], fov: 37, ease: 'surge' },
    { f: 489, pos: [0.9, 1.95, 3.0], look: [0, 1.65, -2.7], fov: 36, ease: 'surge' },
  ],
  breath: [
    { f: 490, pos: [0.9, 1.95, 3.0], look: [0, 1.65, -2.7], fov: 36 },
    { f: 531, pos: [3.9, 2.3, 5.6], look: [0, 1.15, -0.4], fov: 42, ease: 'surge' },
  ],
  executioner: [
    { f: 532, pos: [3.9, 2.3, 5.6], look: [0, 1.15, -0.4], fov: 42 },
    { f: 556, pos: [4.9, 2.2, 6.3], look: [2.6, 1.4, -0.3], fov: 41, ease: 'surge' },
    { f: 587, pos: [4.6, 2.1, 5.6], look: [2.2, 1.5, 0.3], fov: 38, ease: 'surge' },
  ],
  punch: [
    { f: 588, pos: [4.6, 2.1, 5.6], look: [2.2, 1.5, 0.3], fov: 38 },
    { f: 620, pos: [3.3, 1.9, 4.6], look: [0.4, 1.2, 0.2], fov: 40, ease: 'surge' },
    { f: 657, pos: [2.2, 1.75, 3.9], look: [0, 1.3, 0.95], fov: 38, ease: 'surge' },
    { f: 709, pos: [1.2, 1.85, 3.65], look: [0, 1.58, 0.92], fov: 37, ease: 'surge' },
    { f: 753, pos: [1.15, 1.9, 3.6], look: [0, 1.62, 0.9], fov: 37, ease: 'surge' },
    { f: 771, pos: [1.12, 1.9, 3.58], look: [0, 1.62, 0.9], fov: 37, ease: 'surge' },
  ],
  silence: [
    { f: 772, pos: [1.12, 1.9, 3.58], look: [0, 1.62, 0.9], fov: 37 },
    { f: 800, pos: [2.2, 1.8, 4.6], look: [-2.2, 1.25, -0.5], fov: 40, ease: 'surge' },
    { f: 855, pos: [2.4, 1.8, 4.2], look: [0.4, 1.4, -1.6], fov: 39, ease: 'surge' },
    { f: 890, pos: [1.5, 1.9, 3.3], look: [0, 1.6, -2.7], fov: 37, ease: 'surge' },
    { f: 946, pos: [1.1, 1.85, 2.9], look: [0, 1.62, -2.7], fov: 35, ease: 'surge' },
  ],
  free: [
    { f: 947, pos: [1.1, 1.85, 2.9], look: [0, 1.62, -2.7], fov: 35 },
    { f: 1002, pos: [1.9, 1.85, 3.6], look: [0, 1.35, -1.2], fov: 38, ease: 'surge' },
    { f: 1062, pos: [2.5, 1.8, 4.3], look: [0, 1.25, 0.95], fov: 38, ease: 'surge' },
    { f: 1116, pos: [2.9, 1.85, 4.8], look: [0.2, 1.2, 0.9], fov: 39, ease: 'surge' },
  ],
  walkout: [
    { f: 1117, pos: [2.9, 1.85, 4.8], look: [0.2, 1.2, 0.9], fov: 39 },
    { f: 1150, pos: [10.5, 2.6, 7.5], look: [15.9, 1.3, -1.9], fov: 43, ease: 'easeInOut' },
    { f: 1180, pos: [13.8, 2.0, 4.8], look: [17.0, 1.15, 0.0], fov: 40, ease: 'surge' },
    { f: 1210, pos: [12.6, 1.9, 3.4], look: [14.2, 1.25, -1.6], fov: 38, ease: 'surge' },
    { f: 1246, pos: [12.9, 1.85, 3.1], look: [14.2, 1.2, -1.6], fov: 37, ease: 'surge' },
  ],
  kept: [
    { f: 1247, pos: [12.9, 1.85, 3.1], look: [14.2, 1.2, -1.6], fov: 37 },
    { f: 1277, pos: [4.5, 2.2, 5.0], look: [1, 1.5, -2.2], fov: 41, ease: 'easeInOut' },
    { f: 1290, pos: [1.5, 1.95, 3.5], look: [0, 1.6, -2.7], fov: 38, ease: 'surge' },
    { f: 1337, pos: [3.4, 1.9, 4.2], look: [3.5, 1.15, -3.8], fov: 36, ease: 'surge' },
  ],
  hook: [
    { f: 1338, pos: [3.4, 1.9, 4.2], look: [3.5, 1.15, -3.8], fov: 36 },
    { f: 1400, pos: [24, 2.6, 6.5], look: [29, 1.5, -1.5], fov: 43, ease: 'easeInOut' },
    { f: 1464, pos: [28.6, 2.0, 3.9], look: [31.9, 1.3, -0.8], fov: 40, ease: 'surge' },
    { f: 1520, pos: [29.3, 1.85, 3.4], look: [31.6, 1.15, -0.85], fov: 40, ease: 'surge' },
    { f: 1579, pos: [30.1, 1.72, 2.6], look: [32.3, 1.2, -0.9], fov: 37, ease: 'surge' },
    { f: 1651, pos: [32.9, 1.75, 3.1], look: [31.85, 1.5, -0.8], fov: 36, ease: 'surge' },
  ],
};
export const camAt = (f) => camFromKeys(CAMS[shotAt(f).id], f);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const hp = heroPosAt(f);
  let cinf = 5;
  if (['punch', 'executioner', 'silence'].includes(S.id)) cinf = 3.6;
  if (S.id === 'hook' && f > 1500) cinf = 3.4;
  const d = Math.hypot(C.pos[0] - hp[0], C.pos[1] - hp[1], C.pos[2] - hp[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const W = { boardLaw: 0, boardOldAge: 0, boardBill: 0, palaceDoor: 0, glowK: 0 };
  W.boardLaw = smooth(ramp(f, 424, 438)) * (1 - smooth(ramp(f, 470, 486)));
  W.boardOldAge = smooth(ramp(f, 706, 718)) * (1 - smooth(ramp(f, 754, 768)));
  W.boardBill = smooth(ramp(f, 1447, 1461));
  W.palaceDoor = smooth(ramp(f, 1140, 1168));
  W.glowK = 0.5 + 0.5 * Math.sin(f * 0.21);
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'stables') return { smokeRate: 0.1, dustRate: 0.3, steamRate: 0 };
  if (S.id === 'hook') return { smokeRate: 0.12, dustRate: 0.05, steamRate: 0.85 };
  if (S.id === 'walkout') return { smokeRate: 0.08, dustRate: 0.08, steamRate: 0 };
  return { smokeRate: 0.3, dustRate: 0.05, steamRate: 0 };
};

// ---------- actors ----------
const TINT = { court: '#ffedd0', lamp: '#ffcf96', day: '#ffffff', dusk: '#ffd9a3' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
// COSTUMES BY ROLE — king: crimson robe, gold sash, CROWN, seated on the
// throne. Thief: the same dark clothes as the treasury thief (series
// continuity). Executioner: black HOOD, stout build, axe. Guards: red
// uniform + shako. Courtiers: rich court dress, all different.
export const OUTFITS = {
  king: { jacket: '#7a1f2b', pants: '#33222e', boots: '#241a12', hat: 'crown', sash: '#e8c45a', buttons: '#f0bc4a', skin: '#e8b08a' },
  thief: { jacket: '#2b2b33', pants: '#1e1e24', boots: '#141416', hat: 'cap', cap: '#1b1b21', skin: '#c98a5a' },
  exec: { jacket: '#23202a', pants: '#17141d', boots: '#100e12', hat: 'hood', cap: '#23202a', skin: '#d9a075', build: 'stout' },
  guardL: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#e8b08a' },
  guardR: { jacket: '#8c2f39', pants: '#2a2e3d', boots: '#1c1a17', hat: 'shako', belt: '#e8c45a', skin: '#c98a5a' },
  court1: { jacket: '#2e5a6e', pants: '#22303a', boots: '#1c1a17', hat: 'cap', cap: '#d9c9a8', skin: '#e8b08a' },
  court2: { jacket: '#5d3a6e', pants: '#33243d', boots: '#241a12', hat: 'tophat', skin: '#c98a5a' },
  court3: { jacket: '#6e5a2e', pants: '#3a3222', boots: '#241a12', hat: 'hair', hair: '#241a12', skin: '#e8b08a' },
  court4: { jacket: '#2e6e4a', pants: '#223a2c', boots: '#1c1a17', hat: 'cap', cap: '#8c2f39', skin: '#a06a3c' },
  traveller: { jacket: '#a08b6d', pants: '#6e5a41', boots: '#4a3a28', hat: 'hair', hair: '#241a12', skin: '#c98a5a' },
  owner: { jacket: '#7a4a21', pants: '#3d2c1a', boots: '#241a12', hat: 'cap', cap: '#f7f3e6', sash: '#f7f3e6', skin: '#a06a3c' },
};
const RW = (T, o, opts, pos, extra = {}) => ({ key: 'pax' + JSON.stringify(o) + JSON.stringify(opts), draw: (p) => T.bodyFront(p, o, opts), x: pos[0], y: pos[1], z: pos[2], ground: pos[3] ?? pos[1], ...extra });
const stand = (T, tint, f) => (o, expr, seed, pos, extra = {}) => RW(T, o, { expr, mode: 'stand', blink: blinkAt(f, seed), seed }, pos, { tint, ...extra });
const GLP = [-1.95, 0, -1.7], GRP = [1.95, 0, -1.7];   // court guard posts
const bowK = (f, a, b, c, d) => smooth(ramp(f, a, b)) * (1 - smooth(ramp(f, c, d)));
const bowOpts = (k) => ({ headTilt: q(k * 17, 1) });
const BP = (pos, k) => [pos[0], q(-0.07 * k, 3), pos[2]];

export const actorsAt = (f, T) => {
  const S = shotAt(f), tint = tintFor(S), out = [];
  const st = stand(T, tint, f);
  const king = (expr, extra = {}) => RW(T, OUTFITS.king, { expr, mode: 'sit', blink: blinkAt(f, 31), seed: 31, ...extra }, KINGP, { tint, s: 1.12 });
  const thiefCourt = (expr, extra = {}) => st(OUTFITS.thief, expr, 86, THIEFP, extra);
  const execAt = (expr, extra = {}) => {
    const m = marcher(EXECPOST, EXECFWD, 536, 572, f);
    const p = S.id === 'stables' || S.id === 'court' || S.id === 'offer' || S.id === 'breath' ? EXECPOST : m.pos;
    return RW(T, OUTFITS.exec, { expr, mode: m.moving && f >= 532 && f <= 587 ? 'march' : 'stand', phase: m.phase, blink: blinkAt(f, 77), seed: 77, prop: ['axe', 0.75] }, p, { tint, s: 1.22, ...extra });
  };
  const courtiers = (expr, yawC = 0) => {
    out.push(st(OUTFITS.court1, expr, 51, [-3.2, 0, -0.8], { yaw: 0.3 + yawC, s: 0.95 }));
    out.push(st(OUTFITS.court2, expr, 52, [-3.7, 0, 1.0], { yaw: 0.35 + yawC, s: 0.95 }));
    out.push(st(OUTFITS.court4, expr, 54, [4.3, 0, -0.6], { yaw: -0.35 - yawC, s: 0.95 }));
    out.push(st(OUTFITS.court3, expr, 53, [3.9, 0, 1.5], { yaw: -0.3 - yawC, s: 0.95 }));
  };
  const guardsCourt = (glE = 'stern', grE = 'stern', glX = {}, grX = {}) => {
    out.push(st(OUTFITS.guardL, glE, 61, GLP, { yaw: 0.15, ...glX }));
    out.push(st(OUTFITS.guardR, grE, 62, GRP, { yaw: -0.15, ...grX }));
  };
  switch (S.id) {
    case 'stables': {
      out.push(RW(T, OUTFITS.thief, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 86), seed: 86, headTilt: 6 }, [-16, 0, -0.6], { tint, yaw: 0.1 }));
      out.push(st(OUTFITS.guardL, 'stern', 61, [-17.35, 0, -0.75], { yaw: 0.3 }));
      out.push(st(OUTFITS.guardR, 'stern', 62, [-14.65, 0, -0.75], { yaw: -0.3 }));
      break;
    }
    case 'court': {
      // C2: the furious king alone with his court; C3: he roars — and the
      // guards drag the prisoner in through the side door (foot-locked).
      const roar = kf([[180, 0], [192, -5], [206, 6], [218, 0]], f);
      out.push(king('stern', { headTilt: q(roar, 1) }));
      if (f < 182) {
        out.push(st(OUTFITS.thief, 'nervous', 86, DOORP, { yaw: -0.2, headTilt: 5 }));
        out.push(st(OUTFITS.guardL, 'stern', 61, [2.3, 0, -2.75], { yaw: 0.2 }));
        out.push(st(OUTFITS.guardR, 'stern', 62, [4.3, 0, -2.45], { yaw: -0.2 }));
      } else {
        const tm = entryAt('thief', f), gm = entryAt('gl', f), gr = entryAt('gr', f);
        const md = (m) => m.moving ? 'march' : 'stand';
        out.push(RW(T, OUTFITS.thief, { expr: 'nervous', mode: md(tm), phase: tm.phase, blink: blinkAt(f, 86), seed: 86, headTilt: 5 }, tm.pos, { tint, yaw: -0.15 }));
        out.push(RW(T, OUTFITS.guardL, { expr: 'stern', mode: md(gm), phase: gm.phase, blink: blinkAt(f, 61), seed: 61 }, gm.pos, { tint, yaw: 0.1 }));
        out.push(RW(T, OUTFITS.guardR, { expr: 'stern', mode: md(gr), phase: gr.phase, blink: blinkAt(f, 62), seed: 62 }, gr.pos, { tint, yaw: -0.1 }));
      }
      courtiers('neutral');
      out.push(execAt('stern'));
      break;
    }
    case 'offer': {
      const mock = f < 305 ? 'grin' : 'stern';
      out.push(king(mock, { headTilt: q(kf([[224, 0], [250, 3], [280, 0], [430, 0], [445, -3], [470, 0]], f), 1) }));
      if (f < 246) {
        const tm = entryAt('thief', f), gm = entryAt('gl', f), gr = entryAt('gr', f);
        const md = (m) => m.moving ? 'march' : 'stand';
        out.push(RW(T, OUTFITS.thief, { expr: 'nervous', mode: md(tm), phase: tm.phase, blink: blinkAt(f, 86), seed: 86, headTilt: 5 }, tm.pos, { tint, yaw: -0.15 }));
        out.push(RW(T, OUTFITS.guardL, { expr: 'stern', mode: md(gm), phase: gm.phase, blink: blinkAt(f, 61), seed: 61 }, gm.pos, { tint, yaw: 0.1 }));
        out.push(RW(T, OUTFITS.guardR, { expr: 'stern', mode: md(gr), phase: gr.phase, blink: blinkAt(f, 62), seed: 62 }, gr.pos, { tint, yaw: -0.1 }));
      } else {
        out.push(RW(T, OUTFITS.thief, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 86), seed: 86, headTilt: 8 }, THIEFP, { tint, yaw: 0 }));
        guardsCourt();
      }
      courtiers('neutral');
      out.push(execAt('stern'));
      break;
    }
    case 'breath': {
      out.push(king('stern'));
      out.push(RW(T, OUTFITS.thief, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 86), seed: 86, headTilt: 8 }, THIEFP, { tint }));
      guardsCourt();
      courtiers('nervous');
      out.push(execAt('stern'));
      break;
    }
    case 'executioner': {
      out.push(king('stern'));
      out.push(RW(T, OUTFITS.thief, { expr: 'nervous', mode: 'stand', blink: blinkAt(f, 86), seed: 86, headTilt: 8 }, THIEFP, { tint }));
      guardsCourt();
      courtiers('nervous');
      out.push(execAt('stern'));
      break;
    }
    case 'punch': {
      out.push(king(f < 657 ? 'stern' : 'grin'));
      // the fold: hands come together over C10 and stay folded, calm.
      const fold = smooth(ramp(f, 592, 626));
      const bowPulse = bowK(f, 657, 678, 700, 724);
      out.push(RW(T, OUTFITS.thief, { expr: f < 709 ? 'neutral' : 'smile_closed', mode: 'stand', blink: blinkAt(f, 86), seed: 86, prop: ['fold', q(fold, 2)], headTilt: q(8 * (1 - fold) + bowPulse * 9, 1) }, THIEFP, { tint }));
      guardsCourt();
      courtiers('neutral');
      out.push(execAt('stern'));
      break;
    }
    case 'silence': {
      // frozen court: shock everywhere; the king's face does the trapping.
      out.push(king(f < 856 ? 'shock' : 'stern', { headTilt: q(kf([[772, 0], [890, 1], [946, 5]], f), 1) }));
      out.push(RW(T, OUTFITS.thief, { expr: 'neutral', mode: 'stand', blink: blinkAt(f, 86), seed: 86, prop: ['fold', 1] }, THIEFP, { tint }));
      guardsCourt('shock', 'shock');
      courtiers('shock', 0.25);
      out.push(execAt('shock'));
      break;
    }
    case 'free': {
      const nod = bowK(f, 995, 1015, 1035, 1060);
      out.push(king(f < 1090 ? 'stern' : 'neutral', { headTilt: q(nod * 8, 1) }));
      const unfold = 1 - smooth(ramp(f, 1073, 1104));
      out.push(RW(T, OUTFITS.thief, { expr: f < 1073 ? 'neutral' : 'grin', mode: 'stand', blink: blinkAt(f, 86), seed: 86, prop: ['fold', q(unfold, 2)] }, THIEFP, { tint }));
      const gbow = bowK(f, 1002, 1030, 1070, 1100);
      out.push(RW(T, OUTFITS.guardL, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 61), seed: 61, ...bowOpts(gbow) }, BP(GLP, gbow), { tint, yaw: 0.15 }));
      out.push(RW(T, OUTFITS.guardR, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 62), seed: 62, ...bowOpts(gbow) }, BP(GRP, gbow), { tint, yaw: -0.15 }));
      courtiers('relief');
      out.push(execAt('stern'));
      break;
    }
    case 'walkout': {
      const wm = walkoutAt(f);
      const walked = f >= 1232;
      out.push(RW(T, OUTFITS.thief, { expr: 'grin', mode: wm.moving ? 'march' : 'stand', phase: wm.phase, blink: blinkAt(f, 86), seed: 86, ...(walked ? { wave: q(0.5 + 0.5 * Math.sin(f * 0.22), 2) } : {}) }, wm.pos, { tint, yaw: walked ? 0.15 : -0.35 }));
      // the executioner at the palace door: axe planted, and from C17 his
      // head sinks — he goes home empty-handed.
      const slump = smooth(ramp(f, 1185, 1225));
      out.push(RW(T, OUTFITS.exec, { expr: f < 1177 ? 'stern' : 'pained', mode: 'stand', blink: blinkAt(f, 77), seed: 77, prop: ['axe', 0.75], headTilt: q(slump * 13, 1) }, [14.2, 0, -1.6], { tint, s: 1.22, yaw: 0.3 }));
      out.push(st(OUTFITS.guardL, 'stern', 61, [20.9, 0, -2.2], { yaw: -0.2 }));
      break;
    }
    case 'kept': {
      out.push(king('neutral', { headTilt: q(kf([[1247, 3], [1290, 0]], f), 1) }));
      guardsCourt();
      courtiers('neutral');
      out.push(execAt('stern'));
      if (f >= 1286) {
        const mm = miniThiefAt(f);
        out.push(RW(T, OUTFITS.thief, { expr: 'grin', mode: 'march', phase: mm.phase, blink: blinkAt(f, 86), seed: 86 }, mm.pos, { tint: '#ffe9c4', s: 0.55, alpha: q(smooth(ramp(f, 1286, 1300)), 2), shadow: false }));
      }
      break;
    }
    case 'hook': {
      // the cookshop: the owner counts his till; the poor traveller's dry
      // bread gets "flavoured" by the kebab steam (C20), then the demand.
      const sniff = f >= 1480 && f <= 1579 ? q(Math.max(0, Math.sin((f - 1480) * 0.11)) * 5, 1) : 0;
      out.push(RW(T, OUTFITS.traveller, { expr: f < 1480 ? 'nervous' : f < 1597 ? 'smile_closed' : 'nervous', mode: 'stand', blink: blinkAt(f, 91), seed: 91, headTilt: sniff, ...(f >= 1447 && f < 1597 ? { prop: ['coin', 0.4] } : {}) }, [31.25, 0, 0.15], { tint, yaw: f < 1480 ? 0.2 : 0.55 }));
      const point = f >= 1597 ? { prop: ['point', q(smooth(ramp(f, 1597, 1615)), 2)] } : {};
      // owner at the counter's right end: fully out of the final tight board
      // framing (at 31.05 his face half-peeked from behind the board's left
      // edge) and fully visible beside the board in the wider framings.
      out.push(RW(T, OUTFITS.owner, { expr: 'stern', mode: 'stand', blink: blinkAt(f, 95), seed: 95, ...point }, [33.35, 0, -1.75], { tint, yaw: 0.3 }));
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
