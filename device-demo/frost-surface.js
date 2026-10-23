import * as THREE from './vendor/three.module.js';

// Shared device-space coordinates keep the front continuous across panels,
// independent of UV islands, camera movement and the scroll rotation.
const frostFragment = /* glsl */`
uniform sampler2D uFrostHeight;
uniform float uFrostProgress;
uniform float uFrostMelt;
uniform float uFrostRelief;
uniform float uFrostLidMask;
uniform vec3 uFrostMin;
uniform vec3 uFrostMax;
varying vec3 vFrostPosition;
varying vec3 vFrostNormal;

float frostHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float frostNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(frostHash(i), frostHash(i + vec3(1,0,0)), f.x),
                 mix(frostHash(i + vec3(0,1,0)), frostHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(frostHash(i + vec3(0,0,1)), frostHash(i + vec3(1,0,1)), f.x),
                 mix(frostHash(i + vec3(0,1,1)), frostHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 frostWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(8.0));
  return w / max(dot(w, vec3(1.0)), 0.0001);
}
float frostDetail(vec2 uv) {
  // Two differently oriented scales, with slow domain warping: no repeated
  // rows of identical fern stamps. Both layers remain fixed to the metal.
  vec2 warp = vec2(sin(uv.y * 2.7 + sin(uv.x * 1.9)),
                   sin(uv.x * 3.1 - cos(uv.y * 2.3))) * 0.11;
  vec2 q = uv + warp;
  float large = texture2D(uFrostHeight, mat2(0.84, 0.54, -0.54, 0.84) * q * 0.62).r;
  float fine = texture2D(uFrostHeight, mat2(0.36, -0.93, 0.93, 0.36) * q * 2.9 + vec2(0.27, 0.61)).r;
  float blend = smoothstep(0.2, 0.8, frostNoise(vec3(uv * 1.3, 8.2)));
  return mix(fine, large, mix(0.50, 0.85, blend));
}
float frostHeightAt(vec3 p, vec3 w) {
  return dot(vec3(frostDetail(p.yz), frostDetail(p.xz), frostDetail(p.xy)), w);
}
float frostEdgeCoverage(float along, float depth, float halfWidth, float edgeLength, float seed, float reach, float warp) {
  // Keep the same nuclei across the entire edge. A moving five-cell window
  // dropped still-active nuclei at floor(along / spacing), cutting a straight
  // line through a single growing front, even before opposite fronts met.
  const float spacing = 0.58;
  int lastNucleus = int(floor(edgeLength / spacing)) + 2;
  float uncovered = 1.0;
  for (int i = -2; i <= lastNucleus; i++) {
    float id = float(i);
    float h = frostHash(vec3(id, seed, 1.7));
    float h2 = frostHash(vec3(id, seed, 9.1));
    float origin = (id + 0.15 + h * 0.7) * spacing;
    float bend = sin(depth * (4.0 + h2 * 4.0) + h * 18.0) * depth * 0.16;
    float side = (along - origin + bend) * mix(0.8, 2.8, h2);
    float distanceFromSeed = length(vec2(depth, side));
    float speed = mix(0.48, 1.85, h * h);
    float onset = mix(0.02, 0.24, h2);
    float arrival = onset + distanceFromSeed / (max(halfWidth, 0.3) * speed) + warp;
    float front = 1.0 - smoothstep(reach - 0.07, reach + 0.10, arrival);
    uncovered *= 1.0 - front;
  }
  return 1.0 - uncovered;
}
float frostFaceCoverage(vec2 p, vec2 size, float seed, float reach, float warp) {
  float frontA = frostEdgeCoverage(p.x, p.y, size.y * 0.5, size.x, seed, reach, warp);
  float frontB = frostEdgeCoverage(p.x, size.y - p.y, size.y * 0.5, size.x, seed + 4.7, reach, warp);
  float frontC = frostEdgeCoverage(p.y, p.x, size.x * 0.5, size.y, seed + 12.3, reach, warp);
  float frontD = frostEdgeCoverage(p.y, size.x - p.x, size.x * 0.5, size.y, seed + 19.8, reach, warp);
  return 1.0 - (1.0 - frontA) * (1.0 - frontB) * (1.0 - frontC) * (1.0 - frontD);
}
float frostCoverage(vec3 p, vec3 w, float reach, float warp, float cornerBoost) {
  vec3 size = max(uFrostMax - uFrostMin, vec3(0.0001));
  vec3 q = clamp(p - uFrostMin, vec3(0.0), size);
  float coverage = 0.0;
  float boostedReach = reach + cornerBoost;
  // Avoid evaluating the other two faces on flat panels.
  if (w.x > 0.001) coverage += w.x * frostFaceCoverage(q.yz, size.yz, 2.1 + step(size.x * 0.5, q.x) * 3.2, boostedReach, warp);
  if (w.y > 0.001) coverage += w.y * frostFaceCoverage(q.xz, size.xz, 8.4 + step(size.y * 0.5, q.y) * 3.2, boostedReach, warp);
  if (w.z > 0.001) coverage += w.z * frostFaceCoverage(q.xy, size.xy, 14.7 + step(size.z * 0.5, q.z) * 3.2, boostedReach, warp);
  return clamp(coverage, 0.0, 1.0);
}
vec2 frostEdgeDistances(vec3 p, vec3 w) {
  vec3 size = max(uFrostMax - uFrostMin, vec3(0.0001));
  vec3 d = max(min(p - uFrostMin, uFrostMax - p) / size, vec3(0.0)) * 2.0;
  // Ignore distance through the face thickness: only its two surface axes
  // determine arrival. The second distance identifies physical corners.
  return vec2(dot(vec3(min(d.y,d.z), min(d.x,d.z), min(d.x,d.y)), w),
              dot(vec3(max(d.y,d.z), max(d.x,d.z), max(d.x,d.y)), w));
}
`;

