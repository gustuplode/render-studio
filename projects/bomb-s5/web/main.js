import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, SUNS_POS, TEMP_POS, SOUND_POS, PLANES_POS, FIRE_POS, CLOSE_POS, CENTRE, BURST } from './story.js';

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
  ground: texM(P.dirt(7), 220, 220, '#9a8f7a'),
  street: toon({ color: '#6e675c' }),
  bank: texM(P.stone(4), 30, 1),
  bridge: texM(P.stone(5), 3, 1),
  roof: texM(P.roof(3), 1, 1, '#a89a88'),
  trunk: toon({ color: '#5d4a36' }), leaf: toon({ color: '#4d6b3a' }), leaf2: toon({ color: '#5d7d42' }),
  hill: toon({ color: '#8d8272' }), hillFar: toon({ color: '#9c9182' }),
  plane: texM(P.panelMetal(41), 2, 1), planeDark: toon({ color: '#3f444a' }),
  bomb: toon({ color: '#4a4a38' }),
  figure: toon({ color: '#322e2a' }),
  pole: toon({ color: '#5a564e' }),
  sea: (() => { const m = new THREE.MeshToonMaterial({ gradientMap: grad, color: '#3a6a84' }); m.userData.water = true; return m; })(),
  glow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,205,110', 0.95)), transparent: true, fog: false, depthWrite: false }),
  fireGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,150,60', 0.95)), transparent: true, fog: false, depthWrite: false }),
  fireOut: new THREE.MeshBasicMaterial({ color: '#ff8a3c', transparent: true, fog: false }),
  fireIn: new THREE.MeshBasicMaterial({ color: '#fff0b0', transparent: true, fog: false }),
  cloud: toon({ color: '#b98a6a', transparent: true }),
  ring: new THREE.MeshBasicMaterial({ color: '#efe3cc', transparent: true, fog: false, depthWrite: false, side: THREE.DoubleSide }),
  dustRing: new THREE.MeshBasicMaterial({ color: '#cbb99e', transparent: true, fog: true, depthWrite: false, side: THREE.DoubleSide }),
  glint: new THREE.MeshBasicMaterial({ color: '#fff3cf', transparent: true, fog: false, depthWrite: false }),
};
// city block materials (varied plaster/stone tints) — darkened as one when the ash falls
const blockMats = ['#cbb79e', '#bfae94', '#d3c2ab', '#b3a48e', '#c4b198'].map((c, i) => texM(P.plaster(20 + i, 24), 1, 1, c));
const CITY_FADE = [
  ...blockMats.map((m) => ({ m, base: m.color.clone(), ash: new THREE.Color('#5e584f') })),
  { m: M.roof, base: M.roof.color.clone(), ash: new THREE.Color('#57524b') },
  { m: M.ground, base: M.ground.color.clone(), ash: new THREE.Color('#6b655c') },
  { m: M.leaf, base: M.leaf.color.clone(), ash: new THREE.Color('#4a4a42') },
  { m: M.leaf2, base: M.leaf2.color.clone(), ash: new THREE.Color('#515248') },
  { m: M.bridge, base: M.bridge.color.clone(), ash: new THREE.Color('#605a52') },
];

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
const waterNd = new THREE.ShaderMaterial({
  vertexShader: `varying float vD; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vD; void main(){ gl_FragColor=vec4(.5,1.,.5,vD); }`,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
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
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };

// ---------- the city (one connected dawn city on a river) ----------
const world = new THREE.Group(); scene.add(world);
flat(add(new THREE.PlaneGeometry(900, 900), M.ground, 0, -0.02, 0, world, { cast: false }));
// river strip (runs along z at x=0) + banks
{ const m = flat(add(new THREE.PlaneGeometry(11, 190), M.sea, 0, 0, 0, world, { cast: false })); m.userData.nd = waterNd; }
add(box(1.2, 0.35, 190), M.bank, -6.1, 0.17, 0, world, { cast: false });
add(box(1.2, 0.35, 190), M.bank, 6.1, 0.17, 0, world, { cast: false });
// streets: along both banks + cross streets
for (const sx of [-8.6, 8.6]) flat(add(new THREE.PlaneGeometry(3, 170), M.street, sx, 0.006, 0, world, { cast: false }));
for (const cz of [-24, -8, 6, 20]) for (const sx of [-25.5, 25.5]) flat(add(new THREE.PlaneGeometry(39, 3), M.street, sx, 0.006, cz, world, { cast: false }));
// bridges: a plain bridge at z=6 and the T-bridge at z=-8 (the aiming point, abstract)
const bridgeAt = (z, tee) => {
  const g = new THREE.Group(); g.position.set(0, 0, z); world.add(g);
  add(box(17.5, 0.5, 2.8), M.bridge, 0, 1.0, 0, g);
  for (const s of [-1, 1]) add(box(17.5, 0.5, 0.14), M.bridge, 0, 1.45, s * 1.32, g, { cast: false });
  for (const px of [-5.5, 5.5]) add(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 8), M.bridge, px, 0.5, 0, g, { cast: false });
  if (tee) { add(box(2.8, 0.5, 9.5), M.bridge, 0, 1.0, 0, g); for (const s of [-1, 1]) add(box(0.14, 0.5, 9.5), M.bridge, s * 1.32, 1.45, 0, g, { cast: false }); }
  return g;
};
bridgeAt(6, false); bridgeAt(-8, true);
// city blocks on both banks (seeded, denser + taller near the centre)
{
  const r = P.rng(7);
  for (const gx of [-40, -33.5, -27, -20.5, -14, 14, 20.5, 27, 33.5, 40]) {
    for (let gz = -38; gz <= 38; gz += 6.8) {
      if (r() < 0.16) continue;
      const x = gx + (r() - 0.5) * 1.6, z = gz + (r() - 0.5) * 1.8;
      const w = 4.4 + r() * 1.8, d = 4.4 + r() * 1.8;
      const near = Math.max(0, 1 - Math.hypot(x, z + 2) / 30);
      const h = 1.6 + r() * 2.4 + near * r() * 2.2;
      add(box(w, h, d), blockMats[Math.floor(r() * blockMats.length)], x, h / 2, z, world);
      add(box(w + 0.18, 0.2, d + 0.18), M.roof, x, h + 0.1, z, world, { cast: false });
    }
  }
}
// trees along the banks
{
  const r = P.rng(21);
  for (let z = -44; z <= 44; z += 5.5) for (const sx of [-7.3, 7.3]) {
    if (Math.abs(z - 6) < 3 || Math.abs(z + 8) < 3.4 || r() < 0.25) continue;
    const x = sx + (r() - 0.5) * 0.5, zz = z + (r() - 0.5) * 2;
    add(new THREE.CylinderGeometry(0.08, 0.12, 0.8, 6), M.trunk, x, 0.4, zz, world, { cast: false });
    add(new THREE.IcosahedronGeometry(0.72 + r() * 0.3, 0), r() > 0.5 ? M.leaf : M.leaf2, x, 1.2 + r() * 0.25, zz, world, { cast: false });
  }
}
// soft horizon hills
const hillAt = (x, z, r, h, mat = M.hill) => { const g = add(new THREE.SphereGeometry(r, 14, 9), mat, x, -r * 0.45, z, world, { cast: false }); g.scale.y = h / r; return g; };
hillAt(-110, -130, 55, 22); hillAt(40, -150, 65, 26, M.hillFar); hillAt(140, -110, 50, 18); hillAt(-150, -70, 48, 16, M.hillFar); hillAt(90, 130, 55, 15); hillAt(-100, 140, 60, 18, M.hillFar);
// river glints (dawn light on the water; fade as the ash falls)
const glints = [];
{ const r = P.rng(31);
  for (let i = 0; i < 10; i++) {
    const m = flat(add(new THREE.PlaneGeometry(1.6 + r() * 1.6, 0.32), M.glint.clone(), (r() - 0.5) * 8, 0.03, -60 + r() * 120, world, { cast: false }));
    m.userData.ndSkip = true; m.userData.ph = r() * 6.28; glints.push(m);
  } }
