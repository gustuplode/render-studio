// "THE NAZI GOLD TRAIN — THE TREASURE THAT VANISHED" — every position, camera move
// and event is a pure function of the frame number, computed from the voice timing.
// One continuous valley: rail line running west->east into a mountain tunnel mouth;
// a castle on the mountain; a cutaway diorama on the mountain's south face; a flooded
// adit + dollhouse cottage in the south ridge; an underground cavern (borehole set)
// below the valley holding the dark train shape. Legend vs fact stays in the wording.
import { clamp, lerp, ramp, kf, kf3, M } from './motion.js';

// rows: [section, startFrame, endFrame] — patched by patch_timing.mjs from the voice.
export const TIMING = [
  ["hook", 0, 131],
  ["cargo", 143, 237],
  ["castle", 250, 368],
  ["seal", 380, 490],
  ["hunters", 502, 634],
  ["whisper", 646, 764],
  ["radar", 776, 932],
  ["borehole", 944, 1037],
  ["shape", 1049, 1161],
  ["glint", 1173, 1284],
  ["waiting", 1296, 1433],
  ["finale", 1445, 1581],
];
export const TOTAL = 1581, FPS = 30;
const SEC = {}; TIMING.forEach(([id, a], i) => { SEC[id] = [a, i + 1 < TIMING.length ? TIMING[i + 1][1] : TOTAL]; }); // contiguous
export const SECTION = SEC;
export function secAt(f) { for (const [id, [a, b]] of Object.entries(SEC)) if (f >= a && f < b) return id; return 'finale'; }
export function secProg(f) { const [a, b] = SEC[secAt(f)]; return clamp((f - a) / Math.max(1, b - a), 0, 1); }
const secU = (id, f) => { const [a, b] = SEC[id]; return clamp((f - a) / Math.max(1, b - a), 0, 1); };
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const h1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- world layout
export const MOUTH_X = 20;                 // tunnel mouth plane (mountain west face)
export const RAIL_Z = 0;
export const SIDING_FRONT = -34;           // loco front x while loading
export const CAV = { x: 52, z: 78 };       // borehole shaft axis (surface)
export const CAVERN_Y = -40;               // cavern floor
export const SHAPE_X = -38;                // dark shape loco front (underground, nose west)
export const SHAPE_Z = 66;                 // dark shape rail line (cavern, north of the pod)
export const ADIT = { x: -12, z: 138 };    // flooded adit mouth in the south ridge
export const COTTAGE = { x: -92, z: 118 }; // dollhouse cottage (old man's home)

// ---------------------------------------------------------------- the train
// units: 0 = loco, 1 = tender, 2..11 = wagons. Front offsets behind the loco front.
export const TRAIN_UNITS = 12;
const UNIT_LEN = [10, 5, 6.2, 6.2, 6.2, 6.2, 6.2, 6.2, 6.2, 6.2, 6.2, 6.2];
export const TRAIN_LEN = UNIT_LEN.reduce((a, b) => a + b, 0); // 79.2
export function unitBack(i) { let s = 0; for (let k = 0; k <= i; k++) s += UNIT_LEN[k]; return s; } // distance from front to unit i's rear
export function trainFrontAt(f) {
  const sec = secAt(f);
  if (sec === 'hook') { const u = secU('hook', f); return lerp(-225, -40, M.easeOut(u)); }
  if (sec === 'cargo') { const u = secU('cargo', f); return lerp(-40, SIDING_FRONT, sstep(0, 0.18, u)); }
  if (sec === 'castle') { const u = secU('castle', f); return lerp(SIDING_FRONT, 2, M.easeInOut(u)); }
  if (sec === 'seal') { const u = secU('seal', f); return u < 0.6 ? lerp(2, 104, M.easeInOut(u / 0.6)) : lerp(104, 112, (u - 0.6) / 0.4); }
  return 112; // inside the mountain from 'hunters' on (the surface train is gone)
}
export const trainVisibleAt = f => ['hook', 'cargo', 'castle', 'seal'].includes(secAt(f));
// speed in m/frame (for chimney smoke + wheel spin)
export function trainSpeedAt(f) { return Math.abs(trainFrontAt(Math.min(f + 1, TOTAL - 1)) - trainFrontAt(f)); }
export const sealStartFrame = () => { // frame the last wagon slips into the dark (tail passes mouth + 4)
  const S = SEC.seal; for (let f = S[0]; f < S[1]; f++) if (trainFrontAt(f) - TRAIN_LEN >= MOUTH_X + 4) return f; return S[1] - 12;
};
export const sealBoomFrame = () => Math.min(sealStartFrame() + 10, SEC.seal[1] - 4);

// rocks sealing the mouth: 26 rocks; the last 8 fall during the seal beat.
export const ROCK_N = 26;
export function rockAt(i, f) {
  if (i < ROCK_N - 8) { // settled mound: 6 across x 3 high, heaped WEST of the throat slab (x<16.5)
    const col = i % 6, row = Math.floor(i / 6);
    return { p: [13.6 + (row % 2) * 0.9 + h1(i * 3) * 0.6, 0.55 + row * 0.92, -3.9 + col * 1.45 + (row % 2) * 0.6], settled: 1 };
  }
  const k = i - (ROCK_N - 8), f0 = sealStartFrame() + k * 3; // last 8 tumble down onto the mound
  const base = [13.4 + h1(k * 7) * 1.6, 2.7 + (k % 3) * 0.5, -3.2 + k * 0.95];
  const u = clamp((f - f0) / 16, 0, 1), drop = (1 - M.easeIn(u)) * 7;
  return { p: [base[0], base[1] + drop, base[2]], settled: u };
}

