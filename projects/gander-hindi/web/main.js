import * as THREE from './lib/three.module.js';
import * as T0 from './toon.js';
import { ganderCard, fxSpark } from './extras.js';
const T = { ...T0, ganderCard, fxSpark };
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARDS } from './story.js';

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

const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(31), 8, 3), beam: texM(P.beam(32), 1, 2), beamDark: texM(P.beam(33, [40, 34, 28]), 1, 2),
  stone: texM(P.stone(34), 1, 1), dirt: texM(P.dirt(35), 6, 6, '#a08b64'),
  panel: texM(P.panelMetal(36, [70, 76, 84]), 3, 1, '#98a2ae'),
};
const MW = {
  iron: toon({ color: '#2c2e33' }), rope: toon({ color: '#a8895a' }), canvasM: toon({ color: '#6a7052' }),
  white: toon({ color: '#eef2f6' }), gold: toon({ color: '#c9973f' }), ribbon: toon({ color: '#7a2430' }),
  dark: toon({ color: '#2e2c30' }), brass: toon({ color: '#a87f34' }),
  shade: new THREE.MeshBasicMaterial({ color: 0x14202c, transparent: true, opacity: 0.22, depthWrite: false }),
};
// sea: animated canvas texture
const seaCv = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#31566b'; g.fillRect(0, 0, 256, 256); const r = P.rng(77); for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(190,220,235,${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 1.6; const y = r() * 256, x = r() * 256, l = 8 + r() * 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * 3); g.stroke(); } return c; })();
const seaTex = new THREE.CanvasTexture(seaCv); seaTex.colorSpace = THREE.SRGBColorSpace; seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping; seaTex.repeat.set(16, 16);
const seaMat = toon({ map: seaTex, color: '#9fc4d8' });

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

const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

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

