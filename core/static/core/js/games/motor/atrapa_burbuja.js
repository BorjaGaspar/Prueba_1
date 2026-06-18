import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const video = document.getElementById("webcam");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("startButton");
const statusText = document.getElementById("status");
const floatingBubble = document.getElementById("floatingBubble");

// ===============================
// BURBUJA (CSS, sin assets externos)
// ===============================
// La burbuja se dibuja con CSS (radial-gradient). El estado "tocada" se marca
// añadiendo la clase .bubble-green. No depende de ningún PNG.

let bubbleIsGreenClass = false;

// ===============================
// MEDIAPIPE LANDMARKS
// ===============================

// MediaPipe Pose:
// 15 = muñeca izquierda
// 16 = muñeca derecha
const WRIST_LANDMARK_IDS = [15, 16];

// Radio aproximado de la mano alrededor de la muñeca.
const HAND_HIT_RADIUS_PX = 1;

// Margen extra alrededor de la burbuja.
const BUBBLE_HIT_MARGIN_PX = 40;

// Mantiene la burbuja verde unos milisegundos aunque MediaPipe falle un frame.
const TOUCH_HOLD_MS = 180;

let lastTouchTime = 0;

// ===============================
// CONFIGURACIÓN POR NIVEL
// ===============================

// Nivel motor del paciente (1-5). Escala tamaño y velocidad de la burbuja.
const NIVEL_USUARIO = (typeof NIVEL_DEL_SISTEMA !== "undefined") ? NIVEL_DEL_SISTEMA : 1;
const CSRF_TOKEN = (typeof TOKEN_DJANGO !== "undefined") ? TOKEN_DJANGO : "";

let nivelTamano = NIVEL_USUARIO;     // 1 = burbuja grande/fácil … 5 = pequeña/difícil
let nivelVelocidad = NIVEL_USUARIO;  // 1 = lento … 5 = rápido
let nivelTiempo = 1;                  // duración de ronda fija

// Tamaño: nivel 1 = burbuja más grande, nivel 5 = burbuja más pequeña.
const configTamano = {
  1: 1.2,
  2: 1.05,
  3: 0.9,
  4: 0.75,
  5: 0.6
};

// Velocidad: milisegundos entre movimientos.
// Nivel 1 = más lento, nivel 5 = más rápido.
const configVelocidad = {
  1: 8000,
  2: 7000,
  3: 6000,
  4: 5000,
  5: 4000
};

// Duración de cada ronda en milisegundos.
const configTiempo = {
  1: 30000,
  2: 45000,
  3: 60000,
  4: 75000,
  5: 90000
};

const TOTAL_RONDAS = 3;
const INITIAL_COUNTDOWN_SECONDS = 3;
const REST_COUNTDOWN_SECONDS = 10;

let bubbleBaseScale = configTamano[nivelTamano] ?? 1;
let bubbleMoveIntervalMs = configVelocidad[nivelVelocidad] ?? 6000;
let roundTimeMs = configTiempo[nivelTiempo] ?? 60000;
let gameTotalTimeMs = roundTimeMs * TOTAL_RONDAS;

// Puntuación máxima total = 1000.
// Si el jugador mantiene la burbuja verde durante todo el tiempo útil de las 3 rondas,
// obtiene 1000 puntos.
let scoreFactorPerSecond = 1000 / (gameTotalTimeMs / 1000);

// ===============================
// ESTADO DEL JUEGO
// ===============================

let puntosTotales = 0;
let rondaActual = 1;

let animoSeleccionado = null;
let dificultadSeleccionada = null;
let audioCtx = null;

let gameRunning = false;
let roundRunning = false;

let gameStartTime = 0;
let roundStartTime = 0;
let lastFrameTimestamp = 0;

let bubbleIsGreen = false;
let greenTimeMs = 0;

let gamePhase = "idle";
// Posibles fases:
// idle
// initial_countdown
// playing
// rest
// finished

let overlayTitle = "";
let overlaySubtitle = "";

// ===============================
// ESTADO MEDIAPIPE
// ===============================

let poseLandmarker = null;
let drawingUtils = null;
let webcamRunning = false;
let lastVideoTime = -1;
let bubbleMovementInterval = null;

// ===============================
// CARGA DE MEDIAPIPE
// ===============================

