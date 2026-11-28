// CAMERA v3 - subject-driven framing in REAL (voice) time.
//  - Every setup names a SUBJECT (character / cart / hand / prop / group) and a SHOT SIZE (CU, MCU, MS, FS, WS, EWS);
//    the camera position is SOLVED every frame from the subject's key points (forward kinematics of the cut-out rig),
//    the fov and the 9:16 aspect, so the subject always sits at its screen placement with headroom.
//  - Moves (push, arc, crane, fov / dolly-zoom, pan) animate the framing parameters, never raw coordinates, so a move
//    can't drift the subject out of frame. Moving subjects are followed through a +-0.2 s smoothed sample window.
//  - The camera runs on the real clock (smooth), staging runs on the old clock via warp() exactly as before.
//  - Handheld noise ~0 (reference measured 0.15-0.8 px rms @1080); short small kicks only on real hits.
import * as THREE from 'three';

export const ASPECT = 9 / 16;
const D2R = Math.PI / 180;
import {shotAt, cl, type V3, TOTAL, oldF, realOf, span, shotEndReal, T, SHOT_REAL, END_REAL} from '../core/clock';
import {stage, velocities} from '../core/staging';
import {computePose, PersonP} from '../chars/rig';
import {SK, LOOKS, CART_K} from '../chars/charparts';
import {TAKES, PROPS, KICKS, WHIPS, FLASHES} from '@story/takes';
import type {Size, Setup, Move, Take} from './takes_api';
export type {Size, Setup, Move, Take};
export {TAKES, PROPS, KICKS, WHIPS, FLASHES, oldF, realOf, span, shotEndReal, T};
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UPW = V(0, 1, 0);

const HAT_TOP: Record<string, number> = {fedora: 0.34, boater: 0.3, cloche: 0.33, cap: 0.29};
const HAT_W: Record<string, number> = {fedora: 1.4, boater: 1.32, cloche: 1.2, cap: 1.15};
export type CharPts = {head: THREE.Vector3; top: THREE.Vector3; chin: THREE.Vector3; cheekL: THREE.Vector3; cheekR: THREE.Vector3; eyes: THREE.Vector3; mouth: THREE.Vector3;
  shoulders: THREE.Vector3; hips: THREE.Vector3; feet: THREE.Vector3; footL: THREE.Vector3; footR: THREE.Vector3; handL: THREE.Vector3; handR: THREE.Vector3; basket?: THREE.Vector3; rx: number};
