// "The Pirate Who Threw His Gold Away" — enhanced-batch Short.
// three.js scene driven ENTIRELY by story.js frame math; fx.js pools add life.
// Contract (render.mjs): window.ready, window.renderFrame(f), canvas #c 1080x1920.
import * as THREE from 'three';
import * as FX from './fx.js';
import * as T from './toon.js';
import { idle, blinkAt, q } from './motion.js';
import {
  TOTAL, secAt, camAt, envAt, mistBankAt, piratePoseAt, navyPoseAt, chestCountAt,
  keptOutAt, tossEvents, tossArcAt, capSolesAt, capHeadAt, capChestAt, pointUAt,
  volleyAt, ballsAt, boardAt, waveH,
} from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 3000);
const rx = (a) => a * Math.PI / 180;
scene.fog = new THREE.Fog(0xeec3ac, 55, 360);

// ---------- sky dome (house shader, same as sea-king) ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0.004 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xffe2cc, 0x5d564c, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd9a8, 2.1); scene.add(sun); scene.add(sun.target);

// ---------- water + deep base ----------
const env0 = envAt(0);
const water = FX.makeWater({ size: 560, seg: 100, amp: 0.55, deep: new THREE.Color(...env0.deep).getHex(), shallow: new THREE.Color(...env0.shal).getHex(), sky: new THREE.Color(...env0.wsky).getHex() });
scene.add(water);
const basePlane = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshBasicMaterial({ color: 0x14222c, fog: true }));
basePlane.rotation.x = -Math.PI / 2; basePlane.position.y = -1.5; scene.add(basePlane);

// ---------- atmosphere pools ----------
const clouds = new FX.Clouds(scene, { count: 11, y: 30, opacity: 0.8, color: 0xffd9c9 });
clouds.group.traverse((o) => { if (o.isSprite) o.userData.op0 = o.material.opacity; });
const mist = FX.mistBand(scene, { y: 1.6, opacity: 0.15, count: 9 });
mist.traverse((o) => { if (o.isSprite) o.userData.f = 0.7 + Math.random() * 0.6; });
const navyMist = FX.mistBand(scene, { y: 2.4, opacity: 0.3, count: 10 });
navyMist.traverse((o) => { if (o.isSprite) { o.userData.f = 0.7 + Math.random() * 0.6; o.position.set(-150 + Math.random() * 55, 2.4 + (Math.random() - 0.5) * 1.4, -26 + Math.random() * 52); } });
const smoke = new FX.Smoke(scene, 120);
const splashes = new FX.Splashes(scene, 300);
const wake = new FX.Wake(scene, 64);
const muzzleLight = new THREE.PointLight(0xffc98a, 0, 42, 1.6); scene.add(muzzleLight);
const muzzles = []; for (let i = 0; i < 4; i++) muzzles.push(new FX.Muzzle(scene, i === 0 ? muzzleLight : null));
let muzzleIx = 0;
// a small fire for the pirate ship's stern lantern glow is FAKED with a glint
// (no dynamic light budget spent); the diver lamp gets the one extra light.
const diverLight = new THREE.PointLight(0xbfd9ff, 0, 20, 1.4); scene.add(diverLight);

// ---------- shared materials / helpers ----------
const lam = (o) => new THREE.MeshLambertMaterial(o);
const woodMat = (tint) => lam({ map: FX.woodTexture(), color: tint });
const darkWood = lam({ color: 0x4a3826 });
const blackMat = lam({ color: 0x101014 });
const goldMat = lam({ color: 0xd9a845, emissive: 0x694d10 });
const _v = new THREE.Vector3();
function waveSail(mesh, t) {
  FX.clothWave(mesh, t);
  const pos = mesh.geometry.attributes.position, belly = mesh.userData.belly;
  for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 2] += belly[i];
  pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
}
function makeSail(w, h, mat, bellyAmp = 0.34) {
  const geo = new THREE.PlaneGeometry(w, h, 10, 8);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 2;
  FX.clothInit(mesh, { amp: 0.13, freq: 2.2, speed: 5 });
  const base = mesh.userData.base, belly = new Float32Array(geo.attributes.position.count);
  for (let i = 0; i < belly.length; i++) {
    const bx = base[i * 3], by = base[i * 3 + 1];
    belly[i] = bellyAmp * Math.sin(Math.PI * (bx / w + 0.5)) * Math.sin(Math.PI * (by / h + 0.5));
  }
  mesh.userData.belly = belly;
  return mesh;
}

