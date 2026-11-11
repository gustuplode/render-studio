// Shot plan for "Kabang — The Dog Who Saved Two Girls" — timed to kabang-voice
// (50.650 s, 30 fps, TOTAL 1520). True story: Zamboanga City, Dec 2011 — Kabang
// leapt in front of a speeding motorcycle to save Dina (11) and her cousin (3).
// She survived, bandaged, healed with a shorter muzzle; the world donated; UC
// Davis treated her; June 2013 she flew home to a hero's welcome.
// Phrases: P1 0-128 | P2 160-326 | P3 361-539 | P4 568-750 | P5 775-910 |
// P6 939-1049 | P7 1080-1210 | P8 1244-1357 | P9 1399-1498 (+tail).
// SHOTS are CONTIGUOUS 0..1519: inter-phrase gaps belong to the outgoing
// section (its tail holds / blends forward). NO gaps, NO fall-through.
// TASTE LAW: the injury is never shown. After the crash Kabang is BANDAGED
// (clean white wrap); from the flight home she is healed with a SHORTER muzzle.
// Sets (main.js): Zamboanga street (0,0,0) — road along X at z=0, houses north
// z=-7, market stalls south z=+6, Kabang's porch at (-4,0,-4.2), the crossing
// at x~=1.5; UC Davis clinic (44,0,-26); the sky above the street for flights.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30, TOTAL = 1520, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 159, light: 'gold' },
  { id: 'intro', a: 160, b: 360, light: 'gold' },
  { id: 'crossing', a: 361, b: 567, light: 'day' },
  { id: 'crash', a: 568, b: 774, light: 'day' },
  { id: 'saved', a: 775, b: 938, light: 'gold' },
  { id: 'hero', a: 939, b: 1079, light: 'gold' },
  { id: 'davis', a: 1080, b: 1243, light: 'clinic' },
  { id: 'flight', a: 1244, b: 1398, light: 'sky' },
  { id: 'finale', a: 1399, b: 1519, light: 'gold' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;
M.linear = (t) => clamp(t); // tracking moves: constant speed keeps per-frame delta under the sweep bound

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  gold: { az: 118, el: 30, sky: '#c8a06a', ground: '#6a5238', hemi: 1.12, sun: '#ffc37e', sunI: 2.25, fog: '#dec49c', fogNear: 42, fogFar: 320,
    skyTop: '#6f8fc4', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0032, sat: 1.07, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  day: { az: 128, el: 40, sky: '#aebfe0', ground: '#5a6a52', hemi: 1.18, sun: '#fff1d6', sunI: 2.05, fog: '#cfd6c2', fogNear: 48, fogFar: 360,
    skyTop: '#5f97cc', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.04, vig: 0.2, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  clinic: { az: 135, el: 38, sky: '#b8cce4', ground: '#5c6a58', hemi: 1.2, sun: '#fff4dc', sunI: 2.0, fog: '#ccd8ce', fogNear: 46, fogFar: 340,
    skyTop: '#6f97cc', skyHor: '#e8f0e2', sunDisc: '#fff6da', sunSize: 0.003, sat: 1.02, vig: 0.2, shadowExt: 16, aurora: 0, gain: '#ffffff', ...WATER },
  sky: { az: 120, el: 46, sky: '#bcd2ea', ground: '#7a7a6a', hemi: 1.24, sun: '#fff3da', sunI: 2.2, fog: '#d8e4ee', fogNear: 55, fogFar: 420,
    skyTop: '#4f83c4', skyHor: '#eaf2fa', sunDisc: '#fff6da', sunSize: 0.0034, sat: 1.05, vig: 0.18, shadowExt: 20, aurora: 0, gain: '#ffffff', ...WATER },
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
  if (S.id === 'flight') return blendLight(LIGHTS.sky, LIGHTS.gold, smooth(ramp(f, 1330, 1398)));
  if (S.id === 'finale') return blendLight(LIGHTS.gold, LIGHTS.day, smooth(ramp(f, 1460, 1519)) * 0.4);
  return { ...LIGHTS[S.light] };
};

// ---------- shared staging ----------
export const HOME = [-4, 0, -4.2];
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

/** Kabang's muzzle state per frame — the taste law, locked to the phrases. */
export const muzzleAt = (f) => f < 775 ? 'normal' : f < 1244 ? 'bandaged' : 'short';

/** Kabang's card position per frame (sweep + dust emitter + dof reference). */
export const kabangPosAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'hook': return f < 72 ? kf3([[0, [0.1, 0.42, 0.3]], [36, [0.65, 0.55, 0.35], 'easeOut'], [72, [1.15, 0, 0.5], 'easeIn']], f) : [1.15, 0, 0.5];
    case 'intro': return [...HOME];
    case 'crossing': return kf3([[361, [-1.2, 0, 2.9]], [470, [-0.1, 0, 0.4], 'linear'], [540, [0.55, 0, -2.1], 'linear'], [567, [0.6, 0, -2.2]]], f);
    case 'crash': {
      if (f < 636) return [0.6, 0, -2.2];
      if (f < 706) return kf3([[636, [0.6, 0, -2.2]], [686, [0.55, 0.3, -1.0], 'easeIn'], [706, [0.45, 0, -0.15], 'easeIn']], f);
      return [0.55, 0, 0.55];
    }
    case 'saved': return [0.55, 0, 0.6];
    case 'hero': return [0, 0, 0.6];
    case 'davis': return [44, 0, -24.4];
    case 'flight': { const pp = planeAt(f); return pp ? [pp.x, pp.y - 1, pp.z] : [0, 7, -14]; }
    case 'finale': return [0, 0, 1.2];
    default: return [0, 0, 0];
  }
};
export const heroPosAt = kabangPosAt;

