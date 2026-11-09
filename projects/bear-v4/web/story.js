// Shot plan for "The Bear Who Became a Corporal" — timed to voice.mp3 (36.33 s, 30 fps, TOTAL 1090).
// Phrases (s): 0.00-2.76 rank hook | 3.36-8.84 cub found 1942 | 9.46-11.78 wrestled/marched |
// 12.42-15.04 sailed for Italy, rule | 15.88-16.76 "No pets on the ship" | 17.34-19.38 only thing they could |
// 20.02-20.94 enlisted the bear | 21.76-24.44 Private Wojtek, paybook, number |
// 25.10-27.44 Monte Cassino, copied the men | 27.76-31.44 carrying crates, never dropped one |
// 32.22-35.74 twist: came home a corporal.
// Sets live in separate zones: camp x~0, port x~+30, office x~60, cassino x~90. Ground y=0 everywhere
// (the port quay deck is y=0.55).
//
// V3 — PROFESSIONAL KEYFRAMED ANIMATION + TRACKING CAMERA:
// * Every actor action is a deliberate keyframe track (kf/kf3): start pose, anticipation, action,
//   settle — timed to the phrase beats above. No idle-driven drift; only a faint breathing layer
//   under held poses so no frame ever freezes.
// * Subject tracks (cubYAt, campBearX, bearCarry, cassinoSubj, enlistFocus...) are the SINGLE
//   source of truth: actorsAt places the actors from them, camAt TRACKS the same tracks —
//   the camera's look target (and, on the carry, its dolly position) is computed from the
//   subject's keyframed position every frame, like a cameraman following the action.
//
// V4 — TRACKING DIRECTOR (on top of v3, actor keyframes unchanged):
// * TRACKDIR table: per frame-range the camera locks onto a SUBJECT (the bear), a CHARACTER
//   (officer / hauling soldiers / wrestling opponent) or an OBJECT (haul crate, carried crate,
//   stamp, paybook). camAt steers the look onto the target's LIVE position every frame and,
//   on posW-marked beats, the camera position rides the target's motion too. Targets hand off
//   over BLEND=10 frames (points + weights lerped) — no jumps. DOF focus follows the target.
// * VFX tied to tracking: warm glow pulse on the tracked OBJECT, paybook glint (twin of the
//   emblem glint), stamp-slam dust, impact micro-shakes, FOV widening on the fastest moves.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1090, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 100, light: 'day' },
  { id: 'cub', a: 101, b: 283, light: 'day' },
  { id: 'camp', a: 284, b: 372, light: 'golden' },
  { id: 'port', a: 373, b: 519, light: 'day' },
  { id: 'enlist', a: 520, b: 752, light: 'night' },
  { id: 'cassino', a: 753, b: 832, light: 'dusk' },
  { id: 'carry', a: 833, b: 966, light: 'dusk' },
  { id: 'emblem', a: 967, b: 1089, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff' };
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 45, fogFar: 240,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 16, ...WATER },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 40, fogFar: 220,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', vig: 0.26, shadowExt: 16, ...WATER },
  night: { az: 60, el: 38, sky: '#33456b', ground: '#1c1a20', hemi: 0.95, sun: '#aebfff', sunI: 1.15, fog: '#232c40', fogNear: 16, fogFar: 95,
    skyTop: '#131c30', skyHor: '#2c3a55', sat: 1.03, vig: 0.3, shadowExt: 9, waterDeep: '#1c2c3c', waterShal: '#2c445c', glint: '#cfe0ff' },
  dusk: { az: 30, el: 20, sky: '#8d8578', ground: '#4c4438', hemi: 0.95, sun: '#ffb46c', sunI: 2.0, fog: '#9a8a76', fogNear: 30, fogFar: 160,
    skyTop: '#5c5648', skyHor: '#d9a06a', sunDisc: '#ffe9c0', sunSize: 0.003, sat: 1.04, vig: 0.3, shadowExt: 14, waterDeep: '#2c445c', waterShal: '#3a5a74', glint: '#ffe9c0' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- v3 subject tracks (actors + camera read the SAME tracks) ----------
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11); // faint breathing under held poses
const laugh = (f, a, b, amp) => (f >= a && f < b) ? Math.abs(Math.sin((f - a) * 0.55)) * amp * Math.min(1, (f - a) / 6) * Math.min(1, (b - f) / 6) : 0;