// ---------- the ship builder (sea-king pattern) ----------
const MASTS = [
  { x: 3.0, h: 5.6, sails: [[5.2, 3.2, 2.1], [3.3, 2.8, 1.8]] },
  { x: 0.2, h: 7.4, sails: [[7.0, 3.8, 2.4], [4.9, 3.3, 2.1], [3.0, 2.8, 1.7]] },
  { x: -2.6, h: 4.9, sails: [[4.5, 2.6, 1.9]] },
];
function buildShip(o) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const hullMat = woodMat(o.hullColor);
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  add(new THREE.BoxGeometry(8.8, 1.9, 3.3), hullMat, 0, 1.15, 0);
  add(new THREE.CylinderGeometry(1.65, 1.65, 1.9, 14, 1, false, 0, Math.PI), hullMat, 4.4, 1.15, 0);
  add(new THREE.BoxGeometry(1.8, 2.7, 3.5), hullMat, -4.5, 1.55, 0);
  add(new THREE.BoxGeometry(9.05, 0.42, 3.38), lam({ color: o.stripe || 0xd8c49a }), 0, 1.62, 0);
  add(new THREE.BoxGeometry(8.9, 0.16, 3.15), woodMat(0xc9a878), 0, 2.18, 0);
  add(new THREE.BoxGeometry(2.0, 0.16, 3.6), woodMat(0xc9a878), -4.5, 2.98, 0);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(8.9, 0.22, 0.08), darkWood, 0, 2.52, s * 1.55);
    for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.55, 0.5, 0.08), blackMat, -3 + k * 1.5, 1.5, s * 1.68);
  }
  const ship = { g, sails: [], masts: {}, scale: o.scale || 1 };
  for (const ms of MASTS) {
    const mg = new THREE.Group(); mg.position.set(ms.x, 2.24, 0); g.add(mg);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, ms.h, 8), darkWood); pole.position.y = ms.h / 2; mg.add(pole);
    for (const [yy, sw, sh] of ms.sails) {
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, sw + 0.5, 6), darkWood);
      yard.rotation.x = Math.PI / 2; yard.position.y = yy; mg.add(yard);
      const sail = makeSail(sw, sh, o.sailMat); sail.position.set(0, yy - sh / 2 - 0.05, 0); mg.add(sail);
      ship.sails.push(sail);
    }
    ship.masts[ms.x === 0.2 ? 'main' : ms.x > 0 ? 'fore' : 'mizzen'] = mg;
  }
  const flagGeo = new THREE.PlaneGeometry(1.6, 0.95, 8, 4); flagGeo.translate(-0.8, 0, 0);
  const flag = new THREE.Mesh(flagGeo, lam({ color: o.flagColor, side: THREE.DoubleSide }));
  flag.position.set(0, 7.15, 0); FX.clothInit(flag, { amp: 0.3, freq: 3, speed: 8 });
  ship.masts.main.add(flag); ship.flag = flag;
  if (o.cargo !== false) {
    const cr = FX.crate(1.1); cr.position.set(1.8, 2.81, -0.9); g.add(cr);
    for (const [bx, bz] of [[-1.6, 1.0], [-0.55, 1.05]]) { const b = FX.barrel(); b.scale.setScalar(0.72); b.position.set(bx, 2.78, bz); g.add(b); }
  }
  if (o.lanterns) {
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), darkWood, -4.5, 3.3, 0);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), FX.glassMat(0xffc46b, 0.6)); lamp.position.set(-4.5, 3.62, 0); g.add(lamp);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); core.position.copy(lamp.position); g.add(core);
    const gl = FX.glint(1.25); gl.position.copy(lamp.position); g.add(gl); ship.lanternGlint = gl;
  }
  g.scale.setScalar(ship.scale);
  scene.add(g);
  return ship;
}

const pirateShip = buildShip({ hullColor: 0x6d4a30, sailMat: lam({ color: 0x33333c, side: THREE.DoubleSide }), flagColor: 0x17171c, stripe: 0x8a2f2a, scale: 1.15, lanterns: false, cargo: false });
// stern lantern on the sterncastle's rear corner (small glint — the captain
// stands amidships of the castle, so the kit lantern spot would sit on him)
{
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), darkWood); post.position.set(-5.35, 3.3, 1.5); pirateShip.g.add(post);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), FX.glassMat(0xffc46b, 0.6)); lamp.position.set(-5.35, 3.62, 1.5); pirateShip.g.add(lamp);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); core.position.copy(lamp.position); pirateShip.g.add(core);
  const gl = FX.glint(0.55); gl.position.copy(lamp.position); pirateShip.g.add(gl); pirateShip.lanternGlint = gl;
}
const navyShips = [
  buildShip({ hullColor: 0x3d4a66, sailMat: lam({ color: 0xf3e9d2, side: THREE.DoubleSide }), flagColor: 0xb03a2e, stripe: 0xe8e2d2, scale: 1.05, lanterns: false }),
  buildShip({ hullColor: 0x3d4a66, sailMat: lam({ color: 0xf3e9d2, side: THREE.DoubleSide }), flagColor: 0xb03a2e, stripe: 0xe8e2d2, scale: 1.05, lanterns: false }),
];
// the ship's wheel on the pirate sterncastle, just before the captain
{
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.055, 8, 20), darkWood); wheel.add(rim);
  for (let k = 0; k < 8; k++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6), darkWood);
    sp.rotation.z = k * Math.PI / 4; wheel.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), goldMat); wheel.add(hub);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.62, 8), darkWood); post.position.y = -0.55; wheel.add(post);
  wheel.rotation.y = Math.PI / 2; wheel.position.set(-3.35, 3.62, 0);
  pirateShip.g.add(wheel);
}

