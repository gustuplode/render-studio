// The Shopping Cart staging — 23 shots, one per script line, timed to the REAL N1 voice stem
// (84.120 s) through the whole-film speed graph in timeline.ts. Staging runs on the OLD
// (warped) clock: word beats are placed with wl() = the word's local OLD frame, so slow-mo,
// the hook freeze, the refusal0 dead-stop plateau and the cascade acceleration all land
// exactly on the spoken words. Cast (kit library only): goldman = Sylvan Goldman,
// mechanic = Fred Young, shopper/woman/man/grandma/youngman/youngwoman/kid/shopper2/baker/
// nurse/teacher = shoppers + hired actors. Sets: kit grocery (store + workshop x~12) and
// the kit downtown frontage for the title. Hero prop: the kit folding-chair cart
// (wood frame + pop-in wheels + fly-in wire baskets, CartP.wheels/b1/b2).
// Store plan: aisle x in [-1.1, 1.1], shelves z -11.85..-2.25 both sides, counter (-2.4, 1.6),
// front door z 4. Workshop: bench (11.4, -1.1), open floor x 10.2..13.8, z -0.2..2.2.
// People order is FIXED inside each shot (velocities() relies on it).
import {TOTAL, shotAt, T, S, cl, sm01, warp, SHOT_REAL, type V3} from '../../engine/core/clock';
import {autoGaze, pathAt, type Key} from '../../engine/core/staging';
import {PersonP, seq} from '../../engine/chars/rig';
import type {CarP, MeterP, Things} from '../../engine/kits/downtown/street';
import type {CartP} from '../../engine/kits/grocery/store';
import type {FxEv} from './fx';
export {TOTAL, shotAt};
export type Stage = {people: PersonP[]; carts: CartP[]; extra: string[]; cars: CarP[]; meters: MeterP[]; things: Things; clock: number; nStoryCars: number; fx: FxEv[]};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** local OLD frame at which `word` is spoken inside `shot` (warp-aware word anchor) */
const wl = (shot: string, word: string, n = 1) => Math.round((warp(T(shot, word, n)) - warp(SHOT_REAL[shot])) * 30);
/** person walking a straight line a->b over local frames [f0, f1] (smootherstep) */
const walkP = (lf: number, f0: number, f1: number, a: V3, b: V3): V3 => {
  const u = sm01(cl((lf - f0) / Math.max(1, f1 - f0)));
  return [lerp(a[0], b[0], u), 0, lerp(a[2], b[2], u)];
};
/** a cart rolling on pathAt keys + its pusher's position/hold. spin accumulates travel. */
const roll = (keys: Key[], lf: number, ry0: number, extra: Partial<CartP> = {}) => {
  const [x, z] = pathAt(keys, lf), [xa, za] = pathAt(keys, lf - 1), [xb, zb] = pathAt(keys, lf + 1);
  const dx = xb - xa, dz = zb - za, moving = Math.hypot(dx, dz) > 1e-4;
  const ry = moving ? Math.atan2(-dz, dx) : ry0;
  let dist = 0, px = keys[0][1], pz = keys[0][2];
  for (let g = keys[0][0] + 1; g <= Math.min(lf, keys[keys.length - 1][0]); g++) { const q = pathAt(keys, g); dist += Math.hypot(q[0] - px, q[1] - pz); px = q[0]; pz = q[1]; }
  const cart: CartP = {p: [x, 0, z], ry, spin: dist * 28, ...extra};
  const push: V3 = [x - Math.cos(ry) * 0.5, 0, z + Math.sin(ry) * 0.5];
  return {cart, push, ry};
};
const ROWX = [-1.7, -0.85, 0, 0.85, 1.7];
const cartRow = (): CartP[] => ROWX.map((x, i) => ({p: [x, 0, 2.75], ry: 0.05 * (i - 2), fill: 0}));

