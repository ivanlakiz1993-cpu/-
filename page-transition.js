(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const enterKey = 'site-mosaic-enter';
  let entering = false;
  try {
    const timestamp = Number(sessionStorage.getItem(enterKey));
    sessionStorage.removeItem(enterKey);
    entering = timestamp && Date.now() - timestamp < 15000;
  } catch {}
  if (reducedMotion.matches) return;

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
      cells.push({ tile, wave: (column + span / 2 + row * .55) / 15 });
      column += span;
    }
  }
  const reset = () => {
    root.remove();
    animations.splice(0).forEach(animation => animation.cancel());
    root.classList.remove('is-covered');
    navigating = false;
  };
  const animate = cover => Promise.all(cells.map(({ tile, wave }) => {
    const transparent = { opacity: 0, transform: 'scaleY(.9)' };
    const solid = { opacity: 1, transform: 'scaleY(1)' };
    const animation = tile.animate(cover ? [transparent, solid] : [solid, transparent], {
      duration: cover ? 560 : 640,
      delay: wave * 200,
      easing: 'cubic-bezier(.16,1,.3,1)',
      fill: 'both'
    });
    animations.push(animation);
    return animation.finished.catch(() => {});
  }));
  const ready = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();
  if (entering) {
    // This script runs in the head, covering the destination before its first paint.
    root.classList.add('is-covered');
    document.documentElement.append(root);
    ready.then(async () => {
      const images = [...document.images].filter(image =>
        image.fetchPriority === 'high' ||
        (image.loading !== 'lazy' && image.getBoundingClientRect().top < innerHeight)
      );
      await Promise.race([
        Promise.allSettled([document.fonts.ready, ...images.map(image => image.decode())]),
        new Promise(resolve => setTimeout(resolve, 400))
      ]);
      if (!root.isConnected) return;
      await animate(false);
      reset();
      document.dispatchEvent(new Event('site:page-entered'));
    });
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
    const destination = destinationFor(event.target.closest('a[href]'));
    if (!destination) return;
    event.preventDefault();
    if (navigating) return;
    reset();
    navigating = true;
    prefetch(destination);
    document.documentElement.append(root);
    await animate(true);
    try { sessionStorage.setItem(enterKey, String(Date.now())); } catch {}
    location.assign(destination.href);
  });
  window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
})();