async function createPoseLandmarker() {
  statusText.textContent = "Cargando MediaPipe...";

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  drawingUtils = new DrawingUtils(ctx);

  statusText.textContent = "MediaPipe cargado. Puedes activar la cámara.";
  startButton.disabled = false;
}

// ===============================
// CÁMARA
// ===============================

async function startWebcam() {
  if (!poseLandmarker) {
    statusText.textContent = "MediaPipe todavía no está listo.";
    return;
  }

  try {
    startButton.disabled = true;
    statusText.textContent = "Solicitando acceso a la cámara...";

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = stream;

    video.addEventListener(
      "loadeddata",
      () => {
        webcamRunning = true;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Ocultar botón de cámara
        startButton.style.display = "none";

        // Ocultar texto: "Pulsa el botón..."
        const cameraHelpText = document.getElementById("cameraHelpText");
        if (cameraHelpText) {
          cameraHelpText.style.display = "none";
        }

        predictWebcam();
        iniciarTuJuego();
      },
      { once: true }
    );

  } catch (error) {
    console.error(error);
    statusText.textContent = "No se pudo acceder a la cámara.";
    startButton.disabled = false;
  }
}

// ===============================
// LOOP PRINCIPAL
// ===============================

function predictWebcam() {
  if (!webcamRunning) return;

  const now = performance.now();

  if (gamePhase !== "playing") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawOverlayMessage(overlayTitle, overlaySubtitle);
    requestAnimationFrame(predictWebcam);
    return;
  }

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const results = poseLandmarker.detectForVideo(video, now);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameRunning && roundRunning) {
      updateGameTime(now);
    }

    let isTouching = false;

    if (results.landmarks && results.landmarks.length > 0) {
      const poseLandmarks = results.landmarks[0];
      isTouching = isAnyWristTouchingBubble(poseLandmarks);
    }

    updateBubbleTouchState(isTouching, now);
    updateScoreByFrame(now);
  }

  requestAnimationFrame(predictWebcam);
}

// ===============================
// FUNCIONES DEL JUEGO
// ===============================

function iniciarTuJuego() {
  puntosTotales = 0;
  rondaActual = 1;
  greenTimeMs = 0;

  bubbleIsGreen = false;
  lastTouchTime = 0;

  gameRunning = true;
  roundRunning = false;

  gameStartTime = performance.now();
  lastFrameTimestamp = gameStartTime;

  // Wearable BLE: empezar a grabar pulso al arrancar la partida real.
  if (window.Wearable && Wearable.isConnected()) Wearable.startRecording();

  actualizarUI();
  hideGameVisuals();

  startInitialCountdown();
}

function actualizarUI() {
  const displayRonda = document.getElementById("display-ronda");
  const score = document.getElementById("score");
  const timer = document.getElementById("timer");

  if (displayRonda) {
    displayRonda.innerText = rondaActual;
  }

  if (score) {
    score.innerText = formatScoreInStepsOfFive(puntosTotales);
  }

  if (timer && !roundRunning) {
    timer.innerText = formatTimeMinutesSeconds(roundTimeMs);
  }
}

async function startInitialCountdown() {
  gamePhase = "initial_countdown";
  hideGameVisuals();

  for (let count = INITIAL_COUNTDOWN_SECONDS; count >= 1; count--) {
    overlayTitle = `El juego empieza en ${count}`;
    overlaySubtitle = "Prepárate frente a la cámara.";
    statusText.textContent = "";

    await waitOneSecond();
  }

  startRound();
}

function startRound() {
  if (!gameRunning) return;

  gamePhase = "playing";
  roundRunning = true;

  roundStartTime = performance.now();
  lastFrameTimestamp = roundStartTime;

  showGameVisuals();
  generarTablero();

  statusText.textContent = `Toca la burbuja con la mano.`;
  statusText.style.fontSize = "1.8rem";
  statusText.style.fontWeight = "700";
  statusText.style.textAlign = "center";

  actualizarUI();
}

