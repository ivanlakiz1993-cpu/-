(() => {
  const section = document.querySelector('.about-history');
  if (!section || getComputedStyle(section).display === 'none') return;

  const title = section.querySelector('.about-history__event-title');
  const description = section.querySelector('.about-history__event-description');
  let visibleVisual = section.querySelector('.about-history__visual-image img.is-visible');
  let imageBuffer = section.querySelector('.about-history__visual-image-buffer');
  const responsiveSource = section.querySelector('.about-history__responsive-source');
  const useAdaptiveHistoryImage = matchMedia('(max-width:64rem), (hover:none) and (pointer:coarse)');
  const buttons = [...section.querySelectorAll('[data-history-year]')];
  const routes = new Map(
    [...section.querySelectorAll('[data-history-route]')]
      .map((route) => [route.dataset.historyRoute, route])
  );
  const currentFlows = new Map(
    [...section.querySelectorAll('[data-history-current]')]
      .map((flow) => [flow.dataset.historyCurrent, flow])
  );
  const content = {
    2013: {
      image: 'assets/about-history-image.webp',
      adaptiveImage: 'assets/about-history-adaptive.png',
      adaptiveImageAlt: 'Логотип компании среди документов и сертификатов',
      imageAlt: 'Логотип компании на чёрной папке для документов',
      title: 'Основана компания «СпецЭлектроника»',
      description: 'Получена государственная лицензия на проектирование, производство и сервисное обслуживание электронных систем специального назначения. Оснащение производственных площадей современным технологическим и измерительным оборудованием. Завершена модернизация рабочих помещений.'
    },
    2014: {
      image: 'assets/about-history-2014.webp',
      imageAlt: 'Первый опытный образец электронного комплекса',
      title: 'Первый опытный образец',
      description: 'Команда завершила разработку первого опытного образца электронного комплекса. Решение прошло внутренние проверки и подтвердило устойчивую работу в условиях повышенных нагрузок и электромагнитных помех.'
    },
    2015: {
      image: 'assets/about-history-2015.webp',
      imageAlt: 'Самолёт и морские суда — первые отраслевые проекты компании',
      title: 'Первые отраслевые проекты',
      description: 'Компания приступила к выполнению первых заказов для авиационной и морской промышленности. Инженеры адаптировали электронные модули под требования конкретных объектов и подготовили комплекты документации.'
    },
    2016: {
      image: 'assets/about-history-2016.webp',
      imageAlt: 'Оборудование для монтажа электронных компонентов',
      title: 'Собственное производство',
      description: 'Запущен собственный участок монтажа электронных компонентов и сборки готовых модулей. Это позволило контролировать качество на каждом этапе, сократить сроки изготовления и быстрее выпускать опытные партии.'
    },
    2017: {
      image: 'assets/about-history-2017.webp',
      imageAlt: 'Специалист собирает электронные компоненты',
      title: 'Система контроля качества',
      description: 'В производственный процесс внедрена многоэтапная система контроля: входная проверка компонентов, тестирование собранных плат и приёмо-сдаточные испытания готовой аппаратуры перед передачей заказчику.'
    },
    2018: {
      image: 'assets/about-history-2018.webp',
      imageAlt: 'Линия серийного производства электронных модулей',
      title: 'Серийное производство',
      description: 'Компания перешла от выпуска отдельных прототипов к серийному производству радиоэлектронной аппаратуры. Были стандартизированы сборочные операции, маршруты контроля и комплект технической документации.'
    },
    2019: {
      image: 'assets/about-history-2019.webp',
      imageAlt: 'Инженерное оборудование для разработки и испытаний',
      title: 'Расширение инженерных компетенций',
      description: 'Сформированы новые направления разработки встроенного программного обеспечения, схемотехники и испытаний. Компания получила возможность создавать комплексные решения — от идеи и прототипа до готового изделия.'
    },
    2020: {
      image: 'assets/about-history-2020.webp',
      imageAlt: 'Документы и материалы, сопровождающие полный цикл работ',
      title: 'Полный цикл работ',
      description: 'Разработка, производство и испытания были объединены в единый технологический процесс. Заказчики получили возможность пройти весь путь создания изделия в одной компании с общей системой контроля качества.'
    },
    2021: {
      image: 'assets/about-history-2021.webp',
      imageAlt: 'Климатическая камера для испытаний электронного оборудования',
      imageCrop: 'wide-2021',
      title: 'Модернизация производства',
      description: 'Производственные площадки оснащены новым монтажным, измерительным и испытательным оборудованием. Модернизация повысила точность операций и расширила возможности выпуска сложных электронных модулей.'
    },
    2022: {
      image: 'assets/about-history-2022.webp',
      imageAlt: 'Электронный модуль нового поколения',
      title: 'Новые продуктовые решения',
      description: 'Разработана линейка электронных модулей с повышенной устойчивостью к температуре, вибрации и влажности. Решения предназначены для длительной эксплуатации на промышленных и транспортных объектах.'
    },
    2023: {
      image: 'assets/about-history-2023.webp',
      imageAlt: 'Современная производственная площадка компании',
      imageCrop: 'zoom-2023',
      title: 'Рост команды и мощностей',
      description: 'Компания расширила производственные площади и усилила команду инженеров, технологов и испытателей. Дополнительные ресурсы позволили одновременно вести больше проектов и увеличивать объёмы выпуска.'
    },
    2024: {
      image: 'assets/about-history-2024.webp',
      imageAlt: 'Испытательная лаборатория с климатическими камерами',
      imageCrop: 'zoom-2024',
      title: 'Аттестация испытательной лаборатории',
      description: 'Испытательная лаборатория прошла аттестацию и расширила перечень проводимых испытаний. Компания получила возможность самостоятельно подтверждать стойкость аппаратуры к климатическим и механическим воздействиям.'
    }
  };
  const inactiveControl = 'assets/about-history-year.svg';
  const activeControl = 'assets/about-history-year-active.svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timelineMotion = !reducedMotion && !useAdaptiveHistoryImage.matches;
  const timing = timelineMotion
    ? { fade: 150, route: 790, frame: 280, image: 500 }
    : { fade: 0, route: 0, frame: 0, image: reducedMotion ? 0 : 500 };
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

  const getHistoryImage = (entry) => (
    useAdaptiveHistoryImage.matches && entry.adaptiveImage ? entry.adaptiveImage : entry.image
  );
  const getHistoryAlt = (entry) => (
    useAdaptiveHistoryImage.matches && entry.adaptiveImageAlt ? entry.adaptiveImageAlt : entry.imageAlt
  );

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
    const nextImage = getHistoryImage(nextContent);
    const imageReady = preloadImage(nextImage);
    const previousRoute = routes.get(activeYear);
    const previousFlow = currentFlows.get(activeYear);
    const nextFlow = currentFlows.get(year);
    previousRoute?.classList.remove('is-active', 'is-animating');
    previousFlow?.classList.remove('is-active');
    nextRoute.classList.remove('is-active', 'is-animating');
    nextFlow?.classList.remove('is-active');

    await wait(timing.fade);
    nextRoute.classList.add('is-animating');
    await wait(timing.route);

    nextRoute.classList.remove('is-animating');
    nextRoute.classList.add('is-active');
    nextFlow?.classList.add('is-active');
    await wait(timing.frame);
    await imageReady;

    if (responsiveSource) responsiveSource.srcset = nextImage;
    if (nextContent.imageCrop) imageBuffer.dataset.historyCrop = nextContent.imageCrop;
    else imageBuffer.removeAttribute('data-history-crop');
    imageBuffer.src = nextImage;
    imageBuffer.alt = getHistoryAlt(nextContent);
    if (typeof imageBuffer.decode === 'function') {
      try {
        await imageBuffer.decode();
      } catch {}
    }
    title.textContent = nextContent.title;
    description.textContent = nextContent.description;
    visibleVisual.classList.remove('is-visible');
    imageBuffer.classList.add('is-visible', 'is-flashing');
    revealCopy();
    activeYear = year;
    section.classList.remove('is-switching');

    await wait(timing.image);
    imageBuffer.classList.remove('is-flashing');
    const previousVisual = visibleVisual;
    visibleVisual = imageBuffer;
    imageBuffer = previousVisual;
    imageBuffer.removeAttribute('src');
    imageBuffer.removeAttribute('data-history-crop');
    imageBuffer.alt = '';
    section.removeAttribute('aria-busy');
    switching = false;
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => selectYear(button.dataset.historyYear));
  });
})();
