const testingMenuButton = document.querySelector('.menu-toggle');
const testingMenuDrawer = document.querySelector('.menu-drawer');
const testingNavigation = document.querySelector('#site-nav');

const setTestingMenuOpen = (open) => {
  if (!testingMenuButton || !testingMenuDrawer) return;
  testingMenuButton.setAttribute('aria-expanded', String(open));
  testingMenuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  testingMenuDrawer.classList.toggle('is-open', open);
  document.documentElement.classList.toggle('menu-open', open);
  document.body.classList.toggle('menu-open', open);
};

testingMenuButton?.addEventListener('click', () => {
  setTestingMenuOpen(testingMenuButton.getAttribute('aria-expanded') !== 'true');
});
testingNavigation?.addEventListener('click', (event) => {
  if (event.target.closest('a')) setTestingMenuOpen(false);
});
testingMenuDrawer?.addEventListener('click', (event) => {
  if (testingMenuButton?.getAttribute('aria-expanded') === 'true' && event.target === testingMenuDrawer) setTestingMenuOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && testingMenuButton?.getAttribute('aria-expanded') === 'true') {
    setTestingMenuOpen(false);
    testingMenuButton.focus();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (testingMenuButton?.getAttribute('aria-expanded') === 'true' && !testingMenuDrawer?.contains(event.target)) setTestingMenuOpen(false);
});

const sequence = document.querySelector('[data-testing-sequence]');
const stage = sequence?.querySelector('.testing-stage');
const equipment = stage?.querySelector('.testing-stage__equipment');
const equipmentImage = stage?.querySelector('.testing-stage__image');
const surfaceCanvas = stage?.querySelector('.testing-stage__effects');
const atmosphereCanvas = stage?.querySelector('.testing-stage__atmosphere');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