function generarTablero() {
  floatingBubble.style.display = "block";
  setBubbleGreen(false);

  applyBubbleSize();

  // Primera posición inmediata para que no tarde en aparecer.
  floatingBubble.style.transition = "none";
  moveBubbleRandomly();

  // Fuerza al navegador a aplicar la primera posición.
  floatingBubble.offsetHeight;

  // Después de la primera colocación, activamos transición.
  floatingBubble.style.transition = `
    left ${bubbleMoveIntervalMs}ms ease-in-out,
    top ${bubbleMoveIntervalMs}ms ease-in-out,
    transform ${bubbleMoveIntervalMs}ms ease-in-out
  `;

  if (bubbleMovementInterval) {
    clearInterval(bubbleMovementInterval);
  }

  bubbleMovementInterval = setInterval(() => {
    moveBubbleRandomly();
  }, bubbleMoveIntervalMs);
}

function verificarFinDeRonda() {
  roundRunning = false;
  updateBubbleTouchState(false, performance.now());
  stopBubbleMovement();
  hideGameVisuals();

  if (rondaActual < TOTAL_RONDAS) {
    startRestCountdown();
  } else {
    finalizarJuegoGlobal();
  }
}

async function startRestCountdown() {
  gamePhase = "rest";

  for (let count = REST_COUNTDOWN_SECONDS; count >= 1; count--) {
    overlayTitle = "Descansa";
    overlaySubtitle = `La siguiente ronda empieza en ${count}`;
    statusText.textContent = "";

    await waitOneSecond();
  }

  rondaActual++;
  actualizarUI();
  startRound();
}

function finalizarJuegoGlobal() {
  gamePhase = "finished";
  gameRunning = false;
  roundRunning = false;

  stopBubbleMovement();
  hideGameVisuals();

  overlayTitle = "Juego completado";
  overlaySubtitle = "Responde cómo te has sentido.";

  const puntosFinales = document.getElementById("puntos-finales");

  if (puntosFinales) {
    puntosFinales.innerText = Math.round(puntosTotales);
  }

  const modalProm = new bootstrap.Modal(
    document.getElementById("modalAutopercepcion")
  );

  modalProm.show();
}

// ===============================
// CONTROL VISUAL ENTRE FASES
// ===============================

function hideGameVisuals() {
  video.style.visibility = "hidden";
  floatingBubble.style.display = "none";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function showGameVisuals() {
  video.style.visibility = "visible";
  floatingBubble.style.display = "block";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawOverlayMessage(title, subtitle) {
  ctx.save();

  // Fondo blanco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /*
    Como el canvas completo está espejado por CSS con scaleX(-1),
    dibujamos el texto espejado internamente para que visualmente se vea normal.
  */
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  ctx.fillStyle = "#0d6efd";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "bold 56px Arial";
  ctx.fillText(title || "", canvas.width / 2, canvas.height / 2 - 35);

  if (subtitle) {
    ctx.font = "36px Arial";
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 35);
  }

  ctx.restore();
}

function waitOneSecond() {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });
}

// ===============================
// TIEMPO Y PUNTUACIÓN
// ===============================

function updateGameTime(now) {
  const elapsedRoundMs = now - roundStartTime;
  const remainingRoundMs = Math.max(0, roundTimeMs - elapsedRoundMs);

  const timer = document.getElementById("timer");

  if (timer) {
    timer.innerText = formatTimeMinutesSeconds(remainingRoundMs);
  }

  if (elapsedRoundMs >= roundTimeMs) {
    verificarFinDeRonda();
  }
}

function updateScoreByFrame(now) {
  if (!gameRunning || !roundRunning) {
    lastFrameTimestamp = now;
    return;
  }

  const deltaMs = Math.max(0, now - lastFrameTimestamp);
  lastFrameTimestamp = now;

  if (bubbleIsGreen) {
    greenTimeMs += deltaMs;

    const greenSeconds = greenTimeMs / 1000;

    puntosTotales = Math.min(
      1000,
      greenSeconds * scoreFactorPerSecond
    );

    actualizarUI();
  }
}

function formatScoreInStepsOfFive(scoreValue) {
  return Math.floor(scoreValue / 5) * 5;
}

function formatTimeMinutesSeconds(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}


// ===============================
// BURBUJA
// ===============================

function applyBubbleSize() {
  const baseSize = 220;
  const finalSize = baseSize * bubbleBaseScale;

  floatingBubble.style.width = `${finalSize}px`;
  floatingBubble.style.height = `${finalSize}px`;
}

