import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt } from './story.js';

// TIMING (authoritative, from stubby-voice/timing.json) — tuple rows [id, f0, f1]:
export const TIMING = [
  ['hook', 0, 178], ['adopt', 179, 316], ['trench', 317, 481], ['gas', 482, 618],
  ['shells', 619, 728], ['night', 729, 883], ['spy', 884, 1054], ['hospital', 1055, 1166],
  ['promo', 1167, 1302], ['parade', 1303, 1396], ['finale', 1397, 1498],
];

const W = 1080, H = 1920;
const canvas = document.createElement('canvas'); canvas.id = 'c'; canvas.width = W; canvas.height = H;
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(1), 1, 6), beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  stone: texM(P.stone(4), 1, 1),
  dirt: texM(P.dirt(7), 8, 8), grass: texM(P.grass(6), 10, 10, '#9aa578'),
  canvasTent: texM(P.plaster(21, 38), 2, 2, '#b3a284'), canvasDark: texM(P.plaster(22, 32), 2, 2, '#8a7a5c'),
  sandbag: texM(P.plaster(23, 36), 1, 1, '#a08b62'), wood: texM(P.planks(5), 2, 2, '#97795a'),
};
const MW = {
  iron: toon({ color: '#5c5a57' }), darkMetal: toon({ color: '#3c4148' }), hull: toon({ color: '#4a4f55' }),
  lampGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,190,110', 0.85)), transparent: true, fog: false, depthWrite: false }),
  red: toon({ color: '#b03a30' }), white: toon({ color: '#eef2f6' }), brass: toon({ color: '#c9a24a' }),
};

// ---------- ink / normal-depth contract ----------
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

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
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
const ground = flat(add(new THREE.CircleGeometry(170, 40), M.grass, 0, 0, 0, world, { cast: false }));
// dirt parade ground / camp yard
flat(add(new THREE.PlaneGeometry(26, 22), M.dirt, 0, 0.012, -1, world, { cast: false }));
// trench floor + battlefield dirt
flat(add(new THREE.PlaneGeometry(44, 9), M.dirt, 0, 0.012, 30, world, { cast: false }));
flat(add(new THREE.PlaneGeometry(44, 16), texM(P.dirt(9), 8, 4, '#8a7a5e'), 0, 0.01, 42, world, { cast: false }));

// --- tents (camp + hospital) ---
const tentAt = (x, z, ry = 0, s = 1, mat = M.canvasTent) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s); world.add(g);
  add(box(2.35, 1.72, 3.25), mat, 0, 0.86, 0, g, { cast: false }); // solid tent body under the roof
  for (const sd of [-1, 1]) { const rf = add(box(1.8, 0.08, 3.4), M.canvasDark, sd * 0.82, 1.52, 0, g); rf.rotation.z = -sd * 0.66; }
  const back = add(box(2.6, 1.35, 0.07), mat, 0, 0.67, -1.68, g, { cast: false });
  const ridge = add(new THREE.CylinderGeometry(0.05, 0.05, 3.5, 6), M.beamDark, 0, 1.92, 0, g, { cast: false }); ridge.rotation.x = Math.PI / 2;
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.04, 0.05, 1.95, 6), M.beamDark, sd * 1.28, 0.97, 1.7, g, { cast: false });
  return g;
};
tentAt(-6.5, -8.5, 0.1); tentAt(-2.2, -9.5, -0.06); tentAt(2.2, -9.5, 0.05); tentAt(6.5, -8.5, -0.12); tentAt(-9.5, -4, 0.5); tentAt(9.8, -4.5, -0.5);
// camp gate: two posts + crossbar at z=8
for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.09, 0.11, 3.1, 8), M.beamDark, sd * 2.2, 1.55, 8, world);
add(box(5.2, 0.14, 0.14), M.beamDark, 0, 3.05, 8, world);
// campfire ring at (3.8,0,2.5) — flame is FX
for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, s = add(new THREE.SphereGeometry(0.15, 8, 6), M.stone, 3.8 + Math.cos(a) * 0.5, 0.06, 2.5 + Math.sin(a) * 0.5, world, { cast: false }); s.scale.y = 0.7; }
for (let i = 0; i < 3; i++) { const l = add(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 7), M.beamDark, 3.8, 0.1, 2.5, world, { cast: false }); l.rotation.z = Math.PI / 2; l.rotation.y = i * 1.05; }
// crates + barrels dressing (FX library)
{ const c1 = FX.crate(0.9); c1.position.set(-3.4, 0.45, 3.4); world.add(c1);
  const c2 = FX.crate(0.7); c2.position.set(-3.3, 1.25, 3.35); c2.rotation.y = 0.4; world.add(c2);
  const b1 = FX.barrel(0.34, 0.95); b1.position.set(-4.3, 0.48, 3.1); world.add(b1);
  const c3 = FX.crate(0.9); c3.position.set(-8.5, 0.45, 32.6); c3.rotation.y = 0.3; world.add(c3);
  const b2 = FX.barrel(0.34, 0.95); b2.position.set(-6.5, 0.48, 32.8); world.add(b2); }

