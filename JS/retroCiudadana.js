// JS/retroCiudadana.js
// URL ejemplo:  https://ixtla-app.com/VIEWS/retroCiudadana.php
(function () {
  "use strict";

  const TAG = "[RetroCiudadana]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err = (...a) => console.error(TAG, ...a);

  const ENDPOINTS = {
    REQ_GET: "https://ixtla-app.com/db/WEB/ixtla01_c_requerimiento.php",
    RETRO_LIST: "https://ixtla-app.com/db/WEB/ixtla01_c_retro.php",
    RETRO_UPDATE: "https://ixtla-app.com/db/WEB/ixtla01_u_retro.php",
  };

  const STATUS_RETRO = {
    CADUCADO: 0,
    NO_CONTESTADO: 1,
    CONTESTADO: 2,
    INHABILITADO: 3,
  };

  const state = {
    folio: "",
    req: null,
    retro: null, // siempre la retro mas reciente solo por si acaso
    locked: true,
    sending: false,
  };

  const els = {
    title: document.getElementById("retro-title"),
    comentario: document.getElementById("retro-comentario"),
    depto: document.getElementById("retro-depto"),
    send: document.getElementById("retro-send"),
    overlay: document.getElementById("retro-overlay"),
    mini: document.getElementById("retro-mini"),
    miniMsg: document.getElementById("retro-mini-msg"),
    finish: document.getElementById("retro-finish"),
    radios: Array.from(document.querySelectorAll('input[name="rate"]')),
    rateItems: Array.from(document.querySelectorAll(".rate-item")),
  };

  function toast(msg, type = "info", ms = 4500) {
    if (typeof window.gcToast === "function") {
      return window.gcToast(String(msg || ""), type, ms);
    }
    log("[toast]", type, msg);
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function postJSON(url, body = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const txt = await res.text();
    let json = null;
    try {
      json = JSON.parse(txt);
    } catch {
      json = { raw: txt };
    }

    if (!res.ok) {
      throw new Error(json?.error || `HTTP ${res.status}`);
    }

    return json ?? {};
  }

  async function getJSON(url, params = {}) {
    const u = new URL(url);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      u.searchParams.set(k, String(v));
    });

    const res = await fetch(u.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    });

    const txt = await res.text();
    let json = null;
    try {
      json = JSON.parse(txt);
    } catch {
      json = { raw: txt };
    }

    if (!res.ok) {
      throw new Error(json?.error || `HTTP ${res.status}`);
    }

    return json ?? {};
  }

  async function putJSON(url, body = {}) {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const txt = await res.text();
    let json = null;
    try {
      json = JSON.parse(txt);
    } catch {
      json = { raw: txt };
    }

    if (!res.ok) {
      throw new Error(json?.error || `HTTP ${res.status}`);
    }

    return json ?? {};
  }

  function getSelectedRate() {
    const checked = els.radios.find((r) => r.checked);
    return checked ? Number(checked.value) : 0;
  }

  function setDisabledUI(disabled) {
    state.locked = Boolean(disabled);

    els.radios.forEach((r) => {
      r.disabled = state.locked || state.sending;
    });

    if (els.comentario) {
      els.comentario.readOnly = state.locked || state.sending;
    }

    syncSendButton();
  }

  function syncSendButton() {
    if (!els.send) return;

    const canSend =
      !state.locked &&
      !state.sending &&
      !!state.retro &&
      Number(state.retro.status) === STATUS_RETRO.NO_CONTESTADO &&
      getSelectedRate() >= 1 &&
      getSelectedRate() <= 4;

    els.send.disabled = !canSend;
  }

  function setRateVisual() {
    els.rateItems.forEach((item) => item.classList.remove("is-selected"));

    const checked = els.radios.find((r) => r.checked);
    if (!checked) return;

    const label = checked.closest(".rate-item");
    if (label) label.classList.add("is-selected");
  }

  function showMini(message, title = "Aviso") {
    if (els.miniMsg) els.miniMsg.textContent = message || "";
    const titleEl = document.getElementById("retro-mini-title");
    if (titleEl) titleEl.textContent = title || "Aviso";

    if (els.overlay) els.overlay.hidden = false;
    if (els.mini) els.mini.hidden = false;
  }

  function hideMini() {
    if (els.overlay) els.overlay.hidden = true;
    if (els.mini) els.mini.hidden = true;
  }

  function finishFlow() {
    hideMini();

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "/index.php";
  }

  function setDepto(nombre) {
    if (!els.depto) return;
    els.depto.value = String(nombre || "—");
  }

  function setHeaderFromReq(req) {
    if (!req) return;
    if (els.title && req?.folio) {
      //els.title.textContent = `Retroalimentación ${req.folio}`;
      els.title.textContent = `Retroalimentación`;
    }
    setDepto(req?.departamento_nombre || "—");
  }

  function getStatusMessage(status) {
    switch (Number(status)) {
      case STATUS_RETRO.NO_CONTESTADO:
        return "";
      case STATUS_RETRO.CONTESTADO:
        return "Esta retroalimentación ya fue contestada anteriormente.";
      case STATUS_RETRO.INHABILITADO:
        return "Esta ya no está disponible.";
      case STATUS_RETRO.CADUCADO:
        return "Esta retroalimentación ya caducó y no se puede responder.";
      default:
        return "Esta retroalimentación no está disponible actualmente.";
    }
  }

  function lockAndExplain(status) {
    setDisabledUI(true);

    const msg = getStatusMessage(status);
    if (msg) {
      showMini(msg, "Retroalimentación");
    }
  }

  async function fetchReqByFolio(folio) {
    const res = await postJSON(ENDPOINTS.REQ_GET, { folio: String(folio || "") });

    if (!res || res.ok !== true || !res.data) {
      throw new Error(res?.error || "No se encontró el requerimiento.");
    }

    return res.data;
  }

  async function fetchLatestRetroByReqId(requerimientoId) {
    const res = await getJSON(ENDPOINTS.RETRO_LIST, {
      requerimiento_id: Number(requerimientoId),
      page: 1,
      page_size: 50,
    });

    const rows = Array.isArray(res?.data) ? res.data : [];
    return rows.length ? rows[0] : null; // c_retro ya trae id DESC
  }

  function buildFinalComment(rawText, req) {
    const txt = String(rawText || "").trim();
    if (txt) return txt;
    return `Retroalimentación ciudadana para ${req?.folio || "requerimiento"}.`;
  }

  async function submitRetro() {
    if (state.sending) return;
    if (!state.retro || Number(state.retro.status) !== STATUS_RETRO.NO_CONTESTADO) {
      showMini(
        getStatusMessage(state.retro?.status),
        "Retroalimentación"
      );
      setDisabledUI(true);
      return;
    }

    const calificacion = getSelectedRate();
    if (!(calificacion >= 1 && calificacion <= 4)) {
      toast("Selecciona una calificación antes de enviar.", "warning");
      return;
    }

    const comentario = buildFinalComment(els.comentario?.value || "", state.req);

    state.sending = true;
    syncSendButton();

    const payload = {
      id: Number(state.retro.id),
      status: STATUS_RETRO.CONTESTADO,
      comentario,
      calificacion,
      link: state.retro.link || null,
    };

    log("submitRetro() payload:", payload);

    try {
      const res = await putJSON(ENDPOINTS.RETRO_UPDATE, payload);

      if (!res || res.ok !== true) {
        throw new Error(res?.error || "No se pudo guardar la retroalimentación.");
      }

      state.retro = {
        ...state.retro,
        status: STATUS_RETRO.CONTESTADO,
        comentario,
        calificacion,
      };

      setDisabledUI(true);
      showMini("Tu retroalimentación fue registrada correctamente.", "Muchas gracias");
    } catch (e) {
      err("submitRetro() error:", e);
      toast(e?.message || "Ocurrió un error al enviar la retroalimentación.", "danger");
      state.sending = false;
      syncSendButton();
      return;
    }

    state.sending = false;
    syncSendButton();
  }

  function bindEvents() {
    els.radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        setRateVisual();
        syncSendButton();
      });
    });

    if (els.comentario) {
      els.comentario.addEventListener("input", () => {
        syncSendButton();
      });
    }

    if (els.send) {
      els.send.addEventListener("click", submitRetro);
    }

    if (els.finish) {
      els.finish.addEventListener("click", finishFlow);
    }

    if (els.overlay) {
      els.overlay.addEventListener("click", () => {
        // intencionalmente no cerramos el mini modal por overlay
      });
    }
  }

  async function boot() {
    bindEvents();
    setRateVisual();
    setDisabledUI(true);

    const folio = String(qs("folio") || "").trim();
    state.folio = folio;

    if (!folio) {
      showMini("No se encontró el folio del requerimiento en la URL.", "Error");
      return;
    }

    try {
      const req = await fetchReqByFolio(folio);
      state.req = req;
      setHeaderFromReq(req);

      const retro = await fetchLatestRetroByReqId(req.id);

      if (!retro) {
        showMini("No existe una retroalimentación disponible para este requerimiento.", "Retroalimentación");
        return;
      }

      state.retro = retro;
      log("boot() req:", req);
      log("boot() retro más reciente:", retro);

      const st = Number(retro.status);

      if (st !== STATUS_RETRO.NO_CONTESTADO) {
        lockAndExplain(st);
        return;
      }

      setDisabledUI(false);
      syncSendButton();
    } catch (e) {
      err("boot() error:", e);
      showMini(
        e?.message || "No fue posible cargar la retroalimentación del requerimiento.",
        "Error"
      );
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();