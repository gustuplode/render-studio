// MH Studio — procedural animation on the MakeHuman rig (three r175).
// All poses are applied as offsets from bind pose via charlib.rotBone after resetPose.
import * as THREE from 'three';
import { resetPose, rotBone, findBone } from './charlib.js';

// Idle: gentle breathing sway. t in seconds.
export function poseIdle(ch, t, armAngle = 0.85) {
  resetPose(ch);
  const b = Math.sin(t * 1.6) * 0.02;
  rotBone(ch, 'spine01', b * 0.6, 0, Math.sin(t * 0.8) * 0.008);
  rotBone(ch, 'neck01', -b * 0.4, Math.sin(t * 0.5) * 0.03, 0);
  for (const s of ['L', 'R']) {
    const sgn = s === 'L' ? -1 : 1;   // arms down: L = -Z, R = +Z (axis-tested)
    rotBone(ch, `upperarm01.${s}`, 0, 0, sgn * (armAngle + b * 0.35));
    rotBone(ch, `upperarm02.${s}`, 0, 0, sgn * (armAngle * 0.5));
    rotBone(ch, `lowerarm01.${s}`, 0.15, 0, sgn * 0.08);
  }
}

// Procedural walk. phase in radians (one full cycle = two steps).
// Rig axes (verified by axis test): limb swing is about bone-local X,
// FORWARD = negative rotation; knee flexion = negative X on the shin bones.
export function poseWalk(ch, phase, opts = {}) {
  const A = opts.thigh ?? 0.40;          // thigh swing amplitude (rad)
  const armA = opts.arm ?? 0.30;
  const armAngle = opts.armAngle ?? 0.85;
  resetPose(ch);
  for (const side of [0, 1]) {           // 0 = L leg leads at phase 0
    const S = side === 0 ? 'L' : 'R';
    const ph = phase + side * Math.PI;
    const sw = Math.sin(ph);                          // thigh swing (+ = forward)
    const knee = Math.pow(Math.max(0, -Math.cos(ph)), 1.15) * 0.95; // bend peaks mid-swing (passing)
    rotBone(ch, `upperleg01.${S}`, -sw * A, 0, 0);
    rotBone(ch, `upperleg02.${S}`, -sw * A * 0.2, 0, 0);
    rotBone(ch, `lowerleg01.${S}`, -knee * 0.8, 0, 0);
    rotBone(ch, `lowerleg02.${S}`, -knee * 0.4, 0, 0);
    rotBone(ch, `foot.${S}`, sw * A * 0.35 - knee * 0.25, 0, 0);
    // arms: hang down (L=-Z, R=+Z) and swing opposite to same-side leg (+X = forward)
    const asw = Math.sin(ph + Math.PI);               // = -sw
    const sgn = S === 'L' ? -1 : 1;
    rotBone(ch, `upperarm01.${S}`, asw * armA, 0, sgn * armAngle);
    rotBone(ch, `upperarm02.${S}`, asw * armA * 0.5, 0, sgn * armAngle * 0.5);
    rotBone(ch, `lowerarm01.${S}`, 0.15 + asw * 0.1, 0, sgn * 0.08);
  }
  // pelvis bob: lowest at stride split (|sin| = 1), highest at passing
  const drop = (0.012 + Math.abs(Math.sin(phase)) * 0.05) * (opts.bob ?? 1);
  const root = findBone(ch, 'root');
  if (root && ch.bindRootPos) { root.position.copy(ch.bindRootPos); root.position.y -= drop; }
  rotBone(ch, 'spine03', 0, Math.sin(phase) * 0.05, Math.cos(phase) * 0.02);
  rotBone(ch, 'spine01', 0, Math.sin(phase) * 0.03, 0);
  rotBone(ch, 'neck01', 0, -Math.sin(phase) * 0.04, 0);
  return { bobY: -drop };
}

