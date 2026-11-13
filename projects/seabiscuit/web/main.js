import * as THREE from './lib/three.module.js';
import * as T0 from './toon.js';
import { horseCard, fxSpark } from './extras.js';
const T = { ...T0, horseCard, fxSpark };
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARDS } from './story.js';

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

const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  dirt: texM(P.dirt(51), 16, 8, '#c2a878'), grass: texM(P.grass(52), 24, 12, '#7d9a52'), grassDk: texM(P.grass(53), 8, 8, '#68854880'.slice(0, 7)),
  beam: texM(P.beam(54), 1, 2), beamDark: texM(P.beam(55, [46, 40, 34]), 1, 2),
  panel: texM(P.panelMetal(56, [96, 110, 96]), 2, 1, '#aebba8'), plaster: texM(P.plaster(57), 4, 2, '#e8e2d2'),
  stone: texM(P.stone(58), 1, 1),
};
const MW = {
  white: toon({ color: '#f0f2ee' }), rail: toon({ color: '#e8eae4' }), iron: toon({ color: '#2c2e33' }),
  leaf: toon({ color: '#5d7a35' }), leafDk: toon({ color: '#49652c' }), trunk: toon({ color: '#6a5138' }),
  red: toon({ color: '#b03a30' }), gold: toon({ color: '#c9973f' }), green: toon({ color: '#3f6a4a' }),
  shade: new THREE.MeshBasicMaterial({ color: 0x2c2416, transparent: true, opacity: 0.2, depthWrite: false }),
};
// grandstand crowd: dotted canvas
const crowdTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#8a8474'; g.fillRect(0, 0, 512, 128); const r = P.rng(99);
  const cols = ['#c25a4a', '#4a6a9a', '#d9c9a6', '#5d7a35', '#e8e2d2', '#7a5a8a', '#3a3e44'];
  for (let i = 0; i < 900; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.beginPath(); g.arc(r() * 512, 12 + r() * 104, 2.6 + r() * 2.2, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

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

const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

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

// ---------- the racetrack set ----------
const world = new THREE.Group(); scene.add(world);
{ // dirt track in front, infield grass beyond the rail, apron behind camera side
  add(tbox(70, 0.06, 9, 2), M.dirt, 0, -0.03, 2.2, world, { cast: false });
  add(tbox(70, 0.05, 26, 2), M.grass, 0, -0.045, -16, world, { cast: false });
  add(tbox(70, 0.05, 6, 2), M.dirt, 0, -0.055, 9, world, { cast: false });
  // harrow lines on the dirt
  for (let i = 0; i < 9; i++) add(tbox(70, 0.012, 0.07, 2), M.beamDark, 0, 0.004, -1.4 + i * 0.95, world, { cast: false }).material = toon({ color: '#a8906144'.slice(0, 7) });
}
// the white running rail (z=-2.1) with posts
{
  for (let x = -20; x <= 20; x += 2.5) add(new THREE.CylinderGeometry(0.045, 0.055, 1.15, 8), MW.rail, x, 0.57, -2.1, world, { cast: false });
  const r1 = add(new THREE.CylinderGeometry(0.035, 0.035, 41, 8), MW.rail, 0, 1.12, -2.1, world, { cast: false }); r1.rotation.z = Math.PI / 2;
  const r2 = add(new THREE.CylinderGeometry(0.03, 0.03, 41, 8), MW.rail, 0, 0.62, -2.1, world, { cast: false }); r2.rotation.z = Math.PI / 2;
  // a second rail far side (infield far edge) for depth
  for (let x = -24; x <= 24; x += 4) add(new THREE.CylinderGeometry(0.04, 0.05, 1.0, 7), MW.rail, x, 0.5, -13.5, world, { cast: false });
  const r3 = add(new THREE.CylinderGeometry(0.03, 0.03, 49, 8), MW.rail, 0, 0.98, -13.5, world, { cast: false }); r3.rotation.z = Math.PI / 2;
}
// finish post at x=2.4
{
  add(new THREE.CylinderGeometry(0.06, 0.07, 1.9, 9), MW.white, 2.4, 0.95, -1.6, world, { cast: false });
  add(new THREE.SphereGeometry(0.11, 10, 8), MW.red, 2.4, 1.98, -1.6, world, { cast: false });
  add(tbox(0.5, 0.3, 0.05, 2), MW.red, 2.4, 1.55, -1.6, world, { cast: false });
}
// grandstand far back + mountains + palms
{
  const gs = new THREE.Group(); gs.position.set(-2, 0, -20); world.add(gs);
  add(tbox(26, 2.2, 3, 2), M.plaster, 0, 1.1, 0, gs, { cast: false });
  const crowd = add(new THREE.PlaneGeometry(25, 2.6), new THREE.MeshBasicMaterial({ map: crowdTex, fog: true }), 0, 3.6, 0.8, gs, { cast: false }); crowd.userData.ndSkip = true;
  const tiers = add(tbox(26, 0.16, 4.6, 2), M.panel, 0, 2.28, 0.4, gs, { cast: false });
  const roof = add(tbox(27, 0.18, 5.4, 2), M.beamDark, 0, 5.6, 0.2, gs, { cast: false }); roof.rotation.x = 0.12;
  for (const px of [-12, -6, 0, 6, 12]) add(new THREE.CylinderGeometry(0.09, 0.09, 3.3, 7), MW.iron, px, 3.9, 2.2, gs, { cast: false });
  // San Gabriel mountains, hazy ridges
  const mMat = toon({ color: '#8a97a8' }), mMat2 = toon({ color: '#a4b0bc' });
  const ridge = (z, h, m, seed) => { const r = P.rng(seed); for (let i = 0; i < 7; i++) { const w = 14 + r() * 10, hh = h * (0.7 + r() * 0.6); const cone = add(new THREE.ConeGeometry(w / 2, hh, 5), m, -42 + i * 14 + r() * 4, hh / 2 - 0.5, z, world, { cast: false }); cone.scale.z = 0.4; } };
  ridge(-46, 9, mMat2, 5); ridge(-38, 6.5, mMat, 9);
}
const palmAt = (x, z, s = 1) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); world.add(g);
  const trunk = add(new THREE.CylinderGeometry(0.11, 0.2, 4.6, 8), MW.trunk, 0, 2.3, 0, g, { cast: false }); trunk.rotation.z = 0.06;
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const fr = add(new THREE.ConeGeometry(0.32, 2.6, 5), i % 2 ? MW.leaf : MW.leafDk, Math.cos(a) * 1.1, 4.85, Math.sin(a) * 1.1, g, { cast: false }); fr.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15 + Math.PI); fr.scale.set(1, 1, 0.24); }
  return g;
};
palmAt(-9.5, -8, 1.15); palmAt(11, -9.5, 1.3); palmAt(16.5, -5, 0.95); palmAt(-15, -4.5, 1.0);
// starting gate (two stalls) at the left
{
  const gate = new THREE.Group(); gate.position.set(-5.2, 0, -0.4); gate.rotation.y = 0.06; world.add(gate);
  for (const gx of [-1.05, 0, 1.05]) add(tbox(0.09, 2.3, 1.6, 2), M.panel, gx, 1.15, 0, gate, { cast: false });
  add(tbox(2.3, 0.14, 1.7, 2), M.panel, 0, 2.36, 0, gate, { cast: false });
  add(tbox(0.95, 2.1, 0.06, 2), MW.green, -0.52, 1.05, 0.82, gate, { cast: false });
  add(tbox(0.95, 2.1, 0.06, 2), MW.green, 0.52, 1.05, 0.82, gate, { cast: false });
  const n1 = textBoard(['1'], 0.4, 0.4, '#f0f2ee', '#2c4a34'); n1.position.set(-0.52, 2.62, 0.4); gate.add(n1);
  const n2 = textBoard(['2'], 0.4, 0.4, '#f0f2ee', '#2c4a34'); n2.position.set(0.52, 2.62, 0.4); gate.add(n2);
}
// stable block far left (P1-2 dressing)
{
  const st = new THREE.Group(); st.position.set(-11.5, 0, -7); st.rotation.y = 0.5; world.add(st);
  add(tbox(5.4, 2.3, 2.6, 2), M.plaster, 0, 1.15, 0, st, { cast: false });
  const rf = add(tbox(5.9, 0.13, 3.1, 2), M.beamDark, 0, 2.62, 0, st, { cast: false }); rf.rotation.x = 0.3;
  add(tbox(0.9, 1.7, 0.07, 2), M.beamDark, -1.2, 0.85, 1.32, st, { cast: false });
  add(tbox(0.9, 1.7, 0.07, 2), M.beamDark, 1.2, 0.85, 1.32, st, { cast: false });
}
// ---- tote board (match-race board) on the infield ----
const tote = new THREE.Group(); tote.position.set(6.4, 0, -7.5); tote.rotation.y = -0.22; world.add(tote);
{
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.07, 0.09, 3.1, 8), M.beamDark, sd * 1.35, 1.55, -0.1, tote, { cast: false });
  add(tbox(3.3, 1.9, 0.14, 2), M.beamDark, 0, 2.6, -0.12, tote, { cast: false });
}
// ---- rail sign (hook + odds) + winner's circle fence + roses ----
const sign = new THREE.Group(); sign.position.set(0.8, 0, -1.85); sign.rotation.y = 0.14; world.add(sign);
{
  add(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 8), MW.iron, 0, 0.95, -0.06, sign, { cast: false });
}
const circ = new THREE.Group(); circ.position.set(4.6, 0, 3.4); world.add(circ);
{
  for (let i = 0; i <= 8; i++) { const a = -0.4 + i * 0.32; add(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 7), MW.white, Math.sin(a) * 2.6, 0.47, -Math.cos(a) * 2.6 + 2.6, circ, { cast: false }); }
  const rr = add(new THREE.TorusGeometry(2.6, 0.028, 6, 40, 2.6), MW.white, 0, 0.92, 2.6, circ, { cast: false }); rr.rotation.x = Math.PI / 2; rr.rotation.z = Math.PI / 2 - 1.3;
  // roses hedge: green arcs dotted red
  const hedge = add(tbox(3.4, 0.55, 0.5, 2), MW.leafDk, 0, 0.28, -1.9, circ, { cast: false });
  const r = P.rng(61); for (let i = 0; i < 26; i++) add(new THREE.SphereGeometry(0.055, 7, 6), MW.red, -1.6 + r() * 3.2, 0.42 + r() * 0.2, -1.72 + (r() - 0.5) * 0.2, circ, { cast: false });
}
const boardMeshes = {};
{
  const signDefs = {
    hook: [['SANTA ANITA', '1940'], '#37455c', '#e8eef8'],
    odds: [['ODDS', '100 - TO - 1'], '#5c2e2e', '#ffe9a8'],
  };
  for (const [id, [lines, bg, fg]] of Object.entries(signDefs)) {
    const b = textBoard(lines, 1.5, 0.92, bg, fg); b.position.set(0, 1.45, 0); sign.add(b); boardMeshes[id] = b;
  }
  const match = textBoard(['THE MATCH RACE', 'SEABISCUIT vs WAR ADMIRAL'], 3.1, 1.7, '#f0ead2', '#37455c');
  match.position.set(0, 2.6, 0); tote.add(match); boardMeshes.match = match;
  const fin = textBoard(['SEABISCUIT', 'CHAMPION'], 1.5, 0.92, '#4a3421', '#ffe9a8');
  fin.position.set(0, 0.78, -1.55); circ.add(fin); boardMeshes.finale = fin;
  add(new THREE.CylinderGeometry(0.045, 0.055, 1.5, 7), MW.iron, 0, 0.75, -1.62, circ, { cast: false });
}

