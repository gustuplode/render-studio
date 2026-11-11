import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, owenPosAt } from './story.js';

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
  sand: texM(P.dirt(7), 24, 24, '#e0c48a'),
  dirt: texM(P.dirt(7), 24, 24, '#c9a86a'),
  grassDry: texM(P.grass(6), 24, 24, '#bfa054'),
  grassGreen: texM(P.grass(9), 24, 24, '#8a9a58'),
};
const MW = {
  leaf: toon({ color: '#5d7a35' }), leafDk: toon({ color: '#47602a' }), trunk: toon({ color: '#6d5136' }),
  hill: toon({ color: '#c2a06a' }), white: toon({ color: '#eef2f6' }), red: toon({ color: '#b03a30' }),
  boatWood: toon({ color: '#7a4b2a' }), sail: toon({ color: '#f2ead2' }),
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

// ---------- worlds ----------
const world = new THREE.Group(); scene.add(world);
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#1d4e66') }, shal: { value: new THREE.Color('#3a7d99') }, glint: { value: new THREE.Color('#ffe9c0') } };
const coastG = new THREE.Group(); world.add(coastG);
const parkG = new THREE.Group(); world.add(parkG);

// text-board helper (canvas texture plane)
const textBoard = (lines, w, h, bg, fg, font = 900) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(18, 18, c.width - 36, c.height - 36);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(118, (c.width - 120) / Math.max(...lines.map((l) => l.length)) * 1.55);
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};

// --- COAST: sand shore (z>0) + sea (z<0) + giant wave + fishing boat ---
flat(add(new THREE.PlaneGeometry(90, 26), M.sand, 0, 0.0, 14, coastG, { cast: false }));
flat(add(new THREE.PlaneGeometry(90, 5), texM(P.dirt(8), 24, 2, '#b89a62'), 0, -0.04, -0.5, coastG, { cast: false })); // wet-sand strip at the waterline
flat(add(new THREE.PlaneGeometry(140, 64), toon({ color: '#14425e' }), 0, -0.55, -34, coastG, { cast: false })); // deep base under water
const sea = FX.makeWater({ size: 64, seg: 48, deep: 0x1d4e66, shallow: 0x3a7d99, sky: 0xbfe3f2, amp: 0.5 });
sea.position.set(0, -0.18, -34); sea.userData.ndSkip = true; coastG.add(sea);
// the GIANT WAVE: curved water wall that rises and leans toward shore
const waveGeo = new THREE.PlaneGeometry(38, 13, 24, 8);
{ const pos = waveGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const k = (y + 6.5) / 13; pos.setZ(i, k * k * 2.6); }
  waveGeo.computeVertexNormals(); }
const waveMat = new THREE.MeshToonMaterial({ gradientMap: grad, color: '#1d6a8f', transparent: true, opacity: 0.3, side: THREE.DoubleSide });
const wave = new THREE.Mesh(waveGeo, waveMat); wave.position.set(0, -4, -8); wave.rotation.x = -0.1; wave.userData.ndSkip = true; coastG.add(wave);
const waveFoam = add(new THREE.PlaneGeometry(38, 0.9), new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.85, fog: true }), 0, 6.3, 2.5, wave, { cast: false });
waveFoam.userData.ndSkip = true;
// fishing boat
{
  const g = new THREE.Group(); g.position.set(-5.5, 0.1, -7); g.rotation.y = 0.5; coastG.add(g);
  add(tbox(3.4, 0.7, 1.3, 2), MW.boatWood, 0, 0.35, 0, g);
  add(tbox(3.7, 0.18, 1.5, 2), M.beamDark, 0, 0.78, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 7), M.beamDark, 0, 1.9, 0, g, { cast: false });
  const sailShape = new THREE.Shape(); sailShape.moveTo(0, 0); sailShape.lineTo(0, 2.2); sailShape.lineTo(1.5, 0.25); sailShape.lineTo(0, 0);
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), MW.sail); sail.position.set(0.06, 0.85, 0); g.add(sail);
  const cr = FX.crate(0.7); cr.position.set(4.6, 0.35, 3.5); ndSkip(cr); coastG.add(cr);
  const ba = FX.barrel(0.4, 0.95); ba.position.set(5.6, 0.48, 4.4); ndSkip(ba); coastG.add(ba);
}
// shoreline rocks + palm
for (const [px, pz, s] of [[-9, 2.5, 1.1], [10, 3.5, 0.8], [7.5, -0.5, 0.55]]) {
  const r = add(new THREE.SphereGeometry(s, 10, 8), toon({ color: '#8a8578' }), px, s * 0.3, pz, coastG, { cast: false }); r.scale.y = 0.62;
}
{ const g = new THREE.Group(); g.position.set(8.5, 0, 6); coastG.add(g);
  const tr = add(new THREE.CylinderGeometry(0.14, 0.22, 4.6, 7), MW.trunk, 0, 2.3, 0, g, { cast: false }); tr.rotation.z = -0.14;
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const fr = add(new THREE.ConeGeometry(0.5, 3.2, 6), MW.leaf, Math.cos(a) * 1.1, 4.9, Math.sin(a) * 1.1, g, { cast: false }); fr.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15 + Math.PI / 2); fr.scale.y = 1; }
}

