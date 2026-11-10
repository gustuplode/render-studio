// "The Viking Raid at Dawn" — enhanced-batch Short (4/4). Demo only.
// three.js scene driven ENTIRELY by story.js frame math; fx.js pools add life.
// Contract (render.mjs): window.ready, window.renderFrame(f), canvas #c 1080x1920.
import * as THREE from 'three';
import * as FX from './fx.js';
import * as T from './toon.js';
import { idle, blinkAt, q } from './motion.js';
import {
  TOTAL, secAt, camAt, envAt, mistBankAt, FLEET, shipPoseAt, chiefSolesAt, chiefHeadAt,
  armUAt, warriorAt, runStartAt, bellAt, bellSwingAt, swingUAt, villagerAt, boardAt,
  GROUND_F, CHIEF_SEED, LAND_Y,
} from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 3000);
const rx = (a) => a * Math.PI / 180;
scene.fog = new THREE.Fog(0xc7b3aa, 16, 150);

// ---------- sky dome (house shader, same as pirate-gold) ----------
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
const hemi = new THREE.HemisphereLight(0xd9c4b4, 0x4c4a44, 0.78); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xe6c298, 1.5); scene.add(sun); scene.add(sun.target);
const lanternLight = new THREE.PointLight(0xffb45e, 0, 26, 1.7); lanternLight.position.set(19, 3.2, 0); scene.add(lanternLight);

// ---------- water + deep base ----------
const env0 = envAt(0);
const water = FX.makeWater({ size: 700, seg: 100, amp: 0.55, deep: new THREE.Color(...env0.deep).getHex(), shallow: new THREE.Color(...env0.shal).getHex(), sky: new THREE.Color(...env0.wsky).getHex() });
scene.add(water);
const basePlane = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshBasicMaterial({ color: 0x16211c, fog: true }));
basePlane.rotation.x = -Math.PI / 2; basePlane.position.y = -1.5; scene.add(basePlane);

// ---------- atmosphere pools ----------
const clouds = new FX.Clouds(scene, { count: 7, y: 30, opacity: 0.55, color: 0xcbb6ac });
clouds.group.traverse((o) => { if (o.isSprite) o.userData.op0 = o.material.opacity; });
function makeMistBand(n, xr, yr, zr, sScale) {
  const g = FX.mistBand(scene, { y: yr[0], opacity: 0.3, count: n });
  g.traverse((o) => {
    if (!o.isSprite) return;
    o.userData.f = 0.7 + Math.random() * 0.6;
    o.position.set(xr[0] + Math.random() * (xr[1] - xr[0]), yr[0] + Math.random() * (yr[1] - yr[0]), zr[0] + Math.random() * (zr[1] - zr[0]));
    o.scale.x *= sScale; o.scale.y *= 1.15;
  });
  scene.add(g); return g;
}
const seaMist = makeMistBand(10, [-125, 15], [0.8, 2.2], [-52, 32], 1.25);
const beachMist = makeMistBand(6, [-4, 22], [0.6, 1.7], [-30, 26], 0.9);
const villageMist = makeMistBand(6, [12, 48], [2.2, 3.6], [-26, 20], 0.9);
const smoke = new FX.Smoke(scene, 110);
const splashes = new FX.Splashes(scene, 300);
const wake = new FX.Wake(scene, 72);
const fire = new FX.Fire(scene, { max: 36, rate: 20, scale: 0.62, light: false });
fire.on = false;
const torchLight = new THREE.PointLight(0xff8c3a, 0, 10, 1.8); scene.add(torchLight);

