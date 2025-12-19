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

  // contador de lineas para el linechart
  LINECOUNT: 2,

  STATUS_KEY_BY_CODE: {
    0: "solicitud",
    1: "revision",
    2: "asignacion",
    3: "enProceso",
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
  hydrateAsignadoFields, // ← importante
} from "/JS/api/requerimientos.js";
import { createTable } from "/JS/ui/table.js";
import { LineChart } from "/JS/charts/line-chart.js";
import { DonutChart } from "/JS/charts/donut-chart.js";

/* === API de usuarios (empleados) === */
import { getEmpleadoById, updateEmpleado } from "/JS/api/usuarios.js";

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
    '.edit-profile,[data-open="#modal-perfil"]'
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
      "input,button,select,textarea,[tabindex]:not([tabindex='-1'])"
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
    })
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
  __lastTotal: 0,
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
      b64
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
   SIDEBAR (sin cambios)
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
      btn.classList.contains("is-active") ? "true" : "false"
    );
    const key = btn.dataset.status;
    if (!SIDEBAR_KEYS.includes(key)) warn("status no válido:", key);

    btn.addEventListener("click", () => {
      if (btn.getAttribute("aria-disabled") === "true") return;
      items.forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-checked", "false");
        b.tabIndex = -1;
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-checked", "true");
      btn.tabIndex = 0;
      State.filterKey = key || "todos";
      State.__page = 1;
      updateLegendStatus();
      onChange?.();
      $(SEL.searchInput)?.focus();
    });
  });

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
   TABLA (sin cambios)
   ========================================================================== */
