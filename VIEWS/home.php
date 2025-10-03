<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/home.css">
    <link rel="stylesheet" href="/CSS/components.css">

    <link rel="icon" href="/favicon.ico">


    <!-- guardiaBonus
    <style>
        html.ix-guard-pending {
            visibility: hidden
        }
    </style>
    <script>
        document.documentElement.classList.add('ix-guard-pending');
    </script>

    <link rel="modulepreload" href="/JS/auth/session.js?v=2">
    <link rel="modulepreload" href="/JS/auth/guard.js?v=2">

    <script type="module">
        import {
            getSession
        } from "/JS/auth/session.js";
        window.__ixSession = getSession();
    </script>

    <script type="module">
        import {
            guardPage
        } from "/JS/auth/guard.js?v=2";
        guardPage({
            stealth: true,
            stealthTheme: "plain"
        });
    </script>

     -->

</head>

<body>

    <!-- Tope de pagina -->
    <header id="header" data-link-home="/index.php">
        <div class="social-bar-mobile">
            <div class="social-icons">
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
                <div class="icon-mobile"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>
                <!-- El JSglobal reemplaza este avatar cuando hay sesión -->
                <div class="user-icon-mobile" onclick="window.location.href='/VIEWS/login.php'">
                    <img src="/ASSETS/user/img_user1.png" alt="Usuario" />
                </div>
            </div>
        </div>


        <!-- Top bar: logo a la izquierda, acciones (Hamburguesa) a la derecha -->
        <div class="top-bar" id="top-bar">
            <div id="logo-btn" class="logo" title="Ir al inicio" aria-label="Ir al inicio">
                <!-- logo del header -->
                <img class="logo-marca" src="/ASSETS/main_logo.png"
                    alt="Ixtlahuacán de los Membrillos - Ayuntamiento" />
            </div>


            <div class="actions">
                <button href="/VIEWS/contacto.php" class="btn btn-contacto" type="button"
                    onclick="window.location.href=this.getAttribute('href')">
                    Contacto
                </button>
                <button class="hamburger" aria-controls="mobile-menu" aria-expanded="false" aria-label="Abrir menú"
                    onclick="toggleMenu()">
                    <span></span><span></span><span></span>
                </button>
                <!-- El JSglobal inyecta aquí el avatar desktop si hay sesión -->
            </div>
        </div>


        <!-- Subnav -- links a la izquierda, redes + avatar a la derecha -->
        <nav id="mobile-menu" class="subnav" aria-label="Navegación secundaria">
            <div class="nav-left">
                <a href="/index.php">Inicio</a>
                <a href="/VIEWS/tramiteDepartamento.php">Trámites y Seguimiento</a>
            </div>


            <div class="social-icons">
                <div class="circle-icon"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
                <div class="circle-icon"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>
            </div>
        </nav>
    </header>





    <main id="home" class="ix-home" aria-labelledby="home-title">
        <div class="ix-wrap">

            <div class="home-grid">
                <!-- Sidebar -->
                <aside class="home-sidebar">
                    <section class="profile-card">
                        <img class="avatar" src="/ASSETS/user/img_user1.png" alt="Avatar">

                        <a class="profile-link" href="#perfil">Administrar perfil ></a>

                        <span class="profile-dash" aria-hidden="true"></span>

                        <!-- chip de departamento -->
                        <button type="button" class="profile-dep badge" aria-label="Dependencia actual">
                            Departamento
                        </button>
                    </section>

                    <nav class="status-block" aria-label="Estados">
                        <div class="status-nav">
                            <button class="status-item active">
                                <span class="label">Todos</span>
                                <span class="count">(50)</span>
                            </button>

                            <button class="status-item">
                                <span class="label">Solicitud</span>
                                <span class="count">(0)</span>
                            </button>

                            <button class="status-item">
                                <span class="label">Revisión</span>
                                <span class="count">(0)</span>
                            </button>

                            <button class="status-item">
                                <span class="label">Asignación</span>
                                <span class="count">(0)</span>
                            </button>

                            <button class="status-item">
                                <span class="label">En proceso</span>
                                <span class="count">(0)</span>
                            </button>

                            <button class="status-item">
                                <span class="label">Pausado</span>
                                <span class="count">(0)</span>
                            </button>

                            <button class="status-item">
                                <span class="label">Cancelado</span>
                                <span class="count">(0)</span>
                            </button>

                            <button class="status-item">
                                <span class="label">Finalizado</span>
                                <span class="count">(0)</span>
                            </button>
                        </div>
                    </nav>
                </aside>


                <!-- Panel principal -->
                <section class="home-main" aria-label="Contenido principal">
                    <!-- graficos -->
                    <div class="charts-row">
                        <section class="chart-card" aria-labelledby="chart-year-title">
                            <h3 id="chart-year-title">Gráfico de este Año</h3>
                            <div class="chart-wrap">
                                <canvas id="chart-year" width="600" height="260"></canvas>
                                <div class="chart-skeleton" aria-hidden="true"></div>
                            </div>
                        </section>

                        <section class="chart-card" aria-labelledby="chart-month-title">
                            <h3 id="chart-month-title">Gráfico de este mes</h3>
                            <div class="chart-wrap">
                                <canvas id="chart-month" width="420" height="260"></canvas>
                                <div class="chart-skeleton" aria-hidden="true"></div>
                            </div>
                        </section>
                    </div>

                    <!-- Tabla de trámites -->
                    <section class="table-card" aria-labelledby="tbl-title">
                        <div class="table-head">
                            <h3 id="tbl-title">Trámites</h3>
                            <div class="table-tools">
                                <div class="input-search">
                                    <input id="tbl-search" type="search" placeholder="Buscar por nombre o status…" />
                                </div>
                                <div class="legend">
                                    <span>Requerimientos: <strong id="tbl-total">0</strong></span>
                                    <span>·</span>
                                    <span>Status: <strong id="tbl-status-label">Todos los status</strong></span>
                                </div>
                            </div>
                        </div>

                        <div id="tbl-skeleton" class="skeleton-list" aria-hidden="true"></div>

                        <div class="table-wrap" id="tbl-wrap" hidden>
                            <table class="gc-table" aria-describedby="tbl-title">
                                <thead>
                                    <tr>
                                        <th>Requerimiento</th>
                                        <th>Contacto</th>
                                        <th>Teléfono</th>
                                        <th>Departamento</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody id="tbl-body"></tbody>
                            </table>
                            <div class="pagination" id="tbl-pag"></div>
                        </div>

                        <p id="tbl-empty" class="muted" hidden>No hay elementos para mostrar.</p>
                    </section>
                </section>
            </div>
        </div>
    </main>


    <!-- Pie de pagina -->
    <footer id="site-footer">
        <div class="limite">
            <div class="footer-brand">
                <img class="brand-lockup" src="/ASSETS/main_logo_al_frente.png"
                    alt="Ixtlahuacán de los Membrillos - Ayuntamiento">
            </div>

            <div class="footer-cols">
                <div class="col left">
                    <div class="left-inner">
                        <img class="footer-crest" src="/ASSETS/main_logo_shield.png" alt="Escudo municipal">
                        <p class="copyright">
                            © Presidente José Heriberto García Murillo Gobierno de Ixtlahuacán de los Membrillos 2021 |
                            Todos los derechos reservados.
                        </p>
                    </div>
                </div>
                <div class="col right">
                    <p class="location">
                        Ubicación: Jardín, Ixtlahuacán de Los Membrillos Centro, 2 Jardín,
                        45850 Ixtlahuacán de los Membrillos, Jal.
                    </p>
                </div>
            </div>
        </div>
    </footer>












    <!-- ESPACIO PARA MODALES -->



    <!-- Drawer de requerimientos -->
    <div class="ix-drawer-overlay" data-drawer="overlay" hidden></div>

    <!-- Drawer -->
    <section aria-label="Panel de trámite">
        <aside class="ix-drawer" role="dialog" aria-modal="true" aria-labelledby="ix-drw-title" data-drawer="panel">

            <header class="ixd-head">
                <h3 id="ix-drw-title" class="ixd-folio" data-field="folio">REQ-0000000000</h3>
                <button class="ixd-close" data-drawer="close" aria-label="Cerrar">Cerrar</button>
            </header>

            <div class="ixd-meta">
                <div><strong>Trámite:</strong> <span data-field="tramite_nombre">—</span></div>
                <div><strong>Depto:</strong> <span data-field="departamento_nombre">—</span></div>
                <div><strong>Asignado a:</strong> <span data-field="asignado_nombre_completo">—</span></div>
                <div><strong>Creado:</strong> <span data-field="created_at">—</span></div>
            </div>

            <!-- Contenido con scroll -->
            <div class="ixd-body">

                <!-- Departamento
                <div class="ixd-field">
                    <label>Departamento</label>
                    <p data-field="departamento_nombre">—</p>
                </div>
                -->

                <!-- Asunto -->
                <div class="ixd-field">
                    <label>Asunto</label>
                    <p data-field="asunto">—</p>
                    <input class="ixd-input" name="asunto" type="text" data-edit hidden>
                </div>

                <!-- Descripción -->
                <div class="ixd-field">
                    <label>Descripción</label>
                    <p data-field="descripcion">—</p>
                    <textarea class="ixd-input" name="descripcion" rows="4" data-edit hidden></textarea>
                </div>

                <!-- Prioridad / Canal -->
                <div class="ixd-grid2">
                    <div class="ixd-field">
                        <label>Prioridad</label>
                        <p data-field="prioridad">—</p>
                        <select class="ixd-input" name="prioridad" data-edit hidden>
                            <option value="1">Baja</option>
                            <option value="2">Media</option>
                            <option value="3">Alta</option>
                        </select>
                    </div>
                    <div class="ixd-field">
                        <label>Canal</label>
                        <p data-field="canal">—</p>
                        <input class="ixd-input" name="canal" type="number" data-edit hidden>
                    </div>
                </div>

                <h4 class="ixd-sub">Contacto</h4>

                <!-- Contacto: nombre / teléfono -->
                <div class="ixd-grid2">
                    <div class="ixd-field">
                        <label>Nombre</label>
                        <p data-field="contacto_nombre">—</p>
                        <input class="ixd-input" name="contacto_nombre" type="text" data-edit hidden>
                    </div>
                    <div class="ixd-field">
                        <label>Teléfono</label>
                        <p data-field="contacto_telefono">—</p>
                        <input class="ixd-input" name="contacto_telefono" type="tel" data-edit hidden>
                    </div>
                </div>

                <!-- Contacto: email / cp -->
                <div class="ixd-grid2">
                    <div class="ixd-field">
                        <label>Email</label>
                        <p data-field="contacto_email">—</p>
                        <input class="ixd-input" name="contacto_email" type="email" data-edit hidden>
                    </div>
                    <div class="ixd-field">
                        <label>Código Postal</label>
                        <p data-field="contacto_cp">—</p>
                        <input class="ixd-input" name="contacto_cp" type="text" data-edit hidden>
                    </div>
                </div>

                <!-- Contacto: calle -->
                <div class="ixd-field">
                    <label>Calle</label>
                    <p data-field="contacto_calle">—</p>
                    <input class="ixd-input" name="contacto_calle" type="text" data-edit hidden>
                </div>

                <!-- Contacto: colonia -->
                <div class="ixd-field">
                    <label>Colonia</label>
                    <p data-field="contacto_colonia">—</p>
                    <input class="ixd-input" name="contacto_colonia" type="text" data-edit hidden>
                </div>

                <!-- Galería / Evidencia -->
                <h4 class="ixd-sub">Galería</h4>

                <!-- Imagen principal  -->
                <div class="ixd-imgBlock">
                    <img data-img="hero" src="" alt="Evidencia" loading="lazy">
                    <button class="ixd-pencil" type="button" data-img="pick" title="Cambiar imagen"
                        aria-label="Cambiar imagen">✎</button>
                    <input type="file" accept="image/*" data-img="file" hidden>
                </div>

                <!-- Previews locales  -->
                <div class="ixd-previews" data-img="previews" aria-live="polite" aria-atomic="true"></div>

                <!-- Uploader simple (evidencia por estatus) -->
                <div class="ixd-uploadRow">
                    <label>Subir a estado:
                        <select data-img="uploadStatus">
                            <option value="0">Solicitud</option>
                            <option value="1">Revisión</option>
                            <option value="2">Asignación</option>
                            <option value="3">En proceso</option>
                            <option value="4">Pausado</option>
                            <option value="5">Cancelado</option>
                            <option value="6">Finalizado</option>
                        </select>
                    </label>
                    <button class="btn" data-img="uploadBtn" type="button" disabled>Subir</button>
                </div>

                <!-- Hidden obligatorios para update -->
                <input type="hidden" name="id" data-field="id" value="">
                <input type="hidden" name="updated_by" value="0">

            </div>

            <!-- Footer -->
            <footer class="ixd-actions ixd-actions--footer">
                <button class="btn ixd-edit" data-action="editar" type="button">Editar</button>
                <button class="btn primary ixd-save" data-action="guardar" type="button" disabled>Guardar</button>
                <button class="btn danger ixd-del" data-action="eliminar" type="button">Eliminar</button>
            </footer>

        </aside>
    </section>




    <script type="module">
    (function() {
        const panel = document.querySelector('[data-drawer="panel"]');
        if (!panel) return;

        const qs = sel => panel.querySelector(sel);
        const qsa = sel => Array.from(panel.querySelectorAll(sel));

        let filesBuf = [];

        function setEditing(on) {
            panel.classList.toggle('editing', !!on);
            qsa('[data-edit]').forEach(el => el.hidden = !on);
            qsa('.ixd-field p').forEach(el => el.hidden = !!on);
            qs('.ixd-save').disabled = !on;
        }

        function fillFields(row) {
            const map = {
                folio: row.folio,
                tramite_nombre: row.tramite_nombre,
                departamento_nombre: row.departamento_nombre,
                asignado_nombre_completo: row.asignado_nombre_completo,
                created_at: row.created_at,

                asunto: row.asunto,
                descripcion: row.descripcion,
                prioridad: row.prioridad,
                canal: row.canal,

                contacto_nombre: row.contacto_nombre,
                contacto_telefono: row.contacto_telefono,
                contacto_email: row.contacto_email,
                contacto_cp: row.contacto_cp,
                contacto_calle: row.contacto_calle,
                contacto_colonia: row.contacto_colonia,

                id: row.id
            };
            Object.entries(map).forEach(([k, v]) => {
                const p = qs(`[data-field="${k}"]`);
                if (p) p.textContent = v ?? "—";
                const i = qs(`.ixd-input[name="${k}"]`);
                if (i) i.value = v ?? "";
            });
            const hero = qs('[data-img="hero"]');
            if (hero) hero.src = row.hero_url || "";
        }

        async function listMedia({
            folio,
            status
        }) {
            const url = '/db/WEB/ixtla01_c_requerimiento_media.php';
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        folio,
                        status
                    })
                }).then(r => r.json());

                if (!res?.ok) throw new Error(res?.error || 'Error list media');
                return res.items || res.saved || [];
            } catch (e) {
                console.error('[Drawer] list media', e);
                return [];
            }
        }

        async function loadGallery() {
            const r = panel._row || {};
            const grid = qs('[data-img="grid"]');
            const empty = qs('[data-img="empty"]');
            if (!grid) return;

            const status = Number(qs('[data-img="viewStatus"]')?.value || r.estatus || 0);
            const items = await listMedia({
                folio: r.folio,
                status
            });

            grid.innerHTML = "";
            if (!items.length) {
                if (empty) empty.hidden = false;
                return;
            }
            if (empty) empty.hidden = true;

            const frag = document.createDocumentFragment();
            items.forEach(it => {
                const card = document.createElement('a');
                card.className = 'ixd-card';
                card.href = it.url || it.href || '#';
                card.target = '_blank';
                card.rel = 'noopener';
                card.innerHTML = `
        <img src="${it.url || it.href || ''}" alt="${(it.name||'evidencia')}">
        <div class="nm" title="${it.name||''}">${it.name || ''}</div>
      `;
                frag.appendChild(card);
            });
            grid.appendChild(frag);
        }

        const oldOpen = window.Drawer?.open;
        if (typeof oldOpen === "function") {
            window.Drawer.open = function(row, callbacks = {}) {
                oldOpen.call(window.Drawer, row, callbacks);

                fillFields(row);
                setEditing(false);

                const selView = qs('[data-img="viewStatus"]');
                if (selView) {
                    selView.value = String(row.estatus ?? 0);
                }
                loadGallery();

                filesBuf = [];
                const prevWrap = qs('[data-img="previews"]');
                if (prevWrap) prevWrap.innerHTML = "";
                const upBtn = qs('[data-img="uploadBtn"]');
                if (upBtn) upBtn.disabled = true;

                panel._row = row;
                panel._callbacks = callbacks || {};
            };
        }

        qs('[data-action="editar"]').addEventListener('click', () => setEditing(true));

        qs('[data-action="guardar"]').addEventListener('click', async () => {
            const r = panel._row || {};
            const payload = {
                id: r.id,
                asunto: qs('input[name="asunto"]').value.trim(),
                descripcion: qs('textarea[name="descripcion"]').value.trim(),
                prioridad: Number(qs('select[name="prioridad"]').value || r.prioridad),
                canal: Number(qs('input[name="canal"]').value || r.canal),

                contacto_nombre: qs('input[name="contacto_nombre"]').value.trim(),
                contacto_telefono: qs('input[name="contacto_telefono"]').value.trim(),
                contacto_email: qs('input[name="contacto_email"]').value.trim(),
                contacto_cp: qs('input[name="contacto_cp"]').value.trim(),
                contacto_calle: qs('input[name="contacto_calle"]').value.trim(),
                contacto_colonia: qs('input[name="contacto_colonia"]').value.trim(),

                updated_by: (window.__ixSession?.id_usuario ?? 1)
            };

            try {
                const res = await fetch('/db/WEB/ixtla01_u_requerimiento.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }).then(r => r.json());

                if (!res?.ok) throw new Error(res?.error || 'Update failed');
                fillFields(res.data);
                setEditing(false);
                if (panel._callbacks?.onUpdated) panel._callbacks.onUpdated(res.data);
            } catch (e) {
                console.error('[Drawer] guardar error', e);
                if (panel._callbacks?.onError) panel._callbacks.onError(e);
            }
        });

        qs('[data-action="eliminar"]').addEventListener('click', async () => {
            const r = panel._row || {};
            if (!confirm('¿Eliminar (soft delete)?')) return;
            try {
                const res = await fetch('/db/WEB/ixtla01_u_requerimiento.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id: r.id,
                        _soft_delete: true,
                        updated_by: (window.__ixSession?.id_usuario ?? 1)
                    })
                }).then(r => r.json());
                if (!res?.ok) throw new Error(res?.error || 'Delete failed');
                if (panel._callbacks?.onUpdated) panel._callbacks.onUpdated(res.data);
                document.querySelector('.ix-drawer')?.classList.remove('open');
            } catch (e) {
                console.error('[Drawer] eliminar error', e);
                if (panel._callbacks?.onError) panel._callbacks.onError(e);
            }
        });

        const fileInput = qs('[data-img="file"]');
        qs('[data-img="pick"]').addEventListener('click', () => {
            if (!panel.classList.contains('editing')) return;
            fileInput?.click();
        });

        fileInput.addEventListener('change', () => {
            const list = Array.from(fileInput.files || []);
            filesBuf = list;
            const wrap = qs('[data-img="previews"]');
            const upBtn = qs('[data-img="uploadBtn"]');
            if (wrap) wrap.innerHTML = "";
            list.forEach((f, i) => {
                const url = URL.createObjectURL(f);
                const card = document.createElement('div');
                card.className = 'thumb';
                card.innerHTML =
                    `<img src="${url}" alt="preview"><button class="rm" type="button">Quitar</button>`;
                card.querySelector('.rm').addEventListener('click', () => {
                    filesBuf.splice(i, 1);
                    card.remove();
                    if (upBtn) upBtn.disabled = filesBuf.length === 0;
                });
                wrap.appendChild(card);
            });
            if (upBtn) upBtn.disabled = filesBuf.length === 0;
        });

        qs('[data-img="viewStatus"]')?.addEventListener('change', loadGallery);

        qs('[data-img="uploadBtn"]').addEventListener('click', async () => {
            const r = panel._row || {};
            if (!filesBuf.length) return;

            const status = Number(qs('[data-img="uploadStatus"]').value || 0);

            try {
                await fetch('/db/WEB/ixtla01_u_requerimiento_folders.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        folio: r.folio
                    })
                });
            } catch (_) {}

            const fd = new FormData();
            fd.append('folio', r.folio);
            fd.append('status', String(status));
            filesBuf.forEach(f => fd.append('files[]', f, f.name));

            try {
                const up = await fetch('/db/WEB/ixtla01_c_requerimiento_media.php', {
                    method: 'POST',
                    body: fd
                }).then(r => r.json());
                if (!up?.ok) throw new Error(up?.error || 'Upload failed');

                filesBuf = [];
                const wrap = qs('[data-img="previews"]');
                if (wrap) wrap.innerHTML = "";
                const upBtn = qs('[data-img="uploadBtn"]');
                if (upBtn) upBtn.disabled = true;

                const vSel = qs('[data-img="viewStatus"]');
                const viewing = Number(vSel?.value || 0);
                if (viewing === status) loadGallery();

            } catch (e) {
                console.error('[Drawer] upload error', e);
                if (panel._callbacks?.onError) panel._callbacks.onError(e);
            }
        });

    })();
    </script>











    <script type="module">
    import {
        guardPage
    } from "/JS/auth/guard.js?v=2";
    guardPage({
        stealth: false,
        redirectTo: "/VIEWS/Login.php"
    });
    </script>

    <script src="/JS/JSglobal.js"></script>
    <script src="/JS/components.js"></script>
    <script type="module" src="/JS/home.js"></script>
</body>

</html>