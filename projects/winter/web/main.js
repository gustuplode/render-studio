import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { buildDolphin, buildFluke } from './dolphin.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, winterAt, boatAt, FIT_FRAME } from './story.js';

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

// canvas tile texture for the pool (turquoise tiles + grout)
const tileTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#2b8aa6'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#2f96b2' : '#26809c'; g.fillRect(x * 64 + 3, y * 64 + 3, 58, 58); }
  g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(0, 0, 256, 10);
  return P.tex(c, 6, 3);
})();
const tileMat = toon({ map: tileTex });
const M = {
  deck: toon({ color: '#b9c2c2' }), deckEdge: toon({ color: '#7fa8b4' }),
  sand: toon({ color: '#c2b28a' }), rock: toon({ color: '#6a7683' }), coral: toon({ color: '#e2703a' }), coral2: toon({ color: '#d95f8e' }),
  weed: toon({ color: '#3a7d4a', side: THREE.DoubleSide }), white: toon({ color: '#eef2f6' }), hullRed: toon({ color: '#b03a30' }),
  wood: texM(P.planks(3), 1, 1), darkMetal: toon({ color: '#3c4148' }), rope: toon({ color: '#8a6f4d' }),
  wall: toon({ color: '#a9c3cd' }), clinicFloor: toon({ color: '#d9c8a8' }), clinicWall: toon({ color: '#eadfc6' }),
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
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };
const ndSkip = (o) => { o.traverse((m) => { m.userData.ndSkip = true; }); };
const setBeam = (mesh, a, b) => {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
};

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

// ---------- SEA set (centre z=-50) ----------
const seaG = new THREE.Group(); scene.add(seaG);
flat(add(new THREE.CircleGeometry(70, 36), M.sand, 0, -3.4, -50, seaG, { cast: false }));
{ const r = P.rng(31);
  for (let i = 0; i < 22; i++) { const a = r() * 6.28, d = 6 + r() * 42, x = Math.cos(a) * d, z = -50 + Math.sin(a) * d;
    if (Math.hypot(x, z + 50) < 5) continue;
    const s = add(new THREE.DodecahedronGeometry(0.4 + r() * 0.9), M.rock, x, -3.2, z, seaG, { cast: false }); s.rotation.set(r() * 3, r() * 3, 0); }
  for (let i = 0; i < 10; i++) { const x = -14 + r() * 28, z = -62 + r() * 24; if (Math.hypot(x, z + 50) < 6) continue;
    const c = add(new THREE.ConeGeometry(0.22 + r() * 0.2, 0.7 + r() * 0.7, 7), i % 2 ? M.coral : M.coral2, x, -3.0, z, seaG, { cast: false }); } }
