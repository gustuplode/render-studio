FACE.wonder = { eye: ["shock", "shock"], brow: [-6, -6], mouth: "o" };
FACE.snore = { eye: ["dash", "dash"], brow: [0, -1], mouth: "o" };
FACE.stubborn = { eye: ["lid", "lid"], brow: [4, -3], mouth: "frown" };
FACE.squint = { eye: ["slit", "slit"], brow: [3, -2], mouth: "dash" };

// ---------------- Roman-era cast (our own designs), built on the Pen / blob / face helpers above ----------------
const STEEL = "#aeb6bf", BRASS = "#d9a845", LEATHER = "#7a4a2a";
export const OUTFITS = {
  legion: { tunic: "#b8322f", cape: "#8f2228", skin: SKIN, helmet: true, armor: true, spear: true, shield: true },
  old: { tunic: "#9c4a3c", cape: "#6e3330", skin: "#f3d6bb", helmet: "old", armor: true, spear: true, shield: false, beard: "#f4f1ea", brows: "#f4f1ea" },
  toga: { tunic: "#f1ead8", skin: "#f5c9a0", toga: "#6b3c8f", hair: "#3b2a20", stout: true },
  civA: { tunic: "#4f7fb8", skin: "#f5c9a0", hair: "#5a3b2a" },
  civB: { tunic: "#d9a441", skin: SKIN, hair: "#2b211c", dress: "#c25a7a" },
  civC: { tunic: "#5d8a3a", skin: "#c99067", hair: "#1e1714", stout: true },
  workA: { tunic: "#8a5d3b", skin: "#f5c9a0", cap: "#c2733a", apron: "#d8c9a6" },
  workB: { tunic: "#3f6a6f", skin: "#ecd0b6", cap: "#5b4a8a", moustache: "#4a3020" },
  // --- burr story cast (1941) ---
  engineer41: { tunic: "#74522f", skin: "#f5c9a0", cap: "#4f3a26", moustache: "#3a2a1c", shirt: "#f1e6cf" },
  friendA: { tunic: "#7a8a4a", skin: "#ecd0b6", cap: "#8a5a34", apron: "#e3d7b8" },
  friendB: { tunic: "#54687e", skin: "#c99067", hair: "#241a14", stout: true },
  astro: { tunic: "#e9edf2", skin: "#f5c9a0", bubble: true, pack: "#d8453a", hair: "#3b2a20" },
  // --- corporal-bear cast (1942-44) ---
  soldier44a: { tunic: "#6f6b4c", skin: "#f5c9a0", helmet: "ww2", hair: "#3b2a20" },
  soldier44b: { tunic: "#66644a", skin: "#c99067", helmet: "ww2", hair: "#1e1714", moustache: "#241a14" },
  soldier44c: { tunic: "#75714f", skin: "#ecd0b6", helmet: "ww2", hair: "#5a3b2a" },
  officer44: { tunic: "#5d5a40", skin: "#f5c9a0", cap: "#4c4a38", moustache: "#3a2a1c" },
  // --- sea king (coded-FX demo): royal red robe, gold trim, white fur collar, drawn crown ---
  king: { tunic: "#a51f24", cape: "#5e1220", skin: "#f5c9a0", beard: "#4a2c18", beardShort: true, crown: true, collar: "#f6efdd", trim: "#e8b64c" },
  sailorA: { tunic: "#57707e", skin: "#f5c9a0", cap: "#7a4a2a" },
  sailorB: { tunic: "#7d6242", skin: "#c99067", hair: "#241a14" },
  // --- 1000 tanks (comparison line): the two commanders, flag patch on the chest ---
  cmdUS: { tunic: "#4c5a3a", skin: "#f5c9a0", cap: "#43512f", moustache: "#3a2a1c", patchUS: true },
  cmdCN: { tunic: "#3e5c33", skin: "#f0c297", cap: "#33512b", patchCN: true },
};

/** galea: iron bowl, brass brow band, cheek guards, transverse red crest */
const galea = (p, H, cx, hc, light, thick, ow, old, u) => {
  const crest = old ? "#8d4b3f" : "#d2372f", bowl = old ? "#8f8a7e" : STEEL;
  // crest (behind the bowl top)
  const cy0 = hc - H.b * 0.98;
  const cr = ellPts(cx, cy0, 0.66 * 2 * H.a, 0.42 * 2 * H.b, 180, 360, 0, 40);
  cr.push([cx + 0.66 * 2 * H.a * 0.98, cy0 + 4 * u], [cx - 0.66 * 2 * H.a * 0.98, cy0 + 4 * u]);
  const crP = [...ellPts(cx, cy0 + 2 * u, 0.62 * 2 * H.a, 0.36 * 2 * H.b, 180, 360, 0, 40)];
  p.shadedFill(crP, crest, mul(crest, [0.7, 0.62, 0.7]), light, 0.62 * 2 * H.a, 0.3);
  p.clip(crP, () => { for (let i = -9; i <= 9; i++) p.stroke([[cx + i * 7.4 * u, cy0], [cx + i * 9.4 * u, cy0 - 0.62 * H.b * Math.cos(i / 11)]], 1.4 * u, mul(crest, [0.62, 0.55, 0.62])); });
  if (old) p.clip(crP, () => { for (let i = 0; i < 6; i++) p.ell(cx + (i - 3) * 22 * u, cy0 - 18 * u - (i % 2) * 10 * u, 9 * u, 5 * u, "#6f6a5e", 0); });
  p.inkRing(crP, ow * 0.85, thick);
  p.poly(rrect(cx - 10 * u, cy0 - 6 * u, cx + 10 * u, cy0 + 6 * u, 3 * u), BRASS, 2 * u);
  // bowl: upper head cap
  const bandY = hc - H.b * 0.42;
  const bp = ellPts(cx, bandY, H.a * 1.05, H.b * 0.66, 180, 360, 0, 48);
  p.shadedFill(bp, bowl, mul(bowl, [0.62, 0.64, 0.72]), light, H.a, 0.4);
  p.clip(bp, () => {
    p.stroke(ellPts(cx - 20 * u, bandY - 0.3 * H.b, 0.25 * H.a, 0.18 * H.b, 200, 300, 0, 16), 4 * u, "#ffffff55");
    if (old) for (let i = 0; i < 9; i++) p.ell(cx + Math.sin(i * 2.3) * 0.8 * H.a, bandY - (0.08 + 0.5 * ((i * 0.37) % 1)) * H.b, (3 + (i % 3) * 2) * u, (2 + (i % 2)) * u, "#8a4b22", 0);
  });
  p.inkRing(bp, ow * 0.9, thick);
  p.band([[cx - H.a * 1.04, bandY], [cx + H.a * 1.04, bandY]], old ? "#a88a4a" : BRASS, 7 * u, 1.8 * u, "round");
  for (const s of [-1, 1]) p.dot(cx + s * 0.55 * H.a, bandY, 2.2 * u, "#fff3c4");
};
const cheeks = (p, H, cx, hc, light, ow, old, u) => {
  const bowl = old ? "#8f8a7e" : STEEL;
  for (const s of [-1, 1]) {
    const x0 = cx + s * 0.78 * H.a, x1 = cx + s * 1.07 * H.a, y0 = hc - H.b * 0.42, y1 = hc + H.b * 0.48;
    const pts = [[x0, y0], [x1, y0], [x1 - s * 0.04 * H.a, y1 - 0.1 * H.b], [x0 + s * 0.06 * H.a, y1], [x0 - s * 0.05 * H.a, (y0 + y1) / 2]];
    p.shadedFill(pts, bowl, mul(bowl, [0.62, 0.64, 0.72]), light, 0.2 * H.a, 0.3);
    p.poly(pts, null, ow * 0.8);
    p.dot((x0 + x1) / 2, (y0 + y1) / 2 - 0.05 * H.b, 2.2 * u, BRASS);
  }
};
const cobweb = (p, cx, cy, r, u) => {
  const g = p.g; g.save(); g.globalAlpha = 0.8;
  for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.05 + 0.9 * i / 6); p.stroke([[cx, cy], [cx + Math.cos(a) * r, cy + Math.sin(a) * r]], 1.1 * u, "#f2f2f2"); }
  for (let k = 1; k <= 4; k++) { const rr = r * k / 4.3, pts = []; for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.05 + 0.9 * i / 6); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } p.stroke(pts, 1 * u, "#f2f2f2"); }
  g.restore();
};

