// Traffic Signal camera (03_CAMERA_GRAMMAR): one take per beat, push-in is the default,
// the camera TRAVELS between subjects on the word — never a lazy static hold (every key pushes or arcs).
import {K, type Take, type Kick, type Whip, type Flash, type Props} from '../../engine/camera/takes_api';
import {T} from '../../engine/core/clock';
import {SHOT_REAL as R} from './timeline';
export const PROPS: Props = {
  signal: [[2.4, 1.55, 7.9], [1.0, 1.6, 0.4]],
  crossing: [[0.2, 1.0, 12.6], [2.6, 1.5, 2.4]],
};
export const TAKES: Take[] = [
  {name: 'hook', why: 'wide on the frozen crossing, push in on Morgan presenting his one word', keys: [
    K(R.hook, ['mechanic', 'woman'], 'FS', 18, 8, 44, {push: 1.06}),
    K(T('hook', 'stopped'), ['mechanic', 'prop:signal'], 'MS', 30, 5, 42, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.05})]},
  {name: 'intro', why: 'follow Morgan walking to his shop corner, traffic streaming past, arc onto him as he points at the old signal', keys: [
    K(R.intro, 'mechanic', 'FS', 28, 7, 44, {push: 1.04}),
    K(T('intro', 'chaos'), ['mechanic', 'prop:signal'], 'MS', 24, 9, 42, {move: 'arc', lead: 0.3, dur: 1.0, push: 1.05})]},
  {name: 'twowords', why: 'push in on the old two-word signal flipping, then arc to Morgan as the other side starts moving too', keys: [
    K(R.twowords, 'prop:signal', 'MS', 18, 15, 42, {push: 1.07}),
    K(T('twowords', 'moving'), 'mechanic', 'MCU', -14, 12, 40, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.05})]},
  {name: 'crash', why: 'wide crossing as the car brakes at the horse, then travel in on the child on the word Crash', keys: [
    K(R.crash, 'prop:crossing', 'FS', 95, 12, 44, {push: 1.03}),
    K(T('crash', 'Crash'), 'kid', 'MCU', 55, 5, 40, {move: 'pullpush', lead: 0.35, dur: 0.8, push: 1.06})]},
  {name: 'build', why: 'workshop: wider on Morgan at the bench with the half-built signal beside him, push in as the third sign goes on', keys: [
    K(R.build, 'mechanic', 'FS', -18, 6, 44, {push: 1.05}),
    K(T('build', 'third'), 'mechanic', 'MCU', 10, 4, 40, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.05})]},
  {name: 'third', why: 'close on the signal as the signs roll Stop, Go, then travel out to proud Morgan when Everywhere rises', keys: [
    K(R.third, 'prop:signal', 'CU', 6, 6, 40, {push: 1.08}),
    K(T('third', 'Everywhere'), ['mechanic', 'prop:signal'], 'MS', 14, 5, 42, {move: 'arc', lead: 0.3, dur: 0.8, push: 1.05})]},
  {name: 'laugh', why: 'two-shot, then arc in on the laughing driver for his quoted line', keys: [
    K(R.laugh, ['man', 'mechanic'], 'MS', 55, 16, 42, {push: 1.04}),
    K(T('laugh', 'signal'), 'man', 'MCU', 30, 5, 40, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.06})]},
  {name: 'test', why: 'wide on the crossing as every car stops, then travel with the little girl all the way across', keys: [
    K(R.test, 'prop:crossing', 'FS', 58, 14, 44, {push: 1.02}),
    K(T('test', 'girl'), 'kid', 'FS', 80, 8, 44, {move: 'dolly', lead: 0.3, dur: 1.2, push: 1.04})]},
  {name: 'payoff', why: 'two-shot of the payoff, then pull back to the whole street running on his signal', keys: [
    K(R.payoff, ['mechanic', 'shopper2'], 'MS', 14, 6, 42, {push: 1.05}),
    K(T('payoff', 'dollars'), 'prop:signal', 'WS', -10, 8, 46, {move: 'pullpush', lead: 0.3, dur: 1.1, push: 0.94})]},
  {name: 'ending', why: 'Morgan under his signal, slow push in on the amber WAIT panel for the last word', keys: [
    K(R.ending, ['mechanic', 'prop:signal'], 'MS', 10, 7, 42, {push: 1.05}),
    K(T('ending', 'wait'), 'prop:signal', 'MCU', 4, 8, 38, {move: 'pullpush', lead: 0.35, dur: 1.0, push: 1.1})]},
];
export const KICKS: Kick[] = [];
export const WHIPS: Whip[] = [];
export const FLASHES: Flash[] = [];
