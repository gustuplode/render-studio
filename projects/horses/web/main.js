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

// ---------- text-board helper ----------
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
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- materials ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  white: toon({ color: '#f7f3e6' }), blanket: toon({ color: '#7a3038' }),
  dark: toon({ color: '#33302c' }), gold: toon({ color: '#d9a441' }),
  flagR: toon({ color: '#b03a30' }), flagB: toon({ color: '#30548c' }), flagG: toon({ color: '#3f7a34' }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(420, 260), MAT.grass, 16, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(150, 6.5), MAT.dirt, 16, -0.012, 5.8, g, { cast: false }));   // the road
  flat(add(new THREE.CircleGeometry(10.5, 22), MAT.dirt, 0, -0.008, -1.5, g, { cast: false }));  // farmyard
  flat(add(new THREE.PlaneGeometry(27, 13), MAT.dirt, 26.5, -0.009, -2.2, g, { cast: false }));  // counting field
  flat(add(new THREE.CircleGeometry(8.5, 22), MAT.dirt, 56, -0.008, -0.5, g, { cast: false }));  // palace square
  for (const [tx, tz, s] of [[-11, -9, 1], [13, -10, 1.15], [44, -9, 0.9], [64, -8, 1.05]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// fence builder: posts + two rails along a straight run
const fenceRun = (parent, x0, z0, x1, z1) => {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.2));
  const ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    add(box(0.12, 1.2, 0.12), MAT.woodDk, x0 + (x1 - x0) * t, 0.6, z0 + (z1 - z0) * t, parent, { cast: false });
  }
  for (const ry of [0.55, 0.95]) {
    const r = add(box(len, 0.09, 0.07), MAT.wood, (x0 + x1) / 2, ry, (z0 + z1) / 2, parent, { cast: false });
    r.rotation.y = -ang;
  }
};
// ================= COTTAGE INTERIOR (x=-22) =================
let lampGlowC;
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(10.5, 7.5), MAT.stone, -22, -0.005, -1, g, { cast: false }));
  add(tbox(10.5, 3.4, 0.35, 2), MAT.plaster, -22, 1.7, -4.45, g, { cast: false });       // back wall
  add(tbox(0.35, 3.4, 7.5, 2), MAT.plaster, -27.1, 1.7, -1, g, { cast: false });          // west wall
  const roof = add(tbox(11.5, 0.14, 8.6, 2), MAT.thatch, -22, 3.62, -1.2, g, { cast: false }); roof.rotation.x = 0.07;
  // the bed: frame, mattress, pillow, blanket (father card lies on top)
  add(tbox(2.9, 0.32, 1.3, 2), MAT.woodDk, -24.3, 0.2, -3.3, g, { cast: false });
  add(tbox(2.85, 0.16, 1.22, 2), MAT.white, -24.3, 0.44, -3.3, g, { cast: false });
  add(tbox(0.55, 0.13, 1.0, 2), MAT.white, -23.85, 0.55, -3.3, g, { cast: false });
  add(tbox(1.8, 0.13, 1.24, 2), MAT.blanket, -23.8, 0.56, -3.3, g, { cast: false });
  // bedside table + lamp
  add(tbox(0.8, 0.08, 0.6, 2), MAT.wood, -21.9, 0.62, -3.95, g, { cast: false });
  add(box(0.09, 0.6, 0.09), MAT.woodDk, -21.9, 0.31, -3.95, g, { cast: false });
  add(new THREE.CylinderGeometry(0.07, 0.1, 0.22, 8), MAT.gold, -21.9, 0.77, -3.95, g, { cast: false });
  lampGlowC = softGlow(1.7, 0xffc98a, 0.2); lampGlowC.position.set(-21.9, 0.95, -3.9); g.add(lampGlowC);
  // stool + water pot
  add(new THREE.CylinderGeometry(0.26, 0.3, 0.45, 9), MAT.wood, -20.6, 0.22, -2.6, g, { cast: false });
  const pot = add(new THREE.SphereGeometry(0.24, 9, 7), MAT.stoneDk, -26.3, 0.2, -2.2, g, { cast: false }); pot.scale.y = 0.85;
}
// ================= FARMYARD + PADDOCK (x=0) =================
let yardGate;
{
  const g = world;
  // farmhouse (what the father built)
  add(tbox(8, 3.4, 3.2, 2), MAT.plaster, 0, 1.7, -11, g, { cast: false });
  const rf = add(new THREE.ConeGeometry(6.3, 2.1, 4), MAT.thatch, 0, 4.45, -11, g, { cast: false }); rf.rotation.y = Math.PI / 4; rf.scale.z = 0.62;
  add(tbox(1.1, 2.1, 0.12, 2), MAT.dark, 0, 1.05, -9.35, g, { cast: false });
  add(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 7), MAT.stoneDk, 2.6, 4.9, -11.4, g, { cast: false });
  // haystack
  add(new THREE.CylinderGeometry(1.35, 1.55, 0.7, 10), MAT.thatch, 10.6, 0.35, -4.2, g, { cast: false });
  add(new THREE.ConeGeometry(1.6, 1.5, 10), MAT.thatch, 10.6, 1.45, -4.2, g, { cast: false });
  // paddock fences: x[-7.5,7.5], z[-6.5,1.0]; gate on the east side
  fenceRun(g, -7.5, -6.5, 7.5, -6.5);
  fenceRun(g, -7.5, -6.5, -7.5, 1.0);
  fenceRun(g, -7.5, 1.0, 7.5, 1.0);
  fenceRun(g, 7.5, -6.5, 7.5, -2.5);
  fenceRun(g, 7.5, 0.5, 7.5, 1.0);
  yardGate = new THREE.Group(); yardGate.position.set(7.5, 0, 0.5); g.add(yardGate);
  fenceRun(yardGate, 0, 0, 0, -3.0);
}
// ================= COUNTING FIELD (x=26) =================
let glowA, glowB, glowC;
{
  const g = world;
  // back + front fences, dividers between the three groups
  fenceRun(g, 15.5, -6.2, 36.5, -6.2);
  fenceRun(g, 15.5, 0.6, 36.5, 0.6);
  fenceRun(g, 15.5, -6.2, 15.5, 0.6);
  fenceRun(g, 36.5, -6.2, 36.5, 0.6);
  fenceRun(g, 23.8, -6.2, 23.8, 0.6);
  fenceRun(g, 30.8, -6.2, 30.8, 0.6);
  // group flags: red 9, blue 6, green 2
  const flag = (x, mat) => {
    add(new THREE.CylinderGeometry(0.045, 0.045, 2.3, 7), MAT.woodDk, x, 1.15, 0.6, g, { cast: false });
    const fg = add(box(0.62, 0.4, 0.04), mat, x + 0.33, 2.05, 0.6, g, { cast: false });
    return fg;
  };
  flag(17.5, MAT.flagR); flag(25.6, MAT.flagB); flag(32.6, MAT.flagG);
  // hitching post for the judge's horse
  add(box(0.14, 1.05, 0.14), MAT.woodDk, 35.6, 0.52, 1.6, g, { cast: false });
  add(box(0.9, 0.09, 0.09), MAT.wood, 35.25, 0.98, 1.6, g, { cast: false });
  glowA = softGlow(6.5, 0xffe9a0, 0); glowA.position.set(20.2, 3.1, -3.1); g.add(glowA);
  glowB = softGlow(5.5, 0xffe9a0, 0); glowB.position.set(27.3, 3.1, -3.1); g.add(glowB);
  glowC = softGlow(4.2, 0xffe9a0, 0); glowC.position.set(33.9, 3.1, -2.9); g.add(glowC);
  // tally board posts (board itself below)
  add(box(0.12, 3.4, 0.12), MAT.woodDk, 24.4, 1.7, 2.9, g, { cast: false });
  add(box(0.12, 3.4, 0.12), MAT.woodDk, 27.6, 1.7, 2.9, g, { cast: false });
}
// ================= PALACE SQUARE (x=56) =================
{
  const g = world;
  add(tbox(17, 7, 0.6, 2), MAT.stone, 56, 3.5, -7.2, g, { cast: false });
  add(tbox(17.8, 0.5, 1.0, 2), MAT.stoneDk, 56, 7.2, -7.2, g, { cast: false });
  for (const tx of [48.8, 63.2]) {
    add(new THREE.CylinderGeometry(1.25, 1.45, 9, 10), MAT.stone, tx, 4.5, -7.2, g, { cast: false });
    add(new THREE.ConeGeometry(1.8, 1.6, 10), MAT.thatch, tx, 9.8, -7.2, g, { cast: false });
  }
  add(tbox(2.3, 3.6, 0.18, 2), MAT.dark, 56, 1.8, -6.85, g, { cast: false });
  add(tbox(6.4, 0.26, 1.6, 2), MAT.stone, 56, 0.13, -5.4, g, { cast: false });
  add(tbox(5.2, 0.26, 1.2, 2), MAT.stone, 56, 0.39, -5.65, g, { cast: false });
  add(tbox(4.0, 0.26, 0.9, 2), MAT.stone, 56, 0.65, -5.85, g, { cast: false });
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardWill = textBoard(['SEVENTEEN', 'HORSES', '1/2 · 1/3 · 1/9'], 3.0, 1.25, '#4a2c14', '#ffd76a'); boardWill.position.set(-22.6, 2.3, -4.18); world.add(boardWill);
const boardAdd = textBoard(['17 + 1 = 18'], 2.2, 0.8, '#2e5a2e', '#ffe9a8'); boardAdd.position.set(0, 1.95, 1.18); world.add(boardAdd);
const boardCount = textBoard(['9 + 6 + 2 = 17'], 3.6, 1.0, '#4a2c14', '#ffd76a'); boardCount.position.set(26, 3.1, 2.9); world.add(boardCount);

// ---------- FX: haze ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(2.6, 5.6, -11.4, { rate: 0.3, color: 0xffffff, opacity: 0.05, scale: 2.0, grow: 1.3, life: 2.8, vy: 0.22, wind: 0.4 });
const dustEmit = smoke.addEmitter(26, 1.2, -3, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.55, grow: 1.2, life: 2.0, vy: 0.14, wind: 0.2 });
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
  setB(boardWill, Ws.boardWill || 0); setB(boardAdd, Ws.boardAdd || 0); setB(boardCount, Ws.boardCount || 0);
  yardGate.rotation.y = -(Ws.gateK || 0) * 1.85;
  lampGlowC.material.opacity = 0.14 + (Ws.goldK || 0) * 0.25;
  glowA.material.opacity = (Ws.glowA || 0) * 0.33;
  glowB.material.opacity = (Ws.glowB || 0) * 0.33;
  glowC.material.opacity = (Ws.glowC || 0) * 0.33;
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
