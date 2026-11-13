import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, trainXAt, BOARDS } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const envMap = FX.detailEnv(renderer);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(1), 1, 6), beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  stone: texM(P.stone(4), 1, 1), stoneWall: texM(P.stone(14, 30, 10, 58), 4, 1, '#b8b0a0'),
  dirt: texM(P.dirt(7), 10, 10, '#b39d78'), grass: texM(P.grass(6), 30, 30, '#9db06a'),
  plaster: texM(P.plaster(9), 3, 1, '#efe6d0'), roof: texM(P.roof(5), 4, 2, '#7a4a3a'),
  gravel: texM(P.stone(21, 60, 4, 30), 12, 1, '#9a938a'),
};
const MW = {
  leaf: toon({ color: '#5d7a35' }), leafDk: toon({ color: '#47602a' }), pink: toon({ color: '#e8a8bc' }), pinkDk: toon({ color: '#d18ba2' }),
  trunk: toon({ color: '#6d5136' }), trunkDk: toon({ color: '#54402a' }),
  white: toon({ color: '#eef2f6' }), navy: toon({ color: '#26355e' }), gold: toon({ color: '#d9a441' }),
  dark: toon({ color: '#2e2c30' }), rail: toon({ color: '#8b9299' }), red: toon({ color: '#b03a30' }),
  shade: new THREE.MeshBasicMaterial({ color: 0x2e4420, transparent: true, opacity: 0.2, depthWrite: false }),
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

// ---------- the station set ----------
const world = new THREE.Group(); scene.add(world);
{ // ground: grass + gravel apron + shade patches
  flat(add(new THREE.CircleGeometry(70, 40), M.grass, 0, -0.04, -6, world, { cast: false }));
  add(tbox(30, 0.06, 9, 3), M.dirt, 0, -0.01, 0.6, world, { cast: false });
  // platform slab (top y=0.55) + stone face
  add(tbox(21, 0.55, 4.4, 2), M.stoneWall, 0, 0.275, -1.0, world, { cast: false });
  add(tbox(21, 0.06, 4.4, 2), M.stone, 0, 0.56, -1.0, world, { cast: false });
  // white safety line along the platform edge
  add(box(21, 0.012, 0.14), MW.white, 0, 0.6, 0.75, world, { cast: false });
  // track: ballast + sleepers + rails at z=2.6
  add(tbox(34, 0.1, 2.4, 3), M.gravel, 0, 0.02, 2.6, world, { cast: false });
  for (let x = -16; x <= 16; x += 0.85) add(tbox(0.28, 0.07, 1.9, 2), M.beamDark, x, 0.09, 2.6, world, { cast: false });
  for (const dz of [-0.5, 0.5]) add(box(34, 0.07, 0.09), MW.rail, 0, 0.15, 2.6 + dz, world, { cast: false });
}
// station building: wall, windows, door, sloped roof
{
  add(tbox(15, 3.3, 0.4, 2), M.plaster, 0, 1.65, -3.6, world, { cast: false });
  add(tbox(15.6, 0.24, 0.5, 2), M.beamDark, 0, 3.36, -3.6, world, { cast: false });
  const r1 = add(tbox(16.4, 0.14, 3.0, 2), M.roof, 0, 4.05, -4.35, world, { cast: false }); r1.rotation.x = 0.5;
  const r2 = add(tbox(16.4, 0.14, 3.0, 2), M.roof, 0, 4.05, -2.85, world, { cast: false }); r2.rotation.x = -0.5;
  for (const wx of [-5.2, -2.2, 4.6]) { // windows with frames + warm glass
    add(box(1.3, 1.5, 0.08), M.beamDark, wx, 1.95, -3.38, world, { cast: false });
    const gl = add(new THREE.PlaneGeometry(1.1, 1.3), new THREE.MeshBasicMaterial({ color: 0xffe2ae, fog: true }), wx, 1.95, -3.33, world, { cast: false }); gl.userData.ndSkip = true;
    add(box(0.06, 1.3, 0.04), M.beamDark, wx, 1.95, -3.32, world, { cast: false });
  }
  add(tbox(1.2, 2.3, 0.1, 2), M.beam, 1.9, 1.15, -3.37, world, { cast: false }); // door
  add(new THREE.SphereGeometry(0.045, 8, 6), MW.gold, 2.38, 1.15, -3.3, world, { cast: false });
}
// KISHI hanging sign (board 'sign' in story BOARDS)
const signBoard = textBoard(['KISHI STATION'], 2.3, 0.64, '#5d4230', '#fdf6e3');
signBoard.position.set(0, 3.02, -1.25); world.add(signBoard);
{
  for (const sx of [-2.35, 2.35]) add(new THREE.CylinderGeometry(0.06, 0.07, 2.75, 7), M.beamDark, sx, 1.95, -1.25, world, { cast: false });
  add(tbox(5.1, 0.12, 0.12, 2), M.beamDark, 0, 3.36, -1.25, world, { cast: false });
  for (const sx of [-0.8, 0.8]) add(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 5), MW.dark, sx, 3.2, -1.25, world, { cast: false });
}
// office booth (Tama's office) + promotion stars
const booth = new THREE.Group(); booth.position.set(3.2, 0.55, -2.2); world.add(booth);
{
  add(tbox(1.7, 1.5, 1.3, 2), M.plaster, 0, 0.75, 0, booth, { cast: false });
  const rf = add(tbox(2.0, 0.1, 1.6, 2), M.roof, 0, 1.6, 0, booth, { cast: false }); rf.rotation.z = 0.06;
  add(box(0.8, 0.8, 0.06), M.beamDark, -0.2, 0.95, 0.66, booth, { cast: false });
  const gl = add(new THREE.PlaneGeometry(0.66, 0.66), new THREE.MeshBasicMaterial({ color: 0xffe2ae, fog: true }), -0.2, 0.95, 0.7, booth, { cast: false }); gl.userData.ndSkip = true;
  add(tbox(0.55, 1.1, 0.06, 2), M.beam, 0.55, 0.55, 0.66, booth, { cast: false });
}
const starGroup = new THREE.Group(); starGroup.position.set(3.2, 0.55, -1.5); world.add(starGroup);
{
  for (let i = 0; i < 3; i++) {
    const st = add(new THREE.OctahedronGeometry(0.14), MW.gold, -0.35 + i * 0.35, 1.28, 0, starGroup, { cast: false });
    st.scale.y = 1.25;
  }
}
// bench + lamp posts + the dusk lamp glow
{
  const bn = new THREE.Group(); bn.position.set(-3.6, 0.55, -2.5); world.add(bn);
  add(tbox(1.8, 0.07, 0.45, 2), M.beam, 0, 0.45, 0, bn, { cast: false });
  add(tbox(1.8, 0.55, 0.06, 2), M.beam, 0, 0.85, -0.22, bn, { cast: false });
  for (const sx of [-0.75, 0.75]) add(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 6), M.beamDark, sx, 0.22, 0, bn, { cast: false });
}
const lampGlows = [];
for (const lx of [-5.2, 5.2]) {
  add(new THREE.CylinderGeometry(0.05, 0.07, 3.0, 7), MW.dark, lx, 1.5, -1.9, world, { cast: false });
  add(new THREE.SphereGeometry(0.13, 10, 8), MW.white, lx, 3.05, -1.9, world, { cast: false });
  const gl = FX.glint(0.85); gl.position.set(lx, 3.05, -1.75); gl.userData.ndSkip = true; world.add(gl); lampGlows.push(gl);
}
// food bowl (salary beat) — kibble mounds
const bowlG = new THREE.Group(); bowlG.position.set(1.05, 0.59, -0.1); world.add(bowlG);
{
  const bowl = add(new THREE.CylinderGeometry(0.3, 0.19, 0.17, 14, 1, true), toon({ color: '#b03a30', side: THREE.DoubleSide }), 0, 0.08, 0, bowlG, { cast: false }); bowl.userData.ndSkip = true;
  const kr = P.rng(4);
  for (let i = 0; i < 9; i++) add(new THREE.SphereGeometry(0.045, 7, 6), toon({ color: i % 2 ? '#8a5d3b' : '#a8743f' }), (kr() - 0.5) * 0.34, 0.16, (kr() - 0.5) * 0.34, bowlG, { cast: false });
}
// her cap, left on the booth step (forever beat)
const capProp = new THREE.Group(); capProp.position.set(0.02, 0.60, -0.92); world.add(capProp);
{
  const dome = add(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), MW.navy, 0, 0.02, 0, capProp, { cast: false });
  const brim = add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 14), MW.navy, 0.06, 0.02, 0.05, capProp, { cast: false });
  add(new THREE.SphereGeometry(0.035, 8, 6), MW.gold, 0, 0.19, 0, capProp, { cast: false });
}
// distant hills + houses + cherry tree (layered depth)
{
  for (const [hx, hz, hr, hc] of [[-26, -34, 15, '#7d9450'], [8, -38, 19, '#6d8a48'], [30, -32, 13, '#7d9450']]) {
    const h = add(new THREE.SphereGeometry(hr, 14, 10), toon({ color: hc }), hx, -hr * 0.45, hz, world, { cast: false }); h.scale.y = 0.6; h.userData.ndSkip = false;
  }
  for (const [hx, hz, s] of [[-11, -17, 1], [-7.5, -16, 0.8], [9.5, -17.5, 1.1], [13.5, -16.5, 0.9]]) {
    add(tbox(2.2 * s, 1.4 * s, 1.8 * s, 2), M.plaster, hx, 0.7 * s, hz, world, { cast: false });
    const rf = add(tbox(2.6 * s, 0.12, 2.2 * s, 2), M.roof, hx, 1.55 * s, hz, world, { cast: false }); rf.rotation.z = 0.0; rf.rotation.x = 0.35;
  }
  const tr = new THREE.Group(); tr.position.set(-6.8, 0, -4.8); world.add(tr);
  add(new THREE.CylinderGeometry(0.16, 0.28, 3.0, 8), MW.trunk, 0, 1.5, 0, tr, { cast: false });
  for (const [ox, oy, oz, r, m] of [[0, 3.6, 0, 1.5, MW.pink], [1.1, 3.1, 0.3, 1.0, MW.pinkDk], [-1.05, 3.2, -0.2, 1.05, MW.pink], [0.2, 4.3, -0.3, 0.95, MW.pinkDk]]) {
    const c = add(new THREE.SphereGeometry(r, 12, 9), m, ox, oy, oz, tr, { cast: false }); c.scale.y = 0.62;
  }
}
// grass tufts on the apron edges
const grassTufts = [];
{ const r = P.rng(61);
  for (let i = 0; i < 60; i++) {
    const x = (r() - 0.5) * 26, z = -6 + r() * 3.4;
    const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
    const n = 3 + (r() * 3 | 0);
    for (let j = 0; j < n; j++) { const blade = add(new THREE.ConeGeometry(0.06, 0.3 + r() * 0.28, 5), j % 2 ? MW.leaf : MW.leafDk, (r() - 0.5) * 0.3, 0.2, (r() - 0.5) * 0.3, g, { cast: false }); blade.rotation.z = (r() - 0.5) * 0.5; }
    g.userData.ph = r() * 6.28; grassTufts.push(g);
  }
}
// ---- boards: ONE easel carries every headline board (posts wide of the board) ----
const easel = new THREE.Group(); easel.position.set(-1.25, 0.55, -1.35); easel.rotation.y = 0.22; world.add(easel);
{
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.065, 2.1, 7), M.beamDark, sd * 0.88, 1.05, -0.07, easel, { cast: false });
  add(tbox(2.15, 0.09, 0.08, 2), M.beam, 0, 2.14, -0.07, easel, { cast: false });
}
const memorial = new THREE.Group(); memorial.position.set(-0.55, 0.55, -1.18); memorial.rotation.y = 0.15; world.add(memorial);
{
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.065, 2.1, 7), M.beamDark, sd * 0.88, 1.05, -0.07, memorial, { cast: false });
  add(tbox(2.15, 0.09, 0.08, 2), M.beam, 0, 2.14, -0.07, memorial, { cast: false });
}
const boardMeshes = {};
{
  const defs = {
    close: [['THE LINE', 'IS CLOSING'], '#37455c', '#e8eef8'],
    master: [['STATIONMASTER'], '#4a3421', '#ffe9a8'],
    saved: [['THE LINE', 'IS SAVED'], '#44512c', '#ffe9a8'],
    forever: [['STATIONMASTER', 'FOREVER'], '#3c3654', '#ffd9e2'],
  };
  for (const [id, [lines, bg, fg]] of Object.entries(defs)) {
    const b = textBoard(lines, 1.42, 0.9, bg, fg); b.position.set(0, 1.07, 0);
    (id === 'forever' ? memorial : easel).add(b); boardMeshes[id] = b;
  }
}
const badgeGlint = FX.glint(0.5); badgeGlint.position.set(0.4, 1.62, -0.55); badgeGlint.userData.ndSkip = true; world.add(badgeGlint);

