import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, relayLayout, scrollAt, heroSledAt } from './story.js';

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
  logWall: texM(P.planks(5), 2, 2, '#97795a'), logWall2: texM(P.planks(6), 2, 2, '#86684c'),
  roofWood: texM(P.planks(9), 2, 1, '#5d4a38'), snowTop: texM(P.plaster(10, 215), 2, 2, '#f2f7fd'),
  dirt: texM(P.dirt(7), 6, 30),
};
const MW = {
  pine: toon({ color: '#2c4a3e' }), pineSnow: toon({ color: '#cfe0ee' }),
  hill: toon({ color: '#aebfd8' }), darkIn: toon({ color: '#241d18' }),
  iron: toon({ color: '#5c5a57' }), darkMetal: toon({ color: '#3c4148' }),
  lampGlow: new THREE.MeshBasicMaterial({ map: P.tex(P.radial('255,190,110', 0.85)), transparent: true, fog: false, depthWrite: false }),
  winGlow: new THREE.MeshBasicMaterial({ color: '#ffb45e', fog: false }),
  red: toon({ color: '#b03a30' }), white: toon({ color: '#eef2f6' }),
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

// ---------- world: Nome, Alaska — snow town, trail, map board, statue park ----------
// Town street runs along z at x~=2; cabins face the street from the west (x<0) and east.
// Hospital cabin (-4.5,0,-7) door at (-4.5,0,-5.2). Brazier (1.5,0,-3.5).
// Map board at (12,0,0) facing -x. Trail corridor x~=2 runs z +26 -> -2 (into the street).
// Statue park at (-11,0,6): pedestal top y=0.97.
const DECK = 0;
const world = new THREE.Group(); scene.add(world);
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };

const ground = flat(add(new THREE.CircleGeometry(160, 40), M.snow, 0, 0, 0, world, { cast: false }));
// street: slightly packed snow strip
{ const st = flat(add(new THREE.PlaneGeometry(7, 60), texM(P.plaster(12, 215), 3, 24, '#dde7f2'), 2, 0.012, 4, world, { cast: false })); }
// drifts: flattened snow mounds scattered (static set dressing)
{ const r = P.rng(31);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 9 + r() * 55, x = Math.cos(a) * d, z = Math.sin(a) * d - 4;
    if (Math.abs(x - 2) < 4.5 && z > -16 && z < 26) continue; // keep the trail/street clear
    const s = add(new THREE.SphereGeometry(0.8 + r() * 1.6, 10, 8), M.snowTop, x, -0.25, z, world, { cast: false });
    s.scale.y = 0.32 + r() * 0.2;
  }
}
// distant hills + far pine silhouettes
{ for (const [hx, hy, hz, hr] of [[-70, -8, -60, 26], [-30, -9, -70, 20], [10, -8, -75, 26], [55, -9, -60, 22], [85, -8, -20, 24], [-85, -8, -15, 22]]) {
  const h = add(new THREE.SphereGeometry(hr, 16, 10), MW.hill, hx, hy, hz, world, { cast: false }); h.scale.y = 0.5; } }
const pineAt = (x, z, h = 4.2, parent = world) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  add(new THREE.CylinderGeometry(0.09, 0.14, h * 0.3, 7), M.beamDark, 0, h * 0.15, 0, g, { cast: false });
  for (let i = 0; i < 3; i++) {
    const y = h * (0.32 + i * 0.2), r = h * (0.30 - i * 0.075);
    add(new THREE.ConeGeometry(r, h * 0.34, 9), MW.pine, 0, y, 0, g, { cast: false });
    const sn = add(new THREE.ConeGeometry(r * 0.62, h * 0.16, 9), MW.pineSnow, 0, y + h * 0.09, 0, g, { cast: false });
  }
  return g;
};
pineAt(-9, -14, 5); pineAt(9.5, -13, 4.4); pineAt(-14, -8, 5.6); pineAt(13, -6, 4.8); pineAt(-7.5, -19, 6);
pineAt(7, -20, 5.4); pineAt(-16, 2, 4.6); pineAt(14.5, 8, 5.2); pineAt(-13.5, 12, 4.4); pineAt(11, 16, 5);
pineAt(-9.5, -1.5, 3.6); pineAt(-14.5, -13, 5.2); pineAt(16, -12, 4.2);

