// ENGINE GATES: a version may only be rendered / sent when every gate is 0 (or explicitly waived by the story with a reason).
//   npx tsx --tsconfig src/videos/<id>/tsconfig.json src/engine/check/gates.ts        (render.command runs it first)
// Gates
//   LOGIC     people through people / cars / buildings / meters / tables (check_logic: PP PCAR CC PS PM PT)
//   FLOOR     a standing person, cart or car not on the floor (sunk or floating); a carried basket below the floor
//   CAMIN     camera inside set geometry, a car or a cart, or under the floor (check_framing)
//   CAMFACE   camera closer than 0.5 m to any character's head that is in view (camera inside / grazing a face)
//   CROP      the subject's face cut by the frame (unless the setup is marked ecu)
//   OCCL      the subject hidden behind set geometry / a car / a person for >= 5 frames
//   FGBLOCK   a non-subject in the foreground covering the subject
// Soft warnings (printed, never block): EDGE, OFFC, SIZE, HANDS, FEET, HEADROOM, CAPT, SIGN, MISS
import * as THREE from 'three';
import {TOTAL} from '../core/clock';
import {stage, velocities} from '../core/staging';
import {camAt, applyCam, oldF, charPts, ASPECT} from '../camera/camera';
import {check} from './check_framing';
import {logic} from './check_logic';
import {GATE_WAIVERS} from '@story/solids';

const HARD = ['LOGIC', 'FLOOR', 'CAMIN', 'CAMFACE', 'CROP', 'OCCL', 'FGBLOCK'];
type G = {kind: string; key: string; f: number; msg: string};
const out: G[] = [];

// ---- LOGIC ----
for (const i of logic()) out.push({kind: 'LOGIC', key: i.shot, f: i.f, msg: i.msg});

// ---- FLOOR + CAMFACE (every real frame) ----
const cam = new THREE.PerspectiveCamera(40, ASPECT, 0.05, 80);
for (let fr = 0; fr < TOTAL; fr++) {
  const rt = fr / 30, f = oldF(rt), st = stage(f), vel = velocities(f, st), c = camAt(rt); applyCam(cam, c);
  st.people.forEach((p, i) => {
    if (!p.inCar && !p.sit && Math.abs(p.p[1]) > 0.02) out.push({kind: 'FLOOR', key: c.key, f: fr, msg: `${p.who} ${p.p[1] > 0 ? 'floating' : 'sunk'} y=${p.p[1].toFixed(2)}`});
    if (p.bg && Math.abs(p.p[0] - c.p.x) > 32) return;
    const q = charPts(p, f, c.p, vel[i]);
    if (q.basket && q.basket.y < -0.04) out.push({kind: 'FLOOR', key: c.key, f: fr, msg: `${p.who} basket sinks into the floor (bottom y=${q.basket.y.toFixed(2)})`});   // q.basket = basket bottom; <= 4 cm graze is invisible
    const d = q.head.distanceTo(c.p), n = q.head.clone().project(cam);
    if (d < 0.5 && n.z < 1 && Math.abs(n.x) < 1.3 && Math.abs(n.y) < 1.3) out.push({kind: 'CAMFACE', key: c.key, f: fr, msg: `camera ${d.toFixed(2)} m from ${p.who}'s head`});
  });
  st.carts.forEach((k, j) => { if (Math.abs(k.p[1]) > 0.02) out.push({kind: 'FLOOR', key: c.key, f: fr, msg: `cart ${j} y=${k.p[1].toFixed(2)}`}); });
  st.cars.forEach((k, j) => { if (Math.abs(k.p[1]) > 0.02) out.push({kind: 'FLOOR', key: c.key, f: fr, msg: `car ${j} y=${k.p[1].toFixed(2)}`}); });
}

// ---- framing (every 2nd real frame) ----
for (const i of check(2, 0, TOTAL)) out.push({kind: i.kind, key: i.key, f: i.f, msg: i.msg});

// ---- report ----
const waived = (g: G) => GATE_WAIVERS.some((w) => w.key === g.key && w.kind === g.kind);
const groups = new Map<string, G[]>();
for (const g of out) { const k = `${g.kind} ${g.key}`; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(g); }
let hard = 0, soft = 0, wv = 0;
const lines: string[] = [];
for (const [k, l] of groups) {
  const g = l[0], isHard = HARD.includes(g.kind), w = isHard && waived(g);
  if (isHard && !w) hard += l.length; else if (w) wv += l.length; else soft += l.length;
  lines.push(`${isHard ? (w ? 'WAIVED' : 'FAIL  ') : 'warn  '} ${k.padEnd(22)} x${String(l.length).padStart(3)}  f${l[0].f}-${l[l.length - 1].f}  ${g.msg}`);
}
lines.sort();
console.log(lines.join('\n'));
console.log(`\nGATES: ${hard === 0 ? 'PASS' : 'FAIL'}  hard=${hard}  waived=${wv}  warnings=${soft}`);
process.exit(hard === 0 ? 0 : 1);
