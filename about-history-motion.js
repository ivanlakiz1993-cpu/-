(() => {
  const section = document.querySelector('.about-history');
  if (!section || getComputedStyle(section).display === 'none') return;

  const title = section.querySelector('.about-history__event-title');
  const description = section.querySelector('.about-history__event-description');
  const visual = section.querySelector('.about-history__visual-image > img');
  const buttons = [...section.querySelectorAll('[data-history-year]')];
  const routes = new Map(
    [...section.querySelectorAll('[data-history-route]')]
      .map((route) => [route.dataset.historyRoute, route])
  );
  const content = {
    2013: {
      image: 'assets/about-history-image.png',
      imageAlt: 'Логотип компании на чёрной папке для документов',
      title: 'Основана компания «СпецЭлектроника»',
      description: 'Получена государственная лицензия на проектирование, производство и сервисное обслуживание электронных систем специального назначения. Оснащение производственных площадей современным технологическим и измерительным оборудованием. Завершена модернизация рабочих помещений.'
    },
    2014: {
      image: 'assets/about-history-2014.png',
      imageAlt: 'Первый опытный образец электронного комплекса',
      title: 'Первый опытный образец',
      description: 'Команда завершила разработку первого опытного образца электронного комплекса. Решение прошло внутренние проверки и подтвердило устойчивую работу в условиях повышенных нагрузок и электромагнитных помех.'
    }
  };
  const inactiveControl = 'assets/about-history-year.svg';
  const activeControl = 'assets/about-history-year-active.svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timing = reducedMotion
    ? { fade: 0, route: 0, frame: 0, image: 0 }
    : { fade: 150, route: 790, frame: 280, image: 500 };
  let activeYear = '2013';
  let switching = false;

  const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

  const preloadImage = (src) => new Promise((resolve) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = src;
    if (image.complete) resolve();
  });

  const setSelectedYear = (year) => {
    buttons.forEach((button) => {
      const isSelected = button.dataset.historyYear === year;
      button.setAttribute('aria-pressed', String(isSelected));
      const control = button.querySelector('img');
      if (control) control.src = isSelected ? activeControl : inactiveControl;
    });
  };

  const revealCopy = () => {
    if (!window.siteTextReveal) return;
    window.siteTextReveal.prepare(title);
    window.siteTextReveal.prepare(description);
    // The text reveal controller offsets each following element by 8 ms.
    window.siteTextReveal.animate([title, description], { restart: true });
  };

  const selectYear = async (year) => {
    const nextContent = content[year];
    const nextRoute = routes.get(year);
    if (!nextContent || !nextRoute || switching || year === activeYear) return;

    switching = true;
    section.classList.add('is-switching');
    section.setAttribute('aria-busy', 'true');
    setSelectedYear(year);
    const imageReady = preloadImage(nextContent.image);
    const previousRoute = routes.get(activeYear);
    previousRoute?.classList.remove('is-active', 'is-animating');
    nextRoute.classList.remove('is-active', 'is-animating');

    await wait(timing.fade);
    nextRoute.classList.add('is-animating');
    await wait(timing.route);

    nextRoute.classList.remove('is-animating');
    nextRoute.classList.add('is-active');
    section.classList.remove('is-switching');
    await wait(timing.frame);
    await imageReady;

    visual.src = nextContent.image;
    visual.alt = nextContent.imageAlt;
    title.textContent = nextContent.title;
    description.textContent = nextContent.description;
    section.classList.add('is-revealing');
    revealCopy();
    activeYear = year;

    await wait(timing.image);
    section.classList.remove('is-revealing');
    section.removeAttribute('aria-busy');
    switching = false;
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => selectYear(button.dataset.historyYear));
  });
})();