function buildTable() {
  State.table = createTable({
    bodySel: SEL.tableBody,
    wrapSel: SEL.tableWrap,
    pagSel: null,
    pageSize: CONFIG.PAGE_SIZE,
    columns: [
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
              "—"
          ),
        render: (v, r) =>
          r.departamento ||
          r.depto ||
          r.depto_nombre ||
          r.departamento_nombre ||
          r.raw?.departamento?.nombre ||
          "—",
      },
      {
        key: "tramite",
        title: "Tipo de trámite",
        sortable: true,
        accessor: (r) => normText(r.tramite || r.asunto || "—"),
        render: (v, r) => r.tramite || r.asunto || "—",
      },
      {
        key: "asignado",
        title: "Asignado",
        sortable: true,
        accessor: (r) => r.asignadoNombre || r.asignado || "Sin asignar",
        render: (v, r) => v || r.asignado || "Sin asignar",
      },
      {
        key: "tel",
        title: "Teléfono",
        sortable: true,
        accessor: (r) => digitsNumber(r.tel),
        render: (v, r) => (r.tel ? r.tel : "—"),
      },
      {
        key: "status",
        title: "Estatus",
        sortable: true,
        accessor: (r) => normText(r.estatus?.label || "—"),
        render: (v, r) => {
          const keyNorm = normalizeStatusKey(
            r.estatus?.key || r.estatus?.label || "revision"
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
   LEYENDAS / CONTEOS (sin cambios)
   ========================================================================== */
function updateLegendTotals(n) {
  setText(SEL.legendTotal, String(n ?? 0));
}
function updateLegendStatus() {
  const map = {
    todos: "Todos los status",
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
  });
  State.counts = c;
  setText("#cnt-todos", `(${c.todos})`);
  setText("#cnt-solicitud", `(${c.solicitud})`);
  setText("#cnt-revision", `(${c.revision})`);
  setText("#cnt-asignacion", `(${c.asignacion})`);
  setText("#cnt-proceso", `(${c.proceso})`);
  setText("#cnt-pausado", `(${c.pausado})`);
  setText("#cnt-cancelado", `(${c.cancelado})`);
  setText("#cnt-finalizado", `(${c.finalizado})`);
}

/* ============================================================================
   PAGINACIÓN (sin cambios)
   ========================================================================== */
async function loadPageAndRender({ page }) {
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
  const WIN = 2;

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
   GAPS + CLICK DELEGADO (sin cambios)
   ========================================================================== */
function refreshCurrentPageDecorations() {
  const tbody = $(SEL.tableBody);
  if (!tbody) return;

  tbody.querySelectorAll("tr.hs-gap").forEach((tr) => tr.remove());

  Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
    tr.classList.add("is-clickable");
  });

  const pageRows = State.table?.getRawRows?.() || [];
  const realCount = pageRows.length;
  const gaps = Math.max(0, CONFIG.PAGE_SIZE - realCount);
  log("gaps añadidos:", gaps, "reales en página:", realCount);
}

function setupRowClickDelegation() {
  const tbody = document.querySelector(SEL.tableBody);
  if (!tbody) return;

  tbody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr || tr.classList.contains("hs-gap")) return;

    const rowsInDom = Array.from(tbody.querySelectorAll("tr"));
    const idx = rowsInDom.indexOf(tr);
    if (idx < 0) return;

    const pageRows = State.table?.getRawRows?.() || [];
    const raw = pageRows[idx];

    const id = raw?.id || raw?.__raw?.id;
    if (id) {
      window.location.href = `/VIEWS/requerimiento.php?id=${id}`;
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
   PIPELINE + RENDER (sin cambios)
   ========================================================================== */
function applyPipelineAndRender() {
  const all = State.rows || [];
  let filtered = all;

  if (State.filterKey !== "todos") {
    filtered = filtered.filter(
      (r) => normalizeStatusKey(r.estatus?.key) === State.filterKey
    );
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
    estatus: r.estatus,
  }));

  State.table?.setData(rows);
  State.__page = 1;

  refreshCurrentPageDecorations();

  State.__lastTotal = filtered.length;
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
   CHARTS — helpers + render (✅ actualizado)
   ========================================================================== */
function getReqDate(r) {
  // parseReq te deja r.raw, y el backend suele traer created_at
  const raw =
    r?.raw?.created_at ??
    r?.raw?.fecha_creacion ??
    r?.created_at ??
    r?.fecha_creacion ??
    r?.creado ??
    null;

  if (!raw) return null;

  const d = new Date(String(raw).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** ✅ Multi-serie: 1 línea por año, limitado por CONFIG.LINECOUNT */
function computeYearMultiSeries(rows, linecount = 5) {
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
  const map = new Map(); // year -> [12]

  for (const r of rows || []) {
    const d = getReqDate(r);
    if (!d) continue;

    const y = d.getFullYear();
    const m = d.getMonth();

    if (!map.has(y)) map.set(y, Array(12).fill(0));
    map.get(y)[m] += 1;
  }

  const years = Array.from(map.keys()).sort((a, b) => a - b);
  const last = years.slice(-Math.max(1, linecount));

  const series = last.map((y) => ({
    name: String(y),
    data: map.get(y),
  }));

  return { labels, series };
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
    if (cur) cur.value += 1;
    else by.set(key, { label: display, value: 1 });
  }
  const items = Array.from(by.values()).sort((a, b) => b.value - a.value);
  const total = items.reduce((acc, it) => acc + it.value, 0);
  return { items, total };
}

function drawChartsFromRows(rows) {
  const donutAgg = computeStatusDistributionAll(rows);

  const $line = $(SEL.chartYear);
  const $donut = $(SEL.chartMonth);

  // ✅ arma series multi-año
  const linecount = Number(CONFIG.LINECOUNT) || 5;
  const lineAgg = computeYearMultiSeries(rows, linecount);

  log("CHARTS — input (rows length):", rows.length);
  log("CHARTS — line multi series:", { linecount, ...lineAgg });
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
        labels: lineAgg.labels,
        series: lineAgg.series,
        linecount, // ✅ controla cuántas líneas dibuja
        showGrid: true,
        headroom: 0.2,
        yTicks: 6,
      });
      log("CHARTS — LineChart multi render ok");
    } catch (e) {
      err("LineChart error:", e);
    }
  }

  if ($donut) {
    try {
      Charts.donut = new DonutChart($donut, {
        data: donutAgg.items,
        total: donutAgg.total,
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
   RBAC + fetch + dedupe + visibilidad por rol (sin cambios)
   ========================================================================== */
function dedupeById(...lists) {
  const map = new Map();
  lists.flat().forEach((r) => {
    if (r && r.id != null) map.set(r.id, r);
  });
  return Array.from(map.values()).sort(
    (a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || "")) ||
      (b.id || 0) - (a.id || 0)
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
    ids.map((id) => listByAsignado(id, {}))
  );
  const lists = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value || []);
  return dedupeById(...lists);
}

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

  const deduped = dedupeById(items);
  await hydrateAsignadoFields(deduped);
  const uiRows = deduped.map(parseReq);

  let visibleRows = uiRows;
  if (!(isAdmin || isPres)) {
    if (isDir || soyPL || isJefe || isAnal) {
      const hide = new Set(["solicitud", "revision"]);
      visibleRows = uiRows.filter(
        (r) => !hide.has(normalizeStatusKey(r?.estatus?.key))
      );
    }
  }

  State.universe = deduped;
  State.rows = visibleRows;

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

    setupRowClickDelegation();

    const sess = Session?.get?.() || null;
    window.gcRefreshHeader?.(sess);
    refreshSidebarFromSession(sess);

    await loadScopeData();
  } catch (e) {
    err("init error:", e);
  }
});
