// Run in the head, before the browser can restore a reloaded page's scroll.
(() => {
  if (performance.getEntriesByType?.('navigation')?.[0]?.type !== 'reload') return;
  const canRestore = 'scrollRestoration' in history;
  if (canRestore) history.scrollRestoration = 'manual';
  const reset = () => scrollTo({ top: 0, left: 0, behavior: 'instant' });
  reset();
  addEventListener('pageshow', event => { if (!event.persisted) reset(); }, { once: true });
  // Restore normal back/forward behavior when leaving this document.
  addEventListener('pagehide', () => { if (canRestore) history.scrollRestoration = 'auto'; }, { once: true });
})();