// cabins with warm windows; returns window material refs for glow control
const winMats = [];
const cabinAt = (x, z, ry = 0, s = 1, mat = null) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s); world.add(g);
  const wall = mat || M.logWall;
  add(tbox(3.2, 1.9, 2.6, 2), wall, 0, 0.95, 0, g);
  for (const sd of [-1, 1]) { const rf = add(tbox(2.15, 0.09, 2.95, 2), M.roofWood, sd * 0.82, 2.28, 0, g); rf.rotation.z = -sd * 0.62;
    const sn = add(tbox(2.2, 0.07, 3.0, 2), M.snowTop, sd * 0.84, 2.4, 0, g, { cast: false }); sn.rotation.z = -sd * 0.62; }
  add(box(0.78, 1.35, 0.07), MW.darkIn, 0.45, 0.68, 1.32, g, { cast: false }); // door
  for (const wx of [-0.95, 0.05]) { // front windows (glow planes + frames)
    const wm = MW.winGlow.clone(); winMats.push(wm);
    const wp = add(new THREE.PlaneGeometry(0.52, 0.6), wm, wx - 0.45 + 0.45, 1.15, 1.315, g, { cast: false });
    wp.position.x = wx; wp.userData.ndSkip = true;
    add(box(0.62, 0.06, 0.05), M.beamDark, wx, 1.48, 1.33, g, { cast: false });
    add(box(0.62, 0.06, 0.05), M.beamDark, wx, 0.82, 1.33, g, { cast: false });
  }
  return g;
};
cabinAt(-5.5, -11.5, 0.12); cabinAt(1.5, -12.5, -0.08); cabinAt(8, -10.5, -0.15); cabinAt(-10.5, -6.5, 0.3);
cabinAt(9.8, -4.5, -0.35); cabinAt(-2.5, -15.5, 0.05, 1.1); cabinAt(5.5, -16, -0.05, 1.15);
// hospital cabin (bigger, red-cross sign over the door)
const hosp = cabinAt(-4.5, -7.6, 0, 1.25, M.logWall2);
{ const sign = new THREE.Group(); sign.position.set(0.45, 1.95, 1.36); hosp.add(sign);
  add(box(0.66, 0.66, 0.06), MW.white, 0, 0, 0, sign, { cast: false });
  add(box(0.4, 0.13, 0.03), MW.red, 0, 0, 0.05, sign, { cast: false });
  add(box(0.13, 0.4, 0.03), MW.red, 0, 0, 0.05, sign, { cast: false }); }
// chimneys (smoke emitter spots exported to the FX block via world coords)
const CHIMNEYS = [[-5.5, 2.9, -12.3], [1.5, 2.9, -13.3], [8, 2.9, -11.3], [-4.5, 3.4, -8.4]];
for (const [cx, cy, cz] of CHIMNEYS) add(box(0.34, 0.9, 0.34), M.stone, cx, cy - 0.4, cz, world, { cast: false });

// brazier: stone ring + logs at the street corner (flame is FX)
for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, s = add(new THREE.SphereGeometry(0.16, 8, 6), M.stone, 1.5 + Math.cos(a) * 0.55, 0.07, -3.5 + Math.sin(a) * 0.55, world, { cast: false }); s.scale.y = 0.7; }
for (let i = 0; i < 3; i++) { const l = add(new THREE.CylinderGeometry(0.055, 0.065, 0.85, 7), M.beamDark, 1.5, 0.12, -3.5, world, { cast: false }); l.rotation.z = Math.PI / 2; l.rotation.y = i * 1.05; }

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

// lantern posts with glass lanterns (glassMat + glint + warm glow sprite + ground pool)
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
lanternAt(-1.5, -1);      // 0 street west
lanternAt(3.5, -1.5);     // 1 street east
lanternAt(-6.8, -4.2);    // 2 hospital
lanternAt(9.2, 2.8);      // 3 map board
lanternAt(-9.2, 4.2);     // 4 statue park

