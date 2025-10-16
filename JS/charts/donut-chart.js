// /JS/charts/donut-chart.js
export class DonutChart {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    this.c.width  = this.c.clientWidth  * dpr;
    this.c.height = this.c.clientHeight * dpr;
    this.ctx.scale(dpr, dpr);

    // opciones + fallback a data-*
    const ds = canvas.dataset || {};
    let dataFromDS = [];
    try { dataFromDS = ds.donut ? JSON.parse(ds.donut) : []; } catch {}
    this.data   = Array.isArray(opts.data) && opts.data.length ? opts.data : dataFromDS;
    this.colors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : [
      "#3b82f6","#22c55e","#f59e0b","#ef4444","#6366f1",
      "#10b981","#06b6d4","#eab308","#f97316","#a855f7"
    ];
    this.total  = Number.isFinite(opts.total) ? opts.total : this.data.reduce((a,b)=>a + (b.value||0), 0);

    this.legendEl       = opts.legendEl || null;
    this.legendBullets  = opts.legendBullets !== false;
    this.showPercLabels = opts.showPercLabels !== false;

    this.draw();
    this.renderLegend();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.c.clientWidth;
    const h = this.c.clientHeight;
    const cx = w/2, cy = h/2;
    const outerR = Math.min(w,h)*0.42;
    const innerR = outerR*0.58;

    ctx.clearRect(0,0,w,h);

    if (!this.data?.length || this.total <= 0) {
      // aro “vacío”
      ctx.fillStyle = "#e8eef5";
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI*2);
      ctx.fill();
      this.drawCenter("0", "Total del mes");
      return;
    }

    let start = -Math.PI/2;
    this.data.forEach((item, idx) => {
      const value = Number(item.value||0);
      if (value <= 0) return;
      const angle = (value/this.total) * Math.PI*2;

      // arco exterior
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.fillStyle = this.colors[idx % this.colors.length];
      ctx.arc(cx, cy, outerR, start, start + angle);
      ctx.closePath();
      ctx.fill();

      // etiqueta porcentaje
      if (this.showPercLabels) {
        const mid = start + angle/2;
        const rx = cx + Math.cos(mid) * (innerR + (outerR-innerR)*0.65);
        const ry = cy + Math.sin(mid) * (innerR + (outerR-innerR)*0.65);
        const pct = Math.round((value/this.total)*100);
        ctx.fillStyle = "#111827";
        ctx.font = "12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${pct}%`, rx, ry);
      }

      start += angle;
    });

    // recorte del donut (agujero)
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI*2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // centro
    this.drawCenter(String(this.total), "Total del mes");
  }

  drawCenter(big, small) {
    const ctx = this.ctx;
    const w = this.c.clientWidth;
    const h = this.c.clientHeight;
    const cx = w/2, cy = h/2;

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(big, cx, cy - 8);

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(small, cx, cy + 14);
  }

  renderLegend() {
    if (!this.legendEl) return;
    const total = this.total || 1;
    this.legendEl.querySelectorAll("li").forEach(li => li.remove());

    this.data.forEach((item, i) => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = ".5rem";
      const dot = document.createElement("span");
      dot.className = "bullet";
      dot.style.cssText = `display:inline-block;width:.75rem;height:.75rem;border-radius:999px;background:${this.colors[i % this.colors.length]};`;
      const t   = document.createElement("span");
      t.className = "t";
      t.textContent = item.label || "—";
      const pct = document.createElement("span");
      pct.className = "pct";
      pct.textContent = ` ${Math.round((item.value/total)*100)}%`;
      li.appendChild(dot);
      li.appendChild(t);
      li.appendChild(pct);
      this.legendEl.appendChild(li);
    });
  }
}
