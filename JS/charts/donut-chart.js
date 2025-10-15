// /JS/charts/donut-chart.js
"use strict";

/* ============================================================================
   CONFIG
   ========================================================================== */
const DONUT_CFG = {
  DEBUG: true,
  API_BASE: "https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net/DB/WEB/",
  MAX_SLICES: 5,                      
  OTHERS_LABEL: "Otros",
  OTHERS_COLOR: "#CBD5E1",         
  DEFAULT_PALETTE: [
    "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#6366F1",
    "#06B6D4", "#22C55E", "#EAB308", "#F97316", "#8B5CF6"
  ],
};

const D_TAG = "[DonutSmart]";
const dlog = (...a) => { if (DONUT_CFG.DEBUG) console.log(D_TAG, ...a); };
const dwarn= (...a) => { if (DONUT_CFG.DEBUG) console.warn(D_TAG, ...a); };

/* ============================================================================
   Utils
   ========================================================================== */
function $(sel, root=document){ return root.querySelector(sel); }
function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }
function monthStart(y,m){ return new Date(y, m, 1, 0,0,0,0); }
function monthEnd(y,m){ return new Date(y, m+1, 0, 23,59,59,999); }
function parseSqlishDate(s){
  if (!s) return null;
  const d = new Date(String(s).replace(" ", "T"));
  return isNaN(d) ? null : d;
}
function normalizeName(s){
  return String(s||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .trim();
}
function djb2(str){
  let h = 5381;
  for (let i=0;i<str.length;i++) h = ((h<<5)+h) + str.charCodeAt(i);
  return h >>> 0;
}

/* ============================================================================
   Catálogo de trámites (cache por scopeKey)
   ========================================================================== */
const _catalogCache = new Map(); // scopeKey -> { ts, data: { byId, byName, keys[] } }
const CATALOG_TTL_MS = 10 * 60 * 1000;

function makeScopeKey(scope){
  // scope: { type:"all"|"dept", deptId?:number }
  return scope?.type === "dept" ? `dept:${scope.deptId||"0"}` : "all";
}
function cacheGet(scopeKey){
  const v = _catalogCache.get(scopeKey);
  if (!v) return null;
  if (Date.now() - v.ts > CATALOG_TTL_MS) { _catalogCache.delete(scopeKey); return null; }
  return v.data;
}
function cacheSet(scopeKey, data){ _catalogCache.set(scopeKey, { ts: Date.now(), data }); }

async function fetchTramitesCatalog(scope){
  const scopeKey = makeScopeKey(scope);
  const hit = cacheGet(scopeKey);
  if (hit) return hit;

  const url = DONUT_CFG.API_BASE + "ixtla01_c_tramite.php";
  const body = (scope?.type === "dept")
    ? { departamento_id: Number(scope.deptId), all: true, estatus: 1, page:1, per_page: 500 }
    : { all: true, estatus: 1, page:1, per_page: 500 };

  try{
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("HTTP "+res.status);
    const json = await res.json();
    const arr = Array.isArray(json?.data) ? json.data : [];

    // Construir índices
    const byId = new Map();
    const byName = new Map();
    const keys = [];
    arr.forEach(t => {
      const id = Number(t.id);
      const name = String(t.nombre||`Trámite ${id}`);
      byId.set(id, { id, name });
      byName.set(normalizeName(name), { id, name });
      keys.push({ id, name });
    });

    const data = { byId, byName, keys };
    cacheSet(scopeKey, data);
    dlog("Catálogo cargado", scopeKey, { count: keys.length });
    return data;
  } catch (e){
    dwarn("Catálogo de trámites falló; se generará ad-hoc", e);
    // Retornar estructura vacía; el caller podrá generar ad-hoc desde los items
    return { byId: new Map(), byName: new Map(), keys: [] };
  }
}

/* ============================================================================
   Donut Rendering (Canvas 2D)
   ========================================================================== */
function colorFromKey(key, palette){
  const idx = djb2(String(key)) % palette.length;
  return palette[idx];
}

function drawDonut(canvas, data, { innerRatio=0.6 } = {}){
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const cx = W/2, cy = H/2;
  const R = Math.min(W, H) * 0.45;
  const r = R * innerRatio;

  const total = data.reduce((a,s)=>a + (s.value||0), 0);
  if (!total){
    // placeholder "sin datos"
    ctx.fillStyle = "#94A3B8";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Sin datos", cx, cy);
    return;
  }

  let start = -Math.PI / 2;
  data.forEach(s => {
    const ang = (s.value / total) * Math.PI * 2;
    if (!ang) return;
    const end = start + ang;

    // sector
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, start, end);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();

    start = end;
  });

  // “agujero”
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

/* ============================================================================
   Leyenda HTML
   ========================================================================== */
function renderLegend(legendEl, data, total){
  if (!legendEl) return;
  if (!total){
    legendEl.innerHTML = `<div class="hs-donut-legend-empty">Sin datos</div>`;
    return;
  }
  legendEl.innerHTML = data.map(s => {
    const pct = total ? Math.round((s.value/total)*100) : 0;
    return `
      <div class="hs-donut-legend-item">
        <span class="dot" style="background:${s.color};"></span>
        <span class="name">${escapeHtml(s.label)}</span>
        <span class="pct">${pct}%</span>
      </div>
    `;
  }).join("");
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => (
    m === "&" ? "&amp;" : m === "<" ? "&lt;" : m === ">" ? "&gt;" :
    m === '"' ? "&quot;" : "&#39;"
  ));
}

