// ENGINE kit "grocery": the 1930s corner grocery (shell, shelves, products, price cards, counter, door, awning) + the
// folding-chair shopping cart + small story extras (calendar, tumbleweed, bulb, coins). Built for video 1, used as the shop in video 2.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {LOOK_RAMP as ramp, lookToon, LOOK_PREM, X} from '../../look/look';
import {drawSign, drawTiles, drawWallpaper, drawWire, drawAwning, drawValance, drawCalendar, drawCoin, drawBulb, drawWood, drawBrick, drawMatcap, drawTin, drawAsphalt, drawSidewalk, drawBurlap, drawCanLabel, drawBoxLabel, drawPrices, drawPlaque, drawChalk, drawDay, drawDisplay, drawInterior, drawSkyBack, drawPegboard, drawRegister, drawTag, drawDial, drawClock, drawBarrelEnd} from '../../look/draw';
import {shotAt, ease, pop, V, type V3} from '../../core/clock';
import {CART_K} from '../../chars/charparts';
/** shopping cart pose */
export type CartP = {p: V3; ry?: number; wood?: number; wheels?: number; b1?: number; b2?: number; fill?: number; dust?: number; spin?: number; sc?: number};
/** mood: 0 = warm store, 1 = blue night (video 1 day 3); the parking-meter story keeps 0 */
import {MOOD} from '@story/look';
export const moodAt = MOOD;
// ---------- geometry helpers (merged, built once) ----------
const cylS = new THREE.CylinderGeometry(1, 1, 1, 10), sph = new THREE.SphereGeometry(1, 10, 8), cyl16 = new THREE.CylinderGeometry(0.5, 0.5, 1, 16), sph12 = new THREE.SphereGeometry(0.5, 12, 9);
const cone = new THREE.CylinderGeometry(0.3, 1, 1, 18, 1, true);
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler();
const ni = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
const place = (g: THREE.BufferGeometry, p: V3, s: V3, r: V3 = [0, 0, 0]) => { const c = ni(g.clone()); _m4.compose(V(...p), _q4.setFromEuler(_e4.set(r[0], r[1], r[2])), V(...s)); c.applyMatrix4(_m4); return c; };
const tubeG = (a: V3, b: V3, r: number, sq = false) => {
  const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
  const c = ni((sq ? box : cylS).clone()); _m4.compose(V((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, sq ? V(r * 2, len, r * 2) : V(r, len, r)); c.applyMatrix4(_m4); return c;
};
const sphG = (p: V3, r: number) => place(sph, p, [r, r, r]);
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs)!;
const GC: Record<string, THREE.BufferGeometry> = {};
const lazy = (k: string, f: () => THREE.BufferGeometry) => (GC[k] ??= f());
const planeUV = (uv: [number, number]) => { const c = plane.clone(); const a = c.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uv[0], a.getY(i) * uv[1]); return c; };

// cart frame: scissor-X sides, rails, axles, handle. Same skeleton for the chrome cart and the wooden folding chair.
const frameG = (wood: boolean) => lazy(wood ? 'frW' : 'frC', () => {
  const gs: THREE.BufferGeometry[] = [], r = wood ? 0.015 : 0.0105, T = (a: V3, b: V3, rr = r) => gs.push(tubeG(a, b, rr, wood));
  for (const z of [-0.2, 0.2]) {
    T([-0.26, 0.07, z], [-0.3, 1.0, z]); T([0.26, 0.07, z], [0.26, 0.64, z]);
    T([-0.26, 0.08, z], [0.26, 0.62, z]); T([0.26, 0.08, z], [-0.26, 0.62, z]);
    T([-0.27, 0.62, z], [0.27, 0.62, z]); T([-0.27, 0.2, z], [0.27, 0.2, z]);
    if (!wood) { gs.push(sphG([0, 0.35, z], 0.019), sphG([0.26, 0.64, z], 0.015), sphG([-0.3, 1.0, z], 0.017), sphG([-0.27, 0.62, z], 0.013), sphG([0.27, 0.2, z], 0.013), sphG([-0.27, 0.2, z], 0.013)); }
  }
  for (const x of [-0.26, 0.26]) T([x, 0.08, -0.2], [x, 0.08, 0.2]);
  for (const x of [-0.27, 0.27]) { T([x, 0.62, -0.2], [x, 0.62, 0.2]); T([x, 0.2, -0.2], [x, 0.2, 0.2]); }
  T([-0.3, 1.0, -0.2], [-0.3, 1.0, 0.2], wood ? 0.016 : 0.013);
  return merge(gs);
});
const seatG = () => lazy('seat', () => {
  const gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) gs.push(place(box, [-0.24 + i * 0.096, 0.645, 0], [0.082, 0.026, 0.43]));
  for (const z of [-0.17, 0.17]) gs.push(place(box, [0, 0.615, z], [0.58, 0.025, 0.03]));
  for (const y of [0.76, 0.85, 0.94]) gs.push(place(box, [-0.26 - 0.04 * (y - 0.07) / 0.93 - 0.012, y, 0], [0.022, 0.075, 0.4]));
  return merge(gs);
});
const basketMetalG = () => lazy('bkM', () => {
  const gs: THREE.BufferGeometry[] = [], r = 0.0085, T = (a: V3, b: V3) => gs.push(tubeG(a, b, r));
  for (const y of [0.12, -0.12]) { for (const z of [-0.17, 0.17]) T([-0.25, y, z], [0.25, y, z]); for (const x of [-0.25, 0.25]) T([x, y, -0.17], [x, y, 0.17]); }
  for (const x of [-0.25, 0.25]) for (const z of [-0.17, 0.17]) { T([x, -0.12, z], [x, 0.12, z]); gs.push(sphG([x, 0.12, z], 0.0125)); }
  for (let i = -2; i <= 2; i++) T([i * 0.1, -0.12, -0.17], [i * 0.1, -0.12, 0.17]);
  return merge(gs);
});
const basketWireG = () => lazy('bkW', () => merge([
  place(planeUV([2, 1]), [0, 0, 0.17], [0.5, 0.24, 1]), place(planeUV([2, 1]), [0, 0, -0.17], [0.5, 0.24, 1]),
  place(planeUV([1.4, 1]), [0.25, 0, 0], [0.34, 0.24, 1], [0, Math.PI / 2, 0]), place(planeUV([1.4, 1]), [-0.25, 0, 0], [0.34, 0.24, 1], [0, Math.PI / 2, 0]),
  place(planeUV([2, 1.4]), [0, -0.115, 0], [0.5, 0.34, 1], [-Math.PI / 2, 0, 0]),
]));
const pyramidG = () => lazy('pyr', () => { const gs: THREE.BufferGeometry[] = []; for (let l = 0; l < 4; l++) for (let i = 0; i < 4 - l; i++) for (let j = 0; j < 4 - l; j++) gs.push(place(cyl16, [(i - (3 - l) / 2) * 0.11, 0.065 + l * 0.125, (j - (3 - l) / 2) * 0.11], [0.1, 0.12, 0.1])); return merge(gs); });

