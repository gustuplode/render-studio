import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt } from './story.js';

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
  g.font = `${font} ${fs}px 'Noto Sans Devanagari', Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  return m; // boards stay IN the ND pass: their depth occludes set geometry behind them (no ghost ink lines)
};

// ---------- the set: a farmer's yard, paddock and three counting pens ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  plaster: texM(P.plaster(33, 36), 2, 2),
  dark: toon({ color: '#33302c' }), iron: toon({ color: '#4a4d55' }),
  paper: toon({ color: '#e8dcc0' }),
  weave: texM(P.weave(21, [176, 138, 92]), 2, 1),
  rope: toon({ color: '#8a6a42' }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  const gr = flat(add(new THREE.PlaneGeometry(280, 280), MAT.grass, 8, -0.03, 0, g, { cast: false })); gr.receiveShadow = true;
  flat(add(new THREE.CircleGeometry(8.5, 24), MAT.dirt, -2, -0.012, 1.2, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(46, 3.4), MAT.dirt, 14, -0.014, 2.4, g, { cast: false }));
  flat(add(new THREE.CircleGeometry(5.5, 20), MAT.dirt, 6, -0.010, -2.0, g, { cast: false }));
  // back boundary wall + far hut (depth)
  add(tbox(46, 1.5, 0.4, 2), MAT.stoneDk, 6, 0.75, -7.4, g, { cast: false });
  const fh = new THREE.Group(); fh.position.set(21.5, 0, -5.6); fh.rotation.y = -0.35; g.add(fh);
  add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, fh, { cast: false });
  add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, fh, { cast: false }).rotation.y = Math.PI / 4;
  // ================= the farmer's hut (west) =================
  const hut = new THREE.Group(); hut.position.set(-7.6, 0, -2.6); hut.rotation.y = 0.18; g.add(hut);
  add(tbox(3.8, 2.3, 3.2, 2), MAT.plaster, 0, 1.15, 0, hut, { cast: false });
  const roof = add(new THREE.ConeGeometry(3.1, 1.5, 4), MAT.thatch, 0, 3.05, 0, hut, { cast: false }); roof.rotation.y = Math.PI / 4;
  add(tbox(1.0, 1.7, 0.1, 1), MAT.dark, 0.7, 0.85, 1.62, hut, { cast: false });
  add(tbox(0.7, 0.7, 0.08, 1), MAT.woodDk, -0.9, 1.45, 1.62, hut, { cast: false });
  add(tbox(4.4, 0.18, 0.5, 2), MAT.stone, 0, 0.09, 1.85, hut, { cast: false });
  // ================= charpai under the tree + will table =================
  const cp = new THREE.Group(); cp.position.set(-4.0, 0, 0.7); cp.rotation.y = -0.15; g.add(cp);
  for (const [lx, lz] of [[-0.95, -0.38], [0.95, -0.38], [-0.95, 0.38], [0.95, 0.38]]) add(tbox(0.09, 0.46, 0.09, 1), MAT.woodDk, lx, 0.23, lz, cp, { cast: false });
  add(tbox(2.1, 0.07, 0.9, 1), MAT.weave, 0, 0.47, 0, cp, { cast: false });
  add(tbox(2.14, 0.05, 0.12, 1), MAT.wood, 0, 0.44, -0.45, cp, { cast: false });
  add(tbox(2.14, 0.05, 0.12, 1), MAT.wood, 0, 0.44, 0.45, cp, { cast: false });
  const pillow = add(tbox(0.5, 0.12, 0.7, 1), MAT.paper, -0.72, 0.56, 0, cp, { cast: false }); pillow.rotation.z = 0.1;
  // side table with the WILL paper on it
  add(tbox(0.85, 0.06, 0.6, 1), MAT.wood, -2.9, 0.6, -0.2, g, { cast: false });
  for (const [lx, lz] of [[-3.25, -0.42], [-2.55, -0.42], [-3.25, 0.02], [-2.55, 0.02]]) add(tbox(0.06, 0.6, 0.06, 1), MAT.woodDk, lx, 0.3, lz, g, { cast: false });
  const wp = add(new THREE.PlaneGeometry(0.62, 0.44), MAT.paper, -2.9, 0.635, -0.2, g, { cast: false }); wp.rotation.x = -Math.PI / 2; wp.rotation.z = 0.2;
  // trees
  const tree = (x, z, s, mat, c2o = [0, 0]) => {
    add(new THREE.CylinderGeometry(0.3 * s, 0.46 * s, 3.0 * s, 8), MAT.woodDk, x, 1.5 * s, z, g, { cast: false });
    const c1 = add(new THREE.SphereGeometry(2.1 * s, 10, 8), mat, x, 3.9 * s, z, g, { cast: false }); c1.scale.y = 0.72; c1.userData.ndSkip = true;
    const c2 = add(new THREE.SphereGeometry(1.5 * s, 10, 8), mat, x + 1.1 * s + c2o[0], 3.3 * s + c2o[1], z + 0.4, g, { cast: false }); c2.scale.y = 0.7; c2.userData.ndSkip = true;
  };
  tree(-5.8, 2.8, 1.15, MAT.leaf);
  tree(15.5, -3.4, 1.0, MAT.leaf2);
  tree(24.5, -1.6, 0.9, MAT.leaf, [0.81, 0.38]); // hook tree: side blob nudged up/east so it never hangs over the hook sign
  // bushes along the wall
  for (const [bx, bz] of [[-1, -6.9], [9, -7.0], [17, -6.8]]) {
    const b = add(new THREE.SphereGeometry(0.9, 9, 7), MAT.leaf2, bx, 0.55, bz, g, { cast: false }); b.scale.y = 0.7; b.userData.ndSkip = true;
  }
  // ================= fences: paddock + three counting pens =================
  const railRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 1.35));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      add(new THREE.CylinderGeometry(0.055, 0.07, 1.12, 7), MAT.woodDk, x0 + (x1 - x0) * t, 0.56, z0 + (z1 - z0) * t, g, { cast: false });
    }
    for (const ry of [0.52, 0.94]) {
      const r = add(tbox(len, 0.07, 0.05, 1), MAT.wood, (x0 + x1) / 2, ry, (z0 + z1) / 2, g, { cast: false });
      r.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    }
  };
  // paddock outer fence: x 1..11, z -4.6..0.6 (south side has a gate gap x 5.2..6.8)
  railRun(1.0, -4.6, 11.0, -4.6);
  railRun(1.0, -4.6, 1.0, 0.6);
  railRun(11.0, -4.6, 11.0, 0.6);
  railRun(1.0, 0.6, 5.2, 0.6);
  railRun(6.8, 0.6, 11.0, 0.6);
  // pen dividers: pen A x 1..5, pen B x 5..8.2, pen C x 8.2..11
  railRun(5.0, -4.6, 5.0, 0.6);
  railRun(8.2, -4.6, 8.2, 0.6);
  // gate posts (taller, with a hanging lantern hook silhouette)
  for (const gx of [5.2, 6.8]) add(new THREE.CylinderGeometry(0.08, 0.1, 1.5, 7), MAT.woodDk, gx, 0.75, 0.6, g, { cast: false });
  // hay trough + water bucket in the paddock
  add(tbox(1.6, 0.3, 0.5, 1), MAT.wood, 2.0, 0.32, -4.0, g, { cast: false });
  const hay = add(new THREE.SphereGeometry(0.55, 9, 7), MAT.thatch, 2.0, 0.55, -4.0, g, { cast: false }); hay.scale.y = 0.55;
  add(new THREE.CylinderGeometry(0.3, 0.24, 0.42, 10), MAT.iron, 10.3, 0.21, -0.4, g, { cast: false });
  // a low platform by the pens for the qazi's judgement seat
  add(tbox(1.5, 0.22, 1.1, 2), MAT.stone, 6.0, 0.11, 1.9, g, { cast: false });
}

// ---- boards (transforms mirrored in boards.json — keep in sync) ----
function postSign(lines, w, h, bg, fg, gx, gz, ry, cy = 1.5) {
  const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = ry; world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, Math.max(1.2, cy + h / 2), 6), MAT.woodDk, 0, (cy + h / 2) / 2, -0.06, g, { cast: false });
  const b = textBoard(lines, w, h, bg, fg); b.position.set(0, cy, 0.05); g.add(b);
  return b;
}
add(new THREE.CylinderGeometry(0.035, 0.045, 0.78, 6), MAT.woodDk, -3.17, 0.39, 1.08, world, { cast: false });
add(new THREE.CylinderGeometry(0.035, 0.045, 0.78, 6), MAT.woodDk, -3.79, 0.39, 1.31, world, { cast: false });
const boardWill = textBoard(['वसीयत', 'सत्रह घोड़े'], 0.95, 0.62, '#e8dcc0', '#4a2c14'); boardWill.position.set(-3.483, 1.05, 1.197); boardWill.rotation.y = 0.35; world.add(boardWill);
for (const px of [4.1, 5.7]) add(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 6), MAT.woodDk, px, 0.85, -4.92, world, { cast: false });
const board17 = textBoard(['सत्रह घोड़े'], 2.2, 0.75, '#4a2c14', '#ffd76a'); board17.position.set(4.9, 2.0, -4.72); world.add(board17);
for (const px of [6.5, 8.1]) add(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 6), MAT.woodDk, px, 0.85, -4.92, world, { cast: false });
const board18 = textBoard(['अब अठारह!'], 2.0, 0.75, '#4a2c14', '#ffd76a'); board18.position.set(7.3, 2.0, -4.72); world.add(board18);
for (const px of [2.3, 3.7]) add(new THREE.CylinderGeometry(0.05, 0.07, 2.0, 6), MAT.woodDk, px, 1.0, -4.92, world, { cast: false });
const boardCount9 = textBoard(['नौ घोड़े'], 1.7, 0.62, '#2e5a2e', '#ffe9a8'); boardCount9.position.set(3.0, 2.35, -4.72); world.add(boardCount9);
for (const px of [5.8999999999999995, 7.3]) add(new THREE.CylinderGeometry(0.05, 0.07, 2.0, 6), MAT.woodDk, px, 1.0, -4.92, world, { cast: false });
const boardCount6 = textBoard(['छह घोड़े'], 1.7, 0.62, '#2e5a2e', '#ffe9a8'); boardCount6.position.set(6.6, 2.35, -4.72); world.add(boardCount6);
for (const px of [8.9, 10.299999999999999]) add(new THREE.CylinderGeometry(0.05, 0.07, 2.0, 6), MAT.woodDk, px, 1.0, -4.92, world, { cast: false });
const boardCount2 = textBoard(['दो घोड़े'], 1.7, 0.62, '#2e5a2e', '#ffe9a8'); boardCount2.position.set(9.6, 2.35, -4.72); world.add(boardCount2);
const boardSum = textBoard(['९ + ६ + २ = १७'], 3.0, 0.8, '#4a2c14', '#ffd76a'); boardSum.position.set(6.0, 2.0, 0.72); world.add(boardSum);
const boardHook = postSign(['गधा बोलेगा?'], 2.1, 0.75, '#2e5a2e', '#ffe9a8', 25.8, -0.9, -0.25, 1.92);

// ---------- FX: farm dust, hut smoke, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(6, 1.2, -2, { rate: 0.25, color: 0xffe2b0, opacity: 0.04, scale: 2.6, grow: 1.3, life: 2.8, vy: 0.1, wind: -0.3 });
const dustEmit = smoke.addEmitter(6, 0.6, -1, { rate: 0.12, color: 0xe8d9b0, opacity: 0.15, scale: 0.5, grow: 1.6, life: 1.1, vy: 0.45, wind: 0.3 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
  }
};

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor(small = false) {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = small ? 600 : CW; c.height = small ? 1000 : CH; return [c, c.getContext('2d')]; })();
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
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.c.width, this.c.height); g.setTransform(this.c.width / 600, 0, 0, this.c.height / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i, small) => cards[i] || (cards[i] = new Card(small));

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
  setB(boardWill, Ws.boardWill || 0); setB(board17, Ws.board17 || 0); setB(board18, Ws.board18 || 0);
  setB(boardCount9, Ws.boardCount9 || 0); setB(boardCount6, Ws.boardCount6 || 0); setB(boardCount2, Ws.boardCount2 || 0);
  setB(boardSum, Ws.boardSum || 0); setB(boardHook, Ws.boardHook || 0);
}
function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i, a.small);
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
