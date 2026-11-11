import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, heroPosAt, markersLayout } from './story.js';

// TIMING as tuple rows [id, firstFrame, lastFrame] — contiguous, covers 0..1455
const TIMING = [
  ['hook', 0, 132], ['hospice', 133, 268], ['blizzard', 269, 398], ['patrol', 399, 504],
  ['closeup', 505, 630], ['search', 631, 763], ['rescue', 764, 899], ['count', 900, 1037],
  ['barrel', 1038, 1137], ['old', 1138, 1277], ['museum', 1278, 1455],
];
window.TIMING = TIMING;

const W = 1080, H = 1920;
const canvas = document.createElement('canvas');
canvas.id = 'c'; canvas.width = W; canvas.height = H;
document.body.appendChild(canvas);
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
  stone: texM(P.stone(4), 1, 1), stoneDark: texM(P.stone(14, 30, 10, 52), 1, 1),
  snow: texM(P.plaster(8, 215), 30, 30, '#e6eef8'),
  logWall: texM(P.planks(5), 2, 2, '#97795a'),
  roofWood: texM(P.planks(9), 2, 1, '#5d4a38'), snowTop: texM(P.plaster(10, 215), 2, 2, '#f2f7fd'),
  floorWood: texM(P.planks(11), 6, 6, '#8a6a4c'),
};
const MW = {
  pine: toon({ color: '#2c4a3e' }), pineSnow: toon({ color: '#cfe0ee' }),
  hill: toon({ color: '#aebfd8' }), rock: toon({ color: '#77808e' }), darkIn: toon({ color: '#241d18' }),
  iron: toon({ color: '#5c5a57' }), darkMetal: toon({ color: '#3c4148' }),
  lampGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,190,110', 0.85)), transparent: true, fog: false, depthWrite: false }),
  winGlow: new THREE.MeshBasicMaterial({ color: '#ffb45e', fog: false }),
  red: toon({ color: '#b03a30' }), white: toon({ color: '#eef2f6' }), banner: toon({ color: '#8e2f28' }),
  paw: new THREE.MeshBasicMaterial({ color: 0x9fb4cc, transparent: true, opacity: 0.55, depthWrite: false }),
  markerOff: toon({ color: '#8b93a0' }),
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

// ---------- world: Great St Bernard Hospice, the pass trail, the museum ----------
// Hospice group at (0,0,-11): main block front face z=-8, door (0,0,-7.9).
// Trail: paw-print path from (0,-5) curving to the rescue drift (3,0,14.5).
// Museum hall centred (40,0,40): back wall z=30.5, floor 24x20, plinth (40,0,40).
const DECK = 0;
const world = new THREE.Group(); scene.add(world);
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };

