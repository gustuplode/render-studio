import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt } from './story.js';

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
  sand: texM(P.dirt(7), 240, 240), sandDark: toon({ color: '#8a6f4a' }), rock: texM(P.stone(4), 2, 2),
  hill: toon({ color: '#a8845c' }), hillFar: toon({ color: '#b08a5e' }), mount: toon({ color: '#8a6a4e' }), snow: toon({ color: '#f4f2ec' }),
  metal: texM(P.panelMetal(41), 2, 1), metalDark: toon({ color: '#4a4d52' }), darkMetal: toon({ color: '#33373d' }),
  white: toon({ color: '#eef0f2' }), grey: toon({ color: '#9aa0a6' }), red: toon({ color: '#c03a30' }), orange: toon({ color: '#e07a2c' }),
  blue: toon({ color: '#3a6ac0' }), teal: toon({ color: '#2c7a8c' }), glass: toon({ color: '#bfe8f4' }),
  pole: toon({ color: '#6a6e72' }), pad: toon({ color: '#7d7a72' }), cushion: toon({ color: '#c8b06a' }),
  smoke: toon({ color: '#b9b4aa' }), trail: new THREE.MeshBasicMaterial({ color: '#efe9dc', transparent: true, opacity: 0.5, fog: true, depthWrite: false }),
  flameOut: new THREE.MeshBasicMaterial({ color: '#ff9a3c', fog: false }), flameIn: new THREE.MeshBasicMaterial({ color: '#fff3c0', fog: false }),
  glow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,205,110', 0.95)), transparent: true, fog: false, depthWrite: false }),
  heat: new THREE.MeshBasicMaterial({ color: '#ffb36a', transparent: true, opacity: 0.55, fog: false, depthWrite: false }),
  beam: new THREE.MeshBasicMaterial({ color: '#ff5a4a', transparent: true, opacity: 0.85, fog: false, depthWrite: false }),
  sea: (() => { const m = new THREE.MeshToonMaterial({ gradientMap: grad, color: '#4a90b8' }); m.userData.water = true; return m; })(),
  sub: toon({ color: '#3a4148' }), carrier: toon({ color: '#565e66' }),
};

// ---------- ink / normal-depth contract ----------
const NOINK = 'noink'; // userData flag: never outlined (cards, fx, water handled specially)
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
const waterNd = new THREE.ShaderMaterial({
  vertexShader: `varying float vD; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vD; void main(){ gl_FragColor=vec4(.5,1.,.5,vD); }`,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const uvScale = (geo, su, sv) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
/** box with world-scaled UVs per face (texel density 1 tile per `t` metres) */
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
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
// All sets sit on y=0 in separate zones: meadow x~0, cottage x~-30, fence x~+30, lab x~60, macro x~90, capsule x~120.
const DECK = 6; // legacy constant: only the card-blob default in drawActors reads it; every actor sets ground:0
const world = new THREE.Group(); scene.add(world);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// water uniforms survive (applyLight writes them) even though the river set is gone
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const MW = {
  weaveFloor: texM(P.weave(21, [205, 16, 68]), 10, 10),
  stripA: texM(P.weave(22, [8, 48, 50]), 1, 3),
  stripB: texM(P.weave(23, [40, 28, 80]), 1, 3),
  calendar: texM(P.calendar1941(), 1, 1),
  stars: new THREE.MeshBasicMaterial({ map: P.tex(P.stars()), fog: false }),
  panel: texM(P.panelMetal(41), 3, 1),
  panelFloor: texM(P.panelMetal(43, 230), 2, 2),
  roomWall: (() => { const m = texM(P.plaster(31, 32), 2, 1); m.side = THREE.BackSide; m.color.set('#9a8a76'); return m; })(),
  macroWall: (() => { const m = toon({ color: '#2a3627' }); m.side = THREE.BackSide; return m; })(),
  hook: toon({ color: '#8a6a34' }), burr: toon({ color: '#77572a' }), loop: toon({ color: '#c8d4dc' }),
  brass: toon({ color: '#b08a4a' }), darkMetal: toon({ color: '#3c4148' }), stripWall: toon({ color: '#d8dee6' }),
  lampGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,217,160', 0.9)), transparent: true, fog: false, depthWrite: false }),
  shaft: new THREE.MeshBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0.06, fog: false, depthWrite: false, side: THREE.DoubleSide }),
  sign: texM(P.signNoPets(), 1, 1),
  paybook: texM(P.paybook(), 1, 1),
  emblem: texM(P.emblemBear(), 1, 1),
  canvasTop: toon({ color: '#7a7a52' }), truckBody: toon({ color: '#5d6e46' }), tire: toon({ color: '#2e2c28' }),
  khakiTent: toon({ color: '#8a8558' }), smoke: toon({ color: '#8f8d84' }),
};
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };

