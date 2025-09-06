//---------------------- carrusel
(() => {
  if (window.__ixCarouselInit) return;  
  window.__ixCarouselInit = true;

  class IxtlaCarousel {
    constructor(root){
      this.root = root;
      this.viewport = root.querySelector('.ix-viewport');
      this.track = root.querySelector('.ix-track');
      this.slides = Array.from(root.querySelectorAll('.ix-slide'));
      this.prevBtn = root.querySelector('.ix-prev');
      this.nextBtn = root.querySelector('.ix-next');
      this.indCur = root.querySelector('.ix-current');
      this.indTot = root.querySelector('.ix-total');

      this.total = this.slides.length;
      this.index = 0;
      this.loop = (root.dataset.loop || 'false') === 'true';
      this.autoplay = parseInt(root.dataset.autoplay || '0', 10); 
      this.timer = null;

      this._bind();
      this._update();
      if (this.autoplay > 0) this._startAutoplay();
    }

    _bind(){
      this.prevBtn?.addEventListener('click', () => this.prev());
      this.nextBtn?.addEventListener('click', () => this.next());
      window.addEventListener('resize', () => this._update(true));
      this.root.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') this.prev();
        if (e.key === 'ArrowRight') this.next();
      });

      let startX = 0, dx = 0, dragging = false;
      const onDown = (e) => {
        dragging = true;
        startX = (e.touches ? e.touches[0].clientX : e.clientX);
        this.track.style.transition = 'none';
        if (this.autoplay) this._stopAutoplay();
      };
      const onMove = (e) => {
        if (!dragging) return;
        const x = (e.touches ? e.touches[0].clientX : e.clientX);
        dx = x - startX;
        this._translate(-this.index * this.viewport.clientWidth + dx);
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        this.track.style.transition = '';
        const threshold = Math.min(80, this.viewport.clientWidth * 0.15);
        if (dx > threshold) this.prev();
        else if (dx < -threshold) this.next();
        else this._update(true); // volver
        dx = 0;
        if (this.autoplay) this._startAutoplay();
      };

      this.viewport.addEventListener('mousedown', onDown);
      this.viewport.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      this.viewport.addEventListener('touchstart', onDown, {passive:true});
      this.viewport.addEventListener('touchmove', onMove, {passive:true});
      this.viewport.addEventListener('touchend', onUp);
    }

    _translate(px){
      this.track.style.transform = `translateX(${px}px)`;
    }

    _update(force=false){
      const offset = -this.index * this.viewport.clientWidth;
      this._translate(offset);

      this.indTot && (this.indTot.textContent = String(this.total));
      this.indCur && (this.indCur.textContent = String(this.index + 1));

      this.slides.forEach((s, i) => {
        s.setAttribute('aria-label', `${i+1} de ${this.total}`);
      });

      if (!this.loop){
        this.prevBtn && (this.prevBtn.disabled = this.index <= 0);
        this.nextBtn && (this.nextBtn.disabled = this.index >= this.total - 1);
      }

      if (force){
        const current = this.slides[this.index];
        if (current){
          const h = current.getBoundingClientRect().height;
          this.viewport.style.height = h + 'px';
        }
      } else {
        setTimeout(() => {
          const current = this.slides[this.index];
          if (current){
            const h = current.getBoundingClientRect().height;
            this.viewport.style.height = h + 'px';
          }
        }, 0);
      }
    }

    goTo(i){
      if (this.loop){
        this.index = (i + this.total) % this.total;
      } else {
        this.index = Math.max(0, Math.min(this.total - 1, i));
      }
      this._update(true);
    }
    next(){ this.goTo(this.index + 1); }
    prev(){ this.goTo(this.index - 1); }

    _startAutoplay(){
      this._stopAutoplay();
      this.timer = setInterval(() => this.next(), this.autoplay);
      this.root.addEventListener('mouseenter', () => this._stopAutoplay());
      this.root.addEventListener('mouseleave', () => this._startAutoplay());
      this.root.addEventListener('focusin', () => this._stopAutoplay());
      this.root.addEventListener('focusout', () => this._startAutoplay());
    }
    _stopAutoplay(){
      if (this.timer){ clearInterval(this.timer); this.timer = null; }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.ix-carousel').forEach(el => {
      el.setAttribute('role', 'region');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-roledescription', 'carrusel');
      new IxtlaCarousel(el);
    });
  });
})();

// --------------------------- toasts globales ---------------------------
  (function ensureToastContainer() {
    if (!document.querySelector(".gc-toast-container")) {
      const cont = document.createElement("div");
      cont.className = "gc-toast-container";
      document.body.appendChild(cont);
    }
    window.gcToast = function (mensaje, tipo = "exito", duracion = 5000) {
      const cont = document.querySelector(".gc-toast-container");
      if (!cont) return;
      const toast = document.createElement("div");
      toast.className = `gc-toast ${tipo}`;
      toast.textContent = mensaje;
      cont.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add("mostrar"));
      setTimeout(() => {
        toast.classList.remove("mostrar");
        setTimeout(() => toast.remove(), 400);
      }, duracion);
    };
  })();