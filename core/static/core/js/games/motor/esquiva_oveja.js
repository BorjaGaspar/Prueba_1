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

// ===============================
// IMÁGENES DEL JUEGO
// ===============================

const backgroundImage = new Image();
backgroundImage.src = "/static/core/images/esquiva_oveja/fondo.png";

const sheepImage = new Image();
sheepImage.src = "/static/core/images/esquiva_oveja/oveja.png";

const haloSheepImage = new Image();
haloSheepImage.src = "/static/core/images/esquiva_oveja/halo_oveja.png";

const instructionImages = [
  loadImage("/static/core/images/esquiva_oveja/instrucciones_1.png"),
  loadImage("/static/core/images/esquiva_oveja/instrucciones_2.png"),
  loadImage("/static/core/images/esquiva_oveja/instrucciones_3.png")
];

const obstacleImageSources = [
  "/static/core/images/esquiva_oveja/arbol_1.png",
  "/static/core/images/esquiva_oveja/arbol_2.png",
  "/static/core/images/esquiva_oveja/flor_1.png",
  "/static/core/images/esquiva_oveja/flor_2.png"
];

const obstacleImages = obstacleImageSources.map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

let backgroundLoaded = false;
let sheepLoaded = false;
let haloSheepLoaded = false;

backgroundImage.onload = () => {
  backgroundLoaded = true;
};

sheepImage.onload = () => {
  sheepLoaded = true;
};

haloSheepImage.onload = () => {
  haloSheepLoaded = true;
};

// ===============================
// MEDIAPIPE LANDMARKS
// ===============================

// MediaPipe Pose:
// 16 = muñeca derecha
const LEFT_WRIST_ID = 15;
const RIGHT_WRIST_ID = 16;

// ===============================
// CONFIGURACIÓN POR NIVEL
// ===============================

// Nivel motor del paciente (1-5), inyectado por la plantilla Django.
// Escala tamaño de obstáculos, cantidad y duración de ronda.
const NIVEL_USUARIO = (typeof NIVEL_DEL_SISTEMA !== "undefined") ? Number(NIVEL_DEL_SISTEMA) : 1;
const CSRF_TOKEN = (typeof TOKEN_DJANGO !== "undefined") ? TOKEN_DJANGO : "";

let nivelTamano = NIVEL_USUARIO;
let nivelNumObstaculos = NIVEL_USUARIO;
let nivelTiempo = NIVEL_USUARIO;

// Establece el límite positivo/negativo para el random del tamaño.
// Escala final = 1 + random(-configTamano[nivel], +configTamano[nivel])
// Se usa clamp para evitar tamaños negativos o exageradamente pequeños.
const configTamano = {
  1: 1.25,
  2: 1.5,
  3: 2.0,
  4: 2.50,
  5: 3.0
};

// Número de obstáculos por ronda.
const configNumObstaculos = {
  1: 4,
  2: 5,
  3: 6,
  4: 8,
  5: 12
};

// Duración de cada ronda en milisegundos.
const configTiempo = {
  1: 60000,
  2: 66000,
  3: 70000,
  4: 72000,
  5: 78000
};

function getLevelConfig(config, level, fallback) {
  const normalizedLevel = Number(level);

  if (Object.prototype.hasOwnProperty.call(config, normalizedLevel)) {
    return config[normalizedLevel];
  }

  return fallback;
}

const TOTAL_RONDAS = 3;
const INITIAL_COUNTDOWN_SECONDS = 3;
const REST_COUNTDOWN_SECONDS = 10;

const sizeRandomLimit = getLevelConfig(configTamano, nivelTamano, 1.25);
const obstaclesPerRound = getLevelConfig(configNumObstaculos, nivelNumObstaculos, 4);
const roundTimeMs = getLevelConfig(configTiempo, nivelTiempo, 60000);

const PUNTUACION_MAXIMA = 1000;
const totalObstaclesInGame = obstaclesPerRound * TOTAL_RONDAS;
const pointsPerObstacle = PUNTUACION_MAXIMA / totalObstaclesInGame;

console.log("Nivel tamaño:", nivelTamano, "Variación tamaño:", sizeRandomLimit);
console.log("Nivel obstáculos:", nivelNumObstaculos, "Obstáculos por ronda:", obstaclesPerRound);
console.log("Nivel tiempo:", nivelTiempo, "Duración ronda ms:", roundTimeMs);
console.log("Puntos por obstáculo:", pointsPerObstacle);

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
let gamePhase = "idle";

let gameStartTime = 0;
let roundStartTime = 0;
let lastFrameTime = 0;

let overlayTitle = "";
let overlaySubtitle = "";

let currentStatusMessage = "";