// --- text boards (canvas textures) ---
const boardMeshes = {};
const makeBoard = (name, lines, x, y, z, ry, w = 3.4, h = 1.5, opts = {}) => {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * h / w);
  const g = cv.getContext('2d');
  g.fillStyle = '#4a3a26'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#e9dcba'; g.fillRect(14, 14, cv.width - 28, cv.height - 28);
  g.fillStyle = '#33506b'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((ln, i) => { g.font = `900 ${ln.size || 120}px Arial`; g.fillText(ln.text, cv.width / 2, cv.height * (lines.length === 1 ? 0.52 : 0.3 + i * 0.42)); });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; world.add(grp);
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.06, 0.07, y + h / 2, 7), M.beamDark, sd * (w / 2 - 0.2), (y + h / 2) / 2, 0, grp, { cast: false });
  const mat = new THREE.MeshBasicMaterial({ map: tex, fog: true, transparent: !!opts.fade, side: THREE.DoubleSide });
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); bd.position.set(0, y, 0); bd.userData.ndSkip = true; grp.add(bd);
  boardMeshes[name] = { grp, mat };
  return grp;
};
makeBoard('yale', [{ text: 'YALE, 1917', size: 150 }], 1.95, 1.45, 5.2, 0.15, 3.0, 1.05);
makeBoard('battles', [{ text: '17 BATTLES', size: 150 }], 4.4, 1.75, 31.9, 3.44, 3.2, 1.1);
makeBoard('promo', [{ text: 'SERGEANT', size: 130 }, { text: 'STUBBY', size: 150 }], 2.3, 1.85, -4.8, 0.2, 3.6, 1.7, { fade: true });
makeBoard('final', [{ text: 'THE FIRST', size: 120 }, { text: 'DOG SERGEANT', size: 118 }], 0.25, 2.1, -6.5, 0, 3.4, 1.4, { fade: true });
boardMeshes.promo.mat.opacity = 0; boardMeshes.final.mat.opacity = 0;

// --- flags (cloth FX) ---
const flagTex = (() => {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const g = cv.getContext('2d');
  for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#eef0ea' : '#b03a30'; g.fillRect(0, i * 24, 256, 24); }
  g.fillStyle = '#2c3c6e'; g.fillRect(0, 0, 110, 84);
  g.fillStyle = '#fff'; for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { g.beginPath(); g.arc(12 + c * 22, 12 + r * 20, 3.4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const flags = [];
const flagAt = (x, z, s = 1) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(new THREE.CylinderGeometry(0.045, 0.06, 4.6 * s, 7), M.beamDark, 0, 2.3 * s, 0, g, { cast: false });
  const geo = new THREE.PlaneGeometry(1.7 * s, 1.05 * s, 12, 6); geo.translate(0.85 * s, 0, 0);
  const fl = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide, fog: true }));
  fl.position.set(0.03, 4.05 * s, 0); fl.userData.ndSkip = true; g.add(fl);
  FX.clothInit(fl, { amp: 0.16, freq: 2.6, speed: 3.2 });
  flags.push(fl); return g;
};
flagAt(-3.2, -3.8, 1); flagAt(4.4, -4.2, 0.9); flagAt(-5.2, -0.6, 0.75); flagAt(6.2, 2.2, 0.75);

