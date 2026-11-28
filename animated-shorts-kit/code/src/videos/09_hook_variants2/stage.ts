// HOOK VARIANTS ROUND 2 (E-H) staging — same V4 hook beat, re-choreographed per variant.
// Staging runs on the OLD (warped) clock: lf = local old frame in the current shot.
// The word "stopped" lands at old frame STOPF (E 49.2 / F 60 / G 57 / H 64.6) — every car's
// brake-lock, every reaction and every FX event is keyed to it. Emotions run at emo 0.9-1.0
// (the shared engine's HOOK PASS intensity) except G's deliberate escalation 0.5 -> 1.0.
//   E: Morgan WALKS in and raises his hand through the slow-mo, cars fly in fast, creep the
//      last metres in slow motion, snap-stop on the word.
//   F: traffic rolls across three punch shots, creeps to a stop inside the signal CU, and is
//      already frozen when the release shot opens (the freeze lives in f4's first frames).
//   G: everything creeps slower and slower (tension), locks at old 57 — which the warp then
//      HOLDS (dead stop) — and the release shot opens on stopped cars + Morgan's grin.
//   H: cars speed-ramp past below while the signal assembles; lock at 64.6 + shockwave (fx).
import {TOTAL, shotAt, cl, sm01, type V3} from '../../engine/core/clock';
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
const MORGAN: V3 = [-0.7, 0, 7.4];
const MAN: V3 = [-3.9, 0, 10.15];   // driver standing at his stopped car's door (clear of both car boxes)

