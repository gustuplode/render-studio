// "The King's Battle at Sea" — coded-FX demo. three.js scene driven ENTIRELY by
// story.js frame math; the fx.js pools (smoke/fire/splash/wake) add transient life.
// Contract (render.mjs): window.ready, window.renderFrame(f), canvas #c 1080x1920.
import * as THREE from 'three';
import * as FX from './fx.js';
import {
  TOTAL, secAt, camAt, envAt, armadaMistAt, kingPoseAt, enemyPoseAt, bottleAt, BUMP_F,
  volleyAt, ballsAt, debrisAt, ringAt, mastFallAt, MAST_SPLASH, boardAt, armUAt,
  BURST_F, FUSE_START, waveH,
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

// ---------- sky dome (house shader) ----------
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

// ---------- lights (<=2 dynamic point lights live inside FX.Fire) ----------
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
const armadaMist = FX.mistBand(scene, { y: 2.4, opacity: 0.3, count: 9 });
armadaMist.traverse((o) => { if (o.isSprite) { o.userData.f = 0.7 + Math.random() * 0.6; o.position.set(58 + Math.random() * 55, 2.4 + (Math.random() - 0.5) * 1.4, -42 + Math.random() * 84); } });
const smoke = new FX.Smoke(scene, 130);
const splashes = new FX.Splashes(scene, 300);
const wake = new FX.Wake(scene, 64);
const muzzleLight = new THREE.PointLight(0xffc98a, 0, 42, 1.6); scene.add(muzzleLight);
const muzzles = []; for (let i = 0; i < 5; i++) muzzles.push(new FX.Muzzle(scene, i === 0 ? muzzleLight : null));
let muzzleIx = 0;

// fires: burnA (light) + burnB on the two doomed king ships, boom (light) for the
// explosion, fuse spark for the fireship — never more than 2 fire lights at once.
const fireA = new FX.Fire(scene, { scale: 2.0, rate: 21, light: true, max: 30 });
const fireB = new FX.Fire(scene, { scale: 1.35, rate: 17, light: false, max: 30 });
const fireBoom = new FX.Fire(scene, { scale: 6, rate: 32, light: true, max: 44 });
const fireFuse = new FX.Fire(scene, { scale: 0.55, rate: 13, light: false, max: 14 });
const burnEmitA = smoke.addEmitter(0, 0, 0, { rate: 10, color: 0x38332e, scale: 2.3, opacity: 0.55, life: 3.2, vy: 1.8 });
const burnEmitB = smoke.addEmitter(0, 0, 0, { rate: 9, color: 0x38332e, scale: 2.0, opacity: 0.5, life: 3.0, vy: 1.7 });
const wreckEmitA = smoke.addEmitter(0, 0, 0, { rate: 3.5, color: 0x4a443e, scale: 2.6, opacity: 0.4, life: 3.6, vy: 1.4 });
const wreckEmitB = smoke.addEmitter(0, 0, 0, { rate: 3, color: 0x4a443e, scale: 2.3, opacity: 0.38, life: 3.4, vy: 1.3 });

// ---------- shared materials / helpers ----------
const lam = (o) => new THREE.MeshLambertMaterial(o);
const woodMat = (tint) => lam({ map: FX.woodTexture(), color: tint });
const darkWood = lam({ color: 0x4a3826 });
const blackMat = lam({ color: 0x101014 });
const _v = new THREE.Vector3();
function waveSail(mesh, t) { // FX cloth ripple + the baked belly the task asks for
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

// ---------- the ship builder ----------
const MASTS = [
  { x: 3.0, h: 5.6, sails: [[5.2, 3.2, 2.1], [3.3, 2.8, 1.8]] },
  { x: 0.2, h: 7.4, sails: [[7.0, 3.8, 2.4], [4.9, 3.3, 2.1], [3.0, 2.8, 1.7]] },
  { x: -2.6, h: 4.9, sails: [[4.5, 2.6, 1.9]] },
];
function buildShip(o) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const hullMat = woodMat(o.hullColor);
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  add(new THREE.BoxGeometry(8.8, 1.9, 3.3), hullMat, 0, 1.15, 0);                                   // hull
  add(new THREE.CylinderGeometry(1.65, 1.65, 1.9, 14, 1, false, 0, Math.PI), hullMat, 4.4, 1.15, 0); // rounded bow
  add(new THREE.BoxGeometry(1.8, 2.7, 3.5), hullMat, -4.5, 1.55, 0);                                 // sterncastle
  add(new THREE.BoxGeometry(9.05, 0.42, 3.38), lam({ color: o.stripe || 0xd8c49a }), 0, 1.62, 0);    // stripe
  add(new THREE.BoxGeometry(8.9, 0.16, 3.15), woodMat(0xc9a878), 0, 2.18, 0);
  add(new THREE.BoxGeometry(2.0, 0.16, 3.6), woodMat(0xc9a878), -4.5, 2.98, 0);                       // stern deck
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(8.9, 0.22, 0.08), darkWood, 0, 2.52, s * 1.55);                        // rails
    for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.55, 0.5, 0.08), blackMat, -3 + k * 1.5, 1.5, s * 1.68); // cannon ports
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
  // flag on the main mast (cloth, hoist edge anchored at the pole)
  const flagGeo = new THREE.PlaneGeometry(1.6, 0.95, 8, 4); flagGeo.translate(-0.8, 0, 0);
  const flag = new THREE.Mesh(flagGeo, lam({ color: o.flagColor, side: THREE.DoubleSide }));
  flag.position.set(0, 7.15, 0); FX.clothInit(flag, { amp: 0.3, freq: 3, speed: 8 });
  ship.masts.main.add(flag); ship.flag = flag;
  // deck cargo — crates + barrels (the dibbe!)
  const cr = FX.crate(1.1); cr.position.set(1.8, 2.81, -0.9); g.add(cr);
  for (const [bx, bz] of [[-1.6, 1.0], [-0.55, 1.05]]) { const b = FX.barrel(); b.scale.setScalar(0.72); b.position.set(bx, 2.78, bz); g.add(b); }
  if (o.lanterns) { // stern lantern: glass + warm core + glint
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), darkWood, -4.5, 3.3, 0);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), FX.glassMat(0xffc46b, 0.6)); lamp.position.set(-4.5, 3.62, 0); g.add(lamp);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); core.position.copy(lamp.position); g.add(core);
    const gl = FX.glint(1.25); gl.position.copy(lamp.position); g.add(gl); ship.lanternGlint = gl;
  }
  g.scale.setScalar(ship.scale);
  scene.add(g);
  return ship;
}

