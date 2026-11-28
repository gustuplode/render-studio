// FX — round-2 hook VFX, all keyed to the STAGING clock (f = old frame) so the speed-graph
// warp places them on the right real frames automatically. Kit grammar: flat shapes, soft
// alpha, no textures beyond a canvas radial puff. Contents:
//   DustBurst  — expanding tan dust discs (brake-lock, prop landings)
//   ShockRing  — ground shockwave ring(s) from a point (the full stop)
//   Streaks    — white speed lines trailing the fast story cars (speed read from staging)
// Events per variant are listed in Fx below; STOPF = the staging frame of "stopped".
import React from 'react';
import * as THREE from 'three';
import {cl} from '../../engine/core/clock';
import type {V3} from '../../engine/core/clock';
import {stage} from './stage';
import {STOPF} from './timeline';
import {VARIANT} from './variant';

const circ = new THREE.CircleGeometry(1, 24), ring = new THREE.RingGeometry(0.93, 1.0, 56), plane = new THREE.PlaneGeometry(1, 1);
const hash = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const dustMat = (o: number) => new THREE.MeshBasicMaterial({color: '#d9c9a3', transparent: true, opacity: o, depthWrite: false});
const ringMat = (o: number) => new THREE.MeshBasicMaterial({color: '#fff6e0', transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide});
const streakMat = (o: number) => new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide});

export const DustBurst: React.FC<{p: V3; f: number; t0: number; dur?: number; n?: number; r?: number; seed?: number}> =
  ({p, f, t0, dur = 14, n = 6, r = 0.9, seed = 0}) => {
    const u = (f - t0) / dur; if (u < 0 || u >= 1) return null;
    const e = 1 - Math.pow(1 - u, 2);
    return (<>
      {Array.from({length: n}, (_, i) => {
        const a = (i / n) * Math.PI * 2 + hash(i, seed) * 0.8, d = r * (0.25 + 0.75 * e) * (0.65 + 0.5 * hash(i, seed + 1));
        const sc = 0.22 + 0.85 * e * (0.7 + 0.5 * hash(i, seed + 2));
        return <mesh key={i} geometry={circ} material={dustMat((1 - u) * 0.5)} rotation={[-Math.PI / 2, 0, 0]}
          position={[p[0] + Math.cos(a) * d, 0.035 + 0.1 * u * hash(i, seed + 3), p[2] + Math.sin(a) * d]} scale={[sc, sc * 0.8, 1]} />;
      })}
      <mesh geometry={circ} material={dustMat((1 - u) * 0.4)} rotation={[-Math.PI / 2, 0, 0]} position={[p[0], 0.03, p[2]]} scale={[0.4 + 1.1 * e, (0.4 + 1.1 * e) * 0.8, 1]} />
    </>);
  };

export const ShockRing: React.FC<{p: V3; f: number; t0: number; dur?: number; max?: number; delay?: number}> =
  ({p, f, t0, dur = 18, max = 6, delay = 0}) => {
    const u = (f - t0 - delay) / dur; if (u < 0 || u >= 1) return null;
    const e = 1 - Math.pow(1 - u, 3), sc = 0.3 + (max - 0.3) * e;
    return <mesh geometry={ring} material={ringMat(Math.pow(1 - u, 1.6) * 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[p[0], 0.045, p[2]]} scale={[sc, sc, 1]} />;
  };

/** speed streaks trailing story cars 2/3 while their staging speed is high */
const Streaks: React.FC<{f: number; cam: THREE.Vector3}> = ({f, cam}) => {
  if (f >= STOPF - 4) return null;
  const a = stage(f), b = stage(Math.max(0, f - 2)), out: React.ReactNode[] = [];
  [2, 3].forEach((ci) => {
    const ca = a.cars[ci], cb = b.cars[ci]; if (!ca || !cb) return;
    const sp = Math.hypot(ca.p[0] - cb.p[0], ca.p[2] - cb.p[2]) / 2;   // m per frame
    if (sp < 0.1) return;
    const dir = Math.sign(ca.p[0] - cb.p[0]) || 1, yaw = Math.atan2(cam.x - ca.p[0], cam.z - ca.p[2]);
    for (let j = 0; j < 3; j++) {
      const len = sp * (10 + j * 3), px = ca.p[0] - dir * (2.2 + len / 2 + j * 0.4);
      out.push(<mesh key={ci + '_' + j} geometry={plane} material={streakMat(0.26 - j * 0.06)} rotation={[0, yaw, 0]}
        position={[px, 0.5 + j * 0.28, ca.p[2] + (j - 1) * 0.5]} scale={[len, 0.06, 1]} />);
    }
  });
  return <>{out}</>;
};

const SIGB: V3 = [2.4, 0, 7.9];
export const Fx: React.FC<{f: number; cam: THREE.Vector3}> = ({f, cam}) => (
  <>
    {(VARIANT === 'E' || VARIANT === 'F' || VARIANT === 'H') && <Streaks f={f} cam={cam} />}
    {(VARIANT === 'E' || VARIANT === 'F' || VARIANT === 'H') && (<>
      <DustBurst p={[-3.3, 0, 11.7]} f={f} t0={STOPF} seed={1} />
      <DustBurst p={[4.3, 0, 14.4]} f={f} t0={STOPF} seed={2} />
    </>)}
    {VARIANT === 'E' && <ShockRing p={SIGB} f={f} t0={STOPF} max={3.5} dur={14} />}
    {VARIANT === 'F' && <ShockRing p={SIGB} f={f} t0={STOPF} max={3} dur={13} />}
    {VARIANT === 'H' && (<>
      <ShockRing p={SIGB} f={f} t0={STOPF} max={6.5} dur={20} />
      <ShockRing p={SIGB} f={f} t0={STOPF} max={4.5} dur={20} delay={5} />
      <DustBurst p={SIGB} f={f} t0={STOPF} n={8} r={1.3} seed={5} />
    </>)}
  </>
);
export {cl};
