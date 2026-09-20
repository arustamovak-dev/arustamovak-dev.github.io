(() => {
  "use strict";

  const header = document.querySelector("#header");
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector("#navigation");
  const desktop = window.matchMedia("(min-width: 768px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function initMenu() {
    if (!header || !menuButton || !navigation) return;

    function setOpen(open, returnFocus = false) {
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      header.classList.toggle("is-open", open);
      navigation.hidden = !desktop.matches && !open;
      if (returnFocus) menuButton.focus();
    }

    function syncLayout() {
      const focusWillHide = !desktop.matches && navigation.contains(document.activeElement);
      const buttonHadFocus = document.activeElement === menuButton;
      menuButton.hidden = desktop.matches;
      setOpen(false, focusWillHide);
      if (desktop.matches && buttonHadFocus) navigation.querySelector(".navigation__link").focus();
    }

    header.classList.add("is-enhanced");
    syncLayout();
    desktop.addEventListener("change", syncLayout);
    menuButton.addEventListener("click", () => setOpen(menuButton.getAttribute("aria-expanded") !== "true"));
    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a[href]")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") setOpen(false, true);
    });
    document.addEventListener("pointerdown", (event) => {
      if (!header.contains(event.target)) setOpen(false);
    });
    document.addEventListener("focusin", (event) => {
      if (!header.contains(event.target)) setOpen(false);
    });
  }

  function initAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      const target = document.getElementById(link.getAttribute("href").slice(1));
      if (!target) return;
      link.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const focusTarget = target.querySelector("h1, h2") || target;
        focusTarget.focus({ preventScroll: true });
        target.querySelectorAll("[data-reveal]").forEach((element) => element.classList.add("is-visible"));
        // Нативный переход сохраняет якорь, историю и поведение без JavaScript.
      });
    });
  }

  function initScrollState() {
    if (!header) return;
    const links = [...document.querySelectorAll('.navigation__link[href^="#"]')];
    const sections = links.map((link) => document.querySelector(link.getAttribute("href")));
    let scheduled = false;

    function update() {
      scheduled = false;
      header.classList.toggle("is-scrolled", window.scrollY > 16);
      const offset = header.getBoundingClientRect().height + 24;
      let current = -1;
      sections.forEach((section, index) => {
        if (section && section.getBoundingClientRect().top <= offset) current = index;
      });
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) current = links.length - 1;
      links.forEach((link, index) => {
        if (index === current) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }

    function schedule() {
      if (!scheduled) { scheduled = true; window.requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    update();
  }

  function initImages(root = document) {
    root.querySelectorAll(".media img").forEach((image) => {
      const media = image.closest(".media");
      function update() {
        const loaded = image.complete && image.naturalWidth > 0;
        media.classList.toggle("is-loaded", loaded);
        media.classList.toggle("is-unavailable", !loaded);
      }
      image.addEventListener("load", update);
      image.addEventListener("error", update);
      update();
    });
  }

  function initBadge() {
    const badge = document.querySelector(".hero__badge");
    if (!badge || reducedMotion.matches) return;
    const image = badge.querySelector("img");
    let inView = !("IntersectionObserver" in window);
    let finished = false;
    let observer;

    function show(animate = false) {
      if (finished) return;
      finished = true;
      badge.classList.remove("is-waiting");
      if (animate) badge.classList.add("is-entering");
      observer?.disconnect();
    }

    function start() {
      if (inView && image.complete && image.naturalWidth > 0) show(!reducedMotion.matches);
    }

    badge.classList.add("is-waiting");
    image.addEventListener("load", start, { once: true });
    image.addEventListener("error", () => show(), { once: true });
    reducedMotion.addEventListener("change", (event) => {
      if (event.matches) {
        show();
        badge.classList.remove("is-entering");
      }
    });
    if (!inView) {
      observer = new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        start();
      }, { threshold: 0.15 });
      observer.observe(badge);
    }
    if (image.complete && !image.naturalWidth) show();
    else start();
  }

  function initBadgeSway() {
    const button = document.querySelector(".hero__badge-trigger");
    const image = button?.querySelector("img");
    if (!image || typeof image.animate !== "function") return;
    let sway;
    button.addEventListener("click", () => {
      if (reducedMotion.matches) return;
      const currentTransform = getComputedStyle(image).transform;
      sway?.cancel();
      // Replace only the image sway; the initial drop keeps its own animation.
      image.style.animation = "none";
      sway = image.animate([
        { transform: currentTransform === "none" ? "rotate(0deg)" : currentTransform },
        { transform: "rotate(-4deg)", offset: .16 },
        { transform: "rotate(3deg)", offset: .36 },
        { transform: "rotate(-1.8deg)", offset: .56 },
        { transform: "rotate(.8deg)", offset: .75 },
        { transform: "rotate(-.25deg)", offset: .9 },
        { transform: "rotate(0deg)" }
      ], { duration: 2600, easing: "ease-in-out" });
    });
    reducedMotion.addEventListener("change", event => {
      if (event.matches) sway?.cancel();
    });
  }

  function resetAnimatedPreviews(root = document) {
    root.querySelectorAll("img[data-animated-src]").forEach((image) => {
      if (image.getAttribute("src") !== image.dataset.posterSrc) image.src = image.dataset.posterSrc;
    });
  }

  function initHoverPreviews(root = document) {
    const images = [...root.querySelectorAll("img[data-animated-src]")];
    if (!images.length) return () => {};
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const touchScroll = window.matchMedia("(hover: none) and (pointer: coarse)");
    const scrollTarget = root === document ? window : root;
    let stopTimer;
    const stopImage = (image) => {
      if (image.getAttribute("src") !== image.dataset.posterSrc) image.src = image.dataset.posterSrc;
    };
    const reset = () => {
      window.clearTimeout(stopTimer);
      images.forEach(stopImage);
    };

    function canPlay(image) {
      if (reducedMotion.matches || document.hidden) return false;
      const activeDialog = document.querySelector("dialog[open]");
      return !activeDialog || activeDialog.contains(image);
    }

    function play(image) {
      if (image.getAttribute("src") !== image.dataset.animatedSrc) image.src = image.dataset.animatedSrc;
    }

    function isVisible(image) {
      const rect = image.getBoundingClientRect();
      const clip = root === document
        ? { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth }
        : root.getBoundingClientRect();
      const top = Math.max(0, clip.top);
      const bottom = Math.min(window.innerHeight, clip.bottom);
      if (bottom <= top) return false;
      const visibleHeight = Math.min(rect.bottom, bottom) - Math.max(rect.top, top);
      return rect.width > 0 && rect.height > 0 &&
        visibleHeight > Math.min(rect.height, bottom - top) * .15 &&
        rect.right > Math.max(0, clip.left) && rect.left < Math.min(window.innerWidth, clip.right);
    }

    function onScroll() {
      if (!touchScroll.matches) return;
      images.forEach((image) => {
        if (canPlay(image) && isVisible(image)) play(image);
        else stopImage(image);
      });
      window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(reset, 180);
    }

    images.forEach((image) => {
      const target = image.closest(".project-card") || image.closest(".media");
      const stop = () => stopImage(image);
      // Мышь запускает анимацию наведением, сенсорный экран — прокруткой.
      target.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "touch" || !canHover.matches || !canPlay(image)) return;
        play(image);
      }, options);
      target.addEventListener("pointerleave", stop, options);
      target.addEventListener("pointercancel", stop, options);
      image.addEventListener("error", () => {
        if (image.getAttribute("src") === image.dataset.animatedSrc) stop();
      }, options);
    });
    scrollTarget.addEventListener("scroll", onScroll, { ...options, passive: true });
    scrollTarget.addEventListener("scrollend", () => { if (touchScroll.matches) reset(); }, options);
    window.addEventListener("blur", reset, options);
    document.addEventListener("visibilitychange", () => { if (document.hidden) reset(); }, options);
    reducedMotion.addEventListener("change", reset, options);
    canHover.addEventListener("change", reset, options);
    touchScroll.addEventListener("change", reset, options);
    return () => { controller.abort(); reset(); };
  }

  function createDialogController(dialog, title, onClose = () => {}) {
    if (!dialog || typeof dialog.showModal !== "function") return null;
    const closeButton = dialog.querySelector(".project-dialog__close");
    let opener = null;
    let scrollPosition = { x: 0, y: 0 };
    let backdropPointer = null;

    function open(trigger) {
      if (document.querySelector("dialog[open]")) return;
      resetAnimatedPreviews();
      opener = trigger;
      scrollPosition = { x: window.scrollX, y: window.scrollY };
      dialog.showModal();
      document.body.style.setProperty("--modal-scroll-offset", `-${scrollPosition.y}px`);
      document.body.classList.add("is-modal-open");
      dialog.scrollTop = 0;
      title.focus({ preventScroll: true });
    }

    function outsideDialog(event) {
      const bounds = dialog.getBoundingClientRect();
      return event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom;
    }

    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dialog.close();
    });
    dialog.addEventListener("pointerdown", (event) => {
      backdropPointer = event.target === dialog && outsideDialog(event) ? event.pointerId : null;
    });
    dialog.addEventListener("pointerup", (event) => {
      if (event.pointerId === backdropPointer && event.target === dialog && outsideDialog(event)) dialog.close();
      backdropPointer = null;
    });
    dialog.addEventListener("pointercancel", () => { backdropPointer = null; });
    dialog.addEventListener("close", () => {
      document.body.classList.remove("is-modal-open");
      document.body.style.removeProperty("--modal-scroll-offset");
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(scrollPosition.x, scrollPosition.y);
      root.style.scrollBehavior = previousBehavior;
      if (opener && opener.isConnected) {
        const focusTarget = opener.closest("[hidden]") ? menuButton : opener;
        focusTarget?.focus({ preventScroll: true });
      }
      opener = null;
      backdropPointer = null;
      onClose();
    });
    return { open };
  }

  function initProjectDialogs() {
    const dialog = document.querySelector("#project-dialog");
    const title = document.querySelector("#project-dialog-title");
    const content = document.querySelector("#project-dialog-content");
    let disposePreviews = () => {};
    const controller = createDialogController(dialog, title, () => {
      disposePreviews();
      content.replaceChildren();
    });
    if (!controller) return;

    function openProject(card, trigger) {
      if (document.querySelector("dialog[open]")) return;
      resetAnimatedPreviews(card);
      title.textContent = card.querySelector("h3").textContent;
      title.classList.remove("has-logo");
      const logo = card.querySelector(".project-card__logo");
      if (logo) {
        const dialogLogo = logo.cloneNode(true);
        dialogLogo.className = "project-dialog__logo";
        dialogLogo.loading = "eager";
        title.prepend(dialogLogo);
        title.classList.add("has-logo");
      }
      const preview = card.querySelector(".project-card__preview").cloneNode(true);
      preview.className = "media project-dialog__preview";
      preview.querySelector("img").loading = "eager";
      const description = card.querySelector(".project-case__content").cloneNode(true);
      description.querySelector(".project-case__cover").replaceChildren(preview);
      content.replaceChildren(description);
      initImages(dialog);
      disposePreviews = initHoverPreviews(dialog);
      controller.open(trigger);
    }

    document.querySelectorAll(".project-card").forEach((card) => {
      const details = card.querySelector(".project-case");
      if (!details) return;
      const summary = details.querySelector("summary");
      const heading = summary.querySelector("h3");
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "project-card__title-button";
      trigger.textContent = heading.textContent;
      trigger.setAttribute("aria-label", summary.getAttribute("aria-label"));
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-controls", dialog.id);
      trigger.addEventListener("click", () => openProject(card, trigger));
      heading.replaceChildren(trigger);
      // Без JavaScript открытые кейсы раскрываются под карточкой; NDA остаётся статичной.
      details.before(...summary.children);
      details.hidden = true;
      card.classList.add("is-interactive");
    });
  }

  function initReveal() {
    const elements = [...document.querySelectorAll("[data-reveal]")];
    if (!("IntersectionObserver" in window) || reducedMotion.matches) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    elements.forEach((element) => {
      if (element.getBoundingClientRect().top < window.innerHeight) element.classList.add("is-visible");
      else { element.classList.add("is-reveal-ready"); observer.observe(element); }
    });
    function showAll() {
      elements.forEach((element) => element.classList.add("is-visible"));
      observer.disconnect();
    }
    reducedMotion.addEventListener("change", (event) => { if (event.matches) showAll(); });
    window.addEventListener("pageshow", (event) => { if (event.persisted) showAll(); });
  }

  const photoStack = document.querySelector(".about__photo photo-stack");
  const photoHint = document.querySelector(".about__photo-hint");
  if (photoStack && photoHint) {
    photoStack.addEventListener("photo-stack:change", ({ detail }) => {
      photoHint.textContent = detail.busy && detail.index === detail.total - 1
        ? "Фотографии возвращаются на место…"
        : detail.index === detail.total - 1
          ? "Нажмите на последнее фото, чтобы собрать стопку"
          : "Нажмите на фото, чтобы увидеть следующее";
    });
  }

  initMenu();
  initAnchors();
  initScrollState();
  initImages();
  initBadge();
  initBadgeSway();
  initHoverPreviews();
  initProjectDialogs();
  initReveal();
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