// ---------- FX: gallop DUST (tan smoke) + clouds ----------
const smoke = new FX.Smoke(scene, 110); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dust = smoke.addEmitter(0, 0.25, 0, { rate: 0, color: 0xd8c096, opacity: 0.34, scale: 0.55, grow: 2.0, life: 0.9, vy: 0.7, wind: 0.4 });
const dust2 = smoke.addEmitter(0, 0.25, 0, { rate: 0, color: 0xcbb489, opacity: 0.26, scale: 0.7, grow: 2.2, life: 1.1, vy: 0.55, wind: 0.4 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 60, opacity: 0.26, color: 0xffffff, drift: 0.4 });
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
    dust.rate = pr.dustRate || 0; dust2.rate = (pr.dustRate || 0) * 0.7;
    if (pr.dustPos) { dust.x = pr.dustPos[0]; dust.y = pr.dustPos[1]; dust.z = pr.dustPos[2]; dust2.x = pr.dustPos[0] - 0.7; dust2.y = pr.dustPos[1]; dust2.z = pr.dustPos[2] + 0.3; }
    smoke.update(t, dt);
    fxClouds.update(t, dt);
  }
};

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('30,24,14', 0.6));
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
  setB(boardMeshes.hook, Ws.boardHook || 0); setB(boardMeshes.odds, Ws.boardOdds || 0); setB(boardMeshes.match, Ws.boardMatch || 0); setB(boardMeshes.finale, Ws.boardFinale || 0);
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
window.boardNDC = (f) => {
  const C = camAt(f);
  const cam = new THREE.PerspectiveCamera(C.fov, W / H, 0.08, 1500);
  cam.position.set(...C.pos); cam.up.set(0, 1, 0); cam.lookAt(...C.look); cam.rotateZ(rx(C.roll || 0));
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const Ws = worldAt(f);
  return BOARDS.map((b) => {
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    const right = [cy, 0, -sy], up = [0, 1, 0];
    const corners = [];
    for (const [sx, sy2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = new THREE.Vector3(
        b.pos[0] + right[0] * sx * b.w / 2 + up[0] * sy2 * b.h / 2,
        b.pos[1] + right[1] * sx * b.w / 2 + up[1] * sy2 * b.h / 2,
        b.pos[2] + right[2] * sx * b.w / 2 + up[2] * sy2 * b.h / 2);
      const n = p.clone().project(cam);
      corners.push([+n.x.toFixed(3), +n.y.toFixed(3), +(p.distanceTo(cam.position)).toFixed(2)]);
    }
    return { id: b.id, op: b.key ? (Ws[b.key] || 0) : 1, corners };
  });
};
window.TOTAL = TOTAL;
window.ready = true;
