(() => {
  const gallery = document.querySelector(".about-gallery");
  const container = gallery?.querySelector(".about-gallery__container");
  const laboratory = gallery?.querySelector(".about-gallery__item--laboratory");
  const equipment = gallery?.querySelector(".about-gallery__item--equipment");

  if (!gallery || !container || !laboratory || !equipment || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  const motion = gsap.matchMedia();
  motion.add("(prefers-reduced-motion: no-preference)", () => {
    const alignToBottom = () => container.clientHeight * 289 / 789;
    gsap.set([laboratory, equipment], { y: 0 });

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: gallery,
        start: () => `top ${Math.max(0, window.innerHeight - container.clientHeight)}px`,
        end: () => `+=${Math.round(Math.min(window.innerHeight * 0.55, container.clientHeight * 0.9))}`,
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    timeline
      .to(laboratory, { y: alignToBottom, duration: 1, ease: "none" }, 0)
      .to(equipment, { y: alignToBottom, duration: 1, ease: "none" }, 0);

    return () => timeline.scrollTrigger?.kill();
  });

  const refresh = () => requestAnimationFrame(() => ScrollTrigger.refresh());
  window.addEventListener("load", refresh, { once: true });
  window.addEventListener("pageshow", refresh);
})();
