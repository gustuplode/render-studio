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
// Sets in separate zones: aquarium room x~0, drainpipe interior x~30, open ocean x~60. Ground y=0 everywhere.
const DECK = 6; // legacy constant: only the card-blob default in drawActors reads it; every actor sets ground:0
const world = new THREE.Group(); scene.add(world);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// water uniforms survive (applyLight writes them)
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#1f5d78') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const MW = {
  tiles: texM(P.tiles(51), 7, 5),
  tankBack: texM(P.tankBack(52), 1, 1),
  coralPink: texM(P.coralTex(53, [336, 55, 62]), 1, 1),
  coralOrange: texM(P.coralTex(55, [22, 78, 55]), 1, 1),
  rockTex: texM(P.coralTex(56, [210, 18, 46]), 2, 2),
  seaTop: new THREE.MeshBasicMaterial({ map: P.tex(P.seaTop(54)), fog: false }),
  sand: texM(P.dirt(57), 10, 8),
  roomWall: toon({ color: '#27586b' }),
  cabinet: toon({ color: '#14424f' }),
  frame: toon({ color: '#0f323d' }),
  pipeDark: texM(P.panelMetal(58, 210), 4, 2),
  ironRing: toon({ color: '#39434c' }),
  grate: toon({ color: '#22282e' }),
  pipeBlue: toon({ color: '#2e6da8' }),
  weed: toon({ color: '#3f8a4c' }),
  weed2: toon({ color: '#57a047' }),
  moon: new THREE.MeshBasicMaterial({ color: '#eaf4ff', fog: false }),
  exitGlow: new THREE.MeshBasicMaterial({ color: '#bfe2ff', fog: false, transparent: true, opacity: 0.9 }),
  shaft: new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.07, fog: false, depthWrite: false, side: THREE.DoubleSide }),
  glass: new THREE.MeshToonMaterial({ gradientMap: grad, color: '#cfeaf4', transparent: true, opacity: 0.13, depthWrite: false }),
  waterVol: new THREE.MeshToonMaterial({ gradientMap: grad, color: '#3d8ab0', transparent: true, opacity: 0.16, depthWrite: false }),
  bubble: new THREE.MeshBasicMaterial({ color: '#dff2ff', transparent: true, opacity: 0.55, depthWrite: false }),
  trail: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('95,125,150', 0.85)), transparent: true, opacity: 0.55, depthWrite: false }),
  foam: toon({ color: '#eaf6ff' }),
};
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };
const noNd = (m) => { m.userData.ndSkip = true; return m; };

// ================= ZONE A: the aquarium room (x~0) =================
flat(add(new THREE.PlaneGeometry(30, 20), MW.tiles, 0, 0.005, 2, world, { cast: false }));       // tiled floor
add(tbox(30, 7.5, 0.4, 3), MW.roomWall, 0, 3.75, -4.9, world, { cast: false });                   // back wall
for (const s of [-1, 1]) add(tbox(0.4, 7.5, 20, 3), MW.roomWall, s * 13, 3.75, 0, world, { cast: false }); // side walls
// wall dressing: two glowing picture panels + a pipe run along the wall
for (const px of [-6.5, 6.5]) { const pn = add(new THREE.PlaneGeometry(3.4, 2.0), new THREE.MeshBasicMaterial({ map: P.tex(P.tankBack(60 + px)), fog: false }), px, 4.6, -4.66, world, { cast: false }); noNd(pn); }
const wallPipe = add(new THREE.CylinderGeometry(0.14, 0.14, 17, 10), MW.pipeBlue, 0, 6.6, -4.55, world, { cast: false }); wallPipe.rotation.z = Math.PI / 2;