// --- HALLER PARK: grass clearing + acacias + pond + finale board ---
flat(add(new THREE.CircleGeometry(95, 40), M.dirt, 28, -0.03, 0, parkG, { cast: false }));
flat(add(new THREE.CircleGeometry(30, 32), M.grassGreen, 28, -0.01, 1, parkG, { cast: false }));
{ for (const [hx, hy, hz, hr] of [[-20, -6, -60, 26], [30, -7, -70, 30], [80, -6, -45, 24], [90, -7, 20, 26]]) {
  const h = add(new THREE.SphereGeometry(hr, 16, 10), MW.hill, hx, hy, hz, parkG, { cast: false }); h.scale.y = 0.42; } }
const acaciaAt = (x, z, h = 5, parent = parkG) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const trunk = add(new THREE.CylinderGeometry(0.13, 0.22, h * 0.62, 7), MW.trunk, 0, h * 0.31, 0, g, { cast: false }); trunk.rotation.z = 0.09;
  for (const [ox, oz, r] of [[0, 0, h * 0.52], [h * 0.3, h * 0.12, h * 0.34], [-h * 0.28, -h * 0.1, h * 0.3]]) {
    const c = add(new THREE.ConeGeometry(r, h * 0.16, 10), MW.leaf, ox, h * 0.66, oz, g, { cast: false }); c.scale.y = 0.55;
  }
  return g;
};
acaciaAt(20, -7, 6); acaciaAt(37, -6, 5.2); acaciaAt(38, 8, 6.4); acaciaAt(19, 10, 4.8); acaciaAt(33, -11, 5.4); acaciaAt(16, -3, 4.4);
// park entrance sign
{
  const g = new THREE.Group(); g.position.set(21.5, 0, -4.5); g.rotation.y = 0.5; parkG.add(g);
  for (const sd of [-0.8, 0.8]) add(new THREE.CylinderGeometry(0.06, 0.08, 2.0, 7), M.beamDark, sd, 1.0, 0, g, { cast: false });
  add(tbox(2.1, 1.0, 0.09, 2), M.beam, 0, 1.55, 0, g, { cast: false });
  const s = textBoard(['HALLER PARK'], 1.7, 0.62, '#4a5a2e', '#ffe9a8'); s.position.set(0, 1.55, 0.06); g.add(s);
}
// pond: sandy rim + FX water disc
flat(add(new THREE.CircleGeometry(3.6, 26), M.sand, 24.5, 0.01, 5.5, parkG, { cast: false }));
const pond = FX.makeWater({ size: 4.4, seg: 28, deep: 0x1d4e66, shallow: 0x4a90a8, sky: 0xbfe3f2, amp: 0.12 });
pond.position.set(24.5, 0.1, 5.5); pond.userData.ndSkip = true; parkG.add(pond);
for (const [px, pz] of [[21.2, 3.4], [27.8, 7.6], [22.4, 8.2]]) {
  const r = add(new THREE.SphereGeometry(0.4, 9, 7), toon({ color: '#8a8578' }), px, 0.12, pz, parkG, { cast: false }); r.scale.y = 0.6;
}
// grass tufts (sway in worldState)
const grassTufts = [];
{ const r = P.rng(61);
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, d = 4 + r() * 34, x = 28 + Math.cos(a) * d, z = 1 + Math.sin(a) * d;
    if (Math.hypot(x - 29, z - 0.8) < 3.6 || Math.hypot(x - 24.5, z - 5.5) < 4.0) continue;
    const g = new THREE.Group(); g.position.set(x, 0, z); parkG.add(g);
    const n = 3 + (r() * 3 | 0);
    for (let j = 0; j < n; j++) { const blade = add(new THREE.ConeGeometry(0.07, 0.34 + r() * 0.3, 5), j % 2 ? MW.leaf : toon({ color: '#a8893f' }), (r() - 0.5) * 0.3, 0.22, (r() - 0.5) * 0.3, g, { cast: false }); blade.rotation.z = (r() - 0.5) * 0.5; }
    g.userData.ph = r() * 6.28; grassTufts.push(g);
  }
}
// finale board in the clearing, behind the pair (grows out of the mother scene)
const finaleBoard = new THREE.Group(); finaleBoard.position.set(34.2, 0, -2.6); finaleBoard.rotation.y = -0.45; parkG.add(finaleBoard);
{
  for (const sd of [-1.35, 1.35]) add(new THREE.CylinderGeometry(0.07, 0.09, 2.7, 7), M.beamDark, sd, 1.35, 0, finaleBoard, { cast: false });
  add(tbox(3.0, 2.0, 0.1, 2), M.beam, 0, 1.85, 0, finaleBoard, { cast: false });
}
const finaleSign = textBoard(['A MOTHER,', 'OF A DIFFERENT', 'KIND.'], 2.55, 1.55, '#4a3421', '#ffe9a8');
finaleSign.position.set(0, 1.85, 0.07); finaleBoard.add(finaleSign);
const boardGlint = FX.glint(0.5); boardGlint.position.set(35.0, 2.8, -1.9); boardGlint.material.opacity = 0; boardGlint.userData.ndSkip = true; parkG.add(boardGlint);

