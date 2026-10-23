import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { attachFrostMaterial, createEdgeFrost } from './frost-surface.js?v=20261023-heat-only-1';
import { createSurfaceWater, createWaterReflections } from './water-surface.js?v=20261021-frost-growth-1';

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
const rainProjection = new THREE.Vector3();
const pivot = new THREE.Group();
pivot.scale.setScalar(.95);
scene.add(pivot);
const wetMaterials = new Map();
const frostMaterials = new Map();
const vibrationSvg = document.querySelector('[data-testing-vibration]');
const heatSvg = document.querySelector('[data-testing-heat]');
const heatDisplacement = document.querySelector('#testing-heat-displacement');
const journeyVisual = document.querySelector('.testing-journey__visual');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const vibrationChart = (() => {
  if (!vibrationSvg) return { setProgress: () => {} };
  const scale = vibrationSvg.querySelector('[data-vibration-scale]');
  const ticks = vibrationSvg.querySelector('[data-vibration-ticks]');
  const baseTrace = vibrationSvg.querySelector('[data-vibration-trace-base]');
  const trace = vibrationSvg.querySelector('[data-vibration-trace]');
  const cursor = vibrationSvg.querySelector('[data-vibration-cursor]');
  const width = 1920;
  const centerY = 540;
  const amplitude = 112;
  const cycles = 8;
  const waveY = x => centerY - Math.sin((x / width) * Math.PI * 2 * cycles) * amplitude
    - Math.sin((x / width) * Math.PI * 6 * cycles) * amplitude * 0.075;
  let wavePath = '';
  for (let index = 0; index <= 512; index++) {
    const x = (width * index) / 512;
    wavePath += `${index ? 'L' : 'M'}${x.toFixed(2)} ${waveY(x).toFixed(2)} `;
  }
  const tickPath = [];
  for (let index = 0; index <= 48; index++) {
    const x = (width * index) / 48;
    const length = index % 4 === 0 ? 36 : 18;
    tickPath.push(`M${x.toFixed(1)} ${centerY - length}v${length * 2}`);
  }
  scale?.setAttribute('d', `M0 ${centerY}H${width}`);
  ticks?.setAttribute('d', tickPath.join(''));
  baseTrace?.setAttribute('d', wavePath);
  trace?.setAttribute('d', wavePath);
  cursor?.setAttribute('transform', `translate(0 ${centerY})`);

  return {
    setProgress(progress) {
      const x = width * progress;
      const y = waveY(x);
      const fadeIn = THREE.MathUtils.smoothstep(progress, 0, 0.045);
      const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.96, 1);
      vibrationSvg.style.setProperty('--vibration-progress', progress.toFixed(4));
      vibrationSvg.style.setProperty('--vibration-opacity', (fadeIn * fadeOut).toFixed(3));
      cursor?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    }
  };
})();