const ground = flat(add(new THREE.CircleGeometry(170, 40), M.snow, 0, 0, 0, world, { cast: false }));
// packed-snow trail strip along the pass
{ const st = flat(add(new THREE.PlaneGeometry(4.6, 34), texM(P.plaster(12, 215), 2, 16, '#dde7f2'), 1.2, 0.012, 6, world, { cast: false })); st.rotation.z = 0.05; }
// drifts: layered mounds everywhere except the hero mark and the trail centre
{ const r = P.rng(31);
  for (let i = 0; i < 34; i++) {
    const a = r() * Math.PI * 2, d = 8 + r() * 60, x = Math.cos(a) * d, z = Math.sin(a) * d + 2;
    if (Math.hypot(x - 1.2, (z - 6) * 0.4) < 5.5) continue;         // keep trail readable
    if (Math.hypot(x, z + 1) < 4) continue;                          // hero mark clear
    if (Math.hypot(x - 40, z - 40) < 15) continue;                   // museum clear
    const s = add(new THREE.SphereGeometry(0.9 + r() * 1.9, 10, 8), M.snowTop, x, -0.3, z, world, { cast: false });
    s.scale.y = 0.3 + r() * 0.22;
  }
  // hero drifts flanking the rescue spot + search zone (layered, never flat)
  for (const [x, z, s] of [[5.6, 13.2, 2.2], [0.2, 17.8, 1.8], [6.4, 17.0, 1.5], [-2.2, 12.4, 1.6], [4.8, 11.0, 1.2], [-3.4, 16.8, 2.0]]) {
    const m = add(new THREE.SphereGeometry(s, 12, 9), M.snowTop, x, -s * 0.32, z, world, { cast: false }); m.scale.y = 0.42;
  }
  // rocky outcrops breaking the white (foreground texture)
  for (const [x, z, s] of [[-6.5, 4, 0.85], [7.8, 6.5, 1.1], [-5.8, 19, 0.95], [9, -2, 0.8], [-8.5, -4, 1.15]]) {
    const m = add(new THREE.DodecahedronGeometry(s, 0), MW.rock, x, s * 0.18, z, world, { cast: false }); m.rotation.set(r() * 2, r() * 2, 0);
  }
}
// distant Alpine peaks: tall snow cones on the horizon (never a flat grey wall)
{ const peakM = toon({ color: '#bfcfe4' }), peakRock = toon({ color: '#8d99ab' });
  for (const [hx, hz, hr, hh] of [[-71, -56, 34, 44], [-32, -81, 27, 36], [21, -84, 36, 48], [69, -59, 29, 38], [89, -14, 32, 42], [-89, -17, 30, 40], [-74, 62, 33, 44], [69, 74, 35, 46], [0, -94, 40, 52]]) {
    const pk = add(new THREE.ConeGeometry(hr, hh, 7), peakRock, hx, hh * 0.30, hz, world, { cast: false }); pk.userData.ndSkip = true;
    const cap = add(new THREE.ConeGeometry(hr * 0.52, hh * 0.52, 7), M.snowTop, hx, hh * 0.72, hz, world, { cast: false }); cap.userData.ndSkip = true;
  } }
const pineAt = (x, z, h = 4.2, parent = world) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  add(new THREE.CylinderGeometry(0.09, 0.14, h * 0.3, 7), M.beamDark, 0, h * 0.15, 0, g, { cast: false });
  for (let i = 0; i < 3; i++) {
    const y = h * (0.32 + i * 0.2), r = h * (0.30 - i * 0.075);
    add(new THREE.ConeGeometry(r, h * 0.34, 9), MW.pine, 0, y, 0, g, { cast: false });
    add(new THREE.ConeGeometry(r * 0.62, h * 0.16, 9), MW.pineSnow, 0, y + h * 0.09, 0, g, { cast: false });
  }
  return g;
};
pineAt(-7.5, -15, 5.4); pineAt(8.6, -14, 4.8); pineAt(-11, -7, 6); pineAt(11.5, -5, 5.2); pineAt(-6.2, -19, 6.4);
pineAt(6.8, -20, 5.6); pineAt(-13, 3, 4.8); pineAt(12.5, 9, 5.4); pineAt(-9.5, 11, 4.4); pineAt(10, 18, 5);
pineAt(-7.2, 20.5, 4.6); pineAt(13.5, -12, 4.2); pineAt(-14.5, -13, 5.2); pineAt(8.8, 22, 5.6); pineAt(-11.5, 24, 4.8);