/** The motorcycle prop (main.js), built facing +X. ry yaws it; fall = sideways lean after the stop. */
export const bikeAt = (f) => {
  const S = shotAt(f);
  if (S.id === 'hook') return { x: -1.9, y: 0, z: -0.7, ry: 0.4, fall: 0 };
  if (S.id === 'crash') {
    if (f < 700) { const p = kf3([[568, [-13.5, 0, -0.4]], [700, [0.1, 0, -0.1], 'easeIn']], f); return { x: p[0], y: 0, z: p[2], ry: 0, fall: 0 }; }
    if (f < 724) { const p = kf3([[700, [0.1, 0, -0.1]], [724, [1.5, 0, 0.35], 'easeOut']], f); return { x: p[0], y: 0, z: p[2], ry: -0.22 * ramp(f, 700, 724), fall: 0.48 * ramp(f, 706, 724) }; }
    return { x: 1.5, y: 0, z: 0.35, ry: -0.22, fall: 0.48 };
  }
  if (S.id === 'saved') return { x: 1.5, y: 0, z: 0.35, ry: -0.22, fall: 0.48 };
  return null;
};
/** The airplane prop (main.js) — only the flight home beat flies it low over the street. */
export const planeAt = (f) => {
  const S = shotAt(f);
  if (S.id !== 'flight') return null;
  const p = kf3([[1244, [-17, 8.6, -15]], [1320, [0, 8.0, -14], 'linear'], [1398, [15, 7.3, -13], 'linear']], f);
  return { x: p[0], y: p[1], z: p[2], ry: 0 };
};

