// "1000 Tanks vs 1000 Tanks" — renderer (three.js, plain WebGLRenderer like the
// proven sea-king engine: no composer/DOF — the GitHub SwiftShader runner
// renders this reliably). Vertical 1080x1920 canvas #c; window.renderFrame(f)
// + window.ready for the Playwright chunk renderer. All frame logic in story.js.
// Fleets: exactly 1000 + 1000 tanks as InstancedMesh parts (5 draws per side).
import * as THREE from './lib/three.module.js';
import * as STORY from './story.js';
import * as PAINT from './paint.js';
import * as FX from './fx.js';

const W = 1080, H = 1920, FPS = STORY.FPS;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
let groundMat = null, duneM = null, plainMat = null; // assigned in the terrain block; tinted per-frame for NV
scene.background = new THREE.Color(0xe3d3ac);
scene.fog = new THREE.Fog(0xe3d3ac, 90, 720);
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1600);
const hemi = new THREE.HemisphereLight(0xffe9c4, 0x8a6f4a, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.9); scene.add(sun); scene.add(sun.target);

// ---------------------------------------------------------------- world: desert
const rng = PAINT.rng; rng(99);
{
  const dg = new THREE.PlaneGeometry(1500, 1500, 96, 96);
  const pos = dg.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = Math.hypot(v.x, v.y);
    let h = 0;
    if (d > 380) h = (d - 380) * 0.06 + Math.sin(v.x * 0.02) * 4 * Math.min(1, (d - 380) / 200);
    h += Math.sin(v.x * 0.011 + 2) * Math.cos(v.y * 0.013) * 0.5 * Math.min(1, Math.max(0, (d - 120) / 200));
    pos.setZ(i, h);
  }
  dg.computeVertexNormals();
  groundMat = new THREE.MeshStandardMaterial({ map: PAINT.tex(PAINT.dirt(7), 24, 24), color: 0xc2a06b, roughness: 1 });
  const ground = new THREE.Mesh(dg, groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  // battlefield plain (flat trampled centre so the grids read clean)
  plainMat = new THREE.MeshStandardMaterial({ color: 0xbb9c66, roughness: 1 });
  const plain = new THREE.Mesh(new THREE.PlaneGeometry(760, 340), plainMat);
  plain.rotation.x = -Math.PI / 2; plain.position.y = 0.0; scene.add(plain);
  // service road to the depot
  const road = new THREE.Mesh(new THREE.PlaneGeometry(640, 26), new THREE.MeshStandardMaterial({ color: 0x8f7c58, roughness: 1 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, -193); scene.add(road);
  // dunes + rocks at the edges
  duneM = new THREE.MeshStandardMaterial({ color: 0xc7a56e, roughness: 1 });
  const rockM = new THREE.MeshStandardMaterial({ color: 0x7d6a4e, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, d = 430 + rng() * 260;
    const dune = new THREE.Mesh(new THREE.SphereGeometry(30 + rng() * 55, 10, 7), duneM);
    dune.scale.y = 0.22 + rng() * 0.12; dune.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); scene.add(dune);
  }
  for (let i = 0; i < 60; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rng() * 1.6), rockM);
    const side = rng() > 0.5 ? 1 : -1;
    rock.position.set((rng() - 0.5) * 700, 0.3, side * (185 + rng() * 160) * (rng() > 0.4 ? 1 : -1));
    if (Math.abs(rock.position.z) < 175 && Math.abs(rock.position.x) < 350) rock.position.z = 190 * Math.sign(rock.position.z || 1);
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3); scene.add(rock);
  }
  // command rise for the finale
  const rise = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 0.8, 18), duneM);
  rise.position.set(3.5, 0.35, -40); scene.add(rise);
}
// sky dome — house shader (sea-king pattern): gradient + sun glow from uniforms
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0.0004 } };
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
      void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
        float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .12*pow(max(s,0.), 160.)*step(.001,sunSize));
        gl_FragColor = vec4(c,1.); }`,
  }));
  scene.add(sky);
}
// soft fill from the opposite azimuth so shade-side armour stays readable
const fill = new THREE.DirectionalLight(0xffe0b8, 0.45); scene.add(fill); scene.add(fill.target);

// ---------------------------------------------------------------- fleets (instanced, exactly 1000 + 1000)
const dummy = new THREE.Object3D();
function buildFleet(side) {
  const N = side === 'US' ? STORY.US_N : STORY.CN_N;
  const bodyC = side === 'US' ? 0x5a6148 : 0x4d5c40, darkC = 0x2e2e28;
  const parts = {
    hull: new THREE.BoxGeometry(4.6, 1.0, 2.6),
    turret: new THREE.BoxGeometry(2.4, 0.7, 1.7),
    barrel: new THREE.CylinderGeometry(0.09, 0.11, 3.4, 6),
    treadL: new THREE.BoxGeometry(4.8, 0.9, 0.55),
    treadR: new THREE.BoxGeometry(4.8, 0.9, 0.55),
  };
  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: bodyC, roughness: 0.9 }),
    turret: new THREE.MeshStandardMaterial({ color: bodyC, roughness: 0.9 }),
    barrel: new THREE.MeshStandardMaterial({ color: darkC, roughness: 0.7, metalness: 0.4 }),
    treadL: new THREE.MeshStandardMaterial({ color: darkC, roughness: 1 }),
    treadR: new THREE.MeshStandardMaterial({ color: darkC, roughness: 1 }),
  };
  const offs = {
    hull: [0, 0.95, 0, 0], turret: [-0.2, 1.8, 0, 0], barrel: [2.6, 1.85, 0, 1],
    treadL: [0, 0.45, 1.25, 0], treadR: [0, 0.45, -1.25, 0],
  };
  const group = new THREE.Group();
  for (const k of Object.keys(parts)) {
    const im = new THREE.InstancedMesh(parts[k], mats[k], N);
    im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    for (let i = 0; i < N; i++) {
      const fp = STORY.fleetPosAt(side, i);
      const yaw = k === 'turret' || k === 'barrel' ? fp.ry + fp.turret : fp.ry;
      dummy.position.set(fp.p[0], fp.p[1], fp.p[2]); dummy.rotation.set(0, yaw, 0); dummy.updateMatrix();
      const local = new THREE.Object3D();
      local.position.set(offs[k][0], offs[k][1], offs[k][2]);
      if (offs[k][3]) local.rotation.z = -Math.PI / 2;
      local.updateMatrix();
      dummy.matrix.multiply(local.matrix);
      im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }
  scene.add(group);
  return group;
}
buildFleet('US'); buildFleet('CN');

// ---------------------------------------------------------------- hero tanks (detailed)
function box(w, h, d, c, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0.05, emissive: o.emissive ?? 0x000000 }));
  m.position.set(x, y, z); return m;
}
function buildHero(side) {
  const US = side === 'US';
  const body = US ? 0x646b4e : 0x55663f, dark = 0x2b2b26, accent = US ? 0x8a8f6d : 0x77894f;
  const g = new THREE.Group();
  g.add(box(5.2, 0.95, 0.6, dark, 0, 0.5, 1.35)); g.add(box(5.2, 0.95, 0.6, dark, 0, 0.5, -1.35)); // treads
  for (let i = -2; i <= 2; i++) { // road wheels
    const wgeo = new THREE.CylinderGeometry(0.42, 0.42, 0.18, 10);
    for (const s of [1.42, -1.42]) {
      const w = new THREE.Mesh(wgeo, new THREE.MeshStandardMaterial({ color: 0x3a3a32, roughness: 0.9 }));
      w.rotation.x = Math.PI / 2; w.position.set(i * 1.05, 0.45, s); g.add(w);
    }
  }
  const hull = box(5.4, 1.05, 2.5, body, 0, 1.15, 0); g.add(hull);
  g.add(box(1.6, 0.5, 2.3, accent, 2.55, 1.25, 0)); // glacis / nose kit
  g.add(box(5.0, 0.16, 2.2, accent, -0.2, 1.75, 0)); // deck plate: the "steel sandwich" layer
  for (let i = 0; i < 4; i++) g.add(box(0.7, 0.28, 0.5, dark, -2.2 + i * 0.85, 1.9, 0.9)); // stowage boxes
  const turret = new THREE.Group(); turret.position.set(-0.2, 1.7, 0); g.add(turret);
  turret.add(box(2.7, 0.8, 1.9, body, 0, 0.4, 0));
  turret.add(box(0.9, 0.35, 0.9, accent, -0.5, 0.95, 0.4)); // commander cupola
  turret.add(box(0.7, 0.28, 0.7, accent, 0.3, 0.92, -0.5)); // loader hatch
  const barrelPivot = new THREE.Group(); barrelPivot.position.set(1.2, 0.45, 0); turret.add(barrelPivot);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 3.9, 8), new THREE.MeshStandardMaterial({ color: dark, roughness: 0.6, metalness: 0.5 }));
  barrel.rotation.z = -Math.PI / 2; barrel.position.x = 1.95; barrelPivot.add(barrel);
  barrelPivot.add(box(0.5, 0.42, 0.42, dark, 0.25, 0, 0)); // mantlet
  // antenna + cloth flag on the turret rear
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.4, 4), new THREE.MeshStandardMaterial({ color: 0x1c1c18 }));
  ant.position.set(-1.5, 1.9, -0.7); turret.add(ant);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.72, 8, 4),
    new THREE.MeshStandardMaterial({ color: US ? 0xb22234 : 0xde2910, side: THREE.DoubleSide, roughness: 0.9 }));
  flag.rotation.y = Math.PI; flag.position.set(-2.08, 2.8, -0.7); turret.add(flag);
  FX.clothInit(flag, { amp: 0.18, freq: 3, speed: 7 });
  // headlights (night): two small emissive lamps + cones added at night in setFrame
  const lamps = [];
  for (const s of [0.8, -0.8]) {
    const lamp = box(0.16, 0.16, 0.3, 0xffe9a8, 2.85, 1.3, s, { emissive: 0x000000 });
    g.add(lamp); lamps.push(lamp);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 6.5, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xcfffe0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    cone.rotation.z = Math.PI / 2; cone.position.set(6.0, 1.1, s); g.add(cone); lamps.push(cone);
  }
  const exhaust = new THREE.Object3D(); exhaust.position.set(-2.9, 1.3, 0.5); g.add(exhaust);
  scene.add(g);
  return { g, turret, barrelPivot, barrel, flag, lamps, exhaust, side };
}
const heroUS = buildHero('US'), heroCN = buildHero('CN');
function placeHero(H, st, f) {
  H.g.position.set(st.p[0], st.p[1] + Math.sin(f * 1.7) * 0.012 * (st.speed > 0.01 ? 1 : 0.2), st.p[2]);
  H.g.rotation.set(0, st.ry, st.rock);
  H.turret.rotation.y = st.turret;
  H.barrelPivot.rotation.z = st.pitch;
  const rec = st.recoil || 0;
  H.barrel.position.x = 1.95 - rec;
  FX.clothWave(H.flag, f / FPS);
}

// ---------------------------------------------------------------- supply trucks + depot cargo
function buildTruck(i) {
  const t = STORY.truckAt(i, 0);
  const g = new THREE.Group();
  const cab = i % 3 === 0 ? 0x99865e : 0x8a7a52;
  g.add(box(1.5, 1.3, 1.9, cab, 2.2, 1.15, 0));
  g.add(box(1.3, 0.7, 1.7, 0x2c3026, 2.25, 1.65, 0)); // windshield band
  g.add(box(4.6, 1.7, 2.1, 0x9c8a5e, -0.9, 1.45, 0)); // canvas cargo bed
  g.add(box(4.7, 0.25, 2.15, 0x6d6248, -0.9, 2.4, 0));
  const wg = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), wm = new THREE.MeshStandardMaterial({ color: 0x2a2a24, roughness: 1 });
  for (const [x, z] of [[2.2, 1.05], [2.2, -1.05], [-1.6, 1.05], [-1.6, -1.05]]) {
    const w = new THREE.Mesh(wg, wm); w.rotation.x = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w);
  }
  scene.add(g);
  return g;
}
const trucks = []; for (let i = 0; i < STORY.TRUCK_N; i++) trucks.push(buildTruck(i));
{ // depot cargo: FX crates, barrels, fuel drums beside the parked trucks
  const cargo = new THREE.Group();
  rng(7);
  for (let i = 0; i < 14; i++) { const c = FX.crate(0.9 + rng() * 0.7); c.position.set(-128 + rng() * 110, 0.45, -222 + rng() * 6); c.rotation.y = rng() * 3; cargo.add(c); }
  for (let i = 0; i < 12; i++) { const b = FX.barrel(i % 3 === 0 ? 0x8a4a2a : 0x5d6636); b.position.set(-125 + rng() * 105, 0.55, -200 + rng() * 5); cargo.add(b); }
  scene.add(cargo);
}

// ---------------------------------------------------------------- shells, muzzle flashes, tracers
const shellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
shellMesh.visible = false; scene.add(shellMesh);
const shell2 = shellMesh.clone(); scene.add(shell2);
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.85, fog: false });
const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const tracer = new THREE.Line(tracerGeo, tracerMat); tracer.visible = false; scene.add(tracer);
const muzzles = { US: new FX.Muzzle(scene), CN: new FX.Muzzle(scene) };
const fireLight = new THREE.PointLight(0xffa040, 0, 60); scene.add(fireLight);
const bursts = []; // pooled impact FX: {smoke, fire, light}
for (let i = 0; i < 3; i++) {
  const fire = new FX.Fire(scene, { rate: 40, scale: 2.2 }); fire.on = false; // burst emitter, lit per-impact below
  bursts.push({ smoke: new FX.Smoke(scene, 26), fire, at: null, t0: -99 });
}
// dust: hero trails + ambient battlefield dust (FX.Smoke takes a pool COUNT; colour/opacity come from spawn opts)
const dustUS = new FX.Smoke(scene, 30);
const dustCN = new FX.Smoke(scene, 30);
const dustTruck = new FX.Smoke(scene, 24);
const exhaustUS = new FX.Smoke(scene, 12);
const exhaustCN = new FX.Smoke(scene, 12);
const clouds = new FX.Clouds(scene, { count: 14, y: 60, opacity: 0.5 });

// ---------------------------------------------------------------- commander cards (toon kit)
// Flat 2D romanFront cards (toon.js = toonbase + roman, bear-line pattern):
// 1200x2000 canvas (600x1000 design space), plane 1.35x2.25 m, soles at origin,
// yawed to camera, contact blob at the feet. Redraw only on pose-key change.
import * as T from './toon.js';
const CARD_M = 2.25;
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
    this.c = document.createElement('canvas'); this.c.width = 1200; this.c.height = 2000;
    this.g = this.c.getContext('2d');
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mesh = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true }));
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1;
    this.mesh.visible = this.blob.visible = false;
    scene.add(this.mesh); scene.add(this.blob); this.key = '';
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1200, 2000);
    g.setTransform(1200 / 600, 0, 0, 2000 / 1000, 0, 0);
    fn(new T.Pen(g)); this.t.needsUpdate = true;
  }
  place(x, y, z, camPos, s = 1) {
    this.mesh.visible = this.blob.visible = true;
    this.mesh.position.set(x, y, z); this.mesh.scale.setScalar(s);
    this.mesh.rotation.set(0, Math.atan2(camPos[0] - x, camPos[2] - z), 0);
    this.blob.position.set(x, y + 0.03, z); this.blob.scale.setScalar(s);
  }
  hide() { this.mesh.visible = this.blob.visible = false; }
}
const cards = { cmdUS: new Card(), cmdCN: new Card() };
const idleAt = (f, seed) => ({ bob: Math.sin(f * 0.11 + seed) * 1.5, tilt: Math.sin(f * 0.07 + seed * 2) * 1.2, headTilt: Math.sin(f * 0.05 + seed) * 2 });
const blinkAt = (f, seed) => (((f + seed * 37) % 97) < 5 ? 1 : 0);
function drawCommanders(f) {
  const list = STORY.cmdrAt(f);
  const seen = new Set();
  for (const a of list) {
    seen.add(a.who);
    const C = cards[a.who], idl = idleAt(f, a.seed), blk = blinkAt(f, a.seed);
    const key = `${a.who}|${a.expr}|${a.L}|${a.R}|${blk}|${idl.bob.toFixed(1)}|${Math.round(idl.tilt)}|${Math.round(idl.headTilt)}`;
    C.draw(key, (p) => T.romanFront(p, a.who, {
      seed: a.seed, expr: a.expr, L: a.L, R: a.R, blink: blk,
      bob: idl.bob, tilt: Math.round(idl.tilt), headTilt: Math.round(idl.headTilt), wv: f * 0.18,
    }));
    const groundY = (a.who && Math.hypot(a.p[0] - 3.5, a.p[2] + 40) < 6.5) ? 0.75 : a.p[1]; // finale pair stand on the command rise
    C.place(a.p[0], groundY, a.p[2], camera.position.toArray(), a.s || 1);
  }
  for (const who of Object.keys(cards)) if (!seen.has(who)) cards[who].hide();
}

// ---------------------------------------------------------------- board (camera-relative canvas card)
const boardCv = document.createElement('canvas'); boardCv.width = 1200; boardCv.height = 340;
const boardCtx = boardCv.getContext('2d');
const boardTex = new THREE.CanvasTexture(boardCv); boardTex.colorSpace = THREE.SRGBColorSpace;
const boardMat = new THREE.MeshBasicMaterial({ map: boardTex, transparent: true, depthTest: false, fog: false });
const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.70), boardMat);
boardMesh.renderOrder = 999; boardMesh.visible = false; scene.add(boardMesh);
let boardKey = '';
function drawBoard(board, camF) {
  if (!board) { boardMesh.visible = false; boardKey = ''; return; }
  const key = board.text;
  if (key !== boardKey) {
    boardKey = key;
    const g = boardCtx; g.clearRect(0, 0, 1200, 340);
    g.fillStyle = board.bg; g.beginPath(); g.roundRect(6, 6, 1188, 328, 36); g.fill();
    g.lineWidth = 10; g.strokeStyle = board.fg; g.stroke();
    g.fillStyle = board.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 118;
    g.font = `900 ${size}px Arial, sans-serif`;
    while (g.measureText(board.text).width > 1120 && size > 40) { size -= 6; g.font = `900 ${size}px Arial, sans-serif`; }
    g.fillText(board.text, 600, 176);
    boardTex.needsUpdate = true;
  }
  boardMesh.visible = true;
  boardMat.opacity = board.alpha;
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const dist = 6.8;
  boardMesh.position.copy(camera.position).addScaledVector(fwd, dist);
  boardMesh.position.y += 1.3;
  boardMesh.quaternion.copy(camera.quaternion);
  const s = 0.9 + 0.1 * camF; boardMesh.scale.set(s, s, 1);
}

// ---------------------------------------------------------------- night-vision overlay
const nvCv = document.createElement('canvas'); nvCv.width = 64; nvCv.height = 64;
{
  const g = nvCv.getContext('2d'); g.fillStyle = '#39ff7a'; g.fillRect(0, 0, 64, 64);
}
const nvTex = new THREE.CanvasTexture(nvCv);
const nvMat = new THREE.MeshBasicMaterial({ map: nvTex, transparent: true, opacity: 0, depthTest: false, fog: false, blending: THREE.AdditiveBlending });
const nvMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), nvMat);
nvMesh.renderOrder = 998; nvMesh.visible = false; scene.add(nvMesh);
// thermal glow sprites on both heroes at night
function glowSprite(color) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.scale.set(9, 5, 1); scene.add(sp); return sp;
}
const glowUS = glowSprite('rgba(255,140,40,0.85)'), glowCN = glowSprite('rgba(255,140,40,0.85)');
glowUS.scale.set(11, 6, 1); glowCN.scale.set(11, 6, 1);

// ---------------------------------------------------------------- frame driver
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const wp = new THREE.Vector3();
function burstAt(p, f) {
  const b = bursts.find((x) => f - x.t0 > 40) || bursts[0];
  b.at = [...p]; b.t0 = f;
}
const fired = new Set();
function setFrame(f) {
  const t = f / FPS;
  const env = STORY.envAt(f);
  skyU.top.value.setRGB(...env.top); skyU.hor.value.setRGB(...env.hor);
  scene.fog.color.setRGB(...env.fog); scene.fog.near = env.fn; scene.fog.far = env.ff;
  groundMat.color.setRGB(0.761 - 0.34 * env.nv, 0.627 - 0.08 * env.nv, 0.420 - 0.04 * env.nv); // sand greens under NV
  plainMat.color.setRGB(0.733 - 0.32 * env.nv, 0.612 - 0.07 * env.nv, 0.400 - 0.03 * env.nv);
  duneM.color.setRGB(0.78 - 0.33 * env.nv, 0.647 - 0.06 * env.nv, 0.431 - 0.03 * env.nv);
  const az = THREE.MathUtils.degToRad(env.az), el = THREE.MathUtils.degToRad(env.el);
  sun.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(300);
  sun.color.setRGB(...env.sun); sun.intensity = env.sunI;
  skyU.sunDir.value.copy(sun.position).normalize(); skyU.sunCol.value.setRGB(env.sun[0] * (1 - env.nv * 0.65), env.sun[1] * (1 - env.nv * 0.65), env.sun[2] * (1 - env.nv * 0.65));
  fill.position.set(-sun.position.x, 60, -sun.position.z); fill.intensity = 0.45 * (1 - env.nv * 0.6);
  hemi.color.setRGB(...env.hSky); hemi.groundColor.setRGB(...env.hGnd); hemi.intensity = env.hemi;
  renderer.toneMappingExposure = 1.05 - env.nv * 0.25;

  const cam = STORY.camAt(f);
  camera.position.copy(V3(cam.pos)); camera.lookAt(V3(cam.look)); camera.fov = cam.fov; camera.updateProjectionMatrix();

  // heroes
  const usH = STORY.heroUSAt(f), cnH = STORY.heroCNAt(f);
  placeHero(heroUS, usH, f); placeHero(heroCN, cnH, f);
  // lamps + thermal glow at night
  for (const H of [heroUS, heroCN]) {
    H.lamps[0].material.emissive.setScalar(env.nv * 0.9);
    H.lamps[2].material.emissive.setScalar(env.nv * 0.9);
    H.lamps[1].material.opacity = env.nv * 0.045; H.lamps[3].material.opacity = env.nv * 0.045;
  }
  glowUS.position.set(usH.p[0], 1.6, usH.p[2]); glowCN.position.set(cnH.p[0], 1.6, cnH.p[2]);
  glowUS.material.opacity = env.nv * 0.75; glowCN.material.opacity = env.nv * 0.75;
  // hero dust + exhaust (spawn keyed to movement; deterministic)
  if (usH.speed > 0.01 && f % 2 === 0) { heroUS.exhaust.getWorldPosition(wp); dustUS.spawn(wp.x - Math.cos(usH.ry) * 2.4, 0.5, wp.z + Math.sin(usH.ry) * 2.4, { color: 0xd8bc85, opacity: 0.4, scale: 2.2, life: 2.2 }); }
  if (cnH.speed > 0.01 && f % 2 === 0) { heroCN.exhaust.getWorldPosition(wp); dustCN.spawn(wp.x - Math.cos(cnH.ry) * 2.4, 0.5, wp.z + Math.sin(cnH.ry) * 2.4, { color: 0xd8bc85, opacity: 0.4, scale: 2.2, life: 2.2 }); }
  if (f % 5 === 0) { heroUS.exhaust.getWorldPosition(wp); exhaustUS.spawn(wp.x, wp.y, wp.z, { color: 0x555049, opacity: 0.35, scale: 1.0, vy: 2.2 }); heroCN.exhaust.getWorldPosition(wp); exhaustCN.spawn(wp.x, wp.y, wp.z, { color: 0x555049, opacity: 0.35, scale: 1.0, vy: 2.2 }); }
  dustUS.update(t, 1 / 30); dustCN.update(t, 1 / 30); exhaustUS.update(t, 1 / 30); exhaustCN.update(t, 1 / 30);

  // trucks
  let truckDustDone = false;
  for (let i = 0; i < STORY.TRUCK_N; i++) {
    const tr = STORY.truckAt(i, f), m = trucks[i];
    m.position.set(tr.p[0], tr.p[1], tr.p[2]); m.rotation.y = tr.ry;
    if (tr.moving && !truckDustDone && f % 3 === 0 && (f / 3 + i) % 4 === 0) {
      dustTruck.spawn(tr.p[0] - Math.cos(tr.ry) * 3, 0.5, tr.p[2] + Math.sin(tr.ry) * 3, { color: 0xd8bc85, opacity: 0.35, scale: 2.0, life: 2.0 }); truckDustDone = true;
    }
  }
  dustTruck.update(t, 1 / 30);

  // FX events: muzzles, hits, distant night shots
  for (const ev of STORY.EVENTS) {
    if (ev.f === f && !fired.has(ev.f + ev.type)) {
      fired.add(ev.f + ev.type);
      if (ev.type === 'fire') {
        const mp = STORY.muzzleAt(ev.side, f);
        muzzles[ev.side].pop(mp[0], mp[1], mp[2], t, 3.6);
        fireLight.position.set(mp[0], mp[1] + 1, mp[2]); fireLight.intensity = 60;
      } else if (ev.type === 'fireFar') {
        muzzles.CN.pop(ev.at[0], ev.at[1], ev.at[2], t, 3.0);
      } else if (ev.type === 'hit' || ev.type === 'hitTest') {
        const hp = ev.side === 'US' ? [usH.p[0] + 3.2, 1.9, usH.p[2]] : [cnH.p[0] - 3.0, 1.9, cnH.p[2]];
        burstAt(hp, f);
        fireLight.position.set(hp[0], hp[1] + 1, hp[2]); fireLight.intensity = 110;
      } else if (ev.type === 'dustFar') {
        const mp = STORY.muzzleAt(ev.side, f - 20);
        burstAt([mp[0] + (ev.side === 'US' ? 55 : -55), 0.8, mp[2] + (ev.side === 'US' ? 6 : -6)], f);
      }
    }
  }
  muzzles.US.update(t); muzzles.CN.update(t);
  fireLight.intensity *= 0.72;
  for (const b of bursts) {
    const age = f - b.t0;
    if (b.at && age >= 0 && age <= 40) {
      if (age === 0) { b.smoke.burst(b.at[0], b.at[1], b.at[2], { n: 14, color: 0x8a7a5e, opacity: 0.6, scale: 3.2, life: 2.4 }); b.fire.x = b.at[0]; b.fire.y = b.at[1]; b.fire.z = b.at[2]; b.fire.on = true; }
      if (age > 10) b.fire.on = false;
      b.smoke.update(t, 1 / 30); b.fire.update(t, 1 / 30);
    }
  }
  clouds.update(t, 1 / 30);

  // shells + tracer
  const shells = STORY.shellsAt(f);
  const sm = [shellMesh, shell2];
  sm.forEach((m) => { m.visible = false; });
  tracer.visible = false;
  shells.slice(0, 2).forEach((s, i) => {
    sm[i].visible = true; sm[i].position.set(s.p[0], s.p[1], s.p[2]);
    if (i === 0 && s.u > 0.05) {
      const pos = tracer.geometry.attributes.position;
      pos.setXYZ(0, s.p[0] - 3.2, s.p[1], s.p[2]); pos.setXYZ(1, s.p[0], s.p[1], s.p[2]);
      pos.needsUpdate = true; tracer.visible = true;
    }
  });
  // commanders + board + NV overlay
  drawCommanders(f);
  drawBoard(STORY.boardAt(f), 1);
  if (env.nv > 0.02) {
    nvMesh.visible = true; nvMat.opacity = env.nv * 0.30;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    nvMesh.position.copy(camera.position).addScaledVector(fwd, 5.8);
    nvMesh.quaternion.copy(camera.quaternion);
  } else nvMesh.visible = false;
}
window.renderFrame = (f) => { setFrame(f); renderer.render(scene, camera); };
window.renderFrame(0);
window.ready = true;
