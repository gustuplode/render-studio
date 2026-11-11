import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, bikeAt, planeAt, kabangPosAt } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene(); window.__scene = scene; window.__THREE = THREE;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(1), 1, 6), beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  stone: texM(P.stone(4), 1, 1),
  dirt: texM(P.dirt(7), 10, 10),
  road: texM(P.dirt(17), 16, 3, '#8a7a68'),
  walk: texM(P.plaster(18, 36), 16, 1, '#cbb894'),
  wallA: texM(P.plaster(21, 38), 3, 2, '#e8cfa0'), wallB: texM(P.plaster(22, 200), 3, 2, '#a8c4b0'), wallC: texM(P.plaster(23, 340), 3, 2, '#d9a0a8'),
  roofTile: texM(P.roof(9), 3, 2), roofWood: texM(P.planks(9), 2, 1, '#5d4a38'),
  clinicWall: texM(P.plaster(24, 210), 4, 2, '#eef0ea'),
};
const MW = {
  leaf: toon({ color: '#4d7a35' }), leafDk: toon({ color: '#3a5f28' }), trunk: toon({ color: '#6d5136' }),
  hill: toon({ color: '#a8b494' }), darkIn: toon({ color: '#241d18' }),
  lampGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,190,110', 0.85)), transparent: true, fog: false, depthWrite: false }),
  winGlow: new THREE.MeshBasicMaterial({ color: '#ffb45e', fog: false }),
  red: toon({ color: '#b03a30' }), white: toon({ color: '#eef2f6' }), cream: toon({ color: '#e9dcba' }),
  bikeRed: toon({ color: '#a02828' }), chrome: toon({ color: '#c9ccd2' }), tyre: toon({ color: '#26262a' }),
  planeWhite: toon({ color: '#f0f2f4' }), planeBlue: toon({ color: '#2a5a9c' }),
};

const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});

const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };
const ndSkip = (o) => { o.traverse((m) => { m.userData.ndSkip = true; }); };
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 }, aur: { value: 0 }, time: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize, aur, time; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- world ----------
const world = new THREE.Group(); scene.add(world);
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const winMats = [];
const cloths = [];
const winAt = (parent, x, y, z, w = 0.55, h = 0.65) => {
  const wm = MW.winGlow.clone(); winMats.push(wm);
  const wp = add(new THREE.PlaneGeometry(w, h), wm, x, y, z, parent, { cast: false });
  wp.userData.ndSkip = true;
  add(box(w + 0.1, 0.06, 0.05), M.beamDark, x, y + h / 2 + 0.02, z, parent, { cast: false });
  add(box(w + 0.1, 0.06, 0.05), M.beamDark, x, y - h / 2 - 0.02, z, parent, { cast: false });
  return wp;
};
const clothAt = (parent, x, y, z, w, h, color, ry = 0, amp = 0.16) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 10, 3), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = false; parent.add(m);
  FX.clothInit(m, { amp, freq: 3.2, speed: 5 });
  cloths.push(m); return m;
};

// base earth + distant green hills
flat(add(new THREE.CircleGeometry(230, 40), texM(P.plaster(20, 95), 42, 42, '#b39b58'), 0, -0.05, 0, world, { cast: false }));
for (const [hx, hy, hz, hr] of [[-95, -6, -80, 30], [20, -7, -95, 26], [100, -6, -50, 28], [-100, -6, 40, 24], [70, -7, 80, 30]]) {
  const h = add(new THREE.SphereGeometry(hr, 16, 10), MW.hill, hx, hy, hz, world, { cast: false }); h.scale.y = 0.42;
}

// text-board helper (bobbie pattern): posts + framed face, text sized per line
const textBoard = (lines, w, h) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = '#6d5136'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#e9dcba'; g.fillRect(26, 26, c.width - 52, c.height - 52);
  g.strokeStyle = '#8a6a44'; g.lineWidth = 10; g.strokeRect(26, 26, c.width - 52, c.height - 52);
  g.fillStyle = '#2e2620'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach(([txt, px], i) => { g.font = `900 ${px}px Arial`; const tw = g.measureText(txt).width, maxW = c.width - 170; if (tw > maxW) { g.font = `900 ${Math.floor(px * maxW / tw)}px Arial`; } g.fillText(txt, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (0.30 + 0.38 * i))); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const grp = new THREE.Group();
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.055, 0.07, h + 0.7, 7), M.beamDark, sd * w * 0.38, (h + 0.7) / 2, -0.06, grp, { cast: false });
  add(tbox(w + 0.16, h + 0.16, 0.09, 2), M.beam, 0, h / 2 + 0.62, -0.05, grp);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: true }));
  face.position.set(0, h / 2 + 0.62, 0.01); face.userData.ndSkip = true; grp.add(face);
  return grp;
};

