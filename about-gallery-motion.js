(() => {
  const gallery = document.querySelector(".about-gallery");
  const container = gallery?.querySelector(".about-gallery__container");
  const laboratory = gallery?.querySelector(".about-gallery__item--laboratory");
  const equipment = gallery?.querySelector(".about-gallery__item--equipment");
  const work = gallery?.querySelector(".about-gallery__item--work");

  if (!gallery || !container || !laboratory || !equipment || !work || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  const motion = gsap.matchMedia();
  motion.add("(min-width: 64.001rem) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
    const alignToBottom = () => container.clientHeight * 289 / 789;
    gsap.set([laboratory, equipment], { y: 0 });

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: gallery,
        start: "top top",
        end: () => `+=${Math.round(Math.min(window.innerHeight * 0.55, container.clientHeight * 0.9))}`,
        pin: true,
        pinSpacing: true,
        scrub: 0.45,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    timeline
      .to({}, { duration: 0.22 })
      .to([laboratory, equipment], { y: alignToBottom, duration: 1, ease: "none" }, 0.22);

    return () => timeline.scrollTrigger?.kill();
  });

  const refresh = () => requestAnimationFrame(() => ScrollTrigger.refresh(true));
  window.addEventListener("load", refresh, { once: true });
  window.addEventListener("pageshow", refresh);
})();
