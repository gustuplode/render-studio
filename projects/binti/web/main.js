import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, kokoPosAt } from './story.js';

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
  stone: texM(P.stone(4), 1, 1),
  dirt: texM(P.dirt(7), 10, 10, '#c9b088'),
  grass: texM(P.grass(6), 26, 26, '#9db06a'),
  grassDk: texM(P.grass(16), 8, 8, '#7d9450'),
  wallRock: texM(P.stone(14, 30, 10, 58), 6, 2, '#b0a898'),
  blanket: texM(P.weave(21, [348, 45, 52]), 2, 2), // weave base is HSL: warm rose
  concrete: texM(P.stone(18, 40, 6, 52), 8, 8, '#cac2b2'),
  deckWood: texM(P.planks(9), 6, 2, '#b08a5a'),
};
const MW = {
  leaf: toon({ color: '#5d7a35' }), leafDk: toon({ color: '#47602a' }), leafLt: toon({ color: '#75934a' }),
  trunk: toon({ color: '#6d5136' }), trunkDk: toon({ color: '#54402a' }),
  red: toon({ color: '#b03a30' }), white: toon({ color: '#eef2f6' }), gold: toon({ color: '#d9a441' }),
  rope: toon({ color: '#a8895a' }), tyre: toon({ color: '#2e2c30' }),
  gift: toon({ color: '#7a4a8c' }), giftRib: toon({ color: '#e8c45a' }),
  shade: new THREE.MeshBasicMaterial({ color: 0x2e4420, transparent: true, opacity: 0.22, depthWrite: false }),
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

// ---------- the enclosure (single set, whole video): Brookfield Zoo gorilla pit ----------
// Pit floor y=0 (concrete) at centre; grass surround; rock back wall NORTH z=-7 with the
// keepers' door at x=-4.6; visitor deck SOUTH raised to y=1.6 behind a railing at z=5.4.
const world = new THREE.Group(); scene.add(world);
{
  // layered ground: grass base + concrete pit + dirt patches + canopy shade
  flat(add(new THREE.CircleGeometry(60, 40), M.grass, 0, -0.03, -4, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(7.4, 30), M.concrete, 0, -0.012, -0.6, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(2.4, 20), M.dirt, -2.8, -0.006, 1.9, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(1.9, 20), M.dirt, 3.4, -0.006, -3.1, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(3.2, 20), M.grassDk, -6.5, -0.02, -5, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(2.6, 20), M.grassDk, 6.8, -0.02, -4.4, world, { cast: false }));
  for (const [sx, sz, sr] of [[-3.4, -3.2, 2.6], [3.8, -3.6, 2.8], [0.5, -6.5, 3.4]]) {
    const sh = flat(add(new THREE.CircleGeometry(sr, 20), MW.shade, sx, 0.005, sz, world, { cast: false }));
    sh.userData.ndSkip = true; sh.renderOrder = 1;
  }
  // scattered leaves on the pit edge
  const leafR = P.rng(87);
  for (let i = 0; i < 40; i++) {
    const a = leafR() * Math.PI * 2, d = 4.5 + leafR() * 3.4;
    const lf = flat(add(new THREE.CircleGeometry(0.05 + leafR() * 0.05, 6), i % 3 ? MW.leafDk : MW.leafLt, Math.cos(a) * d, 0.008, -0.6 + Math.sin(a) * d * 0.8, world, { cast: false }));
    lf.userData.ndSkip = true;
  }
  // rock back wall (north) + side rocks; strata ledges on the back wall
  add(tbox(26, 3.4, 1.1, 2), M.wallRock, 0, 1.7, -7.05, world, { cast: false });
  add(tbox(18, 0.32, 0.5, 2), M.stone, -1, 2.55, -6.55, world, { cast: false });
  add(tbox(12, 0.26, 0.42, 2), M.stone, 3, 1.15, -6.6, world, { cast: false });
  add(tbox(1.1, 2.2, 16, 2), M.wallRock, -10.5, 1.05, -3, world, { cast: false });
  add(tbox(1.1, 2.2, 16, 2), M.wallRock, 10.5, 1.05, -3, world, { cast: false });
  for (const [rx2, rz, rs] of [[-7.6, -6.0, 0.9], [8.1, -6.2, 1.15], [-8.8, -4.0, 0.6], [9.0, -3.0, 0.7], [6.4, 2.8, 0.55], [-6.9, 3.1, 0.62]]) {
    const r = add(new THREE.SphereGeometry(rs, 10, 8), M.stone, rx2, rs * 0.4, rz, world, { cast: false }); r.scale.y = 0.72;
  }
  // ---- keepers' door in the back wall (x=-4.6): frame, hinged slab, handle, hinges ----
  const dg = new THREE.Group(); dg.position.set(-4.6, 0, -6.48); world.add(dg);
  add(tbox(1.3, 0.14, 0.18, 2), M.beamDark, 0, 2.42, 0, dg, { cast: false });
  for (const sd of [-1, 1]) add(tbox(0.14, 2.5, 0.18, 2), M.beamDark, sd * 0.58, 1.25, 0, dg, { cast: false });
  add(tbox(1.3, 0.1, 0.3, 2), M.stone, 0, 0.05, 0.1, dg, { cast: false }); // threshold step
  const hinge = new THREE.Group(); hinge.position.set(-0.52, 0, 0.02); dg.add(hinge);
  const slab = add(tbox(1.04, 2.34, 0.07, 2), M.beam, 0.52, 1.22, 0, hinge);
  slab.userData.isDoor = true;
  for (const hy of [0.45, 1.95]) add(box(0.1, 0.16, 0.1), MW.tyre, -0.03, hy, 0.03, hinge, { cast: false }); // hinges
  const knob = add(new THREE.SphereGeometry(0.055, 10, 8), MW.gold, 0.92, 1.22, 0.08, hinge, { cast: false });
  world.userData.doorHinge = hinge;
  // ---- visitor deck SOUTH: raised platform (top y=1.6) + railing + glass ----
  add(tbox(11, 1.6, 3.2, 2), M.deckWood, 0.3, 0.8, 7.05, world, { cast: false });
  add(tbox(11, 0.18, 0.24, 2), M.stone, 0.3, 1.51, 5.5, world, { cast: false }); // deck front lip
  for (let i = 0; i <= 9; i++) add(new THREE.CylinderGeometry(0.045, 0.045, 1.05, 7), M.beamDark, -4.3 + i * 1.15, 2.12, 5.42, world, { cast: false }); // railing posts
  add(tbox(10.6, 0.09, 0.09, 2), M.beamDark, 0.3, 2.66, 5.42, world, { cast: false }); // top rail
  add(tbox(10.6, 0.06, 0.06, 2), M.beamDark, 0.3, 2.14, 5.42, world, { cast: false }); // mid rail
}
// trees + rope & tyre swing + platform
const treeAt = (x, z, h = 5.4, lean = 0.06) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  const trunk = add(new THREE.CylinderGeometry(0.17, 0.3, h * 0.66, 8), MW.trunk, 0, h * 0.33, 0, g, { cast: false }); trunk.rotation.z = lean;
  const branch = add(new THREE.CylinderGeometry(0.09, 0.13, h * 0.44, 7), MW.trunkDk, h * 0.16, h * 0.72, 0, g, { cast: false }); branch.rotation.z = 1.15;
  for (const [ox, oz, r, m] of [[0, 0, h * 0.52, MW.leaf], [h * 0.3, h * 0.1, h * 0.36, MW.leafDk], [-h * 0.3, -h * 0.08, h * 0.33, MW.leaf], [h * 0.05, -h * 0.28, h * 0.3, MW.leafLt]]) {
    const c = add(new THREE.SphereGeometry(r, 12, 9), m, ox, h * 0.86, oz, g, { cast: false }); c.scale.y = 0.55;
  }
  return g;
};
treeAt(6.9, -4.6, 6.1, -0.05); treeAt(-7.6, -5.4, 5.2); treeAt(8.6, -0.8, 4.8); treeAt(-8.8, 1.2, 4.6); treeAt(7.9, 3.4, 4.4);
{ // rope + tyre swing hanging from the right tree's branch zone
  const g = new THREE.Group(); g.position.set(5.9, 0, -3.1); world.add(g);
  add(new THREE.CylinderGeometry(0.028, 0.028, 2.5, 6), MW.rope, 0, 3.1, 0, g, { cast: false });
  const tyre = add(new THREE.TorusGeometry(0.34, 0.11, 10, 20), MW.tyre, 0, 1.72, 0, g, { cast: false }); tyre.rotation.x = Math.PI / 2;
  g.userData.swing = true; world.userData.swing = g;
}
{ // wooden platform (climbing deck) behind-left
  const g = new THREE.Group(); g.position.set(-6.9, 0, -3.3); g.rotation.y = 0.15; world.add(g);
  add(tbox(2.6, 0.14, 1.7, 2), M.plank, 0, 0.92, 0, g);
  for (const [sx, sz] of [[-1.15, -0.7], [1.15, -0.7], [-1.15, 0.7], [1.15, 0.7]]) add(new THREE.CylinderGeometry(0.07, 0.08, 0.92, 7), MW.trunkDk, sx, 0.46, sz, g, { cast: false });
  add(tbox(2.6, 0.09, 0.24, 2), MW.trunkDk, 0, 1.32, -0.82, g, { cast: false });
  for (const sx of [-1.15, 1.15]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), MW.trunkDk, sx, 1.1, -0.82, g, { cast: false });
  const ball = add(new THREE.SphereGeometry(0.17, 12, 10), MW.red, 0.7, 1.16, 0.2, g, { cast: false }); ball.userData.ndSkip = false;
}
// foreground / midground props: enrichment — logs, bowl, balls, rope pile
{
  const log1 = add(new THREE.CylinderGeometry(0.16, 0.18, 2.2, 9), MW.trunk, -3.1, 0.17, 2.6, world, { cast: false }); log1.rotation.z = Math.PI / 2; log1.rotation.y = 0.4;
  const log2 = add(new THREE.CylinderGeometry(0.13, 0.15, 1.6, 9), MW.trunkDk, 3.9, 0.14, 1.8, world, { cast: false }); log2.rotation.z = Math.PI / 2; log2.rotation.y = -0.7;
  const bowl = add(new THREE.CylinderGeometry(0.3, 0.2, 0.16, 14, 1, true), toon({ color: '#8a4a3a', side: THREE.DoubleSide }), 2.9, 0.08, -0.9, world, { cast: false }); bowl.userData.ndSkip = true;
  add(new THREE.SphereGeometry(0.15, 10, 8), toon({ color: '#d9a441' }), -2.3, 0.15, -0.9, world, { cast: false }); // toy ball
  add(new THREE.SphereGeometry(0.19, 10, 8), MW.red, 1.9, 0.19, 2.9, world, { cast: false });
  for (const [bx, bz, bc] of [[-2.9, 1.9, '#b03a30'], [-2.62, 1.98, '#d9a441'], [2.9, 2.3, '#4a6a9a']]) add(tbox(0.22, 0.22, 0.22, 2), toon({ color: bc }), bx, 0.11, bz, world, { cast: false });
  const rope = add(new THREE.TorusGeometry(0.3, 0.07, 8, 18), MW.rope, -1.9, 0.07, -2.6, world, { cast: false }); rope.rotation.x = Math.PI / 2;
}
// glass on the visitor railing (south) + glint
const glassMat = FX.glassMat(0xcfe4ee, 0.14);
const railGlass = add(new THREE.PlaneGeometry(10.4, 0.5), glassMat, 0.3, 1.87, 5.44, world, { cast: false });
railGlass.userData.ndSkip = true;
const glassGlint = FX.glint(0.7); glassGlint.position.set(-1.5, 2.3, 5.6); glassGlint.userData.ndSkip = true; world.add(glassGlint);
// ---- boards: three easels (posts stand WIDE of every board so no post crosses text) ----
const mkEasel = (x, z, ry, w) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.055, 0.07, 2.2, 7), M.beamDark, sd * (w / 2 + 0.14), 1.1, -0.06, g, { cast: false });
  add(tbox(w + 0.42, 0.1, 0.08, 2), M.beam, 0, 2.22, -0.06, g, { cast: false });
  return g;
};
const nameEasel = mkEasel(0.15, -4.9, 0, 1.5);
const boardName = textBoard(['BINTI JUA'], 1.5, 0.92, '#4a3421', '#ffe9a8'); boardName.position.set(0, 1.34, 0); nameEasel.add(boardName);
const carryEasel = mkEasel(-3.9, -6.0, 0.1, 1.7);
const boardCarry = textBoard(['SHE CARRIED HIM', 'TO THE DOOR'], 1.62, 0.95, '#37455c', '#e8eef8'); boardCarry.position.set(0, 1.34, 0); carryEasel.add(boardCarry);
const finaleEasel = mkEasel(3.55, -4.6, -0.3, 1.3);
const boardFinale = textBoard(['THE BOY', 'RECOVERED'], 1.3, 0.85, '#5a2e3e', '#ffd9e2'); boardFinale.position.set(0, 1.34, 0); finaleEasel.add(boardFinale);
const boardGlint = FX.glint(0.45); boardGlint.position.set(0.8, 2.15, -4.55); boardGlint.userData.ndSkip = true; world.add(boardGlint);
// grass tufts (sway via worldAt grassK)
const grassTufts = [];
{ const r = P.rng(61);
  for (let i = 0; i < 110; i++) {
    const a = r() * Math.PI * 2, d = 3.4 + r() * 9, x = Math.cos(a) * d, z = -1 + Math.sin(a) * d;
    if (Math.hypot(x, z + 0.6) < 6.4 || z > 4.6 || (Math.abs(x + 4.6) < 1.6 && z < -5.2)) continue;
    const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
    const n = 3 + (r() * 3 | 0);
    for (let j = 0; j < n; j++) { const blade = add(new THREE.ConeGeometry(0.06, 0.3 + r() * 0.28, 5), j % 2 ? MW.leaf : MW.leafLt, (r() - 0.5) * 0.3, 0.2, (r() - 0.5) * 0.3, g, { cast: false }); blade.rotation.z = (r() - 0.5) * 0.5; }
    g.userData.ph = r() * 6.28; grassTufts.push(g);
  }
}

