import * as THREE from './lib/three.module.js';
import * as T0 from './toon.js';
import { bobbyCard, fxSpark } from './extras.js';
const T = { ...T0, bobbyCard, fxSpark };
import * as P from './paint.js';
import * as FX from './fx.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt, fxProfileAt, BOARDS } from './story.js';

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

const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(1), 1, 6), beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  stone: texM(P.stone(4), 1, 1), stoneWall: texM(P.stone(14, 30, 10, 58), 5, 2, '#a8a294'),
  dirt: texM(P.dirt(7), 10, 10, '#b39d78'), grass: texM(P.grass(6), 28, 28, '#87a05c'), grassDk: texM(P.grass(16), 8, 8, '#6d8a4a'),
  mossy: texM(P.mossy(P.stone(8), 5, 0.8), 2, 2), plaster: texM(P.plaster(9), 3, 1, '#ddd3bc'),
};
const MW = {
  leaf: toon({ color: '#5d7a35' }), leafDk: toon({ color: '#47602a' }), trunk: toon({ color: '#5d4a36' }), trunkDk: toon({ color: '#463827' }),
  iron: toon({ color: '#2c2e33' }), white: toon({ color: '#eef2f6' }), gold: toon({ color: '#c9973f' }),
  bronze: toon({ color: '#8a6a3a' }), dark: toon({ color: '#2e2c30' }),
  shade: new THREE.MeshBasicMaterial({ color: 0x24351c, transparent: true, opacity: 0.2, depthWrite: false }),
};

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

const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

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
// grave headstone face: canvas inscription (prop texture, not a story board)
const headstoneFace = () => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 640;
  const g = c.getContext('2d'); g.fillStyle = '#9d968a'; g.fillRect(0, 0, 512, 640);
  g.strokeStyle = '#6d675c'; g.lineWidth = 6; g.strokeRect(26, 26, 460, 588);
  g.fillStyle = '#57534a'; g.textAlign = 'center';
  g.font = '700 64px Georgia'; g.fillText('JOHN GRAY', 256, 210);
  g.font = '700 52px Georgia'; g.fillText('1858', 256, 320);
  g.font = 'italic 40px Georgia'; g.fillText('Auld Jock', 256, 430);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.08), new THREE.MeshBasicMaterial({ map: t, fog: true }));
  m.userData.ndSkip = true; return m;
};

