(() => {
  const section = document.querySelector('.production-how-we-work');
  const stage = section?.querySelector('[data-particle-stage]');
  const frame = section?.querySelector('[data-particle-frame]');
  const canvas = frame?.querySelector('[data-particle-canvas]');
  const steps = section ? [...section.querySelectorAll('.production-how-we-work__step')] : [];
  const context = canvas?.getContext('2d', { alpha: true });

  if (!section || !stage || !frame || !canvas || !context || !steps.length) return;

  // Add each later image to its matching list item with data-particle-src.
  // Only consecutive illustrated steps take part in the scroll sequence.
  const sources = [];
  for (const step of steps) {
    if (!step.dataset.particleSrc) break;
    sources.push(step.dataset.particleSrc);
  }
  if (!sources.length) return;

  const desktop = window.matchMedia('(min-width: 109rem)');
  const mobile = window.matchMedia('(max-width: 47.9375rem)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const ease = value => value * value * (3 - 2 * value);
  const guideSize = 1024;
  const maxParticles = 64000;
  const holdViewports = 1;
  const transitionViewports = .75;
  const stepActivationThreshold = .75;
  const stepDeactivationThreshold = .25;
  const sequenceViewports = sources.length * holdViewports + (sources.length - 1) * transitionViewports;

  let targets = [];
  let targetLights = [];
  let cloud = null;
  let particleDepth = null;
  let particleRingMask = null;
  let particleRingRadius = null;
  let canvasReady = false;
  let preparing = false;
  let inView = false;
  let animationFrame = 0;
  let introStart = null;
  let displayedTravel = 0;
  let requestedTravel = 0;
  let activeStep = 0;
  let lastTick = 0;
  let lastPaint = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pointerX = null;
  let pointerY = null;

  const randomGenerator = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };

  const resolveSequence = progress => {
    let remaining = clamp(progress) * sequenceViewports;
    for (let index = 0; index < sources.length - 1; index++) {
      if (remaining < holdViewports) return { travel: index, activeStep: index };
      remaining -= holdViewports;
      if (remaining < transitionViewports) {
        return { travel: index + remaining / transitionViewports, activeStep: index };
      }
      remaining -= transitionViewports;
    }
    const lastStep = sources.length - 1;
    return { travel: lastStep, activeStep: lastStep };
  };

  const loadImage = source => new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Particle image failed to load: ${source}`));
    image.src = source;
  });

  const sampleImage = (image, imageIndex) => {
    const guide = document.createElement('canvas');
    guide.width = guideSize;
    guide.height = guideSize;
    const guideContext = guide.getContext('2d', { willReadFrequently: true });
    if (!guideContext) throw new Error('Could not create the particle guide.');

    const scale = Math.min(guideSize / image.naturalWidth, guideSize / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    // This offscreen guide is only used to read the source pixels; the visible frame is particles only.
    guideContext.drawImage(image, (guideSize - width) / 2, (guideSize - height) / 2, width, height);
    const pixels = guideContext.getImageData(0, 0, guideSize, guideSize).data;
    const random = randomGenerator(73013 + imageIndex * 1009);
    const candidates = [];

    for (let y = 0; y < guideSize; y += 2) {
      for (let x = 0; x < guideSize; x += 2) {
        const offset = (y * guideSize + x) * 4;
        const alpha = pixels[offset + 3] / 255;
        const light = (pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722) / 255;
        const weight = alpha * light;
        if (weight < .022) continue;
        candidates.push({
          x: (x + 1) / guideSize,
          y: (y + 1) / guideSize,
          brightness: weight,
          key: -Math.log(Math.max(random(), 1e-8)) / weight
        });
      }
    }

    candidates.sort((first, second) => first.key - second.key);
    if (candidates.length < 700) throw new Error('A particle image needs a lighter, detailed subject.');
    return candidates.length > maxParticles ? candidates.slice(0, maxParticles) : candidates;
  };

  const initializeParticles = samples => {
    const count = Math.min(maxParticles, ...samples.map(sample => sample.length));
    const random = randomGenerator(10921);
    targets = samples.map(sample => {
      const points = new Float32Array(count * 2);
      for (let index = 0; index < count; index++) {
        points[index * 2] = sample[index].x;
        points[index * 2 + 1] = sample[index].y;
      }
      return points;
    });
    targetLights = samples.map(sample => {
      const lights = new Float32Array(count);
      for (let index = 0; index < count; index++) lights[index] = sample[index].brightness;
      return lights;
    });

    cloud = new Float32Array(count * 2);
    particleDepth = new Float32Array(count);
    particleRingMask = new Uint8Array(count);
    particleRingRadius = new Float32Array(count);

    for (let index = 0; index < count; index++) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * .7;
      cloud[index * 2] = .5 + Math.cos(angle) * radius;
      cloud[index * 2 + 1] = .5 + Math.sin(angle) * radius;
      particleDepth[index] = random();
      const initialX = samples[0][index].x - .5;
      const initialY = samples[0][index].y - .5;
      particleRingRadius[index] = Math.hypot(initialX, initialY);
      particleRingMask[index] = particleRingRadius[index] > .31 ? 1 : 0;
    }
  };

  const setActiveStep = index => {
    if (index === activeStep) return;
    activeStep = index;
    steps.forEach((step, stepIndex) => {
      const active = stepIndex === index;
      step.classList.toggle('is-complete', stepIndex < index);
      step.classList.toggle('is-active', active);
      if (active) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    const description = steps[index]?.querySelector('.production-how-we-work__description')?.textContent?.trim();
    if (description) canvas.setAttribute('aria-label', `Частицы образуют иллюстрацию этапа ${index + 1}: ${description}`);
  };

  const resizeCanvas = () => {
    if (!canvasReady || !desktop.matches) return;
    const bounds = frame.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    canvasWidth = bounds.width;
    canvasHeight = bounds.height;
    paint(performance.now());
  };

  const paint = now => {
    if (!canvasReady || !canvasWidth || !canvasHeight || !targets.length) return;
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    const count = targets[0].length / 2;
    const travel = clamp(displayedTravel, 0, targets.length - 1);
    const firstStepInfluence = clamp(1 - travel);
    const fromIndex = Math.min(targets.length - 1, Math.floor(travel));
    const toIndex = Math.min(targets.length - 1, fromIndex + 1);
    const from = targets[fromIndex];
    const to = targets[toIndex];
    const fromLights = targetLights[fromIndex];
    const toLights = targetLights[toIndex];
    const fraction = travel - fromIndex;
    const toCloud = fraction < .5;
    const phase = toCloud ? ease(fraction * 2) : ease((fraction - .5) * 2);
    const intro = reducedMotion.matches ? 1 : introStart === null ? 0 : ease(clamp((now - introStart) / 1550));
    const opacity = (.26 + intro * .74) * (toIndex === fromIndex ? 1 : .3 + .7 * Math.abs(fraction * 2 - 1));
    const size = Math.min(canvasWidth, canvasHeight);
    const left = (canvasWidth - size) / 2;
    const top = (canvasHeight - size) / 2;

    context.fillStyle = '#e5e8eb';
    context.globalCompositeOperation = 'lighter';
    for (let index = 0; index < count; index++) {
      const offset = index * 2;
      let x = from[offset];
      let y = from[offset + 1];
      let light = fromLights[index];

      if (toIndex !== fromIndex && fraction > 0) {
        if (toCloud) {
          x += (cloud[offset] - x) * phase;
          y += (cloud[offset + 1] - y) * phase;
          light *= 1 - phase;
        } else {
          x = cloud[offset] + (to[offset] - cloud[offset]) * phase;
          y = cloud[offset + 1] + (to[offset + 1] - cloud[offset + 1]) * phase;
          light = toLights[index] * phase;
        }
      }

      x = cloud[offset] + (x - cloud[offset]) * intro;
      y = cloud[offset + 1] + (y - cloud[offset + 1]) * intro;
      let screenX = left + x * size;
      let screenY = top + y * size;
      let ringPulse = 0;
      const depth = particleDepth[index];

      if (particleRingMask[index] && firstStepInfluence > 0 && !reducedMotion.matches) {
        const centerX = left + size / 2;
        const centerY = top + size / 2;
        const relativeX = screenX - centerX;
        const relativeY = screenY - centerY;
        const radius = Math.max(1, Math.hypot(relativeX, relativeY));
        ringPulse = Math.sin(now * .0018) * firstStepInfluence;
        const pulseOffset = ringPulse * (2 + particleRingRadius[index] * 5);
        screenX += relativeX / radius * pulseOffset;
        screenY += relativeY / radius * pulseOffset;
      }

      if (!reducedMotion.matches && pointerX !== null && pointerY !== null) {
        const distanceX = screenX - pointerX;
        const distanceY = screenY - pointerY;
        const distance = Math.hypot(distanceX, distanceY);
        const influenceRadius = 150;
        if (distance > 0 && distance < influenceRadius) {
          const influence = Math.pow(1 - distance / influenceRadius, 2);
          const ripple = Math.sin(distance * .055 - now * .004);
          const ringBoost = particleRingMask[index] ? 1 + .25 * firstStepInfluence : 1;
          const push = influence * (27 + ripple * 11 + depth * 8) * ringBoost;
          const swirl = influence * Math.sin(distance * .035 - now * .0025) * 15 * ringBoost;
          screenX += distanceX / distance * push - distanceY / distance * swirl;
          screenY += distanceY / distance * push + distanceX / distance * swirl;
        }
      }

      const baseAlpha = opacity * (.12 + light * .72);
      const dot = (.45 + light * .85) * (particleRingMask[index] ? 1 + ringPulse * .2 : 1);
      context.globalAlpha = particleRingMask[index]
        ? Math.min(1, baseAlpha + opacity * (.08 + (ringPulse + 1) * .06) * firstStepInfluence)
        : baseAlpha;
      context.fillRect(screenX, screenY, dot, dot);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  };

  const tick = now => {
    animationFrame = 0;
    if (!canvasReady || !desktop.matches || !inView || document.hidden) return;
    const elapsed = Math.min(64, now - (lastTick || now));
    lastTick = now;
    displayedTravel += (requestedTravel - displayedTravel) * (1 - Math.exp(-elapsed / 260));
    if (Math.abs(requestedTravel - displayedTravel) < .0001) displayedTravel = requestedTravel;
    const direction = Math.sign(requestedTravel - displayedTravel);
    let nextStep = activeStep;
    if (direction > 0) {
      while (nextStep < targets.length - 1 && displayedTravel >= nextStep + stepActivationThreshold) nextStep++;
    } else if (direction < 0) {
      while (nextStep > 0 && displayedTravel <= nextStep - 1 + stepDeactivationThreshold) nextStep--;
    }
    setActiveStep(clamp(nextStep, 0, targets.length - 1));
    if (now - lastPaint > 28) {
      paint(now);
      lastPaint = now;
    }
    if (!reducedMotion.matches) animationFrame = requestAnimationFrame(tick);
  };

  const schedulePaint = () => {
    if (!canvasReady || !desktop.matches || !inView || document.hidden) return;
    if (reducedMotion.matches) {
      displayedTravel = Math.max(0, activeStep);
      paint(performance.now());
    } else if (!animationFrame) {
      animationFrame = requestAnimationFrame(tick);
    }
  };

  const updateRunway = () => {
    if (sources.length < 2) return;
    const runwayViewports = sequenceViewports + 1;
    const minimumStageHeight = mobile.matches ? 36.75 : 33.4375;
    section.style.setProperty('--particle-runway', `${runwayViewports * 100}svh`);
    section.style.setProperty('--particle-runway-min', `${runwayViewports * minimumStageHeight}rem`);
  };

  const updateScroll = () => {
    if (sources.length < 2) return;
    const sectionTop = section.getBoundingClientRect().top + window.scrollY;
    const scrollRange = Math.max(1, section.offsetHeight - stage.offsetHeight);
    const scrollProgress = clamp((window.scrollY - sectionTop) / scrollRange);
    const sequence = resolveSequence(scrollProgress);
    requestedTravel = sequence.travel;
    if (reducedMotion.matches) setActiveStep(sequence.activeStep);
    schedulePaint();
  };

  const ensureCanvas = async () => {
    if (!desktop.matches || canvasReady || preparing) return;
    preparing = true;
    try {
      const images = await Promise.all(sources.map(loadImage));
      const samples = images.map(sampleImage);
      initializeParticles(samples);
      canvasReady = true;
      resizeCanvas();
      canvas.hidden = false;
      frame.classList.add('is-particle-ready');
      if (inView) introStart = performance.now();
      schedulePaint();
    } catch (error) {
      console.error('The particle illustration could not be prepared.', error);
    } finally {
      preparing = false;
    }
  };

  frame.addEventListener('pointermove', event => {
    if (!canvasReady || reducedMotion.matches) return;
    const bounds = frame.getBoundingClientRect();
    pointerX = event.clientX - bounds.left;
    pointerY = event.clientY - bounds.top;
    schedulePaint();
  });
  frame.addEventListener('pointerleave', () => {
    pointerX = null;
    pointerY = null;
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) {
        if (canvasReady && introStart === null) introStart = performance.now();
        schedulePaint();
      } else if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }, { threshold: .01 });
    observer.observe(stage);
  } else {
    inView = true;
  }

  const onDesktopChange = () => {
    if (desktop.matches) {
      ensureCanvas();
      resizeCanvas();
      schedulePaint();
    } else if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  };

  desktop.addEventListener?.('change', onDesktopChange);
  mobile.addEventListener?.('change', () => {
    updateRunway();
    updateScroll();
  });
  reducedMotion.addEventListener?.('change', () => {
    if (reducedMotion.matches && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    schedulePaint();
  });
  document.addEventListener('visibilitychange', schedulePaint);

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeCanvas).observe(frame);
  else window.addEventListener('resize', resizeCanvas);

  if (sources.length > 1) {
    updateRunway();
    section.classList.add('is-particle-sequence');
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);
    updateScroll();
  } else {
    setActiveStep(0);
  }

  ensureCanvas();
})();