// ---------- map board: the 700-mile route draws itself ----------
const mapCanvas = document.createElement('canvas'); mapCanvas.width = 1024; mapCanvas.height = 640;
const mapTex = new THREE.CanvasTexture(mapCanvas); mapTex.colorSpace = THREE.SRGBColorSpace; mapTex.anisotropy = 4;
const ALASKA = [[150, 470], [140, 380], [190, 300], [170, 210], [230, 130], [330, 90], [470, 80], [640, 95], [790, 130], [880, 210], [905, 330], [860, 430], [760, 505], [720, 560], [640, 520], [560, 565], [470, 520], [400, 560], [330, 510], [250, 545], [190, 505]];
const NOME_PT = [238, 300], ANCH_PT = [600, 430];
const routePt = (t) => { // quadratic-ish path Nome -> Anchorage with a northern bow
  const [x0, y0] = NOME_PT, [x1, y1] = ANCH_PT, cxp = 400, cyp = 210;
  const u = 1 - t; return [u * u * x0 + 2 * u * t * cxp + t * t * x1, u * u * y0 + 2 * u * t * cyp + t * t * y1];
};
let mapDrawnKey = -1;
const drawMap = (t) => {
  const key = Math.round(t * 50);
  if (key === mapDrawnKey) return; mapDrawnKey = key;
  const g = mapCanvas.getContext('2d');
  g.fillStyle = '#e9dcba'; g.fillRect(0, 0, 1024, 640);
  g.strokeStyle = '#c9b586'; g.lineWidth = 3; for (let i = 0; i < 26; i++) { g.beginPath(); g.moveTo(0, i * 26); g.lineTo(1024, i * 26 + 30); g.stroke(); }
  g.beginPath(); ALASKA.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
  g.fillStyle = '#d9e4ee'; g.fill(); g.lineWidth = 9; g.strokeStyle = '#5d7d9c'; g.stroke();
  g.fillStyle = '#c3d2e0'; for (const [mx, my, mr] of [[330, 200, 46], [520, 170, 60], [700, 260, 52], [430, 330, 40]]) { g.beginPath(); g.ellipse(mx, my, mr, mr * 0.6, 0.4, 0, 7); g.fill(); }
  g.fillStyle = '#33506b'; g.font = '900 44px Arial'; g.fillText('ALASKA', 396, 66);
  g.font = '700 25px Arial'; g.fillStyle = '#33506b'; g.fillText('1925', 850, 84);
  // the route, drawn progressively in red dashes
  g.strokeStyle = '#c0302c'; g.lineWidth = 8; g.lineCap = 'round'; g.setLineDash([20, 15]);
  g.beginPath(); const N = Math.max(2, Math.floor(t * 60));
  for (let i = 0; i <= N; i++) { const [x, y] = routePt(i / 60); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.setLineDash([]);
  const dot = (x, y, col, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 4; g.strokeStyle = '#33506b'; g.stroke(); };
  dot(ANCH_PT[0], ANCH_PT[1], '#f2f4f6', 13);
  dot(NOME_PT[0], NOME_PT[1], '#ffd23e', 16);
  g.fillStyle = '#33506b'; g.font = '900 30px Arial';
  g.fillText('ANCHORAGE', ANCH_PT[0] - 62, ANCH_PT[1] + 52);
  g.fillText('NOME', NOME_PT[0] - 34, NOME_PT[1] - 34);
  if (t > 0.55) { g.save(); g.translate(415, 268); g.rotate(-0.1); g.font = '900 54px Arial'; g.fillStyle = '#c0302c'; g.fillText('674 MILES', 0, 0); g.restore(); }
  if (t > 0.92) { // serum cross marker pulses in at Nome
    g.fillStyle = '#c0302c'; g.fillRect(NOME_PT[0] - 6, NOME_PT[1] - 44, 12, 30); g.fillRect(NOME_PT[0] - 15, NOME_PT[1] - 35, 30, 12);
  }
  mapTex.needsUpdate = true;
};
drawMap(0);
{
  const g = new THREE.Group(); g.position.set(12, 0, 0); g.rotation.y = -Math.PI / 2; world.add(g);
  for (const sd of [-3.1, 3.1]) add(new THREE.CylinderGeometry(0.09, 0.11, 4.6, 8), M.beamDark, sd, 2.3, 0, g);
  add(tbox(7.6, 5.0, 0.16, 2), M.logWall2, 0, 2.75, -0.1, g);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.5), new THREE.MeshBasicMaterial({ map: mapTex, fog: true }));
  board.position.set(0, 2.75, 0.0); board.userData.ndSkip = true; g.add(board);
  const rf = add(tbox(8.0, 0.1, 1.1, 2), M.roofWood, 0, 5.45, 0.25, g); rf.rotation.x = 0.25;
  const sn = add(tbox(8.05, 0.07, 1.15, 2), M.snowTop, 0, 5.56, 0.25, g, { cast: false }); sn.rotation.x = 0.25;
}
// frozen plane + snow-buried train flanking the board (why only sleds could go)
{ const pg = new THREE.Group(); pg.position.set(10.2, 0, -4.6); pg.rotation.set(0.1, 0.7, 0.16); world.add(pg);
  const fus = add(new THREE.CylinderGeometry(0.42, 0.3, 3.4, 10), MW.white, 0, 0.75, 0, pg); fus.rotation.x = Math.PI / 2;
  add(box(2.9, 0.09, 0.7), MW.red, 0, 0.95, -0.2, pg); add(box(0.8, 0.5, 0.09), MW.red, 0, 1.15, 1.55, pg);
  const drift = add(new THREE.SphereGeometry(1.7, 10, 8), M.snowTop, 0.4, -0.5, 0.6, pg, { cast: false }); drift.scale.y = 0.4; }
{ const tg = new THREE.Group(); tg.position.set(10.4, 0, 5.8); tg.rotation.y = -0.4; world.add(tg);
  add(box(3.4, 1.0, 1.3), MW.darkIn, 0, 0.32, 0, tg); add(box(1.0, 0.8, 1.2), M.darkMetal, -1.9, 0.5, 0, tg, { cast: false });
  const ch = add(new THREE.CylinderGeometry(0.16, 0.22, 0.7, 8), M.darkMetal, -1.9, 1.2, 0, tg, { cast: false });
  const drift = add(new THREE.SphereGeometry(2.6, 10, 8), M.snowTop, 0.3, -0.75, 0, tg, { cast: false }); drift.scale.y = 0.42; }