// ---------- launch-range world (one desert, zones along +x) ----------
// plaza/hook x=0 · US range x~40 · Trident sea x~133 · China range x~210 · carrier sea x~272 · Patriot x~330
const ground = flat(add(new THREE.PlaneGeometry(2600, 2600), M.sand, 165, -0.02, 0, world, { cast: false }));
const seaAt = (x, z, r) => {
  const m = flat(add(new THREE.CircleGeometry(r, 26), M.sea, x, 0, z, world, { cast: false }));
  m.material = M.sea; m.userData.nd = waterNd; return m;
};
seaAt(133, 2, 26); seaAt(272, -25, 30);
const hillAt = (x, z, r, h, mat = M.hill) => { const g = add(new THREE.SphereGeometry(r, 14, 9), mat, x, -r * 0.45, z, world, { cast: false }); g.scale.y = h / r; return g; };
hillAt(-40, -60, 30, 13); hillAt(20, -70, 36, 16, M.hillFar); hillAt(90, -64, 30, 12); hillAt(150, -70, 34, 14, M.hillFar);
hillAt(210, -66, 32, 13); hillAt(285, -80, 36, 15, M.hillFar); hillAt(345, -60, 30, 11); hillAt(60, -46, 16, 6); hillAt(70, -40, 12, 4.5);
const duneAt = (x, z, R, H, mat = M.hillFar) => { const d = add(new THREE.SphereGeometry(R, 18, 10), mat, x, 0, z, world, { cast: false }); d.scale.y = H / R; return d; };
duneAt(-95, -125, 60, 20); duneAt(305, -128, 70, 24); duneAt(60, -100, 42, 12, M.hill); duneAt(190, -105, 48, 14);

