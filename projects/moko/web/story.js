// Shot plan for "Moko — The Dolphin Who Saved the Whales" — timed to moko-voice
// (48.225 s, 30 fps, TOTAL 1447). True story: Mahia Beach, NZ, March 2008 —
// a pygmy sperm whale + calf stranded between shore and sandbar; the bottlenose
// dolphin Moko led them 200 yards along the shore to a deep channel and out.
// Phrases: P1 0-120 hook | P2 139-297 stranded | P3 309-407 trapped |
// P4 425-532 rescue | P5 551-647 turned back | P6 673-812 Moko arrives |
// P7 834-948 talk | P8 971-1095 lead 200 yards | P9 1118-1276 channel/open sea |
// P10 1306-1423 officer quote | tail to 1446.
// Sections are CONTIGUOUS (pauses belong to neighbours) and cover 0->1446.
// ONE continuous bay, NO set teleports, NO dips: open sea toward -z; sandbar
// ridge along x at z~-8 with a deep CHANNEL gap at x~+34; shallows between the
// sandbar and the sandy beach (shore line z~+12, beach z>=+12). Whales strand
// in the shallows at (-6,-0.15,+2). Officer finale point at (+30, beach, +10).
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';
import * as P2 from './painters.js';

export const FPS = 30, TOTAL = 1447;
export const SHOTS = [
  { id: 'hook', a: 0, b: 138, light: 'dawn' },
  { id: 'stranded', a: 139, b: 308, light: 'dawn' },
  { id: 'trapped', a: 309, b: 424, light: 'morning' },
  { id: 'rescue', a: 425, b: 550, light: 'morning' },
  { id: 'turnback', a: 551, b: 672, light: 'morning' },
  { id: 'arrival', a: 673, b: 833, light: 'morning' },
  { id: 'talk', a: 834, b: 970, light: 'morning' },
  { id: 'lead', a: 971, b: 1117, light: 'morning' },
  { id: 'channel', a: 1118, b: 1305, light: 'morning' },
  { id: 'finale', a: 1306, b: 1446, light: 'golden' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- boards (single source of truth for main.js + the sweep gate) ----------
// mkBoard in main.js: group at pos, face centre = pos + [sin/cos offsets] with
// centre height pos.y + h/2 + 0.45 and face pushed +0.045 along its normal.
export const FINALE_BOARD = { pos: [29, 0.35, 10], w: 2.6, h: 1.5, ry: 0.12 };
export const SIGN_BOARD = { pos: [-16, 0.35, 13.5], w: 1.7, h: 0.895, ry: Math.PI - 0.1 };
// Frames where the MAHIA BEACH sign is kept fully out of frame: on exactly
// these frames a camera swing (bridge blends into rescue/talk, the arrival
// bridge, and the lead exit) drags the sign's text across the right frame
// edge. Cropped text is banned, so the sign is hidden for those frames only;
// on every other frame its text is either fully inside the frame with margin
// or fully out of view. Verified by dense projection of the text rect over
// all 1447 frames (see WEB_REPORT.md fix note).
export const SIGN_OUT_FRAMES = [[447, 447], [678, 678], [850, 850], [991, 1117]];
export const boardCorners = (B) => {
  const cy = B.pos[1] + B.h / 2 + 0.45, c = Math.cos(B.ry), s = Math.sin(B.ry);
  const cx = B.pos[0] + s * 0.045, cz = B.pos[2] + c * 0.045;
  const out = [];
  for (const [hx, hy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const lx = hx * B.w / 2;
    out.push([cx + lx * c, cy + hy * B.h / 2, cz - lx * s]);
  }
  return out;
};
export const finaleBoardCenter = () => { const cs = boardCorners(FINALE_BOARD); return [0, 1, 2].map((i) => cs.reduce((a, c) => a + c[i], 0) / 4); };

// ---------- lights: dawn -> bright morning -> golden finale (sat >= 1.04) ----------
const BASE = { sunDisc: '#fff3cf', sunSize: 0.003, aurora: 0 };
export const LIGHTS = {
  dawn: { az: 118, el: 18, sky: '#8fb6d9', ground: '#274b5a', hemi: 0.92, sun: '#ffd9a8', sunI: 1.8, fog: '#5d84a0', fogNear: 18, fogFar: 190,
    skyTop: '#39648c', skyHor: '#c8b49a', sat: 1.06, vig: 0.26, shadowExt: 26, gain: '#fff1dc', waterDeep: '#14425e', waterShal: '#2e7ea6', glint: '#cfe2f2', ...BASE },
  morning: { az: 124, el: 34, sky: '#a8d2ec', ground: '#2c4a56', hemi: 1.0, sun: '#ffeec4', sunI: 1.9, fog: '#8fb6c8', fogNear: 30, fogFar: 260,
    skyTop: '#3f7fb8', skyHor: '#dff0f8', sat: 1.07, vig: 0.21, shadowExt: 28, gain: '#fff6e2', waterDeep: '#12506e', waterShal: '#2f96b4', glint: '#d8ecff', ...BASE },
  golden: { az: 100, el: 16, sky: '#ffc98a', ground: '#4a5a5a', hemi: 0.98, sun: '#ffb45e', sunI: 2.1, fog: '#dcb28a', fogNear: 30, fogFar: 250,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sat: 1.08, vig: 0.24, shadowExt: 26, gain: '#ffedd6', waterDeep: '#175a74', waterShal: '#35a0ba', glint: '#e8ddc0', ...BASE },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => { const o = {}; for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t); return o; };
export const lightFor = (S, f) => {
  switch (S.id) {
    case 'hook': case 'stranded': return blendLight(LIGHTS.dawn, LIGHTS.morning, smooth(ramp(f, 60, 420)));
    case 'finale': return blendLight(LIGHTS.morning, LIGHTS.golden, smooth(ramp(f, 1306, 1400)));
    default: return { ...LIGHTS[S.light] };
  }
};

// ---------- animals (pure, frame-deterministic) ----------
const leapKAt = (f, a, b) => { if (f < a || f > b) return 0; const u = (f - a) / (b - a); return Math.sin(Math.PI * u); };
const speedOf = (fn, f) => { if (f <= 0) return 0; const a = fn(f), b = fn(f - 1); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * FPS; };

const motherPosRaw = (f) => kf3([
  [0, [-6, -0.15, 2]], [550, [-6, -0.15, 2]],
  [600, [-3.6, -0.15, -0.4]],           // failed push toward the sea (turnback)
  [662, [-6, -0.15, 2.3]], [970, [-6, -0.15, 2.1]],
  [1117, [28, -0.25, -2], 'lin', [[6, -0.2, 0.5], [18, -0.22, -1.2]]],
  [1200, [34, -0.3, -8], 'lin'],
  [1276, [40, -1.1, -21], 'lin'],
  [1305, [42, -2.3, -29], 'lin'], [1446, [43, -2.9, -33]],
], f);
const calfPosRaw = (f) => {
  const m = motherPosRaw(f);
  if (f < 971) return [m[0] + 1.5, m[1] + 0.06, m[2] + 0.9];       // close beside mother
  if (f < 1118) return [m[0] + 2.5, m[1] + 0.04, m[2] + 0.7];      // between mother and Moko
  return [m[0] + 2.2, m[1] + 0.05, m[2] - 1.4];                    // single file in the channel (behind = back along the SE heading)
};
const travelYaw = (rawFn, f, fallback) => {
  if (f <= 0) return fallback;
  const a = rawFn(f), b = rawFn(f - 1);
  const dx = a[0] - b[0], dz = a[2] - b[2];
  if (Math.hypot(dx, dz) < 1e-5) return fallback;
  return Math.atan2(dx, dz);
};
let _lastMotherYaw = 2.75, _lastCalfYaw = 2.75;
export const whalesAt = (f) => {
  const S = shotAt(f);
  const mp = motherPosRaw(f), cp = calfPosRaw(f);
  const moving = f >= 551 && f <= 662 || f >= 971;
  if (moving) { _lastMotherYaw = travelYaw(motherPosRaw, f, _lastMotherYaw); _lastCalfYaw = travelYaw(calfPosRaw, f, _lastCalfYaw); }
  const stranded = !(f >= 971);
  const weak = stranded ? 0.85 : 0.15;
  const dive = ramp(f, 1240, 1295);
  const mYaw = moving ? _lastMotherYaw : 2.25 + Math.sin(f * 0.01) * 0.06;
  const cYaw = moving ? _lastCalfYaw : 2.1 + Math.sin(f * 0.013 + 2) * 0.07;
  return {
    mother: { pos: mp, yaw: mYaw, pitch: -0.55 * dive + (stranded ? 0.02 * Math.sin(f * 0.05) : 0), roll: stranded ? 0.04 * Math.sin(f * 0.03) : 0, swimK: stranded ? 0.14 : 0.55, weakK: weak, speed: speedOf(motherPosRaw, f), scale: 1.10 },
    calf: { pos: cp, yaw: cYaw, pitch: -0.5 * dive, roll: stranded ? 0.05 * Math.sin(f * 0.04 + 1) : 0, swimK: stranded ? 0.2 : 0.6, weakK: weak, speed: speedOf(calfPosRaw, f), scale: 0.76 },
    count: 2,
  };
};

const mokoPosRaw = (f) => {
  if (f < 673) { const a = f * 0.004; return [52 + Math.sin(a) * 6, -0.7, -46 + Math.cos(a) * 5]; } // far out at sea, off-frame
  if (f < 834) return kf3([[673, [34, -0.3, -24]], [700, [16, -0.25, -13]], [740, [4, -0.2, -4.5]], [800, [-0.5, -0.15, -0.5]], [833, [-1.8, -0.15, 0.2]]], f);
  if (f < 971) { const a = 2.2 + (f - 834) * 0.011, r = 2.7; return [-5.9 + Math.cos(a) * r, -0.16, 1.95 + Math.sin(a) * r]; } // talk circle
  if (f < 1118) { const m = motherPosRaw(f); return [m[0] + 4.6, m[1] + 0.02, m[2] + 0.4]; }   // lead: in front (+x)
  if (f < 1240) { const m = motherPosRaw(f); return [m[0] + 4.4, m[1] + 0.05, m[2] - 1.2]; }  // channel: in front
  if (f < 1306) { const base = kf3([[1240, [41.56, -0.45, -16.04]], [1305, [41.5, -0.15, -23.5]]], f); const wk = ramp(f, 1240, 1300); return [base[0] + Math.sin(f * 0.02) * 0.8 * wk, base[1], base[2] + Math.cos(f * 0.02) * 0.6 * wk]; } // holds at the exit
  const base = kf3([[1306, [39, -0.3, -22]], [1360, [30.5, -0.25, -6.5]], [1446, [31.5, -0.3, -7.5]]], f); const a = f * 0.008; return [base[0] + Math.sin(a) * 1.2, base[1], base[2] + Math.cos(a) * 1.0]; // finale background sea
};
let _lastMokoYaw = -1.9;
export const mokoAt = (f) => {
  const pos0 = mokoPosRaw(f);
  const leapK = Math.max(leapKAt(f, 692, 738), leapKAt(f, 1348, 1408));
  const pos = [pos0[0], pos0[1] + leapK * (f >= 1306 ? 3.9 : 2.1), pos0[2]];
  const sp = speedOf(mokoPosRaw, f);
  if (sp > 0.4) _lastMokoYaw = travelYaw(mokoPosRaw, f, _lastMokoYaw);
  const S = shotAt(f);
  let yaw = _lastMokoYaw, pitch = 0, swimK = 0.55;
  if (S.id === 'talk') { const m = motherPosRaw(f); yaw = Math.atan2(m[0] - pos[0], m[2] - pos[2]); swimK = 0.3; }
  if (S.id === 'finale' || S.id === 'channel' && f >= 1240) yaw = 2.6 + Math.sin(f * 0.01) * 0.3;
  if (leapK > 0) { const u = f < 1000 ? (f - 692) / 46 : (f - 1348) / 60; pitch = lerp(0.55, -0.55, clamp(u)); swimK = 0.9; }
  if (f < 673) swimK = 0.5;
  if (S.id === 'arrival' && leapK === 0) swimK = 0.95;
  return { pos, yaw, pitch, roll: leapK * 0.35 * Math.sin(f * 0.05), swimK, leapK, speed: sp, visible: true, count: 1 };
};

// ---------- rescue boat (anchored in the shallows, gentle bob handled in main) ----------
export const boatAt = (f) => ({ pos: [-14, 0, -2], yaw: 0.9 + Math.sin(f * 0.01) * 0.02, speed: 0 });

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [-1.3, 1.5, -6.2], look: [-4.95, -0.35, 2.6], fov: 44 },
    { f: 70, pos: [-1.5, 1.42, -5.9], look: [-4.95, -0.32, 2.6], fov: 42, ease: 'surge' },
    { f: 138, pos: [-1.7, 1.38, -5.6], look: [-5.0, -0.3, 2.65], fov: 41 },
  ],
  stranded: [
    { f: 139, pos: [-6.4, 2.5, -10.2], look: [-5.0, 0.2, 3.0], fov: 46 },
    { f: 220, pos: [-6.6, 2.4, -10.0], look: [-5.1, 0.2, 2.95], fov: 45, ease: 'surge' },
    { f: 308, pos: [-6.7, 2.3, -9.7], look: [-5.2, 0.2, 2.9], fov: 45 },
  ],
  trapped: [ // the ONE wide: from the west, looking east along the bay — whales midground, sandbar + channel in line
    { f: 309, pos: [-25, 6.5, 6], look: [14, -0.5, -3], fov: 48 },
    { f: 365, pos: [-24, 6.1, 5.6], look: [14, -0.5, -3], fov: 47, ease: 'surge' },
    { f: 424, pos: [-22.5, 5.6, 5.2], look: [13, -0.4, -3], fov: 46 },
  ],
  rescue: [
    { f: 425, pos: [-0.9, 1.35, -5.8], look: [-5.6, 0, 2.4], fov: 43 },
    { f: 490, pos: [-1.1, 1.28, -5.5], look: [-5.6, 0, 2.4], fov: 42, ease: 'surge' },
    { f: 550, pos: [-1.3, 1.24, -5.2], look: [-5.65, 0, 2.5], fov: 41 },
  ],
  arrival: [
    { f: 673, pos: [-2.0, 1.6, -15.0], look: [24, 0.5, -19], fov: 46 },
    { f: 712, pos: [2.5, 1.6, -16.5], look: [13.5, 1.2, -11.5], fov: 45, ease: 'lin' },
    { f: 745, pos: [0.5, 1.5, -13.5], look: [3.8, 0.4, -4.4], fov: 44, ease: 'lin' },
    { f: 800, pos: [-3.4, 1.35, -8.6], look: [-1, 0.2, -0.5], fov: 43, ease: 'lin' },
    { f: 833, pos: [-3.9, 1.3, -7.6], look: [-3.5, 0.1, 0.6], fov: 42, ease: 'lin' },
  ],
  finale: [
    { f: 1306, pos: [26.6, 1.85, 15.8], look: [29.7, 1.25, 10.2], fov: 40 },
    { f: 1330, pos: [29, 2.1, 19.5], look: [29.3, 1.1, 4], fov: 46, ease: 'lin' },
    { f: 1380, pos: [29, 2.08, 19.4], look: [29.3, 1.1, 4], fov: 46 },
    { f: 1446, pos: [29, 2.05, 19.3], look: [29.3, 1.1, 4], fov: 45 },
  ],
};
const dynCam = (id, f) => {
  switch (id) {
    case 'turnback': { const w = whalesAt(f).mother; return { pos: [w.pos[0] + 4.4, 1.3, w.pos[2] - 5.6], look: [w.pos[0], 0, w.pos[2]], fov: 41, roll: 0 }; }
    case 'talk': { const mk = mokoAt(f), mo = whalesAt(f).mother; const mid = lerp3(mk.pos, mo.pos, 0.45); return { pos: [mid[0] + 4.8, 1.65, mid[2] - 7.0], look: [mid[0], 0, mid[2]], fov: 42, roll: 0 }; }
    case 'lead': { const mk = mokoAt(f); return { pos: [mk.pos[0] + 4.4, 1.55, mk.pos[2] - 4.6], look: [mk.pos[0] - 0.4, -0.1, mk.pos[2] + 0.3], fov: 41, roll: 0 }; }
    case 'channel': { const mk = mokoAt(f); const mo = whalesAt(f).mother; const anch = lerp3(mk.pos, mo.pos, 0.3 + 0.7 * smooth(ramp(f, 1230, 1280))); const lk = lerp3(anch, mk.pos, 0.35 * smooth(ramp(f, 1230, 1280))); return { pos: [anch[0] + 5.6, 2.2, anch[2] - 5.8], look: [lk[0], -0.2, lk[2]], fov: 42, roll: 0 }; }
    case 'finale': return camFromKeys(CAMS.finale, f);
    default: return camFromKeys(CAMS[id], f);
  }
};
export const BRIDGES = { stranded: 26, trapped: 26, rescue: 26, turnback: 26, arrival: 26, talk: 26, lead: 26, channel: 26, finale: 24 };
export const DIPS = [];
const SHADOW_AT = { hook: [-6, 0, 2], stranded: [-6, 0, 2], trapped: [0, 0, -2], rescue: [-6, 0, 2], turnback: [-5, 0, 1], arrival: [0, 0, -6], talk: [-6, 0, 2], lead: [10, 0, 0], channel: [34, 0, -10], finale: [29, 0, 10] };
export const camAt = (f) => {
  const S = shotAt(f);
  let c = dynCam(S.id, f);
  const bd = BRIDGES[S.id];
  if (bd && f - S.a < bd && S.a > 0) {
    const P = SHOTS[SHOTS.indexOf(S) - 1];
    const pc = dynCam(P.id, P.b);
    const t = smooth(ramp(f, S.a, S.a + bd));
    c = { pos: lerp3(pc.pos, c.pos, t), look: lerp3(pc.look, c.look, t), fov: lerp(pc.fov, c.fov, t), roll: lerp(pc.roll || 0, c.roll || 0, t) };
  }
  let flash = 0;
  if (f < 9) flash = -0.95 * (1 - f / 9);
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let point, cinf = 7;
  switch (S.id) {
    case 'trapped': point = whalesAt(f).mother.pos; cinf = 4; break;
    case 'arrival': point = mokoAt(f).pos; cinf = 7; break;
    case 'talk': case 'lead': case 'channel': point = mokoAt(f).pos; cinf = 6; break;
    case 'finale': point = finaleBoardCenter(); cinf = 3.5; break;
    default: point = whalesAt(f).mother.pos; cinf = 7; break;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, mistK: 0.08, bubbleK: 0.15, breathK: 0.3, finalBoardK: 1, signK: 1 };
  switch (S.id) {
    case 'hook': W.mistK = 0.9; W.breathK = 1; W.bubbleK = 0.3; break;
    case 'stranded': W.mistK = 0.65; W.breathK = 1; break;
    case 'trapped': W.mistK = 0.4; W.breathK = 0.8; break;
    case 'rescue': W.mistK = 0.22; W.breathK = 1; break;
    case 'turnback': W.mistK = 0.15; W.breathK = 1; break;
    case 'arrival': W.bubbleK = 0.45; break;
    case 'talk': W.bubbleK = 0.85; W.breathK = 0.6; break;
    case 'lead': W.bubbleK = 0.35; break;
    case 'channel': W.bubbleK = 0.3; break;
    case 'finale': W.mistK = 0.05; break;
  }
  if (SIGN_OUT_FRAMES.some(([a, b]) => f >= a && f <= b)) W.signK = 0;
  return W;
};
export const fxProfileAt = (f) => { const W = worldAt(f); return { bubbleRate: W.bubbleK * 20, splashRate: 0, spineGlow: 0 }; };

