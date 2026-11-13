// Project extras for Alex: the African grey parrot card — silver-grey body,
// white face patch, hooked black beak, and the species' scarlet tail.
import { mul, thickAngle, ellPts, curve } from './toon.js';

const rad = (d) => d * Math.PI / 180;

/** Alex — opts: view 'side'|'front', blink, tilt (-1..1 head tilt), beak 0..1 open, step (perch shuffle) */
export const alexCard = (p, o = {}) => {
  const light = rad(-120), thick = thickAngle(light), ow = 5.5;
  const body = '#8d9299', bodyDk = mul(body, [0.68, 0.68, 0.74]), bodyLt = '#a8adb3', face = '#e9e6de';
  const beak = '#26242a', tail = '#c22e2e', ground = 975;
  const eye = (x, y, s = 1) => {
    if (o.blink) { p.arc(x, y, 11 * s, 7 * s, 200, 340, 4.2 * s, '#26242a'); return; }
    p.dot(x, y, 11.5 * s, '#e8d9a0'); // pale iris ring — the grey's intelligent eye
    p.dot(x, y, 6.4 * s, '#17161a');
    p.dot(x + 2.4 * s, y - 2.6 * s, 2.2 * s, '#ffffff');
  };
  const feathers = (cx, cy, rx, ry, n, col) => { // scalloped feather arcs
    for (let i = 0; i < n; i++) { const a = rad(200 + i * (140 / Math.max(1, n - 1))); p.arc(cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.4 + ry * 0.28, rx * 0.3, ry * 0.22, 20, 160, 2.6, col); }
  };

  if (o.view === 'front') {
    const tilt = (o.tilt || 0) * 14;
    // tail below the perch line, body upright
    p.poly([[268, 800], [332, 800], [322, 968], [278, 968]], tail, 3);
    const bp = ellPts(300, 700, 118, 168, 0, 360, tilt * 0.2, 48);
    p.shadedFill(bp, body, mul(body, [0.82, 0.82, 0.88]), light, 104, 0.35); p.inkRing(bp, ow, thick);
    p.clip(bp, () => { feathers(300, 690, 118, 150, 5, bodyDk); p.ell(238, 730, 44, 90, bodyDk, 0); p.ell(362, 730, 44, 90, bodyDk, 0); });
    p.inkRing(bp, ow, thick);
    // feet gripping (perch bar is drawn by the set; feet wrap its line)
    for (const sd of [-1, 1]) { p.stroke([[300 + sd * 42, 852], [300 + sd * 50, 892]], 9, '#6a6e75'); for (let tI = 0; tI < 3; tI++) p.stroke([[300 + sd * 50, 892], [300 + sd * (34 + tI * 13), 906]], 4.6, '#55585e'); }
    // head with the white face patch
    const hx = 300 + tilt, hy = 452;
    const hp = ellPts(hx, hy, 96, 88, 0, 360, 0, 48);
    p.shadedFill(hp, body, mul(body, [0.84, 0.84, 0.9]), light, 84, 0.35); p.inkRing(hp, ow, thick);
    p.clip(hp, () => { p.ell(hx, hy + 8, 74, 66, face, 0); });
    p.inkRing(hp, ow, thick);
    eye(hx - 38, hy - 6); eye(hx + 38, hy - 6);
    // hooked beak, centre
    const bo = (o.beak || 0) * 16;
    p.poly([[hx - 21, hy + 18], [hx + 21, hy + 18], [hx + 13, hy + 52], [hx + 2, hy + 64], [hx - 8, hy + 52]], beak, 3.4);
    if (bo > 1) p.poly([[hx - 13, hy + 52 + bo * 0.3], [hx + 12, hy + 52 + bo * 0.3], [hx + 4, hy + 68 + bo], [hx - 6, hy + 66 + bo]], '#3a3740', 2.6);
    return;
  }
  // side view on a perch: body diagonal, tail long behind, head forward
  const st = o.step || 0, shuf = Math.sin(st * Math.PI * 2) * 5;
  // scarlet tail, long wedge down-back
  p.poly([[196, 700], [246, 724], [196 + shuf, 962], [150 + shuf, 946]], tail, 3.4);
  const bp = ellPts(308, 668, 128, 148, 0, 360, -0.32, 48);
  p.shadedFill(bp, body, mul(body, [0.82, 0.82, 0.88]), light, 112, 0.35); p.inkRing(bp, ow, thick);
  p.clip(bp, () => { // folded wing: darker shield with scallops
    const wp = ellPts(286, 676, 82, 108, 0, 360, -0.3, 40); p.poly(wp, bodyDk, 0);
    feathers(286, 660, 84, 100, 5, mul(bodyDk, [0.8, 0.8, 0.86]));
  });
  p.inkRing(bp, ow, thick);
  // feet on the perch line (y ~ 838 local)
  for (const fx of [286, 348]) { p.stroke([[fx, 806], [fx + 4, 840]], 9, '#6a6e75'); for (let tI = 0; tI < 3; tI++) p.stroke([[fx + 4, 840], [fx - 8 + tI * 13, 854]], 4.6, '#55585e'); }
  // head forward, tilted with curiosity
  const hx = 428, hy = 488 + Math.sin((o.wagPh || 0) * 6.28) * 4, tilt = (o.tilt || 0) * 12;
  const hp = ellPts(hx, hy, 82, 76, 0, 360, tilt * 0.06, 44);
  p.shadedFill(hp, body, mul(body, [0.84, 0.84, 0.9]), light, 74, 0.35); p.inkRing(hp, ow, thick);
  p.clip(hp, () => { p.ell(hx + 16, hy + 6, 62, 56, face, 0); });
  p.inkRing(hp, ow, thick);
  eye(hx + 22, hy - 8);
  // hooked beak pointing forward-down
  const bo = (o.beak || 0) * 13;
  p.poly([[hx + 52, hy + 2], [hx + 96, hy + 14], [hx + 76, hy + 44], [hx + 58, hy + 48], [hx + 50, hy + 30]], beak, 3.4);
  if (bo > 1) p.poly([[hx + 54, hy + 34 + bo * 0.3], [hx + 74, hy + 40 + bo * 0.3], [hx + 62, hy + 52 + bo], [hx + 50, hy + 46 + bo]], '#3a3740', 2.6);
};

// fxSpark — a small star-sparkle / glint card (muzzle flashes, medal glints).
// Drawn at the card's feet anchor so the actor (x, y, z) IS the flash point.
export function fxSpark(p, o = {}) {
  const n = o.n || 5, r = o.r || 52, col = o.col || '#ffe9a8';
  const g = p.g; g.save(); g.translate(300, 940);
  g.fillStyle = col; g.globalAlpha = 0.85;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    g.save(); g.rotate(a);
    g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.15, -r * 0.15); g.lineTo(0, 0); g.lineTo(-r * 0.15, -r * 0.15); g.closePath(); g.fill();
    g.restore();
  }
  g.globalAlpha = 1; g.fillStyle = '#fff8e6';
  g.beginPath(); g.arc(0, 0, r * 0.2, 0, 7); g.fill();
  g.restore();
}
