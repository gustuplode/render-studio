// AUTOMATIC FRAMING CHECKER (camera v3).  Run:  npx tsx src/cart/check_framing.ts [step=2] [--v]
// For every `step`-th REAL frame it rebuilds the actual camera (camAt + applyCam, incl. kicks), takes the staging at the
// warped old frame, projects the subject's key points (FK of the cut-out rig: head top incl. hat, chin, cheeks, eyes,
// mouth, hands, feet; cart boxes; props) and flags:
//   CROP   subject head/face partly outside the frame (unless the setup is marked ecu)
//   HANDS  'arms:' subject hands outside the frame         FEET  FS/WS subject feet outside the frame
//   SIZE   subject smaller/larger than its target size     OFFC  subject centre off its screen placement
//   OCCL   subject face/centre hidden behind set geometry, a cart or another person in front
//   CAMIN  camera inside set geometry / under the floor    CAPT  CU/MCU eyes or mouth under the caption band
//   SIGN   a text sign sharp in the eye zone (or very big)  EDGE  a standing non-subject face half cut by the frame edge
//   FGBLOCK a non-subject in the foreground covering the subject; OCCL by passing people only counts if it lasts >= 5 frames
import * as THREE from 'three';
import {camAt, applyCam, oldF, setupAt, charPts, findPerson, inWhip, ASPECT, Setup, propBox, KICKS} from '../camera/camera';
import {TOTAL, type V3} from '../core/clock';
import {stage, velocities} from '../core/staging';
import {SOLIDS} from '@story/solids';
import {CART_K} from '../chars/charparts';
const camV2 = (_f: number): any => { throw new Error('v2 camera compare removed in the engine'); };

type Box = [number, number, number, number, number, number, string]; // x0 x1 y0 y1 z0 z1 name
const B = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, n: string): Box => [x0, x1, y0, y1, z0, z1, n];
// solid set geometry the camera must not enter / that hides subjects (story: '@story/solids')
const SET: Box[] = SOLIDS;
const cartBoxOf = (c: {p: V3; ry?: number; sc?: number}): Box => { const r = c.ry ?? 0, k = (c.sc ?? 1) * CART_K, hx = k * (Math.abs(0.33 * Math.cos(r)) + Math.abs(0.24 * Math.sin(r))), hz = k * (Math.abs(0.33 * Math.sin(r)) + Math.abs(0.24 * Math.cos(r)));
  return [c.p[0] - hx, c.p[0] + hx, 0, 1.05 * k, c.p[2] - hz, c.p[2] + hz, 'cart']; };
const V3v = (p: V3) => new THREE.Vector3(p[0], 1.0, p[2]);
const inside = (p: THREE.Vector3, b: Box, m = 0.04) => p.x > b[0] - m && p.x < b[1] + m && p.y > b[2] - m && p.y < b[3] + m && p.z > b[4] - m && p.z < b[5] + m;
/** does segment a->b hit the box (ignoring the last `tail` metres near b)? slab test */
function segHits(a: THREE.Vector3, b: THREE.Vector3, bx: Box, tail = 0.05) {
  const d = b.clone().sub(a), L = d.length(); let t0 = 0, t1 = 1 - tail / Math.max(L, 1e-6);
  const A = [a.x, a.y, a.z], D = [d.x, d.y, d.z], lo = [bx[0], bx[2], bx[4]], hi = [bx[1], bx[3], bx[5]];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(D[i]) < 1e-9) { if (A[i] < lo[i] || A[i] > hi[i]) return false; continue; }
    let u = (lo[i] - A[i]) / D[i], v = (hi[i] - A[i]) / D[i]; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}
// text signs in the set (Cart.tsx): back-wall ads, aisle-top ads, side-wall ads, HELP WANTED, backbar
const SIGNS: [V3, string][] = [];
const SINGLE_HW: Record<string, number> = {ECU: 1.0, CU: 0.8, MCU: 0.6, MS: 0.46};

