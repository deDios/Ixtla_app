// /JS/ui/requerimientosCanal2.js
// Canal 2 — Levantamiento de requerimientos (Home UAT)
// - Replica el post-success de Trámites: abre ixDoneModal con folio
// - Evita refresh completo: intenta recargar tabla (si existe hook), o agrega fila al inicio
(function () {
  "use strict";

  const TAG = "[ReqCanal2]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);

  // =========================
  // Config (ajusta solo si tu HTML cambia)
  // =========================
  const SEL = {
    openBtn: "#hs-btn-new-req",      // botón "Nuevo requerimiento" en Home
    modal: "#ix-report-modal",       // modal principal (mismo ID que Trámites)
    form: "#ix-report-form",         // form dentro del modal
    submit: "#ix-submit",            // botón enviar dentro del modal
    close: "[data-ix-close]",        // overlay/botones cerrar
    feedback: "#ix-report-feedback", // área de feedback (si existe)
    folioDone: "#ix-done-folio",     // folio dentro del mini modal (DoneModal)
    tableBody: "#hs-table-body",     // tbody de la tabla de requerimientos en Home
  };

  // =========================
  // Endpoints
  // =========================
  // Canal 2 corre autenticado (ix_guard), pero el levantamiento público ya funciona vía proxy firmador.
  // Si tu backend ya soporta canal/estatus desde el insert, esto basta.
  const EP = {
    createProxy: "/webpublic_proxy.php", // crea requerimiento y regresa {ok, data:{id, folio}}
    reqGet: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_requerimiento.php",
  };

  // =========================
  // Helpers
  // =========================
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const toast = {
    ok: (m, ms) => (window.ixToast?.ok ? window.ixToast.ok(m, ms) : (window.gcToast ? window.gcToast(m, "success") : log("[toast ok]", m))),
    warn: (m, ms) => (window.ixToast?.warn ? window.ixToast.warn(m, ms) : (window.gcToast ? window.gcToast(m, "warning") : warn("[toast warn]", m))),
    err: (m, ms) => (window.ixToast?.err ? window.ixToast.err(m, ms) : (window.gcToast ? window.gcToast(m, "error") : err("[toast err]", m))),
  };

  const digits = (s) => String(s || "").replace(/\D+/g, "");
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

  function formatDateMX(str) {
    if (!str) return "—";
    const d = new Date(String(str).replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return String(str);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  function anySignal(signals) {
    const c = new AbortController();
    const onAbort = () => c.abort();
    signals.filter(Boolean).forEach((s) => s.addEventListener("abort", onAbort, { once: true }));
    return c.signal;
  }

  function withTimeout(factory, ms = 15000, extSignal) {
    const tCtrl = new AbortController();
    const timer = setTimeout(() => tCtrl.abort(), ms);
    const signal = extSignal ? anySignal([tCtrl.signal, extSignal]) : tCtrl.signal;
    return Promise.resolve()
      .then(() => factory(signal))
      .finally(() => clearTimeout(timer));
  }

  function showFeedback(msg) {
    const el = $(SEL.feedback);
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  function closeMainModal() {
    // Si existe el mismo controlador que Trámites, úsalo
    if (window.ixReportModal?.close) return window.ixReportModal.close();

    // Fallback: ocultar por atributos/clases (Home.php usa hidden + aria-hidden)
    const modal = $(SEL.modal);
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // =========================
  // Tabla Home: refresco sin reload
  // =========================
  function tryHookReloadTable() {
    // Si home.js expone algún método global, lo preferimos (paginación/contadores quedan correctos)
    const candidates = [
      window.Home?.reloadRequerimientos,
      window.Home?.reload,
      window.IXHome?.reloadRequerimientos,
      window.HS?.reloadRequerimientos,
      window.RequerimientosTable?.reload,
      window.Requerimientos?.reload,
    ].filter((fn) => typeof fn === "function");

    if (candidates.length) {
      try {
        candidates[0]();
        return true;
      } catch (e) {
        warn("Hook reload tabla falló:", e);
      }
    }
    return false;
  }

  async function postJSON(url, body, extraHeaders = {}, extSignal) {
    return withTimeout(
      (signal) =>
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...extraHeaders,
          },
          body: JSON.stringify(body || {}),
          signal,
        }).then(async (r) => {
          const j = await r.json().catch(() => null);
          if (!r.ok) {
            const msg = j?.error || j?.message || `HTTP ${r.status}`;
            throw new Error(msg);
          }
          return j;
        }),
      20000,
      extSignal,
    );
  }

  async function fetchReqById(id) {
    if (!id) return null;
    try {
      const json = await postJSON(EP.reqGet, { id });
      return json?.data || null;
    } catch (e) {
      warn("No se pudo consultar requerimiento recién creado:", e);
      return null;
    }
  }

  function mapReqToRow(req) {
    // defensivo: campos pueden variar según backend
    const folio = req?.folio || req?.Folio || "REQ-—";
    const dept = req?.departamento_nombre || req?.departamento || req?.depto_nombre || "—";
    const tramite = req?.tramite_nombre || req?.tramite || req?.tipo_tramite || "—";
    const asignado = req?.asignado_display || req?.asignado_a_nombre || req?.asignado || "—";
    const tel = req?.telefono ? digits(req.telefono) : "—";
    const fecha = formatDateMX(req?.fecha_creacion || req?.created_at || req?.fecha || req?.fecha_solicitud);
    const est = req?.estatus_txt || req?.estatus_nombre || req?.estatus || req?.status || "—";
    return { folio, dept, tramite, asignado, tel, fecha, est };
  }

  function prependRowToHomeTable(row) {
    const tbody = $(SEL.tableBody);
    if (!tbody) return false;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.folio)}</td>
      <td>${escapeHtml(row.dept)}</td>
      <td>${escapeHtml(row.tramite)}</td>
      <td>${escapeHtml(row.asignado)}</td>
      <td>${escapeHtml(row.tel)}</td>
      <td>${escapeHtml(row.fecha)}</td>
      <td>${escapeHtml(String(row.est))}</td>
    `;

    // al inicio
    tbody.prepend(tr);
    return true;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function notifyReqCreated(detail) {
    // Para que otros módulos (home.js) reaccionen si quieren
    document.dispatchEvent(new CustomEvent("ix:req:created", { detail }));
  }

  // =========================
  // Submit (Canal 2)
  // =========================
  let isSubmitting = false;

  function buildBodyFromForm(form) {
    const fd = new FormData(form);

    const body = Object.fromEntries(fd.entries());

    // Normalizaciones típicas (mantén compatibles con backend)
    // Nota: Si tu modal tiene inputs con esos names, se envían; si no, se ignoran.
    if (body.telefono != null) body.telefono = digits(body.telefono);
    if (body.correo != null) body.correo = String(body.correo).trim();

    // Canal 2 / estatus inicial (según tu workaround previo: canal=2, estatus=3)
    // Si el backend ignora estos campos, no rompe.
    if (body.canal == null) body.canal = 2;
    if (body.estatus == null) body.estatus = 3;

    return body;
  }

  function basicValidate(body) {
    const problems = [];

    // Estas validaciones son mínimas y no intrusivas
    if (!String(body.nombre || "").trim()) problems.push("Nombre es obligatorio.");
    if (!digits(body.telefono || "").match(/^\d{10,15}$/)) problems.push("Teléfono inválido.");
    if (body.correo && !isEmail(body.correo)) problems.push("Correo inválido.");
    if (!String(body.descripcion || "").trim()) problems.push("Descripción es obligatoria.");

    return problems;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (isSubmitting) return;

    const modal = $(SEL.modal);
    const form = $(SEL.form);
    const btn = $(SEL.submit);
    if (!form || !btn) return;

    showFeedback("");
    const body = buildBodyFromForm(form);

    const issues = basicValidate(body);
    if (issues.length) {
      toast.warn(issues[0], 3200);
      showFeedback(issues.join(" "));
      return;
    }

    isSubmitting = true;
    const oldTxt = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Enviando…";
    form.setAttribute("aria-busy", "true");

    try {
      const idempKey = `ix-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      // 1) Crear requerimiento
      const json = await postJSON(
        EP.createProxy,
        body,
        { "X-Requested-With": "XMLHttpRequest", "Idempotency-Key": idempKey },
      );

      if (!json?.ok || !json?.data) throw new Error("Respuesta inesperada del servidor.");
      const id = Number(json.data.id || json.data.requerimiento_id || 0) || null;
      const folio = String(json.data.folio || "").trim() || `REQ-${String(Date.now() % 1e10).padStart(10, "0")}`;

      // 2) UX: toast + mini modal (DoneModal)
      toast.ok(`Reporte creado: ${folio}`, 3200);
      window.ixDoneModal?.open?.({ folio, title: body?.req_title || body?.titulo || body?.asunto || "Requerimiento" });

      // 3) Cerrar modal principal + reset form (como Trámites)
      form.reset();
      closeMainModal();

      // 4) Reflejar en tabla SIN refresh:
      //    a) si home.js expone reload → úsalo
      //    b) si no, consultamos el requerimiento recién creado por id y lo prependemos
      //    c) si no hay id, al menos notificamos un evento para que otro módulo recargue
      notifyReqCreated({ id, folio });

      if (!tryHookReloadTable()) {
        if (id) {
          const req = await fetchReqById(id);
          const row = mapReqToRow(req || { folio, telefono: body.telefono, estatus: body.estatus });
          const ok = prependRowToHomeTable(row);
          if (!ok) warn("No se encontró #hs-table-body para reflejar el nuevo requerimiento.");
        } else {
          warn("Insert OK pero no regresó id; no se puede hidratar fila para la tabla.");
        }
      }
    } catch (e) {
      toast.err("No se pudo enviar el reporte.");
      showFeedback(`No se pudo enviar el reporte. ${e?.message || e}`);
    } finally {
      isSubmitting = false;
      form.removeAttribute("aria-busy");
      btn.disabled = false;
      btn.textContent = oldTxt;
    }
  }

  // =========================
  // Wire-up
  // =========================
  function init() {
    const modal = $(SEL.modal);
    const form = $(SEL.form);
    const btnOpen = $(SEL.openBtn);

    if (!modal || !form) {
      warn("No existe modal/form de Canal 2 en esta vista.");
      return;
    }

    // Submit handler
    form.addEventListener("submit", handleSubmit);

    // Abrir modal (si ya tienes otro script que lo abre, esto no estorba)
    btnOpen?.addEventListener("click", () => {
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      showFeedback("");
    });

    // Cerrar modal (overlay y botones)
    $$(SEL.close, modal).forEach((b) =>
      b.addEventListener("click", () => {
        closeMainModal();
        showFeedback("");
      }),
    );

    log("Canal 2 listo (sin refresh; mini modal + reflect en tabla).");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
