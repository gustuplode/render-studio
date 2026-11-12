// MH Studio — coded three.js props library (reusable builders, units = meters).
import * as THREE from 'three';

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0, ...opts });
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function sph(r, mat, x = 0, y = 0, z = 0, seg = 18) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(10, seg - 4)), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}

// House: walls 3.2h, door 2.1h on +Z face centred at x=0. Door world pos = group pos + (0,0,1.52).
export function makeHouse() {
  const g = new THREE.Group();
  const wall = M(0xf2e3c4), trim = M(0xffffff), doorM = M(0x7a4a21);
  const roofM = M(0xb5502e, { side: THREE.DoubleSide });
  const glassM = M(0xa8d4ea, { roughness: 0.12, metalness: 0.15, emissive: 0xffc46b, emissiveIntensity: 0 });
  g.add(box(3.4, 3.2, 3.0, wall, 0, 1.6, 0));
  // pitched roof: two panels + flat triangle gables (explicit geometry, double-sided)
  const roofL = box(2.2, 0.08, 3.36, roofM, -0.85, 3.78, 0); roofL.rotation.z = 0.55; g.add(roofL);
  const roofR = box(2.2, 0.08, 3.36, roofM, 0.85, 3.78, 0); roofR.rotation.z = -0.55; g.add(roofR);
  const gableMat = M(0xf2e3c4, { side: THREE.DoubleSide });
  for (const zz of [1.49, -1.49]) {
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1.7, 3.2, zz, 1.7, 3.2, zz, 0, 4.36, zz]), 3));
    tg.computeVertexNormals();
    const gm = new THREE.Mesh(tg, gableMat); gm.castShadow = true; g.add(gm);
  }
  g.add(box(3.62, 0.13, 3.22, trim, 0, 3.2, 0));
  g.add(box(0.95, 2.1, 0.08, doorM, 0, 1.05, 1.52));                       // door 2.1m
  g.add(box(1.2, 0.09, 0.44, M(0xcfc4ae), 0, 0.045, 1.7));                 // step
  g.add(sph(0.045, M(0xd9b23a, { metalness: 0.85, roughness: 0.3 }), 0.36, 1.02, 1.58)); // knob
  const windows = [];
  for (const wx of [-1.15, 1.15]) {                                          // windows
    g.add(box(0.84, 1.06, 0.07, trim, wx, 1.9, 1.52));
    const win = box(0.7, 0.92, 0.09, glassM, wx, 1.9, 1.52);
    g.add(win); windows.push(win);
    g.add(box(0.05, 0.92, 0.1, trim, wx, 1.9, 1.52));
    g.add(box(0.7, 0.05, 0.1, trim, wx, 1.9, 1.52));
  }
  g.userData.windows = windows;
  return g;
}

export function makeTree(s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.11, 0.17, 2.0, M(0x7a5230), 0, 1.0, 0));
  const leaf = M(0x4d8f3a), leaf2 = M(0x5da348);
  g.add(sph(1.15, leaf, 0, 3.35, 0, 20));
  g.add(sph(0.8, leaf2, 0.7, 2.7, 0.2));
  g.add(sph(0.72, leaf2, -0.65, 2.85, -0.25));
  g.scale.setScalar(s);
  return g;   // total height ~4.5m at s=1
}

export function makeTable() {
  const g = new THREE.Group();
  const wood = M(0x9c6b3f);
  g.add(box(1.25, 0.06, 0.8, wood, 0, 0.72, 0));                 // top surface = 0.75m
  for (const [x, z] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]])
    g.add(cyl(0.03, 0.03, 0.69, M(0x6e4a26), x, 0.345, z));
  g.add(box(0.34, 0.05, 0.24, M(0xd94f3d), -0.25, 0.775, 0.05));   // book on table
  g.add(cyl(0.05, 0.04, 0.12, M(0x3f7fbf), 0.3, 0.81, -0.1));    // mug
  return g;
}

export function makeChair() {
  const g = new THREE.Group();
  const wood = M(0x8a5a30);
  g.add(box(0.46, 0.05, 0.44, wood, 0, 0.425, 0));               // seat surface = 0.45m
  g.add(box(0.46, 0.5, 0.05, wood, 0, 0.70, -0.2));              // back top = 0.95m
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]])
    g.add(cyl(0.022, 0.022, 0.425, M(0x6e4a26), x, 0.2125, z));
  return g;
}

export function makeBench() {
  const g = new THREE.Group();
  const wood = M(0x9c6b3f), iron = M(0x3c4147, { metalness: 0.5, roughness: 0.5 });
  for (let i = 0; i < 3; i++) g.add(box(1.8, 0.045, 0.13, wood, 0, 0.43, -0.14 + i * 0.15));  // seat ~0.45m
  for (let i = 0; i < 2; i++) { const b = box(1.8, 0.045, 0.11, wood, 0, 0.78 + i * 0.2, -0.26); b.rotation.x = -0.28; g.add(b); }
  for (const x of [-0.8, 0.8]) { g.add(box(0.06, 0.43, 0.44, iron, x, 0.215, 0)); g.add(box(0.06, 0.5, 0.06, iron, x, 0.68, -0.24)); }
  return g;
}

export function makeLampPost() {
  const g = new THREE.Group();
  const iron = M(0x2f353b, { metalness: 0.6, roughness: 0.45 });
  g.add(cyl(0.16, 0.2, 0.12, iron, 0, 0.06, 0));
  g.add(cyl(0.035, 0.05, 2.92, iron, 0, 1.52, 0));
  const bulbMat = M(0xd8dde2, { emissive: 0xffdf80, emissiveIntensity: 0, roughness: 0.3 });
  const bulb = sph(0.11, bulbMat, 0, 3.06, 0);
  g.add(bulb);
  g.add(cyl(0.02, 0.14, 0.12, iron, 0, 3.18, 0));
  g.userData.bulb = bulb;
  g.userData.bulbMat = bulbMat;
  return g;   // total height ~3.24m, bulb centre 3.06m
}