// ---- the train: v3 detailed locomotive + two wooden coaches ----
const trainG = new THREE.Group(); trainG.position.set(-26, 0, 2.6); world.add(trainG);
const loco = FX.detailedLocomotive({ envMap, number: '2007' });
loco.group.scale.setScalar(0.62); trainG.add(loco.group);
{
  const carM = texM(P.planks(11), 2, 1, '#7a4a34'), carM2 = texM(P.planks(12), 2, 1, '#5d6a4a');
  const mkCar = (x0, mat) => {
    const g = new THREE.Group(); g.position.set(x0, 0, 0); trainG.add(g);
    add(tbox(6.4, 1.9, 2.3, 2), mat, 0, 1.85, 0, g, { cast: false });
    const rf = add(tbox(6.8, 0.16, 2.6, 2), M.roof, 0, 2.88, 0, g, { cast: false });
    for (let i = 0; i < 5; i++) { const gl = add(new THREE.PlaneGeometry(0.72, 0.72), new THREE.MeshBasicMaterial({ color: 0xffe2ae, fog: true }), -2.4 + i * 1.2, 2.05, 1.16, g, { cast: false }); gl.userData.ndSkip = true; }
    add(tbox(6.5, 0.5, 2.2, 2), MW.dark, 0, 0.72, 0, g, { cast: false });
    for (const wx of [-2.2, 2.2]) for (const wz of [-0.95, 0.95]) { const w = add(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 14), MW.dark, wx, 0.42, wz, g, { cast: false }); w.rotation.x = Math.PI / 2; }
    return g;
  };
  mkCar(-10.6, carM); mkCar(-17.6, carM2);
}

