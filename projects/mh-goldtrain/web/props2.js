// GoldTrain props (Gate B) — real-world scale, coded three.js. Units = metres.
// Train travels along +X. Track top (rail head) at y = 0.20.
import * as THREE from 'three';

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0, ...opts });
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function sph(r, mat, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(10, seg - 4)), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
export const GOLD_MAT = M(0xd9a41e, { metalness: 1.0, roughness: 0.3, emissive: 0x6b4a00, emissiveIntensity: 0.10 });
const GOLD_DARK = M(0xb8892a, { metalness: 1.0, roughness: 0.42, emissive: 0x543a00, emissiveIntensity: 0.08 });

/* ---- coded canvas textures (detail standard: materials carry grain/course/sheen) ---- */
function cnv(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
export const woodTex = (base = '#7a5a34', dark = '#5d4225') => cnv(256, 256, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) { const y = Math.random() * h; x.strokeStyle = `rgba(40,26,12,${0.10 + Math.random() * 0.16})`; x.lineWidth = 1 + Math.random() * 2.2; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 3 - Math.random() * 6, w * 0.7, y - 3 + Math.random() * 6, w, y); x.stroke(); }
  for (let i = 0; i < 7; i++) { const kx = Math.random() * w, ky = Math.random() * h; x.strokeStyle = 'rgba(40,26,12,0.35)'; x.lineWidth = 1.4; x.beginPath(); x.arc(kx, ky, 2.5 + Math.random() * 3, 0, 7); x.stroke(); }
  x.fillStyle = dark; for (let px = 0; px < w; px += 64) x.fillRect(px, 0, 2, h);
});
export const stoneTex = () => cnv(256, 256, (x, w, h) => {
  x.fillStyle = '#8f8d84'; x.fillRect(0, 0, w, h);
  const rows = 5, rh = h / rows;
  for (let r = 0; r < rows; r++) for (let cx = -1; cx < 3; cx++) {
    const bx = cx * 128 + (r % 2) * 64, by = r * rh;
    x.fillStyle = `rgb(${152 + Math.random() * 20},${145 + Math.random() * 18},${126 + Math.random() * 14})`;
    x.fillRect(bx + 3, by + 3, 122, rh - 6);
  }
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(50,48,44,${Math.random() * 0.13})`; x.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6); }
  x.strokeStyle = 'rgba(52,50,46,0.55)'; x.lineWidth = 2;
  for (let r = 0; r <= rows; r++) { x.beginPath(); x.moveTo(0, r * rh); x.lineTo(w, r * rh); x.stroke(); }
});
export const goldGradTex = () => cnv(64, 64, (x, w, h) => {
  const g = x.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, '#8a5f10'); g.addColorStop(0.45, '#d9ab2e'); g.addColorStop(0.62, '#f8e27a'); g.addColorStop(0.78, '#caa22e'); g.addColorStop(1, '#7c5410');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
export const coalTex = () => cnv(128, 128, (x, w, h) => {
  x.fillStyle = '#0b0c0e'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${140 + Math.random() * 80},${140 + Math.random() * 80},${150 + Math.random() * 80},${Math.random() * 0.25})`; x.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4); }
});
GOLD_MAT.map = goldGradTex(); GOLD_MAT.color.set(0xffffff);
const WOOD_TEX = woodTex(), WOOD_TEX2 = woodTex('#6e4f2a', '#4e3517'), STONE_TEX = stoneTex(), COAL_TEX = coalTex();
const STEEL = M(0x3a3f45, { metalness: 0.75, roughness: 0.45 });
const IRON_D = M(0x22262b, { metalness: 0.6, roughness: 0.55 });
const LOCO_GREEN = M(0x1e3328, { metalness: 0.35, roughness: 0.5 });

/* ---------------- track ---------------- */
export function makeTrack(len = 70) {
  const g = new THREE.Group();
  const railM = M(0x8a8f96, { metalness: 0.9, roughness: 0.35 });
  const tieM = M(0x4a3826, { roughness: 1 });
  for (const s of [-0.72, 0.72]) g.add(box(len, 0.09, 0.09, railM, 0, 0.155, s));
  const n = Math.floor(len / 0.75);
  for (let i = 0; i <= n; i++) g.add(box(0.26, 0.07, 2.1, tieM, -len / 2 + i * 0.75, 0.035, 0));
  g.add(box(len, 0.03, 2.6, M(0x6f6a60, { roughness: 1 }), 0, 0.005, 0)); // ballast bed
  return g;
}

