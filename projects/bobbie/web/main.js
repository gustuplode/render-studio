import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, scrollAt, carAt, milesAt, heroPosAt } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene(); window.__scene = scene; window.__THREE = THREE;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(1), 1, 6), beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  stone: texM(P.stone(4), 1, 1),
  snow: texM(P.plaster(8, 215), 30, 30, '#e6eef8'),
  logWall: texM(P.planks(5), 2, 2, '#97795a'), logWall2: texM(P.planks(6), 2, 2, '#86684c'),
  roofWood: texM(P.planks(9), 2, 1, '#5d4a38'), snowTop: texM(P.plaster(10, 215), 2, 2, '#f2f7fd'),
  dirt: texM(P.dirt(7), 6, 30),
  grassAutumn: texM(P.plaster(12, 40), 24, 24, '#b39b58'),
  grass: texM(P.plaster(13, 90), 24, 24, '#7d8f56'),
  sand: texM(P.plaster(14, 45), 24, 24, '#dcbd85'),
  brick: texM(P.planks(15), 2, 2, '#a8563c'),
};
const MW = {
  pine: toon({ color: '#2c4a3e' }), pineSnow: toon({ color: '#cfe0ee' }), autumn: toon({ color: '#c47a2e' }), autumn2: toon({ color: '#a84e2a' }),
  hill: toon({ color: '#c3cfdf' }), mesa: toon({ color: '#b0704a' }), darkIn: toon({ color: '#241d18' }),
  iron: toon({ color: '#5c5a57' }), darkMetal: toon({ color: '#3c4148' }),
  lampGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,190,110', 0.85)), transparent: true, fog: false, depthWrite: false }),
  winGlow: new THREE.MeshBasicMaterial({ color: '#ffb45e', fog: false }),
  red: toon({ color: '#9c3a2e' }), barnRed: toon({ color: '#8c3a30' }), white: toon({ color: '#eef2f6' }),
  carBody: toon({ color: '#2e3d33' }), cream: toon({ color: '#e9dcba' }),
};

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

// ---------- world ----------
const world = new THREE.Group(); scene.add(world);
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const winMats = [];
const winAt = (parent, x, y, z, w = 0.52, h = 0.6) => {
  const wm = MW.winGlow.clone(); winMats.push(wm);
  const wp = add(new THREE.PlaneGeometry(w, h), wm, x, y, z, parent, { cast: false });
  wp.userData.ndSkip = true; return wp;
};
const pineAt = (x, z, h = 4.2, parent = world, foliage = null) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  add(new THREE.CylinderGeometry(0.09, 0.14, h * 0.3, 7), M.beamDark, 0, h * 0.15, 0, g, { cast: false });
  for (let i = 0; i < 3; i++) {
    const y = h * (0.32 + i * 0.2), r = h * (0.30 - i * 0.075);
    add(new THREE.ConeGeometry(r, h * 0.34, 9), foliage || MW.pine, 0, y, 0, g, { cast: false });
    if (!foliage) add(new THREE.ConeGeometry(r * 0.62, h * 0.16, 9), MW.pineSnow, 0, y + h * 0.09, 0, g, { cast: false });
  }
  return g;
};
const buildingAt = (x, z, ry, w, h, d, mat, roofMat = null) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  add(tbox(w, h, d, 2), mat, 0, h / 2, 0, g);
  const rf = add(tbox(w * 0.62, 0.09, d * 1.15, 2), roofMat || M.roofWood, -w * 0.24, h + 0.35, 0, g); rf.rotation.z = 0.55;
  const rf2 = add(tbox(w * 0.62, 0.09, d * 1.15, 2), roofMat || M.roofWood, w * 0.24, h + 0.35, 0, g); rf2.rotation.z = -0.55;
  return g;
};

// base earth + distant hills
flat(add(new THREE.CircleGeometry(220, 40), texM(P.plaster(20, 135), 40, 40, '#a8916a'), 0, -0.05, 0, world, { cast: false }));
for (const [hx, hy, hz, hr] of [[-90, -8, -70, 26], [30, -9, -85, 22], [95, -8, -40, 24], [-95, -8, 30, 22], [60, -9, 70, 26]]) {
  const h = add(new THREE.SphereGeometry(hr, 16, 10), MW.hill, hx, hy - 5, hz, world, { cast: false }); h.scale.y = 0.45;
}