// ---------------------------------------------------------------- gold (instanced bars)
export const GOLD_PLATFORM = 220, GOLD_WAGON = 60, GOLD_N = GOLD_PLATFORM + GOLD_WAGON;
export function goldBarAt(i) { // deterministic layout: platform pile (rows) + open-wagon pile
  if (i < GOLD_PLATFORM) {
    const per = 44, layer = Math.floor(i / per), k = i % per;
    const row = Math.floor(k / 11), col = k % 11;
    return { p: [-52 + col * 0.42, 0.85 + layer * 0.11, 6.2 + row * 0.24], ry: (k % 2) * 0.06 - 0.03, on: 'platform' };
  }
  const j = i - GOLD_PLATFORM, layer = Math.floor(j / 20), k = j % 20;
  const row = Math.floor(k / 10), col = k % 10;
  return { p: [-(unitBack(3) - 3.1) + col * 0.42 - 1.9, 1.62 + layer * 0.11, (row - 0.5) * 0.3], ry: 0, on: 'wagon' }; // x relative to train front
}

// ---------------------------------------------------------------- diorama (mountain south face, z = +30 plane)
// three tunnel levels drawn on the face; a mini train slides along level 2 (middle).
export const DIA_LEVELS = [14, 30, 46]; // y of each tunnel slot base
export function diaTrainAt(f) { // x of the mini train inside the middle slot (world x), slides in during 'castle'
  const u = secU('castle', f);
  if (secAt(f) === 'hook' || secAt(f) === 'cargo') return 40;
  return lerp(40, 150, sstep(0.15, 0.85, u));
}
export const diaGlowAt = f => { const sec = secAt(f); return (sec === 'castle') ? 0.5 + 0.5 * Math.sin(f * 0.11) : 0.25; };

// ---------------------------------------------------------------- radar
export const RADAR_POS = [46, 0, 58];
export const radarPingFrames = () => { const R = SEC.radar; return [0.3, 0.55, 0.8].map(u => Math.round(R[0] + (R[1] - R[0]) * u)); };
export const radarSweepAt = f => (secAt(f) === 'radar') ? (f % 90) / 90 : 0; // 3 s sweep cycle

// ---------------------------------------------------------------- underground: pod + shape + glint
export function podAt(f) { // the camera pod on its cable: descends the shaft, then hangs in the cavern
  const sec = secAt(f);
  if (sec === 'borehole') { const u = secU('borehole', f); const y = lerp(6, CAVERN_Y + 9, M.easeInOut(Math.min(1, u * 1.25))); return { p: [CAV.x, y, CAV.z], yaw: Math.PI, on: true }; }
  if (sec === 'shape') { const u = secU('shape', f); return { p: [8 + Math.sin(u * 5.2) * 3.5, CAVERN_Y + 8.5, 84], yaw: Math.PI + Math.sin(u * 5.2 + 0.6) * 0.9, on: true }; }
  if (sec === 'glint') { const u = secU('glint', f); return { p: [lerp(10, 8, u), CAVERN_Y + 5.5, lerp(76, 74.5, u)], yaw: -2.33 + Math.sin(u * Math.PI * 1.2) * 0.45, on: true }; }
  if (sec === 'waiting') { const u = secU('waiting', f); const y = lerp(CAVERN_Y + 9, 6, M.easeInOut(u)); return { p: [CAV.x, y, CAV.z], yaw: Math.PI, on: true }; }
  return { p: [CAV.x, 6, CAV.z], yaw: Math.PI, on: sec === 'radar' };
}
export const GLINT_PT = [2, CAVERN_Y + 2.6, SHAPE_Z + 2.6]; // the wink point on the shape's side
export const glintFrame = () => { const G = SEC.glint; return Math.round(G[0] + (G[1] - G[0]) * 0.45); };
export const glintPulseAt = f => { // 0..1 brightness of the underground gold wink
  const g = glintFrame(); if (secAt(f) === 'glint') { const d = Math.abs(f - g); return d < 26 ? Math.max(0, 1 - d / 26) * (0.75 + 0.25 * Math.sin(f * 0.9)) : 0.12; }
  return 0;
};
export const finaleWinks = () => { const F = SEC.finale; return [0.42, 0.78].map(u => Math.round(F[0] + (F[1] - F[0]) * u)); };
export const finaleGlintAt = f => { // the wink from the crack in the sealed mouth (surface)
  let v = 0; for (const w of finaleWinks()) { const d = Math.abs(f - w); if (d < 22) v = Math.max(v, (1 - d / 22) * (0.7 + 0.3 * Math.sin(f * 1.1))); }
  return v;
};
export const MOUTH_GLINT_PT = [15.8, 2.3, 3.2];

