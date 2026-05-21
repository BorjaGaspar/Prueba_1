# 🫀 Plan de Implementación — Wearables (Frecuencia Cardíaca + Bluetooth)

**Fecha:** 20 de Mayo de 2026
**Estado:** Plan aprobado, pendiente de implementación
**Objetivo:** Integrar relojes inteligentes (Garmin, pulseras BLE genéricas) en la web para que el médico pueda cruzar la frecuencia cardíaca del paciente con el sistema VTR ya existente.
**Filosofía:** Aditivo. Cero ruptura del VTR, DDA, MoCA ni de ningún flujo actual.

---

## 📋 Índice

0. [Decisiones de diseño tomadas](#0-decisiones-de-diseño-tomadas)
1. [Visión general de la funcionalidad](#1-visión-general-de-la-funcionalidad)
2. [Arquitectura técnica resumida](#2-arquitectura-técnica-resumida)
3. [Fases de implementación (7 fases)](#3-fases-de-implementación)
4. [Checklist para futuros juegos](#4-checklist-para-futuros-juegos)
5. [Riesgos técnicos y mitigaciones](#5-riesgos-técnicos-y-mitigaciones)
6. [Qué NO se debe tocar (anti-deriva)](#6-qué-no-se-debe-tocar-anti-deriva)

---

## 0. Decisiones de diseño tomadas

| Decisión | Elegida | Motivo |
|---|---|---|
| **Soporte de navegadores** | Solo Chrome / Edge (Desktop + Android). Sin iOS. | Web Bluetooth API es estándar W3C en Chromium. No requiere app nativa. iOS Safari no lo soporta y construir una app intermediaria multiplicaría el esfuerzo. |
| **Scope inicial** | Los 4 minijuegos VTR existentes: **Encuentra la Letra, Encuentra la Bolita, Lista de la Compra, Música y Colores** (Secuencia Musical). | Mismo perímetro que el VTR. Ya tienen cronómetro de TR y endpoint `vtr_guardar_partida`. El cruce TR ↔ HR es donde está el valor clínico real. |
| **Almacenamiento** | `JSONField` en `SesionDeJuego` (4 campos nuevos). Sin tabla nueva. | Una partida = una fila. Cero JOINs. Serie segundo-a-segundo cabe holgadamente en JSON (≈90 enteros por partida). |
| **Protocolo BLE** | `Heart Rate Service` estándar (UUID `0x180D`) + característica `Heart Rate Measurement` (`0x2A37`). | Estándar Bluetooth GATT. Soportado por Garmin, Polar, bandas de pecho, Wahoo, Coospo, etc. Plug-and-play. |
| **UX paciente** | Icono de corazón en esquina (animado si conectado, gris si no). NUNCA número de bpm visible al paciente. | El documento original lo exige: evitar ansiedad por ver pulsaciones altas. |
| **UX médico** | Línea roja añadida a la gráfica VTR existente + fila clicable en tabla → modal con detalle. | Aditivo sobre la gráfica `detalle_sesion_terapia.html` ya existente. Sin pantalla nueva. |

---

## 1. Visión general de la funcionalidad

### 1.1. Lo que verá el paciente

1. En `juegos.html` (menú de minijuegos): un **botón discreto "Vincular Reloj"** fijo en la parte superior. Solo aparece si el navegador soporta Web Bluetooth.
2. Al pulsar el botón → diálogo nativo del navegador para elegir el dispositivo BLE → emparejamiento en <2 segundos.
3. Una vez vinculado, el botón muestra **"Reloj conectado ❤️"** y aparece en cada minijuego un **icono pequeño de corazón** en una esquina:
   - **Latiendo en color** → conectado y recibiendo datos.
   - **Gris e inmóvil** → desconectado o no vinculado.
4. **Nunca** verá un número de pulsaciones.

### 1.2. Lo que pasa en la sombra (cada partida)

- Mientras juega, el navegador acumula 1 muestra de bpm por segundo (el reloj las emite así de forma nativa).
- Al terminar la partida, calcula min / max / media y envía la serie completa junto con los demás datos VTR al backend.
- Si el reloj se desconecta a mitad: se guarda lo que se haya capturado. Los campos quedan parciales pero válidos.
- Si el paciente nunca vinculó reloj: los campos de FC viajan vacíos (`null`). Todo lo demás funciona exactamente igual que ahora.

### 1.3. Lo que verá el médico

1. **Gráfica VTR enriquecida** en `detalle_sesion_terapia.html`:
   - Línea azul existente: **% degradación TR** (eje Y izquierdo).
   - **NUEVA línea roja: FC media por partida** (eje Y derecho, bpm).
   - Permite leer cruces clínicos: *"la FC se disparó en la partida 4 y justo en la 5 cayó el TR"*.
2. **Tabla drill-down clicable**:
   - Cada fila se vuelve clicable (cursor pointer + hover).
   - Click → abre **modal flotante** con:
     - Tarjetas: FC Máx · FC Mín · FC Media de esa partida.
     - **Mini-gráfica segundo a segundo** (eje X = segundos de la partida, eje Y = bpm).
     - Botón cerrar.

---

## 2. Arquitectura técnica resumida

```
PACIENTE (Chrome/Edge)
   │
   ▼
[Botón Vincular Reloj] ──► navigator.bluetooth.requestDevice()
                                  │
                                  ▼
                          Reloj BLE (Heart Rate Service)
                                  │
                                  ▼ notifications (1 Hz)
                          wearable_service.js
                                  │
                                  ├── almacena samples[] en memoria
                                  ├── anima icono de corazón
                                  │
                                  ▼ (al terminar partida)
       POST /api/vtr/guardar-partida/
       payload extendido con: fc_min, fc_max, fc_avg, fc_serie
                                  │
                                  ▼
BACKEND (Django)
   vtr_guardar_partida
   ├── lógica VTR existente (intacta)
   ├── lógica DDA existente (intacta)
   └── guarda 4 campos nuevos en SesionDeJuego  ← AÑADIDO
                                  │
                                  ▼
MÉDICO
   detalle_sesion_terapia.html
   ├── gráfica Chart.js (añade dataset línea roja)
   └── tabla clicable → modal con Chart.js mini-gráfica
```

**Ficheros nuevos:**
- `core/static/core/js/wearable_service.js` — Cliente Web Bluetooth + buffer de samples + UI corazón.

**Ficheros modificados (mínimo):**
- `core/models.py` — 4 campos en `SesionDeJuego`.
- `core/views.py` — `vtr_guardar_partida` acepta y guarda los 4 nuevos campos.
- `core/templates/core/juegos.html` — botón "Vincular Reloj".
- Los 4 templates de juego VTR — icono corazón + integración del servicio.
- `core/templates/core/patients/detalle_sesion_terapia.html` — línea roja + modal.

---

## 3. Fases de implementación

> **Regla de oro:** terminar y **validar** una fase antes de empezar la siguiente. Cada fase tiene checklist y criterio de validación explícito.

### 🟦 Fase 1 — Base de Datos (Modelo `SesionDeJuego`)

**Objetivo:** Añadir 4 columnas para almacenar los datos de frecuencia cardíaca por partida.

**Ficheros:**
- `core/models.py`

**Campos a añadir a `SesionDeJuego`** (todos nullable, retrocompatibles):

| Campo | Tipo | Significado |
|---|---|---|
| `fc_min` | `IntegerField(null=True, blank=True)` | Pulsación mínima registrada en la partida (bpm) |
| `fc_max` | `IntegerField(null=True, blank=True)` | Pulsación máxima registrada en la partida (bpm) |
| `fc_avg` | `IntegerField(null=True, blank=True)` | Pulsación media de la partida (bpm) |
| `fc_serie` | `JSONField(null=True, blank=True)` | Lista de muestras: `[75, 76, 78, ...]` (una por segundo) |

**Pasos:**
1. Editar `core/models.py`, añadir los 4 campos al final de la clase `SesionDeJuego` (junto a los campos VTR ya existentes).
2. Documentar en comentario corto: `# --- CAMPOS FC (Wearable) ---`
3. `python manage.py makemigrations` → debe generar `0018_<algo>.py` (la última fue 0017).
4. `python manage.py migrate`.
5. (Opcional) registrar los nuevos campos en `core/admin.py` si se quiere ver desde admin.

**✅ Validación:**
- [ ] La migración corre limpia, sin warnings.
- [ ] Verificar en `python manage.py dbshell` que la tabla `core_sesiondejuego` tiene las 4 columnas nuevas.
- [ ] Crear manualmente una `SesionDeJuego` desde el shell sin pasar los nuevos campos → no falla (son nullable).
- [ ] Tests existentes (si los hay) siguen pasando.

**⚠️ Riesgo:** ninguno relevante. La migración es puramente aditiva.

---

### 🟦 Fase 2 — Backend (endpoint `vtr_guardar_partida`)

**Objetivo:** Que el endpoint VTR existente acepte opcionalmente los 4 nuevos campos y los persista sin romper el flujo actual.

**Ficheros:**
- `core/views.py` (función `vtr_guardar_partida`)

**Cambios:**
1. Leer del payload JSON (todos opcionales, con `.get(..., None)`):
   - `fc_min`, `fc_max`, `fc_avg` → enteros o `None`.
   - `fc_serie` → lista de enteros o `None`.
2. **Validación defensiva (importante):**
   - Si la serie viene, debe ser una lista de enteros entre 30 y 220 bpm. Filtrar cualquier valor fuera de rango (descartarlo silenciosamente, no fallar).
   - Si la serie viene vacía o tiene menos de 3 muestras → guardar `null` en los 4 campos (no representativo).
3. **Backend recalcula min/max/avg** desde la serie como verificación (no confiar ciegamente en el frontend):
   - `fc_min = min(serie)`, `fc_max = max(serie)`, `fc_avg = round(mean(serie))`.
   - Si los valores del frontend difieren significativamente, prevalece el cálculo del backend.
4. Al crear la `SesionDeJuego`, añadir los 4 campos al `objects.create(...)`.
5. **NO tocar nada más:** ni el cálculo de `MarcaPersonalTR`, ni el de degradación, ni la llamada a `evaluar_ajuste_dinamico`, ni el `registrar_actividad`. Solo añadir.
6. La respuesta sigue siendo `{"estado": "ok"}` 200 silencioso (filosofía VTR).

**✅ Validación:**
- [ ] POST con Postman al endpoint **sin** campos FC → funciona exactamente como antes, `SesionDeJuego` se crea con `fc_*=null`.
- [ ] POST con `fc_serie: [70, 72, 74, ...]` → se guardan correctamente y el backend recalcula min/max/avg coherentes.
- [ ] POST con `fc_serie: [70, 500, 72]` → se descarta el 500, se guarda `[70, 72]` o `null` si quedan <3 muestras.
- [ ] El DDA sigue disparándose normal (revisar logs).
- [ ] El VTR sigue calculando degradación normal.

**⚠️ Riesgo:** olvidar `try/except` envolviendo la lectura de los nuevos campos. Si el payload viene mal formado, el endpoint debe seguir respondiendo 200 (no romper el juego).

---

### 🟦 Fase 3 — Servicio JavaScript de Bluetooth (`wearable_service.js`)

**Objetivo:** Crear el módulo central que gestiona la conexión BLE, el buffer de muestras y la API que consumirán los juegos. Es la pieza más compleja de todo el plan.

**Ficheros nuevos:**
- `core/static/core/js/wearable_service.js`

**API pública del módulo** (objeto global `window.Wearable`):

| Método / propiedad | Qué hace |
|---|---|
| `Wearable.isSupported()` | `true` si `navigator.bluetooth` existe. Para feature-detection del botón. |
| `Wearable.connect()` | Lanza el diálogo nativo de selección de dispositivo. Devuelve `Promise<boolean>`. Persiste handle del device y escribe `localStorage.wearable_permitido = 'true'`. |
| `Wearable.autoReconnect()` | **SIN diálogo.** Si hay flag en `localStorage`, llama a `navigator.bluetooth.getDevices()` y reconecta al primer dispositivo previamente autorizado. Devuelve `Promise<boolean>`. Si falla, limpia el flag. Invocar en cada carga de página. |
| `Wearable.disconnect()` | Cierra GATT y limpia estado. NO borra el flag de `localStorage` (el permiso del navegador sigue activo). |
| `Wearable.forget()` | Limpia el flag de `localStorage` y desconecta. Equivale a "olvidar el reloj". |
| `Wearable.isConnected()` | Booleano. |
| `Wearable.startRecording()` | Vacía el buffer y empieza a acumular muestras. Llamar al inicio de cada partida. |
| `Wearable.stopRecording()` | Devuelve `{fc_min, fc_max, fc_avg, fc_serie}` con los datos acumulados o `null` si no había conexión. |
| `Wearable.onStatusChange(callback)` | Pub/sub para que el icono de corazón sepa cuándo cambia el estado (conectado/desconectado). |

**Implementación clave (pseudocódigo):**

```
// CONEXIÓN
async function connect():
    device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service']  // opcional
    })
    device.addEventListener('gattserverdisconnected', onDisconnect)
    server = await device.gatt.connect()
    service = await server.getPrimaryService('heart_rate')
    characteristic = await service.getCharacteristic('heart_rate_measurement')
    await characteristic.startNotifications()
    characteristic.addEventListener('characteristicvaluechanged', onSample)
    state = 'connected'
    notifyListeners()

// RECEPCIÓN DE MUESTRAS
function onSample(event):
    bpm = parseHeartRate(event.target.value)   // ver nota abajo
    lastSampleBpm = bpm
    if recording:
        buffer.push(bpm)

// PARSEO DEL CARACTERÍSTICO 0x2A37 (formato GATT estándar)
function parseHeartRate(dataView):
    flags = dataView.getUint8(0)
    is16bit = flags & 0x01
    if is16bit:
        return dataView.getUint16(1, /*littleEndian=*/true)
    else:
        return dataView.getUint8(1)

// GRABACIÓN POR PARTIDA
function startRecording():
    buffer = []
    recording = true
    startTime = performance.now()

function stopRecording():
    recording = false
    if buffer.length < 3:
        return null
    return {
        fc_min: Math.min(...buffer),
        fc_max: Math.max(...buffer),
        fc_avg: Math.round(buffer.reduce((a,b) => a+b, 0) / buffer.length),
        fc_serie: buffer.slice()
    }

// DESCONEXIÓN INESPERADA
function onDisconnect():
    state = 'disconnected'
    notifyListeners()
    // (Opcional, fase futura) intento de reconexión automática
```

**Notas de implementación:**
- El sample rate de los relojes BLE estándar suele ser de ~1 Hz. No filtrar nada en frontend, llega ya espaciado.
- **Reconexión silenciosa entre páginas (RESUELTO — ver Fase 4):** la conexión GATT se rompe al cambiar de página, pero Chrome 85+ persiste el **permiso** del dispositivo por origen. Usar `navigator.bluetooth.getDevices()` para recuperar el handle sin pop-up y reconectar en segundo plano. Patrón:
  1. Tras un `connect()` exitoso, escribir `localStorage.setItem('wearable_permitido', 'true')` + guardar el `device.id` o `device.name` (opcional, para multi-dispositivo).
  2. En cada nueva página (al cargar `wearable_service.js`), si el flag existe → llamar `navigator.bluetooth.getDevices()` → si devuelve algún dispositivo previamente autorizado → ejecutar `device.gatt.connect()` automáticamente sin diálogo.
  3. Si `getDevices()` devuelve vacío (usuario revocó permiso) → limpiar el flag y volver al estado "no vinculado".
- API que añadir al servicio: `Wearable.autoReconnect()` — invocada al cargar el script. Devuelve `Promise<boolean>`. No lanza diálogo nunca.

**✅ Validación:**
- [ ] Cargar el script en una página de test. Llamar `Wearable.connect()` desde consola. Aparece diálogo del navegador.
- [ ] Tras vincular, `Wearable.isConnected()` → `true`.
- [ ] Tras `startRecording()` y esperar 10 segundos, `stopRecording()` devuelve un objeto con serie de ~10 valores plausibles (60-110 bpm en reposo).
- [ ] Apagar el reloj físicamente → el evento `gattserverdisconnected` se dispara → `Wearable.isConnected()` → `false`.

**⚠️ Riesgo alto:** esta es la fase donde más cosas pueden fallar (permisos, parseo de bytes, eventos asíncronos). Probar con AL MENOS un dispositivo real antes de seguir.

---

### 🟦 Fase 4 — UI de conexión (botón + icono de corazón)

**Objetivo:** Integrar visualmente el sistema en el menú de juegos y dentro de los juegos.

**Ficheros:**
- `core/templates/core/juegos.html` — botón "Vincular Reloj".
- Layout o componente reutilizable para el icono de corazón (decidir en esta fase si se mete en `base_private.html` o se duplica en cada juego).

**Decisiones tomadas:**

1. **Navegación entre vincular y jugar — RESUELTO con auto-reconexión silenciosa.**

   Se mantiene la navegación normal entre páginas (sin SPA, sin iframe, sin refactor del flujo actual). El frontend NO se toca arquitectónicamente. La continuidad de la conexión BLE se resuelve aprovechando que Chrome 85+ **persiste el permiso del dispositivo por origen**.

   **Flujo definitivo:**
   1. **Vinculación inicial (en `juegos.html`):** el paciente pulsa "Vincular Reloj" una sola vez. Aparece el pop-up nativo de Chrome, elige el reloj, se conecta. En ese momento `wearable_service.js` escribe `localStorage.setItem('wearable_permitido', 'true')`.
   2. **Navegación a un juego** (p.ej. `/juego/moca/` o `jugar_encuentra_letra.html`): se hace recarga completa de página normal. La conexión GATT se corta temporalmente — esto es inevitable.
   3. **Auto-reconexión en segundo plano:** al cargar `wearable_service.js` en la nueva página, ejecuta:
      - Si `localStorage.getItem('wearable_permitido') === 'true'` → llama a `navigator.bluetooth.getDevices()`.
      - Chrome devuelve el array de dispositivos previamente autorizados para este origen (sin diálogo, sin clic).
      - Toma el primero (o el guardado por `device.id`) y ejecuta `device.gatt.connect()`.
      - Reanuda las notificaciones del Heart Rate Service. El icono pasa de gris a rojo latiendo en milisegundos.
   4. **Si `getDevices()` devuelve vacío** (el usuario revocó el permiso desde el icono del candado): se limpia `localStorage` y el botón "Vincular Reloj" vuelve a aparecer como al principio.

   **Por qué funciona:** `navigator.bluetooth.getDevices()` es estable desde Chrome 85 (agosto 2020) y NO requiere user gesture porque solo lee permisos ya concedidos previamente. La llamada a `gatt.connect()` tampoco lo requiere si el permiso persiste.

   **Resultado:** UX casi nativa. El paciente vincula una sola vez en la primera sesión del navegador y a partir de ahí el reloj se reconecta solo en cada página. Cero pop-ups recurrentes, cero cambios en la arquitectura de navegación, cero SPA.

2. **Icono de corazón:** se mete solo dentro de los 4 juegos VTR (y futuros juegos que opten a Wearable). Fuera de ellos no aporta nada y puede confundir.

**Pasos:**
1. **Botón "Vincular Reloj"** en `juegos.html`:
   - Si `!Wearable.isSupported()` → ocultar el botón por completo.
   - Al cargar la página → `Wearable.autoReconnect()` intenta reconexión silenciosa via `getDevices()`. Si tiene éxito, el botón ya aparece como `"❤️ Reloj conectado"` desde el inicio.
   - Estado inicial sin permiso previo: `"🔘 Vincular Reloj"`.
   - Al click → `Wearable.connect()`. Si éxito: persiste flag en `localStorage` + estado `"❤️ Reloj conectado"` (verde). Si error o cancela: mantiene estado anterior.
2. **Icono de corazón** (componente):
   - Pequeño, esquina superior derecha del área de juego.
   - Dos estados visuales:
     - Conectado → corazón rojo animado (CSS keyframes simple, beat ~60/min).
     - Desconectado → corazón gris quieto.
   - Suscripción a `Wearable.onStatusChange(...)` para cambiar de estado en tiempo real.
3. **Reconexión silenciosa en cada juego:** al cargar `wearable_service.js` en cualquier template de juego, debe ejecutar `Wearable.autoReconnect()` automáticamente (sin botón, sin clic). Si tiene éxito → corazón rojo latiendo desde el primer segundo. Si falla → corazón gris (el paciente puede ignorarlo).

**✅ Validación:**
- [ ] Abrir `juegos.html` en Chrome → aparece el botón.
- [ ] Abrir la misma página en Firefox → el botón NO aparece (feature-detection).
- [ ] Pulsar botón → vincular reloj → estado cambia a "Reloj conectado" + flag en localStorage.
- [ ] Entrar a un juego VTR (navegación normal, recarga completa) → tras ~1s, icono corazón cambia de gris a rojo latiendo solo, sin pop-up, sin clic.
- [ ] Volver a `juegos.html` → el botón aparece directamente en estado conectado, sin re-vincular.
- [ ] Apagar reloj → icono pasa a gris en <2 segundos.
- [ ] Revocar permiso desde el icono del candado de Chrome → recargar → botón vuelve al estado inicial "Vincular Reloj".

**⚠️ Riesgo medio:** la auto-reconexión depende de que el navegador tenga el reloj en rango BLE. Si el reloj está apagado o lejos, `gatt.connect()` fallará silenciosamente; el icono se quedará gris y el paciente puede volver a pulsar "Vincular Reloj" manualmente desde `juegos.html`. Documentar este comportamiento esperado.

---

### 🟦 Fase 5 — Integración en los 4 juegos VTR

**Objetivo:** Que cada uno de los 4 minijuegos VTR llame al servicio Wearable al empezar y al terminar la partida, y meta los datos FC en el POST a `/api/vtr/guardar-partida/`.

**Ficheros:**
- `core/templates/core/games/cognitivo/atencion/jugar_encuentra_letra.html`
- `core/templates/core/games/cognitivo/atencion/jugar_encuentra_bolita.html`
- `core/templates/core/games/cognitivo/memoria/jugar_lista_compra.html`
- `core/templates/core/games/cognitivo/memoria/jugar_secuencia_musical.html` (Música y Colores)

**Cambios por juego** (idénticos en los 4):

1. Incluir `<script src="{% static 'core/js/wearable_service.js' %}"></script>` en el `<head>`.
2. Justo antes del `<script>` principal del juego, integrar:

```javascript
// Al inicio de cada partida (donde ya se reinicia el cronómetro de TR)
if (window.Wearable && Wearable.isConnected()) {
    Wearable.startRecording();
}

// Al terminar la partida (donde ya se hace el POST a vtr/guardar-partida/)
const datosFC = (window.Wearable && Wearable.isConnected())
    ? Wearable.stopRecording()
    : null;

// Mezclar en el payload existente
const payload = {
    juego: ...,
    nivel: ...,
    puntos: ...,
    tiempo_jugado: ...,
    completado: ...,
    tiempo_reaccion_ms: ...,
    errores_cometidos: ...,
    dificultad_percibida: ...,
    estado_animo: ...,
    // --- NUEVO ---
    fc_min: datosFC?.fc_min ?? null,
    fc_max: datosFC?.fc_max ?? null,
    fc_avg: datosFC?.fc_avg ?? null,
    fc_serie: datosFC?.fc_serie ?? null
};

fetch('/api/vtr/guardar-partida/', { method: 'POST', body: JSON.stringify(payload), ... });
```

3. Añadir el `<div>` del icono de corazón en una esquina del HTML del juego.

**Importante:**
- **NO tocar** la lógica de TR (cronómetro `performance.now()`) — ya funciona.
- **NO tocar** el conteo de errores.
- **NO tocar** la lógica de `dificultad_percibida` / `estado_animo`.
- **NO tocar** el flujo de `vtr_iniciar_sesion`.
- Si el paciente no tiene reloj vinculado, los campos FC viajan `null` y todo sigue exactamente como antes.

**✅ Validación (por cada juego):**
- [ ] Jugar SIN reloj → `SesionDeJuego` se crea con campos FC en `null`. Resto idéntico al estado pre-Wearable.
- [ ] Jugar CON reloj → `SesionDeJuego` se crea con los 4 campos FC rellenos.
- [ ] El TR sigue siendo correcto.
- [ ] El DDA sigue disparándose.
- [ ] El icono de corazón se ve y se anima.

---

### 🟦 Fase 6 — Panel del médico: línea roja en la gráfica VTR

**Objetivo:** Añadir un segundo dataset (línea roja) a la gráfica existente de degradación, con la FC media de cada partida.

**Ficheros:**
- `core/views.py` (función `detalle_sesion_terapia`) — añadir `fc_avg_por_partida` al contexto JSON que se pasa al template.
- `core/templates/core/patients/detalle_sesion_terapia.html` — añadir el dataset al Chart.js.

**Cambios en `views.py`:**
- En la query de partidas, extraer también `fc_avg` por partida. Si es `null`, dejarlo como `null` en el array (Chart.js dejará hueco).
- Pasar al template un array `fc_avg: [null, 72, 75, 80, 95, ...]` paralelo al ya existente `degradacion`.

**Cambios en el template Chart.js:**

```javascript
data: {
    labels: [...],
    datasets: [
        {
            // EXISTENTE — línea azul
            label: 'Degradación TR (%)',
            data: degradacion,
            borderColor: '#3498db',
            yAxisID: 'yDegradacion',
            spanGaps: false
        },
        {
            // NUEVO — línea roja
            label: 'FC Media (bpm)',
            data: fc_avg,
            borderColor: '#e74c3c',
            yAxisID: 'yFC',
            spanGaps: false
        }
    ]
},
options: {
    scales: {
        yDegradacion: { type: 'linear', position: 'left', title: { text: '% Degradación' } },
        yFC: { type: 'linear', position: 'right', title: { text: 'FC (bpm)' }, min: 40, max: 200 }
    }
}
```

**Detalles:**
- Si **ninguna** partida de la sesión tiene FC (sesión sin reloj), no dibujar el dataset rojo (el eje Y derecho puede ocultarse o quedar vacío).
- Mantener la zona gris de calibración del VTR.
- Mantener el resto de la gráfica intacto.

**✅ Validación:**
- [ ] Sesión con reloj durante todas las partidas → se ven 2 líneas, una azul y una roja.
- [ ] Sesión sin reloj → se ve solo la línea azul (como antes).
- [ ] Sesión mixta (algunas partidas con reloj, otras no) → la línea roja tiene huecos donde no hay datos.
- [ ] El zoom y los tooltips funcionan.

---

### 🟦 Fase 7 — Modal de detalle de partida (clic en fila de tabla)

**Objetivo:** Cada fila de la tabla drill-down se vuelve clicable y abre un modal con FC máx/mín/media y una mini-gráfica segundo a segundo.

**Ficheros:**
- `core/views.py` — nuevo endpoint AJAX para devolver `fc_serie` de una partida concreta (opcionalmente, si se prefiere meter todo de golpe en el render inicial).
- `core/templates/core/patients/detalle_sesion_terapia.html` — modal HTML + JS.

**Decisión de diseño:**
- **(A) Embed all:** renderizar TODA la `fc_serie` de cada partida en un atributo `data-fc-serie` del `<tr>`. Click → leer el atributo → poblar el modal sin tocar el backend. Más simple, más datos en el HTML inicial.
- **(B) Lazy load:** crear endpoint `GET /api/partida/<int:pk>/fc/` que devuelve la serie. Click → fetch → poblar el modal. Más limpio si las series son largas.

  **Recomendado: (A).** Las series son cortas (~90 enteros) y no merece la pena el round-trip.

**Cambios en el template:**

1. Marcar las filas de la tabla con `data-fc-serie="{{ partida.fc_serie|json_script }}"` y `data-fc-min`, `data-fc-max`, `data-fc-avg`, `data-juego`, `data-nivel`.
2. CSS: `tr.partida-clicable { cursor: pointer; transition: background ... } tr.partida-clicable:hover { background: #f8f9fa }`.
3. Si la fila no tiene `fc_serie` (sin reloj) → no se marca como clicable. Mostrar un icono pequeño de "sin datos FC" en la última columna.
4. Modal HTML (Bootstrap modal o vanilla):
   - Header: nombre del juego + nivel.
   - 3 tarjetas: **FC Máxima** (rojo intenso), **FC Mínima** (azul), **FC Media** (gris).
   - Un `<canvas>` con Chart.js: eje X = segundos (1, 2, 3, ...), eje Y = bpm.
   - Botón cerrar.
5. JS: al hacer click en una fila, leer los `data-*`, poblar las tarjetas, instanciar Chart.js dentro del modal con esa serie, abrir.

**✅ Validación:**
- [ ] Click en fila con datos FC → modal se abre con valores correctos.
- [ ] Mini-gráfica se renderiza con la curva real de pulsaciones.
- [ ] Cerrar modal → vuelve a la vista normal.
- [ ] Click en fila SIN datos FC → no abre modal (o muestra mensaje "Sin datos de pulsaciones").
- [ ] Probar con sesión larga (10+ partidas) → la tabla no se rompe.

---

## 4. Checklist para futuros juegos

> **Cuando crees un nuevo juego que deba captar tiempo de reacción Y frecuencia cardíaca, copia este checklist y márcalo entero.**

Para que un juego nuevo entre completamente en el ecosistema **VTR + Wearable**, debe:

### Frontend (template del juego)
- [ ] Incluir `<script src="{% static 'core/js/wearable_service.js' %}"></script>` en el `<head>`.
- [ ] Añadir el `<div>` del icono de corazón en una esquina (clon del componente usado en los 4 juegos VTR).
- [ ] Al **inicio de cada partida** (donde se reinicia el cronómetro TR), llamar:
  ```
  if (window.Wearable && Wearable.isConnected()) Wearable.startRecording();
  ```
- [ ] Cronómetro de TR usando `performance.now()` que **mida solo el tiempo de procesamiento mental** (ignorar animaciones, transiciones, latencias del juego). En juegos de memoria, arrancar el reloj solo cuando el paciente tiene el control ("¡Tu turno!").
- [ ] Contar `errores_cometidos`.
- [ ] Al **terminar la partida**, recoger `Wearable.stopRecording()` (o `null` si no había reloj) y enviar al POST.
- [ ] Hacer POST a `/api/vtr/guardar-partida/` (NO a `/api/guardar-progreso/`) con el payload completo:
  ```json
  {
    "juego": "Nombre del Juego",
    "nivel": <int>,
    "puntos": <int>,
    "tiempo_jugado": <segundos>,
    "completado": <bool>,
    "tiempo_reaccion_ms": <int>,
    "errores_cometidos": <int>,
    "dificultad_percibida": <1-5>,
    "estado_animo": <1-5>,
    "fc_min": <int o null>,
    "fc_max": <int o null>,
    "fc_avg": <int o null>,
    "fc_serie": <[int] o null>
  }
  ```
- [ ] Ignorar la respuesta del backend (el sistema es observador pasivo).

### Backend
- [ ] **Nada que tocar.** El endpoint `vtr_guardar_partida` ya acepta los campos. El DDA, el VTR y el guardado de FC son automáticos.

### Panel del médico
- [ ] **Nada que tocar.** La gráfica y el modal de `detalle_sesion_terapia.html` ya pintan automáticamente cualquier juego cuya partida esté vinculada a una `SesionTerapia` activa.

### Decisiones de arquitectura
- [ ] No hace falta SPA ni iframe. Navegación normal entre páginas. La conexión BLE se reanuda automáticamente via `Wearable.autoReconnect()` al cargar el script en la nueva página (gracias al permiso persistente de Chrome 85+). Garantizar solo que `wearable_service.js` esté incluido en el `<head>` del template.

---

## 5. Riesgos técnicos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Web Bluetooth no disponible** (Firefox, Safari) | Alta | Bajo | Feature-detection oculta el botón. Sistema funciona idéntico sin reloj. |
| **Conexión BLE muere al cambiar de página** | Alta | Bajo | **RESUELTO** — auto-reconexión silenciosa via `navigator.bluetooth.getDevices()` + flag en `localStorage`. Chrome 85+ persiste el permiso por origen, sin pop-up recurrente. |
| **Reloj se desconecta a mitad de partida** | Media | Bajo | `stopRecording()` devuelve los samples que haya. Backend filtra series con <3 muestras. |
| **Reloj envía valores anómalos** (300 bpm por error) | Baja | Bajo | Backend filtra rango 30-220. Frontend no muestra al paciente. |
| **HTTPS obligatorio para Web Bluetooth** | Cierta | — | Producción ya usa HTTPS (test.evidagroup.es). Desarrollo en `localhost` también funciona. |
| **Latencia de muestreo variable** (algunos relojes envían a 0.5 Hz, otros a 1 Hz) | Media | Bajo | Aceptar lo que llegue. El cálculo de media/máx/mín es robusto a tasas variables. |
| **Diferentes fabricantes implementan el GATT con flags raros** | Media | Medio | El parser maneja flag 0x01 (formato 8 vs 16 bit). Probar con AL MENOS 2 dispositivos físicos distintos. |
| **El paciente tarda en pulsar "Vincular" cada sesión** | Media | Bajo | UX clara, botón discreto pero visible. Aceptado en el documento original. |

---

## 6. Qué NO se debe tocar (anti-deriva)

Para evitar que un cambio de Wearable rompa algo existente, NO hay que:

- ❌ **Cambiar la lógica del VTR** (cálculo de `MarcaPersonalTR`, ventana fresca, FIFO, degradación).
- ❌ **Cambiar la lógica del DDA** (`evaluar_ajuste_dinamico`).
- ❌ **Renombrar campos existentes** de `SesionDeJuego` (`tiempo_reaccion_ms`, `degradacion_porcentaje`, `errores_cometidos`, etc.).
- ❌ **Migrar los juegos no-VTR** (Elsa, Calculadora, etc.) al endpoint `vtr_guardar_partida` solo por meter FC. Si en el futuro entran, será otra decisión de scope.
- ❌ **Mostrar pulsaciones numéricas al paciente.** Solo icono de corazón.
- ❌ **Bloquear el juego si no hay reloj.** El sistema FUNCIONA SIN reloj. Es totalmente opcional.
- ❌ **Hacer que el backend cambie su respuesta** según los datos FC. La respuesta sigue siendo `{"estado": "ok"}` 200 silencioso.
- ❌ **Añadir lógica clínica automática** (alertas "FC alta", bloqueos, etc.). El Wearable es **observador pasivo**, idéntica filosofía al VTR.
- ❌ **Modificar `EvaluacionMoCA`, `NotaEspecialista`, `NotificacionBuzon`, `SesionTerapia`, `MarcaPersonalTR`.** No tienen nada que ver con FC.

---

## 📌 Resumen ejecutivo

| Fase | Qué hace | Ficheros tocados | Riesgo |
|---|---|---|---|
| **1** | 4 campos nuevos en `SesionDeJuego` | `core/models.py` | Bajo |
| **2** | Endpoint acepta datos FC | `core/views.py` | Bajo |
| **3** | Servicio JS Bluetooth | `core/static/core/js/wearable_service.js` (nuevo) | Alto |
| **4** | Botón vincular + icono corazón | `juegos.html` + layout | Medio |
| **5** | Integración en los 4 juegos VTR | 4 templates de juego | Bajo |
| **6** | Línea roja en gráfica médico | `detalle_sesion_terapia.html` + `views.py` | Bajo |
| **7** | Modal detalle partida | `detalle_sesion_terapia.html` | Bajo |

**Tiempo estimado total:** ~6-8 horas de desarrollo enfocado + tiempo de pruebas con hardware real.

**Punto crítico:** la Fase 3 (servicio Bluetooth) sigue siendo la pieza más sensible (parseo GATT, eventos asíncronos, pruebas con hardware real). La Fase 4 queda cerrada con la **auto-reconexión silenciosa** via `navigator.bluetooth.getDevices()` + `localStorage`: navegación normal entre páginas, sin SPA, sin iframe, sin pop-up recurrente. El resto es plumbing aditivo.

---

*Documento generado el 20 de Mayo de 2026. Plan de implementación de la funcionalidad Wearable / Frecuencia Cardíaca para SamiraDTx. No se ha modificado ningún archivo de código fuente todavía.*
