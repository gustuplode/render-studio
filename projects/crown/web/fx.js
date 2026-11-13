// ============================================================
// fx.js — Coded FX Library v3 (2026-11-12) for render-studio three.js webs — v3 DETAIL KIT appended at the end of this file
// (objects from real parts: gold ingots, detailed locomotive, ship, rocket, v3 materials)
// v2: Clouds rebuilt (speckle + moon-rim + parallax + internal drift) and NEW modules:
// Beam (volumetric light cone), Rain (layered, beam-lit), Lightning (exposure choreography),
// applyRim/rimMaterial (fresnel rim light), Ambience (dust/fireflies), clothWave2 (gusts).
// Smoke · Clouds/Mist · Water · Splash · Wake · Glass · Crates/Barrels · Fire · Cloth · Muzzle flash
// Import:  import * as FX from './fx.js'   (project index.html must map "three" -> ./lib/three.module.js)
// Every effect is FRAME-DRIVEN: call its update(t, dt) once per frame from the shot's onFrame.
// Perf budget (GitHub runner, software GL): total live sprites <= 400, water plane <= 110x110 segs, <= 2 dynamic lights.
// ============================================================
import * as THREE from 'three';

// ---------- shared soft-puff texture (soft edge is MANDATORY — hard circles read as cheap) ----------
const _texCache = {};
export function puffTexture(stops) {
  const key = stops || 'white';
  if (_texCache[key]) return _texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  if (stops === 'fire') {
    grad.addColorStop(0, 'rgba(255,240,190,1)');
    grad.addColorStop(0.35, 'rgba(255,170,60,0.9)');
    grad.addColorStop(0.7, 'rgba(230,80,20,0.45)');
    grad.addColorStop(1, 'rgba(120,20,0,0)');
  } else {
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  // break the perfect circle: erase a few soft bites
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 5; i++) {
    const x = 20 + Math.random() * 88, y = 20 + Math.random() * 88, r = 12 + Math.random() * 20;
    const b = g.createRadialGradient(x, y, 1, x, y, r);
    b.addColorStop(0, 'rgba(0,0,0,0.25)'); b.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = b; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  _texCache[key] = t; return t;
}
function puffSprite(color, opacity, blending) {
  const m = new THREE.SpriteMaterial({ map: puffTexture(), color, transparent: true, opacity: 0, depthWrite: false, blending: blending || THREE.NormalBlending });
  const s = new THREE.Sprite(m); s.visible = false; return s;
}
const rnd = (a, b) => a + Math.random() * (b - a);

// ============================================================
// SMOKE — pooled sprites. burst() for cannon/explosions, emitter for chimneys/burning ships.
// Puffs rise, expand, rotate slowly, fade in fast and out slow. Color: grey ramp by param.
// ============================================================
export class Smoke {
  constructor(scene, max = 130) {
    this.pool = [];
    for (let i = 0; i < max; i++) { const s = puffSprite(0x888888, 0); scene.add(s); this.pool.push({ s, life: -1 }); }
    this.emitters = [];
  }
  spawn(x, y, z, o = {}) {
    const p = this.pool.find(p => p.life < 0); if (!p) return;
    p.life = 0; p.max = o.life || rnd(1.6, 2.8);
    p.s.visible = true;
    p.s.position.set(x + rnd(-.3, .3), y + rnd(-.2, .2), z + rnd(-.3, .3));
    p.vx = (o.vx || 0) + rnd(-.35, .35); p.vy = (o.vy !== undefined ? o.vy : rnd(1.1, 2.0)); p.vz = (o.vz || 0) + rnd(-.35, .35);
    p.wind = o.wind || 0.55;
    p.s0 = o.scale || rnd(1.2, 2.0); p.grow = o.grow || rnd(1.6, 2.6);
    p.op = o.opacity || 0.5;
    p.s.material.color.set(o.color || 0x9a9a9a);
    p.s.material.rotation = rnd(0, 6.28); p.rot = rnd(-.25, .25);
    p.s.scale.setScalar(p.s0);
  }
  burst(x, y, z, o = {}) { const n = o.n || 14; for (let i = 0; i < n; i++) this.spawn(x, y, z, o); }
  addEmitter(x, y, z, o = {}) { const e = { x, y, z, rate: o.rate || 6, acc: 0, o, on: true }; this.emitters.push(e); return e; }
  update(t, dt) {
    for (const e of this.emitters) {
      if (!e.on) continue;
      e.acc += dt * e.rate;
      while (e.acc >= 1) { e.acc -= 1; this.spawn(e.x, e.y, e.z, e.o); }
    }
    for (const p of this.pool) {
      if (p.life < 0) continue;
      p.life += dt;
      const u = p.life / p.max;
      if (u >= 1) { p.life = -1; p.s.visible = false; p.s.material.opacity = 0; continue; }
      p.vy *= (1 - 0.25 * dt);                       // buoyancy eases off
      p.s.position.x += (p.vx + p.wind * u) * dt;    // wind takes over as it ages
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      p.s.scale.setScalar(p.s0 + p.grow * u * 2.2);
      p.s.material.rotation += p.rot * dt;
      p.s.material.opacity = p.op * Math.min(1, u / 0.12) * (1 - Math.pow(Math.max(0, (u - 0.35) / 0.65), 1.6));
    }
  }
}

// ============================================================
// CLOUDS + SEA MIST — v2 (2026-11-12): layered volumetric-feel puffs.
// Speckled texture (bright/dark grain), a RIM crescent sprite behind each puff offset toward
// the light (moon rims — the reference look that beat flat clouds), slow INTERNAL drift so a
// cloud breathes instead of sliding as one rigid billboard, and parallax: near clusters
// (z -> -25) drift faster than far ones (z -> -70). Opts: count, y, opacity, color, drift,
// rim (colour or false), rimDir [x,y], shadow (soft shading sprite under each cluster).
// ============================================================
export function cloudTexture(variant = 0) {
  const key = 'cloud' + variant;
  if (_texCache[key]) return _texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  let seed = variant * 7919 + 131;
  const srnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 16; i++) { // overlapping soft blobs = lumpy body, never a perfect disc
    const x = 40 + srnd() * 176, y = 88 + srnd() * 80, r = 26 + srnd() * 46;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.20)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 700; i++) { // speckle grain — sparkle in moonlight, pits in shadow
    const x = srnd() * 256, y = srnd() * 256, r = srnd() * 1.6 + 0.4;
    g.fillStyle = srnd() < 0.62 ? 'rgba(255,255,255,0.16)' : 'rgba(20,28,52,0.13)';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalCompositeOperation = 'destination-out'; // soft outer falloff — edges never show the square
  const m = g.createRadialGradient(128, 128, 58, 128, 128, 128);
  m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = m; g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  _texCache[key] = t; return t;
}
function cloudSprite(color, opacity, variant) {
  const m = new THREE.SpriteMaterial({ map: cloudTexture(variant), color, transparent: true, opacity, depthWrite: false });
  const s = new THREE.Sprite(m); s.visible = false; return s;
}
export class Clouds {
  constructor(scene, o = {}) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.items = [];
    const n = o.count || 12;
    const rimCol = o.rim === false ? null : (o.rim || 0xdfe9f5);
    const rimDir = o.rimDir || [-0.35, 0.3]; // toward the light source (default: moon, upper left)
    for (let i = 0; i < n; i++) {
      const cl = new THREE.Group();
      cl.userData.puffs = [];
      const puffs = 4 + Math.floor(Math.random() * 4);
      for (let j = 0; j < puffs; j++) {
        const variant = Math.floor(Math.random() * 3);
        const baseOp = (o.opacity || 0.85) * rnd(0.6, 1);
        const pg = new THREE.Group(); // one puff group: rim crescent + body drift together
        pg.position.set(rnd(-7, 7), rnd(-1.2, 1.2), rnd(-2, 2));
        pg.userData.base = pg.position.clone();
        pg.userData.ph = rnd(0, 6.28);
        if (rimCol) {
          const r = cloudSprite(rimCol, baseOp * 0.8, variant);
          r.visible = true;
          r.position.set(rimDir[0] * 1.7, rimDir[1] * 1.15, -0.1);
          r.scale.set(rnd(10, 18.5), rnd(3.8, 6.1), 1);
          r.renderOrder = 1;
          pg.add(r);
        }
        const s = cloudSprite(o.color || 0xffffff, baseOp, variant);
        s.visible = true;
        s.scale.set(rnd(9, 17), rnd(3.4, 5.5), 1);
        s.renderOrder = 2;
        pg.add(s);
        cl.add(pg); cl.userData.puffs.push(pg);
      }
      if (o.shadow) { // soft shading mass under the cluster — depth cue, never a hard shadow
        const sh = cloudSprite(0x141c30, 0.16, 1);
        sh.visible = true; sh.position.set(0, -3.4, 0.5); sh.scale.set(21, 5, 1); sh.renderOrder = 0;
        cl.add(sh);
      }
      const z = rnd(-70, -25);
      cl.position.set(rnd(-90, 90), o.y !== undefined ? o.y + rnd(-4, 4) : rnd(24, 40), z);
      const depthK = 1.15 - ((z + 70) / 45) * 0.55; // parallax: nearer layers drift faster
      cl.userData.speed = rnd(0.14, 0.4) * (o.drift || 1) * depthK;
      this.group.add(cl); this.items.push(cl);
    }
  }
  update(t, dt) {
    for (const cl of this.items) {
      cl.position.x += cl.userData.speed * dt;
      if (cl.position.x > 110) cl.position.x = -110;
      for (const pg of cl.userData.puffs) { // slow internal drift — the cloud reshapes as it travels
        const b = pg.userData.base, ph = pg.userData.ph;
        pg.position.x = b.x + Math.sin(t * 0.07 + ph) * 1.1;
        pg.position.y = b.y + Math.sin(t * 0.05 + ph * 1.7) * 0.45;
      }
    }
  }
}
export function mistBand(scene, o = {}) {
  const g = new THREE.Group();
  const n = o.count || 9;
  for (let i = 0; i < n; i++) {
    const s = puffSprite(0xeef2f5, o.opacity || 0.16);
    s.visible = true;
    s.position.set(rnd(-70, 70), (o.y || 1.6) + rnd(-0.7, 0.7), rnd(-55, 5));
    s.scale.set(rnd(26, 46), rnd(3, 5.5), 1);
    g.add(s);
  }
  scene.add(g); return g;
}