// ---------- the gold chests ----------
// one shared geometry + a painted texture (dark wood, gold band + lock): the
// deck stack is an InstancedMesh (1 draw call for all 100), order top-first so
// a falling count eats the top layer first — exactly like men unloading her.
const chestTexC = document.createElement('canvas'); chestTexC.width = chestTexC.height = 128;
{
  const g = chestTexC.getContext('2d');
  g.fillStyle = '#5d4026'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#6d4c2c'; for (let r = 0; r < 4; r++) g.fillRect(0, r * 32 + 2, 128, 26);
  g.fillStyle = '#2e2013'; g.fillRect(0, 40, 128, 10); g.fillRect(0, 108, 128, 8);
  g.fillStyle = '#d9a845'; g.fillRect(56, 0, 16, 128); g.fillRect(0, 84, 128, 9);
  g.fillStyle = '#f4d67c'; g.fillRect(57, 0, 3, 128);
  g.fillStyle = '#8a6a1e'; g.fillRect(50, 78, 28, 22); g.fillStyle = '#f4d67c'; g.fillRect(59, 84, 10, 10);
}
const chestTex = new THREE.CanvasTexture(chestTexC); chestTex.colorSpace = THREE.SRGBColorSpace;
const chestGeo = new THREE.BoxGeometry(0.62, 0.44, 0.46);
const chestMat = lam({ map: chestTex });
const stackMesh = new THREE.InstancedMesh(chestGeo, chestMat, 100);
{
  const m4 = new THREE.Matrix4();
  let ix = 0;
  for (const layer of [1, 0]) for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) {
    m4.makeTranslation(-3.05 + c * 0.66, 2.47 + layer * 0.46, -1.0 + r * 0.5);
    stackMesh.setMatrixAt(ix++, m4);
  }
  stackMesh.instanceMatrix.needsUpdate = true;
}
pirateShip.g.add(stackMesh);
// toss pool: loose chests that arc over the rail
const tossPool = [];
for (let k = 0; k < 20; k++) { const m = new THREE.Mesh(chestGeo, chestMat); m.visible = false; scene.add(m); tossPool.push(m); }
// the captain's kept chest: one hero chest + glint, by the wheel
const keptChest = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.55, 0.58), chestMat); keptChest.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.14, 0.62), woodMat(0x7a5636)); lid.position.y = 0.33; keptChest.add(lid);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.57, 0.6), goldMat); band.scale.set(0.22, 1, 1.02); keptChest.add(band);
}
keptChest.visible = false; scene.add(keptChest);
const keptGlint = FX.glint(0.9); keptGlint.visible = false; scene.add(keptGlint);

// ---------- the harbour (dawn backdrop for the hook) ----------
{
  const harbour = new THREE.Group();
  const stone = lam({ color: 0x7d7468 });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(78, 2.4, 11), stone); quay.position.set(-108, -0.4, 19); harbour.add(quay);
  const roofM = lam({ color: 0x74463a });
  for (const [x, w, h, d] of [[-134, 10, 4.2, 7], [-120, 8, 3.4, 6], [-104, 9, 3.9, 7], [-90, 7, 3.1, 6]]) {
    const wh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam({ color: 0x84735f })); wh.position.set(x, 0.8 + h / 2, 23.5); harbour.add(wh);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 1.8, 4), roofM); roof.position.set(x, 0.8 + h + 0.9, 23.5); roof.rotation.y = Math.PI / 4; harbour.add(roof);
  }
  for (let k = 0; k < 7; k++) { const cr = FX.crate(1.2); cr.position.set(-136 + k * 8.5, 1.4, 16.5); harbour.add(cr); }
  for (let k = 0; k < 5; k++) { const b = FX.barrel(); b.position.set(-128 + k * 11, 1.55, 22.5); harbour.add(b); }
  // lighthouse: banded tower + glass lamp + glint
  const lh = new THREE.Group(); lh.position.set(-130, 0, 27);
  const bandW = lam({ color: 0xe8e2d2 }), bandR = lam({ color: 0xb03a2e });
  for (let k = 0; k < 4; k++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.5 - k * 0.16, 1.66 - k * 0.16, 3.1, 12), k % 2 ? bandR : bandW); seg.position.y = 1.55 + k * 3.1; lh.add(seg); }
  const lampGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.3, 10), FX.glassMat(0xffd9a0, 0.55)); lampGlass.position.y = 13.6; lh.add(lampGlass);
  const lampCore = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2ae })); lampCore.position.y = 13.6; lh.add(lampCore);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.1, 10), blackMat); cap.position.y = 14.8; lh.add(cap);
  const lgl = FX.glint(2.2); lgl.position.y = 13.6; lh.add(lgl); harbour.userData.lampGlint = lgl;
  harbour.add(lh);
  scene.add(harbour);
  scene.userData.harbour = harbour;
}

