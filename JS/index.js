// /JS/index.js
(() => {
    "use strict";

    const TAG = "[IndexCarrusel]";
    const log = (...args) => console.log(TAG, ...args);
    const warn = (...args) => console.warn(TAG, ...args);
    const error = (...args) => console.error(TAG, ...args);

    const API = {
        LIST: "/db/WEB/ixtla01_c_noticia_inicio.php",
    };

    const NEWS_ASSETS_DIR = "/ASSETS/noticiasImg/";
    const NEWS_PLACEHOLDER = "/ASSETS/main_logo_shield.png";
    const NEWS_MEDIA_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "heic", "heif"];
    const FETCH_TIMEOUT_MS = 12000;

    const state = {
        items: [],
        mediaVersion: {},
    };

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatText(value) {
        return escapeHtml(value).replace(/\n/g, "<br>");
    }

    function truncateText(value, maxLength = 320) {
        const text = String(value ?? "").trim();
        if (!text) return "";
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength).trimEnd() + "…";
    }

    function stripHtml(value) {
        const div = document.createElement("div");
        div.innerHTML = String(value ?? "");
        return (div.textContent || div.innerText || "").trim();
    }

    function formatDateMx(dateString) {
        if (!dateString) return "";

        const safe = String(dateString).replace(" ", "T");
        const date = new Date(safe);

        if (Number.isNaN(date.getTime())) return "";

        try {
            return new Intl.DateTimeFormat("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            }).format(date);
        } catch {
            return "";
        }
    }

    function getNoticiaMediaVersion(id) {
        const safeId = Number(id) || 0;
        if (!safeId) return "";
        return state.mediaVersion[`noticia-${safeId}`] || "";
    }

    function withMediaVersion(url, version) {
        if (!url || !version) return url;
        if (url.includes("placeholder")) return url;
        return `${url}?v=${version}`;
    }

    function getNoticiaImageCandidates(id) {
        const safeId = Number(id) || 0;
        const version = getNoticiaMediaVersion(safeId);

        if (!safeId) return [NEWS_PLACEHOLDER];

        const dir = `noticia${safeId}`;
        const file = `img${safeId}`;

        return [
            ...NEWS_MEDIA_EXTENSIONS.map((ext) =>
                withMediaVersion(`${NEWS_ASSETS_DIR}${dir}/${file}.${ext}`, version)
            ),
            NEWS_PLACEHOLDER,
        ];
    }

    function getNoticiaImageUrl(id) {
        return getNoticiaImageCandidates(id)[0] || NEWS_PLACEHOLDER;
    }

    function wireImageFallbacks(scope = document) {
        scope.querySelectorAll("img[data-fallbacks]").forEach((img) => {
            if (img.dataset.fallbackBound === "1") return;
            img.dataset.fallbackBound = "1";

            img.addEventListener("error", () => {
                let list = [];
                try {
                    list = JSON.parse(img.dataset.fallbacks || "[]");
                } catch {
                    list = [NEWS_PLACEHOLDER];
                }

                let index = Number(img.dataset.fallbackIndex || 0) + 1;
                if (index >= list.length) return;

                img.dataset.fallbackIndex = String(index);
                img.src = list[index];
            });
        });
    }

    function normalizeItem(item) {
        const id = Number(item?.id) || 0;
        const status = Number(item?.status ?? 1) === 0 ? 0 : 1;

        return {
            id,
            titulo: String(item?.titulo || "").trim(),
            pie_de_pagina: String(item?.pie_de_pagina || "").trim(),
            descripcion: String(item?.descripcion || "").trim(),
            status,
            created_at: String(item?.created_at || "").trim(),
            updated_at: String(item?.updated_at || "").trim(),
            imagen: getNoticiaImageUrl(id),
        };
    }

    async function sendJSON(url, body, method = "POST") {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(body || {}),
                signal: controller.signal,
            });

            const txt = await res.text();
            let json;

            try {
                json = JSON.parse(txt);
            } catch {
                json = { raw: txt };
            }

            if (!res.ok || json?.ok === false) {
                throw new Error(
                    json?.error || json?.message || json?.raw || `HTTP ${res.status}`
                );
            }

            return json;
        } finally {
            clearTimeout(timer);
        }
    }

    function buildSlideMarkup(item, index, total) {
        const imageCandidates = getNoticiaImageCandidates(item.id);
        const fecha = formatDateMx(item.created_at || item.updated_at);
        const descripcion = truncateText(item.descripcion, 360);
        const pie = truncateText(item.pie_de_pagina, 120);

        return `
    <article
      class="ix-slide"
      aria-roledescription="slide"
      aria-label="Slide ${index + 1} de ${total}"
      role="region"
    >
      <div class="ix-card">
        <figure class="ix-media foto">
          <img
            src="${escapeHtml(imageCandidates[0])}"
            alt="${escapeHtml(item.titulo || "Noticia del Ayuntamiento")}"
            loading="lazy"
            data-fallback-index="0"
            data-fallbacks='${escapeHtml(JSON.stringify(imageCandidates))}'
          >
        </figure>

        <div class="ix-content">
          ${item.titulo ? `<p><strong>${escapeHtml(item.titulo)}</strong></p>` : ""}
          ${descripcion ? `<p>${formatText(descripcion)}</p>` : ""}
          ${pie ? `<p class="ix-pie">${escapeHtml(pie)}</p>` : ""}

          ${fecha
                ? `
              <div class="ix-meta">
                <time class="ix-date" datetime="${escapeHtml(
                    String(item.created_at || item.updated_at || "")
                ).replace(" ", "T")}">${escapeHtml(fecha)}</time>
              </div>
            `
                : ""
            }
        </div>
      </div>
    </article>
  `;
    }

    function renderEmptySlide(message = "No hay noticias disponibles por el momento.") {
        return `
      <article
        class="ix-slide"
        aria-roledescription="slide"
        aria-label="Slide 1 de 1"
        role="region"
      >
        <div class="ix-card">
          <figure class="ix-media foto">
            <img
              src="${escapeHtml(NEWS_PLACEHOLDER)}"
              alt="Sin noticias disponibles"
              loading="lazy"
            >
          </figure>

          <div class="ix-content">
            <p><strong>Atención ciudadana</strong></p>
            <p>${escapeHtml(message)}</p>
          </div>
        </div>
      </article>
    `;
    }

    async function fetchNoticias() {
        const payload = {
            status: 1,
            all: true,
        };

        const json = await sendJSON(API.LIST, payload);
        const rows = Array.isArray(json?.data) ? json.data : [];
        return rows.map(normalizeItem).filter((item) => item.status === 1);
    }

    class IndexCarousel {
        constructor(root) {
            this.root = root;
            this.viewport = root.querySelector(".ix-viewport");
            this.track = root.querySelector(".ix-track");
            this.prevBtn = root.querySelector(".ix-prev");
            this.nextBtn = root.querySelector(".ix-next");
            this.indCur = root.querySelector(".ix-current");
            this.indTot = root.querySelector(".ix-total");

            this.slides = Array.from(root.querySelectorAll(".ix-slide"));
            this.total = this.slides.length;
            this.index = 0;
            this.loop = (root.dataset.loop || "false") === "true";
            this.autoplay = parseInt(root.dataset.autoplay || "0", 10);
            this.timer = null;

            this._bind();
            this._watchImages();
            this._update(true);

            if (this.autoplay > 0 && this.total > 1) {
                this._startAutoplay();
            }
        }

        _refreshSlides() {
            this.slides = Array.from(this.root.querySelectorAll(".ix-slide"));
            this.total = this.slides.length;
        }

        _bind() {
            this.prevBtn?.addEventListener("click", () => this.prev());
            this.nextBtn?.addEventListener("click", () => this.next());

            window.addEventListener("resize", () => this._update(true));

            this.root.addEventListener("keydown", (e) => {
                if (e.key === "ArrowLeft") this.prev();
                if (e.key === "ArrowRight") this.next();
            });

            let startX = 0;
            let dx = 0;
            let dragging = false;

            const onDown = (e) => {
                if (this.total <= 1) return;
                dragging = true;
                startX = e.touches ? e.touches[0].clientX : e.clientX;
                this.track.style.transition = "none";
                if (this.autoplay) this._stopAutoplay();
            };

            const onMove = (e) => {
                if (!dragging) return;
                const x = e.touches ? e.touches[0].clientX : e.clientX;
                dx = x - startX;
                this._translate(-this.index * this.viewport.clientWidth + dx);
            };

            const onUp = () => {
                if (!dragging) return;
                dragging = false;
                this.track.style.transition = "";
                const threshold = Math.min(80, this.viewport.clientWidth * 0.15);

                if (dx > threshold) this.prev();
                else if (dx < -threshold) this.next();
                else this._update(true);

                dx = 0;
                if (this.autoplay && this.total > 1) this._startAutoplay();
            };

            this.viewport?.addEventListener("mousedown", onDown);
            this.viewport?.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);

            this.viewport?.addEventListener("touchstart", onDown, { passive: true });
            this.viewport?.addEventListener("touchmove", onMove, { passive: true });
            this.viewport?.addEventListener("touchend", onUp);
        }

        _watchImages() {
            const imgs = Array.from(this.root.querySelectorAll("img"));
            if (!imgs.length) return;

            const onImgReady = () => this._update(true);

            imgs.forEach((img) => {
                if (img.complete) return;
                img.addEventListener("load", onImgReady, { once: true });
                img.addEventListener("error", onImgReady, { once: true });
            });

            window.addEventListener("load", onImgReady, { once: true });
        }

        _translate(px) {
            if (!this.track) return;
            this.track.style.transform = `translateX(${px}px)`;
        }

        _update(force = false) {
            this._refreshSlides();

            if (!this.total) {
                if (this.indTot) this.indTot.textContent = "0";
                if (this.indCur) this.indCur.textContent = "0";
                if (this.prevBtn) this.prevBtn.disabled = true;
                if (this.nextBtn) this.nextBtn.disabled = true;
                return;
            }

            if (this.index > this.total - 1) this.index = this.total - 1;
            if (this.index < 0) this.index = 0;

            const offset = -this.index * this.viewport.clientWidth;
            this._translate(offset);

            if (this.indTot) this.indTot.textContent = String(this.total);
            if (this.indCur) this.indCur.textContent = String(this.index + 1);

            if (!this.loop || this.total <= 1) {
                if (this.prevBtn) this.prevBtn.disabled = this.index <= 0;
                if (this.nextBtn) this.nextBtn.disabled = this.index >= this.total - 1;
            }

            const applyHeight = () => {
                const current = this.slides[this.index];
                if (!current || !this.viewport) return;
                const h = current.getBoundingClientRect().height;
                this.viewport.style.height = `${h}px`;
            };

            if (force) applyHeight();
            else setTimeout(applyHeight, 0);
        }

        goTo(i) {
            if (!this.total) return;

            if (this.loop && this.total > 1) {
                this.index = (i + this.total) % this.total;
            } else {
                this.index = Math.max(0, Math.min(this.total - 1, i));
            }

            this._update(true);
        }

        next() {
            this.goTo(this.index + 1);
        }

        prev() {
            this.goTo(this.index - 1);
        }

        _startAutoplay() {
            this._stopAutoplay();
            this.timer = setInterval(() => this.next(), this.autoplay);

            this.root.addEventListener("mouseenter", () => this._stopAutoplay());
            this.root.addEventListener("mouseleave", () => {
                if (this.total > 1) this._startAutoplay();
            });
            this.root.addEventListener("focusin", () => this._stopAutoplay());
            this.root.addEventListener("focusout", () => {
                if (this.total > 1) this._startAutoplay();
            });
        }

        _stopAutoplay() {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        }
    }

    async function initNoticiasCarrusel() {
        const root = document.querySelector("#ix-carrusel-atencion .ix-carousel");
        if (!root) {
            warn("No encontré el carrusel del index.");
            return;
        }

        const track = root.querySelector(".ix-track");
        if (!track) {
            warn("No encontré .ix-track.");
            return;
        }

        root.setAttribute("role", "region");
        root.setAttribute("tabindex", "0");
        root.setAttribute("aria-roledescription", "carrusel");

        try {
            log("Consultando noticias activas...");
            const items = await fetchNoticias();
            state.items = items;

            if (!items.length) {
                track.innerHTML = renderEmptySlide();
            } else {
                track.innerHTML = items
                    .map((item, index) => buildSlideMarkup(item, index, items.length))
                    .join("");
            }

            wireImageFallbacks(root);
            new IndexCarousel(root);
            log("Carrusel listo con", items.length, "noticia(s).");
        } catch (err) {
            error("No se pudieron cargar las noticias:", err);
            track.innerHTML = renderEmptySlide(
                "No se pudieron cargar las noticias en este momento."
            );
            new IndexCarousel(root);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initNoticiasCarrusel, {
            once: true,
        });
    } else {
        initNoticiasCarrusel();
    }
})();