// ---------------------------------------------------------------- season cycle (hunters: 70 years pass)
// 0 = no snow, 1 = deep winter. Ramps in, holds, thaws out — all inside 'hunters'.
export function seasonAt(f) { if (secAt(f) !== 'hunters') return 0; const u = secU('hunters', f); return sstep(0.12, 0.38, u) * (1 - sstep(0.68, 0.95, u)); }

// ---------------------------------------------------------------- characters (card specs, knights pattern)
// spec: { p:[x,y,z], ry, expr, R, L } — main.js owns one Card per key.
const ENG_CAB = f => [trainFrontAt(f) - 7.6, 2.05, 1.8];
export function charsAt(f) {
  const sec = secAt(f), out = { engineer: null, worker: null, worker2: null, oldman: null, hunter: null, hunter2: null, scientist: null, diver: null };
  const ss = sealStartFrame();
  // v4 FIX A: NO free engineer card in the hook — the driver is a bust painted
  // INTO the cab side window by main.js (he is inside the cab, occluded/framed
  // by it). The free card only exists once he steps down at the stop (cargo).
  if (sec === 'cargo') {
    const u = secU('cargo', f);
    // v4 FIX B (utarna): the train stops at f162 (trainStop); the engineer is
    // in the cab (bust) until that moment, crossfades to the card on the cab
    // step, then visibly STEPS DOWN: cab step -> lower step -> ground -> up
    // onto the platform -> his stance. 30 frames, no teleport. (Round-2: the
    // descent starts exactly at the stop so it stays inside the cargo camera's
    // view — the first attempt at f166-196 drifted out of frame.)
    if (f >= 162) {
      const AL = [[162, [-41.6, 1.57, 1.62]], [169, [-41.6, 1.03, 1.98]], [176, [-41.4, 0.05, 3.1]], [184, [-42.2, 0.8, 5.4]], [192, [-43.5, 0.8, 8.8]]];
      if (f < 192) {
        let p = AL[AL.length - 1][1];
        for (let i = 0; i < AL.length - 1; i++) if (f >= AL[i][0] && f <= AL[i + 1][0]) { const w = sstep(AL[i][0], AL[i + 1][0], f); p = [lerp(AL[i][1][0], AL[i + 1][1][0], w), lerp(AL[i][1][1], AL[i + 1][1][1], w), lerp(AL[i][1][2], AL[i + 1][1][2], w)]; break; }
        const bobA = Math.abs(Math.sin(f * 0.55)) * 0.05;
        out.engineer = { p: [p[0], p[1] + bobA, p[2]], ry: 2.6, expr: 'stern', R: 'point', L: 'hip', nb: f < 176 ? 1 : 0 };
      } else out.engineer = { p: [-43.5, 0.8, 8.8], ry: 2.6, expr: 'stern', R: 'point', L: 'hip' };
    }
    // carry loop: workers walk the platform hauling gold bars, bobbing under the load
    const ph = (u * 2.2) % 2, tri = ph < 1 ? ph : 2 - ph, loaded = ph < 1;
    const bob = Math.abs(Math.sin(f * 0.55)) * 0.07;
    out.worker = { p: [lerp(-57, -41, tri), 0.8 + bob, 9.4], ry: 2.9, expr: loaded ? 'grin' : 'neutral', R: 'up', L: 'up' };
    const ph2 = (u * 2.2 + 1) % 2, tri2 = ph2 < 1 ? ph2 : 2 - ph2, loaded2 = ph2 < 1;
    const bob2 = Math.abs(Math.sin(f * 0.55 + 2.1)) * 0.07;
    out.worker2 = { p: [lerp(-57, -41, tri2), 0.8 + bob2, 10.6], ry: 2.9, expr: loaded2 ? 'stern' : 'smile', R: 'up', L: 'up' };
  }
  if (sec === 'castle') {
    if (f < 258) { // v4 linger: platform trio fades OUT here (camera still looks
      // back at the platform), then fades IN at the valley spots from f258
      out.engineer = { p: [-43.5, 0.8, 8.8], ry: 2.6, expr: 'stern', R: 'point', L: 'hip' };
      out.worker = { p: [-53.8, 0.85, 9.4], ry: 2.9, expr: 'grin', R: 'up', L: 'up' };
      out.worker2 = { p: [-44.2, 0.85, 10.6], ry: 2.9, expr: 'stern', R: 'up', L: 'up' };
    } else {
      out.engineer = { p: [10, 0, 10], ry: -2.4, expr: 'smile', R: 'hang', L: 'hang' };
      out.worker = { p: [13.5, 0, 12.5], ry: -2.8, expr: 'neutral', R: 'hip', L: 'hang' };
    }
  }
  if (sec === 'seal') {
    const back = 2.5 * sstep(ss, ss + 10, f); // v4: was an instant 2.5 m teleport at sealStart — now a startled step-back over 10 frames
    out.engineer = { p: [10 - back, 0, 10 + back * 0.4], ry: -2.2, expr: f > ss ? 'shock' : 'stern', R: f > ss ? 'up' : 'point', L: 'hang' };
    out.worker = { p: [13.5 - back, 0, 12.5 + back * 0.4], ry: -2.6, expr: f > ss ? 'shock' : 'neutral', R: 'hang', L: 'hang' };
  }
  if (sec === 'hunters') {
    const u = secU('hunters', f);
    if (f < 510) { // v4 linger: the 1945 pair fades out at the sealed mouth
      out.engineer = { p: [7.5, 0, 11], ry: -2.2, expr: 'relief', R: 'hang', L: 'hang' };
      out.worker = { p: [11, 0, 13.5], ry: -2.6, expr: 'relief', R: 'hang', L: 'hang' };
    }
    out.hunter = { p: [2, 0, 27], ry: 0.4, expr: u > 0.8 ? 'smile' : 'stern', R: 'point', L: 'hip' };
    out.hunter2 = { p: [-1.5, 0, 29.5], ry: 0.9, expr: 'neutral', R: 'hip', L: 'hang' };
  }
  if (sec === 'whisper') {
    const u = secU('whisper', f);
    if (f < 654) { // v4 linger: hunters fade out at the map table as the camera leaves
      out.hunter = { p: [2, 0, 27], ry: 0.4, expr: 'smile', R: 'point', L: 'hip' };
      out.hunter2 = { p: [-1.5, 0, 29.5], ry: 0.9, expr: 'neutral', R: 'hip', L: 'hang' };
    }
    if (u < 0.48) out.diver = { p: [ADIT.x + 2, -1.15, ADIT.z + 18], ry: 2.6, expr: 'stern', R: 'point', L: 'hang', nb: 1 };
    else {
      if (f < 717) out.diver = { p: [ADIT.x + 2, -1.15, ADIT.z + 18], ry: 2.6, expr: 'stern', R: 'point', L: 'hang', nb: 1 }; // v4 linger fade-out inside the adit
      // v4 FIX C: old man SITS on the cottage chair — feet on the floor (top
      // y=0.3), seat top (~1.23) at his hip line, chair back behind him; he was
      // sunk to y=-0.38 behind the blanket box (a head behind a box).
      out.oldman = { p: [COTTAGE.x, 0.3, COTTAGE.z + 1.0], ry: 0.5, expr: 'smile', R: 'hang', L: 'hang' };
      out.hunter = { p: [COTTAGE.x + 2.2, 0.3, COTTAGE.z + 1.2], ry: 2.2, expr: u > 0.78 ? 'shock' : 'neutral', R: 'hip', L: 'hang' }; // v4: feet ON the cottage floor (was sunk 0.3)
    }
  }
  if (sec === 'radar') {
    const ping = radarPingFrames().some(p => Math.abs(f - p) < 14);
    if (f < 784) { // v4 linger: cottage pair fades out (camera is still at the cottage)
      out.oldman = { p: [COTTAGE.x, 0.3, COTTAGE.z + 1.0], ry: 0.5, expr: 'smile', R: 'hang', L: 'hang' };
      out.hunter = { p: [COTTAGE.x + 2.2, 0.3, COTTAGE.z + 1.2], ry: 2.2, expr: 'neutral', R: 'hip', L: 'hang' };
    } else {
      out.hunter = { p: [RADAR_POS[0] + 3.4, 0, RADAR_POS[2] + 3], ry: -2.6, expr: ping ? 'grin' : 'stern', R: 'hip', L: 'hang' };
    }
    out.scientist = { p: [RADAR_POS[0] - 2.5, 0, RADAR_POS[2] + 2], ry: 2.4, expr: ping ? 'shock' : 'smile', R: 'point', L: 'hang' };
  }
  if (sec === 'borehole') {
    if (f < 952) { // v4 linger: radar pair fades out behind the turning camera
      out.scientist = { p: [RADAR_POS[0] - 2.5, 0, RADAR_POS[2] + 2], ry: 2.4, expr: 'smile', R: 'point', L: 'hang' };
      out.hunter = { p: [RADAR_POS[0] + 3.4, 0, RADAR_POS[2] + 3], ry: -2.6, expr: 'stern', R: 'hip', L: 'hang' };
    } else {
      out.scientist = { p: [CAV.x - 6.5, 0, CAV.z + 9], ry: 2.2, expr: 'stern', R: 'point', L: 'hang' };
      out.hunter = { p: [CAV.x + 5.5, 0, CAV.z + 10], ry: -2.4, expr: 'neutral', R: 'hip', L: 'hang' };
    }
  }
  if (sec === 'shape') {
    if (f < 1057) { // v4 linger: surface pair fades out (camera is underground — occluded anyway)
      out.scientist = { p: [CAV.x - 6.5, 0, CAV.z + 9], ry: 2.2, expr: 'stern', R: 'point', L: 'hang' };
      out.hunter = { p: [CAV.x + 5.5, 0, CAV.z + 10], ry: -2.4, expr: 'neutral', R: 'hip', L: 'hang' };
    }
  }
  if (sec === 'waiting') {
    out.hunter = { p: [6, 0, 14], ry: -0.5, expr: 'smile', R: 'hang', L: 'hang' };
    out.scientist = { p: [9.5, 0, 16.5], ry: -0.9, expr: 'neutral', R: 'hip', L: 'hang' };
  }
  if (sec === 'finale') {
    // v4: the waiting pair WALKS the last ~3 m to their finale spots (no teleport)
    const w = sstep(1445, 1470, f);
    out.hunter = { p: [lerp(6, 4, w), 0, lerp(14, 16, w)], ry: -0.4, expr: 'smile', R: 'hang', L: 'hang' };
    out.scientist = { p: [lerp(9.5, 7.5, w), 0, lerp(16.5, 18.5, w)], ry: -0.8, expr: 'smile', R: 'hang', L: 'hang' };
  }
  return out;
}

