// Winter cast — flat cartoon cards on the house romanFront skeleton (toon.js/roman.js).
// New outfits only + a glasses overlay for Kevin. Valid romanFront arm poses:
// hang(=down), point, up, wave, hip, belly, reach, lift. Valid expressions per brief.
import { romanFront, headCenter } from './toon.js'; // toon.js is the full bundle (toonbase + roman cast); roman.js alone is a fragment

export const RESCUER = { tunic: '#e8641c', skin: '#f5c9a0', cap: '#c24e10', hair: '#2b211c' };   // hi-vis orange + cap
export const RESCUER2 = { tunic: '#e8b41c', skin: '#c99067', cap: '#8a6a10', hair: '#1e1714' };  // hi-vis yellow
export const KEEPER = { tunic: '#177e8c', skin: '#ecd0b6', hair: '#2b211c' };                    // aquarium polo teal
export const KEEPER2 = { tunic: '#1a6a96', skin: '#f5c9a0', hair: '#5a3b2a' };                   // aquarium polo blue
export const VET = { tunic: '#e9edec', skin: '#f5c9a0', hair: '#5a3b2a', shirt: '#3a6a8c' };     // white coat + scrubs V
export const KEVIN = { tunic: '#46648c', skin: '#f5c9a0', hair: '#3b2a20', shirt: '#f1e6cf' };   // engineer: shirt + glasses
export const CHILD = { tunic: '#e2453c', skin: '#f5c9a0', hair: '#241a14' };
export const CHILD2 = { tunic: '#3f7fb8', skin: '#ecd0b6', hair: '#3b2a20' };
export const VETERAN = { tunic: '#5d6e46', skin: '#c99067', hair: '#1e1714' };

export const rescuerFront = (p, o = {}) => romanFront(p, o.alt ? RESCUER2 : RESCUER, o);
export const keeperFront = (p, o = {}) => romanFront(p, o.alt ? KEEPER2 : KEEPER, o);
export const vetFront = (p, o = {}) => romanFront(p, VET, o);
export const childFront = (p, o = {}) => romanFront(p, o.alt ? CHILD2 : CHILD, o);
export const veteranFront = (p, o = {}) => romanFront(p, VETERAN, o);
export const kevinFront = (p, o = {}) => {
  romanFront(p, KEVIN, o);
  // glasses: two rims + bridge, centred on the romanFront head (eyes ~ +/-13u at head centre height)
  const hc = headCenter(o.seed ?? 3) - (o.bob || 0) * 222;
  const u = 2.36;
  p.ell(300 - 13 * u, hc, 10.5 * u, 9 * u, null, 3.2);
  p.ell(300 + 13 * u, hc, 10.5 * u, 9 * u, null, 3.2);
  p.stroke([[300 - 3 * u, hc - 1 * u], [300 + 3 * u, hc - 1 * u]], 3);
  p.stroke([[300 - 23 * u, hc - 2 * u], [300 - 30 * u, hc - 6 * u]], 2.6);
  p.stroke([[300 + 23 * u, hc - 2 * u], [300 + 30 * u, hc - 6 * u]], 2.6);
};