// ---------- the kirkyard set ----------
const world = new THREE.Group(); scene.add(world);
{ // ground: kirkyard grass + gravel path + darker patches
  flat(add(new THREE.CircleGeometry(60, 40), M.grass, 0, -0.04, -4, world, { cast: false }));
  add(tbox(3.2, 0.05, 26, 2), M.dirt, -0.4, -0.01, 2.5, world, { cast: false });
  flat(add(new THREE.CircleGeometry(4.4, 24), M.grassDk, 3.4, -0.02, -3.4, world, { cast: false }));
  flat(add(new THREE.CircleGeometry(3.4, 22), M.grassDk, -4.6, -0.02, -1.5, world, { cast: false }));
}
// THE GRAVE at origin: slab + headstone + low iron hoop rail
{
  add(tbox(2.3, 0.14, 1.15, 2), M.stone, 0, 0.07, 0, world, { cast: false });
  add(tbox(2.5, 0.07, 1.35, 2), M.mossy, 0, 0.035, 0, world, { cast: false });
  const hs = add(tbox(0.98, 1.25, 0.16, 2), M.stoneWall, 0, 0.62, -0.62, world, { cast: false });
  const cap = add(new THREE.CylinderGeometry(0.49, 0.49, 0.16, 16, 1, false, 0, Math.PI), M.stoneWall, 0, 1.25, -0.62, world, { cast: false });
  cap.rotation.z = Math.PI / 2; cap.rotation.y = Math.PI / 2;
  const face = headstoneFace(); face.position.set(0, 0.66, -0.53); world.add(face);
  for (const sd of [-1.16, 1.16]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6), MW.iron, sd, 0.21, 0.62, world, { cast: false });
  add(new THREE.CylinderGeometry(0.018, 0.018, 2.36, 6), MW.iron, 0, 0.42, 0.62, world, { cast: false }).rotation.z = Math.PI / 2;
}
// other graves: rows of stones, varied, leaning (layered depth)
{
  const r = P.rng(23);
  for (const [gx, gz] of [[-3.4, -2.6], [-4.6, -4.2], [3.1, -3.1], [4.4, -4.6], [-2.6, -5.2], [2.2, -5.6], [5.6, -2.2], [-5.8, -0.6]]) {
    const h = 0.8 + r() * 0.5;
    const st = add(tbox(0.66, h, 0.12, 2), M.stoneWall, gx, h / 2, gz, world, { cast: false });
    st.rotation.y = (r() - 0.5) * 0.5; st.rotation.z = (r() - 0.5) * 0.09;
    add(tbox(0.8, 0.09, 0.4, 2), M.mossy, gx, 0.045, gz + 0.35, world, { cast: false });
  }
}
// iron fence + GATE (front, swings via worldAt gateT)
const gate = new THREE.Group(); gate.position.set(-1.9, 0, 3.4); world.add(gate);
{
  for (let x = -9; x <= 9; x += 0.55) { if (x > -2.05 && x < 0.4) continue; add(new THREE.CylinderGeometry(0.028, 0.028, 1.25, 6), MW.iron, x, 0.62, 3.4, world, { cast: false }); }
  add(new THREE.CylinderGeometry(0.03, 0.03, 18.4, 6), MW.iron, 0, 1.1, 3.4, world, { cast: false }).rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.03, 0.03, 18.4, 6), MW.iron, 0, 0.55, 3.4, world, { cast: false }).rotation.z = Math.PI / 2;
  for (let x = -1.75; x <= 0.15; x += 0.38) add(new THREE.CylinderGeometry(0.024, 0.024, 1.2, 6), MW.iron, x + 1.9, 0.6, 0, gate, { cast: false });
  add(new THREE.CylinderGeometry(0.026, 0.026, 2.2, 6), MW.iron, 0.95, 1.05, 0, gate, { cast: false }).rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.026, 0.026, 2.2, 6), MW.iron, 0.95, 0.5, 0, gate, { cast: false }).rotation.z = Math.PI / 2;
  const post = add(new THREE.CylinderGeometry(0.055, 0.065, 1.45, 7), MW.iron, -1.95, 0.72, 3.4, world, { cast: false });
  add(new THREE.SphereGeometry(0.085, 8, 6), MW.iron, -1.95, 1.5, 3.4, world, { cast: false });
}
// the kirk behind-left + Edinburgh Castle on its rock, far right (with the one o'clock gun)
{
  const kirk = new THREE.Group(); kirk.position.set(-5.2, 0, -10.5); kirk.rotation.y = 0.3; world.add(kirk);
  add(tbox(5.4, 3.6, 3.4, 2), M.stoneWall, 0, 1.8, 0, kirk, { cast: false });
  const rf = add(tbox(6.0, 0.14, 4.2, 2), M.beamDark, 0, 3.9, 0, kirk, { cast: false }); rf.rotation.x = 0.42;
  const tw = add(tbox(1.1, 4.6, 1.1, 2), M.stoneWall, -2.2, 2.3, 0.8, kirk, { cast: false });
  add(new THREE.ConeGeometry(0.85, 1.6, 4), M.beamDark, -2.2, 5.4, 0.8, kirk, { cast: false }).rotation.y = Math.PI / 4;
  const win = add(new THREE.PlaneGeometry(0.9, 2.0), new THREE.MeshBasicMaterial({ color: 0xffdf9e, fog: true }), 0.6, 2.0, 1.72, kirk, { cast: false }); win.userData.ndSkip = true;
  add(tbox(0.1, 2.0, 0.06, 2), M.beamDark, 0.6, 2.0, 1.74, kirk, { cast: false });
}
const castle = new THREE.Group(); castle.position.set(10.5, 0, -17); world.add(castle);
{
  const rock = add(new THREE.CylinderGeometry(3.4, 5.2, 3.4, 9), M.stoneWall, 0, 1.7, 0, castle, { cast: false }); rock.scale.z = 0.8;
  add(tbox(4.6, 1.7, 2.6, 2), M.stoneWall, -0.4, 4.2, 0, castle, { cast: false });
  add(tbox(1.4, 2.6, 1.4, 2), M.stoneWall, 1.6, 4.7, -0.4, castle, { cast: false });
  add(new THREE.ConeGeometry(1.05, 1.1, 4), M.beamDark, 1.6, 6.55, -0.4, castle, { cast: false }).rotation.y = Math.PI / 4;
  // the one o'clock gun: small cannon on the wall, muzzle toward the town (+z/-x)
  const gun = new THREE.Group(); gun.position.set(-2.2, 4.35, 0.9); gun.rotation.y = -0.5; castle.add(gun);
  const barrel = add(new THREE.CylinderGeometry(0.09, 0.13, 0.85, 10), MW.iron, 0, 0.18, 0.3, gun, { cast: false }); barrel.rotation.x = Math.PI / 2 - 0.06;
  add(tbox(0.5, 0.3, 0.7, 2), M.beamDark, 0, 0.12, -0.1, gun, { cast: false });
  castle.userData.muzzle = [8.0, 4.6, -15.9];
}
// trees: one bare winter tree, one leafy
const treeAt = (x, z, bare = false, s = 1) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); world.add(g);
  add(new THREE.CylinderGeometry(0.14, 0.26, 2.6, 8), MW.trunk, 0, 1.3, 0, g, { cast: false });
  for (const [a, l] of [[0.6, 1.7], [-0.5, 1.5], [0.15, 1.9]]) {
    const br = add(new THREE.CylinderGeometry(0.05, 0.09, l, 6), MW.trunkDk, Math.sin(a) * l * 0.4, 2.6 + Math.cos(a) * l * 0.38, 0, g, { cast: false }); br.rotation.z = a;
  }
  if (!bare) for (const [ox, oy, oz, r, m] of [[0, 4.3, 0, 1.45, MW.leaf], [0.9, 3.8, 0.2, 1.0, MW.leafDk], [-0.85, 3.9, -0.2, 1.05, MW.leaf]]) {
    const c = add(new THREE.SphereGeometry(r, 11, 8), m, ox, oy, oz, g, { cast: false }); c.scale.y = 0.6;
  }
  return g;
};
treeAt(-4.4, -6.4, true, 1.15); treeAt(4.9, -6.9, false, 1.3); treeAt(7.6, -3.4, true, 0.95);
// eating-house doorway (the one o'clock dinner), right side beyond the fence
{
  const dh = new THREE.Group(); dh.position.set(5.6, 0, 1.8); dh.rotation.y = -0.7; world.add(dh);
  add(tbox(2.4, 2.9, 0.35, 2), M.plaster, 0, 1.45, 0, dh, { cast: false });
  add(tbox(0.95, 1.9, 0.1, 2), M.beamDark, 0, 0.95, 0.2, dh, { cast: false });
  const glow = add(new THREE.PlaneGeometry(0.8, 1.75), new THREE.MeshBasicMaterial({ color: 0xffc978, fog: true }), 0, 0.95, 0.26, dh, { cast: false }); glow.userData.ndSkip = true;
  add(tbox(2.7, 0.14, 0.6, 2), M.roof ?? M.beamDark, 0, 3.0, 0.1, dh, { cast: false });
}
// dinner bowl by the doorway
const bowlG = new THREE.Group(); bowlG.position.set(4.7, 0.02, 2.3); world.add(bowlG);
{
  const bowl = add(new THREE.CylinderGeometry(0.26, 0.16, 0.15, 13, 1, true), toon({ color: '#7a4a3a', side: THREE.DoubleSide }), 0, 0.07, 0, bowlG, { cast: false }); bowl.userData.ndSkip = true;
  add(new THREE.SphereGeometry(0.15, 9, 7), toon({ color: '#d9c9a6' }), 0, 0.13, 0, bowlG, { cast: false });
}
// ---- notice board behind the grave carries the story boards ----
const notice = new THREE.Group(); notice.position.set(-1.25, 0, -1.55); notice.rotation.y = 0.15; world.add(notice);
{
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.065, 2.2, 7), M.beamDark, sd * 0.92, 1.1, -0.07, notice, { cast: false });
  const rf = add(tbox(2.3, 0.09, 0.5, 2), M.beamDark, 0, 2.32, -0.02, notice, { cast: false }); rf.rotation.x = 0.25;
}
const boardMeshes = {};
{
  const b = textBoard(['EDINBURGH', '1858'], 1.5, 0.95, '#4a3a28', '#ffe9a8'); b.position.set(0, 1.12, 0); notice.add(b); boardMeshes.y1858 = b;
}
// the STAY board stands on its own easel directly behind the grave, so the
// collar close-up can hold it in frame (portrait FOV is narrow)
const stayEasel = new THREE.Group(); stayEasel.position.set(-0.15, 0, -1.6); stayEasel.rotation.y = 0.05; world.add(stayEasel);
{
  for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.04, 0.05, 1.35, 7), M.beamDark, sd * 0.48, 0.67, -0.05, stayEasel, { cast: false });
  const b = textBoard(['LET HIM', 'STAY'], 1.1, 0.72, '#37455c', '#e8eef8'); b.position.set(0, 1.0, 0); stayEasel.add(b); boardMeshes.stay = b;
}
// the statue plinth OUTSIDE the gate (finale) — the bronze Bobby is a tinted card (story)
{
  add(tbox(0.95, 0.92, 0.95, 2), M.stoneWall, -3.6, 0.46, 5.6, world, { cast: false });
  add(tbox(1.1, 0.1, 1.1, 2), M.stone, -3.6, 0.97, 5.6, world, { cast: false });
  const plate = textBoard(['GREYFRIARS BOBBY', '1858 — 1872'], 0.95, 0.5, '#5d4a2a', '#ffe9a8'); plate.position.set(-3.6, 0.62, 6.09); world.add(plate); boardMeshes.finale = plate;
}
// kirkyard lamp by the path (night beats)
const lampGlow = FX.glint(0.8); lampGlow.position.set(2.4, 2.15, 1.4); lampGlow.userData.ndSkip = true; world.add(lampGlow);
{
  add(new THREE.CylinderGeometry(0.045, 0.06, 2.1, 7), MW.iron, 2.4, 1.05, 1.4, world, { cast: false });
  add(new THREE.SphereGeometry(0.11, 9, 7), MW.white, 2.4, 2.15, 1.4, world, { cast: false });
}
// grass tufts
const grassTufts = [];
{ const r = P.rng(41);
  for (let i = 0; i < 80; i++) {
    const x = (r() - 0.5) * 17, z = -6.5 + r() * 8.5;
    if (Math.hypot(x, z) < 1.9 || Math.abs(x + 0.4) < 1.9 && z > -0.5) continue;
    const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
    const n = 3 + (r() * 3 | 0);
    for (let j = 0; j < n; j++) { const blade = add(new THREE.ConeGeometry(0.055, 0.26 + r() * 0.24, 5), j % 2 ? MW.leaf : MW.leafDk, (r() - 0.5) * 0.28, 0.17, (r() - 0.5) * 0.28, g, { cast: false }); blade.rotation.z = (r() - 0.5) * 0.5; }
    g.userData.ph = r() * 6.28; grassTufts.push(g);
  }
}