// text boards (auto-fit font so long lines stay inside)
const boardTexCache = {};
const boardTex = (text, bg, fg) => {
  const key = text + bg; if (boardTexCache[key]) return boardTexCache[key];
  const c = document.createElement('canvas'); c.width = 1024; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 320); g.strokeStyle = fg; g.lineWidth = 12; g.strokeRect(14, 14, 996, 292);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 150; g.font = `bold ${fs}px Arial`;
  while (g.measureText(text).width > 930 && fs > 30) { fs -= 8; g.font = `bold ${fs}px Arial`; }
  g.fillText(text, 512, 168); const t = P.tex(c); boardTexCache[key] = t; return t;
};
const boardAt = (text, pos, w, bg, fg, ry = 0) => {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.y = ry; world.add(g);
  const m = add(new THREE.PlaneGeometry(w, w * 0.3125), new THREE.MeshBasicMaterial({ map: boardTex(text, bg, fg), fog: true }), 0, 0, 0, g, { cast: false });
  // boards stay IN the normal/depth pass: if they were ndSkip, the ink pass would
  // draw the edges of everything BEHIND a board right across its face.
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.06, 0.07, pos[1], 6), M.pole, s * w * 0.38, -pos[1] / 2 - 0.2, -0.1, g, { cast: false });
  return g;
};
const sunsBoard = boardAt('BRIGHTER THAN A THOUSAND SUNS', SUNS_POS, 11.5, '#26303c', '#ffd76a', 0.3);
const tempBoard = boardAt('HOTTER THAN THE SUN ITSELF', TEMP_POS, 7.0, '#3c2620', '#ffb754', -0.3);
const soundBoard = boardAt('FASTER THAN SOUND', SOUND_POS, 9.5, '#26303c', '#e8ddc4', -0.4);
const planesBoard = boardAt('HIGHER THAN PLANES FLY', PLANES_POS, 10.5, '#26303c', '#e8ddc4', 0.4);
const fireBoard = boardAt('THE BLAST IS OVER - THE FIRE IS BEGINNING', FIRE_POS, 12.5, '#2c2c30', '#ffb754', 0.25);
const closeBoard = boardAt('ALL THAT - IN LESS THAN 60 SECONDS', CLOSE_POS, 12.5, '#2c2c30', '#e8ddc4', 0);

