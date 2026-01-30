// /JS/home.js
"use strict";

/* ============================================================================
   CONFIGURACIÓN
   ========================================================================== */
const CONFIG = {
  DEBUG_LOGS: true,
  PAGE_SIZE: 7, // ← limitado a 7 por página
  DEFAULT_AVATAR: "/ASSETS/user/img_user1.png",
  ADMIN_ROLES: ["ADMIN"],
  PRESIDENCIA_DEPT_IDS: [6], // ids que ven TODO
  DEPT_FALLBACK_NAMES: { 6: "Presidencia" },

  STATUS_KEY_BY_CODE: {
    0: "solicitud",
    1: "revision",
    2: "asignacion",
    3: "proceso",
    4: "pausado",
    5: "cancelado",
    6: "finalizado",
  },
};

const TAG = "[Home]";
const log = (...a) => {
  if (CONFIG.DEBUG_LOGS) console.log(TAG, ...a);
};
const warn = (...a) => {
  if (CONFIG.DEBUG_LOGS) console.warn(TAG, ...a);
};
const err = (...a) => console.error(TAG, ...a);

/* ============================================================================
   IMPORTS
   ========================================================================== */
import { Session } from "/JS/auth/session.js";
import {
  planScope,
  listByAsignado,
  parseReq,
  hydrateAsignadoFields, // importante
} from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";

/* === API de usuarios (empleados) === */
import { getEmpleadoById, updateEmpleado } from "/JS/api/usuarios.js";

/*-------- export para excel -------*/
//import { initExportCSVHome } from "/JS/ui/exportCSVHome.js";
import { initExportXLSXHome } from "/JS/ui/exportXLSXHome.js";

/* ============================================================================
   SELECTORES
   ========================================================================== */
const SEL = {
  avatar: "#hs-avatar",
  profileName: "#hs-profile-name",
  profileBadge: "#hs-profile-badge",
  profileSection: ".hs-profile",

  statusGroup: "#hs-states",
  statusItems: "#hs-states .item",

  searchInput: "#hs-search",

  legendTotal: "#hs-legend-total",
  legendStatus: "#hs-legend-status",

  tableWrap: "#hs-table-wrap",
  tableBody: "#hs-table-body",
  pager: "#hs-pager",

  chartYear: "#chart-year",
  chartMonth: "#chart-month",
  donutLegend: "#donut-legend",
};

const SIDEBAR_KEYS = [
  "todos",
  "solicitud",
  "revision",
  "asignacion",
  "proceso",
  "activo",
  "pausado",
  "cancelado",
  "finalizado",
];

/* ============================================================================
   HELPERS
   ========================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const setText = (sel, txt) => {
  const el = $(sel);
  if (el) el.textContent = txt;
};

function isMobileAccordion() {
  return window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
}

function chevronSvg() {
  // SVG sencillo y reconocible
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"></path>
    </svg>
  `;
}

function safeTxt(v, fallback = "—") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function formatFolio(folio, id) {
  if (folio && /^REQ-\d+$/i.test(String(folio).trim()))
    return String(folio).trim();
  const digits = String(folio ?? "").match(/\d+/)?.[0];
  if (digits) return "REQ-" + digits.padStart(11, "0");
  if (id != null) return "REQ-" + String(id).padStart(11, "0");
  return "—";
}

function formatDateMX(v) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return v;
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateMXShort(v) {
  // DD/MM/AA
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  return `${dd}/${mm}/${yy}`;
}

/** Normaliza claves de estatus a las usadas por la UI del sidebar */
function normalizeStatusKey(k) {
  if (!k) return "";
  let s = String(k)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_-]+/g, "");
  if (s === "enproceso") return "proceso";
  if (s === "revisión" || s === "revision") return "revision";
  if (s === "asignación" || s === "asignacion") return "asignacion";
  return s;
}

// === helpers de ordenamiento / normalización de texto y dígitos
function normText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}
function digitsNumber(s) {
  const d =
    String(s || "")
      .match(/\d+/g)
      ?.join("") || "";
  return d ? Number(d) : 0;
}

/* ============================================================================
   PERFIL + botón "Administrar perfil" + Modal
   ========================================================================== */
