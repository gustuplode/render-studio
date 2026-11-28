// 1930s downtown block layout (pure data, no three/React) -> used by town.tsx (render), stage.ts (background life) and the checkers.
// Street cross-section (z): near facades 4.12 | near sidewalk 4.25-8.3 | parking 8.3-10.6 (cars z 9.45) | lane E 11.7 | lane W 14.4 |
// far parking (cars z 16.95) | far curb 18.15 | far sidewalk 18.3-22 | far facades 22.  x: block runs -42..42, cross streets, end towers at |x| 52+.
export type V3 = [number, number, number];
export type Unit = {x0: number; x1: number; side: 1 | -1; floors: number; wall: 'brickR' | 'brickY' | 'brickD' | string; trim: string;
  sign: string; signBg: string; signFg: string; awn?: [string, string]; door?: number; disp: number; blade?: string; interior?: boolean; tank?: boolean};
export const NEAR_Z = 4.12, FAR_Z = 22.0, CURB_N = 8.3, CURB_F = 18.15, LANE_E = 11.7, LANE_W = 14.4, PARK_F = 16.95;
const U = (x0: number, x1: number, side: 1 | -1, floors: number, wall: string, trim: string, sign: string, signBg: string, signFg: string, o: Partial<Unit> = {}): Unit =>
  ({x0, x1, side, floors, wall, trim, sign, signBg, signFg, disp: 0, ...o});
