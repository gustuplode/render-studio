import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, fridaPosAt, digAt } from './story.js';

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
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  concrete: texM(P.stone(31, 40, 5, 58), 1, 1, '#cfcbc2'),
  concreteDk: texM(P.stone(32, 40, 6, 46), 1, 1, '#b8b2a4'),
  plasterA: texM(P.plaster(33, 36), 2, 2),
  plasterB: texM(P.plaster(34, 18), 2, 2),
  dirt: texM(P.dirt(35), 12, 12, '#b49a72'),
  street: texM(P.stone(36, 40, 4, 40, 256, 256), 8, 3, '#a9a499'),
  beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
};
const MW = {
  dark: toon({ color: '#3c3a38' }), rebar: toon({ color: '#5a4632' }),
  winDark: new THREE.MeshBasicMaterial({ color: 0x232830, fog: true }),
  gold: toon({ color: '#c9a227' }), leaf: toon({ color: '#4a6a34' }),
  shade: new THREE.MeshBasicMaterial({ color: 0x2e2a20, transparent: true, opacity: 0.2, depthWrite: false }),
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
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };
const clamp01 = (x) => Math.max(0, Math.min(1, x));

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

// ---------- text-board helper (canvas texture plane; boards are in-world props) ----------
const textBoard = (lines, w, h, bg, fg, font = 900) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};

