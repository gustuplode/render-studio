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
// "The Cat Who Sank Three Ships" — sets in separate zones on a sea/land strip:
// wreck + Cossack x~0, Ark Royal x~34, retirement garden x~74. Sea level y=0; ship deck top y=2.64.
const DECK = 6; // legacy constant: only the card-blob default in drawActors reads it; every actor sets ground
const world = new THREE.Group(); scene.add(world);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// water uniforms survive (applyLight writes them)
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const MW = {
  sea: texM(P.waves(51), 15, 15), sea2: texM(P.waves(53), 15, 15),
  flower: texM(P.flowerbed(61), 1, 1),
  hull: toon({ color: '#48545f' }), hullDark: toon({ color: '#39424b' }), hullRed: toon({ color: '#a03a30' }),
  deckM: texM(P.planks(71), 5, 1), cream: toon({ color: '#e6dfc9' }),
  funnelBlack: toon({ color: '#26262c' }), funnelRust: toon({ color: '#9c4a34' }), bandWhite: toon({ color: '#eef0ea' }), bandGold: toon({ color: '#d9a845' }),
  boatWood: texM(P.planks(72), 2, 1), darkMetal: toon({ color: '#3c4148' }),
  smoke: toon({ color: '#ccd2d8' }), fence: toon({ color: '#e8e2d2' }),
  foam: new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.55, fog: true, depthWrite: false }),
};
const flat = (mesh) => { mesh.rotation.x = -Math.PI / 2; return mesh; };
const foamRing = (parent, x, y, z, sx = 1.6, sz = 1) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.85, 26), MW.foam);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.scale.set(sx, sz, 1); m.userData.ndSkip = true; m.renderOrder = 1; parent.add(m); return m;
};

// ----- ships (one model, re-dressed per funnel) -----
const DECKY = 2.64;
const shipAt = (x, z, funnelMat, bandMat, hullMat = MW.hull) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  const tilt = new THREE.Group(); tilt.position.set(0, 0.3, 0); g.add(tilt);
  add(tbox(15, 2.8, 3.6, 2), hullMat, 0, 0.7, 0, tilt);                                   // hull
  const bow = add(tbox(2.8, 2.8, 2.8, 2), hullMat, 8.2, 0.7, 0, tilt); bow.rotation.y = Math.PI / 4;
  const stern = add(tbox(2.4, 2.8, 2.4, 2), hullMat, -8.1, 0.7, 0, tilt); stern.rotation.y = Math.PI / 4;
  add(tbox(15.3, 0.5, 3.75, 2), MW.hullRed, 0, -0.28, 0, tilt);                            // boot-top stripe
  add(tbox(14.8, 0.24, 3.4, 2), MW.deckM, 0, 2.22, 0, tilt);                              // deck (top y=2.64 abs)
  add(tbox(14.8, 0.5, 0.12, 2), hullMat, 0, 2.55, 1.68, tilt);                            // bulwarks
  add(tbox(14.8, 0.5, 0.12, 2), hullMat, 0, 2.55, -1.68, tilt);
  add(tbox(3.4, 1.5, 2.6, 2), MW.cream, -1.6, 3.1, 0, tilt);                              // superstructure
  add(tbox(2.8, 1.0, 2.9, 2), MW.cream, -1.6, 4.3, 0, tilt);                              // bridge
  add(box(2.9, 0.38, 3.0), M.window, -1.6, 4.42, 0, tilt, { cast: false });               // bridge windows
  add(new THREE.CylinderGeometry(0.55, 0.7, 2.3, 12), funnelMat, 2.0, 4.15, 0, tilt);     // funnel
  add(new THREE.CylinderGeometry(0.63, 0.67, 0.5, 12), bandMat, 2.0, 4.85, 0, tilt, { cast: false });
  add(new THREE.CylinderGeometry(0.58, 0.58, 0.4, 12), MW.darkMetal, 2.0, 5.4, 0, tilt, { cast: false });
  add(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8), MW.darkMetal, -5.6, 5.0, 0, tilt);   // fore mast
  add(box(0.09, 0.09, 1.7), MW.darkMetal, -5.6, 6.9, 0, tilt, { cast: false });
  add(new THREE.CylinderGeometry(0.07, 0.1, 4.4, 8), MW.darkMetal, 6.0, 4.5, 0, tilt);    // aft mast
  add(box(0.09, 0.09, 1.5), MW.darkMetal, 6.0, 6.2, 0, tilt, { cast: false });
  for (let i = 0; i < 7; i++) { const ph = add(new THREE.SphereGeometry(0.15, 8, 6), M.window, -6 + i * 2, 1.05, 1.83, tilt, { cast: false }); ph.scale.set(1, 1, 0.35); }
  for (const dx of [4.7, 6.5]) add(box(0.12, 1.15, 0.12), MW.darkMetal, dx, 2.95, 1.95, tilt, { cast: false }); // lifeboat davits
  const flagGeo = new THREE.PlaneGeometry(0.95, 0.62); flagGeo.translate(0.48, 0, 0);
  const flag = add(flagGeo, new THREE.MeshToonMaterial({ gradientMap: grad, color: '#b03a30', side: THREE.DoubleSide }), 6.02, 6.55, 0, tilt, { cast: false });
  return { g, tilt, flag };
};
const shipA = shipAt(0, -13, MW.funnelBlack, MW.bandWhite);            // HMS Cossack
const shipB = shipAt(34, -13, MW.funnelRust, MW.bandGold);             // HMS Ark Royal
const shipW = shipAt(-21, -31, MW.funnelBlack, MW.bandWhite, MW.hullDark); // the Bismarck, already going down
shipW.g.rotation.y = 0.55; shipW.g.position.y = -1.5; shipW.tilt.rotation.z = 0.42; shipW.tilt.rotation.x = 0.1;
const flagA = shipA.flag, flagB = shipB.flag;
// funnel smoke (world-space puffs, cycled in worldState)
const smokes = [];
for (const [bx, bz] of [[2.0, -13], [36.0, -13]]) for (let i = 0; i < 5; i++) {
  const s = add(new THREE.SphereGeometry(0.55, 9, 7), MW.smoke, bx, 6, bz, world, { cast: false });
  s.userData = { bx, bz, i }; smokes.push(s);
}