const padAt = (x, z, w = 7, d = 7) => flat(add(new THREE.PlaneGeometry(w, d), M.pad, x, 0.015, z, world, { cast: false }));
// canvas label boards
const boardTexCache = {};
const boardTex = (text, bg, fg) => {
  const key = text + bg; if (boardTexCache[key]) return boardTexCache[key];
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 160); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, 496, 144);
  g.fillStyle = fg; g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 84); const t = P.tex(c); boardTexCache[key] = t; return t;
};
const boardAt = (text, x, y, z, w = 3.4, bg = '#20242c', fg = '#ffd76a', ry = 0) => {
  const m = add(new THREE.PlaneGeometry(w, w * 0.3125), new THREE.MeshBasicMaterial({ map: boardTex(text, bg, fg), fog: true }), x, y, z, world, { cast: false });
  m.rotation.y = ry; m.userData.ndSkip = true; return m;
};
const postAt = (x, z, h = 1.1) => add(new THREE.CylinderGeometry(0.05, 0.06, h, 6), M.pole, x, h / 2, z, world, { cast: false });
// ---------- missile factory (three.js primitives; +Y = nose) ----------
const flameGeo = new THREE.CylinderGeometry(0.02, 0.30, 1.6, 10, 1, true); flameGeo.translate(0, -0.8, 0);
const flameInGeo = new THREE.CylinderGeometry(0.01, 0.15, 1.0, 8, 1, true); flameInGeo.translate(0, -0.5, 0);
const mkMissile = (o = {}) => {
  const g = new THREE.Group();
  const r = o.r || 0.32, len = o.len || 3.4, col = o.col || M.white;
  const body = add(new THREE.CylinderGeometry(r, r, len, 14), col, 0, 0, 0, g);
  add(new THREE.ConeGeometry(r, len * 0.34, 14), o.nose || col, 0, len / 2 + len * 0.17, 0, g);
  if (o.band) { const b = add(new THREE.CylinderGeometry(r * 1.03, r * 1.03, len * 0.12, 14), o.band, 0, len * 0.18, 0, g, { cast: false }); }
  if (o.wings) for (const s of [-1, 1]) { const w = add(box(len * 0.34, 0.05, r * 1.5), o.fin || M.grey, s * len * 0.1, -len * 0.05, 0, g, { cast: false }); w.rotation.z = s * 0.1; }
  const fins = o.fins ?? 4;
  for (let i = 0; i < fins; i++) { const a = i / fins * Math.PI * 2 + (o.finRot || 0); const fn = add(box(0.05, len * 0.22, r * 1.15), o.fin || M.grey, Math.cos(a) * r * 0.95, -len * 0.42, Math.sin(a) * r * 0.95, g, { cast: false }); fn.rotation.y = -a; }
  const fo = add(flameGeo, M.flameOut, 0, -len / 2, 0, g, { cast: false }); fo.userData.ndSkip = true;
  const fi = add(flameInGeo, M.flameIn, 0, -len / 2, 0, g, { cast: false }); fi.userData.ndSkip = true;
  const gl = add(new THREE.PlaneGeometry(2.6, 2.6), M.glow, 0, -len / 2 - 0.7, 0, g, { cast: false }); gl.userData.ndSkip = true;
  const tr = add(box(0.16, 1, 0.16), M.trail, 0, -len / 2 - 0.5, 0, g, { cast: false }); tr.geometry = tr.geometry.clone(); tr.geometry.translate(0, -0.5, 0); tr.userData.ndSkip = true;
  g.userData.parts = { fo, fi, gl, tr };
  return g;
};
const mkWedge = () => { // DF-17 glider: squashed body + wedge nose + delta wing plate + twin tails
  const g = new THREE.Group();
  const bodyM = toon({ color: '#788089' });
  const body = add(new THREE.CylinderGeometry(0.34, 0.40, 3.1, 12), bodyM, 0, -0.3, 0, g); body.scale.set(1, 1, 0.5);
  const nose = add(new THREE.ConeGeometry(0.34, 1.5, 12), bodyM, 0, 2.0, 0, g); nose.scale.set(1, 1, 0.5);
  const wing = add(box(2.7, 1.15, 0.07), M.darkMetal, 0, -1.5, 0, g, { cast: false }); // delta plate: span X, chord Y, thin Z
  for (const sd of [-1, 1]) { const t = add(box(0.06, 0.7, 0.5), M.darkMetal, sd * 0.42, -1.7, 0, g, { cast: false }); t.rotation.z = sd * 0.25; }
  const fo = add(flameGeo, M.flameOut, 0, -1.85, 0, g, { cast: false }); fo.userData.ndSkip = true; fo.scale.set(0.7, 0.8, 0.7);
  const fi = add(flameInGeo, M.flameIn, 0, -1.85, 0, g, { cast: false }); fi.userData.ndSkip = true;
  const gl = add(new THREE.PlaneGeometry(2.4, 2.4), M.glow, 0, -2.45, 0, g, { cast: false }); gl.userData.ndSkip = true;
  const tr = add(box(0.2, 1, 0.2), M.heat, 0, -2.35, 0, g, { cast: false }); tr.geometry = tr.geometry.clone(); tr.geometry.translate(0, -0.5, 0); tr.userData.ndSkip = true;
  g.userData.parts = { fo, fi, gl, tr };
  return g;
};
// standing hero/display missile on a pad, with name board
const heroAt = (x, z, kind, name, bg, fg, bs = 1) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  padAt(x, z, 5.5, 5.5);
  add(box(2.6, 0.5, 2.6), M.metalDark, 0, 0.25, 0, g);
  const spec = { tomahawk: { r: 0.3, len: 3.2, col: M.white, wings: 1 }, minuteman: { r: 0.42, len: 5.6, col: M.white, band: M.red }, trident: { r: 0.46, len: 5.2, col: M.grey, band: M.blue }, df21: { r: 0.4, len: 5.0, col: M.teal, band: M.red }, df41: { r: 0.55, len: 6.8, col: M.white, band: M.red } }[kind];
  let m;
  if (kind === 'df17') { m = mkWedge(); m.position.y = 3.4; m.scale.setScalar(1.15); }
  else { m = mkMissile(spec); m.position.y = (spec.len / 2) + 0.5; }
  m.userData.parts.fo.visible = m.userData.parts.fi.visible = m.userData.parts.gl.visible = m.userData.parts.tr.visible = false;
  g.add(m);
  postAt(x + 1.9 * bs, z + 2.2); boardAt(name, x + 1.9 * bs, Math.round(z) === 0 ? 2.3 : 1.55, z + 2.2, 3.2, bg, fg);
  return g;
};
// hook / verdict plaza rows (x=0)
heroAt(-9, -5.2, 'tomahawk', 'TOMAHAWK', '#1c3050', '#cfe4ff'); heroAt(-9, 0, 'minuteman', 'MINUTEMAN', '#1c3050', '#cfe4ff'); heroAt(-9, 5.2, 'trident', 'TRIDENT', '#1c3050', '#cfe4ff');
heroAt(9, -5.2, 'df21', 'DF-21', '#501c1c', '#ffd0c8', -1); heroAt(9, 0, 'df17', 'DF-17', '#501c1c', '#ffd0c8', -1); heroAt(9, 5.2, 'df41', 'DF-41', '#501c1c', '#ffd0c8', -1);
postAt(-9, -8.6, 7.4); postAt(9, -8.6, 7.4);
boardAt('USA', -9, 8.6, -8.6, 4.2, '#1c3050', '#ffffff'); boardAt('CHINA', 9, 8.6, -8.6, 4.2, '#501c1c', '#ffffff');
// US range display row (the same three, at the US intro)
heroAt(41, -9, 'tomahawk', 'TOMAHAWK', '#1c3050', '#cfe4ff'); heroAt(41, 0, 'minuteman', 'MINUTEMAN', '#1c3050', '#cfe4ff'); heroAt(41, 9, 'trident', 'TRIDENT', '#1c3050', '#cfe4ff');
// China range display row
heroAt(211, -9, 'df21', 'DF-21', '#501c1c', '#ffd0c8'); heroAt(211, 0, 'df17', 'DF-17', '#501c1c', '#ffd0c8'); heroAt(211, 9, 'df41', 'DF-41', '#501c1c', '#ffd0c8');
// flags on poles (canvas textures, sway in worldState)
const flagTex = (draw) => { const c = document.createElement('canvas'); c.width = 256; c.height = 160; draw(c.getContext('2d')); return P.tex(c); };
const usFlagTex = flagTex((g) => { for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b03a48'; g.fillRect(0, i * 23, 256, 23); } g.fillStyle = '#2c3a6e'; g.fillRect(0, 0, 108, 92); g.fillStyle = '#fff'; for (let r = 0; r < 4; r++) for (let s = 0; s < 5; s++) { g.beginPath(); g.arc(12 + s * 22, 12 + r * 22, 4, 0, 7); g.fill(); } });
const cnFlagTex = flagTex((g) => { g.fillStyle = '#d0342c'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#f7d038'; const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }; star(42, 42, 26); star(84, 22, 9); star(96, 46, 9); star(84, 70, 9); star(64, 84, 9); });
const flags = [];
const flagAt = (x, z, tex) => {
  add(new THREE.CylinderGeometry(0.07, 0.09, 9, 8), M.pole, x, 4.5, z, world);
  const f = add(new THREE.PlaneGeometry(3.0, 1.9, 8, 1), new THREE.MeshToonMaterial({ gradientMap: grad, map: tex, side: THREE.DoubleSide }), x + 1.55, 8.0, z, world, { cast: false });
  f.userData.base = f.geometry.attributes.position.array.slice(); flags.push(f); return f;
};
flagAt(-11.5, -7, usFlagTex); flagAt(11.5, -7, cnFlagTex);
// launch consoles (desk + radar screen)
const consoleAt = (x, z) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(box(1.9, 0.9, 0.7), M.metalDark, 0, 0.45, 0, g);
  const scr = add(new THREE.PlaneGeometry(1.5, 0.85), new THREE.MeshBasicMaterial({ map: boardTex('◉ TRACK', '#0d2b1a', '#5aff8a'), fog: true }), 0, 1.25, -0.1, g, { cast: false });
  scr.rotation.x = -0.25; scr.userData.ndSkip = true;
  return g;
};
consoleAt(-3.2, 6.2); consoleAt(3.2, 6.2); consoleAt(34, 6.5); consoleAt(198.5, 6.5); consoleAt(325, 7);
// launch gear: Tomahawk canister, Minuteman silo, DF-21 TEL, DF-17 pad, DF-41 silo
{ const g = new THREE.Group(); g.position.set(36, 0, -4); world.add(g); padAt(36, -4, 6, 6);
  const c = add(box(1.1, 1.1, 4.2), M.metal, 0, 0.95, 0, g); c.rotation.x = -0.5; }
{ padAt(47, 13, 7, 7); const s = add(new THREE.CylinderGeometry(1.5, 1.7, 0.5, 14), M.metalDark, 47, 0.25, 13, world); add(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 14), M.darkMetal, 47, 0.55, 13, world, { cast: false }); }
{ const g = new THREE.Group(); g.position.set(204, 0, -6); world.add(g); padAt(204, -6, 7, 8);
  add(box(1.6, 1.0, 5.4), M.teal, 0, 0.9, 0, g); for (const wx of [-0.85, 0.85]) for (const wz of [-1.9, 0, 1.9]) { const w = add(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 10), M.darkMetal, wx, 0.42, wz, g, { cast: false }); w.rotation.z = Math.PI / 2; } }
{ padAt(204, 14, 6, 6); add(box(2.4, 0.4, 2.4), M.metalDark, 204, 0.2, 14, world); }
{ padAt(214, 4, 8, 8); add(new THREE.CylinderGeometry(1.9, 2.1, 0.5, 16), M.metalDark, 214, 0.25, 4, world); add(new THREE.CylinderGeometry(1.4, 1.4, 0.2, 16), M.darkMetal, 214, 0.55, 4, world, { cast: false }); }
// submarine + carrier silhouettes
const subG = new THREE.Group(); subG.position.set(128, -1.1, 8); world.add(subG);
{ const hull = add(new THREE.CylinderGeometry(1.5, 1.5, 15, 12), M.sub, 0, 0, 0, subG); hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, 0.8);
  add(box(1.1, 1.3, 2.6), M.sub, 0.5, 1.5, 0, subG); add(new THREE.ConeGeometry(1.5, 3, 12), M.sub, 8.8, 0, 0, subG).rotation.z = -Math.PI / 2; }