// ---------- the hospice: big stone house of refuge ----------
const winMats = [];
const hospice = new THREE.Group(); hospice.position.set(0, 0, -11); world.add(hospice);
{
  add(tbox(12.5, 5.2, 6, 2), M.stone, 0, 2.6, 0, hospice);                       // main block
  add(tbox(4.6, 3.6, 5, 2), M.stoneDark, -8.2, 1.8, 0.3, hospice);               // west wing
  add(tbox(4.6, 3.6, 5, 2), M.stoneDark, 8.2, 1.8, 0.3, hospice);                // east wing
  for (const sd of [-1, 1]) { // steep snow roof
    const rf = add(tbox(7.6, 0.12, 7.2, 2), M.roofWood, sd * 3.1, 6.05, 0, hospice); rf.rotation.z = -sd * 0.6;
    const sn = add(tbox(7.7, 0.09, 7.3, 2), M.snowTop, sd * 3.18, 6.22, 0, hospice, { cast: false }); sn.rotation.z = -sd * 0.6;
  }
  add(box(1.7, 2.9, 0.14), MW.darkIn, 0, 1.45, 3.02, hospice, { cast: false });  // door
  add(box(1.9, 0.16, 0.2), M.beamDark, 0, 3.0, 3.04, hospice, { cast: false });
  add(new THREE.SphereGeometry(0.09, 8, 6), MW.iron, 0.55, 1.45, 3.12, hospice, { cast: false });
  for (const wx of [-4.4, -2.6, 2.6, 4.4]) for (const wy of [1.7, 3.6]) {        // glowing windows
    const wm = MW.winGlow.clone(); winMats.push(wm);
    const wp = add(new THREE.PlaneGeometry(0.72, 0.92), wm, wx, wy, 3.015, hospice, { cast: false }); wp.userData.ndSkip = true;
    add(box(0.84, 0.07, 0.05), M.beamDark, wx, wy + 0.5, 3.03, hospice, { cast: false });
    add(box(0.84, 0.07, 0.05), M.beamDark, wx, wy - 0.5, 3.03, hospice, { cast: false });
  }
  for (const wx of [-8.2, 8.2]) {
    const wm = MW.winGlow.clone(); winMats.push(wm);
    const wp = add(new THREE.PlaneGeometry(0.66, 0.84), wm, wx, 1.9, 2.83, hospice, { cast: false }); wp.userData.ndSkip = true;
  }
  // stone step + crates + barrels by the door (foreground dressing)
  add(tbox(2.6, 0.22, 1.1, 2), M.stone, 0, 0.11, 3.6, hospice);
}
// hospice sign board (canvas texture, centred over the door)
const signCanvas = document.createElement('canvas'); signCanvas.width = 1024; signCanvas.height = 256;
{ const g = signCanvas.getContext('2d');
  g.fillStyle = '#6d5136'; g.fillRect(0, 0, 1024, 256); g.fillStyle = '#7d5f40'; g.fillRect(10, 10, 1004, 236);
  g.strokeStyle = '#3a2a18'; g.lineWidth = 10; g.strokeRect(18, 18, 988, 220);
  g.textAlign = 'center'; g.fillStyle = '#fdf6e3'; g.font = '900 92px Arial Black, Arial';
  g.fillText('ST BERNARD', 512, 108); g.font = '900 74px Arial Black, Arial'; g.fillStyle = '#ffd76a'; g.fillText('HOSPICE', 512, 202);
}
const signTex = new THREE.CanvasTexture(signCanvas); signTex.colorSpace = THREE.SRGBColorSpace; signTex.anisotropy = 4;
{ const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.08), new THREE.MeshBasicMaterial({ map: signTex, fog: true }));
  sign.position.set(-0.4, 3.62, -7.7); sign.userData.ndSkip = true; world.add(sign);
  add(tbox(3.7, 1.2, 0.1, 2), M.beamDark, -0.4, 3.62, -7.79, world, { cast: false });
}
// chimney (smoke emitter spot)
const CHIMNEY = [3.4, 6.9, -12.2];
add(box(0.5, 1.3, 0.5), M.stone, CHIMNEY[0], CHIMNEY[1] - 0.5, CHIMNEY[2], world, { cast: false });
// door-side props: crates, barrels, firewood, sled
{ const c1 = FX.crate(0.85); c1.position.set(-2.6, 0.43, -6.9); world.add(c1);
  const c2 = FX.crate(0.62); c2.position.set(-2.5, 1.15, -6.95); c2.rotation.y = 0.5; world.add(c2);
  const b1 = FX.barrel(0.42, 1.0); b1.position.set(2.7, 0.5, -6.8); world.add(b1);
  const b2 = FX.barrel(0.42, 1.0); b2.position.set(3.45, 0.5, -7.1); world.add(b2);
  for (let i = 0; i < 5; i++) { const l = add(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 7), M.beamDark, -3.6, 0.12 + (i > 2 ? 0.17 : 0), -7.3 + (i % 3) * 0.17, world, { cast: false }); l.rotation.z = Math.PI / 2; }
  const sled = new THREE.Group(); sled.position.set(4.4, 0, -5.4); sled.rotation.y = 0.7; world.add(sled);
  for (const sd of [-0.26, 0.26]) add(box(0.05, 0.09, 2.2), M.beamDark, sd, 0.1, 0, sled, { cast: false });
  for (let i = 0; i < 4; i++) add(box(0.58, 0.05, 0.34), M.logWall, 0, 0.3, -0.75 + i * 0.5, sled, { cast: false });
}
// hospice flag: white pole + red-cross flag (waves in worldState)
const flagCloth = (() => {
  const geo = new THREE.PlaneGeometry(1.15, 0.72, 8, 4); geo.translate(0.575, 0, 0);
  const m = new THREE.Mesh(geo, toon({ color: '#f2f0e8', side: THREE.DoubleSide }));
  m.position.set(5.6, 4.6, -7.6); world.add(m);
  add(new THREE.CylinderGeometry(0.045, 0.055, 4.8, 7), M.beamDark, 5.6, 2.4, -7.6, world);
  const cross = new THREE.Group(); cross.position.set(0, 0, 0.01); // simple cross planes ride with the flag via parenting trick below
  return m;
})();
FX.clothInit(flagCloth, { amp: 0.16, freq: 2.6, speed: 2.2, axis: 'x' });
{ const c1 = add(box(0.34, 0.11, 0.02), MW.red, 0, 0, 0, world, { cast: false }); c1.position.set(6.15, 4.6, -7.55); c1.userData.flagCross = true;
  const c2 = add(box(0.11, 0.34, 0.02), MW.red, 0, 0, 0, world, { cast: false }); c2.position.set(6.15, 4.6, -7.55); c2.userData.flagCross = true;
  world.userData.crosses = [c1, c2];
}

