// ==========================================
// CONFIGURACIÓN INICIAL Y CONEXIÓN CON DJANGO
// ==========================================
let nivelUsuario = typeof NIVEL_DEL_SISTEMA !== 'undefined' ? NIVEL_DEL_SISTEMA : 1;
let csrfToken = typeof TOKEN_DJANGO !== 'undefined' ? TOKEN_DJANGO : '';

// Vinculamos las variables de Elsa al nivel del paciente real
let nivelColores = nivelUsuario;
let nivelVelocidad = nivelUsuario;
let nivelPasos = nivelUsuario;

let puntosTotales = 0;
let rondaActual = 1;
let secuenciaJuego = [];
let secuenciaUsuario = [];
let puedeJugar = false;
let audioCtx = null;

const configColores = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
const configTiempos = { 1: 1500, 2: 1200, 3: 1000, 4: 800, 5: 700 };
const configPasos = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };

const infoColores = [
    { id: 0, color: '#FF5252', nota: 261.63 }, // Do
    { id: 1, color: '#448AFF', nota: 293.66 }, // Re
    { id: 2, color: '#FFEB3B', nota: 329.63 }, // Mi
    { id: 3, color: '#4CAF50', nota: 349.23 }, // Fa
    { id: 4, color: '#FF9800', nota: 392.00 }, // Sol
    { id: 5, color: '#E91E63', nota: 440.00 }  // La
];

let animoSeleccionado = null;
let dificultadSeleccionada = null;

// ==========================================
// LÓGICA DEL JUEGO
// ==========================================
function comenzarJuego() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    window.speechSynthesis.cancel();
    document.getElementById('pantalla-instrucciones').style.display = 'none';
    document.getElementById('pantalla-juego').style.display = 'flex';
    iniciarTuJuego();
}

function iniciarTuJuego() {
    puntosTotales = 0;
    rondaActual = 1;
    actualizarUI();
    generarTablero();
    setTimeout(prepararSecuencia, 500);
}

function actualizarUI() {
    document.getElementById('display-ronda').innerText = rondaActual;
    document.getElementById('score').innerText = puntosTotales;
}

function generarTablero() {
    const contenedor = document.getElementById('contenedor-tu-juego');
    contenedor.innerHTML = '';
    const num = configColores[nivelColores];
    for (let i = 0; i < num; i++) {
        const btn = document.createElement('div');
        btn.classList.add('boton-ritmo');
        btn.id = "btn-color-" + i;
        btn.style.cssText = `width: 110px; height: 110px; border-radius: 20%; background-color: ${infoColores[i].color}; cursor: pointer; opacity: 0.6;`;
        btn.onclick = () => manejarEntradaUsuario(i);
        contenedor.appendChild(btn);
    }
}

function prepararSecuencia() {
    puedeJugar = false;
    secuenciaUsuario = [];
    secuenciaJuego = [];
    for (let i = 0; i < configPasos[nivelPasos]; i++) {
        secuenciaJuego.push(Math.floor(Math.random() * configColores[nivelColores]));
    }
    reproducirSecuencia();
}

async function reproducirSecuencia() {
    document.getElementById('mensaje-turno').innerText = "Atención...";
    document.getElementById('mensaje-turno').className = "h3 fw-bold text-secondary";
    await new Promise(r => setTimeout(r, 800));
    for (let id of secuenciaJuego) {
        iluminarBoton(id);
        await new Promise(r => setTimeout(r, configTiempos[nivelVelocidad]));
    }
    puedeJugar = true;
    document.getElementById('mensaje-turno').innerText = "¡Tu turno!";
    document.getElementById('mensaje-turno').className = "h3 fw-bold text-success";
}

function iluminarBoton(id) {
    const btn = document.getElementById("btn-color-" + id);
    if (btn) {
        btn.style.opacity = "1";
        btn.style.transform = "scale(1.1)";
        sonarNota(infoColores[id].nota);
        setTimeout(() => {
            btn.style.opacity = "0.6";
            btn.style.transform = "scale(1)";
        }, 400);
    }
}

function sonarNota(freq) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function manejarEntradaUsuario(id) {
    if (!puedeJugar) return;
    iluminarBoton(id);
    secuenciaUsuario.push(id);
    const index = secuenciaUsuario.length - 1;

    if (secuenciaUsuario[index] !== secuenciaJuego[index]) {
        puedeJugar = false;
        puntosTotales = Math.max(0, puntosTotales - 100);
        actualizarUI();
        document.getElementById('mensaje-turno').innerText = "¡Error!";
        document.getElementById('mensaje-turno').className = "h3 fw-bold text-danger";
        setTimeout(verificarFinDeRonda, 1200);
        return;
    }

    if (secuenciaUsuario.length === secuenciaJuego.length) {
        puedeJugar = false;
        puntosTotales += 200;
        actualizarUI();
        document.getElementById('mensaje-turno').innerText = "¡Bien!";
        document.getElementById('mensaje-turno').className = "h3 fw-bold text-primary";
        setTimeout(verificarFinDeRonda, 800);
    }
}

function verificarFinDeRonda() {
    if (rondaActual < 5) {
        rondaActual++;
        actualizarUI();
        prepararSecuencia();
    } else {
        finalizarJuegoGlobal();
    }
}

// ==========================================
// FUNCIONES DE AUTOPERCEPCIÓN (PROMs) Y GUARDADO
// ==========================================
function finalizarJuegoGlobal() {
    const modalProm = new bootstrap.Modal(document.getElementById('modalAutopercepcion'));
    modalProm.show();
}

function seleccionarAnimo(valor, btnElement) {
    animoSeleccionado = valor;
    document.querySelectorAll('.carita-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    comprobarFormularioProm();
}

function seleccionarDificultad(valor, btnElement) {
    dificultadSeleccionada = valor;
    document.querySelectorAll('.btn-prom-dif').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    comprobarFormularioProm();
}

function comprobarFormularioProm() {
    if (dificultadSeleccionada !== null && animoSeleccionado !== null) {
        document.getElementById('btn-continuar-prom').disabled = false;
    }
}

function enviarAutopercepcion() {
    // 1. Ocultamos el modal de las caritas
    const modalPromEl = document.getElementById('modalAutopercepcion');
    const modalPromInstance = bootstrap.Modal.getInstance(modalPromEl);
    modalPromInstance.hide();

    // 2. Calculamos la medalla y mostramos el resumen final
    const modalResultados = new bootstrap.Modal(document.getElementById('modalFinJuego'));
    document.getElementById('puntos-finales').innerText = puntosTotales;

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

    // 3. Empaquetamos los datos y los guardamos en SamiraDTx silenciosamente
    const datosGuardar = {
        juego: "Música y Colores", // Nombre Oficial para las estadísticas
        nivel: nivelUsuario,
        puntos: puntosTotales,
        tiempo: 0, // En este juego no medimos tiempo de reacción
        completado: true,
        dificultad_percibida: dificultadSeleccionada,
        estado_animo: animoSeleccionado
    };

    fetch('/api/guardar-progreso/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify(datosGuardar)
    }).then(response => {
        if (response.ok) {
            console.log("¡Partida de Música y Colores guardada en BD con éxito!");
        } else {
            console.error("Hubo un error guardando los datos.");
        }
    });
}

// Botón del altavoz de las instrucciones
document.getElementById('btn-leer-instrucciones').onclick = function () {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    window.speechSynthesis.cancel();
    const texto = document.getElementById('texto-instrucciones').innerText;
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    window.speechSynthesis.speak(utterance);
};