// ---------- materials ----------
const toon = lookToon;   // LOOK
const useMats = () => useMemo(() => {
  const wp = drawWallpaper(1.333); wp.repeat.set(6, 1);
  const wpS = drawWallpaper(2); wpS.repeat.set(9, 1);
  const tiles = drawTiles(); tiles.repeat.set(8, 18);
  const wireT = drawWire(), brick = drawBrick(); brick.repeat.set(8.2, 4.6);
  const mc = (k: 'chrome' | 'brass') => new THREE.MeshMatcapMaterial({matcap: drawMatcap(k)});
  const wd = (c: string, o: any = {}, rx = 1, ry = 1) => { const t = drawWood(c, o); t.repeat.set(rx, ry); return toon({map: t}); };
  const plq = (l: [string, number, string?][], o: any = {}) => toon({map: drawPlaque(l, o), emissive: '#3a2410'});
  const planks = drawWood('#a87a48', {planks: 5, seed: 8}); planks.repeat.set(3, 3.6);
  const workWall = drawWood('#8a6a48', {planks: 6, vertical: true, seed: 17}); workWall.repeat.set(3, 1);
  const asphalt = drawAsphalt(LOOK_PREM.asphalt); asphalt.repeat.set(10, 4); const walk = drawSidewalk(); walk.repeat.set(10, 3);
  const tin = drawTin(); tin.repeat.set(8, 18);
  const prices = drawPrices();
  const mats = {
    floor: toon({map: tiles}), wall: toon({map: wp}), wallS: toon({map: wpS}),
    wood: wd('#a86f3e', {planks: 4, seed: 1}), woodD: wd('#6e3b22', {planks: 3, seed: 2}), shelf: wd('#c98a4a', {planks: 4, vertical: true, seed: 3}, 4, 1),
    shelfBoard: wd('#d29a58', {planks: 2, vertical: true, seed: 5}, 1, 6), crate: wd('#c79a5c', {planks: 3, seed: 14}),
    woodFrame: wd('#9a6a3c', {planks: 2, seed: 7}), woodFloor: toon({map: planks}), workWall: toon({map: workWall}),
    chrome: mc('chrome'), brass: mc('brass'), rubber: toon({color: '#2a2430'}), tire: toon({color: '#1f1a26'}),
    wire: new THREE.MeshToonMaterial({gradientMap: ramp, map: wireT, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: '#ffffff'}),
    facade: toon({map: brick}), brickS: toon({map: drawBrick('#a84a2a', '#cdbb98')}), trim: toon({color: '#f2e3c0'}), stone: toon({color: '#d8cdb4'}), green: toon({color: '#2e5a4a'}), greenD: toon({color: '#234639'}), iron: toon({color: '#2e2a33'}),
    glass: new THREE.MeshBasicMaterial({map: drawInterior(), color: new THREE.Color(0.9, 0.85, 0.8)}),
    street: toon({map: asphalt}), walk: toon({map: walk}), curb: toon({color: '#b8ad98'}), roof: toon({color: '#4a4650'}),
    counter: wd('#7a3b22', {planks: 3, seed: 21}), counterTop: toon({color: '#4a2416'}), counterP: wd('#8d4a2a', {planks: 2, seed: 22}), register: toon({color: '#b8b0a0'}),
    lamp: new THREE.MeshBasicMaterial({color: new THREE.Color(1.9, 1.5, 0.9), toneMapped: true}),
    shade: toon({color: '#2f6f73', side: THREE.DoubleSide}), cloth: toon({color: '#b2391f'}), cream: toon({color: '#f4ecd2'}), red: toon({color: '#c8432a'}), tin: toon({map: tin}),
    blob: new THREE.MeshBasicMaterial({color: '#000', transparent: true, opacity: 0.28, depthWrite: false}),
    dust: new THREE.MeshBasicMaterial({color: '#f6ead0', transparent: true, opacity: 0.7, depthWrite: false}),
    awning: toon({map: drawAwning(), side: THREE.DoubleSide}), valance: toon({map: drawValance(), side: THREE.DoubleSide, transparent: true, alphaTest: 0.5}),
    sign: plq([['GROCERY', 3, '#f6e7b4'], ['FRESH  ·  CANNED  ·  DRY GOODS', 0.8, '#e9b64a']], {w: 1024, h: 288, bg: '#27493f', border: '#c8432a', inner: '#e9b64a', rivets: true}),
    sign2: plq([['OKLAHOMA CITY', 1.2, '#f2e3c0'], ['1937', 1.6, '#f2e3c0']], {w: 512, h: 640, bg: '#2f6f73', border: '#f2e3c0'}),
    chalk: toon({map: drawChalk()}),
    open: plq([['OPEN', 1, '#f6e7b4']], {w: 256, h: 128, bg: '#b2391f', border: '#f6e7b4'}),
    help: toon({map: drawPlaque([['HELP WANTED', 1, '#b2391f'], ['CART PUSHERS', 1, '#b2391f'], ['APPLY WITHIN', 0.6, '#241726']], {w: 1024, h: 512, bg: '#f2e3c0', border: '#b2391f', inner: '#241726'})}),
    doormat: plq([['WELCOME', 1, '#f2e3c0']], {w: 512, h: 256, bg: '#7a2a22', border: '#f2e3c0'}),
    ad: [
      plq([['COFFEE', 2, '#f6e7b4'], ['FRESH ROASTED  25¢ LB', 0.8, '#f6e7b4']], {w: 1024, h: 384, bg: '#b2391f', border: '#f6e7b4', rivets: true}),
      plq([['FRESH BREAD', 1.6, '#b2391f'], ['BAKED DAILY', 1, '#241726']], {w: 1024, h: 384, bg: '#f2e3c0', border: '#b2391f', inner: '#b2391f'}),
      plq([['IN GOD WE TRUST', 1, '#f6e7b4'], ['ALL OTHERS PAY CASH', 1, '#e9b64a']], {w: 1024, h: 384, bg: '#27493f', border: '#e9b64a'}),
      plq([['ICE COLD', 1, '#f6e7b4'], ['SODA  5¢', 1.5, '#f6e7b4']], {w: 1024, h: 384, bg: '#2a5f9a', border: '#f6e7b4', rivets: true}),
      plq([['FLOUR · SUGAR', 1, '#241726'], ['SALT · LARD', 1, '#b2391f']], {w: 1024, h: 384, bg: '#e9b64a', border: '#241726'}),
      plq([['TEA', 2, '#f6e7b4'], ['ORANGE PEKOE', 0.8, '#f6e7b4']], {w: 1024, h: 384, bg: '#2f6f73', border: '#f6e7b4'}),
    ],
    day: new THREE.MeshBasicMaterial({map: drawDay(), color: new THREE.Color(1.25, 1.2, 1.1)}),
    disp: new THREE.MeshBasicMaterial({map: drawDisplay(), color: new THREE.Color(0.95, 0.9, 0.85)}),
    sky: new THREE.MeshBasicMaterial({map: drawSkyBack(), fog: false}),
    peg: toon({map: drawPegboard()}), dial: toon({map: drawDial()}), clock: toon({map: drawClock()}), regKeys: toon({map: drawRegister()}), regTag: new THREE.MeshBasicMaterial({map: drawTag()}),
    barrel: toon({map: drawBarrelEnd()}), burlap: toon({map: drawBurlap()}),
    canLab: toon({map: drawCanLabel()}), boxLab: toon({map: drawBoxLabel()}), plain: toon({color: '#fff'}), prices: toon({map: prices, transparent: true, alphaTest: 0.5}),
    apple: toon({color: '#d83a2a'}), orange: toon({color: '#f2992a'}), cabbage: toon({color: '#7aa04a'}), bread: toon({color: '#d9a04a'}), bottle: toon({color: '#5b9aa0'}), paint: toon({color: '#2f6f73'}),
    weed: new THREE.MeshToonMaterial({gradientMap: ramp, color: '#a8783a', wireframe: true}), weedS: toon({color: '#8a5a28'}),
    coin: new THREE.MeshBasicMaterial({map: drawCoin(), transparent: true, alphaTest: 0.5}),
    bulb: new THREE.MeshBasicMaterial({map: drawBulb(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide}),
    cal: [1, 2, 3].map((d) => toon({map: drawCalendar(d)})),
  };
  return mats;
}, []);
type Mats = ReturnType<typeof useMats>;
const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 14), plane = new THREE.PlaneGeometry(1, 1), circ = new THREE.CircleGeometry(1, 24);
const weedG = [new THREE.IcosahedronGeometry(0.2, 1), new THREE.TorusGeometry(0.2, 0.012, 4, 14), new THREE.TorusGeometry(0.19, 0.012, 4, 14), new THREE.TorusGeometry(0.21, 0.012, 4, 14)];

