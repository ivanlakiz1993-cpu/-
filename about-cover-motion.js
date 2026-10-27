(() => {
  document.querySelectorAll(".about-team__button").forEach((button) => {
    button.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const bounds = button.getBoundingClientRect();
      button.style.setProperty("--cursor-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
      button.style.setProperty("--cursor-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
    });
  });

  const cover = document.querySelector(".about-cover");
  if (!cover || !window.gsap || !window.ScrollTrigger) return;

  const imageFrame = cover.querySelector(".about-cover__image");
  const image = imageFrame?.querySelector("img");
  const documentsCard = cover.querySelector(".about-cover__card--documents");
  const licensesCard = cover.querySelector(".about-cover__card--licenses");
  const description = document.querySelector(".about-description");

  if (!imageFrame || !image || !documentsCard || !licensesCard) return;

  gsap.registerPlugin(ScrollTrigger);

  const motion = gsap.matchMedia();
  motion.add("(min-width: 64.001rem) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
    gsap.set(documentsCard, { left: "-100%", autoAlpha: 0 });
    gsap.set(licensesCard, { right: "-100%", autoAlpha: 0 });

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: cover,
        start: () => `top ${parseFloat(getComputedStyle(cover.closest("main")).paddingTop)}px`,
        end: () => `+=${Math.round(window.innerHeight * 1.875)}`,
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    timeline
      .fromTo(imageFrame, {
        left: "50%",
        top: "50%",
        width: "100%",
        height: "100%",
        xPercent: -50,
        yPercent: -50
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
      }, 0.5)
      // Hold the completed cover for an additional quarter of the timeline.
      .to({}, { duration: 0.25 }, 1);

    const descriptionReveal = description && gsap.fromTo(description,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        ease: "none",
        scrollTrigger: {
          trigger: cover,
          start: () => timeline.scrollTrigger.end,
          end: () => timeline.scrollTrigger.end + window.innerHeight * 0.15,
          scrub: true,
          invalidateOnRefresh: true
        }
      }
    );

    return () => {
      descriptionReveal?.scrollTrigger?.kill();
      timeline.scrollTrigger?.kill();
    };
  });

  const refresh = () => requestAnimationFrame(() => ScrollTrigger.refresh());
  window.addEventListener("load", refresh, { once: true });
  window.addEventListener("pageshow", refresh);
})();
