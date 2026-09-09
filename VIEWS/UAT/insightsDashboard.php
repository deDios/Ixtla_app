<?php
declare(strict_types=1);

require_once __DIR__ . '/../../JS/UAT/auth/ix_guard.php';
ix_require_session(['login_url' => '/VIEWS/UAT/login.php']);
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mi dashboard — Ixtla Insights</title>
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/CSS/UAT/ixtla-insights-dashboard.css?v=dashboard-close-1">
  <link rel="stylesheet" href="/CSS/UAT/ixtla-insights-chat.css?v=dashboard-assistant-1">
</head>
<body class="ixtla-dashboard-page">
  <header class="ixtla-dashboard-appbar">
    <a class="ixtla-dashboard-brand" href="/VIEWS/UAT/home.php" aria-label="Volver a Ixtla Insights">
      <span class="ixtla-dashboard-brand__mark" aria-hidden="true">✦</span>
      <span><strong>Ixtla Insights</strong><small>Asistente de requerimientos</small></span>
    </a>
    <a class="ixtla-dashboard-appbar__back" href="/VIEWS/UAT/home.php">← Volver al asistente</a>
  </header>

  <main class="ixtla-dashboard-shell">
    <section class="ixtla-dashboard-top" aria-labelledby="dashboard-title">
      <div>
        <p class="ixtla-dashboard-kicker">Espacio de trabajo</p>
        <h1 id="dashboard-title">Mi dashboard</h1>
        <p>Consulta y organiza las visualizaciones que preparaste con el asistente.</p>
        <span class="ixtla-dashboard-scope">Privado · Sesión actual</span>
      </div>
      <div class="ixtla-dashboard-actions" aria-label="Acciones del dashboard">
        <button class="ixtla-dashboard-button ixtla-dashboard-button--ghost" id="dashboard-refresh" type="button">Actualizar</button>
        <button class="ixtla-dashboard-button ixtla-dashboard-button--danger" id="dashboard-clear" type="button">Limpiar dashboard</button>
        <a class="ixtla-dashboard-button" href="/VIEWS/UAT/home.php">＋ Crear con el asistente</a>
      </div>
    </section>

    <section class="ixtla-dashboard-summary" aria-live="polite">
      <div><strong id="dashboard-widget-count">0</strong><span>visualizaciones</span></div>
      <p id="dashboard-status">Las gráficas se conservan durante esta sesión del navegador.</p>
      <span class="ixtla-dashboard-summary__badge">Datos según tu alcance autorizado</span>
    </section>

    <section id="dashboard-grid" class="ixtla-dashboard-grid" aria-label="Visualizaciones del dashboard"></section>

    <section id="dashboard-empty" class="ixtla-dashboard-empty" hidden>
      <span class="ixtla-dashboard-empty__mark" aria-hidden="true">✦</span>
      <h2>Tu dashboard está listo para comenzar</h2>
      <p>Pídele una gráfica al asistente, revisa su preview y selecciona “Agregar al dashboard”.</p>
      <a class="ixtla-dashboard-button" href="/VIEWS/UAT/home.php">Crear mi primera gráfica</a>
    </section>

    <p class="ixtla-dashboard-footnote">Esta primera versión utiliza almacenamiento temporal de sesión. La publicación privada, departamental y organizacional se habilitará con la persistencia autorizada del servidor.</p>
  </main>

  <dialog class="ixtla-dashboard-confirm" id="dashboard-confirm">
    <form method="dialog">
      <span class="ixtla-dashboard-confirm__icon" aria-hidden="true">!</span>
      <h2>¿Limpiar el dashboard?</h2>
      <p>Se quitarán todas las visualizaciones preparadas durante esta sesión.</p>
      <div>
        <button class="ixtla-dashboard-button ixtla-dashboard-button--ghost" value="cancel">Cancelar</button>
        <button class="ixtla-dashboard-button ixtla-dashboard-button--danger" value="confirm">Sí, limpiar</button>
      </div>
    </form>
  </dialog>

  <dialog class="ixtla-dashboard-settings" id="dashboard-settings">
    <form method="dialog" id="dashboard-settings-form">
      <header>
        <div>
          <span class="ixtla-dashboard-settings__eyebrow">Configuración de la gráfica</span>
          <h2 id="dashboard-settings-title">Compartir visualización</h2>
        </div>
        <button class="ixtla-dashboard-icon-button" type="button" data-settings-close aria-label="Cerrar">×</button>
      </header>

      <p class="ixtla-dashboard-settings__notice">Las opciones disponibles dependen de tus permisos de publicación.</p>

      <fieldset>
        <legend>¿Quién podrá verla?</legend>
        <label><input type="radio" name="visibility" value="private" checked> Solo yo</label>
        <label><input type="radio" name="visibility" value="team"> Mi equipo</label>
        <label><input type="radio" name="visibility" value="department"> Mi departamento</label>
        <label><input type="radio" name="visibility" value="departments"> Departamentos seleccionados</label>
        <label><input type="radio" name="visibility" value="organization"> Toda la organización</label>
      </fieldset>

      <section id="dashboard-settings-audience" hidden>
        <div class="ixtla-dashboard-settings__section-title">
          <strong>Seleccionar departamentos</strong>
          <button type="button" data-departments-clear>Limpiar</button>
        </div>
        <input id="dashboard-settings-search" type="search" placeholder="Buscar departamento" autocomplete="off">
        <div class="ixtla-dashboard-settings__departments" id="dashboard-settings-departments"></div>
      </section>

      <fieldset>
        <legend>Comportamiento para los destinatarios</legend>
        <label><input type="checkbox" name="featured"> Mostrar como destacada</label>
        <label><input type="checkbox" name="mandatory"> Mantener como obligatoria</label>
        <label><input type="checkbox" name="allow_hide" checked> Permitir ocultarla</label>
        <label><input type="checkbox" name="allow_resize" checked> Permitir cambiar su tamaño</label>
        <label><input type="checkbox" name="allow_reorder" checked> Permitir reorganizarla</label>
      </fieldset>

      <div class="ixtla-dashboard-settings__summary" id="dashboard-settings-summary" role="alert" hidden></div>
      <footer>
        <button class="ixtla-dashboard-button ixtla-dashboard-button--ghost" type="button" data-settings-close>Cancelar</button>
        <button class="ixtla-dashboard-button" type="submit" value="save">Guardar configuración</button>
      </footer>
    </form>
  </dialog>

  <script type="module" src="/JS/UAT/insights/dashboard.js?v=dashboard-assistant-1"></script>
</body>
</html>
