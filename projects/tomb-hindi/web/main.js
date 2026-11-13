import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, coffinAt } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
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
  concrete: texM(P.stone(31, 40, 5, 58), 1, 1, '#cfcbc2'),
  concreteDk: texM(P.stone(32, 40, 6, 46), 1, 1, '#b8b2a4'),
  plasterA: texM(P.plaster(33, 36), 2, 2),
  plasterB: texM(P.plaster(34, 18), 2, 2),
  dirt: texM(P.dirt(35), 12, 12, '#b49a72'),
  street: texM(P.stone(36, 40, 4, 40, 256, 256), 8, 3, '#a9a499'),
  beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
};
const MW = {
  dark: toon({ color: '#3c3a38' }), rebar: toon({ color: '#5a4632' }),
  winDark: new THREE.MeshBasicMaterial({ color: 0x232830, fog: true }),
  gold: toon({ color: '#c9a227' }), leaf: toon({ color: '#4a6a34' }),
  shade: new THREE.MeshBasicMaterial({ color: 0x2e2a20, transparent: true, opacity: 0.2, depthWrite: false }),
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
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };
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

// ---------- text-board helper (canvas texture plane; boards are in-world props) ----------
const textBoard = (lines, w, h, bg, fg, font = 900) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 14; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  g.font = `${font} ${fs}px 'Noto Sans Devanagari', Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};


// ---------- the set: the tomb valley (one continuous set) ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'), moundGrass: texM(P.grass(63), 4, 4, '#74a047'),
  dirtPath: texM(P.dirt(62), 6, 6, '#a8895c'),
  stone: texM(P.stone(64, 40, 5, 58), 2, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 2, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  roof: texM(P.plaster(68, 60), 2, 1, '#7a4a3a'),
  gold: toon({ color: '#d9a441' }), goldDk: toon({ color: '#a8762a' }),
  leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  water: toon({ color: '#3a6a8c', transparent: true, opacity: 0.82 }),
  clay: toon({ color: '#a8763e' }), sand: toon({ color: '#d9c08a' }), lime: toon({ color: '#e8e4da' }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffb45e, transparent: true, opacity: 0, fog: true }),
  dark: new THREE.MeshBasicMaterial({ color: 0x14100c, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
// ================= VALLEY =================
{
  const g = world;
  const grnd = flat(add(new THREE.CircleGeometry(70, 36), MAT.grass, 0, 0, 0, g, { cast: false }));
  grnd.receiveShadow = true;
  const path = flat(add(new THREE.PlaneGeometry(3.2, 38), MAT.dirtPath, 0, 0.02, -1, g, { cast: false })); path.receiveShadow = true;
  const yard = flat(add(new THREE.CircleGeometry(3.4, 18), MAT.dirtPath, -10.5, 0.02, -3, g, { cast: false }));
  const stupaYard = flat(add(new THREE.CircleGeometry(4.6, 18), MAT.dirtPath, 1.5, 0.02, 12, g, { cast: false }));
  // hills ring
  const hillM = texM(P.grass(69), 6, 6, '#6f9a48');
  for (const [hx, hz, s] of [[-38, -30, 16], [30, -38, 19], [48, 8, 15], [-48, 14, 17], [8, -52, 21], [-20, 44, 15], [36, 34, 14]]) {
    add(new THREE.ConeGeometry(s, s * 0.32, 18), hillM, hx, s * 0.16 - 0.4, hz, g, { cast: false });
  }
  // trees
  const R = P.rng(417);
  for (const [tx, tz] of [[-16, 8], [-14, -10], [12, -6], [15, 12], [-9, 16], [10, 20], [-18, -2], [18, -14], [-4, -20], [7, -22]]) {
    add(new THREE.CylinderGeometry(0.14, 0.2, 1.5, 7), MAT.woodDk, tx, 0.75, tz, g, { cast: false });
    const c1 = add(new THREE.SphereGeometry(1.15 + R() * 0.4, 10, 8), R() > 0.5 ? MAT.leaf : MAT.leaf2, tx, 2.1, tz, g, { cast: false });
    add(new THREE.SphereGeometry(0.8, 9, 7), MAT.leaf, tx + 0.7, 1.7, tz + 0.3, g, { cast: false });
  }
  // river (east) — rises with floodK
  add(tbox(1.2, 0.5, 70, 2), MAT.dirtPath, 14.6, 0.25, 0, g, { cast: false });
  add(tbox(1.2, 0.5, 70, 2), MAT.dirtPath, 20.4, 0.25, 0, g, { cast: false });
}
const river = flat(add(new THREE.PlaneGeometry(4.6, 70), MAT.water, 17.5, 0.05, 0, world, { cast: false }));
river.userData.ndSkip = true;
// ================= MOUND + COFFIN + OFFERINGS =================
{
  const dome = add(new THREE.SphereGeometry(2.6, 16, 12), MAT.moundGrass, -7, 0, 3, world, { cast: false });
  dome.scale.y = 0.55;
  add(tbox(2.8, 0.35, 1.8, 2), MAT.stone, -7, 0.17, 6.6, world, { cast: false }); // coffin slab
}
const coffinG = new THREE.Group(); coffinG.position.set(-7, 0.35, 6.6); world.add(coffinG);
{
  add(tbox(2.2, 0.5, 1.05, 2), MAT.wood, 0, 0.25, 0, coffinG);
  add(tbox(2.3, 0.22, 1.12, 2), MAT.woodDk, 0, 0.61, 0, coffinG);
  add(tbox(2.34, 0.07, 1.16, 1), MAT.gold, 0, 0.47, 0, coffinG, { cast: false }); // gold band
  add(new THREE.SphereGeometry(0.14, 8, 8), MAT.gold, 1.16, 0.35, 0, coffinG, { cast: false });
  add(new THREE.SphereGeometry(0.14, 8, 8), MAT.gold, -1.16, 0.35, 0, coffinG, { cast: false });
}
const itemGroups = [];
{
  const mk = (fn, x, z) => { const gr = new THREE.Group(); gr.position.set(x, 0.35, z); gr.scale.setScalar(0.001); world.add(gr); fn(gr); itemGroups.push(gr); };
  mk((gr) => { // vase
    add(new THREE.CylinderGeometry(0.16, 0.22, 0.55, 10), MAT.clay, 0, 0.28, 0, gr, { cast: false });
    add(new THREE.SphereGeometry(0.13, 8, 8), MAT.gold, 0, 0.62, 0, gr, { cast: false });
  }, -8.6, 6.7);
  mk((gr) => { // sword on a stand
    add(tbox(0.5, 0.12, 0.3, 1), MAT.woodDk, 0, 0.06, 0, gr, { cast: false });
    const sw = add(tbox(0.95, 0.045, 0.09, 1), MAT.stoneDk, 0, 0.3, 0, gr, { cast: false }); sw.rotation.z = 0.5;
    add(tbox(0.2, 0.05, 0.16, 1), MAT.gold, -0.34, 0.13, 0, gr, { cast: false });
  }, -5.4, 6.7);
  mk((gr) => { // cup
    add(new THREE.CylinderGeometry(0.14, 0.1, 0.3, 10), MAT.gold, 0, 0.15, 0, gr, { cast: false });
  }, -8.5, 5.6);
  mk((gr) => { // small chest
    add(tbox(0.55, 0.34, 0.38, 1), MAT.wood, 0, 0.17, 0, gr, { cast: false });
    add(tbox(0.58, 0.06, 0.41, 1), MAT.goldDk, 0, 0.3, 0, gr, { cast: false });
  }, -5.5, 5.6);
}
// ================= MORTAR YARD =================
{
  const g = world;
  add(tbox(2.8, 0.18, 1.8, 2), MAT.stone, -10.5, 0.09, -3, g, { cast: false });
  const bowl = (x, z, m) => { add(new THREE.CylinderGeometry(0.44, 0.3, 0.32, 12), MAT.stoneDk, x, 0.34, z, g, { cast: false }); add(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 12), m, x, 0.5, z, g, { cast: false }); };
  bowl(-11.3, -3.3, MAT.clay); bowl(-10.5, -2.6, MAT.sand); bowl(-9.7, -3.3, MAT.lime);
  const stick = add(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), MAT.woodDk, -11.3, 0.8, -3.3, g, { cast: false }); stick.rotation.z = 0.5;
  add(tbox(1.5, 0.24, 1.05, 2), MAT.stone, -10.4, 0.12, -5.2, g, { cast: false }); // hardened slab
  add(new THREE.SphereGeometry(0.09, 8, 8), MAT.gold, -10.4, 0.3, -5.2, g, { cast: false });
}
// ================= STUPA (7 tiers, built by tierK) =================
const stupaTiers = [];
let spireG;
{
  const g = world;
  add(tbox(7.2, 0.5, 7.2, 3), MAT.stone, 1.5, 0.25, 12, g, { cast: false });
  for (let i = 0; i < 7; i++) {
    const s = 5.6 - i * 0.55;
    const tier = new THREE.Group(); tier.position.set(1.5, 0.5 + i * 0.62, 12); tier.scale.y = 0.001; g.add(tier);
    const geo = new THREE.BoxGeometry(s, 0.62, s); geo.translate(0, 0.31, 0);
    add(geo, i % 2 ? MAT.stoneDk : MAT.stone, 0, 0, 0, tier);
    const trim = new THREE.BoxGeometry(s + 0.07, 0.07, s + 0.07); trim.translate(0, 0.585, 0);
    add(trim, MAT.goldDk, 0, 0, 0, tier, { cast: false });
    stupaTiers.push(tier);
  }
  spireG = new THREE.Group(); spireG.position.set(1.5, 0.5 + 7 * 0.62, 12); spireG.scale.y = 0.001; g.add(spireG);
  const cone = new THREE.ConeGeometry(0.52, 1.25, 10); cone.translate(0, 0.62, 0);
  add(cone, MAT.roof, 0, 0, 0, spireG, { cast: false });
  const ball = new THREE.SphereGeometry(0.17, 8, 8); ball.translate(0, 1.36, 0);
  add(ball, MAT.gold, 0, 0, 0, spireG, { cast: false });
}
// decoy chest at the stupa base
{
  add(tbox(0.95, 0.55, 0.65, 2), MAT.wood, 4.8, 0.28, 15.6, world);
  add(tbox(0.99, 0.14, 0.69, 1), MAT.goldDk, 4.8, 0.6, 15.6, world, { cast: false });
  add(tbox(0.2, 0.2, 0.05, 1), MAT.gold, 4.8, 0.34, 15.95, world, { cast: false });
}
// ================= WORSHIP HALL + SECRET PASSAGE =================
let slabMesh, glowMesh;
{
  const g = world;
  add(tbox(8.4, 0.6, 5.2, 3), MAT.stone, 0, 0.3, -13, g, { cast: false });            // platform
  add(tbox(8.4, 2.9, 0.3, 2), MAT.stoneDk, 0, 2.05, -15.4, g, { cast: false });       // back wall
  for (const cx of [-3.4, -1.15, 1.15, 3.4]) add(new THREE.CylinderGeometry(0.17, 0.19, 2.7, 10), MAT.stone, cx, 1.95, -11.3, g, { cast: false });
  add(tbox(9.2, 0.28, 6.0, 2), MAT.roof, 0, 3.45, -13.2, g, { cast: false });         // roof slab
  // passage doorway in front of the platform
  add(tbox(0.28, 1.7, 0.28, 2), MAT.stoneDk, -0.85, 0.85, -10.2, g, { cast: false });
  add(tbox(0.28, 1.7, 0.28, 2), MAT.stoneDk, 0.85, 0.85, -10.2, g, { cast: false });
  add(tbox(2.0, 0.3, 0.3, 2), MAT.stoneDk, 0, 1.85, -10.2, g, { cast: false });
  glowMesh = add(new THREE.PlaneGeometry(1.42, 1.55), MAT.glow, 0, 0.78, -10.32, g, { cast: false }); glowMesh.userData.ndSkip = true;
  add(new THREE.PlaneGeometry(1.42, 1.55), MAT.dark, 0, 0.78, -10.42, g, { cast: false }).userData.ndSkip = true;
  slabMesh = add(tbox(1.5, 1.62, 0.16, 2), MAT.stone, 0, 0.81, -10.1, g);
}
// ================= DECOY MOUNDS =================
for (const [mx, mz, r] of [[8, -4, 1.8], [-4.5, -8.5, 1.5], [9, 5.5, 2.0]]) {
  const d = add(new THREE.SphereGeometry(r, 14, 10), MAT.moundGrass, mx, 0, mz, world, { cast: false }); d.scale.y = 0.5;
}
// ================= WALL RING + GATES (rises with wallK) =================
const wallG = new THREE.Group(); world.add(wallG);
{
  const seg = (w, h, d, x, y, z) => { const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, h / 2, 0); return add(geo, MAT.stoneDk, x, y, z, wallG, { cast: false }); };
  seg(11.9, 2.2, 0.5, -7.55, 0, 17); seg(11.9, 2.2, 0.5, 7.55, 0, 17);       // south wall (gate gap)
  seg(11.9, 2.2, 0.5, -7.55, 0, -19); seg(11.9, 2.2, 0.5, 7.55, 0, -19);    // north wall
  seg(0.5, 2.2, 35.5, 13.5, 0, -1); seg(0.5, 2.2, 35.5, -13.5, 0, -1);     // east + west
  for (const gz of [17, -19]) for (const gx of [-1.6, 1.6]) seg(0.55, 2.9, 0.55, gx, 0, gz);
  const lin = new THREE.BoxGeometry(3.8, 0.4, 0.6); lin.translate(0, 0.2, 0);
  add(lin, MAT.woodDk, 0, 2.9, 17, wallG, { cast: false });
  add(lin.clone(), MAT.woodDk, 0, 2.9, -19, wallG, { cast: false });
  // guard spears at the south gate
  for (const sx of [-1.9, 1.9]) {
    const sp = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6); sp.translate(0, 1.15, 0);
    add(sp, MAT.woodDk, sx, 0, 16.4, wallG, { cast: false });
    const tip = new THREE.ConeGeometry(0.07, 0.3, 6); tip.translate(0, 2.45, 0);
    add(tip, MAT.stoneDk, sx, 0, 16.4, wallG, { cast: false });
  }
  wallG.scale.y = 0.001;
}
// ================= MINI PLANE (the hook, s13) =================
const planeMini = new THREE.Group(); planeMini.position.set(-34, 24, -26); planeMini.visible = false; world.add(planeMini);
{
  const fus = add(new THREE.CapsuleGeometry(0.5, 3.2, 4, 10), toon({ color: '#eef1f4' }), 0, 0, 0, planeMini, { cast: false });
  fus.rotation.z = Math.PI / 2;
  add(tbox(1.2, 0.08, 5.2, 1), toon({ color: '#d7dde3' }), 0.2, -0.25, 0, planeMini, { cast: false });
  add(tbox(0.8, 0.9, 0.08, 1), toon({ color: '#2e5aa8' }), -1.9, 0.55, 0, planeMini, { cast: false });
}
// ---- boards (transforms mirrored in boardverify.mjs — keep in sync) ----
// B1 stupa sign: post sign at (5.6,0,8.6) ry -0.55, face 2.4x0.8 centre local y 1.5, key boardStupa
const stupaSignG = new THREE.Group(); stupaSignG.position.set(5.6, 0, 8.6); stupaSignG.rotation.y = -0.55; world.add(stupaSignG);
add(new THREE.CylinderGeometry(0.05, 0.065, 1.9, 7), M.beamDark, 0, 0.95, -0.06, stupaSignG, { cast: false });
const boardStupa = textBoard(['7 मंज़िला स्तूप'], 2.4, 0.8, '#274b73', '#ffe9a8'); boardStupa.position.set(0, 1.5, 0.03); stupaSignG.add(boardStupa);
// B2 city board: hangs on the south-gate lintel (in wallG), centre (0,2.35,17) face 3.2x0.9, key boardCity
const boardCity = textBoard(['कब्र नगर'], 3.2, 0.9, '#7a1f1f', '#ffe9a8'); boardCity.position.set(0, 2.35, 0.36); wallG.add(boardCity);
// B3 xia stele: stone at (-3.6,0,14.2) ry 0.35, face 2.4x1.15 centre local (0,1.45,0.23), key boardXia
const steleG = new THREE.Group(); steleG.position.set(-1.5, 0, 10.5); steleG.rotation.y = 0.3; world.add(steleG);
add(tbox(2.6, 2.2, 0.4, 2), MAT.stoneDk, 0, 1.1, 0, steleG, { cast: false });
const boardXia = textBoard(['पश्चिमी शिया', 'राजाओं की कब्रें'], 2.4, 1.15, '#4a3421', '#ffe9a8'); boardXia.position.set(0, 1.45, 0.23); steleG.add(boardXia);
// glints: decoy chest + mini-plane engine
const chestGlint = FX.glint(0.3); chestGlint.position.set(4.8, 0.72, 15.75); chestGlint.userData.ndSkip = true; world.add(chestGlint);
const planeGlint = FX.glint(0.8); planeGlint.position.set(0.9, -0.3, 0.6); planeGlint.userData.ndSkip = true; planeMini.add(planeGlint);

// ---------- FX: digging dirt, mortar dust, rain, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const dirtEmit = smoke.addEmitter(3.8, 0.3, 16.6, { rate: 0, color: 0x9a7a52, opacity: 0.5, scale: 0.5, grow: 1.6, life: 0.9, vy: 1.4, wind: 0.4 });
const yardEmit = smoke.addEmitter(-10.4, 0.4, -2.9, { rate: 0, color: 0xd8d0bc, opacity: 0.3, scale: 0.45, grow: 1.5, life: 1.4, vy: 0.7, wind: 0.3 });
const hazeEmit = smoke.addEmitter(0, 2.5, 0, { rate: 0.4, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.6 });
const rain = new FX.Rain(scene, { count: 650, area: 55, height: 30, cx: -4, cz: 4, opacity: 0 });
rain.points.userData.ndSkip = true; rain.points.visible = false;
const fxClouds = new FX.Clouds(scene, { count: 7, y: 46, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    dirtEmit.rate = pr.digRate; yardEmit.rate = pr.dirtRate; hazeEmit.rate = pr.smokeRate;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
    rain.update(t);
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

// ---------- render targets & post (ink/dof contract) ----------
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
  skyU.time.value = f / 30;
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardStupa, Ws.boardStupa || 0); setB(boardCity, Ws.boardCity || 0); setB(boardXia, Ws.boardXia || 0);
  stupaTiers.forEach((g, i) => { const sy = clamp01((Ws.tierK || 0) * 8 - i); g.scale.y = Math.max(0.001, sy); g.visible = sy > 0.01; });
  { const sy = clamp01((Ws.tierK || 0) * 8 - 7); spireG.scale.y = Math.max(0.001, sy); spireG.visible = sy > 0.01; }
  slabMesh.position.x = -1.7 * (Ws.slabK || 0);
  MAT.glow.opacity = (Ws.glowK || 0) * (0.72 + 0.18 * Math.sin(f * 0.7));
  const cp = coffinAt(f);
  let cy = cp[1];
  if (f > 1210) cy -= Math.min(0.85, (f - 1210) / 25 * 0.85);
  coffinG.position.set(cp[0], cy, cp[2]);
  river.position.y = 0.05 + 0.45 * (Ws.floodK || 0);
  rain.points.visible = (Ws.rainK || 0) > 0.01;
  rain.uniforms.uOpacity.value = 1.0 * (Ws.rainK || 0);
  itemGroups.forEach((g, i) => { g.scale.setScalar(Math.max(0.001, clamp01((Ws.itemK || 0) * 5 - i))); });
  wallG.scale.y = Math.max(0.001, Ws.wallK || 0); wallG.visible = (Ws.wallK || 0) > 0.01;
  planeMini.visible = (Ws.planeK || 0) > 0;
  planeMini.position.x = -26 + 44 * (Ws.planeK || 0);
  planeGlint.material.opacity = (Ws.planeK || 0) > 0 && (Ws.planeK || 0) < 1 ? 0.5 + 0.4 * Math.sin(f * 1.9) : 0;
  chestGlint.material.opacity = Math.max(0, (Ws.chestK || 0)) * 0.45;
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
