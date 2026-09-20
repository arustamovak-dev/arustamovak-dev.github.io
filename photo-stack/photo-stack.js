/* Photo Stack — standalone custom element. No dependencies or build step. */
(() => {
  if (customElements.get('photo-stack')) return;

  const css = `
    :host { display:block; width:100%; max-width:var(--photo-stack-width, 480px); }
    *, *::before, *::after { box-sizing:border-box; }
    .viewport { overflow:hidden; overflow:clip; padding:12px; }
    .stage { position:relative; display:block; width:100%; aspect-ratio:973 / 1212;
      margin:0; padding:0; border:0; border-radius:0; background:transparent;
      color:inherit; cursor:var(--photo-stack-cursor, pointer); touch-action:manipulation;
      -webkit-tap-highlight-color:transparent; isolation:isolate; }
    .stage:focus { outline:none; }
    .stage:focus-visible { outline:2px solid var(--photo-stack-focus, #796147);
      outline-offset:6px; border-radius:4px; }
    .stage[aria-busy="true"] { cursor:progress; }
    .card { position:absolute; display:block; transform-origin:50% 65%;
      pointer-events:none; user-select:none; }
    .card img { display:block; width:100%; height:auto; max-width:none; }
    .status { position:absolute; width:1px; height:1px; padding:0; margin:-1px;
      overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
  `;
  // The source files already contain their rotation, borders and shadows.
  // Coordinates are relative to the supplied 973 × 1212 reference canvas.
  const positions = [
    [26, 5, 805], [57, 159, 760], [114, 88, 805], [215, 22, 757]
  ];

  class PhotoStack extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._index = 0;
      this._busy = false;
      this._generation = 0;
      this._animations = new Set();
    }

    connectedCallback() {
      if (document.readyState === 'loading') {
        this._onReady = () => this._mount();
        document.addEventListener('DOMContentLoaded', this._onReady, { once:true });
      } else this._mount();
    }

    disconnectedCallback() {
      document.removeEventListener('DOMContentLoaded', this._onReady);
      this._generation++;
      this._animations.forEach(animation => animation.cancel());
      this._animations.clear();
      this._busy = false;
    }

    _mount() {
      if (!this.isConnected) return;
      const images = Array.from(this.children).filter(el => el.tagName === 'IMG');
      this.shadowRoot.innerHTML = `<style>${css}</style><div class="viewport">
        <button class="stage" type="button"></button></div>
        <span class="status" role="status" aria-live="polite" aria-atomic="true"></span>`;
      this._button = this.shadowRoot.querySelector('button');
      this._status = this.shadowRoot.querySelector('.status');
      this._cards = images.map((source, i) => {
        const card = document.createElement('span');
        card.className = 'card';
        card.setAttribute('aria-hidden', 'true');
        const [x, y, width] = positions[i % positions.length];
        Object.assign(card.style, {
          left:`${x / 973 * 100}%`, top:`${y / 1212 * 100}%`,
          width:`${width / 973 * 100}%`, zIndex:String(images.length - i)
        });
        const image = source.cloneNode(false);
        image.removeAttribute('id');
        image.removeAttribute('style');
        image.removeAttribute('class');
        image.alt = '';
        image.draggable = false;
        image.loading = 'eager';
        card.append(image);
        this._button.append(card);
        return card;
      });
      this._descriptions = images.map(img => img.alt);
      this._index = 0;
      this._busy = false;
      this._button.addEventListener('click', () => this.next());
      this._button.disabled = images.length === 0;
      this._update();
    }

    get currentIndex() { return this._index; }
    get busy() { return this._busy; }

    get duration() {
      const value = Number(this.getAttribute('duration') ?? 620);
      return Number.isFinite(value) ? Math.max(0, value) : 620;
    }

    _update() {
      const count = this._cards.length;
      const last = this._index === count - 1;
      const description = this._descriptions[this._index];
      const label = count ? `Фото ${this._index + 1} из ${count}${description ? '. ' + description : ''}. ${last ? 'Нажмите, чтобы собрать стопку' : 'Нажмите, чтобы посмотреть следующее фото'}` : 'Нет фотографий';
      this._button.setAttribute('aria-label', label);
      this._button.setAttribute('aria-busy', String(this._busy));
      this._status.textContent = this._busy ? (last ? 'Собираем стопку' : 'Меняем фотографию') : label;
      this.dispatchEvent(new CustomEvent('photo-stack:change', {
        bubbles:true, composed:true,
        detail:{ index:this._index, total:count, busy:this._busy }
      }));
    }

    async _move(card, returning, generation) {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const resting = { transform:'translate3d(0, 0, 0) rotate(0deg)', opacity:1 };
      const away = { transform:reduced ? resting.transform : 'translate3d(118%, -8%, 0) rotate(14deg)', opacity:0 };
      const midway = { transform:'translate3d(63%, -6%, 0) rotate(9deg)', opacity:0.9, offset:0.58 };
      const frames = reduced ? [resting, away] : [resting, midway, away];
      const animation = card.animate(frames, {
        duration:reduced ? Math.min(this.duration, 120) : this.duration,
        direction:returning ? 'reverse' : 'normal',
        easing:'cubic-bezier(.22,.68,.22,1)', fill:'both'
      });
      this._animations.add(animation);
      try { await animation.finished; }
      catch { return false; }
      finally { this._animations.delete(animation); }
      if (generation !== this._generation || !this.isConnected) {
        animation.cancel();
        return false;
      }
      Object.assign(card.style, returning ? resting : away);
      animation.cancel();
      return true;
    }

    async next() {
      if (this._busy || !this._cards?.length || !this.isConnected) return;
      if (this._index === this._cards.length - 1) return this.reset();
      const generation = this._generation;
      this._busy = true;
      this._update();
      if (!await this._move(this._cards[this._index], false, generation)) return;
      this._index++;
      this._busy = false;
      this._update();
    }

    async reset() {
      if (this._busy || !this._cards?.length || !this.isConnected) return;
      const generation = this._generation;
      this._busy = true;
      this._update();
      // Return each card completely before starting the next: 3 → 2 → 1.
      while (this._index > 0) {
        if (!await this._move(this._cards[this._index - 1], true, generation)) return;
        this._index--;
      }
      this._busy = false;
      this._update();
    }
  }

  customElements.define('photo-stack', PhotoStack);
})();
