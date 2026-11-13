// Shot plan for "Tama — The Cat Who Saved a Railway" — timed to tama-voice
// (53.350 s, 30 fps, TOTAL 1600). One station set, ONE continuous camera flight:
// every section's first camera key == the previous section's last key (no cuts).
// Phrases: P1 0-115 | P2 144-251 | P3 282-404 | P4 434-566 | P5 598-704 |
// P6 733-788 | P7 808-930 | P8 959-1048 | P9 1079-1190 | P10 1222-1325 |
// P11 1363-1445 | P12 1484-1577. Sections tile 0..1599; gaps -> outgoing section.
// Set anchors (built in main.js): platform top y=0.55, slab z[-3.2,1.2];
// station wall z=-3.4; track z=2.6; Tama spot (0.4,0.55,-0.9); office booth
// (3.2,0.55,-2.2); board easel (-1.8,0.55,-1.6) ry=0.30; KISHI sign (0,3.05,-1.3).
// VOICE NOTE: recorded P12 = Nitama takes the cap (timing.json) — picture follows
// the voice; script.txt's P12 question line was never recorded.
import { M, camFromKeys, blinkAt, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';
import { nitamaCard } from './extras.js';

export const FPS = 30, TOTAL = 1600, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 143, light: 'day' },
  { id: 'shut', a: 144, b: 281, light: 'dull' },
  { id: 'greet', a: 282, b: 433, light: 'day' },
  { id: 'master', a: 434, b: 597, light: 'day' },
  { id: 'gear', a: 598, b: 732, light: 'warm' },
  { id: 'salary', a: 733, b: 807, light: 'warm' },
  { id: 'visitors', a: 808, b: 958, light: 'day' },
  { id: 'saved', a: 959, b: 1078, light: 'golden' },
  { id: 'promoted', a: 1079, b: 1221, light: 'day' },
  { id: 'years', a: 1222, b: 1362, light: 'day' },
  { id: 'forever', a: 1363, b: 1483, light: 'dusk' },
  { id: 'nitama', a: 1484, b: 1599, light: 'dawn' },
];
export const TIMING = SHOTS.map((s) => [s.id, s.a, s.b]);
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || (f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1]);
const smooth = M.smooth;

// ---------- lights ----------
const WATER = { waterDeep: '#2c4a5c', waterShal: '#3a6a7c', glint: '#ffe9c0' };
export const LIGHTS = {
  day: { az: 125, el: 44, sky: '#bfd4ea', ground: '#5a6a3a', hemi: 1.22, sun: '#fff3da', sunI: 2.2, fog: '#d3e2ee', fogNear: 48, fogFar: 420,
    skyTop: '#6f97cc', skyHor: '#eef0da', sunDisc: '#fff6da', sunSize: 0.0032, sat: 1.05, vig: 0.2, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  dull: { az: 150, el: 30, sky: '#9fb0c0', ground: '#4c5638', hemi: 1.0, sun: '#d8dee2', sunI: 1.4, fog: '#b6c0c8', fogNear: 40, fogFar: 320,
    skyTop: '#7186a0', skyHor: '#ccd2d2', sunDisc: '#e8ecec', sunSize: 0.0022, sat: 0.9, vig: 0.3, shadowExt: 18, aurora: 0, gain: '#eef0f2', ...WATER },
  warm: { az: 112, el: 32, sky: '#c9c2a4', ground: '#5f6136', hemi: 1.16, sun: '#ffd9a0', sunI: 2.3, fog: '#ddd0a4', fogNear: 44, fogFar: 360,
    skyTop: '#7d90c2', skyHor: '#ffce96', sunDisc: '#ffe9bd', sunSize: 0.0032, sat: 1.07, vig: 0.23, shadowExt: 18, aurora: 0, gain: '#ffffff', ...WATER },
  golden: { az: 95, el: 19, sky: '#d9b28c', ground: '#6a5a2c', hemi: 1.15, sun: '#ffb763', sunI: 2.5, fog: '#e5bd85', fogNear: 42, fogFar: 340,
    skyTop: '#5f7fc0', skyHor: '#ffd9a0', sunDisc: '#fff3cf', sunSize: 0.0036, sat: 1.09, vig: 0.25, shadowExt: 18, aurora: 0, gain: '#ffedd6', ...WATER },
  dusk: { az: 250, el: 9, sky: '#7d86a8', ground: '#3c4436', hemi: 0.82, sun: '#e8a06a', sunI: 1.1, fog: '#8d87a0', fogNear: 36, fogFar: 260,
    skyTop: '#3d4a75', skyHor: '#e0a878', sunDisc: '#ffd9a8', sunSize: 0.004, sat: 0.98, vig: 0.34, shadowExt: 18, aurora: 0, gain: '#f2e4da', ...WATER },
  dawn: { az: 75, el: 14, sky: '#c4b49a', ground: '#55603c', hemi: 1.05, sun: '#ffc98a', sunI: 1.9, fog: '#dcc7a2', fogNear: 42, fogFar: 340,
    skyTop: '#7d94c4', skyHor: '#ffdcae', sunDisc: '#fff0cd', sunSize: 0.0038, sat: 1.06, vig: 0.24, shadowExt: 18, aurora: 0, gain: '#fff2dc', ...WATER },
};
const hexLerp = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const blendLight = (A, B, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k], t) : hexLerp(A[k], B[k], t);
  return o;
};
export const lightFor = (S, f) => {
  if (S.id === 'years') { // eight years pass: spring day -> grey winter -> warm spring
    if (f < 1290) return blendLight(LIGHTS.day, LIGHTS.dull, smooth(ramp(f, 1222, 1290)));
    return blendLight(LIGHTS.dull, LIGHTS.warm, smooth(ramp(f, 1290, 1362)));
  }
  if (S.id === 'nitama') return blendLight(LIGHTS.dusk, LIGHTS.dawn, smooth(ramp(f, 1484, 1540)));
  return { ...LIGHTS[S.light] };
};

