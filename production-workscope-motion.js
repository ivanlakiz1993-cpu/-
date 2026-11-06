(() => {
  const section = document.querySelector('.production-workscope');
  const heading = section?.querySelector('.production-workscope__heading');
  const description = section?.querySelector('.production-workscope__description');
  const stagesList = section?.querySelector('.production-workscope__stages');
  const stages = stagesList ? [...stagesList.querySelectorAll('.production-workscope__stage')] : [];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const textReveal = window.siteTextReveal;

  if (!section || !heading || !description || !stagesList || !stages.length || !textReveal || motionPreference.matches) return;

  const prepareTargets = () => {
    textReveal.prepare(heading);
    textReveal.prepare(description);
    stages.forEach((stage) => {
      textReveal.prepare(stage.querySelector('.production-workscope__number'));
      textReveal.prepare(stage.querySelector('.production-workscope__stage-heading'));
      textReveal.prepare(stage.querySelector('.production-workscope__stage-description'));
    });
  };

  const revealAll = () => {
    textReveal.animate([heading, description]);
    const targets = stages.flatMap((stage) => [
      stage.querySelector('.production-workscope__number'),
      stage.querySelector('.production-workscope__stage-heading'),
      stage.querySelector('.production-workscope__stage-description')
    ]);
    textReveal.animate(targets);
  };

  const startMotion = () => {
    prepareTargets();

    if (!('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    const introObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      textReveal.animate([heading, description]);
      introObserver.disconnect();
    }, { threshold: 0.15 });
    introObserver.observe(section);

    const revealedStages = new Set();
    const stagesObserver = new IntersectionObserver((entries) => {
      const enteringStages = entries
        .filter((entry) => entry.isIntersecting && !revealedStages.has(entry.target))
        .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)
        .map((entry) => entry.target);

      if (!enteringStages.length) return;
      enteringStages.forEach((stage) => {
        revealedStages.add(stage);
        stagesObserver.unobserve(stage);
      });

      const targets = enteringStages.flatMap((stage) => [
        stage.querySelector('.production-workscope__number'),
        stage.querySelector('.production-workscope__stage-heading'),
        stage.querySelector('.production-workscope__stage-description')
      ]);
      textReveal.animate(targets);
    }, { threshold: 0.15 });

    stages.forEach((stage) => stagesObserver.observe(stage));
  };

  Promise.resolve(document.fonts?.ready)
    .then(() => window.requestAnimationFrame(startMotion));
})();