// ---------- the dock set ----------
const world = new THREE.Group(); scene.add(world);
{ // sea all around, below dock level
  const sea = flat(add(new THREE.CircleGeometry(90, 36), seaMat, 0, -0.55, -6, world, { cast: false }));
  sea.receiveShadow = false;
  // the dock: heavy plank deck
  add(tbox(26, 0.5, 9, 2), M.plank, 0, -0.25, 0.5, world, { cast: false });
  add(tbox(26, 0.34, 0.5, 2), M.beamDark, 0, -0.42, 5.1, world, { cast: false });
  for (let x = -11; x <= 11; x += 2.75) { const pile = add(new THREE.CylinderGeometry(0.22, 0.24, 2.2, 8), M.beamDark, x, -1.2, 4.6, world, { cast: false }); }
  // far quay + harbour warehouses (depth)
  add(tbox(30, 0.6, 5, 2), M.stone, -4, -0.3, -12, world, { cast: false });
  for (const [wx, ww, wh] of [[-9, 5, 3.2], [-3.4, 4, 2.6], [2.4, 5.4, 3.6], [8.6, 4.4, 2.9]]) {
    add(tbox(ww, wh, 3, 2), M.panel, wx, wh / 2, -13.5, world, { cast: false });
    const rf = add(tbox(ww + 0.4, 0.12, 3.6, 2), M.beamDark, wx, wh + 0.35, -13.5, world, { cast: false }); rf.rotation.x = 0.3;
  }
}
// the troop ship at anchor (fx.ship), smoke from her funnel
const shipG = FX.ship({ hull: '#3d4652', trim: '#8a4a3a' });
shipG.position.set(-16, -0.4, -22); shipG.rotation.y = 0.5; shipG.scale.setScalar(1.5); world.add(shipG);
// dockside dressing: crates, barrels, rope coils, bollards
{
  const crate = FX.crate3(0.95); crate.position.set(-4.4, 0, -2.6); crate.rotation.y = 0.4; world.add(crate);
  const crate2 = FX.crate3(0.7); crate2.position.set(-4.3, 0.95, -2.6); crate2.rotation.y = 1.0; world.add(crate2);
  const barrel = FX.barrel3(0.9); barrel.position.set(-5.5, 0, -2.2); world.add(barrel);
  const barrel2 = FX.barrel3(0.9); barrel2.position.set(6.2, 0, -2.8); world.add(barrel2);
  const crate3b = FX.crate3(1.1); crate3b.position.set(5.4, 0, -3.1); crate3b.rotation.y = -0.3; world.add(crate3b);
  for (const [rx2, rz] of [[3.4, 3.4], [-2.2, 3.8]]) {
    const coil = add(new THREE.TorusGeometry(0.34, 0.09, 8, 20), MW.rope, rx2, 0.09, rz, world, { cast: false }); coil.rotation.x = Math.PI / 2;
    const coil2 = add(new THREE.TorusGeometry(0.26, 0.08, 8, 18), MW.rope, rx2, 0.24, rz, world, { cast: false }); coil2.rotation.x = Math.PI / 2;
  }
  for (const bx of [-7.5, 8.2]) { add(new THREE.CylinderGeometry(0.13, 0.17, 0.55, 10), MW.iron, bx, 0.27, 4.2, world, { cast: false }); add(new THREE.SphereGeometry(0.16, 9, 7), MW.iron, bx, 0.58, 4.2, world, { cast: false }); }
}
// the Sergeant's kit pile (P2): kitbag, helmet, pack, rifle leaning on a crate
const kitG = new THREE.Group(); kitG.position.set(2.3, 0, -1.2); world.add(kitG);
{
  const bag = add(new THREE.SphereGeometry(0.42, 11, 9), MW.canvasM, 0, 0.3, 0, kitG, { cast: false }); bag.scale.set(1, 0.78, 1);
  add(new THREE.CylinderGeometry(0.13, 0.16, 0.22, 9), MW.canvasM, 0, 0.68, 0, kitG, { cast: false });
  const helm = add(new THREE.SphereGeometry(0.3, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), toon({ color: '#5a6252' }), 0.62, 0.06, 0.3, kitG, { cast: false }); helm.scale.y = 0.62;
  add(new THREE.CylinderGeometry(0.36, 0.38, 0.04, 14), toon({ color: '#525a4a' }), 0.62, 0.05, 0.3, kitG, { cast: false });
  add(tbox(0.5, 0.62, 0.24, 2), M.beamDark, -0.55, 0.31, -0.2, kitG, { cast: false });
  const rifle = new THREE.Group(); rifle.position.set(-0.85, 0, 0.35); rifle.rotation.z = 0.5; kitG.add(rifle);
  add(new THREE.CylinderGeometry(0.028, 0.034, 1.25, 7), MW.dark, 0, 0.62, 0, rifle, { cast: false });
  add(tbox(0.07, 0.42, 0.05, 2), M.beamDark, 0, 0.2, 0, rifle, { cast: false });
}
// the live GRENADE prop (position driven by story worldAt)
const grenadeG = new THREE.Group(); world.add(grenadeG);
{
  const body = add(new THREE.SphereGeometry(0.075, 10, 9), toon({ color: '#4a5a3a' }), 0, 0, 0, grenadeG, { cast: false }); body.scale.y = 1.25;
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.07, 8), toon({ color: '#6a6f5a' }), 0, 0.11, 0, grenadeG, { cast: false });
  grenadeG.visible = false;
}
// ---- harbour sign post carries hook + away boards ----
const sign = new THREE.Group(); sign.position.set(0.2, 0, -1.9); sign.rotation.y = 0.1; world.add(sign);
{
  add(new THREE.CylinderGeometry(0.06, 0.075, 2.5, 8), M.beamDark, 0, 1.25, -0.08, sign, { cast: false });
  add(tbox(1.9, 0.1, 0.34, 2), M.beamDark, 0, 2.5, -0.04, sign, { cast: false });
}
const boardMeshes = {};
{
  const b = textBoard(['सेंट जॉन्स', '1941'], 1.15, 0.78, '#37455c', '#e8eef8'); b.position.set(0, 1.5, 0); sign.add(b); boardMeshes.hook = b;
  const shore = textBoard(['लाइ मुन', 'हांगकांग'], 1.2, 0.8, '#4a3a28', '#ffe9a8');
  shore.position.set(0, 1.35, 0); boardMeshes.away = shore; // attached to the shore post when it is built (battle-shore section below)
}
// ---- memorial plaque + the medal (finale, on the quay wall near the dock) ----
const plaque = new THREE.Group(); plaque.position.set(-3.2, 0, 2.2); plaque.rotation.y = 0.42; world.add(plaque);
{
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 7), M.beamDark, sd * 0.42, 0.85, -0.06, plaque, { cast: false });
  const b = textBoard(['गैंडर', 'डिकिन मेडल'], 0.95, 0.68, '#3c3428', '#ffd98a'); b.position.set(0, 1.22, 0); plaque.add(b); boardMeshes.medal = b;
  // the medal: bronze disc on a red-white ribbon, hung below the plaque face
  const ribbon = add(tbox(0.1, 0.3, 0.02, 2), MW.ribbon, 0, 0.72, 0.03, plaque, { cast: false });
  const disc = add(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20), MW.brass, 0, 0.5, 0.03, plaque, { cast: false }); disc.rotation.x = Math.PI / 2;
  const star = add(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 5), MW.gold, 0, 0.5, 0.045, plaque, { cast: false }); star.rotation.x = Math.PI / 2;
}
// ---------- the Lye Mun shore (battle zone, x 14..30 — never framed with the dock) ----------
{
  add(tbox(20, 0.06, 13, 2), M.dirt, 22.5, -0.03, -0.5, world, { cast: false });
  const rockM = toon({ color: '#6a6e72' }), rockD = toon({ color: '#54575c' });
  const r = P.rng(88);
  for (const [rx2, rz, rs] of [[16.5, -4.6, 1.3], [19.8, -5.2, 1.8], [24.6, -4.8, 1.5], [27.5, -3.9, 1.1], [17.8, 3.4, 0.9], [26.2, 3.1, 1.2], [15.8, -1.8, 0.7]]) {
    const rock = add(new THREE.DodecahedronGeometry(rs, 0), r() > 0.5 ? rockM : rockD, rx2, rs * 0.4, rz, world, { cast: false });
    rock.scale.y = 0.62; rock.rotation.set(r() * 2, r() * 3, r() * 2);
  }
  for (const [bx, bz] of [[18.6, -3.4], [23.4, -3.8], [28.6, -1.4], [20.4, 2.6], [25.8, 2.2]]) { // scrub bushes
    const b1 = add(new THREE.SphereGeometry(0.55 + r() * 0.3, 9, 7), toon({ color: '#44543a' }), bx, 0.3, bz, world, { cast: false }); b1.scale.y = 0.6;
    const b2 = add(new THREE.SphereGeometry(0.4, 8, 6), toon({ color: '#39492f' }), bx + 0.5, 0.24, bz + 0.3, world, { cast: false }); b2.scale.y = 0.6;
  }
  // ruined wall the wounded shelter behind
  add(tbox(3.4, 1.05, 0.5, 2), M.stone, 20.6, 0.52, -2.6, world, { cast: false });
  add(tbox(1.2, 0.6, 0.5, 2), M.stone, 22.7, 0.3, -2.55, world, { cast: false });
  add(tbox(0.8, 0.42, 0.44, 2), M.stone, 19.2, 0.21, -2.2, world, { cast: false }).rotation.y = 0.5;
  // dark hills behind the shore
  const hillM = toon({ color: '#3d4a42' });
  for (const [hx, hz, hw, hh] of [[18, -13, 16, 6], [27, -14, 18, 7.5], [36, -12, 14, 5.5]]) {
    const cone = add(new THREE.ConeGeometry(hw / 2, hh, 6), hillM, hx, hh / 2 - 0.4, hz, world, { cast: false }); cone.scale.z = 0.45;
  }
  // two stretchers for the wounded (beds the men lie beside)
  for (const [sx, sz, sa] of [[20.9, -1.35, 0.25], [22.3, -0.5, -0.3]]) {
    const st = new THREE.Group(); st.position.set(sx, 0, sz); st.rotation.y = sa; world.add(st);
    add(tbox(1.9, 0.05, 0.55, 2), toon({ color: '#7a6a4a' }), 0, 0.16, 0, st, { cast: false });
    for (const sd of [-1, 1]) { const pole = add(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), M.beamDark, 0, 0.13, sd * 0.3, st, { cast: false }); pole.rotation.z = Math.PI / 2; }
    for (const [lx, lz] of [[-0.8, -0.22], [0.8, -0.22], [-0.8, 0.22], [0.8, 0.22]]) add(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 5), MW.iron, lx, 0.07, lz, st, { cast: false });
  }
  // shore location post (the LYE MUN board)
  const post = new THREE.Group(); post.position.set(22.6, 0, -3.1); post.rotation.y = -0.15; world.add(post);
  add(new THREE.CylinderGeometry(0.05, 0.065, 1.9, 7), M.beamDark, 0, 0.95, -0.05, post, { cast: false });
  post.userData.isShorePost = true;
  world.userData.shorePost = post;
  post.add(boardMeshes.away);
}
// dock lamps (raid night they burn low and orange)
const lampGlows = [];
for (const [lx, lz] of [[-6.4, 3.6], [6.8, 3.4]]) {
  add(new THREE.CylinderGeometry(0.05, 0.065, 2.6, 7), MW.iron, lx, 1.3, lz, world, { cast: false });
  add(new THREE.SphereGeometry(0.13, 9, 7), MW.white, lx, 2.68, lz, world, { cast: false });
  const gl = FX.glint(0.9); gl.position.set(lx, 2.68, lz); gl.userData.ndSkip = true; world.add(gl); lampGlows.push(gl);
}

