//---------------------- carrusel
(() => {
  if (window.__ixCarouselInit) return;
  window.__ixCarouselInit = true;

  class IxtlaCarousel {
    constructor(root) {
      this.root = root;
      this.viewport = root.querySelector(".ix-viewport");
      this.track = root.querySelector(".ix-track");
      this.slides = Array.from(root.querySelectorAll(".ix-slide"));
      this.prevBtn = root.querySelector(".ix-prev");
      this.nextBtn = root.querySelector(".ix-next");
      this.indCur = root.querySelector(".ix-current");
      this.indTot = root.querySelector(".ix-total");

      this.total = this.slides.length;
      this.index = 0;
      this.loop = (root.dataset.loop || "false") === "true";
      this.autoplay = parseInt(root.dataset.autoplay || "0", 10);
      this.timer = null;

      this._classifyImages(); // update, verifica si es una infografia o solo una imagen
      this._bind();
      this._update();
      if (this.autoplay > 0) this._startAutoplay();
    }

    // Clasifica imagenes segun su nombre de archivo
    _classifyImages() {
      this.slides.forEach((slide, idx) => {
        const fig = slide.querySelector(".ix-media");
        const img = fig?.querySelector("img");
        if (!fig || !img) return;

        const src = (img.getAttribute("src") || "").toLowerCase();
        if (/\/?infoimg\d+\.(jpg|jpeg|png|webp|gif|svg)$/i.test(src)) { //por si acaso
          fig.classList.add("infografia");
          fig.classList.remove("foto");
        } else {
          fig.classList.add("foto");
          fig.classList.remove("infografia");
        }

        // Accesibilidad
        slide.setAttribute("aria-label", `Slide ${idx + 1} de ${this.total}`);
        slide.setAttribute("role", "region");
      });

      if (this.indTot) this.indTot.textContent = String(this.total);
      if (this.indCur) this.indCur.textContent = this.total > 0 ? "1" : "0";
    }

    _bind() {
      this.prevBtn?.addEventListener("click", () => this.prev());
      this.nextBtn?.addEventListener("click", () => this.next());
      window.addEventListener("resize", () => this._update(true));
      this.root.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") this.prev();
        if (e.key === "ArrowRight") this.next();
      });

      let startX = 0,
        dx = 0,
        dragging = false;
      const onDown = (e) => {
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
        else this._update(true); // volver
        dx = 0;
        if (this.autoplay) this._startAutoplay();
      };

      this.viewport.addEventListener("mousedown", onDown);
      this.viewport.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      this.viewport.addEventListener("touchstart", onDown, { passive: true });
      this.viewport.addEventListener("touchmove", onMove, { passive: true });
      this.viewport.addEventListener("touchend", onUp);
    }

    _translate(px) {
      this.track.style.transform = `translateX(${px}px)`;
    }

    _update(force = false) {
      const offset = -this.index * this.viewport.clientWidth;
      this._translate(offset);

      this.indTot && (this.indTot.textContent = String(this.total));
      this.indCur && (this.indCur.textContent = String(this.index + 1));

      if (!this.loop) {
        this.prevBtn && (this.prevBtn.disabled = this.index <= 0);
        this.nextBtn && (this.nextBtn.disabled = this.index >= this.total - 1);
      }

      if (force) {
        const current = this.slides[this.index];
        if (current) {
          const h = current.getBoundingClientRect().height;
          this.viewport.style.height = h + "px";
        }
      } else {
        setTimeout(() => {
          const current = this.slides[this.index];
          if (current) {
            const h = current.getBoundingClientRect().height;
            this.viewport.style.height = h + "px";
          }
        }, 0);
      }
    }

    goTo(i) {
      if (this.loop) {
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
      this.root.addEventListener("mouseleave", () => this._startAutoplay());
      this.root.addEventListener("focusin", () => this._stopAutoplay());
      this.root.addEventListener("focusout", () => this._startAutoplay());
    }
    _stopAutoplay() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".ix-carousel").forEach((el) => {
      el.setAttribute("role", "region");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-roledescription", "carrusel");
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


//----------------------------------------------------- componente para las cards de departamentos
(() => {
  // --- debug
  if (typeof window.IX_DEBUG === "undefined") window.IX_DEBUG = true;
  const ixLog = (...a) => {
    if (window.IX_DEBUG)
      try {
        console.log("[IX]", ...a);
      } catch {}
  };

  // --- endpoint
  const ENDPOINT =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_departamentos.php";
  const REQUEST_BODY = { status: 1 };
  

  // --- assets 
  const ASSETS_DIR = "/ASSETS/departamentos/"; // carpeta de los assets
  const PLACEHOLDER = "placeholder_icon.png"; // por si no hay icono PENDIENTE
  const TIMEOUT_MS = 10000;

  const COPY_BY_ID = {
    // { h3: "Alumbrado público", p: "Texto curado opcional..." },
  };

  // ordenado por id asc.
  const ORDER_IDS = [

  ];

  // se arma la card con un falback al id de lo que llego desde el fetch
  const buildCard = (row) => {
    const id = Number(row?.id) || 0;
    const nombre = (row?.nombre || "Departamento").toString().trim();
    const descApi = (row?.descripcion || "").toString().trim();

    const override = COPY_BY_ID[id];
    const h3Text = override?.h3 || nombre;
    const pText =
      override?.p ||
      descApi ||
      "Consulta trámites y servicios del departamento.";

    // anchor principal
    const a = document.createElement("a");
    a.className = "ix-tile";
    a.href = `/VIEWS/tramiteDepartamento.php?depId=${encodeURIComponent(id)}`; 
    a.setAttribute("aria-label", `${nombre} – ${h3Text}`);
    a.dataset.id = String(id);

    if (!override && !descApi) a.dataset.genericCopy = "true";

    // logo + img con fallback: primero .png, luego .jpg y si no placeholder
    const logo = document.createElement("div");
    logo.className = "ix-logo";

    const img = document.createElement("img");
    img.alt = nombre; 

    // intentamos png y si falla, intentamos jpg y si falla va directo con un placeholder
    let triedPng = false;
    let triedJpg = false;

    const setPlaceholder = () => {
      img.src = ASSETS_DIR + PLACEHOLDER;
      img.alt = "Icono temporal";
      a.classList.add("asset-missing"); //para debug por si acaso algo no cargo como deberia
      a.dataset.missingAsset = "true";
    };

    img.addEventListener("error", () => {
      // si cayo un placeholder termina el ciclo
      if (img.src.endsWith("/" + PLACEHOLDER)) return;

      if (!triedPng) {
        triedPng = true;
        // fallo png (no deberia), intenta jpg
        img.src = `${ASSETS_DIR}dep_img${id}.jpg`;
        return;
      }
      if (!triedJpg) {
        triedJpg = true;
        // ok, no funciono jpg, nos vamos a placeholder
        setPlaceholder();
        return;
      }
      // por si acaso
      setPlaceholder();
    });

    // primer intento: .png
    img.src = `${ASSETS_DIR}dep_img${id}.png`;

    logo.appendChild(img);

    // título y párrafo
    const h3 = document.createElement("h3");
    h3.textContent = h3Text;

    const p = document.createElement("p");
    p.textContent = pText;

    a.append(logo, h3, p);
    return a;
  };

  const sortRows = (rows) => {
    const prio = new Map(ORDER_IDS.map((id, idx) => [Number(id), idx]));
    return [...rows]
      .map((r) => ({
        r,
        pr: prio.has(Number(r.id)) ? prio.get(Number(r.id)) : Infinity,
      }))
      .sort((a, b) => {
        if (a.pr !== b.pr) return a.pr - b.pr;
        const ai = Number(a.r.id) || 0;
        const bi = Number(b.r.id) || 0;
        return ai - bi;
      })
      .map((x) => x.r);
  };

  // runner principal (se llama solo si el contenedor existe)
  const run = async () => {
    const section = document.getElementById("tramites");
    if (!section) {
      ixLog("No hay #tramites en esta vista, me salgo.");
      return;
    }

    const grid = section.querySelector(".ix-grid");
    if (!grid) {
      ixLog("No hay .ix-grid dentro de #tramites, me salgo.");
      return;
    }

    // se limpia el DOM para quitar las cards antiguas, voy a dejar la de SAMAPA
    grid.innerHTML = "";

    // traemos los departamentos del API
    let data = [];
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(REQUEST_BODY),
        signal: controller.signal,
      });

      clearTimeout(t);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.ok || !Array.isArray(json?.data))
        throw new Error("Respuesta inesperada del API");

      data = json.data;
      ixLog("departamentos recibidos:", data);
    } catch (err) {
      ixLog("falló el fetch de departamentos:", err?.message || err);
      const msg = document.createElement("p");
      msg.className = "ix-note";
      msg.textContent =
        "No se pudieron cargar los departamentos en este momento.";
      grid.appendChild(msg);
      return;
    }

    // ordenamos y pintamos
    const ordered = sortRows(data);
    ordered.forEach((row) => grid.appendChild(buildCard(row)));

    ixLog(
      "render listo (ids):",
      ordered.map((r) => r.id)
    );
  };

  // corre cuando el DOM esté listo (o ya)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();

//GUARD para luego
/*import { getSession } from "/JS/auth/session.js";
  const sess = getSession();
  if (!sess) {
    gcToast("Inicia sesión para continuar.", "warning");
    setTimeout(() => { window.location.href = "/VIEWS/Login.php"; }, 600);
  } else {
    window.__ixSession = sess; // disponible para tu home.js
    console.log("[AuthGuard] Sesión:", sess);
  }*/