// JS\ui\sidebar.js
// ================= Sidebar =================
"use strict";

/* -------------------- Config -------------------- */
const CFG = {
  DEBUG: true,
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  DEPT_API:
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php",
  SEL: {
    // Perfil (OBLIGATORIOS)
    avatar: "#hs-avatar",
    profileName: "#hs-profile-name",
    profileBadge: "#hs-profile-badge",
    profileWrap: ".hs-profile",
    // Modal (opcional)
    modalId: "modal-perfil",
    // Filtros/contadores (OPCIONALES, autodetect)
    statusGroup: "#hs-states",
    statusItems: "#hs-states .item",
    legendStatus: "#hs-legend-status",
    searchInput: "#hs-search",
    cnt: {
      todos: "#cnt-todos",
      solicitud: "#cnt-solicitud",
      revision: "#cnt-revision",
      asignacion: "#cnt-asignacion",
      proceso: "#cnt-proceso",
      pausado: "#cnt-pausado",
      cancelado: "#cnt-cancelado",
      finalizado: "#cnt-finalizado",
    },
  },
};

const log = (...a) => { if (CFG.DEBUG) console.log("[Sidebar]", ...a); };
const warn = (...a) => { if (CFG.DEBUG) console.warn("[Sidebar]", ...a); };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = String(txt ?? ""); };

/* -------------------- Utils -------------------- */
function readCookiePayload() {
  try {
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch { return null; }
}

async function resolveDeptName(deptId, api = CFG.DEPT_API) {
  if (!deptId) return "—";
  try {
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ page: 1, page_size: 200, status: 1 }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const found = (json?.data || []).find((d) => Number(d.id) === Number(deptId));
    return found?.nombre || `Depto ${deptId}`;
  } catch { return `Depto ${deptId}`; }
}

function setAvatarImage(imgEl, sessionLike, defaultAvatar = CFG.DEFAULT_AVATAR) {
  if (!imgEl) return;
  if (window.gcSetAvatarSrc) { window.gcSetAvatarSrc(imgEl, sessionLike); return; }
  const idu = sessionLike?.id_usuario;
  const candidates = sessionLike?.avatarUrl
    ? [sessionLike.avatarUrl]
    : idu
      ? [
          `/ASSETS/user/userImgs/img_${idu}.png`,
          `/ASSETS/user/userImgs/img_${idu}.jpg`,
        ]
      : [];
  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) { imgEl.src = defaultAvatar; return; }
    imgEl.onerror = () => { i++; tryNext(); };
    imgEl.src = `${candidates[i]}?v=${Date.now()}`;
  };
  tryNext();
}

/* -------------------- Botón Editar Perfil -------------------- */
function ensureEditProfileButton({ label = "Administrar perfil ›" } = {}) {
  const section = $(CFG.SEL.profileWrap);
  if (!section) return null;
  if (section.querySelector(".edit-profile")) return section.querySelector(".edit-profile");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gc-btn gc-btn-ghost edit-profile";
  btn.setAttribute("data-open", `#${CFG.SEL.modalId}`);
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-controls", CFG.SEL.modalId);
  btn.textContent = label;

  const badgeEl = $(CFG.SEL.profileBadge, section);
  section.insertBefore(btn, badgeEl || null);
  return btn;
}

/* -------------------- Modal (auto-wire si existe) -------------------- */
function wireProfileModalOpeners() {
  const modal = document.getElementById(CFG.SEL.modalId);
  if (!modal) return; // opcional
  const openers = document.querySelectorAll(`.edit-profile,[data-open="#${CFG.SEL.modalId}"]`);
  const closeBtn = modal.querySelector(".modal-close");
  const content = modal.querySelector(".modal-content");
  const open = () => {
    modal.classList.add("active");
    document.body.classList.add("modal-open");
    const first = modal.querySelector("input,button,select,textarea,[tabindex]:not([tabindex='-1'])");
    first?.focus?.();
  };
  const close = () => {
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  };
  openers.forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); open(); }));
  closeBtn?.addEventListener("click", (e) => { e.preventDefault(); close(); });
  modal.addEventListener("mousedown", (e) => { if (e.target === modal && !content.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("active")) close(); });
}

