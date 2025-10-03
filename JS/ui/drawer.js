// /JS/ui/drawer.js

// CON
const CFG = (() => {
  const API_BASE =
    window.IX_CFG_DEPS?.ENDPOINTS?.deps?.split("/db/WEB/")[0] + "/db/WEB/" ||
    "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/db/WEB/";

  const REQ = window.IX_CFG_REQ || {};

  return {
    MAX_MB: 1,
    ACCEPT_MIME: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ],
    ACCEPT_EXT: [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],

    ENDPOINTS: {
      updateReq: API_BASE + "ixtla01_upd_requerimiento.php",

      // imagenes, deberia tener consulta y subida:
      mediaList: API_BASE + "ixtla01_c_requerimiento_img.php",
      mediaUpload: API_BASE + "ixtla01_ins_requerimiento_img.php",

      // CP/Colonia
      cpcolonia: API_BASE + "ixtla01_c_cpcolonia.php",
    },
  };
})();

// utils
function $(sel, root = document) {
  return root.querySelector(sel);
}
function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function setText(el, txt) {
  if (el) el.textContent = txt ?? "—";
}
function setVal(el, val) {
  if (el) el.value = val ?? "";
}
const digits = (s) => (s || "").replace(/\D+/g, "");

const FOLIO_RX = /^REQ-\d{10}$/;

// ================== Mapeo ==================
function mapToFields(root, data = {}) {
  $all("[data-field]", root).forEach((el) => {
    const key = el.getAttribute("data-field");
    if (!key) return;
    setText(el, data[key] ?? "—");
  });
  const hidId = root.querySelector('input[name="id"][data-field="id"]');
  if (hidId && data.id != null) hidId.value = data.id;
}

function mapToForm(root, data = {}) {
  $all("[data-edit][name]", root).forEach((el) => {
    const key = el.getAttribute("name");
    const v = data[key];
    if (
      el.tagName === "SELECT" ||
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA"
    ) {
      setVal(el, v ?? "");
    }
  });
  const hidId = root.querySelector('input[name="id"]');
  const hidUb = root.querySelector('input[name="updated_by"]');
  if (hidId && data.id != null) hidId.value = data.id;
  if (hidUb) hidUb.value = window.__ixSession?.id_usuario ?? 1;
}

// ================== Requests ==================
async function updateRequerimiento(payload) {
  const url = CFG.ENDPOINTS.updateReq;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`update HTTP ${res.status}`);
  const json = JSON.parse(txt);
  if (!json?.ok) throw new Error(json?.error || "Update no OK");
  return json.data;
}

async function listMedia({ folio, status, page = 1, per_page = 100 }) {
  const url = CFG.ENDPOINTS.mediaList;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ folio, status, page, per_page }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`list media HTTP ${res.status}`);
  const json = JSON.parse(txt);
  if (!json?.ok) return { ok: false, data: [] };
  return json;
}

async function uploadMedia({ folio, status, files }) {
  if (!FOLIO_RX.test(String(folio))) throw new Error("folio inválido");
  const fd = new FormData();
  fd.append("folio", folio);
  fd.append("status", String(status));
  [...files].forEach((f) => fd.append("files[]", f, f.name));

  const res = await fetch(CFG.ENDPOINTS.mediaUpload, {
    method: "POST",
    body: fd,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`upload HTTP ${res.status}`);
  const json = JSON.parse(txt);
  if (!json?.ok) throw new Error(json?.error || "Upload no OK");
  return json;
}

// ================== CP / Colonia (combos dependientes) ==================
const CP_DATA = { map: {}, list: [], loaded: false, loading: false };

async function fetchCpColonia() {
  if (CP_DATA.loaded || CP_DATA.loading) return;
  CP_DATA.loading = true;
  try {
    const res = await fetch(CFG.ENDPOINTS.cpcolonia, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ all: true }),
    });
    const json = await res.json();
    const rows = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : [];
    const tmp = {};
    for (const item of rows) {
      const cp = String(item.cp ?? item.CP ?? item.codigo_postal ?? "").trim();
      const col = String(
        item.colonia ?? item.Colonia ?? item.asentamiento ?? ""
      ).trim();
      if (!cp || !col) continue;
      if (!tmp[cp]) tmp[cp] = new Set();
      tmp[cp].add(col);
    }
    CP_DATA.map = Object.fromEntries(
      Object.entries(tmp).map(([k, v]) => [
        k,
        [...v].sort((a, b) => a.localeCompare(b, "es")),
      ])
    );
    CP_DATA.list = Object.keys(CP_DATA.map).sort();
    CP_DATA.loaded = true;
  } catch (e) {
    console.warn("[Drawer] cp/colonia fetch error:", e);
  } finally {
    CP_DATA.loading = false;
  }
}