const kingSailMat = lam({ color: 0xf3e9d2, side: THREE.DoubleSide });
const enemySailMat = lam({ color: 0x23232b, side: THREE.DoubleSide });
const kingShips = [], enemyShips = [];
for (let i = 0; i < 7; i++) kingShips.push(buildShip({ hullColor: i === 0 ? 0x9a744e : 0x8a6844, sailColor: 0, sailMat: kingSailMat, flagColor: i === 0 ? 0xd8a020 : 0xb03a2e, scale: i === 0 ? 1.15 : 1.0, lanterns: true }));
for (let i = 0; i < 8; i++) enemyShips.push(buildShip({ hullColor: 0x5d4630, sailColor: 0, sailMat: enemySailMat, flagColor: 0x17171c, stripe: 0x3a3a40, scale: 1.05, lanterns: false }));
const flagship = kingShips[0], fireship = kingShips[6];

// ---------- V2 far fleets: cheap clones so the counts are REAL (40 king / 60 enemy) ----------
// Shared geometries + shared materials only: hull, stern, 2 masts, 2 plain sails,
// 1 flag = 6 simple meshes per ship, no canvas textures, no cloth sim (the hull's
// wave bobbing moves them; at drone distance that reads as a living fleet).
const farHullGeo = new THREE.BoxGeometry(8.8, 1.9, 3.3);
const farSternGeo = new THREE.BoxGeometry(1.8, 2.7, 3.5);
const farMastGeo = new THREE.CylinderGeometry(0.09, 0.13, 7, 6);
const farSailGeo = new THREE.PlaneGeometry(1, 1);
const farKingHullMat = lam({ map: FX.woodTexture(), color: 0x8a6844 });
const farEnemyHullMat = lam({ map: FX.woodTexture(), color: 0x5d4630 });
function buildFarShip(sailMat, hullMat, flagMat) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(farHullGeo, hullMat, 0, 1.15, 0);
  add(farSternGeo, hullMat, -4.4, 1.55, 0);
  for (const [mx, mh, sw, sh] of [[0.4, 7.2, 6.2, 3.3], [-2.4, 5.2, 4.4, 2.7]]) {
    const mast = add(farMastGeo, darkWood, mx, 2.2 + mh / 2, 0); mast.scale.y = mh / 7;
    const sail = add(farSailGeo, sailMat, mx, 2.2 + mh - sh / 2 - 0.3, 0);
    sail.rotation.y = Math.PI / 2; sail.scale.set(sw, sh, 1);
  }
  const flag = add(farSailGeo, flagMat, -0.35, 9.15, 0); flag.scale.set(1.5, 0.85, 1);
  scene.add(g);
  return { g, sails: [] };
}
const farKingFlagMat = lam({ color: 0xb03a2e, side: THREE.DoubleSide });
const farEnemyFlagMat = lam({ color: 0x17171c, side: THREE.DoubleSide });
const farKingShips = [], farEnemyShips = [];
for (let j = 0; j < 33; j++) { const s = buildFarShip(kingSailMat, farKingHullMat, farKingFlagMat); s.g.scale.setScalar(0.92 + ((j * 37) % 10) * 0.012); farKingShips.push(s); }
for (let j = 0; j < 52; j++) { const s = buildFarShip(enemySailMat, farEnemyHullMat, farEnemyFlagMat); s.g.scale.setScalar(0.97 + ((j * 41) % 10) * 0.012); farEnemyShips.push(s); }