function moveBubbleRandomly() {
  const container = canvas.parentElement;

  if (!container) return;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  if (!containerWidth || !containerHeight) return;

  const bubbleWidth = floatingBubble.offsetWidth;
  const bubbleHeight = floatingBubble.offsetHeight;

  if (!bubbleWidth || !bubbleHeight) return;

  const randomScale = 0.9 + Math.random() * 0.25;

  const visualBubbleWidth = bubbleWidth * randomScale;
  const visualBubbleHeight = bubbleHeight * randomScale;

  const radiusX = visualBubbleWidth / 2;
  const radiusY = visualBubbleHeight / 2;

  const minCenterX = radiusX;
  const maxCenterX = containerWidth - radiusX;

  const minCenterY = radiusY;
  const maxCenterY = containerHeight - radiusY;

  if (maxCenterX <= minCenterX || maxCenterY <= minCenterY) return;

  const randomCenterX = minCenterX + Math.random() * (maxCenterX - minCenterX);
  const randomCenterY = minCenterY + Math.random() * (maxCenterY - minCenterY);

  floatingBubble.style.left = `${randomCenterX}px`;
  floatingBubble.style.top = `${randomCenterY}px`;

  floatingBubble.style.transform = `
    translate(-50%, -50%)
    scale(${randomScale})
  `;
}

function stopBubbleMovement() {
  if (bubbleMovementInterval) {
    clearInterval(bubbleMovementInterval);
    bubbleMovementInterval = null;
  }

  setBubbleGreen(false);
  bubbleIsGreen = false;
}

function isAnyWristTouchingBubble(landmarks) {
  if (!landmarks || landmarks.length === 0) return false;

  const container = canvas.parentElement;
  const containerRect = container.getBoundingClientRect();
  const bubbleRect = floatingBubble.getBoundingClientRect();

  const expandedBubbleLeft = bubbleRect.left - BUBBLE_HIT_MARGIN_PX;
  const expandedBubbleTop = bubbleRect.top - BUBBLE_HIT_MARGIN_PX;
  const expandedBubbleRight = bubbleRect.right + BUBBLE_HIT_MARGIN_PX;
  const expandedBubbleBottom = bubbleRect.bottom + BUBBLE_HIT_MARGIN_PX;

  for (const wristId of WRIST_LANDMARK_IDS) {
    const wrist = landmarks[wristId];

    if (!wrist) continue;

    /*
      MediaPipe usa coordenadas normalizadas:
      x: 0 a 1
      y: 0 a 1

      Como el video y el canvas están espejados con scaleX(-1),
      usamos 1 - wrist.x para que la detección coincida con la imagen visible.
    */
    const wristScreenX = containerRect.left + (1 - wrist.x) * containerRect.width;
    const wristScreenY = containerRect.top + wrist.y * containerRect.height;

    const isTouching = circleIntersectsRect(
      wristScreenX,
      wristScreenY,
      HAND_HIT_RADIUS_PX,
      expandedBubbleLeft,
      expandedBubbleTop,
      expandedBubbleRight,
      expandedBubbleBottom
    );

    if (isTouching) {
      return true;
    }
  }

  return false;
}

function updateBubbleTouchState(isTouchingNow, now) {
  if (isTouchingNow) {
    lastTouchTime = now;
  }

  const shouldStayGreen =
    isTouchingNow || (now - lastTouchTime <= TOUCH_HOLD_MS);

  bubbleIsGreen = shouldStayGreen;
  setBubbleGreen(shouldStayGreen);
}

function setBubbleGreen(isGreen) {
  if (bubbleIsGreenClass === isGreen) return;

  bubbleIsGreenClass = isGreen;
  floatingBubble.classList.toggle("bubble-green", isGreen);
}

function circleIntersectsRect(
  circleX,
  circleY,
  radius,
  rectLeft,
  rectTop,
  rectRight,
  rectBottom
) {
  const closestX = Math.max(rectLeft, Math.min(circleX, rectRight));
  const closestY = Math.max(rectTop, Math.min(circleY, rectBottom));

  const dx = circleX - closestX;
  const dy = circleY - closestY;

  return (dx * dx + dy * dy) <= (radius * radius);
}

// ===============================
// PROM / MODALES
// ===============================

function seleccionarAnimo(valor, btnElement) {
  animoSeleccionado = valor;

  document.querySelectorAll(".carita-btn, .btn-prom-ani").forEach((btn) => {
    btn.classList.remove("active");
  });

  btnElement.classList.add("active");
  comprobarFormularioProm();
}

