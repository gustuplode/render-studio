// The Shopping Cart set: kit grocery (store interior + frontage + workshop) + kit downtown
// block (street life for the title), the kit folding-chair Cart rendered from staging,
// kit Extras, the story's idea bulb (kit bulb texture, staged via things.bulb) and the
// story FX layer (fx.tsx). Engine untouched.
import React from 'react';
import * as THREE from 'three';
import type {Tod} from '../../engine/look/look';
import {useMats, Set, Cart, Extras, type Mats} from '../../engine/kits/grocery/store';
import {Town, StreetClock} from '../../engine/kits/downtown/town';
import {Car} from '../../engine/kits/downtown/street';
import {pop} from '../../engine/core/clock';
import {Fx} from './fx';
import type {Stage} from './stage';
export const AUDIO: {voice: string | null; bed: string | null} = {voice: null, bed: null};
export const useSetData = () => useMats();
type P = {d: Mats; f: number; st: Stage; cam: THREE.Vector3; vel: (THREE.Vector3 | null)[]; tod: Tod};
const plane = new THREE.PlaneGeometry(1, 1);
export const SetBefore: React.FC<P> = ({d, f, st, tod}) => (<>
  <Set m={d} f={f} /><Town tod={tod} /><StreetClock hours={st.clock} />
  {st.cars.map((c, i) => <Car key={i} c={c} />)}
  {st.carts.map((c, i) => <Cart key={i} m={d} c={c} f={f} />)}
  <Extras m={d} f={f} x={st.extra} />
  <Fx ev={st.fx} f={f} />
</>);
export const SetAfter: React.FC<P> = ({d, st, cam}) => {
  const b = st.things.bulb;
  if (!b || b.k <= 0) return null;
  const yaw = Math.atan2(cam.x - b.p[0], cam.z - b.p[2]);
  return <mesh geometry={plane} material={d.bulb} position={b.p} rotation={[0, yaw, 0]} scale={0.36 * pop(b.k)} />;
};
