// /JS/charts/donut-chart.js
export class DonutChart {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.wrap = canvas.parentElement || document.body;
    this.tip = this.wrap.querySelector(".chart-tip") || this._createTip();

    // Opciones
    const ds = canvas.dataset || {};
    let dataFromDS = [];
    try { dataFromDS = ds.donut ? JSON.parse(ds.donut) : []; } catch {}
    this.data = Array.isArray(opts.data) && opts.data.length ? opts.data : dataFromDS;

    this.palette = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : [
      "#3b82f6","#22c55e","#f59e0b","#ef4444","#6366f1",
      "#10b981","#06b6d4","#eab308","#f97316","#a855f7"
    ];
    // Mapa opcional: { "Fuga de agua": "#xxxxxx", ... }
    this.paletteMap = opts.paletteMap || null;

    this.total = Number.isFinite(opts.total)
      ? opts.total
      : this.data.reduce((a, b) => a + (Number(b.value) || 0), 0);

    this.legendEl = opts.legendEl || null;
    this.legendBullets = opts.legendBullets !== false;
    this.showPercLabels = opts.showPercLabels !== false;

    // Estado interno
    this._segments = [];
    this._hoverIdx = -1;
    this._skeletonCleared = false;

    // Bind
    this._bind();

    // Intentar dibujo: si no hay layout aún, esperar a que exista ancho/alto
    this._ensureFirstLayout().then(() => {
      this._setupCanvasScale();
      this.draw(true);       // primer draw (intenta quitar skeleton)
      this.renderLegend();
    });