// cub: pops up out of the crate on the phrase beats, looks left/right, wiggle burst near the end
export const cubYAt = (f) => kf([[101, 0.30], [150, 0.30], [168, 0.41, 'easeOut'], [182, 0.36], [232, 0.36], [248, 0.45, 'easeOut'], [262, 0.37], [283, 0.37]], f);
const cubRollAt = (f) => {
  let r = kf([[101, 0.03], [140, -0.06], [190, 0.07], [240, 0], [283, 0]], f);
  if (f >= 246 && f < 262) r += Math.sin((f - 246) * 1.4) * 0.05 * (1 - (f - 246) / 16); // keyed wiggle burst
  return r;
};
// camp wrestling: bear lunges in, gets pushed back, wins the final shove; soldier knocked back
const campBearX = (f) => kf([[284, 0.15], [300, 0.32, 'easeIn'], [322, 0.04], [344, 0.24, 'easeIn'], [360, 0.18], [372, 0.18]], f);
const campSoldX = (f) => kf([[284, 1.05], [306, 1.20], [330, 1.08], [352, 1.12], [372, 1.12]], f);
// port: the bear retreats a half-step when the officer refuses him
const portBearZ = (f) => kf([[373, -1.15], [476, -1.15], [500, -1.28, 'easeInOut'], [519, -1.28]], f);
// officer's keyed head-shake: small burst on the rule, big decaying burst on "No pets on the ship"
const officerShake = (f) => {
  if (f >= 448 && f < 464) return Math.sin((f - 448) * 1.85) * 1.5 * Math.sin(Math.PI * (f - 448) / 16);
  if (f >= 476 && f < 503) return Math.sin((f - 476) * 1.85) * 3.0 * Math.min(1, (f - 476) / 3) * (1 - 0.5 * (f - 476) / 27);
  return 0;
};
// enlistment focus point: desk -> stamp (hit at 612) -> the bear's face for "Private Wojtek"
const enlistFocus = (f) => kf3([[520, [60.35, 1.02, -1.0]], [600, [60.8, 1.05, -1.0], 'surge'], [612, [61.05, 1.08, -1.0], 'easeIn'], [645, [60.6, 1.12, -0.35], 'surge'], [680, [59.98, 1.32, 0.32], 'surge'], [752, [59.98, 1.32, 0.32]]], f);
// cassino: the soldiers' heave cycle + the hauled crate's path (same path worldState draws)
const heaveAt = (f) => kf([[753, 0], [770, 1, 'easeInOut'], [784, 0.15], [798, 1, 'easeInOut'], [808, 0.15], [822, 1, 'easeInOut'], [832, 0.4]], f);
const cassinoSubj = (f) => {
  const ht = ramp(f, 758, 826);
  const crate = [87.8 + 3.6 * ht, 0.55, -1.6 + 0.35 * ht];
  if (f <= 826) return crate;
  return lerp3(crate, [90.9, 0.9, 0.15], M.smooth(ramp(f, 826, 832))); // attention hands over to the bear
};
// THE carry track: crouch (anticipation) -> lift overshoot -> walk -> set-down dip -> keyed
// bounce settle -> walk back -> second pick-up -> second carry -> second set-down.
export const bearCarry = (f) => {
  const x = kf([[833, 88.45], [862, 88.45], [903, 91.25, 'surge'], [914, 91.25], [936, 88.62, 'easeInOut'], [948, 88.62], [961, 91.25, 'surge'], [966, 91.25]], f);
  const phase = kf([[833, 0], [862, 0], [903, 2.55, 'surge'], [914, 2.55], [936, 4.85, 'easeInOut'], [948, 4.85], [961, 7.15, 'surge'], [966, 7.15]], f);
  const y = kf([[833, 0], [848, -0.055], [860, 0.02, 'easeOut'], [868, 0.004], [903, 0.004], [910, -0.05, 'easeIn'], [916, 0.006, 'easeOut'], [922, -0.004], [934, 0], [946, -0.05], [954, 0.018, 'easeOut'], [961, 0.004], [966, -0.035, 'easeIn']], f);
  const roll = kf([[833, 0], [848, 0.05], [862, 0.01], [903, 0.01], [910, 0.045], [920, 0], [946, 0.04], [954, 0.01], [966, 0.01]], f);
  const yaw = kf([[833, 0], [905, 0], [914, 0.13], [936, 0.13], [944, 0], [966, 0]], f);
  const carry = (f >= 850 && f < 908) || (f >= 946 && f < 965);
  return { pos: [x, y, -0.35], phase, carry, yaw, roll };
};