// ============================================================
// WATER — shader plane: 3 layered sine swells, fresnel sky tint, foam on crests.
// Pair with a big flat deep-colour base plane 1.5m below so edges never show void.
// ============================================================
export function makeWater(o = {}) {
  const size = o.size || 400, seg = o.seg || 100;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  const mat = new THREE.ShaderMaterial({
    transparent: false, fog: false,
    uniforms: {
      uT: { value: 0 },
      uDeep: { value: new THREE.Color(o.deep || 0x14425e) },
      uShallow: { value: new THREE.Color(o.shallow || 0x2e7ea6) },
      uSky: { value: new THREE.Color(o.sky || 0xbfe3f2) },
      uSun: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() },
      uAmp: { value: o.amp || 0.55 },
    },
    vertexShader: `
      uniform float uT; uniform float uAmp; varying float vH; varying vec3 vWp; varying vec3 vN;
      float wheight(vec2 p){
        float h = 0.0;
        h += sin(p.x*0.11 + uT*1.15) * 0.45;
        h += sin(p.y*0.16 - uT*0.85) * 0.32;
        h += sin((p.x+p.y)*0.055 + uT*0.5) * 0.55;
        return h * uAmp;
      }
      void main(){
        vec3 pos = position;
        vec4 wp = modelMatrix * vec4(pos,1.0);
        float h = wheight(wp.xz);
        float e = 1.4;
        float hx = wheight(wp.xz + vec2(e,0.0)) - h;
        float hz = wheight(wp.xz + vec2(0.0,e)) - h;
        wp.y += h;
        vH = h; vWp = wp.xyz; vN = normalize(vec3(-hx/e, 1.0, -hz/e));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSun;
      varying float vH; varying vec3 vWp; varying vec3 vN;
      void main(){
        vec3 V = normalize(cameraPosition - vWp);
        float fres = pow(1.0 - max(dot(V, vN), 0.0), 2.0);
        float k = smoothstep(-0.55, 0.75, vH);
        vec3 col = mix(uDeep, uShallow, k);
        col = mix(col, uSky, fres * 0.55);
        float spec = pow(max(dot(reflect(-uSun, vN), V), 0.0), 60.0);
        col += spec * 0.55;
        float foam = smoothstep(0.62, 0.8, vH) * 0.5;
        col = mix(col, vec3(0.95), foam);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.userData.update = (t) => { mat.uniforms.uT.value = t; };
  return m;
}

// ============================================================
// SPLASH — white water burst (cannonballs, impacts). Points with gravity.
// ============================================================
export class Splashes {
  constructor(scene, max = 300) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.life = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const m = new THREE.PointsMaterial({ size: 0.55, map: puffTexture(), color: 0xf4fbff, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; scene.add(this.points);
    this.head = 0; this.life.fill(-1);
  }
  burst(x, y, z, o = {}) {
    const n = o.n || 26, power = o.power || 5;
    for (let i = 0; i < n; i++) {
      const k = this.head; this.head = (this.head + 1) % this.max;
      this.pos[k * 3] = x + rnd(-.4, .4); this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z + rnd(-.4, .4);
      const a = rnd(0, 6.28), r = rnd(0.2, 1) * power * 0.32;
      this.vel[k * 3] = Math.cos(a) * r; this.vel[k * 3 + 1] = rnd(0.55, 1) * power; this.vel[k * 3 + 2] = Math.sin(a) * r;
      this.life[k] = rnd(0.5, 0.95);
    }
  }
  update(t, dt) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] < 0) { this.pos[k * 3 + 1] = -999; continue; }
      this.life[k] -= dt;
      this.vel[k * 3 + 1] -= 12.5 * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt;
      this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt;
      this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      if (this.pos[k * 3 + 1] < 0) this.life[k] = -1;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// ============================================================
// WAKE — expanding fading foam rings + a foam trail sprite behind a moving ship.
// ============================================================
export class Wake {
  constructor(scene, max = 40) {
    this.pool = [];
    const geo = new THREE.RingGeometry(0.8, 1.0, 26);
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.visible = false; m.position.y = 0.12; scene.add(m);
      this.pool.push({ m, life: -1 });
    }
    this.acc = 0;
  }
  drop(x, z, scale = 1) {
    const p = this.pool.find(p => p.life < 0); if (!p) return;
    p.life = 0; p.max = 2.4; p.s0 = scale;
    p.m.visible = true; p.m.position.x = x; p.m.position.z = z;
  }
  trail(x, z, dt, scale = 1) { this.acc += dt; if (this.acc > 0.16) { this.acc = 0; this.drop(x, z, scale); } }
  update(t, dt) {
    for (const p of this.pool) {
      if (p.life < 0) continue;
      p.life += dt; const u = p.life / p.max;
      if (u >= 1) { p.life = -1; p.m.visible = false; continue; }
      const s = p.s0 * (1 + u * 3.2); p.m.scale.set(s, s, 1);
      p.m.material.opacity = 0.4 * (1 - u);
    }
  }
}

// ============================================================
// GLASS — phong transparent + glint sprite. Bottles, lantern glass, cabin windows, spyglass lens.
// ============================================================
export function glassMat(color = 0x9fd8e8, opacity = 0.34) {
  return new THREE.MeshPhongMaterial({ color, transparent: true, opacity, shininess: 160, specular: 0xcfeaff, depthWrite: false });
}
export function glint(scale = 1.4) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.5)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(30, 2, 4, 60); g.fillRect(2, 30, 60, 4);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(scale); return s;
}
export function bottle(o = {}) {
  // classic message bottle: body + shoulder + neck + cork + paper scroll inside
  const grp = new THREE.Group();
  const gm = glassMat(o.color || 0x7fc46a, 0.45);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 1.05, 14), gm); body.position.y = 0.52; grp.add(body);
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), gm); shoulder.position.y = 1.05; shoulder.scale.y = 0.75; grp.add(shoulder);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.5, 12), gm); neck.position.y = 1.42; grp.add(neck);
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 10), new THREE.MeshLambertMaterial({ color: 0xc9a86a })); cork.position.y = 1.68; grp.add(cork);
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 10), new THREE.MeshLambertMaterial({ color: 0xf5ead0 })); paper.position.y = 0.55; grp.add(paper);
  const gl = glint(0.8); gl.position.set(0.18, 0.8, 0.3); grp.add(gl);
  grp.userData.glint = gl;
  return grp;
}

// ============================================================
// WOOD + CRATES + BARRELS (dibbe) — procedural plank texture, framed crates, banded barrels.
// ============================================================
let _woodTex = null;
export function woodTexture(base = '#8a6844', dark = '#6d5136') {
  if (_woodTex) return _woodTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) {
    g.fillStyle = r % 2 ? base : '#93744e'; g.fillRect(0, r * 64, 256, 64);
    g.fillStyle = dark; g.fillRect(0, r * 64, 256, 5);
    for (let i = 0; i < 26; i++) { // grain streaks
      g.strokeStyle = `rgba(70,50,28,${rnd(0.05, 0.16)})`; g.lineWidth = rnd(1, 2.4);
      const y = r * 64 + rnd(8, 58); g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(80, y + rnd(-4, 4), 170, y + rnd(-4, 4), 256, y); g.stroke();
    }
  }
  _woodTex = new THREE.CanvasTexture(c); _woodTex.colorSpace = THREE.SRGBColorSpace; return _woodTex;
}
export function crate(size = 1.6) {
  const grp = new THREE.Group();
  const tex = woodTexture();
  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshLambertMaterial({ map: tex }));
  grp.add(box);
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x5f4630 });
  const t = size * 0.09, L = size * 1.02;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(t, L, t), frameMat);
    e.position.set(sx * size / 2, 0, sy * size / 2); grp.add(e);
    const e2 = new THREE.Mesh(new THREE.BoxGeometry(L, t, t), frameMat);
    e2.position.set(0, sy * size / 2, sx * size / 2); grp.add(e2);
  }
  return grp;
}
export function barrel(r = 0.62, h = 1.5) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, h, 14), new THREE.MeshLambertMaterial({ map: woodTexture() }));
  body.scale.set(1, 1, 1); grp.add(body);
  const bulge = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshLambertMaterial({ map: woodTexture() }));
  bulge.scale.y = h / (2 * r) * 0.92; grp.add(bulge);
  const bandMat = new THREE.MeshLambertMaterial({ color: 0x2e2e33 });
  for (const yy of [-h * 0.32, 0, h * 0.32]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, 0.045, 8, 22), bandMat);
    band.rotation.x = Math.PI / 2; band.position.y = yy; grp.add(band);
  }
  return grp;
}

// ============================================================
// FIRE — additive puff pool, fast rise + shrink + flicker. Optional point light (max 2 per scene).
// ============================================================
export class Fire {
  constructor(scene, o = {}) {
    this.pool = [];
    const max = o.max || 40;
    for (let i = 0; i < max; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture('fire'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false; scene.add(s); this.pool.push({ s, life: -1 });
    }
    this.x = o.x || 0; this.y = o.y || 0; this.z = o.z || 0;
    this.scale = o.scale || 1; this.rate = o.rate || 22; this.acc = 0; this.on = true;
    if (o.light) { this.light = new THREE.PointLight(0xff8c3a, 60, 30, 1.6); this.light.position.set(this.x, this.y + 1.5, this.z); scene.add(this.light); }
  }
  update(t, dt) {
    if (this.on) {
      this.acc += dt * this.rate;
      while (this.acc >= 1) {
        this.acc -= 1;
        const p = this.pool.find(p => p.life < 0); if (!p) break;
        p.life = 0; p.max = rnd(0.5, 0.95);
        p.s.visible = true;
        p.s.position.set(this.x + rnd(-.5, .5) * this.scale, this.y, this.z + rnd(-.5, .5) * this.scale);
        p.s0 = rnd(1.2, 2.1) * this.scale; p.s.scale.setScalar(p.s0);
      }
    }
    for (const p of this.pool) {
      if (p.life < 0) continue;
      p.life += dt; const u = p.life / p.max;
      if (u >= 1) { p.life = -1; p.s.visible = false; p.s.material.opacity = 0; continue; }
      p.s.position.y += dt * 3.4 * this.scale;
      p.s.position.x += Math.sin(t * 9 + p.max * 40) * dt * 0.5;
      p.s.scale.setScalar(p.s0 * (1 - u * 0.75));
      p.s.material.opacity = 0.85 * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
    }
    if (this.light) this.light.intensity = 55 + Math.sin(t * 23) * 12 + Math.sin(t * 41) * 8;
  }
}

// ============================================================
// CLOTH — flags & sails: displace plane vertices with a travelling sine, anchored at the hoist edge.
// Call clothInit(mesh) once (stores base positions), then clothWave(mesh, t) per frame.
// ============================================================
export function clothInit(mesh, o = {}) {
  mesh.userData.base = mesh.geometry.attributes.position.array.slice();
  mesh.userData.amp = o.amp || 0.22; mesh.userData.freq = o.freq || 2.6; mesh.userData.speed = o.speed || 6;
  return mesh;
}
export function clothWave(mesh, t) {
  const pos = mesh.geometry.attributes.position, base = mesh.userData.base;
  if (!base) return;
  const w = mesh.geometry.parameters ? mesh.geometry.parameters.width : 3;
  for (let i = 0; i < pos.count; i++) {
    const bx = base[i * 3], by = base[i * 3 + 1];
    const k = (bx + w / 2) / w; // 0 at hoist, 1 at fly end
    pos.array[i * 3 + 2] = Math.sin(bx * mesh.userData.freq + t * mesh.userData.speed) * mesh.userData.amp * k
      + Math.sin(by * 3.1 + t * mesh.userData.speed * 0.7) * mesh.userData.amp * 0.3 * k;
  }
  pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
}

// ============================================================
// MUZZLE FLASH — additive pop sprite + optional shared point light pulse.
// ============================================================
export class Muzzle {
  constructor(scene, light) {
    this.s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture('fire'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0 }));
    this.s.visible = false; scene.add(this.s);
    this.light = light || null; this.t0 = -9;
  }
  pop(x, y, z, t, scale = 3.2) {
    this.s.position.set(x, y, z); this.t0 = t; this.sc = scale; this.s.visible = true;
    if (this.light) { this.light.position.set(x, y, z); this.light.intensity = 90; }
  }
  update(t) {
    const u = (t - this.t0) / 0.14;
    if (u < 0 || u > 1) { this.s.visible = false; if (this.light) this.light.intensity = 0; return; }
    this.s.scale.setScalar(this.sc * (0.5 + u));
    this.s.material.opacity = 0.95 * (1 - u);
    if (this.light) this.light.intensity = 90 * (1 - u);
  }
}

// ============================================================
// v2 NEW MODULES (2026-11-12) — built on the LIGHTHOUSE LESSONS: light in rain/mist has
// NO hard edges; brightness lives at the source and fades with distance; nothing pops in
// one frame; everything the light touches reacts.
// ============================================================

// ---------- round lens flare texture: soft core + halo ring (never a hard disc) ----------
export function flareTexture() {
  if (_texCache.flare) return _texCache.flare;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 1, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.20)'; g.lineWidth = 3;   // the round flare ring
  g.beginPath(); g.arc(64, 64, 38, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.09)'; g.lineWidth = 6;
  g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(c);
  _texCache.flare = t; return t;
}

// ============================================================
// BEAM — volumetric light cone (lighthouse, lantern, searchlight, headlight).
// A shader cone, NOT a flat triangle: brightest at the source, fades with distance,
// soft side falloff (fresnel), drifting density CLUMPS (uneven rain/mist), and a
// FORWARD-SCATTER gain — brighter when the beam points toward the camera, dimmer away.
// Backlit support: aim it AWAY from camera behind a subject and the subject reads as a
// silhouette against the glow (pair with applyRim for the edge light).
//   const beam = new FX.Beam(scene, { from: V3, dir: V3, length: 30, radius: 2.4, color: 0xffe2ae });
//   beam.point(dirV3); beam.setIntensity(0..1); beam.update(t, dt, camera) every frame.
// ============================================================
export class Beam {
  constructor(scene, o = {}) {
    this.len = o.length || 26;
    this.rad = o.radius || 2.4;
    this.intensity = o.intensity !== undefined ? o.intensity : 1;
    this.group = new THREE.Group(); scene.add(this.group);
    const geo = new THREE.ConeGeometry(this.rad, this.len, 24, 1, true);
    geo.translate(0, -this.len / 2, 0); // apex (source) at group origin, cone opens along -Y
    this.uniforms = {
      uT: { value: 0 }, uI: { value: this.intensity },
      uColor: { value: new THREE.Color(o.color || 0xffe2ae) },
      uLen: { value: this.len }, uForward: { value: 0.5 },
      uClump: { value: o.clump !== undefined ? o.clump : 0.5 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: this.uniforms,
      vertexShader: `
        varying vec3 vN; varying vec3 vWp; varying float vAx; uniform float uLen;
        void main(){
          vAx = clamp(-position.y / uLen, 0.0, 1.0);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWp = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        varying vec3 vN; varying vec3 vWp; varying float vAx;
        uniform float uT; uniform float uI; uniform vec3 uColor; uniform float uForward; uniform float uClump;
        void main(){
          vec3 V = normalize(cameraPosition - vWp);
          float f = abs(dot(normalize(vN), V));
          float edge = smoothstep(0.02, 0.75, f);              // soft sides — no hard wedge edge
          float axial = pow(1.0 - vAx, 1.7);                   // brightest at the lens, fades away
          float cl = 1.0 + uClump * 0.55 * sin(vWp.x * 0.55 + uT * 0.6) * sin(vWp.y * 0.9 - uT * 0.45) * sin(vWp.z * 0.7 + uT * 0.5)
                        + uClump * 0.30 * sin(vWp.x * 1.7 - uT * 0.9) * sin(vWp.z * 1.3 + uT * 0.8); // drifting clumps
          float gain = mix(0.5, 1.6, uForward);                // forward scatter
          float a = axial * edge * cl * gain * uI * 0.55;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.group.add(this.mesh);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture(), color: o.color || 0xffe2ae, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.scale.setScalar(this.rad * 3.4);
    this.group.add(this.glow);
    if (o.from) this.group.position.copy(o.from);
    this.dir = (o.dir || new THREE.Vector3(1, 0, 0)).clone().normalize();
    this._applyDir();
  }
  _applyDir() { this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), this.dir); }
  point(dir) { this.dir.copy(dir).normalize(); this._applyDir(); }
  setIntensity(x) { this.intensity = x; }
  update(t, dt, camera) {
    this.uniforms.uT.value = t;
    this.uniforms.uI.value = this.intensity;
    this.glow.material.opacity = (0.3 + 0.65 * this.intensity) * (0.92 + 0.08 * Math.sin(t * 7.3));
    if (camera) { // forward scatter: beam travelling toward the viewer scatters brighter
      const toCam = camera.position.clone().sub(this.group.position).normalize();
      this.uniforms.uForward.value = THREE.MathUtils.clamp(0.5 + 0.5 * this.dir.dot(toCam), 0, 1);
    }
  }
}

