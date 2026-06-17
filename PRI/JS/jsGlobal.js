(() => {
  "use strict";

  if (window.__priGlobalInit) return;
  window.__priGlobalInit = true;

  const ROUTES = {
    publicHome: "/PRI/index.php",
    appHome: "/PRI/Views/home.php",
    login: "/PRI/Views/login.php",
  };

  const ASSETS = {
    defaultAvatar: "/ASSETS/user/img_user1.png",
    avatarBase: "/ASSETS/user/userImgs",
    dropdownHome: "/ASSETS/user/userMenu/homebtn.png",
    dropdownLogout: "/ASSETS/user/userMenu/logoutbtn.png",
  };

  const SOCIAL = {
    facebook: "https://www.facebook.com/GobIxtlahuacanMembrillos/",
    instagram: "https://www.instagram.com/imembrillosgob/",
    youtube:
      "https://www.youtube.com/channel/UC1ZKpGArLJac1ghYW5io5OA/videos",
    x: "https://twitter.com",
  };

  const COOKIE_NAME = "red_user";
  const DEFAULT_AVATAR = ASSETS.defaultAvatar;
  const AVATAR_BASE = ASSETS.avatarBase;

  function withBust(url) {
    try {
      const parsed = new URL(url, window.location.origin);
      parsed.searchParams.set("v", Date.now().toString());
      return `${parsed.pathname}?${parsed.searchParams.toString()}`;
    } catch {
      return `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
    }
  }

  function readSessionCookie() {
    try {
      const encodedName = `${encodeURIComponent(COOKIE_NAME)}=`;
      const pair = document.cookie.split("; ").find((cookie) => {
        return cookie.startsWith(encodedName);
      });

      if (!pair) return null;

      const raw = decodeURIComponent(pair.slice(encodedName.length));
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {
      return null;
    }
  }

  function expireCookie(name) {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; path=/; SameSite=Lax${secure}`;
  }

  function clearSession() {
    expireCookie(COOKIE_NAME);

    try {
      sessionStorage.removeItem("bienvenidaMostrada");
      sessionStorage.removeItem(COOKIE_NAME);
      localStorage.removeItem(COOKIE_NAME);
    } catch { }
  }

  function getSessionData(session) {
    if (!session || typeof session !== "object") return {};
    return session.data && typeof session.data === "object" ? session.data : session;
  }

  function joinName(...parts) {
    return parts
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSessionDisplayName(session) {
    const data = getSessionData(session);
    const rol = data.rol && typeof data.rol === "object" ? data.rol : {};

    const name =
      data.nombre_completo ||
      joinName(data.nombre, data.apellido_paterno, data.apellido_materno) ||
      data.username ||
      "Usuario RED";

    return rol.nombre ? `${name}` : name;
  }

  function getSessionAvatarId(session) {
    const data = getSessionData(session);

    return data.usuario_id != null ? String(data.usuario_id).trim() : "";
  }

  function isSessionLogged(session) {
    const data = getSessionData(session);

    return Boolean(
      data.usuario_id ||
      data.username ||
      data.nombre ||
      data.nombre_completo ||
      data.rol?.rol_id,
    );
  }

  function setImgWithFallback(imgEl, candidates, placeholder = DEFAULT_AVATAR) {
    const queue = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
    let index = 0;

    const tryNext = () => {
      if (index >= queue.length) {
        imgEl.onerror = null;
        imgEl.src = withBust(placeholder);
        return;
      }

      const current = queue[index++];
      imgEl.onerror = tryNext;
      imgEl.onload = () => {
        imgEl.onerror = null;
      };
      imgEl.src = withBust(current);
    };

    tryNext();
  }

  function gcAvatarUrlFor(id) {
    const clean = String(id ?? "").trim();
    if (!clean) return DEFAULT_AVATAR;
    return `${AVATAR_BASE}/img_${clean}.png`;
  }

  function setAvatarSrc(imgEl, session) {
    if (!imgEl) return;

    const id = getSessionAvatarId(session);
    const candidates = id
      ? [
        `${AVATAR_BASE}/img_${id}.png`,
        `${AVATAR_BASE}/img_${id}.jpg`,
        `${AVATAR_BASE}/user_${id}.png`,
        `${AVATAR_BASE}/user_${id}.jpg`,
      ]
      : [DEFAULT_AVATAR];

    setImgWithFallback(imgEl, candidates, DEFAULT_AVATAR);

    const displayName = getSessionDisplayName(session);
    imgEl.alt = displayName;
    imgEl.title = displayName;
    imgEl.loading = "lazy";
  }

  function gcRefreshAvatarEverywhere(_, sessionOverride) {
    const session = sessionOverride || readSessionCookie();

    document.querySelectorAll(".actions .img-perfil").forEach((img) => {
      setAvatarSrc(img, session);
    });

    const mobileImg = document.querySelector(".user-icon-mobile img");
    if (mobileImg) setAvatarSrc(mobileImg, session);
  }

  function gcRefreshHeader(sessionOverride) {
    const session = sessionOverride || readSessionCookie();
    const displayName = getSessionDisplayName(session);

    const desktopWrap = document.querySelector(".actions .user-icon");
    if (desktopWrap) {
      const emailSpan = desktopWrap.querySelector(".user-email");
      const img = desktopWrap.querySelector("img.img-perfil");

      if (emailSpan) emailSpan.textContent = displayName;
      if (img) setAvatarSrc(img, session);
    }

    const mobileImg = document.querySelector(".user-icon-mobile img");
    if (mobileImg) setAvatarSrc(mobileImg, session);

    document.dispatchEvent(
      new CustomEvent("gc:header-refreshed", { detail: { session } }),
    );
  }

  window.gcSetAvatarSrc = setAvatarSrc;
  window.gcAvatarUrlFor = gcAvatarUrlFor;
  window.gcRefreshAvatarEverywhere = gcRefreshAvatarEverywhere;
  window.gcRefreshHeader = gcRefreshHeader;

  document.addEventListener("gc:avatar-updated", () => {
    gcRefreshAvatarEverywhere();
  });

  function applyVH() {
    document.documentElement.style.setProperty(
      "--vh",
      `${window.innerHeight * 0.01}px`,
    );
  }

  window.toggleMenu = function toggleMenu() {
    const menu = document.getElementById("mobile-menu");
    if (!menu) return;

    const burger = document.querySelector(".hamburger");
    const isOpen = menu.classList.toggle("show");

    menu.hidden = !isOpen;
    if (burger) burger.setAttribute("aria-expanded", String(isOpen));
  };

  function bindSocialClicks(root) {
    if (!root) return;

    root.querySelectorAll(".icon-mobile, .circle-icon").forEach((element) => {
      if (element.__priSocialBound) return;

      const img = element.querySelector("img") || element;
      let key = String(img.alt || "").trim().toLowerCase().replace(/\s+/g, "");

      if (key === "twitter") key = "x";
      if (key === "yt") key = "youtube";

      const url = SOCIAL[key];
      if (!url) return;

      element.style.cursor = "pointer";
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        window.open(url, "_blank", "noopener");
      });

      if (!/^(a|button)$/i.test(element.tagName)) {
        element.tabIndex = 0;
        element.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          window.open(url, "_blank", "noopener");
        });
      }

      element.__priSocialBound = true;
    });
  }

  function buildDesktopUserMenu(session) {
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
          <li id="header-home-btn" role="menuitem" tabindex="-1">
            <img src="${ASSETS.dropdownHome}" alt="" aria-hidden="true" />
            Ir a Home
          </li>
          <li id="header-logout-btn" role="menuitem" tabindex="-1">
            <img src="${ASSETS.dropdownLogout}" alt="" aria-hidden="true" />
            Cerrar sesión
          </li>
        </ul>
      </div>
    `;

    const emailSpan = wrap.querySelector(".user-email");
    if (emailSpan) emailSpan.textContent = getSessionDisplayName(session);

    const img = wrap.querySelector(".img-perfil");
    if (img) setAvatarSrc(img, session);

    const dropdown = wrap.querySelector("#user-dropdown");

    const open = (flag) => {
      dropdown.classList.toggle("active", flag);
      dropdown.setAttribute("aria-hidden", String(!flag));
      wrap.setAttribute("aria-expanded", String(flag));
    };

    const toggle = (event) => {
      event?.stopPropagation();
      open(!dropdown.classList.contains("active"));
    };

    wrap.addEventListener("click", toggle);
    wrap.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle(event);
      }

      if (event.key === "Escape") open(false);
    });

    document.addEventListener("click", () => open(false));

    wrap.querySelector("#header-home-btn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      window.location.href = ROUTES.appHome;
    });

    wrap.querySelector("#header-logout-btn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      clearSession();
      window.location.href = ROUTES.login;
    });

    return wrap;
  }

  function mountHeaderSessionUI() {
    const session = readSessionCookie();
    const isLogged = isSessionLogged(session);
    const actions = document.querySelector(".actions");

    if (actions) {
      actions.querySelector(".user-icon")?.remove();

      if (isLogged) {
        actions.appendChild(buildDesktopUserMenu(session));
        actions.classList.add("mostrar");

        try {
          if (!sessionStorage.getItem("bienvenidaMostrada")) {
            window.gcToast?.(`Bienvenido, ${getSessionDisplayName(session)}`, "exito");
            sessionStorage.setItem("bienvenidaMostrada", "true");
          }
        } catch { }
      } else {
        actions.classList.remove("mostrar");
      }
    }

    const mobileWrap = document.querySelector(".user-icon-mobile");
    const mobileImg = mobileWrap?.querySelector("img");

    if (mobileImg) {
      if (isLogged) {
        setAvatarSrc(mobileImg, session);
        mobileWrap.style.cursor = "pointer";
        mobileWrap.onclick = () => {
          window.location.href = ROUTES.appHome;
        };
      } else {
        mobileImg.src = withBust(DEFAULT_AVATAR);
        mobileWrap.style.cursor = "pointer";
        mobileWrap.onclick = () => {
          window.location.href = ROUTES.login;
        };
      }
    }
  }

  function bindHeaderHome() {
    const logoBtn = document.getElementById("logo-btn");
    if (!logoBtn || logoBtn.dataset.logoBound === "1") return;

    logoBtn.style.cursor = "pointer";
    logoBtn.addEventListener("click", () => {
      window.location.href = ROUTES.publicHome;
    });
    logoBtn.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      window.location.href = ROUTES.publicHome;
    });

    logoBtn.dataset.logoBound = "1";
  }

  function normalizeSubnavForPri() {
    const nav = document.getElementById("mobile-menu");
    if (!nav) return;

    const navLeft = nav.querySelector(".nav-left");
    if (!navLeft) return;

    const currentPath = location.pathname.toLowerCase();
    const isLogin = currentPath.endsWith("/pri/views/login.php");

    navLeft.innerHTML = isLogin
      ? `<a href="${ROUTES.publicHome}" class="active">Inicio</a>`
      : `<a href="${ROUTES.appHome}" class="active">Home</a>`;
  }

  applyVH();
  window.addEventListener("resize", applyVH);

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".animado").forEach((element) => {
      element.classList.add("visible");
    });

    const header = document.getElementById("header");
    if (header) {
      const onScroll = () => {
        if (window.scrollY > 50) header.classList.add("scrolled");
        else header.classList.remove("scrolled");
      };

      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    bindHeaderHome();
    normalizeSubnavForPri();
    mountHeaderSessionUI();
    bindSocialClicks(document.getElementById("header"));
    bindSocialClicks(document.querySelector(".social-bar-mobile"));
  });
})();
