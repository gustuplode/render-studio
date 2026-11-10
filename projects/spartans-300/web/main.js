// "300 Spartans vs 10,000" — batch-2 Short (3/8). Demo only.
// three.js scene driven ENTIRELY by story.js frame math; fx.js pools add life.
// Contract (render.mjs): window.ready, window.renderFrame(f), canvas #c 1080x1920.
import * as THREE from 'three';
import * as FX from './fx.js';
import * as T from './toon.js';
import { idle, blinkAt, q } from './motion.js';
import * as S from './story.js';

const { TOTAL, secAt, camAt, envAt } = S;
const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 3000);
const rx = (a) => a * Math.PI / 180;
scene.fog = new THREE.Fog(0xd9c2a4, 40, 430);

// ---------- sky dome (house shader, same as viking-raid) ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0.004 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .16*pow(max(s,0.), 42.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xe8dcc8, 0x5a4f42, 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd9a0, 1.6); scene.add(sun); scene.add(sun.target);
const torchLight = new THREE.PointLight(0xff9a40, 0, 30, 1.6); scene.add(torchLight);

// ---------- water (the south sea) + deep base ----------
const env0 = envAt(0);
const water = FX.makeWater({ size: 900, seg: 100, amp: 0.38, deep: new THREE.Color(...env0.deep).getHex(), shallow: new THREE.Color(...env0.shal).getHex(), sky: new THREE.Color(...env0.wsky).getHex() });
water.position.set(40, -0.62, 60); scene.add(water); // crests (-0.62+0.38) stay below the y=0 ground — no water poking through the plain
const basePlane = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ color: 0x2a2018, fog: true }));
basePlane.rotation.x = -Math.PI / 2; basePlane.position.set(30, -1.6, 40); scene.add(basePlane);

// ---------- atmosphere pools ----------
const clouds = new FX.Clouds(scene, { count: 8, y: 52, opacity: 0.5, color: 0xe8d9c4 });
clouds.group.traverse((o) => { if (o.isSprite) o.userData.op0 = o.material.opacity; });
function makeMistBand(n, xr, yr, zr, sScale) {
  const g = FX.mistBand(scene, { y: yr[0], opacity: 0.3, count: n });
  g.traverse((o) => {
    if (!o.isSprite) return;
    o.userData.f = 0.7 + (Math.sin(o.id * 12.9) * 0.5 + 0.5) * 0.6;
    o.position.set(xr[0] + (o.id * 37.7) % (xr[1] - xr[0]), yr[0] + (o.id * 13.3) % (yr[1] - yr[0]), zr[0] + (o.id * 23.9) % (zr[1] - zr[0]));
    o.scale.x *= sScale; o.scale.y *= 1.15;
  });
  scene.add(g); return g;
}
const seaMist = makeMistBand(9, [-80, 120], [0.7, 2.0], [14, 55], 1.3);
const dust = new FX.Smoke(scene, 130);
const splashes = new FX.Splashes(scene, 240);
const fireA = new FX.Fire(scene, { max: 30, rate: 22, scale: 0.85, light: false }); fireA.on = false;
const fireB = new FX.Fire(scene, { max: 30, rate: 22, scale: 0.85, light: false }); fireB.on = false;
const fireC = new FX.Fire(scene, { max: 24, rate: 20, scale: 0.85, light: false }); fireC.on = false;
// dust haze emitters over the Persian plain (lit during the day sections)
const dustEmit1 = dust.addEmitter(70, 1.2, -50, { rate: 2.6, life: 3.8, scale: 2.6, opacity: 0.10, color: 0xcbb28a, vy: 0.7 });
const dustEmit2 = dust.addEmitter(110, 1.2, -95, { rate: 2.2, life: 4.2, scale: 3.0, opacity: 0.09, color: 0xcbb28a, vy: 0.6 });