function ensureEditProfileButton() {
  const section = $(SEL.profileSection);
  if (!section) return;
  if (section.querySelector(".edit-profile")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gc-btn gc-btn-ghost edit-profile";
  btn.setAttribute("data-open", "#modal-perfil");
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-controls", "modal-perfil");
  btn.textContent = "Administrar perfil ›";

  const badgeEl = $(SEL.profileBadge, section);
  section.insertBefore(btn, badgeEl || null);
}

function splitNombreCompleto(full) {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { nombre: "", apellidos: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { nombre: parts[0], apellidos: "" };
  const apellidos = parts.slice(-1).join(" ");
  const nombre = parts.slice(0, -1).join(" ");
  return { nombre, apellidos };
}

function pickReportaField(modalRoot) {
  let inp = modalRoot.querySelector("#perfil-reporta");
  if (inp) return { el: inp, usedFallback: false };

  inp = modalRoot.querySelector("#perfil-nacimiento"); // fallback legacy
  if (inp) {
    try {
      const label = modalRoot.querySelector('label[for="perfil-nacimiento"]');
      if (label) label.childNodes[0].nodeValue = "Reporta a";
      inp.setAttribute("type", "text");
      inp.setAttribute("readonly", "true");
      inp.setAttribute("aria-readonly", "true");
      inp.classList.add("is-readonly");
    } catch {}
    return { el: inp, usedFallback: true };
  }
  return { el: null, usedFallback: false };
}

function initProfileModal() {
  const MODAL_ID = "modal-perfil";
  const modal = document.getElementById(MODAL_ID);
  if (!modal) {
    log("[Modal] #modal-perfil no encontrado (se activará cuando exista).");
    return;
  }

  const openers = document.querySelectorAll(
    '.edit-profile,[data-open="#modal-perfil"]',
  );
  const closeBtn = modal.querySelector(".modal-close");
  const content = modal.querySelector(".modal-content");
  const form = modal.querySelector("#form-perfil");

  // Inputs EDITABLES
  const inpNombre = modal.querySelector("#perfil-nombre");
  const inpApellidos = modal.querySelector("#perfil-apellidos");
  const inpEmail = modal.querySelector("#perfil-email");
  const inpTel = modal.querySelector("#perfil-telefono");
  const inpPass = modal.querySelector("#perfil-password");
  const inpPass2 = modal.querySelector("#perfil-password2");

  // SOLO LECTURA
  const inpDepto = modal.querySelector("#perfil-departamento");
  const inpReporta = modal.querySelector("#perfil-reporta");
  const inpStatus = modal.querySelector("#perfil-status");

  let empleadoActual = null;

  const focusFirst = () => {
    const first = modal.querySelector(
      "input,button,select,textarea,[tabindex]:not([tabindex='-1'])",
    );
    first?.focus();
  };

  const open = async () => {
    modal.classList.add("active");
    document.body.classList.add("modal-open");

    try {
      const empId = State.session.empleado_id;
      if (!empId) {
        warn("[Perfil] Sin empleado_id en sesión");
        return;
      }

      // 1) Traer empleado actual
      empleadoActual = await getEmpleadoById(empId);
      log("[Perfil] empleado actual:", empleadoActual);

      // 2) Prefill (editables)
      if (inpNombre) inpNombre.value = empleadoActual?.nombre || "";
      if (inpApellidos) inpApellidos.value = empleadoActual?.apellidos || "";
      if (inpEmail)
        inpEmail.value = (empleadoActual?.email || "").toLowerCase();
      if (inpTel) inpTel.value = empleadoActual?.telefono || "";
      if (inpPass) inpPass.value = "";
      if (inpPass2) inpPass2.value = "";

      // 3) SOLO LECTURA
      const deptId =
        empleadoActual?.departamento_id ?? State.session.dept_id ?? null;
      if (inpDepto) inpDepto.value = await resolveDeptName(deptId);

      let jefeTxt = "—";
      const reportaId =
        empleadoActual?.cuenta?.reporta_a ?? empleadoActual?.reporta_a ?? null;
      if (reportaId) {
        try {
          const jefe = await getEmpleadoById(reportaId);
          jefeTxt =
            [jefe?.nombre, jefe?.apellidos].filter(Boolean).join(" ") ||
            `Empleado #${reportaId}`;
        } catch (e) {
          warn("[Perfil] No se pudo consultar 'reporta_a':", e);
          jefeTxt = `Empleado #${reportaId}`;
        }
      }
      if (inpReporta) {
        inpReporta.value = jefeTxt;
        inpReporta.readOnly = true;
        inpReporta.setAttribute("aria-readonly", "true");
        inpReporta.classList.add("is-readonly");
      }

      if (inpStatus) {
        const st = Number(empleadoActual?.status);
        inpStatus.value = st === 1 ? "Activo" : "Inactivo";
      }

      focusFirst();
    } catch (e) {
      err("[Modal] error prefill:", e);
    }
  };

  const close = () => {
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  };

  // Abrir/cerrar
  openers.forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    }),
  );
  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });
  modal.addEventListener("mousedown", (e) => {
    if (e.target === modal && !content.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) close();
  });

  // Guardar
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!empleadoActual) return;

    if (inpPass && inpPass2 && inpPass.value !== inpPass2.value) {
      alert("Las contraseñas no coinciden.");
      return;
    }

    const nombre = (inpNombre?.value || "").trim();
    let apellidos = (inpApellidos?.value || "").trim();
    if (!apellidos && nombre.includes(" ")) {
      const parts = nombre.split(/\s+/);
      apellidos = parts.slice(1).join(" ");
    }

    const payload = {
      id: empleadoActual.id,
      nombre,
      apellidos,
      email: (inpEmail?.value || "").trim().toLowerCase(),
      telefono: (inpTel?.value || "").trim(),
      ...(inpPass?.value ? { password: inpPass.value } : {}),
      updated_by: State.session?.empleado_id || null,
    };

    log("[Perfil] updateEmpleado payload:", payload);

    try {
      const result = await updateEmpleado(payload);
      log("[Perfil] actualizado OK:", result);

      const nuevoNombre =
        [payload.nombre, payload.apellidos].filter(Boolean).join(" ") || "—";
      setText(SEL.profileName, nuevoNombre);

      try {
        const cur = Session?.get?.() || {};
        const next = {
          ...cur,
          nombre: payload.nombre || cur.nombre,
          apellidos: payload.apellidos || cur.apellidos,
          email: payload.email || cur.email,
          telefono: payload.telefono || cur.telefono,
          empleado_id: cur.empleado_id ?? State.session.empleado_id,
          departamento_id: cur.departamento_id ?? State.session.dept_id,
          roles: cur.roles ?? State.session.roles,
          id_usuario: cur.id_usuario ?? State.session.id_usuario,
        };
        Session?.set?.(next);
        writeCookiePayload(next);
      } catch (se) {
        warn("[Perfil] No pude persistir Session:", se);
      }

      const sess = Session?.get?.() || null;
      window.gcRefreshHeader?.(sess);
      refreshSidebarFromSession(sess);

      close();
      // Refrescar la página para garantizar que toda la UI tome los cambios
      setTimeout(() => {
        try {
          window.location.reload();
        } catch {}
      }, 120);
    } catch (e2) {
      err("[Perfil] error al actualizar:", e2);
      alert("Error al actualizar perfil. Intenta de nuevo.");
    }
  });
}

/* ============================================================================
   ESTADO
   ========================================================================== */
const State = {
  session: { empleado_id: null, dept_id: null, roles: [], id_usuario: null },
  rbac: {
    isAdmin: false,
    isPres: false,
    isDir: false,
    soyPL: false,
    isJefe: false,
    isAnal: false,
  },
  scopePlan: null,
  universe: [],
  rows: [],
  filterKey: "todos",
  search: "",
  counts: {
    todos: 0,
    pendientes: 0,
    en_proceso: 0,
    terminados: 0,
    cancelados: 0,
    pausados: 0,
  },
  table: null,
  __page: 1,
  __lastTotal: 0, // ← total para el pager
  // Accordion table (mobile)
  __expandedRowId: null, // guarda el id del requerimiento expandido
  __expandedWasOpen: false, // (opcional) por si luego quieres recordar toggle
};

let Charts = { line: null, donut: null };

/* ============================================================================
   COOKIE FALLBACK
   ========================================================================== */
function readCookiePayload() {
  try {
    const name = "ix_emp=";
    const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(name.length));
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    return null;
  }
}