/** front-facing Roman-era character. opts: expr, blink, look, facing, seed, L/R arm poses, tilt, headTilt, bob, nohelmet, light */
export const romanFront = (p, key, opts = {}) => {
  const O = typeof key === "string" ? OUTFITS[key] : key;
  const { expr = "neutral", blink = 0, look = 0, facing = 0, seed = 3, L = "hang", R = O.spear ? "spear" : "hang", tilt = 0, headTilt = 0,
    bob = 0, nohelmet = false, light = rad(-120), web = false, step = 0 } = opts;
  const lid = lidOf(blink), skin = O.skin ?? SKIN;
  const H = headBlob(seed, 118, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const torsoL = O.stout ? 1.12 : 1.08, legsL = 1.38, sole = 975;
  const torsoBot = sole - legsL * HH - bob * HH, chin = torsoBot - torsoL * HH, hc = chin - H.b, hipY = torsoBot - 0.12 * HH;
  const thick = thickAngle(light), ow = 5 * u, cx = 300;
  const legCol = mix(O.tunic, INK, 0.62), armCol = mix(O.tunic, INK, 0.5);
  const helmet = !!O.helmet && !nohelmet, old = O.helmet === "old";
  p.rot = null;
  // ---- cape behind everything ----
  if (O.cape) {
    const cp = [[cx - 0.48 * W, chin + 0.08 * HH], [cx + 0.48 * W, chin + 0.08 * HH], [cx + 0.62 * W, sole - 0.55 * HH], [cx + 0.2 * W, sole - 0.45 * HH], [cx - 0.2 * W, sole - 0.5 * HH], [cx - 0.62 * W, sole - 0.55 * HH]];
    p.gradFill(cp, O.cape, mul(O.cape, [0.6, 0.6, 0.7]), light); p.inkRing(cp, ow * 0.8, thick);
  }
  // ---- legs ----
  const dress = !!O.dress;
  for (const side of [-1, 1]) {
    const up = Math.max(0, Math.sin(Math.PI * 2 * (step + (side > 0 ? 0.5 : 0)))) * 30 * (step ? 1 : 0);
    const hx = cx + side * 16 * u, fx = cx + side * 22 * u, fy = sole - 4 * u - up;
    p.stroke(curve([hx, hipY], [(hx + fx) / 2 + side * 2 * u, (hipY + fy) / 2], [fx, fy]), 5.8 * u, legCol);
    const sandal = O.helmet ? LEATHER : "#5a3b2a";
    p.stroke([[fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u]], 7.5 * u + 3, INK);
    p.stroke([[fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u]], 7.5 * u, sandal);
    if (O.helmet) for (let k = 1; k <= 3; k++) p.stroke([[fx - 4 * u, fy - k * 0.07 * HH], [fx + 4 * u, fy - k * 0.07 * HH - 2 * u]], 2 * u, LEATHER);
  }
  // burrs stuck to the trouser legs (opts.burrs = count, deterministic spots)
  if (opts.burrs) {
    const spots = [[-1, .18], [1, .3], [-1, .48], [1, .58], [-1, .72], [1, .82], [-1, .9], [1, .12], [-1, .34], [1, .68]];
    for (let i = 0; i < Math.min(opts.burrs, spots.length); i++) {
      const [sd, fr] = spots[i], bx = cx + sd * (19 + (i % 3) * 3) * u, by = hipY + fr * (sole - hipY) * 0.92;
      p.ell(bx, by, 7.5 * u, 6.5 * u, "#6e4f27", 1.6 * u);
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 + i; p.stroke([[bx, by], [bx + Math.cos(a) * 10 * u, by + Math.sin(a) * 9 * u]], 1.3 * u, "#54391c"); }
    }
  }
  // ---- upper body ----
  p.rot = tilt ? [rad(tilt), cx, hipY] : null;
  const T = { a: (0.4 * W) / 1.06 * (O.stout ? 1.12 : 1), b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: O.stout ? 0.17 : 0.12, asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = cx + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const S = (side) => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  const arm = (side, pose) => {
    const s = S(side), X = (k) => tcx + side * (T.a * 1.1 + k * u);
    switch (pose) {
      case "spear": return { pts: [s, [X(6), s[1] + 0.42 * HH], [X(10), s[1] + 0.2 * HH]], front: false };
      case "point": return { pts: [s, [X(28), s[1] - 0.02 * HH], [X(62), s[1] - 0.1 * HH]], front: false, finger: true };
      case "up": return { pts: [s, [X(14), s[1] - 0.3 * HH], [X(22), s[1] - 0.75 * HH]], front: false };
      case "wave": return { pts: [s, [X(16), s[1] - 0.2 * HH], [X(30 + 10 * Math.sin(opts.wv || 0)), s[1] - 0.62 * HH]], front: false };
      case "hip": return { pts: [s, [X(22), s[1] + 0.3 * HH], [tcx + side * T.a * 0.95, torsoBot - 0.3 * HH]], front: false };
      case "belly": return { pts: [s, [X(8), s[1] + 0.45 * HH], [tcx + side * 0.25 * T.a, torsoBot - 0.35 * HH]], front: true };
      case "temple": return { pts: [s, [X(26), s[1] + 0.05 * HH], [cx + side * (H.a + 16 * u), hc - 0.1 * HH]], front: false, swirl: true };
      case "lift": return { pts: [s, [X(20), s[1] - 0.25 * HH], [X(4), s[1] - 0.82 * HH]], front: false };
      case "shield": return { pts: [s, [X(4), s[1] + 0.4 * HH], [tcx + side * 0.6 * T.a, torsoBot - 0.1 * HH]], front: true };
      case "cross": return { pts: [s, [X(2), s[1] + 0.38 * HH], [tcx - side * 0.45 * T.a, s[1] + 0.32 * HH]], front: true };
      case "reach": { const lf = (opts.lift || 0) * 0.62 * HH; return { pts: [s, [X(42), s[1] - 0.12 * HH - lf * 0.6], [X(82), s[1] - 0.5 * HH - lf]], front: false }; }
      case "cheek": return { pts: [s, [X(16), s[1] + 0.05 * HH], [cx + side * (H.a + 2 * u), hc + 0.25 * H.b]], front: false };
      case "thumb": return { pts: [s, [X(20), s[1] + 0.12 * HH], [X(44), s[1] - 0.12 * HH]], front: false, thumb: true };
      default: return { pts: [s, [X(4), s[1] + 0.48 * HH], [X(3), chin + 1.04 * HH]], front: false };
    }
  };
  const arms = [arm(-1, L), arm(1, R)];
  const drawArm = (a) => {
    p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.2 * u, armCol);
    const [hx, hy] = a.pts[2];
    p.dot(hx, hy, 5.5 * u);
    if (a.finger) { const dx = a.pts[2][0] - a.pts[1][0], dy = a.pts[2][1] - a.pts[1][1], l = Math.hypot(dx, dy); p.stroke([[hx, hy], [hx + dx / l * 14 * u, hy + dy / l * 14 * u]], 2.6 * u); }
    if (a.thumb) p.stroke([[hx, hy], [hx + Math.sign(hx - cx) * 6 * u, hy - 12 * u]], 2.6 * u);
  };
  // spear behind
  if (O.spear && R === "spear") {
    const [hx, hy] = arms[1].pts[2], s0 = [hx + 2 * u, sole - 2 * u], s1 = [hx - 3 * u, 70];
    p.band([s0, s1], old ? "#6d5236" : "#8a5a34", 4.2 * u, 1.4 * u, "round");
    const tip = [[s1[0] - 7 * u, s1[1] + 6 * u], [s1[0], s1[1] - 34 * u], [s1[0] + 7 * u, s1[1] + 6 * u], [s1[0], s1[1] + 14 * u]];
    p.poly(tip, old ? "#8b7c6a" : "#c9cfd6", 2 * u);
    if (web) cobweb(p, s1[0] - 2 * u, s1[1] + 60 * u, 70 * u, u);
  }
  for (const a of arms) if (!a.front) drawArm(a);
  // torso
  if (dress) {
    const D = { a: 0.5 * W * 0.98, b: 0.5 * ((sole - 0.35 * HH) - (chin - 0.2 * HH)), nTop: 2.0, nBot: 3.0, egg: 0.35, asym: 0, rot: 0, noise: 0.006, seed: seed + 9 };
    const dp = blobPts(cx, sole - 0.35 * HH - D.b, D);
    p.gradFill(dp, O.dress, mul(O.dress, SH_CLOTH), light); p.inkRing(dp, ow, thick);
  }
  // skirt / pteruges below the torso
  if (!dress) {
    const sk = [[tcx - 0.92 * T.a, torsoBot - 0.2 * HH], [tcx + 0.92 * T.a, torsoBot - 0.2 * HH], [tcx + 1.0 * T.a, torsoBot + 0.3 * HH], [tcx - 1.0 * T.a, torsoBot + 0.3 * HH]];
    p.gradFill(sk, O.tunic, mul(O.tunic, SH_CLOTH), light); p.poly(sk, null, ow * 0.8);
    if (O.armor) for (let i = -3; i <= 3; i++) { const x = tcx + i * 0.27 * T.a, st = [[x - 9 * u, torsoBot - 0.05 * HH], [x + 9 * u, torsoBot - 0.05 * HH], [x + 9 * u, torsoBot + 0.22 * HH], [x - 9 * u, torsoBot + 0.22 * HH]]; p.poly(st, old ? "#5e4632" : LEATHER, 1.6 * u); }
  }
  p.gradFill(tp, O.tunic, mul(O.tunic, SH_CLOTH), light);
  p.clip(tp, () => {
    if (O.armor) {
      const top = chin - 0.1 * HH, bot = torsoBot - 0.25 * HH, n = 5;
      for (let i = 0; i < n; i++) {
        const y0 = top + (bot - top) * i / n, y1 = top + (bot - top) * (i + 1) / n;
        const c = old ? (i % 2 ? "#8d8679" : "#9a9384") : (i % 2 ? "#a7b0ba" : "#bcc4cc");
        p.poly([[tcx - 1.5 * T.a, y0], [tcx + 1.5 * T.a, y0 + 3 * u], [tcx + 1.5 * T.a, y1 + 3 * u], [tcx - 1.5 * T.a, y1]], c, 1.8 * u);
      }
      p.band([[tcx - 1.4 * T.a, torsoBot - 0.2 * HH], [tcx + 1.4 * T.a, torsoBot - 0.2 * HH]], LEATHER, 0.08 * HH, 1.5 * u);
      for (let i = -2; i <= 2; i++) p.dot(tcx + i * 0.3 * T.a, torsoBot - 0.2 * HH, 2.4 * u, BRASS);
      if (old) for (let i = 0; i < 5; i++) p.ell(tcx + Math.sin(i * 1.7) * 0.7 * T.a, top + (bot - top) * ((i * 0.31) % 1), 6 * u, 3 * u, "#8a4b22", 0);
    } else {
      p.band([[tcx - 1.4 * T.a, torsoBot - 0.24 * HH], [tcx + 1.4 * T.a, torsoBot - 0.24 * HH]], O.apron ? "#5a3b2a" : "#e2c27a", 0.05 * HH, 1.2 * u);
      if (O.trim) { // royal robe: gold centre trim + bright studs, neck to belt
        p.band([[tcx, chin + 0.06 * HH], [tcx, torsoBot - 0.26 * HH]], O.trim, 0.055 * HH, 1.2 * u);
        for (let i = 0; i < 4; i++) p.dot(tcx, chin + 0.24 * HH + i * 0.17 * HH, 2.2 * u, "#fff3c4");
      }
      if (O.collar) { // white fur collar at the neck + ermine flecks
        p.band([[tcx - 1.05 * T.a, chin + 0.05 * HH], [tcx + 1.05 * T.a, chin + 0.05 * HH]], O.collar, 0.12 * HH, 1.4 * u);
        p.band([[tcx - 0.8 * T.a, chin + 0.16 * HH], [tcx + 0.8 * T.a, chin + 0.16 * HH]], O.collar, 0.07 * HH, 1.2 * u);
        for (const dx of [-0.62, -0.2, 0.24, 0.66]) p.dot(tcx + dx * T.a, chin + 0.05 * HH, 1.7 * u, "#3a3230");
      }
      if (O.toga) p.band([[tcx - 1.0 * T.a, chin - 0.1 * HH], [tcx + 1.1 * T.a, torsoBot - 0.1 * HH]], O.toga, 0.16 * HH, 1.6 * u);
      if (O.apron) p.poly([[tcx - 0.55 * T.a, torsoBot - 0.2 * HH], [tcx + 0.55 * T.a, torsoBot - 0.2 * HH], [tcx + 0.6 * T.a, torsoBot + 0.2 * HH], [tcx - 0.6 * T.a, torsoBot + 0.2 * HH]], O.apron, 1.6 * u);
      if (O.shirt) p.poly([[tcx - 0.17 * T.a, chin - 0.04 * HH], [tcx + 0.17 * T.a, chin - 0.04 * HH], [tcx, chin + 0.36 * HH]], O.shirt, 1.4 * u);
      if (O.pack) { // astronaut chest unit
        p.poly(rrect(tcx - 0.30 * T.a, chin + 0.30 * HH, tcx + 0.30 * T.a, chin + 0.78 * HH, 5 * u), "#f4f7fa", 2.2 * u);
        p.dot(tcx - 0.14 * T.a, chin + 0.46 * HH, 3.4 * u, "#d8453a"); p.dot(tcx + 0.02 * T.a, chin + 0.46 * HH, 3.4 * u, "#3a7bd8"); p.dot(tcx + 0.17 * T.a, chin + 0.46 * HH, 3.4 * u, "#58a04a");
        p.poly(rrect(tcx - 0.2 * T.a, chin + 0.58 * HH, tcx + 0.2 * T.a, chin + 0.68 * HH, 3 * u), "#b9c6d2", 1.4 * u);
      }
      if (O.patchUS || O.patchCN) { // chest flag patch (viewer's left chest), ~0.36 T.a wide
        const px = tcx - 0.62 * T.a, py = chin + 0.34 * HH, pw = 0.36 * T.a, ph2 = 0.21 * HH;
        p.poly(rrect(px, py, px + pw, py + ph2, 2 * u), "#e8e2d2", 1.6 * u);
        if (O.patchUS) {
          for (let i = 0; i < 4; i++) p.poly([[px + 2 * u, py + 2 * u + i * ph2 / 4], [px + pw - 2 * u, py + 2 * u + i * ph2 / 4], [px + pw - 2 * u, py + 2 * u + (i + 1) * ph2 / 4], [px + 2 * u, py + 2 * u + (i + 1) * ph2 / 4]], i % 2 ? "#f2ede0" : "#b03a48", 0);
          p.poly([[px + 2 * u, py + 2 * u], [px + pw * 0.45, py + 2 * u], [px + pw * 0.45, py + ph2 * 0.52], [px + 2 * u, py + ph2 * 0.52]], "#2c3a6e", 0);
          for (let r2 = 0; r2 < 2; r2++) for (let s2 = 0; s2 < 3; s2++) p.dot(px + pw * 0.12 + s2 * pw * 0.13, py + ph2 * 0.16 + r2 * ph2 * 0.2, 1.1 * u, "#ffffff");
        } else {
          p.poly([[px + 2 * u, py + 2 * u], [px + pw - 2 * u, py + 2 * u], [px + pw - 2 * u, py + ph2 - 2 * u], [px + 2 * u, py + ph2 - 2 * u]], "#d0342c", 0);
          const sx = px + pw * 0.3, sy = py + ph2 * 0.42, sr2 = ph2 * 0.26;
          const star = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? sr2 * 0.42 : sr2; star.push([sx + Math.cos(a) * rr, sy + Math.sin(a) * rr]); }
          p.poly(star, "#f7d038", 0);
          p.dot(px + pw * 0.72, py + ph2 * 0.3, 1.3 * u, "#f7d038"); p.dot(px + pw * 0.8, py + ph2 * 0.48, 1.1 * u, "#f7d038"); p.dot(px + pw * 0.72, py + ph2 * 0.66, 1.3 * u, "#f7d038");
        }
      }
      p.stroke([[tcx - 0.2 * T.a, chin + 0.02 * HH], [tcx, chin + 0.16 * HH], [tcx + 0.2 * T.a, chin + 0.02 * HH]], 2 * u);
    }
  });
  p.inkRing(tp, ow, thick);
  if (O.armor) for (const s of [-1, 1]) { // shoulder plates
    const sp = ellPts(tcx + s * 0.72 * T.a, chin + 0.1 * HH, 0.42 * T.a, 0.13 * HH, 180, 360, s * 8, 20);
    p.poly(sp, old ? "#9a9384" : "#c5ccd3", 1.8 * u);
  }
  if (O.moss) {/* reserved */}
  for (const a of arms) if (a.front) drawArm(a);
  // shield in front, held by the left hand
  if (O.shield && L === "shield") {
    const sx = tcx - 0.55 * T.a, sy = torsoBot + 0.05 * HH, sw = 0.36 * W, sh = 0.78 * HH;
    const sp = rrect(sx - sw, sy - sh, sx + sw, sy + sh, 8 * u);
    p.gradFill(sp, "#c0302c", "#7d1d22", light);
    p.clip(sp, () => {
      p.band([[sx - sw, sy], [sx + sw, sy]], BRASS, 6 * u, 1.2 * u);
      p.band([[sx, sy - sh], [sx, sy + sh]], BRASS, 6 * u, 1.2 * u);
      for (const s of [-1, 1]) { p.stroke([[sx + s * 12 * u, sy - 14 * u], [sx + s * 34 * u, sy - 46 * u], [sx + s * 22 * u, sy - 44 * u], [sx + s * 46 * u, sy - 74 * u]], 3.5 * u, BRASS); p.stroke([[sx + s * 12 * u, sy + 14 * u], [sx + s * 34 * u, sy + 46 * u], [sx + s * 22 * u, sy + 44 * u], [sx + s * 46 * u, sy + 74 * u]], 3.5 * u, BRASS); }
      p.stroke(ellPts(sx - sw * 0.5, sy - sh * 0.7, sw * 0.3, sh * 0.1, 200, 320, 0, 10), 3 * u, "#ffffff44");
    });
    p.ell(sx, sy, 13 * u, 13 * u, "#e6c068", 2.2 * u);
    p.inkRing(sp, ow, thick);
  }
  // ---- head ----
  const [cpx, cpy] = rotAbout([cx, chin], rad(tilt), [cx, hipY]);
  const Ah = tilt + headTilt;
  p.rot = Ah ? [rad(Ah), cx, chin, cpx - cx, cpy - chin] : null;
  if (helmet && O.helmet !== "ww2") galea(p, H, cx, hc, light, thick, ow, old, u);
  const hp = blobPts(cx, hc, H);
  if (O.hair && !helmet) { const hb = blobPts(cx, hc - 0.03 * HH, { ...H, a: H.a * 1.04, b: H.b * 1.05 }); p.poly(hb, O.hair, 0); }
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  if (O.helmet === "ww2") { // WWII steel helmet: wide dome + brim, khaki steel
    const dome = ellPts(cx, hc - H.b * 0.18, H.a * 1.14, H.b * 0.8, 180, 360, 0, 44);
    p.shadedFill(dome, "#5e5c46", mul("#5e5c46", [0.66, 0.66, 0.7]), light, H.a, 0.4);
    p.inkRing(dome, ow * 0.9, thick);
    p.ell(cx, hc - H.b * 0.18, H.a * 1.24, H.b * 0.16, "#54523e", ow * 0.7);
    p.stroke([[cx - H.a * 0.5, hc + H.b * 0.1], [cx - H.a * 0.42, hc + H.b * 0.52]], 2.4 * u, "#3c3a2c");
    p.stroke([[cx + H.a * 0.5, hc + H.b * 0.1], [cx + H.a * 0.42, hc + H.b * 0.52]], 2.4 * u, "#3c3a2c");
  }
  if (helmet && O.helmet !== "ww2") {
    const bandY = hc - H.b * 0.42, bp = ellPts(cx, bandY, H.a * 1.05, H.b * 0.66, 180, 360, 0, 48);
    p.shadedFill(bp, old ? "#8f8a7e" : STEEL, mul(old ? "#8f8a7e" : STEEL, [0.62, 0.64, 0.72]), light, H.a, 0.4);
    p.clip(bp, () => { p.stroke(ellPts(cx - 20 * u, bandY - 0.3 * H.b, 0.25 * H.a, 0.18 * H.b, 200, 300, 0, 16), 5 * u, "#ffffff66");
      if (old) for (let i = 0; i < 9; i++) p.ell(cx + Math.sin(i * 2.3) * 0.8 * H.a, bandY - (0.08 + 0.5 * ((i * 0.37) % 1)) * H.b, (4 + (i % 3) * 2) * u, (2.5 + (i % 2)) * u, "#8a4b22", 0); });
    p.poly(bp, null, ow * 0.9);
    p.band([[cx - H.a * 1.05, bandY], [cx + H.a * 1.05, bandY]], old ? "#a88a4a" : BRASS, 7 * u, 1.8 * u, "round");
    p.poly(rrect(cx - 4 * u, bandY - 0.55 * H.b, cx + 4 * u, bandY - 3 * u, 2 * u), old ? "#a88a4a" : BRASS, 1.5 * u);
    cheeks(p, H, cx, hc, light, ow, old, u);
  } else if (O.cap) hatOn(p, { hat: "cap", cap: O.cap, jacket: O.tunic }, hp, H, cx, hc, light, seed, facing, false);
  else if (O.hair) hatOn(p, { hat: "hair", hair: O.hair, jacket: O.tunic }, hp, H, cx, hc, light, seed, facing, false);
  else if (O.helmet && nohelmet) { // bald old head with white side tufts
    for (const s of [-1, 1]) p.ell(cx + s * 0.9 * H.a, hc - 0.1 * H.b, 0.22 * H.a, 0.3 * H.b, "#f4f1ea", 3 * u);
  }
  if (O.beard) {
    const bShort = !!O.beardShort; // king: a short royal beard, not the old man's long one
    const bd = blobPts(cx + 6 * u * facing, hc + (bShort ? 0.6 : 0.85) * H.b, { a: 0.62 * H.a, b: (bShort ? 0.46 : 0.75) * H.b, nTop: 2.4, nBot: 1.6, egg: -0.35, asym: 0, rot: 0, noise: 0.02, seed: seed + 4 });
    p.shadedFill(bd, O.beard, mul(O.beard, [0.86, 0.86, 0.92]), light, 0.6 * H.a, 0.3);
    p.clip(bd, () => { for (let i = -3; i <= 3; i++) p.stroke([[cx + i * 9 * u, hc + 0.45 * H.b], [cx + i * 7 * u, hc + 1.35 * H.b]], 1.2 * u, mix(O.beard, "#ffffff", 0.3)); });
    p.inkRing(bd, ow * 0.8, thick);
  }
  faceFront(p, cx, hc, W, expr, facing, look, lid, helmet, skin, O.beard ? O.beard : O.moustache, !!O.stout);
  if (O.crown) { // the Sea King's crown: five gold points + jewelled band, seated on the head top
    const gold = "#e8b64c", goldDk = "#a87c26";
    const arc = (ry, a0, a1, n = 26) => { const pts = []; for (let i = 0; i <= n; i++) { const a = rad(a0 + (a1 - a0) * i / n); pts.push([cx + Math.cos(a) * H.a * 1.04, hc + Math.sin(a) * ry]); } return pts; };
    for (let k = 0; k < 5; k++) { // points first (the band covers their bases)
      const aL = rad(192 + k * 39), aC = rad(206 + k * 39), aR = rad(220 + k * 39);
      const tri = [[cx + Math.cos(aL) * H.a * 1.04, hc + Math.sin(aL) * H.b * 0.78],
        [cx + Math.cos(aC) * H.a * 1.04, hc - H.b * (k === 2 ? 1.3 : 1.15)],
        [cx + Math.cos(aR) * H.a * 1.04, hc + Math.sin(aR) * H.b * 0.78]];
      p.poly(tri, gold, ow * 0.45);
      p.dot(tri[1][0], tri[1][1] + 7 * u, 3.6 * u, goldDk);
    }
    const bandPts = [...arc(H.b * 0.5, 180, 360), ...arc(H.b * 0.88, 360, 180)];
    p.shadedFill(bandPts, gold, mul(gold, [0.76, 0.68, 0.58]), light, H.a, 0.35);
    p.inkRing(bandPts, ow * 0.8, thick);
    for (const [k, col] of [[0, "#c22f3d"], [1, "#2f6fc2"], [2, "#c22f3d"], [3, "#39a05a"], [4, "#c22f3d"]]) {
      const a = rad(208 + k * 31);
      const jx = cx + Math.cos(a) * H.a * 0.9, jy = hc + Math.sin(a) * H.b * 0.68;
      p.dot(jx, jy, 5 * u, col); p.dot(jx - 1.4 * u, jy - 1.4 * u, 1.6 * u, "#ffffff");
    }
  }
  if (O.bubble) { // astronaut bubble helmet: glass dome + rim + highlight, drawn over the face
    p.ell(cx, hc - 0.02 * HH, H.a * 1.22, H.b * 1.22, "#bcd9f24d", 0);
    p.ell(cx, hc - 0.02 * HH, H.a * 1.22, H.b * 1.22, null, ow * 0.85);
    p.arc(cx - 0.34 * H.a, hc - 0.38 * H.b, 0.34 * H.a, 0.3 * H.b, 190, 290, 3.4 * u, "#ffffff");
    p.poly(rrect(cx - 0.52 * W * 0.5, chin - 0.06 * HH, cx + 0.52 * W * 0.5, chin + 0.1 * HH, 5 * u), "#c8d2dc", 2 * u);
  }
  if (O.brows) for (const s of [-1, 1]) p.ell(cx + 7 * u * facing + s * 14 * u, hc - 20 * u, 11 * u, 5 * u, O.brows, 2 * u);
  if (O.beard) { // re-draw the mouth over the beard for open mouths
    if (expr === "shock" || expr === "snore") p.ell(cx + 8 * u * facing, hc + 22 * u, 6 * u, 7 * u, "#5a1e28", 2 * u);
  }
  p.rot = null;
  if (arms.some((a) => a.swirl)) { // cuckoo swirl next to the temple
    const a = arms.find((x) => x.swirl), [hx, hy] = a.pts[2], ph = opts.swirl || 0, pts = [];
    for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 4 + ph, r = (4 + i * 0.7) * u; pts.push([hx + Math.cos(t) * r, hy - 40 * u + Math.sin(t) * r]); }
    p.stroke(pts, 3 * u, "#ffffff"); p.stroke(pts, 1.4 * u, INK);
  }
};