// ============================================================
// RAIN — layered 3D drops: ~30% NEAR (thick, fast) + ~70% FAR (thin, slow), slight wind
// slant, fades at the wrap seam. Drops BRIGHTEN only inside a light cone — call
// setBeam(origin, dir, halfDeg, boost) from a Beam/lantern; everywhere else they stay dim.
//   const rain = new FX.Rain(scene, { count: 800 });
//   rain.setBeam(beam.group.position, beam.dir, 7, 1.8); rain.update(t) every frame.
// ============================================================
export class Rain {
  constructor(scene, o = {}) {
    this.count = o.count || 700;
    this.area = o.area || 90; this.height = o.height || 42;
    this.cx = o.cx || 0; this.cz = o.cz || 0;
    const pos = new Float32Array(this.count * 3), spd = new Float32Array(this.count), siz = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      pos[i * 3] = this.cx + rnd(-this.area / 2, this.area / 2);
      pos[i * 3 + 1] = rnd(0, this.height);
      pos[i * 3 + 2] = this.cz + rnd(-this.area / 2, this.area / 2);
      const near = Math.random() < 0.3;
      spd[i] = near ? rnd(26, 34) : rnd(13, 20);       // near drops fall faster
      siz[i] = near ? rnd(2.4, 3.4) : rnd(1.1, 1.8);   // ...and read thicker
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    this.uniforms = {
      uT: { value: 0 }, uH: { value: this.height }, uY0: { value: o.y || 0 },
      uColor: { value: new THREE.Color(o.color || 0xaebfd8) }, uOpacity: { value: o.opacity || 0.78 },
      uBeamOrg: { value: new THREE.Vector3(0, -99, 0) }, uBeamDir: { value: new THREE.Vector3(0, 1, 0) },
      uBeamCos: { value: 2 }, uBoost: { value: 1.6 }, uSlant: { value: o.slant !== undefined ? o.slant : 0.16 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: this.uniforms,
      vertexShader: `
        attribute float aSpeed; attribute float aSize;
        uniform float uT; uniform float uH; uniform float uY0; uniform float uSlant;
        uniform vec3 uBeamOrg; uniform vec3 uBeamDir; uniform float uBeamCos; uniform float uBoost;
        varying float vB;
        void main(){
          float fall = mod(position.y - uT * aSpeed, uH);
          vec3 pos = vec3(position.x - (uH - fall) * uSlant * 0.14, uY0 + fall, position.z);
          float seam = smoothstep(0.0, 2.5, fall) * smoothstep(uH, uH - 2.5, fall);
          vec3 rel = pos - uBeamOrg;
          float c = dot(normalize(rel), uBeamDir);
          float inBeam = smoothstep(uBeamCos, uBeamCos + 0.01, c) * exp(-length(rel) * 0.012);
          vB = (0.45 + uBoost * inBeam) * seam;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = aSize * (150.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; varying float vB;
        void main(){
          float ax = abs(gl_PointCoord.x - 0.5);
          float streak = smoothstep(0.5, 0.06, ax) * smoothstep(0.0, 0.3, gl_PointCoord.y) * smoothstep(1.0, 0.7, gl_PointCoord.y);
          gl_FragColor = vec4(uColor * (0.65 + 0.7 * vB), streak * vB * uOpacity);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  setBeam(origin, dir, halfDeg = 7, boost = 1.6) {
    this.uniforms.uBeamOrg.value.copy(origin);
    this.uniforms.uBeamDir.value.copy(dir).normalize();
    this.uniforms.uBeamCos.value = Math.cos(halfDeg * Math.PI / 180);
    this.uniforms.uBoost.value = boost;
  }
  clearBeam() { this.uniforms.uBeamCos.value = 2; }
  update(t) { this.uniforms.uT.value = t; }
}

// ============================================================
// LIGHTNING — flash with EXPOSURE CHOREOGRAPHY (never a one-frame pop):
// the scene DIMS ~30% over the 0.3s BEFORE the hit, the flash BUILDS over ~8 frames
// (0.27s) with a flicker, peaks, then RECOVERS over ~10 frames (0.33s).
// Drives renderer.toneMappingExposure + any lights passed in. Optional jagged bolt line.
//   const bolt = new FX.Lightning({ renderer, lights: [hemi], scene, from: V3, to: V3 });
//   bolt.strike(tHit);  // schedule the HIT time; update(t) every frame returns the multiplier.
// ============================================================
export class Lightning {
  constructor(o = {}) {
    this.renderer = o.renderer || null;
    this.lights = o.lights || [];
    this.baseI = this.lights.map(l => l.intensity);
    this.baseE = this.renderer ? this.renderer.toneMappingExposure : 1;
    this.tHit = -1e9; this.power = 1;
    this._a = o.from || new THREE.Vector3(-30, 38, -60);
    this._b = o.to || new THREE.Vector3(-24, 4, -60);
    this.bolt = null;
    if (o.scene) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(15 * 3), 3));
      this.bolt = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.bolt.frustumCulled = false;
      o.scene.add(this.bolt);
      this._jag();
    }
  }
  _jag() { // regenerate the jagged bolt path between _a and _b
    if (!this.bolt) return;
    const pos = this.bolt.geometry.attributes.position.array, N = 15;
    let off = 0;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      off += rnd(-1.6, 1.6) * (i === 0 || i === N - 1 ? 0 : 1);
      pos[i * 3] = this._a.x + (this._b.x - this._a.x) * u + off;
      pos[i * 3 + 1] = this._a.y + (this._b.y - this._a.y) * u;
      pos[i * 3 + 2] = this._a.z + (this._b.z - this._a.z) * u + rnd(-0.8, 0.8);
    }
    this.bolt.geometry.attributes.position.needsUpdate = true;
  }
  strike(t, power = 1) { this.tHit = t; this.power = power; this._jag(); }
  update(t) {
    const d = t - this.tHit, P = 0.30 + 1.9 * this.power; // peak multiplier
    let m = 1;
    if (d > -0.30 && d < 0) m = 1 - 0.30 * ((d + 0.30) / 0.30);                    // anticipate: dim first
    else if (d >= 0 && d < 0.27) { const u = d / 0.27, s = u * u * (3 - 2 * u); m = 0.70 + (P - 0.70) * s * (0.88 + 0.12 * Math.sin(d * 140)); } // build ~8f
    else if (d >= 0.27 && d < 0.60) { const u = (d - 0.27) / 0.33, s = u * u * (3 - 2 * u); m = P + (1 - P) * s; }                               // recover ~10f
    if (this.renderer) this.renderer.toneMappingExposure = this.baseE * m;
    this.lights.forEach((l, i) => { l.intensity = this.baseI[i] * (0.75 + 0.25 * Math.min(m, 1.8)); });
    if (this.bolt) this.bolt.material.opacity = (d >= 0 && d < 0.45) ? 0.9 * (1 - d / 0.45) * Math.min(1, m) : 0;
    return m;
  }
}

// ============================================================
// RIM LIGHT — fresnel shell for meshes: a slightly larger BackSide copy that glows at
// the silhouette edges. Warm (lantern side) or cool (moon side). For canvas CARD
// characters, use the face/body v2 rim stroke in toon.js instead.
//   FX.applyRim(mesh, { color: 0xffd9a0, power: 2.4, strength: 1.2, scale: 1.045 });
// ============================================================
export function rimMaterial(color = 0xffd9a0, power = 2.4, strength = 1.2) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uP: { value: power }, uS: { value: strength } },
    vertexShader: `
      varying vec3 vN; varying vec3 vWp;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vWp; uniform vec3 uC; uniform float uP; uniform float uS;
      void main(){ vec3 V = normalize(cameraPosition - vWp); float r = pow(1.0 - abs(dot(normalize(vN), V)), uP); gl_FragColor = vec4(uC, r * uS); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  });
}
export function applyRim(mesh, o = {}) {
  const s = new THREE.Mesh(mesh.geometry, rimMaterial(o.color, o.power, o.strength));
  s.scale.setScalar(o.scale || 1.045);
  mesh.add(s);
  return s;
}

// ============================================================
// AMBIENCE — floating ambient particles. mode 'dust': soft slow motes (daylight shafts,
// archives, cabins). mode 'fireflies': additive warm dots that wander and PULSE
// (never steady — a constant dot reads as a dead pixel). Points, not sprites: cheap.
//   const amb = new FX.Ambience(scene, { mode: 'fireflies', count: 90, area: 50 });
//   amb.update(t) every frame.
// ============================================================
export class Ambience {
  constructor(scene, o = {}) {
    this.mode = o.mode || 'dust';
    const count = o.count || 120, area = o.area || 60, h = o.height || 22;
    const pos = new Float32Array(count * 3), ph = new Float32Array(count), siz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (o.cx || 0) + rnd(-area / 2, area / 2);
      pos[i * 3 + 1] = rnd(0.5, h);
      pos[i * 3 + 2] = (o.cz || 0) + rnd(-area / 2, area / 2);
      ph[i] = rnd(0, 40); siz[i] = this.mode === 'fireflies' ? rnd(1.6, 2.8) : rnd(1.0, 2.2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    this.uniforms = {
      uT: { value: 0 },
      uColor: { value: new THREE.Color(o.color || (this.mode === 'fireflies' ? 0xffca7a : 0xf5ead0)) },
      uFire: { value: this.mode === 'fireflies' ? 1 : 0 },
      uOpacity: { value: o.opacity || (this.mode === 'fireflies' ? 0.9 : 0.35) },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: this.mode === 'fireflies' ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: this.uniforms,
      vertexShader: `
        attribute float aPhase; attribute float aSize;
        uniform float uT; uniform float uFire; varying float vP;
        void main(){
          vec3 pos = position + vec3(sin(uT * 0.30 + aPhase) * 1.3, sin(uT * 0.23 + aPhase * 1.7) * 0.8, cos(uT * 0.27 + aPhase) * 1.3);
          float pulse = 0.5 + 0.5 * sin(uT * (0.6 + fract(aPhase) * 0.7) + aPhase * 7.0);
          vP = uFire > 0.5 ? 0.15 + 0.85 * pow(pulse, 3.0) : 0.55 + 0.3 * sin(uT * 0.8 + aPhase);
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = aSize * (110.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; varying float vP;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d) * vP * uOpacity;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  update(t) { this.uniforms.uT.value = t; }
}

// ============================================================
// CLOTH v2 — same anchoring as clothWave, but the wave is driven by GUSTS (envelope of
// slow sines: calm, swell, calm) with a per-vertex phase wobble — never a uniform
// mechanical wave. gustFn(t) may supply the envelope (see M.gust in motion.js).
// ============================================================
export function clothWave2(mesh, t, gustFn) {
  const pos = mesh.geometry.attributes.position, base = mesh.userData.base;
  if (!base) return;
  const w = mesh.geometry.parameters ? mesh.geometry.parameters.width : 3;
  const env = gustFn ? gustFn(t) : 0.45 + 0.30 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1.7) + 0.25 * Math.sin(t * 2.3);
  const amp = mesh.userData.amp * (0.35 + Math.max(0, env));
  for (let i = 0; i < pos.count; i++) {
    const bx = base[i * 3], by = base[i * 3 + 1];
    const k = (bx + w / 2) / w;
    pos.array[i * 3 + 2] = Math.sin(bx * mesh.userData.freq + t * mesh.userData.speed + by * 1.3) * amp * k
      + Math.sin(by * 3.1 + bx * 2.2 + t * mesh.userData.speed * 0.7) * amp * 0.35 * k;
  }
  pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
}

// ============================================================
// DETAIL KIT v3 (2026-11-12) — OBJECTS ARE BUILT FROM THEIR REAL PARTS.
// Abid's locked DETAIL STANDARD: a ship must read as a ship, a rocket as a
// rocket, a gold bar as a CAST INGOT — never a flat glowing block. Every
// material carries multi-stop shading + a light-reactive sheen; metals get a
// PMREM environment (detailEnv) so the sheen band MOVES as the camera moves —
// that motion is what makes metal read as metal. Stamps, labels, rivets and
// panel lines wherever the real object has them. Flat emissive colour for a
// metal is BANNED; sparkle lives only as tiny glints on edges.
// ============================================================
const _d3cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return [c, c.getContext('2d')]; };
const _d3tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const _d3rng = seed => { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const _d3std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1, ...o });
function _d3put(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }

// ---------- environment for metals: a tiny gradient room with one bright strip.
// PMREM it once per renderer and hand the texture to gold/steel materials —
// their specular band then sits opposite the "strip" and slides across the
// surface when the shot moves. Without an env, metalness:1 reads as black.
let _envTex = null;
export function detailEnv(renderer) {
  if (_envTex) return _envTex;
  const [c, g] = _d3cv(512, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#8a7c5e'); gr.addColorStop(0.42, '#57493a'); gr.addColorStop(0.55, '#33291f'); gr.addColorStop(1, '#171310');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#fff6e0'; g.fillRect(140, 18, 230, 46);            // key strip (the sheen source)
  g.fillStyle = 'rgba(255,176,92,0.95)'; g.fillRect(16, 104, 120, 96); // big warm lantern bounce (low faces/ground glow)
  g.fillStyle = 'rgba(255,214,140,0.55)'; g.fillRect(330, 150, 120, 70); // second warm pool
  g.fillStyle = 'rgba(150,180,255,0.38)'; g.fillRect(438, 92, 46, 84); // cool fill
  const tex = _d3tex(c); tex.mapping = THREE.EquirectangularReflectionMapping;
  const es = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
  es.add(dome);
  const pm = new THREE.PMREMGenerator(renderer);
  _envTex = pm.fromScene(es, 0.04).texture;
  pm.dispose(); return _envTex;
}

// ---------- brushed metal: streaks + panel seams + rivets + optional rust ----------
export function metalTexture(o = {}) {
  const { base = '#79838e', seed = 5, panels = 3, rivets = true, rust = 0.18 } = o;
  const key = 'metal' + base + seed + panels + rivets + rust;
  if (_texCache[key]) return _texCache[key];
  const [c, g] = _d3cv(512), r = _d3rng(seed * 131 + 7);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const bh = parseInt(base.slice(1, 3), 16), bs2 = parseInt(base.slice(3, 5), 16), bb = parseInt(base.slice(5, 7), 16);
  const tone = (dl, a) => `rgba(${Math.max(0, Math.min(255, bh + dl))},${Math.max(0, Math.min(255, bs2 + dl))},${Math.max(0, Math.min(255, bb + dl))},${a})`;
  for (let i = 0; i < 900; i++) { // brushing: fine vertical streaks, uneven lightness
    const x = r() * 512; g.strokeStyle = tone((r() - 0.5) * 46, 0.10 + r() * 0.12); g.lineWidth = 1 + r() * 1.6;
    g.beginPath(); g.moveTo(x, r() * 90); g.lineTo(x + (r() - 0.5) * 5, 512 - r() * 90); g.stroke();
  }
  for (let i = 0; i < 26; i++) { g.fillStyle = tone((r() - 0.5) * 30, 0.10); g.beginPath(); g.ellipse(r() * 512, r() * 512, 24 + r() * 70, 14 + r() * 40, r() * 3, 0, 7); g.fill(); } // handling blotches
  const seam = []; for (let i = 1; i < panels; i++) seam.push(Math.round(i * 512 / panels + (r() - 0.5) * 30));
  for (const x of [0, ...seam, 511]) { // panel seams: dark groove + lit lip under it
    g.fillStyle = 'rgba(8,10,14,0.85)'; g.fillRect(x - 2, 0, 4, 512);
    g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(x + 2, 0, 2, 512);
    if (rivets) for (let y = 14; y < 512; y += 34) { // rivet dots marching along the seam
      g.fillStyle = 'rgba(10,12,16,0.55)'; g.beginPath(); g.arc(x + 11, y + 1.5, 4.4, 0, 7); g.fill();
      g.fillStyle = tone(52, 0.95); g.beginPath(); g.arc(x + 10, y, 4, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x + 8.6, y - 1.4, 1.5, 0, 7); g.fill();
    }
  }
  g.fillStyle = 'rgba(8,10,14,0.8)'; g.fillRect(0, 0, 512, 4); g.fillRect(0, 508, 512, 4); // edge seams
  for (let i = 0; i < 46 * rust; i++) { // rust bloom: orange-brown, heavier near seams/bottom
    const x = r() * 512, y = 300 + r() * 212, rad = 4 + r() * 20;
    const rg = g.createRadialGradient(x, y, 1, x, y, rad);
    rg.addColorStop(0, `rgba(122,66,30,${0.25 + r() * 0.3})`); rg.addColorStop(1, 'rgba(122,66,30,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  const t = _d3tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; _texCache[key] = t; return t;
}

// ---------- gold: ONE atlas — left half brushed sides, right half the stamped top.
// Used by goldBarGeometry's UVs so a whole ingot (and an InstancedMesh of 280)
// needs a single material. The colour lives in the texture; metalness does the rest.
export function goldAtlasTexture(o = {}) {
  const { seed = 3 } = o; const key = 'goldatlas' + seed;
  if (_texCache[key]) return _texCache[key];
  const [c, g] = _d3cv(512, 256), r = _d3rng(seed * 977 + 13);
  // sides (0..256): cast gold — warm gradient + horizontal casting flow lines
  let gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#c08c26'); gr.addColorStop(0.3, '#e6b84e'); gr.addColorStop(0.55, '#d5a539'); gr.addColorStop(1, '#a3741f');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 130; i++) { const y = r() * 256; g.strokeStyle = `rgba(${r() < 0.5 ? '255,230,150' : '120,80,20'},${0.05 + r() * 0.1})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + r() * 5 - 2, 170, y - r() * 5 + 2, 256, y); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,58,14,${0.05 + r() * 0.09})`; g.beginPath(); g.ellipse(r() * 256, r() * 256, 3 + r() * 12, 2 + r() * 6, r() * 3, 0, 7); g.fill(); } // casting pits
  // top (256..512): richer face, bevel shading toward the rim
  gr = g.createLinearGradient(256, 0, 512, 256);
  gr.addColorStop(0, '#e8bc52'); gr.addColorStop(0.5, '#d4a437'); gr.addColorStop(1, '#b08224');
  g.fillStyle = gr; g.fillRect(256, 0, 256, 256);
  for (let i = 0; i < 90; i++) { const x = 256 + r() * 256; g.strokeStyle = `rgba(${r() < 0.5 ? '255,236,160' : '130,88,22'},${0.05 + r() * 0.08})`; g.lineWidth = 1 + r() * 1.6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + r() * 8 - 4, 256); g.stroke(); }
  g.strokeStyle = 'rgba(96,62,14,0.55)'; g.lineWidth = 10; g.strokeRect(261, 5, 246, 246);   // bevel shadow line
  g.strokeStyle = 'rgba(255,240,180,0.5)'; g.lineWidth = 3; g.strokeRect(268, 12, 232, 232); // bevel lit lip
  const t = _d3tex(c); _texCache[key] = t; return t;
}

// ---------- hero stamp face: embossed emblem + weight marks (for close-up bars) ----------
export function goldStampTexture(o = {}) {
  const { main = '999,9', sub = 'FEINGOLD', seed = 3 } = o; const key = 'goldstamp' + main + sub;
  if (_texCache[key]) return _texCache[key];
  const [c, g] = _d3cv(256), r = _d3rng(seed * 331 + 5);
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, '#ecc45c'); gr.addColorStop(0.5, '#d8ab3c'); gr.addColorStop(1, '#bb8c28');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { const y = r() * 256; g.strokeStyle = `rgba(255,238,170,${0.04 + r() * 0.06})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + r() * 6 - 3); g.stroke(); }
  const emboss = (draw, dx, dy, style) => { g.save(); g.translate(dx, dy); g.fillStyle = style; g.strokeStyle = style; draw(); g.restore(); };
  const art = () => { // double ring + mint star + the two text lines
    g.lineWidth = 5; g.beginPath(); g.arc(128, 96, 56, 0, 7); g.stroke();
    g.lineWidth = 2.4; g.beginPath(); g.arc(128, 96, 47, 0, 7); g.stroke();
    g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); const x = 128 + Math.cos(a) * 26, y = 96 + Math.sin(a) * 26; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 44px DejaVu Sans, sans-serif'; g.fillText(main, 128, 182);
    g.font = '700 21px DejaVu Sans, sans-serif'; g.fillText(sub, 128, 220);
  };
  emboss(art, 0, 2.2, 'rgba(96,62,12,0.85)');   // groove (dark, low)
  emboss(art, 0, -1.2, 'rgba(255,242,190,0.75)'); // lit lip (light, high) — reads as stamped relief
  const t = _d3tex(c); _texCache[key] = t; return t;
}

