// FX — Shopping Cart VFX, keyed to the STAGING clock (f = old frame) so the speed-graph
// warp places them on the right real frames automatically. Kit grammar: flat shapes, soft
// alpha. DustBurst = expanding tan dust discs (assemble landings); ShockRing = ground
// shockwave ring (the build reveal, the "They copied." payoff). Events are staged per shot
// in stage.ts (Stage.fx, t0 = absolute old frame).
import React from 'react';
import * as THREE from 'three';
import type {V3} from '../../engine/core/clock';

const circ = new THREE.CircleGeometry(1, 24), ring = new THREE.RingGeometry(0.93, 1.0, 56);
const hash = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const dustMat = (o: number) => new THREE.MeshBasicMaterial({color: '#d9c9a3', transparent: true, opacity: o, depthWrite: false});
const ringMat = (o: number) => new THREE.MeshBasicMaterial({color: '#fff6e0', transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide});

export type FxEv = {kind: 'dust' | 'ring'; p: V3; t0: number; max?: number; dur?: number};

export const DustBurst: React.FC<{p: V3; f: number; t0: number; dur?: number; n?: number; r?: number; seed?: number}> =
  ({p, f, t0, dur = 14, n = 6, r = 0.55, seed = 0}) => {
    const u = (f - t0) / dur; if (u < 0 || u >= 1) return null;
    const e = 1 - Math.pow(1 - u, 2);
    return (<>
      {Array.from({length: n}, (_, i) => {
        const a = (i / n) * Math.PI * 2 + hash(i, seed) * 0.8, d = r * (0.25 + 0.75 * e) * (0.65 + 0.5 * hash(i, seed + 1));
        const sc = 0.13 + 0.5 * e * (0.7 + 0.5 * hash(i, seed + 2));
        return <mesh key={i} geometry={circ} material={dustMat((1 - u) * 0.5)} rotation={[-Math.PI / 2, 0, 0]}
          position={[p[0] + Math.cos(a) * d, 0.035 + 0.08 * u * hash(i, seed + 3), p[2] + Math.sin(a) * d]} scale={[sc, sc * 0.8, 1]} />;
      })}
      <mesh geometry={circ} material={dustMat((1 - u) * 0.4)} rotation={[-Math.PI / 2, 0, 0]} position={[p[0], 0.03, p[2]]} scale={[0.25 + 0.65 * e, (0.25 + 0.65 * e) * 0.8, 1]} />
    </>);
  };

export const ShockRing: React.FC<{p: V3; f: number; t0: number; dur?: number; max?: number; delay?: number}> =
  ({p, f, t0, dur = 18, max = 3, delay = 0}) => {
    const u = (f - t0 - delay) / dur; if (u < 0 || u >= 1) return null;
    const e = 1 - Math.pow(1 - u, 3), sc = 0.2 + (max - 0.2) * e;
    return <mesh geometry={ring} material={ringMat(Math.pow(1 - u, 1.6) * 0.85)} rotation={[-Math.PI / 2, 0, 0]} position={[p[0], 0.045, p[2]]} scale={[sc, sc, 1]} />;
  };

export const Fx: React.FC<{ev: FxEv[]; f: number}> = ({ev, f}) => (
  <>
    {ev.map((e, i) => e.kind === 'dust'
      ? <DustBurst key={i} p={e.p} f={f} t0={e.t0} dur={e.dur ?? 13} seed={i + 1} />
      : <ShockRing key={i} p={e.p} f={f} t0={e.t0} dur={e.dur ?? 18} max={e.max ?? 3} />)}
  </>
);
