import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, LAYOUT } from './story.js';

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

// ---------- documentary world (zones along +x) ----------
// dawn sea x~0 · Pacific map x~140 · desert lab x~280 · target board x~370 · Tinian runway x~470
// Hiroshima grid x~600 · Nagasaki valley x~740 · radio tower x~840 · legacy sea x~960
const ground = flat(add(new THREE.PlaneGeometry(2600, 2600), M.sand, 480, -0.02, 0, world, { cast: false }));
const seaAt = (x, z, r) => {
  const m = flat(add(new THREE.CircleGeometry(r, 26), M.sea, x, 0, z, world, { cast: false }));
  m.material = M.sea; m.userData.nd = waterNd; return m;
};
seaAt(0, 0, 66); seaAt(600, 42, 20); seaAt(960, 0, 62);
const hillAt = (x, z, r, h, mat = M.hill) => { const g = add(new THREE.SphereGeometry(r, 14, 9), mat, x, -r * 0.45, z, world, { cast: false }); g.scale.y = h / r; return g; };
hillAt(-52, -62, 30, 12); hillAt(90, -70, 34, 13, M.hillFar); hillAt(215, -66, 30, 11); hillAt(330, -58, 26, 10, M.hillFar);
hillAt(520, -52, 26, 10); hillAt(660, -56, 30, 12, M.hillFar); hillAt(740, -44, 34, 15); hillAt(740, 46, 34, 14, M.hillFar);
hillAt(812, -50, 26, 10); hillAt(900, -64, 32, 12, M.hillFar); hillAt(1030, -70, 36, 14);
const padAt = (x, z, w = 7, d = 7) => flat(add(new THREE.PlaneGeometry(w, d), M.pad, x, 0.015, z, world, { cast: false }));
// canvas label boards
const boardTexCache = {};
const boardTex = (text, bg, fg) => {
  const key = text + bg; if (boardTexCache[key]) return boardTexCache[key];
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 160); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, 496, 144);
  g.fillStyle = fg; g.font = 'bold 58px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const tw = g.measureText(text).width; if (tw > 462) { g.font = `bold ${Math.floor(58 * 462 / tw)}px Arial`; }
  g.fillText(text, 256, 84); const t = P.tex(c); boardTexCache[key] = t; return t;
};
const boardAt = (text, x, y, z, w = 3.4, bg = '#20242c', fg = '#ffd76a', ry = 0) => {
  const m = add(new THREE.PlaneGeometry(w, w * 0.3125), new THREE.MeshBasicMaterial({ map: boardTex(text, bg, fg), fog: true }), x, y, z, world, { cast: false });
  m.rotation.y = ry; m.userData.ndSkip = true; return m;
};
const postAt = (x, z, h = 1.1) => add(new THREE.CylinderGeometry(0.05, 0.06, h, 6), M.pole, x, h / 2, z, world, { cast: false });
const B = {}; // toggleable story boards, driven by worldAt().boards
const storyBoard = (key, text, x, y, z, w, bg, fg, ry = 0) => { const m = boardAt(text, x, y, z, w, bg, fg, ry); m.visible = false; B[key] = m; return m; };
postAt(-3, -20, 10.5); postAt(11, -20, 10.5);
storyBoard('title', 'THE ATOMIC BOMB', 4, 12.5, -20, 21, '#1c2432', '#ffd76a');
storyBoard('warover', 'WAR IN EUROPE OVER', 112, 11, 36, 13, '#20301c', '#d8ffb0');
storyBoard('oppenheimer', 'OPPENHEIMER', 258, 6.5, 17, 8, '#20242c', '#ffd76a');
storyBoard('littleboy', 'LITTLE BOY', 433, 4.2, 15, 6.5, '#20242c', '#cfe4ff');
storyBoard('clock245', 'TAKE OFF · 2:45 AM', 456, 5.5, 17, 8, '#101820', '#5aff8a');
storyBoard('clock815', '8:15 AM', 564, 17, 27, 9, '#20242c', '#ffd76a', 0.5);
storyBoard('nagasaki', 'NAGASAKI', 696, 10, 27, 9, '#402020', '#ffd0c8');
storyBoard('emperor', 'THE EMPEROR SPEAKS', 824, 8.5, 15, 10, '#2c2416', '#ffd76a');
storyBoard('warend', 'WAR OVER', 852, 12, -17, 12, '#20301c', '#d8ffb0');
storyBoard('neveragain', 'NEVER AGAIN · 80 YEARS', 980, 11, -36, 12.5, '#1c2432', '#ffffff');
// ---------- Pacific map (painted ground plane + 3D markers) ----------
{
  const c = document.createElement('canvas'); c.width = 1024; c.height = 660; const g = c.getContext('2d');
  g.fillStyle = '#2c5a80'; g.fillRect(0, 0, 1024, 660);
  g.fillStyle = '#3a6e96'; for (let i = 0; i < 260; i++) { g.beginPath(); g.ellipse(Math.random() * 1024, Math.random() * 660, 8 + Math.random() * 26, 3 + Math.random() * 7, 0, 0, 7); g.fill(); }
  const land = '#77854f';
  g.fillStyle = land; // northern landmass band (Asia) + blobs
  g.beginPath(); g.moveTo(0, 0); g.lineTo(1024, 0); g.lineTo(1024, 92); g.bezierCurveTo(760, 150, 560, 66, 330, 118); g.bezierCurveTo(180, 158, 60, 120, 0, 132); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(240, 96, 210, 62, 0.1, 0, 7); g.fill();
  g.beginPath(); g.ellipse(700, 84, 190, 56, -0.08, 0, 7); g.fill();
  g.beginPath(); g.ellipse(150, 470, 120, 66, 0.4, 0, 7); g.fill();      // SE-Asia blob
  g.beginPath(); g.ellipse(880, 560, 90, 46, 0, 0, 7); g.fill();          // Australia hint
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1.5;           // faint chart grid
  for (let gx = 128; gx < 1024; gx += 128) { g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx, 660); g.stroke(); }
  for (let gy = 110; gy < 660; gy += 110) { g.beginPath(); g.moveTo(0, gy); g.lineTo(1024, gy); g.stroke(); }
  g.fillStyle = 'rgba(230,242,255,0.5)'; g.font = 'bold 44px Arial'; g.textAlign = 'center';
  g.fillText('P A C I F I C   O C E A N', 470, 400);
  const w2uv = (x, z) => [(x - 55) / 170 * 1024, (1 - (z + 50) / 110) * 660];
  g.fillStyle = '#87995f'; // Japan arc
  for (const [jx, jz] of [[150, -22], [156, -27], [161, -31], [166, -34]]) { const [u, v] = w2uv(jx, jz); g.beginPath(); g.ellipse(u, v, 21, 10, -0.6, 0, 7); g.fill(); }
  g.fillStyle = '#e8f0d8'; g.font = 'bold 25px Arial'; g.fillText('JAPAN', 905, 128);
  g.fillStyle = '#e8d9a0'; // island dots along the hop chain
  for (const [hx, hz] of LAYOUT.hops) { const [u, v] = w2uv(hx, hz); g.beginPath(); g.arc(u, v, 7, 0, 7); g.fill(); }
  const mapMesh = flat(add(new THREE.PlaneGeometry(170, 110), new THREE.MeshToonMaterial({ gradientMap: grad, map: P.tex(c) }), 140, 0.02, 5, world, { cast: false }));
  mapMesh.receiveShadow = true;
}
const hopDim = toon({ color: '#8a8d90' }), hopLit = new THREE.MeshBasicMaterial({ color: '#ffd76a', fog: true });
const hopMarkers = LAYOUT.hops.map(([hx, hz]) => { const m = add(new THREE.SphereGeometry(1.0, 10, 8), hopDim, hx, 0.9, hz, world, { cast: false }); m.userData.ndSkip = true; return m; });
const cityMark = (pos, col) => { const m = add(new THREE.SphereGeometry(1.5, 10, 8), new THREE.MeshBasicMaterial({ color: col, fog: true }), pos[0], 1.0, pos[1], world, { cast: false }); m.userData.ndSkip = true; return m; };
cityMark(LAYOUT.hiroshimaM, '#ff9a5a'); cityMark(LAYOUT.kokuraM, '#ffb0a0'); cityMark(LAYOUT.nagasakiM, '#ff9a5a');
// Kokura weather: a blob of cloud that covers the marker
const kokuraCloudG = new THREE.Group(); kokuraCloudG.position.set(LAYOUT.kokuraM[0], 2.6, LAYOUT.kokuraM[1]); world.add(kokuraCloudG);
{ const cm = new THREE.MeshBasicMaterial({ color: '#eef1f4', transparent: true, opacity: 0, fog: true });
  for (const [ox, oz, r] of [[0, 0, 4.6], [-3.4, 1, 3.4], [3.4, -0.6, 3.6], [0.6, 2.2, 3.0]]) { const s = add(new THREE.SphereGeometry(r, 10, 8), cm, ox, 0, oz, kokuraCloudG, { cast: false }); s.scale.y = 0.42; s.userData.ndSkip = true; }
  kokuraCloudG.userData.mat = cm; }
