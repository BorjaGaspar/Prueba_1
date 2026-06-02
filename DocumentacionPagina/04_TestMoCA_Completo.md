# 🧪 El Test MoCA — Flujo Completo de Principio a Fin

> **Documento 4 de la serie "Documentación de la Página"**
> El test **MoCA** es el corazón clínico de SamiraDTx: es la evaluación que mide el estado cognitivo del paciente y dispara todo lo demás (asignación de nivel, terapia personalizada). Este documento explica **todo el recorrido**: qué es el MoCA, cómo se digitaliza, cómo viaja el dato desde el micrófono del paciente hasta la pantalla del médico, y qué papel juega la IA de voz (Whisper).

---

## 1. ¿Qué es el MoCA? (contexto clínico)

**MoCA = Montreal Cognitive Assessment.** Es un test estándar mundial para detectar **deterioro cognitivo leve** (muy usado tras ictus, en demencias, Parkinson…). Se puntúa de **0 a 30**; normalmente ≥26 se considera normal.

El test evalúa **7 dominios cognitivos**:

| Dominio | Qué mide | Ejemplo de prueba |
|---------|----------|-------------------|
| **Visuoespacial/Ejecutiva** | Planificación, dibujo | Dibujar un cubo, unir números y letras (TMT) |
| **Identificación** | Reconocimiento | Nombrar animales (león, rinoceronte, camello) |
| **Atención** | Concentración, cálculo | Repetir números, restar de 7 en 7, detectar letras |
| **Lenguaje** | Habla, repetición | Repetir frases, fluidez verbal |
| **Abstracción** | Razonamiento | ¿En qué se parecen tren y bici? |
| **Recuerdo diferido** | Memoria | Recordar 5 palabras tras un rato |
| **Orientación** | Conciencia espacio-temporal | ¿Qué día/mes/año/lugar es? |

SamiraDTx **digitaliza este test** en un juego de Unity, capturando voz (micrófono) y dibujos (canvas), y lo convierte en datos estructurados.

---

## 2. Las dos versiones del MoCA en el proyecto

| Versión | Plantilla | Vista | Nota |
|---------|-----------|-------|------|
| **MoCA 5** | `juego_moca5.html` | `jugar_moca_5` | Versión de desarrollo |
| **MoCA 5 Definitivo** | `juego_moca5_definitivo.html` | `jugar_moca_5_definitivo` | Versión final |

Ambas son **juegos Unity WebGL**: la plantilla HTML solo es un **"contenedor cargador"** y la lógica real del test vive dentro del build de Unity (`.wasm`).

---

## 3. Anatomía de la plantilla MoCA (el cargador Unity)

La plantilla `juego_moca5_definitivo.html` (111 líneas) **no contiene la lógica del test**. Es un envoltorio que:
1. Extiende `base_private.html` (hereda el menú del paciente).
2. Pinta un `<canvas id="unity-canvas">` donde se renderiza el juego.
3. Muestra una **barra de carga** mientras descarga el build (los juegos Unity pesan mucho).
4. Configura las rutas del build:
   ```js
   var buildUrl = "{% static 'games/moca5Definitivo/Build' %}";
   var config = {
       dataUrl:      buildUrl + "/JuegoMoca5Definitivo.data",
       frameworkUrl: buildUrl + "/JuegoMoca5Definitivo.framework.js",
       codeUrl:      buildUrl + "/JuegoMoca5Definitivo.wasm",
       streamingAssetsUrl: "StreamingAssets",   // ← aquí vive el modelo Whisper de Unity
       ...
   };
   ```
5. Carga el `loader.js` de Unity y arranca la instancia con `createUnityInstance`.

> 📦 **`StreamingAssets`** contiene `ggml-tiny.bin` (un modelo Whisper en versión C++ embebido en Unity). Fue un **experimento descartado**: se probó transcribir la voz dentro del propio juego Unity, pero la idea de usar Unity se abandonó. **La transcripción real corre solo en el servidor Django** (ver sección 6). Estos archivos son residuos de aquel intento.

---

## 4. El recorrido completo del dato (paso a paso)