// ===== ZAMBOANGA STREET =====
const streetG = new THREE.Group(); world.add(streetG);
{
  // layered street: dirt base -> road strip -> sidewalks -> crosswalk -> dashes
  flat(add(new THREE.CircleGeometry(30, 32), texM(P.plaster(25, 45), 26, 26, '#c2a06a'), 0, -0.01, 0, streetG, { cast: false }));
  flat(add(new THREE.PlaneGeometry(38, 6.6), M.road, 0, 0.012, 0, streetG, { cast: false }));
  for (const sd of [-1, 1]) flat(add(new THREE.PlaneGeometry(38, 1.2), M.walk, 0, 0.02, sd * 3.95, streetG, { cast: false }));
  for (let i = 0; i < 5; i++) { const s = flat(add(new THREE.PlaneGeometry(0.55, 5.9), MW.white, 0.7 + i * 0.48, 0.024, 0, streetG, { cast: false })); s.material = toon({ color: '#a89f8c' }); }
  for (let i = -8; i <= 8; i++) { if (Math.abs(i) < 3) continue; const d = flat(add(new THREE.PlaneGeometry(1.1, 0.22), MW.cream, i * 2.2, 0.024, 0, streetG, { cast: false })); d.material = toon({ color: '#ddd2ae' }); }
}
// puddle glints on the road (animated in worldState)
const puddleGlints = [];
for (const [px, pz, ps] of [[-3.4, 1.4, 0.5], [4.6, -1.7, 0.42], [8.2, 1.1, 0.36]]) {
  const pud = flat(add(new THREE.CircleGeometry(0.55, 14), FX.glassMat(0x9fc4d8, 0.4), px, 0.03, pz, streetG, { cast: false }));
  pud.userData.ndSkip = true;
  const gl = FX.glint(ps); gl.position.set(px + 0.15, 0.12, pz + 0.1); gl.material.opacity = 0; gl.userData.ndSkip = true; streetG.add(gl);
  puddleGlints.push(gl);
}
// houses along the north side
const houseAt = (x, z, wallMat, s = 1) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); streetG.add(g);
  add(tbox(4.4, 2.5, 3.2, 2), wallMat, 0, 1.25, 0, g);
  const r1 = add(tbox(2.9, 0.09, 3.7, 2), M.roofTile, -1.18, 2.95, 0, g); r1.rotation.z = 0.58;
  const r2 = add(tbox(2.9, 0.09, 3.7, 2), M.roofTile, 1.18, 2.95, 0, g); r2.rotation.z = -0.58;
  add(box(0.85, 1.6, 0.07), MW.darkIn, 0.7, 0.8, 1.62, g, { cast: false });
  winAt(g, -1.1, 1.45, 1.62); winAt(g, 1.75, 1.45, 1.62, 0.45, 0.55);
  add(box(0.3, 0.8, 0.3), M.stone, -1.5, 3.1, -0.6, g, { cast: false }); // chimney
  return g;
};
houseAt(-11.5, -7.6, M.wallB); houseAt(-4, -7.4, M.wallA, 1.08); houseAt(3.5, -7.6, M.wallC); houseAt(10.5, -7.4, M.wallB); houseAt(17, -7.8, M.wallA, 0.95);
// Kabang's porch: posts + flat awning in front of her house (HOME cards stand under its edge)
{
  const g = new THREE.Group(); g.position.set(-4, 0, -5.3); streetG.add(g);
  for (const sd of [-1.9, 1.9]) add(new THREE.CylinderGeometry(0.05, 0.06, 2.1, 7), M.beamDark, sd, 1.05, 0, g, { cast: false });
  const awn = add(tbox(4.4, 0.07, 1.5, 2), M.roofWood, 0, 2.14, 0.3, g, { cast: false }); awn.rotation.x = 0.16;
  const cr = FX.crate(0.62); cr.position.set(-1.7, 0.31, -0.5); ndSkip(cr); g.add(cr);
  const ba = FX.barrel(0.3, 0.72); ba.position.set(1.75, 0.36, -0.45); ndSkip(ba); g.add(ba);
}
// fence runs between the houses (layered midground)
for (let i = 0; i < 16; i++) {
  const x = -14.5 + i * 1.9;
  if (x > -6.6 && x < -1.2) continue; // porch gap
  add(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 6), M.beamDark, x, 0.48, -5.6, streetG, { cast: false });
}
add(box(31, 0.07, 0.05), M.beam, -0.5, 0.78, -5.6, streetG, { cast: false });
add(box(31, 0.07, 0.05), M.beam, -0.5, 0.42, -5.6, streetG, { cast: false });
// laundry lines with waving cloth (foreground life)
{
  const pole = (x, z) => add(new THREE.CylinderGeometry(0.04, 0.05, 2.5, 6), M.beamDark, x, 1.25, z, streetG, { cast: false });
  pole(-8.6, -5.2); pole(-5.9, -5.2); add(box(2.7, 0.04, 0.04), M.beamDark, -7.25, 2.42, -5.2, streetG, { cast: false });
  clothAt(streetG, -7.7, 2.0, -5.18, 1.0, 0.85, 0xe2703a); clothAt(streetG, -6.7, 2.02, -5.18, 0.9, 0.8, 0x5a8fc2);
  pole(6.2, -5.2); pole(8.9, -5.2); add(box(2.7, 0.04, 0.04), M.beamDark, 7.55, 2.42, -5.2, streetG, { cast: false });
  clothAt(streetG, 7.0, 2.0, -5.18, 1.0, 0.85, 0xf2b234); clothAt(streetG, 8.1, 2.02, -5.18, 0.85, 0.75, 0xe86e78);
}
// market stalls along the south side: posts, cloth awnings, crates, fruit
const stallAt = (x, z, awnCol) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); streetG.add(g);
  for (const [sx, sz] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]]) add(new THREE.CylinderGeometry(0.045, 0.05, 2.2, 6), M.beamDark, sx, 1.1, sz, g, { cast: false });
  const awn = clothAt(g, 0, 2.28, 0, 3.1, 1.9, awnCol); awn.rotation.x = -0.35;
  add(tbox(2.7, 0.75, 1.5, 2), M.plank, 0, 0.38, 0, g);
  const r = P.rng(x * 10 | 0);
  for (let i = 0; i < 7; i++) add(new THREE.SphereGeometry(0.11, 8, 6), toon({ color: ['#e8a13a', '#c23b2e', '#7a9a3a'][i % 3] }), -1.0 + (i % 4) * 0.6, 0.86 + Math.floor(i / 4) * 0.18, -0.3 + (i % 2) * 0.5, g, { cast: false });
  const cr = FX.crate(0.55); cr.position.set(1.8, 0.28, 0.7); ndSkip(cr); g.add(cr);
  return g;
};
stallAt(-8.5, 6.4, 0xc23b2e); stallAt(-1.5, 6.8, 0x2f7a5a); stallAt(6.5, 6.4, 0xe8a13a); stallAt(13, 6.8, 0x4f7fb8);
// a parked push-cart (midground prop, east end)
{
  const g = new THREE.Group(); g.position.set(11.5, 0, 3.9); g.rotation.y = -0.5; streetG.add(g);
  add(tbox(1.7, 0.5, 1.0, 2), M.plank, 0, 0.62, 0, g);
  for (const sd of [-0.7, 0.7]) { const wh = add(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 12), M.beamDark, sd, 0.42, 0.55, g, { cast: false }); wh.rotation.x = Math.PI / 2; }
  add(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), M.beamDark, -1.2, 0.5, 0, g, { cast: false }).rotation.z = 1.1;
  const cr = FX.crate(0.5); cr.position.set(-0.3, 1.12, 0); ndSkip(cr); g.add(cr);
  const ba = FX.barrel(0.26, 0.6); ba.position.set(0.45, 1.17, 0.1); ndSkip(ba); g.add(ba);
}
// palms
const palmAt = (x, z, h = 5.4) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); streetG.add(g);
  const tr = add(new THREE.CylinderGeometry(0.13, 0.2, h, 7), MW.trunk, 0, h / 2, 0, g, { cast: false }); tr.rotation.z = 0.08;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const fr = add(new THREE.ConeGeometry(0.34, 2.3, 5), i % 2 ? MW.leaf : MW.leafDk, Math.cos(a) * 0.95 + 0.4, h + 0.25, Math.sin(a) * 0.95, g, { cast: false });
    fr.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15 - 0.35); fr.scale.set(1, 1, 0.32);
  }
  add(new THREE.SphereGeometry(0.17, 8, 6), MW.trunk, 0.35, h - 0.25, 0.15, g, { cast: false });
  add(new THREE.SphereGeometry(0.15, 8, 6), MW.trunk, 0.6, h - 0.38, -0.12, g, { cast: false });
  return g;
};
palmAt(-14.5, -4.6, 5.8); palmAt(8.6, -5.4, 5.1); palmAt(15.5, 4.8, 6.1); palmAt(-12.5, 5.2, 5.4); palmAt(1.8, -6.2, 4.7);
// foreground dressing on the camera side of the road (no bare foreground in any street beat)
{
  const cr = FX.crate(0.58); cr.position.set(6.6, 0.29, 1.0); ndSkip(cr); streetG.add(cr);
  const cr2 = FX.crate(0.44); cr2.position.set(6.55, 0.79, 0.95); cr2.rotation.y = 0.4; ndSkip(cr2); streetG.add(cr2);
  const ba = FX.barrel(0.3, 0.72); ba.position.set(3.4, 0.36, 2.45); ndSkip(ba); streetG.add(ba);
  const ba2 = FX.barrel(0.26, 0.62); ba2.position.set(7.9, 0.31, 2.2); ndSkip(ba2); streetG.add(ba2);
  const cr3 = FX.crate(0.52); cr3.position.set(-5.8, 0.26, 2.5); ndSkip(cr3); streetG.add(cr3);
  const cr4 = FX.crate(0.5); cr4.position.set(-1.7, 0.25, 2.65); ndSkip(cr4); streetG.add(cr4);
}
// intro board: ZAMBOANGA CITY · PHILIPPINES 2011 (fully framed in the intro push-in)
const introBoard = textBoard([['ZAMBOANGA CITY', 84], ['PHILIPPINES · 2011', 56]], 2.0, 1.0);
introBoard.position.set(-3.1, 2.05, -2.58); introBoard.rotation.y = 0.05; streetG.add(introBoard);
introBoard.visible = false; // hidden outside its own beat — worldState reveals it on the introT ramp (never seen cropped as scenery)
// finale board: the two lines, sized so NOTHING is cropped (checked in stills)
const finaleBoard = textBoard([['SHE GAVE HER FACE.', 86], ["THEY GAVE HER A HERO'S WELCOME.", 50]], 4.6, 2.0);
finaleBoard.position.set(0.3, 0.85, -5.1); streetG.add(finaleBoard);
finaleBoard.visible = false; // hidden until its own beat — worldState reveals it on the boardT ramp (never seen cropped as scenery)
const boardGlint = FX.glint(0.55); boardGlint.position.set(2.05, 3.15, -6.1); boardGlint.material.opacity = 0; boardGlint.userData.ndSkip = true; streetG.add(boardGlint);
// finale bunting: poles + three waving swags behind the crowd
{
  for (const sd of [-4.4, 4.4]) add(new THREE.CylinderGeometry(0.05, 0.06, 3.3, 7), M.beamDark, sd, 1.65, -3.3, streetG, { cast: false });
  add(box(8.9, 0.045, 0.045), M.beamDark, 0, 3.24, -3.3, streetG, { cast: false });
  clothAt(streetG, -3.0, 3.06, -3.28, 2.6, 0.34, 0xc23b2e, 0, 0.07);
  clothAt(streetG, -0.2, 3.08, -3.28, 2.6, 0.34, 0xf2b234, 0, 0.07);
  clothAt(streetG, 2.7, 3.06, -3.28, 2.6, 0.34, 0x2f7a5a, 0, 0.07);
  // donation crate + jar near the hero beat (father points at it)
  const cr = FX.crate(0.66); cr.position.set(-2.7, 0.33, -3.3); streetG.add(cr);
  const jar = FX.crate(0.34); jar.position.set(-2.7, 0.83, -3.3); jar.rotation.y = 0.3; streetG.add(jar);
}

