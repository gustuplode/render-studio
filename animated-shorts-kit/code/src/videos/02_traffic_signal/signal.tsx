// T-SIGNAL prop — Morgan's traffic signal, built in the kit's own style (flat toon materials,
// dark ink #241726, canvas-painted sign faces like kits/downtown/street.tsx placards/meters).
// Missing piece written for this story per SKILL.md ("write them in the same style").
// States: 'oldstop' | 'oldgo' (2-sign signal) · 'stop' | 'go' | 'everywhere' (3-sign) · 'yellow' (modern amber WAIT) · 'build' (in the workshop, centre panel off)
import React from 'react';
import * as THREE from 'three';
import {LOOK_RAMP as ramp, lookToon} from '../../engine/look/look';

export type SignalState = 'oldstop' | 'oldgo' | 'stop' | 'go' | 'everywhere' | 'yellow' | 'build';
export type SignalP = {p: [number, number, number]; ry?: number; state: SignalState; crank?: number};

const INK = '#241726';
const toon = lookToon;
const cv = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const FONT = '"Archivo Black", Impact, sans-serif';

const signTex = (lines: string[], bg: string, fg: string) => { const c = cv(256, 256), g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
  g.lineWidth = 14; g.strokeStyle = INK; g.strokeRect(7, 7, 242, 242);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((t, i) => { let fs = lines.length > 1 ? 62 : 84; g.font = `900 ${fs}px ${FONT}`;
    while (g.measureText(t).width > 216 && fs > 20) { fs -= 4; g.font = `900 ${fs}px ${FONT}`; }
    g.fillText(t, 128, lines.length > 1 ? 84 + i * 88 : 132); });
  return tex(c); };

const MAT = (() => { if (typeof document === 'undefined') return null as any; return {
  iron: toon({color: '#2c3a30'}), brass: toon({color: '#c9a24a'}, 0.8), wood: toon({color: '#8a5a32'}),
  back: toon({color: '#3a3f35'}),
  stop: new THREE.MeshToonMaterial({gradientMap: ramp, map: signTex(['STOP'], '#b2391f', '#fbf3e0'), color: '#8f8f8f'}),
  go: new THREE.MeshToonMaterial({gradientMap: ramp, map: signTex(['GO'], '#2f6f53', '#fbf3e0'), color: '#8f8f8f'}),
  everywhere: new THREE.MeshToonMaterial({gradientMap: ramp, map: signTex(['STOP', 'EVERYWHERE'], '#f2992a', '#241726'), color: '#8f8f8f'}),
  wait: new THREE.MeshToonMaterial({gradientMap: ramp, map: signTex(['WAIT'], '#f2b234', '#241726'), color: '#8f8f8f'}),
  stopLit: new THREE.MeshBasicMaterial({map: signTex(['STOP'], '#d8432a', '#ffffff')}),
  goLit: new THREE.MeshBasicMaterial({map: signTex(['GO'], '#3f9a5c', '#ffffff')}),
  everywhereLit: new THREE.MeshBasicMaterial({map: signTex(['STOP', 'EVERYWHERE'], '#ffb03a', '#241726')}),
  waitLit: new THREE.MeshBasicMaterial({map: signTex(['WAIT'], '#ffc93a', '#241726')}),
  blob: new THREE.MeshBasicMaterial({color: '#000', transparent: true, opacity: 0.3, depthWrite: false}),
}; })();

const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 20), circ = new THREE.CircleGeometry(1, 24);
const taper = new THREE.CylinderGeometry(0.6, 1, 1, 20), flare = new THREE.CylinderGeometry(0.45, 1, 1, 20);

const Panel: React.FC<{x: number; mat: any; lit: boolean; big?: boolean}> = ({x, mat, lit, big}) => (
  <group position={[x, 2.62, 0.14]} scale={big ? 1.22 : 1}>
    <mesh geometry={box} material={MAT.back} scale={[0.78, 0.78, 0.07]} castShadow />
    <mesh geometry={new THREE.PlaneGeometry(1, 1)} material={mat} position={[0, 0, 0.037]} scale={[0.72, 0.72, 1]} />
    <mesh geometry={box} material={MAT.iron} position={[0, 0.44, 0]} scale={[0.06, 0.12, 0.06]} />
    {lit && <mesh geometry={box} material={MAT.brass} position={[0, -0.43, 0]} scale={[0.8, 0.05, 0.09]} />}
  </group>
);

/** T-shaped signal pole with crank. Panel order on the T bar: STOP · (centre) · GO.
 *  Centre panel: STOP EVERYWHERE (amber) on the 3-sign signal, WAIT on 'yellow', absent while 'build'. */
export const Signal: React.FC<{s: SignalP}> = ({s}) => {
  const st = s.state, old = st === 'oldstop' || st === 'oldgo';
  const centre = old || st === 'build' ? null : st === 'yellow'
    ? {mat: MAT.wait, litMat: MAT.waitLit, active: true}
    : {mat: MAT.everywhere, litMat: MAT.everywhereLit, active: st === 'everywhere'};
  return (
    <group position={s.p} rotation={[0, s.ry ?? 0, 0]}>
      <mesh geometry={circ} material={MAT.blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={0.55} />
      <mesh geometry={taper} material={MAT.iron} position={[0, 1.5, -0.06]} scale={[0.075, 3.0, 0.075]} castShadow />
      <mesh geometry={flare} material={MAT.iron} position={[0, 0.05, -0.06]} scale={[0.16, 0.1, 0.16]} castShadow />
      <mesh geometry={box} material={MAT.iron} position={[0, 3.06, -0.06]} scale={[2.5, 0.09, 0.09]} castShadow />
      <Panel x={-0.82} mat={(st === 'stop' || st === 'oldstop') ? MAT.stopLit : MAT.stop} lit={st === 'stop' || st === 'oldstop'} big={st === 'stop' || st === 'oldstop'} />
      <Panel x={0.82} mat={(st === 'go' || st === 'oldgo') ? MAT.goLit : MAT.go} lit={st === 'go' || st === 'oldgo'} big={st === 'go' || st === 'oldgo'} />
      {centre && <Panel x={0} mat={centre.active ? centre.litMat : centre.mat} lit={centre.active} big={centre.active} />}
      {st === 'build' && <group position={[0.25, 1.05, 0.3]} rotation={[0.2, 0, -0.5]}>
        <mesh geometry={box} material={MAT.back} scale={[0.78, 0.78, 0.07]} castShadow />
        <mesh geometry={new THREE.PlaneGeometry(1, 1)} material={MAT.everywhere} position={[0, 0, 0.037]} scale={[0.72, 0.72, 1]} />
      </group>}
      {/* crank on the side of the pole, turns with s.crank (radians) */}
      <group position={[0.16, 1.05, 0]} rotation={[0, 0, s.crank ?? 0]}>
        <mesh geometry={cyl} material={MAT.brass} rotation={[0, 0, Math.PI / 2]} scale={[0.035, 0.16, 0.035]} castShadow />
        <mesh geometry={cyl} material={MAT.wood} position={[0.16, -0.14, 0]} scale={[0.03, 0.14, 0.03]} castShadow />
        <mesh geometry={box} material={MAT.brass} position={[0.08, -0.07, 0]} rotation={[0, 0, 0]} scale={[0.17, 0.035, 0.035]} />
      </group>
    </group>
  );
};
