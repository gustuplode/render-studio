// Side-profile horse + milk cart cards, drawn in the same Pen/toon language as
// toon.js (600x1000 design space, ground at y=975). Used by story.js actors.
import { mul } from './toon.js';

export const horseCard = (p, o = {}) => {
  const { col = '#8a5a30', spots = false, num = '', saddle = '#c23b2e', step = 0, gallop = false, blink = 0 } = o;
  const dk = mul(col, [0.72, 0.7, 0.75]), lt = mul(col, [1.18, 1.15, 1.1]);
  const cx = 300, by = 545, ground = 975;
  const ph = step * Math.PI * 2;
  const bobY = gallop ? Math.abs(Math.sin(ph)) * 10 : Math.sin(ph) * 2;
  // tail
  p.stroke([[cx - 168, by - 60 + bobY], [cx - 205, by + 40], [cx - 195 + Math.sin(ph * 0.5) * 8, by + 150]], 17, dk);
  // far legs (darker)
  const leg = (hx, off, c, w) => {
    const sw = gallop ? Math.sin(ph + off) * 58 : Math.sin(ph + off) * 10;
    const lift = gallop ? Math.max(0, Math.sin(ph + off)) * 52 : Math.max(0, Math.sin(ph + off)) * 6;
    const knee = [hx + sw * 0.3 - (gallop ? 16 : 0), (by + 84 + ground) / 2 + 44];
    const foot = [hx + sw, ground - lift];
    p.stroke([[hx, by + 74 + bobY], knee, foot], w, c);
    p.ell(foot[0] + 9, foot[1], 16, 7.5, '#2c2018', 1.5);
  };
  leg(cx - 128, 2.6, dk, 25); leg(cx + 136, 0.6, dk, 25);
  // body: long barrel + chest + rump (no more flying-saucer ellipse)
  p.ell(cx - 148, by + 2 + bobY, 68, 66, col, 0);
  p.ell(cx + 148, by + 4 + bobY, 64, 62, col, 0);
  p.ell(cx, by + bobY, 198, 78, col, 5);
  p.clip([[cx - 198, by + bobY], [cx + 198, by + bobY], [cx + 198, by + 80 + bobY], [cx - 198, by + 80 + bobY]], () => { p.ell(cx, by + 58 + bobY, 210, 74, dk, 0); });
  p.ell(cx, by + bobY, 198, 78, 'rgba(0,0,0,0)', 5);
  p.ell(cx - 34, by - 26 + bobY, 128, 42, lt, 0);
  if (spots) { p.ell(cx - 70, by - 10 + bobY, 30, 20, '#e8e2d2', 0); p.ell(cx + 40, by + 26 + bobY, 24, 16, '#e8e2d2', 0); p.ell(cx + 105, by - 22 + bobY, 18, 13, '#e8e2d2', 0); p.ell(cx - 130, by + 30 + bobY, 16, 12, '#e8e2d2', 0); }
  // near legs
  leg(cx - 100, 0, col, 27); leg(cx + 110, 3.4, col, 27);
  // neck + head
  p.poly([[cx + 118, by - 62 + bobY], [cx + 196, by - 176 + bobY], [cx + 246, by - 140 + bobY], [cx + 176, by + 6 + bobY]], col, 4.5);
  p.poly([[cx + 188, by - 196 + bobY], [cx + 268, by - 158 + bobY], [cx + 292, by - 106 + bobY], [cx + 252, by - 84 + bobY], [cx + 208, by - 128 + bobY]], col, 4.5);
  p.poly([[cx + 196, by - 200 + bobY], [cx + 210, by - 238 + bobY], [cx + 228, by - 196 + bobY]], dk, 3); // ear
  p.poly([[cx + 130, by - 74 + bobY], [cx + 198, by - 182 + bobY], [cx + 214, by - 168 + bobY], [cx + 152, by - 58 + bobY]], dk, 0); // mane
  if (blink) p.stroke([[cx + 224, by - 148 + bobY], [cx + 238, by - 148 + bobY]], 3.4, '#241a12');
  else { p.dot(cx + 231, by - 148 + bobY, 5.4, '#241a12'); p.dot(cx + 233, by - 150 + bobY, 1.8, '#fff'); }
  p.dot(cx + 272, by - 100 + bobY, 4, dk); // nostril
  p.stroke([[cx + 262, by - 82 + bobY], [cx + 282, by - 86 + bobY]], 3, dk); // mouth
  // saddle + number cloth
  if (num !== '') {
    p.poly([[cx - 52, by - 84 + bobY], [cx + 38, by - 84 + bobY], [cx + 30, by + 6 + bobY], [cx - 44, by + 6 + bobY]], saddle, 3.5);
    const g = p.g; g.save(); g.fillStyle = '#ffffff'; g.font = "900 52px 'Arial Black', Arial"; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(num, cx - 7, by - 38 + bobY); g.restore();
    p.stroke([[cx - 20, by - 84 + bobY], [cx - 16, by - 116 + bobY]], 7, dk); // saddle top
  }
};

export const cartCard = (p, o = {}) => {
  // milk cart, side view, horse hitches on the right
  p.stroke([[452, 620], [560, 660]], 11, '#6e4522');
  p.stroke([[452, 700], [560, 690]], 11, '#6e4522');
  const bx = 92, by = 470, bw = 360, bh = 250;
  p.poly([[bx, by], [bx + bw, by], [bx + bw - 14, by + bh], [bx + 14, by + bh]], '#2b6cb0', 5);
  p.poly([[bx, by], [bx + bw, by], [bx + bw - 4, by + 44], [bx + 4, by + 44]], '#c23b2e', 3);
  const g = p.g; g.save(); g.fillStyle = '#ffffff'; g.font = "900 64px 'Arial Black', Arial"; g.textAlign = 'center';
  g.fillText('MILK RUN', bx + bw / 2, by + 128); g.fillStyle = '#ffd23e'; g.font = "900 54px 'Arial Black', Arial"; g.fillText('DAIRY', bx + bw / 2, by + 192); g.restore();
  for (const wx of [bx + 70, bx + bw - 70]) {
    p.ell(wx, 800, 66, 66, '#c23b2e', 4.5); p.ell(wx, 800, 24, 24, '#f2ecd8', 3);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4 + 0.4; p.stroke([[wx, 800], [wx + Math.cos(a) * 58, 800 + Math.sin(a) * 58]], 6, '#8a2a20'); }
  }
  // milk bottles on top
  for (const [mx, my] of [[150, 408], [205, 398], [262, 408]]) { p.poly([[mx - 15, my + 62], [mx + 15, my + 62], [mx + 11, my + 18], [mx + 5, my], [mx - 5, my], [mx - 11, my + 18]], '#eef2e8', 2.5); p.poly([[mx - 6, my - 2], [mx + 6, my - 2], [mx + 6, my + 8], [mx - 6, my + 8]], '#c23b2e', 1.5); }
};