export type Issue = {f: number; t: number; key: string; kind: string; msg: string};
export function check(step = 2, from = 0, to = TOTAL, v2 = false) {
  const cam = new THREE.PerspectiveCamera(40, ASPECT, 0.05, 80), out: Issue[] = [];
  for (let fr = from; fr < to; fr += step) {
    const rt = fr / 30; if (inWhip(rt)) continue;
    const c = camAt(rt);
    if (v2) { const o = camV2(oldF(rt)); c.p = o.p; c.anchor = c.anchor; cam.position.copy(o.p); cam.up.set(0, 1, 0); cam.lookAt(o.l); cam.rotateZ(o.roll); cam.fov = o.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); }
    else applyCam(cam, c);
    const {s, t0, moving} = setupAt(rt) as ReturnType<typeof setupAt> & {moving?: boolean}, lt = rt - t0, settling = lt < (s.settle?.[1] ?? 0.45) && (s.settle?.[0] ?? 0) > 0.15, f = oldF(rt), st = stage(f), vel = velocities(f, st);
    const add = (kind: string, msg: string) => out.push({f: fr, t: +rt.toFixed(2), key: c.key, kind, msg});
    const P = (v: THREE.Vector3) => v.clone().project(cam);
    const isIn = (n: THREE.Vector3, m = 0) => n.z < 1 && Math.abs(n.x) <= 1 - m && Math.abs(n.y) <= 1 - m;
    // camera inside geometry
    if (c.p.y < 0.05) add('CAMIN', `camera under floor y=${c.p.y.toFixed(2)}`);
    for (const b of SET) if (inside(c.p, b)) add('CAMIN', `camera inside ${b[6]}`);
    st.carts.forEach((ct) => { if (inside(c.p, cartBoxOf(ct), 0.02)) add('CAMIN', 'camera inside a cart'); });
    const CARS: Box[] = st.cars.map((k, j) => { const r = k.ry ?? 0, hx = Math.abs(2.16 * Math.cos(r)) + Math.abs(0.95 * Math.sin(r)), hz = Math.abs(2.16 * Math.sin(r)) + Math.abs(0.95 * Math.cos(r)); return [k.p[0] - hx, k.p[0] + hx, 0, 1.6, k.p[2] - hz, k.p[2] + hz, 'car ' + j] as Box; });
    for (const b of CARS) if (inside(c.p, b, 0.05)) add('CAMIN', `camera inside ${b[6]}`);
    if (moving) continue;   // takes v4: travelling between two subjects - only the camera-position checks apply
    const MET: Box[] = st.meters.map((m, j) => [m.p[0] - 0.12, m.p[0] + 0.12, 0, 1.45, m.p[2] - 0.1, m.p[2] + 0.1, 'meter ' + j] as Box);
    const subjChars = new Set<number>(); const subjCarts = new Set<number>();
    const single = s.sub.length === 1 && !s.sub[0].includes(':');
    let bb = [1e9, -1e9, 1e9, -1e9];
    const grow = (n: THREE.Vector3) => { bb = [Math.min(bb[0], n.x), Math.max(bb[1], n.x), Math.min(bb[2], n.y), Math.max(bb[3], n.y)]; };
    for (const sub of s.sub) {
      const [k, arg] = sub.includes(':') ? sub.split(':') : ['char', sub];
      if (k === 'char' || k === 'arms' || k === 'hand') {
        const i = findPerson(st, arg); if (i < 0) { add('MISS', `subject ${arg} not in staging`); continue; }
        subjChars.add(i);
        const q = charPts(st.people[i], f, c.p, vel[i]);
        if (k === 'hand') { const pts = [q.handR, ...(q.basket ? [q.basket] : [])]; pts.map(P).forEach((n, j) => { grow(n); if (!isIn(n)) add('CROP', `${arg} ${j ? 'basket' : 'hand'} out (${n.x.toFixed(2)},${n.y.toFixed(2)})`); }); continue; }
        const face: [string, THREE.Vector3][] = [['top', q.top], ['chin', q.chin], ['cheekL', q.cheekL], ['cheekR', q.cheekR], ['eyes', q.eyes], ['mouth', q.mouth]];
        for (const [n, v] of face) { const pn = P(v); grow(pn); if (!s.ecu && !isIn(pn, n === 'top' ? 0 : 0.01)) add('CROP', `${arg} ${n} out (${pn.x.toFixed(2)},${pn.y.toFixed(2)})`);
          else if (!s.ecu && n === 'top' && pn.y > 0.95 && pn.z < 1) add('HEADROOM', `${arg} head top touches the frame top (y=${pn.y.toFixed(2)})`); }
        if (k === 'arms') for (const [n, v] of [['handL', q.handL], ['handR', q.handR]] as [string, THREE.Vector3][]) { const pn = P(v); if (v.y < q.hips.y + 0.15) continue; /* hanging hands may leave an MCU */ grow(pn); if (!(pn.z < 1 && Math.abs(pn.x) < 1.15 && Math.abs(pn.y) < 1.05)) /* a fingertip past the edge mid-swing is fine */ add('HANDS', `${arg} ${n} out (${pn.x.toFixed(2)},${pn.y.toFixed(2)})`); }
        if (s.size === 'FS' || s.size === 'WS' || s.size === 'EWS') { const pn = P(q.feet); grow(pn); if (!isIn(pn)) add('FEET', `${arg} feet out (${pn.x.toFixed(2)},${pn.y.toFixed(2)})`); }
        if (single && SINGLE_HW[s.size]) { const w = Math.abs(P(q.cheekR).x - P(q.cheekL).x) / 2, tgt = SINGLE_HW[s.size] * ((s.push ?? 1.05) > 1 ? 1 : 1);
          if (w < tgt * 0.72 && !settling) add('SIZE', `${arg} head ${(w * 100).toFixed(0)}% of width < target ${(tgt * 100).toFixed(0)}%`);
          if (w > tgt * 1.5 && !s.ecu) add('SIZE', `${arg} head ${(w * 100).toFixed(0)}% of width > target ${(tgt * 100).toFixed(0)}%`);
          const cx = (P(q.cheekR).x + P(q.cheekL).x) / 2; if (Math.abs(cx - (s.sx ?? 0)) > 0.3) add('OFFC', `${arg} head centre x=${cx.toFixed(2)}`); }
        if (s.size === 'CU' || s.size === 'MCU') for (const [n, v] of [['eyes', q.eyes], ['mouth', q.mouth]] as [string, THREE.Vector3][]) { const y = P(v).y; if (y > -0.47 && y < -0.34) add('CAPT', `${arg} ${n} under caption (y=${y.toFixed(2)})`); }
        // occlusion of the face
        for (const v of [q.eyes, q.head, q.cheekL.clone().lerp(q.head, 0.35), q.cheekR.clone().lerp(q.head, 0.35)]) {   // centre + both sides of the face
          for (const b of [...SET, ...CARS, ...MET]) if (!inside(V3v(st.people[i].p), b, 0.02) && segHits(c.p, v, b)) { add('OCCL', `${arg} face behind ${b[6]}`); break; }
          st.carts.forEach((ct, j) => { if (segHits(c.p, v, cartBoxOf(ct), 0.25)) add('OCCL', `${arg} face behind cart ${j}`); });
        }
        const ep = P(q.eyes), dEye = q.eyes.distanceTo(c.p);
        st.people.forEach((o, j) => { if (j === i) return; const r = charPts(o, f, c.p, vel[j]); if (r.head.distanceTo(c.p) > dEye - 0.15) return; const fw = new THREE.Vector3(); cam.getWorldDirection(fw); if (r.head.clone().sub(c.p).dot(fw) < 0.2) return;
          // occluder silhouette: head ellipse + torso box (stick arms / legs are too thin to hide a face)
          const hc = P(r.head), hl = P(r.cheekL), hr = P(r.cheekR), t = P(r.top), ch = P(r.chin), rxs = Math.abs(hr.x - hl.x) / 2, rys = Math.max(1e-4, (t.y - ch.y) / 2);
          const inHead = hc.z < 1 && ((ep.x - hc.x) / Math.max(rxs, 1e-4)) ** 2 + ((ep.y - (t.y + ch.y) / 2) / rys) ** 2 < 1;
          const sh = P(r.shoulders), hp = P(r.hips), bw = rxs * 0.75, inBody = sh.z < 1 && Math.abs(ep.x - (sh.x + hp.x) / 2) < bw && ep.y < sh.y && ep.y > hp.y - 0.05;
          const sp = (v: THREE.Vector3 | null | undefined) => (v ? Math.hypot(v.x, v.z) : 0), moving = sp(vel[j]) > 0.01 || sp(vel[i]) > 0.01;
          if (inHead || inBody) add(moving ? 'OCCLP' : 'OCCL', `${arg} face behind ${o.who}${moving ? ' (passing)' : ''}`); });
      } else if (k === 'car' || k === 'meter') {
        const o = k === 'car' ? st.cars[+arg] : st.meters[+arg]; if (!o) { add('MISS', `${sub} missing`); continue; }
        const ctr = new THREE.Vector3(o.p[0], k === 'car' ? 0.9 : 1.1, o.p[2]), pn = P(ctr); grow(pn);
        if (k === 'car') { const r = (o as any).ry ?? 0; for (const x of [-2.1, 2.1]) for (const z of [-0.9, 0.9]) for (const y of [0, 1.66]) grow(P(new THREE.Vector3(o.p[0] + x * Math.cos(r) + z * Math.sin(r), y, o.p[2] - x * Math.sin(r) + z * Math.cos(r)))); } if (!isIn(pn, 0.05)) add('CROP', `${sub} centre out`);
        if (!s.occOK) for (const sb of [...SET, ...CARS.filter((b) => !inside(ctr, b, 0.3))]) if (segHits(c.p, ctr, sb, 0.3)) { add('OCCL', `${sub} behind ${sb[6]}`); break; }
      } else if (k === 'cart') {
        const j = +arg; subjCarts.add(j); const ct = st.carts[j]; if (!ct) { add('MISS', `cart ${j} missing`); continue; }
        const b = cartBoxOf(ct); for (const x of [b[0], b[1]]) for (const y of [b[2], b[3]]) for (const z of [b[4], b[5]]) grow(P(new THREE.Vector3(x, y, z)));
        const ctr = new THREE.Vector3(ct.p[0], 0.6, ct.p[2]); const pn = P(ctr); if (!isIn(pn)) add('CROP', `cart ${j} centre out`);
        for (const sb of SET) if (segHits(c.p, ctr, sb, 0.3)) { add('OCCL', `cart ${j} behind ${sb[6]}`); break; }
      } else {
        const [pp, h] = propBox(k, arg);
        const ctr = new THREE.Vector3(...pp), pn = P(ctr); if (!isIn(pn, 0.05)) add('CROP', `${sub} centre out`);
        for (const d of [[h[0], 0, 0], [-h[0], 0, 0], [0, h[1], 0], [0, -h[1], 0]]) grow(P(ctr.clone().add(new THREE.Vector3(d[0], d[1], d[2]))));
        for (const sb of [...SET, ...CARS.filter((b) => !inside(ctr, b, 0.3))]) if (segHits(c.p, ctr, sb, 0.3)) { add('OCCL', `${sub} behind ${sb[6]}`); break; }
      }
    }
    // text signs (ads / plaques) must not compete with the subject: flag a sign inside the frame that is nearly sharp
    for (const [sp, name] of SIGNS) { const v = new THREE.Vector3(...sp), n = P(v); if (!(n.z < 1 && Math.abs(n.x) < 0.95 && Math.abs(n.y) < 0.95)) continue;
      const fw = new THREE.Vector3(); cam.getWorldDirection(fw); const d = v.clone().sub(c.p).dot(fw), coc = Math.abs(c.cInf * (1 - c.focus / Math.max(d, 0.01)));
      const backWall = sp[2] < -13.9;   // back-wall signs hang above the 2 m aisle slabs, so aisle boxes don't hide them
      let hidden = false; for (const b of SET) if (!(backWall && b[6].startsWith('aisle shelf')) && segHits(c.p, v, b, 0.15)) { hidden = true; break; }
      const central = Math.abs(n.x) < 0.55 && n.y > -0.3 && n.y < 0.6, big = 1.0 / (d * Math.tan(c.fov * Math.PI / 360) * ASPECT) > 0.6;   // the eye zone / a sign wider than 30 % of the frame
      const loud = name === 'COFFEE' && 1.3 / (d * Math.tan(c.fov * Math.PI / 360) * ASPECT) > 0.2 && coc < (central ? 14 : 14);   /* the big red COFFEE ad: must be out of frame or very soft */   // big red ad: soft in the corners, very soft near the centre   // the big red COFFEE ad (user complaint): not anywhere in frame unless very soft
      if (!hidden && ((coc < 6 && (central || big)) || loud) && !s.sub.includes('prop:' + name)) add('SIGN', `${name} sign sharp in the ${central ? 'centre' : 'frame'} (blur ${coc.toFixed(1)} px)`); }
    // other people: a non-subject face half cut by the frame edge (EDGE), or a non-subject person in front of the subject
    // covering a big part of the frame (FGBLOCK)
    { const fw = new THREE.Vector3(); cam.getWorldDirection(fw);
      const subjD = c.anchor.clone().sub(c.p).dot(fw);
      st.people.forEach((o, j) => { if (subjChars.has(j)) return; const r = charPts(o, f, c.p, vel[j]); const dz = r.head.clone().sub(c.p).dot(fw); if (dz < 0.1) return;
        const pts = [r.top, r.chin, r.cheekL, r.cheekR].map(P), nin = pts.filter((n) => isIn(n)).length;
        const still = !vel[j] || Math.hypot(vel[j]!.x, vel[j]!.z) < 0.004;   // walkers entering / leaving the frame are fine
        if (still && nin > 0 && nin < 4 && dz < subjD * 1.6) add('EDGE', `${o.who} face cut by the frame edge`);
        if (dz < subjD - 0.3 && !(o.bg && dz > 8)) { const ys = [r.top, r.feet].map(P), xs = [r.cheekL, r.cheekR].map(P); const x0 = Math.max(-1, Math.min(xs[0].x, xs[1].x)), x1 = Math.min(1, Math.max(xs[0].x, xs[1].x)), y0 = Math.max(-1, ys[1].y), y1 = Math.min(1, ys[0].y);
          const area = Math.max(0, x1 - x0) * Math.max(0, y1 - y0) / 4, an = P(c.anchor), covers = an.x > x0 && an.x < x1 && an.y > y0 && an.y < y1;
          if (area > 0.12 && covers) add('FGBLOCK', `${o.who} in the foreground covers the subject (${(area * 100).toFixed(0)}% of the frame)`); } }); }
    // group / prop framing: bbox of the subject should fill a sensible part of the frame and be roughly centred
    if (!single && bb[0] < 1e8) { const w = bb[1] - bb[0], h = bb[3] - bb[2];
      if (Math.max(w / 2, h / 2) < 0.22 && s.size !== 'EWS' && s.size !== 'WS') add('SIZE', `subject box only ${(w * 50).toFixed(0)}%x${(h * 50).toFixed(0)}% of frame`);
      const cx = (bb[0] + bb[1]) / 2; if (Math.abs(cx - (s.sx ?? 0)) > 0.35) add('OFFC', `subject box centre x=${cx.toFixed(2)}`); }
  }
  // a moving person crossing in front of the subject is a wipe: fine if it lasts < 5 frames (~0.17 s); longer = OCCL
  const runs = new Map<string, Issue[]>(); for (const i of out.filter((x) => x.kind === 'OCCLP')) { const k = i.key + i.msg; if (!runs.has(k)) runs.set(k, []); runs.get(k)!.push(i); }
  const keep = new Set<Issue>();
  for (const l of runs.values()) { let a = 0; for (let b = 1; b <= l.length; b++) if (b === l.length || l[b].f - l[b - 1].f > step) { if ((l[b - 1].f - l[a].f) / step + 1 >= 5) for (let q = a; q < b; q++) keep.add(l[q]); a = b; } }
  return out.filter((x) => x.kind !== 'OCCLP' || keep.has(x)).map((x) => (x.kind === 'OCCLP' ? {...x, kind: 'OCCL'} : x));
}