// ---------- flight + event hardware (driven by worldAt) ----------
// the plane (built nose = +z; worldState lookAts it along its direction)
const planeG = new THREE.Group(); planeG.visible = false; world.add(planeG);
{ const fus = add(new THREE.CylinderGeometry(0.55, 0.42, 7, 12), M.plane, 0, 0, 0, planeG); fus.rotation.x = Math.PI / 2;
  const nose = add(new THREE.SphereGeometry(0.55, 12, 8), M.plane, 0, 0, 3.5, planeG); nose.scale.set(1, 1, 1.6);
  add(new THREE.ConeGeometry(0.42, 1.6, 10), M.plane, 0, 0, -4.2, planeG).rotation.x = -Math.PI / 2;
  add(box(6.6, 0.12, 2.2), M.plane, 0, -0.1, 0.4, planeG, { cast: false });
  add(box(2.7, 0.1, 0.8), M.plane, 0, 0.15, -3.6, planeG, { cast: false });
  add(box(0.1, 1.15, 0.85), M.plane, 0, 0.65, -3.6, planeG, { cast: false });
  for (const ex of [-2.2, -0.75, 0.75, 2.2]) add(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 8), M.planeDark, ex, -0.32, 0.45, planeG, { cast: false }).rotation.x = Math.PI / 2; }
// the bomb (a falling dot — small, dark, finned)
const bombG = new THREE.Group(); bombG.visible = false; world.add(bombG);
{ add(new THREE.CylinderGeometry(0.26, 0.26, 1.5, 10), M.bomb, 0, 0, 0, bombG);
  add(new THREE.ConeGeometry(0.26, 0.7, 10), M.bomb, 0, -1.1, 0, bombG).rotation.x = Math.PI;
  add(box(0.85, 0.5, 0.07), M.bomb, 0, 0.85, 0, bombG, { cast: false });
  add(box(0.07, 0.5, 0.85), M.bomb, 0, 0.85, 0, bombG, { cast: false }); }