// ---------- shared materials / helpers ----------
const lam = (o) => new THREE.MeshLambertMaterial(o);
const woodMat = (tint) => lam({ map: FX.woodTexture(), color: tint });
const darkWood = lam({ color: 0x4a3826 });
const goldMat = lam({ color: 0xd9a845, emissive: 0x694d10 });
const _v = new THREE.Vector3();
function waveSail(mesh, t) {
  FX.clothWave(mesh, t);
  const pos = mesh.geometry.attributes.position, belly = mesh.userData.belly;
  for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 2] += belly[i];
  pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
}
function makeSail(w, h, mat, segX = 10, segY = 8) {
  const geo = new THREE.PlaneGeometry(w, h, segX, segY);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 2;
  FX.clothInit(mesh, { amp: 0.13, freq: 2.2, speed: 5 });
  const base = mesh.userData.base, belly = new Float32Array(geo.attributes.position.count);
  for (let i = 0; i < belly.length; i++) {
    const bx = base[i * 3], by = base[i * 3 + 1];
    belly[i] = 0.34 * Math.sin(Math.PI * (bx / w + 0.5)) * Math.sin(Math.PI * (by / h + 0.5));
  }
  mesh.userData.belly = belly;
  return mesh;
}
// striped sail cloth: red / off-white vertical stripes (one shared texture)
const stripeTexC = document.createElement('canvas'); stripeTexC.width = 256; stripeTexC.height = 256;
{
  const g = stripeTexC.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e6dcc4' : '#a3352c'; g.fillRect(i * 32, 0, 32, 256); }
  g.fillStyle = 'rgba(60,40,20,0.16)'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * 256, 0, 2, 256);
  g.fillStyle = 'rgba(40,30,18,0.35)'; g.fillRect(0, 0, 256, 7); g.fillRect(0, 249, 256, 7);
}
const stripeTex = new THREE.CanvasTexture(stripeTexC); stripeTex.colorSpace = THREE.SRGBColorSpace;
const sailMat = lam({ map: stripeTex, side: THREE.DoubleSide });