const weeds = [];
for (let i = 0; i < 12; i++) { const w = add(new THREE.ConeGeometry(0.09 + (i % 3) * 0.03, 1.3 + (i % 4) * 0.25, 6), M.weed, -12 + i * 2.1, -2.6, -57 + (i % 4) * 3.4, seaG, { cast: false }); w.geometry.translate(0, 0.65, 0); w.position.y = -3.35; w.rotation.y = i * 1.7; weeds.push(w); }
const seaWater = FX.makeWater({ size: 170, seg: 88, deep: 0x14425e, shallow: 0x2e7ea6, sky: 0xbfe3f2, amp: 0.4 });
seaWater.position.set(0, 0, -50); seaWater.userData.ndSkip = true; scene.add(seaWater);
// surface skins: makeWater is single-sided (invisible from below) — a bright skin plane gives
// underwater cameras a real surface to look up at. Shown only when the camera is underwater.
const seaSkin = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), new THREE.MeshBasicMaterial({ color: 0xa8d4ea, transparent: true, opacity: 0.94, side: THREE.DoubleSide, fog: false }));
seaSkin.rotation.x = -Math.PI / 2; seaSkin.position.set(0, 0.07, -50); seaSkin.userData.ndSkip = true; scene.add(seaSkin);
{ const base = flat(add(new THREE.PlaneGeometry(340, 340), toon({ color: '#0f3650' }), 0, -4.6, -50, scene, { cast: false })); base.userData.ndSkip = false; }
// god rays (additive cones, slow sway)
const rays = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 2.0, 6.5, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.042, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  m.position.set(-3.2 + i * 2.2, -3.35, -50.5 + i * 1.1); m.rotation.z = 0.32; m.userData.ndSkip = true; scene.add(m); rays.push(m);
}
// crab trap + line
const trapG = new THREE.Group(); trapG.position.set(0.9, -3.35, -48.0); scene.add(trapG);
{ const fm = M.darkMetal;
  for (const [x, y, z, w, h, d] of [[0, 0.35, 0.4, 0.85, 0.05, 0.05], [0, 0.35, -0.4, 0.85, 0.05, 0.05], [0.4, 0.35, 0, 0.05, 0.05, 0.85], [-0.4, 0.35, 0, 0.05, 0.05, 0.85],
    [0, 0.02, 0.4, 0.85, 0.05, 0.05], [0, 0.02, -0.4, 0.85, 0.05, 0.05], [0.4, 0.02, 0, 0.05, 0.05, 0.85], [-0.4, 0.02, 0, 0.05, 0.05, 0.85],
    [0.4, 0.18, 0.4, 0.05, 0.36, 0.05], [-0.4, 0.18, 0.4, 0.05, 0.36, 0.05], [0.4, 0.18, -0.4, 0.05, 0.36, 0.05], [-0.4, 0.18, -0.4, 0.05, 0.36, 0.05]]) add(box(w, h, d), fm, x, y, z, trapG, { cast: false });
  const buoy = add(new THREE.SphereGeometry(0.16, 10, 8), M.hullRed, 0, 0.55, 0, trapG, { cast: false }); }
const trapLine = add(new THREE.CylinderGeometry(0.016, 0.016, 1, 5), M.rope, 0, 0, 0, scene, { cast: false });
const trapWrap = add(new THREE.TorusGeometry(0.13, 0.028, 6, 14), M.rope, 0, 0, 0, scene, { cast: false });
// rescue boat
const boatG = new THREE.Group(); scene.add(boatG);
{ add(box(2.3, 0.75, 5.4), M.white, 0, 0.18, 0, boatG);
  add(box(2.34, 0.2, 5.44), M.hullRed, 0, -0.08, 0, boatG, { cast: false });
  const bow = add(box(1.7, 0.7, 1.4), M.white, 0, 0.18, 3.2, boatG); bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.72);
  add(box(1.5, 0.95, 1.9), M.white, 0, 1.0, -1.2, boatG);
  add(box(1.54, 0.3, 1.94), toon({ color: '#2e6b8f' }), 0, 1.3, -1.2, boatG, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 7), M.darkMetal, 0, 1.9, 1.2, boatG, { cast: false });
  add(box(2.3, 0.06, 0.06), M.darkMetal, 0, 0.62, 2.68, boatG, { cast: false });
  add(box(2.3, 0.06, 0.06), M.darkMetal, 0, 0.62, -2.68, boatG, { cast: false }); }
// sling cradle (rescue lift)
const slingG = new THREE.Group(); scene.add(slingG);
{ const fab = toon({ color: '#e8b13c', side: THREE.DoubleSide });
  const cradle = add(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12, 1, true, 0, Math.PI), fab, 0, 0, 0, slingG, { cast: false });
  cradle.rotation.z = Math.PI / 2; cradle.rotation.y = Math.PI / 2;
  for (const dz of [-0.45, 0.45]) add(box(0.05, 1.5, 0.05), M.rope, 0, 0.8, dz, slingG, { cast: false }); }
slingG.visible = false;

