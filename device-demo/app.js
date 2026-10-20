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
const fillLight = new THREE.DirectionalLight(0xffffff, .4);
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
  const [gltf, brushedNormal] = await Promise.all([
    loadAsset(new GLTFLoader(), asset('device.glb'), '3D model'),
    loadAsset(new THREE.TextureLoader(), asset('brushed_normal.jpg'), 'brushed metal normal map')
  ]);
  brushedNormal.colorSpace = THREE.NoColorSpace;
  brushedNormal.wrapS = brushedNormal.wrapT = THREE.RepeatWrapping;
  brushedNormal.repeat.set(4, 4);
  brushedNormal.anisotropy = renderer.capabilities.getMaxAnisotropy();
  gltf.scene.traverse(child => {
    if (!child.isMesh || !child.material) return;
    if (child.name.replaceAll('_', ' ') === 'Label Indicator legend') child.visible = false;
    child.castShadow = child.receiveShadow = true;
    const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const meshName = (child.name || '').toLowerCase();
    const bounds = new THREE.Box3().setFromObject(child);
    const dimensions = bounds.getSize(new THREE.Vector3());
    const largestDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
    const newMaterials = oldMaterials.map(source => {
      const matName = (source?.name || '').toLowerCase();
      // GLTFLoader stores base-color factors in linear RGB. Convert each
      // material slot separately so merged meshes keep their distinct colors.
      const linearColor = source?.color;
      const color = source?.color?.clone().convertLinearToSRGB() || new THREE.Color(0x777777);
      const { r, g, b } = color;
      const isGoldColor = r > .45 && g > .2 && r > g * 1.25 && g > b * 1.6;
      const isGreenColor = g > .45 && g > r * 1.35 && g > b * 1.2;
      const isDarkColor = linearColor && linearColor.r < .15 && linearColor.g < .15 && linearColor.b < .15;
      const sourceIsGold = (r > .6 && g > .4 && b < .3) || isGoldColor || matName.includes('gold');
      if (sourceIsGold) {
        return new THREE.MeshStandardMaterial({
          name: 'Metal_Gold', color: 0xd4af37, metalness: 1, roughness: .2
        });
      }

      if (isGreenColor || matName.includes('led')) {
        return new THREE.MeshBasicMaterial({ name: 'LED_Green', color: 0x33ff55 });
      }

      // The front plate is also near-black in the source image, so preserve
      // its brushed-metal identity before classifying dark plastic by color.
      if (matName.includes('metal_brushed') || meshName.includes('panel') || meshName.includes('plate')) {
        return new THREE.MeshPhysicalMaterial({
          name: 'Dark_Titanium_Front_Panel', color: 0x181818, metalness: .95, roughness: .35,
          normalMap: brushedNormal, normalScale: new THREE.Vector2(.2, .2),
          clearcoat: .2, clearcoatRoughness: .3
        });
      }

      // The combined IEC blades retain their own Metal_Power_Pin material
      // slot, while size-based detection can still catch detached tiny metal parts.
      const isSmallMetal = largestDimension < .2 && (source?.metalness ?? 0) > .65;
      if (isSmallMetal || matName.includes('metal_power_pin')) {
        return new THREE.MeshStandardMaterial({
          name: 'Metal_Power_Pin', color: 0xffffff, metalness: 1, roughness: .08,
          envMapIntensity: 2
        });
      }

      if (isDarkColor) {
        // Distinguish the large enclosure faces from small dark socket
        // inserts using their measured geometry, not Blender object names.
        if (largestDimension > 1.5) return new THREE.MeshPhysicalMaterial({
          name: 'Black_Anodized_Aluminum', color: 0x141414, metalness: .85, roughness: .38,
          normalMap: brushedNormal, normalScale: new THREE.Vector2(.08, .08),
          clearcoat: .3, clearcoatRoughness: .2
        });
        return new THREE.MeshStandardMaterial({
          name: 'Plastic_Internal', color: 0x0f0f0f, metalness: 0, roughness: .75
        });
      }

      // Use the source PBR metalness as a physical signal for connector
      // shells and screws, while retaining the source color for print/labels.
      if ((source?.metalness ?? 0) > .5 || matName.includes('metal_shiny')) {
        return new THREE.MeshStandardMaterial({
          name: 'Metal_Shiny', color: 0xffffff, metalness: 1, roughness: .08,
          envMapIntensity: 2
        });
      }

      if (meshName.includes('body') || meshName.includes('box') || largestDimension > 1.5) {
        return new THREE.MeshPhysicalMaterial({
          name: 'Plastic_Matte', color: 0x0a0a0a, metalness: .15, roughness: .55,
          clearcoat: .4, clearcoatRoughness: .25
        });
      }

      // Printed legends and other non-metal details retain the Blender tone.
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