    // Redibujo en resize
    this._ro = new ResizeObserver(() => {
      this._setupCanvasScale();
      this.draw();
    });
    this._ro.observe(this.c);
  }

  /* ---------- Utils de color determinista ---------- */
  _hashColor(label) {
    // Asigna color determinista por etiqueta
    if (!label) return this.palette[0];
    let h = 0;
    for (let i=0; i<label.length; i++) h = (h*31 + label.charCodeAt(i)) >>> 0;
    return this.palette[h % this.palette.length];
  }
  _colorFor(label, idx) {
    if (this.paletteMap && this.paletteMap[label]) return this.paletteMap[label];
    return this.palette[idx % this.palette.length];
  }

  /* ---------- Tip ---------- */
  _createTip() {
    const d = document.createElement("div");
    d.className = "chart-tip";
    d.style.cssText = "position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;";
    this.wrap.appendChild(d);
    return d;
  }

  /* ---------- Esperar layout si clientWidth es 0 ---------- */
  async _ensureFirstLayout() {
    let tries = 0;
    while ((this.c.clientWidth === 0 || this.c.clientHeight === 0) && tries < 30) {
      await new Promise(r => requestAnimationFrame(r));
      tries++;
    }
    // Fallback último: usar ancho/alto del atributo o valores base
    if (this.c.clientWidth === 0) this.c.style.width = (this.c.width || 380) + "px";
    if (this.c.clientHeight === 0) this.c.style.height = (this.c.height || 240) + "px";
  }

  /* ---------- Escala por DPR y tamaño actual ---------- */
  _setupCanvasScale() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, this.c.clientWidth || this.c.width || 380);
    const h = Math.max(1, this.c.clientHeight || this.c.height || 240);
    this.c.width = Math.round(w * dpr);
    this.c.height = Math.round(h * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.cx = w / 2;
    this.cy = h / 2;
    this.outerR = Math.min(w, h) * 0.42;
    this.innerR = this.outerR * 0.58;
  }

  /* ---------- Interacciones ---------- */
  _bind() {
    this.c.addEventListener("mousemove", (e) => {
      if (!this._segments.length) return;
      const rect = this.c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dx = mx - this.cx;
      const dy = my - this.cy;
      const r = Math.hypot(dx, dy);

      if (r < this.innerR || r > this.outerR * 1.15) {
        this._hoverIdx = -1;
        this.tip.style.opacity = "0";
        this.draw();
        return;
      }
      let ang = Math.atan2(dy, dx);
      if (ang < -Math.PI / 2) ang += Math.PI * 2; // normaliza relativo a -PI/2

      const hit = this._segments.findIndex(s => ang >= s.start && ang < s.end);
      this._hoverIdx = hit;
      if (hit >= 0) {
        const seg = this._segments[hit];
        const pct = this.total > 0 ? Math.round((seg.value / this.total) * 100) : 0;
        this.tip.textContent = `${seg.label}: ${seg.value} (${pct}%)`;
        this.tip.style.left = `${mx}px`;
        this.tip.style.top = `${my}px`;
        this.tip.style.opacity = "1";
      } else {
        this.tip.style.opacity = "0";
      }
      this.draw();
    });

    this.c.addEventListener("mouseleave", () => {
      this._hoverIdx = -1;
      this.tip.style.opacity = "0";
      this.draw();
    });
  }

  /* ---------- Datos a segmentos ---------- */
  _computeSegments() {
    this._segments = [];
    if (!this.data?.length || this.total <= 0) return;

    let start = -Math.PI / 2;
    this.data.forEach((item, i) => {
      const value = Number(item.value || 0);
      if (value <= 0) return;
      const ang = (value / this.total) * Math.PI * 2;
      this._segments.push({
        i,
        label: item.label || "—",
        value,
        color: this._colorFor(item.label, i),
        start,
        end: start + ang
      });
      start += ang;
    });
  }

  /* ---------- Dibujo ---------- */
  draw(tryClearSkeleton = false) {
    const ctx = this.ctx;
    const w = Math.max(1, this.c.clientWidth || this.c.width);
    const h = Math.max(1, this.c.clientHeight || this.c.height);

    ctx.clearRect(0, 0, w, h);

    if (!this.data?.length || this.total <= 0) {
      // Fondo neutro
      ctx.fillStyle = "#e8eef5";
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.outerR, 0, Math.PI * 2);
      ctx.fill();
      this._drawCenter("0", "Total del mes");
      this._segments = [];
      if (tryClearSkeleton) this._clearSkeletons();
      return;
    }

    this._computeSegments();

    // Segmentos
    this._segments.forEach((s, idx) => {
      const isHover = idx === this._hoverIdx;
      const rOuter = isHover ? this.outerR * 1.06 : this.outerR;
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.fillStyle = s.color;
      ctx.arc(this.cx, this.cy, rOuter, s.start, s.end);
      ctx.closePath();
      ctx.fill();

      // % sobre anillo
      if (this.showPercLabels) {
        const mid = (s.start + s.end) / 2;
        const rx = this.cx + Math.cos(mid) * (this.innerR + (this.outerR - this.innerR) * 0.65);
        const ry = this.cy + Math.sin(mid) * (this.innerR + (this.outerR - this.innerR) * 0.65);
        const pct = this.total > 0 ? Math.round((s.value / this.total) * 100) : 0;
        ctx.fillStyle = "#111827";
        ctx.font = "12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${pct}%`, rx, ry);
      }
    });

    // “Recorte” interior
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.innerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    this._drawCenter(String(this.total), "Total del mes");

    if (tryClearSkeleton) this._clearSkeletons();
  }

  _drawCenter(big, small) {
    const ctx = this.ctx;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(big, this.cx, this.cy - 8);

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(small, this.cx, this.cy + 14);
  }

  _clearSkeletons() {
    if (this._skeletonCleared) return;
    this._skeletonCleared = true;
    this.wrap.querySelectorAll(".hs-chart-skeleton")?.forEach(el => el.remove());
  }

  /* ---------- Leyenda ---------- */
  renderLegend() {
    if (!this.legendEl) return;
    const total = this.total || 1;
    this.legendEl.innerHTML = "";
    this.data.forEach((item, i) => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = ".5rem";

      const dot = document.createElement("span");
      dot.className = "bullet";
      dot.style.cssText =
        `display:inline-block;width:.75rem;height:.75rem;border-radius:999px;background:${this._colorFor(item.label,i)};`;

      const t = document.createElement("span");
      t.className = "t";
      t.textContent = item.label || "—";

      const pct = document.createElement("span");
      pct.className = "pct";
      pct.textContent = ` ${Math.round((Number(item.value||0) / total) * 100)}%`;

      li.appendChild(dot);
      li.appendChild(t);
      li.appendChild(pct);
      this.legendEl.appendChild(li);
    });
  }

  /* ---------- API público para refrescar ---------- */
  update({ data, total, colors, paletteMap } = {}) {
    if (Array.isArray(data)) this.data = data;
    if (Number.isFinite(total)) this.total = total;
    if (Array.isArray(colors) && colors.length) this.palette = colors.slice();
    if (paletteMap) this.paletteMap = paletteMap;

    // Redibujar
    this._setupCanvasScale();
    this.draw(true);
    this.renderLegend();
  }
}