// ----- the big tank (centre 0, z=-1.2; water box x[-2.3,2.3], y[0.55,3.05], z[-2.3,-0.1]) -----
const tankG = new THREE.Group(); tankG.position.set(0, 0, -1.2); world.add(tankG);
add(tbox(5.0, 0.55, 2.6, 2), MW.cabinet, 0, 0.275, 0, tankG);                                     // cabinet base
add(tbox(4.7, 0.14, 2.3, 2), MW.frame, 0, 3.12, 0, tankG);                                        // top rim
add(tbox(4.7, 0.12, 2.3, 2), MW.frame, 0, 0.56, 0, tankG);                                        // bottom rim
for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(tbox(0.14, 2.6, 0.14, 1), MW.frame, sx * 2.28, 1.84, sz * 1.08, tankG); // corner posts
const tankBackP = add(new THREE.PlaneGeometry(4.6, 2.5), MW.tankBack, 0, 1.84, -1.13, tankG, { cast: false });
const waterBox = noNd(add(box(4.55, 2.45, 2.15), MW.waterVol, 0, 1.84, 0, tankG, { cast: false })); waterBox.renderOrder = 3;
const glassF = noNd(add(new THREE.PlaneGeometry(4.6, 2.5), MW.glass, 0, 1.84, 1.16, tankG, { cast: false })); glassF.renderOrder = 6;
add(tbox(4.55, 0.1, 2.15, 2), texM(P.dirt(61), 3, 2), 0, 0.66, 0, tankG, { cast: false });         // sandy tank floor
// rocks + corals + weed inside the tank
const rockIn = (x, z, s, mat) => { const r = add(new THREE.SphereGeometry(0.34, 9, 7), mat, x, 0.78, z, tankG); r.scale.set(s, s * 0.62, s * 0.8); return r; };
rockIn(-1.5, -0.4, 1.15, MW.rockTex); rockIn(1.65, -0.55, 0.9, MW.rockTex); rockIn(0.4, -0.8, 0.7, MW.rockTex);
const coralIn = (x, z, mat, s = 1) => { const g = new THREE.Group(); g.position.set(x, 0.7, z); tankG.add(g);
  const c1 = add(new THREE.ConeGeometry(0.16, 0.55, 7), mat, 0, 0.27, 0, g); c1.scale.setScalar(s);
  const c2 = add(new THREE.ConeGeometry(0.11, 0.4, 7), mat, 0.22 * s, 0.2, 0.05, g); c2.rotation.z = -0.4;
  const c3 = add(new THREE.SphereGeometry(0.13, 8, 6), mat, -0.2 * s, 0.1, -0.04, g); return g; };
coralIn(-1.15, -0.65, MW.coralPink, 1.1); coralIn(1.25, -0.3, MW.coralOrange, 0.9); coralIn(-0.3, -0.9, MW.coralPink, 0.7);
const weedIn = (x, z, h, mat) => { const w = add(new THREE.ConeGeometry(0.05, h, 5), mat, x, 0.7 + h / 2, z, tankG, { cast: false }); w.rotation.z = 0.12; return w; };
const tankWeeds = [weedIn(-1.9, -0.7, 0.9, MW.weed), weedIn(-1.75, -0.5, 0.65, MW.weed2), weedIn(1.95, -0.75, 0.8, MW.weed), weedIn(0.95, -0.95, 0.55, MW.weed2)];
// the lid: two panels with a narrow GAP slot near x=+0.85 (Inky's escape hatch)
add(tbox(2.9, 0.07, 2.3, 2), MW.frame, -0.85, 3.22, 0, tankG);
add(tbox(1.05, 0.07, 2.3, 2), MW.frame, 1.82, 3.22, 0, tankG);
add(tbox(0.4, 0.05, 2.3, 1), MW.grate, 0.85, 3.19, 0, tankG, { cast: false });                     // dark slot shadow under the gap
// bubbles inside the tank (animated in worldState)
const tankBubbles = new THREE.Group(); tankG.add(tankBubbles);
{ const r = P.rng(71); for (let i = 0; i < 12; i++) { const b = noNd(add(new THREE.SphereGeometry(0.02 + r() * 0.028, 6, 5), MW.bubble, -2 + r() * 4, 0.8 + r() * 2.1, -0.8 + r() * 1.4, tankBubbles, { cast: false })); b.userData.ph = r(); b.userData.x0 = b.position.x; } }
// ----- floor drains + the wet trail -----
const drainAt = (x, z, big) => { const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  flat(add(new THREE.CircleGeometry(big ? 0.52 : 0.4, 18), MW.grate, 0, 0.02, 0, g, { cast: false }));
  const ring = add(new THREE.TorusGeometry(big ? 0.52 : 0.4, 0.045, 8, 22), big ? MW.pipeBlue : MW.ironRing, 0, 0.03, 0, g, { cast: false }); ring.rotation.x = Math.PI / 2;
  for (let i = -1; i <= 1; i++) add(box(big ? 0.9 : 0.68, 0.025, 0.09), MW.ironRing, 0, 0.03, i * 0.2, g, { cast: false });
  return g; };
