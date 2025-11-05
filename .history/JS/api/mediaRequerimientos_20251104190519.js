// /JS/mediaRequerimientos.js
import { listMedia } from "/JS/api/media.js";

(() => {
  "use strict";

  /* ================= Helpers base ================= */
  const hasRV = !!window._rvHelpers;
  const $  = hasRV ? window._rvHelpers.$  : (s, r=document) => r.querySelector(s);
  const $$ = hasRV ? window._rvHelpers.$$ : (s, r=document) => Array.from(r.querySelectorAll(s));
  const toast = hasRV ? window._rvHelpers.toast : (m,t="info") => console.log("[toast]", t, m);
  const log   = (...a) => console.log("[MediaGlue]", ...a);
  const warn  = (...a) => console.warn("[MediaGlue]", ...a);

  // Lee respuesta “a prueba de HTML”
  async function fetchJsonSafe(input, init) {
    const res = await fetch(input, init);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { res, json, text };
  }

  /* ================= DOM: tabla Evidencias ================= */
  function findEvidenciasTable() {
    const acc = document.querySelector('[data-acc="evidencias"]')
             || document.querySelector('.exp-accordion--evidencias')
             || document.querySelector('#evidencias-accordion');
    return acc ? acc.querySelector('.exp-table') : null;
  }

  function iconFor(url="") {
    const ext = (url.split("?")[0].match(/\.([a-z0-9]+)$/i)||[])[1]?.toLowerCase() || "";
    if (["jpg","jpeg","png","gif","webp","bmp","heic","heif"].includes(ext)) return "/ASSETS/filetypes/img.png";
    if (["mp4","webm","mov","m4v"].includes(ext)) return "/ASSETS/filetypes/video.png";
    if (ext === "pdf") return "/ASSETS/filetypes/pdf.png";
    return "/ASSETS/filetypes/file.png";
  }

  function clearDynamicRows(table) {
    if (!table) return;
    $$(".exp-row", table).forEach(r => { if (!r.hasAttribute("data-static")) r.remove(); });
  }

  function addRow(table, item) {
    const a = document.createElement("a");
    a.className = "exp-row";
    a.href  = item.url || "#";
    a.target = "_blank";
    a.setAttribute("data-src",   item.url || "");
    a.setAttribute("data-title", item.nombre || "Archivo");
    a.setAttribute("data-who",   item.quien  || "—");
    a.setAttribute("data-date",  item.fecha  || "—");

    a.innerHTML = `
      <div class="file">
        <img class="ico" src="${iconFor(item.url)}" alt="">
        <span>${item.nombre || "Archivo"}</span>
      </div>
      <div class="who">${item.quien || "—"}</div>
      <div class="date">${item.fecha || "—"}</div>
    `;
    table.appendChild(a);
  }

  function renderList(list=[]) {
    const table = findEvidenciasTable();
    if (!table) { warn("No se encontró la tabla de evidencias"); return; }
    clearDynamicRows(table);

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "exp-row";
      empty.innerHTML = `<span>Sin evidencias</span><div class="who">—</div><div class="date">—</div>`;
      table.appendChild(empty);
      return;
    }
    list.forEach(addRow.bind(null, table));
  }

  /* ================= Normalizador del endpoint ================= */
  function normalizeItem(r = {}) {
    // Soporta { nombre|name|titulo|filename, url|src|path, quien|subido_por|created_by(_name), fecha|created_at|updated_at }
    const nombre = r.nombre ?? r.name ?? r.titulo ?? r.filename ?? "Archivo";
    const url    = r.url ?? r.src ?? r.path ?? "";
    const quien  = r.quien ?? r.quien_cargo ?? r.subido_por ?? r.created_by_name ?? r.created_by ?? "—";
    const fecha  = r.fecha ?? r.created_at ?? r.updated_at ?? "";
    return { nombre: String(nombre).trim(), url: String(url).trim(), quien: String(quien).trim(), fecha: String(fecha).trim(), _raw: r };
  }

  /* ================= Modal de preview (opcional) ================= */
  function ensurePreviewModal() {
    if (document.getElementById("modal-media")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
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
    document.body.appendChild(wrap.firstElementChild);
  }

  function openPreview({ src, title, who, date }) {
    ensurePreviewModal();
    const overlay = document.getElementById("modal-media");
    const img = document.getElementById("media-img");
    const ttl = document.getElementById("media-title");
    const meta= document.getElementById("media-meta");
    const closeBtn = overlay.querySelector(".modal-close");

    img.src = src; ttl.textContent = title || "Evidencia";
    meta.textContent = [who, date].filter(Boolean).join(" • ");

    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("me-modal-open");

    const close = () => {
      overlay.setAttribute("aria-hidden","true");
      document.body.classList.remove("me-modal-open");
      img.src = "";
      overlay.removeEventListener("click", onBackdrop);
      closeBtn.removeEventListener("click", close);
      document.removeEventListener("keydown", onEsc);
    };
    const onBackdrop = (e)=>{ if (e.target === overlay) close(); };
    const onEsc = (e)=>{ if (e.key === "Escape") close(); };

    overlay.addEventListener("click", onBackdrop);
    closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", onEsc);
  }

  function bindPreviewClicks() {
    const table = findEvidenciasTable();
    if (!table || table.__previewBound) return;
    table.__previewBound = true;

    table.addEventListener("click", (e) => {
      const row = e.target.closest(".exp-row");
      if (!row) return;
      const href = row.getAttribute("data-src") || row.getAttribute("href") || "";
      if (!/\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(href)) {
        // no es imagen → deja que abra en otra pestaña
        return;
      }
      e.preventDefault();
      openPreview({
        src: href,
        title: row.getAttribute("data-title") || row.querySelector(".file span")?.textContent || "Evidencia",
        who:   row.getAttribute("data-who")   || row.querySelector(".who")?.textContent || "",
        date:  row.getAttribute("data-date")  || row.querySelector(".date")?.textContent || "",
      });
    });
  }

  /* ================= Resolver folio por id (desde URL) ================= */
  async function fetchFolioById(id) {
    const url = "/db/WEB/ixtla01_c_requerimiento.php";
    const { res, json, text } = await fetchJsonSafe(url, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify({ id: Number(id) || id })
    });

    if (!res.ok) {
      console.warn("[MediaGlue] fetchFolioById HTTP", res.status);
      return null;
    }
    const row =
      (Array.isArray(json?.data) && json.data[0]) ||
      (Array.isArray(json?.data?.rows) && json.data.rows[0]) ||
      (Array.isArray(json) && json[0]) ||
      (json?.data && typeof json.data === "object" ? json.data : null) ||
      null;

    const folio = row?.folio || row?.FOLIO || null;
    if (!folio) console.warn("[MediaGlue] No se encontró folio en respuesta:", json ?? text?.slice(0,160));
    return folio;
  }

  /* ================= Carga por FOLIO ================= */
  async function loadByFolio(folio) {
    console.groupCollapsed("[MediaGlue] listMedia()");
    console.log("folio:", folio);
    try {
      const res = await listMedia(folio, null, 1, 100);
      console.log("API raw:", res);
      const rawList = Array.isArray(res) ? res
                  : Array.isArray(res?.data) ? res.data
                  : Array.isArray(res?.items) ? res.items
                  : Array.isArray(res?.rows) ? res.rows
                  : Array.isArray(res?.data?.rows) ? res.data.rows
                  : [];
      console.log("rawList:", rawList);
      const list = rawList.map(normalizeItem);
      console.table(list);
      renderList(list);
    } catch (e) {
      console.error("Error listando media:", e);
      toast("No se pudieron cargar evidencias.", "danger");
      renderList([]);
    } finally {
      console.groupEnd();
    }
  }

  /* ================= Boot ================= */
  async function boot() {
    // 1) intenta fuentes rápidas (data-attrs / variable global)
    let folio =
      document.querySelector('[data-folio]')?.getAttribute('data-folio') ||
      (window.__REQ__ && window.__REQ__.folio) ||
      document.querySelector('[data-req-folio]')?.getAttribute('data-req-folio') ||
      null;

    // 2) si no hay folio, intenta derivarlo con ?id=###
    if (!folio) {
      const id = new URLSearchParams(location.search).get("id");
      if (id) {
        try {
          folio = await fetchFolioById(id);
          // opcional: cachearlo en el DOM para otros módulos
          if (folio) {
            (document.documentElement || document.body).setAttribute("data-folio", folio);
          }
        } catch (e) {
          console.warn("[MediaGlue] Error resolviendo folio por id:", e?.message || e);
        }
      }
    }

    // 3) (opcional) regex si el folio está impreso en el título
    if (!folio) {
      const m = (document.querySelector('.exp-title h1')?.innerText || "").match(/\bREQ-\d{6,}\b/i);
      if (m) folio = m[0];
    }

    if (!folio) {
      warn("No encontré folio (REQ-##########). Si es posible, injéctalo como data-folio en el HTML.");
      bindPreviewClicks(); // aún permite preview de filas estáticas
      return;
    }

    bindPreviewClicks();
    await loadByFolio(folio);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { boot(); }, { once:true });
  } else {
    boot();
  }
})();