/** loose helmet prop card (lifted off the old soldier) */
export const helmetCard = (p) => {
  const H = headBlob(3, 118, 0), u = 2 * H.a / 100, hc = 560, light = rad(-120), thick = thickAngle(light), ow = 5 * u;
  galea(p, H, 300, hc, light, thick, ow, true, u);
  const bandY = hc - H.b * 0.42, bp = ellPts(300, bandY, H.a * 1.05, H.b * 0.66, 180, 360, 0, 48);
  // dark inside visible from below
  p.ell(300, bandY, H.a * 1.05, 0.12 * H.b, "#2a221e", 0);
  p.shadedFill(bp, "#8f8a7e", mul("#8f8a7e", [0.62, 0.64, 0.72]), light, H.a, 0.4);
  p.clip(bp, () => { for (let i = 0; i < 9; i++) p.ell(300 + Math.sin(i * 2.3) * 0.8 * H.a, bandY - (0.08 + 0.5 * ((i * 0.37) % 1)) * H.b, (4 + (i % 3) * 2) * u, (2.5 + (i % 2)) * u, "#8a4b22", 0); });
  p.poly(bp, null, ow * 0.9);
  p.band([[300 - H.a * 1.05, bandY], [300 + H.a * 1.05, bandY]], "#a88a4a", 7 * u, 1.8 * u, "round");
  cheeks(p, H, 300, hc, light, ow, true, u);
};

