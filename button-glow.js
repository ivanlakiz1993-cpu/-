document.querySelectorAll('.project-cta__button, .submit, .production-hero__button').forEach((button) => {
  button.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;

    const bounds = button.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    button.style.setProperty('--cursor-x', `${x}%`);
    button.style.setProperty('--cursor-y', `${y}%`);
  });
});