/* -------------------- Filtros opcionales -------------------- */
const STATUS_LABEL = {
  todos: "Todos los status", solicitud: "Solicitud", revision: "Revisión",
  asignacion: "Asignación", proceso: "En proceso", pausado: "Pausado",
  cancelado: "Cancelado", finalizado: "Finalizado",
};
function normalizeStatusKey(k) {
  if (!k) return "";
  let s = String(k).toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_-]+/g, "");
  if (s === "enproceso") return "proceso";
  if (s === "revisión" || s === "revision") return "revision";
  if (s === "asignación" || s === "asignacion") return "asignacion";
  return s;
}

const S = {
  filterKey: "todos",
  rbac: { isAdmin: false, isPres: false, isDir: false, soyPL: false, isJefe: false, isAnal: false },
  onChange: null,
  searchTimer: null,
  searchDebounceMs: 250,
  bound: { click: null, keydown: null, input: null },
  sessionProvider: () => (window.Session?.get?.() || readCookiePayload() || null),
};

function initOptionalFiltersIfPresent() {
  const group = $(CFG.SEL.statusGroup);
  if (!group) return; // no hay filtros en esta página

  // radiogrupo accesible
  group.setAttribute("role", "radiogroup");
  const items = $$(CFG.SEL.statusItems, group);
  items.forEach((btn, i) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
    btn.setAttribute("aria-checked", btn.classList.contains("is-active") ? "true" : "false");
  });

  // click
  S.bound.click = (ev) => {
    const btn = ev.target.closest(".item");
    if (!btn) return;
    if (btn.getAttribute("aria-disabled") === "true") return;
    setFilter(btn.dataset.status, { fire: true, focusSearch: true });
  };
  group.addEventListener("click", S.bound.click);

  // teclado
  S.bound.keydown = (e) => {
    const items = $$(CFG.SEL.statusItems, group);
    const cur = document.activeElement.closest(".item");
    const idx = Math.max(0, items.indexOf(cur));
    let next = idx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % items.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
    if (next !== idx) { items[next].focus(); e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") {
      if (items[next].getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
      items[next].click(); e.preventDefault();
    }
  };
  group.addEventListener("keydown", S.bound.keydown);

  applyActiveUI(S.filterKey);

  // search opcional
  const input = $(CFG.SEL.searchInput);
  if (input) {
    S.bound.input = (e) => {
      clearTimeout(S.searchTimer);
      const val = (e.target.value || "").trim().toLowerCase();
      S.searchTimer = setTimeout(() => { S.onChange?.({ type: "search", value: val }); }, S.searchDebounceMs);
    };
    input.addEventListener("input", S.bound.input);
  }
}

function applyActiveUI(key) {
  const group = $(CFG.SEL.statusGroup);
  if (!group) return;
  const items = $$(CFG.SEL.statusItems, group);
  items.forEach((b) => {
    const active = b.dataset.status === key;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-checked", active ? "true" : "false");
    b.tabIndex = active ? 0 : -1;
  });
}

function setFilter(key, { fire = false, focusSearch = false } = {}) {
  const k = normalizeStatusKey(key);
  S.filterKey = k || "todos";
  applyActiveUI(S.filterKey);
  updateLegend(S.filterKey);
  if (fire) S.onChange?.({ type: "filter", value: S.filterKey });
  if (focusSearch) $(CFG.SEL.searchInput)?.focus?.();
}

function updateLegend(filterKey) {
  const k = STATUS_LABEL[filterKey] ? filterKey : "todos";
  setText(CFG.SEL.legendStatus, STATUS_LABEL[k] || "Todos los status");
}

function applyRBAC(flags) {
  S.rbac = { ...S.rbac, ...(flags || {}) };
  const { isAdmin, isPres, isDir, soyPL, isJefe, isAnal } = S.rbac;
  const group = $(CFG.SEL.statusGroup);
  if (!group) return;
  const lockSet = new Set(["solicitud", "revision"]);
  const shouldLock = (isDir || soyPL || isJefe || isAnal) && !(isAdmin || isPres);
  $$(CFG.SEL.statusItems, group).forEach((btn) => {
    const key = btn.dataset.status;
    btn.classList.remove("is-locked", "is-hidden");
    btn.removeAttribute("aria-disabled");
    if (shouldLock && lockSet.has(key)) {
      btn.setAttribute("aria-disabled", "true");
      btn.classList.add("is-locked");
      // Si prefieres ocultarlos: btn.classList.add("is-hidden");
    }
  });
}

