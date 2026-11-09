// "The First 60 Seconds of an Atomic Blast" — coded 9:16 science Short.
// ABSTRACT PHYSICS ONLY: an empty stylised city grid + a desert-test sky. No people,
// no suffering — flash, fireball, shockwave, cloud and black rain carry the science.
// The star of the film is a GIANT ON-SCREEN SECOND COUNTER (a screen-pinned card in
// fxAt) that ticks NON-LINEARLY with the narration: 0 held through the flash, 1->10
// across the shockwave, 10->30 as the cloud forms, 30->60 through the black rain.
//
// STRUCTURE RULE: every timing flows from the ONE TIMING table below (shot fractions
// via the K()/CK() helpers). The parent patches TIMING when the real voice lands.
import { M, camFromKeys, q, clamp, lerp, lerp3, ramp, kf, kf3 } from './motion.js';

export const FPS = 30;
// ---------- THE timing table: [shotId, startFrame, endFrame] ----------
export const TIMING = [
  ['hook', 0, 163],
  ['flash', 163, 294],
  ['fireball', 294, 570],
  ['mushroom', 570, 786],
  ['rain', 786, 1007],
  ['close', 1007, 1266],
];
export const TOTAL = TIMING[TIMING.length - 1][2]; // 1560 frames = 52.0 s @ 30 fps
const SEG = {}; TIMING.forEach(([id, a, b]) => { SEG[id] = { id, a, b, len: b - a }; });
const LIGHT_OF = { hook: 'void', flash: 'bright', fireball: 'hot', mushroom: 'ashhot', rain: 'storm', close: 'ashdawn' };
export const SHOTS = TIMING.map(([id, a, b]) => ({ id, a, b, light: LIGHT_OF[id] }));
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const ph = (id, f) => clamp((f - SEG[id].a) / SEG[id].len);   // phase 0..1 inside a shot
const smooth = M.smooth;
const K = (id, rows) => rows.map(([u, v, e, via]) => [Math.round(SEG[id].a + u * SEG[id].len), v, e, via]);
const CK = (id, rows) => rows.map(([u, pos, look, fov, ease, roll]) => ({ f: Math.round(SEG[id].a + u * SEG[id].len), pos, look, fov, ease, roll }));

