import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const canvas = document.querySelector('[data-testing-model], #device');
const equipment = document.querySelector('[data-testing-equipment]');
const asset = name => {
  const url = new URL(name, import.meta.url);
  url.search = new URL(import.meta.url).search;
  return url.href;
};
const status = document.querySelector('#status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
const pivot = new THREE.Group();
pivot.scale.setScalar(.95);
scene.add(pivot);
const wetMaterials = new Set();
let rainGeometry;
let rainMaterial;
let rainPositions;
let rainFallSpeed = 1.5;
const mainLight = new THREE.DirectionalLight(0xffffff, 4.0);
mainLight.position.set(5, 8, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
Object.assign(mainLight.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 25 });
mainLight.shadow.normalBias = .015;
mainLight.shadow.bias = -.00015;
scene.add(mainLight);
const fillLight = new THREE.DirectionalLight(0xffffff, .6);
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
  const textureLoader = new THREE.TextureLoader();
  const makeFlatNormalFallback = () => {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = fallbackCanvas.height = 2;
    const context = fallbackCanvas.getContext('2d');
    context.fillStyle = 'rgb(128, 128, 255)';
    context.fillRect(0, 0, 2, 2);
    return new THREE.CanvasTexture(fallbackCanvas);
  };
  const [gltf, brushedNormal, rainNormal] = await Promise.all([
    loadAsset(new GLTFLoader(), asset('device.glb'), '3D model'),
    loadAsset(textureLoader, asset('brushed_normal.jpg'), 'brushed metal normal map'),
    loadAsset(textureLoader, asset('rain_drops_normal.png'), 'rain drops normal map').catch(error => {
      console.warn('Rain normal map unavailable; continuing without surface droplets.', error);
      return makeFlatNormalFallback();
    })
  ]);
  brushedNormal.colorSpace = THREE.NoColorSpace;
  brushedNormal.wrapS = brushedNormal.wrapT = THREE.RepeatWrapping;
  brushedNormal.repeat.set(4, 4);
  brushedNormal.anisotropy = renderer.capabilities.getMaxAnisotropy();
  rainNormal.colorSpace = THREE.NoColorSpace;
  rainNormal.wrapS = rainNormal.wrapT = THREE.RepeatWrapping;
  // Keep the droplets large enough to read on the enclosure instead of
  // shrinking the full map into a fine, almost invisible grain.
  rainNormal.repeat.set(1.2, 1.2);
  rainNormal.anisotropy = renderer.capabilities.getMaxAnisotropy();
  gltf.scene.traverse(child => {
    if (!child.isMesh || !child.material) return;
    if (child.name.replaceAll('_', ' ') === 'Label Indicator legend') child.visible = false;
    child.castShadow = child.receiveShadow = true;
    const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const meshName = (child.name || '').toLowerCase();
    const bounds = new THREE.Box3().setFromObject(child);
    const dimensions = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
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

      // Catch every plastic part of the power inlet by either node or
      // material name. Exclude labels, pins and fasteners so their own
      // materials keep priority. Bounds also catch renamed flange meshes.
      const partName = `${meshName} ${matName}`;
      const isLabelPinOrFastener = /(label|legend|text|pin|screw|fastener|led|indicator)/.test(partName);
      const namedPowerSocketPart = /(socket|iec|power)/.test(partName) && !isLabelPinOrFastener;
      const darkPlastic = (matName.includes('plastic') || isDarkColor) && (source?.metalness ?? 0) < .2;
      const inIecSocketRegion = center.x > -.28 && center.x < .12
        && center.y > -.32 && center.y < .08
        && center.z > 1.28 && center.z < 1.56;
      const isFittingAtIecPosition = darkPlastic && inIecSocketRegion
        && largestDimension > .12 && largestDimension < .9;
      if (namedPowerSocketPart || isFittingAtIecPosition) {
        return new THREE.MeshPhysicalMaterial({
          name: 'IEC_Moulded_Black_Plastic', color: 0x121212,
          metalness: 0, roughness: .45, clearcoat: .8, clearcoatRoughness: .15
        });
      }

      // The front plate is also near-black in the source image, so preserve
      // its brushed-metal identity before classifying dark plastic by color.
      if (matName.includes('metal_brushed') || meshName.includes('panel') || meshName.includes('plate')) {
        return new THREE.MeshPhysicalMaterial({
          name: 'Dark_Titanium_Front_Panel', color: 0x181818, metalness: .95, roughness: .35,
          normalMap: brushedNormal, normalScale: new THREE.Vector2(.2, .2),
          clearcoat: 0, clearcoatRoughness: .05,
          clearcoatNormalMap: rainNormal, clearcoatNormalScale: new THREE.Vector2(1.15, 1.15)
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
          clearcoat: 0, clearcoatRoughness: .05,
          clearcoatNormalMap: rainNormal, clearcoatNormalScale: new THREE.Vector2(1.15, 1.15)
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
          clearcoat: 0, clearcoatRoughness: .05,
          clearcoatNormalMap: rainNormal, clearcoatNormalScale: new THREE.Vector2(1.15, 1.15)
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
    newMaterials.forEach(material => {
      material.needsUpdate = true;
      if (material.clearcoatNormalMap === rainNormal) wetMaterials.add(material);
    });
  });
  pivot.add(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new THREE.Vector3()).divideScalar(pivot.scale.x);
  radius = Math.hypot(size.x, size.z) / 2;
  halfHeight = size.y / 2;
  const dropCount = 1500;
  rainPositions = new Float32Array(dropCount * 3);
  const rainWidth = Math.max(radius * 2.2, 8);
  const rainDepth = Math.max(radius * 2.2, 8);
  for (let i = 0; i < dropCount; i++) {
    const offset = i * 3;
    rainPositions[offset] = (Math.random() - .5) * rainWidth;
    rainPositions[offset + 1] = Math.random() * 15 - 5;
    rainPositions[offset + 2] = (Math.random() - .5) * rainDepth;
  }
  rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainSpriteCanvas = document.createElement('canvas');
  rainSpriteCanvas.width = 16;
  rainSpriteCanvas.height = 32;
  const rainSpriteContext = rainSpriteCanvas.getContext('2d');
  const rainSpriteGradient = rainSpriteContext.createRadialGradient(8, 16, 1, 8, 16, 15);
  rainSpriteGradient.addColorStop(0, 'rgba(255,255,255,1)');
  rainSpriteGradient.addColorStop(.55, 'rgba(255,255,255,.88)');
  rainSpriteGradient.addColorStop(1, 'rgba(255,255,255,0)');
  rainSpriteContext.fillStyle = rainSpriteGradient;
  rainSpriteContext.beginPath();
  rainSpriteContext.ellipse(8, 16, 5, 15, 0, 0, Math.PI * 2);
  rainSpriteContext.fill();
  const rainSprite = new THREE.CanvasTexture(rainSpriteCanvas);
  rainMaterial = new THREE.PointsMaterial({
    color: 0xdde9f5, size: .035, map: rainSprite, transparent: true, opacity: 0,
    alphaTest: .05, depthWrite: false, sizeAttenuation: true
  });
  scene.add(new THREE.Points(rainGeometry, rainMaterial));
  resize();
  gsap.registerPlugin(ScrollTrigger);
  const findScrollContainer = () => {
    // Use a scrollable wrapper when the page is embedded in a platform that
    // scrolls an element inside the document; otherwise this document's
    // viewport (including an iframe viewport) is the scroller.
    let node = equipment?.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      const overflowY = getComputedStyle(node).overflowY;
      if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
      node = node.parentElement;
    }
    return window;
  };
  const scrollContainer = findScrollContainer();
  const updateRainProgress = self => {
    const progress = THREE.MathUtils.clamp(self.progress, 0, 1);
    wetMaterials.forEach(material => { material.clearcoat = progress; });
    if (rainMaterial) rainMaterial.opacity = progress * .6;
    // Let the rain build from a light drift into a strong shower as the user
    // moves through the testing section.
    rainFallSpeed = THREE.MathUtils.lerp(1.5, 12, progress);
  };
  gsap.to(pivot.rotation, {
    y: Math.PI * 1.5, ease: 'none',
    scrollTrigger: {
      trigger: equipment ? '[data-testing-journey]' : '.scroll-area',
      start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true,
      scroller: scrollContainer,
    }
  });
  const weatherSection = equipment
    ? document.querySelector('.testing-about') || document.querySelector('[data-testing-journey]')
    : document.querySelector('.scroll-area');
  ScrollTrigger.create({
    trigger: weatherSection,
    // Start as the second section enters the viewport, then build through
    // the transition instead of waiting until the entire long page ends.
    start: 'top bottom',
    end: 'top 30%',
    scrub: .5,
    scroller: scrollContainer,
    onUpdate: updateRainProgress,
    onRefresh: updateRainProgress
  });
  ScrollTrigger.refresh();
  if (status) status.textContent = '';
  equipment?.classList.add('testing-model-ready');
} catch (error) {
  console.error(error);
  if (status) status.textContent = 'Не удалось загрузить модель или текстуры. Откройте страницу через HTTP-сервер.';
}
const rainClock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(rainClock.getDelta(), .05);
  if (rainPositions) {
    for (let i = 1; i < rainPositions.length; i += 3) {
      rainPositions[i] -= rainFallSpeed * delta;
      if (rainPositions[i] < -5) rainPositions[i] = 10;
    }
    rainGeometry.attributes.position.needsUpdate = true;
  }
  renderer.render(scene, camera);
});
