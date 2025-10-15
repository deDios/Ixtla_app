// /JS/charts/donut-chart.js
"use strict";

/**
 * DonutChart
 * - Usa un <canvas> 2D
 * - items: [{ label: string, value: number }]
 * - Paleta estable por etiqueta (hash -> índice paleta) para consistencia.
 * - Dibuja % sobre cada porción (umbral configurable).
 */
export class DonutChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts
   */
  constructor(canvas, opts = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("DonutChart: canvas inválido");
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = window.devicePixelRatio || 1;

    // Defaults
    this.opts = {
      innerRatio: 0.58,           // tamaño del “agujero”
      strokeWidth: 0,             // borde del arco
      showCenterTotal: true,
      centerTitle: "Total del mes",
      centerFont: "600 22px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      centerSubFont: "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      centerColor: "#111827",

      showSlicePercents: true,    // ← dibujar % sobre cada segmento
      minPercentLabel: 4,         // % mínimo para mostrar etiqueta
      labelFont: "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      labelColor: "#111827",

      // Paleta por defecto (puedes agregar más)
      palette: [
        "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#10b981",
        "#6366f1", "#06b6d4", "#eab308", "#f97316", "#14b8a6"
      ],

      // Callback opcional cuando termina de pintar
      onReady: null,
      ...opts,
    };

    this.items = [];
    this.colors = []; // color por item (paralelo a this.items)

    // Hidratar desde data-donut si viene en el canvas
    const dataAttr = this.canvas.getAttribute("data-donut");
    if (dataAttr) {
      try {
        const parsed = JSON.parse(dataAttr);
        if (Array.isArray(parsed)) this.items = normalizeItems(parsed);
      } catch { /* ignore */ }
    }

    this.resizeForDPR();
    if (this.items.length) {
      this.computeColors();
      this.render();
    }
  }

  /** Ajusta el backing-store del canvas al DPR para nitidez */
  resizeForDPR() {
    const { canvas, dpr } = this;
    const w = canvas.width;
    const h = canvas.height;
    // Si el width/height del atributo ya son los “CSS pixels”, escalamos el buffer
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Define data nueva y repinta */
  setData(items) {
    this.items = normalizeItems(items);
    this.computeColors();
    this.render();
  }

  /** Devuelve una copia de los items actuales */
  getData() {
    return this.items.map(i => ({ ...i }));
  }

  /** Color de un índice */
  getColor(i) {
    return this.colors[i] || "#cbd5e1";
  }

  /** Hash estable por label → índice de paleta */
  labelToPaletteIndex(label) {
    const s = String(label || "");
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) | 0;
    }
    if (hash < 0) hash = -hash;
    return hash % this.opts.palette.length;
  }

  /** Calcula this.colors siguiendo la paleta estable por etiqueta */
  computeColors() {
    this.colors = this.items.map(it => {
      const idx = this.labelToPaletteIndex(it.label);
      return this.opts.palette[idx];
    });
  }

  /** Limpia el canvas */
  clear() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /** Render principal */
  render() {
    const { ctx, canvas } = this;
    this.clear();

    const cssW = canvas.width / this.dpr;
    const cssH = canvas.height / this.dpr;
    const cx = cssW / 2;
    const cy = cssH / 2;
    const radius = Math.min(cx, cy) * 0.9;
    const innerR = radius * this.opts.innerRatio;

    const total = this.items.reduce((s, it) => s + (Number(it.value) || 0), 0);
    const twoPI = Math.PI * 2;

    // Arco por segmento
    let startAngle = -Math.PI / 2; // inicia arriba
    this.items.forEach((it, i) => {
      const val = Math.max(0, Number(it.value) || 0);
      const frac = total > 0 ? (val / total) : 0;
      const endAngle = startAngle + frac * twoPI;

      // Donut slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle, false);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = this.colors[i] || "#cbd5e1";
      ctx.fill();

      if (this.opts.strokeWidth > 0) {
        ctx.lineWidth = this.opts.strokeWidth;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      }

      // Porcentaje sobre el aro
      if (this.opts.showSlicePercents && total > 0) {
        const pct = (val / total) * 100;
        if (pct >= this.opts.minPercentLabel) {
          const mid = (startAngle + endAngle) / 2;
          const labelR = (radius + innerR) / 2; // mitad del aro
          const lx = cx + Math.cos(mid) * labelR;
          const ly = cy + Math.sin(mid) * labelR;

          ctx.save();
          ctx.fillStyle = this.opts.labelColor;
          ctx.font = this.opts.labelFont;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${Math.round(pct)}%`, lx, ly);
          ctx.restore();
        }
      }

      startAngle = endAngle;
    });

    // Agujero (por si hay aliasing)
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, twoPI);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Centro: total y subtítulo
    if (this.opts.showCenterTotal) {
      ctx.save();
      ctx.fillStyle = this.opts.centerColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // número grande
      ctx.font = this.opts.centerFont;
      ctx.fillText(String(total), cx, cy - 6);

      // subtítulo
      ctx.font = this.opts.centerSubFont;
      ctx.fillText(this.opts.centerTitle, cx, cy + 14);
      ctx.restore();
    }

    // Ocultar skeleton si existe
    const sk = this.canvas.parentElement?.querySelector(".hs-chart-skeleton");
    if (sk) sk.style.display = "none";

    // callback
    this.opts.onReady?.(this);
  }

  /** Atajo: si el canvas trae data-donut, instancia y pinta */
  static fromCanvas(canvas, opts = {}) {
    return new DonutChart(canvas, opts);
  }

  destroy() {
    // Por ahora no hay listeners. Método previsto para futuro.
    this.clear();
  }
}

/* ------------------------------------------------------------------------------------
 * Utilities
 * ----------------------------------------------------------------------------------*/

/** Normaliza [{label, value}] y filtra valores no numéricos */
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map(it => ({
      label: String(it?.label ?? "—"),
      value: Number(it?.value ?? 0)
    }))
    .filter(it => Number.isFinite(it.value) && it.value >= 0);
}

/**
 * Vincula una UL con li[data-label] .bullet y .pct a un donut (colores y %).
 * @param {HTMLElement} ul    <ul id="donut-legend"> … </ul>
 * @param {DonutChart} donut  instancia del donut
 * @param {Array} itemsOverride (opcional) para forzar items distintos a los del donut
 */
export function bindDonutLegend(ul, donut, itemsOverride = null) {
  if (!ul || !donut) return;
  const items = Array.isArray(itemsOverride) ? normalizeItems(itemsOverride) : donut.getData();
  const total = items.reduce((s, it) => s + (Number(it.value) || 0), 0) || 0;

  // Mapa label → color real usado en el donut
  const colorByLabel = new Map(items.map((it, i) => [it.label, donut.getColor(i)]));

  ul.querySelectorAll("li").forEach(li => {
    const label  = li.getAttribute("data-label");
    const bullet = li.querySelector(".bullet");
    const pctEl  = li.querySelector(".pct");

    const item  = items.find(x => x.label === label);
    const color = colorByLabel.get(label) || "#cbd5e1";
    if (bullet) bullet.style.background = color;

    if (pctEl) {
      const pct = total > 0 && item ? Math.round((item.value / total) * 100) : 0;
      pctEl.textContent = total ? ` ${pct}%` : "";
    }
  });
}