// ---------- cameras ----------
const CAMS = {
  // v2 dolly keys kept as the base move; v3 adds subject tracking on top (see TRACK/baseCam).
  hook: [ // slow dramatic push-in on the rank reveal (f0-83), then a held settle
    { f: 0, pos: [-1.52, 1.66, 5.95], look: [-1.18, 1.04, -0.35], fov: 41 },
    { f: 40, pos: [-1.2, 1.58, 4.95], look: [-1.0, 1.08, -0.28], fov: 39, ease: 'surge' },
    { f: 83, pos: [-0.97, 1.5, 3.98], look: [-0.88, 1.12, -0.22], fov: 36.5, ease: 'surge' },
    { f: 100, pos: [-0.94, 1.49, 3.82], look: [-0.87, 1.12, -0.22], fov: 36 },
  ],
  cub: [ // gentle arcing push-in on the cub; ends close so the camp bridge can pull back out of it
    { f: 101, pos: [0.74, 1.46, 5.0], look: [0.55, 0.5, 0.9], fov: 39 },
    { f: 190, pos: [0.62, 1.34, 4.2], look: [0.55, 0.48, 0.9], fov: 37.5, ease: 'surge', path: [[0.52, 1.4, 4.62]] },
    { f: 250, pos: [0.57, 1.27, 3.78], look: [0.55, 0.47, 0.9], fov: 36.5, ease: 'surge' },
    { f: 283, pos: [0.55, 1.24, 3.6], look: [0.55, 0.46, 0.9], fov: 36 },
  ],
  camp: [ // bridge pulls back to this wider wrestling framing, then a slow push through the bout
    { f: 284, pos: [0.12, 1.62, 5.35], look: [0.3, 0.78, 0.25], fov: 41 },
    { f: 330, pos: [0.3, 1.56, 4.95], look: [0.38, 0.75, 0.22], fov: 40, ease: 'surge' },
    { f: 372, pos: [0.22, 1.5, 4.55], look: [0.35, 0.72, 0.2], fov: 39 },
  ],
  port: [ // fast arcing sweep-in off the dip, settle, then a slow push on the "No pets" beat
    { f: 373, pos: [29.55, 2.3, 4.7], look: [29.9, 1.1, -2.1], fov: 46 },
    { f: 424, pos: [29.82, 2.0, 3.3], look: [29.85, 1.04, -1.85], fov: 43, ease: 'easeOut', path: [[29.45, 2.22, 4.05]] },
    { f: 519, pos: [29.8, 1.88, 2.62], look: [29.85, 1.02, -1.7], fov: 40, ease: 'surge' },
  ],
  enlist: [ // one long slow push: desk -> stamp (kick at 612) -> paybook/bear for "Private Wojtek"
    { f: 520, pos: [60.42, 1.7, 3.55], look: [60.42, 1.05, -0.85], fov: 43 },
    { f: 600, pos: [60.3, 1.63, 3.1], look: [60.38, 1.06, -0.82], fov: 41, ease: 'surge' },
    { f: 680, pos: [60.2, 1.58, 2.82], look: [60.25, 1.1, -0.68], fov: 39.5, ease: 'surge' },
    { f: 752, pos: [60.12, 1.55, 2.62], look: [60.18, 1.12, -0.6], fov: 38 },
  ],
  cassino: [ // gentle pan; v3 tracking below locks the look onto the hauled crate
    { f: 753, pos: [89.65, 2.02, 4.95], look: [89.85, 0.95, -1.65], fov: 44 },
    { f: 795, pos: [89.95, 1.92, 4.6], look: [90.05, 0.95, -1.55], fov: 42.5, ease: 'surge' },
    { f: 832, pos: [90.35, 1.86, 4.35], look: [90.3, 0.94, -1.5], fov: 41 },
  ],
  emblem: [ // held reveal: slow push, then a rising crane move into the final corporal emblem (glint FX 1040-1060)
    { f: 967, pos: [98.15, 1.66, 1.8], look: [95.95, 1.22, -2.9], fov: 43 },
    { f: 1030, pos: [97.8, 1.7, 1.32], look: [96.02, 1.27, -2.9], fov: 41.5, ease: 'surge' },
    { f: 1089, pos: [97.42, 1.99, 0.92], look: [96.1, 1.4, -2.86], fov: 39, roll: 2.5, ease: 'surge' },
  ],
};
const KICKS = { enlist: [{ f: 612, a: 0.05 }], carry: [{ f: 905, a: 0.04 }, { f: 963, a: 0.04 }] };
const SHADOW_AT = { hook: [0, 1, 0], cub: [0.5, 0.6, 0.9], camp: [0.4, 0.8, 0.2], port: [29.9, 1, -1.6], enlist: [60.2, 1, -0.6], cassino: [90, 1, -1.2], carry: [90, 1, -0.6], emblem: [96.0, 1.2, -2.9] };
// v2 transitions kept: same/near-zone cuts become fast camera flights blended from the previous
// shot's end camera; far zone changes (and the day->night jump) get a 6-frame dip-to-black.
const BRIDGES = { camp: 14, carry: 10, emblem: 16 };
const DIPS = [373, 520, 753];

