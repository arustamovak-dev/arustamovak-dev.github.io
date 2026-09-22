(() => {
  "use strict";

  const desktopPointer = matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)");
  const selector = 'a[href], button, summary, [role="button"]';
  const hint = document.createElement("div");
  hint.className = "interaction-cursor";
  hint.textContent = "давай посмотрим?";
  hint.setAttribute("aria-hidden", "true");
  document.body.append(hint);
  let frame = 0;
  let point = null;

  function hide() {
    cancelAnimationFrame(frame);
    frame = 0;
    point = null;
    hint.classList.remove("is-visible");
  }

  function render() {
    frame = 0;
    if (!point) return;
    const { x, y } = point;
    const gap = 18;
    const margin = 8;
    const width = hint.offsetWidth;
    const height = hint.offsetHeight;
    let left = x + gap;
    let top = y + gap;
    if (left + width > innerWidth - margin) left = x - width - gap;
    if (top + height > innerHeight - margin) top = y - height - gap;
    hint.style.left = `${Math.max(margin, left)}px`;
    hint.style.top = `${Math.max(margin, top)}px`;
    hint.classList.add("is-visible");
  }

  function track(event) {
    if (!desktopPointer.matches || event.pointerType !== "mouse") return hide();
    // Exclude modal content, the photo stack and the hero badge.
    const path = event.composedPath();
    if (path.some(node => node instanceof Element && node.matches("dialog, photo-stack, .hero__badge"))) return hide();
    const target = path.find(node => node instanceof Element && node.matches(selector));
    const blocked = path.some(node => node instanceof Element &&
      node.matches(':disabled, [aria-disabled="true"], [inert]'));
    if (!target || blocked) return hide();
    point = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(render);
  }

  document.addEventListener("pointerover", track, { passive: true });
  document.addEventListener("pointermove", track, { passive: true });
  document.addEventListener("pointerout", event => { if (!event.relatedTarget) hide(); });
  document.addEventListener("pointerdown", hide, { passive: true });
  document.addEventListener("click", hide);
  document.addEventListener("keydown", hide);
  document.addEventListener("scroll", hide, { capture: true, passive: true });
  document.addEventListener("close", hide, true);
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("blur", hide);
  window.addEventListener("resize", hide);
  desktopPointer.addEventListener("change", hide);
})();
