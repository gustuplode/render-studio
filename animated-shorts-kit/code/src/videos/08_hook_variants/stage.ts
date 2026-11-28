// HOOK VARIANTS A-D staging — the V4 hook beat, re-cut per variant. Same base: Morgan presenting
// at the downtown crossing (mechanic [-0.7, 7.4]), woman + kid on the sidewalk, the T-signal on
// EVERYWHERE, two stopped cars flanking the crossing. Differences are ONLY camera (takes.ts),
// the cars' motion (A/B/D roll in and brake-lock on "stopped", C starts stopped) and the
// expressions (emo = the shared engine's HOOK PASS intensity, 0 = film register, 1 = max).
// Frame map (global @30fps): He 12, added 16, one 26, word 32, to 40, the 44, road 50, and 58,
// stopped 65, every 79, car 89, at 95, once 99. D's local frames are per-shot (see timeline.ts).
import {TOTAL, shotAt, W, cl, sm01, type V3} from '../../engine/core/clock';
import {autoGaze, carOn} from '../../engine/core/staging';
import {PersonP, seq} from '../../engine/chars/rig';
import type {CarP, MeterP, Things} from '../../engine/kits/downtown/street';
import type {CartP} from '../../engine/kits/grocery/store';
import type {SignalP} from './signal';
import {VARIANT} from './variant';
export {TOTAL, shotAt};
export type Stage = {people: PersonP[]; carts: CartP[]; extra: string[]; cars: CarP[]; meters: MeterP[]; things: Things; clock: number; nStoryCars: number; signal: SignalP | null; board: boolean};

