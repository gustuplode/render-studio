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
  dark: toon({ color: '#33302c' }),
  carpet: toon({ color: '#8c2432' }), cushion: toon({ color: '#a32436' }),
  horse: toon({ color: '#7a4a2a' }), horseDk: toon({ color: '#54331d' }),
  hay: toon({ color: '#d9b84f' }),
  bottle: toon({ color: '#2e6e46' }),
  rope: toon({ color: '#b49a72' }),
  awnR: toon({ color: '#a33b32' }), awnW: toon({ color: '#efe6d0' }),
  meat: toon({ color: '#9c4a26' }),
  glowWarm: new THREE.MeshBasicMaterial({ color: 0xffc37a, transparent: true, opacity: 0, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(340, 240), MAT.grass, 8, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.PlaneGeometry(76, 7), MAT.dirt, 8, -0.012, 3.6, g, { cast: false }));       // the road
  flat(add(new THREE.PlaneGeometry(19, 9), MAT.stone, 0, -0.006, 0.6, g, { cast: false }));       // court floor
  flat(add(new THREE.CircleGeometry(6.5, 20), MAT.dirt, -16, -0.008, -0.6, g, { cast: false }));  // stable yard
  flat(add(new THREE.CircleGeometry(7.5, 20), MAT.dirt, 16, -0.008, 0.4, g, { cast: false }));    // palace forecourt
  flat(add(new THREE.CircleGeometry(6.5, 20), MAT.dirt, 32, -0.008, 0.2, g, { cast: false }));    // cookshop patch
  // distant huts + trees (depth for the cross-world flights)
  for (const [hx, hz, ry] of [[-7, -13, 0.2], [8, -14, -0.3], [24, -12, 0.4], [38, -13, -0.2]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.6, 1.7, 2.2, 2), MAT.stone, 0, 0.85, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.2, 1.2, 4), MAT.thatch, 0, 2.3, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-11, -9, 1], [12.5, -10, 1.2], [23, -9, 0.9], [36, -9.5, 1.1]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ================= ROYAL STABLES (x=-16) =================
{
  const g = world, sx = -16;
  add(tbox(11, 3.6, 0.35, 2), MAT.woodDk, sx, 1.8, -4.6, g, { cast: false });                    // back wall
  add(tbox(11.6, 0.3, 5.6, 2), MAT.thatch, sx, 3.75, -2.2, g, { cast: false });                  // roof slab
  for (const px of [-5.2, 5.2]) add(tbox(0.35, 3.6, 4.6, 2), MAT.woodDk, sx + px, 1.8, -2.4, g, { cast: false });
  // three stalls: dividers + half-doors
  for (const dx of [-3.4, -1.15, 1.15, 3.4]) add(tbox(0.14, 2.3, 2.6, 2), MAT.wood, sx + dx, 1.15, -3.3, g, { cast: false });
  for (const dx of [-2.28, 0, 2.28]) add(tbox(2.0, 1.12, 0.1, 2), MAT.wood, sx + dx, 0.56, -2.05, g, { cast: false });
  // THE HORSE — head and neck over the middle stall door
  const horse = new THREE.Group(); horse.position.set(sx - 2.2, 0, -3.1); g.add(horse);
  const neck = add(new THREE.CylinderGeometry(0.21, 0.3, 1.05, 9), MAT.horse, 0, 1.35, 0.1, horse, { cast: false }); neck.rotation.x = 0.5;
  const head = add(box(0.34, 0.42, 0.78), MAT.horse, 0, 1.86, 0.52, horse, { cast: false }); head.rotation.x = 0.35;
  const muzzle = add(box(0.27, 0.3, 0.34), MAT.horseDk, 0, 1.7, 0.88, horse, { cast: false }); muzzle.rotation.x = 0.35;
  for (const ex of [-0.12, 0.12]) { const ear = add(new THREE.ConeGeometry(0.07, 0.24, 6), MAT.horseDk, ex, 2.14, 0.3, horse, { cast: false }); ear.rotation.x = -0.2; }
  const mane = add(box(0.1, 0.85, 0.3), MAT.horseDk, 0, 1.62, -0.12, horse, { cast: false }); mane.rotation.x = 0.5;
  add(box(0.36, 0.07, 0.1), MAT.steelDk, 0, 1.94, 0.42, horse, { cast: false });                 // bridle band
  for (const ex of [-0.09, 0.09]) add(new THREE.SphereGeometry(0.032, 8, 6), MAT.horseDk, ex, 1.99, 0.93, horse, { cast: false });  // eyes
  // hay bales + sacks + a lantern
  for (const [hx, hz, ry] of [[-3.6, -1.2, 0.3], [-3.1, -1.15, 1.1], [3.8, -1.6, 0.7]]) {
    const bale = add(new THREE.CylinderGeometry(0.42, 0.42, 0.85, 10), MAT.hay, sx + hx, 0.42, hz, g, { cast: false });
    bale.rotation.z = Math.PI / 2; bale.rotation.y = ry;
  }
  const sk = add(new THREE.SphereGeometry(0.36, 9, 7), MAT.sack, sx + 3.2, 0.26, -0.7, g, { cast: false }); sk.scale.y = 0.72;
  const lampGlow = softGlow(1.7, 0xffc98a, 0.15); lampGlow.position.set(sx - 3.9, 2.5, -3.9); g.add(lampGlow);
  add(box(0.16, 0.24, 0.16), MAT.steelDk, sx - 3.9, 2.42, -3.9, g, { cast: false });
  // guards' spears planted by the stall row
  for (const px of [-17.95, -14.05]) {
    add(new THREE.CylinderGeometry(0.03, 0.035, 2.7, 7), MAT.woodDk, px, 1.35, -1.15, g, { cast: false });
    add(new THREE.ConeGeometry(0.07, 0.34, 8), MAT.steel, px, 2.85, -1.15, g, { cast: false });
  }
}
// ================= THE ROYAL COURT (x=0, throne z=-2.7) =================
let flameL, flameR;
{
  const g = world;
  // back wall with a DOOR OPENING at x 2.6..4.0 (segments + lintel)
  add(tbox(10.8, 5.2, 0.5, 2), MAT.stoneDk, -2.8, 2.6, -3.45, g, { cast: false });
  add(tbox(7.4, 5.2, 0.5, 2), MAT.stoneDk, 7.7, 2.6, -3.45, g, { cast: false });
  add(tbox(1.5, 2.4, 0.5, 2), MAT.stoneDk, 3.3, 4.0, -3.45, g, { cast: false });
  add(tbox(17.4, 0.45, 0.7, 2), MAT.stone, 0.6, 5.4, -3.45, g, { cast: false });
  for (const px of [-6.3, 6.9]) {   // wall pillars
    add(new THREE.CylinderGeometry(0.42, 0.5, 5.2, 10), MAT.stone, px, 2.6, -3.3, g, { cast: false });
    add(box(1.1, 0.3, 1.1), MAT.stoneDk, px, 5.35, -3.3, g, { cast: false });
  }
  // daylight + road through the door (the 'kept' view)
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.9), new THREE.MeshBasicMaterial({ color: 0xffe9bb, fog: true }));
  doorGlow.position.set(3.3, 1.45, -5.4); doorGlow.userData.ndSkip = true; g.add(doorGlow);
  flat(add(new THREE.PlaneGeometry(1.6, 6), MAT.dirt, 3.3, -0.004, -6.4, g, { cast: false }));
  // red carpet: door of the hall to the throne steps
  flat(add(new THREE.PlaneGeometry(1.7, 6.4), MAT.carpet, 0, -0.002, 0.6, g, { cast: false }));
  // throne platform + steps
  add(tbox(3.6, 0.3, 2.2, 2), MAT.stone, 0, 0.15, -2.55, g, { cast: false });
  add(tbox(2.6, 0.16, 0.6, 2), MAT.stoneDk, 0, 0.08, -1.25, g, { cast: false });
  // THE THRONE — seat top at y=0.62, tall back, gold finials, red cushion
  add(tbox(1.5, 0.2, 0.85, 2), MAT.woodDk, 0, 0.52, -2.7, g, { cast: false });
  add(box(1.3, 0.1, 0.7), MAT.cushion, 0, 0.6, -2.7, g, { cast: false });
  add(tbox(1.5, 2.1, 0.18, 2), MAT.woodDk, 0, 1.6, -3.08, g, { cast: false });
  add(box(1.14, 1.5, 0.08), MAT.cushion, 0, 1.75, -2.97, g, { cast: false });
  for (const fx of [-0.68, 0.68]) add(new THREE.SphereGeometry(0.11, 9, 7), MAT.goldBright, fx, 2.78, -3.08, g, { cast: false });
  add(new THREE.ConeGeometry(0.13, 0.3, 8), MAT.gold, 0, 2.85, -3.08, g, { cast: false });
  add(box(1.7, 0.14, 0.5), MAT.stoneDk, 0, 0.5, -1.95, g, { cast: false });   // footstep (king's feet rest here)
  // banners on the wall
  for (const bx of [-3.6, 5.0]) {
    add(box(0.85, 1.7, 0.06), MAT.carpet, bx, 3.1, -3.16, g, { cast: false });
    add(box(0.85, 0.12, 0.07), MAT.gold, bx, 3.98, -3.16, g, { cast: false });
    add(new THREE.SphereGeometry(0.07, 8, 6), MAT.goldBright, bx, 2.2, -3.16, g, { cast: false });
  }
  // braziers flanking the throne
  for (const bx of [-2.9, 2.9]) {
    add(new THREE.CylinderGeometry(0.3, 0.16, 0.75, 9), MAT.steelDk, bx, 0.38, -2.9, g, { cast: false });
    add(new THREE.CylinderGeometry(0.42, 0.3, 0.22, 9), MAT.steel, bx, 0.85, -2.9, g, { cast: false });
    const fl = add(new THREE.ConeGeometry(0.2, 0.5, 8), MAT.glowWarm, bx, 1.2, -2.9, g, { cast: false });
    fl.userData.ndSkip = true;
    if (bx < 0) flameL = fl; else flameR = fl;
    const gl = softGlow(1.6, 0xffb763, 0.13); gl.position.set(bx, 1.25, -2.9); g.add(gl);
  }
  // THE DEATH-PROPS TABLE (C6: poison, sword, hanging — anything)
  add(tbox(1.15, 0.09, 0.6, 2), MAT.wood, 1.6, 0.76, -0.9, g, { cast: false });
  for (const [lx, lz] of [[-0.48, -0.22], [0.48, -0.22], [-0.48, 0.22], [0.48, 0.22]]) add(box(0.09, 0.74, 0.09), MAT.woodDk, 1.6 + lx, 0.37, -0.9 + lz, g, { cast: false });
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.24, 9), MAT.bottle, 1.28, 0.93, -0.95, g, { cast: false });   // poison bottle
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 8), MAT.steelDk, 1.28, 1.09, -0.95, g, { cast: false });
  const swd = new THREE.Group(); swd.position.set(1.62, 0.83, -0.82); swd.rotation.y = 0.5; g.add(swd);      // sword
  add(box(0.055, 0.02, 0.52), MAT.steel, 0, 0, 0.08, swd, { cast: false });
  add(box(0.2, 0.03, 0.045), MAT.gold, 0, 0, -0.2, swd, { cast: false });
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), MAT.woodDk, 0, 0, -0.3, swd, { cast: false }).rotation.x = Math.PI / 2;
  const coil = add(new THREE.TorusGeometry(0.13, 0.045, 8, 18), MAT.rope, 1.95, 0.83, -0.98, g, { cast: false }); coil.rotation.x = Math.PI / 2;   // the rope
  // guards' spears at their court posts
  for (const px of [-2.55, 2.55]) {
    add(new THREE.CylinderGeometry(0.03, 0.035, 2.7, 7), MAT.woodDk, px, 1.35, -1.9, g, { cast: false });
    add(new THREE.ConeGeometry(0.07, 0.34, 8), MAT.steel, px, 2.85, -1.9, g, { cast: false });
  }
}
// ================= PALACE EXTERIOR (x=+16) =================
let palaceDoorL, palaceDoorR;
{
  const g = world, px = 16;
  add(tbox(11, 6.4, 0.55, 2), MAT.stone, px, 3.2, -3.3, g, { cast: false });
  add(tbox(11.6, 0.5, 0.9, 2), MAT.stoneDk, px, 6.6, -3.3, g, { cast: false });
  for (const cx of [px - 3.1, px + 3.1]) {
    add(new THREE.CylinderGeometry(0.36, 0.44, 5.6, 10), MAT.stoneDk, cx, 2.8, -2.7, g, { cast: false });
    add(box(1.0, 0.28, 1.0), MAT.stone, cx, 5.75, -2.7, g, { cast: false });
  }
  // tall double doors on hinges (open for the free man)
  const mkDoor = (side) => {
    const grp = new THREE.Group(); grp.position.set(px + side * 1.05, 0, -2.95); g.add(grp);
    add(tbox(1.05, 3.3, 0.12, 2), MAT.woodDk, -side * 0.525, 1.65, 0, grp, { cast: false });
    add(tbox(1.05, 0.14, 0.05, 2), MAT.steelDk, -side * 0.525, 2.6, 0.09, grp, { cast: false });
    add(tbox(1.05, 0.14, 0.05, 2), MAT.steelDk, -side * 0.525, 0.8, 0.09, grp, { cast: false });
    add(new THREE.SphereGeometry(0.06, 8, 6), MAT.goldBright, -side * 0.18, 1.55, 0.1, grp, { cast: false });
    return grp;
  };
  palaceDoorL = mkDoor(-1); palaceDoorR = mkDoor(1);
  const doorGlowP = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 3.3), MAT.glowWarm); doorGlowP.position.set(px, 1.65, -3.65); doorGlowP.userData.ndSkip = true; g.add(doorGlowP);
  // wide steps down to the forecourt
  add(tbox(4.4, 0.18, 0.7, 2), MAT.stone, px, 0.09, -2.4, g, { cast: false });
  add(tbox(5.0, 0.12, 0.7, 2), MAT.stoneDk, px, 0.06, -1.8, g, { cast: false });
  add(tbox(5.6, 0.08, 0.7, 2), MAT.stone, px, 0.04, -1.2, g, { cast: false });
  // lanterns by the door
  for (const lx of [px - 2.2, px + 2.2]) {
    add(box(0.15, 0.22, 0.15), MAT.steelDk, lx, 2.6, -2.85, g, { cast: false });
    const gl = softGlow(1.5, 0xffc98a, 0.14); gl.position.set(lx, 2.6, -2.8); g.add(gl);
  }
}
// ================= THE COOKSHOP (x=+32) =================
{
  const g = world, cx = 32;
  add(tbox(8.6, 3.4, 0.4, 2), MAT.plaster, cx, 1.7, -2.7, g, { cast: false });
  add(tbox(9.2, 0.25, 3.4, 2), MAT.thatch, cx, 3.5, -1.4, g, { cast: false });
  // counter
  add(tbox(3.4, 0.95, 0.8, 2), MAT.wood, cx + 0.2, 0.48, -1.15, g, { cast: false });
  add(tbox(3.6, 0.08, 0.95, 2), MAT.woodDk, cx + 0.2, 0.99, -1.15, g, { cast: false });
  // striped awning on two posts
  for (const ax of [cx - 1.9, cx + 2.3]) add(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), MAT.woodDk, ax, 1.3, 0.1, g, { cast: false });
  for (let i = 0; i < 6; i++) {
    const seg = add(box(0.78, 0.05, 1.7), i % 2 ? MAT.awnR : MAT.awnW, cx - 1.75 + i * 0.79, 2.68, -0.55, g, { cast: false });
    seg.rotation.x = 0.32;
  }
  // THE GRILL — skewers over coals (the smell!) — kept at the counter's RIGHT
  // end, clear of the BILL board's projection in the final hook framing: at
  // its old centre spot it crossed the word SMELL and clipped the board's
  // bottom border. Do not move it back behind the board.
  add(box(0.85, 0.16, 0.5), MAT.steelDk, cx + 1.3, 1.1, -1.05, g, { cast: false });
  const coalGlow = add(box(0.7, 0.05, 0.36), MAT.glowWarm, cx + 1.3, 1.19, -1.05, g, { cast: false }); coalGlow.userData.ndSkip = true;
  for (let i = 0; i < 3; i++) {
    const sk = new THREE.Group(); sk.position.set(cx + 1.03 + i * 0.27, 1.3, -1.05); sk.rotation.z = Math.PI / 2 - 0.12; g.add(sk);
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 6), MAT.steel, 0, 0, 0, sk, { cast: false });
    for (let j = 0; j < 3; j++) add(new THREE.SphereGeometry(0.055, 8, 6), MAT.meat, 0, -0.18 + j * 0.17, 0, sk, { cast: false });
  }
  // hanging pans + pots on the counter
  for (const [hx, hz] of [[cx + 1.2, -2.2], [cx + 1.65, -2.2]]) {
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), MAT.steelDk, hx, 2.9, hz, g, { cast: false });
    add(new THREE.CylinderGeometry(0.19, 0.15, 0.14, 10), MAT.steel, hx, 2.6, hz, g, { cast: false });
  }
  // pot + bread moved to the counter's LEFT end (the grill took the pot's old
  // spot; the bread at the right end still projected onto the board's
  // lower-right corner during the mid push-in frames). Both clear of the
  // board's projection from every hook camera.
  add(new THREE.CylinderGeometry(0.24, 0.19, 0.3, 10), MAT.steelDk, cx - 1.28, 1.18, -1.35, g, { cast: false });
  const bread = add(new THREE.SphereGeometry(0.16, 9, 7), MAT.sack, cx - 1.12, 1.1, -0.9, g, { cast: false }); bread.scale.set(1.25, 0.55, 0.9);
  // stools in front
  for (const [sx, sz] of [[cx - 1.1, 0.75], [cx + 0.7, 0.95]]) {
    add(new THREE.CylinderGeometry(0.21, 0.24, 0.09, 9), MAT.wood, sx, 0.42, sz, g, { cast: false });
    add(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 7), MAT.woodDk, sx, 0.2, sz, g, { cast: false });
  }
  // the sign post the BILL hangs on
  add(new THREE.CylinderGeometry(0.055, 0.065, 2.6, 8), MAT.woodDk, cx - 0.85, 1.3, -0.75, g, { cast: false });
  add(box(0.7, 0.07, 0.07), MAT.woodDk, cx - 0.85, 2.42, -0.75, g, { cast: false });
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardLaw = textBoard(['MY WORD IS LAW'], 2.0, 0.5, '#3a3630', '#ffd76a'); boardLaw.position.set(0, 3.3, -3.14); world.add(boardLaw);
const boardOldAge = textBoard(['OLD AGE'], 2.0, 0.5, '#e8d9ae', '#4a2c14'); boardOldAge.position.set(-1.9, 2.9, -3.14); world.add(boardOldAge);
const boardBill = textBoard(['A BILL', 'FOR A', 'SMELL'], 1.05, 1.0, '#4a2c14', '#ffd76a'); boardBill.position.set(31.9, 1.55, -0.75); boardBill.rotation.y = 0.15; world.add(boardBill);