// lantern posts (0,1 hospice yard · 2,3 along the trail / rescue)
const lanterns = [];
const lanternAt = (x, z) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(new THREE.CylinderGeometry(0.045, 0.055, 2.2, 7), M.beamDark, 0, 1.1, 0, g);
  add(new THREE.ConeGeometry(0.2, 0.14, 4), M.darkMetal, 0, 2.32, 0, g, { cast: false });
  add(tbox(0.2, 0.03, 0.2, 1), M.darkMetal, 0, 1.78, 0, g, { cast: false });
  add(tbox(0.2, 0.03, 0.2, 1), M.darkMetal, 0, 2.14, 0, g, { cast: false });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), FX.glassMat(0xffc37a, 0.2));
  glass.position.y = 1.96; glass.userData.ndSkip = true; g.add(glass);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffb45e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(0.8); glow.position.y = 1.96; glow.userData.ndSkip = true; g.add(glow);
  const glint = FX.glint(0.45); glint.position.set(0.06, 2.05, 0.1); glint.material.opacity = 0; glint.userData.ndSkip = true; g.add(glint);
  const pool = flat(add(new THREE.CircleGeometry(1.25, 18), MW.lampGlow, 0, 0.015, 0, g, { cast: false }));
  pool.material = MW.lampGlow.clone(); pool.material.opacity = 0; pool.userData.ndSkip = true; pool.receiveShadow = false;
  lanterns.push({ glow, pool, glass, glint });
  return g;
};
lanternAt(-2.9, -4.6); lanternAt(3.1, -4.4); lanternAt(-1.8, 7.5); lanternAt(4.6, 12.2);