// ---------- lights: void black -> white-bright -> hot -> cooling ash -> storm -> quiet dawn ----------
const WATER = { waterDeep: '#2c5a78', waterShal: '#7ab0c4', glint: '#ffe9c4' };
export const LIGHTS = {
  void: { az: 110, el: 8, sky: '#0a0a10', ground: '#0c0c0e', hemi: 0.14, sun: '#2a2c38', sunI: 0.15, fog: '#060608', fogNear: 30, fogFar: 160,
    skyTop: '#05050a', skyHor: '#0d0d14', sunDisc: '#000000', sunSize: 0, sat: 0.7, vig: 0.4, shadowExt: 36, waterDeep: '#0a141c', waterShal: '#14242e', glint: '#3a3f46' },
  bright: { az: 120, el: 42, sky: '#f2f0ea', ground: '#8a8478', hemi: 1.3, sun: '#ffffff', sunI: 3.4, fog: '#e8e4da', fogNear: 45, fogFar: 330,
    skyTop: '#a8bcda', skyHor: '#f6efdd', sunDisc: '#ffffff', sunSize: 0.007, sat: 1.03, vig: 0.2, shadowExt: 36, ...WATER },
  hot: { az: 118, el: 36, sky: '#eee4d2', ground: '#7e7568', hemi: 1.2, sun: '#ffe8c8', sunI: 3.0, fog: '#ddd2bc', fogNear: 40, fogFar: 300,
    skyTop: '#7d90b4', skyHor: '#f2ddba', sunDisc: '#fff3d0', sunSize: 0.005, sat: 1.05, vig: 0.22, shadowExt: 36, ...WATER },
  ashhot: { az: 118, el: 27, sky: '#b09a86', ground: '#5d554a', hemi: 1.0, sun: '#e8c9a0', sunI: 1.8, fog: '#a2937f', fogNear: 28, fogFar: 230,
    skyTop: '#5f564e', skyHor: '#c4ab90', sat: 0.88, vig: 0.3, shadowExt: 36, waterDeep: '#3c4a52', waterShal: '#5c6a70', glint: '#cfc4ae' },
  storm: { az: 116, el: 20, sky: '#8a8078', ground: '#463f38', hemi: 0.85, sun: '#d3c3ab', sunI: 1.2, fog: '#7e766c', fogNear: 20, fogFar: 190,
    skyTop: '#4c463f', skyHor: '#9a8d7c', sat: 0.78, vig: 0.36, shadowExt: 36, waterDeep: '#333e44', waterShal: '#4e5a60', glint: '#b8ac96' },
  ashdawn: { az: 106, el: 10, sky: '#cbb9a4', ground: '#5d564c', hemi: 0.95, sun: '#ffdcb0', sunI: 1.9, fog: '#cdbfae', fogNear: 42, fogFar: 320,
    skyTop: '#6a7488', skyHor: '#ecd2ac', sunDisc: '#ffe9c0', sunSize: 0.0035, sat: 0.94, vig: 0.27, shadowExt: 36, waterDeep: '#44545e', waterShal: '#6d7f88', glint: '#e8d9bc' },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---------- shared stage geometry (== main.js world build) ----------
export const CENTRE = [0, 0, -2];            // city centre, under the burst
export const BURST = [0, 15, -2];             // the detonation point in the air
export const SUNS_POS = [-15.5, 5.2, -16];   // "BRIGHTER THAN A THOUSAND SUNS"
export const TEMP_POS = [13.5, 4.6, -16];     // "HOTTER THAN THE SUN ITSELF" (temperature card)
export const SOUND_POS = [16.0, 5.5, -6];     // "FASTER THAN SOUND" — beside the ring's path
export const PLANES_POS = [-19.0, 8.0, -2];   // "HIGHER THAN PLANES FLY" — west flank, clear of the stem
export const FIRE_POS = [-13.5, 4.8, -21];    // "THE BLAST IS OVER - THE FIRE IS BEGINNING"
export const CLOSE_POS = [0, 5.4, -27];       // "ALL THAT - IN LESS THAN 60 SECONDS"

// ---------- THE COUNTER: displayed second + pop phase, from the TIMING table ----------
// seconds accrue per shot: hook holds 0, flash earns 1, fireball 9, mushroom 20, rain 30.
const SEC_SPAN = { hook: 0, flash: 1, fireball: 9, mushroom: 20, rain: 30, close: 0 };
const SEC_BASE = {}; { let acc = 0; for (const [id] of TIMING) { SEC_BASE[id] = acc; acc += SEC_SPAN[id]; } }
export const secondFloatAt = (f) => {
  const S = shotAt(f);
  return SEC_BASE[S.id] + SEC_SPAN[S.id] * ph(S.id, f);
};
export const secondAt = (f) => Math.min(60, Math.floor(secondFloatAt(f)));
const PHASE_WORD = { hook: 'IGNITION', flash: 'THE FLASH', fireball: 'THE SHOCKWAVE', mushroom: 'THE CLOUD', rain: 'BLACK RAIN', close: 'SECONDS' };
// scale pop in the first frames after each tick (frames since the tick, from the float)
export const tickPopAt = (f) => {
  const fl = secondFloatAt(f), frac = fl - Math.floor(fl);
  const S = shotAt(f); if (!SEC_SPAN[S.id]) return 0;
  const framesSinceTick = frac * (SEG[S.id].len / SEC_SPAN[S.id]);
  return framesSinceTick < 13 ? Math.exp(-framesSinceTick / 4.2) : 0;
};

// ---------- fireball: born as the hook's point, peaks in flash, cools into the cloud ----------
const fireballAt = (f) => {
  if (f < 26) return null;
  const aIn = ramp(f, 26, 55);
  let s, y = BURST[1], a = aIn, heat = 1;
  if (f < SEG.flash.a) { const t = ramp(f, 30, SEG.flash.a - 4); s = 0.22 + M.easeOut(t) * 1.9; }        // the blooming point
  else if (f < SEG.flash.b) { const t = ph('flash', f); s = t < 0.38 ? lerp(2.1, 10.0, M.easeOut(t / 0.38)) : lerp(10.0, 8.6, (t - 0.38) / 0.62); }
  else if (f < SEG.mushroom.a) { const t = ph('fireball', f); s = lerp(8.6, 7.4, t); y = BURST[1] + t * 2.0; }
  else if (f < SEG.mushroom.a + 150) { const t = ramp(f, SEG.mushroom.a, SEG.mushroom.a + 150); s = lerp(7.4, 3.6, M.easeInOut(t)); y = BURST[1] + 2.0 + t * 1.2; a = aIn * clamp(1 - t * 1.3); heat = 1 - t * 0.85; }
  else return null;
  if (f >= SEG.mushroom.a) heat = Math.min(heat, 1 - ramp(f, SEG.mushroom.a, SEG.rain.a) * 0.88);
  return { p: [BURST[0], y, BURST[2]], s, a, heat };
};
// ---------- mushroom cloud: column starts under the rolling fireball, cap crowns it ----------
const cloudT = (f) => ramp(f, SEG.fireball.a + 150, SEG.rain.a + 90); // 0 before -> 1 early rain
const cloudAt = (f) => {
  if (f < SEG.fireball.a + 150) return null;
  const t = cloudT(f), e = M.easeOut(t);
  return {
    stemH: 15.0 + e * 17.0, stemR: 1.2 + e * 2.3,
    capY: 14.5 + e * 17.0, capR: 2.4 + e * 7.4, capFlat: 0.60 - e * 0.08,
    colT: ramp(f, SEG.mushroom.a + 120, SEG.rain.a + 60),   // hot tan -> ash grey as it cools
    drift: t * 3.4,
    a: f > SEG.close.b - 24 ? Math.max(0.9, 1 - (f - (SEG.close.b - 24)) / 80) : 1,
  };
};
// ---------- shockwave rings: the front races out at the speed of sound ----------
export const ringRadiusAt = (f) => { // the tracked front (0 before it starts)
  if (f < SEG.fireball.a + 14) return 0;
  const t = clamp((f - (SEG.fireball.a + 14)) / (SEG.mushroom.a + 180 - (SEG.fireball.a + 14)));
  return 2 + M.easeOut(t) * 56;
};
const ringAt = (f) => {
  if (f < SEG.fireball.a + 14 || f > SEG.mushroom.a + 220) return null;
  const rings = [];
  for (const [delay, shrink, a0] of [[0, 1, 0.85], [26, 0.93, 0.5]]) {
    const r = ringRadiusAt(f - delay); if (r <= 0) continue;
    const fade = 1 - ramp(f, SEG.mushroom.a + 60, SEG.mushroom.a + 220);
    rings.push({ r: r * shrink, a: a0 * fade * ramp(f, SEG.fireball.a + 14, SEG.fireball.a + 30), dust: clamp(r / 58) });
  }
  return rings.length ? rings : null;
};
// ---------- fires + the firestorm glow they merge into ----------
const FIRES = [];
{ // deterministic scatter over the block grid (seeded LCG, same every run)
  let s = 1234567; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 42; i++) {
    const side = rnd() > 0.5 ? 1 : -1, x = side * (13 + rnd() * 26), z = -36 + rnd() * 72;
    const d = Math.hypot(x - CENTRE[0], z - CENTRE[2]);
    FIRES.push({ p: [x, 0.4 + rnd() * 1.6, z], at: clamp(d / 58, 0.04, 0.95), ph: rnd() * 6.28, s: 0.7 + rnd() * 0.9 });
  }
}
const firesAt = (f) => {
  if (f < SEG.mushroom.a + 20) return [];
  const u = ramp(f, SEG.mushroom.a + 20, SEG.rain.a + 120), inClose = f >= SEG.close.a;
  return FIRES.map((F) => {
    const on = ramp(u, F.at, F.at + 0.06);
    const flick = 0.82 + 0.18 * Math.sin(f * 0.55 + F.ph * 7);
    return { p: F.p, s: F.s * (inClose ? 0.5 : 1) * flick, a: on * (inClose ? 0.3 : 0.8) };
  }).filter((x) => x.a > 0.01);
};
const stormGlowAt = (f) => ramp(f, SEG.mushroom.a + 160, SEG.rain.a + 60) * (f >= SEG.close.a ? lerp(0.55, 0.34, ph('close', f)) : 0.55);
// ---------- black rain: dark streaks cycling down through the cloud's edges ----------
const RAIN_DROPS = [];
{ let s = 987654; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 80; i++) {
    const a = rnd() * Math.PI * 2, r = 4 + rnd() * 24;
    RAIN_DROPS.push({ x: CENTRE[0] + Math.cos(a) * r, z: CENTRE[2] + Math.sin(a) * r * 0.8, cyc: 34 + rnd() * 26, off: rnd(), len: 1.6 + rnd() * 1.8 });
  }
}
const rainAt = (f) => {
  if (f < SEG.rain.a + 30) return [];
  const aIn = ramp(f, SEG.rain.a + 30, SEG.rain.a + 130);
  const thin = 1 - ramp(f, SEG.close.a + 120, SEG.close.b - 60) * 0.55; // the rain eases off at the end
  return RAIN_DROPS.map((D) => {
    const u = (f / D.cyc + D.off) % 1;
    return { p: [D.x, lerp(27, 0.4, u), D.z], len: D.len, a: aIn * thin * (0.35 + 0.65 * Math.sin(u * Math.PI)) };
  }).filter((x) => x.a > 0.02);
};
const cityDarkAt = (f) => ramp(f, SEG.mushroom.a + 90, SEG.rain.a + 200) * 0.85;

