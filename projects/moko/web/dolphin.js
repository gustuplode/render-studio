// Winter the dolphin — coded geometry, built to read DOLPHIN at every angle:
// torpedo body, clear rostrum/beak, melon forehead, dorsal fin, two pectoral
// flippers, tapered tail stock + notched fluke. Two-tone toon material.
// Forward = +Z. Adult length ~2.15 m nose->fluke tip. Hierarchy:
//   root -> frontGroup (body/head/fins) + rearPivot (stock + sleeve + fluke)
// pose(t, mode, swimK): 'none' swishes side-to-side (yaw), 'prosthetic' beats up-down (pitch).
import * as THREE from 'three';

const grad = (() => { const d = new Uint8Array([100, 100, 100, 255, 190, 190, 190, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ gradientMap: grad, color, ...extra });

export const DOLPHIN_COLS = { top: '#5d7f96', belly: '#e9f1f2', fin: '#54748a', sleeve: '#a8d8c8' };

function finMesh(mat, pts, thick = 0.035) {
  // pts in [chord(z), height(y)] plane; extruded laterally (x)
  const sh = new THREE.Shape();
  pts.forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 });
  g.translate(0, 0, -thick / 2);
  const m = new THREE.Mesh(g, mat);
  m.rotation.y = Math.PI / 2; // shape x (chord) -> world -z... orient: shape +x becomes world -z? rotate so chord runs along z
  return m;
}

export function buildFluke(mat) {
  // One-piece fluke in plan view: shape x = lateral, y = chord (back = -y in shape, mapped to -z)
  const s = new THREE.Shape();
  s.moveTo(0, 0.10);
  s.quadraticCurveTo(0.20, 0.10, 0.44, -0.05);   // leading edge right wing
  s.quadraticCurveTo(0.50, -0.10, 0.47, -0.16); // swept tip
  s.quadraticCurveTo(0.28, -0.20, 0.03, -0.13); // trailing edge to notch
  s.quadraticCurveTo(0, -0.115, -0.03, -0.13);  // centre notch
  s.quadraticCurveTo(-0.28, -0.20, -0.47, -0.16);
  s.quadraticCurveTo(-0.50, -0.10, -0.44, -0.05);
  s.quadraticCurveTo(-0.20, 0.10, 0, 0.10);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 1 });
  const m = new THREE.Mesh(g, mat);
  m.rotation.x = Math.PI / 2; // shape plane -> XZ horizontal; shape +y (front) -> world -z? fix below by scale
  m.scale.z = -1;
  return m;
}

