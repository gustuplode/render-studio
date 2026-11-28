// HOOK VARIANTS A-D camera (03_CAMERA_GRAMMAR). One take per variant for A/B/C ('hook'),
// four takes for D (snap cuts). All keys are anchored to the REAL N1 word times (T('hook', …)).
// A — Power Push: wide FS, then a fast dolly push-in that ARRIVES on "stopped" + a crash-strength
//     kick as both cars halt in one jolt; Morgan's winning smile lands on the same word.
// B — Whip Orbit: FS tracking the streaming car, a whip-pan to Morgan (~0.9 s), then a 180°
//     arc orbit (az 30 -> 210) while he presents — the world flows behind him.
// C — Emotion Close-Up: CU on Morgan's face from frame 0 (fov 36 keeps the camera off the
//     CAMFACE line), then a dolly pull-back to FS on Morgan + signal so the stopped street
//     is revealed behind him as "every car at once" lands.
// D — Snap Cuts: FS wide -> CU signal (cut on "and", freeze 6 frames on "stopped" — the key
//     holds dead still: push 1, arc 0, settle 0, and warp() freezes the staging) -> CU startled
//     driver (cut at real 2.5 s + small kick) -> MCU Morgan hard stare for "at once." + tail.
import {K, type Take, type Kick, type Whip, type Flash, type Props} from '../../engine/camera/takes_api';
import {T} from '../../engine/core/clock';
import {SHOT_REAL as R} from './timeline';
import {VARIANT} from './variant';
export const PROPS: Props = {
  signal: [[2.4, 1.55, 7.9], [1.0, 1.6, 0.4]],
  crossing: [[0.2, 1.0, 12.6], [2.6, 1.5, 2.4]],
  worksignal: [[12.7, 1.6, 0.1], [1.0, 1.6, 0.4]],
  cheque: [[3.35, 1.05, 6.95], [0.9, 0.68, 0.15]],
  wheelA: [[-2.18, 0.36, 12.53], [0.42, 0.42, 0.3]],
  horse: [[0.4, 1.15, 13.9], [1.5, 2.0, 3.6]],
};
const STOP = 2.153;   // T('hook', 'stopped') — the word the whole hook turns on
export const TAKES: Take[] = VARIANT === 'A' ? [
  {name: 'hook', why: 'wide on the crossing, fast push-in arriving on "stopped", kick as the cars halt', keys: [
    K(R.hook, ['mechanic', 'prop:signal'], 'FS', 18, 8, 44, {push: 1.0, arc: 0}),
    K(STOP, 'mechanic', 'MS', 30, 5, 42, {move: 'dolly', lead: 1.0, dur: 0.9, push: 1.06, arc: 0})]},
] : VARIANT === 'B' ? [
  {name: 'hook', why: 'whip-pan off the streaming traffic onto Morgan, then a 180 deg orbit around him', keys: [
    K(R.hook, 'car:2', 'FS', 70, 6, 44, {push: 1.0, arc: 0}),
    K(0.9, 'mechanic', 'MS', 30, 5, 42, {move: 'whip', lead: 0.15, dur: 0.3, push: 1.04, arc: 0}),
    K(1.6, 'mechanic', 'MS', 210, 5, 42, {move: 'arc', lead: 0.2, dur: 2.6, push: 1.05, arc: 0})]},
] : VARIANT === 'C' ? [
  {name: 'hook', why: 'tight CU on Morgan surprise -> resolve, then a dolly pull-back revealing the stopped street', keys: [
    K(R.hook, 'mechanic', 'CU', 12, 4, 36, {push: 1.0, arc: 0}),
    K(STOP + 0.5, ['mechanic', 'prop:signal'], 'FS', 18, 8, 44, {move: 'dolly', lead: 0.3, dur: 1.2, push: 1.0, arc: 0})]},
] : [
  {name: 'd1', why: 'street wide while Morgan speaks and the traffic rolls in', keys: [
    K(R.d1, ['mechanic', 'prop:signal'], 'FS', 18, 8, 44, {push: 1.02, arc: 0})]},
  {name: 'd2', why: 'signal CU on "and"; the picture FREEZES for 6 frames on "stopped" (warp + dead-still key)', keys: [
    K(R.d2, 'prop:signal', 'CU', 6, 12, 40, {push: 1.0, settle: [0, 0.01], arc: 0})]},
  {name: 'd3', why: 'cut to the startled driver face on the freeze release', keys: [
    K(R.d3, 'man', 'CU', 160, 4, 36, {push: 1.0, settle: [0, 0.01], arc: 0})]},
  {name: 'd4', why: 'Morgan hard stare MCU for "at once." and the tail', keys: [
    K(R.d4, 'mechanic', 'MCU', 10, 5, 40, {push: 1.04, settle: [0, 0.01], arc: 0})]},
];
export const KICKS: Kick[] = VARIANT === 'A' ? [
  {t: STOP, a: 0.8, z: 0.06},      // impact hit, exactly on "stopped" — the cars halt in one jolt
] : VARIANT === 'B' ? [
  {t: STOP, a: 0.4, z: 0.02},      // brake-lock thump mid-orbit as every car stops
] : VARIANT === 'C' ? [
  {t: STOP, a: 0.4, z: 0.02},      // small thump under the pull-back as the street stops
] : [
  {t: R.d3, a: 0.4, z: 0.02},      // jolt on the cut to the driver's face
];
export const WHIPS: Whip[] = [];
export const FLASHES: Flash[] = [];