/** same view / facing logic as Character in rig.tsx */
export function viewOf(c: PersonP, cam: THREE.Vector3, vel?: THREE.Vector3 | null) {
  const yaw = Math.atan2(cam.x - c.p[0], cam.z - c.p[2]);
  let view = (c.view && c.view !== 'auto' ? c.view : 'front') as 'front' | 'side' | 'back', dir = c.dir ?? 1;
  const sp = vel ? Math.hypot(vel.x, vel.z) : 0;
  if (vel && sp > 0.0015) {
    const vx = (vel.x * Math.cos(yaw) - vel.z * Math.sin(yaw)) / sp, vz = (vel.x * Math.sin(yaw) + vel.z * Math.cos(yaw)) / sp;
    if (!c.view || c.view === 'auto') view = Math.abs(vx) > 0.6 ? 'side' : vz >= 0 ? 'front' : 'back';
    if (c.dir === undefined) dir = vx >= 0 ? 1 : -1;
  }
  if (view !== 'side' && c.dir === undefined) dir = 1;
  return {yaw, view, dir};
}
export function charPts(c: PersonP, f: number, cam: THREE.Vector3, vel?: THREE.Vector3 | null): CharPts {
  const L = LOOKS[c.who], S = L.scale ?? 1, hk = L.headK ?? 1;
  const {yaw, view, dir} = viewOf(c, cam, vel);
  const p = computePose(c, f, view, dir, cam), side = view === 'side', sg = side ? 1 : -1;
  const drop = (l: number[]) => SK.T * (1 - l[3]) * Math.cos(l[0]) + SK.S * Math.cos(l[0] + l[1]) + SK.FH;
  const hipY = Math.max(drop(p.lL), drop(p.lR)) + p.y, tr = -p.lean + p.tilt;
  const rot = (x: number, y: number, a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const add = (a: [number, number], b: [number, number]): [number, number] => [a[0] + b[0], a[1] + b[1]];
  const to: [number, number] = [p.x, hipY];
  const neck = add(to, rot(0, SK.NECK * p.tsy + p.sh * 0.6 + p.hy, tr)), ha = tr + p.hd;
  const head = add(neck, rot(0, SK.HC * hk, ha)), rx = SK.RX * hk, ry = SK.RY * hk;
  const hp = (x: number, y: number) => add(head, rot(x, y, ha));
  const hat = L.hat, hairTop = L.hairStyle === 'bun' ? ry + 0.09 * hk : ry + 0.02;
  const topL = hat ? Math.max(hairTop, HAT_TOP[hat] * hk + p.hat) : hairTop, wHalf = rx * Math.max(1.08, hat ? HAT_W[hat] : 1);
  const turn = side ? 1.15 : p.turn;
  const shx = side ? [-0.025, 0.02] : [-SK.SX, SK.SX];
  const arm = (a: number[], s: number, x: number, st: number) => {
    const sh = add(to, rot(x, SK.SY * p.tsy + p.sh, tr)); let ang = tr + s * a[0];
    const el = add(sh, rot(0, -SK.UA * st, ang)); ang += s * a[1];
    const wr = add(el, rot(0, -SK.FA * st, ang)); ang += s * a[2];
    return add(wr, rot(0, -0.035, ang));
  };
  const hR = arm(p.aR, 1, shx[1], p.stR), hL = arm(p.aL, sg, shx[0], p.stL);
  const right = V(Math.cos(yaw), 0, -Math.sin(yaw)), sx = dir * S / Math.sqrt(p.sq), sy = S * p.sq;
  const W = (q: [number, number]) => V(c.p[0], c.p[1], c.p[2]).addScaledVector(right, q[0] * sx).add(V(0, q[1] * sy, 0));
  return {
    head: W(head), top: W(hp(0, topL)), chin: W(hp(0, -ry - 0.01)), cheekL: W(hp(-wHalf, 0)), cheekR: W(hp(wHalf, 0)),
    eyes: W(hp(turn * 0.12 * hk, 0.01)), mouth: W(hp(turn * 0.12 * hk, -0.105 * hk)),
    shoulders: W(add(to, rot(0, SK.SY, tr))), hips: W(to), feet: V(c.p[0], 0, c.p[2]),
    footL: W([-0.1, 0]), footR: W([0.1, 0]), handL: W(hL), handR: W(hR), basket: c.basket ? W([hR[0], hR[1] - 0.34]) : undefined, rx: wHalf * S,
  };
}

// ---------------- subjects ----------------
// 'goldman' etc = character (first of that look in the staging); 'cart:N' = N-th cart; 'hand:who' = right hand (+basket);
// 'arms:who' = head + both hands; 'prop:name' = named set prop; 'pos:x,y,z,r' = literal point.
export const propBox = (k: string, arg: string): [V3, V3] => { const [p, r] = k === 'prop' ? PROPS[arg] : [arg.split(',').slice(0, 3).map(Number) as V3, +arg.split(',')[3]];
  return [p, typeof r === 'number' ? [r, r, r] : r]; };
type Sample = {pts: THREE.Vector3[]; anchor: THREE.Vector3; head?: CharPts; nChar: number};
const cartBox = (c: {p: V3; ry?: number; sc?: number}) => { const r = c.ry ?? 0, o: THREE.Vector3[] = [], k = (c.sc ?? 1) * CART_K;
  for (const x of [-0.33 * k, 0.33 * k]) for (const z of [-0.24 * k, 0.24 * k]) for (const y of [0, 1.05 * k]) o.push(V(c.p[0] + x * Math.cos(r) + z * Math.sin(r), y, c.p[2] - x * Math.sin(r) + z * Math.cos(r)));
  return o; };
export function findPerson(st: ReturnType<typeof stage>, who: string) { return st.people.findIndex((p) => p.who === who); }
/** key points of the subject list at one instant (old frame f) seen from roughly `cam` */
function sampleAt(sub: string[], size: Size, f: number, cam: THREE.Vector3): Sample {
  const st = stage(f), vel = velocities(f, st), pts: THREE.Vector3[] = []; let anchor = V(0, 0, 0), na = 0, head: CharPts | undefined, nChar = 0;
  const big = size === 'FS' || size === 'WS' || size === 'EWS', mid = size === 'MS';
  for (const s of sub) {
    const [k, arg] = s.includes(':') ? s.split(':') : ['char', s];
    if (k === 'char' || k === 'hand' || k === 'arms') {
      const i = findPerson(st, arg); if (i < 0) continue;
      const q = charPts(st.people[i], f, cam, vel[i]);
      { const rc = q.head.clone().sub(cam).cross(UPW); if (q.cheekR.clone().sub(q.cheekL).dot(rc) < 0) { const t = q.cheekL; q.cheekL = q.cheekR; q.cheekR = t; } }   // dir flips mirror the card: keep L/R in camera order so smoothing never collapses the head width
      if (k === 'hand') { pts.push(q.handR.clone().add(V(0, 0.08, 0)), q.handR.clone().add(V(0, -0.06, 0))); if (q.basket) pts.push(q.basket.clone().add(V(0.17, 0, 0)), q.basket.clone().add(V(-0.17, -0.02, 0)));
        const c = q.basket ? q.handR.clone().lerp(q.basket, 0.5) : q.handR; anchor.add(c); na++; continue; }
      nChar++; if (!head) head = q;
      pts.push(q.top, q.chin, q.cheekL, q.cheekR);
      if (k === 'arms') { const S = LOOKS[st.people[i].who].scale ?? 1, r = q.cheekR.clone().sub(q.cheekL).setY(0).normalize();   // gesture box: fixed padding, does not chase waving hands
        pts.push(q.top.clone().addScaledVector(r, 0.55 * S).add(V(0, 0.2 * S, 0)), q.top.clone().addScaledVector(r, -0.55 * S).add(V(0, 0.2 * S, 0)), q.hips.clone().addScaledVector(r, 0.46 * S), q.hips.clone().addScaledVector(r, -0.46 * S)); }
      if (mid && sub.length > 1) pts.push(q.hips);
      if (big) { const S = LOOKS[st.people[i].who].scale ?? 1, r = V(q.cheekR.x - q.cheekL.x, 0, q.cheekR.z - q.cheekL.z).normalize().multiplyScalar(0.3 * S);
        pts.push(q.feet.clone().add(r), q.feet.clone().sub(r), q.hips.clone().add(r), q.hips.clone().sub(r)); }   // stable body box (no swinging hands -> no camera wobble)
      anchor.add(q.head); na++;
    } else if (k === 'car') { const c = st.cars[+arg]; if (!c) continue; const r = c.ry ?? 0;
      for (const x of [-2.1, 2.1]) for (const z of [-0.9, 0.9]) for (const y of [0, 1.66]) pts.push(V(c.p[0] + x * Math.cos(r) + z * Math.sin(r), y, c.p[2] - x * Math.sin(r) + z * Math.cos(r)));
      anchor.add(V(c.p[0], 0.9, c.p[2])); na++;
    } else if (k === 'meter') { const c = st.meters[+arg]; if (!c) continue;
      for (const y of [0, 1.45]) for (const d of [-0.14, 0.14]) pts.push(V(c.p[0] + d, y, c.p[2]), V(c.p[0], y, c.p[2] + d));
      anchor.add(V(c.p[0], 1.0, c.p[2])); na++;
    } else if (k === 'cart') { const c = st.carts[+arg]; if (!c) continue; const b = cartBox(c); pts.push(...b); anchor.add(V(c.p[0], 0.55 * (c.sc ?? 1) * CART_K, c.p[2])); na++; }
    else { const [p, h] = propBox(k, arg);
      for (const d of [[h[0], 0, 0], [-h[0], 0, 0], [0, h[1], 0], [0, -h[1], 0], [0, 0, h[2]], [0, 0, -h[2]]]) pts.push(V(p[0] + d[0], p[1] + d[1], p[2] + d[2]));
      anchor.add(V(...p)); na++; }
  }
  if (na) anchor.multiplyScalar(1 / na);
  return {pts, anchor, head, nChar};
}

// ---------------- the framing solver ----------------
type Rect = [number, number, number, number]; // NDC x0, x1, y0, y1 (y up)
const SINGLE: Partial<Record<Size, [number, number]>> = {ECU: [1.0, 0.95], CU: [0.8, 0.85], MCU: [0.6, 0.8], MS: [0.46, 0.76]};   // head width (frac of frame width), head-box TOP (incl. hat) y = fixed headroom
const RECT_SINGLE_BIG: Partial<Record<Size, Rect>> = {FS: [-0.8, 0.8, -0.8, 0.7], WS: [-0.5, 0.5, -0.62, 0.1], EWS: [-0.3, 0.3, -0.5, -0.1]};
const RECT_GROUP: Record<Size, Rect> = {ECU: [-0.95, 0.95, -0.45, 0.85], CU: [-0.86, 0.86, -0.5, 0.8], MCU: [-0.76, 0.76, -0.45, 0.78], MS: [-0.66, 0.66, -0.6, 0.74],
  FS: [-0.8, 0.8, -0.82, 0.72], WS: [-0.48, 0.48, -0.6, 0.3], EWS: [-0.3, 0.3, -0.45, 0.15]};
function rectFor(size: Size, single: boolean, k: number, sx = 0, sy = 0): Rect {
  let r: Rect;
  if (single && SINGLE[size]) { const [hw, top] = SINGLE[size]!; r = [-hw, hw, top - 6, top]; }
  else r = (single && RECT_SINGLE_BIG[size]) || RECT_GROUP[size];
  if (single && SINGLE[size]) return [r[0] * k + sx, r[1] * k + sx, r[2] + sy, r[3] + sy];   // push = wider head, headroom stays
  const cx = (r[0] + r[1]) / 2 + sx, cy = (r[2] + r[3]) / 2 + sy, hx = (r[1] - r[0]) / 2 * k, hy = (r[3] - r[2]) / 2 * k;
  return [cx - hx, cx + hx, cy - hy, cy + hy];
}
/** gesture framing (head + padded arm box, hips at the bottom edge for MCU) */
const ARMS: Partial<Record<Size, Rect>> = {CU: [-0.97, 0.97, -1.2, 0.9], MCU: [-0.96, 0.96, -1.0, 0.86], MS: [-0.9, 0.9, -0.66, 0.84], FS: [-0.7, 0.7, -0.35, 0.82]};
function rectArms(size: Size, k: number, sx = 0, sy = 0): Rect {
  const r = ARMS[size] ?? RECT_GROUP[size], cx = (r[0] + r[1]) / 2 + sx, cy = (r[2] + r[3]) / 2 + sy, hx = (r[1] - r[0]) / 2 * k, hy = (r[3] - r[2]) / 2 * k;
  return [cx - hx, cx + hx, cy - hy, cy + hy];
}
export type Basis = {fwd: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3};
export const basis = (az: number, el: number): Basis => {
  const u = V(Math.sin(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), Math.cos(az * D2R) * Math.cos(el * D2R));
  const fwd = u.clone().negate(), right = fwd.clone().cross(UPW).normalize(), up = right.clone().cross(fwd);
  return {fwd, right, up};
};
/** camera position that puts the points' bounding box tightly into rect (centred), orientation fixed by the basis */
export function solveFit(pts: THREE.Vector3[], anchor: THREE.Vector3, B: Basis, fov: number, r: Rect, alignTop = false) {
  const Tt = Math.tan(fov * D2R / 2), a = pts.map((p) => { const d = p.clone().sub(anchor); return [d.dot(B.right), d.dot(B.up), d.dot(B.fwd)]; });
  const zmin = Math.min(...a.map((q) => q[2])), zmean = a.reduce((s, q) => s + q[2], 0) / a.length;
  let d = 3, ox = 0, oy = 0;
  for (let it = 0; it < 14; it++) {
    d = Math.max(d, 0.25 - zmin);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const q of a) { const z = q[2] + d, nx = (q[0] - ox) / (z * Tt * ASPECT), ny = (q[1] - oy) / (z * Tt); x0 = Math.min(x0, nx); x1 = Math.max(x1, nx); y0 = Math.min(y0, ny); y1 = Math.max(y1, ny); }
    const s = Math.max((x1 - x0) / (r[1] - r[0]), (y1 - y0) / (r[3] - r[2]));
    const zc = zmean + d;
    ox += ((x0 + x1) / 2 - (r[0] + r[1]) / 2) * zc * Tt * ASPECT; oy += (alignTop ? y1 - r[3] : (y0 + y1) / 2 - (r[2] + r[3]) / 2) * zc * Tt;
    d = (zc * s) - zmean;
  }
  d = Math.max(d, 0.25 - zmin);
  const C = anchor.clone().addScaledVector(B.fwd, -d).addScaledVector(B.right, ox).addScaledVector(B.up, oy);
  return {C, d};
}