// ===== UC DAVIS CLINIC (44,0,-26) =====
const clinicG = new THREE.Group(); world.add(clinicG);
{
  flat(add(new THREE.CircleGeometry(17, 28), texM(P.plaster(26, 100), 20, 20, '#8fae6a'), 44, -0.01, -26, clinicG, { cast: false }));
  flat(add(new THREE.PlaneGeometry(13, 3.4), M.walk, 44, 0.015, -22.6, clinicG, { cast: false }));
  const b = new THREE.Group(); b.position.set(44, 0, -30); clinicG.add(b);
  add(tbox(11, 4.4, 3.4, 2), M.clinicWall, 0, 2.2, 0, b);
  add(tbox(11.6, 0.35, 4.0, 2), M.beamDark, 0, 4.55, 0, b, { cast: false });
  add(box(1.3, 2.5, 0.08), MW.darkIn, -2.2, 1.25, 1.72, b, { cast: false });
  const glassDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.3), FX.glassMat(0x9fc4d8, 0.4));
  glassDoor.position.set(2.4, 1.2, 1.72); glassDoor.userData.ndSkip = true; b.add(glassDoor);
  winAt(b, -4.2, 2.2, 1.72, 1.1, 1.0); winAt(b, 0.2, 2.2, 1.72, 1.1, 1.0); winAt(b, 4.4, 2.2, 1.72, 1.1, 1.0);
  // red-cross roundel over the door
  add(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 20), MW.white, -2.2, 3.3, 1.74, b, { cast: false }).rotation.x = Math.PI / 2;
  add(box(0.5, 0.16, 0.03), MW.red, -2.2, 3.3, 1.79, b, { cast: false });
  add(box(0.16, 0.5, 0.03), MW.red, -2.2, 3.3, 1.79, b, { cast: false });
  // bench + treatment table + crates on the lawn in front
  add(tbox(1.9, 0.09, 0.5, 2), M.beam, 41.2, 0.5, -23.4, clinicG, { cast: false });
  for (const sd of [-0.8, 0.8]) add(box(0.09, 0.5, 0.45), M.beamDark, 41.2 + sd, 0.25, -23.4, clinicG, { cast: false });
  add(tbox(1.6, 0.75, 0.7, 2), MW.white, 45.7, 0.38, -23.3, clinicG);
  const cr = FX.crate(0.6); cr.position.set(46.6, 0.3, -23.6); ndSkip(cr); clinicG.add(cr);
  const ba = FX.barrel(0.3, 0.72); ba.position.set(40.6, 0.36, -25.8); ndSkip(ba); clinicG.add(ba);
  // hedges + two neat trees
  for (let i = 0; i < 6; i++) { const hx = 39.4 + i * 1.85; if (i === 2 || i === 3) continue; const hd = add(new THREE.SphereGeometry(0.62, 9, 7), MW.leafDk, hx, 0.42, -27.6, clinicG, { cast: false }); hd.scale.y = 0.75; }
  const treeAt = (x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z); clinicG.add(g);
    add(new THREE.CylinderGeometry(0.11, 0.16, 2.2, 7), MW.trunk, 0, 1.1, 0, g, { cast: false });
    add(new THREE.SphereGeometry(1.45, 10, 8), MW.leaf, 0, 3.1, 0, g, { cast: false });
    add(new THREE.SphereGeometry(1.0, 9, 7), MW.leafDk, 0.8, 2.6, 0.4, g, { cast: false }); return g; };
  treeAt(38.6, -24.2); treeAt(49.6, -24.6);
}
const clinicBoard = textBoard([['UC DAVIS', 96], ['CALIFORNIA', 58]], 3.4, 1.6);
clinicBoard.position.set(45.9, 0.72, -28.15); clinicG.add(clinicBoard); // nudged +0.3 inward: at f1150 the wooden frame just touched the left frame edge

