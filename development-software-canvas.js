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

  let particles = [];
  let imageTransform = null;
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

  function makePalette(gray, alpha) {
    return Array.from({ length: 16 }, (_, index) => {
      const level = index / 15;
      const r = Math.round(gray + (accent[0] - gray) * level);
      const g = Math.round(gray + (accent[1] - gray) * level);
      const b = Math.round(gray + (accent[2] - gray) * level);
      const a = Math.min(0.9, alpha * (0.82 + level * 0.32));
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
      if (data[color + 3] > 180 && luminance > 27) eligible[pixel] = 1;
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

      const averageLuminance = sumLuminance / area;
      const baseGray = Math.max(74, Math.min(128, Math.round(72 + averageLuminance * 0.55)));
      const baseAlpha = Math.max(0.4, Math.min(0.68, 0.38 + averageLuminance / 500));
      result.push({
        x: sumX / area,
        y: sumY / area,
        width: particleWidth,
        height: particleHeight,
        palette: makePalette(baseGray, baseAlpha)
      });
    }

    return result;
  }

  function updateImageTransform() {
    if (width >= 75 * 16) {
      const scale = Math.max(width / source.naturalWidth, height / source.naturalHeight);
      imageTransform = {
        scaleX: scale,
        scaleY: scale,
        offsetX: (width - source.naturalWidth * scale) / 2,
        offsetY: (height - source.naturalHeight * scale) / 2
      };
      return;
    }

    imageTransform = {
      scaleX: width * 1.1669 / source.naturalWidth,
      scaleY: height * 2.3 / source.naturalHeight,
      offsetX: -width * 0.0835,
      offsetY: 0
    };
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
    const glowRadius = Math.max(88, Math.min(width * 0.27, 430));

    for (const particle of particles) {
      const x = imageTransform.offsetX + particle.x * imageTransform.scaleX;
      const y = imageTransform.offsetY + particle.y * imageTransform.scaleY;
      const distance = Math.hypot(x - cursorX, y - cursorY);
      const glow = pointerStrength * (1 - smoothstep(glowRadius * 0.08, glowRadius, distance));
      const paletteIndex = Math.round(glow * (particle.palette.length - 1));
      const sizePulse = 0.88 + glow * 0.22;
      const drawWidth = Math.max(1, particle.width * imageTransform.scaleX * sizePulse * 0.82);
      const drawHeight = Math.max(1, particle.height * imageTransform.scaleY * sizePulse * 0.82);

      context.fillStyle = particle.palette[paletteIndex];
      drawRoundedSquare(x - drawWidth / 2, y - drawHeight / 2, drawWidth, drawHeight);
    }
  }

  function resizeCanvas() {
    const bounds = section.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (imageReady) {
      updateImageTransform();
      drawFrame();
    }
  }

  function animate(timestamp) {
    if (!isAnimating) return;
    const delta = lastFrameAt ? Math.min((timestamp - lastFrameAt) / 1000, 0.05) : 1 / 60;
    lastFrameAt = timestamp;
    const easing = 1 - Math.exp(-delta * 18);
    cursorX += (cursorTargetX - cursorX) * easing;
    cursorY += (cursorTargetY - cursorY) * easing;
    const targetStrength = pointerInside ? 1 : 0;
    cursorStrength += (targetStrength - cursorStrength) * (1 - Math.exp(-delta * (pointerInside ? 12 : 9)));
    drawFrame();

    const cursorDistance = Math.hypot(cursorTargetX - cursorX, cursorTargetY - cursorY);
    const settled = cursorDistance < 0.35 && Math.abs(targetStrength - cursorStrength) < 0.01;
    if (settled && pointerInside) {
      cursorX = cursorTargetX;
      cursorY = cursorTargetY;
      cursorStrength = 1;
      drawFrame();
      isAnimating = false;
      lastFrameAt = 0;
      return;
    }
    if (settled && !pointerInside) {
      cursorStrength = 0;
      pauseAnimation();
      return;
    }
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
    const shouldAnimate = imageReady && isInView && !document.hidden && !reducedMotion.matches && (pointerInside || cursorStrength > 0.01);
    if (shouldAnimate && !isAnimating) {
      isAnimating = true;
      lastFrameAt = 0;
      animationFrame = window.requestAnimationFrame(animate);
    } else if (!shouldAnimate) {
      pauseAnimation();
    }
  }

  section.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
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
      particles = extractParticles(source);
    } catch {
      particles = [];
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
    }, { rootMargin: '120px 0px' });
    observer.observe(section);
  } else {
    isInView = true;
  }

  resizeCanvas();
  source.src = canvas.dataset.particleSource;
})();
