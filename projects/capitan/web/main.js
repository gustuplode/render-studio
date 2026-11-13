import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, dogPosAt, searchPosAt } from './story.js';

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
  stone: texM(P.stone(4), 1, 1), stoneOld: texM(P.stone(11, 30, 8, 52), 1, 1),
  marble: texM(P.marble(10), 1, 1),
  dirt: texM(P.dirt(7), 10, 10, '#c9b088'),
  grass: texM(P.grass(6), 26, 26, '#8ba262'),
  grassDk: texM(P.grass(16), 8, 8, '#6d8448'),
  wallRock: texM(P.stone(14, 30, 10, 58), 6, 2, '#a89c88'),
  plaster: texM(P.plaster(8), 3, 2, '#e8d9bc'),
  roof: texM(P.roof(9), 4, 2, '#b06a4a'),
  doorWood: texM(P.planks(5), 1, 2, '#8a6844'),
};
const MW = {
  leaf: toon({ color: '#4d6a30' }), leafDk: toon({ color: '#3a5426' }), leafLt: toon({ color: '#68884a' }),
  cypress: toon({ color: '#2e4a2e' }), cypressDk: toon({ color: '#243d24' }),
  trunk: toon({ color: '#6d5136' }), trunkDk: toon({ color: '#54402a' }),
  iron: toon({ color: '#2c2e33' }), white: toon({ color: '#eef2f6' }),
  gold: toon({ color: '#d9a441' }), red: toon({ color: '#b03a30' }),
  shade: new THREE.MeshBasicMaterial({ color: 0x1e3018, transparent: true, opacity: 0.2, depthWrite: false }),
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

// ---------- the set: house (west) + path + cemetery (east), one world ----------
export const GRAVE = [2.4, 0, -2.2];
const world = new THREE.Group(); scene.add(world);
{
  // layered ground: grass base + cemetery dirt + garden dirt at the house + the path
  flat(add(new THREE.CircleGeometry(70, 40), M.grass, 0, -0.03, -2, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(7.6, 28), M.dirt, 2.6, -0.015, -3, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(3.4, 20), M.grassDk, -6.5, -0.02, -5, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(3.0, 20), M.dirt, -5.4, -0.018, 5.6, world, { cast: false }));
  // path: chained dirt discs from the cemetery gate to the house door
  const pathPts = [[2.4, 1.6], [1.9, 2.8], [1.1, 4.0], [0.0, 5.0], [-1.4, 5.6], [-2.8, 5.9], [-4.2, 6.0], [-5.2, 5.9]];
  for (const [px, pz] of pathPts) flat(add(new THREE.CircleGeometry(0.85, 14), M.dirt, px, -0.008, pz, world, { cast: false }));
  for (const [sx, sz, sr] of [[0.2, -3.4, 3.0], [4.6, -4.2, 2.6], [-4.2, 1.2, 2.2]]) {
    const sh = flat(add(new THREE.CircleGeometry(sr, 20), MW.shade, sx, 0.005, sz, world, { cast: false }));
    sh.userData.ndSkip = true; sh.renderOrder = 1;
  }
  // scattered leaves
  const leafR = P.rng(87);
  for (let i = 0; i < 52; i++) {
    const a = leafR() * Math.PI * 2, d = 1 + leafR() * 8;
    const lf = flat(add(new THREE.CircleGeometry(0.05 + leafR() * 0.05, 6), i % 3 ? MW.leafDk : MW.leafLt, 1.5 + Math.cos(a) * d, 0.008, -1 + Math.sin(a) * d * 0.8, world, { cast: false }));
    lf.userData.ndSkip = true;
  }
}
// ----- cemetery: low stone wall (gap at the south gate), rows of shaped headstones -----
{
  add(tbox(9.6, 1.0, 0.35, 2), M.wallRock, 2.5, 0.5, -7.2, world, { cast: false });
  add(tbox(0.35, 1.0, 8.4, 2), M.wallRock, -2.2, 0.5, -3.1, world, { cast: false });
  add(tbox(0.35, 1.0, 8.4, 2), M.wallRock, 7.2, 0.5, -3.1, world, { cast: false });
  add(tbox(3.6, 1.0, 0.35, 2), M.wallRock, -0.4, 0.5, 1.0, world, { cast: false });
  add(tbox(3.9, 1.0, 0.35, 2), M.wallRock, 5.25, 0.5, 1.0, world, { cast: false });
}
const headstoneAt = (x, z, s = 1, ry = 0, seed = 4, mat = null) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  const mm = mat || (seed % 3 ? M.stone : M.stoneOld);
  add(tbox(0.95 * s, 0.13, 0.55 * s, 1), mm, 0, 0.065, 0, g, { cast: false });               // base slab
  add(tbox(0.74 * s, 0.78 * s, 0.11, 1), mm, 0, 0.13 + 0.39 * s, 0, g);                        // upright slab
  const cap = add(new THREE.CylinderGeometry(0.37 * s, 0.37 * s, 0.11, 18, 1, false, 0, Math.PI), mm, 0, 0.13 + 0.78 * s, 0, g);
  cap.rotation.z = Math.PI / 2; cap.rotation.y = Math.PI / 2;                                   // rounded top
  add(tbox(0.8 * s, 0.07, 0.16, 1), mm, 0, 0.16 * s, 0, g, { cast: false });                    // collar ledge
  g.rotation.z = (P.rng(seed * 7 + 1)() - 0.5) * 0.03;
  return g;
};
headstoneAt(0.1, -5.6, 0.95, 0.06, 5); headstoneAt(1.6, -5.7, 1.05, -0.04, 8);
headstoneAt(3.4, -5.6, 0.9, 0.03, 12); headstoneAt(4.9, -5.7, 1.1, -0.06, 15);
headstoneAt(0.0, -3.9, 1.0, 0.05, 18); headstoneAt(4.9, -3.9, 0.95, -0.03, 21);
headstoneAt(0.2, -0.7, 0.9, 0.04, 24); headstoneAt(4.8, -0.8, 1.02, -0.05, 27);
headstoneAt(6.1, -2.4, 0.92, -0.35, 30); headstoneAt(-1.2, -2.0, 0.98, 0.3, 33);
// ----- Miguel's grave: taller stone, marble plaque board, earth mound, flowers -----
const plaque = textBoard(['MIGUEL', 'GUZMÁN'], 0.8, 0.52, '#3a3630', '#f2e3bc');
{
  const g = new THREE.Group(); g.position.set(GRAVE[0], 0, GRAVE[2]); world.add(g);
  add(tbox(1.15, 0.15, 0.68, 1), M.stone, 0, 0.075, 0, g, { cast: false });
  add(tbox(0.9, 0.95, 0.13, 1), M.stone, 0, 0.15 + 0.475, 0, g);
  const cap = add(new THREE.CylinderGeometry(0.45, 0.45, 0.13, 18, 1, false, 0, Math.PI), M.stone, 0, 1.1, 0, g);
  cap.rotation.z = Math.PI / 2; cap.rotation.y = Math.PI / 2;
  add(tbox(0.96, 0.08, 0.19, 1), M.stone, 0, 0.2, 0, g, { cast: false });
  plaque.position.set(0, 0.68, 0.075); g.add(plaque);
  const mound = add(new THREE.SphereGeometry(0.85, 14, 10), M.dirt, 0, -0.32, 0.95, g, { cast: false }); mound.scale.set(1.05, 0.55, 1.25);
  const cols = ['#e86e8a', '#e8c45a', '#eef2f6'];
  for (let i = 0; i < 7; i++) {
    const fx2 = -0.42 + i * 0.14, fz = 0.34 + (i % 2) * 0.09;
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5), MW.leafDk, fx2, 0.22, fz, g, { cast: false });
    add(new THREE.SphereGeometry(0.036, 8, 6), toon({ color: cols[i % 3] }), fx2, 0.34, fz, g, { cast: false });
  }
}
// ----- iron gate on a hinge group (opened by worldAt gateT) -----
const gateG = new THREE.Group(); gateG.position.set(1.6, 0, 1.0); world.add(gateG);
{
  add(tbox(0.24, 1.7, 0.24, 1), M.stone, 1.6, 0.85, 1.0, world, { cast: false });
  add(tbox(0.24, 1.7, 0.24, 1), M.stone, 3.2, 0.85, 1.0, world, { cast: false });
  add(new THREE.SphereGeometry(0.15, 10, 8), M.stone, 1.6, 1.78, 1.0, world, { cast: false });
  add(new THREE.SphereGeometry(0.15, 10, 8), M.stone, 3.2, 1.78, 1.0, world, { cast: false });
  add(tbox(1.6, 0.07, 0.05, 1), MW.iron, 0.8, 1.42, 0, gateG, { cast: false });
  add(tbox(1.6, 0.07, 0.05, 1), MW.iron, 0.8, 0.35, 0, gateG, { cast: false });
  for (let i = 0; i < 6; i++) add(tbox(0.045, 1.35, 0.045, 1), MW.iron, 0.14 + i * 0.27, 0.82, 0, gateG, { cast: false });
  for (const hy of [0.42, 1.3]) { const hgeo = add(box(0.1, 0.16, 0.09), MW.iron, 0.02, hy, 0, gateG, { cast: false }); }
  gateG.rotation.y = -0.5;
}
// ----- cypress + leafy trees -----
const cypresses = [];
const cypressAt = (x, z, h = 3.6) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(new THREE.CylinderGeometry(0.09, 0.13, 0.7, 7), MW.trunkDk, 0, 0.35, 0, g, { cast: false });
  add(new THREE.ConeGeometry(0.62, h * 0.62, 9), MW.cypress, 0, 0.6 + h * 0.31, 0, g, { cast: false });
  add(new THREE.ConeGeometry(0.44, h * 0.5, 9), MW.cypressDk, 0, 0.6 + h * 0.62, 0, g, { cast: false });
  add(new THREE.ConeGeometry(0.24, h * 0.34, 8), MW.cypress, 0, 0.6 + h * 0.86, 0, g, { cast: false });
  cypresses.push(g); return g;
};
cypressAt(-1.7, -6.6, 3.9); cypressAt(6.7, -6.6, 4.2); cypressAt(-1.7, 0.4, 3.4); cypressAt(6.7, 0.4, 3.7); cypressAt(5.9, -6.4, 3.2);
const treeAt = (x, z, h = 5.0, lean = 0.05) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  const trunk = add(new THREE.CylinderGeometry(0.16, 0.28, h * 0.62, 8), MW.trunk, 0, h * 0.31, 0, g, { cast: false }); trunk.rotation.z = lean;
  for (const [ox, oz, r, m] of [[0, 0, h * 0.5, MW.leaf], [h * 0.28, h * 0.08, h * 0.34, MW.leafDk], [-h * 0.28, -h * 0.06, h * 0.31, MW.leaf], [h * 0.04, -h * 0.26, h * 0.28, MW.leafLt]]) {
    const c = add(new THREE.SphereGeometry(r, 12, 9), m, ox, h * 0.84, oz, g, { cast: false }); c.scale.y = 0.55;
  }
  return g;
};
treeAt(-8.6, 1.4, 5.2); treeAt(-2.2, 7.6, 4.6, -0.05); treeAt(8.6, 2.8, 4.8); treeAt(-9.2, -3.4, 4.4);
// ----- the Guzmán house: plaster walls, pitched roof, lit door, shuttered windows -----
const doorGlowMat = new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0.85, fog: true });
const paneGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.7, fog: true });
{
  const hg = new THREE.Group(); hg.position.set(-5.4, 0, 3.1); world.add(hg);
  add(tbox(5.6, 3.0, 0.28, 2), M.plaster, 0, 1.5, 0, hg, { cast: false });                    // facade
  add(tbox(0.28, 3.0, 3.4, 2), M.plaster, -2.8, 1.5, -1.7, hg, { cast: false });               // side walls
  add(tbox(0.28, 3.0, 3.4, 2), M.plaster, 2.8, 1.5, -1.7, hg, { cast: false });
  add(tbox(5.9, 0.22, 3.9, 2), M.beamDark, 0, 3.05, -1.6, hg, { cast: false });                // eaves beam
  const r1 = add(tbox(3.6, 0.14, 2.6, 2), M.roof, -1.32, 3.95, -1.6, hg, { cast: false }); r1.rotation.z = 0.62;
  const r2 = add(tbox(3.6, 0.14, 2.6, 2), M.roof, 1.32, 3.95, -1.6, hg, { cast: false }); r2.rotation.z = -0.62;
  add(tbox(0.24, 0.24, 3.9, 1), M.beamDark, 0, 4.62, -1.6, hg, { cast: false });               // ridge
  // door: frame, leaf, knob, step, porch posts + cap
  add(tbox(1.14, 2.3, 0.1, 1), M.beamDark, 0, 1.15, 0.17, hg, { cast: false });
  add(tbox(0.96, 2.12, 0.09, 1), M.doorWood, 0, 1.06, 0.2, hg, { cast: false });
  add(new THREE.SphereGeometry(0.05, 8, 8), MW.gold, 0.34, 1.05, 0.27, hg, { cast: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.05), doorGlowMat); glow.position.set(0, 1.06, 0.26); glow.userData.ndSkip = true; hg.add(glow);
  add(tbox(1.5, 0.14, 0.7, 1), M.stone, 0, 0.07, 0.5, hg, { cast: false });
  for (const sx of [-0.85, 0.85]) add(new THREE.CylinderGeometry(0.055, 0.065, 2.5, 7), M.beamDark, sx, 1.25, 0.85, hg, { cast: false });
  add(tbox(2.1, 0.1, 1.1, 2), M.roof, 0, 2.55, 0.8, hg, { cast: false });
  // windows with shutters + warm panes
  for (const wx of [-1.85, 1.85]) {
    add(tbox(0.98, 1.18, 0.09, 1), M.beamDark, wx, 1.72, 0.16, hg, { cast: false });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.02), paneGlowMat); pane.position.set(wx, 1.72, 0.22); pane.userData.ndSkip = true; hg.add(pane);
    add(tbox(0.07, 1.02, 0.05, 1), M.beamDark, wx, 1.72, 0.24, hg, { cast: false });
    add(tbox(0.82, 0.07, 0.05, 1), M.beamDark, wx, 1.72, 0.24, hg, { cast: false });
    for (const sd of [-1, 1]) { const sh = add(tbox(0.4, 1.14, 0.05, 1), M.doorWood, wx + sd * 0.72, 1.72, 0.15, hg, { cast: false }); sh.rotation.y = sd * 0.35; }
  }
  // flower pots by the door
  for (const px of [-1.15, 1.15]) {
    add(new THREE.CylinderGeometry(0.16, 0.11, 0.26, 10), toon({ color: '#a8542f' }), px, 0.13, 0.55, hg, { cast: false });
    add(new THREE.SphereGeometry(0.17, 9, 7), MW.leafLt, px, 0.36, 0.55, hg, { cast: false });
  }
}
// ----- board easel by the grave: carries the two narration boards -----
const mkEasel = (x, z, ry, w) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.055, 0.07, 2.2, 7), M.beamDark, sd * (w / 2 + 0.14), 1.1, -0.06, g, { cast: false });
  add(tbox(w + 0.42, 0.1, 0.08, 2), M.beam, 0, 2.22, -0.06, g, { cast: false });
  return g;
};
const bigEasel = mkEasel(1.9, -1.5, 0.28, 1.5);
const boardAlone = textBoard(['HE FOUND', 'THE GRAVE', 'ALONE'], 1.5, 0.95, '#37455c', '#e8eef8'); boardAlone.position.set(0, 1.32, 0); bigEasel.add(boardAlone);
const boardFinale = textBoard(['11 YEARS', 'OF NIGHTS'], 1.5, 0.95, '#4a3421', '#ffe9a8'); boardFinale.position.set(0, 1.32, 0); bigEasel.add(boardFinale);
const boardGlint = FX.glint(0.28); boardGlint.position.set(2.3, 2.05, -1.05); boardGlint.userData.ndSkip = true; world.add(boardGlint);
// ----- the worker's bowl (appears at bowlT, beside the grave) -----
const bowlG = new THREE.Group(); bowlG.position.set(3.25, 0, -1.05); world.add(bowlG);
{
  const bowl = add(new THREE.CylinderGeometry(0.3, 0.19, 0.17, 14, 1, true), toon({ color: '#7a4a3a', side: THREE.DoubleSide }), 0, 0.085, 0, bowlG, { cast: false }); bowl.userData.ndSkip = true;
  add(new THREE.CircleGeometry(0.27, 14), toon({ color: '#c8b088' }), 0, 0.145, 0, bowlG, { cast: false }).rotation.x = -Math.PI / 2;
}
// ----- search lantern (glint + warm lamp, follows story's searchPosAt) -----
const lanternG = new THREE.Group(); world.add(lanternG);
const lanternGlowMat = new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.95, fog: true });
{
  add(tbox(0.16, 0.24, 0.16, 1), MW.iron, 0, 0, 0, lanternG, { cast: false });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), lanternGlowMat); lamp.userData.ndSkip = true; lanternG.add(lamp);
  add(new THREE.TorusGeometry(0.07, 0.016, 6, 12), MW.iron, 0, 0.17, 0, lanternG, { cast: false });
}
const lanternGlint = FX.glint(0.32); lanternGlint.userData.ndSkip = true; world.add(lanternGlint);
// ----- grass tufts (sway via worldAt grassK) -----
const grassTufts = [];
{ const r = P.rng(61);
  for (let i = 0; i < 120; i++) {
    const a = r() * Math.PI * 2, d = 2.6 + r() * 10, x = 1.2 + Math.cos(a) * d, z = -1.5 + Math.sin(a) * d;
    if (Math.hypot(x - GRAVE[0], z - GRAVE[2]) < 1.5 || Math.hypot(x - 3.45, z + 3.2) < 1.3 || Math.hypot(x + 5.4, z - 5.6) < 1.6) continue;
    const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
    const n = 3 + (r() * 3 | 0);
    for (let j = 0; j < n; j++) { const blade = add(new THREE.ConeGeometry(0.06, 0.3 + r() * 0.28, 5), j % 2 ? MW.leaf : MW.leafLt, (r() - 0.5) * 0.3, 0.2, (r() - 0.5) * 0.3, g, { cast: false }); blade.rotation.z = (r() - 0.5) * 0.5; }
    g.userData.ph = r() * 6.28; grassTufts.push(g);
  }
}

