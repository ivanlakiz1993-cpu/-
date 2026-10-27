(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const entryEvent = 'site:page-entry-revealed';
  const finishEntry = () => {
    document.querySelector('.page-entry-reveal')?.remove();
    window.sitePageEntryPending = false;
    window.sitePageEntryRevealed = true;
    document.documentElement.classList.remove('page-entry-pending');
    document.dispatchEvent(new Event(entryEvent));
  };
  window.sitePageEntryRevealed = reducedMotion.matches;
  window.sitePageEntryPending = !reducedMotion.matches;
  if (reducedMotion.matches) {
    finishEntry();
    return;
  }
  document.documentElement.classList.add('page-entry-pending');

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
        duration: cover ? 560 : 440,
        delay: cover ? coverWave * 180 : revealWave * 280,
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
  {
    // Keep the same radial 16×9 reveal for reloads and page transitions.
    const entryRoot = document.createElement('div');
    entryRoot.className = 'page-entry-reveal';
    entryRoot.setAttribute('aria-hidden', 'true');
    const entryTiles = [];
    const rows = 9;
    const columns = 16;
    const centerRow = (rows - 1) / 2;
    const centerColumn = (columns - 1) / 2;
    const maxDistance = Math.hypot(centerRow, centerColumn);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const tile = document.createElement('span');
        tile.className = 'page-entry-reveal__tile';
        tile.style.gridRow = String(row + 1);
        tile.style.gridColumn = String(column + 1);
        entryRoot.append(tile);
        entryTiles.push({ tile, row, column });
      }
    }
    document.documentElement.append(entryRoot);
    let entryStarted = false;
    const startEntryReveal = async () => {
      if (entryStarted) return;
      entryStarted = true;
      // Wait for the actual first screen, not merely its opening <main> tag.
      const firstImage = document.querySelector('.hero .hero-bg img, .about-cover__image img, .testing-stage__image, img[data-testing-model-fallback]');
      await Promise.race([
        Promise.all([
          firstImage?.decode?.().catch(() => {}),
          document.fonts?.ready
        ]),
        new Promise(resolve => window.setTimeout(resolve, 350))
      ]);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          entryTiles.forEach(({ tile, row, column }) => {
            const distance = Math.hypot(row - centerRow, column - centerColumn) / maxDistance;
            const randomOffset = Math.random() * .35;
            tile.style.setProperty('--tile-delay', `${distance * 280 + randomOffset * 250}ms`);
            tile.classList.add('is-revealed');
          });
        });
        window.setTimeout(finishEntry, 850);
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startEntryReveal, { once: true });
    } else {
      startEntryReveal();
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
    location.assign(destination.href);
  }, true);
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    reset();
    finishEntry();
  });
})();