// scroll props: trailside drifts / pines / marker sticks that slide past the running team
const scrollProps = [];
{ const r = P.rng(53);
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, z0 = -32 + i * 3.9 + r() * 1.6, x = 2 + side * (2.6 + r() * 2.2);
    let g;
    if (i % 4 === 3) { g = pineAt(x, z0, 3.4 + r() * 1.4, world); }
    else if (i % 4 === 1) { // trail marker: stick + red flag
      g = new THREE.Group(); g.position.set(x > 2 ? 3.6 : 0.4, 0, z0); world.add(g);
      add(new THREE.CylinderGeometry(0.03, 0.04, 1.25, 6), M.beamDark, 0, 0.62, 0, g, { cast: false });
      add(box(0.34, 0.22, 0.02), MW.red, 0.19, 1.12, 0, g, { cast: false });
    } else {
      g = new THREE.Group(); g.position.set(x, 0, z0); world.add(g);
      const s = add(new THREE.SphereGeometry(0.9 + r() * 1.1, 10, 8), M.snowTop, 0, -0.28, 0, g, { cast: false }); s.scale.y = 0.36;
    }
    scrollProps.push({ g, z0 });
  }
}

// ---------- relay teams (low-poly props; positions come from story.relayLayout) ----------
const DOG_COLS = ['#2a2c33', '#4a4d55', '#33261e', '#5d6068'];
const teamGroups = [];
{
  const dogBody = new THREE.SphereGeometry(0.5, 8, 6), dogHead = new THREE.SphereGeometry(0.21, 7, 6);
  for (let ti = 0; ti < 20; ti++) {
    const g = new THREE.Group(); world.add(g);
    const col = toon({ color: DOG_COLS[ti % 4] });
    for (let d = 0; d < 4; d++) {
      const dg = new THREE.Group(); dg.position.set(d % 2 ? 0.17 : -0.17, 0, -2.9 + d * 0.78); g.add(dg);
      const b = add(dogBody, col, 0, 0.42, 0, dg, { cast: false }); b.scale.set(0.34, 0.3, 0.78);
      add(dogHead, col, 0, 0.58, -0.42, dg, { cast: false });
      const tl = add(new THREE.ConeGeometry(0.07, 0.34, 6), col, 0, 0.62, 0.42, dg, { cast: false }); tl.rotation.x = -0.7;
    }
    add(box(0.52, 0.07, 1.6), M.logWall, 0, 0.3, 0.7, g, { cast: false });           // sled bed
    for (const sd of [-0.24, 0.24]) add(box(0.05, 0.1, 2.0), M.beamDark, sd, 0.08, 0.7, g, { cast: false }); // runners
    const crate = add(box(0.44, 0.4, 0.44), M.logWall2, 0, 0.55, 0.45, g, { cast: false });
    add(box(0.3, 0.09, 0.02), MW.red, 0, 0.56, 0.22, g, { cast: false });
    add(box(0.09, 0.3, 0.02), MW.red, 0, 0.56, 0.22, g, { cast: false });
    const mu = new THREE.Group(); mu.position.set(0, 0.16, 1.62); g.add(mu);       // musher on the runners
    add(box(0.36, 0.62, 0.22), toon({ color: ti % 3 ? '#7a4436' : '#4a5a6a' }), 0, 0.55, 0, mu, { cast: false });
    add(new THREE.SphereGeometry(0.17, 8, 6), toon({ color: '#e8c39a' }), 0, 1.05, 0, mu, { cast: false });
    add(new THREE.SphereGeometry(0.21, 8, 6), toon({ color: '#d8c49a' }), 0, 1.1, 0.02, mu, { cast: false }).scale.set(1, 0.72, 1);
    teamGroups.push(g);
  }
}

