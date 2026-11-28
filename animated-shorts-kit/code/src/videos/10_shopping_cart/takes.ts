// The Shopping Cart camera (03_CAMERA_GRAMMAR, measured): every key is anchored to
// SHOT_REAL / T(shot, word), so moves land on the REAL N1 voice words. The editing
// language of hook variants E-H, mapped across the film: hook = F punch + assemble
// glimpse; problem = E continuous tracks; build = H assemble covered from both sides
// of the workshop; refusal0 = G near-still (the warp does the dead stop); trick3 and
// the cascade carry the kicks/flashes.
// GEOMETRY LAW (learned from the gates): interior cameras stay inside the room —
// in the aisle |x| < 1.05 (shelf runs at |x| ~1.3), in the front area z < 4.0, in the
// workshop z < 3.85 and 10.2 < x < 13.9 (the town facade slab is a hard occluder).
import {K, type Take, type Kick, type Whip, type Flash, type Props} from '../../engine/camera/takes_api';
import {T} from '../../engine/core/clock';
import {SHOT_REAL as R} from './timeline';
export const PROPS: Props = {
  board37: [[-3.7, 0.9, 4.75], [0.25, 0.5, 0.25]],
  bench: [[11.4, 0.95, -1.1], [1.2, 0.5, 0.4]],
  aisle: [[0, 0.8, -6], [1.1, 1.0, 5.2]],
};
export const TAKES: Take[] = [
  {name: 'hook', why: 'F-punch from the front-right corner: Goldman + the cart assembling beside him, push in; arc tighter as he takes the handle and rolls it', keys: [
    K(R.hook, ['goldman', 'cart:0'], 'FS', 58, 8, 44, {push: 1.05}),
    K(T('hook', 'taught'), 'goldman', 'MS', 62, 6, 42, {move: 'dolly', lead: 0.3, dur: 0.9, push: 1.06, track: 4})]},
  {name: 'title', why: 'the OKLAHOMA CITY 1937 board, then arc to Goldman in his doorway', keys: [
    K(R.title, 'prop:board37', 'FS', -25, 10, 44, {push: 1.05}),
    K(T('title', '1937'), 'goldman', 'MS', 15, 8, 42, {move: 'arc', lead: 0.3, dur: 0.8, push: 1.06})]},
  {name: 'problem1', why: 'camera retreats down the aisle ahead of the entering shopper, then travels to Goldman watching on "watched"', keys: [
    K(R.problem1, 'woman', 'FS', 165, 9, 44, {push: 1.03, track: 6}),
    K(T('problem1', 'watched'), 'goldman', 'MS', 195, 8, 42, {move: 'arc', lead: 0.3, dur: 1.0, push: 1.05})]},
  {name: 'problem2', why: 'E-track: camera backs down the aisle ahead of the tiring shopper (tight smoothing); on "heavy" it closes on her stopped, sweating face', keys: [
    K(R.problem2, 'shopper', 'MS', 168, 8, 42, {push: 1.04, track: 5}),
    K(T('problem2', 'heavy'), 'shopper', 'MCU', 150, 7, 40, {move: 'arc', lead: 0.3, dur: 0.8, push: 1.08})]},
  {name: 'problem3', why: 'camera retreats ahead of her as she trudges to the door, then swings in on Goldman (from the north-west) as the money walks out', keys: [
    K(R.problem3, 'shopper', 'FS', 165, 9, 44, {push: 1.03, track: 5}),
    K(T('problem3', 'Money'), 'goldman', 'MS', 138, 7, 42, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.07})]},
  {name: 'problem4', why: 'high shot from the front looking down the aisle over the running helpers, then in on Goldman shrugging at "never"', keys: [
    K(R.problem4, 'prop:aisle', 'WS', 4, 14, 46, {push: 1.03}),
    K(T('problem4', 'never'), 'goldman', 'MS', 40, 8, 42, {move: 'arc', lead: 0.3, dur: 0.8, push: 1.05})]},
  {name: 'night1', why: 'one slow push on Goldman staring at the folding chair (quiet contrast beat)', keys: [
    K(R.night1, ['goldman', 'cart:0'], 'FS', -25, 7, 46, {push: 1.09})]},
  {name: 'night2', why: 'close on the idea landing, then widen to him pointing at the chair', keys: [
    K(R.night2, 'goldman', 'MCU', -18, 6, 40, {push: 1.1}),
    K(T('night2', 'chair'), ['goldman', 'cart:0'], 'FS', -30, 7, 44, {move: 'arc', lead: 0.3, dur: 0.7, push: 1.05})]},
  {name: 'build1', why: 'workshop: Goldman + chair while Fred walks in behind (non-subject), then travel to Fred at the chair on "built"', keys: [
    K(R.build1, ['goldman', 'cart:0'], 'FS', -22, 7, 46, {push: 1.05}),
    K(T('build1', 'built'), 'mechanic', 'MS', -30, 6, 42, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.06})]},
  {name: 'build2', why: 'H assemble, covered CapCut-style from both sides: Goldman side for the wheels, Fred side for the baskets, tight on the finished cart', keys: [
    K(R.build2, ['goldman', 'cart:0'], 'FS', -34, 8, 46, {push: 1.04}),
    K(T('build2', 'Two'), ['mechanic', 'cart:0'], 'FS', 16, 7, 46, {move: 'arc', lead: 0.25, dur: 1.2, push: 1.06}),
    K(T('build2', 'shelves'), 'cart:0', 'MCU', -10, 5, 40, {move: 'arc', lead: 0.3, dur: 0.7, push: 1.1})]},
  {name: 'build3', why: 'hero reveal: tight slow push on Goldman presenting, the finished cart over his shoulder', keys: [
    K(R.build3, 'goldman', 'MCU', -30, 5, 40, {push: 1.12})]},
  {name: 'launch', why: 'from inside the store looking at the door: the shining row in the foreground, grinning Goldman at his door behind it; tighter as he waits for the rush', keys: [
    K(R.launch, ['goldman', 'cart:2'], 'FS', 180, 8, 44, {push: 1.06}),
    K(T('launch', 'waiting'), 'goldman', 'MS', 168, 6, 42, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.08})]},
  {name: 'refusal0', why: 'G dead air: nearly still from the same inside angle while shoppers stream past the untouched row toward camera (the warp freezes the world)', keys: [
    K(R.refusal0, ['goldman', 'cart:2'], 'FS', 176, 7, 44, {push: 1.02})]},
  {name: 'refusal1', why: 'two-shot, then in on the man as he folds his arms and delivers the quote', keys: [
    K(R.refusal1, ['man', 'goldman'], 'FS', 58, 8, 44, {push: 1.04}),
    K(T('refusal1', "'Strong"), 'man', 'MCU', 26, 6, 40, {move: 'arc', lead: 0.3, dur: 0.8, push: 1.08})]},
  {name: 'refusal2', why: 'close on the woman shaking her head, swing wide to both women for the buggy line (camera stays inside, west side)', keys: [
    K(R.refusal2, 'woman', 'MCU', -28, 7, 40, {push: 1.05}),
    K(T('refusal2', 'pushed'), ['woman', 'grandma'], 'MS', -48, 8, 42, {move: 'arc', lead: 0.3, dur: 0.8, push: 1.05})]},
  {name: 'refusal3', why: 'all day: slow pull-back down the store from the untouched row and the slumped Goldman at the door', keys: [
    K(R.refusal3, ['goldman', 'cart:2'], 'WS', 180, 10, 46, {push: 0.94})]},
  {name: 'trick1', why: 'Goldman hires the actors: group MS, then in on him at "actors"', keys: [
    K(R.trick1, ['goldman', 'youngman'], 'FS', 100, 7, 44, {push: 1.05}),
    K(T('trick1', 'actors'), 'goldman', 'MCU', 10, 6, 40, {move: 'arc', lead: 0.3, dur: 0.7, push: 1.07})]},
  {name: 'trick2', why: 'E-tracks inside the aisle: ahead of the down-rolling actor cart, then ahead of the up-rolling one, pretending to shop', keys: [
    K(R.trick2, ['youngman', 'cart:0'], 'FS', 160, 8, 44, {push: 1.03, track: 5}),
    K(T('trick2', 'pretending'), ['youngwoman', 'cart:1'], 'FS', 15, 9, 44, {move: 'dolly', lead: 0.3, dur: 1.1, push: 1.04, track: 5})]},
  {name: 'trick3', why: 'tight on the watching shopper at the aisle mouth (heartbeat), arc wide as she takes the cart on "copied."', keys: [
    K(R.trick3, 'shopper', 'MCU', -14, 8, 40, {push: 1.05, track: 5}),
    K(T('trick3', 'copied'), ['shopper', 'cart:1'], 'MS', 12, 7, 42, {move: 'dolly', lead: 0.3, dur: 0.8, push: 1.06})]},
  {name: 'cascade', why: 'high shot from the front looking down the whole aisle so the multiplying carts can be COUNTED; wider on "every"', keys: [
    K(R.cascade, 'prop:aisle', 'WS', 2, 15, 46, {push: 1.05}),
    K(T('cascade', 'every'), 'prop:aisle', 'WS', 0, 16, 48, {move: 'arc', lead: 0.3, dur: 1.2, push: 1.08})]},
  {name: 'payoff1', why: 'hero wide from the front: a store full of rolling carts with Goldman presenting at the aisle mouth, then in on him at "years"', keys: [
    K(R.payoff1, 'prop:aisle', 'WS', 2, 15, 46, {push: 1.07}),
    K(T('payoff1', 'years'), 'goldman', 'MS', 160, 8, 42, {move: 'arc', lead: 0.3, dur: 1.0, push: 1.06})]},
  {name: 'payoff2', why: 'Goldman at his register, carts rolling past in the aisle behind him; punch in on "multimillionaire"', keys: [
    K(R.payoff2, 'goldman', 'MS', 35, 7, 42, {push: 1.06}),
    K(T('payoff2', 'multimillionaire'), 'goldman', 'MCU', 18, 6, 40, {move: 'pullpush', lead: 0.3, dur: 0.8, push: 1.12})]},
  {name: 'ending', why: 'callback: Goldman rolls the cart slowly toward camera down the aisle, final slow push', keys: [
    K(R.ending, ['goldman', 'cart:0'], 'MS', 0, 7, 42, {push: 1.03, track: 5}),
    K(T('ending', 'today'), ['goldman', 'cart:0'], 'MS', -6, 6, 42, {move: 'dolly', lead: 0.3, dur: 1.4, push: 1.08, track: 5})]},
];
export const KICKS: Kick[] = [
  {t: T('hook', 'wheels'), a: 0.3, z: 0.02},          // the punched word
  {t: R.build3, a: 0.4, z: 0.03},                     // "The world's first shopping cart."
  {t: T('trick3', 'copied'), a: 0.55, z: 0.04},       // the copy moment lands
  {t: T('cascade', 'every'), a: 0.3, z: 0.02},        // every cart in the store
];
export const WHIPS: Whip[] = [
  {t: R.launch, s: 1},                                // night workshop -> launch morning
  {t: R.cascade, s: -1},                              // into the cascade
];
export const FLASHES: Flash[] = [
  {t: T('night2', 'chair'), a: 0.15},                 // the idea glints
  {t: R.build3, a: 0.18},                             // hero reveal glint
  {t: T('trick3', 'copied'), a: 0.5},                 // impact flash on the copy
  {t: T('cascade', 'every'), a: 0.22},
];
