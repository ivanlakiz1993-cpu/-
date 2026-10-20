import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RGBELoader } from './vendor/RGBELoader.js';

const canvas = document.querySelector('#device');
const status = document.querySelector('#status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
const pivot = new THREE.Group();
scene.add(pivot);
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(-3, 5, 6);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
Object.assign(light.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 25 });
light.shadow.normalBias = .015;
scene.add(light);
let radius = 3;
function resize() {
  const width = window.innerWidth, height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  // Fit the entire rotation envelope, including narrow mobile viewports.
  const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
  const distance = radius / Math.sin(halfFov) * 1.12;
  camera.position.set(-.32, .40, 1).normalize().multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
try {
  const [gltf, hdr, normal] = await Promise.all([
    new GLTFLoader().loadAsync('./device.glb'),
    new RGBELoader().loadAsync('./studio.hdr'),
    new THREE.TextureLoader().loadAsync('./brushed_normal.jpg')
  ]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(hdr);
  scene.environment = environment.texture;
  hdr.dispose(); pmrem.dispose();
  normal.colorSpace = THREE.NoColorSpace;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(4, 4);
  normal.anisotropy = renderer.capabilities.getMaxAnisotropy();
  gltf.scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    const tune = source => {
      const material = source.clone();
      if (source.name === 'Metal_Brushed') {
        material.metalness = 1; material.roughness = .4;
        material.normalMap = normal; material.normalScale.set(.18, .18);
      } else if (source.name === 'LED_Green') {
        return new THREE.MeshBasicMaterial({ name: 'LED_Green', color: 0x00ff44 });
      } else if (source.name === 'Metal_Shiny' || mesh.name.includes('Metal')) {
        material.color.setHex(0xdddddd); material.metalness = 1; material.roughness = .12;
      } else if (source.name === 'Plastic_Matte') {
        material.color.setHex(0x191a1c); material.metalness = 0; material.roughness = .6;
      }
      return material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tune) : tune(mesh.material);
  });
  pivot.add(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  resize();
  gsap.registerPlugin(ScrollTrigger);
  gsap.to(pivot.rotation, {
    y: Math.PI * 1.5, ease: 'none',
    scrollTrigger: { trigger: '.scroll-area', start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true }
  });
  ScrollTrigger.refresh();
  status.textContent = '';
} catch (error) {
  console.error(error);
  status.textContent = 'Не удалось загрузить модель или текстуры. Откройте страницу через HTTP-сервер.';
}
renderer.setAnimationLoop(() => renderer.render(scene, camera));