// ---------- hero sled (detailed prop; cards ride in front of it) ----------
const heroSled = new THREE.Group(); world.add(heroSled);
{
  for (const sd of [-0.26, 0.26]) {
    add(box(0.05, 0.09, 2.6), M.beamDark, sd, 0.1, 0, heroSled, { cast: false });
    const tip = add(box(0.05, 0.09, 0.7), M.beamDark, sd, 0.3, -1.5, heroSled, { cast: false }); tip.rotation.x = 0.7;
  }
  for (let i = 0; i < 5; i++) add(box(0.58, 0.05, 0.3), M.logWall, 0, 0.32, -0.9 + i * 0.45, heroSled, { cast: false });
  for (const sd of [-0.26, 0.26]) { const post = add(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), M.beamDark, sd, 0.6, 1.15, heroSled, { cast: false }); post.rotation.x = 0.35; }
  add(box(0.58, 0.05, 0.05), M.beamDark, 0, 0.92, 1.32, heroSled, { cast: false }); // handle bar
  const crate = FX.crate(0.56); crate.position.set(0, 0.63, 0.15); heroSled.add(crate);
  add(box(0.34, 0.1, 0.02), MW.red, 0, 0.64, -0.14, heroSled, { cast: false });
  add(box(0.1, 0.34, 0.02), MW.red, 0, 0.64, -0.14, heroSled, { cast: false });
  const line = add(new THREE.CylinderGeometry(0.014, 0.014, 2.0, 5), M.beamDark, 0, 0.32, -2.0, heroSled, { cast: false });
  line.rotation.x = Math.PI / 2 - 0.06; // gangline toward the dogs
}

// ---------- statue park set ----------
{ const g = new THREE.Group(); g.position.set(-11, 0, 6); world.add(g);
  add(tbox(1.5, 0.22, 1.5, 2), M.stone, 0, 0.11, 0, g);
  add(tbox(1.1, 0.75, 1.1, 2), M.stone, 0, 0.59, 0, g);
  add(tbox(1.3, 0.1, 1.3, 2), M.stone, 0, 1.01, 0, g);
  add(box(0.5, 0.3, 0.04), M.darkMetal, 0, 0.6, 0.57, g, { cast: false }); // plaque
  for (const sd of [-1.9, 1.9]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 7), M.beamDark, sd, 0.4, 1.6, g, { cast: false });
  add(box(4.0, 0.06, 0.06), M.beamDark, 0, 0.72, 1.6, g, { cast: false });
}
const statueGlint = FX.glint(0.34); statueGlint.position.set(-10.78, 2.36, 6.3); statueGlint.material.opacity = 0; statueGlint.userData.ndSkip = true; world.add(statueGlint);
// the doctor's serum bottle (empty in P2) — small glass prop in his raised hand + glint
const bottleG = FX.bottle({}); bottleG.scale.setScalar(0.32); bottleG.position.set(-4.16, -5, -5.28); bottleG.rotation.z = 0.12; ndSkip(bottleG); world.add(bottleG);
const bottleGlint = FX.glint(0.22); bottleGlint.position.set(-4.1, 1.14, -5.2); bottleGlint.material.opacity = 0; bottleGlint.userData.ndSkip = true; world.add(bottleGlint);