// ---------- ashlar stone wall: varied courses, per-block light, deep mortar ----------
export function stoneWallTexture(o = {}) {
  const { seed = 8, courses = 6, hue = 36, sat = 13, lig = 56 } = o; const key = `stonewall${seed}${courses}${lig}`;
  if (_texCache[key]) return _texCache[key];
  const [c, g] = _d3cv(512), r = _d3rng(seed * 613 + 3);
  g.fillStyle = '#3c362e'; g.fillRect(0, 0, 512, 512); // mortar
  let y = 0;
  for (let row = 0; row < courses; row++) {
    const bh = 512 / courses * (0.85 + r() * 0.3), off = (row % 2) * 70;
    for (let x = -70 + off; x < 512; x += 90 + r() * 60) {
      const bw = 84 + r() * 56, L = lig - 8 + r() * 16, H = hue + r() * 10 - 5;
      g.fillStyle = `hsl(${H},${sat}%,${L}%)`; g.beginPath(); g.roundRect(x + 3, y + 3, bw - 6, bh - 6, 5); g.fill();
      g.fillStyle = `hsla(${H},${sat}%,${L + 9}%,0.65)`; g.fillRect(x + 7, y + 5, bw - 16, 5);      // top bevel light
      g.fillStyle = `hsla(${H},${sat}%,${L - 13}%,0.55)`; g.fillRect(x + 7, y + bh - 11, bw - 16, 5); // bottom shade
      for (let k = 0; k < 7; k++) { g.fillStyle = `hsla(${H},${sat}%,${L - 10 - r() * 8}%,0.5)`; g.beginPath(); g.ellipse(x + r() * bw, y + r() * bh, 2 + r() * 5, 1 + r() * 3, 0, 0, 7); g.fill(); }
      if (r() < 0.16) { g.strokeStyle = `hsla(${H},${sat}%,${L - 20}%,0.7)`; g.lineWidth = 1.4; g.beginPath(); let cx = x + 12 + r() * (bw - 24), cy = y + 4; g.moveTo(cx, cy); while (cy < y + bh - 4) { cx += r() * 10 - 5; cy += 8 + r() * 8; g.lineTo(cx, cy); } g.stroke(); } // hairline crack
    }
    y += 512 / courses;
  }
  const t = _d3tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; _texCache[key] = t; return t;
}