// ---------- the set: Mexico City street + collapsed building + rubble field ----------
const world = new THREE.Group(); scene.add(world);
{
  flat(add(new THREE.CircleGeometry(70, 40), M.dirt, 0, -0.04, -4, world, { cast: false }));
  add(tbox(48, 0.06, 15, 3), M.street, 0, -0.03, 1.5, world, { cast: false }); // street slab, top at y=0
  // standing facades (cracked, window-framed) along the back
  const facade = (x, w, h, z, mat, lean = 0) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.z = lean; world.add(g);
    add(tbox(w, h, 0.8, 2), mat, 0, h / 2, 0, g, { cast: false });
    const cols = Math.max(2, Math.floor(w / 1.9)), rows = Math.max(1, Math.floor(h / 1.9));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const wx = -w / 2 + (i + 0.5) * (w / cols), wy = 1.15 + j * 1.9;
      if (wy > h - 0.7) continue;
      const win = add(new THREE.PlaneGeometry(0.92, 1.25), MW.winDark, wx, wy, 0.42, g, { cast: false }); win.userData.ndSkip = true;
      add(tbox(1.06, 0.09, 0.06, 2), M.beamDark, wx, wy + 0.66, 0.43, g, { cast: false });
      add(tbox(1.06, 0.09, 0.06, 2), M.beamDark, wx, wy - 0.66, 0.43, g, { cast: false });
    }
    return g;
  };
  facade(-6.5, 7, 5.6, -8.2, M.plasterA, 0.012);
  facade(7.6, 8, 6.6, -8.4, M.plasterB, -0.01);
  facade(0.4, 5.5, 2.1, -8.8, M.concreteDk, 0.05); // the flattened one: only a stump stands
  // fallen facade chunk leaning on the stump
  const fallen = add(tbox(4.6, 3.4, 0.7, 2), M.concreteDk, 1.8, 1.15, -6.6, world, { cast: false });
  fallen.rotation.set(-0.5, 0.2, 0.35);
  // side wall stubs
  add(tbox(0.8, 3.4, 12, 2), M.concrete, -11.5, 1.7, -3, world, { cast: false });
  add(tbox(0.8, 2.6, 10, 2), M.concreteDk, 11.8, 1.3, -2, world, { cast: false });
}
// rubble field: layered tilted concrete slabs with rebar, corridor kept open at |x|<0.95
const slabAt = (x, z, w, h, d, tiltX = 0, tiltZ = 0, ry = 0, mat = M.concrete) => {
  const s = add(tbox(w, h, d, 2), mat, x, h / 2 - 0.02, z, world);
  s.rotation.set(tiltX, ry, tiltZ); return s;
};
{
  const R = P.rng(1234);
  const slabs = [
    // corridor walls (leaning in over Frida's crawl path)
    [-1.25, 2.2, 1.5, 0.5, 1.1, 0.06, 0.14], [-1.3, 0.6, 1.6, 0.62, 1.2, -0.05, 0.12], [-1.2, -1.2, 1.4, 0.55, 1.1, 0.08, 0.1], [-1.35, -2.6, 1.7, 0.7, 1.3, 0, 0.16],
    [1.3, 2.6, 1.5, 0.55, 1.2, -0.07, -0.13], [1.25, 0.9, 1.4, 0.48, 1.0, 0.05, -0.11], [1.35, -0.9, 1.6, 0.66, 1.2, -0.04, -0.15], [1.2, -2.4, 1.5, 0.5, 1.1, 0.06, -0.1],
    // field spread
    [-2.9, 0.2, 2.2, 0.34, 1.6, 0.1, 0.06], [-3.4, -2.2, 2.6, 0.42, 1.8, -0.08, -0.05], [-2.6, 3.4, 1.9, 0.3, 1.4, 0.05, 0.12],
    [3.1, 2.9, 2.3, 0.38, 1.5, -0.06, 0.09], [3.5, -1.8, 2.4, 0.44, 1.7, 0.09, -0.07], [2.7, -3.6, 2.0, 0.32, 1.5, 0, 0.05],
    [-4.6, 1.8, 1.8, 0.3, 1.3, 0.12, 0], [4.8, 0.9, 1.7, 0.36, 1.2, -0.1, 0.08], [0.2, -4.4, 2.8, 0.4, 1.6, 0.07, 0.03],
    [-1.8, -4.6, 2.1, 0.36, 1.4, -0.05, 0.1], [2.2, 4.6, 1.9, 0.28, 1.3, 0.04, -0.06],
  ];
  slabs.forEach(([x, z, w, h, d, tx, tz], i) => slabAt(x, z, w, h, d, tx, tz, (R() - 0.5) * 0.5, i % 3 ? M.concrete : M.concreteDk));
  // stacked second layer on two piles
  slabAt(-3.3, -2.1, 1.7, 0.3, 1.2, 0.14, -0.1, 0.4, M.concreteDk).position.y = 0.52;
  slabAt(3.4, -1.7, 1.6, 0.28, 1.1, -0.12, 0.08, -0.3).position.y = 0.56;
  // broken chunks scattered (real broken edges: small tilted boxes)
  for (let i = 0; i < 42; i++) {
    const a = R() * Math.PI * 2, d = 1.6 + R() * 6.5, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.8 + 0.4;
    if (Math.abs(x) < 1.0 && z > -3.2 && z < 3.4) continue;
    const s = 0.16 + R() * 0.3;
    const ch = add(tbox(s, s * 0.6, s * (0.7 + R() * 0.5), 2), R() < 0.5 ? M.concrete : M.concreteDk, x, s * 0.28, z, world, { cast: false });
    ch.rotation.set((R() - 0.5) * 0.7, R() * 3, (R() - 0.5) * 0.7);
  }
  // rebar rods poking out of slabs
  for (const [x, y, z, rz, rx2] of [[-1.3, 0.62, 0.6, 0.7, 0.3], [1.35, 0.66, -0.9, -0.8, 0.2], [-3.4, 0.5, -2.2, 0.5, -0.4], [3.5, 0.52, -1.8, -0.6, 0.5], [0.2, 0.46, -4.4, 0.9, 0.1], [-2.9, 0.4, 0.2, -0.4, 0.6]]) {
    const rb = add(new THREE.CylinderGeometry(0.022, 0.022, 0.85, 5), MW.rebar, x, y, z, world, { cast: false });
    rb.rotation.set(rx2, 0, rz);
  }
}
// the shifting slab (quake beat) — worldAt slabT tips it with a dust burst
const shiftSlabG = new THREE.Group(); shiftSlabG.position.set(-1.9, 0, -2.2); world.add(shiftSlabG);
add(tbox(1.6, 0.3, 1.2, 2), M.concreteDk, 0, 0.32, 0, shiftSlabG);
add(tbox(1.1, 0.22, 0.9, 2), M.concrete, 0.2, 0.56, 0.1, shiftSlabG);
// hero slab (flat top 0.35 — Frida's proud stand, P8)
add(tbox(2.0, 0.35, 1.6, 2), M.concrete, 1.2, 0.175, 0.8, world);
add(tbox(2.2, 0.1, 1.8, 2), M.concreteDk, 1.2, 0.05, 0.8, world, { cast: false });
// statue plinth (top 0.44) + plaque + wreath
{
  const g = new THREE.Group(); g.position.set(0.9, 0, -0.4); world.add(g);
  add(tbox(1.5, 0.36, 1.5, 2), M.concrete, 0, 0.18, 0, g);
  add(tbox(1.7, 0.08, 1.7, 2), M.concreteDk, 0, 0.4, 0, g);
  const plaque = add(new THREE.PlaneGeometry(0.72, 0.3), MW.gold, 0, 0.2, 0.76, g, { cast: false }); plaque.userData.ndSkip = true;
  const wreath = add(new THREE.TorusGeometry(0.27, 0.07, 8, 18), MW.leaf, 0, 0.3, 0.86, g, { cast: false }); wreath.rotation.x = 0.35;
  const cols = ['#e86e8a', '#e8c45a', '#eef2f6', '#c25a7a'];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.SphereGeometry(0.045, 8, 6), toon({ color: cols[i % 4] }), Math.cos(a) * 0.27, 0.3 + Math.sin(a) * 0.27, 0.9, g, { cast: false }); }
}
// ---- boards (transforms mirrored in boardverify.mjs — keep in sync) ----
// B1 city: group (-2.4,0,-5.35) ry 0.25, wall fragment + face 2.6x1.25 at local (0,1.95,0.19)
const cityG = new THREE.Group(); cityG.position.set(-2.4, 0, -5.35); cityG.rotation.y = 0.25; world.add(cityG);
add(tbox(3.4, 2.9, 0.35, 2), M.concrete, 0, 1.45, 0, cityG, { cast: false });
const boardCity = textBoard(['MEXICO CITY · 2017'], 2.6, 1.25, '#4a4038', '#ffe9a8'); boardCity.position.set(0, 1.95, 0.19); cityG.add(boardCity);
// B2 fifty: easel group (1.35,0,-1.6) ry -0.12, face 2.2x1.05 at local (0,1.6,0.05) —
// centred behind the hero slab so the portrait frame holds it whole (see boardverify).
// Posts asymmetric (finale occlusion fix 2026-11-13): LEFT post at -1.60 (was -1.26)
// so in finale/tease it clears the DUTY board's "S"; crossbar widened 2.85->3.19 and
// recentred to x -0.17 so it keeps the same 0.165 overhang past each post.
const fiftyG = new THREE.Group(); fiftyG.position.set(1.35, 0, -1.6); fiftyG.rotation.y = -0.12; world.add(fiftyG);
for (const px of [-1.60, 1.26]) add(new THREE.CylinderGeometry(0.05, 0.065, 2.1, 7), M.beamDark, px, 1.05, -0.06, fiftyG, { cast: false });
add(tbox(3.19, 0.09, 0.08, 2), M.beam, -0.17, 2.14, -0.06, fiftyG, { cast: false });
const board50 = textBoard(['MORE THAN 50', 'PEOPLE FOUND'], 2.2, 1.05, '#274b73', '#ffe9a8'); board50.position.set(0, 1.6, 0.05); fiftyG.add(board50);
// B3 duty: group (0.95,0,-2.65) ry 0, posts + face 2.4x1.15 at local (0,1.8,0.05)
// (group x 0.9->0.95 in the finale occlusion fix 2026-11-13 — extra clearance
// between the "S" and the fifty easel's left post; boardverify GP kept in sync)
const dutyG = new THREE.Group(); dutyG.position.set(0.95, 0, -2.65); world.add(dutyG);
for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.065, 2.3, 7), M.beamDark, sd * 1.36, 1.15, -0.06, dutyG, { cast: false });
add(tbox(3.0, 0.09, 0.08, 2), M.beam, 0, 2.34, -0.06, dutyG, { cast: false });
const boardDuty = textBoard(['STILL ON DUTY'], 2.4, 1.15, '#4a3421', '#ffe9a8'); boardDuty.position.set(0, 1.8, 0.05); dutyG.add(boardDuty);
const boardGlint = FX.glint(0.5); boardGlint.position.set(2.2, 2.3, -2.2); boardGlint.userData.ndSkip = true; world.add(boardGlint);
// medal glint at Frida's chest during the retirement ceremony
const medalGlint = FX.glint(0.55); medalGlint.position.set(0.34, 0.62, 1.05); medalGlint.userData.ndSkip = true; world.add(medalGlint);
// work lamps + volumetric beams into the rubble voids
const beams = [];
const makeLamp = (x, z, tx, tz) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, 2.3, 7), MW.dark, 0, 1.15, 0, g, { cast: false });
  add(tbox(0.34, 0.24, 0.3, 2), MW.dark, 0, 2.36, 0, g, { cast: false });
  const from = new THREE.Vector3(x, 2.36, z);
  const dir = new THREE.Vector3(tx - x, -1.5, tz - z).normalize();
  const beam = new FX.Beam(scene, { from, dir, length: 7.5, radius: 1.15, color: 0xffe2ae, intensity: 0.5 });
  beam.mesh.userData.ndSkip = true; beam.glow.userData.ndSkip = true;
  beams.push(beam);
  const gl = FX.glint(0.8); gl.position.set(x, 2.36, z + 0.2); gl.userData.ndSkip = true; world.add(gl);
  return gl;
};
const lampGlintA = makeLamp(-2.7, 2.0, -0.4, -0.6);
const lampGlintB = makeLamp(2.9, -2.6, 0.6, -0.8);

