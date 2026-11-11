// Moko — engine: ink + DOF post chain, Card system, FX stepping, one continuous
// bay (sea -z, sandbar z~-8 with channel gap at x~+34, shallows, beach z>=+12).
// Deterministic: frame in -> same picture out (no wall clock, no unseeded random).
import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { buildMoko, buildWhale } from './animals.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, mokoAt, whalesAt, boatAt, FINALE_BOARD, SIGN_BOARD } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const M = {
  sand: toon({ color: '#cdb586' }), sandWet: toon({ color: '#97804f' }), rock: toon({ color: '#59636e' }),
  weed: toon({ color: '#2e7d46', side: THREE.DoubleSide }), white: toon({ color: '#eef2f6' }), hullRed: toon({ color: '#b03a30' }),
  wood: toon({ map: P.tex(P.planks(3), 1, 1) }), darkMetal: toon({ color: '#3c4148' }), rope: toon({ color: '#8a6f4d' }),
  orange: toon({ color: '#e8641c' }), truck: toon({ color: '#3f6a8c' }), tyre: toon({ color: '#22262b' }),
};

// ---------- ink / normal-depth contract ----------
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 }, aur: { value: 0 }, time: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize, aur, time; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- THE BAY (one continuous geography) ----------
// deep base so edges never show void
{ const base = flat(add(new THREE.PlaneGeometry(500, 500), toon({ color: '#0f3650' }), 10, -4.6, -20, scene, { cast: false })); }
// shallows floor (pale sand under the stranded zone, sand-ripple speckle via dirt tex)
const shalTex = P.tex(P.dirt(11), 10, 3);
flat(add(new THREE.PlaneGeometry(150, 36), toon({ map: shalTex, color: '#d8c49a' }), 8, -1.3, 0, scene, { cast: false }));
// sea water (shader, layered: wakes/splashes/foam on top)
const seaWater = FX.makeWater({ size: 280, seg: 88, deep: 0x12506e, shallow: 0x2f96b4, sky: 0xbfe3f2, amp: 0.38 });
seaWater.position.set(10, 0, -16); seaWater.userData.ndSkip = true; scene.add(seaWater);
seaWater.material.fragmentShader = seaWater.material.fragmentShader.replace('fres * 0.55', 'fres * 0.30').replace('spec * 0.55', 'spec * 0.4'); seaWater.material.needsUpdate = true;
const seaSkin = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), new THREE.MeshBasicMaterial({ color: 0xa8d4ea, transparent: true, opacity: 0.94, side: THREE.DoubleSide, fog: false }));
seaSkin.rotation.x = -Math.PI / 2; seaSkin.position.set(10, 0.07, -16); seaSkin.userData.ndSkip = true; scene.add(seaSkin);
// SANDBAR ridge along x at z~-8, with the deep CHANNEL gap at x in [26, 42]
add(box(112, 1.0, 3.4), M.sandWet, -30, -0.62, -8, scene, { cast: false });
add(box(66, 1.0, 3.4), M.sandWet, 75, -0.62, -8, scene, { cast: false });
// foam collars on the sandbar edges (animated opacity in worldState)
const foamMat = new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.4, depthWrite: false, fog: true });
const foamStrips = [];
for (const [w, x, z] of [[112, -30, -6.1], [112, -30, -9.9], [66, 75, -6.1], [66, 75, -9.9]]) {
  const p = flat(add(new THREE.PlaneGeometry(w, 0.55), foamMat, x, 0.05, z, scene, { cast: false })); p.userData.ndSkip = true; foamStrips.push(p);
}
// BEACH: sand slab, top y=0.35, z from +12 to +44
flat(add(new THREE.PlaneGeometry(240, 32), toon({ color: '#dec9a0' }), 10, 0.35, 28, scene, { cast: false }));
{ const crateF = FX.crate(0.85); crateF.position.set(25.2, 0.78, 13.2); crateF.rotation.y = 0.5; scene.add(crateF);
  for (const [gx, gz] of [[24.2, 15.8], [33.8, 15.2], [26.8, 17.8], [31.5, 17.2]]) { const tu = add(new THREE.ConeGeometry(0.3, 0.75, 6), M.weed, gx, 0.68, gz, scene, { cast: false }); tu.scale.z = 0.6; } }