/* ---------------- locomotive ---------------- */
function spokedWheel(r, mat) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.06, 0.055, 8, 28), mat);
  rim.castShadow = true; g.add(rim);
  const hub = cyl(0.13, 0.13, 0.12, mat, 0, 0, 0, 12); hub.rotation.x = Math.PI / 2; g.add(hub);
  for (let i = 0; i < 6; i++) {
    const sp = box(0.07, (r - 0.08) * 2, 0.05, mat, 0, 0, 0);
    sp.rotation.z = (i / 6) * Math.PI; g.add(sp);
  }
  // crank pin (for the side rod), at radius 0.52*r... stored for rod math
  const pin = cyl(0.045, 0.045, 0.1, STEEL, r * 0.52, 0, 0.09, 10); pin.rotation.x = Math.PI / 2; g.add(pin);
  return g;
}
export function makeLoco() {
  const g = new THREE.Group();
  const drivers = [], smalls = [];
  // chassis + running board
  g.add(box(8.4, 0.35, 2.5, IRON_D, 0, 1.05, 0));
  g.add(box(8.6, 0.16, 2.7, M(0x571f1f, { roughness: 0.6 }), 0.1, 0.82, 0)); // red buffer/valance line
  // boiler (axis along X)
  const boiler = cyl(0.88, 0.88, 4.6, LOCO_GREEN, 1.55, 2.25, 0, 24); boiler.rotation.z = Math.PI / 2; g.add(boiler);
  const smoke = cyl(0.92, 0.92, 0.5, IRON_D, 3.95, 2.25, 0, 24); smoke.rotation.z = Math.PI / 2; g.add(smoke);
  const chim = cyl(0.16, 0.26, 0.85, IRON_D, 3.8, 3.35, 0, 14); g.add(chim);
  g.add(cyl(0.30, 0.30, 0.12, IRON_D, 3.8, 3.82, 0, 14));
  const dome = sph(0.42, M(0x8a6f2e, { metalness: 0.8, roughness: 0.35 }), 2.4, 3.05, 0, 18); dome.scale.y = 0.75; g.add(dome);
  const dome2 = sph(0.34, LOCO_GREEN, 1.2, 3.02, 0, 16); dome2.scale.y = 0.72; g.add(dome2);
  g.add(cyl(0.07, 0.07, 0.5, STEEL, 0.3, 3.2, 0, 10)); // whistle
  for (const bx of [0.2, 1.55, 2.9]) { // boiler bands
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.028, 8, 28), IRON_D);
    band.position.set(bx, 2.25, 0); band.rotation.y = Math.PI / 2; band.castShadow = true; g.add(band);
  }
  // number plate (canvas texture) on cab sides + front
  const plateCvs = document.createElement('canvas'); plateCvs.width = 128; plateCvs.height = 64;
  const px2 = plateCvs.getContext('2d');
  px2.fillStyle = '#7c1d1d'; px2.fillRect(0, 0, 128, 64);
  px2.strokeStyle = '#d8c98a'; px2.lineWidth = 4; px2.strokeRect(4, 4, 120, 56);
  px2.fillStyle = '#f2e3ac'; px2.font = 'bold 34px Georgia'; px2.textAlign = 'center'; px2.fillText('2974', 64, 45);
  const plateTex = new THREE.CanvasTexture(plateCvs); plateTex.colorSpace = THREE.SRGBColorSpace;
  for (const s of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.36), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 }));
    plate.position.set(-2.8, 2.2, s * 1.385); plate.rotation.y = s > 0 ? 0 : Math.PI; g.add(plate);
  }
  // cab (rear, x -4.05..-1.55), walls to 3.95 + roof
  g.add(box(2.5, 2.75, 2.75, LOCO_GREEN, -2.8, 2.55, 0));
  g.add(box(2.8, 0.14, 3.05, IRON_D, -2.8, 4.0, 0));
  for (const s of [-1, 1]) { // cab side windows (dark glass)
    g.add(box(0.85, 0.8, 0.06, M(0x141c22, { roughness: 0.2, metalness: 0.3 }), -2.55, 3.25, s * 1.39));
  }
  g.add(box(0.06, 0.8, 0.9, M(0x141c22, { roughness: 0.2 }), -1.53, 3.25, 0)); // cab front window
  // front: buffer beam + cowcatcher + headlamp
  g.add(box(0.25, 0.5, 2.7, M(0x8c2323, { roughness: 0.55 }), 4.35, 0.95, 0));
  const cow = box(1.1, 0.9, 2.3, IRON_D, 4.6, 0.45, 0); cow.rotation.z = 0.6; g.add(cow);
  const lampMat = M(0xffe9a8, { emissive: 0xffc45e, emissiveIntensity: 2.2, roughness: 0.3 });
  g.add(box(0.42, 0.5, 0.42, IRON_D, 4.35, 3.3, 0));
  const lens = cyl(0.15, 0.15, 0.05, lampMat, 4.6, 3.3, 0, 16); lens.rotation.z = Math.PI / 2; g.add(lens);
  // tender (behind cab): coal load
  const tender = new THREE.Group(); tender.position.set(-6.6, 0, 0);
  tender.add(box(3.6, 1.6, 2.6, LOCO_GREEN, 0, 1.75, 0));
  tender.add(box(3.8, 0.14, 2.8, IRON_D, 0, 2.6, 0));
  const coalM = M(0xffffff, { map: COAL_TEX, roughness: 1 });
  for (let i = 0; i < 16; i++) {  // coal lumps cluster
    const lump = sph(0.26 + ((i * 29) % 10) / 28, coalM, -1.45 + (i % 4) * 0.95, 2.5 + ((i * 7) % 3) * 0.13, -0.7 + Math.floor(i / 4) * 0.45, 8);
    lump.scale.y = 0.7; tender.add(lump);
  }
  g.add(tender);
  // wheels: 3 drivers r0.82, 2 small r0.44 (front), tender wheels r0.5
  const wheelZ = 1.28;
  const mkWheel = (r, x, parent = g) => {
    for (const s of [-1, 1]) {
      const w = spokedWheel(r, IRON_D);
      w.position.set(x, r, s * wheelZ);
      parent.add(w);
      if (parent === g) (r > 0.6 ? drivers : smalls).push(w);
    }
  };
  mkWheel(0.82, -2.2); mkWheel(0.82, -0.55); mkWheel(0.82, 1.1);
  mkWheel(0.44, 3.0); mkWheel(0.44, 4.0);
  for (const tx of [-1.2, 1.2]) { // tender wheels
    for (const s of [-1, 1]) { const w = spokedWheel(0.5, IRON_D); w.position.set(tx, 0.5, s * wheelZ); tender.add(w); drivers.push(w); }
  }
  // side rods (one per side), follow crank pins of the drivers
  const rods = [];
  for (const s of [-1, 1]) {
    const rod = box(3.3, 0.11, 0.05, STEEL, -0.55, 0.82, s * (wheelZ + 0.1));
    g.add(rod); rods.push(rod);
  }
  g.userData.update = (dist) => {
    for (const w of drivers) w.rotation.z = -dist / wheelR(w);
    for (const w of smalls) w.rotation.z = -dist / 0.44;
    // rod follows the crank pins of the drivers (pin offset rotates with wheel)
    const ang = dist / 0.82, px = Math.cos(-ang) * 0.82 * 0.52, py = Math.sin(-ang) * 0.82 * 0.52;
    for (const rod of rods) { rod.position.x = -0.55 + px; rod.position.y = 0.82 + py; }
  };
  function wheelR(w) { const t = w.children[0]; return (t.geometry.parameters.radius + 0.055) || 0.82; }
  g.userData.lampMat = lampMat;
  return g;
}