// ---------- shelf runs: products (instanced) ----------
type Run = {ax: 'x' | 'z'; u0: number; len: number; base: number; dir: 1 | -1; levels: number; yb: number; pitch: number; seed: number; depth?: number; top?: boolean; cx?: number};
const RUNS: Run[] = [
  {ax: 'z', u0: -11.85, len: 9.6, base: -1.3, dir: 1, levels: 4, yb: 0.2, pitch: 0.48, seed: 7, top: true},
  {ax: 'z', u0: -11.85, len: 9.6, base: 1.3, dir: -1, levels: 4, yb: 0.2, pitch: 0.48, seed: 31, top: true},
  {ax: 'x', u0: -3.9, len: 1.15, base: -13.7, dir: 1, levels: 4, yb: 0.2, pitch: 0.48, seed: 5},
  {ax: 'x', u0: -0.8, len: 4.7, base: -13.7, dir: 1, levels: 4, yb: 0.2, pitch: 0.48, seed: 9},
  {ax: 'z', u0: 0.55, len: 2.1, base: -3.72, dir: 1, levels: 3, yb: 0.95, pitch: 0.42, seed: 13},
];
const wpos = (r: Run, u: number, v: number, y: number): V3 => (r.ax === 'z' ? [r.base + r.dir * v, y, u] : [u, y, r.base + r.dir * v]);
const wsz = (r: Run, su: number, sy: number, sv: number): V3 => (r.ax === 'z' ? [sv, sy, su] : [su, sy, sv]);
type It = {p: V3; s: V3; c: string};
const inst = (g: THREE.BufferGeometry, mat: THREE.Material, items: It[], shadow = false) => {
  const m = new THREE.InstancedMesh(g, mat, Math.max(items.length, 1)); m.count = items.length; const o = new THREE.Object3D();
  items.forEach((it, i) => { o.position.set(...it.p); o.scale.set(...it.s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, new THREE.Color(it.c)); });
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.frustumCulled = false; m.castShadow = shadow; return m;
};
const CANS = ['#d0532f', '#f2b234', '#3f8a86', '#e9a090', '#b2391f', '#5b7fb5', '#7aa04a', '#e8483a', '#c9b25a'];
const BOXC = ['#f2c050', '#e8483a', '#5b9ac5', '#f2e3c0', '#7aa04a', '#d0532f', '#e08a5a', '#9a7ab5'];
const JARC = ['#b2391f', '#e8a02a', '#7aa04a', '#c9a068', '#8a3a5a'], BOTC = ['#4d8f5a', '#b8742a', '#5b8fb5', '#f2efe6', '#8a4a3a'], PRODC = ['#d83a2a', '#f2992a', '#e6d23a', '#8fb04a', '#d83a2a'];
const Products: React.FC<{m: Mats}> = ({m}) => {
  const meshes = useMemo(() => {
    const B: Record<string, It[]> = {can: [], box: [], sack: [], crate: [], jarB: [], jarL: [], botB: [], botN: [], prod: [], loaf: [], card: []};
    for (const r of RUNS) {
      let k = r.seed; const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647), pk = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
      const put = (b: string, u: number, y: number, su: number, sy: number, sv: number, c: string) => B[b].push({p: wpos(r, u, 0.14 - sv / 2 - 0.012, y), s: wsz(r, su, sy, sv), c});
      for (let l = 0; l < r.levels; l++) {
        const yb = r.yb + l * r.pitch; let u = r.u0 + 0.03; const end = r.u0 + r.len - 0.05;
        const pool = l === 0 && r.yb < 0.5 ? ['sack', 'crate', 'sack', 'crate', 'box', 'can'] : l === r.levels - 1 ? ['box', 'box', 'loaf', 'jar', 'can', 'bottle'] : ['can', 'can', 'box', 'jar', 'bottle', 'bigtin', 'box'];
        while (u < end - 0.1) {
          const t = pk(pool); let adv = 0.2;
          if (t === 'can' || t === 'bigtin') { const big = t === 'bigtin', d = big ? 0.17 : 0.075 + rnd() * 0.03, h = big ? 0.2 : 0.11 + rnd() * 0.04, n = big ? 2 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 4), st = Math.min(3, Math.floor(0.39 / h)), c = pk(CANS), stacks = big ? 1 + Math.floor(rnd() * 2) : Math.max(1, st - Math.floor(rnd() * 2));
            for (let i = 0; i < n; i++) for (let s = 0; s < stacks; s++) put('can', u + d / 2 + i * (d + 0.004), yb + h / 2 + s * h, d, h, d, i % 3 === 2 && rnd() < 0.5 ? pk(CANS) : c); adv = n * (d + 0.004) + 0.03; }
          else if (t === 'box') { const n = 2 + Math.floor(rnd() * 3), w = 0.1 + rnd() * 0.05, h = 0.2 + rnd() * 0.17, dp = 0.08 + rnd() * 0.07, c = pk(BOXC); for (let i = 0; i < n; i++) put('box', u + w / 2 + i * (w + 0.006), yb + h / 2, w, h, dp, i % 2 ? pk(BOXC) : c); adv = n * (w + 0.006) + 0.03; }
          else if (t === 'jar') { const n = 2 + Math.floor(rnd() * 2), c = pk(JARC); for (let i = 0; i < n; i++) { const x = u + 0.06 + i * 0.125; put('jarB', x, yb + 0.075, 0.1, 0.15, 0.1, c); put('jarL', x, yb + 0.16, 0.105, 0.03, 0.105, i % 2 ? '#c9d1da' : '#b2391f'); } adv = n * 0.125 + 0.04; }
          else if (t === 'bottle') { const n = 3 + Math.floor(rnd() * 3), c = pk(BOTC); for (let i = 0; i < n; i++) { const x = u + 0.04 + i * 0.085; put('botB', x, yb + 0.08, 0.065, 0.16, 0.065, c); put('botN', x, yb + 0.2, 0.03, 0.08, 0.03, c); } adv = n * 0.085 + 0.04; }
          else if (t === 'sack') { const w = 0.3 + rnd() * 0.08, h = 0.28 + rnd() * 0.1; put('sack', u + w / 2, yb + h / 2, w, h, 0.26, pk(['#ffffff', '#f2e3c0', '#e9d0a8', '#ffffff'])); adv = w + 0.04; }
          else if (t === 'crate') { const w = 0.42, h = 0.17; put('crate', u + w / 2, yb + h / 2, w, h, 0.28, '#ffffff'); const c = pk(PRODC), big = rnd() < 0.25;
            for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) B.prod.push({p: wpos(r, u + 0.06 + a * 0.1, 0.14 - 0.07 - b * 0.1, yb + h + 0.03), s: wsz(r, 0.11, 0.1, 0.11), c: big ? '#8fb04a' : c});
            for (let a = 0; a < 3; a++) B.prod.push({p: wpos(r, u + 0.11 + a * 0.1, 0.14 - 0.12, yb + h + 0.1), s: wsz(r, 0.1, 0.1, 0.1), c: big ? '#7aa04a' : pk(PRODC)}); adv = w + 0.05; }
          else if (t === 'loaf') { const n = 2 + Math.floor(rnd() * 2); for (let i = 0; i < n; i++) B.loaf.push({p: wpos(r, u + 0.12 + i * 0.25, 0.14 - 0.07, yb + 0.05), s: wsz(r, 0.22, 0.1, 0.12), c: pk(['#d9a04a', '#c4863a', '#e8b868'])}); adv = n * 0.25 + 0.04; }
          u += adv;
        }
      }
      // overstock boxes on top of the shelving (aisle runs)
      if (r.top) for (let u = r.u0 + 0.1; u < r.u0 + r.len - 0.3;) { const w = 0.25 + rnd() * 0.3, h = 0.14 + rnd() * 0.14; if (rnd() < 0.55) B.card.push({p: wpos(r, u + w / 2, -0.04, r.yb + r.levels * r.pitch + 0.1 + h / 2), s: wsz(r, w, h, 0.22), c: pk(['#c9a068', '#b8864e', '#d8b078', '#a8683a'])}); u += w + 0.08 + rnd() * 0.3; }
    }
    return [
      inst(cyl16, m.canLab, B.can), inst(box, m.boxLab, B.box), inst(sph12, m.burlap, B.sack, true), inst(box, m.crate, B.crate, true),
      inst(cyl16, m.plain, B.jarB), inst(cyl16, m.plain, B.jarL), inst(cyl16, m.plain, B.botB), inst(cyl16, m.plain, B.botN), inst(sph12, m.plain, B.prod), inst(sph12, m.plain, B.loaf), inst(box, m.plain, B.card, true),
    ];
  }, [m]);
  return <group>{meshes.map((o, i) => <primitive key={i} object={o} />)}</group>;
};