// lantern posts: 0 street west · 1 street east · 2 clinic path
const lanterns = [];
const lanternAt = (x, z, parent = streetG) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  add(new THREE.CylinderGeometry(0.045, 0.055, 2.2, 7), M.beamDark, 0, 1.1, 0, g);
  add(new THREE.ConeGeometry(0.2, 0.14, 4), MW.tyre, 0, 2.32, 0, g, { cast: false });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), FX.glassMat(0xffc37a, 0.2));
  glass.position.y = 1.96; glass.userData.ndSkip = true; g.add(glass);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffb45e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(0.75); glow.position.y = 1.96; glow.userData.ndSkip = true; g.add(glow);
  const pool = flat(add(new THREE.CircleGeometry(1.2, 18), MW.lampGlow, 0, 0.015, 0, g, { cast: false }));
  pool.material = MW.lampGlow.clone(); pool.material.opacity = 0; pool.userData.ndSkip = true; pool.receiveShadow = false;
  lanterns.push({ glow, pool, glass });
  return g;
};
lanternAt(-7.6, 3.4); lanternAt(5.6, -3.6); lanternAt(40.8, -21.8, clinicG);

// ===== the motorcycle (built facing +X; story.bikeAt drives it) =====
const bike = new THREE.Group(); world.add(bike);
const bikeTilt = new THREE.Group(); bike.add(bikeTilt);
{
  const wheel = (x) => {
    const w = new THREE.Group(); w.position.set(x, 0.32, 0); bikeTilt.add(w);
    const tyre = add(new THREE.CylinderGeometry(0.32, 0.32, 0.09, 16), MW.tyre, 0, 0, 0, w, { cast: false }); tyre.rotation.x = Math.PI / 2;
    const hub = add(new THREE.CylinderGeometry(0.09, 0.09, 0.11, 10), MW.chrome, 0, 0, 0, w, { cast: false }); hub.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) { const sp = add(box(0.56, 0.045, 0.03), MW.chrome, 0, 0, 0, w, { cast: false }); sp.rotation.z = i * Math.PI / 3; }
    return w;
  };
  wheel(-0.58); wheel(0.58);
  const frame = add(box(0.95, 0.16, 0.14), MW.bikeRed, -0.02, 0.52, 0, bikeTilt);
  const tank = add(box(0.5, 0.24, 0.3), MW.bikeRed, 0.12, 0.72, 0, bikeTilt); tank.rotation.z = -0.12;
  add(box(0.46, 0.09, 0.26), MW.tyre, -0.32, 0.78, 0, bikeTilt, { cast: false }); // seat
  const fork = add(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 7), MW.chrome, 0.52, 0.62, 0, bikeTilt, { cast: false }); fork.rotation.z = 0.42;
  const bar = add(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 7), MW.chrome, 0.38, 0.98, 0, bikeTilt, { cast: false }); bar.rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.09, 9, 7), MW.cream, 0.62, 0.82, 0, bikeTilt, { cast: false }); // headlamp
  const pipe = add(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), MW.chrome, -0.25, 0.3, 0.14, bikeTilt, { cast: false }); pipe.rotation.z = Math.PI / 2 - 0.08;
}
const bikeGlint = FX.glint(0.34); bikeGlint.material.opacity = 0; bikeGlint.userData.ndSkip = true; world.add(bikeGlint);

