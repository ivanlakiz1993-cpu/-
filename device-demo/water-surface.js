import * as THREE from './vendor/three.module.js';

// Reflection cards are generated locally, used only by water, and never
// rendered into the page background or applied to the dry enclosure.
export function createWaterReflections(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(.008, .008, .008);
  const cards = [];
  for (const [position, size, brightness] of [
    [[-3, 5, 2], [1.6, .7], 2],
    [[4, 2, -1], [.5, 2], 1],
    [[0, 3, -5], [1.2, .6], .7]
  ]) {
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(...size),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(brightness), side: THREE.DoubleSide })
    );
    card.position.set(...position);
    card.lookAt(0, 0, 0);
    studio.add(card);
    cards.push(card);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(studio, .04);
  pmrem.dispose();
  cards.forEach(card => { card.geometry.dispose(); card.material.dispose(); });
  return target;
}

export function createSurfaceWater(root, wetMaterials, environment) {
  // Sample actual model triangles, in root coordinates. UV atlas packing
  // cannot stretch droplets, and every drop follows the model's rotation.
  root.updateWorldMatrix(true, true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const triangles = [];
  let totalArea = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.some(material => wetMaterials.has(material))) return;
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const index = geometry.index;
    const transform = new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld);
    const count = index ? index.count : position.count;
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
    for (const group of groups) {
      if (!wetMaterials.has(materials[group.materialIndex])) continue;
      for (let i = group.start; i < Math.min(count, group.start + group.count); i += 3) {
        a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(transform);
        b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(transform);
        c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(transform);
        const normal = ab.subVectors(b, a).cross(ac.subVectors(c, a)).clone();
        const area = normal.length() * .5;
        if (area < .00001) continue;
        normal.normalize();
        if (normal.y < -.25) continue;
        totalArea += area;
        triangles.push({ a: a.clone(), b: b.clone(), c: c.clone(), normal, end: totalArea });
      }
    }
  });
  if (!triangles.length) return { setWetness() {}, dispose() {} };

  // Deterministic distribution: many small beads, fewer medium beads and
  // occasional coalesced, asymmetric drops. No scrolling texture or trails.
  let seed = 271828;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const geometry = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const angle = Math.atan2(z, x);
    const warp = 1 + .045 * Math.sin(angle * 3) * (1 - y);
    vertices.setXYZ(i, x * warp, y, z * warp);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({
    name: 'Surface_Water_Lenses', color: 0xffffff, metalness: 0,
    // Full transmission removes the white diffuse component. Water has
    // one air/water interface, not an additional varnish clearcoat.
    roughness: .02, transmission: 1, ior: 1.333, thickness: .008,
    envMap: environment, envMapIntensity: .62,
    clearcoat: 0
  });
  const count = Math.min(2800, Math.max(600, Math.round(totalArea * 85)));
  const drops = new THREE.InstancedMesh(geometry, material, count);
  drops.name = 'Surface_Water_Beads';
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.frustumCulled = false;
  drops.receiveShadow = true;
  drops.visible = false;
  const placements = [];
  const up = new THREE.Vector3(0, 1, 0);
  const spin = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const target = random() * totalArea;
    let low = 0, high = triangles.length - 1;
    while (low < high) { const mid = (low + high) >> 1; if (triangles[mid].end < target) low = mid + 1; else high = mid; }
    const triangle = triangles[low];
    const u = Math.sqrt(random()), v = random();
    const point = triangle.a.clone().multiplyScalar(1 - u)
      .addScaledVector(triangle.b, u * (1 - v)).addScaledVector(triangle.c, u * v);
    point.addScaledVector(triangle.normal, .0003);
    const category = random();
    const radius = category < .78 ? .006 + random() * .007
      : category < .97 ? .015 + random() * .015 : .032 + random() * .023;
    const elongation = category > .97 ? 1.2 + random() * .6 : .9 + random() * .25;
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, triangle.normal);
    spin.setFromAxisAngle(up, random() * Math.PI * 2);
    rotation.multiply(spin);
    const height = category > .97 ? .22 + random() * .15 : .3 + random() * .22;
    placements.push({ point, rotation, scale: new THREE.Vector3(radius * elongation, radius * height, radius).multiplyScalar(2.016) });
  }
  root.add(drops);
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  let previous = -1;
  return {
    mesh: drops,
    setWetness(value) {
      const wetness = THREE.MathUtils.clamp(value, 0, 1);
      if (Math.abs(wetness - previous) < .002) return;
      previous = wetness;
      drops.visible = wetness > .002;
      placements.forEach((placement, i) => {
        scale.copy(placement.scale).multiplyScalar(Math.sqrt(Math.max(.0001, wetness)));
        matrix.compose(placement.point, placement.rotation, scale);
        drops.setMatrixAt(i, matrix);
      });
      drops.instanceMatrix.needsUpdate = true;
    },
    dispose() { root.remove(drops); geometry.dispose(); material.dispose(); }
  };
}