// ---------- the set ----------
const M: React.FC<{g?: THREE.BufferGeometry; m: THREE.Material; p: V3; s: V3; r?: V3; sh?: boolean; rc?: boolean}> = ({g = box, m, p, s, r, sh = true, rc = true}) =>
  <mesh geometry={g} material={m} position={p} scale={s} rotation={r} castShadow={sh} receiveShadow={rc} />;
const Tb: React.FC<{a: V3; b: V3; r?: number; m: THREE.Material; sq?: boolean}> = ({a, b, r = 0.012, m, sq}) => {
  const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
  return <mesh geometry={sq ? box : cyl} material={m} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={q} scale={sq ? [r * 2, len, r * 2] : [r, len, r]} castShadow />;
};
/** window with daylight glass, frame, mullions, sill. +z of the group = the side the frame/sill stick out to. */
const Win: React.FC<{m: Mats; p: V3; ry?: number; w: number; h: number; gx?: number; gy?: number; frame?: THREE.Material; glass?: THREE.Material; curtain?: boolean}> = ({m, p, ry = 0, w, h, gx = 2, gy = 3, frame, glass, curtain}) => {
  const fm = frame ?? m.trim, t = 0.09, mu: React.ReactNode[] = [];
  for (let i = 1; i < gx; i++) mu.push(<M key={'v' + i} m={fm} p={[-w / 2 + (w * i) / gx, 0, 0.03]} s={[0.035, h, 0.05]} sh={false} />);
  for (let i = 1; i < gy; i++) mu.push(<M key={'h' + i} m={fm} p={[0, -h / 2 + (h * i) / gy, 0.03]} s={[w, 0.035, 0.05]} sh={false} />);
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <M m={glass ?? m.day} g={plane} p={[0, 0, 0.005]} s={[w, h, 1]} sh={false} rc={false} />
      <M m={fm} p={[0, h / 2 + t / 2, 0.04]} s={[w + 2 * t, t, 0.09]} /><M m={fm} p={[0, -h / 2 - t / 2, 0.04]} s={[w + 2 * t, t, 0.09]} />
      <M m={fm} p={[-w / 2 - t / 2, 0, 0.04]} s={[t, h, 0.09]} /><M m={fm} p={[w / 2 + t / 2, 0, 0.04]} s={[t, h, 0.09]} />
      <M m={fm} p={[0, -h / 2 - t - 0.02, 0.1]} s={[w + 0.34, 0.05, 0.2]} />
      {mu}
      {curtain && <><M m={m.cloth} p={[-w / 2 + 0.06, 0, 0.14]} s={[0.2, h * 0.96, 0.05]} sh={false} /><M m={m.cloth} p={[w / 2 - 0.06, 0, 0.14]} s={[0.2, h * 0.96, 0.05]} sh={false} /><M m={m.cloth} p={[0, h / 2 - 0.08, 0.15]} s={[w + 0.1, 0.2, 0.06]} sh={false} /></>}
    </group>
  );
};
/** glazed shop door: kick panels, rails, brass push bar. z0 = plane of the glass, dz = +1 faces +z (street), -1 faces -z (store) */
const DoorFace: React.FC<{m: Mats; z: number; dz: number; fm: THREE.Material; gl: THREE.Material}> = ({m, z, dz, fm, gl}) => (
  <group position={[0, 0, z]} scale={[1, 1, dz]}>
    <M m={gl} g={plane} p={[0, 1.45, 0]} s={[2.34, 1.7, 1]} sh={false} rc={false} /><M m={gl} g={plane} p={[0, 2.45, 0]} s={[2.34, 0.3, 1]} sh={false} rc={false} />
    <M m={fm} p={[0, 0.3, 0.03]} s={[2.4, 0.6, 0.07]} />
    {[-1.2, -0.55, 0.55, 1.2].map((x) => <M key={x} m={fm} p={[x, 1.3, 0.04]} s={[0.1, 2.6, 0.09]} />)}
    <M m={fm} p={[0, 2.3, 0.04]} s={[2.4, 0.1, 0.09]} /><M m={fm} p={[0, 0.62, 0.04]} s={[2.4, 0.08, 0.09]} /><M m={fm} p={[0, 2.62, 0.04]} s={[2.5, 0.1, 0.09]} />
    {[0.4, -0.4].map((x) => <Tb key={x} a={[x, 0.85, 0.12]} b={[x, 1.35, 0.12]} r={0.016} m={m.brass} />)}
    <M m={m.brass} p={[0.0, 0.3, 0.075]} s={[1.0, 0.16, 0.01]} sh={false} />
  </group>
);
const Pendant: React.FC<{m: Mats; p: V3; s?: number}> = ({m, p, s = 1}) => (
  <group position={p} scale={s}>
    <M m={m.iron} g={cyl} p={[0, 0.3, 0]} s={[0.008, 0.6, 0.008]} sh={false} rc={false} /><M m={m.iron} g={cyl} p={[0, 0.6, 0]} s={[0.05, 0.03, 0.05]} sh={false} rc={false} />
    <M m={m.shade} g={cone} p={[0, 0.1, 0]} s={[0.46, 0.2, 0.46]} sh={false} rc={false} /><M m={m.iron} g={cyl} p={[0, 0.21, 0]} s={[0.025, 0.04, 0.025]} sh={false} rc={false} />
    <M m={m.lamp} g={circ} p={[0, 0.0, 0]} s={[0.2, 0.2, 1]} r={[Math.PI / 2, 0, 0]} sh={false} rc={false} /><M m={m.lamp} g={sph} p={[0, -0.04, 0]} s={[0.07, 0.07, 0.07]} sh={false} rc={false} />
  </group>
);
const PriceCards: React.FC<{m: Mats}> = ({m}) => {
  const meshes = useMemo(() => {
    const out: THREE.InstancedMesh[] = [], k0 = [[], [], [], []] as {p: V3; ry: number}[][]; let k = 99; const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647);
    for (const r of RUNS.slice(0, 2)) for (let l = 0; l < 4; l++) for (let u = r.u0 + 0.2; u < r.u0 + r.len - 0.1; u += 0.5 + rnd() * 0.7) k0[Math.floor(rnd() * 4)].push({p: wpos(r, u, 0.17, r.yb + l * r.pitch - 0.0 + 0.0), ry: r.ax === 'z' ? -r.dir * Math.PI / 2 * -1 : 0});
    k0.forEach((arr, i) => { const g = plane.clone(); const a = g.attributes.uv; for (let j = 0; j < a.count; j++) a.setX(j, i * 0.25 + a.getX(j) * 0.25); const mm = new THREE.InstancedMesh(g, m.prices, Math.max(1, arr.length)); mm.count = arr.length; const o = new THREE.Object3D();
      arr.forEach((it, j) => { o.position.set(it.p[0], it.p[1] - 0.075, it.p[2]); o.rotation.set(0, it.ry, 0); o.scale.set(0.11, 0.065, 1); o.updateMatrix(); mm.setMatrixAt(j, o.matrix); }); mm.frustumCulled = false; out.push(mm); });
    return out;
  }, [m]);
  return <group>{meshes.map((o, i) => <primitive key={i} object={o} />)}</group>;
};
const ShelfUnits: React.FC<{m: Mats}> = ({m}) => (
  <group>
    {RUNS.map((r, ri) => {
      const aisle = !!r.top, uc = r.u0 + r.len / 2, y0 = r.yb - 0.02, H = r.levels * r.pitch, els: React.ReactNode[] = [];
      for (let l = 0; l <= r.levels; l++) { els.push(<M key={'b' + l} m={m.shelfBoard} p={wpos(r, uc, -0.03, y0 + l * r.pitch)} s={wsz(r, r.len, 0.04, 0.36)} />);
        if (l < r.levels) els.push(<M key={'l' + l} m={m.trim} p={wpos(r, uc, 0.158, y0 + l * r.pitch + 0.0275)} s={wsz(r, r.len, 0.055, 0.02)} sh={false} />); }
      const n = Math.round(r.len / 1.6);
      for (let i = 0; i <= n; i++) els.push(<M key={'u' + i} m={m.woodD} p={wpos(r, r.u0 + (r.len * i) / n, 0.18, y0 + H / 2 + 0.03)} s={wsz(r, 0.05, H + 0.1, 0.05)} />);
      if (aisle) {
        els.push(<M key="slab" m={m.shelf} p={[r.base * (1.5 / 1.3), 1.0, -7.1]} s={[0.12, 2.0, 9.8]} />);
        els.push(<M key="cor" m={m.trim} p={wpos(r, uc, 0.03, y0 + H + 0.08)} s={wsz(r, r.len + 0.05, 0.1, 0.46)} />);
        els.push(<M key="cor2" m={m.woodD} p={wpos(r, uc, 0.255, y0 + H + 0.06)} s={wsz(r, r.len + 0.05, 0.06, 0.03)} sh={false} />);
        [0, 1, 2, 3].forEach((i) => els.push(<M key={'ad' + i} m={m.ad[(i + ri * 2 + 1) % 6]} p={wpos(r, -11.0 + i * 2.5, 0.12, y0 + H + 0.35)} s={wsz(r, 0.95, 0.36, 0.035)} />));
        els.push(<M key="endcap" m={m.woodD} p={wpos(r, r.u0 + r.len + 0.03, -0.03, y0 + H / 2 + 0.03)} s={wsz(r, 0.05, H + 0.1, 0.4)} />);
      } else els.push(<M key="panel" m={m.shelf} p={wpos(r, uc, -0.2, y0 + H / 2 + 0.03)} s={wsz(r, r.len, H + 0.1, 0.03)} />);
      return <group key={ri}>{els}</group>;
    })}
  </group>
);