// ---------- TRACKING DIRECTOR ----------
const capPos = (f) => { const C = cloudAt(f); return C ? [C.drift, C.capY, CENTRE[2]] : BURST; };
const TRACKDIR = {
  hook: [{ a: SEG.hook.a, b: SEG.hook.b, type: 'object', id: 'burst', pos: () => BURST, w: 0.55 }],
  flash: [{ a: SEG.flash.a, b: SEG.flash.b, type: 'object', id: 'burst', pos: () => BURST, w: 0.8 }],
  fireball: [
    { a: SEG.fireball.a, b: SEG.fireball.a + 105, type: 'object', id: 'burst', pos: () => BURST, w: 0.65 },
    { a: SEG.fireball.a + 105, b: SEG.fireball.b, type: 'object', id: 'ring', w: 0.35,
      pos: (f) => [CENTRE[0] + ringRadiusAt(f) * 0.82, 1.2, CENTRE[2] + ringRadiusAt(f) * 0.3] },
  ],
  mushroom: [{ a: SEG.mushroom.a, b: SEG.mushroom.b, type: 'object', id: 'cap', pos: capPos, w: 0.6 }],
  rain: [{ a: SEG.rain.a, b: SEG.rain.b, type: 'object', id: 'cap', pos: capPos, w: 0.5 }],
  close: [{ a: SEG.close.a, b: SEG.close.b, type: 'subject', id: 'centre', pos: () => [0, 9, -2], w: 0.45 }],
};
const BLEND = 20;
export const dirFor = (id, f) => {
  const segs = TRACKDIR[id];
  let i = segs.findIndex((s) => f <= s.b); if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  let point = seg.pos(f), w = seg.w;
  const pv = segs[i - 1]; // blend IN from the previous segment (symmetric — no whip at the seam)
  if (pv && f < seg.a + BLEND / 2) {
    const t = smooth(ramp(f, seg.a - BLEND / 2, seg.a + BLEND / 2));
    point = lerp3(pv.pos(f), point, t); w = lerp(pv.w, w, t);
  }
  const nx = segs[i + 1];
  if (nx && f >= nx.a - BLEND / 2) {
    const t = smooth(ramp(f, nx.a - BLEND / 2, nx.a + BLEND / 2));
    point = lerp3(point, nx.pos(f), t); w = lerp(w, nx.w, t);
  }
  return { point, w, seg };
};
export const dirAt = (f) => dirFor(shotAt(f).id, f);