// ---------- FX: castle-gun smoke + kirkyard clouds + drifting mist ----------
const smoke = new FX.Smoke(scene, 90); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; });
const gunSmoke = smoke.addEmitter(8.0, 4.6, -15.9, { rate: 0, color: 0xe8e4da, opacity: 0.4, scale: 0.6, grow: 1.8, life: 2.2, vy: 0.5, wind: 1.2 });
const fxClouds = new FX.Clouds(scene, { count: 6, y: 55, opacity: 0.24, color: 0xe8e2d2, drift: 0.3 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; }); });
const mist = FX.mistBand(scene, { y: 0.5, opacity: 0.0, count: 10 });
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
    gunSmoke.rate = pr.smokeRate || 0;
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
  setB(boardMeshes.y1858, Ws.board1858 || 0); setB(boardMeshes.stay, Ws.boardStay || 0); setB(boardMeshes.finale, Ws.boardFinale || 0);
  gate.rotation.y = -(Ws.gateT || 0) * 1.9;
  bowlG.visible = (Ws.bowlT || 0) > 0.01;
  lampGlow.material.opacity = (Ws.lampT || 0) * (0.55 + 0.2 * Math.sin(f * 0.3));
  if (mist) mist.children.forEach((m) => { if (m.material) m.material.opacity = (Ws.mistT || 0) * 0.16; });
  grassTufts.forEach((g) => { g.rotation.z = Math.sin(f * 0.06 + g.userData.ph) * 0.07 * (Ws.grassK || 0.5) * (1 + (Ws.windK || 0)); });
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
window.boardNDC = (f) => {
  const C = camAt(f);
  const cam = new THREE.PerspectiveCamera(C.fov, W / H, 0.08, 1500);
  cam.position.set(...C.pos); cam.up.set(0, 1, 0); cam.lookAt(...C.look); cam.rotateZ(rx(C.roll || 0));
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const Ws = worldAt(f);
  return BOARDS.map((b) => {
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    const right = [cy, 0, -sy], up = [0, 1, 0];
    const corners = [];
    for (const [sx, sy2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = new THREE.Vector3(
        b.pos[0] + right[0] * sx * b.w / 2 + up[0] * sy2 * b.h / 2,
        b.pos[1] + right[1] * sx * b.w / 2 + up[1] * sy2 * b.h / 2,
        b.pos[2] + right[2] * sx * b.w / 2 + up[2] * sy2 * b.h / 2);
      const n = p.clone().project(cam);
      corners.push([+n.x.toFixed(3), +n.y.toFixed(3), +(p.distanceTo(cam.position)).toFixed(2)]);
    }
    return { id: b.id, op: b.key ? (Ws[b.key] || 0) : 1, corners };
  });
};
window.TOTAL = TOTAL;
window.ready = true;
