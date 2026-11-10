// "1000 KNIGHTS vs 1000 SAMURAI" — three.js battlefield: two instanced armies of exactly 1000,
// hero knight (foot + mounted) and hero samurai, commander cards, arrow storm, dust, banners,
// torii + castle silhouettes, morning mist to dusk torches. All motion from story.js (pure frame math).
import * as THREE from 'three';
import * as S from './story.js';
import * as FX from './fx.js';
import * as T from './toon.js';
import { grass, dirt, stone, tex } from './paint.js';
import { clamp, lerp } from './motion.js';

const cv = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1080, 1920); renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1080 / 1920, 0.1, 2200);
scene.fog = new THREE.Fog(0xc3ced4, 60, 430);
const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x51603c, 0.5); scene.add(hemi);
const amb = new THREE.AmbientLight(0xffffff, 0.5); scene.add(amb);
const sun = new THREE.DirectionalLight(0xffd9a0, 1.7); scene.add(sun); scene.add(sun.target);

// gradient sky dome (repainted when the palette changes)
const bgC = document.createElement('canvas'); bgC.width = 4; bgC.height = 512;
const bgTex = new THREE.CanvasTexture(bgC); bgTex.colorSpace = THREE.SRGBColorSpace;
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 16), new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
let lastSkyKey = '';
function paintSky(top, hor) {
  const key = top + hor; if (key === lastSkyKey) return; lastSkyKey = key;
  const g = bgC.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, top); gr.addColorStop(0.55, top); gr.addColorStop(0.78, hor); gr.addColorStop(1, hor);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512); bgTex.needsUpdate = true;
}

// ---------- small helpers ----------
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...o });
const dummy = new THREE.Object3D();
function mergeGeos(parts) { // parts: [{geo, p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz]}]
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
const blobTexC = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(20,16,8,0.42)'); gr.addColorStop(1, 'rgba(20,16,8,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
function blob(x, z, s = 2.4, parent = scene) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: blobTexC, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.renderOrder = 1; parent.add(m); return m; }

// ---------- ground & scenery ----------
{
  const gtex = tex(grass(6), 46, 24);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 760), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const dtex = tex(dirt(7), 26, 72);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(76, 380), new THREE.MeshStandardMaterial({ map: dtex, roughness: 1 }));
  strip.rotation.x = -Math.PI / 2; strip.position.y = 0.02; scene.add(strip);
  const duelPad = new THREE.Mesh(new THREE.CircleGeometry(13, 28), new THREE.MeshStandardMaterial({ map: tex(dirt(11), 4, 4), roughness: 1 }));
  duelPad.rotation.x = -Math.PI / 2; duelPad.position.set(0, 0.035, -40); scene.add(duelPad);
  // mountains ring
  const mMat = std(0x5d718c, { roughness: 1 }), sMat = std(0xe8eef2, { roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2, R = 395 + (i % 3) * 45, h = 62 + ((i * 37) % 42);
    const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.95, h, 5), mMat);
    m.position.set(Math.cos(a) * R, h / 2 - 4, Math.sin(a) * R - 40); m.rotation.y = i * 1.3; m.scale.set(1.25 + (i % 3) * 0.25, 1, 0.8); scene.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.2, h * 0.22, 5), sMat);
    cap.position.set(m.position.x, h - h * 0.1 - 4, m.position.z); cap.rotation.y = i * 1.3; scene.add(cap);
  }
  // castle WEST (silhouette): keep + twin turrets + wall
  const castle = new THREE.Group(); const stTex = tex(stone(4), 3, 3);
  const cMat = new THREE.MeshStandardMaterial({ map: stTex, roughness: 0.95, color: 0xb9c2cc });
  const roofMat = std(0x3c4656, { roughness: 0.9 });
  const keep = new THREE.Mesh(new THREE.BoxGeometry(34, 58, 30), cMat); keep.position.y = 29; castle.add(keep);
  for (const dz of [-24, 24]) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8.5, 72, 10), cMat); tw.position.set(4, 36, dz); castle.add(tw); const rf = new THREE.Mesh(new THREE.ConeGeometry(10, 16, 10), roofMat); rf.position.set(4, 80, dz); castle.add(rf); }
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(24, 14, 4), roofMat); keepRoof.position.y = 65; keepRoof.rotation.y = Math.PI / 4; castle.add(keepRoof);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 26, 120), cMat); wall.position.set(20, 13, 0); castle.add(wall);
  castle.position.set(-445, 0, -185); castle.rotation.y = 0.5; scene.add(castle);
  // torii + temple EAST
  const torii = new THREE.Group(); const tMat = std(0xa02c22, { roughness: 0.8 });
  for (const dz of [-9, 9]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 17, 8), tMat); p.position.set(0, 8.5, dz); torii.add(p); }
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 30), tMat); l1.position.y = 16.4; torii.add(l1);
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 24), tMat); l2.position.y = 12.6; torii.add(l2);
  torii.position.set(398, 0, 150); torii.rotation.y = -0.4; scene.add(torii);
  const temple = new THREE.Group();
  const tBase = new THREE.Mesh(new THREE.BoxGeometry(30, 13, 40), std(0xd8cfbc, { roughness: 0.95 })); tBase.position.y = 6.5; temple.add(tBase);
  const tRoof = new THREE.Mesh(new THREE.ConeGeometry(30, 11, 4), std(0x37404e, { roughness: 0.9 })); tRoof.position.y = 18.5; tRoof.rotation.y = Math.PI / 4; temple.add(tRoof);
  temple.position.set(452, 0, 205); temple.rotation.y = -0.5; scene.add(temple);
  // scattered pines at the field edges
  const trunkM = std(0x5a4230), leafM = std(0x39543a, { roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, x = side * (180 + (i * 53) % 190), z = -260 + (i * 97) % 480; if (Math.abs(z) < 190 && Math.abs(x) < 210) continue;
    const tr = new THREE.Group();
    const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.4, 6), trunkM); tk.position.y = 1.7; tr.add(tk);
    for (let k = 0; k < 3; k++) { const cn = new THREE.Mesh(new THREE.ConeGeometry(3.4 - k * 0.8, 3.6, 7), leafM); cn.position.y = 4 + k * 1.9; tr.add(cn); }
    tr.position.set(x, 0, z); tr.scale.setScalar(1.3 + (i % 3) * 0.35); scene.add(tr);
  }
  // (the duel pad is the verdict stage — no rises; the clearing keeps it open)
}
// clouds + morning mist
const clouds = new FX.Clouds(scene, { count: 10, y: 36, opacity: 0.8 });
const mist1 = FX.mistBand(scene, { count: 9, y: 1.7, opacity: 0.15 });
const mist2 = FX.mistBand(scene, { count: 7, y: 2.6, opacity: 0.1 }); mist2.position.z = -120;
// torches around the duel ground + finale rise (lit at dusk)
const torchFires = [];
{
  const postM = std(0x4a3826, { roughness: 1 });
  for (const [x, z] of [[-9, -31], [9, -31], [-9, -49], [9, -49], [-30, -6], [30, 6]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.7, 6), postM); p.position.set(x, 0.85, z); scene.add(p);
    const fire = new FX.Fire(scene, { x, y: 1.85, z, scale: 0.55, rate: 16, max: 14 }); fire.on = false;
    torchFires.push(fire);
  }
}