// ---------------------------------------------------------------- v4 fade audit
// EVERY character join/leave in the film is covered by exactly one of: a physical
// move (alighting path, finale walk, seal step-back), a 6–10 frame opacity fade
// (the windows below, applied by main.js via charFadeAt), or an occluder pass
// (shape-section leaves happen under the cavern ceiling). charsAt() keeps a
// lingering spec alive through every fade-out window. Pure function of frame.
const FADE_KEYS = {
  engineer: [[162, 0], [167, 1], [501, 1], [510, 0]],
  worker: [[143, 0], [151, 1], [250, 1], [257, 0], [258, 0], [266, 1], [501, 1], [510, 0]],
  worker2: [[143, 0], [151, 1], [250, 1], [258, 0]],
  hunter: [[502, 0], [510, 1], [646, 1], [654, 0], [709, 0], [717, 1], [776, 1], [784, 0], [792, 1], [944, 1], [952, 0], [960, 1], [1049, 1], [1057, 0], [1296, 0], [1304, 1]],
  hunter2: [[502, 0], [510, 1], [646, 1], [654, 0]],
  scientist: [[776, 0], [784, 1], [944, 1], [952, 0], [960, 1], [1049, 1], [1057, 0], [1296, 0], [1304, 1]],
  oldman: [[709, 0], [717, 1], [776, 1], [784, 0]],
  diver: [[646, 0], [654, 1], [709, 1], [717, 0]],
};
export function charFadeAt(id, f) {
  const K = FADE_KEYS[id]; if (!K) return 1;
  if (f <= K[0][0]) return K[0][1];
  for (let i = 0; i < K.length - 1; i++) {
    if (f <= K[i + 1][0]) { const w = sstep(K[i][0], K[i + 1][0], f); return lerp(K[i][1], K[i + 1][1], w); }
  }
  return K[K.length - 1][1];
}