// ---------- terrain: dust plain, shore, cliff ridge, mountains ----------
const lam = (o) => new THREE.MeshLambertMaterial(o);
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 760), lam({ color: 0xb39b6d }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(30, 0, -372); scene.add(ground); // z: -752..8 — land continues behind the mountains
  const sand = new THREE.Mesh(new THREE.BoxGeometry(1100, 0.5, 15), lam({ color: 0xcbb287 }));
  sand.position.set(30, -0.13, 13.5); scene.add(sand); // shore strip, top y=0.12, z 6..21
  const rockM = lam({ color: 0x6e625a }), rockM2 = lam({ color: 0x7d6f60 });
  // the ridge west of x=34: big rock masses along z=-13..-30
  const ridge = [[-140, -16, 30, 15, 22], [-105, -18, 34, 17, 26], [-70, -15, 30, 14, 20], [-38, -17, 32, 16, 24], [-8, -16, 30, 15, 21], [20, -17, 26, 15, 19]];
  ridge.forEach(([x, z, w, d, h], k) => {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), k % 2 ? rockM : rockM2);
    r.scale.set(w / 2, h, d / 2); r.position.set(x, h * 0.32, z); r.rotation.set(k * 1.3, k * 2.1, k * 0.7); scene.add(r);
  });
  // nearer shoulder rocks framing the gap (leave z -8.. free at the block)
  for (const [x, z, s] of [[-26, -10.5, 5.5], [-16, -10, 4.2], [16, -10.5, 4.8], [24, -10, 3.8], [-40, -11, 6.5], [33, -11, 5.2]]) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockM2);
    r.scale.set(s, s * 0.8, s * 0.7); r.position.set(x, s * 0.25, z); r.rotation.set(x, z, x * 2); scene.add(r);
  }
  // goat-path ledges on the ridge face (torches stand on these)
  const ledgeM = lam({ color: 0x8a7965 });
  for (const [x, y, len] of [[32, 11.6, 36], [2, 12.4, 30], [-26, 11.9, 26]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(len, 0.7, 2.6), ledgeM);
    l.position.set(x, y, -6.9); scene.add(l);
  }
  // Leonidas' boulder
  const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockM);
  boulder.scale.set(1.9, 1.15, 1.6); boulder.position.set(S.ROCK[0], 0.28, S.ROCK[2]); boulder.rotation.set(0.4, 1.1, 0.2); scene.add(boulder);
  const cmdrRock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockM2);
  cmdrRock.scale.set(3.4, 2.6, 2.8); cmdrRock.position.set(30, 0.9, -18); cmdrRock.rotation.set(0.2, 0.7, 0.5); scene.add(cmdrRock);
  // far mountains (north) + east hills
  const mtnM = lam({ color: 0x8d8276 });
  for (const [x, z, r, h] of [[-90, -120, 55, 52], [-10, -140, 70, 64], [80, -130, 60, 55], [170, -110, 55, 44], [-180, -110, 60, 48], [240, -60, 50, 30], [250, 10, 46, 22]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mtnM); m.position.set(x, h / 2 - 2, z); scene.add(m);
  }
  // scrub tufts on the plain
  const tuftM = lam({ color: 0x77803f });
  for (let k = 0; k < 26; k++) { const tu = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 5), tuftM); tu.position.set(-60 + (k * 37.3) % 240, 0.26, -6 - (k * 13.7) % 130); if (tu.position.z > -9 && tu.position.x < 40) tu.position.z = -20 - (k % 8); scene.add(tu); }
}

// ---------- geometry merge helper (vertex-coloured parts -> one geometry) ----------
function mergeParts(parts) {
  let vTotal = 0, iTotal = 0;
  const prepped = parts.map(({ geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, color }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)); m.setPosition(x, y, z);
    g.applyMatrix4(m);
    vTotal += g.attributes.position.count; iTotal += g.attributes.position.count;
    return { g, color: new THREE.Color(color) };
  });
  const pos = new Float32Array(vTotal * 3), nor = new Float32Array(vTotal * 3), col = new Float32Array(vTotal * 3);
  let o = 0;
  for (const { g, color } of prepped) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.position.array ? g.attributes.normal.array : [], o * 3);
    for (let i = 0; i < n; i++) { col[(o + i) * 3] = color.r; col[(o + i) * 3 + 1] = color.g; col[(o + i) * 3 + 2] = color.b; }
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