if (sequence && stage && equipment && equipmentImage && surfaceCanvas && atmosphereCanvas) {
  const scenes = ['clear', 'rain', 'heat', 'frost', 'vibration'];
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const smoothstep = (edge0, edge1, value) => {
    const t = clamp01((value - edge0) / Math.max(.0001, edge1 - edge0));
    return t * t * (3 - 2 * t);
  };
  let scrollProgress = 0;
  let activeScene = -1;
  let frame = 0;
  let lastDraw = 0;
  let stageWidth = 1, stageHeight = 1, surfaceWidth = 1, surfaceHeight = 1;
  let maskData = null, maskWidth = 0, maskHeight = 0;
  let seed = 104729;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const maskCanvas = document.createElement('canvas');
  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  let surfaceDrops = [], frostPoints = [], rainLines = [];

  const makeSurfacePoints = count => {
    const points = [];
    if (!maskData) return points;
    let attempts = 0;
    while (points.length < count && attempts < count * 70) {
      attempts++;
      const x = random(), y = random();
      const px = Math.min(maskWidth - 1, Math.floor(x * maskWidth));
      const py = Math.min(maskHeight - 1, Math.floor(y * maskHeight));
      if (maskData[(py * maskWidth + px) * 4 + 3] > 100) points.push({ x, y, size: .7 + random() * 2.3, phase: random() });
    }
    return points;
  };

  const buildMask = () => {
    if (!equipmentImage.complete || !equipmentImage.naturalWidth) return;
    maskWidth = 280;
    maskHeight = Math.round(maskWidth * equipmentImage.naturalHeight / equipmentImage.naturalWidth);
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
    maskContext.clearRect(0, 0, maskWidth, maskHeight);
    maskContext.drawImage(equipmentImage, 0, 0, maskWidth, maskHeight);
    maskData = maskContext.getImageData(0, 0, maskWidth, maskHeight).data;
    surfaceDrops = makeSurfacePoints(230);
    frostPoints = makeSurfacePoints(155);
  };

  const resizeCanvases = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const stageBounds = stage.getBoundingClientRect();
    const surfaceBounds = equipment.getBoundingClientRect();
    stageWidth = Math.max(1, stageBounds.width);
    stageHeight = Math.max(1, stageBounds.height);
    surfaceWidth = Math.max(1, surfaceBounds.width);
    surfaceHeight = Math.max(1, surfaceBounds.height);
    for (const canvas of [atmosphereCanvas, surfaceCanvas]) {
      const bounds = canvas === atmosphereCanvas ? stageBounds : surfaceBounds;
      canvas.width = Math.max(1, Math.round(bounds.width * dpr));
      canvas.height = Math.max(1, Math.round(bounds.height * dpr));
    }
    rainLines = Array.from({ length: Math.min(150, Math.round(stageWidth / 10)) }, () => ({
      x: random() * stageWidth, phase: random(), length: 8 + random() * 19, speed: .35 + random() * .85
    }));
    buildMask();
  };

  const drawDrop = (ctx, x, y, radius, alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    const gradient = ctx.createRadialGradient(x - radius * .35, y - radius * .4, radius * .06, x, y, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,.96)');
    gradient.addColorStop(.24, 'rgba(218,242,255,.55)');
    gradient.addColorStop(.68, 'rgba(103,163,202,.16)');
    gradient.addColorStop(1, 'rgba(255,255,255,.56)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * .72, radius, -.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(236,249,255,.62)';
    ctx.lineWidth = Math.max(.5, radius * .12);
    ctx.beginPath();
    ctx.arc(x - radius * .12, y - radius * .14, radius * .58, Math.PI * 1.08, Math.PI * 1.8);
    ctx.stroke();
    ctx.restore();
  };

  const drawGraph = (ctx, time, intensity) => {
    const left = stageWidth * .055, right = stageWidth * .91;
    const top = stageHeight * .28, bottom = stageHeight * .66;
    const width = right - left, height = bottom - top;
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.strokeStyle = 'rgba(185,200,211,.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = left + width * i / 10;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const y = top + height * i / 4;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }
    ctx.strokeStyle = '#ff8733';
    ctx.shadowColor = '#ff730d';
    ctx.shadowBlur = 10;
    ctx.lineWidth = Math.max(1.5, Math.min(3, stageWidth / 700));
    ctx.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const primary = Math.exp(-Math.pow((x - width * .43) / (width * .055), 2)) * .76;
      const secondary = Math.exp(-Math.pow((x - width * .73) / (width * .09), 2)) * .34;
      const noise = Math.sin(x * .26 + time * .004) * .018 + Math.sin(x * .057 + time * .002) * .014;
      const y = top + height * (.63 - primary - secondary - noise);
      if (x === 0) ctx.moveTo(left + x, y); else ctx.lineTo(left + x, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  const drawAtmosphere = (time, sceneIndex, phase) => {
    const ctx = atmosphereCanvas.getContext('2d');
    ctx.setTransform(atmosphereCanvas.width / stageWidth, 0, 0, atmosphereCanvas.height / stageHeight, 0, 0);
    ctx.clearRect(0, 0, stageWidth, stageHeight);
    if (sceneIndex === 1 || (sceneIndex === 2 && phase < .18)) {
      const rainIn = sceneIndex === 1 ? smoothstep(.03, .35, phase) : 1;
      const rainOut = sceneIndex === 1 ? 1 - smoothstep(.88, 1, phase) : 1 - smoothstep(0, .18, phase);
      ctx.save();
      ctx.globalAlpha = (.2 + rainIn * .34) * rainOut;
      ctx.strokeStyle = 'rgba(206,230,244,.68)';
      ctx.lineWidth = 1;
      for (const line of rainLines) {
        const y = ((time * .00042 * line.speed + line.phase) % 1.15) * (stageHeight + line.length) - line.length;
        ctx.beginPath(); ctx.moveTo(line.x, y); ctx.lineTo(line.x - 2, y + line.length); ctx.stroke();
      }
      ctx.restore();
    }
    if (sceneIndex === 2 || (sceneIndex === 3 && phase < .18)) {
      const heat = sceneIndex === 2
        ? smoothstep(.04, .58, phase) * (1 - smoothstep(.86, 1, phase))
        : 1 - smoothstep(0, .18, phase);
      const centerY = stageHeight * .53;
      ctx.save();
      ctx.globalAlpha = heat * .38;
      ctx.strokeStyle = 'rgba(255,133,55,.68)';
      ctx.lineWidth = 1;
      for (let band = 0; band < 12; band++) {
        const baseY = centerY - stageHeight * .3 + band * stageHeight * .055;
        ctx.beginPath();
        for (let x = 0; x <= stageWidth; x += 5) {
          const wave = Math.sin(x * .014 + time * .003 + band * .7) * (2 + heat * 8);
          const shimmer = Math.sin(x * .047 - time * .002 + band) * heat * 1.8;
          const y = baseY + wave + shimmer;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    if (sceneIndex === 4) drawGraph(ctx, time, smoothstep(.04, .42, phase));
  };

  const drawSurface = (sceneIndex, phase, time) => {
    const ctx = surfaceCanvas.getContext('2d');
    ctx.setTransform(surfaceCanvas.width / surfaceWidth, 0, 0, surfaceCanvas.height / surfaceHeight, 0, 0);
    ctx.clearRect(0, 0, surfaceWidth, surfaceHeight);
    if (!maskData) return;
    const scale = Math.max(.72, surfaceWidth / 900);
    if (sceneIndex === 1 || (sceneIndex === 2 && phase < .18)) {
      const wetIn = sceneIndex === 1 ? smoothstep(.08, .72, phase) : 1;
      const wetOut = sceneIndex === 1 ? 1 - smoothstep(.88, 1, phase) : 1 - smoothstep(0, .18, phase);
      const wet = wetIn * wetOut;
      for (let i = 0; i < Math.round(surfaceDrops.length * wet); i++) {
        const drop = surfaceDrops[i];
        const radius = (1.8 + drop.size * 1.8) * scale;
        drawDrop(ctx, drop.x * surfaceWidth, drop.y * surfaceHeight, radius, .8 + .18 * Math.sin(time * .002 + drop.phase));
      }
    }
    if (sceneIndex === 3 || sceneIndex === 4) {
      const iceIn = sceneIndex === 3 ? smoothstep(.02, .7, phase) : 1;
      const iceOut = sceneIndex === 3 ? 1 - smoothstep(.88, 1, phase) : 1 - smoothstep(0, .18, phase);
      const ice = iceIn * iceOut;
      ctx.fillStyle = `rgba(182,226,248,${ice * .21})`;
      ctx.fillRect(0, 0, surfaceWidth, surfaceHeight);
      for (let i = 0; i < Math.round(frostPoints.length * ice); i++) {
        const point = frostPoints[i];
        const x = point.x * surfaceWidth, y = point.y * surfaceHeight;
        const radius = (2.5 + (i % 5) * 1.3) * scale;
        ctx.save();
        ctx.globalAlpha = .34 + ice * .42;
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(255,255,255,.95)' : 'rgba(194,235,255,.9)';
        ctx.lineWidth = Math.max(.65, .8 * scale);
        ctx.shadowColor = '#b9e8ff'; ctx.shadowBlur = 5 * scale;
        for (let arm = 0; arm < 6; arm++) {
          const angle = arm * Math.PI / 3 + point.phase * .25;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
          ctx.moveTo(x + Math.cos(angle) * radius * .56, y + Math.sin(angle) * radius * .56);
          ctx.lineTo(x + Math.cos(angle - .42) * radius * .82, y + Math.sin(angle - .42) * radius * .82);
          ctx.moveTo(x + Math.cos(angle) * radius * .56, y + Math.sin(angle) * radius * .56);
          ctx.lineTo(x + Math.cos(angle + .42) * radius * .82, y + Math.sin(angle + .42) * radius * .82);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0, surfaceWidth, surfaceHeight);
    ctx.restore();
  };

  const updateScene = () => {
    const sectionTop = sequence.getBoundingClientRect().top + window.scrollY;
    const scrollRange = Math.max(1, sequence.offsetHeight - stage.offsetHeight);
    scrollProgress = clamp01((window.scrollY - sectionTop) / scrollRange);
    const nextScene = Math.min(scenes.length - 1, Math.floor(scrollProgress * scenes.length));
    if (nextScene !== activeScene) {
      activeScene = nextScene;
      stage.dataset.scene = scenes[activeScene];
    }
  };

  const render = time => {
    frame = 0;
    if (document.visibilityState === 'hidden') return;
    const rect = sequence.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
    updateScene();
    const scenePosition = scrollProgress * scenes.length;
    const sceneIndex = Math.min(scenes.length - 1, Math.floor(scenePosition));
    const phase = scrollProgress >= 1 ? 1 : scenePosition - sceneIndex;
    const poseBlend = smoothstep(0, 1, phase);
    const poses = [
      { x: 0, y: 0, s: 1, r: 0 },
      { x: -.012, y: -.008, s: 1.012, r: .18 },
      { x: .01, y: .006, s: .995, r: -.16 },
      { x: -.008, y: -.004, s: 1.01, r: .1 },
      { x: 0, y: 0, s: 1, r: 0 }
    ];
    const from = poses[sceneIndex], to = poses[Math.min(poses.length - 1, sceneIndex + 1)];
    const vibration = sceneIndex === 4 && !motionPreference.matches ? smoothstep(.02, .3, phase) : 0;
    const shakeX = Math.sin(time * .065) * vibration * Math.min(5, equipment.clientWidth * .004);
    const shakeY = Math.sin(time * .091 + 1.2) * vibration * Math.min(3, equipment.clientWidth * .0025);
    equipment.style.setProperty('--equipment-x', `${(from.x + (to.x - from.x) * poseBlend) * equipment.clientWidth + shakeX}px`);
    equipment.style.setProperty('--equipment-y', `${(from.y + (to.y - from.y) * poseBlend) * equipment.clientHeight + shakeY}px`);
    equipment.style.setProperty('--equipment-scale', String(from.s + (to.s - from.s) * poseBlend));
    equipment.style.setProperty('--equipment-rotate', `${from.r + (to.r - from.r) * poseBlend}deg`);
    const heatAmount = sceneIndex === 2
      ? smoothstep(.02, .34, phase) * (1 - smoothstep(.86, 1, phase))
      : sceneIndex === 3 && phase < .18 ? 1 - smoothstep(0, .18, phase) : 0;
    const iceAmount = sceneIndex === 3
      ? smoothstep(.02, .7, phase) * (1 - smoothstep(.88, 1, phase))
      : sceneIndex === 4 && phase < .18 ? 1 - smoothstep(0, .18, phase) : 0;
    stage.style.setProperty('--heat-opacity', String(heatAmount * (.34 + .08 * Math.sin(time * .006))));
    stage.style.setProperty('--ice-opacity', String(iceAmount * .82));
    stage.style.setProperty('--scene-vibe', String(vibration));
    if (lastDraw === 0 || time - lastDraw > 30) {
      drawAtmosphere(time, sceneIndex, phase);
      drawSurface(sceneIndex, phase, time);
      lastDraw = time;
    }
    frame = window.requestAnimationFrame(render);
  };
  const requestRender = () => { if (!frame) frame = window.requestAnimationFrame(render); };

  equipmentImage.addEventListener('load', () => { buildMask(); requestRender(); }, { once: true });
  const resizeObserver = new ResizeObserver(() => { resizeCanvases(); requestRender(); });
  resizeObserver.observe(stage);
  resizeObserver.observe(equipment);
  window.addEventListener('scroll', () => { updateScene(); requestRender(); }, { passive: true });
  window.addEventListener('resize', () => { updateScene(); resizeCanvases(); requestRender(); }, { passive: true });
  document.addEventListener('visibilitychange', requestRender);
  resizeCanvases();
  updateScene();
  requestRender();
}
