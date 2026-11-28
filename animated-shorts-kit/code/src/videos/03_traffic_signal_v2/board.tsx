// CHEQUE BOARD prop — the GE payment made READABLE in-world (v2 fix for v1's invisible coins).
// Built in the kit's own style: flat toon materials, dark ink #241726, canvas-painted face
// (same method as signal.tsx sign faces and kits/downtown placards). A presentation board on
// two legs, standing next to the GE gentleman: "GENERAL ELECTRIC / $40,000 / FOR THE TRAFFIC SIGNAL".
import React from 'react';
import * as THREE from 'three';
import {LOOK_RAMP as ramp, lookToon} from '../../engine/look/look';

const INK = '#241726';
const cv = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const FONT = '"Archivo Black", Impact, sans-serif';

const chequeTex = () => { const c = cv(640, 480), g = c.getContext('2d')!;
  g.fillStyle = '#fbf3e0'; g.fillRect(0, 0, 640, 480);
  g.lineWidth = 16; g.strokeStyle = INK; g.strokeRect(10, 10, 620, 460);
  g.lineWidth = 4; g.strokeRect(34, 34, 572, 412);
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 54px ${FONT}`; g.fillText('GENERAL ELECTRIC', 320, 92);
  g.fillRect(90, 140, 460, 6);
  g.font = `900 148px ${FONT}`; g.fillStyle = '#b2391f'; g.fillText('$40,000', 320, 268);
  g.fillStyle = INK; g.font = `900 44px ${FONT}`; g.fillText('FOR THE TRAFFIC SIGNAL', 320, 392);
  return tex(c); };

const MAT = (() => { if (typeof document === 'undefined') return null as any; return {
  face: new THREE.MeshBasicMaterial({map: chequeTex()}),
  back: lookToon({color: '#3a3f35'}),
  wood: lookToon({color: '#8a5a32'}),
  blob: new THREE.MeshBasicMaterial({color: '#000', transparent: true, opacity: 0.3, depthWrite: false}),
}; })();

const box = new THREE.BoxGeometry(1, 1, 1), circ = new THREE.CircleGeometry(1, 24);

/** Presentation cheque board, 1.7 m wide, face centre at y≈1.3, at the given spot facing +z (ry). */
export const ChequeBoard: React.FC<{p: [number, number, number]; ry?: number}> = ({p, ry = 0}) => (
  <group position={p} rotation={[0, ry, 0]}>
    <mesh geometry={circ} material={MAT.blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[0.95, 0.4, 1]} />
    <mesh geometry={box} material={MAT.back} position={[0, 1.3, -0.035]} scale={[1.74, 1.32, 0.06]} castShadow />
    <mesh geometry={new THREE.PlaneGeometry(1, 1)} material={MAT.face} position={[0, 1.3, 0.001]} scale={[1.68, 1.26, 1]} />
    {[-0.62, 0.62].map((x, i) => (
      <mesh key={i} geometry={box} material={MAT.wood} position={[x, 0.32, -0.1]} rotation={[0.35, 0, 0]} scale={[0.06, 0.72, 0.06]} castShadow />
    ))}
  </group>
);