// ---------- coal: near-black facets with hard little glints (never a smooth blob) ----------
export function coalTexture(o = {}) {
  const { seed = 9 } = o; const key = 'coal' + seed;
  if (_texCache[key]) return _texCache[key];
  const [c, g] = _d3cv(256), r = _d3rng(seed * 271 + 11);
  g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 210; i++) {
    const x = r() * 256, y = r() * 256, rad = 4 + r() * 13, L = 6 + r() * 16;
    g.fillStyle = `hsl(${220 + r() * 20},${8 + r() * 10}%,${L}%)`;
    g.beginPath(); const n = 5 + (r() * 3 | 0); for (let k = 0; k < n; k++) { const a = k / n * 6.29 + r(); const px = x + Math.cos(a) * rad * (0.6 + r() * 0.5), py = y + Math.sin(a) * rad * (0.6 + r() * 0.5); k ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fill();
    if (r() < 0.4) { g.fillStyle = `rgba(200,215,235,${0.25 + r() * 0.4})`; g.beginPath(); g.ellipse(x - rad * 0.25, y - rad * 0.25, rad * 0.3, rad * 0.16, r() * 3, 0, 7); g.fill(); } // facet glint
  }
  const t = _d3tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; _texCache[key] = t; return t;
}

// ---------- wood grain v3: wavy grain, knots, plank seams, nail heads ----------
export function grainTexture(o = {}) {
  const { base = '#8a6844', dark = '#5f4630', seed = 4, planks = 5, nails = true } = o;
  const key = `grain${base}${seed}${planks}${nails}`;
  if (_texCache[key]) return _texCache[key];
  const [c, g] = _d3cv(512), r = _d3rng(seed * 457 + 9);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const ph = 512 / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph, L = (r() - 0.5) * 10;
    g.fillStyle = `rgba(${L > 0 ? '255,235,200' : '20,10,4'},${Math.abs(L) / 90})`; g.fillRect(0, y0, 512, ph);
    for (let i = 0; i < 30; i++) { // wavy grain lines
      const y = y0 + 4 + r() * (ph - 8); g.strokeStyle = `rgba(52,34,16,${0.10 + r() * 0.16})`; g.lineWidth = 0.8 + r() * 1.6;
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(150, y + r() * 6 - 3, 340, y - r() * 6 + 3, 512, y + r() * 4 - 2); g.stroke();
    }
    if (r() < 0.75) { const kx = 40 + r() * 430, ky = y0 + ph * (0.3 + r() * 0.4); for (let k = 5; k > 0; k--) { g.strokeStyle = `rgba(46,28,12,${0.16 + (5 - k) * 0.08})`; g.lineWidth = 1.6; g.beginPath(); g.ellipse(kx, ky, k * 3.4, k * 2.1, 0.3, 0, 7); g.stroke(); } } // knot
    g.fillStyle = dark; g.fillRect(0, y0 + ph - 3, 512, 3); // seam
    g.fillStyle = 'rgba(255,240,210,0.20)'; g.fillRect(0, y0, 512, 2);
    if (nails) for (const nx of [14, 498]) { g.fillStyle = '#26221e'; g.beginPath(); g.arc(nx, y0 + ph / 2, 4.4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(nx - 1.4, y0 + ph / 2 - 1.4, 1.5, 0, 7); g.fill(); }
  }
  const t = _d3tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; _texCache[key] = t; return t;
}

// ---------- sail cloth: seam bands, stitch dashes, a patched corner ----------
export function sailTexture(o = {}) {
  const { seed = 6, tint = '#e6dcc4' } = o; const key = 'sail' + seed + tint;
  if (_texCache[key]) return _texCache[key];
  const [c, g] = _d3cv(256, 512), r = _d3rng(seed * 173 + 21);
  g.fillStyle = tint; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(120,104,72,${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * 256, r() * 512, 6 + r() * 26, 4 + r() * 14, r() * 3, 0, 7); g.fill(); } // weather stains
  for (let y = 56; y < 512; y += 62) { // horizontal cloth seams + stitching
    g.fillStyle = 'rgba(96,82,58,0.5)'; g.fillRect(0, y, 256, 3);
    g.fillStyle = 'rgba(255,252,240,0.35)'; g.fillRect(0, y + 3, 256, 2);
    g.strokeStyle = 'rgba(80,66,44,0.65)'; g.lineWidth = 1.6; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(0, y + 8); g.lineTo(256, y + 8); g.stroke(); g.setLineDash([]);
  }
  const px = 26 + r() * 90, py = 300 + r() * 120; // patch
  g.fillStyle = 'rgba(196,182,148,0.95)'; g.fillRect(px, py, 62, 54);
  g.strokeStyle = 'rgba(80,66,44,0.8)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.strokeRect(px + 3, py + 3, 56, 48); g.setLineDash([]);
  const t = _d3tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; _texCache[key] = t; return t;
}

// ---------- small part helpers ----------
let _shadowTexC = null;
function _shadowTex() {
  if (_shadowTexC) return _shadowTexC;
  const [c, g] = _d3cv(128); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(12,10,6,0.5)'); gr.addColorStop(0.7, 'rgba(12,10,6,0.28)'); gr.addColorStop(1, 'rgba(12,10,6,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); _shadowTexC = _d3tex(c); return _shadowTexC;
}
// soft contact shadow — stacked/carried objects MUST sit on one, or they float.
export function contactShadow(w, d, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: _shadowTex(), transparent: true, opacity: o.opacity ?? 1, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = o.y ?? 0.02; m.renderOrder = 1; return m;
}
let _rivetGeo = null;
// rivets marching from a to b (arrays [x,y,z]) — boiler rims, cab corners, tender edges.
export function rivetLine(a, b, n, o = {}) {
  if (!_rivetGeo) _rivetGeo = new THREE.SphereGeometry(1, 6, 5);
  const grp = new THREE.Group(), mat = o.mat || _d3std({ color: 0x3a3f45, roughness: 0.45, metalness: 0.8 });
  for (let i = 0; i < n; i++) { const u = n === 1 ? 0 : i / (n - 1); const m = new THREE.Mesh(_rivetGeo, mat); m.scale.setScalar(o.size || 0.045); m.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u); grp.add(m); }
  return grp;
}
// rivets around a circle of radius r in the XY plane (rotate the group to face).
export function rivetCircle(r, n, o = {}) {
  const grp = new THREE.Group();
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const m = new THREE.Mesh(_rivetGeo || (_rivetGeo = new THREE.SphereGeometry(1, 6, 5)), o.mat || _d3std({ color: 0x3a3f45, roughness: 0.45, metalness: 0.8 })); m.scale.setScalar(o.size || 0.045); m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); grp.add(m); }
  return grp;
}
// a box with real bevelled edges (extruded rounded rect) — bevels catch a light
// line on every edge, which is half of what makes a prop read as "made", not "placed".
export function bevelBox(w, h, d, o = {}) {
  const b = Math.min(o.bevel ?? 0.045, w / 2 - 0.01, h / 2 - 0.01);
  const sh = new THREE.Shape(), x = -w / 2 + b, y = -h / 2 + b, x2 = w / 2 - b, y2 = h / 2 - b;
  sh.moveTo(x, -h / 2); sh.lineTo(x2, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, y); sh.lineTo(w / 2, y2); sh.quadraticCurveTo(w / 2, h / 2, x2, h / 2); sh.lineTo(x, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, y2); sh.lineTo(-w / 2, y); sh.quadraticCurveTo(-w / 2, -h / 2, x, -h / 2);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, d - b * 2), bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.9, bevelSegments: 2, steps: 1, curveSegments: 5 });
  geo.translate(0, 0, -d / 2 + b);
  const pos = geo.attributes.position, uv = geo.attributes.uv; // planar UV from the front — fine for grain/metal
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  const m = new THREE.Mesh(geo, o.mat || _d3std({ color: 0x8a8f96 }));
  if (o.x !== undefined) m.position.set(o.x, o.y || 0, o.z || 0);
  return m;
}
// worn stencil text on a transparent card — crates, wagon sides, consoles.
export function stencilLabel(text, o = {}) {
  const { w = 1.2, h = 0.42, fg = '#ded6c2', size = 120, seed = 8 } = o;
  const [c, g] = _d3cv(512, Math.round(512 * h / w)), r = _d3rng(seed * 97 + text.length);
  g.clearRect(0, 0, c.width, c.height);
  let fs = size; g.textAlign = 'center'; g.textBaseline = 'middle';
  const setF = () => { g.font = `900 ${fs}px 'DejaVu Sans', sans-serif`; }; setF();
  while (g.measureText(text).width > c.width * 0.92 && fs > 20) { fs -= 6; setF(); }
  g.fillStyle = fg; g.fillText(text, c.width / 2, c.height / 2);
  g.globalCompositeOperation = 'destination-out'; // paint wear: speckles eaten out of the letters
  for (let i = 0; i < 260 * (o.wear ?? 0.3); i++) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(r() * c.width, r() * c.height, 1 + r() * 3.4, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  const t = _d3tex(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.85, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1 }));
  return m;
}
// engraved number/name plate with screw heads — loco cabs, machines, doors.
export function numberPlate(text, o = {}) {
  const { w = 0.95, h = 0.34, bg = '#191b1f', fg = '#d9c88f' } = o;
  const grp = new THREE.Group();
  const plate = bevelBox(w, h, 0.05, { bevel: 0.02, mat: _d3std({ color: new THREE.Color(bg), roughness: 0.42, metalness: 0.7, envMap: o.envMap, envMapIntensity: 0.7 }) });
  grp.add(plate);
  const [c, g] = _d3cv(256, Math.round(256 * h / w));
  g.clearRect(0, 0, c.width, c.height); g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 92; const setF = () => { g.font = `900 ${fs}px 'DejaVu Sans', sans-serif`; }; setF();
  while (g.measureText(text).width > c.width * 0.86 && fs > 20) { fs -= 6; setF(); }
  g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillText(text, c.width / 2, c.height / 2 + 3);
  g.fillStyle = fg; g.fillText(text, c.width / 2, c.height / 2);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.9), new THREE.MeshBasicMaterial({ map: _d3tex(c), transparent: true }));
  face.position.z = 0.03; grp.add(face);
  const screwM = _d3std({ color: 0x777d84, roughness: 0.35, metalness: 0.9 });
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), screwM); s.position.set(sx * (w / 2 - 0.06), 0, 0.032); grp.add(s); }
  return grp;
}
// spoked wheel with hub + counterweight crescent — the crescent is what sells
// "driving wheel" at a glance. Rotate the returned group around Z to spin it.
export function spokedWheel(r, o = {}) {
  const grp = new THREE.Group(), thick = o.thick ?? r * 0.2;
  const mat = o.mat || _d3std({ color: 0x2b2e33, roughness: 0.42, metalness: 0.75, envMap: o.envMap, envMapIntensity: 0.7 });
  const hubM = o.hubMat || _d3std({ color: 0x9a7c34, roughness: 0.3, metalness: 1, envMap: o.envMap, envMapIntensity: 1 });
  const rim = _d3put(grp, new THREE.CylinderGeometry(r, r, thick, 22), mat); rim.geometry = rim.geometry.clone(); rim.geometry.rotateX(Math.PI / 2);
  const tyre = _d3put(grp, new THREE.TorusGeometry(r * 0.97, thick * 0.34, 8, 26), mat);
  const spokes = o.spokes ?? (r > 0.65 ? 7 : 5);
  for (let i = 0; i < spokes; i++) { const sp = _d3put(grp, new THREE.BoxGeometry(r * 1.86, r * 0.13, thick * 0.7), mat); sp.rotation.z = i * Math.PI / spokes; }
  const hub = _d3put(grp, new THREE.CylinderGeometry(r * 0.2, r * 0.2, thick * 1.5, 12), hubM); hub.geometry = hub.geometry.clone(); hub.geometry.rotateX(Math.PI / 2);
  if (o.counterweight !== false && r > 0.6) { // crescent mass opposite the crank pin
    const cw = _d3put(grp, new THREE.CircleGeometry(r * 0.66, 18, Math.PI * 0.72, Math.PI * 0.56), mat, -r * 0.3, 0, thick * 0.51);
    cw.material = mat;
  }
  const pin = _d3put(grp, new THREE.CylinderGeometry(r * 0.09, r * 0.09, thick * 2.1, 8), hubM, r * 0.52, 0, 0); pin.geometry = pin.geometry.clone(); pin.geometry.rotateX(Math.PI / 2);
  return grp;
}

