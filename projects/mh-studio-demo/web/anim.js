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