/* ---------------- gold wagons ---------------- */
export function makeGoldBar() {
  // trapezoid ingot: thin wide plinth (bevel read) + frustum body + stamp on top.
  // Metallic gradient map gives the sheen band; PBR highlight sweeps as camera moves.
  const grp = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.158, 0.022, 4), GOLD_DARK);
  plinth.rotation.y = Math.PI / 4; plinth.scale.set(1.55, 1, 0.72); plinth.position.y = 0.011;
  plinth.castShadow = true; plinth.receiveShadow = true; grp.add(plinth);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.138, 0.072, 4), GOLD_MAT);
  body.rotation.y = Math.PI / 4; body.scale.set(1.55, 1, 0.72); body.position.y = 0.058;
  body.castShadow = true; body.receiveShadow = true; grp.add(body);
  const stamp = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.007, 12), GOLD_DARK);
  stamp.position.y = 0.096; grp.add(stamp);
  return grp;
}
export function makeGoldCrate() {
  const g = new THREE.Group();
  const wood = M(0xffffff, { map: WOOD_TEX2, roughness: 0.95 });
  g.add(box(0.95, 0.5, 0.7, wood, 0, 0.25, 0));
  g.add(box(1.0, 0.07, 0.75, M(0x593d20), 0, 0.52, 0));
  for (const [bx, bz] of [[-0.44, -0.32], [0.44, -0.32], [-0.44, 0.32], [0.44, 0.32]])  // corner battens
    g.add(box(0.09, 0.52, 0.09, M(0x593d20), bx, 0.26, bz));
  for (const bz of [-0.36, 0.36]) g.add(box(0.99, 0.09, 0.05, M(0x593d20), 0, 0.28, bz)); // side straps
  // pyramid stack of ingots on the lid: 3 below, 2 on top
  for (let i = 0; i < 3; i++) {
    const bar = makeGoldBar(); bar.position.set(-0.27 + i * 0.27, 0.555, -0.02); bar.rotation.y = (i - 1) * 0.05; g.add(bar);
  }
  for (let i = 0; i < 2; i++) {
    const bar = makeGoldBar(); bar.position.set(-0.135 + i * 0.27, 0.555 + 0.098, -0.02); bar.rotation.y = 0.03; g.add(bar);
  }
  return g;
}
export function makeGoldWagon(fullness = 1) {
  const g = new THREE.Group();
  const side = M(0xffffff, { map: WOOD_TEX, roughness: 0.9 });
  g.add(box(5.2, 0.25, 2.5, IRON_D, 0, 0.65, 0));                    // floor
  for (const s of [-1, 1]) g.add(box(5.2, 1.15, 0.12, side, 0, 1.3, s * 1.19));
  for (const e of [-1, 1]) g.add(box(0.12, 1.15, 2.5, side, e * 2.54, 1.3, 0));
  for (const wx of [-1.7, 1.7]) for (const s of [-1, 1]) {
    const w = cyl(0.5, 0.5, 0.1, IRON_D, wx, 0.5, s * 1.28, 18); w.rotation.x = Math.PI / 2; g.add(w);
  }
  // gold crates inside, stacked 2 high, slight jitter
  const n = Math.round(6 * fullness);
  let k = 0;
  for (let ix = 0; ix < 3 && k < n; ix++) for (let iz = 0; iz < 2 && k < n; iz++, k++) {
    const c = makeGoldCrate();
    c.position.set(-1.6 + ix * 1.6, 0.78, -0.55 + iz * 1.05);
    c.rotation.y = (Math.sin(k * 7.3) * 0.05);
    g.add(c);
    if (k % 2 === 0 && fullness > 0.6) { const c2 = makeGoldCrate(); c2.position.set(c.position.x, 1.32, c.position.z); c2.rotation.y = 0.04; g.add(c2); }
  }
  if (fullness > 0.6) {   // loose ingot pyramid (3-2-1) atop the middle upper crate
    let bi = 0;
    for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++, bi++) {
      const bar = makeGoldBar();
      bar.position.set(-0.27 + i * 0.27 + row * 0.135, 2.06 + row * 0.098, -0.55);
      bar.rotation.y = (bi % 3 - 1) * 0.04; g.add(bar);
    }
  }
  return g;
}