const Set: React.FC<{m: Mats; f: number}> = ({m, f}) => {
  const k = moodAt(f);
  m.day.color.setRGB(1.25 - 1.0 * k, 1.2 - 0.88 * k, 1.1 - 0.5 * k); m.disp.color.setRGB(0.95 - 0.55 * k, 0.9 - 0.5 * k, 0.85 - 0.3 * k); m.sky.color.setRGB(1 - 0.78 * k, 1 - 0.72 * k, 1 - 0.55 * k);
  m.chrome.color.set('#ffffff').lerp(new THREE.Color('#8091c8'), k); m.brass.color.set('#ffffff').lerp(new THREE.Color('#8091c8'), k);
  const pend: V3[] = [[0, 2.95, -10], [0, 2.95, -6], [0, 2.95, -2], [0, 2.95, 1.5], [-2.4, 2.95, 1.6], [2.6, 2.95, 1.5]];
  return (
    <group>
      {/* ---- store shell ---- */}
      <M m={m.floor} g={plane} p={[0, 0, -5]} s={[8, 18, 1]} r={[-Math.PI / 2, 0, 0]} sh={false} />
      <M m={m.wall} p={[0, 1.8, -14]} s={[8, 3.6, 0.1]} />
      <M m={m.wallS} p={[-4, 1.8, -5]} s={[0.1, 3.6, 18]} /><M m={m.wallS} p={[4, 1.8, -5]} s={[0.1, 3.6, 18]} />
      <M m={m.wall} p={[-2.6, 1.8, 4]} s={[2.8, 3.6, 0.1]} /><M m={m.wall} p={[2.6, 1.8, 4]} s={[2.8, 3.6, 0.1]} /><M m={m.wall} p={[0, 3.1, 4]} s={[2.4, 1.0, 0.1]} />
      <M m={m.tin} g={plane} p={[0, 3.6, -5]} s={[8, 18, 1]} r={[Math.PI / 2, 0, 0]} sh={false} rc={false} />
      {[-13, -10, -7, -4, -1, 2].map((z) => <M key={z} m={m.woodD} p={[0, 3.5, z]} s={[8, 0.2, 0.26]} sh={false} rc={false} />)}
      <M m={m.woodD} p={[0, 3.5, -13.95]} s={[8, 0.2, 0.1]} sh={false} rc={false} />
      <M m={m.roof} p={[0, 3.72, -5]} s={[8.2, 0.2, 18.4]} sh={false} />
      {pend.map((p, i) => <Pendant key={i} m={m} p={p} s={i > 3 ? 0.8 : 1} />)}
      <M m={m.woodD} p={[-3.95, 0.07, -5]} s={[0.1, 0.14, 18]} sh={false} /><M m={m.woodD} p={[3.95, 0.07, -5]} s={[0.1, 0.14, 18]} sh={false} />
      {/* ---- shelving, products, ads ---- */}
      <ShelfUnits m={m} /><Products m={m} /><PriceCards m={m} />
      {/* side-wall decor above the shelves (visible from the aisle) */}
      {[-11, -7.5, -4].map((z, i) => <group key={z}>
        <M m={m.ad[(i + 3) % 6]} p={[-3.93, 2.95, z]} s={[0.04, 0.5, 1.3]} sh={false} /><M m={m.ad[(i + 1) % 6]} p={[3.93, 2.95, z + 0.6]} s={[0.04, 0.5, 1.3]} sh={false} />
        <M m={m.woodD} p={[-3.94, 2.95, z]} s={[0.03, 0.58, 1.38]} sh={false} /><M m={m.woodD} p={[3.94, 2.95, z + 0.6]} s={[0.03, 0.58, 1.38]} sh={false} />
      </group>)}
      <Win m={m} p={[-3.93, 1.75, -1.2]} ry={Math.PI / 2} w={1.3} h={1.2} gx={2} gy={2} curtain /><Win m={m} p={[3.93, 1.75, 0.5]} ry={-Math.PI / 2} w={1.3} h={1.2} gx={2} gy={2} curtain />
      {/* pyramids of cans at the end-caps */}
      <mesh geometry={pyramidG()} material={m.red} position={[-2.2, 0, -1.4]} castShadow /><mesh geometry={pyramidG()} material={m.shade} position={[2.2, 0, -1.4]} castShadow />
      <M m={m.ad[3]} p={[-2.2, 0.62, -1.4]} s={[0.5, 0.2, 0.03]} sh={false} r={[0, 0.3, 0]} /><M m={m.ad[0]} p={[2.2, 0.62, -1.4]} s={[0.5, 0.2, 0.03]} sh={false} r={[0, -0.3, 0]} />
      {/* ---- checkout counter + register ---- */}
      <M m={m.counter} p={[-2.4, 0.45, 1.6]} s={[1.6, 0.9, 0.7]} /><M m={m.counterTop} p={[-2.4, 1.015, 1.6]} s={[1.72, 0.07, 0.84]} />
      <M m={m.woodD} p={[-2.4, 0.04, 1.6]} s={[1.64, 0.08, 0.74]} />
      {[0, 1, 2, 3].map((i) => <group key={i}><M m={m.counterP} p={[-2.4 - 0.6 + i * 0.4, 0.46, 1.955]} s={[0.32, 0.62, 0.03]} /><M m={m.woodD} p={[-2.4 - 0.6 + i * 0.4, 0.46, 1.945]} s={[0.36, 0.66, 0.02]} sh={false} /></group>)}
      <Tb a={[-3.15, 0.16, 2.0]} b={[-1.65, 0.16, 2.0]} r={0.018} m={m.brass} />
      <group position={[-2.6, 1.05, 1.6]}>
        <M m={m.brass} p={[0, 0.1, 0]} s={[0.5, 0.2, 0.42]} /><M m={m.cream} p={[0, 0.07, 0.215]} s={[0.4, 0.04, 0.012]} sh={false} /><M m={m.iron} p={[0, 0.07, 0.222]} s={[0.04, 0.025, 0.01]} sh={false} />
        <M m={m.brass} p={[0, 0.27, -0.02]} s={[0.46, 0.15, 0.34]} /><M m={m.regKeys} g={plane} p={[0, 0.27, 0.16]} s={[0.42, 0.14, 1]} r={[-0.5, 0, 0]} sh={false} />
        <M m={m.brass} p={[0, 0.4, -0.04]} s={[0.34, 0.14, 0.14]} /><M m={m.regTag} g={plane} p={[0, 0.41, 0.032]} s={[0.28, 0.1, 1]} sh={false} /><M m={m.brass} p={[0, 0.49, -0.04]} s={[0.38, 0.035, 0.18]} />
        <mesh geometry={sph} material={m.brass} position={[0, 0.52, -0.04]} scale={0.03} /><Tb a={[0.26, 0.3, 0.0]} b={[0.34, 0.38, 0.0]} r={0.012} m={m.brass} /><mesh geometry={sph} material={m.red} position={[0.34, 0.39, 0]} scale={0.03} />
      </group>
      <group position={[-1.95, 1.05, 1.62]}>
        <M m={m.iron} g={cyl} p={[0, 0.02, 0]} s={[0.14, 0.04, 0.14]} /><M m={m.cream} p={[0, 0.2, -0.02]} s={[0.14, 0.34, 0.1]} /><M m={m.dial} g={plane} p={[0, 0.3, 0.04]} s={[0.2, 0.2, 1]} sh={false} /><M m={m.chrome} g={cyl} p={[0, 0.4, 0]} s={[0.14, 0.015, 0.14]} />
      </group>
      {[[-1.78, 0], [-1.9, 1], [-1.72, 2]].map(([x, i], j) => <group key={j} position={[x as number, 1.05, 1.95 - (j % 2) * 0.1]}><M m={m.plain} g={cyl16} p={[0, 0.08, 0]} s={[0.11, 0.16, 0.11]} sh={false} /><M m={[m.red, m.green, m.bread][i as number]} g={cyl16} p={[0, 0.17, 0]} s={[0.115, 0.035, 0.115]} sh={false} /></group>)}
      <M m={m.bread} p={[-3.05, 1.12, 1.8]} s={[0.22, 0.14, 0.14]} /><M m={m.bread} p={[-3.05, 1.26, 1.8]} s={[0.2, 0.1, 0.13]} />
      {/* backbar on the left wall */}
      <M m={m.ad[2]} p={[-3.93, 2.7, 1.7]} s={[0.04, 0.4, 1.3]} sh={false} /><M m={m.clock} g={circ} p={[-3.9, 2.35, 0.8]} s={[0.25, 0.25, 1]} r={[0, Math.PI / 2, 0]} sh={false} rc={false} />
      <M m={m.chalk} g={plane} p={[-3.9, 1.85, 3.3]} s={[0.9, 0.68, 1]} r={[0, Math.PI / 2, 0]} sh={false} rc={false} />
      {/* ---- front wall interior: daylight windows + glazed door ---- */}
      <Win m={m} p={[-2.4, 1.5, 3.94]} ry={Math.PI} w={2.0} h={1.5} gx={3} gy={2} curtain /><Win m={m} p={[2.4, 1.5, 3.94]} ry={Math.PI} w={2.0} h={1.5} gx={3} gy={2} curtain />
      
      <M m={m.doormat} p={[0, 0.012, 3.35]} s={[1.5, 0.024, 0.8]} sh={false} />
      
      {/* pickle barrel + produce crates by the entrance */}
      <group position={[3.6, 0, 3.55]}><M m={m.barrel} g={cyl16} p={[0, 0.3, 0]} s={[0.56, 0.6, 0.56]} /><Tb a={[-0.28, 0.12, 0]} b={[0.28, 0.12, 0]} r={0.0001} m={m.iron} />
        {[0.12, 0.48].map((y) => <M key={y} m={m.iron} g={cyl16} p={[0, y, 0]} s={[0.585, 0.035, 0.585]} sh={false} />)}<M m={m.cream} g={cyl16} p={[0, 0.61, 0]} s={[0.52, 0.02, 0.52]} sh={false} /></group>
      {[[-3.45, 3.5, 0], [-3.45, 3.5, 1], [-3.35, 3.55, 2]].map(([x, z, i], j) => <group key={j}><M m={m.crate} p={[x as number, 0.1 + (i as number === 2 ? 0.2 : 0), (z as number) - (i as number === 1 ? 0.45 : 0)]} s={[0.55, 0.2, 0.4]} />
        {[0, 1, 2, 3].map((a) => <mesh key={a} geometry={sph12} material={[m.apple, m.orange, m.cabbage][i as number]} position={[(x as number) - 0.2 + a * 0.13, 0.25 + (i as number === 2 ? 0.2 : 0), (z as number) - (i as number === 1 ? 0.45 : 0) + (a % 2) * 0.04]} scale={0.14} castShadow />)}</group>)}
      {/* ---- back wall: delivery door, sconce, stacked stock ---- */}
      <M m={m.woodD} p={[-2.2, 1.1, -13.93]} s={[1.0, 2.2, 0.06]} />
      <M m={m.green} p={[-2.2, 1.14, -13.9]} s={[0.92, 2.12, 0.04]} />
      {[0.55, -0.45].map((y, i) => <M key={i} m={m.greenD} p={[-2.2, 1.1 + y * 0.8, -13.88]} s={[0.66, i ? 0.7 : 0.8, 0.03]} sh={false} />)}
      <M m={m.trim} p={[-2.2, 2.28, -13.9]} s={[1.3, 0.1, 0.1]} /><M m={m.trim} p={[-2.78, 1.1, -13.9]} s={[0.1, 2.3, 0.1]} /><M m={m.trim} p={[-1.62, 1.1, -13.9]} s={[0.1, 2.3, 0.1]} />
      <mesh geometry={sph} material={m.brass} position={[-1.88, 1.0, -13.86]} scale={0.04} /><M m={m.ad[4]} p={[-2.2, 2.62, -13.93]} s={[1.0, 0.26, 0.03]} sh={false} />
      <Tb a={[-1.3, 1.9, -13.9]} b={[-1.3, 1.9, -13.75]} r={0.012} m={m.iron} /><M m={m.lamp} g={sph} p={[-1.3, 1.9, -13.72]} s={[0.09, 0.09, 0.09]} sh={false} rc={false} />
      <M m={m.clock} g={circ} p={[1.4, 2.95, -13.92]} s={[0.3, 0.3, 1]} sh={false} rc={false} /><M m={m.ad[0]} p={[-0.6 + 0.0, 2.95, -13.93]} s={[1.3, 0.46, 0.04]} sh={false} /><M m={m.ad[5]} p={[3.0, 2.95, -13.93]} s={[1.3, 0.46, 0.04]} sh={false} />
      {[[-1.3, 0], [-1.3, 1]].map(([x, i], j) => <M key={j} m={m.crate} p={[x as number, 0.15 + (i as number) * 0.3, -13.6]} s={[0.55, 0.28, 0.42]} />)}
      <M m={m.burlap} g={sph12} p={[-0.95, 0.15, -13.55]} s={[0.4, 0.3, 0.3]} />
      {/* ---- exterior facade ---- */}
      {[-1, 1].map((sx) => <group key={'fc' + sx}><M m={m.facade} p={[sx * 2.65, 2.3, 4.12]} s={[2.9, 4.6, 0.12]} />
        <M m={m.green} p={[sx * 2.65, 0.3, 4.22]} s={[2.9, 0.6, 0.1]} /><M m={m.stone} p={[sx * 2.65, 0.63, 4.24]} s={[2.9, 0.06, 0.16]} /></group>)}
      <M m={m.facade} p={[0, 3.6, 4.12]} s={[2.4, 2.0, 0.12]} />
      <Win m={m} p={[-2.4, 1.55, 4.2]} w={2.0} h={1.6} gx={3} gy={1} frame={m.greenD} glass={m.disp} /><Win m={m} p={[2.4, 1.55, 4.2]} w={2.0} h={1.6} gx={3} gy={1} frame={m.greenD} glass={m.disp} />
      {/* front door propped open (people walk in): two leaves swung inward */}
      {[-1, 1].map((sx) => <group key={sx} position={[sx * 1.17, 0, 4.1]} rotation={[0, sx * -1.35, 0]}><M m={m.greenD} p={[-sx * 0.58, 1.3, 0]} s={[1.16, 2.6, 0.06]} /><M m={m.glass} g={plane} p={[-sx * 0.58, 1.5, 0.035]} s={[0.9, 1.6, 1]} sh={false} rc={false} /></group>)}
      <M m={m.greenD} p={[0, 2.62, 4.2]} s={[2.5, 0.1, 0.12]} />
      <M m={m.stone} p={[0, 0.03, 4.55]} s={[2.7, 0.06, 0.7]} />
      {[-4.0, 4.0].map((x) => <M key={x} m={m.stone} p={[x, 2.2, 4.23]} s={[0.3, 4.2, 0.18]} />)}
      <M m={m.stone} p={[0, 4.46, 4.26]} s={[8.4, 0.14, 0.22]} /><M m={m.stone} p={[0, 4.66, 4.3]} s={[8.6, 0.18, 0.4]} /><M m={m.trim} p={[0, 4.78, 4.12]} s={[8.4, 0.14, 0.14]} />
      {Array.from({length: 18}, (_, i) => <M key={i} m={m.trim} p={[-3.85 + i * 0.45, 4.54, 4.32]} s={[0.12, 0.12, 0.12]} sh={false} />)}
      <M m={m.iron} p={[0, 3.7, 4.2]} s={[3.85, 1.02, 0.05]} /><M m={m.sign} p={[0, 3.7, 4.235]} s={[3.6, 0.9, 0.05]} />
      {[-1.4, 1.4].map((x) => <group key={x}><Tb a={[x, 4.3, 4.24]} b={[x, 4.36, 4.55]} r={0.012} m={m.iron} /><M m={m.shade} g={cone} p={[x, 4.3, 4.56]} s={[0.26, 0.14, 0.26]} sh={false} /><M m={m.lamp} g={sph} p={[x, 4.24, 4.56]} s={[0.05, 0.05, 0.05]} sh={false} rc={false} /></group>)}
      <M m={m.awning} g={plane} p={[0, 2.75, 4.7]} s={[8.2, 1.1, 1]} r={[-0.95, 0, 0]} /><M m={m.valance} g={plane} p={[0, 2.31, 5.16]} s={[8.2, 0.26, 1]} sh={false} />
      <Tb a={[-4.05, 2.43, 5.15]} b={[4.05, 2.43, 5.15]} r={0.02} m={m.iron} />
      {[-3.95, 3.95].map((x) => <Tb key={x} a={[x, 2.43, 5.15]} b={[x, 0.0, 5.15]} r={0.03} m={m.iron} />)}
      {/* A-frame boards on the pavement */}
      {[[2.6, -0.25, 'sign2'], [-2.7, 0.3, 'chalk']].map(([x, ry, mk]) => <group key={mk as string} position={[x as number, 0, 4.85]} rotation={[0, ry as number, 0]}>
        <mesh geometry={box} material={[m.woodD, m.woodD, m.woodD, m.woodD, (m as any)[mk as string], m.woodD]} position={[0, 0.46, 0.0]} rotation={[-0.12, 0, 0]} scale={[0.64, 0.92, 0.05]} castShadow />
        <M m={m.woodD} p={[0, 0.43, -0.2]} s={[0.58, 0.88, 0.03]} r={[0.2, 0, 0]} /></group>)}
      {/* street */}
      {/* street surfaces, lamps, hydrants and the neighbouring blocks live in town.tsx */}
      <group position={[-3.7, 0, 4.75]}><M m={(m as any).sign2} p={[0, 0.9, 0]} s={[0.4, 0.5, 0.4]} /><M m={m.iron} p={[0, 0.3, 0]} s={[0.06, 0.6, 0.06]} /></group>
      {/* ---- workshop (x = 12) ---- */}
      <M m={m.woodFloor} g={plane} p={[12, 0, 0.85]} s={[4.2, 4.7, 1]} r={[-Math.PI / 2, 0, 0]} sh={false} />
      <M m={m.workWall} p={[12, 1.6, -1.5]} s={[4.2, 3.2, 0.1]} /><M m={m.workWall} p={[9.95, 1.6, 1.25]} s={[0.1, 3.2, 5.5]} /><M m={m.workWall} p={[14.05, 1.6, 1.25]} s={[0.1, 3.2, 5.5]} /><M m={m.woodFloor} g={plane} p={[12, 0.002, 3.6]} s={[4.2, 0.9, 1]} r={[-Math.PI / 2, 0, 0]} sh={false} />
      <M m={m.woodD} p={[12, 3.15, 0.85]} s={[4.2, 0.12, 0.2]} sh={false} /><M m={m.woodD} p={[12, 0.08, -1.42]} s={[4.2, 0.16, 0.06]} sh={false} />
      <M m={m.help} p={[3.94, 1.9, -1.0]} s={[0.04, 0.6, 1.2]} />
      <M m={m.peg} g={plane} p={[11.35, 1.85, -1.44]} s={[2.2, 1.1, 1]} sh={false} /><M m={m.woodD} p={[11.35, 2.43, -1.44]} s={[2.3, 0.06, 0.05]} sh={false} /><M m={m.woodD} p={[11.35, 1.27, -1.44]} s={[2.3, 0.06, 0.05]} sh={false} />
      <Win m={m} p={[13.25, 2.3, -1.44]} w={0.9} h={0.8} gx={2} gy={2} frame={m.woodD} />
      <group position={[11.4, 0, -1.1]}>
        <M m={m.wood} p={[0, 0.88, 0]} s={[2.3, 0.07, 0.72]} />{[[-1.05, -0.3], [1.05, -0.3], [-1.05, 0.3], [1.05, 0.3]].map(([x, z], i) => <M key={i} m={m.woodD} p={[x, 0.42, z]} s={[0.09, 0.84, 0.09]} />)}
        <M m={m.woodD} p={[0, 0.25, 0]} s={[2.1, 0.04, 0.62]} /><M m={m.woodD} p={[0, 0.78, 0.33]} s={[2.1, 0.1, 0.03]} />
        <M m={m.iron} p={[-1.0, 0.99, 0.2]} s={[0.14, 0.14, 0.16]} /><M m={m.chrome} p={[-1.0, 1.04, 0.31]} s={[0.1, 0.1, 0.04]} />
        {[-0.5, -0.28, -0.06, 0.16].map((x, i) => <group key={i}><M m={m.tire} g={cyl} p={[x, 1.0, -0.1]} s={[0.07, 0.04, 0.07]} r={[Math.PI / 2, 0, 0]} sh={false} /><M m={m.chrome} g={cyl} p={[x, 1.0, -0.1]} s={[0.03, 0.05, 0.03]} r={[Math.PI / 2, 0, 0]} sh={false} /></group>)}
        <Tb a={[0.1, 0.945, 0.15]} b={[0.9, 0.945, 0.15]} r={0.012} m={m.chrome} /><Tb a={[0.1, 0.945, 0.2]} b={[0.8, 0.945, 0.2]} r={0.012} m={m.chrome} /><Tb a={[0.3, 0.945, 0.25]} b={[0.9, 0.945, 0.25]} r={0.012} m={m.chrome} />
        <M m={m.paint} g={cyl16} p={[0.6, 0.98, -0.2]} s={[0.12, 0.14, 0.12]} /><M m={m.red} g={cyl16} p={[0.78, 0.97, -0.15]} s={[0.1, 0.12, 0.1]} />
        <M m={m.cream} p={[0.2, 0.92, -0.2]} s={[0.46, 0.006, 0.32]} r={[0, 0.2, 0]} sh={false} /><M m={m.iron} g={circ} p={[-0.3, 0.925, 0.2]} s={[0.1, 0.1, 1]} r={[-Math.PI / 2, 0, 0]} sh={false} />
        <M m={m.shade} g={cone} p={[0.3, 2.45, 0.7]} s={[0.4, 0.2, 0.4]} sh={false} /><M m={m.iron} g={cyl} p={[0.3, 2.85, 0.7]} s={[0.008, 0.8, 0.008]} sh={false} /><M m={m.lamp} g={sph} p={[0.3, 2.34, 0.7]} s={[0.09, 0.09, 0.09]} sh={false} rc={false} />
      </group>
      <group position={[13.3, 0, -1.15]}>
        {[0.05, 0.6, 1.15, 1.7].map((y, i) => <M key={i} m={m.woodD} p={[0, y, 0]} s={[1.1, 0.04, 0.5]} />)}<M m={m.woodD} p={[-0.54, 0.85, 0]} s={[0.05, 1.7, 0.5]} /><M m={m.woodD} p={[0.54, 0.85, 0]} s={[0.05, 1.7, 0.5]} />
        <group position={[0, 0.0, 0.0]}><Basket m={m} p={[-0.15, 0.78, 0]} fill={0} /><Basket m={m} p={[0.2, 0.75, 0.0]} fill={0} /></group>
        {[-0.35, -0.15, 0.05, 0.25, 0.42].map((x, i) => <M key={i} m={[m.paint, m.red, m.cream, m.paint, m.red][i]} g={cyl16} p={[x, 1.24, 0]} s={[0.14, 0.16, 0.14]} />)}
        {[-0.3, 0.0, 0.3].map((x, i) => <M key={i} m={m.crate} p={[x, 0.17, 0]} s={[0.28, 0.2, 0.36]} />)}
      </group>
      <group position={[10.5, 0, 0.9]}>{[-0.4, 0.4].map((x) => <group key={x}><Tb a={[x, 0.0, -0.18]} b={[x, 0.72, 0]} r={0.035} m={m.wood} sq /><Tb a={[x, 0.0, 0.18]} b={[x, 0.72, 0]} r={0.035} m={m.wood} sq /></group>)}<M m={m.woodFrame} p={[0, 0.76, 0]} s={[1.3, 0.05, 0.24]} /></group>
      <M m={m.cream} g={cone} p={[10.9, 0.05, -0.5]} s={[0.4, 0.1, 0.4]} sh={false} /><M m={m.crate} p={[13.55, 0.2, 0.9]} s={[0.5, 0.35, 0.4]} /><M m={m.crate} p={[13.5, 0.5, 0.9]} s={[0.45, 0.25, 0.38]} r={[0, 0.3, 0]} />
    </group>
  );
};