// --- ship at (40,1.2,-30): hull + deck + mast on FX water ---
const shipG = new THREE.Group(); shipG.position.set(40, 0, -30); world.add(shipG);
{ add(box(7.5, 1.6, 3.2), MW.hull, 0, 0.55, 0, shipG);
  add(box(7.9, 0.14, 3.5), M.wood, 0, 1.42, 0, shipG);
  const bow = add(new THREE.CylinderGeometry(1.6, 1.6, 1.6, 3, 1), MW.hull, 4.4, 0.55, 0, shipG, { cast: false }); bow.rotation.y = Math.PI / 2; bow.scale.set(1, 1, 0.55);
  add(new THREE.CylinderGeometry(0.07, 0.09, 5.2, 8), M.beamDark, -0.6, 3.9, 0, shipG, { cast: false });
  add(box(1.6, 1.1, 1.4), M.wood, -2.2, 2.0, 0, shipG);
  const crate = FX.crate(0.9); crate.position.set(1.8, 1.95, 0.9); shipG.add(crate);
  const bar = FX.barrel(0.32, 0.9); bar.position.set(2.6, 1.95, -0.9); shipG.add(bar);
  // kit bag beside Conroy's mark — Stubby's nose (a card) peeks from it
  add(box(0.62, 0.5, 0.4), M.canvasDark, 0.68, 1.72, 1.75, shipG, { cast: false });
}
const waterU2 = { t: { value: 0 } };
const water = FX.makeWater({ deep: '#274b63', shallow: '#3f7291', sky: '#bcd2ea', amp: 0.14, seg: 48, size: 56 });
water.position.set(40, 0.35, -30); world.add(water); ndSkip(water);
flat(add(new THREE.PlaneGeometry(60, 60), toon({ color: '#1d3a4f' }), 40, -1.1, -30, world, { cast: false }));

// --- trench: sandbag walls, duckboards, periscopes ---
const bagGeo = new THREE.SphereGeometry(0.34, 8, 6);
const bagRow = (z, x0, x1, rows) => {
  for (let r = 0; r < rows; r++) for (let x = x0; x <= x1; x += 0.62) {
    const b = add(bagGeo, M.sandbag, x + (r % 2) * 0.3, 0.16 + r * 0.27, z + ((x * 7 + r * 3) % 3 - 1) * 0.05, world, { cast: false });
    b.scale.set(1.25, 0.55, 0.8);
  }
};
bagRow(26.9, -13, 13, 4); bagRow(33.1, -13, 13, 4); bagRow(33.1, -13, 13, 1);
for (let x = -12; x <= 12; x += 1.15) add(box(1.05, 0.07, 1.7), M.wood, x, 0.05, 30, world, { cast: false }); // duckboards
for (const px of [-5.5, 4.2, 11]) { // trench periscopes / posts
  add(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6), M.beamDark, px, 1.6, 27.2, world, { cast: false });
  add(box(0.3, 0.16, 0.1), MW.darkMetal, px, 2.42, 27.2, world, { cast: false });
}
// battlefield dressing: craters + broken posts (no debris of people, just earth)
{ const r = P.rng(43);
  for (let i = 0; i < 10; i++) { const cx = -14 + r() * 28, cz = 38 + r() * 10; const c = flat(add(new THREE.CircleGeometry(0.9 + r() * 1.1, 14), texM(P.dirt(11), 2, 2, '#6a5940'), cx, 0.02, cz, world, { cast: false })); }
  for (let i = 0; i < 6; i++) { const px = -13 + r() * 26, pz = 39 + r() * 8; const post = add(new THREE.CylinderGeometry(0.05, 0.07, 1.6 + r(), 6), M.beamDark, px, 0.8, pz, world, { cast: false }); post.rotation.z = (r() - 0.5) * 0.5; }
}

