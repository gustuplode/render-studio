// Project extras for Bobby: the Skye terrier card (long shaggy coat, hair fall
// over the eyes — the breed's signature), in side / lie / front poses.
import { mul, thickAngle, ellPts, curve } from './toon.js';

const rad = (d) => d * Math.PI / 180;

/** Bobby — opts: pose 'side'|'lie'|'front', step, blink 0..1, collar 0/1, grey 0..1 (age), wagPh */
export const bobbyCard = (p, o = {}) => {
  const pose = o.pose || 'side';
  const light = rad(-120), thick = thickAngle(light), ow = 5.5;
  const grey = o.grey || 0;
  const mixc = (a, b, t) => { const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)); return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const fur = mixc('#4e4e58', '#83838c', grey), furTop = mixc('#6d6d78', '#a2a2a9', grey), furDk = mul(fur, [0.7, 0.7, 0.76]), furSh = mul(fur, [0.8, 0.8, 0.86]);
  const ground = 975;
  const fringe = (x0, x1, yTop, yBot, n, col) => { for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (i / (n - 1)) + Math.sin(i * 7.3) * 4; p.stroke([[x, yTop], [x + Math.sin(i * 3.1) * 5, yBot]], 5.5, col); } };
  const eye = (x, y, s = 1) => {
    if (o.blink) { p.arc(x, y, 10 * s, 6 * s, 200, 340, 4 * s, '#191922'); return; }
    p.dot(x, y, 8 * s, '#191922'); p.dot(x + 2.5 * s, y - 3 * s, 2.8 * s, '#ffffff');
  };
  const headSide = (hx, hy, s = 1, rest = false) => {
    // skull
    const hp = ellPts(hx, hy, 80 * s, 66 * s, 0, 360, 0, 40);
    p.shadedFill(hp, fur, furSh, light, 70 * s, 0.35); p.inkRing(hp, ow * 0.8, thick);
    // long hair fall over the eyes (the Skye curtain)
    p.clip(hp, () => {
      p.poly([[hx - 78 * s, hy - 60 * s], [hx + 82 * s, hy - 62 * s], [hx + 80 * s, hy + 6 * s], [hx + 30 * s, hy - 8 * s], [hx - 20 * s, hy + 2 * s], [hx - 76 * s, hy - 6 * s]], furTop, 0);
      for (let i = 0; i < 9; i++) { const x = hx - 66 * s + i * 16 * s; p.stroke([[x, hy - 58 * s], [x + 4 * s, hy + 4 * s]], 3.4 * s, furDk); }
      p.ell(hx - 52 * s, hy - 34 * s, 20 * s, 30 * s, furDk, 0); // ear under hair
    });
    p.inkRing(hp, ow * 0.8, thick);
    // eyes peek under the curtain
    eye(hx + 18 * s, hy + 12 * s, s); eye(hx + 52 * s, hy + 10 * s, 0.92 * s);
    // muzzle + nose + beard
    p.ell(hx + 62 * s, hy + 34 * s, 34 * s, 24 * s, furTop, ow * 0.5);
    p.dot(hx + 88 * s, hy + 26 * s, 11 * s, '#191922');
    fringe(hx + 34 * s, hx + 84 * s, hy + 48 * s, hy + (rest ? 62 : 84) * s, 6, furDk);
    if (o.collar) { p.band([[hx - 34 * s, hy + 52 * s], [hx + 26 * s, hy + 68 * s]], '#c9973f', 11 * s, 2, 'round'); p.dot(hx + 2 * s, hy + 74 * s, 8 * s, '#e8c45a'); p.dot(hx + 2 * s, hy + 74 * s, 3.4 * s, '#fff3cf'); }
  };

  if (pose === 'lie') {
    // body flat on the grave, fringe spread on the ground
    const bp = ellPts(290, 838, 218, 76, 0, 360, 0, 48);
    p.shadedFill(bp, fur, furSh, light, 190, 0.38); p.inkRing(bp, ow, thick);
    p.clip(bp, () => { p.ell(180, 792, 120, 40, furTop, 0); });
    p.inkRing(bp, ow, thick);
    fringe(110, 470, 884, 952, 22, furDk);
    // front paws stretched forward, head resting just behind them
    p.stroke([[452, 906], [566, 944]], 17, fur); p.ell(578, 947, 17, 7.5, furTop, 2.2);
    p.stroke([[428, 922], [528, 956]], 16, furDk); p.ell(540, 958, 16, 7, fur, 2.2);
    headSide(492, 806, 0.98, true);
    // tail curled at the back
    p.stroke(curve([86, 838], [40, 872], [58, 922]), 15, fur); p.dot(60, 926, 8.5, furDk);
    return;
  }
  if (pose === 'front') {
    // sitting front: chest fringe, curtain of hair, two paws
    const bp = ellPts(300, 742, 128, 196, 0, 360, 0, 48);
    p.shadedFill(bp, fur, furSh, light, 110, 0.38); p.inkRing(bp, ow, thick);
    p.clip(bp, () => { p.ell(300, 660, 74, 120, furTop, 0); });
    p.inkRing(bp, ow, thick);
    fringe(196, 404, 830, 950, 15, furDk);
    p.ell(222, 956, 30, 11, furTop, 2.4); p.ell(378, 956, 30, 11, furTop, 2.4);
    if (o.collar) { p.band([[238, 596], [362, 596]], '#c9973f', 12, 2, 'round'); p.dot(300, 616, 10, '#e8c45a'); p.dot(300, 616, 4, '#fff3cf'); }
    // head
    const hx = 300, hy = 452;
    const hp = ellPts(hx, hy, 106, 90, 0, 360, 0, 48);
    p.shadedFill(hp, fur, furSh, light, 92, 0.35); p.inkRing(hp, ow, thick);
    p.clip(hp, () => {
      p.poly([[hx - 104, hy - 84], [hx + 104, hy - 84], [hx + 100, hy - 6], [hx + 40, hy - 20], [hx - 30, hy - 12], [hx - 100, hy - 16]], furTop, 0);
      for (let i = 0; i < 11; i++) { const x = hx - 88 + i * 17.5; p.stroke([[x, hy - 80], [x + 3, hy - 10]], 3.6, furDk); }
      p.ell(hx - 92, hy - 20, 17, 40, furDk, 0); p.ell(hx + 92, hy - 20, 17, 40, furDk, 0);
    });
    p.inkRing(hp, ow, thick);
    eye(hx - 36, hy + 16); eye(hx + 36, hy + 16);
    p.ell(hx, hy + 48, 21, 15, '#191922', 2.5); // nose
    fringe(hx - 44, hx + 44, hy + 58, hy + 118, 8, furDk); // beard
    return;
  }
  // side, standing/walking: long low body, skirt of coat nearly to the ground
  const step = o.step || 0, sw = Math.sin(step * Math.PI * 2) * 13;
  p.stroke([[168, 856], [160 + sw, ground - 4]], 16, furDk); p.stroke([[392, 856], [398 - sw, ground - 4]], 16, furDk);
  const bp = ellPts(292, 742, 198, 102, 0, 360, 0, 48);
  p.shadedFill(bp, fur, furSh, light, 175, 0.38); p.inkRing(bp, ow, thick);
  p.clip(bp, () => { p.ell(210, 692, 128, 52, furTop, 0); p.ell(392, 770, 66, 44, furDk, 0); });
  p.inkRing(bp, ow, thick);
  fringe(118, 462, 806, 946, 24, furDk);
  p.stroke([[150, 862], [146 - sw, ground - 4]], 17, fur); p.ell(154 - sw, ground - 2, 16, 7, furTop, 2.2);
  p.stroke([[418, 862], [424 + sw, ground - 4]], 17, fur); p.ell(432 + sw, ground - 2, 16, 7, furTop, 2.2);
  // tail: low, slight wag
  const wag = Math.sin((o.wagPh || 0) * 6.28) * 8;
  p.stroke(curve([104, 700], [58, 668], [50 + wag, 606]), 16, fur); p.dot(50 + wag, 602, 9.5, furDk);
  headSide(478, 656, 1.02);
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
