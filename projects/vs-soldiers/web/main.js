import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, US_KIT, CN_KIT, BOARD_US, BOARD_CN, STACK_AT } from './story.js';

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
  plank: texM(P.planks(1), 1, 6), beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  rot: texM(P.rotten(4), 1, 1), rotB: texM(P.rotten(14), 1, 1),
  stone: texM(P.stone(4), 1, 1), stoneMoss: texM(P.mossy(P.stone(4), 5, 1.2), 1, 1),
  grass: texM(P.grass(6), 40, 40), dirt: texM(P.dirt(7), 6, 30), plaster: texM(P.plaster(8), 1, 1), plaster2: texM(P.plaster(18, 28), 1, 1),
  roof: texM(P.roof(9), 2, 2), marble: texM(P.marble(10), 1, 1), marbleTop: toon({ color: '#ece2cf' }),
  trunk: toon({ color: '#6a4a32' }), cypress: toon({ color: '#3f6b36' }), pine: toon({ color: '#5c8a3c' }), bush: toon({ color: '#6c9a42' }),
  hill: toon({ color: '#7aa64c' }), hillFar: toon({ color: '#86ad60' }), mount: toon({ color: '#8fa7b8' }), snow: toon({ color: '#f4f6fa' }),
  iron: toon({ color: '#5c5a57' }), bronze: toon({ color: '#b08a4a' }), wood: toon({ color: '#7a5434' }), door: toon({ color: '#5a3a24' }),
  window: toon({ color: '#2b2430' }), red: toon({ color: '#b8282b' }),
};
M.banner = new THREE.MeshToonMaterial({ gradientMap: grad, map: P.tex(P.banner()), alphaTest: 0.5, side: THREE.DoubleSide });
// helmet
const helmetIn = P.tex(P.helmetInside()); helmetIn.wrapS = helmetIn.wrapT = THREE.ClampToEdgeWrapping;
M.helmIn = new THREE.MeshToonMaterial({ gradientMap: grad, map: helmetIn, side: THREE.BackSide });
M.helmOut = toon({ color: '#8f8a7e' });

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