// ---------- FX: night dust motes (Smoke, very low) + drifting Ambience ----------
const smoke = new FX.Smoke(scene, 110); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dustEmit = smoke.addEmitter(2.4, 0.4, -1.4, { rate: 1.0, color: 0xcfd8e8, opacity: 0.12, scale: 0.45, grow: 1.2, life: 2.8, vy: 0.35, wind: 0.5 });
const amb = new FX.Ambience(scene, { mode: 'dust', count: 130, area: 46, height: 14, cx: 1, cz: -1, color: 0xe8ddc0, opacity: 0.12 });
if (amb.points) amb.points.userData.ndSkip = true;
const fxClouds = new FX.Clouds(scene, { count: 5, y: 55, opacity: 0.16, color: 0xd8dee8, drift: 0.3 });
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), dp = dogPosAt(fxF);
    dustEmit.rate = pr.smokeRate; dustEmit.x = dp[0]; dustEmit.z = dp[2] + 0.4;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
    if (amb.uniforms) amb.uniforms.uT.value = t;
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
  setB(boardAlone, Ws.boardAlone || 0); setB(boardFinale, Ws.boardFinale || 0);
  boardGlint.material.opacity = Math.max(Ws.boardAlone || 0, Ws.boardFinale || 0) * (0.32 + 0.18 * Math.sin(f * 0.33));
  doorGlowMat.opacity = 0.15 + 0.75 * (Ws.doorGlow || 0);
  paneGlowMat.opacity = 0.12 + 0.62 * (Ws.doorGlow || 0);
  gateG.rotation.y = -0.5 - 1.15 * (Ws.gateT || 0);
  bowlG.visible = (Ws.bowlT || 0) > 0.01; bowlG.scale.setScalar(0.55 + 0.45 * (Ws.bowlT || 0));
  const lt = Ws.lanternT || 0;
  lanternG.visible = lt > 0.01; lanternGlint.visible = lt > 0.01;
  if (lt > 0.01) {
    const sp = searchPosAt(f);
    lanternG.position.set(sp[0] + 0.42, 0.98, sp[2] + 0.3);
    lanternGlint.position.set(sp[0] + 0.42, 1.0, sp[2] + 0.3);
    lanternGlint.material.opacity = lt * (0.4 + 0.2 * Math.sin(f * 0.4));
    lanternGlowMat.opacity = lt;
  }
  if (amb.uniforms) amb.uniforms.uOpacity.value = 0.08 + 0.3 * (Ws.ambT || 0);
  cypresses.forEach((g, i) => { g.rotation.z = Math.sin(f * 0.02 + i * 1.7) * 0.008 * (1 + (Ws.windK || 0)); });
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
    if (a.blob !== false && a.y < 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s * (a.blobW || 1), 0.6 * s * (a.blobW || 1), 1); }
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