/* ---------------- tunnel hill + portal ---------------- */
export function makeTunnelHill() {
  // Group local: hill centre at origin; portal face at local x = -16.5, opening
  // centred on local z = 0, track level y = 0. Place group so the portal sits
  // against the slope (e.g. group at (36,0,8) -> portal world x = 19.5).
  const g = new THREE.Group();
  const grass = M(0x699c4b, { roughness: 1 });
  const grass2 = M(0x5d8f43, { roughness: 1 });
  const hill = sph(1, grass, 0, 0, 0, 28); hill.scale.set(18, 8.5, 12); hill.position.y = -0.8; g.add(hill);
  const hill2 = sph(1, grass2, 10, 0, -4, 24); hill2.scale.set(13, 6.0, 9); hill2.position.y = -0.9; g.add(hill2);
  // tunnel throat: dark box interior (train disappears into it)
  const throat = box(33.5, 4.7, 5.4, new THREE.MeshBasicMaterial({ color: 0x050607 }), -1.9, 2.35, 0.2);
  throat.castShadow = false; throat.receiveShadow = false; g.add(throat);
  // portal face: stone frame around a 5m wide x 5m high arched opening
  const ptex = STONE_TEX.clone(); ptex.needsUpdate = true; ptex.repeat.set(4, 2.5);
  const stone = M(0xffffff, { map: ptex, roughness: 0.95 });
  const block = box(5.2, 7.2, 8.8, stone, -16.5, 3.3, 0); g.add(block);   // solid stone massif around the mouth
  const face = new THREE.Group();
  face.add(box(1.2, 6.6, 2.3, stone, 0, 3.3, -3.65));
  face.add(box(1.2, 6.6, 2.3, stone, 0, 3.3, 3.65));
  face.add(box(1.2, 1.7, 9.6, stone, 0, 5.95, 0));
  for (let i = 0; i <= 8; i++) {   // arch curve stones
    const a = (i / 8) * Math.PI;
    const st = box(1.2, 0.85, 1.05, stone, 0, 4.6 + Math.sin(a) * 0.9, Math.cos(a) * 2.5);
    st.rotation.x = (Math.PI / 2 - a);
    face.add(st);
  }
  // wing retaining walls angling back into the hill
  for (const s of [-1, 1]) {
    const wing = box(4.2, 3.6, 0.7, stone, 1.9, 1.8, s * 4.6);
    wing.rotation.y = s * 0.5; face.add(wing);
  }
  // dark opening: rect + half-disc, just in front of the throat box face
  const open = new THREE.Mesh(new THREE.CircleGeometry(2.5, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x030304 }));
  open.rotation.y = -Math.PI / 2; open.position.set(-0.65, 2.5, 0); open.scale.set(1, 1.02, 1); face.add(open);
  face.add(box(0.1, 2.5, 5.0, new THREE.MeshBasicMaterial({ color: 0x030304 }), -0.65, 1.25, 0));
  face.position.set(-18.6, 0, 0);
  g.add(face);
  g.userData.portalX = -18.6;      // local x of portal face
  g.userData.openingY = 2.5;
  return g;
}