function writeCookiePayload(obj, { maxAgeDays = 30 } = {}) {
  try {
    const json = JSON.stringify(obj || {});
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const maxAge = Math.max(1, Math.floor(maxAgeDays * 86400));
    document.cookie = `ix_emp=${encodeURIComponent(
      b64,
    )}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch (e) {
    console.warn("[Home] No se pudo escribir cookie ix_emp:", e);
  }
}

/* ============================================================================
   RESOLVER NOMBRE DE DEPTO
   ========================================================================== */
async function resolveDeptName(deptId) {
  if (!deptId) return "—";
  if (CONFIG.DEPT_FALLBACK_NAMES[deptId])
    return CONFIG.DEPT_FALLBACK_NAMES[deptId];
  try {
    const url =
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ page: 1, page_size: 200, status: 1 }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const arr = json?.data || [];
    const found = arr.find((d) => Number(d.id) === Number(deptId));
    return found?.nombre || `Depto ${deptId}`;
  } catch {
    return `Depto ${deptId}`;
  }
}

async function isPrimeraLinea(viewerId, deptId) {
  try {
    const url =
      "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_departamento.php";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const arr = json?.data || [];
    const dep = arr.find((d) => Number(d.id) === Number(deptId));
    return !!(dep && Number(dep.primera_linea) === Number(viewerId));
  } catch {
    return false;
  }
}

/* ============================================================================
   SESIÓN
   ========================================================================== */
function readSession() {
  let s = null;
  try {
    s = Session?.get?.() || null;
  } catch {}
  if (!s) s = readCookiePayload();

  if (!s) {
    warn("Sin sesión.");
    State.session = {
      empleado_id: null,
      dept_id: null,
      roles: [],
      id_usuario: null,
    };
    return State.session;
  }
  const empleado_id = s?.empleado_id ?? s?.id_empleado ?? null;
  const dept_id = s?.departamento_id ?? null;
  const roles = Array.isArray(s?.roles)
    ? s.roles.map((r) => String(r).toUpperCase())
    : [];
  const id_usuario = s?.id_usuario ?? s?.cuenta_id ?? null;

  log("sesión detectada", { empleado_id, dept_id, roles });
  State.session = { empleado_id, dept_id, roles, id_usuario };
  return State.session;
}

/* ============================================================================
   PERFIL UI
   ========================================================================== */
async function hydrateProfileFromSession() {
  const s = Session?.get?.() || readCookiePayload() || {};
  const nombre = [s?.nombre, s?.apellidos].filter(Boolean).join(" ") || "—";
  setText(SEL.profileName, nombre);

  const badge = $(SEL.profileBadge);
  if (badge) {
    const deptName = await resolveDeptName(State.session.dept_id);
    badge.textContent = deptName || "—";
  }

  const img = $(SEL.avatar);
  if (img) {
    const sessionLike = {
      id_usuario:
        State.session.id_usuario ??
        s.id_usuario ??
        s.usuario_id ??
        s.id_empleado,
      avatarUrl: s.avatarUrl || s.avatar,
      nombre: s.nombre,
      apellidos: s.apellidos,
    };
    if (window.gcSetAvatarSrc) {
      window.gcSetAvatarSrc(img, sessionLike);
    } else {
      const idu = sessionLike.id_usuario;
      const candidates = idu
        ? [
            `/ASSETS/user/userImgs/img_${idu}.png`,
            `/ASSETS/user/userImgs/img_${idu}.jpg`,
          ]
        : [];
      let i = 0;
      const tryNext = () => {
        if (i >= candidates.length) {
          img.src = CONFIG.DEFAULT_AVATAR;
          return;
        }
        img.onerror = () => {
          i++;
          tryNext();
        };
        img.src = `${candidates[i]}?v=${Date.now()}`;
      };
      tryNext();
    }
  }
}

/* ============================================================================
   SIDEBAR
   ========================================================================== */
function applySidebarVisibilityByRole() {
  const { isAdmin, isPres, isDir, soyPL, isJefe, isAnal } = State.rbac;
  const group = $(SEL.statusGroup);
  if (!group) return;

  const lockSet = new Set(["solicitud", "revision"]);
  const shouldLock =
    (isDir || soyPL || isJefe || isAnal) && !(isAdmin || isPres);

  $$(SEL.statusItems, group).forEach((btn) => {
    const key = btn.dataset.status;
    btn.removeAttribute("aria-disabled");
    btn.classList.remove("is-locked", "is-hidden");

    if (shouldLock && lockSet.has(key)) {
      btn.setAttribute("aria-disabled", "true");
      btn.classList.add("is-locked");
      // Si prefieres ocultarlos en lugar de bloquear:
      // btn.classList.add("is-hidden");
    }
  });
}

function initSidebar(onChange) {
  const group = $(SEL.statusGroup);
  if (!group) return;

  group.setAttribute("role", "radiogroup");
  const items = $$(SEL.statusItems);

  items.forEach((btn, i) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
    btn.setAttribute(
      "aria-checked",
      btn.classList.contains("is-active") ? "true" : "false",
    );

    const key = btn.dataset.status;
    if (!SIDEBAR_KEYS.includes(key)) warn("status no válido:", key);

    btn.addEventListener("click", () => {
      // respeta locks RBAC
      if (btn.getAttribute("aria-disabled") === "true") return;

      // reset visual
      items.forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-checked", "false");
        b.tabIndex = -1;
      });

      // activar seleccionado
      btn.classList.add("is-active");
      btn.setAttribute("aria-checked", "true");
      btn.tabIndex = 0;

      // estado
      State.filterKey = key || "todos";
      State.__page = 1;

      updateLegendStatus();
      onChange?.();

      if (!isMobileAccordion()) {
        $(SEL.searchInput)?.focus();
      }
    });
  });

  // navegación por teclado (accesibilidad)
  group.addEventListener("keydown", (e) => {
    const cur = document.activeElement.closest(".item");
    const idx = Math.max(0, items.indexOf(cur));
    let next = idx;

    if (e.key === "ArrowDown" || e.key === "ArrowRight")
      next = (idx + 1) % items.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft")
      next = (idx - 1 + items.length) % items.length;

    if (next !== idx) {
      items[next].focus();
      e.preventDefault();
    }

    if (e.key === " " || e.key === "Enter") {
      if (items[next].getAttribute("aria-disabled") === "true") {
        e.preventDefault();
        return;
      }
      items[next].click();
      e.preventDefault();
    }
  });
}

/* ============================================================================
   SEARCH
   ========================================================================== */
function initSearch(onChange) {
  const input = $(SEL.searchInput);
  if (!input) return;
  let t;
  input.addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      State.search = (e.target.value || "").trim().toLowerCase();
      State.__page = 1;
      onChange?.();
    }, 250);
  });
}


/* ============================================================================
   EXPORT XLSX (dinámico según vista actual)
   - Deshabilita el botón cuando la vista (filtro/búsqueda) tiene 0 requerimientos
   - Cambia el texto a Sin requerimientos
   ========================================================================== */
function updateExportButtonState(totalInView) {
  const btn = document.getElementById("hs-btn-export-req");
  if (!btn) return;

  // Cachea etiqueta original (una sola vez)
  if (!btn.dataset.labelDefault) {
    const sp = btn.querySelector("span");
    btn.dataset.labelDefault = (sp?.textContent || "Exportar requerimientos").trim();
  }

  const has = Number(totalInView || 0) > 0;

  btn.disabled = !has;
  btn.setAttribute("aria-disabled", has ? "false" : "true");

  const sp = btn.querySelector("span");
  if (sp) {
    sp.textContent = has ? btn.dataset.labelDefault : "Sin requerimientos";
  }

  // Tooltip/ayuda (discreta)
  btn.title = has ? "Exportar requerimientos" : "Sin requerimientos para exportar";
}

/* ============================================================================
   TABLA (Folio, Departamento, Tipo de trámite, Asignado, Teléfono, Estatus)
   ========================================================================== */
function buildTable() {
  State.table = createTable({
    bodySel: SEL.tableBody,
    wrapSel: SEL.tableWrap,
    pagSel: null,
    pageSize: CONFIG.PAGE_SIZE,
    columns: [
      // 1) Folio (numérico)
      {
        key: "folio",
        title: "Folio",
        sortable: true,
        accessor: (r) => {
          const m = String(r.folio ?? "").match(/\d+/);
          return m ? Number(m[0]) : Number(r.id || 0);
        },
        render: (v, r) => {
          const fol = (r.folio ?? "").toString().trim();
          if (/^REQ-\d+$/i.test(fol)) return fol;
          const digits = (fol.match(/\d+/) || [String(r.id ?? "")])[0];
          return digits ? "REQ-" + digits.padStart(11, "0") : "—";
        },
      },

      // 2) Departamento (alfabético)
      {
        key: "departamento",
        title: "Departamento",
        sortable: true,
        accessor: (r) =>
          normText(
            r.departamento ||
              r.depto ||
              r.depto_nombre ||
              r.departamento_nombre ||
              r.raw?.departamento?.nombre ||
              "—",
          ),
        render: (v, r) =>
          r.departamento ||
          r.depto ||
          r.depto_nombre ||
          r.departamento_nombre ||
          r.raw?.departamento?.nombre ||
          "—",
      },

      // 3) Tipo de trámite (alfabético)
      {
        key: "tramite",
        title: "Tipo de trámite",
        sortable: true,
        accessor: (r) => normText(r.tramite || r.asunto || "—"),
        render: (v, r) => r.tramite || r.asunto || "—",
      },

      // 4) Asignado (usar solo nombre  sin apellidos  y ordenar alfabético)
      {
        key: "asignado",
        title: "Asignado",
        sortable: true,
        accessor: (r) => r.asignadoNombre || r.asignado || "Sin asignar",
        render: (v, r) => v || r.asignado || "Sin asignar",
      },

      // 5) Teléfono de contacto (numérico por dígitos)
      {
        key: "tel",
        title: "Teléfono",
        sortable: true,
        accessor: (r) => digitsNumber(r.tel),
        render: (v, r) => (r.tel ? r.tel : "—"),
      },

      // 6) Solicitado (fecha created_at → DD/MM/AA)
      {
        key: "solicitado",
        title: "Solicitado",
        sortable: true,
        accessor: (r) => {
          const raw =
            r.creado ||
            r.raw?.created_at ||
            r.created_at ||
            r.fecha_creacion ||
            null;
          const t = raw
            ? Date.parse(String(raw).replace("T", " ").replace(/-/g, "/"))
            : NaN;
          return Number.isFinite(t) ? t : 0;
        },
        render: (v, r) => {
          const raw =
            r.creado ||
            r.raw?.created_at ||
            r.created_at ||
            r.fecha_creacion ||
            null;
          return formatDateMXShort(raw);
        },
      },

      // 7) Estatus (alfabetico por label; badge con data-k normalizado)
      {
        key: "status",
        title: "Estatus",
        sortable: true,
        accessor: (r) => normText(r.estatus?.label || "—"),
        render: (v, r) => {
          const keyNorm = normalizeStatusKey(
            r.estatus?.key || r.estatus?.label || "revision",
          );
          const label = r.estatus?.label || "—";
          return `<span class="badge-status" data-k="${keyNorm}">${label}</span>`;
        },
      },
    ],
  });
  State.table.setPageSize?.(CONFIG.PAGE_SIZE);
  State.table.setSort?.("folio", -1);
}

/* ============================================================================
   LEYENDAS / CONTEOS
   ========================================================================== */
function updateLegendTotals(n) {
  setText(SEL.legendTotal, String(n ?? 0));
}
function updateLegendStatus() {
  const map = {
    todos: "Todos los status",
    activo: "Activo",
    solicitud: "Solicitud",
    revision: "Revisión",
    asignacion: "Asignación",
    proceso: "En proceso",
    pausado: "Pausado",
    cancelado: "Cancelado",
    finalizado: "Finalizado",
  };
  setText(SEL.legendStatus, map[State.filterKey] || "Todos los status");
}

function computeCounts(rows) {
  const c = {
    todos: 0,
    activo: 0,
    solicitud: 0,
    revision: 0,
    asignacion: 0,
    proceso: 0,
    pausado: 0,
    cancelado: 0,
    finalizado: 0,
  };

  rows.forEach((r) => {
    c.todos++;
    const k = normalizeStatusKey(r.estatus?.key || "");

    if (k in c) c[k]++;

    if (k !== "pausado" && k !== "cancelado" && k !== "finalizado") c.activo++;
  });

  State.counts = c;
  setText("#cnt-todos", `(${c.todos})`);
  setText("#cnt-activo", `(${c.activo})`);
  setText("#cnt-solicitud", `(${c.solicitud})`);
  setText("#cnt-revision", `(${c.revision})`);
  setText("#cnt-asignacion", `(${c.asignacion})`);
  setText("#cnt-proceso", `(${c.proceso})`);
  setText("#cnt-pausado", `(${c.pausado})`);
  setText("#cnt-cancelado", `(${c.cancelado})`);
  setText("#cnt-finalizado", `(${c.finalizado})`);

  // Sync del label del combo mobile ("Todos (n)") después de hidratar contadores.
  // En DOMContentLoaded se pinta con (0), pero los counts llegan después del fetch.
  try {
    const active = document.getElementById("hs-filter-active");
    const states = document.getElementById("hs-states");
    if (active && states) {
      const btn =
        states.querySelector(".item.is-active") ||
        states.querySelector(".item[aria-checked='true']");
      if (btn) {
        const label = (
          btn.querySelector(".label")?.textContent || "Todos"
        ).trim();
        const count = (
          btn.querySelector(".count")?.textContent || "(0)"
        ).trim();
        active.textContent = `${label} ${count}`.trim();
      }
    }
  } catch {}
}

/* ============================================================================
   PAGINACIÓN (compacta con elipsis)
   ========================================================================== */
async function loadPageAndRender({ page }) {
  // Mueve solo la página de la tabla + UI del pager
  const total = State.__lastTotal || 0;
  const perPage = CONFIG.PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);

  State.__page = p;
  State.table?.setPage?.(p);
  refreshCurrentPageDecorations();
  renderPagerClassic(total);
}

function renderPagerClassic(total) {
  const cont = $(SEL.pager);
  if (!cont) return;

  const perPage = CONFIG.PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const cur = Math.min(Math.max(1, State.__page || 1), pages);
  const WIN = 2; // cuántos a cada lado del actual

  const btn = (label, p, { active = false, disabled = false } = {}) =>
    `<button class="btn ${active ? "primary" : ""}" data-p="${
      disabled ? "disabled" : p
    }" ${disabled ? "disabled" : ""}>${label}</button>`;

  const left = Math.max(2, cur - WIN);
  const right = Math.min(pages - 1, cur + WIN);

  let nums = "";
  nums += btn("1", 1, { active: cur === 1 });
  if (left > 2) nums += `<span class="pager-ellipsis">…</span>`;
  for (let i = left; i <= right; i++) {
    if (i > 1 && i < pages) nums += btn(String(i), i, { active: cur === i });
  }
  if (right < pages - 1) nums += `<span class="pager-ellipsis">…</span>`;
  if (pages > 1) nums += btn(String(pages), pages, { active: cur === pages });

  cont.innerHTML = [
    btn("«", 1, { disabled: cur === 1 }),
    btn("‹", cur - 1, { disabled: cur === 1 }),
    nums,
    btn("›", cur + 1, { disabled: cur === pages }),
    btn("»", pages, { disabled: cur === pages }),
    `<span class="muted" style="margin-left:.75rem;">Pág. ${cur} de ${pages}</span>`,
    `<input type="number" min="1" max="${pages}" value="${cur}" data-goto style="width:4rem;margin-left:.5rem;">`,
    `<button class="btn" data-go>Ir</button>`,
  ].join(" ");

  cont.querySelectorAll("[data-p]").forEach((b) => {
    b.addEventListener("click", async () => {
      const v = b.getAttribute("data-p");
      if (v === "disabled") return;
      const p = parseInt(v, 10);
      if (!Number.isFinite(p)) return;
      await loadPageAndRender({ page: p });
    });
  });

  cont.querySelector("[data-go]")?.addEventListener("click", async () => {
    const n = parseInt(cont.querySelector("[data-goto]")?.value || "1", 10);
    const p = Math.min(Math.max(1, n), pages);
    await loadPageAndRender({ page: p });
  });
}

