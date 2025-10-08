<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consola de Asesores – WhatsApp</title>
  <style>
    :root { --bg:#0b1220; --panel:#121a2b; --muted:#808aa5; --text:#e9eefc; --accent:#8ab4ff; --danger:#ff6b6b; }
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif}
    .app{display:grid;grid-template-columns:420px 1fr;height:100vh;min-height:0;} /* ★ min-height:0 */

    /* ==== Sidebar (lista de conversaciones) ==== */
    .sidebar{
      border-right:1px solid #1e2a45;background:var(--panel);
      display:flex;flex-direction:column;min-height:0; /* ★ min-height:0 permite scroll interno */
    }
    .side-head{
      padding:14px;border-bottom:1px solid #1e2a45;display:flex;gap:8px;
      position:sticky;top:0;background:var(--panel);z-index:2; /* ★ fijo arriba */
    }
    .side-head input{flex:1;padding:10px 12px;border-radius:10px;border:1px solid #263657;background:#0d1526;color:var(--text)}
    .tabs{
      display:flex;gap:6px;padding:10px;border-bottom:1px solid #1e2a45;
      position:sticky;top:58px;background:var(--panel);z-index:2; /* ★ fijo bajo la barra de búsqueda */
    }
    .tab{padding:6px 10px;border-radius:20px;cursor:pointer;color:var(--muted);border:1px solid #263657}
    .tab.active{color:var(--text);border-color:#35507a;background:#0f1a31}
    .conv-list{flex:1;min-height:0;overflow:auto;padding:8px} /* ★ scroll independiente */
    .conv{padding:10px;border:1px solid #223357;margin:8px 0;border-radius:12px;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:6px;background:#0e172b}
    .conv:hover{border-color:#35507a}
    .conv .title{font-weight:600}
    .conv .meta{color:var(--muted);font-size:12px}

    /* ==== Main (mensajes) ==== */
    .main{display:grid;grid-template-rows:auto 1fr auto;min-height:0;} /* ★ min-height:0 */
    .header{
      padding:14px;border-bottom:1px solid #1e2a45;background:var(--panel);
      display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:3; /* opcional fijo arriba */
    }
    .header .title{font-weight:700}
    .header .sub{color:var(--muted);font-size:12px}

    /* panel SCROLL de mensajes */
    .messages{
      min-height:0;overflow:auto; /* ★ clave para que scrollee */
      padding:16px;display:flex;flex-direction:column;gap:10px;
      scroll-behavior:smooth;overscroll-behavior:contain; /* ★ suavidad */
    }
    .bubble{max-width:70%;padding:10px 12px;border-radius:14px;border:1px solid #223357;background:#0f1930}
    .in{align-self:flex-start;border-top-left-radius:4px}
    .out{align-self:flex-end;border-top-right-radius:4px;background:#0d2244;border-color:#2c4b84}
    .bubble .time{color:var(--muted);font-size:11px;margin-top:6px}

    /* composer pegado abajo */
    .composer{
      display:flex;gap:8px;padding:12px;border-top:1px solid #1e2a45;background:var(--panel);
      position:sticky;bottom:0;z-index:5; /* ★ fijo abajo */
    }
    .composer textarea{
      flex:1;min-height:44px;max-height:120px;padding:10px;border-radius:10px;border:1px solid #263657;background:#0d1526;color:var(--text);resize:vertical
    }
    .btn{border:none;border-radius:10px;padding:10px 14px;background:#1a2b4d;color:#cfe2ff;cursor:pointer}
    .btn:hover{background:#223a6b}
    .btn.secondary{background:#20314f;color:#b9c8e6}
    .btn.danger{background:#4b1d1d;color:#ffd7d7}

    .empty{color:var(--muted);text-align:center;margin-top:20vh}
    .toast{position:fixed;right:16px;bottom:16px;background:#0c1a35;color:#dfe8ff;border:1px solid #26467d;border-radius:12px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:none}
    .row{display:flex;gap:8px;align-items:center}
    .pill{font-size:11px;padding:3px 8px;border:1px solid #2a3d63;border-radius:999px;color:#b3c1e4}
    .modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.5)}
    .card{background:#0d1526;border:1px solid #223357;border-radius:12px;padding:16px;min-width:320px;max-width:96vw}
    .card h3{margin:0 0 8px 0}
    .card label{display:block;margin:8px 0 4px;color:#b9c8e6}
    .card input{width:100%;padding:10px;border-radius:10px;border:1px solid #263657;background:#0b1220;color:#e9eefc}
    .params{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
    .params input{width:140px}
    .hint{color:#93a2c7;font-size:12px}
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="side-head">
        <input id="search" placeholder="Buscar nombre o teléfono…"/>
      </div>
      <div class="tabs">
        <div class="tab active" data-status="open">Abiertas</div>
        <div class="tab" data-status="pending">Pendientes</div>
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
  // === CONFIG ===
  const API_BASE = 'https://ixtla-app.com/db/WEB';
  const ENDPOINTS = {
    conversations: API_BASE + '/z_conversations.php',
    messages:      API_BASE + '/z_messages.php',
    sendText:      API_BASE + '/z_send_text.php',
    reopen:        API_BASE + '/z_reopen_with_template.php',
    markRead:      API_BASE + '/z_mark_read.php'
  };

  // === Estado ===
  let state = {
    status: 'open',
    page: 1,
    pageSize: 30,
    conversations: [],
    current: null, // { id, contact_name, wa_phone, last_incoming_at, ... }
    messages: [],
    poll: null
  };

  // === Util ===
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  function toast(msg, ms=2500){ const t=qs('#toast'); t.textContent=msg; t.style.display='block'; setTimeout(()=>{t.style.display='none'}, ms); }
  function fmtDate(s){ if(!s) return '—'; const d=new Date(s.replace(' ','T')+'Z'); return d.toLocaleString(); }
  function within24h(lastIncoming){ if(!lastIncoming) return false; const t = new Date(lastIncoming.replace(' ','T')+'Z'); return (Date.now()-t.getTime()) <= 24*3600*1000; }

  // ★ autoscroll inteligente
  function scrollToBottom(force=false){
    const box = qs('#messages');
    const nearBottom = (box.scrollTop + box.clientHeight) >= (box.scrollHeight - 80);
    if (force || nearBottom) box.scrollTop = box.scrollHeight;
  }

  // === Cargar conversaciones ===
  async function loadConversations(){
    const search = qs('#search').value.trim();
    const url = new URL(ENDPOINTS.conversations);
    url.searchParams.set('status', state.status);
    url.searchParams.set('page', state.page);
    url.searchParams.set('page_size', state.pageSize);
    if (search) url.searchParams.set('search', search);
    const r = await fetch(url);
    const j = await r.json();
    state.conversations = j.data||[];
    renderConversations();
  }

  function renderConversations(){
    const box = qs('#convList'); box.innerHTML='';
    if (!state.conversations.length){ box.innerHTML = '<div class="empty" style="padding:12px">Sin resultados</div>'; return; }
    state.conversations.forEach(c=>{
      const el=document.createElement('div'); el.className='conv'; el.dataset.id=c.id;
      el.innerHTML = `
        <div class="title">${c.contact_name||c.wa_phone||'Sin nombre'}</div>
        <div class="meta">${c.wa_phone||''}</div>
        <div class="meta">Último in: ${fmtDate(c.last_incoming_at)}</div>
        <div class="meta">Estado: ${c.status}</div>
      `;
      el.onclick=()=>selectConversation(c);
      box.appendChild(el);
    });
  }

  async function selectConversation(c){
    state.current = c; qs('#hdrTitle').textContent = c.contact_name || c.wa_phone || ('ID '+c.id);
    qs('#hdrSub').textContent = (c.wa_phone||'') + ' · conv #' + c.id;
    const open = within24h(c.last_incoming_at);
    qs('#pillWindow').textContent = 'Ventana 24h: ' + (open?'activa':'cerrada');
    qs('#composer').disabled = !open;
    qs('#btnSend').disabled = !open;
    qs('#btnReopen').disabled = false;
    await loadMessages(c.id);
    startPolling();
  }

  async function loadMessages(convId){
    const url = new URL(ENDPOINTS.messages);
    url.searchParams.set('conversation_id', convId);
    url.searchParams.set('page', 1);
    url.searchParams.set('page_size', 200);
    const r = await fetch(url);
    const j = await r.json();
    state.messages = j.data||[];
    renderMessages();
  }

  function renderMessages(){
    const box = qs('#messages'); box.innerHTML='';
    if (!state.messages.length){ box.innerHTML = '<div class="empty">No hay mensajes en este hilo.</div>'; return; }
    state.messages.forEach(m=>{
      const li=document.createElement('div'); li.className = 'bubble ' + (m.direction==='out'?'out':'in');
      li.innerHTML = `
        <div>${escapeHtml(m.text||'')}</div>
        <div class="time">${m.msg_type} · ${fmtDate(m.created_at)}</div>
      `;
      box.appendChild(li);
    });
    scrollToBottom(); /* ★ en lugar de forzar siempre */
    // Habilitar mark read si hay último entrante
    const lastIn = [...state.messages].reverse().find(m=>m.direction==='in');
    qs('#btnMarkRead').disabled = !lastIn;
    qs('#btnMarkRead').dataset.wamid = lastIn ? lastIn.wa_message_id : '';
  }

  function escapeHtml(s){
    return s.replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  }

  // === Envío de texto ===
  async function sendText(){
    if (!state.current) return; const txt = qs('#composer').value.trim(); if (!txt) return;
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
      scrollToBottom(true); /* ★ baja siempre tras enviar */
      await loadMessages(state.current.id);
    }catch(e){ toast('Error: '+e.message); }
    finally{ qs('#btnSend').disabled = false; }
  }

  // === Reabrir con plantilla ===
  function openTplModal(){
    const m = qs('#tplModal'); m.style.display='flex';
    qs('#paramWrap').innerHTML=''; addParam();
    qs('#tplName').focus();
  }
  function closeTplModal(){ qs('#tplModal').style.display='none'; }
  function addParam(){ const input=document.createElement('input'); input.placeholder='{{n}}'; qs('#paramWrap').appendChild(input); }
  async function sendTpl(){
    if (!state.current) return; const name = qs('#tplName').value.trim()||'req_01';
    const params = Array.from(qs('#paramWrap').querySelectorAll('input')).map(i=>i.value).filter(Boolean);
    try{
      const r = await fetch(ENDPOINTS.reopen,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({conversation_id: state.current.id, template: name, params})
      });
      const j = await r.json(); if(!j.ok) throw new Error(j.error||'Fallo plantilla');
      toast('Plantilla enviada'); closeTplModal();
      state.current.last_incoming_at = new Date().toISOString().slice(0,19).replace('T',' ');
      qs('#composer').disabled = false; qs('#btnSend').disabled = false; qs('#pillWindow').textContent = 'Ventana 24h: activa';
    }catch(e){ toast('Error: '+e.message); }
  }

  // === Mark read ===
  async function markRead(){
    const id = qs('#btnMarkRead').dataset.wamid; if(!id) return;
    try{
      const r = await fetch(ENDPOINTS.markRead,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wa_message_id:id})});
      const j=await r.json(); if(!j.ok) throw new Error('No se pudo marcar');
      toast('Marcado como leído');
    }catch(e){ toast('Error: '+e.message); }
  }

  // === Polling ===
  function startPolling(){ stopPolling(); state.poll = setInterval(()=>{ if(state.current) loadMessages(state.current.id); }, 8000); }
  function stopPolling(){ if(state.poll){ clearInterval(state.poll); state.poll=null; } }

  // === Eventos UI ===
  qsa('.tab').forEach(t=> t.onclick = ()=>{
    qsa('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active'); state.status=t.dataset.status; state.page=1; loadConversations();
  });
  qs('#search').addEventListener('input', debounce(()=>{ state.page=1; loadConversations(); }, 400));
  qs('#btnSend').onclick = sendText;
  qs('#btnReopen').onclick = openTplModal;
  qs('#btnMarkRead').onclick = markRead;
  qs('#btnAddParam').onclick = addParam;
  qs('#btnSendTpl').onclick = sendTpl;
  qs('#btnCloseTpl').onclick = closeTplModal;

  function debounce(fn,ms){ let h; return (...a)=>{ clearTimeout(h); h=setTimeout(()=>fn(...a),ms); } }

  // Init
  loadConversations();
  </script>

  <script type="module">
  import { guardPage } from "/JS/auth/guard.js";
  guardPage({
    allowEmpIds: [6, 5, 4, 2],     
    stealth: false,
    redirectTo: "/VIEWS/home.php"
  });
  </script>

</body>
</html>