flat(add(new THREE.PlaneGeometry(240, 3.4), M.sandWet, 10, 0.16, 10.6, scene, { cast: false }));
for (let i = 0; i < 5; i++) { const d = add(new THREE.SphereGeometry(3 + i, 10, 8), M.sand, -30 + i * 22, 0.1, 36 + (i % 2) * 3, scene, { cast: false }); d.scale.y = 0.25; }
// shoreline foam edge: scrolling striped plane at the waterline z~+12
const foamTexC = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 32); g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let x = 0; x < 256; x += 32) { g.beginPath(); g.ellipse(x + 16, 16, 15, 6 + (x % 64 ? 2 : -1), 0, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 1); return t; })();
const shoreFoam = flat(add(new THREE.PlaneGeometry(240, 1.7), new THREE.MeshBasicMaterial({ map: foamTexC, transparent: true, opacity: 0.75, depthWrite: false, fog: true }), 10, 0.06, 12.1, scene, { cast: false }));
shoreFoam.userData.ndSkip = true;
// rocks: channel edges + officer point + scattered shallows detail
{ const r = P.rng(47);
  const rockAt = (x, y, z, s) => { const m = add(new THREE.DodecahedronGeometry(s), M.rock, x, y, z, scene, { cast: false }); m.rotation.set(r() * 3, r() * 3, 0); return m; };
  rockAt(28.5, -0.5, -5.6, 0.9).userData.ndSkip = true; rockAt(44.5, -0.7, -20, 0.85).userData.ndSkip = true; rockAt(27.5, 0.15, 9.2, 0.8); rockAt(32.5, 0.1, 8.8, 0.65); rockAt(25.8, 0.05, 11.8, 0.55);
  for (let i = 0; i < 14; i++) { if (i < 5) { const rk = rockAt(-20 + r() * 44, -0.38, -4 + r() * 9, 0.55 + r() * 0.3); rk.scale.y = 0.6; rk.userData.ndSkip = true; } else { const rk = rockAt(-20 + r() * 44, -1.18, -4 + r() * 9, 0.2 + r() * 0.32); rk.scale.y = 0.55; rk.userData.ndSkip = true; } }
}
// kelp in the shallows
const kelps = [];
{ const r = P.rng(83);
  for (let i = 0; i < 16; i++) { const k = add(new THREE.SphereGeometry(0.34 + (i % 3) * 0.09, 10, 7), M.weed, -18 + r() * 40, -0.10, -4 + r() * 9, scene, { cast: false }); k.scale.set(1.25, 0.5, 1); k.userData.mound = true; k.userData.ndSkip = true; k.position.y = -1.3; kelps.push(k); } }
// rescue boat (anchored)
const boatG = new THREE.Group(); scene.add(boatG);
{ add(box(2.3, 0.75, 5.4), M.white, 0, 0.18, 0, boatG);
  add(box(2.34, 0.2, 5.44), M.hullRed, 0, -0.08, 0, boatG, { cast: false });
  const bow = add(box(1.7, 0.7, 1.4), M.white, 0, 0.18, 3.2, boatG); bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.72);
  add(box(1.5, 0.95, 1.9), M.white, 0, 1.0, -1.2, boatG);
  add(box(1.54, 0.3, 1.94), toon({ color: '#2e6b8f' }), 0, 1.3, -1.2, boatG, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 7), M.darkMetal, 0, 1.9, 1.2, boatG, { cast: false }); }
// orange buoys
const buoys = [];
for (const [x, z] of [[-11, 0.5], [20, -0.5], [24, -5.5], [31, -3.0]]) { const b = add(new THREE.SphereGeometry(0.22, 10, 8), M.orange, x, 0.05, z, scene, { cast: false }); buoys.push(b); }
// beach truck
const truckG = new THREE.Group(); truckG.position.set(7, 0.35, 17.5); truckG.rotation.y = -0.35; scene.add(truckG);
{ add(box(1.9, 1.0, 2.6), M.truck, 0, 0.95, -0.9, truckG);
  add(box(1.9, 1.15, 1.7), M.white, 0, 1.0, 1.55, truckG);
  add(box(1.7, 0.5, 0.1), toon({ color: '#9fd8e8' }), 0, 1.25, 2.42, truckG, { cast: false });
  for (const [sx, sz] of [[-0.95, -1.6], [0.95, -1.6], [-0.95, 1.5], [0.95, 1.5]]) { const w = add(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 12), M.tyre, sx, 0.42, sz, truckG, { cast: false }); w.rotation.z = Math.PI / 2; }
  const crate1 = FX.crate(0.8); crate1.position.set(-0.4, 1.85, -1.1); truckG.add(crate1); }