// ---------- the longship builder ----------
const GEO = {
  hull: new THREE.BoxGeometry(11.5, 1.9, 3.1),
  bow: new THREE.CylinderGeometry(1.55, 1.55, 1.9, 12, 1, false, 0, Math.PI),
  stern: new THREE.CylinderGeometry(1.55, 1.55, 1.9, 12, 1, false, Math.PI, Math.PI),
  stripe: new THREE.BoxGeometry(11.65, 0.4, 3.2),
  deck: new THREE.BoxGeometry(11.6, 0.14, 2.9),
  fore: new THREE.BoxGeometry(2.4, 0.16, 2.7),
  post: new THREE.TorusGeometry(0.8, 0.13, 8, 12, Math.PI * 0.75),
  neck: new THREE.TorusGeometry(1.05, 0.15, 8, 14, Math.PI * 0.85),
  mast: new THREE.CylinderGeometry(0.09, 0.14, 6.4, 8),
  yard: new THREE.CylinderGeometry(0.06, 0.06, 5.6, 6),
  shield: new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14),
  boss: new THREE.SphereGeometry(0.13, 8, 6),
  oar: new THREE.CylinderGeometry(0.045, 0.06, 3.6, 6),
  head: new THREE.BoxGeometry(0.62, 0.38, 0.4),
  snout: new THREE.BoxGeometry(0.36, 0.2, 0.28),
  horn: new THREE.ConeGeometry(0.07, 0.52, 6),
  eye: new THREE.SphereGeometry(0.055, 6, 5),
};
GEO.oar.translate(0, -1.8, 0);
const shieldCols = [0xb03a2e, 0xe8e2d2, 0xd9a441, 0x3f5a7a];
const shieldMats = shieldCols.map((c) => lam({ color: c }));
function buildLongship(hero) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const hullMat = woodMat(hero ? 0x6d4a30 : 0x54402e);
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  add(GEO.hull, hullMat, 0, 1.15, 0);
  add(GEO.bow, hullMat, 5.75, 1.15, 0);
  add(GEO.stern, hullMat, -5.75, 1.15, 0);
  add(GEO.stripe, lam({ color: hero ? 0x8a2f2a : 0x5d5148 }), 0, 1.66, 0);
  add(GEO.deck, woodMat(0xc9a878), 0, 2.12, 0);
  add(GEO.fore, woodMat(0xb89468), 4.6, 2.27, 0);
  // upswept stern post (both kinds) + bow post / dragon neck
  const sternPost = add(GEO.post, darkWood, -6.6, 3.1, 0); sternPost.rotation.z = Math.PI * 0.78;
  const ship = { g, sails: [], hero };
  if (hero) {
    const neck = add(GEO.neck, darkWood, 6.35, 3.25, 0); neck.rotation.z = 0.55;
    const headG = new THREE.Group(); headG.position.set(7.5, 4.15, 0); headG.rotation.z = -0.35; headG.scale.setScalar(1.2); g.add(headG);
    const hm = woodMat(0x7a5636);
    const hd = new THREE.Mesh(GEO.head, hm); headG.add(hd);
    const sn = new THREE.Mesh(GEO.snout, hm); sn.position.set(0.44, -0.08, 0); headG.add(sn);
    for (const s of [-1, 1]) {
      const hn = new  THREE.Mesh(GEO.horn, lam({ color: 0xe8dcc0 })); hn.position.set(-0.18, 0.34, s * 0.13); hn.rotation.z = 0.7; hn.rotation.x = s * 0.35; headG.add(hn);
      const ey = new THREE.Mesh(GEO.eye, new THREE.MeshBasicMaterial({ color: 0xffe9a8 })); ey.position.set(0.16, 0.06, s * 0.215); headG.add(ey);
    }
    for (const [sx, sy] of [[6.95, 4.30], [6.37, 4.47], [5.79, 4.33]]) { const sp = new THREE.Mesh(GEO.horn, darkWood); sp.position.set(sx, sy, 0); sp.rotation.z = -0.35; g.add(sp); }
  } else {
    const bowPost = add(GEO.post, darkWood, 6.6, 3.1, 0); bowPost.rotation.z = -Math.PI * 0.35;
  }
  if (hero) { const cr = FX.crate(1.0); cr.position.set(-1.8, 2.69, -0.95); g.add(cr); const br = FX.barrel(0.5, 1.15); br.position.set(-3.0, 2.77, 0.9); g.add(br); }
  // mast + striped sail + pennant
  add(GEO.mast, darkWood, 0.5, 5.32, 0);
  const yard = add(GEO.yard, darkWood, 0.5, 7.55, 0); yard.rotation.x = Math.PI / 2;
  const sail = makeSail(5.2, 3.4, sailMat, hero ? 10 : 6, hero ? 8 : 5);
  sail.position.set(0.5, 5.78, 0); g.add(sail); ship.sails.push(sail);
  const flagGeo = new THREE.PlaneGeometry(1.5, 0.5, 8, 3); flagGeo.translate(-0.75, 0, 0);
  const flag = new THREE.Mesh(flagGeo, lam({ color: 0xa3352c, side: THREE.DoubleSide }));
  flag.position.set(0.5, 8.35, 0); FX.clothInit(flag, { amp: 0.3, freq: 3, speed: 8 });
  g.add(flag); ship.flag = flag;
  // shield discs along the rails
  const nSh = hero ? 8 : 5;
  for (const s of [-1, 1]) for (let k = 0; k < nSh; k++) {
    const sh = add(GEO.shield, shieldMats[(k + (s > 0 ? 1 : 0)) % 4], -4.2 + k * (8.4 / (nSh - 1)), 2.38, s * 1.62);
    sh.rotation.x = Math.PI / 2;
    if (hero) add(GEO.boss, goldMat, sh.position.x, 2.38, s * 1.68);
  }
  // oars (heroes only): two dipping banks, shipped at the landing
  if (hero) {
    ship.oars = [];
    for (const s of [-1, 1]) {
      const og = new THREE.Group(); og.position.set(0.2, 2.3, s * 1.45); g.add(og);
      for (let j = 0; j < 7; j++) {
        const o = new THREE.Mesh(GEO.oar, darkWood);
        o.position.set(-3.6 + j * 1.15, 0, 0); o.rotation.x = s > 0 ? -1.02 : 1.02;
        og.add(o);
      }
      ship.oars.push({ g: og, side: s });
    }
  }
  scene.add(g);
  return ship;
}
const ships = FLEET.map((slot) => buildLongship(slot.hero));

