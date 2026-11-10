import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, lionPosAt } from './story.js';

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
  floorWood: texM(P.planks(11), 6, 6, '#b08a5e'),
  carpet: texM(P.weave(21, [150, 40, 48]), 3, 3),
  dirt: texM(P.dirt(7), 24, 24, '#c9a86a'),
  grassDry: texM(P.grass(6), 24, 24, '#bfa054'),
  wallCream: texM(P.plaster(8, 40), 3, 2, '#e8dcc2'),
  wallGreen: texM(P.plaster(13, 140), 3, 2, '#7d9a7a'),
};
const MW = {
  leaf: toon({ color: '#5d7a35' }), leafDk: toon({ color: '#47602a' }), trunk: toon({ color: '#6d5136' }),
  hill: toon({ color: '#c2a06a' }), darkIn: toon({ color: '#241d18' }),
  red: toon({ color: '#b03a30' }), white: toon({ color: '#eef2f6' }), gold: toon({ color: '#d9a441' }),
  lampGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,190,110', 0.85)), transparent: true, fog: false, depthWrite: false }),
  winGlow: new THREE.MeshBasicMaterial({ color: '#ffb45e', fog: false }),
  sofa: toon({ color: '#8c3b4a' }), sofaDk: toon({ color: '#6e2c38' }), tent: toon({ color: '#a8895a' }),
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

// ---------- worlds ----------
const world = new THREE.Group(); scene.add(world);
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const londonG = new THREE.Group(); world.add(londonG);
const savannaG = new THREE.Group(); world.add(savannaG);
flat(add(new THREE.CircleGeometry(46, 36), texM(P.plaster(12, 215), 20, 20, '#9aa0a8'), -8, -0.02, 8, londonG, { cast: false }));
flat(add(new THREE.CircleGeometry(90, 40), M.dirt, 24, -0.03, -6, savannaG, { cast: false }));
// distant savanna hills
{ for (const [hx, hy, hz, hr] of [[-30, -6, -70, 26], [20, -7, -78, 30], [70, -6, -55, 24], [85, -7, 10, 26]]) {
  const h = add(new THREE.SphereGeometry(hr, 16, 10), MW.hill, hx, hy, hz, savannaG, { cast: false }); h.scale.y = 0.42; } }

// text-board helper (canvas texture plane)
const textBoard = (lines, w, h, bg, fg, font = 900) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(18, 18, c.width - 36, c.height - 36);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(150, (c.width - 120) / Math.max(...lines.map((l) => l.length)) * 1.9);
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};

