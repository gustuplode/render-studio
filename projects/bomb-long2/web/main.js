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
// All sets sit on y=0 in separate zones along -x (see the world build below); location cuts are dip-masked in story.js camAt.
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

// ----- WORLD: nine quiet, respectful sets in separate zones (x: hook 0, engineer -60, aug6 -120,
// journey -180, aug9 -260, recovery -320, speaking -380, recognition -440, legacy bay -500) -----
const ground = flat(add(new THREE.PlaneGeometry(1500, 700), M.grass, -250, 0, -40, world, { cast: false }));
const waterFlat = toon({ color: '#3f6d8a' }), sandMat = toon({ color: '#cdbb96' }), cityFar = toon({ color: '#5c6672' }), darkMat = toon({ color: '#17141c' });
const glassMat = new THREE.MeshBasicMaterial({ color: '#cfe2ee', transparent: true, opacity: 0.45 });
const txt = (g, s, x, y, size, col, weight = 900) => { g.fillStyle = col; g.font = `${weight} ${size}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); };
const boardMesh = (w, h, draw, cw = 1024, ch = 512) => {
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; draw(cv.getContext('2d'), cw, ch);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshToonMaterial({ gradientMap: grad, map: tx }));
  m.castShadow = false; m.receiveShadow = true; return m;
};
const boardAt = (w, h, draw, x, y, z, cw, ch) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  const b = boardMesh(w, h, draw, cw, ch); b.position.y = y; g.add(b);
  add(box(0.14, y, 0.14), M.wood, -w / 2 + 0.3, y / 2, -0.12, g);
  add(box(0.14, y, 0.14), M.wood, w / 2 - 0.3, y / 2, -0.12, g);
  return g;
};
const treeAt = (x, z, s = 1, mat = M.cypress) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); world.add(g);
  add(new THREE.CylinderGeometry(0.09, 0.13, 0.9, 6), M.trunk, 0, 0.45, 0, g);
  add(new THREE.ConeGeometry(0.85, 2.6, 8), mat, 0, 2.0, 0, g); return g;
};
const houseAt = (x, z, w = 4.4, h = 2.7, d = 3.2, wall = M.plaster) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(tbox(w, h, d, 2), wall, 0, h / 2, 0, g);
  const r1 = add(box(w * 0.64, 0.09, d * 1.18), M.roof, -w * 0.235, h + 0.52, 0, g); r1.rotation.z = 0.62;
  const r2 = add(box(w * 0.64, 0.09, d * 1.18), M.roof, w * 0.235, h + 0.52, 0, g); r2.rotation.z = -0.62;
  add(box(0.75, 0.95, 0.06), M.window, -w * 0.26, 1.55, d / 2 + 0.03, g);
  add(box(0.75, 0.95, 0.06), M.window, w * 0.26, 1.55, d / 2 + 0.03, g);
  add(box(0.92, 1.85, 0.07), M.door, 0, 0.93, d / 2 + 0.03, g);
  return g;
};
const deskAt = (x, z, w = 2.6, dpt = 1.2) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(box(w, 0.09, dpt), M.wood, 0, 0.76, 0, g);
  for (const [lx, lz] of [[-w / 2 + 0.12, -dpt / 2 + 0.1], [w / 2 - 0.12, -dpt / 2 + 0.1], [-w / 2 + 0.12, dpt / 2 - 0.1], [w / 2 - 0.12, dpt / 2 - 0.1]]) add(box(0.09, 0.76, 0.09), M.wood, lx, 0.38, lz, g);
  return g;
};
const chairAt = (x, z, ry = 0) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  add(box(0.52, 0.06, 0.5), M.wood, 0, 0.46, 0, g);
  add(box(0.52, 0.62, 0.06), M.wood, 0, 0.79, -0.23, g);
  add(box(0.06, 0.46, 0.06), M.wood, -0.2, 0.23, 0.18, g); add(box(0.06, 0.46, 0.06), M.wood, 0.2, 0.23, 0.18, g);
  return g;
};
// an office back wall (z=-5 rel) with window openings; glass (or shards, aug9) sits in them
const officeWall = (cx, shardWindow = -1) => {
  const g = new THREE.Group(); g.position.set(cx, 0, -5); world.add(g);
  add(tbox(17, 1.0, 0.3, 2), M.plaster2, 0, 0.5, 0, g);
  add(tbox(17, 0.95, 0.3, 2), M.plaster2, 0, 3.32, 0, g);
  for (const px of [-8.1, -5.35, -1.75, 1.85, 5.45, 8.1]) add(tbox(0.85, 1.9, 0.3, 2), M.plaster2, px, 1.92, 0, g);
  const wins = [[-6.72, 2.75], [-3.55, 3.6], [0.05, 3.6], [3.65, 2.75]];
  wins.forEach(([wx, ww], i) => {
    if (i === shardWindow) return;
    const gl = add(new THREE.PlaneGeometry(ww, 1.85), glassMat, wx, 1.92, -0.18, g, { cast: false }); gl.receiveShadow = false;
    add(box(ww + 0.1, 0.07, 0.06), M.wood, wx, 1.92, 0.05, g);
  });
  return g;
};

// ----- HOOK clearing (x 0): portrait ground, title board + the two city boards -----
flat(add(new THREE.PlaneGeometry(30, 18), M.dirt, 0, 0.011, 0, world, { cast: false }));
boardAt(6.6, 3.3, (g, w, h) => {
  g.fillStyle = '#232c44'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8a84a'; g.lineWidth = 10; g.strokeRect(18, 18, w - 36, h - 36);
  txt(g, 'SURVIVED', w / 2, 118, 92, '#f4ecd8'); txt(g, 'TWO ATOMIC BOMBS', w / 2, 248, 80, '#ffd98a');
  txt(g, 'JAPAN • 1945', w / 2, 368, 44, '#b9c4de', 700);
}, 0, 3.55, -4.5);
const cityDraw = (name) => (g, w, h) => {
  g.fillStyle = '#4a2e26'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcc0'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
  txt(g, name, w / 2, h / 2 + 4, 92, '#f6efdc');
};
boardAt(3.2, 1.6, cityDraw('HIROSHIMA'), -4.7, 2.3, -3.4);
boardAt(3.2, 1.6, cityDraw('NAGASAKI'), 4.7, 2.3, -3.4);
houseAt(-11, -12, 5, 3, 3.6); houseAt(11.5, -12.5, 5.4, 3.2, 3.6); houseAt(0, -16, 6, 3.4, 4);
treeAt(-8.5, -5.5, 1.2); treeAt(8.5, -5.5, 1.1, M.pine); treeAt(-13, -3, 0.9); treeAt(13.5, -3.5, 1.0);

// ----- ENGINEER (x -60): Mitsubishi office, dockyard + ship through the windows -----
flat(add(new THREE.PlaneGeometry(30, 18), M.plank, -60, 0.012, -1, world, { cast: false }));
officeWall(-60);
flat(add(new THREE.PlaneGeometry(38, 15), waterFlat, -60, 0.02, -13.5, world, { cast: false }));
add(tbox(30, 3.2, 4.5, 3), toon({ color: '#4a5560' }), -60, 1.2, -19, world);
add(box(26, 0.5, 4), toon({ color: '#5c6874' }), -60, 3.0, -19, world);
add(new THREE.CylinderGeometry(0.16, 0.16, 5.5, 6), M.iron, -70, 5.2, -19, world);
add(new THREE.CylinderGeometry(0.16, 0.16, 5.5, 6), M.iron, -50, 5.2, -19, world);
add(box(0.35, 6.5, 0.35), M.iron, -72, 3.25, -14.5, world);
const craneArm = add(box(6, 0.3, 0.3), M.iron, -69.5, 6.2, -14.5, world); craneArm.rotation.z = 0.18;
const hillA = add(new THREE.SphereGeometry(16, 12, 8), M.hillFar, -88, 0, -40, world, { cast: false }); hillA.scale.set(1.4, 0.32, 0.7);
const hillB = add(new THREE.SphereGeometry(16, 12, 8), M.hillFar, -32, 0, -42, world, { cast: false }); hillB.scale.set(1.2, 0.26, 0.7);
deskAt(-60.3, -0.8);
const draftTex = (() => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 340; const g = cv.getContext('2d');
  g.fillStyle = '#f2ecdc'; g.fillRect(0, 0, 512, 340); g.strokeStyle = '#4a6a8a'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(60, 230); g.lineTo(430, 230); g.lineTo(390, 280); g.lineTo(110, 280); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(150, 230); g.lineTo(150, 120); g.lineTo(340, 120); g.lineTo(340, 230); g.stroke();
  g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(60 + i * 74, 306); g.lineTo(60 + i * 74, 322); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const draftPaper = flat(add(new THREE.PlaneGeometry(1.15, 0.78), new THREE.MeshToonMaterial({ gradientMap: grad, map: draftTex }), -60.3, 0.815, -0.8, world, { cast: false }));
deskAt(-56.4, -1.4, 2.0, 1.0); chairAt(-60.3, 0.35, Math.PI); chairAt(-56.4, -0.5, Math.PI);
add(tbox(1.7, 2.1, 0.5, 2), M.wood, -64.6, 1.05, -3.6, world);
add(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 5), M.iron, -60, 3.5, -0.8, world);
add(new THREE.ConeGeometry(0.32, 0.3, 10), toon({ color: '#3f5a4a' }), -60, 3.05, -0.8, world);
// the packed suitcase (appears late in the shot, worldState-driven)
const suitcaseG = new THREE.Group(); suitcaseG.position.set(-59.1, 0, 0.7); suitcaseG.visible = false; world.add(suitcaseG);
add(box(0.64, 0.46, 0.22), toon({ color: '#7a5230' }), 0, 0.25, 0, suitcaseG);
add(box(0.09, 0.48, 0.235), toon({ color: '#5c3d20' }), -0.15, 0.25, 0, suitcaseG);
add(box(0.09, 0.48, 0.235), toon({ color: '#5c3d20' }), 0.15, 0.25, 0, suitcaseG);
add(box(0.2, 0.07, 0.05), M.iron, 0, 0.52, 0, suitcaseG);

// ----- AUG 6 (x -120): a quiet tram street in the morning -----
flat(add(new THREE.PlaneGeometry(36, 8), M.dirt, -120, 0.012, 1.2, world, { cast: false }));
add(box(36, 0.05, 0.09), M.iron, -120, 0.03, 0.3, world, { cast: false });
add(box(36, 0.05, 0.09), M.iron, -120, 0.03, 1.3, world, { cast: false });
houseAt(-133, -6.5, 4.6, 2.8, 3.2); houseAt(-126.5, -6.8, 4.2, 2.6, 3); houseAt(-120, -6.5, 4.8, 3, 3.4); houseAt(-113.5, -6.8, 4.2, 2.6, 3); houseAt(-107, -6.5, 4.6, 2.9, 3.2);
houseAt(-129, -14, 5.4, 3.2, 3.6, M.plaster2); houseAt(-116, -14.5, 5.8, 3.4, 3.6, M.plaster2); houseAt(-105, -14, 5.2, 3.1, 3.6, M.plaster2);
for (const px of [-132, -124, -116, -108]) {
  add(new THREE.CylinderGeometry(0.05, 0.07, 4.4, 6), M.trunk, px, 2.2, -3.2, world);
  add(box(1.5, 0.08, 0.08), M.trunk, px, 3.7, -3.2, world);
}
const tramG = new THREE.Group(); tramG.position.set(-138, 0, 0.8); world.add(tramG);
add(box(7, 2.2, 2.0), toon({ color: '#e8ddc4' }), 0, 1.55, 0, tramG);
add(box(7.04, 0.5, 2.04), toon({ color: '#a03a30' }), 0, 0.92, 0, tramG);
add(box(7.2, 0.18, 2.2), toon({ color: '#6a4a3a' }), 0, 2.74, 0, tramG);
for (let i = 0; i < 4; i++) add(box(1.1, 0.8, 0.05), M.window, -2.6 + i * 1.73, 1.85, 1.02, tramG);
for (const [wx, wz] of [[-2.4, 0.8], [2.4, 0.8], [-2.4, -0.8], [2.4, -0.8]]) { const w = add(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 10), M.iron, wx, 0.36, wz, tramG); w.rotation.x = Math.PI / 2; }
// the shelter: posts, a slanted roof, a dark quiet inside (distant fires stay glow points, below)
add(box(0.12, 1.9, 0.12), M.wood, -112.9, 0.95, -0.6, world); add(box(0.12, 1.9, 0.12), M.wood, -110.1, 0.95, -0.6, world);
const shRoof = add(box(3.4, 0.08, 2.4), M.roof, -111.5, 2.05, -1.6, world); shRoof.rotation.x = 0.32;
add(box(3.2, 1.7, 0.1), M.plank, -111.5, 0.85, -2.75, world);
add(box(2.6, 0.09, 0.5), M.wood, -111.5, 0.45, -1.9, world);
add(box(2.6, 0.45, 0.08), M.wood, -111.5, 0.22, -2.1, world);
const fireGlows = [];
for (const [fx, fy, fz, fs, ph] of [[-131, 1.7, -8.5, 3.6, 0], [-124, 2.1, -11, 4.4, 2.1], [-117, 1.5, -8, 3.2, 4.2], [-110, 1.9, -10.5, 4.0, 1.2], [-104, 1.6, -8.5, 3.4, 5.3]]) {
  const m = MW.lampGlow.clone(); m.color.set('#ff8a3c'); m.opacity = 0;
  const p = add(new THREE.PlaneGeometry(fs, fs * 0.72), m, fx, fy, fz, world, { cast: false });
  p.renderOrder = 3; p.userData.ndSkip = true; p.userData.ph = ph; fireGlows.push(p);
}

// ----- JOURNEY (x -180): station platform, the train, the coast road home -----
flat(add(new THREE.PlaneGeometry(11, 105), M.dirt, -181.2, 0.008, 0, world, { cast: false }));
add(box(0.09, 0.06, 105), M.iron, -182.15, 0.03, 0, world, { cast: false });
add(box(0.09, 0.06, 105), M.iron, -180.25, 0.03, 0, world, { cast: false });
add(box(4.6, 0.05, 34), M.stone, -176.8, 0.025, 4, world, { cast: false });
const trainG = new THREE.Group(); trainG.position.set(-180.6, 0, 0); world.add(trainG);
const locoMat = toon({ color: '#37424e' }), carMat = toon({ color: '#5c6e58' }), carRoof = toon({ color: '#4a4438' });
const boiler = add(new THREE.CylinderGeometry(0.85, 0.85, 4.4, 12), locoMat, 0, 1.55, 12.6, trainG); boiler.rotation.x = Math.PI / 2;
add(box(2.6, 2.3, 2.3), locoMat, 0, 1.65, 8.6, trainG);
add(new THREE.CylinderGeometry(0.17, 0.3, 1.0, 8), M.iron, 0, 2.85, 14.2, trainG);
add(new THREE.SphereGeometry(0.34, 10, 8), M.bronze, 0, 2.5, 12.2, trainG);
add(box(2.6, 1.8, 2.6), toon({ color: '#4c4438' }), 0, 1.35, 5.2, trainG);
for (const cz of [2.2, -5.6]) {
  add(box(3.0, 2.7, 6.4), carMat, 0, 1.75, cz, trainG);
  add(box(3.2, 0.2, 6.6), carRoof, 0, 3.2, cz, trainG);
  add(box(3.04, 0.8, 5.6), M.window, 0, 2.25, cz, trainG);
  for (const wz of [cz - 2.2, cz + 2.2]) for (const wx of [-1.05, 1.05]) { const w = add(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 10), M.iron, wx, 0.46, wz, trainG); w.rotation.z = Math.PI / 2; }
}
add(box(0.07, 1.95, 1.15), toon({ color: '#2e2a24' }), 1.53, 1.3, 3.0, trainG); // the open door the hero rides at
boardAt(3.4, 1.15, (g, w, h) => { g.fillStyle = '#2e3a2e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcc0'; g.lineWidth = 7; g.strokeRect(12, 12, w - 24, h - 24); txt(g, 'NAGASAKI', w / 2, h / 2 + 2, 84, '#f6efdc'); }, -176.6, 3.0, 13.5);
add(box(1.9, 0.09, 0.5), M.wood, -176.6, 0.55, 8.5, world);
add(box(0.09, 0.55, 0.45), M.wood, -177.4, 0.27, 8.5, world); add(box(0.09, 0.55, 0.45), M.wood, -175.8, 0.27, 8.5, world);
const poleMeshes = [];
for (let i = 0; i < 14; i++) {
  const g = new THREE.Group(); g.position.set(-185.2, 0, -54 + i * 9); world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, 5.2, 6), M.trunk, 0, 2.6, 0, g);
  add(box(1.6, 0.08, 0.08), M.trunk, 0, 4.4, 0, g);
  poleMeshes.push(g);
}
flat(add(new THREE.PlaneGeometry(30, 135), waterFlat, -204, 0.01, 0, world, { cast: false }));
flat(add(new THREE.PlaneGeometry(6, 135), sandMat, -190, 0.012, 0, world, { cast: false }));
for (const [mx, mz, ms] of [[-238, -42, 26], [-240, 2, 32], [-236, 44, 24]]) { const m = add(new THREE.SphereGeometry(10, 12, 8), M.mount, mx, 0, mz, world, { cast: false }); m.scale.set(ms / 10, ms / 22, ms / 12); }
const homeG = new THREE.Group(); homeG.position.set(-170, 0, -21.5); world.add(homeG);
add(tbox(5.6, 2.9, 4, 2), M.plaster, 0, 1.45, 0, homeG);
const hr1 = add(box(3.7, 0.09, 4.7), M.roof, -1.42, 3.42, 0, homeG); hr1.rotation.z = 0.62;
const hr2 = add(box(3.7, 0.09, 4.7), M.roof, 1.42, 3.42, 0, homeG); hr2.rotation.z = -0.62;
add(box(1.0, 2.0, 0.08), M.door, -0.6, 1.0, 2.03, homeG);
add(box(0.85, 1.0, 0.06), M.window, 1.5, 1.7, 2.03, homeG);
add(box(3.6, 0.12, 1.7), M.wood, -0.3, 0.06, 2.8, homeG);
add(box(2.2, 0.025, 15), M.dirt, -173.5, 0.012, -9.5, world, { cast: false });
const bushA = add(new THREE.SphereGeometry(0.55, 8, 6), M.bush, -166.3, 0.4, -19, world); bushA.scale.y = 0.75;
const bushB = add(new THREE.SphereGeometry(0.5, 8, 6), M.bush, -174.2, 0.36, -20, world); bushB.scale.y = 0.75;
const hillC = add(new THREE.SphereGeometry(16, 12, 8), M.hillFar, -186, 0, -50, world, { cast: false }); hillC.scale.set(1.5, 0.3, 0.7);
const hillD = add(new THREE.SphereGeometry(16, 12, 8), M.hillFar, -156, 0, -52, world, { cast: false }); hillD.scale.set(1.3, 0.26, 0.7);

// ----- AUG 9 (x -260): the Nagasaki office — the window the light comes through -----
flat(add(new THREE.PlaneGeometry(28, 17), M.plank, -260, 0.012, -1, world, { cast: false }));
officeWall(-260, 2);
for (const [rx, rz, rw, rh] of [[-272, -11, 7, 3.4], [-264, -12.5, 6, 4.4], [-255, -11, 7, 3.0], [-247, -12.5, 6, 4.0]]) add(tbox(rw, rh, 4, 2), cityFar, rx, rh / 2, rz, world, { cast: false });
const hillE = add(new THREE.SphereGeometry(16, 12, 8), M.hillFar, -282, 0, -36, world, { cast: false }); hillE.scale.set(1.5, 0.3, 0.7);
deskAt(-260.4, -0.9); deskAt(-257.6, 0.3, 2.2, 1.1);
chairAt(-260.4, 0.3, Math.PI); chairAt(-257.6, 1.5, Math.PI); chairAt(-263.6, -0.4, Math.PI / 2);
add(tbox(1.7, 2.1, 0.5, 2), M.wood, -265, 1.05, -3.6, world);
// the middle-right window is made of panes that burst inward as light shards (worldState-driven)
const shardMeshes = [];
const shardMat = new THREE.MeshBasicMaterial({ color: '#dff2ff', transparent: true, opacity: 0.75, side: THREE.DoubleSide });
{
  let n = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const sx = -260 + 0.05 + (c - 1.5) * 0.87, sy = 1.92 + (r - 1) * 0.6;
    const m = add(new THREE.PlaneGeometry(0.8, 0.54), shardMat, sx, sy, -5.16, world, { cast: false });
    m.userData = { x: sx, y: sy, z: -5.16, vx: ((n * 37) % 10 - 5) / 12, vy: 0.35 + ((n * 53) % 10) / 22, vz: 2.3 + ((n * 29) % 10) / 9, spin: ((n * 41) % 10 - 5) / 4 };
    m.userData.ndSkip = true; shardMeshes.push(m); n++;
  }
}

// ----- RECOVERY (x -320): a quiet room where the years go by -----
flat(add(new THREE.PlaneGeometry(21, 13), M.plank, -320, 0.012, -1, world, { cast: false }));
add(tbox(15, 3.7, 0.25, 2), M.plaster2, -320, 1.85, -4.2, world);
add(tbox(0.25, 3.7, 10, 2), M.plaster2, -326.8, 1.85, -0.4, world);
const recWinGlow = add(new THREE.PlaneGeometry(2.3, 2.5), new THREE.MeshBasicMaterial({ color: '#b8c8d4' }), -317.2, 2.15, -4.9, world, { cast: false });
recWinGlow.userData.ndSkip = true;
const recWin = add(new THREE.PlaneGeometry(1.7, 1.9), glassMat, -317.2, 2.15, -4.05, world, { cast: false }); recWin.receiveShadow = false;
add(box(1.84, 0.09, 0.09), M.wood, -317.2, 2.15, -4.02, world);
add(box(0.09, 2.0, 0.09), M.wood, -317.2, 2.15, -4.02, world);
const calTexArr = [1945, 1950, 1957, 1964, 1972, 1981, 1993, 2009].map((yr) => {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320; const g = cv.getContext('2d');
  g.fillStyle = '#f6efdc'; g.fillRect(0, 0, 256, 320); g.fillStyle = '#b03a30'; g.fillRect(0, 0, 256, 62);
  txt(g, 'CALENDAR', 128, 32, 27, '#ffffff', 700); txt(g, String(yr), 128, 138, 84, '#2c2c34');
  g.fillStyle = '#8a8272'; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) { g.beginPath(); g.arc(34 + c * 31, 216 + r * 20, 3.2, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
});
add(box(1.18, 1.42, 0.05), M.wood, -320.9, 2.3, -4.02, world);
const calBoardMesh = add(new THREE.PlaneGeometry(1.04, 1.3), new THREE.MeshToonMaterial({ gradientMap: grad, map: calTexArr[0] }), -320.9, 2.3, -3.98, world, { cast: false });
const calPageGeo = new THREE.PlaneGeometry(1.04, 1.3); calPageGeo.translate(0, -0.65, 0);
const calPageMesh = add(calPageGeo, new THREE.MeshToonMaterial({ gradientMap: grad, map: calTexArr[0], side: THREE.DoubleSide }), -320.9, 2.95, -3.94, world, { cast: false });
calPageMesh.visible = false;
deskAt(-319.6, -0.6, 2.3, 1.3);
chairAt(-320.6, 0.6, Math.PI); chairAt(-318.5, 0.55, Math.PI); chairAt(-320.7, -1.8, 0); chairAt(-318.4, -1.8, 0);
deskAt(-316.9, -1.1, 1.9, 1.0);
const recPaper = flat(add(new THREE.PlaneGeometry(0.8, 0.55), new THREE.MeshToonMaterial({ gradientMap: grad, map: draftTex }), -316.9, 0.815, -1.1, world, { cast: false }));
add(new THREE.CylinderGeometry(0.09, 0.13, 0.05, 8), M.iron, -317.55, 0.83, -1.35, world);
add(new THREE.ConeGeometry(0.16, 0.18, 10), toon({ color: '#3f5a4a' }), -317.55, 1.0, -1.35, world);
const recGlow = add(new THREE.PlaneGeometry(0.85, 0.85), MW.lampGlow, -317.55, 1.02, -1.28, world, { cast: false });
recGlow.material.opacity = 0.5; recGlow.renderOrder = 3; recGlow.userData.ndSkip = true;
add(tbox(1.5, 2.3, 0.36, 2), M.wood, -324.9, 1.15, -3.85, world);
for (let i = 0; i < 5; i++) add(box(0.16, 0.5 + (i % 3) * 0.09, 0.24), toon({ color: ['#a03a30', '#3f5a7a', '#c8a83c', '#4a6e4e', '#6e4460'][i] }), -325.35 + i * 0.24, 0.55 + Math.floor(i / 3) * 0.62, -3.82, world);
const rug = flat(add(new THREE.CircleGeometry(1.9, 20), toon({ color: '#8a5a52' }), -319.8, 0.014, -0.4, world, { cast: false }));

// ----- SPEAKING OUT (x -380): a hall, a podium, the world listening -----
add(box(34, 0.3, 9.5), toon({ color: '#5c4a38' }), -380, 0.15, -1, world);
flat(add(new THREE.PlaneGeometry(46, 10), toon({ color: '#3c3a42' }), -380, 0.006, 5.5, world, { cast: false }));
boardAt(14, 7.0, (g, w, h) => {
  g.fillStyle = '#2a4a7f'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.beginPath(); g.arc(w / 2, 215, 118, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3.5; for (const rr of [44, 80]) { g.beginPath(); g.arc(w / 2, 215, rr, 0, Math.PI * 2); g.stroke(); }
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(w / 2 + i * 46, 215 - 116); g.lineTo(w / 2 + i * 46, 215 + 116); g.stroke(); }
  g.beginPath(); g.moveTo(w / 2 - 118, 215); g.lineTo(w / 2 + 118, 215); g.stroke();
  g.lineWidth = 6; for (const sgn of [-1, 1]) { g.beginPath(); g.arc(w / 2 + sgn * 168, 232, 62, sgn > 0 ? 2.2 : -0.5, sgn > 0 ? 4.4 : 1.7, sgn < 0); g.stroke(); }
  txt(g, 'FOR PEACE', w / 2, 428, 62, '#ffffff');
}, -380, 3.45, -5.5, 1024, 560);
add(box(1.1, 1.15, 0.55), M.wood, -380, 0.875, -0.35, world);
add(box(1.28, 0.06, 0.68), M.wood, -380, 1.48, -0.35, world);
{
  const g = new THREE.Group(); g.position.set(-376.2, 0, -4.9); g.rotation.y = 0.25; world.add(g);
  const b = boardMesh(4.6, 3.2, (cg, w, h) => {
    cg.fillStyle = '#7fa8c8'; cg.fillRect(0, 0, w, h);
    cg.strokeStyle = 'rgba(255,255,255,0.35)'; cg.lineWidth = 2;
    for (let i = 1; i < 6; i++) { cg.beginPath(); cg.moveTo(i * w / 6, 0); cg.lineTo(i * w / 6, h); cg.stroke(); cg.beginPath(); cg.moveTo(0, i * h / 5); cg.lineTo(w, i * h / 5); cg.stroke(); }
    cg.fillStyle = '#5c8a4c';
    const blob = (pts) => { cg.beginPath(); cg.moveTo(pts[0][0] * w, pts[0][1] * h); for (const [px, py] of pts.slice(1)) cg.lineTo(px * w, py * h); cg.closePath(); cg.fill(); };
    blob([[.04, .3], [.2, .2], [.26, .34], [.2, .5], [.12, .62], [.16, .78], [.22, .8], [.2, .6], [.08, .48]]);
    blob([[.4, .16], [.52, .12], [.56, .24], [.48, .3], [.42, .26]]);
    blob([[.44, .34], [.54, .34], [.56, .5], [.5, .68], [.45, .52]]);
    blob([[.58, .18], [.78, .14], [.9, .28], [.84, .42], [.7, .4], [.6, .3]]);
    blob([[.8, .62], [.88, .6], [.9, .72], [.83, .74]]);
    cg.fillStyle = '#d84a3c'; cg.beginPath(); cg.arc(.9 * w, .3 * h, 13, 0, Math.PI * 2); cg.fill();
    cg.strokeStyle = '#ffffff'; cg.lineWidth = 3; cg.beginPath(); cg.arc(.9 * w, .3 * h, 20, 0, Math.PI * 2); cg.stroke();
  }); b.position.y = 2.7; g.add(b);
  const l1 = add(box(0.09, 2.2, 0.09), M.wood, -1.6, 0.9, -0.2, g); l1.rotation.z = 0.3;
  const l2 = add(box(0.09, 2.2, 0.09), M.wood, 1.6, 0.9, -0.2, g); l2.rotation.z = -0.3;
}

// ----- RECOGNITION (x -440): the certificate, at last -----
const plaza = flat(add(new THREE.CircleGeometry(9.5, 26), M.marble, -440, 0.012, -0.5, world, { cast: false }));
for (let i = 0; i < 5; i++) { const b = add(new THREE.SphereGeometry(1.5, 9, 7), M.bush, -447 + i * 3.6, 0.5, -6.5, world); b.scale.y = 0.65; }
boardAt(6.6, 4.5, (g, w, h) => {
  g.fillStyle = '#f8f2df'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b08a4a'; g.lineWidth = 12; g.strokeRect(22, 22, w - 44, h - 44);
  g.lineWidth = 3; g.strokeRect(48, 48, w - 96, h - 96);
  txt(g, 'C E R T I F I C A T E', w / 2, 108, 46, '#8a6a34', 700);
  txt(g, 'DOUBLE SURVIVOR', w / 2, 218, 70, '#2c2c34');
  txt(g, 'OFFICIALLY RECOGNISED • 2009', w / 2, 308, 36, '#6a625a', 700);
  g.fillStyle = '#b03a30'; g.beginPath(); g.arc(w / 2, 400, 42, 0, Math.PI * 2); g.fill();
  txt(g, '★', w / 2, 402, 52, '#ffffff');
}, -440, 3.1, -4.5, 1024, 700);
for (const bx of [-445.6, -434.4]) {
  add(new THREE.CylinderGeometry(0.05, 0.05, 4.6, 6), M.iron, bx, 2.3, -3, world);
  add(box(1.15, 2.7, 0.06), M.red, bx + (bx < -440 ? 0.62 : -0.62), 3.2, -3, world);
}
for (const [fx2, fz2, fc] of [[-443.2, -1.2, '#d86a8a'], [-436.8, -1.2, '#e8c84a'], [-443.6, 1.8, '#e8e4da'], [-436.4, 1.8, '#d86a8a']]) {
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), M.cypress, fx2, 0.25, fz2, world, { cast: false });
  add(new THREE.SphereGeometry(0.14, 8, 6), toon({ color: fc }), fx2, 0.56, fz2, world, { cast: false });
}

// ----- LEGACY (x -500): dawn over Nagasaki bay, and one small paper crane -----
flat(add(new THREE.PlaneGeometry(48, 17), sandMat, -500, 0.011, 7.5, world, { cast: false }));
flat(add(new THREE.PlaneGeometry(175, 125), waterFlat, -500, 0.005, -60, world, { cast: false }));
for (const [hx, hz, hs] of [[-548, -62, 34], [-500, -74, 44], [-452, -62, 32], [-522, -48, 17]]) { const m = add(new THREE.SphereGeometry(10, 12, 8), M.hillFar, hx, 0, hz, world, { cast: false }); m.scale.set(hs / 9, hs / 40, hs / 13); }
boardAt(6.6, 3.1, (g, w, h) => {
  g.fillStyle = '#232c44'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8a84a'; g.lineWidth = 9; g.strokeRect(16, 16, w - 32, h - 32);
  txt(g, 'HE LIVED TO 93', w / 2, h / 2 - 28, 82, '#ffd98a'); txt(g, '1916 — 2010', w / 2, h / 2 + 62, 46, '#b9c4de', 700);
}, -500, 3.4, -8);
add(box(1.7, 0.07, 1.0), M.wood, -496.8, 0.72, 4.2, world);
for (const [lx, lz] of [[-497.5, 3.85], [-496.1, 3.85], [-497.5, 4.55], [-496.1, 4.55]]) add(box(0.07, 0.72, 0.07), M.wood, lx, 0.36, lz, world);
const craneG = new THREE.Group(); craneG.position.set(-496.8, 0.755, 4.2); craneG.rotation.y = -0.5; world.add(craneG);
const paperMat = new THREE.MeshToonMaterial({ gradientMap: grad, color: '#f8f5ee', side: THREE.DoubleSide });
{
  const body = add(new THREE.ConeGeometry(0.13, 0.58, 4), paperMat, 0, 0.1, 0, craneG, { cast: false }); body.rotation.z = Math.PI / 2 - 0.18; body.scale.set(1, 1, 0.5);
  const wgl = add(new THREE.PlaneGeometry(0.52, 0.32), paperMat, -0.02, 0.24, 0.1, craneG, { cast: false }); wgl.rotation.set(-0.62, 0, 0.35);
  const wgr = add(new THREE.PlaneGeometry(0.52, 0.32), paperMat, -0.02, 0.24, -0.1, craneG, { cast: false }); wgr.rotation.set(0.62, 0, 0.35);
  const neck = add(new THREE.ConeGeometry(0.045, 0.34, 4), paperMat, 0.3, 0.24, 0, craneG, { cast: false }); neck.rotation.z = -0.7;
  const tail = add(new THREE.ConeGeometry(0.06, 0.3, 4), paperMat, -0.3, 0.2, 0, craneG, { cast: false }); tail.rotation.z = 1.1;
}
treeAt(-506, 3, 1.3, M.pine); treeAt(-493.5, 6.5, 0.9);

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
  tramG.position.x = W.tramX || 0;
  for (const p of fireGlows) p.material.opacity = (W.fireA || 0) * (0.52 + 0.18 * Math.sin(f * 0.6 + p.userData.ph));
  poleMeshes.forEach((p, i) => { p.position.z = -54 + ((i * 9 + (W.scroll || 0)) % 126); });
  for (const sm of shardMeshes) {
    const u = sm.userData, t = W.shardT || 0;
    if (t <= 0) { sm.position.set(u.x, u.y, u.z); sm.rotation.set(0, 0, 0); }
    else { const d = t * 2.6; sm.position.set(u.x + u.vx * d, Math.max(0.06, u.y + u.vy * d - 2.4 * t * t), u.z + u.vz * d); sm.rotation.set(-Math.min(1, t * 1.5) * Math.PI / 2, 0, u.spin * t * 3); }
  }
  calBoardMesh.material.map = calTexArr[W.calShow ?? 0];
  calPageMesh.material.map = calTexArr[W.calPage ?? 0];
  calPageMesh.rotation.x = -(W.calF || 0) * 1.85;
  calPageMesh.visible = (W.calF || 0) > 0.001;
  suitcaseG.visible = !!W.packed;
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
