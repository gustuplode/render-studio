import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, planeAt } from './story.js';

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


// ---------- the set: landing field (east) + the two-door chamber ----------
const MAT = {
  grass: texM(P.grass(61), 14, 14, '#7fae4c'), dirtStrip: texM(P.dirt(62), 8, 2, '#a8895c'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  floor: texM(P.stone(70, 40, 4, 50), 6, 4, '#b7ae9c'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  rug: texM(P.plaster(71, 60), 1, 4, '#7a2e3a'),
  gold: toon({ color: '#d9a441' }), goldDk: toon({ color: '#a8762a' }),
  leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  meadow: new THREE.MeshBasicMaterial({ color: 0x9fd86a, fog: true }),
  sunGlow: new THREE.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: 0, fog: true }),
  voidGlow: new THREE.MeshBasicMaterial({ color: 0x8a1f1f, transparent: true, opacity: 0, fog: true }),
  dark: new THREE.MeshBasicMaterial({ color: 0x0d0b09, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
// ================= FIELD stage (x=40): the empty plane lands =================
{
  const g = world;
  const grnd = flat(add(new THREE.CircleGeometry(17, 28), MAT.grass, 40, 0, 0, g, { cast: false })); grnd.receiveShadow = true;
  flat(add(new THREE.PlaneGeometry(15, 3), MAT.dirtStrip, 40, 0.02, 0.5, g, { cast: false }));
  for (const [tx, tz] of [[31, -6], [49, -5], [33, 7], [48, 6], [40, -9]]) {
    add(new THREE.CylinderGeometry(0.14, 0.2, 1.5, 7), MAT.woodDk, tx, 0.75, tz, g, { cast: false });
    add(new THREE.SphereGeometry(1.2, 10, 8), MAT.leaf, tx, 2.1, tz, g, { cast: false });
    add(new THREE.SphereGeometry(0.8, 9, 7), MAT.leaf2, tx + 0.7, 1.7, tz + 0.3, g, { cast: false });
  }
  const hillM = texM(P.grass(69), 6, 6, '#6f9a48');
  add(new THREE.ConeGeometry(13, 4.2, 16), hillM, 55, 1.7, -16, g, { cast: false });
  add(new THREE.ConeGeometry(10, 3.2, 16), hillM, 26, 1.2, -14, g, { cast: false });
}
// the plane (scaled-up mini, same build language as the tomb hook plane)
const planeG2 = new THREE.Group(); world.add(planeG2);
{
  planeG2.scale.setScalar(1.6);
  const fus = add(new THREE.CapsuleGeometry(0.5, 3.2, 4, 10), toon({ color: '#eef1f4' }), 0, 0, 0, planeG2, { cast: false });
  fus.rotation.z = Math.PI / 2;
  add(tbox(1.2, 0.08, 5.2, 1), toon({ color: '#d7dde3' }), 0.2, -0.25, 0, planeG2, { cast: false });
  add(tbox(0.8, 0.9, 0.08, 1), toon({ color: '#2e5aa8' }), -1.9, 0.55, 0, planeG2, { cast: false });
  add(tbox(3.6, 0.14, 0.16, 1), toon({ color: '#2e5aa8' }), -0.2, 0.05, 0, planeG2, { cast: false });
  // window row + cheatline so the fuselage reads as an airliner, not a capsule
  const winM = new THREE.MeshBasicMaterial({ color: 0x232830, fog: true });
  for (const sz of [-1, 1]) for (let i = 0; i < 7; i++) {
    const win = add(new THREE.PlaneGeometry(0.17, 0.15), winM, -1.3 + i * 0.42, 0.14, sz * 0.52, planeG2, { cast: false });
    if (sz < 0) win.rotation.y = Math.PI;
    win.userData.ndSkip = true;
  }
}
// ================= CHAMBER =================
let doorLPanel, meadowGlow, voidGlow;
{
  const g = world;
  const fl = flat(add(new THREE.PlaneGeometry(19, 13), MAT.floor, 0, 0, 1, g, { cast: false })); fl.receiveShadow = true;
  flat(add(new THREE.PlaneGeometry(2.4, 7.5), MAT.rug, 0, 0.02, 0.6, g, { cast: false }));
  // back wall with two doorway holes (segments + lintel band)
  add(tbox(5.6, 5.2, 0.4, 3), MAT.stone, -6.2, 2.6, -3.2, g, { cast: false });
  add(tbox(5.6, 5.2, 0.4, 3), MAT.stone, 6.2, 2.6, -3.2, g, { cast: false });
  add(tbox(2.0, 5.2, 0.4, 3), MAT.stone, 0, 2.6, -3.2, g, { cast: false });
  add(tbox(19, 2.1, 0.4, 3), MAT.stone, 0, 4.15, -3.2, g, { cast: false });
  // side walls (partial, keep the stage open)
  add(tbox(0.4, 5.2, 9, 3), MAT.stoneDk, -9.3, 2.6, 0.8, g, { cast: false });
  add(tbox(0.4, 5.2, 9, 3), MAT.stoneDk, 9.3, 2.6, 0.8, g, { cast: false });
  // door frames + panels
  for (const dx of [-2.2, 2.2]) {
    add(tbox(0.28, 3.2, 0.3, 2), MAT.woodDk, dx - 0.95, 1.6, -2.95, g, { cast: false });
    add(tbox(0.28, 3.2, 0.3, 2), MAT.woodDk, dx + 0.95, 1.6, -2.95, g, { cast: false });
    add(tbox(2.2, 0.3, 0.3, 2), MAT.woodDk, dx, 3.3, -2.95, g, { cast: false });
  }
  const mkPanel = (dx) => {
    const grp = new THREE.Group(); grp.position.set(dx - 0.88, 0, -2.9); world.add(grp);
    add(tbox(1.76, 3.05, 0.12, 2), MAT.wood, 0.88, 1.52, 0, grp);
    add(tbox(0.5, 0.08, 0.06, 1), MAT.goldDk, 1.55, 1.5, 0.09, grp, { cast: false });
    return grp;
  };
  doorLPanel = mkPanel(-2.2);
  mkPanel(2.2); // death door: never opens
  // what is behind the doors
  const meadow = add(new THREE.PlaneGeometry(3.4, 4.2), MAT.meadow, -2.2, 2.1, -5.4, g, { cast: false }); meadow.userData.ndSkip = true;
  meadowGlow = add(new THREE.PlaneGeometry(1.8, 3.05), MAT.sunGlow, -2.2, 1.52, -3.06, g, { cast: false }); meadowGlow.userData.ndSkip = true;
  add(new THREE.PlaneGeometry(3.4, 4.2), MAT.dark, 2.2, 2.1, -5.4, g, { cast: false }).userData.ndSkip = true;
  voidGlow = add(new THREE.PlaneGeometry(1.8, 3.05), MAT.voidGlow, 2.2, 1.52, -3.06, g, { cast: false }); voidGlow.userData.ndSkip = true;
  // guard spears
  for (const sx of [-3.6, 3.6]) {
    add(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), MAT.woodDk, sx + (sx < 0 ? -0.35 : 0.35), 1.15, -2.3, g, { cast: false });
    add(new THREE.ConeGeometry(0.07, 0.3, 6), MAT.stoneDk, sx + (sx < 0 ? -0.35 : 0.35), 2.45, -2.3, g, { cast: false });
  }
  // torches on the back wall
  for (const tx of [-5.5, 5.5]) {
    add(new THREE.CylinderGeometry(0.035, 0.05, 0.7, 6), MAT.woodDk, tx, 3.6, -2.85, g, { cast: false });
    add(new THREE.SphereGeometry(0.09, 8, 8), MAT.gold, tx, 3.3, -2.85, g, { cast: false });
  }
}
// crown pedestal (the hook)
let crownGlint;
{
  const g = world;
  add(new THREE.CylinderGeometry(0.55, 0.68, 1.1, 12), MAT.stoneDk, 6.5, 0.55, -1, g, { cast: false });
  add(tbox(0.8, 0.14, 0.8, 1), MAT.rug, 6.5, 1.17, -1, g, { cast: false }); // cushion
  const crown = new THREE.Group(); crown.position.set(6.5, 1.24, -1); g.add(crown);
  add(new THREE.CylinderGeometry(0.4, 0.44, 0.24, 14), MAT.gold, 0, 0.12, 0, crown, { cast: false });
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    add(new THREE.ConeGeometry(0.09, 0.3, 6), MAT.gold, Math.cos(a) * 0.36, 0.36, Math.sin(a) * 0.36, crown, { cast: false });
  }
  for (const [gx, gz, col] of [[0.42, 0, '#c22e3a'], [-0.21, 0.36, '#2e5aa8'], [-0.21, -0.36, '#2e8a4a']]) {
    add(new THREE.SphereGeometry(0.07, 8, 8), toon({ color: col }), gx, 0.12, gz, crown, { cast: false });
  }
  crownGlint = FX.glint(0.5); crownGlint.position.set(6.5, 1.75, -0.6); crownGlint.userData.ndSkip = true; g.add(crownGlint);
}
// ---- boards (transforms mirrored in boardverify.mjs — keep in sync) ----
// B1 doors sign: on the back wall at (0,3.9,-2.95), face 2.6x0.85, key boardDoors
const boardDoors = textBoard(['THE TWO DOORS'], 2.6, 0.85, '#274b73', '#ffe9a8'); boardDoors.position.set(0, 3.9, -2.95); world.add(boardDoors);
// B2 question easel: at (5.6,0,0.8) ry -0.5, face 2.2x0.8 centre local y 1.45, key boardQuestion
const qG = new THREE.Group(); qG.position.set(4.2, 0, 2.2); qG.rotation.y = -0.75; world.add(qG);
for (const px of [-0.72, 0.72]) add(new THREE.CylinderGeometry(0.045, 0.06, 1.8, 7), M.beamDark, px, 0.9, -0.07, qG, { cast: false });
add(tbox(1.7, 0.08, 0.07, 2), M.beam, 0, 1.84, -0.07, qG, { cast: false });
const boardQuestion = textBoard(['ONE QUESTION'], 1.5, 0.65, '#7a1f1f', '#ffe9a8'); boardQuestion.position.set(0, 1.35, 0.04); qG.add(boardQuestion);
// B3 free sign: over the left door at (-2.2,3.62,-2.9), face 1.7x0.7, key boardFree
const boardFree = textBoard(['FREE!'], 1.7, 0.7, '#2e5a2e', '#ffe9a8'); boardFree.position.set(-2.2, 3.62, -2.9); world.add(boardFree);

// ---------- FX: torch flames, landing dust, haze ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const torchEmit1 = smoke.addEmitter(-5.5, 4.0, -2.85, { rate: 0, color: 0xe86a1e, opacity: 0.55, scale: 0.22, grow: 1.3, life: 0.7, vy: 1.1, wind: 0.1 });
const torchEmit3 = smoke.addEmitter(5.5, 4.0, -2.85, { rate: 0, color: 0xe86a1e, opacity: 0.55, scale: 0.22, grow: 1.3, life: 0.7, vy: 1.1, wind: 0.1 });
const dustEmit = smoke.addEmitter(39, 0.3, 1.2, { rate: 0, color: 0xcbb28a, opacity: 0.4, scale: 0.7, grow: 1.8, life: 1.3, vy: 0.8, wind: 0.5 });
const hazeEmit = smoke.addEmitter(0, 2.2, 0, { rate: 0.35, color: 0xffdfae, opacity: 0.04, scale: 2.0, grow: 1.3, life: 2.6, vy: 0.08, wind: -0.3 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 40, opacity: 0.18, color: 0xf4f6fa, drift: 0.5 });
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
    torchEmit1.rate = pr.torchRate; torchEmit3.rate = pr.torchRate;
    dustEmit.rate = pr.landDustRate; hazeEmit.rate = pr.smokeRate;
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
  setB(boardDoors, Ws.boardDoors || 0); setB(boardQuestion, Ws.boardQuestion || 0); setB(boardFree, Ws.boardFree || 0);
  doorLPanel.rotation.y = -(Ws.doorLK || 0) * 1.85;
  MAT.sunGlow.opacity = (Ws.glowL || 0) * 0.85;
  MAT.voidGlow.opacity = (Ws.skullK || 0) * 0.32;
  crownGlint.material.opacity = Math.max(0, (Ws.crownK || 0)) * 0.7;
  const pk = Ws.planeK || 0;
  planeG2.visible = pk > 0 || f < 188;
  const pp = planeAt(pk);
  planeG2.position.set(pp[0], pp[1], pp[2]);
  planeG2.rotation.y = Math.PI; // nose first: it travels -x
  planeG2.rotation.z = 0.1 * (1 - pk);
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