// ---------- FX: dust in the air (Smoke, grey-tan, low opacity) + clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 0.5, -0.5, { rate: 1.5, color: 0xc4b294, opacity: 0.15, scale: 0.85, grow: 1.3, life: 3.0, vy: 0.35, wind: 0.4 });
const digEmit = smoke.addEmitter(1.35, 0.25, -1.15, { rate: 0, color: 0xd8c8a4, opacity: 0.22, scale: 0.5, grow: 1.1, life: 1.6, vy: 0.8, wind: 0.3 });
const fxClouds = new FX.Clouds(scene, { count: 4, y: 55, opacity: 0.16, color: 0xf2ead2, drift: 0.3 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), fp = fridaPosAt(fxF), dg = digAt(fxF);
    dustEmit.rate = pr.smokeRate; dustEmit.x = fp[0] * 0.4; dustEmit.z = fp[2] * 0.4 - 0.4;
    if (dg) { digEmit.rate = 6; digEmit.x = dg[0]; digEmit.z = dg[1]; } else digEmit.rate = 0;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
  }
};

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor(scale = 1) {
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

// ---------- render targets & post (ink/dof contract) ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
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
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}
function worldState(Ws, f) {
  fxStepTo(f);
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardCity, Ws.boardCity || 0); setB(board50, Ws.board50 || 0); setB(boardDuty, Ws.boardDuty || 0);
  boardGlint.material.opacity = Math.max(Ws.board50 || 0, Ws.boardDuty || 0) * (0.5 + 0.3 * Math.sin(f * 0.33));
  medalGlint.material.opacity = (Ws.medalK || 0) * (0.55 + 0.35 * Math.sin(f * 0.4));
  shiftSlabG.rotation.z = (Ws.slabT || 0) * 0.085;
  shiftSlabG.position.y = -(Ws.slabT || 0) * 0.07;
  beams.forEach((b) => { b.setIntensity(0.25 + 0.55 * (Ws.lampK || 0.5)); b.update(f / 30, 1 / 30, camera); });
  const lk = 0.35 + 0.5 * (Ws.lampK || 0.5);
  lampGlintA.material.opacity = lk; lampGlintB.material.opacity = lk;
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
    if (a.blob !== false && a.y < 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
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
  applyLight(L, f);
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