// ===== (1) WOLCOTT, Indiana — brick main street, 1923 =====
{
  flat(add(new THREE.PlaneGeometry(9, 34), M.dirt, 0, 0.01, -40, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(20, 28), M.grassAutumn, 0, -0.01, -40, world, { cast: false }));
  const b1 = buildingAt(-6.5, -44, 0.25, 5, 3.6, 4, M.brick); winAt(b1, 0.8, 1.9, 2.02); winAt(b1, -1.2, 1.9, 2.02);
  const b2 = buildingAt(6.5, -43, -0.25, 5, 3.2, 4, M.logWall2); winAt(b2, 0.6, 1.7, 2.02); winAt(b2, -1.4, 1.7, 2.02);
  const b3 = buildingAt(-7.9, -37.5, 0.15, 4.4, 3.0, 3.6, M.brick); winAt(b3, 0.4, 1.6, 1.82);
  const b4 = buildingAt(6.8, -35.5, -0.15, 4.4, 3.4, 3.6, M.logWall); winAt(b4, -0.4, 1.8, 1.82);
  buildingAt(-7, -48.5, 0.3, 5, 2.8, 4, M.logWall);
  pineAt(-10, -31, 4.6, world, MW.autumn); pineAt(10.5, -32, 5, world, MW.autumn2); pineAt(-11, -47, 5.2, world, MW.autumn);
}
// ===== (2) ROAD / autumn plain =====
{
  flat(add(new THREE.CircleGeometry(19, 28), M.grassAutumn, 30, -0.01, -40, world, { cast: false }));
  const rd = flat(add(new THREE.PlaneGeometry(30, 3.4), M.dirt, 30, 0.012, -40, world, { cast: false })); rd.rotation.z = 0.35;
  pineAt(22, -47, 5, world, MW.autumn); pineAt(38, -46, 4.4, world, MW.autumn2); pineAt(21, -33, 4.8, world, MW.autumn2);
  pineAt(39, -33.5, 5.4, world, MW.autumn); pineAt(26, -48.5, 4.2, world, MW.autumn); pineAt(35, -31.5, 4.6, world, MW.autumn2);
  for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 6), M.beamDark, 23 + i * 3.1, 0.5, -44.6 + i * 0.6, world, { cast: false });
}
// ===== period car prop (one car, story.carAt drives it) =====
const car = new THREE.Group(); world.add(car);
{
  add(tbox(1.7, 0.62, 3.6, 2), MW.carBody, 0, 0.72, 0, car);
  add(tbox(1.5, 0.72, 1.7, 2), MW.carBody, 0, 1.36, 0.25, car);
  add(tbox(1.56, 0.08, 1.8, 2), M.beamDark, 0, 1.76, 0.25, car);
  for (const sx of [-0.72, 0.72]) for (const sz of [-1.25, 1.25]) {
    const wh = add(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 14), M.beamDark, sx, 0.36, sz, car, { cast: false });
    wh.rotation.z = Math.PI / 2;
    add(new THREE.SphereGeometry(0.07, 8, 6), MW.cream, sx * 1.06, 0.36, sz, car, { cast: false });
  }
  for (const sx of [-0.6, 0.6]) add(new THREE.SphereGeometry(0.11, 8, 6), MW.cream, sx, 0.88, -1.84, car, { cast: false }); // headlamps
  add(box(1.5, 0.3, 0.5), M.logWall2, 0, 0.85, 1.95, car, { cast: false }); // luggage trunk
}
// ===== (5a) MAP BOARD — the USA route draws itself =====
const mapCanvas = document.createElement('canvas'); mapCanvas.width = 1024; mapCanvas.height = 640;
const mapTex = new THREE.CanvasTexture(mapCanvas); mapTex.colorSpace = THREE.SRGBColorSpace; mapTex.anisotropy = 4;
const MX = (x) => 190 + 0.62 * x;
const USAraw = [[120, 200], [150, 150], [230, 120], [340, 105], [470, 100], [600, 105], [730, 120], [850, 150], [905, 210], [880, 300], [905, 380], [840, 460], [740, 500], [640, 470], [560, 520], [470, 490], [390, 525], [300, 480], [230, 500], [170, 430], [130, 330], [110, 260]];
const USA = USAraw.map(([x, y]) => [MX(x), y]);
const SILV_PT = [MX(196), 196], WOLC_PT = [MX(742), 252];
const routePt = (t) => {
  const [x0, y0] = WOLC_PT, [x1, y1] = SILV_PT, cxp = MX(470), cyp = 130;
  const u = 1 - t; return [u * u * x0 + 2 * u * t * cxp + t * t * x1, u * u * y0 + 2 * u * t * cyp + t * t * y1];
};
let mapDrawnKey = '';
const drawMap = (t, miles) => {
  const key = Math.round(t * 50) + ':' + Math.round(miles / 10);
  if (key === mapDrawnKey) return; mapDrawnKey = key;
  const g = mapCanvas.getContext('2d');
  g.fillStyle = '#e9dcba'; g.fillRect(0, 0, 1024, 640);
  g.strokeStyle = '#c9b586'; g.lineWidth = 3; for (let i = 0; i < 26; i++) { g.beginPath(); g.moveTo(0, i * 26); g.lineTo(1024, i * 26 + 30); g.stroke(); }
  g.beginPath(); USA.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
  g.fillStyle = '#d9e4ee'; g.fill(); g.lineWidth = 9; g.strokeStyle = '#5d7d9c'; g.stroke();
  g.fillStyle = '#33506b'; g.font = '900 42px Arial'; g.fillText('UNITED STATES', 330, 66);
  g.font = '700 24px Arial'; g.fillText('1923', 880, 84);
  g.strokeStyle = '#c0302c'; g.lineWidth = 8; g.lineCap = 'round'; g.setLineDash([20, 15]);
  g.beginPath(); const N = Math.max(2, Math.floor(t * 60));
  for (let i = 0; i <= N; i++) { const [x, y] = routePt(i / 60); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.setLineDash([]);
  const dot = (x, y, col, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 4; g.strokeStyle = '#33506b'; g.stroke(); };
  dot(WOLC_PT[0], WOLC_PT[1], '#f2f4f6', 13);
  dot(SILV_PT[0], SILV_PT[1], '#ffd23e', 16);
  g.fillStyle = '#33506b'; g.font = '900 28px Arial';
  g.fillText('WOLCOTT', WOLC_PT[0] - 52, WOLC_PT[1] + 52);
  g.fillText('SILVERTON', SILV_PT[0] - 62, SILV_PT[1] - 30);
  if (t > 0.1) { // the mile counter, counting as the line draws
    g.fillStyle = '#2e2620'; g.fillRect(300, 540, 424, 74);
    g.fillStyle = '#ffd23e'; g.font = '900 52px Arial'; g.textAlign = 'center';
    g.fillText(miles.toLocaleString('en-US') + ' MILES', 512, 594); g.textAlign = 'left';
  }
  mapTex.needsUpdate = true;
};
drawMap(0, 0);
{
  const g = new THREE.Group(); g.position.set(30, 0, 0); g.rotation.y = Math.PI; world.add(g);
  for (const sd of [-3.1, 3.1]) add(new THREE.CylinderGeometry(0.09, 0.11, 4.6, 8), M.beamDark, sd, 2.3, 0, g);
  add(tbox(7.6, 5.0, 0.16, 2), M.logWall2, 0, 2.75, -0.1, g);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.5), new THREE.MeshBasicMaterial({ map: mapTex, fog: true }));
  board.position.set(0, 2.75, 0.0); board.userData.ndSkip = true; g.add(board);
  const rf = add(tbox(8.0, 0.1, 1.1, 2), M.roofWood, 0, 5.45, 0.25, g); rf.rotation.x = 0.25;
  flat(add(new THREE.CircleGeometry(17, 26), M.grassAutumn, 30, -0.02, 2, world, { cast: false }));
  pineAt(20, 6, 5, world, MW.autumn); pineAt(40, 5, 4.6, world, MW.autumn2); pineAt(22, -7, 4.4, world, MW.autumn2);
}
// ===== mile counter board (drone + worn beats) =====
const cntCanvas = document.createElement('canvas'); cntCanvas.width = 1024; cntCanvas.height = 384;
const cntTex = new THREE.CanvasTexture(cntCanvas); cntTex.colorSpace = THREE.SRGBColorSpace; cntTex.anisotropy = 4;
let cntKey = -1;
const drawCounter = (miles) => {
  const key = Math.round(miles / 5); if (key === cntKey) return; cntKey = key;
  const g = cntCanvas.getContext('2d');
  g.fillStyle = '#2e2620'; g.fillRect(0, 0, 1024, 384);
  g.fillStyle = '#e9dcba'; g.fillRect(22, 22, 980, 340);
  g.fillStyle = '#2e2620'; g.textAlign = 'center'; g.font = '900 150px Arial';
  g.fillText(miles.toLocaleString('en-US'), 512, 205);
  g.font = '900 84px Arial'; g.fillStyle = '#c0302c'; g.fillText('MILES FROM HOME', 512, 320); g.textAlign = 'left';
  cntTex.needsUpdate = true;
};
drawCounter(0);
{
  const g = new THREE.Group(); g.position.set(-30, 0, 21.5); world.add(g);
  for (const sd of [-1.9, 1.9]) add(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 7), M.beamDark, sd, 1.7, -0.08, g, { cast: false });
  add(tbox(4.7, 1.9, 0.1, 2), M.logWall2, 0, 2.5, -0.06, g);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.65), new THREE.MeshBasicMaterial({ map: cntTex, fog: true }));
  face.position.set(0, 2.5, 0.01); face.userData.ndSkip = true; g.add(face);
}
// ===== (3) RIVER — shader water he swims =====
const river = FX.makeWater({ size: 25, seg: 50, deep: 0x1d4a66, shallow: 0x3d84a8, sky: 0xbfe3f2, amp: 0.16 });
river.position.set(60, 0.02, 10); river.userData.ndSkip = true; world.add(river);
{ // deep-water base disc under the shader plane (per the FX library pairing rule)
  const base = flat(add(new THREE.CircleGeometry(13.5, 26), texM(P.plaster(22, 205), 10, 10, '#2e6da8'), 60, 0.015, 10, world, { cast: false }));
  base.receiveShadow = false;
}
{
  flat(add(new THREE.CircleGeometry(20, 26), M.grass, 60, -0.04, 10, world, { cast: false }));
  const r = P.rng(41);
  for (let i = 0; i < 8; i++) { const s = add(new THREE.SphereGeometry(0.5 + r() * 0.7, 8, 6), M.stone, 47 + r() * 26, 0.05, 1 + r() * 18, world, { cast: false }); s.scale.y = 0.55; }
  pineAt(46, 2, 5.4); pineAt(74, 3, 4.8); pineAt(47, 19, 4.6); pineAt(73, 18, 5.2);
}
// ===== (4) DESERT =====
{
  flat(add(new THREE.CircleGeometry(15, 26), M.sand, 84, -0.01, 10, world, { cast: false }));
  const cactus = (x, z, h) => { const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
    add(new THREE.CylinderGeometry(0.16, 0.2, h, 8), toon({ color: '#4a7a44' }), 0, h / 2, 0, g, { cast: false });
    const arm = add(new THREE.CylinderGeometry(0.11, 0.13, h * 0.4, 7), toon({ color: '#4a7a44' }), 0.42, h * 0.62, 0, g, { cast: false }); arm.rotation.z = 0.5;
    add(new THREE.CylinderGeometry(0.11, 0.13, h * 0.34, 7), toon({ color: '#4a7a44' }), 0.62, h * 0.78, 0, g, { cast: false }); };
  cactus(72, 5, 2.2); cactus(85, 15, 2.8); cactus(70, 16, 1.8); cactus(87, 4, 2.4);
  const r = P.rng(43);
  for (let i = 0; i < 7; i++) { const s = add(new THREE.SphereGeometry(0.4 + r() * 0.8, 8, 6), MW.mesa, 66 + r() * 24, 0.02, 2 + r() * 17, world, { cast: false }); s.scale.y = 0.5; }
  const mesa = add(box(10, 3.2, 5), MW.mesa, 92, 1.2, 22, world, { cast: false });
  add(box(7, 1.6, 4), MW.mesa, 92, 3.4, 22, world, { cast: false });
}
// ===== (5) MOUNTAIN PASS — deep winter =====
{
  flat(add(new THREE.CircleGeometry(20, 26), M.snow, -60, -0.01, 10, world, { cast: false }));
  const wallL = add(box(3, 3.4, 26), M.snow, -68, 1.0, 10, world, { cast: false });
  const wallR = add(box(3, 4, 26), M.snow, -52, 1.3, 10, world, { cast: false });
  add(tbox(3.2, 0.5, 26, 2), M.snowTop, -68, 2.9, 10, world, { cast: false });
  add(tbox(3.2, 0.5, 26, 2), M.snowTop, -52, 3.5, 10, world, { cast: false });
  pineAt(-66, 1, 5.4); pineAt(-54, 0, 4.8); pineAt(-66, 20, 5); pineAt(-54, 21, 5.6);
  const r = P.rng(47);
  for (let i = 0; i < 9; i++) { const s = add(new THREE.SphereGeometry(0.9 + r() * 1.3, 9, 7), M.snowTop, -66 + r() * 13, -0.2, 1 + r() * 19, world, { cast: false }); s.scale.y = 0.35; }
}
// ===== (6) FARM / barn stop =====
{
  flat(add(new THREE.CircleGeometry(17, 26), M.grassAutumn, -30, -0.01, -10, world, { cast: false }));
  const barn = new THREE.Group(); barn.position.set(-26.5, 0, -14.5); barn.rotation.y = 0.5; world.add(barn);
  add(tbox(4.6, 3.0, 3.6, 2), MW.barnRed, 0, 1.5, 0, barn);
  const rf = add(tbox(2.9, 0.09, 4.0, 2), M.roofWood, -1.25, 3.55, 0, barn); rf.rotation.z = 0.6;
  const rf2 = add(tbox(2.9, 0.09, 4.0, 2), M.roofWood, 1.25, 3.55, 0, barn); rf2.rotation.z = -0.6;
  add(box(1.5, 2.1, 0.07), M.beamDark, 0, 1.05, 1.83, barn, { cast: false }); // barn door
  winAt(barn, 1.4, 2.2, 1.83, 0.44, 0.5);
  const fh = buildingAt(-35, -15, 0.4, 3.6, 2.4, 3, M.logWall); winAt(fh, 0.5, 1.3, 1.52);
  for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.05, 0.06, 0.95, 6), M.beamDark, -34 + i * 2.2, 0.48, -5.6, world, { cast: false });
  add(box(8.6, 0.07, 0.07), M.beamDark, -29.6, 0.82, -5.6, world, { cast: false });
  const bowl = add(new THREE.CylinderGeometry(0.3, 0.2, 0.14, 12), MW.iron, -31.15, 0.07, -8.15, world, { cast: false });
  const hay = add(new THREE.CylinderGeometry(0.55, 0.55, 0.8, 10), texM(P.plaster(16, 45), 2, 1, '#d9b45e'), -28.6, 0.4, -12.6, world, { cast: false }); hay.rotation.z = Math.PI / 2;
  pineAt(-37, -4, 4.8, world, MW.autumn); pineAt(-22, -6, 4.4, world, MW.autumn2);
}
// ===== worn plain (drone set) =====
{
  flat(add(new THREE.CircleGeometry(30, 30), M.grassAutumn, -30, -0.02, 30, world, { cast: false }));
  pineAt(-44, 22, 5, world, MW.autumn); pineAt(-16, 38, 4.6, world, MW.autumn2); pineAt(-43, 40, 4.8, world, MW.autumn2);
}
// scroll props around the plain (parallax during journey beats)
const scrollProps = [];
{ const r = P.rng(53);
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1, z0 = 8 + i * 4.1 + r() * 1.6, x = -30 + side * (4.5 + r() * 3);
    let g;
    if (i % 3 === 2) g = pineAt(x, z0, 3.6 + r() * 1.2, world, MW.autumn);
    else { g = new THREE.Group(); g.position.set(x, 0, z0); world.add(g); const s = add(new THREE.SphereGeometry(0.8 + r() * 0.9, 9, 7), M.snowTop, 0, -0.2, 0, g, { cast: false }); s.scale.y = 0.4; s.visible = false;
      const b = add(new THREE.SphereGeometry(0.7 + r() * 0.8, 8, 6), toon({ color: '#8f7a4a' }), 0, 0.1, 0, g, { cast: false }); b.scale.y = 0.6; }
    scrollProps.push({ g, z0 });
  }
}
// ===== (7) SILVERTON — street + the family house with an opening door =====
let doorPivot;
{
  flat(add(new THREE.PlaneGeometry(9, 30), M.dirt, -60, 0.01, -40, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(20, 28), texM(P.plaster(17, 215), 24, 24, '#ccd6de'), -60, -0.01, -40, world, { cast: false }));
  const h1 = buildingAt(-67, -44, 0.25, 4.6, 3.2, 3.8, M.logWall); winAt(h1, 0.6, 1.7, 1.92);
  const h2 = buildingAt(-44.5, -37, -0.3, 4.4, 3.0, 3.6, M.logWall2); winAt(h2, -0.5, 1.6, 1.82);
  pineAt(-68, -33, 5); pineAt(-52, -47, 4.6);
  // the family house
  const house = new THREE.Group(); house.position.set(-60, 0, -47.6); world.add(house);
  add(tbox(5.4, 2.9, 3.4, 2), M.logWall2, 0, 1.45, 0, house);
  const rf = add(tbox(3.3, 0.09, 3.9, 2), M.roofWood, -1.5, 3.3, 0, house); rf.rotation.z = 0.55;
  const rf2 = add(tbox(3.3, 0.09, 3.9, 2), M.roofWood, 1.5, 3.3, 0, house); rf2.rotation.z = -0.55;
  const sn = add(tbox(3.3, 0.07, 3.9, 2), M.snowTop, -1.52, 3.42, 0, house, { cast: false }); sn.rotation.z = 0.55;
  const sn2 = add(tbox(3.3, 0.07, 3.9, 2), M.snowTop, 1.52, 3.42, 0, house, { cast: false }); sn2.rotation.z = -0.55;
  winAt(house, -1.7, 1.7, 1.72); winAt(house, 1.7, 1.7, 1.72);
  add(box(1.3, 2.15, 0.1), MW.darkIn, 0, 1.08, 1.71, house, { cast: false }); // doorway (dark inside)
  doorPivot = new THREE.Group(); doorPivot.position.set(-0.58, 0, 1.74); house.add(doorPivot);
  add(box(1.16, 2.1, 0.07), texM(P.planks(18), 1, 2, '#7a4a30'), 0.58, 1.05, 0, doorPivot);
  add(new THREE.SphereGeometry(0.05, 8, 6), MW.cream, 1.02, 1.05, 0.07, doorPivot, { cast: false });
  add(box(5.8, 0.14, 1.1), M.beam, 0, 0.07, 2.2, house, { cast: false }); // porch step
}
// finale board: "2,551 MILES. ON FOOT. FOR LOVE."
const textBoard = (lines, w, h) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = '#6d5136'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#e9dcba'; g.fillRect(26, 26, c.width - 52, c.height - 52);
  g.strokeStyle = '#8a6a44'; g.lineWidth = 10; g.strokeRect(26, 26, c.width - 52, c.height - 52);
  g.fillStyle = '#2e2620'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach(([txt, px], i) => { g.font = `900 ${px}px Arial`; g.fillText(txt, c.width / 2, c.height * (0.30 + 0.36 * i)); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const grp = new THREE.Group();
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.055, 0.07, h + 0.7, 7), M.beamDark, sd * w * 0.38, (h + 0.7) / 2, -0.06, grp, { cast: false });
  add(tbox(w + 0.16, h + 0.16, 0.09, 2), M.logWall2, 0, h / 2 + 0.62, -0.05, grp);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: true }));
  face.position.set(0, h / 2 + 0.62, 0.01); face.userData.ndSkip = true; grp.add(face);
  return grp;
};
const finaleBoard = textBoard([['2,551 MILES.', 126], ['ON FOOT. FOR LOVE.', 88]], 2.5, 1.5);
finaleBoard.position.set(-62.65, 0, -45.7); finaleBoard.rotation.y = 0.15; finaleBoard.scale.set(0.85, 0.85, 0.85); world.add(finaleBoard);
// chimneys
const CHIMNEYS = [[-35, 3.4, -15.6], [-60, 3.9, -48.2], [-6.5, 4.2, -44.6]];
for (const [cx, cy, cz] of CHIMNEYS) add(box(0.34, 0.9, 0.34), M.stone, cx, cy - 0.4, cz, world, { cast: false });