// ---------- v3 TRACKING CAMERA ----------
// look = subjectTrack(f) + keyframed offset, blended over the v2 dolly look by weight w.
// follow (cassino): the dolly position also translates with the subject's displacement.
const TRACK = {
  hook:   { subj: () => [-0.9, 0, -0.2], off: [0.02, 1.12, 0], w: 0.85 },
  cub:    { subj: (f) => [0.55, cubYAt(f), 0.92], off: [0, 0.30, 0], w: 0.8 },
  camp:   { subj: (f) => [lerp(campBearX(f), campSoldX(f), 0.45), 0, 0.42], off: [0, 0.82, 0], w: 0.7 },
  port:   { subj: (f) => [29.8, 0.55, portBearZ(f)], off: [0.45, 0.55, -0.3], w: 0.65 },
  enlist: { subj: enlistFocus, off: [0, 0.04, 0], w: 0.65 },
  cassino:{ subj: cassinoSubj, off: [0, 0.48, 0], w: 0.75, follow: 0.15 },
  emblem: { subj: () => [96.4, 0, -2.2], off: [-0.28, 1.34, -0.68], w: 0.8 },
};
// carry: a true tracking dolly — position AND look are computed from bearCarry(f) every frame.
// CARRY_OFF is the keyframed dolly offset from the bear (reproduces v2's proven geometry,
// incl. the f908 punch-in: offset z closes 4.85 -> 4.40 while fov snaps 40 -> 36.5).
const CARRY_OFF = [[833, [-0.70, 1.86, 5.10]], [872, [-0.75, 1.82, 4.95], 'surge'], [898, [-0.65, 1.80, 4.85], 'surge'], [908, [-0.55, 1.76, 4.40], 'easeOut'], [924, [-0.30, 1.80, 4.85], 'easeInOut'], [940, [-0.55, 1.82, 4.95], 'easeInOut'], [966, [-0.60, 1.78, 4.80]]];
const CARRY_FOV = [[833, 41], [898, 40], [908, 36.5, 'easeOut'], [924, 39.5, 'easeInOut'], [966, 39.5]];
const baseCam = (id, f, withKicks = false) => {
  if (id === 'carry') {
    const B = bearCarry(f), off = kf3(CARRY_OFF, f);
    let fov = kf(CARRY_FOV, f);
    fov *= 1 - 0.0012 * Math.max(0, f - 833) * 0.15; // same hold-creep as camFromKeys
    const c = { pos: [B.pos[0] + off[0], off[1], B.pos[2] + off[2]], look: [B.pos[0] + 0.05, 1.03 + B.pos[1], B.pos[2]], fov, roll: 0 };
    if (withKicks) for (const k of KICKS.carry) { const d = f - k.f; if (d >= 0 && d < 7) { const s = (d % 2 ? -1 : 1) * k.a * (1 - d / 7); c.look = [c.look[0], c.look[1] + s * 3, c.look[2] + s * 2]; c.roll = (c.roll || 0) + s * 20; } }
    return c;
  }
  return camFromKeys(CAMS[id], f, { kicks: withKicks ? (KICKS[id] || []) : [] });
};
// ---------- v4 TRACKING DIRECTOR ----------
// Live positions of every trackable thing in the world (single source, shared by camAt + fxAt).
export const crateHaulAt = (f) => { const ht = ramp(f, 758, 826); return [87.8 + 3.6 * ht, 0.55 + Math.abs(Math.sin(ht * 24)) * 0.03, -1.6 + 0.35 * ht]; }; // == main.js worldState haulCrate
const crateHandAt = (f) => { const B = bearCarry(f); return [B.pos[0], B.pos[1] + 0.57, B.pos[2] + 0.12]; }; // crate centre in the bear's arms (card art: design y 636-806)
const crateStackAt = () => [91.9, 0.85, -1.12]; // where a set-down crate lands (the stack, cf. dust at 91.8)
const stampDipAt = (f) => f < 612 ? 0 : f < 620 ? (f - 612) / 8 : f < 630 ? 1 - (f - 620) / 10 : 0; // == worldAt stamp envelope
const stampAt = (f) => [61.35, 1.32 - 0.17 * stampDipAt(f), -1.0]; // the stamp head (rides its own slam dip)
const BOOK_AT = [60.05, 1.32, -0.52]; // the paybook stand in the office set
const bearHeadTrk = (f) => { const B = bearCarry(f); return [B.pos[0], 1.35 + B.pos[1], B.pos[2]]; };
// TRACKDIR — {a, b, type: 'subject'|'character'|'object', id, pos(f) -> live target, w: look weight,
// posW: optional camera-position follow weight (target motion is added to the dolly)}.
const TRACKDIR = {
  hook: [
    { a: 0, b: 100, type: 'subject', id: 'bear', pos: () => [-0.88, 1.12, -0.2], w: 0.35 },
  ],
  cub: [
    { a: 101, b: 283, type: 'subject', id: 'cub', pos: (f) => [0.55, cubYAt(f) + 0.3, 0.92], w: 0.35 },
  ],
  camp: [
    { a: 284, b: 322, type: 'subject', id: 'bear', pos: (f) => [lerp(campBearX(f), campSoldX(f), 0.45), 0.82, 0.42], w: 0.3 },
    { a: 322, b: 350, type: 'character', id: 'opponent', pos: (f) => [campSoldX(f), 1.15, 0.35], w: 0.55 }, // the shove: camera swings onto the opponent
    { a: 350, b: 372, type: 'subject', id: 'bear', pos: (f) => [lerp(campBearX(f), campSoldX(f), 0.45), 0.82, 0.42], w: 0.3 },
  ],
  port: [
    { a: 373, b: 448, type: 'subject', id: 'bear', pos: (f) => [29.8, 1.1, portBearZ(f)], w: 0.3 },
    { a: 448, b: 510, type: 'character', id: 'officer', pos: () => [30.7, 1.8, -1.6], w: 0.6 }, // refusal: reframe onto the officer (head-shake, crossed arms)
    { a: 510, b: 519, type: 'subject', id: 'bear', pos: (f) => [29.8, 1.3, portBearZ(f)], w: 0.5 }, // hand back to the bear's droop
  ],
  enlist: [
    { a: 520, b: 600, type: 'subject', id: 'focus', pos: (f) => enlistFocus(f), w: 0.3 },
    { a: 600, b: 626, type: 'object', id: 'stamp', pos: stampAt, w: 0.62, posW: 0.35 }, // track the stamp into the f612 slam; dolly rides the dip
    { a: 626, b: 650, type: 'character', id: 'officer', pos: () => [61.35, 1.35, -1.95], w: 0.5 }, // the officer's lean + point after the slam
    { a: 650, b: 700, type: 'object', id: 'paybook', pos: () => BOOK_AT, w: 0.6 }, // track the paybook as it is presented
    { a: 700, b: 752, type: 'subject', id: 'bear', pos: () => [59.95, 1.35, 0.35], w: 0.45 },
  ],
  cassino: [
    { a: 753, b: 774, type: 'character', id: 'haulers', pos: () => [88.8, 1.05, -1.47], w: 0.5 }, // the heaving soldiers
    { a: 774, b: 826, type: 'object', id: 'crate', pos: (f) => { const c = crateHaulAt(f); return [c[0], c[1] + 0.22, c[2]]; }, w: 0.6, posW: 0.3 }, // the crate between the men; dolly rides it
    { a: 826, b: 832, type: 'subject', id: 'bear', pos: () => [90.9, 1.3, 0.15], w: 0.5 }, // hand-over to the watching bear
  ],
  carry: [
    { a: 833, b: 848, type: 'subject', id: 'bear', pos: bearHeadTrk, w: 0.3 },
    { a: 848, b: 866, type: 'object', id: 'crate', pos: crateHandAt, w: 0.55, posW: 0.25 }, // lift: lock onto the crate in his arms
    { a: 866, b: 900, type: 'subject', id: 'bear', pos: bearHeadTrk, w: 0.3 },
    { a: 900, b: 912, type: 'object', id: 'crate', pos: (f) => lerp3(crateHandAt(f), crateStackAt(), smooth(ramp(f, 903, 911))), w: 0.6, posW: 0.25 }, // set-down 1: hands -> stack
    { a: 912, b: 958, type: 'subject', id: 'bear', pos: bearHeadTrk, w: 0.3 },
    { a: 958, b: 966, type: 'object', id: 'crate', pos: (f) => lerp3(crateHandAt(f), crateStackAt(), smooth(ramp(f, 960, 968))), w: 0.6, posW: 0.25 }, // set-down 2
  ],
  emblem: [
    { a: 967, b: 1089, type: 'subject', id: 'bear', pos: () => [96.4, 1.35, -2.2], w: 0.35 },
  ],
};
const BLEND = 10; // frames: tracked targets hand off over this window (centred on the boundary)
/** The director's verdict for a shot at frame f: blended target point + look weight + the raw active segment. */
export const dirFor = (id, f) => {
  const segs = TRACKDIR[id];
  let i = segs.findIndex((s) => f <= s.b); if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  let point = seg.pos(f), w = seg.w;
  const nx = segs[i + 1];
  if (nx && f >= nx.a - BLEND / 2) {
    const t = smooth(ramp(f, nx.a - BLEND / 2, nx.a + BLEND / 2));
    point = lerp3(point, nx.pos(f), t); w = lerp(w, nx.w, t);
  }
  return { point, w, seg };
};
export const dirAt = (f) => dirFor(shotAt(f).id, f);
// FOV speed feel: brief widening on the fastest tracking moves (bridges, port sweep, haul hand-over).
const fovFeel = (f) => {
  let b = 0;
  const bump = (a, bb, peak) => { if (f >= a && f <= bb) b += peak * Math.sin(Math.PI * ramp(f, a, bb)); };
  bump(284, 298, 2.2); bump(373, 396, 2.0); bump(820, 832, 2.4); bump(833, 845, 1.6); bump(967, 983, 2.2);
  return b;
};
// Impact micro-shake: 4-frame decaying tremor (peak ~0.004 m at the camera ~ a few px on screen).
const SHAKES = [{ f: 612, a: 0.004 }, { f: 907, a: 0.0032 }, { f: 965, a: 0.0032 }];
const SHAKE_SHAPE = [1, -0.62, 0.3, -0.12];