// ---------- cameras ----------
const CAMS = {
  hook: CK('hook', [
    [0, [17, 9.5, 31], BURST, 41], [1, [13.5, 8.5, 25.5], BURST, 40],
  ]),
  flash: CK('flash', [
    [0, [13.5, 8.5, 25.5], BURST, 40], [0.45, [16, 10, 29], BURST, 41, 'surge'], [1, [20, 11.5, 34], BURST, 42],
  ]),
  fireball: CK('fireball', [
    [0, [20, 11.5, 34], BURST, 42], [0.5, [24, 16, 44], [4, 9, -2], 42, 'easeInOut'], [1, [29, 18, 50], [8, 7, -2], 42],
  ]),
  mushroom: CK('mushroom', [
    [0, [31, 15.5, 45], [0, 12, -2], 42], [0.55, [33, 20, 50], [0, 14, -2], 43, 'easeInOut'], [1, [35, 23, 53], [0, 15, -2], 43],
  ]),
  rain: CK('rain', [
    [0, [35, 23, 53], [0, 13, -2], 43], [0.5, [31, 20, 49], [0, 11, -2], 42, 'easeInOut'], [1, [27, 17.5, 46], [0, 10, -2], 42],
  ]),
  close: CK('close', [
    [0, [27, 17.5, 46], [0, 10, -2], 42], [0.5, [38, 23, 64], [0, 18, -2], 41, 'easeInOut'], [1, [52, 30, 84], [0, 26, -2], 40],
  ]),
};
const SHADOW_AT = { hook: CENTRE, flash: CENTRE, fireball: CENTRE, mushroom: CENTRE, rain: CENTRE, close: CENTRE };
const shotCam = (id, f) => {
  const c = camFromKeys(CAMS[id], f, {});
  const D = dirFor(id, f);
  return { ...c, look: lerp3(c.look, D.point, D.w) };
};
export const camAt = (f) => {
  const S = shotAt(f);
  const c = shotCam(S.id, f);
  // impact shake as the flash lands, decaying fast
  const d0 = f - SEG.flash.a;
  if (d0 >= 0 && d0 < 7) { const m = 0.011 * [1, -0.62, 0.3, -0.12, 0.05, -0.02, 0.01][d0]; c.pos = [c.pos[0] + m * 0.5, c.pos[1] + m, c.pos[2]]; c.look = [c.look[0] + m * 0.8, c.look[1] + m * 1.4, c.look[2]]; }
  // the detonation white-out + dips to black at every other shot boundary
  let flash = 0;
  if (f < 20) flash = -1 + ramp(f, 0, 20); // open on true black, fade up as the point blooms
  if (d0 >= 0 && d0 < 16) flash = Math.max(flash, 1 - d0 / 16);
  else if (d0 >= 16 && d0 < 22) flash = Math.max(flash, 0.18 * (1 - (d0 - 16) / 6)); // afterglow
  for (const [, a] of TIMING.slice(1)) { if (a === SEG.flash.a) continue; const d = f - a; if (d >= -3 && d <= 3) flash = Math.min(flash, -0.95 * Math.cos(d / 3 * Math.PI / 2)); }
  c.flash = flash;
  c.shadowAt = SHADOW_AT[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CINF = { hook: 4, flash: 5, fireball: 6, mushroom: 7, rain: 7, close: 9 };
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  return { focus: dist(C.pos, dirAt(f).point), cinf: CINF[S.id] ?? 5 };
};

// ---------- world state (drives the 3D hardware in main.js) ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    shot: S.id,
    plane: null, bomb: null, figures: [],
    fireball: fireballAt(f), cloud: cloudAt(f),
    rings: ringAt(f), fires: firesAt(f), rain: rainAt(f),
    stormGlow: stormGlowAt(f),
    cityDark: cityDarkAt(f),
    boards: {
      suns: f >= SEG.flash.a + 30 && f < SEG.fireball.b - 10,
      temp: f >= SEG.flash.a + 80 && f < SEG.fireball.b - 10,
      sound: f >= SEG.fireball.a + 140 && f < SEG.mushroom.a + 90,
      planes: f >= SEG.mushroom.a + 90 && f < SEG.rain.a + 280,
      fire: f >= SEG.rain.a + 50 && f < SEG.close.a + 100,
      close: f >= SEG.close.a + 40,
    },
    sway: f,
  };
};

