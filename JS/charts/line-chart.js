// /JS/charts/line-chart.js
export class LineChart {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.wrap = canvas.parentElement;
    this.tip = this.wrap.querySelector(".chart-tip") || this._createTip();

    // Datos desde opciones o data-*
    const ds = canvas.dataset || {};
    let labelsFromDS = null;
    let seriesFromDS = null;

    try {
      labelsFromDS = ds.labelsYear ? JSON.parse(ds.labelsYear) : null;
    } catch {}
    try {
      seriesFromDS = ds.seriesYear ? JSON.parse(ds.seriesYear) : null;
    } catch {}

    this.labels = Array.isArray(opts.labels)
      ? opts.labels
      : Array.isArray(labelsFromDS)
      ? labelsFromDS
      : [];

    const rawSeries = Array.isArray(opts.series)
      ? opts.series
      : Array.isArray(seriesFromDS)
      ? seriesFromDS
      : [];

    // Control: cuántas líneas máximo mostrar (años más recientes)
    this.linecount = Number.isFinite(opts.linecount)
      ? opts.linecount
      : Number.isFinite(opts.maxLines)
      ? opts.maxLines
      : 5;

    // Opciones visuales
    this.showDots = opts.showDots !== false;
    this.showGrid = opts.showGrid !== false;
    this.headroom = Number.isFinite(opts.headroom) ? opts.headroom : 0.1;
    this.yTicks = Number.isFinite(opts.yTicks) ? opts.yTicks : 5;
    this.maxYHint = Number.isFinite(opts.maxY) ? opts.maxY : null;

    // Leyenda opcional (si existe un ul/div .chart-legend dentro del wrapper)
    this.legendEl =
      opts.legendEl || this.wrap.querySelector(".chart-legend") || null;

    // Paleta (determinista por nombre de serie)
    this.palette =
      Array.isArray(opts.colors) && opts.colors.length
        ? opts.colors
        : [
            "#2563eb",
            "#16a34a",
            "#f59e0b",
            "#ef4444",
            "#8b5cf6",
            "#06b6d4",
            "#f97316",
            "#22c55e",
            "#e11d48",
            "#0ea5e9",
          ];

    this.colorNewest = opts.colorNewest || "#16a34a"; // verde para la actual
    this.colorPrev = opts.colorPrev || "#94a3b8"; // gris para la anterior

    // Estilo
    this.colorAxis = "#cbd5e1";
    this.colorGrid = "rgba(203,213,225,.5)";
    this.colorHover = "#111827";

    // Estado hover
    this._hoverX = -1;
    this._hoverSeries = -1; // ✅ serie activa por cercanía al mouse
    this._ptsBySeries = [];

    // Normaliza series (legacy / multi)
    this.series = this._normalizeSeries(rawSeries);