// ---------- POOL set (centre z=0) ----------
const poolG = new THREE.Group(); scene.add(poolG);
flat(add(new THREE.PlaneGeometry(10.6, 22.6), toon({ map: tileTex, color: '#86aeb8' }), 0, -3.0, 0, poolG, { cast: false }));
for (const [w, h, d, x, y, z] of [
  [10.6, 3.3, 0.15, 0, -1.35, -11.35], [10.6, 3.3, 0.15, 0, -1.35, 11.35],
  [0.15, 3.3, 22.6, -5.35, -1.35, 0], [0.15, 3.3, 22.6, 5.35, -1.35, 0]]) { const m = add(box(w, h, d), tileMat, x, y, z, poolG, { cast: false }); }
// deck slabs (top y=0.30)
for (const [w, d, x, z] of [[9.5, 24.5, 9.75, 0], [9.5, 24.5, -9.75, 0], [29, 5.5, 0, 14.25], [29, 5.5, 0, -14.25]]) add(box(w, 0.3, d), M.deck, x, 0.15, z, poolG, { cast: false });
for (const [w, d, x, z] of [[0.5, 22.6, 5.25, 0], [0.5, 22.6, -5.25, 0], [10.6, 0.5, 0, 11.25], [10.6, 0.5, 0, -11.25]]) add(box(w, 0.34, d), M.deckEdge, x, 0.17, z, poolG, { cast: false });
// hall walls
for (const [w, h, d, x, y, z] of [[30, 8, 0.3, 0, 4.3, -17], [30, 8, 0.3, 0, 4.3, 17], [0.3, 8, 34, -14.8, 4.3, 0], [0.3, 8, 34, 14.8, 4.3, 0]]) add(box(w, h, d), M.wall, x, y, z, poolG, { cast: false });
// glass viewing panel (west wall of the pool)
{ const gl = new THREE.Mesh(new THREE.PlaneGeometry(20, 2.4), FX.glassMat(0x9fd8e8, 0.22)); gl.position.set(-5.28, -1.5, 0); gl.rotation.y = Math.PI / 2; gl.userData.ndSkip = true; poolG.add(gl); }
// pool water surface
const poolWater = FX.makeWater({ size: 24, seg: 52, deep: 0x1a5a74, shallow: 0x2f96b4, sky: 0xd8f2fa, amp: 0.12 });
poolWater.scale.x = 0.45; poolWater.position.set(0, 0, 0); poolWater.userData.ndSkip = true; scene.add(poolWater);
const poolSkin = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 22.6), new THREE.MeshBasicMaterial({ color: 0xc4ecfa, transparent: true, opacity: 0.93, side: THREE.DoubleSide, fog: false }));
poolSkin.rotation.x = -Math.PI / 2; poolSkin.position.set(0, 0.06, 0); poolSkin.userData.ndSkip = true; scene.add(poolSkin);
// ladder
for (const s of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 7), M.darkMetal, s, 0.4, -10.9, poolG, { cast: false });
for (let i = 0; i < 3; i++) add(box(0.66, 0.05, 0.05), M.darkMetal, 0, -0.2 + i * 0.5, -10.9, poolG, { cast: false });
// workshop: table + drawing board with the tail sketch + model fluke
const sketchTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384; const g = c.getContext('2d');
  g.fillStyle = '#f3ecd8'; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = '#33506b'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(60, 210); g.bezierCurveTo(140, 150, 300, 150, 380, 200); g.bezierCurveTo(300, 235, 150, 245, 60, 210); g.stroke(); // body
  g.beginPath(); g.moveTo(86, 196); g.quadraticCurveTo(60, 178, 44, 182); g.stroke(); // beak
  g.beginPath(); g.moveTo(238, 158); g.quadraticCurveTo(262, 118, 288, 156); g.stroke(); // dorsal
  g.strokeStyle = '#c0302c'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(392, 192); g.lineTo(430, 192); g.moveTo(452, 150); g.lineTo(436, 196); g.lineTo(470, 218); g.lineTo(436, 210); g.lineTo(452, 252); g.stroke(); // NEW fluke sketch
  g.strokeStyle = '#33506b'; g.lineWidth = 3; g.setLineDash([8, 7]);
  g.beginPath(); g.moveTo(392, 120); g.lineTo(452, 120); g.moveTo(392, 276); g.lineTo(452, 276); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#c0302c'; g.font = '900 44px Arial'; g.fillText('NEW TAIL?', 138, 336);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
{ add(box(2.0, 0.85, 1.05), M.wood, 6.35, 0.72, -8, poolG);
  for (const [lx, lz] of [[-0.85, -0.4], [0.85, -0.4], [-0.85, 0.4], [0.85, 0.4]]) add(box(0.09, 0.45, 0.09), M.darkMetal, 6.35 + lx, 0.42, -8 + lz, poolG, { cast: false });
  const board = new THREE.Group(); board.position.set(6.45, 0.3, -8); board.rotation.y = -Math.PI / 2; board.rotation.x = -0.1; poolG.add(board);
  add(box(2.1, 1.5, 0.07), M.wood, 0, 1.45, 0, board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.35), new THREE.MeshBasicMaterial({ map: sketchTex, fog: true }));
  face.position.set(0, 1.45, 0.045); face.userData.ndSkip = true; board.add(face);
  for (const s of [-0.8, 0.8]) { const leg = add(box(0.08, 1.1, 0.08), M.darkMetal, s, 0.5, -0.25, board, { cast: false }); leg.rotation.x = 0.4; }
  const crate1 = FX.crate(0.72); crate1.position.set(7.6, 0.66, -10.1); poolG.add(crate1);
  const barrel1 = FX.barrel(0.42, 1.0); barrel1.position.set(7.7, 0.8, -5.9); poolG.add(barrel1); }