// ---------- the deep set-piece: seabed, buried gold, diver ----------
const SEABED_Y = -13;
{
  const sandGeo = new THREE.CircleGeometry(150, 40);
  const sp = sandGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i); sp.setZ(i, Math.sin(x * 0.11) * Math.cos(y * 0.13) * 0.7 + Math.sin(x * 0.31 + y * 0.21) * 0.25); }
  sandGeo.computeVertexNormals();
  const sand = new THREE.Mesh(sandGeo, lam({ color: 0x5f7263 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(40, SEABED_Y, 0); scene.add(sand);
  // sunken chests (instanced, half-buried, along the whole chase route)
  const sunk = new THREE.InstancedMesh(chestGeo, chestMat, 30);
  const m4 = new THREE.Matrix4(), e = new THREE.Euler(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(1.15, 1.15, 1.15), pv = new THREE.Vector3();
  for (let k = 0; k < 30; k++) {
    const hx = Math.sin(k * 39.7) * 0.5 + Math.sin(k * 12.3) * 0.5;
    pv.set(-25 + k * 5.1 + hx * 6, SEABED_Y + 0.16 + (k % 3) * 0.05, (Math.sin(k * 24.1) * 11) + (k % 5 - 2) * 1.6);
    e.set((k % 4 === 0) ? 1.35 : (Math.sin(k * 7) * 0.22), k * 1.37, (k % 5 === 0) ? 1.45 : Math.sin(k * 5) * 0.18);
    qt.setFromEuler(e);
    m4.compose(pv, qt, sc); sunk.setMatrixAt(k, m4);
  }
  sunk.instanceMatrix.needsUpdate = true; scene.add(sunk);
  // coins spilled around the field
  const coins = new THREE.InstancedMesh(new THREE.CircleGeometry(0.1, 8), new THREE.MeshBasicMaterial({ color: 0xe8c25c }), 90);
  for (let k = 0; k < 90; k++) {
    pv.set(96 + Math.sin(k * 17.3) * 16 + (k % 7), SEABED_Y + 0.32 + (k % 3) * 0.012, Math.sin(k * 29.7) * 8);
    e.set(-Math.PI / 2, 0, k); qt.setFromEuler(e);
    m4.compose(pv, qt, new THREE.Vector3(1, 1, 1)); coins.setMatrixAt(k, m4);
  }
  coins.instanceMatrix.needsUpdate = true; scene.add(coins);
  // rocks + seaweed cones
  const rockM = lam({ color: 0x5d6066 });
  for (let k = 0; k < 7; k++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + (k % 3) * 0.4), rockM); r.position.set(88 + k * 7.3, SEABED_Y + 0.02, -9 + (k % 4) * 5.5); r.rotation.set(k, k * 2, k * 0.5); r.scale.y = 0.68; scene.add(r); }
  const weedM = lam({ color: 0x1e4d31, side: THREE.DoubleSide });
  const weeds = [];
  for (let k = 0; k < 9; k++) { const wd = new THREE.Mesh(new THREE.ConeGeometry(0.40, 1.8 + (k % 3) * 0.4, 6), weedM); wd.position.set(92 + k * 4.1, SEABED_Y + 0.85, -7 + (k % 5) * 3.6); scene.add(wd); weeds.push(wd); }
  scene.userData.weeds = weeds;
}
// hero chests by the lamp + their glints
const heroChests = [];
for (const [x, z, ry] of [[114, -2, 0.4], [116.6, 0.6, -0.3], [112.8, 2.6, 1.2]]) {
  const hc = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.64), chestMat); hc.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.89, 0.15, 0.68), woodMat(0x7a5636)); lid.position.y = 0.36; hc.add(lid);
  hc.position.set(x, SEABED_Y + 0.42, z); hc.rotation.y = ry; hc.rotation.z = 0.08;
  scene.add(hc);
  const gl = FX.glint(1.1); gl.position.set(x, SEABED_Y + 0.95, z); scene.add(gl);
  heroChests.push({ g: hc, gl });
}
// god rays: additive gradient planes slanting down from the surface
const rayTexC = document.createElement('canvas'); rayTexC.width = 64; rayTexC.height = 256;
{
  const g = rayTexC.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(190,225,255,0.55)'); gr.addColorStop(1, 'rgba(190,225,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const gr2 = g.createLinearGradient(0, 0, 64, 0);
  gr2.addColorStop(0, 'rgba(0,0,0,1)'); gr2.addColorStop(0.3, 'rgba(0,0,0,0)'); gr2.addColorStop(0.7, 'rgba(0,0,0,0)'); gr2.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = gr2; g.fillRect(0, 0, 64, 256);
}
const rayTex = new THREE.CanvasTexture(rayTexC);
const rays = [];
for (let k = 0; k < 4; k++) {
  const rp = new THREE.Mesh(new THREE.PlaneGeometry(3.0 + k * 1.0, 17), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  rp.position.set(98 + k * 7.5, -6.2, -5 + (k % 3) * 4.5); rp.rotation.z = 0.32; rp.rotation.y = (k % 2 ? 0.75 : 0.45);
  scene.add(rp); rays.push(rp);
}
// bubbles: one Points cloud that lives only in the deep
class Bubbles {
  constructor(scene, max = 130) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.spd = new Float32Array(max);
    for (let k = 0; k < max; k++) this.reset(k, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.32, map: FX.puffTexture(), color: 0xd8f2ff, transparent: true, opacity: 0, depthWrite: false }));
    this.points.frustumCulled = false; scene.add(this.points);
  }
  reset(k, rand = false) {
    this.pos[k * 3] = 92 + Math.random() * 32; this.pos[k * 3 + 1] = rand ? -13 + Math.random() * 12.5 : -13 + Math.random() * 1.5; this.pos[k * 3 + 2] = -9 + Math.random() * 16;
    this.spd[k] = 0.5 + Math.random() * 0.7;
  }
  update(t, dt, on) {
    this.points.material.opacity = on ? 0.75 : 0;
    if (!on) return;
    for (let k = 0; k < this.max; k++) {
      this.pos[k * 3 + 1] += this.spd[k] * dt;
      this.pos[k * 3] += Math.sin(t * 2.1 + k * 1.7) * dt * 0.35;
      if (this.pos[k * 3 + 1] > -0.4) this.reset(k);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
const bubbles = new Bubbles(scene);
// the diver: dark silhouette, tank, fins, and a lamp that throws a real cone
const diver = new THREE.Group();
let diverLampPos = new THREE.Vector3();
{
  const suit = lam({ color: 0x18242e });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.95, 4, 10), suit); body.rotation.z = Math.PI / 2 - 0.18; diver.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), suit); head.position.set(0.78, 0.10, 0); diver.add(head);
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 8), FX.glassMat(0x9fd8e8, 0.5)); mask.position.set(0.92, 0.10, 0); diver.add(mask);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.85, 10), lam({ color: 0xb9c2c9 })); tank.rotation.z = Math.PI / 2 - 0.18; tank.position.set(-0.05, 0.34, 0); diver.add(tank);
  diver.userData.fins = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.8, 8), suit); leg.position.set(-0.85, -0.06 + s * 0.16, s * 0.14); leg.rotation.z = Math.PI / 2 - 0.3; diver.add(leg);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.2), lam({ color: 0xd8b83a })); fin.position.set(-1.35, -0.06 + s * 0.16, s * 0.14); diver.add(fin); diver.userData.fins.push(fin);
  }
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.7, 8), suit); arm.position.set(0.55, -0.18, 0.25); arm.rotation.z = -0.9; diver.add(arm);
  const lampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 8), blackMat); lampBody.position.set(0.88, -0.34, 0.28); lampBody.rotation.z = -0.9; diver.add(lampBody);
  const lampFace = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf4fbff })); lampFace.position.set(0.97, -0.40, 0.28); diver.add(lampFace);
  diver.userData.lampLocal = new THREE.Vector3(0.97, -0.40, 0.28);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.7, 7.5, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  cone.position.set(0.97 + 3.4, -0.40 - 1.15, 0.28); cone.rotation.z = Math.PI / 2 + 0.33;
  diver.add(cone); diver.userData.cone = cone;
  diver.position.set(110.6, -9.9, -0.6); diver.rotation.y = 0.55;
  scene.add(diver);
}

