// BASIC look for the free kit: flat toon materials + one simple light rig + plain sky.
// (The premium light/colour/grade layer is NOT included — this file only makes the engine run and look clean.)
import * as THREE from 'three';

/** experiment switch kept for compatibility (always off in the kit) */
export const X = (_k: string) => false;
export const V5 = false;
export type Tod = 'day' | 'golden' | 'workshop' | 'indoor';

/** 5-step toon ramp (V3): shadow / low-mid / mid / high-mid / lit — smoother falloff, less banding */
export const LOOK_RAMP = (() => {
  const d = new Uint8Array([96, 96, 118, 255, 138, 138, 158, 255, 178, 178, 190, 255, 218, 218, 224, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 5, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();

/** one simple rig: warm key sun from the front-side (~40° up), cool sky fill, a little ambient */
export const LOOK_LIGHT = {sun: '#fff3e0', sunI: 3.5, sunOff: [8, 9, 7] as [number, number, number], skyFill: '#a9c4ee', groundFill: '#c9a983', hemiI: 0.9, amb: '#ffffff', ambI: 0.25};

type Sky = {stops: [number, string][]; cap: string; skyline: [string, string]; cloud: string; cloudShade: string; glow?: [number, string]};
const SKY: Sky = {stops: [[0, '#4a86d8'], [0.6, '#9cc4ee'], [1, '#e8eff4']], cap: '#4a86d8', skyline: ['rgba(160,184,220,.7)', 'rgba(140,164,206,.75)'], cloud: 'rgba(255,255,255,.95)', cloudShade: 'rgba(170,182,220,.45)'};
export const LOOK_SKY: Record<Tod, Sky> = {day: SKY, golden: SKY, workshop: SKY, indoor: SKY};

/** colours are used as given (no harmonising) */
export const lookPal = (c: string) => c;
export const lookColor = (c: THREE.ColorRepresentation) => new THREE.Color(c);
export const lookHex = (c: string) => '#' + new THREE.Color(c).getHexString();
export const lookToon = (o: THREE.MeshToonMaterialParameters, _gloss = 0) => new THREE.MeshToonMaterial({...o, gradientMap: LOOK_RAMP});

/** V3 gloss layer — real specular response for the objects that are glossy in life.
    Needs the scene environment set by render/Video.tsx; toon materials ignore it. */
/** glossy paint: clearcoat over a satin base — highlight streak + env reflection */
export const lookPaint = (o: {color: THREE.ColorRepresentation; map?: THREE.Texture}) => new THREE.MeshPhysicalMaterial({color: lookColor(o.color), map: o.map, roughness: 0.48, metalness: 0.0, clearcoat: 0.85, clearcoatRoughness: 0.22, envMapIntensity: 0.45});
/** chrome trim: full metal, low roughness — mirrors the environment */
export const lookChrome = (o: {color?: THREE.ColorRepresentation} = {}) => new THREE.MeshStandardMaterial({color: lookColor(o.color ?? '#e9edf4'), metalness: 1.0, roughness: 0.16, envMapIntensity: 1.4});
/** window glass: near-mirror smooth surface, slight blue body, see-through */
export const lookGlass = (o: {color?: THREE.ColorRepresentation; opacity?: number} = {}) => new THREE.MeshPhysicalMaterial({color: lookColor(o.color ?? '#6ea8dc'), transparent: true, opacity: o.opacity ?? 0.34, roughness: 0.08, metalness: 0.0, envMapIntensity: 0.9, side: THREE.DoubleSide});
/** painted metal (poles, signal heads): semi-metal so edges catch a highlight */
export const lookMetal = (o: {color: THREE.ColorRepresentation; rough?: number}) => new THREE.MeshStandardMaterial({color: lookColor(o.color), metalness: 0.55, roughness: o.rough ?? 0.45, envMapIntensity: 0.8});
/** rubber (tyres, running boards): dead matte, bump carries the detail */
export const lookRubber = (o: {color?: THREE.ColorRepresentation; map?: THREE.Texture; bump?: THREE.Texture}) => new THREE.MeshStandardMaterial({color: lookColor(o.color ?? '#2a2730'), roughness: 0.95, metalness: 0.0, map: o.map, bumpMap: o.bump, bumpScale: 0.6});

/** ground colours + shadow-map size used by the kits */
export const LOOK_PREM = {shadow: {extent: 20, mapSize: 2048, dist: 40, far: 90}, asphalt: '#5c5e6c', sidewalk: '#b9b3a8'};
export const todAt = (_f: number): Tod => 'day';
