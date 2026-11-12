// "THE NAZI GOLD TRAIN — THE TREASURE THAT VANISHED" — three.js valley: a night train runs
// into a mountain tunnel under a castle; diorama cutaway on the mountain face; 70 years of
// hunters; a flooded adit + a whispered secret; radar finds a train shape; a camera pod
// descends a borehole to a huge dark shape with one gold wink. All motion from story.js.
import * as THREE from 'three';
import * as S from './story.js';
import * as FX from './fx.js';
import * as T from './toon.js';
import { grass, dirt, stone, tex, planks } from './paint.js';
import { clamp, lerp, M, breathe, walkCycle2, landSquash, jumpArc, gust, Spring2 } from './motion.js';
// v2: deterministic construction — every FX module that scatters particles at build
// time (Clouds/Rain/Ambience/Smoke jitter) draws from this seeded PRNG, so every
// render chunk on every machine builds the IDENTICAL world.
let _seed = 987654321;
Math.random = () => { _seed = (_seed * 16807) % 2147483647; return _seed / 2147483647; };

const cv = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1080, 1920); renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// v3: PMREM environment — v3 metal materials (gold!) reflect it, so their sheen
// band MOVES with the camera instead of glowing flat. Deliberately NOT set as
// scene.environment: only gold/steel/brass carry it, so the night grade is untouched.
const envTex = FX.detailEnv(renderer);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1080 / 1920, 0.1, 2400);
scene.fog = new THREE.Fog(0x141e30, 80, 330);
const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x2c3444, 0.3); scene.add(hemi);
const amb = new THREE.AmbientLight(0xffffff, 0.34); scene.add(amb);
const sun = new THREE.DirectionalLight(0xbcd2ff, 0.55); scene.add(sun); scene.add(sun.target);

// gradient sky dome (knights pattern)
const bgC = document.createElement('canvas'); bgC.width = 4; bgC.height = 512;
const bgTex = new THREE.CanvasTexture(bgC); bgTex.colorSpace = THREE.SRGBColorSpace;
const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 24, 16), new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
let lastSkyKey = '';
function paintSky(top, hor) {
  const key = top + hor; if (key === lastSkyKey) return; lastSkyKey = key;
  const g = bgC.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, top); gr.addColorStop(0.55, top); gr.addColorStop(0.78, hor); gr.addColorStop(1, hor);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512); bgTex.needsUpdate = true;
}
// stars + moon (night)
const starMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false });
{
  const n = 380, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = (i * 2.399) % (Math.PI * 2), e = 0.25 + ((i * 37) % 60) / 100, r = 1000; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, starMat); stars.frustumCulled = false; scene.add(stars);
}
const moon = FX.glint(9); moon.material.color.set(0xe8eeff); moon.position.set(-420, 330, -500); scene.add(moon);

// ---------- helpers ----------
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...o });
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const dummy = new THREE.Object3D();
function mergeGeos(parts) {
  const gs = parts.map(({ geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
    g.applyMatrix4(m); return g;
  });
  const n = gs.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o3 = 0, o2 = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o3); nor.set(g.attributes.normal.array, o3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o2); o3 += g.attributes.position.count * 3; o2 += g.attributes.position.count * 2; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
const blobTexC = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(20,16,8,0.42)'); gr.addColorStop(1, 'rgba(20,16,8,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
function blob(x, z, s = 2.4, parent = scene) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: blobTexC, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.renderOrder = 1; parent.add(m); return m; }
const h1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- ground, rail, valley ----------
{
  // ground in pieces, leaving TWO real holes: borehole pit (x 44..60, z 70..86)
  // and the flooded adit interior (x -22..-2, z 140..186)
  const grassMat = (w, d) => new THREE.MeshStandardMaterial({ map: tex(grass(6), Math.max(1, Math.round(w / 32)), Math.max(1, Math.round(d / 32))), roughness: 1 });
  const gnd = (w, d, cx, cz) => { const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grassMat(w, d)); g.rotation.x = -Math.PI / 2; g.position.set(cx, 0, cz); scene.add(g); };
  gnd(854, 480, -383, -100);            // west, north of adit strip
  gnd(788, 46, -416, 163);              // west strip west of the adit hole
  gnd(46, 46, 21, 163);                 // west strip east of the adit hole
  gnd(854, 234, -383, 303);             // west, south of adit strip
  gnd(630, 760, 375, 40);               // east block
  gnd(16, 410, 52, -135); gnd(16, 334, 52, 253); // borehole column strips
  { // pit: dark walls from the surface down to the cavern ceiling + plank collar
    const pitM = std(0x241d16, { roughness: 1 });
    const mkPit = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pitM); m.position.set(x, y, z); scene.add(m); };
    mkPit(0.6, 27, 16, 44, -13.5, 78); mkPit(0.6, 27, 16, 60, -13.5, 78); mkPit(16, 27, 0.6, 52, -13.5, 70); mkPit(16, 27, 0.6, 52, -13.5, 86);
    const collarM = new THREE.MeshStandardMaterial({ map: tex(planks(6), 3, 1), roughness: 1 });
    for (const [w, d, x, z] of [[18, 1.6, 52, 69.2], [18, 1.6, 52, 86.8], [1.6, 16, 43.2, 78], [1.6, 16, 60.8, 78]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), collarM); c.position.set(x, 0.15, z); scene.add(c); }
  }
  const ballast = new THREE.Mesh(new THREE.PlaneGeometry(360, 5.4), new THREE.MeshStandardMaterial({ map: tex(dirt(7), 40, 1), roughness: 1 }));
  ballast.rotation.x = -Math.PI / 2; ballast.position.set(-140, 0.02, 0); scene.add(ballast);
  const railMat = std(0x8f979e, { roughness: 0.35, metalness: 0.8 });
  for (const dz of [-0.75, 0.75]) { const r = new THREE.Mesh(new THREE.BoxGeometry(360, 0.14, 0.12), railMat); r.position.set(-140, 0.3, dz); scene.add(r); }
  const slpGeo = new THREE.BoxGeometry(0.5, 0.09, 2.4), slpMat = std(0x4c3a28, { roughness: 1 });
  const sleepers = new THREE.InstancedMesh(slpGeo, slpMat, 200);
  for (let i = 0; i < 200; i++) { dummy.position.set(-318 + i * 1.8, 0.22, 0); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); sleepers.setMatrixAt(i, dummy.matrix); }
  sleepers.instanceMatrix.needsUpdate = true; sleepers.frustumCulled = false; scene.add(sleepers);
  // distant peaks west + north
  const mMat = std(0x39465e, { roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const a = -0.4 + i * 0.32, R = 560 + (i % 3) * 60, hh = 90 + ((i * 41) % 70);
    const m = new THREE.Mesh(new THREE.ConeGeometry(hh * 0.95, hh, 5), mMat);
    m.position.set(Math.cos(a) * R - 80, hh / 2 - 6, Math.sin(a) * R - 120); m.rotation.y = i * 1.7; scene.add(m);
  }
  // pines scattered west + south
  const trunkM = std(0x4a3826), leafM = std(0x2c4630, { roughness: 1 });
  for (let i = 0; i < 22; i++) {
    const x = -330 + h1(i * 3 + 1) * 380, z = -160 + h1(i * 7 + 2) * 420;
    if (Math.abs(z) < 27 && x < 30) continue; if (x > 10 && z > 20 && z < 150) continue; if (Math.hypot(x - S.COTTAGE.x, z - S.COTTAGE.z) < 16) continue;
    const tr = new THREE.Group();
    const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.4, 6), trunkM); tk.position.y = 1.7; tr.add(tk);
    for (let k = 0; k < 3; k++) { const cn = new THREE.Mesh(new THREE.ConeGeometry(3.4 - k * 0.8, 3.6, 7), leafM); cn.position.y = 4 + k * 1.9; tr.add(cn); }
    tr.position.set(x, 0, z); tr.scale.setScalar(1.05 + (i % 3) * 0.22); scene.add(tr);
  }
}