// ---------- Togo text boards (diegetic signs; canvas textures, must read correctly) ----------
const textBoard = (lines, w, h) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = '#6d5136'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#e9dcba'; g.fillRect(26, 26, c.width - 52, c.height - 52);
  g.strokeStyle = '#8a6a44'; g.lineWidth = 10; g.strokeRect(26, 26, c.width - 52, c.height - 52);
  g.fillStyle = '#2e2620'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach(([txt, px], i) => { g.font = `900 ${px}px Arial`; g.fillText(txt, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i === 0 ? 0.32 : 0.72))); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const grp = new THREE.Group();
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.055, 0.07, h + 0.7, 7), M.beamDark, sd * w * 0.38, (h + 0.7) / 2, -0.06, grp, { cast: false });
  add(tbox(w + 0.16, h + 0.16, 0.09, 2), M.logWall2, 0, h / 2 + 0.62, -0.05, grp);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: true }));
  face.position.set(0, h / 2 + 0.62, 0.01); face.userData.ndSkip = true; grp.add(face);
  return grp;
};
const baltoSign = textBoard([['BALTO!', 250]], 2.6, 1.5); baltoSign.position.set(-1.5, 0, -6.4); baltoSign.rotation.y = 0.55; world.add(baltoSign);
const milesSign = textBoard([['261', 330], ['MILES', 190]], 2.2, 1.55); milesSign.position.set(5.2, 0, 10.8); milesSign.rotation.y = Math.PI; world.add(milesSign);
const finaleBoard = textBoard([['THE REAL HERO', 118], ['OF NOME.', 165]], 1.8, 1.125); finaleBoard.position.set(-11.55, 0, 7.0); finaleBoard.rotation.y = 0.15; world.add(finaleBoard);

// ---------- Norton Sound ice plain (S5-S7): pale ice sheet + pressure ridges + growing cracks ----------
const iceGroup = new THREE.Group(); world.add(iceGroup);
flat(add(new THREE.CircleGeometry(38, 36), texM(P.plaster(21, 205), 24, 24, '#c3d9ea'), 2, 0.02, 10, iceGroup, { cast: false }));
{ const r = P.rng(61);
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1, x = 2 + side * (4.6 + r() * 7.5), z = -2 + r() * 30;
    const s = add(new THREE.SphereGeometry(1, 9, 7), toon({ color: '#d9e9f5' }), x, -0.1, z, iceGroup, { cast: false });
    s.scale.set(1.7 + r() * 2.2, 0.3 + r() * 0.14, 0.55 + r() * 0.45); s.rotation.y = r() * 3;
  }
}
const crackTex = (seed) => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'), r = P.rng(seed);
  const jag = (x0, y0, x1, y1, wdt, col) => {
    g.strokeStyle = col; g.lineWidth = wdt; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0);
    const n = 7; for (let i = 1; i <= n; i++) { const t = i / n; g.lineTo(x0 + (x1 - x0) * t + (r() - 0.5) * 26, y0 + (y1 - y0) * t + (r() - 0.5) * 30); }
    g.stroke();
  };
  jag(8, 120 + r() * 30, 504, 100 + r() * 40, 11, 'rgba(14,32,52,0.95)');
  jag(130, 128, 250, 30 + r() * 30, 7, 'rgba(14,32,52,0.9)');
  jag(230, 118, 360, 210 + r() * 20, 7, 'rgba(14,32,52,0.9)');
  jag(330, 110, 430, 36, 5.5, 'rgba(14,32,52,0.85)');
  jag(60, 122, 190, 196, 5.5, 'rgba(14,32,52,0.85)');
  jag(8, 132, 504, 112, 2.5, 'rgba(240,248,255,0.55)');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const crackPlanes = [];
