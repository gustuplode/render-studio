// Project extras for Tama: framed board card + Nitama (the successor cat).
import { mul, thickAngle, ellPts, felicetteCard } from './toon.js';

const rad = (d) => d * Math.PI / 180;
// rounded-rect point list for board panels
const rr = (x0, y0, x1, y1, r) => {
  const pts = [];
  const seg = (cx, cy, a0) => { for (let k = 0; k <= 5; k++) { const a = rad(a0 + k * 18); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  seg(x1 - r, y0 + r, -90); seg(x1 - r, y1 - r, 0); seg(x0 + r, y1 - r, 90); seg(x0 + r, y0 + r, 180);
  return pts;
};

/** Framed wooden board with centred text lines. opts: lines[], big (index of gold line), wood, ink */
export const boardCard = (p, o = {}) => {
  const lines = o.lines || [], g = p.g;
  const x0 = 52, x1 = 548, y0 = 618, y1 = 952;
  for (const sd of [-1, 1]) p.poly(rr(300 + sd * 168 - 13, y1 - 8, 300 + sd * 168 + 13, 992, 5), '#5d4230', 4);
  const bp = rr(x0, y0, x1, y1, 14);
  p.shadedFill(bp, o.wood || '#8a6844', mul(o.wood || '#8a6844', [0.62, 0.6, 0.66]), rad(-120), 260, 0.35);
  p.inkRing(bp, 7, thickAngle(rad(-120)));
  p.clip(bp, () => {
    for (let i = 1; i < 4; i++) p.stroke([[x0 + 6, y0 + i * 82], [x1 - 6, y0 + i * 82 + 3]], 3.5, '#6d5136');
  });
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const n = lines.length, cy = (y0 + y1) / 2;
  lines.forEach((ln, i) => {
    let fs = (o.big === i) ? 104 : 54;
    g.font = `900 ${fs}px Arial Black, Arial`;
    while (g.measureText(ln).width > 452 && fs > 18) { fs -= 4; g.font = `900 ${fs}px Arial Black, Arial`; }
    const y = cy + (i - (n - 1) / 2) * (n > 1 ? 92 : 0);
    g.lineWidth = fs / 6; g.strokeStyle = '#241726'; g.strokeText(ln, 300, y);
    g.fillStyle = o.big === i ? '#ffd76a' : '#fdf6e3'; g.fillText(ln, 300, y);
  });
  g.restore();
};

/** Nitama — the successor: grey-tabby patches instead of calico, same cap. */
export const nitamaCard = (p, o = {}) => {
  felicetteCard(p, { view: 'front', expr: o.expr || 'smile', blink: o.blink || 0, earsUp: 1,
    wag: o.wag ?? 0.5, wagPh: o.wagPh || 0, fur: '#efe9dc', mark: '#d9d2c0' });
  const thick = thickAngle(rad(-120));
  const hp = ellPts(300, 466, 104, 93, 0, 360, 0, 48);
  p.clip(hp, () => { p.ell(228, 420, 50, 44, '#7d838c', 0); p.ell(378, 430, 36, 32, '#565b63', 0); });
  p.inkRing(hp, 6, thick);
  const bp = ellPts(300, 720, 114, 172, 0, 360, 0, 48);
  p.clip(bp, () => { p.ell(214, 706, 40, 70, '#7d838c', 0); p.ell(394, 796, 34, 48, '#565b63', 0); });
  p.inkRing(bp, 6, thick);
  p.dot(300, 700, 17, '#e8c45a'); p.dot(300, 700, 10.5, '#c9973f'); p.dot(300, 700, 4.5, '#fff3cf');
  if (o.cap === 0) return;
  p.ell(300, 380, 80, 33, '#26355e', 4.5);
  p.poly([[224, 380], [376, 380], [380, 408], [220, 408]], '#26355e', 4.5);
  p.band([[224, 402], [378, 402]], '#141f38', 7, 0, 'round');
  p.ell(300, 412, 110, 15, '#1d2a47', 3.5);
  p.dot(300, 392, 9, '#e8c45a'); p.dot(300, 392, 4, '#fff3cf');
};