```
┌──────────────────────────────────────────────────────────────────┐
│  1. PACIENTE juega el MoCA (Unity WebGL en el navegador)           │
│     - Dibuja el cubo y el reloj (canvas → imagen Base64)           │
│     - Habla por el micrófono (repetir frases, nombrar animales…)   │
│     - Responde preguntas de orientación                            │
└──────────────────────────────────────────────────────────────────┘
              │  audio (por cada prueba de voz)
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. POST /api/transcribir-audio/   → vista transcribir_audio       │
│     - Whisper "tiny" convierte la voz en texto español             │
│     - Devuelve {'texto_transcrito': "..."}                         │
└──────────────────────────────────────────────────────────────────┘
              │  texto transcrito (vuelve a Unity)
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. Unity puntúa cada dominio y arma un JSON gigante con TODO:     │
│     scores, audios Base64, dibujos Base64, transcripciones,        │
│     subpuntuaciones granulares, datos_completos_raw                │
└──────────────────────────────────────────────────────────────────┘
              │  POST /api/guardar-moca/
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. vista guardar_moca:                                            │
│     - Crea una fila EvaluacionMoCA con ~40 campos                  │
│     - Copia los scores al PerfilPaciente                           │
│     - Asigna nivel cognitivo provisional (reglas if/else)          │
│     - Marca test_completado = True                                 │
└──────────────────────────────────────────────────────────────────┘
              │  (más tarde, en otro momento)
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  5. MÉDICO entra en /auditoria-moca/<id>/ → vista auditoria_moca   │
│     - Ve los dibujos, escucha los audios, lee transcripciones      │
│     - Corrige las puntuaciones si hace falta                       │
│     - Al validar → la IA (ml_service) SUGIERE un nivel             │
│     - El médico confirma → /api/aplicar-nivel-ml/                  │
└──────────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  6. El paciente recibe una NotificacionBuzon con su nuevo nivel    │
│     y empieza a entrenar con la dificultad personalizada           │
└──────────────────────────────────────────────────────────────────┘
```

Este es el patrón **"Store & Forward"**: el paciente genera los datos en un momento, se almacenan completos, y el médico los revisa **de forma asíncrona** cuando puede.

---

## 5. El JSON que Unity manda a `guardar_moca`

Cuando el paciente termina, Unity envía un JSON con **tres tipos de información** (todos se guardan en `EvaluacionMoCA`):

### A) Puntuaciones (los 7 dominios + total)
`score_visuoespacial`, `score_identificacion`, `score_atencion`, `score_lenguaje`, `score_abstraccion`, `score_recuerdo`, `score_orientacion`, `score_total`.

### B) Evidencia multimedia (para auditoría del médico)
- **Dibujos** (Base64): `dibujo_cubo_b64`, `dibujo_reloj_b64`.
- **Audios** (Base64): `audio_frase1_b64`, `audio_frase2_b64`, `audio_fluidez_b64`, `audio_tren_b64`, `audio_reloj_b64`, `audio_recuerdo_b64`.
- **Transcripciones IA**: `transcripcion_frase1`, `transcripcion_fluidez`, `transcripcion_recuerdo`, etc.

### C) Subpuntuaciones granulares (detalle clínico)
Cada subprueba por separado: `respuesta_animal_1/2/3`, `memoria_intento1/2`, `atencion_numeros_dir/inv`, `lenguaje_rep_1/2`, `orientacion_dia_semana/mes/anio/lugar/localidad`, etc.

### D) Respaldo crudo
`datos_completos_raw` = el JSON íntegro tal cual lo mandó Unity. Es el **seguro de vida**: si algún campo se procesó mal, el dato original sigue ahí.

> 💡 **Por qué Base64:** los audios y dibujos son archivos binarios. Convertirlos a texto Base64 permite meterlos directamente en el JSON y guardarlos en campos `TextField` de la base de datos, sin necesidad de un sistema de archivos aparte.

---

## 6. La IA de voz: Whisper (`transcribir_audio`)

La pieza que hace "mágico" el test es la transcripción de voz. Vista `transcribir_audio` en `views.py`:

```python
if MODELO_WHISPER is None:
    MODELO_WHISPER = whisper.load_model("tiny")   # carga única (perezosa)
...
resultado = MODELO_WHISPER.transcribe(ruta_temporal, language="es")
texto_detectado = resultado["text"]
```