/* ============================================================================
   GAPS + CLICK DELEGADO
   ========================================================================== */
/* SOLO estilos/gaps: NO añadir listeners por fila (se pierden al ordenar) */
function refreshCurrentPageDecorations() {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  // Limpia filas expandibles anteriores
  tbody.querySelectorAll("tr.hs-row-expand").forEach((tr) => tr.remove());

  // Marca filas y asegura expander en mobile
  const trs = Array.from(tbody.querySelectorAll("tr")).filter(
    (tr) =>
      !tr.classList.contains("hs-gap") &&
      !tr.classList.contains("hs-row-expand"),
  );

  const pageRows = State.table?.getRawRows?.() || [];

  trs.forEach((tr, i) => {
    tr.classList.add("is-clickable");

    // En tu HTML ya viene data-row-idx (mejor usarlo) :contentReference[oaicite:3]{index=3}
    const domIdx = tr.getAttribute("data-row-idx");
    const idx = domIdx != null ? parseInt(domIdx, 10) : i;
    const row = pageRows[idx] || null;

    // En desktop: nada extra
    if (!isMobileAccordion()) {
      tr.classList.remove("is-open");
      return;
    }

    // Asegura columna + botón expander (estructura SIEMPRE; CSS decide visibilidad)
    // 1) Header: agrega un <th> al final si no existe
    const tableEl = tbody.closest("table");
    const theadTr = tableEl?.querySelector("thead tr");
    if (theadTr && !theadTr.querySelector(".hs-th-expander")) {
      const th = document.createElement("th");
      th.className = "hs-th-expander";
      th.setAttribute("aria-label", "Detalles");
      th.textContent = ""; // header vacío (solo ícono)
      theadTr.appendChild(th);
    }

    // 2) Body: agrega un <td> al final por fila si no existe
    let expTd = tr.querySelector("td.hs-cell-expander");
    if (!expTd) {
      expTd = document.createElement("td");
      expTd.className = "hs-cell-expander";
      tr.appendChild(expTd);
    }

    // 3) Botón dentro del td expander
    if (!expTd.querySelector(".hs-expander")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hs-expander";
      btn.setAttribute("aria-label", "Ver más detalles");
      btn.setAttribute("title", "Ver más detalles"); // tooltip nativo (discreto)
      btn.innerHTML = chevronSvg();
      expTd.appendChild(btn);
    }

    // Si esta fila es la expandida, reabre (persistencia al paginar/ordenar)
    const rowId = row?.id ?? row?.__raw?.id ?? null;
    const shouldOpen = rowId != null && State.__expandedRowId === rowId;

    tr.classList.toggle("is-open", !!shouldOpen);

    if (shouldOpen && row) {
      const exp = document.createElement("tr");
      exp.className = "hs-row-expand";

      const td = document.createElement("td");
      const isMobile =
        typeof isMobileAccordion === "function" && isMobileAccordion();
      td.colSpan = isMobile ? 3 : tr.children.length || 8;

      const raw = row.__raw || row;
      const depto = safeTxt(
        raw.departamento ||
          raw.depto ||
          raw.depto_nombre ||
          raw.departamento_nombre,
      );
      const asign = safeTxt(
        raw.asignadoFull || raw.asignadoNombre || raw.asignado,
      );
      const tel = safeTxt(raw.tel);
      const solicitado = safeTxt(
        formatDateMXShort(
          raw.creado ||
            raw.raw?.created_at ||
            raw.created_at ||
            raw.fecha_creacion,
        ),
      );

      td.innerHTML = `
        <div class="hs-expand-grid">
          <div class="hs-kv"><div class="hs-k">Departamento</div><div class="hs-v">${depto}</div></div>
          <div class="hs-kv"><div class="hs-k">Asignado</div><div class="hs-v">${asign}</div></div>
          <div class="hs-kv"><div class="hs-k">Teléfono</div><div class="hs-v">${tel}</div></div>
          <div class="hs-kv"><div class="hs-k">Solicitado</div><div class="hs-v">${solicitado}</div></div>
        </div>
        <div class="hs-expand-actions">
          <button type="button" class="hs-open-btn" data-open-req="${rowId}">
            Abrir
          </button>
        </div>
      `;

      exp.appendChild(td);
      tr.insertAdjacentElement("afterend", exp);
    }
  });

  // (opcional) logs y gaps como ya tenías
  const realCount = pageRows.length;
  const gaps = Math.max(0, CONFIG.PAGE_SIZE - realCount);
  log("gaps añadidos:", gaps, "reales en página:", realCount);
}