// --- (a) Harrods shop at (0,0,-6) ---
const shopG = new THREE.Group(); londonG.add(shopG);
{
  flat(add(new THREE.PlaneGeometry(15, 11), M.floorWood, 0, 0.01, -6, shopG, { cast: false }));
  add(tbox(15, 5.2, 0.3, 2), M.wallGreen, 0, 2.6, -11.2, shopG, { cast: false });
  for (const sd of [-1, 1]) add(tbox(0.3, 5.2, 11, 2), M.wallGreen, sd * 7.4, 2.6, -6, shopG, { cast: false });
  add(tbox(6.4, 1.05, 1.1, 2), M.beamDark, 0, 0.52, -8.6, shopG); // counter
  add(tbox(6.8, 0.09, 1.3, 2), M.beam, 0, 1.09, -8.6, shopG, { cast: false });
  for (let i = -2; i <= 2; i++) { // shelves with jars (glass glints)
    add(tbox(1.05, 2.6, 0.5, 2), M.beam, i * 1.35, 1.3, -10.8, shopG, { cast: false });
    for (let j = 0; j < 3; j++) { const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.34, 10), FX.glassMat(0xd8b46a, 0.4)); jar.position.set(i * 1.35 + (j - 1) * 0.3, 0.75 + j * 0.8, -10.75); jar.userData.ndSkip = true; shopG.add(jar); }
  }
  const sign = textBoard(['HARRODS'], 5.4, 1.15, '#1d4634', '#e8c45a'); sign.position.set(0, 4.1, -11.0); shopG.add(sign);
  const sub = textBoard(['LONDON  ·  1969'], 3.4, 0.6, '#1d4634', '#f2e3b0'); sub.position.set(0, 3.3, -11.0); shopG.add(sub);
  for (const lx of [-2.6, 0, 2.6]) { // hanging lamps
    add(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), M.beamDark, lx, 4.6, -6.5, shopG, { cast: false });
    const shadeM = add(new THREE.ConeGeometry(0.34, 0.3, 12), MW.gold, lx, 4.0, -6.5, shopG, { cast: false });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffc37a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.1); glow.position.set(lx, 3.85, -6.5); glow.userData.ndSkip = true; shopG.add(glow);
  }
}
// --- (b) Chelsea flat at (-16,0,4) + its door ---
const flatG = new THREE.Group(); londonG.add(flatG);
const winMats = [];
{
  flat(add(new THREE.PlaneGeometry(11, 9), M.carpet, -16, 0.01, 4, flatG, { cast: false }));
  add(tbox(11, 4.2, 0.3, 2), M.wallCream, -16, 2.1, -0.2, flatG, { cast: false });
  const wm = MW.winGlow.clone(); winMats.push(wm);
  const wp = add(new THREE.PlaneGeometry(1.7, 2.0), wm, -17.6, 2.2, -0.03, flatG, { cast: false }); wp.userData.ndSkip = true;
  add(box(1.9, 0.08, 0.06), M.beamDark, -17.6, 3.25, 0.0, flatG, { cast: false });
  add(box(1.9, 0.08, 0.06), M.beamDark, -17.6, 1.15, 0.0, flatG, { cast: false });
  // sofa
  add(tbox(2.6, 0.55, 1.05, 2), MW.sofa, -16.6, 0.42, 1.2, flatG);
  add(tbox(2.6, 0.85, 0.28, 2), MW.sofaDk, -16.6, 0.95, 0.78, flatG);
  for (const sd of [-1, 1]) add(tbox(0.3, 0.5, 1.05, 2), MW.sofaDk, -16.6 + sd * 1.32, 0.72, 1.2, flatG, { cast: false });
  add(tbox(1.1, 0.3, 0.55, 2), M.beam, -14.2, 0.15, 1.4, flatG, { cast: false }); // coffee table
  // THE door (size-gag frame) — posts + lintel at DOOR_POS, opening faces camera (+z side)
  add(tbox(0.18, 2.6, 0.3, 2), M.beamDark, -14.35, 1.3, 4.4, flatG);
  add(tbox(0.18, 2.6, 0.3, 2), M.beamDark, -12.45, 1.3, 4.4, flatG);
  add(tbox(2.1, 0.2, 0.32, 2), M.beamDark, -13.4, 2.68, 4.4, flatG);
  add(tbox(3.4, 4.2, 0.25, 2), M.wallCream, -10.6, 2.1, 4.4, flatG, { cast: false });
  add(tbox(3.4, 4.2, 0.25, 2), M.wallCream, -18.9, 2.1, 4.4, flatG, { cast: false });
  add(tbox(4.6, 1.55, 0.25, 2), M.wallCream, -13.4, 3.42, 4.4, flatG, { cast: false }); // wall above the door
}
// --- (c) furniture shop at (-16,0,18) ---
const furnG = new THREE.Group(); londonG.add(furnG);
{
  flat(add(new THREE.PlaneGeometry(13, 10), M.floorWood, -16, 0.01, 18, furnG, { cast: false }));
  add(tbox(13, 4.6, 0.3, 2), M.wallGreen, -16, 2.3, 12.8, furnG, { cast: false });
  const tableAt = (x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; furnG.add(g);
    add(tbox(1.7, 0.08, 1.0, 2), M.beam, 0, 0.74, 0, g, { cast: false });
    for (const [sx, sz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.74, 7), M.beamDark, sx, 0.37, sz, g, { cast: false }); return g; };
  tableAt(-18.3, 16.2, 0.3); tableAt(-11.9, 21.4, -0.2); tableAt(-19.5, 20.5, 0.9);
  const chairAt = (x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; furnG.add(g);
    add(tbox(0.55, 0.07, 0.55, 2), M.beam, 0, 0.46, 0, g, { cast: false }); add(tbox(0.55, 0.7, 0.07, 2), M.beam, 0, 0.85, -0.25, g, { cast: false });
    for (const [sx, sz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.46, 6), M.beamDark, sx, 0.23, sz, g, { cast: false }); return g; };
  chairAt(-17.2, 15.4, 2.6); chairAt(-19.8, 17.8, -0.7); chairAt(-18.9, 19.2, 1.4); chairAt(-13.2, 16.0, 3.4);
  for (const [lx, lz] of [[-20.5, 14.6], [-11.8, 21.0]]) { // floor lamps with glass shades
    add(new THREE.CylinderGeometry(0.035, 0.05, 1.55, 7), M.beamDark, lx, 0.78, lz, furnG, { cast: false });
    const sh = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.34, 12, 1, true), FX.glassMat(0xffd9a0, 0.5)); sh.position.set(lx, 1.66, lz); sh.userData.ndSkip = true; furnG.add(sh);
  }
  const sign = textBoard(['FURNITURE'], 4.2, 0.8, '#4a3421', '#f2e3b0'); sign.position.set(-17.3, 3.6, 12.95); furnG.add(sign);
}
// --- (d) Kenya savanna: acacias, camp, grass ---
const acaciaAt = (x, z, h = 5, parent = savannaG) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const trunk = add(new THREE.CylinderGeometry(0.13, 0.22, h * 0.62, 7), MW.trunk, 0, h * 0.31, 0, g, { cast: false }); trunk.rotation.z = 0.09;
  for (const [ox, oz, r] of [[0, 0, h * 0.52], [h * 0.3, h * 0.12, h * 0.34], [-h * 0.28, -h * 0.1, h * 0.3]]) {
    const c = add(new THREE.ConeGeometry(r, h * 0.16, 10), MW.leaf, ox, h * 0.66, oz, g, { cast: false }); c.scale.y = 0.55;
  }
  return g;
};
acaciaAt(13, -19, 6); acaciaAt(27, -20, 5.2); acaciaAt(30, -8, 6.4); acaciaAt(11, -9, 4.6); acaciaAt(26, 9, 5.6); acaciaAt(12.5, 8.5, 5);
acaciaAt(33, -16, 4.4); acaciaAt(8, -22, 5.4);
// Adamson's camp at (20,0,-16): tent + crates + barrels
{
  const g = new THREE.Group(); g.position.set(21.5, 0, -19.5); g.rotation.y = 0.4; savannaG.add(g);
  const tent = add(new THREE.ConeGeometry(2.0, 2.2, 4), MW.tent, 0, 1.1, 0, g); tent.rotation.y = Math.PI / 4; tent.scale.z = 1.35;
  add(box(0.9, 1.1, 0.06), MW.darkIn, 0, 0.55, 1.32, g, { cast: false });
  const cr = FX.crate(0.8); cr.position.set(-2.2, 0.4, 0.8); ndSkip(cr); g.add(cr);
  const ba = FX.barrel(0.42, 1.0); ba.position.set(2.3, 0.5, 0.6); ndSkip(ba); g.add(ba);
}
// grass tufts (sway in worldState)
const grassTufts = [];
{ const r = P.rng(61);
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, d = 4 + r() * 42, x = 22 + Math.cos(a) * d, z = -5 + Math.sin(a) * d;
    if (Math.hypot(x - 19.5, z - 3) < 3.4 || Math.hypot(x - 20, z + 16) < 3.2 || (x > 12 && x < 18 && z > -7 && z < 7)) continue;
    const g = new THREE.Group(); g.position.set(x, 0, z); savannaG.add(g);
    const n = 3 + (r() * 3 | 0);
    for (let j = 0; j < n; j++) { const blade = add(new THREE.ConeGeometry(0.07, 0.34 + r() * 0.3, 5), j % 2 ? MW.leaf : toon({ color: '#a8893f' }), (r() - 0.5) * 0.3, 0.22, (r() - 0.5) * 0.3, g, { cast: false }); blade.rotation.z = (r() - 0.5) * 0.5; }
    g.userData.ph = r() * 6.28; grassTufts.push(g);
  }
}
// --- (e) finale board in the clearing ---
const finaleBoard = new THREE.Group(); finaleBoard.position.set(21.9, 0, 0.2); finaleBoard.rotation.y = 0.3; savannaG.add(finaleBoard);
{
  for (const sd of [-1.0, 1.0]) add(new THREE.CylinderGeometry(0.07, 0.09, 2.5, 7), M.beamDark, sd, 1.25, 0, finaleBoard, { cast: false });
  add(tbox(2.5, 1.7, 0.1, 2), M.beam, 0, 1.75, 0, finaleBoard, { cast: false });
}
const finaleSign = textBoard(['HE NEVER', 'FORGOT THEM.'], 1.8, 1.3, '#4a3421', '#ffe9a8');
finaleSign.position.set(0, 1.75, 0.07); finaleBoard.add(finaleSign);
const boardGlint = FX.glint(0.5); boardGlint.position.set(22.8, 2.6, 0.9); boardGlint.material.opacity = 0; boardGlint.userData.ndSkip = true; savannaG.add(boardGlint);

