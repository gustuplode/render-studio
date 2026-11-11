// Shared studio set assembly for MH Studio (used by set stills + final scene).
import * as THREE from 'three';
import * as P from './props.js';

export const SPOTS = {
  house: [-4.4, -2.6], door: [-4.4, -1.05],
  tree: [-2.2, -0.95], table: [0.1, -0.75], chair: [0.78, -0.5], lamp: [1.9, 1.55],
  bench: [3.7, -1.15], group: [3.35, 0.35],
  pathZ: 0.6,                       // east-west path line (z)
  walkStart: [-4.4, 0.6],           // where aadmi reaches the east path after exiting
};

export function buildSet(scene) {
  const S = {};
  scene.background = P.makeSkyBackdrop();
  scene.add(new THREE.HemisphereLight(0xd8ecff, 0x51713c, 0.95));
  const key = new THREE.DirectionalLight(0xfff1da, 2.0);
  key.position.set(6, 9, 7); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -9; key.shadow.camera.right = 9;
  key.shadow.camera.top = 9; key.shadow.camera.bottom = -9;
  key.shadow.camera.far = 30; key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe0ff, 0.55); rim.position.set(-6, 4, -6); scene.add(rim);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(17, 48), new THREE.MeshStandardMaterial({ color: 0x74ac54, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground); S.ground = ground;

  const house = P.makeHouse(); house.position.set(SPOTS.house[0], 0, SPOTS.house[1]); scene.add(house); S.house = house;
  // path: door -> south strip, then east strip
  const p1 = P.makePathStrip(1.75); p1.rotation.y = Math.PI / 2; p1.position.set(SPOTS.house[0], 0, -0.2); scene.add(p1);
  const p2 = P.makePathStrip(9.6); p2.position.set(0.35, 0, SPOTS.pathZ); scene.add(p2); S.path = p2;
  const plant1 = P.makePottedPlant(1); plant1.position.set(-5.35, 0, -0.95); scene.add(plant1);
  const plant2 = P.makePottedPlant(0.85); plant2.position.set(-3.5, 0, -0.95); scene.add(plant2);
  const tree = P.makeTree(1.15); tree.position.set(SPOTS.tree[0], 0, SPOTS.tree[1]); scene.add(tree); S.tree = tree;
  const tree2 = P.makeTree(0.9); tree2.position.set(5.1, 0, -2.3); scene.add(tree2);
  const table = P.makeTable(); table.position.set(SPOTS.table[0], 0, SPOTS.table[1]); table.rotation.y = 0.15; scene.add(table); S.table = table;
  const chair = P.makeChair(); chair.position.set(SPOTS.chair[0], 0, SPOTS.chair[1]); chair.rotation.y = -0.5; scene.add(chair); S.chair = chair;
  const lamp = P.makeLampPost(); lamp.position.set(SPOTS.lamp[0], 0, SPOTS.lamp[1]); scene.add(lamp); S.lamp = lamp;
  const bench = P.makeBench(); bench.position.set(SPOTS.bench[0], 0, SPOTS.bench[1]); bench.rotation.y = 0.35; scene.add(bench); S.bench = bench;
  const fence = P.makeFenceRun(11); fence.position.set(0.4, 0, -3.1); scene.add(fence); S.fence = fence;
  const fence2 = P.makeFenceRun(5); fence2.rotation.y = Math.PI / 2; fence2.position.set(-6.3, 0, -0.6); scene.add(fence2);
  const plant3 = P.makePottedPlant(0.9); plant3.position.set(2.6, 0, 1.5); scene.add(plant3);
  return S;
}