export const UNITS: Unit[] = [
  // near side (the grocery -4.1..4.1 is the hand-built set in Cart.tsx)
  U(4.1, 9.6, 1, 2, 'brickY', '#f2e3c0', 'HATS & DRY GOODS', '#27493f', '#f6e7b4', {awn: ['#2f6f53', '#f2e3c0'], disp: 1, door: 0.4}),
  U(9.6, 14.4, 1, 3, 'brickD', '#e8d8b0', 'THE OKLAHOMA NEWS', '#241726', '#f2e3c0', {disp: 2, interior: true, blade: 'NEWS', door: -0.6}),
  U(14.4, 19.4, 1, 2, '#efe0c0', '#b2391f', 'DRUG STORE', '#b2391f', '#fbf3e0', {awn: ['#c8432a', '#fbf3e0'], disp: 3, blade: 'DRUGS'}),
  U(19.4, 25.4, 1, 3, '#d8cdb4', '#8a8070', 'FIRST NATIONAL BANK', '#3a4a5a', '#f2e3c0', {disp: 4, tank: true}),
  U(25.4, 30.4, 1, 2, 'brickR', '#f2e3c0', 'SHOES', '#2a5f9a', '#f6e7b4', {awn: ['#2a5f9a', '#f2e3c0'], disp: 5}),
  U(30.4, 36, 1, 1, '#3f8a86', '#f2e3c0', 'CAFE', '#f2992a', '#241726', {awn: ['#f2992a', '#fbf3e0'], disp: 6}),
  U(36, 42, 1, 4, 'brickR', '#f2e3c0', 'HOTEL LEE', '#241726', '#e9b64a', {disp: 7, blade: 'HOTEL', tank: true}),
  U(-9.6, -4.1, 1, 2, '#e9b0a0', '#f8efe0', 'BAKERY', '#8a3a5a', '#fbf3e0', {awn: ['#d0607a', '#fbf3e0'], disp: 6, door: -0.5}),
  U(-14.6, -9.6, 1, 2, 'brickR', '#f2e3c0', 'HARDWARE', '#2e5a4a', '#f6e7b4', {awn: ['#2e5a4a', '#f2e3c0'], disp: 5, blade: 'TOOLS'}),
  U(-20, -14.6, 1, 1, '#a8d0b8', '#f8efe0', 'BARBER SHOP', '#b2391f', '#fbf3e0', {awn: ['#c8432a', '#fbf3e0'], disp: 3}),
  U(-25.4, -20, 1, 3, 'brickY', '#f2e3c0', 'FIVE & DIME', '#c8432a', '#f6e7b4', {awn: ['#c8432a', '#f6e7b4'], disp: 1, blade: '5¢ 10¢'}),
  U(-31, -25.4, 1, 3, 'brickD', '#e8d8b0', 'RIALTO', '#5a3a5a', '#f2c23a', {disp: 4, blade: 'RIALTO', tank: true}),
  U(-36, -31, 1, 2, '#efe0c0', '#2f6f73', 'TAILOR', '#2f6f73', '#fbf3e0', {awn: ['#2f6f73', '#fbf3e0'], disp: 2}),
  U(-42, -36, 1, 4, 'brickR', '#f2e3c0', 'HOTEL KINGKADE', '#241726', '#e9b64a', {disp: 7, blade: 'HOTEL'}),
  // far side (facades face -z)
  U(-42, -35.5, -1, 3, 'brickD', '#e8d8b0', 'FURNITURE', '#5a3a2a', '#f2e3c0', {awn: ['#7a3b22', '#f2e3c0'], disp: 4}),
  U(-35.5, -30, -1, 2, '#e9b0a0', '#f8efe0', 'JEWELER', '#241726', '#e9b64a', {disp: 7, blade: 'WATCHES'}),
  U(-30, -24, -1, 2, 'brickR', '#f2e3c0', "MEN'S WEAR", '#27493f', '#f6e7b4', {awn: ['#27493f', '#f2e3c0'], disp: 1}),
  U(-24, -18.5, -1, 1, '#f2d27a', '#7a3b22', 'RADIO SHOP', '#7a3b22', '#fbf3e0', {awn: ['#b2391f', '#f6e7b4'], disp: 2}),
  U(-18.5, -12, -1, 3, 'brickY', '#f2e3c0', 'DEPARTMENT STORE', '#b2391f', '#fbf3e0', {awn: ['#c8432a', '#fbf3e0'], disp: 3, blade: 'KERR\'S', tank: true}),
  U(-12, -6.5, -1, 2, '#3f8a86', '#f2e3c0', 'DINER', '#e8483a', '#fbf3e0', {awn: ['#e8483a', '#fbf3e0'], disp: 6}),
  U(-6.5, -1, -1, 2, 'brickR', '#f2e3c0', 'LAUNDRY', '#2a5f9a', '#fbf3e0', {awn: ['#5b8fb5', '#fbf3e0'], disp: 5}),
  U(-1, 5, -1, 3, 'brickD', '#e8d8b0', 'BOOKS', '#2e5a4a', '#f6e7b4', {awn: ['#2e5a4a', '#f2e3c0'], disp: 4}),
  U(5, 10.5, -1, 2, '#efe0c0', '#8a3a5a', 'MUSIC', '#8a3a5a', '#fbf3e0', {awn: ['#8a3a5a', '#fbf3e0'], disp: 2, blade: 'RECORDS'}),
  U(10.5, 16, -1, 1, '#a8d0b8', '#f8efe0', 'TOYS', '#f2b234', '#241726', {awn: ['#f2b234', '#fbf3e0'], disp: 6}),
  U(16, 22, -1, 3, 'brickY', '#f2e3c0', 'OFFICE SUPPLY', '#241726', '#f2e3c0', {disp: 1}),
  U(22, 28, -1, 2, 'brickR', '#f2e3c0', 'FLORIST', '#3f6a4a', '#fbf3e0', {awn: ['#3f6a4a', '#fbf3e0'], disp: 3}),
  U(28, 35, -1, 4, '#d8cdb4', '#8a8070', 'INSURANCE', '#3a4a5a', '#f2e3c0', {disp: 7, tank: true}),
  U(35, 42, -1, 2, 'brickD', '#e8d8b0', 'GARAGE', '#c8432a', '#fbf3e0', {disp: 5, blade: 'GAS'}),
];
export const GF = 4.6, FLH = 3.4;   // ground floor height, upper floor height
export const unitH = (u: Unit) => GF + (u.floors - 1) * FLH + 0.7;
export const DEPTH = 6;
/** towers that close the vistas / fill the skyline: [x0,x1,z0,z1,h] */
export const TOWERS: [number, number, number, number, number][] = [
  [50, 66, -14, 40, 26], [-66, -50, -14, 40, 30],
  [-30, -18, -26, -12, 22], [-6, 6, -30, -14, 34], [16, 30, -24, -10, 20], [34, 46, -30, -16, 28], [-48, -36, -24, -10, 18],
  [-24, -10, 30, 44, 24], [4, 18, 32, 46, 30], [26, 40, 30, 44, 20], [-46, -32, 30, 42, 26],
];
// street furniture
export const LAMPS_N: number[] = [-33.75, -24.75, -15.75, -6.75, 15.75, 24.75, 33.75];
export const LAMPS_F: number[] = [-38.25, -29.25, -20.25, -11.25, -2.25, 6.75, 15.75, 24.75, 33.75];
export const CLOCK: V3 = [10.6, 0, 7.75];
export const HYDRANTS: V3[] = [[-11.6, 0, 7.6], [-18.6, 0, 7.6], [20.5, 0, 7.6], [-8.6, 0, 18.75], [12.4, 0, 18.75]];
export const MAILBOX: V3 = [-12.5, 0, 7.55];
export const BINS: V3[] = [[13.1, 0, 7.6], [-27.6, 0, 7.6], [2.6, 0, 18.75], [-23.5, 0, 18.75]];
/** far-side parked cars (static) */
export const FAR_CARS: {x: number; col: string}[] = [-36, -30.5, -19.5, -14, -3, 2.5, 8, 19, 24.5, 35.5].map((x, i) => ({x, col: ['#5a3a5a', '#2f4f6a', '#c9a24a', '#3f6a4a', '#7a2f2a', '#2b2a33', '#a8443a', '#2f4f6a', '#3f6a4a', '#c9a24a'][i]}));
/** near-side parked cars outside the four story spaces (x of space centres) */
export const OUTER_SPACES = [-33.75, -29.25, -24.75, -20.25, -15.75, -11.25, 11.25, 15.75, 20.25, 24.75, 29.25, 33.75];
export const OUTER_METERS = [-18, -13.5, 13.5, 18, 22.5];   // the meter district ends at x = -18: the spots further west are still free