// ---------- FX: savanna dust (Smoke, warm tint) + clouds + low dust band ----------
const smoke = new FX.Smoke(scene, 120); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(19.5, 0.3, 2, { rate: 2, color: 0xd9b87a, opacity: 0.16, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.55, wind: 0.7 });
const campEmit = smoke.addEmitter(21.5, 0.3, -18, { rate: 1.5, color: 0xd9b87a, opacity: 0.13, scale: 0.5, grow: 1.2, life: 2.6, vy: 0.5, wind: 0.7 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 55, opacity: 0.2, color: 0xf2e3c2, drift: 0.35 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const mist = FX.mistBand(scene, { count: 7, y: 0.7, opacity: 0.22 });
mist.children.forEach((s, i) => {
  s.position.set(14 + (i % 3) * 4, 0.55 + (i % 3) * 0.18, -14 + i * 3.4);
  s.scale.set(9 + (i % 3) * 3, 2.0, 1);
  s.material.color.set(0xe8cf9e);
  s.userData.bx = s.position.x; s.userData.ndSkip = true;
});
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), lp = lionPosAt(fxF);
    dustEmit.rate = pr.smokeRate; campEmit.rate = pr.smokeRate * 0.5;
    if (lp) { dustEmit.x = lp[0]; dustEmit.z = lp[2]; }
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

// ---------- render targets & post (same ink/dof contract as balto) ----------
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
const WIN_DIM = new THREE.Color('#4a3a2c'), WIN_LIT = new THREE.Color('#ffb45e');
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
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
  const london = Ws.shot === 'hook' || Ws.shot === 'flat' || Ws.shot === 'furniture' || Ws.shot === 'toobig';
  londonG.visible = london; savannaG.visible = !london;
  shopG.visible = Ws.shot === 'hook';
  flatG.visible = Ws.shot === 'flat' || Ws.shot === 'toobig';
  furnG.visible = Ws.shot === 'furniture';
  mist.children.forEach((s, i) => {
    s.visible = !london;
    s.position.x = s.userData.bx + Math.sin(f * 0.008 + i * 1.7) * 0.9;
    s.material.opacity = 0.35 * Ws.dust * (0.75 + 0.25 * Math.sin(f * 0.013 + i * 2.1));
  });
  smoke.pool.forEach((p) => { if (p.s) p.s.visible = p.life >= 0 && !london ? p.s.visible : (p.life >= 0 && p.s.visible); });
  winMats.forEach((m) => { m.color.copy(WIN_DIM).lerp(WIN_LIT, Ws.winGlow); });
  grassTufts.forEach((g) => { g.rotation.z = Math.sin(f * 0.06 + g.userData.ph) * 0.07 * (Ws.grassK || 0.5) * (1 + (Ws.windK || 0)); });
  finaleSign.material.opacity = Ws.boardT || 0;
  finaleSign.visible = (Ws.boardT || 0) > 0.01;
  boardGlint.material.opacity = (Ws.boardT || 0) * (0.6 + 0.35 * Math.sin(f * 0.33));
  waterU.t.value = f / 30;
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
