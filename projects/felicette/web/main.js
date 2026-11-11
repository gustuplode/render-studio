import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, rocketYAt, capsuleYAt, heroPosAt, IGNITION_F } from './story.js';

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
  stone: texM(P.stone(4), 1, 1),
  snow: texM(P.plaster(8, 215), 30, 30, '#e6eef8'),
  wallWarm: texM(P.plaster(21, 40), 3, 2, '#cbb59a'), wallCool: texM(P.plaster(22, 210), 3, 2, '#9fb0bd'),
  roofWood: texM(P.planks(9), 2, 1, '#5d4a38'), snowTop: texM(P.plaster(10, 215), 2, 2, '#f2f7fd'),
  metal: texM(P.panelMetal(41), 1, 1, '#dfe5ea'), metalDark: texM(P.panelMetal(43, 220), 1, 1, '#8d97a2'),
  brick: texM(P.stone(14, 20, 30, 52), 2, 2, '#b98a6d'),
};
const MW = {
  pine: toon({ color: '#2c4a3e' }), pineSnow: toon({ color: '#cfe0ee' }),
  hill: toon({ color: '#aebfd8' }), darkIn: toon({ color: '#241d18' }),
  iron: toon({ color: '#5c5a57' }), darkMetal: toon({ color: '#3c4148' }),
  lampGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,190,110', 0.85)), transparent: true, fog: false, depthWrite: false }),
  winGlow: new THREE.MeshBasicMaterial({ color: '#ffb45e', fog: false }),
  red: toon({ color: '#b03a30' }), white: toon({ color: '#eef2f6' }), cabin: toon({ color: '#8d9aa8' }),
  gold: toon({ color: '#c9a227' }), rocketRed: toon({ color: '#c8402e' }),
  silh: toon({ color: '#2e3a52' }), silh2: toon({ color: '#38455f' }),
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
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor = vec4(0.,0.,0.,vD); }`,
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

// ---------- sky (gradient + sun/moon disc + AURORA curtains) ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 }, aur: { value: 0 }, time: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize, aur, time; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      if (aur > 0.003 && vP.y > 0.02) {
        float az = atan(vP.z, vP.x);
        float wave = sin(az*3.0 + time*0.11 + sin(vP.y*8.0 + time*0.06)*1.6);
        float band = smoothstep(0.10, 0.34, vP.y) * (1.0 - smoothstep(0.48, 0.85, vP.y));
        float curtain = 0.55 + 0.45*sin(vP.y*46.0 - time*0.45 + az*7.0 + wave*2.0);
        vec3 aurCol = mix(vec3(0.16,0.92,0.42), vec3(0.38,0.36,0.95), clamp(vP.y*1.5-0.25, 0., 1.));
        c += aurCol * band * (0.30 + 0.38*wave) * curtain * aur;
      }
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- shared set builders ----------
const DECK = 0;
const world = new THREE.Group(); scene.add(world);
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const ground = flat(add(new THREE.CircleGeometry(430, 40), texM(P.plaster(8, 32), 34, 34, '#dcbd85'), 0, 0, 0, world, { cast: false }));

const winMats = [];
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
// text board prop: posts + plank back + canvas face (Balto map-board pattern)
const makeBoard = (lines, wB, hB, cx, cy, cz, ry = 0, parent = world) => {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry; parent.add(g);
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * hB / wB);
  const c2 = cv.getContext('2d');
  c2.fillStyle = '#232c3e'; c2.fillRect(0, 0, cv.width, cv.height);
  c2.strokeStyle = '#c9a227'; c2.lineWidth = 14; c2.strokeRect(18, 18, cv.width - 36, cv.height - 36);
  c2.textAlign = 'center'; c2.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    let size = i === 0 ? 190 : 120;
    c2.font = `900 ${size}px Arial`;
    while (c2.measureText(ln).width > cv.width - 120 && size > 40) { size -= 10; c2.font = `900 ${size}px Arial`; }
    c2.fillStyle = i === 0 ? '#ffd23e' : '#ffffff';
    c2.fillText(ln, cv.width / 2, cv.height * (lines.length === 1 ? 0.52 : (i === 0 ? 0.32 : 0.72)));
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  for (const sd of [-wB / 2 + 0.3, wB / 2 - 0.3]) add(new THREE.CylinderGeometry(0.09, 0.11, hB + 1.1, 8), M.beamDark, sd, cy - 0.55, 0, g);
  add(tbox(wB + 0.5, hB + 0.4, 0.14, 2), M.beam, 0, cy, -0.1, g);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(wB, hB), new THREE.MeshBasicMaterial({ map: tex, fog: true }));
  face.position.set(0, cy, 0.0); face.userData.ndSkip = true; g.add(face);
  return g;
};
// street lantern post with glass lantern (Balto pattern)
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
  glow.scale.setScalar(0.75); glow.position.y = 1.96; glow.userData.ndSkip = true; g.add(glow);
  const glint = FX.glint(0.45); glint.position.set(0.06, 2.05, 0.1); glint.material.opacity = 0; glint.userData.ndSkip = true; g.add(glint);
  const pool = flat(add(new THREE.CircleGeometry(1.2, 18), MW.lampGlow, 0, 0.015, 0, g, { cast: false }));
  pool.material = MW.lampGlow.clone(); pool.material.opacity = 0; pool.userData.ndSkip = true; pool.receiveShadow = false;
  lanterns.push({ glow, pool, glass, glint });
  return g;
};

// ---------- DESERT PAD set (origin): Véronique rocket on the Sahara apron ----------
const CHIMNEYS = [[38.5, 9.6, -9], [49.5, 10.6, 3]]; // Paris rooftops (smoke emitters)
const sandMat = texM(P.plaster(8, 32), 26, 26, '#dcbd85');
const duneMat = toon({ color: '#d3af72' }), rockMat = toon({ color: '#9a7c55' });
const ROCKET_G = new THREE.Group();
const makeRocket = (parent, x, z, s) => { // slender white Véronique AGI: long body, red band, 4 fins
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
  add(new THREE.CylinderGeometry(0.62, 0.72, 10.5, 14), MW.white, 0, 5.25, 0, g);
  add(new THREE.ConeGeometry(0.62, 3.0, 14), MW.white, 0, 12.2, 0, g);
  add(new THREE.CylinderGeometry(0.64, 0.64, 0.55, 14), MW.rocketRed, 0, 8.6, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.3, 0.62, 1.1, 12), MW.darkMetal, 0, 0.55, 0, g, { cast: false });
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const fin = add(box(0.08, 1.9, 0.85), MW.rocketRed, Math.cos(a) * 0.85, 0.95, Math.sin(a) * 0.85, g, { cast: false });
    fin.rotation.y = -a;
  }
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), FX.glassMat(0xffd9a0, 0.6));
  win.position.set(0, 7.6, -0.64); win.rotation.y = Math.PI; win.userData.ndSkip = true; g.add(win);
  return g;
};
{
  const padDisc = flat(add(new THREE.CircleGeometry(16, 28), texM(P.stone(31, 32, 10, 46), 8, 8, '#b8a888'), 0, 0.02, -4, world, { cast: false }));
  ROCKET_G.position.set(0, 0, -8); world.add(ROCKET_G);
  makeRocket(ROCKET_G, 0, 0, 1);
  const gt = new THREE.Group(); gt.position.set(3.4, 0, -8); world.add(gt); // gantry
  for (const [px, pz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) add(box(0.14, 12.5, 0.14), MW.iron, px, 6.25, pz, gt);
  for (let i = 0; i < 5; i++) { const y = 1.4 + i * 2.6;
    add(box(1.36, 0.09, 0.09), MW.iron, 0, y, -0.6, gt, { cast: false }); add(box(1.36, 0.09, 0.09), MW.iron, 0, y, 0.6, gt, { cast: false });
    add(box(0.09, 0.09, 1.36), MW.iron, -0.6, y, 0, gt, { cast: false }); add(box(0.09, 0.09, 1.36), MW.iron, 0.6, y, 0, gt, { cast: false }); }
  for (const ay of [4.4, 8.8]) add(box(2.6, 0.13, 0.28), MW.rocketRed, -1.7, ay, 0, gt, { cast: false });
  add(box(3.0, 0.16, 1.6), MW.iron, 0, 12.6, 0, gt, { cast: false });
  // Félicette's capsule carrying box on a trolley (desert beat)
  const bx = new THREE.Group(); bx.position.set(1.2, 0, -5.8); world.add(bx);
  add(tbox(1.15, 0.5, 0.85, 1), M.metalDark, 0, 0.32, 0, bx);
  add(tbox(1.25, 0.1, 0.95, 1), MW.rocketRed, 0, 0.62, 0, bx, { cast: false });
  for (const [wx, wz] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]]) { const w = add(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 10), MW.darkMetal, wx, 0.06, wz, bx, { cast: false }); w.rotation.x = Math.PI / 2; }
  makeBoard(['HAMMAGUIR', '18 OCT 1963'], 5.6, 2.7, -6.4, 2.4, -13, 0.5);
  // dunes + rocks ringing the desert
  for (const [dx, dy, dz, dr] of [[-60, -6, -55, 30], [45, -7, -60, 32], [102, -9, -72, 28], [-85, -8, -10, 26], [10, -9, -95, 40]]) {
    const d = add(new THREE.SphereGeometry(dr, 16, 10), duneMat, dx, dy, dz, world, { cast: false }); d.scale.y = 0.42;
  }
  for (const [rx2, rz2, rs] of [[-9, 3, 0.5], [12, -14, 0.7], [-13, -16, 0.4], [9, 6, 0.35]]) add(new THREE.DodecahedronGeometry(rs, 0), rockMat, rx2, rs * 0.5, rz2, world, { cast: false });
}
// return capsule + parachute (RETURN beat): capsule sphere, cloth canopy that breathes
const RETURN_G = new THREE.Group(); scene.add(RETURN_G);
const PARA = new THREE.Group();
{
  const capBody = add(new THREE.SphereGeometry(1.05, 18, 14), MW.white, 0, 0, 0, RETURN_G, { cast: false });
  capBody.scale.y = 0.82;
  add(new THREE.CylinderGeometry(0.5, 0.72, 0.5, 12), M.metalDark, 0, 0.85, 0, RETURN_G, { cast: false });
  const band = add(new THREE.TorusGeometry(1.02, 0.07, 8, 22), MW.rocketRed, 0, 0.1, 0, RETURN_G, { cast: false }); band.rotation.x = Math.PI / 2;
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.36, 18), FX.glassMat(0xffd9a0, 0.55));
  win.position.set(0, 0.15, -1.0); win.rotation.y = Math.PI; win.userData.ndSkip = true; RETURN_G.add(win);
  PARA.position.set(0, 3.4, 0); RETURN_G.add(PARA);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon({ color: '#e8762c', side: THREE.DoubleSide }));
  canopy.scale.y = 0.55; canopy.userData.ndSkip = false; PARA.add(canopy); PARA.userData.canopy = canopy;
  const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(2.32, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon({ color: '#f4f1e8', side: THREE.DoubleSide }));
  canopy2.scale.set(0.55, 0.56, 1); canopy2.rotation.y = 0.4; PARA.add(canopy2); PARA.userData.canopy2 = canopy2;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4, lx = Math.cos(a) * 2.0, lz = Math.sin(a) * 2.0;
    const line = add(new THREE.CylinderGeometry(0.016, 0.016, 2.6, 5), MW.darkMetal, lx * 0.5, -1.55, lz * 0.5, PARA, { cast: false });
    line.lookAt(new THREE.Vector3(0, -3.4 + 3.4, 0).add(new THREE.Vector3(0, 0, 0))); line.rotation.z = Math.atan2(lx, 2.6) * 0.9; line.rotation.x = -Math.atan2(lz, 2.6) * 0.9;
  }
  RETURN_G.position.set(0, 30, -1);
}
// dust devils: spiralling sand sprites over the desert (worldState animates)
const DUSTDEV = [];
for (let k = 0; k < 2; k++) {
  const grp = new THREE.Group(); scene.add(grp);
  const sprites = [];
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xe3cf9f, transparent: true, opacity: 0, depthWrite: false }));
    sp.userData.ndSkip = true; grp.add(sp); sprites.push(sp);
  }
  grp.userData.sprites = sprites; grp.position.set(k ? 14 : -16, 0, k ? -18 : 2);
  DUSTDEV.push(grp);
}

// ---------- PARIS ALLEY set at (44,0,-2): rooftops, chimney pots, dawn ----------
const buildingAt = (x, z, w, h, d, seed, mat) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  add(tbox(w, h, d, 2), mat, 0, h / 2, 0, g);
  const roof = add(tbox(w + 0.5, 0.22, d + 0.6, 2), M.roofWood, 0, h + 0.12, 0, g, { cast: false });
  for (let ci = 0; ci < Math.max(1, Math.floor(w / 3)); ci++) // chimney pots
    add(new THREE.CylinderGeometry(0.16, 0.2, 0.85, 8), M.brick, -w / 2 + 1.2 + ci * 3, h + 0.6, (ci % 2 ? 0.8 : -0.8), g, { cast: false });
  const cols = Math.max(2, Math.floor(w / 1.6)), rows = Math.max(2, Math.floor(h / 2.0));
  const faceDir = x < 44 ? 1 : -1; // windows face the alley (local +x / -x side)
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if ((i * 7 + j * 13 + seed) % 4 === 0) continue;
    const wm = MW.winGlow.clone(); winMats.push(wm);
    const wp = add(new THREE.PlaneGeometry(0.6, 0.85), wm, faceDir * (w / 2 + 0.02), 1.2 + j * 2.0, -d / 2 + (i + 0.5) * (d / cols), g, { cast: false });
    wp.rotation.y = faceDir > 0 ? Math.PI / 2 : -Math.PI / 2; wp.userData.ndSkip = true;
  }
  return g;
};
{ const cob = flat(add(new THREE.PlaneGeometry(8, 34), texM(P.stone(12, 220, 8, 40), 3, 13, '#9aa0a8'), 44, 0.012, -2, world, { cast: false })); }
buildingAt(37.8, -9, 4.5, 8.5, 10, 3, M.wallWarm);
buildingAt(37.8, 3, 4.5, 10, 9, 5, M.brick);
buildingAt(50.2, -7, 4.5, 9.5, 10, 7, M.wallCool);
buildingAt(50.2, 4, 4.5, 8, 9, 11, M.wallWarm);
{ // the Eiffel silhouette, far off through the dawn haze
  const g = new THREE.Group(); g.position.set(47, 0, -44); world.add(g);
  for (const sd of [-1, 1]) { const leg = add(box(0.5, 15, 0.5), MW.silh, sd * 3.4, 7.5, 0, g, { cast: false }); leg.rotation.z = sd * 0.22; }
  add(box(8.6, 0.7, 1.2), MW.silh, 0, 6.4, 0, g, { cast: false });
  add(box(5.4, 0.6, 1.0), MW.silh, 0, 11.4, 0, g, { cast: false });
  const spire = add(new THREE.ConeGeometry(1.5, 7.5, 4), MW.silh2, 0, 16.4, 0, g, { cast: false });
  add(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6), MW.silh, 0, 21.6, 0, g, { cast: false });
}
buildingAt(44, -19.5, 15, 11, 4.5, 23, M.wallCool);
lanternAt(40.6, 6.5); lanternAt(47.4, -6); // indices 0,1 (Paris)
lanternAt(-5.5, 2.5); lanternAt(6.5, -1); // indices 2,3 (pad, lit at night)

// ---------- LAB set at (84,0,-4): the row of cat candidates ----------
{
  const g = new THREE.Group(); g.position.set(84, 0, -4); world.add(g);
  add(tbox(13, 0.12, 11, 2), M.plank, 0, 0.06, 0, g, { cast: false });
  add(tbox(13, 4.4, 0.2, 2), M.wallCool, 0, 2.2, -5.4, g);
  add(tbox(0.2, 4.4, 11, 2), M.wallCool, -6.4, 2.2, 0, g);
  const wm = MW.winGlow.clone(); winMats.push(wm);
  const wp = add(new THREE.PlaneGeometry(1.7, 1.4), wm, 2.5, 2.5, -5.28, g, { cast: false }); wp.userData.ndSkip = true;
  add(box(1.9, 0.08, 0.06), M.beamDark, 2.5, 3.24, -5.26, g, { cast: false });
  add(box(1.9, 0.08, 0.06), M.beamDark, 2.5, 1.76, -5.26, g, { cast: false });
  for (let i = 0; i < 5; i++) { // candidate pedestals with little beds
    add(tbox(0.95, 0.42, 0.95, 1), M.metalDark, -2.2 + i * 1.1, 0.21, 2.3, g, { cast: false });
    add(tbox(0.85, 0.09, 0.85, 1), MW.rocketRed, -2.2 + i * 1.1, 0.46, 2.3, g, { cast: false });
  }
  add(tbox(2.2, 0.75, 0.9, 1), M.beam, 3.6, 0.38, 1.6, g, { cast: false }); // exam table
  makeBoard(['CERMA', 'PARIS'], 3.6, 1.9, 80.2, 2.6, -9.2, 0.5);
}

// ---------- TRAINING ROOM set at (118,0,-4): spinning capsule rig ----------
const SPIN_G = new THREE.Group();
{
  const g = new THREE.Group(); g.position.set(118, 0, -4); world.add(g);
  add(tbox(13, 0.12, 11, 2), M.plank, 0, 0.06, 0, g, { cast: false });
  add(tbox(13, 4.4, 0.2, 2), M.wallWarm, 0, 2.2, -5.4, g);
  add(tbox(0.2, 4.4, 11, 2), M.wallWarm, 6.4, 2.2, 0, g);
  const wm = MW.winGlow.clone(); winMats.push(wm);
  const wp = add(new THREE.PlaneGeometry(1.7, 1.4), wm, -2.5, 2.5, -5.28, g, { cast: false }); wp.userData.ndSkip = true;
  // capsule mock on a stand (the rig she trains beside)
  const cap = new THREE.Group(); cap.position.set(-2.4, 0, -1.4); g.add(cap);
  add(box(1.9, 0.5, 1.1), M.metalDark, 0, 0.25, 0, cap);
  const body = add(new THREE.CapsuleGeometry(0.58, 1.5, 6, 12), MW.white, 0, 1.05, 0, cap); body.rotation.z = Math.PI / 2;
  const ring = add(new THREE.TorusGeometry(0.5, 0.07, 8, 20), MW.rocketRed, 1.28, 1.05, 0, cap, { cast: false }); ring.rotation.y = Math.PI / 2;
  // centrifuge: pedestal + rotating arm + capsule pod (SPIN_G carries the pod; the cat card rides it)
  add(new THREE.CylinderGeometry(0.24, 0.32, 0.34, 10), M.metalDark, 0, 0.17, -2, g);
  SPIN_G.position.set(118, 0, -6); world.add(SPIN_G);
  add(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 18), MW.white, 0, 0.4, 0, SPIN_G);
  add(box(1.7, 0.1, 0.34), M.metalDark, 0, 0.5, 0, SPIN_G, { cast: false });
  const pod = add(new THREE.CapsuleGeometry(0.42, 0.7, 6, 12), MW.white, 0.85, 0.78, 0, SPIN_G); pod.rotation.z = Math.PI / 2;
  add(new THREE.TorusGeometry(0.36, 0.05, 8, 18), MW.rocketRed, 1.32, 0.78, 0, SPIN_G, { cast: false }).rotation.y = Math.PI / 2;
  // treat table + bowl
  const tb = new THREE.Group(); tb.position.set(-1.8, 0, 0.9); g.add(tb);
  add(tbox(1.3, 0.07, 0.8, 1), M.beam, 0, 0.74, 0, tb);
  for (const [lx, lz] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]]) add(box(0.06, 0.72, 0.06), M.beamDark, lx, 0.37, lz, tb, { cast: false });
  add(new THREE.CylinderGeometry(0.23, 0.15, 0.11, 12), MW.rocketRed, 0.1, 0.83, 0, tb, { cast: false });
  for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.055, 8, 6), toon({ color: '#a9763f' }), 0.02 + i * 0.09, 0.9, -0.03 + (i % 2) * 0.07, tb, { cast: false });
}

// ---------- 100 KM BAND: glowing ring in the high sky the capsule crosses ----------
const BAND_G = new THREE.Group(); BAND_G.position.set(0, 101.5, 150); scene.add(BAND_G);
{
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.09, 8, 48), new THREE.MeshBasicMaterial({ color: 0x8affd8, transparent: true, opacity: 0.4, fog: false }));
  ring.rotation.x = Math.PI / 2; ring.userData.ndSkip = true; BAND_G.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.9, 0.045, 8, 48), new THREE.MeshBasicMaterial({ color: 0x8affd8, transparent: true, opacity: 0.22, fog: false }));
  ring2.rotation.x = Math.PI / 2; ring2.userData.ndSkip = true; BAND_G.add(ring2);
  BAND_G.visible = false;
}

// ---------- ORBIT set: Earth + Sputnik capsule + interior ----------
const EARTH_G = new THREE.Group(); EARTH_G.position.set(0, 30, 230); scene.add(EARTH_G);
{
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024;
  const c2 = cv.getContext('2d');
  const grd = c2.createLinearGradient(0, 0, 0, 1024);
  grd.addColorStop(0, '#9fc6e8'); grd.addColorStop(0.12, '#2a6db0'); grd.addColorStop(0.5, '#1d5a9e'); grd.addColorStop(0.88, '#2a6db0'); grd.addColorStop(1, '#9fc6e8');
  c2.fillStyle = grd; c2.fillRect(0, 0, 2048, 1024);
  const r = P.rng(57);
  const blob = (x, y, rad, col, acc) => { // broken two-tone landmass: base cluster + accent patches
    for (let i = 0; i < 10; i++) { c2.fillStyle = col; c2.beginPath(); c2.ellipse(x + (r() - 0.5) * rad * 1.6, y + (r() - 0.5) * rad * 0.9, rad * (0.32 + r() * 0.4), rad * (0.24 + r() * 0.3), r() * 3, 0, 7); c2.fill(); }
    for (let i = 0; i < 5; i++) { c2.fillStyle = acc; c2.beginPath(); c2.ellipse(x + (r() - 0.5) * rad * 1.2, y + (r() - 0.5) * rad * 0.7, rad * (0.16 + r() * 0.22), rad * (0.12 + r() * 0.18), r() * 3, 0, 7); c2.fill(); }
  };
  for (let i = 0; i < 42; i++) blob(r() * 2048, 40 + r() * 500, 30 + r() * 30, i % 3 ? '#477c46' : '#3f7a44', i % 2 ? '#8a7a4a' : '#356b3a');
  // hero landmasses at the orbit camera's measured face centre (grid test: canvas ~(590,120), patch = top row, x 380-800)
  blob(590, 120, 60, '#477c46', '#8a7a4a'); blob(400, 185, 44, '#3f7a44', '#356b3a'); blob(790, 95, 40, '#477c46', '#8a7a4a');
  const etex = new THREE.CanvasTexture(cv); etex.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(85, 40, 28), toon({ map: etex }));
  earth.castShadow = false; earth.receiveShadow = false; EARTH_G.add(earth); EARTH_G.userData.earth = earth;
  const cc = document.createElement('canvas'); cc.width = 2048; cc.height = 1024;
  const g2 = cc.getContext('2d'); g2.clearRect(0, 0, 2048, 1024);
  for (let i = 0; i < 95; i++) { // cloud swirls — many, small, streaky
    g2.save(); g2.translate(r() * 2048, 110 + r() * 800); g2.rotate((r() - 0.5) * 0.7);
    g2.fillStyle = `rgba(255,255,255,${0.28 + r() * 0.3})`;
    for (let j = 0; j < 5; j++) { g2.beginPath(); g2.ellipse(j * 22 - 44, (r() - 0.5) * 11, 22 + r() * 20, 6 + r() * 6, 0, 0, 7); g2.fill(); }
    g2.restore();
  }
  const ctex = new THREE.CanvasTexture(cc); ctex.colorSpace = THREE.SRGBColorSpace;
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(86.4, 40, 28), new THREE.MeshBasicMaterial({ map: ctex, transparent: true, opacity: 0.66, depthWrite: false }));
  clouds.castShadow = false; clouds.userData.ndSkip = true; EARTH_G.add(clouds); EARTH_G.userData.clouds = clouds;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(89, 40, 28), new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float f = pow(1. - abs(dot(normalize(vN), V)), 2.6); gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * f * 0.9, f * 0.9); }`,
  }));
  shell.userData.ndSkip = true; EARTH_G.add(shell);
}
// aurora ribbons over the Earth's limb (additive gradient strips)
const AUR_G = new THREE.Group(); scene.add(AUR_G);
{
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c2 = cv.getContext('2d');
  const grd = c2.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, 'rgba(80,255,170,0)'); grd.addColorStop(0.45, 'rgba(80,255,170,0.55)'); grd.addColorStop(0.75, 'rgba(150,120,255,0.25)'); grd.addColorStop(1, 'rgba(150,120,255,0)');
  c2.fillStyle = grd; c2.fillRect(0, 0, 256, 64);
  c2.globalCompositeOperation = 'destination-in'; // fade the ribbon ends too — no hard vertical edges
  const hg = c2.createLinearGradient(0, 0, 256, 0);
  hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.25, 'rgba(0,0,0,1)'); hg.addColorStop(0.75, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
  c2.fillStyle = hg; c2.fillRect(0, 0, 256, 64); c2.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(cv);
  const AUR_POS = [[-18, 96, 168], [4, 96, 170], [24, 98, 166]];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(46, 7 + i * 2, 24, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    m.position.set(...AUR_POS[i]); m.rotation.set(0.2, 0.35 - i * 0.2, 0.12 * i);
    m.userData.ndSkip = true; m.userData.ph = i * 1.7; m.userData.y0 = AUR_POS[i][1]; AUR_G.add(m);
  }
}
// the Sputnik 2 capsule, exterior (orbit)
const CAP_G = new THREE.Group(); CAP_G.position.set(0, 100, 150); scene.add(CAP_G);
let capWinGlow;
{
  const body = add(new THREE.SphereGeometry(1.15, 20, 16), MW.white, 0, 0, 0, CAP_G, { cast: false });
  add(new THREE.CylinderGeometry(0.42, 0.75, 0.8, 12), M.metalDark, 0, 1.25, 0, CAP_G, { cast: false });
  add(new THREE.ConeGeometry(0.42, 0.9, 12), MW.rocketRed, 0, 2.05, 0, CAP_G, { cast: false });
  add(new THREE.CylinderGeometry(0.8, 0.95, 0.5, 14), M.metalDark, 0, -1.05, 0, CAP_G, { cast: false });
  const rim = add(new THREE.TorusGeometry(0.44, 0.07, 8, 20), MW.rocketRed, 0, 0.1, -1.12, CAP_G, { cast: false });
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), FX.glassMat(0xffd9a0, 0.55));
  win.position.set(0, 0.1, -1.13); win.rotation.y = Math.PI; win.userData.ndSkip = true; CAP_G.add(win);
  capWinGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffc37a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  capWinGlow.scale.setScalar(1.5); capWinGlow.position.set(0, 0.1, -1.35); capWinGlow.userData.ndSkip = true; CAP_G.add(capWinGlow);
  const ant = add(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), M.metalDark, 0.8, 1.3, 0.3, CAP_G, { cast: false }); ant.rotation.z = -0.5;
  add(new THREE.SphereGeometry(0.09, 8, 6), MW.gold, 1.18, 1.68, 0.3, CAP_G, { cast: false });
}
// (no orbit sign: the altitude counter board card carries the number)
// capsule interior: wall with a round window (Earth beyond), panel, floating props
const FLOATERS = [];
const INT_G = new THREE.Group(); scene.add(INT_G);
{
  const g = INT_G;
  const wz = 150.6, wy = 100.8, wx = -1.2, wyC = 101.3;
  add(tbox(4.3, 5.0, 0.25, 2), MW.cabin, wx - 1.5 - 2.15, wy, wz, g, { cast: false });
  add(tbox(6.7, 5.0, 0.25, 2), MW.cabin, wx + 1.5 + 3.35, wy, wz, g, { cast: false });
  add(tbox(14, 2.5, 0.25, 2), MW.cabin, 0, wyC + 1.5 + 1.25, wz, g, { cast: false });
  add(tbox(14, 2.5, 0.25, 2), MW.cabin, 0, wyC - 1.5 - 1.25, wz, g, { cast: false });
  const rim = add(new THREE.TorusGeometry(1.5, 0.1, 10, 28), MW.rocketRed, wx, wyC, wz - 0.12, g, { cast: false });
  add(tbox(1.7, 1.05, 0.22, 1), MW.cabin, 3.6, 99.95, 150.3, g, { cast: false }); // control panel
  const dotCols = ['#ffb03a', '#58a04a', '#d8453a', '#7ab5ff', '#ffb03a', '#58a04a'];
  dotCols.forEach((dc, i) => {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.055, 8), new THREE.MeshBasicMaterial({ color: dc, fog: false }));
    d.position.set(3.15 + (i % 3) * 0.45, 100.2 - Math.floor(i / 3) * 0.4, 150.17); d.rotation.y = Math.PI; d.userData.ndSkip = true; g.add(d);
  });
  const strap = add(new THREE.TorusGeometry(0.3, 0.05, 8, 18), MW.rocketRed, -2.7, 100.3, 148.6, g, { cast: false }); FLOATERS.push({ m: strap, y: 100.3, ph: 0 });
  const bisc = add(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10), toon({ color: '#a9763f' }), 2.3, 101.5, 148.8, g, { cast: false }); FLOATERS.push({ m: bisc, y: 101.5, ph: 2.2 });
}

