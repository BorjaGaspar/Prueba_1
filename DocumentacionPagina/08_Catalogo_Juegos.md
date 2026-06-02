# 🎮 Catálogo de Juegos Terapéuticos

> **Documento 8 de la serie "Documentación de la Página"**
> Los juegos **son la terapia**. Todo lo demás (BD, IA, VTR, wearable) existe para personalizarlos y medirlos. Este documento cataloga cada juego, explica las **dos familias tecnológicas** (JavaScript vs Unity), describe el **patrón común** que todos comparten y cómo se conectan con el backend.

---

## 1. Las dos familias de juegos

| Familia | Tecnología | Peso | Dónde vive el código | Ejemplos |
|---------|-----------|------|---------------------|----------|
| **JavaScript** | HTML5 Canvas + JS | Ligero | `static/core/js/games/` + `templates/.../games/` | Bolita, Lista Compra, Secuencia Musical, Encuentra Letra |
| **Unity WebGL** | Unity (C#) compilado a WASM | Pesado | `static/games/` (builds binarios) | MoCA 5, Elsa, Calculadora, Identificación |

### ¿Por qué dos familias?
- Los **juegos JS** son rápidos de crear, fáciles de modificar y pesan poco. Ideales para mini-ejercicios cognitivos.
- Los **juegos Unity** permiten experiencias 2D/3D ricas (personajes, animaciones, reconocimiento de voz integrado). Ideales para el test MoCA y juegos elaborados. A cambio, pesan mucho y son una "caja negra" (no se editan desde este repositorio).

---

## 2. Catálogo completo por área cognitiva

| Juego | Área | Familia | Vista | Mide nivel |
|-------|------|---------|-------|-----------|
| **Encuentra la Bolita** (VASOS) | Atención | JS | `jugar_encuentra_bolita` | `nivel_cognitivo` |
| **Encuentra la Letra** | Atención | JS | `jugar_encuentra_letra` | `nivel_cognitivo` |
| **Lista de la Compra** | Memoria | JS | `jugar_lista_compra` | `nivel_cognitivo` |
| **Secuencia Musical** | Memoria | JS | `jugar_SecuenciaMusical` | `nivel_cognitivo` |
| **Prueba de Voz** | Lenguaje | JS/HTML | `jugar_prueba_voz` | — |
| **MoCA 5 / Definitivo** | Evaluación | Unity | `jugar_moca_5(_definitivo)` | (genera nivel) |
| **Juego de Elsa** | Lenguaje | Unity | `jugar_elsa` | — |
| **Calculadora** | Cognitivo | Unity | `jugar_calculadora` | — |
| **Identificación Elsa** | Identificación | Unity | `jugar_identificacion_elsa_unity` | — |

---

## 3. El patrón común de TODOS los juegos JS

Todos los juegos JavaScript comparten una **plantilla estructural** (lo que el código llama "Sistema Base"). Entender este patrón = entender todos los juegos de golpe.

### A) Variables puente (del backend)
```js
let nivelUsuario = typeof NIVEL_DEL_SISTEMA !== 'undefined' ? NIVEL_DEL_SISTEMA : 1;
let csrfToken = typeof TOKEN_DJANGO !== 'undefined' ? TOKEN_DJANGO : '';
```
Reciben el **nivel del paciente** y el **token CSRF** que la plantilla inyectó (Documento 7).

### B) Instrucciones por voz (accesibilidad)
```js
document.getElementById('btn-leer-instrucciones').addEventListener('click', function () {
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    utterance.rate = 0.85;   // un poco más lento, para pacientes
    window.speechSynthesis.speak(utterance);
});
```
Usa la **Web Speech API** del navegador para leer las instrucciones en voz alta. Importante para pacientes con dificultades de lectura.

### C) Inicio + arranque del wearable
```js
function comenzarJuego() {
    if (window.Wearable && Wearable.isConnected()) Wearable.startRecording();  // pulso
    iniciarTuJuego();   // ← aquí empieza la lógica específica del juego
}
```

### D) Recogida VTR (mientras juega)
```js
let vtrErrores = 0;            // cuenta de fallos
let vtrTiemposRonda = [];      // tiempos de reacción de cada ronda
let vtrInicioInteraccion = null;
```
Cada juego mide cuánto tarda el paciente en responder cada ronda y cuántos errores comete.

### E) Autopercepción (al terminar)
Antes de cerrar, se muestra un modal donde el paciente indica:
- **Dificultad percibida** (1 Muy Fácil → 5 Muy Difícil).
- **Estado de ánimo** (1 😢 → 5 😄).

```js
function seleccionarDificultad(valor, btn) { dificultadSeleccionada = valor; ... }
function seleccionarAnimo(valor, btn) { animoSeleccionado = valor; ... }
```

### F) Guardado (cierre del ciclo)
```js
function guardarSesion(puntos, dificultad, animo) {
    const trPromedio = /* media de vtrTiemposRonda */;
    const fc = Wearable.isConnected() ? Wearable.stopRecording() : null;  // pulso
    const datos = {
        juego: "Encuentra la Bolita", nivel: nivelUsuario, puntos,
        dificultad_percibida: dificultad, estado_animo: animo,
        tiempo_reaccion_ms: trPromedio, errores_cometidos: vtrErrores,
        fc_min, fc_max, fc_avg, fc_serie
    };
    fetch('/api/vtr/guardar-partida/', { method: 'POST', body: JSON.stringify(datos), ... });
}
```

> 🔑 **Esto cierra TODO el círculo:** el juego recoge puntos + tiempo de reacción + errores + autopercepción + pulso, y lo manda a `/api/vtr/guardar-partida/`, que dispara el VTR, el wearable y el DDA (Documentos 3 y 6).

---

## 4. Ejemplo detallado: "Encuentra la Bolita" (VASOS)

El clásico juego del trile: una bola bajo un vaso, se mezclan, ¿dónde está?

### Escalado por nivel (1–5)
```js
const CONFIG_NIVELES = {
    vasos:       [2, 3, 4, 5, 6],      // más vasos = más difícil
    movimientos: [1, 2, 3, 4, 5],      // más mezclas = más difícil
    velocidades: [450, 350, 280, 220, 150]  // ms (más rápido = más difícil)
};
```
El `nivelUsuario` (que viene de la IA/médico) selecciona la configuración. **Así la IA se materializa en dificultad real:** un paciente nivel 1 ve 2 vasos lentos; uno nivel 5 ve 6 vasos rapidísimos.

### Lógica (clases `Vaso` y `MotorJuego`)
- **`Vaso`** → dibuja cada vaso en el canvas (con la bola si toca).
- **`MotorJuego`** → orquesta las 5 rondas: muestra la bola, mezcla los vasos (animación con `requestAnimationFrame`), espera el clic del paciente.
- **Puntuación:** acierto +200, fallo −100 (y `vtrErrores++`).
- **VTR:** mide el tiempo desde que puede interactuar hasta que hace clic (`performance.now()`).
- A las 5 rondas → `finalizarJuegoGlobal()` → modal de autopercepción → `guardarSesion()`.

---

## 5. Ejemplo detallado: "Lista de la Compra" (memoria)

Memorizar una lista de productos y luego seleccionarlos en orden.

### Escalado por nivel
```js
const nivelesDefinicion = {
    1: { elementos: 2, tiempo: 8000,  complejidad: 0 },   // 2 productos, 8s, palabras fáciles
    2: { elementos: 3, tiempo: 9000,  complejidad: 0 },
    3: { elementos: 4, tiempo: 12000, complejidad: 1 },
    4: { elementos: 5, tiempo: 14000, complejidad: 1 },
    5: { elementos: 6, tiempo: 16000, complejidad: 2 }    // 6 productos, palabras difíciles
};
```
El nivel controla **cuántos productos**, **cuánto tiempo** para memorizar y la **complejidad de las palabras** (de "Pan, Leche" a "Alcachofas, Espárragos").

### Lógica
1. Muestra la lista durante X segundos (con barra de tiempo visual).
2. La oculta y muestra botones desordenados.
3. El paciente debe pulsarlos **en el orden correcto**.
4. Acierto de ronda +200, fallo −200 (y `vtrErrores++`).
5. 5 rondas → autopercepción → guardado.

---

## 6. Los juegos Unity (la "caja negra")

Los juegos Unity (MoCA, Elsa, Calculadora, Identificación) funcionan distinto:
- La plantilla HTML es solo un **cargador** (ver Documento 4): pinta un canvas, muestra barra de carga y arranca el build con `createUnityInstance`.
- La lógica del juego está **compilada dentro del `.wasm`** → **no es legible ni editable** desde este repositorio. Para cambiarla habría que abrir el proyecto fuente en Unity y recompilar.
- Se conectan con el backend mediante llamadas `fetch` desde el JavaScript que Unity expone (a las mismas APIs: `transcribir_audio`, `guardar_moca`, etc.).
- Pesan mucho: cada build tiene `.data`, `.wasm`, `.framework.js`, `.loader.js` (a veces comprimidos en `.br` Brotli).

> ⚠️ **Estado actual del repo:** algunos builds Unity están **borrados o incompletos** en el working tree (ver `git status`). Las plantillas existen en git pero los binarios pueden faltar. Esto es relevante: los juegos Unity **podrían no cargar** hasta restaurar sus builds.

---

## 7. Mapeo juego → dominio (para el DDA)

El sistema DDA (Documento 3) clasifica los juegos por dominio. **El nombre del juego debe coincidir EXACTAMENTE** con el que el JS manda:

```python
JUEGOS_COGNITIVOS = ["Encuentra la Letra", "Calculadora", "Juego 1: Memoria", "Memoria MoCA"]
JUEGOS_LENGUAJE   = ["Juego de Elsa", "Laboratorio Voz"]
JUEGOS_MOTORES    = ["Prueba de Cámara"]
```

> ✅ **CORREGIDO (mayo 2026):** antes, 3 de los 4 juegos JS activos ("Encuentra la Bolita", "Lista de la Compra", "Música y Colores") **no estaban** en las listas del DDA, así que el auto-ajuste **nunca se disparaba** para ellos (la función salía sin hacer nada). Se añadieron esos nombres a `JUEGOS_COGNITIVOS` y se documentó en el código que **los nombres deben coincidir exactamente** (mayúsculas, tildes, espacios) con el campo `juego` que envía cada juego. Ahora el DDA funciona en los 4 juegos cognitivos.

---

## 8. Resumen ejecutivo (la foto en 6 frases)

1. Hay **dos familias** de juegos: **JavaScript** (ligeros, editables) y **Unity WebGL** (ricos, caja negra).
2. Todos los juegos JS comparten un **patrón común**: variables puente, voz, wearable, VTR, autopercepción y guardado.
3. El **nivel del paciente** (de la IA) se materializa en **dificultad real** (más vasos, menos tiempo, palabras más difíciles).
4. Al terminar, cada juego manda a `/api/vtr/guardar-partida/` un paquete completo: puntos + tiempo de reacción + errores + autopercepción + pulso.
5. Los juegos Unity son **cargadores** de builds compilados; su lógica no es editable desde aquí y algunos builds faltan en el repo.
6. ✅ La **desincronización de nombres** entre los juegos JS y las listas del DDA **ya está corregida** (los 4 juegos cognitivos disparan el auto-ajuste).

---

## 9. Puntos a explorar / clarificar

- ✅ **Nombres del DDA**: corregido — los nombres que mandan los juegos JS ya están alineados con `JUEGOS_COGNITIVOS`.
- 📌 **Unity descartado**: la familia de juegos Unity (MoCA, Elsa, Calculadora, Identificación) fue un enfoque que **se abandonó**. Las vistas/plantillas/rutas siguen en el código pero los builds están eliminados. Candidatos a limpieza si se confirma que no se retoman.
- 🔬 **Secuencia Musical** ("Música y Colores"): sigue el mismo patrón; revisar su escalado por nivel y su tope de puntos (relevante para el umbral de ascenso del DDA, 800 pts).
- 📹 **Prueba de Cámara / juegos motores**: la vista `jugar_prueba_camara` apunta a una carpeta `games/motor/` que quizá no existe.

---

*Fin del Documento 8. Siguiente: Seguridad y Despliegue (Documento 9).*
