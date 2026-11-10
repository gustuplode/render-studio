import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, fxProfileAt } from './story.js';

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
  stone: texM(P.stone(4), 1, 1), dirt: texM(P.dirt(7), 6, 30),
  sand: texM(P.dirt(11), 34, 34, '#c9a468'), plaster: texM(P.plaster(8), 1, 1),
  trunk: toon({ color: '#6a4a32' }), window: toon({ color: '#2b2430' }),
  iron: toon({ color: '#5c5a57' }), darkMetal: toon({ color: '#3c4148' }),
};
const MW = {
  khakiTent: toon({ color: '#8a8558' }), canvasLight: toon({ color: '#a49d7d' }),
  darkIn: toon({ color: '#20211c' }), palmLeaf: toon({ color: '#33523f' }),
  pyramid: toon({ color: '#2e3d59' }), bushDry: toon({ color: '#5a5a3a' }), rock: toon({ color: '#7d6a4f' }),
  lampGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,190,110', 0.85)), transparent: true, fog: false, depthWrite: false }),
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
const ndSkip = (o) => { o.traverse((m) => { m.userData.ndSkip = true; }); };

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

// ---------- world: Polish camp in Egypt, night ----------
// Camp layout (y=0 sand): campfire (0,0,-0.5) - Wojtek tent (-3.2,0,-3.4) - shower tent
// (4.4,0,-2.2) + side screen (3.8,0,-1.45) - ammo crates (2.6,0,-1.35) - trip crate (2.18,0,-0.5)
// - lantern posts L1(-2.4,1.9) L2(2.3,1.7) L3(-4.6,-1.2) L4(5.0,-0.7) - palms + pyramids behind.
const DECK = 6; // legacy constant: only the card-blob default in drawActors reads it; every actor sets ground:0
const world = new THREE.Group(); scene.add(world);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };

const ground = flat(add(new THREE.CircleGeometry(95, 40), M.sand, 0, 0, 0, world, { cast: false }));
flat(add(new THREE.CircleGeometry(4.4, 20), M.dirt, 0.2, 0.012, -0.4, world, { cast: false }));
flat(add(new THREE.CircleGeometry(2.2, 16), M.dirt, -3.1, 0.013, -3.2, world, { cast: false }));
flat(add(new THREE.CircleGeometry(1.9, 16), M.dirt, 4.3, 0.013, -2.1, world, { cast: false }));
{ const r = P.rng(41); for (let i = 0; i < 12; i++) { const s = add(new THREE.SphereGeometry(0.06 + r() * 0.08, 7, 6), MW.rock, -9 + r() * 18, 0.04, -8 + r() * 11, world, { cast: false }); s.scale.y = 0.6; } }

// tents (v4 prism design, khaki canvas) + a dark interior card-plane behind the doorway
const tentAt = (x, z, ry = 0, s = 1) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s); world.add(g);
  for (const sd of [-1, 1]) { const sl = add(tbox(1.55, 0.07, 2.7, 2), MW.khakiTent, sd * 0.62, 0.78, 0, g); sl.rotation.z = -sd * 0.72; }
  add(tbox(0.08, 0.8, 2.7, 1), M.beamDark, 0, 0.4, -1.32, g);
  add(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6), M.beamDark, 0, 0.85, 1.3, g, { cast: false });
  add(box(1.15, 0.72, 0.08), MW.darkIn, 0, 0.36, 0.5, g, { cast: false });
  return g;
};
tentAt(-3.2, -3.4, 0.25, 1.3);   // Wojtek's tent
tentAt(3.6, -3.9, -0.2); tentAt(-0.6, -6.6, 0.05); tentAt(8.2, -0.9, -0.9); tentAt(-5.6, -0.8, 0.7); // (5.4,-0.6) tent moved right: its roof filled the spy-cam foreground in f370/f550

// campfire: stone ring + logs (the flame/smoke are FX, below)
for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, s = add(new THREE.SphereGeometry(0.16, 8, 6), MW.rock, Math.cos(a) * 0.55, 0.07, -0.5 + Math.sin(a) * 0.55, world, { cast: false }); s.scale.y = 0.7; }
for (let i = 0; i < 3; i++) { const l = add(new THREE.CylinderGeometry(0.055, 0.065, 0.85, 7), M.beamDark, 0, 0.12, -0.5, world, { cast: false }); l.rotation.z = Math.PI / 2; l.rotation.y = i * 1.05; }