// ---------- mountain + tunnel mouth + castle ----------
let castleRim = null; const castleWins = [];
let castleBanner = null; // v3: set inside the castle build block, joined to castleFlags below
const rockMat = new THREE.MeshStandardMaterial({ map: tex(stone(4), 10, 5), color: 0x8d929c, roughness: 1 });
{
  const main = new THREE.Mesh(new THREE.BoxGeometry(260, 78, 170), rockMat); main.position.set(150, 39, -55); scene.add(main);
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(16 + (i % 3) * 7, 22 + (i % 4) * 6, 6), rockMat); c.position.set(50 + i * 38, 82 + (i % 3) * 3, -70 + (i % 2) * 55); c.rotation.y = i * 1.1; scene.add(c); }
  // tunnel mouth: black throat + stone arch frame
  const throat = new THREE.Mesh(new THREE.BoxGeometry(6, 8.4, 9.6), basic(0x020304)); throat.position.set(19.5, 4.2, 0); scene.add(throat);
  const archMat = new THREE.MeshStandardMaterial({ map: FX.stoneWallTexture({ seed: 9, courses: 4 }), color: 0xc3c9d4, roughness: 0.95 }); archMat.map.repeat.set(2, 2);
  for (const dz of [-5.6, 5.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 10.5, 1.8), archMat); p.position.set(18.6, 5.25, dz); scene.add(p); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 13), archMat); lintel.position.set(18.6, 11.4, 0); scene.add(lintel);
  // castle on top (knights build, silhouette)
  const castle = new THREE.Group(); const stTex = tex(stone(4), 3, 3);
  const cMat = new THREE.MeshStandardMaterial({ map: stTex, roughness: 0.95, color: 0xaeb6c2 });
  const roofMat = std(0x333d4f, { roughness: 0.9 });
  const keep = new THREE.Mesh(new THREE.BoxGeometry(32, 40, 28), cMat); keep.position.y = 20; castle.add(keep);
  for (const dz of [-22, 22]) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 54, 10), cMat); tw.position.set(3, 27, dz); castle.add(tw); const rf = new THREE.Mesh(new THREE.ConeGeometry(9.5, 14, 10), roofMat); rf.position.set(3, 61, dz); castle.add(rf); }
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(23, 12, 4), roofMat); keepRoof.position.y = 46; keepRoof.rotation.y = Math.PI / 4; castle.add(keepRoof);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 18, 95), cMat); wall.position.set(18, 9, 0); castle.add(wall);
  // v2 castle dressing: lit windows that flicker (the castle stretch was the softest
  // in Pro — flat wall, nothing alive), a chimney, and a cool moon rim on the keep
  const winM = new THREE.MeshBasicMaterial({ color: 0xffc37a });
  for (const [wx, wy] of [[-9, 15], [-3, 24], [4, 15], [9, 27], [0, 33], [-6, 30]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.3), winM.clone());
    w.position.set(wx, wy, 14.06); castle.add(w); castleWins.push(w);
  }
  const chim = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), cMat); chim.position.set(9, 43, 3); castle.add(chim);
  castleRim = FX.applyRim(keep, { color: 0xaac4ff, power: 2.8, strength: 0.2, scale: 1.03 });
  castle.position.set(150, 78, -38); castle.rotation.y = 0.35; scene.add(castle);
  // v3 castle detail: ashlar stone texture, battlements, framed arched windows,
  // a gated entrance with torches, a corner turret and a cloth banner
  const v3Stone = new THREE.MeshStandardMaterial({ map: FX.stoneWallTexture({ seed: 8, courses: 7 }), color: 0xb6beca, roughness: 0.98 }); v3Stone.map.repeat.set(3, 3);
  keep.material = v3Stone; wall.material = v3Stone;
  castle.traverse(m => { if (m.isMesh && m.material === cMat) m.material = v3Stone; });
  for (let bx = -14; bx <= 14; bx += 4) for (const bz of [14.3, -14.3]) { const cb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 1.1), v3Stone); cb.position.set(bx, 41.1, bz); castle.add(cb); }
  for (let bz = -44; bz <= 44; bz += 5.5) { const cb = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2.4), v3Stone); cb.position.set(18, 19.1, bz); castle.add(cb); }
  const tur = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 9, 8), v3Stone); tur.position.set(15, 42, 12); castle.add(tur);
  const turRoof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 5, 8), roofMat); turRoof.position.set(15, 49, 12); castle.add(turRoof);
  for (const w of [...castleWins]) { const fr = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.75, 0.12), v3Stone); fr.position.set(w.position.x, w.position.y, 13.99); castle.add(fr); }
  for (const [tx, ty, tz, ry] of [[3, 34, 29.9, 0], [3, 20, 29.9, 0], [3, 34, -29.9, Math.PI], [3, 20, -29.9, Math.PI]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), winM.clone()); w.position.set(tx, ty, tz); w.rotation.y = ry; castle.add(w); castleWins.push(w);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.95, 2.55, 0.12), v3Stone); fr.position.set(tx, ty, tz + (ry ? -0.08 : 0.08) * -1); fr.rotation.y = ry; castle.add(fr);
  }
  const gate = new THREE.Mesh(new THREE.BoxGeometry(5.4, 7.6, 0.5), basic(0x07090d)); gate.position.set(0, 3.8, 14.05); castle.add(gate);
  const gateArch = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.5, 14, 1, false, 0, Math.PI), v3Stone); gateArch.rotation.z = Math.PI / 2; gateArch.rotation.y = Math.PI / 2; gateArch.position.set(0, 7.6, 14.05); castle.add(gateArch);
  const grillM = std(0x1c1f24, { roughness: 0.5, metalness: 0.7 });
  for (let gx = -2.2; gx <= 2.2; gx += 0.73) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 7.2, 0.1), grillM); bar.position.set(gx, 3.7, 14.34); castle.add(bar); }
  for (let gy = 1.2; gy <= 6.4; gy += 1.7) { const bar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 0.1), grillM); bar.position.set(0, gy, 14.34); castle.add(bar); }
  for (const tx of [-3.6, 3.6]) { const tg = FX.glint(0.8); tg.material.color.set(0xffa640); tg.position.set(tx, 6.4, 14.7); castle.add(tg); }
  const banC = document.createElement('canvas'); banC.width = 64; banC.height = 96;
  { const bg2 = banC.getContext('2d'); bg2.fillStyle = '#8f2228'; bg2.fillRect(0, 0, 64, 96); bg2.fillStyle = '#e8b64c'; bg2.fillRect(26, 12, 12, 56); bg2.fillRect(10, 32, 44, 12); }
  const banTex = new THREE.CanvasTexture(banC); banTex.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6, 6, 4), new THREE.MeshStandardMaterial({ map: banTex, side: THREE.DoubleSide, roughness: 0.95 }));
  banner.geometry.translate(0, -1.8, 0); banner.position.set(8, 38, 14.4); castle.add(banner);
  FX.clothInit(banner, { amp: 0.22, freq: 2, speed: 2.4 }); castleBanner = banner;
}
const castleFlags = [];
{
  const flagTexC = document.createElement('canvas'); flagTexC.width = 96; flagTexC.height = 64;
  const g = flagTexC.getContext('2d'); g.fillStyle = '#8f2228'; g.fillRect(0, 0, 96, 64); g.fillStyle = '#e8b64c'; g.fillRect(38, 10, 20, 44); g.fillRect(16, 24, 64, 16);
  const ft = new THREE.CanvasTexture(flagTexC); ft.colorSpace = THREE.SRGBColorSpace;
  for (const [x, y, z] of [[153, 128, -60], [153, 128, -16]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7, 6), std(0x3a3a3a)); pole.position.set(x, y - 3.5, z); scene.add(pole);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2, 8, 3), new THREE.MeshBasicMaterial({ map: ft, side: THREE.DoubleSide }));
    fl.geometry.translate(1.7, 0, 0); fl.position.set(x, y - 0.6, z); scene.add(fl);
    FX.clothInit(fl, { amp: 0.3, freq: 2.2, speed: 3 }); castleFlags.push(fl);
  }
}

if (castleBanner) castleFlags.push(castleBanner);

// ---------- diorama: tunnel levels on the mountain's south face (z = +30) ----------
const diaGlints = [];
const diaTrain = new THREE.Group();
{
  const face = new THREE.Mesh(new THREE.BoxGeometry(196, 62, 1.2), new THREE.MeshStandardMaterial({ map: tex(stone(12), 12, 4), color: 0x76839a, roughness: 1 }));
  face.position.set(150, 33, 30.6); scene.add(face);
  const slotMat = basic(0x1d2735), trimMat = FX.goldMaterial({ envMap: envTex, rough: 0.4 });
  S.DIA_LEVELS.forEach((y, li) => {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(168, 4.6, 0.7), slotMat); slot.position.set(150, y + 2.3, 31.4); scene.add(slot);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(168, 0.5, 0.4), trimMat); trim.position.set(150, y + 4.85, 31.5); scene.add(trim);
    for (let k = 0; k < 5; k++) { const gl = FX.glint(0.85); gl.material.color.set(0xffd76a); gl.position.set(84 + k * 34 + li * 9, y + 2.2, 31.9); gl.material.opacity = 0.4; scene.add(gl); diaGlints.push(gl); }
  });
  for (const sx of [86, 140, 196]) { const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.4, 34, 0.7), slotMat); shaft.position.set(sx, 30, 31.4); scene.add(shaft); }
  // mini train that slides along the middle level
  const mMat = new THREE.MeshBasicMaterial({ color: 0x05070a }), gMat = std(0xdbb04f, { roughness: 0.32, metalness: 0.75, envMap: envTex, envMapIntensity: 1.6 });
  const loco = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 2.6), mMat); loco.position.set(0, 1.9, 0); diaTrain.add(loco);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.12), new THREE.MeshBasicMaterial({ color: 0xffd76a })); win.position.set(2.6, 2.6, 1.32); diaTrain.add(win);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.2, 2.6), mMat); cab.position.set(2.6, 2.5, 0); diaTrain.add(cab);
  for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.8, 2.6), i === 1 ? gMat : mMat); w.position.set(-6.6 - i * 6.2, 1.8, 0); diaTrain.add(w); }
  diaTrain.position.set(40, S.DIA_LEVELS[1], 31.6); scene.add(diaTrain);
}

// ---------- the train (surface) + the dark shape (underground) ----------
function buildTrain(palette) {
  const dark = palette === 'shape';
  // v3: the locomotive + tender come from the LIBRARY's detailed builder — boiler
  // bands, riveted smokebox door, domes, handrails, framed cab windows, number
  // plates, spoked drivers, rods + pistons, tender with a faceted coal heap.
  const L = FX.detailedLocomotive({ dark, envMap: envTex, number: '44 205' });
  const grp = L.group; const wheels = L.wheels; const wagons = [];
  const woodM = dark ? std(0x12161f, { roughness: 0.8 }) : new THREE.MeshStandardMaterial({ map: tex(planks(3), 2, 1), roughness: 0.9 });
  const woodM2 = dark ? std(0x171c26, { roughness: 0.8 }) : new THREE.MeshStandardMaterial({ map: tex(planks(7), 2, 1), roughness: 0.9, color: 0xb9a888 });
  const roofM = dark ? std(0x12161f, { roughness: 0.8 }) : std(0x3c4147, { roughness: 0.8 });
  const ironM = dark ? std(0x0d1017, { roughness: 0.7 }) : new THREE.MeshStandardMaterial({ map: FX.metalTexture({ base: '#3a3f45', seed: 19, panels: 2, rust: 0.2 }), roughness: 0.5, metalness: 0.7, envMap: envTex, envMapIntensity: 0.5 });
  // headlamp: glow sprite + the v2 volumetric Beam off the detailed housing
  let lampGlow = null, beamCone = null;
  if (!dark) {
    lampGlow = FX.glint(1.15); lampGlow.material.color.set(0xffd9a0); lampGlow.position.set(0.8, 3.6, 0); grp.add(lampGlow);
    beamCone = new FX.Beam(grp, { from: new THREE.Vector3(0.63, 3.6, 0), dir: new THREE.Vector3(1, 0, 0), length: 17, radius: 1.6, color: 0xffdf9e, intensity: 0, clump: 0.65 });
    beamCone.glow.scale.setScalar(2.3);
  }
  // wagons (v3 detail): grain plank walls, iron corner posts + straps, roof ribs,
  // stencil labels; the gold wagon keeps low walls but gains iron bands — and its
  // gold load (instanced ingots, added by the caller block) sits proud of the rim.
  const wheelM = dark ? std(0x080a0e, { roughness: 0.6, metalness: 0.4 }) : new THREE.MeshStandardMaterial({ map: FX.metalTexture({ base: '#33373d', seed: 17, panels: 2 }), roughness: 0.45, metalness: 0.75, envMap: envTex, envMapIntensity: 0.6 });
  for (let u = 2; u < S.TRAIN_UNITS; u++) {
    const back = S.unitBack(u), front = back - 6.2, cx = -(front + back) / 2;
    const wg = new THREE.Group(); wg.position.set(cx, 0, 0); grp.add(wg); wagons.push({ g: wg, ph: u * 1.73 });
    const wm = u % 2 ? woodM : woodM2;
    if (u === 3) { // open gold wagon: low plank walls + iron bands
      for (const dz of [-1.2, 1.2]) { const w = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.15, 0.16), wm); w.position.set(0, 1.38, dz); wg.add(w); }
      for (const dx of [-2.7, 2.7]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 2.5), wm); w.position.set(dx, 1.38, 0); wg.add(w); }
      const floor = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 2.5), wm); floor.position.set(0, 0.85, 0); wg.add(floor);
      for (const bx of [-2.79, -0.95, 0.95, 2.79]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.24, 2.56), ironM); band.position.set(bx, 1.38, 0); wg.add(band); }
      for (const dz of [-1.29, 1.29]) { const strap = new THREE.Mesh(new THREE.BoxGeometry(5.66, 0.14, 0.06), ironM); strap.position.set(0, 1.9, dz); wg.add(strap); }
    } else {
      const body = FX.bevelBox(5.6, 2.5, 2.55, { bevel: 0.05, mat: wm }); body.position.set(0, 2.15, 0); wg.add(body);
      for (const bx of [-2.82, 2.82]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.56, 2.62), ironM); post.position.set(bx, 2.15, 0); wg.add(post); }
      for (const bz of [-1.29, 1.29]) { const strap = new THREE.Mesh(new THREE.BoxGeometry(5.66, 0.16, 0.05), ironM); strap.position.set(0, 1.55, bz); wg.add(strap); }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.22, 2.8), roofM); roof.position.set(0, 3.5, 0); wg.add(roof);
      for (let rx = -2.4; rx <= 2.4; rx += 1.2) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 2.84), roofM); rib.position.set(rx, 3.64, 0); wg.add(rib); }
      if (!dark) { const lb = FX.stencilLabel(u % 2 ? 'REICHSGOLD' : 'FRACHT 27', { w: 2.6, h: 0.72, seed: u * 3 + 1 }); lb.position.set(0, 2.3, 1.29); wg.add(lb); }
    }
    for (const [wx, wz] of [[2.2, 1.15], [2.2, -1.15], [-2.2, 1.15], [-2.2, -1.15]]) { const w = FX.spokedWheel(0.5, { mat: wheelM, spokes: 5, envMap: envTex }); w.position.set(wx, 0.5, wz); wg.add(w); wheels.push({ m: w, r: 0.5 }); }
  }
  return { grp, wheels, wagons, rods: L.rods, lampGlow, beamCone, boiler: L.boiler, cabM: null };
}
const train = buildTrain('main'); scene.add(train.grp);
const shape = buildTrain('shape'); shape.grp.rotation.y = Math.PI; shape.grp.position.set(S.SHAPE_X, S.CAVERN_Y, S.SHAPE_Z); scene.add(shape.grp);
// v2 rim light: cool moon rim on the surface loco, warm pod-light rim on the buried shape
const trainRim = FX.applyRim(train.boiler, { color: 0x9fb8ff, power: 2.6, strength: 0, scale: 1.05 });
const shapeRim = FX.applyRim(shape.boiler, { color: 0xffc37a, power: 2.2, strength: 0, scale: 1.05 });
// gold bars: platform pile (world space) + open-wagon pile (train space)
// v3 GOLD: true trapezoid ingots — one atlas material + envMap (sheen moves with
// the camera; flat emissive yellow is BANNED). Same story.js positions as v2.
const goldInstMat = FX.goldMaterial({ envMap: envTex, rough: 0.3, intensity: 1.45 });
const goldInstGeo = FX.goldBarGeometry(0.38, 0.115, 0.24, 0.165);
{
  const col = new THREE.Color();
  const plat = new THREE.InstancedMesh(goldInstGeo, goldInstMat, S.GOLD_PLATFORM);
  for (let i = 0; i < S.GOLD_PLATFORM; i++) { const b = S.goldBarAt(i); dummy.position.set(b.p[0], b.p[1], b.p[2]); dummy.rotation.set(0, b.ry, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); plat.setMatrixAt(i, dummy.matrix); plat.setColorAt(i, col.setHSL(0.125, 0.3, 0.9 + h1(i * 7) * 0.1)); }
  plat.instanceMatrix.needsUpdate = true; plat.frustumCulled = false; scene.add(plat);
  const wag = new THREE.InstancedMesh(goldInstGeo, goldInstMat, S.GOLD_WAGON);
  for (let j = 0; j < S.GOLD_WAGON; j++) { const b = S.goldBarAt(S.GOLD_PLATFORM + j); dummy.position.set(b.p[0], b.p[1], b.p[2]); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); wag.setMatrixAt(j, dummy.matrix); wag.setColorAt(j, col.setHSL(0.125, 0.3, 0.9 + h1(j * 13) * 0.1)); }
  wag.instanceMatrix.needsUpdate = true; wag.frustumCulled = false; train.grp.add(wag);
  const csA = FX.contactShadow(15, 3.6, { opacity: 0.8 }); csA.position.set(-46, 0.845, 6.9); scene.add(csA);
  for (const [x, y, z] of [[-50, 1.6, 6.4], [-45.5, 1.75, 6.9], [-48, 1.5, 5.8]]) { const gl = FX.glint(0.55); gl.material.color.set(0xffe9a0); gl.material.opacity = 0.65; gl.position.set(x, y, z); scene.add(gl); }
}
// hero piles: BIG stamped ingots the camera can actually read — one by the crane
// (cargo close-up target) and one beside the buried shape (the "gold wink" source)
const heroPlat = FX.goldPile({ envMap: envTex, intensity: 1.35, len: 1.05, h: 0.24, wb: 0.46, plan: [[3, 2], [2, 2], [2, 1], [1, 1]], seed: 23, main: '999,9', sub: 'FEINGOLD' });
heroPlat.position.set(-44.6, 0.8, 7.35); heroPlat.rotation.y = 0.1; scene.add(heroPlat);
const hero1 = FX.goldBar({ hero: true, envMap: envTex, intensity: 1.35, len: 1.05, h: 0.24, wb: 0.46 }); hero1.position.set(-41.8, 0.92, 8.6); hero1.rotation.y = 0.5; scene.add(hero1);
const hero2 = FX.goldBar({ hero: true, envMap: envTex, intensity: 1.35, len: 1.05, h: 0.24, wb: 0.46 }); hero2.position.set(-41.3, 0.92, 7.5); hero2.rotation.y = -0.25; scene.add(hero2);
const heroCave = FX.goldPile({ envMap: envTex, intensity: 1.35, len: 1.15, h: 0.26, wb: 0.5, plan: [[2, 2], [2, 1], [1, 1]], seed: 31, shadowW: 3.4, shadowD: 3 });
heroCave.position.set(2.6, S.CAVERN_Y + 0.1, S.SHAPE_Z + 3.4); heroCave.rotation.y = -0.4; scene.add(heroCave);