**Claves del diseño:**
- Usa el modelo **`"tiny"`** (el más pequeño y rápido de Whisper). Sacrifica algo de precisión por velocidad — razonable porque las respuestas son cortas (frases, animales).
- **Carga perezosa con variable global**: el modelo solo se carga la primera vez que alguien transcribe, y se reutiliza. Cargar Whisper es lento; hacerlo en cada petición sería inviable.
- **Fuerza el idioma español** (`language="es"`).
- Guarda el audio en un **archivo temporal** porque Whisper necesita leer de disco; luego lo borra.
- Necesita **`ffmpeg`** por debajo (de ahí el `ffmpeg.exe` en la raíz) para decodificar el audio.

### ✅ Un solo motor Whisper (aclarado)
Aunque en el repositorio aparecen restos de Whisper en dos sitios, **solo uno está activo**:
1. ✅ **En el servidor Django** (`transcribir_audio` + librería `openai-whisper`) → **este es el motor real y único**.
2. ❌ **Dentro del build de Unity** (`StreamingAssets/Whisper/ggml-tiny.bin`) → **descartado**. Fue parte del experimento con Unity que se abandonó; son archivos residuales.

Conclusión: toda transcripción de voz pasa por la API `/api/transcribir-audio/` del servidor. No hay ambigüedad.

---

## 7. La auditoría del médico (`auditoria_moca`)

Aquí el médico **valida** el test. La vista hace algo elegante: distingue entre puntuar y decidir el nivel.

1. El médico ajusta las 7 puntuaciones si lo cree necesario (con `safe_int` para no romper si un campo está vacío).
2. Se **recalcula el total** y se marca `revisada_por_medico = True`.
3. Se llama a **`predecir_nivel`** (ml_service) → la IA propone un nivel 1–5.
4. La respuesta vuelve por **AJAX** con la sugerencia, y el médico **confirma** vía `/api/aplicar-nivel-ml/`.

> 🔑 **Filosofía clínica:** la IA **sugiere**, el médico **decide**. Nunca se aplica un nivel automático sin que un humano cualificado lo valide. Esto es importante en software médico (responsabilidad clínica).

La plantilla `auditoria_moca.html` muestra los dibujos (`<img src="data:image/png;base64,...">`) y reproductores de audio (`<audio src="data:audio/...;base64,...">`) decodificando los campos Base64.

---

## 8. Resumen ejecutivo (la foto en 6 frases)

1. El **MoCA** es un test cognitivo estándar (0–30 puntos, 7 dominios) que SamiraDTx digitaliza como **juego Unity WebGL**.
2. La plantilla HTML es solo un **cargador**; la lógica del test vive en el build de Unity.
3. Mientras juega, el paciente **habla y dibuja**; los audios se transcriben con **Whisper** (`/api/transcribir-audio/`).
4. Al terminar, Unity manda un **JSON enorme** a `/api/guardar-moca/` con puntuaciones, audios/dibujos en Base64, transcripciones y un respaldo crudo.
5. El médico **audita** el test en `auditoria_moca`: revisa la evidencia, corrige puntuaciones y la **IA sugiere un nivel** que él confirma.
6. Es un sistema **"Store & Forward"**: el paciente genera, el sistema guarda, el médico revisa de forma asíncrona.

---

## 9. Puntos a explorar / clarificar

- ✅ **Whisper**: aclarado — corre **solo en el servidor Django**. El Whisper de Unity fue descartado.
- ❓ El campo `score_tmt` se rellena con `datos.get('score_visuoespacial', 0)` en `guardar_moca` (posible copia-pega: TMT debería ser una subpuntuación distinta).
- 📌 **Unity descartado**: el MoCA se implementó originalmente como juego Unity, pero la idea de usar Unity se abandonó. La parte que **sigue siendo válida y tecnología-agnóstica** es el **flujo de backend** (`transcribir_audio` + `guardar_moca`): da igual qué frontend genere los datos, el servidor los procesa igual.

---

*Fin del Documento 4. Siguiente: el modelo de Inteligencia Artificial que asigna niveles (Documento 5).*
