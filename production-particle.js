(() => {
  const root = document.querySelector('[data-production-demo]');
  if (!root) return;

  const canvas = root.querySelector('[data-particle-canvas]');
  const frame = root.querySelector('[data-particle-frame]');
  const replay = root.querySelector('[data-particle-replay]');
  const replayLabel = root.querySelector('[data-particle-button-label]');
  const caption = root.querySelector('[data-particle-caption]');
  const status = root.querySelector('[data-particle-status]');
  const stepElements = [...root.querySelectorAll('[data-particle-step]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const context = canvas?.getContext('2d', { alpha: true });

  if (!canvas || !frame || !context || !replay) return;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const easeOut = value => 1 - Math.pow(1 - value, 3);
  const easeIn = value => value * value;
  const guideSize = 800;
  const particleLimit = window.innerWidth < 700 ? 4200 : 7600;

  let particles = [];
  let targets = [];
  let currentPositions = null;
  let sequenceId = 0;
  let animationRunning = false;
  let reducedFrame = 0;
  const drawBins = [[], [], [], []];

  const setStroke = (target, alpha = .78, width = 1.4) => {
    target.strokeStyle = `rgba(244, 246, 249, ${alpha})`;
    target.lineWidth = width;
    target.lineCap = 'round';
    target.lineJoin = 'round';
  };

  const line = (target, x1, y1, x2, y2, alpha = .78, width = 1.4) => {
    target.beginPath();
    target.moveTo(x1, y1);
    target.lineTo(x2, y2);
    setStroke(target, alpha, width);
    target.stroke();
  };

  const polyline = (target, points, alpha = .78, width = 1.4, close = false) => {
    target.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) target.moveTo(x, y);
      else target.lineTo(x, y);
    });
    if (close) target.closePath();
    setStroke(target, alpha, width);
    target.stroke();
  };

  const roundedRect = (target, x, y, width, height, radius, alpha = .78, lineWidth = 1.4) => {
    const r = Math.min(radius, width / 2, height / 2);
    target.beginPath();
    target.moveTo(x + r, y);
    target.lineTo(x + width - r, y);
    target.quadraticCurveTo(x + width, y, x + width, y + r);
    target.lineTo(x + width, y + height - r);
    target.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    target.lineTo(x + r, y + height);
    target.quadraticCurveTo(x, y + height, x, y + height - r);
    target.lineTo(x, y + r);
    target.quadraticCurveTo(x, y, x + r, y);
    target.closePath();
    setStroke(target, alpha, lineWidth);
    target.stroke();
  };

  const circle = (target, x, y, radius, alpha = .78, lineWidth = 1.4) => {
    target.beginPath();
    target.arc(x, y, radius, 0, Math.PI * 2);
    setStroke(target, alpha, lineWidth);
    target.stroke();
  };

  const drawPhoneGuide = target => {
    target.save();
    target.translate(400, 400);

    // Fine orbital waves echo the particle rings around the first Figma frame.
    for (let ring = 0; ring < 13; ring++) {
      const radiusX = 142 + ring * 9.6;
      const radiusY = 178 + ring * 10.2;
      target.beginPath();
      for (let point = 0; point <= 240; point++) {
        const angle = point / 240 * Math.PI * 2;
        const wave = 1 + .038 * Math.sin(angle * 4 + ring * .54) + .021 * Math.cos(angle * 7 - ring * .31);
        const x = Math.cos(angle) * radiusX * wave;
        const y = Math.sin(angle) * radiusY * wave;
        if (point === 0) target.moveTo(x, y);
        else target.lineTo(x, y);
      }
      target.closePath();
      setStroke(target, .2 + (ring % 4) * .025, .9);
      target.stroke();
    }

    target.save();
    target.rotate(-.27);
    roundedRect(target, -112, -187, 224, 374, 32, .88, 2.4);
    roundedRect(target, -98, -163, 196, 322, 23, .56, 1.25);
    line(target, -16, -174, 16, -174, .75, 2.2);
    circle(target, 27, -174, 3.2, .72, 1.4);
    circle(target, 0, 169, 14, .92, 2.1);

    // Two simplified user silhouettes and the add-contact marks on the screen.
    circle(target, -27, -35, 17, .92, 1.8);
    target.beginPath();
    target.moveTo(-67, 22);
    target.bezierCurveTo(-61, 2, -47, -6, -30, -7);
    target.bezierCurveTo(-13, -6, -2, 2, 4, 22);
    target.lineTo(4, 30);
    target.lineTo(-68, 30);
    target.closePath();
    setStroke(target, .92, 1.8);
    target.stroke();

    circle(target, 29, -48, 13, .74, 1.5);
    target.beginPath();
    target.moveTo(2, 4);
    target.bezierCurveTo(5, -13, 16, -20, 30, -20);
    target.bezierCurveTo(41, -20, 48, -14, 53, -5);
    setStroke(target, .68, 1.45);
    target.stroke();
    circle(target, 67, -34, 12, .9, 1.6);
    line(target, 67, -41, 67, -27, .9, 1.6);
    line(target, 60, -34, 74, -34, .9, 1.6);
    circle(target, 67, 8, 9, .8, 1.4);
    line(target, 67, 3, 67, 13, .8, 1.4);
    line(target, 62, 8, 72, 8, .8, 1.4);

    // Small controls keep the phone screen legible when it resolves to dots.
    line(target, -66, 56, 60, 56, .36, 1);
    line(target, -66, 70, 53, 70, .28, .9);
    line(target, -66, 84, 63, 84, .28, .9);
    line(target, -66, 98, 21, 98, .28, .9);
    target.restore();
    target.restore();
  };

  const drawBriefGuide = target => {
    target.save();
    target.translate(391, 401);
    target.rotate(-.18);

    const outer = [[-151, -207], [112, -230], [170, 194], [-109, 224]];
    const sheet = [[-133, -187], [95, -206], [145, 176], [-91, 200]];
    polyline(target, outer, .86, 2.2, true);
    polyline(target, [[-140, -195], [101, -216], [155, 183], [-99, 207]], .48, 1.1, true);
    polyline(target, sheet, .68, 1.3, true);

    // Clamp and the small ruler along the board edge.
    roundedRect(target, -45, -229, 115, 27, 5, .78, 1.5);
    roundedRect(target, -54, -236, 16, 37, 3, .78, 1.3);
    roundedRect(target, 70, -239, 15, 36, 3, .78, 1.3);
    line(target, -111, 183, 143, 159, .64, 1.1);
    for (let tick = 0; tick <= 34; tick++) {
      const x = -107 + tick * 7.1;
      const y = 190 - tick * .67;
      const length = tick % 5 === 0 ? 12 : 6;
      line(target, x, y, x + .8, y - length, .46, .8);
    }

    // Technical specification blocks, labels, and component diagrams.
    line(target, -116, -170, -14, -179, .76, 1.3);
    line(target, -116, -160, -32, -167, .47, 1);
    line(target, -116, -150, -51, -155, .42, .9);
    circle(target, 57, -155, 27, .78, 1.5);
    circle(target, 57, -155, 17, .5, 1);
    line(target, 31, -155, 83, -155, .32, .8);
    line(target, 57, -182, 57, -128, .32, .8);

    roundedRect(target, -118, -129, 133, 65, 2, .63, 1.1);
    line(target, -107, -113, 3, -122, .44, .9);
    line(target, -107, -102, -6, -110, .39, .85);
    line(target, -107, -91, -23, -98, .36, .85);
    line(target, -107, -80, -42, -85, .36, .85);
    roundedRect(target, 27, -117, 93, 53, 2, .54, 1);
    line(target, 38, -103, 106, -109, .4, .85);
    line(target, 38, -91, 99, -96, .35, .8);
    line(target, 38, -79, 87, -83, .35, .8);

    circle(target, -92, -32, 15, .72, 1.35);
    circle(target, 88, -26, 13, .72, 1.35);
    polyline(target, [[-69, -47], [-35, -59], [-8, -22], [-48, 3], [-77, -17]], .72, 1.35, true);
    circle(target, 17, 8, 40, .82, 1.8);
    circle(target, 17, 8, 27, .56, 1);
    line(target, -24, 8, 58, 8, .52, .9);
    line(target, 17, -35, 17, 51, .52, .9);
    line(target, -52, 63, 112, 49, .58, 1.1);
    line(target, -52, 74, 98, 61, .4, .9);
    line(target, -52, 85, 74, 74, .36, .8);

    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        const x = -78 + column * 18;
        const y = 108 + row * 13;
        roundedRect(target, x, y, 11, 8, 1, .58, .9);
      }
    }
    line(target, -20, 112, 112, 100, .53, 1);
    line(target, -20, 125, 96, 114, .4, .9);
    line(target, -20, 138, 80, 129, .36, .85);
    line(target, -108, 151, -17, 143, .52, .95);

    // A drafting pencil crosses the right side of the same point field.
    polyline(target, [[148, 178], [226, -188], [239, -221], [248, -216], [240, -179], [162, 183]], .94, 2.1, true);
    line(target, 180, 28, 219, 31, .54, .9);
    polyline(target, [[148, 178], [162, 183], [155, 198]], .9, 1.7, true);
    line(target, 227, -190, 241, -187, .85, 1.2);
    line(target, 230, -204, 244, -201, .85, 1.2);

    target.restore();
  };

  const extractCandidates = drawGuide => {
    const guide = document.createElement('canvas');
    guide.width = guideSize;
    guide.height = guideSize;
    const guideContext = guide.getContext('2d', { willReadFrequently: true });
    guideContext.clearRect(0, 0, guideSize, guideSize);
    drawGuide(guideContext);
    const pixels = guideContext.getImageData(0, 0, guideSize, guideSize).data;
    const candidates = [];
    const stride = 2;

    for (let y = 0; y < guideSize; y += stride) {
      for (let x = 0; x < guideSize; x += stride) {
        const alpha = pixels[(y * guideSize + x) * 4 + 3] / 255;
        if (alpha < .025) continue;
        const key = -Math.log(Math.max(Math.random(), Number.EPSILON)) / alpha;
        candidates.push({ x: (x + .5) / guideSize, y: (y + .5) / guideSize, alpha, key });
      }
    }
    candidates.sort((a, b) => a.key - b.key);
    return candidates.slice(0, particleLimit);
  };

  const setStep = (index, captionText, statusText) => {
    root.dataset.activeStep = String(index + 1);
    stepElements.forEach((item, itemIndex) => {
      const active = itemIndex === index;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    caption.textContent = captionText;
    status.textContent = statusText;
  };

  const resizeCanvas = () => {
    const bounds = frame.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(bounds.width * ratio);
    const height = Math.round(bounds.height * ratio);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawCurrent();
  };

  const makePointArray = candidates => {
    const result = new Float32Array(particles.length * 2);
    for (let index = 0; index < particles.length; index++) {
      result[index * 2] = candidates[index].x;
      result[index * 2 + 1] = candidates[index].y;
    }
    return result;
  };

  const makeInitialCloud = () => {
    const points = new Float32Array(particles.length * 2);
    for (let index = 0; index < particles.length; index++) {
      points[index * 2] = Math.random() * 1.24 - .12;
      points[index * 2 + 1] = Math.random() * 1.24 - .12;
    }
    return points;
  };

  const makeDissolvedCloud = points => {
    const scattered = new Float32Array(points.length);
    for (let index = 0; index < particles.length; index++) {
      const offset = index * 2;
      const x = points[offset];
      const y = points[offset + 1];
      const angle = Math.atan2(y - .5, x - .5) + (Math.random() - .5) * 1.2;
      const distance = .16 + Math.random() * .48;
      scattered[offset] = clamp(x + Math.cos(angle) * distance, -.1, 1.1);
      scattered[offset + 1] = clamp(y + Math.sin(angle) * distance, -.1, 1.1);
    }
    return scattered;
  };

  const draw = (from, to, progress = 1, easing = value => value) => {
    const bounds = frame.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    if (!width || !height || !particles.length) return;

    const eased = easing(progress);
    const scale = Math.min(width, height) * .86;
    const insetX = (width - scale) / 2;
    const insetY = (height - scale) / 2;
    currentPositions = currentPositions || new Float32Array(particles.length * 2);
    drawBins.forEach(bin => { bin.length = 0; });

    for (let index = 0; index < particles.length; index++) {
      const offset = index * 2;
      const particle = particles[index];
      let x = from[offset] + (to[offset] - from[offset]) * eased;
      let y = from[offset + 1] + (to[offset + 1] - from[offset + 1]) * eased;
      const turbulence = Math.sin(progress * Math.PI) * particle.sway;
      x += turbulence * particle.swayX;
      y += turbulence * particle.swayY;
      currentPositions[offset] = insetX + x * scale;
      currentPositions[offset + 1] = insetY + y * scale;
      drawBins[particle.bin].push(index);
    }
    paintCurrent();
  };

  const paintCurrent = () => {
    const bounds = frame.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !currentPositions) return;
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.fillStyle = '#f4f4f4';
    const alphaByBin = [.22, .38, .58, .82];

    drawBins.forEach((bin, binIndex) => {
      if (!bin.length) return;
      context.globalAlpha = alphaByBin[binIndex];
      context.beginPath();
      for (const index of bin) {
        const particle = particles[index];
        const offset = index * 2;
        context.moveTo(currentPositions[offset] + particle.size, currentPositions[offset + 1]);
        context.arc(currentPositions[offset], currentPositions[offset + 1], particle.size, 0, Math.PI * 2);
      }
      context.fill();
    });
    context.globalAlpha = 1;
  };

  const drawCurrent = () => {
    if (!currentPositions) return;
    paintCurrent();
  };

  const tween = (from, to, duration, easing, id) => new Promise(resolve => {
    const start = performance.now();
    const frameLoop = now => {
      if (id !== sequenceId || reducedMotion.matches) {
        resolve(false);
        return;
      }
      const progress = clamp((now - start) / duration, 0, 1);
      draw(from, to, progress, easing);
      if (progress < 1) requestAnimationFrame(frameLoop);
      else resolve(true);
    };
    requestAnimationFrame(frameLoop);
  });

  const pause = (duration, id) => new Promise(resolve => {
    window.setTimeout(() => resolve(id === sequenceId && !reducedMotion.matches), duration);
  });

  const renderStatic = index => {
    if (!targets.length) return;
    draw(targets[index], targets[index], 1);
    setStep(index, index === 0 ? '01 — Заявка' : '02 — Техническое задание', 'Статичный просмотр · анимация отключена');
    replayLabel.textContent = index === 0 ? 'Показать техническое задание' : 'Показать заявку';
    replay.disabled = false;
    reducedFrame = index;
  };

  const playDemo = async () => {
    if (animationRunning || !targets.length) return;
    const id = ++sequenceId;
    animationRunning = true;
    replay.disabled = true;
    replayLabel.textContent = 'Анимация идёт';
    const openingCloud = makeInitialCloud();
    const breakCloud = makeDissolvedCloud(targets[0]);

    setStep(0, '01 — Заявка', 'Частицы собирают изображение');
    let complete = await tween(openingCloud, targets[0], 2100, easeOut, id);
    if (complete) complete = await pause(900, id);
    if (complete) {
      setStep(0, '01 — Заявка', 'Образ распадается на частицы');
      complete = await tween(targets[0], breakCloud, 1350, easeIn, id);
    }
    if (complete) {
      setStep(1, '02 — Техническое задание', 'Частицы собирают новый образ');
      complete = await tween(breakCloud, targets[1], 2250, easeOut, id);
    }
    if (id !== sequenceId) return;
    animationRunning = false;
    if (reducedMotion.matches) {
      renderStatic(0);
      return;
    }
    if (complete) {
      draw(targets[1], targets[1], 1);
      setStep(1, '02 — Техническое задание', 'Образ собран');
      replayLabel.textContent = 'Повторить переход';
      replay.disabled = false;
    }
  };

  replay.addEventListener('click', () => {
    if (reducedMotion.matches) renderStatic(1 - reducedFrame);
    else playDemo();
  });

  reducedMotion.addEventListener?.('change', event => {
    if (event.matches) {
      sequenceId++;
      animationRunning = false;
      renderStatic(0);
    } else if (targets.length) {
      replayLabel.textContent = 'Повторить переход';
      replay.disabled = false;
    }
  });

  const initialize = () => {
    try {
      const firstCandidates = extractCandidates(drawPhoneGuide);
      const secondCandidates = extractCandidates(drawBriefGuide);
      const count = Math.min(firstCandidates.length, secondCandidates.length, particleLimit);
      if (count < 500) throw new Error('Not enough particles in the vector guides.');

      firstCandidates.length = count;
      secondCandidates.length = count;
      particles = Array.from({ length: count }, (_, index) => {
        const alpha = Math.max(firstCandidates[index].alpha, secondCandidates[index].alpha);
        return {
          size: .52 + Math.random() * .46,
          bin: Math.min(3, Math.floor((.25 + alpha * .75) * 4)),
          sway: .008 + Math.random() * .035,
          swayX: Math.random() - .5,
          swayY: Math.random() - .5
        };
      });
      targets = [makePointArray(firstCandidates), makePointArray(secondCandidates)];
      resizeCanvas();
      frame.classList.add('is-enhanced');
      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(frame);

      if (reducedMotion.matches) renderStatic(0);
      else playDemo();
    } catch (error) {
      console.error('Particle demo could not be initialized.', error);
      status.textContent = 'Не удалось подготовить анимацию';
      replayLabel.textContent = 'Анимация недоступна';
      replay.disabled = true;
    }
  };

  initialize();
})();