// ---------- CHARACTER CARDS (bear-line kit port, sea-king v3 pattern) ----------
const CARD_CW = 1200, CARD_CH = 2000, CARD_M = 2.25;
const cardGeo = new THREE.PlaneGeometry(CARD_M * 0.6, CARD_M); cardGeo.translate(0, CARD_M / 2 - CARD_M * 0.025, 0);
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(14,9,20,0.5)'); gr.addColorStop(1, 'rgba(14,9,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
class Card {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = CARD_CW; this.c.height = CARD_CH;
    this.g = this.c.getContext('2d');
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mesh = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true }));
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = '';
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CARD_CW, CARD_CH);
    g.setTransform(CARD_CW / 600, 0, 0, CARD_CH / 1000, 0, 0);
    fn(new T.Pen(g)); this.t.needsUpdate = true;
  }
  place(x, y, z, camPos, s = 1) {
    this.mesh.visible = this.blob.visible = true;
    this.mesh.position.set(x, y, z); this.mesh.scale.setScalar(s);
    this.mesh.rotation.set(0, Math.atan2(camPos[0] - x, camPos[2] - z), 0);
    this.blob.position.set(x, y + 0.03, z); this.blob.scale.setScalar(s);
  }
}
const capCard = new Card();
const crewCards = [new Card(), new Card()];
const chipPool = [];
for (let k = 0; k < 22; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.05), lam({ color: 0x6d5136 })); m.visible = false; scene.add(m); chipPool.push({ m, life: -1, v: [0, 0, 0], rv: [0, 0, 0] }); }
const spawnChips = (p, n = 5) => {
  let done = 0;
  for (const c of chipPool) {
    if (c.life >= 0) continue;
    c.life = 0; c.m.visible = true; c.m.position.set(p[0], p[1], p[2]);
    c.v = [(Math.random() - 0.5) * 4, 2.5 + Math.random() * 3.5, (Math.random() - 0.5) * 4];
    c.rv = [Math.random() * 9, Math.random() * 9, Math.random() * 9];
    if (++done >= n) break;
  }
};
const ballPool = [];
for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), blackMat); m.visible = false; scene.add(m); ballPool.push(m); }

