// GoldTrain limb system (Gate A) — natural hands + heel-toe feet on the MH rig.
// Axis facts PROVEN by out/hands-test3b.png (2026-11-12):
//   finger flexion = +X on finger{f}-{j}.{S}; wrist rotY turns the palm:
//   R hand: Y- => palm toward thigh (palms-in); L hand: Y+ (mirror).
// All hand state is applied AFTER the body pose each frame (poses never touch
// wrist/finger bones), via single combined rotBone calls.
import * as THREE from 'three';
import { resetPose, rotBone, findBone } from './charlib.js';
import { poseIdle, poseWalk, aimBone, segDir, boneWorldPos, localDir } from './anim.js';

const RELAX = [0.40, 0.48, 0.30];   // relaxed curl per joint (rad, +X flexion)
const GRIP = [0.95, 1.05, 0.62];    // full grip per joint
const FLAT = [0.03, 0.03, 0.02];    // straight finger
const THUMB_R = [0.20, 0.16, 0.10];
const THUMB_G = [0.38, 0.30, 0.20];
const lerp = (a, b, t) => a + (b - a) * t;
// profile mix: -1 = FLAT, 0 = RELAX, +1 = GRIP
function prof(R, G, mix, j) {
  return mix >= 0 ? lerp(R[j], G[j], mix) : lerp(R[j], FLAT[j], -mix);
}

// Set one hand. opts: { grip:0..1 (relax->grip), palm:0..1 (palms-in amount),
//   pitch: wrist pitch rad (+X), per-finger curl overrides {2:0..1 profile-mix} }
export function setHand(ch, S, opts = {}) {
  const grip = opts.grip ?? 0, palm = opts.palm ?? 1;
  for (let f = 1; f <= 5; f++) {
    const isThumb = f === 1;
    const R = isThumb ? THUMB_R : RELAX, G = isThumb ? THUMB_G : GRIP;
    let mix = grip;
    if (opts.fingers && opts.fingers[f] !== undefined) mix = opts.fingers[f];
    for (let j = 1; j <= 3; j++) {
      rotBone(ch, `finger${f}-${j}.${S}`, prof(R, G, mix, j - 1), 0, 0);
    }
  }
  const palmAng = (S === 'R' ? -1.18 : 1.18) * palm;
  rotBone(ch, `wrist.${S}`, opts.pitch ?? 0, palmAng, opts.roll ?? 0);
}
export function setHands(ch, opts = {}) { setHand(ch, 'L', opts); setHand(ch, 'R', opts); }

// Rest/idle with natural hands (palms in, relaxed curl).
export function poseRestGT(ch, t, armAngle = 0.85) {
  poseIdle(ch, t, armAngle);
  setHands(ch, { grip: 0, palm: 1 });
}

// Walk v2 (goldtrain2): heel->toe foot roll, parallel legs (thigh/toe Z locked 0),
// ALIVE gait — root bob at TWO beats per cycle phase-locked to the foot plants
// (|sin| peaks exactly at the stride splits), pelvis roll ±2° + yaw ±3° on the
// root bone, torso counter-yaw against the pelvis, head level with a lagged
// micro-bob, arm swing +15% with the elbow bending most on the forward pass.
// Stride cycle scales with height.
export function cycleFor(ch) { return 1.48 * (ch.height / 1.60); }
export function poseWalkGT(ch, phase, opts = {}) {
  const A = opts.thigh ?? 0.40;
  const armA = (opts.arm ?? 0.30) * 1.15;
  const armAngle = opts.armAngle ?? 0.85;
  const kneeAmp = opts.knee ?? 1;   // v4: cart-push gait uses a shallower fold
  resetPose(ch);
  for (const side of [0, 1]) {
    const S = side === 0 ? 'L' : 'R';
    const ph = phase + side * Math.PI;
    const sw = Math.sin(ph);
    const knee = Math.pow(Math.max(0, -Math.cos(ph)), 1.15) * 0.95 * kneeAmp;
    rotBone(ch, `upperleg01.${S}`, -sw * A, 0, 0);
    rotBone(ch, `upperleg02.${S}`, -sw * A * 0.2, 0, 0);
    rotBone(ch, `lowerleg01.${S}`, -knee * 0.8, 0, 0);
    rotBone(ch, `lowerleg02.${S}`, -knee * 0.4, 0, 0);
    // FOOT ROLL: pitch curve — toes-up just before/at heel strike (sw near +1),
    // flat mid-stance, heel-raised toe-off as sw -> -1, slight dorsi in swing.
    const pitch = 0.30 * Math.sin(ph + 0.55) - 0.12 * knee;
    rotBone(ch, `foot.${S}`, pitch, 0, 0);
    // toes flex at push-off (late stance, leg behind)
    const toeFlex = 0.45 * Math.max(0, -sw - 0.25);
    rotBone(ch, `toe1-1.${S}`, toeFlex, 0, 0);
    rotBone(ch, `toe2-1.${S}`, toeFlex * 0.7, 0, 0);
    // arms: hang + swing opposite to same-side leg; elbow bends most as the
    // arm passes forward (asw -> +1), nearly straight on the back swing.
    const asw = -sw;
    const sgn = S === 'L' ? -1 : 1;
    rotBone(ch, `upperarm01.${S}`, asw * armA, 0, sgn * armAngle);
    rotBone(ch, `upperarm02.${S}`, asw * armA * 0.5, 0, sgn * armAngle * 0.5);
    rotBone(ch, `lowerarm01.${S}`, 0.32 + 0.30 * Math.max(0, asw) + 0.06 * asw, 0, sgn * 0.08);
  }
  // ROOT: vertical bob (two beats/cycle, dip as each foot plants at the splits)
  // + pelvis roll ±2° and yaw ±3°, both phased to the stride (sin peaks at plants).
  const drop = (0.010 + Math.pow(Math.abs(Math.sin(phase)), 1.15) * 0.055) * (opts.bob ?? 1);
  const root = findBone(ch, 'root');
  if (root && ch.bindRootPos) { root.position.copy(ch.bindRootPos); root.position.y -= drop; }
  rotBone(ch, 'root', 0, Math.sin(phase) * 0.052, Math.sin(phase) * 0.035);
  // torso counter-yaw/roll against the pelvis so the chest stays world-stable
  rotBone(ch, 'spine03', 0, -Math.sin(phase) * 0.045, -Math.sin(phase) * 0.015);
  rotBone(ch, 'spine01', 0, -Math.sin(phase) * 0.02, 0);
  // head: stays level, yaw lagging the torso, tiny pitch bob at step frequency
  rotBone(ch, 'neck01', Math.sin(2 * phase + 0.4) * 0.018 - 0.01, -Math.sin(phase - 0.6) * 0.035, 0);
  setHands(ch, { grip: 0, palm: 1 });
  return { bobY: -drop };
}

