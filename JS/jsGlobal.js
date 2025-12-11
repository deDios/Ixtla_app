// JS Global
(() => {
  "use strict";
  if (window.__gcGlobalInit) return;
  window.__gcGlobalInit = true;

  /* ===================== CONFIG ===================== */
  const GC_DEFAULT_CONFIG = {
    PATHS: {
      ASSETS: "/ASSETS",
      VIEWS: "/VIEWS",
    },
    ROUTES: {
      publicHome: "/index.php",
      appHome: "/VIEWS/home copy.php",
      login: "/VIEWS/login.php",
    },
    ASSETS: {
      DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
      // IMPORTANTE: carpeta donde guardamos "img_{id}.png"
      AVATAR_BASE: "/ASSETS/user/userImgs",
    },
    SOCIAL: {
      facebook: "https://www.facebook.com/GobIxtlahuacanMembrillos/",
      instagram: "https://www.instagram.com/imembrillosgob/",
      youtube:
        "https://www.youtube.com/channel/UC1ZKpGArLJac1ghYW5io5OA/videos",
      x: "https://twitter.com",
    },
    FLAGS: {
      stickyHeaderOffset: 50,
      animateOnView: true,
    },
  };

  const CFG = (function merge(base, ext) {
    const out = structuredClone
      ? structuredClone(base)
      : JSON.parse(JSON.stringify(base));
    const src = window.GC_CONFIG || {};
    function deepMerge(target, from) {
      for (const k of Object.keys(from || {})) {
        if (from[k] && typeof from[k] === "object" && !Array.isArray(from[k])) {
          target[k] =
            target[k] && typeof target[k] === "object" ? target[k] : {};
          deepMerge(target[k], from[k]);
        } else {
          target[k] = from[k];
        }
      }
    }
    deepMerge(out, src);
    return out;
  })(GC_DEFAULT_CONFIG, window.GC_CONFIG);

  /* ===== Helpers de rutas/paths ===== */
  const abs = (p) => new URL(p, window.location.origin).pathname;
  const join = (...parts) =>
    parts
      .filter(Boolean)
      .map((s, i) =>
        i === 0 ? s.replace(/\/+$/g, "") : s.replace(/^\/+|\/+$/g, "")
      )
      .join("/")
      .replace(/\/{2,}/g, "/");

  const asset = (sub) => abs(join(CFG.PATHS.ASSETS, sub));
  const view = (sub) => abs(join(CFG.PATHS.VIEWS, sub));

  const routePublicHome = CFG.ROUTES?.publicHome
    ? abs(CFG.ROUTES.publicHome)
    : abs("/index.php");
  const routeAppHome = CFG.ROUTES?.appHome
    ? abs(CFG.ROUTES.appHome)
    : view("home.php");
  const routeLogin = CFG.ROUTES?.login
    ? abs(CFG.ROUTES.login)
    : view("login.php");

  const DEFAULT_AVATAR = abs(
    CFG.ASSETS.DEFAULT_AVATAR || "/ASSETS/user/img_user1.png"
  );
  const AVATAR_BASE = abs(CFG.ASSETS.AVATAR_BASE || "/ASSETS/user/userImgs");

  /* ===================== SESIÓN ===================== */
  function getIxSession() {
    try {
      const m = document.cookie
        .split("; ")
        .find((c) => c.startsWith("ix_emp="));
      if (!m) return null;
      const raw = decodeURIComponent(m.split("=")[1] || "");
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {
      return null;
    }
  }
  function clearIxSession() {
    document.cookie =
      "ix_emp=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
    document.cookie =
      "usuario=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
  }

  /* ===================== UTILS ===================== */
  const withBust = (url) => {
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.set("v", Date.now().toString());
      return u.pathname + "?" + u.searchParams.toString();
    } catch {
      return url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
    }
  };

  function setImgWithExtFallback(
    imgEl,
    bases,
    { extOrder = ["png", "jpg"], placeholder, cacheBust = true } = {}
  ) {
    const isAbsolute = (u) => /^https?:\/\//i.test(u) || u.startsWith("/");
    const hasExt = (u) => /\.[a-zA-Z0-9]{2,5}(\?|#|$)/.test(u);

    const queue = [];
    const baseArr = Array.isArray(bases) ? bases : [bases];
    baseArr.forEach((b) => {
      if (!b) return;
      if (hasExt(b)) queue.push(b);
      else extOrder.forEach((ext) => queue.push(`${b}.${ext}`));
    });

    let i = 0;
    const tryNext = () => {
      if (i >= queue.length) {
        if (placeholder) {
          imgEl.onerror = null;
          imgEl.src = cacheBust ? withBust(placeholder) : placeholder;
        }
        return;
      }
      const url = queue[i++];
      imgEl.onerror = tryNext;
      imgEl.onload = () => {
        imgEl.dataset.srcResolved = url;
        imgEl.onerror = null;
      };
      imgEl.src = cacheBust && isAbsolute(url) ? withBust(url) : url;
    };

    tryNext();
  }

  // === Avatar helpers ===
  function gcAvatarUrlFor(id) {
    if (id == null) return DEFAULT_AVATAR;
    return `${AVATAR_BASE}/img_${id}.png`;
  }

  function setAvatarSrc(imgEl, session) {
    const cookieUrl = session?.avatarUrl || session?.avatar || null;
    const id =
      session?.id_usuario != null ? String(session.id_usuario).trim() : null;

    // Orden de preferencia:
    // 1) URL directa (si vino de la respuesta del upload)
    // 2) NUEVO: img_{id}.png
    // 3) LEGACY: user_{id}.png
    // 4) DEFAULT
    const candidates = [
      ...(cookieUrl ? [cookieUrl] : []),
      ...(id ? [`${AVATAR_BASE}/img_${id}`] : []),
      ...(id ? [`${AVATAR_BASE}/user_${id}`] : []),
      DEFAULT_AVATAR,
    ];

    setImgWithExtFallback(imgEl, candidates, {
      extOrder: ["png", "jpg"],
      placeholder: DEFAULT_AVATAR,
      cacheBust: true,
    });

    imgEl.alt = session?.nombre
      ? `${session.nombre} ${session?.apellidos || ""}`.trim()
      : "Avatar";
    imgEl.loading = "lazy";
  }

  // Refrescar todas las vistas conocidas con un URL (opcional) o tomando la sesión
  function gcRefreshAvatarEverywhere(url, sessionOverride) {
    const session = sessionOverride || getIxSession();

    // Header desktop
    document.querySelectorAll(".actions .img-perfil").forEach((img) => {
      if (url) img.src = withBust(url);
      else setAvatarSrc(img, session);
    });

    // Header móvil
    const mobImg = document.querySelector(".user-icon-mobile img");
    if (mobImg) {
      if (url) mobImg.src = withBust(url);
      else setAvatarSrc(mobImg, session);
    }

    // Cualquier avatar visible en la vista (por ejemplo el del sidebar)
    const side = document.getElementById("hs-avatar");
    if (side) {
      if (url) side.src = withBust(url);
      else setAvatarSrc(side, session);
    }
  }

  // Exponer helpers
  window.gcSetAvatarSrc = setAvatarSrc;
  window.gcAvatarUrlFor = gcAvatarUrlFor;
  window.gcRefreshAvatarEverywhere = gcRefreshAvatarEverywhere;

  window.gcRefreshHeader = function gcRefreshHeader(sessionOverride) {
    const session = sessionOverride || getIxSession();

    // Desktop header
    const wrap = document.querySelector(".actions .user-icon");
    if (wrap) {
      const emailSpan = wrap.querySelector(".user-email");
      const img = wrap.querySelector("img.img-perfil");
      if (emailSpan && session?.email) emailSpan.textContent = session.email;
      if (img) setAvatarSrc(img, session);
    }

    // Mobile header
    const mobImg = document.querySelector(".user-icon-mobile img");
    if (mobImg) setAvatarSrc(mobImg, session);

    document.dispatchEvent(
      new CustomEvent("gc:header-refreshed", { detail: { session } })
    );
  };

  // Escucha global: cuando el editor de avatar suba una imagen, refrescamos
  document.addEventListener("gc:avatar-updated", (e) => {
    const url = e?.detail?.url || null; // ej. "/ASSETS/user/userImgs/img_12.png"
    gcRefreshAvatarEverywhere(url);
  });

  // CSS var --vh para layouts móviles
  const applyVH = () =>
    document.documentElement.style.setProperty(
      "--vh",
      `${window.innerHeight * 0.01}px`
    );
  applyVH();
  window.addEventListener("resize", applyVH);

  /* ===================== ANIMACIONES (.animado) ===================== */
  document.addEventListener("DOMContentLoaded", () => {
    if (!CFG.FLAGS.animateOnView) return;
    const animados = document.querySelectorAll(".animado");
    if (!animados.length) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.2 }
    );
    animados.forEach((el) => io.observe(el));
  });

  /* ===================== MENÚ HAMBURGUESA ===================== */
  window.toggleMenu = function toggleMenu() {
    const menu = document.getElementById("mobile-menu");
    if (!menu) return;
    const burger = document.querySelector(".hamburger");
    const isOpen = menu.classList.toggle("show");
    menu.hidden = !isOpen;
    if (burger) burger.setAttribute("aria-expanded", String(isOpen));
  };

  /* ===================== HEADER STICKY ===================== */
  document.addEventListener("DOMContentLoaded", () => {
    const header = document.getElementById("header");
    if (!header) return;
    const onScroll = () =>
      window.scrollY > (CFG.FLAGS.stickyHeaderOffset || 50)
        ? header.classList.add("scrolled")
        : header.classList.remove("scrolled");
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  });

  /* ===================== TOPBAR (avatar, dropdown, móvil) ===================== */
  document.addEventListener("DOMContentLoaded", () => {
    const session = getIxSession();
    const isLogged = !!(session?.email || session?.nombre);

    // --- Desktop ---
    const actions = document.querySelector(".actions");
    if (actions) {
      actions.querySelector(".user-icon")?.remove();

      if (isLogged) {
        const emailShown = session.email || "Usuario";
        const wrap = document.createElement("div");
        wrap.className = "user-icon";
        wrap.setAttribute("role", "button");
        wrap.setAttribute("tabindex", "0");
        wrap.setAttribute("aria-haspopup", "true");
        wrap.setAttribute("aria-expanded", "false");
        wrap.innerHTML = `
          <span class="user-email">${emailShown}</span>
          <img alt="Perfil" title="Perfil" class="img-perfil" />
          <div class="dropdown-menu" id="user-dropdown" role="menu" aria-hidden="true">
            <ul>
              <li role="menuitem" tabindex="-1">
                <img src="${asset(
                  "/user/userMenu/homebtn.png"
                )}" alt="" aria-hidden="true" />
                Ir a Home
              </li>
              <li id="logout-btn" role="menuitem" tabindex="-1">
                <img src="${asset(
                  "/user/userMenu/logoutbtn.png"
                )}" alt="" aria-hidden="true" />
                Logout
              </li>
            </ul>
          </div>`;
        actions.appendChild(wrap);
        actions.classList.add("mostrar");

        const img = wrap.querySelector("img.img-perfil");
        if (img) setAvatarSrc(img, session);

        const dd = wrap.querySelector("#user-dropdown");
        const open = (flag) => {
          dd.classList.toggle("active", flag);
          dd.setAttribute("aria-hidden", String(!flag));
          wrap.setAttribute("aria-expanded", String(!!flag));
        };
        const toggle = (e) => {
          e?.stopPropagation();
          open(!dd.classList.contains("active"));
        };

        wrap.addEventListener("click", toggle);
        wrap.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle(e);
          }
          if (e.key === "Escape") open(false);
        });
        document.addEventListener("click", () => open(false));

        dd.querySelector("li:nth-child(1)")?.addEventListener("click", () => {
          window.location.href = routeAppHome;
        });
        dd.querySelector("#logout-btn")?.addEventListener("click", () => {
          clearIxSession();
          sessionStorage.removeItem("bienvenidaMostrada");
          window.location.href = routeLogin;
        });

        if (!sessionStorage.getItem("bienvenidaMostrada")) {
          try {
            window.gcToast?.(
              `Bienvenido, ${session.nombre || "usuario"}`,
              "exito"
            );
          } catch {}
          sessionStorage.setItem("bienvenidaMostrada", "true");
        }
      } else {
        const loginIcon = document.createElement("div");
        loginIcon.className = "user-icon";
        loginIcon.innerHTML = `<img src="${withBust(
          DEFAULT_AVATAR
        )}" alt="Usuario" title="Iniciar sesión" class="img-perfil" />`;
        loginIcon.addEventListener(
          "click",
          () => (window.location.href = routeLogin)
        );
        actions.appendChild(loginIcon);
        actions.classList.add("mostrar");
      }
    }

    // --- Mobile ---
    const socialIconsContainer =
      document.querySelector("#header .social-bar-mobile .social-icons") ||
      document.querySelector("#header .subnav .social-icons") ||
      document.querySelector(".social-icons");

    if (socialIconsContainer) {
      socialIconsContainer.querySelector(".user-icon-mobile")?.remove();

      const mob = document.createElement("div");
      mob.className = "user-icon-mobile";
      mob.innerHTML = `<img alt="Perfil" title="Perfil" src="${withBust(
        DEFAULT_AVATAR
      )}" />`;
      socialIconsContainer.appendChild(mob);
      const mobImg = mob.querySelector("img");

      if (isLogged) {
        const dropdownMobileId = "user-dropdown-mobile";
        document.getElementById(dropdownMobileId)?.remove();

        const dropdownMobile = document.createElement("div");
        dropdownMobile.className = "dropdown-menu mobile";
        dropdownMobile.id = dropdownMobileId;
        dropdownMobile.innerHTML = `
          <ul>
            <li>
              <img src="${asset(
                "/user/userMenu/homebtn.png"
              )}" alt="" aria-hidden="true" />
              Ir a Home
            </li>
            <li id="logout-btn-mobile">
              <img src="${asset(
                "/user/userMenu/logoutbtn.png"
              )}" alt="" aria-hidden="true" />
              Logout
            </li>
          </ul>`;
        document.body.appendChild(dropdownMobile);

        const reposition = () => {
          const rect = mob.getBoundingClientRect();
          dropdownMobile.style.top = `${rect.bottom + window.scrollY}px`;
          const left = Math.max(
            8,
            rect.right - (dropdownMobile.offsetWidth || 180)
          );
          dropdownMobile.style.left = `${left + window.scrollX}px`;
        };

        mobImg?.addEventListener("click", (e) => {
          e.stopPropagation();
          const willOpen = !dropdownMobile.classList.contains("active");
          if (willOpen) reposition();
          dropdownMobile.classList.toggle("active", willOpen);
        });

        document.addEventListener("click", () =>
          dropdownMobile.classList.remove("active")
        );
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") dropdownMobile.classList.remove("active");
        });
        const onRepositionIfOpen = () => {
          if (dropdownMobile.classList.contains("active")) reposition();
        };
        window.addEventListener("resize", onRepositionIfOpen, {
          passive: true,
        });
        window.addEventListener("scroll", onRepositionIfOpen, {
          passive: true,
        });

        dropdownMobile
          .querySelector("li:first-child")
          ?.addEventListener("click", (e) => {
            e.stopPropagation();
            window.location.href = routeAppHome;
          });
        dropdownMobile
          .querySelector("#logout-btn-mobile")
          ?.addEventListener("click", () => {
            clearIxSession();
            sessionStorage.removeItem("bienvenidaMostrada");
            window.location.href = routeLogin;
          });

        setAvatarSrc(mobImg, session);
      } else {
        mob.addEventListener(
          "click",
          () => (window.location.href = routeLogin)
        );
      }
    }
  });

  /* ===================== SUBNAV + REDES ===================== */
  document.addEventListener("DOMContentLoaded", () => {
    const header = document.getElementById("header");
    if (!header) return;
    if (header.dataset.subnavInit === "1") return;
    header.dataset.subnavInit = "1";

    const nav = header.querySelector(".subnav");

    const socialMap = Object.assign({}, CFG.SOCIAL, window.NAV_SOCIAL || {});
    const attachSocialClicks = (root) => {
      if (!root) return;
      root.querySelectorAll(".icon-mobile, .circle-icon").forEach((el) => {
        if (el.dataset.socialBound === "1") return;
        const img = el.querySelector("img") || el;
        const key = (img.alt || "").trim().toLowerCase();
        const url = socialMap[key];
        if (!url) return;

        el.style.cursor = "pointer";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          window.open(url, "_blank", "noopener");
        });

        if (!/^(a|button)$/i.test(el.tagName)) {
          el.tabIndex = 0;
          el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              window.open(url, "_blank", "noopener");
            }
          });
        }

        el.dataset.socialBound = "1";
      });
    };

    attachSocialClicks(nav);
    attachSocialClicks(header.querySelector(".social-bar-mobile"));

    // Logo → Home público
    const logoBtn = document.getElementById("logo-btn");
    if (logoBtn) {
      logoBtn.style.cursor = "pointer";
      const goPublicHome = () => (window.location.href = routePublicHome);
      logoBtn.addEventListener("click", goPublicHome);
      logoBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goPublicHome();
        }
      });
    }
  });

  // ------------------------------------- Subnav Operativo — secciones + active + chat
  (function SubnavOperativo() {
    "use strict";

    console.log("[SubnavOps] IIFE init. path:", location.pathname);

    /* ================= Config ================= */
    const CFG = {
      // Rutas para el subnav (orden de render)
      SECTIONS: Object.assign(
        {
          home: {
            label: "Home",
            href: "/VIEWS/home copy.php",
            // Todas estas vistas heredan de home
            matchers: [
              "home.php",
              "home copy.php",
              "requerimiento.php",
              "Tareas.php",
              /^\/VIEWS\/requerimiento\/\d+$/i,
            ],
          },
          tareas: {
            label: "Tareas",
            href: "/VIEWS/Tareas.php",
            matchers: ["tareas.php"],
          },
          // se pueden añadir mas (sin tocar HTML)
          // reportes: { label:"Reportes", href:"/VIEWS/Reportes.php", matchers:["reportes.php"] },
        },
        window.NAV_SECTIONS || {}
      ),

      SOCIAL: Object.assign(
        {}, // defaults vacíos (rellena si tienes URLs globales)
        (window.GC_CONFIG && window.GC_CONFIG.SOCIAL) || {},
        (window.CFG && window.CFG.SOCIAL) || {}
      ),

      CHAT: {
        enabled: true,
        url: "/VIEWS/whats_asesores.php",
        allowedEmpIds: Array.isArray(window.NAV_CHAT_ALLOWED)
          ? window.NAV_CHAT_ALLOWED.slice()
          : [6, 5, 4, 2, 1, 15], // ← whitelist por defecto
        cookieName: "ix_emp",
      },
    };

    /* ================= Utils ================= */
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    const normPath = (u) => {
      try {
        const url = new URL(u, location.origin);
        return decodeURIComponent(
          url.pathname.toLowerCase().replace(/\/+$/, "")
        );
      } catch {
        return "";
      }
    };
    const curPath = () => normPath(location.pathname);
    const curLast = () =>
      decodeURIComponent((curPath().split("/").pop() || "").toLowerCase());

    function matchOne(m) {
      // m puede ser string (último segmento) o RegExp (contra pathname completo)
      if (typeof m === "string") return curLast() === m.toLowerCase();
      if (m instanceof RegExp) return m.test(curPath());
      return false;
    }

    function resolveActiveSectionKey() {
      // 1) Emparejar por matchers (incluye hijas)
      for (const [key, sec] of Object.entries(CFG.SECTIONS)) {
        if ((sec.matchers || []).some(matchOne)) return key;
      }
      // 2) Fallback por href (último segmento)
      for (const [key, sec] of Object.entries(CFG.SECTIONS)) {
        const last = decodeURIComponent(
          (normPath(sec.href).split("/").pop() || "").toLowerCase()
        );
        if (curLast() === last) return key;
      }
      // 3) Fallback por path exacto
      for (const [key, sec] of Object.entries(CFG.SECTIONS)) {
        if (normPath(sec.href) === curPath()) return key;
      }
      return null;
    }

    function readIxSession(cookieName) {
      try {
        const m = document.cookie
          .split("; ")
          .find((c) => c.startsWith(cookieName + "="));
        if (!m) return null;
        const raw = decodeURIComponent(m.split("=")[1] || "");
        return JSON.parse(decodeURIComponent(escape(atob(raw))));
      } catch {
        return null;
      }
    }

    /* ================= Social ================= */
    function getSocialMarkup(nav) {
      const existing = nav.querySelector(".social-icons");
      if (existing) return existing.outerHTML;
      return `
      <div class="social-icons">
        <div class="circle-icon"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
        <div class="circle-icon"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
        <div class="circle-icon"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
        <div class="circle-icon"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>
      </div>`;
    }

    function bindSocialClicks(root) {
      const socialMap = CFG.SOCIAL || {};
      root.querySelectorAll(".icon-mobile, .circle-icon").forEach((el) => {
        if (el.dataset.socialBound === "1") return;
        const img = el.querySelector("img") || el;
        const key = (img.alt || "").trim().toLowerCase();
        const url = socialMap[key];
        if (!url) return;

        el.style.cursor = "pointer";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          window.open(url, "_blank", "noopener");
        });
        if (!/^(a|button)$/i.test(el.tagName)) {
          el.tabIndex = 0;
          el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              window.open(url, "_blank", "noopener");
            }
          });
        }
        el.dataset.socialBound = "1";
      });
    }

    function ensureNavLeftHosts() {
      document.querySelectorAll("#mobile-menu").forEach((menu) => {
        if (!menu.querySelector(".nav-left")) {
          const div = document.createElement("div");
          div.className = "nav-left";
          menu.insertBefore(div, menu.firstChild || null);
        }
      });
    }

    function maybeAddChatLink() {
      // Log de entrada
      console.log("[ChatLink] maybeAddChatLink() → start");

      // 1) Revisar config básica
      if (!CFG.CHAT.enabled || !CFG.CHAT.url) {
        console.log("[ChatLink] CHAT deshabilitado o sin URL", {
          enabled: CFG.CHAT.enabled,
          url: CFG.CHAT.url,
        });
        return;
      }
      console.log("[ChatLink] CHAT habilitado con URL:", CFG.CHAT.url);

      // 2) Leer sesión desde cookie
      const sess = readIxSession(CFG.CHAT.cookieName);
      console.log(
        "[ChatLink] Sesión leída desde cookie",
        CFG.CHAT.cookieName,
        sess
      );

      const empIdRaw = sess?.empleado_id ?? sess?.id_empleado;
      const empId = Number(empIdRaw ?? NaN);
      console.log("[ChatLink] empIdRaw:", empIdRaw, "→ empId (Number):", empId);

      // 3) Validar que el ID sea numérico
      if (!Number.isFinite(empId)) {
        console.log("[ChatLink] empId no válido, NO es candidato a ver Chat.");
        return;
      }

      // 4) Ver si está en la lista de permitidos
      const isAllowed = CFG.CHAT.allowedEmpIds.includes(empId);
      console.log("[ChatLink] ¿empId permitido?", {
        empId,
        allowedEmpIds: CFG.CHAT.allowedEmpIds,
        isAllowed,
      });

      if (!isAllowed) {
        console.log(
          "[ChatLink] empId no está en allowedEmpIds, NO se agrega link de Chat."
        );
        return;
      }

      // 5) Ya es candidato → procedemos a insertar el link
      console.log(
        "[ChatLink] empId ES candidato, se intentará agregar link de Chat."
      );
      ensureNavLeftHosts();

      const navs = document.querySelectorAll(
        "#mobile-menu .nav-left, .subnav .nav-left"
      );
      console.log("[ChatLink] NavLeft hosts encontrados:", navs.length);

      navs.forEach((navLeft) => {
        if (!navLeft) return;

        const already = navLeft.querySelector("#link-chat");
        if (already) {
          console.log(
            "[ChatLink] Ya existe #link-chat en este nav, se omite.",
            navLeft
          );
          return;
        }

        const a = document.createElement("a");
        a.id = "link-chat";
        a.href = CFG.CHAT.url;
        a.textContent = "Chat";
        a.target = "_blank";
        a.rel = "noopener";

        navLeft.appendChild(a);
        console.log("[ChatLink] Link de Chat agregado en navLeft:", navLeft);
      });

      console.log("[ChatLink] maybeAddChatLink() → end");
    }

    /* ================= Render ================= */
    function mkLink(label, href, isActive) {
      return `<a href="${href}" class="${
        isActive ? "active" : ""
      }">${label}</a>`;
    }

    function mirrorActiveToMobile() {
      const activeHref = document
        .querySelector(".subnav .nav-left a.active")
        ?.getAttribute("href");
      if (!activeHref) return;
      const target = normPath(activeHref);
      document.querySelectorAll("#mobile-menu a").forEach((a) => {
        a.classList.toggle(
          "active",
          normPath(a.getAttribute("href") || "") === target
        );
      });
    }

    function ensureLogoNavigates() {
      const logoBtn = document.getElementById("logo-btn");
      if (!logoBtn || logoBtn.dataset.logoBound === "1") return;
      logoBtn.style.cursor = "pointer";
      logoBtn.addEventListener("click", () => {
        const to = window.NAV_HOME_LINK || "/index.php";
        window.location.href = to;
      });
      logoBtn.dataset.logoBound = "1";
    }

    function renderOperative(nav) {
      const activeKey = resolveActiveSectionKey();
      const left = Object.entries(CFG.SECTIONS)
        .map(([key, sec]) => mkLink(sec.label, sec.href, key === activeKey))
        .join("");

      nav.innerHTML = `<div class="nav-left">${left}</div>${getSocialMarkup(
        nav
      )}`;

      bindSocialClicks(nav);
      ensureLogoNavigates();
      maybeAddChatLink();
      mirrorActiveToMobile();
    }

    function restoreOriginal(nav) {
      if (nav.dataset.originalHtml) nav.innerHTML = nav.dataset.originalHtml;
      bindSocialClicks(nav);
      ensureLogoNavigates();
      mirrorActiveToMobile();
    }

    /* ================= Mount ================= */
    const header = document.getElementById("header");
    if (!header) return;

    const subnavs = Array.from(header.querySelectorAll(".subnav"));
    if (!subnavs.length) return;

    // Guarda HTML original (para restaurar si no aplica)
    subnavs.forEach((nav) => {
      if (!nav.dataset.originalHtml) nav.dataset.originalHtml = nav.innerHTML;
    });

    function isOperativeLike() {
      // Considera "operativo" si la sección activa existe (home/tareas/…)
      return !!resolveActiveSectionKey() || /home\.php/i.test(curLast());
    }

    function mount() {
      const operative = isOperativeLike();
      const activeKey = resolveActiveSectionKey();
      console.log("[SubnavOps] mount()", {
        operative,
        activeKey,
        curPath: curPath(),
        curLast: curLast(),
      });

      subnavs.forEach((nav) => {
        if (operative) {
          console.log("[SubnavOps] renderOperative() sobre nav:", nav);
          renderOperative(nav);
        } else {
          console.log("[SubnavOps] restoreOriginal() sobre nav:", nav);
          restoreOriginal(nav);
        }
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount, { once: true });
    } else {
      mount();
    }

    if ("MutationObserver" in window) {
      const obs = new MutationObserver(() => {
        if (isOperativeLike()) {
          try {
            maybeAddChatLink();
            mirrorActiveToMobile();
          } catch {}
        }
      });
      obs.observe(header, { childList: true, subtree: true });
    }

    // API opcional por si necesitas refrescar manualmente
    window.SubnavOps = { refresh: mount };
  })();

  // ------------------------------------- fin subnav operativo
})();