/* ---------------- castle ---------------- */
export function makeCastle() {
  const g = new THREE.Group();
  const stTex = STONE_TEX.clone(); stTex.needsUpdate = true; stTex.repeat.set(2.5, 1.6);
  const stone = M(0xffffff, { map: stTex, roughness: 0.95 });
  const stoneD = M(0x7e7c74, { roughness: 0.95 });
  const roofM = M(0x4c4438, { roughness: 0.9 });
  g.add(box(11, 4.5, 3.2, stone, 0, 2.25, 0));                        // curtain wall
  g.add(box(5.5, 6.5, 4.6, stoneD, 0.4, 3.25, 0));                    // keep
  g.add(box(6.1, 0.5, 5.2, roofM, 0.4, 6.7, 0));
  for (const tx of [-4.6, 5.2]) {
    const t = cyl(1.5, 1.7, 8.2, stone, tx, 4.1, 0, 14); g.add(t);
    const roof = cyl(0.15, 1.95, 2.4, roofM, tx, 9.4, 0, 14); g.add(roof);
    g.add(cyl(1.62, 1.62, 0.4, stoneD, tx, 8.3, 0, 14));
  }
  for (let i = 0; i < 6; i++) g.add(box(0.7, 0.8, 0.3, stoneD, -4.9 + i * 1.9, 4.85, 1.55)); // battlements
  for (const [wx, wy] of [[-4.6, 5.6], [5.2, 5.6], [0.4, 4.4], [-1.2, 2.2], [2.0, 2.2]])   // windows (dark)
    g.add(box(0.5, 0.8, 0.1, M(0x1c2126, { roughness: 0.3 }), wx, wy, 2.32));
  return g;
}