function ensureSelectFromInput(inputEl, { id, name }) {
  if (!inputEl) return null;
  if (inputEl.tagName === "SELECT") return inputEl;
  const sel = document.createElement("select");
  sel.className = inputEl.className || "ixd-input";
  sel.name = name || inputEl.name;
  sel.id = id || inputEl.id || "";
  sel.setAttribute("data-edit", "");
  sel.hidden = inputEl.hidden; // respeta visibilidad por modo edición
  inputEl.replaceWith(sel);
  return sel;
}

function fillCpOptions(selCp) {
  if (!selCp) return;
  selCp.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "Selecciona C.P.";
  ph.disabled = true;
  ph.selected = true;
  selCp.appendChild(ph);
  CP_DATA.list.forEach((cp) => {
    const o = document.createElement("option");
    o.value = cp;
    o.textContent = cp;
    selCp.appendChild(o);
  });
}

function fillColoniasFor(selCol, cp) {
  if (!selCol) return;
  selCol.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = cp ? "Selecciona colonia" : "Selecciona C.P.";
  ph.disabled = true;
  ph.selected = true;
  selCol.appendChild(ph);
  const list = CP_DATA.map[cp] || [];
  list.forEach((c) => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    selCol.appendChild(o);
  });
  selCol.disabled = list.length === 0;
}