/* Delegación permanente: mantiene los clicks aunque se regenere el <tbody> */
function setupRowClickDelegation() {
  const tbody = document.querySelector(SEL.tableBody);
  if (!tbody) return;

  tbody.addEventListener("click", (e) => {
    // 1) Botón "Abrir" dentro del panel expandido (subfila)
    const openBtn = e.target.closest("[data-open-req]");
    if (openBtn) {
      const id = openBtn.getAttribute("data-open-req");
      if (id) {
        window.location.href = `/VIEWS/requerimiento.php?id=${encodeURIComponent(
          id,
        )}`;
      }
      return;
    }

    // 2) Detecta fila objetivo
    const tr = e.target.closest("tr");
    if (!tr) return;

    // Ignora filas gap y la subfila expandida
    if (tr.classList.contains("hs-gap")) return;
    if (tr.classList.contains("hs-row-expand")) return;

    // 3) Mobile: comportamiento accordion (toggle), NO navegar al tocar fila
    const mobile =
      typeof isMobileAccordion === "function" && isMobileAccordion();

    if (mobile) {
      const clickedExpander = !!e.target.closest(".hs-expander");

      // Estándar: en mobile SOLO togglear si tocó el chevron
      if (!clickedExpander) return;

      // Si tocó un control interactivo distinto al expander, no togglear
      // (evita conflictos si en el futuro metes links/botones dentro de la fila)
      const interactive = e.target.closest(
        "a,button,input,select,textarea,label",
      );
      if (interactive && !clickedExpander) return;

      const pageRows = State.table?.getRawRows?.() || [];

      // Preferimos data-row-idx (lo pinta tu createTable)
      let idx = -1;
      const domIdx = tr.getAttribute("data-row-idx");
      if (domIdx != null && domIdx !== "") idx = parseInt(domIdx, 10);

      // Fallback: índice basado en DOM (solo rows reales)
      if (!Number.isFinite(idx) || idx < 0) {
        const realRowsInDom = Array.from(tbody.querySelectorAll("tr")).filter(
          (row) =>
            !row.classList.contains("hs-gap") &&
            !row.classList.contains("hs-row-expand"),
        );
        idx = realRowsInDom.indexOf(tr);
      }

      if (idx < 0 || idx >= pageRows.length) return;

      const raw = pageRows[idx];
      const id = raw?.id || raw?.__raw?.id;
      if (!id) return;

      // Solo 1 abierta a la vez (persistimos id)
      State.__expandedRowId = State.__expandedRowId === id ? null : id;

      // Re-pinta acordeón en la página actual (sin refetch)
      if (typeof refreshCurrentPageDecorations === "function") {
        refreshCurrentPageDecorations();
      }

      e.preventDefault();
      return;
    }

    // 4) Desktop: comportamiento actual (navegar al detalle)
    const pageRows = State.table?.getRawRows?.() || [];

    let idx = -1;
    const domIdx = tr.getAttribute("data-row-idx");
    if (domIdx != null && domIdx !== "") idx = parseInt(domIdx, 10);

    if (!Number.isFinite(idx) || idx < 0) {
      const rowsInDom = Array.from(tbody.querySelectorAll("tr")).filter(
        (row) => !row.classList.contains("hs-gap"),
      );
      idx = rowsInDom.indexOf(tr);
    }

    if (idx < 0 || idx >= pageRows.length) return;

    const raw = pageRows[idx];
    const id = raw?.id || raw?.__raw?.id;
    if (id) {
      window.location.href = `/VIEWS/requerimiento.php?id=${encodeURIComponent(
        id,
      )}`;
    }
  });
}

