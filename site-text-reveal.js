(() => {
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let typographyReady = !document.fonts;
  const pendingScanRoots = new Set();
  const pendingPreparations = new Set();
  const targetSelector = [
    'main h1', 'main h2', 'main h3', 'main h4', 'main h5', 'main h6',
    'main p',
    '.hero-services', '.hero-description',
    '.testing-stage__button',
    '.all-news'
  ].join(',');
  const excludedSelector = [
    '.hero', '.metrics', '.work-card', '.news-card', '.news-page__card',
    '.footer', '.testing-about__metric', '.climate-tests__list',
    '.mechanical-tests__list', '.mechanical-tests__equipment h3',
    '.mechanical-tests__group h4', '.testing-faq__item', '.news-page__filter-wrap',
    '.news-article__status', '.form-feedback', '.visually-hidden'
  ].join(',');
  const groupSelector = [
    '.benefits-stage', '.project-cta__copy', '.news',
    '.hero', '.contact-heading', '.testing-stage__content', '.testing-stage__copy', '.climate-tests__inner',
    '.mechanical-tests__inner', '.testing-faq__inner', '.news-page__content',
    '.news-article'
  ].join(',');
  const groups = new Map();
  const groupsByTarget = new WeakMap();
  const registeredTargets = new WeakSet();
  const headingSelector = 'h1, h2, h3, h4, h5, h6';
  const headingTargets = new Set();
  const headingWidths = new WeakMap();
  const lineSeparators = new WeakMap();
  const triggerPosition = 0.75;
  const headingDuration = 800;
  const bodyDuration = 680;
  const sequenceGap = 0;
  const headingTextOverlap = 120;
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
    element.normalize();
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
    headingWidths.set(element, element.clientWidth);
  };

  const prepare = (element) => {
    if (!element || motionPreference.matches) return;
    if (!typographyReady) {
      pendingPreparations.add(element);
      return;
    }
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
    if (isHeading) {
      headingTargets.add(element);
      headingResizeObserver?.observe(element);
    }
  };

  const headingResizeObserver = 'ResizeObserver' in window
    ? new ResizeObserver((entries) => {
      entries.forEach(({ target }) => {
        if (!target.classList.contains('text-reveal')
          || headingWidths.get(target) === target.clientWidth) return;
        unwrapRevealMarkup(target);
        wrapHeadingLines(target);
      });
    })
    : null;

  const refreshHeadingLines = () => {
    headingTargets.forEach((element) => {
      if (!element.isConnected) {
        headingTargets.delete(element);
        headingResizeObserver?.unobserve(element);
        return;
      }
      if (element.dataset.textRevealReady !== 'true' || !element.classList.contains('text-reveal')) return;
      unwrapRevealMarkup(element);
      wrapHeadingLines(element);
    });
  };

  const animate = (elements, { restart = false } = {}) => {
    const targets = elements.filter((element) => element?.classList.contains('text-reveal'));
    if (!targets.length) return 0;
    if (motionPreference.matches) {
      targets.forEach((element) => element.classList.add('text-reveal--active'));
      return 0;
    }

    if (restart) targets.forEach((element) => element.classList.remove('text-reveal--active'));
    let delay = 0;
    targets.forEach((element, index) => {
      element.style.setProperty('--text-reveal-delay', `${delay}ms`);
      const nextElement = targets[index + 1];
      const headingToBodyOverlap = element.matches(headingSelector)
        && nextElement
        && !nextElement.matches(headingSelector)
        ? headingTextOverlap
        : 0;
      delay += (element.matches(headingSelector) ? headingDuration : bodyDuration)
        + sequenceGap - headingToBodyOverlap;
    });
    targets.forEach((element) => { void element.offsetWidth; });
    targets.forEach((element) => element.classList.add('text-reveal--active'));
    return delay;
  };

  const orderedElements = (group) => {
    const primaryHeading = group.elements.find((element) => element.matches('h1, h2'))
      || group.elements.find((element) => element.matches(headingSelector));
    return primaryHeading
      ? [primaryHeading, ...group.elements.filter((element) => element !== primaryHeading)]
      : group.elements;
  };

  const advanceGroup = (group) => {
    if (group.playing) return;
    if (window.sitePageEntryPending && group.elements.some((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.top < window.innerHeight && bounds.bottom > 0;
    })) return;
    for (const element of orderedElements(group)) {
      if (group.revealed.has(element)) continue;
      if (!element.isConnected || !element.classList.contains('text-reveal')) {
        group.revealed.add(element);
        continue;
      }
      const bounds = element.getBoundingClientRect();
      if (bounds.top >= window.innerHeight * triggerPosition) return;
      group.revealed.add(element);
      observer?.unobserve(element);
      // On a restored scroll position, finish content already above the viewport.
      if (bounds.bottom <= 0) {
        element.style.setProperty('--text-reveal-delay', '0ms');
        element.classList.add('text-reveal--active');
        continue;
      }
      group.playing = true;
      const duration = animate([element]);
      const sequence = orderedElements(group);
      const currentIndex = sequence.indexOf(element);
      const nextElement = sequence.slice(currentIndex + 1).find((candidate) => !group.revealed.has(candidate));
      const handoffDelay = element.matches(headingSelector)
        && nextElement
        && !nextElement.matches(headingSelector)
        ? Math.max(0, duration - headingTextOverlap)
        : duration;
      window.setTimeout(() => {
        group.playing = false;
        advanceGroup(group);
      }, handoffDelay);
      return;
    }
  };

  const groupFor = (element) => {
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
      group = { elements: [], revealed: new WeakSet(), playing: false };
      groups.set(root, group);
    }
    group.elements.push(element);
    groupsByTarget.set(element, group);
    observer?.observe(element);
  };

  const scan = (root = document) => {
    if (motionPreference.matches) return;
    if (!typographyReady) {
      pendingScanRoots.add(root);
      return;
    }
    const elements = [
      ...(root.matches?.(targetSelector) ? [root] : []),
      ...root.querySelectorAll(targetSelector)
    ];
    elements.forEach((element) => {
      const isHomeCoverCopy = element.matches('.hero-title, .hero-services, .hero-description');
      if ((!isHomeCoverCopy && (element.matches(excludedSelector)
        || element.closest(excludedSelector)))
        || element.closest('[hidden], [aria-hidden="true"], [aria-busy="true"]')) return;

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

  const createObserver = () => 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      const affectedGroups = new Set();
      entries.forEach((entry) => {
        const group = groupsByTarget.get(entry.target);
        if (group) affectedGroups.add(group);
      });
      affectedGroups.forEach(advanceGroup);
    }, { threshold: 0, rootMargin: `0px 0px -${Math.round(window.innerHeight * (1 - triggerPosition))}px 0px` })
    : null;

  let observer = createObserver();

  window.siteTextReveal = { prepare, animate, scan };
  document.addEventListener('site:page-entry-revealed', () => {
    groups.forEach(advanceGroup);
  });

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      refreshHeadingLines();
      observer?.disconnect();
      observer = createObserver();
      groups.forEach((group) => {
        group.elements.forEach((element) => {
          if (!group.revealed.has(element)) observer?.observe(element);
        });
        advanceGroup(group);
      });
    });
  }, { passive: true });
  const startReveal = () => {
    typographyReady = true;
    scan();
    pendingScanRoots.forEach((root) => {
      if (root !== document && root.isConnected) scan(root);
    });
    pendingScanRoots.clear();
    pendingPreparations.forEach((element) => {
      if (element.isConnected) prepare(element);
    });
    pendingPreparations.clear();
    if (!observer) groups.forEach(advanceGroup);
  };
  if (document.fonts?.ready) document.fonts.ready.then(() => requestAnimationFrame(startReveal));
  else startReveal();
})();
