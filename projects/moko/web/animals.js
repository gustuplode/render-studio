// Animals for "Moko — The Dolphin Who Saved the Whales".
// buildMoko(): bottlenose based on the house dolphin geometry but richer —
//   deeper two-tone slate/pale, clear grin arc, larger eye, glossy highlight
//   band, and a NATURAL full fluke that is always present and beats up-down
//   (no prosthetic sleeve/stump visuals anywhere).
// buildWhale(scale): pygmy sperm whale — blunt blocky squared snout (species
//   signature), torpedo body, small dorsal fin set well back, small pectorals.
// Forward = +Z for both. Deterministic; pose(t, swimK) is frame-pure.
import * as THREE from 'three';

const grad = (() => { const d = new Uint8Array([100, 100, 100, 255, 190, 190, 190, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ gradientMap: grad, color, ...extra });

function finMesh(mat, pts, thick = 0.035) {
  const sh = new THREE.Shape();
  pts.forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 });
  g.translate(0, 0, -thick / 2);
  const m = new THREE.Mesh(g, mat);
  m.rotation.y = Math.PI / 2;
  return m;
}
export function buildFlukeGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.10);
  s.quadraticCurveTo(0.20, 0.10, 0.44, -0.05);
  s.quadraticCurveTo(0.50, -0.10, 0.47, -0.16);
  s.quadraticCurveTo(0.28, -0.20, 0.03, -0.13);
  s.quadraticCurveTo(0, -0.115, -0.03, -0.13);
  s.quadraticCurveTo(-0.28, -0.20, -0.47, -0.16);
  s.quadraticCurveTo(-0.50, -0.10, -0.44, -0.05);
  s.quadraticCurveTo(-0.20, 0.10, 0, 0.10);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 1 });
  return g;
}
function flukeMesh(mat) { const m = new THREE.Mesh(buildFlukeGeo(), mat); m.rotation.x = Math.PI / 2; m.scale.z = -1; m.castShadow = true; return m; }

// ---------------- MOKO ----------------
export const MOKO_COLS = { top: '#4e6d84', belly: '#e6eef0', fin: '#44637a', gloss: '#7fa3bd' };
export function buildMoko() {
  const top = toon(MOKO_COLS.top), bellyM = toon(MOKO_COLS.belly), finM = toon(MOKO_COLS.fin);
  const dark = toon('#14202c');
  const glossM = new THREE.MeshPhongMaterial({ color: 0x8fb2cc, shininess: 160, specular: 0xd8ecff, transparent: true, opacity: 0.5 });
  const root = new THREE.Group();
  const front = new THREE.Group(); root.add(front);
  const add = (geo, mat, x, y, z, parent = front) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; parent.add(m); return m; };

  const body = add(new THREE.SphereGeometry(0.5, 28, 20), top, 0, 0, 0.18);
  body.scale.set(0.55, 0.57, 1.62);
  const belly = add(new THREE.SphereGeometry(0.5, 24, 16), bellyM, 0, -0.055, 0.26);
  belly.scale.set(0.48, 0.50, 1.48);
  // glossy highlight band along the upper flank
  const band = add(new THREE.SphereGeometry(0.5, 24, 12), glossM, 0, 0.10, 0.16);
  band.scale.set(0.565, 0.42, 1.55); band.castShadow = false;
  // head: melon + beak
  const melon = add(new THREE.SphereGeometry(0.5, 20, 14), top, 0, 0.05, 0.80);
  melon.scale.set(0.46, 0.45, 0.52);
  const beak = add(new THREE.CylinderGeometry(0.042, 0.10, 0.52, 14), top, 0, -0.012, 1.17);
  beak.rotation.x = Math.PI / 2 - 0.05;
  add(new THREE.SphereGeometry(0.043, 12, 8), top, 0, -0.026, 1.43);
  const jaw = add(new THREE.CylinderGeometry(0.032, 0.07, 0.44, 12), bellyM, 0, -0.082, 1.14);
  jaw.rotation.x = Math.PI / 2 - 0.03;
  // GRIN: clear upturned mouth arc, wider than Winter's
  const mouth = add(new THREE.TorusGeometry(0.125, 0.011, 6, 22, Math.PI * 0.95), dark, 0, -0.038, 1.03);
  mouth.rotation.set(0.32, Math.PI / 2, 0); mouth.castShadow = false;
  // larger eyes with a glint dot
  for (const s of [-1, 1]) {
    const e = add(new THREE.SphereGeometry(0.028, 10, 8), dark, s * 0.19, 0.05, 0.88); e.castShadow = false;
    const gl = add(new THREE.SphereGeometry(0.009, 6, 6), toon('#ffffff'), s * 0.20, 0.062, 0.90); gl.castShadow = false;
  }
  const bh = add(new THREE.SphereGeometry(0.032, 8, 6), finM, 0, 0.27, 0.74); bh.scale.set(1, 0.35, 1.6); bh.castShadow = false;
  const dorsal = finMesh(finM, [[0.16, 0], [0.04, 0.14], [-0.08, 0.23], [-0.18, 0.17], [-0.24, 0.02], [-0.25, 0]]);
  dorsal.position.set(0, 0.27, 0.02); front.add(dorsal);
  for (const s of [-1, 1]) {
    const pec = add(new THREE.SphereGeometry(0.5, 14, 10), finM, s * 0.34, -0.20, 0.46);
    pec.scale.set(0.64, 0.10, 0.31); pec.rotation.set(0.15, s * 0.55, s * -0.62);
  }
  // rear: stock + NATURAL fluke (always present)
  const rearPivot = new THREE.Group(); rearPivot.position.set(0, 0.01, -0.42); root.add(rearPivot);
  const stock = add(new THREE.CylinderGeometry(0.06, 0.15, 0.58, 14), top, 0, 0, -0.27, rearPivot);
  stock.rotation.x = Math.PI / 2;
  const stockBelly = add(new THREE.CylinderGeometry(0.047, 0.12, 0.54, 12), bellyM, 0, -0.032, -0.27, rearPivot);
  stockBelly.rotation.x = Math.PI / 2;
  const fluke = flukeMesh(finM); fluke.position.set(0, 0, -0.60); rearPivot.add(fluke);

  const api = {
    group: root, front, rearPivot, kind: 'dolphin',
    pose(t, swimK = 0.6) {
      const a = 0.36 * swimK + 0.05, w = 4.4 + 3.0 * swimK;
      rearPivot.rotation.x = Math.sin(t * w) * a;
      rearPivot.rotation.y = Math.sin(t * 1.2) * 0.025;
      front.rotation.x = Math.sin(t * w - 0.7) * a * 0.35;
      front.rotation.y = Math.sin(t * 0.8) * 0.02;
      api.bob = Math.sin(t * w - 0.4) * 0.055 * swimK;
      api.roll = Math.sin(t * 0.9) * 0.03;
    },
    bob: 0, roll: 0,
  };
  return api;
}