const carrierG = new THREE.Group(); carrierG.position.set(272, 0, -27); world.add(carrierG);
{ add(box(26, 2.2, 5.5), M.carrier, 0, 0.6, 0, carrierG); add(box(27.5, 0.35, 6.6), M.darkMetal, 0, 1.85, 0, carrierG);
  add(box(3.2, 3.4, 2.2), M.carrier, 6, 3.6, -1.6, carrierG); add(box(3.6, 0.5, 2.6), M.darkMetal, 6, 5.5, -1.6, carrierG, { cast: false }); }
// MACH tower + boards
{ add(box(1.2, 30, 1.2), M.metalDark, 124, 15, -30, world); add(box(5, 1.4, 0.3), M.metalDark, 124, 29.5, -30, world, { cast: false }); }
const machBoardA = boardAt('SPEED TEST', 124, 27.2, -29.8, 5.4, '#20242c', '#ffd76a');
const machBoardB = boardAt('MACH 10!', 124, 27.2, -29.8, 5.4, '#20242c', '#ff9a3c'); machBoardB.visible = false;
// Patriot battery: platform, 4 angled tubes, rotating radar, laser turret, drone cushion
const patG = new THREE.Group(); patG.position.set(330, 0, 2); world.add(patG); padAt(330, 2, 9, 9);
add(box(3.4, 0.8, 3.4), M.metalDark, 0, 0.4, 0, patG);
for (const [tx, tz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { const t = add(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 10), M.metal, tx, 1.7, tz, patG); t.rotation.x = -0.6; }
const radarG = new THREE.Group(); radarG.position.set(337, 0, -5); world.add(radarG); padAt(337, -5, 6, 6);
add(box(2.2, 1.1, 2.2), M.metalDark, 0, 0.55, 0, radarG);
const radarDish = add(box(2.6, 1.8, 0.15), M.metal, 0, 2.2, 0, radarG); radarDish.rotation.x = -0.5;
const laserG = new THREE.Group(); laserG.position.set(334, 0, 10); world.add(laserG); padAt(334, 10, 5, 5);
add(new THREE.CylinderGeometry(0.9, 1.1, 1.6, 10), M.metalDark, 0, 0.8, 0, laserG);
const laserHead = add(new THREE.SphereGeometry(0.55, 10, 8), M.metal, 0, 2.3, 0, laserG);
flat(add(new THREE.CircleGeometry(1.6, 14), M.cushion, 350, 0.03, 16, world, { cast: false }));
// ---------- flight hardware (driven by worldAt) ----------
const FLIGHT_SPEC = {
  tomahawk: () => mkMissile({ r: 0.3, len: 3.2, col: M.white, wings: 1 }),
  minuteman: () => mkMissile({ r: 0.42, len: 5.6, col: M.white, band: M.red }),
  trident: () => mkMissile({ r: 0.46, len: 5.2, col: M.grey, band: M.blue }),
  df21: () => mkMissile({ r: 0.4, len: 5.0, col: M.teal, band: M.red }),
  df17: () => mkWedge(),
  df41: () => mkMissile({ r: 0.55, len: 6.8, col: M.white, band: M.red }),
  streakUS: () => mkMissile({ r: 0.3, len: 3.2, col: M.white, wings: 1 }),
  streakCN: () => mkWedge(),
  int1: () => mkMissile({ r: 0.2, len: 2.0, col: M.white, band: M.orange }),
  int2: () => mkMissile({ r: 0.2, len: 2.0, col: M.white, band: M.orange }),
  tgt1: () => mkMissile({ r: 0.3, len: 2.6, col: M.grey, nose: M.red, fins: 3 }),
  tgt2: () => mkMissile({ r: 0.3, len: 2.6, col: M.grey, nose: M.red, fins: 3 }),
};
const flightG = {};
for (const id of Object.keys(FLIGHT_SPEC)) { const g = FLIGHT_SPEC[id](); g.visible = false; world.add(g); flightG[id] = g; }
// smoke-trail puffs + launch-smoke pools (toon spheres, deterministic offsets)
const mkPuffs = (n, seed) => { const arr = []; const r = P.rng(seed); for (let i = 0; i < n; i++) { const m = add(new THREE.SphereGeometry(1, 9, 7), M.smoke, 0, 0, 0, world, { cast: false }); m.visible = false; m.userData.o = [(r() - 0.5) * 1.6, (r() - 0.5) * 0.8, (r() - 0.5) * 1.6]; arr.push(m); } return arr; };
const trailPuffs = {}; for (const id of ['minuteman', 'trident', 'df21', 'df41']) trailPuffs[id] = mkPuffs(8, id.length * 31 + 7);
const smokePools = [mkPuffs(10, 101), mkPuffs(10, 202), mkPuffs(10, 303)];
// laser beam (stretched between turret head and drone while on)
const beamMesh = add(new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true), M.beam, 0, 0, 0, world, { cast: false }); beamMesh.userData.ndSkip = true; beamMesh.visible = false;
// laser-test drone
const droneG = new THREE.Group(); droneG.visible = false; world.add(droneG);
add(box(1.7, 0.22, 0.5), M.grey, 0, 0, 0, droneG);
const droneWing = add(box(0.5, 0.06, 2.4), M.orange, 0, 0.1, 0, droneG, { cast: false });
add(new THREE.ConeGeometry(0.24, 0.7, 8), M.darkMetal, 1.15, 0, 0, droneG, { cast: false }).rotation.z = -Math.PI / 2;
// sea foam ring at the Trident breach
const foam = add(new THREE.TorusGeometry(1, 0.3, 8, 20), toon({ color: '#eaf6ff' }), 133, 0.1, 8, world, { cast: false }); foam.rotation.x = Math.PI / 2; foam.visible = false;
// Minuteman star billboards (appear high on the arc)
const starsG = new THREE.Group(); starsG.visible = false; world.add(starsG);
{ const sm = new THREE.MeshBasicMaterial({ map: P.tex(P.stars()), transparent: true, fog: false, depthWrite: false });
  const r = P.rng(77); for (let i = 0; i < 10; i++) { const s = add(new THREE.PlaneGeometry(3.2, 3.2), sm, 30 + r() * 55, 42 + r() * 40, -6 + r() * 26, starsG, { cast: false }); s.userData.ndSkip = true; } }

