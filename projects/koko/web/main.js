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

// ---------- the enclosure (single set, whole video) ----------
const world = new THREE.Group(); scene.add(world);
{
  // layered ground: grass base + dirt clearing + darker grass patches + canopy shade
  flat(add(new THREE.CircleGeometry(60, 40), M.grass, 0, -0.03, -4, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(5.6, 28), M.dirt, 0, -0.015, 0.4, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(3.2, 20), M.grassDk, -6.5, -0.02, -5, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(2.6, 20), M.grassDk, 6.8, -0.02, -4.4, world, { cast: false }));
  for (const [sx, sz, sr] of [[-3.4, -3.2, 2.6], [3.8, -3.6, 2.8], [0.5, -6.5, 3.4]]) {
    const sh = flat(add(new THREE.CircleGeometry(sr, 20), MW.shade, sx, 0.005, sz, world, { cast: false }));
    sh.userData.ndSkip = true; sh.renderOrder = 1;
  }
  // scattered leaves on the clearing
  const leafR = P.rng(87);
  for (let i = 0; i < 46; i++) {
    const a = leafR() * Math.PI * 2, d = 1 + leafR() * 5.2;
    const lf = flat(add(new THREE.CircleGeometry(0.05 + leafR() * 0.05, 6), i % 3 ? MW.leafDk : MW.leafLt, Math.cos(a) * d, 0.008, 0.4 + Math.sin(a) * d * 0.8, world, { cast: false }));
    lf.userData.ndSkip = true;
  }
  // rock back wall + side rocks
  add(tbox(26, 3.1, 1.1, 2), M.wallRock, 0, 1.5, -9.6, world, { cast: false });
  add(tbox(1.1, 2.2, 16, 2), M.wallRock, -10.5, 1.05, -3, world, { cast: false });
  add(tbox(1.1, 2.2, 16, 2), M.wallRock, 10.5, 1.05, -3, world, { cast: false });
  for (const [rx2, rz, rs] of [[-7.6, -7.6, 0.9], [8.1, -7.2, 1.15], [-8.8, -4.5, 0.6], [9.0, -3.4, 0.7]]) {
    const r = add(new THREE.SphereGeometry(rs, 10, 8), M.stone, rx2, rs * 0.4, rz, world, { cast: false }); r.scale.y = 0.72;
  }
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
treeAt(-3.4, -3.4, 5.6); treeAt(3.8, -3.8, 6.1, -0.05); treeAt(-5.6, -6.8, 4.8); treeAt(6.2, -7.0, 5.2); treeAt(-8.6, -1.5, 4.6);
{ // rope + tyre swing hanging from the right tree's branch zone
  const g = new THREE.Group(); g.position.set(2.9, 0, -2.3); world.add(g);
  add(new THREE.CylinderGeometry(0.028, 0.028, 2.5, 6), MW.rope, 0, 3.1, 0, g, { cast: false });
  const tyre = add(new THREE.TorusGeometry(0.34, 0.11, 10, 20), MW.tyre, 0, 1.72, 0, g, { cast: false }); tyre.rotation.x = Math.PI / 2;
  g.userData.swing = true; world.userData.swing = g;
}
{ // wooden platform (climbing deck) behind-left
  const g = new THREE.Group(); g.position.set(-1.2, 0, -3.6); g.rotation.y = 0.15; world.add(g);
  add(tbox(2.6, 0.14, 1.7, 2), M.plank, 0, 0.92, 0, g);
  for (const [sx, sz] of [[-1.15, -0.7], [1.15, -0.7], [-1.15, 0.7], [1.15, 0.7]]) add(new THREE.CylinderGeometry(0.07, 0.08, 0.92, 7), MW.trunkDk, sx, 0.46, sz, g, { cast: false });
  add(tbox(2.6, 0.09, 0.24, 2), MW.trunkDk, 0, 1.32, -0.82, g, { cast: false });
  for (const sx of [-1.15, 1.15]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), MW.trunkDk, sx, 1.1, -0.82, g, { cast: false });
  const ball = add(new THREE.SphereGeometry(0.17, 12, 10), MW.red, 0.7, 1.16, 0.2, g, { cast: false }); ball.userData.ndSkip = false;
}
// foreground / midground props: bowl, book, ball, blocks, chair + picture cards, blanket
{
  const bowl = add(new THREE.CylinderGeometry(0.3, 0.2, 0.16, 14, 1, true), toon({ color: '#8a4a3a', side: THREE.DoubleSide }), -1.25, 0.08, 1.85, world, { cast: false }); bowl.userData.ndSkip = true;
  add(new THREE.SphereGeometry(0.15, 10, 8), toon({ color: '#d9a441' }), -2.3, 0.15, -0.9, world, { cast: false }); // toy ball
  const book = add(tbox(0.42, 0.06, 0.3, 2), toon({ color: '#4a6a9a' }), 0.95, 0.03, 2.1, world, { cast: false }); book.rotation.y = 0.5;
  for (const [bx, bz, bc] of [[-2.9, 1.9, '#b03a30'], [-2.62, 1.98, '#d9a441'], [2.9, 2.3, '#4a6a9a']]) add(tbox(0.22, 0.22, 0.22, 2), toon({ color: bc }), bx, 0.11, bz, world, { cast: false });
  // Patterson's chair at (-1.1,0,0.55) facing Koko (+x side)
  const ch = new THREE.Group(); ch.position.set(-1.55, 0, 1.05); ch.rotation.y = 1.25; world.add(ch);
  add(tbox(0.62, 0.07, 0.58, 2), M.beam, 0, 0.47, 0, ch, { cast: false });
  add(tbox(0.62, 0.72, 0.07, 2), M.beam, 0, 0.86, -0.26, ch, { cast: false });
  for (const [sx, sz] of [[-0.26, -0.23], [0.26, -0.23], [-0.26, 0.23], [0.26, 0.23]]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.47, 6), M.beamDark, sx, 0.235, sz, ch, { cast: false });
  // picture-card easel beside the chair: three big white cards with simple shapes
  const pe = new THREE.Group(); pe.position.set(-1.7, 0, -0.15); pe.rotation.y = 0.55; world.add(pe);
  add(new THREE.CylinderGeometry(0.04, 0.05, 1.15, 6), M.beamDark, 0, 0.57, 0, pe, { cast: false });
  const cardCols = ['#e0aa72', '#a8c48a', '#93b4cc'];
  cardCols.forEach((cc, i) => {
    const pc = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.66), new THREE.MeshBasicMaterial({ color: cc, fog: true }));
    pc.position.set((i - 1) * 0.34, 0.92, 0.03 + Math.abs(i - 1) * -0.02); pc.rotation.z = (i - 1) * 0.13; pc.userData.ndSkip = true; pe.add(pc);
  });
  // the blanket (kitten choosing + the empty blanket of the sad beats)
  const bl = add(tbox(1.6, 0.045, 1.25, 2), M.blanket, 1.7, 0.023, 1.4, world, { cast: false }); bl.rotation.y = -0.12;
}
// gift box (S6 anticipation) — fades/scales in via worldAt giftT
const giftG = new THREE.Group(); giftG.position.set(-0.85, 0, 1.15); world.add(giftG);
{
  add(tbox(0.52, 0.38, 0.52, 2), MW.gift, 0, 0.19, 0, giftG);
  add(tbox(0.58, 0.09, 0.58, 2), MW.gift, 0, 0.42, 0, giftG, { cast: false });
  add(box(0.1, 0.48, 0.54), MW.giftRib, 0, 0.22, 0, giftG, { cast: false });
  add(box(0.54, 0.48, 0.1), MW.giftRib, 0, 0.22, 0, giftG, { cast: false });
}
// glass wall (visitors behind it) + glint
const glassMat = FX.glassMat(0xcfe4ee, 0.16);
const glassWall = add(new THREE.PlaneGeometry(15, 3.6), glassMat, 0, 1.8, -5.5, world, { cast: false });
glassWall.userData.ndSkip = true;
{
  for (let i = -3; i <= 3; i++) add(tbox(0.12, 3.6, 0.12, 2), M.beamDark, i * 2.4, 1.8, -5.48, world, { cast: false });
  add(tbox(15, 0.14, 0.14, 2), M.beamDark, 0, 3.62, -5.48, world, { cast: false });
}
const glassGlint = FX.glint(0.7); glassGlint.position.set(-1.5, 2.4, -5.3); glassGlint.userData.ndSkip = true; world.add(glassGlint);
// ---- boards: ONE easel carries every board (signs / words / KOKO tribute / finale);
// posts stand WIDE of every board so no post ever crosses board text ----
const mkEasel = (x, z, ry, w) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.055, 0.07, 2.2, 7), M.beamDark, sd * (w / 2 + 0.14), 1.1, -0.06, g, { cast: false });
  add(tbox(w + 0.42, 0.1, 0.08, 2), M.beam, 0, 2.22, -0.06, g, { cast: false });
  return g;
};
const bigEasel = mkEasel(1.31, -0.45, -0.1, 1.5);
const boardSigns = textBoard(['MORE THAN', '1,000 SIGNS'], 1.3, 0.84, '#4a3421', '#ffe9a8'); boardSigns.position.set(0, 1.34, 0); bigEasel.add(boardSigns);
const boardKOKO = textBoard(['KOKO'], 1.3, 0.84, '#5a2e3e', '#ffd9e2'); boardKOKO.position.set(0, 1.34, 0); bigEasel.add(boardKOKO);
const boardFinale = textBoard(['1,000 SIGNS.', 'ONE GORILLA.'], 1.42, 0.9, '#4a3421', '#ffe9a8'); boardFinale.position.set(0, 1.32, 0); bigEasel.add(boardFinale);
const wordSAD = textBoard(['SAD'], 1.1, 0.7, '#37455c', '#e8eef8'); wordSAD.position.set(0, 1.3, 0); bigEasel.add(wordSAD);
const wordCAT = textBoard(['CAT'], 1.1, 0.7, '#5c4637', '#ffe9a8'); wordCAT.position.set(0, 1.3, 0); bigEasel.add(wordCAT);
const wordLOVE = textBoard(['LOVE'], 1.1, 0.7, '#7a2e3e', '#ffd9e2'); wordLOVE.position.set(0, 1.3, 0); bigEasel.add(wordLOVE);
{ // flowers at the tribute easel's feet (small, clustered at the base sides)
  const cols = ['#e86e8a', '#e8c45a', '#eef2f6', '#c25a7a'];
  for (let i = 0; i < 9; i++) {
    const fx2 = -0.5 + i * 0.125, fz = 0.2 + (i % 2) * 0.08;
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 5), MW.leafDk, fx2, 0.1, fz, bigEasel, { cast: false });
    add(new THREE.SphereGeometry(0.034, 8, 6), toon({ color: cols[i % 4] }), fx2, 0.23, fz, bigEasel, { cast: false });
  }
}
const boardGlint = FX.glint(0.45); boardGlint.position.set(1.95, 2.15, -0.1); boardGlint.userData.ndSkip = true; world.add(boardGlint);
// grass tufts (sway via worldAt grassK)
const grassTufts = [];
{ const r = P.rng(61);
  for (let i = 0; i < 110; i++) {
    const a = r() * Math.PI * 2, d = 3.4 + r() * 9, x = Math.cos(a) * d, z = -1 + Math.sin(a) * d;
    if (Math.hypot(x, z - 0.4) < 3.1 || Math.hypot(x - 1.7, z - 1.4) < 1.3 || (Math.abs(x - 1.31) < 1.25 && Math.abs(z + 0.45) < 1.2)) continue;
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
  setB(boardSigns, Ws.boardSigns || 0); setB(boardKOKO, Ws.boardKOKO || 0); setB(boardFinale, Ws.boardFinale || 0);
  setB(wordSAD, Ws.boardSAD || 0); setB(wordCAT, Ws.boardCAT || 0); setB(wordLOVE, Ws.boardLOVE || 0);
  boardGlint.material.opacity = Math.max(Ws.boardSigns || 0, Ws.boardFinale || 0, Ws.boardKOKO || 0) * (0.5 + 0.3 * Math.sin(f * 0.33));
  giftG.visible = (Ws.giftT || 0) > 0.01; giftG.scale.setScalar(0.6 + 0.4 * (Ws.giftT || 0));
  glassMat.opacity = 0.1 + 0.1 * (Ws.glassT || 0);
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
