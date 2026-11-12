// Kimodo baked-clip player for the MH rig (method-(c) retarget output).
// Data modules (kwalk_aadmi.js / kwalk_aurat.js) carry per-bone LOCAL quats
// + rootPos with forward travel removed (the group transform drives travel,
// paced by the clip's own cumulative `travel` curve). Bone lookup goes
// through charlib's normName — GLTFLoader strips '.' from bone names.
import * as THREE from 'three';
import { normName } from './charlib.js';

const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion();
const _v0 = new THREE.Vector3(), _v1 = new THREE.Vector3();

// Sample the clip at fractional source frame sf; returns interpolated rootPos.
export function sampleKimodo(data, sf) {
  const f = Math.min(Math.max(sf, 0), data.frames - 1.001);
  const f0 = Math.floor(f), f1 = Math.min(f0 + 1, data.frames - 1), fr = f - f0;
  const quats = {};
  for (const name in data.bones) {
    const arr = data.bones[name];
    _q0.fromArray(arr[f0]); _q1.fromArray(arr[f1]); _q0.slerp(_q1, fr);
    quats[name] = _q0.clone();
  }
  const p0 = data.rootPos[f0], p1 = data.rootPos[f1];
  return { quats, rootPos: [p0[0] + (p1[0] - p0[0]) * fr, p0[1] + (p1[1] - p0[1]) * fr, p0[2] + (p1[2] - p0[2]) * fr] };
}

// Blend the clip over the character's current pose: beta 1 = full clip.
// Call AFTER the procedural pose + setHands (clip overwrites mapped bones
// incl. wrist; fingers keep the procedural relaxed curl — unmapped in clip).
export function blendKimodo(ch, sample, beta) {
  if (beta <= 0) return;
  for (const name in sample.quats) {
    const b = ch.bones.get(normName(name));
    if (!b) continue;
    if (beta >= 0.999) b.quaternion.copy(sample.quats[name]);
    else b.quaternion.slerp(sample.quats[name], beta);
  }
  const root = ch.nodes.get('root');
  if (root) {
    _v0.copy(root.position);
    _v1.fromArray(sample.rootPos);
    root.position.lerpVectors(_v0, _v1, beta);
  }
}

// Normalised travel progress 0..1 at fractional source frame sf,
// from the clip's cumulative distance curve (GLB world units).
export function travelAt(data, sf) {
  const T = data.travel;
  const f = Math.min(Math.max(sf, 0), T.length - 1.001);
  const f0 = Math.floor(f), f1 = Math.min(f0 + 1, T.length - 1), fr = f - f0;
  return T[f0] + (T[f1] - T[f0]) * fr;
}
export function kimodoProgress(data, sf) {
  const T = data.travel;
  return travelAt(data, sf) / T[T.length - 1];
}
// Progress across a chosen source-frame window [sf0, sf1] of the clip.
export function windowProgress(data, sf0, sf1, sf) {
  const d0 = travelAt(data, sf0), d1 = travelAt(data, sf1);
  return (travelAt(data, sf) - d0) / Math.max(1e-6, d1 - d0);
}