// ---------- actors (2D cards) ----------
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);
const A = (fn, o, pos, extra = {}) => ({ key: fn.name + JSON.stringify(o) + JSON.stringify(pos), draw: (p) => fn(p, o), x: pos[0], y: pos[1], z: pos[2], ground: extra.ground ?? pos[1], ...extra });
const SHALLOW_Y = -0.32, BEACH_Y = 0.35;
const CROWD = [[-1.5, 14.6, 51, 0], [1.8, 15.2, 52, 1], [4.6, 14.4, 53, 2], [-4.6, 15.0, 54, 1]];
const crowd = (f, out, tint, cheer = false) => {
  for (const [x, z, seed, alt] of CROWD) out.push(A(P2.localFront, { seed, alt, expr: cheer ? 'grin' : 'neutral', L: 'hang', R: cheer ? 'wave' : 'hang', wv: q(f * 0.3, 1), blink: blinkAt(f, seed), bob: q(breath(f, seed), 3) }, [x, BEACH_Y, z], { tint, s: 0.92 }));
};
export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = f < 425 ? '#dfe9f2' : '#ffffff';
  switch (S.id) {
    case 'hook': {
      out.push(A(P2.rescuerFront, { seed: 31, expr: 'nervous', L: 'hang', R: 'point', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-10.2, SHALLOW_Y, 5.6], { tint, s: 1.0 }));
      crowd(f, out, tint); break;
    }
    case 'stranded': {
      out.push(A(P2.rescuerFront, { seed: 31, expr: 'nervous', L: 'hang', R: 'point', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-8.8, SHALLOW_Y, 4.6], { tint, s: 1.0 }));
      out.push(A(P2.rescuerFront, { seed: 17, alt: true, expr: 'stern', L: 'belly', R: 'hang', blink: blinkAt(f, 17), bob: q(breath(f, 17), 3) }, [-3.2, SHALLOW_Y, 5.6], { tint, s: 0.97 }));
      crowd(f, out, tint); break;
    }
    case 'trapped': crowd(f, out, tint); break;
    case 'rescue': {
      const push = Math.sin(Math.PI * ramp(f, 425, 550));
      out.push(A(P2.rescuerFront, { seed: 31, expr: 'stern', L: 'reach', R: 'reach', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3), tilt: q(4 + 3 * push, 1) }, [-9.2, SHALLOW_Y, 5.2], { tint, s: 1.0 }));
      out.push(A(P2.rescuerFront, { seed: 17, alt: true, expr: f > 500 ? 'nervous' : 'stern', L: 'reach', R: 'belly', blink: blinkAt(f, 17), bob: q(breath(f, 17), 3), tilt: q(3 + 3 * push, 1) }, [-7.9, SHALLOW_Y, 6.4], { tint, s: 0.97 }));
      crowd(f, out, tint); break;
    }
    case 'turnback': {
      out.push(A(P2.rescuerFront, { seed: 31, expr: f > 610 ? 'shock' : 'stern', L: 'hang', R: 'point', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-9.9, SHALLOW_Y, 4.8], { tint, s: 1.0 }));
      out.push(A(P2.rescuerFront, { seed: 17, alt: true, expr: f > 610 ? 'pained' : 'nervous', L: 'belly', R: 'hang', blink: blinkAt(f, 17), bob: q(breath(f, 17), 3) }, [-2.8, SHALLOW_Y, 5.9], { tint, s: 0.97 }));
      crowd(f, out, tint); break;
    }
    case 'arrival': crowd(f, out, tint); break;
    case 'talk': {
      out.push(A(P2.rescuerFront, { seed: 31, expr: 'grin', L: 'hang', R: 'point', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-8.6, SHALLOW_Y, 6.8], { tint, s: 1.0 }));
      out.push(A(P2.rescuerFront, { seed: 17, alt: true, expr: 'smile', L: 'belly', R: 'hang', blink: blinkAt(f, 17), bob: q(breath(f, 17), 3) }, [-3.4, SHALLOW_Y, 7.4], { tint, s: 0.97 }));
      crowd(f, out, tint, true); break;
    }
    case 'lead': case 'channel': crowd(f, out, tint, true); break;
    case 'finale': {
      out.push(A(P2.officerFront, { seed: 41, expr: f < 1362 ? 'stern' : 'relief', L: 'hang', R: f < 1345 ? 'point' : 'hang', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3), headTilt: f < 1362 ? -2 : 2 }, [30.4, BEACH_Y, 10.3], { tint: '#ffedcb', s: 1.05 }));
      out.push(A(P2.localFront, { seed: 51, expr: 'grin', L: 'hang', R: 'wave', wv: q(f * 0.3, 1), blink: blinkAt(f, 51), bob: q(breath(f, 51), 3) }, [26.2, BEACH_Y, 12.6], { tint: '#ffedcb', s: 0.92 }));
      out.push(A(P2.localFront, { seed: 52, alt: 1, expr: 'laugh', L: 'up', R: 'hang', blink: blinkAt(f, 52), bob: q(breath(f, 52), 3) }, [33.2, BEACH_Y, 13.0], { tint: '#ffedcb', s: 0.9 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const out = [];
  for (const [a, b] of [[706, 734], [1368, 1396]]) {
    if (f >= a && f <= b) {
      const mk = mokoAt(f), t = q((f - a) / (b - a), 2);
      out.push(FXC('burst_' + a + '_' + t, (p) => T.fxBurst(p, t, '#ffe9a8', 10, 30, 210), [mk.pos[0], mk.pos[1] + 1.0, mk.pos[2]], 0.8));
    }
  }
  return out;
};
