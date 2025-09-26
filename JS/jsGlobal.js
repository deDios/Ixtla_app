//------------------------------------------------------------ js global -----------------------------------------------------
(() => {
  if (window.__gcGlobalInit) return;
  window.__gcGlobalInit = true;

  // -------------------- helpers de paths --------------------
  const PATHS = window.GC_PATHS || {
    ASSETS: "/ASSETS",
    VIEWS: "/VIEWS",
    ROUTES: { home: "../VIEW/Home.php", login: "/VIEWS/Login.php" },
    DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  };

  const abs = (p) => new URL(p, window.location.origin).pathname;
  const join = (...parts) =>
    parts
      .filter(Boolean)
      .map((s, i) =>
        i === 0 ? s.replace(/\/+$/g, "") : s.replace(/^\/+|\/+$/g, "")
      )
      .join("/")
      .replace(/\/{2,}/g, "/");

  const asset = (sub) => abs(join(PATHS.ASSETS, sub));
  const view = (sub) => abs(join(PATHS.VIEWS, sub));
  const routeHome = PATHS.ROUTES?.home
    ? abs(PATHS.ROUTES.home)
    : view("Home.php");
  const routeLogin = PATHS.ROUTES?.login
    ? abs(PATHS.ROUTES.login)
    : view("Login.php");
  const DEFAULT_AVATAR = abs(
    PATHS.DEFAULT_AVATAR || "/ASSETS/usuario/usuarioImg/img_user1.png"
  );

  // -------------------- funcion para obtener el usuario desde la cookie --------------------
  function getUsuarioFromCookie() {
    try {
      const m = document.cookie.match(/(?:^|;\s*)usuario=([^;]+)/);
      return m ? JSON.parse(decodeURIComponent(m[1])) : null;
    } catch {
      return null;
    }
  }

  function setUsuarioCookie(patch) {
    const prev = getUsuarioFromCookie() || {};
    const next = { ...prev, ...patch };
    document.cookie =
      "usuario=" +
      encodeURIComponent(JSON.stringify(next)) +
      "; path=/; max-age=86400; samesite=lax";
    return next;
  }

  function withBust(url) {
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.set("v", Date.now().toString());
      return u.pathname + "?" + u.searchParams.toString();
    } catch {
      return url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
    }
  }

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
      if (hasExt(b)) {
        queue.push(b);
      } else {
        extOrder.forEach((ext) => queue.push(`${b}.${ext}`));
      }
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

  function setAvatarSrc(imgEl, usuario) {
    const ASSETS_BASE = "/ASSETS/usuario/usuarioImg";
    const DEFAULT_URL = DEFAULT_AVATAR;

    const cookieUrl = usuario?.avatarUrl || usuario?.avatar || null;
    const id = usuario?.id != null ? String(usuario.id).trim() : null;

    const basesSinExt = id
      ? [`${ASSETS_BASE}/user_${id}`, `${ASSETS_BASE}/img_user${id}`]
      : [];

    const primary = cookieUrl
      ? /\.[a-zA-Z0-9]{2,5}(\?|#|$)/.test(cookieUrl)
        ? [cookieUrl]
        : [cookieUrl]
      : [];

    const candidates = [...primary, ...basesSinExt, DEFAULT_URL];

    setImgWithExtFallback(imgEl, candidates, {
      extOrder: ["png", "jpg"], // si luego se necesitan mas formatos se agrega
      placeholder: DEFAULT_URL,
      cacheBust: true,
    });

    imgEl.alt = usuario?.nombre || "Avatar";
    imgEl.loading = "lazy";
  }

  const applyVH = () =>
    document.documentElement.style.setProperty(
      "--vh",
      `${window.innerHeight * 0.01}px`
    );
  applyVH();
  window.addEventListener("resize", applyVH);

  // -------------------- animacion (.animado) (de momento solo hay un tipo de animacion)--------------------
  document.addEventListener("DOMContentLoaded", () => {
    const animados = document.querySelectorAll(".animado");
    if (!animados.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    animados.forEach((el) => io.observe(el));
  });

  // -------------------- menu hamburguesa --------------------
  window.toggleMenu = function toggleMenu() {
    const menu = document.getElementById("mobile-menu");
    if (!menu) return;
    const burger = document.querySelector(".hamburger");
    const isOpen = menu.classList.toggle("show");
    menu.hidden = !isOpen;
    if (burger) burger.setAttribute("aria-expanded", String(isOpen));
  };

  // -------------------- header sticky --------------------
  document.addEventListener("DOMContentLoaded", () => {
    const header = document.getElementById("header");
    if (!header) return;
    const onScroll = () =>
      window.scrollY > 50
        ? header.classList.add("scrolled")
        : header.classList.remove("scrolled");
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  });

  // -------------------- Topbar (avatar, dropdown y mobile icon) --------------------
  document.addEventListener("DOMContentLoaded", () => {
    const usuario = getUsuarioFromCookie();
    const isLogged = !!(usuario?.correo || usuario?.nombre);

    // refs del topbar (version desktop)
    const actions = document.querySelector(".actions");
    if (actions) {
      // limpieza para evitar duplicados
      actions.querySelector(".user-icon")?.remove();

      // boton de registrarse (si hay sesion, se elimina)
      const btnPrimary = actions.querySelector(".btn-primary");
      if (isLogged && btnPrimary) btnPrimary.remove();

      const email = usuario?.correo || "Usuario";

      // Construcción del bloque desktop
      if (isLogged) {
        const wrap = document.createElement("div");
        wrap.className = "user-icon";
        wrap.setAttribute("role", "button");
        wrap.setAttribute("tabindex", "0");
        wrap.setAttribute("aria-haspopup", "true");
        wrap.setAttribute("aria-expanded", "false");
        wrap.innerHTML = `
          <span class="user-email">${email}</span>
          <img alt="Perfil" title="Perfil" class="img-perfil" />
          <div class="dropdown-menu" id="user-dropdown" role="menu" aria-hidden="true">
            <ul>
              <li role="menuitem" tabindex="-1">
                <img src="${asset(
                  "usuario/usuarioSubmenu/homebtn.png"
                )}" alt="" aria-hidden="true" />
                Ir a Home
              </li>
              <li id="logout-btn" role="menuitem" tabindex="-1">
                <img src="${asset(
                  "usuario/usuarioSubmenu/logoutbtn.png"
                )}" alt="" aria-hidden="true" />
                Logout
              </li>
            </ul>
          </div>
        `;
        actions.appendChild(wrap);
        actions.classList.add("mostrar");

        const img = wrap.querySelector("img.img-perfil");
        if (img) setAvatarSrc(img, usuario);

        // dropdown
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

        // acciones del menu
        dd.querySelector("li:nth-child(1)")?.addEventListener("click", () => {
          window.location.href = routeHome;
        });
        dd.querySelector("#logout-btn")?.addEventListener("click", () => {
          document.cookie =
            "usuario=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          sessionStorage.removeItem("bienvenidaMostrada");
          window.location.href = routeLogin;
        });

        // bienvenida (una vez por sesion)
        if (!sessionStorage.getItem("bienvenidaMostrada")) {
          window.gcToast?.(
            `Bienvenido, ${usuario.nombre || "usuario"}`,
            "exito"
          );
          sessionStorage.setItem("bienvenidaMostrada", "true");
        }
      } else {
        // no logueado = un solo icono que redirige a login
        const loginIcon = document.createElement("div");
        loginIcon.className = "user-icon";
        loginIcon.innerHTML = `
          <img src="${withBust(
            DEFAULT_AVATAR
          )}" alt="Usuario" title="Iniciar sesión" class="img-perfil" />
        `;
        loginIcon.addEventListener(
          "click",
          () => (window.location.href = routeLogin)
        );
        actions.appendChild(loginIcon);
        actions.classList.add("mostrar");
      }
    }

    // header mobile
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
                "usuario/usuarioSubmenu/homebtn.png"
              )}" alt="" aria-hidden="true" />
              Ir a Home
            </li>
            <li id="logout-btn-mobile">
              <img src="${asset(
                "usuario/usuarioSubmenu/logoutbtn.png"
              )}" alt="" aria-hidden="true" />
              Logout
            </li>
          </ul>
        `;
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

        // toggle del dropdown
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

        // Reposicionar cuando está abierto
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
            window.location.href = routeHome;
          });

        dropdownMobile
          .querySelector("#logout-btn-mobile")
          ?.addEventListener("click", () => {
            document.cookie =
              "usuario=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            sessionStorage.removeItem("bienvenidaMostrada");
            window.location.href = routeLogin;
          });
      } else {
        // no login = default y un click lleva a Login
        mob.addEventListener(
          "click",
          () => (window.location.href = routeLogin)
        );
      }
    }
  });

  // -------------------- subnav --------------------
  document.addEventListener("DOMContentLoaded", () => {
    const header = document.getElementById("header");
    if (!header) return;

    if (header.dataset.subnavInit === "1") return;
    header.dataset.subnavInit = "1";

    const nav = header.querySelector(".subnav");

    // Helpers locales
    const normalizePath = (u) => {
      try {
        const p = new URL(u, window.location.origin).pathname.toLowerCase();
        return p === "/" ? "/index.php" : p;
      } catch {
        const s = String(u || "").toLowerCase();
        return s === "/" ? "/index.php" : s;
      }
    };

    const homeHref = header.dataset.linkHome || "/index.php";

    // --- links de redes sociales
    const socialDefaults = {
      facebook: "https://www.facebook.com/GobIxtlahuacanMembrillos/",
      instagram: "https://www.instagram.com/imembrillosgob/ ",
      youtube: "https://www.youtube.com/channel/UC1ZKpGArLJac1ghYW5io5OA/videos",
      x: "https://twitter.com",
    };
    const socialMap = Object.assign(
      {},
      socialDefaults,
      window.NAV_SOCIAL || {}
    );

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

    // Enlaza redes en subnav (desktop) y en la barra móvil superior
    attachSocialClicks(nav);
    attachSocialClicks(header.querySelector(".social-bar-mobile"));

    // Logo a Home 
    const logoBtn = document.getElementById("logo-btn");
    if (logoBtn) {
      logoBtn.style.cursor = "pointer";
      const goHome = () => (window.location.href = homeHref);
      logoBtn.addEventListener("click", goHome);
      logoBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goHome();
        }
      });
    }
  }); // -------------------- fin subnav --------------------
})();