// ---------- solids for the checkers (x0,x1,y0,y1,z0,z1,name) ----------
export type Box = [number, number, number, number, number, number, string];
export function townSolids(): Box[] {
  const o: Box[] = [];
  for (const u of UNITS) {
    const h = unitH(u);
    if (u.side === 1) { if (u.interior) o.push([u.x0, u.x1, 0, h, NEAR_Z - 0.2, NEAR_Z + 0.15, 'facade ' + u.sign], [u.x0, u.x1, 3.2, h, NEAR_Z - DEPTH, NEAR_Z, 'upper ' + u.sign]);
      else o.push([u.x0, u.x1, 0, h, NEAR_Z - DEPTH, NEAR_Z + 0.15, 'bldg ' + u.sign]); }
    else o.push([u.x0, u.x1, 0, h, FAR_Z - 0.15, FAR_Z + DEPTH, 'bldg ' + u.sign]);
    if (u.awn) o.push(u.side === 1 ? [u.x0, u.x1, 2.4, 3.05, NEAR_Z, NEAR_Z + 1.25, 'awning ' + u.sign] : [u.x0, u.x1, 2.4, 3.05, FAR_Z - 1.25, FAR_Z, 'awning ' + u.sign]);
  }
  for (const t of TOWERS) o.push([t[0], t[1], 0, t[4], t[2], t[3], 'tower']);
  for (const x of LAMPS_N) o.push([x - 0.12, x + 0.12, 0, 3.6, 7.78, 8.02, 'lamp']);
  for (const x of LAMPS_F) o.push([x - 0.12, x + 0.12, 0, 3.6, 18.38, 18.62, 'lamp']);
  o.push([CLOCK[0] - 0.14, CLOCK[0] + 0.14, 0, 3.0, CLOCK[2] - 0.14, CLOCK[2] + 0.14, 'clock post'], [CLOCK[0] - 0.42, CLOCK[0] + 0.42, 3.0, 3.85, CLOCK[2] - 0.2, CLOCK[2] + 0.2, 'clock']);
  for (const h of HYDRANTS) o.push([h[0] - 0.16, h[0] + 0.16, 0, 0.62, h[2] - 0.12, h[2] + 0.12, 'hydrant']);
  for (const b of BINS) o.push([b[0] - 0.25, b[0] + 0.25, 0, 0.8, b[2] - 0.25, b[2] + 0.25, 'bin']);
  o.push([MAILBOX[0] - 0.28, MAILBOX[0] + 0.28, 0, 1.2, MAILBOX[2] - 0.25, MAILBOX[2] + 0.25, 'mailbox']);
  for (const c of FAR_CARS) o.push([c.x - 2.2, c.x + 2.2, 0, 1.66, PARK_F - 0.95, PARK_F + 0.95, 'far car']);
  return o;
}