// ---------- FX: warm dust motes (Smoke, very low opacity) + clouds ----------
const smoke = new FX.Smoke(scene, 110); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(0, 0.4, 0.5, { rate: 1.2, color: 0xe8d9a8, opacity: 0.13, scale: 0.45, grow: 1.2, life: 2.6, vy: 0.4, wind: 0.5 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 55, opacity: 0.22, color: 0xf2ead2, drift: 0.35 });
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), kp = kokoPosAt(fxF);
    dustEmit.rate = pr.smokeRate; dustEmit.x = kp[0]; dustEmit.z = kp[2] + 0.5;
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
  setB(boardName, Ws.boardName || 0); setB(boardCarry, Ws.boardCarry || 0); setB(boardFinale, Ws.boardFinale || 0);
  boardGlint.material.opacity = Math.max(Ws.boardName || 0, Ws.boardCarry || 0, Ws.boardFinale || 0) * (0.5 + 0.3 * Math.sin(f * 0.33));
  if (world.userData.doorHinge) world.userData.doorHinge.rotation.y = -1.85 * (Ws.doorT || 0);
  glassMat.opacity = 0.09 + 0.09 * (Ws.glassT || 0);
  glassGlint.material.opacity = (Ws.glassT || 0) * (0.45 + 0.3 * Math.sin(f * 0.21));
  glassGlint.position.x = -1.5 + Math.sin(f * 0.011) * 1.6;
  if (world.userData.swing) world.userData.swing.rotation.x = Math.sin(f * 0.03) * 0.05 * (Ws.windK || 0.5);
  grassTufts.forEach((g) => { g.rotation.z = Math.sin(f * 0.06 + g.userData.ph) * 0.07 * (Ws.grassK || 0.5) * (1 + (Ws.windK || 0)); });
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
    if (a.blob !== false && (a.y - (a.ground ?? 0)) < 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
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