// god-ray cones (talk close-ups / underwater light)
const rays = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 2.0, 6.5, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  m.position.set(-7 + i * 2.4, -3.35, 0.5 + i * 1.2); m.rotation.z = 0.32; m.userData.ndSkip = true; scene.add(m); rays.push(m);
}
// gulls: small white double-triangle birds on deterministic circles
const gulls = [];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  const wm = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: true });
  const wgeo = new THREE.PlaneGeometry(0.85, 0.3); wgeo.translate(0.42, 0, 0);
  const wl = new THREE.Mesh(wgeo, wm); const wr = new THREE.Mesh(wgeo, wm); wr.rotation.y = Math.PI;
  g.add(wl); g.add(wr); g.userData = { wl, wr, seed: i * 1.7, r: 20 + i * 4, h: 11 + i * 1.3, sp: 0.05 + i * 0.008 };
  g.traverse((m) => { m.userData.ndSkip = true; }); scene.add(g); gulls.push(g);
}

// ---------- boards with AUTO-FIT text (cropped boards are banned) ----------
const boardTex = (lines, bg, fg, sub) => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 400; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 640, 400); g.strokeStyle = fg; g.lineWidth = 12; g.strokeRect(16, 16, 608, 368);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const maxW = 640 - 2 * 56;
  const fit = (text, start) => { let s = start; g.font = `900 ${s}px Arial`; while (g.measureText(text).width > maxW && s > 12) { s -= 2; g.font = `900 ${s}px Arial`; } return s; };
  const n = lines.length;
  lines.forEach((ln, i) => { const s = fit(ln[0], ln[1]); g.font = `900 ${s}px Arial`; g.fillText(ln[0], 320, 400 * (i + 0.5) / n + (sub ? -18 : 0)); });
  if (sub) { const s = fit(sub, 36); g.font = `700 ${s}px Arial`; g.fillText(sub, 320, 356); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const mkBoard = (B, tex) => {
  const g = new THREE.Group(); g.position.set(...B.pos); g.rotation.y = B.ry; scene.add(g);
  add(box(B.w + 0.15, B.h + 0.15, 0.07), M.wood, 0, B.h / 2 + 0.45, 0, g);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.h), new THREE.MeshBasicMaterial({ map: tex, fog: true }));
  face.position.set(0, B.h / 2 + 0.45, 0.045); face.userData.ndSkip = true; g.add(face);
  for (const s of [-B.w / 3, B.w / 3]) add(box(0.08, 0.5, 0.08), M.darkMetal, s, 0.25, 0, g, { cast: false });
  return g;
};
const signBoard = mkBoard(SIGN_BOARD, boardTex([['MAHIA BEACH', 74]], '#fdf6e0', '#1d5f74', 'NEW ZEALAND'));
const finalBoard = mkBoard(FINALE_BOARD, boardTex([["THE RESCUERS COULDN'T.", 62], ['THE DOLPHIN COULD.', 62]], '#1d5f74', '#fdf6e0'));

// ---------- animals ----------
const moko = buildMoko(); scene.add(moko.group);
const mother = buildWhale(1.10); scene.add(mother.group);
const calf = buildWhale(0.76); scene.add(calf.group);
// bubbles around Moko (pure function of frame)
const BUB_N = 90;
const bubGeo = new THREE.BufferGeometry();
const bubPos = new Float32Array(BUB_N * 3);
bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3).setUsage(THREE.DynamicDrawUsage));
const bubMat = new THREE.PointsMaterial({ map: FX.puffTexture(), color: 0xdff4ff, size: 0.15, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true });
const bubbles = new THREE.Points(bubGeo, bubMat); bubbles.userData.ndSkip = true; bubbles.frustumCulled = false; scene.add(bubbles);