/* ---------------- pine tree (darker) ---------------- */
export function makePineTree(s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.09, 0.14, 1.6, M(0x5d4026), 0, 0.8, 0));
  const leaf = M(0x2f6034, { roughness: 1 }), leaf2 = M(0x38683a, { roughness: 1 });
  const c1 = cyl(0.02, 1.25, 2.2, leaf, 0, 2.4, 0, 12); g.add(c1);
  const c2 = cyl(0.02, 0.95, 1.9, leaf2, 0, 3.6, 0, 12); g.add(c2);
  const c3 = cyl(0.02, 0.6, 1.6, leaf, 0, 4.7, 0, 12); g.add(c3);
  g.scale.setScalar(s);
  return g;
}

/* ---------------- GPR radar unit ---------------- */
export function makeRadar() {
  const g = new THREE.Group();
  const body = M(0xd8d3c8, { roughness: 0.6 });
  g.add(box(0.95, 0.42, 0.62, body, 0, 0.42, 0));
  g.add(box(0.99, 0.08, 0.66, M(0xb8452e, { roughness: 0.6 }), 0, 0.66, 0));
  for (const s of [-1, 1]) { const w = cyl(0.21, 0.21, 0.07, IRON_D, 0, 0.21, s * 0.36, 16); w.rotation.x = Math.PI / 2; g.add(w); }
  // handle: two angled arms + crossbar (grip line at back, ~0.95 high)
  for (const s of [-1, 1]) { const arm = box(0.05, 0.75, 0.05, STEEL, -0.55, 0.75, s * 0.26); arm.rotation.z = 0.5; g.add(arm); }
  const bar = cyl(0.025, 0.025, 0.58, IRON_D, -0.72, 1.02, 0, 10); bar.rotation.x = Math.PI / 2; g.add(bar);
  g.userData.handleY = 1.02; g.userData.handleX = -0.72; g.userData.handleHalf = 0.26;
  // screen on a stalk, tilted toward operator
  const stalk = box(0.05, 0.4, 0.05, STEEL, -0.3, 0.85, 0); stalk.rotation.z = 0.3; g.add(stalk);
  const scr = new THREE.Group(); scr.position.set(-0.38, 1.08, 0); scr.rotation.z = -0.35; // display plane already faces -X (operator side)
  scr.add(box(0.04, 0.42, 0.56, IRON_D, 0, 0, 0));
  const cvs = document.createElement('canvas'); cvs.width = 256; cvs.height = 192;
  const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshBasicMaterial({ map: tex }));
  disp.position.set(-0.025, 0, 0); disp.rotation.y = -Math.PI / 2; scr.add(disp);
  g.add(scr);
  g.userData.screen = { cvs, ctx: cvs.getContext('2d'), tex };
  g.userData.drawScreen = (blip, shapeAmt) => {
    const x = g.userData.screen.ctx, W = 256, H = 192;
    x.fillStyle = '#0a1f14'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#1e5c38'; x.lineWidth = 1;
    for (let gy = 24; gy < H; gy += 24) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
    for (let gx = 24; gx < W; gx += 24) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); }
    // ground strata bands
    x.fillStyle = 'rgba(46,110,66,0.35)'; x.fillRect(0, 60, W, 20);
    x.fillStyle = 'rgba(46,110,66,0.22)'; x.fillRect(0, 110, W, 16);
    if (shapeAmt > 0) { // the long train shape
      x.strokeStyle = `rgba(120,255,170,${0.35 + 0.65 * shapeAmt})`; x.lineWidth = 3;
      x.strokeRect(38, 128, 180 * shapeAmt, 22);
      x.beginPath(); x.moveTo(38, 128); x.lineTo(52, 116); x.lineTo(84, 116); x.lineTo(92, 128); x.stroke();
    }
    if (blip > 0) { // sweep blip
      const bx = 128 + Math.sin(blip * 9.0) * 60, by = 132;
      const gr = x.createRadialGradient(bx, by, 1, bx, by, 26);
      gr.addColorStop(0, `rgba(160,255,190,${blip})`); gr.addColorStop(1, 'rgba(160,255,190,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(bx, by, 26, 0, 7); x.fill();
    }
    x.fillStyle = '#7ddb9e'; x.font = 'bold 15px monospace'; x.fillText('GPR-9000', 8, 18);
    g.userData.screen.tex.needsUpdate = true;
  };
  g.userData.drawScreen(0, 0);
  return g;
}