// ---------- armies (exactly 1000 a side, instanced) ----------
const allIdx = Array.from({ length: S.N_SIDE }, (_, i) => i);
function instPart(geo, mat, idxs, parent, place) {
  const m = new THREE.InstancedMesh(geo, mat, idxs.length);
  m.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  idxs.forEach((si, k) => { place(si, k); m.setMatrixAt(k, dummy.matrix); });
  m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; parent.add(m); return m;
}
const STEEL = std(0xaeb6bd, { roughness: 0.45, metalness: 0.55 });
const STEEL_D = std(0x878e96, { roughness: 0.5, metalness: 0.5 });
function flagTexture(kind) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160; const g = c.getContext('2d');
  if (kind === 'kni') { g.fillStyle = '#ece5d2'; g.fillRect(0, 0, 128, 160); g.fillStyle = '#c0272d'; g.fillRect(54, 14, 20, 132); g.fillRect(16, 62, 96, 20); }
  else { g.fillStyle = '#2e4370'; g.fillRect(0, 0, 128, 160); g.fillStyle = '#f2ede0'; g.beginPath(); g.arc(64, 74, 30, 0, 7); g.fill(); g.fillStyle = '#2e4370'; g.beginPath(); g.arc(64, 74, 17, 0, 7); g.fill(); g.fillStyle = '#f2ede0'; g.beginPath(); g.arc(64, 74, 7, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildArmy(side) {
  const kni = side === 'kni', grp = new THREE.Group(); scene.add(grp);
  const parts = []; // knight parts are re-laid-out in world space as the charge shift moves
  const reg = (mesh, idxs) => { if (kni) parts.push({ mesh, idxs }); return mesh; };
  const place = (si) => { const [x, , z] = S.fleetPosAt(side, si, 0); dummy.position.set(x, 0, z); dummy.rotation.set(0, kni ? 0 : Math.PI, 0); dummy.updateMatrix(); };
  const P = place;
  // legs / body / head / helm
  const legsGeo = new THREE.BoxGeometry(0.5, 0.75, 0.37); legsGeo.translate(0, 0.375, 0);
  reg(instPart(legsGeo, std(kni ? 0x707880 : 0x2c3550), allIdx, grp, P), allIdx);
  const bodyGeo = new THREE.BoxGeometry(0.66, 0.82, 0.45); bodyGeo.translate(0, 1.16, 0);
  const white = allIdx.filter(i => (i * 7) % 10 < 7), steel = allIdx.filter(i => (i * 7) % 10 >= 7);
  if (kni) { reg(instPart(bodyGeo, std(0xded7c6), white, grp, P), white); reg(instPart(bodyGeo, STEEL, steel, grp, P), steel); }
  else { const ind = allIdx.filter(i => (i * 7) % 10 < 8), red = allIdx.filter(i => (i * 7) % 10 >= 8); instPart(bodyGeo, std(0x2e4370), ind, grp, P); instPart(bodyGeo, std(0x8f2f2a), red, grp, P); }
  const headGeo = new THREE.SphereGeometry(0.21, 8, 7); headGeo.translate(0, 1.79, 0);
  reg(instPart(headGeo, std(kni ? 0xf0c297 : 0xeab98d), allIdx, grp, P), allIdx);
  const helmGeo = kni
    ? mergeGeos([{ geo: new THREE.CylinderGeometry(0.235, 0.26, 0.2, 8), p: [0, 1.97, 0] }, { geo: new THREE.SphereGeometry(0.235, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), p: [0, 2.05, 0] }, { geo: new THREE.CylinderGeometry(0.31, 0.31, 0.045, 10), p: [0, 1.9, 0] }])
    : mergeGeos([{ geo: new THREE.SphereGeometry(0.245, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), p: [0, 1.9, 0] }, { geo: new THREE.CylinderGeometry(0.3, 0.34, 0.12, 8), p: [0, 1.83, 0] }]);
  reg(instPart(helmGeo, kni ? STEEL : std(0x272c36, { roughness: 0.5, metalness: 0.4 }), allIdx, grp, P), allIdx);
  if (kni) {
    const lanceGeo = new THREE.CylinderGeometry(0.028, 0.05, 3.3, 5); lanceGeo.translate(0, 1.65, 0); lanceGeo.rotateZ(-Math.PI / 2 + 0.32); lanceGeo.translate(0.75, 1.62, -0.3);
    reg(instPart(lanceGeo, std(0x7a5c38), allIdx, grp, P), allIdx);
  } else {
    const bowGeo = new THREE.TorusGeometry(0.56, 0.035, 5, 10, Math.PI * 1.05); bowGeo.rotateZ(Math.PI / 2 - 0.5); bowGeo.rotateY(Math.PI / 2); bowGeo.translate(0.5, 1.45, -0.34);
    instPart(bowGeo, std(0x4a3421), allIdx.filter(i => i < 80), grp, P);
    const katGeo = new THREE.BoxGeometry(0.78, 0.05, 0.11); katGeo.translate(0.1, 0.92, -0.3); katGeo.rotateY(0.5);
    instPart(katGeo, STEEL_D, allIdx.filter(i => i >= 80), grp, P);
  }
  // banner poles + cloth flags (10 a side, cloth-waved per frame)
  const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, 3.7, 5); poleGeo.translate(0, 1.85, 0);
  const bIdx = allIdx.filter(i => S.bannerIdx(i));
  reg(instPart(poleGeo, std(0x4a3826), bIdx, grp, P), bIdx);
  const cloths = [];
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTexture(side), side: THREE.DoubleSide, roughness: 0.9 });
  for (const si of bIdx) {
    const [x, , z] = S.fleetPosAt(side, si, 0);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.45, 6, 4), flagMat);
    fl.geometry.translate(0.575, 0, 0); // hoist at the pole
    fl.position.set(x, 2.85, z); fl.rotation.y = kni ? 0 : Math.PI;
    FX.clothInit(fl, { amp: 0.16, freq: 3.2, speed: 7 });
    (kni ? scene : grp).add(fl); cloths.push(fl); // knight cloths live in world space (layout moves them)
  }
  return { grp, cloths, parts, bannerIdxs: bIdx };
}
const armyK = buildArmy('kni'), armyS = buildArmy('sam');
// knight shields get their own mesh so they can rise for the arrow storm
const shieldMesh = (() => {
  const geo = new THREE.BoxGeometry(0.09, 0.98, 0.64);
  const m = new THREE.InstancedMesh(geo, std(0xe6dfca, { roughness: 0.6 }), S.N_SIDE);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; armyK.grp.add(m); return m;
})();
let lastShield = -1;
function updateShields(f) {
  const up = S.fleetShieldAt(f); if (Math.abs(up - lastShield) < 0.004 && lastShield >= 0) return; lastShield = up;
  for (let i = 0; i < S.N_SIDE; i++) {
    const [x, y, z] = S.fleetPosAt('kni', i, f);
    dummy.position.set(x + 0.44, y + 1.12 + up * 0.18, z);
    dummy.rotation.set(0, 0, -up * 0.5); dummy.updateMatrix(); shieldMesh.setMatrixAt(i, dummy.matrix);
  }
  shieldMesh.instanceMatrix.needsUpdate = true;
}
// knights live in world space: when the charge shift moves, re-lay every part from story
// (this is what opens the duel clearing — soldiers crowd onto its rim as they arrive).
let lastKShift = -1;
function layoutKnights(f) {
  for (const { mesh, idxs } of armyK.parts) {
    idxs.forEach((si, k) => { const [x, y, z] = S.fleetPosAt('kni', si, f); dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix); });
    mesh.instanceMatrix.needsUpdate = true;
  }
  armyK.cloths.forEach((fl, i) => { const [x, y, z] = S.fleetPosAt('kni', armyK.bannerIdxs[i], f); fl.position.set(x, 2.85 + y, z); });
  lastKShift = S.shiftAt('kni', f); lastShield = -1; // shields re-seat at the new positions
}
// ---------- cavalry: 40 horses at the knight front rank, riders aboard ----------
const cav = (() => {
  const grp = new THREE.Group(); scene.add(grp); // rides the charge shift in world space
  const horseGeo = mergeGeos([
    { geo: new THREE.BoxGeometry(2.0, 0.78, 0.62), p: [0, 1.32, 0] },
    { geo: new THREE.BoxGeometry(0.78, 0.72, 0.4), p: [1.05, 1.78, 0], r: [0, 0, -0.6] },
    { geo: new THREE.BoxGeometry(0.62, 0.3, 0.32), p: [1.52, 2.02, 0], r: [0, 0, -0.25] },
    { geo: new THREE.BoxGeometry(0.5, 0.62, 0.14), p: [-1.12, 1.6, 0], r: [0, 0, 0.5] }, // tail
  ]);
  const legGeo = mergeGeos([[0.78, 0.3], [0.78, -0.3], [-0.78, 0.3], [-0.78, -0.3]].map(([lx, lz]) => ({ geo: new THREE.BoxGeometry(0.17, 1.0, 0.17), p: [lx, 0.5, lz] })));
  const horses = new THREE.InstancedMesh(horseGeo, std(0x6e5138, { roughness: 0.95 }), 40);
  const legs = new THREE.InstancedMesh(legGeo, std(0x5d4430, { roughness: 0.95 }), 40);
  const riderGeo = mergeGeos([
    { geo: new THREE.BoxGeometry(0.6, 0.78, 0.42), p: [0, 2.28, 0] },
    { geo: new THREE.SphereGeometry(0.2, 8, 7), p: [0, 2.9, 0] },
    { geo: new THREE.CylinderGeometry(0.23, 0.25, 0.18, 8), p: [0, 3.05, 0] },
    { geo: new THREE.CylinderGeometry(0.026, 0.045, 3.1, 5), p: [0.85, 2.6, -0.3], r: [0, 0, -Math.PI / 2 + 0.3] },
  ]);
  const riders = new THREE.InstancedMesh(riderGeo, STEEL, 40);
  for (const m of [horses, legs, riders]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; grp.add(m); }
  return { grp, horses, legs, riders };
})();
function updateCavalry(f) {
  const sec = S.secAt(f);
  const run = sec === 'charge' ? 1 : sec === 'warhorse' ? 0.55 : sec === 'arrows' ? 0.1 : 0.25;
  for (let r = 0; r < 40; r++) {
    const z = S.gridZ(r), x = -33.5;
    const ph = f * 0.5 + r * 1.31, bob = Math.abs(Math.sin(ph)) * 0.14 * run, rock = Math.sin(ph) * 0.05 * run;
    dummy.position.set(x, bob, z); dummy.rotation.set(0, 0, rock); dummy.updateMatrix();
    cav.horses.setMatrixAt(r, dummy.matrix); cav.riders.setMatrixAt(r, dummy.matrix);
    dummy.position.set(x, bob * 0.4, z); dummy.rotation.set(Math.sin(ph) * 0.16 * run, 0, 0); dummy.updateMatrix();
    cav.legs.setMatrixAt(r, dummy.matrix);
  }
  cav.horses.instanceMatrix.needsUpdate = true; cav.legs.instanceMatrix.needsUpdate = true; cav.riders.instanceMatrix.needsUpdate = true;
}