// ---------- the KING (flagship stern) + crew + deck cannons + rolling barrel ----------
function buildFigure(robe, skin) {
  const g = new THREE.Group();
  const robeM = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 10), lam({ color: robe })); robeM.position.y = 0.75; g.add(robeM);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), lam({ color: skin })); head.position.y = 1.85; g.add(head);
  return g;
}
const kingFig = buildFigure(0xb03030, 0xf2ede4);
{ // gold crown + glint
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.2, 10), lam({ color: 0xd8a020 })); crown.position.y = 2.3; kingFig.add(crown);
  for (let k = 0; k < 4; k++) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), crown.material); const a = k * Math.PI / 2 + 0.4; cone.position.set(Math.cos(a) * 0.26, 2.52, Math.sin(a) * 0.26); kingFig.add(cone); }
  const gl = FX.glint(1.0); gl.position.set(0, 2.45, 0); kingFig.add(gl); kingFig.userData.glint = gl;
  const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.85, 6); armGeo.translate(0, -0.42, 0);
  const armR = new THREE.Group(); armR.position.set(0, 1.45, 0.34); armR.add(new THREE.Mesh(armGeo, lam({ color: 0xb03030 }))); kingFig.add(armR);
  const armL = new THREE.Group(); armL.position.set(0, 1.45, -0.34); armL.add(new THREE.Mesh(armGeo, armR.children[0].material)); armL.rotation.z = 0.25; kingFig.add(armL);
  kingFig.userData.armR = armR;
  kingFig.position.set(-5.6, 3.06, 0); flagship.g.add(kingFig);
}
const sailors = [];
for (const [sx, sz, col] of [[1.4, 0.85, 0x7a8ba0], [4.3, 0.85, 0xa08a6a]]) {
  const s = buildFigure(col, 0xe8b98d); s.scale.setScalar(0.92); s.position.set(sx, 2.26, sz); flagship.g.add(s); sailors.push(s);
}
const rollBarrel = new THREE.Group(); // sailors roll this along the deck in 'order'
{ const tilt = new THREE.Group(); tilt.rotation.x = Math.PI / 2; const b = FX.barrel(); b.scale.setScalar(0.8); tilt.add(b); rollBarrel.add(tilt); rollBarrel.position.set(2.3, 2.72, 0.85); flagship.g.add(rollBarrel); }
for (let k = 0; k < 4; k++) { // flagship deck cannons, muzzles to starboard
  const cg = new THREE.Group(); cg.position.set(-0.6 + k * 1.5, 2.26, 1.02);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.15, 8), blackMat); tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.34, 0.3); cg.add(tube);
  const carr = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.72), darkWood); carr.position.y = 0.15; cg.add(carr);
  flagship.g.add(cg);
}
// fireship conversion kit: powder cargo + fuse line (hidden until the gambit)
const fsCargo = new THREE.Group();
for (let k = 0; k < 6; k++) { const b = FX.barrel(); b.position.set(-3 + (k % 3) * 2.2, 0.78, k < 3 ? -0.8 : 0.85); fsCargo.add(b); }
for (let k = 0; k < 4; k++) { const c = FX.crate(1.15); c.position.set(-2.4 + k * 1.9, 0.6, k % 2 ? 0.2 : -0.3); fsCargo.add(c); }
fsCargo.position.y = 2.26; fsCargo.visible = false; fireship.g.add(fsCargo);
const fuseLine = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
fuseLine.position.set(0, 2.62, 0); fuseLine.visible = false; fireship.g.add(fuseLine);

