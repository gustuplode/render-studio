// Shared character loading + posing helpers for MH studio (three r175).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// NOTE: three's GLTFLoader strips '.' from node names (upperarm01.L -> upperarm01L),
// and the MH 'root' joint is a plain Object3D, not a Bone. Normalize all lookups.
export const normName = n => n.replace(/\./g, '');

export async function loadCharacter(url) {
  // Binary GLBs cannot be pushed via the GitHub API, so models ship as base64
  // text (same pattern as blown-vein's patient.b64): fetch '<url>.b64', decode, parse.
  const b64 = await (await fetch(url + '.b64')).text();
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const gltf = await loader.parseAsync(bytes.buffer, '');
  const group = gltf.scene;
  const bones = new Map();
  const nodes = new Map();
  const bind = new Map();
  group.traverse(o => {
    if (o.name) nodes.set(normName(o.name), o);
    if (o.isBone) { bones.set(normName(o.name), o); bind.set(normName(o.name), o.quaternion.clone()); }
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
  });
  // MakeHuman FBX exports in decimeters: normalize to meters when needed.
  let box = new THREE.Box3().setFromObject(group);
  let h = box.max.y - box.min.y;
  if (h > 5) { group.scale.setScalar(0.1); group.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(group); h = box.max.y - box.min.y; }
  // ground the model: feet at y=0
  group.position.y -= box.min.y;
  const rootBone = nodes.get('root');
  return { group, bones, nodes, bind, height: h, bindRootPos: rootBone ? rootBone.position.clone() : null };
}

export function resetPose(ch) {
  for (const [name, q] of ch.bind) { const b = ch.bones.get(name); if (b) b.quaternion.copy(q); }
  const r = ch.nodes.get('root');
  if (r && ch.bindRootPos) r.position.copy(ch.bindRootPos);
}

// Rotate a bone by euler offsets relative to its bind orientation.
export function rotBone(ch, name, x, y, z) {
  const key = normName(name);
  const b = ch.bones.get(key);
  if (!b) return;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  b.quaternion.copy(ch.bind.get(key)).multiply(q);
}

// Bring A-pose arms down toward the body. a = radians of downward swing.
// (Axis test: L arm down = local Z negative, R arm down = local Z positive.)
export function armsDown(ch, a = 0.85) {
  for (const s of ['L', 'R']) {
    const sgn = s === 'L' ? -1 : 1;
    rotBone(ch, `upperarm01.${s}`, 0, 0, sgn * a);
    rotBone(ch, `upperarm02.${s}`, 0, 0, sgn * a * 0.55);
    rotBone(ch, `lowerarm01.${s}`, 0.15, 0, sgn * 0.08);
  }
}

export function findBone(ch, name) { return ch.bones.get(normName(name)) || ch.nodes.get(normName(name)); }
