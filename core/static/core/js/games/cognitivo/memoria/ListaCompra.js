// ==========================================
// LÓGICA DEL SISTEMA BASE (NO TOCAR)
// ==========================================
let dificultadSeleccionada = null;
let animoSeleccionado = null;

// Leemos las variables puente que nos dejó el HTML
let nivelUsuario = typeof NIVEL_DEL_SISTEMA !== 'undefined' ? NIVEL_DEL_SISTEMA : 1;
let csrfToken = typeof TOKEN_DJANGO !== 'undefined' ? TOKEN_DJANGO : '';

// TÚ DEBES ACTUALIZAR ESTAS VARIABLES EN TU LÓGICA MIENTRAS EL PACIENTE JUEGA
let puntosTotales = 0;
let tiempoTotalAcumulado = 0; // No se usa cronómetro, se deja en 0

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

function seleccionarDificultad(valor, btnElement) {
    dificultadSeleccionada = valor;
    document.querySelectorAll('.btn-prom-dif').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    comprobarFormularioProm();
}

function seleccionarAnimo(valor, btnElement) {
    animoSeleccionado = valor;
    document.querySelectorAll('.btn-prom-ani').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    comprobarFormularioProm();
}

function comprobarFormularioProm() {
    if (dificultadSeleccionada !== null && animoSeleccionado !== null) {
        document.getElementById('btn-continuar-prom').disabled = false;
    }
}

function finalizarJuegoGlobal() {
    const modalProm = new bootstrap.Modal(document.getElementById('modalAutopercepcion'));
    modalProm.show();
}

function enviarAutopercepcion() {
    const modalPromEl = document.getElementById('modalAutopercepcion');
    const modalPromInstance = bootstrap.Modal.getInstance(modalPromEl);
    modalPromInstance.hide();

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
    guardarSesion(puntosTotales, dificultadSeleccionada, animoSeleccionado);
}

function guardarSesion(puntos, dificultad, animo) {
    const trPromedio = vtrTiemposRonda.length > 0
        ? Math.round(vtrTiemposRonda.reduce((a, b) => a + b, 0) / vtrTiemposRonda.length)
        : null;

    const datos = {
        juego: "Lista de la Compra",
        nivel: nivelUsuario,
        puntos: puntos,
        tiempo_jugado: Math.round(tiempoTotalAcumulado),
        completado: true,
        dificultad_percibida: dificultad,
        estado_animo: animo,
        tiempo_reaccion_ms: trPromedio,
        errores_cometidos: vtrErrores
    };

    fetch('/api/vtr/guardar-partida/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify(datos)
    }).then(() => {});
}

// ==========================================
// JAVASCRIPT DEL JUEGO: LA LISTA DE LA COMPRA
// ==========================================

const nivelesDefinicion = {
    1: { elementos: 2, tiempo: 8000, complejidad: 0 },
    2: { elementos: 3, tiempo: 9000, complejidad: 0 },
    3: { elementos: 4, tiempo: 12000, complejidad: 1 },
    4: { elementos: 5, tiempo: 14000, complejidad: 1 },
    5: { elementos: 6, tiempo: 16000, complejidad: 2 }
};

const bancoPalabras = [
    ["Pan", "Leche", "Agua", "Huevos", "Sal", "Arroz", "Pasta", "Vino"],
    ["Manzanas", "Plátanos", "Cebollas", "Patatas", "Aceite", "Yogur", "Pollo"],
    ["Alcachofas", "Boniato", "Berenjena", "Aguacate", "Champiñones", "Espárragos"]
];

let rondaActual = 1;
let secuenciaJuego = [];
let secuenciaUsuario = [];

// --- VTR Data Logger ---
let vtrErrores = 0;
let vtrTiemposRonda = [];
let vtrInicioRecuerdo = null;

function iniciarTuJuego() {
    rondaActual = 1;
    puntosTotales = 0;
    actualizarUI();
    iniciarRonda();
}