// --- hospital tent interior at (-40,0,20): big open-front tent + cot + table ---
{ const g = new THREE.Group(); g.position.set(-40, 0, 20); world.add(g);
  for (const sd of [-1, 1]) { const rf = add(box(2.9, 0.09, 5.6), M.canvasTent, sd * 1.3, 2.62, 0, g); rf.rotation.z = -sd * 0.68; }
  add(box(4.8, 2.2, 0.08), M.canvasDark, 0, 1.1, -2.75, g, { cast: false });
  for (const sd of [-1, 1]) add(box(0.08, 2.2, 5.6), M.canvasDark, sd * 2.38, 1.1, 0, g, { cast: false });
  const gableShape = new THREE.Shape(); gableShape.moveTo(-2.38, 2.2); gableShape.lineTo(2.38, 2.2); gableShape.lineTo(0, 3.42); gableShape.closePath();
  for (const gz of [-2.72, 2.72]) { const gb = new THREE.Mesh(new THREE.ExtrudeGeometry(gableShape, { depth: 0.07, bevelEnabled: false }), M.canvasDark); gb.position.z = gz; gb.userData.ndSkip = true; g.add(gb); }
  add(box(1.9, 0.12, 0.85), M.wood, -0.1, 0.52, -0.9, g); // cot top
  for (const [lx, lz] of [[-0.95, -1.25], [0.75, -1.25], [-0.95, -0.55], [0.75, -0.55]]) add(box(0.07, 0.52, 0.07), M.beamDark, lx, 0.26, lz, g, { cast: false });
  add(box(1.7, 0.1, 0.7), MW.white, -0.1, 0.62, -0.9, g, { cast: false }); // cot sheet
  add(box(0.5, 0.09, 0.34), MW.white, -0.85, 0.7, -0.9, g, { cast: false }); // pillow
  add(box(0.9, 0.75, 0.5), M.wood, 1.7, 0.38, 0.6, g, { cast: false }); // side table
}

// --- lanterns (glass + glow + pool), index order matches story lanternSet ---
const lanterns = [];
const lanternAt = (x, y, z) => {
  const g = new THREE.Group(); g.position.set(x, y, z); world.add(g);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, y, 6), MW.darkMetal); pole.position.y = -y / 2; pole.userData.ndSkip = true; g.add(pole);
  add(box(0.16, 0.03, 0.16), MW.darkMetal, 0, -0.2, 0, g, { cast: false });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.24, 0.13), FX.glassMat(0xffc37a, 0.25));
  glass.userData.ndSkip = true; g.add(glass);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffb45e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(0.85); glow.userData.ndSkip = true; g.add(glow);
  const pool = flat(add(new THREE.CircleGeometry(1.25, 18), MW.lampGlow, 0, -y + 0.015, 0, g, { cast: false }));
  pool.material = MW.lampGlow.clone(); pool.material.opacity = 0; pool.userData.ndSkip = true; pool.receiveShadow = false;
  lanterns.push({ glow, pool, glass });
  return g;
};
lanternAt(-2.5, 2.0, -2);        // 0 camp
lanternAt(-6, 1.9, 27.4);       // 1 trench A
lanternAt(7.5, 1.9, 32.7);      // 2 trench B
lanternAt(-3.4, 1.7, 41.2);     // 3 battlefield (medic)
lanternAt(-38.6, 1.8, 21.5);    // 4 hospital
lanternAt(8.6, 1.9, 27.4);      // 5 spy corner
// stars
const starGeo = new THREE.BufferGeometry();
{ const r = P.rng(7), pos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) { const th = r() * Math.PI * 2, y = 0.1 + r() * 0.9, rr = Math.sqrt(1 - y * y) * 430;
    pos[i * 3] = Math.cos(th) * rr; pos[i * 3 + 1] = y * 430; pos[i * 3 + 2] = Math.sin(th) * rr; }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); }
const starMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat); stars.userData.ndSkip = true; scene.add(stars);