/** ZZZ for the sleeping guard */
export const fxZ = (p, t) => {
  const g = p.g; g.save(); g.font = "900 120px Arial Black, Arial"; g.lineJoin = "round";
  for (let i = 0; i < 3; i++) {
    const k = (t + i / 3) % 1, x = 220 + i * 70 + Math.sin(k * 6) * 20, y = 700 - k * 500, s = 0.5 + k * 0.7;
    g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = Math.min(1, (1 - k) * 2.5);
    g.lineWidth = 16; g.strokeStyle = INK; g.strokeText("Z", 0, 0); g.fillStyle = "#ffffff"; g.fillText("Z", 0, 0); g.restore();
  }
  g.restore();
};
/** falling leaf */
export const fxLeaf = (p, col) => { p.poly([[300, 380], [420, 470], [300, 620], [180, 470]], col, 14); p.stroke([[300, 400], [300, 600]], 8); };
/** dust cloud puff (k 0..1 growth) */
export const fxDust = (p, k, col = "#e8dcc4") => {
  const g = p.g; g.save(); g.globalAlpha = Math.max(0, 1 - k * k);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, r = 90 + 150 * k; p.ell(300 + Math.cos(a) * r, 520 + Math.sin(a) * r * 0.6, 120 + 60 * k, 100 + 50 * k, col, 12); }
  p.ell(300, 520, 170 + 110 * k, 140 + 80 * k, col, 0);
  g.restore();
};
export const fxDrip = (p) => p.ell(300, 500, 40, 64, "#9fd4ff", 10);
export const fxWood = (p, seed) => { p.poly([[200, 420], [400, 400], [420, 560], [230, 600]], "#5b3d22", 14); p.stroke([[240, 450], [380, 440]], 6, "#3a2614"); p.ell(330, 520, 26, 18, "#4d7a32", 0); };