// ---------- land: beach + village ----------
{
  const sand = new THREE.Mesh(new THREE.BoxGeometry(15, 0.24, 150), lam({ color: 0x9a8a6a }));
  sand.position.set(4.5, 0.2, 0); scene.add(sand);
  const land = new THREE.Mesh(new THREE.BoxGeometry(96, 1.1, 150), lam({ color: 0x4d5c3e }));
  land.position.set(49.5, 0, 0); scene.add(land);
  const rockM = lam({ color: 0x5d6066 });
  for (let k = 0; k < 6; k++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + (k % 3) * 0.3), rockM); r.position.set(-1 + k * 2.3, 0.25, -14 + (k % 4) * 8.5); r.rotation.set(k, k * 2, k * 0.5); r.scale.y = 0.7; scene.add(r); }
  const hillM = lam({ color: 0x42503c });
  for (const [hx, hz, hr, hh] of [[50, -18, 13, 8], [54, 6, 15, 10], [49, 22, 11, 7], [58, -34, 14, 9]]) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(hr, hh, 9), hillM); hill.position.set(hx, LAND_Y + hh / 2 - 0.4, hz); scene.add(hill);
  }
  const tuftM = lam({ color: 0x44542f });
  for (let k = 0; k < 12; k++) { const tu = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 5), tuftM); tu.position.set(13 + (k * 7.3) % 26, LAND_Y + 0.24, -16 + (k * 11.7) % 34); scene.add(tu); }
}
// cottages + storehouse (FX wood, glass lantern windows, chimney smoke)
const cottagePos = [[16, -6, 0.3], [20, 7, -0.2], [22, -11, 0.15], [28, 4, 0.5], [33, -3, -0.3], [36, 9, 0.2]];
{
  const wallM = woodMat(0xa8895e), roofM = lam({ color: 0x6d5136 }), darkM = lam({ color: 0x2e241a });
  cottagePos.forEach(([cx, cz, ry], ci) => {
    const cg = new THREE.Group(); cg.position.set(cx, LAND_Y, cz); cg.rotation.y = ry; scene.add(cg);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.3, 3.0), wallM); walls.position.y = 1.15; cg.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.5, 4), roofM); roof.position.y = 3.05; roof.rotation.y = Math.PI / 4; roof.scale.set(1.18, 1, 1.02); cg.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.8), darkM); door.position.set(-1.72, 0.75, 0.2); cg.add(door);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72), FX.glassMat(0xffc46b, 0.75)); win.position.set(-1.73, 1.45, -0.85); win.rotation.y = -Math.PI / 2; cg.add(win);
    if (ci % 2 === 0) { const gl = FX.glint(0.85); gl.position.set(-1.85, 1.45, -0.85); cg.add(gl); }
    if (ci % 2 === 0) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.5), lam({ color: 0x7d7468 })); ch.position.set(0.8, 3.6, 0.3); cg.add(ch);
      smoke.addEmitter(cx + 0.8, LAND_Y + 4.2, cz + 0.3, { rate: 2.0, life: 3.6, scale: 1.1, opacity: 0.30, color: 0xa8a4a0, vy: 1.15 });
    }
  });
  const sh = new THREE.Group(); sh.position.set(31, LAND_Y, 9); sh.rotation.y = -0.35; scene.add(sh);
  const sw = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4.4), woodMat(0x8f7350)); sw.position.y = 1.5; sh.add(sw);
  const sr = new THREE.Mesh(new THREE.ConeGeometry(4.1, 1.7, 4), lam({ color: 0x5d4630 })); sr.position.y = 3.85; sr.rotation.y = Math.PI / 4; sr.scale.set(1.15, 1, 1.0); sh.add(sr);
  scene.add(sh);
  for (const [ox, oz, s] of [[28.2, 6.2, 1.15], [29.3, 5.4, 0.95], [28.6, 12.3, 1.05]]) { const cr = FX.crate(s); cr.position.set(ox, LAND_Y + s / 2, oz); scene.add(cr); }
  for (const [ox, oz] of [[33.8, 6.4], [34.6, 12.6]]) { const b = FX.barrel(); b.position.set(ox, LAND_Y + 0.75, oz); scene.add(b); }
}
// the church + open bell tower at (26,-7); the BELL itself is dynamic (story.bellAt)
let bellGroup, bellGlint;
{
  const stoneM = lam({ color: 0x8a8178 }), roofM = lam({ color: 0x54423a }), darkM = lam({ color: 0x2e241a });
  const church = new THREE.Group(); church.position.set(26, LAND_Y, -7); scene.add(church);
  const nave = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.0, 6.4), stoneM); nave.position.set(0, 1.5, 5.6); church.add(nave);
  const nRoof = new THREE.Mesh(new THREE.ConeGeometry(4.0, 1.9, 4), roofM); nRoof.position.set(0, 3.95, 5.6); nRoof.rotation.y = Math.PI / 4; nRoof.scale.set(1.05, 1, 1.45); church.add(nRoof);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2.7, 7.0, 2.7), stoneM); tower.position.set(0, 3.5, 0); church.add(tower);
  const arch = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.15), darkM); arch.position.set(-1.36, 5.4, 0); arch.rotation.y = Math.PI / 2; church.add(arch);
  for (const [px, pz] of [[-1.12, -1.12], [1.12, -1.12], [-1.12, 1.12], [1.12, 1.12]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.6, 0.24), stoneM); post.position.set(px, 8.3, pz); church.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 2.5), darkM); beam.position.set(0, 9.62, 0); church.add(beam);
  const tRoof = new THREE.Mesh(new THREE.ConeGeometry(2.35, 1.7, 4), roofM); tRoof.position.set(0, 10.55, 0); tRoof.rotation.y = Math.PI / 4; church.add(tRoof);
  const cWin = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), FX.glassMat(0xffc46b, 0.7)); cWin.position.set(-2.32, 1.6, 5.6); cWin.rotation.y = -Math.PI / 2; church.add(cWin);
  // the great golden bell: lathe profile, origin at its centre
  const pts = [];
  for (const [r, y] of [[0.0, 0.97], [0.12, 0.95], [0.34, 0.85], [0.44, 0.62], [0.52, 0.3], [0.63, 0.06], [0.66, 0.0]]) pts.push(new THREE.Vector2(r, y));
  const bellGeo = new THREE.LatheGeometry(pts, 18); bellGeo.translate(0, -0.48, 0);
  bellGroup = new THREE.Group();
  const bellMesh = new THREE.Mesh(bellGeo, goldMat); bellGroup.add(bellMesh);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), darkWood); clapper.position.y = -0.52; bellGroup.add(clapper);
  const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.13, 0.13), darkWood); hanger.position.y = 0.56; bellGroup.add(hanger);
  bellGroup.scale.setScalar(1.18);
  bellGlint = FX.glint(0.55); bellGlint.position.set(0.4, 0.15, 0.45); bellGroup.add(bellGlint);
  scene.add(bellGroup);
  // carry poles (visible only while the bell is carried / loaded)
  const poles = new THREE.Group();
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 7.2, 7), darkWood); p.rotation.z = Math.PI / 2; p.position.set(0, 0.18, s * 0.98); poles.add(p); }
  scene.add(poles); scene.userData.poles = poles;
}
// torches: two sticks that follow their bearers; ONE fire pool at the lead tip
const torchSticks = [];
for (let i = 0; i < 2; i++) {
  const tg = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.85, 6), darkWood); stick.rotation.z = 0.35; tg.add(stick);
  const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), lam({ color: 0x8a5a20, emissive: 0x903c00 })); wrap.position.set(0.15, 0.38, 0); tg.add(wrap);
  const gl = FX.glint(0.7); gl.material.color.set(0xffa040); gl.position.set(0.15, 0.45, 0); tg.add(gl);
  tg.userData.glint = gl; scene.add(tg); torchSticks.push(tg);
}