// ---------------- setups ----------------
export const CREEP = 2.5, ARC_DRIFT = 5;
const WH = 3 / 30;
const whipAmt = (rt: number) => { for (const w of WHIPS) { const d = rt - w.t;
  if (d >= -WH && d < 0) { const u = (d + WH + 1 / 30) / WH; return {ang: w.s * 0.6 * u * u, blur: 10 * u * u}; }
  if (d >= 0 && d < WH) { const u = 1 - (d + 1 / 30) / WH; return {ang: -w.s * 0.6 * u * u, blur: 10 * u * u}; } } return {ang: 0, blur: 0}; };
export const inWhip = (rt: number) => WHIPS.some((w) => rt >= w.t - WH - 1e-6 && rt < w.t + WH);
export const flashAt = (rt: number) => { for (const x of FLASHES) { const d = Math.floor((rt - x.t) * 30 + 1e-6); if (d >= 0 && d < 4) return x.a * [1, 0.55, 0.25, 0.08][d]; } return 0; };

// ---------------- evaluation ----------------
const DOF: Record<Size, number> = {ECU: 30, CU: 28, MCU: 22, MS: 17, FS: 12, WS: 7, EWS: 3};
const easeF = (k: Setup['ease'] | 'ref', u: number) => { u = cl(u); if (k === 'ref') u = Math.pow(u, 0.8); return k === 'lin' ? u : k === 'out' ? 1 - (1 - u) * (1 - u) : k === 'in' ? u * u : u * u * (3 - 2 * u); };   // 'ref': velocity peak at ~42 % of the move (reference median 40 %)
export type Cam = {p: THREE.Vector3; l: THREE.Vector3; fov: number; roll: number; yaw: number; pitch: number; blur: number; key: string; focus: number; cInf: number; setup: Setup; shot: string; anchor: THREE.Vector3};
// ---- take timeline ----
const t0Of = (t: Take) => (SHOT_REAL[t.name] !== undefined && Math.abs(SHOT_REAL[t.name] - t.keys[0].at) < 1e-6 ? span(t.name)[0] : t.keys[0].at);   // snap to the staging beat's first frame
const TK = TAKES.map((t, i) => ({...t, t0: t0Of(t), t1: i + 1 < TAKES.length ? t0Of(TAKES[i + 1]) : END_REAL + 1 / 30,
  ks: t.keys.map((k, j) => { const ts = j === 0 ? t0Of(t) : k.at - (k.lead ?? 0.15); return {s: j === 0 ? k : {settle: [0, 0.01] as [number, number], ...k}, ts, te: j === 0 ? ts : ts + (k.dur ?? (k.move === 'whip' ? 0.3 : 0.8))}; })}));