drainAt(1.9, 2.7, false);        // drain A: the nightly explore pipe (short, to the mop sink)
drainAt(-2.4, 2.9, true);        // drain B: THE LONG ONE — out to the sea (blue collar ring)
// wet trail decals: tank base -> drain A (staff shot + finale evidence)
const trailG = new THREE.Group(); world.add(trailG);
{ const pts = [[0.7, 0.5], [1.05, 1.15], [1.35, 1.8], [1.65, 2.3], [1.88, 2.66]];
  for (const [tx, tz] of pts) { const d = noNd(flat(add(new THREE.PlaneGeometry(0.85, 0.6), MW.trail, tx, 0.018, tz, trailG, { cast: false }))); d.renderOrder = 2; }
  const d2 = noNd(flat(add(new THREE.PlaneGeometry(1.5, 1.0), MW.trail, -1.2, 0.018, 1.9, trailG, { cast: false }))); d2.renderOrder = 2; }
// mop + bucket (the accused)
const mopG = new THREE.Group(); mopG.position.set(3.15, 0, 1.55); mopG.rotation.z = 0.16; world.add(mopG);
add(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 8), M.wood, 0, 1.15, 0, mopG);
add(tbox(0.3, 0.34, 0.2, 1), texM(P.weave(63, [225, 222, 205]), 1, 1), 0, 0.2, 0, mopG, { cast: false });
const bucket = add(new THREE.CylinderGeometry(0.3, 0.23, 0.42, 12, 1, true), MW.pipeBlue, 3.7, 0.21, 1.9, world);

// ================= ZONE B: inside the drainpipe (x~30) =================
const pipeG = new THREE.Group(); pipeG.position.set(30, 0, 0); world.add(pipeG);
{ const pipeIn = texM(P.panelMetal(59, 205), 4, 2); pipeIn.side = THREE.BackSide;
  const tube = add(new THREE.CylinderGeometry(1.18, 1.18, 17, 22, 1, true), pipeIn, 0, 1.18, -3, pipeG, { cast: false }); tube.rotation.x = Math.PI / 2; }
for (let i = 0; i < 6; i++) { const rib = add(new THREE.TorusGeometry(1.16, 0.05, 8, 24), MW.ironRing, 30, 1.18, 3.5 - i * 2.6, world, { cast: false }); }
const pipeWater = noNd(add(new THREE.PlaneGeometry(1.5, 16.5), new THREE.MeshBasicMaterial({ color: '#7fc4e8', transparent: true, opacity: 0.5, depthWrite: false }), 30, 0.16, -3, world, { cast: false })); pipeWater.rotation.x = -Math.PI / 2; pipeWater.renderOrder = 2;
const foamG = new THREE.Group(); world.add(foamG);
{ const r = P.rng(73); for (let i = 0; i < 16; i++) { const fp = add(new THREE.SphereGeometry(0.05 + r() * 0.06, 6, 5), MW.foam, 29.6 + r() * 0.8, 0.22, 4.5 - r() * 15, foamG, { cast: false }); fp.userData.z0 = fp.position.z; fp.userData.sp = 0.5 + r(); } }
const exitGlow = noNd(add(new THREE.CircleGeometry(0.95, 20), MW.exitGlow, 30, 1.18, -11.2, world, { cast: false })); exitGlow.renderOrder = 1;

// ================= ZONE C: the open ocean (x~60) =================
flat(add(new THREE.PlaneGeometry(46, 30), MW.sand, 60, 0, -2, world, { cast: false }));          // seabed
// reef wall with the pipe mouth
const reef = new THREE.Group(); reef.position.set(60, 0, -8.5); world.add(reef);
{ const r = P.rng(75); for (let i = 0; i < 9; i++) { const rock = add(new THREE.SphereGeometry(1.1 + r() * 1.1, 9, 7), MW.rockTex, -9 + i * 2.3 + r() * 0.6, 0.4 + r() * 0.8, (r() - 0.5) * 1.4, reef); rock.scale.y = 0.75; } }
const pipeMouth = add(new THREE.CylinderGeometry(0.58, 0.58, 1.7, 16, 1, true), MW.pipeDark, 58.4, 0.85, -6.9, world); pipeMouth.rotation.x = Math.PI / 2 - 0.35;
const pipeHole = noNd(add(new THREE.CircleGeometry(0.52, 16), new THREE.MeshBasicMaterial({ color: '#06121f' }), 58.4, 1.1, -6.12, world, { cast: false }));
const oceanCorals = new THREE.Group(); world.add(oceanCorals);
const coralOut = (x, z, mat, s = 1) => { const g = new THREE.Group(); g.position.set(x, 0, z); oceanCorals.add(g);
  const c1 = add(new THREE.ConeGeometry(0.3, 1.0, 7), mat, 0, 0.5, 0, g); c1.scale.setScalar(s);
  const c2 = add(new THREE.ConeGeometry(0.2, 0.7, 7), mat, 0.42 * s, 0.35, 0.1, g); c2.rotation.z = -0.42;
  const c3 = add(new THREE.SphereGeometry(0.24, 8, 6), mat, -0.38 * s, 0.16, -0.08, g); return g; };
