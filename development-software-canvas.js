(() => {
  const section = document.querySelector('.development-software');
  const canvas = section?.querySelector('.development-software__canvas');
  if (!section || !canvas) return;

  const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const source = new Image();
  source.decoding = 'async';
  const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--orange').trim();
  const accentMatch = /^#([\da-f]{6})$/i.exec(accentHex);
  const accent = accentMatch
    ? [0, 2, 4].map(offset => Number.parseInt(accentMatch[1].slice(offset, offset + 2), 16))
    : [255, 115, 13];

  const clamp = value => Math.min(1, Math.max(0, value));
  const smoothstep = (min, max, value) => {
    const amount = clamp((value - min) / (max - min));
    return amount * amount * (3 - 2 * amount);
  };
  const densityAtY = y => {
    const verticalProgress = clamp(y / height);
    const centerStrength = 1 - Math.abs(verticalProgress * 2 - 1);
    return 0.72 + smoothstep(0, 1, centerStrength) * 0.24;
  };

  let particles = [];
  let sourceParticles = [];
  let imageTransform = null;
  let defaultOrangeX = 0;
  let defaultOrangeY = 0;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let animationFrame = 0;
  let isAnimating = false;
  let isInView = false;
  let imageReady = false;
  let pointerInside = false;
  let cursorX = 0;
  let cursorY = 0;
  let cursorTargetX = 0;
  let cursorTargetY = 0;
  let cursorStrength = 0;
  let lastFrameAt = 0;
  let motionTime = 0;
  let frameDelta = 1 / 60;

  function makePalette(gray, alpha) {
    return Array.from({ length: 16 }, (_, index) => {
      const level = index / 15;
      const r = Math.round(gray + (accent[0] - gray) * level);
      const g = Math.round(gray + (accent[1] - gray) * level);
      const b = Math.round(gray + (accent[2] - gray) * level);
      const a = alpha + (0.88 - alpha) * level;
      return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    });
  }

  function extractParticles(image) {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) return [];

    sourceContext.drawImage(image, 0, 0);
    const { data } = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    const pixelCount = sourceWidth * sourceHeight;
    const eligible = new Uint8Array(pixelCount);
    const visited = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);

    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const color = pixel * 4;
      const luminance = data[color] * 0.2126 + data[color + 1] * 0.7152 + data[color + 2] * 0.0722;
      if (data[color + 3] > 180 && luminance > 22) eligible[pixel] = 1;
    }

    const result = [];
    for (let start = 0; start < pixelCount; start += 1) {
      if (!eligible[start] || visited[start]) continue;

      let head = 0;
      let tail = 0;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let sumLuminance = 0;
      let minX = sourceWidth;
      let minY = sourceHeight;
      let maxX = 0;
      let maxY = 0;

      visited[start] = 1;
      queue[tail++] = start;

      while (head < tail) {
        const pixel = queue[head++];
        const x = pixel % sourceWidth;
        const y = (pixel / sourceWidth) | 0;
        const color = pixel * 4;
        const luminance = data[color] * 0.2126 + data[color + 1] * 0.7152 + data[color + 2] * 0.0722;

        area += 1;
        sumX += x;
        sumY += y;
        sumLuminance += luminance;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        const firstX = Math.max(0, x - 1);
        const lastX = Math.min(sourceWidth - 1, x + 1);
        const firstY = Math.max(0, y - 1);
        const lastY = Math.min(sourceHeight - 1, y + 1);
        for (let neighborY = firstY; neighborY <= lastY; neighborY += 1) {
          const row = neighborY * sourceWidth;
          for (let neighborX = firstX; neighborX <= lastX; neighborX += 1) {
            const neighbor = row + neighborX;
            if (!visited[neighbor] && eligible[neighbor]) {
              visited[neighbor] = 1;
              queue[tail++] = neighbor;
            }
          }
        }
      }

      const particleWidth = maxX - minX + 1;
      const particleHeight = maxY - minY + 1;
      if (area < 3 || area > 420 || particleWidth > 32 || particleHeight > 32) continue;

      const densityRoll = Math.abs(Math.sin(sumX * 12.9898 + sumY * 78.233) * 43758.5453) % 1;

      const averageLuminance = sumLuminance / area;
      const baseGray = Math.max(82, Math.min(140, Math.round(76 + averageLuminance * 0.42)));
      const baseAlpha = Math.max(0.36, Math.min(0.58, 0.32 + averageLuminance / 800));
      result.push({
        x: sumX / area,
        y: sumY / area,
        width: particleWidth,
        height: particleHeight,
        densityRoll,
        phase: densityRoll * Math.PI * 2,
        heat: 0,
        palette: makePalette(baseGray, baseAlpha)
      });
    }

    return result;
  }

  function updateImageTransform() {
    const scale = Math.min(1, height / source.naturalHeight);
    const tileWidth = source.naturalWidth * scale;
    imageTransform = {
      scaleX: scale,
      scaleY: scale,
      offsetX: width < tileWidth ? (width - tileWidth) / 2 : 0,
      offsetY: 0
    };
    particles = [];
    for (let row = 0; row < Math.ceil(height / (source.naturalHeight * scale)); row += 1) {
      for (let column = 0; column < Math.ceil(width / tileWidth); column += 1) {
        for (const point of sourceParticles) {
          particles.push({
            ...point,
            x: point.x + column * source.naturalWidth,
            y: point.y + row * source.naturalHeight,
            phase: point.phase + column * 1.61 + row * 2.43,
            heat: 0
          });
        }
      }
    }
  }

  function updateDefaultOrangeSpot() {
    if (!particles.length || !imageTransform) return;

    const targetX = width * 0.5;
    const targetY = height * 0.5;
    let nearestDistance = Infinity;

    for (const particle of particles) {
      const x = imageTransform.offsetX + particle.x * imageTransform.scaleX;
      const y = imageTransform.offsetY + particle.y * imageTransform.scaleY;
      const keepProbability = densityAtY(y);
      if (particle.densityRoll > keepProbability) continue;
      const distance = (x - targetX) ** 2 + (y - targetY) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        defaultOrangeX = x;
        defaultOrangeY = y;
      }
    }
  }

  function drawRoundedSquare(x, y, squareWidth, squareHeight) {
    const radius = Math.min(squareWidth, squareHeight) * 0.18;
    context.beginPath();
    if (typeof context.roundRect === 'function') {
      context.roundRect(x, y, squareWidth, squareHeight, radius);
    } else {
      context.moveTo(x + radius, y);
      context.arcTo(x + squareWidth, y, x + squareWidth, y + squareHeight, radius);
      context.arcTo(x + squareWidth, y + squareHeight, x, y + squareHeight, radius);
      context.arcTo(x, y + squareHeight, x, y, radius);
      context.arcTo(x, y, x + squareWidth, y, radius);
      context.closePath();
    }
    context.fill();
  }

  function drawFrame() {
    if (!imageReady || !imageTransform || !width || !height) return;
    context.clearRect(0, 0, width, height);
    const glowRadius = Math.max(125, Math.min(width * 0.27, 460));
    const horizontalFade = width * 0.06;
    const verticalFade = height * 0.1;
    const time = reducedMotion.matches ? 0 : motionTime;
    const idleX = defaultOrangeX + Math.sin(time * 0.28) * width * 0.18;
    const idleY = defaultOrangeY + Math.sin(time * 0.39) * height * 0.22;
    const heatRise = 1 - Math.exp(-frameDelta / 0.09);
    const heatFall = 1 - Math.exp(-frameDelta / 0.36);
    const drift = reducedMotion.matches ? 0 : Math.min(width / 450, 2.5);

    for (const particle of particles) {
      const baseX = imageTransform.offsetX + particle.x * imageTransform.scaleX;
      const baseY = imageTransform.offsetY + particle.y * imageTransform.scaleY;
      const x = baseX + Math.sin(time * 0.55 + baseY * 0.012 + particle.phase) * drift;
      const y = baseY + Math.cos(time * 0.45 + baseX * 0.009 + particle.phase) * drift;
      const keepProbability = densityAtY(baseY);
      if (particle.densityRoll > keepProbability) continue;
      // Warp the light field, then let each dot cool independently: a soft
      // irregular wake follows the pointer instead of a solid circular spot.
      const warpX = Math.sin(y * 0.014 + time * 0.7) * glowRadius * 0.16;
      const warpY = Math.sin(x * 0.011 - time * 0.6) * glowRadius * 0.14;
      const distance = Math.hypot(x - cursorX + warpX, (y - cursorY + warpY) * 1.08);
      const cursorGlow = cursorStrength * (1 - smoothstep(glowRadius * 0.1, glowRadius, distance));
      const idleDistance = Math.hypot(x - idleX + warpX, y - idleY + warpY);
      const idleGlow = (1 - cursorStrength) * 0.55 * (1 - smoothstep(0, glowRadius * 0.8, idleDistance));
      const texture = 0.77 + Math.sin(x * 0.035 + y * 0.024 + time * 0.8) * 0.13 + Math.sin(particle.phase) * 0.1;
      const targetHeat = Math.max(cursorGlow, idleGlow) * texture;
      particle.heat = reducedMotion.matches ? targetHeat : particle.heat + (targetHeat - particle.heat) * (targetHeat > particle.heat ? heatRise : heatFall);
      const glow = clamp(particle.heat);
      const paletteIndex = Math.round(Math.sqrt(glow) * (particle.palette.length - 1));
      const sizePulse = 0.9 + glow * 0.16 + Math.sin(time * 0.65 + particle.phase) * 0.035;
      const drawWidth = Math.max(1, Math.min(9, particle.width * imageTransform.scaleX * sizePulse * 0.72));
      const drawHeight = Math.max(1, Math.min(9, particle.height * imageTransform.scaleY * sizePulse * 0.72));
      const edgeFade =
        smoothstep(0, horizontalFade, x) *
        smoothstep(0, horizontalFade, width - x) *
        smoothstep(0, verticalFade, y) *
        smoothstep(0, verticalFade, height - y);

      context.globalAlpha = edgeFade;
      context.fillStyle = particle.palette[paletteIndex];
      drawRoundedSquare(x - drawWidth / 2, y - drawHeight / 2, drawWidth, drawHeight);
    }
    context.globalAlpha = 1;
  }

  function resizeCanvas() {
    const bounds = section.getBoundingClientRect();
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (width === bounds.width && height === bounds.height && pixelRatio === nextRatio && imageTransform) return;
    width = bounds.width;
    height = bounds.height;
    pixelRatio = nextRatio;
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (imageReady) {
      updateImageTransform();
      updateDefaultOrangeSpot();
      drawFrame();
    }
  }

  function animate(timestamp) {
    if (!isAnimating) return;
    if (reducedMotion.matches || document.hidden || !isInView) {
      pauseAnimation();
      return;
    }
    const delta = lastFrameAt ? Math.min((timestamp - lastFrameAt) / 1000, 0.05) : 1 / 60;
    lastFrameAt = timestamp;
    frameDelta = delta;
    motionTime += delta;
    const easing = 1 - Math.exp(-delta * 7.5);
    cursorX += (cursorTargetX - cursorX) * easing;
    cursorY += (cursorTargetY - cursorY) * easing;
    const targetStrength = pointerInside ? 1 : 0;
    cursorStrength += (targetStrength - cursorStrength) * (1 - Math.exp(-delta * (pointerInside ? 7 : 4.5)));
    drawFrame();

    animationFrame = window.requestAnimationFrame(animate);
  }

  function pauseAnimation() {
    if (isAnimating) window.cancelAnimationFrame(animationFrame);
    isAnimating = false;
    lastFrameAt = 0;
    if (!pointerInside || reducedMotion.matches || document.hidden || !isInView) cursorStrength = 0;
    drawFrame();
  }

  function syncAnimation() {
    const shouldAnimate = imageReady && isInView && !document.hidden && !reducedMotion.matches;
    if (shouldAnimate && !isAnimating) {
      isAnimating = true;
      lastFrameAt = 0;
      animationFrame = window.requestAnimationFrame(animate);
    } else if (!shouldAnimate) {
      pauseAnimation();
    }
  }

  section.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || reducedMotion.matches) return;
    const bounds = section.getBoundingClientRect();
    cursorTargetX = Math.min(width, Math.max(0, event.clientX - bounds.left));
    cursorTargetY = Math.min(height, Math.max(0, event.clientY - bounds.top));
    if (!pointerInside) {
      cursorX = cursorTargetX;
      cursorY = cursorTargetY;
    }
    pointerInside = true;
    syncAnimation();
  }, { passive: true });

  section.addEventListener('pointerleave', () => {
    pointerInside = false;
    syncAnimation();
  });

  source.addEventListener('load', () => {
    if (imageReady) return;
    imageReady = true;
    try {
      sourceParticles = extractParticles(source);
    } catch {
      sourceParticles = [];
    }
    resizeCanvas();
    syncAnimation();
  }, { once: true });

  source.addEventListener('error', () => {
    canvas.hidden = true;
  }, { once: true });

  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(section);
  window.addEventListener('resize', resizeCanvas, { passive: true });
  document.addEventListener('visibilitychange', syncAnimation);
  reducedMotion.addEventListener?.('change', syncAnimation);
  if (!reducedMotion.addEventListener) reducedMotion.addListener(syncAnimation);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      isInView = entries.some(entry => entry.isIntersecting);
      syncAnimation();
    }, { rootMargin: '0px' });
    observer.observe(section);
  } else {
    isInView = true;
  }

  resizeCanvas();
  source.src = canvas.dataset.particleSource;
})();