// ---------- FX: smoke / dust / steam ----------
const smoke = new FX.Smoke(scene, 150); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const courtEmit = smoke.addEmitter(-2.9, 1.35, -2.9, { rate: 0.3, color: 0xd8cbb2, opacity: 0.07, scale: 0.8, grow: 1.5, life: 2.4, vy: 0.35, wind: 0.12 });
const dustEmit = smoke.addEmitter(-16, 1.7, -3.0, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.55, grow: 1.25, life: 2.2, vy: 0.15, wind: 0.15 });
const steamEmit = smoke.addEmitter(33.3, 1.35, -1.05, { rate: 0, color: 0xffffff, opacity: 0.13, scale: 0.5, grow: 1.6, life: 1.9, vy: 0.5, wind: 0.1 });
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
    courtEmit.rate = pr.smokeRate; dustEmit.rate = pr.dustRate; steamEmit.rate = pr.steamRate;
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
  setB(boardLaw, Ws.boardLaw || 0); setB(boardOldAge, Ws.boardOldAge || 0); setB(boardBill, Ws.boardBill || 0);
  palaceDoorL.rotation.y = -(Ws.palaceDoor || 0) * 1.75; palaceDoorR.rotation.y = (Ws.palaceDoor || 0) * 1.75;
  MAT.glowWarm.opacity = 0.3 + (Ws.glowK || 0) * 0.25;
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