// ---------------------------------------------------------------- environment (frame-keyed, knights pattern)
const ENV_KEYS = [
  [0.00, { sky: '#0d1526', hor: '#33415e', fog: '#141e30', fogFar: 330, sun: '#bcd2ff', sunEl: 38, sunI: 0.55, amb: 0.34, hemi: 0.3, exp: 1.02, cloud: '#2c3a58', sunAz: -50 }],
  [0.26, { sky: '#0e1830', hor: '#3a4a68', fog: '#182236', fogFar: 360, sun: '#c4d6ff', sunEl: 34, sunI: 0.6, amb: 0.36, hemi: 0.32, exp: 1.02, cloud: '#33415e', sunAz: -46 }],
  [0.36, { sky: '#46536e', hor: '#c8a37e', fog: '#4c5468', fogFar: 420, sun: '#ffb37a', sunEl: 7, sunI: 1.25, amb: 0.42, hemi: 0.4, exp: 1.03, cloud: '#8a7f72', sunAz: -30 }],
  [0.44, { sky: '#6fa8d8', hor: '#dceef5', fog: '#c3d5de', fogFar: 640, sun: '#fff1d6', sunEl: 42, sunI: 2.6, amb: 0.55, hemi: 0.65, exp: 1.05, cloud: '#ffffff', sunAz: 40 }],
  [0.60, { sky: '#6fa8d8', hor: '#dceef5', fog: '#c3d5de', fogFar: 640, sun: '#fff1d6', sunEl: 46, sunI: 2.6, amb: 0.55, hemi: 0.65, exp: 1.05, cloud: '#ffffff', sunAz: 44 }],
  [0.68, { sky: '#5d84ae', hor: '#b9cdd6', fog: '#93a7b4', fogFar: 520, sun: '#ffe9bb', sunEl: 30, sunI: 2.0, amb: 0.48, hemi: 0.52, exp: 1.03, cloud: '#e8eef0', sunAz: 30 }],
  [0.74, { sky: '#1c2739', hor: '#39445c', fog: '#131a28', fogFar: 300, sun: '#aebedd', sunEl: 20, sunI: 0.5, amb: 0.2, hemi: 0.16, exp: 1.0, cloud: '#2c3648', sunAz: 0 }],
  [0.86, { sky: '#1c2739', hor: '#39445c', fog: '#131a28', fogFar: 300, sun: '#aebedd', sunEl: 20, sunI: 0.5, amb: 0.2, hemi: 0.16, exp: 1.0, cloud: '#2c3648', sunAz: 0 }],
  [0.92, { sky: '#3a4470', hor: '#e8875a', fog: '#57455a', fogFar: 430, sun: '#ff9440', sunEl: 4, sunI: 1.15, amb: 0.38, hemi: 0.35, exp: 1.0, cloud: '#8a6a72', sunAz: -52 }],
  [1.01, { sky: '#232c52', hor: '#c96f4a', fog: '#453a52', fogFar: 400, sun: '#ff7a30', sunEl: 2, sunI: 0.85, amb: 0.32, hemi: 0.3, exp: 0.99, cloud: '#6f5a72', sunAz: -58 }],
];
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function lc(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
export function envAt(f) {
  const u = f / TOTAL;
  let a = ENV_KEYS[0], b = ENV_KEYS[ENV_KEYS.length - 1];
  for (let i = 0; i < ENV_KEYS.length - 1; i++) if (u >= ENV_KEYS[i][0] && u <= ENV_KEYS[i + 1][0]) { a = ENV_KEYS[i]; b = ENV_KEYS[i + 1]; break; }
  const t = clamp((u - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1), o = {};
  for (const k of Object.keys(a[1])) {
    const va = a[1][k], vb = b[1][k];
    o[k] = typeof va === 'number' ? lerp(va, vb, t) : (typeof va === 'string' && va.startsWith('#')) ? lc(va, vb, t) : va;
  }
  return o;
}

// ---------------------------------------------------------------- board (stat cards)
export function boardAt(f) {
  const sec = secAt(f);
  const B = (text, u0, u1, y = 6.4) => { const u = secU(sec, f); return (u >= u0 && u <= u1) ? { text, y, s: Math.min(ramp(u, u0, u0 + 0.1), 1 - ramp(u, u1 - 0.06, u1)) } : null; };
  switch (sec) {
    case 'hook': return B('POLAND, 1945', 0.06, 0.96, 7.2);
    case 'cargo': return B('300 TONS OF GOLD?', 0.08, 0.95);
    case 'castle': return B('A MAZE OF TUNNELS', 0.08, 0.95);
    case 'seal': return B('SEALED WITH ROCK', 0.55, 0.99);
    case 'hunters': return B('70 YEARS OF HUNTING', 0.08, 0.95);
    case 'whisper': { const u = secU(sec, f); return u >= 0.5 ? B('ONE MAN KNEW', 0.56, 0.97) : null; }
    case 'radar': return B('A TRAIN UNDERGROUND?!', 0.3, 0.97);
    case 'borehole': return B('100 FEET DOWN', 0.06, 0.6);
    case 'glint': return B('THE COLOR OF GOLD', 0.4, 0.97);
    case 'waiting': return B('NOT OPENED. NOT YET.', 0.1, 0.95);
    case 'finale': return B('STILL BURIED. STILL WAITING.', 0.12, 0.99, 7);
    default: return null;
  }
}

// ---------------------------------------------------------------- camera (CAMSEGS + cross-blend, knights pattern)
const CAMSEGS = [
  { sec: 'hook', pts: [[0, [-120, 2, 9]], [0.45, [-74, 2.1, 9]], [0.8, [-40, 2.8, 13]], [1, [-32, 4.2, 20]]], look: [[0, [-160, 3, 0]], [0.45, [-98, 2.8, 0]], [0.8, [-54, 2.4, 2]], [1, [-42, 2, 4]]] },
  { sec: 'cargo', pts: [[0, [-32, 4.2, 20]], [0.45, [-38, 2.7, 16.8]], [1, [-45.2, 2.3, 13.2]]], look: [[0, [-42, 2, 4]], [0.45, [-44.2, 1.2, 6.6]], [1, [-45.6, 1.3, 7.2]]] },
  { sec: 'castle', pts: [[0, [-45.2, 2.3, 13.2]], [0.28, [0, 10, 40]], [0.6, [55, 20, 62]], [1, [100, 26, 58]]], look: [[0, [-45.6, 1.3, 7.2]], [0.28, [40, 18, 31]], [0.6, [95, 26, 31]], [1, [140, 30, 31]]] },
  { sec: 'seal', pts: [[0, [100, 26, 58]], [0.25, [30, 10, 52]], [0.5, [-6, 6, 30]], [0.75, [-2, 4.5, 20]], [1, [2, 3.4, 17]]], look: [[0, [140, 30, 31]], [0.25, [10, 5, 10]], [0.5, [17, 4, 0]], [0.75, [17.5, 3.6, 0]], [1, [17, 3.5, 0]]] },
  { sec: 'hunters', pts: [[0, [2, 3.4, 17]], [0.4, [1.2, 1.9, 31]], [0.7, [3.5, 2.6, 33]], [1, [8, 3.2, 31]]], look: [[0, [17, 3.5, 0]], [0.4, [2, 1.05, 25.8]], [0.7, [2, 1.1, 25.5]], [1, [4, 1.2, 24]]] },
  { sec: 'whisper', pts: [[0, [8, 3.2, 31]], [0.1, [-2, 3.2, 58]], [0.2, [-8, 2.4, 98]], [0.3, [-11, 2.7, 124]], [0.42, [-11.8, 2.3, 144.5]], [0.52, [-13, 1.4, 130]], [0.62, [-50, 2.4, 106]], [0.78, [-88.5, 1.7, 111.5]], [1, [-90.8, 1.5, 113.8]]], look: [[0, [4, 1.2, 24]], [0.1, [-6, 1.2, 76]], [0.2, [-11, 1.2, 126]], [0.3, [-11, 1.8, 150]], [0.42, [-10.5, 0.8, 156]], [0.52, [-38, 1, 114]], [0.62, [-76, 1, 115]], [0.78, [-92, 1, 118]], [1, [-92, 1, 118.3]]] },
  { sec: 'radar', pts: [[0, [-90.8, 1.5, 113.8]], [0.22, [-6, 3.2, 86]], [0.45, [24, 2.6, 74]], [0.7, [38.5, 2.2, 67.5]], [1, [44.8, 1.9, 65.2]]], look: [[0, [-92, 1, 118.3]], [0.22, [30, 1.6, 58]], [0.45, [45, 1.5, 56.5]], [0.7, [46.2, 1.55, 56.3]], [1, [46.3, 1.5, 56.5]]] },
  { sec: 'borehole', pts: [[0, [44.8, 1.9, 65.2]], [0.16, [49, 2.6, 71]], [0.34, [53.5, 0.2, 74.5]], [0.55, [50.5, -13, 80.5]], [0.78, [47.5, -30, 80]], [1, [40, -33, 77]]], look: [[0, [46.3, 1.5, 56.5]], [0.16, [52, 0.5, 78]], [0.34, [52, -8, 78]], [0.55, [51, -24, 77.5]], [0.78, [26, -36, 68.5]], [1, [0, -37.2, 67]]] },
  { sec: 'shape', pts: [[0, [40, -33, 77]], [0.5, [20, -36.2, 84]], [1, [22, -36, 83]]], look: [[0, [0, -37.2, 67]], [0.5, [-16, -37, 66]], [1, [-10, -37, 66.3]]] },
  { sec: 'glint', pts: [[0, [22, -36, 83]], [0.5, [15, -35.8, 78]], [1, [7.5, -36.5, 72]]], look: [[0, [-10, -37, 66.3]], [0.5, [0, -37.4, 68]], [1, [2, -37.4, 68.6]]] },
  { sec: 'waiting', pts: [[0, [7.5, -36.5, 72]], [0.2, [30, -34, 79]], [0.4, [50, -28, 76.5]], [0.55, [51, -10, 77]], [0.68, [47, 3.2, 73]], [0.82, [16, 3.6, 44]], [1, [9, 3.2, 22]]], look: [[0, [2, -37.4, 68.6]], [0.2, [26, -34, 73]], [0.4, [50, -24, 77.5]], [0.55, [50, -6, 76]], [0.68, [28, 1, 42]], [0.82, [17, 2.2, 10]], [1, [15, 2.2, 3]]] },
  { sec: 'finale', pts: [[0, [9, 3.2, 22]], [0.38, [7.5, 3, 13.5]], [0.62, [-2, 2, 26]], [0.82, [-34, 34, 104]], [1, [-78, 46, 108]]], look: [[0, [15, 2.2, 3]], [0.38, [15.8, 2.3, 3.2]], [0.62, [8, 1.2, 14]], [0.82, [50, 10, 20]], [1, [55, 6, 10]]] },
]
const BK = 9; // cross-blend frames at section joins
function camSegRaw(seg, f) {
  const [a, b] = SEC[seg.sec];
  const u = clamp((f - a) / Math.max(1, b - a), 0, 1);
  return { pos: kf3(seg.pts, u), look: kf3(seg.look, u) };
}
function baseCam(f) {
  const sec = secAt(f);
  if (sec === 'hook') { // low trackside ride, swing into a cab close-up on the engineer, then pull out
    const seg = CAMSEGS[0], u = secU('hook', f), fr = trainFrontAt(f);
    const ride = { pos: [fr + 16, 1.9, 8.5], look: [fr - 4, 2.6, 0] };
    const cab = { pos: [fr - 1.5, 3.1, 7.2], look: [fr - 7.6, 2.9, 1.35] };
    if (u < 0.5) return ride;
    if (u < 0.82) { const v = sstep(0.5, 0.62, u); return { pos: lerp3v(ride.pos, cab.pos, v), look: lerp3v(ride.look, cab.look, v) }; }
    const v = sstep(0.82, 1, u), raw = camSegRaw(seg, f);
    return { pos: lerp3v(cab.pos, raw.pos, v), look: lerp3v(cab.look, raw.look, v) };
  }
  const seg = CAMSEGS.find(s => s.sec === sec);
  return seg ? camSegRaw(seg, f) : { pos: [0, 10, 60], look: [0, 1, 0] };
}
const lerp3v = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export function camAt(f) {
  let { pos, look } = baseCam(f);
  for (const [id, [a]] of Object.entries(SEC)) {
    if (a > 0 && f > a - BK && f < a + BK && f > 0) {
      const u = (f - (a - BK)) / (2 * BK), w = u * u * (3 - 2 * u);
      const prev = baseCam(a - BK), cur = baseCam(a + BK);
      pos = lerp3v(prev.pos, cur.pos, w); look = lerp3v(prev.look, cur.look, w);
      break;
    }
  }
  const ss = sealStartFrame(), shake = (f >= ss && f <= ss + 16) ? 0.12 * (1 - (f - ss) / 16) : 0;
  pos = [pos[0] + Math.sin(f * 0.021) * 0.25, pos[1] + Math.sin(f * 0.017 + 2) * 0.16 + (shake ? Math.sin(f * 9.3) * shake : 0), pos[2] + Math.cos(f * 0.019) * 0.25];
  return { pos, look };
}

export const EVENTS = () => ({
  sealStart: sealStartFrame(), sealBoom: sealBoomFrame(), glint: glintFrame(),
  radarPings: radarPingFrames(), finaleWinks: finaleWinks(),
  descentStart: SEC.borehole[0], trainStop: SEC.cargo[0] + Math.round((SEC.cargo[1] - SEC.cargo[0]) * 0.18),
  sections: Object.fromEntries(Object.entries(SEC).map(([k, v]) => [k, { start: v[0], end: v[1] }])),
});

// ---------------------------------------------------------------- v2 emotion timelines
// Absolute-frame expression keyframes per character: [frame, exprName, morphFrames].
// main.js resolves them with the v2 parametric face (faceP/blendFaceP) — emotions MORPH
// over 5-12 frames, never pop. Keyed to the narration beats of each section.
const _ssF = sealStartFrame(), _pingF = radarPingFrames(), _winkF = finaleWinks();
export const EMOTIONS = {
  engineer: [[0, 'grin'], [250, 'smile', 10], [330, 'determined', 10], [380, 'stern', 8], [_ssF - 2, 'scared', 6], [_ssF + 26, 'shock', 7], [_ssF + 54, 'relief', 12]],
  worker: [[0, 'smile'], [200, 'determined', 9], [240, 'smile', 8], [250, 'neutral', 8], [380, 'neutral', 6], [_ssF - 2, 'scared', 6], [_ssF + 30, 'shock', 7], [_ssF + 58, 'relief', 12]],
  worker2: [[0, 'neutral'], [160, 'smile', 9], [250, 'neutral', 8], [380, 'neutral', 6], [_ssF, 'scared', 6], [_ssF + 34, 'shock', 7], [_ssF + 62, 'relief', 12]],
  hunter: [[502, 'stern'], [560, 'thinking', 10], [612, 'confused', 9], [626, 'smile', 10], [700, 'neutral', 8], [742, 'wonder', 8], [752, 'shock', 6], [766, 'relief', 10], [776, 'stern', 8],
    [_pingF[0] - 2, 'grin', 6], [_pingF[0] + 16, 'stern', 9], [_pingF[1] - 2, 'grin', 6], [_pingF[1] + 16, 'stern', 9], [_pingF[2] - 2, 'grin', 6], [_pingF[2] + 16, 'smile', 10],
    [944, 'neutral', 8], [990, 'wonder', 10], [1296, 'smile', 8], [1332, 'sad', 12], [1402, 'thinking', 10], [1436, 'smile', 9], [1445, 'smile', 6],
    [_winkF[0] - 2, 'wonder', 6], [_winkF[0] + 10, 'shock', 6], [_winkF[0] + 22, 'grin', 10], [_winkF[1] - 2, 'wonder', 6], [_winkF[1] + 16, 'smile', 10]],
  scientist: [[776, 'smile'], [800, 'thinking', 10],
    [_pingF[0] - 2, 'shock', 5], [_pingF[0] + 14, 'wonder', 8], [_pingF[1] - 2, 'shock', 5], [_pingF[1] + 14, 'wonder', 8], [_pingF[2] - 2, 'shock', 5], [_pingF[2] + 14, 'grin', 9],
    [944, 'stern', 8], [985, 'determined', 9], [1296, 'neutral', 8], [1362, 'sleepy', 12], [1422, 'smile', 10], [1445, 'smile', 6], [_winkF[0] - 2, 'wonder', 7], [_winkF[0] + 16, 'smile', 9]],
  oldman: [[646, 'smile'], [724, 'thinking', 10], [742, 'stern', 8], [762, 'smile', 10]],
  diver: [[646, 'stern'], [668, 'scared', 9], [702, 'determined', 8]],
  hunter2: [[502, 'neutral'], [575, 'sleepy', 11], [622, 'smile', 10]],
};
// v2 pupil look-at targets per character per section: [lookX, lookY] in -1..1
// (what the voice/action names is what the eyes track). main.js damps toward these.
export function lookAt2(id, f) {
  const sec = secAt(f);
  switch (id) {
    case 'engineer':
      if (sec === 'hook') return [0.35, 0.15];
      if (sec === 'cargo') return [-0.5, 0.3];
      if (sec === 'castle') return [0.4, -0.2];
      return [0.6, 0.1]; // seal: eyes on the tunnel mouth
    case 'worker': case 'worker2':
      if (sec === 'cargo') return [0.3, 0.55]; // down at the gold bar in his hands
      if (sec === 'castle') return [0.5, -0.1];
      return [0.7, 0.1];
    case 'hunter':
      if (sec === 'hunters') return [0.1, 0.4]; // down at the map
      if (sec === 'whisper') return [-0.7, 0.05]; // at the old man
      if (sec === 'radar') return [0.6, 0.1];
      if (sec === 'borehole') return [0.2, 0.5]; // down the shaft
      if (sec === 'waiting' || sec === 'finale') return [0.5, 0.0]; // at the sealed mouth
      return [0.2, 0.1];
    case 'scientist':
      if (sec === 'radar') return [-0.7, 0.15]; // at the radar screen
      if (sec === 'borehole') return [-0.3, 0.5];
      return [0.4, 0.0];
    case 'oldman': return [0.7, 0.05]; // at the hunter, telling the secret
    case 'diver': return [0.3, -0.05]; // ahead into the dark tunnel
    case 'hunter2': return [0.2, 0.3];
    default: return [0, 0.1];
  }
}