// ----- shared nature -----
const ground = flat(add(new THREE.CircleGeometry(130, 40), M.grass, 0, 0, 0, world, { cast: false }));
flat(add(new THREE.PlaneGeometry(30, 12), M.dirt, 0, 0.011, -0.5, world, { cast: false })); // the churned battlefield strip
const houseAt = (x, z, w, h, d, mat) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(tbox(w, h, d, 2), mat, 0, h / 2, 0, g);
  const rf = add(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.4, 1.6, 4), M.roof, 0, h + 0.8, 0, g); rf.rotation.y = Math.PI / 4; rf.scale.set(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
  add(box(0.9, 1.8, 0.1), M.door, 0, 0.9, d / 2 + 0.03, g, { cast: false });
  for (const s of [-1, 1]) add(box(0.6, 0.7, 0.1), M.window, s * w * 0.3, h * 0.62, d / 2 + 0.03, g, { cast: false });
  return g;
};
const pineAt = (x, z, h = 6) => { const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g); add(new THREE.CylinderGeometry(0.18, 0.28, h, 6), M.trunk, 0, h / 2, 0, g); const c = add(new THREE.SphereGeometry(1, 12, 8), M.pine, 0.25, h + 0.3, 0, g); c.scale.set(2.9, 1.05, 2.9); return g; };
const cypressAt = (x, z, h = 7) => { const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g); add(new THREE.CylinderGeometry(0.13, 0.18, 1, 6), M.trunk, 0, 0.5, 0, g); const c = add(new THREE.SphereGeometry(1, 10, 10), M.cypress, 0, 0.9 + h / 2, 0, g); c.scale.set(0.9, h / 2, 0.9); return g; };
const mountAt = (x, z, r_, h) => { const g = new THREE.Group(); g.position.set(x, -4, z); world.add(g); add(new THREE.ConeGeometry(r_, h, 7), M.mount, 0, h / 2, 0, g, { cast: false }); add(new THREE.ConeGeometry(r_ * 0.32, h * 0.3, 7), M.snow, 0, h * 0.86, 0, g, { cast: false }); };
// burdock plant: bush ball studded with brown burrs
const burdockAt = (x, z, s = 1) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  flat(add(new THREE.CircleGeometry(0.6, 14), toon({ color: '#557c36' }), 0, 0.015, 0, g, { cast: false }));
  add(new THREE.CylinderGeometry(0.045, 0.08, 0.5, 6), M.trunk, 0, 0.25, 0, g, { cast: false });
  const b = add(new THREE.SphereGeometry(0.55, 12, 9), M.bush, 0, 0.62, 0, g); b.scale.set(s, s * 0.85, s);
  const r = P.rng((x * 13 + z * 7) | 0);
  for (let i = 0; i < 9; i++) { const a = r() * 6.28, e = r() * 0.9; add(new THREE.SphereGeometry(0.045, 6, 5), MW.burr, Math.cos(a) * Math.cos(e) * 0.55 * s, 0.55 + Math.sin(e) * 0.42 * s, Math.sin(a) * Math.cos(e) * 0.55 * s, g, { cast: false }); }
  return g;
};
// ----- shared army props -----
const tentAt = (x, z, ry = 0) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  for (const s of [-1, 1]) { const sl = add(tbox(1.55, 0.07, 2.7, 2), MW.khakiTent, s * 0.62, 0.78, 0, g); sl.rotation.z = -s * 0.72; }
  add(tbox(0.08, 0.8, 2.7, 1), M.beamDark, 0, 0.4, -1.32, g);
  add(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6), M.beamDark, 0, 0.85, 1.3, g, { cast: false });
  flat(add(new THREE.CircleGeometry(1.9, 14), M.dirt, 0, 0.014, 0, g, { cast: false }));
  return g;
};
const truckAt = (x, z, ry = 0) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  add(tbox(2.2, 0.35, 4.6, 2), MW.truckBody, 0, 0.78, 0, g);                       // bed/chassis
  add(tbox(2.05, 1.05, 1.15, 2), MW.truckBody, 0, 1.45, 1.85, g);                   // cab
  add(box(1.7, 0.5, 0.06), M.window, 0, 1.62, 2.44, g, { cast: false });            // windshield
  const cv = add(tbox(2.3, 1.35, 2.9, 2), MW.canvasTop, 0, 1.85, -0.75, g);         // canvas back
  cv.geometry.translate(0, 0, 0);
  for (const [wx, wz] of [[-1.08, 1.7], [1.08, 1.7], [-1.08, -1.6], [1.08, -1.6]]) {
    const w = add(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 14), MW.tire, wx, 0.5, wz, g); w.rotation.z = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.24, 10), MW.darkMetal, wx, 0.5, wz, g, { cast: false }).rotation.z = Math.PI / 2;
  }
  return g;
};
const crateAt = (parent, x, y, z, ry = 0, shells = true) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  add(tbox(0.66, 0.44, 0.46, 1), M.plank, 0, 0.22, 0, g);
  if (shells) for (const sx of [-0.16, 0.16]) { const s = add(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 8), MW.brass, sx, 0.55, 0, g, { cast: false }); s.rotation.z = 0.12; }
  return g;
};
// ----- BATTLEFIELD VALLEY (vs-soldiers): one connected field, US west vs CN east -----
mountAt(-26, -78, 34, 52); mountAt(6, -88, 42, 64); mountAt(38, -76, 30, 46);
for (let i = 0; i < 7; i++) { const h = add(new THREE.SphereGeometry(16 + i * 3, 18, 10), i % 2 ? M.hill : M.hillFar, -60 + i * 24, -7, -34 - (i % 3) * 9, world, { cast: false }); h.scale.y = 0.5; }
pineAt(-24, -10, 7); pineAt(24, -12, 7.5); pineAt(-27, 4, 6); pineAt(27, 3, 6.5); cypressAt(-21, -6, 7); cypressAt(21, -7, 6);
// churned mud patches mid-field (the mud shot plays here)
for (const [mx, mz, ms] of [[-1.3, 1.2, 2.6], [1.25, 0.6, 2.2], [0, 0.9, 2.3], [-2.6, -0.6, 1.8], [2.6, 1.8, 1.8]]) {
  const mp = flat(add(new THREE.CircleGeometry(1, 18), toon({ color: '#6e5836' }), mx, 0.014, mz, world, { cast: false })); mp.scale.set(ms, ms * 0.7, 1);
}
tentAt(-7.3, -8.5, 0.25); tentAt(-5.9, -10.5, -0.15); tentAt(7.3, -8.5, -0.25); tentAt(5.9, -10.5, 0.15);
truckAt(-8.8, -6.5, 0.5); truckAt(8.8, -6.5, -0.5);
crateAt(world, -2.0, 0, -4.6, 0.2, false); crateAt(world, 2.1, 0, -4.4, -0.3, false);

