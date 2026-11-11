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

// House ~3.4w x 3.55h x 3.0d, door on +Z face centred at x=0. Door world pos = group pos + (0,0,1.52).
export function makeHouse() {
  const g = new THREE.Group();
  const wall = M(0xf2e3c4), trim = M(0xffffff), doorM = M(0x7a4a21);
  const roofM = M(0xb5502e, { side: THREE.DoubleSide });
  const glass = M(0xa8d4ea, { roughness: 0.12, metalness: 0.15 });
  g.add(box(3.4, 2.5, 3.0, wall, 0, 1.25, 0));
  // pitched roof: two panels + flat triangle gables (explicit geometry, double-sided)
  const roofL = box(2.2, 0.08, 3.36, roofM, -0.9, 3.1, 0); roofL.rotation.z = 0.55; g.add(roofL);
  const roofR = box(2.2, 0.08, 3.36, roofM, 0.9, 3.1, 0); roofR.rotation.z = -0.55; g.add(roofR);
  const gableMat = M(0xf2e3c4, { side: THREE.DoubleSide });
  for (const zz of [1.49, -1.49]) {
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1.7, 2.5, zz, 1.7, 2.5, zz, 0, 3.40, zz]), 3));
    tg.computeVertexNormals();
    const gm = new THREE.Mesh(tg, gableMat); gm.castShadow = true; g.add(gm);
  }
  g.add(box(3.62, 0.13, 3.22, trim, 0, 2.5, 0));
  g.add(box(0.88, 1.92, 0.08, doorM, 0, 0.96, 1.52));                       // door
  g.add(box(1.14, 0.09, 0.44, M(0xcfc4ae), 0, 0.045, 1.7));                 // step
  g.add(sph(0.045, M(0xd9b23a, { metalness: 0.85, roughness: 0.3 }), 0.33, 0.98, 1.58)); // knob
  for (const wx of [-1.15, 1.15]) {                                          // windows
    g.add(box(0.78, 0.92, 0.07, trim, wx, 1.55, 1.52));
    g.add(box(0.64, 0.78, 0.09, glass, wx, 1.55, 1.52));
    g.add(box(0.05, 0.78, 0.1, trim, wx, 1.55, 1.52));
    g.add(box(0.64, 0.05, 0.1, trim, wx, 1.55, 1.52));
  }
  return g;
}

export function makeTree(s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.09, 0.14, 1.1, M(0x7a5230), 0, 0.55, 0));
  const leaf = M(0x4d8f3a), leaf2 = M(0x5da348);
  g.add(sph(0.85, leaf, 0, 1.75, 0, 20));
  g.add(sph(0.6, leaf2, 0.55, 1.35, 0.15));
  g.add(sph(0.55, leaf2, -0.5, 1.45, -0.2));
  g.scale.setScalar(s);
  return g;
}

export function makeTable() {
  const g = new THREE.Group();
  const wood = M(0x9c6b3f);
  g.add(box(1.25, 0.06, 0.8, wood, 0, 0.74, 0));
  for (const [x, z] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]])
    g.add(cyl(0.03, 0.03, 0.72, M(0x6e4a26), x, 0.36, z));
  g.add(box(0.34, 0.05, 0.24, M(0xd94f3d), -0.25, 0.8, 0.05));   // book on table
  g.add(cyl(0.05, 0.04, 0.12, M(0x3f7fbf), 0.3, 0.83, -0.1));    // mug
  return g;
}

export function makeChair() {
  const g = new THREE.Group();
  const wood = M(0x8a5a30);
  g.add(box(0.46, 0.05, 0.44, wood, 0, 0.46, 0));
  g.add(box(0.46, 0.55, 0.05, wood, 0, 0.76, -0.2));
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]])
    g.add(cyl(0.022, 0.022, 0.46, M(0x6e4a26), x, 0.23, z));
  return g;
}

export function makeBench() {
  const g = new THREE.Group();
  const wood = M(0x9c6b3f), iron = M(0x3c4147, { metalness: 0.5, roughness: 0.5 });
  for (let i = 0; i < 3; i++) g.add(box(1.8, 0.045, 0.13, wood, 0, 0.46, -0.14 + i * 0.15));
  for (let i = 0; i < 2; i++) { const b = box(1.8, 0.045, 0.11, wood, 0, 0.78 + i * 0.2, -0.26); b.rotation.x = -0.28; g.add(b); }
  for (const x of [-0.8, 0.8]) { g.add(box(0.06, 0.46, 0.44, iron, x, 0.23, 0)); g.add(box(0.06, 0.5, 0.06, iron, x, 0.68, -0.24)); }
  return g;
}

export function makeLampPost() {
  const g = new THREE.Group();
  const iron = M(0x2f353b, { metalness: 0.6, roughness: 0.45 });
  g.add(cyl(0.16, 0.2, 0.12, iron, 0, 0.06, 0));
  g.add(cyl(0.035, 0.05, 2.6, iron, 0, 1.36, 0));
  const bulb = sph(0.11, M(0xfff3b0, { emissive: 0xffdf80, emissiveIntensity: 1.6, roughness: 0.3 }), 0, 2.78, 0);
  g.add(bulb);
  g.add(cyl(0.02, 0.14, 0.12, iron, 0, 2.92, 0));
  g.userData.bulb = bulb;
  return g;
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

export function makeBeard(color = 0x3a2e26) {
  const g = new THREE.Group();
  const mat = M(color, { roughness: 1 });
  const b = sph(0.105, mat, 0, 0, 0, 16); b.scale.set(1.0, 1.25, 0.72); g.add(b);
  const mo = sph(0.07, mat, 0, 0.055, 0.01, 14); mo.scale.set(1.15, 0.42, 0.7); g.add(mo);
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
