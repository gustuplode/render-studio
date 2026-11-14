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

// ---------- the set: kebab stall, the qazi's court, a farm (one travelling stage) ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldDk: toon({ color: '#a87c24' }),
  plaster: texM(P.plaster(33, 36), 2, 2), plasterW: texM(P.plaster(34, 48), 2, 2),
  dark: toon({ color: '#33302c' }), iron: toon({ color: '#3c3f45' }),
  sack: toon({ color: '#a8803e' }), cushion: toon({ color: '#7e2434' }),
  carpet: texM(P.weave(21, [350, 48, 30]), 3, 3),
  ember: new THREE.MeshBasicMaterial({ color: 0xff7a26, transparent: true, opacity: 0, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
let emberGlow, grillGlint;
{
  const g = world;
  const gr = flat(add(new THREE.PlaneGeometry(300, 300), MAT.grass, 24, -0.03, 0, g, { cast: false })); gr.receiveShadow = true;
  flat(add(new THREE.CircleGeometry(10, 24), MAT.dirt, 0, -0.012, 1.5, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(70, 3.4), MAT.dirt, 24, -0.014, 2.6, g, { cast: false }));

  // ================= THE KEBAB STALL (origin; back wall z = -2.6) =================
  add(tbox(7.6, 3.6, 0.45, 2), MAT.plaster, -1.1, 1.8, -2.6, g, { cast: false });
  add(tbox(8.4, 0.35, 0.8, 2), MAT.stoneDk, -1.1, 3.75, -2.55, g, { cast: false });
  for (const px of [-4.4, 1.55]) add(new THREE.CylinderGeometry(0.09, 0.11, 3.4, 8), MAT.woodDk, px, 1.7, -0.55, g, { cast: false });
  const canopy = add(tbox(7.6, 0.08, 2.6, 2), MAT.thatch, -1.1, 3.28, -1.35, g, { cast: false }); canopy.rotation.x = 0.16;
  // counter
  add(tbox(5.2, 0.95, 0.85, 2), MAT.wood, -1.0, 0.48, -1.5, g, { cast: false });
  add(tbox(5.5, 0.09, 1.05, 2), MAT.woodDk, -1.0, 1.0, -1.5, g, { cast: false });
  // hanging brass trays + a stack of rotis on the counter (left end)
  for (const [tx, ts] of [[-2.9, 0.34], [-2.15, 0.27]]) {
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 5), MAT.iron, tx, 2.7, -1.15, g, { cast: false });
    const tray = add(new THREE.CylinderGeometry(ts, ts * 1.06, 0.045, 14), MAT.goldDk, tx, 2.26, -1.15, g, { cast: false });
  }
  for (let i = 0; i < 4; i++) { const rt = add(new THREE.CylinderGeometry(0.21, 0.21, 0.022, 12), toon({ color: '#dcb87e' }), -3.15, 1.06 + i * 0.024, -1.5, g, { cast: false }); }
  // the grill: iron box on the counter's right end, coals, skewers resting across
  add(tbox(1.15, 0.3, 0.8, 1), MAT.iron, 0.95, 1.2, -1.5, g, { cast: false });
  add(tbox(1.0, 0.06, 0.65, 1), MAT.dark, 0.95, 1.37, -1.5, g, { cast: false });
  emberGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.6), MAT.ember); emberGlow.rotation.x = -Math.PI / 2; emberGlow.position.set(0.95, 1.41, -1.5); emberGlow.castShadow = false; emberGlow.userData.ndSkip = true; g.add(emberGlow);
  for (let si = 0; si < 3; si++) {
    const sk = new THREE.Group(); sk.position.set(0.62 + si * 0.33, 1.47, -1.5); sk.rotation.z = 0.05; g.add(sk);
    const rod = add(new THREE.CylinderGeometry(0.016, 0.016, 0.95, 6), MAT.iron, 0, 0, 0, sk, { cast: false }); rod.rotation.x = Math.PI / 2;
    for (let ci = 0; ci < 4; ci++) add(tbox(0.15, 0.13, 0.14, 1), toon({ color: ci % 2 ? '#8a4a22' : '#9c5527' }), 0, 0.03, -0.3 + ci * 0.19, sk, { cast: false });
  }
  // crates, sacks, water pot beside the stall; the traveller's flat sitting-stone
  add(tbox(0.8, 0.8, 0.8, 2), MAT.wood, -4.15, 0.4, -0.7, g, { cast: false });
  const sk1 = add(new THREE.SphereGeometry(0.42, 10, 8), MAT.sack, -3.5, 0.3, -0.35, g, { cast: false }); sk1.scale.y = 0.75;
  const pot = add(new THREE.SphereGeometry(0.3, 10, 8), toon({ color: '#8a4a30' }), 1.95, 0.26, -0.9, g, { cast: false }); pot.scale.y = 0.85;
  add(tbox(1.15, 0.16, 0.85, 2), MAT.stone, 1.5, 0.08, 1.05, g, { cast: false });
  // backdrop houses + trees (market street)
  for (const [hx, hz, ry, sc] of [[-8.6, -4.6, 0.35, 1], [7.6, -4.2, -0.3, 1.15]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; h.scale.setScalar(sc); g.add(h);
    add(tbox(2.6, 1.7, 2.1, 2), MAT.plasterW, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.15, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  add(new THREE.CylinderGeometry(0.3, 0.44, 2.9, 8), MAT.woodDk, 5.4, 1.45, -2.8, g, { cast: false });
  const can1 = add(new THREE.SphereGeometry(2.0, 10, 8), MAT.leaf, 5.4, 3.8, -2.8, g, { cast: false }); can1.scale.y = 0.72; can1.userData.ndSkip = true;

  // ================= THE QAZI'S COURT (x = 26) =================
  const CX = 26;
  add(tbox(10.5, 0.5, 7.6, 2), MAT.stone, CX, 0.25, -0.4, g, { cast: false });
  for (let si = 0; si < 3; si++) add(tbox(3.4 - si * 0.7, 0.17, 0.9, 2), MAT.stone, CX, 0.085 + si * 0.17, 3.9 - si * 0.55, g, { cast: false });
  flat(add(new THREE.PlaneGeometry(8.6, 5.6), MAT.carpet, CX, 0.515, -0.5, g, { cast: false }));
  add(tbox(10.5, 4.6, 0.45, 2), MAT.plasterW, CX, 2.8, -3.6, g, { cast: false });
  add(tbox(11.2, 0.4, 0.85, 2), MAT.stoneDk, CX, 5.25, -3.55, g, { cast: false });
  for (const px of [CX - 4.6, CX + 4.6]) {
    add(new THREE.CylinderGeometry(0.3, 0.36, 4.6, 10), MAT.stone, px, 2.8, -3.3, g, { cast: false });
    add(tbox(0.85, 0.3, 0.85, 2), MAT.stoneDk, px, 5.2, -3.3, g, { cast: false });
  }
  const courtRoof = add(tbox(11.4, 0.09, 4.6, 2), MAT.thatch, CX, 5.6, -1.6, g, { cast: false }); courtRoof.rotation.x = 0.1;
  for (const px of [CX - 5.2, CX + 5.2]) add(new THREE.CylinderGeometry(0.08, 0.1, 5.6, 7), MAT.woodDk, px, 2.8, 0.55, g, { cast: false });
  // the takht (raised seat) + cushion + bolster
  add(tbox(2.5, 0.55, 1.5, 2), MAT.wood, CX, 0.78, -1.7, g, { cast: false });
  add(tbox(2.3, 0.18, 1.3, 1), MAT.cushion, CX, 1.14, -1.7, g, { cast: false });
  const bol = add(new THREE.CylinderGeometry(0.17, 0.17, 2.1, 10), MAT.cushion, CX, 1.32, -2.28, g, { cast: false }); bol.rotation.z = Math.PI / 2;
  // side table with the qazi's book + inkpot
  add(tbox(0.8, 0.06, 0.55, 1), MAT.woodDk, CX - 1.85, 0.86, -1.6, g, { cast: false });
  for (const [lx, lz] of [[CX - 2.15, -1.8], [CX - 1.55, -1.8], [CX - 2.15, -1.4], [CX - 1.55, -1.4]]) add(tbox(0.06, 0.86, 0.06, 1), MAT.woodDk, lx, 0.43, lz, g, { cast: false });
  const book = add(tbox(0.5, 0.07, 0.36, 1), toon({ color: '#5e3012' }), CX - 1.85, 0.93, -1.6, g, { cast: false }); book.rotation.y = 0.3;
  add(new THREE.CylinderGeometry(0.055, 0.07, 0.1, 8), MAT.dark, CX - 1.5, 0.94, -1.45, g, { cast: false });
  // court-side tree
  add(new THREE.CylinderGeometry(0.34, 0.5, 3.4, 9), MAT.woodDk, CX + 7.6, 1.7, -2.6, g, { cast: false });
  const can2 = add(new THREE.SphereGeometry(2.3, 10, 8), MAT.leaf2, CX + 7.6, 4.2, -2.6, g, { cast: false }); can2.scale.y = 0.72; can2.userData.ndSkip = true;

  // ================= THE FARM + HORSE PEN (hook, x = 48) =================
  const FX0 = 48;
  const fh = new THREE.Group(); fh.position.set(FX0 + 4.6, 0, -4.6); fh.rotation.y = -0.25; g.add(fh);
  add(tbox(3.4, 2.1, 2.6, 2), MAT.plaster, 0, 1.05, 0, fh, { cast: false });
  add(new THREE.ConeGeometry(2.9, 1.5, 4), MAT.thatch, 0, 2.85, 0, fh, { cast: false }).rotation.y = Math.PI / 4;
  add(tbox(0.85, 1.35, 0.1, 1), MAT.woodDk, -0.6, 0.68, 1.32, fh, { cast: false });
  // pen: posts + two rails, x 43.2..49.4, z -3.6..-0.7
  const pen = new THREE.Group(); g.add(pen);
  const railRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 1.55));
    for (let i = 0; i <= n; i++) add(new THREE.CylinderGeometry(0.055, 0.07, 1.15, 7), MAT.woodDk, x0 + (x1 - x0) * i / n, 0.57, z0 + (z1 - z0) * i / n, pen, { cast: false });
    for (const ry of [0.55, 0.95]) {
      const r = add(tbox(len, 0.07, 0.07, 1), MAT.wood, (x0 + x1) / 2, ry, (z0 + z1) / 2, pen, { cast: false });
      r.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    }
  };
  railRun(43.2, -3.6, 49.4, -3.6); railRun(43.2, -0.7, 49.4, -0.7); railRun(43.2, -3.6, 43.2, -0.7); railRun(49.4, -3.6, 49.4, -0.7);
  flat(add(new THREE.CircleGeometry(4.6, 20), MAT.dirt, 46.3, -0.008, -2.1, g, { cast: false }));
  // simple coded horses: body, neck, head, ears, legs, tail — real parts, inked by the ND pass
  const horseCols = ['#7a4a2a', '#4a3320', '#8d8d84', '#5e3a1e', '#a0764a', '#3a2c20', '#96684a'];
  const mkHorse = (x, z, ry, ci, headDip = 0) => {
    const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = ry; g.add(h);
    const M = toon({ color: horseCols[ci % horseCols.length] }), Md = toon({ color: '#2e2015' });
    const body = add(new THREE.CylinderGeometry(0.34, 0.36, 1.25, 10), M, 0, 1.12, 0, h); body.rotation.z = Math.PI / 2;
    add(new THREE.SphereGeometry(0.35, 10, 8), M, -0.62, 1.12, 0, h, { cast: false });
    add(new THREE.SphereGeometry(0.33, 10, 8), M, 0.62, 1.12, 0, h, { cast: false });
    const neck = add(tbox(0.3, 0.62, 0.26, 1), M, 0.78, 1.42, 0, h, { cast: false }); neck.rotation.z = -0.6 + headDip * 0.4;
    const head = add(tbox(0.52, 0.24, 0.24, 1), M, 1.06, 1.62 - headDip * 0.22, 0, h, { cast: false }); head.rotation.z = -0.25 + headDip * 0.5;
    for (const es of [-0.08, 0.08]) { const ear = add(new THREE.ConeGeometry(0.05, 0.16, 6), Md, 0.88, 1.82 - headDip * 0.2, es, h, { cast: false }); }
    const mane = add(tbox(0.1, 0.6, 0.08, 1), Md, 0.68, 1.5, 0, h, { cast: false }); mane.rotation.z = -0.6 + headDip * 0.4;
    for (const [lx, lz] of [[-0.45, -0.16], [-0.45, 0.16], [0.45, -0.16], [0.45, 0.16]]) add(new THREE.CylinderGeometry(0.055, 0.045, 0.95, 7), M, lx, 0.48, lz, h, { cast: false });
    const tail = add(new THREE.CylinderGeometry(0.05, 0.02, 0.62, 6), Md, -0.98, 1.05, 0, h, { cast: false }); tail.rotation.z = 0.5;
    return h;
  };
  mkHorse(44.6, -2.6, 0.5, 0); mkHorse(46.2, -3.0, -0.4, 1, 1); mkHorse(47.8, -2.4, 0.9, 2);
  mkHorse(45.4, -1.5, 2.6, 3); mkHorse(47.0, -1.4, -2.8, 4); mkHorse(48.6, -3.1, 0.2, 5, 1);
  mkHorse(44.0, -3.2, 1.4, 6);
  mkHorse(42.0, 0.6, 0.9, 3); // the qazi's OWN horse, standing by the pen gate — the 18th
  // hay pile + water trough in the pen
  const hay = add(new THREE.ConeGeometry(0.85, 0.8, 10), toon({ color: '#c9a44a' }), 48.9, 0.4, -1.3, g, { cast: false });
  add(tbox(1.3, 0.3, 0.5, 1), MAT.woodDk, 44.2, 0.15, -0.95, g, { cast: false });
}
grillGlint = FX.glint(0.5); grillGlint.position.set(0.95, 1.62, -1.35); grillGlint.userData.ndSkip = true; world.add(grillGlint);
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
function postSign(lines, w, h, bg, fg, gx, gz, ry, cy = 1.5) {
  const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = ry; world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, Math.max(1.2, cy + h / 2), 6), MAT.woodDk, 0, (cy + h / 2) / 2, -0.06, g, { cast: false });
  const b = textBoard(lines, w, h, bg, fg); b.position.set(0, cy, 0.05); g.add(b);
  return b;
}
const boardStall = postSign(['ताज़ा कबाब'], 2.4, 0.72, '#5a2e16', '#ffd76a', 2.75, -0.6, -0.15, 2.3);
const boardVerdict = postSign(['खुशबू की कीमत'], 3.4, 0.95, '#274435', '#ffe9a8', 26, -3.15, 0, 3.35);
const boardHook = postSign(['सत्रह घोड़े?'], 2.4, 0.8, '#4a2c14', '#ffd76a', 50.3, -1.7, -0.3, 2.1);

// ---------- FX: grill smoke, court dust, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const grillEmit = smoke.addEmitter(0.95, 1.7, -1.5, { rate: 0.5, color: 0xd8cfc0, opacity: 0.13, scale: 0.55, grow: 1.7, life: 1.6, vy: 0.75, wind: 0.35 });
const hazeEmit = smoke.addEmitter(0, 2.6, -2, { rate: 0.2, color: 0xffe2b0, opacity: 0.04, scale: 2.4, grow: 1.3, life: 2.8, vy: 0.1, wind: -0.4 });
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
    grillEmit.rate = pr.grillRate; hazeEmit.rate = pr.smokeRate;
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
  setB(boardStall, Ws.boardStall || 0); setB(boardVerdict, Ws.boardVerdict || 0); setB(boardHook, Ws.boardHook || 0);
  MAT.ember.opacity = (Ws.emberK || 0) * 0.85;
  grillGlint.material.opacity = (Ws.emberK || 0) * 0.55;
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