// shower tent: canvas hut + water tank on top + cloth curtain
const showerG = new THREE.Group(); showerG.position.set(4.4, 0, -2.2); showerG.rotation.y = -0.35; world.add(showerG);
{
  for (const [px, pz] of [[-0.78, -0.78], [0.78, -0.78], [-0.78, 0.78], [0.78, 0.78]]) add(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 7), M.beamDark, px, 1.15, pz, showerG);
  add(tbox(1.62, 1.9, 0.06, 2), MW.khakiTent, 0, 0.95, -0.78, showerG);                    // back wall
  add(tbox(0.06, 1.9, 1.6, 2), MW.khakiTent, -0.79, 0.95, 0, showerG);                    // left wall
  add(tbox(0.06, 1.9, 0.85, 2), MW.khakiTent, 0.79, 0.95, -0.38, showerG);                // right wall (front part open)
  add(box(1.5, 1.8, 0.04), MW.darkIn, 0, 0.9, -0.72, showerG, { cast: false });            // dark interior backing
  const roof = add(tbox(1.85, 0.07, 1.85, 2), MW.canvasLight, 0, 2.06, 0, showerG); roof.rotation.z = 0.05;
  add(new THREE.CylinderGeometry(0.52, 0.52, 0.46, 14), M.darkMetal, 0, 2.42, -0.1, showerG); // water tank
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), M.iron, 0.3, 1.85, -0.1, showerG, { cast: false }); // pipe
  const head = add(new THREE.ConeGeometry(0.11, 0.12, 10), M.iron, 0.3, 1.62, -0.1, showerG, { cast: false }); head.rotation.x = Math.PI;
}
const curtainGeo = new THREE.PlaneGeometry(1.0, 1.5, 8, 8); curtainGeo.translate(0, -0.75, 0);
const curtain = new THREE.Mesh(curtainGeo, new THREE.MeshLambertMaterial({ color: '#a49d7d', side: THREE.DoubleSide }));
curtain.position.set(-0.34, 1.62, 0.8); curtain.castShadow = true; showerG.add(curtain);
FX.clothInit(curtain, { amp: 0.07, freq: 2.4, speed: 3.2 });
// the low side screen Wojtek hides/rises behind
{
  const g = new THREE.Group(); g.position.set(3.8, 0, -1.45); g.rotation.y = 0.5; world.add(g);
  for (const sd of [-0.62, 0.62]) add(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 7), M.beamDark, sd, 0.57, 0, g);
  add(tbox(1.35, 1.0, 0.05, 2), MW.canvasLight, 0, 0.56, 0, g);
  add(tbox(1.1, 0.16, 0.1, 1), M.plaster, -0.05, 1.1, 0, g, { cast: false }); // draped towel
}
// flag pole + waving flag (cloth)
add(new THREE.CylinderGeometry(0.04, 0.05, 3.4, 7), M.beamDark, -1.9, 1.7, -5.6, world);
const flagGeo = new THREE.PlaneGeometry(1.15, 0.72, 10, 6); flagGeo.translate(0.575, 0, 0);
const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: '#a83226', side: THREE.DoubleSide }));
flag.position.set(-1.88, 3.02, -5.6); flag.castShadow = true; world.add(flag);
FX.clothInit(flag, { amp: 0.15, freq: 3.0, speed: 6.5 });

