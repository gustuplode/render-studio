// Stubby — coded dog + WWI sets (MH is human-only, so the dog is a coded
// three.js character in the props tradition: real parts, real-world scale).
// Dog forward = +Z (matches the human heading convention atan2(dx,dz)).
// Shoulder height ~0.55 m (bull-terrier). Units = metres.
import * as THREE from 'three';

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.0, ...opts });
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function sph(r, mat, x = 0, y = 0, z = 0, seg = 14) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(10, seg - 4)), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function cnv(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// brindle coat: warm brown base, dark tiger streaks, lighter belly blend
// SEEDED random — the coat must be identical on every page load (chunk renders
// start fresh pages; Math.random would change the dog between chunks).
const brindleTex = () => cnv(256, 128, (x, w, h) => {
  let seed = 1917; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#8a6844'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    x.strokeStyle = `rgba(${30 + rnd() * 30},${20 + rnd() * 18},10,${0.10 + rnd() * 0.16})`;
    x.lineWidth = 2 + rnd() * 5;
    const sx = rnd() * w; x.beginPath(); x.moveTo(sx, 0);
    x.bezierCurveTo(sx + 8 - rnd() * 16, h * 0.35, sx - 8 + rnd() * 16, h * 0.7, sx + 4 - rnd() * 8, h); x.stroke();
  }
  for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(255,230,190,${rnd() * 0.08})`; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
});
const BRINDLE = M(0xffffff, { map: brindleTex(), roughness: 0.95 });
const WHITE = M(0xf3ead8, { roughness: 0.95 });
const DARK = M(0x2a2019, { roughness: 0.9 });
const PINK = M(0xb98a7a, { roughness: 0.9 });

function makeLeg(x, z) {
  // pivot at shoulder/hip (y=0 in leg-group space, group placed at hip height)
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const upper = cyl(0.038, 0.031, 0.17, BRINDLE, 0, -0.085, 0); g.add(upper);
  const low = new THREE.Group(); low.position.set(0, -0.17, 0); g.add(low);
  low.add(cyl(0.028, 0.023, 0.145, BRINDLE, 0, -0.072, 0));
  const paw = box(0.055, 0.035, 0.085, WHITE, 0, -0.15, 0.018); low.add(paw);
  g.userData.low = low;
  return g;
}

export function makeDog() {
  const dog = new THREE.Group();
  const bodyG = new THREE.Group(); bodyG.position.y = 0.415; dog.add(bodyG);
  // torso: sphere stretched along Z, brindle; white chest patch at front-low
  const torso = sph(0.16, BRINDLE, 0, 0, -0.02, 18); torso.scale.set(0.98, 0.95, 1.8); bodyG.add(torso);
  const chest = sph(0.115, WHITE, 0, -0.045, 0.16, 14); chest.scale.set(0.85, 0.9, 0.9); bodyG.add(chest);
  const belly = sph(0.12, WHITE, 0, -0.075, -0.05, 12); belly.scale.set(0.8, 0.6, 1.4); bodyG.add(belly);
  // neck + head
  const headG = new THREE.Group(); headG.position.set(0, 0.075, 0.27); bodyG.add(headG);
  const skull = sph(0.105, BRINDLE, 0, 0.035, 0.01, 16); skull.scale.set(0.95, 0.9, 1.0); headG.add(skull);
  const blaze = sph(0.055, WHITE, 0, 0.045, 0.075, 10); blaze.scale.set(0.55, 0.9, 0.7); headG.add(blaze);
  const muzzle = box(0.105, 0.085, 0.13, WHITE, 0, -0.012, 0.115); headG.add(muzzle);
  const nose = sph(0.028, DARK, 0, 0.008, 0.185, 10); headG.add(nose);
  const jaw = box(0.085, 0.028, 0.11, PINK, 0, -0.062, 0.10); headG.add(jaw);
  for (const s of [-1, 1]) {
    const eye = sph(0.016, DARK, s * 0.052, 0.062, 0.088, 8); headG.add(eye);
  }
  // ears: pivot groups at skull top so they can prick / flop
  const earL = new THREE.Group(); earL.position.set(0.062, 0.115, 0.0); headG.add(earL);
  const earLi = sph(0.045, BRINDLE, 0, 0.045, 0, 10); earLi.scale.set(0.55, 1.05, 0.8); earL.add(earLi);
  const earR = new THREE.Group(); earR.position.set(-0.062, 0.115, 0.0); headG.add(earR);
  const earRi = sph(0.045, BRINDLE, 0, 0.045, 0, 10); earRi.scale.set(0.55, 1.05, 0.8); earR.add(earRi);
  earL.rotation.z = -0.25; earR.rotation.z = 0.25;
  // collar (army green + brass tag) — Stubby's uniform read
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.016, 8, 20), M(0x4a5d23, { roughness: 0.8 }));
  collar.position.set(0, -0.01, 0.225); collar.rotation.x = Math.PI / 2 - 0.35; collar.castShadow = true; bodyG.add(collar);
  const tag = sph(0.02, M(0xc9a227, { metalness: 0.85, roughness: 0.3 }), 0, -0.105, 0.27, 10); bodyG.add(tag);
  // legs (pivots at hip height 0.35 — stocky bull-terrier stance)
  const legFL = makeLeg(0.095, 0.20); legFL.position.y = 0.35; dog.add(legFL);
  const legFR = makeLeg(-0.095, 0.20); legFR.position.y = 0.35; dog.add(legFR);
  const legBL = makeLeg(0.10, -0.21); legBL.position.y = 0.35; dog.add(legBL);
  const legBR = makeLeg(-0.10, -0.21); legBR.position.y = 0.35; dog.add(legBR);
  // tail: pivot at rear-top, tapered cylinder angled well back (not a pole)
  const tailG = new THREE.Group(); tailG.position.set(0, 0.50, -0.30); dog.add(tailG);
  const tail = cyl(0.009, 0.018, 0.26, BRINDLE, 0, 0.11, -0.075); tail.rotation.x = 0.95; tailG.add(tail);
  dog.userData.refs = { bodyG, headG, jaw, earL, earR, tailG, legFL, legFR, legBL, legBR };
  return dog;
}

// Pose the dog. mode: stand|walk|sit|salute|alert|bark|grab|lie
// phase: walk cycle radians; t: seconds (breathing/wag/bark envelopes)
export function poseDog(dog, mode, t = 0, phase = 0) {
  const R = dog.userData.refs;
  const { bodyG, headG, jaw, earL, earR, tailG } = R;
  const legs = [R.legFL, R.legFR, R.legBL, R.legBR];
  // defaults
  bodyG.position.y = 0.415; bodyG.rotation.set(0, 0, 0);
  headG.rotation.set(0, 0, 0); headG.position.set(0, 0.075, 0.27);
  jaw.rotation.x = 0;
  earL.rotation.set(0, 0, -0.25); earR.rotation.set(0, 0, 0.25);
  tailG.rotation.set(0, Math.sin(t * 2.2) * 0.18, 0);
  for (const L of legs) { L.rotation.set(0, 0, 0); L.userData.low.rotation.set(0, 0, 0); }
  const breathe = Math.sin(t * 1.8) * 0.006;
  if (mode === 'walk') {
    // diagonal pairs: FL+BR in phase, FR+BL opposite — a real trot
    const pairs = [[R.legFL, 0], [R.legBR, 0], [R.legFR, Math.PI], [R.legBL, Math.PI]];
    for (const [L, off] of pairs) {
      const ph = phase + off, sw = Math.sin(ph);
      L.rotation.x = sw * 0.52;
      L.userData.low.rotation.x = Math.max(0, -Math.cos(ph)) * 0.55 + 0.05;
    }
    bodyG.position.y = 0.415 + Math.abs(Math.sin(phase)) * 0.018;
    bodyG.rotation.z = Math.sin(phase) * 0.02;
    headG.rotation.x = Math.sin(phase * 2) * 0.03;
    tailG.rotation.y = Math.sin(t * 7) * 0.35;
  } else if (mode === 'sit' || mode === 'salute') {
    bodyG.position.y = 0.315; bodyG.rotation.x = -0.52;   // haunches down, chest up
    R.legBL.rotation.x = 1.25; R.legBL.userData.low.rotation.x = -1.9;
    R.legBR.rotation.x = 1.25; R.legBR.userData.low.rotation.x = -1.9;
    R.legFL.rotation.x = 0.06; R.legFR.rotation.x = 0.06;  // front legs VERTICAL, paws planted — the pitch does the sitting
    headG.rotation.x = -0.18;
    tailG.rotation.y = Math.sin(t * 5) * 0.3;
    if (mode === 'salute') {
      // right foreleg raised, paw bent to the brow
      R.legFR.rotation.x = -1.95; R.legFR.userData.low.rotation.x = -0.85;
      R.legFL.rotation.x = 0.06;
      earL.rotation.z = -0.08; earR.rotation.z = 0.08;    // ears pricked for the officer
      headG.rotation.x = -0.26;
    }
  } else if (mode === 'alert' || mode === 'bark') {
    earL.rotation.z = -0.05; earR.rotation.z = 0.05;      // pricked
    headG.rotation.x = -0.14;
    tailG.rotation.y = 0; tailG.rotation.x = -0.15;       // tail stiff
    R.legFL.rotation.x = 0.06; R.legFR.rotation.x = -0.06;
    if (mode === 'bark') {
      const b = Math.max(0, Math.sin(t * 9)) * (0.5 + 0.5 * Math.sin(t * 1.3));
      headG.rotation.x = -0.14 + b * 0.22;
      jaw.rotation.x = b * 0.55;
      bodyG.position.y = 0.415 + b * 0.012;
    }
  } else if (mode === 'grab') {
    // lunge low, head down-forward at trouser height, front legs braced
    bodyG.position.y = 0.375; bodyG.rotation.x = 0.22;
    headG.rotation.x = 0.38; headG.position.z = 0.30;
    jaw.rotation.x = 0.3;
    R.legFL.rotation.x = -0.5; R.legFR.rotation.x = -0.35;
    R.legBL.rotation.x = 0.55; R.legBR.rotation.x = 0.7;
    R.legBL.userData.low.rotation.x = 0.25; R.legBR.userData.low.rotation.x = 0.25;
    tailG.rotation.x = -0.2;
  } else if (mode === 'lie') {
    // wounded rest: body on the ground, legs folded, head low
    bodyG.position.y = 0.185; bodyG.rotation.x = 0.04;
    headG.rotation.x = 0.30; headG.position.y = 0.03;
    for (const L of legs) { L.rotation.x = 1.45; L.userData.low.rotation.x = -1.35; }
    earL.rotation.z = -0.6; earR.rotation.z = 0.6;        // ears flat
    tailG.rotation.y = Math.sin(t * 0.9) * 0.06;          // faint wag
  } else { // stand
    bodyG.position.y = 0.415 + breathe;
    headG.rotation.y = Math.sin(t * 0.6) * 0.14;
    tailG.rotation.y = Math.sin(t * 3.2) * 0.28;
  }
}

/* ------------------------------ sets ------------------------------ */
const OLIVE = M(0x5a6142, { roughness: 1 });
const CANVAS_M = M(0x6b7050, { roughness: 1 });
const SAND = M(0x9a8a68, { roughness: 1 });
const MUD = M(0x4f4232, { roughness: 1 });

export function makeTent() {
  const g = new THREE.Group();
  // pup tent: two sloped canvas panels + two end triangles
  const pL = box(2.3, 0.05, 1.7, CANVAS_M, -0.52, 0.62, 0); pL.rotation.z = 0.72; g.add(pL);
  const pR = box(2.3, 0.05, 1.7, CANVAS_M, 0.52, 0.62, 0); pR.rotation.z = -0.72; g.add(pR);
  for (const zz of [0.83, -0.83]) {
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1.05, 0, zz, 1.05, 0, zz, 0, 1.22, zz]), 3));
    tg.computeVertexNormals();
    const m = new THREE.Mesh(tg, M(0x61664c, { side: THREE.DoubleSide, roughness: 1 })); m.castShadow = true; g.add(m);
  }
  g.add(cyl(0.03, 0.03, 1.3, M(0x6e4a26), 0, 0.65, 0.8));
  g.add(cyl(0.03, 0.03, 1.3, M(0x6e4a26), 0, 0.65, -0.8));
  return g;
}

export function makeFlag() {
  const g = new THREE.Group();
  g.add(cyl(0.045, 0.06, 6.4, M(0x8a8f96, { metalness: 0.6, roughness: 0.4 }), 0, 3.2, 0));
  const flagTex = cnv(256, 136, (x, w, h) => {
    for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#f0ead8' : '#b03a30'; x.fillRect(0, i * h / 13, w, h / 13 + 1); }
    x.fillStyle = '#2c3a6b'; x.fillRect(0, 0, w * 0.42, h * 7 / 13);
    x.fillStyle = '#f0ead8';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { x.beginPath(); x.arc(12 + c * 16, 10 + r * 13, 2.4, 0, 7); x.fill(); }
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.9), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9 }));
  flag.position.set(0.88, 5.85, 0); g.add(flag);
  g.userData.flag = flag;
  return g;
}

export function makeSandbagWall(len = 12) {
  const g = new THREE.Group();
  const bagGeo = new THREE.SphereGeometry(0.16, 10, 8);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 5; row++) {
    const n = Math.floor(len / 0.52);
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(bagGeo, SAND);
      b.scale.set(1.55, 0.52, 0.85);
      b.position.set(-len / 2 + 0.28 + i * 0.52 + (row % 2) * 0.24, 0.10 + row * 0.165, (rnd() - 0.5) * 0.05);
      b.rotation.y = (rnd() - 0.5) * 0.25;
      b.castShadow = true; b.receiveShadow = true; g.add(b);
    }
  }
  return g; // ~0.92 m high parapet
}

export function makeTrench(len = 16) {
  const g = new THREE.Group();
  const w1 = makeSandbagWall(len); w1.position.set(0, 0, -1.35); g.add(w1);
  const w2 = makeSandbagWall(len); w2.position.set(0, 0, 1.35); g.add(w2);
  // duckboards
  for (let i = 0; i < Math.floor(len / 0.62); i++)
    g.add(box(0.5, 0.04, 2.0, M(0x6e5638, { roughness: 1 }), -len / 2 + 0.4 + i * 0.62, 0.02, 0));
  // mud banks behind the bags
  g.add(box(len, 0.35, 0.8, MUD, 0, 0.17, -2.0));
  g.add(box(len, 0.35, 0.8, MUD, 0, 0.17, 2.0));
  // a crate + tin helmets on the fire-step
  g.add(box(0.55, 0.55, 0.55, M(0x77603c, { roughness: 1 }), -3.4, 0.28, -0.95));
  const helm = sph(0.17, M(0x55584a, { metalness: 0.4, roughness: 0.55 }), -3.4, 0.62, -0.95, 14); helm.scale.y = 0.55; g.add(helm);
  return g;
}

export function makeWire(len = 10) {
  const g = new THREE.Group();
  for (let i = 0; i <= 4; i++) {
    const post = cyl(0.03, 0.03, 1.0, M(0x3c4147, { metalness: 0.5 }), -len / 2 + i * (len / 4), 0.5, 0);
    post.rotation.z = (i % 2 ? 0.14 : -0.1); g.add(post);
  }
  const wireM = M(0x2c2f33, { metalness: 0.7, roughness: 0.5 });
  for (let i = 0; i < 26; i++) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.012, 6, 18), wireM);
    loop.position.set(-len / 2 + 0.4 + i * (len / 27), 0.45 + Math.sin(i * 1.7) * 0.14, Math.sin(i * 2.3) * 0.16);
    loop.rotation.y = Math.PI / 2 + Math.sin(i) * 0.3; loop.castShadow = true; g.add(loop);
  }
  return g;
}

export function makeCraterField() {
  const g = new THREE.Group();
  const spots = [[-5, -3, 1.6], [2, -5, 2.1], [6, 2, 1.3], [-2, 4, 1.8], [8, -2, 1.1], [-7, 3, 1.2]];
  for (const [x, z, r] of spots) {
    const pit = new THREE.Mesh(new THREE.CircleGeometry(r, 20), M(0x2e2718, { roughness: 1 }));
    pit.rotation.x = -Math.PI / 2; pit.position.set(x, 0.012, z); pit.receiveShadow = true; g.add(pit);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 8, 20), MUD);
    rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.03, z); rim.scale.z = 0.45; rim.castShadow = true; g.add(rim);
  }
  // shattered trees
  for (const [x, z, h] of [[-4, -6, 2.2], [5, 5, 1.7], [9, -5, 2.5]]) {
    const tr = cyl(0.07, 0.13, h, M(0x4c3a26, { roughness: 1 }), x, h / 2, z); tr.rotation.z = 0.06; g.add(tr);
    const spike = cyl(0.005, 0.06, 0.5, M(0x4c3a26), x, h + 0.2, z); g.add(spike);
  }
  return g;
}

export function makeShip() {
  const g = new THREE.Group();
  g.add(box(16, 0.25, 7, M(0x5d5148, { roughness: 0.9 }), 0, 0.12, 0));       // deck
  g.add(box(16, 1.4, 0.25, M(0x39424c, { metalness: 0.5, roughness: 0.5 }), 0, -0.6, 3.5)); // hull side
  for (let i = 0; i < 9; i++) g.add(cyl(0.03, 0.03, 1.0, M(0x8a8f96, { metalness: 0.6 }), -7 + i * 1.75, 0.75, 3.3));
  g.add(box(16, 0.05, 0.05, M(0x8a8f96, { metalness: 0.6 }), 0, 1.22, 3.3));
  g.add(cyl(0.06, 0.09, 7, M(0x6e5638), -3, 3.5, 0));                        // mast
  g.add(box(3.2, 2.2, 2.6, M(0xd8d2c2, { roughness: 0.8 }), 4.5, 1.35, 0));   // deckhouse
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 8, 20), M(0xd8542e, { roughness: 0.6 }));
  ring.position.set(4.5, 1.7, 1.33); ring.castShadow = true; g.add(ring);
  return g;
}

export function makePedestal() {
  const g = new THREE.Group();
  const stone = M(0xb9b2a2, { roughness: 0.7 });
  g.add(box(1.5, 0.18, 1.5, stone, 0, 0.09, 0));
  g.add(box(1.0, 1.05, 1.0, stone, 0, 0.70, 0));
  g.add(box(1.3, 0.14, 1.3, stone, 0, 1.30, 0));
  const plaqueTex = cnv(512, 160, (x, w, h) => {
    x.fillStyle = '#6e5c2e'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#f4e6b0'; x.font = 'bold 46px Georgia'; x.textAlign = 'center';
    x.fillText('SERGEANT STUBBY', w / 2, 66);
    x.font = '30px Georgia'; x.fillText('102nd Infantry • 1917–1918', w / 2, 118);
  });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.25), new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.5, metalness: 0.4 }));
  plaque.position.set(0, 0.72, 0.51); g.add(plaque);
  // museum wall panel behind
  g.add(box(5.5, 4.4, 0.25, M(0x5a5148, { roughness: 0.95 }), 0, 2.2, -1.5));
  return g;
}

export function makeMedal() {
  // sergeant stripes + medal disc, worn on a soldier's chest is hard to pin —
  // this is the framed insignia board used in the sergeant beat.
  const g = new THREE.Group();
  const boardTex = cnv(256, 256, (x, w, h) => {
    x.fillStyle = '#3d4a2e'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#d8c98a'; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = '#e8cf6a';
    for (let i = 0; i < 3; i++) { // three chevrons
      x.beginPath(); x.moveTo(58, 92 + i * 34); x.lineTo(128, 58 + i * 34); x.lineTo(198, 92 + i * 34);
      x.lineTo(198, 112 + i * 34); x.lineTo(128, 78 + i * 34); x.lineTo(58, 112 + i * 34); x.closePath(); x.fill();
    }
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.8 }));
  g.add(board);
  g.add(box(0.95, 0.95, 0.05, M(0x5d4225), 0, 0, -0.035));
  return g;
}
