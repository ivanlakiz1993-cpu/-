const testingMenuButton = document.querySelector('.menu-toggle');
const testingMenuDrawer = document.querySelector('.menu-drawer');
const testingNavigation = document.querySelector('#site-nav');

const setTestingMenuOpen = (open) => {
  testingMenuButton.setAttribute('aria-expanded', String(open));
  testingMenuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  testingMenuDrawer.classList.toggle('is-open', open);
  document.documentElement.classList.toggle('menu-open', open);
  document.body.classList.toggle('menu-open', open);
};

testingMenuButton.addEventListener('click', () => {
  setTestingMenuOpen(testingMenuButton.getAttribute('aria-expanded') !== 'true');
});

testingNavigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) setTestingMenuOpen(false);
});

testingMenuDrawer.addEventListener('click', (event) => {
  if (testingMenuButton.getAttribute('aria-expanded') === 'true' && event.target === testingMenuDrawer) {
    setTestingMenuOpen(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && testingMenuButton.getAttribute('aria-expanded') === 'true') {
    setTestingMenuOpen(false);
    testingMenuButton.focus();
  }
});

document.addEventListener('pointerdown', (event) => {
  if (testingMenuButton.getAttribute('aria-expanded') === 'true' && !testingMenuDrawer.contains(event.target)) {
    setTestingMenuOpen(false);
  }
});

const testingButton = document.querySelector('.testing-cover__button');
if (testingButton) {
  testingButton.addEventListener('pointermove', (event) => {
    const bounds = testingButton.getBoundingClientRect();
    testingButton.style.setProperty('--cursor-x', `${event.clientX - bounds.left}px`);
    testingButton.style.setProperty('--cursor-y', `${event.clientY - bounds.top}px`);
  });
}

const sequence = document.querySelector('[data-testing-sequence]');
const stage = sequence?.querySelector('.testing-stage');
const equipment = stage?.querySelector('.testing-stage__equipment');
const equipmentImage = stage?.querySelector('.testing-stage__image');
const effectsCanvas = stage?.querySelector('.testing-stage__effects');
const stageTitle = stage?.querySelector('h1');
const stageDescription = stage?.querySelector('p');
const stageStep = stage?.querySelector('.testing-stage__step');
const stageCaption = stage?.querySelector('.testing-stage__caption');
const progressItems = [...(stage?.querySelectorAll('.testing-stage__progress span') || [])];
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

if (sequence && stage && equipment && equipmentImage && effectsCanvas) {
  const scenes = [
    {
      key: 'rain', title: 'Испытание дождём',
      description: 'Капли дождя ложатся на поверхность оборудования, проверяя его защиту от влаги.',
      step: 'Климатические испытания · 01 / 05', caption: 'ВЛАГОСТОЙКОСТЬ'
    },
    {
      key: 'dew', title: 'Образование росы',
      description: 'На корпусе собираются капли конденсата — проверяем, как оборудование переносит влажную среду.',
      step: 'Климатические испытания · 02 / 05', caption: 'КОНДЕНСАЦИЯ ВЛАГИ'
    },
    {
      key: 'frost', title: 'Испытание обледенением',
      description: 'Температура снижается, и влага превращается в тонкий слой инея на поверхности.',
      step: 'Климатические испытания · 03 / 05', caption: 'НИЗКАЯ ТЕМПЕРАТУРА'
    },
    {
      key: 'heat', title: 'Испытание высокой температурой',
      description: 'Оборудование проходит проверку при повышенной температуре и сохраняет рабочие характеристики.',
      step: 'Климатические испытания · 04 / 05', caption: 'ВЫСОКАЯ ТЕМПЕРАТУРА'
    },
    {
      key: 'vibration', title: 'Механические испытания',
      description: 'Вибрационная нагрузка и частотный анализ помогают оценить устойчивость конструкции.',
      step: 'Механические испытания · 05 / 05', caption: 'ЧАСТОТНЫЙ АНАЛИЗ'
    }
  ];
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const smoothstep = (edge0, edge1, value) => {
    const t = clamp01((value - edge0) / Math.max(.0001, edge1 - edge0));
    return t * t * (3 - 2 * t);
  };
  let scrollProgress = 0;
  let activeScene = -1;
  let resizeObserver;
  let raf = 0;
  let lastTime = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let maskData = null;
  let maskWidth = 0;
  let maskHeight = 0;
  let seed = 104729;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const maskCanvas = document.createElement('canvas');
  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  const makeSurfacePoints = count => {
    const points = [];
    if (!maskData) return points;
    let attempts = 0;
    while (points.length < count && attempts < count * 60) {
      attempts++;
      const x = random();
      const y = random();
      const pixelX = Math.min(maskWidth - 1, Math.floor(x * maskWidth));
      const pixelY = Math.min(maskHeight - 1, Math.floor(y * maskHeight));
      if (maskData[(pixelY * maskWidth + pixelX) * 4 + 3] > 100) points.push({ x, y, size: .6 + random() * 1.8, phase: random() });
    }
    return points;
  };
  let surfaceDrops = [];
  let frostPoints = [];
  let rainDrops = [];

  const buildMask = () => {
    if (!equipmentImage.complete || !equipmentImage.naturalWidth) return;
    maskWidth = 240;
    maskHeight = Math.round(maskWidth * equipmentImage.naturalHeight / equipmentImage.naturalWidth);
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
    maskContext.clearRect(0, 0, maskWidth, maskHeight);
    maskContext.drawImage(equipmentImage, 0, 0, maskWidth, maskHeight);
    maskData = maskContext.getImageData(0, 0, maskWidth, maskHeight).data;
    surfaceDrops = makeSurfacePoints(180);
    frostPoints = makeSurfacePoints(85);
    rainDrops = makeSurfacePoints(100).map(point => ({ ...point, speed: .32 + random() * .78, length: 9 + random() * 20 }));
  };

  const resizeCanvas = () => {
    const bounds = effectsCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvasWidth = Math.max(1, bounds.width);
    canvasHeight = Math.max(1, bounds.height);
    effectsCanvas.width = Math.round(canvasWidth * dpr);
    effectsCanvas.height = Math.round(canvasHeight * dpr);
    const ctx = effectsCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildMask();
  };

  const drawDrop = (ctx, x, y, radius, alpha, cold = false) => {
    if (radius < .5 || alpha < .02) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const gradient = ctx.createRadialGradient(x - radius * .35, y - radius * .38, radius * .08, x, y, radius);
    gradient.addColorStop(0, cold ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.92)');
    gradient.addColorStop(.25, cold ? 'rgba(181,230,255,.38)' : 'rgba(218,241,255,.34)');
    gradient.addColorStop(.72, cold ? 'rgba(145,208,243,.15)' : 'rgba(120,173,208,.16)');
    gradient.addColorStop(1, cold ? 'rgba(230,250,255,.65)' : 'rgba(255,255,255,.38)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * .78, radius, -.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = cold ? 'rgba(211,246,255,.7)' : 'rgba(255,255,255,.4)';
    ctx.lineWidth = Math.max(.5, radius * .13);
    ctx.beginPath();
    ctx.arc(x - radius * .14, y - radius * .14, radius * .58, Math.PI * 1.08, Math.PI * 1.82);
    ctx.stroke();
    ctx.restore();
  };

  const drawGraph = (ctx, time, intensity) => {
    const w = Math.min(canvasWidth * .34, 300);
    const h = Math.min(canvasHeight * .22, 132);
    const x0 = canvasWidth - w - 12;
    const y0 = canvasHeight - h - 14;
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.fillStyle = 'rgba(3,8,12,.72)';
    ctx.strokeStyle = 'rgba(226,239,247,.36)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0, y0, w, h, 8);
    ctx.fill();
    ctx.stroke();
    const left = x0 + 28, top = y0 + 18, graphW = w - 42, graphH = h - 36;
    ctx.strokeStyle = 'rgba(210,225,235,.18)';
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const gy = top + graphH * i / 4;
      ctx.moveTo(left, gy); ctx.lineTo(left + graphW, gy);
    }
    ctx.stroke();
    ctx.strokeStyle = '#ff832e';
    ctx.shadowColor = '#ff730d';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= graphW; i += 2) {
      const x = left + i;
      const envelope = .18 + .82 * Math.exp(-Math.pow((i - graphW * .58) / (graphW * .14), 2));
      const y = top + graphH * .53 - Math.sin(i * .16 + time * .006) * graphH * .38 * envelope;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = '10px sans-serif';
    ctx.fillText('ЧАСТОТА / ГЦ', x0 + 12, y0 + 13);
    ctx.restore();
  };

  const drawEffects = time => {
    const ctx = effectsCanvas.getContext('2d');
    ctx.setTransform(effectsCanvas.width / canvasWidth, 0, 0, effectsCanvas.height / canvasHeight, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (!maskData) return;
    const sceneIndex = Math.min(scenes.length - 1, Math.floor(scrollProgress * scenes.length));
    const scenePhase = scrollProgress >= 1 ? 1 : scrollProgress * scenes.length - sceneIndex;
    const fade = smoothstep(.04, .46, scenePhase);
    const objectX = x => x * canvasWidth;
    const objectY = y => y * canvasHeight;

    if (sceneIndex === 0) {
      const impact = smoothstep(.03, .95, scenePhase);
      ctx.save();
      ctx.globalAlpha = .26 + .44 * (1 - fade * .6);
      ctx.strokeStyle = 'rgba(205,231,248,.78)';
      ctx.lineWidth = 1;
      for (const drop of rainDrops) {
        const y = ((time * .00042 * drop.speed + drop.phase) % 1.2) - .12;
        const x = objectX(drop.x);
        const py = objectY(y);
        if (py > -drop.length && py < canvasHeight + drop.length) {
          ctx.beginPath();
          ctx.moveTo(x, py - drop.length);
          ctx.lineTo(x - 1.5, py);
          ctx.stroke();
        }
      }
      ctx.restore();
      surfaceDrops.slice(0, Math.round(surfaceDrops.length * impact)).forEach(drop => {
        const radius = drop.size * (1 + .3 * Math.sin(time * .002 + drop.phase));
        drawDrop(ctx, objectX(drop.x), objectY(drop.y), radius * Math.max(.7, canvasWidth / 850), .9);
      });
    }

    if (sceneIndex === 1 || (sceneIndex === 2 && scenePhase < .35)) {
      const amount = sceneIndex === 1 ? smoothstep(0, .9, scenePhase) : 1;
      surfaceDrops.forEach((drop, index) => {
        if (index > surfaceDrops.length * amount) return;
        const radius = (1.2 + drop.size * 1.6) * Math.max(.7, canvasWidth / 850);
        drawDrop(ctx, objectX(drop.x), objectY(drop.y), radius, .9, false);
      });
    }

    if (sceneIndex === 2) {
      const ice = smoothstep(.1, .82, scenePhase);
      frostPoints.slice(0, Math.round(frostPoints.length * ice)).forEach((point, index) => {
        const x = objectX(point.x), y = objectY(point.y);
        const r = (2 + (index % 4) * 1.1) * Math.max(.7, canvasWidth / 850);
        ctx.save();
        ctx.globalAlpha = .28 + .48 * ice;
        ctx.strokeStyle = 'rgba(203,239,255,.9)';
        ctx.lineWidth = .7;
        ctx.shadowColor = '#b9e8ff'; ctx.shadowBlur = 6;
        for (let arm = 0; arm < 6; arm++) {
          const a = arm * Math.PI / 3;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55);
          ctx.lineTo(x + Math.cos(a - .45) * r * .8, y + Math.sin(a - .45) * r * .8);
          ctx.moveTo(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55);
          ctx.lineTo(x + Math.cos(a + .45) * r * .8, y + Math.sin(a + .45) * r * .8);
          ctx.stroke();
        }
        ctx.restore();
      });
      ctx.fillStyle = `rgba(162,220,255,${.06 + ice * .15})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    if (sceneIndex === 3) {
      const heat = smoothstep(.06, .72, scenePhase);
      ctx.save();
      ctx.globalAlpha = .12 + .2 * heat;
      ctx.strokeStyle = 'rgba(255,135,55,.74)';
      ctx.lineWidth = 1.3;
      for (let line = 0; line < 9; line++) {
        const baseY = canvasHeight * (.34 + line * .06);
        ctx.beginPath();
        for (let px = 0; px <= canvasWidth; px += 5) {
          const py = baseY + Math.sin(px * .018 + time * .0025 + line) * (3 + 8 * heat);
          if (px === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0, canvasWidth, canvasHeight);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    if (sceneIndex === 4) drawGraph(ctx, time, smoothstep(.05, .62, scenePhase));
  };

  const updateScene = () => {
    const sectionTop = sequence.getBoundingClientRect().top + window.scrollY;
    const availableScroll = Math.max(1, sequence.offsetHeight - stage.offsetHeight);
    scrollProgress = clamp01((window.scrollY - sectionTop) / availableScroll);
    const nextScene = Math.min(scenes.length - 1, Math.floor(scrollProgress * scenes.length));
    if (nextScene !== activeScene) {
      activeScene = nextScene;
      const scene = scenes[activeScene];
      stage.dataset.scene = scene.key;
      stageTitle.textContent = scene.title;
      stageDescription.textContent = scene.description;
      stageStep.textContent = scene.step;
      stageCaption.textContent = scene.caption;
      progressItems.forEach((item, index) => {
        item.classList.toggle('is-active', index === activeScene);
        item.setAttribute('aria-current', index === activeScene ? 'step' : 'false');
      });
    }
  };

  const render = time => {
    raf = 0;
    if (document.visibilityState === 'hidden') return;
    const viewport = window.innerHeight || 1;
    const inView = sequence.getBoundingClientRect().bottom > 0 && sequence.getBoundingClientRect().top < viewport;
    if (!inView) return;
    updateScene();
    const scenePosition = scrollProgress * (scenes.length - 1);
    const fromIndex = Math.min(scenes.length - 1, Math.floor(scenePosition));
    const toIndex = Math.min(scenes.length - 1, fromIndex + 1);
    const blend = smoothstep(0, 1, scenePosition - fromIndex);
    const width = equipment.clientWidth;
    const height = equipment.clientHeight;
    const poses = [
      { x: 0, y: 0, s: 1, r: 0 },
      { x: -.022 * width, y: -.012 * height, s: 1.025, r: .35 },
      { x: .018 * width, y: .014 * height, s: .975, r: -.4 },
      { x: -.016 * width, y: -.02 * height, s: 1.04, r: .3 },
      { x: .012 * width, y: .014 * height, s: 1.01, r: 0 }
    ];
    const a = poses[fromIndex], b = poses[toIndex];
    const lerp = (x, y) => x + (y - x) * blend;
    const vibration = activeScene === 4 && !motionPreference.matches ? smoothstep(.2, .9, scrollProgress * scenes.length - 4) : 0;
    const shakeX = Math.sin(time * .064) * vibration * 4.5;
    const shakeY = Math.sin(time * .089 + 1.2) * vibration * 2.7;
    equipment.style.setProperty('--equipment-x', `${lerp(a.x, b.x) + shakeX}px`);
    equipment.style.setProperty('--equipment-y', `${lerp(a.y, b.y) + shakeY}px`);
    equipment.style.setProperty('--equipment-scale', String(lerp(a.s, b.s)));
    equipment.style.setProperty('--equipment-rotate', `${lerp(a.r, b.r)}deg`);
    stage.style.setProperty('--scene-vibe', String(vibration));
    stage.style.setProperty('--heat-opacity', String(.24 + vibration * .3));
    if (lastTime === 0 || time - lastTime > 32) {
      drawEffects(time);
      lastTime = time;
    }
    raf = window.requestAnimationFrame(render);
  };
  const requestRender = () => { if (!raf) raf = window.requestAnimationFrame(render); };

  equipmentImage.addEventListener('load', () => { buildMask(); resizeCanvas(); requestRender(); }, { once: true });
  resizeCanvas();
  resizeObserver = new ResizeObserver(() => { resizeCanvas(); requestRender(); });
  resizeObserver.observe(equipment);
  window.addEventListener('scroll', () => { updateScene(); requestRender(); }, { passive: true });
  window.addEventListener('resize', () => { updateScene(); resizeCanvas(); requestRender(); }, { passive: true });
  document.addEventListener('visibilitychange', requestRender);
  updateScene();
  requestRender();
}