// ---------- the bottle ----------
const bottle = FX.bottle(); bottle.scale.setScalar(0.95); scene.add(bottle);

// ---------- explosion dressing: shock rings + flash glint + debris + chips + balls ----------
const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.0, 48), new THREE.MeshBasicMaterial({ color: 0xffe9c4, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
ring1.rotation.x = -Math.PI / 2; ring1.position.set(29, 1.1, 14.5); ring1.visible = false; scene.add(ring1);
const ring2 = ring1.clone(); ring2.material = ring1.material.clone(); ring2.material.color.set(0xcbb99e); ring2.position.y = 0.7; scene.add(ring2);
const flashSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture('fire'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
flashSpr.position.set(29, 5.5, 14.5); flashSpr.visible = false; scene.add(flashSpr);
const debrisMeshes = [];
for (let k = 0; k < 10; k++) { const m = k % 2 === 0 ? FX.barrel() : FX.crate(1.2); m.visible = false; scene.add(m); debrisMeshes.push(m); }
const ballPool = [];
for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), blackMat); m.visible = false; scene.add(m); ballPool.push(m); }
const chipPool = [];
for (let k = 0; k < 26; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.05), lam({ color: 0x6d5136 })); m.visible = false; scene.add(m); chipPool.push({ m, life: -1, v: [0, 0, 0], rv: [0, 0, 0] }); }
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

// ---------- title / message board (canvas texture, camera-relative) ----------
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
function dropWake(ship, pose, key, dt, scale) {
  const a = (wakeAcc.get(key) || 0) + dt; wakeAcc.set(key, a);
  if (a < 0.5) return; wakeAcc.set(key, 0);
  const fx = Math.cos(pose.ry), fz = -Math.sin(pose.ry);
  wake.drop(pose.p[0] - fx * 5.4 * scale, pose.p[2] - fz * 5.4 * scale, 1.6 * scale);
}
function setFire(fire, p, on) {
  fire.on = on;
  if (p) { fire.x = p[0]; fire.y = p[1]; fire.z = p[2]; if (fire.light) fire.light.position.set(p[0], p[1] + 1.5, p[2]); }
}
const debrisFired = new Set();

