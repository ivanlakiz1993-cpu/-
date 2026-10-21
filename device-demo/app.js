import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const canvas = document.querySelector('[data-testing-model], #device');
const equipment = document.querySelector('[data-testing-equipment]');
const renderSurface = equipment?.closest('.testing-journey__visual') || equipment;
if (renderSurface && renderSurface !== equipment) renderSurface.append(canvas);
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
const rainProjection = new THREE.Vector3();
const pivot = new THREE.Group();
pivot.scale.setScalar(.95);
scene.add(pivot);
const wetMaterials = new Map();
let rainDrops;
let rainMaterial;
let rainNormalMap;
let rainDropStates;
let rainRadius = 4;
const rainFallSpeed = 4;
const rainWindRatio = .3;
const rainDropTransform = new THREE.Object3D();
const rainEdgeAlpha = (x, y, z) => {
  const cylinderDistance = Math.hypot(x, z) / rainRadius;
  const cylinderAlpha = 1 - THREE.MathUtils.smoothstep(cylinderDistance, .68, 1);
  // Fade in screen space too, so a camera crop can never reveal the edge of
  // the particle volume as a hard rectangle.
  rainProjection.set(x, y, z).project(camera);
  const viewportDistance = Math.hypot(rainProjection.x, rainProjection.y);
  const viewportAlpha = 1 - THREE.MathUtils.smoothstep(viewportDistance, .68, 1);
  return cylinderAlpha * viewportAlpha;
};
const updateRainDrop = index => {
  if (!rainDrops || !rainDropStates) return;
  const drop = rainDropStates[index];
  const fade = rainEdgeAlpha(drop.x, drop.y, drop.z);
  rainDropTransform.position.set(drop.x, drop.y, drop.z);
  rainDropTransform.rotation.set(0, 0, -rainWindRatio * .35);
  rainDropTransform.scale.set(
    Math.max(.001, drop.size * .7 * fade),
    Math.max(.001, drop.size * 1.3 * fade),
    Math.max(.001, drop.size * .7 * fade)
  );
  rainDropTransform.updateMatrix();
  rainDrops.setMatrixAt(index, rainDropTransform.matrix);
};
const randomRainPoint = () => {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random());
  return {
    x: Math.cos(angle) * distance * rainRadius,
    z: Math.sin(angle) * distance * rainRadius
  };
};
const rainSpawnAtWindwardEdge = () => {
  const nx = THREE.MathUtils.lerp(.82, .98, Math.random());
  const nzLimit = Math.sqrt(1 - nx * nx);
  return {
    x: nx * rainRadius,
    z: (Math.random() * 2 - 1) * nzLimit * rainRadius
  };
};
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
scene.add(new THREE.AmbientLight(0xffffff, .45));
const upperPanelLight = new THREE.DirectionalLight(0xffffff, 1.8);
// Low, off-axis fill skims across the lid and catches the wet surface relief.
upperPanelLight.position.set(-5, 3.5, 5);
upperPanelLight.target.position.set(0, 0, 0);
scene.add(upperPanelLight, upperPanelLight.target);
let radius = 3;
let halfHeight = .6;
const updateRainRadius = () => {
  const verticalHalfView = camera.position.length() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const visibleHalfWidth = verticalHalfView * camera.aspect;
  const previousRadius = rainRadius;
  rainRadius = Math.min(40, Math.max(radius * 2.2, visibleHalfWidth * 1.15, 8));
  if (!rainDropStates || previousRadius === rainRadius) return;

  const scale = rainRadius / previousRadius;
  for (let i = 0; i < rainDropStates.length; i++) {
    rainDropStates[i].x *= scale;
    rainDropStates[i].z *= scale;
    updateRainDrop(i);
  }
  rainDrops.instanceMatrix.needsUpdate = true;
};
function resize() {
  const bounds = renderSurface?.getBoundingClientRect();
  const fitBounds = equipment?.getBoundingClientRect() || bounds;
  const width = Math.max(1, bounds?.width || window.innerWidth), height = Math.max(1, bounds?.height || window.innerHeight);
  const fitHeight = Math.max(1, fitBounds?.height || height);
  const fitAspect = (fitBounds?.width || width) / fitHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  // Fit the entire rotation envelope, including narrow mobile viewports.
  const verticalFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontalFov = Math.atan(Math.tan(verticalFov) * fitAspect);
  // Fit the horizontal rotation cylinder, not a sphere with empty space above it.
  const fitDistance = Math.max(radius / Math.sin(horizontalFov), radius + halfHeight / Math.tan(verticalFov)) * 1.08;
  const distance = fitDistance * (height / fitHeight);
  camera.position.set(-.48, .48, 1).normalize().multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  updateRainRadius();
}
window.addEventListener('resize', resize);
resize();
const resizeObserver = new ResizeObserver(resize);
if (renderSurface) resizeObserver.observe(renderSurface);
if (equipment && equipment !== renderSurface) resizeObserver.observe(equipment);
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
  const [gltf, rainNormal] = await Promise.all([
    loadAsset(new GLTFLoader(), asset('device.glb'), '3D model'),
    loadAsset(textureLoader, asset('rain_drops_normal.png'), 'surface drops normal map').catch(error => {
      console.warn('Rain normal map unavailable; continuing without surface droplets.', error);
      return makeFlatNormalFallback();
    })
  ]);
  rainNormalMap = rainNormal;
  rainNormal.colorSpace = THREE.NoColorSpace;
  rainNormal.wrapS = rainNormal.wrapT = THREE.RepeatWrapping;
  rainNormal.repeat.set(2, 2);
  rainNormal.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const makeWetMaterial = options => {
    const material = new THREE.MeshPhysicalMaterial(options);
    // The normal map shapes the surface while the independent clearcoat lobe
    // catches bright, liquid-looking highlights over the same water beads.
    material.normalMap = rainNormal;
    material.normalScale.set(0, 0);
    material.clearcoatNormalMap = rainNormal;
    material.clearcoatNormalScale.set(0, 0);
    material.clearcoat = Math.max(material.clearcoat, .12);
    wetMaterials.set(material, {
      dryRoughness: material.roughness,
      dryMetalness: material.metalness
    });
    return material;
  };
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
        return makeWetMaterial({
          name: 'Dark_Titanium_Front_Panel', color: 0x181818, metalness: .95, roughness: .35,
          clearcoat: 0, clearcoatRoughness: .08
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
        if (largestDimension > 1.5) return makeWetMaterial({
          name: 'Black_Anodized_Aluminum', color: 0x141414, metalness: .85, roughness: .38,
          clearcoat: 0, clearcoatRoughness: .08
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
        return makeWetMaterial({
          name: 'Plastic_Matte', color: 0x0a0a0a, metalness: .15, roughness: .55,
          clearcoat: 0, clearcoatRoughness: .08
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
  const dropCount = 1000;
  rainDropStates = Array.from({ length: dropCount }, () => ({
    x: 0,
    y: 0,
    z: 0,
    size: THREE.MathUtils.lerp(.018, .04, Math.random())
  }));
  // Each falling drop is a small shaded water bead, never a line or streak.
  rainMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd8d8d8,
    metalness: 0,
    roughness: .08,
    clearcoat: 1,
    clearcoatRoughness: .04,
    transparent: true,
    opacity: .5,
    depthWrite: false
  });
  const dropletProfile = new THREE.SplineCurve([
    new THREE.Vector2(0, -.5), new THREE.Vector2(.2, -.48),
    new THREE.Vector2(.38, -.32), new THREE.Vector2(.48, -.08),
    new THREE.Vector2(.44, .16), new THREE.Vector2(.3, .36),
    new THREE.Vector2(.12, .48), new THREE.Vector2(0, .5)
  ]).getPoints(20);
  const dropletGeometry = new THREE.LatheGeometry(dropletProfile, 16);
  rainDrops = new THREE.InstancedMesh(dropletGeometry, rainMaterial, dropCount);
  rainDrops.frustumCulled = false;
  rainDrops.castShadow = false;
  rainDrops.receiveShadow = false;
  resize();
  for (let i = 0; i < dropCount; i++) {
    const { x, z } = randomRainPoint();
    rainDropStates[i].x = x;
    rainDropStates[i].y = Math.random() * 20 - 5;
    rainDropStates[i].z = z;
    updateRainDrop(i);
  }
  scene.add(rainDrops);
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
  const setRainProgress = progress => {
    progress = THREE.MathUtils.clamp(progress, 0, 1);
    wetMaterials.forEach((state, material) => {
      const wetness = THREE.MathUtils.smoothstep(progress, 0, 1);
      material.normalScale.setScalar(6 * wetness);
      material.clearcoatNormalScale.setScalar(6 * wetness);
      material.clearcoat = THREE.MathUtils.lerp(.12, 1, wetness);
      material.clearcoatRoughness = THREE.MathUtils.lerp(.08, .02, wetness);
      material.metalness = THREE.MathUtils.lerp(state.dryMetalness, .95, wetness);
      material.roughness = THREE.MathUtils.lerp(state.dryRoughness, .4, wetness);
    });
  };
  const updateRainProgress = self => setRainProgress(self.progress);
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
    // Rain builds only as the second section enters from the first.
    start: 'top bottom',
    end: 'top 30%',
    scrub: .5,
    scroller: scrollContainer,
    onUpdate: updateRainProgress,
    onRefresh: updateRainProgress,
    onLeave: () => setRainProgress(1),
    onLeaveBack: () => setRainProgress(0)
  });
  if (equipment && weatherSection.matches('.testing-about')) ScrollTrigger.create({
    trigger: weatherSection,
    // Clear the rain as section two settles, leaving the next section
    // transition free to run its own animation.
    start: 'top 30%',
    end: 'top top',
    scrub: .5,
    scroller: scrollContainer,
    onUpdate: self => setRainProgress(1 - self.progress),
    onRefresh: self => {
      if (self.isActive || self.progress > 0) setRainProgress(1 - self.progress);
    },
    onLeaveBack: () => setRainProgress(1),
    onLeave: () => setRainProgress(0)
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
  if (rainDropStates && rainDrops) {
    for (let i = 0; i < rainDropStates.length; i++) {
      const drop = rainDropStates[i];
      const fallDistance = rainFallSpeed * delta;
      const windDistance = fallDistance * rainWindRatio;
      drop.x -= windDistance;
      drop.y -= fallDistance;
      if (drop.y < -5 || Math.hypot(drop.x, drop.z) > rainRadius) {
        const { x, z } = rainSpawnAtWindwardEdge();
        drop.x = x;
        drop.y = 10 + Math.random() * 5;
        drop.z = z;
      }
      updateRainDrop(i);
    }
    rainDrops.instanceMatrix.needsUpdate = true;
  }
  if (rainNormalMap) {
    rainNormalMap.offset.y -= .001 * delta * 60;
    rainNormalMap.offset.x += .00025 * delta * 60;
    if (rainNormalMap.offset.y < 0) rainNormalMap.offset.y += 1;
    if (rainNormalMap.offset.x > 1) rainNormalMap.offset.x -= 1;
  }
  renderer.render(scene, camera);
});