let obstacles = [];
let obstaclesAvoided = 0;
let obstaclesHit = 0;

let sheep = {
  x: 0,
  y: 0,
  width: 110,
  height: 90,
  targetY: 0
};

// ===============================
// FILTRO PROMEDIADOR DE MUÑECA
// ===============================

const WRIST_FILTER_WINDOW_SIZE = 12;
let wristFilterBuffer = [];

// ===============================
// CALIBRACIÓN INICIAL DE MUÑECA
// ===============================

let calibrationWristSamples = [];
let calibratedWristX = null;
let calibratedWristY = null;
let sheepInitialY = null;

const SHEEP_VERTICAL_GAIN = 1.15;


// ===============================
// PAUSA MALA DETECCION 
// ===============================

const WRIST_MISSING_WARNING_DELAY_MS = 10000;

let latestWristCanvasX = null;
let latestWristCanvasY = null;

let wristDetectionWarningActive = false;
let roundPausedForWristWarning = false;
let roundPauseStartTime = 0;
let totalRoundPausedMs = 0;

// ===============================
// ESTADO MEDIAPIPE
// ===============================

let poseLandmarker = null;
let drawingUtils = null;
let webcamRunning = false;
let lastVideoTime = -1;
let latestPoseLandmarks = null;

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
      "loadedmetadata",
      async () => {
        await video.play();

        webcamRunning = true;

        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        // Ocultar botón de cámara
        startButton.style.display = "none";

        // Ocultar texto: "Pulsa el botón..."
        const cameraHelpText = document.getElementById("cameraHelpText");
        if (cameraHelpText) {
          cameraHelpText.style.display = "none";
        }

        // Mantener y agrandar texto: "Toca la burbuja con la mano."
        const gameInstructionText = document.getElementById("gameInstructionText");
        if (gameInstructionText) {
          gameInstructionText.style.display = "block";
          gameInstructionText.style.fontSize = "1.8rem";
          gameInstructionText.style.fontWeight = "700";
          gameInstructionText.style.marginTop = "1rem";
        }

        initializeSheep();
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
  if (!webcamRunning) {
    requestAnimationFrame(predictWebcam);
    return;
  }

  const now = performance.now();
  const deltaMs = Math.max(0, now - lastFrameTime);
  lastFrameTime = now;

  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gamePhase !== "playing") {
      drawOverlayMessage(overlayTitle, overlaySubtitle);
      requestAnimationFrame(predictWebcam);
      return;
    }

    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;

      const results = poseLandmarker.detectForVideo(video, now);

      if (results.landmarks && results.landmarks.length > 0) {
        latestPoseLandmarks = results.landmarks[0];
        updateSheepFromWrist(latestPoseLandmarks, now);
      } else {
        latestPoseLandmarks = null;
        latestWristCanvasX = null;
        latestWristCanvasY = null;

        handleWristDetectionState(now, false);

        setStatus("No se detecta la muñeca. Colócate frente a la cámara.");
      }
    }

    if (gameRunning && roundRunning) {
      updateGameTime(now);

      if (!roundPausedForWristWarning) {
        updateObstacles(now, deltaMs);
      }
    }

    drawGameScene(now);
    updateHUD();

  } catch (error) {
    console.error("Error dentro de predictWebcam:", error);
  }

  requestAnimationFrame(predictWebcam);
}

function updateHUD() {
  const score = document.getElementById("score");
  const displayRonda = document.getElementById("display-ronda");

  if (score) {
    score.innerText = Math.round(puntosTotales);
  }

  if (displayRonda) {
    displayRonda.innerText = rondaActual;
  }
}

// ===============================
// FUNCIONES DEL JUEGO
// ===============================

function iniciarTuJuego() {
  puntosTotales = 0;
  rondaActual = 1;

  obstacles = [];
  obstaclesAvoided = 0;
  obstaclesHit = 0;

  latestPoseLandmarks = null;
  latestWristCanvasY = null;

  gameRunning = true;
  roundRunning = false;
  gamePhase = "initial_countdown";

  gameStartTime = performance.now();
  lastFrameTime = gameStartTime;

  // Wearable BLE: empezar a grabar pulso al arrancar la partida real.
  if (window.Wearable && Wearable.isConnected()) Wearable.startRecording();

  initializeSheep();
  resetWristFilter();
  actualizarUI();

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
    score.innerText = Math.round(puntosTotales);
  }

  if (timer && !roundRunning) {
    timer.innerText = formatTimeMinutesSeconds(roundTimeMs);
  }
}

function resetWristCalibration() {
  calibrationWristSamples = [];
  calibratedWristX = null;
  calibratedWristY = null;
}

