(() => {/* Config */
  const ENDPOINT = "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/ixtla01_c_requerimiento.php", FETCH_TIMEOUT = 12e3, IX_DEBUG_TRACK = !0;
  function getDepIdFromURL() { try { const s = new URLSearchParams(location.search), n = Number(s.get("depId")); return Number.isInteger(n) && n > 0 ? n : null } catch { return null } }
  const DEPARTAMENTO_ID = getDepIdFromURL();
  /* Estado / textos */
  const NUM_STATUS_MAP = { 0: "solicitud", 1: "revision", 2: "asignacion", 3: "proceso", 4: "pausado", 5: "cancelado", 6: "finalizado" },
    MESSAGES = { solicitud: "Tu trámite fue enviado y está registrado en el sistema.", revision: "Se revisa la información y evidencias proporcionadas.", asignacion: "Se asigna el caso al área o personal responsable.", proceso: "El equipo trabaja en la atención del requerimiento.", pausado: "Tu requerimiento está Pausado.", cancelado: "Tu requerimiento está Cancelado.", finalizado: "El requerimiento fue resuelto y el trámite ha concluido." };
  /* Utils */
  const $ = (r, s) => r?.querySelector?.(s) || null, $$ = (r, s) => Array.from(r?.querySelectorAll?.(s) || []),
    log = (...a) => { IX_DEBUG_TRACK && console.log("[IX][track]", ...a) }, warn = (...a) => { IX_DEBUG_TRACK && console.warn("[IX][track]", ...a) }, err = (...a) => { IX_DEBUG_TRACK && console.error("[IX][track]", ...a) };
  function withTimeout(pf, ms = FETCH_TIMEOUT) { const ctrl = new AbortController(), t0 = performance.now(), to = setTimeout(() => ctrl.abort(), ms); return pf(ctrl.signal).then(r => { clearTimeout(to); r.__ms = Math.round(performance.now() - t0); return r }).catch(e => { clearTimeout(to); e.__ms = Math.round(performance.now() - t0); throw e }) }
  function normalizeFolio(v) { const raw = String(v || "").toUpperCase().replace(/\s+/g, ""), m = raw.match(/([A-Z]+)?-?(\d{1,})/); if (!m) return ""; const d = m[2].replace(/\D/g, "").slice(0, 10).padStart(10, "0"); return `REQ-${d}` }
  function formatDateTime(s) { if (!s) return { date: "—", time: "—" }; const iso = s.includes("T") ? s : s.replace(" ", "T"), d = new Date(iso); if (isNaN(d)) return { date: "—", time: "—" }; const M = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"], dd = String(d.getDate()).padStart(2, "0"), date = `${dd} de ${M[d.getMonth()]} ${d.getFullYear()}`; let h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0"); const ap = h >= 12 ? "pm" : "am"; h = ((h + 11) % 12) + 1; return { date, time: `${h}:${m} ${ap}` } }
  function setText(el, val) { if (el) el.textContent = val ?? "—" }
  /* DOM Refs */
  const root = document.getElementById("tramites-busqueda"); if (!root) return;
  const form = $("#tramites-busqueda", "#form-tramite") || root.querySelector("#form-tramite"),
    inpFolio = root.querySelector("#folio"), btnBuscar = root.querySelector("#btn-buscar"),
    pEmpty = root.querySelector("#ix-track-empty"), pLoad = root.querySelector("#ix-track-loading"),
    pError = root.querySelector("#ix-track-error"), pResult = root.querySelector("#ix-track-result"),
    elFolio = root.querySelector("#ix-meta-folio"), elReq = root.querySelector("#ix-meta-req"),
    elDir = root.querySelector("#ix-meta-dir"), elSol = root.querySelector("#ix-meta-sol"),
    elDesc = root.querySelector("#ix-meta-desc"), elDate = root.querySelector("#ix-meta-date"),
    elTime = root.querySelector("#ix-meta-time"),
    steps = root.querySelectorAll(".ix-stepper .ix-step"),
    popBtns = root.querySelectorAll(".ix-stepper .ix-stepbtn"),
    popovers = root.querySelectorAll(".ix-stepper .ix-pop"),
    stepDescText = root.querySelector(".ix-stepdesc-text");
  /* UI */
  function showPanel(w) { [pEmpty, pLoad, pError, pResult].forEach(p => p?.classList.remove("is-visible")); if (w) { w.hidden = !1; w.classList.add("is-visible") } }
  function setLoading(on) { root.classList.toggle("is-loading", !!on); btnBuscar && (btnBuscar.disabled = !!on); inpFolio && (inpFolio.disabled = !!on) }
  function setStepsActive(stepIndex, messageKey) { steps.forEach(li => { const n = Number(li.getAttribute("data-step") || "0"); li.classList.remove("done", "current", "pending"); li.removeAttribute("aria-current"); n < stepIndex ? li.classList.add("done") : n === stepIndex ? (li.classList.add("current"), li.setAttribute("aria-current", "step")) : li.classList.add("pending") }); if (stepDescText) stepDescText.textContent = MESSAGES[messageKey] || "—" }
  function closeAllPopovers(exceptId = null) { popBtns.forEach(b => b.setAttribute("aria-expanded", "false")); popovers.forEach(p => { if (exceptId && p.id === exceptId) return; p.hidden = !0 }) }
  function handleStepBtnClick(e) { const btn = e.currentTarget, id = btn.getAttribute("aria-controls"), pop = root.querySelector(`#${id}`); if (!pop) return; const willOpen = pop.hidden; closeAllPopovers(willOpen ? id : null); btn.setAttribute("aria-expanded", String(willOpen)); pop.hidden = !willOpen }
  function handleDocClick(e) { if (!root.contains(e.target)) return closeAllPopovers(); const isBtn = e.target.closest?.(".ix-stepbtn"), isPop = e.target.closest?.(".ix-pop"); !isBtn && !isPop && closeAllPopovers() }
  function handleEsc(e) { "Escape" === e.key && closeAllPopovers() }
  /* Data logic */
  function statusKeyFromRow(row) {
    if (row?.cerrado_en) return "finalizado";
    const raw = row?.estatus;
    if (raw === null || raw === undefined) return "proceso";
    if (typeof raw === "number") return NUM_STATUS_MAP[raw] || "proceso";
    if (typeof raw === "string") {
      const k = raw.trim().toLowerCase();
      if (["solicitud", "revision", "asignacion", "proceso", "pausado", "cancelado", "finalizado"].includes(k)) return k;
      if (k.includes("final")) return "finalizado";
      if (k.includes("paus")) return "pausado";
      if (k.includes("cancel")) return "cancelado";
      if (k.includes("rev")) return "revision";
      if (k.includes("asign")) return "asignacion";
      if (k.includes("sol")) return "solicitud";
      if (k.includes("proc")) return "proceso";
      return "proceso";
    }
    return "proceso";
  }
  /* Map a índice del stepper (sin badges: pausado/cancelado → proceso) */
  function stepIndexFromKey(key) {
    switch (key) {
      case "solicitud": return 0;
      case "revision": return 1;
      case "asignacion": return 2;
      case "finalizado": return 6;
      case "pausado":
      case "cancelado":
      case "proceso":
      default: return 3; // se marcan en "En proceso"
    }
  }
  /* Render */
  function renderResult(row) {
    setText(elFolio, row.folio || "—");
    setText(elReq, row.tramite_nombre || row.asunto || "—");
    const dir = [row.contacto_calle, row.contacto_colonia, row.contacto_cp].filter(Boolean).join(", ");
    setText(elDir, dir || "—");
    setText(elSol, row.contacto_nombre || "—");
    setText(elDesc, row.descripcion || "—");
    const { date, time } = formatDateTime(row.created_at); setText(elDate, date); setText(elTime, time);
    const key = statusKeyFromRow(row), step = stepIndexFromKey(key);
    setStepsActive(step, key);
    showPanel(pResult);
  }
  function renderNotFound() { showPanel(pError) }
  /* Fetch */
  async function fetchJSON(body, signal) {
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(body), signal });
    const http = res.status; if (!res.ok) throw new Error(`HTTP ${http}`);
    const json = await res.json(); return { http, json };
  }
  const queryByFolio = folio => withTimeout(sig => fetchJSON({ folio }, sig)),
    queryList = (depId, opts = {}) => { const payload = {}; Number.isInteger(depId) && (payload.departamento_id = depId); opts.all === !0 ? payload.all = !0 : (payload.page = opts.page || 1, payload.per_page = opts.per_page || 50); return withTimeout(sig => fetchJSON(payload, sig)) };
  /* Submit */
  async function handleSubmit(e) {
    e?.preventDefault?.(); closeAllPopovers();
    const folioNorm = normalizeFolio(inpFolio?.value || ""); if (!folioNorm) { renderNotFound(); return }
    setLoading(!0); showPanel(pLoad); log("Buscar folio:", folioNorm, "depId:", DEPARTAMENTO_ID ?? "(todos)");
    try {
      const r1 = await queryByFolio(folioNorm);
      log("Resp folio:", r1.http, r1.json?.ok ? "ok" : r1.json?.error, r1?.__ms ?? "?ms");
      if (r1.json?.ok && r1.json?.data) { renderResult(r1.json.data); setLoading(!1); return; }
    } catch (ex) { warn("Fallo puntual por folio, voy a listado:", ex?.message || ex); }
    try {
      const r2 = await queryList(DEPARTAMENTO_ID, { all: !0 }); // <-- SIN CACHÉ, siempre al servidor
      log("Resp listado:", r2.http, r2.json?.ok ? "ok" : r2.json?.error, r2?.__ms ?? "?ms");
      if (!r2.json?.ok || !Array.isArray(r2.json?.data)) throw new Error("Respuesta de listado inválida");
      const list = r2.json.data;
      const target = list.find(row => String(row?.folio || "").toUpperCase() === folioNorm.toUpperCase());
      target ? renderResult(target) : renderNotFound();
    } catch (ex) { err("Error en listado:", ex?.message || ex); renderNotFound(); }
    finally { setLoading(!1); }
  }
  /* Events */
  form?.addEventListener("submit", handleSubmit);
  popBtns.forEach(btn => btn.addEventListener("click", handleStepBtnClick));
  $$(root, ".ix-pop-close").forEach(b => b.addEventListener("click", () => closeAllPopovers()));
  document.addEventListener("click", handleDocClick);
  document.addEventListener("keydown", handleEsc);
  /* ?folio= autoload */
  try { const sp = new URLSearchParams(location.search), qf = sp.get("folio"); if (qf) { inpFolio.value = qf; handleSubmit() } } catch { }

  inpTel.addEventListener("keydown", (e) => {
  const allow = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End"];
  if (/^\d$/.test(e.key) || allow.includes(e.key)) return;
  // permite pegar con Ctrl/Cmd+V
  if ((e.ctrlKey || e.metaKey) && ["v","c","x","a"].includes(e.key.toLowerCase())) return;
  e.preventDefault();
});
})();

