// HOOK VARIANTS ROUND 2 camera — the editing language is the brief: graph-curved moves,
// punch settles on word beats, kicks/flashes keyed to REAL word times ("stopped" = 2.153 s;
// F's impact cut lands at its SHOT_REAL 2.1667, the first frozen frame).
//   E: ONE take, zero cuts — street-level tracking of the rolling car, an arc onto Morgan
//      through the slow-mo, then a low hero sweep with an accelerating ('in') push.
//   F: four punch shots — settle-punches on the cuts, an accelerating push through f2, the
//      frozen f4 opening (dead-still key), then a dolly pull-back release.
//   G: shots get shorter and tighter (MCU -> CU -> ECU), heartbeat kicks accelerate, the g3
//      key is dead still through the freeze, g4 releases wide with a settle + slow push.
//   H: one orbiting take on a slow-fast-slow arc around the assembling signal, ending in a
//      low-angle (el 2) hero push on Morgan.
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
const STOP = 2.153;   // the word the whole hook turns on

export const TAKES: Take[] = VARIANT === 'E' ? [
  {name: 'hook', why: 'continuous: track the fast car, arc onto Morgan through the slow-mo, low hero sweep out', keys: [
    K(R.hook, 'car:2', 'FS', 70, 6, 44, {push: 1.0, arc: 0}),
    K(1.15, 'mechanic', 'MS', 30, 5, 42, {move: 'arc', lead: 0.15, dur: 1.0, push: 1.04, arc: 0}),
    K(2.75, 'mechanic', 'MCU', -18, 3, 40, {move: 'arc', lead: 0.2, dur: 1.5, push: 1.08, ease: 'in', arc: 0})]},
] : VARIANT === 'H' ? [
  {name: 'hook', why: 'one orbit around the assembling signal (slow-fast-slow arc), low hero push for the tail', keys: [
    K(R.hook, ['mechanic', 'prop:signal'], 'FS', 55, 10, 44, {push: 1.0, arc: 0}),
    K(1.45, ['mechanic', 'prop:signal'], 'FS', 6, 6, 42, {move: 'arc', lead: 0.25, dur: 2.1, push: 1.03, arc: 0}),
    K(3.1, 'mechanic', 'MS', 10, 2, 40, {move: 'dolly', lead: 0.3, dur: 1.2, push: 1.07, ease: 'in', arc: 0})]},
] : VARIANT === 'F' ? [
  {name: 'f1', why: 'wide crossing, props dropping in, traffic rolling', keys: [
    K(R.f1, ['mechanic', 'prop:signal'], 'FS', 18, 8, 44, {push: 1.02, arc: 0})]},
  {name: 'f2', why: 'punch-in on Morgan (settle punch + accelerating push), traffic closing in', keys: [
    K(R.f2, 'mechanic', 'MS', 24, 5, 42, {push: 1.12, ease: 'in', settle: [0.16, 0.2], arc: 0})]},
  {name: 'f3', why: 'signal CU punch on "road," — the stop creeps in under it', keys: [
    K(R.f3, 'prop:signal', 'CU', 6, 12, 40, {push: 1.03, settle: [0.14, 0.18], arc: 0})]},
  {name: 'f4', why: 'impact cut: frozen opening (dead-still key), then the pull-back release', keys: [
    K(R.f4, ['mechanic', 'prop:signal'], 'MS', 18, 8, 44, {push: 1.0, settle: [0, 0.01], arc: 0}),
    K(3.35, ['mechanic', 'prop:signal'], 'FS', 18, 8, 44, {move: 'dolly', lead: 0.3, dur: 1.3, push: 0.96, arc: 0})]},
] : [
  {name: 'g1', why: 'tight CU, held breath: a slow accelerating creep on Morgan', keys: [
    K(R.g1, 'mechanic', 'CU', 12, 5, 36, {push: 1.05, ease: 'in', settle: [0, 0.01], arc: 0})]},
  {name: 'g2', why: 'signal CU, crank turning, push accelerating with the pressure', keys: [
    K(R.g2, 'prop:signal', 'CU', 6, 12, 40, {push: 1.07, ease: 'in', settle: [0.1, 0.25], arc: 0})]},
  {name: 'g3', why: 'ECU on Morgan — dead still through the freeze (push 1, arc 0)', keys: [
    K(R.g3, 'mechanic', 'ECU', 4, 3, 36, {push: 1.0, settle: [0, 0.01], arc: 0, ecu: true})]},
  {name: 'g4', why: 'release: wide reveal with a settle, then one slow push on the grin', keys: [
    K(R.g4, ['mechanic', 'prop:signal'], 'FS', 18, 8, 44, {push: 1.0, settle: [0.12, 0.3], arc: 0}),
    K(3.6, 'mechanic', 'MS', 16, 5, 42, {move: 'dolly', lead: 0.3, dur: 1.2, push: 1.06, arc: 0})]},
];

export const KICKS: Kick[] = VARIANT === 'E' ? [
  {t: STOP, a: 0.9, z: 0.07},          // snap-stop impact, exactly on the word
] : VARIANT === 'H' ? [
  {t: STOP, a: 0.75, z: 0.05},         // shockwave hit
] : VARIANT === 'F' ? [
  {t: R.f4, a: 1.0, z: 0.08},          // the impact cut itself
] : [
  {t: 1.55, a: 0.16, z: 0.008},        // heartbeat pulses, accelerating + growing
  {t: 1.8, a: 0.2, z: 0.01},
  {t: 2.02, a: 0.26, z: 0.012},
  {t: STOP, a: 0.5, z: 0.03},          // the slam into the dead stop
  {t: R.g4, a: 0.65, z: 0.045},        // the release
];

export const WHIPS: Whip[] = [];

export const FLASHES: Flash[] = VARIANT === 'E' ? [
  {t: 0.196, a: 0.14}, {t: 0.337, a: 0.14}, {t: 0.491, a: 0.15}, {t: 0.662, a: 0.15}, {t: 0.862, a: 0.17},   // assemble landings (realOf of the staging landings)
  {t: STOP, a: 0.5},                   // impact flash on "stopped"
] : VARIANT === 'H' ? [
  {t: 0.45, a: 0.18}, {t: 0.75, a: 0.18}, {t: 1.05, a: 0.2}, {t: 1.35, a: 0.2}, {t: 1.65, a: 0.22},   // assemble landings
  {t: STOP, a: 0.5},
] : VARIANT === 'F' ? [
  {t: R.f2, a: 0.16}, {t: R.f3, a: 0.16},   // punch pops on the cuts
  {t: R.f4, a: 0.6},                        // impact flash on the frozen frame
] : [
  {t: R.g4, a: 0.35},                       // release flash (G stays dark + held until here)
];
