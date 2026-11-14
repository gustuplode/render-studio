import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, hayCartAt, carrierAt, LAMPP } from './story.js';

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
// the lamp's own light: a real point light with distance falloff — the
// glow is brightest AT the lamp and dies softly into the corners.
const lampLight = new THREE.PointLight(0xffb45e, 0, 30, 1.7);
lampLight.position.set(LAMPP[0], 0.75, LAMPP[2]); scene.add(lampLight);

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
// soft radial glow sprite (radial falloff — lamp light, never a hard wedge)
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
  thatch: toon({ color: '#b08d4f' }), leaf: toon({ color: '#4a6a34' }),
  hay: toon({ color: '#d9b45c' }), hayDk: toon({ color: '#bd973f' }),
  cotton: toon({ color: '#f2ede2' }), strap: toon({ color: '#7a6248' }),
  clay: toon({ color: '#9a5c33' }), clayDk: toon({ color: '#6e3f20' }),
  dark: toon({ color: '#33302c' }),
  royal: toon({ color: '#8c2432' }), gold: toon({ color: '#d9a441' }),
  clothR: toon({ color: '#a03a30' }), clothG: toon({ color: '#3f7050' }), clothB: toon({ color: '#3a5a8c' }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffb03a, fog: true }),
};
const world = new THREE.Group(); scene.add(world);
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(320, 240), MAT.grass, 8, -0.03, 0, g, { cast: false }));
  flat(add(new THREE.CircleGeometry(9.5, 22), MAT.dirt, 0, -0.012, 0.5, g, { cast: false }));       // village square
  flat(add(new THREE.PlaneGeometry(26, 8), MAT.dirt, 26, -0.01, -1.5, g, { cast: false }));          // market ground
  flat(add(new THREE.CircleGeometry(9.5, 22), MAT.stone, 52, -0.008, -2, g, { cast: false }));        // court plaza
  // distant houses + trees (depth)
  for (const [hx, hz, ry] of [[-12, -12, 0.2], [12.5, -13, -0.3], [38, -12, 0.4], [64, -11, -0.2]]) {
    const h = new THREE.Group(); h.position.set(hx, 0, hz); h.rotation.y = ry; g.add(h);
    add(tbox(2.8, 1.8, 2.3, 2), MAT.plaster, 0, 0.9, 0, h, { cast: false });
    add(new THREE.ConeGeometry(2.3, 1.3, 4), MAT.thatch, 0, 2.4, 0, h, { cast: false }).rotation.y = Math.PI / 4;
  }
  for (const [tx, tz, s] of [[-10, -5.5, 1], [10.5, -4.5, 1.15], [40, -8, 0.9], [63, -7, 1.1]]) {
    add(new THREE.CylinderGeometry(0.3 * s, 0.44 * s, 2.8 * s, 8), MAT.woodDk, tx, 1.4 * s, tz, g, { cast: false });
    const can = add(new THREE.SphereGeometry(2.1 * s, 10, 8), MAT.leaf, tx, 3.6 * s, tz, g, { cast: false });
    can.scale.y = 0.72; can.userData.ndSkip = true;
  }
}
// ================= THE HALL FACADE + SQUARE (x=0) =================
{
  const g = world;
  add(tbox(7.3, 8, 0.7, 2), MAT.stone, -5.05, 4, -8.5, g, { cast: false });
  add(tbox(7.3, 8, 0.7, 2), MAT.stone, 5.05, 4, -8.5, g, { cast: false });
  add(tbox(2.8, 3.8, 0.7, 2), MAT.stone, 0, 6.1, -8.5, g, { cast: false });       // lintel over the great door
  add(tbox(18.5, 0.55, 1.15, 2), MAT.stoneDk, 0, 8.3, -8.5, g, { cast: false });  // roof beam
  add(tbox(2.8, 4.2, 0.16, 2), MAT.dark, 0, 2.1, -8.8, g, { cast: false });      // door darkness
  add(tbox(4.6, 0.18, 1.3, 2), MAT.stoneDk, 0, 0.09, -7.5, g, { cast: false });  // steps
  for (const sx of [-8.1, 8.1]) {
    add(new THREE.CylinderGeometry(1.1, 1.25, 9.2, 10), MAT.stone, sx, 4.6, -8.5, g, { cast: false });
    add(new THREE.ConeGeometry(1.55, 1.4, 10), MAT.thatch, sx, 9.9, -8.5, g, { cast: false });
  }
  add(new THREE.CylinderGeometry(0.06, 0.07, 3.0, 8), MAT.woodDk, -4.02, 1.5, -3.23, g, { cast: false }); // bet-board post (behind the rotated board plane)
}
// ================= HALL INTERIOR (centre x=-30) =================
let hayPile, cottonBales = [], carriedBales = [], lampGroup, lampFlame, lampGlowBig, cornerGlows = [];
{
  const g = world;
  flat(add(new THREE.PlaneGeometry(19.5, 13), MAT.stone, -30, -0.005, -3.4, g, { cast: false }));
  add(tbox(10.4, 5.5, 0.5, 2), MAT.stoneDk, -33.8, 2.75, -9.7, g, { cast: false });   // back wall west of door
  add(tbox(1.4, 5.5, 0.5, 2), MAT.stoneDk, -21.6, 2.75, -9.7, g, { cast: false });    // back wall east of door
  add(tbox(3.4, 1.7, 0.5, 2), MAT.stoneDk, -24, 4.65, -9.7, g, { cast: false });      // door lintel (board sits on it)
  add(tbox(0.5, 5.5, 12.6, 2), MAT.stoneDk, -39.2, 2.75, -3.6, g, { cast: false });   // west wall
  add(tbox(0.5, 5.5, 5.6, 2), MAT.stoneDk, -20.8, 2.75, -6.9, g, { cast: false });    // east wall (south end open)
  for (const bz of [-8, -5, -2]) add(tbox(18.6, 0.3, 0.42, 2), MAT.woodDk, -30, 5.65, bz, g, { cast: false }); // roof beams
  // hay pile (grows with hayK)
  hayPile = new THREE.Group(); hayPile.position.set(-29.5, 0, -7.2); g.add(hayPile);
  for (const [px, py, pz, r, dk] of [[0, 0.26, 0, 0.95, 0], [0.85, 0.2, 0.3, 0.7, 1], [-0.75, 0.2, 0.25, 0.66, 0], [0.3, 0.58, -0.2, 0.6, 1], [-0.3, 0.52, 0.35, 0.55, 0]]) {
    const s = add(new THREE.SphereGeometry(r, 10, 8), dk ? MAT.hayDk : MAT.hay, px, py, pz, hayPile, { cast: false }); s.scale.y = 0.62;
  }
  // cotton stack (bales appear with baleK)
  const bale = (parent, x, y, z, ry = 0) => {
    const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = ry; parent.add(b);
    add(tbox(0.95, 0.5, 0.62, 2), MAT.cotton, 0, 0, 0, b, { cast: false });
    add(box(0.99, 0.08, 0.66), MAT.strap, 0, 0.1, 0, b, { cast: false });
    add(box(0.99, 0.08, 0.66), MAT.strap, 0, -0.12, 0, b, { cast: false });
    return b;
  };
  const stackSpots = [[-0.95, 0.25, 0, 0.1], [0, 0.25, 0.06, -0.08], [0.95, 0.25, -0.04, 0.15], [-0.5, 0.76, 0, 0.05], [0.5, 0.76, 0.03, -0.12], [0, 1.27, 0, 0.08]];
  for (const [sx, sy, sz, ry] of stackSpots) cottonBales.push(bale(g, -34.0 + sx, sy, -6.4 + sz, ry));
  carriedBales = [bale(g, 0, -10, 0), bale(g, 0, -10, 0)];   // parked underground until carried
  // THE LAMP — clay bowl + flame + soft radial glows + corner washes
  lampGroup = new THREE.Group(); lampGroup.position.set(LAMPP[0], 0, LAMPP[2]); g.add(lampGroup);
  const bowl = add(new THREE.SphereGeometry(0.17, 12, 8), MAT.clay, 0, 0.07, 0, lampGroup, { cast: false }); bowl.scale.y = 0.55;
  add(new THREE.CylinderGeometry(0.15, 0.1, 0.05, 12), MAT.clayDk, 0, 0.13, 0, lampGroup, { cast: false });
  lampFlame = add(new THREE.ConeGeometry(0.05, 0.17, 8), MAT.flame, 0, 0.26, 0, lampGroup, { cast: false }); lampFlame.userData.ndSkip = true;
  const fg = softGlow(0.85, 0xffc37a, 0.85); fg.position.set(0, 0.3, 0); lampGroup.add(fg); lampGroup.userData.flameGlow = fg;
  lampGlowBig = softGlow(6, 0xffb45e, 0); lampGlowBig.position.set(LAMPP[0], 1.1, LAMPP[2]); g.add(lampGlowBig);
  for (const [cx, cz] of [[-37.9, -8.7], [-22.3, -8.7], [-37.9, 0.7], [-22.3, 0.7]]) {
    const cg = softGlow(4.5, 0xffc98a, 0); cg.position.set(cx, 1.0, cz); g.add(cg); cornerGlows.push(cg);
  }
}
// ================= HAY CARTS ×2 =================
const mkCart = () => {
  const cart = new THREE.Group(); world.add(cart);
  const wheels = [];
  add(tbox(1.9, 0.16, 1.15, 2), MAT.wood, 0, 0.66, 0, cart, { cast: false });
  add(tbox(1.9, 0.3, 0.07, 2), MAT.woodDk, 0, 0.88, -0.56, cart, { cast: false });
  add(tbox(1.9, 0.3, 0.07, 2), MAT.woodDk, 0, 0.88, 0.56, cart, { cast: false });
  add(tbox(0.07, 0.3, 1.15, 2), MAT.woodDk, -0.93, 0.88, 0, cart, { cast: false });
  for (const wz of [-0.64, 0.64]) for (const wx of [-0.55, 0.55]) {
    const wg = new THREE.Group(); wg.position.set(wx, 0.44, wz); cart.add(wg);
    const w = add(new THREE.CylinderGeometry(0.44, 0.44, 0.09, 14), MAT.woodDk, 0, 0, 0, wg, { cast: false }); w.rotation.x = Math.PI / 2;
    wheels.push(wg);
  }
  for (const hz of [-0.3, 0.3]) { const h = add(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 7), MAT.woodDk, -1.3, 0.6, hz, cart, { cast: false }); h.rotation.z = Math.PI / 2 - 0.18; }
  const load = new THREE.Group(); load.position.set(0, 0.78, 0); cart.add(load);
  for (const [lx, ly, lz, r] of [[-0.5, 0.16, 0, 0.5], [0.45, 0.16, 0.1, 0.52], [0, 0.42, -0.05, 0.46]]) {
    const s = add(new THREE.SphereGeometry(r, 9, 7), MAT.hay, lx, ly, lz, load, { cast: false }); s.scale.y = 0.6;
  }
  cart.rotation.y = Math.PI / 2 - 0.35;
  return { cart, wheels, load };
};
const cartA = mkCart(), cartB = mkCart();
// ================= MARKET (x=+26) =================
let soldLampMesh;
{
  const g = world;
  const stall = (x, clothMat) => {
    for (const [px, pz] of [[-1.6, -4.9], [1.6, -4.9], [-1.6, -3.4], [1.6, -3.4]]) add(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 7), MAT.woodDk, x + px, 1.3, pz, g, { cast: false });
    add(tbox(3.4, 0.85, 0.9, 2), MAT.wood, x, 0.43, -4.2, g, { cast: false });
    const awn = add(tbox(3.9, 0.07, 2.3, 2), clothMat, x, 2.72, -4.15, g, { cast: false }); awn.rotation.x = 0.16;
  };
  stall(20.5, MAT.clothR); stall(24.5, MAT.clothG); stall(30.5, MAT.clothB);
  for (const [hx, hy, hz, r] of [[19.6, 1.0, -4.2, 0.42], [20.5, 1.05, -4.35, 0.46], [21.4, 1.0, -4.15, 0.4], [20.4, 0.3, -3.2, 0.5]]) {
    const s = add(new THREE.SphereGeometry(r, 9, 7), MAT.hay, hx, hy, hz, g, { cast: false }); s.scale.y = 0.62;
  }
  for (const [bx, by, bz] of [[23.8, 1.11, -4.2], [24.6, 1.11, -4.3], [25.3, 1.11, -4.15]]) {
    add(tbox(0.7, 0.38, 0.5, 2), MAT.cotton, bx, by, bz, g, { cast: false });
  }
  // lamp stall: little clay lamps + oil bottles on the counter
  const miniLamp = (x, z) => {
    const b = add(new THREE.SphereGeometry(0.11, 10, 7), MAT.clay, x, 0.9, z, g, { cast: false }); b.scale.y = 0.55;
  };
  miniLamp(29.7, -4.35); miniLamp(30.3, -4.45); miniLamp(31.1, -4.3);
  const b1 = FX.bottle({ h: 0.34 }); b1.scale.setScalar(0.2); b1.position.set(30.8, 0.86, -4.05); g.add(b1);
  const b2 = FX.bottle({ h: 0.28 }); b2.scale.setScalar(0.17); b2.position.set(29.95, 0.86, -4.0); g.add(b2);
  soldLampMesh = new THREE.Group(); soldLampMesh.position.set(29.55, 0, -3.85); g.add(soldLampMesh);
  const sb = add(new THREE.SphereGeometry(0.13, 10, 7), MAT.clay, 0, 0.9, 0, soldLampMesh, { cast: false }); sb.scale.y = 0.55;
}
// ================= NEXT-TOWN COURT (x=+52) =================
let torchGlows = [];
{
  const g = world;
  add(tbox(13, 5.5, 0.5, 2), MAT.stoneDk, 52, 2.75, -7.6, g, { cast: false });
  add(tbox(7.4, 0.42, 3.2, 2), MAT.stone, 52, 0.21, -5.2, g, { cast: false });       // platform
  add(tbox(5.2, 0.2, 1.0, 2), MAT.stoneDk, 52, 0.1, -3.2, g, { cast: false });       // step
  add(tbox(1.15, 0.55, 0.95, 2), MAT.royal, 52, 0.7, -5.7, g, { cast: false });      // throne seat
  add(tbox(1.25, 2.0, 0.28, 2), MAT.royal, 52, 1.7, -6.15, g, { cast: false });      // throne back
  add(new THREE.SphereGeometry(0.14, 10, 8), MAT.gold, 52, 2.85, -6.15, g, { cast: false });
  for (const px of [48.4, 55.6]) add(new THREE.CylinderGeometry(0.34, 0.4, 5.6, 10), MAT.stone, px, 2.8, -5.8, g, { cast: false });
  for (const tx of [49.2, 54.8]) {
    add(new THREE.CylinderGeometry(0.05, 0.06, 2.7, 7), MAT.woodDk, tx, 1.35, -1.1, g, { cast: false });
    const fl = add(new THREE.ConeGeometry(0.11, 0.34, 8), MAT.flame, tx, 2.9, -1.1, g, { cast: false }); fl.userData.ndSkip = true;
    const tg = softGlow(1.7, 0xffa04e, 0.4); tg.position.set(tx, 2.95, -1.1); g.add(tg); torchGlows.push(tg);
  }
}
// ---- boards (transforms mirrored in boards.json — keep in sync) ----
const boardBet = textBoard(['FILL THE HALL', 'WITH ONE COIN'], 2.4, 1.0, '#4a2c14', '#ffd76a'); boardBet.position.set(-3.9, 2.85, -3.1); boardBet.rotation.y = 0.76; world.add(boardBet);
const boardHall = textBoard(['THE GIANT HALL'], 3.2, 0.9, '#4a2c14', '#ffd76a'); boardHall.position.set(-24, 4.6, -9.38); world.add(boardHall);