// model fluke on the table (built after dolphin module import below)
const modelFluke = buildFluke(toon({ color: '#54748a' })); modelFluke.scale.setScalar(0.6); modelFluke.position.set(6.1, 1.17, -7.55); modelFluke.rotation.x = Math.PI / 2; poolG.add(modelFluke);
// fitting stretcher: a submerged cradle UNDER Winter at the fitting edge (aligned to her yaw)
{ const stG = new THREE.Group(); stG.position.set(3.55, 0, -6); stG.rotation.y = 1.35; poolG.add(stG);
  add(box(1.6, 0.08, 2.6), M.darkMetal, 0, -0.4, 0, stG, { cast: false });
  for (const [lx, lz] of [[-0.7, -1.2], [0.7, -1.2], [-0.7, 1.2], [0.7, 1.2]]) add(box(0.07, 0.5, 0.07), M.darkMetal, lx, -0.62, lz, stG, { cast: false });
  const fab = add(new THREE.PlaneGeometry(1.3, 2.2), toon({ color: '#e8b13c', side: THREE.DoubleSide }), 0, -0.35, 0, stG, { cast: false }); fab.rotation.x = -Math.PI / 2; }

// ---------- CLINIC set (centre z=38) ----------
const clinicG = new THREE.Group(); scene.add(clinicG);
flat(add(new THREE.PlaneGeometry(18, 13), M.clinicFloor, 0, 0, 38.5, clinicG, { cast: false }));
add(box(18, 6, 0.3), M.clinicWall, 0, 3, 44.8, clinicG, { cast: false });
add(box(0.3, 6, 13), M.clinicWall, -9, 3, 38.5, clinicG, { cast: false });
add(box(0.3, 6, 13), M.clinicWall, 9, 3, 38.5, clinicG, { cast: false });
{ const win = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.6), new THREE.MeshBasicMaterial({ color: '#ffe9b8', fog: true })); win.position.set(-8.82, 3.1, 38); win.rotation.y = Math.PI / 2; win.userData.ndSkip = true; clinicG.add(win); }
add(box(1.9, 0.82, 0.95), M.wood, -2.1, 0.41, 37.8, clinicG);
const gelProp = new THREE.Group(); gelProp.position.set(-2.1, 0.95, 37.8); clinicG.add(gelProp);
{ const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.72, 14), new THREE.MeshPhongMaterial({ color: 0xe8a8b8, transparent: true, opacity: 0.6, shininess: 140, specular: 0xffe4ee, depthWrite: false }));
  sleeve.rotation.z = Math.PI / 2; sleeve.userData.ndSkip = true; gelProp.add(sleeve);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 18), toon({ color: '#a8d8c8' })); band.rotation.y = Math.PI / 2; gelProp.add(band); }