// ---------- FX: ship smoke + clouds + sea mist ----------
const smoke = new FX.Smoke(scene, 80); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const shipSmoke = smoke.addEmitter(-19.5, 5.6, -24.5, { rate: 0, color: 0xcfd4d8, opacity: 0.32, scale: 0.9, grow: 2.2, life: 3.2, vy: 1.1, wind: 1.6 });
const blast = smoke.addEmitter(27.5, 0.5, -1.2, { rate: 0, color: 0xd8d2c4, opacity: 0.5, scale: 0.8, grow: 2.6, life: 1.6, vy: 1.6, wind: 0.8 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 58, opacity: 0.22, color: 0xdfe4e8, drift: 0.35 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const mist = FX.mistBand(scene, { y: 0.4, opacity: 0.0, count: 10 });
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
    shipSmoke.rate = pr.smokeRate || 0;
    blast.rate = pr.blastRate || 0;
    smoke.update(t, dt);
    fxClouds.update(t, dt);
  }
};

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('16,24,32', 0.6));
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
  seaTex.offset.set((f * 0.0006) % 1, (f * 0.00021) % 1);
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardMeshes.hook, Ws.boardHook || 0); setB(boardMeshes.away, Ws.boardAway || 0); setB(boardMeshes.medal, Ws.boardMedal || 0);
  if ((Ws.grenadeT || 0) > 0 && Ws.grenadePos) { grenadeG.visible = true; grenadeG.position.set(...Ws.grenadePos); grenadeG.rotation.z = f * 0.35; grenadeG.rotation.x = f * 0.22; }
  else grenadeG.visible = false;
  lampGlows.forEach((gl, i) => { gl.material.opacity = (Ws.lampT || 0) * (0.5 + 0.18 * Math.sin(f * 0.4 + i * 2.1)); });
  if (mist) mist.children.forEach((m) => { if (m.material) m.material.opacity = (Ws.mistT || 0) * 0.15; });
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
window.boardNDC = (f) => {
  const C = camAt(f);
  const cam = new THREE.PerspectiveCamera(C.fov, W / H, 0.08, 1500);
  cam.position.set(...C.pos); cam.up.set(0, 1, 0); cam.lookAt(...C.look); cam.rotateZ(rx(C.roll || 0));
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const Ws = worldAt(f);
  return BOARDS.map((b) => {
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    const right = [cy, 0, -sy], up = [0, 1, 0];
    const corners = [];
    for (const [sx, sy2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = new THREE.Vector3(
        b.pos[0] + right[0] * sx * b.w / 2 + up[0] * sy2 * b.h / 2,
        b.pos[1] + right[1] * sx * b.w / 2 + up[1] * sy2 * b.h / 2,
        b.pos[2] + right[2] * sx * b.w / 2 + up[2] * sy2 * b.h / 2);
      const n = p.clone().project(cam);
      corners.push([+n.x.toFixed(3), +n.y.toFixed(3), +(p.distanceTo(cam.position)).toFixed(2)]);
    }
    return { id: b.id, op: b.key ? (Ws[b.key] || 0) : 1, corners };
  });
};
window.TOTAL = TOTAL;
window.ready = true;