// ---------- FX systems ----------
const splashes = new FX.Splashes(scene, 280); splashes.points.userData.ndSkip = true;
const wake = new FX.Wake(scene, 40); wake.pool.forEach((p) => { p.m.userData.ndSkip = true; });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 44, opacity: 0.5, color: 0xeaf2f8, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.position.z = -80 - (cl.userData.x0 = 0, 0); cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const mist = FX.mistBand(scene, { count: 8, y: 1.3, opacity: 0.16 });
mist.traverse((m) => { m.userData.ndSkip = true; if (m.material) m.userData.op0 = m.material.opacity; });
let fxF = -1;
const fxReset = () => { splashes.life.fill(-1); wake.pool.forEach((p) => { p.life = -1; p.m.visible = false; }); wake.acc = 0; };
const tailOf = (a, scale) => [a.pos[0] - Math.sin(a.yaw) * 1.55 * scale, a.pos[2] - Math.cos(a.yaw) * 1.55 * scale];
const blowOf = (a, scale) => [a.pos[0] + Math.sin(a.yaw) * 0.95 * scale, a.pos[1] + 0.36 * scale, a.pos[2] + Math.cos(a.yaw) * 0.95 * scale];
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, S = shotAt(fxF), Ws = worldAt(fxF);
    const mk = mokoAt(fxF), wh = whalesAt(fxF);
    if (S.id === 'stranded' && fxF % 47 === 0) { const [x, z] = tailOf(wh.mother, 1.1); splashes.burst(x, 0.06, z, { n: 9, power: 2.1 }); }
    if (S.id === 'rescue' && fxF % 11 === 0) { const [x, z] = tailOf(wh.mother, 1.1); splashes.burst(x, 0.06, z, { n: 6, power: 1.6 }); }
    if (S.id === 'turnback' && fxF >= 562 && fxF <= 655 && fxF % 7 === 0) { const [x, z] = tailOf(wh.mother, 1.1); splashes.burst(x, 0.06, z, { n: 11, power: 2.7 }); }
    if (Ws.breathK > 0.5 && fxF % 80 === 20) { const [x, y, z] = blowOf(wh.mother, 1.1); splashes.burst(x, Math.max(0.1, y), z, { n: 6, power: 1.25 }); }
    if (Ws.breathK > 0.5 && fxF % 80 === 58) { const [x, y, z] = blowOf(wh.calf, 0.76); splashes.burst(x, Math.max(0.1, y), z, { n: 4, power: 1.0 }); }
    if (fxF === 698 || fxF === 716 || fxF === 734) splashes.burst(mk.pos[0], 0.06, mk.pos[2], { n: 24, power: 4.4 });
    if (S.id === 'lead' && fxF % 16 === 0) splashes.burst(mk.pos[0], 0.06, mk.pos[2], { n: 5, power: 1.8 });
    if (S.id === 'channel' && fxF >= 1148 && fxF <= 1185 && fxF % 9 === 0) splashes.burst(mk.pos[0], 0.06, mk.pos[2], { n: 10, power: 3.0 });
    if (fxF === 1258 || fxF === 1274) { const [x, z] = tailOf(wh.mother, 1.1); splashes.burst(x, 0.06, z, { n: 26, power: 4.6 }); }
    if (fxF === 1354 || fxF === 1378 || fxF === 1402) splashes.burst(mokoAt(fxF).pos[0], 0.06, mokoAt(fxF).pos[2], { n: 20, power: 4.0 });
    // wakes only behind MOVING animals
    if (mk.speed > 0.5 && mk.leapK < 0.4) { const [x, z] = tailOf(mk, 1); wake.trail(x, z, dt, 1.0); }
    if (wh.mother.speed > 0.35 && fxF < 1230) { const [x, z] = tailOf(wh.mother, 1.1); wake.trail(x, z, dt, 1.15); }
    if ((S.id === 'hook' || S.id === 'stranded' || S.id === 'rescue' || S.id === 'talk') && fxF % 22 === 0) { wake.drop(wh.mother.pos[0], wh.mother.pos[2], 1.35); if (fxF % 44 === 0) wake.drop(wh.calf.pos[0], wh.calf.pos[2], 1.25); }
    if (wh.calf.speed > 0.35) { const [x, z] = tailOf(wh.calf, 0.76); wake.trail(x, z, dt, 1.1); }
    splashes.update(t, dt); wake.update(t, dt); fxClouds.update(t, dt);
  }
};

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor() {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; })();
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & post (winter ink/DOF chain) ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.07 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;
      if (card) ds = 1e4;
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9);
    }
    return e * (1. - smoothstep(140., 520., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, flash < 0. ? vec3(0.) : vec3(1.), clamp(abs(flash), 0., 1.));
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
function applyLight(L) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  seaWater.material.uniforms.uDeep.value.set(L.waterDeep); seaWater.material.uniforms.uShallow.value.set(L.waterShal); seaWater.material.uniforms.uSky.value.set(L.glint);
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 28, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}
function placeAnimal(api, a, f) {
  const t = f / 30;
  api.pose(t, a.swimK, a.weakK || 0);
  api.group.position.set(a.pos[0], a.pos[1] + api.bob, a.pos[2]);
  api.group.rotation.set(a.pitch || 0, a.yaw, (a.roll || 0) + api.roll);
}
function worldState(Ws, f) {
  fxStepTo(f);
  const t = f / 30;
  skyU.time.value = t;
  seaWater.userData.update(t);
  placeAnimal(moko, mokoAt(f), f);
  const wh = whalesAt(f);
  placeAnimal(mother, wh.mother, f);
  placeAnimal(calf, wh.calf, f);
  const b = boatAt(f);
  boatG.position.set(b.pos[0], Math.sin(f * 0.07) * 0.045, b.pos[2]);
  boatG.rotation.y = b.yaw; boatG.rotation.z = Math.sin(f * 0.05) * 0.012;
  buoys.forEach((bu, i) => { bu.position.y = 0.05 + Math.sin(f * 0.09 + i * 1.7) * 0.05; });
  foamMat.opacity = 0.32 + 0.14 * Math.sin(f * 0.06);
  foamTexC.offset.x = (f * 0.004) % 1;
  kelps.forEach((k, i) => { k.rotation.y = Math.sin(f * 0.02 + i * 1.3) * 0.15; });
  rays.forEach((r, i) => { r.material.opacity = (Ws.shot === 'talk' ? 0.05 : 0.018) * (0.75 + 0.25 * Math.sin(f * 0.02 + i * 2.1)); r.rotation.z = 0.32 + Math.sin(f * 0.01 + i) * 0.03; });
  seaSkin.visible = camera.position.y < 0.0;
  mist.traverse((m) => { if (m.material && m.userData.op0 !== undefined) m.material.opacity = m.userData.op0 * Ws.mistK; });
  mist.position.y = Math.sin(f * 0.01) * 0.2;
  gulls.forEach((g) => {
    const u = g.userData, a = f * u.sp * 0.06 + u.seed * 2.1;
    g.position.set(Math.cos(a) * u.r + 4, u.h + Math.sin(f * 0.05 + u.seed) * 0.6, -6 + Math.sin(a) * u.r * 0.6);
    g.rotation.y = -a - Math.PI / 2;
    const flap = Math.sin(f * 0.35 + u.seed * 3) * 0.55;
    u.wl.rotation.x = 0; u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
  });
  // bubbles around Moko (pure function of frame)
  {
    const mk = mokoAt(f), on = Ws.bubbleK > 0.01;
    bubbles.visible = on;
    if (on) {
      bubMat.opacity = 0.5 * Ws.bubbleK;
      for (let i = 0; i < BUB_N; i++) {
        const sd = i * 12.9898, ox = Math.sin(sd) * 1.5, oz = Math.cos(sd * 1.7) * 1.5;
        const rise = ((f * (0.006 + (i % 5) * 0.0016) + (i % 17) / 17) % 1);
        bubPos[i * 3] = mk.pos[0] + ox + Math.sin(f * 0.05 + i * 2.0) * 0.2;
        bubPos[i * 3 + 1] = Math.min(-0.1, mk.pos[1] - 0.6 + rise * 2.2);
        bubPos[i * 3 + 2] = mk.pos[2] + oz + Math.cos(f * 0.04 + i) * 0.2;
      }
      bubGeo.attributes.position.needsUpdate = true;
    }
  }
  signBoard.visible = Ws.signK > 0;
  finalBoard.visible = Ws.finalBoardK > 0.01;
}
function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), a.roll || 0);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? a.y) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}
const swapForNd = (on) => {
  scene.traverse((o) => {
    if (on) {
      if (o.userData.ndSkip || o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (!o.isMesh) return;
      o.userData.mat0 = o.material;
      o.material = o.userData.nd || ndMat;
    } else {
      if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
      if (o.isMesh && o.userData.mat0 !== undefined) { o.material = o.userData.mat0; delete o.userData.mat0; }
    }
  });
};

window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const Ws = worldAt(f); worldState(Ws, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