    this._setupCanvasScale();
    this._bind();
    this.draw();
    this._renderLegend();
  }

  /* =========================
   *  API pública
   * ========================= */
  update({
    labels,
    series,
    maxY,
    headroom,
    yTicks,
    showGrid,
    showDots,
    linecount,
  } = {}) {
    if (Array.isArray(labels)) this.labels = labels.slice();
    if (Number.isFinite(linecount)) this.linecount = linecount;

    if (Array.isArray(series)) this.series = this._normalizeSeries(series);

    if (Number.isFinite(maxY)) this.maxYHint = maxY;
    if (Number.isFinite(headroom)) this.headroom = headroom;
    if (Number.isFinite(yTicks)) this.yTicks = yTicks;
    if (typeof showGrid === "boolean") this.showGrid = showGrid;
    if (typeof showDots === "boolean") this.showDots = showDots;

    this._setupCanvasScale();
    this._hoverX = -1;
    this._hoverSeries = -1;
    this.tip.style.opacity = "0";
    this.draw();
    this._renderLegend();
  }

  /* =========================
   *  Helper (para Home): agrupar por año/mes
   * ========================= */
  static buildYearSeries(
    items,
    { linecount = 5, dateKey = "created_at" } = {}
  ) {
    const labels = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    const map = new Map(); // year -> [12]

    for (const r of items || []) {
      const raw =
        r?.[dateKey] ??
        r?.created_at ??
        r?.fecha_creacion ??
        r?.createdAt ??
        r?.created ??
        null;

      if (!raw) continue;

      const d = new Date(String(raw).replace(" ", "T"));
      if (Number.isNaN(d.getTime())) continue;

      const y = d.getFullYear();
      const m = d.getMonth();

      if (!map.has(y)) map.set(y, Array(12).fill(0));
      map.get(y)[m] += 1;
    }

    const years = Array.from(map.keys()).sort((a, b) => a - b);
    const lastYears = years.slice(-Math.max(1, linecount));

    const series = lastYears.map((y) => ({
      name: String(y),
      data: map.get(y),
    }));

    return { labels, series };
  }

  /* =========================
   *  Internals
   * ========================= */
  _setupCanvasScale() {
    const dpr = window.devicePixelRatio || 1;
    this.c.width = Math.max(1, this.c.clientWidth) * dpr;
    this.c.height = Math.max(1, this.c.clientHeight) * dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  _createTip() {
    const d = document.createElement("div");
    d.className = "chart-tip";
    d.style.cssText =
      "position:absolute;pointer-events:none;padding:.5rem .6rem;border-radius:.6rem;background:#111827;color:#fff;font:12px/1.25 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;white-space:nowrap;box-shadow:0 12px 30px rgba(0,0,0,.18);";
    this.wrap.appendChild(d);
    return d;
  }

  _normalizeSeries(raw) {
    // Legacy: [1,2,3]
    const isLegacy =
      raw.length && raw.every((n) => typeof n === "number" || n == null);
    if (isLegacy) {
      return [
        {
          name: "Serie",
          data: raw.map((v) => Number(v || 0)),
        },
      ];
    }

    // Nuevo: [{name, data}] o [{name, series}]
    const list = (raw || [])
      .filter((s) => s && (Array.isArray(s.data) || Array.isArray(s.series)))
      .map((s, i) => {
        const dataArr = Array.isArray(s.data) ? s.data : s.series;
        return {
          name: String(s.name ?? s.label ?? `Serie ${i + 1}`),
          data: dataArr.map((v) => Number(v || 0)),
        };
      });

    // Si parecen años, ordena por año
    const years = list.length && list.every((s) => /^\d{4}$/.test(s.name));
    if (years) list.sort((a, b) => Number(a.name) - Number(b.name));

    // Limita a los últimos linecount
    if (list.length > this.linecount) return list.slice(-this.linecount);

    return list;
  }

  _hashColor(label) {
    // Regla especial para series por año (YYYY):
    // - la más reciente (última) verde
    // - la anterior (penúltima) gris
    // (solo cuando hay 2+ series y parecen años)
    const isYear = label && /^\d{4}$/.test(String(label));

    if (isYear && Array.isArray(this.series) && this.series.length) {
      const years = this.series.every((s) => /^\d{4}$/.test(String(s.name)));
      if (years) {
        const idx = this.series.findIndex(
          (s) => String(s.name) === String(label)
        );
        const last = this.series.length - 1;
        if (idx === last) return this.colorNewest; // más reciente
        if (idx === last - 1) return this.colorPrev; // anterior
        // otros (si linecount > 2) caen a paleta normal
      }
    }

    // Default determinista por nombre
    if (!label) return this.palette[0];
    let h = 0;
    const str = String(label);
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return this.palette[h % this.palette.length];
  }

  _niceNum(range, round) {
    const exp = Math.floor(Math.log10(range || 1));
    const f = range / Math.pow(10, exp);
    let nf;
    if (round) {
      if (f < 1.5) nf = 1;
      else if (f < 3) nf = 2;
      else if (f < 7) nf = 5;
      else nf = 10;
    } else {
      if (f <= 1) nf = 1;
      else if (f <= 2) nf = 2;
      else if (f <= 5) nf = 5;
      else nf = 10;
    }
    return nf * Math.pow(10, exp);
  }

  _niceScale(min, max, ticks) {
    const range = this._niceNum(max - min, false);
    const step = this._niceNum(range / Math.max(1, ticks - 1), true);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    return { niceMin, niceMax, step };
  }

  _bind() {
    this.c.addEventListener("mousemove", (e) => {
      if (!this._ptsBySeries.length) return;

      const rect = this.c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Índice X (mes) por cercanía usando la primera serie como referencia
      const ref = this._ptsBySeries[0] || [];
      if (!ref.length) return;

      let idx = 0,
        bestX = Infinity;
      for (let i = 0; i < ref.length; i++) {
        const dx = Math.abs(ref[i].x - mx);
        if (dx < bestX) {
          bestX = dx;
          idx = i;
        }
      }
      this._hoverX = idx;

      // Serie más cercana al cursor (por distancia en Y en ese mismo idx)
      let bestS = -1,
        bestD = Infinity;
      for (let si = 0; si < this._ptsBySeries.length; si++) {
        const pts = this._ptsBySeries[si] || [];
        const p = pts[idx];
        if (!p) continue;
        const dy = Math.abs(p.y - my);
        if (dy < bestD) {
          bestD = dy;
          bestS = si;
        }
      }
      this._hoverSeries = bestS;

      const label = this.labels?.[idx] ?? `#${idx + 1}`;

      // Orden tooltip: serie activa primero
      const order = this.series.map((_, i) => i);
      if (bestS >= 0) {
        order.sort((a, b) => (a === bestS ? -1 : b === bestS ? 1 : 0));
      }

      const rows = order
        .map((si) => {
          const s = this.series[si];
          const v = s?.data?.[idx] ?? 0;
          const color = this._hashColor(s?.name);
          const isActive = si === bestS;

          return `
          <div style="display:flex;align-items:center;gap:.45rem;${
            isActive ? "font-weight:700;" : ""
          }">
            <span style="width:.6rem;height:.6rem;border-radius:999px;background:${color};display:inline-block;"></span>
            <span>${s.name}</span>
            <span style="opacity:.9;">:</span>
            <span>${v}</span>
          </div>
        `;
        })
        .join("");

      this.tip.innerHTML = `
        <div style="font-weight:700;margin-bottom:.25rem;">${label}</div>
        <div style="display:grid;gap:.2rem;">${rows}</div>
      `;

      // Ancla del tooltip: punto de la serie activa (o serie 0)
      const anchorSeries = bestS >= 0 ? bestS : 0;
      const anchor = (this._ptsBySeries[anchorSeries] || [])[idx] || ref[idx];

      this.tip.style.left = `${anchor.x}px`;
      this.tip.style.top = `${anchor.y}px`;
      this.tip.style.opacity = "1";

      this.draw(true);
    });

    this.c.addEventListener("mouseleave", () => {
      this._hoverX = -1;
      this._hoverSeries = -1;
      this.tip.style.opacity = "0";
      this.draw();
    });

    const ro = new ResizeObserver(() => {
      this._setupCanvasScale();
      this.draw();
    });
    ro.observe(this.c);
  }

  _renderLegend() {
    if (!this.legendEl) return;
    this.legendEl.innerHTML = "";
    this.series.forEach((s) => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = ".5rem";

      const dot = document.createElement("span");
      dot.style.cssText = `display:inline-block;width:.75rem;height:.75rem;border-radius:999px;background:${this._hashColor(
        s.name
      )};`;

      const t = document.createElement("span");
      t.textContent = s.name;

      li.appendChild(dot);
      li.appendChild(t);
      this.legendEl.appendChild(li);
    });
  }

  draw() {
    const ctx = this.ctx;
    const w = this.c.clientWidth;
    const h = this.c.clientHeight;

    const pad = { top: 18, right: 10, bottom: 28, left: 32 };

    ctx.clearRect(0, 0, w, h);

    // Eje X base
    ctx.strokeStyle = this.colorAxis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    if (!this.series?.length) return;

    // max global (todas las series)
    const allVals = this.series.flatMap((s) => s.data || []);
    const rawMax = Math.max(0, ...allVals);
    const hinted = this.maxYHint != null ? this.maxYHint : rawMax;
    const withHeadroom = hinted * (1 + Math.max(0, this.headroom));
    const { niceMax, step } = this._niceScale(0, withHeadroom, this.yTicks);
    const yMax = Math.max(1, niceMax);

    const toX = (i, nPoints) => {
      const n = Math.max(1, (nPoints || 1) - 1);
      return pad.left + (i * (w - pad.left - pad.right)) / n;
    };
    const toY = (v) => {
      const usable = h - pad.top - pad.bottom;
      const clamped = Math.max(0, Math.min(v, yMax));
      return pad.top + usable * (1 - clamped / yMax);
    };

    // Grid horizontal
    if (this.showGrid && step > 0) {
      ctx.strokeStyle = this.colorGrid;
      ctx.lineWidth = 1;
      for (let yv = 0; yv <= yMax + 1e-9; yv += step) {
        const yPix = toY(yv);
        ctx.beginPath();
        ctx.moveTo(pad.left, yPix);
        ctx.lineTo(w - pad.right, yPix);
        ctx.stroke();
      }
    }

    // puntos por serie
    this._ptsBySeries = this.series.map((s) => {
      const n = Math.max(this.labels.length, s.data.length);
      const data = s.data || [];
      return Array.from({ length: n }, (_, i) => ({
        x: toX(i, n),
        y: toY(data[i] ?? 0),
        val: data[i] ?? 0,
        label: this.labels?.[i] ?? `#${i + 1}`,
      }));
    });

    // Dibuja líneas + dots
    this.series.forEach((s, si) => {
      const pts = this._ptsBySeries[si] || [];
      if (!pts.length) return;

      const color = this._hashColor(s.name);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      if (this.showDots) {
        pts.forEach((p, i) => {
          const isSameX = this._hoverX === i;
          const isHover =
            this._hoverX === i &&
            (this._hoverSeries < 0 || this._hoverSeries === si);

          ctx.fillStyle = isHover ? this.colorHover : color;
          const r = isHover ? 5 : isSameX ? 4 : 3;

          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    // guía vertical del hover
    if (this._hoverX >= 0) {
      const ref = this._ptsBySeries[0] || [];
      const p = ref[this._hoverX];
      if (p) {
        ctx.strokeStyle = "rgba(31,41,55,.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, pad.top);
        ctx.lineTo(p.x, h - pad.bottom);
        ctx.stroke();
      }
    }

    // labels X (mes)
    if (this.labels?.length) {
      ctx.fillStyle = "#334155";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const n = Math.max(1, this.labels.length - 1);
      this.labels.forEach((lab, i) => {
        const x = pad.left + (i * (w - pad.left - pad.right)) / n;
        const y = h - pad.bottom + 6;
        ctx.fillText(String(lab).substring(0, 3), x, y);
      });
    }
  }
}