// trail dressing: snow poles with red flags + a low fence run + paw-print trail
{ const poleMat = M.beamDark;
  for (const [x, z, side] of [[4.6, -2, 1], [4.9, 2.5, 1], [4.4, 16.5, 1], [4.8, 20.5, 1], [-3.4, -2.5, -1]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
    const p = add(new THREE.CylinderGeometry(0.035, 0.045, 1.7, 6), poleMat, 0, 0.85, 0, g, { cast: false }); p.rotation.z = side * 0.05;
    add(box(0.4, 0.24, 0.02), MW.red, side * 0.22, 1.55, 0, g, { cast: false });
  }
  for (let i = 0; i < 5; i++) { // fence posts + rails west of the trail
    const z = -1 + i * 3.4, x = -4.8 + Math.sin(z * 0.16) * 0.6;
    add(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 6), poleMat, x, 0.5, z, world, { cast: false });
    if (i < 4) { const r = add(box(0.07, 0.09, 3.4), poleMat, x + 0.03, 0.78, z + 1.7, world, { cast: false }); r.rotation.y = 0.03; }
  }
  // paw prints: alternating small pads from the door to the rescue drift
  const pawGeo = new THREE.CircleGeometry(0.09, 8);
  for (let i = 0; i < 30; i++) {
    const t = i / 29, z = -4.5 + t * 19.5, x = 0.4 + Math.sin(t * 2.4) * 0.9 + (i % 2 ? 0.19 : -0.19);
    const p = flat(add(pawGeo, MW.paw, x, 0.02 + (i % 3) * 0.001, z, world, { cast: false }));
    p.scale.set(1, 1.35, 1); p.userData.ndSkip = true; p.receiveShadow = false;
  }
}

// burial mounds heaped over the buried traveller + his dropped crate
{ const m1 = add(new THREE.SphereGeometry(1.35, 12, 9), M.snowTop, 3.5, -0.5, 15.5, world, { cast: false }); m1.scale.y = 0.4;
  const m2 = add(new THREE.SphereGeometry(0.95, 11, 8), M.snowTop, 2.1, -0.36, 15.9, world, { cast: false }); m2.scale.y = 0.42;
  const dc = FX.crate(0.55); dc.position.set(4.35, 0.2, 13.5); dc.rotation.set(0.2, 0.7, 0.35); world.add(dc); }

// ---------- count markers: 40 rescued-traveller flags over the pass ----------
const markerGroups = [];
{ const lay = markersLayout(0);
  for (let i = 0; i < 40; i++) {
    const g = new THREE.Group(); g.position.set(lay[i].x, 0, lay[i].z); world.add(g);
    add(new THREE.CylinderGeometry(0.03, 0.04, 1.15, 6), M.beamDark, 0, 0.57, 0, g, { cast: false });
    const flag = add(box(0.44, 0.3, 0.02), MW.red, 0.24, 1.02, 0, g, { cast: false }); flag.userData.ndSkip = false;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffd76a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.15); glow.position.y = 1.0; glow.userData.ndSkip = true; g.add(glow);
    const mound = add(new THREE.SphereGeometry(0.55, 9, 7), M.snowTop, 0, -0.16, 0, g, { cast: false }); mound.scale.y = 0.4;
    g.visible = false;
    markerGroups.push({ g, glow });
  }
}

