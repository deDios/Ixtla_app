// JS Global (bien estructurado + bloque de configuración)
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
      publicHome: "/index.php", // ← redireccion de a index (logo)
      appHome: "/VIEWS/home.php", // ← Home para usuarios logeados ("Ir a Home")
      login: "/VIEWS/login.php",
    },
    ASSETS: {
      DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
      // Avatares por ID: intentará /ASSETS/usuario/usuarioImg/user_<id>.{png|jpg}
      AVATAR_BASE: "/ASSETS/usuario/usuarioImg",
    },
    SOCIAL: {
      facebook: "https://www.facebook.com/GobIxtlahuacanMembrillos/",
      instagram: "https://www.instagram.com/imembrillosgob/",
      youtube:
        "https://www.youtube.com/channel/UC1ZKpGArLJac1ghYW5io5OA/videos",
      x: "https://twitter.com",
    },
    FLAGS: {
      stickyHeaderOffset: 50, // px para activar header "scrolled"
      animateOnView: true, // aplicar IO a .animado
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
  const AVATAR_BASE = abs(
    CFG.ASSETS.AVATAR_BASE || "/ASSETS/usuario/usuarioImg"
  );

  /* ===================== SESIÓN ===================== */
  // Lee cookie ix_emp (JSON base64)
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
  // Limpia ix_emp + usuario
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

  // Intenta varias rutas/formatos de imagen, con fallback
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
      const finalUrl = cacheBust && isAbsolute(url) ? withBust(url) : url;
      imgEl.src = finalUrl;
    };

    tryNext();
  }

  function setAvatarSrc(imgEl, session) {
    const cookieUrl = session?.avatarUrl || session?.avatar || null;
    const id =
      session?.id_usuario != null ? String(session.id_usuario).trim() : null;
    const basesSinExt = id
      ? [`${AVATAR_BASE}/user_${id}`, `${AVATAR_BASE}/img_user${id}`]
      : [];
    const primary = cookieUrl ? [cookieUrl] : [];
    const candidates = [...primary, ...basesSinExt, DEFAULT_AVATAR];

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

        // Desktop dropdown: “Ir a Home” → /VIEWS/home.php
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
        // No logueado → icono clicable a login
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

        // Mobile dropdown: “Ir a Home” → /VIEWS/home.php
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

    // Enlaza redes en subnav (desktop) y en la barra móvil superior
    const socialMap = Object.assign({}, CFG.SOCIAL, window.NAV_SOCIAL || {});
    const attachSocialClicks = (root) => {
      if (!root) return;
      root.querySelectorAll(".icon-mobile, .circle-icon").forEach((el) => {
        if (el.dataset.socialBound === "1") return;
        const img = el.querySelector("img") || el;
        const key = (img.alt || "").trim().toLowerCase(); // "facebook", "instagram", "youtube", "x"
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

    // Logo → Home público (/index.php)
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

  // ===== Subnav Operativo =====
  (() => {
    const header = document.getElementById("header");
    if (!header) return;
    const nav = header.querySelector(".subnav");
    if (!nav) return;

    if (!nav.dataset.originalHtml) {
      nav.dataset.originalHtml = nav.innerHTML;
    }

    const SUBNAV_OPS = Object.assign(
      {
        detect: {
          byBodyData: true, // <body data-operativa="1">
          byPath: [/\/VIEWS\/home\.php$/i], // rutas operativas (de momento solo home.php)
        },
        items: [
          {
            text: "Home",
            href:
              typeof routeAppHome !== "undefined"
                ? routeAppHome
                : "/VIEWS/home.php",
          },
          { text: "Chat", href: "#" }, // pendiente
        ],
        cta: null, // ej: { text: "Reportar", href: "/VIEWS/tramitar.php", attrs: { "data-cta":"1" } }
      },
      window.SUBNAV_OPS || {}
    );

    const normalize = (p) => {
      try {
        return new URL(p, window.location.origin).pathname.replace(/\/+$/, "");
      } catch {
        return String(p || "")
          .replace(/^[^/]/, "/")
          .replace(/\/+$/, "");
      }
    };

    const isOperationalView = () => {
      if (
        SUBNAV_OPS.detect.byBodyData &&
        document.body?.dataset?.operativa === "1"
      )
        return true;
      const path = window.location.pathname;
      return (SUBNAV_OPS.detect.byPath || []).some((rx) =>
        typeof rx === "string" ? path.endsWith(rx) : rx.test(path)
      );
    };

    const buildOpsHTML = () => {
      const current = normalize(window.location.pathname);
      const listHTML = (SUBNAV_OPS.items || [])
        .map((it) => {
          const href = normalize(it.href || "#");
          const isActive =
            it.href && it.href !== "#" ? current === href : false;
          const activeAttr = isActive ? ' class="active"' : "";
          const attrs = Object.entries(it.attrs || {})
            .map(([k, v]) => `${k}="${String(v)}"`)
            .join(" ");
          return `<li><a href="${it.href || "#"}"${activeAttr}${
            attrs ? " " + attrs : ""
          }>${it.text}</a></li>`;
        })
        .join("");

      const ctaHTML = SUBNAV_OPS.cta
        ? (() => {
            const a = SUBNAV_OPS.cta;
            const attrs = Object.entries(a.attrs || {})
              .map(([k, v]) => `${k}="${String(v)}"`)
              .join(" ");
            return `<a class="btn-cta" href="${a.href}" ${attrs}>${a.text}</a>`;
          })()
        : "";

      return `
      <div class="subnav-inner">
        <ul class="nav-links">${listHTML}</ul>
        <div class="nav-right">${ctaHTML}</div>
      </div>
    `;
    };

    const rebindSocialLinks = (root) => {
      const socialMap = Object.assign(
        {},
        window.GC_CONFIG?.SOCIAL || {},
        window.NAV_SOCIAL || {}
      );
      root?.querySelectorAll(".icon-mobile, .circle-icon").forEach((el) => {
        if (el.dataset.socialBound === "1") return;
        const img = el.querySelector("img") || el;
        const key = (img.alt || "").trim().toLowerCase(); // "facebook" | "instagram" | "youtube" | "x"
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

    const socialOriginal = nav.querySelector(".social-icons");
    const cloneSocial = () =>
      socialOriginal ? socialOriginal.cloneNode(true) : null;

    const makeOperational = () => {
      if (nav.dataset.opsApplied === "1") return;
      nav.innerHTML = buildOpsHTML();
      const socialClone = cloneSocial();
      if (socialClone) nav.appendChild(socialClone);
      nav.dataset.opsApplied = "1";
      nav.setAttribute("role", "navigation");
      rebindSocialLinks(nav);
    };

    const restoreOriginal = () => {
      if (nav.dataset.opsApplied !== "1") return;
      nav.innerHTML = nav.dataset.originalHtml || nav.innerHTML;
      delete nav.dataset.opsApplied;
    };

    // 6) Ejecutar
    if (isOperationalView()) makeOperational();
    else restoreOriginal();
  })();
})();