// ============================================================
// GOLD — the headline fix. A real ingot is a TRAPEZOID: wide base, narrow top,
// bevelled edges, a stamped face. Geometry: 4 stacked rings (strong taper at
// the base, easing to the top pad) so the silhouette itself says "cast bar".
// ============================================================
export function goldBarGeometry(len = 0.92, h = 0.2, wb = 0.4, wt = 0.27) {
  const key = `gb${len}${h}${wb}${wt}`; if (_texCache[key]) return _texCache[key];
  const rings = [ // [y, halfLen, halfWid] — base flare, body, shoulder, top pad
    [-h / 2, len / 2, wb / 2], [-h * 0.18, len * 0.493, wb * 0.478],
    [h * 0.3, len * 0.452, wt * 0.535], [h / 2, len * 0.435, wt * 0.5]];
  const corner = (r, s) => [r[1] * (s === 0 || s === 3 ? 1 : -1), r[0], r[2] * (s < 2 ? 1 : -1)]; // s: 0:+x+z 1:-x+z 2:-x-z 3:+x-z
  const pos = [], uv = [], idx = [];
  const quad = (a, b, c, d, uvs) => { const s = pos.length / 3; pos.push(...a, ...b, ...c, ...d); uv.push(...uvs); idx.push(s, s + 2, s + 1, s, s + 3, s + 2); };
  let per = 0; const perOf = r => 4 * (r[1] + r[2]);
  for (let s = 0; s < 4; s++) { // sides, u walks the atlas' left half by perimeter
    for (let ri = 0; ri < 3; ri++) {
      const r0 = rings[ri], r1 = rings[ri + 1], a = corner(r0, s), b = corner(r0, (s + 1) % 4), c = corner(r1, (s + 1) % 4), d = corner(r1, s);
      const u0 = 0.01 + 0.48 * per / perOf(rings[0]), u1 = 0.01 + 0.48 * (per + 2 * (s % 2 ? r0[2] : r0[1])) / perOf(rings[0]);
      const v0 = 0.02 + 0.96 * (ri / 3), v1 = 0.02 + 0.96 * ((ri + 1) / 3);
      quad(a, b, c, d, [u0, v0, u1, v0, u1, v1, u0, v1]);
    }
    per += 2 * (s % 2 ? rings[0][2] : rings[0][1]);
  }
  const rt = rings[3]; // top cap → atlas right half (the stamped face region)
  quad(corner(rt, 0), corner(rt, 1), corner(rt, 2), corner(rt, 3), [0.99, 0.02, 0.51, 0.02, 0.51, 0.98, 0.99, 0.98]);
  const rb = rings[0]; // bottom cap → dark corner of the side region
  quad(corner(rb, 3), corner(rb, 2), corner(rb, 1), corner(rb, 0), [0.02, 0.02, 0.1, 0.02, 0.1, 0.1, 0.02, 0.1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  _texCache[key] = geo; return geo;
}
export function goldMaterial(o = {}) {
  return new THREE.MeshStandardMaterial({
    map: goldAtlasTexture(o), metalness: 0.92, roughness: o.rough ?? 0.32,
    envMap: o.envMap || null, envMapIntensity: o.intensity ?? 1.15,
  });
}
// one ingot. hero:true adds the crisp embossed stamp plate on the top face.
export function goldBar(o = {}) {
  const len = o.len ?? 0.92, h = o.h ?? 0.2, wb = o.wb ?? 0.4;
  const grp = new THREE.Group();
  const bar = new THREE.Mesh(goldBarGeometry(len, h, wb, o.wt ?? 0.27), o.mat || goldMaterial(o));
  grp.add(bar);
  if (o.hero) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.6, wb * 0.52), new THREE.MeshStandardMaterial({ map: goldStampTexture(o), metalness: 0.92, roughness: 0.28, envMap: o.envMap || null, envMapIntensity: (o.intensity ?? 1.15) * 1.1, polygonOffset: true, polygonOffsetFactor: -2 }));
    st.rotation.x = -Math.PI / 2; st.position.y = h / 2 + 0.002; grp.add(st);
  }
  grp.userData.bar = bar; return grp;
}
// a stacked pile: cross-stacked layers (each layer turned 90°), per-bar jitter,
// contact shadow underneath. plan = [[cols,rows], ...] from bottom to top.
export function goldPile(o = {}) {
  const grp = new THREE.Group(), r = _d3rng(o.seed ?? 17);
  const len = o.len ?? 0.92, h = o.h ?? 0.2, wb = o.wb ?? 0.4, mat = o.mat || goldMaterial(o);
  const plan = o.plan || [[3, 2], [3, 2], [2, 1], [1, 1]];
  plan.forEach(([cols, rows], li) => {
    const across = li % 2 === 0; // alternate stacking direction per layer, like real vaults
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const bar = new THREE.Mesh(goldBarGeometry(len, h, wb, o.wt ?? 0.27), mat);
      const along = (i - (cols - 1) / 2) * (wb * 1.06), side = (j - (rows - 1) / 2) * (len * 0.94);
      bar.position.set(across ? side : along, h / 2 + li * h * 0.94, across ? along : side);
      bar.rotation.y = (across ? 0 : Math.PI / 2) + (r() - 0.5) * 0.05;
      bar.rotation.z = (r() - 0.5) * 0.02;
      grp.add(bar);
    }
  });
  const top = plan.length * h;
  if (o.heroTop !== false && plan.length) { // one stamped hero bar crowning the pile
    const hero = goldBar({ len, h, wb, mat, hero: true, envMap: o.envMap, main: o.main, sub: o.sub });
    hero.position.y = top + h * 0.44; hero.rotation.y = (plan.length % 2 ? 0 : Math.PI / 2) + 0.12;
    grp.add(hero);
  }
  const cs = contactShadow((o.shadowW ?? len * 2.6), (o.shadowD ?? len * 2.2), { opacity: 0.85 });
  cs.position.y = 0.015; grp.add(cs);
  grp.userData.mat = mat; return grp;
}

// ---------- crates & barrels v3: grain texture, iron corner brackets, stencils ----------
export function crate3(size = 1.6, o = {}) {
  const grp = new THREE.Group();
  const wood = _d3std({ map: grainTexture({ seed: o.seed ?? 4, planks: 4 }), roughness: 0.95 });
  const box = bevelBox(size, size, size, { bevel: size * 0.03, mat: wood }); grp.add(box);
  const iron = _d3std({ color: 0x33373c, roughness: 0.5, metalness: 0.8, envMap: o.envMap, envMapIntensity: 0.5 });
  const t = size * 0.1;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { // corner brackets + edge straps
    const e = _d3put(grp, new THREE.BoxGeometry(t, size * 1.01, t), iron, sx * size / 2, 0, sy * size / 2); e.castShadow = false;
    _d3put(grp, new THREE.BoxGeometry(size * 1.01, t, t), iron, 0, sy * size / 2, sx * size / 2);
  }
  _d3put(grp, new THREE.BoxGeometry(size * 1.01, t * 0.8, t * 0.8), iron, 0, 0, size / 2); // middle strap, front
  _d3put(grp, new THREE.BoxGeometry(size * 1.01, t * 0.8, t * 0.8), iron, 0, 0, -size / 2);
  if (o.label) { const lb = stencilLabel(o.label, { w: size * 0.72, h: size * 0.3, seed: o.seed ?? 8 }); lb.position.set(0, size * 0.08, size / 2 + 0.012); grp.add(lb); }
  const cs = contactShadow(size * 1.5, size * 1.5, { opacity: 0.7 }); cs.position.y = -size / 2 + 0.015; grp.add(cs);
  return grp;
}
export function barrel3(r = 0.62, h = 1.5, o = {}) {
  const grp = new THREE.Group();
  const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(new THREE.Vector2(r * (0.86 + 0.16 * Math.sin(u * Math.PI)), -h / 2 + u * h)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), _d3std({ map: grainTexture({ seed: o.seed ?? 6, planks: 7 }), roughness: 0.95 }));
  body.material.map = body.material.map.clone(); body.material.map.repeat.set(3, 1); body.material.map.needsUpdate = true;
  grp.add(body);
  const iron = _d3std({ color: 0x2e3134, roughness: 0.48, metalness: 0.85, envMap: o.envMap, envMapIntensity: 0.6 });
  for (const u of [0.16, 0.5, 0.84]) { const rr = r * (0.86 + 0.16 * Math.sin(u * Math.PI)) + 0.012; const band = _d3put(grp, new THREE.TorusGeometry(rr, 0.028, 6, 22), iron, 0, -h / 2 + u * h, 0); band.rotation.x = Math.PI / 2; }
  const top = _d3put(grp, new THREE.CircleGeometry(r * 0.86, 16), _d3std({ map: grainTexture({ seed: (o.seed ?? 6) + 2, planks: 3 }), roughness: 0.95 }), 0, h / 2 - 0.01, 0); top.rotation.x = -Math.PI / 2;
  const cs = contactShadow(r * 3, r * 3, { opacity: 0.7 }); cs.position.y = -h / 2 + 0.015; grp.add(cs);
  return grp;
}