// clouds: painted billboards far away (no fog, no ink)
const clouds = [];
{ const r = P.rng(90);
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const pen = new T.Pen(c.getContext('2d')); pen.ol = 0;
    pen.g.translate(300, 200); pen.g.scale(1.4, 1.2); pen.g.translate(-300, -200); T.fxCloud(pen, i + 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.667), new THREE.MeshBasicMaterial({ map: P.tex(c), transparent: true, fog: false, depthWrite: false }));
    const a = r() * Math.PI * 2, d = 700 + r() * 250; m.position.set(Math.cos(a) * d, 130 + r() * 150, Math.sin(a) * d); m.scale.setScalar(110 + r() * 90);
    m.userData.ndSkip = true; m.renderOrder = -1; scene.add(m); clouds.push(m);
  } }

// ---------- helmet prop (3D) ----------
const helmet = new THREE.Group(); scene.add(helmet); helmet.visible = false;
{
  const inGeo = new THREE.SphereGeometry(0.98, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const uv = inGeo.attributes.uv, pos = inGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 - pos.getX(i) / 2.1, 0.5 - pos.getZ(i) / 2.1);
  add(inGeo, M.helmIn, 0, 0, 0, helmet);
  add(new THREE.SphereGeometry(1.0, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), M.helmOut, 0, 0, 0, helmet);
  const band = add(new THREE.TorusGeometry(1.0, 0.07, 8, 48), toon({ color: '#a88a4a' }), 0, 0.02, 0, helmet); band.rotation.x = Math.PI / 2;
  const crest = add(new THREE.CylinderGeometry(1.3, 1.3, 0.22, 32, 1, false, 0, Math.PI), toon({ color: '#8d4b3f' }), 0, 0.95, 0, helmet);
  crest.rotation.z = Math.PI / 2; crest.rotation.y = Math.PI / 2; crest.scale.set(1, 1, 0.6);
}

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25; // canvas px, card height in metres (design 600x1000 -> 2.25 m)
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