export function attachFrostMaterial(material, heightMap, bounds, toDevice, states, isLid = false) {
  material.bumpMap = heightMap;
  material.bumpScale = 0.04;
  const state = { progress: 0, uniform: { value: 0 }, meltUniform: { value: 0 }, shader: null };
  states.set(material, state);
  material.onBeforeCompile = shader => {
    state.shader = shader;
    Object.assign(shader.uniforms, {
      uFrostHeight: { value: heightMap },
      uFrostProgress: state.uniform,
      uFrostMelt: state.meltUniform,
      uFrostRelief: { value: material.bumpScale },
      uFrostLidMask: { value: isLid ? 1 : 0 },
      uFrostMin: { value: bounds.min },
      uFrostMax: { value: bounds.max },
      uFrostToDevice: { value: toDevice },
      uFrostNormalToDevice: { value: new THREE.Matrix3().getNormalMatrix(toDevice) }
    });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
uniform mat4 uFrostToDevice;
uniform mat3 uFrostNormalToDevice;
varying vec3 vFrostPosition;
varying vec3 vFrostNormal;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vFrostPosition = (uFrostToDevice * vec4(position, 1.0)).xyz;
vFrostNormal = normalize(uFrostNormalToDevice * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + frostFragment)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
vec3 frostW = frostWeights(normalize(vFrostNormal));
float crystalHeight = frostHeightAt(vFrostPosition, frostW);
vec2 frostEdges = frostEdgeDistances(vFrostPosition, frostW);
float corner = 1.0 - smoothstep(0.025, 0.26, frostEdges.y);
float colony = frostNoise(vFrostPosition * 2.3 + vec3(9.2, 3.1, 0.4));
float rim = 1.0 - smoothstep(0.008, mix(0.065, 0.22, colony), frostEdges.x);
float branchRelief = smoothstep(0.22, 0.60, crystalHeight);
// This material is assigned only to the lid mesh, so use its explicit mask
// rather than a normal threshold that can fade across smoothed lid vertices.
float lidTop = uFrostLidMask;
float lidGrowthStrength = smoothstep(0.08, 0.42, uFrostProgress);
float lidFrontLow = frostNoise(vec3(vFrostPosition.xz * 0.95 + vec2(4.7, 2.1), 6.2));
float lidFrontMid = frostNoise(vec3(vFrostPosition.xz * 3.4 + vec2(1.3, 8.6), 2.8));
float lidFrontFine = frostNoise(vec3(vFrostPosition.xz * 10.2 + vec2(7.2, 3.5), 5.1));
float lidFrontWarp = lidTop * lidGrowthStrength * (
  (lidFrontLow - 0.5) * 0.78 +
  (lidFrontMid - 0.5) * 0.42 +
  (lidFrontFine - 0.5) * 0.18
);
float reach = uFrostProgress * 1.12 - 0.08;
float started = smoothstep(0.0, 0.06, uFrostProgress);
float arrivalWarp = (frostNoise(vFrostPosition * 9.0) - 0.5) * 0.08 - branchRelief * 0.085 + lidFrontWarp;
// Blend edge and nucleus fronts as coverage. No single equal-arrival contour
// is left behind when fronts meet across a broad planar face.
float frostFront = frostCoverage(vFrostPosition, frostW, reach, arrivalWarp, corner * 0.15) * started;
// A thin seam coating bridges the separate nuclei late in the transition.
// Interior density remains uneven even after the separate fronts have met.
frostFront = max(frostFront, rim * smoothstep(0.2, 0.85, uFrostProgress));
float crystals = smoothstep(0.26, 0.65, crystalHeight);
float density = mix(0.10, 1.0, smoothstep(0.24, 0.76, colony));
float edgeFans = 1.0 - smoothstep(0.03, 0.45, frostEdges.x);
float needles = crystals * (edgeFans * 0.75 + smoothstep(0.52, 0.76, colony) * 0.35);
// Fine rime fills the space between sparse fern-like colonies, instead of
// covering every face in the same high-contrast branching print.
float grain = frostNoise(vFrostPosition * 185.0);
float grainDetail = smoothstep(0.35, 0.78, grain);
float fineVeil = mix(0.012, 0.05, colony);
float frostDeposit = frostFront * clamp(fineVeil + rim * 0.29 + density * (needles * 0.32 + grainDetail * 0.045), 0.0, 1.0);
float frostPresence = frostFront * clamp(0.25 + rim * 0.55 + density * (0.25 + needles * 0.65 + grainDetail * 0.25), 0.0, 1.0);
// A translucent optical mixture leaves the black finish visible underneath.
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40, 0.46, 0.53), frostDeposit * 0.55);
roughnessFactor = mix(roughnessFactor, 0.96, frostPresence);
`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.0, frostPresence);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// Keep a restrained warm glow on the remaining frost while it thaws.
float meltGlow = uFrostMelt * frostPresence * (0.35 + rim * 0.65);
totalEmissiveRadiance += vec3(1.0, 0.19, 0.045) * meltGlow * 0.18;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Standard Three.js gives normalMap priority over bumpMap. Apply the frozen
// relief after the brushed-metal normal, and only behind the growing front.
float frostRelief = (crystalHeight * edgeFans * 0.65 + grain * 0.035) * frostFront * mix(0.35, 1.0, density) * uFrostRelief;
normal = perturbNormalArb(-vViewPosition, normal,
  vec2(dFdx(frostRelief), dFdy(frostRelief)), faceDirection);`);
  };
  material.customProgramCacheKey = () => 'device-frost-colonies-pbr-v7-melt-glow';
}