// ============================================================
// detailedLocomotive — boiler with bands + riveted smokebox door, flared
// chimney, steam + sand domes, whistle, handrails, running boards, cab with
// framed windows + number plates, spoked drivers with counterweights,
// coupling rods + piston cylinders, tender with a real coal heap.
// Front of the loco is +x (front face at x≈0.6); boiler centre y≈2.6.
// Returns { group, wheels:[{m,r}], rods:[{rod,cross}], boiler, lampPos } —
// rods carry their rest positions so callers animate them off the wheel angle.
// ============================================================
export function detailedLocomotive(o = {}) {
  const dark = !!o.dark, env = o.envMap || null;
  const grp = new THREE.Group(), wheels = [], rods = [];
  const steel = _d3std({ map: metalTexture({ base: dark ? '#22262c' : '#2f343a', seed: 7, panels: 4, rust: dark ? 0.05 : 0.22 }), roughness: 0.48, metalness: 0.78, envMap: env, envMapIntensity: 0.85 });
  const smokeM = _d3std({ map: metalTexture({ base: dark ? '#191c21' : '#22252a', seed: 11, panels: 2, rust: 0.1 }), roughness: 0.55, metalness: 0.7, envMap: env, envMapIntensity: 0.7 });
  const redM = _d3std({ map: metalTexture({ base: dark ? '#1d1a20' : '#6e2a24', seed: 13, panels: 3, rust: 0.3 }), roughness: 0.58, metalness: 0.5, envMap: env, envMapIntensity: 0.6 });
  const brass = _d3std({ color: dark ? 0x14161c : 0xc9a24d, roughness: 0.3, metalness: 1, envMap: env, envMapIntensity: 1.1 });
  const iron = _d3std({ color: dark ? 0x0c0e12 : 0x2b2e33, roughness: 0.45, metalness: 0.75, envMap: env, envMapIntensity: 0.6 });
  const wheelM = _d3std({ map: metalTexture({ base: dark ? '#14171c' : '#33373d', seed: 17, panels: 2, rust: 0.15 }), roughness: 0.42, metalness: 0.8, envMap: env, envMapIntensity: 0.7 });
  const B = (geo, mat, x, y, z, parent = grp) => _d3put(parent, geo, mat, x, y, z);
  // frame + buffer beam + buffers + coupling
  const frame = bevelBox(10.4, 0.5, 2.4, { bevel: 0.06, mat: redM }); frame.position.set(-5, 1.05, 0); grp.add(frame);
  B(new THREE.BoxGeometry(0.34, 0.72, 2.62), redM, 0.32, 1.1, 0);
  for (const sz of [-0.82, 0.82]) { const bf = B(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 10), iron, 0.6, 1.1, sz); bf.geometry.rotateZ(Math.PI / 2); const disc = B(new THREE.CylinderGeometry(0.21, 0.21, 0.09, 12), iron, 0.83, 1.1, sz); disc.geometry.rotateZ(Math.PI / 2); }
  B(new THREE.TorusGeometry(0.16, 0.045, 6, 12), iron, 0.55, 0.72, 0).rotation.x = 0.4; // coupling hook ring
  grp.add(rivetLine([0.14, 1.32, -1.1], [0.14, 1.32, 1.1], 9, { size: 0.04, mat: iron }));
  // boiler + bands + smokebox
  const boiler = B(new THREE.CylinderGeometry(1.05, 1.05, 6.4, 22), steel, -3.4, 2.6, 0); boiler.geometry.rotateZ(Math.PI / 2);
  for (const bx of [-1.7, -3.4, -5.1]) { const band = B(new THREE.CylinderGeometry(1.075, 1.075, 0.13, 22), dark ? iron : brass, bx, 2.6, 0); band.geometry.rotateZ(Math.PI / 2); }
  const sbox = B(new THREE.CylinderGeometry(1.12, 1.12, 0.85, 22), smokeM, -0.25, 2.6, 0); sbox.geometry.rotateZ(Math.PI / 2);
  const door = B(new THREE.CylinderGeometry(0.98, 0.98, 0.14, 22), smokeM, 0.24, 2.6, 0); door.geometry.rotateZ(Math.PI / 2);
  const doorRim = B(new THREE.TorusGeometry(0.98, 0.05, 8, 26), iron, 0.32, 2.6, 0); doorRim.rotation.y = Math.PI / 2;
  const doorRiv = rivetCircle(0.82, 14, { size: 0.042, mat: iron }); doorRiv.position.set(0.33, 2.6, 0); doorRiv.rotation.y = Math.PI / 2; grp.add(doorRiv);
  B(new THREE.BoxGeometry(0.1, 0.62, 0.11), iron, 0.36, 2.6, 0); B(new THREE.BoxGeometry(0.1, 0.11, 0.62), iron, 0.36, 2.6, 0); // door dart (cross handles)
  B(new THREE.BoxGeometry(0.16, 0.3, 0.08), iron, 0.3, 3.35, 0.5); B(new THREE.BoxGeometry(0.16, 0.3, 0.08), iron, 0.3, 1.85, -0.5); // hinges
  // chimney: flared base, stem, capped lip
  const chBase = B(new THREE.CylinderGeometry(0.34, 0.56, 0.55, 14), smokeM, -1.5, 3.85, 0);
  B(new THREE.CylinderGeometry(0.29, 0.33, 0.95, 14), smokeM, -1.5, 4.55, 0);
  const chCap = B(new THREE.CylinderGeometry(0.47, 0.36, 0.34, 14), smokeM, -1.5, 5.15, 0);
  B(new THREE.TorusGeometry(0.45, 0.045, 6, 16), iron, -1.5, 5.32, 0).rotation.x = Math.PI / 2;
  // domes + whistle + safety valve
  B(new THREE.CylinderGeometry(0.62, 0.68, 0.24, 16), steel, -3.6, 3.62, 0);
  const sdome = B(new THREE.SphereGeometry(0.56, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), brass, -3.6, 3.7, 0);
  B(new THREE.CylinderGeometry(0.44, 0.5, 0.2, 14), steel, -5.3, 3.6, 0);
  const sdome2 = B(new THREE.SphereGeometry(0.43, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2), steel, -5.3, 3.66, 0);
  for (const wz of [-0.14, 0.14]) B(new THREE.CylinderGeometry(0.045, 0.045, 0.52, 8), brass, -6.55, 3.85, wz);
  B(new THREE.CylinderGeometry(0.09, 0.11, 0.3, 8), brass, -6.2, 3.78, 0.3);
  // handrails + knobs + running boards
  for (const sz of [-1.07, 1.07]) {
    const rail = B(new THREE.CylinderGeometry(0.032, 0.032, 5.8, 6), brass, -3.3, 3.05, sz); rail.geometry.rotateZ(Math.PI / 2);
    for (const kx of [-5.9, -4.4, -2.9, -1.4]) B(new THREE.SphereGeometry(0.055, 8, 6), brass, kx, 3.05, sz * 0.99);
    B(new THREE.BoxGeometry(7.4, 0.07, 0.52), iron, -3.5, 1.98, sz * 1.18);
  }
  // cab: bevelled shell, framed windows (front pair + sides), roof overhang, plates
  const cab = bevelBox(2.6, 3.1, 2.7, { bevel: 0.07, mat: steel }); cab.position.set(-8.4, 2.75, 0); grp.add(cab);
  const winLit = new THREE.MeshBasicMaterial({ color: dark ? 0x0a0d14 : 0xffc37a });
  const winFrameM = iron;
  for (const wz of [-0.62, 0.62]) { // front spectacle windows (face +x)
    B(new THREE.BoxGeometry(0.06, 1.06, 1.06), winFrameM, -7.06, 3.35, wz);
    const gl = B(new THREE.PlaneGeometry(0.88, 0.88), winLit, -7.02, 3.35, wz); gl.rotation.y = Math.PI / 2;
  }
  for (const sz of [-1.36, 1.36]) { // side windows
    B(new THREE.BoxGeometry(1.06, 1.06, 0.06), winFrameM, -8.4, 3.35, sz);
    const gl = B(new THREE.PlaneGeometry(0.88, 0.88), winLit, -8.4, 3.35, sz + (sz > 0 ? 0.035 : -0.035)); if (sz < 0) gl.rotation.y = Math.PI;
    const plate = numberPlate(o.number || '44 205', { envMap: env }); plate.position.set(-8.4, 1.95, sz + (sz > 0 ? 0.03 : -0.03)); if (sz < 0) plate.rotation.y = Math.PI; grp.add(plate);
  }
  const roof = bevelBox(3.2, 0.2, 3.2, { bevel: 0.06, mat: redM }); roof.position.set(-8.4, 4.42, 0); grp.add(roof);
  B(new THREE.BoxGeometry(3.3, 0.09, 3.3), iron, -8.4, 4.28, 0);
  grp.add(rivetLine([-9.62, 1.35, 1.36], [-7.18, 1.35, 1.36], 8, { size: 0.038, mat: iron }));
  grp.add(rivetLine([-9.62, 1.35, -1.36], [-7.18, 1.35, -1.36], 8, { size: 0.038, mat: iron }));
  // wheels: 3 spoked drivers + rear pony wheel
  const addWheel = (x, z, r, big) => { const w = spokedWheel(r, { mat: wheelM, hubMat: brass, spokes: big ? 7 : 5, envMap: env }); w.position.set(x, r, z); grp.add(w); wheels.push({ m: w, r }); };
  for (const sz of [-1.15, 1.15]) { addWheel(-1.8, sz, 0.85, true); addWheel(-4.6, sz, 0.85, true); addWheel(-7.6, sz, 0.85, true); addWheel(-9.3, sz, 0.5, false); }
  // coupling rods + crossheads + piston cylinders (rest positions = caller's contract)
  if (!dark) for (const sz of [1.32, -1.32]) {
    const rod = B(new THREE.BoxGeometry(6.3, 0.13, 0.07), brass, -4.7, 0.85, sz);
    B(new THREE.BoxGeometry(6.5, 0.05, 0.05), iron, -4.7, 0.99, sz); // rod top edge line
    const cross = B(new THREE.BoxGeometry(0.5, 0.3, 0.09), wheelM, -1.0, 0.85, sz);
    const pist = B(new THREE.CylinderGeometry(0.31, 0.31, 1.45, 14), steel, -0.35, 0.85, sz * 0.92); pist.geometry.rotateZ(Math.PI / 2);
    const pcap = B(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 14), iron, 0.32, 0.85, sz * 0.92); pcap.geometry.rotateZ(Math.PI / 2);
    rods.push({ rod, cross });
  }
  // headlamp: bracket + brass housing + lens (caller hangs glow/Beam at lampPos)
  B(new THREE.BoxGeometry(0.3, 0.3, 0.12), iron, 0.1, 4.15, 0);
  const housing = B(new THREE.CylinderGeometry(0.33, 0.41, 0.52, 14), brass, 0.35, 3.6, 0); housing.geometry.rotateZ(Math.PI / 2);
  B(new THREE.TorusGeometry(0.3, 0.04, 6, 16), iron, 0.62, 3.6, 0).rotation.y = Math.PI / 2;
  const lens = B(new THREE.CircleGeometry(0.27, 14), new THREE.MeshBasicMaterial({ color: dark ? 0x0a0d14 : 0xffe2b0 }), 0.63, 3.6, 0); lens.rotation.y = Math.PI / 2;
  // tender: bevelled body, flared rim lip, heaped coal (faceted lumps, not a blob)
  const tender = bevelBox(4.6, 2.0, 2.5, { bevel: 0.06, mat: steel }); tender.position.set(-12.5, 2.0, 0); grp.add(tender);
  for (const [w2, d2, x2, z2] of [[4.95, 0.16, -12.5, 1.3], [4.95, 0.16, -12.5, -1.3], [0.16, 2.75, -14.85, 0], [0.16, 2.75, -10.15, 0]]) B(new THREE.BoxGeometry(w2, 0.22, d2), iron, x2, 3.06, z2);
  const coalM = _d3std({ map: coalTexture({ seed: 9 }), roughness: 0.5, metalness: 0.3, envMap: env, envMapIntensity: 0.9, color: dark ? 0x555a63 : 0xffffff });
  const crng = _d3rng(43);
  for (let i = 0; i < 15; i++) {
    const lump = B(new THREE.DodecahedronGeometry(0.3 + crng() * 0.24, 0), coalM, -14 + crng() * 3, 3.05 + crng() * 0.22, -0.8 + crng() * 1.6);
    lump.rotation.set(crng() * 3, crng() * 3, crng() * 3); lump.scale.y = 0.72;
  }
  for (const sz of [-1.15, 1.15]) { addWheel(-11, sz, 0.5, false); addWheel(-14, sz, 0.5, false); }
  grp.add(rivetLine([-14.6, 1.15, 1.26], [-10.4, 1.15, 1.26], 10, { size: 0.038, mat: iron }));
  grp.add(rivetLine([-14.6, 1.15, -1.26], [-10.4, 1.15, -1.26], 10, { size: 0.038, mat: iron }));
  return { group: grp, wheels, rods, boiler, lampPos: [0.63, 3.6, 0] };
}