function updateCounts(map) {
  const m = map || {};
  const wrap = (n) => (n == null ? "" : `(${n})`);
  setText(CFG.SEL.cnt.todos, wrap(m.todos));
  setText(CFG.SEL.cnt.solicitud, wrap(m.solicitud));
  setText(CFG.SEL.cnt.revision, wrap(m.revision));
  setText(CFG.SEL.cnt.asignacion, wrap(m.asignacion));
  setText(CFG.SEL.cnt.proceso, wrap(m.proceso));
  setText(CFG.SEL.cnt.pausado, wrap(m.pausado));
  setText(CFG.SEL.cnt.cancelado, wrap(m.cancelado));
  setText(CFG.SEL.cnt.finalizado, wrap(m.finalizado));
}

function refreshProfile(sess = null) {
  try {
    const s = sess || S.sessionProvider();
    if (!s) return;
    const name = [s.nombre, s.apellidos].filter(Boolean).join(" ").trim();
    if (name) setText(CFG.SEL.profileName, name);
    const avatarEl = $(CFG.SEL.avatar);
    setAvatarImage(avatarEl, {
      id_usuario: s.id_usuario ?? s.usuario_id ?? s.empleado_id ?? s.id_empleado,
      avatarUrl: s.avatarUrl || s.avatar,
      nombre: s.nombre,
      apellidos: s.apellidos,
    });
  } catch (e) { warn("refreshProfile error:", e); }
}

/* -------------------- Boot: SIEMPRE perfil; filtros si existen -------------------- */
async function bootSidebar() {
  // Botón editar (siempre)
  ensureEditProfileButton({});
  // Cablear modal si aparece en la vista
  wireProfileModalOpeners();

  // Sesión (Session.get o cookie)
  const s = (window.Session?.get?.() || readCookiePayload() || null);
  if (!s) { warn("Sin sesión para hidratar perfil (ix_emp)"); return; }

  // Nombre
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(CFG.SEL.profileName, nombre);

  // Depto
  const deptId = s?.departamento_id ?? s?.dept_id ?? null;
  const deptName = await resolveDeptName(deptId, CFG.DEPT_API);
  setText(CFG.SEL.profileBadge, deptName || "—");

  // Avatar
  const avatarEl = $(CFG.SEL.avatar);
  const sessionLike = {
    id_usuario: s.id_usuario ?? s.usuario_id ?? s.empleado_id ?? s.id_empleado,
    avatarUrl: s.avatarUrl || s.avatar,
    nombre: s.nombre,
    apellidos: s.apellidos,
  };
  setAvatarImage(avatarEl, sessionLike);

  log("Perfil OK", { nombre, deptId, deptName, id_usuario: sessionLike.id_usuario });

  // Filtros (solo si están en el DOM)
  initOptionalFiltersIfPresent();
}

/* -------------------- Exponer API (módulo y ventana) -------------------- */
export function IxSidebar_setFilter(k, opts){ setFilter(k, opts); }
export function IxSidebar_getFilter(){ return S.filterKey; }
export function IxSidebar_updateLegend(k){ updateLegend(k); }
export function IxSidebar_applyRBAC(flags){ applyRBAC(flags); }
export function IxSidebar_updateCounts(map){ updateCounts(map); }
export function IxSidebar_refreshProfile(sess){ refreshProfile(sess); }
export function IxSidebar_readCookie(){ return readCookiePayload(); }
export async function IxSidebar_resolveDept(deptId){ return resolveDeptName(deptId); }

window.IxSidebar = {
  setFilter: IxSidebar_setFilter,
  getFilter: IxSidebar_getFilter,
  updateLegend: IxSidebar_updateLegend,
  applyRBAC: IxSidebar_applyRBAC,
  updateCounts: IxSidebar_updateCounts,
  refreshProfile: IxSidebar_refreshProfile,
  readCookie: IxSidebar_readCookie,
  resolveDept: IxSidebar_resolveDept,
};

// Auto-init
window.addEventListener("DOMContentLoaded", bootSidebar);
