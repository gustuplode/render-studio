// ============================================================
// fx.js — Coded FX Library v2 (2026-11-12) for render-studio three.js webs
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
