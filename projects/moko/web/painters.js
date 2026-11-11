// Moko cast — flat cartoon cards on the house romanFront skeleton (toon.js).
// Valid expressions: neutral, stern, grin, laugh, whistle, nervous, shock,
// relief, dazed, pained, smile, lick, stubborn.
// Valid arm poses: hang, point, up, wave, hip, belly, reach, lift.
import { romanFront } from './toon.js';

export const RESCUER = { tunic: '#e8641c', skin: '#f5c9a0', cap: '#c24e10', hair: '#2b211c' };    // hi-vis ORANGE wetsuit/vest
export const RESCUER2 = { tunic: '#ff7a26', skin: '#c99067', cap: '#8a3d08', hair: '#1e1714' };   // second rescuer, deeper orange
export const OFFICER = { tunic: '#1d3550', skin: '#ecd0b6', cap: '#122539', hair: '#3b2a20' };    // conservation officer: navy vest + cap
export const LOCAL = { tunic: '#3f7fb8', skin: '#f5c9a0', hair: '#241a14' };
export const LOCAL2 = { tunic: '#c25a7a', skin: '#ecd0b6', hair: '#3b2a20', dress: '#d9a441' };
export const LOCAL3 = { tunic: '#5d8a3a', skin: '#c99067', hair: '#1e1714' };

export const rescuerFront = (p, o = {}) => romanFront(p, o.alt ? RESCUER2 : RESCUER, o);
export const officerFront = (p, o = {}) => romanFront(p, OFFICER, o);
export const localFront = (p, o = {}) => romanFront(p, o.alt === 2 ? LOCAL3 : o.alt ? LOCAL2 : LOCAL, o);