window.renderFrame = (f) => {
  const t = f / 30;
  const dt = lastF < 0 ? 1 / 30 : Math.min(0.1, Math.max(0, (f - lastF) / 30));
  const sec = secAt(f), env = envAt(f);

  // --- environment ---
  skyU.top.value.setRGB(...env.top); skyU.hor.value.setRGB(...env.hor); skyU.sunCol.value.setRGB(...env.sun);
  scene.fog.color.setRGB(...env.fog); scene.fog.near = env.fn; scene.fog.far = env.ff;
  hemi.color.setRGB(...env.hSky); hemi.groundColor.setRGB(...env.hGnd); hemi.intensity = env.hemi + env.flash * 1.6;
  sun.color.setRGB(...env.sun); sun.intensity = env.sunI + env.flash * 2.5;
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
  clouds.group.traverse((o) => { if (o.isSprite) { o.material.color.setRGB(...env.cloud); o.material.opacity = o.userData.op0 * (env.cop / 0.8); } });
  mist.traverse((o) => { if (o.isSprite) o.material.opacity = env.mist * o.userData.f; });
  const aMist = armadaMistAt(f);
  armadaMist.traverse((o) => { if (o.isSprite) o.material.opacity = aMist * o.userData.f; });

  // --- ships ---
  const poses = { K: [], E: [] };
  const place = (ship, pose) => {
    ship.g.visible = !pose.hidden;
    if (pose.hidden) return;
    ship.g.position.set(...pose.p); ship.g.rotation.set(pose.roll, pose.ry, -pose.pitch);
  };
  for (let i = 0; i < 7; i++) { poses.K.push(kingPoseAt(i, f)); place(kingShips[i], poses.K[i]); }
  for (let i = 0; i < 8; i++) { poses.E.push(enemyPoseAt(i, f)); place(enemyShips[i], poses.E[i]); }
  for (let j = 0; j < farKingShips.length; j++) place(farKingShips[j], kingPoseAt(7 + j, f));
  for (let j = 0; j < farEnemyShips.length; j++) place(farEnemyShips[j], enemyPoseAt(8 + j, f));
  // mast falls (burning K3, blasted E1/E2)
  kingShips[3].masts.main.rotation.x = mastFallAt('K3', f);
  enemyShips[2].masts.main.rotation.x = mastFallAt('E2', f);
  enemyShips[1].masts.main.rotation.x = mastFallAt('E1', f);
  // the king's arm + crown glint
  kingFig.userData.armR.rotation.z = -2.25 * armUAt(f);
  const kg = kingFig.userData.glint, vic = sec.id === 'victory';
  kg.material.opacity = vic ? 0.65 + 0.35 * Math.sin(t * 6) : 0.5 + 0.25 * Math.sin(t * 3);
  kg.scale.setScalar(vic ? 1.15 + 0.4 * Math.sin(t * 6) : 1.0);
  // victory: the king walks from the stern to the bow as the fleet regroups
  if (vic) { const w = Math.min(1, Math.max(0, (f - 1700) / 70)), ws = w * w * (3 - 2 * w); kingFig.position.set(-5.6 + 10.6 * ws, 3.06 - 0.8 * ws, 0); }
  else kingFig.position.set(-5.6, 3.06, 0);
  // crew + rolling barrel during the order
  if (sec.id === 'order') {
    const u = sec.u, bx = 1.3 + (u < 0.5 ? u * 2 : 2 - u * 2) * 2.4;
    rollBarrel.position.x = bx; rollBarrel.rotation.y = 0; rollBarrel.children[0].rotation.z = 0;
    rollBarrel.rotation.z = -(bx - 1.3) / 0.5;
    sailors[0].position.x = bx - 0.95; sailors[0].rotation.z = -0.14;
    sailors[1].position.x = bx + 1.15; sailors[1].rotation.z = 0.1;
  }
  // fireship conversion
  fsCargo.visible = f >= 1282; fireship.flag.visible = f < 1282;
  fuseLine.visible = f >= FUSE_START && f < BURST_F;
  // lantern glints breathe
  for (let i = 0; i < 7; i++) { const gl = kingShips[i].lanternGlint; if (gl) gl.material.opacity = (f < 800 ? 0.85 : 0.4) * (0.7 + 0.3 * Math.sin(t * 2.7 + i * 1.3)); }

  // --- cloth on every visible ship ---
  for (const ship of [...kingShips, ...enemyShips]) {
    if (!ship.g.visible) continue;
    for (const s of ship.sails) waveSail(s, t + ship.g.position.x * 0.05);
    FX.clothWave(ship.flag, t);
  }

  // --- wakes (only ships actually underway) ---
  if (dt > 0) {
    if (sec.id === 'dawn' || sec.id === 'armada') for (let i = 0; i < 7; i++) dropWake(kingShips[i], poses.K[i], 'K' + i, dt, kingShips[i].scale);
    if (sec.id === 'armada') for (let i = 0; i < 8; i++) dropWake(enemyShips[i], poses.E[i], 'E' + i, dt, 1.05);
    if (f > 945 && f < 1015) for (let i = 0; i < 7; i++) dropWake(kingShips[i], poses.K[i], 'K' + i, dt, kingShips[i].scale);
    if (f >= 1282 && f < BURST_F) dropWake(fireship, poses.K[6], 'FS', dt, 1);
    if (sec.id === 'victory' && f < 1780) for (let i = 0; i < 5; i++) dropWake(kingShips[i], poses.K[i], 'K' + i, dt, kingShips[i].scale);
  }

  // --- battle events (sequential: fire only when the frame is crossed) ---
  for (const v of volleyAt(f)) {
    if (lastF >= v.f) continue;
    for (const si of v.ships) {
      const ship = v.side === 'K' ? kingShips[si] : enemyShips[si];
      ship.g.updateMatrixWorld();
      const side = v.side === 'K' ? 1.85 : -1.85;
      _v.set(((si % 5) - 2) * 1.5, 1.62, side); ship.g.localToWorld(_v);
      muzzles[muzzleIx++ % muzzles.length].pop(_v.x, _v.y, _v.z, t, 3.4);
      smoke.burst(_v.x, _v.y, _v.z, { n: 10, color: 0xb9b4ac, scale: 2.6, opacity: 0.55, vy: 0.5, vx: v.side === 'K' ? 1.6 : -1.6, life: 2.6 });
    }
  }
  for (const b of ballsAt(f)) {
    if (b.impact && lastF < f) {
      if (b.target.kind === 'water') splashes.burst(b.target.p[0], 0, b.target.p[2], { n: 30, power: 6.5 });
      else { smoke.burst(b.target.p[0], b.target.p[1], b.target.p[2], { n: 5, color: 0x555049, scale: 1.1, opacity: 0.55, vy: 0.8 }); spawnChips(b.target.p, 5); }
    }
  }
  if (f === BUMP_F && lastF < f) { const b = bottleAt(f); splashes.burst(b.p[0], 0, b.p[2], { n: 8, power: 1.4 }); }
  for (const [mf, key] of MAST_SPLASH) {
    if (f === mf && lastF < f) {
      const ship = key === 'K3' ? kingShips[3] : key === 'E2' ? enemyShips[2] : enemyShips[1];
      ship.g.updateMatrixWorld(); _v.set(0, 0, 8.6); ship.g.localToWorld(_v);
      splashes.burst(_v.x, 0, _v.z, { n: 34, power: 7 });
    }
  }
  if (f === BURST_F && lastF < f) { // THE explosion
    smoke.burst(29, 3.5, 14.5, { n: 40, color: 0x2e2a26, scale: 4, opacity: 0.75, life: 3.6, vy: 3.2, grow: 3 });
    smoke.burst(29, 3, 14.5, { n: 18, color: 0x8a6a52, scale: 2.6, opacity: 0.6, life: 2.8, vy: 2.2 });
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.4; splashes.burst(29 + Math.cos(a) * (6 + k), 0, 14.5 + Math.sin(a) * (6 + k), { n: 22, power: 8 }); }
  }

  // --- balls / chips / debris / rings ---
  const balls = ballsAt(f);
  ballPool.forEach((m, i) => { const b = balls[i]; m.visible = !!b; if (b) m.position.set(...b.p); });
  for (const c of chipPool) {
    if (c.life < 0) continue;
    c.life += dt; if (c.life > 0.75 || dt === 0 && c.life > 0.75) { c.life = -1; c.m.visible = false; continue; }
    c.v[1] -= 12.5 * dt;
    c.m.position.x += c.v[0] * dt; c.m.position.y += c.v[1] * dt; c.m.position.z += c.v[2] * dt;
    c.m.rotation.x += c.rv[0] * dt; c.m.rotation.y += c.rv[1] * dt; c.m.rotation.z += c.rv[2] * dt;
    if (c.m.position.y < 0) { c.life = -1; c.m.visible = false; }
  }
  if (f < BURST_F) debrisFired.clear();
  debrisAt(f).forEach((d, i) => {
    const m = debrisMeshes[i]; if (!m) return;
    m.visible = !d.gone; m.position.set(...d.p); m.rotation.set(...d.rot);
    if (d.splashF === f && !debrisFired.has(i)) { debrisFired.add(i); splashes.burst(d.sx, 0, d.sz, { n: 16, power: 4.5 }); }
  });
  const ring = ringAt(f);
  ring1.visible = ring2.visible = !!ring;
  if (ring) { ring1.scale.set(ring.r, ring.r, 1); ring1.material.opacity = ring.a * 0.85; ring2.scale.set(ring.r * 0.94, ring.r * 0.94, 1); ring2.material.opacity = ring.a * 0.4; }
  flashSpr.visible = env.flash > 0.03;
  if (flashSpr.visible) { flashSpr.material.opacity = env.flash * 0.9; flashSpr.scale.setScalar(34 - env.flash * 12); }

  // --- fires & smoke emitters follow their ships ---
  const burnOn = f >= 1141 && f < 1528;
  const pA = poses.K[1].p, pB = poses.K[3].p;
  setFire(fireA, [pA[0], pA[1] + 2.6, pA[2]], burnOn);
  setFire(fireB, [pB[0], pB[1] + 2.6, pB[2]], burnOn);
  burnEmitA.on = burnEmitB.on = burnOn;
  burnEmitA.x = pA[0]; burnEmitA.y = pA[1] + 3.4; burnEmitA.z = pA[2];
  burnEmitB.x = pB[0]; burnEmitB.y = pB[1] + 3.4; burnEmitB.z = pB[2];
  setFire(fireBoom, [29.5, 2.2, 14.5], f >= BURST_F && f < BURST_F + 52);
  const wreckOn = f >= BURST_F + 10 && f < 1689; // victory: smoke has cleared
  wreckEmitA.on = wreckOn; wreckEmitB.on = wreckOn;
  wreckEmitA.x = poses.E[2].p[0]; wreckEmitA.y = 3; wreckEmitA.z = poses.E[2].p[2];
  wreckEmitB.x = poses.E[1].p[0]; wreckEmitB.y = 3; wreckEmitB.z = poses.E[1].p[2];
  if (f >= FUSE_START && f < BURST_F) { // the burning fuse crawls along the fireship's deck
    const u = (f - FUSE_START) / (BURST_F - FUSE_START);
    fireship.g.updateMatrixWorld();
    _v.set(-4.1 + u * 8, 2.8, 0); fireship.g.localToWorld(_v);
    setFire(fireFuse, [_v.x, _v.y, _v.z], true);
  } else setFire(fireFuse, null, false);

  // --- the bottle ---
  const bot = bottleAt(f);
  bottle.visible = !!bot;
  if (bot) {
    bottle.position.set(...bot.p);
    bottle.rotation.set(bot.tilt, bot.spin, bot.tilt * 0.7);
    bottle.userData.glint.material.opacity = 0.55 + 0.45 * Math.sin(t * 7);
  }

  // --- board ---
  const bd = boardAt(f);
  board.visible = !!bd && bd.alpha > 0.01;
  if (board.visible) {
    drawBoard(bd.text);
    board.material.opacity = bd.alpha;
    _v.set(...cam.look).sub(camera.position).normalize();
    board.position.copy(camera.position).addScaledVector(_v, 17); board.position.y += 3.6;
    board.lookAt(camera.position);
    const bw = 2 * 17 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * (1080 / 1920) * 0.92; // fit the board inside the portrait frame
    board.scale.set(bw / 11, bw / 11, 1);
  }

  // --- FX updates: EVERY frame, EVERY effect (animation gate) ---
  water.userData.update(t);
  smoke.update(t, dt);
  splashes.update(t, dt);
  wake.update(t, dt);
  clouds.update(t, dt);
  fireA.update(t, dt); fireB.update(t, dt); fireBoom.update(t, dt); fireFuse.update(t, dt);
  for (const m of muzzles) m.update(t);

  renderer.render(scene, camera);
  lastF = f;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