// ---------- FX: haze + dust ----------
const smoke = new FX.Smoke(scene, 130); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const hazeEmit = smoke.addEmitter(0, 2.4, 0, { rate: 0.3, color: 0xffffff, opacity: 0.04, scale: 2.2, grow: 1.3, life: 2.6, vy: 0.1, wind: -0.5 });
const dustEmit = smoke.addEmitter(-30, 1.6, -5, { rate: 0, color: 0xffe2b8, opacity: 0.1, scale: 0.5, grow: 1.2, life: 2.2, vy: 0.16, wind: 0.15 });
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
  setB(boardBet, Ws.boardBet || 0); setB(boardHall, Ws.boardHall || 0);
  // hay carts + loads + wheels
  const hc = hayCartAt(f);
  cartA.cart.position.set(hc.A[0], 0, hc.A[2]); cartB.cart.position.set(hc.B[0], 0, hc.B[2]);
  cartA.wheels.forEach((w) => { w.rotation.z = -(hc.Ad || 0) / 0.44; });
  cartB.wheels.forEach((w) => { w.rotation.z = -(hc.Bd || 0) / 0.44; });
  cartA.load.scale.setScalar(Math.max(0.02, hc.loadA)); cartA.load.visible = hc.loadA > 0.03;
  cartB.load.scale.setScalar(Math.max(0.02, hc.loadB)); cartB.load.visible = hc.loadB > 0.03;
  // hay pile + cotton stack + carried bales
  const hk = Ws.hayK || 0;
  hayPile.visible = hk > 0.02; hayPile.scale.setScalar(0.25 + 0.75 * hk);
  cottonBales.forEach((b, i) => { b.visible = i < (Ws.baleK || 0); });
  const cs = carrierAt(f);
  carriedBales.forEach((b, i) => {
    const c = cs[i];
    if (c.carrying && f >= 609 && f <= 713) { b.visible = true; b.position.set(c.p[0] + 0.05, 2.3, c.p[2]); }
    else b.visible = false;
  });
  // the lamp: set down at LAMPP at f955 — the frame the boy's hand empties
  // in story.js — so from here it is the story's ONLY lamp; soft light with
  // true falloff
  const lk = Ws.lampK || 0;
  lampGroup.visible = f >= 955 && f <= 1258;
  const flick = 0.9 + 0.1 * Math.sin(f * 0.9) * Math.sin(f * 0.37 + 1.7);
  lampFlame.visible = lk > 0.01;
  lampFlame.scale.set(flick, (0.8 + 0.35 * flick) * Math.min(1, lk * 3), flick);
  lampGroup.userData.flameGlow.material.opacity = 0.85 * Math.min(1, lk * 2.6) * flick;
  lampLight.intensity = lk * 95 * flick;
  lampGlowBig.material.opacity = lk * 0.26;
  lampGlowBig.scale.setScalar(3 + lk * 7.5);
  cornerGlows.forEach((cg) => { cg.material.opacity = lk * 0.20 * flick; });
  soldLampMesh.visible = !(Ws.soldLamp > 0);
  torchGlows.forEach((tg, i) => { tg.material.opacity = 0.32 + 0.1 * Math.sin(f * 0.8 + i * 2.4) * Math.sin(f * 0.31 + i); });
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
