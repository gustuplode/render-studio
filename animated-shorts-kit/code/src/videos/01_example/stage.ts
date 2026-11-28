// TEMPLATE staging: who / what is where per frame (old frame = real frame for identity timelines).
import {TOTAL, shotAt, W, type V3} from '../../engine/core/clock';
import {autoGaze} from '../../engine/core/staging';
import {PersonP, seq} from '../../engine/chars/rig';
import type {CarP, MeterP, Things} from '../../engine/kits/downtown/street';
import type {CartP} from '../../engine/kits/grocery/store';
export {TOTAL, shotAt};
export type Stage = {people: PersonP[]; carts: CartP[]; extra: string[]; cars: CarP[]; meters: MeterP[]; things: Things; clock: number; nStoryCars: number};
export function stage(f: number): Stage {
  const s = shotAt(f), lf = s.lf, P: PersonP[] = [], K: CarP[] = [], Mt: MeterP[] = [];
  K.push({p: [6.75, 0, 9.45], ry: Math.PI, col: '#2f4f6a'}, {p: [-6.75, 0, 9.45], ry: Math.PI, col: '#a8443a'});
  switch (s.name) {
    case 'intro': P.push({who: 'youngman', p: [-0.6, 0, 7.4], ...seq(lf, [[0, 'idle', 'happy'], [20, 'present', 'proud']]), gaze: 'cam'}); P.push({who: 'grandma', p: [0.8, 0, 7.6], act: 'idle', expr: 'smug'}); break;
    case 'wave': P.push({who: 'youngman', p: [-0.6, 0, 7.4], ...seq(lf, [[0, 'wave', 'happy'], [W('wave', 'wave') + 10, 'cheer', 'grin']]), gaze: 'cam'}); P.push({who: 'grandma', p: [0.8, 0, 7.6], act: 'idle', expr: 'happy'}); break;
  }
  autoGaze(P, Mt);
  return {people: P, carts: [], extra: [], cars: K, meters: Mt, things: {}, clock: 9 + f / 30 / 120, nStoryCars: K.length};
}
