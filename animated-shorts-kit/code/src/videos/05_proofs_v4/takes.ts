// V4 PROOFS camera: one honest framing per proof, subjects are named props.
import {K, type Take, type Kick, type Whip, type Flash, type Props} from '../../engine/camera/takes_api';
import {SHOT_REAL as R} from './timeline';
export const PROPS: Props = {
  horse: [[0, 1.05, 13.0], [0.95, 1.25, 1.75]],
  horsehead: [[0, 2.0, 11.6], [0.75, 0.8, 0.75]],
  car: [[0.4, 0.85, 12.6], [2.2, 0.95, 1.05]],
  both: [[-0.55, 1.0, 13.55], [2.35, 1.35, 5.05]],
};
export const TAKES: Take[] = [
  {name: 'hside', why: 'horse side-on, mid-stride, full body', keys: [K(R.hside, 'prop:horse', 'FS', 90, 7, 44, {push: 1.02})]},
  {name: 'hfront', why: 'horse front 3/4: head, neck, ears, harness', keys: [K(R.hfront, ['prop:horsehead', 'prop:horse'], 'MS', 130, 6, 42, {push: 1.02})]},
  {name: 'car34', why: 'car front 3/4, full car, flowing silhouette', keys: [K(R.car34, 'prop:car', 'WS', 70, 6, 44, {push: 1.02})]},
  {name: 'both', why: 'crash-beat framing: horse+cart and car nose-to-nose at the crossing', keys: [K(R.both, 'prop:both', 'FS', 100, 6, 46, {push: 1.02})]},
];
export const KICKS: Kick[] = [];
export const WHIPS: Whip[] = [];
export const FLASHES: Flash[] = [];