// lantern posts: 0 Wolcott · 1 farm · 2 Silverton house · 3 map
const lanterns = [];
const lanternAt = (x, z) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(new THREE.CylinderGeometry(0.045, 0.055, 2.2, 7), M.beamDark, 0, 1.1, 0, g);
  add(new THREE.ConeGeometry(0.2, 0.14, 4), M.darkMetal, 0, 2.32, 0, g, { cast: false });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), FX.glassMat(0xffc37a, 0.2));
  glass.position.y = 1.96; glass.userData.ndSkip = true; g.add(glass);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffb45e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(0.75); glow.position.y = 1.96; glow.userData.ndSkip = true; g.add(glow);
  const pool = flat(add(new THREE.CircleGeometry(1.2, 18), MW.lampGlow, 0, 0.015, 0, g, { cast: false }));
  pool.material = MW.lampGlow.clone(); pool.material.opacity = 0; pool.userData.ndSkip = true; pool.receiveShadow = false;
  lanterns.push({ glow, pool, glass });
  return g;
};
lanternAt(-4.5, -38.5); lanternAt(-33, -6); lanternAt(-57.3, -43.6); lanternAt(26, -2.5);

// stars
const starGeo = new THREE.BufferGeometry();
{ const r = P.rng(7), pos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) { const th = r() * Math.PI * 2, y = 0.1 + r() * 0.9, rr = Math.sqrt(1 - y * y) * 430; pos[i * 3] = Math.cos(th) * rr; pos[i * 3 + 1] = y * 430; pos[i * 3 + 2] = Math.sin(th) * rr; }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); }
const starMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat); stars.userData.ndSkip = true; scene.add(stars);