let rainGeometry;
let rainMaterial;
let rainPositions;
let rainColors;
let rainLengths;
let rainRadius = 4;
let rainFallSpeed = 1.5;
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
const writeRainDrop = (index, x, y, z) => {
  const offset = index * 6;
  const colorOffset = index * 8;
  const alpha = rainEdgeAlpha(x, y, z);
  rainPositions[offset] = x;
  rainPositions[offset + 1] = y;
  rainPositions[offset + 2] = z;
  rainPositions[offset + 3] = x;
  rainPositions[offset + 4] = y - rainLengths[index];
  rainPositions[offset + 5] = z;
  rainColors[colorOffset] = rainColors[colorOffset + 1] = rainColors[colorOffset + 2] = 1;
  rainColors[colorOffset + 3] = alpha;
  rainColors[colorOffset + 4] = rainColors[colorOffset + 5] = rainColors[colorOffset + 6] = 1;
  rainColors[colorOffset + 7] = alpha;
};
const randomRainPoint = () => {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random());
  return {
    x: Math.cos(angle) * distance * rainRadius,
    z: Math.sin(angle) * distance * rainRadius
  };
};
// Lift the dark enclosure against the black page background without changing its materials.
const mainLight = new THREE.DirectionalLight(0xffffff, 5.76);
mainLight.position.set(5, 8, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
Object.assign(mainLight.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 25 });
mainLight.shadow.normalBias = .015;
mainLight.shadow.bias = -.00015;
scene.add(mainLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 1.152);
fillLight.position.set(-5, 3, 2);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xffffff, 2.88);
rimLight.position.set(0, 5, -5);
scene.add(rimLight);
const meltLight = new THREE.DirectionalLight(0xff963f, 0);
meltLight.position.set(-4, 2.5, 5);
scene.add(meltLight);
scene.add(new THREE.AmbientLight(0xffffff, .936));
const upperPanelLight = new THREE.DirectionalLight(0xffffff, 2.592);
// Low, off-axis fill skims across the lid and catches the wet surface relief.
upperPanelLight.position.set(-5, 3.5, 5);
upperPanelLight.target.position.set(0, 0, 0);
scene.add(upperPanelLight, upperPanelLight.target);
const dropletLight = new THREE.PointLight(0xffffff, 0, 0, 2);
dropletLight.position.set(-3.5, 4.5, 4);
scene.add(dropletLight);
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
  camera.updateMatrixWorld(true);
}
window.addEventListener('resize', resize);
resize();
if (equipment) new ResizeObserver(resize).observe(equipment);
// Align the enclosure's front panel to the camera so the full-turn endpoint
// returns to the same near-frontal view shown in the FAQ reference.
const frontFacingYaw = Math.atan2(camera.position.x, camera.position.z);
pivot.rotation.y = frontFacingYaw;
try {
  const loadAsset = (loader, url, label) => new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, error => {
      console.error(`Failed to load ${label}: ${url}`, error);
      reject(error);
    });
  });
  const textureLoader = new THREE.TextureLoader();
  const [gltf, brushedNormal, frostHeight] = await Promise.all([
    loadAsset(new GLTFLoader(), asset('device.glb'), '3D model'),
    loadAsset(textureLoader, asset('brushed_normal.jpg'), 'brushed metal normal map'),
    loadAsset(textureLoader, asset('frost-height.png'), 'frost crystal height map')
  ]);
  brushedNormal.colorSpace = THREE.NoColorSpace;
  brushedNormal.wrapS = brushedNormal.wrapT = THREE.RepeatWrapping;
  brushedNormal.repeat.set(4, 4);
  brushedNormal.anisotropy = renderer.capabilities.getMaxAnisotropy();
  frostHeight.colorSpace = THREE.NoColorSpace;
  frostHeight.wrapS = frostHeight.wrapT = THREE.RepeatWrapping;
  frostHeight.anisotropy = renderer.capabilities.getMaxAnisotropy();
  gltf.scene.updateMatrixWorld(true);
  const toDeviceRoot = gltf.scene.matrixWorld.clone().invert();
  const enclosureBounds = new THREE.Box3();
  const edgeBounds = new THREE.Box3();
  const makeWetMaterial = (options, toDevice, isLid = false) => {
    const material = new THREE.MeshPhysicalMaterial(options);
    material.normalMap = brushedNormal;
    material.normalScale.set(.08, .08);
    material.roughness = .2;
    material.clearcoat = 0;
    wetMaterials.set(material, true);
    attachFrostMaterial(material, frostHeight, enclosureBounds, toDevice, frostMaterials, isLid);
    return material;
  };
  gltf.scene.traverse(child => {
    if (!child.isMesh || !child.material) return;
    if (child.name.replaceAll('_', ' ') === 'Label Indicator legend') child.visible = false;
    child.castShadow = child.receiveShadow = true;
    const oldMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const meshName = (child.name || '').toLowerCase();
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    const localBounds = child.geometry.boundingBox;
    const toDevice = toDeviceRoot.clone().multiply(child.matrixWorld);
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
        }, toDevice);
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
        }, toDevice, meshName.includes('thin satin lid'));
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
        }, toDevice);
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
    if (largestDimension > 1.5 && newMaterials.some(material => wetMaterials.has(material))) {
      const deviceBounds = localBounds.clone().applyMatrix4(toDevice);
      enclosureBounds.union(deviceBounds);
      if (!meshName.includes('panel')) edgeBounds.union(deviceBounds);
    }
    oldMaterials.forEach(source => source?.dispose());
    child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
    newMaterials.forEach(material => { material.needsUpdate = true; });
  });
  pivot.add(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new THREE.Vector3()).divideScalar(pivot.scale.x);
  radius = Math.hypot(size.x, size.z) / 2;
  halfHeight = size.y / 2;
  const waterReflections = createWaterReflections(renderer);
  const surfaceWater = createSurfaceWater(gltf.scene, wetMaterials, waterReflections.texture);
  const icicleProgress = createEdgeFrost(gltf.scene, edgeBounds.isEmpty() ? enclosureBounds : edgeBounds);
  const dropCount = 1000;
  rainPositions = new Float32Array(dropCount * 2 * 3);
  rainColors = new Float32Array(dropCount * 2 * 4);
  rainLengths = new Float32Array(dropCount);
  // A circular cylinder keeps the rain local to the device and avoids the
  // rectangular cutoff created by a box-shaped particle volume.
  rainRadius = Math.min(25, Math.max(radius * 2.2, 8));
  for (let i = 0; i < dropCount; i++) {
    const { x, z } = randomRainPoint();
    const y = Math.random() * 20 - 5;
    rainLengths[i] = THREE.MathUtils.lerp(.3, .5, Math.random());
    writeRainDrop(i, x, y, z);
  }
  rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainGeometry.setAttribute('color', new THREE.BufferAttribute(rainColors, 4));
  rainMaterial = new THREE.LineBasicMaterial({
    color: 0xdde9f5, vertexColors: true, transparent: true, opacity: .25,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const rainLines = new THREE.LineSegments(rainGeometry, rainMaterial);
  rainLines.frustumCulled = false;
  scene.add(rainLines);
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
    const wetness = THREE.MathUtils.smoothstep(progress, 0, 1);
    surfaceWater.setWetness(wetness);
    dropletLight.intensity = 35 * progress;
    if (rainMaterial) rainMaterial.opacity = progress * .25;
    // Let the rain build from a light drift into a strong shower as the user
    // moves through the transition between the first two sections.
    rainFallSpeed = THREE.MathUtils.lerp(1.5, 12, progress);
  };
  const setFrostProgress = progress => {
    progress = THREE.MathUtils.clamp(progress, 0, 1);
    frostMaterials.forEach((state, material) => {
      state.progress = progress;
      state.uniform.value = progress;
    });
    icicleProgress(progress);
  };
  const setClimateTransition = progress => {
    progress = THREE.MathUtils.clamp(progress, 0, 1);

    // Frost forms, melts into surface beads and dries before the heat haze;
    // mechanical vibration begins only after this climate sequence finishes.
    const frostGrowth = THREE.MathUtils.smoothstep(progress, 0, .33);
    const frostMelt = THREE.MathUtils.smoothstep(progress, .33, .55);
    const frost = frostGrowth * (1 - frostMelt);
    const wetting = THREE.MathUtils.smoothstep(progress, .35, .57);
    const drying = THREE.MathUtils.smoothstep(progress, .59, .74);
    const wetness = wetting * (1 - drying);
    const heatIn = THREE.MathUtils.smoothstep(progress, .74, .84);
    const heatOut = 1 - THREE.MathUtils.smoothstep(progress, .96, 1);
    const heat = heatIn * heatOut;

    setFrostProgress(frost);
    surfaceWater.setWetness(wetness);
    // Keep the rain particle system off: the melt is shown only by water
    // droplets forming on the device surface.
    if (rainMaterial) rainMaterial.opacity = 0;
    dropletLight.intensity = 0;
    setTemperatureProgress(heat);
  };
  const setVibrationProgress = progress => {
    progress = THREE.MathUtils.clamp(progress, 0, 1);
    vibrationChart.setProgress(progress);
  };
  const setTemperatureProgress = progress => {
    progress = THREE.MathUtils.clamp(progress, 0, 1);
    const heat = progress;
    journeyVisual?.style.setProperty('--frost-melt-glow', heat.toFixed(3));
    meltLight.intensity = heat * 2.4;
    equipment?.style.setProperty('--thermal-contour', heat.toFixed(3));
    if (heatDisplacement) heatDisplacement.setAttribute('scale', (reducedMotion.matches ? 0 : heat * 6).toFixed(2));
    equipment?.classList.toggle('is-thermal-haze', heat > .001 && !reducedMotion.matches);
    if (heatSvg) {
      heatSvg.style.setProperty('--heat-progress', (heat * .72).toFixed(3));
      heatSvg.classList.toggle('is-active', heat > .01);
    }
  };
  const updateRainProgress = self => setRainProgress(self.progress);
  gsap.to(pivot.rotation, {
    y: frontFacingYaw + Math.PI * 2, ease: 'none',
    scrollTrigger: {
      trigger: equipment ? '[data-testing-journey]' : '.scroll-area',
      endTrigger: equipment ? '.footer' : '.scroll-area',
      // Finish one complete turn as the footer starts entering the viewport,
      // before it can cover the model.
      start: 'top top', end: equipment ? 'top bottom' : 'bottom bottom',
      scrub: 1, invalidateOnRefresh: true,
      scroller: scrollContainer,
    }
  });
  const weatherSection = equipment
    ? document.querySelector('.testing-about') || document.querySelector('[data-testing-journey]')
    : document.querySelector('.scroll-area');
  ScrollTrigger.create({
    trigger: weatherSection,
    // Rain builds only as the second section enters from the first.
    start: 'top 90%',
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
  const climateSection = document.querySelector('.climate-tests') || (!equipment && document.querySelector('.scroll-area'));
  const mechanicalSection = document.querySelector('.mechanical-tests');
  let frostProgressLogBucket = -1;
  const updateClimateProgress = self => {
    const progress = THREE.MathUtils.clamp(self.progress, 0, 1);
    setClimateTransition(progress);
    const frostGrowth = THREE.MathUtils.smoothstep(progress, 0, .33);
    const frostMelt = THREE.MathUtils.smoothstep(progress, .33, .55);
    const frost = frostGrowth * (1 - frostMelt);
    const bucket = Math.round(frost * 10);
    if (bucket !== frostProgressLogBucket) {
      frostProgressLogBucket = bucket;
      console.log('Frost Progress:', frost.toFixed(2));
    }
  };
  if (climateSection) ScrollTrigger.create({
    trigger: climateSection,
    start: equipment ? 'top bottom' : 'top -140%',
    endTrigger: equipment && mechanicalSection ? mechanicalSection : climateSection,
    end: equipment && mechanicalSection ? 'top bottom' : equipment ? 'bottom top' : 'bottom bottom',
    scrub: .8,
    scroller: scrollContainer,
    onUpdate: updateClimateProgress,
    onRefresh: updateClimateProgress,
    onLeave: () => setClimateTransition(1),
    onLeaveBack: () => setClimateTransition(0)
  });
  if (equipment && mechanicalSection) ScrollTrigger.create({
    trigger: mechanicalSection,
    start: 'top bottom',
    end: 'bottom top',
    scrub: .45,
    scroller: scrollContainer,
    onUpdate: self => setVibrationProgress(self.progress),
    onRefresh: self => setVibrationProgress(self.progress),
    onLeave: () => setVibrationProgress(1),
    onLeaveBack: () => setVibrationProgress(0)
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
  if (rainPositions && rainLengths) {
    let rainColorsChanged = false;
    for (let i = 0; i < rainLengths.length; i++) {
      const offset = i * 6;
      const colorOffset = i * 8;
      const fallDistance = rainFallSpeed * delta;
      rainPositions[offset + 1] -= fallDistance;
      rainPositions[offset + 4] -= fallDistance;
      if (rainPositions[offset + 4] < -5
        || Math.hypot(rainPositions[offset], rainPositions[offset + 2]) > rainRadius) {
        const { x, z } = randomRainPoint();
        const y = 10 + Math.random() * 5;
        writeRainDrop(i, x, y, z);
        rainColorsChanged = true;
      } else {
        const alpha = rainEdgeAlpha(
          rainPositions[offset], rainPositions[offset + 1], rainPositions[offset + 2]
        );
        rainColors[colorOffset + 3] = alpha;
        rainColors[colorOffset + 7] = alpha;
        rainColorsChanged = true;
      }
    }
    rainGeometry.attributes.position.needsUpdate = true;
    if (rainColorsChanged) rainGeometry.attributes.color.needsUpdate = true;
  }
  renderer.render(scene, camera);
});
