// The 1930s downtown block: parametric storefronts on both sides, towers, painted sky, street surfaces + furniture.
// All static geometry is merged into a handful of meshes (one per material) and built once; layout lives in townData.ts.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {LOOK_SKY, LOOK_RAMP as ramp, lookColor, lookToon, lookHex, LOOK_PREM, X, V5, lookPal, type Tod} from '../../look/look';   // LOOK
import {drawBrick, drawAsphalt, drawSidewalk} from '../../look/draw';
import {UNITS, Unit, unitH, GF, FLH, DEPTH, NEAR_Z, FAR_Z, CURB_N, CURB_F, TOWERS, LAMPS_N, LAMPS_F, CLOCK, HYDRANTS, MAILBOX, BINS} from './townData';

const INK = '#241726', FONT = '"Archivo Black", Impact, sans-serif';
const cv = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c: HTMLCanvasElement, rep = false) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const R = (s: number) => () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);
const toon = lookToon;   // LOOK: soft ramp + harmonised colours

// ---------------- atlas: signs (32 slots 512x128), shop displays (8 slots 512x384), doors, upper windows (16 slots 128x256) ----------------
const AW = 2048;
type UVR = [number, number, number, number];   // u0 v0 u1 v1 (v up)
const px2uv = (x: number, y: number, w: number, h: number): UVR => [x / AW, 1 - (y + h) / AW, (x + w) / AW, 1 - y / AW];
const signSlot = (i: number) => px2uv((i % 4) * 512, Math.floor(i / 4) * 128, 512, 128);
const dispSlot = (i: number) => px2uv((i % 4) * 512, 1024 + Math.floor(i / 4) * 384, 512, 384);
const winSlot = (i: number) => px2uv((i % 16) * 128, 1792, 128, 256);
const SIGNS: string[] = [];   // index = slot
const signIndex = (t: string) => { let i = SIGNS.indexOf(t); if (i < 0) { SIGNS.push(t); i = SIGNS.length - 1; } return i; };
const SIGN_STYLE = new Map<string, [string, string]>();
function paintAtlas() {
  const c = cv(AW, AW), g = c.getContext('2d')!; g.lineJoin = 'round';
  // signs
  SIGNS.forEach((t, i) => { const x = (i % 4) * 512, y = Math.floor(i / 4) * 128, [bg, fg] = SIGN_STYLE.get(t) ?? ['#241726', '#f2e3c0'];
    g.fillStyle = bg; g.fillRect(x, y, 512, 128); g.lineWidth = 10; g.strokeStyle = fg; g.strokeRect(x + 9, y + 9, 494, 110); g.lineWidth = 4; g.strokeStyle = INK; g.strokeRect(x + 2, y + 2, 508, 124);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 78; g.font = `900 ${fs}px ${FONT}`; while (g.measureText(t).width > 450) { fs -= 3; g.font = `900 ${fs}px ${FONT}`; }
    g.fillText(t, x + 256, y + 68); });
  // shop displays: warm interior, shelves, goods silhouettes, glass reflection
  const goods: ((x: number, y: number, r: () => number) => void)[] = [
    (x, y, r) => { for (let k = 0; k < 9; k++) { g.fillStyle = ['#d0532f', '#f2b234', '#3f8a86', '#7aa04a'][k % 4]; g.fillRect(x + 40 + (k % 3) * 150, y + 120 + Math.floor(k / 3) * 80, 110, 50); } },
    (x, y, r) => { for (let k = 0; k < 6; k++) { const cx = x + 90 + (k % 3) * 165, cy = y + 150 + Math.floor(k / 3) * 120; g.fillStyle = ['#5a3a2a', '#2b2a33', '#8a6a48', '#2f4f6a'][k % 4];
      g.beginPath(); g.ellipse(cx, cy + 22, 62, 14, 0, 0, 7); g.fill(); g.fillRect(cx - 38, cy - 30, 76, 52); g.fillStyle = '#b2391f'; g.fillRect(cx - 38, cy + 6, 76, 10); g.fillStyle = '#7a5a3a'; g.fillRect(cx - 6, cy + 30, 12, 60); } },
    (x, y, r) => { for (let k = 0; k < 5; k++) { g.save(); g.translate(x + 70 + k * 92, y + 180 + (k % 2) * 30); g.rotate((r() - 0.5) * 0.4); g.fillStyle = '#efe6d0'; g.fillRect(-40, -60, 80, 110); g.fillStyle = INK; g.fillRect(-32, -50, 64, 12); for (let l = 0; l < 6; l++) g.fillRect(-32, -30 + l * 12, 64 - (l % 2) * 20, 5); g.restore(); } },
    (x, y, r) => { for (let k = 0; k < 14; k++) { const bx = x + 40 + (k % 7) * 64, by = y + 130 + Math.floor(k / 7) * 110; g.fillStyle = ['#4d8f5a', '#b8742a', '#5b8fb5', '#c8432a', '#8a4a3a'][k % 5]; g.fillRect(bx, by, 34, 70); g.fillRect(bx + 10, by - 20, 14, 22); g.fillStyle = '#f2e3c0'; g.fillRect(bx + 4, by + 28, 26, 18); } },
    (x, y, r) => { g.fillStyle = 'rgba(30,20,30,.55)'; g.fillRect(x, y, 512, 384); g.fillStyle = '#e9b64a'; g.font = `900 64px ${FONT}`; g.textAlign = 'center'; g.fillText('BANK', x + 256, y + 170); g.fillStyle = '#b8a070'; for (let k = 0; k < 5; k++) g.fillRect(x + 60 + k * 90, y + 220, 14, 120); },
    (x, y, r) => { for (let k = 0; k < 8; k++) { const cx = x + 70 + (k % 4) * 120, cy = y + 160 + Math.floor(k / 4) * 110; g.fillStyle = ['#5a3420', '#2a1d18', '#b2391f', '#7a3b22'][k % 4]; g.beginPath(); g.moveTo(cx - 40, cy + 20); g.lineTo(cx + 45, cy + 20); g.lineTo(cx + 45, cy + 5); g.lineTo(cx - 5, cy - 5); g.lineTo(cx - 10, cy - 30); g.lineTo(cx - 40, cy - 30); g.closePath(); g.fill(); } },
    (x, y, r) => { for (let k = 0; k < 6; k++) { const cx = x + 90 + (k % 3) * 165, cy = y + 170 + Math.floor(k / 3) * 110; g.fillStyle = '#f2e3c0'; g.fillRect(cx - 60, cy + 20, 120, 8); g.fillStyle = ['#e8b868', '#d9a04a', '#f0c8d0', '#c4863a'][k % 4]; g.beginPath(); g.ellipse(cx, cy, 52, 26, 0, Math.PI, 0); g.fill(); g.fillRect(cx - 52, cy, 104, 20); } },
    (x, y, r) => { g.fillStyle = '#8a2a2a'; g.fillRect(x + 20, y + 40, 90, 344); g.fillRect(x + 402, y + 40, 90, 344); g.fillStyle = '#f6d890'; g.beginPath(); g.arc(x + 256, y + 150, 40, 0, 7); g.fill(); g.fillStyle = '#6a4a3a'; g.fillRect(x + 160, y + 250, 190, 70); },
  ];
  for (let i = 0; i < 8; i++) { const x = (i % 4) * 512, y = 1024 + Math.floor(i / 4) * 384, rnd = R(31 + i);
    const gr = g.createLinearGradient(0, y, 0, y + 384); gr.addColorStop(0, '#7a5a48'); gr.addColorStop(0.5, '#c89a6a'); gr.addColorStop(1, '#8a6040'); g.fillStyle = gr; g.fillRect(x, y, 512, 384);
    g.fillStyle = 'rgba(255,230,180,.35)'; g.beginPath(); g.ellipse(x + 256, y + 60, 220, 70, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3a2a'; g.fillRect(x, y + 330, 512, 54); goods[i](x, y, rnd);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(x + 300, y); g.lineTo(x + 380, y); g.lineTo(x + 180, y + 384); g.lineTo(x + 100, y + 384); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x + 420, y); g.lineTo(x + 450, y); g.lineTo(x + 250, y + 384); g.lineTo(x + 220, y + 384); g.closePath(); g.fill(); }
  // door slot = display slot 8 region is out of the atlas: doors use upper-window slot 15 (dark glass with a lettered panel) -> painted below
  // upper windows: sky reflection + curtains / blinds / plants
  for (let i = 0; i < 16; i++) { const x = i * 128, y = 1792, rnd = R(97 + i * 7);
    const gr = g.createLinearGradient(0, y, 0, y + 256); gr.addColorStop(0, i === 15 ? '#2a2430' : '#6f9cc8'); gr.addColorStop(1, i === 15 ? '#4a3a40' : '#2c3a58'); g.fillStyle = gr; g.fillRect(x, y, 128, 256);
    if (i === 15) { g.fillStyle = 'rgba(255,220,160,.25)'; g.fillRect(x + 14, y + 20, 100, 150); g.fillStyle = '#e9b64a'; g.fillRect(x + 30, y + 120, 68, 6); continue; }
    const k = i % 5, cc = ['#c8432a', '#f2e3c0', '#2f6f73', '#e9b64a', '#8a3a5a'][Math.floor(rnd() * 5)];
    if (k === 0 || k === 3) { g.fillStyle = cc; g.fillRect(x, y, 34, 256); g.fillRect(x + 94, y, 34, 256); g.fillRect(x, y, 128, 26); }
    if (k === 1) { g.fillStyle = '#efe2c0'; g.fillRect(x, y, 128, 60 + rnd() * 100); g.fillStyle = 'rgba(0,0,0,.15)'; for (let l = 0; l < 12; l++) g.fillRect(x, y + l * 12, 128, 2); }
    if (k === 2) { g.fillStyle = '#3a6a3a'; g.beginPath(); g.ellipse(x + 64, y + 200, 34, 26, 0, 0, 7); g.fill(); g.fillStyle = '#b8742a'; g.fillRect(x + 46, y + 214, 36, 40); }
    if (k === 4) { g.fillStyle = 'rgba(255,220,150,.5)'; g.fillRect(x, y, 128, 256); g.fillStyle = cc; g.fillRect(x, y, 128, 30); }
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(x + 70, y); g.lineTo(x + 100, y); g.lineTo(x + 40, y + 256); g.lineTo(x + 10, y + 256); g.closePath(); g.fill(); }
  return tex(c);
}
// awnings: 8 slots 1024x128 (stripes 0-100, scallops 100-128)
function paintAwnings(pairs: [string, string][]) {
  const c = cv(1024, 1024), g = c.getContext('2d')!;
  pairs.forEach(([a, b], i) => { const y = i * 128; for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? b : a; g.fillRect(k * 64, y, 64, 100); }
    g.fillStyle = 'rgba(0,0,0,.12)'; for (let k = 0; k < 16; k++) g.fillRect(k * 64 + 54, y, 10, 100); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, y, 1024, 8);
    for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? b : a; g.beginPath(); g.moveTo(k * 64, y + 100); g.lineTo(k * 64 + 64, y + 100); g.lineTo(k * 64 + 64, y + 108); g.arc(k * 64 + 32, y + 108, 32, 0, Math.PI); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(k * 64 + 32, y + 108, 32, 0, Math.PI); g.stroke(); } });
  return tex(c);
}
const awnUV = (i: number, valance: boolean): UVR => valance ? [0, 1 - (i * 128 + 128) / 1024, 1, 1 - (i * 128 + 100) / 1024] : [0, 1 - (i * 128 + 100) / 1024, 1, 1 - i * 128 / 1024];
function paintTower() {   // one window bay (3 m x 3.4 m) on a light wall; tinted per tower by vertex colour
  const c = cv(256, 256), g = c.getContext('2d')!; g.fillStyle = '#ece6dc'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 256, 2);
  g.fillStyle = '#d8d0c4'; g.fillRect(0, 236, 256, 20); const gr = g.createLinearGradient(0, 50, 0, 200); gr.addColorStop(0, '#8fb0d8'); gr.addColorStop(1, '#3a4a68'); g.fillStyle = gr; g.fillRect(70, 50, 116, 150);
  g.fillStyle = '#f4efe6'; g.fillRect(64, 200, 128, 10); g.fillRect(124, 50, 8, 150); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(140, 50, 18, 150); return tex(c, true);
}
function paintSky(SK: (typeof LOOK_SKY)['day']) {
  const c = cv(2048, 512), g = c.getContext('2d')!, rnd = R(5), gr = g.createLinearGradient(0, 0, 0, 512);
  SK.stops.forEach(([k, c]) => gr.addColorStop(k, c)); g.fillStyle = gr; g.fillRect(0, 0, 2048, 512);   // LOOK sky
  if (SK.glow) { const gl = g.createLinearGradient(0, 512 * (SK.glow[0] - 0.22), 0, 512 * (SK.glow[0] + 0.06)); gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(0.8, SK.glow[1]); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, 2048, 512); }
  for (let i = 0; i < 22; i++) { const x = rnd() * 2048, y = 40 + rnd() * 200, s = 0.6 + rnd() * 1.2; g.fillStyle = SK.cloud;
    for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(x + k * 34 * s, y - Math.sin(k / 5 * Math.PI) * 18 * s, 44 * s, 26 * s, 0, 0, 7); g.fill(); } g.fillStyle = SK.cloudShade; g.fillRect(x - 40 * s, y + 8 * s, 240 * s, 10 * s); }
  // distant skyline: two hazy layers (Colour v2: denser blue haze colours, LOOK_SKY.skyline)
  const layers: [number, number, string][] = [[0.5, 300, SK.skyline[0]], [1, 360, SK.skyline[1]]];
  for (const [a, top, col] of layers) { let x = 0; g.fillStyle = col;
    while (x < 2048) { const w = 30 + rnd() * 70, h = (40 + rnd() * 120) * a + (rnd() < 0.12 ? 90 : 0); g.fillRect(x, top + 120 - h, w, 512); if (rnd() < 0.3) g.fillRect(x + w * 0.4, top + 120 - h - 30, w * 0.2, 30); x += w + rnd() * 6; } }
  return tex(c, true);
}