export function stage(f: number): Stage {
  const s = shotAt(f), lf = s.lf, P: PersonP[] = [], K: CarP[] = [...parked()], Mt: MeterP[] = [];
  let things: Things = {}, signal: SignalP | null = {p: SIG, ry: 0.15, state: 'everywhere'}, board = false;
  const sigGaze: V3 = [SIG[0], 2.4, SIG[2]];

  if (VARIANT === 'E') {
    // ONE continuous beat. Morgan steps in (old 8-38) while the world is still fast, raises
    // his hand ('point') through the slow-mo stretch, and the cars — which flew in — creep
    // the last metres and SNAP-stop at lf 49.2. Reactions land on the same frame.
    const mx = lerp(-1.7, MORGAN[0], sm01(cl((lf - 8) / 30))), mz = lerp(7.1, MORGAN[2], sm01(cl((lf - 8) / 30)));
    P.push({who: 'mechanic', p: [mx, 0, mz], ...seq(lf, [[0, 'walk', 'happy'], [38, 'point', 'determined'], [50, 'proud', 'grin']]), talk: true, gaze: 'cam', emo: 1.0});
    P.push({who: 'woman', p: [0.9, 0, 7.55], ...seq(lf, [[0, 'idle', 'worried'], [50, 'idle', 'surprised'], [82, 'idle', 'happy']]), emo: 0.9});
    P.push({who: 'kid', p: [1.7, 0, 7.5], ...seq(lf, [[0, 'idle', 'worried'], [50, 'cheer', 'grin']]), emo: 0.9, gaze: sigGaze});
    P.push({who: 'man', p: MAN, ...seq(lf, [[0, 'idle', 'neutral'], [50, 'idle', 'shock']]), emo: 0.9, gaze: sigGaze});
    K.push(carOn([[0, -16, 11.7], [30, -9.5, 11.7], [42, -5.8, 11.7], [49.2, -4.6, 11.7], [150, -4.6, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
           carOn([[0, 17, 14.4], [30, 10.5, 14.4], [42, 6.6, 14.4], [49.2, 5.6, 14.4], [150, 5.6, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
  } else if (VARIANT === 'H') {
    // HERO ASSEMBLE. Morgan points at the signal assembling above the crossing (set.tsx swaps
    // in AssembleSignal), traffic speed-ramps past below, locks at 64.6; triumph on the word.
    P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'point', 'determined'], [65, 'proud', 'grin']]), talk: true, gaze: 'cam', emo: 0.95});
    P.push({who: 'woman', p: [0.9, 0, 7.55], ...seq(lf, [[0, 'idle', 'worried'], [65, 'idle', 'surprised'], [92, 'idle', 'happy']]), emo: 0.9});
    P.push({who: 'kid', p: [1.7, 0, 7.5], ...seq(lf, [[0, 'idle', 'worried'], [65, 'cheer', 'grin']]), emo: 0.9, gaze: sigGaze});
    P.push({who: 'man', p: [-4.2, 0, 10.25], ...seq(lf, [[0, 'idle', 'neutral'], [65, 'idle', 'shock']]), emo: 0.9, gaze: sigGaze});
    K.push(carOn([[0, -15, 11.7], [40, -8.5, 11.7], [56, -5.6, 11.7], [64.6, -4.6, 11.7], [147, -4.6, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
           carOn([[0, 16.5, 14.4], [40, 9.5, 14.4], [56, 6.5, 14.4], [64.6, 5.6, 14.4], [147, 5.6, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
  } else if (VARIANT === 'F') {
    switch (s.name) {
      case 'f1': {   // lf 0-25: wide, props drop in (props.tsx), traffic rolls in fast
        P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'present', 'happy']]), talk: true, gaze: 'cam', emo: 0.9});
        P.push({who: 'woman', p: [0.9, 0, 7.55], act: 'idle', expr: 'happy', emo: 0.8});
        P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'happy', emo: 0.8, gaze: sigGaze});
        P.push({who: 'man', p: MAN, act: 'idle', expr: 'neutral', emo: 0.7, gaze: sigGaze});
        K.push(carOn([[0, -13, 11.7], [25, -7.2, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
               carOn([[0, 15, 14.4], [25, 9.2, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
        break;
      }
      case 'f2': {   // lf 0-22 (old 26-48): punch-in on Morgan, traffic keeps coming
        P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'present', 'proud']]), talk: true, gaze: 'cam', emo: 1.0});
        P.push({who: 'woman', p: [0.9, 0, 7.55], act: 'idle', expr: 'worried', emo: 0.8});
        P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'worried', emo: 0.8, gaze: sigGaze});
        P.push({who: 'man', p: MAN, act: 'idle', expr: 'neutral', emo: 0.8, gaze: sigGaze});
        K.push(carOn([[0, -7.2, 11.7], [22, -5.1, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
               carOn([[0, 9.2, 14.4], [22, 6.5, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
        break;
      }
      case 'f3': {   // lf 0-10 (old 49-59): signal CU; cars creep their last metre off-frame
        P.push({who: 'mechanic', p: MORGAN, act: 'idle', expr: 'angry', talk: true, gaze: 'cam', emo: 1.0});
        P.push({who: 'woman', p: [0.4, 0, 7.55], act: 'idle', expr: 'surprised', emo: 0.8});   // pulled clear of the signal CU (round-1 fix)
        P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'surprised', emo: 0.8, gaze: sigGaze});
        P.push({who: 'man', p: MAN, act: 'idle', expr: 'surprised', emo: 0.9, gaze: sigGaze});
        K.push(carOn([[0, -5.1, 11.7], [10, -4.6, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
               carOn([[0, 6.5, 14.4], [10, 5.6, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
        break;
      }
      case 'f4': {   // lf 0-89 (old 60-149): opens FROZEN (warp holds old 60 for 5 real frames), then the release
        P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'proud', 'grin'], [42, 'present', 'grin']]), talk: true, gaze: 'cam', emo: 1.0});
        P.push({who: 'woman', p: [0.9, 0, 7.55], ...seq(lf, [[0, 'idle', 'surprised'], [12, 'idle', 'happy']]), emo: 0.9});
        P.push({who: 'kid', p: [1.7, 0, 7.5], ...seq(lf, [[0, 'cheer', 'grin']]), emo: 0.9, gaze: sigGaze});
        P.push({who: 'man', p: MAN, ...seq(lf, [[0, 'idle', 'shock'], [22, 'idle', 'happy']]), emo: 0.9, gaze: sigGaze});
        K.push(...stoppedPair());
        break;
      }
    }
  } else {   // G — TENSION BUILD
    switch (s.name) {
      case 'g1': {   // lf 0-41: tight and still; traffic creeps, nobody smiles yet
        P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'idle', 'neutral']]), talk: true, gaze: 'cam', emo: 0.5});
        P.push({who: 'woman', p: [0.9, 0, 7.55], act: 'idle', expr: 'worried', emo: 0.6});
        P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'worried', emo: 0.6, gaze: sigGaze});
        P.push({who: 'man', p: MAN, act: 'idle', expr: 'neutral', emo: 0.6, gaze: sigGaze});
        K.push(carOn([[0, -8.6, 11.7], [41, -5.5, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
               carOn([[0, 10.6, 14.4], [41, 6.7, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
        break;
      }
      case 'g2': {   // lf 0-10 (old 42-52): signal CU — the crank TURNS as the pressure builds
        signal = {p: SIG, ry: 0.15, state: 'everywhere', crank: lf * 0.35};
        P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'present', 'worried']]), talk: true, gaze: 'cam', emo: 0.85});
        P.push({who: 'woman', p: [0.4, 0, 7.55], act: 'idle', expr: 'worried', emo: 0.7});
        P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'worried', emo: 0.7, gaze: sigGaze});
        P.push({who: 'man', p: MAN, act: 'idle', expr: 'worried', emo: 0.7, gaze: sigGaze});
        K.push(carOn([[0, -5.5, 11.7], [10, -4.75, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
               carOn([[0, 6.7, 14.4], [10, 5.75, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
        break;
      }
      case 'g3': {   // lf 0-4 (old 53-57): ECU on Morgan — shock; cars settle their last 15 cm by lf 4,
                    // then the warp FREEZES this shot (old 57) for the dead stop
        P.push({who: 'mechanic', p: MORGAN, act: 'idle', expr: 'shock', talk: true, gaze: 'cam', emo: 1.0});
        P.push({who: 'woman', p: [0.9, 0, 7.55], act: 'idle', expr: 'surprised', emo: 0.8});
        P.push({who: 'kid', p: [1.7, 0, 7.5], act: 'idle', expr: 'surprised', emo: 0.8, gaze: sigGaze});
        P.push({who: 'man', p: MAN, act: 'idle', expr: 'shock', emo: 0.9, gaze: sigGaze});
        K.push(carOn([[0, -4.75, 11.7], [4, -4.6, 11.7]], lf, '#2f4f6a', 0, '#3f4a66'),
               carOn([[0, 5.75, 14.4], [4, 5.6, 14.4]], lf, '#a8443a', Math.PI, '#7a3b22'));
        break;
      }
      case 'g4': {   // lf 0-78 (old 58-136): the release — stopped street, grin, relief
        P.push({who: 'mechanic', p: MORGAN, ...seq(lf, [[0, 'proud', 'grin']]), talk: true, gaze: 'cam', emo: 1.0});
        P.push({who: 'woman', p: [0.9, 0, 7.55], ...seq(lf, [[0, 'idle', 'happy']]), emo: 0.9});
        P.push({who: 'kid', p: [1.7, 0, 7.5], ...seq(lf, [[0, 'idle', 'happy'], [6, 'cheer', 'grin']]), emo: 0.9, gaze: sigGaze});
        P.push({who: 'man', p: MAN, ...seq(lf, [[0, 'idle', 'surprised'], [16, 'idle', 'happy']]), emo: 0.8, gaze: sigGaze});
        K.push(...stoppedPair());
        break;
      }
    }
  }
  autoGaze(P, Mt);
  return {people: P, carts: [], extra: [], cars: K, meters: Mt, things, clock: 9 + f / 30 / 120, nStoryCars: K.length, signal, board};
}