// ---------- the cart (folding chair + wheels + two wire baskets) ----------
const Basket: React.FC<{m: Mats; p: V3; fill: number}> = ({m, p, fill}) => (
  <group position={p}>
    <mesh geometry={basketWireG()} material={m.wire} />
    <mesh geometry={basketMetalG()} material={m.chrome} castShadow />
    {fill > 0 && <>
      {[[0, 0, 0.05], [0.06, 0, -0.05], [-0.06, 0.01, -0.03], [0, 0.09, 0]].map(([x, y, z], i) => <mesh key={i} geometry={sph12} material={m.apple} position={[-0.14 + x, -0.02 + y, z]} scale={0.12} castShadow />)}
      {fill * 3 > 1 && <><mesh geometry={cyl16} material={m.bread} position={[0.04, 0.04, -0.02]} rotation={[Math.PI / 2, 0, 0.25]} scale={[0.1, 0.3, 0.1]} castShadow /><mesh geometry={cyl16} material={m.bottle} position={[0.04, 0.02, 0.09]} scale={[0.07, 0.3, 0.07]} castShadow /></>}
      {fill * 3 > 2 && <mesh geometry={sph12} material={m.cabbage} position={[0.16, 0.02, 0]} scale={0.18} castShadow />}
    </>}
  </group>
);
const Cart: React.FC<{m: Mats; c: CartP; f: number}> = ({m, c, f}) => {
  const wood = (c.wood ?? 0) > 0.5, w = c.wheels ?? 1, b1 = c.b1 ?? 1, b2 = c.b2 ?? 1;
  return (
    <group position={c.p} rotation={[0, c.ry ?? 0, 0]} scale={(c.sc ?? 1) * CART_K}>
      <mesh geometry={circ} material={m.blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} scale={[0.42, 0.3, 1]} />
      <mesh geometry={frameG(wood)} material={wood ? m.woodFrame : m.chrome} castShadow receiveShadow />
      {!wood && <M m={m.rubber} g={cyl} p={[-0.3, 1.0, 0]} s={[0.021, 0.27, 0.021]} r={[Math.PI / 2, 0, 0]} />}
      {wood && b1 < 0.05 && <mesh geometry={seatG()} material={m.woodFrame} castShadow receiveShadow />}
      {w > 0.001 && [[-0.26, -0.2], [-0.26, 0.2], [0.26, -0.2], [0.26, 0.2]].map(([x, z], i) => <group key={i}>
        <M m={m.tire} g={cyl} p={[x, 0.055, z]} s={[0.055 * pop(w), 0.034 * pop(w), 0.055 * pop(w)]} r={[Math.PI / 2, 0, (c.spin ?? 0)]} />
        <M m={m.chrome} g={cyl} p={[x, 0.055, z]} s={[0.026 * pop(w), 0.04 * pop(w), 0.026 * pop(w)]} r={[Math.PI / 2, 0, (c.spin ?? 0)]} sh={false} />
        {!wood && <M m={m.chrome} p={[x, 0.11, z]} s={[0.04, 0.03, 0.045]} sh={false} />}</group>)}
      {b1 > 0.001 && <Basket m={m} p={[0, 0.62 + 0.14 + (1 - ease(b1)) * 1.4, 0]} fill={c.fill ?? 0} />}
      {b2 > 0.001 && <Basket m={m} p={[0, 0.2 + 0.12 + (1 - ease(b2)) * 1.4, 0]} fill={0} />}
      {(c.dust ?? 0) > 0 && Array.from({length: 26}, (_, i) => {
        const a = i * 2.39, r = 0.15 + (i % 5) * 0.06, y = 0.3 + ((i * 0.137 + f * 0.0012) % 1) * 0.9;
        return <mesh key={'d' + i} geometry={circ} material={m.dust} position={[Math.cos(a) * r, y, Math.sin(a) * r]} scale={0.006 + (i % 3) * 0.003} />;
      })}
    </group>
  );
};