// Fence run along +X from origin, length L.
export function makeFenceRun(L = 6) {
  const g = new THREE.Group();
  const wood = M(0xb08a56);
  const n = Math.max(2, Math.round(L / 0.9));
  for (let i = 0; i <= n; i++) g.add(box(0.09, 0.95, 0.05, wood, (i / n) * L - L / 2, 0.475, 0));
  for (const y of [0.68, 0.3]) g.add(box(L, 0.09, 0.03, wood, 0, y, 0.02));
  return g;
}

export function makePottedPlant(s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.12, 0.3, M(0xb56545), 0, 0.15, 0));
  g.add(cyl(0.03, 0.03, 0.3, M(0x5d7a35), 0, 0.42, 0));
  g.add(sph(0.3, M(0x4d8f3a), 0, 0.72, 0));
  g.add(sph(0.2, M(0x5da348), 0.18, 0.58, 0.08));
  g.add(sph(0.18, M(0x5da348), -0.17, 0.6, -0.06));
  g.scale.setScalar(s);
  return g;
}

// Ground disc + straight path strip along Z at x=pathX, from z0 to z1.
export function makeGround(pathX = 0, z0 = -4, z1 = 6) {
  const g = new THREE.Group();
  const grass = new THREE.Mesh(new THREE.CircleGeometry(16, 48), M(0x74ac54, { roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; g.add(grass);
  const path = box(Math.abs(z1 - z0), 0.02, 1.15, M(0xd9c49a, { roughness: 1 }), 0, 0.01, 0);
  path.rotation.y = Math.PI / 2; path.position.set(pathX, 0.01, (z0 + z1) / 2); path.receiveShadow = true; g.add(path);
  return g;
}

// Flat path strip of given length along X (rotate the group for Z runs).
export function makePathStrip(len = 4, w = 1.15) {
  const m = box(len, 0.02, w, M(0xd9c49a, { roughness: 1 }), 0, 0.01, 0);
  m.castShadow = false;
  const g = new THREE.Group(); g.add(m); return g;
}

export function makeSkyBackdrop() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 256;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#79bdf0'); gr.addColorStop(0.6, '#a8d4f5'); gr.addColorStop(1, '#dff1fd');
  x.fillStyle = gr; x.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- character attachments (added as children of the head bone) ---
export function makeCrown() {
  const g = new THREE.Group();
  const gold = M(0xd9a92c, { metalness: 0.9, roughness: 0.28 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.07, 20, 1, true), gold);
  band.castShadow = true; g.add(band);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 8), gold);
    spike.position.set(Math.cos(a) * 0.1, 0.075, Math.sin(a) * 0.1); spike.castShadow = true; g.add(spike);
    const gem = sph(0.016, M(i % 2 ? 0xc22e2e : 0x2e5fc2, { roughness: 0.2 }), Math.cos(a) * 0.108, 0.0, Math.sin(a) * 0.108, 10);
    g.add(gem);
  }
  return g;
}

// Beard v2 (goldtrain2): lathe-tapered profile (wide at jaw, point at chin),
// flattened front-back, grey-gradient canvas texture with darker streaks.
// Origin = mouth line; mass hangs DOWN -Y. ~20% smaller than the v1 blob.
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), g = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}
function beardTexture(baseHex) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, shade(baseHex, 1.18)); gr.addColorStop(0.55, shade(baseHex, 0.92)); gr.addColorStop(1, shade(baseHex, 0.62));
  x.fillStyle = gr; x.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 42; i++) {   // hair streaks running down
    const sx = Math.random() * 64;
    x.strokeStyle = `rgba(20,16,12,${0.10 + Math.random() * 0.16})`; x.lineWidth = 1;
    x.beginPath(); x.moveTo(sx, 6 + Math.random() * 20); x.lineTo(sx + 2 - Math.random() * 4, 96 + Math.random() * 28); x.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const sx = Math.random() * 64;
    x.strokeStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.10})`; x.lineWidth = 1;
    x.beginPath(); x.moveTo(sx, 10); x.lineTo(sx + 1, 110); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function makeBeard(color = 0x3a2e26) {
  const g = new THREE.Group();
  const hex = '#' + color.toString(16).padStart(6, '0');
  const mat = M(0xffffff, { map: beardTexture(hex), roughness: 1 });
  const prof = [[0.012, 0.095], [0.060, 0.066], [0.084, 0.030], [0.090, -0.012], [0.074, -0.062], [0.048, -0.108], [0.018, -0.140], [0.004, -0.152]];
  const pts = prof.map(p => new THREE.Vector2(p[0], p[1]));
  const lathe = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), mat);
  lathe.castShadow = true; lathe.scale.set(1, 1, 0.74); g.add(lathe);
  const mo = sph(0.062, mat, 0, 0.070, 0.020, 12); mo.scale.set(1.2, 0.36, 0.60); g.add(mo);
  return g;
}

export function makeCap(color = 0x4a5d23) {
  const g = new THREE.Group();
  const mat = M(color, { roughness: 0.9 });
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), mat);
  top.castShadow = true; g.add(top);
  const brim = box(0.15, 0.015, 0.11, mat, 0, -0.005, 0.14); g.add(brim);
  return g;
}