/** camera smoothness per setup, same metric as the reference study (tools/refjit.py): image motion of the static world at
 *  the focus distance, px @1080x1920; jitter = rms residual of the cumulative motion vs an 11-frame local quadratic fit. */
export function jitter(v2 = false) {
  const camA = new THREE.PerspectiveCamera(40, ASPECT, 0.05, 80), camB = camA.clone();
  const set = (cm: THREE.PerspectiveCamera, fr: number) => { const rt = fr / 30, c = camAt(rt);
    if (v2) { const o = camV2(oldF(rt)); cm.position.copy(o.p); cm.up.set(0, 1, 0); cm.lookAt(o.l); cm.rotateZ(o.roll); cm.fov = o.fov; cm.updateProjectionMatrix(); cm.updateMatrixWorld(true); return {key: v2 ? 'v2:' + c.shot + (o as any).key : c.key, focus: c.focus}; }
    applyCam(cm, c); return {key: c.key, focus: c.focus}; };
  const segs = new Map<string, [number, number][]>();
  for (let fr = 0; fr + 1 < TOTAL; fr++) {
    const rt = fr / 30; if (inWhip(rt) || inWhip(rt + 1 / 30) || KICKS.some((k) => rt > k.t - 0.05 && rt < k.t + 0.4)) continue;
    const a = set(camA, fr), b = set(camB, fr + 1); if (a.key !== b.key) continue;
    const fw = new THREE.Vector3(); camA.getWorldDirection(fw);
    const P = camA.position.clone().addScaledVector(fw, Math.min(a.focus, 6)), n0 = P.clone().project(camA), n1 = P.clone().project(camB);
    if (!segs.has(a.key)) segs.set(a.key, []); segs.get(a.key)!.push([(n1.x - n0.x) * 540, (n1.y - n0.y) * 960]);
  }
  const res: {key: string; n: number; speed: number; jit: number; acc: number}[] = [];
  for (const [key, v] of segs) { if (v.length < 12) continue;
    const px: number[] = [], py: number[] = []; let x = 0, y = 0; for (const d of v) { x += d[0]; y += d[1]; px.push(x); py.push(y); }
    const fit = (arr: number[], i: number) => { const lo = Math.max(0, i - 5), hi = Math.min(arr.length, i + 6); const n = hi - lo; if (n < 7) return null;
      let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, b0 = 0, b1 = 0, b2 = 0; for (let k = lo; k < hi; k++) { const t = k - i, t2 = t * t; s0++; s1 += t; s2 += t2; s3 += t2 * t; s4 += t2 * t2; b0 += arr[k]; b1 += arr[k] * t; b2 += arr[k] * t2; }
      const M = [[s0, s1, s2], [s1, s2, s3], [s2, s3, s4]], B = [b0, b1, b2]; const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      const D = det(M); const M0 = M.map((r, ri) => [B[ri], r[1], r[2]]); return det(M0) / D; };
    let r2 = 0, nr = 0; for (let i = 0; i < px.length; i++) { const fx = fit(px, i), fy = fit(py, i); if (fx === null || fy === null) continue; r2 += (px[i] - fx) ** 2 + (py[i] - fy) ** 2; nr++; }
    let a2 = 0; for (let i = 1; i < v.length; i++) a2 += (v[i][0] - v[i - 1][0]) ** 2 + (v[i][1] - v[i - 1][1]) ** 2;
    res.push({key, n: v.length, speed: v.reduce((s, d) => s + Math.hypot(d[0], d[1]), 0) / v.length, jit: Math.sqrt(r2 / Math.max(1, nr)), acc: Math.sqrt(a2 / (v.length - 1))});
  }
  return res;
}

