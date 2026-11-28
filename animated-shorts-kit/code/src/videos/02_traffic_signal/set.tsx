// Traffic Signal set: kit grocery (shop front + interior + workshop corner) + kit downtown block,
// kit cars, kit Things (horse, bulb, coins) and the story's T-signal prop (signal.tsx, kit style).
import React from 'react';
import * as THREE from 'three';
import type {Tod} from '../../engine/look/look';
import {useMats, Set, type Mats} from '../../engine/kits/grocery/store';
import {Town, StreetClock} from '../../engine/kits/downtown/town';
import {Car, ThingsView} from '../../engine/kits/downtown/street';
import {Signal} from './signal';
import type {Stage} from './stage';
export const AUDIO: {voice: string | null; bed: string | null} = {voice: null, bed: null};
export const useSetData = () => useMats();
type P = {d: Mats; f: number; st: Stage; cam: THREE.Vector3; vel: (THREE.Vector3 | null)[]; tod: Tod};
export const SetBefore: React.FC<P> = ({d, f, st, cam, tod}) => (<>
  <Set m={d} f={f} /><Town tod={tod} /><StreetClock hours={st.clock} />
  {st.cars.map((c, i) => <Car key={i} c={c} />)}
  <ThingsView t={st.things} f={f} cam={cam} />
  {st.signal && <Signal s={st.signal} />}
</>);
export const SetAfter: React.FC<P> = () => null;
