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
// Zones along x: street x~-30 (professor's street), station x~0 (the workhorse set), plaza x~+30 (statue).
// Station layout: building facade at z~+5 (front z=3.5), canopy over the platform, platform top y=0.55
// (z -3.2..3.4), tracks at z=-6.9, camera mostly across the tracks at z<0 looking back (+z).
const DECK = 6; // legacy constant: only the card-blob default in drawActors reads it; every actor sets ground
const world = new THREE.Group(); scene.add(world);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// water uniforms survive (applyLight writes them) even though there is no water set
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const MW = {
  facade: texM(P.plaster(8), 4, 1), facadeLow: texM(P.stone(4), 4, 1),
  platform: texM(P.stone(14, 30, 10, 58), 6, 2), platEdge: toon({ color: '#e8e2d2' }),
  roofTile: toon({ color: '#46505c' }), roofRidge: toon({ color: '#39424e' }),
  woodDark: texM(P.beam(3, [26, 32, 30]), 1, 2), woodMid: texM(P.beam(2), 1, 2),
  railIron: toon({ color: '#7a7e85' }), ballast: texM(P.stone(15, 30, 6, 40), 8, 1),
  locoBody: toon({ color: '#26302c' }), locoTrim: toon({ color: '#a33327' }), boilerBand: toon({ color: '#8f8a7e' }),
  carGreen: toon({ color: '#2e4a3a' }), carBrown: toon({ color: '#6e3a2e' }), carRoof: toon({ color: '#3a3a3c' }),
  clockFace: toon({ color: '#f6efdd' }), clockRim: toon({ color: '#33302a' }), handMat: toon({ color: '#2c2620' }),
  awning: texM(P.weave(24, [150, 40, 44]), 3, 1),
  snowMat: toon({ color: '#edf1f6' }), puddle: new THREE.MeshToonMaterial({ gradientMap: grad, color: '#71879a', transparent: true, opacity: 0.8 }),
  blossom: toon({ color: '#e9a8c0' }), blossomLt: toon({ color: '#f2c4d4' }), leafGreen: toon({ color: '#5c8a3c' }),
  bronzeDark: toon({ color: '#7d5c26' }), stoneLight: texM(P.stone(16, 36, 10, 72), 2, 1),
  cityGround: texM(P.dirt(17), 24, 8),
};
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };

// ----- shared nature / town helpers -----
const ground = flat(add(new THREE.CircleGeometry(170, 40), M.grass, 0, -0.03, 0, world, { cast: false }));
flat(add(new THREE.PlaneGeometry(130, 34), MW.cityGround, 0, 0.0, 1, world, { cast: false }));
const houseAt = (x, z, w, h, d, mat) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(tbox(w, h, d, 2), mat, 0, h / 2, 0, g);
  const rf = add(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.4, 1.6, 4), MW.roofTile, 0, h + 0.8, 0, g); rf.rotation.y = Math.PI / 4; rf.scale.set(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
  add(box(0.9, 1.8, 0.1), M.door, 0, 0.9, d / 2 + 0.03, g, { cast: false });
  for (const s of [-1, 1]) add(box(0.6, 0.7, 0.1), M.window, s * w * 0.3, h * 0.62, d / 2 + 0.03, g, { cast: false });
  return g;
};
const pineAt = (x, z, h = 6) => { const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g); add(new THREE.CylinderGeometry(0.18, 0.28, h, 6), M.trunk, 0, h / 2, 0, g); const c = add(new THREE.SphereGeometry(1, 12, 8), M.pine, 0.25, h + 0.3, 0, g); c.scale.set(2.9, 1.05, 2.9); return g; };
const blossomAt = (x, z, s = 1, y0 = 0) => {
  const g = new THREE.Group(); g.position.set(x, y0, z); world.add(g);
  add(new THREE.CylinderGeometry(0.14 * s, 0.24 * s, 2.6 * s, 6), M.trunk, 0, 1.3 * s, 0, g);
  const r = P.rng((x * 31 + z * 17) | 0);
  for (let i = 0; i < 4; i++) { const c = add(new THREE.SphereGeometry(1, 10, 8), i % 2 ? MW.blossom : MW.blossomLt, (r() - 0.5) * 1.6 * s, (2.9 + r() * 0.9) * s, (r() - 0.5) * 1.2 * s, g, { cast: false }); c.scale.set(1.5 * s, 1.0 * s, 1.5 * s); }
  return g;
};
const mountAt = (x, z, r_, h) => { const g = new THREE.Group(); g.position.set(x, -4, z); world.add(g); add(new THREE.ConeGeometry(r_, h, 7), M.mount, 0, h / 2, 0, g, { cast: false }); add(new THREE.ConeGeometry(r_ * 0.32, h * 0.3, 7), M.snow, 0, h * 0.86, 0, g, { cast: false }); };
mountAt(-70, -95, 40, 40); mountAt(55, -105, 48, 52); mountAt(120, -90, 36, 38);
for (let i = 0; i < 6; i++) { const h = add(new THREE.SphereGeometry(18 + i * 3, 18, 10), i % 2 ? M.hill : M.hillFar, -75 + i * 30, -8, -42 - (i % 3) * 10, world, { cast: false }); h.scale.y = 0.45; }

