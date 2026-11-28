// ASSEMBLE SIGNAL — the kit T-signal (signal.tsx) rebuilt as separate flying parts for the
// round-2 hook variants E (fast assemble in the opening second) and H (hero assemble).
// Same kit style: flat toon materials, dark ink #241726, canvas-painted sign faces, V3 metals.
// Assembly runs on the STAGING clock (f = old frame): pole grows from the ground, crossbar
// drops in from above, the three panels fly in from the sides with an easeOutBack settle,
// the crank pops in last. Each landing fires a 4-frame glint flash on the part; at ONCEF a
// glint sweeps across the centre panel (the payoff word). `scale` compresses the windows
// (E = 0.6 -> whole assembly inside the first staging second).
import React from 'react';
import * as THREE from 'three';
import {LOOK_RAMP as ramp, lookToon, lookMetal} from '../../engine/look/look';
import {drawGlint} from '../../engine/look/draw';
import {cl} from '../../engine/core/clock';
import {ONCEF} from './timeline';
import type {SignalP} from './signal';

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
  iron: lookMetal({color: '#2c3a30', rough: 0.42}), brass: lookMetal({color: '#c9a24a', rough: 0.3}), wood: toon({color: '#8a5a32'}),
  back: lookMetal({color: '#3a3f35', rough: 0.5}),
  glint: new THREE.MeshBasicMaterial({map: drawGlint(0.32), transparent: true, depthWrite: false}),
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

const FLASH_TEX = (() => { if (typeof document === 'undefined') return null as any; return drawGlint(0.9); })();
/** one landing/payoff glint plane with its own opacity (shared materials can't vary per mesh) */
const FlashPlane: React.FC<{p: [number, number, number]; s: [number, number, number]; o: number}> = ({p, s, o}) => o <= 0 ? null : (
  <mesh geometry={plane} position={p} scale={s}>
    <meshBasicMaterial map={FLASH_TEX} transparent opacity={o} depthWrite={false} />
  </mesh>
);
const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 20), circ = new THREE.CircleGeometry(1, 24);
const taper = new THREE.CylinderGeometry(0.6, 1, 1, 20), flare = new THREE.CylinderGeometry(0.45, 1, 1, 20);
const plane = new THREE.PlaneGeometry(1, 1);

// assembly windows in staging seconds (before `scale`): [start, end] per part
const WIN = {pole: [0.05, 0.45], cross: [0.45, 0.75], L: [0.78, 1.05], C: [1.08, 1.35], R: [1.38, 1.65]};
const eoc = (u: number) => { u = cl(u); return 1 - Math.pow(1 - u, 3); };                       // easeOutCubic
const eob = (u: number) => { u = cl(u); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };  // easeOutBack
const prog = (t: number, w: [number, number], scale: number) => cl((t - w[0] * scale) / ((w[1] - w[0]) * scale));
/** 4-frame landing glint opacity at staging frame f for a part landing at old frame lf */
const landFlash = (f: number, lf: number) => { const d = Math.floor(f - lf); return d >= 0 && d < 4 ? [0.85, 0.5, 0.24, 0.08][d] : 0; };

const PanelBody: React.FC<{mat: any; lit: boolean; big?: boolean}> = ({mat, lit, big}) => (
  <group scale={big ? 1.22 : 1}>
    <mesh geometry={box} material={MAT.back} scale={[0.78, 0.78, 0.07]} castShadow />
    <mesh geometry={plane} material={mat} position={[0, 0, 0.037]} scale={[0.72, 0.72, 1]} />
    <mesh geometry={plane} material={MAT.glint} position={[0, 0, 0.046]} scale={[0.72, 0.72, 1]} />
    {[0.375, -0.375].map((y) => <mesh key={'fh' + y} geometry={box} material={MAT.iron} position={[0, y, 0.04]} scale={[0.8, 0.05, 0.03]} />)}
    {[0.375, -0.375].map((x) => <mesh key={'fv' + x} geometry={box} material={MAT.iron} position={[x, 0, 0.04]} scale={[0.05, 0.8, 0.03]} />)}
    {[0.33, -0.33].map((bx) => [0.33, -0.33].map((by) => <mesh key={bx + '_' + by} geometry={cyl} material={MAT.brass} position={[bx, by, 0.048]} rotation={[Math.PI / 2, 0, 0]} scale={[0.017, 0.016, 0.017]} />))}
    <mesh geometry={box} material={MAT.iron} position={[0, 0.46, 0.1]} rotation={[-0.45, 0, 0]} scale={[0.84, 0.035, 0.36]} castShadow />
    <mesh geometry={box} material={MAT.iron} position={[0, 0.44, 0]} scale={[0.06, 0.12, 0.06]} />
    {lit && <mesh geometry={box} material={MAT.brass} position={[0, -0.43, 0]} scale={[0.8, 0.05, 0.09]} />}
  </group>
);

