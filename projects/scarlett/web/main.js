import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, scarlettPosAt } from './story.js';

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
  plank: texM(P.planks(1), 1, 6), beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  brick: texM(P.stone(31, 10, 30, 46, 110, 42), 3, 2, '#b98a72'),
  brickDk: texM(P.stone(32, 12, 24, 34, 110, 42), 3, 2, '#8a6a5c'),
  concrete: texM(P.plaster(18, 220), 8, 2, '#9aa0a6'),
  concreteDk: texM(P.plaster(19, 215), 6, 2, '#767c84'),
  road: texM(P.dirt(17), 14, 3, '#6a6e74'),
  floorIn: texM(P.stone(41, 30, 8, 36, 90, 90), 4, 3, '#8a8378'),
  roofTile: texM(P.roof(9), 3, 2),
  wallHouse: texM(P.plaster(21, 38), 3, 2, '#cbb894'),
};
const MW = {
  darkIn: toon({ color: '#17120e' }), tyre: toon({ color: '#26262a' }), metal: toon({ color: '#5a6068' }),
  red: toon({ color: '#a02828' }), cream: toon({ color: '#e9dcba' }), bin: toon({ color: '#3f5a4a' }),
  binLid: toon({ color: '#324a3e' }), shade: new THREE.MeshBasicMaterial({ color: 0x0a0c14, transparent: true, opacity: 0.3, depthWrite: false }),
  lampGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,190,110', 0.85)), transparent: true, fog: false, depthWrite: false }),
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
const ndSkip = (o) => { o.traverse((m) => { m.userData.ndSkip = true; }); };

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

// ---------- text-board helper (kabang pattern: posts + framed face) ----------
const textBoard = (lines, w, h) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = '#4a3421'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#e9dcba'; g.fillRect(26, 26, c.width - 52, c.height - 52);
  g.strokeStyle = '#8a6a44'; g.lineWidth = 10; g.strokeRect(26, 26, c.width - 52, c.height - 52);
  g.fillStyle = '#2e2620'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach(([txt, px], i) => { g.font = `900 ${px}px Arial`; const tw = g.measureText(txt).width, maxW = c.width - 170; if (tw > maxW) { g.font = `900 ${Math.floor(px * maxW / tw)}px Arial`; } g.fillText(txt, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (0.30 + 0.38 * i))); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const grp = new THREE.Group();
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.055, 0.07, h + 0.7, 7), M.beamDark, sd * w * 0.38, (h + 0.7) / 2, -0.06, grp, { cast: false });
  add(tbox(w + 0.16, h + 0.16, 0.09, 2), M.beam, 0, h / 2 + 0.62, -0.05, grp);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: true, transparent: true }));
  face.position.set(0, h / 2 + 0.62, 0.01); face.userData.ndSkip = true; grp.add(face);
  grp.userData.face = face;
  grp.traverse((m) => { if (m.isMesh && m.material && 'transparent' in m.material) { m.material = m.material.clone(); m.material.transparent = true; } });
  return grp;
};
const setBoard = (grp, v) => {
  grp.visible = v > 0.01;
  grp.traverse((m) => { if (m.isMesh && m.material) m.material.opacity = v; });
};

