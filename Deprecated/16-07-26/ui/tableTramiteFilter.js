// /JS/ui/tableTramiteFilter.js
(() => {
  // Estado global compartido entre módulos
  if (!window.ixFilters) window.ixFilters = { tramite: null };

  const bodyEl = document.getElementById('tbl-tramites-body');
  if (!bodyEl) return;

  function clearSelection() {
    bodyEl.querySelectorAll('.ix-row.ix-row--selected')
      .forEach(r => r.classList.remove('ix-row--selected'));
  }

  function getTramiteFromRow(row) {
    // Se asume que la primera celda es el nombre del trámite
    const firstCell = row?.querySelector(':scope > div:first-child');
    const t = (firstCell?.textContent || '').trim();
    return t || null;
  }

  // Delegación de eventos: click en cualquier fila .ix-row
  bodyEl.addEventListener('click', (ev) => {
    const row = ev.target.closest('.ix-row');
    if (!row) return;

    const clickedTramite = getTramiteFromRow(row);
    if (!clickedTramite) return;

    // Toggle: si ya estaba seleccionado, deselecciona (vuelve a TODOS)
    const alreadySelected = row.classList.contains('ix-row--selected');

    clearSelection();
    if (!alreadySelected) {
      row.classList.add('ix-row--selected');
      window.ixFilters.tramite = clickedTramite;
    } else {
      window.ixFilters.tramite = null; // Todos
    }

    // Notifica a otros módulos
    window.dispatchEvent(new CustomEvent('ix:filters-changed', {
      detail: { source: 'tramites-table', tramite: window.ixFilters.tramite }
    }));
  });

  // Si otros filtros cambian (chips/mes), mantenemos selección visual coherente
  window.addEventListener('ix:filters-changed', (e) => {
    if (e.detail?.source === 'tramites-table') return; // ya lo manejamos arriba
    const targetTramite = window.ixFilters.tramite || null;

    // Sincroniza UI
    clearSelection();
    if (!targetTramite) return;
    // Busca fila cuyo primer div coincida con el trámite
    const rows = [...bodyEl.querySelectorAll('.ix-row')];
    const match = rows.find(r => (r.querySelector(':scope > div:first-child')?.textContent || '').trim() === targetTramite);
    if (match) match.classList.add('ix-row--selected');
  });
})();
