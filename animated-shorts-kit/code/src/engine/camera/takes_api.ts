// ENGINE camera/takes_api: the types a story uses to write its camera TAKES (see camera.ts for how they run).
import type {V3} from '../core/clock';
export type Size = 'ECU' | 'CU' | 'MCU' | 'MS' | 'FS' | 'WS' | 'EWS';
export type Setup = {
  at: number;            // real seconds (absolute) of the cut into this setup; 0 / first = shot start
  sub: string[]; size: Size;
  az: number; el: number; fov: number;   // camera direction from the subject (deg; az 0 = camera on +z looking -z), vertical fov
  push?: number;         // subject scale at the end of the setup (1.1 = 10 % bigger)
  arc?: number; crane?: number; fov1?: number; roll?: number; roll1?: number;
  ease?: 'io' | 'lin' | 'out' | 'in';
  settle?: [number, number];   // quick ease-out push at the cut: [start scale deficit, seconds] (reference: shots open on a short push)
  sx?: number; sy?: number;    // screen placement shift of the framing rect (NDC)
  pan?: boolean;         // keep the position of the setup start, only re-aim at the subject
  ecu?: boolean;         // intentional crop (checker exempt for the head box)
  occOK?: boolean;       // intentional overlap (a row of cars shot down its length)
  dof?: number;          // override blur at infinity (px @1080)
  track?: number;        // subject smoothing half-window in frames (default 10 = +-0.33 s)
  smooth?: number;       // operator smoothing half-window in frames (default 5; 0 for snap moves)
  why?: string;
  // ---- continuous takes (v4): how the camera travels INTO this key from the previous key of the take ----
  move?: Move; lead?: number; dur?: number; bump?: number; blur?: number;
};
export type Move = 'arc' | 'pullpush' | 'pan' | 'dolly' | 'whip';
const U = (at: number, sub: string | string[], size: Size, az: number, el: number, fov: number, o: Partial<Setup> = {}): Setup =>
  ({at, sub: Array.isArray(sub) ? sub : [sub], size, az, el, fov, ...o});
export const K = U;   // a key of a take (same signature as a setup)
export {U};
export type Take = {name: string; keys: Setup[]; why?: string};
export type Kick = {t: number; a: number; z: number};
export type Whip = {t: number; s: number};
export type Flash = {t: number; a: number};
/** named set props the camera can frame: centre, radius or [half-width, half-height, half-depth] */
export type Props = Record<string, [V3, number | V3]>;
