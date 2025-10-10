
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ixtla-app.com</title>
  <style>
    /* ==================== THEME: LIGHT ==================== */
    :root{
      --bg:#f6f8fb;           /* fondo app */
      --panel:#ffffff;        /* tarjetas / barras */
      --panel-alt:#f1f3f7;    /* secciones pegadas */
      --border:#e5e7ef;       /* líneas y bordes */
      --text:#1f2937;         /* texto principal (gris oscuro) */
      --muted:#6b7280;        /* texto secundario */
      --accent:#2b6fff;       /* azul UI */
      --accent-600:#1f5bff;
      --accent-50:#edf2ff;    /* azul muy claro para hover */
      --danger:#e11d48;
      --bubble-in:#ffffff;    /* ⬅️ ENTRANTES: blanco */
      --bubble-out:#2b6fff;   /* ⬅️ SALIENTES: azul */
      --bubble-out-text:#ffffff;
    }

    *{box-sizing:border-box}
    body{
      margin:0;background:var(--bg);color:var(--text);
      font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    }
    .app{display:grid;grid-template-columns:420px 1fr;height:100vh;min-height:0;}

    /* ==================== Sidebar (lista) ==================== */
    .sidebar{
      border-right:1px solid var(--border);
      background:var(--panel);
      display:flex;flex-direction:column;min-height:0;
    }
    .side-head{
      padding:14px;border-bottom:1px solid var(--border);
      display:flex;gap:8px;position:sticky;top:0;background:var(--panel);z-index:2;
    }
    .side-head input{
      flex:1;padding:10px 12px;border-radius:10px;
      border:1px solid var(--border);background:#fff;color:var(--text)
    }
    .side-head input::placeholder{color:#a0a6b3}

    .tabs{
      display:flex;gap:6px;padding:10px;border-bottom:1px solid var(--border);
      position:sticky;top:58px;background:var(--panel);z-index:2;
    }
    .tab{
      padding:6px 10px;border-radius:20px;cursor:pointer;
      color:var(--muted);border:1px solid var(--border);background:#fff;
    }
    .tab:hover{background:var(--accent-50);border-color:#cdd8ff;color:#3653a5}
    .tab.active{color:#0f172a;border-color:#cdd8ff;background:var(--accent-50)}

    .conv-list{flex:1;min-height:0;overflow:auto;padding:8px;background:var(--panel)}
    .conv{
      padding:10px;border:1px solid var(--border);margin:8px 0;border-radius:12px;
      cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:6px;background:#fff;
      transition:border-color .15s, box-shadow .15s, background .15s;
    }
    .conv:hover{border-color:#cdd8ff;background:#fff;box-shadow:0 1px 0 rgba(20,28,55,.04)}
    .conv .title{font-weight:600;display:flex;align-items:center;gap:6px}
    .conv .meta{color:var(--muted);font-size:12px}
    .pill{
      font-size:11px;padding:3px 8px;border:1px solid #d7defa;border-radius:999px;
      color:#3b5bcc;background:#eef2ff
    }

    /* ==================== Main (mensajes) ==================== */
    .main{display:grid;grid-template-rows:auto 1fr auto;min-height:0;background:var(--panel-alt)}
    .header{
      padding:14px;border-bottom:1px solid var(--border);background:var(--panel);
      display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:3;
    }
    .header .title{font-weight:700}
    .header .sub{color:var(--muted);font-size:12px}

    .messages{
      min-height:0;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px;
      scroll-behavior:smooth;overscroll-behavior:contain;
    }
    .bubble{
      max-width:70%;padding:10px 12px;border-radius:14px;border:1px solid var(--border);
      background:#fff;color:var(--text);
    }
    /* Entrante (ciudadano) blanca */
    .in{
      align-self:flex-start;border-top-left-radius:4px;background:var(--bubble-in);
      border-color:var(--border);color:var(--text);
    }
    /* Saliente (asesor) azul */
    .out{
      align-self:flex-end;border-top-right-radius:4px;background:var(--bubble-out);
      border-color:var(--bubble-out);color:var(--bubble-out-text);
    }
    .bubble .time{color:var(--muted);font-size:11px;margin-top:6px}
    .out .time{color:#e7ecff} /* time clarito sobre fondo azul */

    /* Composer pegado abajo */
    .composer{
      display:flex;gap:8px;padding:12px;border-top:1px solid var(--border);
      background:var(--panel);position:sticky;bottom:0;z-index:5;
    }
    .composer textarea{
      flex:1;min-height:44px;max-height:120px;padding:10px;border-radius:10px;
      border:1px solid var(--border);background:#fff;color:var(--text);resize:vertical
    }
    .btn{
      border:1px solid transparent;border-radius:10px;padding:10px 14px;background:var(--accent);
      color:#fff;cursor:pointer;transition:filter .15s, background .15s
    }
    .btn:hover{background:var(--accent-600)}
    .btn.secondary{background:#eef2ff;color:#2643a0;border-color:#d7defa}
    .btn.secondary:hover{background:#e6ecff}
    .btn.danger{background:#fee2e2;color:#991b1b;border-color:#fecaca}
    .btn.danger:hover{background:#ffdada}

    .empty{color:var(--muted);text-align:center;margin-top:20vh}
    .toast{
      position:fixed;right:16px;bottom:16px;background:#ffffff;color:#0f172a;
      border:1px solid var(--border);border-radius:12px;padding:10px 12px;
      box-shadow:0 10px 30px rgba(0,0,0,.12);display:none
    }
    .row{display:flex;gap:8px;align-items:center}

    .modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}
    .card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;min-width:320px;max-width:96vw}
    .card h3{margin:0 0 8px 0}
    .card label{display:block;margin:8px 0 4px;color:#334155}
    .card input{width:100%;padding:10px;border-radius:10px;border:1px solid var(--border);background:#fff;color:var(--text)}
    .params{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
    .params input{width:140px}
    .hint{color:#64748b;font-size:12px}
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="side-head">
        <input id="search" placeholder="Buscar nombre o teléfono…"/>
      </div>

      <!-- Solo 3 pestañas -->
      <div class="tabs">
        <div class="tab active" data-status="open">Abiertas</div>
        <div class="tab" data-status="closed">Cerradas</div>
        <div class="tab" data-status="all">Todas</div>
      </div>

      <div id="convList" class="conv-list"></div>
    </aside>

    <main class="main">
      <div class="header">
        <div>
          <div class="title" id="hdrTitle">Selecciona una conversación</div>
          <div class="sub" id="hdrSub">—</div>
        </div>
        <div class="row">
          <span class="pill" id="pillWindow">Ventana 24h: —</span>
          <button class="btn secondary" id="btnMarkRead" disabled>Marcar leído</button>
          <button class="btn" id="btnReopen" disabled>Reabrir con plantilla</button>
        </div>
      </div>

      <div id="messages" class="messages">
        <div class="empty">No hay mensajes. Elige un hilo a la izquierda.</div>
      </div>

      <div class="composer">
        <textarea id="composer" placeholder="Escribe un mensaje…" disabled></textarea>
        <button class="btn" id="btnSend" disabled>Enviar</button>
      </div>
    </main>
  </div>

  <!-- Modal plantilla -->
  <div class="modal" id="tplModal">
    <div class="card">
      <h3>Reabrir con plantilla</h3>
      <label>Nombre de plantilla</label>
      <input id="tplName" value="req_01" />
      <label>Parámetros (opcional)</label>
      <div class="params" id="paramWrap"></div>
      <div class="hint">Agrega uno o más parámetros; se enviarán como {{1}}, {{2}}, …</div>
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
        <button class="btn secondary" id="btnAddParam">+ Param</button>
        <button class="btn" id="btnSendTpl">Enviar plantilla</button>
        <button class="btn danger" id="btnCloseTpl">Cancelar</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
  /* ==================== CONFIG ==================== */
  const API_BASE = 'https://ixtla-app.com/db/WEB';
  const ENDPOINTS = {
    conversations: API_BASE + '/z_conversations.php',
    messages:      API_BASE + '/z_messages.php',
    sendText:      API_BASE + '/z_send_text.php',
    reopen:        API_BASE + '/z_reopen_with_template.php',
    markRead:      API_BASE + '/z_mark_read.php'
  };

  /* ==================== STATE & UTILS ==================== */
  let state = {
    status: 'open',
    page: 1,
    pageSize: 30,
    conversations: [],
    current: null, // { id, contact_name, wa_phone, last_incoming_at, last_outgoing_at, status }
    messages: []
  };

  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  function toast(msg, ms=2500){ const t=qs('#toast'); t.textContent=msg; t.style.display='block'; setTimeout(()=>{t.style.display='none'}, ms); }
  function fmtDate(s){ if(!s) return '—'; const d=new Date(s.replace(' ','T')+'Z'); return d.toLocaleString(); }
  function within24h(lastIncoming){ if(!lastIncoming) return false; const t=new Date(lastIncoming.replace(' ','T')+'Z'); return (Date.now()-t.getTime()) <= 24*3600*1000; }
  function isClosed(c){ return (c.status && c.status==='closed') || !within24h(c.last_incoming_at); }

  /* ⬇️ NUEVA versión robusta */
  function scrollToBottom(force=false){
    const box = qs('#messages');
    if (!box) return;
    const nearBottom = (box.scrollTop + box.clientHeight) >= (box.scrollHeight - 80);
    if (force || nearBottom) {
      requestAnimationFrame(()=>{ box.scrollTop = box.scrollHeight; });
    }
  }

  function debounce(fn,ms){ let h; return (...a)=>{ clearTimeout(h); h=setTimeout(()=>fn(...a),ms); } }

  /* ==================== LOAD CONVERSATIONS ==================== */
  async function loadConversations(){
    const search = qs('#search').value.trim();
    const url = new URL(ENDPOINTS.conversations);

    // 🔁 Siempre pedimos TODAS, filtramos en front para que 'Cerradas' funcione
    url.searchParams.set('status', 'all');
    url.searchParams.set('page', state.page);
    url.searchParams.set('page_size', state.pageSize);
    if (search) url.searchParams.set('search', search);

    const r = await fetch(url);
    const j = await r.json();
    state.conversations = j.data || [];
    renderConversations();
  }

  function renderConversations(){
    const box = qs('#convList'); box.innerHTML='';
    // Filtro por pestaña
    let list = state.conversations;
    if (state.status === 'open') {
      list = list.filter(c => within24h(c.last_incoming_at) && c.status !== 'closed');
    } else if (state.status === 'closed') {
      list = list.filter(isClosed);
    }

    if (!list.length){
      box.innerHTML = '<div class="empty" style="padding:12px">Sin resultados</div>';
      return;
    }

    list.forEach(c=>{
      const hasUnread = c.last_incoming_at && (!c.last_outgoing_at || c.last_incoming_at > c.last_outgoing_at);
      const el=document.createElement('div'); el.className='conv'; el.dataset.id=c.id;
      el.innerHTML = `
        <div class="title">
          ${c.contact_name||c.wa_phone||'Sin nombre'}
          ${hasUnread?'<span class="pill">nuevo</span>':''}
        </div>
        <div class="meta">${c.wa_phone||''}</div>
        <div class="meta">Último in: ${fmtDate(c.last_incoming_at)}</div>
        <div class="meta">Estado: ${c.status}</div>
      `;
      el.onclick=()=>selectConversation(c);
      box.appendChild(el);
    });
  }

  /* ==================== MESSAGES ==================== */
  async function selectConversation(c){
    state.current = c;
    qs('#hdrTitle').textContent = c.contact_name || c.wa_phone || ('ID '+c.id);
    qs('#hdrSub').textContent   = (c.wa_phone||'') + ' · conv #' + c.id;

    const open = within24h(c.last_incoming_at);
    qs('#pillWindow').textContent = 'Ventana 24h: ' + (open ? 'activa' : 'cerrada');
    qs('#composer').disabled = !open;
    qs('#btnSend').disabled = !open;
    qs('#btnReopen').disabled = false;

    // ⬇️ Forzar scroll al final en la primera carga de ese hilo
    await loadMessages(c.id, { forceBottom: true });
    startMsgPolling();
  }

  /* ⬇️ loadMessages con forceBottom */
  async function loadMessages(convId, { forceBottom = false } = {}){
    const url = new URL(ENDPOINTS.messages);
    url.searchParams.set('conversation_id', convId);
    url.searchParams.set('page', 1);
    url.searchParams.set('page_size', 200);
    const r = await fetch(url);
    const j = await r.json();

    const prevLen = state.messages.length;
    state.messages = j.data||[];

    renderMessages({ forceBottom: forceBottom || (state.messages.length > prevLen) });
  }

  /* ⬇️ renderMessages con ancla y forceBottom */
  function renderMessages({ forceBottom = false } = {}){
    const box = qs('#messages'); 
    box.innerHTML='';

    if (!state.messages.length){
      box.innerHTML = '<div class="empty">No hay mensajes en este hilo.</div>';
      return;
    }

    state.messages.forEach(m=>{
      const li=document.createElement('div'); 
      li.className = 'bubble ' + (m.direction==='out'?'out':'in');
      li.innerHTML = `
        <div>${escapeHtml(m.text||'')}</div>
        <div class="time">${m.msg_type} · ${fmtDate(m.created_at)}</div>
      `;
      box.appendChild(li);
    });

    // Ancla final para asegurar el scroll incluso con mensajes largos
    const anchor = document.createElement('div');
    anchor.id = 'msgEnd';
    box.appendChild(anchor);

    if (forceBottom) {
      scrollToBottom(true);
    } else {
      scrollToBottom(false);
    }

    const lastIn = [...state.messages].reverse().find(m=>m.direction==='in');
    qs('#btnMarkRead').disabled = !lastIn;
    qs('#btnMarkRead').dataset.wamid = lastIn ? lastIn.wa_message_id : '';
  }

  function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])); }

  /* ==================== ACTIONS ==================== */
  async function sendText(){
    if (!state.current) return;
    const txt = qs('#composer').value.trim(); if (!txt) return;
    qs('#btnSend').disabled = true;
    try{
      const r = await fetch(ENDPOINTS.sendText,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({conversation_id: state.current.id, text: txt})
      });
      if (r.status===409){ await r.json(); openTplModal(); return; }
      const j = await r.json();
      if (!j.ok) throw new Error(j.error||'Fallo al enviar');
      qs('#composer').value='';
      toast('Enviado');
      scrollToBottom(true); // salto inmediato
      await loadMessages(state.current.id, { forceBottom: true }); // asegura al re-render
    }catch(e){ toast('Error: '+e.message); }
    finally{ qs('#btnSend').disabled = false; }
  }

  async function markRead(){
    const id = qs('#btnMarkRead').dataset.wamid; if(!id) return;
    try{
      const r = await fetch(ENDPOINTS.markRead,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wa_message_id:id})});
      const j=await r.json(); if(!j.ok) throw new Error('No se pudo marcar');
      toast('Marcado como leído');
    }catch(e){ toast('Error: '+e.message); }
  }

  function openTplModal(){ const m=qs('#tplModal'); m.style.display='flex'; qs('#paramWrap').innerHTML=''; addParam(); qs('#tplName').focus(); }
  function closeTplModal(){ qs('#tplModal').style.display='none'; }
  function addParam(){ const input=document.createElement('input'); input.placeholder='{{n}}'; qs('#paramWrap').appendChild(input); }
  async function sendTpl(){
    if (!state.current) return;
    const name = qs('#tplName').value.trim()||'req_01';
    const params = Array.from(qs('#paramWrap').querySelectorAll('input')).map(i=>i.value).filter(Boolean);
    try{
      const r = await fetch(ENDPOINTS.reopen,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversation_id: state.current.id, template: name, params})});
      const j = await r.json(); if(!j.ok) throw new Error(j.error||'Fallo plantilla');
      toast('Plantilla enviada'); closeTplModal();

      // Simula reactivación de ventana en UI
      state.current.last_incoming_at = new Date().toISOString().slice(0,19).replace('T',' ');
      qs('#composer').disabled=false; qs('#btnSend').disabled=false;
      qs('#pillWindow').textContent='Ventana 24h: activa';
    }catch(e){ toast('Error: '+e.message); }
  }

  /* ==================== POLLING ==================== */
  let msgPoll=null, convPoll=null;

  function startMsgPolling(){ 
    stopMsgPolling(); 
    msgPoll=setInterval(()=>{ 
      if(state.current) loadMessages(state.current.id); 
    }, 8000); 
  }
  function stopMsgPolling(){ if(msgPoll){ clearInterval(msgPoll); msgPoll=null; } }

  function startConvPolling(){
    stopConvPolling();
    convPoll = setInterval(async ()=>{
      const prevId = state.current?.id;
      const list = document.querySelector('#convList');
      const prevScroll = list ? list.scrollTop : 0;
      await loadConversations();
      if (prevId){
        const found = state.conversations.find(c=>c.id===prevId);
        if (found){
          state.current = {...found};
          const open = within24h(found.last_incoming_at);
          qs('#hdrTitle').textContent = found.contact_name || found.wa_phone || ('ID '+found.id);
          qs('#hdrSub').textContent   = (found.wa_phone||'') + ' · conv #' + found.id;
          qs('#pillWindow').textContent = 'Ventana 24h: ' + (open?'activa':'cerrada');
        }
      }
      if (list) list.scrollTop = prevScroll;
    }, 10000);
  }
  function stopConvPolling(){ if(convPoll){ clearInterval(convPoll); convPoll=null; } }

  /* ==================== UI EVENTS ==================== */
  qsa('.tab').forEach(t=> t.onclick = ()=>{
    qsa('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    state.status = t.dataset.status;
    state.page = 1;
    loadConversations();
  });

  qs('#search').addEventListener('input', debounce(()=>{ state.page=1; loadConversations(); }, 400));
  qs('#btnSend').onclick = sendText;
  qs('#btnReopen').onclick = openTplModal;
  qs('#btnMarkRead').onclick = markRead;
  qs('#btnAddParam').onclick = addParam;
  qs('#btnSendTpl').onclick = sendTpl;
  qs('#btnCloseTpl').onclick = closeTplModal;

  /* ==================== INIT ==================== */
  loadConversations().then(startConvPolling);
  </script>

  <!-- (Opcional) Guardia de acceso -->
  <script type="module">
    import { guardPage } from "/JS/auth/guard.js";
    guardPage({ allowEmpIds:[6,5,4,2], stealth:false, redirectTo:"/VIEWS/home.php" });
  </script>
</body>
</html>