// ---------- the museum hall (Bern): warm interior around the plinth ----------
{
  const g = new THREE.Group(); g.position.set(40, 0, 40); world.add(g); world.userData.hall = g;
  const floor = flat(add(new THREE.PlaneGeometry(24, 20), M.floorWood, 0, 0.03, 0, g, { cast: false }));
  add(tbox(24, 7.5, 0.5, 2), M.stoneDark, 0, 3.75, -9.7, g);                        // back wall
  for (const sd of [-1, 1]) add(tbox(0.5, 7.5, 20, 2), M.stoneDark, sd * 11.7, 3.75, 0, g); // side walls
  for (const sd of [-1, 1]) { const col = add(new THREE.CylinderGeometry(0.42, 0.48, 7.2, 12), M.stone, sd * 6.5, 3.6, -6, g); // columns
    add(tbox(1.3, 0.35, 1.3, 2), M.stone, sd * 6.5, 7.1, -6, g, { cast: false }); }
  for (let i = 0; i < 3; i++) add(tbox(24, 0.35, 0.4, 2), M.beamDark, 0, 7.4, -7 + i * 6.5, g, { cast: false }); // roof beams
  // plinth
  add(tbox(2.4, 0.24, 2.4, 2), M.stone, 0, 0.12, 0, g);
  add(tbox(1.8, 0.68, 1.8, 2), M.stone, 0, 0.58, 0, g);
  add(tbox(2.1, 0.12, 2.1, 2), M.stone, 0, 0.98, 0, g);
  add(box(0.72, 0.44, 0.05), M.logWall, 0, 0.58, 0.93, g, { cast: false });       // plaque
  // red banners on the back wall + display cases either side
  for (const sd of [-1, 1]) {
    add(box(1.5, 3.6, 0.06), MW.banner, sd * 3.9, 5.0, -9.4, g, { cast: false });
    add(box(0.5, 0.14, 0.03), MW.white, sd * 3.9, 5.35, -9.36, g, { cast: false });
    add(box(0.14, 0.5, 0.03), MW.white, sd * 3.9, 5.35, -9.36, g, { cast: false });
    const dc = new THREE.Group(); dc.position.set(sd * 5.6, 0, 2.5); g.add(dc);
    add(tbox(1.7, 0.75, 0.9, 2), M.logWall, 0, 0.38, 0, dc, { cast: false });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.8), FX.glassMat(0xcfe4ee, 0.25));
    glass.position.y = 1.18; glass.userData.ndSkip = true; dc.add(glass);
    const mini = FX.barrel(0.2, 0.48); mini.position.set(0, 0.95, 0); dc.add(mini); // a little collar barrel under glass
  }
  // rope barrier in front of the plinth
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.85, 7), MW.iron, sd * 2.6, 0.43, 3.4, g, { cast: false });
  add(box(5.2, 0.07, 0.07), MW.banner, 0, 0.78, 3.4, g, { cast: false });
}
// barrel glint (S9) + museum glint + rescue lamp glow sprites
const barrelGlint = FX.glint(0.5); barrelGlint.position.set(0.1, 1.06, -1.45); barrelGlint.material.opacity = 0; barrelGlint.userData.ndSkip = true; scene.add(barrelGlint);
const museumGlint = FX.glint(0.42); museumGlint.position.set(40.3, 2.5, 40.4); museumGlint.material.opacity = 0; museumGlint.userData.ndSkip = true; scene.add(museumGlint);
const rescueGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffb45e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
rescueGlow.scale.setScalar(1.5); rescueGlow.position.set(1.6, 1.35, 11.9); rescueGlow.userData.ndSkip = true; scene.add(rescueGlow);

// ---------- FX (Coded FX Library) ----------
const smoke = new FX.Smoke(scene, 90); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const smokeEmit = smoke.addEmitter(CHIMNEY[0], CHIMNEY[1] + 0.3, CHIMNEY[2], { rate: 2.4, color: 0xaab2bc, opacity: 0.16, scale: 0.45, grow: 1.15, life: 2.8, vy: 1.1, wind: 0.5 });
const fxClouds = new FX.Clouds(scene, { count: 5, y: 60, opacity: 0.2, color: 0x93a7c4, drift: 0.4 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const mist = FX.mistBand(scene, { count: 8, y: 0.8, opacity: 0.3 });
mist.children.forEach((s, i) => {
  s.position.set(1 + (i % 3) * 1.8, 0.5 + (i % 3) * 0.2, -6 + i * 3.4);
  s.scale.set(11 + (i % 3) * 3, 2.6, 1);
  s.userData.bx = s.position.x; s.userData.ndSkip = true;
});
const splashes = new FX.Splashes(scene, 160); splashes.points.userData.ndSkip = true;
// falling / blowing snow: deterministic points field
const SNOW_N = 800;
const snowBase = new Float32Array(SNOW_N * 3), snowPos = new Float32Array(SNOW_N * 3), snowSpd = new Float32Array(SNOW_N), snowPh = new Float32Array(SNOW_N);
{ const r = P.rng(97);
  for (let i = 0; i < SNOW_N; i++) {
    snowBase[i * 3] = -45 + r() * 90; snowBase[i * 3 + 1] = r() * 40; snowBase[i * 3 + 2] = -35 + r() * 85;
    snowSpd[i] = 0.65 + r() * 0.8; snowPh[i] = r() * 6.28;
  } }
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: FX.puffTexture(), color: 0xffffff, size: 0.32, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true }));
snowPts.userData.ndSkip = true; snowPts.frustumCulled = false; scene.add(snowPts);
const wrap = (v, a, b) => ((v - a) % (b - a) + (b - a)) % (b - a) + a;