// ---------------- geometry builder ----------------
type Bucket = THREE.BufferGeometry[];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
function fin(g: THREE.BufferGeometry, col: string, uvMode: 'world' | 'keep', mat: THREE.Matrix4, uvr?: UVR, uvScale: [number, number] = [1, 1]) {
  let c = g.index ? g.toNonIndexed() : g; c.applyMatrix4(mat);
  const n = c.attributes.position.count, P = c.attributes.position, N = c.attributes.normal, colA = new Float32Array(n * 3); _c.copy(lookColor(col));   // LOOK
  for (let i = 0; i < n; i++) colA.set([_c.r, _c.g, _c.b], i * 3);
  c.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  const uv = c.attributes.uv as THREE.BufferAttribute;
  if (uvMode === 'world') for (let i = 0; i < n; i++) { const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)); const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (ny > 0.7) uv.setXY(i, x / uvScale[0], z / uvScale[1]); else if (nx > 0.7) uv.setXY(i, z / uvScale[0], y / uvScale[1]); else uv.setXY(i, x / uvScale[0], y / uvScale[1]); }
  else if (uvr) for (let i = 0; i < n; i++) uv.setXY(i, uvr[0] + uv.getX(i) * (uvr[2] - uvr[0]), uvr[1] + uv.getY(i) * (uvr[3] - uvr[1]));
  return c;
}
// SHAPE: street furniture uses tapered / flared solids instead of straight cylinders (same part count, no added detail)
const TAPER = new THREE.CylinderGeometry(0.55, 1, 1, 14), FLARE = new THREE.CylinderGeometry(0.4, 1, 1, 14), BUCKET = new THREE.CylinderGeometry(1, 0.8, 1, 14);
const BOX = new THREE.BoxGeometry(1, 1, 1), PLANE = new THREE.PlaneGeometry(1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 14), SPH = new THREE.SphereGeometry(1, 12, 8), CONE = new THREE.CylinderGeometry(0.3, 1, 1, 14, 1, true);
class Build {
  B: Record<string, Bucket> = {}; base = new THREE.Matrix4();
  at(p: [number, number, number], s: [number, number, number], r: [number, number, number] = [0, 0, 0]) { _m.compose(new THREE.Vector3(...p), _q.setFromEuler(_e.set(...r)), new THREE.Vector3(...s)); return this.base.clone().multiply(_m); }
  push(k: string, g: THREE.BufferGeometry) { (this.B[k] ??= []).push(g); }
  box(k: string, col: string, p: [number, number, number], s: [number, number, number], r?: [number, number, number], uvs?: [number, number]) { this.push(k, fin(BOX, col, 'world', this.at(p, s, r), undefined, uvs)); }
  quad(k: string, uvr: UVR, p: [number, number, number], s: [number, number], r?: [number, number, number], col = '#ffffff') { this.push(k, fin(PLANE, col, 'keep', this.at(p, [s[0], s[1], 1], r), uvr)); }
  geo(k: string, g: THREE.BufferGeometry, col: string, p: [number, number, number], s: [number, number, number], r?: [number, number, number]) { this.push(k, fin(g, col, 'keep', this.at(p, s, r), [0, 0, 0.001, 0.001])); }
}
const dark = (c: string, k = 0.55) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

