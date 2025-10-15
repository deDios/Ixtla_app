<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ixtla App</title>
    <link rel="stylesheet" href="/CSS/plantilla.css">
    <link rel="stylesheet" href="/CSS/home.css">
    <link rel="stylesheet" href="/CSS/requerimiento.css">
    <link rel="stylesheet" href="/CSS/stepper.css">
    <link rel="stylesheet" href="/CSS/components.css">
    <link rel="icon" href="/favicon.ico">
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
                <!-- El JSglobal reemplaza este avatar cuando hay sesion -->
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
                <!-- El JSglobal inyecta aquí el avatar desktop si hay sesion -->
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





    <main class="home-samapa">
        <div class="hs-wrap">
            <!-- SIDEBAR -->
            <aside class="hs-sidebar">
                <!-- Perfil -->
                <section class="hs-profile" aria-label="Perfil">
                    <img class="avatar" src="/ASSETS/user/img_user1.png" alt="Avatar">
                    <!-- <a class="link" href="#perfil" aria-label="Administrar perfil">Administrar perfil ›</a> -->
                    <h3 class="name">Juan Pablo Garcia Casillas</h3>
                    <span class="badge">SAMAPA</span>
                </section>

                <!-- Estados -->
                <nav class="hs-states" aria-label="Estados">
                    <button class="item is-active">
                        <span class="label">Todos</span><span class="count">(50)</span>
                    </button>
                    <button class="item">
                        <span class="label">Pendientes</span><span class="count">(10)</span>
                    </button>
                    <button class="item">
                        <span class="label">En proceso</span><span class="count">(10)</span>
                    </button>
                    <button class="item">
                        <span class="label">Terminados</span><span class="count">(20)</span>
                    </button>
                    <button class="item">
                        <span class="label">Cancelados</span><span class="count">(5)</span>
                    </button>
                    <button class="item">
                        <span class="label">Pausados</span><span class="count">(5)</span>
                    </button>
                </nav>
            </aside>

            <!-- MAIN -->
            <section class="hs-main exp-view">

                <!-- Encabezado: título + meta -->
                <header class="exp-head">
                    <div class="exp-title">
                        <h1>Fuga de agua</h1>
                    </div>

                    <dl class="exp-meta">
                        <div>
                            <dt>Informante</dt>
                            <dd>Luis Enrique Mendez</dd>
                        </div>
                        <div>
                            <dt>Encargado</dt>
                            <dd>Juan Pablo</dd>
                        </div>
                        <div>
                            <dt>Fecha de solicitado</dt>
                            <dd>04/06/2025 12:30pm</dd>
                        </div>
                    </dl>
                </header>

                <!-- Stepper -->
                <div class="container">
                    <ul class="step-menu">
                        <li role="button" class="complete">Step 1</li>
                        <li role="button" class="current">Step 2</li>
                        <li role="button">Step 3</li>
                        <li role="button">Step 4</li>
                        <li role="button">Step 5</li>
                        <li role="button">Step 6</li>
                    </ul>
                </div>


                <!-- Tabs -->
                <nav class="exp-tabs" role="tablist" aria-label="Secciones">
                    <button class="exp-tab is-active" role="tab" aria-selected="true">Informante</button>
                    <button class="exp-tab" role="tab" aria-selected="false">Detalles</button>
                    <button class="exp-tab" role="tab" aria-selected="false">Planeación</button>
                </nav>

                <!-- Panel activo (Informante) -->
                <section class="exp-pane is-active" role="tabpanel">
                    <div class="exp-grid">
                        <div class="exp-field">
                            <label>Nombre:</label>
                            <div class="exp-val">Luis Enrique Mendez</div>
                        </div>
                        <div class="exp-field">
                            <label>Teléfono:</label>
                            <div class="exp-val">33 3333 3333</div>
                        </div>
                        <div class="exp-field">
                            <label>Dirección del reporte:</label>
                            <div class="exp-val">Vicente Guerrero #13, Centro</div>
                        </div>
                        <div class="exp-field">
                            <label>Correo:</label>
                            <div class="exp-val"><a href="mailto:correo@ejemplo.com">correo@ejemplo.com</a></div>
                        </div>
                        <div class="exp-field">
                            <label>C.P.:</label>
                            <div class="exp-val">45850</div>
                        </div>
                    </div>
                </section>

                <!-- Panel: Detalles -->
                <section class="exp-pane" role="tabpanel" data-tab="detalles">
                    <div class="exp-grid">
                        <div class="exp-field">
                            <label>Nombre del Requerimiento:</label>
                            <div class="exp-val">Fuga de agua</div>
                        </div>
                        <div class="exp-field">
                            <label>Líder del Departamento:</label>
                            <div class="exp-val"><a href="#">Juan Pablo</a></div>
                        </div>
                        <div class="exp-field">
                            <label>Asignado:</label>
                            <div class="exp-val"><a href="#">Luis Enrique Mendez</a></div>
                        </div>
                        <div class="exp-field">
                            <label>Estatus:</label>
                            <div class="exp-val">
                                <span class="exp-badge is-info">En proceso</span>
                            </div>
                        </div>

                        <div class="exp-field exp-field--full">
                            <label>Descripción:</label>
                            <div class="exp-val exp-preline">
                                Vimos una fuga de agua en una casa amarilla de dos pisos, lleva más de 3 horas tirando
                                agua y no parece que se encuentren los propietarios. Nos preocupa porque es agua limpia.
                            </div>
                        </div>

                        <div class="exp-field">
                            <label>Fecha de inicio:</label>
                            <div class="exp-val">02/09/2025</div>
                        </div>
                        <div class="exp-field">
                            <label>Fecha de terminado:</label>
                            <div class="exp-val">—</div>
                        </div>
                    </div>
                </section>

                <!-- Panel: Planeación -->
                <section class="exp-pane" role="tabpanel" data-tab="planeacion">
                    <!-- Fase 1 -->
                    <section class="exp-accordion exp-accordion--fase">
                        <button class="exp-acc-head" type="button" aria-expanded="true">
                            <div class="fase-head">
                                <span class="fase-title">Proceso</span>
                                <small class="fase-meta">10 actividades</small>
                            </div>
                            <div class="fase-right">
                                <span class="fase-label">Estatus</span>
                                <span class="exp-progress" aria-label="70%">
                                    <span class="bar" style="width: 70%"></span>
                                    <span class="pct">70%</span>
                                </span>
                                <span class="fase-label">Fecha de inicio</span>
                                <span class="fase-date">02/06/2025</span>
                                <span class="chev" aria-hidden="true"></span>
                            </div>
                        </button>

                        <div class="exp-acc-body">
                            <div class="exp-table exp-table--planeacion">
                                <div class="exp-thead">
                                    <div>Actividad</div>
                                    <div>Responsable</div>
                                    <div>Estatus</div>
                                    <div>Porcentaje</div>
                                    <div>Fecha de inicio</div>
                                </div>

                                <div class="exp-row">
                                    <div class="actividad">Reparación de Llave</div>
                                    <div class="responsable">Juan Pablo</div>
                                    <div class="estatus"><span class="exp-badge is-info">Activo</span></div>
                                    <div class="porcentaje">
                                        <span class="exp-progress xs"><span class="bar"
                                                style="width: 70%"></span></span>
                                    </div>
                                    <div class="fecha">02/06/2025</div>
                                </div>

                                <div class="exp-row">
                                    <div class="actividad">Revisión de toma</div>
                                    <div class="responsable">Juan Pablo</div>
                                    <div class="estatus"><span class="exp-badge is-success">Finalizado</span></div>
                                    <div class="porcentaje">
                                        <span class="exp-progress xs"><span class="bar"
                                                style="width: 100%"></span></span>
                                    </div>
                                    <div class="fecha">10/06/2025</div>
                                </div>

                                <div class="exp-row">
                                    <div class="actividad">Cierre de Toma</div>
                                    <div class="responsable">Juan Pablo</div>
                                    <div class="estatus"><span class="exp-badge is-success">Finalizado</span></div>
                                    <div class="porcentaje">
                                        <span class="exp-progress xs"><span class="bar"
                                                style="width: 100%"></span></span>
                                    </div>
                                    <div class="fecha">10/05/2025</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Fase 2 -->
                    <section class="exp-accordion exp-accordion--fase">
                        <button class="exp-acc-head" type="button" aria-expanded="false">
                            <div class="fase-head">
                                <span class="fase-title">Revisión de la zona</span>
                                <small class="fase-meta">10 actividades</small>
                            </div>
                            <div class="fase-right">
                                <span class="fase-label">Estatus</span>
                                <span class="exp-progress" aria-label="79%"><span class="bar"
                                        style="width: 79%"></span><span class="pct">79%</span></span>
                                <span class="fase-label">Fecha de inicio</span>
                                <span class="fase-date">02/09/2025</span>
                                <span class="chev" aria-hidden="true"></span>
                            </div>
                        </button>
                        <div class="exp-acc-body" style="display:none"></div>
                    </section>

                    <!-- Fase 3 -->
                    <section class="exp-accordion exp-accordion--fase">
                        <button class="exp-acc-head" type="button" aria-expanded="false">
                            <div class="fase-head">
                                <span class="fase-title">Selección de Personal</span>
                                <small class="fase-meta">13 actividades</small>
                            </div>
                            <div class="fase-right">
                                <span class="fase-label">Estatus</span>
                                <span class="exp-progress" aria-label="100%"><span class="bar"
                                        style="width: 100%"></span><span class="pct">100%</span></span>
                                <span class="fase-label">Fecha de inicio</span>
                                <span class="fase-date">02/09/2025</span>
                                <span class="chev" aria-hidden="true"></span>
                            </div>
                        </button>
                        <div class="exp-acc-body" style="display:none"></div>
                    </section>
                </section>


                <!-- Evidencias (accordion + tabla simple) -->
                <section class="exp-accordion">
                    <button class="exp-acc-head" type="button" aria-expanded="true">
                        <span>Evidencias</span>
                        <span class="chev" aria-hidden="true"></span>
                    </button>

                    <div class="exp-acc-body">
                        <div class="exp-table">
                            <div class="exp-thead">
                                <div>Nombre <span class="sort"></span></div>
                                <div>Quien lo cargo</div>
                                <div>Última modificación <span class="sort"></span></div>
                            </div>

                            <a class="exp-row" href="#">
                                <div class="file">
                                    <img class="ico" src="/ASSETS/filetypes/img.png" alt="">
                                    <span>Evidencia Fuga de Agua</span>
                                </div>
                                <div class="who">Luis Enrique</div>
                                <div class="date">02 de Septiembre del 2025 a las 14:25</div>
                            </a>
                        </div>
                    </div>
                </section>
            </section>
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


    <!--
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
    <script type="module" src="/JS/home.js"></script>
    -->

    <script src="/JS/JSglobal.js"></script>
    <script src="/JS/requerimientoView.js"></script>

</body>

</html>