// Traffic Signal V2 camera (03_CAMERA_GRAMMAR, measured): push-in is the default move, the camera
// TRAVELS between subjects on the word, it is never still. V2 changes vs v1: hero subjects bigger
// (MS/MCU where v1 used FS/WS), the test beat is three keys (crank+signal -> all-stop tableau ->
// dolly with the girl), the payoff lands a dedicated MCU on the $40,000 cheque board.
import {K, type Take, type Kick, type Whip, type Flash, type Props} from '../../engine/camera/takes_api';
import {T} from '../../engine/core/clock';
import {SHOT_REAL as R} from './timeline';
export const PROPS: Props = {
  signal: [[2.4, 1.55, 7.9], [1.0, 1.6, 0.4]],
  crossing: [[0.2, 1.0, 12.6], [2.6, 1.5, 2.4]],
  worksignal: [[12.7, 1.6, 0.1], [1.0, 1.6, 0.4]],
  cheque: [[3.35, 1.05, 6.95], [0.9, 0.68, 0.15]],
};
export const TAKES: Take[] = [
  {name: 'hook', why: 'wide on the frozen crossing, push in on Morgan presenting his one word', keys: [
    K(R.hook, ['mechanic', 'woman'], 'FS', 18, 8, 44, {push: 1.06}),
    K(T('hook', 'stopped'), ['mechanic', 'prop:signal'], 'MS', 30, 5, 42, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.05})]},
  {name: 'intro', why: 'follow Morgan walking to his shop corner, traffic streaming past, arc onto him as he points at the old signal', keys: [
    K(R.intro, 'mechanic', 'MS', 28, 7, 44, {push: 1.04}),
    K(T('intro', 'chaos'), ['mechanic', 'prop:signal'], 'MS', 24, 9, 42, {move: 'arc', lead: 0.3, dur: 1.0, push: 1.05})]},
  {name: 'twowords', why: 'close on the old two-word signal flipping with no warning, then arc to Morgan as the other side starts moving too', keys: [
    K(R.twowords, 'prop:signal', 'CU', 14, 12, 42, {push: 1.07}),
    K(T('twowords', 'moving'), 'mechanic', 'MCU', -14, 12, 40, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.05})]},
  {name: 'crash', why: 'crossing at action height as both cars brake at the horse, then travel in on the child on the word Crash', keys: [
    K(R.crash, 'prop:crossing', 'FS', 95, 10, 44, {push: 1.03}),
    K(T('crash', 'Crash'), 'kid', 'MCU', 140, 5, 40, {move: 'arc', lead: 0.35, dur: 0.7, push: 1.06})]},
  {name: 'build', why: 'workshop night: Morgan at the bench with the half-built signal beside him, travel in as the third sign goes on', keys: [
    K(R.build, 'mechanic', 'FS', -18, 6, 44, {push: 1.05}),
    K(T('build', 'third'), 'mechanic', 'MCU', 10, 4, 40, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.05})]},
  {name: 'third', why: 'close on the signal as the signs roll Stop, Go, then travel out to proud Morgan when Everywhere rises', keys: [
    K(R.third, 'prop:signal', 'CU', 6, 6, 40, {push: 1.08}),
    K(T('third', 'Everywhere'), ['mechanic', 'prop:signal'], 'MS', 14, 5, 42, {move: 'arc', lead: 0.3, dur: 0.8, push: 1.05})]},
  {name: 'laugh', why: 'two-shot, then arc in on the laughing driver for his quoted line', keys: [
    K(R.laugh, ['man', 'mechanic'], 'MS', 55, 16, 42, {push: 1.04}),
    K(T('laugh', 'signal'), 'man', 'MCU', 30, 5, 40, {move: 'arc', lead: 0.3, dur: 0.9, push: 1.06})]},
  {name: 'test', why: 'HERO: Morgan cranks and the signal lights, tableau as every car stops with the girl waiting, then dolly with the girl all the way across between the stopped cars', keys: [
    K(R.test, ['mechanic', 'prop:signal'], 'FS', 40, 10, 44, {push: 1.03}),
    K(T('test', 'stopped'), ['mechanic', 'kid', 'prop:signal'], 'WS', 25, 14, 44, {move: 'arc', lead: 0.3, dur: 1.0, push: 1.04}),
    K(T('test', 'girl'), 'kid', 'FS', -8, 8, 44, {move: 'dolly', lead: 0.3, dur: 1.2, push: 1.04})]},
  {name: 'payoff', why: 'two-shot of the payoff, push in on the GE cheque board on the word dollars so $40,000 is read, then pull back to Morgan under his signal', keys: [
    K(R.payoff, ['mechanic', 'shopper2'], 'MS', 14, 6, 42, {push: 1.05}),
    K(T('payoff', 'dollars'), 'prop:cheque', 'MCU', 8, 6, 40, {move: 'pullpush', lead: 0.3, dur: 0.8, push: 1.12}),
    K(T('payoff', 'idea'), ['mechanic', 'prop:signal'], 'MS', -10, 8, 46, {move: 'pullpush', lead: 0.3, dur: 0.7, push: 0.96})]},
  {name: 'ending', why: 'Morgan under his signal, slow push in on the amber WAIT panel for the last word', keys: [
    K(R.ending, ['mechanic', 'prop:signal'], 'MS', 10, 7, 42, {push: 1.05}),
    K(T('ending', 'wait'), 'prop:signal', 'MCU', 4, 8, 38, {move: 'pullpush', lead: 0.35, dur: 1.0, push: 1.1})]},
];
export const KICKS: Kick[] = [];
export const WHIPS: Whip[] = [];
export const FLASHES: Flash[] = [];
