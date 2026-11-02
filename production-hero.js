const productionHeroVideo = document.querySelector('.production-hero__video');
const productionHeroMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (productionHeroVideo) {
  const syncProductionHeroPlayback = () => {
    if (productionHeroMotion.matches) {
      productionHeroVideo.pause();
      return;
    }

    productionHeroVideo.play().catch(() => {});
  };

  syncProductionHeroPlayback();

  if (productionHeroMotion.addEventListener) {
    productionHeroMotion.addEventListener('change', syncProductionHeroPlayback);
  } else {
    productionHeroMotion.addListener(syncProductionHeroPlayback);
  }
}
