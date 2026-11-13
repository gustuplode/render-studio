// MH Reel — character loading with EXPLICIT target-height normalization.
// GLBs ship as base64 text (GitHub API can't push binaries): fetch '<url>.b64', decode, parse.
// Every character is scaled so its measured bounding-box height == targetH (metres);
// the factor is logged to window.__scaleLog — this is the anti bada/chhota guarantee.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
export const normName = n => n.replace(/\./g, '');

export const TARGET_HEIGHTS = { aadmi: 1.70, raja: 1.75, aurat: 1.60, budha: 1.66, sipahi: 1.72 };

export async function loadCharacter(url, targetH = null) {
  // Models ship as base64; on GitHub they are SPLIT into <url>.b64.NN parts (~1.9MB each,
  // connector per-file limit). Try the single file first (local dev), else join parts.
  let b64 = '';
  const single = await fetch(url + '.b64');
  if (single.ok) b64 = await single.text();
  if (!b64 || b64.length < 100) {
    b64 = '';
    for (let i = 0; ; i++) {
      const r = await fetch(url + '.b64.' + String(i).padStart(2, '0'));
      if (!r.ok) break;
      b64 += await r.text();
    }
  }
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
  let box = new THREE.Box3().setFromObject(group);
  let h = box.max.y - box.min.y;
  if (h > 5) { group.scale.setScalar(0.1); group.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(group); h = box.max.y - box.min.y; }
  group.position.y -= box.min.y;   // feet at y=0
  const name = url.split('/').pop();
  const measured = h;
  if (targetH) {
    const f = targetH / h;
    group.scale.multiplyScalar(f);
    group.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(group);
    group.position.y -= box.min.y;
    h = box.max.y - box.min.y;
    (window.__scaleLog = window.__scaleLog || {})[name] = { measured: +measured.toFixed(3), target: targetH, factor: +f.toFixed(4), final: +h.toFixed(3) };
    console.log(`SCALE ${name}: measured ${measured.toFixed(3)}m -> target ${targetH}m (factor ${f.toFixed(4)}), final ${h.toFixed(3)}m`);
  }
  const rootBone = nodes.get('root');
  return { group, bones, nodes, bind, height: h, bindRootPos: rootBone ? rootBone.position.clone() : null };
}

export function resetPose(ch) {
  for (const [name, q] of ch.bind) { const b = ch.bones.get(name); if (b) b.quaternion.copy(q); }
  const r = ch.nodes.get('root');
  if (r && ch.bindRootPos) r.position.copy(ch.bindRootPos);
}

export function rotBone(ch, name, x, y, z) {
  const key = normName(name);
  const b = ch.bones.get(key);
  if (!b) return;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  b.quaternion.copy(ch.bind.get(key)).multiply(q);
}

export function armsDown(ch, a = 0.85) {
  for (const s of ['L', 'R']) {
    const sgn = s === 'L' ? -1 : 1;
    rotBone(ch, `upperarm01.${s}`, 0, 0, sgn * a);
    rotBone(ch, `upperarm02.${s}`, 0, 0, sgn * a * 0.55);
    rotBone(ch, `lowerarm01.${s}`, 0.15, 0, sgn * 0.08);
  }
}

export function findBone(ch, name) { return ch.bones.get(normName(name)) || ch.nodes.get(normName(name)); }
