// ============================================================
// fx.js — Coded FX Library for render-studio three.js webs
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
// CLOUDS + SEA MIST — clusters of big flattened puffs, slow drift. Mist = same puffs, low + wide + faint.
// ============================================================
export class Clouds {
  constructor(scene, o = {}) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.items = [];
    const n = o.count || 12;
    for (let i = 0; i < n; i++) {
      const cl = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 4);
      for (let j = 0; j < puffs; j++) {
        const s = puffSprite(o.color || 0xffffff, o.opacity || 0.85);
        s.visible = true;
        s.position.set(rnd(-7, 7), rnd(-1.2, 1.2), rnd(-2, 2));
        s.scale.set(rnd(9, 17), rnd(3.4, 5.5), 1);
        s.material.opacity = (o.opacity || 0.85) * rnd(0.6, 1);
        cl.add(s);
      }
      cl.position.set(rnd(-90, 90), o.y !== undefined ? o.y + rnd(-4, 4) : rnd(24, 40), rnd(-70, -25));
      cl.userData.speed = rnd(0.14, 0.4) * (o.drift || 1);
      this.group.add(cl); this.items.push(cl);
    }
  }
  update(t, dt) { for (const cl of this.items) { cl.position.x += cl.userData.speed * dt; if (cl.position.x > 110) cl.position.x = -110; } }
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
    const m = new THREE.PointsMaterial({ size: 0.85, map: puffTexture(), color: 0xf4fbff, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true });
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
