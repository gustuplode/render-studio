// Canvas2D painted textures (our own). All deterministic.
import * as THREE from './lib/three.module.js';

export const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
export const tex = (c, rx = 1, ry = 1) => {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
};
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const speckle = (g, w, h, r, n, cols, rad = [1, 3]) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.beginPath(); g.ellipse(r() * w, r() * h, rad[0] + r() * rad[1], rad[0] + r() * rad[1] * 0.7, r() * 3, 0, 7); g.fill(); } };

export function planks(seed = 1, rot = 0) {
  const [c, g] = cv(512, 512), r = rng(seed), n = 8, w = 512 / n;
  for (let i = 0; i < n; i++) {
    const L = 52 + r() * 10, H = 30 + r() * 6;
    g.fillStyle = hsl(H, 42, L); g.fillRect(i * w, 0, w, 512);
    for (let k = 0; k < 14; k++) { g.strokeStyle = hsl(H - 4, 40, L - 10 - r() * 8, 0.5); g.lineWidth = 1 + r() * 2; g.beginPath(); const x = i * w + 4 + r() * (w - 8); g.moveTo(x, 0); g.bezierCurveTo(x + r() * 6 - 3, 170, x + r() * 6 - 3, 340, x + r() * 4 - 2, 512); g.stroke(); }
    const cut = r() * 512; g.fillStyle = 'rgba(40,24,14,.9)'; g.fillRect(i * w, cut, w, 4);
    for (const y of [cut - 18, cut + 18]) { g.fillStyle = '#2b2620'; g.beginPath(); g.arc(i * w + w * 0.3, y, 2.6, 0, 7); g.arc(i * w + w * 0.7, y, 2.6, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(30,18,10,.95)'; g.fillRect(i * w, 0, 3, 512);
    if (r() < 0.5) { g.fillStyle = hsl(H, 40, L - 16, .8); g.beginPath(); g.ellipse(i * w + w / 2, r() * 512, 5, 9, 0, 0, 7); g.fill(); }
  }
  return c;
}
export function beam(seed = 2, base = [30, 40, 40]) {
  const [c, g] = cv(256, 512), r = rng(seed);
  g.fillStyle = hsl(base[0], base[1], base[2]); g.fillRect(0, 0, 256, 512);
  for (let k = 0; k < 40; k++) { g.strokeStyle = hsl(base[0] - 3, base[1], base[2] - 8 - r() * 10, .45); g.lineWidth = 1 + r() * 3; g.beginPath(); const x = r() * 256; g.moveTo(x, 0); g.bezierCurveTo(x + 8, 170, x - 8, 340, x + r() * 10 - 5, 512); g.stroke(); }
  return c;
}
/** rotting pile: wet dark lower part, moss, rot holes, pale fungus streaks */
export function rotten(seed = 3) {
  const [c, g] = cv(256, 1024), r = rng(seed);
  const gr = g.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, '#6b4a2e'); gr.addColorStop(0.45, '#4f3722'); gr.addColorStop(0.8, '#33281c'); gr.addColorStop(1, '#22231a');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 1024);
  for (let k = 0; k < 50; k++) { g.strokeStyle = `rgba(20,12,6,${.3 + r() * .4})`; g.lineWidth = 1 + r() * 3; g.beginPath(); const x = r() * 256; g.moveTo(x, 0); g.bezierCurveTo(x + 10, 300, x - 10, 700, x + r() * 10 - 5, 1024); g.stroke(); }
  // moss bands near the water line and patches
  for (let i = 0; i < 260; i++) { const y = 650 + Math.pow(r(), 0.6) * 374; g.fillStyle = hsl(85 + r() * 25, 45, 26 + r() * 14, .85); g.beginPath(); g.ellipse(r() * 256, y, 4 + r() * 12, 3 + r() * 6, 0, 0, 7); g.fill(); }
  for (let i = 0; i < 70; i++) { g.fillStyle = hsl(95, 40, 30 + r() * 10, .8); g.beginPath(); g.ellipse(r() * 256, r() * 650, 3 + r() * 8, 2 + r() * 5, 0, 0, 7); g.fill(); }
  // rot holes with cracks
  for (let i = 0; i < 9; i++) {
    const x = r() * 256, y = 200 + r() * 760, w = 10 + r() * 26, h = 18 + r() * 50;
    g.fillStyle = '#120c08'; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.fill();
    g.strokeStyle = '#8a6a48'; g.lineWidth = 3; g.beginPath(); g.ellipse(x - 2, y - 2, w, h, 0, 3.6, 5.6); g.stroke();
    g.strokeStyle = '#120c08'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 6, y - h - 40 - r() * 60); g.moveTo(x, y + h); g.lineTo(x - 5, y + h + 30 + r() * 50); g.stroke();
  }
  // pale fungus spots
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(226,214,180,${.5 + r() * .4})`; g.beginPath(); g.ellipse(r() * 256, 150 + r() * 700, 2 + r() * 4, 2 + r() * 3, 0, 0, 7); g.fill(); }
  return c;
}
export function stone(seed = 4, hue = 36, sat = 14, lig = 66, bw = 128, bh = 64) {
  const [c, g] = cv(512, 512), r = rng(seed);
  g.fillStyle = '#4a4238'; g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 512 / bh; row++) for (let col = -1; col < 512 / bw + 1; col++) {
    const x = col * bw + (row % 2) * bw / 2, y = row * bh, L = lig - 6 + r() * 12;
    g.fillStyle = hsl(hue + r() * 8 - 4, sat, L); g.beginPath(); g.roundRect(x + 3, y + 3, bw - 6, bh - 6, 6); g.fill();
    g.fillStyle = hsl(hue, sat, L + 7, .6); g.fillRect(x + 6, y + 5, bw - 14, 5);
    g.fillStyle = hsl(hue, sat, L - 12, .5); g.fillRect(x + 6, y + bh - 10, bw - 12, 5);
    speckle(g, 0, 0, r, 0, ['#000']);
    for (let k = 0; k < 6; k++) { g.fillStyle = hsl(hue, sat, L - 8 - r() * 8, .6); g.beginPath(); g.ellipse(x + r() * bw, y + r() * bh, 2 + r() * 5, 1 + r() * 3, 0, 0, 7); g.fill(); }
  }
  return c;
}
export function mossy(c0, seed = 5, amt = 1) {
  const [c, g] = cv(c0.width, c0.height), r = rng(seed); g.drawImage(c0, 0, 0);
  for (let i = 0; i < 500 * amt; i++) { const y = c.height * (0.4 + 0.6 * Math.pow(r(), 0.5)); g.fillStyle = hsl(90 + r() * 30, 40, 28 + r() * 16, .85); g.beginPath(); g.ellipse(r() * c.width, y, 4 + r() * 10, 3 + r() * 6, 0, 0, 7); g.fill(); }
  // ivy strands with leaves
  for (let s = 0; s < 8 * amt; s++) {
    let x = r() * c.width, y = c.height;
    for (let k = 0; k < 40; k++) { x += (r() - 0.5) * 18; y -= 8 + r() * 6; g.fillStyle = hsl(100 + r() * 20, 45, 30 + r() * 15); g.beginPath(); g.ellipse(x, y, 7, 5, r() * 3, 0, 7); g.fill(); g.strokeStyle = '#1d2b14'; g.lineWidth = 1.5; g.stroke(); }
  }
  return c;
}
export function grass(seed = 6) {
  const [c, g] = cv(512, 512), r = rng(seed);
  g.fillStyle = '#6fa04a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) { g.fillStyle = hsl(85 + r() * 20, 42, 38 + r() * 14, .5); g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 50, 12 + r() * 30, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 1400; i++) { const x = r() * 512, y = r() * 512; g.strokeStyle = hsl(80 + r() * 30, 45, 30 + r() * 25, .9); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r() * 4 - 2, y - 5 - r() * 7); g.stroke(); }
  for (let i = 0; i < 30; i++) { g.fillStyle = ['#f3e27a', '#ffffff', '#e8a0c0'][i % 3]; g.beginPath(); g.arc(r() * 512, r() * 512, 2.5, 0, 7); g.fill(); }
  return c;
}
export function dirt(seed = 7) {
  const [c, g] = cv(512, 512), r = rng(seed);
  g.fillStyle = '#a88a62'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) { g.fillStyle = hsl(30 + r() * 10, 25, 40 + r() * 25, .6); g.beginPath(); g.ellipse(r() * 512, r() * 512, 3 + r() * 14, 2 + r() * 8, r() * 3, 0, 7); g.fill(); }
  return c;
}
export function plaster(seed = 8, hue = 40) {
  const [c, g] = cv(256, 256), r = rng(seed);
  g.fillStyle = hsl(hue, 40, 86); g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { g.fillStyle = hsl(hue, 30, 76 + r() * 8, .5); g.beginPath(); g.ellipse(r() * 256, r() * 256, 10 + r() * 30, 6 + r() * 16, 0, 0, 7); g.fill(); }
  g.fillStyle = hsl(hue, 20, 60, .5); g.fillRect(0, 236, 256, 20);
  return c;
}
export function roof(seed = 9) {
  const [c, g] = cv(256, 256), r = rng(seed);
  g.fillStyle = '#7b2e1c'; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const x = col * 32 + (row % 2) * 16, y = row * 32; g.fillStyle = hsl(12 + r() * 8, 58, 42 + r() * 10);
    g.beginPath(); g.ellipse(x + 16, y + 16, 14, 17, 0, 0, Math.PI); g.lineTo(x + 2, y); g.fill();
    g.fillStyle = 'rgba(255,220,180,.25)'; g.fillRect(x + 6, y + 2, 5, 22);
  }
  return c;
}
export function marble(seed = 10) {
  const [c, g] = cv(256, 512), r = rng(seed);
  g.fillStyle = '#efe7d6'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(160,140,110,.25)'; g.fillRect(i * 32 + 2, 0, 6, 512); }
  for (let k = 0; k < 10; k++) { g.strokeStyle = 'rgba(150,140,130,.35)'; g.lineWidth = 1.5; g.beginPath(); let x = r() * 256, y = 0; g.moveTo(x, y); while (y < 512) { x += r() * 30 - 15; y += 20 + r() * 30; g.lineTo(x, y); } g.stroke(); }
  return c;
}
export function banner() {
  const [c, g] = cv(256, 512);
  g.fillStyle = '#b8282b'; g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#8a1c22'; for (let i = 0; i < 5; i++) g.fillRect(20 + i * 50, 0, 12, 512);
  g.strokeStyle = '#e6b84a'; g.lineWidth = 12; g.strokeRect(14, 14, 228, 484);
  g.fillStyle = '#e6b84a'; g.font = 'bold 66px DejaVu Serif, serif'; g.textAlign = 'center'; g.fillText('SPQR', 128, 300);
  g.lineWidth = 9; g.beginPath(); g.arc(128, 180, 60, 0.4, Math.PI - 0.4, true); g.stroke();
  for (let i = 0; i < 9; i++) { const a = Math.PI + 0.35 + i * 0.3; g.beginPath(); g.ellipse(128 + Math.cos(a) * 60, 180 - Math.sin(a) * 60 * -1, 10, 5, a, 0, 7); g.fill(); }
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(i * 32, 512); g.lineTo(i * 32 + 16, 470); g.lineTo(i * 32 + 32, 512); g.fillStyle = '#000'; g.globalCompositeOperation = 'destination-out'; g.fill(); g.globalCompositeOperation = 'source-over'; }
  return c;
}
/** interior of the helmet, planar-mapped: rusty iron + the carved message */
export function helmetInside(reveal = 1) {
  const [c, g] = cv(1024, 1024), r = rng(77);
  const gr = g.createRadialGradient(512, 512, 40, 512, 512, 520); gr.addColorStop(0, '#6d675e'); gr.addColorStop(0.7, '#575148'); gr.addColorStop(1, '#3a352f');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 220; i++) { g.fillStyle = hsl(22 + r() * 12, 55, 28 + r() * 16, .35 + r() * .4); g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 4 + r() * 26, 3 + r() * 14, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(30,26,22,${.2 + r() * .3})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const x = r() * 1024, y = r() * 1024; g.moveTo(x, y); g.lineTo(x + r() * 60 - 30, y + r() * 60 - 30); g.stroke(); }
  const lines = ['THE BRIDGE', 'IS NOT', 'SAFE'], ys = [400, 530, 670], sz = [104, 112, 150];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((t, li) => {
    g.font = `bold ${sz[li]}px DejaVu Serif, serif`;
    const w = g.measureText(t).width; let x = 512 - w / 2;
    for (const ch of t) {
      const cw = g.measureText(ch).width, a = (r() - 0.5) * 0.12, dy = (r() - 0.5) * 10;
      g.save(); g.translate(x + cw / 2, ys[li] + dy); g.rotate(a);
      g.fillStyle = '#d6cdbd'; g.fillText(ch, 3, 4);       // lit lower lip of the groove
      g.fillStyle = '#16120f'; g.fillText(ch, 0, 0);       // groove
      g.fillStyle = 'rgba(70,60,50,.9)'; g.fillText(ch, -2, -3);
      g.restore(); x += cw;
    }
  });
  // scratch-out flourish under the words
  g.strokeStyle = '#16120f'; g.lineWidth = 7; g.beginPath(); g.moveTo(330, 765); g.lineTo(700, 760); g.stroke();
  g.strokeStyle = '#cbbfa9'; g.lineWidth = 3; g.beginPath(); g.moveTo(332, 772); g.lineTo(702, 767); g.stroke();
  return c;
}
/** woven cloth: soft grid of interlaced threads (macro floor + strips) */
export function weave(seed = 21, base = [210, 14, 72]) {
  const [c, g] = cv(512, 512), r = rng(seed), n = 16, w = 512 / n;
  g.fillStyle = hsl(base[0], base[1], base[2]); g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const over = (x + y) % 2 === 0, L = base[2] + (over ? 6 : -6) + r() * 4;
    g.fillStyle = hsl(base[0] + r() * 6 - 3, base[1], L);
    g.beginPath(); g.roundRect(x * w + 1.5, y * w + 1.5, w - 3, w - 3, 7); g.fill();
    g.fillStyle = hsl(base[0], base[1], L + 9, .55);
    if (over) g.fillRect(x * w + 4, y * w + 3, w - 8, 4); else g.fillRect(x * w + 3, y * w + 4, 4, w - 8);
  }
  return c;
}
/** wall calendar page: big year, must read correctly (planar UV, front face) */
export function calendar1941() {
  const [c, g] = cv(256, 340);
  g.fillStyle = '#f6efdd'; g.fillRect(0, 0, 256, 340);
  g.fillStyle = '#b03a30'; g.fillRect(0, 0, 256, 54);
  g.fillStyle = '#f6efdd'; g.font = 'bold 30px DejaVu Sans, sans-serif'; g.textAlign = 'center'; g.fillText('OCTOBER', 128, 38);
  g.fillStyle = '#2c2620'; g.font = '900 92px DejaVu Sans, sans-serif'; g.fillText('1941', 128, 160);
  g.strokeStyle = '#8a7a5c'; g.lineWidth = 3; g.beginPath(); g.moveTo(28, 190); g.lineTo(228, 190); g.stroke();
  g.fillStyle = '#6a5c44';
  for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) { g.font = 'bold 17px DejaVu Sans, sans-serif'; g.fillText(String(1 + col + row * 7), 34 + col * 32, 224 + row * 30); }
  for (const x of [58, 198]) { g.fillStyle = '#5a4632'; g.beginPath(); g.arc(x, 14, 7, 0, 7); g.fill(); }
  return c;
}
/** night sky through a porthole */
export function stars(seed = 33) {
  const [c, g] = cv(512, 512), r = rng(seed);
  const gr = g.createRadialGradient(256, 256, 40, 256, 256, 360); gr.addColorStop(0, '#16264d'); gr.addColorStop(1, '#050914');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 190; i++) { g.fillStyle = `rgba(255,255,255,${.35 + r() * .65})`; g.beginPath(); g.arc(r() * 512, r() * 512, .8 + r() * 1.9, 0, 7); g.fill(); }
  for (let i = 0; i < 14; i++) { const x = r() * 512, y = r() * 512, s = 5 + r() * 6; g.strokeStyle = 'rgba(255,244,200,.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke(); }
  g.fillStyle = '#e8e2ce'; g.beginPath(); g.arc(408, 92, 26, 0, 7); g.fill();
  g.fillStyle = '#c9c0a4'; g.beginPath(); g.arc(398, 84, 6, 0, 7); g.arc(418, 102, 4.5, 0, 7); g.fill();
  return c;
}
/** capsule wall panels: blue-grey metal, seams + rivets */
export function panelMetal(seed = 41, hue = 222) {
  const [c, g] = cv(512, 512), r = rng(seed);
  g.fillStyle = hsl(hue, 18, 34); g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = hsl(hue, 16, 30 + r() * 10, .35); g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 50, 10 + r() * 26, r() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(10,14,24,.85)'; g.lineWidth = 5;
  for (const x of [0, 170, 341, 512]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (const y of [0, 256, 512]) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.fillStyle = '#9fb2c8';
  for (const x of [14, 156, 184, 327, 355, 498]) for (const y of [14, 242, 270, 498]) { g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); }
  return c;
}
export function radial(col = '0,0,0', a = 0.55) {
  const [c, g] = cv(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.55, `rgba(${col},${a * 0.6})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
}
/** harbour rule sign: must read correctly (planar UV, front face) */
export function signNoPets() {
  const [c, g] = cv(256, 320);
  g.fillStyle = '#e8dfc8'; g.fillRect(0, 0, 256, 320);
  g.strokeStyle = '#7a2e26'; g.lineWidth = 14; g.strokeRect(10, 10, 236, 300);
  g.fillStyle = '#7a2e26'; g.font = '900 96px DejaVu Sans, sans-serif'; g.textAlign = 'center';
  g.fillText('NO', 128, 118);
  g.fillText('PETS', 128, 224);
  g.fillStyle = '#4a3b28'; g.font = 'bold 25px DejaVu Sans, sans-serif';
  g.fillText('BY ORDER', 128, 282);
  return c;
}
/** soldier's paybook page: name + rank, must read correctly */
export function paybook() {
  const [c, g] = cv(256, 340);
  g.fillStyle = '#f3ecd8'; g.fillRect(0, 0, 256, 340);
  g.fillStyle = '#31456e'; g.fillRect(0, 0, 256, 52);
  g.fillStyle = '#f3ecd8'; g.font = 'bold 26px DejaVu Sans, sans-serif'; g.textAlign = 'center'; g.fillText('PAY BOOK', 128, 36);
  g.textAlign = 'left'; g.fillStyle = '#3a3226'; g.font = 'bold 21px DejaVu Sans, sans-serif';
  g.fillText('NAME', 26, 104); g.fillText('WOJTEK', 120, 104);
  g.fillText('RANK', 26, 150); g.fillText('PRIVATE', 120, 150);
  g.fillText('No.', 26, 196); g.fillText('22 / 1944', 120, 196);
  g.strokeStyle = '#9a8a68'; g.lineWidth = 2;
  for (const y of [116, 162, 208]) { g.beginPath(); g.moveTo(22, y); g.lineTo(234, y); g.stroke(); }
  // paw print instead of a signature
  g.fillStyle = '#5a4632';
  g.beginPath(); g.ellipse(180, 282, 26, 21, 0, 0, 7); g.fill();
  for (const [x, y, r] of [[148, 250, 9], [172, 240, 10], [198, 240, 10], [218, 252, 9]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.save(); g.translate(74, 282); g.rotate(-0.22); g.strokeStyle = '#b03a30'; g.lineWidth = 4; g.strokeRect(-46, -24, 92, 42);
  g.fillStyle = '#b03a30'; g.font = '900 25px DejaVu Sans, sans-serif'; g.textAlign = 'center'; g.fillText('PAID', 0, 8); g.restore();
  return c;
}
/** company emblem: bear carrying a shell (diegetic, painted on the truck door) */
export function emblemBear() {
  const [c, g] = cv(340, 340);
  g.fillStyle = '#5d6e46'; g.fillRect(0, 0, 340, 340);
  g.strokeStyle = '#e8dfc8'; g.lineWidth = 10; g.beginPath(); g.arc(170, 170, 148, 0, 7); g.stroke();
  g.fillStyle = '#e8dfc8';
  // shell (held high, centre)
  g.save(); g.translate(178, 118); g.rotate(0.5);
  g.beginPath(); g.ellipse(0, 0, 62, 21, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(60, -14); g.lineTo(84, 0); g.lineTo(60, 14); g.closePath(); g.fill(); g.restore();
  // bear body standing, head in profile looking up at the shell
  g.beginPath(); g.ellipse(168, 236, 56, 62, 0, 0, 7); g.fill();          // torso
  g.beginPath(); g.ellipse(196, 168, 32, 28, 0, 0, 7); g.fill();          // head
  g.beginPath(); g.moveTo(214, 158); g.lineTo(240, 166); g.lineTo(216, 178); g.closePath(); g.fill(); // snout
  g.beginPath(); g.arc(186, 140, 10, 0, 7); g.fill();                     // ear
  g.fillRect(140, 282, 20, 34); g.fillRect(182, 282, 20, 34);             // legs
  g.save(); g.translate(206, 196); g.rotate(-0.7); g.fillRect(-9, -52, 18, 56); g.restore(); // arm up to shell
  return c;
}

/** station calendar page: month + year, must read correctly (planar UV, front face) */
export function calPage(month, year) {
  const [c, g] = cv(256, 340);
  g.fillStyle = '#f6efdd'; g.fillRect(0, 0, 256, 340);
  g.fillStyle = '#37506e'; g.fillRect(0, 0, 256, 54);
  g.fillStyle = '#f6efdd'; g.font = 'bold 29px DejaVu Sans, sans-serif'; g.textAlign = 'center'; g.fillText(month, 128, 38);
  g.fillStyle = '#2c2620'; g.font = '900 88px DejaVu Sans, sans-serif'; g.fillText(String(year), 128, 158);
  g.strokeStyle = '#8a7a5c'; g.lineWidth = 3; g.beginPath(); g.moveTo(28, 188); g.lineTo(228, 188); g.stroke();
  g.fillStyle = '#6a5c44';
  for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) { g.font = 'bold 17px DejaVu Sans, sans-serif'; g.fillText(String(1 + col + row * 7), 34 + col * 32, 222 + row * 30); }
  for (const x of [58, 198]) { g.fillStyle = '#5a4632'; g.beginPath(); g.arc(x, 14, 7, 0, 7); g.fill(); }
  return c;
}