// fireball: outer + inner spheres + halo billboard
const fireballG = new THREE.Group(); fireballG.visible = false; world.add(fireballG);
const fbOut = add(new THREE.SphereGeometry(1, 18, 14), M.fireOut, 0, 0, 0, fireballG, { cast: false }); fbOut.userData.ndSkip = true;
const fbIn = add(new THREE.SphereGeometry(0.62, 14, 10), M.fireIn, 0, 0, 0, fireballG, { cast: false }); fbIn.userData.ndSkip = true;
const fbGlow = add(new THREE.PlaneGeometry(4.2, 4.2), M.glow, 0, 0, 0, fireballG, { cast: false }); fbGlow.userData.ndSkip = true;
// mushroom cloud: stem + cap + crown, one smoke material whose colour cools over time
const cloudG = new THREE.Group(); cloudG.visible = false; cloudG.position.set(CENTRE[0], 0, CENTRE[2]); world.add(cloudG);
const cloudStem = add(new THREE.CylinderGeometry(1, 1.4, 1, 14, 1, true), M.cloud, 0, 0.5, 0, cloudG, { cast: false });
const cloudCapG = new THREE.Group(); cloudG.add(cloudCapG);
const cloudCap = add(new THREE.SphereGeometry(1, 18, 12), M.cloud, 0, 0, 0, cloudCapG, { cast: false });
const cloudTop = add(new THREE.SphereGeometry(0.55, 14, 10), M.cloud, 0, 0, 0, cloudCapG, { cast: false });
const CLOUD_HOT = new THREE.Color('#c98a5e'), CLOUD_GREY = new THREE.Color('#8f8a82');
// fireball palette by heat (story worldAt().fireball.heat): 1 = white-hot -> 0 = deep red
const FB_OUT_HOT = new THREE.Color('#ff8a3c'), FB_OUT_RED = new THREE.Color('#a82c16');
const FB_IN_HOT = new THREE.Color('#fff6d8'), FB_IN_RED = new THREE.Color('#ff4a1e');
// shockwave rings (flat ring meshes scaled up from the centre)
const ringMeshes = [0, 1].map((i) => {
  const m = flat(add(new THREE.RingGeometry(0.88, 1.0, 48), i ? M.dustRing : M.ring, CENTRE[0], 0.25 + i * 0.12, CENTRE[2], world, { cast: false }));
  m.userData.ndSkip = true; m.visible = false; return m;
});
// fires: pool of glow billboards + tiny flame cones
const firePool = [];
for (let i = 0; i < 42; i++) {
  const g = new THREE.Group(); g.visible = false; world.add(g);
  const gl = add(new THREE.PlaneGeometry(2.2, 2.2), M.fireGlow.clone(), 0, 0.3, 0, g, { cast: false }); gl.userData.ndSkip = true;
  const cone = add(new THREE.ConeGeometry(0.3, 0.9, 8), M.fireOut, 0, 0.45, 0, g, { cast: false }); cone.userData.ndSkip = true;
  g.userData.gl = gl; firePool.push(g);
}
// black rain: pool of dark falling streaks (camera-facing thin planes, driven by worldAt().rain)
const rainPool = [];
{ const rainMat = new THREE.MeshBasicMaterial({ color: '#14100c', transparent: true, fog: true, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 80; i++) { const m = add(new THREE.PlaneGeometry(0.14, 1), rainMat.clone(), 0, 0, 0, world, { cast: false }); m.userData.ndSkip = true; m.visible = false; rainPool.push(m); } }
// firestorm glow: one wide warm disc on the ground that the fire points merge into
const stormGlow = flat(add(new THREE.PlaneGeometry(64, 64), M.fireGlow.clone(), CENTRE[0], 0.06, CENTRE[2], world, { cast: false }));
stormGlow.userData.ndSkip = true; stormGlow.material.opacity = 0;
// walking figures: pool of simple dark silhouettes
const figPool = [];
for (let i = 0; i < 12; i++) {
  const g = new THREE.Group(); g.visible = false; g.scale.setScalar(1.3); world.add(g);
  add(new THREE.CylinderGeometry(0.13, 0.17, 0.62, 8), M.figure, 0, 0.42, 0, g);
  add(new THREE.SphereGeometry(0.13, 8, 7), M.figure, 0, 0.86, 0, g);
  figPool.push(g);
}
// painted sky clouds (billboards, as in the house engine)
const clouds = [];
{ const r = P.rng(90);
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const pen = new T.Pen(c.getContext('2d')); pen.ol = 0;
    pen.g.translate(300, 200); pen.g.scale(1.4, 1.2); pen.g.translate(-300, -200); T.fxCloud(pen, i + 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.667), new THREE.MeshBasicMaterial({ map: P.tex(c), transparent: true, fog: false, depthWrite: false }));
    const a = r() * Math.PI * 2, d = 700 + r() * 250; m.position.set(Math.cos(a) * d, 130 + r() * 150, Math.sin(a) * d); m.scale.setScalar(110 + r() * 90);
    m.userData.ndSkip = true; m.renderOrder = -1; scene.add(m); clouds.push(m);
  } }

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25; // canvas px, card height in metres (design 600x1000 -> 2.25 m)
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

// ---------- render targets & post ----------
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
      if (card && ds > 0.) continue;            // character cards: never outlined by the world ink
      if (card) ds = 1e4;                        // sky
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));                           // depth jump, near side only
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9); // crease
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
    c = mix(c, flash < 0. ? vec3(0.) : vec3(1.), clamp(abs(flash), 0., 1.)); // flash>0: white flash; flash<0: dip to black
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
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
  // painted sky clouds follow the light (near-black in the void hook, dim under the storm)
  const ck = Math.max(0.07, Math.min(1, L.hemi * 0.8));
  for (const c of clouds) c.material.color.setScalar(ck);
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}

