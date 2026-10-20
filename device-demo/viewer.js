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
renderer.toneMappingExposure = 1;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
const pivot = new THREE.Group();
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
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
if (equipment) new ResizeObserver(resize).observe(equipment);
try {
  const [gltf, hdr, normal] = await Promise.all([
    new GLTFLoader().loadAsync(asset('device.glb')),
    new RGBELoader().loadAsync(asset('studio.hdr')),
    new THREE.TextureLoader().loadAsync(asset('brushed_normal.jpg'))
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
        material.color.setHex(0xd5d7db); material.metalness = 1; material.roughness = .17;
        material.envMapIntensity = 1.8;
        // Object-space machining marks also cover lathed shells without UVs.
        material.onBeforeCompile = shader => {
          shader.vertexShader = 'varying vec3 vMachinedPosition;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
            '#include <begin_vertex>\nvMachinedPosition = position;');
          shader.fragmentShader = 'varying vec3 vMachinedPosition;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
            #include <roughnessmap_fragment>
            float grooves = .5 + .5 * sin(vMachinedPosition.y * 3100.0);
            float grain = fract(sin(dot(floor(vMachinedPosition * 4500.0), vec3(12.9898,78.233,37.719))) * 43758.5453);
            roughnessFactor = clamp(roughnessFactor + grooves * .055 + grain * .025, .12, .3);
          `);
        };
        material.customProgramCacheKey = () => 'machined-metal-v1';
      } else if (source.name === 'Plastic_Matte') {
        material.color.setHex(0x191a1c); material.metalness = 0; material.roughness = .6;
      }
      return material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tune) : tune(mesh.material);
  });
  pivot.add(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new THREE.Vector3());
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
