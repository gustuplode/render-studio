// DROP PROPS — variant F's building-drop intro: street props/signage fall in with an
// easeOutBounce landing + a dust puff, inside the first half second (staging frames 4-13).
// Kit style: toon wood (drawWood/drawCrate canvas textures), ink-outlined sign boards
// (drawSign). Props sit on the far sidewalk (z ~ 6.1), clear of people, cars and the signal;
// they are decorative set dressing (not people/cars/carts), so the logic gates don't track them.
import React from 'react';
import * as THREE from 'three';
import {LOOK_RAMP as ramp, lookToon} from '../../engine/look/look';
import {drawSign, drawCrate, drawWood} from '../../engine/look/draw';
import {cl} from '../../engine/core/clock';
import type {V3} from '../../engine/core/clock';
import {DustBurst} from './fx';

const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 18), plane = new THREE.PlaneGeometry(1, 1);
const MAT = (() => { if (typeof document === 'undefined') return null as any; return {
  post: lookToon({color: '#3a3f35'}),
  crate: new THREE.MeshToonMaterial({gradientMap: ramp, map: drawCrate()}),
  wood: new THREE.MeshToonMaterial({gradientMap: ramp, map: drawWood('#a9743f', {planks: 4, seed: 9})}),
  band: lookToon({color: '#2c2c30'}),
  diner: new THREE.MeshBasicMaterial({map: drawSign(['DINER'], {w: 512, h: 288, bg: '#b2391f', fg: '#fbf3e0'})}),
  hotel: new THREE.MeshBasicMaterial({map: drawSign(['HOTEL'], {w: 512, h: 288, bg: '#274156', fg: '#fbf3e0'})}),
}; })();

const easeOutBounce = (u: number) => { u = cl(u); const n1 = 7.5625, d1 = 2.75;
  if (u < 1 / d1) return n1 * u * u;
  if (u < 2 / d1) return n1 * (u -= 1.5 / d1) * u + 0.75;
  if (u < 2.5 / d1) return n1 * (u -= 2.25 / d1) * u + 0.9375;
  return n1 * (u -= 2.625 / d1) * u + 0.984375; };

/** falls from the sky over the 16 frames before `land` (staging), then rests */
const Drop: React.FC<{p: V3; f: number; land: number; children: React.ReactNode}> = ({p, f, land, children}) => {
  const u = (f - (land - 16)) / 16;
  if (u < 0) return null;
  const y = u >= 1 ? 0 : 6.5 * (1 - easeOutBounce(u));
  return (<>
    <group position={[p[0], y, p[2]]}>{children}</group>
    <DustBurst p={p} f={f} t0={land} dur={11} n={5} r={0.7} seed={land} />
  </>);
};

const SignPost: React.FC<{mat: any; flip?: boolean}> = ({mat, flip}) => { const s = flip ? -1 : 1; return (<>
  <mesh geometry={cyl} material={MAT.post} position={[0, 1.3, 0]} scale={[0.05, 2.6, 0.05]} castShadow />
  <mesh geometry={box} material={MAT.post} position={[0.42 * s, 2.42, 0]} scale={[0.95, 0.07, 0.07]} castShadow />
  <mesh geometry={box} material={MAT.post} position={[0.82 * s, 2.06, 0]} scale={[1.16, 0.78, 0.05]} castShadow />
  <mesh geometry={plane} material={mat} position={[0.82 * s, 2.06, 0.028]} scale={[1.1, 0.72, 1]} />
  <mesh geometry={cyl} material={MAT.post} position={[0, 0.04, 0]} scale={[0.16, 0.08, 0.16]} />
</>); };

const Crates: React.FC = () => (<>
  <mesh geometry={box} material={MAT.crate} position={[0, 0.31, 0]} scale={[0.62, 0.62, 0.62]} castShadow />
  <mesh geometry={box} material={MAT.crate} position={[0.58, 0.26, 0.1]} scale={[0.52, 0.52, 0.52]} castShadow />
  <mesh geometry={box} material={MAT.crate} position={[0.05, 0.85, 0.02]} rotation={[0, 0.4, 0]} scale={[0.5, 0.5, 0.5]} castShadow />
</>);

const Barrel: React.FC = () => (<>
  <mesh geometry={cyl} material={MAT.wood} position={[0, 0.45, 0]} scale={[0.34, 0.9, 0.34]} castShadow />
  {[0.18, 0.45, 0.72].map((y) => <mesh key={y} geometry={cyl} material={MAT.band} position={[0, y, 0]} scale={[0.355, 0.045, 0.355]} />)}
</>);

/** F intro: four props drop in, staging frames 4 / 7 / 10 / 13.
    Positions were verified by projecting them through the f1 camera (engine camAt):
    the portrait frame only covers x ~ [-2.1, +3.6] at the sidewalk — wider placements
    (the first attempt) fell outside the frame entirely. */
export const DropProps: React.FC<{f: number}> = ({f}) => (<>
  <Drop p={[-2.0, 0, 6.1]} f={f} land={4}><SignPost mat={MAT.diner} /></Drop>
  <Drop p={[3.4, 0, 6.2]} f={f} land={7}><Crates /></Drop>
  <Drop p={[0.15, 0, 6.15]} f={f} land={10}><Barrel /></Drop>
  <Drop p={[3.55, 0, 7.0]} f={f} land={13}><SignPost mat={MAT.hotel} flip /></Drop>
</>);
