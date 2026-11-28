// SCRATCH PROOF TOOLING (V3 detail proofs) — not a story version; deleted after use.
// Renders engine components (Car / Character / Signal) in ECU compositions with the SAME
// Lights + Env as the film, so the proofs judge exactly what the film will show.
import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {Env, Lights} from './engine/render/Video';
import {Car} from './engine/kits/downtown/street';
import {Character} from './engine/chars/rig';
import {Signal} from './videos/04_traffic_signal_v3/signal';
import {drawAsphalt} from './engine/look/draw';

const CamAt: React.FC<{p: [number, number, number]; l: [number, number, number]}> = ({p, l}) => {
  const {camera} = useThree();
  React.useMemo(() => { camera.layers.enableAll(); camera.position.set(...p); camera.lookAt(...l); (camera as THREE.PerspectiveCamera).updateProjectionMatrix(); }, [camera]);
  return null;
};
const groundTex = typeof document === 'undefined' ? null : (() => { const t = drawAsphalt(); t.repeat.set(18, 18); return t; })();
const Ground: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
    <circleGeometry args={[40, 40]} />
    <meshStandardMaterial map={groundTex ?? undefined} color="#9a9da8" roughness={1} />
  </mesh>
);
const Scene: React.FC<{camP: [number, number, number]; camL: [number, number, number]; fov: number; children: React.ReactNode}> = ({camP, camL, fov, children}) => (
  <ThreeCanvas width={1080} height={1920} shadows camera={{fov, near: 0.05, far: 300}}>
    <color attach="background" args={['#9cc4ee']} />
    <Env />
    <CamAt p={camP} l={camL} />
    <Lights at={new THREE.Vector3(0, 0, 0)} />
    <Ground />
    {children}
  </ThreeCanvas>
);

const ProofTyre: React.FC = () => (
  <Scene camP={[3.4, 0.3, 1.05]} camL={[1.53, 0.34, 0.33]} fov={28}>
    <Car c={{p: [0, 0, 0], ry: 0.35, col: '#a8443a', spin: 0.7}} />
  </Scene>
);
const ProofCar: React.FC = () => (
  <Scene camP={[5.2, 1.4, 3.9]} camL={[1.3, 0.8, 0]} fov={40}>
    <Car c={{p: [0, 0, 0], ry: 0.35, col: '#a8443a', spin: 0.7, driver: '#7a3b22'}} />
  </Scene>
);
const ProofFace: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Scene camP={[0.1, 1.15, 0.95]} camL={[0, 1.08, 0]} fov={38}>
      <Character c={{who: 'man', p: [0, 0, 0], act: 'talk', expr: 'grin', talk: true, gaze: 'cam'}} f={f} cam={new THREE.Vector3(0.1, 1.15, 0.95)} />
    </Scene>
  );
};
const ProofSignal: React.FC = () => (
  <Scene camP={[0.9, 2.45, 3.6]} camL={[0, 2.35, 0]} fov={35}>
    <Signal s={{p: [0, 0, 0], ry: 0.15, state: 'everywhere', crank: 0.7}} />
  </Scene>
);

export const ProofRoot: React.FC = () => (<>
  <Composition id="ProofTyre" component={ProofTyre} durationInFrames={1200} fps={30} width={1080} height={1920} />
  <Composition id="ProofCar" component={ProofCar} durationInFrames={1200} fps={30} width={1080} height={1920} />
  <Composition id="ProofFace" component={ProofFace} durationInFrames={1200} fps={30} width={1080} height={1920} />
  <Composition id="ProofSignal" component={ProofSignal} durationInFrames={1200} fps={30} width={1080} height={1920} />
</>);
