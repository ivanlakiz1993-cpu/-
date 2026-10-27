(() => {
  const gallery = document.querySelector(".about-gallery");
  const container = gallery?.querySelector(".about-gallery__container");
  const laboratory = gallery?.querySelector(".about-gallery__item--laboratory");
  const equipment = gallery?.querySelector(".about-gallery__item--equipment");
  const work = gallery?.querySelector(".about-gallery__item--work");

  if (!gallery || !container || !laboratory || !equipment || !work || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  const motion = gsap.matchMedia();
  motion.add("(prefers-reduced-motion: no-preference)", () => {
    const alignToBottom = () => container.clientHeight * 289 / 789;
    const sharedDrop = () => container.clientHeight * 40 / 789;
    const desktopMotion = window.matchMedia("(min-width: 64.001rem)").matches;
    gsap.set([laboratory, equipment, work], { y: 0 });

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: gallery,
        start: () => desktopMotion ? "top top" : `top ${Math.max(0, window.innerHeight - container.clientHeight)}px`,
        end: () => `+=${Math.round(Math.min(window.innerHeight * 0.55, container.clientHeight * 0.9))}`,
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    if (desktopMotion) {
      timeline
        .to({}, { duration: 0.22 })
        .to(laboratory, { y: () => alignToBottom() + sharedDrop(), duration: 1, ease: "none" }, 0.22)
        .to(equipment, { y: () => alignToBottom() + sharedDrop(), duration: 1, ease: "none" }, 0.22)
        .to(work, { y: sharedDrop, duration: 1, ease: "none" }, 0.22);
    } else {
      timeline
        .to(laboratory, { y: alignToBottom, duration: 1, ease: "none" }, 0)
        .to(equipment, { y: alignToBottom, duration: 1, ease: "none" }, 0);
    }

    return () => timeline.scrollTrigger?.kill();
  });

  const refresh = () => requestAnimationFrame(() => ScrollTrigger.refresh());
  window.addEventListener("load", refresh, { once: true });
  window.addEventListener("pageshow", refresh);
})();