// ---------- actors: none ----------
export const actorsAt = (f, T) => [];

// ---------- 2D effects: halos, ring dust — and THE COUNTER, pinned to the screen ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ground: 0, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const glow = (tp, s, a) => out.push(FX('glow' + q(a, 2) + '_' + q(tp[0], 1), (p) => fxGlow(p, a), [tp[0], tp[1] - 0.81 * s, tp[2] + 0.12], s));
  const FB = fireballAt(f);
  if (FB) glow(FB.p, FB.s * 0.42, 0.42 * FB.a);                        // fireball halo
  if (S.id === 'fireball' || S.id === 'mushroom') {                    // dust riding the ring front
    const rings = ringAt(f) || [];
    for (const R of rings) for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.35, t = q(R.dust, 2);
      out.push(FX('rd' + k + t, (p) => T.fxDust(p, t, '#cbb99e'), [CENTRE[0] + Math.cos(a) * R.r, 0.5, CENTRE[2] + Math.sin(a) * R.r], 2.0));
    }
  }
  // THE COUNTER — a card pinned in front of the camera (top-centre of frame), so it is
  // readable in EVERY frame whatever the camera does. Position = cam + fwd*13 + up*2.75.
  {
    const C = camAt(f);
    const d = [C.look[0] - C.pos[0], C.look[1] - C.pos[1], C.look[2] - C.pos[2]];
    const dl = Math.hypot(...d) || 1; const fn = d.map((v) => v / dl);
    const up0 = [0, 1, 0]; const dot = up0[0] * fn[0] + up0[1] * fn[1] + up0[2] * fn[2];
    const up = up0.map((v, i) => v - fn[i] * dot); const ul = Math.hypot(...up) || 1; const un = up.map((v) => v / ul);
    // in the close shot the counter rides higher + slightly smaller, so the complete
    // cloud sits BELOW it in the pull-back framing instead of hiding behind the plaque
    const lift = f >= SEG.close.a ? ramp(f, SEG.close.a, SEG.close.a + 90) : 0;
    const D = 11.5, U = lerp(-0.25, 0.9, lift); // pos is the card's BOTTOM edge; the plaque sits ~49% up the card
    const pos = [C.pos[0] + fn[0] * D + un[0] * U, C.pos[1] + fn[1] * D + un[1] * U, C.pos[2] + fn[2] * D + un[2] * U];
    const sec = secondAt(f), word = PHASE_WORD[S.id];
    const pop = 1 + 0.16 * tickPopAt(f);
    const fadeIn = ramp(f, 6, 26); // the counter fades in as the point blooms
    out.push(FX('ctr' + sec + word, (p) => drawCounter(p, sec, word), pos, lerp(2.3, 1.9, lift) * pop, { alpha: fadeIn, order: 9 }));
  }
  return out;
};
// the counter face: dark plaque, SECOND label, the giant number, the phase word
const drawCounter = (p, sec, word) => {
  const g = p.g;
  g.save();
  // plaque
  g.beginPath();
  const x0 = 70, y0 = 300, x1 = 530, y1 = 720, r = 34;
  g.moveTo(x0 + r, y0); g.arcTo(x1, y0, x1, y1, r); g.arcTo(x1, y1, x0, y1, r); g.arcTo(x0, y1, x0, y0, r); g.arcTo(x0, y0, x1, y0, r); g.closePath();
  g.fillStyle = 'rgba(8,10,16,0.78)'; g.fill();
  g.lineWidth = 7; g.strokeStyle = 'rgba(255,183,84,0.95)'; g.stroke();
  // label
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffb754'; g.font = '700 46px Arial';
  g.fillText('S E C O N D', 300, 378);
  // the number
  g.fillStyle = '#ffffff'; g.font = '900 360px Arial';
  g.fillText(String(sec), 300, 548);
  // phase word
  g.fillStyle = 'rgba(255,233,196,0.92)'; g.font = '700 40px Arial';
  g.fillText(word, 300, 668);
  g.restore();
};
// soft radial warm glow (design-space centre 300,640 -> 0.81 m above the card origin at s=1)
const fxGlow = (p, a) => {
  const g = p.g;
  const gr = g.createRadialGradient(300, 640, 12, 300, 640, 300);
  gr.addColorStop(0, `rgba(255,208,112,${a.toFixed(3)})`);
  gr.addColorStop(0.55, `rgba(255,182,84,${(a * 0.45).toFixed(3)})`);
  gr.addColorStop(1, 'rgba(255,182,84,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 600, 1000);
};