function collectWristCalibrationSample() {
  if (!poseLandmarker || video.readyState < 2) return;

  const now = performance.now();

  try {
    const results = poseLandmarker.detectForVideo(video, now);

    if (!results.landmarks || results.landmarks.length === 0) return;

    const landmarks = results.landmarks[0];
    const wristPoint = getAverageReliableWristPoint(landmarks);

    if (!wristPoint) return;

    calibrationWristSamples.push(wristPoint);

  } catch (error) {
    console.warn("No se pudo capturar muestra de calibración:", error);
  }
}

function computeWristCalibration() {
  if (calibrationWristSamples.length === 0) {
    calibratedWristX = canvas.width * 0.5;
    calibratedWristY = canvas.height * 0.5;
    return;
  }

  const sum = calibrationWristSamples.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    },
    { x: 0, y: 0 }
  );

  calibratedWristX = sum.x / calibrationWristSamples.length;
  calibratedWristY = sum.y / calibrationWristSamples.length;
}

function applyInitialSheepPositionFromCalibration() {

  sheepInitialY = canvas.height * 0.80;

  sheep.y = sheepInitialY;
  sheep.targetY = sheepInitialY;
}

async function startInitialCountdown() {
  gamePhase = "initial_countdown";

  resetWristCalibration();

  for (let count = INITIAL_COUNTDOWN_SECONDS; count >= 1; count--) {
    overlayTitle = `El juego empieza en ${count}`;
    overlaySubtitle = "Apoya ambas muñecas en la mesa. \n Durante el juego, sube las manos para levantar la oveja y esquivar los obstáculos.";
    statusText.textContent = "";

    const samplesPerSecond = 10;
    const sampleIntervalMs = 1000 / samplesPerSecond;

    for (let i = 0; i < samplesPerSecond; i++) {
      collectWristCalibrationSample();
      await waitMilliseconds(sampleIntervalMs);
    }
  }

  computeWristCalibration();
  applyInitialSheepPositionFromCalibration();

  startRound();
}

function startRound() {
  if (!gameRunning) return;

  gamePhase = "playing";
  roundRunning = true;

  roundStartTime = performance.now();
  lastFrameTime = roundStartTime;

  totalRoundPausedMs = 0;
  roundPausedForWristWarning = false;
  wristDetectionWarningActive = false;
  roundPauseStartTime = 0;

  resetWristFilter();

  if (calibratedWristY !== null) {
    applyInitialSheepPositionFromCalibration();
  } else {
    initializeSheep();
  }

  generateRoundObstacles();

  setStatus(`Sube las manos para levantar la oveja y esquivar obstáculos.`);
  actualizarUI();
}

function verificarFinDeRonda() {
  roundRunning = false;

  if (rondaActual < TOTAL_RONDAS) {
    startRestCountdown();
  } else {
    finalizarJuegoGlobal();
  }
}

async function startRestCountdown() {
  gamePhase = "rest";

  resetWristCalibration();

  for (let count = REST_COUNTDOWN_SECONDS; count >= 1; count--) {
    overlayTitle = "Descansa";
    overlaySubtitle = `Apoya ambas muñecas en la mesa.\n\nLa siguiente ronda empieza en ${count}.`;
    statusText.textContent = "";

    const samplesPerSecond = 10;
    const sampleIntervalMs = 1000 / samplesPerSecond;

    for (let i = 0; i < samplesPerSecond; i++) {
      collectWristCalibrationSample();
      await waitMilliseconds(sampleIntervalMs);
    }
  }

  rondaActual++;
  actualizarUI();

  computeWristCalibration();
  applyInitialSheepPositionFromCalibration();

  startRound();
}