// ---------- cameras (continuous; shared keys at same-set boundaries; dips only
// for the two true location changes: street->clinic, clinic->sky) ----------
const CAMS = {
  hook: [
    { f: 0, pos: [4.6, 1.75, 6.8], look: [0.1, 0.9, 0], fov: 48 },
    { f: 36, pos: [3.6, 1.5, 5.2], look: [0.5, 0.88, 0.3], fov: 42, ease: 'surge' },
    { f: 72, pos: [3.2, 1.42, 5.0], look: [0.7, 0.85, 0.3], fov: 41, ease: 'surge' },
    { f: 128, pos: [2.9, 1.38, 5.0], look: [0.9, 0.8, 0.4], fov: 41, ease: 'surge' },
    { f: 159, pos: [0.7, 1.6, 3.9], look: [-2.4, 0.9, -3.4], fov: 42, ease: 'surge' },
  ],
  intro: [
    { f: 160, pos: [0.7, 1.6, 3.9], look: [-2.4, 0.9, -3.4], fov: 42 },
    { f: 260, pos: [0.2, 1.6, 4.2], look: [-3.7, 0.92, -4.3], fov: 44, ease: 'surge' },
    { f: 326, pos: [-0.5, 1.5, 3.2], look: [-3.9, 0.9, -4.3], fov: 41, ease: 'surge' },
    { f: 360, pos: [-1.3, 1.45, 2.4], look: [-2.6, 0.85, -1.2], fov: 40, ease: 'surge' },
  ],
  crossing: [
    { f: 361, pos: [-1.3, 1.45, 2.4], look: [-2.6, 0.85, -1.2], fov: 40 },
    { f: 460, pos: [3.4, 1.55, 5.6], look: [0.85, 0.8, 0.6], fov: 41, ease: 'surge' },
    { f: 539, pos: [4.4, 1.5, 4.6], look: [1.2, 0.8, -1.6], fov: 40, ease: 'surge' },
    { f: 567, pos: [5.2, 1.7, 5.2], look: [0.7, 0.85, -1.2], fov: 42, ease: 'surge' },
  ],
  crash: [
    { f: 568, pos: [5.2, 1.7, 5.2], look: [0.7, 0.85, -1.2], fov: 42 },
    { f: 650, pos: [4.9, 1.6, 5.1], look: [0.9, 0.8, -1.4], fov: 43, ease: 'linear' },
    { f: 706, pos: [3.6, 1.35, 4.4], look: [0.45, 0.75, -0.2], fov: 41, ease: 'linear' },
    { f: 750, pos: [3.0, 1.3, 4.3], look: [0.55, 0.75, 0.3], fov: 40, ease: 'surge' },
    { f: 774, pos: [2.8, 1.3, 4.4], look: [0.55, 0.78, 0.5], fov: 39, ease: 'surge' },
  ],
  saved: [
    { f: 775, pos: [2.8, 1.3, 4.4], look: [0.55, 0.78, 0.5], fov: 39 },
    { f: 860, pos: [2.4, 1.22, 3.9], look: [0.5, 0.8, 0.55], fov: 38, ease: 'surge' },
    { f: 910, pos: [2.15, 1.18, 3.6], look: [0.5, 0.82, 0.6], fov: 37.5, ease: 'surge' },
    { f: 938, pos: [2.3, 1.25, 3.9], look: [0.2, 0.85, 0.4], fov: 38.5, ease: 'surge' },
  ],
  hero: [
    { f: 939, pos: [2.3, 1.25, 3.9], look: [0.2, 0.85, 0.4], fov: 38.5 },
    { f: 1010, pos: [1.4, 1.45, 5.0], look: [0.1, 0.9, 0.3], fov: 40, ease: 'surge' },
    { f: 1049, pos: [0.6, 1.5, 5.6], look: [0.2, 0.95, 0.2], fov: 41, ease: 'surge' },
    { f: 1079, pos: [0.4, 1.52, 5.8], look: [0.2, 0.95, 0.2], fov: 41.5, ease: 'surge' },
  ],
  davis: [
    { f: 1080, pos: [38.6, 1.8, -17.6], look: [43.6, 1.0, -24.6], fov: 43 },
    { f: 1160, pos: [40.6, 1.6, -19.4], look: [43.9, 0.95, -24.5], fov: 41, ease: 'surge' },
    { f: 1210, pos: [41.6, 1.5, -20.4], look: [44.0, 0.92, -24.4], fov: 39.5, ease: 'surge' },
    { f: 1243, pos: [41.9, 1.48, -20.8], look: [44.0, 0.92, -24.4], fov: 39, ease: 'surge' },
  ],
  flight: [
    { f: 1244, pos: [3.2, 1.3, 6.4], look: [-13, 7.6, -14], fov: 44 },
    { f: 1320, pos: [2.6, 1.35, 6.2], look: [0, 7.2, -13.6], fov: 42, ease: 'linear' },
    { f: 1357, pos: [2.2, 1.4, 6.4], look: [9, 6.6, -13], fov: 42, ease: 'linear' },
    { f: 1378, pos: [2.05, 1.45, 6.9], look: [5.8, 4.4, -7.8], fov: 41.5, ease: 'linear' },
    { f: 1398, pos: [1.9, 1.5, 7.4], look: [0.4, 1.2, 0.9], fov: 41, ease: 'linear' },
  ],
  finale: [
    { f: 1399, pos: [1.9, 1.5, 7.4], look: [0.4, 1.2, 0.9], fov: 41 },
    { f: 1460, pos: [1.5, 1.55, 8.2], look: [0.38, 1.25, 0.35], fov: 42, ease: 'surge' },
    { f: 1498, pos: [0.9, 1.8, 9.4], look: [0.1, 1.35, -0.6], fov: 43.5, ease: 'surge' },
    { f: 1519, pos: [0.7, 1.9, 9.9], look: [0.1, 1.4, -0.9], fov: 44, ease: 'surge' },
  ],
};
const SHADOW_AT = { hook: [0.4, 0.7, 0.2], intro: [-3.8, 0.7, -4.2], crossing: [0.8, 0.7, -0.6], crash: [0.4, 0.7, -0.4], saved: [0.5, 0.7, 0.5], hero: [0.1, 0.7, 0.4], davis: [44, 0.7, -24.6], flight: [0, 1, 0], finale: [0.1, 0.9, 0.2] };
const DIPS = [1080, 1244];
const shotCam = (id, f) => camFromKeys(CAMS[id], f);
export const camAt = (f) => {
  const S = shotAt(f);
  let c = shotCam(S.id, f);
  // the crash impact: a short camera kick at the contact frame, then it settles
  if (S.id === 'crash') {
    const d = f - 706;
    if (d >= 0 && d < 7) {
      const s = (d % 2 ? -1 : 1) * 0.014 * (1 - d / 7);
      c = { ...c, look: [c.look[0], c.look[1] + s * 3, c.look[2] + s * 2], roll: (c.roll || 0) + s * 22 };
    }
  }
  let flash = 0;
  for (const B of DIPS) { const d = f - B; if (d >= -3 && d <= 3) flash = Math.min(flash, -0.95 * Math.cos(d / 3 * Math.PI / 2)); }
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let point, cinf;
  switch (S.id) {
    case 'hook': point = [0.7, 0.85, 0.35]; cinf = 9; break;
    case 'intro': point = [-3.9, 0.9, -4.2]; cinf = 9; break;
    case 'crossing': point = [0.9, 0.8, -0.6]; cinf = 9; break;
    case 'crash': point = [0.4, 0.75, -0.5]; cinf = 8; break;
    case 'saved': point = [0.55, 0.85, 0.6]; cinf = 8; break;
    case 'hero': point = [0.1, 0.9, 0.5]; cinf = 8; break;
    case 'davis': point = [44, 0.92, -24.4]; cinf = 8; break;
    case 'flight': { const pp = planeAt(f); point = pp ? [pp.x, pp.y, pp.z] : [0, 7, -14]; cinf = 5; break; }
    case 'finale': point = [0.1, 1.1, 0.4]; cinf = 7; break;
    default: point = [0, 1, 0]; cinf = 0;
  }
  return { focus: dist(C.pos, point), cinf };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { shot: S.id, mist: 0.1, windK: 0.4, winGlow: 0.55, cloudK: 0.35, boardT: 0, introT: 0, crashK: 0, glintK: 0.3 };
  switch (S.id) {
    case 'hook': W.winGlow = 0.8; W.glintK = 0.7; W.mist = 0.06; break;
    // intro board lives ONLY in its own beat (finale-board pattern): it grows
    // from its base on the push-in (160–210, scale exactly 1 well before the
    // verified f240 framing) and shrinks away as the camera leaves it for the
    // porch portrait (280–340), so its text is never seen cropped as scenery
    // in any other beat — and never partial inside its own.
    case 'intro': W.winGlow = 0.85; W.mist = 0.05; W.introT = smooth(ramp(f, 160, 210)) * (1 - smooth(ramp(f, 280, 340))); break;
    case 'crossing': W.windK = 0.5; W.mist = 0.08; break;
    case 'crash': W.crashK = f >= 700 && f <= 760 ? 1 - ramp(f, 730, 760) : 0; W.mist = 0.1; break;
    case 'saved': W.winGlow = 0.7; W.mist = 0.06; break;
    case 'hero': W.winGlow = 0.8; W.glintK = 0.9; W.windK = 0.6; break;
    case 'davis': W.cloudK = 0.25; W.mist = 0.03; break;
    case 'flight': W.cloudK = 1; W.windK = 1.2; W.mist = 0; break;
    case 'finale': W.boardT = smooth(ramp(f, 1408, 1452)); W.winGlow = 0.9; W.glintK = 0.8; W.windK = 0.7; W.cloudK = 0.3; break;
  }
  return W;
};
export const fxProfileAt = (f) => {
  const S = shotAt(f);
  switch (S.id) {
    case 'crash': return { smokeRate: f >= 700 && f <= 745 ? 9 : 1.6, dustRate: f < 700 ? 0.35 : 0.9 };
    case 'crossing': return { smokeRate: 1.4, dustRate: 0.4 };
    case 'hero': case 'finale': return { smokeRate: 1.2, dustRate: 0.35 };
    case 'flight': return { smokeRate: 0, dustRate: 0 };
    default: return { smokeRate: 1.2, dustRate: 0.25 };
  }
};

