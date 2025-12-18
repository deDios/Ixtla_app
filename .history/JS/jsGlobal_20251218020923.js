// JS Global (Ixtla App) — versión consolidada y segura para todas las views
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
      appHome: "/VIEWS/home.php",
      login: "/VIEWS/login.php",
    },
    ASSETS: {
      DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
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

  const CFG = (function merge(base) {
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
  })(GC_DEFAULT_CONFIG);

  /* ===================== HELPERS PATHS ===================== */
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
  const routeLogin = CFG.ROUTES?.login ? abs(CFG.ROUTES.login) : view("login.php");

  const DEFAULT_AVATAR = abs(
    CFG.ASSETS.DEFAULT_AVATAR || "/ASSETS/user/img_user1.png"
  );
  const AVATAR_BASE = abs(CFG.ASSETS.AVATAR_BASE || "/ASSETS/user/userImgs");

  /* ===================== SESIÓN (COOKIE ix_emp) ===================== */
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

  /* ===================== AVATAR HELPERS ===================== */
  function gcAvatarUrlFor(id) {
    if (id == null) return DEFAULT_AVATAR;
    return `${AVATAR_BASE}/img_${id}.png`;
  }

  function setAvatarSrc(imgEl, session) {
    const cookieUrl = session?.avatarUrl || session?.avatar || null;
    const id =
      session?.id_usuario != null ? String(session.id_usuario).trim() : null;

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

  function gcRefreshAvatarEverywhere(url, sessionOverride) {
    const session = sessionOverride || getIxSession();

    document.querySelectorAll(".actions .img-perfil").forEach((img) => {
      if (url) img.src = withBust(url);
      else setAvatarSrc(img, session);
    });

    const mobImg = document.querySelector(".user-icon-mobile img");
    if (mobImg) {
      if (url) mobImg.src = withBust(url);
      else setAvatarSrc(mobImg, session);
    }

    const side = document.getElementById("hs-avatar");
    if (side) {
      if (url) side.src = withBust(url);
      else setAvatarSrc(side, session);
    }
  }

  window.gcSetAvatarSrc = setAvatarSrc;
  window.gcAvatarUrlFor = gcAvatarUrlFor;
  window.gcRefreshAvatarEverywhere = gcRefreshAvatarEverywhere;

  window.gcRefreshHeader = function gcRefreshHeader(sessionOverride) {
    const session = sessionOverride || getIxSession();

    const wrap = document.querySelector(".actions .user-icon");
    if (wrap) {
      const emailSpan = wrap.querySelector(".user-email");
      const img = wrap.querySelector("img.img-perfil");
      if (emailSpan && session?.email) emailSpan.textContent = session.email;
      if (img) setAvatarSrc(img, session);
    }

    const mobImg = document.querySelector(".user-icon-mobile img");
    if (mobImg) setAvatarSrc(mobImg, session);

    document.dispatchEvent(
      new CustomEvent("gc:header-refreshed", { detail: { session } })
    );
  };

  document.addEventListener("gc:avatar-updated", (e) => {
    const url = e?.detail?.url || null;
    gcRefreshAvatarEverywhere(url);
  });

  /* ===================== VH MOBILE ===================== */
  const applyVH = () =>
    document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
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

  /* ===================== TOPBAR (avatar, dropdown, mobile) ===================== */
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
          <span class="user-email"></span>
          <img alt="Perfil" title="Perfil" class="img-perfil" />
          <div class="dropdown-menu" id="user-dropdown" role="menu" aria-hidden="true">
            <ul>
              <li role="menuitem" tabindex="-1">
                <img src="${asset("/user/userMenu/homebtn.png")}" alt="" aria-hidden="true" />
                Ir a Home
              </li>
              <li id="logout-btn" role="menuitem" tabindex="-1">
                <img src="${asset("/user/userMenu/logoutbtn.png")}" alt="" aria-hidden="true" />
                Logout
              </li>
            </ul>
          </div>`;
        actions.appendChild(wrap);
        actions.classList.add("mostrar");

        const emailSpan = wrap.querySelector(".user-email");
        if (emailSpan) emailSpan.textContent = emailShown;

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
            window.gcToast?.(`Bienvenido, ${session.nombre || "usuario"}`, "exito");
          } catch { }
          sessionStorage.setItem("bienvenidaMostrada", "true");
        }
      } else {
        const loginIcon = document.createElement("div");
        loginIcon.className = "user-icon";
        loginIcon.innerHTML = `<img src="${withBust(
          DEFAULT_AVATAR
        )}" alt="Usuario" title="Iniciar sesión" class="img-perfil" />`;
        loginIcon.addEventListener("click", () => (window.location.href = routeLogin));
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
              <img src="${asset("/user/userMenu/homebtn.png")}" alt="" aria-hidden="true" />
              Ir a Home
            </li>
            <li id="logout-btn-mobile">
              <img src="${asset("/user/userMenu/logoutbtn.png")}" alt="" aria-hidden="true" />
              Logout
            </li>
          </ul>`;
        document.body.appendChild(dropdownMobile);

        const reposition = () => {
          const rect = mob.getBoundingClientRect();
          dropdownMobile.style.top = `${rect.bottom + window.scrollY}px`;
          const w = dropdownMobile.offsetWidth || 180;
          const left = Math.max(8, rect.right - w);
          dropdownMobile.style.left = `${left + window.scrollX}px`;
        };

        mobImg?.addEventListener("click", (e) => {
          e.stopPropagation();
          const willOpen = !dropdownMobile.classList.contains("active");
          if (willOpen) {
            dropdownMobile.classList.add("active");
            reposition();
          } else {
            dropdownMobile.classList.remove("active");
          }
        });

        document.addEventListener("click", () => dropdownMobile.classList.remove("active"));
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") dropdownMobile.classList.remove("active");
        });
        const onRepositionIfOpen = () => {
          if (dropdownMobile.classList.contains("active")) reposition();
        };
        window.addEventListener("resize", onRepositionIfOpen, { passive: true });
        window.addEventListener("scroll", onRepositionIfOpen, { passive: true });

        dropdownMobile.querySelector("li:first-child")?.addEventListener("click", (e) => {
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
        mob.addEventListener("click", () => (window.location.href = routeLogin));
      }
    }
  });

  /* ===================== SOCIAL BINDER (GLOBAL) ===================== */
  const DEFAULT_SOCIAL = Object.assign({}, GC_DEFAULT_CONFIG.SOCIAL);

  function getSocialMap() {
    // Prioridad: NAV_SOCIAL (por vista) > GC_CONFIG.SOCIAL > defaults
    return Object.assign(
      {},
      DEFAULT_SOCIAL,
      (window.GC_CONFIG && window.GC_CONFIG.SOCIAL) || {},
      window.NAV_SOCIAL || {}
    );
  }

  // (Operativo) evita overlays: asegura que social-icons sí reciba clicks
  function fixOperativeSocialHitbox(nav) {
    if (!nav) return;
    const left = nav.querySelector(".nav-left");
    const socials = nav.querySelector(".social-icons");
    if (!socials) return;

    socials.style.position = socials.style.position || "relative";
    socials.style.zIndex = "50";
    socials.style.pointerEvents = "auto";

    socials.querySelectorAll(".circle-icon, .icon-mobile, img").forEach((el) => {
      el.style.pointerEvents = "auto";
    });

    if (left) {
      left.style.position = left.style.position || "relative";
      left.style.zIndex = "1";
    }
  }

  function attachSocialClicks(root) {
    if (!root) return;
    const socialMap = getSocialMap();

    root.querySelectorAll(".icon-mobile, .circle-icon").forEach((el) => {
      // IMPORTANTÍSIMO:
      // NO usar dataset.* como guard, porque en operativas el HTML puede venir "marcado"
      // sin que exista listener real (te pasa ahorita). Usamos una marca runtime.
      if (el.__gcSocialBound) return;

      const img = el.querySelector("img") || el;

      let key = (img.alt || "").trim().toLowerCase();
      key = key.replace(/\s+/g, ""); // por si vienen espacios

      // alias comunes
      if (key === "twitter") key = "x";
      if (key === "yt") key = "youtube";
      if (key === "youtub" || key === "youtubé") key = "youtube";

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

      // Marca runtime (real)
      el.__gcSocialBound = true;
    });
  }

  /* ===================== SUBNAV + REDES (NO depende de data-subnav-init) ===================== */
  document.addEventListener("DOMContentLoaded", () => {
    const header = document.getElementById("header");
    if (!header) return;

    // OJO: NO usar data-subnav-init porque puede venir desde backend.
    if (header.dataset.gcSubnavBound === "1") return;
    header.dataset.gcSubnavBound = "1";

    const nav = header.querySelector(".subnav");

    // Bind socials en subnav y barra móvil
    attachSocialClicks(nav);
    attachSocialClicks(header.querySelector(".social-bar-mobile"));

    // Logo → Home público
    const logoBtn = document.getElementById("logo-btn");
    if (logoBtn && logoBtn.dataset.logoBound !== "1") {
      logoBtn.style.cursor = "pointer";
      const goPublicHome = () => (window.location.href = routePublicHome);
      logoBtn.addEventListener("click", goPublicHome);
      logoBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goPublicHome();
        }
      });
      logoBtn.dataset.logoBound = "1";
    }
  });

  /* ===================== SUBNAV OPERATIVO (render + active + chat) ===================== */
  (function SubnavOperativo() {
    "use strict";

    const CFG_OPS = {
      SECTIONS: Object.assign(
        {
          home: {
            label: "Home",
            href: "/VIEWS/home.php",
            matchers: ["home.php", "requerimiento.php", /^\/VIEWS\/requerimiento\/\d+$/i],
          },
          tareas: {
            label: "Tareas",
            href: "/VIEWS/Tareas.php",
            matchers: ["tareas.php"],
          },
        },
        window.NAV_SECTIONS || {}
      ),
      CHAT: {
        enabled: true,
        url: "/VIEWS/whats_asesores.php",
        allowedEmpIds: Array.isArray(window.NAV_CHAT_ALLOWED)
          ? window.NAV_CHAT_ALLOWED.slice()
          : [6, 5, 4, 2, 1, 15],
        cookieName: "ix_emp",
      },
    };

    const normPath = (u) => {
      try {
        const url = new URL(u, location.origin);
        return decodeURIComponent(url.pathname.toLowerCase().replace(/\/+$/, ""));
      } catch {
        return "";
      }
    };
    const curPath = () => normPath(location.pathname);
    const curLast = () =>
      decodeURIComponent((curPath().split("/").pop() || "").toLowerCase());

    function matchOne(m) {
      if (typeof m === "string") return curLast() === m.toLowerCase();
      if (m instanceof RegExp) return m.test(curPath());
      return false;
    }

    function resolveActiveSectionKey() {
      for (const [key, sec] of Object.entries(CFG_OPS.SECTIONS)) {
        if ((sec.matchers || []).some(matchOne)) return key;
      }
      for (const [key, sec] of Object.entries(CFG_OPS.SECTIONS)) {
        const last = decodeURIComponent((normPath(sec.href).split("/").pop() || "").toLowerCase());
        if (curLast() === last) return key;
      }
      for (const [key, sec] of Object.entries(CFG_OPS.SECTIONS)) {
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
      if (!CFG_OPS.CHAT.enabled || !CFG_OPS.CHAT.url) return;

      const sess = readIxSession(CFG_OPS.CHAT.cookieName);
      const empIdRaw = sess?.empleado_id ?? sess?.id_empleado;
      const empId = Number(empIdRaw ?? NaN);
      if (!Number.isFinite(empId)) return;

      const isAllowed = CFG_OPS.CHAT.allowedEmpIds.includes(empId);
      if (!isAllowed) return;

      ensureNavLeftHosts();
      const navs = document.querySelectorAll("#mobile-menu .nav-left, .subnav .nav-left");

      navs.forEach((navLeft) => {
        if (!navLeft) return;
        if (navLeft.querySelector("#link-chat")) return;

        const a = document.createElement("a");
        a.id = "link-chat";
        a.href = CFG_OPS.CHAT.url;
        a.textContent = "Chat";
        a.target = "_blank";
        a.rel = "noopener";
        navLeft.appendChild(a);
      });
    }

    function mkLink(label, href, isActive) {
      return `<a href="${href}" class="${isActive ? "active" : ""}">${label}</a>`;
    }

    function mirrorActiveToMobile() {
      const activeHref = document
        .querySelector(".subnav .nav-left a.active")
        ?.getAttribute("href");
      if (!activeHref) return;
      const target = normPath(activeHref);
      document.querySelectorAll("#mobile-menu a").forEach((a) => {
        a.classList.toggle("active", normPath(a.getAttribute("href") || "") === target);
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
      const left = Object.entries(CFG_OPS.SECTIONS)
        .map(([key, sec]) => mkLink(sec.label, sec.href, key === activeKey))
        .join("");

      nav.innerHTML = `<div class="nav-left">${left}</div>${getSocialMarkup(nav)}`;

      // Asegura que el área de redes no quede tapada por overlay CSS
      fixOperativeSocialHitbox(nav);

      // Bindea clicks (aunque el HTML venga “marcado”)
      attachSocialClicks(nav);

      ensureLogoNavigates();
      maybeAddChatLink();
      mirrorActiveToMobile();
    }

    function restoreOriginal(nav) {
      if (nav.dataset.originalHtml) nav.innerHTML = nav.dataset.originalHtml;

      // Re-bindea socials también al restaurar
      attachSocialClicks(nav);

      ensureLogoNavigates();
      mirrorActiveToMobile();
    }

    const header = document.getElementById("header");
    if (!header) return;

    const subnavs = Array.from(header.querySelectorAll(".subnav"));
    if (!subnavs.length) return;

    subnavs.forEach((nav) => {
      if (!nav.dataset.originalHtml) nav.dataset.originalHtml = nav.innerHTML;
    });

    function isOperativeLike() {
      return !!resolveActiveSectionKey() || /home\.php/i.test(curLast());
    }

    function mount() {
      const operative = isOperativeLike();
      subnavs.forEach((nav) => {
        if (operative) renderOperative(nav);
        else restoreOriginal(nav);
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
            subnavs.forEach((nav) => {
              fixOperativeSocialHitbox(nav);
              attachSocialClicks(nav);
            });
          } catch { }
        }
      });
      obs.observe(header, { childList: true, subtree: true });
    }

    window.SubnavOps = { refresh: mount };
  })();
})();