// the turn-south arrow over the map (arc + cone), fades in with map.arrow
const arrowN = new THREE.Group(); arrowN.position.set(149, 3.4, -30); world.add(arrowN);
{ const am = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0, fog: true });
  const arc = add(new THREE.TorusGeometry(6.4, 0.4, 8, 22, 2.0), am, 0, 0, 0, arrowN, { cast: false }); arc.rotation.x = Math.PI / 2; arc.rotation.z = 2.5; arc.userData.ndSkip = true;
  const head = add(new THREE.ConeGeometry(1.3, 3.2, 10), am, -6.2, 0, 1.8, arrowN, { cast: false }); head.rotation.z = Math.PI / 2 - 0.5; head.userData.ndSkip = true;
  arrowN.userData.mat = am; }
// ---------- desert lab + Trinity tower ----------
for (const [lx, lz, lw, lh] of [[264, 8, 7, 2.6], [274, 12, 5, 2.0], [288, 9, 6, 2.4], [296, 13, 5, 1.8], [270, -14, 6, 2.2], [292, -16, 7, 2.6]]) {
  add(tbox(lw, lh, 4.5), MW.panel, lx, lh / 2, lz, world);
}
{ const tx = LAYOUT.tower[0], tz = LAYOUT.tower[1]; // shot tower, 11 m
  for (const [ox, oz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { const leg = add(new THREE.CylinderGeometry(0.14, 0.18, 11, 6), M.metalDark, tx + ox, 5.5, tz + oz, world); leg.rotation.z = ox * 0.02; leg.rotation.x = -oz * 0.02; }
  add(box(3.6, 0.4, 3.6), M.metalDark, tx, 10.6, tz, world);
  add(new THREE.SphereGeometry(1.25, 12, 10), M.darkMetal, tx, 11.9, tz, world); // the Gadget
  add(box(14, 0.5, 5), M.metalDark, 267.5, 0.25, 7.5, world); // observers' bunker slab
}
const fireball = add(new THREE.SphereGeometry(1, 18, 14), new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0, fog: false }), LAYOUT.tower[0], 11.9, LAYOUT.tower[1], world, { cast: false });
fireball.userData.ndSkip = true; fireball.visible = false;
const fireballIn = add(new THREE.SphereGeometry(0.62, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0, fog: false }), LAYOUT.tower[0], 11.9, LAYOUT.tower[1], world, { cast: false });
fireballIn.userData.ndSkip = true; fireballIn.visible = false;
const mkRing = (col, op = 0.6) => { const m = add(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: true, depthWrite: false }), 0, 0, 0, world, { cast: false }); m.rotation.x = -Math.PI / 2; m.userData.ndSkip = true; m.visible = false; return m; };
const triRing = mkRing('#ffe9c0'); triRing.position.set(LAYOUT.tower[0], 0.35, LAYOUT.tower[1]);
// ---------- target board (decision) ----------
{ const bx = LAYOUT.board[0], bz = LAYOUT.board[1];
  add(box(27, 12, 0.7), toon({ color: '#4a4238' }), bx, 6, bz - 2.2, world);
  boardAt('TARGET CITIES', bx, 11.2, bz, 10, '#20242c', '#ffd76a');
  const names = [['KYOTO', 8.6], ['KOKURA', 6.9], ['HIROSHIMA', 5.2], ['NAGASAKI', 3.5]];
  for (const [nm, ny] of names) boardAt(nm, bx, ny, bz, 7.2, '#2c2620', '#e8dcc4');
  const hi = boardAt('HIROSHIMA', bx, 5.2, bz + 0.06, 8.6, '#8a2c1c', '#ffe9a0'); hi.visible = false; B.hiroshimaHi = hi;
}
// ---------- Tinian runway + Little Boy on its trolley ----------
{ flat(add(new THREE.PlaneGeometry(118, 11), M.darkMetal, 472, 0.03, 6, world, { cast: false }));
  for (let i = 0; i < 12; i++) flat(add(new THREE.PlaneGeometry(4.5, 0.5), M.white, 424 + i * 9, 0.05, 6, world, { cast: false }));
  for (let i = 0; i < 9; i++) { const lamp = add(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd76a', fog: false }), 424 + i * 12, 1.1, 12.5, world, { cast: false }); lamp.userData.ndSkip = true; postAt(424 + i * 12, 12.5, 1.0); }
}
// ---------- city grids (instanced blocks) + fires + rings + rain ----------
const mkCity = (cx, cz, cols, rows, sp, seed) => {
  const n = cols * rows;
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toon({ color: '#b3a893' }), n);
  const r = P.rng(seed), mtx = new THREE.Object3D(); let k = 0;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = cx + (i - (cols - 1) / 2) * sp + (r() - 0.5) * 1.2, z = cz + (j - (rows - 1) / 2) * sp + (r() - 0.5) * 1.2;
    if (Math.abs((x - cx) - (z - cz) * 0.35) < 3.4) { mtx.position.set(0, -50, 0); mtx.scale.set(0.01, 0.01, 0.01); } // the river gap
    else { const h = 1.1 + r() * 2.3; mtx.position.set(x, h / 2, z); mtx.scale.set(3.1, h, 3.1); }
    mtx.rotation.set(0, 0, 0); mtx.updateMatrix(); im.setMatrixAt(k++, mtx.matrix);
  }
  im.castShadow = true; im.receiveShadow = true; world.add(im); return im;
};
mkCity(600, 0, 13, 9, 6.4, 61); mkCity(740, 0, 9, 7, 6.2, 97);
const cityDark = flat(add(new THREE.PlaneGeometry(92, 60), new THREE.MeshBasicMaterial({ color: '#14100c', transparent: true, opacity: 0, depthWrite: false, fog: true }), 600, 3.4, 0, world, { cast: false }));
cityDark.userData.ndSkip = true;
const mkFires = (cx, cz, n, seed, spread = [38, 24]) => {
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff8a3c', transparent: true, opacity: 0, fog: false }), n);
  const r = P.rng(seed), mtx = new THREE.Object3D();
  for (let i = 0; i < n; i++) { mtx.position.set(cx + (r() - 0.5) * 2 * spread[0], 0.8 + r() * 1.4, cz + (r() - 0.5) * 2 * spread[1]); const s = 0.6 + r() * 1.1; mtx.scale.set(s, s * 1.5, s); mtx.updateMatrix(); im.setMatrixAt(i, mtx.matrix); }
  im.userData.ndSkip = true; im.visible = false; world.add(im); return im;
};
const cityFires = mkFires(600, 0, 70, 71), city2Fires = mkFires(740, 0, 40, 79, [26, 17]);
const cityRings = [mkRing('#ffd9a0'), mkRing('#c9b8a4')]; cityRings.forEach((m) => m.position.set(LAYOUT.burst[0], 0.4, LAYOUT.burst[2]));
const city2Ring = mkRing('#ffd9a0'); city2Ring.position.set(LAYOUT.burst2[0], 0.4, LAYOUT.burst2[2]);
const rainG = new THREE.Group(); rainG.position.set(600, 0, 0); world.add(rainG); rainG.visible = false;
{ const rm = new THREE.MeshBasicMaterial({ color: '#2e2a26', transparent: true, opacity: 0, fog: true });
  const r = P.rng(83); for (let i = 0; i < 46; i++) { const s = add(box(0.09, 2.6, 0.09), rm, (r() - 0.5) * 76, 5 + r() * 7, (r() - 0.5) * 48, rainG, { cast: false }); s.rotation.z = 0.16; s.userData.ndSkip = true; }
  rainG.userData.mat = rm; }
