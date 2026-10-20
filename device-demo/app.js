import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RGBELoader } from './vendor/RGBELoader.js';

const canvas = document.querySelector('[data-testing-model], #device');
const equipment = document.querySelector('[data-testing-equipment]');
const asset = name => new URL(name, import.meta.url).href;
const status = document.querySelector('#status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
const pivot = new THREE.Group();
pivot.scale.setScalar(.95);
scene.add(pivot);
const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(-3, 5, 6);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
Object.assign(light.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 25 });
light.shadow.normalBias = .015;
scene.add(light);
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
  const [gltf, hdr, normal] = await Promise.all([
    loadAsset(new GLTFLoader(), asset('device.glb'), '3D model'),
    loadAsset(new RGBELoader(), asset('studio.hdr'), 'studio HDR environment map'),
    loadAsset(new THREE.TextureLoader(), asset('brushed_normal.jpg'), 'brushed metal normal map')
  ]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(hdr);
  scene.environment = environment.texture;
  hdr.dispose(); pmrem.dispose();
  normal.colorSpace = THREE.NoColorSpace;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(4, 4);
  normal.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const makeMaterial = (mesh, source) => {
    const materialName = source.name || '';
    const meshName = mesh.name || '';
    if (materialName === 'LED_Green' || /green domed glass/i.test(meshName)) {
      return new THREE.MeshBasicMaterial({ name: 'LED_Green', color: 0x33ff55 });
    }
    if (materialName === 'Metal_Brushed' || /panel.*control/i.test(meshName)) {
      return new THREE.MeshStandardMaterial({
        name: 'Metal_Brushed', color: 0xdddddd, metalness: 1, roughness: .35,
        envMapIntensity: 1.5, normalMap: normal, normalScale: new THREE.Vector2(.2, .2)
      });
    }
    if (materialName === 'Metal_Shiny' || /metal|pin|stainless|nickel|connector|screw/i.test(meshName)) {
      return new THREE.MeshStandardMaterial({
        name: 'Metal_Shiny', color: 0xdddddd, metalness: 1, roughness: .1,
        envMapIntensity: 2.5
      });
    }
    if (materialName === 'Plastic_Matte' || /plastic|rocker|chassis|housing|polymer/i.test(meshName)) {
      return new THREE.MeshStandardMaterial({
        name: 'Plastic_Matte', color: 0x1a1a1a, metalness: 0, roughness: .6
      });
    }
    // Rebuild remaining printed legends and dark inserts too, preserving their
    // intended non-metal color instead of accidentally turning them chrome.
    return new THREE.MeshStandardMaterial({
      name: materialName || 'Device_Matte',
      color: source.color?.clone() || new THREE.Color(0x777777),
      metalness: 0,
      roughness: .65,
      transparent: source.transparent,
      opacity: source.opacity
    });
  };

  gltf.scene.traverse(child => {
    if (!child.isMesh) return;
    if (child.name.replaceAll('_', ' ') === 'Label Indicator legend') child.visible = false;
    child.castShadow = child.receiveShadow = true;
    const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const newMaterials = oldMaterials.map(source => makeMaterial(child, source));
    oldMaterials.forEach(source => source?.dispose());
    child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
    if (Array.isArray(child.material)) child.material.forEach(material => { material.needsUpdate = true; });
    else child.material.needsUpdate = true;
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
