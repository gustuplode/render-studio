// Traffic Signal hook round 2 set: kit grocery + kit downtown block, kit cars, and the story's
// own pieces — the T-signal (signal.tsx), the ASSEMBLING signal (signal2.tsx, variants E/H),
// the drop-in street props (props.tsx, variant F) and the VFX layer (fx.tsx: dust, shockwave
// rings, speed streaks). Engine untouched except the shared Caption kinetic-pop hook.
import React from 'react';
import * as THREE from 'three';
import type {Tod} from '../../engine/look/look';
import {useMats, Set, type Mats} from '../../engine/kits/grocery/store';
import {Town, StreetClock} from '../../engine/kits/downtown/town';
import {Car, ThingsView} from '../../engine/kits/downtown/street';
import {Signal} from './signal';
import {AssembleSignal} from './signal2';
import {ChequeBoard} from './board';
import {Fx} from './fx';
import {DropProps} from './props';
import {VARIANT} from './variant';
import type {Stage} from './stage';
export const AUDIO: {voice: string | null; bed: string | null} = {voice: null, bed: null};
export const useSetData = () => useMats();
type P = {d: Mats; f: number; st: Stage; cam: THREE.Vector3; vel: (THREE.Vector3 | null)[]; tod: Tod};
export const SetBefore: React.FC<P> = ({d, f, st, cam, tod}) => (<>
  <Set m={d} f={f} /><Town tod={tod} /><StreetClock hours={st.clock} />
  {st.cars.map((c, i) => <Car key={i} c={c} />)}
  <ThingsView t={st.things} f={f} cam={cam} />
  {st.signal && (VARIANT === 'E' || VARIANT === 'H'
    ? <AssembleSignal s={st.signal} f={f} scale={VARIANT === 'E' ? 0.6 : 1} />
    : <Signal s={st.signal} />)}
  {VARIANT === 'F' && <DropProps f={f} />}
  <Fx f={f} cam={cam} />
  {st.board && <ChequeBoard p={[3.35, 0, 6.95]} ry={0.1} />}
</>);
export const SetAfter: React.FC<P> = () => null;