// ---------- the Brooklyn street (single set, whole video) ----------
const world = new THREE.Group(); scene.add(world);
const winMats = [];
const winAt = (parent, x, y, z, w = 0.55, h = 0.65) => {
  const wm = new THREE.MeshBasicMaterial({ color: '#ffb45e', fog: false, transparent: true }); winMats.push(wm);
  const wp = add(new THREE.PlaneGeometry(w, h), wm, x, y, z, parent, { cast: false });
  wp.userData.ndSkip = true; return wp;
};
{
  // layered ground: dark earth base -> road -> kerb -> pavement -> garage apron -> interior floor
  flat(add(new THREE.CircleGeometry(70, 36), M.concreteDk, 0, -0.03, 0, world, { cast: false }));
  flat(add(new THREE.PlaneGeometry(46, 5.2), M.road, 0, 0.012, 4.4, world, { cast: false }));
  flat(add(new THREE.PlaneGeometry(46, 3.4), M.concrete, 0, 0.02, 0.1, world, { cast: false }));
  add(box(46, 0.07, 0.18), M.concreteDk, 0, 0.035, 1.85, world, { cast: false });
  flat(add(new THREE.PlaneGeometry(7.4, 2.3), M.concreteDk, -0.7, 0.018, -2.75, world, { cast: false }));
  flat(add(new THREE.PlaneGeometry(5.8, 3.4), M.floorIn, -0.7, 0.014, -5.6, world, { cast: false }));
  for (let i = -9; i <= 9; i++) { if (Math.abs(i) < 2) continue; flat(add(new THREE.PlaneGeometry(1.1, 0.2), M.cream, i * 2.3, 0.024, 4.4, world, { cast: false })); }
}
// ===== the garage (open front: opening x -1.6..0.4, y 0..2.2, front face z=-3.9) =====
{
  const G = new THREE.Group(); world.add(G);
  add(tbox(5.8, 3.2, 0.3, 2), M.brickDk, -0.7, 1.6, -7.3, G, { cast: false }); // back wall
  add(tbox(0.3, 3.2, 3.4, 2), M.brick, -3.6, 1.6, -5.6, G, { cast: false }); // side walls
  add(tbox(0.3, 3.2, 3.4, 2), M.brick, 2.2, 1.6, -5.6, G, { cast: false });
  add(tbox(2.0, 3.0, 0.3, 2), M.brick, -2.6, 1.5, -4.05, G); // front left of opening
  add(tbox(1.8, 3.0, 0.3, 2), M.brick, 1.3, 1.5, -4.05, G); // front right of opening
  add(tbox(2.0, 0.9, 0.3, 2), M.brick, -0.6, 2.65, -4.05, G); // lintel band (hook board sits on it)
  const roof = add(tbox(6.6, 0.18, 4.4, 2), M.roofTile, -0.7, 3.32, -5.7, G, { cast: false }); roof.rotation.x = 0.05;
  // door frame: two posts + top beam, real joinery around the opening
  for (const px of [-1.6, 0.4]) add(tbox(0.2, 2.2, 0.26, 2), M.beamDark, px, 1.1, -3.95, G, { cast: false });
  add(tbox(2.2, 0.2, 0.26, 2), M.beamDark, -0.6, 2.28, -3.95, G, { cast: false });
  // interior dressing (seen through the opening, lit by the fire): crates, barrel, tyre stack, shelf
  const cr1 = FX.crate(0.62); cr1.position.set(-2.9, 0.31, -6.5); ndSkip(cr1); G.add(cr1);
  const cr2 = FX.crate(0.5); cr2.position.set(-2.85, 0.88, -6.45); cr2.rotation.y = 0.4; ndSkip(cr2); G.add(cr2);
  const ba = FX.barrel(0.3, 0.74); ba.position.set(1.45, 0.37, -6.4); ndSkip(ba); G.add(ba);
  for (let i = 0; i < 2; i++) { const ty = add(new THREE.TorusGeometry(0.3, 0.1, 9, 18), MW.tyre, 1.15, 0.12 + i * 0.21, -5.1, G, { cast: false }); ty.rotation.x = Math.PI / 2; }
  add(tbox(2.2, 0.07, 0.4, 2), M.plank, -1.9, 1.9, -7.05, G, { cast: false }); // shelf + tins
  for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 8), MW.metal, -2.7 + i * 0.5, 2.06, -7.05, G, { cast: false });
  const binIn = add(new THREE.CylinderGeometry(0.26, 0.22, 0.62, 12), MW.bin, -3.0, 0.31, -4.7, G, { cast: false });
  add(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 12), MW.binLid, -3.0, 0.65, -4.7, G, { cast: false });
}
// street props: crates + barrel by the garage, dustbins, hydrant (built from parts)
{
  const cr = FX.crate(0.58); cr.position.set(2.95, 0.29, -3.3); ndSkip(cr); world.add(cr);
  const cr2 = FX.crate(0.44); cr2.position.set(2.9, 0.79, -3.25); cr2.rotation.y = 0.35; ndSkip(cr2); world.add(cr2);
  const ba = FX.barrel(0.28, 0.68); ba.position.set(3.6, 0.34, -2.85); ndSkip(ba); world.add(ba);
  for (const [bx, bz] of [[-4.6, -0.9], [-5.25, -0.75]]) {
    add(new THREE.CylinderGeometry(0.27, 0.23, 0.66, 12), MW.bin, bx, 0.33, bz, world, { cast: false });
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12), MW.binLid, bx, 0.69, bz, world, { cast: false });
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), MW.metal, bx, 0.74, bz, world, { cast: false });
  }
  const hy = new THREE.Group(); hy.position.set(3.7, 0, 2.35); world.add(hy); // hydrant: base, body, dome, side caps, top nut
  add(new THREE.CylinderGeometry(0.2, 0.24, 0.12, 12), MW.red, 0, 0.06, 0, hy, { cast: false });
  add(new THREE.CylinderGeometry(0.15, 0.17, 0.5, 12), MW.red, 0, 0.36, 0, hy, { cast: false });
  add(new THREE.SphereGeometry(0.15, 12, 8), MW.red, 0, 0.62, 0, hy, { cast: false });
  for (const sd of [-1, 1]) { const cap = add(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), MW.metal, sd * 0.18, 0.42, 0, hy, { cast: false }); cap.rotation.z = Math.PI / 2; }
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 6), MW.metal, 0, 0.78, 0, hy, { cast: false });
}
// lampposts (glow driven by worldAt lampK)
const lamps = [];
const lampAt = (x, z) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, 3.1, 8), MW.metal, 0, 1.55, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), MW.metal, 0, 3.15, 0, g, { cast: false }).rotation.z = 0.5;
  const head = add(box(0.34, 0.16, 0.24), MW.metal, 0.22, 3.3, 0, g, { cast: false });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffc37a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(1.5); glow.position.set(0.22, 3.28, 0); glow.userData.ndSkip = true; g.add(glow);
  const pool = flat(add(new THREE.CircleGeometry(1.6, 18), MW.lampGlow, 0.1, 0.015, 0, g, { cast: false }));
  pool.material = MW.lampGlow.clone(); pool.material.opacity = 0; pool.userData.ndSkip = true; pool.receiveShadow = false;
  lamps.push({ glow, pool });
  return g;
};
lampAt(-4.4, 2.3); lampAt(8.8, 2.6);
// row-house silhouettes behind the garage with lit windows
const houseAt = (x, z, w, h, wallMat) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(tbox(w, h, 3, 2), wallMat, 0, h / 2, 0, g, { cast: false });
  add(tbox(w + 0.5, 0.16, 3.6, 2), M.beamDark, 0, h + 0.08, 0, g, { cast: false });
  for (let r = 0; r < 2; r++) for (let cix = 0; cix < 3; cix++) winAt(g, -w / 2 + 1 + cix * (w - 2) / 2, 1.3 + r * 1.5, 1.52, 0.6, 0.8);
  return g;
};
houseAt(-9.2, -9.2, 6, 4.6, M.brickDk); houseAt(8.4, -9.6, 7, 5.4, M.brickDk);
// ===== rescue / home doorway (right side): wall, warm door, steps, fence =====
const doorGlowMat = new THREE.MeshBasicMaterial({ color: '#ffb45e', fog: false, transparent: true, opacity: 0 });
{
  const D = new THREE.Group(); world.add(D);
  add(tbox(3.8, 3.4, 0.6, 2), M.wallHouse, 5.45, 1.7, -2.5, D, { cast: false });
  add(tbox(4.1, 0.24, 0.9, 2), M.beamDark, 5.45, 3.5, -2.5, D, { cast: false });
  add(box(1.0, 2.15, 0.1), MW.darkIn, 4.95, 1.08, -2.18, D, { cast: false }); // door recess
  const dg = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 2.02), doorGlowMat);
  dg.position.set(4.95, 1.06, -2.12); dg.userData.ndSkip = true; D.add(dg);
  add(box(0.06, 2.02, 0.05), M.beamDark, 4.5, 1.06, -2.14, D, { cast: false });
  winAt(D, 6.9, 2.2, -2.18, 0.7, 0.9);
  add(box(1.5, 0.16, 0.8), M.concreteDk, 4.95, 0.08, -1.7, D, { cast: false }); // step
  for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.035, 0.045, 0.85, 6), M.beamDark, 3.9 + i * 0.55, 0.42, -1.35, D, { cast: false });
  add(box(2.4, 0.06, 0.05), M.beam, 5.0, 0.72, -1.35, D, { cast: false });
}
// boards (fade via worldAt flags, koko-style)
const boardHook = textBoard([['5 TRIPS INTO THE FIRE', 92]], 2.4, 1.0);
boardHook.position.set(-0.3, 1.58, -3.83); world.add(boardHook);
const boardCount = textBoard([['SHE COUNTED', 96], ['BY TOUCH', 96]], 1.4, 0.95);
boardCount.position.set(1.05, 0, -3.83); world.add(boardCount);
const boardFinale = textBoard([['12 MORE YEARS', 84], ['AT HOME', 96]], 2.0, 1.05);
boardFinale.position.set(7.0, 0, -2.14); world.add(boardFinale);
const boardGlint = FX.glint(0.5); boardGlint.position.set(0.55, 2.85, -3.6); boardGlint.userData.ndSkip = true; world.add(boardGlint);