// One shot's full camera at frame f: v2 dolly + v3 subject tracking + v4 director (no bridges).
const shotCam = (id, f) => {
  let c = baseCam(id, f, true);
  const tr = TRACK[id];
  if (tr) {
    const sp = tr.subj(f);
    const lt = [sp[0] + tr.off[0], sp[1] + tr.off[1], sp[2] + tr.off[2]];
    c = { ...c, look: lerp3(c.look, lt, tr.w) };
    if (tr.follow) { const a0 = SHOTS.find((s) => s.id === id).a, sp0 = tr.subj(a0); c = { ...c, pos: c.pos.map((v, i) => v + (sp[i] - sp0[i]) * tr.follow) }; }
  }
  // v4 TRACKING DIRECTOR: steer the look onto the tracked subject/character/object (TRACKDIR).
  const D = dirFor(id, f);
  c.look = lerp3(c.look, D.point, D.w);
  if (D.seg.posW && f >= D.seg.a && f <= D.seg.b) { // marked beats: the dolly rides the target's own motion (faded in/out at the segment ends)
    const fade = smooth(ramp(f, D.seg.a, D.seg.a + 5)) * (1 - smooth(ramp(f, D.seg.b - 5, D.seg.b)));
    const p0 = D.seg.pos(D.seg.a), p1 = D.seg.pos(f);
    if (fade > 0) c.pos = c.pos.map((v, i) => v + (p1[i] - p0[i]) * D.seg.posW * fade);
  }
  return c;
};
export const camAt = (f) => {
  const S = shotAt(f);
  let c = shotCam(S.id, f);
  const bd = BRIDGES[S.id];
  if (bd && f - S.a < bd) {
    const P = SHOTS[SHOTS.indexOf(S) - 1];
    const pc = shotCam(P.id, P.b); // v4: bridges blend from the previous shot's actual tracked end-camera (v3 used the raw dolly — a seam)
    const t = smooth(ramp(f, S.a, S.a + bd));
    c = { pos: lerp3(pc.pos, c.pos, t), look: lerp3(pc.look, c.look, t), fov: lerp(pc.fov, c.fov, t), roll: lerp(pc.roll || 0, c.roll || 0, t) };
  }
  c.fov += fovFeel(f); // v4 speed feel on the fastest tracking moves
  for (const s of SHAKES) { // v4 impact micro-shake (stamp slam + both crate set-downs)
    const d = f - s.f;
    if (d >= 0 && d < 4) { const m = s.a * SHAKE_SHAPE[d]; c.pos = [c.pos[0] + m * 0.5, c.pos[1] + m, c.pos[2]]; c.look = [c.look[0] + m * 0.8, c.look[1] + m * 1.4, c.look[2]]; }
  }
  let flash = 0;
  if (f < 9) flash = -0.95 * (1 - f / 9); // fade in from black
  if (f >= 101 && f < 106) flash = (1 - (f - 101) / 5) * 0.7;
  for (const B of DIPS) { const d = f - B; if (d >= -3 && d <= 3) flash = Math.min(flash, -0.95 * Math.cos(d / 3 * Math.PI / 2)); }
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens (focus distance tracks the subject too) ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const cinf = { // v3 per-shot blur strengths, unchanged
    hook: lerp(11, 0, smooth(ramp(f, 34, 68))), cub: 9, camp: 7, port: 6, enlist: 11, cassino: 5, carry: 8, emblem: 9,
  }[S.id] ?? 0;
  return { focus: dist(C.pos, dirAt(f).point), cinf }; // v4: focus rides the tracked target, like the look
};