// ---------- radio tower + white flag over a small map ----------
{ const tx = LAYOUT.radio[0];
  for (const [ox, oz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) { const leg = add(new THREE.CylinderGeometry(0.12, 0.2, 27, 6), M.metalDark, tx + ox * 0.8, 13.5, oz * 0.8, world); leg.rotation.z = ox * 0.018; leg.rotation.x = -oz * 0.018; }
  for (const hy of [6, 12, 18, 24]) add(box(2.6 - hy * 0.05, 0.3, 2.6 - hy * 0.05), M.metalDark, tx, hy, 0, world, { cast: false });
  add(new THREE.CylinderGeometry(0.09, 0.13, 7, 6), M.metalDark, tx, 30, 0, world, { cast: false });
  add(box(5.5, 3, 3.4), MW.panel, tx - 6, 1.5, 3, world); // transmitter hut
}
const radioRings = [0, 1, 2].map(() => { const m = add(new THREE.TorusGeometry(1, 0.09, 6, 30), new THREE.MeshBasicMaterial({ color: '#bfe0ff', transparent: true, opacity: 0, fog: true, depthWrite: false }), LAYOUT.radio[0], 29, LAYOUT.radio[1], world, { cast: false }); m.rotation.x = Math.PI / 2; m.userData.ndSkip = true; m.visible = false; return m; });
const flagG = new THREE.Group(); flagG.position.set(LAYOUT.flag[0], 0, LAYOUT.flag[1]); world.add(flagG);
flat(add(new THREE.PlaneGeometry(17, 11), new THREE.MeshToonMaterial({ gradientMap: grad, color: '#7a8a58' }), 0, 0.04, 0, flagG, { cast: false }));
add(new THREE.CylinderGeometry(0.09, 0.11, 8.4, 8), M.pole, -5, 4.2, 0, flagG);
const whiteFlag = add(new THREE.PlaneGeometry(3.4, 2.1, 8, 1), new THREE.MeshToonMaterial({ gradientMap: grad, color: '#f4f2ec', side: THREE.DoubleSide }), -5 + 1.75, 7.4, 0, flagG, { cast: false });
whiteFlag.userData.base = whiteFlag.geometry.attributes.position.array.slice();
const flags = [whiteFlag];
// ---------- B-29 factory (nose = +X) ----------
const silver = toon({ color: '#c9ccd2' }), silverDark = toon({ color: '#9aa0a8' });
const propMat = new THREE.MeshBasicMaterial({ color: '#22242a', transparent: true, opacity: 0.5, side: THREE.DoubleSide, fog: true });
const mkB29 = () => {
  const g = new THREE.Group();
  const fus = add(new THREE.CylinderGeometry(1.05, 0.85, 12.5, 14), silver, 0, 0, 0, g); fus.rotation.z = Math.PI / 2;
  const nose = add(new THREE.SphereGeometry(1.05, 14, 10), silver, 6.1, 0, 0, g); nose.scale.set(1.15, 1, 1);
  add(new THREE.SphereGeometry(0.62, 10, 8), M.glass, 5.2, 0.72, 0, g, { cast: false }); // cockpit glass
  const tail = add(new THREE.CylinderGeometry(0.85, 0.3, 3.4, 12), silver, -7.6, 0.12, 0, g); tail.rotation.z = Math.PI / 2;
  add(box(3.4, 0.16, 21), silverDark, 0.4, -0.15, 0, g, { cast: false });                    // main wing
  add(box(1.7, 0.14, 6.6), silverDark, -8.6, 0.35, 0, g, { cast: false });                    // tailplane
  const fin = add(box(1.9, 2.7, 0.14), silverDark, -8.6, 1.6, 0, g, { cast: false }); fin.rotation.z = 0.25;
  const props = [];
  for (const pz of [-7.6, -2.9, 2.9, 7.6]) {
    const nac = add(new THREE.CylinderGeometry(0.44, 0.38, 3.0, 10), silverDark, 1.7, -0.3, pz, g); nac.rotation.z = Math.PI / 2;
    const disc = add(new THREE.CircleGeometry(1.55, 20), propMat, 3.35, -0.3, pz, g, { cast: false }); disc.rotation.y = Math.PI / 2; disc.userData.ndSkip = true; props.push(disc);
    add(new THREE.SphereGeometry(0.3, 8, 6), M.darkMetal, 3.3, -0.3, pz, g, { cast: false });
  }
  g.userData.props = props; return g;
};
const planeG = mkB29(); planeG.visible = false; world.add(planeG);
const plane2G = mkB29(); plane2G.visible = false; world.add(plane2G);
// the bomb (nose +Y, falls nose-down via quaternion from story dir)
const mkBomb = (col) => {
  const g = new THREE.Group();
  add(new THREE.CylinderGeometry(0.55, 0.55, 3.2, 12), col, 0, 0, 0, g);
  add(new THREE.ConeGeometry(0.55, 1.1, 12), col, 0, 2.15, 0, g);
  add(box(1.5, 1.1, 0.12), col, 0, -1.9, 0, g, { cast: false }); add(box(0.12, 1.1, 1.5), col, 0, -1.9, 0, g, { cast: false });
  return g;
};
const bombG = mkBomb(toon({ color: '#5c6644' })); bombG.visible = false; world.add(bombG);
const bomb2G = mkBomb(toon({ color: '#4c4c50' })); bomb2G.visible = false; world.add(bomb2G);
{ const lb = mkBomb(toon({ color: '#5c6644' })); lb.rotation.z = Math.PI / 2; lb.position.set(436, 0.75, 10.5); world.add(lb); // Little Boy on display by the runway
  add(box(3.6, 0.5, 1.4), M.metalDark, 436, 0.25, 10.5, world); }
// ---------- S2 additions: Enola Gay story (boards + bomb-bay interior + north lamps) ----------
storyBoard('enolagay', 'ENOLA GAY', 458, 3.3, 15.5, 5.4, '#20242c', '#ffd76a');
storyBoard('tibbets', 'COL. PAUL TIBBETS · AGE 29', 449, 2.6, 15.8, 5.0, '#101820', '#cfe4ff');
storyBoard('neversame', 'THE WORLD WAS NEVER THE SAME', 762, 39, 47, 16, '#1c2432', '#ffffff', -0.35);
for (let i = 0; i < 9; i++) { const lamp = add(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd76a', fog: false }), 424 + i * 12, 1.1, -0.5, world, { cast: false }); lamp.userData.ndSkip = true; postAt(424 + i * 12, -0.5, 1.0); }
// bomb-bay interior: open-front dark hangar at (520, 44) — the bomb on its cradle, one work lamp
{ const bx = 520, bz = 44;
  flat(add(new THREE.PlaneGeometry(17, 13), M.metalDark, bx, 0.03, bz, world, { cast: false }));
  add(box(17, 7, 0.5), MW.roomWall, bx, 3.5, bz - 6.5, world, { cast: false });
  add(box(0.5, 7, 13), MW.roomWall, bx - 8.5, 3.5, bz, world, { cast: false });
  add(box(0.5, 7, 13), MW.roomWall, bx + 8.5, 3.5, bz, world, { cast: false });
  add(box(17, 0.5, 13), M.metalDark, bx, 7, bz, world, { cast: false });
  const bayBomb = mkBomb(toon({ color: '#5c6644' })); bayBomb.rotation.z = Math.PI / 2; bayBomb.position.set(bx, 1.6, bz); world.add(bayBomb);
  add(box(4.2, 0.9, 1.5), M.metalDark, bx, 0.45, bz, world, { cast: false });
  add(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe9a0', fog: false }), bx, 5.6, bz, world, { cast: false }).userData.ndSkip = true;
  add(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), M.metalDark, bx, 6.3, bz, world, { cast: false });
  storyBoard('tnt', '15,000 TONS OF TNT', bx, 3.6, bz - 6.1, 5.4, '#20242c', '#ffd76a');
}
// ---------- mushroom cloud factory (unit cloud, scaled by state: scale = (r, h, r)) ----------
const mkCloud = (mat) => {
  const g = new THREE.Group();
  const sph = (x, y, z, r, sy = 1) => { const s = add(new THREE.SphereGeometry(r, 13, 10), mat, x, y, z, g, { cast: false }); s.scale.y = sy; return s; };
  sph(0, 0.06, 0, 0.30); sph(0.05, 0.18, 0.02, 0.27); sph(-0.03, 0.31, -0.02, 0.29); sph(0.02, 0.44, 0.01, 0.33); // stem
  sph(0, 0.64, 0, 0.55, 0.6); sph(-0.26, 0.58, 0.06, 0.36, 0.55); sph(0.27, 0.59, -0.05, 0.38, 0.55);              // cap
  sph(0.03, 0.8, 0, 0.42, 0.55); sph(-0.13, 0.87, 0.03, 0.3, 0.5);                                                  // crown (top ~1.02)
  return g;
};
const cloudMat = new THREE.MeshToonMaterial({ gradientMap: grad, color: '#cfc8bd', transparent: true, opacity: 1 });
const cloudG = mkCloud(cloudMat); cloudG.visible = false; world.add(cloudG);
const cloud2Mat = new THREE.MeshToonMaterial({ gradientMap: grad, color: '#c4beb2', transparent: true, opacity: 1 });
const cloud2G = mkCloud(cloud2Mat); cloud2G.visible = false; world.add(cloud2G);
const legacyMat = new THREE.MeshBasicMaterial({ color: '#454a54', transparent: true, opacity: 0, fog: true });
const legacyCloudG = mkCloud(legacyMat); legacyCloudG.position.set(LAYOUT.legacyCloud[0], 0, LAYOUT.legacyCloud[1]); legacyCloudG.scale.setScalar(26); legacyCloudG.visible = false; world.add(legacyCloudG);
legacyCloudG.traverse((o) => { o.userData.ndSkip = true; });

// clouds: painted billboards far away (no fog, no ink)
const clouds = [];
{ const r = P.rng(90);
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const pen = new T.Pen(c.getContext('2d')); pen.ol = 0;
    pen.g.translate(300, 200); pen.g.scale(1.4, 1.2); pen.g.translate(-300, -200); T.fxCloud(pen, i + 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.667), new THREE.MeshBasicMaterial({ map: P.tex(c), transparent: true, fog: false, depthWrite: false }));
    const a = r() * Math.PI * 2, d = 700 + r() * 250; m.position.set(480 + Math.cos(a) * d, 130 + r() * 150, Math.sin(a) * d); m.scale.setScalar(110 + r() * 90);
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
  const FWD = new THREE.Vector3(1, 0, 0);
  const drivePlane = (g, st) => {
    g.visible = !!st; if (!st) return;
    g.position.set(...st.p);
    tmpV.set(...st.d); g.quaternion.setFromUnitVectors(FWD, tmpV);
    for (const pr of g.userData.props) pr.rotation.x = st.props;
  };
  drivePlane(planeG, W.plane); drivePlane(plane2G, W.plane2);
  const driveBomb = (g, b) => { g.visible = !!b; if (!b) return; g.position.set(...b.p); tmpV.set(...b.d); g.quaternion.setFromUnitVectors(UP, tmpV); };
  driveBomb(bombG, W.bomb); driveBomb(bomb2G, W.bomb2);
  const driveCloud = (g, mat, c) => { g.visible = !!c; if (!c) return; g.position.set(c.p[0], 0, c.p[2]); g.scale.setScalar(c.s); mat.opacity = c.a; };
  driveCloud(cloudG, cloudMat, W.cloud); driveCloud(cloud2G, cloud2Mat, W.cloud2);
  legacyCloudG.visible = !!W.legacyCloud;
  if (W.legacyCloud) { legacyCloudG.scale.setScalar(26 * W.legacyCloud.s); legacyMat.opacity = W.legacyCloud.a; }
  // Trinity fireball + ground ring
  const tri = W.trinity;
  fireball.visible = fireballIn.visible = !!tri && tri.fb < 1;
  if (tri) {
    const s = tri.fb < 0.3 ? M_easeOut(tri.fb / 0.3) * 7.5 : 7.5 * (1 - (tri.fb - 0.3) / 0.7 * 0.8);
    fireball.scale.setScalar(Math.max(0.01, s)); fireballIn.scale.setScalar(Math.max(0.01, s));
    fireball.material.opacity = 0.95 * (1 - tri.fb * 0.85); fireballIn.material.opacity = 0.95 * (1 - tri.fb);
    triRing.visible = tri.ring > 0 && tri.ring < 1;
    triRing.scale.setScalar(2 + tri.ring * 42); triRing.material.opacity = (1 - tri.ring) * 0.55;
  } else triRing.visible = false;
  // city shockwave rings, fires, ash-dark, black rain
  const driveRing = (m, p, maxR) => { m.visible = p > 0 && p < 1; if (m.visible) { m.scale.setScalar(3 + p * maxR); m.material.opacity = (1 - p) * 0.55; } };
  driveRing(cityRings[0], W.city.rings[0], 46); driveRing(cityRings[1], W.city.rings[1], 55);
  driveRing(city2Ring, W.city2.rings[0], 38);
  cityFires.visible = W.city.fires > 0.02; if (cityFires.visible) cityFires.material.opacity = W.city.fires * (0.72 + 0.28 * Math.sin(f * 0.55));
  city2Fires.visible = W.city2.fires > 0.02; if (city2Fires.visible) city2Fires.material.opacity = W.city2.fires * (0.72 + 0.28 * Math.sin(f * 0.5 + 2));
  cityDark.material.opacity = W.city.dark * 0.55;
  rainG.visible = W.city.rain > 0.02;
  if (rainG.visible) { rainG.userData.mat.opacity = W.city.rain * 0.5; rainG.position.y = -((f * 0.45) % 2.6); }
  // map: island hops light up in sequence
  hopMarkers.forEach((m, i) => { const lit = W.map.hops > i + 0.45; m.material = lit ? hopLit : hopDim; const just = W.map.hops - (i + 0.45); m.scale.setScalar(lit ? 1 + 0.35 * Math.max(0, 1 - just) : 0.8); m.position.y = 0.9 + (lit ? 0.25 * Math.max(0, 1 - just) : 0); });
  kokuraCloudG.visible = W.map.kokura > 0.02;
  if (kokuraCloudG.visible) { kokuraCloudG.userData.mat.opacity = W.map.kokura * 0.96; const ks = 0.6 + 0.4 * W.map.kokura; kokuraCloudG.scale.set(ks, 1, ks); }
  arrowN.visible = W.map.arrow > 0.02; if (arrowN.visible) arrowN.userData.mat.opacity = W.map.arrow * 0.95;
  // radio waves + the white flag rising
  radioRings.forEach((m, k) => {
    const on = W.radio.waves > 0; m.visible = on; if (!on) return;
    const p = ((f * 0.009) + k / 3) % 1;
    m.scale.setScalar(1.5 + p * 15); m.material.opacity = (1 - p) * 0.5 * W.radio.waves;
  });
  flagG.visible = W.map.flag > 0.02;
  if (flagG.visible) whiteFlag.scale.x = Math.max(0.06, W.map.flag);
  flags.forEach((fl, i) => { const pos = fl.geometry.attributes.position, base = fl.userData.base;
    for (let v = 0; v < pos.count; v++) { const bx = base[v * 3]; pos.setZ(v, Math.sin(f * 0.15 + bx * 1.6 + i * 2) * 0.09 * (bx + 1.7) / 3.4); }
    pos.needsUpdate = true; });
  for (const k of Object.keys(B)) B[k].visible = !!W.boards[k];
  waterU.t.value = f / 30;
}
const M_easeOut = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

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