// ---------- THE PERSIAN SEA: one InstancedMesh, exactly 10,000 ----------
const persianGeo = mergeParts([
  { geo: new THREE.BoxGeometry(0.20, 0.78, 0.36), y: 0.39, color: 0x77603f },                 // trousers
  { geo: new THREE.BoxGeometry(0.27, 0.68, 0.50), y: 1.12, color: 0xffffff },                 // tunic (instance-tinted)
  { geo: new THREE.SphereGeometry(0.115, 5, 4), y: 1.62, color: 0xd9a075 },                   // head
  { geo: new THREE.BoxGeometry(0.05, 0.85, 0.56), x: -0.25, y: 1.06, color: 0xb08d4f },        // wicker shield
  { geo: new THREE.CylinderGeometry(0.016, 0.016, 2.4, 5), x: 0.05, y: 1.60, z: 0.31, color: 0x6d4a2a }, // spear
]);
const persianMesh = new THREE.InstancedMesh(persianGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), S.PERSIAN_FORM.length);
persianMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
persianMesh.frustumCulled = false;
{
  const tints = [[1.0, 0.88, 0.62], [1.02, 0.98, 0.86], [0.82, 0.66, 0.95], [1.0, 0.72, 0.52], [0.66, 0.85, 0.82], [0.95, 0.8, 0.9]];
  const c = new THREE.Color();
  for (let i = 0; i < S.PERSIAN_FORM.length; i++) {
    const t = tints[i % tints.length], v = 0.88 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.22;
    c.setRGB(Math.min(1, t[0] * v), Math.min(1, t[1] * v), Math.min(1, t[2] * v));
    persianMesh.setColorAt(i, c);
  }
  persianMesh.instanceColor.needsUpdate = true;
}
scene.add(persianMesh);
// the other Greeks: same body plan, blue-grey coats — a separate small crowd (not Spartans)
const allyMesh = new THREE.InstancedMesh(persianGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), S.ALLY_N);
allyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); allyMesh.frustumCulled = false;
{
  const c = new THREE.Color();
  for (let k = 0; k < S.ALLY_N; k++) { c.setRGB(0.62, 0.7, 0.85); allyMesh.setColorAt(k, c); }
  allyMesh.instanceColor.needsUpdate = true;
}
scene.add(allyMesh);

// ---------- THE 300: part-instanced Spartans (bronze + red) ----------
function partMesh(geo, color, n) {
  const m = new THREE.InstancedMesh(geo, lam({ color }), n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); return m;
}
const SP_N = S.SPARTAN_FORM.length;
const spLegs = partMesh(new THREE.BoxGeometry(0.34, 0.74, 0.21).translate(0, 0.37, 0), 0x8a6526, SP_N);
const spSkirt = partMesh(new THREE.BoxGeometry(0.52, 0.36, 0.31).translate(0, 0.90, 0), 0xa02318, SP_N);
const spTorso = partMesh(new THREE.BoxGeometry(0.50, 0.62, 0.28).translate(0, 1.36, 0), 0xb08a3e, SP_N);
const spHead = partMesh(new THREE.SphereGeometry(0.115, 7, 6).translate(0, 1.90, 0), 0xeec39a, SP_N);
const spHelm = partMesh(new THREE.SphereGeometry(0.138, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.58).translate(0, 1.92, 0), 0xb08a3e, SP_N);
const spCrest = partMesh(new THREE.BoxGeometry(0.05, 0.17, 0.38).translate(0, 2.12, 0), 0xc22f2e, SP_N);
const spShieldGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.05, 12); spShieldGeo.rotateX(Math.PI / 2);
const spShield = partMesh(spShieldGeo, 0xa8232a, SP_N);
const spSpearGeo = new THREE.CylinderGeometry(0.016, 0.016, 2.5, 5); spSpearGeo.translate(0.31, 1.55, 0.05);
const spSpear = partMesh(spSpearGeo, 0x6d4a2a, SP_N);
const SP_PARTS = [spLegs, spSkirt, spTorso, spHead, spHelm, spCrest, spSpear];
const dummy = new THREE.Object3D();
dummy.rotation.order = 'YXZ'; // yaw first, then the shield's roof-tilt around the yawed X axis

