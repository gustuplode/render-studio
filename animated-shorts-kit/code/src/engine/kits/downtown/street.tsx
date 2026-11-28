// Street kit for the parking-meter short: 1930s cars, Park-O-Meters, horse (V4: articulated 3D), card table, newspaper, ticket, placards.
// Reusable for any 1930s street story.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {LOOK_RAMP as ramp, lookToon, lookPaint, lookChrome, lookGlass, lookMetal, lookRubber} from '../../look/look';   // LOOK
import {drawTireTread, drawTireSide, drawGlint, drawLens, drawCoat, drawFace} from '../../look/draw';

export type V3 = [number, number, number];
export type CarP = {p: V3; ry?: number; col?: string; spin?: number; door?: number; driver?: string; pitch?: number};
export type MeterP = {p: V3; flag?: number; coin?: number; rise?: number};
export type Things = {table?: {p: V3; k?: number; chairs?: number[]; lift?: number}; bulb?: {p: V3; k: number}; rope?: [V3, V3]; horse?: {p: V3; dir?: 1 | -1; bob?: number; rope?: V3; ry?: number; pose?: 'stand' | 'walk' | 'startle'; phase?: number; coat?: string; cart?: boolean}; paper?: {p: V3; t: number; ry?: number};
  ticket?: {p: V3; ry?: number; s?: number; hand?: string}; placards?: {p: V3; text: string; tilt?: number}[]; coins?: {p: V3; n: number; t: number; hand?: string}[]};

const toon = lookToon;   // LOOK
const INK = '#241726';
const cv = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const FONT = '"Archivo Black", Impact, sans-serif';

// ---------- painted textures ----------
const meterFace = () => { const c = cv(256, 320), g = c.getContext('2d')!;
  g.fillStyle = '#2f5a3a'; g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#e9e2cc'; g.beginPath(); g.arc(128, 120, 92, Math.PI, 0); g.lineTo(220, 200); g.lineTo(36, 200); g.closePath(); g.fill();
  g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK; g.font = `900 30px ${FONT}`; g.textAlign = 'center'; g.fillText('PARK-O-METER', 128, 245); g.font = `900 40px ${FONT}`; g.fillStyle = '#f2c23a'; g.fillText('5¢  1 HR', 128, 295);
  g.strokeStyle = INK; g.lineWidth = 4; for (let i = 0; i <= 6; i++) { const a = Math.PI + (i / 6) * Math.PI; g.beginPath(); g.moveTo(128 + Math.cos(a) * 70, 150 + Math.sin(a) * 70); g.lineTo(128 + Math.cos(a) * 84, 150 + Math.sin(a) * 84); g.stroke(); }
  return tex(c); };
const paperTex = () => { const c = cv(512, 640), g = c.getContext('2d')!;
  g.fillStyle = '#efe6d0'; g.fillRect(0, 0, 512, 640); g.fillStyle = INK; g.textAlign = 'center';
  g.font = `900 46px ${FONT}`; g.fillText('THE DAILY NEWS', 256, 62); g.fillRect(24, 78, 464, 6);
  g.font = `900 92px ${FONT}`; ['METER', 'WAR', 'IN COURT!'].forEach((t, i) => { let fs = 92; while (g.measureText(t).width > 470) { fs -= 4; g.font = `900 ${fs}px ${FONT}`; } g.fillText(t, 256, 180 + i * 100); g.font = `900 92px ${FONT}`; });
  g.fillStyle = '#9a917c'; for (let r = 0; r < 9; r++) for (const x0 of [24, 264]) g.fillRect(x0, 470 + r * 18, 224, 8);
  return tex(c); };
const ticketTex = () => { const c = cv(256, 384), g = c.getContext('2d')!;
  g.fillStyle = '#f6efd8'; g.fillRect(0, 0, 256, 384); g.fillStyle = '#b2391f'; g.fillRect(0, 0, 256, 70);
  g.fillStyle = '#fff'; g.font = `900 34px ${FONT}`; g.textAlign = 'center'; g.fillText('TICKET', 128, 48);
  g.fillStyle = INK; g.font = `900 30px ${FONT}`; g.fillText('No. 1', 128, 118); g.fillStyle = '#9a917c'; for (let r = 0; r < 8; r++) g.fillRect(28, 150 + r * 26, 200 - (r % 3) * 30, 10);
  g.lineWidth = 8; g.strokeStyle = INK; g.strokeRect(4, 4, 248, 376); return tex(c); };
const placardTex = (t: string) => { const c = cv(512, 256), g = c.getContext('2d')!;
  g.fillStyle = '#f4ecd6'; g.fillRect(0, 0, 512, 256); g.lineWidth = 14; g.strokeStyle = INK; g.strokeRect(7, 7, 498, 242);
  g.fillStyle = '#b2391f'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 110; g.font = `900 ${fs}px ${FONT}`; while (g.measureText(t).width > 460) { fs -= 4; g.font = `900 ${fs}px ${FONT}`; }
  g.fillText(t, 256, 132); return tex(c); };
const cardTex = () => { const c = cv(64, 96), g = c.getContext('2d')!; g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, 64, 96); g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(2, 2, 60, 92);
  g.fillStyle = '#b2391f'; g.font = `900 40px ${FONT}`; g.textAlign = 'center'; g.fillText('♥', 32, 62); return tex(c); };
