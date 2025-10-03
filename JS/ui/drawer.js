// /JS/ui/drawer.js  
import { updateRequerimiento } from "/JS/api/requerimientos.js";
import { listMedia, uploadMedia } from "/JS/api/media.js";

/*  Constantes de UI  */
const ESTATUS = {
  0: { clave: "solicitud", nombre: "Solicitud" },
  1: { clave: "revision", nombre: "Revisión" },
  2: { clave: "asignacion", nombre: "Asignación" },
  3: { clave: "enProceso", nombre: "En proceso" },
  4: { clave: "pausado", nombre: "Pausado" },
  5: { clave: "cancelado", nombre: "Cancelado" },
  6: { clave: "finalizado", nombre: "Finalizado" },
};
const PRIORIDAD = { 1: "Baja", 2: "Media", 3: "Alta" };

// CP/Colonia endpoint 
const CP_EP =
  window.IX_CFG_REQ?.ENDPOINTS?.cpcolonia ||
  window.IX_CFG_DEPS?.ENDPOINTS?.cpcolonia ||
  "/DB/WEB/ixtla01_c_cpcolonia.php";

const CP_CACHE_KEY = "ix_cpcolonia_cache_v1";
const CP_CACHE_TTL = 10 * 60 * 1000;

/*  Utils DOM  */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const setText = (el, txt) => {
  if (el) el.textContent = txt ?? "—";
};
const setVal = (el, val) => {
  if (el) el.value = val ?? "";
};
const getSessUserId = () => window.__ixSession?.id_usuario ?? 1;

// crea elemento desde HTML
function htm(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/*  CP/Colonia catálogo  */
let CP_MAP = null; // { "45850": ["Col A", "Col B"] } o asi deberia de ser
let CP_LIST = null;

function cpCacheGet() {
  try {
    const raw = sessionStorage.getItem(CP_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || Date.now() - obj.t > (obj.ttl || CP_CACHE_TTL)) {
      sessionStorage.removeItem(CP_CACHE_KEY);
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}
function cpCacheSet(map, list) {
  try {
    sessionStorage.setItem(
      CP_CACHE_KEY,
      JSON.stringify({ t: Date.now(), ttl: CP_CACHE_TTL, map, list })
    );
  } catch {}
}
function cpExtract(json) {
  const arr = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json)
    ? json
    : [];
  const tmp = {};
  for (const it of arr) {
    const cp = String(
      it.cp ?? it.CP ?? it.codigo_postal ?? it.codigoPostal ?? ""
    ).trim();
    const col = String(
      it.colonia ?? it.Colonia ?? it.asentamiento ?? it.neighborhood ?? ""
    ).trim();
    if (!cp || !col) continue;
    if (!tmp[cp]) tmp[cp] = new Set();
    tmp[cp].add(col);
  }
  const map = Object.fromEntries(
    Object.entries(tmp).map(([k, v]) => [
      k,
      [...v].sort((a, b) => a.localeCompare(b, "es")),
    ])
  );
  const list = Object.keys(map).sort();
  return { map, list };
}
async function ensureCpCatalog() {
  if (CP_MAP && CP_LIST) return;
  const hit = cpCacheGet();
  if (hit?.map && hit?.list) {
    CP_MAP = hit.map;
    CP_LIST = hit.list;
    return;
  }
  const r = await fetch(CP_EP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ all: true }),
  });
  const j = await r.json().catch(() => null);
  const { map, list } = cpExtract(j || {});
  CP_MAP = map;
  CP_LIST = list;
  cpCacheSet(CP_MAP, CP_LIST);
}
function makeOpt(v, label, o = {}) {
  const el = document.createElement("option");
  el.value = v;
  el.textContent = label;
  if (o.disabled) el.disabled = true;
  if (o.selected) el.selected = true;
  return el;
}

