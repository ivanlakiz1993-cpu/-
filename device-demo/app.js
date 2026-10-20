import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const canvas = document.querySelector('[data-testing-model], #device');
const equipment = document.querySelector('[data-testing-equipment]');
const asset = name => new URL(name, import.meta.url).href;
const status = document.querySelector('#status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
const pivot = new THREE.Group();
pivot.scale.setScalar(.95);
scene.add(pivot);
const mainLight = new THREE.DirectionalLight(0xffffff, 4.0);
mainLight.position.set(5, 8, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
Object.assign(mainLight.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 25 });
mainLight.shadow.normalBias = .015;
mainLight.shadow.bias = -.00015;
scene.add(mainLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
fillLight.position.set(-5, 3, 2);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xffffff, 2.0);
rimLight.position.set(0, 5, -5);
scene.add(rimLight);
scene.add(new THREE.AmbientLight(0xffffff, .2));
let radius = 3;
let halfHeight = .6;
function resize() {
  const bounds = equipment?.getBoundingClientRect();
  const width = Math.max(1, bounds?.width || window.innerWidth), height = Math.max(1, bounds?.height || window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  // Fit the entire rotation envelope, including narrow mobile viewports.
  const verticalFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontalFov = Math.atan(Math.tan(verticalFov) * camera.aspect);
  // Fit the horizontal rotation cylinder, not a sphere with empty space above it.
  const distance = Math.max(radius / Math.sin(horizontalFov), radius + halfHeight / Math.tan(verticalFov)) * 1.08;
  camera.position.set(-.48, .48, 1).normalize().multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
if (equipment) new ResizeObserver(resize).observe(equipment);
try {
  const loadAsset = (loader, url, label) => new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, error => {
      console.error(`Failed to load ${label}: ${url}`, error);
      reject(error);
    });
  });
  const [gltf, normal] = await Promise.all([
    loadAsset(new GLTFLoader(), asset('device.glb'), '3D model'),
    loadAsset(new THREE.TextureLoader(), asset('brushed_normal.jpg'), 'brushed metal normal map')
  ]);
  normal.colorSpace = THREE.NoColorSpace;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(4, 4);
  normal.anisotropy = renderer.capabilities.getMaxAnisotropy();
  gltf.scene.traverse(child => {
    if (!child.isMesh) return;
    if (child.name.replaceAll('_', ' ') === 'Label Indicator legend') child.visible = false;
    child.castShadow = child.receiveShadow = true;
    const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const meshName = (child.name || '').toLowerCase();
    const newMaterials = oldMaterials.map(source => {
      const matName = (source?.name || '').toLowerCase();
      const partName = `${meshName} ${matName}`;

      // 1. Gold contacts; check each material slot so the joined metal mesh
      // keeps its pins gold without recoloring the neighboring connector shells.
      if (/gold|pin|contact|core/.test(`${meshName} ${matName}`)) {
        return new THREE.MeshStandardMaterial({
          name: 'Metal_Gold', color: 0xd4af37, metalness: 1, roughness: .2
        });
      }

      if (matName.includes('led') || meshName.includes('green domed glass')) {
        return new THREE.MeshBasicMaterial({ name: 'LED_Green', color: 0x33ff55 });
      }

      // 2. Recessed sockets and insulating inserts stay matte black.
      if (/insulator|plastic_internal|slot|black insulating|deep back wall|recessed socket|insulating carrier/.test(partName)) {
        return new THREE.MeshStandardMaterial({
          name: 'Plastic_Internal', color: 0x0f0f0f, metalness: 0, roughness: .7
        });
      }

      if (matName.includes('metal_brushed') || meshName.includes('control panel')) {
        return new THREE.MeshStandardMaterial({
          name: 'Metal_Brushed', color: 0xdedcd8, metalness: .9, roughness: .35,
          normalMap: normal, normalScale: new THREE.Vector2(.2, .2)
        });
      }

      // 3. Blender exports the enclosure as Plastic_* meshes rather than
      // Body/Box, so include those actual names in the housing rule.
      if (meshName.includes('body') || meshName.includes('box') ||
          meshName.startsWith('plastic_') || matName.includes('plastic_matte') ||
          /chassis|side wall|rear removable|service panel|lid|rocker|housing/.test(partName)) {
        return new THREE.MeshStandardMaterial({
          name: 'Plastic_Matte', color: 0x1c1c1c, metalness: .1, roughness: .5
        });
      }

      // 4. Remaining connector shells and fasteners receive warm glossy chrome.
      if (matName.includes('metal_shiny') || meshName.startsWith('metal_')) {
        return new THREE.MeshStandardMaterial({
          name: 'Metal_Shiny', color: 0xdedcd8, metalness: 1, roughness: .12
        });
      }

      // Printed legends and other small parts keep their original non-metal tone.
      return new THREE.MeshStandardMaterial({
        name: matName || 'Device_Matte',
        color: source?.color?.clone() || new THREE.Color(0x777777),
        metalness: 0, roughness: .65,
        transparent: source?.transparent || false,
        opacity: source?.opacity ?? 1
      });
    });
    oldMaterials.forEach(source => source?.dispose());
    child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
    newMaterials.forEach(material => { material.needsUpdate = true; });
  });
  pivot.add(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new THREE.Vector3()).divideScalar(pivot.scale.x);
  radius = Math.hypot(size.x, size.z) / 2;
  halfHeight = size.y / 2;
  resize();
  gsap.registerPlugin(ScrollTrigger);
  gsap.to(pivot.rotation, {
    y: Math.PI * 1.5, ease: 'none',
    scrollTrigger: { trigger: equipment ? '[data-testing-journey]' : '.scroll-area', start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true }
  });
  ScrollTrigger.refresh();
  if (status) status.textContent = '';
  equipment?.classList.add('testing-model-ready');
} catch (error) {
  console.error(error);
  if (status) status.textContent = 'Не удалось загрузить модель или текстуры. Откройте страницу через HTTP-сервер.';
}
renderer.setAnimationLoop(() => renderer.render(scene, camera));
