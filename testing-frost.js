// Frost is a surface material on the shared device, never a replacement image.
// The reference supplies the ice detail; a seeded growth field controls when
// each patch crystallises. All coordinates below are intrinsic image pixels.
(() => {
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = (from, to, value) => {
    const t = clamp((value - from) / (to - from));
    return t * t * (3 - 2 * t);
  };
  const hash = (x, y) => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const u = smooth(0, 1, x - ix);
    const v = smooth(0, 1, y - iy);
    const a = hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u;
    const b = hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u;
    return a * (1 - v) + b * v;
  };
  const makeCanvas = (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };
  const yieldToPage = () => new Promise(resolve => setTimeout(resolve, 0));

  async function buildGrowthField(material, basePixels, width, height) {
    const count = width * height;
    const arrival = new Float32Array(count).fill(Infinity);
    const cost = new Float32Array(count);
    const allowed = new Uint8Array(count);
    const pixels = material.getContext('2d').getImageData(0, 0, width, height).data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        allowed[index] = basePixels[index * 4 + 3] > 32 || pixels[index * 4 + 3] > 24;
        const warp = noise(x / 37 + 8, y / 37 + 4) * 10;
        const coarse = noise((x + warp) / 22, (y - warp) / 22);
        const fine = noise(x / 3.7 + 19, y / 3.7);
        // Frost travels faster through cold crystalline patches. The varying
        // speed creates connected, branching fronts rather than parallel wipes.
        cost[index] = (0.65 + coarse * coarse * 5 + fine * 1.9) *
          (1.2 - pixels[index * 4 + 3] / 255 * 0.55);
      }
    }

    const heap = [];
    const push = (index, time) => {
      let at = heap.length;
      const item = { index, time };
      heap.push(item);
      while (at > 0) {
        const parent = (at - 1) >>> 1;
        if (heap[parent].time <= time) break;
        heap[at] = heap[parent];
        at = parent;
      }
      heap[at] = item;
    };
    const pop = () => {
      const first = heap[0];
      const last = heap.pop();
      if (heap.length) {
        let at = 0;
        while (at * 2 + 1 < heap.length) {
          let child = at * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].time < heap[child].time) child++;
          if (heap[child].time >= last.time) break;
          heap[at] = heap[child];
          at = child;
        }
        heap[at] = last;
      }
      return first;
    };
    // Cold starts at scattered lid joints and corners, with different delays.
    const origins = [
      [28, 354, 0], [585, 199, 12], [1088, 40, 3], [1518, 225, 25],
      [340, 592, 7], [933, 397, 33], [60, 655, 28], [367, 925, 44],
      [1508, 533, 54], [335, 750, 35], [1238, 320, 41]
    ];
    for (const [px, py, delay] of origins) {
      const cx = Math.round(px / 1561 * width);
      const cy = Math.round(py / 1008 * height);
      let nearest = -1;
      let best = Infinity;
      for (let y = Math.max(0, cy - 4); y <= Math.min(height - 1, cy + 4); y++) {
        for (let x = Math.max(0, cx - 4); x <= Math.min(width - 1, cx + 4); x++) {
          const index = y * width + x;
          const distance = (x - cx) ** 2 + (y - cy) ** 2;
          if (allowed[index] && distance < best) { nearest = index; best = distance; }
        }
      }
      if (nearest >= 0) { arrival[nearest] = delay; push(nearest, delay); }
    }

    let visited = 0;
    while (heap.length) {
      if (++visited % 4096 === 0) await yieldToPage();
      const { index, time } = pop();
      if (time > arrival[index] + 0.0001) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
          const next = index + dy * width + dx;
          if (!allowed[next]) continue;
          const candidate = time + (cost[index] + cost[next]) * 0.5 * (dx && dy ? Math.SQRT2 : 1);
          if (candidate < arrival[next]) {
            arrival[next] = candidate;
            push(next, arrival[next]);
          }
        }
      }
    }

    const times = Array.from(arrival).filter(Number.isFinite).sort((a, b) => a - b);
    const duration = times[Math.floor(times.length * 0.98)] || 1;
    for (let i = 0; i < count; i++) {
      const crystal = pixels[i * 4 + 3] / 255;
      // Fine frost arrives first. Thicker ice and hanging tips mature later.
      const iceDelay = (1 - crystal) * 0.09 + (basePixels[i * 4 + 3] < 32 ? 0.12 : 0);
      const x = i % width;
      const y = Math.floor(i / width);
      const branchTips = (noise(x / 2.8, y / 2.8) - 0.5) * 0.035;
      arrival[i] = Number.isFinite(arrival[i])
        ? Math.max(0.005, Math.min(0.88, 0.01 + arrival[i] / duration * 0.77 + iceDelay + branchTips))
        : 0.86;
    }
    return arrival;
  }

  window.createTestingFrost = ({ canvas, baseImage, textureSrc }) => {
    const context = canvas?.getContext('2d');
    if (!context || !baseImage) return null;
    let material;
    let mask;
    let maskContext;
    let maskPixels;
    let arrival;
    let lastProgress = -1;
    let requestedProgress = 0;

    const clear = () => {
      requestedProgress = 0;
      if (lastProgress !== 0) context.clearRect(0, 0, canvas.width, canvas.height);
      lastProgress = 0;
    };
    const draw = progress => {
      requestedProgress = clamp(progress);
      if (!material || requestedProgress === lastProgress) return;
      if (requestedProgress <= 0.001) { clear(); return; }
      lastProgress = requestedProgress;
      const data = maskPixels.data;
      for (let i = 0; i < arrival.length; i++) {
        const age = requestedProgress - arrival[i];
        const edge = smooth(0, 0.022, age);
        const density = 0.55 + 0.45 * smooth(0.01, 0.075, age);
        data[i * 4 + 3] = Math.round(255 * edge * density);
      }
      maskContext.putImageData(maskPixels, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = 'source-over';
      context.drawImage(material, 0, 0);
      context.globalCompositeOperation = 'destination-in';
      context.drawImage(mask, 0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = 'source-over';
    };

    const ready = (async () => {
      const texture = new Image();
      texture.decoding = 'async';
      texture.src = textureSrc;
      await Promise.all([texture.decode(), baseImage.decode()]);
      // Keep the source image aspect ratio, including on narrow screens.
      canvas.width = baseImage.naturalWidth;
      canvas.height = baseImage.naturalHeight;
      const source = makeCanvas(canvas.width, canvas.height);
      const sourceContext = source.getContext('2d', { willReadFrequently: true });
      sourceContext.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      const basePixels = sourceContext.getImageData(0, 0, canvas.width, canvas.height);
      sourceContext.clearRect(0, 0, canvas.width, canvas.height);
      sourceContext.drawImage(texture, 0, 0, canvas.width, canvas.height);
      const icePixels = sourceContext.getImageData(0, 0, canvas.width, canvas.height);
      const base = basePixels.data;
      const ice = icePixels.data;
      const exposure = Math.max(0.55, Number.parseFloat(getComputedStyle(baseImage).opacity) || 1);
      for (let i = 0; i < ice.length; i += 4) {
        if (i && i % (canvas.width * 4 * 48) === 0) await yieldToPage();
        const luminance = ice[i] * 0.2126 + ice[i + 1] * 0.7152 + ice[i + 2] * 0.0722;
        const baseLight = base[i] * 0.2126 + base[i + 1] * 0.7152 + base[i + 2] * 0.0722;
        const cold = ice[i + 2] - ice[i];
        const coldChange = cold - (base[i + 2] - base[i]);
        const addedCrystal = smooth(5, 52, luminance - baseLight);
        const frozenFilm = smooth(3, 23, coldChange) * 0.82;
        const maxChannel = Math.max(ice[i], ice[i + 1], ice[i + 2]);
        const minChannel = Math.min(ice[i], ice[i + 1], ice[i + 2]);
        // Remove colour-key fringe and retain the original labels, metal
        // connectors and green LED. Only added cold material is extracted.
        const neutral = 1 - smooth(0.38, 0.68, (maxChannel - minChannel) / Math.max(1, maxChannel));
        const coverage = Math.max(addedCrystal, frozenFilm) * smooth(24, 72, luminance) * neutral;
        ice[i + 3] = Math.round(ice[i + 3] * coverage);
        ice[i] *= exposure;
        ice[i + 1] *= exposure;
        ice[i + 2] *= exposure;
      }
      const preparedMaterial = makeCanvas(canvas.width, canvas.height);
      preparedMaterial.getContext('2d').putImageData(icePixels, 0, 0);
      // Only the growth mask is small; the crystal texture retains its native
      // resolution. No blur is applied to the visible frost or device.
      mask = makeCanvas(480, Math.round(480 * canvas.height / canvas.width));
      maskContext = mask.getContext('2d');
      maskContext.drawImage(baseImage, 0, 0, mask.width, mask.height);
      const smallBase = maskContext.getImageData(0, 0, mask.width, mask.height).data;
      maskContext.clearRect(0, 0, mask.width, mask.height);
      maskContext.drawImage(preparedMaterial, 0, 0, mask.width, mask.height);
      arrival = await buildGrowthField(mask, smallBase, mask.width, mask.height);
      maskPixels = maskContext.createImageData(mask.width, mask.height);
      material = preparedMaterial;
      lastProgress = -1;
      draw(requestedProgress);
      return true;
    })().catch(() => false);

    return { draw, clear, ready };
  };
})();