// ---------- world state (drives set pieces in main.js worldState) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, stack: 0, haulT: 0, stamp: 0, sway: f };
  if (S.id === 'enlist') W.stamp = f < 612 ? 0 : f < 620 ? (f - 612) / 8 : f < 630 ? 1 - (f - 620) / 10 : 0;
  if (S.id === 'cassino') { W.haulT = ramp(f, 758, 826); W.stack = f >= 828 ? 3 : 2; }
  if (S.id === 'carry') W.stack = 3 + (f >= 907 ? 1 : 0) + (f >= 965 ? 1 : 0);
  if (S.id === 'emblem') W.stack = 5;
  return W;
};

// ---------- actors (2D cards) — v3: every action keyframed to the phrase beats ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RB = (T, o, pos, extra = {}) => ({ key: 'bear' + JSON.stringify(o), draw: (p) => T.bearCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const TINT = { day: '#ffffff', golden: '#ffe2c8', night: '#b9c8ff', dusk: '#ffd9ae' };

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = TINT[S.light] || '#ffffff';
  switch (S.id) {
    case 'hook': {
      // rank reveal: the bear turns to camera on the beat and holds a proud stare (no blink);
      // the soldier turns his head to him, then raises an arm to present him.
      const bearYaw = kf([[0, -0.10], [30, -0.10], [58, 0, 'surge'], [100, 0]], f);
      const bearY = kf([[0, 0], [62, 0], [74, 0.015, 'easeOut'], [88, 0], [100, 0]], f) + breath(f, 5) * 0.4;
      out.push(RB(T, { expr: 'proud', stripes: 2, blink: (f >= 55 && f <= 92) ? 0 : blinkAt(f, 5), step: 0 }, [-0.9, bearY, -0.2],
        { tint, s: kf([[0, 0.98], [83, 0.995, 'surge'], [100, 0.995]], f), yaw: bearYaw, roll: kf([[0, 0], [70, 0], [83, -0.02], [100, -0.012]], f) }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'smile', L: 'hang', R: (f >= 58 && f < 86) ? 'up' : 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), tilt: 0, headTilt: q(kf([[0, 0], [25, 0], [45, 5, 'surge'], [100, 5]], f), 1) }, [-1.85, 0, -0.55], { tint }));
      break;
    }
    case 'cub': {
      // the cub pops up twice on the beats, looks left then right, wiggle burst before the cut;
      // the soldiers lean in and turn their heads to it; one points, then clasps his belly in delight.
      const cy = cubYAt(f), cr = cubRollAt(f);
      const cubBlink = ((f >= 163 && f <= 180) || (f >= 243 && f <= 260)) ? 0 : blinkAt(f, 7);
      out.push(RB(T, { expr: 'curious', blink: cubBlink }, [0.55, cy, 0.92], { tint, s: 0.42, roll: cr, yaw: cr * 1.6 }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'smile', L: 'belly', R: f < 170 ? 'point' : 'belly', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), tilt: q(kf([[101, 6], [170, 8.5, 'surge'], [283, 8.5]], f), 1), headTilt: q(kf([[101, -2], [150, -5], [283, -5]], f), 1) }, [1.55, 0, 0.15], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'grin', L: 'hang', R: 'hang', blink: blinkAt(f, 13), bob: q(breath(f, 13) + laugh(f, 236, 262, 0.02), 3), tilt: q(kf([[101, 5], [200, 7], [283, 7]], f), 1), headTilt: q(kf([[101, 3], [283, 4.5]], f), 1) }, [-0.42, 0, 0.05], { tint }));
      break;
    }
    case 'camp': {
      // choreographed wrestling: lunge (284-300) -> pushed back (300-322) -> winning shove
      // (322-344) -> both settle, soldier knocked back then laughing (352+).
      const bx = campBearX(f);
      const bRoll = kf([[284, 0], [300, -0.17, 'easeIn'], [322, 0.15], [344, -0.07, 'easeIn'], [358, 0], [372, 0]], f);
      const bStep = kf([[284, 0], [300, 0.55], [322, 0.55], [344, 1.05], [372, 1.05]], f);
      const bY = kf([[284, 0], [300, -0.02], [322, -0.03], [344, 0], [372, 0]], f);
      const grapple = f >= 290 && f < 350;
      out.push(RB(T, { expr: f < 350 ? 'grin' : 'proud', wrestle: grapple ? 1 : 0, blink: f < 350 ? 0 : blinkAt(f, 8), step: q(bStep) }, [bx, bY, 0.5], { tint, s: 0.68, roll: bRoll }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: f < 350 ? 'laugh' : 'laugh', L: grapple ? 'reach' : 'belly', R: grapple ? 'reach' : 'belly', blink: 0, bob: q(breath(f, 11) + laugh(f, 352, 372, 0.025), 3), tilt: q(kf([[284, 0], [308, -8], [330, -2], [352, 0], [372, 0]], f), 1), headTilt: q(kf([[284, -2], [372, -3]], f), 1) }, [campSoldX(f), 0, 0.35], { tint }));
      out.push(R(T, 'soldier44c', { seed: 13, expr: 'laugh', L: 'belly', R: 'belly', blink: 0, bob: q(breath(f, 13) + laugh(f, 300, 320, 0.012) + laugh(f, 340, 372, 0.03), 3), tilt: q(2, 1), headTilt: q(3, 1) }, [-0.85, 0, -0.45], { tint }));
      break;
    }
    case 'port': {
      // the officer points the rule, shakes his head in two keyed bursts (big one lands on
      // "No pets on the ship", 476-503) and crosses his arms; the soldier steps in to plead;
      // the bear droops and retreats a half-step.
      out.push(R(T, 'officer44', { seed: 21, expr: 'stubborn', L: 'hip', R: f < 473 ? 'point' : 'cross', blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), tilt: q(kf([[373, 0], [455, 2], [476, 3], [519, 1]], f), 1), headTilt: q(officerShake(f), 1) }, [30.7, 0.55, -1.6], { tint }));
      const bearY = 0.55 + kf([[373, 0], [490, -0.05], [519, -0.03]], f);
      out.push(RB(T, { expr: f >= 476 ? 'sad' : 'curious', blink: blinkAt(f, 9), step: q(kf([[476, 0], [500, 0.5], [519, 0.5]], f)) }, [29.8, bearY, portBearZ(f)],
        { tint, s: 0.8, roll: kf([[373, 0], [495, 0.055], [519, 0.04]], f), yaw: kf([[373, -0.09], [470, -0.09], [503, 0], [519, 0]], f) }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'neutral', L: (f >= 445 && f < 476) ? 'belly' : 'hang', R: (f >= 445 && f < 476) ? 'belly' : 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), tilt: 0, headTilt: q(kf([[373, 0], [445, 5], [519, 5]], f), 1), step: q(kf([[420, 0], [445, 1.3], [519, 1.3]], f)) },
        [kf([[373, 28.85], [420, 28.85], [445, 29.18, 'easeInOut'], [519, 29.18]], f), 0.55, -1.8], { tint }));
      break;
    }
    case 'enlist': {
      // the officer raises the stamp (anticipation 590-611), slams it at 612 as the world
      // stamp dips, then points the paybook out; the bear turns front and puffs up proud
      // on "Private Wojtek" (653+); the soldier turns to him and cheers.
      const offR = f < 590 ? 'hang' : f < 612 ? 'up' : f < 645 ? 'point' : f < 665 ? 'hang' : f < 725 ? 'point' : 'hang';
      out.push(R(T, 'officer44', { seed: 21, expr: f >= 612 ? 'smile' : 'neutral', L: 'belly', R: offR, blink: blinkAt(f, 21), bob: q(breath(f, 21), 3), tilt: q(kf([[520, 3], [600, 5], [612, 9, 'easeIn'], [628, 4], [752, 3]], f), 1), headTilt: q(kf([[520, 0], [650, 0], [675, -5], [752, -5]], f), 1) }, [61.35, 0, -1.95], { tint }));
      const bearY = kf([[520, 0], [675, 0.02, 'surge'], [752, 0.016]], f) + breath(f, 10) * 0.4;
      out.push(RB(T, { expr: f >= 653 ? 'proud' : 'curious', blink: blinkAt(f, 10), step: 0 }, [59.95, bearY, 0.35],
        { tint, s: kf([[520, 0.85], [675, 0.878, 'surge'], [752, 0.872]], f), yaw: kf([[520, 0.10], [640, 0.10], [668, 0, 'surge'], [752, 0]], f), roll: kf([[520, 0], [675, -0.015], [705, 0], [752, 0]], f) }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'smile', L: 'hang', R: (f >= 690 && f < 728) ? 'up' : 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11), 3), tilt: 0, headTilt: q(kf([[520, 0], [655, 0], [678, -6], [752, -6]], f), 1) }, [60.95, 0, -0.25], { tint }));
      break;
    }
    case 'cassino': {
      // three keyed heaves (758-770, 784-798, 808-822): the soldiers lean and dip together,
      // the reacher's arms rise with the crate (lift = heave). The bear's head TRACKS the
      // passing crate, then he crouches toward his own crate — "copied the men".
      const heave = heaveAt(f), crateX = 87.8 + 3.6 * ramp(f, 758, 826);
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'stubborn', L: 'lift', R: 'lift', blink: blinkAt(f, 11), bob: q(-0.015 * heave + breath(f, 11), 3), tilt: q(2 + heave * 7, 1), headTilt: q(kf([[753, 0], [800, 2], [832, 0]], f), 1) }, [87.85, 0, -1.35], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'stubborn', L: 'reach', R: 'reach', lift: q(heave, 2), blink: blinkAt(f, 12), bob: q(-0.015 * heave + breath(f, 12), 3), tilt: q(2.5 + heave * 7.5, 1), headTilt: q(kf([[753, 0], [800, 2], [832, 0]], f), 1) }, [89.75, 0, -1.6], { tint }));
      const bearY = kf([[753, 0], [826, 0], [832, -0.045]], f);
      out.push(RB(T, { expr: 'determined', blink: blinkAt(f, 14), step: q(kf([[826, 0], [832, 0.4]], f)) }, [90.9, bearY, 0.15],
        { tint, s: 0.95, yaw: q(clamp((crateX - 90.9) * 0.22, -0.18, 0.18), 2), roll: kf([[753, 0], [826, 0], [832, 0.05]], f) }));
      break;
    }
    case 'carry': {
      // the bear performs bearCarry() (crouch-lift-walk-settle x2); both soldiers' heads
      // TRACK him as he passes; arms go up at each set-down.
      const B = bearCarry(f);
      out.push(RB(T, { expr: B.carry ? 'determined' : 'proud', carry: B.carry, blink: blinkAt(f, 15), step: q(B.phase) }, B.pos, { tint, s: 0.98, yaw: B.yaw, roll: B.roll }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: f >= 905 ? 'grin' : 'neutral', L: 'hang', R: f >= 940 ? 'up' : 'hang', blink: blinkAt(f, 11), bob: q(breath(f, 11) + laugh(f, 905, 922, 0.02), 3), tilt: 0, headTilt: q(clamp((B.pos[0] - 88.4) * 5, 0, 8), 1) }, [87.8, 0, -1.3], { tint }));
      const cheer = (f >= 903 && f < 925) || f >= 955;
      out.push(R(T, 'soldier44c', { seed: 13, expr: f >= 905 ? 'laugh' : 'smile', L: cheer ? 'up' : 'hang', R: cheer ? 'up' : 'belly', blink: blinkAt(f, 13), bob: q(breath(f, 13) + laugh(f, 905, 925, 0.028), 3), tilt: 0, headTilt: q(clamp((B.pos[0] - 92.7) * 5, -8, 0), 1) }, [92.7, 0, -0.85], { tint }));
      break;
    }
    case 'emblem': {
      // the reveal: the bear turns front and swells proud into the glint (blink held),
      // both soldiers turn their heads to him and throw their arms up.
      const bearY = kf([[967, 0], [1030, 0.02, 'surge'], [1089, 0.02]], f) + breath(f, 16) * 0.4;
      out.push(RB(T, { expr: 'proud', stripes: 2, blink: (f >= 1035 && f <= 1072) ? 0 : blinkAt(f, 16), step: 0 }, [96.4, bearY, -2.2],
        { tint, s: kf([[967, 0.98], [1030, 1.015, 'surge'], [1089, 1.01]], f), yaw: kf([[967, 0.06], [1000, 0, 'surge'], [1089, 0]], f), roll: kf([[967, 0], [1040, -0.012], [1089, -0.012]], f) }));
      out.push(R(T, 'soldier44a', { seed: 11, expr: 'grin', L: f >= 1040 ? 'up' : 'hang', R: 'up', blink: blinkAt(f, 11), bob: q(breath(f, 11) + laugh(f, 1040, 1062, 0.018), 3), tilt: 0, headTilt: q(kf([[967, 0], [990, 5], [1089, 5]], f), 1) }, [95.0, 0, -0.9], { tint }));
      out.push(R(T, 'soldier44b', { seed: 12, expr: 'smile', L: 'up', R: f >= 1040 ? 'up' : 'hang', blink: blinkAt(f, 12), bob: q(breath(f, 12) + laugh(f, 1042, 1064, 0.018), 3), tilt: 0, headTilt: q(kf([[967, 0], [990, -5], [1089, -5]], f), 1) }, [97.7, 0, -1.1], { tint }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' || S.id === 'cub') { // drifting leaves on the hill breeze
    for (let i = 0; i < 5; i++) {
      const t = ((f - 10) * 0.011 + i / 5) % 1; if (t < 0) continue;
      const cols = ['#d9822b', '#c4452c', '#e6b13a'];
      out.push(FX('leaf' + (i % 3), (p) => T.fxLeaf(p, cols[i % 3]), [-3.2 + t * 7.5, 2.8 - t * 2.6, -1.0 + i * 0.45], 0.11, { roll: q(t * 8 + i, 1) }));
    }
  }
  if (S.id === 'carry' && ((f >= 903 && f < 915) || (f >= 961 && f < 973))) { // crate stack thud dust
    const base = f >= 961 ? 961 : 903, t = q((f - base) / 12, 2);
    out.push(FX('dust' + t, (p) => T.fxDust(p, t, '#cbb894'), [91.8, 0.3, -0.9], 0.32));
  }
  if (S.id === 'emblem' && f >= 1040 && f < 1060) { // warm glint on the corporal reveal
    const t = q((f - 1040) / 20, 2);
    out.push(FX('glint' + t, (p) => T.fxStars(p, t), [96.2, 1.62, -2.0], 0.3));
  }
  // ---- v4 tracking VFX: the eye is led to whatever the camera is tracking ----
  // soft warm glow pulse on the tracked OBJECT (peak alpha < 0.3: never registers in the ND/ink pass)
  const glow = (tp, s, a) => out.push(FX('glow' + q(a, 2) + '_' + q(tp[0], 1), (p) => fxGlow(p, a), [tp[0], tp[1] - 0.81 * s, tp[2] + 0.12], s));
  if (S.id === 'cassino' && f >= 774 && f <= 826) { const c = crateHaulAt(f); glow([c[0], c[1] + 0.22, c[2]], 0.85, 0.17 + 0.06 * Math.sin((f - 774) * 0.35)); }
  if (S.id === 'carry' && ((f >= 848 && f < 866) || (f >= 900 && f < 912) || (f >= 958 && f < 966))) glow(dirAt(f).seg.pos(f), 0.7, 0.16 + 0.06 * Math.sin(f * 0.35));
  if (S.id === 'enlist' && f >= 600 && f < 626) glow(stampAt(f), 0.5, 0.17 + 0.06 * Math.sin((f - 600) * 0.35));
  if (S.id === 'enlist' && f >= 650 && f < 700) glow(BOOK_AT, 0.55, 0.15 + 0.05 * Math.sin((f - 650) * 0.3));
  if (S.id === 'enlist' && f >= 612 && f < 620) { // dust burst on the stamp slam
    const t = q((f - 612) / 8, 2);
    out.push(FX('sdust' + t, (p) => T.fxDust(p, t, '#9fb0c8'), [61.35, 0.85, -0.75], 0.22));
  }
  if (S.id === 'enlist' && f >= 664 && f < 682) { // paybook glint — twin of the emblem glint, on its track beat
    const t = q((f - 664) / 18, 2);
    out.push(FX('bglint' + t, (p) => T.fxStars(p, t), [60.05, 0.75, -0.32], 0.3));
  }
  return out;
};
// soft radial warm glow (design-space centre 300,640 -> 0.81 m above the card origin at s=1)
const fxGlow = (p, a) => {
  const g = p.g;
  const gr = g.createRadialGradient(300, 640, 12, 300, 640, 300);
  gr.addColorStop(0, `rgba(255,208,112,${a.toFixed(3)})`);
  gr.addColorStop(0.55, `rgba(255,182,84,${(a * 0.45).toFixed(3)})`);
  gr.addColorStop(1, 'rgba(255,182,84,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 600, 1000);
};