// stars (points dome)
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

// ---------- FX (Coded FX Library) — every sprite/particle system is ndSkip ----------
const smoke = new FX.Smoke(scene, 170); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const chimneyEmits = CHIMNEYS.map(([x, y, z]) => smoke.addEmitter(x, y + 0.35, z, { rate: 2, color: 0xaab2bc, opacity: 0.15, scale: 0.42, grow: 1.15, life: 2.6, vy: 1.1, wind: 0.5 }));
const padEmits = [[-2.6, 0.4, -10.6], [2.6, 0.4, -5.4]].map(([x, y, z]) => smoke.addEmitter(x, y, z, { rate: 0, color: 0xe8e4dc, opacity: 0.34, scale: 1.6, grow: 2.2, life: 3.2, vy: 0.7, wind: 0.9 }));
const fire = new FX.Fire(scene, { x: 0, y: 0.5, z: -8, scale: 1, rate: 0, light: true, max: 40 });
fire.pool.forEach((p) => { p.s.userData.ndSkip = true; });
if (fire.light) { fire.light.userData.ndSkip = true; fire.light.distance = 30; }
const fxClouds = new FX.Clouds(scene, { count: 5, y: 58, opacity: 0.22, color: 0x93a7c4, drift: 0.4 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const mist = FX.mistBand(scene, { count: 8, y: 0.8, opacity: 0.3 });
mist.children.forEach((s, i) => {
  s.position.set(-6 + (i % 3) * 2.2, 0.5 + (i % 3) * 0.2, -9 + i * 2.6);
  s.scale.set(10 + (i % 3) * 3, 2.4, 1);
  s.userData.bx = s.position.x; s.userData.ndSkip = true;
});
// falling snow: deterministic points field (Balto pattern)
const SNOW_N = 800;
const snowBase = new Float32Array(SNOW_N * 3), snowPos = new Float32Array(SNOW_N * 3), snowSpd = new Float32Array(SNOW_N), snowPh = new Float32Array(SNOW_N);
{ const r = P.rng(97);
  for (let i = 0; i < SNOW_N; i++) {
    snowBase[i * 3] = -45 + r() * 90; snowBase[i * 3 + 1] = r() * 40; snowBase[i * 3 + 2] = -35 + r() * 80;
    snowSpd[i] = 0.65 + r() * 0.8; snowPh[i] = r() * 6.28;
  } }
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: FX.puffTexture(), color: 0xe6d3a3, size: 0.32, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true }));
snowPts.userData.ndSkip = true; snowPts.frustumCulled = false; scene.add(snowPts);
const wrap = (v, a, b) => ((v - a) % (b - a) + (b - a)) % (b - a) + a;
// breath puffs: soft sprites at Laika's nose on the cold street
const breathPuffs = [];
for (let i = 0; i < 3; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xeef4fb, transparent: true, opacity: 0, depthWrite: false }));
  sp.userData.ndSkip = true; scene.add(sp); breathPuffs.push(sp);
}

