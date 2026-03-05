document.addEventListener("DOMContentLoaded", () => {

    const selectMes = document.getElementById("filtro-mes");

    // Generar últimos 12 meses dinámicamente
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = d.toISOString().slice(0,7);
        const label = d.toLocaleDateString('es-MX', { month:'long', year:'numeric' });
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
        selectMes.appendChild(option);
    }

    selectMes.addEventListener("change", cargarDashboard);

    cargarDashboard();
});

function cargarDashboard() {

    const mes = document.getElementById("filtro-mes").value;

    fetch("/API/dashboardData.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: mes })
    })
    .then(res => res.json())
    .then(data => {

        document.getElementById("kpi-val-semana").textContent = data.promedio_semanal;
        document.getElementById("kpi-val-tiempo").textContent = data.tiempo_promedio + " Días";
        document.getElementById("kpi-val-cp").textContent = data.cp_top;

        renderTabla(data.categorias);
        renderDonut(data.open, data.close);
        renderMapa(data.mapa);

    });
}

function renderTabla(categorias) {

    const tbody = document.getElementById("tbl-tramites-body");
    tbody.innerHTML = "";

    categorias.forEach(cat => {
        tbody.innerHTML += `
            <tr>
                <td>${cat.nombre}</td>
                <td>${cat.abiertos}</td>
                <td>${cat.cerrados}</td>
                <td>${cat.total}</td>
            </tr>
        `;
    });
}

function renderDonut(open, close) {

    const ctx = document.getElementById("donutChart");

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Abiertos', 'Cerrados'],
            datasets: [{
                data: [open, close],
                backgroundColor: ['#f97316', '#10b981']
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            cutout: '70%'
        }
    });
}

function renderMapa(puntos) {

    const map = L.map('map-colonias').setView([19.4326, -99.1332], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
        .addTo(map);

    const heat = L.heatLayer(puntos, { radius: 25 });
    heat.addTo(map);
}