// palms (silhouette duty) + pyramids + dry bushes
const palmTops = [];
const palmAt = (x, z, h = 4.6) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  const t1 = add(new THREE.CylinderGeometry(0.09, 0.14, h * 0.6, 7), M.trunk, 0, h * 0.3, 0, g, { cast: false }); t1.rotation.z = 0.1;
  const top = new THREE.Group(); top.position.set(h * 0.6 * 0.1 + 0.1, h * 0.6, 0); g.add(top);
  const t2 = add(new THREE.CylinderGeometry(0.07, 0.09, h * 0.45, 7), M.trunk, 0, h * 0.2, 0, top, { cast: false }); t2.rotation.z = 0.16;
  const fr = new THREE.Group(); fr.position.set(0.18, h * 0.44, 0); top.add(fr);
  for (let i = 0; i < 6; i++) { const c = add(new THREE.ConeGeometry(0.17, 2.1, 5), MW.palmLeaf, 0, 0, 0, fr, { cast: false }); c.rotation.order = 'YXZ'; c.rotation.y = i / 6 * Math.PI * 2; c.rotation.z = 1.95; c.position.y = 0.15; }
  palmTops.push(fr);
  return g;
};
palmAt(-7.5, -4.5); palmAt(8, -5.5, 5.2); palmAt(-6, -9.5, 4.0); palmAt(10.5, -1, 5.6); palmAt(6.5, -10.5, 4.4);
const pyr1 = add(new THREE.ConeGeometry(46, 26, 4), MW.pyramid, -55, 13, -165, world, { cast: false }); pyr1.rotation.y = Math.PI / 4;
const pyr2 = add(new THREE.ConeGeometry(60, 32, 4), MW.pyramid, 48, 16, -185, world, { cast: false }); pyr2.rotation.y = Math.PI / 4;
{ const hillM = toon({ color: '#26334d' }); for (const [hx, hy, hz, hr] of [[-52, -6, -46, 18], [-26, -7, -40, 14], [0, -6, -48, 20], [28, -7, -42, 15], [54, -6, -50, 19]]) { const h = add(new THREE.SphereGeometry(hr, 16, 10), hillM, hx, hy, hz, world, { cast: false }); h.scale.y = 0.5; } }
for (const [bx, bz] of [[-8.5, 1.5], [9.5, 2.5], [-10, -6], [12, -7]]) { const b = add(new THREE.SphereGeometry(0.55, 8, 6), MW.bushDry, bx, 0.22, bz, world, { cast: false }); b.scale.set(1.3, 0.55, 1.3); }

// stars (points dome) + moon halo — sky shader draws the moon disc itself from az/el
const starGeo = new THREE.BufferGeometry();
{
  const r = P.rng(7), pos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    const th = r() * Math.PI * 2, y = 0.1 + r() * 0.9, rr = Math.sqrt(1 - y * y) * 430;
    pos[i * 3] = Math.cos(th) * rr; pos[i * 3 + 1] = y * 430; pos[i * 3 + 2] = Math.sin(th) * rr;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat); stars.userData.ndSkip = true; scene.add(stars);

