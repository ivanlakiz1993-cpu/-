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
    '.mechanical-tests__list', '.mechanical-tests__equipment h3',
    '.mechanical-tests__group h4', '.testing-faq__item', '.news-page__filter-wrap',
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
  const headingSelector = 'h1, h2, h3, h4, h5, h6';
  const headingTargets = new Set();
  const lineSeparators = new WeakMap();
  const graphemes = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

  const normalizedText = (element) => {
    const copy = element.cloneNode(true);
    copy.querySelector(':scope > .text-reveal__accessible')?.remove();
    copy.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith(document.createTextNode(' ')));
    return (copy.textContent || '').replace(/\s+/gu, ' ').trim();
  };

  const unwrapRevealMarkup = (element) => {
    lineSeparators.get(element)?.forEach((separator) => separator.remove());
    lineSeparators.delete(element);
    element.querySelectorAll('.text-reveal__source-break').forEach((lineBreak) => {
      lineBreak.classList.remove('text-reveal__source-break');
    });
    element.querySelectorAll('.text-reveal__letter').forEach((letter) => {
      letter.replaceWith(document.createTextNode(letter.textContent || ''));
    });
    element.querySelectorAll('.text-reveal__word').forEach((word) => {
      word.replaceWith(...word.childNodes);
    });
    element.querySelectorAll('.text-reveal__line-content').forEach((content) => {
      content.replaceWith(...content.childNodes);
    });
    element.querySelectorAll('.text-reveal__line').forEach((line) => {
      line.replaceWith(...line.childNodes);
    });
    element.querySelectorAll('.text-reveal__content').forEach((content) => {
      content.replaceWith(...content.childNodes);
    });
    element.querySelector(':scope > .text-reveal__accessible')?.remove();
  };

  const wrapHeadingLines = (element) => {
    const lines = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parts = [];
      if (graphemes) {
        parts.push(...Array.from(graphemes.segment(node.textContent), ({ segment, index }) => ({ segment, index })));
      } else {
        let offset = 0;
        for (const segment of Array.from(node.textContent)) {
          parts.push({ segment, index: offset });
          offset += segment.length;
        }
      }
      for (const { segment, index } of parts) {
        range.setStart(node, index);
        range.setEnd(node, index + segment.length);
        const rect = range.getBoundingClientRect();
        if (!rect.height) continue;
        const top = rect.top;
        let line = lines[lines.length - 1];
        if (!line || Math.abs(top - line.top) > 1.5) {
          line = { top, start: { node, offset: index }, end: { node, offset: index + segment.length } };
          lines.push(line);
        } else {
          line.end = { node, offset: index + segment.length };
        }
      }
    }

    lines.slice().reverse().forEach((line) => {
      const lineRange = document.createRange();
      lineRange.setStart(line.start.node, line.start.offset);
      lineRange.setEnd(line.end.node, line.end.offset);
      const content = document.createElement('span');
      content.className = 'text-reveal__line-content';
      content.append(lineRange.extractContents());
      const mask = document.createElement('span');
      mask.className = 'text-reveal__line';
      mask.append(content);
      lineRange.insertNode(mask);
    });

    element.querySelectorAll('br').forEach((lineBreak) => lineBreak.classList.add('text-reveal__source-break'));
    const masks = [...element.querySelectorAll('.text-reveal__line')];
    const separators = [];
    masks.slice(0, -1).forEach((mask) => {
      const separator = document.createTextNode(' ');
      mask.parentNode.insertBefore(separator, mask.nextSibling);
      separators.push(separator);
    });
    lineSeparators.set(element, separators);

    if (!masks.length) {
      const content = document.createElement('span');
      content.className = 'text-reveal__line-content';
      content.append(...element.childNodes);
      const mask = document.createElement('span');
      mask.className = 'text-reveal__line';
      mask.append(content);
      element.append(mask);
    }
  };

  const prepare = (element) => {
    if (!element || motionPreference.matches) return;
    const sourceText = normalizedText(element);
    if (!sourceText) return;
    if (element.dataset.textRevealReady === 'true') {
      if (sourceText === element.dataset.textRevealContent) return;
    }
    unwrapRevealMarkup(element);
    element.classList.remove('text-reveal--active', 'text-reveal--heading', 'text-reveal--body');
    const isHeading = element.matches(headingSelector);
    if (isHeading) wrapHeadingLines(element);
    element.classList.add('text-reveal', isHeading ? 'text-reveal--heading' : 'text-reveal--body');
    element.dataset.textRevealReady = 'true';
    element.dataset.textRevealContent = sourceText;
    if (isHeading) headingTargets.add(element);
  };

  const refreshHeadingLines = () => {
    headingTargets.forEach((element) => {
      if (!element.isConnected) {
        headingTargets.delete(element);
        return;
      }
      if (element.dataset.textRevealReady !== 'true' || !element.classList.contains('text-reveal')) return;
      unwrapRevealMarkup(element);
      wrapHeadingLines(element);
    });
  };

  const animate = (elements, { restart = false } = {}) => {
    const targets = elements.filter((element) => element?.classList.contains('text-reveal'));
    if (!targets.length) return;
    if (motionPreference.matches) {
      targets.forEach((element) => element.classList.add('text-reveal--active'));
      return;
    }

    if (restart) targets.forEach((element) => element.classList.remove('text-reveal--active'));
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

  const scan = (root = document) => {
    if (motionPreference.matches) return;
    const elements = [
      ...(root.matches?.(targetSelector) ? [root] : []),
      ...root.querySelectorAll(targetSelector)
    ];
    elements.forEach((element) => {
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

  window.siteTextReveal = { prepare, animate, scan };
  scan();

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(refreshHeadingLines);
  }, { passive: true });
  document.fonts?.ready.then(() => requestAnimationFrame(refreshHeadingLines));

  if (!observer) {
    groups.forEach((group) => {
      group.started = true;
      animate(group.elements);
    });
  }
})();
