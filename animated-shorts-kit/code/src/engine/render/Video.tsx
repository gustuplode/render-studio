// BASIC render composition for the free kit: simple light rig + characters + set + captions.
// (The premium version adds ink outlines, grading, AO, bloom, depth of field — not included.)
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, Audio, staticFile} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {LOOK_LIGHT, LOOK_SKY} from '../look/look';
import {TOTAL, warp, pop as popEase} from '../core/clock';
import * as TL from '@story/timeline';
import {stage, velocities} from '../core/staging';
import {camAt, applyCam, flashAt, Cam} from '../camera/camera';
import {Character} from '../chars/rig';
import {WORDS, CAPS} from '@story/timeline';
import {AUDIO, SetBefore, SetAfter, useSetData} from '@story/set';
export {TOTAL};

const Rig: React.FC<{c: Cam}> = ({c}) => { const {camera} = useThree(); camera.layers.enableAll(); applyCam(camera as THREE.PerspectiveCamera, c); return null; };   // characters live on a separate layer (NOINK)

/** V3: one PMREM room environment so paint / chrome / glass / metal materials get real
    reflections (toon materials ignore scene.environment). Built synchronously in useMemo —
    before any child draws — so stills and renders are deterministic. */
export const Env: React.FC = () => {
  const {gl, scene} = useThree();
  React.useMemo(() => {
    if ((scene as any).__v3env) return; (scene as any).__v3env = true;
    try {
      const pmrem = new THREE.PMREMGenerator(gl);
      const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = rt.texture; (scene as any).environmentIntensity = 0.4;
      pmrem.dispose();
    } catch { /* environment is an enhancement; never fail a render over it */ }
  }, [gl, scene]);
  return null;
};

/** one warm key sun (casts shadows) + cool sky fill + a little ambient — see references/07_BASIC_LIGHT.md */
export const Lights: React.FC<{at: THREE.Vector3}> = ({at}) => {
  const L = LOOK_LIGHT, target = React.useMemo(() => new THREE.Object3D(), []);
  target.position.set(at.x, 0, at.z);
  return (<>
    <primitive object={target} />
    <ambientLight intensity={L.ambI} color={L.amb} />
    <hemisphereLight args={[L.skyFill, L.groundFill, L.hemiI]} />
    <directionalLight position={[at.x + L.sunOff[0], L.sunOff[1], at.z + L.sunOff[2]]} target={target} intensity={L.sunI} color={L.sun} castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-0.0004} />
  </>);
};

/** captions: 1-3 words, white heavy + black outline, centred at 70 % height.
    KINETIC POP (opt-in): when the story's timeline exports CAPTION_FX {pop, hot}, each group
    pops in with a scale bounce + slight rotate, the word currently being spoken punches up
    in amber, and the `hot` word (index into WORDS) punches oversized. Stories without
    CAPTION_FX render exactly as before. */
const Caption: React.FC<{f: number; width: number; height: number}> = ({f, width, height}) => {
  const t = f / 30; let ci = -1;
  for (let i = 0; i < CAPS.length; i++) if (WORDS[CAPS[i][0]][1] <= t) ci = i;
  if (ci < 0) return null;
  const [a, b] = CAPS[ci], end = WORDS[b][2] + 0.6, next = CAPS[ci + 1] ? WORDS[CAPS[ci + 1][0]][1] : 1e9;
  if (t > Math.min(end, next)) return null;
  const k = width / 1080, fx = (TL as any).CAPTION_FX as {pop?: boolean; hot?: number} | null | undefined;
  const base = {position: 'absolute' as const, left: 0, right: 0, top: height * 0.7, textAlign: 'center' as const, fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 74 * k, color: '#fff', WebkitTextStroke: `${11 * k}px #000`, paintOrder: 'stroke fill' as const, padding: `0 ${50 * k}px`};
  if (!fx?.pop) {
    const txt = WORDS.slice(a, b + 1).map((w) => w[0]).join(' ').toLowerCase();
    return <div style={{...base, transform: 'translateY(-50%)'}}>{txt}</div>;
  }
  const g0 = WORDS[a][1], popU = (t - g0) / 0.16, popS = popEase(Math.min(1, Math.max(0, popU)));
  const rot = -2.2 * (1 - Math.min(1, Math.max(0, popU)));
  let cur = -1;
  for (let i = a; i <= b; i++) if (t >= WORDS[i][1] && t <= WORDS[i][2] + 0.05) cur = i;
  const hotPulse = fx.hot !== undefined && cur === fx.hot ? 1 + 0.1 * Math.sin(Math.min(1, (t - WORDS[fx.hot][1]) / 0.2) * Math.PI) : 1;
  return (
    <div style={{...base, transform: `translateY(-50%) rotate(${rot}deg) scale(${popS * hotPulse})`}}>
      {WORDS.slice(a, b + 1).map((w, j) => {
        const i = a + j, isCur = i === cur, isHot = i === fx.hot;
        const ws = isCur ? (isHot ? 1.5 : 1.2) : 1;
        return <span key={i} style={{display: 'inline-block', transform: `scale(${ws})`, color: isCur ? '#ffd23a' : '#fff',
          transition: 'none', marginRight: j < b - a ? '0.26em' : 0}}>{w[0].toLowerCase()}</span>;
      })}
    </div>
  );
};

export const Video: React.FC = () => {
  const fr = useCurrentFrame(), {width, height} = useVideoConfig(), rt = fr / 30, f = warp(rt) * 30;
  const d = useSetData(), st = stage(f), cc = camAt(rt), cam = cc.p, vel = velocities(f, st), fl = flashAt(rt);
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {AUDIO.voice && <Audio src={staticFile(AUDIO.voice)} />}
      {AUDIO.bed && <Audio src={staticFile(AUDIO.bed)} />}
      <ThreeCanvas width={width} height={height} shadows camera={{fov: 38, near: 0.05, far: 450}}>
        <color attach="background" args={[LOOK_SKY.day.cap]} />
        <Env />
        <Rig c={cc} />
        <Lights at={cc.anchor} />
        <SetBefore d={d} f={f} st={st} cam={cam} vel={vel} tod="day" />
        {st.people.map((p, i) => <Character key={i} c={p} f={f} cam={cam} vel={vel[i]} />)}
        <SetAfter d={d} f={f} st={st} cam={cam} vel={vel} tod="day" />
      </ThreeCanvas>
      {fl > 0 && <AbsoluteFill style={{backgroundColor: '#fff', opacity: fl}} />}
      <Caption f={fr} width={width} height={height} />
    </AbsoluteFill>
  );
};