// Two-hand push/grip: aim both arms so the hands land on world targets
// (radar handle ends), fingers gripped. Call AFTER positioning the group.
export function posePush(ch, t, targetL, targetR) {
  poseRestGT(ch, t);
  for (const [S, tgt] of [['L', targetL], ['R', targetR]]) {
    if (!tgt) continue;
    const shoulder = boneWorldPos(ch, `upperarm01.${S}`, new THREE.Vector3());
    const want = new THREE.Vector3().subVectors(tgt, shoulder).normalize();
    aimBone(ch, `upperarm01.${S}`, `upperarm02.${S}`, want);
    aimBone(ch, `upperarm02.${S}`, `lowerarm01.${S}`, want);
    const elbow = boneWorldPos(ch, `lowerarm01.${S}`, new THREE.Vector3());
    const fwant = new THREE.Vector3().subVectors(tgt, elbow).normalize();
    aimBone(ch, `lowerarm01.${S}`, `lowerarm02.${S}`, fwant);
    setHand(ch, S, { grip: 1, palm: 0.55 });
  }
}

// Hold a map with both hands (targets = map top corners, world). Light grip.
export function poseHoldMap(ch, t, cornerL, cornerR) {
  poseRestGT(ch, t);
  for (const [S, tgt] of [['L', cornerL], ['R', cornerR]]) {
    const shoulder = boneWorldPos(ch, `upperarm01.${S}`, new THREE.Vector3());
    const want = new THREE.Vector3().subVectors(tgt, shoulder).normalize();
    aimBone(ch, `upperarm01.${S}`, `upperarm02.${S}`, want);
    aimBone(ch, `upperarm02.${S}`, `lowerarm01.${S}`, want);
    const elbow = boneWorldPos(ch, `lowerarm01.${S}`, new THREE.Vector3());
    const fwant = new THREE.Vector3().subVectors(tgt, elbow).normalize();
    aimBone(ch, `lowerarm01.${S}`, `lowerarm02.${S}`, fwant);
    setHand(ch, S, { grip: 0.45, palm: 0.25, pitch: 0.2 });
  }
}

// Whisper lean: spine pitches toward listener + head turn. amt 0..1, dir +1/-1 (turn side).
export function poseLean(ch, t, amt, dir = 1) {
  rotBone(ch, 'spine03', 0.16 * amt, 0.10 * amt * dir, 0);
  rotBone(ch, 'spine01', 0.12 * amt, 0.08 * amt * dir, 0);
  rotBone(ch, 'neck01', -0.04 * amt, 0.38 * amt * dir, 0);
  rotBone(ch, 'head', 0, 0.15 * amt * dir, 0);
}

// Head shake ("no / empty again"): Y oscillation with envelope amt.
export function poseHeadShake(ch, t, amt) {
  rotBone(ch, 'neck01', 0.06 * amt, Math.sin(t * 6.5) * 0.17 * amt, 0);
  rotBone(ch, 'head', 0.03 * amt, Math.sin(t * 6.5 + 0.4) * 0.08 * amt, 0);
}

// Look around slowly (hunters scanning the hill).
export function poseLookAround(ch, t, amt = 1) {
  rotBone(ch, 'neck01', 0.03, Math.sin(t * 0.55) * 0.34 * amt, 0);
  rotBone(ch, 'head', 0, Math.sin(t * 0.55 + 0.3) * 0.12 * amt, 0);
}

// Surprise: head back a touch + spine straighten (whisper listener reaction).
export function poseStartle(ch, amt) {
  rotBone(ch, 'neck01', -0.13 * amt, 0, 0);
  rotBone(ch, 'head', -0.07 * amt, 0, 0);
  rotBone(ch, 'spine03', -0.05 * amt, 0, 0);
}

// Point with natural hand (index extended, others curled) — wraps aim from anim.js style.
export function posePointGT(ch, t, blend, targetPos) {
  poseRestGT(ch, t);
  if (blend <= 0.001) return;
  const shoulder = boneWorldPos(ch, 'upperarm01.R', new THREE.Vector3());
  const want = new THREE.Vector3().subVectors(targetPos, shoulder).normalize();
  aimBone(ch, 'upperarm01.R', 'upperarm02.R', want);
  aimBone(ch, 'upperarm02.R', 'lowerarm01.R', want);
  const fdir = want.clone(); fdir.y -= 0.04; fdir.normalize();
  aimBone(ch, 'lowerarm01.R', 'lowerarm02.R', fdir);
  setHand(ch, 'R', { grip: 0.8, palm: 0.3, fingers: { 2: -1 } });  // index (finger2) straight
  rotBone(ch, 'spine03', 0, -0.08 * blend, 0);
}