// ---------- actors ----------
const TINT = { gold: '#ffe9c4', day: '#ffffff', clinic: '#ffffff', sky: '#eaf2ff' };
const tintFor = (S, f) => S.id === 'flight' ? TINT.gold : S.id === 'finale' ? TINT.gold : (TINT[S.light] || '#ffffff');
const RK = (T, o, pos, extra = {}) => ({ key: 'kab' + JSON.stringify(o), draw: (p) => T.kabangCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const RH = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => (who === 'dina' ? T.dinaCard(p, o) : who === 'cousin' ? T.cousinCard(p, o) : who === 'father' ? T.fatherCard(p, o) : who === 'rider' ? T.riderCard(p, o) : who === 'vet' ? T.vetCard(p, o) : who === 'nurse' ? T.nurseCard(p, o) : T.crowdCard(p, o)), x: pos[0], y: pos[1], z: pos[2], ground: 0, ...extra });
const crowdRow = (T, tint, f, xs, z, baseSeed) => xs.map((x, i) => RH(T, 'crowd', { variant: (baseSeed + i) % 6, expr: f % 90 < 45 ? 'laugh' : 'grin', L: 'wave', R: 'up', wv: q(f * 0.4 + i, 1), blink: blinkAt(f, 11 + i * 7), bob: q(breath(f, 11 + i * 7), 3) }, [x, 0, z + (i % 2) * 0.35], { tint, s: 0.92 + (i % 3) * 0.04, yaw: (i % 2 ? -0.14 : 0.14) }));

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S, f);
  const kp = kabangPosAt(f), mz = muzzleAt(f);
  switch (S.id) {
    case 'hook': {
      if (f < 72) { // frame 1 energy: Kabang BIG, mid-leap toward the bike, girls behind her
        out.push(RK(T, { view: 'side', muzzle: 'normal', step: q((f * 0.06) % 1, 2), pant: 1, mood: 'happy' }, [kp[0], kp[1], kp[2]], { tint, s: 1.02, blob: false }));
      } else {
        out.push(RK(T, { view: 'front', muzzle: 'normal', step: q((f * 0.03) % 1, 2), pant: 1, mood: 'happy' }, kp, { tint, s: 1.02 }));
      }
      out.push(RH(T, 'dina', { expr: 'shock', L: 'up', R: 'up', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3) }, [1.15, 0, -1.3], { tint, s: 0.72, yaw: -0.3 }));
      out.push(RH(T, 'cousin', { expr: 'shock', L: 'up', R: 'belly', blink: blinkAt(f, 27), bob: q(breath(f, 27), 3) }, [1.6, 0, -1.0], { tint, s: 0.5, yaw: -0.35 }));
      out.push(RH(T, 'rider', { expr: 'stern', L: 'belly', R: 'belly', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3) }, [-2.6, 0, -1.6], { tint, s: 0.95, yaw: 0.7 }));
      break;
    }
    case 'intro': {
      out.push(RK(T, { view: 'front', muzzle: 'normal', pant: 0, mood: 'happy' }, kp, { tint, s: 0.98 }));
      out.push(RH(T, 'father', { expr: 'smile', L: 'hang', R: 'belly', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-4.95, 0, -3.75], { tint, s: 0.98, yaw: 0.4 }));
      out.push(RH(T, 'dina', { expr: 'grin', L: 'belly', R: 'wave', wv: q(f * 0.35, 1), blink: blinkAt(f, 23), bob: q(breath(f, 23), 3) }, [-2.7, 0, -3.6], { tint, s: 0.72, yaw: -0.35 }));
      break;
    }
    case 'crossing': {
      const gp = kf3([[361, [1.1, 0, 3.3]], [470, [1.35, 0, 0.5], 'linear'], [540, [1.6, 0, -2.5], 'linear'], [567, [1.6, 0, -2.6]]], f);
      const walking = f < 540;
      out.push(RK(T, { view: 'side', muzzle: 'normal', step: q(walking ? (f * 0.055) % 1 : 0, 2), pant: 0, mood: 'happy' }, [kp[0], walking ? Math.abs(Math.sin(f * 0.5)) * 0.02 : 0, kp[2]], { tint, s: 0.92, yaw: 0.15 }));
      out.push(RH(T, 'dina', { expr: 'smile', L: 'hang', R: 'belly', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3), step: q(walking ? (f * 0.06) % 1 : 0, 2) }, gp, { tint, s: 0.72, yaw: -0.2 }));
      out.push(RH(T, 'cousin', { expr: 'grin', L: 'belly', R: 'hang', blink: blinkAt(f, 27), bob: q(breath(f, 27), 3), step: q(walking ? (f * 0.08) % 1 : 0, 2) }, [gp[0] + 0.62, 0, gp[2] + 0.3], { tint, s: 0.5, yaw: -0.25 }));
      break;
    }
    case 'crash': {
      const airborne = f >= 660 && f < 706;
      const leaping = f >= 636 && f < 706;
      if (f < 636) out.push(RK(T, { view: 'side', muzzle: 'normal', step: 0, mood: 'happy', headDown: 0.2 }, kp, { tint, s: 0.92, yaw: 0.15 }));
      else if (leaping) out.push(RK(T, { view: 'side', muzzle: 'normal', step: q((f * 0.09) % 1, 2), pant: 1, mood: 'happy' }, [kp[0], kp[1], kp[2]], { tint, s: 0.98, blob: airborne ? false : undefined }));
      else out.push(RK(T, { view: 'front', muzzle: 'normal', mood: 'worried', pant: 1 }, kp, { tint, s: 0.95 }));
      out.push(RH(T, 'dina', { expr: f < 700 ? 'nervous' : 'shock', L: 'up', R: 'up', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3) }, [1.7, 0, -2.5], { tint, s: 0.72, yaw: -0.2 }));
      out.push(RH(T, 'cousin', { expr: f < 700 ? 'nervous' : 'shock', L: 'belly', R: 'up', blink: blinkAt(f, 27), bob: q(breath(f, 27), 3) }, [2.35, 0, -2.2], { tint, s: 0.5, yaw: -0.25 }));
      if (f >= 568 && f < 706) { const bk = bikeAt(f); out.push(RH(T, 'rider', { expr: 'stern', L: 'belly', R: 'belly', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3) }, [bk.x - 0.05, 0.02, bk.z - 0.05], { tint, s: 0.95, yaw: 0.55, blob: false })); }
      if (f >= 706) out.push(RH(T, 'rider', { expr: 'dazed', L: 'hang', R: 'up', blink: blinkAt(f, 41), bob: q(breath(f, 41), 3), headTilt: 6 }, [2.45, 0, 1.15], { tint, s: 0.95, yaw: -0.5 }));
      break;
    }
    case 'saved': {
      // tasteful: Kabang bandaged and resting, girls safe in their father's arms' reach
      out.push(RK(T, { view: 'front', muzzle: mz, mood: f < 860 ? 'worried' : 'calm', pant: 0, step: q((f * 0.012) % 1, 2) }, kp, { tint, s: 1.06 }));
      out.push(RH(T, 'father', { expr: 'relief', L: 'belly', R: 'belly', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-1.7, 0, -1.1], { tint, s: 0.98, yaw: 0.45 }));
      out.push(RH(T, 'dina', { expr: 'relief', L: 'belly', R: 'hang', blink: blinkAt(f, 23), bob: q(breath(f, 23), 3) }, [-0.95, 0, -0.7], { tint, s: 0.72, yaw: 0.3 }));
      out.push(RH(T, 'cousin', { expr: 'smile', L: 'hang', R: 'wave', wv: q(f * 0.3, 1), blink: blinkAt(f, 27), bob: q(breath(f, 27), 3) }, [-2.35, 0, -0.6], { tint, s: 0.5, yaw: 0.5 }));
      break;
    }
    case 'hero': {
      out.push(RK(T, { view: 'front', muzzle: mz, mood: 'happy', pant: 1, step: q((f * 0.02) % 1, 2) }, kp, { tint, s: 1.06 }));
      out.push(RH(T, 'dina', { expr: 'laugh', L: 'up', R: 'wave', wv: q(f * 0.4, 1), blink: blinkAt(f, 23), bob: q(breath(f, 23), 3) }, [-0.8, 0, 0.15], { tint, s: 0.72, yaw: 0.3 }));
      out.push(RH(T, 'father', { expr: 'grin', L: 'belly', R: 'point', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [0.85, 0, 0.1], { tint, s: 0.98, yaw: -0.4 }));
      out.push(...crowdRow(T, tint, f, [-1.35, 1.45], -2.2, 1));
      out.push(...crowdRow(T, tint, f, [-2.0, 2.1], -3.4, 4));
      break;
    }
    case 'davis': {
      out.push(RK(T, { view: 'front', muzzle: mz, mood: f < 1160 ? 'worried' : 'calm', pant: 0 }, kp, { tint, s: 1.02 }));
      out.push(RH(T, 'vet', { expr: 'smile', L: 'belly', R: 'point', blink: blinkAt(f, 8), bob: q(breath(f, 8), 3) }, [43.15, 0, -25.0], { tint, s: 1.0, yaw: 0.45 }));
      out.push(RH(T, 'nurse', { expr: 'smile', L: 'hang', R: 'belly', blink: blinkAt(f, 18), bob: q(breath(f, 18), 3) }, [45.2, 0, -24.9], { tint, s: 0.96, yaw: -0.45 }));
      break;
    }
    case 'flight': {
      // the town watches her come home: family small below, waving up at the plane
      if (f >= 1330) {
        out.push(RH(T, 'dina', { expr: 'laugh', L: 'up', R: 'wave', wv: q(f * 0.45, 1), blink: blinkAt(f, 23), bob: q(breath(f, 23), 3) }, [-1.6, 0, 2.2], { tint, s: 0.72, yaw: 0.2 }));
        out.push(RH(T, 'father', { expr: 'grin', L: 'wave', R: 'up', wv: q(f * 0.4, 1), blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-2.5, 0, 1.8], { tint, s: 0.98, yaw: 0.3 }));
        out.push(RH(T, 'cousin', { expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 27), bob: q(breath(f, 27), 3) }, [-0.8, 0, 2.5], { tint, s: 0.5, yaw: 0.1 }));
      }
      break;
    }
    case 'finale': {
      out.push(RK(T, { view: 'front', muzzle: 'short', mood: 'happy', pant: 1, step: q((f * 0.025) % 1, 2) }, kp, { tint, s: 1.12 }));
      out.push(RH(T, 'dina', { expr: 'laugh', L: 'wave', R: 'up', wv: q(f * 0.45, 1), blink: blinkAt(f, 23), bob: q(breath(f, 23), 3) }, [-1.45, 0, 0.55], { tint, s: 0.72, yaw: 0.3 }));
      out.push(RH(T, 'cousin', { expr: 'laugh', L: 'up', R: 'wave', wv: q(f * 0.5, 1), blink: blinkAt(f, 27), bob: q(breath(f, 27), 3) }, [1.35, 0, 0.65], { tint, s: 0.5, yaw: -0.3 }));
      out.push(RH(T, 'father', { expr: 'laugh', L: 'up', R: 'up', blink: blinkAt(f, 31), bob: q(breath(f, 31), 3) }, [-2.5, 0, -0.1], { tint, s: 0.98, yaw: 0.45 }));
      out.push(...crowdRow(T, tint, f, [-3.6, -2.9, 2.9, 3.6], -2.1, 3));
      out.push(...crowdRow(T, tint, f + 30, [-1.9, 2.0], -2.6, 5));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (cards) ----------
const FXC = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'crash' && f >= 700 && f <= 742) { // one soft dust puff at the contact — brief and tasteful
    const t = q((f - 700) / 42, 2);
    out.push(FXC('cpuff_' + t, (p) => T.fxDust(p, t, '#e8dcc4'), [0.45, 0.12, 0.1], 0.85));
  }
  if (S.id === 'finale' && f >= 1445) { // petals / paper bits drifting down over the homecoming
    for (let i = 0; i < 3; i++) {
      const ph = q(((f + i * 41) % 100) / 100, 2);
      out.push(FXC('petal_' + i + '_' + ph, (p) => T.fxLeaf(p, ['#e86e78', '#f2b234', '#f6f3ec'][i]), [-1.8 + i * 1.7, 2.5 - ph * 2.1, -0.6 - i * 0.5], 0.24));
    }
  }
  return out;
};