export function buildDolphin() {
  const top = toon(DOLPHIN_COLS.top), bellyM = toon(DOLPHIN_COLS.belly), finM = toon(DOLPHIN_COLS.fin);
  const dark = toon('#1c2733');
  const root = new THREE.Group();
  const front = new THREE.Group(); root.add(front);
  const add = (geo, mat, x, y, z, parent = front) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; parent.add(m); return m; };

  // --- body: torpedo (sphere scaled), widest just behind the head ---
  const body = add(new THREE.SphereGeometry(0.5, 28, 20), top, 0, 0, 0.18);
  body.scale.set(0.54, 0.56, 1.60); // half-extents: x .27, y .28, z .80 -> z from -0.62 to +0.98
  const belly = add(new THREE.SphereGeometry(0.5, 24, 16), bellyM, 0, -0.05, 0.24);
  belly.scale.set(0.47, 0.50, 1.45); // protrudes only underneath, edge tucked under the curve
  // --- head: melon forehead + rostrum/beak (THE dolphin signature) ---
  const melon = add(new THREE.SphereGeometry(0.5, 20, 14), top, 0, 0.045, 0.80);
  melon.scale.set(0.45, 0.44, 0.50);
  const beak = add(new THREE.CylinderGeometry(0.040, 0.098, 0.50, 14), top, 0, -0.015, 1.16);
  beak.rotation.x = Math.PI / 2 - 0.06; // axis -> +z, slight droop
  const beakTip = add(new THREE.SphereGeometry(0.041, 12, 8), top, 0, -0.030, 1.41);
  const jaw = add(new THREE.CylinderGeometry(0.030, 0.068, 0.42, 12), bellyM, 0, -0.080, 1.13);
  jaw.rotation.x = Math.PI / 2 - 0.03;
  // mouth line: thin dark arc under the beak base
  const mouth = add(new THREE.TorusGeometry(0.105, 0.008, 6, 20, Math.PI * 0.85), dark, 0, -0.045, 1.02);
  mouth.rotation.set(0.35, Math.PI / 2, 0); mouth.scale.set(1, 1, 1);
  // eyes
  for (const s of [-1, 1]) { const e = add(new THREE.SphereGeometry(0.021, 8, 8), dark, s * 0.185, 0.045, 0.88); e.castShadow = false; }
  // blowhole hint
  const bh = add(new THREE.SphereGeometry(0.03, 8, 6), finM, 0, 0.265, 0.74); bh.scale.set(1, 0.35, 1.6); bh.castShadow = false;
  // --- dorsal fin: small + falcate (curved back), on the back at mid-body ---
  const dorsal = finMesh(finM, [[0.15, 0], [0.03, 0.13], [-0.08, 0.215], [-0.17, 0.16], [-0.23, 0.02], [-0.24, 0]]);
  dorsal.position.set(0, 0.26, 0.02); front.add(dorsal);
  // --- pectoral flippers: flattened ellipsoids swept back, angled down-out ~35 deg ---
  for (const s of [-1, 1]) {
    const pec = add(new THREE.SphereGeometry(0.5, 14, 10), finM, s * 0.33, -0.20, 0.46);
    pec.scale.set(0.62, 0.10, 0.30); // span x .31, thick .05, chord z .15
    pec.rotation.set(0.15, s * 0.55, s * -0.62);
  }
  // --- rear pivot: tail stock + (stump cap | gel sleeve + fluke) ---
  const rearPivot = new THREE.Group(); rearPivot.position.set(0, 0.01, -0.42); root.add(rearPivot);
  const stock = add(new THREE.CylinderGeometry(0.058, 0.148, 0.58, 14), top, 0, 0, -0.27, rearPivot);
  stock.rotation.x = Math.PI / 2;
  const stockBelly = add(new THREE.CylinderGeometry(0.045, 0.118, 0.54, 12), bellyM, 0, -0.032, -0.27, rearPivot);
  stockBelly.rotation.x = Math.PI / 2;
  const stump = add(new THREE.SphereGeometry(0.062, 12, 10), top, 0, 0, -0.57, rearPivot); // healed rounded stump (tailMode none)
  stump.scale.set(1, 1, 0.8);
  // prosthetic: translucent gel sleeve band + fluke on a short stalk
  const proGroup = new THREE.Group(); rearPivot.add(proGroup);
  const sleeve = add(new THREE.CylinderGeometry(0.115, 0.105, 0.30, 14),
    new THREE.MeshPhongMaterial({ color: DOLPHIN_COLS.sleeve, transparent: true, opacity: 0.55, shininess: 120, specular: 0xdffcf2, depthWrite: false }),
    0, 0, -0.48, proGroup);
  sleeve.rotation.x = Math.PI / 2;
  const stalk = add(new THREE.CylinderGeometry(0.045, 0.06, 0.22, 10), toon('#3d4a55'), 0, 0, -0.68, proGroup);
  stalk.rotation.x = Math.PI / 2;
  const fluke = buildFluke(finM); fluke.position.set(0, 0, -0.78); fluke.castShadow = true; proGroup.add(fluke);
  proGroup.visible = false;

  const api = {
    group: root, front, rearPivot, proGroup, stump,
    tailMode: 'none',
    setTail(mode) { api.tailMode = mode; proGroup.visible = mode === 'prosthetic'; stump.visible = mode !== 'prosthetic'; },
    // swimK 0..1 effort; t in seconds. Returns nothing; sets rotations/bob.
    pose(t, swimK = 0.6) {
      const m = api.tailMode;
      if (m === 'prosthetic') {
        const a = 0.34 * swimK + 0.05;
        rearPivot.rotation.x = Math.sin(t * (4.2 + 3.2 * swimK)) * a;
        rearPivot.rotation.y = Math.sin(t * 1.3) * 0.03;
        front.rotation.x = Math.sin(t * (4.2 + 3.2 * swimK) - 0.7) * a * 0.35;
        front.rotation.y = 0;
        root.position.y += 0; // bob applied by caller via group offset below
        api.bob = Math.sin(t * (4.2 + 3.2 * swimK) - 0.4) * 0.05 * swimK;
        api.roll = Math.sin(t * 0.9) * 0.03;
      } else {
        // cannot beat up-down: whole rear swishes side-to-side like a fish
        const a = 0.38 * swimK + 0.04;
        rearPivot.rotation.y = Math.sin(t * (3.4 + 2.4 * swimK)) * a;
        rearPivot.rotation.x = Math.sin(t * 1.1) * 0.02;
        front.rotation.y = Math.sin(t * (3.4 + 2.4 * swimK) - 0.8) * a * 0.3;
        front.rotation.x = 0;
        api.bob = Math.sin(t * 1.7) * 0.03;
        api.roll = Math.sin(t * (3.4 + 2.4 * swimK)) * 0.06 * swimK;
      }
    },
    bob: 0, roll: 0,
  };
  return api;
}
