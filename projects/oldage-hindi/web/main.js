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

// ---------- the set: stables (west) — court (centre) — gate (east) — food stall (far east) ----------
const MAT = {
  grass: texM(P.grass(61), 16, 16, '#7fae4c'),
  dirt: texM(P.dirt(35), 8, 8, '#b49a72'),
  stone: texM(P.stone(64, 40, 5, 58), 3, 2, '#c9c2b2'), stoneDk: texM(P.stone(65, 40, 6, 46), 3, 2, '#a89f8d'),
  wood: texM(P.beam(66, [26, 45, 32]), 1, 2), woodDk: texM(P.beam(67, [24, 40, 22]), 1, 2),
  plank: texM(P.planks(68, 0), 2, 1),
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }), leaf2: toon({ color: '#5d8142' }),
  gold: toon({ color: '#d9a441' }), goldDk: toon({ color: '#a87c24' }),
  plaster: texM(P.plaster(33, 36), 2, 2),
  dark: toon({ color: '#33302c' }), iron: toon({ color: '#4a4d55' }),
  carpet: toon({ color: '#8c2f2a' }), cushion: toon({ color: '#a5232e' }),
  hay: toon({ color: '#c9a44e' }), horse: toon({ color: '#6a4a2e' }), horseDk: toon({ color: '#4a3018' }),
  steel: toon({ color: '#b9c1c9' }), rope: toon({ color: '#b49a72' }),
  poison: toon({ color: '#3f7a3a' }),
};
const world = new THREE.Group(); scene.add(world);
const STAND_X = -2.7, STAND_Z = -2.5, GATE_X = 12.5;
let doorL, doorR;
{
  const g = world;
  const gr = flat(add(new THREE.PlaneGeometry(300, 300), MAT.grass, 10, -0.03, 0, g, { cast: false })); gr.receiveShadow = true;
  // stone courtyard (court + gate apron) and the east road to the stall
  flat(add(new THREE.PlaneGeometry(30, 17), MAT.stone, 4, -0.012, -1, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(26, 3.4), MAT.dirt, 16, -0.014, 0.4, g, { cast: false }));
  flat(add(new THREE.CircleGeometry(5.5, 20), MAT.dirt, -14.5, -0.01, 0.5, g, { cast: false }));

  // ================= THE ROYAL STABLES (west, thief held at x≈-14) =================
  add(tbox(8.4, 3.4, 0.3, 2), MAT.plank, -15.6, 1.7, -3.6, g, { cast: false });
  const sRoof = add(tbox(9.2, 0.16, 4.6, 2), MAT.thatch, -15.6, 3.62, -2.2, g, { cast: false }); sRoof.rotation.x = 0.1;
  for (const px of [-19.2, -12.0]) for (const pz of [-3.3, -1.2]) add(new THREE.CylinderGeometry(0.11, 0.13, 3.5, 8), MAT.woodDk, px, 1.75, pz, g, { cast: false });
  // fence rails in front of the stalls (the thief is held just outside them)
  for (const ry of [0.65, 1.25]) add(tbox(8.4, 0.12, 0.1, 2), MAT.wood, -15.6, ry, -1.15, g, { cast: false });
  for (const px of [-19.4, -17.5, -11.8]) add(new THREE.CylinderGeometry(0.07, 0.09, 1.5, 7), MAT.woodDk, px, 0.75, -1.15, g, { cast: false });
  // hay bales + manger
  for (const [hx, hz, hr] of [[-18.6, -2.7, 0], [-17.4, -2.75, 0.7], [-18.0, -2.7, 0.3]]) {
    const bale = add(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 12), MAT.hay, hx, 0.55, hz, g, { cast: false });
    bale.rotation.z = Math.PI / 2; bale.rotation.y = hr;
  }
  add(tbox(1.8, 0.5, 0.6, 2), MAT.woodDk, -13.2, 0.45, -2.9, g, { cast: false });
  add(tbox(1.7, 0.14, 0.5, 1), MAT.hay, -13.2, 0.74, -2.9, g, { cast: false });
  // the horse in its stall, head over the rail
  const horse = new THREE.Group(); horse.position.set(-16.4, 0, -2.85); horse.rotation.y = 0.5; g.add(horse);
  add(tbox(2.0, 1.0, 0.68, 2), MAT.horse, 0, 1.5, 0, horse, { cast: false });
  const neck = add(tbox(0.42, 1.05, 0.4, 1), MAT.horse, 1.12, 1.95, 0, horse, { cast: false }); neck.rotation.z = -0.6;
  add(tbox(0.78, 0.34, 0.34, 1), MAT.horseDk, 1.52, 2.32, 0, horse, { cast: false });
  for (const sx of [-0.16, 0.16]) { const ear = add(new THREE.ConeGeometry(0.07, 0.24, 6), MAT.horseDk, 1.3, 2.56, sx, horse, { cast: false }); }
  add(tbox(0.5, 0.16, 0.4, 1), MAT.horseDk, 1.05, 2.42, 0, horse, { cast: false }); // mane
  for (const [lx, lz] of [[-0.8, -0.22], [-0.8, 0.22], [0.8, -0.22], [0.8, 0.22]]) add(new THREE.CylinderGeometry(0.075, 0.06, 1.05, 7), MAT.horse, lx, 0.52, lz, horse, { cast: false });
  const tail = add(new THREE.ConeGeometry(0.13, 0.85, 7), MAT.horseDk, -1.15, 1.55, 0, horse, { cast: false }); tail.rotation.z = 0.5;

  // ================= THE COURT (centre; platform top y=0.5, facade z=-6.4) =================
  add(tbox(12.5, 0.5, 7.6, 2), MAT.stoneDk, 0, 0.25, -2.6, g, { cast: false });
  for (let i = 0; i < 3; i++) add(tbox(5.5 - i * 0.8, 0.17, 0.55, 2), MAT.stone, 0, 0.085 + i * 0.17, 1.55 + (2 - i) * 0.28, g, { cast: false });
  flat(add(new THREE.PlaneGeometry(3.4, 6.4), MAT.carpet, 0, 0.505, -1.1, g, { cast: false }));
  add(tbox(13.4, 5.8, 0.5, 2), MAT.plaster, 0, 2.9, -6.4, g, { cast: false });
  add(tbox(14.0, 0.45, 0.9, 2), MAT.stoneDk, 0, 5.95, -6.4, g, { cast: false });
  for (const px of [-5.9, -3.1, 3.1, 5.9]) {
    add(new THREE.CylinderGeometry(0.3, 0.36, 5.6, 10), MAT.stone, px, 2.8, -5.8, g, { cast: false });
    add(tbox(0.85, 0.3, 0.85, 2), MAT.stoneDk, px, 5.65, -5.8, g, { cast: false });
    add(tbox(0.9, 0.3, 0.9, 2), MAT.stoneDk, px, 0.15, -5.8, g, { cast: false });
  }
  for (const sx of [-6.9, 6.9]) add(tbox(1.4, 3.4, 0.5, 2), MAT.stoneDk, sx, 1.7, -4.2, g, { cast: false });
  // canopy over the throne
  add(tbox(4.8, 0.16, 3.2, 2), MAT.cushion, 0, 4.42, -3.9, g, { cast: false });
  add(tbox(5.0, 0.1, 3.4, 1), MAT.goldDk, 0, 4.32, -3.9, g, { cast: false });
  for (const px of [-2.2, 2.2]) add(new THREE.CylinderGeometry(0.07, 0.09, 3.9, 8), MAT.goldDk, px, 2.45, -5.2, g, { cast: false });
  // THE THRONE (the king sits on the platform before its tall back)
  add(tbox(2.0, 2.9, 0.28, 2), MAT.woodDk, 0, 1.95, -4.5, g, { cast: false });
  add(tbox(2.2, 0.22, 0.34, 1), MAT.gold, 0, 3.48, -4.5, g, { cast: false });
  add(tbox(0.22, 2.5, 0.34, 1), MAT.gold, -0.95, 1.95, -4.5, g, { cast: false });
  add(tbox(0.22, 2.5, 0.34, 1), MAT.gold, 0.95, 1.95, -4.5, g, { cast: false });
  for (const sx of [-0.95, 0, 0.95]) add(new THREE.SphereGeometry(0.13, 10, 8), MAT.gold, sx, 3.68, -4.5, g, { cast: false });
  add(tbox(1.7, 0.2, 1.2, 1), MAT.cushion, 0, 0.58, -3.62, g, { cast: false });
  for (const sx of [-0.95, 0.95]) {
    add(tbox(0.18, 0.5, 1.0, 1), MAT.woodDk, sx, 0.85, -3.8, g, { cast: false });
    add(new THREE.SphereGeometry(0.09, 8, 6), MAT.gold, sx, 1.14, -3.4, g, { cast: false });
  }
  // ============ the choice stand: ज़हर की शीशी, तलवार, फाँसी का फंदा ============
  add(tbox(1.9, 0.09, 0.8, 2), MAT.wood, STAND_X, 1.28, STAND_Z, g, { cast: false });
  for (const [lx, lz] of [[-0.85, -0.3], [0.85, -0.3], [-0.85, 0.3], [0.85, 0.3]]) add(tbox(0.08, 0.78, 0.08, 1), MAT.woodDk, STAND_X + lx, 0.89, STAND_Z + lz, g, { cast: false });
  // poison vial (green glass, corked)
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 10), MAT.poison, -3.2, 1.48, STAND_Z, g, { cast: false });
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 8), MAT.poison, -3.2, 1.68, STAND_Z, g, { cast: false });
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8), MAT.hay, -3.2, 1.75, STAND_Z, g, { cast: false });
  // the sword, point-up in its rest
  const sw = new THREE.Group(); sw.position.set(-2.7, 1.32, STAND_Z); sw.rotation.z = 0.16; g.add(sw);
  add(tbox(0.075, 0.85, 0.02, 1), MAT.steel, 0, 0.62, 0, sw, { cast: false });
  add(tbox(0.34, 0.05, 0.06, 1), MAT.gold, 0, 0.18, 0, sw, { cast: false });
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), MAT.woodDk, 0, 0.06, 0, sw, { cast: false });
  // the noose on its little gallows post
  add(new THREE.CylinderGeometry(0.05, 0.06, 1.15, 8), MAT.woodDk, -2.18, 1.9, STAND_Z, g, { cast: false });
  add(tbox(0.55, 0.07, 0.07, 1), MAT.woodDk, -2.32, 2.45, STAND_Z, g, { cast: false });
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), MAT.rope, -2.48, 2.28, STAND_Z, g, { cast: false });
  add(new THREE.TorusGeometry(0.15, 0.032, 8, 18), MAT.rope, -2.48, 1.98, STAND_Z, g, { cast: false });

  // ================= THE PALACE GATE (east, x=12.5; doors open for the walk-out) =================
  for (const pz of [-2.3, 2.1]) {
    add(tbox(1.0, 4.8, 1.0, 2), MAT.stoneDk, GATE_X, 2.4, pz, g, { cast: false });
    add(tbox(1.3, 0.35, 1.3, 2), MAT.stone, GATE_X, 4.95, pz, g, { cast: false });
    add(new THREE.ConeGeometry(0.85, 0.8, 4), MAT.thatch, GATE_X, 5.5, pz, g, { cast: false }).rotation.y = Math.PI / 4;
  }
  add(tbox(1.1, 0.8, 5.6, 2), MAT.stoneDk, GATE_X, 4.6, -0.1, g, { cast: false });
  const mkGateDoor = (side) => { // side -1: hinge at z=-1.8, panel extends +z; +1 mirrored
    const grp = new THREE.Group(); grp.position.set(GATE_X, 0, -1.8 * side); g.add(grp);
    add(tbox(0.14, 3.4, 1.8, 2), MAT.woodDk, 0, 1.7, 0.9 * side, grp);
    for (const by of [0.7, 1.7, 2.7]) add(tbox(0.06, 0.16, 1.76, 1), MAT.goldDk, 0.1, by, 0.9 * side, grp, { cast: false });
    add(new THREE.TorusGeometry(0.16, 0.035, 8, 18), MAT.gold, 0.14, 1.55, 1.55 * side, grp, { cast: false });
    return grp;
  };
  doorL = mkGateDoor(-1); doorR = mkGateDoor(1);

  // ================= THE FOOD STALL (far east — the hook) =================
  const sg = new THREE.Group(); sg.position.set(24.3, 0, -2.0); g.add(sg);
  add(tbox(2.7, 1.0, 0.95, 2), MAT.wood, 0, 0.5, 0.45, sg, { cast: false }); // counter (front z≈+0.45 local)
  add(tbox(2.8, 0.09, 1.05, 1), MAT.woodDk, 0, 1.04, 0.45, sg, { cast: false });
  for (const [px, pz] of [[-1.5, -0.6], [1.5, -0.6], [-1.5, 1.1], [1.5, 1.1]]) add(new THREE.CylinderGeometry(0.06, 0.08, 2.75, 7), MAT.woodDk, px, 1.37, pz, sg, { cast: false });
  const sCan = add(tbox(3.5, 0.08, 2.4, 2), MAT.thatch, 0, 2.82, 0.25, sg, { cast: false }); sCan.rotation.x = -0.05;
  // the great pot on the counter — steam rises from it in the hook shot
  add(new THREE.CylinderGeometry(0.36, 0.29, 0.42, 12), MAT.iron, -0.35, 1.29, 0.45, sg, { cast: false });
  add(new THREE.TorusGeometry(0.3, 0.035, 8, 18), MAT.iron, -0.35, 1.5, 0.45, sg, { cast: false }).rotation.x = Math.PI / 2;
  add(tbox(0.5, 0.05, 0.05, 1), MAT.woodDk, -0.1, 1.56, 0.45, sg, { cast: false }).rotation.z = 0.5; // ladle handle
  for (const [jx, js] of [[0.55, 0.3], [0.95, 0.22], [1.3, 0.34]]) add(new THREE.CylinderGeometry(js * 0.7, js, js * 1.6, 9), MAT.hay, jx, 1.08 + js * 0.8, 0.45, sg, { cast: false });
  for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.09, 8, 6), MAT.gold, 0.35 + i * 0.17, 1.13, 0.62, sg, { cast: false }); // round sweets/fruit row
  // sacks + a bench beside the stall
  const sk = add(new THREE.SphereGeometry(0.42, 10, 8), MAT.hay, 22.6, 0.3, -1.2, g, { cast: false }); sk.scale.y = 0.75;
  add(tbox(1.5, 0.09, 0.45, 1), MAT.wood, 22.4, 0.42, -0.5, g, { cast: false });
  for (const bx of [21.8, 23.0]) add(tbox(0.09, 0.42, 0.4, 1), MAT.woodDk, bx, 0.21, -0.5, g, { cast: false });
  // trees
  for (const [tx, tz, ts] of [[-9.5, -6.5, 2.4], [8.6, -7.6, 2.7], [19.2, -6.2, 2.2], [28.6, -6.8, 2.5], [-21.5, -5.5, 2.3]]) {
    add(new THREE.CylinderGeometry(0.3, 0.46, 3.0, 8), MAT.woodDk, tx, 1.5, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(ts, 10, 8), MAT.leaf, tx, 3.6 + ts * 0.4, tz, g, { cast: false }); can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
function postSign(lines, w, h, bg, fg, gx, gy, gz, ry, cy = 1.5) {
  const g = new THREE.Group(); g.position.set(gx, gy, gz); g.rotation.y = ry; world.add(g);
  add(new THREE.CylinderGeometry(0.05, 0.07, Math.max(1.2, cy + h / 2), 6), MAT.woodDk, 0, (cy + h / 2) / 2, -0.06, g, { cast: false });
  const b = textBoard(lines, w, h, bg, fg); b.position.set(0, cy, 0.05); g.add(b);
  return b;
}
// the decree hangs as a royal banner from the canopy's front edge — the wall
// spot behind the throne was occluded by the canopy slab from low angles
const boardDecree = (() => {
  const grp = new THREE.Group(); grp.position.set(0.45, 0, -2.28); world.add(grp);
  for (const cx of [-0.85, 0.85]) add(new THREE.CylinderGeometry(0.022, 0.022, 1.03, 6), MAT.rope, cx, 3.85, 0, grp, { cast: false });
  add(tbox(2.35, 0.07, 0.07, 1), MAT.woodDk, 0, 3.36, 0, grp, { cast: false });
  const b = textBoard(['अपनी मौत ख़ुद चुन लो'], 2.2, 0.7, '#4a2c14', '#ffd76a'); b.position.set(0, 2.98, 0); grp.add(b);
  return b;
})();
const boardPunch = postSign(['बुढ़ापा!'], 1.35, 0.66, '#5a1f1f', '#ffe9a8', -0.2, 0.5, -1.35, 0, 2.02);
const boardHook = postSign(['खुशबू का बिल?'], 1.9, 0.75, '#2e5a2e', '#ffe9a8', 27.1, 0, -2.7, 0.15, 1.9);

// ---------- FX: court haze, gate dust, pot steam, clouds ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.8, -3, { rate: 0.25, color: 0xffe2b0, opacity: 0.045, scale: 2.4, grow: 1.3, life: 2.8, vy: 0.1, wind: -0.4 });
const dustEmit = smoke.addEmitter(12.5, 0.7, -0.2, { rate: 0.1, color: 0xe8d9b0, opacity: 0.16, scale: 0.5, grow: 1.6, life: 1.1, vy: 0.5, wind: 0.3 });
const steamEmit = smoke.addEmitter(23.95, 1.6, -1.55, { rate: 0, color: 0xffffff, opacity: 0.2, scale: 0.4, grow: 1.8, life: 1.4, vy: 0.65, wind: 0.15 });
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
    hazeEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate; steamEmit.rate = pr.steamRate || 0;
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
  setB(boardDecree, Ws.boardDecree || 0); setB(boardPunch, Ws.boardPunch || 0); setB(boardHook, Ws.boardHook || 0);
  doorL.rotation.y = (Ws.gateOpen || 0) * 1.8;
  doorR.rotation.y = -(Ws.gateOpen || 0) * 1.8;
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
