// MIRROR FOX — Camera-Bible demo. Same story beats + voice-keyed camera as the
// Mirror Horse reference, NEW animal cast (fox hero, goat teaser, owl buddy,
// bulldog clerk, monkey jockeys). Plain 2D canvas, deterministic per frame.
const DW = 720, DH = 1280, FPS = 30, TOTAL = 1922;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const off = document.createElement('canvas'); off.width = 1080; off.height = 1920;
const octx = off.getContext('2d');

// ---------- deterministic helpers ----------
const R = (k) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const eio = (k) => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;       // ease in-out
const eoc = (k) => 1 - Math.pow(1 - k, 3);                                     // ease out cubic
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
function mixc(c1, c2, k) { return [lerp(c1[0], c2[0], k) | 0, lerp(c1[1], c2[1], k) | 0, lerp(c1[2], c2[2], k) | 0]; }
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); }
function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
function line(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
function txt(g, s, x, y, size, color, align = 'center', weight = 800, strokeW = 0) {
  g.font = `${weight} ${size}px 'Arial Black', Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
  if (strokeW) { g.lineWidth = strokeW; g.strokeStyle = '#241a12'; g.strokeText(s, x, y); }
  g.fillStyle = color; g.fillText(s, x, y);
}
const INK = '#2a1c10';

// ---------- sky / grade ----------
// grade g: 0 = day, .55 = dusk, .75 = sunset, 1 = night
function skyGrad(g, gr) {
  const top = mixc([86, 164, 232], [38, 32, 84], gr), hor = mixc([196, 230, 248], [255, 148, 92], clamp(gr * 1.4, 0, 1));
  const hor2 = mixc(hor, [24, 20, 52], seg(gr, .6, 1));
  const gr2 = g.createLinearGradient(0, 0, 0, 900);
  gr2.addColorStop(0, css(top)); gr2.addColorStop(1, css(hor2));
  g.fillStyle = gr2; g.fillRect(-500, -400, 2000, 1400);
}
function clouds(g, t, gr, seed = 0) {
  g.fillStyle = css(mixc([255, 255, 255], [255, 178, 140], gr), .92);
  for (let i = 0; i < 6; i++) {
    const cx = ((R(seed + i * 3.7) * 1400 + t * (4 + i * 1.3)) % 1500) - 400, cy = 60 + R(seed + i * 7.1) * 260, s = 40 + R(seed + i) * 55;
    ell(g, cx, cy, s * 1.5, s * .52); g.fill(); ell(g, cx - s * .7, cy + 8, s * .9, s * .4); g.fill(); ell(g, cx + s * .75, cy + 6, s, s * .42); g.fill();
  }
}
function hillsFar(g, gr, offx = 0) {
  g.fillStyle = css(mixc([126, 178, 96], [70, 60, 110], gr));
  g.beginPath(); g.moveTo(-500, 700);
  for (let x = -500; x <= 1500; x += 90) g.lineTo(x, 640 - Math.sin((x + offx) * .006) * 60 - R(x * .13) * 26);
  g.lineTo(1500, 1000); g.lineTo(-500, 1000); g.closePath(); g.fill();
}
function ground(g, gr, col = [196, 138, 84]) {
  g.fillStyle = css(mixc(col, [60, 46, 74], gr)); g.fillRect(-500, 780, 2000, 900);
}

// ---------- racetrack world (scrolls with worldX) ----------
function trackWorld(g, t, gr, wx, opts = {}) {
  skyGrad(g, gr); clouds(g, t, gr, 3); hillsFar(g, gr, wx * .2);
  // grandstand
  const gsx = 500 - wx * .55;
  g.fillStyle = '#a33b32'; rr(g, gsx, 430, 620, 210, 10); g.fill();
  g.fillStyle = '#f3e3c2'; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(gsx + i * 62, 430); g.lineTo(gsx + i * 62 + 31, 372); g.lineTo(gsx + i * 62 + 62, 430); g.closePath(); g.fillStyle = i % 2 ? '#c8452c' : '#f3e3c2'; g.fill(); }
  g.fillStyle = 'rgba(40,30,60,.55)'; g.fillRect(gsx + 8, 470, 604, 150);
  for (let r2 = 0; r2 < 4; r2++) for (let i = 0; i < 26; i++) { g.fillStyle = css([220 + R(i * r2 + 1) * 30, 190, 160], .9); ell(g, gsx + 22 + i * 23 + Math.sin(t * 6 + i * 1.7 + r2) * 2, 492 + r2 * 34, 7, 8); g.fill(); }
  txt(g, 'HILLSIDE DOWNS', gsx + 310, 668, 34, '#ffe9a8', 'center', 900);
  ground(g, gr);
  // dirt track with lane shading + scrolling dashes
  g.fillStyle = css(mixc([206, 148, 92], [80, 58, 84], gr)); g.fillRect(-500, 800, 2000, 480);
  g.fillStyle = 'rgba(255,235,200,.25)'; for (let i = 0; i < 22; i++) { const x = ((i * 130 - wx * 1.6) % 2100 + 2100) % 2100 - 600; g.fillRect(x, 900 + (i % 3) * 110, 60, 8); }
  // white rails
  g.strokeStyle = '#f6f2e8'; g.lineWidth = 10;
  line(g, -500, 812, 1500, 812); line(g, -500, 1230, 1500, 1230);
  g.lineWidth = 7; for (let i = 0; i < 24; i++) { const x = ((i * 95 - wx * 1.6) % 2200 + 2200) % 2200 - 600; line(g, x, 812, x, 848); line(g, x, 1194, x, 1230); }
}
function dust(g, t, x, y, n, seed, spread = 60) {
  for (let i = 0; i < n; i++) {
    const ph = (t * 1.6 + R(seed + i * 3.3)) % 1, px = x - ph * spread * 2.2, py = y - ph * 26 + Math.sin(ph * 9 + i) * 6;
    g.fillStyle = `rgba(226,196,150,${.34 * (1 - ph)})`; ell(g, px, py, 12 + ph * 30, 8 + ph * 16); g.fill();
  }
}

// ---------- town street ----------
function townWorld(g, t, gr, wx, fly = 0) {
  skyGrad(g, gr); clouds(g, t, gr, 8); hillsFar(g, gr, wx * .15);
  g.fillStyle = css(mixc([168, 128, 84], [52, 42, 70], gr)); g.fillRect(-600, 600, 2200, 1200); // street base — never black corners
  const cols = [[214, 120, 92], [232, 176, 92], [140, 178, 120], [120, 150, 205], [205, 130, 170], [226, 196, 120]];
  for (let side = 0; side < 2; side++) for (let i = 0; i < 7; i++) {
    const bx = (side ? 520 : -160) + ((i * 37 - wx * (side ? .8 : .8)) % 60), by = 560 + i * 6, bw = 150 - fly * 30, bh = 300;
    const bx2 = side ? 560 + i * 26 - fly * i * 14 : -190 + i * 6 + fly * i * 8;
    g.fillStyle = css(mixc(cols[i % 6], [50, 44, 84], gr)); rr(g, bx2, by - i * 22, bw, bh, 6); g.fill();
    g.fillStyle = 'rgba(30,24,40,.8)'; rr(g, bx2 + 18, by - i * 22 + 40, 40, 52, 4); g.fill(); rr(g, bx2 + 78, by - i * 22 + 40, 40, 52, 4); g.fill();
    g.fillStyle = '#5a3a26'; g.beginPath(); g.moveTo(bx2 - 8, by - i * 22); g.lineTo(bx2 + bw / 2, by - i * 22 - 44); g.lineTo(bx2 + bw + 8, by - i * 22); g.closePath(); g.fill();
  }
  g.fillStyle = css(mixc([188, 142, 92], [66, 52, 82], gr));
  poly(g, [[210, 1280], [300, 640], [420, 640], [520, 1280]]); g.fill();
  g.strokeStyle = 'rgba(70,50,30,.5)'; g.lineWidth = 4; line(g, 315, 700, 268, 1280); line(g, 405, 700, 462, 1280);
  // vintage cars
  for (let i = 0; i < 3; i++) { const cx2 = 330 + i * 40 - fly * 20, cy = 800 + i * 130 + Math.sin(t * 2 + i) * 2, s = .55 + i * .3; carShape(g, cx2, cy, s, cols[(i + 2) % 6], gr); }
  // telegraph poles + wires
  g.strokeStyle = '#4a3423'; g.lineWidth = 7;
  for (let i = 0; i < 3; i++) { const px = 150 - i * 60 + fly * 30, py = 620 + i * 40; line(g, px, py + 340, px, py); line(g, px - 34, py + 30, px + 34, py + 30); }
  g.strokeStyle = 'rgba(30,26,40,.65)'; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(60, 660); g.quadraticCurveTo(360, 760, 660, 640); g.stroke();
}
function carShape(g, x, y, s, col, gr) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = css(mixc(col, [40, 36, 70], gr)); rr(g, -52, -18, 104, 34, 12); g.fill(); rr(g, -30, -42, 60, 30, 10); g.fill();
  g.fillStyle = '#22242e'; ell(g, -30, 18, 13, 13); g.fill(); ell(g, 32, 18, 13, 13); g.fill();
  g.fillStyle = '#cfd8de'; ell(g, -30, 18, 5, 5); g.fill(); ell(g, 32, 18, 5, 5); g.fill(); g.restore();
}

// ---------- betting room ----------
function roomWorld(g, t, gr, boardLines, lampOn = false) {
  // wall + wood floor
  const wall = mixc([122, 84, 58], [66, 44, 60], gr), fl = mixc([146, 102, 62], [74, 52, 60], gr);
  g.fillStyle = css(wall); g.fillRect(-500, -400, 2000, 1050);
  g.fillStyle = css(fl); g.fillRect(-500, 650, 2000, 1030);
  g.strokeStyle = 'rgba(60,36,18,.5)'; g.lineWidth = 3;
  for (let i = 0; i < 12; i++) line(g, -500 + i * 170, 650, -560 + i * 190, 1680);
  line(g, -500, 652, 1500, 652);
  // window (hill visible outside) centre-back
  const wx0 = 190, wy0 = 60, ww = 340, wh = 400;
  g.save(); rr(g, wx0, wy0, ww, wh, 8); g.clip();
  skyGrad(g, gr); hillsFar(g, gr * .8, 40);
  g.fillStyle = css(mixc([110, 170, 90], [60, 54, 100], gr)); ell(g, 360, 470, 300, 120); g.fill();
  g.restore();
  g.strokeStyle = '#3c2716'; g.lineWidth = 14; rr(g, wx0, wy0, ww, wh, 8); g.stroke();
  line(g, 360, wy0, 360, wy0 + wh); line(g, wx0, 260, wx0 + ww, 260);
  // odds board right
  g.fillStyle = '#26343a'; rr(g, 545, 90, 300, 330, 10); g.fill(); g.strokeStyle = '#c8a24a'; g.lineWidth = 5; rr(g, 545, 90, 300, 330, 10); g.stroke();
  boardLines.forEach((L, i) => txt(g, L, 695, 140 + i * 62, i ? 40 : 34, i === boardLines.length - 1 && L.includes('NINE') ? '#ffd84a' : '#e8f0e2'));
  // hanging sign left
  g.fillStyle = '#3a2a1a'; rr(g, -60, 96, 210, 74, 8); g.fill(); txt(g, 'BETS OPEN', 45, 134, 30, '#ffd84a');
  // scattered losing tickets on floor
  for (let i = 0; i < 26; i++) { const x = R(i * 3.1) * 1100 - 160, y = 700 + R(i * 7.7) * 480; g.save(); g.translate(x, y); g.rotate(R(i) * 2 - 1); g.fillStyle = `rgba(238,230,210,${.5 + R(i * 2) * .4})`; g.fillRect(-16, -9, 32, 18); g.restore(); }
  if (lampOn) { const lg = g.createRadialGradient(360, 120, 30, 360, 120, 700); lg.addColorStop(0, 'rgba(255,214,130,.34)'); lg.addColorStop(1, 'rgba(255,214,130,0)'); g.fillStyle = lg; g.fillRect(-500, -400, 2000, 2080); ell(g, 360, 110, 16, 22); g.fillStyle = '#ffd873'; g.fill(); }
}
function bench(g, x, y, w = 430) {
  g.fillStyle = '#7a4e2a'; rr(g, x - w / 2, y, w, 26, 8); g.fill(); rr(g, x - w / 2, y - 66, w, 22, 8); g.fill();
  g.fillStyle = '#5f3b1e'; g.fillRect(x - w / 2 + 16, y + 26, 18, 64); g.fillRect(x + w / 2 - 34, y + 26, 18, 64);
}
function barrelTable(g, x, y) {
  g.fillStyle = '#8a5a30'; ell(g, x, y, 120, 26); g.fill(); g.fillRect(x - 108, y, 216, 110); ell(g, x, y + 110, 108, 22); g.fill();
  g.strokeStyle = 'rgba(60,36,16,.6)'; g.lineWidth = 5; line(g, x - 108, y + 34, x + 108, y + 34); line(g, x - 108, y + 76, x + 108, y + 76);
}

// ================= CHARACTERS (all-new animal cast) =================
// Common face params: eye: open|closed|half|coin|shock|look; mouth: smile|grin|laugh|o|flat|talk
function eyes(g, x, y, s, kind, t, seed = 0) {
  const dx = s * .34, ey = y, r = s * .105;
  for (const sgn of [-1, 1]) {
    const ex = x + sgn * dx;
    if (kind === 'closed') { g.strokeStyle = INK; g.lineWidth = s * .07; g.beginPath(); g.arc(ex, ey, r, .15 * Math.PI, .85 * Math.PI); g.stroke(); }
    else if (kind === 'coin') { g.fillStyle = '#ffd23e'; ell(g, ex, ey, r * 1.25, r * 1.25); g.fill(); g.strokeStyle = '#a87b12'; g.lineWidth = 2.4; g.stroke(); txt(g, '$', ex, ey + 1, s * .17, '#a87b12'); }
    else if (kind === 'shock') { g.fillStyle = '#fff'; ell(g, ex, ey, r * 1.3, r * 1.45); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke(); g.fillStyle = INK; ell(g, ex, ey + 2, r * .4, r * .4); g.fill(); }
    else { g.fillStyle = '#fff'; ell(g, ex, ey, r * 1.15, kind === 'half' ? r * .8 : r * 1.25); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke(); g.fillStyle = INK; const lx = kind === 'look' ? sgn * 2.5 : 0; ell(g, ex + lx, ey + (kind === 'half' ? 2 : 0), r * .48, r * .55); g.fill(); }
  }
  // brows
  g.strokeStyle = INK; g.lineWidth = s * .075; g.lineCap = 'round';
  const bb = kind === 'shock' ? -s * .3 : kind === 'grin' ? -s * .2 : -s * .24;
  line(g, x - dx - r, y + bb, x - dx + r, y + bb - s * .04); line(g, x + dx - r, y + bb - s * .04, x + dx + r, y + bb);
}
function mouthDraw(g, x, y, s, kind, t) {
  g.strokeStyle = INK; g.lineWidth = s * .07; g.lineCap = 'round';
  if (kind === 'smile' || kind === 'grin') { g.beginPath(); g.arc(x, y - s * .05, s * (kind === 'grin' ? .3 : .2), .15 * Math.PI, .85 * Math.PI); g.stroke(); }
  else if (kind === 'laugh' || kind === 'talk') { const o = kind === 'laugh' ? .2 : .1 + Math.abs(Math.sin(t * 14)) * .09; g.fillStyle = '#7a2e22'; ell(g, x, y + s * .08, s * .17, s * o); g.fill(); g.strokeStyle = INK; g.lineWidth = s * .05; g.stroke(); }
  else if (kind === 'o') { g.fillStyle = '#7a2e22'; ell(g, x, y + s * .06, s * .1, s * .13); g.fill(); }
  else { line(g, x - s * .14, y + s * .05, x + s * .14, y + s * .05); }
}
// ---- FOX hero: orange, triangle ears, cream muzzle, green waistcoat, flat cap, bushy tail
function fox(g, x, y, s, t, o = {}) {
  const bob = o.still ? 0 : Math.sin(t * 2.2 + (o.seed || 0)) * s * .03, yy = y + bob;
  g.save(); g.translate(x, yy); g.scale(s / 100, s / 100);
  // tail
  g.fillStyle = '#d2691e'; g.beginPath(); g.moveTo(38, 118); g.quadraticCurveTo(96, 108, 88, 52); g.quadraticCurveTo(80, 96, 40, 88); g.closePath(); g.fill(); g.fillStyle = '#fdf3e0'; g.beginPath(); g.moveTo(88, 52); g.quadraticCurveTo(96, 108, 70, 112); g.quadraticCurveTo(84, 84, 88, 52); g.fill();
  // legs
  g.strokeStyle = '#5a3a20'; g.lineWidth = 9; g.lineCap = 'round';
  const wk = o.walk ? Math.sin(t * 9) * 16 : 0;
  line(g, -16, 128, -18 + wk, 168); line(g, 16, 128, 18 - wk, 168);
  // body: green waistcoat
  g.fillStyle = '#2e7d5b'; rr(g, -40, 62, 80, 72, 20); g.fill(); g.strokeStyle = INK; g.lineWidth = 3.4; rr(g, -40, 62, 80, 72, 20); g.stroke();
  g.fillStyle = '#f3e2b8'; poly(g, [[-13, 66], [13, 66], [0, 104]]); g.fill();
  g.fillStyle = '#ffd23e'; ell(g, 0, 84, 4.4, 4.4); g.fill(); ell(g, 0, 102, 4.4, 4.4); g.fill(); ell(g, 0, 120, 4.4, 4.4); g.fill();
  // scarf
  g.fillStyle = '#c23b2e'; poly(g, [[-26, 60], [26, 60], [10, 82], [-8, 82]]); g.fill();
  // arms
  g.strokeStyle = '#b85c14'; g.lineWidth = 9;
  if (o.armUp) { line(g, -36, 78, -58, 30); } else if (o.holdMirror) { line(g, 36, 78, 58, 96); } else { line(g, -36, 78, -46, 116); line(g, 36, 78, 46, 116); }
  if (o.armUp) line(g, 36, 78, 46, 116);
  if (o.hammer) { g.save(); g.translate(-58, 26); g.rotate(-.5 + (o.hammerHit || 0)); g.fillStyle = '#8a5a30'; g.fillRect(-4, -26, 8, 30); g.fillStyle = '#6b6f76'; rr(g, -14, -40, 28, 16, 4); g.fill(); g.restore(); }
  if (o.holdMirror) mirrorProp(g, 62, 100, .8, o.glint || 0);
  if (o.moneyBox) { g.fillStyle = '#3f7a3a'; rr(g, 22, 92, 58, 40, 5); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; rr(g, 22, 92, 58, 40, 5); g.stroke(); g.fillStyle = '#bfe3a8'; g.fillRect(28, 78, 46, 16); txt(g, '$', 51, 113, 26, '#2e5b28'); }
  // head
  g.fillStyle = '#e07b26';
  g.beginPath(); g.moveTo(-42, -6); g.lineTo(-40, -58); g.lineTo(-14, -38); g.lineTo(14, -38); g.lineTo(40, -58); g.lineTo(42, -6); g.quadraticCurveTo(40, 34, 0, 42); g.quadraticCurveTo(-40, 34, -42, -6); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 3.6; g.stroke();
  g.fillStyle = '#8a4410'; poly(g, [[-40, -58], [-34, -34], [-16, -40]]); g.fill(); poly(g, [[40, -58], [34, -34], [16, -40]]); g.fill();
  // muzzle
  g.fillStyle = '#fdf3e0'; ell(g, 0, 22, 26, 17); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke();
  g.fillStyle = '#2a1c10'; ell(g, 0, 12, 7.5, 5.6); g.fill();
  mouthDraw(g, 0, 26, 62, o.mouth || 'smile', t);
  eyes(g, 0, -12, 62, o.eye || 'open', t);
  // flat cap
  g.fillStyle = '#7a4a22'; ell(g, 0, -44, 34, 10); g.fill(); g.fillRect(-34, -52, 68, 10); g.fillStyle = '#96602e'; rr(g, -20, -60, 40, 10, 5); g.fill();
  g.restore();
}
function mirrorProp(g, x, y, s, glint) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#8a5a30'; g.fillRect(-3, 8, 6, 20);
  g.fillStyle = '#cfe8f2'; ell(g, 0, 0, 15, 15); g.fill(); g.strokeStyle = '#c8a24a'; g.lineWidth = 4; g.stroke();
  if (glint > 0) { g.save(); g.globalAlpha = glint; g.fillStyle = '#fff'; const gx = -12 + glint * 0; poly(g, [[-3, -14], [2, -3], [13, -2], [3, 2], [5, 13], [0, 4], [-11, 9], [-4, 1]]); g.fill(); g.restore(); }
  g.restore();
}
// ---- GOAT teaser: grey, horns, goatee, glasses, yellow check vest
function goat(g, x, y, s, t, o = {}) {
  const bob = o.still ? 0 : Math.sin(t * 2.5 + 2 + (o.seed || 0)) * s * .03;
  g.save(); g.translate(x, y + bob); g.scale(s / 100, s / 100);
  g.strokeStyle = '#4c4438'; g.lineWidth = 9; g.lineCap = 'round'; line(g, -15, 128, -17, 168); line(g, 15, 128, 17, 168);
  g.fillStyle = '#d9a92c'; rr(g, -38, 62, 76, 70, 18); g.fill(); g.strokeStyle = INK; g.lineWidth = 3.2; rr(g, -38, 62, 76, 70, 18); g.stroke();
  g.strokeStyle = 'rgba(90,60,10,.55)'; g.lineWidth = 3; line(g, -38, 86, 38, 86); line(g, -38, 110, 38, 110); line(g, -12, 62, -12, 132); line(g, 14, 62, 14, 132);
  g.strokeStyle = '#8d8578'; g.lineWidth = 9;
  if (o.wipe) { line(g, 36, 78, 62, 88 + Math.sin(t * 10) * 8); g.fillStyle = '#e8e2d2'; ell(g, 66, 92 + Math.sin(t * 10) * 8, 12, 9); g.fill(); }
  else if (o.point) { line(g, 36, 78, 66, 62); } else { line(g, -36, 78, -46, 114); line(g, 36, 78, 46, 114); }
  if (o.point) line(g, -36, 78, -46, 114);
  // head: long grey face
  g.fillStyle = '#cfc8ba'; rr(g, -30, -46, 60, 92, 24); g.fill(); g.strokeStyle = INK; g.lineWidth = 3.4; rr(g, -30, -46, 60, 92, 24); g.stroke();
  // horns + ears
  g.strokeStyle = '#9a8a68'; g.lineWidth = 8; g.beginPath(); g.arc(-30, -38, 15, Math.PI * .9, Math.PI * 1.9); g.stroke(); g.beginPath(); g.arc(30, -38, 15, Math.PI * 1.1, Math.PI * 2.05); g.stroke();
  g.fillStyle = '#bfb7a6'; ell(g, -38, -14, 14, 7); g.fill(); ell(g, 38, -14, 14, 7); g.fill();
  // goatee + muzzle
  g.fillStyle = '#efe9da'; poly(g, [[-9, 36], [9, 36], [0, 58]]); g.fill();
  g.fillStyle = '#2a1c10'; ell(g, -6, 26, 3, 3.8); g.fill(); ell(g, 6, 26, 3, 3.8); g.fill();
  eyes(g, 0, -12, 58, o.eye || 'open', t);
  // round glasses
  g.strokeStyle = '#333'; g.lineWidth = 2.6; ell(g, -20, -12, 14, 14); g.stroke(); ell(g, 20, -12, 14, 14); g.stroke(); line(g, -6, -12, 6, -12);
  mouthDraw(g, 0, 34, 52, o.mouth || 'grin', t);
  g.restore();
}
// ---- OWL buddy: brown, big eye-rings, straw hat, wings
function owl(g, x, y, s, t, o = {}) {
  const bob = o.still ? 0 : Math.sin(t * 1.8 + 4) * s * .02;
  g.save(); g.translate(x, y + bob); g.scale(s / 100, s / 100);
  g.fillStyle = '#7a4e2a'; ell(g, 0, 66, 46, 62); g.fill(); g.strokeStyle = INK; g.lineWidth = 3.4; ell(g, 0, 66, 46, 62); g.stroke();
  g.fillStyle = '#d9b98a'; ell(g, 0, 82, 28, 42); g.fill();
  // wings
  g.fillStyle = '#65401f';
  if (o.wingUp) { g.save(); g.translate(-40, 40); g.rotate(-.9 + Math.sin(t * 3) * .06); ell(g, -16, 0, 15, 44); g.fill(); g.restore(); }
  else { ell(g, -46, 74, 13, 40); g.fill(); }
  if (o.holdChalk) { g.save(); g.translate(44, 40); g.rotate(.7); ell(g, 14, 0, 12, 38); g.fill(); g.restore(); g.fillStyle = '#fff'; g.fillRect(52, 8, 14, 5); }
  else { g.fillStyle = '#65401f'; ell(g, 46, 74, 13, 40); g.fill(); }
  // head
  g.fillStyle = '#8a5a30'; ell(g, 0, -8, 44, 40); g.fill(); g.strokeStyle = INK; g.lineWidth = 3.4; ell(g, 0, -8, 44, 40); g.stroke();
  g.fillStyle = '#f3e2b8'; ell(g, -19, -10, 16, 17); g.fill(); ell(g, 19, -10, 16, 17); g.fill();
  if ((o.eye || 'open') === 'closed') { g.strokeStyle = INK; g.lineWidth = 3.4; g.beginPath(); g.arc(-19, -10, 8, .2, Math.PI - .2); g.stroke(); g.beginPath(); g.arc(19, -10, 8, .2, Math.PI - .2); g.stroke(); }
  else { g.fillStyle = INK; ell(g, -19, -10, 6.4, 7.4); g.fill(); ell(g, 19, -10, 6.4, 7.4); g.fill(); g.fillStyle = '#fff'; ell(g, -17, -13, 2.2, 2.2); g.fill(); ell(g, 21, -13, 2.2, 2.2); g.fill(); }
  g.fillStyle = '#e8a13a'; poly(g, [[-6, 2], [6, 2], [0, 12]]); g.fill();
  // straw hat
  if (!o.noHat) { g.fillStyle = '#e3c268'; ell(g, 0, -42, 40, 9); g.fill(); rr(g, -20, -56, 40, 15, 6); g.fill(); g.fillStyle = '#c23b2e'; g.fillRect(-20, -46, 40, 6); }
  g.restore();
}
// ---- BULLDOG clerk: wide tan head, jowls, droopy ears, visor
function bulldog(g, x, y, s, t, o = {}) {
  const bob = Math.sin(t * 2 + 1) * s * .02;
  g.save(); g.translate(x, y + bob); g.scale(s / 100, s / 100);
  g.fillStyle = '#5d3a5e'; rr(g, -44, 62, 88, 70, 16); g.fill(); g.strokeStyle = INK; g.lineWidth = 3.2; rr(g, -44, 62, 88, 70, 16); g.stroke();
  g.fillStyle = '#e8e2d2'; g.fillRect(-8, 66, 16, 60);
  g.strokeStyle = '#a87f52'; g.lineWidth = 10; g.lineCap = 'round'; line(g, -40, 80, -54, 112); line(g, 40, 80, 54, 112);
  // head wide
  g.fillStyle = '#c99a5e'; rr(g, -46, -38, 92, 76, 26); g.fill(); g.strokeStyle = INK; g.lineWidth = 3.6; rr(g, -46, -38, 92, 76, 26); g.stroke();
  g.fillStyle = '#8a5f30'; ell(g, -48, -18, 13, 22); g.fill(); ell(g, 48, -18, 13, 22); g.fill();
  // jowls + muzzle
  g.fillStyle = '#ecd3a4'; ell(g, 0, 20, 32, 19); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke();
  g.fillStyle = '#2a1c10'; ell(g, 0, 10, 9, 6.6); g.fill();
  g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(-11, 22, 9, .3, 2.4); g.stroke(); g.beginPath(); g.arc(11, 22, 9, .7, 2.8); g.stroke();
  g.fillStyle = '#fff'; g.fillRect(8, 27, 7, 9); // tooth
  eyes(g, 0, -14, 56, o.eye || 'half', t);
  if (o.sweat) { g.fillStyle = '#9fd4f0'; const sy = ((t * 60) % 34); ell(g, 44, -20 + sy, 5, 7); g.fill(); }
  // green visor
  g.fillStyle = '#2e7d4f'; ell(g, 0, -40, 50, 12); g.fill(); g.fillRect(-50, -48, 100, 11);
  if (o.noteStuck) { g.save(); g.translate(26, -44); g.rotate(.4); g.fillStyle = '#bfe3a8'; g.fillRect(-11, -16, 22, 32); txt(g, '$', 0, 0, 22, '#2e5b28'); g.restore(); }
  g.restore();
}
// ---- crowd animals
function sheep(g, x, y, s, t, o = {}) {
  g.save(); g.translate(x, y + Math.sin(t * 3 + (o.seed || 0) * 2) * 3); g.scale(s / 100, s / 100);
  g.fillStyle = '#efe9da'; for (let i = 0; i < 7; i++) { ell(g, -22 + (i % 4) * 15, -34 + ((i / 4) | 0) * 14, 14, 12); g.fill(); }
  g.fillStyle = '#4c4438'; ell(g, 0, -12, 17, 20); g.fill(); ell(g, -19, -18, 9, 5); g.fill(); ell(g, 19, -18, 9, 5); g.fill();
  eyes(g, 0, -16, 34, o.eye || 'open', t); mouthDraw(g, 0, 0, 34, o.mouth || 'laugh', t);
  g.fillStyle = o.col || '#7a9a5b'; rr(g, -24, 14, 48, 52, 12); g.fill(); g.restore();
}
function pigChar(g, x, y, s, t, o = {}) {
  g.save(); g.translate(x, y + Math.sin(t * 2.6 + 1 + (o.seed || 0)) * 3); g.scale(s / 100, s / 100);
  g.fillStyle = '#e89ab0'; ell(g, -20, -30, 9, 12); g.fill(); ell(g, 20, -30, 9, 12); g.fill(); ell(g, 0, -10, 32, 28); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; ell(g, 0, -10, 32, 28); g.stroke();
  g.fillStyle = '#d96f92'; ell(g, 0, 0, 13, 10); g.fill(); g.fillStyle = '#8a3350'; ell(g, -4.6, 0, 2.4, 3.6); g.fill(); ell(g, 4.6, 0, 2.4, 3.6); g.fill();
  eyes(g, 0, -20, 44, o.eye || 'open', t); mouthDraw(g, 0, 12, 36, o.mouth || 'laugh', t);
  g.fillStyle = o.col || '#5b7a9a'; rr(g, -24, 20, 48, 48, 12); g.fill(); g.restore();
}
function chicken(g, x, y, s, t, o = {}) {
  g.save(); g.translate(x, y + Math.abs(Math.sin(t * 4 + (o.seed || 0))) * -4); g.scale(s / 100, s / 100);
  g.fillStyle = '#f6f2e8'; ell(g, 0, 22, 24, 30); g.fill(); ell(g, 0, -20, 20, 19); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.8; ell(g, 0, -20, 20, 19); g.stroke();
  g.fillStyle = '#c23b2e'; ell(g, -6, -40, 6, 8); g.fill(); ell(g, 4, -42, 6, 9); g.fill();
  g.fillStyle = '#e8a13a'; poly(g, [[-5, -16], [5, -16], [0, -7]]); g.fill();
  eyes(g, 0, -24, 32, o.eye || 'open', t);
  g.restore();
}
// ---- horses + monkey jockey
function horseDraw(g, x, y, s, t, o = {}) {
  const ph = o.gallop ? t * 11 : t * 2, run = o.gallop ? 1 : 0;
  g.save(); g.translate(x, y + Math.sin(ph * 2) * (run ? 5 : 1.6)); g.scale((o.flip ? -s : s) / 100, s / 100);
  const col = o.col || '#8a5a30';
  g.strokeStyle = col; g.lineWidth = 11; g.lineCap = 'round';
  const lp = (k) => Math.sin(ph + k) * (run ? 26 : 5);
  line(g, -52, 30, -60 + lp(0), 78); line(g, -38, 32, -34 + lp(2.4), 78); line(g, 44, 30, 50 + lp(3.4), 78); line(g, 58, 28, 66 + lp(1.2), 78);
  g.strokeStyle = INK; g.lineWidth = 2.4; // hooves hint
  g.fillStyle = col; ell(g, 0, 6, 74, 30); g.fill(); g.strokeStyle = INK; g.lineWidth = 3.2; ell(g, 0, 6, 74, 30); g.stroke();
  if (o.spots) { g.fillStyle = 'rgba(240,236,226,.85)'; ell(g, -20, -4, 13, 9); g.fill(); ell(g, 12, 12, 10, 7); g.fill(); ell(g, 30, -8, 8, 6); g.fill(); ell(g, -44, 10, 8, 6); g.fill(); }
  // neck + head
  g.save(); g.translate(62, -12); g.rotate(.5); g.fillStyle = col; rr(g, -13, -38, 27, 52, 12); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; rr(g, -13, -38, 27, 52, 12); g.stroke(); g.restore();
  g.save(); g.translate(96, -34); g.rotate(.9); g.fillStyle = col; rr(g, -11, -30, 23, 56, 10); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; rr(g, -11, -30, 23, 56, 10); g.stroke();
  g.fillStyle = INK; ell(g, 8, -14, 3.4, 3.4); g.fill(); ell(g, 2, 18, 4, 3); g.fill(); g.restore();
  g.fillStyle = '#3a2a1a'; poly(g, [[44, -34], [58, -44], [66, -20], [52, -18]]); g.fill(); // mane
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 8; g.beginPath(); g.moveTo(-72, -8); g.quadraticCurveTo(-92, 6, -86, 30 + Math.sin(ph) * 6); g.stroke(); // tail
  // saddle + number
  if (o.num) { g.fillStyle = o.saddle || '#c23b2e'; rr(g, -16, -22, 38, 26, 5); g.fill(); txt(g, o.num, 3, -8, 24, '#fff'); }
  g.restore();
  if (o.jockey) { // monkey jockey rides in screen space (never flipped)
    g.save(); g.translate(x + s * .06, y - s * .52 + Math.sin(ph * 2) * (run ? 5 : 1.6)); g.scale(s / 100, s / 100);
    g.strokeStyle = '#6b4a2e'; g.lineWidth = 7; g.lineCap = 'round'; line(g, -8, 26, -20, 48); line(g, 10, 26, 22, 48);
    g.fillStyle = o.silks || '#2b6cb0'; rr(g, -14, -8, 30, 36, 9); g.fill();
    g.strokeStyle = '#6b4a2e'; line(g, 12, 2, 34, -8 + (o.wave ? Math.sin(t * 7) * 10 - 14 : 0));
    g.fillStyle = '#a8763e'; ell(g, 2, -26, 16, 15); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.6; ell(g, 2, -26, 16, 15); g.stroke();
    g.fillStyle = '#d9b98a'; ell(g, 2, -20, 10, 8); g.fill(); ell(g, -14, -30, 5, 7); g.fill(); ell(g, 18, -30, 5, 7); g.fill();
    g.fillStyle = INK; ell(g, -3, -28, 2.4, 3); g.fill(); ell(g, 7, -28, 2.4, 3); g.fill();
    g.fillStyle = o.silks || '#2b6cb0'; ell(g, 2, -40, 15, 6); g.fill();
    g.restore();
  }
}
function piggyBank(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
  g.fillStyle = '#e89ab0'; ell(g, 0, 0, 46, 36); g.fill(); g.strokeStyle = INK; g.lineWidth = 3.4; ell(g, 0, 0, 46, 36); g.stroke();
  ell(g, -26, -30, 10, 12); g.fillStyle = '#e89ab0'; g.fill(); ell(g, 22, -32, 10, 12); g.fill();
  g.fillStyle = '#d96f92'; ell(g, 34, 2, 14, 12); g.fill(); g.fillStyle = '#8a3350'; ell(g, 31, 2, 2.6, 4); g.fill(); ell(g, 38, 2, 2.6, 4); g.fill();
  g.fillStyle = INK; ell(g, -6, -12, 4, 5); g.fill();
  g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(-50, -6, 8, 0, 4.4); g.stroke();
  g.fillStyle = '#5b4326'; g.fillRect(-10, -38, 22, 5);
  g.restore();
}

// ================= WORDS / CAPTIONS =================
const WORDS = [["He", 0.0, 0.24], ["bet", 0.24, 0.44], ["his", 0.44, 0.62], ["life", 0.62, 0.86], ["savings", 0.86, 1.38], ["on", 1.38, 1.58], ["the", 1.58, 1.7], ["slowest", 1.7, 2.34], ["horse", 2.34, 2.5], ["in", 2.5, 2.7], ["the", 2.7, 2.82], ["race.", 2.82, 3.0], ["The", 3.3, 3.36], ["whole", 3.36, 3.58], ["betting", 3.58, 3.92], ["room", 3.92, 4.16], ["is", 4.16, 4.32], ["laughing", 4.32, 4.68], ["at", 4.68, 4.92], ["him", 4.92, 5.08], ["because", 5.08, 5.28], ["all", 5.28, 5.6], ["day", 5.6, 5.78], ["long", 5.78, 6.08], ["He", 6.08, 6.34], ["hasn't", 6.34, 6.7], ["bet", 6.7, 6.8], ["a", 6.8, 6.98], ["single", 6.98, 7.38], ["dollar.", 7.38, 7.84], ["He", 8.02, 8.06], ["just", 8.06, 8.22], ["sits", 8.22, 8.4], ["by", 8.4, 8.62], ["the", 8.62, 8.76], ["window", 8.76, 9.04], ["smiling", 9.04, 9.62], ["because", 9.62, 9.98], ["he", 9.98, 10.14], ["has", 10.14, 10.28], ["a", 10.28, 10.38], ["mirror.", 10.38, 10.58], ["Wait,", 10.9, 11.06], ["what's", 11.22, 11.54], ["a", 11.54, 11.6], ["mirror", 11.6, 11.9], ["going", 11.9, 12.18], ["to", 12.18, 12.32], ["do?", 12.32, 12.5], ["Well,", 12.72, 12.88], ["the", 13.16, 13.28], ["racetrack", 13.28, 13.78], ["is", 13.78, 13.88], ["right", 13.88, 14.14], ["over", 14.14, 14.36], ["the", 14.36, 14.5], ["hill", 14.5, 14.62], ["from", 14.62, 14.82], ["town", 14.82, 15.1], ["and", 15.1, 15.38], ["his", 15.38, 15.52], ["buddy", 15.52, 15.78], ["is", 15.78, 15.96], ["up", 15.96, 16.1], ["on", 16.1, 16.2], ["that", 16.2, 16.36], ["hill", 16.36, 16.56], ["with", 16.56, 16.72], ["the", 16.72, 16.88], ["biggest", 16.88, 17.26], ["mirror", 17.26, 17.58], ["He", 17.58, 17.78], ["could", 17.78, 17.9], ["find", 17.9, 18.34], ["race", 18.34, 18.66], ["after", 18.66, 19.02], ["race", 19.02, 19.28], ["the", 19.28, 19.62], ["favorite", 19.62, 20.0], ["wins", 20.0, 20.26], ["and", 20.26, 20.64], ["the", 20.64, 20.76], ["hill", 20.76, 20.96], ["stays", 20.96, 21.22], ["dark", 21.22, 21.62], ["and", 21.62, 21.94], ["by", 21.94, 22.08], ["the", 22.08, 22.2], ["fifth", 22.2, 22.54], ["the", 22.54, 22.82], ["regulars", 22.82, 23.28], ["are", 23.28, 23.36], ["betting", 23.36, 23.54], ["on", 23.54, 23.74], ["whether", 23.74, 23.96], ["he'll", 23.96, 24.26], ["ever", 24.26, 24.54], ["bet", 24.54, 24.88], ["Hey", 24.88, 25.18], ["mirror", 25.18, 25.56], ["man,", 25.56, 25.84], ["maybe", 26.02, 26.16], ["try", 26.16, 26.4], ["wiping", 26.4, 26.74], ["it", 26.74, 27.02], ["in", 27.02, 27.2], ["the", 27.2, 27.28], ["last", 27.28, 27.58], ["race", 27.58, 27.86], ["the", 27.86, 28.08], ["favorite", 28.08, 28.4], ["so", 28.4, 28.76], ["far", 28.76, 29.02], ["ahead", 29.02, 29.36], ["It's", 29.36, 29.66], ["jockey", 29.66, 30.0], ["is", 30.0, 30.2], ["waving", 30.2, 30.44], ["to", 30.44, 30.64], ["his", 30.64, 30.8], ["mom", 30.8, 31.0], ["and", 31.0, 31.32], ["horse", 31.32, 31.52], ["nine", 31.52, 31.82], ["is", 31.82, 32.06], ["so", 32.06, 32.36], ["far", 32.36, 32.62], ["behind", 32.62, 32.98], ["it's", 32.98, 33.28], ["practically", 33.28, 33.64], ["in", 33.64, 33.9], ["the", 33.9, 33.96], ["parking", 33.96, 34.28], ["lot", 34.28, 34.56], ["Then", 34.56, 34.9], ["the", 34.9, 35.26], ["hill", 35.26, 35.48], ["flashes", 35.48, 36.0], ["and", 36.0, 36.42], ["he", 36.42, 36.5], ["puts", 36.5, 36.66], ["every", 36.66, 37.12], ["dollar", 37.12, 37.42], ["he", 37.42, 37.64], ["has", 37.64, 37.86], ["on", 37.86, 38.1], ["horse", 38.1, 38.28], ["nine", 38.28, 38.6], ["the", 38.6, 38.86], ["guy", 38.86, 39.0], ["behind", 39.0, 39.24], ["the", 39.24, 39.4], ["counter", 39.4, 39.64], ["almost", 39.64, 40.0], ["feels", 40.0, 40.24], ["bad", 40.24, 40.64], ["taking", 40.64, 41.08], ["it", 41.08, 41.32], ["Pal", 41.32, 41.58], ["that", 41.58, 42.08], ["horse", 42.08, 42.28], ["lost", 42.28, 42.54], ["a", 42.54, 42.72], ["race", 42.72, 42.88], ["to", 42.88, 43.06], ["the", 43.06, 43.18], ["milk", 43.18, 43.4], ["cart", 43.4, 43.68], ["and", 43.68, 43.94], ["it", 43.94, 44.04], ["was", 44.04, 44.18], ["pulling", 44.18, 44.58], ["the", 44.58, 44.78], ["milk", 44.78, 44.98], ["cart", 44.98, 45.22], ["You", 45.22, 45.48], ["see", 45.48, 45.64], ["back", 45.64, 46.02], ["then", 46.02, 46.44], ["betting", 46.44, 46.74], ["rooms", 46.74, 47.0], ["didn't", 47.0, 47.3], ["find", 47.3, 47.52], ["out", 47.52, 47.7], ["who", 47.7, 47.9], ["won", 47.9, 48.22], ["until", 48.22, 48.56], ["the", 48.56, 48.72], ["winner", 48.72, 48.96], ["came", 48.96, 49.2], ["clicking", 49.2, 49.54], ["in", 49.54, 49.76], ["over", 49.76, 50.0], ["a", 50.0, 50.14], ["wire", 50.14, 50.38], ["and", 50.38, 50.62], ["until", 50.62, 50.88], ["it", 50.88, 51.04], ["did", 51.04, 51.26], ["Bet", 51.26, 51.7], ["stayed", 51.7, 52.04], ["open", 52.04, 52.42], ["up", 52.42, 52.68], ["on", 52.68, 52.82], ["that", 52.82, 52.96], ["hill", 52.96, 53.26], ["his", 53.26, 53.52], ["buddy", 53.52, 53.8], ["just", 53.8, 54.0], ["watched", 54.0, 54.34], ["horse", 54.34, 54.62], ["nine", 54.62, 54.92], ["come", 54.92, 55.18], ["out", 55.18, 55.36], ["of", 55.36, 55.46], ["nowhere", 55.46, 55.92], ["and", 55.92, 56.24], ["steal", 56.24, 56.64], ["it", 56.64, 56.86], ["by", 56.86, 57.02], ["a", 57.02, 57.14], ["nose", 57.14, 57.4], ["So", 57.4, 57.88], ["while", 57.88, 58.18], ["the", 58.18, 58.28], ["room", 58.28, 58.48], ["is", 58.48, 58.62], ["still", 58.62, 58.86], ["laughing", 58.86, 59.24], ["the", 59.24, 59.6], ["wire", 59.6, 59.92], ["starts", 59.92, 60.24], ["clicking", 60.24, 60.6], ["and", 60.6, 60.9], ["by", 60.9, 61.0], ["the", 61.0, 61.12], ["time", 61.12, 61.32], ["it", 61.32, 61.44], ["spells", 61.44, 61.72], ["out", 61.72, 61.94], ["nine", 61.94, 62.26], ["nobody's", 62.26, 63.14], ["laughing", 63.14, 63.42], ["anymore", 63.42, 63.72]];
function captionAt(t) {
  let i = WORDS.findIndex(w => t >= w[1] && t < w[2]);
  if (i < 0) { // gap: hold last word briefly
    for (let j = WORDS.length - 1; j >= 0; j--) if (t >= WORDS[j][2] && t - WORDS[j][2] < .3) { i = j; break; }
  }
  if (i < 0) return null;
  let s = WORDS[i][0], end = WORDS[i][2];
  while (i + 1 < WORDS.length && WORDS[i + 1][1] - end < .07 && (s + ' ' + WORDS[i + 1][0]).length <= 15) { i++; s += ' ' + WORDS[i][0]; end = WORDS[i][2]; }
  return s;
}
function drawCaption(g, t) {
  const s = captionAt(t); if (!s) return;
  const low = s.toLowerCase();
  const col = /nine|100|five|fifth/.test(low) ? '#ffd23e' : /flash|steal|slowest/.test(low) ? '#ffb03a' : '#ffffff';
  txt(g, s, DW / 2, 1158, 56, col, 'center', 900, 12);
}

// ================= SHARED PROPS =================
function tableDraw(g, x, y, w) { g.fillStyle = '#8a5a30'; rr(g, x - w / 2, y, w, 26, 6); g.fill(); g.fillStyle = '#6e4522'; g.fillRect(x - w / 2 + 14, y + 26, 18, 90); g.fillRect(x + w / 2 - 32, y + 26, 18, 90); }
function coinsBurst(g, t, x, y, t0) {
  const lt = t - t0; if (lt < 0 || lt > 1.6) return;
  for (let i = 0; i < 26; i++) {
    const a = R(i * 1.7) * Math.PI - Math.PI * .1, sp = 130 + R(i * 3.1) * 300;
    const px = x + Math.cos(a) * sp * lt * .8, py = y - Math.abs(Math.sin(a)) * sp * lt + 300 * lt * lt;
    if (i % 3) { g.fillStyle = '#ffd23e'; ell(g, px, py, 8, 8); g.fill(); g.strokeStyle = '#a87b12'; g.lineWidth = 1.6; g.stroke(); }
    else { g.save(); g.translate(px, py); g.rotate(R(i) * 6 + lt * 5); g.fillStyle = '#e89ab0'; g.fillRect(-9, -6, 18, 12); g.restore(); }
  }
}
function bigMirror(g, x, y, w, h, t, o = {}) {
  g.fillStyle = '#6e4522'; g.fillRect(x - 12, y + h, 20, 90); g.fillRect(x + w - 8, y + h, 20, 90);
  g.fillStyle = '#c8a24a'; rr(g, x, y, w, h, 14); g.fill();
  const gl = g.createLinearGradient(x, y, x + w, y + h); gl.addColorStop(0, '#bfe0ee'); gl.addColorStop(.5, '#e8f6fc'); gl.addColorStop(1, '#9fc6da');
  g.fillStyle = gl; rr(g, x + 12, y + 12, w - 24, h - 24, 10); g.fill();
  if (o.glint > 0) { g.save(); rr(g, x + 12, y + 12, w - 24, h - 24, 10); g.clip(); g.fillStyle = `rgba(255,255,255,${.75 * o.glint})`; const gx = x - 60 + o.glint * (w + 120); poly(g, [[gx, y + h], [gx + 44, y + h], [gx + 120, y], [gx + 76, y]]); g.fill(); g.restore(); }
  if (o.sack) { g.fillStyle = '#9a7d55'; rr(g, x + 4, y + 4, w - 8, h - 8, 12); g.fill(); g.strokeStyle = 'rgba(70,50,26,.6)'; g.lineWidth = 3; line(g, x + 10, y + h * .4, x + w - 10, y + h * .4); }
  if (o.dark) { g.fillStyle = 'rgba(38,44,54,.88)'; rr(g, x + 12, y + 12, w - 24, h - 24, 10); g.fill(); }
}
function chalkBoard(g, x, y, lines) {
  g.fillStyle = '#2f3a33'; rr(g, x, y, 108, 128, 6); g.fill(); g.strokeStyle = '#8a5a30'; g.lineWidth = 6; rr(g, x, y, 108, 128, 6); g.stroke();
  lines.forEach((L, i) => txt(g, L, x + 54, y + 34 + i * 42, 34, '#f2f2e4'));
}
function moneyStack(g, x, y, n) { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#a9d18e' : '#bfe3a8'; g.fillRect(x, y - i * 15, 74, 13); g.strokeStyle = '#4a7a3a'; g.lineWidth = 1.6; g.strokeRect(x, y - i * 15, 74, 13); } }
function finishPost(g, x) { g.fillStyle = '#22242e'; g.fillRect(x, 700, 12, 340); g.fillStyle = '#c23b2e'; ell(g, x + 6, 692, 17, 17); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); txt(g, 'FINISH', x + 6, 640, 30, '#fff', 'center', 900, 7); }

// ================= SHOTS =================
const SHOTS = [
  { a: 0, b: 1.7, tr: 'cut', cam: { fx: 330, fy: 800, s0: 1.04, s1: 1.13 }, draw(g, t, lt, k) {
      trackWorld(g, t, 0, 0);
      tableDraw(g, 400, 930, 340);
      fox(g, 235, 800, 185, t, { armUp: true, hammer: true, hammerHit: seg(t, .82, 1.0) * 1.4, eye: 'half', mouth: 'grin' });
      if (t < 1.0) piggyBank(g, 452, 918, 118); else { g.fillStyle = '#e89ab0'; ell(g, 452, 952, 44, 13); g.fill(); coinsBurst(g, t, 452, 905, 1.0); }
  } },
  { a: 1.7, b: 3.6, tr: 'dissolve', cam: { fx: 360, fy: 900, s0: 1.02, s1: 1.1 }, draw(g, t, lt, k) {
      trackWorld(g, t, 0, lt * 620);
      if (k < .62) { horseDraw(g, 330, 950, 150, t, { gallop: true, col: '#8a5a30', num: '1', jockey: true, silks: '#c23b2e' }); horseDraw(g, 120, 990, 128, t, { gallop: true, col: '#5b4a3a', num: '4', jockey: true, silks: '#2b6cb0' }); dust(g, t, 240, 1035, 6, 4); }
      else { horseDraw(g, 800 - (k - .62) * 500, 950, 140, t, { gallop: true, col: '#8a5a30', num: '1', jockey: true, silks: '#c23b2e' }); horseDraw(g, 215, 985, 100, t, { col: '#b9b3a4', spots: true, num: '9', saddle: '#3f7a3a' }); g.fillStyle = '#f2ecd8'; g.fillRect(268, 905, 30, 40); }
  } },
  { a: 3.6, b: 5.6, tr: 'dissolve', cam: { fx: 360, fy: 760, s0: 1.0, s1: 1.12 }, draw(g, t, lt, k) {
      roomWorld(g, t, 0, ['RACE 1', '9 MILK RUN', '100-1']);
      sheep(g, 105, 830, 128, t, { mouth: 'laugh', seed: 1 }); pigChar(g, 615, 835, 128, t, { mouth: 'laugh', seed: 2 });
      chicken(g, 190, 900, 105, t, { seed: 3 }); goat(g, 545, 815, 138, t, { mouth: 'laugh', eye: 'closed' });
      bench(g, 360, 930); fox(g, 360, 800, 150, t, { eye: 'closed', mouth: 'smile', still: true });
  } },
  { a: 5.6, b: 10.3, tr: 'dissolve', cam: { fx: 360, fy: 800, s0: 1.06, s1: 1.52 }, draw(g, t, lt, k) {
      roomWorld(g, t, 0, ['RACE 3', '9 MILK RUN', '100-1']);
      sheep(g, 60, 815, 140, t, { mouth: 'laugh', seed: 1 }); pigChar(g, 665, 820, 140, t, { mouth: 'laugh', seed: 2 });
      bench(g, 360, 935);
      fox(g, 360, 795, 195, t, { eye: t < 8.4 ? 'closed' : 'open', mouth: 'smile', holdMirror: t >= 9.1, glint: seg(t, 9.5, 10.2) });
  } },
  { a: 10.3, b: 12.7, tr: 'dissolve', cam: { fx: 545, fy: 975, s0: 1.12, s1: 4.1, fx0: 350, fy0: 810 }, draw(g, t, lt, k) {
      roomWorld(g, t, 0, ['RACE 3', '9 MILK RUN', '100-1']);
      bench(g, 400, 940);
      goat(g, lerp(-90, 205, eoc(seg(t, 10.3, 11.0))), 800, 180, t, { mouth: 'talk', point: t > 11.2, eye: 'look' });
      fox(g, 445, 795, 190, t, { holdMirror: true, glint: seg(t, 11.8, 12.5), eye: 'half', mouth: 'smile' });
      if (t > 12.35) { g.fillStyle = `rgba(230,246,255,${seg(t, 12.35, 12.7)})`; g.fillRect(-600, -500, 2200, 2400); }
  } },
  { a: 12.7, b: 15.3, tr: 'dissolve', cam: { fx: 360, fy: 700, s0: 1.06, s1: 1.16 }, draw(g, t, lt, k) {
      townWorld(g, t, 0, 0, k);
      g.fillStyle = '#6f9a4c'; ell(g, 360, 420, 330, 130); g.fill();
      if (k > .7) { g.fillStyle = `rgba(255,255,255,${.5 + Math.sin(t * 9) * .4})`; ell(g, 400, 330, 9, 9); g.fill(); }
      txt(g, 'THE HILL →', 360, 250, 36, '#fff', 'center', 900, 8);
  } },
  { a: 15.3, b: 18.3, tr: 'dissolve', cam: { fx: 400, fy: 740, s0: 1.0, s1: 1.24 }, draw(g, t, lt, k) {
      skyGrad(g, 0); clouds(g, t, 0, 5); hillsFar(g, 0, 0);
      g.fillStyle = '#79a84e'; ell(g, 360, 1150, 700, 420); g.fill();
      bigMirror(g, 400, 560, 210, 300, t, { glint: seg(t, 17.1, 18.1) });
      owl(g, 225, 790, 175, t, { wingUp: t > 16.4 });
      chalkBoard(g, 620, 900, ['RACE', '—']);
      g.fillStyle = '#8a5a30'; g.fillRect(90, 1010, 90, 60);
  } },
  { a: 18.3, b: 21.5, tr: 'cut', cam: { fx: 360, fy: 740, s0: 1.1, s1: 1.1 }, draw(g, t, lt, k) {
      const hillScene = (tally, sack) => { skyGrad(g, 0); clouds(g, t, 0, 5); hillsFar(g, 0, 0); g.fillStyle = '#79a84e'; ell(g, 360, 1150, 700, 420); g.fill(); bigMirror(g, 400, 560, 210, 300, t, { sack, dark: !sack && tally > 0 }); owl(g, 225, 790, 175, t, { holdChalk: tally >= 0, wingUp: sack > 0 }); chalkBoard(g, 620, 900, tally === 0 ? ['RACE', '—'] : ['RACE', tally === 1 ? 'I' : 'II']); };
      if (lt < .7) hillScene(0, 0);
      else if (lt < 1.5) { g.fillStyle = '#06070c'; g.fillRect(-600, -500, 2200, 2400); g.save(); ell(g, 360, 660, 305, 305); g.clip(); g.translate(-60, 60); g.scale(1.15, 1.15); trackWorld(g, t, 0, lt * 300); horseDraw(g, 330, 900, 130, t, { gallop: true, col: '#8a5a30', num: '1', jockey: true, silks: '#c23b2e' }); finishPost(g, 560); g.restore(); }
      else if (lt < 2.3) hillScene(1, 0);
      else hillScene(2, 1);
  } },
  { a: 21.5, b: 24.0, tr: 'dissolve', cam: { fx: 360, fy: 800, s0: 1.0, s1: 1.14 }, draw(g, t, lt, k) {
      roomWorld(g, t, .06, ['RACE 5', 'FAV 1-5', 'NINE 100-1']);
      barrelTable(g, 360, 905);
      goat(g, 205, 800, 140, t, { mouth: 'talk' }); sheep(g, 520, 800, 130, t, { mouth: 'grin', seed: 5 });
      pigChar(g, 330, 745, 112, t, { mouth: 'talk', seed: 6 }); chicken(g, 460, 760, 95, t, { seed: 7 });
      g.fillStyle = '#ffd23e'; for (let i = 0; i < 7; i++) { ell(g, 310 + R(i * 3) * 100, 892 + Math.sin(t * 5 + i * 2) * 3, 11, 6); g.fill(); }
      bench(g, 105, 1010, 200); fox(g, 105, 905, 105, t, { eye: 'closed', mouth: 'smile', still: true });
  } },
  { a: 24.0, b: 27.3, tr: 'dissolve', cam: { fx: 350, fy: 800, s0: 1.06, s1: 1.2 }, draw(g, t, lt, k) {
      roomWorld(g, t, .06, ['RACE 5', 'FAV 1-5', 'NINE 100-1']);
      bench(g, 380, 940);
      if (t < 26.3) { goat(g, 220, 795, 180, t, { wipe: true, mouth: 'laugh' }); mirrorProp(g, 292, 905, 1.1, .3); }
      else goat(g, 220, 795, 180, t, { mouth: 'grin', point: true });
      fox(g, 445, 795, 185, t, { eye: 'half', mouth: 'smile', holdMirror: t >= 26.3 });
  } },
  { a: 27.3, b: 32.0, tr: 'dissolve', cam: { fx: 360, fy: 910, s0: 1.04, s1: 1.12 }, draw(g, t, lt, k) {
      trackWorld(g, t, .05, lt * 950);
      horseDraw(g, 345, 955, 158, t, { gallop: true, col: '#8a5a30', num: '1', jockey: true, silks: '#c23b2e', wave: t > 29.5 && t < 31.5 });
      horseDraw(g, 105, 1000, 120, t, { gallop: true, col: '#5b4a3a', num: '4', jockey: true, silks: '#2b6cb0' });
      dust(g, t, 260, 1045, 7, 9);
      const px = 1250 - lt * 1500; if (px > -80 && px < 900) finishPost(g, px);
  } },
  { a: 32.0, b: 34.8, tr: 'dissolve', cam: { fx: 500, fy: 880, s0: 1.0, s1: 1.48, fx0: 300, fy0: 900 }, draw(g, t, lt, k) {
      skyGrad(g, .05); clouds(g, t, .05, 2); hillsFar(g, .05, 0);
      g.fillStyle = '#c99a68'; g.fillRect(-500, 800, 2000, 880);
      g.fillStyle = '#f6f2e8'; g.fillRect(-500, 806, 2000, 9);
      for (let i = 0; i < 5; i++) { g.fillStyle = '#3f6b36'; ell(g, 60 + i * 150, 560, 34, 150); g.fill(); g.fillStyle = '#5a3a26'; g.fillRect(54 + i * 150, 690, 12, 120); }
      carShape(g, 180, 950, 1.1, [120, 150, 205], .05); carShape(g, 640, 1010, 1.25, [214, 120, 92], .05);
      g.fillStyle = '#f2ecd8'; rr(g, 400, 700, 190, 56, 6); g.fill(); txt(g, 'PARKING 10¢', 495, 729, 30, '#7a2e22');
      horseDraw(g, 520, 905, 58, t, { col: '#b9b3a4', spots: true, num: '9', saddle: '#3f7a3a' });
  } },
  { a: 34.8, b: 37.0, tr: 'dissolve', cam: { fx: 380, fy: 800, s0: 1.1, s1: 1.3 }, draw(g, t, lt, k) {
      roomWorld(g, t, .1, ['RACE 8', 'FAV 1-9', 'NINE 100-1']);
      const fl = seg(t, 35.0, 35.45) * (0.75 + Math.sin(t * 22) * .12);
      if (fl > 0) { const fg = g.createRadialGradient(360, 260, 10, 360, 260, 330); fg.addColorStop(0, `rgba(255,252,220,${.95 * fl})`); fg.addColorStop(1, 'rgba(255,252,220,0)'); g.fillStyle = fg; g.fillRect(150, 30, 420, 460); g.fillStyle = `rgba(255,244,190,${.22 * fl})`; g.fillRect(-500, -400, 2000, 2080); }
      bench(g, 390, 940);
      goat(g, 205, 800, 175, t, { eye: t > 35.5 ? 'shock' : 'open', mouth: t > 35.5 ? 'o' : 'grin' });
      fox(g, 450, lerp(800, 772, seg(t, 35.9, 36.4)), 190, t, { eye: t > 35.35 ? 'coin' : 'closed', mouth: 'grin', moneyBox: t > 36.1, holdMirror: t <= 36.1 });
  } },
  { a: 37.0, b: 39.0, tr: 'dissolve', cam: { fx: 300, fy: 830, s0: 1.22, s1: 1.22, followFox: true }, draw(g, t, lt, k) {
      roomWorld(g, t, .1, ['RACE 8', 'FAV 1-9', 'NINE 100-1']);
      const fxX = lerp(140, 430, eio(k));
      fox(g, fxX, 800, 180, t, { walk: true, moneyBox: true, eye: 'coin', mouth: 'grin' });
      g.fillStyle = '#5d3a22'; rr(g, 480, 905, 330, 200, 8); g.fill(); g.fillStyle = '#7a4e2a'; rr(g, 470, 880, 350, 34, 8); g.fill();
      if (k > .78) { moneyStack(g, 540, 872, 4); moneyStack(g, 640, 872, 3); }
      this._fx = fxX;
  } },
  { a: 39.0, b: 43.0, tr: 'dissolve', cam: { fx: 360, fy: 760, s0: 1.14, s1: 1.34 }, draw(g, t, lt, k) {
      g.fillStyle = '#6e3430'; g.fillRect(-500, -400, 2000, 1200); g.fillStyle = '#54302c'; for (let i = 0; i < 8; i++) g.fillRect(-500 + i * 250, -400, 60, 1200);
      txt(g, 'NOT RESPONSIBLE FOR ERRORS', 330, 130, 30, '#e8cfa0'); txt(g, 'PAY WEIGHTS AND JOCKEYS', 330, 172, 26, '#c8a878');
      g.fillStyle = '#4a2c1c'; rr(g, -100, 900, 1000, 500, 10); g.fill();
      moneyStack(g, 90, 890, 5); moneyStack(g, 560, 890, 4);
      // milk bottle prop
      g.fillStyle = '#eef2e8'; rr(g, 596, 800, 34, 92, 9); g.fill(); g.fillStyle = '#c23b2e'; g.fillRect(596, 838, 34, 22); txt(g, 'MILK', 613, 850, 15, '#fff');
      if (t > 41.15 && t < 41.6) { const fk = seg(t, 41.15, 41.6); g.save(); g.translate(lerp(80, 428, fk), lerp(760, 700, fk) - Math.sin(fk * 3.1) * 60); g.rotate(fk * 5); g.fillStyle = '#bfe3a8'; g.fillRect(-11, -16, 22, 32); txt(g, '$', 0, 0, 22, '#2e5b28'); g.restore(); }
      bulldog(g, 360, 745, 265, t, { mouth: 'talk', sweat: t > 40.1, noteStuck: t >= 41.6, eye: t > 41.6 ? 'shock' : 'half' });
  } },
  { a: 43.0, b: 46.5, tr: 'dissolve', cam: { fx: 360, fy: 850, s0: 1.05, s1: 1.1 }, draw(g, t, lt, k) {
      townWorld(g, t, .12, 0, .3);
      g.strokeStyle = '#4a3423'; g.lineWidth = 10; line(g, 90, 560, 90, 900); line(g, 630, 560, 630, 900);
      g.fillStyle = '#c8452c'; rr(g, 90, 520, 540, 54, 8); g.fill(); txt(g, '— FINISH —', 360, 548, 34, '#fff');
      const hx = lerp(215, 520, k);
      horseDraw(g, hx, 985, 105, t, { col: '#ddd6c4', num: '', saddle: '#5b7a9a' });
      // cart
      g.save(); g.translate(hx - 175, 960); g.fillStyle = '#2b6cb0'; rr(g, -95, -60, 190, 105, 8); g.fill(); txt(g, 'MILK RUN', 0, -28, 27, '#fff'); txt(g, 'DAIRY', 0, 4, 27, '#ffd23e');
      g.fillStyle = '#c23b2e'; ell(g, -55, 58, 30, 30); g.fill(); ell(g, 55, 58, 30, 30); g.fill(); g.fillStyle = '#f2ecd8'; ell(g, -55, 58, 11, 11); g.fill(); ell(g, 55, 58, 11, 11); g.fill(); g.restore();
      g.strokeStyle = '#6e4522'; g.lineWidth = 7; line(g, hx - 90, 950, hx - 55, 965);
      if (t > 45.5) { const bk = seg(t, 45.5, 46.1); g.save(); g.translate(hx - 130, 900 + bk * 95); g.rotate(bk * 3); g.fillStyle = '#eef2e8'; rr(g, -9, -24, 18, 48, 6); g.fill(); g.restore(); }
      dust(g, t, hx - 40, 1060, 3, 21, 30);
  } },
  { a: 46.5, b: 52.5, tr: 'dissolve', cam: { fx: 330, fy: 862, s0: 1.06, s1: 1.14 }, draw(g, t, lt, k) {
      if (lt < 1.8) { townWorld(g, t, .55, lt * 60, .2); txt(g, 'BACK THEN…', 200, 300, 34, '#ffe9a8', 'center', 900, 8); return; }
      g.fillStyle = '#4a3040'; g.fillRect(-500, -400, 2000, 2080);
      g.fillStyle = '#382636'; g.fillRect(-500, 1085, 2000, 600); // floor
      // dusk window with the wire coming in
      g.save(); rr(g, 452, 210, 235, 300, 8); g.clip(); const wg = g.createLinearGradient(0, 210, 0, 510); wg.addColorStop(0, '#584a78'); wg.addColorStop(1, '#c86a4a'); g.fillStyle = wg; g.fillRect(452, 210, 235, 300); g.strokeStyle = '#241a20'; g.lineWidth = 6; line(g, 560, 510, 560, 300); line(g, 520, 330, 600, 330); g.restore();
      g.strokeStyle = '#2c1e14'; g.lineWidth = 9; rr(g, 452, 210, 235, 300, 8); g.stroke();
      g.fillStyle = '#26343a'; rr(g, 20, 200, 240, 400, 8); g.fill(); g.strokeStyle = '#c8a24a'; g.lineWidth = 4; rr(g, 20, 200, 240, 400, 8); g.stroke(); txt(g, 'RACE 8', 140, 272, 36, '#e8f0e2'); txt(g, 'WHO', 140, 356, 44, '#ffd23e'); txt(g, 'WON?', 140, 420, 44, '#ffd23e');
      g.strokeStyle = '#c8b088'; g.lineWidth = 3; g.beginPath(); g.moveTo(-500, 120); g.quadraticCurveTo(360, 190, 1500, 110); g.stroke();
      g.fillStyle = '#6e4522'; rr(g, -200, 1015, 1200, 62, 8); g.fill();
      // telegraph key — clicks at 49.6 & 50.9
      const click = (Math.abs(t - 49.6) < .18 || Math.abs(t - 50.9) < .18 || Math.abs(t - 52.0) < .18) ? 1 : 0;
      g.fillStyle = '#3a2a1a'; rr(g, 330, 967, 150, 52, 8); g.fill();
      g.save(); g.translate(405, 973); g.rotate(click ? .16 : -.04); g.fillStyle = '#c8a24a'; g.fillRect(-70, -10, 140, 12); ell(g, 66, -14, 15, 11); g.fillStyle = '#8a5a30'; g.fill(); g.restore();
      if (click) { g.strokeStyle = '#ffe9a8'; g.lineWidth = 3.4; for (let i = 0; i < 5; i++) { const a = -2.6 + i * .5; line(g, 480, 945, 480 + Math.cos(a) * 34, 945 + Math.sin(a) * 34); } txt(g, 'CLICK!', 520, 905, 30, '#ffe9a8'); }
      g.fillStyle = '#f2ecd8'; g.fillRect(520, 977, 130, 42); g.fillStyle = 'rgba(60,50,40,.5)'; for (let i = 0; i < 4; i++) g.fillRect(532, 989 + i * 8, 100 - i * 14, 3);
      sheep(g, 578, 895, 110, t, { eye: 'half', mouth: 'flat', seed: 8, col: '#5b7a9a' });
  } },
  { a: 52.5, b: 57.4, tr: 'cut', cam: { fx: 360, fy: 880, s0: 1.08, s1: 1.12 }, draw(g, t, lt, k) {
      if (lt < 1.4) { skyGrad(g, .75); clouds(g, t, .75, 6); hillsFar(g, .75, 0); g.fillStyle = '#5f7a44'; ell(g, 360, 1150, 700, 420); g.fill(); bigMirror(g, 400, 560, 210, 300, t, { sack: lt < .8, glint: seg(t, 53.3, 53.9) }); owl(g, 225, 790, 178, t, { wingUp: true, noHat: false }); chalkBoard(g, 620, 900, ['RACE', 'II']); return; }
      trackWorld(g, t, .7, (lt - 1.4) * 500);
      horseDraw(g, 440, 950, 150, t, { gallop: true, col: '#8a5a30', num: '1', jockey: true, silks: '#c23b2e' });
      const hx = lerp(30, 492, eoc(seg(t, 53.9, 56.9)));
      // red speed trails
      g.strokeStyle = 'rgba(230,60,40,.75)'; g.lineWidth = 6; for (let i = 0; i < 4; i++) { const yy = 990 + i * 26; line(g, hx - 190 - R(i * 7) * 40, yy, hx - 90, yy + Math.sin(t * 20 + i) * 4); }
      horseDraw(g, hx, 975, 142, t, { gallop: true, col: '#b9b3a4', spots: true, num: '9', saddle: '#3f7a3a', jockey: true, silks: '#3f7a3a' });
      dust(g, t, hx - 60, 1055, 6, 31);
      finishPost(g, 585);
  } },
  { a: 57.4, b: 64.07, tr: 'dissolve', cam: { fx: 360, fy: 810, s0: 1.04, s1: 1.2 }, draw(g, t, lt, k) {
      const reveal = t >= 60.6;
      roomWorld(g, t, 1, reveal ? ['RACE 8', 'WINNER', '★ NINE ★', '1000-1'] : ['RACE 8', '1 FAV 1-5', '9 MILK 100-1'], true);
      // ladder + chicken updating board
      g.strokeStyle = '#8a5a30'; g.lineWidth = 7; line(g, 800, 240, 770, 700); line(g, 860, 240, 890, 700); for (let i = 0; i < 4; i++) line(g, 786 - i * 4, 330 + i * 100, 850 + i * 4, 330 + i * 100);
      chicken(g, 838, 300, 78, t, { seed: 11 });
      barrelTable(g, 330, 930);
      const shock = reveal;
      goat(g, 150, 815, 140, t, { eye: shock ? 'shock' : 'closed', mouth: shock ? 'o' : 'laugh' });
      sheep(g, 560, 810, 132, t, { eye: shock ? 'shock' : 'closed', mouth: shock ? 'o' : 'laugh', seed: 12 });
      pigChar(g, 480, 880, 118, t, { eye: shock ? 'shock' : 'closed', mouth: shock ? 'o' : 'laugh', seed: 13 });
      fox(g, 330, 790, 175, t, { eye: shock ? 'open' : 'closed', mouth: 'smile', still: true });
      if (t > 58 && t < 60.4 && ((t * 2) | 0) % 2 === 0) txt(g, 'click… click…', 620, 1080, 30, '#ffe9a8');
      if (reveal) { // money rain + growing pile
        for (let i = 0; i < 22; i++) { const cyc = (lt - 3.2 + R(i * 1.31) * 2.4) % 2.6; if (cyc < 0) continue; const x = 90 + R(i * 3.7) * 560, yy = -40 + cyc * 460; g.save(); g.translate(x, yy); g.rotate(R(i) * 3 + cyc * 2); g.fillStyle = '#bfe3a8'; g.fillRect(-24, -11, 48, 22); g.strokeStyle = '#4a7a3a'; g.strokeRect(-24, -11, 48, 22); txt(g, '$', 0, 0, 17, '#2e5b28'); g.restore(); }
        const pile = seg(t, 60.8, 63.6); g.fillStyle = '#a9d18e'; ell(g, 340, 1245, 240 * pile + 10, 62 * pile + 6); g.fill(); g.fillStyle = '#bfe3a8'; ell(g, 300, 1225, 150 * pile, 40 * pile + 4); g.fill();
      }
  } },
];

// ================= ENGINE =================
function camOf(sh, t) {
  const k = eio(clamp((t - sh.a) / (sh.b - sh.a), 0, 1));
  const c = sh.cam;
  return { fx: lerp(c.fx0 !== undefined ? c.fx0 : c.fx, c.fx, k), fy: lerp(c.fy0 !== undefined ? c.fy0 : c.fy, c.fy, k), s: lerp(c.s0, c.s1, k) };
}
function renderShot(g, sh, t) {
  const c = camOf(sh, t);
  g.save();
  g.translate(540, 960); g.scale(1.5 * c.s, 1.5 * c.s); g.translate(-c.fx, -c.fy);
  sh.draw(g, t, t - sh.a, clamp((t - sh.a) / (sh.b - sh.a), 0, 1));
  g.restore();
}
function drawFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1920);
  let i = SHOTS.findIndex(s => t >= s.a && t < s.b); if (i < 0) i = SHOTS.length - 1;
  const sh = SHOTS[i];
  if (i > 0 && sh.tr === 'dissolve' && t - sh.a < .45) {
    // cross-dissolve: previous shot underneath, current fades in
    octx.setTransform(1, 0, 0, 1, 0, 0); octx.fillStyle = '#000'; octx.fillRect(0, 0, 1080, 1920);
    const prev = SHOTS[i - 1];
    const pc = camOf(prev, prev.b - .01);
    octx.save(); octx.translate(540, 960); octx.scale(1.5 * pc.s, 1.5 * pc.s); octx.translate(-pc.fx, -pc.fy);
    prev.draw(octx, t, t - prev.a, 1); octx.restore();
    ctx.drawImage(off, 0, 0);
    ctx.save(); ctx.globalAlpha = seg(t, sh.a, sh.a + .45); renderShot(ctx, sh, t); ctx.restore();
  } else renderShot(ctx, sh, t);
  // captions in screen space
  ctx.save(); ctx.translate(540, 960); ctx.scale(1.5, 1.5); ctx.translate(-360, -640);
  drawCaption(ctx, t); ctx.restore();
}
window.renderFrame = (f) => { drawFrame(f / FPS); };
window.ready = true;
