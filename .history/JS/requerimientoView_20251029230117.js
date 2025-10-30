// /JS/requerimientoView.js
(function () {
  "use strict";

  /* =============== Helpers =============== */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const toast = (m,t="info") => (window.gcToast ? gcToast(m,t) : console.log("[toast]", t, m));

  const DEMO_KEY = "REQ_DEMO";
  const DEMO_FALLBACK = {
    ok:true,
    data:{
      id:3623, folio:"REQ-0000003623",
      asunto:"Reporte Fuga de agua", tramite_nombre:"Fuga de agua",
      descripcion:"Entre la casa 58 y 60 de la calle Jesús macias...",
      prioridad:2, estatus:0, canal:1,
      contacto_nombre:"Karla ochoa", contacto_email:"Omelettelaguna@gmail.com",
      contacto_telefono:"3318310524",
      contacto_calle:"Jesus macias 60", contacto_colonia:"Luis García", contacto_cp:"45850",
      created_at:"2025-10-03 18:08:38", cerrado_en:null,
      asignado_nombre_completo:"Juan Pablo García · ANALISTA",
      evidencias:[{id:1,nombre:"Evidencia Fuga de Agua",quien:"Luis Enrique",fecha:"2025-09-02 14:25:00",tipo:"img",url:"#"}]
    }
  };

  const loadDemo = () => {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (!raw) { localStorage.setItem(DEMO_KEY, JSON.stringify(DEMO_FALLBACK)); return DEMO_FALLBACK; }
      const obj = JSON.parse(raw);
      if (!obj || obj.ok === false || !obj.data) { localStorage.setItem(DEMO_KEY, JSON.stringify(DEMO_FALLBACK)); return DEMO_FALLBACK; }
      return obj;
    } catch { localStorage.setItem(DEMO_KEY, JSON.stringify(DEMO_FALLBACK)); return DEMO_FALLBACK; }
  };
  const saveDemo = (data) => { localStorage.setItem(DEMO_KEY, JSON.stringify({ok:true,data})); return data; };

  /* =============== Reset plantilla =============== */
  function resetTemplate(){
    const h1 = $(".exp-title h1"); if (h1) h1.textContent = "—";
    $$(".exp-meta dd").forEach(dd => dd.textContent = "—");

    const contactoVals = $$('.exp-pane[data-tab="Contacto"] .exp-grid .exp-val');
    contactoVals.forEach((n,i)=>{
      if (i===3){ const a=n.querySelector("a"); if(a){a.textContent="—"; a.removeAttribute("href");} else n.textContent="—"; }
      else n.textContent="—";
    });

    const detallesVals = $$('.exp-pane[data-tab="detalles"] .exp-grid .exp-val');
    detallesVals.forEach((n,i)=>{ if(i===3) n.innerHTML='<span class="exp-badge is-info">—</span>'; else n.textContent="—"; });

    $$(".exp-accordion .exp-table .exp-row").forEach(r=>r.remove());

    const items = $$(".step-menu li");
    items.forEach(li=>li.classList.remove("current","complete"));
    const sol = items.find(li=>Number(li.dataset.status)===0);
    sol?.classList.add("current");
  }

  /* =============== Acordeones con animación =============== */
  function animateOpen(el){ el.hidden=false; el.style.overflow="hidden"; el.style.height="0px"; el.getBoundingClientRect();
    const h=el.scrollHeight; el.style.transition="height 180ms ease"; el.style.height=h+"px";
    const done=()=>{ el.style.transition=""; el.style.height=""; el.style.overflow=""; el.removeEventListener("transitionend",done); };
    el.addEventListener("transitionend",done);
  }
  function animateClose(el){ el.style.overflow="hidden"; const h=el.offsetHeight; el.style.height=h+"px"; el.getBoundingClientRect();
    el.style.transition="height 160ms ease"; el.style.height="0px";
    const done=()=>{ el.hidden=true; el.style.transition=""; el.style.height=""; el.style.overflow=""; el.removeEventListener("transitionend",done); };
    el.addEventListener("transitionend",done);
  }
  function setAccordionOpen(head,body,open){ head.setAttribute("aria-expanded", open?"true":"false"); open?animateOpen(body):animateClose(body); }
  function initAccordions(){
    $$(".exp-accordion").forEach(acc=>{
      const head=$(".exp-acc-head",acc), body=$(".exp-acc-body",acc); if(!head||!body) return;
      const initOpen=head.getAttribute("aria-expanded")==="true"; body.hidden=!initOpen;
      head.addEventListener("click",()=>{ const isOpen=head.getAttribute("aria-expanded")==="true"; setAccordionOpen(head,body,!isOpen); });
      head.addEventListener("keydown",(e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); head.click(); }});
    });
  }

  /* =============== Tablas ordenables =============== */
  function initSortableTables(){
    $$(".exp-table").forEach(table=>{
      const head=$(".exp-thead",table); const rows=()=>$$(".exp-row",table); if(!head) return;
      head.addEventListener("click",(e)=>{
        const sortSpan=e.target.closest(".sort"); if(!sortSpan) return;
        const th=sortSpan.closest("div"); const headers=$$(".exp-thead > div",table); const idx=headers.indexOf(th); if(idx<0) return;
        const dir=sortSpan.dataset.dir==="asc"?"desc":"asc"; headers.forEach(h=>{const s=$(".sort",h); if(s && s!==sortSpan) s.dataset.dir="";}); sortSpan.dataset.dir=dir;
        const collator=new Intl.Collator("es",{numeric:true,sensitivity:"base"}); const arr=rows();
        arr.sort((a,b)=>{ const av=(a.children[idx]?.textContent||"").trim(); const bv=(b.children[idx]?.textContent||"").trim(); const cmp=collator.compare(av,bv); return dir==="asc"?cmp:-cmp; });
        arr.forEach(r=>r.parentElement.appendChild(r));
      });
    });
  }

  /* =============== Stepper + badge =============== */
  const statusLabel = (s)=>({0:"Solicitud",1:"Revisión",2:"Asignación",3:"Proceso",4:"Pausado",5:"Cancelado",6:"Finalizado"})[Number(s)]||"—";
  const statusBadgeClass = (s)=>({0:"is-muted",1:"is-info",2:"is-info",3:"is-info",4:"is-warn",5:"is-danger",6:"is-success"})[Number(s)]||"is-info";

  function paintStepper(next){
    const items=$$(".step-menu li");
    items.forEach(li=>{
      const s=Number(li.dataset.status);
      li.classList.remove("current");
      if(s<next) li.classList.add("complete"); else li.classList.remove("complete");
      if(s===next) li.classList.add("current");
    });
    const cur=items.find(li=>li.classList.contains("current"));
    if(cur){ cur.style.transform="scale(0.98)"; cur.style.transition="transform 120ms ease";
      requestAnimationFrame(()=>{cur.style.transform="scale(1)"; setTimeout(()=>cur.style.transition="",140);});
    }
  }
  window.paintStepper = paintStepper;

  /* =============== Hidratar vista =============== */
  const fillText = (sel, txt)=>{ const n=$(sel); if(n) n.textContent = (txt ?? "—"); };

  function hydrateFromData(req){
    const h1=$(".exp-title h1"); if(h1) h1.textContent = req.tramite_nombre || req.asunto || "Requerimiento";

    const ddC=$(".exp-meta > div:nth-child(1) dd");
    const ddE=$(".exp-meta > div:nth-child(2) dd");
    const ddF=$(".exp-meta > div:nth-child(3) dd");
    if(ddC) ddC.textContent = req.contacto_nombre || "—";
    if(ddE) ddE.textContent = req.asignado_nombre_completo || "—";
    if(ddF) ddF.textContent = (req.created_at || "—").replace(" "," ");

    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(1) .exp-val', req.contacto_nombre);
    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(2) .exp-val', req.contacto_telefono);
    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(3) .exp-val', [req.contacto_calle, req.contacto_colonia].filter(Boolean).join(", "));
    const mailA = document.querySelector('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(4) .exp-val a');
    if (mailA){ mailA.textContent = req.contacto_email || "—"; if(req.contacto_email) mailA.href = `mailto:${req.contacto_email}`; else mailA.removeAttribute("href"); }
    fillText('.exp-pane[data-tab="Contacto"] .exp-grid .exp-field:nth-child(5) .exp-val', req.contacto_cp);

    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(1) .exp-val', req.tramite_nombre || req.asunto);
    const liderA = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(2) .exp-val a'); if(liderA) liderA.textContent = req.asignado_nombre_completo || "—";
    const asignadoA = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(3) .exp-val a'); if(asignadoA) asignadoA.textContent = req.contacto_nombre || "—";
    const badgeWrap = document.querySelector('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(4) .exp-val');
    if(badgeWrap){ const cls=statusBadgeClass(req.estatus); const lbl=statusLabel(req.estatus);
      badgeWrap.innerHTML = `<span class="exp-badge ${cls} pulse-once">${lbl}</span>`;
      setTimeout(()=>badgeWrap.querySelector(".pulse-once")?.classList.remove("pulse-once"),220);
    }
    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field.exp-field--full .exp-val', req.descripcion);
    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(6) .exp-val', req.created_at?.split(" ")[0]);
    fillText('.exp-pane[data-tab="detalles"] .exp-grid .exp-field:nth-child(7) .exp-val', req.cerrado_en ? req.cerrado_en.split(" ")[0] : "—");

    const evTable=$(".exp-accordion .exp-table");
    if(evTable){ $$(".exp-accordion .exp-table .exp-row").forEach(r=>r.remove());
      (req.evidencias||[]).forEach(ev=>{
        const a=document.createElement("a"); a.className="exp-row"; a.href=ev.url||"#";
        a.innerHTML=`<div class="file"><img class="ico" src="/ASSETS/filetypes/${ev.tipo||"file"}.png" alt=""><span>${ev.nombre||"Archivo"}</span></div>
                     <div class="who">${ev.quien||"—"}</div>
                     <div class="date">${(ev.fecha||"").replace(" "," ")||"—"}</div>`;
        evTable.appendChild(a);
      });
    }

    paintStepper(Number(req.estatus??0));
    ReqActions.refresh();
  }

  /* =============== Acciones por estado (DEMO local) =============== */
  const ReqActions = (() => {
    const hostSel="#req-actions";

    function setStatusAndRefresh(next){
      const data = loadDemo().data;
      data.estatus = next;
      saveDemo(data);
      paintStepper(next);
      hydrateFromData(data);
    }

    function render(){
      const host=$(hostSel); if(!host) return;
      host.innerHTML="";

      const data = loadDemo().data;
      const status = Number(data.estatus??0);

      const mk = (txt, cls="btn-xs", onClick=()=>{})=>{
        const b=document.createElement("button"); b.type="button"; b.className=cls; b.textContent=txt; b.addEventListener("click", onClick); return b;
      };

      // 0: Solicitud -> Iniciar revisión
      if(status===0){
        host.appendChild(mk("Iniciar revisión","btn-xs primary",()=>{ setStatusAndRefresh(1); toast("Requerimiento en revisión","success"); }));
        return;
      }

      // 1: Revisión -> Asignar (→2), Pausar (→4), Cancelar(→5)
      if(status===1){
        host.appendChild(mk("Asignar a departamento","btn-xs primary",()=>{ setStatusAndRefresh(2); toast("Asignado a departamento","success"); }));
        host.appendChild(mk("Pausar","btn-xs warn",()=> openEstadoModal({type:"pausar", nextStatus:4})));
        host.appendChild(mk("Cancelar","btn-xs danger",()=> openEstadoModal({type:"cancelar", nextStatus:5})));
        return;
      }

      // 2: Asignación -> Iniciar proceso (→3) + Pausar/Cancelar
      if(status===2){
        host.appendChild(mk("Iniciar proceso","btn-xs primary",()=>{ setStatusAndRefresh(3); toast("Iniciado Proceso","success"); }));
        host.appendChild(mk("Pausar","btn-xs warn",()=> openEstadoModal({type:"pausar", nextStatus:4})));
        host.appendChild(mk("Cancelar","btn-xs danger",()=> openEstadoModal({type:"cancelar", nextStatus:5})));
        return;
      }

      // 3: Proceso -> Pausar/Cancelar (demo termina aquí si quieres)
      if(status===3){
        host.appendChild(mk("Pausar","btn-xs warn",()=> openEstadoModal({type:"pausar", nextStatus:4})));
        host.appendChild(mk("Cancelar","btn-xs danger",()=> openEstadoModal({type:"cancelar", nextStatus:5})));
        return;
      }

      // 4/5/6: Reactivar (→1)
      if(status===4 || status===5 || status===6){
        host.appendChild(mk("Reactivar","btn-xs primary",()=>{ setStatusAndRefresh(1); toast("Reactivado a Revisión","success"); }));
        return;
      }
    }

    return { refresh: render };
  })();
  window.ReqActions = ReqActions;

  /* =============== Modal Pausar/Cancelar (DEMO local) =============== */
  const modal=$("#modal-estado"), form=$("#form-estado"), txt=$("#estado-motivo"), title=$("#estado-title");
  const btnClose = modal?.querySelector(".modal-close");
  let _pendingAction = null; // {type:"pausar"|"cancelar", nextStatus:number}

  function openEstadoModal({type,nextStatus}){
    _pendingAction={type,nextStatus};
    title.textContent = type==="cancelar" ? "Motivo de cancelación" : "Motivo de pausa";
    txt.value=""; modal.setAttribute("aria-hidden","false"); modal.classList.add("open");
    setTimeout(()=>txt?.focus(),50);
  }
  function closeEstadoModal(){ modal.classList.remove("open"); modal.setAttribute("aria-hidden","true"); _pendingAction=null; }
  btnClose?.addEventListener("click", closeEstadoModal);
  modal?.addEventListener("click", (e)=>{ if(e.target===modal) closeEstadoModal(); });

  form?.addEventListener("submit",(e)=>{
    e.preventDefault();
    if(!_pendingAction) return;
    const motivo=(txt.value||"").trim(); if(!motivo){ toast("Describe el motivo, por favor.","warning"); txt.focus(); return; }
    const data = loadDemo().data;
    data.estatus = _pendingAction.nextStatus;
    // opcional: data.demoNotas = [...(data.demoNotas||[]), {tipo:_pendingAction.type, motivo, fecha: new Date().toISOString()}];
    saveDemo(data);
    paintStepper(data.estatus);
    hydrateFromData(data);
    toast(_pendingAction.type==="cancelar"?"Requerimiento cancelado":"Requerimiento en pausa","success");
    closeEstadoModal();
  });

  /* =============== Stepper visual (clic) =============== */
  function initStepper(){
    const menu=$(".step-menu"); if(!menu) return;
    menu.addEventListener("click",(e)=>{
      const li=e.target.closest("li"); if(!li) return;
      $$("li",menu).forEach(it=>it.classList.remove("current"));
      li.classList.add("current");
    });
  }
h
  /* =============== Boot =============== */
  function boot(){
    resetTemplate();
    const demo=loadDemo(); hydrateFromData(demo.data);
    initAccordions(); initSortableTables(); initStepper();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot, {once:true});
  else boot();

})();