// ----- SET: professor's street (x~-30) -----
houseAt(-37, 7.5, 6, 3.6, 4, M.plaster); houseAt(-30, 8, 5.4, 3.2, 4, M.plaster2); houseAt(-23.5, 7.5, 6, 3.8, 4, M.plaster);
for (const g of world.children.slice(-3)) g.rotation.y = Math.PI; // house fronts face the street (-z)
blossomAt(-39.5, 3.4, 1.1); blossomAt(-33.5, 4.3, 0.95); blossomAt(-28, 3.2, 1.15); blossomAt(-21.5, 4.1, 1.0);
pineAt(-18.5, 4.5, 5.5); pineAt(-41, -4.5, 6);
flat(add(new THREE.PlaneGeometry(30, 3.2), M.dirt, -30, 0.012, -0.6, world, { cast: false }));

// ----- SET: Shibuya station (x~0) -----
// tracks + ballast
add(tbox(120, 0.1, 3.6, 3), MW.ballast, 0, 0.03, -6.9, world, { cast: false });
for (const dz of [-0.75, 0.75]) add(tbox(120, 0.09, 0.14, 3), MW.railIron, 0, 0.14, -6.9 + dz, world, { cast: false });
const sleepers = flat(add(new THREE.PlaneGeometry(120, 2.6), texM(P.planks(19), 40, 1), 0, 0.085, -6.9, world, { cast: false }));
// platform (top y=0.55)
add(tbox(24, 0.55, 6.6, 2), MW.platform, 0, 0.275, 0.1, world);
add(tbox(24, 0.06, 0.5, 2), MW.platEdge, 0, 0.53, -3.0, world, { cast: false });
// building facade (front face z=3.5)
add(tbox(22, 6.4, 4, 2), MW.facade, 0, 3.2, 5.5, world);
add(tbox(22, 1.1, 4.06, 2), MW.facadeLow, 0, 0.55, 5.5, world, { cast: false });
{ // gable roof: two slabs + ridge
  const r1 = add(tbox(23, 0.18, 3.4, 2), MW.roofTile, 0, 7.35, 4.35, world); r1.rotation.x = 0.62;
  const r2 = add(tbox(23, 0.18, 3.4, 2), MW.roofTile, 0, 7.35, 6.65, world); r2.rotation.x = -0.62;
  add(tbox(23, 0.3, 0.5, 2), MW.roofRidge, 0, 8.28, 5.5, world, { cast: false });
}
add(box(2.6, 3.1, 0.14), toon({ color: '#513a22' }), 0, 1.55 + 0.55, 3.46, world, { cast: false }); // entrance doors (warm wood)
add(tbox(0.09, 3.1, 0.18, 1), MW.woodDark, 0, 1.55 + 0.55, 3.44, world, { cast: false }); // door mullion
add(tbox(3.4, 0.24, 0.3, 1), MW.woodDark, 0, 3.85, 3.42, world, { cast: false }); // entrance beam
for (const wx of [-7.5, -4.5, 4.5, 7.5]) { add(box(1.7, 1.5, 0.1), M.window, wx, 4.4, 3.47, world, { cast: false }); add(tbox(1.9, 0.12, 0.14, 1), MW.woodDark, wx, 5.22, 3.47, world, { cast: false }); }
// canopy over the platform, sloping from the facade out to posts at z=-2.2
{ const c = add(tbox(21, 0.1, 6.4, 2), MW.roofTile, 0, 3.62, 0.5, world); c.rotation.x = 0.055; }
for (const px of [-9.5, -5, 5, 9.5]) add(new THREE.CylinderGeometry(0.07, 0.09, 3.1, 8), MW.woodDark, px, 0.55 + 1.55, -2.2, world, { cast: false });
// benches + lamps + waiting-spot mat
for (const bx of [-6.2, 6.8]) { add(tbox(1.9, 0.09, 0.5, 1), MW.woodMid, bx, 1.0, 1.9, world, { cast: false }); add(tbox(1.9, 0.5, 0.08, 1), MW.woodMid, bx, 1.3, 2.14, world, { cast: false }); for (const s of [-0.8, 0.8]) add(tbox(0.09, 0.45, 0.45, 1), MW.woodDark, bx + s, 0.78, 1.9, world, { cast: false }); }
for (const lx of [-10.5, 10.5]) { add(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 8), MW.darkMetal ?? MW.woodDark, lx, 0.55 + 1.8, -2.6, world, { cast: false }); add(new THREE.SphereGeometry(0.17, 10, 8), toon({ color: '#ffe9b0' }), lx, 0.55 + 3.7, -2.6, world, { cast: false }); }
flat(add(new THREE.PlaneGeometry(1.5, 1.1), texM(P.weave(26, [38, 42, 50]), 1, 1), 1.6, 0.565, 0.9, world, { cast: false })); // Hachiko's worn mat (straw)
blossomAt(-13.5, 4.2, 1.2, 0); blossomAt(13.5, 4.2, 1.1, 0); pineAt(-15.5, -4, 6.5); pineAt(15.5, -4.5, 7);
// ----- clocks (facade + platform post); hands driven by worldState -----
const clockHandsList = [];
const makeClock = (x, y, z, r_) => {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.PI; world.add(g);
  const face = add(new THREE.CircleGeometry(r_, 28), MW.clockFace, 0, 0, 0, g, { cast: false });
  const rim = add(new THREE.TorusGeometry(r_, r_ * 0.09, 8, 28), MW.clockRim, 0, 0, 0.01, g, { cast: false });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, tick = add(box(0.03, r_ * (i % 3 ? 0.12 : 0.2), 0.01), MW.handMat, Math.sin(a) * r_ * 0.84, Math.cos(a) * r_ * 0.84, 0.015, g, { cast: false }); tick.rotation.z = -a; }
  const hrG = new THREE.BoxGeometry(0.055, r_ * 0.52, 0.02); hrG.translate(0, r_ * 0.22, 0);
  const mnG = new THREE.BoxGeometry(0.04, r_ * 0.8, 0.02); mnG.translate(0, r_ * 0.34, 0);
  const hr = add(hrG, MW.handMat, 0, 0, 0.03, g, { cast: false }); const mn = add(mnG, MW.handMat, 0, 0, 0.045, g, { cast: false });
  add(new THREE.SphereGeometry(0.045, 8, 6), MW.handMat, 0, 0, 0.05, g, { cast: false });
  clockHandsList.push({ hr, mn });
  return g;
};
makeClock(0, 5.6, 3.38, 0.85);
add(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), MW.woodDark, -3.4, 0.55 + 1.3, -2.5, world, { cast: false });
makeClock(-3.4, 0.55 + 3.05, -2.5, 0.5);
// ----- calendar board on the platform (pages flip in worldState) -----
const calPages = [["MAY", 1925], ["JUN", 1927], ["JAN", 1931], ["AUG", 1933], ["MAR", 1935], ["MAR", 1935]];
const calMats = calPages.map(([m, y]) => texM(P.calPage(m, y), 1, 1));
add(new THREE.CylinderGeometry(0.05, 0.07, 1.9, 8), MW.woodDark, 3.35, 0.55 + 0.95, -0.9, world, { cast: false });
add(tbox(1.0, 1.3, 0.07, 1), MW.woodMid, 3.35, 0.55 + 1.95, -0.9, world, { cast: false });
const calBoard = add(new THREE.PlaneGeometry(0.8, 1.06), calMats[0], 3.35, 0.55 + 1.95, -0.945, world, { cast: false }); calBoard.rotation.y = Math.PI;
const calFlipPivot = new THREE.Group(); calFlipPivot.position.set(3.35, 0.55 + 2.48, -0.97); world.add(calFlipPivot);
const calFlipGeo = new THREE.PlaneGeometry(0.8, 1.06); calFlipGeo.translate(0, -0.53, 0);
const calFlip = add(calFlipGeo, calMats[0], 0, 0, 0, calFlipPivot, { cast: false }); calFlip.rotation.y = Math.PI; calFlip.visible = false;
// ----- vendor stall -----
{ const g = new THREE.Group(); g.position.set(-7.6, 0.55, 1.9); world.add(g);
  add(tbox(1.7, 0.85, 0.8, 1), MW.woodMid, 0, 0.43, 0, g);
  for (const s of [-0.75, 0.75]) add(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 6), MW.woodDark, s, 0.95, -0.3, g, { cast: false });
  const aw = add(tbox(2.0, 0.06, 1.2, 1), MW.awning, 0, 1.95, 0.05, g); aw.rotation.x = 0.18;
  for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.13, 8, 6), toon({ color: ['#d9822b', '#c4452c', '#e6b13a'][i] }), -0.45 + i * 0.45, 0.98, 0.1, g, { cast: false });
}
// ----- food bowl by the waiting spot (appears in worldState when W.bowl) -----
const bowlG = new THREE.Group(); bowlG.position.set(1.02, 0.55, 1.62); world.add(bowlG); bowlG.visible = false;
{ const b = add(new THREE.SphereGeometry(0.17, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon({ color: '#37506e' }), 0, 0.17, 0, bowlG, { cast: false }); const food = add(new THREE.SphereGeometry(0.13, 10, 6), toon({ color: '#c8b088' }), 0, 0.13, 0, bowlG, { cast: false }); food.scale.y = 0.45; }
// ----- season overlays on the platform -----
const snowPlat = flat(add(new THREE.PlaneGeometry(23.6, 6.2), MW.snowMat, 0, 0.575, 0.1, world, { cast: false })); snowPlat.visible = false;
const snowStreet = flat(add(new THREE.PlaneGeometry(30, 12), MW.snowMat, -30, 0.02, 0, world, { cast: false })); snowStreet.visible = false;
const puddle = flat(add(new THREE.PlaneGeometry(9, 3.4), MW.puddle, -1.5, 0.572, -0.6, world, { cast: false })); puddle.visible = false;
// ----- steam train (group slides along x in worldState) -----
const trainG = new THREE.Group(); trainG.position.set(0, 0, -6.9); world.add(trainG);
{
  const loco = new THREE.Group(); trainG.add(loco);
  const boiler = add(new THREE.CylinderGeometry(0.62, 0.62, 3.3, 16), MW.locoBody, 0.35, 1.32, 0, loco); boiler.rotation.z = Math.PI / 2;
  const nose = add(new THREE.CylinderGeometry(0.64, 0.64, 0.35, 16), MW.clockRim, 2.1, 1.32, 0, loco); nose.rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.15, 0.2, 0.75, 10), MW.clockRim, 1.55, 2.2, 0, loco, { cast: false }); // chimney
  add(new THREE.SphereGeometry(0.3, 10, 8), MW.boilerBand, 0.55, 2.0, 0, loco, { cast: false }); // steam dome
  add(tbox(1.6, 1.95, 2.3, 1), MW.locoBody, -1.75, 1.6, 0, loco); // cab
  add(box(1.0, 0.7, 0.06), M.window, -1.75, 1.95, 1.16, loco, { cast: false }); add(box(1.0, 0.7, 0.06), M.window, -1.75, 1.95, -1.16, loco, { cast: false });
  add(tbox(4.6, 0.16, 2.2, 1), MW.clockRim, 0, 0.72, 0, loco, { cast: false }); // running board
  add(tbox(0.18, 0.5, 2.3, 1), MW.locoTrim, 2.32, 0.5, 0, loco, { cast: false }); // buffer beam
  add(new THREE.SphereGeometry(0.13, 8, 6), toon({ color: '#ffd98a' }), 2.3, 1.45, 0.5, loco, { cast: false });
  add(new THREE.SphereGeometry(0.13, 8, 6), toon({ color: '#ffd98a' }), 2.3, 1.45, -0.5, loco, { cast: false });
  for (const wx of [1.3, 0.2, -0.9]) for (const s of [-1, 1]) { const w = add(new THREE.CylinderGeometry(0.56, 0.56, 0.14, 16), MW.clockRim, wx, 0.56, s * 0.98, loco, { cast: false }); w.rotation.x = Math.PI / 2; }
  const car = (cx, mat) => { const g = new THREE.Group(); g.position.set(cx, 0, 0); trainG.add(g);
    add(tbox(5.4, 2.3, 2.5, 1), mat, 0, 1.75, 0, g);
    add(tbox(5.7, 0.18, 2.7, 1), MW.carRoof, 0, 3.0, 0, g, { cast: false });
    for (let i = 0; i < 5; i++) { add(box(0.72, 0.8, 0.06), M.window, -2.1 + i * 1.05, 2.0, 1.26, g, { cast: false }); add(box(0.72, 0.8, 0.06), M.window, -2.1 + i * 1.05, 2.0, -1.26, g, { cast: false }); }
    for (const wx of [-1.9, 1.9]) for (const s of [-1, 1]) { const w = add(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 14), MW.clockRim, wx, 0.46, s * 0.98, g, { cast: false }); w.rotation.x = Math.PI / 2; }
    return g; };
  car(-5.9, MW.carGreen); car(-11.7, MW.carBrown);
}
const steamG = new THREE.Group(); steamG.position.set(1.55, 2.62, 0); trainG.add(steamG);
const steamPuffs = [];
for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), new THREE.MeshBasicMaterial({ color: '#f2f5f7', transparent: true, opacity: 0, fog: true, depthWrite: false })); m.userData.ndSkip = true; steamG.add(m); steamPuffs.push(m); }

