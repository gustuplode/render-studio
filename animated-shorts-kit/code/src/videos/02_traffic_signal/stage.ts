// Traffic Signal staging: who / what is where per frame. Downtown crossing at x~0.8 (lanes z 11.7 / 14.4),
// workshop beat inside the grocery set (x~12). People order is FIXED inside each shot (velocities() relies on it).
import {TOTAL, shotAt, W, cl, sm01, type V3} from '../../engine/core/clock';
import {autoGaze, carOn} from '../../engine/core/staging';
import {PersonP, seq} from '../../engine/chars/rig';
import type {CarP, MeterP, Things} from '../../engine/kits/downtown/street';
import type {CartP} from '../../engine/kits/grocery/store';
import type {SignalP, SignalState} from './signal';
export {TOTAL, shotAt};
export type Stage = {people: PersonP[]; carts: CartP[]; extra: string[]; cars: CarP[]; meters: MeterP[]; things: Things; clock: number; nStoryCars: number; signal: SignalP | null};

const SIG: V3 = [2.4, 0, 7.9];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** looping traffic: x wraps -26..30 in its lane */
const traffic = (lf: number, z: number, dir: 1 | -1, speed: number, off: number, col: string): CarP => {
  const span = 56, d = ((off + lf * speed) % span + span) % span, x = dir === 1 ? -26 + d : 30 - d;
  return {p: [x, 0, z], ry: dir === 1 ? 0 : Math.PI, col, spin: (off + lf * speed) / 0.36};
};
const parked = (): CarP[] => [{p: [6.75, 0, 9.45], ry: Math.PI, col: '#3f6a4a'}, {p: [-6.75, 0, 9.45], ry: Math.PI, col: '#c9a24a'}];
const stoppedPair = (): CarP[] => [{p: [-4.6, 0, 11.7], ry: 0, col: '#2f4f6a', driver: '#3f4a66'}, {p: [5.6, 0, 14.4], ry: Math.PI, col: '#a8443a', driver: '#7a3b22'}];

