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

// ---------- the set: the royal treasury at dusk, one stage ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldDk: toon({ color: '#a87c24' }),
  plaster: texM(P.plaster(33, 36), 2, 2),
  dark: toon({ color: '#33302c' }), iron: toon({ color: '#4a4d55' }),
  sack: toon({ color: '#a8803e' }),
  goldGlow: new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
let doorL, doorR, lockG, cartG, sacks = [], wheelPivots = [], coatG, capG, ringG, vaultGlow, vaultGlint, coinGlint;
{
  const g = world;
  const gr = flat(add(new THREE.PlaneGeometry(260, 260), MAT.grass, 8, -0.03, 0, g, { cast: false })); gr.receiveShadow = true;
  flat(add(new THREE.CircleGeometry(9.5, 24), MAT.dirt, 0, -0.012, 1.5, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(30, 3.2), MAT.dirt, 12, -0.014, 1.2, g, { cast: false }));
  // ================= THE TREASURY (origin; facade plane z = -2) =================
  const FZ = -2;
  add(tbox(5.8, 5.4, 0.5, 2), MAT.stoneDk, -4.6, 2.7, FZ, g, { cast: false });
  add(tbox(5.8, 5.4, 0.5, 2), MAT.stoneDk, 4.6, 2.7, FZ, g, { cast: false });
  add(tbox(15.0, 2.0, 0.5, 2), MAT.stoneDk, 0, 4.4, FZ, g, { cast: false });
  add(tbox(15.6, 0.4, 0.9, 2), MAT.stone, 0, 5.55, FZ, g, { cast: false });
  add(tbox(3.9, 0.35, 0.7, 2), MAT.stone, 0, 3.32, FZ, g, { cast: false });
  // corner towers
  for (const sx of [-7.6, 7.6]) {
    add(new THREE.CylinderGeometry(0.85, 1.0, 6.4, 10), MAT.stoneDk, sx, 3.2, FZ, g, { cast: false });
    add(new THREE.ConeGeometry(1.15, 1.1, 10), MAT.thatch, sx, 6.95, FZ, g, { cast: false });
  }
  // the great doors (hinged groups; rotation driven by worldAt.gateOpen)
  const mkDoor = (side) => {
    const grp = new THREE.Group(); grp.position.set(1.7 * side, 0, FZ); g.add(grp);
    const panel = add(tbox(1.7, 3.3, 0.14, 2), MAT.woodDk, -0.85 * side, 1.65, 0, grp);
    for (const by of [0.7, 1.65, 2.6]) add(tbox(1.66, 0.16, 0.05, 1), MAT.goldDk, -0.85 * side, by, 0.1, grp, { cast: false });
    const ring = add(new THREE.TorusGeometry(0.17, 0.035, 8, 18), MAT.gold, -0.28 * side, 1.55, 0.14, grp, { cast: false });
    return grp;
  };
  doorL = mkDoor(-1); doorR = mkDoor(1);
  // padlock + chain at the door centre (drops when the guards open it)
  lockG = new THREE.Group(); lockG.position.set(0, 1.5, FZ + 0.28); g.add(lockG);
  add(tbox(0.36, 0.42, 0.13, 1), MAT.goldDk, 0, -0.08, 0, lockG, { cast: false });
  add(new THREE.TorusGeometry(0.14, 0.04, 8, 16), MAT.iron, 0, 0.16, 0, lockG, { cast: false });
  const ch1 = add(tbox(1.5, 0.07, 0.05, 1), MAT.iron, -0.72, 0.18, -0.02, lockG, { cast: false }); ch1.rotation.z = 0.22;
  const ch2 = add(tbox(1.5, 0.07, 0.05, 1), MAT.iron, 0.72, 0.18, -0.02, lockG, { cast: false }); ch2.rotation.z = -0.22;
  // guard post mounds
  for (const sx of [-2.7, 2.7]) {
    const m = add(new THREE.CylinderGeometry(0.85, 1.0, 0.14, 12), MAT.stone, sx, 0.07, -0.55, g, { cast: false });
  }
  // interior vault (seen when the doors open / in the routine scene)
  flat(add(new THREE.PlaneGeometry(13, 7.5), MAT.stoneDk, 0, -0.005, -5.7, g, { cast: false }));
  add(tbox(13, 5.4, 0.4, 2), MAT.stoneDk, 0, 2.7, -9.4, g, { cast: false });
  for (const [mx, mz, mr, mh] of [[-2.6, -6.2, 1.6, 1.35], [2.9, -6.6, 1.35, 1.1], [-3.4, -7.6, 1.1, 0.85]]) {
    add(new THREE.ConeGeometry(mr, mh, 12), MAT.gold, mx, mh / 2, mz, g, { cast: false });
    add(new THREE.SphereGeometry(mr * 0.4, 8, 6), MAT.gold, mx + mr * 0.3, mh * 0.82, mz, g, { cast: false });
  }
  flat(add(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 12), MAT.gold, 1.4, 0.03, -5.4, g, { cast: false }));
  // counting table + coin stacks
  add(tbox(2.3, 0.1, 1.15, 2), MAT.wood, 0, 0.95, -3.1, g, { cast: false });
  for (const [lx, lz] of [[-1.0, -2.75], [1.0, -2.75], [-1.0, -3.45], [1.0, -3.45]]) add(tbox(0.09, 0.95, 0.09, 1), MAT.woodDk, lx, 0.47, lz, g, { cast: false });
  for (let i = 0; i < 6; i++) {
    const sx = -0.75 + (i % 3) * 0.62, sz = -3.25 + Math.floor(i / 3) * 0.34, sh = 0.1 + (i * 37 % 13) / 60;
    add(new THREE.CylinderGeometry(0.11, 0.11, sh, 10), MAT.gold, sx, 1.0 + sh / 2, sz, g, { cast: false });
  }
  for (let i = 0; i < 7; i++) add(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 10), MAT.gold, -0.4 + i * 0.13, 1.01, -2.85, g, { cast: false });
  vaultGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.2), MAT.goldGlow); vaultGlow.position.set(0, 1.7, -9.15); vaultGlow.castShadow = false; vaultGlow.userData.ndSkip = true; g.add(vaultGlow);
  // ================= watching pillar (west of the gate) =================
  add(new THREE.CylinderGeometry(0.34, 0.42, 4.4, 10), MAT.stone, -4.6, 2.2, 0.9, g, { cast: false });
  add(tbox(1.3, 0.3, 1.3, 2), MAT.stoneDk, -4.6, 4.5, 0.9, g, { cast: false });
  add(tbox(2.6, 2.2, 0.4, 2), MAT.stoneDk, -6.4, 1.1, -0.4, g, { cast: false });
  // ================= tailor stall (west) =================
  for (const [px, pz] of [[-8.6, 1.2], [-6.2, 1.2], [-8.6, 3.4], [-6.2, 3.4]]) add(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 7), MAT.woodDk, px, 1.3, pz, g, { cast: false });
  const canopy = add(tbox(3.0, 0.07, 2.8, 2), MAT.thatch, -7.4, 2.62, 2.3, g, { cast: false }); canopy.rotation.z = 0.04;
  add(tbox(2.2, 0.07, 0.07, 1), MAT.woodDk, -7.4, 1.94, 1.35, g, { cast: false });
  // the stitched green coat, hanging (coatK scales it in)
  coatG = new THREE.Group(); coatG.position.set(-7.5, 1.94, 1.38); g.add(coatG);
  add(tbox(0.66, 0.92, 0.2, 1), toon({ color: '#2e7d3a' }), 0, -0.52, 0, coatG, { cast: false });
  const sl1 = add(tbox(0.2, 0.7, 0.18, 1), toon({ color: '#2e7d3a' }), -0.44, -0.42, 0, coatG, { cast: false }); sl1.rotation.z = 0.25;
  const sl2 = add(tbox(0.2, 0.7, 0.18, 1), toon({ color: '#2e7d3a' }), 0.44, -0.42, 0, coatG, { cast: false }); sl2.rotation.z = -0.25;
  add(tbox(0.7, 0.1, 0.24, 1), toon({ color: '#d9a441' }), 0, -0.62, 0, coatG, { cast: false });
  // the white cap on its stand (capK)
  capG = new THREE.Group(); capG.position.set(-8.25, 0, 2.25); g.add(capG);
  add(new THREE.CylinderGeometry(0.05, 0.07, 1.06, 7), MAT.woodDk, 0, 0.53, 0, capG, { cast: false });
  const capDome = add(new THREE.SphereGeometry(0.27, 12, 8), toon({ color: '#f4efe4' }), 0, 1.1, 0, capG, { cast: false }); capDome.scale.y = 0.62;
  // work table with wax + the moulded seal ring (ringK)
  add(tbox(1.3, 0.08, 0.8, 2), MAT.wood, -6.85, 0.88, 2.4, g, { cast: false });
  for (const [lx, lz] of [[-7.4, 2.1], [-6.3, 2.1], [-7.4, 2.7], [-6.3, 2.7]]) add(tbox(0.07, 0.88, 0.07, 1), MAT.woodDk, lx, 0.44, lz, g, { cast: false });
  ringG = new THREE.Group(); ringG.position.set(-6.85, 0.93, 2.4); g.add(ringG);
  const wax = add(new THREE.SphereGeometry(0.17, 10, 8), toon({ color: '#a02318' }), -0.22, 0.03, 0, ringG, { cast: false }); wax.scale.y = 0.55;
  const ringM = add(new THREE.TorusGeometry(0.11, 0.038, 8, 18), MAT.gold, 0.2, 0.05, 0, ringG, { cast: false }); ringM.rotation.x = 0.35;
  add(new THREE.SphereGeometry(0.055, 8, 6), toon({ color: '#a02318' }), 0.2, 0.13, 0, ringG, { cast: false });
  // ================= the cart (east of the gate) =================
  cartG = new THREE.Group(); cartG.position.set(4.4, 0, 0.7); cartG.rotation.y = -0.1; g.add(cartG);
  add(tbox(2.5, 0.16, 1.35, 2), MAT.wood, 0, 0.78, 0, cartG, { cast: false });
  for (const sz of [-0.64, 0.64]) add(tbox(2.5, 0.3, 0.07, 2), MAT.woodDk, 0, 0.98, sz, cartG, { cast: false });
  for (const sx of [-1.22, 1.22]) add(tbox(0.07, 0.3, 1.35, 2), MAT.woodDk, sx, 0.98, 0, cartG, { cast: false });
  for (const sz of [-0.45, 0.45]) { const h = add(tbox(1.1, 0.09, 0.09, 1), MAT.woodDk, -1.75, 0.72, sz, cartG, { cast: false }); h.rotation.z = 0.18; }
  for (const sz of [-0.74, 0.74]) {
    const piv = new THREE.Group(); piv.position.set(0, 0.56, sz); cartG.add(piv); wheelPivots.push(piv);
    const wm = add(new THREE.CylinderGeometry(0.56, 0.56, 0.1, 14), MAT.woodDk, 0, 0, 0, piv, { cast: false }); wm.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.13, 10), MAT.goldDk, 0, 0, 0, piv, { cast: false }).rotation.x = Math.PI / 2;
    for (let k = 0; k < 4; k++) { const sp = add(tbox(0.09, 1.0, 0.05, 1), MAT.wood, 0, 0, 0, piv, { cast: false }); sp.rotation.z = k * Math.PI / 4; }
  }
  const sackPos = [[-0.82, -0.33], [-0.28, -0.33], [0.28, -0.33], [0.82, -0.33], [-0.82, 0.33], [-0.28, 0.33], [0.28, 0.33], [0.82, 0.33], [-0.28, 0], [0.28, 0]];
  sackPos.forEach(([sx, sz], i) => {
    const sg = new THREE.Group(); sg.position.set(sx, i >= 8 ? 1.32 : 0.88, sz); cartG.add(sg);
    const sm = add(new THREE.SphereGeometry(0.34, 10, 8), MAT.sack, 0, 0.1, 0, sg, { cast: false }); sm.scale.y = 0.78;
    add(new THREE.CylinderGeometry(0.07, 0.1, 0.1, 8), MAT.woodDk, 0, 0.34, 0, sg, { cast: false });
    sacks.push(sg);
  });
  // ================= the zamindar's great hall (hook, east) =================
  const hg = new THREE.Group(); hg.position.set(25, 0, -6.5); g.add(hg);
  add(tbox(11, 7, 0.6, 2), MAT.plaster, 0, 3.5, 0, hg, { cast: false });
  add(tbox(11.8, 0.5, 1.1, 2), MAT.stoneDk, 0, 7.2, 0, hg, { cast: false });
  const dome = add(new THREE.SphereGeometry(1.9, 14, 10), MAT.gold, 0, 7.45, 0, hg, { cast: false }); dome.scale.y = 0.75;
  add(tbox(1.9, 3.3, 0.25, 2), MAT.dark, 0, 1.65, 0.32, hg, { cast: false });
  add(tbox(2.3, 0.35, 0.3, 2), MAT.goldDk, 0, 3.45, 0.32, hg, { cast: false });
  for (const px of [-3.2, -1.6, 1.6, 3.2]) {
    add(new THREE.CylinderGeometry(0.27, 0.32, 5.4, 10), MAT.stone, px, 2.7, 3.1, hg, { cast: false });
    add(tbox(0.8, 0.3, 0.8, 2), MAT.stoneDk, px, 5.5, 3.1, hg, { cast: false });
    add(tbox(0.85, 0.3, 0.85, 2), MAT.stoneDk, px, 0.15, 3.1, hg, { cast: false });
  }
  add(tbox(8.6, 0.5, 1.0, 2), MAT.stone, 0, 5.75, 3.1, hg, { cast: false });
  for (let i = 0; i < 3; i++) add(tbox(4.6 - i * 0.9, 0.22, 1.6 + i * 0.5, 2), MAT.stone, 0, 0.11 + i * 0.22, 1.6 + i * 0.4, hg, { cast: false });
  // village bits near the hall
  for (const [hx, hz, ry] of [[18.6, -5.2, 0.3], [31.8, -3.4, -0.4]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.4, 1.6, 2.0, 2), MAT.stone, 0, 0.8, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.0, 1.1, 4), MAT.thatch, 0, 2.15, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  add(new THREE.CylinderGeometry(0.3, 0.44, 2.8, 8), MAT.woodDk, 20.2, 1.4, -3.4, g, { cast: false });
  const can = add(new THREE.SphereGeometry(1.9, 10, 8), MAT.leaf2, 20.2, 3.6, -3.4, g, { cast: false }); can.scale.y = 0.72; can.userData.ndSkip = true;
  add(new THREE.CylinderGeometry(0.36, 0.5, 3.6, 9), MAT.woodDk, -9.8, 1.8, -3.2, g, { cast: false });
  const can2 = add(new THREE.SphereGeometry(2.4, 10, 8), MAT.leaf, -9.8, 4.4, -3.2, g, { cast: false }); can2.scale.y = 0.72; can2.userData.ndSkip = true;
}
vaultGlint = FX.glint(0.6); vaultGlint.position.set(0.8, 1.35, -5.4); vaultGlint.userData.ndSkip = true; world.add(vaultGlint);
coinGlint = FX.glint(0.35); coinGlint.position.set(23.3, 1.36, -0.72); coinGlint.userData.ndSkip = true; world.add(coinGlint);
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
function postSign(lines, w, h, bg, fg, gx, gz, ry, cy = 1.5) {
  const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = ry; world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, Math.max(1.2, cy + h / 2), 6), MAT.woodDk, 0, (cy + h / 2) / 2, -0.06, g, { cast: false });
  const b = textBoard(lines, w, h, bg, fg); b.position.set(0, cy, 0.05); g.add(b);
  return b;
}
const boardTreasury = textBoard(['राजा का ख़ज़ाना'], 3.0, 0.85, '#4a2c14', '#ffd76a'); boardTreasury.position.set(0, 4.45, -1.7); world.add(boardTreasury);
const boardLetter = postSign(['हुक्मनामा', 'दस बोरी सोना', 'टकसाल भेजो'], 1.7, 1.5, '#e8dcc0', '#4a2c14', 2.4, 1.2, -0.2, 1.75);
const boardHook = postSign(['एक सिक्का?'], 2.0, 0.75, '#2e5a2e', '#ffe9a8', 23.6, -2.6, 0.35, 1.5);