// ---------- FX simulation (stateful library systems, stepped deterministically) ----------
let fxF = -1;
const fxReset = () => {
  smoke.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); smoke.emitters.forEach((e) => { e.acc = 0; });
  fire.pool.forEach((p) => { p.life = -1; p.s.visible = false; }); fire.acc = 0;
  fxClouds.items.forEach((cl) => { cl.position.x = cl.userData.x0; });
};
const fxStepTo = (f) => {
  if (f === fxF) return;
  if (f < fxF || f > fxF + 240) { fxReset(); fxF = -1; }
  while (fxF < f) {
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF), Ws = worldAt(fxF);
    fire.on = pr.fireRate > 0; fire.rate = pr.fireRate; fire.scale = pr.fireScale;
    const chim = Ws.shot === 'paris' ? pr.smokeRate + 1.4 : 0;
    const pad = ['hook', 'desert', 'launch', 'return', 'finale'].includes(Ws.shot) ? pr.smokeRate : 0;
    chimneyEmits.forEach((e) => { e.rate = chim; });
    padEmits.forEach((e) => { e.rate = pad; });
    if (fxF === IGNITION_F) { // ignition burst: white steam + dust rolling off the pad
      smoke.burst(0, 1.0, -8, { n: 30, color: 0xece8e0, scale: 2.8, opacity: 0.5, life: 3.6, vy: 0.9, wind: 1.4 });
      smoke.burst(0, 0.5, -8, { n: 16, color: 0xd9bd8a, scale: 2.0, opacity: 0.45, life: 2.8, vy: 0.5, wind: 1.0 });
    }
    if (fxF === 1600) { // touchdown dust ring
      smoke.burst(0, 0.5, -1, { n: 18, color: 0xe3cf9f, scale: 2.2, opacity: 0.4, life: 2.6, vy: 0.5, wind: 1.2 });
    }
    smoke.update(t, dt); fire.update(t, dt);
    if (fire.light) fire.light.intensity *= 0.14 * (0.35 + 0.7 * pr.fireScale);
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
  const on = new Set(Ws.shot === 'paris' ? [0, 1] : (Ws.shot === 'hook' ? [2, 3] : []));
  lanterns.forEach((L, i) => {
    const k = on.has(i) ? 1 : 0;
    L.glow.material.opacity = k * (0.38 + 0.05 * Math.sin(f * 0.9 + i * 2.3));
    L.pool.material.opacity = k * 0.32;
    L.glass.material.opacity = k ? 0.55 : 0.2;
    L.glint.material.opacity = k ? 0.55 + 0.3 * Math.sin(f * 0.23 + i) : 0;
  });
  starMat.opacity = Ws.starK * (0.68 + 0.3 * Math.sin(f * 0.11) * Math.sin(f * 0.043 + 2));
  winMats.forEach((m) => { m.color.copy(WIN_DIM).lerp(WIN_LIT, Ws.winGlow); });
  fxClouds.group.visible = !(Ws.shot === 'space100' || Ws.shot === 'weightless');
  CAP_G.visible = Ws.shot === 'space100';
  INT_G.visible = Ws.shot === 'weightless';
  ROCKET_G.position.y = rocketYAt(f);
  CAP_G.position.y = 100 + Math.sin(f * 0.021) * 0.35;
  CAP_G.rotation.z = Math.sin(f * 0.013) * 0.05; CAP_G.rotation.x = Math.sin(f * 0.017 + 1) * 0.03;
  if (capWinGlow) capWinGlow.material.opacity = Ws.shot === 'space100' ? 0.45 + 0.2 * Math.sin(f * 0.07) : 0;
  EARTH_G.rotation.y = t * 0.0045; EARTH_G.rotation.x = -0.3;
  if (EARTH_G.userData.earth) EARTH_G.userData.earth.rotation.y = Math.PI * 1.0;
  if (EARTH_G.userData.clouds) EARTH_G.userData.clouds.rotation.y = t * 0.0022;
  AUR_G.children.forEach((m) => {
    m.material.opacity = (Ws.earthK || 0) * (0.4 + 0.18 * Math.sin(f * 0.03 + m.userData.ph));
    m.position.y = m.userData.y0 + Math.sin(f * 0.017 + m.userData.ph) * 1.1;
  });
  SPIN_G.rotation.y = (Ws.shot === 'training' && f >= 610 && f < 672) ? (f - 610) * 0.055 : 0.65;
  FLOATERS.forEach((fl) => {
    fl.m.position.y = fl.y + Math.sin(f * 0.04 + fl.ph) * 0.09;
    fl.m.rotation.x = f * 0.008 + fl.ph; fl.m.rotation.y = f * 0.011 + fl.ph;
  });
  // the 100 KM band: a glowing ring the capsule crosses mid-P7
  BAND_G.visible = Ws.shot === 'space100';
  if (BAND_G.visible) BAND_G.children.forEach((m, i) => { m.material.opacity = 0.34 + 0.16 * Math.sin(f * 0.09 + i * 1.4); });
  // return capsule + breathing parachute canopy (FX cloth idea: it swells and sighs every frame)
  RETURN_G.visible = Ws.shot === 'return' || Ws.shot === 'finale';
  if (RETURN_G.visible) {
    RETURN_G.position.y = capsuleYAt(f);
    RETURN_G.position.x = Math.sin(f * 0.02) * 0.35 * (Ws.shot === 'return' ? 1 : 0);
    RETURN_G.rotation.z = Math.sin(f * 0.025) * 0.05;
    const breathe = 1 + Math.sin(f * 0.11) * 0.045 + Math.sin(f * 0.031) * 0.03;
    PARA.visible = Ws.shot === 'return';
    PARA.scale.set(breathe, 1 + Math.sin(f * 0.11 + 1) * 0.06, breathe);
    PARA.rotation.y = f * 0.004;
    if (Ws.shot === 'finale') { // canopy down, capsule at rest on the sand — hatch side up
      RETURN_G.rotation.z = 0.03;
    }
  }
  // dust devils spiralling over the desert sets
  DUSTDEV.forEach((grp, k) => {
    const active = (Ws.shot === 'hook' || Ws.shot === 'desert' || Ws.shot === 'launch' || Ws.shot === 'return' || Ws.shot === 'finale') ? (Ws.dustK || 0) : 0;
    grp.userData.sprites.forEach((sp, i) => {
      const u = ((f * 0.006 + i / 5 + k * 0.4) % 1);
      const a = f * 0.09 + i * 1.26 + k * 2;
      sp.position.set(Math.cos(a) * (0.3 + u * 0.9), 0.4 + u * 3.4, Math.sin(a) * (0.3 + u * 0.9));
      const sc = 0.7 + u * 1.6; sp.scale.set(sc, sc * 1.2, 1);
      sp.material.opacity = active * 0.16 * Math.sin(u * Math.PI);
    });
  });
  // breath puffs (cold Paris dawn)
  const hp = heroPosAt(f), bk = Ws.shot === 'paris' ? 0.8 : 0;
  breathPuffs.forEach((sp, i) => {
    if (!hp || bk <= 0) { sp.material.opacity = 0; return; }
    const u = ((f / 44) + i / 3) % 1;
    sp.position.set(hp[0] + 0.42 + 0.08 * u, 0.58 + 0.1 * u, hp[2] + 0.05 + 0.3 * u);
    const sc = 0.09 + 0.2 * u; sp.scale.set(sc, sc * 0.8, 1);
    sp.material.opacity = bk * 0.2 * (1 - u) * Math.min(1, u / 0.15);
  });
  // wind-blown sand (the snow points field, repurposed): drifts sideways, never still
  snowPts.visible = (Ws.dustK || 0) > 0.03 && !(Ws.shot === 'space100' || Ws.shot === 'weightless');
  if (snowPts.visible) {
    const fall = 0.22, wind = (Ws.windK || 0) * 1.6;
    const n = Math.floor(SNOW_N * (0.25 + 0.6 * clamp01(Ws.dustK)));
    snowGeo.setDrawRange(0, n);
    for (let i = 0; i < n; i++) {
      snowPos[i * 3] = wrap(snowBase[i * 3] + Math.sin(t * 0.7 + snowPh[i]) * 0.7 - wind * t * 1.4, -45, 45);
      snowPos[i * 3 + 1] = wrap(snowBase[i * 3 + 1] - t * fall * snowSpd[i], 0, 26);
      snowPos[i * 3 + 2] = wrap(snowBase[i * 3 + 2] + Math.cos(t * 0.5 + snowPh[i]) * 0.6 - wind * t * 0.5, -35, 45);
    }
    snowGeo.attributes.position.needsUpdate = true;
    snowPts.material.opacity = 0.16 + 0.3 * clamp01(Ws.dustK);
    snowPts.material.size = 0.22;
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