const gelGlint = FX.glint(0.55); gelGlint.position.set(-1.85, 1.25, 38.05); gelGlint.material.opacity = 0; gelGlint.userData.ndSkip = true; clinicG.add(gelGlint);

// ---------- finale boards (in-world text) ----------
const boardTex = (lines, bg, fg, sub) => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 320); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(12, 12, 488, 296);
  g.fillStyle = fg; g.textAlign = 'center';
  lines.forEach((ln, i) => { g.font = `900 ${ln[1]}px Arial`; g.fillText(ln[0], 256, 118 + i * 88); });
  if (sub) { g.font = '700 34px Arial'; g.fillText(sub, 256, 282); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const mkBoard = (tex, w, h, x, z, ry = 0) => {
  const g = new THREE.Group(); g.position.set(x, 0.3, z); g.rotation.y = ry; scene.add(g);
  add(box(w + 0.15, h + 0.15, 0.07), M.wood, 0, h / 2 + 0.45, 0, g);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: true }));
  face.position.set(0, h / 2 + 0.45, 0.045); face.userData.ndSkip = true; g.add(face);
  for (const s of [-w / 3, w / 3]) add(box(0.08, 0.5, 0.08), M.darkMetal, s, 0.25, 0, g, { cast: false });
  return g;
};
const posterBoard = mkBoard(boardTex([['DOLPHIN', 74], ['TALE', 74]], '#fdf6e0', '#1d5f74', 'THE MOVIE'), 2.3, 1.45, -6.9, 8.8, Math.PI / 2);
const finalBoard = mkBoard(boardTex([['SHE NEVER', 62], ['GAVE UP.', 62]], '#1d5f74', '#fdf6e0'), 2.5, 1.15, 0.7, 7.6, -0.12);

// ---------- Winter ----------
const dol = buildDolphin(); scene.add(dol.group);
const looseFluke = new THREE.Group(); scene.add(looseFluke);
{ const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.24, 10), toon({ color: '#3d4a55' })); stalk.rotation.x = Math.PI / 2; stalk.position.z = 0.1; looseFluke.add(stalk);
  const fl = buildFluke(toon({ color: '#54748a' })); fl.position.z = -0.05; looseFluke.add(fl);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.105, 0.3, 14), new THREE.MeshPhongMaterial({ color: 0xa8d8c8, transparent: true, opacity: 0.55, shininess: 120, depthWrite: false }));
  sleeve.rotation.x = Math.PI / 2; sleeve.position.z = 0.3; looseFluke.add(sleeve); }