[[2.0, 5.2, 0.4], [1.1, 7.9, -0.7], [3.1, 10.6, 1.2], [0.4, 12.9, 0.2], [2.6, 3.9, -0.3]].forEach(([x, z, ry], i) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 4.25),
    new THREE.MeshBasicMaterial({ map: crackTex(71 + i * 13), transparent: true, depthWrite: false, fog: true, opacity: 0 }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = ry; m.position.set(x, 0.035 + i * 0.0015, z);
  m.renderOrder = 2; m.userData.ndSkip = true; m.visible = false; iceGroup.add(m); crackPlanes.push(m);
});
iceGroup.visible = false;

// ---------- FX (Coded FX Library) — every sprite/particle system is ndSkip ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const smokeEmits = CHIMNEYS.map(([x, y, z]) => smoke.addEmitter(x, y + 0.35, z, { rate: 3, color: 0xaab2bc, opacity: 0.15, scale: 0.42, grow: 1.15, life: 2.6, vy: 1.1, wind: 0.5 }));
const fire = new FX.Fire(scene, { x: 1.5, y: 0.16, z: -3.5, scale: 0.9, rate: 20, light: true, max: 32 });
fire.pool.forEach((p) => { p.s.userData.ndSkip = true; });
if (fire.light) { fire.light.userData.ndSkip = true; fire.light.distance = 7; }
const fxClouds = new FX.Clouds(scene, { count: 5, y: 58, opacity: 0.22, color: 0x93a7c4, drift: 0.4 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const mist = FX.mistBand(scene, { count: 8, y: 0.8, opacity: 0.3 });
mist.children.forEach((s, i) => {
  s.position.set(0.5 + (i % 3) * 1.6, 0.5 + (i % 3) * 0.2, -8 + i * 3.1);
  s.scale.set(10 + (i % 3) * 3, 2.4, 1);
  s.userData.bx = s.position.x; s.userData.ndSkip = true;
});
// falling snow: deterministic points field, density/speed/wind from story state
const SNOW_N = 800;
const snowBase = new Float32Array(SNOW_N * 3), snowPos = new Float32Array(SNOW_N * 3), snowSpd = new Float32Array(SNOW_N), snowPh = new Float32Array(SNOW_N);
{ const r = P.rng(97);
  for (let i = 0; i < SNOW_N; i++) {
    snowBase[i * 3] = -45 + r() * 90; snowBase[i * 3 + 1] = r() * 40; snowBase[i * 3 + 2] = -35 + r() * 80;
    snowSpd[i] = 0.65 + r() * 0.8; snowPh[i] = r() * 6.28;
  } }
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: FX.puffTexture(), color: 0xffffff, size: 0.32, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true }));
snowPts.userData.ndSkip = true; snowPts.frustumCulled = false; scene.add(snowPts);
const wrap = (v, a, b) => ((v - a) % (b - a) + (b - a)) % (b - a) + a;
// scent ribbon: a chain of golden sprites along the trail ahead of Balto
const scentCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(2.42, 0.3, 6.05), new THREE.Vector3(2.5, 0.26, 6.9), new THREE.Vector3(2.55, 0.3, 7.8),
  new THREE.Vector3(2.6, 0.27, 8.7), new THREE.Vector3(2.65, 0.32, 9.6)]);