// ---------- title / message board ----------
const boardCanvas = document.createElement('canvas'); boardCanvas.width = 1024; boardCanvas.height = 320;
const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace;
const board = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.44), new THREE.MeshBasicMaterial({ map: boardTex, transparent: true, depthTest: false, fog: false }));
board.renderOrder = 10; board.visible = false; scene.add(board);
let boardKey = '';
function drawBoard(text) {
  if (text === boardKey) return; boardKey = text;
  const g = boardCanvas.getContext('2d');
  g.fillStyle = '#1d2733'; g.fillRect(0, 0, 1024, 320);
  g.strokeStyle = '#ffd76a'; g.lineWidth = 10; g.strokeRect(14, 14, 996, 292);
  g.fillStyle = '#ffd76a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 120; g.font = `bold ${fs}px Arial`;
  while (g.measureText(text).width > 930 && fs > 28) { fs -= 7; g.font = `bold ${fs}px Arial`; }
  g.fillText(text, 512, 166); boardTex.needsUpdate = true;
}

// ---------- per-frame ----------
let lastF = -1;
const wakeAcc = new Map();
function dropWake(pose, key, dt, scale) {
  const a = (wakeAcc.get(key) || 0) + dt; wakeAcc.set(key, a);
  if (a < 0.5) return; wakeAcc.set(key, 0);
  const fx = Math.cos(pose.ry), fz = -Math.sin(pose.ry);
  wake.drop(pose.p[0] - fx * 5.4 * scale, pose.p[2] - fz * 5.4 * scale, 1.6 * scale);
}
const splashFired = new Set();