function storefront(b: Build, u: Unit, awnI: number) {
  const w = u.x1 - u.x0, cx = (u.x0 + u.x1) / 2, H = unitH(u), wallK = u.wall.startsWith('brick') ? u.wall : 'col', wallC = u.wall.startsWith('brick') ? '#ffffff' : u.wall, tr = u.trim, rnd = R(Math.round(cx * 13 + u.side * 7 + 1000));
  b.base = new THREE.Matrix4().makeTranslation(cx, 0, u.side === 1 ? NEAR_Z : FAR_Z); if (u.side === -1) b.base.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
  // body (interior units: only a facade slab, the room behind is a hand-built set)
  if (u.interior) { b.box(wallK, wallC, [0, H / 2, -0.1], [w, H, 0.2]); b.box(wallK, wallC, [0, (H + 3.2) / 2, -DEPTH / 2], [w, H - 3.2, DEPTH]); }
  else b.box(wallK, wallC, [0, H / 2, -DEPTH / 2], [w, H, DEPTH]);
  for (const s of [-1, 1]) b.box('col', tr, [s * (w / 2 - 0.18), H / 2, 0.06], [0.36, H, 0.14]);   // pilasters
  // ground floor
  const dx = u.door ?? 0, sd = dark(u.signBg, 0.8);
  b.box('col', dark(u.signBg, 0.7), [0, 0.3, 0.06], [w - 0.7, 0.6, 0.12]);
  b.quad('glassA', winSlot(15), [dx, 1.2, 0.035], [1.2, 2.3]);   // door
  for (const [x, ww] of [[dx - 0.66, 0.1], [dx + 0.66, 0.1]] as [number, number][]) b.box('col', sd, [x, 1.2, 0.07], [ww, 2.4, 0.1]);
  b.box('col', sd, [dx, 2.4, 0.07], [1.42, 0.1, 0.1]); b.box('col', '#b8864e', [dx + 0.42, 1.15, 0.09], [0.04, 0.3, 0.04]);
  const L0 = -w / 2 + 0.4, L1 = dx - 0.75, R0 = dx + 0.75, R1 = w / 2 - 0.4;
  for (const [a, c] of [[L0, L1], [R0, R1]]) { if (c - a < 0.6) continue; const m = (a + c) / 2, ww = c - a;
    b.quad('glassA', dispSlot(u.disp), [m, 1.68, 0.03], [ww, 2.15]);
    b.box('col', sd, [m, 2.8, 0.07], [ww + 0.1, 0.1, 0.1]); b.box('col', sd, [m, 0.62, 0.08], [ww + 0.14, 0.06, 0.18]);
    for (const x of [a, c]) b.box('col', sd, [x, 1.7, 0.07], [0.08, 2.2, 0.1]);
    const nm = Math.max(0, Math.round(ww / 1.3) - 1); for (let i = 1; i <= nm; i++) b.box('col', sd, [a + (ww * i) / (nm + 1), 1.7, 0.07], [0.05, 2.2, 0.08]); }
  b.box('col', tr, [0, 2.95, 0.05], [w - 0.7, 0.18, 0.1]);   // transom band
  b.box('col', dark(u.signBg, 0.6), [0, 3.62, 0.05], [w - 1.0, 0.9, 0.1]); b.quad('sign', signSlot(signIndex(u.sign)), [0, 3.62, 0.105], [w - 1.2, 0.74]);
  b.box('col', tr, [0, GF - 0.12, 0.1], [w, 0.2, 0.3]);
  if (u.awn) { const ww = w - 0.5, d = 1.25, dy = 0.55, L = Math.hypot(d, dy), ang = Math.atan2(dy, d);
    b.quad('awn', awnUV(awnI, false), [0, 3.05 - dy / 2, d / 2], [ww, L], [-Math.PI / 2 + ang, 0, 0]);
    b.quad('awn', awnUV(awnI, true), [0, 3.05 - dy - 0.14, d], [ww, 0.28]); b.box('col', INK, [0, 3.05 - dy, d], [ww, 0.03, 0.03]); }
  // upper floors
  const n = Math.max(1, Math.floor((w - 0.6) / 1.55)), sp = (w - 0.6) / n;
  for (let k = 1; k < u.floors; k++) { const y0 = GF + (k - 1) * FLH; if (k > 1) b.box('col', tr, [0, y0, 0.06], [w, 0.14, 0.12]);
    for (let i = 0; i < n; i++) { const x = -w / 2 + 0.3 + sp * (i + 0.5), y = y0 + 1.6, ww = 0.9, hh = 1.7;
      b.quad('glassA', winSlot(Math.floor(rnd() * 15)), [x, y, 0.02], [ww, hh]);
      b.box('col', tr, [x, y + hh / 2 + 0.05, 0.05], [ww + 0.2, 0.1, 0.1]); b.box('col', tr, [x, y - hh / 2 - 0.05, 0.08], [ww + 0.3, 0.08, 0.2]);
      for (const s of [-1, 1]) b.box('col', tr, [x + s * (ww / 2 + 0.04), y, 0.05], [0.08, hh, 0.08]);
      b.box('col', tr, [x, y + 0.1, 0.04], [ww, 0.05, 0.05]);
      if (rnd() < 0.18) b.box('col', '#7aa04a', [x, y - hh / 2 - 0.02, 0.2], [ww, 0.14, 0.22]); } }
  // cornice
  b.box('col', tr, [0, H - 0.55, 0.06], [w, 0.3, 0.12]); b.box('col', tr, [0, H - 0.22, 0.18], [w + 0.1, 0.24, 0.42]); b.box('col', dark(tr, 0.8), [0, H + 0.03, -0.1], [w, 0.14, 0.4]);
  if (u.blade && u.floors > 1) { const x = w / 2 - 0.7, y = GF + 1.7, si = signIndex(u.blade), uv = signSlot(si);
    b.box('col', dark(u.signBg, 0.6), [x, y, 0.75], [0.12, 2.5, 1.05]);
    for (const s of [-1, 1]) b.quad('sign', uv, [x + s * 0.065, y, 0.75], [2.3, 0.85], [0, s * Math.PI / 2, s * Math.PI / 2]);
    b.box('col', INK, [x, y + 0.9, 0.2], [0.04, 0.04, 0.5]); }
  if (u.tank) { const x = -w / 4, z = -3; b.geo('col', CYL, '#8a6040', [x, H + 1.6, z], [0.9, 1.4, 0.9]); b.geo('col', CONE, '#5a3a2a', [x, H + 2.5, z], [0.95, 0.4, 0.95]);
    for (const [a, c] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.box('col', INK, [x + a, H + 0.45, z + c], [0.08, 0.9, 0.08]); }
}

const Lamp = (b: Build, x: number, z: number) => { b.base = new THREE.Matrix4();
  b.geo('col', TAPER, '#2e2a33', [x, 1.7, z], [0.065, 3.4, 0.065]); b.geo('col', FLARE, '#2e2a33', [x, 0.25, z], [0.16, 0.5, 0.16]);
  b.geo('col', CONE, '#2f6f73', [x, 3.5, z], [0.5, 0.25, 0.5]); b.geo('lamp', SPH, '#ffffff', [x, 3.38, z], [0.1, 0.1, 0.1]); };

export const Town: React.FC<{tod?: Tod}> = ({tod = 'day'}) => {
  const meshes = useMemo(() => {
    const b = new Build(), awnPairs: [string, string][] = [];
    UNITS.forEach((u) => { let ai = 0; if (u.awn) { ai = awnPairs.findIndex((p) => p[0] === u.awn![0] && p[1] === u.awn![1]); if (ai < 0) { awnPairs.push(u.awn); ai = awnPairs.length - 1; } }
      SIGN_STYLE.set(u.sign, [lookPal(u.signBg), u.signFg]); if (u.blade) SIGN_STYLE.set(u.blade, [lookPal(u.signBg), u.signFg]); storefront(b, u, ai % 8); });
    b.base = new THREE.Matrix4();
    // grocery: upper storey + side returns so it sits in the row
    // towers
    // COLOUR v2: towers become a lower distant skyline (x0.5 height, min 11 m) so sky opens above the rows (v5: they filled the top of almost every frame)
    TOWERS.forEach((t, i) => { const h = V5 ? t[4] : Math.max(11, t[4] * 0.5); b.box('tower', ['#e8c8a8', '#d8dce4', '#c8a890', '#e4d8c0', '#b8c4cc'][i % 5], [(t[0] + t[1]) / 2, h / 2, (t[2] + t[3]) / 2], [t[1] - t[0], h, t[3] - t[2]], undefined, [3, 3.4]); });
    // ground: sidewalks, curbs, asphalt, cross streets
    const g = (k: string, col: string, x0: number, x1: number, z0: number, z1: number, y: number, h: number, uvs?: [number, number]) => b.box(k, col, [(x0 + x1) / 2, y - h / 2, (z0 + z1) / 2], [x1 - x0, h, z1 - z0], undefined, uvs);
    g('walk', '#ffffff', -46, 46, 4.2, CURB_N, 0, 0.06, [1.4, 1.4]); g('walk', '#ffffff', -46, 46, CURB_F, 22.2, 0, 0.06, [1.4, 1.4]);
    g('col', '#b8ad98', -46, 46, CURB_N - 0.15, CURB_N + 0.15, 0.02, 0.18); g('col', '#b8ad98', -46, 46, CURB_F - 0.15, CURB_F + 0.15, 0.02, 0.18);
    g('street', '#ffffff', -80, 80, CURB_N, CURB_F, -0.03, 0.06, [3, 3]);
    for (const s of [-1, 1]) { g('street', '#ffffff', s > 0 ? 46 : -52, s > 0 ? 52 : -46, -60, 80, -0.03, 0.06, [3, 3]); g('walk', '#ffffff', s > 0 ? 52 : -66, s > 0 ? 66 : -52, -60, 80, -0.01, 0.06, [1.4, 1.4]); }
    g('col', '#c9b48e', -300, 300, -300, 300, -0.12, 0.05);
    for (let x = -44; x < 44; x += 4) g('col', '#e9d79a', x, x + 2.2, 13.0, 13.1, 0.003, 0.01);   // centre dashes
    for (let x = -36; x <= 36; x += 4.5) { g('col', '#ece6d6', x - 0.04, x + 0.04, CURB_N + 0.15, 10.5, 0.003, 0.01); }
    // furniture
    LAMPS_N.forEach((x) => Lamp(b, x, 7.9)); LAMPS_F.forEach((x) => Lamp(b, x, 18.5));
    b.base = new THREE.Matrix4();
    HYDRANTS.forEach((h) => { b.geo('col', TAPER, '#c8432a', [h[0], 0.3, h[2]], [0.14, 0.56, 0.14]); b.geo('col', SPH, '#c8432a', [h[0], 0.58, h[2]], [0.1, 0.11, 0.1]); b.box('col', '#c8432a', [h[0], 0.36, h[2]], [0.32, 0.07, 0.07]); b.geo('col', CYL, '#2e2a33', [h[0], 0.04, h[2]], [0.15, 0.08, 0.15]); });
    { const [x, , z] = MAILBOX; b.box('col', '#2a5f9a', [x, 0.75, z], [0.5, 0.7, 0.44]); b.geo('col', CYL, '#2a5f9a', [x, 1.1, z], [0.25, 0.5, 0.22], [0, 0, Math.PI / 2]); for (const a of [-0.2, 0.2]) b.box('col', INK, [x + a, 0.2, z], [0.06, 0.4, 0.3]); b.box('col', '#f2e3c0', [x, 0.85, z + 0.225], [0.3, 0.08, 0.01]); }
    BINS.forEach((p) => { b.geo('col', BUCKET, '#3f6a4a', [p[0], 0.4, p[2]], [0.25, 0.8, 0.25]); b.geo('col', CYL, '#2e5a4a', [p[0], 0.82, p[2]], [0.26, 0.05, 0.26]); });
    { const [x, , z] = CLOCK; b.geo('col', TAPER, '#27493f', [x, 1.5, z], [0.1, 3.0, 0.1]); b.geo('col', FLARE, '#27493f', [x, 0.25, z], [0.2, 0.5, 0.2]); b.geo('col', CYL, '#b8864e', [x, 3.0, z], [0.12, 0.1, 0.12]);
      b.geo('col', CYL, '#27493f', [x, 3.42, z], [0.42, 0.28, 0.42], [Math.PI / 2, 0, 0]); b.geo('col', SPH, '#b8864e', [x, 3.9, z], [0.08, 0.08, 0.08]); }
    // materials
    const atlas = paintAtlas(), awn = paintAwnings(awnPairs.map(([p, q]) => [lookPal(p), lookPal(q)] as [string, string]).concat(Array(Math.max(0, 8 - awnPairs.length)).fill(['#c8432a', '#f2e3c0'])));   // COLOUR v2 palette
    const br = (a: string, m: string) => toon({map: drawBrick(lookHex(a), lookHex(m)), vertexColors: true});   // LOOK
    const asph = drawAsphalt(LOOK_PREM.asphalt), walk = drawSidewalk(LOOK_PREM.sidewalk);   // PREMIUM: neutral-warm asphalt (v4 slate turned shaded street blue) asph.wrapS = asph.wrapT = walk.wrapS = walk.wrapT = THREE.RepeatWrapping;
    const MATS: Record<string, THREE.Material> = {
      brickR: br('#a84a2a', '#cdbb98'), brickY: br('#c99a5a', '#e8dcc0'), brickD: br('#6e3b2a', '#b8a888'), col: toon({vertexColors: true}),
      sign: toon({map: atlas, vertexColors: true}), glassA: new THREE.MeshBasicMaterial({map: atlas, color: new THREE.Color(0.95, 0.9, 0.86)}),
      awn: toon({map: awn, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5}), tower: toon({map: paintTower(), vertexColors: true}),
      walk: toon({map: walk, vertexColors: true}), street: toon({map: asph, vertexColors: true}), lamp: new THREE.MeshBasicMaterial({color: new THREE.Color(1.9, 1.5, 0.9)}),
    };
    const out: THREE.Mesh[] = [];
    for (const [k, list] of Object.entries(b.B)) { const geo = mergeGeometries(list.map((g) => { g.deleteAttribute('uv1'); return g; }))!; const m = new THREE.Mesh(geo, MATS[k]);
      m.castShadow = !['walk', 'street', 'glassA', 'sign', 'lamp'].concat(V5 ? [] : ['tower']).includes(k);   // COLOUR v2: towers = hazy skyline, cast no shadow (a low golden sun would blanket the street)
      m.receiveShadow = !['glassA', 'lamp'].includes(k); m.frustumCulled = false; out.push(m); }
    // COLOUR v2: one painted sky per time of day (day blue / golden lavender-peach), swapped per frame; X('skydbg') paints the sky magenta (sky-share measurement)
    const skyT = {day: paintSky(LOOK_SKY.day), golden: V5 ? null : paintSky(LOOK_SKY.golden)}; skyT.day.repeat.set(2, 1); skyT.golden?.repeat.set(2, 1);
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(190, 190, 150, 48, 1, true), new THREE.MeshBasicMaterial({map: X('skydbg') ? null : skyT.day, color: X('skydbg') ? '#ff00ff' : '#ffffff', side: THREE.BackSide, fog: false}));
    sky.position.set(0, 55, 10); out.push(sky);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(190, 32), new THREE.MeshBasicMaterial({color: X('skydbg') ? '#ff00ff' : LOOK_SKY.day.cap, side: THREE.DoubleSide, fog: false})); cap.rotation.x = Math.PI / 2; cap.position.set(0, 130, 10); out.push(cap);
    return {out, sky, cap, skyT};
  }, []);
  if (!X('skydbg')) { const gold = tod === 'golden' && meshes.skyT.golden; const sm = meshes.sky.material as THREE.MeshBasicMaterial, cm = meshes.cap.material as THREE.MeshBasicMaterial;
    const want = gold ? meshes.skyT.golden! : meshes.skyT.day; if (sm.map !== want) { sm.map = want; sm.needsUpdate = true; } cm.color.set(gold ? LOOK_SKY.golden.cap : LOOK_SKY.day.cap); }
  return <group>{meshes.out.map((o, i) => <primitive key={i} object={o} />)}</group>;
};

