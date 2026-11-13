import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, ENGINE_R } from './story.js';

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
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};

// ---------- the set: airliner (ext) + cabin cutaway stage + landing field ----------
const MAT = {
  fuse: toon({ color: '#eef1f4' }), belly: toon({ color: '#2e5aa8' }), wing: toon({ color: '#d7dde3' }),
  engine: toon({ color: '#8b98a5' }), darkMetal: toon({ color: '#3c4652' }),
  glass: new THREE.MeshBasicMaterial({ color: 0x2c4258, transparent: true, opacity: 0.42, depthWrite: false, fog: true }),
  seatA: texM(P.plaster(41, 210), 1, 1, '#7a2e4a'), seatB: texM(P.plaster(42, 200), 1, 1, '#274b73'),
  cabinWall: texM(P.plaster(43, 30), 2, 2, '#e8e2d2'), cabinFloor: texM(P.stone(44, 220, 4, 30), 6, 3, '#6a7078'),
  grass: texM(P.grass(45), 14, 14, '#7fae4c'), fieldDirt: texM(P.dirt(46), 8, 8, '#a8895c'),
  leaf: toon({ color: '#4a6a34' }), trunk: texM(P.beam(47, [40, 30, 22]), 1, 2),
};
const world = new THREE.Group(); scene.add(world);
// ================= PLANE (origin, centre y=6, nose +x) =================
const planeG = new THREE.Group(); planeG.position.set(0, 6, 0); world.add(planeG);
{
  const fus = add(new THREE.CapsuleGeometry(1.05, 7.4, 6, 14), MAT.fuse, 0, 0, 0, planeG);
  fus.rotation.z = Math.PI / 2;
  const belly = add(tbox(6.4, 0.3, 1.5, 2), MAT.belly, -0.2, -0.82, 0, planeG, { cast: false }); belly.rotation.z = 0.0;
  // window stripe, both sides: small dark rounded planes
  for (const sz of [-1, 1]) for (let i = 0; i < 9; i++) {
    const wx = -3.1 + i * 0.78;
    if (Math.abs(wx - 3.4) < 0.5 || Math.abs(wx + 3.4) < 0.5) continue;
    const win = add(new THREE.PlaneGeometry(0.34, 0.3), MW.winDark, wx, 0.28, sz * 1.045, planeG, { cast: false });
    if (sz < 0) win.rotation.y = Math.PI;
    win.userData.ndSkip = true;
  }
  // cockpit glass canopy (front top) + pilot silhouette head inside
  const glass = add(new THREE.SphereGeometry(1.03, 20, 12), MAT.glass, 3.55, 0.18, 0, planeG, { cast: false });
  glass.scale.set(1.08, 0.9, 1.08); glass.userData.ndSkip = true; // canopy hump proud of the hull
  const head = add(new THREE.SphereGeometry(0.24, 12, 10), MAT.darkMetal, 4.02, 0.3, 0, planeG, { cast: false });
  // pilot silhouette CARD on the glass (the finale's whole point: he is still in there)
  {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g2 = c.getContext('2d');
    g2.fillStyle = '#141c28'; g2.beginPath(); g2.arc(128, 100, 62, 0, 7); g2.fill();            // head
    g2.beginPath(); g2.ellipse(128, 244, 98, 66, 0, 0, 7); g2.fill();                        // shoulders
    g2.fillStyle = '#eef2f6'; g2.fillRect(62, 52, 132, 17);                                   // cap band
    g2.fillRect(88, 36, 80, 18);                                                              // cap top
    g2.fillStyle = '#f2b01e'; g2.fillRect(62, 65, 132, 6);                                    // cap gold trim
    const tex = new THREE.CanvasTexture(c);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: true }));
    card.position.set(3.9, 0.42, 1.1); card.userData.ndSkip = true; planeG.add(card);
  }
  add(tbox(0.5, 0.3, 0.55, 2), MAT.darkMetal, 3.92, 0.02, 0, planeG, { cast: false }); // pilot shoulders behind the glass
  // wings + engines
  const wing = add(tbox(2.6, 0.14, 11.4, 2), MAT.wing, 0.7, -0.55, 0, planeG); wing.rotation.y = 0.06;
  for (const sz of [-1, 1]) {
    const eng = add(new THREE.CylinderGeometry(0.44, 0.48, 1.6, 12), MAT.engine, 1.6, -1.25, sz * 3.1, planeG);
    eng.rotation.z = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), MAT.darkMetal, 2.42, -1.25, sz * 3.1, planeG, { cast: false }).rotation.z = Math.PI / 2;
    const tip = add(tbox(1.1, 0.1, 0.5, 2), MAT.belly, 0.4, -0.48, sz * 5.85, planeG, { cast: false }); tip.rotation.y = 0.06;
  }
  // tail: vertical fin + stabilizers, airline-blue with white tip
  const fin = add(tbox(1.7, 1.9, 0.14, 2), MAT.belly, -4.35, 1.25, 0, planeG); fin.rotation.z = 0.35;
  add(tbox(0.8, 0.5, 0.16, 2), MAT.fuse, -4.72, 2.2, 0, planeG, { cast: false }).rotation.z = 0.35;
  const stab = add(tbox(1.2, 0.1, 4.4, 2), MAT.wing, -4.5, 0.35, 0, planeG, { cast: false });
  // cheatline stripe
  const stripe = add(tbox(8.6, 0.16, 2.14, 2), MAT.belly, -0.1, 0.02, 0, planeG, { cast: false });
  stripe.scale.set(1, 1, 0.99);
}
// jump door (front right) — pivots open with worldAt doorK
const doorG = new THREE.Group(); doorG.position.set(3.4, 5.62, 1.02); world.add(doorG);
{
  const hole = add(new THREE.PlaneGeometry(0.78, 1.5), new THREE.MeshBasicMaterial({ color: 0x14100c, fog: true }), 0, 0, -0.03, doorG, { cast: false });
  hole.userData.ndSkip = true;
  const panelG = new THREE.Group(); panelG.position.set(-0.39, 0, 0.05); doorG.add(panelG);
  add(tbox(0.78, 1.5, 0.06, 2), MAT.fuse, 0.39, 0, 0, panelG, { cast: false });
  const win = add(new THREE.PlaneGeometry(0.3, 0.28), MW.winDark, 0.39, 0.42, 0.04, panelG, { cast: false }); win.userData.ndSkip = true;
  doorG.userData.panel = panelG; // hinged at the panel's left edge
}
// cloud deck the plane flies over (soft cartoon masses, low)
{
  const cm = toon({ color: '#f4f7fa' });
  const R = P.rng(918);
  const puff = (x, y, z, s) => { const m = add(new THREE.SphereGeometry(s, 10, 8), cm, x, y, z, world, { cast: false }); m.scale.y = 0.38; m.userData.ndSkip = true; return m; };
  for (let i = 0; i < 16; i++) puff(-12 + R() * 24, 1.3 + R() * 0.7, -7 + R() * 13, 0.9 + R() * 1.3);
  for (let i = 0; i < 16; i++) puff(20 + R() * 20, 1.3 + R() * 0.7, -7 + R() * 13, 0.9 + R() * 1.3);
}
// ================= CABIN cutaway (centre x=30, floor top y=6, back wall z=-2.7) =================
{
  const g = new THREE.Group(); world.add(g);
  add(tbox(11.4, 0.25, 5.6, 3), MAT.cabinFloor, 30, 5.87, 0, g, { cast: false });            // floor, top y=6.0
  add(tbox(11.4, 3.6, 0.25, 2), MAT.cabinWall, 30, 7.8, -2.82, g, { cast: false });          // back wall
  add(tbox(11.4, 0.22, 5.6, 2), MAT.cabinWall, 30, 9.65, 0, g, { cast: false });             // ceiling
  add(tbox(0.25, 3.6, 5.6, 2), MAT.cabinWall, 24.35, 7.8, 0, g, { cast: false });            // front bulkhead
  add(tbox(0.25, 3.6, 5.6, 2), MAT.cabinWall, 35.65, 7.8, 0, g, { cast: false });            // rear bulkhead
  // window ovals on the back wall
  for (let i = 0; i < 6; i++) {
    const win = add(new THREE.CircleGeometry(0.3, 14), MW.winDark, 26.2 + i * 1.55, 8.15, -2.68, g, { cast: false });
    win.userData.ndSkip = true;
  }
  // seat rows: 5 rows x (2 left + 2 right), aisle centre
  const seat = (x, z, mat) => {
    add(tbox(0.62, 0.5, 0.58, 2), mat, x, 6.25, z, g, { cast: false });
    const back = add(tbox(0.58, 0.95, 0.16, 2), mat, x, 6.85, z - 0.24, g, { cast: false }); back.rotation.x = 0.1;
    add(tbox(0.5, 0.07, 0.5, 2), MAT.darkMetal, x, 6.02, z, g, { cast: false });
  };
  for (const rx of [26.6, 28.2, 29.8, 31.4, 33.0]) for (const rz of [-1.55, -0.85, 0.85, 1.55]) seat(rx, rz, (rx + rz * 10) % 2 ? MAT.seatA : MAT.seatB);
  // one seat dragged into the aisle (the boy stands on it, s6)
  add(tbox(0.62, 0.5, 0.58, 2), MAT.seatB, 31.3, 6.25, 0.15, g, { cast: false });
  add(tbox(0.58, 0.95, 0.16, 2), MAT.seatB, 31.3, 6.85, -0.12, g, { cast: false });
  // overhead bins hint
  add(tbox(10.6, 0.4, 0.7, 2), MAT.cabinWall, 30, 9.15, -2.2, g, { cast: false });
  add(tbox(10.6, 0.4, 0.7, 2), MAT.cabinWall, 30, 9.15, 2.2, g, { cast: false });
}
// ================= FIELD (centre (6,-34,8)) =================
{
  const g = new THREE.Group(); world.add(g);
  const disc = flat(add(new THREE.CircleGeometry(46, 36), MAT.grass, 6, -34.05, 8, g, { cast: false }));
  const patch = flat(add(new THREE.CircleGeometry(4.5, 20), MAT.fieldDirt, 6.0, -34.0, 9.5, g, { cast: false }));
  for (const [x, z, s] of [[-14, -2, 1.2], [22, 0, 1.5], [-8, 20, 1.1], [26, 18, 1.3], [14, 24, 0.9], [-20, 12, 1.4]]) {
    add(new THREE.CylinderGeometry(0.09 * s, 0.13 * s, 1.1 * s, 6), MAT.trunk, x, -34 + 0.55 * s, z, g, { cast: false });
    add(new THREE.ConeGeometry(0.85 * s, 2.0 * s, 8), MAT.leaf, x, -34 + (1.1 + 1.0) * s, z, g, { cast: false });
    add(new THREE.ConeGeometry(0.6 * s, 1.4 * s, 8), MAT.leaf, x, -34 + (1.1 + 1.75) * s, z, g, { cast: false });
  }
  // distant hill ring
  for (const [x, z, s] of [[-30, -18, 16], [38, -22, 20], [6, -34, 15]]) {
    const h = add(new THREE.ConeGeometry(s, s * 0.32, 20), MAT.leaf, x, -34 + s * 0.16, z, g, { cast: false });
    h.material = toon({ color: '#6f9a44' });
  }
}
// ---- boards (transforms mirrored in boardverify.mjs — keep in sync) ----
// B1 route: back wall of cabin, centre (27.3,8.62,-2.66), face 2.9x0.95, key boardRoute
const routeG = new THREE.Group(); routeG.position.set(29.3, 8.5, -2.66); world.add(routeG);
const boardRoute = textBoard(['DELHI → MUMBAI'], 2.9, 0.95, '#274b73', '#ffe9a8'); boardRoute.position.set(0, 0, 0.03); routeG.add(boardRoute);
// B2 chute: easel against cabin back wall, centre (32.7,7.62,-2.42) ry -0.1, face 2.7x1.35, key boardChute
const chuteG = new THREE.Group(); chuteG.position.set(32.7, 6, -2.42); chuteG.rotation.y = -0.1; world.add(chuteG);
for (const px of [-1.42, 1.42]) add(new THREE.CylinderGeometry(0.05, 0.065, 2.9, 7), M.beamDark, px, 1.45, -0.08, chuteG, { cast: false });
add(tbox(3.1, 0.09, 0.08, 2), M.beam, 0, 2.86, -0.08, chuteG, { cast: false });
const boardChute = textBoard(['200 PEOPLE', 'ONLY 100 PARACHUTES'], 2.7, 1.35, '#7a1f1f', '#ffe9a8'); boardChute.position.set(0, 1.95, 0.05); chuteG.add(boardChute);
// B3 safe: easel on the field, centre (2.2,-34,3.6) ry 0.5, face 2.5x1.2 at local y 1.62, key boardSafe
const safeG = new THREE.Group(); safeG.position.set(6.0, -34, 2.0); safeG.rotation.y = 0.12; world.add(safeG);
for (const px of [-1.32, 1.32]) add(new THREE.CylinderGeometry(0.05, 0.065, 2.4, 7), M.beamDark, px, 1.2, -0.08, safeG, { cast: false });
add(tbox(2.9, 0.09, 0.08, 2), M.beam, 0, 2.44, -0.08, safeG, { cast: false });
const boardSafe = textBoard(['ALL 200', 'LANDED SAFE'], 2.5, 1.2, '#2e5a2e', '#ffe9a8'); boardSafe.position.set(0, 1.62, 0.05); safeG.add(boardSafe);
// engine-fire glint (flicker driven by worldAt fireK)
const fireGlint = FX.glint(0.35); fireGlint.position.set(2.5, 4.8, 3.35); fireGlint.userData.ndSkip = true; world.add(fireGlint);
const boardGlint = FX.glint(0.5); boardGlint.position.set(33.9, 9.0, -2.1); boardGlint.userData.ndSkip = true; world.add(boardGlint);