// ----- rank-and-file armies: one painted texture per kit variant, ~55 planes a side -----
const rankTexture = (outfit, seed, step) => {
  const c = document.createElement('canvas'); c.width = 600; c.height = 1000;
  const pen = new T.Pen(c.getContext('2d'));
  T.romanFront(pen, outfit, { seed, expr: 'neutral', L: 'hang', R: 'hang', blink: 0, step });
  return P.tex(c);
};
const rankGeo = new THREE.PlaneGeometry(1.35, 2.25); rankGeo.translate(0, 1.1, 0);
const rankMats = {
  us: [0, 1, 2].map((i) => new THREE.MeshBasicMaterial({ map: rankTexture(US_KIT, 31 + i * 3, i * 0.33), transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true })),
  cn: [0, 1, 2].map((i) => new THREE.MeshBasicMaterial({ map: rankTexture(CN_KIT, 41 + i * 3, i * 0.33), transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true })),
};
const ranks = [];
const buildArmy = (side, mats) => {
  const g = new THREE.Group(); world.add(g);
  const sgn = side === 'us' ? -1 : 1;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 11; col++) {
    const mat = mats[(row + col) % 3];
    const m = new THREE.Mesh(rankGeo, mat);
    m.position.set(sgn * (4.8 + col * 0.55), 0, -4.6 + row * 1.55);
    m.castShadow = false; m.receiveShadow = false;
    m.userData.nd = cardNd(mat.map); m.userData.side = side; m.userData.ph = (row * 7 + col * 3) % 10;
    g.add(m); ranks.push(m);
  }
  return g;
};
const usRanks = buildArmy('us', rankMats.us), cnRanks = buildArmy('cn', rankMats.cn);

// ----- flags (canvas-painted, waving in worldState) -----
const flagTexture = (draw) => { const c = document.createElement('canvas'); c.width = 512; c.height = 320; draw(c.getContext('2d')); return P.tex(c); };
const usFlagTex = flagTexture((g) => {
  g.fillStyle = '#b22234'; g.fillRect(0, 0, 512, 320); g.fillStyle = '#ffffff';
  for (let i = 1; i < 13; i += 2) g.fillRect(0, i * 320 / 13, 512, 320 / 13);
  g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 205, 172); g.fillStyle = '#ffffff';
  for (let r = 0; r < 5; r++) for (let s = 0; s < 6; s++) { g.beginPath(); g.arc(18 + s * 34, 18 + r * 34, 6, 0, 7); g.fill(); }
});
const cnFlagTex = flagTexture((g) => {
  g.fillStyle = '#de2910'; g.fillRect(0, 0, 512, 320); g.fillStyle = '#ffde00';
  const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5, a2 = a + Math.PI / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45); } g.closePath(); g.fill(); };
  star(70, 70, 38); star(130, 40, 13); star(148, 78, 13); star(130, 116, 13); star(104, 140, 13);
});
const flagAt = (x, z, tex) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, 5.2, 8), M.beamDark, 0, 2.6, 0, g);
  const f = add(new THREE.PlaneGeometry(1.9, 1.2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: true }), x < 0 ? 0.98 : -0.98, 4.5, 0, g, { cast: false });
  f.userData.ndSkip = true; return f;
};
const flagUS = flagAt(-6.0, -5.8, usFlagTex), flagCN = flagAt(6.0, -5.8, cnFlagTex);