// Wave: right arm raised, waving. blend 0..1 in/out. t in seconds.
export function poseWave(ch, t, blend = 1, armAngle = 0.85) {
  poseIdle(ch, t, armAngle);
  const w = Math.sin(t * 6.0) * 0.38 * blend;
  // raise right arm up beside head: for R, up = -Z (axis-tested); blend from down (+armAngle) to raised (-2.3)
  rotBone(ch, 'upperarm01.R', w, 0, armAngle * (1 - blend) - 2.3 * blend);
  rotBone(ch, 'upperarm02.R', w * 0.6, 0, -1.1 * blend);
  rotBone(ch, 'lowerarm01.R', 0.1, 0, -0.3 * blend + w * 0.35);
}

// Attach an object to a character bone (head attachments: crown/cap/beard).
// offset/rot are in bone-local space; tune via stills.
export function attachToBone(ch, boneName, obj, offset = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  const bone = findBone(ch, boneName);
  if (!bone) { console.log('attach: bone missing ' + boneName); return null; }
  obj.position.set(...offset);
  obj.rotation.set(...rot);
  if (Array.isArray(scale)) obj.scale.set(...scale); else obj.scale.setScalar(scale);
  bone.add(obj);
  return obj;
}

// ---- REEL poses v2 (2026-11-11) — AIM-BASED, axis-proof ----
// Axis test (out/reel-axis2.png) showed local-axis guessing is unreliable on this rig:
// upperarm +X swings across the chest, -X hides the arm behind the back, neck +X pitches
// the head DOWN. So all gesture poses below AIM bone segments at world-space targets
// (setFromUnitVectors from current segment dir to desired dir) — no axis guessing.
// Head back = NEGATIVE X on neck (verified). Elbow flexion (forward) = +X on lowerarm.
import { findBone as _fb } from './charlib.js';
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

export function segDir(ch, boneName, childName, out) {
  const b = _fb(ch, boneName), c = _fb(ch, childName);
  b.updateWorldMatrix(true, false); c.updateWorldMatrix(true, false);
  const bp = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
  const cp = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
  return (out || new THREE.Vector3()).subVectors(cp, bp).normalize();
}
export function boneWorldPos(ch, boneName, out) {
  const b = _fb(ch, boneName);
  b.updateWorldMatrix(true, false);
  return (out || new THREE.Vector3()).setFromMatrixPosition(b.matrixWorld);
}
// Rotate bone so its segment (bone->child) points along dirWorld, preserving twist.
export function aimBone(ch, boneName, childName, dirWorld) {
  const b = _fb(ch, boneName);
  if (!b) return;
  const cur = segDir(ch, boneName, childName, _v1);
  _q1.setFromUnitVectors(cur, _v2.copy(dirWorld).normalize());
  const curWQ = b.getWorldQuaternion(new THREE.Quaternion());
  const newWQ = _q1.multiply(curWQ);
  const parentWQ = b.parent.getWorldQuaternion(new THREE.Quaternion());
  b.quaternion.copy(parentWQ.invert().multiply(newWQ));
  b.updateWorldMatrix(true, true);
}
// Local-space dir (character facing) -> world dir via the group's quaternion.
export function localDir(ch, x, y, z, out) {
  return (out || new THREE.Vector3()).set(x, y, z).normalize().applyQuaternion(ch.group.quaternion);
}
const slerpDir = (a, b, t, out) => out.copy(a).lerp(b, t).normalize();

// Laugh: head BACK (-X neck, verified) + shoulder shake + spine rock. phase = cycles elapsed.
export function poseLaugh(ch, t, phase, amp = 1) {
  poseIdle(ch, t);
  const osc = Math.sin(phase * Math.PI * 2);
  rotBone(ch, 'neck01', (-0.30 + osc * 0.05) * amp, 0, 0);
  rotBone(ch, 'head', (-0.14 + osc * 0.03) * amp, 0, 0);
  rotBone(ch, 'spine03', (0.05 + osc * 0.03) * amp, 0, 0);
  for (const s of ['L', 'R']) {
    const sgn = s === 'L' ? -1 : 1;
    rotBone(ch, `upperarm01.${s}`, 0.06 * amp, 0, sgn * (0.85 + 0.18 * amp + osc * 0.04));
    rotBone(ch, `lowerarm01.${s}`, (0.15 + 0.30 * amp + osc * 0.06), 0, sgn * 0.08);
  }
}