export const headCenter = (seed = 3) => { const H = headBlob(seed, 118, 0), HH = 2 * H.b; return 975 - 1.38 * HH - 1.08 * HH - H.b; };

/** Irish Pointer dog card — four-legged, same Pen/plum style. Canvas 600x1000, feet at y=975, faces +x.
 *  opts: burrs (count), sit, step (0..1 walk phase), pant (0/1), earWag (rad) */
export const dogCard = (p, o = {}) => {
  const { burrs = 0, sit = false, step = 0, pant = 0 } = o;
  const light = rad(-120), thick = thickAngle(light), ow = 5.5;
  const fur = "#f6f1e4", patch = "#7a4a2c", furSh = mul(fur, SH_CLOTH), dark = mul(fur, [0.78, 0.76, 0.8]);
  const ground = 975;
  const burrSpots = [[215, 695], [305, 775], [385, 685], [255, 805], [425, 765], [165, 765], [335, 655], [455, 715], [200, 830], [360, 830]];
  const drawBurrs = (n) => { for (let i = 0; i < Math.min(n, burrSpots.length); i++) { const [bx, by] = burrSpots[i]; p.ell(bx, by, 10, 9, "#6e4f27", 2); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 + i * 1.3; p.stroke([[bx, by], [bx + Math.cos(a) * 14, by + Math.sin(a) * 13]], 1.8, "#54391c"); } } };
  const head = (hx, hy, s = 1) => {
    // muzzle + skull + floppy ear + collar
    p.ell(hx + 44 * s, hy + 24 * s, 54 * s, 30 * s, fur, ow * 0.8);
    const hp = ellPts(hx, hy, 64 * s, 57 * s, 0, 360, 0, 40);
    p.shadedFill(hp, fur, furSh, light, 60 * s, 0.35); p.inkRing(hp, ow * 0.8, thick);
    p.ell(hx - 26 * s, hy + 26 * s, 27 * s, 58 * s, patch, ow * 0.7, 0, 360, 0.28); // ear
    p.dot(hx + 92 * s, hy + 12 * s, 12 * s, INK); // nose
    p.dot(hx + 16 * s, hy - 14 * s, 7.5 * s, INK); p.dot(hx + 19 * s, hy - 17 * s, 2.6 * s, "#ffffff"); // eye
    p.stroke([[hx + 2 * s, hy - 32 * s], [hx + 28 * s, hy - 36 * s]], 4 * s, patch); // brow patch line
    if (pant) p.ell(hx + 56 * s, hy + 52 * s, 10 * s, 17 * s, "#e86e78", 2);
    p.stroke([[hx - 34 * s, hy + 44 * s], [hx + 6 * s, hy + 62 * s]], 12 * s, "#b03a30"); // collar
  };
  if (!sit) {
    const sw = Math.sin(step * Math.PI * 2) * 20, sw2 = Math.sin(step * Math.PI * 2 + Math.PI) * 20;
    // far legs (darker)
    p.stroke([[205, 800], [200 + sw2, ground - 4]], 17, dark); p.stroke([[420, 800], [425 + sw, ground - 4]], 17, dark);
    // tail: up and wagging
    const wag = Math.sin(step * Math.PI * 4) * 10;
    p.stroke(curve([128, 706], [86, 636], [74 + wag, 566]), 17, fur); p.dot(74 + wag, 562, 10, patch);
    // body
    const bp = ellPts(300, 742, 188, 94, 0, 360, 0, 48);
    p.shadedFill(bp, fur, furSh, light, 170, 0.4); p.inkRing(bp, ow, thick);
    p.clip(bp, () => { p.ell(238, 706, 74, 52, patch, 0); p.ell(392, 778, 52, 36, patch, 0); p.ell(150, 760, 30, 44, patch, 0); });
    p.inkRing(bp, ow, thick);
    // near legs
    p.stroke([[178, 806], [172 + sw, ground - 4]], 19, fur); p.stroke([[398, 806], [404 + sw2, ground - 4]], 19, fur);
    for (const [fx, fy] of [[172 + sw, ground - 2], [404 + sw2, ground - 2], [200 + sw2, ground - 2], [425 + sw, ground - 2]]) p.ell(fx + 8, fy, 15, 7, fur, 2.4);
    head(472, 640);
    drawBurrs(burrs);
  } else {
    // sitting: haunch + upright chest + straight front legs + curled tail
    p.stroke(curve([150, 900], [96, 940], [120, 968]), 16, fur);
    const hp2 = ellPts(215, 866, 88, 74, 0, 360, 0, 44);
    p.shadedFill(hp2, fur, furSh, light, 100, 0.4); p.inkRing(hp2, ow, thick);
    p.clip(hp2, () => p.ell(196, 800, 62, 52, patch, 0)); p.inkRing(hp2, ow, thick);
    const tp = ellPts(338, 706, 82, 128, 0, 360, -0.22, 44);
    p.shadedFill(tp, fur, furSh, light, 80, 0.4); p.inkRing(tp, ow, thick);
    p.stroke([[366, 806], [372, ground - 4]], 19, fur); p.stroke([[318, 812], [316, ground - 4]], 17, dark);
    p.ell(382, ground - 2, 16, 7, fur, 2.4); p.ell(326, ground - 2, 15, 7, fur, 2.4);
    p.ell(292, 960, 46, 13, fur, 2.4); // hind foot
    head(408, 566);
    drawBurrs(Math.min(burrs, 6));
  }
};