// ---------- FX: dusk haze, gate dust, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.6, -2, { rate: 0.3, color: 0xffe2b0, opacity: 0.045, scale: 2.4, grow: 1.3, life: 2.8, vy: 0.1, wind: -0.4 });
const dustEmit = smoke.addEmitter(0, 0.7, 0.5, { rate: 0.1, color: 0xe8d9b0, opacity: 0.16, scale: 0.5, grow: 1.6, life: 1.1, vy: 0.5, wind: 0.3 });
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
  setB(boardTreasury, Ws.boardTreasury || 0); setB(boardLetter, Ws.boardLetter || 0); setB(boardHook, Ws.boardHook || 0);
  doorL.rotation.y = (Ws.gateOpen || 0) * 1.85;
  doorR.rotation.y = -(Ws.gateOpen || 0) * 1.85;
  const lk = Ws.lockK ?? 1;
  lockG.visible = lk > 0.02;
  lockG.position.y = 1.5 - (1 - lk) * 1.3;
  lockG.rotation.z = (Ws.lockRot || 0) + (1 - lk) * 0.9;
  const setScale = (grp, v) => { grp.visible = v > 0.02; const s = Math.max(0.001, v); grp.scale.set(s, s, s); };
  setScale(coatG, Ws.coatK || 0); setScale(capG, Ws.capK || 0); setScale(ringG, Ws.ringK || 0);
  cartG.position.x = 4.4 + (Ws.cartX || 0);
  wheelPivots.forEach((piv) => { piv.rotation.z = -(Ws.cartX || 0) / 0.56; });
  sacks.forEach((sg, i) => { const s = Math.max(0.001, Math.min(1, (Ws.bags || 0) - i)); sg.visible = (Ws.bags || 0) - i > 0.02; sg.scale.set(s, s, s); });
  MAT.goldGlow.opacity = (Ws.goldK || 0) * 0.34;
  vaultGlint.material.opacity = (Ws.goldK || 0) * 0.65;
  coinGlint.material.opacity = (Ws.coinK || 0) * 0.9;
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
