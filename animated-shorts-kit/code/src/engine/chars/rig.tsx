// Cut-out character RIG + frame-driven animation library (deterministic: everything is a pure function of the frame).
// Hierarchy:  root(yaw to camera, flip, squash) > hips(ground-solved) > legs(thigh>shin>foot)
//                                               > torso(lean/tilt) > body, arms(upper>fore>hand>prop), neck>head>face/hat
// Limbs use an ink layer + fill layer per segment (all inks below all fills) so joints read as one continuous stroke.
import React from 'react';
import * as THREE from 'three';
import {CART_K, SK, LOOKS, FACE, Who, View, Expr, Vis, HandK, EXPR, PartTex, InkFill, limbTex, handTex, footTex, bodyTex, headTex, hatTex, eyesTex, browsTex, mouthTex, accTex, cheekTex, basketTex, sweatTex} from './charparts';
import {WORDS_REAL, realOf} from '../core/clock';

type V3 = [number, number, number];
export type ActName = 'idle' | 'walk' | 'talk' | 'push' | 'point' | 'cross' | 'flex' | 'shrug' | 'slump' | 'bounce' | 'cheer' | 'tired' | 'tiredWalk'
  | 'wink' | 'lookSide' | 'think' | 'present' | 'proud' | 'eureka' | 'pull' | 'wave';
export type PersonP = {
  who: Who; p: V3; act?: ActName; expr?: Expr;
  from?: {act: ActName; expr?: Expr}; k?: number;     // cross-fade from a previous action (k: 0 = from, 1 = act)
  lf?: number;                                         // frames since `act` started (pop-in gestures)
  talk?: boolean; view?: View | 'auto'; dir?: 1 | -1; look?: number; turn?: number; pace?: number; seed?: number;
  basket?: boolean; sweat?: boolean; pointUp?: boolean;
  /** seated on a chair (front: thighs foreshortened; side: thighs forward), hip at ~0.5 m */
  sit?: boolean;
  /** background extra (culled far from camera) / sitting inside a car (checker: exempt from person-car overlap) */
  bg?: boolean; inCar?: boolean;
  /** cart held with both hands: world cart centre p, yaw ry (handle at local x=-0.3), scale sc, id = index in carts[], k = grip weight 0..1 */
  hold?: {p: V3; ry: number; sc?: number; id?: number; k?: number};
  /** FACES: gaze target - a world point (scene partner's position / prop) or 'cam' (addressing the viewer). Drives pupils, a 3/4 face
   *  turn (features slide 10-20 % HW toward it) and a head roll. Explicit `look` / `turn` still win. */
  gaze?: V3 | 'cam';
  /** HOOK PASS: emotion intensity 0..1 (default 0 = the film's normal register). Scales the face
   *  amplitudes that otherwise stay subtle: cheek swell (past the old 1.0 cap, to 1.8), brow travel
   *  (direction follows the expression's brow kind) and jaw drop. For hook / reaction beats that
   *  must READ at phone size. */
  emo?: number;
  /** HOOK PASS: absolute frames on which a blink is forced (e.g. a deliberate double-blink on a
   *  beat). The hash blink still runs otherwise. */
  blinkF?: number[];
};
/** pick the action for a local frame from a list of [startFrame, act, expr]; cross-fades over `fade` frames */
export function seq(lf: number, list: [number, ActName, Expr?][], fade = 6): Pick<PersonP, 'act' | 'expr' | 'from' | 'k' | 'lf'> {
  let i = 0; while (i + 1 < list.length && list[i + 1][0] <= lf) i++;
  const [a, act, expr] = list[i], prev = i > 0 ? list[i - 1] : null;
  return {act, expr, lf: lf - a, from: prev ? {act: prev[1], expr: prev[2]} : undefined, k: prev ? cl((lf - a) / fade) : 1};
}