// ----- seas -----
flat(add(new THREE.CircleGeometry(31, 30), MW.sea, 0, -0.05, -12, world, { cast: false }));
flat(add(new THREE.CircleGeometry(27, 30), MW.sea2, 34, -0.05, -12, world, { cast: false }));

// ----- floating wreckage, zone A foreground -----
const debris = [];
const floatAt = (obj, x, y, z, ph) => { obj.position.set(x, y, z); obj.userData = { y0: y, ph }; world.add(obj); debris.push(obj); return obj; };
const plankHero = new THREE.Group();
add(tbox(2.0, 0.1, 0.62, 1), M.plank, 0, 0, 0, plankHero);
add(tbox(1.25, 0.09, 0.48, 1), M.plank, 0.22, 0.09, 0.05, plankHero).rotation.y = 0.35;
plankHero.position.set(0, 0.02, -0.8); world.add(plankHero);
foamRing(world, 0, 0.03, -0.8, 2.0, 1.1);
{ const b = new THREE.Group(); add(new THREE.CylinderGeometry(0.34, 0.34, 0.85, 12), M.wood, 0, 0, 0, b).rotation.z = Math.PI / 2; floatAt(b, -2.7, 0.02, -2.3, 1.3); }
{ const c = new THREE.Group(); add(tbox(0.75, 0.75, 0.75, 1), M.plank, 0, 0.1, 0, c).rotation.y = 0.5; floatAt(c, 3.0, -0.05, -3.2, 2.6); }
{ const p2 = new THREE.Group(); add(tbox(1.7, 0.09, 0.5, 1), M.plank, 0, 0, 0, p2).rotation.y = -0.3; floatAt(p2, -3.6, 0.02, -0.1, 4.1); }
{ const p3 = new THREE.Group(); add(tbox(1.5, 0.09, 0.55, 1), M.plank, 0, 0, 0, p3).rotation.y = 0.9; floatAt(p3, 4.4, 0.02, -0.5, 5.3); }

// ----- boats -----
const boatAt = () => {
  const g = new THREE.Group(); world.add(g);
  add(tbox(2.6, 0.6, 1.15, 1), MW.boatWood, 0, 0.05, 0, g);
  const bow = add(tbox(0.75, 0.6, 0.8, 1), MW.boatWood, 1.45, 0.05, 0, g); bow.rotation.y = Math.PI / 4;
  add(tbox(2.7, 0.1, 1.28, 1), M.beam, 0, 0.38, 0, g, { cast: false });                    // gunwale rim
  add(box(0.32, 0.09, 1.0), M.beamDark, -0.6, 0.22, 0, g, { cast: false });               // benches
  add(box(0.32, 0.09, 1.0), M.beamDark, 0.55, 0.22, 0, g, { cast: false });
  const mkOar = (side) => { const og = new THREE.Group(); og.position.set(0.1, 0.42, side * 0.62); g.add(og);
    const geo = box(0.07, 0.05, 1.7); geo.translate(0, 0, side * 0.85); add(geo, M.beam, 0, 0, 0, og, { cast: false }); return og; };
  const ring = foamRing(g, 0, 0.04, 0, 2.6, 1.15);
  return { g, oarL: mkOar(-1), oarR: mkOar(1), ring };
};
const boatA = boatAt();    // rescue boat, zone A
const boatL1 = boatAt();   // Cossack lifeboat 1
const boatL2 = boatAt();   // Cossack lifeboat 2
const boatB = boatAt();    // Ark Royal lifeboat (Sam's)
const BOATS = { boatA, boatL1, boatL2, boatB };

