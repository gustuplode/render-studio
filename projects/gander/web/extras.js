// Project extras for Gander: the Newfoundland card — big, broad, all-black
// shaggy water dog; side poses: stand / charge / carry (grenade in mouth) / lie.
import { mul, thickAngle, ellPts, curve } from './toon.js';

const rad = (d) => d * Math.PI / 180;

/** Gander — opts: pose 'side'|'charge'|'lie', step, blink, grenade 0/1, wagPh, pant */
export const ganderCard = (p, o = {}) => {
  const pose = o.pose || 'side';
  const light = rad(-120), thick = thickAngle(light), ow = 6;
  const fur = '#2b2930', furTop = '#45434c', furDk = mul(fur, [0.62, 0.62, 0.7]), furSh = mul(fur, [0.8, 0.8, 0.88]);
  const ground = 975;
  const fringe = (x0, x1, yTop, yBot, n, col) => { for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (i / (n - 1)) + Math.sin(i * 6.7) * 4; p.stroke([[x, yTop], [x + Math.sin(i * 2.9) * 5, yBot]], 6, col); } };
  const eye = (x, y, s = 1) => {
    if (o.blink) { p.arc(x, y, 10 * s, 6 * s, 200, 340, 4.2 * s, '#0e0e12'); return; }
    p.dot(x, y, 8.4 * s, '#0e0e12'); p.dot(x + 2.6 * s, y - 3 * s, 2.9 * s, '#e8e2d2');
  };
  const head = (hx, hy, s = 1) => {
    const hp = ellPts(hx, hy, 88 * s, 74 * s, 0, 360, 0, 44);
    p.shadedFill(hp, fur, furSh, light, 78 * s, 0.35); p.inkRing(hp, ow * 0.85, thick);
    // broad muzzle
    p.ell(hx + 62 * s, hy + 30 * s, 46 * s, 32 * s, furTop, ow * 0.55);
    p.ell(hx + 96 * s, hy + 16 * s, 15 * s, 11 * s, '#121216', 2); // nose
    // droop ear, big and floppy
    p.ell(hx - 40 * s, hy + 6 * s, 26 * s, 52 * s, furDk, ow * 0.6, 0, 360, 0.16);
    // brow + gentle eye
    p.stroke([[hx + 6 * s, hy - 30 * s], [hx + 40 * s, hy - 34 * s]], 5.5 * s, furDk);
    eye(hx + 24 * s, hy - 8 * s, s);
    if (o.pant) p.ell(hx + 74 * s, hy + 56 * s, 11 * s, 18 * s, '#c25a68', 2);
    if (o.grenade) { // the grenade, held gently crosswise in the teeth
      p.stroke([[hx + 78 * s, hy + 44 * s], [hx + 96 * s, hy + 50 * s]], 7 * s, '#e8e2d2'); // jaw line to it
      p.ell(hx + 116 * s, hy + 58 * s, 17 * s, 22 * s, '#4a5a3a', 3.4 * s);
      p.stroke([[hx + 104 * s, hy + 44 * s], [hx + 128 * s, hy + 72 * s]], 2.6 * s, '#39462c');
      p.stroke([[hx + 116 * s, hy + 36 * s], [hx + 116 * s, hy + 48 * s]], 6 * s, '#6a6f5a');
      p.ell(hx + 116 * s, hy + 30 * s, 5 * s, 7 * s, '#8b8f7a', 2 * s); // spoon + ring hint
    }
  };

  if (pose === 'lie') {
    const bp = ellPts(292, 830, 224, 84, 0, 360, 0, 48);
    p.shadedFill(bp, fur, furSh, light, 196, 0.38); p.inkRing(bp, ow, thick);
    p.clip(bp, () => { p.ell(190, 780, 130, 44, furTop, 0); });
    p.inkRing(bp, ow, thick);
    fringe(104, 478, 884, 950, 24, furDk);
    p.stroke([[458, 902], [572, 940]], 19, fur); p.ell(584, 944, 18, 8, furTop, 2.2);
    p.stroke([[430, 922], [536, 954]], 18, furDk); p.ell(548, 957, 17, 7.5, fur, 2.2);
    head(498, 792, 1.02);
    p.stroke(curve([84, 830], [36, 866], [56, 920]), 17, fur); p.dot(58, 924, 9.5, furDk);
    return;
  }
  const charge = pose === 'charge';
  const step = o.step || 0, ph = step * Math.PI * 2;
  const swF = charge ? Math.sin(ph) * 34 : Math.sin(ph) * 14, swB = charge ? Math.sin(ph + Math.PI) * 34 : Math.sin(ph + Math.PI) * 14;
  const bobY = charge ? Math.abs(Math.sin(ph)) * -16 : 0;
  // far legs
  p.stroke([[176, 812 + bobY], [162 + swB, ground - 4]], 20, furDk);
  p.stroke([[404, 812 + bobY], [416 + swF, ground - 4]], 20, furDk);
  // big bushy tail, carried high
  const wag = Math.sin((o.wagPh || 0) * 6.28) * 9;
  p.stroke(curve([112, 690 + bobY], [58, 612 + bobY], [66 + wag, 528 + bobY]), 21, fur); p.dot(66 + wag, 524 + bobY, 12, furDk);
  // massive body
  const bp = ellPts(296, 730 + bobY, 208, 112, 0, 360, 0, 48);
  p.shadedFill(bp, fur, furSh, light, 186, 0.38); p.inkRing(bp, ow, thick);
  p.clip(bp, () => { p.ell(216, 678 + bobY, 132, 56, furTop, 0); p.ell(404, 764 + bobY, 70, 46, furDk, 0); });
  p.inkRing(bp, ow, thick);
  fringe(116, 470, 796 + bobY, 916, 24, furDk);
  // near legs
  p.stroke([[150, 818 + bobY], [142 + swF, ground - 4]], 21, fur); p.ell(152 + swF, ground - 2, 18, 8, furTop, 2.2);
  p.stroke([[428, 818 + bobY], [438 + swB, ground - 4]], 21, fur); p.ell(448 + swB, ground - 2, 18, 8, furTop, 2.2);
  head(486, 640 + bobY, 1.06);
  // sergeant's collar: dark red band (his regimental mascot collar)
  p.band([[428, 706 + bobY], [492, 726 + bobY]], '#7a2430', 10, 2, 'round');
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