// ---------- CHARACTER CARDS (pirate kit port) ----------
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
const chiefCard = new Card();
const warriorCards = Array.from({ length: 8 }, () => new Card());
const villagerCards = Array.from({ length: 5 }, () => new Card());

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
function dropWake(pose, key, dt, stern) {
  const a = (wakeAcc.get(key) || 0) + dt; wakeAcc.set(key, a);
  if (a < 0.5) return; wakeAcc.set(key, 0);
  const fx = Math.cos(pose.ry), fz = -Math.sin(pose.ry);
  wake.drop(pose.p[0] - fx * stern, pose.p[2] - fz * stern, 1.9);
}
const splashFired = new Set();

window.renderFrame = (f) => {
  const t = f / 30;
  const dt = lastF < 0 ? 1 / 30 : Math.min(0.1, Math.max(0, (f - lastF) / 30));
  const sec = secAt(f), env = envAt(f);

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
  clouds.group.traverse((o) => { if (o.isSprite) { o.material.color.setRGB(...env.cloud); o.material.opacity = o.userData.op0 * (env.cop / 0.55); } });
  const mb = mistBankAt(f);
  seaMist.traverse((o) => { if (o.isSprite) o.material.opacity = (mb * 0.38 + env.mist * 0.16) * o.userData.f; });
  beachMist.traverse((o) => { if (o.isSprite) o.material.opacity = (mb * 0.26 + env.mist * 0.10) * o.userData.f; });
  villageMist.traverse((o) => { if (o.isSprite) o.material.opacity = (env.mist * 0.16 + mb * 0.06) * o.userData.f; });
  lanternLight.intensity = (sec.id === 'village' || sec.id === 'wake') ? 26 + 6 * Math.sin(t * 7.3) : 0;

  // --- ships ---
  const rowing = ['hook', 'village', 'reveal', 'chief', 'signal'].includes(sec.id);
  const poses = FLEET.map((_, i) => shipPoseAt(i, f));
  for (let i = 0; i < ships.length; i++) {
    const ship = ships[i], pose = poses[i];
    ship.g.visible = !pose.hidden;
    if (pose.hidden) continue;
    ship.g.position.set(...pose.p); ship.g.rotation.set(pose.roll, pose.ry, -pose.pitch);
    for (const s of ship.sails) waveSail(s, t + pose.p[0] * 0.05);
    FX.clothWave(ship.flag, t);
    if (ship.oars) {
      const show = rowing && pose.ground < 0.4;
      for (const o of ship.oars) {
        o.g.visible = show;
        if (show) { o.g.rotation.x = o.side * Math.sin(t * 2.3 + i) * 0.10; o.g.rotation.y = Math.sin(t * 2.3 - 0.6 + i) * 0.13; }
      }
    }
  }

  // --- grounding + leap splashes ---
  for (let i = 0; i < 3; i++) {
    if (f === GROUND_F[i] && lastF < f && !splashFired.has('g' + i)) {
      splashFired.add('g' + i);
      const bx = poses[i].p[0] + Math.cos(poses[i].ry) * 6.6, bz = poses[i].p[2] - Math.sin(poses[i].ry) * 6.6;
      splashes.burst(bx, 0.1, bz, { n: 70, power: 11 });
    }
    if (sec.id === 'landing' && poses[i].ground > 0.15 && poses[i].ground < 0.92 && f % 5 === 0 && lastF < f) {
      const bx = poses[i].p[0] + Math.cos(poses[i].ry) * 6.6, bz = poses[i].p[2] - Math.sin(poses[i].ry) * 6.6;
      splashes.burst(bx, 0.1, bz, { n: 9, power: 5 });
    }
  }
  for (let k = 0; k < 8; k++) {
    const s = Math.round(runStartAt(k));
    if (f === s && lastF < f && !splashFired.has('l' + k)) {
      splashFired.add('l' + k);
      const wp = warriorAt(k, f).p;
      splashes.burst(wp[0] + 0.8, 0.1, wp[2], { n: 24, power: 5.5 });
    }
  }
  if (sec.id === 'hook') splashFired.clear();

  // --- wakes while the fleet actually moves ---
  if (dt > 0) {
    for (let i = 0; i < 12; i++) {
      const moved = Math.abs(shipPoseAt(i, f).p[0] - shipPoseAt(i, Math.max(0, f - 10)).p[0]);
      if (moved > 0.25 && !(poses[i].ground > 0.5 && sec.id !== 'fog')) dropWake(poses[i], 'S' + i, dt, 6.9);
    }
  }

  // --- the bell + its poles ---
  const bell = bellAt(f);
  bellGroup.position.set(...bell);
  bellGroup.rotation.set(Math.sin(f * 0.21) * 0.07 * swingUAt(f), 0, bellSwingAt(f));
  bellGlint.material.opacity = 0.10 + 0.10 * swingUAt(f) + (sec.id === 'want' || sec.id === 'fog' ? 0.06 + 0.04 * Math.sin(t * 4.2) : 0);
  const poles = scene.userData.poles;
  const showPoles = sec.id === 'carry' || (sec.id === 'fog' && f < 1250 + 70);
  poles.visible = showPoles;
  if (showPoles) {
    const b2 = bellAt(Math.min(TOTAL - 1, f + 6));
    poles.position.set(bell[0], bell[1] + 0.62, bell[2]);
    poles.rotation.y = Math.atan2(-(b2[2] - bell[2]), b2[0] - bell[0]);
  }

  // --- character cards ---
  const cardTint = Math.min(1, 0.58 + 0.15 * env.sunI);
  const tintCard = (card) => card.mesh.material.color.setRGB(cardTint, cardTint * 0.985, cardTint * 0.96);
  // the chief
  {
    const expr = { hook: 'stern', reveal: 'stern', chief: sec.u > 0.7 ? 'grin' : 'stern', signal: 'stern', landing: 'stern', wake: 'grin', want: 'stern', carry: 'grin', fog: 'grin', village: 'stern' }[sec.id] || 'stern';
    const aU = armUAt(f);
    const R = sec.id === 'signal' && aU > 0.4 ? 'up' : sec.id === 'want' ? 'point' : (sec.id === 'hook' || sec.id === 'reveal' || sec.id === 'landing' || sec.id === 'wake' || sec.id === 'fog') ? 'hip' : 'hang';
    const soles = chiefSolesAt(f), solesPrev = chiefSolesAt(Math.max(0, f - 4));
    const spd = Math.hypot(soles[0] - solesPrev[0], soles[2] - solesPrev[2]) / 4;
    const step = spd > 0.012 && f > 700 ? q((f * 0.13) % 1, 1) : 0;
    const idl = idle(f, CHIEF_SEED), blink = blinkAt(f, CHIEF_SEED);
    const key = `CH|${expr}|${R}|${blink}|${q(idl.bob, 2)}|${Math.round(idl.tilt)}|${step}`;
    chiefCard.draw(key, (p) => T.romanFront(p, 'vikingChief', {
      seed: CHIEF_SEED, expr, R, L: sec.id === 'want' ? 'hip' : 'hang',
      blink, bob: q(idl.bob, 2), tilt: Math.round(idl.tilt), headTilt: Math.round(idle(f, 17).headTilt), wv: f * 0.18, step,
    }));
    chiefCard.place(soles[0], soles[1], soles[2], cam.pos, 1);
    tintCard(chiefCard);
  }
  // warriors
  for (let k = 0; k < 8; k++) {
    const w = warriorAt(k, f), card = warriorCards[k];
    if (w.mode === 'hidden') { card.hide(); continue; }
    const expr = w.mode === 'carry' ? 'grin' : w.mode === 'run' ? (k % 2 ? 'stern' : 'nervous') : (sec.id === 'want' || sec.id === 'landing') ? 'stern' : 'neutral';
    const arms = w.mode === 'carry' ? ['up', 'up'] : ['hang', 'hang'];
    const step = w.mode === 'run' ? q((f * 0.16 + k * 0.37) % 1, 1) : w.mode === 'carry' ? q((f * 0.07 + k * 0.2) % 1, 1) : 0;
    const idl = idle(f, 21 + k), blink = blinkAt(f, 21 + k);
    const bob = w.mode === 'run' ? q(0.02 * Math.sin(f * 0.9 + k * 2), 2) : q(idl.bob, 2);
    const key = `W${k}|${w.mode}|${expr}|${blink}|${bob}|${Math.round(idl.tilt)}|${step}`;
    card.draw(key, (p) => T.romanFront(p, k % 2 ? 'vikingB' : 'vikingA', {
      seed: 21 + k, expr, R: arms[0], L: arms[1],
      blink, bob, tilt: Math.round(idl.tilt), headTilt: Math.round(idle(f, 23 + k).headTilt), wv: f * 0.18, step,
    }));
    card.place(w.p[0], w.p[1], w.p[2], cam.pos, 0.98);
    tintCard(card);
  }
  // villagers: 1-2 sleepy in the village section, all flee in wake, watch after
  for (let k = 0; k < 5; k++) {
    const v = villagerAt(k, f), card = villagerCards[k];
    const show = sec.id === 'village' ? k < 2 : ['wake', 'want', 'carry', 'fog'].includes(sec.id);
    if (!show) { card.hide(); continue; }
    const expr = v.mode === 'flee' ? 'shock' : sec.id === 'village' ? 'neutral' : 'nervous';
    const step = v.mode === 'flee' ? q((f * 0.17 + k * 0.41) % 1, 1) : 0;
    const idl = idle(f, 31 + k), blink = blinkAt(f, 31 + k);
    const key = `V${k}|${v.mode}|${expr}|${blink}|${q(idl.bob, 2)}|${step}`;
    card.draw(key, (p) => T.romanFront(p, k % 2 ? 'villagerB' : 'villagerA', {
      seed: 31 + k, expr, R: 'hang', L: 'hang',
      blink, bob: q(idl.bob, 2), tilt: Math.round(idl.tilt), headTilt: Math.round(idle(f, 33 + k).headTilt), wv: f * 0.18, step,
    }));
    card.place(v.p[0], v.p[1], v.p[2], cam.pos, 0.96);
    tintCard(card);
  }
  // torches: bearers are the lead runners, then the two guards during carry
  {
    const bearers = sec.id === 'want' ? [6, 7] : [0, 1];
    const torchOn = ['landing', 'wake', 'want'].includes(sec.id);
    let leadTip = null;
    bearers.forEach((k, bi) => {
      const tg = torchSticks[bi], w = warriorAt(k, f);
      const on = torchOn && w.mode !== 'hidden';
      tg.visible = on;
      if (!on) return;
      tg.position.set(w.p[0] + 0.42, w.p[1] + 1.28, w.p[2] + 0.34);
      tg.rotation.y = Math.atan2(cam.pos[0] - tg.position.x, cam.pos[2] - tg.position.z);
      tg.userData.glint.material.opacity = 0.32 + 0.18 * Math.sin(t * 9 + bi * 2);
      if (bi === 0) leadTip = [tg.position.x + 0.15, tg.position.y + 0.5, tg.position.z];
    });
    fire.on = !!leadTip;
    if (leadTip) { fire.x = leadTip[0]; fire.y = leadTip[1]; fire.z = leadTip[2]; torchLight.position.set(leadTip[0], leadTip[1] + 0.4, leadTip[2]); torchLight.intensity = 3.5 + Math.sin(t * 11) * 0.8 + Math.sin(t * 23) * 0.5; }
    else torchLight.intensity = 0;
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
    const bw = 2 * 17 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * (1080 / 1920) * 0.92;
    board.scale.set(bw / 11, bw / 11, 1);
  }

  // --- FX updates: EVERY frame, EVERY effect (animation gate) ---
  water.userData.update(t);
  smoke.update(t, dt);
  splashes.update(t, dt);
  wake.update(t, dt);
  clouds.update(t, dt);
  fire.update(t, dt);

  renderer.render(scene, camera);
  lastF = f;
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
