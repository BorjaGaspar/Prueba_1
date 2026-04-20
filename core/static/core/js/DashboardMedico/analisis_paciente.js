// Parseamos la variable que nos ha dejado el HTML
const baseDatosJuegos = JSON.parse(JSON_DATOS_JUEGOS);

let chartPuntos = null;
let chartTiempos = null;
let chartDificultad = null;
let chartAnimo = null;
let juegoActivo = "";

function interpretarAnimo(valorMedia) {
    if (valorMedia === 0) return { emoji: "💬" };
    if (valorMedia <= 1.5) return { emoji: "😢" };
    if (valorMedia <= 2.5) return { emoji: "🙁" };
    if (valorMedia <= 3.5) return { emoji: "😐" };
    if (valorMedia <= 4.5) return { emoji: "🙂" };
    return { emoji: "😄" };
}

function mostrarJuegos(categoria) {
    document.getElementById('contenedor-juegos').classList.remove('d-none');
    document.getElementById('titulo-categoria').innerText = categoria;
    document.querySelectorAll('.lista-juegos').forEach(el => el.classList.add('d-none'));
    const listaActiva = document.getElementById('juegos-' + categoria);
    if (listaActiva) listaActiva.classList.remove('d-none');
}

function volverCategorias() {
    document.getElementById('contenedor-juegos').classList.add('d-none');
    document.querySelectorAll('.lista-juegos').forEach(el => el.classList.add('d-none'));
}

function cerrarAnalisis() {
    document.getElementById('zona-analisis').classList.add('d-none');
    document.getElementById('zona-selector').classList.remove('d-none');
}

function cargarAnalisis(nombreJuego) {
    document.getElementById('zona-selector').classList.add('d-none');
    document.getElementById('zona-analisis').classList.remove('d-none');
    document.getElementById('titulo-graficas').innerText = nombreJuego;
    juegoActivo = nombreJuego;

    const sinDatosDiv = document.getElementById('mensaje-sin-datos');
    const controlesDiv = document.getElementById('controles-nivel');

    if (!baseDatosJuegos[nombreJuego] || Object.keys(baseDatosJuegos[nombreJuego]).length === 0) {
        sinDatosDiv.classList.remove('d-none');
        controlesDiv.classList.add('d-none');
        return;
    }

    sinDatosDiv.classList.add('d-none');
    controlesDiv.classList.remove('d-none');

    const navPills = document.getElementById('niveles-pills');
    navPills.innerHTML = '';
    let nivelASeleccionar = null;

    for (let i = 1; i <= 5; i++) {
        const nivelStr = i.toString();
        const tieneDatos = baseDatosJuegos[nombreJuego].hasOwnProperty(nivelStr);
        if (tieneDatos && !nivelASeleccionar) nivelASeleccionar = nivelStr;

        const activeClass = tieneDatos ? 'border border-primary text-primary cursor-pointer' : 'disabled border text-muted';
        navPills.innerHTML += `
            <li class="nav-item flex-fill text-center px-1" role="presentation">
                <button class="nav-link w-100 ${activeClass}" id="pill-btn-${nivelStr}" 
                        onclick="if(${tieneDatos}) cargarNivel('${nivelStr}')" type="button">
                    Nivel ${i}
                </button>
            </li>
        `;
    }

    if (nivelASeleccionar) cargarNivel(nivelASeleccionar);
}

function cargarNivel(nivel) {
    for (let i = 1; i <= 5; i++) {
        let btn = document.getElementById('pill-btn-' + i);
        if (btn && !btn.classList.contains('disabled')) {
            btn.classList.remove('active', 'bg-primary', 'text-white');
            btn.classList.add('text-primary');
        }
    }
    let btnActivo = document.getElementById('pill-btn-' + nivel);
    if (btnActivo) {
        btnActivo.classList.remove('text-primary');
        btnActivo.classList.add('active', 'bg-primary', 'text-white');
    }

    const datos = baseDatosJuegos[juegoActivo][nivel];
    const numPartidas = datos.puntos.length;
    const maxPuntos = Math.max(...datos.puntos);
    const sumaTiempos = datos.tiempos.reduce((a, b) => a + b, 0);
    const avgTiempo = numPartidas > 0 ? (sumaTiempos / numPartidas).toFixed(1) : 0;

    const aniValidas = datos.animos.filter(a => a > 0);
    const avgAni = aniValidas.length > 0 ? aniValidas.reduce((a, b) => a + b, 0) / aniValidas.length : 0;

    document.getElementById('stat-partidas').innerText = numPartidas;
    document.getElementById('stat-max-puntos').innerText = maxPuntos + ' pts';
    document.getElementById('stat-animo-emoji').innerText = interpretarAnimo(avgAni).emoji;

    // --- NUEVA MAGIA: EFECTO "APAGADO" ELEGANTE ---
    const tarjetaTiempoMedio = document.getElementById('tarjeta-tiempo-medio');
    const statAvgTiempo = document.getElementById('stat-avg-tiempo');
    const statAvgTiempoAviso = document.getElementById('stat-avg-tiempo-aviso');

    const tarjetaGraficaTiempos = document.getElementById('tarjeta-grafica-tiempos');
    const tituloGraficaTiempos = document.getElementById('titulo-grafica-tiempos');
    const overlayTiemposDisabled = document.getElementById('overlay-tiempos-disabled');

    // Si el juego es VASOS, Encuentra la Bolita o Música y Colores atenuamos las tarjetas y mostramos los avisos
    if (juegoActivo === 'VASOS' || juegoActivo === 'Encuentra la Bolita' || juegoActivo === 'Música y Colores') {
        // Apagar métrica superior
        tarjetaTiempoMedio.classList.replace('border-info', 'border-secondary');
        tarjetaTiempoMedio.style.opacity = '0.6';
        statAvgTiempo.classList.replace('text-info', 'text-secondary');
        statAvgTiempo.innerText = "N/A";
        statAvgTiempoAviso.classList.remove('d-none');

        // Apagar gráfica inferior
        tituloGraficaTiempos.classList.replace('text-info', 'text-secondary');
        overlayTiemposDisabled.classList.remove('d-none');
    } else {
        // Restaurar a la normalidad (para Encuentra la Letra, etc.)
        tarjetaTiempoMedio.classList.replace('border-secondary', 'border-info');
        tarjetaTiempoMedio.style.opacity = '1';
        statAvgTiempo.classList.replace('text-secondary', 'text-info');
        statAvgTiempo.innerText = avgTiempo + 's';
        statAvgTiempoAviso.classList.add('d-none');

        tituloGraficaTiempos.classList.replace('text-secondary', 'text-info');
        overlayTiemposDisabled.classList.add('d-none');
    }
    // ----------------------------------------------

    dibujarGraficas(datos.fechas, datos.puntos, datos.tiempos, datos.dificultades, datos.animos);
}