// ---------- FX: garage fires + smoke + night clouds + ambience ----------
const fire1 = new FX.Fire(scene, { x: -1.5, y: 0.3, z: -4.9, scale: 1.7, rate: 0, light: true });
const fire2 = new FX.Fire(scene, { x: 0.1, y: 0.25, z: -5.3, scale: 1.15, rate: 0 });
fire1.pool.forEach((p) => { p.s.userData.ndSkip = true; }); fire2.pool.forEach((p) => { p.s.userData.ndSkip = true; });
if (fire1.light) fire1.light.userData = { ndSkip: true };
const smoke = new FX.Smoke(scene, 120); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const smokeEmit = smoke.addEmitter(-0.9, 3.4, -5.2, { rate: 0, color: 0x4a4a55, opacity: 0.42, scale: 1.7, grow: 2.2, life: 3.2, vy: 1.6, wind: 0.8 });
const dustEmit = smoke.addEmitter(0, 0.3, 0.5, { rate: 0.6, color: 0xd9c9a8, opacity: 0.12, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.4, wind: 0.5 });
const fxClouds = new FX.Clouds(scene, { count: 4, y: 46, opacity: 0.1, color: 0x8a97ad, drift: 0.3 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const amb = new FX.Ambience(scene, { mode: 'dust', count: 50, area: 26, height: 5, opacity: 0.16 });
amb.points.userData.ndSkip = true;
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fire1.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); fire2.pool.forEach((p) => { p.life = -1; p.s.visible = false; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF), hp = scarlettPosAt(fxF);
    fire1.rate = 30 * Ws.fireK; fire1.on = Ws.fireK > 0.03;
    fire2.rate = 22 * Ws.fireK; fire2.on = Ws.fireK > 0.03;
    smokeEmit.rate = pr.smokeRate * 7;
    dustEmit.rate = pr.dustRate * 2.4; dustEmit.x = hp[0]; dustEmit.z = hp[2] + 0.4;
    fire1.update(t, dt); fire2.update(t, dt);
    smoke.update(t, dt);
    fxClouds.update(t, dt);
    amb.update(t);
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
  setBoard(boardHook, Ws.boardHook || 0);
  setBoard(boardCount, Ws.boardCount || 0);
  setBoard(boardFinale, Ws.boardFinale || 0);
  boardGlint.material.opacity = Math.max(Ws.boardHook || 0, Ws.boardFinale || 0) * (0.5 + 0.3 * Math.sin(f * 0.33));
  doorGlowMat.opacity = (Ws.vetGlow || 0) * 0.85;
  winMats.forEach((m) => { m.opacity = 0.25 + 0.55 * (Ws.lampK || 0.5); });
  lamps.forEach((L, i) => {
    L.glow.material.opacity = (Ws.lampK || 0) * (0.4 + 0.08 * Math.sin(f * 0.9 + i * 2.3));
    L.pool.material.opacity = (Ws.lampK || 0) * 0.16;
  });
  if (fire1.light) fire1.light.visible = (Ws.fireK || 0) > 0.03;
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