// ---------- FX (Coded FX Library) — every sprite system is ndSkip ----------
const smoke = new FX.Smoke(scene, 120); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const smokeEmits = [smoke.addEmitter(3.8, 0.75, 2.5, { rate: 2.2, color: 0xb8b0a2, opacity: 0.16, scale: 0.4, grow: 1.15, life: 2.6, vy: 1.0, wind: 0.4 })];
const fire = new FX.Fire(scene, { x: 3.8, y: 0.14, z: 2.5, scale: 0.75, rate: 12, light: true, max: 28 });
fire.pool.forEach((p) => { p.s.userData.ndSkip = true; });
if (fire.light) { fire.light.userData.ndSkip = true; fire.light.distance = 7; }
const fxClouds = new FX.Clouds(scene, { count: 5, y: 58, opacity: 0.2, color: 0xaab4c0, drift: 0.4 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const mist = FX.mistBand(scene, { count: 9, y: 0.7, opacity: 0.3 });
mist.children.forEach((s, i) => {
  s.position.set(-11 + i * 2.8, 0.55 + (i % 3) * 0.18, 29 + (i % 2) * 2.4);
  s.scale.set(9 + (i % 3) * 3, 2.2, 1);
  s.userData.bx = s.position.x; s.userData.ndSkip = true;
});
// green gas mist: tinted puff sprites creeping low along the trench
const gasMist = new THREE.Group(); scene.add(gasMist);
const gasSprites = [];
for (let i = 0; i < 10; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0x9db36a, transparent: true, opacity: 0, depthWrite: false }));
  sp.position.set(-6 + i * 1.7, 0.42, 29.2 + (i % 3) * 0.8);
  sp.scale.set(4.5 + (i % 3), 1.5, 1); sp.userData.ndSkip = true; sp.userData.bx = sp.position.x;
  gasMist.add(sp); gasSprites.push(sp);
}
// ship wake
const wake = new FX.Wake(scene, 64); wake.pool.forEach((p) => { p.m.userData.ndSkip = true; p.m.position.y = 0.48; });
// distant shell: bright dot on a far arc + tiny far flash sprite (tasteful, no impact on people)
const shellDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffe9b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
shellDot.scale.setScalar(0.55); shellDot.userData.ndSkip = true; scene.add(shellDot);
const farFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
farFlash.position.set(14, 7.5, 52); farFlash.scale.setScalar(3.2); farFlash.userData.ndSkip = true; scene.add(farFlash);

// ---------- FX simulation (stateful library systems, stepped deterministically) ----------
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fire.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); fire.acc = 0;
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    fire.on = pr.fireRate > 0; fire.rate = pr.fireRate; fire.scale = pr.fireScale;
    smokeEmits.forEach((e) => { e.rate = pr.smokeRate; });
    smoke.update(t, dt); fire.update(t, dt);
    if (fire.light) fire.light.intensity *= 0.14 * (0.35 + 0.7 * pr.fireScale);
    fxClouds.update(t, dt);
    if (Ws.wakeK) wake.trail(36.2, -30.5 - ((fxF * 0.11) % 3), dt, 1.1);
    wake.update(t, dt);
  }
};

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor() {
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

// ---------- render targets & post (balto ink + DOF pipeline) ----------
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
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}
function worldState(Ws, f) {
  fxStepTo(f);
  const t = f / 30;
  skyU.time.value = t;
  mist.children.forEach((s, i) => {
    s.position.x = s.userData.bx + Math.sin(f * 0.008 + i * 1.7) * 0.9;
    s.material.opacity = 0.42 * Ws.mist * (0.75 + 0.25 * Math.sin(f * 0.013 + i * 2.1));
  });
  gasSprites.forEach((s, i) => { // green gas creeps in from the east, hugging the ground
    s.position.x = s.userData.bx + Ws.gasK * 2.2 + Math.sin(f * 0.01 + i * 1.9) * 0.5;
    s.material.opacity = Ws.gasK * (0.30 + 0.12 * Math.sin(f * 0.02 + i * 2.4));
  });
  const on = new Set(Ws.lanternSet || []);
  lanterns.forEach((L, i) => {
    const k = on.has(i) ? 1 : 0;
    L.glow.material.opacity = k * (0.38 + 0.05 * Math.sin(f * 0.9 + i * 2.3));
    L.pool.material.opacity = k * 0.3;
    L.glass.material.opacity = k ? 0.55 : 0.22;
  });
  starMat.opacity = 0.9 * (Ws.starK || 0);
  boardMeshes.promo.mat.opacity = Ws.boardPromo || 0;
  boardMeshes.final.mat.opacity = Ws.boardFinal || 0;
  flags.forEach((fl) => FX.clothWave(fl, t));
  if (water.userData.update) water.userData.update(t);
  // distant shell arc: a 55-frame cycle, high and far — flash at launch, dot fades before the far ridge
  if (Ws.shellK) {
    const cyc = (f % 55) / 54, sx = 14 - cyc * 10, sz = 52 - cyc * 13, sy = 7.5 + Math.sin(cyc * Math.PI) * 3.4;
    shellDot.position.set(sx, sy, sz);
    shellDot.material.opacity = cyc < 0.82 ? 0.85 : 0;
    farFlash.material.opacity = (f % 55) < 5 ? 0.55 * (1 - (f % 55) / 5) : 0;
  } else { shellDot.material.opacity = 0; farFlash.material.opacity = 0; }
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