// ---------- heroes (detailed figures; upper-body pivot so the bow reads) ----------
function crossDecal(w = 0.34, h = 0.52, col = 0xc0272d) {
  const g = new THREE.Group(), m = std(col, { roughness: 0.7 });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, w * 0.36), m); g.add(v);
  const hz = new THREE.Mesh(new THREE.BoxGeometry(0.02, h * 0.34, w), m); hz.position.y = h * 0.14; g.add(hz);
  return g;
}
function swordBlade(len = 1.05, col = 0xd7dde3) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(len, 0.045, 0.1), std(col, { roughness: 0.3, metalness: 0.7 })); blade.position.x = len / 2 + 0.12; g.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.2), std(0xc9a227, { roughness: 0.4, metalness: 0.6 })); guard.position.x = 0.1; g.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), std(0x4a3421)); grip.rotation.z = Math.PI / 2; g.add(grip);
  return g;
}
function buildKnightFigure() {
  const root = new THREE.Group(), upper = new THREE.Group(); upper.position.y = 1.02; root.add(upper);
  const legM = STEEL_D;
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 0.22), legM); leg.position.set(0, 0.5, s * 0.21); root.add(leg); }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.78, 0.72), std(0xe9e2cf)); torso.position.y = 0.42; upper.add(torso);
  const cross = crossDecal(0.4, 0.6); cross.position.set(0.27, 0.42, 0); upper.add(cross);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.74), std(0x6b4a2c)); belt.position.y = 0.06; upper.add(belt);
  for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), STEEL); sh.position.set(0, 0.78, s * 0.44); upper.add(sh); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), std(0xf0c297)); head.position.y = 1.12; upper.add(head);
  const helm = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), STEEL); dome.position.y = 0.03; helm.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 12), STEEL); brim.position.y = 0.02; helm.add(brim);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 7), std(0xc0272d)); plume.position.y = 0.36; helm.add(plume);
  helm.position.y = 1.14; upper.add(helm);
  const armR = new THREE.Group(); armR.position.set(0, 0.72, -0.48); upper.add(armR);
  const aR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.62), STEEL); aR.position.z = -0.3; armR.add(aR);
  const sword = swordBlade(1.1); sword.position.set(0, 0, -0.62); sword.rotation.y = Math.PI / 2; armR.add(sword);
  const armL = new THREE.Group(); armL.position.set(0, 0.72, 0.48); upper.add(armL);
  const aL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.58), STEEL); aL.position.z = 0.28; armL.add(aL);
  const shield = new THREE.Group();
  const shM = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.66), std(0xe9e2cf, { roughness: 0.55 })); shield.add(shM);
  const sc = crossDecal(0.36, 0.56); sc.position.x = 0.05; shield.add(sc);
  shield.position.set(0.18, -0.25, 0.36); armL.add(shield);
  root.userData = { upper, armR, armL, shield };
  scene.add(root); return root;
}
function buildSamuraiFigure() {
  const root = new THREE.Group(), upper = new THREE.Group(); upper.position.y = 1.02; root.add(upper);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.44, 0.95, 8), std(0x27334e)); skirt.position.y = 0.5; root.add(skirt);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.76, 0.7), std(0x2e4370)); torso.position.y = 0.42; upper.add(torso);
  for (let r = 0; r < 4; r++) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.545, 0.09, 0.725), std(r % 2 ? 0x35497a : 0x2a3c66)); band.position.y = 0.16 + r * 0.18; upper.add(band); }
  const mon = new THREE.Mesh(new THREE.CircleGeometry(0.13, 14), std(0xf2ede0)); mon.position.set(0.265, 0.48, 0); mon.rotation.y = Math.PI / 2; upper.add(mon);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), std(0xeab98d)); head.position.y = 1.12; upper.add(head);
  const kab = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.295, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(0x272c36, { roughness: 0.45, metalness: 0.4 })); bowl.position.y = 0.04; kab.add(bowl);
  for (let k = 0; k < 3; k++) { const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.31 + k * 0.045, 0.34 + k * 0.045, 0.09, 10, 1, false, Math.PI * 0.55, Math.PI * 0.9), std(k % 2 ? 0x24334f : 0x2e4370)); fl.position.y = -0.02 - k * 0.085; kab.add(fl); }
  const cres = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 12, Math.PI * 1.5), std(0xe8b64c, { roughness: 0.35, metalness: 0.6 })); cres.position.set(0.1, 0.44, 0); cres.rotation.z = Math.PI * 0.75; kab.add(cres);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 5), std(0xc9a227, { metalness: 0.6, roughness: 0.4 })); stem.position.set(0.02, 0.33, 0); kab.add(stem);
  kab.position.y = 1.13; upper.add(kab);
  for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.24), std(0x35497a)); sh.position.set(0, 0.8, s * 0.44); sh.rotation.x = s * 0.25; upper.add(sh); }
  const armR = new THREE.Group(); armR.position.set(0, 0.72, 0.48); upper.add(armR);
  const aR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.58), std(0x35497a)); aR.position.z = 0.27; armR.add(aR);
  const kat = swordBlade(0.95, 0xe8edf2); kat.position.set(0, 0, 0.56); kat.rotation.y = -Math.PI / 2; armR.add(kat);
  const armL = new THREE.Group(); armL.position.set(0, 0.72, -0.48); upper.add(armL);
  const aL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.58), std(0x35497a)); aL.position.z = -0.27; armL.add(aL);
  const bowG = new THREE.Group();
  const bowArc = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 5, 12, Math.PI * 1.1), std(0x4a3421)); bowArc.rotation.y = Math.PI / 2; bowArc.rotation.x = 0; bowG.add(bowArc);
  bowG.position.set(0.34, 0.1, -0.62); bowG.rotation.z = 0.2; armL.add(bowG);
  const quiver = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), std(0x6b4a2c)); quiver.position.set(-0.33, 0.45, -0.2); quiver.rotation.z = 0.3; upper.add(quiver);
  root.userData = { upper, armR, armL, bowG };
  scene.add(root); return root;
}
function buildHeroHorse() {
  const g = new THREE.Group();
  const bodyM = std(0x74563c, { roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 0.74), bodyM); body.position.y = 1.5; g.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.44), bodyM); neck.position.set(1.2, 2.0, 0); neck.rotation.z = -0.6; g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.36), bodyM); head.position.set(1.75, 2.3, 0); head.rotation.z = -0.25; g.add(head);
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.1), std(0x3d2c1c)); mane.position.set(1.05, 2.15, 0); mane.rotation.z = -0.6; g.add(mane);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.13), std(0x3d2c1c)); tail.position.set(-1.3, 1.8, 0); tail.rotation.z = 0.5; g.add(tail);
  const legs = [];
  for (const [lx, lz] of [[0.9, 0.3], [0.9, -0.3], [-0.9, 0.3], [-0.9, -0.3]]) {
    const pivot = new THREE.Group(); pivot.position.set(lx, 1.15, lz);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 1.15, 0.19), std(0x644832)); leg.position.y = -0.55; pivot.add(leg); g.add(pivot); legs.push(pivot);
  }
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.8), std(0x6b4a2c)); saddle.position.set(-0.1, 2.0, 0); g.add(saddle);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.8), std(0xe9e2cf)); cloth.position.set(-0.1, 1.68, 0); g.add(cloth);
  const cross = crossDecal(0.3, 0.4); cross.rotation.y = Math.PI / 2; cross.position.set(-0.1, 1.68, 0.42); g.add(cross);
  const cross2 = crossDecal(0.3, 0.4); cross2.rotation.y = Math.PI / 2; cross2.position.set(-0.1, 1.68, -0.42); g.add(cross2);
  g.userData = { legs };
  scene.add(g); return g;
}
const knightFoot = buildKnightFigure(), knightHorse = buildHeroHorse(), samuraiFig = buildSamuraiFigure();
const knightRider = buildKnightFigure();
{ // the rider needs no legs — his torso sits on the saddle (legs would clip through the horse)
  const legs = knightRider.children.filter(c => c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y === 0.5);
  for (const l of legs) knightRider.remove(l);
  knightRider.visible = false;
}
const blobK = blob(0, 0, 3), blobS = blob(0, 0, 3);
function updateHeroes(f) {
  const K = S.heroKnightAt(f), Sm = S.heroSamuraiAt(f);
  const mounted = K.mode === 'horse';
  knightFoot.visible = !mounted; knightHorse.visible = mounted; knightRider.visible = mounted;
  const fig = mounted ? knightRider : knightFoot;
  if (mounted) {
    knightHorse.position.set(K.p[0], K.p[1], K.p[2]); knightHorse.rotation.y = -K.ry;
    const run = K.gallop || 0;
    knightHorse.userData.legs.forEach((leg, i) => { leg.rotation.z = Math.sin(f * 0.55 + (i % 2) * Math.PI + (i > 1 ? 0.6 : 0)) * 0.55 * run; });
    knightRider.position.set(K.p[0], K.p[1] + 1.02, K.p[2]); knightRider.rotation.y = K.ry;
    knightRider.userData.upper.rotation.z = -0.06;
    knightRider.userData.armR.rotation.z = -K.sword * 1.35 + 0.25;
    knightRider.userData.armL.rotation.x = 0;
    knightRider.userData.shield.position.x = 0.18 + K.shieldUp * 0.14;
    blobK.position.set(K.p[0], 0.03, K.p[2]); blobK.scale.setScalar(1.6);
  } else {
    knightFoot.position.set(K.p[0], K.p[1], K.p[2]); knightFoot.rotation.y = K.ry;
    knightFoot.userData.upper.rotation.z = -K.bow * 0.52;
    knightFoot.userData.armR.rotation.z = -K.sword * 1.35 + 0.25;
    knightFoot.userData.shield.position.x = 0.18 + K.shieldUp * 0.16;
    blobK.position.set(K.p[0], 0.03, K.p[2]); blobK.scale.setScalar(1);
  }
  samuraiFig.position.set(Sm.p[0], Sm.p[1], Sm.p[2]); samuraiFig.rotation.y = Sm.ry;
  samuraiFig.userData.upper.rotation.z = -Sm.bow * 0.52;
  const shooting = (Sm.draw || 0) > 0.03;
  samuraiFig.userData.bowG.visible = shooting || S.secAt(f) === 'light';
  samuraiFig.userData.armR.rotation.z = shooting ? Sm.draw * 0.85 : -Sm.sword * 1.35 + 0.25;
  samuraiFig.userData.armR.rotation.x = shooting ? -0.4 : 0;
  blobS.position.set(Sm.p[0], 0.03, Sm.p[2]);
}
// ---------- the leaf ----------
const leafG = (() => {
  const g = new THREE.Group();
  const lm = std(0x5d8a3c, { roughness: 0.8, side: THREE.DoubleSide });
  const whole = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34), lm); whole.name = 'whole'; g.add(whole);
  const h1 = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.34), lm); h1.name = 'h1'; h1.position.x = -0.14; g.add(h1);
  const h2 = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.34), lm); h2.name = 'h2'; h2.position.x = 0.14; g.add(h2);
  scene.add(g); return g;
})();
// ---------- arrows ----------
const arrowMesh = (() => {
  const geo = mergeGeos([
    { geo: new THREE.CylinderGeometry(0.022, 0.022, 1.15, 5), r: [0, 0, Math.PI / 2], p: [0, 0, 0] },
    { geo: new THREE.ConeGeometry(0.05, 0.22, 6), r: [0, 0, -Math.PI / 2], p: [0.68, 0, 0] },
    { geo: new THREE.BoxGeometry(0.16, 0.02, 0.12), p: [-0.55, 0, 0] },
  ]);
  const m = new THREE.InstancedMesh(geo, std(0x8a6c44, { roughness: 0.9 }), 320);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); return m;
})();
function updateArrows(f) {
  const arr = S.arrowsAt(f); let n = 0;
  for (const a of arr) {
    if (n >= 320) break;
    dummy.position.set(a.p[0], a.p[1], a.p[2]);
    dummy.rotation.set(0, 0, a.ang); dummy.updateMatrix();
    arrowMesh.setMatrixAt(n++, dummy.matrix);
  }
  dummy.position.set(0, -50, 0); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
  for (let i = n; i < 320; i++) arrowMesh.setMatrixAt(i, dummy.matrix);
  arrowMesh.instanceMatrix.needsUpdate = true;
}
// ---------- commander cards ----------
class Card {
  constructor(outfit) {
    this.cvs = document.createElement('canvas'); this.cvs.width = 600; this.cvs.height = 1000;
    this.texC = new THREE.CanvasTexture(this.cvs); this.texC.colorSpace = THREE.SRGBColorSpace; this.texC.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.texC, transparent: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.25), this.mat);
    this.grp = new THREE.Group(); this.grp.add(this.mesh);
    this.mesh.position.y = 1.125;
    this.blob = blob(0, 0, 2.2); this.grp.add(this.blob); this.blob.position.y = 0.02;
    this.outfit = outfit; this.key = ''; this.grp.visible = false;
    scene.add(this.grp);
  }
  set(spec, f) {
    if (!spec) { this.grp.visible = false; return; }
    this.grp.visible = true;
    this.grp.position.lerp(new THREE.Vector3(spec.p[0], spec.p[1], spec.p[2]), this.key ? 0.5 : 1);
    const bob = Math.sin(f * 0.09) * 0.05, blink = (f % 97) < 3 ? 0.9 : 0;
    const key = [spec.expr, spec.R, spec.L, Math.round(bob * 40), blink, Math.round(Math.sin(f * 0.14) * 3)].join('|');
    if (key !== this.key) {
      this.key = key;
      const p = new T.Pen(this.cvs.getContext('2d'));
      T.romanFront(p, this.outfit, { seed: 11, expr: spec.expr, R: spec.R, L: spec.L, blink, bob, tilt: Math.sin(f * 0.05) * 2.5, wv: f * 0.14 });
      this.texC.needsUpdate = true;
    }
  }
  yawTo(camPos) { if (this.grp.visible) this.grp.rotation.y = Math.atan2(camPos.x - this.grp.position.x, camPos.z - this.grp.position.z); }
}
const cmdK = new Card('cmdKnight'), cmdS = new Card('cmdSamurai');
// ---------- board (camera-locked HUD card, tanks pattern) ----------
const board = (() => {
  const cvs = document.createElement('canvas'); cvs.width = 1200; cvs.height = 340;
  const texC = new THREE.CanvasTexture(cvs); texC.colorSpace = THREE.SRGBColorSpace; texC.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: texC, transparent: true, depthTest: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.82), mat);
  mesh.renderOrder = 999; mesh.visible = false; scene.add(mesh);
  let lastKey = '';
  return {
    set(spec) {
      if (!spec || spec.s <= 0.01) { mesh.visible = false; lastKey = ''; return; }
      if (spec.text !== lastKey) {
        lastKey = spec.text;
        const g = cvs.getContext('2d'); g.clearRect(0, 0, 1200, 340);
        g.fillStyle = 'rgba(16,14,8,0.88)'; g.beginPath(); g.roundRect(6, 6, 1188, 328, 36); g.fill();
        g.lineWidth = 10; g.strokeStyle = '#ffd76a'; g.stroke();
        g.fillStyle = '#ffd76a'; g.textAlign = 'center'; g.textBaseline = 'middle';
        let size = 118;
        g.font = `900 ${size}px Arial, sans-serif`;
        while (g.measureText(spec.text).width > 1120 && size > 40) { size -= 6; g.font = `900 ${size}px Arial, sans-serif`; }
        g.fillText(spec.text, 600, 176);
        texC.needsUpdate = true;
      }
      mesh.visible = true;
      mat.opacity = Math.min(1, spec.s * 1.4);
      const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
      mesh.position.copy(camera.position).addScaledVector(fwd, 6.8);
      mesh.position.y += 1.35;
      mesh.quaternion.copy(camera.quaternion);
      const sc = 0.8 + 0.35 * spec.s; mesh.scale.set(sc, sc, 1);
    }
  };
})();