// ---------- FX: warm dust (Smoke) + clouds + splashes + pond wake ----------
const smoke = new FX.Smoke(scene, 110); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(29, 0.3, 1, { rate: 2, color: 0xd9b87a, opacity: 0.15, scale: 0.5, grow: 1.2, life: 2.4, vy: 0.5, wind: 0.6 });
const splashes = new FX.Splashes(scene, 260); splashes.points.userData.ndSkip = true; splashes.points.material.size = 0.17;
const wake = new FX.Wake(scene, 30); wake.pool.forEach((p) => { p.m.userData.ndSkip = true; });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 52, opacity: 0.35, color: 0xe8e2d4, drift: 0.4 });
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF), op = owenPosAt(fxF);
    dustEmit.rate = pr.smokeRate;
    if (op && fxF >= 494) { dustEmit.x = op[0]; dustEmit.z = op[2]; }
    // one-shot splash beats: wave crash ~f70, tsunami ~f220, rescue wash, swim ripples
    if (fxF === 70 && op) splashes.burst(op[0], 0.25, op[2] - 0.6, { n: 42, power: 6.5 });
    if (fxF === 220 && op) splashes.burst(op[0], 0.25, op[2] - 0.6, { n: 46, power: 7 });
    if (fxF === 400) splashes.burst(0, 0.2, -0.4, { n: 24, power: 4 });
    if (Ws.surfK > 0.5 && fxF % 26 === 0 && op && fxF < 494) splashes.burst(op[0] + Math.sin(fxF) * 1.5, 0.15, op[2] - 1.2, { n: 10, power: 2.6 });
    if (Ws.pondK && op) { wake.trail(op[0], op[2], dt, 0.8); if (fxF % 30 === 0) splashes.burst(op[0], 0.18, op[2], { n: 8, power: 1.6 }); }
    smoke.update(t, dt);
    splashes.update(t, dt);
    wake.update(t, dt);
    fxClouds.update(t, dt);
    sea.userData.update(t); pond.userData.update(t);
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

// ---------- render targets & post (same ink/dof contract as balto/christian) ----------
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
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
  sea.material.uniforms.uDeep.value.set(L.waterDeep); sea.material.uniforms.uShallow.value.set(L.waterShal);
  pond.material.uniforms.uDeep.value.set(L.waterDeep); pond.material.uniforms.uShallow.value.set(L.waterShal);
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
  const coast = Ws.shot === 'hook' || Ws.shot === 'tsunami' || Ws.shot === 'rescue';
  coastG.visible = coast; parkG.visible = !coast;
  // giant wave: rises with waveK, leans toward shore, foam follows
  wave.position.y = -4.5 + (Ws.waveK || 0) * 6.0;
  wave.position.z = -8 + (Ws.waveK || 0) * 1.2;
  waveMat.opacity = 0.55 + (Ws.waveK || 0) * 0.43;
  waveFoam.material.opacity = (Ws.waveK || 0) * 0.9;
  const storm = Ws.shot === 'tsunami';
  fxClouds.items.forEach((cl) => cl.traverse((m) => { if (m.material) { m.material.color.set(storm ? 0x6a7078 : 0xf2e3c2); } }));
  smoke.pool.forEach((p) => { if (p.s) p.s.visible = p.life >= 0 && !coast ? p.s.visible : false; });
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
