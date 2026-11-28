// V5 PROOFS (round 2) camera: subjects framed LARGE — the difference must read at first
// glance on a phone. 'both' keeps round 1's exact framing for the PEHLE/AB compare panel.
import {K, type Take, type Kick, type Whip, type Flash, type Props} from '../../engine/camera/takes_api';
import {SHOT_REAL as R} from './timeline';
export const PROPS: Props = {
  horse: [[0, 1.05, 13.45], [0.55, 1.18, 1.65]],
  horsehead: [[-0.1, 2.15, 12.0], [0.85, 0.85, 0.85]],
  car: [[0.1, 0.9, 12.55], [2.55, 1.0, 2.05]],
  both: [[-0.55, 1.0, 13.55], [2.35, 1.35, 5.05]],
};
export const TAKES: Take[] = [
  {name: 'hbig', why: 'horse LARGE side-on, mid-stride, head low-forward', keys: [K(R.hbig, 'prop:horse', 'FS', 88, 7, 42, {push: 1.03})]},
  {name: 'hstartle', why: 'startle close: head high, ears pinned, foreleg raised, blaze + eye white', keys: [K(R.hstartle, 'prop:horsehead', 'MCU', 140, 9, 40, {push: 1.02})]},
  {name: 'carbig', why: 'sedan LARGE front 3/4: grille, stalk headlights, black fenders, two-tone', keys: [K(R.carbig, 'prop:car', 'FS', 68, 6, 42, {push: 1.03})]},
  {name: 'both', why: 'round-1 framing repeated: horse+cart and car nose-to-nose (compare bottom panel)', keys: [K(R.both, 'prop:both', 'FS', 100, 6, 46, {push: 1.02})]},
];
export const KICKS: Kick[] = [];
export const WHIPS: Whip[] = [];
export const FLASHES: Flash[] = [];
