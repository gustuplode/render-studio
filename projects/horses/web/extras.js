// Project extras for Seabiscuit: the racehorse card — side view, stand and
// gallop, optional crouched jockey in silks. War Admiral = same painter,
// darker + sleeker via opts (bigger scale comes from the actor scale).
import { mul, thickAngle, ellPts, curve } from './toon.js';

const rad = (d) => d * Math.PI / 180;

/** Horse — opts: gallop 0..1, step (gallop phase), blink, dark 0/1, blaze 0/1,
 *  jockey: {silks, cap} | null, tired 0/1 (head low) */
export const horseCard = (p, o = {}) => {
  const light = rad(-120), thick = thickAngle(light), ow = 5.5;
  const coat = o.dark ? '#4e2e20' : '#7a4632', coatDk = mul(coat, [0.66, 0.66, 0.72]), coatLt = mul(coat, [1.24, 1.2, 1.14]);
  const mane = '#241a14', ground = 975;
  const g = o.gallop || 0, ph = (o.step || 0) * Math.PI * 2;
  const bobY = g ? Math.sin(ph * 2) * 14 - 6 : 0;
  const stretch = g ? Math.sin(ph) * 0.5 + 0.5 : 0; // 0 gathered, 1 extended
  const eye = (x, y, s = 1) => {
    if (o.blink) { p.arc(x, y, 9 * s, 5.5 * s, 200, 340, 3.8 * s, '#17120e'); return; }
    p.dot(x, y, 7.6 * s, '#17120e'); p.dot(x + 2.2 * s, y - 2.6 * s, 2.4 * s, '#ffffff');
  };
  const leg = (hx, hy, a1, a2, hoof = true) => { // two-segment leg by joint angles
    const k = [hx + Math.sin(a1) * 88, hy + Math.cos(a1) * 88];
    const f = [k[0] + Math.sin(a2) * 82, k[1] + Math.cos(a2) * 82];
    p.stroke([[hx, hy], k], 15, coatDk); p.stroke([k, f], 11.5, coat);
    if (hoof) p.ell(f[0] + 5, Math.min(f[1], ground - 2), 13, 6.5, '#2e2c30', 2);
    return f;
  };
  const legPose = (front, phaseOff) => { // returns [a1, a2] for a leg
    if (!g) return front ? [0.06, 0.05] : [-0.05, 0.1];
    const s = Math.sin(ph + phaseOff);
    return front ? [s * 0.85, s * 0.85 + (s > 0 ? -0.5 : 0.65)] : [-s * 0.85, -s * 0.85 + (s > 0 ? 0.55 : -0.6)];
  };
  const Y = 690 + bobY;
  // tail: flowing black banner
  const tw = Math.sin(ph * 2 + 1) * (g ? 22 : 7);
  p.stroke(curve([112, Y - 66], [52, Y - 30], [40 + tw, Y + 92]), 17, mane);
  p.stroke(curve([112, Y - 60], [66, Y - 6], [64 + tw, Y + 104]), 13, mane);
  // far legs (darker)
  leg(168, Y + 58, ...legPose(false, 0.5));
  leg(428, Y + 58, ...legPose(true, 0.5));
  // body: deep barrel, sloped croup
  const bp = ellPts(300, Y, 196, 96, 0, 360, -0.03, 48);
  p.shadedFill(bp, coat, mul(coat, [0.8, 0.8, 0.86]), light, 172, 0.38); p.inkRing(bp, ow, thick);
  p.clip(bp, () => { p.ell(216, Y - 34, 118, 44, coatLt, 0); p.ell(404, Y + 40, 70, 40, coatDk, 0); });
  p.inkRing(bp, ow, thick);
  // neck + head: arched when standing, stretched long when galloping
  const tired = o.tired || 0;
  const nx = 452, ny = Y - 62 + tired * 26 - g * stretch * 6;
  const hx = 540 + g * stretch * 26, hy = Y - 128 + tired * 52 + g * (10 - stretch * 16);
  p.stroke(curve([nx - 30, ny + 30], [nx + 26, ny - 44], [hx - 52, hy + 22]), 44, coat);
  p.stroke(curve([nx - 34, ny + 36], [nx + 20, ny - 40], [hx - 56, hy + 28]), 46, mul(coat, [0.86, 0.86, 0.9]));
  // mane along the crest
  p.stroke(curve([nx - 6, ny - 52], [nx + 34, ny - 66], [hx - 44, hy - 2]), 13, mane);
  for (let i = 0; i < 5; i++) { const t = i / 4, x = nx + 2 + t * (hx - nx - 40), y = ny - 56 + t * (hy - ny + 52); p.stroke([[x, y], [x - 8, y + 22]], 6, mane); }
  // head: long face, flared nostril, ear pricked
  const hp = ellPts(hx, hy, 62, 34, 0, 360, 0.5, 36);
  p.shadedFill(hp, coat, mul(coat, [0.82, 0.82, 0.88]), light, 54, 0.35); p.inkRing(hp, ow * 0.85, thick);
  p.poly([[hx - 38, hy - 26], [hx - 20, hy - 56], [hx - 6, hy - 24]], coatDk, 3.4); // ear
  if (o.blaze) p.poly([[hx + 16, hy - 20], [hx + 30, hy - 14], [hx + 44, hy + 16], [hx + 30, hy + 20]], '#e9e2d2', 0);
  p.ell(hx + 48, hy + 12, 8.5, 6.5, '#33231c', 2); // nostril
  eye(hx + 8, hy - 8);
  // near legs
  leg(150, Y + 62, ...legPose(false, 0));
  leg(446, Y + 62, ...legPose(true, 0));
  // jockey, crouched low over the withers
  if (o.jockey) {
    const J = o.jockey, jx = 322, jy = Y - 128 + bobY * 0.4;
    p.stroke([[jx - 6, jy + 66], [jx - 44, jy + 108]], 13, '#e9e6de'); // breeches leg to stirrup
    p.stroke([[jx + 16, jy + 64], [jx - 18, jy + 110]], 13, '#ddd9d0');
    p.ell(jx - 46, jy + 112, 12, 6, '#2e2c30', 2); p.ell(jx - 20, jy + 114, 12, 6, '#2e2c30', 2); // boots
    const tp = ellPts(jx + 4, jy + 26, 30, 52, 0, 360, 0.85, 32); // torso leaned far forward
    p.shadedFill(tp, J.silks, mul(J.silks, [0.8, 0.8, 0.86]), light, 40, 0.35); p.inkRing(tp, ow * 0.8, thick);
    p.stroke([[jx + 26, jy + 8], [jx + 78, jy + 40]], 11, J.silks); // arm reaching to reins
    p.stroke([[jx + 78, jy + 40], [hx - 16, hy + 26]], 3, '#3a3236'); // rein line
    p.dot(jx + 40, jy - 22, 21, '#ffe2c2'); // head
    p.ell(jx + 40, jy - 34, 23, 10, J.cap || '#b03a30', 3); // silk cap
    p.poly([[jx + 58, jy - 30], [jx + 76, jy - 26], [jx + 58, jy - 20]], J.cap || '#b03a30', 2.4); // peak
  }
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