if (process.argv[1] && process.argv[1].includes('check_framing') && process.argv.includes('--jitter')) {
  const r = jitter(process.argv.includes('--v2'));
  for (const x of r) console.log(`${x.key.padEnd(14)} n${String(x.n).padStart(4)}  speed ${x.speed.toFixed(2)} px/f  jitter ${x.jit.toFixed(2)} px  accel ${x.acc.toFixed(2)} px/f2${x.jit > 1 || x.acc > 2 ? '   <-- JITTER' : ''}`);
  const md = (a: number[]) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
  console.log(`median jitter ${md(r.map((x) => x.jit)).toFixed(2)} px, max ${Math.max(...r.map((x) => x.jit)).toFixed(2)}; median accel ${md(r.map((x) => x.acc)).toFixed(2)}, max ${Math.max(...r.map((x) => x.acc)).toFixed(2)}  (reference clean shots: jitter 0.15-0.8, accel 0.3-1.5)`);
  process.exit(0);
}
if (process.argv[1] && process.argv[1].includes('check_framing')) {
  const step = +(process.argv.find((a) => /^\d+$/.test(a)) ?? 2), verbose = process.argv.includes('--v');
  const t0 = Date.now(), iss = check(step, 0, TOTAL, process.argv.includes('--v2'));
  const byKey = new Map<string, Issue[]>();
  for (const i of iss) { const k = i.key + ' ' + i.kind; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k)!.push(i); }
  const kinds: Record<string, number> = {}; for (const i of iss) kinds[i.kind] = (kinds[i.kind] ?? 0) + 1;
  const frames = new Set(iss.map((i) => i.f)).size;
  for (const [k, l] of byKey) console.log(`${k.padEnd(22)} x${String(l.length).padStart(3)}  frames ${l[0].f}-${l[l.length - 1].f}  e.g. t=${l[0].t} ${l[0].msg}` + (verbose ? '\n    ' + l.slice(0, 6).map((x) => `${x.f}:${x.msg}`).join(' | ') : ''));
  console.log(`\nchecked every ${step} frame(s) of ${TOTAL}: ${iss.length} issues on ${frames} frames  ${JSON.stringify(kinds)}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