// Point the right arm AT a world-space target. blend 0..1 (idle -> full point).
export function posePointAt(ch, t, blend, targetPos) {
  poseIdle(ch, t);
  if (blend <= 0.001) return;
  const shoulder = boneWorldPos(ch, 'upperarm01.R', new THREE.Vector3());
  const want = new THREE.Vector3().subVectors(targetPos, shoulder).normalize();
  const idleDir = segDir(ch, 'upperarm01.R', 'upperarm02.R', new THREE.Vector3());
  const dir = slerpDir(idleDir, want, blend, new THREE.Vector3());
  aimBone(ch, 'upperarm01.R', 'upperarm02.R', dir);
  aimBone(ch, 'upperarm02.R', 'lowerarm01.R', dir);
  // forearm: nearly straight along the same line (slight natural droop)
  const fdir = dir.clone(); fdir.y -= 0.05; fdir.normalize();
  aimBone(ch, 'lowerarm01.R', 'lowerarm02.R', fdir);
  rotBone(ch, 'spine03', 0, -0.08 * blend, 0);
}

// Raise + snap. raise 0..1: upper arm aims up-forward; forearm cocked up-back.
// snapK 0..1: forearm flicks to straight (aligned with upper arm) + head nod.
export function poseRaiseSnap(ch, t, raise, snapK) {
  poseIdle(ch, t);
  if (raise <= 0.001 && snapK <= 0.001) return;
  const upDir = localDir(ch, 0.18, 1.0, 0.34, new THREE.Vector3());
  const idleDir = segDir(ch, 'upperarm01.R', 'upperarm02.R', new THREE.Vector3());
  const dir = slerpDir(idleDir, upDir, raise, new THREE.Vector3());
  aimBone(ch, 'upperarm01.R', 'upperarm02.R', dir);
  aimBone(ch, 'upperarm02.R', 'lowerarm01.R', dir);
  const cockDir = localDir(ch, -0.10, 1.0, -0.42, new THREE.Vector3());
  const straightDir = dir.clone();
  const fdir = slerpDir(cockDir, straightDir, snapK, new THREE.Vector3());
  const idleF = segDir(ch, 'lowerarm01.R', 'lowerarm02.R', new THREE.Vector3());
  aimBone(ch, 'lowerarm01.R', 'lowerarm02.R', slerpDir(idleF, fdir, Math.max(raise, snapK), new THREE.Vector3()));
  rotBone(ch, 'neck01', -0.12 * raise + 0.18 * snapK, 0, 0.05 * raise);
}

// Aim the right arm toward a world-space hand target (give/receive). blend 0..1.
// palmUp tilts the forearm segment slightly upward at the end for a palm-up read.
export function poseHandTo(ch, t, blend, targetPos, palmUp = 0.15) {
  poseIdle(ch, t);
  if (blend <= 0.001) return;
  const shoulder = boneWorldPos(ch, 'upperarm01.R', new THREE.Vector3());
  const want = new THREE.Vector3().subVectors(targetPos, shoulder).normalize();
  const idleDir = segDir(ch, 'upperarm01.R', 'upperarm02.R', new THREE.Vector3());
  const dir = slerpDir(idleDir, want, blend, new THREE.Vector3());
  aimBone(ch, 'upperarm01.R', 'upperarm02.R', dir);
  aimBone(ch, 'upperarm02.R', 'lowerarm01.R', dir);
  const elbow = boneWorldPos(ch, 'lowerarm01.R', new THREE.Vector3());
  const fwant = new THREE.Vector3().subVectors(targetPos, elbow).normalize();
  fwant.y += palmUp; fwant.normalize();
  const idleF = segDir(ch, 'lowerarm01.R', 'lowerarm02.R', new THREE.Vector3());
  aimBone(ch, 'lowerarm01.R', 'lowerarm02.R', slerpDir(idleF, fwant, blend, new THREE.Vector3()));
}

// Smile read at distance: head tilt + slight nod. amt 0..1.
export function poseSmile(ch, t, amt = 1) {
  rotBone(ch, 'neck01', 0.10 * amt, 0, 0.13 * amt);
  rotBone(ch, 'head', 0.05 * amt, 0, 0.05 * amt);
}