/* ============================================================================
   DonutSmart – API
   ========================================================================== */
export class DonutSmart {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement|string} opts.canvas - canvas o selector
   * @param {HTMLElement|string} [opts.legend] - contenedor leyenda o selector
   * @param {HTMLElement|string} [opts.skeleton] - overlay/skeleton para ocultar cuando termine
   * @param {"all"|"dept"} [opts.scopeType="dept"]
   * @param {number} [opts.deptId=null]
   * @param {string[]} [opts.palette]
   * @param {number} [opts.maxSlices]
   */
  constructor(opts={}){
    this.canvas   = typeof opts.canvas === "string" ? $(opts.canvas) : opts.canvas;
    this.legendEl = typeof opts.legend === "string" ? $(opts.legend) : opts.legend || null;
    this.skeleton = typeof opts.skeleton === "string" ? $(opts.skeleton) : opts.skeleton || null;

    this.scope = {
      type: opts.scopeType === "all" ? "all" : "dept",
      deptId: opts.deptId != null ? Number(opts.deptId) : null
    };

    this.palette = Array.isArray(opts.palette) && opts.palette.length
      ? opts.palette.slice()
      : DONUT_CFG.DEFAULT_PALETTE.slice();

    this.maxSlices = Number.isFinite(opts.maxSlices) ? opts.maxSlices : DONUT_CFG.MAX_SLICES;

    if (!this.canvas) throw new Error("DonutSmart: canvas requerido");
    this._catalog = null;
    this._destroyed = false;
  }

  setPalette(palette){
    if (Array.isArray(palette) && palette.length) {
      this.palette = palette.slice();
    }
  }

  async setScope({ type, deptId=null }){
    this.scope = { type: type==="all" ? "all" : "dept", deptId: deptId!=null ? Number(deptId) : null };
    this._catalog = null; // forzar recarga
    await this._ensureCatalog();
  }

  async _ensureCatalog(){
    if (this._destroyed) return;
    this._catalog = await fetchTramitesCatalog(this.scope);
  }

  _buildAdHocCatalogFromItems(items){
    const byId = new Map();
    const byName = new Map();
    const keys = [];
    items.forEach(it => {
      const id = it?.tramite_id != null ? Number(it.tramite_id) : null;
      const nameRaw = it?.tramite_nombre || it?.tramite || it?.tramiteName;
      if (id != null && !byId.has(id)){
        const name = nameRaw ? String(nameRaw) : `Trámite ${id}`;
        byId.set(id, { id, name });
        keys.push({ id, name });
      } else if (id == null && nameRaw){
        const nn = normalizeName(String(nameRaw));
        if (!byName.has(nn)){
          byName.set(nn, { id:null, name: String(nameRaw) });
          keys.push({ id:null, name: String(nameRaw) });
        }
      }
    });
    return { byId, byName, keys };
  }

  _mapItemToCategory(item){
    const cat = this._catalog || { byId:new Map(), byName:new Map() };
    const tId = item?.tramite_id != null ? Number(item.tramite_id) : null;
    const tNameRaw = item?.tramite_nombre || item?.tramite || item?.tramiteName;

    if (tId != null && cat.byId.has(tId)) {
      const c = cat.byId.get(tId);
      return { key: `id:${tId}`, label: c.name };
    }
    if (tId != null) {
      // id sin catalogar → usamos id como clave, nombre de fallback
      return { key: `id:${tId}`, label: tNameRaw ? String(tNameRaw) : `Trámite ${tId}` };
    }

    if (tNameRaw) {
      const nn = normalizeName(String(tNameRaw));
      if (cat.byName.has(nn)) {
        const c = cat.byName.get(nn);
        // si catalogo trae id null (ad-hoc) igual usamos nombre
        return { key: c.id != null ? `id:${c.id}` : `name:${nn}`, label: c.name };
      }
      return { key: `name:${nn}`, label: String(tNameRaw) };
    }

    // completamente desconocido
    return { key: "otros", label: DONUT_CFG.OTHERS_LABEL };
  }

  _countByCategory(items, targetMonth, targetYear){
    const start = monthStart(targetYear, targetMonth);
    const end   = monthEnd(targetYear, targetMonth);

    const counts = new Map(); // key -> { label, value }
    let total = 0;

    items.forEach(it => {
      const d = parseSqlishDate(it?.created_at || it?.creado || it?.createdAt);
      if (!d || d < start || d > end) return;

      const cat = this._mapItemToCategory(it);
      const prev = counts.get(cat.key) || { label: cat.label, value: 0 };
      prev.value += 1;
      counts.set(cat.key, prev);
      total += 1;
    });

    return { counts, total };
  }

  _assignColors(sortedArr){
    // colores deterministas por key
    return sortedArr.map(s => ({
      ...s,
      color: s.key === "otros" ? DONUT_CFG.OTHERS_COLOR : colorFromKey(s.key, this.palette)
    }));
  }

  _topNWithOthers(countsMap, total){
    // pasar a arreglo y ordenar
    const arr = Array.from(countsMap.entries()).map(([key, v]) => ({ key, label: v.label, value: v.value }));
    arr.sort((a,b) => b.value - a.value || a.label.localeCompare(b.label));

    if (arr.length <= this.maxSlices) return arr;

    const keep = this.maxSlices - 1;
    const head = arr.slice(0, keep);
    const tail = arr.slice(keep);
    const rest = tail.reduce((a,s)=>a+s.value, 0);

    return [
      ...head,
      { key: "otros", label: DONUT_CFG.OTHERS_LABEL, value: rest }
    ];
  }

  _hideSkeleton(){
    if (!this.skeleton) return;
    // soporta tanto overlay div como clase en wrapper
    this.skeleton.style.display = "none";
    this.skeleton.setAttribute("aria-hidden", "true");
  }

  async update(items=[], { month, year } = {}){
    if (this._destroyed) return;

    // mes/año por defecto: actual
    const now = new Date();
    const m = Number.isFinite(month) ? clamp(month, 0, 11) : now.getMonth();
    const y = Number.isFinite(year)  ? year : now.getFullYear();

    // catálogo (si no hay, tratar de cargar; si falla, ad-hoc)
    if (!this._catalog) {
      this._catalog = await fetchTramitesCatalog(this.scope);
    }
    if (!this._catalog || (this._catalog.keys||[]).length === 0) {
      dlog("Usando catálogo ad-hoc desde items…");
      this._catalog = this._buildAdHocCatalogFromItems(items);
    }

    // conteo por categoría
    const { counts, total } = this._countByCategory(items, m, y);
    const limited = this._topNWithOthers(counts, total);
    const colored = this._assignColors(limited);

    // render
    drawDonut(this.canvas, colored, { innerRatio: 0.65 });
    renderLegend(this.legendEl, colored, total);

    // quitar skeleton
    this._hideSkeleton();

    dlog("Donut actualizado", {
      scope: this.scope,
      month: m, year: y,
      total,
      slices: colored.map(s => ({ label:s.label, value:s.value, color:s.color }))
    });
  }

  destroy(){
    this._destroyed = true;
    // limpiar canvas
    const ctx = this.canvas?.getContext("2d");
    if (ctx) ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    if (this.legendEl) this.legendEl.innerHTML = "";
  }
}