// ---------- PRO dressing: foreground parallax in every section ----------
const diaLights = [];
{
  const poleM = std(0x3d2f20, { roughness: 1 });
  for (let x = -306; x <= 12; x += 36) { // telegraph poles on the far side — they sweep past on the ride
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7.4, 6), poleM); p.position.set(x, 3.7, -6.5); scene.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.6), poleM); arm.position.set(x, 6.7, -6.5); scene.add(arm);
  }
  const postG = new THREE.BoxGeometry(0.5, 0.62, 0.5), postM2 = std(0x6e5a3c, { roughness: 1 });
  const posts = new THREE.InstancedMesh(postG, postM2, 18); // mileposts close to the rail
  for (let i = 0; i < 18; i++) { dummy.position.set(-296 + i * 18, 0.31, -4.4); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); posts.setMatrixAt(i, dummy.matrix); }
  posts.instanceMatrix.needsUpdate = true; posts.frustumCulled = false; scene.add(posts);
  const fenceM = std(0x4c3a28, { roughness: 1 });
  const fp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), fenceM, 40);
  for (let i = 0; i < 40; i++) { dummy.position.set(-150 + i * 4.2, 0.55, 13.2); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); fp.setMatrixAt(i, dummy.matrix); }
  fp.instanceMatrix.needsUpdate = true; fp.frustumCulled = false; scene.add(fp);
  for (const ry of [0.55, 0.95]) { const r = new THREE.Mesh(new THREE.BoxGeometry(166, 0.07, 0.06), fenceM); r.position.set(-68, ry, 13.2); scene.add(r); }
  const tuftG = new THREE.ConeGeometry(0.55, 0.85, 5), tuftM = std(0x2e4a2c, { roughness: 1 });
  const tufts = new THREE.InstancedMesh(tuftG, tuftM, 240);
  let ti = 0;
  for (let i = 0; i < 400 && ti < 240; i++) {
    const x = -320 + h1(i * 3 + 5) * 360, z = -130 + h1(i * 7 + 9) * 300;
    if (Math.abs(z) < 4.5 && x < 30) continue; if (Math.hypot(x - S.COTTAGE.x, z - S.COTTAGE.z) < 9) continue;
    if (x > 38 && x < 66 && z > 62 && z < 94) continue; if (Math.hypot(x - 46, z - 58) < 8) continue;
    dummy.position.set(x, 0.4, z); dummy.rotation.set(0, h1(i) * 3, 0); const s = 0.7 + h1(i * 11) * 0.9; dummy.scale.set(s, s, s); dummy.updateMatrix(); tufts.setMatrixAt(ti++, dummy.matrix);
  }
  tufts.count = ti; tufts.instanceMatrix.needsUpdate = true; tufts.frustumCulled = false; scene.add(tufts); dummy.scale.set(1, 1, 1);
  const bushG = new THREE.SphereGeometry(1, 8, 6), bushM = std(0x27402a, { roughness: 1 });
  const bushes = new THREE.InstancedMesh(bushG, bushM, 30);
  for (let i = 0; i < 30; i++) {
    const x = -260 + h1(i * 13 + 2) * 330, z = -90 + h1(i * 17 + 4) * 260;
    dummy.position.set(x, 0.55, z); dummy.rotation.set(0, h1(i * 3) * 3, 0); const s = 0.8 + h1(i * 7) * 1.1; dummy.scale.set(s * 1.3, s * 0.75, s * 1.3); dummy.updateMatrix(); bushes.setMatrixAt(i, dummy.matrix);
  }
  bushes.instanceMatrix.needsUpdate = true; bushes.frustumCulled = false; scene.add(bushes); dummy.scale.set(1, 1, 1);
  const rockG = new THREE.DodecahedronGeometry(0.5), rockM2 = std(0x6d7278, { roughness: 1, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockG, rockM2, 42);
  for (let i = 0; i < 42; i++) {
    const x = -300 + h1(i * 19 + 1) * 340, z = (h1(i * 23) < 0.5 ? -1 : 1) * (4.6 + h1(i * 29) * 7);
    dummy.position.set(x, 0.25, z); dummy.rotation.set(h1(i) * 3, h1(i * 5) * 3, 0); const s = 0.5 + h1(i * 31); dummy.scale.set(s, s * 0.7, s); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true; rocks.frustumCulled = false; scene.add(rocks); dummy.scale.set(1, 1, 1);
}
// dust motes drifting over the valley (foreground air, every surface section)
const moteGeo = new THREE.BufferGeometry();
{
  const n = 130, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = -170 + h1(i * 3 + 1) * 240; pos[i * 3 + 1] = 0.4 + h1(i * 5) * 8.5; pos[i * 3 + 2] = -22 + h1(i * 7) * 66; }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xd8c9a0, size: 0.14, transparent: true, opacity: 0.4, depthWrite: false }));
motes.frustumCulled = false; scene.add(motes);
// diorama depth kit: protruding floors/ceilings, divider posts and lit lamps per level — the face now reads as tunnels
{
  const floorM = new THREE.MeshStandardMaterial({ map: tex(planks(6), 14, 1), roughness: 1 });
  const postM = std(0x9aa2ae, { roughness: 0.9 });
  // v3 tunnel interiors: ashlar stone arch band over each slot + timber support
  // sets (posts + crossbar) standing in the opening — brick courses and wood
  // read as BUILT tunnels, not grey shelves
  const diaStone = new THREE.MeshStandardMaterial({ map: FX.stoneWallTexture({ seed: 14, courses: 3, lig: 48 }), roughness: 1, color: 0x9aa4b4 }); diaStone.map.repeat.set(10, 1);
  const timberM = new THREE.MeshStandardMaterial({ map: tex(planks(15), 1, 2), roughness: 1 });
  const lampM = new THREE.MeshBasicMaterial({ color: 0xffc37a });
  S.DIA_LEVELS.forEach((y) => {
    const fl = new THREE.Mesh(new THREE.BoxGeometry(168, 0.35, 2.8), floorM); fl.position.set(150, y + 0.15, 32.7); scene.add(fl);
    const ce = new THREE.Mesh(new THREE.BoxGeometry(168, 0.35, 2.8), diaStone); ce.position.set(150, y + 4.8, 32.7); scene.add(ce);
    const arch = new THREE.Mesh(new THREE.BoxGeometry(168, 0.7, 0.5), diaStone); arch.position.set(150, y + 5.15, 32.5); scene.add(arch);
    for (const px of [70, 122, 174, 226]) { for (const off of [-1.8, 1.8]) { const tp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.4, 0.42), timberM); tp.position.set(px + off, y + 2.2, 33); scene.add(tp); } const bar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.42, 0.42), timberM); bar.position.set(px, y + 4.35, 33); scene.add(bar); }
    for (const px of [66, 118, 170, 222]) { const dp = new THREE.Mesh(new THREE.BoxGeometry(1.3, 4.6, 1.5), postM); dp.position.set(px, y + 2.3, 32.3); scene.add(dp); }
    for (let k = 0; k < 9; k++) { const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.4), lampM.clone()); lm.position.set(76 + k * 18.5, y + 4.15, 32.55); scene.add(lm); diaLights.push(lm); }
  });
}
// hunters' camp: hanging lantern on a pole (swings in renderFrame)
const campLantern = new THREE.Group();
{
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.4, 6), std(0x3a3128)); pole.position.set(5.6, 1.7, 29.2); scene.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), std(0x3a3128)); arm.position.set(4.95, 3.35, 29.2); scene.add(arm);
  campLantern.position.set(4.4, 3.3, 29.2);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 4), std(0x222222)); cord.position.y = -0.27; campLantern.add(cord);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), FX.glassMat(0xffc37a, 0.45)); glass.position.y = -0.68; campLantern.add(glass);
  const glow = FX.glint(0.85); glow.material.color.set(0xffc37a); glow.position.y = -0.68; campLantern.add(glow);
  campLantern.userData.glow = glow; scene.add(campLantern);
}
// snow: falling flakes + ground whitening for the 70-years season cycle
const SNOW_N = 320, snowBase = new Float32Array(SNOW_N * 2), snowGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(SNOW_N * 3);
  for (let i = 0; i < SNOW_N; i++) { snowBase[i * 2] = -50 + h1(i * 3 + 7) * 110; snowBase[i * 2 + 1] = h1(i * 7 + 3) * 26; pos[i * 3] = snowBase[i * 2]; pos[i * 3 + 1] = 20; pos[i * 3 + 2] = -14 + h1(i * 11 + 5) * 76; }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.32, transparent: true, opacity: 0, depthWrite: false }));