/* ---------------- paper map ---------------- */
export function makeMap() {
  const geo = new THREE.PlaneGeometry(0.62, 0.46, 8, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, Math.sin((x / 0.62 + 0.5) * Math.PI) * 0.03); }
  geo.computeVertexNormals();
  const cvs = document.createElement('canvas'); cvs.width = 256; cvs.height = 192;
  const x = cvs.getContext('2d');
  x.fillStyle = '#efe6cc'; x.fillRect(0, 0, 256, 192);
  x.strokeStyle = '#9a8a5f'; x.lineWidth = 2; x.beginPath(); x.moveTo(10, 150); x.bezierCurveTo(80, 90, 150, 130, 240, 60); x.stroke();
  x.strokeStyle = '#b8a678'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(70 + i * 8, 60 + i * 14, 18 + i * 13, 0.4, 2.4); x.stroke(); }
  x.fillStyle = '#b03030'; x.font = 'bold 26px Arial'; x.fillText('X', 208, 52);
  x.fillStyle = '#6a5a34'; x.font = '13px Arial'; x.fillText('WALIMIERZ', 12, 22);
  const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
  m.castShadow = true;
  const g = new THREE.Group(); g.add(m);
  return g;
}

/* ---------------- borehole + tripod + pod ---------------- */
export function makeBorehole() {
  const g = new THREE.Group();
  const hole = cyl(0.17, 0.17, 0.06, new THREE.MeshBasicMaterial({ color: 0x020202 }), 0, 0.032, 0, 20);
  hole.castShadow = false; g.add(hole);
  const collar = cyl(0.26, 0.3, 0.1, M(0x777777, { metalness: 0.5, roughness: 0.5 }), 0, 0.05, 0, 20); g.add(collar);
  // tripod
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = cyl(0.025, 0.025, 1.9, STEEL, Math.cos(a) * 0.42, 0.85, Math.sin(a) * 0.42, 8);
    leg.rotation.z = Math.cos(a) * 0.42; leg.rotation.x = -Math.sin(a) * 0.42; g.add(leg);
  }
  g.add(box(0.22, 0.14, 0.22, IRON_D, 0, 1.72, 0));
  // pod on cable (animated in scene): pod group at top of cable
  const pod = new THREE.Group();
  const bodyM = M(0xc8cdd2, { metalness: 0.7, roughness: 0.35 });
  const pb = cyl(0.09, 0.09, 0.34, bodyM, 0, 0, 0, 14); pod.add(pb);
  pod.add(sph(0.09, bodyM, 0, 0.18, 0, 12));
  const lampMat = M(0xfff2b0, { emissive: 0xffdf8a, emissiveIntensity: 3.2 });
  pod.add(sph(0.045, lampMat, 0, -0.19, 0, 10));
  const cable = cyl(0.008, 0.008, 1, IRON_D, 0, 0.5, 0, 6); cable.castShadow = false; pod.add(cable);
  pod.position.set(0, 1.62, 0);
  g.add(pod);
  g.userData.pod = pod; g.userData.cable = cable; g.userData.podLampMat = lampMat;
  g.userData.setPodDepth = (depth) => { // depth in metres below tripod head (0..~7 visual)
    pod.position.y = 1.62 - depth;
    cable.scale.y = Math.max(0.05, depth + 0.1);
    cable.position.y = (depth + 0.1) / 2 + 0.1;
  };
  return g;
}

/* ---------------- rocks ---------------- */
export function makeRock(r = 0.4) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), M(0x77726a, { roughness: 1, flatShading: true }));
  m.castShadow = true; m.receiveShadow = true;
  m.rotation.set(r * 3.1, r * 5.7, r * 1.3);
  m.scale.y = 0.75;
  return m;
}
export function makeRockPile(n = 9, spread = 1.6) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const r = 0.3 + ((i * 37) % 10) / 22;
    const rock = makeRock(r);
    const a = i * 2.4, d = (i % 4) * spread * 0.22;
    rock.position.set(Math.cos(a) * d - spread / 2 + (i % 3) * 0.5, r * 0.35, Math.sin(a) * d * 0.5);
    g.add(rock);
  }
  return g;
}