/* ============================================================================
   Refresca bloque de perfil (sidebar)
   ========================================================================== */
function refreshSidebarFromSession(sess) {
  try {
    const s = sess || window.Session?.get?.() || null;
    if (!s) return;

    const name = [s.nombre, s.apellidos].filter(Boolean).join(" ").trim();
    const nameEl = document.getElementById("hs-profile-name");
    if (nameEl && name) nameEl.textContent = name;

    const avatarEl = document.getElementById("hs-avatar");
    if (avatarEl && window.gcSetAvatarSrc) {
      const sessionLike = {
        id_usuario:
          s.id_usuario ?? s.usuario_id ?? s.empleado_id ?? s.id_empleado,
        avatarUrl: s.avatarUrl || s.avatar,
        nombre: s.nombre,
        apellidos: s.apellidos,
      };
      window.gcSetAvatarSrc(avatarEl, sessionLike);
    }
  } catch (e) {
    console.warn("[Home] refreshSidebarFromSession error:", e);
  }
}

/* ============================================================================
   PIPELINE + RENDER
   ========================================================================== */
function applyPipelineAndRender() {
  const all = State.rows || [];
  let filtered = all;

  if (State.filterKey !== "todos") {
    if (State.filterKey === "activo") {
      filtered = filtered.filter((r) => {
        const k = normalizeStatusKey(r.estatus?.key || "");
        return k !== "pausado" && k !== "cancelado" && k !== "finalizado";
      });
    } else {
      filtered = filtered.filter(
        (r) => normalizeStatusKey(r.estatus?.key) === State.filterKey,
      );
    }
  }

  if (State.search) {
    const q = State.search;
    filtered = filtered.filter((r) => {
      const asunto = (r.asunto || "").toLowerCase();
      const asign = (r.asignado || r.asignadoNombre || "").toLowerCase();
      const est = (r.estatus?.label || "").toLowerCase();
      const folio = (r.folio || "").toLowerCase();
      const depto = (r.departamento || "").toLowerCase();
      const idTxt = String(r.id || "");
      return (
        asunto.includes(q) ||
        asign.includes(q) ||
        est.includes(q) ||
        depto.includes(q) ||
        folio.includes(q) ||
        idTxt.includes(q)
      );
    });
  }

  computeCounts(all);
  updateLegendTotals(filtered.length);

  const rows = filtered.map((r) => ({
    __raw: r,
    id: r.id,
    folio: r.folio,
    departamento:
      r.departamento ||
      r.depto ||
      r.depto_nombre ||
      r.departamento_nombre ||
      r.raw?.departamento?.nombre ||
      "—",
    tramite: r.tramite,
    asunto: r.asunto,
    asignado: r.asignado,
    asignadoNombre: r.asignadoNombre,
    asignadoFull: r.asignadoFull,
    tel: r.tel,
    creado:
      r.creado || r.raw?.created_at || r.created_at || r.fecha_creacion || null,
    estatus: r.estatus,
  }));

  State.table?.setData(rows);
  State.__page = 1;

  refreshCurrentPageDecorations();

  State.__lastTotal = filtered.length; // para el pager

  updateExportButtonState(filtered.length);
  renderPagerClassic(filtered.length);

  log("pipeline", {
    filtroStatus: State.filterKey,
    search: State.search,
    totalUniverso: all.length,
    totalFiltrado: filtered.length,
    page: State.__page,
  });

  drawChartsFromRows(filtered);
}