snowPts.frustumCulled = false; scene.add(snowPts);
const snowGround = new THREE.Mesh(new THREE.CircleGeometry(41, 40), new THREE.MeshBasicMaterial({ color: 0xe8eef4, transparent: true, opacity: 0, depthWrite: false }));
snowGround.rotation.x = -Math.PI / 2; snowGround.position.set(0, 0.06, 24); snowGround.renderOrder = -1; scene.add(snowGround);
// borehole shaft: rock STRATA bands + depth markers; cavern strata + stalactites
{
  const strataCols = [0x6b543a, 0x7a6a4f, 0x54432e, 0x8a7a5c, 0x4a3b2c, 0x77644a, 0x5d4a33, 0x86755a, 0x3f3226];
  strataCols.forEach((c, i) => {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 7.8, 3.05, 20, 1, true), new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide }));
    band.position.set(S.CAV.x, -1.6 - i * 3.02, S.CAV.z); scene.add(band);
  });
  const markM = new THREE.MeshBasicMaterial({ color: 0xf2ead2 }), markR = new THREE.MeshBasicMaterial({ color: 0xc23b2e });
  for (let d = 0; d < 5; d++) {
    const mk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 1.1), d % 2 ? markR : markM); mk.position.set(S.CAV.x - 7.55, -5 - d * 5, S.CAV.z); scene.add(mk);
  }
  const bandCols = [0x3d4450, 0x54432e, 0x46536b, 0x5d4a33, 0x39424e];
  bandCols.forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(180, 1.5, 0.5), std(c, { roughness: 1 }));
    b.position.set(30, S.CAVERN_Y + 3 + i * 2.1, 31.2); scene.add(b);
  });
  const stalM = std(0x232830, { roughness: 1, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const h = 3 + h1(i * 7) * 3.5, st = new THREE.Mesh(new THREE.ConeGeometry(0.8 + h1(i * 3) * 0.9, h, 6), stalM);
    st.rotation.x = Math.PI; st.position.set(-45 + h1(i * 13) * 150, -27 + h / 2 - 0.4, 42 + h1(i * 17) * 66); scene.add(st);
  }
}

// ---------- siding: platform, crane, crates, lanterns ----------
const lanternFires = [];
function lantern(x, y, z, scale = 0.4) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, y, 6), std(0x2e2a24)); pole.position.set(x, y / 2, z); scene.add(pole);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), FX.glassMat(0xffc37a, 0.4)); glass.position.set(x, y + 0.15, z); scene.add(glass);
  const fire = new FX.Fire(scene, { x, y: y - 0.05, z, scale, rate: 14, max: 10 }); fire.on = false; scene.add(fire.light ? fire.light : new THREE.Group());
  lanternFires.push(fire); return fire;
}
{
  const plat = new THREE.Mesh(new THREE.BoxGeometry(46, 0.8, 6.5), new THREE.MeshStandardMaterial({ map: tex(planks(3), 8, 1), roughness: 1 }));
  plat.position.set(-52, 0.4, 8.2); scene.add(plat);
  const postM = std(0x4c3a28, { roughness: 1 });
  for (const dx of [-7, 7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 7.5, 8), postM); p.position.set(-58 + dx, 3.75, 11.2); scene.add(p); }
  const jib = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 15, 8), postM); jib.rotation.z = 1.15; jib.position.set(-58, 8.2, 10.6); scene.add(jib);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.6, 4), std(0x222222)); cable.position.set(-56.5, 7.6, 9.8); scene.add(cable);
  const hookBlock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), std(0x6e5a3c)); hookBlock.position.set(-56.5, 5.1, 9.8); scene.add(hookBlock);
  const c1 = FX.crate3(1.7, { label: 'GOLD', envMap: envTex, seed: 5 }); c1.position.set(-60, 0.85, 9); scene.add(c1);
  const c2 = FX.crate3(1.4, { label: '27', envMap: envTex, seed: 9 }); c2.position.set(-58.2, 0.7, 10.6); c2.rotation.y = 0.5; scene.add(c2);
  const b1 = FX.barrel3(0.62, 1.5, { envMap: envTex }); b1.position.set(-36, 0.75, 10); scene.add(b1);
  const b2 = FX.barrel3(0.62, 1.5, { envMap: envTex, seed: 8 }); b2.position.set(-34.8, 0.75, 9.2); scene.add(b2);
  lantern(-62, 2.7, 6.4); lantern(-30, 2.7, 6.4);
}
const mouthLantern = lantern(13.5, 2.7, 9.5);

// ---------- rocks sealing the mouth ----------
const rockMeshes = [];
{
  const geo = new THREE.DodecahedronGeometry(1);
  for (let i = 0; i < S.ROCK_N; i++) {
    const m = new THREE.Mesh(geo, std(0x777d88, { roughness: 1, flatShading: true }));
    const sc = 0.8 + h1(i * 3) * 1.1; m.scale.setScalar(sc); m.userData.s0 = sc; m.rotation.set(h1(i) * 3, h1(i * 7) * 3, h1(i * 11) * 3);
    m.visible = false; scene.add(m); rockMeshes.push(m);
  }
}

// ---------- hunters' camp ----------
{
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 2.2), new THREE.MeshStandardMaterial({ map: tex(planks(5), 2, 1), roughness: 1 })); top.position.y = 1.0; table.add(top);
  for (const [dx, dz] of [[-1.5, -0.9], [1.5, -0.9], [-1.5, 0.9], [1.5, 0.9]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), std(0x4c3a28)); leg.position.set(dx, 0.5, dz); table.add(leg); }
  const mapC = document.createElement('canvas'); mapC.width = 512; mapC.height = 320;
  const mg = mapC.getContext('2d'); mg.fillStyle = '#d9c9a3'; mg.fillRect(0, 0, 512, 320);
  mg.strokeStyle = '#8a7648'; mg.lineWidth = 3;
  for (let k = 0; k < 5; k++) { mg.beginPath(); mg.ellipse(360, 130, 40 + k * 26, 26 + k * 17, 0.4, 0, 7); mg.stroke(); }
  mg.strokeStyle = '#5d7a9e'; mg.lineWidth = 5; mg.beginPath(); mg.moveTo(20, 260); mg.bezierCurveTo(150, 220, 220, 290, 330, 180); mg.stroke();
  mg.strokeStyle = '#8a4a3a'; mg.setLineDash([10, 8]); mg.lineWidth = 4; mg.beginPath(); mg.moveTo(30, 60); mg.bezierCurveTo(160, 90, 260, 60, 345, 115); mg.stroke();
  mg.strokeStyle = '#c0272d'; mg.lineWidth = 9; mg.beginPath(); mg.moveTo(330, 100); mg.lineTo(362, 132); mg.moveTo(362, 100); mg.lineTo(330, 132); mg.stroke();
  const mapTex = new THREE.CanvasTexture(mapC); mapTex.colorSpace = THREE.SRGBColorSpace;
  const mapEdge = new THREE.Mesh(new THREE.PlaneGeometry(3.15, 2.05), new THREE.MeshStandardMaterial({ color: 0xf0e6cc, roughness: 0.95 }));
  mapEdge.rotation.x = -Math.PI / 2; mapEdge.rotation.z = 0.18; mapEdge.position.y = 1.075; table.add(mapEdge);
  const map = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.8), new THREE.MeshBasicMaterial({ map: mapTex }));
  map.rotation.x = -Math.PI / 2; map.rotation.z = 0.18; map.position.y = 1.09; table.add(map);
  table.position.set(2, 0, 25.5); table.rotation.y = 0.4; scene.add(table);
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.95), new THREE.MeshStandardMaterial({ color: 0xe9dfc4, roughness: 0.95 }));
  note.rotation.x = -Math.PI / 2; note.rotation.z = -0.5; note.position.set(1.25, 1.08, 0.55); table.add(note);
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 6), std(0xd9822e, { roughness: 0.7 }));
  pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.4; pencil.position.set(0.7, 1.11, -0.55); table.add(pencil);
  const tent = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.8, 4), std(0x9a8a68, { roughness: 1 })); tent.position.set(-4.5, 1.4, 31); tent.rotation.y = 0.78; scene.add(tent);
  const tc = FX.crate3(1.3, { label: 'PROVIANT', envMap: envTex, seed: 12 }); tc.position.set(7.5, 0.65, 30); scene.add(tc);
}

// ---------- south ridge + flooded adit ----------
let aditWater = null;
{
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(150, 26, 90.5), new THREE.MeshStandardMaterial({ map: tex(grass(11), 16, 8), roughness: 1 }));
  ridge.position.set(-15, 13, 187.25); scene.add(ridge);
  // front rock wall built AROUND the adit mouth hole (hole: x -17..-7, y 0..7)
  const mkFace = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.5), rockMat); m.position.set(x, y, 137.6); scene.add(m); };
  mkFace(73, 26, -53.5, 13); mkFace(67, 26, 26.5, 13); mkFace(10, 19, -12, 16.5);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 12, 14, 1, true), basic(0x04070c, { side: THREE.BackSide }));
  throat.geometry.rotateX(Math.PI / 2); throat.position.set(S.ADIT.x, 2.8, 140); scene.add(throat);
  const postM = std(0x4c3a28, { roughness: 1 });
  for (const dx of [-4.6, 4.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 7, 0.9), postM); p.position.set(S.ADIT.x + dx, 3.5, 136.8); scene.add(p); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.8, 0.9), postM); lintel.position.set(S.ADIT.x, 7.1, 136.8); scene.add(lintel);
  // interior: dark tube + water
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 44, 16, 1, true), basic(0x111b2c, { side: THREE.BackSide }));
  tube.geometry.rotateX(Math.PI / 2); tube.position.set(S.ADIT.x, 2.4, 162); scene.add(tube);
  // v2 fix (inherited Pro bug): the ridge's grass front face has no hole for the adit,
  // so the dive-in showed a ~0.5s grass wall and hid the diver. A dark portal disc just
  // inside the throat makes the approach read as a real black tunnel mouth instead;
  // the camera slips past it into the lit interior in one dark frame.
  const aditPortal = new THREE.Mesh(new THREE.CircleGeometry(5.6, 24), new THREE.MeshBasicMaterial({ color: 0x05070a, side: THREE.DoubleSide }));
  aditPortal.position.set(S.ADIT.x, 2.4, 141.9); scene.add(aditPortal);
  const back = new THREE.Mesh(new THREE.CircleGeometry(5.2, 16), basic(0x0a1424, { side: THREE.DoubleSide })); back.position.set(S.ADIT.x, 2.4, 184); scene.add(back);
  // NOTE: FX.makeWater's shader renders opaque black in SwiftShader — use a plain
  // translucent standard material for the adit pool so the diver's legs read through it.
  aditWater = new THREE.Mesh(new THREE.PlaneGeometry(11, 44), new THREE.MeshStandardMaterial({ color: 0x14425e, transparent: true, opacity: 0.88, roughness: 0.25, metalness: 0.1 }));
  aditWater.rotation.x = -Math.PI / 2; aditWater.position.set(S.ADIT.x, -0.55, 162); scene.add(aditWater);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(11, 44), basic(0x0d1b28)); floor.rotation.x = -Math.PI / 2; floor.position.set(S.ADIT.x, -1.6, 162); scene.add(floor);
}

