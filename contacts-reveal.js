(() => {
  const lists = [...document.querySelectorAll(
    '.contacts-page__contact-list, .contacts-page__company-details-list'
  )];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!lists.length || motionPreference.matches) return;

  const rowSelector = [
    '.contacts-page__contact-row',
    '.contacts-page__company-detail-row',
    '.contacts-page__social-row'
  ].join(',');

  lists.forEach((list) => {
    let rowIndex = 0;

    [...list.children].forEach((row) => {
      if (!row.matches(rowSelector)) return;

      const delay = `${rowIndex * 90}ms`;
      row.classList.add('contacts-page__reveal-item');
      row.style.setProperty('--contacts-reveal-delay', delay);

      const divider = row.nextElementSibling;
      if (divider?.matches('.contacts-page__divider')) {
        divider.classList.add('contacts-page__reveal-divider');
        divider.style.setProperty('--contacts-reveal-delay', delay);
      }

      rowIndex += 1;
    });
  });

  const revealItems = (list) => {
    list.querySelectorAll('.contacts-page__reveal-item, .contacts-page__reveal-divider')
      .forEach((item) => item.classList.add('is-revealed'));
  };

  document.documentElement.classList.add('contacts-page--motion-ready');

  if (!('IntersectionObserver' in window)) {
    lists.forEach(revealItems);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      revealItems(target);
      observer.unobserve(target);
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -8% 0px' });

  lists.forEach((list) => observer.observe(list));
})();