// ---------- render targets & post ----------
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
      if (card && ds > 0.) continue;            // character cards: never outlined by the world ink
      if (card) ds = 1e4;                        // sky
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));                           // depth jump, near side only
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9); // crease
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
    c = mix(c, flash < 0. ? vec3(0.) : vec3(1.), clamp(abs(flash), 0., 1.)); // flash>0: white flash; flash<0: dip to black
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
// final copy with sRGB handled by the renderer output (we render to screen with linear->sRGB in the shader chunk)
dofScene.children[0].material.toneMapped = false;

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
}
function placeSun(L, focus) {
  // sun direction from azimuth/elevation in world space
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}

function worldState(W, f) {
  for (const id of Object.keys(flightG)) {
    const g = flightG[id], st = W.missiles[id];
    g.visible = !!st; if (!st) continue;
    g.position.set(...st.p);
    tmpV.set(...st.d); g.quaternion.setFromUnitVectors(UP, tmpV);
    if (st.spin) g.rotateY(st.spin);
    const P = g.userData.parts, fl = st.flame * (0.9 + 0.18 * Math.sin(f * 1.7 + id.length));
    P.fo.visible = P.fi.visible = P.gl.visible = st.flame > 0.03;
    P.fo.scale.set(1, Math.max(0.05, fl), 1); P.fi.scale.set(1, Math.max(0.05, fl * 0.8), 1);
    g.getWorldQuaternion(tmpQ); P.gl.quaternion.copy(tmpQ.invert().multiply(camera.quaternion)); // billboard inside the rotated group
    const heat = id === 'df17' || id === 'streakCN';
    P.tr.visible = st.speed > 0.25; P.tr.scale.set(1, Math.min(14, st.speed * (heat ? 16 : 9)), 1);
    if (trailPuffs[id] && st.trail) trailPuffs[id].forEach((m, k) => { const tp = st.trail[k]; m.visible = !!tp; if (tp) { m.position.set(tp.p[0], Math.max(0.3, tp.p[1]), tp.p[2]); m.scale.setScalar(tp.s); m.material.opacity = tp.a; } });
  }
  W.smoke.forEach((e, i) => { const pool = smokePools[i % smokePools.length]; pool.forEach((m, k) => {
    m.visible = true; const o = m.userData.o, grow = 0.5 + e.t * 2.6;
    m.position.set(e.p[0] + o[0] * grow + e.t * 2.2, e.p[1] + 0.3 + e.t * 1.1 + o[1] * 0.4, e.p[2] + o[2] * grow);
    m.scale.setScalar(e.r * (0.35 + e.t * 0.9)); }); });
  smokePools.forEach((pool, pi) => { if (!W.smoke.some((e, i) => i % smokePools.length === pi)) pool.forEach((m) => { m.visible = false; }); });
  droneG.visible = !!W.drone;
  if (W.drone) { droneG.position.set(...W.drone.p); droneG.rotation.z = W.drone.tilt; droneWing.rotation.x = W.drone.tilt * 0.8; }
  beamMesh.visible = W.laser.on;
  if (W.laser.on) { const a = new THREE.Vector3(...W.laser.a), b = new THREE.Vector3(...W.laser.b), mid = a.clone().add(b).multiplyScalar(0.5);
    beamMesh.position.copy(mid); beamMesh.scale.set(1, a.distanceTo(b), 1);
    beamMesh.quaternion.setFromUnitVectors(UP, b.sub(a).normalize()); }
  radarDish.rotation.y = f * 0.02;
  laserHead.position.y = 2.3 + Math.sin(f * 0.05) * 0.05;
  foam.visible = !!W.foam;
  if (W.foam) { foam.scale.setScalar(0.5 + W.foam.t * 3.2); foam.material.opacity = 1 - W.foam.t; foam.material.transparent = true; }
  starsG.visible = !!W.stars; starsG.children.forEach((s) => s.quaternion.copy(camera.quaternion));
  machBoardA.visible = !W.mach; machBoardB.visible = !!W.mach;
  flags.forEach((fl, i) => { const pos = fl.geometry.attributes.position, base = fl.userData.base;
    for (let v = 0; v < pos.count; v++) { const bx = base[v * 3]; pos.setZ(v, Math.sin(f * 0.15 + bx * 1.6 + i * 2) * 0.09 * (bx + 1.5) / 3); }
    pos.needsUpdate = true; });
  waterU.t.value = f / 30;
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
    if (a.blob !== false && a.y < DECK + 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? DECK) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

const helmetState = (h) => {
  helmet.visible = !!h; if (!h) return;
  helmet.position.set(h.x, h.y, h.z); helmet.rotation.set(h.rx || 0, h.ry || 0, h.rz || 0); helmet.scale.setScalar(h.s || 0.17);
};

const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0; if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};

window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const W_ = worldAt(f); worldState(W_, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  helmetState(W_.helmet);
  sky.position.copy(camera.position);
  for (const c of clouds) c.quaternion.copy(camera.quaternion);
  // pass A: colour
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  // pass B: normal + depth
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  // ink + grade
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  // lens
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;


