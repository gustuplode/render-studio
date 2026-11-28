// TEMPLATE camera: one continuous take per beat; keys name a subject + size + angle, the engine solves the framing.
import {K, type Take, type Kick, type Whip, type Flash, type Props} from '../../engine/camera/takes_api';
import {T} from '../../engine/core/clock';
import {SHOT_REAL as R} from './timeline';
export const PROPS: Props = {};
export const TAKES: Take[] = [
  {name: 'intro', why: 'two people on the downtown sidewalk, push in on him', keys: [
    K(R.intro, ['youngman', 'grandma'], 'FS', 20, 8, 44, {push: 1.05}),
    K(T('intro', 'test'), 'youngman', 'MS', 15, 4, 40, {move: 'arc', lead: 0.3, dur: 0.8, push: 1.05})]},
  {name: 'wave', why: 'cut: close on the wave', keys: [K(R.wave, 'arms:youngman', 'MCU', -20, 2, 40, {push: 1.06})]},
];
export const KICKS: Kick[] = [];
export const WHIPS: Whip[] = [];
export const FLASHES: Flash[] = [];