function finalizarJuegoGlobal() {
  gamePhase = "finished";
  gameRunning = false;
  roundRunning = false;

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
// CONTROL DE OVEJA CON MUÑECA
// ===============================

function initializeSheep() {
  // Antes era aproximadamente canvas.height * 0.14.
  // Ahora la oveja es el doble.
  const baseSize = Math.max(160, canvas.height * 0.25);

  sheep.width = baseSize * 1.15;
  sheep.height = baseSize;

  // Más a la derecha.
  // Antes: canvas.width * 0.08
  sheep.x = canvas.width * 0.15;

  // Más arriba.
  // Antes: canvas.height * 0.72
  sheep.y = canvas.height * 0.45;

  sheep.targetY = sheep.y;
}

function updateSheepFromWrist(landmarks, now = performance.now()) {
  const wristPoint = getAverageReliableWristPoint(landmarks);

  if (!wristPoint) {
    latestWristCanvasX = null;
    latestWristCanvasY = null;

    handleWristDetectionState(now, false);

    setStatus("No se detectan bien las manos. Mantén ambas muñecas dentro de cámara.");
    return;
  }

  const smoothedY = getSmoothedWristY(wristPoint.y);

  latestWristCanvasX = wristPoint.x;
  latestWristCanvasY = smoothedY;

  handleWristDetectionState(now, true);

  const minY = canvas.height * 0.08;
  const maxY = canvas.height - sheep.height - canvas.height * 0.08;

  /*
    calibratedWristY = posición neutra de muñecas.
    sheepInitialY = posición fija inicial de la oveja.
  */
  const referenceWristY = calibratedWristY ?? canvas.height * 0.5;
  const referenceSheepY = sheepInitialY ?? canvas.height * 0.45;

  /*
    En canvas:
    - Y menor = más arriba.
    - Si la muñeca sube, smoothedY baja.
    - upwardMovement será positivo.
    - Si la muñeca baja por debajo de la calibración, upwardMovement se queda en 0.
  */
  const upwardMovement = Math.max(0, referenceWristY - smoothedY);

  sheep.targetY = clamp(
    referenceSheepY - upwardMovement * SHEEP_VERTICAL_GAIN,
    minY,
    maxY
  );

  const smoothing = 0.35;
  sheep.y += (sheep.targetY - sheep.y) * smoothing;
}

function isReliableLandmark(landmark) {
  if (!landmark) return false;

  const visibility = landmark.visibility ?? 1;
  const presence = landmark.presence ?? 1;

  const insideImage =
    landmark.x >= 0 &&
    landmark.x <= 1 &&
    landmark.y >= 0 &&
    landmark.y <= 1;

  return visibility > 0.35 && presence > 0.35 && insideImage;
}

function getSmoothedWristY(rawWristY) {
  wristFilterBuffer.push(rawWristY);

  if (wristFilterBuffer.length > WRIST_FILTER_WINDOW_SIZE) {
    wristFilterBuffer.shift();
  }

  const sum = wristFilterBuffer.reduce((acc, value) => acc + value, 0);

  return sum / wristFilterBuffer.length;
}

function resetWristFilter() {
  wristFilterBuffer = [];
}

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

function getAverageReliableWristPoint(landmarks) {
  if (!landmarks) return null;

  const leftWrist = landmarks[LEFT_WRIST_ID];
  const rightWrist = landmarks[RIGHT_WRIST_ID];

  if (!isReliableLandmark(leftWrist) || !isReliableLandmark(rightWrist)) {
    return null;
  }

  return {
    x: ((leftWrist.x + rightWrist.x) / 2) * canvas.width,
    y: ((leftWrist.y + rightWrist.y) / 2) * canvas.height
  };
}

function drawImagePreserveAspectRatio(image, boxX, boxY, boxW, boxH) {
  if (
    !image ||
    !image.complete ||
    image.naturalWidth <= 0 ||
    image.naturalHeight <= 0
  ) {
    return;
  }

  const scale = Math.min(
    boxW / image.naturalWidth,
    boxH / image.naturalHeight
  );

  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;

  const drawX = boxX + (boxW - drawW) / 2;
  const drawY = boxY + (boxH - drawH) / 2;

  ctx.drawImage(image, drawX, drawY, drawW, drawH);
}


// ===============================
// OBSTÁCULOS
// ===============================

function generateRoundObstacles() {
  obstacles = [];

  const unitTimeMs = roundTimeMs / (obstaclesPerRound + 1);

  /*
    Sin buffer inicial:
    El primer obstáculo puede aparecer desde el inicio de la ronda.
  */
  const firstObstacleDelayMs = 0;

  const travelDistance = canvas.width + canvas.width * 0.28;
  const obstacleSpeedPxPerMs = travelDistance / unitTimeMs;

  /*
    Tiempo que necesita un obstáculo para recorrer toda la pantalla.
    Esto garantiza que el último obstáculo tenga tiempo suficiente para salir,
    cruzar el canvas y llegar hasta la zona de la oveja antes de terminar la ronda.
  */
  const obstacleTravelTimeMs = travelDistance / obstacleSpeedPxPerMs;

  /*
    Último momento posible para generar un obstáculo.
    No es un buffer artificial: es el tiempo mínimo necesario para que el obstáculo
    pueda recorrer la pantalla antes de que acabe la ronda.
  */
  const latestAllowedSpawnOffsetMs = Math.max(
    0,
    roundTimeMs - obstacleTravelTimeMs
  );

  /*
    Ventana real disponible para distribuir todos los obstáculos.
    Empieza en 0 y termina en latestAllowedSpawnOffsetMs.
  */
  const availableSpawnWindowMs = latestAllowedSpawnOffsetMs;

  const obstacleBaseHeight = canvas.height * 0.16;

  /*
    Los obstáculos quedan alineados con el margen inferior de la oveja.
  */
  const sheepBottomY = sheep.y + sheep.height;

  const tempObstacles = [];

  for (let i = 0; i < obstaclesPerRound; i++) {
    const imageIndex = Math.floor(Math.random() * obstacleImages.length);
    const image = obstacleImages[imageIndex];

    /*
      Escala solo hacia arriba:
      Nivel 1: 1.0x a 1.25x
      Nivel 5: 1.0x a 3.0x
    */
    const scale = randomBetween(1, sizeRandomLimit);

    /*
      Respetar proporción original de la imagen.
      Usamos la altura como referencia y calculamos el ancho con aspect ratio.
    */
    const aspectRatio =
      image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
        ? image.naturalWidth / image.naturalHeight
        : 1;

    const height = obstacleBaseHeight * scale;
    const width = height * aspectRatio;

    /*
      Alineado al margen inferior de la oveja:
      obstacle.y + obstacle.height = sheep.y + sheep.height
    */
    const y = clamp(
      sheepBottomY - height,
      canvas.height * 0.08,
      canvas.height - height - canvas.height * 0.08
    );

    tempObstacles.push({
      image,

      // Sale desde la derecha.
      x: canvas.width + width,

      y,
      width,
      height,

      speedPxPerMs: obstacleSpeedPxPerMs,

      spawnAt: 0,
      active: false,
      avoided: false,
      hit: false,
      hasScored: false
    });
  }

  /*
    Separación mínima:
    Para que no se encimen visualmente, el siguiente obstáculo debe aparecer
    cuando el anterior haya avanzado al menos su propio ancho.
  */
  const separationFactor = sizeRandomLimit;

  const minGapTimes = tempObstacles.map((obstacle) => {
    return (obstacle.width / obstacle.speedPxPerMs) * separationFactor;
  });

  const minRequiredWindowMs = minGapTimes.reduce((sum, gap) => {
    return sum + gap;
  }, 0);

  /*
    Si la separación mínima no cabe dentro de la ventana disponible,
    comprimimos la separación. Esto no alarga la ronda.
  */
  let compressionFactor = 1;

  if (minRequiredWindowMs > availableSpawnWindowMs && minRequiredWindowMs > 0) {
    compressionFactor = availableSpawnWindowMs / minRequiredWindowMs;
  }

  const compressedGapTimes = minGapTimes.map((gap) => {
    return gap * compressionFactor;
  });

  const compressedRequiredWindowMs = compressedGapTimes.reduce((sum, gap) => {
    return sum + gap;
  }, 0);

  /*
    Todo el tiempo sobrante se reparte como variación entre obstáculos.
    El primero no recibe extra para salir inmediatamente.
  */
  const totalExtraTime = Math.max(
    0,
    availableSpawnWindowMs - compressedRequiredWindowMs
  );

  const randomExtras = [];

  for (let i = 0; i < obstaclesPerRound; i++) {
    if (i === 0) {
      randomExtras.push(0);
    } else {
      randomExtras.push(Math.random());
    }
  }

  const randomExtrasSum = randomExtras.reduce((sum, value) => {
    return sum + value;
  }, 0) || 1;

  let currentSpawnOffsetMs = firstObstacleDelayMs;

  for (let i = 0; i < tempObstacles.length; i++) {
    /*
      Primer obstáculo:
      sale al inicio.

      Obstáculos posteriores:
      reciben parte del tiempo extra distribuido a lo largo de la ronda.
    */
    const extraTime =
      i === 0
        ? 0
        : (randomExtras[i] / randomExtrasSum) * totalExtraTime;

    currentSpawnOffsetMs += extraTime;

    tempObstacles[i].spawnAt = roundStartTime + Math.min(
      currentSpawnOffsetMs,
      latestAllowedSpawnOffsetMs
    );

    currentSpawnOffsetMs += compressedGapTimes[i];
  }

  obstacles = tempObstacles;

  console.log("Tiempo unitario ms:", unitTimeMs);
  console.log("Delay primer obstáculo ms:", firstObstacleDelayMs);
  console.log("Tiempo viaje obstáculo ms:", obstacleTravelTimeMs);
  console.log("Último spawn permitido ms:", latestAllowedSpawnOffsetMs);
  console.log("Ventana disponible ms:", availableSpawnWindowMs);
  console.log("Tiempo mínimo requerido sin encimar ms:", minRequiredWindowMs);
  console.log("Factor de compresión:", compressionFactor);
  console.log("Tiempo extra distribuido ms:", totalExtraTime);
  console.log("Velocidad obstáculo px/ms:", obstacleSpeedPxPerMs);
}

function updateObstacles(now, deltaMs) {
  for (const obstacle of obstacles) {
    if (now < obstacle.spawnAt) continue;

    /*
      Primera activación:
      colocamos el obstáculo según el tiempo real transcurrido desde su spawn.
      Esto evita pequeños retrasos si el frame llega tarde.
    */
    if (!obstacle.active) {
      obstacle.active = true;

      const elapsedSinceSpawnMs = now - obstacle.spawnAt;
      obstacle.x = canvas.width + obstacle.width - obstacle.speedPxPerMs * elapsedSinceSpawnMs;
    } else {
      // Movimiento de derecha a izquierda.
      obstacle.x -= obstacle.speedPxPerMs * deltaMs;
    }

    const sheepRect = getSheepCollisionRect();
    const obstacleRect = getObstacleCollisionRect(obstacle);

    if (!obstacle.hit && !obstacle.avoided && rectsIntersect(sheepRect, obstacleRect)) {
      obstacle.hit = true;
      obstaclesHit++;
      setStatus("Has tocado un obstáculo. Sigue intentando esquivar los siguientes.");
    }

    const hasPassedSheep =
      obstacle.x + obstacle.width < sheep.x &&
      !obstacle.hit &&
      !obstacle.avoided;

    if (hasPassedSheep) {
      obstacle.avoided = true;
      obstaclesAvoided++;

      puntosTotales = Math.min(
        PUNTUACION_MAXIMA,
        puntosTotales + pointsPerObstacle
      );

      actualizarUI();
      setStatus("¡Obstáculo esquivado!");
    }
  }
}

function getSheepCollisionRect() {
  return {
    x: sheep.x + sheep.width * 0.18,
    y: sheep.y + sheep.height * 0.15,
    width: sheep.width * 0.64,
    height: sheep.height * 0.70
  };
}

function getObstacleCollisionRect(obstacle) {
  return {
    x: obstacle.x + obstacle.width * 0.18,
    y: obstacle.y + obstacle.height * 0.14,
    width: obstacle.width * 0.64,
    height: obstacle.height * 0.72
  };
}

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// ===============================
// TIEMPO
// ===============================

function updateGameTime(now) {
  if (!roundRunning) return;

  const elapsedRoundMs = getActiveRoundElapsedMs(now);
  const remainingRoundMs = Math.max(0, roundTimeMs - elapsedRoundMs);

  const timer = document.getElementById("timer");

  if (timer) {
    timer.innerText = formatTimeMinutesSeconds(remainingRoundMs);
  }

  if (!roundPausedForWristWarning && elapsedRoundMs >= roundTimeMs) {
    verificarFinDeRonda();
  }
}

function getActiveRoundElapsedMs(now) {
  return Math.max(0, now - roundStartTime - totalRoundPausedMs);
}

function pauseRoundForWristWarning(now) {
  if (roundPausedForWristWarning) return;

  roundPausedForWristWarning = true;
  wristDetectionWarningActive = true;
  roundPauseStartTime = now;

  setStatus("No se detectan bien las manos. Ajusta tu posición para continuar.");
}

function resumeRoundAfterWristDetected(now) {
  if (!roundPausedForWristWarning) return;

  const pausedDurationMs = now - roundPauseStartTime;

  totalRoundPausedMs += pausedDurationMs;

  /*
    Los obstáculos que aún no han salido se desplazan hacia delante
    para que la pausa no altere su calendario.
  */
  for (const obstacle of obstacles) {
    if (!obstacle.active && !obstacle.avoided && !obstacle.hit) {
      obstacle.spawnAt += pausedDurationMs;
    }
  }

  roundPausedForWristWarning = false;
  wristDetectionWarningActive = false;
  roundPauseStartTime = 0;

  setStatus("Manos detectadas. Continúa esquivando obstáculos.");
}

function handleWristDetectionState(now, wristsDetected) {
  if (!roundRunning || gamePhase !== "playing") return;

  if (wristsDetected) {
    resumeRoundAfterWristDetected(now);
    return;
  }

  const elapsedRoundMs = getActiveRoundElapsedMs(now);

  if (elapsedRoundMs < WRIST_MISSING_WARNING_DELAY_MS) {
    return;
  }

  pauseRoundForWristWarning(now);
}

function formatTimeMinutesSeconds(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ===============================
// DIBUJO DEL JUEGO
// ===============================

function drawGameScene(now) {
  drawBackground();
  drawScorePanel();
  drawObstacles();
  drawSheep();
  neutrasPositionWarning();
  drawCanvasBorder();
}

function drawBackground() {
  if (backgroundLoaded) {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#cceeff");
  gradient.addColorStop(1, "#baffac");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSheep() {
  const handsDetected = latestWristCanvasY !== null;

  const imageToDraw =
    handsDetected && haloSheepLoaded
      ? haloSheepImage
      : sheepImage;

  const imageReady =
    handsDetected && haloSheepLoaded
      ? true
      : sheepLoaded;

  if (imageReady) {
    ctx.drawImage(
      imageToDraw,
      sheep.x,
      sheep.y,
      sheep.width,
      sheep.height
    );
    return;
  }

  ctx.save();

  ctx.fillStyle = handsDetected ? "#d1f7ff" : "#ffffff";
  roundedRect(sheep.x, sheep.y, sheep.width, sheep.height, 22);
  ctx.fill();

  ctx.strokeStyle = handsDetected ? "#20c997" : "#0d6efd";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
}

function drawObstacles() {
  for (const obstacle of obstacles) {
    if (!obstacle.active) continue;
    if (obstacle.x + obstacle.width < 0) continue;

    if (obstacle.image && obstacle.image.complete) {
      ctx.drawImage(
        obstacle.image,
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height
      );
    } else {
      ctx.save();

      ctx.fillStyle = obstacle.hit ? "#dc3545" : "#198754";
      roundedRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 18);
      ctx.fill();

      ctx.restore();
    }

    if (obstacle.hit) {
      ctx.save();

      ctx.strokeStyle = "rgba(220, 53, 69, 0.85)";
      ctx.lineWidth = 6;
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

      ctx.restore();
    }
  }
}

function drawScorePanel() {
  const panelX = canvas.width * 0.04;
  const panelY = canvas.height * 0.06;
  const panelW = canvas.width * 0.38;
  const panelH = 115;

  /*
    Progreso SOLO de la ronda actual.
    Cada ronda puede llegar al 100%.
  */
  const obstaclesAvoidedThisRound = obstacles.filter((obstacle) => obstacle.avoided).length;
  const obstaclesHitThisRound = obstacles.filter((obstacle) => obstacle.hit).length;

  const totalObstaclesCompletedThisRound =
    obstaclesAvoidedThisRound + obstaclesHitThisRound;

  const progress = clamp(
    totalObstaclesCompletedThisRound / obstaclesPerRound,
    0,
    1
  );

  ctx.save();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.strokeStyle = "rgba(13,110,253,0.4)";
  ctx.lineWidth = 3;

  roundedRect(panelX, panelY, panelW, panelH, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0d6efd";
  ctx.font = "bold 26px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Progreso de la ronda", panelX + 22, panelY + 34);

  const barX = panelX + 22;
  const barY = panelY + 52;
  const barW = panelW - 44;
  const barH = 18;

  ctx.fillStyle = "#e9ecef";
  roundedRect(barX, barY, barW, barH, 9);
  ctx.fill();

  ctx.fillStyle = "#198754";
  roundedRect(barX, barY, barW * progress, barH, 9);
  ctx.fill();

  ctx.fillStyle = "#6c757d";
  ctx.font = "22px Arial";
  ctx.fillText(
    `${obstaclesAvoidedThisRound} esquivados / ${obstaclesHitThisRound} golpes`,
    panelX + 22,
    panelY + 100
  );

  ctx.restore();
}

function neutrasPositionWarning() {
  if (!wristDetectionWarningActive) return;

  ctx.save();

  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const panelW = canvas.width * 0.62;
  const panelH = canvas.height * 0.28;
  const panelX = canvas.width * 0.5 - panelW * 0.5;
  const panelY = canvas.height * 0.5 - panelH * 0.5;

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.strokeStyle = "rgba(220,53,69,0.55)";
  ctx.lineWidth = 4;

  roundedRect(panelX, panelY, panelW, panelH, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#dc3545";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.max(24, canvas.height * 0.045)}px Arial`;

  ctx.fillText(
    "No se detectan bien las manos",
    canvas.width * 0.5,
    panelY + panelH * 0.36
  );

  ctx.fillStyle = "#343a40";
  ctx.font = `${Math.max(18, canvas.height * 0.032)}px Arial`;

  ctx.fillText(
    "Ajusta tu posición y coloca ambas muñecas dentro de cámara.",
    canvas.width * 0.5,
    panelY + panelH * 0.62
  );

  ctx.restore();
}

function drawCanvasBorder() {
  ctx.save();

  ctx.strokeStyle = "rgba(13, 110, 253, 0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

  ctx.restore();
}



// ===============================
// OVERLAY / MENSAJES
// ===============================

function drawOverlayMessage(title, subtitle) {
  ctx.save();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0d6efd";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  /*
    En la cuenta inicial dejamos el texto arriba,
    porque debajo van las imágenes de instrucciones.
  */
  if (gamePhase === "initial_countdown") {
    const titleY = canvas.height * 0.13;
    const subtitleY = canvas.height * 0.23;

    ctx.font = `bold ${Math.max(34, canvas.height * 0.065)}px Arial`;
    ctx.fillText(title || "", canvas.width / 2, titleY);

    if (subtitle) {
      ctx.fillStyle = "#0d6efd";
      ctx.font = `${Math.max(22, canvas.height * 0.038)}px Arial`;

      drawWrappedCenteredText(
        subtitle,
        canvas.width / 2,
        subtitleY,
        canvas.width * 0.70,
        canvas.height * 0.05
      );
    }

    drawInitialInstructionImages();
    ctx.restore();
    return;
  }

  /*
    En descanso sí centramos el texto,
    porque no hay imágenes debajo.
  */
  const titleY = canvas.height * 0.42;
  const subtitleY = canvas.height * 0.53;

  ctx.font = `bold ${Math.max(34, canvas.height * 0.07)}px Arial`;
  ctx.fillText(title || "", canvas.width / 2, titleY);

  if (subtitle) {
    ctx.fillStyle = "#0d6efd";
    ctx.font = `${Math.max(26, canvas.height * 0.045)}px Arial`;

    drawWrappedCenteredText(
      subtitle,
      canvas.width / 2,
      subtitleY,
      canvas.width * 0.78,
      canvas.height * 0.055
    );
  }

  ctx.restore();
}

function drawInitialInstructionImages() {
  const boxW = canvas.width * 0.24;
  const boxH = canvas.height * 0.34;
  const gap = canvas.width * 0.035;

  const totalW = boxW * 3 + gap * 2;
  const startX = canvas.width * 0.5 - totalW * 0.5;
  const boxY = canvas.height * 0.48;

  ctx.save();

  for (let i = 0; i < instructionImages.length; i++) {
    const boxX = startX + i * (boxW + gap);

    ctx.fillStyle = "rgba(233,236,239,0.75)";
    roundedRect(boxX, boxY, boxW, boxH, 18);
    ctx.fill();

    drawImagePreserveAspectRatio(
      instructionImages[i],
      boxX,
      boxY,
      boxW,
      boxH
    );
  }

  ctx.restore();
}

function drawWrappedCenteredText(text, x, y, maxWidth, lineHeight) {
  const paragraphs = String(text).split("\n");
  let currentY = y;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
    let line = "";

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[i] + " ";
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }

    ctx.fillText(line.trim(), x, currentY);
    currentY += lineHeight;
  }
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

  const puntosFinalesRedondeados = Math.round(puntosTotales);
  const porcentajePuntuacion = puntosFinalesRedondeados / PUNTUACION_MAXIMA;

  if (puntosFinales) {
    puntosFinales.innerText = puntosFinalesRedondeados;
  }

  if (mensajeFinal) {
    mensajeFinal.innerText = "¡Buen trabajo!";
  }

  if (medallaIcon) {
    if (porcentajePuntuacion >= 0.8) {
      medallaIcon.innerText = "🏆";
    } else if (porcentajePuntuacion >= 0.5) {
      medallaIcon.innerText = "🥈";
    } else {
      medallaIcon.innerText = "🥉";
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
// El nombre "Esquiva la Oveja" debe coincidir EXACTAMENTE con:
//   - JUEGOS_MOTORES en views.py (DDA por nivel_motor)
//   - cargarAnalisis('Esquiva la Oveja') en analisis_paciente.html

function guardarSesion() {
  const fc = (window.Wearable && Wearable.isConnected())
    ? Wearable.stopRecording()
    : null;

  const datos = {
    juego: "Esquiva la Oveja",
    nivel: NIVEL_USUARIO,
    puntos: Math.round(puntosTotales),
    tiempo_jugado: 0,
    completado: true,
    dificultad_percibida: dificultadSeleccionada,
    estado_animo: animoSeleccionado,
    tiempo_reaccion_ms: null,
    errores_cometidos: obstaclesHit,
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
// UTILIDADES
// ===============================

function setStatus(message) {
  if (currentStatusMessage === message) return;

  currentStatusMessage = message;
  statusText.textContent = message;

  statusText.style.fontSize = "1.8rem";
  statusText.style.fontWeight = "700";
  statusText.style.textAlign = "center";

}

function waitOneSecond() {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });
}

function waitMilliseconds(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function roundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ===============================
// EXPONER FUNCIONES AL HTML
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