// street clock faces + hands (hours as a float, 0..12)
const faceTex = (() => { if (typeof document === 'undefined') return null as any; const c = cv(256, 256), g = c.getContext('2d')!;
  g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fillStyle = '#fbf3e0'; g.fill(); g.lineWidth = 10; g.strokeStyle = '#b8864e'; g.stroke();
  g.fillStyle = INK; g.font = `900 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillText(String(i), 128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92); }
  return tex(c); })();
const CM = (() => { if (typeof document === 'undefined') return null as any; return {face: new THREE.MeshToonMaterial({gradientMap: ramp, map: faceTex}), hand: new THREE.MeshBasicMaterial({color: INK})}; })();
export const StreetClock: React.FC<{hours: number}> = ({hours}) => {
  const [x, , z] = CLOCK, hA = -(hours / 12) * Math.PI * 2, mA = -(hours % 1) * Math.PI * 2;
  return <group position={[x, 3.42, z]}>{[1, -1].map((s) => <group key={s} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
    <mesh geometry={new THREE.CircleGeometry(0.36, 32)} material={CM.face} position={[0, 0, 0.145]} />
    <group position={[0, 0, 0.155]} rotation={[0, 0, hA]}><mesh geometry={PLANE} material={CM.hand} position={[0, 0.1, 0]} scale={[0.04, 0.2, 1]} /></group>
    <group position={[0, 0, 0.16]} rotation={[0, 0, mA]}><mesh geometry={PLANE} material={CM.hand} position={[0, 0.14, 0]} scale={[0.025, 0.28, 1]} /></group>
  </group>)}</group>;
};