// ----- torpedoes + splashes -----
const torpAt = () => {
  const g = new THREE.Group(); world.add(g); g.visible = false;
  const body = add(new THREE.CylinderGeometry(0.09, 0.09, 1.15, 10), MW.darkMetal, 0, 0.03, 0, g, { cast: false }); body.rotation.z = Math.PI / 2;
  const nose = add(new THREE.ConeGeometry(0.09, 0.28, 10), MW.darkMetal, 0.7, 0.03, 0, g, { cast: false }); nose.rotation.z = -Math.PI / 2;
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.3), MW.foam); trail.rotation.x = -Math.PI / 2; trail.position.set(-2.4, 0.02, 0); trail.userData.ndSkip = true; trail.renderOrder = 1; g.add(trail);
  return g;
};
const splashAt = () => {
  const g = new THREE.Group(); world.add(g); g.visible = false;
  add(new THREE.ConeGeometry(0.55, 1.7, 10), MW.bandWhite, 0, 0.8, 0, g, { cast: false });
  for (const [sx, sy, ss] of [[-0.7, 0.35, 0.4], [0.65, 0.45, 0.5], [0.1, 0.25, 0.34]]) add(new THREE.SphereGeometry(ss, 8, 6), MW.bandWhite, sx, sy, 0, g, { cast: false });
  foamRing(g, 0, 0.03, 0, 2.6, 1.2);
  return g;
};
const torpA = torpAt(), torpB = torpAt(), splashA = splashAt(), splashB = splashAt();
splashA.position.set(-1, 0, -10.9); splashB.position.set(33, 0, -10.9);

// ----- SET 3: retirement garden (x~74) -----
flat(add(new THREE.CircleGeometry(25, 30), M.grass, 74, 0.0, 2, world, { cast: false }));
for (const [hx, hz, hr, hh] of [[56, -28, 17, 12], [76, -32, 20, 14], [94, -27, 15, 10]]) { const h = add(new THREE.SphereGeometry(hr, 16, 10), M.hillFar, hx, -hh * 0.28, hz, world, { cast: false }); h.scale.y = 0.5; }
const cottageAt = (x, z) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(tbox(5.6, 2.9, 3.6, 2), M.plaster2, 0, 1.45, 0, g);
  const rf = add(new THREE.ConeGeometry(Math.hypot(5.6, 3.6) / 2 + 0.5, 1.7, 4), M.roof, 0, 3.75, 0, g); rf.rotation.y = Math.PI / 4; rf.scale.set(5.6 / Math.hypot(5.6, 3.6) * 1.414, 1, 3.6 / Math.hypot(5.6, 3.6) * 1.414);
  add(tbox(0.7, 1.1, 0.7, 1), M.stone, 1.7, 4.3, -0.6, g);                                  // chimney
  add(box(0.95, 1.9, 0.1), M.door, -0.9, 0.95, 1.83, g, { cast: false });
  for (const s of [-1, 1]) add(box(0.75, 0.85, 0.1), M.window, s * 1.9, 1.8, 1.83, g, { cast: false });
  return g;
};
cottageAt(74, -12);
flat(add(new THREE.PlaneGeometry(2.2, 15), M.dirt, 73.1, 0.02, -3, world, { cast: false }));  // path to the door
const bedAt = (x, z, w, d, ry = 0) => { const b = flat(add(new THREE.PlaneGeometry(w, d), MW.flower, x, 0.03, z, world, { cast: false })); b.rotation.z = ry; return b; };
bedAt(70.2, -8.4, 4.6, 1.25); bedAt(77.8, -8.4, 4.6, 1.25); bedAt(66.8, -1, 1.25, 4.6);
{ const r = P.rng(61); const cols = ['#e8546a', '#f2c33d', '#ffffff', '#e88ac0', '#f2813d'];
  for (const [bx, bz, bw, bd] of [[70.2, -8.4, 4.2, 0.95], [77.8, -8.4, 4.2, 0.95], [66.8, -1, 0.95, 4.2]])
    for (let i = 0; i < 11; i++) { const fx = bx + (r() - 0.5) * bw, fz = bz + (r() - 0.5) * bd;
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 5), M.pine, fx, 0.13, fz, world, { cast: false });
      add(new THREE.SphereGeometry(0.09 + r() * 0.06, 7, 6), toon({ color: cols[(r() * cols.length) | 0] }), fx, 0.3, fz, world, { cast: false }); } }