/** The T-signal, assembling part by part. f = staging (old) frame; scale = window compression. */
export const AssembleSignal: React.FC<{s: SignalP; f: number; scale?: number}> = ({s, f, scale = 1}) => {
  const st = s.state, old = st === 'oldstop' || st === 'oldgo';
  const centre = old || st === 'build' ? null : st === 'yellow'
    ? {mat: MAT.wait, litMat: MAT.waitLit, active: true}
    : {mat: MAT.everywhere, litMat: MAT.everywhereLit, active: st === 'everywhere'};
  const t = f / 30;
  const uPole = prog(t, WIN.pole as [number, number], scale), uCross = prog(t, WIN.cross as [number, number], scale);
  const uL = prog(t, WIN.L as [number, number], scale), uC = prog(t, WIN.C as [number, number], scale), uR = prog(t, WIN.R as [number, number], scale);
  const landF = (w: [number, number]) => w[1] * scale * 30;
  const fly = (u: number, dir: number) => ({p: [dir * (1 - eob(u)) * 5.2, 2.62 + (1 - eob(u)) * 1.6, 0.14] as [number, number, number], ry: (1 - cl(u)) * dir * 1.1});
  const fL = fly(uL, -1), fC = fly(uC, 0), fR = fly(uR, 1);
  // payoff glint sweep across the centre panel around ONCEF (staging frames)
  const gU = (f - (ONCEF - 5)) / 10, glintOn = uC >= 1 && gU >= 0 && gU <= 1;
  return (
    <group position={s.p} rotation={[0, s.ry ?? 0, 0]}>
      <mesh geometry={circ} material={MAT.blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={0.55 * eoc(uPole)} />
      {/* POLE: grows out of the ground (group origin = ground, scaleY towards it) */}
      <group scale={[1, Math.max(0.001, eoc(uPole)), 1]}>
        <mesh geometry={taper} material={MAT.iron} position={[0, 1.5, -0.06]} scale={[0.075, 3.0, 0.075]} castShadow />
        <mesh geometry={flare} material={MAT.iron} position={[0, 0.05, -0.06]} scale={[0.16, 0.1, 0.16]} castShadow />
        <mesh geometry={cyl} material={MAT.iron} position={[0, 0.025, -0.06]} scale={[0.23, 0.05, 0.23]} castShadow />
        {[0, 1, 2, 3].map((i) => { const a = (i / 4) * Math.PI * 2 + 0.4; return <mesh key={'ab' + i} geometry={cyl} material={MAT.brass} position={[Math.cos(a) * 0.17, 0.06, -0.06 + Math.sin(a) * 0.17]} scale={[0.02, 0.05, 0.02]} />; })}
        {[0.9, 2.2].map((y) => <mesh key={'col' + y} geometry={cyl} material={MAT.brass} position={[0, y, -0.06]} scale={[0.082, 0.045, 0.082]} />)}
      </group>
      {uPole >= 1 && <FlashPlane p={[0, 1.5, 0.3]} s={[1.1, 3.0, 1]} o={landFlash(f, landF(WIN.pole as [number, number]))} />}
      {/* CROSSBAR: drops in from above with a settle spin */}
      {uCross > 0 && (
        <group position={[0, (1 - eob(uCross)) * 3.4, 0]} rotation={[0, 0, (1 - cl(uCross)) * 0.18]}>
          <mesh geometry={box} material={MAT.iron} position={[0, 3.06, -0.06]} scale={[2.5, 0.09, 0.09]} castShadow />
          {[1.27, -1.27].map((x) => <mesh key={'cap' + x} geometry={new THREE.SphereGeometry(1, 12, 8)} material={MAT.brass} position={[x, 3.06, -0.06]} scale={0.06} />)}
          <FlashPlane p={[0, 3.06, 0.3]} s={[2.4, 0.7, 1]} o={landFlash(f, landF(WIN.cross as [number, number]))} />
        </group>)}
      {/* PANELS: fly in from the sides (centre from above), easeOutBack settle */}
      {uL > 0 && (
        <group position={[fL.p[0] - 0.82 + 0.82, fL.p[1], fL.p[2]]} rotation={[0, fL.ry, 0]}>
          <group position={[-0.82, 0, 0]}>
            <PanelBody mat={(st === 'stop' || st === 'oldstop') ? MAT.stopLit : MAT.stop} lit={st === 'stop' || st === 'oldstop'} big={st === 'stop' || st === 'oldstop'} />
            <FlashPlane p={[0, 0, 0.09]} s={[0.8, 0.8, 1]} o={landFlash(f, landF(WIN.L as [number, number]))} />
          </group>
        </group>)}
      {uC > 0 && centre && (
        <group position={[0, fC.p[1], fC.p[2]]} rotation={[0, fC.ry, 0]}>
          <group position={[0, 0, 0]}>
            <PanelBody mat={centre.active ? centre.litMat : centre.mat} lit={centre.active} big={centre.active} />
            <FlashPlane p={[0, 0, 0.09]} s={[0.8, 0.8, 1]} o={landFlash(f, landF(WIN.C as [number, number]))} />
            {glintOn && <FlashPlane p={[-0.36 + 0.72 * gU, 0, 0.095]} s={[0.3, 0.78, 1]} o={0.75 * Math.sin(Math.PI * gU)} />}
          </group>
        </group>)}
      {uR > 0 && (
        <group position={[fR.p[0] + 0.82 - 0.82, fR.p[1], fR.p[2]]} rotation={[0, fR.ry, 0]}>
          <group position={[0.82, 0, 0]}>
            <PanelBody mat={(st === 'go' || st === 'oldgo') ? MAT.goLit : MAT.go} lit={st === 'go' || st === 'oldgo'} big={st === 'go' || st === 'oldgo'} />
            <FlashPlane p={[0, 0, 0.09]} s={[0.8, 0.8, 1]} o={landFlash(f, landF(WIN.R as [number, number]))} />
          </group>
        </group>)}
      {/* CRANK: pops in with the centre panel, spins once as it seats */}
      {uC > 0 && (
        <group position={[0.16, 1.05, 0]} rotation={[0, 0, (s.crank ?? 0) + (1 - eob(uC)) * 4]} scale={Math.max(0.001, eob(uC))}>
          <mesh geometry={cyl} material={MAT.brass} rotation={[Math.PI / 2, 0, 0]} scale={[0.095, 0.03, 0.095]} castShadow />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i / 8) * Math.PI * 2; return <mesh key={'gt' + i} geometry={box} material={MAT.brass} position={[Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0]} rotation={[0, 0, a]} scale={[0.028, 0.028, 0.03]} />; })}
          <mesh geometry={cyl} material={MAT.brass} rotation={[0, 0, Math.PI / 2]} scale={[0.035, 0.16, 0.035]} castShadow />
          <mesh geometry={cyl} material={MAT.wood} position={[0.16, -0.14, 0]} scale={[0.03, 0.14, 0.03]} castShadow />
          <mesh geometry={box} material={MAT.brass} position={[0.08, -0.07, 0]} scale={[0.17, 0.035, 0.035]} />
        </group>)}
    </group>
  );
};
