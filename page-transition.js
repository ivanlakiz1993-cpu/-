(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const enterKey = 'site-mosaic-enter';
  let entering = false;
  try {
    const timestamp = Number(sessionStorage.getItem(enterKey));
    sessionStorage.removeItem(enterKey);
    entering = timestamp && Date.now() - timestamp < 60000;
  } catch {}
  if (reducedMotion.matches) return;
  window.siteMosaicIncoming = Boolean(entering);

  const root = document.createElement('div');
  root.className = 'mosaic-transition';
  root.setAttribute('aria-hidden', 'true');
  const cells = [];
  const animations = [];
  const spans = [2, 1, 2, 1, 3, 1, 2];
  let navigating = false;
  for (let row = 0; row < 6; row++) {
    let column = 0;
    let sequence = row % spans.length;
    while (column < 12) {
      const span = Math.min(spans[sequence++ % spans.length], 12 - column);
      const tile = document.createElement('span');
      tile.className = 'mosaic-transition__tile';
      tile.style.gridRow = String(row + 1);
      tile.style.gridColumn = (column + 1) + ' / span ' + span;
      root.append(tile);
      const centerX = (column + span / 2 - 6) / 6;
      const centerY = (row + .5 - 3) / 3;
      cells.push({
        tile,
        coverWave: (column + span / 2 + row * .55) / 15,
        revealWave: Math.hypot(centerX, centerY) / Math.SQRT2
      });
      column += span;
    }
  }
  const reset = () => {
    root.remove();
    animations.splice(0).forEach(animation => animation.cancel());
    cells.forEach(({ tile }) => {
      tile.style.removeProperty('opacity');
      tile.style.removeProperty('transform');
    });
    root.classList.remove('is-covered');
    navigating = false;
  };
  const animate = cover => Promise.all(cells.map(({ tile, coverWave, revealWave }) => {
    const transparent = { opacity: 0, transform: 'scaleY(.9)' };
    const solid = { opacity: 1, transform: 'scaleY(1)' };
    if (typeof tile.animate !== 'function') {
      tile.style.opacity = cover ? '1' : '0';
      return Promise.resolve();
    }
    let animation;
    try {
      animation = tile.animate(cover ? [transparent, solid] : [solid, transparent], {
        duration: cover ? 760 : 900,
        delay: (cover ? coverWave : revealWave) * 300,
        easing: 'cubic-bezier(.2,.75,.25,1)',
        fill: 'both'
      });
    } catch {
      tile.style.opacity = cover ? '1' : '0';
      return Promise.resolve();
    }
    animations.push(animation);
    return animation.finished.catch(() => {});
  }));
  if (entering) {
    // Cover immediately, then reveal as soon as the destination's first screen exists.
    root.classList.add('is-covered');
    document.documentElement.append(root);
    let revealStarted = false;
    let readyObserver;
    const revealIncoming = () => {
      if (revealStarted) return;
      revealStarted = true;
      readyObserver?.disconnect();
      requestAnimationFrame(async () => {
        if (!root.isConnected) return;
        const failSafe = window.setTimeout(() => { if (root.isConnected) reset(); }, 4000);
        try {
          await animate(false);
        } finally {
          window.clearTimeout(failSafe);
          if (root.isConnected) reset();
        }
      });
    };
    const firstScreenExists = () => document.querySelector('.hero, .testing-stage__image');
    if (document.readyState === 'loading' && !firstScreenExists()) {
      readyObserver = new MutationObserver(() => {
        if (firstScreenExists()) revealIncoming();
      });
      readyObserver.observe(document.documentElement, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', revealIncoming, { once: true });
    } else {
      revealIncoming();
    }
  }
  const destinationFor = link => {
    if (!link || link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self')) return null;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || !/^https?:$/.test(destination.protocol)) return null;
    if (destination.pathname === location.pathname && destination.search === location.search) return null;
    return destination;
  };
  const prefetched = new Set();
  const prefetch = destination => {
    if (prefetched.has(destination.href)) return;
    prefetched.add(destination.href);
    const hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.href = destination.href;
    hint.as = 'document';
    document.head.append(hint);
  };
  document.addEventListener('pointerover', event => {
    const destination = destinationFor(event.target.closest('a[href]'));
    if (destination) prefetch(destination);
  });
  document.addEventListener('click', async event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || reducedMotion.matches) return;
    const target = event.target instanceof Element ? event.target : event.composedPath().find(node => node instanceof Element);
    const destination = destinationFor(target?.closest('a[href]'));
    if (!destination) return;
    event.preventDefault();
    if (navigating) return;
    reset();
    navigating = true;
    prefetch(destination);
    document.documentElement.append(root);
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (!root.isConnected || !navigating) return;
    await animate(true);
    try { sessionStorage.setItem(enterKey, String(Date.now())); } catch {}
    location.assign(destination.href);
  }, true);
  window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
})();