for (let fx = 60; fx <= 88; fx += 2.33) { if (fx > 71.5 && fx < 75.6) continue; add(box(0.12, 0.95, 0.12), MW.fence, fx, 0.48, 6.5, world, { cast: false }); }
for (const [rx0, rx1] of [[60, 71.9], [75.2, 88]]) for (const ry of [0.55, 0.85]) add(box(rx1 - rx0, 0.09, 0.05), MW.fence, (rx0 + rx1) / 2, ry, 6.5, world, { cast: false });
{ const g = new THREE.Group(); g.position.set(64, 0, -6); world.add(g);                                  // round tree
  add(new THREE.CylinderGeometry(0.22, 0.32, 2.2, 8), M.trunk, 0, 1.1, 0, g);
  add(new THREE.SphereGeometry(1.6, 12, 9), M.pine, 0, 3.5, 0, g);
  add(new THREE.SphereGeometry(1.1, 10, 8), M.pine, -1.1, 2.8, 0.5, g); add(new THREE.SphereGeometry(1.05, 10, 8), M.pine, 1.2, 2.9, -0.5, g); }
{ const g = new THREE.Group(); g.position.set(79.5, 0, -4); g.rotation.y = -0.4; world.add(g);          // bench
  add(box(1.9, 0.1, 0.55), M.beam, 0, 0.55, 0, g); add(box(1.9, 0.6, 0.09), M.beam, 0, 1.02, -0.3, g);
  for (const s of [-1, 1]) add(box(0.12, 0.55, 0.5), M.beamDark, s * 0.8, 0.27, 0, g); }
// hedge masking the lawn's west edge
for (let i = 0; i < 6; i++) { const h = add(new THREE.SphereGeometry(1.15, 10, 8), M.bush, 58.5, 0.7, -6 + i * 3.1, world, { cast: false }); h.scale.y = 0.8; }

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
  waterU.t.value = f / 30;
  for (const d of debris) { const u = d.userData; d.position.y = u.y0 + Math.sin(f * 0.045 + u.ph) * 0.055; d.rotation.z = Math.sin(f * 0.03 + u.ph) * 0.05; d.rotation.x = Math.cos(f * 0.026 + u.ph) * 0.04; }
  plankHero.position.y = 0.02 + Math.sin(f * 0.05) * 0.05; plankHero.rotation.z = Math.sin(f * 0.037) * 0.045; plankHero.rotation.x = Math.cos(f * 0.041) * 0.03;
  shipA.g.rotation.z = (W.tiltA || 0) + Math.sin(f * 0.021) * 0.004; shipA.g.position.y = (W.sinkA || 0) + Math.sin(f * 0.03) * 0.04;
  shipB.g.rotation.z = (W.tiltB || 0) + Math.sin(f * 0.019 + 2) * 0.004; shipB.g.position.y = (W.sinkB || 0) + Math.cos(f * 0.027) * 0.04;
  flagA.rotation.y = Math.sin(f * 0.13) * 0.35; flagB.rotation.y = Math.sin(f * 0.13 + 1) * 0.35;
  for (const s of smokes) { const u = s.userData, t = (f * 0.010 + u.i * 0.23) % 1; s.position.set(u.bx + t * 1.6, 5.95 + t * 3.8, u.bz + t * 0.5); const sc = 0.4 + t * 1.8; s.scale.set(sc, sc * 0.72, sc); }
  torpA.visible = W.torpA !== undefined && W.torpA > -100; if (torpA.visible) torpA.position.set(W.torpA, 0.02, -10.85);
  torpB.visible = W.torpB !== undefined && W.torpB > -100; if (torpB.visible) torpB.position.set(W.torpB, 0.02, -10.85);
  splashA.visible = (W.splashA || 0) > 0.02; if (splashA.visible) splashA.scale.setScalar(W.splashA);
  splashB.visible = (W.splashB || 0) > 0.02; if (splashB.visible) splashB.scale.setScalar(W.splashB);
  for (const k of Object.keys(BOATS)) { const B = BOATS[k], v = W[k]; if (!v) { B.g.visible = false; continue; } B.g.visible = true;
    B.g.position.set(v[0], v[1] + Math.sin(f * 0.05 + v[0]) * 0.03, v[2]); B.g.rotation.y = v[3] || 0; B.g.rotation.z = Math.sin(f * 0.04 + v[2]) * 0.02;
    const row = v[4] || 0; B.oarL.rotation.y = Math.sin(f * 0.11) * 0.5 * row; B.oarR.rotation.y = Math.sin(f * 0.11 + 0.6) * 0.5 * row;
    B.ring.visible = v[1] < 0.5; }
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