// ---------- FX ----------
const smoke = new FX.Smoke(scene, 110); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const smokeEmits = CHIMNEYS.map(([x, y, z]) => smoke.addEmitter(x, y + 0.35, z, { rate: 2, color: 0xaab2bc, opacity: 0.15, scale: 0.42, grow: 1.15, life: 2.6, vy: 1.1, wind: 0.5 }));
const fire = new FX.Fire(scene, { x: -33.6, y: 0.14, z: -12.2, scale: 0.8, rate: 14, light: true, max: 28 });
fire.pool.forEach((p) => { p.s.userData.ndSkip = true; });
if (fire.light) { fire.light.userData.ndSkip = true; fire.light.distance = 7; }
for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, s = add(new THREE.SphereGeometry(0.15, 8, 6), M.stone, -33.6 + Math.cos(a) * 0.5, 0.06, -12.2 + Math.sin(a) * 0.5, world, { cast: false }); s.scale.y = 0.7; }
const fxClouds = new FX.Clouds(scene, { count: 5, y: 58, opacity: 0.22, color: 0xd8dee8, drift: 0.4 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const mist = FX.mistBand(scene, { count: 7, y: 0.8, opacity: 0.25 });
mist.children.forEach((s, i) => { s.position.set(-58 + (i % 3) * 2, 0.6, 2 + i * 2.4); s.scale.set(11, 2.4, 1); s.userData.bx = s.position.x; s.userData.ndSkip = true; });
const splashes = new FX.Splashes(scene, 160); splashes.points.userData.ndSkip = true;
const SNOW_N = 800;
const snowBase = new Float32Array(SNOW_N * 3), snowPos = new Float32Array(SNOW_N * 3), snowSpd = new Float32Array(SNOW_N), snowPh = new Float32Array(SNOW_N);
{ const r = P.rng(97);
  for (let i = 0; i < SNOW_N; i++) { snowBase[i * 3] = -85 + r() * 50; snowBase[i * 3 + 1] = r() * 40; snowBase[i * 3 + 2] = -8 + r() * 36; snowSpd[i] = 0.65 + r() * 0.8; snowPh[i] = r() * 6.28; } }
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: FX.puffTexture(), color: 0xffffff, size: 0.32, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true }));
snowPts.userData.ndSkip = true; snowPts.frustumCulled = false; scene.add(snowPts);
const wrap = (v, a, b) => ((v - a) % (b - a) + (b - a)) % (b - a) + a;
const medalGlint = FX.glint(0.3); medalGlint.position.set(-59.5, 0.92, -44.3); medalGlint.material.opacity = 0; medalGlint.userData.ndSkip = true; world.add(medalGlint);