// ---------- staging ----------
export const TAMA_POS = [0.4, 0.55, -0.9];
export const BOSS_POS = [1.7, 0.55, -1.6];
export const tamaPosAt = (f) => [...TAMA_POS];
export const tamaScaleAt = (f) => 0.52;

// train travel (group x), shared by story + main: arrives hook, leaves shut,
// returns visitors, stays saved..forever (far right), returns nitama.
export const trainXAt = (f) => kf([
  [0, -26], [30, -26], [130, -3.4], [170, -3.4], [235, 30], [807, 30], [855, -3.4],
  [1362, -3.4], [1420, 26], [1483, 26], [1545, -3.4], [1599, -3.4],
], f);
export const trainVAt = (f) => (trainXAt(Math.min(f + 1, TOTAL - 1)) - trainXAt(f)) * 30; // m/s approx

// ---------- boards (single source of truth for main.js meshes + sweep projection) ----------
export const BOARDS = [
  { id: 'sign', pos: [0, 3.02, -1.25], w: 2.3, h: 0.64, yaw: 0, key: null, check: [0, 143] }, // set sign: gated on the wide hook shot where it is read; scenery afterwards
  { id: 'close', pos: [-1.25, 1.62, -1.35], w: 1.42, h: 0.9, yaw: 0.22, key: 'boardClose', check: [144, 281] },
  { id: 'master', pos: [-1.25, 1.62, -1.35], w: 1.42, h: 0.9, yaw: 0.22, key: 'boardMaster', check: [434, 597] },
  { id: 'saved', pos: [-1.25, 1.62, -1.35], w: 1.42, h: 0.9, yaw: 0.22, key: 'boardSaved', check: [959, 1078] },
  { id: 'forever', pos: [-0.55, 1.62, -1.18], w: 1.42, h: 0.9, yaw: 0.15, key: 'boardForever', check: [1363, 1483] },
];

