// /JS/charts/line-chart.js
export function LineChart(canvas) {
  const ctx = canvas.getContext("2d");
  const DPR = window.devicePixelRatio || 1;

  // dims
  let W = 600, H = 240;
  let PAD = { t: 24, r: 16, b: 32, l: 36 };

  let data = new Array(12).fill(0);
  let months = ["E","F","M","A","M","J","J","A","S","O","N","D"];

  // tooltip DOM
  let tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.style.cssText = "position:absolute;pointer-events:none;padding:.35rem .5rem;border-radius:.5rem;background:#1f2937;color:#fff;font:12px/1.2 system-ui;opacity:0;transform:translate(-50%,-120%);transition:opacity .12s;";
  canvas.parentElement.style.position = "relative";
  canvas.parentElement.appendChild(tip);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(320, rect.width);
    H = Math.max(180, rect.height);
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  function yMaxNice(maxVal) {
    if (maxVal <= 5) return 5;
    if (maxVal <= 10) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const base = Math.ceil(maxVal / pow);
    const nice = base <= 2 ? 2*pow : base <=5 ? 5*pow : 10*pow;
    return nice;
  }

  function render() {
    ctx.clearRect(0,0,W,H);

    // grid & axes
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;

    const maxVal = Math.max(1, ...data);
    const yMax = yMaxNice(maxVal);
    const yStep = yMax / 4;

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#eef2f7";
    ctx.beginPath();
    for (let i=0;i<=4;i++){
      const y = PAD.t + innerH - (i/4)*innerH;
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(PAD.l + innerW, y);
    }
    ctx.stroke();

    // X labels
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "12px system-ui";
    for (let i=0;i<12;i++){
      const x = PAD.l + innerW * (i/11);
      ctx.fillText(months[i], x, PAD.t + innerH + 6);
    }

    // Y labels
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i=0;i<=4;i++){
      const val = Math.round(i*yStep);
      const y = PAD.t + innerH - (i/4)*innerH;
      ctx.fillText(String(val), PAD.l - 6, y);
    }

    // line
    const points = data.map((v,i)=>{
      const x = PAD.l + innerW * (i/11);
      const y = PAD.t + innerH - (v/yMax)*innerH;
      return {x,y,v,i};
    });

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#4f6b95";
    ctx.beginPath();
    points.forEach((p,idx)=>{ if(idx===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
    ctx.stroke();

    // points
    ctx.fillStyle = "#4f6b95";
    points.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill(); });

    // save for hover
    _points = points;
    _yMax = yMax;
  }

  let _points = [];
  let _yMax = 0;

  function nearestIdx(px){
    if (!_points.length) return -1;
    let best = 0, bestDx = Infinity;
    _points.forEach((p,i)=>{
      const dx = Math.abs(p.x - px);
      if (dx < bestDx){ bestDx = dx; best = i; }
    });
    return best;
  }

  function onMove(e){
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = nearestIdx(x);
    if (idx < 0) { tip.style.opacity = 0; return; }
    const p = _points[idx];

    tip.textContent = `${months[p.i]} · ${p.v}`;
    tip.style.left = `${p.x}px`;
    tip.style.top  = `${p.y}px`;
    tip.style.opacity = 1;

    // crosshair
    render(); // repaint
    ctx.save();
    ctx.strokeStyle = "#c7d2fe";
    ctx.lineWidth = 1;
    ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.moveTo(p.x, PAD.t);
    ctx.lineTo(p.x, H - PAD.b);
    ctx.stroke();
    ctx.restore();

    // emphasize point
    ctx.fillStyle = "#1f3b68";
    ctx.beginPath(); ctx.arc(p.x,p.y,4.5,0,Math.PI*2); ctx.fill();
  }
  function onLeave(){ tip.style.opacity = 0; render(); }

  window.addEventListener("resize", ()=>{ resize(); render(); });

  return {
    mount(opts={}) {
      if (Array.isArray(opts.data)) data = opts.data.slice(0,12);
      resize(); render();
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("mouseleave", onLeave);
    },
    update(opts={}) {
      if (Array.isArray(opts.data)) data = opts.data.slice(0,12);
      render();
    }
  };
}