/* ============================================================================
   CHARTS — helpers + render
   ========================================================================== */
function computeYearSeries(rows) {
  const now = new Date();
  const y0 = now.getFullYear();
  const y1 = y0 - 1;

  const s0 = Array(12).fill(0); // año actual
  const s1 = Array(12).fill(0); // año pasado

  for (const r of rows) {
    const iso = String(r.creado || r.raw?.created_at || "").replace(" ", "T");
    const d = new Date(iso);
    if (isNaN(d)) continue;

    const m = d.getMonth();
    const y = d.getFullYear();

    if (y === y0) s0[m]++;
    else if (y === y1) s1[m]++;
  }

  return [
    { name: String(y0), data: s0 },
    { name: String(y1), data: s1 },
  ];
}

function computeStatusDistributionAll(rows) {
  const toKey = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[\s_-]+/g, " ")
      .trim();

  const by = new Map();
  for (const r of rows) {
    const raw = r.tramite || r.asunto || r.raw?.tramite || r.raw?.asunto || "";
    const display = String(raw).trim() || "Otros";
    const key = toKey(display) || "otros";
    const cur = by.get(key);
    if (cur) {
      cur.value += 1;
    } else {
      by.set(key, { label: display, value: 1 });
    }
  }
  const items = Array.from(by.values()).sort((a, b) => b.value - a.value);
  const total = items.reduce((acc, it) => acc + it.value, 0);
  return { items, total };
}

function drawChartsFromRows(rows) {
  const labels = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const yearSeries = computeYearSeries(rows);
  const donutAgg = computeStatusDistributionAll(rows);

  const $line = $(SEL.chartYear);
  const $donut = $(SEL.chartMonth);

  log("CHARTS — input (rows length):", rows.length);
  log("CHARTS — year series:", { labels, series: yearSeries });
  log("CHARTS — donut distribution:", donutAgg);

  try {
    Charts?.line?.destroy?.();
  } catch {}
  try {
    Charts?.donut?.destroy?.();
  } catch {}

  if ($line) {
    try {
      Charts.line = new LineChart($line, {
        labels,
        series: yearSeries,
        linecount: 2, // aqui indico cuantas series deben de ser
        showGrid: true,
        headroom: 0.2,
        yTicks: 6,
      });

      log("CHARTS — LineChart render ok");
    } catch (e) {
      err("LineChart error:", e);
    }
  }

  if ($donut) {
    try {
      Charts.donut = new DonutChart($donut, {
        data: donutAgg.items, // ← usa donutAgg
        total: donutAgg.total, // ← usa donutAgg
        legendEl: $(SEL.donutLegend) || null,
        showPercLabels: true,
      });
      log("CHARTS — DonutChart render ok", { total: donutAgg.total });
    } catch (e) {
      err("DonutChart error:", e);
    }
  }

  document.querySelectorAll(".hs-chart-skeleton")?.forEach((el) => el.remove());
}

/* ============================================================================
   RBAC + fetch + dedupe + visibilidad por rol
   ========================================================================== */
function dedupeById(...lists) {
  const map = new Map();
  lists.flat().forEach((r) => {
    if (r && r.id != null) map.set(r.id, r);
  });
  return Array.from(map.values()).sort(
    (a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || "")) ||
      (b.id || 0) - (a.id || 0),
  );
}

async function fetchAllRequerimientos(perPage = 200, maxPages = 50) {
  const url =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_requerimiento.php";
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ page, per_page: perPage }),
    });
    if (!res.ok) break;
    const json = await res.json();
    const arr = json?.data || [];
    all.push(...arr);
    if (arr.length < perPage) break;
  }
  return all;
}

async function fetchMineAndTeam(plan) {
  const ids = [plan.mineId, ...(plan.teamIds || [])].filter(Boolean);
  const results = await Promise.allSettled(
    ids.map((id) => listByAsignado(id, {})),
  );
  const lists = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value || []);
  return dedupeById(...lists);
}

/** Todos los requerimientos del departamento */
async function fetchDeptAll(deptId, perPage = 200, maxPages = 50) {
  if (!deptId) return [];
  const url =
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_requerimiento.php";
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        departamento_id: deptId,
        per_page: perPage,
        page,
      }),
    });
    if (!res.ok) break;
    const json = await res.json();
    const arr = json?.data || [];
    all.push(...arr);
    if (arr.length < perPage) break;
  }
  return all;
}

/** Visibilidad por rol */
function filterRoleVisibility(
  items,
  { isAdmin, isPres, isDir, soyPL, isJefe, isAnal },
) {
  if (isAdmin || isPres) return items;
  if (isDir || soyPL || isJefe || isAnal) {
    const hide = new Set(["solicitud", "revision"]);
    return items.filter(
      (r) =>
        !hide.has(normalizeStatusKey(r?.estatus_key || r?.estatus || "")) &&
        !hide.has(normalizeStatusKey(r?.estatus?.key || "")),
    );
  }
  return items;
}

/* ============================================================================
   CARGA PRINCIPAL
   ========================================================================== */