// ===== the airplane (built facing +X; story.planeAt drives it) =====
const plane = new THREE.Group(); world.add(plane);
{
  const fus = add(new THREE.CylinderGeometry(0.58, 0.5, 5.6, 14), MW.planeWhite, 0, 0, 0, plane); fus.rotation.z = Math.PI / 2;
  const nose = add(new THREE.SphereGeometry(0.57, 12, 9), MW.planeWhite, 2.85, 0, 0, plane, { cast: false }); nose.scale.set(1.1, 0.95, 0.95);
  add(box(5.4, 0.34, 0.06), MW.planeBlue, 0.1, 0.18, 0.585, plane, { cast: false }); // window stripe (camera side)
  add(box(5.4, 0.34, 0.06), MW.planeBlue, 0.1, 0.18, -0.585, plane, { cast: false });
  add(box(1.35, 0.1, 4.9), MW.planeWhite, -0.2, -0.28, 0, plane); // main wing
  add(box(0.7, 0.08, 2.0), MW.planeWhite, -2.75, 0.18, 0, plane, { cast: false }); // tailplane
  const fin = add(box(0.75, 1.05, 0.09), MW.red, -2.8, 0.72, 0, plane, { cast: false }); fin.rotation.z = 0.25;
  for (const sd of [-1.35, 1.35]) { const eng = add(new THREE.CylinderGeometry(0.21, 0.21, 0.85, 10), MW.planeBlue, 0.35, -0.52, sd, plane, { cast: false }); eng.rotation.z = Math.PI / 2; }
  add(box(0.9, 0.22, 0.3), MW.red, -1.9, -0.42, 0, plane, { cast: false }); // belly stripe block
  plane.scale.setScalar(1.12);
}