// ---------- dollhouse cottage (old man's home) ----------
{
  const C = S.COTTAGE, grp = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 9), new THREE.MeshStandardMaterial({ map: tex(planks(8), 3, 2), roughness: 1 })); floor.position.y = 0.15; grp.add(floor);
  const wallM = new THREE.MeshStandardMaterial({ map: tex(planks(9), 4, 2), color: 0xcbb59a, roughness: 1 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(11, 5.4, 0.4), wallM); back.position.set(0, 2.7, 4.4); grp.add(back);
  for (const sx of [-5.4, 5.4]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.4, 9), wallM); side.position.set(sx, 2.7, 0); grp.add(side); }
  const roofM = std(0x6e4a3a, { roughness: 1 });
  for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.25, 10), roofM); r.position.set(sx * 2.9, 5.7, 0); r.rotation.z = -sx * 0.5; grp.add(r); }
  const winGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.9), basic(0xffb45e)); winGlow.position.set(-2.8, 3.1, 4.18); winGlow.rotation.y = Math.PI; grp.add(winGlow);
  const winFrame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 0.12), std(0x4c3a28)); winFrame.position.set(-2.8, 3.1, 4.32); grp.add(winFrame);
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.3), std(0x5d4630)); seat.position.y = 0.85; chair.add(seat);
  const backr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.14), std(0x5d4630)); backr.position.set(0, 1.7, 0.62); chair.add(backr);
  chair.position.set(0, 0.3, 1.2); grp.add(chair);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.6), std(0x8f3a34, { roughness: 1 })); blanket.position.set(0, 0.55, -0.35); grp.add(blanket);
  const lampGlow = FX.glint(1.5); lampGlow.material.color.set(0xffc37a); lampGlow.position.set(3.4, 1.7, 1.4); grp.add(lampGlow);
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), std(0x2e2a24)); lampPole.position.set(3.4, 0.9, 1.4); grp.add(lampPole);
  grp.position.set(C.x, 0, C.z); scene.add(grp);
}

// ---------- v2 whisper dressing: a worn dirt path from the adit to the cottage ----------
// (the Pro ridge flyover crossed ~0.5s of plain grass — now the path, pines and posts
//  give the flight foreground/midground parallax the whole way)
{
  const pathM = new THREE.MeshStandardMaterial({ map: tex(dirt(13), 2, 2), roughness: 1 });
  const P0 = [-14, 148], P1 = [-46, 128], P2 = [-70, 124], P3 = [-88, 119];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16, a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
    const x = a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], z = a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1];
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.3 + h1(i * 3) * 0.7, 10), pathM);
    disc.rotation.x = -Math.PI / 2; disc.rotation.z = h1(i * 7) * 3; disc.position.set(x, 0.045, z); scene.add(disc);
  }
  const trunkM2 = std(0x4a3826), leafM2 = std(0x2c4630, { roughness: 1 });
  for (const [px, pz, ps] of [[-30, 133, 1.25], [-56, 113, 1.45], [-72, 129, 1.1]]) {
    const tr = new THREE.Group();
    const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.4, 6), trunkM2); tk.position.y = 1.7; tr.add(tk);
    for (let k = 0; k < 3; k++) { const cn = new THREE.Mesh(new THREE.ConeGeometry(3.4 - k * 0.8, 3.6, 7), leafM2); cn.position.y = 4 + k * 1.9; tr.add(cn); }
    tr.position.set(px, 0, pz); tr.scale.setScalar(ps); scene.add(tr);
  }
  const postM3 = std(0x4c3a28, { roughness: 1 });
  for (const [px, pz] of [[-24, 141], [-40, 122], [-62, 118], [-80, 112]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 0.18), postM3); p.position.set(px, 0.57, pz); p.rotation.y = h1(px) * 0.6; scene.add(p);
  }
}

// ---------- radar cart + live screen ----------
const radarCanvas = document.createElement('canvas'); radarCanvas.width = 512; radarCanvas.height = 360;
const radarTex = new THREE.CanvasTexture(radarCanvas); radarTex.colorSpace = THREE.SRGBColorSpace;
function drawRadar(sweep, pulse) {
  const g = radarCanvas.getContext('2d');
  g.fillStyle = '#06180c'; g.fillRect(0, 0, 512, 360);
  g.strokeStyle = 'rgba(80,220,140,0.35)'; g.lineWidth = 2;
  for (let r = 40; r <= 170; r += 32) { g.beginPath(); g.arc(256, 180, r, 0, 7); g.stroke(); }
  g.beginPath(); g.moveTo(16, 180); g.lineTo(496, 180); g.moveTo(256, 10); g.lineTo(256, 350); g.stroke();
  const a = sweep * Math.PI * 2 - Math.PI / 2;
  const grad = g.createConicGradient ? null : null;
  g.fillStyle = 'rgba(120,255,170,0.20)';
  g.beginPath(); g.moveTo(256, 180); g.arc(256, 180, 175, a - 0.5, a); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(160,255,200,0.9)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(256, 180); g.lineTo(256 + Math.cos(a) * 175, 180 + Math.sin(a) * 175); g.stroke();
  // train-shaped blip
  const al = 0.25 + pulse * 0.75;
  g.fillStyle = `rgba(255,214,90,${al})`;
  g.fillRect(300, 196, 118, 16); g.fillRect(300, 182, 30, 14); g.fillRect(398, 186, 20, 10);
  g.fillStyle = `rgba(255,240,180,${al * 0.8})`; g.fillRect(336, 190, 54, 6);
  if (pulse > 0.02) { g.strokeStyle = `rgba(255,214,90,${pulse * 0.7})`; g.lineWidth = 3; g.beginPath(); g.arc(359, 200, 26 + (1 - pulse) * 60, 0, 7); g.stroke(); }
  g.fillStyle = 'rgba(140,255,190,0.85)'; g.font = 'bold 21px monospace'; g.fillText('GPR-9  DEPTH 30m', 18, 34);
  radarTex.needsUpdate = true;
}
let radarGrp = null;
{
  const P = S.RADAR_POS, grp = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ map: FX.metalTexture({ base: '#5a6771', seed: 23, panels: 3, rust: 0.15 }), roughness: 0.55, metalness: 0.6, envMap: envTex, envMapIntensity: 0.6 });
  const body = FX.bevelBox(2.0, 1.1, 1.4, { bevel: 0.05, mat: bodyM }); body.position.y = 0.85; grp.add(body);
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.16, 12); wg.rotateX(Math.PI / 2);
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { const w = new THREE.Mesh(wg, std(0x22262b)); w.position.set(dx, 0.42, dz); grp.add(w); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), std(0x333a42)); mast.position.set(-0.6, 2.4, 0); grp.add(mast);
  // v3 dish: wire-mesh face (grid texture), rim ring, feed arm + feed horn
  const dishC = document.createElement('canvas'); dishC.width = dishC.height = 256;
  { const dg = dishC.getContext('2d'); dg.fillStyle = '#c9ced6'; dg.fillRect(0, 0, 256, 256); dg.strokeStyle = 'rgba(70,76,84,0.75)'; dg.lineWidth = 2; for (let i = 0; i <= 256; i += 16) { dg.beginPath(); dg.moveTo(i, 0); dg.lineTo(i, 256); dg.stroke(); dg.beginPath(); dg.moveTo(0, i); dg.lineTo(256, i); dg.stroke(); } dg.strokeStyle = 'rgba(40,44,50,0.9)'; dg.lineWidth = 6; dg.beginPath(); dg.arc(128, 128, 118, 0, 7); dg.stroke(); }
  const dishTex2 = new THREE.CanvasTexture(dishC); dishTex2.colorSpace = THREE.SRGBColorSpace;
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 10, 0, Math.PI * 2, 0, 0.85), new THREE.MeshStandardMaterial({ map: dishTex2, roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide, envMap: envTex, envMapIntensity: 0.7 }));
  dish.position.set(-0.6, 3.6, 0); dish.rotation.x = -0.9; grp.add(dish); grp.userData.dish = dish;
  const feedArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), std(0x333a42)); feedArm.position.set(-0.6, 3.95, 0.62); feedArm.rotation.x = 1.12; grp.add(feedArm);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 0.3, 8), std(0x22262b)); feed.position.set(-0.6, 4.28, 1.15); feed.rotation.x = 1.12; grp.add(feed);
  const sled = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 1.1), std(0xd9822e, { roughness: 0.7 })); sled.position.set(3.4, 0.12, 1.2); grp.add(sled);
  // console on the cart top: gauge dials with needles + four coloured buttons
  const dialM = new THREE.MeshBasicMaterial({ color: 0xd8e8d0 });
  for (let di = 0; di < 3; di++) { const dial = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), dialM); dial.position.set(-0.5 + di * 0.5, 1.415, 0.35); dial.rotation.x = -Math.PI / 2 + 0.5; grp.add(dial); const needle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.12), new THREE.MeshBasicMaterial({ color: 0xc0272d })); needle.position.set(-0.5 + di * 0.5, 1.435, 0.35); needle.rotation.y = di * 0.9 - 0.4; grp.add(needle); }
  [0xc0272d, 0x2e9e4f, 0xe8b64c, 0x3a6ec2].forEach((bc, bi) => { const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8), new THREE.MeshStandardMaterial({ color: bc, roughness: 0.4 })); btn.position.set(0.3 + bi * 0.22, 1.42, -0.32); grp.add(btn); });
  const cablePts = [new THREE.Vector3(0.9, 0.9, 0.3), new THREE.Vector3(1.7, 0.22, -0.9), new THREE.Vector3(1.3, 0.18, -1.9), new THREE.Vector3(1.0, 0.8, -2.35)];
  grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(cablePts).getPoints(20)), new THREE.LineBasicMaterial({ color: 0x14161a })));
  grp.position.set(P[0], 0, P[2]); grp.rotation.y = -0.3; scene.add(grp);
  radarGrp = grp;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.85), new THREE.MeshBasicMaterial({ map: radarTex }));
  scr.position.set(P[0] + 0.5, 1.75, P[2] - 2.6); scene.add(scr);
  const scrBack = FX.bevelBox(2.8, 2.05, 0.12, { bevel: 0.03, mat: new THREE.MeshStandardMaterial({ map: FX.metalTexture({ base: '#3a4149', seed: 25, panels: 2 }), roughness: 0.5, metalness: 0.6, envMap: envTex, envMapIntensity: 0.5 }) });
  scrBack.position.set(P[0] + 0.5, 1.75, P[2] - 2.68); scene.add(scrBack);
  for (const dx of [-1.1, 1.1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 6), std(0x22262b)); leg.position.set(P[0] + 0.5 + dx, 0.45, P[2] - 2.66); scene.add(leg); }
  drawRadar(0, 0);
}