let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fire.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); fire.acc = 0;
  splashes.life.fill(-1);
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    fire.on = pr.fireRate > 0; fire.rate = pr.fireRate; fire.scale = pr.fireScale;
    smokeEmits.forEach((e) => { e.rate = pr.smokeRate; });
    smoke.update(t, dt); fire.update(t, dt);
    if (fire.light) fire.light.intensity *= 0.14 * (0.35 + 0.7 * pr.fireScale);
    fxClouds.update(t, dt);
    if (Ws.riverK > 0 && fxF % 13 === 0) splashes.burst(60, 0.18, 10, { n: 16, power: 3.4 });
    splashes.update(t, dt);
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
const WIN_DIM = new THREE.Color('#4a3a2c'), WIN_LIT = new THREE.Color('#ffb45e');
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
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
  mist.children.forEach((s, i) => {
    s.position.x = s.userData.bx + Math.sin(f * 0.008 + i * 1.7) * 0.9;
    s.material.opacity = 0.42 * Ws.mist * (0.75 + 0.25 * Math.sin(f * 0.013 + i * 2.1));
  });
  const on = new Set(Ws.lanternSet || []);
  lanterns.forEach((L, i) => {
    const k = on.has(i) ? 1 : 0;
    L.glow.material.opacity = k * (0.38 + 0.05 * Math.sin(f * 0.9 + i * 2.3));
    L.pool.material.opacity = k * 0.32;
    L.glass.material.opacity = k ? 0.55 : 0.2;
  });
  starMat.opacity = 0.9 * Ws.starK;
  winMats.forEach((m) => { m.color.copy(WIN_DIM).lerp(WIN_LIT, Ws.winGlow); });
  drawMap(Ws.mapT || 0, Ws.miles || 0);
  drawCounter(Ws.miles || 0);
  { // falling snow around the pass set (pure function of frame)
    const fall = 1.15 * (0.45 + 0.75 * Ws.snowK), wind = Ws.windK || 0;
    const n = Math.floor(SNOW_N * (0.3 + 0.7 * clamp01(Ws.snowK)));
    snowGeo.setDrawRange(0, n);
    for (let i = 0; i < n; i++) {
      snowPos[i * 3] = wrap(snowBase[i * 3] + Math.sin(t * 0.7 + snowPh[i]) * 0.7 - wind * t * 0.55, -85, -35);
      snowPos[i * 3 + 1] = wrap(snowBase[i * 3 + 1] - t * fall * snowSpd[i], 0, 40);
      snowPos[i * 3 + 2] = wrap(snowBase[i * 3 + 2] + Math.cos(t * 0.5 + snowPh[i]) * 0.6 - wind * t * 0.3, -8, 28);
    }
    snowGeo.attributes.position.needsUpdate = true;
    snowPts.material.opacity = 0.35 + 0.55 * clamp01(Ws.snowK);
    snowPts.material.size = 0.3 + 0.05 * Math.min(Ws.windK || 0, 3);
    snowPts.visible = Ws.snowK > 0.03;
  }
  const sc = scrollAt(f);
  scrollProps.forEach((pr) => { pr.g.position.z = wrap(pr.z0 - sc + 6, 4, 52); });
  const carP = carAt(f);
  car.visible = !!carP;
  if (carP) { car.position.set(carP.x, 0, carP.z); car.rotation.y = carP.ry || 0; }
  if (doorPivot) doorPivot.rotation.y = -(Ws.doorK || 0) * 1.85;
  river.visible = (Ws.riverK || 0) > 0 || Ws.shot === 'rivers';
  river.userData.update(t);
  medalGlint.material.opacity = (Ws.statueGlint || 0) * (0.7 + 0.3 * Math.sin(f * 0.4));
  waterU.t.value = t;
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
