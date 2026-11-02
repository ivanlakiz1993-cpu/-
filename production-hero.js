const productionHeroButton = document.querySelector('.production-hero__button');

if (productionHeroButton) {
  productionHeroButton.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;

    const bounds = productionHeroButton.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    productionHeroButton.style.setProperty('--cursor-x', `${x}%`);
    productionHeroButton.style.setProperty('--cursor-y', `${y}%`);
  });
}
