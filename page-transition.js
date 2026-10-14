(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;

  const columns = 12;
  const rows = 6;
  const enterKey = 'site-mosaic-enter';
  const transitionDuration = 780;
  const root = document.createElement('div');
  root.className = 'mosaic-transition';
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('role', 'presentation');
  const cells = [];
  const spans = [2, 1, 2, 1, 3, 1, 2];

  for (let row = 0; row < rows; row += 1) {
    let column = 0;
    let sequence = row % spans.length;
    while (column < columns) {
      const span = Math.min(spans[sequence % spans.length], columns - column);
      const tile = document.createElement('span');
      tile.className = 'mosaic-transition__tile';
      tile.style.setProperty('--row', String(row + 1));
      tile.style.setProperty('--col', String(column + 1));
      tile.style.setProperty('--span', String(span));
      cells.push({ tile, row, column: column + span / 2 });
      root.append(tile);
      column += span;
      sequence += 1;
    }
  }

  const setWave = direction => {
    const max = columns - 1 + (rows - 1) * .42;
    cells.forEach(({ tile, row, column }) => {
      const horizontal = direction === 'in' ? column : columns - column;
      const vertical = direction === 'in' ? rows - 1 - row : row;
      const wave = horizontal + vertical * .42;
      tile.style.setProperty('--delay', `${Math.round(wave / max * 300)}ms`);
    });
  };

  const shouldTransition = link => {
    if (!link || link.hasAttribute('download')) return false;
    if (link.target && link.target.toLowerCase() !== '_self') return false;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin) return false;
    const current = new URL(location.href);
    return destination.pathname !== current.pathname || destination.search !== current.search;
  };

  const storedEnter = Number(sessionStorage.getItem(enterKey) || 0);
  sessionStorage.removeItem(enterKey);
  document.body.append(root);

  if (storedEnter && Date.now() - storedEnter < 10000) {
    setWave('in');
    document.documentElement.classList.add('mosaic-enter');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.add('mosaic-leave');
      document.documentElement.classList.remove('mosaic-enter');
    }));
    window.setTimeout(() => {
      root.remove();
      document.documentElement.classList.remove('mosaic-leave');
    }, transitionDuration + 80);
  } else {
    root.remove();
  }

  let navigating = false;
  document.addEventListener('click', event => {
    if (navigating || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!shouldTransition(link)) return;
    event.preventDefault();
    navigating = true;
    setWave('out');
    document.body.append(root);
    document.documentElement.classList.add('mosaic-enter');
    window.setTimeout(() => {
      sessionStorage.setItem(enterKey, String(Date.now()));
      location.assign(link.href);
    }, transitionDuration);
  });
})();