function seleccionarDificultad(valor, btnElement) {
  dificultadSeleccionada = valor;

  document.querySelectorAll(".btn-prom-dif").forEach((btn) => {
    btn.classList.remove("active");
  });

  btnElement.classList.add("active");
  comprobarFormularioProm();
}

function comprobarFormularioProm() {
  if (dificultadSeleccionada !== null && animoSeleccionado !== null) {
    document.getElementById("btn-continuar-prom").disabled = false;
  }
}

function enviarAutopercepcion() {
  const puntosFinales = document.getElementById("puntos-finales");
  const mensajeFinal = document.getElementById("mensaje-final");
  const medallaIcon = document.getElementById("medalla-icon");

  if (puntosFinales) {
    puntosFinales.innerText = Math.round(puntosTotales);
  }

  if (mensajeFinal) {
    mensajeFinal.innerText = "¡Buen trabajo!";
  }

  if (medallaIcon) {
    if (puntosTotales >= 800) {
      medallaIcon.innerText = "🏆";
    } else if (puntosTotales >= 500) {
      medallaIcon.innerText = "🥈";
    } else {
      medallaIcon.innerText = "🏅";
    }
  }

  const modalPromElement = document.getElementById("modalAutopercepcion");
  const modalFinElement = document.getElementById("modalFinJuego");

  const modalPromInstance = bootstrap.Modal.getInstance(modalPromElement);

  if (modalPromInstance) {
    modalPromInstance.hide();
  }

  setTimeout(() => {
    const modalFin = new bootstrap.Modal(modalFinElement);
    modalFin.show();
  }, 300);

  guardarSesion();
}

// ===============================
// GUARDADO DE PARTIDA (VTR)
// ===============================
// Envía la partida al backend igual que el resto de juegos.
// El nombre "Atrapa la Burbuja" debe coincidir EXACTAMENTE con:
//   - JUEGOS_MOTORES en views.py (DDA por nivel_motor)
//   - cargarAnalisis('Atrapa la Burbuja') en analisis_paciente.html

function guardarSesion() {
  const fc = (window.Wearable && Wearable.isConnected())
    ? Wearable.stopRecording()
    : null;

  const datos = {
    juego: "Atrapa la Burbuja",
    nivel: NIVEL_USUARIO,
    puntos: Math.round(puntosTotales),
    tiempo_jugado: 0,
    completado: true,
    dificultad_percibida: dificultadSeleccionada,
    estado_animo: animoSeleccionado,
    tiempo_reaccion_ms: null,
    errores_cometidos: 0,
    fc_min: fc ? fc.fc_min : null,
    fc_max: fc ? fc.fc_max : null,
    fc_avg: fc ? fc.fc_avg : null,
    fc_serie: fc ? fc.fc_serie : null
  };

  fetch("/api/vtr/guardar-partida/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": CSRF_TOKEN
    },
    body: JSON.stringify(datos)
  }).then(() => {}).catch(() => {});
}

// ===============================
// AUDIO DE INSTRUCCIONES
// ===============================

const btnLeerInstrucciones = document.getElementById("btn-leer-instrucciones");

if (btnLeerInstrucciones) {
  btnLeerInstrucciones.onclick = function () {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    window.speechSynthesis.cancel();

    const texto = document.getElementById("texto-instrucciones").innerText;
    const utterance = new SpeechSynthesisUtterance(texto);

    utterance.lang = "es-ES";

    window.speechSynthesis.speak(utterance);
  };
}

// ===============================
// EXPONER FUNCIONES AL HTML
// Necesario porque este archivo usa type="module"
// ===============================

window.iniciarTuJuego = iniciarTuJuego;
window.actualizarUI = actualizarUI;
window.verificarFinDeRonda = verificarFinDeRonda;
window.finalizarJuegoGlobal = finalizarJuegoGlobal;
window.seleccionarAnimo = seleccionarAnimo;
window.seleccionarDificultad = seleccionarDificultad;
window.comprobarFormularioProm = comprobarFormularioProm;
window.enviarAutopercepcion = enviarAutopercepcion;

// ===============================
// INICIALIZACIÓN
// ===============================

startButton.disabled = true;
startButton.addEventListener("click", startWebcam);

createPoseLandmarker();