// ================== Pintado de galería ==================
function paintGallery(root, resp) {
  const grid = $('[data-img="grid"]', root);
  const empty = $('[data-img="empty"]', root);
  if (!grid) return; // si no existe, saltamos silenciosamente
  grid.innerHTML = "";
  const list = (resp?.data || []).filter(Boolean);
  if (!list.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const frag = document.createDocumentFragment();
  list.forEach((it) => {
    const card = document.createElement("a");
    card.className = "ixd-card";
    card.href = it.url || "#";
    card.target = "_blank";
    card.rel = "noopener";
    card.innerHTML = `
      <img src="${it.url}" alt="${it.name || "evidencia"}">
      <div class="nm" title="${it.name || ""}">${it.name || ""}</div>
    `.trim();
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}

// ================== Drawer módulo ==================
export const Drawer = (() => {
  let el; // <aside class="ix-drawer" data-drawer="panel">
  let overlay; // [data-drawer="overlay"]
  let heroImg; // [data-img="hero"]
  let pickBtn; // [data-img="pick"]
  let fileInput; // [data-img="file"]
  let previewsBox; // [data-img="previews"]
  let uploadBtn; // [data-img="uploadBtn"]
  let uploadStatus; // [data-img="uploadStatus"]
  let viewStatusSel; // [data-img="viewStatus"] (opcional; si no existe usamos uploadStatus)
  let btnEdit, btnSave, btnDelete, btnCancel, btnPause; // acciones
  let formRoot; // raíz para inputs (el mismo drawer)
  let saving = false;
  let deleting = false;

  // Campos CP/Colonia (selects dependientes)
  let selCP, selCol;

  function setEditMode(on) {
    el.classList.toggle("mode-edit", !!on);

    // Guardar: visible en edición
    if (btnSave) btnSave.style.display = on ? "" : "none";

    // Eliminar se oculta en edición; Cancel aparece en edición
    if (btnDelete) btnDelete.style.display = on ? "none" : "";
    if (btnCancel) btnCancel.style.display = on ? "" : "none";

    // Pausar/Reanudar solo en lectura
    if (btnPause) btnPause.style.display = on ? "none" : "";

    // Habilita/deshabilita guardado
    if (btnSave) btnSave.disabled = !on;

    // Mostrar/ocultar inputs vs <p> (ya controlado por CSS del proyecto)
    $all(".ixd-field p", el).forEach((p) => (p.hidden = !!on));
    $all(".ixd-input[data-edit]", el).forEach((i) => (i.hidden = !on));
  }

  function setPauseButtonByStatus(est) {
    // 4 = pausado → mostrar "Reanudar" (success)
    if (!btnPause) return;
    const isPausado = Number(est) === 4;
    btnPause.textContent = isPausado ? "Reanudar" : "Pausar";
    btnPause.classList.remove("warning", "success");
    btnPause.classList.add(isPausado ? "success" : "warning");
    // Ocultar si cancelado/finalizado
    const hide = Number(est) === 5 || Number(est) === 6;
    btnPause.style.display = hide ? "none" : "";
  }

  async function loadGalleryFor(status) {
    const folio = String($(".ixd-folio", el)?.textContent || "").trim();
    if (!FOLIO_RX.test(folio)) return;
    try {
      const resp = await listMedia({ folio, status: Number(status) });
      paintGallery(el, resp);
    } catch (e) {
      console.warn("[Drawer] loadGallery error:", e);
    }
  }

  function onPickFiles() {
    fileInput?.click();
  }

  function handleFileInputChange() {
    if (!previewsBox || !fileInput) return;
    previewsBox.innerHTML = "";
    const files = fileInput.files || [];
    const maxBytes = CFG.MAX_MB * 1024 * 1024;

    Array.from(files).forEach((f) => {
      // Validaciones locales
      const okMime = CFG.ACCEPT_MIME.includes(f.type);
      const okExt = CFG.ACCEPT_EXT.some((ext) =>
        f.name.toLowerCase().endsWith(ext)
      );
      if (!okMime && !okExt) {
        console.warn("Archivo omitido por tipo:", f.name);
        return;
      }
      if (f.size > maxBytes) {
        console.warn("Archivo excede límite:", f.name);
        return;
      }
      const url = URL.createObjectURL(f);
      const card = document.createElement("div");
      card.className = "thumb";
      card.innerHTML = `<img src="${url}" alt="preview"><button class="rm" type="button">Quitar</button>`;
      card.querySelector(".rm").addEventListener("click", () => {
        // quitar del FileList (no es trivial) → recreamos selection
        const keep = Array.from(fileInput.files).filter((x) => x !== f);
        const dt = new DataTransfer();
        keep.forEach((x) => dt.items.add(x));
        fileInput.files = dt.files;
        card.remove();
        if (uploadBtn) uploadBtn.disabled = fileInput.files.length === 0;
      });
      previewsBox.appendChild(card);
    });

    if (uploadBtn) uploadBtn.disabled = fileInput.files.length === 0;
  }

  async function doUpload() {
    try {
      const folio = String($(".ixd-folio", el)?.textContent || "").trim();
      const status = Number(uploadStatus?.value || 0);
      const files = fileInput?.files || [];

      if (!FOLIO_RX.test(folio)) throw new Error("Folio inválido");
      if (!files?.length) return;

      uploadBtn.disabled = true;
      await uploadMedia({ folio, status, files });

      // Limpia previews y file input
      if (previewsBox) previewsBox.innerHTML = "";
      if (fileInput) fileInput.value = "";
      uploadBtn.disabled = true;

      // Refresca galería del status actual (si usamos uploadStatus como "view")
      const viewSt = viewStatusSel ? Number(viewStatusSel.value) : status;
      await loadGalleryFor(viewSt);

      if (window.gcToast) gcToast("Imágenes subidas.", "exito");
    } catch (e) {
      console.error("[Drawer] upload error:", e);
      if (window.gcToast)
        gcToast("No se pudieron subir las imágenes.", "warning");
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
    }
  }

  function buildCancelButton() {
    // Si ya existe, no dupliques
    let btn = el.querySelector('[data-action="cancelar"]');
    if (btn) return btn;
    btn = document.createElement("button");
    btn.className = "btn ixd-cancel";
    btn.setAttribute("data-action", "cancelar");
    btn.type = "button";
    btn.textContent = "Cancelar";
    // Insertar antes del guardar (pie)
    const footer =
      el.querySelector(".ixd-actions--footer") ||
      el.querySelector(".ixd-actions");
    if (footer)
      footer.insertBefore(btn, el.querySelector('[data-action="guardar"]'));
    return btn;
  }

  function buildPauseButton() {
    let btn = el.querySelector('[data-action="pausar"]');
    if (btn) return btn;
    btn = document.createElement("button");
    btn.className = "btn warning ixd-pause";
    btn.setAttribute("data-action", "pausar");
    btn.type = "button";
    btn.textContent = "Pausar";
    const footer =
      el.querySelector(".ixd-actions--footer") ||
      el.querySelector(".ixd-actions");
    if (footer)
      footer.insertBefore(btn, footer.lastElementChild /* antes de eliminar */);
    return btn;
  }

  function bindBasicButtons() {
    // Cerrar (botón y overlay)
    $all('[data-drawer="close"]', el).forEach((b) =>
      b.addEventListener("click", close)
    );
    if (overlay) {
      overlay.addEventListener("click", close);
    }

    // Editar / Guardar / Eliminar
    btnEdit = el.querySelector('[data-action="editar"]');
    btnSave = el.querySelector('[data-action="guardar"]');
    btnDelete = el.querySelector('[data-action="eliminar"]');

    // Cancelar (dinámico)
    btnCancel = buildCancelButton();
    btnPause = buildPauseButton();

    btnEdit?.addEventListener("click", () => setEditMode(true));
    btnCancel?.addEventListener("click", onCancel);
    btnSave?.addEventListener("click", onSave);
    btnDelete?.addEventListener("click", onDelete);
    btnPause?.addEventListener("click", onPauseToggle);
  }

  function ensureCpColoniaSelects() {
    // Reemplaza inputs por selects en modo edición
    selCP = ensureSelectFromInput(
      el.querySelector(
        'input[name="contacto_cp"].ixd-input, select[name="contacto_cp"].ixd-input'
      ),
      { name: "contacto_cp" }
    );
    selCol = ensureSelectFromInput(
      el.querySelector(
        'input[name="contacto_colonia"].ixd-input, select[name="contacto_colonia"].ixd-input'
      ),
      { name: "contacto_colonia" }
    );
    if (selCP) selCP.hidden = true; // por defecto oculto (modo lectura)
    if (selCol) selCol.hidden = true;

    selCol && (selCol.disabled = true);

    selCP?.addEventListener("change", () => {
      fillColoniasFor(selCol, selCP.value || "");
      if (selCol) selCol.value = "";
    });
  }

  function showCpColoniaInEdit(row) {
    if (!selCP || !selCol) return;
    // Mostrar selects
    selCP.hidden = false;
    selCol.hidden = false;

    // Popular opciones
    if (CP_DATA.loaded) {
      fillCpOptions(selCP);
      const cp = String(row?.contacto_cp || "").trim();
      if (cp && CP_DATA.list.includes(cp)) {
        selCP.value = cp;
        fillColoniasFor(selCol, cp);
        const col = String(row?.contacto_colonia || "").trim();
        if (col && (CP_DATA.map[cp] || []).includes(col)) selCol.value = col;
      } else {
        selCP.value = "";
        fillColoniasFor(selCol, "");
      }
    } else {
      // En cuanto cargue, intentamos setear los valores
      fetchCpColonia().then(() => showCpColoniaInEdit(row));
    }
  }

  function hideCpColoniaInView() {
    if (!selCP || !selCol) return;
    selCP.hidden = true;
    selCol.hidden = true;
  }

  // --------- Acciones ---------
  async function onSave(ev) {
    ev?.preventDefault?.();
    if (saving) return;
    saving = true;
    btnSave.disabled = true;

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
      const id = Number(el.querySelector('input[name="id"]')?.value || NaN);
      if (!id) throw new Error("Falta id");

      const payload = {
        id,
        asunto: getStr("asunto"),
        descripcion: getStr("descripcion"),
        prioridad: getNum("prioridad"),
        canal: getNum("canal"),

        contacto_nombre: getStr("contacto_nombre"),
        contacto_telefono: getStr("contacto_telefono")
          ? digits(getStr("contacto_telefono"))
          : null,
        contacto_email: getStr("contacto_email"),
        contacto_cp: selCP ? selCP.value || null : getStr("contacto_cp"),
        contacto_colonia: selCol
          ? selCol.value || null
          : getStr("contacto_colonia"),
        contacto_calle: getStr("contacto_calle"),

        estatus: getNum("estatus"),

        updated_by:
          Number(
            el.querySelector('input[name="updated_by"]')?.value ||
              (window.__ixSession?.id_usuario ?? 1)
          ) || 1,
      };

      const updated = await updateRequerimiento(payload);

      // Sincroniza UI y snapshot
      mapToFields(el, updated);
      mapToForm(el, updated);
      setPauseButtonByStatus(updated.estatus);

      // actualiza raw-snapshot para cancelar futuro
      el._row = { ...(el._row || {}), ...updated };
      el._rowOriginal = { ...el._row };

      setEditMode(false);
      hideCpColoniaInView();

      try {
        el._callbacks?.onUpdated?.(updated);
      } catch (e) {
        console.error(e);
      }
      if (window.gcToast) gcToast("Cambios guardados.", "exito");
    } catch (err) {
      console.error("[Drawer] save() error:", err);
      try {
        el._callbacks?.onError?.(err);
      } catch (e) {
        console.error(e);
      }
      if (window.gcToast) gcToast("No se pudo guardar.", "warning");
    } finally {
      saving = false;
      btnSave.disabled = true; // queda deshabilitado fuera de edición
    }
  }

  async function onDelete(ev) {
    ev?.preventDefault?.();
    if (deleting) return;

    const btn = btnDelete;
    if (!btn) return;

    // confirmación simple
    if (!btn.dataset.confirm) {
      btn.dataset.confirm = "1";
      const originalTxt = btn.textContent;
      btn.dataset.original = originalTxt;
      btn.textContent = "¿Confirmar borrado?";
      setTimeout(() => {
        if (!btn) return;
        btn.textContent = btn.dataset.original || "Eliminar";
        btn.removeAttribute("data-confirm");
        btn.removeAttribute("data-original");
      }, 4500);
      return;
    }

    deleting = true;
    btn.disabled = true;

    try {
      const id = Number(el.querySelector('input[name="id"]')?.value || NaN);
      if (!id) throw new Error("Falta id");

      const payload = {
        id,
        status: 0, // Soft delete (1 → 0)
        updated_by:
          Number(
            el.querySelector('input[name="updated_by"]')?.value ||
              (window.__ixSession?.id_usuario ?? 1)
          ) || 1,
      };

      const updated = await updateRequerimiento(payload);
      try {
        el._callbacks?.onUpdated?.(updated);
      } catch (e) {
        console.error(e);
      }
      close();
      if (window.gcToast) gcToast("Requerimiento desactivado.", "info");
    } catch (err) {
      console.error("[Drawer] delete() error:", err);
      try {
        el._callbacks?.onError?.(err);
      } catch (e) {
        console.error(e);
      }
      if (window.gcToast) gcToast("No se pudo eliminar.", "warning");
    } finally {
      deleting = false;
      btn.disabled = false;
      btn.textContent = btn.dataset.original || "Eliminar";
      btn.removeAttribute("data-confirm");
      btn.removeAttribute("data-original");
    }
  }

  async function onPauseToggle() {
    // Toggle: pausado(4) <-> solicitud(0)
    const row = el._row || {};
    const next = Number(row.estatus) === 4 ? 0 : 4;

    try {
      btnPause.disabled = true;
      const id = Number(el.querySelector('input[name="id"]')?.value || NaN);
      const updated_by =
        Number(
          el.querySelector('input[name="updated_by"]')?.value ||
            (window.__ixSession?.id_usuario ?? 1)
        ) || 1;
      const updated = await updateRequerimiento({
        id,
        estatus: next,
        updated_by,
      });

      // Repinta UI
      mapToFields(el, updated);
      mapToForm(el, updated);
      setPauseButtonByStatus(updated.estatus);

      // Actualiza snapshot
      el._row = { ...row, ...updated };
      el._rowOriginal = { ...el._row };

      try {
        el._callbacks?.onUpdated?.(updated);
      } catch (e) {
        console.error(e);
      }
      if (window.gcToast)
        gcToast(
          next === 4 ? "Requerimiento pausado." : "Requerimiento reanudado.",
          "info"
        );
    } catch (e) {
      console.error("[Drawer] pause toggle error:", e);
      if (window.gcToast) gcToast("No se pudo cambiar el estatus.", "warning");
    } finally {
      btnPause.disabled = false;
    }
  }

  function onCancel() {
    // Revertir a snapshot original
    const orig = el._rowOriginal || el._row || {};
    mapToFields(el, orig);
    mapToForm(el, orig);
    setPauseButtonByStatus(orig.estatus);
    setEditMode(false);
    hideCpColoniaInView();
  }

  // --------- API pública ---------
  function init(selector = ".ix-drawer") {
    el = document.querySelector(selector);
    if (!el) {
      console.warn("[Drawer] no se encontró", selector);
      return;
    }
    if (el.__inited) return;
    el.__inited = true;

    overlay = document.querySelector('[data-drawer="overlay"]');

    formRoot = el;
    heroImg = $('[data-img="hero"]', el);
    pickBtn = $('[data-img="pick"]', el);
    fileInput = $('[data-img="file"]', el);
    previewsBox = $('[data-img="previews"]', el);
    uploadBtn = $('[data-img="uploadBtn"]', el);
    uploadStatus = $('[data-img="uploadStatus"]', el);
    viewStatusSel = $('[data-img="viewStatus"]', el); // opcional (si no, usamos uploadStatus)

    bindBasicButtons();
    ensureCpColoniaSelects();

    // Imagen: elegir archivo
    if (pickBtn && fileInput) {
      pickBtn.addEventListener("click", onPickFiles);
      fileInput.addEventListener("change", handleFileInputChange);
    }
    // Subir
    if (uploadBtn) {
      uploadBtn.disabled = true; // hasta que haya archivos
      uploadBtn.addEventListener("click", doUpload);
    }

    // View status (si existe) → Galería
    if (viewStatusSel) {
      viewStatusSel.addEventListener("change", () =>
        loadGalleryFor(Number(viewStatusSel.value || 0))
      );
    } else if (uploadStatus) {
      // Usar el mismo de subida como filtro de galería
      uploadStatus.addEventListener("change", () =>
        loadGalleryFor(Number(uploadStatus.value || 0))
      );
    }

    console.log("[Drawer] init OK");
  }

  function open(row, callbacks = {}) {
    if (!el) return console.warn("[Drawer] init() primero");

    // Snapshot
    el._row = { ...(row || {}) };
    el._rowOriginal = { ...(row || {}) };
    el._callbacks = callbacks || {};

    // Mapear
    mapToFields(el, row || {});
    mapToForm(el, row || {});

    // Folio visible
    const folioEl = $(".ixd-folio", el);
    if (folioEl) setText(folioEl, row?.folio || "REQ-0000000000");

    // Imagen hero (opcional)
    if (heroImg) {
      heroImg.src = row?.hero_url || "";
      heroImg.alt = row?.folio || "Evidencia";
    }

    // Estado UI
    setEditMode(false);
    setPauseButtonByStatus(row?.estatus);

    // Subida/galería: set default status
    const st = Number(row?.estatus ?? 0);
    if (uploadStatus) uploadStatus.value = String(st);
    if (viewStatusSel) viewStatusSel.value = String(st);

    // Cargar galería del estatus actual
    const v = viewStatusSel
      ? Number(viewStatusSel.value)
      : Number(uploadStatus?.value || st);
    loadGalleryFor(v);

    // CP/Colonia combos: precarga catálogo (best-effort)
    fetchCpColonia().catch(() => {});

    // Abrir + overlay
    el.classList.add("open");
    if (overlay) {
      overlay.hidden = false;
    }

    console.log("[Drawer] open →", row?.id, row?.folio);
  }

  function close() {
    if (!el) return;
    el.classList.remove("open");
    if (overlay) overlay.hidden = true;

    // limpiar archivo/previews
    if (previewsBox) previewsBox.innerHTML = "";
    if (fileInput) fileInput.value = "";
    if (uploadBtn) uploadBtn.disabled = true;

    setEditMode(false);
  }

  return { init, open, close, setEditMode };
})();