async function loadScopeData() {
  const { empleado_id: viewerId, dept_id, roles } = State.session;
  if (!viewerId) {
    warn("viewerId ausente.");
    State.universe = [];
    State.rows = [];
    computeCounts([]);
    updateLegendTotals(0);
    updateLegendStatus();
    applyPipelineAndRender();
    drawChartsFromRows([]);
    return;
  }

  const plan = await planScope({ viewerId, viewerDeptId: dept_id });
  State.scopePlan = plan;

  const isAdmin = (roles || []).some((r) => CONFIG.ADMIN_ROLES.includes(r));
  const isPres = CONFIG.PRESIDENCIA_DEPT_IDS.includes(Number(dept_id));
  const isDir = (roles || []).includes("DIRECTOR");
  const soyPL = await isPrimeraLinea(viewerId, dept_id);
  const isJefe = (roles || []).includes("JEFE");
  const isAnal = (roles || []).includes("ANALISTA");

  State.rbac = { isAdmin, isPres, isDir, soyPL, isJefe, isAnal };
  log("RBAC flags:", {
    isAdmin,
    isPres,
    isDirector: isDir,
    primeraLinea: soyPL,
    isJefe,
    isAnal,
  });

  let items = [];

  if (isAdmin || isPres) {
    log("modo ADMIN/PRESIDENCIA → fetch global");
    items = await fetchAllRequerimientos();
  } else if (isDir || soyPL) {
    log("modo DIRECTOR/PRIMERA LÍNEA → todos los del departamento");
    items = await fetchDeptAll(dept_id);
  } else if (isJefe || isAnal) {
    log("modo JEFE/ANALISTA → yo + subordinados");
    items = await fetchMineAndTeam(plan);
  } else {
    log("modo RESTO → asignados a mí");
    items = await fetchMineAndTeam({ mineId: plan.mineId, teamIds: [] });
  }

  // Dedup
  const deduped = dedupeById(items);

  // HIDRATAR nombres del asignado ANTES del parse
  await hydrateAsignadoFields(deduped);

  // Map UI
  const uiRows = deduped.map(parseReq);

  // Visibilidad por rol a nivel UI
  let visibleRows = uiRows;
  if (!(isAdmin || isPres)) {
    if (isDir || soyPL || isJefe || isAnal) {
      const hide = new Set(["solicitud", "revision"]);
      visibleRows = uiRows.filter(
        (r) => !hide.has(normalizeStatusKey(r?.estatus?.key)),
      );
    }
  }

  State.universe = deduped;
  State.rows = visibleRows;

  // DEBUG Sin asignar
  try {
    const sinAsignar = State.rows
      .filter((r) => (r.asignado || "").toLowerCase() === "sin asignar")
      .slice(0, 5);
    if (sinAsignar.length) {
      console.warn(
        "[Home][DEBUG] Ejemplos 'Sin asignar' (máx 5):",
        sinAsignar.map((r) => ({
          id: r.id,
          asignado: r.asignado,
          asignadoNombre: r.asignadoNombre,
          asignadoApellidos: r.asignadoApellidos,
          asignadoFull: r.asignadoFull,
          raw_asignado: r.raw?.asignado,
          raw_asignado_a: r.raw?.asignado_a,
          raw_asignado_nombre: r.raw?.asignado_nombre,
          raw_asignado_apellidos: r.raw?.asignado_apellidos,
          raw_asignado_nombre_completo: r.raw?.asignado_nombre_completo,
        })),
      );
    }
  } catch {}

  log(
    "items UI-mapped (preview):",
    State.rows.slice(0, 5).map((r) => ({
      id: r.id,
      tramite: r.tramite,
      departamento: r.departamento || r.raw?.departamento?.nombre,
      asignado: r.asignado,
      tel: r.tel,
      estatus: r.estatus?.label,
    })),
  );

  computeCounts(State.rows);
  updateLegendTotals(State.rows.length);
  updateLegendStatus();
  applySidebarVisibilityByRole();
  applyPipelineAndRender();

  drawChartsFromRows(State.rows);
  log("Home listo");
}

/* ============================================================================
   INIT
   ========================================================================== */

/* ======================================
 *  Mobile UI: Filtros como combo
 *  - No cambia lógica de filtros
 *  - Solo abre/cierra dropdown y muestra activo
 * ====================================== */
function initMobileFilterCombo() {
  const box = document.getElementById("hs-filterbox");
  const toggle = document.getElementById("hs-filter-toggle");
  const active = document.getElementById("hs-filter-active");
  const states = document.getElementById("hs-states");
  if (!box || !toggle || !active || !states) return;

  const isMobile = () => window.matchMedia("(max-width: 820px)").matches;

  const setActiveLabel = () => {
    const btn =
      states.querySelector(".item.is-active") ||
      states.querySelector(".item[aria-checked='true']");
    if (!btn) return;
    const label = (btn.querySelector(".label")?.textContent || "Todos").trim();
    const count = (btn.querySelector(".count")?.textContent || "(0)").trim();
    active.textContent = `${label} ${count}`.trim();
  };

  const open = () => {
    if (!isMobile()) return;
    box.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
  };

  const close = () => {
    box.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    if (!isMobile()) return;
    box.classList.toggle("is-open");
    toggle.setAttribute(
      "aria-expanded",
      box.classList.contains("is-open") ? "true" : "false",
    );
  });

  // Al escoger un status, cerramos el combo en mobile
  states.addEventListener("click", (e) => {
    const b = e.target.closest(".item");
    if (!b) return;

    // Espera a que la lógica marque is-active / aria-checked
    setTimeout(() => {
      setActiveLabel();
      if (isMobile()) close();
    }, 0);
  });

  // Click fuera cierra
  document.addEventListener("click", (e) => {
    if (!isMobile()) return;
    if (!box.classList.contains("is-open")) return;
    if (box.contains(e.target)) return;
    close();
  });

  // Sync al cargar y al resize
  setActiveLabel();
  window.addEventListener("resize", () => {
    setActiveLabel();
    if (!isMobile()) close();
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    readSession();
    await hydrateProfileFromSession();
    ensureEditProfileButton();
    initProfileModal();
    initSidebar(() => applyPipelineAndRender());
    initSearch(() => applyPipelineAndRender());
    buildTable();
    updateLegendStatus();

    initMobileFilterCombo();

    setupRowClickDelegation();

    // bandera, export del csv para que no haya pedo
    // initExportCSVHome({
    //   buttonId: "hs-btn-export-req",
    //   State,
    //   normalizeStatusKey,
    //   formatDateMXShort,
    //   toast: (m, t = "info") =>
    //     window.gcToast ? gcToast(m, t) : console.log("[toast]", t, m),
    //   getFilePrefix: () => "requerimientos",
    // });

    initExportXLSXHome({
      buttonId: "hs-btn-export-req",
      State,
      normalizeStatusKey,
      formatDateMXShort,
      toast: (m, t = "info") =>
        window.gcToast ? gcToast(m, t) : console.log("[toast]", t, m),
      mode: "view", // respeta filtros/búsqueda
    });

    const sess = Session?.get?.() || null;
    window.gcRefreshHeader?.(sess);
    refreshSidebarFromSession(sess);

    await loadScopeData();
  } catch (e) {
    err("init error:", e);
  }
});