// ============================================================
// ship — hull with plank lines + keel curve, tapered bow, deck, bulwarks,
// masts, seamed sails (cloth-ready), rigging lines, portholes with brass
// rims, railing, stern lantern, anchor. userData.sails for clothWave.
// ============================================================
export function ship(o = {}) {
  const grp = new THREE.Group(), L = o.len ?? 16, W = o.beam ?? 4.4, H = o.hull ?? 3.2;
  const env = o.envMap || null;
  const hullM = _d3std({ map: grainTexture({ seed: o.seed ?? 12, planks: 7, base: o.hullBase || '#6b4c2e', dark: '#453118' }), roughness: 0.9 });
  hullM.map = hullM.map.clone(); hullM.map.repeat.set(3, 1); hullM.map.needsUpdate = true;
  const sh = new THREE.Shape(); // side profile: stern → keel curve → raked bow → deck
  sh.moveTo(-L / 2, H * 0.62); sh.lineTo(-L / 2, H * 0.05);
  sh.quadraticCurveTo(-L * 0.2, -H * 0.38, L * 0.28, -H * 0.3);
  sh.quadraticCurveTo(L * 0.44, -H * 0.16, L / 2, H * 0.86); // bow sweeps up
  sh.lineTo(L * 0.46, H * 0.62); sh.lineTo(-L / 2, H * 0.62);
  const hgeo = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 10 });
  hgeo.translate(0, 0, -W / 2);
  { const p = hgeo.attributes.position, uvA = hgeo.attributes.uv; // taper: bow pinches, stern narrows a touch; planar UVs
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); const tb = THREE.MathUtils.smoothstep(x, L * 0.12, L * 0.52), ts = THREE.MathUtils.smoothstep(-x, L * 0.3, L * 0.52); p.setZ(i, p.getZ(i) * (1 - 0.82 * tb * tb) * (1 - 0.3 * ts * ts)); uvA.setXY(i, x / L + 0.5, p.getY(i) / H + 0.4); }
    hgeo.computeVertexNormals();
  }
  grp.add(new THREE.Mesh(hgeo, hullM));
  const deckM = _d3std({ map: grainTexture({ seed: (o.seed ?? 12) + 3, planks: 9 }), roughness: 0.95 });
  const deck = _d3put(grp, new THREE.BoxGeometry(L * 0.94, 0.14, W * 0.92), deckM, -L * 0.02, H * 0.62, 0);
  const trimM = _d3std({ color: 0x3e2c18, roughness: 0.9 });
  for (const sz of [-1, 1]) { // bulwark caps + railing (posts + top rail)
    _d3put(grp, new THREE.BoxGeometry(L * 0.9, 0.3, 0.12), trimM, -L * 0.03, H * 0.78, sz * W * 0.44);
    _d3put(grp, new THREE.BoxGeometry(L * 0.86, 0.07, 0.07), trimM, -L * 0.03, H * 1.14, sz * W * 0.44);
    for (let i = 0; i < 9; i++) _d3put(grp, new THREE.BoxGeometry(0.07, 0.42, 0.07), trimM, -L * 0.42 + i * L * 0.105, H * 0.96, sz * W * 0.44);
  }
  const brass = _d3std({ color: 0xb08d3e, roughness: 0.32, metalness: 1, envMap: env, envMapIntensity: 1 });
  for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) { // portholes: dark glass + brass rim
    const px = -L * 0.34 + i * L * 0.17;
    const rim = _d3put(grp, new THREE.TorusGeometry(0.21, 0.045, 6, 14), brass, px, H * 0.34, sz * (W / 2 + 0.01)); if (sz < 0) rim.rotation.y = Math.PI;
    const gl = _d3put(grp, new THREE.CircleGeometry(0.2, 14), new THREE.MeshBasicMaterial({ color: 0x0d1420 }), px, H * 0.34, sz * (W / 2 + 0.012)); if (sz < 0) gl.rotation.y = Math.PI;
  }
  const mastM = _d3std({ map: grainTexture({ seed: 21, planks: 3, base: '#7a5c38' }), roughness: 0.9 });
  const sails = [], rigPts = [];
  const mastXs = o.masts === 1 ? [0.5] : [-L * 0.18, L * 0.22];
  for (const mx of mastXs) {
    const mh = H * 2.6;
    _d3put(grp, new THREE.CylinderGeometry(0.1, 0.17, mh, 8), mastM, mx, H * 0.6 + mh / 2, 0);
    for (const fy of [0.55, 0.82]) { const yard = _d3put(grp, new THREE.CylinderGeometry(0.05, 0.05, W * 1.35 * fy + 1.4, 6), mastM, mx, H * 0.6 + mh * fy, 0); yard.geometry.rotateX(Math.PI / 2); }
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.24, mh * 0.34, 6, 4), new THREE.MeshStandardMaterial({ map: sailTexture({ seed: o.seed ?? 6 }), side: THREE.DoubleSide, roughness: 0.95 }));
    sail.geometry.translate(0, -mh * 0.17, 0); sail.position.set(mx, H * 0.6 + mh * 0.8, 0.06);
    clothInit(sail, { amp: 0.16, freq: 2.2, speed: 2.2 }); grp.add(sail); sails.push(sail);
    rigPts.push(mx, H * 0.6 + mh, 0, L * 0.52, H * 0.8, 0, mx, H * 0.6 + mh, 0, -L * 0.52, H * 0.7, 0, mx, H * 0.6 + mh, 0, mx + 1.5, H * 0.65, W * 0.4, mx, H * 0.6 + mh, 0, mx + 1.5, H * 0.65, -W * 0.4);
  }
  const rigGeo = new THREE.BufferGeometry(); rigGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rigPts), 3));
  grp.add(new THREE.LineSegments(rigGeo, new THREE.LineBasicMaterial({ color: 0x14161c, transparent: true, opacity: 0.85 })));
  const lant = _d3put(grp, new THREE.SphereGeometry(0.17, 10, 8), glassMat(0xffc37a, 0.5), -L * 0.52, H * 1.05, 0); // stern lantern
  const lg = glint(0.8); lg.material.color.set(0xffc37a); lg.position.set(-L * 0.52, H * 1.05, 0); grp.add(lg);
  const anch = new THREE.Group(); // anchor at the bow
  const ironM = _d3std({ color: 0x23262b, roughness: 0.5, metalness: 0.8, envMap: env, envMapIntensity: 0.5 });
  _d3put(anch, new THREE.BoxGeometry(0.09, 1.15, 0.09), ironM, 0, 0, 0);
  _d3put(anch, new THREE.BoxGeometry(0.62, 0.09, 0.09), ironM, 0, 0.5, 0);
  for (const fx of [-1, 1]) { const fl = _d3put(anch, new THREE.ConeGeometry(0.14, 0.42, 4), ironM, fx * 0.26, -0.5, 0); fl.rotation.z = fx * 0.7; }
  anch.position.set(L * 0.44, H * 0.25, W * 0.3); anch.rotation.z = 0.25; grp.add(anch);
  _d3put(grp, new THREE.BoxGeometry(0.5, H * 0.5, 0.1), trimM, -L * 0.52, H * 0.3, 0); // rudder
  grp.userData.sails = sails;
  grp.userData.update = t => { for (const s of sails) clothWave(s, t); };
  return grp;
}

// ============================================================
// rocket — segmented body (panel lines + rivets in the metal), nose cone,
// rimmed window, stencil label, three edged fins, nozzle, layered flame.
// userData.update(t) flickers the flame; userData.flame is the flame group.
// ============================================================
export function rocket(o = {}) {
  const grp = new THREE.Group(), H = o.h ?? 7, R = o.r ?? 0.85, env = o.envMap || null;
  const bodyM = _d3std({ map: metalTexture({ base: o.base || '#d8dce2', seed: o.seed ?? 23, panels: 5, rust: 0.03 }), roughness: 0.38, metalness: 0.55, envMap: env, envMapIntensity: 0.8 });
  const body = _d3put(grp, new THREE.CylinderGeometry(R, R, H * 0.6, 22), bodyM, 0, H * 0.42, 0);
  for (const ry of [0.14, 0.7]) { const ring = _d3put(grp, new THREE.CylinderGeometry(R * 1.02, R * 1.02, H * 0.035, 22), _d3std({ color: 0xb03a30, roughness: 0.45, metalness: 0.5, envMap: env, envMapIntensity: 0.7 }), 0, H * ry, 0); }
  const nose = _d3put(grp, new THREE.CylinderGeometry(0.02, R, H * 0.3, 22), bodyM, 0, H * 0.87, 0);
  const tip = _d3put(grp, new THREE.SphereGeometry(0.1, 10, 8), _d3std({ color: 0xb03a30, roughness: 0.4, metalness: 0.6 }), 0, H * 1.02, 0);
  const winZ = R * 0.99; // window: brass rim + glass + rivets around it
  const wrim = _d3put(grp, new THREE.TorusGeometry(0.3, 0.055, 8, 18), _d3std({ color: 0x8f9096, roughness: 0.3, metalness: 1, envMap: env, envMapIntensity: 1 }), 0, H * 0.6, winZ);
  const wgl = _d3put(grp, new THREE.CircleGeometry(0.29, 18), glassMat(0x9fd4e8, 0.55), 0, H * 0.6, winZ + 0.01);
  const wRiv = rivetCircle(0.42, 10, { size: 0.035 }); wRiv.position.set(0, H * 0.6, winZ - 0.01); grp.add(wRiv);
  const lab = stencilLabel(o.label || 'V-3', { w: 0.62, h: 1.5, fg: '#31456e', seed: 31, wear: 0.12 });
  lab.position.set(0, H * 0.34, R * 1.005); grp.add(lab);
  const finM = _d3std({ map: metalTexture({ base: '#b03a30', seed: 29, panels: 2, rust: 0.05 }), roughness: 0.5, metalness: 0.45, envMap: env, envMapIntensity: 0.6 });
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.5;
    const fin = bevelBox(0.14, H * 0.3, H * 0.24, { bevel: 0.04, mat: finM });
    fin.position.set(Math.cos(a) * (R + H * 0.1), H * 0.16, Math.sin(a) * (R + H * 0.1));
    fin.rotation.y = -a + Math.PI / 2; fin.rotation.z = Math.cos(a) * 0.16; fin.rotation.x = -Math.sin(a) * 0.16;
    grp.add(fin);
  }
  const baseRiv = rivetCircle(R * 1.01, 18, { size: 0.04 }); baseRiv.rotation.x = Math.PI / 2; baseRiv.position.y = H * 0.13; grp.add(baseRiv);
  const nozzle = _d3put(grp, new THREE.CylinderGeometry(0.3, 0.52, 0.5, 16, 1, true), _d3std({ color: 0x2a2c30, roughness: 0.45, metalness: 0.85, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.7 }), 0, H * 0.1 - 0.2, 0);
  const flame = new THREE.Group(); // layered cones: white core, orange body, faint outer
  const fmat = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const f1 = _d3put(flame, new THREE.ConeGeometry(0.42, H * 0.5, 14, 1, true), fmat(0xff7a26, 0.5), 0, -H * 0.25, 0); f1.rotation.x = Math.PI;
  const f2 = _d3put(flame, new THREE.ConeGeometry(0.26, H * 0.38, 12, 1, true), fmat(0xffc23e, 0.75), 0, -H * 0.19, 0); f2.rotation.x = Math.PI;
  const f3 = _d3put(flame, new THREE.ConeGeometry(0.13, H * 0.26, 10, 1, true), fmat(0xfff3d0, 0.95), 0, -H * 0.13, 0); f3.rotation.x = Math.PI;
  flame.position.y = H * 0.1 - 0.42; grp.add(flame);
  grp.userData.flame = flame;
  grp.userData.update = t => { const s = 1 + Math.sin(t * 31) * 0.08 + Math.sin(t * 47 + 1.7) * 0.06; flame.scale.set(1, s, 1); flame.rotation.y = t * 0.7; };
  return grp;
}