// ---------- FX: chimney steam + clouds + dust ----------
const smoke = new FX.Smoke(scene, 120); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const steam = smoke.addEmitter(-27, 3.3, 2.6, { rate: 0, color: 0xf2f0ea, opacity: 0.34, scale: 0.5, grow: 1.6, life: 1.8, vy: 1.6, wind: 0.8 });
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    steam.rate = pr.smokeRate; steam.x = trainXAt(fxF) - 0.93; steam.z = 2.6;
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
  setB(boardMeshes.close, Ws.boardClose || 0); setB(boardMeshes.master, Ws.boardMaster || 0);
  setB(boardMeshes.saved, Ws.boardSaved || 0); setB(boardMeshes.forever, Ws.boardForever || 0);
  bowlG.visible = (Ws.bowlT || 0) > 0.01;
  starGroup.scale.setScalar(Math.max(0.001, Ws.starT || 0));
  starGroup.visible = (Ws.starT || 0) > 0.01;
  capProp.visible = (Ws.capPropT || 0) > 0.01;
  badgeGlint.material.opacity = Ws.badgeGlint || 0;
  lampGlows.forEach((g) => { g.material.opacity = (Ws.lampT || 0) * (0.6 + 0.25 * Math.sin(f * 0.23)); });
  trainG.position.x = Ws.trainX;
  loco.wheels.forEach((w) => { w.m.rotation.z = -Ws.trainX / (w.r * 0.62); });
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
    if (a.blob !== false && a.y < 1.2) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
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
// board projection gate: NDC corners of every story board at frame f
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