export function createEdgeFrost(root, bounds) {
  let seed = 86231;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const min = bounds.min, max = bounds.max;
  const size = bounds.getSize(new THREE.Vector3());
  const edges = [];
  for (let axis = 0; axis < 3; axis++) {
    const other = [0, 1, 2].filter(a => a !== axis);
    for (const a of [0, 1]) for (const b of [0, 1]) {
      const origin = min.clone();
      origin.setComponent(other[0], a ? max.getComponent(other[0]) : min.getComponent(other[0]));
      origin.setComponent(other[1], b ? max.getComponent(other[1]) : min.getComponent(other[1]));
      edges.push({ axis, origin, length: size.getComponent(axis) });
    }
  }
  const totalLength = edges.reduce((sum, e) => sum + e.length, 0);
  const grainMaterial = new THREE.MeshStandardMaterial({
    color: 0xc2ccd6, roughness: 0.88, metalness: 0,
    transparent: true, opacity: 0.58, depthWrite: false
  });
  const grains = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), grainMaterial, 1100);
  grains.name = 'Frost_Crystalline_Edge_Rime';
  grains.visible = false;
  grains.frustumCulled = false;
  root.add(grains);
  const grainData = Array.from({ length: grains.count }, () => {
    let along = random() * totalLength;
    let edge = edges[edges.length - 1];
    for (const candidate of edges) {
      if (along <= candidate.length) { edge = candidate; break; }
      along -= candidate.length;
    }
    const position = edge.origin.clone();
    position.setComponent(edge.axis, position.getComponent(edge.axis) + along);
    const cluster = 0.5 + 0.5 * Math.sin(along * 12.7 + edge.axis * 7.3) * Math.sin(along * 4.1 + edge.origin.x * 2.9);
    const radius = (0.0015 + random() * 0.004) * (0.35 + cluster);
    position.add(new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(0.006));
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI));
    return { position, rotation, radius, delay: (1 - cluster) * 0.38 + random() * 0.12, elongation: 1.2 + random() * 1.6 };
  });
  const iceMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc1d0dd, metalness: 0, roughness: 0.24, ior: 1.31,
    transmission: 0.45, thickness: 0.035,
    transparent: true, opacity: 0.65, depthWrite: false
  });
  const icicles = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), iceMaterial, 112);
  icicles.name = 'Frost_Hanging_Edge_Icicles';
  icicles.visible = false;
  icicles.frustumCulled = false;
  root.add(icicles);
  const perimeter = 2 * (size.x + size.z);
  const iceClusters = Array.from({ length: 13 }, () => random() * perimeter);
  const icicleData = Array.from({ length: icicles.count }, () => {
    let t = random() < 0.7
      ? (iceClusters[Math.floor(random() * iceClusters.length)] + (random() - 0.5) * 0.5 + perimeter) % perimeter
      : random() * perimeter;
    let x, z;
    if (t < size.x) { x = min.x + t; z = min.z; }
    else if ((t -= size.x) < size.z) { x = max.x; z = min.z + t; }
    else if ((t -= size.z) < size.x) { x = max.x - t; z = max.z; }
    else { t -= size.x; x = min.x; z = max.z - t; }
    return { x, z, length: 0.024 + Math.pow(random(), 2) * 0.10, radius: 0.003 + random() * 0.005, delay: 0.10 + random() * 0.24 };
  });
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const downward = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  let last = -1;
  return progress => {
    if (progress === last) return;
    last = progress;
    grains.visible = progress > 0;
    icicles.visible = progress > 0.1;
    grainData.forEach((grain, i) => {
      const growth = THREE.MathUtils.smoothstep(progress, grain.delay, grain.delay + 0.45);
      scale.set(grain.radius, grain.radius * grain.elongation, grain.radius).multiplyScalar(growth);
      matrix.compose(grain.position, grain.rotation, scale);
      grains.setMatrixAt(i, matrix);
    });
    icicleData.forEach((drop, i) => {
      const growth = THREE.MathUtils.smoothstep(progress, drop.delay, 1);
      // The base stays on the lid throughout growth, never hovering below it.
      position.set(drop.x, max.y - drop.length * growth * 0.5, drop.z);
      scale.set(drop.radius * growth, drop.length * growth, drop.radius * growth);
      matrix.compose(position, downward, scale);
      icicles.setMatrixAt(i, matrix);
    });
    grains.instanceMatrix.needsUpdate = true;
    icicles.instanceMatrix.needsUpdate = true;
  };
}