function dibujarGraficas(fechas, puntos, tiempos, dificultades, animos) {
    if (chartPuntos) chartPuntos.destroy();
    if (chartTiempos) chartTiempos.destroy();
    if (chartDificultad) chartDificultad.destroy();
    if (chartAnimo) chartAnimo.destroy();

    const ctxPuntos = document.getElementById('graficaPuntos').getContext('2d');
    chartPuntos = new Chart(ctxPuntos, {
        type: 'line',
        data: {
            labels: fechas,
            datasets: [{
                label: 'Puntuación', data: puntos,
                borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)',
                borderWidth: 3, tension: 0.3, fill: true,
                pointBackgroundColor: '#fff', pointBorderColor: '#0d6efd', pointRadius: 6
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { borderDash: [5, 5] } }, x: { grid: { display: false } } } }
    });

    const ctxTiempos = document.getElementById('graficaTiempos').getContext('2d');
    chartTiempos = new Chart(ctxTiempos, {
        type: 'bar',
        data: {
            labels: fechas,
            datasets: [{
                label: 'Tiempo', data: tiempos,
                backgroundColor: 'rgba(13, 202, 240, 0.7)', borderColor: '#0dcaf0',
                borderWidth: 2, borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { borderDash: [5, 5] } }, x: { grid: { display: false } } } }
    });

    const difDataLimpiada = dificultades.map(d => d === 0 ? null : d);
    const aniDataLimpiada = animos.map(a => a === 0 ? null : a);

    const ctxDificultad = document.getElementById('graficaDificultad').getContext('2d');
    chartDificultad = new Chart(ctxDificultad, {
        type: 'line',
        data: {
            labels: fechas,
            datasets: [{
                label: 'Dificultad', data: difDataLimpiada,
                borderColor: '#ffc107', backgroundColor: 'rgba(255, 193, 7, 0.1)',
                borderWidth: 3, tension: 0.1, fill: true, spanGaps: true,
                pointBackgroundColor: '#fff', pointBorderColor: '#ffc107', pointRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: {
                    min: 0.5, max: 5.5,
                    ticks: {
                        stepSize: 1,
                        callback: function (value) {
                            if (value === 1) return '1 - Muy Fácil';
                            if (value === 2) return '2 - Fácil';
                            if (value === 3) return '3 - Normal';
                            if (value === 4) return '4 - Difícil';
                            if (value === 5) return '5 - Muy Difícil';
                            return '';
                        }
                    }
                }
            }
        }
    });

    const ctxAnimo = document.getElementById('graficaAnimo').getContext('2d');
    chartAnimo = new Chart(ctxAnimo, {
        type: 'line',
        data: {
            labels: fechas,
            datasets: [{
                label: 'Ánimo', data: aniDataLimpiada,
                borderColor: '#198754', backgroundColor: 'rgba(25, 135, 84, 0.1)',
                borderWidth: 3, tension: 0.1, fill: true, spanGaps: true,
                pointBackgroundColor: '#fff', pointBorderColor: '#198754', pointRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: {
                    min: 0.5, max: 5.5,
                    ticks: {
                        stepSize: 1, font: { size: 16 },
                        callback: function (value) {
                            if (value === 1) return '1 😢';
                            if (value === 2) return '2 🙁';
                            if (value === 3) return '3 😐';
                            if (value === 4) return '4 🙂';
                            if (value === 5) return '5 😄';
                            return '';
                        }
                    }
                }
            }
        }
    });
}