// ----- SET: statue plaza (x~+30) -----
flat(add(new THREE.CircleGeometry(9.5, 28), MW.stoneLight, 30, 0.015, 0.5, world, { cast: false }));
add(tbox(2.0, 0.45, 2.0, 1), MW.stoneLight, 30, 0.22, 0.8, world);
add(tbox(1.25, 0.75, 1.25, 1), MW.stoneLight, 30, 0.82, 0.8, world);
add(new THREE.PlaneGeometry(0.8, 0.55), M.bronze, 30, 0.82, 0.16, world, { cast: false }).rotation.y = Math.PI; // plain bronze plaque plate
for (const px of [26.2, 33.8]) { add(tbox(0.55, 3.4, 0.55, 1), MW.stoneLight, px, 1.7, 5.6, world); }
add(tbox(9.0, 0.5, 0.7, 1), MW.stoneLight, 30, 3.55, 5.6, world);
blossomAt(23.5, 3.8, 1.1); blossomAt(36.5, 3.8, 1.0); pineAt(22.5, -3.5, 6); pineAt(37.5, -3.5, 6.5);

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

// ---------- helmet prop (unused in this story; stub kept for the engine hook) ----------
const helmet = new THREE.Group(); scene.add(helmet); helmet.visible = false;


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
  trainG.position.x = W.trainX ?? 2;
  const steamAmt = W.steam || 0;
  steamPuffs.forEach((s, i) => {
    const tt = ((f * 0.55 + i * 7.3) % 60) / 60;
    s.position.set(tt * 1.15, tt * 2.7, Math.sin(tt * 5 + i) * 0.22);
    const sc = 0.26 + tt * 1.05; s.scale.set(sc, sc * 0.82, sc);
    s.material.opacity = steamAmt * 0.5 * (1 - tt) * Math.min(1, tt * 6 + 0.15);
    s.visible = steamAmt > 0.02;
  });
  for (const h of clockHandsList) { h.hr.rotation.z = -(W.clockHr || 0) * Math.PI / 180; h.mn.rotation.z = -(W.clockMin || 0) * Math.PI / 180; }
  const ci = W.calIdx || 0;
  calBoard.material = calMats[ci];
  const flip = W.calFlip || 0;
  calFlip.visible = flip > 0 && flip < 1;
  if (calFlip.visible) { calFlip.material = calMats[ci]; calFlipPivot.rotation.x = -flip * 2.1; }
  bowlG.visible = !!W.bowl;
  snowPlat.visible = snowStreet.visible = !!W.snow;
  puddle.visible = !!W.puddle;
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
