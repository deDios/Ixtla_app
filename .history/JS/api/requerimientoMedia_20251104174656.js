// /JS/requerimientoMedia.js
(function () {
  "use strict";

  /* ================== Config & Helpers ================== */

  const ENDPOINTS = {
    MEDIA_GET: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/ixtla01_c_requerimiento_img.php",
  };

  const hasRV = !!window._rvHelpers;
  const $  = hasRV ? window._rvHelpers.$  : (s, r=document) => r.querySelector(s);
  const $$ = hasRV ? window._rvHelpers.$$ : (s, r=document) => Array.from(r.querySelectorAll(s));
  const toast = hasRV ? window._rvHelpers.toast : (m,t="info") => console.log("[toast]", t, m);

  const log  = (...a) => console.log("[Media]", ...a);
  const warn = (...a) => console.warn("[Media]", ...a);
  const err  = (...a) => console.error("[Media]", ...a);

  function group(label, fn) {
    console.groupCollapsed(label);
    try { fn(); } finally { console.groupEnd(); }
  }

  async function postJSON(url, body) {
    console.groupCollapsed("[HTTP][MEDIA] POST", url);
    console.log("→ payload:", body);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
      const txt = await res.text();
      let json; try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
      console.log("← status:", res.status, "json:", json);
      console.groupEnd();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json;
    } catch (e) {
      console.groupEnd();
      throw e;
    }
  }

  // Normaliza cualquier forma de item de media que venga del backend
  function normalizeMediaItem(row = {}) {
    const id     = row.id ?? row.media_id ?? row.id_media ?? row.id_imagen ?? row.imagen_id ?? null;
    const name   = row.nombre ?? row.titulo ?? row.name ?? row.file_name ?? row.filename ?? "Archivo";
    const url    = row.url ?? row.src ?? row.path ?? row.file_url ?? row.ruta ?? "";
    const quien  = row.quien ?? row.quien_cargo ?? row.subido_por ?? row.usuario ?? row.created_by_name ?? row.created_by ?? "—";
    const fecha  = row.fecha ?? row.created_at ?? row.updated_at ?? row.fecha_carga ?? "";
    const tipo   = row.tipo ?? row.mime ?? guessType(url);

    return {
      id, nombre: String(name).trim() || "Archivo", url: String(url).trim(),
      quien: String(quien).trim(),
      fecha: String(fecha).trim(),
      tipo:  String(tipo).trim(),
      _raw: row
    };
  }

  function guessType(u = "") {
    const m = String(u).toLowerCase().match(/\.(\w+)(?:\?|#|$)/);
    const ext = m ? m[1] : "";
    if (["jpg","jpeg","png","gif","webp","bmp"].includes(ext)) return "img";
    if (["mp4","webm","mov","m4v"].includes(ext)) return "video";
    if (["pdf"].includes(ext)) return "pdf";
    return ext || "desconocido";
  }

  /* ================== DOM: Evidencias ================== */

  function findEvidenciasTable() {
    const acc = document.querySelector('[data-acc="evidencias"]') ||
                document.querySelector('.exp-accordion--evidencias') ||
                document.querySelector('#evidencias-accordion');
    return acc ? acc.querySelector('.exp-table') : null;
  }

  function clearDynamicRows(table) {
    if (!table) return;
    const rows = $$('.exp-row', table);
    group("[Media] limpiar filas dinámicas", () => {
      rows.forEach(r => {
        // Si quieres conservar alguna dummy, márcala con data-static="true"
        if (!r.hasAttribute("data-static")) {
          r.remove();
        }
      });
    });
  }

  function iconForType(tipo) {
    const map = {
      img: "/ASSETS/filetypes/img.png",
      video: "/ASSETS/filetypes/video.png",
      pdf: "/ASSETS/filetypes/pdf.png",
      desconocido: "/ASSETS/filetypes/file.png"
    };
    return map[tipo] || map.desconocido;
  }

  function addMediaRow(table, item) {
    if (!table) return;
    const a = document.createElement("a");
    a.className = "exp-row";
    a.href = item.url || "#";
    a.setAttribute("data-src", item.url || "");
    a.setAttribute("data-title", item.nombre || "Archivo");
    a.setAttribute("data-who", item.quien || "");
    a.setAttribute("data-date", item.fecha || "");
    a.setAttribute("data-tipo", item.tipo || "");

    a.innerHTML = `
      <div class="file">
        <img class="ico" src="${iconForType(item.tipo)}" alt="">
        <span>${item.nombre || "Archivo"}</span>
      </div>
      <div class="who">${item.quien || "—"}</div>
      <div class="date">${item.fecha || "—"}</div>
    `;
    table.appendChild(a);
  }

  function renderMediaList(items = []) {
    const table = findEvidenciasTable();
    if (!table) { warn("No se encontró la tabla de evidencias"); return; }

    clearDynamicRows(table);

    if (!items.length) {
      // deja una fila de “vacío”
      const empty = document.createElement("div");
      empty.className = "exp-row";
      empty.innerHTML = `
        <span>Sin evidencias</span>
        <div class="who">—</div>
        <div class="date">—</div>`;
      table.appendChild(empty);
      return;
    }

    items.forEach(it => addMediaRow(table, it));
  }

  /* ================== Modal de Preview ================== */

  function ensureMediaModalExists() {
    if (document.getElementById("modal-media")) return;

    const html = `
      <div id="modal-media" class="modal-overlay" aria-hidden="true">
        <div class="modal-content">
          <button class="modal-close" aria-label="Cerrar">&times;</button>
          <div class="media-head" style="margin-bottom:10px;">
            <h3 id="media-title" style="margin:0; font-size:1.05rem; font-weight:700;"></h3>
            <div id="media-meta" style="color:#6b7280; font-size:.85rem; margin-top:4px;"></div>
          </div>
          <div class="media-body">
            <img id="media-img" alt="" style="max-width:100%; height:auto; display:block; margin:0 auto; border-radius:8px;">
          </div>
        </div>
      </div>`;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);
  }

  function openMediaModal({ src, title = "", who = "", date = "" } = {}) {
    ensureMediaModalExists();

    const overlay = document.getElementById("modal-media");
    const img = document.getElementById("media-img");
    const ttl = document.getElementById("media-title");
    const meta = document.getElementById("media-meta");
    const closeBtn = overlay?.querySelector(".modal-close");

    if (!overlay || !img) return;
    if (!src) { toast("No hay archivo para previsualizar.", "warning"); return; }

    img.src = src;
    img.alt = title || "Evidencia";
    ttl.textContent = title || "Evidencia";
    meta.textContent = [who, date].filter(Boolean).join(" • ");

    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");

    const close = () => {
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("me-modal-open");
      img.src = "";
      overlay.removeEventListener("click", onBackdrop);
      closeBtn?.removeEventListener("click", close);
      document.removeEventListener("keydown", onEsc);
    };
    const onBackdrop = (e) => { if (e.target === overlay) close(); };
    const onEsc = (e) => { if (e.key === "Escape") close(); };

    overlay.addEventListener("click", onBackdrop);
    closeBtn?.addEventListener("click", close);
    document.addEventListener("keydown", onEsc);
  }

  function bindEvidenciasPreview() {
    const table = findEvidenciasTable();
    if (!table) return;

    // Evitar múltiples bindings
    if (table.__mediaBound) return;
    table.__mediaBound = true;

    table.addEventListener("click", (e) => {
      const row = e.target.closest(".exp-row");
      if (!row) return;
      e.preventDefault();

      const src   = row.getAttribute("data-src") || row.getAttribute("href") || "";
      const title = row.getAttribute("data-title") || row.querySelector(".file span")?.textContent?.trim() || "Evidencia";
      const who   = row.getAttribute("data-who")   || row.querySelector(".who")?.textContent?.trim() || "";
      const date  = row.getAttribute("data-date")  || row.querySelector(".date")?.textContent?.trim() || "";

      group("[Media] abrir modal", () => {
        console.log("src:", src);
        console.log("title:", title, "who:", who, "date:", date);
      });

      // Si no es imagen, aún así lo intentamos como <img>; puedes validar por tipo:
      // if (!/\.(png|jpe?g|gif|webp|bmp)$/i.test(src)) return toast("No es una imagen.", "warning");
      openMediaModal({ src, title, who, date });
    });
  }

  /* ================== API: cargar media del requerimiento ================== */

  async function fetchMedia(requerimiento_id) {
    const payload = {
      requerimiento_id: Number(requerimiento_id)
      // Si el PHP espera otros nombres (p.ej. id), podrías incluirlos también:
      // id: Number(requerimiento_id)
    };
    const res = await postJSON(ENDPOINTS.MEDIA_GET, payload);

    // Formatos posibles:
    // { ok:true, data:[...] } | { data:{ rows:[...] } } | [ ... ] | { items:[...] } | ...
    const rawList = Array.isArray(res) ? res
                  : Array.isArray(res?.data) ? res.data
                  : Array.isArray(res?.items) ? res.items
                  : Array.isArray(res?.rows) ? res.rows
                  : Array.isArray(res?.data?.rows) ? res.data.rows
                  : [];

    group("[Media] respuesta cruda normalizada", () => {
      console.log("rawList:", rawList);
    });

    const list = rawList.map(normalizeMediaItem);

    group("[Media] lista normalizada", () => {
      console.table(list);
    });

    return list;
  }

  async function loadMediaForCurrentReq() {
    const params = new URL(window.location.href).searchParams;
    const reqId = params.get("id");
    group("[Media] boot", () => {
      console.log("URL:", window.location.href, "reqId:", reqId);
    });

    if (!reqId) {
      warn("Sin ?id= en URL; no se consultará media.");
      return;
    }

    try {
      const items = await fetchMedia(reqId);
      renderMediaList(items);
    } catch (e) {
      err("Error consultando media:", e);
      toast("No se pudieron cargar evidencias.", "danger");
      renderMediaList([]);
    }
  }

  /* ================== Boot ================== */

  function boot() {
    // Vincula preview de evidencias (ya existan filas dummy o luego se llenen por API)
    bindEvidenciasPreview();

    // Intenta cargar media del req actual
    loadMediaForCurrentReq();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