function iniciarRonda() {
    secuenciaUsuario = [];
    secuenciaJuego = [];
    actualizarUI();

    // Usamos nivelUsuario (variable puente del sistema) en lugar de una variable local
    const config = nivelesDefinicion[nivelUsuario] || nivelesDefinicion[1];
    let pool = [];
    for (let i = 0; i <= config.complejidad; i++) pool = pool.concat(bancoPalabras[i]);

    secuenciaJuego = [...pool].sort(() => 0.5 - Math.random()).slice(0, config.elementos);
    mostrarLista(config.tiempo);
}

function mostrarLista(tiempo) {
    const contenedorLista = document.getElementById('lista-objetos');
    const contenedorMemorizar = document.getElementById('contenedor-memorizar');
    const contenedorJuego = document.getElementById('contenedor-juego');
    const timerBar = document.getElementById('timer-visual');
    const msg = document.getElementById('mensaje-turno');

    contenedorLista.innerHTML = '';
    contenedorMemorizar.classList.remove('d-none');
    contenedorJuego.classList.add('d-none');
    msg.innerText = "Atención...";
    msg.className = "h3 fw-bold text-secondary";

    secuenciaJuego.forEach(p => {
        const li = document.createElement('li');
        li.className = 'item-lista';
        li.innerText = `- ${p}`;
        contenedorLista.appendChild(li);
    });

    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    setTimeout(() => {
        timerBar.style.transition = `width ${tiempo}ms linear`;
        timerBar.style.width = '0%';
    }, 100);

    setTimeout(() => {
        contenedorMemorizar.classList.add('d-none');
        contenedorJuego.classList.remove('d-none');
        msg.innerText = "¡Tu turno!";
        msg.className = "h3 fw-bold text-success";
        vtrInicioRecuerdo = performance.now();
        generarBotones();
    }, tiempo);
}

function generarBotones() {
    const contenedor = document.getElementById('botones-opciones');
    contenedor.innerHTML = '';
    let botonesAzar = [...secuenciaJuego].sort(() => 0.5 - Math.random());

    botonesAzar.forEach(palabra => {
        const btn = document.createElement('div');
        btn.className = 'anotacion';
        btn.innerText = palabra;
        btn.onclick = () => manejarClick(palabra, btn);
        contenedor.appendChild(btn);
    });
}

function manejarClick(palabra, elemento) {
    if (elemento.style.opacity === "0.3") return;
    const palabraCorrecta = secuenciaJuego[secuenciaUsuario.length];

    if (secuenciaUsuario.length === 0 && vtrInicioRecuerdo !== null) {
        vtrTiemposRonda.push(Math.round(performance.now() - vtrInicioRecuerdo));
    }

    if (palabra === palabraCorrecta) {
        secuenciaUsuario.push(palabra);
        elemento.style.opacity = "0.3";
        elemento.style.backgroundColor = "#d4edda";
        if (secuenciaUsuario.length === secuenciaJuego.length) {
            puntosTotales += 200;
            finalizarRonda(true);
        }
    } else {
        puntosTotales -= 200;
        vtrErrores++;
        elemento.style.backgroundColor = "#f8d7da";
        finalizarRonda(false);
    }
    actualizarUI();
}

function finalizarRonda(exito) {
    const msg = document.getElementById('mensaje-turno');
    msg.innerText = exito ? "¡Bien!" : "¡Error!";
    msg.className = exito ? "h3 fw-bold text-primary" : "h3 fw-bold text-danger";

    document.querySelectorAll('.anotacion').forEach(b => b.onclick = null);

    setTimeout(() => {
        if (rondaActual < 5) {
            rondaActual++;
            iniciarRonda();
        } else {
            finalizarJuegoGlobal();
        }
    }, 1500);
}

function actualizarUI() {
    document.getElementById('display-nivel').innerText = nivelUsuario;
    document.getElementById('display-ronda').innerText = rondaActual;
    document.getElementById('score').innerText = puntosTotales;
}
