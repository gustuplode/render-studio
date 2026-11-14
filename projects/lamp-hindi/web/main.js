import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt } from './story.js';

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

// ---------- text-board helper (canvas texture plane; boards are in-world props) ----------
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
  return m; // boards stay IN the ND pass: their depth occludes set geometry behind them (no ghost ink lines)
};

// ---------- the set: the zamindar's great hall, its interior, the market ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldDk: toon({ color: '#a87c24' }),
  plaster: texM(P.plaster(33, 36), 2, 2), plasterWarm: texM(P.plaster(34, 24), 2, 2),
  dark: toon({ color: '#33302c' }), iron: toon({ color: '#4a4d55' }),
  hay: texM(P.weave(71, [45, 50, 50]), 6, 6, '#e2c078'), hayDk: texM(P.weave(72, [42, 48, 44]), 6, 6, '#cfa855'),
  cotton: texM(P.plaster(41, 90), 1, 1, '#f2ede2'),
  clay: toon({ color: '#9a5a34' }), clayDk: toon({ color: '#6e3d20' }),
  floorIn: texM(P.stone(66, 30, 8, 40), 6, 6, '#9a8f7c'),
  wallIn: texM(P.plaster(35, 30), 4, 2, '#b3a58c'),
};
// soft radial warm-glow texture (lamp light pools — brightest at centre,
// smooth falloff to nothing; the lighthouse rule: no hard-edged wedge)
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,196,110,0.95)'); gr.addColorStop(0.35, 'rgba(255,166,77,0.55)');
  gr.addColorStop(0.7, 'rgba(255,140,60,0.18)'); gr.addColorStop(1, 'rgba(255,130,50,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const glowPlane = (r) => {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  m.userData.ndSkip = true; m.castShadow = false; m.receiveShadow = false; return m;
};
const world = new THREE.Group(); scene.add(world);
let hayCartG, hayWheels = [], hayMound, hayPiles = [], baleMeshes = [], lampFlame, lampFlameCore, lampLight, lampGlowFloor, lampGlowSprite, cornerPools = [], wallWashes = [], lampBowlG;
{
  const g = world;
  const gr = flat(add(new THREE.PlaneGeometry(300, 300), MAT.grass, -4, -0.03, 0, g, { cast: false })); gr.receiveShadow = true;
  flat(add(new THREE.PlaneGeometry(26, 4.2), MAT.dirt, -2, -0.014, 4.6, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(3.4, 16), MAT.dirt, -16.5, -0.013, -1, g, { cast: false }));
  // ================= THE GREAT HALL — exterior (facade plane z = -2) =================
  add(tbox(17.0, 7.2, 0.6, 3), MAT.plasterWarm, 0, 3.6, -2, g, { cast: false });
  add(tbox(17.6, 0.5, 1.0, 2), MAT.stoneDk, 0, 7.45, -2, g, { cast: false });
  const dome = add(new THREE.SphereGeometry(2.3, 14, 10), MAT.gold, 0, 7.7, -2, g, { cast: false }); dome.scale.y = 0.72;
  add(new THREE.CylinderGeometry(0.09, 0.13, 1.1, 8), MAT.goldDk, 0, 9.2, -2, g, { cast: false });
  // doorway (dark inset; interior is a separate zone behind the side walls)
  add(tbox(3.0, 4.4, 0.3, 2), MAT.dark, 0, 2.2, -1.78, g, { cast: false });
  add(tbox(3.5, 0.4, 0.4, 2), MAT.goldDk, 0, 4.55, -1.78, g, { cast: false });
  for (const sx of [-1.62, 1.62]) add(tbox(0.24, 4.4, 0.34, 1), MAT.woodDk, sx, 2.2, -1.76, g, { cast: false });
  // windows with warm shutters
  for (const wx of [-5.6, -3.4, 3.4, 5.6]) {
    add(tbox(1.15, 1.7, 0.2, 1), MAT.woodDk, wx, 4.6, -1.72, g, { cast: false });
    add(tbox(0.9, 1.45, 0.1, 1), MAT.dark, wx, 4.6, -1.68, g, { cast: false });
  }
  // portico: 4 pillars + beam + steps
  for (const px of [-5.4, -1.9, 1.9, 5.4]) {
    add(new THREE.CylinderGeometry(0.3, 0.36, 5.6, 10), MAT.stone, px, 2.8, 1.6, g, { cast: false });
    add(tbox(0.85, 0.3, 0.85, 2), MAT.stoneDk, px, 5.75, 1.6, g, { cast: false });
    add(tbox(0.9, 0.3, 0.9, 2), MAT.stoneDk, px, 0.15, 1.6, g, { cast: false });
  }
  add(tbox(12.6, 0.55, 1.1, 2), MAT.stone, 0, 6.05, 1.6, g, { cast: false });
  for (let i = 0; i < 3; i++) add(tbox(6.4 - i * 1.1, 0.2, 1.9 + i * 0.55, 2), MAT.stone, 0, 0.1 + i * 0.2, 0.6 + i * 0.35, g, { cast: false });
  // landlord's raised seat platform (right of the door)
  add(tbox(3.4, 0.5, 2.2, 2), MAT.stoneDk, 4.6, 0.25, 0.6, g, { cast: false });
  add(tbox(1.5, 0.18, 1.1, 1), MAT.wood, 4.6, 0.59, 0.6, g, { cast: false });
  // ================= THE HALL INTERIOR (x -8..8, z -16..-2.3) =================
  flat(add(new THREE.PlaneGeometry(16.4, 14), MAT.floorIn, 0, -0.006, -9.2, g, { cast: false }));
  add(tbox(16.4, 8.2, 0.5, 3), MAT.wallIn, 0, 4.1, -16.2, g, { cast: false }); // back wall
  for (const sx of [-8.2, 8.2]) {
    const w = add(tbox(0.5, 8.2, 14, 3), MAT.wallIn, sx, 4.1, -9.2, g, { cast: false });
  }
  add(tbox(16.9, 0.5, 14.5, 2), MAT.woodDk, 0, 8.35, -9.2, g, { cast: false }); // ceiling beams slab
  for (let i = 0; i < 4; i++) add(tbox(16.4, 0.34, 0.4, 2), MAT.woodDk, 0, 7.9, -4.4 - i * 3.4, g, { cast: false });
  // interior pillars along both sides
  for (const sx of [-7.2, 7.2]) for (const pz of [-5.2, -9.2, -13.2]) {
    add(new THREE.CylinderGeometry(0.34, 0.4, 8.0, 10), MAT.stone, sx, 4.0, pz, g, { cast: false });
    add(tbox(0.95, 0.3, 0.95, 2), MAT.stoneDk, sx, 7.6, pz, g, { cast: false });
    add(tbox(1.0, 0.3, 1.0, 2), MAT.stoneDk, sx, 0.15, pz, g, { cast: false });
  }
  // high windows on the back wall (dim dusk slits)
  for (const wx of [-4.6, 0, 4.6]) add(tbox(1.3, 1.9, 0.15, 1), MAT.dark, wx, 6.2, -15.9, g, { cast: false });
  // centre floor medallion — where the lamp will sit
  flat(add(new THREE.CircleGeometry(0.85, 20), MAT.stoneDk, 0, 0.004, -9.2, g, { cast: false }));
  flat(add(new THREE.CircleGeometry(0.55, 20), MAT.stone, 0, 0.006, -9.2, g, { cast: false }));
  // ---- hay cart (rolls in through the door, stops west-centre) ----
  hayCartG = new THREE.Group(); hayCartG.position.set(0, 0, -3.4); hayCartG.rotation.y = -Math.PI / 2; g.add(hayCartG);
  add(tbox(2.6, 0.16, 1.4, 2), MAT.wood, 0, 0.8, 0, hayCartG, { cast: false });
  for (const sz of [-0.66, 0.66]) add(tbox(2.6, 0.34, 0.07, 2), MAT.woodDk, 0, 1.0, sz, hayCartG, { cast: false });
  for (const sx of [-1.26, 1.26]) add(tbox(0.07, 0.34, 1.4, 2), MAT.woodDk, sx, 1.0, 0, hayCartG, { cast: false });
  for (const sz of [-0.48, 0.48]) { const h = add(tbox(1.15, 0.09, 0.09, 1), MAT.woodDk, 1.8, 0.74, sz, hayCartG, { cast: false }); h.rotation.z = -0.18; }
  for (const sz of [-0.76, 0.76]) {
    const piv = new THREE.Group(); piv.position.set(0, 0.58, sz); hayCartG.add(piv); hayWheels.push(piv);
    const wm = add(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 14), MAT.woodDk, 0, 0, 0, piv, { cast: false }); wm.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.13, 10), MAT.goldDk, 0, 0, 0, piv, { cast: false }).rotation.x = Math.PI / 2;
    for (let k = 0; k < 4; k++) { const sp = add(tbox(0.09, 1.04, 0.05, 1), MAT.wood, 0, 0, 0, piv, { cast: false }); sp.rotation.z = k * Math.PI / 4; }
  }
  hayMound = new THREE.Group(); hayMound.position.set(0, 0.86, 0); hayCartG.add(hayMound);
  const hm = add(new THREE.SphereGeometry(1.25, 12, 9), MAT.hay, 0, 0.3, 0, hayMound, { cast: false }); hm.scale.set(1.15, 0.62, 0.62);
  const hm2 = add(new THREE.SphereGeometry(0.8, 10, 8), MAT.hayDk, 0.3, 0.72, 0.1, hayMound, { cast: false }); hm2.scale.set(1, 0.6, 0.7);
  // loose hay piles on the floor (west side) — they grow, yet the hall dwarfs them
  const pilePos = [[-4.7, -8.4, 1.5], [-3.8, -11.4, 1.2], [-5.4, -13.2, 1.0]];
  pilePos.forEach(([px, pz, s]) => {
    const pg = new THREE.Group(); pg.position.set(px, 0, pz); g.add(pg);
    const pm = add(new THREE.SphereGeometry(1.05, 11, 8), MAT.hay, 0, 0.1, 0, pg, { cast: false }); pm.scale.set(s, 0.5 * s, s * 0.85);
    hayPiles.push(pg);
  });
  // ---- cotton bales (east side) — soft white bales, stacked ----
  const balePos = [[5.2, -7.2, 0], [5.2, -8.6, 0], [5.2, -7.9, 0.78], [6.3, -10.6, 0], [6.3, -12.0, 0], [6.3, -11.3, 0.78]];
  balePos.forEach(([bx, bz, by]) => {
    const bg2 = new THREE.Group(); bg2.position.set(bx, by, bz); g.add(bg2);
    const bm = add(new THREE.SphereGeometry(0.72, 11, 9), MAT.cotton, 0, 0.42, 0, bg2, { cast: false }); bm.scale.set(1.25, 0.62, 0.9);
    add(tbox(1.5, 0.05, 0.06, 1), MAT.woodDk, 0, 0.42, 0, bg2, { cast: false });
    baleMeshes.push(bg2);
  });
  // ---- THE LAMP (centre of the hall) + its light rig ----
  lampBowlG = new THREE.Group(); lampBowlG.position.set(0, 0, -9.2); g.add(lampBowlG);
  const bowl = add(new THREE.SphereGeometry(0.21, 12, 8), MAT.clay, 0, 0.07, 0, lampBowlG, { cast: false }); bowl.scale.y = 0.5;
  add(new THREE.CylinderGeometry(0.13, 0.16, 0.05, 12), MAT.clayDk, 0, 0.13, 0, lampBowlG, { cast: false });
  lampFlame = add(new THREE.SphereGeometry(0.082, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff9e35, fog: false }), 0, 0.3, 0, lampBowlG, { cast: false });
  lampFlame.scale.set(0.78, 1.8, 0.78); lampFlame.userData.ndSkip = true;
  lampFlameCore = add(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b8, fog: false }), 0, 0.27, 0, lampBowlG, { cast: false });
  lampFlameCore.scale.set(0.8, 1.5, 0.8); lampFlameCore.userData.ndSkip = true;
  lampGlowFloor = glowPlane(1); lampGlowFloor.rotation.x = -Math.PI / 2; lampGlowFloor.position.set(0, 0.03, -9.2); g.add(lampGlowFloor);
  for (const [cx, cz] of [[-7.0, -15.0], [7.0, -15.0], [-7.0, -3.6], [7.0, -3.6]]) {
    const cp = glowPlane(2.6); cp.rotation.x = -Math.PI / 2; cp.position.set(cx, 0.035, cz); g.add(cp); cornerPools.push(cp);
  }
  const washBack = glowPlane(6.5); washBack.position.set(0, 3.4, -15.85); g.add(washBack); wallWashes.push(washBack);
  for (const sx of [-7.9, 7.9]) {
    const wsh = glowPlane(5.5); wsh.position.set(sx, 3.2, -9.2); wsh.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(wsh); wallWashes.push(wsh);
  }
  lampLight = new THREE.PointLight(0xffa64d, 0, 40, 2.0); lampLight.position.set(0, 0.85, -9.2); g.add(lampLight);
  // ================= THE MARKET (west, x ≈ -20) =================
  const mkStall = (sx, sz, goods) => {
    const sg = new THREE.Group(); sg.position.set(sx, 0, sz); g.add(sg);
    for (const [px, pz] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) add(new THREE.CylinderGeometry(0.06, 0.08, 2.7, 7), MAT.woodDk, px, 1.35, pz, sg, { cast: false });
    const can = add(tbox(3.2, 0.07, 2.5, 2), MAT.thatch, 0, 2.75, 0, sg, { cast: false }); can.rotation.z = 0.03;
    add(tbox(2.7, 0.09, 1.5, 2), MAT.wood, 0, 0.92, 0.15, sg, { cast: false });
    for (const [lx, lz] of [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.8], [1.2, 0.8]]) add(tbox(0.08, 0.92, 0.08, 1), MAT.woodDk, lx, 0.46, lz, sg, { cast: false });
    return sg;
  };
  const hayStall = mkStall(-21, 3.4);
  const hsm = add(new THREE.SphereGeometry(0.95, 11, 8), MAT.hay, -0.5, 1.15, 0.15, hayStall, { cast: false }); hsm.scale.set(1.2, 0.55, 0.9);
  const hsm2 = add(new THREE.SphereGeometry(0.7, 10, 8), MAT.hayDk, 0.6, 1.1, 0.2, hayStall, { cast: false }); hsm2.scale.set(1.1, 0.5, 0.85);
  const cotStall = mkStall(-21, -0.8);
  for (const [gx, gz] of [[-0.6, 0.1], [0.4, 0.25], [0, 0.65]]) {
    const cm = add(new THREE.SphereGeometry(0.5, 10, 8), MAT.cotton, gx, 1.16, gz, cotStall, { cast: false }); cm.scale.set(0.95, 0.45, 0.75);
    add(tbox(0.98, 0.05, 0.05, 1), MAT.woodDk, gx, 1.16, gz + 0.37, cotStall, { cast: false });
  }
  const cmg = add(new THREE.SphereGeometry(0.5, 10, 8), MAT.cotton, 1.7, 0.3, 1.0, cotStall, { cast: false }); cmg.scale.set(1.1, 0.55, 0.85);
  add(tbox(1.12, 0.05, 0.05, 1), MAT.woodDk, 1.7, 0.3, 1.43, cotStall, { cast: false });
  const lampStall = mkStall(-21, -5.2);
  // rows of little clay lamps + oil bottles on the lamp stall counter
  for (let i = 0; i < 5; i++) {
    const lx = -0.95 + i * 0.48;
    const lb = add(new THREE.SphereGeometry(0.13, 9, 7), i === 2 ? MAT.goldDk : MAT.clay, lx, 1.0, 0.42, lampStall, { cast: false }); lb.scale.y = 0.5;
  }
  for (let i = 0; i < 3; i++) {
    add(new THREE.CylinderGeometry(0.07, 0.09, 0.34, 8), MAT.goldDk, 0.55 + i * 0.3, 1.14, -0.25, lampStall, { cast: false });
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6), MAT.dark, 0.55 + i * 0.3, 1.36, -0.25, lampStall, { cast: false });
  }
  // village houses east of the hall + trees
  for (const [hx, hz, ry] of [[13.5, -3.5, -0.3], [16.5, 2.5, 0.4], [-13.5, 6.5, 0.2]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.1, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.15, 1.15, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
    add(tbox(0.7, 1.1, 0.1, 1), MAT.woodDk, 0, 0.55, 1.06, h, { cast: false });
  }
  add(new THREE.CylinderGeometry(0.3, 0.44, 2.9, 8), MAT.woodDk, 14.2, 1.45, 8.2, g, { cast: false });
  const can = add(new THREE.SphereGeometry(2.0, 10, 8), MAT.leaf2, 14.2, 3.8, 8.2, g, { cast: false }); can.scale.y = 0.72; can.userData.ndSkip = true;
  add(new THREE.CylinderGeometry(0.34, 0.48, 3.4, 9), MAT.woodDk, -14.6, 1.7, -6.4, g, { cast: false });
  // market backdrop + apron
  for (const [hx, hz, ry] of [[-28.5, -8.5, 1.2], [-28.5, -1.5, 1.35], [-28.5, 5.5, 1.5], [-27.5, 11.5, 1.1]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.1, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.15, 1.15, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
    add(tbox(0.7, 1.1, 0.1, 1), MAT.woodDk, 0, 0.55, 1.06, h, { cast: false });
  }
  add(tbox(15, 0.024, 17, 1), MAT.dirt, -21.5, 0.0, -1, g, { cast: false });
  const can2 = add(new THREE.SphereGeometry(2.3, 10, 8), MAT.leaf, -14.6, 4.2, -6.4, g, { cast: false }); can2.scale.y = 0.72; can2.userData.ndSkip = true;
}
lampGlowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
lampGlowSprite.scale.setScalar(1.15); lampGlowSprite.position.set(0, 0.42, -9.2); lampGlowSprite.userData.ndSkip = true; world.add(lampGlowSprite);
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
function postSign(lines, w, h, bg, fg, gx, gz, ry, cy = 1.5) {
  const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = ry; world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, Math.max(1.2, cy + h / 2), 6), MAT.woodDk, 0, (cy + h / 2) / 2, -0.06, g, { cast: false });
  const b = textBoard(lines, w, h, bg, fg); b.position.set(0, cy, 0.05); g.add(b);
  return b;
}
const boardBet = postSign(['एक सिक्का', 'पूरा हॉल भर दो'], 2.3, 1.15, '#4a2c14', '#ffd76a', 4.35, 2.35, 0.5, 1.6);
const boardLamp = postSign(['दीया + तेल', '= एक सिक्का'], 1.9, 1.0, '#2e4a5a', '#ffe9a8', -22.25, -7.0, 1.13, 1.55);
const boardHook = postSign(['कौन सी मौत?'], 2.0, 0.75, '#3a2438', '#ffd7e8', 9.9, 2.1, -0.7, 1.75);


