import * as THREE from './lib/three.module.js';
import * as T0 from './toon.js';
import { alexCard, fxSpark } from './extras.js';
const T = { ...T0, alexCard, fxSpark };
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
  floor: texM(P.plaster(41, [196, 198, 200]), 8, 8, '#d8dade'), wall: texM(P.plaster(42, [214, 212, 204]), 6, 2, '#e6e3d8'),
  beam: texM(P.beam(43), 1, 2), beamDark: texM(P.beam(44, [52, 54, 58]), 1, 2),
  panel: texM(P.panelMetal(45, [150, 156, 164]), 1, 1, '#c2c8ce'),
};
const MW = {
  iron: toon({ color: '#3a3e44' }), steel: toon({ color: '#9aa2ac' }), white: toon({ color: '#f2f3f4' }),
  wood: toon({ color: '#8a6844' }), perch: toon({ color: '#7a5c3e' }),
  yellow: toon({ color: '#e8c33a' }), green: toon({ color: '#5d8a3c' }), red: toon({ color: '#b84a3a' }),
  shade: new THREE.MeshBasicMaterial({ color: 0x2a3040, transparent: true, opacity: 0.18, depthWrite: false }),
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

// ---------- the lab set ----------
const world = new THREE.Group(); scene.add(world);
{ // floor, back + side walls, ceiling with light panels
  add(tbox(16, 0.08, 12, 2), M.floor, 0, -0.04, 0.5, world, { cast: false });
  add(tbox(16, 3.6, 0.25, 2), M.wall, 0, 1.8, -3.4, world, { cast: false });
  add(tbox(0.25, 3.6, 12, 2), M.wall, -5.4, 1.8, 0.5, world, { cast: false });
  add(tbox(16, 0.18, 12, 2), M.wall, 0, 3.62, 0.5, world, { cast: false });
  for (const [px, pz] of [[-2.2, -0.8], [1.8, -0.8], [-2.2, 1.8], [1.8, 1.8]]) {
    const panel = add(new THREE.PlaneGeometry(1.7, 0.8), new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: true }), px, 3.52, pz, world, { cast: false });
    panel.rotation.x = Math.PI / 2; panel.userData.ndSkip = true;
  }
  // window with venetian blinds (left of back wall) + daylight glow
  const win = new THREE.Group(); win.position.set(-3.1, 1.95, -3.26); world.add(win);
  const glow = add(new THREE.PlaneGeometry(2.1, 2.3), new THREE.MeshBasicMaterial({ color: 0xcfe4f2, fog: true }), 0, 0, 0, win, { cast: false }); glow.userData.ndSkip = true; win.userData.glow = glow;
  for (let i = 0; i < 7; i++) { const slat = add(tbox(2.2, 0.07, 0.04, 2), MW.white, 0, 1.0 - i * 0.31, 0.05, win, { cast: false }); slat.rotation.x = 0.5; }
  add(tbox(2.3, 0.1, 0.1, 2), M.beamDark, 0, 1.2, 0.05, win, { cast: false });
  add(tbox(2.3, 0.1, 0.1, 2), M.beamDark, 0, -1.2, 0.05, win, { cast: false });
  // door (right end of back wall)
  add(tbox(1.0, 2.3, 0.08, 2), M.beam, 4.6, 1.15, -3.3, world, { cast: false });
  add(new THREE.SphereGeometry(0.045, 8, 7), MW.steel, 4.25, 1.15, -3.24, world, { cast: false });
  // shelves with jars/books (right wall depth)
  for (const sy of [1.1, 1.9]) {
    add(tbox(2.6, 0.06, 0.4, 2), M.beamDark, -5.2, sy, -0.6, world, { cast: false }).rotation.y = 0;
    const r = P.rng(sy * 10 | 0);
    for (let i = 0; i < 6; i++) { const bh = 0.3 + r() * 0.25; add(tbox(0.16, bh, 0.24, 2), toon({ color: ['#7a5a8a', '#4a6a8a', '#8a4a3a', '#5d7a35'][i % 4] }), -5.2 + 0, sy + bh / 2 + 0.03, -1.7 + i * 0.36, world, { cast: false }); }
  }
}
// Alex's T-perch, centre stage (bar top at y=1.52)
{
  const perch = new THREE.Group(); perch.position.set(0, 0, -0.7); world.add(perch);
  add(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 9), MW.iron, 0, 0.75, 0, perch, { cast: false });
  const bar = add(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 9), MW.perch, 0, 1.52, 0, perch, { cast: false }); bar.rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.3, 0.36, 0.06, 12), MW.iron, 0, 0.03, 0, perch, { cast: false });
  // a second lower play perch to the left
  const p2 = new THREE.Group(); p2.position.set(-1.9, 0, 0.4); world.add(p2);
  add(new THREE.CylinderGeometry(0.04, 0.06, 1.1, 8), MW.iron, 0, 0.55, 0, p2, { cast: false });
  const bar2 = add(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), MW.perch, 0, 1.12, 0, p2, { cast: false }); bar2.rotation.z = Math.PI / 2;
}
// his cage, back-left corner (home)
{
  const cage = new THREE.Group(); cage.position.set(-3.6, 0, -2.3); cage.rotation.y = 0.4; world.add(cage);
  const W2 = 1.5, H2 = 1.9, D2 = 1.1;
  for (const [ex, ez] of [[-W2 / 2, -D2 / 2], [W2 / 2, -D2 / 2], [-W2 / 2, D2 / 2], [W2 / 2, D2 / 2]]) add(new THREE.CylinderGeometry(0.03, 0.03, H2, 7), MW.steel, ex, H2 / 2, ez, cage, { cast: false });
  for (let i = 0; i <= 8; i++) { const barF = add(new THREE.CylinderGeometry(0.012, 0.012, H2, 5), MW.steel, -W2 / 2 + i * (W2 / 8), H2 / 2, D2 / 2, cage, { cast: false }); }
  for (let i = 0; i <= 4; i++) { const barH = add(new THREE.CylinderGeometry(0.012, 0.012, W2, 5), MW.steel, 0, 0.3 + i * 0.4, D2 / 2, cage, { cast: false }); barH.rotation.z = Math.PI / 2; }
  add(tbox(W2 + 0.1, 0.05, D2 + 0.1, 2), M.panel, 0, H2 + 0.02, 0, cage, { cast: false });
  const barIn = add(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8), MW.perch, 0, 1.25, 0, cage, { cast: false }); barIn.rotation.z = Math.PI / 2;
}
// the lesson tray table + test objects (banana, key, corn, cup)
const trayG = new THREE.Group(); trayG.position.set(1.45, 0, 0.1); trayG.rotation.y = -0.25; world.add(trayG);
{
  add(tbox(1.5, 0.06, 0.9, 2), M.panel, 0, 0.78, 0, trayG, { cast: false });
  for (const [lx, lz] of [[-0.65, -0.35], [0.65, -0.35], [-0.65, 0.35], [0.65, 0.35]]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.78, 7), MW.iron, lx, 0.39, lz, trayG, { cast: false });
  const banana = add(new THREE.TorusGeometry(0.16, 0.05, 8, 14, 2.2), MW.yellow, -0.42, 0.86, 0.1, trayG, { cast: false }); banana.rotation.set(0.4, 0.3, 1.2);
  const corn = add(new THREE.CylinderGeometry(0.06, 0.075, 0.3, 10), MW.yellow, 0.05, 0.9, -0.15, trayG, { cast: false }); corn.rotation.z = Math.PI / 2 - 0.2;
  add(tbox(0.2, 0.03, 0.07, 2), MW.steel, 0.38, 0.83, 0.18, trayG, { cast: false }); // key blank
  add(new THREE.TorusGeometry(0.055, 0.016, 6, 12), MW.steel, 0.24, 0.84, 0.18, trayG, { cast: false }).rotation.x = Math.PI / 2; // key bow
  const cup = add(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 11, 1, true), toon({ color: '#4a7a9a', side: THREE.DoubleSide }), -0.05, 0.9, 0.22, trayG, { cast: false }); cup.userData.ndSkip = true;
}
// ---- the whiteboard carries the lesson boards ----
const wb = new THREE.Group(); wb.position.set(-0.9, 0, -3.24); world.add(wb);
{
  add(tbox(1.45, 1.0, 0.06, 2), MW.white, 0, 1.75, -0.04, wb, { cast: false });
  add(tbox(1.55, 0.07, 0.09, 2), M.beamDark, 0, 2.28, -0.04, wb, { cast: false });
  add(tbox(1.55, 0.07, 0.09, 2), M.beamDark, 0, 1.22, -0.04, wb, { cast: false });
}
const boardMeshes = {};
{
  const defs = {
    words: [['100+ WORDS', 'BY NAME'], '#f4f6f8', '#37455c'],
    different: [['SAME ?', 'DIFFERENT ?'], '#f4f6f8', '#8a3a3a'],
  };
  for (const [id, [lines, bg, fg]] of Object.entries(defs)) {
    const b = textBoard(lines, 1.3, 0.85, bg, fg); b.position.set(0, 1.75, 0); wb.add(b); boardMeshes[id] = b;
  }
}
// ---- finale: a small framed memorial on the desk by the window ----
const deskF = new THREE.Group(); deskF.position.set(-2.4, 0, 0.9); deskF.rotation.y = 0.55; world.add(deskF);
{
  add(tbox(1.6, 0.06, 0.8, 2), M.beam, 0, 0.74, 0, deskF, { cast: false });
  for (const [lx, lz] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) add(new THREE.CylinderGeometry(0.035, 0.035, 0.74, 7), M.beamDark, lx, 0.37, lz, deskF, { cast: false });
  const b = textBoard(['ALEX', '1977 — 2007'], 0.85, 0.55, '#3c3428', '#ffd98a'); b.position.set(0, 1.12, -0.1); b.rotation.x = -0.16; deskF.add(b); boardMeshes.finale = b;
  add(tbox(0.95, 0.64, 0.04, 2), M.beamDark, 0, 1.12, -0.13, deskF, { cast: false }).rotation.x = -0.16;
}
// desk lamp (the last-night beat burns warm)
const lampGlow = FX.glint(0.85); lampGlow.position.set(-2.15, 1.06, 0.75); lampGlow.userData.ndSkip = true; world.add(lampGlow);
{
  const arm = add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), MW.iron, -2.2, 0.95, 0.72, world, { cast: false }); arm.rotation.z = 0.5;
  add(new THREE.ConeGeometry(0.11, 0.14, 10, 1, true), MW.iron, -2.12, 1.1, 0.74, world, { cast: false });
}

// ---------- FX: kept minimal for an interior (rates default 0) ----------
const smoke = new FX.Smoke(scene, 10); smoke.pool.forEach((p) => { p.s.userData.ndSkip = true; p.s.visible = false; });
const dust = smoke.addEmitter(0, 3, -10, { rate: 0 });
const fxClouds = new FX.Clouds(scene, { count: 2, y: 80, opacity: 0.0, color: 0xffffff, drift: 0 });
fxClouds.items.forEach((cl) => { cl.userData.x0 = cl.position.x; cl.traverse((m) => { m.userData.ndSkip = true; m.visible = false; }); });
let fxF = -1;
const fxStepTo = (f) => { fxF = f; };

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('30,32,44', 0.6));
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
  setB(boardMeshes.words, Ws.boardWords || 0); setB(boardMeshes.different, Ws.boardDifferent || 0); setB(boardMeshes.finale, Ws.boardFinale || 0);
  lampGlow.material.opacity = (Ws.lampT || 0) * (0.6 + 0.15 * Math.sin(f * 0.3));
  trayG.visible = (Ws.trayT ?? 1) > 0.01;
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