const scentSprites = [];
for (let i = 0; i < 16; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FX.puffTexture(), color: 0xffd76a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.userData.ndSkip = true; scene.add(sp); scentSprites.push(sp);
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
    fxF++; const t = fxF / 30, dt = 1 / 30, pr = fxProfileAt(fxF);
    fire.on = pr.fireRate > 0; fire.rate = pr.fireRate; fire.scale = pr.fireScale;
    smokeEmits.forEach((e) => { e.rate = pr.smokeRate; });
    smoke.update(t, dt); fire.update(t, dt);
    if (fire.light) fire.light.intensity *= 0.14 * (0.35 + 0.7 * pr.fireScale);
    fxClouds.update(t, dt);
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
  // mist drifts along the street/trail
  mist.children.forEach((s, i) => {
    s.position.x = s.userData.bx + Math.sin(f * 0.008 + i * 1.7) * 0.9;
    s.material.opacity = 0.42 * Ws.mist * (0.75 + 0.25 * Math.sin(f * 0.013 + i * 2.1));
  });
  // lanterns per story state
  const on = new Set(Ws.lanternSet || []);
  lanterns.forEach((L, i) => {
    const k = on.has(i) ? 1 : 0;
    L.glow.material.opacity = k * (0.38 + 0.05 * Math.sin(f * 0.9 + i * 2.3));
    L.pool.material.opacity = k * 0.32;
    L.glass.material.opacity = k ? 0.55 : 0.2;
    L.glint.material.opacity = k ? 0.55 + 0.3 * Math.sin(f * 0.23 + i) : 0;
  });
  starMat.opacity = 0.9 * Ws.starK;
  winMats.forEach((m) => { m.color.copy(WIN_DIM).lerp(WIN_LIT, Ws.winGlow); });
  drawMap(Ws.mapT || 0);
  // falling snow (pure function of frame + story state)
  {
    const fall = 1.15 * (0.45 + 0.75 * Ws.snowK), wind = Ws.windK || 0;
    const n = Math.floor(SNOW_N * (0.3 + 0.7 * clamp01(Ws.snowK)));
    snowGeo.setDrawRange(0, n);
    for (let i = 0; i < n; i++) {
      snowPos[i * 3] = wrap(snowBase[i * 3] + Math.sin(t * 0.7 + snowPh[i]) * 0.7 - wind * t * 0.55, -45, 45);
      snowPos[i * 3 + 1] = wrap(snowBase[i * 3 + 1] - t * fall * snowSpd[i], 0, 40);
      snowPos[i * 3 + 2] = wrap(snowBase[i * 3 + 2] + Math.cos(t * 0.5 + snowPh[i]) * 0.6 - wind * t * 0.3, -35, 45);
    }
    snowGeo.attributes.position.needsUpdate = true;
    snowPts.material.opacity = 0.35 + 0.55 * clamp01(Ws.snowK);
    snowPts.material.size = 0.3 + 0.05 * Math.min(Ws.windK || 0, 3); // flakes read bigger in the storm
  }
  // scent ribbon pulse
  scentSprites.forEach((sp, i) => {
    const u = i / (scentSprites.length - 1), pos = scentCurve.getPoint(u);
    sp.position.copy(pos);
    const pulse = Math.pow(Math.max(0, Math.sin(t * 2.6 - i * 0.65)), 2);
    sp.material.opacity = (Ws.scentK || 0) * (0.16 + 0.55 * pulse);
    const sc = 0.3 + 0.32 * pulse; sp.scale.set(sc, sc, 1);
  });
  // trail scroll props
  const sc = scrollAt(f);
  scrollProps.forEach((pr) => { pr.g.position.z = wrap(pr.z0 - sc + 34, 0, 62) - 34; });
  // relay teams
  const layout = relayLayout(f);
  teamGroups.forEach((g, i) => { const L = layout[i]; if (!L) { g.visible = false; return; } g.visible = Ws.shot === 'relay'; g.position.set(L.x, L.bob || 0, L.z); g.rotation.y = L.ry || 0; });
  // hero sled prop follows the card team
  const hs = heroSledAt(f);
  heroSled.visible = !!hs;
  if (hs) { heroSled.position.set(hs.x, hs.bob || 0, hs.z); heroSled.rotation.y = hs.ry || 0; }
  // Norton Sound ice + cracks (cracks grow in steps as crackK crosses fifths)
  iceGroup.visible = (Ws.iceK || 0) > 0.01;
  crackPlanes.forEach((m, i) => {
    const u = clamp01((Ws.crackK || 0) * 5 - i);
    m.visible = iceGroup.visible && u > 0;
    const s = 0.55 + 0.45 * u; m.scale.set(s, s, 1);
    m.material.opacity = Math.min(1, u * 1.7);
  });
  // statue glint + doctor's bottle
  statueGlint.material.opacity = (Ws.statueGlint || 0) * (0.7 + 0.3 * Math.sin(f * 0.4));
  bottleG.position.y = Ws.bottleK > 0 ? 1.02 : -5;
  bottleG.rotation.z = 0.12 + (Ws.bottleK || 0) * 0.15 * Math.sin(f * 0.05);
  bottleGlint.material.opacity = (Ws.bottleGlint || 0) * (0.65 + 0.35 * Math.sin(f * 0.33));
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
