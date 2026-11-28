// Traffic Signal V2 set: kit grocery (shop front + interior + workshop corner) + kit downtown block,
// kit cars, kit Things (horse, bulb) and the story's own props in kit style: T-signal (signal.tsx)
// and the GE cheque board (board.tsx). Engine untouched.
import React from 'react';
import * as THREE from 'three';
import type {Tod} from '../../engine/look/look';
import {useMats, Set, type Mats} from '../../engine/kits/grocery/store';
import {Town, StreetClock} from '../../engine/kits/downtown/town';
import {Car, ThingsView} from '../../engine/kits/downtown/street';
import {Signal} from './signal';
import {ChequeBoard} from './board';
import type {Stage} from './stage';
export const AUDIO: {voice: string | null; bed: string | null} = {voice: null, bed: null};
export const useSetData = () => useMats();
type P = {d: Mats; f: number; st: Stage; cam: THREE.Vector3; vel: (THREE.Vector3 | null)[]; tod: Tod};
export const SetBefore: React.FC<P> = ({d, f, st, cam, tod}) => (<>
  <Set m={d} f={f} /><Town tod={tod} /><StreetClock hours={st.clock} />
  {st.cars.map((c, i) => <Car key={i} c={c} />)}
  <ThingsView t={st.things} f={f} cam={cam} />
  {st.signal && <Signal s={st.signal} />}
  {st.board && <ChequeBoard p={[3.35, 0, 6.95]} ry={0.1} />}
</>);
export const SetAfter: React.FC<P> = () => null;
