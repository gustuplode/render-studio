// ENGINE core/staging: generic staging helpers (paths, cars on paths, seats, auto gaze, velocities).
// The story's stage(f) lives in '@story/stage' and uses these.
import * as THREE from 'three';
import {shotAt, TOTAL, sm01, type V3} from './clock';
import type {PersonP} from '../chars/rig';
import {LEG_DROP} from '../chars/charparts';
import type {CarP, MeterP} from '../kits/downtown/street';
import {stage} from '@story/stage';

/** car path: list of [frame, x, z] keys; V3 motion graphs — BOTH axes run a smootherstep
 *  profile between keys (accelerate out of a key, decelerate into the next), so cars never
 *  glide at constant speed; yaw follows the path tangent (front = (cos ry, -sin ry)) */
export type Key = [number, number, number];
const smoother = (u: number) => { u = Math.min(1, Math.max(0, u)); return u * u * u * (u * (u * 6 - 15) + 10); };
export function pathAt(keys: Key[], lf: number): [number, number] {
  if (lf <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) if (lf <= keys[i][0]) { const [a, x0, z0] = keys[i - 1], [b, x1, z1] = keys[i], u = smoother((lf - a) / (b - a));
    return [x0 + (x1 - x0) * u, z0 + (z1 - z0) * u]; }
  const k = keys[keys.length - 1]; return [k[1], k[2]];
}
export function carOn(keys: Key[], lf: number, col: string, base = Math.PI, driver?: string): CarP {
  const [x, z] = pathAt(keys, lf), [x2, z2] = pathAt(keys, lf + 1), [xb, zb] = pathAt(keys, lf - 1), dx = x2 - xb, dz = z2 - zb, mv = Math.hypot(dx, dz) > 1e-4;
  let ry = mv ? Math.atan2(-dz, dx) : base; if (mv && Math.cos(ry - base) < 0) ry += Math.PI;   // reversing keeps the nose
  let d = 0, px = keys[0][1], pz = keys[0][2]; for (let f = keys[0][0] + 1; f <= Math.min(lf, keys[keys.length - 1][0]); f++) { const q = pathAt(keys, f); d += Math.hypot(q[0] - px, q[1] - pz); px = q[0]; pz = q[1]; }
  // V3 body pitch from the speed change: braking dives the nose, acceleration lifts it
  const sp = (g: number) => { const [ax, az] = pathAt(keys, g), [bx, bz] = pathAt(keys, g + 1); return Math.hypot(bx - ax, bz - az); };
  const pitch = Math.max(-0.055, Math.min(0.04, (sp(lf - 3) - sp(lf + 3)) * 1.5));
  return {p: [x, 0, z], ry, col, spin: d / 0.36, driver, pitch};
}
/** driver seat in world coordinates for a car pose (driver on the left = street side for a -x heading car) */
export const SEAT_Y = -0.07 + LEG_DROP;
export const seatOf = (c: CarP, side = 1): V3 => { const r = c.ry ?? 0, lx = -0.25, lz = -0.3 * side; return [c.p[0] + lx * Math.cos(r) + lz * Math.sin(r), SEAT_Y, c.p[2] - lx * Math.sin(r) + lz * Math.cos(r)]; };

/** story people without an explicit gaze look at the nearest scene partner (<= 4 m), else a meter close by (<= 2.5 m);
 *  people in cars and background walkers keep the rig default (off-centre resting turn). */
export function autoGaze(P: PersonP[], Mt: MeterP[]) {
  P.forEach((a) => {
    if (a.gaze || a.bg || a.inCar || a.look !== undefined) return;
    let best: V3 | undefined, bd = 4;
    for (const b of P) { if (b === a || b.bg) continue; const d = Math.hypot(b.p[0] - a.p[0], b.p[2] - a.p[2]); if (d < bd) { bd = d; best = [b.p[0], 1, b.p[2]]; } }
    if (!best) for (const m of Mt) { const d = Math.hypot(m.p[0] - a.p[0], m.p[2] - a.p[2]); if (d < Math.min(bd, 2.5)) { bd = d; best = [m.p[0], 1, m.p[2]]; } }
    if (best) a.gaze = best;
  });
}
export type Stage = ReturnType<typeof stage>;
/** per-person velocity (m/frame) from the neighbouring frame of the same shot -> walk direction / view choice */
export function velocities(f: number, st: Stage) {
  const name = shotAt(f).name, nf = shotAt(f + 1).name === name && f + 1 < TOTAL ? f + 1 : f - 1, o = stage(nf), sgn = nf > f ? 1 : -1;
  return st.people.map((p, i) => { const q = o.people[i]; if (!q || q.who !== p.who) return null;
    const v = new THREE.Vector3((q.p[0] - p.p[0]) * sgn, 0, (q.p[2] - p.p[2]) * sgn); return v.length() > 1 ? new THREE.Vector3() : v; });
}
export {stage};
