const productionFaqList = document.querySelector('.production-faq__list');

if (productionFaqList) {
  const productionFaqItems = [...productionFaqList.querySelectorAll('.production-faq__item')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animationDuration = reducedMotion.matches ? 0 : 380;
  const answerAnimations = new WeakMap();

  const animateAnswer = (answer, from, to) => {
    const previousAnimation = answerAnimations.get(answer);
    if (previousAnimation) {
      previousAnimation.cancel();
      answerAnimations.delete(answer);
    }

    if (!animationDuration || !answer.animate || Math.abs(from - to) < 1) return Promise.resolve(true);

    const animation = answer.animate([
      { height: `${from}px`, opacity: from ? 1 : 0 },
      { height: `${to}px`, opacity: to ? 1 : 0 }
    ], {
      duration: animationDuration,
      easing: 'cubic-bezier(.22,1,.36,1)',
      fill: 'both'
    });

    answerAnimations.set(answer, animation);
    return animation.finished.catch(() => {}).then(() => {
      if (answerAnimations.get(answer) !== animation) return false;
      animation.cancel();
      answerAnimations.delete(answer);
      return true;
    });
  };

  const closeItem = item => {
    if (!item.open) return;
    const answer = item.querySelector('.production-faq__answer');
    if (!answer) {
      item.open = false;
      return;
    }

    const from = answer.getBoundingClientRect().height;
    item.dataset.closing = 'true';
    item.open = false;
    animateAnswer(answer, from, 0).then(finished => {
      if (finished && !item.open) item.removeAttribute('data-closing');
    });
  };

  const openItem = item => {
    const answer = item.querySelector('.production-faq__answer');
    const from = item.hasAttribute('data-closing') ? answer?.getBoundingClientRect().height ?? 0 : 0;
    item.removeAttribute('data-closing');
    item.open = true;

    if (answer) {
      const to = Math.max(answer.scrollHeight, answer.getBoundingClientRect().height);
      animateAnswer(answer, from, to);
    }
  };

  productionFaqList.addEventListener('click', event => {
    const target = event.target;
    const summary = target instanceof Element
      ? target.closest('.production-faq__item > summary')
      : null;
    if (!summary || !productionFaqList.contains(summary)) return;

    event.preventDefault();
    const item = summary.parentElement;
    if (item.open) {
      closeItem(item);
      return;
    }

    for (const other of productionFaqItems) {
      if (other !== item && other.open) closeItem(other);
    }
    openItem(item);
  });
}