// ---------- FX simulation (stateful library systems, stepped deterministically) ----------
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  splashes.life.fill(-1);
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    smokeEmit.rate = pr.smokeRate;
    smoke.update(t, dt);
    // powder kicked up around Barry's paws while he searches / walks in old age
    const S = shotAt(fxF);
    if ((S.id === 'search' && fxF % 11 === 0) || (S.id === 'old' && fxF % 16 === 0)) {
      const hp = heroPosAt(fxF); if (hp) splashes.burst(hp[0], 0.12, hp[2], { n: 7, power: 2.2 });
    }
    splashes.update(t, dt);
    fxClouds.update(t, dt);
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

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
const WIN_DIM = new THREE.Color('#4a3a2c'), WIN_LIT = new THREE.Color('#ffb45e');
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  skyU.aur.value = L.aurora || 0;
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
  skyU.time.value = t;
  mist.children.forEach((s, i) => {
    s.position.x = s.userData.bx + Math.sin(f * 0.008 + i * 1.7) * 0.9;
    s.material.opacity = 0.42 * Ws.mist * (0.75 + 0.25 * Math.sin(f * 0.013 + i * 2.1));
  });
  const on = new Set(Ws.lanternSet || []);
  lanterns.forEach((L, i) => {
    const k = on.has(i) ? 1 : 0;
    L.glow.material.opacity = k * (0.38 + 0.05 * Math.sin(f * 0.9 + i * 2.3));
    L.pool.material.opacity = k * 0.32;
    L.glass.material.opacity = k ? 0.55 : 0.2;
    L.glint.material.opacity = k ? 0.55 + 0.3 * Math.sin(f * 0.23 + i) : 0;
  });
  winMats.forEach((m) => { m.color.copy(WIN_DIM).lerp(WIN_LIT, Ws.winGlow); });
  if (world.userData.hall) world.userData.hall.visible = Ws.shot === 'museum';
  // count markers: exactly Ws.count active
  const lay = markersLayout(f);
  markerGroups.forEach((mk, i) => {
    mk.g.visible = !!lay[i].active;
    mk.glow.material.opacity = lay[i].active ? 0.3 + 0.3 * lay[i].pulse : 0;
  });
  // flag cloth + its red cross rides the wave crest
  FX.clothWave(flagCloth, t);
  const crest = Math.sin(t * 2.2 * 2.6) * 0.1;
  (world.userData.crosses || []).forEach((c) => { c.position.y = 4.6 + crest * 0.4; c.rotation.y = Math.sin(t * 5.7) * 0.18; });
  barrelGlint.material.opacity = (Ws.barrelGlint || 0) * 0.85;
  museumGlint.material.opacity = (Ws.glintK || 0) * (0.6 + 0.4 * Math.sin(f * 0.3));
  rescueGlow.material.opacity = (Ws.rescueLamp || 0) * (0.4 + 0.08 * Math.sin(f * 0.9));
  // falling / blowing snow
  {
    const fall = 1.15 * (0.45 + 0.75 * Ws.snowK), wind = Ws.windK || 0;
    const n = Math.floor(SNOW_N * (0.25 + 0.75 * clamp01(Ws.snowK)));
    snowGeo.setDrawRange(0, n);
    for (let i = 0; i < n; i++) {
      snowPos[i * 3] = wrap(snowBase[i * 3] + Math.sin(t * 0.7 + snowPh[i]) * 0.7 - wind * t * 0.55, -45, 45);
      snowPos[i * 3 + 1] = wrap(snowBase[i * 3 + 1] - t * fall * snowSpd[i], 0, 40);
      snowPos[i * 3 + 2] = wrap(snowBase[i * 3 + 2] + Math.cos(t * 0.5 + snowPh[i]) * 0.6 - wind * t * 0.3, -35, 50);
    }
    snowGeo.attributes.position.needsUpdate = true;
    snowPts.material.opacity = Ws.snowK <= 0.01 ? 0 : 0.35 + 0.55 * clamp01(Ws.snowK);
    snowPts.material.size = 0.3 + 0.05 * Math.min(Ws.windK || 0, 3);
    snowPts.visible = Ws.snowK > 0.01;
  }
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
  window.WORLD = Ws;
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