const takeAt = (rt: number) => { let i = 0; while (i + 1 < TK.length && TK[i + 1].t0 <= rt + 1e-6) i++; return TK[i]; };
/** where the camera is inside its take: hold on key j, or travelling from key j-1 to key j (u = move progress) */
export function takeState(rt: number) {
  const tk = takeAt(rt); let j = 0; while (j + 1 < tk.ks.length && tk.ks[j + 1].ts <= rt + 1e-6) j++;
  const moving = j > 0 && rt < tk.ks[j].te, u = moving ? (rt - tk.ks[j].ts) / Math.max(1e-3, tk.ks[j].te - tk.ks[j].ts) : 1;
  return {tk, j, moving, u};
}
/** current setup (checker / tools): during a move the key it is travelling to (flagged moving) */
export function setupAt(rt: number) {
  const {tk, j, moving} = takeState(rt), k = tk.ks[j];
  return {shot: tk.name, k: j, s: k.s, t0: k.ts, t1: j + 1 < tk.ks.length ? tk.ks[j + 1].ts : tk.t1, moving};
}
/** hard cuts (take starts) and in-take whips (hidden edits), real seconds */
export const CUTS = TK.slice(1).map((t) => t.t0);
export const WHIP_EDITS = TK.flatMap((t) => t.ks.filter((k) => k.s.move === 'whip').map((k) => (k.ts + k.te) / 2));
/** subject sample smoothed over +-0.2 s (inside the staging beat) -> follows moving subjects without picking up walk bob */
function smoothed(s: Setup, rt: number, shot: string, cam: THREE.Vector3): Sample {
  const [a, b] = span(shot), h = Math.max(0, Math.round((s.track ?? 10) / 2)), W = Array.from({length: 2 * h + 1}, (_, j) => h + 1 - Math.abs(j - h)), need = s.sub.length;
  const ok = (q: Sample) => q.pts.length > 0 && q.nChar + countNon(q, s) >= 1;
  let out: Sample | null = null, ws = 0, n0 = -1;
  W.forEach((w, j) => { const t = cl(rt + (j - h) * (2 / 30), a, b), q = sampleAt(s.sub, s.size, oldF(t), cam);
    if (!ok(q)) return;
    if (!out) { out = {pts: q.pts.map((p) => p.clone().multiplyScalar(w)), anchor: q.anchor.clone().multiplyScalar(w), head: q.head, nChar: q.nChar}; n0 = q.pts.length; ws = w; return; }
    if (q.pts.length !== n0) return;
    q.pts.forEach((p, i) => out!.pts[i].addScaledVector(p, w)); out.anchor.addScaledVector(q.anchor, w); ws += w; });
  if (!out) {   // subject not in this staging beat (a take travelling into / out of the next beat): nearest time it exists, +-2 s
    for (let d = 1 / 30; d < 2; d += 1 / 30) for (const t of [rt + d, rt - d]) { if (t < 0 || t > END_REAL) continue; const q = sampleAt(s.sub, s.size, oldF(t), cam); if (ok(q)) return q; }
    return sampleAt(s.sub, s.size, oldF(rt), cam); }
  const o = out as Sample; o.pts.forEach((p) => p.multiplyScalar(1 / ws)); o.anchor.multiplyScalar(1 / ws); void need; return o;
}
const countNon = (q: Sample, s: Setup) => (s.sub.some((x) => x.includes(':')) ? 1 : 0);
function frameAt(s: Setup, rt: number, u: number, lt: number, shot: string) {
  const e = easeF(s.ease, u);
  const az = s.az + (s.arc ?? (s.pan ? 0 : ARC_DRIFT * (Math.round(s.at * 7) % 2 ? 1 : -1))) * e, el = s.el + (s.crane ?? 0) * e, fov = s.fov + ((s.fov1 ?? s.fov) - s.fov) * e;
  const st = s.settle ?? [0.06, 0.45], ks = 1 - st[0] * (1 - easeF('out', lt / Math.max(0.01, st[1])));
  const k = (1 + Math.min(0.2, ((s.push ?? 1.05) - 1) * (s.sub[0].startsWith('arms:') ? 1 : CREEP)) * e) * ks;   // gesture framings keep their padding
  const B = basis(az, el);
  const smp0 = sampleAt(s.sub, s.size, oldF(rt), V(0, 0, 0)), guess0 = smp0.pts.length ? smp0.anchor : null;
  const smp = smoothed(s, rt, shot, guess0 ? guess0.clone().addScaledVector(B.fwd, -3) : V(0, 1, 12));
  const arms = s.sub.length === 1 && s.sub[0].startsWith('arms:');
  const single = smp.nChar === 1 && s.sub.length === 1 && !arms;
  const r = arms ? rectArms(s.size, k, s.sx ?? 0, s.sy ?? 0) : rectFor(s.size, single, k, s.sx ?? 0, s.sy ?? 0);
  const {C} = solveFit(smp.pts, smp.anchor, B, fov, r, single && !!SINGLE[s.size]);
  return {C, B, fov, anchor: smp.anchor, el, az};
}
const cache = new Map<string, ReturnType<typeof frameAt>>();
export const clearCamCache = () => cache.clear();
type Solved = {p: THREE.Vector3; fwd: THREE.Vector3; fov: number; anchor: THREE.Vector3; az: number; el: number};
/** one key held (no travel): position + aim, incl. its own push creep / arc / tripod pan */
function heldAt(tk: (typeof TK)[number], j: number, rt: number): Solved {
  const k = tk.ks[j], s = k.s, t1 = j + 1 < tk.ks.length ? tk.ks[j + 1].ts : tk.t1, shot = shotAt(oldF(rt)).name;
  const u = (rt - k.ts) / Math.max(1 / 30, t1 - k.ts), lt = rt - k.ts;
  let F = frameAt(s, rt, u, lt, shot);
  let p = F.C.clone(), fwd = F.B.fwd.clone();
  if (s.pan) {   // fixed tripod: position of the key start, re-aimed so the subject keeps the solved screen placement
    const key = tk.name + j; let F0 = cache.get(key); if (!F0) { F0 = frameAt(s, k.ts, 0, 0, shotAt(oldF(k.ts)).name); cache.set(key, F0); }
    const look0 = F0.C.clone().addScaledVector(F0.B.fwd, F0.anchor.clone().sub(F0.C).dot(F0.B.fwd));
    p = F0.C.clone(); fwd = F.anchor.clone().add(look0.sub(F0.anchor)).sub(p).normalize();
    const dS = F.C.distanceTo(F.anchor), dP = p.distanceTo(F.anchor);
    F = {...F, fov: 2 * Math.atan(Math.tan(F.fov * D2R / 2) * dS / dP) / D2R};
  }
  // aim point at the subject's depth (the camera looks along fwd through it)
  const aim = p.clone().addScaledVector(fwd, Math.max(0.3, F.anchor.clone().sub(p).dot(fwd)));
  return {p, fwd, fov: F.fov, anchor: aim, az: F.az, el: F.el};
}
const angLerp = (a: number, b: number, e: number) => { let d = ((b - a) % 360 + 540) % 360 - 180; return a + d * e; };
const dirOf = (az: number, el: number) => basis(az, el).fwd;
/** the camera of a take at real time rt (before operator smoothing) */
function solvedAt(rt: number): Solved & {u: number; moving: boolean; move?: Move; j: number} {
  const {tk, j, moving, u} = takeState(rt);
  const B = heldAt(tk, j, rt);
  if (!moving) return {...B, u: 1, moving, j};
  const A = heldAt(tk, j - 1, rt), s = tk.ks[j].s, mv = s.move ?? 'arc', e = easeF('ref', u);
  const lerpV = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t);
  const dA = A.p.distanceTo(A.anchor), dB = B.p.distanceTo(B.anchor);
  if (mv === 'arc' || mv === 'pullpush') {   // orbit about a travelling aim point
    const az = angLerp(A.az, B.az, e), el = A.el + (B.el - A.el) * e, fwd0 = dirOf(az, el);
    // the held framings may carry operator offsets (pan / sx): blend the actual directions on top of the orbit
    const fA = A.fwd.clone().sub(dirOf(A.az, A.el)), fB = B.fwd.clone().sub(dirOf(B.az, B.el));
    const fwd = fwd0.add(fA.multiplyScalar(1 - e)).add(fB.multiplyScalar(e)).normalize();
    let d = Math.exp(Math.log(dA) + (Math.log(dB) - Math.log(dA)) * e);
    if (mv === 'pullpush') d *= 1 + (s.bump ?? 0.5) * Math.sin(Math.PI * e);
    const aim = lerpV(A.anchor, B.anchor, e);
    return {p: aim.clone().addScaledVector(fwd, -d), fwd, fov: A.fov + (B.fov - A.fov) * e, anchor: aim, az, el, u, moving, move: mv, j};
  }
  // pan / whip: aim leads, position lags; dolly: both together
  const ea = mv === 'dolly' ? e : easeF('ref', u / 0.7), ep = mv === 'dolly' ? e : easeF('io', (u - 0.35) / 0.65);
  const p = lerpV(A.p, B.p, ep), aim = lerpV(A.anchor, B.anchor, ea), fwd = aim.clone().sub(p).normalize();
  return {p, fwd, fov: A.fov + (B.fov - A.fov) * ep, anchor: aim, az: angLerp(A.az, B.az, ea), el: A.el + (B.el - A.el) * ea, u, moving, move: mv, j};
}
export function camAt(rt: number): Cam {
  const {tk, j, moving, u} = takeState(rt), s = tk.ks[j].s;
  const n = moving ? (s.smooth ?? 5) : Math.min(s.smooth ?? 5, (j + 1 < tk.ks.length && tk.ks[j + 1].s.move === 'whip') ? 2 : 5);
  let p = V(0, 0, 0), fwd = V(0, 0, 0), fovS = 0, anchor = V(0, 0, 0), ws = 0;
  for (let q = -n; q <= n; q++) { const t = cl(rt + q / 30, tk.t0, tk.t1 - 1 / 30), w = n + 1 - Math.abs(q), z = solvedAt(t);
    p.addScaledVector(z.p, w); fwd.addScaledVector(z.fwd, w); fovS += z.fov * w; anchor.addScaledVector(z.anchor, w); ws += w; }
  p.multiplyScalar(1 / ws); fwd.normalize(); anchor.multiplyScalar(1 / ws);
  const F = {fov: fovS / ws, anchor};
  const l = p.clone().addScaledVector(fwd, 10);
  const roll = ((s.roll ?? 0) + ((s.roll1 ?? s.roll ?? 0) - (s.roll ?? 0)) * easeF(s.ease, moving ? 0 : 1)) * D2R;
  // micro drift (reference: no handheld jitter), kicks on hits only
  let yaw = 0.0009 * Math.sin(rt * 2 * Math.PI / 5.3), pitch = 0.0007 * Math.sin(rt * 2 * Math.PI / 6.1 + 1), fz = 1;
  const Tt = Math.tan(F.fov * D2R / 2);
  for (const q of KICKS) { const d = (rt - q.t) * 30; if (d < 0 || d > 9) continue; const dec = Math.exp(-d / 2.6);
    pitch += Math.sin(d * 2.3) * q.a * (8 / 960) * Tt * dec; yaw += Math.sin(d * 1.9 + 1) * q.a * (4 / 960) * Tt * dec; fz *= 1 - q.z * dec; }
  const w = whipAmt(rt); yaw += w.ang;
  const mb = moving && s.move === 'whip' ? (s.blur ?? 9) * Math.sin(Math.PI * u) ** 2 : 0;   // in-take whip pan: motion blur
  const focus = Math.max(0.3, F.anchor.clone().sub(p).dot(fwd));
  const prev = tk.ks[Math.max(0, j - 1)].s, cInf = moving ? (prev.dof ?? DOF[prev.size]) + ((s.dof ?? DOF[s.size]) - (prev.dof ?? DOF[prev.size])) * easeF('ref', u) : (s.dof ?? DOF[s.size]);
  return {p, l, fov: F.fov * fz, roll, yaw, pitch, blur: Math.max(w.blur, mb), key: tk.name + j + (moving ? '~' : ''), focus, cInf, setup: s, shot: tk.name, anchor: F.anchor};
}
/** apply to a three camera (used by the Rig and by the framing checker, so both see the same image) */
export function applyCam(camera: THREE.PerspectiveCamera, c: Cam) {
  camera.position.copy(c.p); camera.up.set(0, 1, 0); camera.lookAt(c.l); camera.rotateZ(c.roll); camera.rotateY(c.yaw); camera.rotateX(c.pitch);
  camera.fov = c.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
export {TOTAL};
/** legacy view (tools): take name -> keys */
export const SETUPS: Record<string, Setup[]> = Object.fromEntries(TAKES.map((t) => [t.name, t.keys]));