window.renderFrame = (f) => {
  const t = f / 30;
  const dt = lastF < 0 ? 1 / 30 : Math.min(0.1, Math.max(0, (f - lastF) / 30));
  const sec = secAt(f), env = envAt(f);
  const deepU = sec.id === 'deep' ? Math.min(1, Math.max(0, (sec.u - 0.06) / 0.34)) : 0;

  // --- environment ---
  skyU.top.value.setRGB(...env.top); skyU.hor.value.setRGB(...env.hor); skyU.sunCol.value.setRGB(...env.sun);
  scene.fog.color.setRGB(...env.fog); scene.fog.near = env.fn; scene.fog.far = env.ff;
  hemi.color.setRGB(...env.hSky); hemi.groundColor.setRGB(...env.hGnd); hemi.intensity = env.hemi;
  sun.color.setRGB(...env.sun); sun.intensity = env.sunI;
  const cam = camAt(f);
  camera.position.set(...cam.pos); camera.up.set(0, 1, 0); camera.lookAt(...cam.look); camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const sunDir = _v.set(Math.cos(rx(env.el)) * Math.cos(rx(env.az)), Math.sin(rx(env.el)), Math.cos(rx(env.el)) * Math.sin(rx(env.az))).normalize().clone();
  skyU.sunDir.value.copy(sunDir);
  sun.position.set(cam.look[0] + sunDir.x * 140, sunDir.y * 140 + 10, cam.look[2] + sunDir.z * 140);
  sun.target.position.set(...cam.look);
  sky.position.copy(camera.position);
  water.material.uniforms.uDeep.value.setRGB(...env.deep);
  water.material.uniforms.uShallow.value.setRGB(...env.shal);
  water.material.uniforms.uSky.value.setRGB(...env.wsky);
  water.material.uniforms.uSun.value.copy(sunDir);
  basePlane.material.color.setRGB(env.deep[0] * 0.45, env.deep[1] * 0.45, env.deep[2] * 0.45);
  clouds.group.traverse((o) => { if (o.isSprite) { o.material.color.setRGB(...env.cloud); o.material.opacity = o.userData.op0 * (env.cop / 0.8) * (1 - deepU); } });
  mist.traverse((o) => { if (o.isSprite) o.material.opacity = env.mist * o.userData.f * (1 - deepU); });
  const nm = mistBankAt(f);
  navyMist.traverse((o) => { if (o.isSprite) o.material.opacity = nm * o.userData.f; });
  if (scene.userData.harbour) scene.userData.harbour.userData.lampGlint.material.opacity = 0.6 + 0.4 * Math.sin(t * 2.2);

  // --- ships ---
  const pp = piratePoseAt(f);
  const place = (ship, pose) => {
    ship.g.visible = !pose.hidden;
    if (pose.hidden) return;
    ship.g.position.set(...pose.p); ship.g.rotation.set(pose.roll, pose.ry, -pose.pitch);
  };
  place(pirateShip, pp);
  const nPoses = [navyPoseAt(0, f), navyPoseAt(1, f)];
  for (let i = 0; i < 2; i++) place(navyShips[i], nPoses[i]);
  for (const ship of [pirateShip, ...navyShips]) {
    if (!ship.g.visible) continue;
    for (const s of ship.sails) waveSail(s, t + ship.g.position.x * 0.05);
    FX.clothWave(ship.flag, t);
  }
  if (pirateShip.lanternGlint) pirateShip.lanternGlint.material.opacity = 0.75 * (0.7 + 0.3 * Math.sin(t * 2.7));

  // --- the chest stack: draw exactly chestCountAt(f) chests ---
  stackMesh.count = chestCountAt(f);

  // --- character cards ---
  const cardTint = Math.min(1, 0.6 + 0.145 * env.sunI) * (1 - deepU * 0.85);
  const tintCard = (card) => card.mesh.material.color.setRGB(Math.max(0.12, cardTint), Math.max(0.12, cardTint * 0.985), Math.max(0.13, cardTint * 0.96));
  const capExpr = { hook: 'grin', load: 'grin', chase: 'stern', heavy: 'stern', order: 'stern', toss: 'stern', laugh: 'laugh', kept: 'neutral', escape: 'grin', bank: 'laugh', deep: 'grin' }[sec.id] || 'neutral';
  const pU = pointUAt(f);
  const capR = sec.id === 'order' ? (pU > 0.4 ? 'point' : 'hang') : (sec.id === 'laugh' || sec.id === 'bank') ? 'hip' : sec.id === 'hook' ? 'hip' : 'hang';
  const capIdl = idle(f, 11), capBlink = blinkAt(f, 11);
  const capKey = `C|${capExpr}|${capR}|${capBlink}|${q(capIdl.bob, 2)}|${Math.round(capIdl.tilt)}`;
  capCard.draw(capKey, (p) => T.romanFront(p, 'pirate', {
    seed: 11, expr: capExpr, R: capR, L: sec.id === 'order' ? 'hip' : 'hang',
    blink: capBlink, bob: q(capIdl.bob, 2), tilt: Math.round(capIdl.tilt), headTilt: Math.round(idle(f, 13).headTilt), wv: f * 0.18,
  }));
  const cSoles = capSolesAt(f);
  capCard.place(cSoles[0], cSoles[1], cSoles[2], cam.pos);
  tintCard(capCard);
  // crew: main-deck hands; in laugh/kept/bank they flank the captain on the sterncastle
  const flank = sec.id === 'laugh' || sec.id === 'kept' || sec.id === 'bank';
  const crewExpr = sec.id === 'toss' ? 'shock' : (sec.id === 'laugh') ? 'shock' : (sec.id === 'chase' || sec.id === 'heavy') ? 'nervous' : 'neutral';
  const deckWorld = (lx, ly, lz) => {
    const sx = lx * 1.15, sz = lz * 1.15;
    return [pp.p[0] + sx * Math.cos(pp.ry) + sz * Math.sin(pp.ry), pp.p[1] + ly * 1.15, pp.p[2] - sx * Math.sin(pp.ry) + sz * Math.cos(pp.ry)];
  };
  const crewSpots = flank ? [[-4.6, 3.06, -1.38], [-4.6, 3.06, 1.38]] : [[3.6, 2.26, -1.15], [-3.9, 2.26, 1.05]];
  for (let i = 0; i < 2; i++) {
    const sd = 21 + i, sIdl = idle(f, sd), sBlink = blinkAt(f, sd);
    const sp = deckWorld(...crewSpots[i]);
    const sKey = `W${i}|${crewExpr}|${sBlink}|${q(sIdl.bob, 2)}|${Math.round(sIdl.tilt)}`;
    crewCards[i].draw(sKey, (p) => T.romanFront(p, i === 0 ? 'pirateCrewA' : 'pirateCrewB', {
      seed: sd, expr: crewExpr, R: 'hang', L: 'hang',
      blink: sBlink, bob: q(sIdl.bob, 2), tilt: Math.round(sIdl.tilt), wv: f * 0.18,
    }));
    crewCards[i].place(sp[0], sp[1], sp[2], cam.pos, 0.94);
    tintCard(crewCards[i]);
  }
  // the kept chest + its glint (the one he would not throw)
  const kept = keptOutAt(f);
  keptChest.visible = keptGlint.visible = kept;
  if (kept) {
    const cc = capChestAt(f);
    keptChest.position.set(cc[0], cc[1], cc[2]); keptChest.rotation.y = pp.ry;
    keptGlint.position.set(cc[0], cc[1] + 0.30, cc[2]);
    const pulse = sec.id === 'kept' ? 0.42 + 0.18 * Math.sin(t * 5) : 0.28 + 0.1 * Math.sin(t * 3);
    keptGlint.material.opacity = pulse; keptGlint.scale.setScalar(0.5 + 0.1 * Math.sin(t * 5));
  }

  // --- tosses: arcs + splashes on landing ---
  tossPool.forEach((m) => { m.visible = false; });
  let poolIx = 0;
  for (const ev of tossEvents) {
    if (ev.kept) continue;
    const arc = tossArcAt(ev, f);
    if (arc && poolIx < tossPool.length) {
      const m = tossPool[poolIx++];
      m.visible = true; m.position.set(...arc.p); m.rotation.set(...arc.rot);
    }
    if (arc && f === arc.splashF && lastF < f && !splashFired.has(ev.ix)) {
      splashFired.add(ev.ix);
      splashes.burst(arc.sx, 0, arc.sz, ev.n >= 5 ? { n: 60, power: 10.5 } : { n: 40, power: 8 });
    }
  }
  if (sec.id === 'hook') splashFired.clear();

  // --- navy volleys: muzzle + smoke at the frame, balls, impacts ---
  for (const v of volleyAt(f)) {
    if (lastF >= v.f) continue;
    const ship = navyShips[v.ship];
    ship.g.updateMatrixWorld();
    _v.set(0.5, 1.62, v.ship === 0 ? -1.85 : 1.85); ship.g.localToWorld(_v);
    muzzles[muzzleIx++ % muzzles.length].pop(_v.x, _v.y, _v.z, t, 3.2);
    smoke.burst(_v.x, _v.y, _v.z, { n: 9, color: 0xb9b4ac, scale: 2.4, opacity: 0.5, vy: 0.5, vx: 1.4, life: 2.4 });
  }
  for (const b of ballsAt(f)) {
    if (b.impact && lastF < f) {
      if (b.target.kind === 'water') splashes.burst(b.target.p[0], 0, b.target.p[2], { n: 30, power: 6.5 });
      else { smoke.burst(b.target.p[0], b.target.p[1], b.target.p[2], { n: 6, color: 0x555049, scale: 1.2, opacity: 0.55, vy: 0.8 }); spawnChips(b.target.p, 6); }
    }
  }
  const balls = ballsAt(f);
  ballPool.forEach((m, i) => { const b = balls[i]; m.visible = !!b; if (b) m.position.set(...b.p); });
  for (const c of chipPool) {
    if (c.life < 0) continue;
    c.life += dt; if (c.life > 0.75) { c.life = -1; c.m.visible = false; continue; }
    c.v[1] -= 12.5 * dt;
    c.m.position.x += c.v[0] * dt; c.m.position.y += c.v[1] * dt; c.m.position.z += c.v[2] * dt;
    c.m.rotation.x += c.rv[0] * dt; c.m.rotation.y += c.rv[1] * dt; c.m.rotation.z += c.rv[2] * dt;
    if (c.m.position.y < 0) { c.life = -1; c.m.visible = false; }
  }

  // --- wakes ---
  if (dt > 0 && sec.id !== 'deep') {
    dropWake(pp, 'P', dt, 1.15);
    if (sec.id !== 'hook' && sec.id !== 'load') for (let i = 0; i < 2; i++) if (!nPoses[i].hidden) dropWake(nPoses[i], 'N' + i, dt, 1.05);
  }

  // --- the deep: rays, bubbles, diver, glints ---
  for (let k = 0; k < rays.length; k++) rays[k].material.opacity = deepU * (0.055 + 0.015 * Math.sin(t * 0.9 + k * 1.7));
  bubbles.update(t, dt, deepU > 0.02);
  if (scene.userData.weeds) for (let k = 0; k < scene.userData.weeds.length; k++) scene.userData.weeds[k].rotation.z = Math.sin(t * 0.8 + k * 1.3) * 0.10;
  diver.position.y = -9.9 + Math.sin(t * 0.7) * 0.22;
  diver.userData.fins[0].rotation.y = Math.sin(t * 5.2) * 0.4;
  diver.userData.fins[1].rotation.y = Math.sin(t * 5.2 + Math.PI) * 0.4;
  diver.userData.cone.material.opacity = deepU * 0.085;
  diver.updateMatrixWorld();
  diverLampPos.copy(diver.userData.lampLocal); diver.localToWorld(diverLampPos);
  diverLight.position.copy(diverLampPos);
  diverLight.intensity = deepU * 60;
  const glintBoost = sec.id === 'deep' ? Math.min(1, sec.u * 1.4) : 0;
  heroChests.forEach((hc, k) => {
    hc.gl.material.opacity = deepU * (0.35 + 0.3 * Math.sin(t * 2.4 + k * 2.1)) + glintBoost * 0.3 * Math.max(0, Math.sin(t * 3.1 + k * 1.9));
    hc.gl.scale.setScalar(1 + 0.3 * Math.sin(t * 2.4 + k * 2.1));
  });

  // --- board ---
  const bd = boardAt(f);
  board.visible = !!bd && bd.alpha > 0.01;
  if (board.visible) {
    drawBoard(bd.text);
    board.material.opacity = bd.alpha;
    _v.set(...cam.look).sub(camera.position).normalize();
    board.position.copy(camera.position).addScaledVector(_v, 17); board.position.y += 3.6;
    board.lookAt(camera.position);
    const bw = 2 * 17 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * (1080 / 1920) * 0.92;
    board.scale.set(bw / 11, bw / 11, 1);
  }

  // --- FX updates: EVERY frame, EVERY effect (animation gate) ---
  water.userData.update(t);
  smoke.update(t, dt);
  splashes.update(t, dt);
  wake.update(t, dt);
  clouds.update(t, dt);
  for (const m of muzzles) m.update(t);

  renderer.render(scene, camera);
  lastF = f;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