// ----- the giant "1000" boards behind each army (== story.js BOARD_US / BOARD_CN) -----
const boardTexture = (label, bg, fg) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 576; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 576);
  g.lineWidth = 26; g.strokeStyle = fg; g.strokeRect(20, 20, 984, 536);
  g.fillStyle = fg; g.textAlign = 'center'; g.font = '900 330px Arial, sans-serif'; g.fillText('1000', 512, 360);
  g.font = '700 84px Arial, sans-serif'; g.fillText(label, 512, 492);
  return P.tex(c);
};
const boardAt = (pos, tex) => {
  const g = new THREE.Group(); g.position.set(pos[0], 0, pos[2]); world.add(g);
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.09, 0.11, pos[1] + 1.2, 8), M.beamDark, s * 2.2, (pos[1] + 1.2) / 2, 0, g);
  const b = add(new THREE.PlaneGeometry(4.8, 2.7), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: true }), 0, pos[1], 0, g, { cast: false });
  b.userData.ndSkip = true; return g;
};
boardAt(BOARD_US, boardTexture('U S   A R M Y', '#2c3e50', '#f4e9c8'));
boardAt(BOARD_CN, boardTexture('C H I N A   A R M Y', '#7c241c', '#ffe9a8'));

// ----- fog bank (night shot): translucent planes, opacity driven by worldAt fogA -----
const fogPlanes = [];
{
  const fc = document.createElement('canvas'); fc.width = 256; fc.height = 128;
  { const fg = fc.getContext('2d'), img = fg.createImageData(256, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) { const i = (y * 256 + x) * 4, u = x / 255, v = y / 127;
      img.data[i] = 205; img.data[i + 1] = 216; img.data[i + 2] = 232;
      img.data[i + 3] = Math.round(255 * Math.pow(Math.sin(Math.PI * u), 1.5) * Math.pow(Math.sin(Math.PI * v), 1.5)); }
    fg.putImageData(img, 0, 0); }
  const fm = new THREE.MeshBasicMaterial({ map: P.tex(fc), transparent: true, opacity: 0, fog: false, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const p = add(new THREE.PlaneGeometry(13, 2.6), fm, -13 + i * 4.3, 1.05, -2.5 + (i % 4) * 1.6, world, { cast: false });
    p.userData.ndSkip = true; p.userData.x0 = p.position.x; p.renderOrder = 4; fogPlanes.push(p);
  }
}

// ----- supply stack (verdict) + the handshake crate -----
const stackG2 = new THREE.Group(); stackG2.position.set(STACK_AT[0], 0, STACK_AT[2]); world.add(stackG2);
for (let i = 0; i < 6; i++) crateAt(stackG2, (i % 2) * 0.7 - 0.35, Math.floor(i / 2) * 0.45, (i % 3) * 0.12 - 0.1, (i % 3 - 1) * 0.15, false);
const shakeCrate = crateAt(world, 0, 0, 0.9, 0.1, false); shakeCrate.visible = false;


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
  usRanks.position.x = W.usOff || 0; cnRanks.position.x = W.cnOff || 0;
  const mode = W.runMode || 0;
  const amp = mode === 2 ? 0.075 : mode === 1 ? 0.05 : 0.008;
  const sp = mode === 2 ? 0.55 : mode === 1 ? 0.42 : 0.1;
  for (const m of ranks) {
    const ph = m.userData.side === 'cn' ? 0 : m.userData.ph * 0.61; // CN: one shared phase (lockstep); US: ragged offsets
    m.position.y = Math.abs(Math.sin(f * sp + ph)) * amp;
    m.rotation.x = mode ? -0.045 : 0;
  }
  const wv = Math.sin(f * 0.14) * 0.16;
  flagUS.rotation.y = wv; flagCN.rotation.y = -wv;
  flagUS.scale.x = 1 + Math.sin(f * 0.3) * 0.05; flagCN.scale.x = 1 + Math.cos(f * 0.3) * 0.05;
  fogPlanes.forEach((p, i) => { p.material.opacity = (W.fogA || 0) * 0.13; p.position.x = p.userData.x0 + Math.sin(f * 0.01 + i * 1.7) * 1.6; });
  stackG2.children.forEach((c, i) => { c.visible = i < (W.stack || 0); });
  shakeCrate.visible = !!W.shake;
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