// ---------- FX: day haze, hall dust motes, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.6, 2, { rate: 0.3, color: 0xffe2b0, opacity: 0.045, scale: 2.4, grow: 1.3, life: 2.8, vy: 0.1, wind: -0.4 });
const dustEmit = smoke.addEmitter(0, 1.4, -9, { rate: 0.1, color: 0xd8c9a8, opacity: 0.13, scale: 0.5, grow: 1.6, life: 1.4, vy: 0.25, wind: 0.2 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 42, opacity: 0.2, color: 0xf4f6fa, drift: 0.5 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
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
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate;
    smoke.update(t, dt);
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

// ---------- render targets & post (ink/dof contract) ----------
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
  const setB = (mesh, v) => { mesh.material.opacity = v; mesh.visible = v > 0.01; };
  setB(boardBet, Ws.boardBet || 0); setB(boardLamp, Ws.boardLamp || 0); setB(boardHook, Ws.boardHook || 0);
  // hay cart: enters loaded through the door (world z -3.4 -> -7.6), wheels turn with travel
  const hz = Ws.hayCartZ || 0;
  hayCartG.position.z = -3.4 - hz;
  hayCartG.position.x = Ws.cartX || 0;
  hayWheels.forEach((piv) => { piv.rotation.z = hz / 0.58; });
  const moundS = Math.max(0.25, 1 - 0.22 * (Ws.hayK || 0));
  hayMound.scale.set(moundS, moundS, moundS);
  hayPiles.forEach((pg, i) => { const s = Math.max(0.001, Math.min(1, (Ws.hayK || 0) - i)); pg.visible = (Ws.hayK || 0) - i > 0.02; pg.scale.set(s, s, s); });
  baleMeshes.forEach((bg, i) => { const s = Math.max(0.001, Math.min(1, (Ws.cottonK || 0) - i)); bg.visible = (Ws.cottonK || 0) - i > 0.02; bg.scale.set(s, s, s); });
  // the lamp + its light: soft radial pools, brightest at the flame, no hard edges
  const lk = Ws.lampK || 0, gk = Ws.glowK || 0;
  const bk = Ws.lampBowlK ?? 1;
  lampBowlG.visible = bk > 0.02; lampBowlG.scale.setScalar(Math.max(0.001, bk));
  lampFlame.visible = lk > 0.02;
  lampFlame.scale.set(0.78 * (1 + 0.1 * Math.sin(f * 1.31)), 1.8 * lk * (1 + 0.09 * Math.sin(f * 1.73 + 1)), 0.78);
  lampFlameCore.visible = lk > 0.02;
  lampFlameCore.scale.set(0.8 * (1 + 0.08 * Math.sin(f * 1.31 + 0.6)), 1.5 * lk * (1 + 0.07 * Math.sin(f * 1.73 + 1.6)), 0.8);
  lampLight.intensity = lk * 30;
  lampGlowFloor.visible = lk > 0.02;
  const gs = 1 + 15.5 * gk;
  lampGlowFloor.scale.set(gs, gs, 1);
  lampGlowFloor.material.opacity = 0.8 * Math.min(1, lk * 2) * (0.3 + 0.7 * gk);
  cornerPools.forEach((cp, i) => { cp.material.opacity = 0.75 * clamp01(gk * 3.2 - i * 0.6) * Math.min(1, lk * 2); });
  wallWashes.forEach((w) => { w.material.opacity = 0.5 * gk * Math.min(1, lk * 2); });
  lampGlowSprite.material.opacity = lk * 0.85;
  lampGlowSprite.position.y = 0.42 + 0.02 * Math.sin(f * 1.73);
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
window.TOTAL = TOTAL;
window.ready = true;