export function stage(f: number): Stage {
  const s = shotAt(f), lf = s.lf, P: PersonP[] = [], K: CarP[] = [...parked()], Mt: MeterP[] = [];
  let things: Things = {}, signal: SignalP | null = {p: SIG, ry: 0.15, state: 'oldgo'};
  const flip = (n: number): SignalState => (Math.floor(lf / n) % 2 === 0 ? 'oldgo' : 'oldstop');
  switch (s.name) {
    case 'hook': {
      P.push({who: 'mechanic', p: [-0.7, 0, 7.4], ...seq(lf, [[0, 'idle', 'happy'], [15, 'present', 'proud']]), gaze: 'cam'});
      P.push({who: 'woman', p: [0.9, 0, 7.55], act: 'idle', expr: 'happy'});
      P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'happy', gaze: [SIG[0], 2.4, SIG[2]]});
      K.push(...stoppedPair());
      signal = {p: SIG, ry: 0.15, state: 'everywhere'};
      break;
    }
    case 'intro': {
      const u = sm01(cl(lf / 90)), mx = lerp(-4.2, -1.2, u);
      P.push({who: 'mechanic', p: [mx, 0, 7.45], ...seq(lf, [[0, 'walk', 'neutral'], [90, 'idle', 'worried'], [150, 'point', 'worried']]), gaze: [SIG[0], 2.2, SIG[2]]});
      P.push({who: 'woman', p: [4.6, 0, 7.5], act: 'idle', expr: 'worried'});
      P.push({who: 'kid', p: [5.35, 0, 7.45], act: 'idle', expr: 'worried'});
      K.push(traffic(lf, 11.7, 1, 0.14, 14, '#7a2f2a'), traffic(lf, 14.4, -1, 0.13, 26, '#2f4f6a'), traffic(lf, 11.7, 1, 0.14, 40, '#3f6a4a'));
      signal = {p: SIG, ry: 0.15, state: flip(36)};
      break;
    }
    case 'twowords': {
      const wp = W('twowords', 'warning');
      P.push({who: 'mechanic', p: [-0.9, 0, 7.5], ...seq(lf, [[0, 'idle', 'worried'], [wp, 'point', 'surprised'], [wp + 55, 'idle', 'worried']]), gaze: [SIG[0], 2.2, SIG[2]]});
      P.push({who: 'woman', p: [3.1, 0, 7.55], act: 'idle', expr: 'worried'});
      P.push({who: 'kid', p: [3.8, 0, 7.5], act: 'idle', expr: 'worried'});
      K.push(traffic(lf, 11.7, 1, 0.15, 18, '#7a2f2a'), traffic(lf, 14.4, -1, 0.14, 20, '#2f4f6a'), traffic(lf, 11.7, 1, 0.15, 38, '#5a3a5a'), traffic(lf, 14.4, -1, 0.14, 44, '#3f6a4a'));
      signal = {p: SIG, ry: 0.15, state: flip(30)};
      break;
    }
    case 'crash': {
      const hz = lf < 52 ? lerp(17.8, 12.3, sm01(cl(lf / 52))) : 12.3;
      P.push({who: 'mechanic', p: [-1.6, 0, 7.55], ...seq(lf, [[0, 'idle', 'worried'], [46, 'point', 'surprised'], [95, 'idle', 'worried']]), gaze: [1.6, 1.2, 12.3]});
      P.push({who: 'woman', p: [-2.7, 0, 7.5], act: 'idle', expr: 'worried'});
      P.push({who: 'kid', p: [3.9, 0, hz + 0.2], ...seq(lf, [[0, 'walk', 'neutral'], [52, 'idle', 'shock'], [115, 'idle', 'surprised']]), gaze: [-1.2, 1, 11.7]});
      K.push(carOn([[0, -15, 11.7], [52, -1.2, 11.7], [261, -1.2, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
             carOn([[0, 18, 14.4], [58, 0.4, 14.4], [261, 0.4, 14.4]], lf, '#a8443a', Math.PI));
      things = {horse: {p: [1.6, 0, hz], dir: -1, bob: lf < 52 ? Math.abs(Math.sin(lf * 0.3)) * 0.04 : 0, rope: [3.9, 0.78, hz + 0.2]}};
      signal = {p: SIG, ry: 0.15, state: lf < 52 ? flip(30) : 'oldstop'};
      break;
    }
    case 'build': {
      P.push({who: 'mechanic', p: [11.35, 0, 0.35], ...seq(lf, [[0, 'think', 'worried'], [60, 'pull', 'neutral'], [120, 'point', 'proud'], [175, 'present', 'proud']]), gaze: [12.7, 1.6, 0.1]});
      signal = {p: [12.7, 0, 0.1], ry: -0.35, state: 'build', crank: lf >= 60 && lf < 120 ? (lf - 60) * 0.1 : 0};
      things = {bulb: {p: [11.3, 2.1, 0.35], k: lf >= 105 && lf <= 180 ? Math.min(1, (lf - 105) / 8) : 0}};
      break;
    }
    case 'third': {
      const wg = W('third', 'Go'), we = W('third', 'Everywhere');
      P.push({who: 'mechanic', p: [1.2, 0, 7.5], ...seq(lf, [[0, 'pull', 'neutral'], [we + 6, 'present', 'proud']]), gaze: 'cam'});
      P.push({who: 'woman', p: [3.2, 0, 7.55], ...seq(lf, [[0, 'idle', 'surprised'], [we + 10, 'idle', 'happy']])});
      P.push({who: 'kid', p: [3.9, 0, 7.5], ...seq(lf, [[0, 'idle', 'surprised'], [we + 10, 'cheer', 'grin']])});
      K.push(...stoppedPair());
      signal = {p: SIG, ry: 0.15, state: lf < wg ? 'stop' : lf < we ? 'go' : 'everywhere', crank: lf < we ? lf * 0.12 : 0};
      break;
    }
    case 'laugh': {
      const wq = W('laugh', 'signal');
      P.push({who: 'man', p: [-0.7, 0, 10.3], ...seq(lf, [[0, 'idle', 'happy'], [wq, 'talk', 'grin']]), talk: lf >= wq, gaze: [1.8, 1.2, 7.8]});
      P.push({who: 'mechanic', p: [1.8, 0, 7.8], ...seq(lf, [[0, 'idle', 'neutral'], [wq, 'shrug', 'smug'], [wq + 70, 'idle', 'smug']]), gaze: [-0.7, 1.2, 10.3]});
      P.push({who: 'youngman', p: [-2.3, 0, 8.2], act: 'idle', expr: 'happy'});
      P.push({who: 'shopper2', p: [3.4, 0, 7.6], act: 'idle', expr: 'smug'});
      K.push({p: [-3.6, 0, 11.7], ry: 0, col: '#7a2f2a'});
      signal = {p: SIG, ry: 0.15, state: 'everywhere'};
      break;
    }
    case 'test': {
      const ku = cl((lf - 70) / 200), kz = lerp(7.7, 15.4, ku);
      P.push({who: 'mechanic', p: [1.55, 0, 7.55], ...seq(lf, [[0, 'pull', 'neutral'], [36, 'present', 'proud'], [210, 'idle', 'happy']]), gaze: [0.9, 1, 13]});
      P.push({who: 'woman', p: [0.1, 0, 7.45], ...seq(lf, [[0, 'idle', 'worried'], [275, 'idle', 'happy']]), gaze: [0.9, 0.8, 13]});
      P.push({who: 'kid', p: [0.9, 0, kz], ...seq(lf, [[0, 'idle', 'worried'], [70, 'walk', 'happy'], [270, 'idle', 'happy']]), gaze: [0.9, 1, 20]});
      K.push(carOn([[0, -16, 11.7], [55, -4.4, 11.7], [312, -4.4, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
             carOn([[0, 18, 14.4], [60, 5.4, 14.4], [312, 5.4, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
      signal = {p: SIG, ry: 0.15, state: 'everywhere', crank: lf < 36 ? lf * 0.15 : 0};
      break;
    }
    case 'payoff': {
      P.push({who: 'mechanic', p: [0.2, 0, 7.5], ...seq(lf, [[0, 'present', 'proud']]), gaze: 'cam'});
      P.push({who: 'shopper2', p: [1.7, 0, 7.55], ...seq(lf, [[0, 'idle', 'smug'], [40, 'present', 'happy']]), gaze: [0.2, 1.2, 7.5]});
      P.push({who: 'woman', p: [lerp(-2, -7, cl(lf / 140)), 0, 19.6], act: 'walk', expr: 'happy'});
      P.push({who: 'kid', p: [lerp(-1.2, -6.2, cl(lf / 140)), 0, 19.55], act: 'walk', expr: 'happy'});
      K.push(traffic(lf, 11.7, 1, 0.12, 8, '#7a2f2a'), traffic(lf, 14.4, -1, 0.11, 30, '#2f4f6a'));
      if (lf > 40) things = {coins: [{p: [0.95, 1.15, 7.5], n: 5, t: lf / 30}]};
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
  return {people: P, carts: [], extra: [], cars: K, meters: Mt, things, clock: 9 + f / 30 / 120, nStoryCars: K.length, signal};
}