// ---------------- PYGMY SPERM WHALE ----------------
export const WHALE_COLS = { top: '#33475b', belly: '#b9c6cf', fin: '#2e4052' };
export function buildWhale(scale = 1) {
  const top = toon(WHALE_COLS.top), bellyM = toon(WHALE_COLS.belly), finM = toon(WHALE_COLS.fin);
  const dark = toon('#10161e');
  const root = new THREE.Group();
  const front = new THREE.Group(); root.add(front);
  const add = (geo, mat, x, y, z, parent = front) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; parent.add(m); return m; };
  // torpedo body, widest mid-body; total length ~2.9 m at scale 1 (mother scaled up in main)
  const body = add(new THREE.SphereGeometry(0.5, 26, 18), top, 0, 0, -0.15);
  body.scale.set(0.62, 0.60, 2.05); // z -1.18..0.88, height 0.60
  const belly = add(new THREE.SphereGeometry(0.5, 22, 14), bellyM, 0, -0.07, -0.10);
  belly.scale.set(0.54, 0.52, 1.95);
  // BLUNT BLOCKY HEAD: squared-off snout — a flattened box-sphere merged at the front
  const head = add(new THREE.SphereGeometry(0.5, 20, 14), top, 0, 0.01, 0.86);
  head.scale.set(0.60, 0.56, 0.62);
  const snout = add(new THREE.SphereGeometry(0.5, 18, 12), top, 0, -0.02, 1.10);
  snout.scale.set(0.56, 0.44, 0.38); // flattened front reads squared-off without a literal cube
  // underslung small mouth line under the snout
  const mouth = add(new THREE.TorusGeometry(0.16, 0.010, 6, 18, Math.PI * 0.7), dark, 0, -0.20, 1.16);
  mouth.rotation.set(0.5, Math.PI / 2, 0); mouth.castShadow = false;
  // eyes: small dots set low, behind the snout corners
  for (const s of [-1, 1]) { const e = add(new THREE.SphereGeometry(0.024, 8, 8), dark, s * 0.27, -0.02, 1.02); e.castShadow = false; }
  // blowhole on top of the head
  const bh = add(new THREE.SphereGeometry(0.035, 8, 6), finM, 0, 0.30, 0.92); bh.scale.set(1, 0.3, 1.5); bh.castShadow = false;
  // small dorsal fin set WELL BACK
  const dorsal = finMesh(finM, [[0.10, 0], [0.02, 0.09], [-0.05, 0.14], [-0.12, 0.08], [-0.15, 0]]);
  dorsal.position.set(0, 0.28, -0.62); front.add(dorsal);
  // small pectoral flippers
  for (const s of [-1, 1]) {
    const pec = add(new THREE.SphereGeometry(0.5, 12, 8), finM, s * 0.34, -0.22, 0.55);
    pec.scale.set(0.44, 0.09, 0.26); pec.rotation.set(0.2, s * 0.5, s * -0.55);
  }
  // rear stock + fluke
  const rearPivot = new THREE.Group(); rearPivot.position.set(0, 0, -1.02); root.add(rearPivot);
  const stock = add(new THREE.CylinderGeometry(0.07, 0.17, 0.55, 14), top, 0, 0, -0.26, rearPivot);
  stock.rotation.x = Math.PI / 2;
  const fluke = flukeMesh(finM); fluke.scale.setScalar(1.25); fluke.position.set(0, 0, -0.58); rearPivot.add(fluke);

  root.scale.setScalar(scale);
  const api = {
    group: root, front, rearPivot, kind: 'whale', scale,
    blowLocal: [0, 0.32 * scale, 0.92 * scale],
    pose(t, swimK = 0.3, weakK = 0) {
      const a = (0.30 * swimK + 0.03) * (1 - 0.55 * weakK), w = 2.6 + 2.2 * swimK;
      rearPivot.rotation.x = Math.sin(t * w) * a;
      front.rotation.x = Math.sin(t * w - 0.7) * a * 0.3;
      api.bob = Math.sin(t * w - 0.4) * 0.04 * swimK + Math.sin(t * 0.7) * 0.012;
      api.roll = Math.sin(t * 0.6) * 0.02 + weakK * 0.05 * Math.sin(t * 0.45);
    },
    bob: 0, roll: 0,
  };
  return api;
}