// ---------- borehole derrick, shaft, cavern, camera pod ----------
const pod = new THREE.Group(); let podCone = null, podLight = null, podBlink = null, drillString = null;
const cableGeo = new THREE.BufferGeometry(); cableGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
{
  const C = S.CAV, legM = std(0x7a4a28, { roughness: 0.9 });
  for (let k = 0; k < 3; k++) {
    const a = k * (Math.PI * 2 / 3) + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 8.6, 7), legM);
    leg.position.set(C.x + Math.cos(a) * 2.2, 3.9, C.z + Math.sin(a) * 2.2);
    leg.rotation.z = Math.cos(a) * 0.26; leg.rotation.x = -Math.sin(a) * 0.26; scene.add(leg);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.3, 8, 18), std(0x4c3a28, { roughness: 1 })); collar.rotation.x = Math.PI / 2; collar.position.set(C.x, 0.25, C.z); scene.add(collar);
  // v3 drill rig: cross braces between the legs, top winch beam + cable drum,
  // and the rotating drill string (spun in renderFrame) running down the shaft
  const braceM = std(0x5d4028, { roughness: 0.95 });
  for (let k = 0; k < 3; k++) {
    const a1 = k * (Math.PI * 2 / 3) + 0.5, a2 = (k + 1) * (Math.PI * 2 / 3) + 0.5;
    const p1 = new THREE.Vector3(C.x + Math.cos(a1) * 2.6, 2.2, C.z + Math.sin(a1) * 2.6), p2 = new THREE.Vector3(C.x + Math.cos(a2) * 2.6, 4.6, C.z + Math.sin(a2) * 2.6);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, p1.distanceTo(p2), 6), braceM);
    br.position.copy(p1).lerp(p2, 0.5); br.lookAt(p2); br.rotateX(Math.PI / 2); scene.add(br);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 0.3), legM); beam.position.set(C.x, 7.6, C.z); scene.add(beam);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 12), new THREE.MeshStandardMaterial({ map: FX.metalTexture({ base: '#4a4f55', seed: 27, panels: 2 }), roughness: 0.5, metalness: 0.7, envMap: envTex, envMapIntensity: 0.5 }));
  drum.geometry.rotateX(Math.PI / 2); drum.position.set(C.x, 7.15, C.z); scene.add(drum);
  drillString = new THREE.Group();
  const pipeM = new THREE.MeshStandardMaterial({ map: FX.metalTexture({ base: '#6a7076', seed: 29, panels: 6 }), roughness: 0.4, metalness: 0.8, envMap: envTex, envMapIntensity: 0.6 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 34, 8), pipeM); pipe.position.y = -17; drillString.add(pipe);
  for (let ci = 0; ci < 5; ci++) { const cj = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8), pipeM); cj.position.y = -4 - ci * 6.5; drillString.add(cj); }
  const bit = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), pipeM); bit.rotation.x = Math.PI; bit.position.y = -34.2; drillString.add(bit);
  drillString.position.set(C.x, 7.1, C.z); scene.add(drillString);
  // (no shaft tube mesh: the descent reads through the open pit + ceiling hole;
  //  a 3m tube around the camera rendered as an unreadable blown-out ring.)
  // cavern: floor, walls, ceiling built AROUND the shaft hole (x 49..55, z 75..81)
  const floorM = basic(0x0a0c10), wallM = basic(0x07090d);
  const cfloor = new THREE.Mesh(new THREE.PlaneGeometry(182, 92), std(0x14171d, { roughness: 1 }));
  cfloor.rotation.x = -Math.PI / 2; cfloor.position.set(30, S.CAVERN_Y, 75); scene.add(cfloor);
  const mkWall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallM); m.position.set(x, y, z); scene.add(m); };
  mkWall(182, 14, 1, 30, S.CAVERN_Y + 7, 30); mkWall(182, 14, 1, 30, S.CAVERN_Y + 7, 120);
  mkWall(1, 14, 92, -60, S.CAVERN_Y + 7, 75); mkWall(1, 14, 92, 120, S.CAVERN_Y + 7, 75);
  mkWall(109, 1, 90, -5.5, -27, 75); mkWall(65, 1, 90, 87.5, -27, 75);
  mkWall(6, 1, 45, 52, -27, 52.5); mkWall(6, 1, 39, 52, -27, 100.5);
  const railM = std(0x3d434b, { roughness: 0.5, metalness: 0.6 });
  for (const dz of [-0.75, 0.75]) { const r = new THREE.Mesh(new THREE.BoxGeometry(178, 0.14, 0.12), railM); r.position.set(30, S.CAVERN_Y + 0.32, S.SHAPE_Z + dz); scene.add(r); }
  const bed = new THREE.Mesh(new THREE.BoxGeometry(178, 0.24, 4.4), std(0x17130f, { roughness: 1 })); bed.position.set(30, S.CAVERN_Y + 0.12, S.SHAPE_Z); scene.add(bed);
  // pod: body + lens + light cone + point light + recorder blink
  // v3 pod: bevelled pressure hull (paneled metal), framed window + glass, rivet
  // ring around the lens barrel, red side lights, cable eyelet on top
  const podHull = new THREE.MeshStandardMaterial({ map: FX.metalTexture({ base: '#4d5866', seed: 33, panels: 3, rust: 0.08 }), roughness: 0.42, metalness: 0.7, envMap: envTex, envMapIntensity: 0.7 });
  const pbody = FX.bevelBox(0.62, 0.46, 0.86, { bevel: 0.05, mat: podHull }); pod.add(pbody);
  const winFrame = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 14), podHull); winFrame.position.set(0, 0.04, 0.44); pod.add(winFrame);
  const winGlass = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), FX.glassMat(0x9fd4e8, 0.5)); winGlass.position.set(0, 0.04, 0.45); pod.add(winGlass);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.3, 10), std(0x11151c, { metalness: 0.6, roughness: 0.3 })); lens.geometry.rotateX(Math.PI / 2); lens.position.set(0, -0.13, 0.52); pod.add(lens);
  const podRiv = FX.rivetCircle(0.21, 8, { size: 0.02 }); podRiv.position.set(0, -0.13, 0.58); pod.add(podRiv);
  for (const sx of [-0.33, 0.33]) { const sl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5533 })); sl.position.set(sx, 0.14, 0.3); pod.add(sl); }
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 10), podHull); eye.position.y = 0.3; pod.add(eye);
  podCone = new FX.Beam(pod, { from: new THREE.Vector3(0, 0, 0.4), dir: new THREE.Vector3(0, 0, 1), length: 19, radius: 4.4, color: 0xffdf9e, intensity: 0.5, clump: 0.5 });
  podCone.glow.scale.setScalar(1.7);
  podLight = new THREE.PointLight(0xffe2b0, 0, 85, 1.5); podLight.position.set(0, 0, 3); pod.add(podLight);
  podBlink = FX.glint(0.35); podBlink.material.color.set(0xff4444); podBlink.position.set(0.2, 0.3, 0.2); pod.add(podBlink);
  pod.rotation.order = 'YXZ'; pod.visible = false; scene.add(pod);
  const cable = new THREE.Line(cableGeo, new THREE.LineBasicMaterial({ color: 0x11141a })); cable.frustumCulled = false; scene.add(cable);
}
const camLight = new THREE.PointLight(0xbfd0e8, 0, 48, 1.5); scene.add(camLight); // documentary camera light, underground beats only
// v2: dust motes drifting in the cavern air (they catch the pod beam), parked at cavern depth
const cavDust = new FX.Ambience(scene, { mode: 'dust', count: 110, area: 120, height: 10, cx: 30, cz: 75, opacity: 0.3, color: 0xffe9c0 });
cavDust.points.position.y = S.CAVERN_Y + 1; cavDust.points.visible = false;
// v2: warm practical light at the sealed mouth — lifts the (previously darkest) waiting beat
const waitLight = new THREE.PointLight(0xffc37a, 0, 46, 1.6); waitLight.position.set(14, 3.2, 7); scene.add(waitLight);
const glintMain = FX.glint(1.3); glintMain.material.color.set(0xffd76a); glintMain.position.set(...S.GLINT_PT); scene.add(glintMain);
const mouthGlint = FX.glint(1.1); mouthGlint.material.color.set(0xffd76a); mouthGlint.position.set(...S.MOUTH_GLINT_PT); mouthGlint.material.opacity = 0; scene.add(mouthGlint);
const diverGlow = FX.glint(0.45); diverGlow.material.color.set(0xbfe0ff); diverGlow.material.opacity = 0; scene.add(diverGlow);
const bubbles = [];
for (let k = 0; k < 9; k++) { const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xcfe8ff, transparent: true, opacity: 0, depthWrite: false })); const sc = 0.16 + (k % 3) * 0.07; b.scale.set(sc, sc, 1); scene.add(b); bubbles.push(b); }
// deterministic seal-dust sprites (pure functions of frame — chunk-safe)
const sealDust = [];
for (let k = 0; k < 16; k++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0x9a938a, transparent: true, opacity: 0, depthWrite: false }));
  sp.position.set(S.MOUTH_X + 1, 3, 0); scene.add(sp); sealDust.push(sp);
}


// ---------- PRO: dust motes inside the pod beam + brake sparks at the stop ----------
const podDust = [];
for (let k = 0; k < 22; k++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffe9c0, transparent: true, opacity: 0, depthWrite: false }));
  const zz = 2.5 + (k % 7) * 1.9, rr = zz * 0.16;
  sp.position.set(Math.cos(k * 2.4) * rr, Math.sin(k * 1.9) * rr, zz);
  const sc = 0.1 + (k % 3) * 0.05; sp.scale.set(sc, sc, 1); pod.add(sp); podDust.push(sp);
}
const brakeSparks = [];
for (let k = 0; k < 10; k++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffa640, transparent: true, opacity: 0, depthWrite: false }));
  const sc = 0.14 + (k % 3) * 0.06; sp.scale.set(sc, sc, 1); scene.add(sp); brakeSparks.push(sp);
}
const platGlints = [];

// ---------- FX pools ----------
const smoke = new FX.Smoke(scene, 120);
const clouds = new FX.Clouds(scene, { count: 9, y: 68, opacity: 0.5, drift: 1, shadow: true });
const mist1 = FX.mistBand(scene, { count: 8, y: 1.9, opacity: 0.22 });
const mist2 = FX.mistBand(scene, { count: 5, y: 3.2, opacity: 0.16 });