// ---------- extras ----------
const Extras: React.FC<{m: Mats; f: number; x: string[]}> = ({m, f, x}) => {
  const s = shotAt(f);
  return (<>
    {x.map((e) => e.startsWith('cal') && <group key={e} position={[3.93, 1.8, 2.4]} rotation={[0, 0, Math.sin(s.lf * 0.6) * 0.05 * Math.max(0, 1 - s.lf / 15)]}>
      <mesh geometry={box} material={m.cal[+e[3] - 1]} position={[0, -0.25, 0]} scale={[0.04, 0.5, 0.4]} castShadow />
      <mesh geometry={box} material={m.cream} position={[0.02, -0.26, 0]} scale={[0.02, 0.5, 0.38]} />
      <mesh geometry={box} material={m.red} position={[-0.01, 0.03, 0]} scale={[0.07, 0.06, 0.46]} />
      <mesh geometry={sph} material={m.iron} position={[-0.05, 0.1, 0]} scale={0.018} />
    </group>)}
    {x.includes('weed') && <group position={[3.3 - s.lf * 0.06, 0.22 + Math.abs(Math.sin(s.lf * 0.25)) * 0.12, 1.9]} rotation={[0, 0, s.lf * 0.23]}>
      <mesh geometry={weedG[0]} material={m.weed} />{[0, 1, 2].map((i) => <mesh key={i} geometry={weedG[1 + i]} material={m.weedS} rotation={[i * 1.1, i * 0.7, i * 1.9]} />)}
    </group>}
    {x.includes('bulb') && <mesh geometry={plane} material={m.bulb} position={[-2.4, 2.0 + Math.sin(s.lf * 0.3) * 0.03, -0.3]} scale={0.36 * pop(s.lf / 8)} rotation={[0, 0.9, 0]} />}
    {x.includes('coins') && Array.from({length: 7}, (_, i) => { const t = (s.lf * 0.035 + i * 0.14) % 1;
      return <mesh key={i} geometry={plane} material={m.coin} position={[-2.4 + (i % 2 ? 0.45 : -0.45) + Math.sin(i * 2.1) * 0.1, 2.3 - t * 1.6, -13.0]} scale={0.12} rotation={[0, 0.6, t * 6]} />; })}
  </>);
};

export {useMats, Set, Cart, Extras};
export type {Mats};