// ---------- FX: fire + smoke trail at the engine, cloud layers ----------
const smoke = new FX.Smoke(scene, 150); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const fireEmit = smoke.addEmitter(0.8, 4.78, 3.1, { rate: 0, color: 0xe86a1e, opacity: 0.8, scale: 0.3, grow: 1.2, life: 0.55, vy: 0.35, wind: -2.6 });
const fireEmit2 = smoke.addEmitter(1.1, 4.85, 3.1, { rate: 0, color: 0xf2b01e, opacity: 0.65, scale: 0.2, grow: 1.15, life: 0.42, vy: 0.5, wind: -2.2 });
const trailEmit = smoke.addEmitter(0.6, 4.9, 3.1, { rate: 0, color: 0x5a5a5e, opacity: 0.26, scale: 0.55, grow: 1.7, life: 2.4, vy: 0.3, wind: -2.6 });
const hazeEmit = smoke.addEmitter(-6, 5.4, 0, { rate: 0.5, color: 0xffffff, opacity: 0.05, scale: 1.6, grow: 1.2, life: 2.2, vy: 0, wind: -3.2 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const fxCloudsLow = new FX.Clouds(scene, { count: 5, y: -14, opacity: 0.16, color: 0xeef2f8, drift: 0.8 });
fxCloudsLow.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
  fxCloudsLow.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    fireEmit.rate = pr.fireRate; fireEmit2.rate = pr.fireRate * 0.8; trailEmit.rate = pr.trailRate; hazeEmit.rate = pr.smokeRate;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
    fxCloudsLow.update(t, dt);
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
  setB(boardRoute, Ws.boardRoute || 0); setB(boardChute, Ws.boardChute || 0); setB(boardSafe, Ws.boardSafe || 0);
  boardGlint.material.opacity = (Ws.boardChute || 0) * (0.5 + 0.3 * Math.sin(f * 0.33));
  fireGlint.material.opacity = (Ws.fireK || 0) * (0.3 + 0.22 * Math.sin(f * 1.7) * Math.sin(f * 0.53));
  planeG.position.y = 6 + 0.07 * Math.sin(f * 0.045);
  const dk = Ws.doorK || 0;
  doorG.userData.panel.rotation.y = dk * 1.85;
  doorG.userData.panel.position.z = 0.05 + dk * 0.3;
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
