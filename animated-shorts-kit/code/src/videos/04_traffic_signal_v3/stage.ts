// Traffic Signal V3 staging — rebuilt fresh from 01_example pattern (NOT v1's compromises).
// Design rules for v2: hero subject LARGE, reactions front/3-4, chaos must READ before the fix,
// the all-stop + girl crossing is the HERO beat (signal + Morgan + girl + framing cars all visible),
// the payoff is a readable $40,000 cheque board (v1's coins were invisible).
// Downtown crossing at x~0.8 (lanes z 11.7 / 14.4), workshop inside the grocery set (x~12).
// People order is FIXED inside each shot (velocities() relies on it).
import {TOTAL, shotAt, W, cl, sm01, type V3} from '../../engine/core/clock';
import {autoGaze, carOn} from '../../engine/core/staging';
import {PersonP, seq} from '../../engine/chars/rig';
import type {CarP, MeterP, Things} from '../../engine/kits/downtown/street';
import type {CartP} from '../../engine/kits/grocery/store';
import type {SignalP, SignalState} from './signal';
export {TOTAL, shotAt};
export type Stage = {people: PersonP[]; carts: CartP[]; extra: string[]; cars: CarP[]; meters: MeterP[]; things: Things; clock: number; nStoryCars: number; signal: SignalP | null; board: boolean};

const SIG: V3 = [2.4, 0, 7.9];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** V3 crank angle with RESISTANCE: slow bite at the start, a cog ripple mid-turn, settle at
    the end — never the old linear (lf * k) wind. `turns` = full revolutions over `dur` frames. */
const crankAngle = (lf: number, dur: number, turns: number) => {
  const u = cl(lf / dur); if (u <= 0) return 0;
  const e = u + (sm01(u) - u) * 0.55;
  return turns * Math.PI * 2 * e + Math.sin(u * turns * Math.PI * 2) * 0.05 * (1 - u);
};
/** looping traffic: x wraps -26..30 in its lane */
const traffic = (lf: number, z: number, dir: 1 | -1, speed: number, off: number, col: string): CarP => {
  const span = 56, d = ((off + lf * speed) % span + span) % span, x = dir === 1 ? -26 + d : 30 - d;
  return {p: [x, 0, z], ry: dir === 1 ? 0 : Math.PI, col, spin: (off + lf * speed) / 0.36};
};
const parked = (): CarP[] => [{p: [6.75, 0, 9.45], ry: Math.PI, col: '#3f6a4a'}, {p: [-6.75, 0, 9.45], ry: Math.PI, col: '#c9a24a'}];
const stoppedPair = (): CarP[] => [{p: [-4.6, 0, 11.7], ry: 0, col: '#2f4f6a', driver: '#3f4a66'}, {p: [5.6, 0, 14.4], ry: Math.PI, col: '#a8443a', driver: '#7a3b22'}];