looseFluke.visible = false;
// spine-strain glow sprites (warning section)
const spineSprites = [];
for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffb45e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); sp.userData.ndSkip = true; sp.scale.setScalar(0.34); scene.add(sp); spineSprites.push(sp); }
// bubbles: sprite pool, positions are a pure function of frame + Winter's position
const BUB_N = 110;
const bubGeo = new THREE.BufferGeometry();
const bubPos = new Float32Array(BUB_N * 3);
bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3).setUsage(THREE.DynamicDrawUsage));
const bubMat = new THREE.PointsMaterial({ map: FX.puffTexture(), color: 0xdff4ff, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
const bubbles = new THREE.Points(bubGeo, bubMat); bubbles.userData.ndSkip = true; bubbles.frustumCulled = false; scene.add(bubbles);

// ---------- FX systems ----------
const splashes = new FX.Splashes(scene, 260); splashes.points.userData.ndSkip = true;
const wake = new FX.Wake(scene, 36); wake.pool.forEach((p) => { p.m.userData.ndSkip = true; });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.5, color: 0xeaf2f8, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.position.z = -70; cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1;
const fxReset = () => {
  splashes.life.fill(-1);
  wake.pool.forEach((p) => { p.life = -1; p.m.visible = false; }); wake.acc = 0;
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, S = shotAt(fxF), w = winterAt(fxF);
    if (S.id === 'rescue' && fxF >= 250 && fxF <= 345 && fxF % 9 === 0) splashes.burst(w.pos[0], 0.06, w.pos[2], { n: 13, power: 3.1 });
    if (S.id === 'fitting' && fxF % 13 === 0) splashes.burst(w.pos[0] + 0.3, 0.06, w.pos[2], { n: 8, power: 2.0 });
    if (S.id === 'wobbly' && fxF >= 1196 && fxF <= 1252 && fxF % 6 === 0) splashes.burst(w.pos[0], 0.06, w.pos[2], { n: 12, power: 3.0 });
    if (S.id === 'breakthrough' && fxF === 1300) splashes.burst(w.pos[0], 0.06, w.pos[2] - 1, { n: 30, power: 5 });
    if (S.id === 'breakthrough' && fxF > 1290 && fxF % 7 === 0) splashes.burst(w.pos[0], 0.06, w.pos[2], { n: 7, power: 2.2 });
    if (S.id === 'finale' && fxF % 23 === 0) splashes.burst(w.pos[0], 0.06, w.pos[2], { n: 6, power: 1.8 });
    const b = boatAt(fxF);
    if (S.id === 'rescue' && b.speed > 0.3) wake.trail(b.pos[0] - Math.sin(b.yaw) * 2.8, b.pos[2] - Math.cos(b.yaw) * 2.8, dt, 1.7);
    if (S.id === 'breakthrough') wake.trail(w.pos[0], w.pos[2] - 1.2, dt, 0.9);
    splashes.update(t, dt); wake.update(t, dt); fxClouds.update(t, dt);
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

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  for (const wm of [seaWater, poolWater]) {
    wm.material.uniforms.uDeep.value.set(L.waterDeep); wm.material.uniforms.uShallow.value.set(L.waterShal); wm.material.uniforms.uSky.value.set(L.glint);
  }
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}

function worldState(Ws, f) {
  fxStepTo(f);
  const t = f / 30;
  skyU.time.value = t;
  seaWater.userData.update(t); poolWater.userData.update(t);
  const w = winterAt(f);
  // Winter
  dol.setTail(w.tailMode);
  if (w.detached) dol.proGroup.visible = false;
  dol.pose(t, w.swimK);
  dol.group.scale.setScalar(w.scale);
  dol.group.position.set(w.pos[0], w.pos[1] + dol.bob, w.pos[2]);
  dol.group.rotation.set(w.pitch || 0, w.yaw, dol.roll);
  dol.group.visible = w.visible;
  looseFluke.visible = !!w.detached;
  if (w.detached && w.flukePos) { looseFluke.position.set(...w.flukePos); looseFluke.rotation.set(w.flukeSpin * 0.6, w.yaw, w.flukeSpin); }
  // boat
  const b = boatAt(f);
  boatG.position.set(b.pos[0], Math.sin(f * 0.07) * 0.045, b.pos[2]);
  boatG.rotation.y = b.yaw; boatG.rotation.z = Math.sin(f * 0.05) * 0.012;
  boatG.visible = Ws.shot === 'hook' || Ws.shot === 'rescue';
  // trap line + wrap (cut at the rescue, f=285)
  const lineOn = Ws.shot === 'hook' || (Ws.shot === 'rescue' && f < 285);
  trapLine.visible = trapWrap.visible = lineOn; trapG.visible = lineOn || Ws.shot === 'hook';
  if (lineOn) {
    const tailOff = new THREE.Vector3(-Math.sin(w.yaw) * 1.02 * w.scale, 0, -Math.cos(w.yaw) * 1.02 * w.scale);
    const tailPos = new THREE.Vector3(...w.pos).add(tailOff);
    setBeam(trapLine, new THREE.Vector3(0.9, -2.85, -48.0), tailPos);
    trapWrap.position.copy(tailPos); trapWrap.rotation.set(0, w.yaw, Math.PI / 2);
  }
  // sling during the lift
  slingG.visible = Ws.shot === 'rescue' && Ws.slingK > 0.02;
  if (slingG.visible) { slingG.position.set(w.pos[0], w.pos[1] - 0.05, w.pos[2]); slingG.rotation.y = w.yaw; slingG.scale.setScalar(w.scale * (0.6 + 0.4 * Ws.slingK)); }
  // god rays + seaweed sway (sea shots)
  rays.forEach((r, i) => { r.material.opacity = (Ws.shot === 'hook' || Ws.shot === 'rescue' ? 0.042 : 0.015) * (0.75 + 0.25 * Math.sin(f * 0.02 + i * 2.1)); r.rotation.z = 0.32 + Math.sin(f * 0.01 + i) * 0.03; });
  seaSkin.visible = poolSkin.visible = camera.position.y < 0.0; // surface skins only when the camera is truly below the plane
  weeds.forEach((wd, i) => { wd.rotation.z = Math.sin(f * 0.03 + i * 1.3) * 0.09; });
  seaG.visible = poolG.visible = true;
  // spine glow (warning)
  spineSprites.forEach((sp, i) => {
    const lz = 0.55 - i * 0.19, off = new THREE.Vector3(Math.sin(w.yaw) * lz * w.scale, 0.31 * w.scale, Math.cos(w.yaw) * lz * w.scale);
    sp.position.set(w.pos[0] + off.x, w.pos[1] + off.y, w.pos[2] + off.z);
    sp.material.opacity = (Ws.spineGlow || 0) * (0.3 + 0.18 * Math.sin(f * 0.3 + i * 1.4));
  });
  // bubbles around Winter (pure function of frame)
  {
    const on = Ws.bubbleK > 0.01 && w.visible;
    bubbles.visible = on;
    if (on) {
      bubMat.opacity = 0.5 * Ws.bubbleK;
      for (let i = 0; i < BUB_N; i++) {
        const sd = i * 12.9898, ox = Math.sin(sd) * 1.6, oz = Math.cos(sd * 1.7) * 1.6;
        const rise = ((f * (0.006 + (i % 5) * 0.0016) + (i % 17) / 17) % 1);
        bubPos[i * 3] = w.pos[0] + ox + Math.sin(f * 0.05 + i * 2.0) * 0.22 - Math.sin(w.yaw) * rise * 1.4 * w.scale;
        bubPos[i * 3 + 1] = Math.min(-0.12, w.pos[1] - 0.7 + rise * 2.6);
        bubPos[i * 3 + 2] = w.pos[2] + oz + Math.cos(f * 0.04 + i) * 0.22 - Math.cos(w.yaw) * rise * 1.4 * w.scale;
      }
      bubGeo.attributes.position.needsUpdate = true;
    }
  }
  // finale boards + gel glint
  posterBoard.visible = Ws.posterK > 0;
  finalBoard.visible = Ws.finalBoardK > 0.01;
  if (finalBoard.visible) finalBoard.scale.setScalar(0.7 + 0.3 * Ws.finalBoardK);
  gelGlint.material.opacity = (Ws.gelGlint || 0) * (Ws.shot === 'gel' ? 0.8 : 0);
  modelFluke.visible = Ws.shot === 'question' || Ws.shot === 'fitting' || Ws.shot === 'finale';
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
    if (a.blob !== false) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? a.y) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
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