function worldState(W, f) {
  // the city under ash: every registered material lerps toward its ash twin
  for (const e of CITY_FADE) e.m.color.copy(e.base).lerp(e.ash, W.cityDark);
  // plane + bomb
  planeG.visible = !!W.plane;
  if (W.plane) { planeG.position.set(...W.plane.p); tmpV.set(W.plane.p[0] + W.plane.d[0], W.plane.p[1] + W.plane.d[1], W.plane.p[2] + W.plane.d[2]); planeG.lookAt(tmpV); }
  bombG.visible = !!W.bomb;
  if (W.bomb) { bombG.position.set(...W.bomb.p); bombG.rotation.y = f * 0.02; }
  // fireball
  fireballG.visible = !!W.fireball;
  if (W.fireball) {
    fireballG.position.set(...W.fireball.p); fireballG.scale.setScalar(W.fireball.s);
    M.fireOut.opacity = W.fireball.a; M.fireIn.opacity = W.fireball.a;
    const heat = W.fireball.heat ?? 1; // palette cools white -> orange -> deep red with the story
    // single visible sphere: the OUTER one carries the white-hot core colour; the
    // orange atmosphere comes from the glow billboard around it (see fbGlow + fxAt)
    M.fireOut.color.copy(FB_IN_RED).lerp(FB_IN_HOT, heat);
    M.fireIn.color.copy(FB_OUT_RED).lerp(FB_OUT_HOT, heat);
    fbGlow.material.opacity = 0.52 * W.fireball.a; fbGlow.quaternion.copy(camera.quaternion);
    const wob = 1 + 0.05 * Math.sin(f * 0.9); fbOut.scale.set(wob, 1 / wob, wob); fbIn.scale.set(0.6 * wob, 0.6 / wob, 0.6 * wob);
  }
  // mushroom cloud
  cloudG.visible = !!W.cloud;
  if (W.cloud) {
    const C = W.cloud;
    cloudStem.scale.set(C.stemR, C.stemH, C.stemR); cloudStem.position.y = C.stemH / 2;
    cloudCapG.position.set(C.drift, C.capY, 0);
    cloudCap.scale.set(C.capR, C.capR * C.capFlat, C.capR);
    cloudTop.position.y = C.capR * C.capFlat * 0.75; cloudTop.scale.setScalar(C.capR * 0.68);
    M.cloud.color.copy(CLOUD_HOT).lerp(CLOUD_GREY, C.colT); M.cloud.opacity = C.a;
  }
  // shockwave rings: mesh 0 = the bright front, mesh 1 = its dust skirt (slightly behind)
  const rings = W.rings || [];
  ringMeshes.forEach((m, i) => {
    const R = rings[0];
    m.visible = !!R;
    if (R) { const rr = i ? R.r * 0.96 : R.r; m.scale.set(rr, rr, 1); m.material.opacity = (i ? 0.35 : 0.9) * R.a; }
  });
  // fires
  firePool.forEach((g, i) => {
    const F = W.fires[i];
    g.visible = !!F;
    if (F) { g.position.set(...F.p); g.scale.setScalar(F.s); g.userData.gl.material.opacity = F.a; g.userData.gl.quaternion.copy(camera.quaternion); }
  });
  // walking figures
  figPool.forEach((g, i) => {
    const F = W.figures[i];
    g.visible = !!F;
    if (F) { g.position.set(...F.p); g.rotation.y = F.yaw; }
  });
  // river glints shimmer until the ash
  for (const m of glints) m.material.opacity = (0.16 + 0.3 * (0.5 + 0.5 * Math.sin(f * 0.3 + m.userData.ph))) * (1 - W.cityDark);
  // black rain streaks (billboarded so they read at any camera angle)
  const rain = W.rain || [];
  rainPool.forEach((m, i) => {
    const R = rain[i];
    m.visible = !!R;
    if (R) { m.position.set(R.p[0], R.p[1], R.p[2]); m.scale.set(1, R.len, 1); m.material.opacity = R.a * 0.85; m.quaternion.copy(camera.quaternion); }
  });
  // firestorm glow under the fire points
  stormGlow.material.opacity = (W.stormGlow || 0) * 0.5;
  // boards
  sunsBoard.visible = W.boards.suns; tempBoard.visible = W.boards.temp; soundBoard.visible = W.boards.sound;
  planesBoard.visible = W.boards.planes; fireBoard.visible = W.boards.fire; closeBoard.visible = W.boards.close;
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
    if (a.blob !== false && a.y < 6.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0; if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};

window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const W_ = worldAt(f); worldState(W_, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  for (const c of clouds) c.quaternion.copy(camera.quaternion);
  // pass A: colour
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  // pass B: normal + depth
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  // ink + grade
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  // lens
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
