(() => {
  const cover = document.querySelector(".about-cover");
  if (!cover || !window.gsap || !window.ScrollTrigger) return;

  const imageFrame = cover.querySelector(".about-cover__image");
  const image = imageFrame?.querySelector("img");
  const documentsCard = cover.querySelector(".about-cover__card--documents");
  const licensesCard = cover.querySelector(".about-cover__card--licenses");

  if (!imageFrame || !image || !documentsCard || !licensesCard) return;

  gsap.registerPlugin(ScrollTrigger);

  const motion = gsap.matchMedia();
  motion.add("(min-width: 64.001rem) and (prefers-reduced-motion: no-preference)", () => {
    gsap.set(documentsCard, { left: "-100%", autoAlpha: 0 });
    gsap.set(licensesCard, { right: "-100%", autoAlpha: 0 });

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: cover,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * 1.5)}`,
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    timeline
      .fromTo(imageFrame, {
        left: "0%",
        top: "0%",
        width: "100%",
        height: "100%",
        xPercent: 0,
        yPercent: 0
      }, {
        left: "50%",
        top: "50%",
        width: "75.4167%",
        height: "89.25%",
        xPercent: -50,
        yPercent: -50,
        duration: 0.5,
        ease: "none"
      }, 0)
      .to(image, {
        left: "-16.74%",
        top: "-12.61%",
        width: "133.47%",
        height: "151.12%",
        duration: 0.5,
        ease: "none"
      }, 0)
      .to(documentsCard, {
        left: "-11.6667%",
        autoAlpha: 1,
        duration: 0.32,
        ease: "none"
      }, 0)
      .to(licensesCard, {
        right: "-11.6667%",
        autoAlpha: 1,
        duration: 0.32,
        ease: "none"
      }, 0)
      .to(imageFrame, {
        left: "50%",
        top: "50%",
        width: "41.6667%",
        height: "55.125%",
        xPercent: -50,
        yPercent: -50,
        duration: 0.5,
        ease: "none"
      }, 0.5)
      .to(image, {
        left: "0%",
        top: "0%",
        width: "100%",
        height: "100%",
        duration: 0.5,
        ease: "none"
      }, 0.5)
      .to(documentsCard, {
        left: "5.2083%",
        duration: 0.5,
        ease: "none"
      }, 0.5)
      .to(licensesCard, {
        right: "5.2083%",
        duration: 0.5,
        ease: "none"
      }, 0.5);

    return () => timeline.scrollTrigger?.kill();
  });

  const refresh = () => requestAnimationFrame(() => ScrollTrigger.refresh());
  window.addEventListener("load", refresh, { once: true });
  window.addEventListener("pageshow", refresh);
})();