const SIG: V3 = [2.4, 0, 7.9];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const parked = (): CarP[] => [{p: [6.75, 0, 9.45], ry: Math.PI, col: '#3f6a4a'}, {p: [-6.75, 0, 9.45], ry: Math.PI, col: '#c9a24a'}];
const stoppedPair = (): CarP[] => [{p: [-4.6, 0, 11.7], ry: 0, col: '#2f4f6a', driver: '#3f4a66'}, {p: [5.6, 0, 14.4], ry: Math.PI, col: '#a8443a', driver: '#7a3b22'}];
/** cars roll in fast, then brake-lock exactly on "stopped" (lf 64) — smootherstep decel + carOn brake pitch */
const rollingPair = (lf: number): CarP[] => [
  carOn([[0, -14, 11.7], [40, -6, 11.7], [64, -4.6, 11.7], [150, -4.6, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
  carOn([[0, 16, 14.4], [40, 8, 14.4], [64, 5.6, 14.4], [150, 5.6, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'),
];
const MORGAN: V3 = [-0.7, 0, 7.4];
const MAN: V3 = [-3.9, 0, 10.15];   // driver standing at his stopped car's door (clear of both car boxes)

export function stage(f: number): Stage {
  const s = shotAt(f), lf = s.lf, P: PersonP[] = [], K: CarP[] = [...parked()], Mt: MeterP[] = [];
  let things: Things = {}, signal: SignalP | null = {p: SIG, ry: 0.15, state: 'everywhere'}, board = false;
  switch (s.name) {
    case 'hook': {
      if (VARIANT === 'A') {
        // TRIUMPH: Morgan speaks, then the big winning smile + proud shoulders on "stopped" as
        // both cars halt in one jolt; woman gasps, kid cheers.
        P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'idle', 'happy'], [15, 'present', 'proud'], [65, 'proud', 'grin']]), talk: true, gaze: 'cam', emo: 0.8});
        P.push({who: 'woman', p: [0.9, 0, 7.55], ...seq(lf, [[0, 'idle', 'happy'], [65, 'idle', 'surprised']]), emo: 0.7});
        P.push({who: 'kid', p: [1.7, 0, 7.5], ...seq(lf, [[0, 'idle', 'happy'], [65, 'cheer', 'grin']]), emo: 0.7, gaze: [SIG[0], 2.4, SIG[2]]});
        K.push(...rollingPair(lf));
      } else if (VARIANT === 'B') {
        // CALM-CONFIDENT: Morgan presents while the world orbits him; the driver watches the
        // signal and snaps surprised as the cars stop; woman + kid turn happy.
        P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'idle', 'happy'], [27, 'present', 'proud'], [65, 'present', 'grin']]), talk: true, gaze: 'cam', emo: 0.6});
        P.push({who: 'woman', p: [0.9, 0, 7.55], ...seq(lf, [[0, 'idle', 'worried'], [65, 'idle', 'happy']]), emo: 0.5});
        P.push({who: 'kid', p: [1.7, 0, 7.5], ...seq(lf, [[0, 'idle', 'worried'], [65, 'idle', 'happy']]), emo: 0.6, gaze: [SIG[0], 2.4, SIG[2]]});
        P.push({who: 'man', p: MAN, ...seq(lf, [[0, 'idle', 'neutral'], [65, 'idle', 'surprised']]), emo: 0.8, gaze: [SIG[0], 1.5, SIG[2]]});
        K.push(...rollingPair(lf));
      } else {
        // C — EMOTION CLOSE-UP: the street is already stopped; the whole beat is Morgan's face
        // (surprise -> resolve) until the pull-back reveals the stopped street and the cheering kid.
        P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'talk', 'surprised'], [40, 'cross', 'angry']]), talk: true, gaze: 'cam', emo: 1.0, blinkF: [41]});
        P.push({who: 'woman', p: [0.9, 0, 7.55], ...seq(lf, [[0, 'idle', 'surprised'], [79, 'cheer', 'happy']]), emo: 0.8});
        P.push({who: 'kid', p: [1.7, 0, 7.5], ...seq(lf, [[0, 'idle', 'worried'], [79, 'cheer', 'grin']]), emo: 0.8, gaze: [SIG[0], 2.4, SIG[2]]});
        K.push(...stoppedPair());
      }
      break;
    }
    case 'd1': {
      // D, shot 1 (lf 0-57): street wide — Morgan speaking, traffic rolling in.
      P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'present', 'happy']]), talk: true, gaze: 'cam', emo: 0.6});
      P.push({who: 'woman', p: [0.9, 0, 7.55], act: 'idle', expr: 'happy', emo: 0.7});
      P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'happy', emo: 0.7, gaze: [SIG[0], 2.4, SIG[2]]});
      P.push({who: 'man', p: MAN, act: 'idle', expr: 'neutral', emo: 0.6, gaze: [SIG[0], 1.5, SIG[2]]});
      K.push(carOn([[0, -14, 11.7], [40, -6, 11.7], [58, -4.8, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
             carOn([[0, 16, 14.4], [40, 8, 14.4], [58, 6.0, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
      break;
    }
    case 'd2': {
      // D, shot 2 (lf 0-11, old 58-69): signal close-up. The cut itself is the snap — Morgan is
      // already in the hard stare from this shot's first frame; warp() freezes lf at 6 (real 64-69).
      P.push({who: 'mechanic', p: MORGAN, act: 'idle', expr: 'angry', talk: true, gaze: 'cam', emo: 1.0});
      // woman pulled to x 0.4 so her face is fully OUT of the signal CU (was half-cut at the edge)
      P.push({who: 'woman', p: [0.4, 0, 7.55], act: 'idle', expr: 'surprised', emo: 0.7});
      P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'surprised', emo: 0.7, gaze: [SIG[0], 2.4, SIG[2]]});
      P.push({who: 'man', p: MAN, act: 'idle', expr: 'surprised', emo: 0.8, gaze: [SIG[0], 1.5, SIG[2]]});
      K.push(carOn([[0, -4.8, 11.7], [6, -4.6, 11.7], [12, -4.6, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
             carOn([[0, 6.0, 14.4], [6, 5.6, 14.4], [12, 5.6, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
      break;
    }
    case 'd3': {
      // D, shot 3 (lf 0-23, old 70-93): the startled driver's face, CU. Double-blink on the cut.
      P.push({who: 'man', p: MAN, act: 'idle', expr: 'shock', emo: 1.0, gaze: 'cam', blinkF: [76, 82]});
      P.push({who: 'mechanic', p: MORGAN, act: 'idle', expr: 'angry', gaze: 'cam', emo: 1.0});
      P.push({who: 'woman', p: [0.9, 0, 7.55], act: 'idle', expr: 'surprised', emo: 0.7});
      P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'surprised', emo: 0.7, gaze: [SIG[0], 2.4, SIG[2]]});
      K.push(...stoppedPair());
      break;
    }
    case 'd4': {
      // D, shot 4 (lf 0-55, old 94-149): Morgan's hard stare, MCU, held through "at once." and
      // the tail — he is NOT speaking here, the narrator is. Kid cheers behind him.
      P.push({who: 'mechanic', p: MORGAN, act: 'cross', expr: 'angry', gaze: 'cam', emo: 1.0});
      P.push({who: 'woman', p: [0.9, 0, 7.55], act: 'idle', expr: 'happy', emo: 0.7});
      P.push({who: 'kid', p: [1.7, 0, 7.5], ...seq(lf, [[0, 'idle', 'happy'], [14, 'cheer', 'grin']]), emo: 0.7, gaze: [SIG[0], 2.4, SIG[2]]});
      // NOTE: the driver ('man') is NOT in d4 — he stands behind the d4 camera and his projected
      // box flipped across the frame (FGBLOCK x21). He served his beat in d3; d4 is Morgan alone.
      K.push(...stoppedPair());
      break;
    }
  }
  autoGaze(P, Mt);
  return {people: P, carts: [], extra: [], cars: K, meters: Mt, things, clock: 9 + f / 30 / 120, nStoryCars: K.length, signal, board};
}