// ---------- cameras (boundary keys shared between sections) ----------
const CAMS = {
  hook: [ { f: 0, pos: [8.6, 4.6, 12.6], look: [0, 1.4, -1], fov: 40 }, { f: 143, pos: [5.4, 2.7, 8.4], look: [0.1, 1.15, -0.6], fov: 38 } ],
  shut: [ { f: 144, pos: [5.4, 2.7, 8.4], look: [0.1, 1.15, -0.6], fov: 38 }, { f: 281, pos: [2.7, 1.7, 4.7], look: [-1.0, 1.3, -1.2], fov: 37 } ],
  greet: [ { f: 282, pos: [2.7, 1.7, 4.7], look: [-1.0, 1.3, -1.2], fov: 37 }, { f: 360, pos: [1.9, 1.45, 3.3], look: [-0.1, 1.2, -0.9], fov: 37 }, { f: 433, pos: [1.45, 1.3, 2.5], look: [0.4, 1.25, -0.9], fov: 36 } ],
  master: [ { f: 434, pos: [1.45, 1.3, 2.5], look: [0.4, 1.25, -0.9], fov: 36 }, { f: 500, pos: [2.5, 1.6, 4.2], look: [-0.55, 1.26, -1.15], fov: 37 }, { f: 597, pos: [2.9, 1.7, 4.8], look: [-0.85, 1.3, -1.3], fov: 38 } ],
  gear: [ { f: 598, pos: [2.9, 1.7, 4.8], look: [-0.85, 1.3, -1.3], fov: 38 }, { f: 732, pos: [1.3, 1.35, 2.3], look: [0.4, 1.3, -0.9], fov: 35 } ],
  salary: [ { f: 733, pos: [1.3, 1.35, 2.3], look: [0.4, 1.3, -0.9], fov: 35 }, { f: 807, pos: [1.05, 1.0, 1.9], look: [0.35, 0.8, -0.7], fov: 36 } ],
  visitors: [ { f: 808, pos: [1.05, 1.0, 1.9], look: [0.35, 0.8, -0.7], fov: 36 }, { f: 880, pos: [4.4, 2.1, 6.6], look: [-0.5, 1.2, -1.2], fov: 38 }, { f: 958, pos: [3.4, 1.9, 5.6], look: [0.1, 1.2, -0.9], fov: 39 } ],
  saved: [ { f: 959, pos: [3.4, 1.9, 5.6], look: [0.1, 1.2, -0.9], fov: 39 }, { f: 1078, pos: [5.8, 3.1, 8.8], look: [0, 1.35, -0.8], fov: 40 } ],
  promoted: [ { f: 1079, pos: [5.8, 3.1, 8.8], look: [0, 1.35, -0.8], fov: 40 }, { f: 1221, pos: [2.7, 1.65, 4.5], look: [0.7, 1.3, -1.1], fov: 37 } ],
  years: [ { f: 1222, pos: [2.7, 1.65, 4.5], look: [0.7, 1.3, -1.1], fov: 37 }, { f: 1290, pos: [0.4, 1.4, 3.6], look: [0.4, 1.25, -0.9], fov: 37 }, { f: 1362, pos: [-1.5, 1.45, 3.1], look: [0.4, 1.2, -0.9], fov: 37 } ],
  forever: [ { f: 1363, pos: [-1.5, 1.45, 3.1], look: [-0.2, 1.22, -1.0], fov: 37 }, { f: 1483, pos: [0.35, 1.5, 4.6], look: [-0.55, 1.28, -1.15], fov: 39 } ],
  nitama: [ { f: 1484, pos: [0.35, 1.5, 4.6], look: [-0.55, 1.28, -1.15], fov: 39 }, { f: 1599, pos: [1.8, 1.35, 3.4], look: [0.35, 1.2, -0.85], fov: 37 } ],
};
const SHADOW_AT = { hook: [0, 1, 0], shut: [-1, 1, -1], greet: [0.4, 1, -0.9], master: [0.4, 1, -0.9], gear: [0.4, 1, -0.9], salary: [0.4, 0.8, -0.7], visitors: [0, 1, -1], saved: [0, 1, 0], promoted: [0.7, 1, -1], years: [0.4, 1, -0.9], forever: [0.2, 1, -1], nitama: [0.4, 1, -0.9] };
const shotCam = (id, f) => camFromKeys(CAMS[id], f);
export const camAt = (f) => {
  const S = shotAt(f);
  const c = shotCam(S.id, f);
  c.flash = f < 9 ? -0.95 * (1 - f / 9) : 0;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let point = TAMA_POS, cinf = 8;
  if (S.id === 'hook' || S.id === 'saved') { point = [0, 1.3, 0.5]; cinf = 10; }
  if (S.id === 'gear' || S.id === 'salary') cinf = 5;
  if (S.id === 'forever') { point = [0.2, 1.1, -1.0]; cinf = 6; }
  const d = Math.hypot(C.pos[0] - point[0], C.pos[1] - point[1], C.pos[2] - point[2]);
  return { focus: d, cinf };
};