// ---------- FX (Coded FX Library) ----------
const smoke = new FX.Smoke(scene, 110); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const chimneyEmit = smoke.addEmitter(-5.5, 3.6, -8.0, { rate: 1.2, color: 0xb8bcc0, opacity: 0.14, scale: 0.42, grow: 1.15, life: 2.6, vy: 1.1, wind: 0.5 });
const dustEmit = smoke.addEmitter(0, 0.25, 0, { rate: 1, color: 0xd9b87a, opacity: 0.16, scale: 0.5, grow: 1.25, life: 2.2, vy: 0.5, wind: 0.7 });
const crashEmit = smoke.addEmitter(0.45, 0.35, 0, { rate: 0, color: 0xd9c9a8, opacity: 0.3, scale: 0.6, grow: 1.5, life: 1.6, vy: 0.85, wind: 0.4 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 46, opacity: 0.24, color: 0xf2ead8, drift: 0.35 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; if (m.isSprite) m.userData.baseOp = m.material.opacity; }); });
// low flight clouds: big soft puffs parked around the plane's path (flight beat dressing)
const flightClouds = [];
{
  const r = P.rng(71);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    const bx = -24 + i * 6 + r() * 3, by = 5.4 + r() * 5.5, bz = -19 + r() * 8;
    s.position.set(bx, by, bz); s.scale.set(7 + r() * 5, 2.6 + r() * 1.4, 1);
    s.userData = { ndSkip: true, bx, by, bz, ph: r() * 6.28 };
    scene.add(s); flightClouds.push(s);
  }
}
const mist = FX.mistBand(scene, { count: 7, y: 0.7, opacity: 0.2 });
mist.children.forEach((s, i) => {
  s.position.set(-9 + (i % 4) * 5.5, 0.55 + (i % 3) * 0.16, -3 + i * 1.15);
  s.scale.set(9 + (i % 3) * 3, 2.0, 1);
  s.material.color.set(0xe8d9b0);
  s.userData.bx = s.position.x; s.userData.ndSkip = true;
});
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF), kp = kabangPosAt(fxF);
    chimneyEmit.rate = pr.smokeRate * 0.8;
    dustEmit.rate = pr.dustRate * 3;
    if (kp && Ws.shot !== 'flight' && Ws.shot !== 'davis') { dustEmit.x = kp[0]; dustEmit.z = kp[2]; }
    crashEmit.rate = Ws.shot === 'crash' ? pr.smokeRate : 0;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
  }
};

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor(scale = 1) {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; })();
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & post (house ink/dof contract) ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;
      if (card) ds = 1e4;
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9);
    }
    return e * (1. - smoothstep(140., 520., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, flash < 0. ? vec3(0.) : vec3(1.), clamp(abs(flash), 0., 1.));
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
const WIN_DIM = new THREE.Color('#4a3a2c'), WIN_LIT = new THREE.Color('#ffb45e');
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}
const wrapX = (v, a, b) => ((v - a) % (b - a) + (b - a)) % (b - a) + a;
function worldState(Ws, f) {
  fxStepTo(f);
  const t = f / 30;
  skyU.time.value = t;
  mist.children.forEach((s, i) => {
    s.visible = Ws.shot !== 'flight' && Ws.shot !== 'davis';
    s.position.x = s.userData.bx + Math.sin(f * 0.008 + i * 1.7) * 0.9;
    s.material.opacity = 0.4 * Ws.mist * (0.75 + 0.25 * Math.sin(f * 0.013 + i * 2.1));
  });
  lanterns.forEach((L, i) => {
    L.glow.material.opacity = 0.16 + 0.3 * Ws.winGlow * (0.9 + 0.1 * Math.sin(f * 0.9 + i * 2.3));
    L.pool.material.opacity = 0.1 + 0.18 * Ws.winGlow;
    L.glass.material.opacity = 0.25 + 0.3 * Ws.winGlow;
  });
  winMats.forEach((m) => { m.color.copy(WIN_DIM).lerp(WIN_LIT, Ws.winGlow); });
  // clouds: high library clouds fade with cloudK; low flight puffs drift through the flight beat
  fxClouds.items.forEach((cl) => cl.traverse((m) => { if (m.isSprite) m.material.opacity = (m.userData.baseOp || 0.2) * (0.3 + 0.7 * Ws.cloudK); }));
  flightClouds.forEach((s, i) => {
    s.visible = Ws.cloudK > 0.05;
    s.position.x = wrapX(s.userData.bx + t * (0.55 + (i % 3) * 0.2), -30, 30);
    s.position.y = s.userData.by + Math.sin(t * 0.4 + s.userData.ph) * 0.3;
    s.material.opacity = 0.5 * Ws.cloudK * (Ws.shot === 'flight' ? 1 : 0.45);
  });
  cloths.forEach((c) => FX.clothWave(c, t));
  puddleGlints.forEach((g, i) => { g.material.opacity = Ws.glintK * (0.45 + 0.3 * Math.sin(f * 0.3 + i * 1.9)); });
  boardGlint.material.opacity = Ws.boardT * (0.65 + 0.3 * Math.sin(f * 0.4));
  // finale board reveal: boardT is 0 in every pre-finale beat, so the board
  // stays hidden while other beats play (it used to sit in the street set and
  // appear frame-cropped as background scenery). In the finale it grows from
  // its base along the boardT ramp (1408–1452) as the camera pushes in — no
  // pop at the section boundary, and scale is exactly 1 once boardT = 1.
  const bt = Ws.boardT || 0;
  finaleBoard.visible = bt > 0;
  if (bt > 0) finaleBoard.scale.setScalar(Math.max(bt, 0.002));
  // intro board window: introT is 0 in every beat except its own, so the
  // board stays hidden while other beats play (it used to sit in the street
  // set and appear frame-cropped as background scenery — worst in the
  // finale, where its text was cut at the top-left frame edge). Inside the
  // intro beat it grows from its base on the push-in and shrinks away as
  // the camera leaves it — no pop, and scale is exactly 1 across the
  // presented framing (f183–292 at full size, incl. the verified f240).
  const it = Ws.introT || 0;
  introBoard.visible = it > 0;
  if (it > 0) introBoard.scale.setScalar(Math.max(it, 0.002));
  const bk = bikeAt(f);
  bike.visible = !!bk;
  if (bk) { bike.position.set(bk.x, bk.y || 0, bk.z); bike.rotation.y = bk.ry || 0; bikeTilt.rotation.x = bk.fall || 0; }
  bikeGlint.visible = !!bk;
  if (bk) { bikeGlint.position.set(bk.x + 0.65, 0.85, bk.z + 0.15); bikeGlint.material.opacity = 0.4 + 0.25 * Math.sin(f * 0.5); }
  const pl = planeAt(f);
  plane.visible = !!pl;
  if (pl) { plane.position.set(pl.x, pl.y, pl.z); plane.rotation.set(0, pl.ry || 0, -0.05); }
  waterU.t.value = t;
}

function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), a.roll || 0);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false && a.y < 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? 0) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

const swapForNd = (on) => {
  scene.traverse((o) => {
    if (on) {
      if (o.userData.ndSkip || o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (!o.isMesh) return;
      o.userData.mat0 = o.material;
      o.material = o.userData.nd || ndMat;
    } else {
      if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
      if (o.isMesh && o.userData.mat0 !== undefined) { o.material = o.userData.mat0; delete o.userData.mat0; }
    }
  });
};

window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const Ws = worldAt(f); worldState(Ws, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