// ---------- ARROWS: 540 instanced shafts ----------
const arrowGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.92, 5); arrowGeo.translate(0, 0.1, 0);
const arrowMesh = new THREE.InstancedMesh(arrowGeo, lam({ color: 0x54402a }), S.ARROW_N);
arrowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); arrowMesh.frustumCulled = false;
scene.add(arrowMesh);
const UP = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3();

// ---------- goat-path torches ----------
const torchSticks = S.TORCH_PTS.map((pt) => {
  const tg = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.9, 6), lam({ color: 0x4a3826 })); stick.rotation.z = 0.3; tg.add(stick);
  const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), lam({ color: 0x8a5a20, emissive: 0xa04a00 })); wrap.position.set(0.14, 0.4, 0); tg.add(wrap);
  const gl = FX.glint(0.8); gl.material.color.set(0xffa040); gl.position.set(0.14, 0.48, 0); tg.add(gl);
  tg.position.set(pt[0], pt[1], pt[2]); tg.userData.glint = gl; scene.add(tg); return tg;
});

// ---------- CHARACTER CARDS (house kit port) ----------
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
  hide() { this.mesh.visible = this.blob.visible = false; }
}
const leoCard = new Card(), dieCard = new Card(), cmdrCard = new Card();
const swarCards = [new Card(), new Card()], psolCards = [new Card(), new Card()];

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

// shield glints for the sunrise finale (front rank centres)
const shieldGlints = [];
for (let k = 0; k < 6; k++) { const gl = FX.glint(0.85); gl.material.color.set(0xffe9a8); scene.add(gl); shieldGlints.push(gl); }