// ---------- FX (Coded FX Library) — every sprite/particle system is ndSkip:
// hidden in the normal/depth pass exactly like the kit's clouds/blobs, else ink/DOF artifacts.
const smoke = new FX.Smoke(scene, 110); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const smokeEmit = smoke.addEmitter(0, 0.55, -0.5, { rate: 7, color: 0x9aa0a8, opacity: 0.17, scale: 0.44, grow: 1.1, life: 2.0, vy: 1.2, wind: 0.3 }); // camp-scale wisps: ship-scale puffs veiled the whole set (washed the f170 sky + flag pale); kept faint so the radial puffs don't read as discrete discs
const fire = new FX.Fire(scene, { x: 0, y: 0.16, z: -0.5, scale: 1, rate: 22, light: true, max: 36 });
fire.pool.forEach((p) => { p.s.userData.ndSkip = true; });
if (fire.light) { fire.light.userData.ndSkip = true; fire.light.distance = 8; } // library intensity is tuned for open sea; tamed per-step in fxStepTo
const splashes = new FX.Splashes(scene, 300); splashes.points.userData.ndSkip = true; splashes.points.material.size = 0.3;
const fxClouds = new FX.Clouds(scene, { count: 5, y: 55, opacity: 0.3, color: 0x8799bd, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
// low mist band, repositioned onto the spy's lane through the camp
const mist = FX.mistBand(scene, { count: 7, y: 0.8, opacity: 0.3 });
mist.children.forEach((s, i) => {
  s.position.set(-2 + i * 1.5, 0.55 + (i % 3) * 0.22, -1.2 - (i % 2) * 1.3);
  s.scale.set(9 + (i % 3) * 3, 2.2, 1);
  s.userData.bx = s.position.x; s.userData.ndSkip = true;
});
// ammo crates (FX wood) — real geometry: stays in the ND pass, takes ink + shadows
const fxCrateAt = (x, y, z, ry, size = 0.62) => {
  const c = FX.crate(size); c.position.set(x, y, z); c.rotation.y = ry;
  c.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  world.add(c); return c;
};
fxCrateAt(2.45, 0.31, -1.3, 0.2); fxCrateAt(3.1, 0.31, -1.45, -0.15); fxCrateAt(2.75, 0.93, -1.38, 0.4);
fxCrateAt(-1.5, 0.31, -4.9, 0.5); fxCrateAt(5.9, 0.31, -2.9, -0.3);
// the trip crate: pivoted at its base so worldState can tip it over
const tripCrate = new THREE.Group(); tripCrate.position.set(2.18, 0, -0.5); world.add(tripCrate);
{ const c = FX.crate(0.58); c.position.y = 0.29; c.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); tripCrate.add(c); }
// honey jar crate + the glass honey jar (glassMat + glint), in front of Wojtek's honey spot
fxCrateAt(0.3, 0.25, 0.95, 0.15, 0.5);
const jarG = new THREE.Group(); jarG.position.set(0.3, 0.5, 0.95); world.add(jarG);
{
  const honey = add(new THREE.CylinderGeometry(0.135, 0.145, 0.3, 12), toon({ color: '#4a2c04' }), 0, 0.16, 0, jarG, { cast: false }); // very deep amber: golden sun (~2.5x total light) + glass blend lands it at rich honey, not cream
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.32, 14), FX.glassMat(0xffe9c0, 0.22));
  glass.material.shininess = 60; glass.material.specular = new THREE.Color(0x332211); // weak, warm glass: the library's bright blue-white specular (shininess 160) milked the jar white in morning light
  glass.position.y = 0.16; glass.userData.ndSkip = true; jarG.add(glass);
  add(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 14), M.beamDark, 0, 0.345, 0, jarG, { cast: false });
}
const jarGlint = FX.glint(0.6); jarGlint.position.set(0.10, 0.30, 0.15); jarGlint.material.opacity = 0; jarGlint.userData.ndSkip = true; jarG.add(jarGlint);
// rolled map (the spy's secret plans) — hidden until the handover
const mapRoll = add(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), toon({ color: '#e8dcc0' }), 0, -5, 0, world, { cast: false });
mapRoll.visible = false;

// lantern posts with glass lanterns (glassMat + glint + warm glow sprite + ground pool)
const lanterns = [];
const lanternAt = (x, z, withRope = false) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(new THREE.CylinderGeometry(0.045, 0.055, 2.2, 7), M.beamDark, 0, 1.1, 0, g);
  add(new THREE.ConeGeometry(0.2, 0.14, 4), M.darkMetal, 0, 2.32, 0, g, { cast: false });
  add(tbox(0.2, 0.03, 0.2, 1), M.darkMetal, 0, 1.78, 0, g, { cast: false });
  add(tbox(0.2, 0.03, 0.2, 1), M.darkMetal, 0, 2.14, 0, g, { cast: false });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), FX.glassMat(0xffc37a, 0.2));
  glass.position.y = 1.96; glass.userData.ndSkip = true; g.add(glass);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffb45e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(0.95); glow.position.y = 1.96; glow.userData.ndSkip = true; g.add(glow);
  const glint = FX.glint(0.45); glint.position.set(0.06, 2.05, 0.1); glint.material.opacity = 0; glint.userData.ndSkip = true; g.add(glint);
  const pool = flat(add(new THREE.CircleGeometry(1.2, 18), MW.lampGlow, 0, 0.015, 0, g, { cast: false }));
  pool.material = MW.lampGlow.clone(); pool.material.opacity = 0; pool.userData.ndSkip = true; pool.receiveShadow = false;
  if (withRope) for (const ry of [1.12, 0.58]) { const t = add(new THREE.TorusGeometry(0.085, 0.028, 6, 14), M.beam, 0, ry, 0, g, { cast: false }); }
  lanterns.push({ glow, pool, glass, glint });
  return g;
};
lanternAt(-2.4, 1.9); lanternAt(2.3, 1.7, true); lanternAt(-4.6, -1.2); lanternAt(5.0, -0.7);
const LANTERN_ORDER = [3, 1, 0, 2]; // scream pop order: shower-side first, then the tie post, then the front pair
const lanternOnSet = (Ws) => Ws.shot === 'intro' ? new Set([0, 1]) : new Set(LANTERN_ORDER.slice(0, Ws.lanterns));