// ---------- character cards (bear-line kit) with canvas overlays ----------
const CARD_W = 1.35;
class Card {
  constructor(outfit, seed, overlay) {
    this.outfit = outfit; this.seed = seed || 11; this.overlay = overlay || null;
    this.cv = document.createElement('canvas'); this.cv.width = 600; this.cv.height = 1000;
    this.ctx = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.grp = new THREE.Group();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_W * 1000 / 600), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, side: THREE.DoubleSide }));
    m.position.y = (CARD_W * 1000 / 600) / 2; this.grp.add(m);
    this.blobM = blob(0, 0, 2.2, this.grp); this.blobM.position.y = 0.03;
    scene.add(this.grp); this.lastKey = ''; this.drawn = null;
    // v2 state: blink clock, damped pupil look, walk phase, prop spring (glasses/lamp lag)
    this.blink = new T.Blink(this.seed * 7 + 3);
    this.lookX = 0; this.lookY = 0; this.phase = 0;
    this.px = null; this.py = 0; this.pz = null;
    this.ovSpring = new Spring2(0, 0, 90, 10); this.ovX = 0; this.ovY = 0;
    this.draw({ expr: 'neutral', L: 'hang', R: 'hang' });
  }
  draw(spec) {
    const q = (v, st) => Math.round(v / st) * st;
    const P = spec.exprP || null;
    // redraw only when a QUANTIZED key changes — morphs/blinks still read smooth
    const pKey = P ? ['P', q(P.browInL, .5), q(P.browInR, .5), q(P.browOutL, .5), q(P.openL, .08), q(P.openR, .08),
      q(P.happyL, .12), q(P.squeezeL, .12), q(P.whiteL, .12), q(P.curve, .08), q(P.mOpen, .08), q(P.mW, .1),
      q(P.sweat, .25), q(P.tear, .25), q(P.vein, .25), q(P.heart, .25), q(P.wave, .25), q(P.blush, .25), q(P.spiral, .25)].join(',') : spec.expr;
    const key = [pKey, spec.L, spec.R, q(spec.lid || 0, .18), q(spec.look || 0, .3), q(spec.lookY || 0, .3),
      q(spec.bob || 0, .012), q(spec.step || 0, .06), q(spec.tilt || 0, .05), q(spec.headTilt || 0, .05),
      q(this.ovX, 7), q(this.ovY, 7)].join('|');
    if (key === this.lastKey) return; this.lastKey = key;
    const ctx = this.ctx; ctx.clearRect(0, 0, 600, 1000);
    const pen = new T.Pen(ctx);
    T.romanFront(pen, this.outfit, {
      seed: this.seed, expr: spec.expr, exprP: P, blink: spec.lid || 0,
      look: spec.look || 0, lookY: spec.lookY || 0, L: spec.L, R: spec.R,
      bob: spec.bob || 0, step: spec.step || 0, tilt: spec.tilt || 0, headTilt: spec.headTilt || 0,
    });
    if (this.overlay === 'glasses') {
      const hy = T.headCenter(this.seed), ox = this.ovX, oy = this.ovY;
      ctx.strokeStyle = '#22252c'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(300 + ox + sx * 54, hy + oy + 16, 37, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(300 + ox + sx * 91, hy + oy + 8); ctx.lineTo(300 + ox + sx * 158, hy + oy - 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(263 + ox, hy + oy + 14); ctx.lineTo(337 + ox, hy + oy + 14); ctx.stroke();
    } else if (this.overlay === 'lamp') {
      const hy = T.headCenter(this.seed), ox = this.ovX, oy = this.ovY;
      ctx.fillStyle = '#3a3128'; ctx.fillRect(196 + ox, hy + oy - 82, 208, 27);
      ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(300 + ox, hy + oy - 68, 21, 0, 7); ctx.fill();
      ctx.strokeStyle = '#5d5648'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(300 + ox, hy + oy - 68, 21, 0, 7); ctx.stroke();
      ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(300 + ox, hy + oy - 68, 9, 0, 7); ctx.fill();
    }
    this.tex.needsUpdate = true; this.drawn = spec;
  }
}
const CARDS = {
  engineer: new Card(T.OUTFITS.engineer45, 5),
  worker: new Card(T.OUTFITS.worker45, 8),
  oldman: new Card(T.OUTFITS.oldman45, 8),
  hunter: new Card(T.OUTFITS.hunter, 4, 'lamp'),
  scientist: new Card(T.OUTFITS.scientist, 6, 'glasses'),
  diver: new Card(T.OUTFITS.astro, 7),
  worker2: new Card(T.OUTFITS.worker45, 14),
  hunter2: new Card(T.OUTFITS.hunter, 9, 'lamp'),
};
for (const c of Object.values(CARDS)) c.grp.visible = false;

// ---------- headline board (camera-locked HUD) ----------
const boardCv = document.createElement('canvas'); boardCv.width = 1200; boardCv.height = 340;
const boardTex = new THREE.CanvasTexture(boardCv); boardTex.colorSpace = THREE.SRGBColorSpace;
const board = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 3.0), new THREE.MeshBasicMaterial({ map: boardTex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
board.renderOrder = 999; board.visible = false; scene.add(board);
window.__dbg = { board, camera };
let boardKey = '';
function drawBoard(text) {
  if (!text) { board.visible = false; boardKey = ''; return; }
  if (text === boardKey) { board.visible = true; return; }
  boardKey = text;
  const g = boardCv.getContext('2d'); g.clearRect(0, 0, 1200, 340);
  g.fillStyle = 'rgba(16,20,28,0.88)';
  g.beginPath(); g.roundRect(14, 40, 1172, 250, 34); g.fill();
  g.strokeStyle = '#e8b64c'; g.lineWidth = 7; g.stroke();
  let fs = 118; g.textAlign = 'center'; g.textBaseline = 'middle';
  const setF = () => { g.font = `900 ${fs}px 'DejaVu Sans', sans-serif`; };
  setF(); while (g.measureText(text).width > 1100 && fs > 40) { fs -= 6; setF(); }
  g.lineWidth = 13; g.strokeStyle = '#14100a'; g.strokeText(text, 600, 168);
  g.fillStyle = '#ffd76a'; g.fillText(text, 600, 168);
  boardTex.needsUpdate = true; board.visible = true;
}

// ---------- v2 emotion resolution (pure function of frame — chunk-safe) ----------
const _smoother = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
function emoAt(line, f) {
  if (!line || !line.length) return null;
  let cur = T.faceP(line[0][1]);
  for (let i = 1; i < line.length; i++) {
    const tf = line[i][0], morph = line[i][2] || 9;
    if (f < tf) return cur;
    if (f < tf + morph) return T.blendFaceP(cur, T.faceP(line[i][1]), _smoother((f - tf) / morph));
    cur = T.faceP(line[i][1]);
  }
  return cur;
}
// startle/hop beats: anticipation crouch -> stretch -> landing squash (motion.jumpArc)
const JUMPS = [
  { id: 'engineer', f0: () => S.sealStartFrame() + 3, h: 38, amt: 0.13 },
  { id: 'worker', f0: () => S.sealStartFrame() + 6, h: 30, amt: 0.12 },
  { id: 'scientist', f0: () => S.radarPingFrames()[0], h: 24, amt: 0.11 },
  { id: 'hunter', f0: () => S.finaleWinks()[0] + 1, h: 30, amt: 0.12 },
];

// ---------- per-frame ----------
const _v = new THREE.Vector3(), _l = new THREE.Vector3();
let wheelAng = 0, lastChuff = 0;
let lastRadarBucket = -1;
function renderFrame(f) {
  const t = f / 30, dt = 1 / 30;
  const sec = S.secAt(f), env = S.envAt(f);
  // environment
  paintSky(env.sky, env.hor);
  scene.fog.color.set(env.fog); scene.fog.near = env.fogFar * 0.22; scene.fog.far = env.fogFar;
  hemi.intensity = env.hemi; amb.intensity = env.amb;
  renderer.toneMappingExposure = env.exp || 1.0;
  sun.intensity = env.sunI; sun.color.set(env.sun);
  { const el = env.sunEl * Math.PI / 180, az = env.sunAz * Math.PI / 180; sun.position.set(Math.cos(el) * Math.sin(az) * 320, Math.max(6, Math.sin(el) * 320), Math.cos(el) * Math.cos(az) * 320); }
  sun.target.position.set(0, 0, 0);
  const nightK = clamp((1.15 - env.sunI) / 0.85, 0, 1);
  starMat.opacity = nightK * 0.9; moon.material.opacity = nightK * 0.85;
  clouds.group.children.forEach(cl => cl.traverse(o => { if (o.isSprite && o.renderOrder === 2) o.material.color.set(env.cloud); }));
  clouds.update(t, dt);
  const mistK = (sec === 'hook' || sec === 'cargo' || sec === 'castle' || sec === 'seal') ? 1 : (sec === 'borehole' || sec === 'shape' || sec === 'glint') ? 0 : 0.35;
  mist1.children.forEach((sp, i) => { sp.material.opacity = 0.22 * mistK; sp.position.x += Math.sin(t * 0.1 + i) * 0.004; });
  mist2.children.forEach(sp => { sp.material.opacity = 0.16 * mistK; });
  if (aditWater && aditWater.userData.update) aditWater.userData.update(t);
  for (const fl of castleFlags) FX.clothWave2(fl, t, (tt) => gust(tt, 3));
  // train
  const front = S.trainFrontAt(f), vis = S.trainVisibleAt(f);
  train.grp.visible = vis;
  if (vis) {
    train.grp.position.set(front, 0, 0);
    const sp = S.trainSpeedAt(f);
    wheelAng -= sp / 0.85;
    for (const w of train.wheels) w.m.rotation.z = wheelAng * (0.85 / w.r);
    for (const rd of train.rods) { rd.rod.position.x = -4.7 + Math.cos(wheelAng) * 0.42; rd.rod.position.y = 0.85 + Math.sin(wheelAng) * 0.42; rd.cross.position.x = -1.0 + Math.cos(wheelAng) * 0.42; }
    const speedK = Math.min(1, Math.abs(sp) * 5);
    for (const wg of train.wagons) { wg.g.position.y = Math.sin(f * 0.34 + wg.ph) * 0.04 * speedK; wg.g.rotation.z = Math.sin(f * 0.27 + wg.ph) * 0.005 * speedK; wg.g.rotation.x = Math.cos(f * 0.31 + wg.ph) * 0.004 * speedK; }
    if (train.lampGlow) train.lampGlow.material.opacity = 0.25 + nightK * 0.75;
    if (train.beamCone) train.beamCone.setIntensity(nightK * (sec === 'hook' || sec === 'cargo' ? 0.95 : 0.8) * (0.92 + 0.08 * Math.sin(f * 0.9) * Math.sin(f * 0.37 + 1.3)));
    if (trainRim) trainRim.material.uniforms.uS.value = nightK * 0.5;
    // steam chuffs locked to wheel rotation (4 per revolution) + occasional trackside spark
    const ci = Math.floor(wheelAng / (Math.PI / 2));
    if (ci !== lastChuff && Math.abs(sp) > 0.01) { lastChuff = ci; smoke.spawn(front - 1.5, 5.7, 0, { color: 0x5c646e, opacity: 0.55, scale: 1.25, life: 2.4, vy: 2.6, grow: 1.7 }); }
    if (Math.abs(sp) > 0.004 && f % 2 === 0) smoke.spawn(front - 1.5, 5.7, 0, { color: 0x565e68, opacity: 0.35, scale: 0.9, life: 2.0, vy: 2.0, grow: 1.4 });
    if (sec === 'cargo' && f % 7 === 0) smoke.spawn(front - 1.5, 5.7, 0, { color: 0x6a727c, opacity: 0.3, scale: 0.7, life: 1.6, vy: 1.4, grow: 1.2 });
    // brake hiss + dust at the siding stop (trainStop f162)
    const bAge = f - 156;
    if (sec === 'cargo' && bAge >= 0 && bAge <= 18 && f % 2 === 0) smoke.spawn(front - 7.6, 1.1, 1.5, { color: 0xd8d4cc, opacity: 0.4, scale: 0.6, life: 1.1, vy: 0.7, grow: 1.1 });
  }
  // diorama mini train + slot glints
  diaTrain.position.x = S.diaTrainAt(f);
  const dg = S.diaGlowAt(f);
  diaGlints.forEach((gl, i) => { gl.material.opacity = dg * (0.45 + 0.4 * Math.sin(t * 2 + i * 1.7) ** 2); });
  // rocks at the mouth (base pile fades in just before the seal; last 8 fall)
  const ss = S.sealStartFrame();
  rockMeshes.forEach((m, i) => {
    const r = S.rockAt(i, f);
    const vis = i < S.ROCK_N - 8 ? f >= ss - 8 : f >= ss + (i - (S.ROCK_N - 8)) * 3 - 2;
    m.visible = vis;
    if (vis) {
      m.position.set(r.p[0], r.p[1], r.p[2]);
      if (i >= S.ROCK_N - 8) { // v2: landing squash, springy ring-down
        const sq = landSquash(f, ss + (i - (S.ROCK_N - 8)) * 3 + 16, 0.22), s0 = m.userData.s0;
        m.scale.set(s0 * (1 + sq * 0.4), s0 * (1 - sq * 0.8), s0 * (1 + sq * 0.4));
      }
    }
  });
  if (f >= ss - 2 && f <= ss + 26 && f % 2 === 0) smoke.burst(S.MOUTH_X + 1, 3.4, 0, { n: 3, color: 0x8d8578, opacity: 0.5, scale: 1.4, life: 1.8, spread: 2.2, vy: 1.2 });
  sealDust.forEach((sp, k) => {
    const age = f - (S.sealBoomFrame() + k * 1.6);
    if (age < 0 || age > 52) { sp.material.opacity = 0; return; }
    const a = age / 52;
    sp.position.set(S.MOUTH_X + 1.5 + (h1(k * 3) - 0.5) * 3 + age * 0.11, 1.2 + (h1(k * 7) * 5) + age * 0.045, (h1(k * 5) - 0.5) * 9.5);
    const sc = 1.6 + age * 0.14; sp.scale.set(sc, sc * 0.8, 1);
    sp.material.opacity = 0.5 * (1 - a) * Math.min(1, age / 5 + 0.2);
  });
  // lanterns
  const nightSecs = sec === 'hook' || sec === 'cargo' || sec === 'castle' || sec === 'seal';
  lanternFires.forEach(fr => { fr.on = nightSecs; fr.update(t, dt); });
  mouthLantern.on = sec === 'waiting' || sec === 'finale'; mouthLantern.update(t, dt);
  // radar screen (redraw throttled)
  if (sec === 'radar') {
    const bucket = Math.floor(f / 3);
    if (bucket !== lastRadarBucket) {
      lastRadarBucket = bucket;
      let pulse = 0; for (const pf of S.radarPingFrames()) pulse = Math.max(pulse, clamp(1 - Math.abs(f - pf) / 20, 0, 1));
      drawRadar(S.radarSweepAt(f), pulse);
    }
    if (radarGrp) radarGrp.userData.dish.rotation.z = Math.sin(f * 0.021) * 0.35;
  }
  if (drillString) drillString.rotation.y = f * (sec === 'borehole' ? 0.35 : 0.06);
  // pod + cable + glints
  const pd = S.podAt(f);
  pod.visible = pd.on;
  if (pd.on) {
    pod.position.set(pd.p[0], pd.p[1], pd.p[2]); pod.rotation.set(sec === 'borehole' ? -0.85 : 0, pd.yaw, 0);
    const under = pd.p[1] < -2;
    podCone.setIntensity(under ? 0.8 : 0.38);
    podLight.intensity = under ? 500 : 60;
    podBlink.material.opacity = (f % 30) < 16 ? 0.95 : 0.15;
    const cp = cableGeo.attributes.position.array;
    cp[0] = S.CAV.x; cp[1] = 7.6; cp[2] = S.CAV.z; cp[3] = pd.p[0]; cp[4] = pd.p[1] + 0.3; cp[5] = pd.p[2];
    cableGeo.attributes.position.needsUpdate = true;
  }
  const gp = S.glintPulseAt(f);
  glintMain.material.opacity = gp; const gs = 0.8 + gp * 2.6; glintMain.scale.set(gs, gs, 1);
  glintMain.visible = sec === 'glint' || sec === 'shape';
  mouthGlint.material.opacity = S.finaleGlintAt(f); const mgs = 0.9 + S.finaleGlintAt(f) * 1.8; mouthGlint.scale.set(mgs, mgs, 1);
  // v2 rim/exposure state
  if (shapeRim) shapeRim.material.uniforms.uS.value = sec === 'glint' ? 0.5 + gp * 1.2 : sec === 'shape' ? 0.5 : (sec === 'borehole' || sec === 'waiting') ? 0.16 : 0;
  if (castleRim) castleRim.material.uniforms.uS.value = 0.1 + nightK * 0.28;
  waitLight.intensity = sec === 'waiting' ? 320 : sec === 'finale' ? 140 : 0;
  cavDust.points.visible = sec === 'borehole' || sec === 'shape' || sec === 'glint';
  if (cavDust.points.visible) cavDust.update(t);
  castleWins.forEach((w, i) => { w.material.color.setHSL(0.09, 0.8, (sec === 'castle' ? 0.6 : 0.36) + 0.09 * Math.sin(t * 2.1 + i * 1.9) + nightK * 0.04); });
  if (sec === 'castle' && f % 5 === 0) smoke.spawn(158.9, 123.5, -37, { color: 0x9aa2ae, opacity: 0.3, scale: 0.8, life: 2.6, vy: 1.6, grow: 1.5 });
  if (sec === 'whisper' && f > 700 && f % 5 === 0) smoke.spawn(-94, 7.4, 119, { color: 0xb9c0c8, opacity: 0.28, scale: 0.7, life: 2.4, vy: 1.3, grow: 1.4 });
  // diver lamp + bubbles
  const specs = S.charsAt(f);
  const dv = specs.diver;
  if (dv) {
    diverGlow.position.set(dv.p[0], dv.p[1] + 1.95, dv.p[2] + 0.35); diverGlow.material.opacity = 0.5;
    bubbles.forEach((b, k) => {
      const ph = ((f * 0.55 + k * 41) % 34) / 34;
      b.position.set(dv.p[0] + Math.sin(k * 2.4 + f * 0.05) * 0.35, dv.p[1] + 1.6 + ph * 2.6, dv.p[2] + 0.25);
      b.material.opacity = 0.55 * (1 - ph);
    });
  } else { diverGlow.material.opacity = 0; bubbles.forEach(b => { b.material.opacity = 0; }); }
  // PRO dressing updates
  const snowK = S.seasonAt(f);
  snowPts.material.opacity = snowK * 0.9; snowGround.material.opacity = snowK * 0.38;
  if (snowK > 0.01) {
    const pa = snowGeo.attributes.position.array;
    for (let i = 0; i < SNOW_N; i++) { pa[i * 3] = snowBase[i * 2] + Math.sin(f * 0.03 + i * 1.7) * 1.2; pa[i * 3 + 1] = 26 - ((f * 0.16 + snowBase[i * 2 + 1]) % 26); }
    snowGeo.attributes.position.needsUpdate = true;
  }
  motes.position.x = Math.sin(t * 0.13) * 3; motes.position.y = Math.sin(t * 0.09) * 0.4;
  motes.material.opacity = (sec === 'borehole' || sec === 'shape' || sec === 'glint') ? 0 : 0.38;
  campLantern.rotation.z = Math.sin(t * 1.3) * 0.22; campLantern.rotation.x = Math.cos(t * 0.9) * 0.1;
  campLantern.userData.glow.material.opacity = sec === 'hunters' ? 0.35 + 0.3 * snowK + 0.12 * Math.sin(f * 0.9) : 0;
  diaLights.forEach((lm, i) => {
    const lvl = Math.floor(i / 9), k = i % 9, lampX = 76 + k * 18.5;
    const dxT = S.diaTrainAt(f);
    const near = lvl === 1 ? Math.max(0, 1 - Math.max(0, Math.max(dxT - 30 - lampX, lampX - (dxT + 3))) / 9) : 0;
    lm.material.color.setHSL(0.09, 0.75, (sec === 'castle' ? 0.55 : 0.3) + 0.12 * Math.sin(t * 2.4 + i * 1.3) + near * 0.3);
  });
  podDust.forEach((sp, k) => { sp.material.opacity = (pd.on && pd.p[1] < -2) ? 0.26 : 0; sp.position.x += Math.sin(f * 0.11 + k * 2.1) * 0.0015; sp.position.y += Math.cos(f * 0.09 + k * 1.7) * 0.0015; });
  brakeSparks.forEach((sp, k) => {
    const age = f - 156;
    if (sec === 'cargo' && age >= 0 && age <= 14) {
      sp.position.set(front - 7.6 + (h1(k * 3) - 0.5) * 2.4 - age * 0.05, 0.45 + h1(k * 7) * 0.5 + age * 0.02, (k % 2 ? 1.25 : -1.25));
      sp.material.opacity = 0.85 * (1 - age / 14);
    } else sp.material.opacity = 0;
  });
  smoke.update(t, dt);
  // camera FIRST (cards yaw toward it)
  const cam = S.camAt(f);
  camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
  if (vis && train.beamCone) train.beamCone.update(t, dt, camera);
  if (pd.on && podCone) podCone.update(t, dt, camera);
  const underSec = sec === 'borehole' || sec === 'shape' || sec === 'glint' || sec === 'waiting';
  camLight.intensity = underSec ? 210 : 0;
  if (underSec) camLight.position.copy(camera.position);
  // character cards v2: morphing faces, blinks, tracking pupils, breathing, weighted
  // walk, prop springs, startle jumps with anticipation + landing squash
  for (const [id, c] of Object.entries(CARDS)) {
    const s = specs[id];
    if (!s) { c.grp.visible = false; c.px = null; continue; }
    c.grp.visible = true;
    const dx = s.p[0] - c.grp.position.x, dy = s.p[1] - c.grp.position.y, dz = s.p[2] - c.grp.position.z;
    const k = Math.hypot(dx, dy, dz) > 0.85 ? 1 : 0.5;
    c.grp.position.x += dx * k; c.grp.position.y += dy * k; c.grp.position.z += dz * k;
    // velocity (for walk phase + prop spring)
    const vx = c.px === null ? 0 : c.grp.position.x - c.px, vy = c.px === null ? 0 : c.grp.position.y - c.py, vz = c.px === null ? 0 : c.grp.position.z - c.pz;
    const hSpeed = Math.hypot(vx, vz), walking = hSpeed > 0.02;
    if (walking) c.phase = (c.phase + hSpeed / 2.4) % 1;
    else c.phase += (Math.round(c.phase) - c.phase) * 0.25; // settle legs to neutral
    const wc = walking ? walkCycle2(c.phase) : { bob: 0, lean: 0, sway: 0 };
    const br = breathe(f, c.seed);
    const bob = -br.headY / 236 + (walking ? wc.bob * 0.6 : 0);
    // prop spring: glasses / head-lamp lag behind the body's motion, overshoot, settle
    const [ox, oy] = c.ovSpring.at(clamp(-vx * 60, -30, 30), clamp(-vy * 60, -24, 24), 1 / 30);
    c.ovX = ox; c.ovY = oy;
    // pupils damp toward the authored look target (what the voice names)
    const lt = S.lookAt2(id, f);
    c.lookX += (lt[0] - c.lookX) * 0.3; c.lookY += (lt[1] - c.lookY) * 0.3;
    // startle jumps: airY lifts the whole card, squash deforms it (spring ring-down)
    let airY = 0, squash = 0;
    for (const ev of JUMPS) if (ev.id === id) { const ja = jumpArc(f, ev.f0(), { height: ev.h, amt: ev.amt, crouch: 5, air: 16, settle: 9 }); airY += ja.airY; squash += ja.squash; }
    if (airY) c.grp.position.y += airY * (2.25 / 1000);
    c.grp.scale.set(1 + squash * 0.55, 1 - squash, 1);
    c.blobM.visible = Math.abs(s.p[1]) < 0.15 && airY < 2;
    _v.set(camera.position.x - c.grp.position.x, 0, camera.position.z - c.grp.position.z);
    c.grp.rotation.y = Math.atan2(_v.x, _v.z);
    c.draw({
      expr: s.expr, exprP: emoAt(S.EMOTIONS[id], f), lid: c.blink.at(f),
      look: c.lookX, lookY: c.lookY, L: s.L, R: s.R,
      bob, step: walking ? c.phase : 0,
      tilt: walking ? wc.sway * 0.03 : 0, headTilt: walking ? 0.04 : 0,
    });
    c.px = c.grp.position.x; c.py = c.grp.position.y; c.pz = c.grp.position.z;
  }
  // headline board (HUD, locked to the camera)
  const bs = S.boardAt(f);
  drawBoard(bs ? bs.text : null);
  if (bs) {
    camera.getWorldDirection(_v);
    board.position.copy(camera.position).addScaledVector(_v, 26);
    board.position.y += bs.y !== undefined ? bs.y : 5.2;
    board.quaternion.copy(camera.quaternion);
    const s = bs.s || 1; board.scale.set(s, s, 1);
  }
  renderer.render(scene, camera);
}
window.renderFrame = renderFrame;
renderFrame(0);
window.ready = true;