export function stage(f: number): Stage {
  const s = shotAt(f), lf = s.lf, P: PersonP[] = [], K: CarP[] = [...parked()], Mt: MeterP[] = [];
  let things: Things = {}, signal: SignalP | null = {p: SIG, ry: 0.15, state: 'oldgo'}, board = false;
  const flip = (n: number): SignalState => (Math.floor(lf / n) % 2 === 0 ? 'oldgo' : 'oldstop');
  switch (s.name) {
    case 'hook': {
      P.push({who: 'mechanic', p: [-0.7, 0, 7.4], ...seq(lf, [[0, 'idle', 'happy'], [15, 'present', 'proud']]), talk: true, gaze: 'cam'});
      P.push({who: 'woman', p: [0.9, 0, 7.55], act: 'idle', expr: 'happy'});
      P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'happy', gaze: [SIG[0], 2.4, SIG[2]]});
      K.push(...stoppedPair());
      signal = {p: SIG, ry: 0.15, state: 'everywhere'};
      break;
    }
    case 'intro': {
      const u = sm01(cl(lf / 90)), mx = lerp(-4.2, -1.2, u);
      P.push({who: 'mechanic', p: [mx, 0, 7.45], ...seq(lf, [[0, 'walk', 'neutral'], [90, 'idle', 'worried'], [150, 'point', 'worried']]), talk: true, gaze: [SIG[0], 2.2, SIG[2]]});
      P.push({who: 'woman', p: [5.9, 0, 7.6], act: 'idle', expr: 'worried'});
      P.push({who: 'kid', p: [6.6, 0, 7.55], act: 'idle', expr: 'worried'});
      K.push(traffic(lf, 11.7, 1, 0.16, 14, '#7a2f2a'), traffic(lf, 14.4, -1, 0.15, 26, '#2f4f6a'), traffic(lf, 11.7, 1, 0.16, 40, '#3f6a4a'));
      signal = {p: SIG, ry: 0.15, state: flip(36)};
      break;
    }
    case 'twowords': {
      // CHAOS: signal flips fast with NO warning; two cars cross the centre at the same moment (~lf 100)
      // exactly when Morgan points on the word "warning".
      const wp = W('twowords', 'warning');
      P.push({who: 'mechanic', p: [-0.9, 0, 7.5], ...seq(lf, [[0, 'idle', 'worried'], [wp, 'point', 'surprised'], [wp + 55, 'idle', 'worried']]), gaze: [SIG[0], 2.2, SIG[2]]});
      P.push({who: 'woman', p: [3.1, 0, 7.55], act: 'idle', expr: 'worried'});
      P.push({who: 'kid', p: [3.8, 0, 7.5], act: 'idle', expr: 'worried'});
      K.push(traffic(lf, 11.7, 1, 0.17, 9, '#7a2f2a'), traffic(lf, 14.4, -1, 0.16, 14, '#2f4f6a'), traffic(lf, 11.7, 1, 0.17, 38, '#5a3a5a'), traffic(lf, 14.4, -1, 0.16, 44, '#3f6a4a'));
      signal = {p: SIG, ry: 0.15, state: flip(24)};
      break;
    }
    case 'crash': {
      // Timed to the WORDS: movement starts on "A car swung…" (lf~54), both cars brake hard and stop
      // nose-to-nose with the horse on "Crash." (lf~195). Horse + kid cross together, kid holds the rope.
      const ku = lf < 40 ? 0 : sm01(cl((lf - 40) / 155)), kz = lerp(17.6, 13.1, ku);
      const moving = lf >= 40 && lf < 195;
      P.push({who: 'mechanic', p: [-1.7, 0, 7.55], ...seq(lf, [[0, 'idle', 'worried'], [185, 'point', 'surprised'], [230, 'idle', 'worried']]), gaze: [0.4, 1.2, 13]});
      P.push({who: 'woman', p: [-2.9, 0, 7.5], ...seq(lf, [[0, 'idle', 'worried'], [195, 'idle', 'surprised']])});
      P.push({who: 'kid', p: [1.95, 0, kz + 0.15], ...seq(lf, [[0, 'idle', 'worried'], [40, 'walk', 'neutral'], [150, 'walk', 'worried'], [195, 'idle', 'shock'], [235, 'idle', 'surprised']]), gaze: [-3.5, 1, 11.7]});
      K.push(carOn([[54, -17, 11.7], [165, -4.6, 11.7], [195, -3.5, 11.7], [261, -3.5, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
             carOn([[54, 19, 14.4], [165, 5.6, 14.4], [195, 4.6, 14.4], [261, 4.6, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
      things = {horse: {p: [0.4, 0, kz], dir: -1, bob: moving ? Math.abs(Math.sin(lf * 0.25)) * 0.05 : 0, rope: [1.95, 0.78, kz + 0.15]}};
      signal = {p: SIG, ry: 0.15, state: lf < 195 ? flip(24) : 'oldstop'};
      break;
    }
    case 'build': {
      P.push({who: 'mechanic', p: [11.35, 0, 0.35], ...seq(lf, [[0, 'think', 'worried'], [60, 'pull', 'neutral'], [120, 'point', 'proud'], [175, 'present', 'proud']]), talk: true, gaze: [12.7, 1.6, 0.1]});
      signal = {p: [12.7, 0, 0.1], ry: -0.35, state: 'build', crank: lf >= 60 && lf < 120 ? crankAngle(lf - 60, 60, 1.0) : 0};
      things = {bulb: {p: [11.3, 2.05, 0.35], k: lf >= 105 && lf <= 185 ? Math.min(1, (lf - 105) / 8) : 0}};
      break;
    }
    case 'third': {
      const wg = W('third', 'Go'), we = W('third', 'Everywhere');
      P.push({who: 'mechanic', p: [1.2, 0, 7.5], ...seq(lf, [[0, 'pull', 'neutral'], [we + 6, 'present', 'proud']]), talk: true, gaze: 'cam'});
      P.push({who: 'woman', p: [3.2, 0, 7.55], ...seq(lf, [[0, 'idle', 'surprised'], [we + 10, 'idle', 'happy']])});
      P.push({who: 'kid', p: [3.9, 0, 7.5], ...seq(lf, [[0, 'idle', 'surprised'], [we + 10, 'cheer', 'grin']])});
      K.push(...stoppedPair());
      signal = {p: SIG, ry: 0.15, state: lf < wg ? 'stop' : lf < we ? 'go' : 'everywhere', crank: lf < we ? crankAngle(lf, Math.max(we, 1), 1.05) : 0};
      break;
    }
    case 'laugh': {
      const wq = W('laugh', 'signal');
      P.push({who: 'man', p: [-0.7, 0, 10.3], ...seq(lf, [[0, 'idle', 'happy'], [wq, 'talk', 'grin']]), talk: lf >= wq, gaze: [1.8, 1.2, 7.8]});
      P.push({who: 'mechanic', p: [1.8, 0, 7.8], ...seq(lf, [[0, 'idle', 'neutral'], [wq, 'shrug', 'smug'], [wq + 70, 'idle', 'smug']]), gaze: [-0.7, 1.2, 10.3]});
      P.push({who: 'youngman', p: [-2.3, 0, 8.2], ...seq(lf, [[0, 'idle', 'happy'], [wq + 10, 'bounce', 'grin']])});
      P.push({who: 'shopper2', p: [3.4, 0, 7.6], act: 'idle', expr: 'smug'});
      K.push({p: [-3.6, 0, 11.7], ry: 0, col: '#7a2f2a'});
      signal = {p: SIG, ry: 0.15, state: 'everywhere'};
      break;
    }
    case 'test': {
      // HERO BEAT, timed to the words: crank (lf 0-36) -> cars brake and are STOPPED by "Every car
      // stopped." (lf~157) -> girl starts on "girl" (lf~240) and completes the crossing at the shot's
      // last frame ("…without running." lf~309). Cars stop FLANKING her path, never swallowing the frame.
      const kz = lf < 230 ? 8.35 : lerp(8.35, 15.6, sm01(cl((lf - 230) / 82)));
      P.push({who: 'mechanic', p: [1.55, 0, 7.55], ...seq(lf, [[0, 'pull', 'neutral'], [36, 'present', 'proud'], [250, 'idle', 'happy']]), talk: lf < 165, gaze: [0.2, 1, 13]});
      P.push({who: 'woman', p: [0.1, 0, 7.45], ...seq(lf, [[0, 'idle', 'worried'], [160, 'idle', 'happy'], [285, 'cheer', 'happy']]), gaze: [0.2, 0.8, 13]});
      P.push({who: 'kid', p: [0.2, 0, kz], ...seq(lf, [[0, 'idle', 'worried'], [150, 'idle', 'happy'], [230, 'walk', 'happy'], [306, 'idle', 'happy']]), gaze: [0.2, 1, 20]});
      K.push(carOn([[0, -18, 11.7], [120, -5.2, 11.7], [160, -4.4, 11.7], [312, -4.4, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
             carOn([[0, 20, 14.4], [125, 6.2, 14.4], [165, 5.4, 14.4], [312, 5.4, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
      signal = {p: SIG, ry: 0.15, state: 'everywhere', crank: lf < 36 ? crankAngle(lf, 36, 0.85) : 0};
      break;
    }
    case 'payoff': {
      // The GE gentleman stands by his CHEQUE BOARD from the start; on "paid" he presents it,
      // and the camera pushes in on the board at "dollars" so $40,000 is READ, not glimpsed.
      P.push({who: 'mechanic', p: [0.2, 0, 7.5], ...seq(lf, [[0, 'present', 'proud']]), talk: true, gaze: 'cam'});
      P.push({who: 'shopper2', p: [1.7, 0, 7.55], ...seq(lf, [[0, 'idle', 'smug'], [54, 'present', 'happy']]), gaze: [0.2, 1.2, 7.5]});
      P.push({who: 'woman', p: [lerp(-2, -7, cl(lf / 140)), 0, 19.6], act: 'walk', expr: 'happy'});
      P.push({who: 'kid', p: [lerp(-1.2, -6.2, cl(lf / 140)), 0, 19.55], act: 'walk', expr: 'happy'});
      K.push(traffic(lf, 11.7, 1, 0.12, 8, '#7a2f2a'), traffic(lf, 14.4, -1, 0.11, 30, '#2f4f6a'));
      board = true;
      signal = {p: SIG, ry: 0.15, state: (['stop', 'go', 'everywhere'] as SignalState[])[Math.floor(lf / 45) % 3]};
      break;
    }
    case 'ending': {
      const ku = cl((lf - 10) / 140);
      P.push({who: 'mechanic', p: [1.5, 0, 6.9], act: 'idle', expr: 'proud', gaze: [SIG[0], 2.6, SIG[2]]});
      P.push({who: 'woman', p: [-1.4, 0, lerp(7.7, 15.4, ku)], ...seq(lf, [[0, 'idle', 'happy'], [10, 'walk', 'happy'], [150, 'idle', 'happy']])});
      P.push({who: 'kid', p: [-0.65, 0, lerp(7.7, 15.4, ku)], ...seq(lf, [[0, 'idle', 'happy'], [10, 'walk', 'grin'], [150, 'cheer', 'grin']])});
      K.push(...stoppedPair());
      signal = {p: SIG, ry: 0.15, state: 'yellow'};
      break;
    }
  }
  autoGaze(P, Mt);
  return {people: P, carts: [], extra: [], cars: K, meters: Mt, things, clock: 9 + f / 30 / 120, nStoryCars: K.length, signal, board};
}