// ---------- world state ----------
export const worldAt = (f) => ({
  boardClose: f < 282 ? ramp(f, 196, 226) : 1 - ramp(f, 282, 312),
  boardMaster: f < 434 ? 0 : (f > 597 ? 0 : ramp(f, 500, 530) * (1 - ramp(f, 568, 597))),
  boardSaved: f < 959 ? 0 : (f > 1078 ? 0 : ramp(f, 985, 1015) * (1 - ramp(f, 1048, 1078))),
  boardForever: f < 1363 ? 0 : ramp(f, 1422, 1452),
  bowlT: (f >= 598 && f < 1363) ? 1 : 0,
  starT: ramp(f, 1100, 1160),
  capPropT: (f >= 1363 && f < 1484) ? 1 : 0,
  badgeGlint: (f >= 598 && f < 733) ? 0.55 + 0.35 * Math.sin(f * 0.3) : 0,
  trainX: trainXAt(f),
  lampT: (f >= 1363 && f < 1484) ? 1 : 0,
  grassK: 0.6, windK: 0.5,
});
export const fxProfileAt = (f) => {
  const v = Math.abs(trainVAt(f));
  return { smokeRate: clamp(v * 2.2, 0, 26), dustRate: 0.5 };
};

// ---------- actors ----------
const TINT = { day: '#ffffff', dull: '#dfe5ea', warm: '#ffedd6', golden: '#ffe4bb', dusk: '#c8b8d8', dawn: '#ffe9c9' };
const tintFor = (S) => TINT[S.light] || '#ffffff';
const RT = (T, o, pos, extra = {}) => ({ key: 'tama' + JSON.stringify(o), draw: (p) => T.tamaCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const RN2 = (T, o, pos, extra = {}) => ({ key: 'nita' + JSON.stringify(o), draw: (p) => nitamaCard(p, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const RH = (T, outfit, o, pos, extra = {}) => ({ key: 'hum' + JSON.stringify([outfit.jacket || outfit.tunic || '', o]), draw: (p) => T.bodyFront(p, outfit, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const BOSS = { jacket: '#2e3d5c', pants: '#2a2f3a', boots: '#33261a', skin: '#f5c9a0', build: 'adult' };
const breath = (f, seed) => 0.0045 * Math.sin((f + seed * 11) * 0.11);

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = tintFor(S);
  const ts = tamaScaleAt(f);
  const tamaBase = (extra = {}) => ({ view: 'front', expr: 'smile', blink: blinkAt(f, 7), wag: 0.5, wagPh: f / 30, cap: 0, ...extra });
  switch (S.id) {
    case 'hook': {
      out.push(RT(T, tamaBase({ expr: 'smile' }), TAMA_POS, { tint, s: ts }));
      break;
    }
    case 'shut': {
      out.push(RT(T, tamaBase({ expr: 'neutral', wag: 0.25 }), TAMA_POS, { tint, s: ts }));
      break;
    }
    case 'greet': {
      out.push(RT(T, tamaBase({ expr: 'smile', wag: 0.8 }), TAMA_POS, { tint, s: ts }));
      if (f > 300) { // two passengers stroll the platform behind her
        const px = -4.4 + (f - 300) * 0.012;
        out.push(RH(T, T.townsfolk(2), { expr: 'smile', mode: 'march', phase: f / 9, blink: blinkAt(f, 31), seed: 31 }, [px, 0.55, -2.3], { tint, s: 0.98, shadow: false }));
        out.push(RH(T, T.townsfolk(5), { expr: 'neutral', mode: 'march', phase: f / 9 + 2, blink: 0, seed: 47 }, [px - 1.1, 0.55, -2.55], { tint, s: 0.94, shadow: false }));
      }
      break;
    }
    case 'master': {
      const capped = f >= 505;
      out.push(RT(T, tamaBase({ expr: capped ? 'grin' : 'smile', cap: capped ? 1 : 0 }), TAMA_POS, { tint, s: ts }));
      out.push(RH(T, BOSS, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), wave: f >= 470 && f < 540 ? 1 : 0, seed: 41 }, BOSS_POS, { tint, s: 1.02, yaw: -0.5 }));
      break;
    }
    case 'gear': {
      out.push(RT(T, tamaBase({ expr: 'grin', cap: 1 }), TAMA_POS, { tint, s: ts }));
      break;
    }
    case 'salary': {
      out.push(RT(T, tamaBase({ expr: 'lick', cap: 1, wag: 0.9 }), TAMA_POS, { tint, s: ts }));
      break;
    }
    case 'visitors': {
      out.push(RT(T, tamaBase({ expr: 'smile', cap: 1, wag: 0.85 }), TAMA_POS, { tint, s: ts }));
      const crowd = [[-3.3, -2.2, 0], [-2.1, -2.5, 3], [2.3, -2.3, 1], [3.6, -2.0, 4], [4.8, -2.45, 2]];
      crowd.forEach(([cx, cz, v], i) => {
        out.push(RH(T, T.townsfolk(v), { expr: i % 2 ? 'smile' : 'neutral', mode: 'stand', blink: blinkAt(f, 51 + i * 7), seed: 51 + i * 7, phase: 0 }, [cx, 0.55, cz], { tint, s: 0.95 + (i % 3) * 0.03, shadow: false }));
      });
      break;
    }
    case 'saved': {
      out.push(RT(T, tamaBase({ expr: 'grin', cap: 1, wag: 0.9 }), TAMA_POS, { tint, s: ts }));
      out.push(RH(T, BOSS, { expr: 'grin', mode: 'stand', blink: blinkAt(f, 41), wave: 1, seed: 41 }, BOSS_POS, { tint, s: 1.02, yaw: -0.4 }));
      const crowd = [[-3.3, -2.2, 0], [-2.1, -2.5, 3], [2.3, -2.3, 1], [3.6, -2.0, 4], [4.8, -2.45, 2]];
      crowd.forEach(([cx, cz, v], i) => {
        out.push(RH(T, T.townsfolk(v), { expr: 'smile', mode: 'stand', blink: blinkAt(f, 51 + i * 7), seed: 51 + i * 7, phase: 0 }, [cx, 0.55, cz], { tint, s: 0.95 + (i % 3) * 0.03, shadow: false }));
      });
      break;
    }
    case 'promoted': {
      out.push(RT(T, tamaBase({ expr: 'grin', cap: 1 }), TAMA_POS, { tint, s: ts }));
      out.push(RH(T, BOSS, { expr: 'smile', mode: 'stand', blink: blinkAt(f, 41), wave: f > 1130 ? 1 : 0, seed: 41 }, BOSS_POS, { tint, s: 1.02, yaw: -0.5 }));
      break;
    }
    case 'years': {
      out.push(RT(T, tamaBase({ expr: f < 1290 ? 'smile' : 'neutral', cap: 1, wag: 0.35, earsUp: 0.85 }), TAMA_POS, { tint, s: ts }));
      break;
    }
    case 'forever': {
      // she is gone; her post stands empty under the lamp (cap prop is 3D, in main.js)
      break;
    }
    case 'nitama': {
      if (f < 1545) { // Nitama arrives from the office side, cap already on — the new master
        const wx = lerp(-2.4, 0.4, clamp((f - 1484) / 55, 0, 1));
        const bob = Math.abs(Math.sin(f * 0.35)) * 0.035;
        out.push(RN2(T, { expr: 'neutral', wag: 0.4, wagPh: f / 30 }, [wx, 0.55 + bob, -0.9], { tint, s: ts }));
      } else {
        out.push(RN2(T, { view: 'front', expr: 'smile', blink: blinkAt(f, 13), wag: 0.6, wagPh: f / 30 }, TAMA_POS, { tint, s: ts }));
      }
      break;
    }
  }
  return out;
};
export const fxAt = (f, T) => [];