export function stage(f: number): Stage {
  const s = shotAt(f), lf = s.lf, len = s.len, P: PersonP[] = [], K: CarP[] = [], Mt: MeterP[] = [];
  let C: CartP[] = [], things: Things = {}, fx: FxEv[] = [];
  const A = S(s.name);   // absolute old frame of this shot's start (for fx / blink anchors)
  switch (s.name) {
    case 'hook': {
      // F-energy open: the finished cart ASSEMBLES beside Goldman in the first second
      // (wheels pop, baskets fly in), he presents it on "wheels", then pushes it a step.
      const wA = wl('hook', 'wheels'), tA = wl('hook', 'taught');
      const rc = roll([[62, 0.1, 1.5], [len, 0.95, 1.5]], lf, 0, {
        wheels: cl((lf - 4) / 7), b1: cl((lf - 10) / 11), b2: cl((lf - 16) / 11),
        dust: lf >= 4 && lf < 30 ? 0.7 : 0, fill: 0});
      C.push(rc.cart);
      const [gx, gz] = pathAt([[50, 0.95, 1.55], [56, 0.3, 2.2], [64, -0.5, 1.55]], lf);
      const gp: V3 = lf < 50 ? [0.95, 0, 1.55] : [gx, 0, gz];
      P.push({who: 'goldman', p: lf >= 64 ? rc.push : gp, ...seq(lf, [[0, 'idle', 'happy'], [8, 'point', 'proud'], [34, 'present', 'proud'], [50, 'walk', 'proud'], [64, 'push', 'proud']]),
        talk: true, gaze: 'cam', emo: 1.0, hold: lf >= 64 ? {p: rc.cart.p, ry: 0, id: 0, k: cl((lf - 64) / 6)} : undefined});
      P.push({who: 'woman', p: [-2.3, 0, 2.7], act: 'idle', expr: 'happy', gaze: [0.3, 1.1, 1.5]});
      P.push({who: 'kid', p: [3.05, 0, 0.5], ...seq(lf, [[0, 'idle', 'happy'], [tA + 8, 'cheer', 'grin']]), gaze: [0.3, 1.1, 1.5]});
      fx = [{kind: 'dust', p: [0.1, 0, 1.5], t0: A + 6}, {kind: 'dust', p: [0.1, 0, 1.5], t0: A + 19}];
      break;
    }
    case 'title': {
      P.push({who: 'goldman', p: [0, 0, 4.9], act: 'present', expr: 'proud', gaze: 'cam'});
      K.push({p: [6.75, 0, 9.45], ry: Math.PI, col: '#2f4f6a'}, {p: [-6.75, 0, 9.45], ry: Math.PI, col: '#a8443a'},
             {p: [lerp(-24, 24, cl(lf / Math.max(1, len - 1))), 0, 11.7], ry: 0, col: '#3f6a4a', spin: lf * 0.16 / 0.36});
      break;
    }
    case 'problem1': {
      const wA = wl('problem1', 'watched');
      const wp = walkP(lf, 0, 95, [0.2, 0, 3.5], [0.15, 0, -2.7]);
      P.push({who: 'goldman', p: [3.2, 0, 3.3], act: 'idle', expr: 'worried', talk: true, gaze: [0.15, 1, -2.8], emo: 0.85});
      P.push({who: 'woman', p: lf < 95 ? wp : [0.3, 0, -3.1], ...seq(lf, [[0, 'walk', 'happy'], [95, 'idle', 'neutral']]), basket: lf >= 10, gaze: [0.9, 1.1, -3.4]});
      P.push({who: 'grandma', p: [-0.6, 0, -6.5], act: 'idle', expr: 'neutral', bg: true, gaze: [-1.2, 1.1, -6.8]});
      break;
    }
    case 'problem2': {
      // E-language: the aisle track. She stops at shelves to load up; on "heavy" she stops
      // for good (the warp itself is decaying through this shot). Goldman watches, worried.
      const hA = wl('problem2', 'heavy');
      const keys: Key[] = [[0, 0.12, -2.7], [28, 0.12, -4.3], [40, 0.12, -4.3], [66, 0.12, -6.1], [78, 0.12, -6.1], [96, 0.12, -7.3], [len, 0.12, -7.3]];
      const [sx, sz] = pathAt(keys, lf);
      const sq: [number, 'tiredWalk' | 'idle', 'tired'][] = [[0, 'tiredWalk', 'tired'], [28, 'idle', 'tired'], [40, 'tiredWalk', 'tired'], [66, 'idle', 'tired'], [78, 'tiredWalk', 'tired'], [hA, 'idle', 'tired']].sort((a, b) => a[0] - b[0]) as any;
      P.push({who: 'shopper', p: [sx, 0, sz], ...seq(lf, sq), basket: true, sweat: lf > hA - 25, expr: 'tired', emo: 0.95, gaze: [1.1, 1.1, sz - 0.6]});
      P.push({who: 'goldman', p: [-0.8, 0, -1.35], act: 'idle', expr: 'worried', emo: 0.9, gaze: [0.12, 1, -5.5]});
      P.push({who: 'grandma', p: [0.5, 0, -9.6], act: 'idle', expr: 'neutral', bg: true, gaze: [1.2, 1.1, -9.9]});
      break;
    }
    case 'problem3': {
      const mA = wl('problem3', 'Money');
      const sp = walkP(lf, 10, 100, [0.12, 0, -3.2], [0.3, 0, 3.9]);
      P.push({who: 'shopper', p: lf < 10 ? [0.12, 0, -3.2] : sp, ...seq(lf, [[0, 'idle', 'tired'], [10, 'tiredWalk', 'tired']]), basket: true, sweat: true, pace: 1.15, gaze: [0.3, 1, 4.5]});
      P.push({who: 'goldman', p: [1.4, 0, 2.85], ...seq(lf, [[0, 'idle', 'worried'], [mA, 'idle', 'sad']]), gaze: [sp[0], 1, sp[2]], emo: 0.9});
      P.push({who: 'kid', p: [-2.1, 0, -0.6], act: 'idle', expr: 'happy', bg: true});
      break;
    }
    case 'problem4': {
      const nA = wl('problem4', 'never');
      const k1 = roll([[0, -0.38, -8.6], [62, -0.38, -2.9], [70, -0.38, -2.9], [len, -0.38, -8.6]], lf, Math.PI / 2);
      const k2 = roll([[0, 0.42, -2.9], [62, 0.42, -8.4], [70, 0.42, -8.4], [len, 0.42, -2.9]], lf, -Math.PI / 2);
      // helpers run with HAND baskets (no carts in this beat) — reuse the path math only
      P.push({who: 'kid', p: [k1.cart.p[0], 0, k1.cart.p[2]], act: 'walk', expr: 'happy', basket: true, pace: 2.2, gaze: [-0.38, 1, -1]});
      P.push({who: 'youngman', p: [k2.cart.p[0], 0, k2.cart.p[2]], act: 'walk', expr: 'neutral', basket: true, pace: 2.2, sweat: lf > 80, gaze: [0.42, 1, -10]});
      P.push({who: 'goldman', p: [-1.5, 0, -0.7], ...seq(lf, [[0, 'idle', 'tired'], [nA, 'shrug', 'tired']]), emo: 0.9, gaze: [0, 1, -5]});
      break;
    }
    case 'night1': {
      C.push({p: [12.45, 0, 0.5], ry: 0.55, wood: 1, wheels: 0, b1: 0, b2: 0});
      P.push({who: 'goldman', p: [11.6, 0, 0.85], ...seq(lf, [[0, 'think', 'worried'], [55, 'idle', 'worried']]), talk: true, emo: 0.85, gaze: [12.45, 0.8, 0.5]});
      break;
    }
    case 'night2': {
      const wA = wl('night2', 'What');
      C.push({p: [12.45, 0, 0.5], ry: 0.55, wood: 1, wheels: 0, b1: 0, b2: 0});
      P.push({who: 'goldman', p: [11.6, 0, 0.85], ...seq(lf, [[0, 'think', 'worried'], [wA, 'eureka', 'surprised'], [wA + 22, 'point', 'proud']]), talk: true, emo: 1.0, gaze: [12.45, 0.8, 0.5]});
      things = {bulb: {p: [11.6, 2.0, 0.85], k: lf < wA ? 0 : cl((lf - wA) / 8)}};
      break;
    }
    case 'build1': {
      const cA = wl('build1', 'called'), bA = wl('build1', 'built');
      C.push({p: [12.3, 0, 0.5], ry: 0.5, wood: 1, wheels: 0, b1: 0, b2: 0});
      P.push({who: 'goldman', p: [11.7, 0, 0.3], ...seq(lf, [[0, 'present', 'proud'], [cA, 'point', 'proud']]), talk: true, emo: 0.9, gaze: [12.3, 0.8, 0.5]});
      const [fx2, fz2] = pathAt([[6, 10.2, -0.45], [40, 12.9, -0.45], [58, 12.9, 1.05], [len, 12.9, 1.05]], lf);
      P.push({who: 'mechanic', p: [fx2, 0, fz2], ...seq(lf, [[0, 'idle', 'neutral'], [6, 'walk', 'neutral'], [58, 'think', 'neutral'], [bA, 'pull', 'neutral']]), gaze: [12.3, 0.8, 0.5]});
      break;
    }
    case 'build2': {
      // HERO ASSEMBLE (H-language): on the spoken inventory the parts land — wheels pop on
      // "Four wheels.", the wooden chair becomes the chrome cart, baskets fly in on
      // "Two wire baskets," — each landing with its dust burst; the men work, then present.
      const fA = wl('build2', 'Four'), wA = wl('build2', 'wheels'), tA = wl('build2', 'Two'), bA = wl('build2', 'baskets'), sA = wl('build2', 'shelves');
      const swap = wA + 9;
      C.push({p: [12.3, 0, 0.45], ry: 0.45, wood: lf < swap ? 1 : 0, wheels: cl((lf - (fA - 3)) / 9),
        b1: cl((lf - (tA - 2)) / 12), b2: cl((lf - (bA - 2)) / 12),
        dust: (lf >= swap - 2 && lf < swap + 8) || (lf >= tA + 8 && lf < tA + 16) || (lf >= bA + 8 && lf < bA + 16) ? 0.8 : 0, fill: 0});
      P.push({who: 'goldman', p: [11.6, 0, 0.3], ...seq(lf, [[0, 'pull', 'neutral'], [sA, 'present', 'proud']]), emo: 0.9, gaze: [12.3, 0.7, 0.45]});
      P.push({who: 'mechanic', p: [13.0, 0, 0.3], ...seq(lf, [[0, 'pull', 'neutral'], [sA + 6, 'cheer', 'grin']]), emo: 0.9, gaze: [12.3, 0.7, 0.45]});
      fx = [{kind: 'dust', p: [12.3, 0, 0.45], t0: A + fA + 2}, {kind: 'dust', p: [12.3, 0, 0.45], t0: A + tA + 9},
            {kind: 'dust', p: [12.3, 0, 0.45], t0: A + bA + 9}, {kind: 'ring', p: [12.3, 0, 0.45], t0: A + sA, max: 1.6, dur: 14}];
      break;
    }
    case 'build3': {
      C.push({p: [12.3, 0, 0.45], ry: 0.45, fill: 0.35});
      P.push({who: 'goldman', p: [11.8, 0, 1.1], act: 'present', expr: 'proud', talk: true, gaze: 'cam', emo: 1.0});
      P.push({who: 'mechanic', p: [13.0, 0, 1.1], act: 'cheer', expr: 'grin', emo: 0.9, gaze: [12.3, 0.8, 0.45]});
      fx = [{kind: 'ring', p: [12.3, 0, 0.45], t0: A + 3, max: 2.4, dur: 16}];
      break;
    }
    case 'launch': {
      C.push(...cartRow());
      P.push({who: 'goldman', p: [0, 0, 3.5], ...seq(lf, [[0, 'present', 'proud'], [40, 'proud', 'grin']]), talk: true, gaze: 'cam', emo: 1.0});
      P.push({who: 'woman', p: walkP(lf, 20, 120, [-0.75, 0, 3.95], [-0.75, 0, 3.28]), ...seq(lf, [[0, 'idle', 'happy'], [20, 'walk', 'happy'], [120, 'idle', 'happy']]), gaze: [0, 1.1, 2.75]});
      P.push({who: 'man', p: walkP(lf, 30, 130, [0.8, 0, 3.95], [0.8, 0, 3.32]), ...seq(lf, [[0, 'idle', 'happy'], [30, 'walk', 'happy'], [130, 'idle', 'happy']]), gaze: [0, 1.1, 2.75]});
      break;
    }
    case 'refusal0': {
      // G-language collapse: the launch tableau again, but the shoppers stream PAST the
      // shining row with hand baskets — and the warp decays into the dead stop.
      C.push(...cartRow());
      P.push({who: 'goldman', p: [0, 0, 3.5], ...seq(lf, [[0, 'proud', 'grin'], [12, 'idle', 'worried']]), emo: 0.95, gaze: [0, 1, 1.5]});
      const [wx, wz] = pathAt([[0, -0.75, 3.35], [7, -0.44, 3.3], [16, -0.44, 2.5], [len, -0.55, 2.05]], lf);
      const [mx, mz] = pathAt([[0, 0.8, 3.4], [7, 0.44, 3.35], [16, 0.44, 2.55], [len, 0.6, 2.1]], lf);
      P.push({who: 'woman', p: [wx, 0, wz], act: 'walk', expr: 'neutral', basket: true, gaze: [-0.3, 1, -2]});
      P.push({who: 'man', p: [mx, 0, mz], act: 'walk', expr: 'neutral', basket: true, gaze: [0.35, 1, -2]});
      P.push({who: 'grandma', p: walkP(lf, 0, len, [2.3, 0, 3.6], [2.3, 0, 2.8]), act: 'walk', expr: 'neutral', basket: true, bg: true, gaze: [2.3, 1, -2]});
      break;
    }
    case 'refusal1': {
      const fA = wl('refusal1', 'folded'), sA = wl('refusal1', "'Strong");
      P.push({who: 'man', p: [0.55, 0, 1.55], ...seq(lf, [[0, 'idle', 'smug'], [fA, 'cross', 'smug'], [sA, 'flex', 'smug']]), talk: lf >= sA, emo: 1.0, gaze: [-0.55, 1.1, 1.75]});
      P.push({who: 'goldman', p: [-0.55, 0, 1.75], act: 'idle', expr: 'worried', emo: 0.9, gaze: [0.55, 1.1, 1.55]});
      P.push({who: 'woman', p: [-2.3, 0, 2.2], act: 'idle', expr: 'neutral', gaze: [0.55, 1.1, 1.55]});
      break;
    }
    case 'refusal2': {
      const sA = wl('refusal2', 'shook'), pA = wl('refusal2', 'pushed');
      const shake = (c: V3, ph: number): V3 => (lf >= sA && lf < sA + 34) ? [c[0] + Math.sin((lf - sA) * 0.85 + ph) * 0.9, 1.05, 3.4] : [0.2, 1.05, 3.4];
      P.push({who: 'woman', p: [-0.8, 0, 1.5], ...seq(lf, [[0, 'idle', 'tired'], [sA, 'idle', 'angry']]), talk: lf >= pA, emo: 1.0, gaze: shake([-0.8, 0, 1.5], 0)});
      P.push({who: 'grandma', p: [0.3, 0, 1.55], act: 'idle', expr: 'tired', emo: 0.9, gaze: shake([0.3, 0, 1.55], 0.7)});
      P.push({who: 'goldman', p: [0, 0, 3.45], act: 'idle', expr: 'sad', gaze: [0, 1, 1.5]});
      break;
    }
    case 'refusal3': {
      C.push(...cartRow());
      P.push({who: 'goldman', p: [0, 0, 3.5], act: 'slump', expr: 'sad', emo: 0.9, gaze: [0, 0.8, 2.75]});
      P.push({who: 'youngwoman', p: walkP(lf, 0, 110, [2.35, 0, 3.7], [2.35, 0, 0.6]), act: 'walk', expr: 'neutral', basket: true, bg: true, gaze: [2.35, 1, -2]});
      break;
    }
    case 'trick1': {
      const hA = wl('trick1', 'hired');
      P.push({who: 'goldman', p: [-1.3, 0, 0.8], ...seq(lf, [[0, 'present', 'proud'], [hA, 'point', 'proud']]), talk: true, emo: 0.95, gaze: [-0.2, 1.1, 1.0]});
      P.push({who: 'youngman', p: [-0.35, 0, 1.55], ...seq(lf, [[0, 'idle', 'happy'], [hA + 8, 'bounce', 'grin']]), gaze: [-1.3, 1.1, 0.8]});
      P.push({who: 'youngwoman', p: [-2.35, 0, 0.35], ...seq(lf, [[0, 'idle', 'happy'], [hA + 14, 'bounce', 'grin']]), gaze: [-1.3, 1.1, 0.8]});
      break;
    }
    case 'trick2': {
      const c0 = roll([[0, 0.33, -2.5], [42, 0.33, -5.4], [56, 0.33, -5.4], [len, 0.33, -8.7]], lf, Math.PI / 2, {fill: lf < 42 ? 0 : lf < 70 ? 0.4 : 0.75});
      const c1 = roll([[0, -0.38, -8.8], [38, -0.38, -6.0], [52, -0.38, -6.0], [len, -0.38, -3.2]], lf, -Math.PI / 2, {fill: lf < 38 ? 0 : lf < 66 ? 0.35 : 0.7});
      C.push(c0.cart, c1.cart);
      P.push({who: 'youngman', p: c0.push, act: 'push', expr: 'happy', emo: 0.8, hold: {p: c0.cart.p, ry: c0.ry, id: 0}, gaze: [0.33, 1, -10]});
      P.push({who: 'youngwoman', p: c1.push, act: 'push', expr: 'happy', emo: 0.8, hold: {p: c1.cart.p, ry: c1.ry, id: 1}, gaze: [-0.38, 1, 0]});
      break;
    }
    case 'trick3': {
      // The copy beat: an actor rolls past; the real shopper watches (heartbeat double-blink
      // on "always"), and on "copied." she takes the parked cart and rolls it herself.
      const aA = wl('trick3', 'always'), cA = wl('trick3', 'copied');
      const c0 = roll([[0, -0.32, -4.6], [Math.max(1, cA - 20), -0.32, -1.2], [len, -0.32, 1.6]], lf, -Math.PI / 2, {fill: 0.7});
      const c1 = roll([[0, 1.02, -0.75], [cA + 10, 1.02, -0.75], [len, 0.6, 0.7]], lf, -0.4, {fill: 0});
      C.push(c0.cart, c1.cart);
      P.push({who: 'youngwoman', p: c0.push, act: 'push', expr: 'happy', emo: 0.8, hold: {p: c0.cart.p, ry: c0.ry, id: 0}, gaze: [-0.32, 1, 2]});
      const step = walkP(lf, cA - 6, cA + 10, [0.85, 0, -1.85], [0.56, 0, -0.94]);
      const sp: V3 = lf < cA - 6 ? [0.85, 0, -1.85] : lf < cA + 10 ? step : c1.push;
      P.push({who: 'shopper', p: sp, ...seq(lf, [[0, 'idle', 'worried'], [aA, 'idle', 'surprised'], [cA - 6, 'walk', 'surprised'], [cA + 10, 'push', 'happy']]),
        basket: lf < cA, emo: 0.6 + 0.4 * cl(lf / Math.max(1, cA)), blinkF: [A + aA, A + aA + 3],
        hold: lf >= cA + 10 ? {p: c1.cart.p, ry: c1.ry, id: 1, k: cl((lf - cA - 10) / 5)} : undefined,
        gaze: lf < cA ? [c0.cart.p[0], 1, c0.cart.p[2]] : [0.4, 1, 0.9]});
      fx = [{kind: 'ring', p: [1.02, 0, -0.75], t0: A + cA, max: 2.6, dur: 16}];
      break;
    }
    case 'cascade': {
      // Speed-graph cascade: 1 cart rolling on "One", 5 by "five.", every cart by "every".
      // Lanes A (x .34, rolls toward the front) and B (x -.36, rolls deep), front crossers.
      const oA = wl('cascade', 'One'), fA = wl('cascade', 'five'), eA = wl('cascade', 'every');
      const mk = (keys: Key[], ry0: number, fill: number) => roll(keys, lf, ry0, {fill});
      const c0 = mk([[0, 0.28, -6.5], [len, 0.28, -1.4]], -Math.PI / 2, 0.5);
      const c1 = mk([[0, -0.28, -9.6], [fA, -0.28, -9.6], [len, -0.28, -3.4]], Math.PI / 2, 0.4);
      const c2 = mk([[0, 0.66, -10.3], [fA + 4, 0.66, -10.3], [len, 0.66, -5.4]], -Math.PI / 2, 0.3);
      const c3 = mk([[0, -0.66, -11.0], [fA + 8, -0.66, -11.0], [len, -0.66, -6.6]], Math.PI / 2, 0.45);
      const c4 = mk([[Math.max(0, fA - 6), -2.6, 1.15], [len, 2.4, 1.15]], 0, 0.6);
      const c5 = mk([[0, 0.28, -11.5], [eA, 0.28, -11.5], [len, 0.28, -8.8]], -Math.PI / 2, 0.35);
      const c6 = mk([[0, -0.28, -12.2], [eA + 4, -0.28, -12.2], [len, -0.28, -9.2]], Math.PI / 2, 0.3);
      const c7 = mk([[eA + 8, 2.7, 1.8], [len, -2.2, 1.8]], Math.PI, 0.5);
      const c8 = mk([[0, -2.4, 3.3], [eA + 6, -2.4, 3.3], [len, 2.2, 3.3]], 0, 0.4);
      C.push(c0.cart, c1.cart, c2.cart, c3.cart, c4.cart, c5.cart, c6.cart, c7.cart, c8.cart);
      const pusher = (c: ReturnType<typeof roll>, who: PersonP['who'], id: number, from: number, expr: PersonP['expr'] = 'happy') => {
        const on = lf >= from;
        P.push({who, p: on ? c.push : [c.cart.p[0] - Math.cos(c.ry) * 0.5, 0, c.cart.p[2] + Math.sin(c.ry) * 0.5],
          act: on ? 'push' : 'idle', expr, emo: 0.85, hold: on ? {p: c.cart.p, ry: c.ry, id} : undefined, gaze: [c.cart.p[0], 1, c.cart.p[2] + (c.ry < 0 ? 2 : -2)]});
      };
      pusher(c0, 'youngman', 0, 0);
      pusher(c1, 'woman', 1, fA);
      pusher(c2, 'grandma', 2, fA + 4);
      pusher(c3, 'kid', 3, fA + 8);
      pusher(c4, 'shopper2', 4, Math.max(0, fA - 6));
      pusher(c5, 'baker', 5, eA);
      pusher(c6, 'nurse', 6, eA + 4);
      pusher(c7, 'teacher', 7, eA + 8);
      pusher(c8, 'man', 8, eA + 6);
      P.push({who: 'goldman', p: [2.6, 0, 0.55], act: 'idle', expr: 'proud', emo: 0.9, gaze: [0, 1, -4]});
      break;
    }
    case 'payoff1': {
      const c0 = roll([[0, 0.3, -7], [len, 0.3, -2]], lf, -Math.PI / 2, {fill: 0.6});
      const c1 = roll([[0, 0.64, -10.5], [len, 0.64, -5.5]], lf, -Math.PI / 2, {fill: 0.4});
      const c2 = roll([[0, -0.3, -2], [len, -0.3, -7.5]], lf, Math.PI / 2, {fill: 0.5});
      const c3 = roll([[0, -0.64, -6], [len, -0.64, -10.8]], lf, Math.PI / 2, {fill: 0.3});
      const c4 = roll([[0, -2.4, 2.3], [len, 2.4, 2.3]], lf, 0, {fill: 0.7});
      const c5 = roll([[0, 2.4, 1.35], [len, -2.4, 1.35]], lf, Math.PI, {fill: 0.45});
      C.push(c0.cart, c1.cart, c2.cart, c3.cart, c4.cart, c5.cart);
      const pusher = (c: ReturnType<typeof roll>, who: PersonP['who'], id: number) =>
        P.push({who, p: c.push, act: 'push', expr: 'happy', emo: 0.8, hold: {p: c.cart.p, ry: c.ry, id}, gaze: [c.cart.p[0], 1, c.cart.p[2] + (c.ry < 0 ? 2 : -2)]});
      pusher(c0, 'youngman', 0); pusher(c1, 'grandma', 1); pusher(c2, 'woman', 2);
      pusher(c3, 'kid', 3); pusher(c4, 'shopper2', 4); pusher(c5, 'youngwoman', 5);
      P.push({who: 'goldman', p: [-2.9, 0, 0.9], act: 'present', expr: 'proud', talk: true, gaze: 'cam', emo: 1.0});
      break;
    }
    case 'payoff2': {
      const c0 = roll([[0, -2.6, 0.15], [len, 2.6, 0.15]], lf, 0, {fill: 0.5});
      const c1 = roll([[0, 2.6, -0.55], [len, -2.6, -0.55]], lf, Math.PI, {fill: 0.4});
      C.push(c0.cart, c1.cart);
      P.push({who: 'youngwoman', p: c0.push, act: 'push', expr: 'happy', bg: true, hold: {p: c0.cart.p, ry: c0.ry, id: 0}});
      P.push({who: 'man', p: c1.push, act: 'push', expr: 'happy', bg: true, hold: {p: c1.cart.p, ry: c1.ry, id: 1}});
      P.push({who: 'goldman', p: [-1.45, 0, 0.8], ...seq(lf, [[0, 'present', 'proud'], [40, 'proud', 'grin']]), talk: true, gaze: 'cam', emo: 1.0});
      break;
    }
    case 'ending': {
      const c0 = roll([[0, 0, -6.8], [len, 0, -2.3]], lf, -Math.PI / 2, {fill: 0.6});
      C.push(c0.cart);
      P.push({who: 'goldman', p: c0.push, act: 'push', expr: 'happy', emo: 0.7, hold: {p: c0.cart.p, ry: c0.ry, id: 0}, gaze: 'cam'});
      P.push({who: 'woman', p: [-3.1, 0, 1.6], ...seq(lf, [[0, 'idle', 'happy'], [30, 'wave', 'happy']]), bg: true, gaze: [0, 1.1, -3]});
      P.push({who: 'kid', p: [3.3, 0, 1.8], ...seq(lf, [[0, 'idle', 'happy'], [len - 25, 'cheer', 'grin']]), bg: true, gaze: [0, 1.1, -3]});
      break;
    }
  }
  autoGaze(P, Mt);
  return {people: P, carts: C, extra: [], cars: K, meters: Mt, things, clock: 9 + f / 30 / 120, nStoryCars: K.length, fx};
}
