// V4 PROOFS staging: horse + car rebuilds only, on the kit downtown crossing (lanes z 11.7 / 14.4).
import {TOTAL, shotAt, type V3} from '../../engine/core/clock';
import {autoGaze} from '../../engine/core/staging';
import {PersonP} from '../../engine/chars/rig';
import type {CarP, MeterP, Things} from '../../engine/kits/downtown/street';
import type {CartP} from '../../engine/kits/grocery/store';
export {TOTAL, shotAt};
export type Stage = {people: PersonP[]; carts: CartP[]; extra: string[]; cars: CarP[]; meters: MeterP[]; things: Things; clock: number; nStoryCars: number};
const parked = (): CarP[] => [{p: [6.75, 0, 9.45], ry: Math.PI, col: '#3f6a4a'}, {p: [-6.75, 0, 9.45], ry: Math.PI, col: '#c9a24a'}];
export function stage(f: number): Stage {
  const s = shotAt(f), P: PersonP[] = [], K: CarP[] = [...parked()], Mt: MeterP[] = [];
  let things: Things = {};
  switch (s.name) {
    case 'hside': things = {horse: {p: [0, 0, 13.0], ry: -Math.PI / 2, pose: 'walk', phase: 2.2}}; break;
    case 'hfront': things = {horse: {p: [0, 0, 13.0], ry: Math.PI / 2, pose: 'startle'}}; break;
    case 'car34': K.push({p: [0.4, 0, 12.6], ry: 0.5, col: '#a8443a', driver: '#7a3b22'}); break;
    case 'both': {
      things = {horse: {p: [0.2, 0, 14.9], ry: 1.75, pose: 'startle', cart: true}};
      K.push({p: [-0.55, 0, 10.66], ry: -1.40, col: '#2f4f6a', driver: '#3f4a66'});
      break;
    }
  }
  autoGaze(P, Mt);
  return {people: P, carts: [], extra: [], cars: K, meters: Mt, things, clock: 9 + f / 30 / 120, nStoryCars: K.length};
}