// ---------- math ----------
const TAU = Math.PI * 2;
const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (t: number) => { t = cl(t); return t * t * (3 - 2 * t); };
const backOut = (t: number) => { t = cl(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pos = (x: number) => Math.max(0, x);
/** 2-bone IK in the limb's "+x side" frame. Returns [upper rotation, elbow rotation]; bend +1 = elbow on the CCW side */
function ik(tx: number, ty: number, sx: number, sy: number, L1: number, L2: number, bend: 1 | -1): [number, number] {
  const dx = tx - sx, dy = ty - sy, d = cl(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
  const base = Math.atan2(dx, -dy);
  const A = Math.acos(cl((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const B = Math.acos(cl((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  return [base + bend * A, -bend * (Math.PI - B)];
}

// ---------- pose ----------
type Arm = [number, number, number];          // shoulder, elbow, wrist. front/back: + = outward/upward (mirrored per side); side: + = forward
type Leg = [number, number, number, number];  // hip, knee, ankle, lift (front-view foreshortening 0..1)
export type Pose = {
  x: number; y: number; sq: number; lean: number; tilt: number; tsy: number; sh: number;
  hd: number; hy: number; turn: number; look: number; lookY: number; brow: number; hat: number;
  aL: Arm; aR: Arm; lL: Leg; lR: Leg; stL: number; stR: number; hL: HandK; hR: HandK;
  expr: Expr; vis: Vis; blink: boolean; sweat: number; swing: number;
  cheek: number; jaw: number;   // V3: cheek swell 0..1 (drives cheekTex) + jaw drop in metres (mouth offset)
};
const NUM: (keyof Pose)[] = ['x', 'y', 'sq', 'lean', 'tilt', 'tsy', 'sh', 'hd', 'hy', 'turn', 'look', 'lookY', 'brow', 'hat', 'stL', 'stR', 'sweat', 'swing', 'cheek', 'jaw'];
const base = (): Pose => ({x: 0, y: 0, sq: 1, lean: 0, tilt: 0, tsy: 1, sh: 0, hd: 0, hy: 0, turn: 0, look: 0, lookY: 0, brow: 0, hat: 0,
  aL: [0.08, 0.06, 0], aR: [0.08, 0.06, 0], lL: [0.03, 0, 0, 0], lR: [0.03, 0, 0, 0], stL: 1, stR: 1, hL: 'fist', hR: 'fist', expr: 'neutral', vis: 'M', blink: false, sweat: 0, swing: 0, cheek: 0.12, jaw: 0});
function blend(a: Pose, b: Pose, k: number): Pose {
  const o = {...(k < 0.5 ? a : b)} as Pose;
  for (const n of NUM) (o as any)[n] = lerp(a[n] as number, b[n] as number, k);
  const la = <T extends number[]>(x: T, y: T) => x.map((v, i) => lerp(v, y[i], k)) as T;
  o.aL = la(a.aL, b.aL); o.aR = la(a.aR, b.aR); o.lL = la(a.lL, b.lL); o.lR = la(a.lR, b.lR);
  return o;
}

type Ctx = {f: number; t: number; lf: number; s: number; view: View; pace: number; dir: number; pointUp: boolean; scale: number};
const blinkAt = (f: number, s: number) => {
  const per = 78 + Math.floor(hash(s * 3.1) * 64), ph = (f + Math.floor(hash(s + 9) * per)) % per, cyc = Math.floor((f + Math.floor(hash(s + 9) * per)) / per);
  return ph < 3 || (hash(cyc * 1.7 + s) > 0.65 && ph >= 6 && ph < 8);
};
// hands-to-target helpers (front view, torso frame relative to hips)
const armIK = (tx: number, ty: number, bend: 1 | -1, side: View = 'front'): Arm => {
  const sx = side === 'side' ? 0.02 : SK.SX; const [a, b] = ik(tx, ty, sx, SK.SY, SK.UA, SK.FA, bend); return [a, b, 0];
};
const HIP_HAND: Arm = armIK(0.2, 0.03, 1);

function legSide(ph: number, amp: number, knee = 0.9): Leg {
  const th = amp * Math.sin(ph), sw = pos(Math.cos(ph));
  return [th, -(0.05 + knee * sw * sw), -0.45 * pos(-Math.sin(ph)) * pos(Math.cos(ph) + 0.2), 0];
}
const legFront = (ph: number, lift = 0.3): Leg => [0.035, 0, 0, lift * Math.pow(pos(Math.cos(ph)), 2)];

function idle(c: Ctx): Pose {
  const p = base(), t = c.t, s = c.s;
  const br = Math.sin((TAU * t) / 3.3 + s), ws = Math.sin((TAU * t) / 6.4 + s * 2.3);
  p.tsy = 1 + 0.014 * br; p.sh = 0.005 * br; p.hy = 0.004 * br;
  p.x = 0.01 * ws; p.tilt = -0.02 * ws; p.hd = 0.03 * Math.sin((TAU * t) / 4.7 + s * 1.7) + 0.02 * ws;
  const la = Math.sin((TAU * t) / 3.3 + s - 0.7);           // arms follow the breath with a lag
  p.aL = [0.09 + 0.02 * la, 0.08 + 0.02 * la, 0]; p.aR = [0.09 + 0.02 * la, 0.08 + 0.02 * la, 0];
  p.lL = [0.035, 0, 0, 0.035 * pos(ws)]; p.lR = [0.035, 0, 0, 0.035 * pos(-ws)];
  if (c.view === 'side') { p.lL = [0.06, -0.06, 0, 0]; p.lR = [-0.05 + 0.02 * ws, -0.04, 0, 0]; p.aL = [-0.08, 0.15, 0]; p.aR = [0.06 + 0.02 * la, 0.18, 0]; }
  const g = Math.floor((c.f + s * 40) / 70); p.look = (hash(g + s) - 0.5) * 0.8 * (hash(g * 3 + s) > 0.5 ? 1 : 0);   // occasional glances
  p.blink = blinkAt(c.f, s);
  return p;
}
function walk(c: Ctx, amp = 1, pace = c.pace): Pose {
  const p = idle(c), ph = TAU * pace * c.t + c.s * 2;
  p.look = 0;
  if (c.view === 'side') {
    p.lR = legSide(ph, 0.44 * amp); p.lL = legSide(ph + Math.PI, 0.44 * amp);
    p.aR = [-0.55 * amp * Math.sin(ph - 0.3), 0.18 + 0.45 * pos(-Math.sin(ph - 0.7)), 0];
    p.aL = [0.55 * amp * Math.sin(ph - 0.3), 0.18 + 0.45 * pos(Math.sin(ph - 0.7)), 0];
    p.lean = 0.06 * amp; p.hd = -0.035 * Math.sin(2 * ph - 0.9);
  } else {
    p.lR = legFront(ph, 0.3 * amp); p.lL = legFront(ph + Math.PI, 0.3 * amp);
    p.x = 0.018 * Math.sin(ph); p.tilt = -0.035 * Math.sin(ph);
    p.aR = [0.12 + 0.07 * Math.sin(ph - 0.3), 0.22 + 0.18 * Math.sin(ph + 0.2), 0]; p.aL = [0.12 - 0.07 * Math.sin(ph - 0.3), 0.22 - 0.18 * Math.sin(ph + 0.2), 0];
    p.hd = 0.045 * Math.sin(ph - 0.6);
  }
  p.y = 0.014 * amp * pos(Math.cos(2 * ph));           // spring at the passing position
  p.hat = 0.012 * Math.sin(2 * ph - 1.5);             // hat lags the head bob (follow-through)
  p.hy = -0.006 * Math.cos(2 * ph - 0.8);
  p.tsy = 1 + 0.018 * Math.cos(2 * ph + 0.4);
  return p;
}
const ACTS: Record<ActName, (c: Ctx) => Pose> = {
  idle,
  walk: (c) => walk(c),
  pull: (c) => { const p = walk(c); if (c.view !== 'side') { p.aR = [0.42, -0.08, 0]; p.hR = 'fist'; } else p.aL = [-0.7, 0.1, 0]; return p; },
  talk: (c) => {
    const p = idle(c), B = 16, q = c.f + c.s * 7, bi = Math.floor(q / B), bt = (q % B) / B;
    const G: [number, number][] = [[0.35, 1.3], [0.65, 1.75], [0.25, 0.8], [0.5, 1.05], [0.8, 2.0], [0.4, 1.55]];
    const g0 = G[Math.floor(hash(bi - 1 + c.s) * G.length)], g1 = G[Math.floor(hash(bi + c.s) * G.length)], e = backOut(bt * 2.4);
    p.aR = [lerp(g0[0], g1[0], e), lerp(g0[1], g1[1], e), 0.25]; p.hR = 'open';
    const h2 = Math.sin(q * 0.11); p.aL = h2 > 0.3 ? HIP_HAND : [0.2 + 0.15 * pos(Math.sin(q * 0.17)), 0.6 + 0.6 * pos(Math.sin(q * 0.17)), 0]; p.hL = h2 > 0.3 ? 'fist' : 'open';
    p.lean = 0; p.tilt += 0.02 * Math.sin(q * 0.09);
    return p;
  },
  push: (c) => {
    const p = walk(c, 0.9), hy = (1.05 / c.scale) - (SK.T + SK.S + SK.FH);   // FACES: handle height relative to the (shorter) hip
    if (c.view === 'side') { p.aR = armIK(0.36, hy, -1, 'side'); p.aL = armIK(0.34, hy + 0.01, -1, 'side'); p.lean = 0.13; }
    else if (c.view === 'front') { p.aR = armIK(0.13, 0.27, 1); p.aL = armIK(0.13, 0.27, 1); p.tilt *= 0.5; }
    else { p.aR = armIK(0.16, 0.3, 1); p.aL = armIK(0.16, 0.3, 1); }
    p.hd *= 0.6; p.hR = p.hL = 'fist'; return p;
  },
  point: (c) => {
    const p = idle(c), e = backOut(c.lf / 9), jab = 0.07 * Math.pow(pos(Math.sin(c.f * 0.26 + c.s)), 6);
    p.aR = c.pointUp ? [2.75 * e + jab, 0.05, 0] : [1.52 * e + jab, 0.04 + 0.1 * (1 - e), 0]; p.hR = 'point';
    p.aL = HIP_HAND; p.turn = 0.25 * e; p.look = 0.8 * e; p.tilt -= 0.03 * e; p.brow = 0.008;
    return p;
  },
  cross: (c) => {
    const p = idle(c), e = sm(c.lf / 8);
    p.aR = blendArm(p.aR, armIK(-0.11, 0.24, 1), e); p.aL = blendArm(p.aL, armIK(-0.08, 0.21, 1), e);
    p.hd = 0.07 + 0.02 * Math.sin(c.t * 2); p.tilt = 0.025;
    p.lR = [0.06, 0, 0, 0.07 * Math.pow(pos(Math.sin(c.f * 0.55)), 2)];   // impatient foot tap
    return p;
  },
  flex: (c) => {
    const p = idle(c), e = backOut(c.lf / 8), pumpL = Math.pow(pos(Math.sin(c.f * 0.2)), 2), pumpR = Math.pow(pos(Math.sin(c.f * 0.2 + Math.PI)), 2);
    p.aL = blendArm(p.aL, [1.4 + 0.08 * pumpL, 1.9 - 0.25 * pumpL, 0], e); p.aR = blendArm(p.aR, [1.4 + 0.08 * pumpR, 1.9 - 0.25 * pumpR, 0], e);
    p.tilt = 0.04 * (pumpL - pumpR); p.tsy = 1.03 + 0.015 * (pumpL + pumpR); p.hd = -0.05 * (pumpL - pumpR);
    p.lL = [0.12, 0, 0, 0]; p.lR = [0.12, 0, 0, 0]; p.y = 0.008 * (pumpL + pumpR);
    return p;
  },
  shrug: (c) => {
    const p = idle(c), u = (c.lf % 40) / 40, k = sm(u / 0.2) * (1 - sm((u - 0.7) / 0.25));
    p.sh = 0.045 * k; p.hy = -0.03 * k; p.hd = 0.13 * k; p.brow = 0.02 * k;
    p.aL = [0.35 + 0.3 * k, 0.4 + 1.0 * k, 0.3]; p.aR = [0.35 + 0.3 * k, 0.4 + 1.0 * k, 0.3]; p.hL = p.hR = 'open';
    return p;
  },
  slump: (c) => {
    const p = idle(c), sigh = Math.pow(pos(Math.sin((TAU * c.t) / 2.8 + c.s)), 4);
    p.tsy = 0.96 + 0.025 * sigh; p.sh = -0.025 + 0.02 * sigh; p.hy = -0.03; p.lookY = -0.025; p.hd = 0.05;
    p.aL = [0.02, 0.03, 0]; p.aR = [0.02, 0.03, 0]; p.stL = p.stR = 1.05;
    p.lL = [0.04, 0, 0, 0.05]; p.lR = [0.04, 0, 0, 0.05]; p.tilt = 0.02 * Math.sin(c.t);
    return p;
  },
  bounce: (c) => {
    const p = idle(c), P = 17, u = ((c.f + c.s * 5) % P) / P, air = u < 0.72 ? Math.sin((Math.PI * u) / 0.72) : 0, land = u >= 0.72 ? Math.sin((Math.PI * (u - 0.72)) / 0.28) : 0;
    p.y = 0.13 * air; p.sq = 1 + 0.07 * air - 0.12 * land;
    const arm = 2.35 + 0.25 * Math.sin(TAU * u - 0.8);           // arms lag the body (overlap)
    p.aL = [arm, 0.25 + 0.2 * land, 0]; p.aR = [arm, 0.25 + 0.2 * land, 0]; p.hL = p.hR = 'open';
    p.lL = [0.06, 0, 0, 0.18 * air]; p.lR = [0.06, 0, 0, 0.18 * air]; p.hat = 0.025 * land; p.brow = 0.012;
    return p;
  },
  cheer: (c) => {
    const p = idle(c), w = Math.sin(c.f * 0.4 + c.s), e = backOut(c.lf / 8);
    p.aL = blendArm(p.aL, [2.5 + 0.12 * w, 0.3, 0], e); p.aR = blendArm(p.aR, [2.5 - 0.12 * w, 0.3, 0], e); p.hL = p.hR = 'open';
    p.y = 0.02 * pos(Math.sin(c.f * 0.4)); p.hd = 0.05 * w; return p;
  },
  tired: (c) => {
    const p = idle(c), pant = Math.sin((TAU * c.t) / 1.05 + c.s);
    p.tsy = 0.98 + 0.026 * pant; p.sh = 0.012 * pant - 0.02; p.hy = -0.02 + 0.008 * pant;
    p.aR = [0.0, 0.0, 0]; p.stR = 1.16; p.aL = [0.05, 0.04, 0]; p.stL = 1.04;
    p.tilt = -0.1 + 0.01 * Math.sin(c.t * 1.7); p.hd = 0.13; p.lookY = -0.012; p.x = -0.02 + 0.008 * Math.sin((TAU * c.t) / 1.6);
    p.lL = [0.06, 0, 0, 0.06]; p.lR = [0.02, 0, 0, 0.02]; p.sweat = 1; p.swing = 0.04 * Math.sin((TAU * c.t) / 1.6 + 1);
    if (c.view === 'side') { p.lean = 0.12; p.tilt = 0; p.hd = -0.1; p.aR = [-0.04, 0, 0]; p.lL = [0.05, -0.12, 0, 0]; p.lR = [-0.05, -0.12, 0, 0]; }
    return p;
  },
  tiredWalk: (c) => {
    const pace = c.pace * 0.62, p = walk(c, 0.72, pace), ph = TAU * pace * c.t + c.s * 2;
    p.tsy = 0.98 + 0.02 * Math.cos(2 * ph); p.sweat = 1; p.stR = 1.16; p.lookY = -0.015;
    if (c.view === 'side') { p.lean = 0.17; p.hd = -0.12 - 0.03 * Math.sin(2 * ph); p.aR = [-0.12 + 0.05 * Math.sin(ph), 0.02, 0]; p.aL = [0.3 * Math.sin(ph - 0.3), 0.15, 0]; }
    else { p.tilt = -0.09 + 0.03 * Math.sin(ph); p.hd = 0.12; p.aR = [0.0, 0.0, 0]; }
    p.swing = 0.12 * Math.sin(ph - 0.8);                 // basket swings behind the step
    p.y *= 0.4; return p;
  },
  wink: (c) => {
    const p = idle(c), e = backOut(c.lf / 7);
    p.aR = blendArm(p.aR, [0.8, 1.55, 0], e); p.hR = e > 0.4 ? 'thumb' : 'fist'; p.aL = HIP_HAND;
    p.hd = 0.11 * sm(c.lf / 6) + 0.02 * Math.sin(c.t * 2); p.turn = 0.12; p.look = 0.25; p.tilt = 0.03;
    p.y = 0.03 * Math.sin(Math.PI * cl(c.lf / 7)) * (c.lf < 7 ? 1 : 0);
    return p;
  },
  lookSide: (c) => { const p = idle(c), d = c.dir; p.turn = 0.4 * d; p.look = 0.9 * d; p.hd = -0.05 * d + 0.02 * Math.sin(c.t * 1.3); return p; },
  think: (c) => {
    const p = idle(c), e = sm(c.lf / 8);
    p.aR = blendArm(p.aR, armIK(0.04, SK.NECK + SK.HC - SK.RY * 0.92, 1), e); p.aL = blendArm(p.aL, armIK(-0.13, 0.17, 1), e);
    p.hd = 0.09 + 0.025 * Math.sin(c.f * 0.15); p.look = 0.7; p.lookY = 0.012; p.turn = 0.12;
    return p;
  },
  present: (c) => {
    const p = idle(c), e = backOut(c.lf / 9), w = Math.sin(c.f * 0.18 + c.s);
    p.aL = blendArm(p.aL, [1.05 + 0.08 * w, 0.5, 0.2], e); p.aR = blendArm(p.aR, [1.05 - 0.08 * w, 0.5, 0.2], e); p.hL = p.hR = 'open';
    p.tsy = 1.02; p.hd = 0.06 * w; p.y = 0.04 * Math.sin(Math.PI * cl(c.lf / 9)) * (c.lf < 9 ? 1 : 0);
    return p;
  },
  proud: (c) => {
    const p = idle(c), b = pos(Math.sin((TAU * c.t) / 1.3 + c.s));
    p.aL = HIP_HAND; p.aR = HIP_HAND; p.tsy = 1.03 + 0.01 * b; p.y = 0.012 * b; p.hd = 0.06; p.lL = [0.09, 0, 0, 0]; p.lR = [0.09, 0, 0, 0];
    return p;
  },
  eureka: (c) => {
    const p = idle(c), e = backOut(c.lf / 7);
    p.aR = blendArm(p.aR, [2.95, 0.05, 0], e); p.hR = 'point'; p.aL = HIP_HAND;
    p.y = 0.09 * Math.sin(Math.PI * cl(c.lf / 9)) * (c.lf < 9 ? 1 : 0); p.sq = 1 + 0.06 * Math.sin(Math.PI * cl(c.lf / 9));
    p.lookY = 0.015; p.look = 0.4; p.brow = 0.015; p.hat = 0.03 * Math.sin(Math.PI * cl((c.lf - 4) / 8));
    return p;
  },
  wave: (c) => { const p = idle(c), e = backOut(c.lf / 8); p.aR = blendArm(p.aR, [2.3, 0.35 + 0.4 * Math.sin(c.f * 0.55), 0], e); p.hR = 'open'; p.hd = 0.05; return p; },
};
function blendArm(a: Arm, b: Arm, k: number): Arm { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }


/** both hands on the cart handle bar (world), solved per view by 2-bone IK; weight c.hold.k blends from the action's own arms */
function applyGrip(p: Pose, c: PersonP, view: View, dir: number, cam: THREE.Vector3, S: number) {
  const yaw = Math.atan2(cam.x - c.p[0], cam.z - c.p[2]), h = c.hold!, sc = (h.sc ?? 1) * CART_K, k = h.k ?? 1; if (k <= 0) return;
  const side = view === 'side', sq = Math.sqrt(p.sq), sx = dir * S / sq, sy = S * p.sq;
  const drop = (l: Leg) => SK.T * (1 - l[3]) * Math.cos(l[0]) + SK.S * Math.cos(l[0] + l[1]) + SK.FH;
  const hipY = Math.max(drop(p.lL), drop(p.lR)) + p.y, tr = -p.lean + p.tilt;
  const right = [Math.cos(yaw), -Math.sin(yaw)], r = h.ry;
  const hx = h.p[0] - 0.3 * sc * Math.cos(r), hz = h.p[2] + 0.3 * sc * Math.sin(r), bz = [Math.sin(r), Math.cos(r)];
  const local = (t: number): [number, number] => {
    let wx = hx + bz[0] * t * sc, wz = hz + bz[1] * t * sc, wy = 1.0 * sc;
    // billboard parallax: slide the handle point along the camera ray onto the character's (vertical) plane -> hand and bar coincide on screen
    const nx = Math.sin(yaw), nz = Math.cos(yaw), den = (wx - cam.x) * nx + (wz - cam.z) * nz;
    if (Math.abs(den) > 1e-4) { const k2 = Math.min(3, Math.max(0.3, ((c.p[0] - cam.x) * nx + (c.p[2] - cam.z) * nz) / den)); wx = cam.x + (wx - cam.x) * k2; wz = cam.z + (wz - cam.z) * k2; wy = cam.y + (wy - cam.y) * k2; }
    wx -= c.p[0]; wz -= c.p[2];
    const x = (wx * right[0] + wz * right[1]) / sx - p.x, y = (wy + 0.03) / sy - hipY;
    return [x * Math.cos(-tr) - y * Math.sin(-tr), x * Math.sin(-tr) + y * Math.cos(-tr)];
  };
  let a = local(-0.12), b = local(0.12);
  if (a[0] > b[0]) [a, b] = [b, a];                       // a = left-most (screen), b = right-most
  if (side) { a = b = local(0); }
  const solve = (t: [number, number], s: number, shx: number, st: number): Arm => {
    const [u, e] = ik(s * t[0], t[1], s * shx, SK.SY * p.tsy + p.sh, SK.UA * st, SK.FA * st, side ? -1 : 1); return [u, e, 0];
  };
  const hL = solve(a, side ? 1 : -1, side ? -0.025 : -SK.SX, p.stL), hR = solve(b, 1, side ? 0.02 : SK.SX, p.stR);
  p.aL = blendArm(p.aL, hL, k); p.aR = blendArm(p.aR, hR, k); p.hL = p.hR = 'fist';
}

/** ENGINE v1.1 CARRY: a carried basket never goes into the floor. If the hanging hand would put the basket bottom (hand - 0.34,
 *  same point as camera.charPts basket) below 2 cm, the carrying arm bends (2-bone IK) to lift the hand just enough. */
function applyCarry(p: Pose, c: PersonP, view: View, S: number) {
  const side = view === 'side', sy = S * p.sq, tr = -p.lean + p.tilt;
  const drop = (l: Leg) => SK.T * (1 - l[3]) * Math.cos(l[0]) + SK.S * Math.cos(l[0] + l[1]) + SK.FH;
  const hipY = Math.max(drop(p.lL), drop(p.lR)) + p.y;
  const rot = (x: number, y: number, a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const shx = side ? 0.02 : SK.SX, shY = SK.SY * p.tsy + p.sh, a = p.aR, st = p.stR;
  // FK of the right hand (hip-relative, same as camera.charPts)
  const sh = rot(shx, shY, tr); let ang = tr + a[0];
  const el = rot(0, -SK.UA * st, ang); ang += a[1];
  const wr = rot(0, -SK.FA * st, ang); ang += a[2];
  const hd = rot(0, -0.035, ang);
  const hx = sh[0] + el[0] + wr[0] + hd[0], hy = hipY + sh[1] + el[1] + wr[1] + hd[1];
  const need = 0.34 + (0.02 - c.p[1]) / sy;
  if (hy >= need) return;
  // target wrist point in the torso frame, relative to the hips
  const ty = need + 0.035 - hipY, t = rot(hx, ty, -tr);
  const [u, e] = ik(t[0], t[1], shx, shY, SK.UA * st, SK.FA * st, side ? -1 : 1);
  p.aR = [u, e, 0];
}

/** V3 WORD-SYNCED VISEMES: the mouth follows the story's real word table (WORDS_REAL).
    Inside a spoken word the mouth cycles open shapes by position in the word (attack /
    sustain / release) and closes at the word's end and in the gaps — so lip shapes, cheek
    swell and head bob all ride the actual narration rhythm instead of a frame hash.
    Falls back to the old hash only when a story ships no word table. */
const VIS_OPEN: Record<Vis, number> = {M: 0, E: 0.45, A: 0.85, O: 0.65};
function viseme(f: number, s: number): Vis {
  if (!WORDS_REAL.length) { const k = Math.floor((f + s * 5) / 3), h = hash(k * 7.13 + s);
    if (Math.floor((f + s * 11) / 3) % 6 === 5) return 'M'; return h < 0.12 ? 'M' : h < 0.55 ? 'A' : h < 0.8 ? 'E' : 'O'; }
  const rt = realOf(f / 30);
  const w = WORDS_REAL.find((q) => rt >= q[1] - 0.03 && rt <= q[2] + 0.03);
  if (!w) return 'M';
  const u = (rt - w[1]) / Math.max(0.09, w[2] - w[1]);
  if (u > 0.88) return 'M';                                    // release: lips close at the word end
  const h = hash(Math.round(w[1] * 30) * 1.31 + s), ph = Math.floor(u * 3);
  if (ph === 0) return h < 0.4 ? 'E' : 'A';                    // attack
  if (ph === 1) return h < 0.5 ? 'A' : 'O';                    // sustain (vowel core)
  return h < 0.45 ? 'E' : 'A';                                 // pre-release
}
/** smoothed mouth openness 0..1 (triangular window over ±2 frames) — drives cheeks + jaw + head bob,
    so the face moves in continuous swells, never in steps */
function speechOpen(f: number, s: number): number {
  let a = 0, wsum = 0;
  for (let d = -2; d <= 2; d++) { const wgt = 3 - Math.abs(d); a += wgt * VIS_OPEN[viseme(f + d, s)]; wsum += wgt; }
  return a / wsum;
}
/** resting cheek swell per expression — numeric, so cross-fades interpolate it (no snapping) */
const EXPR_CHEEK: Record<Expr, number> = {neutral: 0.12, happy: 0.55, fake: 0.5, sad: 0.15, smirk: 0.42, worried: 0.2, surprised: 0.3, closed: 0.6, wink: 0.5, angry: 0.35, smug: 0.45, tired: 0.1, proud: 0.4, rage: 0.38, grin: 0.65, shock: 0.32, cocky: 0.5, determined: 0.3};
export function computePose(c: PersonP, f: number, view: View, dir: number, cam?: THREE.Vector3): Pose {
  const L = LOOKS[c.who], s = c.seed ?? (c.who.length * 1.37 + c.p[0] * 3.1 + c.p[2] * 1.7);
  const ctx: Ctx = {f, t: f / 30, lf: c.lf ?? f, s, view, pace: c.pace ?? 1.45, dir, pointUp: !!c.pointUp, scale: L.scale ?? 1};
  let p = ACTS[c.act ?? 'idle'](ctx); p.expr = c.expr ?? 'neutral';
  if (c.from && (c.k ?? 1) < 1) {
    const q = ACTS[c.from.act]({...ctx, lf: 999}); q.expr = c.from.expr ?? p.expr;
    p = blend(q, p, sm(c.k ?? 1));
  }
  // V3 CHEEKS: expression base, interpolated across the same cross-fade as the pose (no snap);
  // movement adds a step-locked jiggle so cheeks stay alive while walking / pushing too
  p.cheek = EXPR_CHEEK[p.expr] ?? 0.12;
  if (c.from && (c.k ?? 1) < 1) p.cheek = lerp(EXPR_CHEEK[c.from.expr ?? p.expr] ?? 0.12, p.cheek, sm(c.k ?? 1));
  if (c.act === 'walk' || c.act === 'tiredWalk' || c.act === 'push') p.cheek = cl(p.cheek + 0.09 * pos(Math.sin(TAU * (c.pace ?? 1.45) * ctx.t * 2 + s)));
  if (c.act === 'bounce' || c.act === 'cheer') p.cheek = cl(p.cheek + 0.15);
  if (c.talk) { const open = speechOpen(f, s); p.vis = viseme(f, s);
    p.cheek = cl(p.cheek + 0.22 + 0.55 * open);              // cheeks swell with speech amplitude
    p.jaw = 0.011 * open;                                    // jaw drops as the mouth opens
    p.hd += 0.028 * Math.sin(f * 0.37 + s) * (0.4 + open);   // head bob locked to speech energy
    p.hy += 0.006 * open; p.brow += 0.012 * Math.pow(pos(Math.sin(f * 0.21 + s)), 3); }
  p.brow += 0.0035 * Math.sin(f * 0.13 + s * 2.7);           // V3: brow micro-motion, always alive
  // HOOK PASS: emotion intensity - amplify the face channels that read small (cheeks past the old
  // cap, brow travel in the expression's own direction, deeper jaw). emo = 0 (default) is a no-op.
  const emo = c.emo ?? 0;
  if (emo > 0) {
    p.cheek = cl(p.cheek * (1 + 0.85 * emo), 0, 1.8);
    const bk = EXPR[p.expr].b;
    p.brow = p.brow * (1 + 1.2 * emo) + (bk === 'high' || bk === 'up' ? 0.016 * emo : bk === 'angry' ? -0.012 * emo : bk === 'worried' ? 0.006 * emo : 0);
    p.jaw = p.jaw * (1 + 0.9 * emo);
  }
  if (c.blinkF && c.blinkF.includes(f)) p.blink = true;      // HOOK PASS: forced blink frames (double-blink on a beat)
  if (c.hold && cam) applyGrip(p, c, view, dir, cam, L.scale ?? 1);
  if (c.basket && !c.hold) applyCarry(p, c, view, L.scale ?? 1);
  if (c.sit) { if (view === 'side') { p.lL = [-1.45, 1.4, 0, 0]; p.lR = [-1.4, 1.35, 0, 0]; } else { p.lL = [0.16, 0, 0, 0.82]; p.lR = [0.16, 0, 0, 0.82]; }
    // FACES: hips stay on the chair seat (0.5 m) with the short legs dangling, independent of leg length
    const dr = (l: Leg) => SK.T * (1 - l[3]) * Math.cos(l[0]) + SK.S * Math.cos(l[0] + l[1]) + SK.FH; p.y += SEAT_HIP - Math.max(dr(p.lL), dr(p.lR)); }
  // FACES: gaze -> pupils + 3/4 turn + head roll (RC: 7/10 faces look off-lens toward the partner/object, heads tilt 5-15 deg)
  if (view !== 'side') {
    let g: number | null = null;
    if (c.gaze === 'cam') g = 0;
    else if (c.gaze && cam) { const yaw = Math.atan2(cam.x - c.p[0], cam.z - c.p[2]), dx = (c.gaze[0] - c.p[0]) * Math.cos(yaw) - (c.gaze[2] - c.p[2]) * Math.sin(yaw);
      g = cl(dx / 0.9, -1, 1) * dir * (view === 'back' ? -1 : 1); }
    const a = c.from && (c.k ?? 1) < 1 ? sm(c.k ?? 1) : 1;
    if (g !== null) { p.look = lerp(p.look, g, a); p.turn = lerp(p.turn, 0.55 * g, a); p.hd += -0.13 * g + (c.gaze === 'cam' ? 0.05 * (hash(s) - 0.5) : 0); }
    else { const d0 = hash(s * 1.9) > 0.5 ? 1 : -1; p.turn += 0.22 * d0; p.look += 0.35 * d0; p.hd += -0.05 * d0; }   // never dead-front symmetric
  }
  if (c.look !== undefined) p.look = c.look;
  if (c.turn !== undefined) p.turn = c.turn;
  if (c.sweat) p.sweat = 1;
  return p;
}

const SEAT_HIP = 0.5;   // chair seat (street.tsx: top at 0.47) + cushion of the body sack

// ---------- rendering ----------
const NOINK = 3;
const unit = new THREE.PlaneGeometry(1, 1);
const blobGeo = new THREE.CircleGeometry(1, 28);
const blobMat = new THREE.MeshBasicMaterial({color: '#000', transparent: true, opacity: 0.26, depthWrite: false});
const mats = new Map<string, THREE.MeshBasicMaterial>();
const TINT = new THREE.Color('#ffffff');
const FAR = 0.74;
/** FACES: heads + face layers take only FACE_LIT of the scene tint (RC faces stay white in every light) */
const FACE_LIT = 0.2, WHITE = new THREE.Color('#ffffff');
const isFace = (k: string) => /^(head|eyes|brows|mouth|acc)/.test(k);
const tintOf = (m: THREE.MeshBasicMaterial, k: string) => { const far = k.endsWith('#far'); if (isFace(k)) m.color.copy(WHITE).lerp(TINT, FACE_LIT).multiplyScalar(far ? 0.93 : 1); else m.color.copy(TINT).multiplyScalar(far ? FAR : 1); };
/** global light tint of all characters (mood: warm store -> blue night) */
export function setCharTint(c: THREE.Color) { TINT.copy(c); mats.forEach((m, k) => tintOf(m, k)); }
function mat(p: PartTex, far = false) {
  const k = p.key + (far ? '#far' : ''); let m = mats.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({map: p.tex, alphaTest: 0.5, alphaToCoverage: false, side: THREE.DoubleSide, toneMapped: !isFace(k)}); tintOf(m, k); mats.set(k, m); }   // FACES: toneMapped off -> no tone-map grey on white faces
  return m;
}
const Part: React.FC<{p: PartTex; x?: number; y?: number; z?: number; sx?: number; sy?: number; far?: boolean}> = ({p, x = 0, y = 0, z = 0, sx = 1, sy = 1, far}) =>
  <mesh geometry={unit} material={mat(p, far)} position={[(p.w / 2 - p.ax) * sx + x, (p.ay - p.h / 2) * sy + y, z]} scale={[p.w * sx, p.h * sy, 1]} layers={NOINK} />;
const IF: React.FC<{t: InkFill; sy?: number; far?: boolean; z?: number}> = ({t, sy = 1, far, z = 0}) => <><Part p={t.ink} sy={sy} far={far} z={z} /><Part p={t.fill} sy={sy} far={far} z={z + 0.0015} /></>;

const ZT: Record<View, {lL: number; lR: number; body: number; aL: number; aR: number; head: number}> = {
  front: {lL: 0, lR: 0.0004, body: 0.012, aL: 0.02, aR: 0.026, head: 0.036},
  side: {lL: -0.009, lR: 0.004, body: 0.012, aL: -0.004, aR: 0.026, head: 0.036},
  back: {lL: 0, lR: 0.0004, body: 0.012, aL: 0.003, aR: 0.006, head: 0.036},
};

export const Character: React.FC<{c: PersonP; f: number; cam: THREE.Vector3; vel?: THREE.Vector3 | null}> = ({c, f, cam, vel}) => {
  const L = LOOKS[c.who], S = L.scale ?? 1, hk = L.headK ?? 1, big = !!L.bigArms;
  const yaw = Math.atan2(cam.x - c.p[0], cam.z - c.p[2]);
  // ---- view from motion relative to the camera: across = side view (facing the way it moves), toward = front, away = back
  let view: View = c.view && c.view !== 'auto' ? c.view : 'front', dir = c.dir ?? 1;
  const sp = vel ? Math.hypot(vel.x, vel.z) : 0;
  if (vel && sp > 0.0015) {
    const vx = (vel.x * Math.cos(yaw) - vel.z * Math.sin(yaw)) / sp, vz = (vel.x * Math.sin(yaw) + vel.z * Math.cos(yaw)) / sp;
    if (!c.view || c.view === 'auto') view = Math.abs(vx) > 0.6 ? 'side' : vz >= 0 ? 'front' : 'back';
    if (c.dir === undefined) dir = vx >= 0 ? 1 : -1;
  }
  if (view !== 'side' && c.dir === undefined) dir = 1;
  const p = computePose(c, f, view, dir, cam);
  const side = view === 'side', back = view === 'back', sg = side ? 1 : -1, Z = ZT[view];
  // ---- textures (cached)
  const thigh = limbTex('leg', SK.T), shin = limbTex('shin', SK.S),   /* SHAPE: tapered lower segments */ foot = footTex(side ? 'side' : 'front', L.shoe ?? '#2a1d1a', L.outfit === 'dress');
  const ua = limbTex(big ? 'bigU' : 'arm', SK.UA, FACE), fa = limbTex(big ? 'bigF' : 'fore', SK.FA, FACE);
  const ex = EXPR[p.expr], eyeK = p.blink && ex.e !== 'closed' && ex.e !== 'happy' ? (ex.e === 'wink' ? 'wink' : 'blink') : ex.e;
  // ---- ground solve: the lower foot stays on the floor
  const drop = (l: Leg) => SK.T * (1 - l[3]) * Math.cos(l[0]) + SK.S * Math.cos(l[0] + l[1]) + SK.FH;
  const hipY = Math.max(drop(p.lL), drop(p.lR)) + p.y;
  const torsoRot = -p.lean + p.tilt;
  const leg = (l: Leg, s: number, x: number, z: number, far: boolean) => (
    <group position={[x, 0, z]} rotation={[0, 0, s * l[0]]}>
      <IF t={thigh} sy={1 - l[3]} far={far} />
      <group position={[0, -SK.T * (1 - l[3]), 0]} rotation={[0, 0, s * l[1]]}>
        <IF t={shin} far={far} />
        <group position={[0, -SK.S, 0]} rotation={[0, 0, -s * (l[0] + l[1]) + s * l[2]]}><IF t={foot} far={far} z={0.0002} /></group>
      </group>
    </group>);
  const arm = (a: Arm, s: number, x: number, z: number, far: boolean, st: number, hand: HandK, basket: boolean) => {
    const ht = handTex(hand, big, FACE), comp = -(torsoRot + s * (a[0] + a[1] + a[2]));
    return (
      <group position={[x, SK.SY * p.tsy + p.sh, z]} rotation={[0, 0, s * a[0]]}>
        <IF t={ua} sy={st} far={far} />
        <group position={[0, -SK.UA * st, 0]} rotation={[0, 0, s * a[1]]}>
          <IF t={fa} sy={st} far={far} />
          <group position={[0, -SK.FA * st, 0]} rotation={[0, 0, s * a[2]]}>
            <IF t={ht} far={far} z={0.0004} />
            {basket && <group rotation={[0, 0, comp + p.swing]}><Part p={basketTex()} z={-0.0012} far={far} /></group>}
          </group>
        </group>
      </group>);
  };
  const shx = side ? [-0.025, 0.02] : [-SK.SX, SK.SX], hipx = side ? [-0.012, 0.012] : [-SK.HX, SK.HX];
  const turn = side ? 1.15 : p.turn, rx = SK.RX * hk, ry = SK.RY * hk;
  const hat = hatTex(c.who, view);
  const drip = (f * 0.004) % 0.09;
  return (
    <group position={c.p} rotation={[0, yaw, 0]}>
      <mesh geometry={blobGeo} material={blobMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} scale={[0.27 * S, 0.15 * S, 1]} />
      <group scale={[dir * S / Math.sqrt(p.sq), S * p.sq, S]}>
        <group position={[0, hipY, 0]}>
          {leg(p.lL, sg, hipx[0], Z.lL, side)}
          {leg(p.lR, 1, hipx[1], Z.lR, false)}
          <group position={[p.x, 0, 0]} rotation={[0, 0, torsoRot]}>
            <Part p={bodyTex(c.who, view)} z={Z.body} sy={p.tsy} />
            {arm(p.aL, sg, shx[0], Z.aL, side, p.stL, p.hL, false)}
            {arm(p.aR, 1, shx[1], Z.aR, false, p.stR, p.hR, !!c.basket)}
            <group position={[0, SK.NECK * p.tsy + p.sh * 0.6 + p.hy, Z.head]} rotation={[0, 0, p.hd]}>
              <group position={[0, SK.HC * hk, 0]}>
                <Part p={headTex(c.who, view)} />
                {/* FACES: 3/4 turn - features slide up to ~0.16 m*turn toward the look side and compress; eyes sit low and close under the brows */}
                {!back && <group position={[(side ? 0.12 : 0.16) * turn * hk, p.lookY * hk, 0.002]} scale={[hk * (1 - 0.22 * Math.min(1, Math.abs(turn))), hk, 1]}>
                  <Part p={cheekTex(p.cheek)} z={0.0008} />
                  <Part p={eyesTex(eyeK, p.look * 2.2)} x={p.look * 0.024} y={-0.004} z={0.001} />
                  <Part p={browsTex(ex.b)} x={p.look * 0.014} y={0.066 + p.brow} z={0.0015} />
                  <Part p={mouthTex(ex.m, p.vis)} x={p.look * 0.016 + (side ? 0.012 : 0)} y={-0.112 - p.jaw} z={0.001} />
                  <Part p={accTex(c.who)} z={0.002} />
                </group>}
                {hat && <Part p={hat} y={p.hat} x={side ? 0.01 : 0} z={0.006} />}
                {p.sweat > 0.5 && !back && <Part p={sweatTex()} x={rx * 0.92} y={ry * 0.45 - drip} z={0.008} />}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