// ---------- FX simulation (stateful library systems, stepped deterministically) ----------
// renderFrame(f) may be called for any f in any order (stills, chunks): if f is not the
// next frame, reset the pools and re-simulate from frame 0 with fixed dt = 1/30.
const SPLASH_EV = [
  { f: 788, x: 3.85, y: 1.2, z: -1.62, n: 26, power: 5.0 },
  { f: 800, x: 3.85, y: 1.25, z: -1.62, n: 20, power: 4.2 },
  { f: 812, x: 3.85, y: 1.2, z: -1.62, n: 14, power: 3.4 },
  { f: 858, x: 3.55, y: 1.3, z: -0.95, n: 10, power: 2.2 },
];
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fire.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); fire.acc = 0;
  splashes.life.fill(-1); for (let i = 0; i < splashes.max; i++) splashes.pos[i * 3 + 1] = -999;
  splashes.points.geometry.attributes.position.needsUpdate = true;
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    fire.on = pr.fireRate > 0; fire.rate = pr.fireRate; fire.scale = pr.fireScale; smokeEmit.rate = pr.smokeRate;
    for (const ev of SPLASH_EV) if (ev.f === fxF) splashes.burst(ev.x, ev.y, ev.z, { n: ev.n, power: ev.power });
    smoke.update(t, dt); fire.update(t, dt);
    if (fire.light) fire.light.intensity *= 0.14 * (0.35 + 0.7 * pr.fireScale); // tame: ~8 at full blaze, ~1.5 at embers (library default lights the whole camp orange)
    splashes.update(t, dt); fxClouds.update(t, dt);
  }
};

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
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}

function worldState(Ws, f) {
  fxStepTo(f);
  const t = f / 30;
  // mist drifts + breathes on the spy's lane; opacity from story state
  mist.children.forEach((s, i) => {
    s.position.x = s.userData.bx + Math.sin(f * 0.008 + i * 1.7) * 0.9;
    s.material.opacity = 0.42 * Ws.mist * (0.75 + 0.25 * Math.sin(f * 0.013 + i * 2.1));
  });
  // lanterns pop on per story state
  const on = lanternOnSet(Ws);
  lanterns.forEach((L, i) => {
    const k = on.has(i) ? 1 : 0;
    L.glow.material.opacity = k * (0.5 + 0.07 * Math.sin(f * 0.9 + i * 2.3));
    L.pool.material.opacity = k * 0.32;
    L.glass.material.opacity = k ? 0.55 : 0.2;
    L.glint.material.opacity = k ? 0.55 + 0.3 * Math.sin(f * 0.23 + i) : 0;
  });
  starMat.opacity = 0.9 * Ws.starK;
  FX.clothWave(flag, t); FX.clothWave(curtain, t);
  palmTops.forEach((g, i) => { g.rotation.z = Math.sin(f * 0.02 + i * 1.3) * 0.02; g.rotation.x = Math.cos(f * 0.016 + i) * 0.015; });
  tripCrate.rotation.x = (Ws.crateTip || 0) * 1.45;
  mapRoll.visible = !!Ws.mapVis;
  if (Ws.mapVis) {
    const e = Ws.mapT * Ws.mapT * (3 - 2 * Ws.mapT);
    mapRoll.position.set(2.48 + (1.45 - 2.48) * e, 1.02, 1.52 + (0.98 - 1.52) * e);
    mapRoll.rotation.set(0, e * 0.6, Math.PI / 2);
  }
  const jg = Ws.jarGlint || 0;
  jarGlint.material.opacity = jg > 0 ? clamp01(jg) * (0.75 + 0.25 * Math.sin(f * 0.4)) : 0;
  jarGlint.scale.setScalar(0.22 + 0.28 * Math.max(0, jg)); // sparkle-sized: at ~1.3 m the texture's soft disc + cross arm painted a white blob over jar and bear
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
    if (a.blob !== false && a.y < DECK + 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? DECK) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

// NOTE vs the v4 kit: this pass must also hide SPRITES and POINTS (FX smoke/fire/mist/
// splashes/glints/stars) — they are not isMesh, so the v4 mesh-only swap would let them
// render into the ND target with garbage normals/depth. Anything flagged ndSkip (any
// object type) is hidden for the ND pass, exactly like the kit hides clouds/blobs/sky.
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
