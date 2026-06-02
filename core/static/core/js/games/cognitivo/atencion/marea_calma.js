// ==========================================
// LÓGICA DEL SISTEMA BASE (NO TOCAR)
// ==========================================
// Variables que la lógica actualiza mientras el paciente juega
let puntosTotales = 0;
let tiempoTotalAcumulado = 0;

document.getElementById('btn-leer-instrucciones').addEventListener('click', function() {
    window.speechSynthesis.cancel();
    const texto = document.getElementById('texto-instrucciones').innerText;
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
});

function comenzarJuego() {
    window.speechSynthesis.cancel();
    document.getElementById('pantalla-instrucciones').style.display = 'none';
    document.getElementById('pantalla-juego').style.display = 'flex';
    iniciarTuJuego();
}

// Flujo de Fin de Juego (ejercicio de relajación: sin PROMs ni guardado en BD)
function finalizarJuegoGlobal() {
    const modalResultados = new bootstrap.Modal(document.getElementById('modalFinJuego'));
    document.getElementById('puntos-finales').innerText = puntosTotales;

    const displayTiempo = document.getElementById('tiempo-final-display');
    if (displayTiempo) displayTiempo.innerText = Math.round(tiempoTotalAcumulado);

    const medallaIcon = document.getElementById('medalla-icon');
    const mensaje = document.getElementById('mensaje-final');

    if (puntosTotales >= 800) {
        medallaIcon.innerText = '🥇'; mensaje.innerText = "¡Increíble! Nivel Oro"; mensaje.className = "text-warning";
    } else if (puntosTotales >= 400) {
        medallaIcon.innerText = '🥈'; mensaje.innerText = "¡Muy bien! Nivel Plata"; mensaje.className = "text-secondary";
    } else {
        medallaIcon.innerText = '🥉'; mensaje.innerText = "¡Bien hecho! Sigue así"; mensaje.className = "text-danger";
    }

    modalResultados.show();
}

// ==========================================
// JAVASCRIPT DE MAREA DE CALMA
// ==========================================

function iniciarTuJuego() {
    const mar = document.getElementById('mar-wrapper');
    const guia = document.getElementById('guia-central');
    const estadoTxt = document.getElementById('estado-respiracion');
    const timerTxt = document.getElementById('timer');
    const cicloTxt = document.getElementById('display-ciclo');

    let cicloActual = 1;
    const maxCiclos = 5;
    const tiempos = { inhalar: 4000, mantener: 4000, exhalar: 5000, vacio: 1500 };
    let inicioSesion = Date.now();

    async function ejecutarCiclo() {
        if (cicloActual > maxCiclos) {
            tiempoTotalAcumulado = (Date.now() - inicioSesion) / 1000;
            puntosTotales = 1000;
            finalizarJuegoGlobal();
            return;
        }

        cicloTxt.innerText = cicloActual;

        // INHALAR
        guia.innerText = "Inhala"; guia.style.opacity = "1";
        estadoTxt.innerText = "Inhalando";
        mar.style.transition = `height ${tiempos.inhalar}ms ease-in-out`;
        mar.style.height = "85%";
        await contadorVisual(tiempos.inhalar);

        // MANTENER
        guia.innerText = "Mantén";
        estadoTxt.innerText = "Sosteniendo";
        await contadorVisual(tiempos.mantener);

        // EXHALAR
        guia.innerText = "Exhala";
        estadoTxt.innerText = "Exhalando";
        mar.style.transition = `height ${tiempos.exhalar}ms ease-in-out`;
        mar.style.height = "15%";
        await contadorVisual(tiempos.exhalar);

        // VACÍO
        guia.innerText = "Espera";
        estadoTxt.innerText = "Relajando";
        await contadorVisual(tiempos.vacio);

        cicloActual++;
        ejecutarCiclo();
    }

    function contadorVisual(ms) {
        return new Promise(resolve => {
            let restante = Math.ceil(ms / 1000);
            timerTxt.innerText = restante + "s";
            const intervalo = setInterval(() => {
                restante--;
                if (restante >= 0) timerTxt.innerText = restante + "s";
                if (restante <= 0) { clearInterval(intervalo); resolve(); }
            }, 1000);
        });
    }

    setTimeout(ejecutarCiclo, 500);
}