// ---------- FX: dust, sparks, smoke ----------
const smoke = new FX.Smoke(scene, 150);
const sparks = [];
for (let i = 0; i < 8; i++) { const s = FX.glint(1.6); s.visible = false; scene.add(s); sparks.push(s); }
const fired = new Set();
function fireEvents(f) {
  const t = f / S.FPS, sec = S.secAt(f);
  if ((sec === 'charge' || sec === 'warhorse') && f % 2 === 0) {
    const fr = sec === 'charge' ? S.chargeFrontAt(f) : S.heroKnightAt(f).p[0];
    for (let k = 0; k < 2; k++) smoke.spawn(fr - 2 - Math.random() * 6, 0.5, -60 + Math.random() * 110, { color: 0xbaa26e, opacity: 0.32, scale: 1.6 + Math.random() * 1.6, life: 1.4 + Math.random(), vy: 0.7, wind: -0.4 });
  }
  if (sec === 'arrows' && f % 3 === 0) { const fr = S.chargeFrontAt(f); smoke.spawn(fr + Math.random() * 4, 0.4, -70 + Math.random() * 130, { color: 0xa89468, opacity: 0.22, scale: 1.2 + Math.random(), life: 1.1, vy: 0.5 }); }
  const AH = S.armHitFrame(), CUT = S.leafCutFrame();
  if (f >= AH && f <= AH + 4 && !fired.has('ah' + f)) { fired.add('ah' + f); const s = sparks[f % 8]; s.position.set(S.KNIGHT_HOME[0] + 0.6, 1.5, S.KNIGHT_HOME[2]); s.visible = true; s.material.opacity = 1; s.scale.setScalar(0.55 + (f - AH) * 0.16); }
  if (f === AH) smoke.burst(S.KNIGHT_HOME[0] + 0.5, 1.4, S.KNIGHT_HOME[2], { n: 5, color: 0xd8d8d8, opacity: 0.5, scale: 0.7, life: 0.7, vy: 1.2 });
  for (const cf of S.clashFrames()) if (f >= cf && f <= cf + 4 && !fired.has('cl' + f)) {
    fired.add('cl' + f); const s = sparks[(f + 3) % 8]; s.position.set(0, 1.55, -40); s.visible = true; s.material.opacity = 1; s.scale.setScalar(1.1 + (f - cf) * 0.35);
    if (f === cf) smoke.burst(0, 1.4, -40, { n: 6, color: 0xcfc4a8, opacity: 0.4, scale: 0.8, life: 0.8, vy: 0.9 });
  }
  if (f >= CUT && f <= CUT + 3 && !fired.has('lf' + f)) { fired.add('lf' + f); const s = sparks[(f + 5) % 8]; s.position.set(18.6, 1.5, 4.6); s.visible = true; s.material.opacity = 0.9; s.scale.setScalar(0.5 + (f - CUT) * 0.14); }
  for (const s of sparks) if (s.visible) { s.material.opacity -= 0.16; if (s.material.opacity <= 0) s.visible = false; }
  smoke.update(t, 1 / S.FPS);
}
// ---------- frame ----------
const _v = new THREE.Vector3();
function renderFrame(f) {
  const env = S.envAt(f), t = f / S.FPS;
  paintSky(env.sky, env.hor);
  scene.fog.color.set(env.fog); scene.fog.far = env.fogFar; scene.fog.near = env.fogFar * 0.25;
  const el = env.sunEl * Math.PI / 180, az = env.sunAz * Math.PI / 180;
  sun.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(300);
  sun.color.set(env.sun); sun.intensity = env.sunI;
  hemi.intensity = env.hemi; amb.intensity = env.amb;
  renderer.toneMappingExposure = env.exp;
  clouds.group.children.forEach(c => c.children.forEach(p => { p.material.color.set(env.cloud); }));
  clouds.update(t, 1 / S.FPS);
  const mistAmt = clamp(1.2 - (f / S.TOTAL) * 1.5, 0.12, 1) * (f < S.SECTION.knight[1] ? 1 : Math.max(0, 1 - (f - S.SECTION.knight[1]) / 90)); // morning only — fully gone by mid-armour
  mist1.children.forEach(s => { s.material.opacity = 0.15 * mistAmt; });
  mist2.children.forEach(s => { s.material.opacity = 0.1 * mistAmt; });
  // armies ride their group shifts; bob while charging
  if (Math.abs(S.shiftAt('kni', f) - lastKShift) > 0.02 || lastKShift < 0) layoutKnights(f);
  cav.grp.position.x = S.shiftAt('kni', f);
  armyS.grp.position.x = S.shiftAt('sam', f);
  updateShields(f); updateCavalry(f);
  for (const fl of [...armyK.cloths, ...armyS.cloths]) FX.clothWave(fl, t + fl.position.z);
  updateHeroes(f); updateArrows(f);
  // leaf
  const lf = S.leafAt(f);
  leafG.visible = !!lf;
  if (lf) {
    leafG.position.set(lf.p[0], lf.p[1], lf.p[2]); leafG.rotation.set(0.4, 0.3, lf.rot);
    const whole = leafG.getObjectByName('whole'), h1 = leafG.getObjectByName('h1'), h2 = leafG.getObjectByName('h2');
    whole.visible = lf.split <= 0; h1.visible = h2.visible = lf.split > 0;
    h1.position.x = -0.14 - lf.split * 0.4; h1.rotation.z = lf.split * 0.9;
    h2.position.x = 0.14 + lf.split * 0.4; h2.rotation.z = -lf.split * 0.9;
  }
  // torches at dusk
  const dusk = clamp((f - S.SECTION.sunset[0]) / 90, 0, 1);
  for (const fire of torchFires) { fire.on = dusk > 0.25; fire.update(t, 1 / S.FPS); }
  fireEvents(f);
  cmdK.set(S.cmdrAt('cmdKnight', f), f); cmdS.set(S.cmdrAt('cmdSamurai', f), f);
  const cam = S.camAt(f);
  camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
  cmdK.yawTo(camera.position); cmdS.yawTo(camera.position);
  board.set(S.boardAt(f));
  renderer.render(scene, camera);
}
window.renderFrame = renderFrame;
try { renderFrame(0); window.ready = true; } catch (e) { window.err = String(e && e.message || e); console.log('ERR', window.err); }
