<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ixtla App UAT</title>
  <link rel="stylesheet" href="/CSS/plantilla.css">
  <link rel="stylesheet" href="/CSS/UAT/home.css">
  <link rel="stylesheet" href="/CSS/components.css">
  <link rel="icon" href="/favicon.ico">
</head>

<body>

  <!-- Header/topbar propios -->
  <header id="header" data-link-home="/index.php">
    <div class="social-bar-mobile">
      <div class="social-icons">
        <div class="icon-mobile"><img src="/ASSETS/social_icons/Facebook_logo.png" alt="Facebook" /></div>
        <div class="icon-mobile"><img src="/ASSETS/social_icons/Instagram_logo.png" alt="Instagram" /></div>
        <div class="icon-mobile"><img src="/ASSETS/social_icons/Youtube_logo.png" alt="YouTube" /></div>
        <div class="icon-mobile"><img src="/ASSETS/social_icons/X_logo.png" alt="X" /></div>
        <div class="user-icon-mobile" onclick="window.location.href='/VIEWS/login.php'">
          <img src="/ASSETS/user/img_user1.png" alt="Usuario" />
        </div>
      </div>
    </div>

    <div class="top-bar" id="top-bar">
      <div id="logo-btn" class="logo" title="Ir al inicio" aria-label="Ir al inicio">
        <img class="logo-marca" src="/ASSETS/main_logo.png" alt="Ixtlahuacán de los Membrillos - Ayuntamiento" />
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
        <!-- JS global inyecta avatar si hay sesión -->
      </div>
    </div>

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
          <section class="profile-card" aria-label="Perfil">
            <img class="avatar" src="/ASSETS/user/img_user1.png" alt="Avatar">
            <a class="profile-link" href="#perfil">Administrar perfil ></a>
            <h3 id="h-user-nombre" class="profile-name">—</h3>
            <span class="profile-dash" aria-hidden="true"></span>
            <button type="button" class="profile-dep badge" aria-label="Dependencia actual"></button>
          </section>

          <nav class="status-block" aria-label="Estados">
            <div class="status-nav">
              <button class="status-item active">
                <span class="label">Todos</span>
                <span class="count">(50)</span>
              </button>
              <button class="status-item"><span class="label">Solicitud</span><span class="count">(0)</span></button>
              <button class="status-item"><span class="label">Revisión</span><span class="count">(0)</span></button>
              <button class="status-item"><span class="label">Asignación</span><span class="count">(0)</span></button>
              <button class="status-item"><span class="label">En proceso</span><span class="count">(0)</span></button>
              <button class="status-item"><span class="label">Pausado</span><span class="count">(0)</span></button>
              <button class="status-item"><span class="label">Cancelado</span><span class="count">(0)</span></button>
              <button class="status-item"><span class="label">Finalizado</span><span class="count">(0)</span></button>
            </div>
          </nav>
        </aside>

        <!-- Main -->
        <section class="home-main" aria-label="Contenido principal">
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

  <!-- =================== MODALES =================== -->
  <div class="ix-drawer-overlay" data-drawer="overlay" hidden></div>

  <section aria-label="Panel de trámite">
    <aside class="ix-drawer" role="dialog" aria-modal="true" aria-labelledby="ix-drw-title" data-drawer="panel">
      <!-- Header -->
      <header class="ixd-head">
        <h3 id="ix-drw-title" class="ixd-folio" data-field="folio">REQ-0000000000</h3>
        <button class="ixd-close" data-drawer="close" aria-label="Cerrar">Cerrar</button>
      </header>

      <!-- Meta -->
      <div class="ixd-meta">
        <div><strong>Trámite:</strong> <span data-field="tramite_nombre">—</span></div>
        <div><strong>Depto:</strong> <span data-field="departamento_nombre">—</span></div>
        <div><strong>Asignado a:</strong> <span data-field="asignado_nombre_completo">—</span></div>
        <div><strong>Creado:</strong> <span data-field="created_at">—</span></div>
      </div>

      <!-- Body -->
      <div class="ixd-body">
        <div class="ixd-field">
          <label>Asunto</label>
          <p data-field="asunto">—</p>
          <input class="ixd-input" name="asunto" type="text" data-edit hidden />
        </div>

        <div class="ixd-field">
          <label>Descripción</label>
          <p data-field="descripcion">—</p>
          <textarea class="ixd-input" name="descripcion" rows="4" data-edit hidden></textarea>
        </div>

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
            <input class="ixd-input" name="canal" type="number" data-edit hidden />
          </div>
        </div>

        <h4 class="ixd-sub">Contacto</h4>

        <div class="ixd-grid2">
          <div class="ixd-field">
            <label>Nombre</label>
            <p data-field="contacto_nombre">—</p>
            <input class="ixd-input" name="contacto_nombre" type="text" data-edit hidden />
          </div>
          <div class="ixd-field">
            <label>Teléfono</label>
            <p data-field="contacto_telefono">—</p>
            <input class="ixd-input" name="contacto_telefono" type="tel" data-edit hidden />
          </div>
        </div>

        <div class="ixd-grid2">
          <div class="ixd-field">
            <label>Email</label>
            <p data-field="contacto_email">—</p>
            <input class="ixd-input" name="contacto_email" type="email" data-edit hidden />
          </div>
          <div class="ixd-field">
            <label>Código Postal</label>
            <p data-field="contacto_cp">—</p>
            <select class="ixd-input" name="contacto_cp" data-edit hidden></select>
          </div>
        </div>

        <div class="ixd-field">
          <label>Calle</label>
          <p data-field="contacto_calle">—</p>
          <input class="ixd-input" name="contacto_calle" type="text" data-edit hidden />
        </div>

        <div class="ixd-field">
          <label>Colonia</label>
          <p data-field="contacto_colonia">—</p>
          <select class="ixd-input" name="contacto_colonia" data-edit hidden></select>
        </div>

        <div class="ixd-field">
          <label>Estatus</label>
          <p data-field="estatus">—</p>
          <select class="ixd-input" name="estatus" data-edit hidden>
            <option value="0">Solicitud</option>
            <option value="1">Revisión</option>
            <option value="2">Asignación</option>
            <option value="3">En proceso</option>
            <option value="4">Pausado</option>
            <option value="5">Cancelado</option>
            <option value="6">Finalizado</option>
          </select>
        </div>

        <h4 class="ixd-sub">Galería</h4>

        <div class="ixd-uploadRow">
          <label>Ver evidencia de estado:
            <select data-img="viewStatus">
              <option value="0">Solicitud</option>
              <option value="1">Revisión</option>
              <option value="2">Asignación</option>
              <option value="3">En proceso</option>
              <option value="4">Pausado</option>
              <option value="5">Cancelado</option>
              <option value="6">Finalizado</option>
            </select>
          </label>
        </div>

        <div class="ixd-imgBlock">
          <img data-img="hero" src="" alt="Evidencia" loading="lazy" />
          <button class="ixd-pencil" type="button" data-img="pick" title="Cambiar imagen"
            aria-label="Cambiar imagen">✎</button>
          <input type="file" accept="image/*" data-img="file" hidden />
        </div>

        <div class="ixd-previews" data-img="previews" aria-live="polite" aria-atomic="true"></div>

        <div class="ixd-uploadRow">
          <button class="btn" data-img="uploadBtn" type="button">Subir</button>
        </div>

        <div class="ixd-gallery">
          <div class="ixd-grid" data-img="grid"></div>
          <p class="muted" data-img="empty" hidden>No hay imágenes para este estado.</p>
        </div>

        <input type="hidden" name="id" data-field="id" value="" />
        <input type="hidden" name="updated_by" value="0" />

        <footer class="ixd-actions ixd-actions--footer">
          <button class="btn ixd-edit" data-action="editar" type="button">Editar</button>
          <button class="btn primary ixd-save" data-action="guardar" type="button" style="display:none" disabled>Guardar</button>
          <button class="btn ixd-cancel" data-action="cancelar" type="button" style="display:none">Cancelar</button>
          <button class="btn warning ixd-pause" data-action="pausar" type="button">Pausar</button>
          <button class="btn danger ixd-del" data-action="eliminar" type="button">Eliminar</button>
        </footer>
        
      </div>

    </aside>
  </section>

  <script type="module">
    import {
      guardPage
    } from "/JS/auth/guard.js?v=2";
    guardPage({
      stealth: false,
      redirectTo: "/VIEWS/Login.php"
    });
  </script>
  
  <script src="/JS/components.js"></script>
  <script src="/JS/UAT/jsGlobal.js"></script>
  <script type="module" src="/JS/UAT/home.js"></script>

</body>

</html>