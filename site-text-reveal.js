(() => {
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const targetSelector = [
    'main h1', 'main h2', 'main h3', 'main h4', 'main h5', 'main h6',
    'main p',
    '.testing-stage__breadcrumb > *'
  ].join(',');
  const excludedSelector = [
    '.hero', '.metrics', '.work-card', '.news-card', '.news-page__card',
    '.footer', '.testing-about__metric', '.climate-tests__list',
    '.mechanical-tests__list', '.testing-faq__item', '.news-page__filter-wrap',
    '.news-article__status', '.form-feedback', '.visually-hidden'
  ].join(',');
  const groupSelector = [
    '.benefits-stage', '.project-cta__copy', '.news-intro__copy',
    '.contact-heading', '.testing-stage__copy', '.climate-tests__inner',
    '.mechanical-tests__inner', '.testing-faq__inner', '.news-page__content',
    '.news-article'
  ].join(',');
  const groups = new Map();
  const groupsByTarget = new WeakMap();
  const registeredTargets = new WeakSet();
  const characterDelay = 22;
  let scanFrame = 0;

  const normalizedText = (element) => {
    const copy = element.cloneNode(true);
    copy.querySelector(':scope > .text-reveal__accessible')?.remove();
    copy.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith(document.createTextNode(' ')));
    return (copy.textContent || '').replace(/\s+/gu, ' ').trim();
  };

  const unwrapRevealMarkup = (element) => {
    element.querySelectorAll('.text-reveal__word').forEach((word) => {
      word.replaceWith(document.createTextNode(word.textContent));
    });
    element.querySelectorAll('.text-reveal__content').forEach((content) => {
      content.replaceWith(...content.childNodes);
    });
  };

  const prepare = (element) => {
    if (!element || motionPreference.matches) return;
    const accessibleCopy = element.querySelector(':scope > .text-reveal__accessible');
    const sourceText = normalizedText(element);
    if (!sourceText) return;
    if (element.dataset.textRevealReady === 'true'
      && sourceText === element.dataset.textRevealContent) return;

    accessibleCopy?.remove();
    if (element.dataset.textRevealReady === 'true') unwrapRevealMarkup(element);

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      if (!node.textContent.trim()) return;
      const hasFlexLayout = getComputedStyle(node.parentElement).display.includes('flex');
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/u).forEach((part) => {
        if (!part) return;
        if (/^\s+$/u.test(part)) {
          fragment.append(document.createTextNode(part));
          return;
        }
        const word = document.createElement('span');
        word.className = 'text-reveal__word';
        word.textContent = part;
        word.replaceChildren(...Array.from(part, (character) => {
          const letter = document.createElement('span');
          letter.className = 'text-reveal__letter';
          letter.setAttribute('aria-hidden', 'true');
          letter.textContent = character;
          return letter;
        }));
        fragment.append(word);
      });
      if (hasFlexLayout) {
        const content = document.createElement('span');
        content.className = 'text-reveal__content';
        content.append(fragment);
        node.replaceWith(content);
      } else {
        node.replaceWith(fragment);
      }
    });

    element.classList.add('text-reveal');
    element.dataset.textRevealReady = 'true';
    element.dataset.textRevealContent = sourceText;
    const screenReaderCopy = document.createElement('span');
    screenReaderCopy.className = 'visually-hidden text-reveal__accessible';
    screenReaderCopy.textContent = sourceText;
    element.prepend(screenReaderCopy);
  };

  const animate = (elements, { restart = false } = {}) => {
    const targets = elements.filter((element) => element && element.querySelector('.text-reveal__letter'));
    if (!targets.length) return;
    if (motionPreference.matches) {
      targets.forEach((element) => element.classList.add('text-reveal--active'));
      return;
    }

    if (restart) targets.forEach((element) => element.classList.remove('text-reveal--active'));
    let delay = 0;
    targets.forEach((element) => {
      const speed = element.matches('h1, h2, h3, h4, h5, h6') ? 1 : 1.2;
      element.style.setProperty('--text-letter-duration', `${240 / speed}ms`);
      element.querySelectorAll('.text-reveal__letter').forEach((letter) => {
        letter.style.setProperty('--text-letter-delay', `${delay}ms`);
        delay += characterDelay / speed;
      });
    });
    targets.forEach((element) => { void element.offsetWidth; });
    targets.forEach((element) => element.classList.add('text-reveal--active'));
  };

  const groupFor = (element) => {
    const article = element.closest('.news-article');
    if (article) return element.matches('.news-article__title') ? article : element;
    return element.closest(groupSelector)
      || element.closest('section, article')
      || element;
  };

  const register = (element) => {
    if (registeredTargets.has(element)) return;
    registeredTargets.add(element);
    const root = groupFor(element);
    let group = groups.get(root);
    if (!group) {
      group = { elements: [], started: false };
      groups.set(root, group);
    }
    group.elements.push(element);
    groupsByTarget.set(element, group);
    if (group.started) {
      animate([element]);
    } else if (observer) {
      observer.observe(element);
    }
  };

  const scan = () => {
    scanFrame = 0;
    if (motionPreference.matches) return;
    document.querySelectorAll(targetSelector).forEach((element) => {
      if (element.matches(excludedSelector)
        || element.closest(`${excludedSelector}, [hidden], [aria-hidden="true"], [aria-busy="true"]`)) return;

      const previousText = element.dataset.textRevealContent;
      prepare(element);
      if (!registeredTargets.has(element)) register(element);
      else if (previousText && previousText !== element.dataset.textRevealContent) {
        // Dynamic article text is prepared when its source finishes loading.
        // Existing interactive benefit copy is restarted by its page controller.
        if (!element.matches('[data-benefit-title], [data-benefit-description]')) {
          animate([element], { restart: true });
        }
      }
    });
  };

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const group = groupsByTarget.get(entry.target);
        if (!group || group.started) return;
        group.started = true;
        animate(group.elements);
        group.elements.forEach((element) => observer.unobserve(element));
      });
    }, { threshold: 0, rootMargin: '0px 0px -5% 0px' })
    : null;

  window.siteTextReveal = { prepare, animate };
  scan();

  if (document.body && 'MutationObserver' in window) {
    const mutationObserver = new MutationObserver(() => {
      if (scanFrame) return;
      scanFrame = requestAnimationFrame(scan);
    });
    mutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-busy', 'hidden'],
      characterData: true,
      childList: true,
      subtree: true
    });
  }

  if (!observer) {
    groups.forEach((group) => {
      group.started = true;
      animate(group.elements);
    });
  }
})();
