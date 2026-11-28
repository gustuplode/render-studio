// LOGIC CHECKER (street): per real frame, staging footprints.  npx tsx src/meter/check_logic.ts [--list]
// PP person-person, PCAR person inside a car (not flagged for people sitting in one), CC car-car (oriented boxes),
// PS person in a building / street furniture, PM person through a meter, PT person through the card table/horse.
import {shotAt, TOTAL} from '../core/clock';
import {stage} from '../core/staging';
import {LOOKS, CART_K} from '../chars/charparts';
import type {CarP} from '../kits/downtown/street';
import {LOGIC_SOLIDS} from '@story/solids';
type OB = {x: number; z: number; ax: [number, number]; az: [number, number]; hl: number; hw: number};
const cartB = (c: {p: [number, number, number]; ry?: number; sc?: number}): OB => { const r = c.ry ?? 0, k = (c.sc ?? 1) * CART_K; return {x: c.p[0], z: c.p[2], ax: [Math.cos(r), -Math.sin(r)], az: [Math.sin(r), Math.cos(r)], hl: 0.33 * k, hw: 0.24 * k}; };
const carB = (c: CarP): OB => { const r = c.ry ?? 0; return {x: c.p[0], z: c.p[2], ax: [Math.cos(r), -Math.sin(r)], az: [Math.sin(r), Math.cos(r)], hl: 2.12, hw: 0.88}; };
const circB = (x: number, z: number, r: number, b: OB) => { const dx = x - b.x, dz = z - b.z, u = dx * b.ax[0] + dz * b.ax[1], v = dx * b.az[0] + dz * b.az[1];
  return Math.hypot(u - Math.max(-b.hl, Math.min(b.hl, u)), v - Math.max(-b.hw, Math.min(b.hw, v))) < r; };
const bb = (a: OB, b: OB) => { for (const d of [a.ax, a.az, b.ax, b.az]) { const pr = (o: OB) => Math.abs(d[0] * o.ax[0] + d[1] * o.ax[1]) * o.hl + Math.abs(d[0] * o.az[0] + d[1] * o.az[1]) * o.hw;
  if (Math.abs((b.x - a.x) * d[0] + (b.z - a.z) * d[1]) > pr(a) + pr(b)) return false; } return true; };
const SOL = LOGIC_SOLIDS;
export type LogicIssue = {kind: string; f: number; shot: string; msg: string};
/** all logic issues (old frames) */
export function logic(): LogicIssue[] {
  const res: LogicIssue[] = [];
  const note = (k: string, f: number, d: string) => res.push({kind: k, f, shot: shotAt(f).name, msg: `${k} ${d}`});
for (let f = 0; f < TOTAL; f++) {
  const st = stage(f), P = st.people, K = st.cars.map(carB), R = (w: string) => 0.2 * ((LOOKS as any)[w]?.scale ?? 1);
  P.forEach((a, j) => {
    for (let k = j + 1; k < P.length; k++) if (!a.inCar && !P[k].inCar && Math.hypot(a.p[0] - P[k].p[0], a.p[2] - P[k].p[2]) < R(a.who) + R(P[k].who)) note('PP', f, `${a.who}/${P[k].who}${a.bg || P[k].bg ? ' (bg)' : ''}`);
    if (!a.inCar) K.forEach((b, k) => { if (circB(a.p[0], a.p[2], R(a.who), b)) note('PCAR', f, `${a.who}${a.bg ? '(bg)' : ''}/car${k}`); });
    for (const b of SOL) if (a.p[0] > b[0] - R(a.who) * 0.8 && a.p[0] < b[1] + R(a.who) * 0.8 && a.p[2] > b[4] - R(a.who) * 0.8 && a.p[2] < b[5] + R(a.who) * 0.8 && !(b[6].startsWith('bldg') && false)) { note('PS', f, `${a.who}${a.bg ? '(bg)' : ''} in ${b[6]}`); break; }
    st.meters.forEach((m, k) => { if (Math.hypot(a.p[0] - m.p[0], a.p[2] - m.p[2]) < R(a.who) + 0.1) note('PM', f, `${a.who}/meter${k}`); });
    const t = st.things.table; if (t && !a.sit && Math.abs(a.p[0] - t.p[0]) < 0.45 + R(a.who) && Math.abs(a.p[2] - t.p[2]) < 0.45 + R(a.who)) note('PT', f, `${a.who} through the table`);
    const h = st.things.horse; if (h && Math.abs(a.p[0] - h.p[0]) < 1.2 && Math.abs(a.p[2] - h.p[2]) < 0.35 + R(a.who)) note('PT', f, `${a.who} through the horse`);
  });
  // ENGINE v1.1: shopping carts - a person through a cart they do not hold (PC), carts through each other (CK)
  const CT = st.carts.map(cartB);
  P.forEach((a) => { if (a.inCar) return; CT.forEach((b, k) => { if (a.hold?.id === k) return; if (circB(a.p[0], a.p[2], R(a.who) * 0.8, b)) note('PC', f, `${a.who}${a.bg ? '(bg)' : ''}/cart${k}`); }); });
  for (let j = 0; j < CT.length; j++) for (let k = j + 1; k < CT.length; k++) if (bb(CT[j], CT[k])) note('CK', f, `cart${j}/cart${k}`);
  for (let j = 0; j < K.length; j++) for (let k = j + 1; k < K.length; k++) if (bb(K[j], K[k])) note('CC', f, `car${j}/car${k} @${K[j].x.toFixed(1)},${K[j].z.toFixed(1)}`);
}
  return res;
}
if (process.argv[1] && process.argv[1].includes('check_logic')) {
  const list = process.argv.includes('--list'), cnt: Record<string, number> = {}, first: Record<string, string> = {};
  for (const i of logic()) { cnt[i.kind] = (cnt[i.kind] ?? 0) + 1; const key = i.kind + ':' + i.shot; cnt[key] = (cnt[key] ?? 0) + 1; if (!first[key]) first[key] = `f${i.f} ${i.msg.slice(i.kind.length + 1)}`; }
  console.log('TOTAL', ['PP', 'PCAR', 'CC', 'PS', 'PM', 'PT', 'PC', 'CK'].map((k) => `${k}=${cnt[k] ?? 0}`).join(' '));
  for (const k of Object.keys(cnt).filter((k) => k.includes(':')).sort()) console.log(k, cnt[k], list ? first[k] : first[k]);
}