/*  Drawer módulo  */
export const Drawer = (() => {
  let el; // <aside class="ix-drawer">
  let bodyEl; // .ixd-body
  let btnEdit, btnSave, btnDelete, btnCancel, btnPause; // footer buttons
  let heroImg, pickBtn, fileInput, previewsBox, uploadBtn, uploadStatus;
  let galleryGrid, galleryEmpty; // galería
  let statusFieldP, statusFieldSel; // p y select del estatus
  let cpInputSel, colInputSel; // selects en edición

  let saving = false;
  let deleting = false;
  let uploading = false;

  function init(selector = ".ix-drawer") {
    el = document.querySelector(selector);
    if (!el) {
      console.warn("[Drawer] no se encontró", selector);
      return;
    }
    if (el.__inited) return; // evita listeners duplicados
    el.__inited = true;

    bodyEl = $(".ixd-body", el) || el;

    // ====== Header & Close
    $$('[data-drawer="close"]', el).forEach((btn) =>
      btn.addEventListener("click", close)
    );

    // ====== Footer buttons
    btnEdit = $('[data-action="editar"]', el);
    btnSave = $('[data-action="guardar"]', el);
    btnDelete = $('[data-action="eliminar"]', el);

    // Insertar Cancel (si no existe)
    btnCancel = $('[data-action="cancelar"]', el);
    if (!btnCancel) {
      btnCancel = htm(
        `<button class="btn ghost ixd-cancel" data-action="cancelar" type="button" hidden>Cancelar</button>`
      );
      $(".ixd-actions--footer", el)?.insertBefore(btnCancel, btnDelete || null);
    }

    // Insertar Pausar/Reanudar (si no existe)
    btnPause = $('[data-action="pausar"]', el);
    if (!btnPause) {
      btnPause = htm(
        `<button class="btn ixd-pause" data-action="pausar" type="button">Pausar</button>`
      );
      $(".ixd-actions--footer", el)?.insertBefore(btnPause, btnDelete || null);
    }

    // Listeners acciones base
    btnEdit?.addEventListener("click", () => setEditMode(true));
    btnSave?.addEventListener("click", onSave);
    btnCancel?.addEventListener("click", onCancel);
    btnDelete?.addEventListener("click", onDelete);
    btnPause?.addEventListener("click", onPauseToggle);

    // ====== Imagen / Uploader
    heroImg = $('[data-img="hero"]', el);
    pickBtn = $('[data-img="pick"]', el);
    fileInput = $('[data-img="file"]', el);
    previewsBox = $('[data-img="previews"]', el);
    uploadBtn = $('[data-img="uploadBtn"]', el);
    uploadStatus = $('[data-img="uploadStatus"]', el);

    // Habilitamos el botón "Subir" para poder probarlo aunque no haya files aún
    if (uploadBtn) uploadBtn.disabled = false;

    // pick -> input type file
    if (pickBtn && fileInput) {
      pickBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => {
        if (!previewsBox) return;
        previewsBox.innerHTML = "";
        const files = fileInput.files || [];
        [...files].forEach((f) => {
          const url = URL.createObjectURL(f);
          const fig = htm(
            `<div class="thumb"><img src="${url}" alt="${f.name}"><button class="rm" type="button">Quitar</button></div>`
          );
          fig.querySelector(".rm").addEventListener("click", () => {
            // quitar f
            const arr = Array.from(fileInput.files || []);
            const idx = arr.indexOf(f);
            const dt = new DataTransfer();
            arr.forEach((it, i) => {
              if (i !== idx) dt.items.add(it);
            });
            fileInput.files = dt.files;
            fig.remove();
          });
          previewsBox.appendChild(fig);
        });
      });
    }

    // Subir → endpoint
    if (uploadBtn) {
      uploadBtn.addEventListener("click", async () => {
        if (uploading) return;
        try {
          const folio = String($(".ixd-folio", el)?.textContent || "").trim();
          if (!/^REQ-\d{10}$/.test(folio)) return;
          const files = fileInput?.files || [];
          const status = Number(uploadStatus?.value || 0);
          uploading = true;
          el.setAttribute("aria-busy", "true");
          await uploadMedia({ folio, status, files });
          // limpiar previews
          if (previewsBox) previewsBox.innerHTML = "";
          if (fileInput) fileInput.value = "";
          // refrescar galería
          await refreshGallery(folio, status);
        } catch (e) {
          console.error("[Drawer] upload error", e);
          window.gcToast?.("No se pudieron subir las imágenes", "alerta");
        } finally {
          uploading = false;
          el.removeAttribute("aria-busy");
        }
      });
    }

    // Crear galería si no existe
    galleryGrid = $('[data-img="grid"]', el);
    if (!galleryGrid) {
      const gWrap = htm(`
        <div class="ixd-viewRow">
          <div class="ixd-gallery" data-img="grid"></div>
        </div>`);
      bodyEl.appendChild(gWrap);
      galleryGrid = $('[data-img="grid"]', el);
    }
    galleryEmpty = $('[data-img="empty"]', el);
    if (!galleryEmpty) {
      galleryEmpty = htm(
        `<div data-img="empty" class="muted" hidden>Sin imágenes para este estado.</div>`
      );
      galleryGrid.parentElement.insertBefore(galleryEmpty, galleryGrid);
    }

    // Cambiar estado del selector de subida → refresca lista
    uploadStatus?.addEventListener("change", async () => {
      const fol = String($(".ixd-folio", el)?.textContent || "").trim();
      const st = Number(uploadStatus?.value || 0);
      if (/^REQ-\d{10}$/.test(fol)) await refreshGallery(fol, st);
    });

    // Estatus: insertamos campo (si no está en HTML)
    ensureStatusField();

    // Guardar oculto by default si NO estás editando
    toggleSave(false);
    // aseguramos que la clase visual coincida
    el.classList.remove("editing", "mode-edit");

    console.log("[Drawer] init OK");
  }

  /* ====== Status field ====== */
  function ensureStatusField() {
    statusFieldP = $('[data-field="estatus_txt"]', el);
    statusFieldSel = $('[name="estatus"][data-edit]', el);

    if (!statusFieldP || !statusFieldSel) {
      const anchor =
        $('.ixd-field label + p + .ixd-input[name="asunto"]', el)?.closest(
          ".ixd-field"
        ) || $(".ixd-field", el);
      const block = htm(`
        <div class="ixd-field">
          <label>Estatus</label>
          <p data-field="estatus_txt">—</p>
          <select class="ixd-input" name="estatus" data-edit hidden>
            <option value="0">Solicitud</option>
            <option value="1">Revisión</option>
            <option value="2">Asignación</option>
            <option value="3">En proceso</option>
            <option value="4">Pausado</option>
            <option value="5">Cancelado</option>
            <option value="6">Finalizado</option>
          </select>
        </div>`);
      if (anchor?.parentElement) {
        anchor.parentElement.insertBefore(block, anchor);
      } else {
        bodyEl.insertBefore(block, bodyEl.firstChild);
      }
      statusFieldP = $('[data-field="estatus_txt"]', el);
      statusFieldSel = $('[name="estatus"][data-edit]', el);
    }
  }

  /* ====== Mapeos ====== */
  function mapToFields(data = {}) {
    // Campos visibles <p data-field="...">
    $$(".ixd-field [data-field]", el).forEach((p) => {
      const k = p.getAttribute("data-field");
      let val = data[k];
      if (k === "prioridad") val = PRIORIDAD[Number(val)] || val || "—";
      if (k === "estatus_txt") {
        const ev = Number(data.estatus);
        val = ESTATUS[ev]?.nombre ?? String(ev ?? "—");
      }
      setText(p, val ?? "—");
    });
    // Folio
    setText($(".ixd-folio", el), data.folio || "REQ-0000000000");
    // Imagen hero opcional
    if (heroImg) {
      heroImg.src = data.hero_url || "";
      heroImg.alt = data.folio || "Evidencia";
    }
  }

  function mapToForm(data = {}) {
    // inputs de edición llevan name y data-edit
    $$("[data-edit][name]", el).forEach((i) => {
      const name = i.getAttribute("name");
      const v = data[name];
      setVal(i, v ?? "");
    });
    // prioridad select: asegura 1..3
    const pr = $('[name="prioridad"][data-edit]', el);
    if (pr && !pr.value) pr.value = String(data.prioridad ?? 2);

    // estatus select
    if (statusFieldSel) {
      statusFieldSel.value = String(data.estatus ?? 0);
    }

    // Hidden necesarios
    const hidId = $('input[name="id"]', el);
    if (hidId && data.id != null) hidId.value = data.id;
    const hidUb = $('input[name="updated_by"]', el);
    if (hidUb) hidUb.value = getSessUserId();
  }

  /* ====== CP/Colonia selects en edición ====== */
  function ensureCpColoniaInputs(row = {}) {
    // Reemplazamos input text por <select> SOLO en edición; mantenemos <p> para vista
    // CP
    const cpInput = $('.ixd-input[name="contacto_cp"]', el);
    if (cpInput?.tagName !== "SELECT") {
      const sel = htm(
        `<select class="ixd-input" name="contacto_cp" data-edit hidden></select>`
      );
      cpInput.replaceWith(sel);
    }
    // Colonia
    const colInput = $('.ixd-input[name="contacto_colonia"]', el);
    if (colInput?.tagName !== "SELECT") {
      const sel = htm(
        `<select class="ixd-input" name="contacto_colonia" data-edit hidden></select>`
      );
      colInput.replaceWith(sel);
    }
    cpInputSel = $('.ixd-input[name="contacto_cp"]', el);
    colInputSel = $('.ixd-input[name="contacto_colonia"]', el);

    // Popular CP
    cpInputSel.innerHTML = "";
    cpInputSel.appendChild(
      makeOpt("", "Selecciona C.P.", { disabled: true, selected: true })
    );
    (CP_LIST || []).forEach((cp) => cpInputSel.appendChild(makeOpt(cp, cp)));

    // Si el registro trae un CP no listado, agregamos opción temporal
    const cpVal = String(row.contacto_cp ?? "").trim();
    if (cpVal && !CP_MAP[cpVal]) {
      cpInputSel.appendChild(makeOpt(cpVal, cpVal));
    }
    if (cpVal) cpInputSel.value = cpVal;

    // Colonias para CP
    populateColoniasForCP(cpVal, row.contacto_colonia);
    // Listeners
    cpInputSel.onchange = () => {
      populateColoniasForCP(cpInputSel.value, null);
    };
  }

  function populateColoniasForCP(cp, selectedCol) {
    if (!colInputSel) return;
    colInputSel.innerHTML = "";
    colInputSel.appendChild(
      makeOpt("", "Selecciona colonia", { disabled: true, selected: true })
    );
    const list = CP_MAP?.[cp] || [];
    list.forEach((c) => colInputSel.appendChild(makeOpt(c, c)));
    colInputSel.disabled = list.length === 0;
    if (selectedCol && list.includes(selectedCol)) {
      colInputSel.value = selectedCol;
    }
  }

  /* ====== Edit mode ====== */
  function toggleSave(show) {
    if (btnSave) {
      btnSave.hidden = !show;
      btnSave.disabled = !show;
    }
  }
  function toggleDelete(show) {
    if (btnDelete) btnDelete.hidden = !show;
  }
  function toggleCancel(show) {
    if (btnCancel) btnCancel.hidden = !show;
  }
  function togglePause(show) {
    if (btnPause) btnPause.hidden = !show;
  }

  function setEditMode(on) {
    el.classList.toggle("mode-edit", !!on);
    el.classList.toggle("editing", !!on); // respeta CSS existente
    toggleSave(on);
    toggleCancel(on);
    toggleDelete(!on);
    togglePause(!on);
    // Mostrar/ocultar inputs vs p (lo hace el CSS con .editing)
    if (on) {
      // Asegurar selects CP/Colonia con catálogo ya cargado
      ensureCpCatalog()
        .then(() => ensureCpColoniaInputs(el._row || {}))
        .catch(() => {});
      // Foco primer campo editable visible
      setTimeout(() => {
        const first = $("[data-edit]:not([hidden])", el);
        first?.focus?.();
      }, 0);
    }
  }

  /* ====== Open/Close ====== */
  function open(row, callbacks = {}) {
    if (!el) return console.warn("[Drawer] init() primero");
    // Guardar raw + copia para cancel
    el._row = row || {};
    el._orig = JSON.parse(JSON.stringify(row || {}));
    el._callbacks = callbacks || {};

    // Pinta lectura
    mapToFields(row);
    mapToForm(row);

    // Estado botones (pausa/reanuda)
    paintPauseButton(row?.estatus);

    // Abre panel
    el.classList.add("open");
    setEditMode(false);

    // Carga galería del estado seleccionado (por defecto usa uploadStatus o el actual del req)
    const st = Number(uploadStatus?.value ?? row?.estatus ?? 0);
    const fol = row?.folio || "";
    if (/^REQ-\d{10}$/.test(fol)) refreshGallery(fol, st);
  }

  async function refreshGallery(folio, status) {
    try {
      el.setAttribute("aria-busy", "true");
      const resp = await listMedia(folio, status, 1, 100);
      const list = Array.isArray(resp?.data) ? resp.data : [];
      galleryGrid.innerHTML = "";
      if (!list.length) {
        galleryEmpty.hidden = false;
        return;
      }
      galleryEmpty.hidden = true;
      const frag = document.createDocumentFragment();
      list.forEach((it) => {
        const card = htm(`
          <div class="ixd-card">
            <img src="${it.url}" loading="lazy" alt="${it.name || ""}">
            <div class="ixd-name" style="padding:6px 8px; font-size:.85rem; color:#374151; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${
              it.name || ""
            }</div>
          </div>`);
        frag.appendChild(card);
      });
      galleryGrid.appendChild(frag);
    } catch (e) {
      console.warn("[Drawer] gallery error:", e);
      galleryGrid.innerHTML = "";
      galleryEmpty.hidden = false;
    } finally {
      el.removeAttribute("aria-busy");
    }
  }

  function close() {
    if (!el) return;
    el.classList.remove("open");
    el.classList.remove("editing", "mode-edit");
    toggleSave(false);
    toggleCancel(false);
    toggleDelete(true);
    togglePause(true);
    // limpia previews
    if (previewsBox) previewsBox.innerHTML = "";
    if (fileInput) fileInput.value = "";
    try {
      el._callbacks?.onClose?.();
    } catch {}
  }

  /* ====== Guardar / Cancelar / Eliminar / Pausar ====== */
  async function onSave(ev) {
    ev?.preventDefault?.();
    if (saving) return;
    saving = true;
    btnSave && (btnSave.disabled = true);

    const getStr = (name) => {
      const v = $(`[name="${name}"][data-edit]`, el)?.value;
      const t = (v ?? "").trim();
      return t === "" ? null : t;
    };
    const getNum = (name) => {
      const raw = $(`[name="${name}"][data-edit]`, el)?.value;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    try {
      const id = Number($('input[name="id"]', el)?.value || NaN);
      if (!id) throw new Error("Falta id");

      const payload = {
        id,
        asunto: getStr("asunto"),
        descripcion: getStr("descripcion"),
        prioridad: getNum("prioridad"),
        canal: getNum("canal"),

        contacto_nombre: getStr("contacto_nombre"),
        contacto_telefono: getStr("contacto_telefono"),
        contacto_email: getStr("contacto_email"),
        contacto_cp: getStr("contacto_cp"),
        contacto_calle: getStr("contacto_calle"),
        contacto_colonia: getStr("contacto_colonia"),

        estatus: getNum("estatus"),

        updated_by:
          Number($('input[name="updated_by"]', el)?.value || getSessUserId()) ||
          getSessUserId(),
      };

      const updated = await updateRequerimiento(payload);
      el._row = updated;
      el._orig = JSON.parse(JSON.stringify(updated));

      mapToFields(updated);
      mapToForm(updated);
      paintPauseButton(updated?.estatus);
      setEditMode(false);

      try {
        el._callbacks?.onUpdated?.(updated);
      } catch {}
      window.gcToast?.("Requerimiento actualizado", "exito");
    } catch (err) {
      console.error("[Drawer] save error:", err);
      try {
        el._callbacks?.onError?.(err);
      } catch {}
      window.gcToast?.("No se pudo guardar", "alerta");
    } finally {
      saving = false;
      btnSave && (btnSave.disabled = false);
    }
  }

  function onCancel() {
    // revertir al original
    const row = el._orig || {};
    mapToFields(row);
    mapToForm(row);
    paintPauseButton(row?.estatus);
    setEditMode(false);
  }

  async function onDelete() {
    if (deleting) return;
    if (!confirm("¿Desactivar este requerimiento?")) return;
    try {
      deleting = true;
      btnDelete && (btnDelete.disabled = true);
      const id = Number($('input[name="id"]', el)?.value || NaN);
      if (!id) throw new Error("Falta id");
      const payload = { id, status: 0, updated_by: getSessUserId() };
      const updated = await updateRequerimiento(payload);
      try {
        el._callbacks?.onUpdated?.(updated);
      } catch {}
      close();
    } catch (e) {
      console.error("[Drawer] delete error:", e);
      window.gcToast?.("No se pudo desactivar", "alerta");
    } finally {
      deleting = false;
      btnDelete && (btnDelete.disabled = false);
    }
  }

  function paintPauseButton(estatus) {
    const st = Number(estatus ?? 0);
    if (!btnPause) return;
    if (st === 4) {
      btnPause.textContent = "Reanudar";
      btnPause.classList.remove("warning");
      btnPause.classList.add("success");
      btnPause.dataset.mode = "resume";
    } else {
      btnPause.textContent = "Pausar";
      btnPause.classList.remove("success");
      btnPause.classList.add("warning");
      btnPause.dataset.mode = "pause";
    }
  }

  async function onPauseToggle() {
    const row = el._row || {};
    const id = Number(row.id || 0);
    if (!id) return;
    const mode = btnPause?.dataset.mode || "pause";
    const next = mode === "pause" ? 4 : 0; // 4=Pausado, 0=Solicitud

    try {
      btnPause.disabled = true;
      const updated = await updateRequerimiento({
        id,
        estatus: next,
        updated_by: getSessUserId(),
      });
      el._row = updated;
      el._orig = JSON.parse(JSON.stringify(updated));
      mapToFields(updated);
      mapToForm(updated);
      paintPauseButton(updated?.estatus);
      try {
        el._callbacks?.onUpdated?.(updated);
      } catch {}
      window.gcToast?.("Estatus actualizado", "info");
    } catch (e) {
      console.error("[Drawer] pause/resume error:", e);
      window.gcToast?.("No se pudo actualizar estatus", "alerta");
    } finally {
      btnPause.disabled = false;
    }
  }

  return { init, open, close, setEditMode };
})();
