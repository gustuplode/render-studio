import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, cartPosAt, RINGP, COINP } from './story.js';

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
const MW = {
  dark: toon({ color: '#3c3a38' }),
  gold: toon({ color: '#c9a227' }),
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
  g.font = `${font} ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (lines.length === 1 ? 0.52 : (i + 0.5) / lines.length)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};
// the forged order: parchment letter WITH the king's red wax seal
const letterBoard = (lines, w, h) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d'); g.fillStyle = '#e8d9ae'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#4a2c14'; g.lineWidth = 12; g.strokeRect(18, 18, c.width - 36, c.height - 36);
  g.fillStyle = '#4a2c14'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.min(170, (c.width - 130) / Math.max(...lines.map((l) => l.length)) * 1.72);
  g.font = `900 ${fs}px Arial`;
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height * (i + 0.5) / lines.length));
  const sx = c.width * 0.87, sy = c.height * 0.115, sr = c.height * 0.065;   // wax seal, top-right clear of the text
  g.fillStyle = '#b3392e'; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  g.strokeStyle = '#7e271e'; g.lineWidth = 6; g.beginPath(); g.arc(sx, sy, sr * 0.62, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.userData.ndSkip = true; return m;
};
// soft radial glow sprite (NO hard cross — lamp light, not a sparkle)
const softGlow = (scale, color, opacity) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); s.userData.ndSkip = true; return s;
};

// ---------- the set ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  plaster: texM(P.plaster(71, 36), 2, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldBright: toon({ color: '#f0bc4a' }),
  sack: toon({ color: '#c9a24d' }), sackDk: toon({ color: '#a37f36' }),
  steel: toon({ color: '#565d66' }), steelDk: toon({ color: '#33373d' }),
  coatGreen: toon({ color: '#2e7a3f' }), coatDk: toon({ color: '#22602f' }),
  white: toon({ color: '#f7f3e6' }), wax: toon({ color: '#e8ddc4' }),
  cushion: toon({ color: '#8c2432' }),
  dark: toon({ color: '#33302c' }),
  glowWarm: new THREE.MeshBasicMaterial({ color: 0xffc37a, transparent: true, opacity: 0, fog: true }),
  goldGlow: new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(300, 240), MAT.grass, 8, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(64, 7), MAT.dirt, 10, -0.012, 3.4, g, { cast: false }));       // the road
  flat(add(new THREE.CircleGeometry(8.5, 22), MAT.dirt, 0, -0.008, 0.5, g, { cast: false }));      // treasury courtyard
  // distant huts + trees (depth for the eastward flight)
  for (const [hx, hz, ry] of [[-7, -13, 0.2], [8, -14, -0.3], [20, -12, 0.4], [26, -13, -0.2]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-11, -9, 1], [12.5, -10, 1.2], [23, -9, 0.9]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ================= THE TREASURY (gate at x=0, facade z=-3.2) =================
let doorL, doorR, keyL, keyR, shackle, gateGlow, gateGlint;
{
  const g = world;
  add(tbox(6.9, 4.9, 0.5, 2), MAT.stoneDk, -4.6, 2.45, -3.45, g, { cast: false });
  add(tbox(6.9, 4.9, 0.5, 2), MAT.stoneDk, 4.6, 2.45, -3.45, g, { cast: false });
  add(tbox(16.1, 0.4, 0.7, 2), MAT.stone, 0, 5.05, -3.45, g, { cast: false });
  add(tbox(2.4, 2.35, 0.5, 2), MAT.stoneDk, 0, 3.72, -3.45, g, { cast: false });   // lintel over the gate (no sky-hole)
  for (const sx of [-5.9, 5.9]) {   // gate towers
    add(new THREE.CylinderGeometry(1.05, 1.2, 6.0, 10), MAT.stone, sx, 3.0, -3.45, g, { cast: false });
    add(new THREE.ConeGeometry(1.5, 1.3, 10), MAT.thatch, sx, 6.6, -3.45, g, { cast: false });
  }
  // gold glow inside (spills when the doors open)
  gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.6), MAT.goldGlow); gateGlow.position.set(0, 1.3, -3.75); gateGlow.castShadow = false; gateGlow.userData.ndSkip = true; g.add(gateGlow);
  add(tbox(2.3, 2.6, 0.1, 2), MAT.dark, 0, 1.3, -3.85, g, { cast: false });
  // real gold shapes inside the doorway (the glow backlights them, not a flat slab)
  const gs1 = add(new THREE.SphereGeometry(0.32, 9, 7), MAT.sack, -0.55, 0.23, -3.62, g, { cast: false }); gs1.scale.y = 0.72;
  const gs2 = add(new THREE.SphereGeometry(0.32, 9, 7), MAT.sack, 0.52, 0.23, -3.66, g, { cast: false }); gs2.scale.y = 0.72;
  add(new THREE.ConeGeometry(0.3, 0.26, 10), MAT.gold, 0, 0.13, -3.6, g, { cast: false });
  // doors on hinge groups (hinge at the outer edge, panel extends inward)
  const mkDoor = (side) => {
    const grp = new THREE.Group(); grp.position.set(side * 1.15, 0, -3.12); g.add(grp);
    add(tbox(1.15, 2.6, 0.12, 2), MAT.woodDk, -side * 0.575, 1.3, 0, grp, { cast: false });
    add(tbox(1.15, 0.16, 0.05, 2), MAT.steelDk, -side * 0.575, 2.15, 0.09, grp, { cast: false });
    add(tbox(1.15, 0.16, 0.05, 2), MAT.steelDk, -side * 0.575, 0.5, 0.09, grp, { cast: false });
    const key = new THREE.Group(); key.position.set(-side * 0.6, 1.35, 0.14); grp.add(key);
    const bow = add(new THREE.TorusGeometry(0.11, 0.028, 8, 16), MAT.gold, 0, 0.13, 0, key, { cast: false });
    add(new THREE.CylinderGeometry(0.032, 0.032, 0.3, 8), MAT.gold, 0, -0.05, 0, key, { cast: false });
    add(box(0.05, 0.09, 0.05), MAT.gold, 0.05, -0.17, 0, key, { cast: false });
    add(box(0.05, 0.07, 0.05), MAT.gold, 0.05, -0.1, 0, key, { cast: false });
    return [grp, key];
  };
  [doorL, keyL] = mkDoor(-1); [doorR, keyR] = mkDoor(1);
  // the padlock hangs on the RIGHT door (swings with it when the gate opens)
  const lock = new THREE.Group(); lock.position.set(-1.15, 1.3, 0.2); doorR.add(lock);
  add(tbox(0.36, 0.32, 0.12, 2), MAT.steel, 0, -0.08, 0, lock, { cast: false });
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 10), MAT.steelDk, 0, -0.1, 0.07, lock, { cast: false }).rotation.x = Math.PI / 2;
  shackle = new THREE.Group(); shackle.position.set(0, 0.05, 0); lock.add(shackle);
  const sh = add(new THREE.TorusGeometry(0.13, 0.032, 8, 18, Math.PI), MAT.steel, 0, 0, 0, shackle, { cast: false });
  gateGlint = FX.glint(0.42); gateGlint.position.set(-1.15, 1.35, 0.38); gateGlint.userData.ndSkip = true; doorR.add(gateGlint);
  // guards' spears planted at their posts
  for (const sx of [-2.62, 2.62]) {
    add(new THREE.CylinderGeometry(0.03, 0.035, 2.7, 7), MAT.woodDk, sx, 1.35, -1.9, g, { cast: false });
    add(new THREE.ConeGeometry(0.07, 0.34, 8), MAT.steel, sx, 2.85, -1.9, g, { cast: false });
  }
  // crates the thief hides behind (west of the courtyard)
  const c1 = FX.crate(1.15); c1.position.set(-5.5, 0.55, 0.55); g.add(c1);
  const c2 = FX.crate(0.95); c2.position.set(-5.35, 1.55, 0.6); c2.rotation.y = 0.4; g.add(c2);
  const b1 = FX.barrel(0.52, 1.25); b1.position.set(-4.35, 0.62, 0.35); g.add(b1);
}
// ================= COUNTING CHAMBER (x=-16) =================
let ringGlint;
{
  const g = world, cx = -16;
  flat(add(new THREE.PlaneGeometry(11, 9), MAT.stone, cx, -0.005, -5.4, g, { cast: false }));
  add(tbox(10.5, 4.2, 0.4, 2), MAT.stoneDk, cx, 2.1, -8.7, g, { cast: false });
  add(tbox(0.4, 4.2, 5.4, 2), MAT.stoneDk, cx - 5.2, 2.1, -6.0, g, { cast: false });
  add(tbox(0.4, 4.2, 5.4, 2), MAT.stoneDk, cx + 5.2, 2.1, -6.0, g, { cast: false });
  add(tbox(11, 0.35, 6.4, 2), MAT.woodDk, cx, 4.35, -6.2, g, { cast: false });
  const lampGlow = softGlow(1.9, 0xffc98a, 0.16); lampGlow.position.set(cx - 3.4, 2.3, -8.3); g.add(lampGlow);
  // counting table
  add(tbox(3.4, 0.12, 1.15, 2), MAT.wood, cx, 0.74, -4.6, g, { cast: false });
  for (const [lx, lz] of [[-1.5, -0.45], [1.5, -0.45], [-1.5, 0.45], [1.5, 0.45]]) add(box(0.12, 0.72, 0.12), MAT.woodDk, cx + lx, 0.36, -4.6 + lz, g, { cast: false });
  // coin stacks + gold pile on the table
  for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.09, 0.09, 0.05 + (i % 3) * 0.045, 10), MAT.goldBright, cx - 0.9 + i * 0.34, 0.83 + (i % 3) * 0.02, -4.75, g, { cast: false });
  const pile = add(new THREE.ConeGeometry(0.3, 0.24, 12), MAT.gold, cx + 1.2, 0.92, -4.9, g, { cast: false });
  for (const [sx, sz] of [[-2.3, -6.1], [2.4, -6.0], [0.3, -6.35]]) {
    const s = add(new THREE.SphereGeometry(0.34, 9, 7), MAT.sack, cx + sx, 0.24, sz, g, { cast: false }); s.scale.y = 0.72;
  }
  // THE SEAL RING on its red cushion
  add(box(0.36, 0.09, 0.36), MAT.cushion, RINGP[0], 0.8, RINGP[2], g, { cast: false });
  const ring = new THREE.Group(); ring.position.set(RINGP[0], 0.98, RINGP[2]); ring.rotation.x = -0.35; g.add(ring);
  add(new THREE.TorusGeometry(0.155, 0.045, 10, 22), MAT.goldBright, 0, 0, 0, ring, { cast: false });
  const seal = add(new THREE.CylinderGeometry(0.13, 0.13, 0.055, 16), MAT.gold, 0, 0.17, 0, ring, { cast: false }); seal.rotation.x = Math.PI / 2 - 0.35;
  ringGlint = FX.glint(0.45); ringGlint.position.set(RINGP[0], 1.05, RINGP[2] + 0.15); ringGlint.userData.ndSkip = true; g.add(ringGlint);
}
// ================= THIEF'S HUT (x=+16) =================
{
  const g = world, hx = 16;
  flat(add(new THREE.CircleGeometry(4.6, 18), MAT.dirt, hx, -0.006, -1.2, g, { cast: false }));
  add(tbox(7.5, 3.1, 0.35, 2), MAT.plaster, hx, 1.55, -3.7, g, { cast: false });
  add(tbox(0.35, 3.1, 4.4, 2), MAT.plaster, hx + 3.7, 1.55, -1.6, g, { cast: false });
  const roof = add(tbox(8.2, 0.14, 5.2, 2), MAT.thatch, hx, 3.35, -1.7, g, { cast: false }); roof.rotation.x = 0.1;
  const lampGlow = softGlow(1.5, 0xffc98a, 0.14); lampGlow.position.set(hx - 2.6, 2.0, -3.3); g.add(lampGlow);
  // work table
  add(tbox(2.7, 0.1, 1.05, 2), MAT.wood, hx, 0.72, -0.9, g, { cast: false });
  for (const [lx, lz] of [[-1.2, -0.4], [1.2, -0.4], [-1.2, 0.4], [1.2, 0.4]]) add(box(0.11, 0.7, 0.11), MAT.woodDk, hx + lx, 0.35, -0.9 + lz, g, { cast: false });
  // the white cap on the table
  const cap = add(new THREE.SphereGeometry(0.17, 12, 8), MAT.white, hx + 0.55, 0.82, -0.9, g, { cast: false }); cap.scale.y = 0.55;
  add(new THREE.CylinderGeometry(0.175, 0.185, 0.05, 12), MAT.white, hx + 0.55, 0.79, -0.9, g, { cast: false });
  // wax block + the carved wax ring copy
  add(box(0.22, 0.12, 0.22), MAT.wax, hx - 0.45, 0.83, -1.05, g, { cast: false });
  const wax = new THREE.Group(); wax.position.set(15.8, 0.86, -0.85); wax.rotation.x = -0.3; g.add(wax);
  add(new THREE.TorusGeometry(0.125, 0.038, 9, 20), MAT.wax, 0, 0, 0, wax, { cast: false });
  const wseal = add(new THREE.CylinderGeometry(0.105, 0.105, 0.045, 14), MAT.wax, 0, 0.14, 0, wax, { cast: false }); wseal.rotation.x = Math.PI / 2 - 0.3;
  // carving knife leaning on the table edge
  const knife = new THREE.Group(); knife.position.set(16.15, 0.79, -0.7); knife.rotation.z = 0.5; g.add(knife);
  add(box(0.05, 0.2, 0.03), MAT.woodDk, 0, -0.08, 0, knife, { cast: false });
  add(new THREE.ConeGeometry(0.035, 0.22, 6), MAT.steel, 0, 0.12, 0, knife, { cast: false });
  // tailor's stand with the stitched GREEN COAT (the disguise, waiting)
  add(new THREE.CylinderGeometry(0.045, 0.045, 1.85, 8), MAT.woodDk, hx + 1.1, 0.92, -1.6, g, { cast: false });
  add(new THREE.CylinderGeometry(0.3, 0.36, 0.06, 10), MAT.woodDk, hx + 1.1, 0.03, -1.6, g, { cast: false });
  add(tbox(0.95, 0.07, 0.07, 2), MAT.woodDk, hx + 1.1, 1.82, -1.6, g, { cast: false });
  const coat = new THREE.Group(); coat.position.set(hx + 1.1, 0, -1.6); g.add(coat);
  add(tbox(0.64, 0.88, 0.17, 2), MAT.coatGreen, 0, 1.32, 0, coat, { cast: false });
  const sl = add(tbox(0.16, 0.62, 0.15, 2), MAT.coatDk, -0.42, 1.36, 0, coat, { cast: false }); sl.rotation.z = 0.16;
  const sr = add(tbox(0.16, 0.62, 0.15, 2), MAT.coatDk, 0.42, 1.36, 0, coat, { cast: false }); sr.rotation.z = -0.16;
  for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.028, 8, 6), MAT.goldBright, 0, 1.62 - i * 0.2, 0.1, coat, { cast: false });
}
// ================= THE CART =================
let cart, wheels = [], sacks = [];
{
  cart = new THREE.Group(); world.add(cart);
  add(tbox(1.9, 0.16, 1.15, 2), MAT.wood, 0, 0.66, 0, cart, { cast: false });
  add(tbox(1.9, 0.3, 0.07, 2), MAT.woodDk, 0, 0.88, -0.56, cart, { cast: false });
  add(tbox(1.9, 0.3, 0.07, 2), MAT.woodDk, 0, 0.88, 0.56, cart, { cast: false });
  add(tbox(0.07, 0.3, 1.15, 2), MAT.woodDk, -0.93, 0.88, 0, cart, { cast: false });
  for (const wz of [-0.64, 0.64]) for (const wx of [-0.55, 0.55]) {
    const wg = new THREE.Group(); wg.position.set(wx, 0.44, wz); cart.add(wg);
    const w = add(new THREE.CylinderGeometry(0.44, 0.44, 0.09, 14), MAT.woodDk, 0, 0, 0, wg, { cast: false }); w.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 8), MAT.steelDk, 0, 0, 0, wg, { cast: false }).rotation.x = Math.PI / 2;
    wheels.push(wg);
  }
  for (const hz of [-0.3, 0.3]) { const h = add(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 7), MAT.woodDk, -1.3, 0.6, hz, cart, { cast: false }); h.rotation.z = Math.PI / 2 - 0.18; }
  for (let i = 0; i < 10; i++) {
    const s = add(new THREE.SphereGeometry(0.21, 9, 7), i % 2 ? MAT.sack : MAT.sackDk, -0.72 + (i % 5) * 0.36, 0.86 + Math.floor(i / 5) * 0.3, i < 5 ? -0.26 : 0.26, cart, { cast: false });
    s.scale.y = 0.78; sacks.push(s);
  }
}
// ================= LANDLORD'S HALL (x=+32) =================
let coinGlint, coinMesh;
{
  const g = world, hx = 32;
  flat(add(new THREE.CircleGeometry(7, 20), MAT.dirt, hx, -0.006, -2, g, { cast: false }));
  add(tbox(11, 7.2, 0.6, 2), MAT.stone, hx, 3.6, -7.4, g, { cast: false });
  add(tbox(11.8, 0.5, 1.1, 2), MAT.stoneDk, hx, 7.4, -7.4, g, { cast: false });
  add(tbox(2.3, 3.7, 0.18, 2), MAT.dark, hx, 1.85, -7.05, g, { cast: false });
  for (const cx of [hx - 3.4, hx + 3.4]) add(new THREE.CylinderGeometry(0.32, 0.38, 6.4, 10), MAT.stoneDk, cx, 3.2, -6.6, g, { cast: false });
  add(tbox(4.6, 0.22, 1.4, 2), MAT.stone, hx, 0.11, -6.4, g, { cast: false });
  // THE ONE COIN lives in the boy's card hand (prop 'coin') — a floating 3D
  // coin doubled the read, so there is deliberately no coin mesh here.
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardTreasury = textBoard(["THE KING'S TREASURY"], 3.0, 0.85, '#4a2c14', '#ffd76a'); boardTreasury.position.set(0, 4.3, -3.12); world.add(boardTreasury);
const boardBags = textBoard(['TEN BAGS OF GOLD'], 2.4, 0.75, '#2e5a2e', '#ffe9a8'); boardBags.position.set(0, 3.2, -3.12); world.add(boardBags);
const boardLetter = letterBoard(['SEND TEN BAGS OF GOLD', 'TO THE MINT — TONIGHT!'], 1.45, 0.82); boardLetter.position.set(0.88, 1.38, 1.3); boardLetter.rotation.y = 0.12; world.add(boardLetter);

// ---------- FX: haze ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.35, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(-16, 1.6, -5, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
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
  setB(boardTreasury, Ws.boardTreasury || 0); setB(boardLetter, Ws.boardLetter || 0); setB(boardBags, Ws.boardBags || 0);
  doorL.rotation.y = -(Ws.gateOpen || 0) * 1.8; doorR.rotation.y = (Ws.gateOpen || 0) * 1.8;
  keyL.rotation.z = (Ws.keyTurn || 0) * 2.2; keyR.rotation.z = -(Ws.keyTurn || 0) * 2.2;
  shackle.rotation.z = (Ws.lockOpen || 0) * 0.85; shackle.position.y = 0.05 + (Ws.lockOpen || 0) * 0.05;
  MAT.goldGlow.opacity = (Ws.gateOpen || 0) * 0.5;
  gateGlint.material.opacity = (1 - (Ws.lockOpen || 0)) * 0.34;
  ringGlint.material.opacity = (Ws.goldK || 0) * 0.6;
  const cp = cartPosAt(f);
  cart.position.set(cp[0], 0, cp[2]);
  wheels.forEach((w) => { w.rotation.z = -(Ws.cartD || 0) / 0.44; });
  sacks.forEach((s, i) => { const k = Math.max(0, Math.min(1, (Ws.bagK || 0) - i)); s.visible = k > 0.02; s.scale.set(k, k * 0.78, k); });
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