coralOut(55.5, -3.5, MW.coralPink, 1.2); coralOut(64.5, -4.2, MW.coralOrange, 1.4); coralOut(57.5, -1.5, MW.coralOrange, 0.9); coralOut(63, -0.8, MW.coralPink, 1.0); coralOut(52.8, -5.5, MW.coralPink, 0.8);
const oceanWeeds = [];
const weedOut = (x, z, h, mat) => { const w = add(new THREE.ConeGeometry(0.09, h, 5), mat, x, h / 2, z, world, { cast: false }); oceanWeeds.push(w); return w; };
weedOut(56.5, -2.6, 1.7, MW.weed); weedOut(56.9, -2.2, 1.2, MW.weed2); weedOut(62.5, -3.2, 1.9, MW.weed); weedOut(66, -2, 1.4, MW.weed2); weedOut(53.5, -3.8, 1.5, MW.weed);
for (const [rx2, rz2, rs] of [[54, -6, 1.2], [66.5, -5, 1.5], [59, -3.4, 0.7], [68, -1, 1.0]]) { const rk = add(new THREE.SphereGeometry(0.5, 9, 7), MW.rockTex, rx2, 0.2, rz2, world); rk.scale.set(rs, rs * 0.6, rs * 0.85); }
// moonlit surface far above + the moon itself + light shafts
const seaSurf = noNd(add(new THREE.PlaneGeometry(46, 30), MW.seaTop, 60, 9.5, -2, world, { cast: false })); seaSurf.rotation.x = Math.PI / 2; seaSurf.renderOrder = 0;
const moonDisc = noNd(add(new THREE.CircleGeometry(2.3, 24), MW.moon, 60, 14.5, -16, world, { cast: false }));
for (const [sx, sz, sr] of [[57, -4, 0.5], [61, -2, -0.4], [64, -5, 0.35]]) { const sh = noNd(add(new THREE.PlaneGeometry(1.6, 10), MW.shaft, sx, 4.8, sz, world, { cast: false })); sh.rotation.z = sr * 0.4; sh.rotation.y = 0.3; }
// ocean bubbles near the pipe exit (animated in worldState)
const oceanBubbles = new THREE.Group(); world.add(oceanBubbles);
{ const r = P.rng(79); for (let i = 0; i < 14; i++) { const b = noNd(add(new THREE.SphereGeometry(0.025 + r() * 0.04, 6, 5), MW.bubble, 57.6 + r() * 1.8, r() * 6, -5.6 + r() * 1.2, oceanBubbles, { cast: false })); b.userData.ph = r(); b.userData.x0 = b.position.x; } }

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
    c = mix(c, vec3(1.), flash);
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
  trailG.visible = !!W.trail;
  tankBubbles.children.forEach((bb, i) => { const t = ((f / 30) * 0.14 + bb.userData.ph) % 1; bb.position.y = 0.85 + t * 2.05; bb.position.x = bb.userData.x0 + Math.sin(f * 0.05 + i * 2) * 0.03; });
  oceanBubbles.children.forEach((bb, i) => { const t = ((f / 30) * 0.1 + bb.userData.ph) % 1; bb.position.y = 0.3 + t * 6.4; bb.position.x = bb.userData.x0 + Math.sin(f * 0.04 + i * 1.7) * 0.05; });
  foamG.children.forEach((pp) => { pp.position.z = 4.5 - ((4.5 - pp.userData.z0 + (f / 30) * pp.userData.sp * 1.4) % 15.5); });
  tankWeeds.forEach((w, i) => { w.rotation.z = 0.12 + Math.sin(f * 0.03 + i * 1.3) * 0.05; });
  oceanWeeds.forEach((w, i) => { w.rotation.z = Math.sin(f * 0.025 + i * 1.1) * 0.09; });
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