const coinTex = () => { const c = cv(128, 128), g = c.getContext('2d')!; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fillStyle = '#d8d8d0'; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.fillStyle = '#8a8a82'; g.font = `900 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('5', 64, 68); return tex(c); };
const bulbTex = () => { const c = cv(256, 256), g = c.getContext('2d')!; g.lineJoin = 'round';
  g.fillStyle = 'rgba(255,236,150,.35)'; g.beginPath(); g.arc(128, 104, 112, 0, 7); g.fill();
  g.strokeStyle = '#ffe28a'; g.lineWidth = 10; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(128 + Math.cos(a) * 82, 104 + Math.sin(a) * 82); g.lineTo(128 + Math.cos(a) * 112, 104 + Math.sin(a) * 112); g.stroke(); }
  g.beginPath(); g.arc(128, 100, 58, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(150, 170); g.lineTo(106, 170); g.closePath(); g.fillStyle = '#fff3a8'; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.fillStyle = '#9a917c'; g.fillRect(104, 172, 48, 34); g.strokeRect(104, 172, 48, 34); g.beginPath(); g.moveTo(112, 130); g.lineTo(122, 112); g.lineTo(134, 130); g.lineTo(144, 112); g.lineWidth = 5; g.stroke(); return tex(c); };
// ---------- materials (built once) ----------
// V3 DETAIL: paint/chrome/glass/metal/rubber are real specular materials (look.ts gloss layer,
// lit by the scene environment in render/Video.tsx); flat props stay toon.
const treadT = typeof document === 'undefined' ? null : drawTireTread();
const boardT = typeof document === 'undefined' ? null : (() => { const t = drawTireTread(); t.repeat.set(6, 1); return t; })();
const wheelMats = typeof document === 'undefined' ? null : [lookRubber({map: treadT!, bump: treadT!}), lookRubber({color: '#ffffff', map: drawTireSide()}), lookRubber({color: '#ffffff', map: drawTireSide()})];
const MAT = (() => { if (typeof document === 'undefined') return null as any; return {
  body: (c: string) => lookPaint({color: c}), chrome: lookChrome(), tire: toon({color: '#26222a'}),
  fender: (() => { const m = lookPaint({color: '#1d1a20'}); m.side = THREE.DoubleSide; return m; })(),   // V5 two-tone: black fenders + roof insert
  glass: lookGlass({}), glint: new THREE.MeshBasicMaterial({map: drawGlint(0.5), transparent: true, depthWrite: false, side: THREE.DoubleSide}),
  lens: new THREE.MeshBasicMaterial({map: drawLens()}), seam: new THREE.MeshStandardMaterial({color: '#171219', roughness: 0.6, metalness: 0.2}),
  board: lookRubber({map: boardT!, bump: boardT!}),
  iron: lookMetal({color: '#2c3a30'}), meterHead: lookMetal({color: '#3a6a48', rough: 0.4}), face: new THREE.MeshToonMaterial({gradientMap: ramp, map: meterFace()}), flag: toon({color: '#d8342a'}, 0.6),
  wood: toon({color: '#9a6a3a'}), cloth: toon({color: '#2f6f53'}), seat: toon({color: '#6e3428'}), leather: toon({color: '#3a2417'}), card: new THREE.MeshBasicMaterial({map: cardTex(), side: THREE.DoubleSide}),
  paper: new THREE.MeshToonMaterial({gradientMap: ramp, map: paperTex(), side: THREE.DoubleSide}), ticket: new THREE.MeshBasicMaterial({map: ticketTex(), side: THREE.DoubleSide}),
  coin: new THREE.MeshBasicMaterial({map: coinTex(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide}),
  blob: new THREE.MeshBasicMaterial({color: '#000', transparent: true, opacity: 0.3, depthWrite: false}), stick: toon({color: '#b08a5a'}), skin: toon({color: '#f3d9c0'}), rope: toon({color: '#c9a068'}),
  bulb: new THREE.MeshBasicMaterial({map: bulbTex(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide}),
  placard: new Map<string, THREE.Material>(),
}; })();
const placardMat = (t: string) => { if (!MAT.placard.has(t)) MAT.placard.set(t, new THREE.MeshToonMaterial({gradientMap: ramp, map: placardTex(t), side: THREE.DoubleSide})); return MAT.placard.get(t)!; };
const bodyMats = new Map<string, THREE.Material>(); const bodyMat = (c: string) => { if (!bodyMats.has(c)) bodyMats.set(c, MAT.body(c)); return bodyMats.get(c)!; };

// ---------- geometry ----------
const taper = new THREE.CylinderGeometry(0.6, 1, 1, 20), flare = new THREE.CylinderGeometry(0.45, 1, 1, 20);   // SHAPE: tapered post + flared foot
const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 20), sph = new THREE.SphereGeometry(1, 16, 12), plane = new THREE.PlaneGeometry(1, 1), circ = new THREE.CircleGeometry(1, 24);
/** V5 CAR: an upright-grille 1930s SEDAN, not a fastback bubble. Side silhouette (x = length,
    y = up), extruded across the width (04 guide rule 3 kept: one extruded silhouette):
    rounded trunk -> short deck -> sloped rear window -> LONG near-flat roof -> windshield
    raked ~30 deg -> long flat hood -> upright nose. TWO window holes with a real B-pillar. */
const WIN_F: [number, number][] = [[0.10, 1.20], [0.74, 1.20], [0.50, 1.68], [0.10, 1.68]];
const WIN_R: [number, number][] = [[-0.04, 1.20], [-0.04, 1.68], [-1.10, 1.68], [-1.30, 1.20]];
const carGeo = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(-2.02, 0.44);
  sh.bezierCurveTo(-2.10, 0.60, -2.08, 0.86, -1.96, 1.00);
  sh.bezierCurveTo(-1.80, 1.10, -1.62, 1.13, -1.46, 1.16);
  sh.bezierCurveTo(-1.34, 1.38, -1.24, 1.58, -1.16, 1.74);
  sh.bezierCurveTo(-0.70, 1.80, 0.10, 1.80, 0.52, 1.76);
  sh.bezierCurveTo(0.66, 1.55, 0.78, 1.32, 0.90, 1.13);
  sh.bezierCurveTo(1.30, 1.06, 1.70, 1.02, 1.94, 0.97);
  sh.bezierCurveTo(2.06, 0.93, 2.09, 0.72, 2.04, 0.52);
  sh.lineTo(2.00, 0.44);
  sh.closePath();
  for (const W of [WIN_F, WIN_R]) { const hole = new THREE.Path(); hole.moveTo(...W[0]); for (const q of W.slice(1)) hole.lineTo(...q); hole.closePath(); sh.holes.push(hole); }   /* see-through cabin, pillar between */
  const g = new THREE.ExtrudeGeometry(sh, {depth: 1.42, bevelEnabled: true, bevelThickness: 0.10, bevelSize: 0.07, bevelSegments: 4, curveSegments: 14}); g.translate(0, 0, -0.71); return g; })();
const winShape = (W: [number, number][]) => { const sh = new THREE.Shape(); sh.moveTo(...W[0]); for (const q of W.slice(1)) sh.lineTo(...q); sh.closePath(); return new THREE.ShapeGeometry(sh); };
const winGeoF = winShape(WIN_F), winGeoR = winShape(WIN_R);
/** V5 FENDER: a separate articulated arc band over the wheel — crown radius 0.54 over the
    0.36 tyre, one end sweeping DOWN-FORWARD, the other stretching into a long tail that
    flows into the running board. `t` = which way the tail points (+1 rear fender, -1 front). */
const fenderGeo2 = (t: 1 | -1) => {
  const pts: THREE.Vector2[] = [new THREE.Vector2(t * 1.00, -0.06)];
  const a0 = t < 0 ? 165 : 15, a1 = t < 0 ? 12 : 168, steps = 12;
  for (let i = 0; i <= steps; i++) { const a = (a0 + (a1 - a0) * (i / steps)) * Math.PI / 180; pts.push(new THREE.Vector2(Math.cos(a) * 0.54, Math.sin(a) * 0.54)); }
  pts.push(new THREE.Vector2(-t * 0.56, -0.04), new THREE.Vector2(-t * 0.47, -0.13));
  for (let i = steps; i >= 0; i--) { const a = (a0 + (a1 - a0) * (i / steps)) * Math.PI / 180; pts.push(new THREE.Vector2(Math.cos(a) * 0.435, Math.sin(a) * 0.435)); }
  pts.push(new THREE.Vector2(t * 0.92, -0.20));
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {depth: 0.24, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2});
  return g; };
const fenderF2 = fenderGeo2(-1), fenderR2 = fenderGeo2(1);
const steerGeo = new THREE.TorusGeometry(0.155, 0.018, 8, 24);
// V3 wheel geometry: 28-seg cylinder (material groups: side = tread, caps = sidewall) + rounded shoulder torus
const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 28);
const shoulderGeo = new THREE.TorusGeometry(0.86, 0.14, 10, 28);
const hubRingGeo = new THREE.TorusGeometry(0.112, 0.012, 8, 24);

/** one detailed wheel: treaded tyre (map+bump), painted sidewall (rings, lettering, whitewall,
    wire spokes), chrome hub dome + ring + 5 lug bolts — everything inside the spin group */
const Wheel: React.FC<{x: number; z: number; sp: number}> = ({x, z, sp}) => (
  <group position={[x, 0.36, z]} rotation={[Math.PI / 2, sp, 0]}>
    <mesh geometry={wheelGeo} material={wheelMats} scale={[0.36, 0.22, 0.36]} castShadow />
    <mesh geometry={shoulderGeo} material={wheelMats[0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.36, 0.36, 0.6]} />
    {[1, -1].map((s) => <group key={s}>
      <mesh geometry={sph} material={MAT.chrome} position={[0, s * 0.105, 0]} scale={[0.104, 0.05, 0.104]} />
      <mesh geometry={hubRingGeo} material={MAT.chrome} position={[0, s * 0.112, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2; return <mesh key={i} geometry={cyl} material={MAT.chrome} position={[Math.cos(a) * 0.06, s * 0.118, Math.sin(a) * 0.06]} scale={[0.013, 0.02, 0.013]} />; })}
    </group>)}
  </group>
);

/** a bar (cylinder) stretched between two local points — headlight stalks, reins, shafts, cart rails */
const Bar: React.FC<{a: V3; b: V3; r: number; m: THREE.Material}> = ({a, b, r, m}) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return <mesh geometry={cyl} material={m} position={A.lerp(B, 0.5)} quaternion={q} scale={[r, L, r]} />;
};

export const Car: React.FC<{c: CarP}> = ({c}) => {
  const col = bodyMat(c.col ?? '#7a2f2a'), sp = c.spin ?? 0;
  return (
    <group position={c.p} rotation={[0, c.ry ?? 0, 0]}>
      <mesh geometry={circ} material={MAT.blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[2.4, 1.0, 1]} />
      <group rotation={[0, 0, c.pitch ?? 0]}>
        <mesh geometry={carGeo} material={col} castShadow receiveShadow />
        {/* side glass in BOTH framed windows (B-pillar between) + glints */}
        {[-0.795, 0.795].map((z) => <group key={'wg' + z}>
          <mesh geometry={winGeoF} material={MAT.glass} position={[0, 0, z]} />
          <mesh geometry={winGeoR} material={MAT.glass} position={[0, 0, z]} />
        </group>)}
        {[-0.81, 0.81].map((z) => <mesh key={'g' + z} geometry={plane} material={MAT.glint} position={[0.35, 1.45, z]} rotation={[0, z > 0 ? 0 : Math.PI, -0.35]} scale={[0.45, 0.26, 1]} />)}
        {/* windshield + rear glass laid on the body slopes, chrome centre bar on the shield */}
        <group position={[0.796, 1.497, 0]} rotation={[0, 0, -2.599]}>
          <mesh geometry={plane} material={MAT.glass} rotation={[0, Math.PI / 2, 0]} scale={[1.30, 0.66, 1]} />
          <mesh geometry={box} material={MAT.chrome} position={[0, 0, 0]} scale={[0.02, 0.68, 0.035]} />
        </group>
        <group position={[-1.399, 1.496, 0]} rotation={[0, 0, 2.662]}>
          <mesh geometry={plane} material={MAT.glass} rotation={[0, Math.PI / 2, 0]} scale={[1.16, 0.52, 1]} />
        </group>
        {/* black roof insert panel — two-tone cue #1 */}
        <mesh geometry={box} material={MAT.fender} position={[-0.32, 1.80, 0]} scale={[1.30, 0.045, 1.28]} castShadow />
        {/* black fenders (two-tone cue #2) over the V3 detailed wheels */}
        {[-1.3, 1.3].map((x) => [-1, 1].map((sd) => <group key={x + '_' + sd}>
          <mesh geometry={x < 0 ? fenderR2 : fenderF2} material={MAT.fender} position={[x, 0.36, sd > 0 ? 0.68 : -0.92]} castShadow />
          <Wheel x={x} z={sd * 0.827} sp={sp} /></group>))}
        {/* running boards between the fender tails: rubber top + chrome edge strip */}
        {[-1, 1].map((s) => <group key={'rb' + s}>
          <mesh geometry={box} material={MAT.board} position={[0, 0.30, s * 0.84]} scale={[1.55, 0.05, 0.26]} castShadow />
          <mesh geometry={box} material={MAT.chrome} position={[0, 0.315, s * 0.975]} scale={[1.55, 0.018, 0.025]} />
        </group>)}
        {/* interior read through the glass: floor tub, bench seat + back, dash, wheel */}
        <mesh geometry={box} material={MAT.seam} position={[0, 0.55, 0]} scale={[1.9, 0.07, 1.24]} />
        <mesh geometry={box} material={MAT.seat} position={[-0.48, 0.80, 0]} scale={[0.52, 0.13, 1.18]} castShadow />
        <mesh geometry={sph} material={MAT.seat} position={[-0.72, 1.08, 0]} scale={[0.15, 0.38, 0.60]} />
        <mesh geometry={box} material={MAT.wood} position={[0.66, 1.06, 0]} scale={[0.10, 0.18, 1.22]} />
        <mesh geometry={steerGeo} material={MAT.leather} position={[0.50, 1.12, -0.33]} rotation={[0, Math.PI / 2, 0.35]} />
        <mesh geometry={cyl} material={MAT.leather} position={[0.60, 1.04, -0.33]} rotation={[0, 0, 1.05]} scale={[0.016, 0.24, 0.016]} />
        {/* two doors per side: seams + chrome handles + front-door hinges; hood louvers; mirrors */}
        {[-1, 1].map((s) => <group key={'d' + s}>
          {[[0.41, 0.76], [-0.53, 0.94]].map(([cx, w], di) => <group key={'door' + di}>
            <mesh geometry={box} material={MAT.seam} position={[cx, 1.16, s * 0.798]} scale={[w, 0.016, 0.012]} />
            <mesh geometry={box} material={MAT.seam} position={[cx, 0.50, s * 0.798]} scale={[w, 0.016, 0.012]} />
            <mesh geometry={box} material={MAT.seam} position={[cx - w / 2, 0.83, s * 0.798]} scale={[0.016, 0.66, 0.012]} />
            <mesh geometry={box} material={MAT.seam} position={[cx + w / 2, 0.83, s * 0.798]} scale={[0.016, 0.66, 0.012]} />
            <mesh geometry={box} material={MAT.chrome} position={[cx + w / 2 - 0.15, 1.02, s * 0.81]} scale={[0.15, 0.026, 0.03]} />
          </group>)}
          {[0.95, 0.65].map((y) => <mesh key={'hg' + y} geometry={box} material={MAT.chrome} position={[0.80, y, s * 0.80]} scale={[0.03, 0.07, 0.02]} />)}
          {[0, 1, 2, 3].map((i) => <mesh key={'lv' + i} geometry={box} material={MAT.seam} position={[1.28 + i * 0.11, 0.94, s * 0.79]} rotation={[0, 0, -0.06]} scale={[0.045, 0.17, 0.012]} />)}
          <mesh geometry={cyl} material={MAT.chrome} position={[0.86, 1.26, s * 0.80]} rotation={[Math.PI / 3, 0, 0]} scale={[0.011, 0.15, 0.011]} />
          <mesh geometry={circ} material={MAT.chrome} position={[0.86, 1.35, s * 0.86]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} scale={0.05} />
        </group>)}
        {/* TALL UPRIGHT GRILLE: chrome shell, dark recess, 9 vertical slats, rounded cap + ornament */}
        <mesh geometry={box} material={MAT.chrome} position={[2.045, 0.80, 0]} scale={[0.10, 0.52, 0.60]} castShadow />
        <mesh geometry={box} material={MAT.seam} position={[2.085, 0.79, 0]} scale={[0.05, 0.42, 0.50]} />
        {[-0.20, -0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15, 0.20].map((z) => <mesh key={'gs' + z} geometry={box} material={MAT.chrome} position={[2.115, 0.78, z]} scale={[0.025, 0.44, 0.028]} />)}
        <mesh geometry={sph} material={MAT.chrome} position={[2.045, 1.04, 0]} scale={[0.08, 0.10, 0.29]} />
        <mesh geometry={sph} material={MAT.chrome} position={[2.10, 1.17, 0]} scale={0.035} />
        {/* FREE-STANDING headlights on stalks + a chrome horn */}
        {[-1, 1].map((s) => <group key={'hl' + s}>
          <Bar a={[1.80, 0.82, s * 0.64]} b={[1.95, 1.01, s * 0.57]} r={0.022} m={MAT.chrome} />
          <mesh geometry={sph} material={MAT.chrome} position={[1.99, 1.03, s * 0.56]} scale={[0.13, 0.115, 0.115]} castShadow />
          <mesh geometry={hubRingGeo} material={MAT.chrome} position={[2.08, 1.03, s * 0.56]} rotation={[0, Math.PI / 2, 0]} scale={0.88} />
          <mesh geometry={circ} material={MAT.lens} position={[2.112, 1.03, s * 0.56]} rotation={[0, Math.PI / 2, 0]} scale={0.088} />
        </group>)}
        <mesh geometry={cyl} material={MAT.chrome} position={[2.0, 0.90, 0.30]} rotation={[0, 0, Math.PI / 2]} scale={[0.016, 0.13, 0.016]} />
        <mesh position={[2.08, 0.90, 0.30]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.045, 0.09, 12]} /><primitive object={MAT.chrome} attach="material" /></mesh>
        {/* chrome bumpers on irons, front + rear, with upright guards */}
        {[2.26, -2.24].map((x) => <group key={'bp' + x}>
          <mesh geometry={cyl} material={MAT.chrome} position={[x, 0.44, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.034, 1.55, 0.034]} castShadow />
          {[-0.45, 0.45].map((z) => <mesh key={'bi' + z} geometry={box} material={MAT.iron} position={[x - Math.sign(x) * 0.12, 0.44, z]} scale={[0.22, 0.04, 0.05]} />)}
          {[-0.40, 0.40].map((z) => <mesh key={'bg' + z} geometry={box} material={MAT.chrome} position={[x, 0.52, z]} scale={[0.04, 0.16, 0.05]} />)}
        </group>)}
        {/* SPARE WHEEL on the back + mount arm */}
        <mesh geometry={box} material={MAT.iron} position={[-2.06, 0.80, 0]} scale={[0.18, 0.06, 0.06]} />
        <group position={[-2.16, 0.46, 0]} rotation={[0, Math.PI / 2, 0]}><Wheel x={0} z={0} sp={sp} /></group>
        <mesh geometry={cyl} material={MAT.iron} position={[-2.08, 0.16, -0.48]} rotation={[0, 0, Math.PI / 2]} scale={[0.034, 0.40, 0.034]} />
        {c.driver && <group position={[-0.30, 0, -0.3]}>
          <mesh geometry={sph} material={MAT.skin} position={[0, 1.32, 0]} scale={[0.15, 0.17, 0.15]} />
          <mesh geometry={cyl} material={bodyMat(c.driver)} position={[0, 1.46, 0]} scale={[0.13, 0.1, 0.13]} /><mesh geometry={cyl} material={bodyMat(c.driver)} position={[0, 1.42, 0]} scale={[0.22, 0.02, 0.22]} />
          <mesh geometry={box} material={bodyMat(c.driver)} position={[0, 1.02, 0]} scale={[0.3, 0.36, 0.4]} /></group>}
      </group>
    </group>
  );
};

/** Park-O-Meter on a post: flag 0..1 = red "expired" flag up; coin 0..1 = nickel dropping into the slot; rise 0..1 = pop-in */
export const Meter: React.FC<{c: MeterP}> = ({c}) => {
  const fl = c.flag ?? 0, r = c.rise ?? 1;
  return (
    <group position={c.p} scale={[1, r, 1]}>
      <mesh geometry={circ} material={MAT.blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={0.22} />
      <mesh geometry={taper} material={MAT.iron} position={[0, 0.55, 0]} scale={[0.042, 1.1, 0.042]} castShadow />
      <mesh geometry={flare} material={MAT.iron} position={[0, 0.05, 0]} scale={[0.085, 0.1, 0.085]} castShadow />
      <group position={[0, 1.22, 0]}>
        <mesh geometry={box} material={MAT.meterHead} scale={[0.22, 0.28, 0.16]} castShadow />
        <mesh geometry={cyl} material={MAT.meterHead} position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.11, 0.16, 0.11]} castShadow />
        <mesh geometry={plane} material={MAT.face} position={[0, 0.02, 0.0805]} scale={[0.2, 0.26, 1]} />
        <mesh geometry={plane} material={MAT.face} position={[0, 0.02, -0.0805]} rotation={[0, Math.PI, 0]} scale={[0.2, 0.26, 1]} />
        <mesh geometry={box} material={MAT.iron} position={[0.0, 0.0, 0.083]} rotation={[0, 0, -1.2 + 2.0 * (1 - fl) * (c.coin !== undefined ? Math.min(1, c.coin * 1.4) : 1) * (fl > 0 ? 0 : 1)]} scale={[0.006, 0.07, 0.004]} />
        <mesh geometry={box} material={MAT.chrome} position={[0.07, 0.1, 0.0]} scale={[0.04, 0.012, 0.03]} />
        {[-0.085, 0.085].map((bx) => [-0.105, 0.105].map((by) => <mesh key={bx + '_' + by} geometry={cyl} material={MAT.chrome} position={[bx, by, 0.082]} rotation={[Math.PI / 2, 0, 0]} scale={[0.009, 0.012, 0.009]} />))}
        {fl > 0.01 && <group position={[0.0, -0.02, 0]} rotation={[0, 0, -Math.PI / 2 * (1 - fl)]} scale={0.3 + 0.7 * Math.min(1, fl * 1.6)}>
          <mesh geometry={box} material={MAT.flag} position={[0, 0.17, 0.09]} scale={[0.012, 0.18, 0.012]} />
          <mesh geometry={box} material={MAT.flag} position={[0.05, 0.24, 0.09]} scale={[0.1, 0.07, 0.006]} />
        </group>}
        {c.coin !== undefined && c.coin > 0 && c.coin < 1 && <mesh geometry={plane} material={MAT.coin} position={[0.07, 0.34 - c.coin * 0.24, 0.02]} rotation={[0, Math.PI / 2 - 0.3, 0]} scale={0.06} />}
      </group>
    </group>
  );
};

// ---------- V5 HORSE: real horse anatomy in the kit's toon grammar ----------
// V5 (round 2): round 1's volumetric horse did not REGISTER on a phone — same colour, same
// capsule surfaces, short tube muzzle. Now: real proportions (LONG head ~ neck length, fine
// tapered muzzle, crested neck, withers + dipped back + rounded croup, muscle masses),
// tapered legs with bay BLACK POINTS + white front socks + a white BLAZE, strand mane,
// thick layered tail, satin coat material. Poses: stand / walk (diagonal gait, head bobbing
// low) / startle (head high, ears pinned, one foreleg raised, weight rocked back).
const coatT = typeof document === 'undefined' ? null : drawCoat();
const faceT = typeof document === 'undefined' ? null : drawFace();
// V5: high-segment sphere for the horse only — at proof size the shared 16x12 sphere facets
const sphH = new THREE.SphereGeometry(1, 28, 20);
type HorseP = NonNullable<Things['horse']>;
const HL: React.FC<{front: boolean; side: 1 | -1; sw: number; flex: number; m: any; dark: any; hoof: any; white: any; mane: any; sock?: boolean}> = ({front, side, sw, flex, m, dark, hoof, white, mane, sock}) => (
  // V5 LEG: real taper — thick muscle upper (shoulder/thigh blend mass) -> slim DARK cannon
  // (bay black points) -> fetlock -> short pastern -> hoof. Optional white SOCK on the lower
  // cannon + pastern. Pivot at shoulder/hip; front knee folds the cannon BACK, hind hock
  // folds it FORWARD (opposite signs, as a real leg does).
  <group position={[front ? 0.60 : -0.60, front ? 1.06 : 1.08, side * (front ? 0.26 : 0.27)]} rotation={[0, 0, sw + (front ? 0 : 0.30)]}>
    <mesh geometry={sphH} material={m} position={[0, -0.03, 0]} scale={front ? [0.175, 0.27, 0.15] : [0.25, 0.31, 0.19]} />
    <mesh position={[0, -0.24, 0]} castShadow><capsuleGeometry args={[front ? 0.105 : 0.14, 0.27, 6, 12]} /><primitive object={m} attach="material" /></mesh>
    <group position={[0, front ? -0.50 : -0.52, 0]} rotation={[0, 0, (front ? -1 : 1) * flex + (front ? 0 : -0.38)]}>
      <mesh position={[0, -0.11, 0]} castShadow><capsuleGeometry args={[0.052, 0.12, 6, 10]} /><primitive object={dark} attach="material" /></mesh>
      <mesh position={[0, -0.27, 0]} castShadow><capsuleGeometry args={[0.051, 0.12, 6, 10]} /><primitive object={sock ? white : dark} attach="material" /></mesh>
      <mesh geometry={sphH} material={sock ? white : dark} position={[0, -0.385, 0]} scale={[0.056, 0.05, 0.056]} />
      <mesh position={[-0.052, -0.375, 0]} rotation={[0, 0, 0.55]} castShadow><capsuleGeometry args={[0.020, 0.055, 4, 8]} /><primitive object={mane} attach="material" /></mesh>
      <mesh position={[0.008, -0.435, 0]} castShadow><cylinderGeometry args={[0.047, 0.052, 0.08, 12]} /><primitive object={sock ? white : dark} attach="material" /></mesh>
      <mesh position={[0.014, -0.512, 0]} castShadow><cylinderGeometry args={[0.054, 0.068, 0.095, 12]} /><primitive object={hoof} attach="material" /></mesh>
    </group>
  </group>
);
export const Horse: React.FC<{h: HorseP; f: number}> = ({h, f}) => {
  const pose = h.pose ?? 'stand', coat = h.coat ?? '#6e3517';   // V5: deep warm BAY (was orange-brown)
  const M = useMemo(() => {
    const c = new THREE.Color(coat), dk = c.clone().multiplyScalar(0.30);   // black-brown points
    // V5 COAT MATERIAL: satin standard material (roughness 0.52 + env) so the kit sun rakes a
    // soft sheen band along the barrel/neck — round 1's flat toon coat read as plastic.
    return {coat: new THREE.MeshStandardMaterial({color: c, map: coatT ?? undefined, roughness: 0.58, metalness: 0.0, envMapIntensity: 0.35}),
      dark: new THREE.MeshStandardMaterial({color: dk, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.3}),
      face: new THREE.MeshStandardMaterial({color: c, map: faceT ?? undefined, roughness: 0.58, metalness: 0.0, envMapIntensity: 0.35}),
      muzzle: new THREE.MeshStandardMaterial({color: '#4f3a26', roughness: 0.6, metalness: 0.0, envMapIntensity: 0.35}),
      mane: lookToon({color: '#2a1709'}), leather: lookToon({color: '#4a2c17'}), leatherD: lookToon({color: '#2e1a0e'}),
      hoof: lookMetal({color: '#3b352f', rough: 0.5}), eye: new THREE.MeshStandardMaterial({color: '#17101a', roughness: 0.22, metalness: 0.1}),
      white: lookToon({color: '#f7f2e7'})};
  }, [coat]);
  const ry = h.ry ?? (h.dir === -1 ? Math.PI / 2 : -Math.PI / 2);
  const ph = h.phase ?? 2.2;
  const walk = pose === 'walk', startle = pose === 'startle';
  const bobY = (h.bob ?? 0) + (walk ? Math.abs(Math.sin(ph)) * 0.026 : Math.sin(f * 0.045) * 0.006);   // gait bounce / breathing
  // neck pivot rotation.z (leans the +Y neck toward +X); walking head bobs low-forward on the stride
  const neckA = (startle ? -0.34 : walk ? -0.98 : -0.74) + (walk ? 0.05 * Math.sin(ph) : 0);
  const headA = startle ? 0.38 : walk ? 0.97 : 0.80;          // head counter-rotation: muzzle forward-down
  const earA = startle ? 0.70 : 0.10;                        // ears pinned flat back when startled
  const sw = (o: number) => walk ? 0.40 * Math.sin(ph + o) : 0;
  const flex = (o: number, front: boolean) => walk ? (front ? 0.85 : 0.65) * Math.pow(Math.max(0, Math.sin(ph + o - 0.55)), 1.2) : startle ? (front ? 0.05 : 0.12) : 0.03;
  // bit position in root space, computed through the real neck+head transforms (for the reins):
  // neck pivot NP, head group at neck-local (0.03, 0.92), bit at head-local (0.30, -0.20)
  const NP: V3 = [0.68, 1.44, 0];
  const cN = Math.cos(neckA), sN = Math.sin(neckA), A = neckA + headA, cA = Math.cos(A), sA = Math.sin(A);
  const HO: V3 = [NP[0] + 0.03 * cN - 0.92 * sN, NP[1] + 0.03 * sN + 0.92 * cN, 0];
  const BP: V3 = [HO[0] + 0.34 * cA + 0.22 * sA, HO[1] + 0.34 * sA - 0.22 * cA, 0];
  const tailSw = Math.sin(f * (startle ? 0.35 : 0.06)) * (startle ? 0.22 : 0.10);
  return (
    <group position={[h.p[0], h.p[1] ?? 0, h.p[2]]} rotation={[0, ry, 0]}>
      <mesh geometry={circ} material={MAT.blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} scale={[1.35, 0.55, 1]} />
      <group position={[startle ? -0.09 : 0, bobY, 0]} rotation={[0, 0, startle ? 0.075 : walk ? 0.012 * Math.sin(ph * 2) : 0]}>
        {/* V5 BODY: barrel + deep chest + shoulder mass + hindquarters + rounded croup +
            withers — the top line now dips through the back and rises at both ends */}
        <mesh position={[0, 1.25, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.92]} castShadow><capsuleGeometry args={[0.45, 0.58, 8, 20]} /><primitive object={M.coat} attach="material" /></mesh>
        <mesh geometry={sphH} material={M.coat} position={[0.58, 1.25, 0]} scale={[0.45, 0.50, 0.42]} castShadow />
        <mesh geometry={sphH} material={M.coat} position={[0.60, 1.02, 0]} scale={[0.30, 0.40, 0.38]} castShadow />
        <mesh geometry={sphH} material={M.coat} position={[-0.58, 1.26, 0]} scale={[0.50, 0.51, 0.45]} castShadow />
        <mesh geometry={sphH} material={M.coat} position={[-0.80, 1.40, 0]} scale={[0.32, 0.27, 0.38]} castShadow />
        <mesh geometry={sphH} material={M.coat} position={[0.50, 1.60, 0]} scale={[0.30, 0.17, 0.28]} castShadow />
        {/* neck, pivoted at the chest: thick base, clean throat, a proud CREST along the top line */}
        <group position={NP} rotation={[0, 0, neckA]}>
          <mesh position={[0, 0.40, 0]} castShadow><cylinderGeometry args={[0.145, 0.29, 0.92, 14]} /><primitive object={M.coat} attach="material" /></mesh>
          <mesh geometry={sphH} material={M.coat} position={[0, 0.02, 0]} scale={[0.30, 0.26, 0.26]} />
          <mesh geometry={sphH} material={M.coat} position={[-0.125, 0.42, 0]} scale={[0.125, 0.50, 0.14]} />
          {/* mane: individual layered LOCKS falling on the near side of the crest */}
          {Array.from({length: 7}, (_, i) => <group key={'mn' + i}>
            <mesh position={[-0.20 - (i % 2) * 0.012, 0.12 + i * 0.115, 0.115]} rotation={[0.10, 0, 0.22 + (i % 3) * 0.05]} castShadow><capsuleGeometry args={[0.030, 0.16 + (i % 3) * 0.045, 4, 8]} /><primitive object={M.mane} attach="material" /></mesh>
            {i % 2 === 0 && <mesh position={[-0.175, 0.10 + i * 0.115, 0.15]} rotation={[0.16, 0, 0.30]} castShadow><capsuleGeometry args={[0.024, 0.11, 4, 8]} /><primitive object={M.mane} attach="material" /></mesh>}
          </group>)}
          {/* head */}
          {/* V5 HEAD: LONG like a real horse (head ~ neck length) — broad forehead tapering
              down a long face to a fine muzzle. The round-1 tube/boxy muzzle is gone. */}
          <group position={[0.03, 0.92, 0]} rotation={[0, 0, headA]} scale={[1.12, 1.12, 1.12]}>
            <mesh geometry={sphH} material={M.coat} position={[0.02, 0.03, 0]} scale={[0.25, 0.225, 0.185]} castShadow />
            <mesh geometry={sphH} material={M.coat} position={[0.13, -0.11, 0]} scale={[0.18, 0.13, 0.145]} />
            <mesh geometry={sphH} material={M.coat} position={[0.20, 0.0, 0]} scale={[0.14, 0.12, 0.13]} />
            <mesh position={[0.41, -0.15, 0]} rotation={[0, 0, -1.979]} castShadow><cylinderGeometry args={[0.088, 0.148, 0.58, 14]} /><primitive object={M.face} attach="material" /></mesh>
            {/* white BLAZE: painted into the face texture (drawFace) — hugs the surface */}
            <mesh geometry={sphH} material={M.muzzle} position={[0.665, -0.255, 0]} scale={[0.105, 0.088, 0.098]} castShadow />
            <mesh geometry={sphH} material={M.muzzle} position={[0.585, -0.335, 0]} scale={[0.065, 0.03, 0.055]} />
            <mesh geometry={box} material={M.leatherD} position={[0.63, -0.315, 0]} rotation={[0, 0, -0.15]} scale={[0.15, 0.013, 0.185]} />
            {[1, -1].map((s) => <group key={'hd' + s}>
              <mesh geometry={sphH} material={M.leatherD} position={[0.715, -0.235, s * 0.048]} scale={startle ? [0.044, 0.032, 0.038] : [0.034, 0.024, 0.030]} />
              {startle && <mesh geometry={sphH} material={M.white} position={[0.125, 0.055, s * 0.150]} scale={0.038} />}
              <mesh geometry={sphH} material={M.eye} position={[0.13, 0.055, s * 0.160]} scale={startle ? 0.030 : 0.034} />
              <mesh geometry={sphH} material={M.white} position={[0.143, 0.072, s * 0.182]} scale={0.010} />
              <group position={[-0.075, 0.225, s * 0.095]} rotation={[s * (startle ? 0.55 : 0.28), s * 0.15, earA]}>
                <mesh position={[0, 0.085, 0]} castShadow><coneGeometry args={[0.065, 0.22, 10]} /><primitive object={M.coat} attach="material" /></mesh>
                <mesh position={[0.016, 0.06, 0]}><coneGeometry args={[0.034, 0.14, 8]} /><primitive object={M.dark} attach="material" /></mesh>
              </group>
              <Bar a={[0.08, 0.03, s * 0.168]} b={[0.36, -0.20, s * 0.135]} r={0.012} m={M.leather} />
              <mesh key={'bit' + s} geometry={hubRingGeo} material={MAT.chrome} position={[0.35, -0.215, s * 0.125]} scale={0.36} />
            </group>)}
            {/* forelock: short locks tumbling between the ears */}
            {[-0.05, 0, 0.05].map((z, i) => <mesh key={'fl' + i} position={[-0.03, 0.17, z]} rotation={[0, 0, -0.5]} castShadow><capsuleGeometry args={[0.022, 0.09, 4, 8]} /><primitive object={M.mane} attach="material" /></mesh>)}
            {/* bridle: noseband (tilted with the face) + headstall ring */}
            <group position={[0.57, -0.235, 0]} rotation={[0, 0, -0.408]}>
              <mesh geometry={hubRingGeo} material={M.leather} rotation={[0, Math.PI / 2, 0]} scale={[1.0, 1.0, 1.4]} />
            </group>
            <mesh geometry={hubRingGeo} material={M.leather} position={[0.06, 0.02, 0]} rotation={[0, Math.PI / 2, 0]} scale={[2.05, 2.12, 1.4]} />
          </group>
        </group>
        {/* legs: diagonal pairs (FL+HR / FR+HL). STARTLE: near foreleg RAISED + folded
            (pawing), far foreleg braced forward, hind legs rocked back — alarm in a still */}
        <HL front side={1} sw={startle ? 0.85 : sw(0)} flex={startle ? 1.50 : flex(0, true)} m={M.coat} dark={M.dark} hoof={M.hoof} white={M.white} mane={M.mane} sock />
        <HL front={false} side={-1} sw={startle ? -0.30 : sw(0)} flex={flex(0, false)} m={M.coat} dark={M.dark} hoof={M.hoof} white={M.white} mane={M.mane} />
        <HL front side={-1} sw={startle ? 0.34 : sw(Math.PI)} flex={flex(Math.PI, true)} m={M.coat} dark={M.dark} hoof={M.hoof} white={M.white} mane={M.mane} sock />
        <HL front={false} side={1} sw={startle ? -0.30 : sw(Math.PI)} flex={flex(Math.PI, false)} m={M.coat} dark={M.dark} hoof={M.hoof} white={M.white} mane={M.mane} />
        {/* V5 TAIL: thick at the dock, long, strand-layered, reaching toward the hocks */}
        <group position={[-1.06, 1.52, 0]} rotation={[tailSw, 0, startle ? 0.20 : 0.50]}>
          <mesh position={[0, -0.15, 0]} castShadow><capsuleGeometry args={[0.078, 0.24, 6, 10]} /><primitive object={M.mane} attach="material" /></mesh>
          {[1, -1].map((s) => <mesh key={'ts' + s} position={[0, -0.18, s * 0.05]} rotation={[s * 0.18, 0, 0.05]} castShadow><capsuleGeometry args={[0.028, 0.30, 4, 8]} /><primitive object={M.mane} attach="material" /></mesh>)}
          <group position={[0, -0.30, 0]} rotation={[0, 0, 0.12]}>
            <mesh position={[0, -0.16, 0]} castShadow><capsuleGeometry args={[0.060, 0.26, 6, 10]} /><primitive object={M.mane} attach="material" /></mesh>
            <group position={[0, -0.34, 0]} rotation={[0, 0, 0.10]}>
              <mesh position={[0, -0.14, 0]} castShadow><capsuleGeometry args={[0.044, 0.22, 6, 10]} /><primitive object={M.mane} attach="material" /></mesh>
            </group>
          </group>
        </group>
        {/* harness: saddle pad + girth, breast collar, breeching, reins to the bit */}
        <mesh geometry={box} material={M.leather} position={[0.02, 1.685, 0]} scale={[0.36, 0.05, 0.42]} castShadow />
        <mesh geometry={hubRingGeo} material={M.leather} position={[0.02, 1.21, 0]} rotation={[0, Math.PI / 2, 0]} scale={[3.7, 4.2, 1.7]} />
        <mesh geometry={hubRingGeo} material={M.leather} position={[0.64, 1.28, 0]} rotation={[0, Math.PI / 2, 0.25]} scale={[3.2, 3.6, 1.8]} />
        <mesh geometry={hubRingGeo} material={M.leather} position={[-0.68, 1.24, 0]} rotation={[0, Math.PI / 2, 0]} scale={[3.9, 4.25, 1.7]} />
        {[1, -1].map((s) => <group key={'rn' + s}>
          <Bar a={[BP[0], BP[1], s * 0.135]} b={[0.52, 1.52, s * 0.20]} r={0.011} m={M.leather} />
          <mesh geometry={sphH} material={MAT.chrome} position={[0.30, 1.60, s * 0.30]} scale={0.020} />
        </group>)}
        {/* optional two-wheel cart on shafts aligned to the harness */}
        {h.cart && <group>
          {[1, -1].map((s) => <Bar key={'sh' + s} a={[-0.45, 1.06, s * 0.30]} b={[-2.28, 0.92, s * 0.30]} r={0.028} m={MAT.wood} />)}
          <group position={[-3.0, 0, 0]}>
            <mesh geometry={box} material={MAT.wood} position={[0, 0.92, 0]} scale={[1.35, 0.07, 1.05]} castShadow />
            {[1, -1].map((s) => <group key={'ct' + s}>
              <mesh geometry={box} material={MAT.wood} position={[0, 1.10, s * 0.50]} scale={[1.35, 0.30, 0.045]} />
              <mesh geometry={box} material={MAT.wood} position={[-0.65, 1.10, 0]} scale={[0.045, 0.30, 1.05]} />
              <group position={[0, 0.56, s * 0.60]} rotation={[0, 0, 0]}>
                <mesh geometry={new THREE.TorusGeometry(0.55, 0.042, 10, 28)} material={M.leatherD} castShadow />
                {Array.from({length: 8}, (_, i) => { const a = (i / 8) * Math.PI * 2; return <mesh key={i} geometry={cyl} material={MAT.wood} position={[Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0]} rotation={[0, 0, a + Math.PI / 2]} scale={[0.026, 0.52, 0.026]} />; })}
                <mesh geometry={cyl} material={M.leatherD} rotation={[Math.PI / 2, 0, 0]} scale={[0.09, 0.07, 0.09]} />
              </group>
            </group>)}
            <mesh geometry={cyl} material={M.leatherD} position={[0, 0.56, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.035, 1.24, 0.035]} />
            <mesh geometry={circ} material={MAT.blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.545, 0]} scale={[1.1, 0.8, 1]} />
          </group>
        </group>}
      </group>
    </group>
  );
};

export const ThingsView: React.FC<{t: Things; f: number; cam: THREE.Vector3}> = ({t, f, cam}) => {
  const face = (p: V3) => Math.atan2(cam.x - p[0], cam.z - p[2]);
  return (<>
    {t.table && <group position={t.table.p} scale={t.table.k ?? 1}>
      <mesh geometry={circ} material={MAT.blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={0.8} /><group position={[0, t.table.lift ?? 0, 0]}>
      <mesh geometry={box} material={MAT.cloth} position={[0, 0.74, 0]} scale={[0.9, 0.04, 0.9]} castShadow />
      {[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([x, z], i) => <mesh key={i} geometry={box} material={MAT.wood} position={[x, 0.37, z]} scale={[0.04, 0.74, 0.04]} />)}
      </group>{[[0, 0.75], [0.75, 0], [0, -0.75], [-0.75, 0]].map(([x, z], i) => (t.table!.chairs ?? [0, 1, 2, 3]).includes(i) && <group key={'c' + i} position={[x, 0, z]} rotation={[0, Math.atan2(-x, -z), 0]}>
        <mesh geometry={box} material={MAT.wood} position={[0, 0.45, 0]} scale={[0.42, 0.04, 0.4]} castShadow />
        <mesh geometry={box} material={MAT.wood} position={[0, 0.72, -0.19]} scale={[0.42, 0.5, 0.04]} castShadow />
        {[[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]].map(([a, b], j) => <mesh key={j} geometry={box} material={MAT.wood} position={[a, 0.22, b]} scale={[0.03, 0.45, 0.03]} />)}
      </group>)}
      {(t.table.lift ?? 0) === 0 && Array.from({length: 7}, (_, i) => <mesh key={'k' + i} geometry={plane} material={MAT.card} position={[Math.cos(i * 1.7) * 0.22, 0.765 + i * 0.001, Math.sin(i * 2.3) * 0.22]} rotation={[-Math.PI / 2, 0, i * 0.9]} scale={[0.09, 0.13, 1]} />)}
    </group>}
    {t.horse && <Horse h={t.horse} f={f} />}
    {t.horse?.rope && (() => { const h = t.horse!, ry = h.ry ?? (h.dir === -1 ? Math.PI / 2 : -Math.PI / 2);
      const end: V3 = [h.p[0] + Math.cos(ry) * 1.52, 1.80 + (h.bob ?? 0), h.p[2] - Math.sin(ry) * 1.52];
      return <ThingsView t={{rope: [h.rope!, end]}} f={f} cam={cam} />; })()}
    {t.paper && (() => { const u = Math.min(1, t.paper.t), s = 0.15 + 0.85 * (1 - Math.pow(1 - u, 3));
      return <mesh geometry={plane} material={MAT.paper} position={t.paper.p} rotation={[0, (t.paper.ry ?? 0) + (1 - u) * 9.4, (1 - u) * 1.2]} scale={[0.8 * s, 1.0 * s, 1]} />; })()}
    {t.bulb && t.bulb.k > 0 && <mesh geometry={plane} material={MAT.bulb} position={t.bulb.p} rotation={[0, face(t.bulb.p), 0]} scale={0.5 * t.bulb.k} />}
    {t.rope && (() => { const a = new THREE.Vector3(...t.rope[0]), b = new THREE.Vector3(...t.rope[1]), m = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.12, 0));
      return [[a, m], [m, b]].map(([p, q], i) => { const d = q.clone().sub(p), L = d.length(); return <mesh key={'r' + i} geometry={cyl} material={MAT.rope} position={p.clone().lerp(q, 0.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())} scale={[0.012, L, 0.012]} />; }); })()}
    {t.ticket && <mesh geometry={plane} material={MAT.ticket} position={t.ticket.p} rotation={[0, t.ticket.ry ?? face(t.ticket.p), 0]} scale={[0.14 * (t.ticket.s ?? 1), 0.21 * (t.ticket.s ?? 1), 1]} />}
    {t.placards?.map((q, i) => <group key={'pl' + i} position={q.p} rotation={[0, face(q.p), q.tilt ?? Math.sin(f * 0.25 + i) * 0.12]}>
      <mesh geometry={box} material={MAT.stick} position={[0, -0.45, -0.01]} scale={[0.04, 0.9, 0.02]} />
      <mesh geometry={plane} material={placardMat(q.text)} scale={[0.7, 0.35, 1]} />
    </group>)}
    {t.coins?.map((c, i) => Array.from({length: c.n}, (_, j) => <mesh key={i + '_' + j} geometry={plane} material={MAT.coin} position={[c.p[0] + (j - (c.n - 1) / 2) * 0.05, c.p[1] + Math.sin(c.t * 6 + j) * 0.01, c.p[2]]} rotation={[0, face(c.p), 0]} scale={0.05} />))}
  </>);
};