/** Wojtek the bear — upright brown bear, same Pen/plum style. Canvas 600x1000, feet at y=975.
 *  opts: expr (curious|grin|proud|determined|sad), blink, step (0..1 march phase), carry (crate of shells),
 *        stripes (0,1,2 corporal chevrons), wrestle (arms forward, play pose) */
export const bearCard = (p, o = {}) => {
  const { expr = "curious", blink = 0, step = 0, carry = false, stripes = 0, wrestle = 0 } = o;
  const light = rad(-120), thick = thickAngle(light), ow = 6;
  const fur = "#8a5a34", furSh = mul(fur, SH_CLOTH), furDk = mul(fur, [0.8, 0.78, 0.82]), belly = "#b0824f", snoutC = "#caa06b";
  const ground = 975, cx = 300;
  const bobY = step ? Math.abs(Math.sin(step * Math.PI * 2)) * 9 : 0, hipY = 806 - bobY;
  // tail nub
  p.ell(cx - 108, hipY - 6, 24, 19, furDk, 2.5);
  // legs + paws
  for (const side of [-1, 1]) {
    const up = step ? Math.max(0, Math.sin(Math.PI * 2 * (step + (side > 0 ? 0.5 : 0)))) * 24 : 0;
    const fx = cx + side * 60, fy = ground - 4 - up;
    p.stroke([[cx + side * 50, hipY], [fx - side * 4, (hipY + fy) / 2], [fx, fy]], 42, fur);
    p.ell(fx + 12, fy, 36, 13, fur, 2.5);
    for (const t of [-1, 0, 1]) p.stroke([[fx + 22 + t * 11, fy - 8], [fx + 22 + t * 11, fy + 2]], 2.2, furDk);
  }
  // body
  const bp = blobPts(cx, 606 - bobY, { a: 122, b: 196, nTop: 2.3, nBot: 2.5, egg: 0.1, asym: 0, rot: 0, noise: 0.006, seed: 21 });
  p.shadedFill(bp, fur, furSh, light, 110, 0.4); p.inkRing(bp, ow, thick);
  p.clip(bp, () => { p.ell(cx, 668 - bobY, 76, 118, belly, 0); });
  p.inkRing(bp, ow, thick);
  // arms
  const shY = 512 - bobY;
  const armTo = (side, hx, hy) => { p.stroke(curve([cx + side * 104, shY], [cx + side * 140, (shY + hy) / 2], [hx, hy]), 37, fur); p.ell(hx, hy, 21, 17, fur, 2.2); };
  if (carry) { armTo(-1, cx - 116, 716 - bobY); armTo(1, cx + 116, 716 - bobY); }
  else if (wrestle) { armTo(-1, cx - 148, 636 - bobY); armTo(1, cx + 148, 624 - bobY); }
  else { armTo(-1, cx - 132, 764 - bobY); armTo(1, cx + 132, 764 - bobY); }
  // rank chevrons on the left upper arm
  if (stripes) {
    p.poly([[cx - 138, shY - 26], [cx - 96, shY - 30], [cx - 92, shY + 30], [cx - 132, shY + 34]], "#4c4636", 2);
    for (let i = 0; i < stripes; i++) { const y = shY - 12 + i * 24; p.stroke([[cx - 128, y + 10], [cx - 114, y - 4], [cx - 100, y + 10]], 5.5, "#e6c068"); }
  }
  // the crate of shells, held at the chest
  if (carry) {
    const y0 = 636 - bobY, y1 = 806 - bobY;
    p.poly([[cx - 108, y0], [cx + 108, y0], [cx + 100, y1], [cx - 100, y1]], "#9a6c3c", 5);
    for (const fx of [-0.62, 0, 0.62]) p.stroke([[cx + fx * 108, y0 + 4], [cx + fx * 100, y1 - 4]], 4, "#77512a");
    p.stroke([[cx - 108, y0 + 52 - bobY * 0], [cx + 108, y0 + 52]], 5, "#77512a");
    for (const sx of [-52, 0, 52]) { // shell tips poking out of the top
      p.poly([[cx + sx - 13, y0 + 4], [cx + sx, y0 - 26], [cx + sx + 13, y0 + 4]], "#c9cfd6", 2.5);
      p.ell(cx + sx, y0 + 2, 14, 7, "#8f979f", 2);
    }
    p.ell(cx - 116, 716 - bobY, 22, 17, fur, 2.2); p.ell(cx + 116, 716 - bobY, 22, 17, fur, 2.2); // paws over the sides
  }
  // head
  const hc = 322 - bobY;
  for (const side of [-1, 1]) { p.ell(cx + side * 80, hc - 84, 31, 29, fur, 3); p.ell(cx + side * 80, hc - 84, 15, 13, belly, 0); }
  const hp = blobPts(cx, hc, { a: 108, b: 102, nTop: 2.4, nBot: 2.2, egg: 0.05, asym: 0, rot: 0, noise: 0.006, seed: 23 });
  p.shadedFill(hp, fur, furSh, light, 100, 0.4); p.inkRing(hp, ow, thick);
  // snout + nose + mouth
  p.ell(cx + 4, hc + 52, 54, 37, snoutC, 3);
  p.ell(cx + 6, hc + 30, 18, 12.5, "#2c2018", 0);
  p.stroke([[cx + 6, hc + 42], [cx + 6, hc + 56]], 3, "#5a4030");
  if (expr === "grin" || expr === "proud") p.stroke(curve([cx - 16, hc + 58], [cx + 6, hc + 74], [cx + 28, hc + 56]), 4.5, "#4a3220");
  else if (expr === "determined" || expr === "sad") p.stroke([[cx - 13, hc + 64], [cx + 25, hc + 64]], 4.5, "#4a3220");
  else p.ell(cx + 8, hc + 62, 8, 10, "#5a3226", 2.5);
  // eyes + brows
  for (const side of [-1, 1]) {
    const ex = cx + side * 42, ey = hc - 14;
    if (blink) p.stroke([[ex - 11, ey], [ex + 11, ey]], 4.5, "#2c2018");
    else { p.dot(ex, ey, 9.5, "#2c2018"); p.dot(ex + 3, ey - 3.5, 3.2, "#ffffff"); }
    const lift = expr === "curious" ? -16 : expr === "determined" ? -4 : -10, ang = expr === "determined" ? side * 9 : expr === "sad" ? -side * 8 : 0;
    p.stroke([[ex - 15, ey - 26 + lift + (side < 0 ? ang : -ang) * 0], [ex + 15, ey - 26 + lift + (side < 0 ? -ang : ang)]], 6, furDk);
  }
};