// ---------- per-frame ----------
let lastF = -1;
const firedFx = new Set();
window.renderFrame = (f) => {
  const t = f / 30;
  const dt = lastF < 0 ? 1 / 30 : Math.min(0.1, Math.max(0, (f - lastF) / 30));
  const sec = secAt(f), env = envAt(f);
  const shadeK = 1 - 0.45 * env.shade;

  // --- environment ---
  skyU.top.value.setRGB(...env.top); skyU.hor.value.setRGB(...env.hor); skyU.sunCol.value.setRGB(...env.sun);
  skyU.sunSize.value = env.sunS;
  scene.fog.color.setRGB(...env.fog); scene.fog.near = env.fn; scene.fog.far = env.ff;
  hemi.color.setRGB(...env.hSky); hemi.groundColor.setRGB(...env.hGnd); hemi.intensity = env.hemi * shadeK;
  sun.color.setRGB(...env.sun); sun.intensity = env.sunI * shadeK;
  const cam = camAt(f);
  camera.position.set(...cam.pos); camera.up.set(0, 1, 0); camera.lookAt(...cam.look); camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const sunDir = new THREE.Vector3(Math.cos(rx(env.el)) * Math.cos(rx(env.az)), Math.sin(rx(env.el)), Math.cos(rx(env.el)) * Math.sin(rx(env.az))).normalize();
  skyU.sunDir.value.copy(sunDir);
  sun.position.set(cam.look[0] + sunDir.x * 140, sunDir.y * 140 + 10, cam.look[2] + sunDir.z * 140);
  sun.target.position.set(...cam.look);
  sky.position.copy(camera.position);
  water.material.uniforms.uDeep.value.setRGB(...env.deep);
  water.material.uniforms.uShallow.value.setRGB(...env.shal);
  water.material.uniforms.uSky.value.setRGB(...env.wsky);
  water.material.uniforms.uSun.value.copy(sunDir);
  basePlane.material.color.setRGB(env.deep[0] * 0.5, env.deep[1] * 0.5, env.deep[2] * 0.55);
  clouds.group.traverse((o) => { if (o.isSprite) { o.material.color.setRGB(...env.cloud); o.material.opacity = o.userData.op0 * (env.cop / 0.5) * (1 - 0.35 * env.shade); } });
  seaMist.traverse((o) => { if (o.isSprite) o.material.opacity = (0.05 + env.mist * 0.5) * o.userData.f; });
  dustEmit1.on = dustEmit2.on = ['persians', 'arrows', 'wall', 'waves'].includes(sec.id);

  // --- the 300 ---
  const up0 = S.shieldUpAt(f);
  for (let i = 0; i < SP_N; i++) {
    const sp = S.spartanPosAt(i, f);
    dummy.rotation.set(0, Math.PI / 2, 0); dummy.position.set(sp.p[0], sp.p[1], sp.p[2]); dummy.scale.setScalar(1);
    dummy.updateMatrix();
    for (const part of SP_PARTS) part.setMatrixAt(i, dummy.matrix);
    const upI = Math.max(0, Math.min(1, up0 * 1.25 - (i % 5) * 0.05));
    dummy.position.set(sp.p[0] + 0.16 - 0.10 * upI, sp.p[1] + 1.30 + 0.72 * upI, sp.p[2] + 0.30 - 0.28 * upI);
    dummy.rotation.set(-0.85 * upI, Math.PI / 2, 0); dummy.updateMatrix();
    spShield.setMatrixAt(i, dummy.matrix);
  }
  for (const part of SP_PARTS) part.instanceMatrix.needsUpdate = true;
  spShield.instanceMatrix.needsUpdate = true;

  // --- the 10,000 (direct matrix writes; the figure geometry faces -x) ---
  {
    const arr = persianMesh.instanceMatrix.array;
    for (let i = 0; i < S.PERSIAN_FORM.length; i++) {
      const pp = S.persianPosAt(i, f), o = i * 16;
      arr[o] = 1; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0;
      arr[o + 4] = 0; arr[o + 5] = 1; arr[o + 6] = 0; arr[o + 7] = 0;
      arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = 1; arr[o + 11] = 0;
      arr[o + 12] = pp.p[0]; arr[o + 13] = pp.p[1]; arr[o + 14] = pp.p[2]; arr[o + 15] = 1;
    }
    persianMesh.instanceMatrix.needsUpdate = true;
  }
  // --- the other Greeks (visible only while they are sent home) ---
  {
    const show = sec.id === 'choice' || sec.id === 'finale';
    allyMesh.visible = show;
    if (show) {
      const arr = allyMesh.instanceMatrix.array;
      for (let k = 0; k < S.ALLY_N; k++) {
        const ap = S.allyPosAt(k, f), o = k * 16;
        arr[o] = 1; arr[o + 5] = 1; arr[o + 10] = 1; arr[o + 15] = 1;
        arr[o + 1] = arr[o + 2] = arr[o + 3] = arr[o + 4] = arr[o + 6] = arr[o + 7] = arr[o + 8] = arr[o + 9] = arr[o + 11] = 0;
        arr[o + 12] = ap.p[0]; arr[o + 13] = ap.p[1]; arr[o + 14] = ap.p[2];
      }
      allyMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // --- arrows ---
  for (let k = 0; k < S.ARROW_N; k++) {
    const a = S.arrowAt(k, f);
    if (a.u < 0 || a.u > 1.5) { dummy.position.set(0, -99, 0); dummy.scale.setScalar(0.001); dummy.rotation.set(0, 0, 0); }
    else {
      dummy.position.set(a.p[0], a.p[1], a.p[2]); dummy.scale.setScalar(1);
      if (a.landed) _dir.set(-0.45, -0.75, 0).normalize();
      else {
        const b = S.arrowAt(k, Math.min(TOTAL - 1, f + 2));
        _dir.set(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]);
        if (_dir.lengthSq() < 1e-8) _dir.set(-0.45, -0.75, 0); else _dir.normalize();
      }
      dummy.quaternion.setFromUnitVectors(UP, _dir);
    }
    dummy.updateMatrix(); arrowMesh.setMatrixAt(k, dummy.matrix);
    dummy.quaternion.identity();
  }
  arrowMesh.instanceMatrix.needsUpdate = true;
  // dust ticks where arrows land on the shield wall
  if (lastF < f && (sec.id === 'arrows' || sec.id === 'shade')) {
    for (let k = 0; k < S.ARROW_N; k += 7) {
      if (S.arrowLandFrame(k) === f && !firedFx.has('a' + k)) {
        firedFx.add('a' + k);
        const a = S.arrowAt(k, f);
        dust.spawn(a.p[0], 1.3, a.p[2], { n: 1, life: 0.7, scale: 0.5, grow: 1.2, opacity: 0.5, color: 0xd8c49a, vy: 0.8 });
      }
    }
  }
  if (sec.id === 'hook') firedFx.clear();
  // wall dust while the push is on
  if (lastF < f && f % 6 === 0 && (sec.id === 'wall' || sec.id === 'waves')) {
    const fx = S.FRONT_X + S.pushXAt(f) + 1.6, fz = -4.5 + ((f * 7) % 90) / 10;
    dust.burst(fx, 0.5, fz, { n: 3, life: 1.4, scale: 1.1, grow: 2.0, opacity: 0.34, color: 0xcbb28a, vy: 1.2 });
  }
  // shore wash
  if (lastF < f && f % 53 === 0) {
    const sx = -30 + ((f * 29) % 120);
    splashes.burst(sx, 0.05, 10.5, { n: 12, power: 3.5 });
  }

  // --- torches on the goat path ---
  const lit = S.torchLitAt(f);
  torchSticks.forEach((tg, k) => {
    tg.visible = lit > 0.02;
    if (tg.visible) tg.userData.glint.material.opacity = lit * (0.3 + 0.16 * Math.sin(t * 9 + k * 2.1));
  });
  const tA = S.TORCH_PTS[1], tB = S.TORCH_PTS[4], tC = S.TORCH_PTS[7];
  fireA.on = fireB.on = fireC.on = lit > 0.4;
  if (fireA.on) { fireA.x = tA[0]; fireA.y = tA[1] + 0.55; fireA.z = tA[2]; fireB.x = tB[0]; fireB.y = tB[1] + 0.55; fireB.z = tB[2]; fireC.x = tC[0]; fireC.y = tC[1] + 0.55; fireC.z = tC[2]; torchLight.position.set(S.TORCH_PTS[4][0], S.TORCH_PTS[4][1] + 1, S.TORCH_PTS[4][2]); torchLight.intensity = 14 * lit; }
  else torchLight.intensity = 0;

  // --- character cards ---
  const cardTint = Math.min(1, 0.55 + 0.16 * env.sunI) * (1 - 0.3 * env.shade);
  const tintCard = (card) => card.mesh.material.color.setRGB(cardTint, cardTint * 0.985, cardTint * 0.96);
  const drawCard = (card, outfit, seed, expr, R, L, f, extra = {}) => {
    const idl = idle(f, seed), blink = blinkAt(f, seed);
    const key = `${outfit}|${expr}|${R}|${L}|${blink}|${q(idl.bob, 2)}|${Math.round(idl.tilt)}|${extra.step || 0}`;
    card.draw(key, (p) => T.romanFront(p, outfit, {
      seed, expr, R, L, blink, bob: q(idl.bob, 2), tilt: Math.round(idl.tilt),
      headTilt: Math.round(idle(f, seed + 2).headTilt), wv: f * 0.18, step: extra.step || 0,
    }));
    tintCard(card);
  };
  { // Leonidas
    const lp = S.leonidasAt(f);
    const expr = sec.id === 'leonidas' && sec.u > 0.55 ? 'grin' : sec.id === 'shade' || sec.id === 'finale' ? 'grin' : sec.id === 'choice' ? 'neutral' : 'stern';
    const R = sec.id === 'leonidas' && sec.u < 0.55 ? 'point' : ['wall', 'waves', 'choice', 'finale'].includes(sec.id) ? 'spear' : 'hip';
    drawCard(leoCard, 'leonidas', S.LEONIDAS_SEED, expr, R, 'shield', f);
    leoCard.place(lp.p[0], lp.p[1], lp.p[2], cam.pos, 1);
  }
  { // Dienekes — the laughing Spartan
    const show = ['arrows', 'shade', 'wall', 'waves'].includes(sec.id);
    if (!show) dieCard.hide();
    else {
      const dp = S.dienekesAt(f);
      drawCard(dieCard, 'spartan', S.DIENEKES_SEED, dp.mode === 'laugh' ? 'laugh' : 'stern', dp.mode === 'laugh' ? 'hip' : 'spear', 'shield', f);
      dieCard.place(dp.p[0], dp.p[1], dp.p[2], cam.pos, 0.99);
    }
  }
  { // the Persian commander on his rise
    const show = ['persians', 'arrows', 'shade', 'wall'].includes(sec.id);
    if (!show) cmdrCard.hide();
    else {
      const cp = S.cmdrAt(f);
      const expr = sec.id === 'arrows' ? 'stern' : sec.id === 'shade' ? 'shock' : 'nervous';
      drawCard(cmdrCard, 'persianCmd', S.CMDR_SEED, expr, sec.id === 'arrows' ? 'point' : 'hip', 'hang', f);
      cmdrCard.place(cp.p[0], cp.p[1], cp.p[2], cam.pos, 1);
    }
  }
  for (let k = 0; k < 2; k++) { // Spartan warriors flanking Leonidas
    const show = ['leonidas', 'persians', 'wall', 'waves', 'choice', 'finale'].includes(sec.id);
    const card = swarCards[k];
    if (!show) { card.hide(); continue; }
    const wp = S.swarriorAt(k, f);
    drawCard(card, 'spartan', k === 0 ? 11 : 13, 'stern', 'spear', 'shield', f);
    card.place(wp.p[0], wp.p[1], wp.p[2], cam.pos, 0.98);
  }
  for (let k = 0; k < 2; k++) { // Persian front-rank soldiers (real formation slots)
    const show = sec.id === 'wall' || sec.id === 'waves';
    const card = psolCards[k];
    if (!show) { card.hide(); continue; }
    const pp = S.psoldierAt(k, f);
    drawCard(card, k === 0 ? 'persianA' : 'persianB', k === 0 ? 29 : 31, sec.id === 'waves' ? 'shock' : 'nervous', 'spear', 'hang', f);
    card.place(pp.p[0], pp.p[1], pp.p[2], cam.pos, 0.98);
  }
  // sunrise glints on the front-rank shields
  {
    const glintU = sec.id === 'finale' ? 0.25 + 0.75 * sec.u : 0;
    shieldGlints.forEach((gl, k) => {
      const sp = S.spartanPosAt(k * 2 + 1, f).p;
      gl.visible = glintU > 0.01;
      gl.position.set(sp[0] + 0.35, 1.45, sp[2] + 0.1);
      gl.material.opacity = glintU * (0.35 + 0.3 * Math.sin(t * 3.1 + k * 1.7));
      const s = 0.7 + 0.3 * Math.sin(t * 2.3 + k);
      gl.scale.set(s, s, 1);
    });
  }

  // --- board ---
  const bd = S.boardAt(f);
  board.visible = !!bd && bd.alpha > 0.01;
  if (board.visible) {
    drawBoard(bd.text);
    board.material.opacity = bd.alpha;
    const _v = new THREE.Vector3(...cam.look).sub(camera.position).normalize();
    board.position.copy(camera.position).addScaledVector(_v, 17); board.position.y += 3.6;
    board.lookAt(camera.position);
    const bw = 2 * 17 * Math.tan(rx(cam.fov) / 2) * (1080 / 1920) * 0.92;
    board.scale.set(bw / 11, bw / 11, 1);
  }

  // --- FX updates: EVERY frame, EVERY effect (animation gate) ---
  water.userData.update(t);
  dust.update(t, dt);
  splashes.update(t, dt);
  clouds.update(t, dt);
  fireA.update(t, dt);
  fireB.update(t, dt);
  fireC.update(t, dt);

  renderer.render(scene, camera);
  lastF = f;
  return true;
};
window.TOTAL = TOTAL;
window.COUNTS = { spartans: S.SPARTAN_FORM.length, persians: S.PERSIAN_FORM.length, arrows: S.ARROW_N };
window.__api = S;
window.ready = true;
