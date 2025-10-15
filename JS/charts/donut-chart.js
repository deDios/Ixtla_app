// /JS/charts/donut-chart.js
"use strict";

/**
 * DonutChart
 * Canvas donut with percentages, center label and hover tooltip.
 * - No external deps.
 * - Call `new DonutChart(canvas, data, opts)` and optionally `bindDonutLegend(ul, donut)`.
 */

export class DonutChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{label:string, value:number}>} data
   * @param {Object} opts
   */
  constructor(canvas, data = [], opts = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("DonutChart: canvas requerido");
    }

    this.canvas = canvas;
    this.ctx    = canvas.getContext("2d");
    this.wrap   = canvas.closest(".hs-chart-wrap") || canvas.parentElement;

    // Options
    this.opts = Object.assign(
      {
        palette: [
          "#3b82f6", // 0  azul
          "#22c55e", // 1  verde
          "#f59e0b", // 2  ámbar
          "#ef4444", // 3  rojo
          "#6366f1", // 4  índigo
          "#06b6d4", // 5  cian
          "#eab308", // 6  amarillo
          "#f97316", // 7  naranja
          "#14b8a6", // 8  teal
          "#a855f7", // 9  púrpura
        ],
        bgTrack: "#e5ebf0",     // anillo de fondo (si hay “resto” cero, no se muestra)
        textColor: "#111827",   // textos
        centerTextColor: "#111827",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        innerRatio: 0.60,       // 0..1
        labelMinPercent: 4,     // no mostrar % menores a este valor en el aro
        showCenterTotal: true,
        centerTextFn: (total) => String(total),
        centerSubText: "Total del mes",
        // Accessors
        getLabel: (d) => d?.label ?? "—",
        getValue: (d) => Number(d?.value ?? 0),
      },
      opts || {}
    );

    this._data = [];
    this._arcs = []; // {start,end,color,label,percent}
    this._total = 0;
    this._tooltip = null;

    // Build tooltip container once
    this._ensureTooltip();

    // Resize handling
    this._onResize = () => this._draw();
    window.addEventListener("resize", this._onResize);

    // Mouse events
    this.canvas.addEventListener("mousemove", (e) => this._onMove(e));
    this.canvas.addEventListener("mouseleave", () => this._hideTip());

    // Hydrate from data-donut attribute if needed
    if (!data.length) {
      try {
        const attr = canvas.getAttribute("data-donut");
        if (attr) data = JSON.parse(attr);
      } catch {}
    }

    this.updateData(data);

    // Hide/remove skeleton if present
    this._hideSkeleton();
  }

  destroy() {
    window.removeEventListener("resize", this._onResize);
    this.canvas.removeEventListener("mousemove", this._onMove);
    this.canvas.removeEventListener("mouseleave", this._hideTip);
    this._hideTip(true);
  }

  get total() { return this._total; }
  get arcs()  { return this._arcs.slice(); }

  updateData(data = []) {
    // Normalize & compute
    const getLabel = this.opts.getLabel;
    const getValue = this.opts.getValue;

    this._data = (Array.isArray(data) ? data : []).map((d) => ({
      label: String(getLabel(d)),
      value: Math.max(0, Number(getValue(d) || 0))
    }));

    this._total = this._data.reduce((a, b) => a + b.value, 0);

    // Map to arcs with angles
    const TAU = Math.PI * 2;
    let acc = 0;
    this._arcs = this._data.map((d, i) => {
      const pct = this._total ? (d.value / this._total) * 100 : 0;
      const ang = this._total ? (d.value / this._total) * TAU : 0;
      const start = acc;
      const end = acc + ang;
      acc = end;
      return {
        start, end, percent: pct,
        label: d.label,
        color: this.opts.palette[i % this.opts.palette.length],
        value: d.value
      };
    });

    this._draw();
  }

  _px(n) { return Math.round(n * (window.devicePixelRatio || 1)); }

  _setupCanvasSize() {
    // Keep the CSS width/height as layout, set internal buffer with DPR
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const cssW = rect.width || this.canvas.width;
    const cssH = rect.height || this.canvas.height;

    this.canvas.width  = Math.max(1, Math.floor(cssW * dpr));
    this.canvas.height = Math.max(1, Math.floor(cssH * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { w: cssW, h: cssH };
  }

  _draw() {
    const { ctx } = this;
    const { w, h } = this._setupCanvasSize();

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Radio exterior toma el menor lado con padding
    const R = Math.max(10, Math.min(w, h) * 0.44);
    const r = Math.max(5, R * (this.opts.innerRatio || 0.6));

    // Track (gris claro), opcional si hay espacio libre
    if (this._arcs.length === 0 || this._total === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = this.opts.bgTrack;
      ctx.lineWidth = Math.max(10, R - r);
      ctx.stroke();
      this._drawCenter(cx, cy);
      return;
    }

    // Dibuja porciones
    ctx.lineWidth = Math.max(10, R - r);
    ctx.lineCap = "butt";

    for (const a of this._arcs) {
      ctx.beginPath();
      ctx.arc(cx, cy, (R + r) / 2, a.start, a.end);
      ctx.strokeStyle = a.color;
      ctx.stroke();
    }

    // Etiquetas (% sobre el aro)
    ctx.fillStyle = this.opts.textColor;
    ctx.font = `600 12px ${this.opts.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const minPct = Number(this.opts.labelMinPercent || 0);
    for (const a of this._arcs) {
      if (a.percent < minPct) continue;
      const mid = (a.start + a.end) / 2;
      const rr = (R + r) / 2; // sobre el aro
      const tx = cx + Math.cos(mid) * rr;
      const ty = cy + Math.sin(mid) * rr;
      ctx.fillText(`${Math.round(a.percent)}%`, tx, ty);
    }

    // Centro
    this._drawCenter(cx, cy);
  }

  _drawCenter(cx, cy) {
    if (!this.opts.showCenterTotal) return;
    const ctx = this.ctx;
    const total = this._total;

    ctx.save();
    ctx.fillStyle = this.opts.centerTextColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = `700 24px ${this.opts.fontFamily}`;
    ctx.fillText(this.opts.centerTextFn(total), cx, cy - 2);

    ctx.font = `400 11px ${this.opts.fontFamily}`;
    ctx.fillText(this.opts.centerSubText || "", cx, cy + 16);
    ctx.restore();
  }

  _ensureTooltip() {
    if (this._tooltip) return;
    const tip = document.createElement("div");
    tip.className = "chart-tip";
    Object.assign(tip.style, {
      position: "absolute",
      pointerEvents: "none",
      padding: ".35rem .5rem",
      borderRadius: ".5rem",
      background: "#1f2937",
      color: "#fff",
      font: "12px/1.2 system-ui",
      opacity: "0",
      transform: "translate(-50%,-120%)",
      transition: "opacity .12s"
    });
    (this.wrap || this.canvas.parentElement).appendChild(tip);
    this._tooltip = tip;
  }

  _showTip(x, y, text) {
    if (!this._tooltip) return;
    this._tooltip.textContent = text;
    this._tooltip.style.left = `${x}px`;
    this._tooltip.style.top  = `${y}px`;
    this._tooltip.style.opacity = "1";
  }
  _hideTip(force = false) {
    if (!this._tooltip) return;
    if (force) {
      this._tooltip.remove();
      this._tooltip = null;
      return;
    }
    this._tooltip.style.opacity = "0";
  }

  _onMove(evt) {
    if (!this._arcs.length || !this._total) { this._hideTip(); return; }

    const rect = this.canvas.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const py = evt.clientY - rect.top;

    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.hypot(dx, dy);

    // R y r deben coincidir con _draw()
    const R = Math.max(10, Math.min(rect.width, rect.height) * 0.44);
    const r = Math.max(5, R * (this.opts.innerRatio || 0.6));
    const midRadius = (R + r) / 2;

    // check ring hit
    if (dist < r * 0.9 || dist > R * 1.1) { this._hideTip(); return; }

    // angle 0 at +X, counterclockwise, normalized to [0, 2π)
    let ang = Math.atan2(dy, dx);
    if (ang < 0) ang += Math.PI * 2;

    // find arc
    const arc = this._arcs.find(a => ang >= a.start && ang <= a.end);
    if (!arc) { this._hideTip(); return; }

    const text = `${arc.label}: ${Math.round(arc.percent)}%`;
    // Position the tip slightly outward from the midpoint angle
    const mid = (arc.start + arc.end) / 2;
    const tx = cx + Math.cos(mid) * midRadius;
    const ty = cy + Math.sin(mid) * midRadius - 6;

    this._showTip(tx, ty, text);
  }

  _hideSkeleton() {
    const sk = this.wrap?.querySelector?.(".hs-chart-skeleton");
    if (sk) sk.remove();
  }
}

/**
 * bindDonutLegend
 * Colorea bullets + coloca los porcentajes calculados en la <ul> de leyenda.
 * La <ul> debe contener <li data-label="..."><span class="bullet"></span> ... <span class="pct"></span></li>
 * @param {HTMLElement} ul
 * @param {DonutChart} donut
 */
export function bindDonutLegend(ul, donut) {
  if (!ul || !donut) return;
  const items = Array.from(ul.querySelectorAll("li[data-label]"));
  const byLabel = new Map(donut.arcs.map(a => [a.label, a]));
  items.forEach(li => {
    const key = li.getAttribute("data-label");
    const arc = byLabel.get(key);
    const bullet = li.querySelector(".bullet");
    const pct = li.querySelector(".pct");
    if (arc) {
      if (bullet) bullet.style.background = arc.color;
      if (pct) pct.textContent = ` ${Math.round(arc.percent)}%`;
      li.style.opacity = "1";
    } else {
      if (bullet) bullet.style.background = "#cbd5e1";
      if (pct) pct.textContent = "";
      li.style.opacity = ".6";
    }
  });
}

export function initDonutFromCanvas(canvas, opts = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  let data = [];
  try {
    const attr = canvas.getAttribute("data-donut");
    if (attr) data = JSON.parse(attr);
  } catch {}
  const donut = new DonutChart(canvas, data, opts);
  // Buscar una UL “cercana” para la leyenda
  const ul = canvas.closest(".hs-card")?.querySelector("#donut-legend") ||
             canvas.parentElement?.nextElementSibling;
  if (ul instanceof HTMLElement) bindDonutLegend(ul, donut);
  return donut;
}

