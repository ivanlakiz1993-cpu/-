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
  let animationStartedAt = 0;
  let elapsedBeforePause = 0;
  let isAnimating = false;
  let isInView = false;
  let imageReady = false;

  function makePalette(red, green, blue, alpha, isOrange) {
    return Array.from({ length: 16 }, (_, index) => {
      const level = index / 15;
      const orangeMix = isOrange ? 0.04 + level * 0.38 : level * 0.88;
      const r = Math.round(red + (accent[0] - red) * orangeMix);
      const g = Math.round(green + (accent[1] - green) * orangeMix);
      const b = Math.round(blue + (accent[2] - blue) * orangeMix);
      const a = Math.min(0.86, alpha * (0.74 + level * 0.52));
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
      let brightest = -1;
      let red = 0;
      let green = 0;
      let blue = 0;

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
        if (luminance > brightest) {
          brightest = luminance;
          red = data[color];
          green = data[color + 1];
          blue = data[color + 2];
        }

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
      const baseAlpha = Math.min(0.58, 0.17 + Math.max(0, averageLuminance - 24) / 190);
      const isOrange = red > green * 1.12 && red > blue * 1.3;
      result.push({
        x: sumX / area,
        y: sumY / area,
        width: particleWidth,
        height: particleHeight,
        phase: ((minX * 17 + minY * 71) % 628) / 100,
        palette: makePalette(red, green, blue, baseAlpha, isOrange)
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

  function drawImageFallback() {
    if (!imageReady || !imageTransform) return;
    context.clearRect(0, 0, width, height);
    context.drawImage(
      source,
      imageTransform.offsetX,
      imageTransform.offsetY,
      source.naturalWidth * imageTransform.scaleX,
      source.naturalHeight * imageTransform.scaleY
    );
  }

  function drawFrame(elapsed) {
    if (!imageReady || !imageTransform || !width || !height) return;
    context.clearRect(0, 0, width, height);
    if (particles.length < 100) {
      drawImageFallback();
      return;
    }

    const phase = elapsed * 0.28;
    const centerX = width * (0.5 + 0.42 * Math.sin(phase));
    const centerY = height * (0.5 + 0.24 * Math.sin(phase * 1.45 + 0.8));
    const radiusX = width * 0.56;
    const radiusY = height * 0.92;

    for (const particle of particles) {
      const x = imageTransform.offsetX + particle.x * imageTransform.scaleX;
      const y = imageTransform.offsetY + particle.y * imageTransform.scaleY;
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const cloud = 1 - smoothstep(0.18, 1.22, distance);
      const ripple = 0.5 + 0.5 * Math.sin(distance * 13 - elapsed * 1.25 + particle.phase);
      const shimmer = 0.5 + 0.5 * Math.sin(elapsed * 0.9 + particle.phase);
      const glow = clamp(cloud * (0.72 + ripple * 0.28) + shimmer * 0.08);
      const paletteIndex = Math.round(glow * (particle.palette.length - 1));
      const sizePulse = 0.92 + glow * 0.2;
      const drawWidth = Math.max(1, particle.width * imageTransform.scaleX * sizePulse * 0.82);
      const drawHeight = Math.max(1, particle.height * imageTransform.scaleY * sizePulse * 0.82);

      context.fillStyle = particle.palette[paletteIndex];
      context.fillRect(x - drawWidth / 2, y - drawHeight / 2, drawWidth, drawHeight);
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
      const elapsed = elapsedBeforePause + (isAnimating ? (performance.now() - animationStartedAt) / 1000 : 0);
      drawFrame(elapsed);
    }
  }

  function animate(timestamp) {
    if (!isAnimating) return;
    const elapsed = elapsedBeforePause + (timestamp - animationStartedAt) / 1000;
    drawFrame(elapsed);
    animationFrame = window.requestAnimationFrame(animate);
  }

  function pauseAnimation() {
    if (!isAnimating) return;
    elapsedBeforePause += (performance.now() - animationStartedAt) / 1000;
    isAnimating = false;
    window.cancelAnimationFrame(animationFrame);
    drawFrame(elapsedBeforePause);
  }

  function syncAnimation() {
    const shouldAnimate = imageReady && isInView && !document.hidden && !reducedMotion.matches;
    if (shouldAnimate && !isAnimating) {
      isAnimating = true;
      animationStartedAt = performance.now();
      animationFrame = window.requestAnimationFrame(animate);
    } else if (!shouldAnimate) {
      pauseAnimation();
      if (imageReady && reducedMotion.matches) drawFrame(0);
    }
  }

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
