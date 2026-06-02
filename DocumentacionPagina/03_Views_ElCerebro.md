# 🧠 `views.py` — El Cerebro de SamiraDTx

> **Documento 3 de la serie "Documentación de la Página"**
> Este es el documento más importante para entender **cómo funciona la página por dentro**. `core/views.py` (990 líneas, ~40 funciones) contiene **toda la lógica**: qué pasa cuando alguien entra a una URL, cómo se guardan los datos, cómo la IA ajusta los niveles y cómo médico y paciente interactúan.
>
> Aquí explicamos cada función **por bloques y por lo que hace** (no línea por línea), y dejamos claro **quién la llama y a qué tabla/servicio toca**.

---

## 0. ¿Qué es una "vista" (view) en Django? (repaso rápido)

Una **vista** es una función de Python que:
1. Recibe una **petición** (`request`) del navegador.
2. Hace algo (consultar la BD, guardar datos, ejecutar IA…).
3. Devuelve una **respuesta**: o bien una **página HTML** (`render`), una **redirección** (`redirect`) o **datos JSON** (`JsonResponse`).

Dos decoradores aparecen mucho:
- **`@login_required`** → "solo usuarios logueados pueden entrar aquí". Si no, te manda al login.
- **`@csrf_exempt`** → "no exijas el token de seguridad CSRF en esta ruta". Se usa en las APIs que llaman los juegos (porque vienen de JavaScript/Unity y no del formulario normal de Django). ⚠️ *Nota de seguridad: ver Documento 9.*

---

## 1. Vista general: el mapa de las ~40 funciones

`views.py` se divide en **7 grandes bloques**:

| Bloque | Funciones | Para quién |
|--------|-----------|-----------|
| **1. Públicas** | `home`, `historia`, `servicios`, `contacto` | Cualquiera |
| **2. Registro/Auth** | `registro` | Visitante que se apunta |
| **3. Zona Paciente** | `dashboard`, `resumen_paciente`, `buzon_paciente` | Paciente |
| **4. Zona Médico** | `dashboard_medico`, `detalle_paciente`, `historial_moca`, `auditoria_moca`, `aplicar_nivel_ml`, `forzar_evaluacion`, `buzon_paciente_medico`, `analisis_paciente`, `lista_sesiones_terapia`, `detalle_sesion_terapia` | Médico |
| **5. Lanzadores de juegos** | `juegos`, `sala_evaluacion`, `jugar_moca_5`, `jugar_elsa`, `jugar_encuentra_letra`, `jugar_encuentra_bolita`, … | Paciente |
| **6. APIs (datos JSON)** | `guardar_progreso`, `transcribir_audio`, `guardar_moca`, `vtr_iniciar_sesion`, `vtr_guardar_partida` | Llamadas por JS/Unity |
| **7. Lógica interna (helpers)** | `evaluar_ajuste_dinamico`, `_aplicar_nivel_a_paciente` | Otras funciones |

Las importaciones del principio revelan **con quién habla** `views.py`:
- `from .models import …` → las 7 tablas (Documento 1).
- `from core.services.vtr_service import …` → el sistema de tiempos de reacción (Documento 6).
- `from core.services.ml_service import predecir_nivel` → la IA de niveles (Documento 5).
- `import whisper` → la IA de voz (Documento 4).

> 🧩 **Idea clave:** `views.py` es el **director de orquesta**. No hace el trabajo pesado él solo: delega en los *servicios* (`ml_service`, `vtr_service`) y en las *plantillas*. Su trabajo es **coordinar**.

---

## 2. BLOQUE 1 — Vistas públicas (lo más simple)

```python
def home(request):       return render(request, "core/pages/home.html")
def historia(request):   return render(request, "core/patients/historia.html")
def servicios(request):  return render(request, "core/pages/servicios.html")
def contacto(request):   return render(request, "core/pages/contacto.html")
```

Son las más sencillas: **solo muestran una plantilla HTML**, sin lógica ni base de datos. Son la web de marketing. No requieren login.

---

## 3. BLOQUE 2 — Registro (`registro`)

Es la **puerta de entrada** de nuevos usuarios. Su flujo:
1. Si llega un `POST` (alguien envió el formulario), valida `RegistroUsuarioForm` (de `forms.py`).
2. Si es válido → `form.save()` crea el `User` **y** el `PerfilPaciente` (esa lógica está en `forms.py`, ver Documento 1).
3. `login(request, user)` → inicia sesión automáticamente.
4. **Detecta el rol** (con un `try/except` defensivo que mira `user.perfil.es_medico`) y redirige:
   - médico → `dashboard_medico`
   - paciente → `dashboard`

> 💡 El `try/except` "robusto" existe porque el `related_name` del perfil podría ser `perfil` o el default `perfilpaciente`. Se cubre ante ambos por seguridad.

---

## 4. BLOQUE 3 — Zona del Paciente

### `dashboard` — el "portero" del paciente
No muestra nada: **decide a dónde mandar** al paciente según su estado:
```
¿Es médico?           → dashboard_medico
¿Test sin completar?  → sala_evaluacion (a hacer el MoCA)
Si no                 → juegos (a entrenar)
```
Es un **router inteligente**: garantiza que nadie entra a jugar sin haber hecho antes la evaluación.

### `resumen_paciente` — su panel de progreso
Muestra `dashboard.html` con el perfil (puntos, racha, niveles).

### `buzon_paciente` — los mensajes
Trae las `NotificacionBuzon` del paciente y, **al entrar, las marca como leídas** automáticamente (`mensajes_sin_leer.update(leida=True)`). Por eso cuando el paciente abre el buzón, el contador de "sin leer" se pone a cero.

---

## 5. BLOQUE 4 — Zona del Médico (la más rica)

### `dashboard_medico` — lista de pacientes
Comprueba que el usuario **es médico** (si no, lo echa a `dashboard`). Luego trae **sus** pacientes:
```python
mis_pacientes = PerfilPaciente.objects.filter(medico_asignado=request.user)
```
Aquí se ve cómo funciona la relación médico↔paciente del Documento 1: filtra los perfiles cuyo `medico_asignado` es este médico.

### `detalle_paciente` — la ficha clínica (lectura + escritura)
Es una vista **doble** (GET para ver, POST para modificar). El médico puede hacer **dos acciones** distintas desde el mismo formulario, diferenciadas por qué botón pulsó:
- **`actualizar_niveles`** → cambia a mano `nivel_cognitivo`, `nivel_lenguaje`, `nivel_motor`.
- **`guardar_nota`** → crea una `NotaEspecialista` (historial clínico interno).

### `historial_moca` — lista de tests
Trae todas las `EvaluacionMoCA` del paciente (ya ordenadas de nueva a vieja) y las muestra en una lista.

### `auditoria_moca` — ⭐ la vista más compleja del médico
Aquí el médico **revisa y corrige** un test MoCA. Pasos cuando guarda (POST):
1. Lee las 7 puntuaciones del formulario, **protegidas con `safe_int`** (si el campo viene vacío, no rompe).
2. **Recalcula el total** sumando los 7 dominios.
3. Marca `revisada_por_medico = True` y guarda.
4. Si es **la evaluación más reciente**, copia los scores también al `PerfilPaciente` (para que el perfil refleje el último test).
5. **Llama a la IA**: `predecir_nivel(paciente, evaluacion)` → obtiene el nivel sugerido.
6. **Responde según el tipo de petición**:
   - Si es **AJAX** (JavaScript) → devuelve JSON con `nivel_sugerido` para que el médico lo confirme en pantalla.
   - Si **no** es AJAX (fallback) → aplica directamente el nivel sugerido con `_aplicar_nivel_a_paciente`.

> 🔑 Este patrón "sugerir → que el humano confirme" es importante: **la IA no decide sola**, propone, y el médico tiene la última palabra (ver paso siguiente).

### `aplicar_nivel_ml` — el médico confirma el nivel
Endpoint AJAX (`POST` con JSON). Recibe el `nivel_final` que el médico eligió tras ver la sugerencia, lo limita al rango 1–5, y lo aplica con `_aplicar_nivel_a_paciente`. Devuelve la URL a la que redirigir.

### `_aplicar_nivel_a_paciente` (helper privado) — el que escribe el nivel
Función auxiliar (el `_` al inicio significa "uso interno"). Hace 3 cosas:
1. Pone `nivel_cognitivo`, `nivel_lenguaje` y `nivel_asignado` al valor final.
2. **Regla especial de lenguaje:** si el paciente sacó 0 en lenguaje, fuerza `nivel_lenguaje = 1` (no tiene sentido ponerle ejercicios de lenguaje difíciles si falló todo).
3. Crea una **`NotificacionBuzon`** avisando al paciente de su nuevo nivel.

### `forzar_evaluacion` — pedir re-evaluación
El médico resetea `test_completado = False`. Así, la próxima vez que el paciente entre, el "portero" `dashboard` lo mandará otra vez a hacer el MoCA.

### `buzon_paciente_medico` — el médico escribe al paciente
Verifica que es médico, y al hacer POST crea una `NotificacionBuzon` con `remitente='MEDICO'` y `medico_autor=request.user`.

### `analisis_paciente` — preparar las gráficas
Vista interesante de **transformación de datos**. Recoge todas las `SesionDeJuego` del paciente y las **agrupa en un diccionario anidado** `{juego: {nivel: {fechas, puntos, tiempos, dificultades, animos}}}`. Luego lo convierte a JSON (`json.dumps`) y lo pasa a la plantilla, donde JavaScript dibujará las gráficas (Documento 7). Si un dato subjetivo es `None`, lo manda como `0` para no romper el gráfico.

### `lista_sesiones_terapia` y `detalle_sesion_terapia` — el panel VTR
- **`lista_sesiones_terapia`** → muestra todas las `SesionTerapia` del paciente.
- **`detalle_sesion_terapia`** → la joya del sistema VTR. Recibe el `session_id` (UUID), trae sus partidas y prepara los datos para la gráfica:
  - Reconstruye el "TR ideal en cada partida" a partir de la degradación guardada.
  - Arma arrays de degradación, errores, y **frecuencia cardíaca** (`fc_avg`, `fc_min`, `fc_max`, `fc_series`).
  - Todo se empaqueta en `datos_grafica_json` para que el frontend pinte las curvas de fatiga y pulso.

---

## 6. BLOQUE 5 — Lanzadores de juegos

Casi todos son sencillos: **muestran la plantilla del juego**. Pero algunos hacen algo clave: **inyectan el nivel del paciente** en el juego.

### El caso simple (juegos sin nivel)
```python
def jugar_moca_5(request):  return render(request, 'core/games/moca/juego_moca5.html')
def jugar_elsa(request):    return render(request, 'core/games/moca/juego_elsa.html')
```

### El caso con nivel (juegos cognitivos)
```python
def jugar_encuentra_bolita(request):
    perfil = request.user.perfil
    nivel_actual = perfil.nivel_cognitivo if perfil else 1
    return render(request, '...EncuentraLaBolita.html', {'nivel_inicial': nivel_actual})
```
El juego recibe `nivel_inicial` y arranca en la dificultad correcta del paciente. Lo mismo hacen `jugar_encuentra_letra`, `jugar_lista_compra` y `jugar_SecuenciaMusical`.

### `juegos` — la biblioteca (con lógica anti-fatiga)
No solo muestra la lista de juegos. Comprueba si **ya hay una sesión de terapia activa** (<60 min de inactividad). Pasa `sesion_activa` a la plantilla para decidir si mostrar el test de cansancio (VAS). Lo comprueba **en el backend** (no en el navegador) deliberadamente, porque el `sessionStorage` del navegador "sobrevive" a cambios de usuario y daría falsos positivos.

### `sala_evaluacion` — la pantalla de evaluación inicial
GET muestra el formulario; POST guarda un nivel elegido y marca `test_completado = True`.
> ✅ **CORREGIDO:** este POST escribía `perfil.puntuacion_cognitiva`, un campo que **no existe** en el `models.py` actual (se eliminó en la migración 0012). Era código muerto (Django no lo guardaba, pero ensuciaba). Se eliminó esa línea.

---

## 7. BLOQUE 6 — Las APIs (el corazón de los datos)

Estas funciones **no devuelven HTML**, devuelven JSON. Las llaman los juegos por JavaScript.

### `guardar_progreso` — guardar una partida normal
Recibe JSON con `juego`, `nivel`, `puntos`, `tiempo`, `dificultad_percibida`, `estado_animo`. Crea una `SesionDeJuego` y **acto seguido llama a `evaluar_ajuste_dinamico`** (el algoritmo DDA que ajusta el nivel). Es la API de los juegos JS "ligeros".

### `transcribir_audio` — 🎙️ la IA de voz (Whisper)
La API más especial. Recibe un **archivo de audio** y devuelve **texto**:
1. **Carga perezosa:** la primera vez carga el modelo Whisper `"tiny"` en la variable global `MODELO_WHISPER` (para no recargarlo en cada petición).
2. Guarda el audio en un archivo temporal `.wav`.
3. `MODELO_WHISPER.transcribe(ruta, language="es")` → transcribe en español.
4. Borra el temporal y devuelve `{'texto_transcrito': …}`.

Esta API es la que permite que el test MoCA "entienda" lo que el paciente dice por el micrófono (Documento 4).

### `guardar_moca` — 💾 guardar el test cognitivo completo
La API más **grande**. Recibe un JSON enorme del frontend con TODO el test y:
1. Crea una `EvaluacionMoCA` con **~40 campos**: las 7 puntuaciones, los audios y dibujos en Base64, las transcripciones de IA, las subpuntuaciones granulares, y el **JSON crudo completo** como respaldo (`datos_completos_raw`).
2. Actualiza el `PerfilPaciente` con los scores.
3. **Asigna un nivel cognitivo automático** según el total MoCA:
   ```
   ≥26 → Nivel 5     ≥24 → Nivel 4     ≥18 → Nivel 3
   ≥10 → Nivel 2     <10 → Nivel 1
   ```
4. Marca `test_completado = True`.

> 🔎 **Matiz importante:** este nivel automático es **provisional**. Luego el médico, en `auditoria_moca`, revisa el test y la **IA (`ml_service`) recalcula** un nivel más fino con datos clínicos. Hay por tanto **dos sistemas de nivel**: el rápido (reglas `if/else` aquí) y el inteligente (modelo ML, Documento 5).

### `vtr_iniciar_sesion` y `vtr_guardar_partida` — el sistema VTR + Wearable
Las APIs de los juegos "avanzados" (con medición de fatiga y pulso):

- **`vtr_iniciar_sesion`** → abre o reutiliza una `SesionTerapia` (delega en `obtener_o_crear_sesion` del `vtr_service`). Devuelve el `session_id`.

- **`vtr_guardar_partida`** → la API más completa. Por cada partida:
  1. Lee `juego`, `nivel`, `puntos`, `tiempo_reaccion_ms`, `errores`.
  2. **Valida los datos del wearable** de forma defensiva: filtra la serie de pulsaciones dejando solo valores plausibles (30–220 bpm) y solo guarda si hay ≥3 muestras. Calcula `fc_min/max/avg`.
  3. Obtiene/crea la sesión, **actualiza el récord de tiempo de reacción** (`actualizar_marca_personal`) y **calcula la degradación** vs ese récord.
  4. Crea la `SesionDeJuego` con todos los datos VTR + FC.
  5. Registra actividad (mantiene viva la sesión) y ejecuta el **DDA** (`evaluar_ajuste_dinamico`).

> 🛡️ Fíjate en la filosofía: *"el juego nunca recibe órdenes"* (comentario del código). La API **siempre responde `ok`**, aunque algo falle internamente. El juego no debe depender de la respuesta del servidor para seguir funcionando.

---

## 8. BLOQUE 7 — La joya oculta: `evaluar_ajuste_dinamico` (DDA)

Esta función (línea 484) implementa el **DDA = Dynamic Difficulty Adjustment** (Ajuste Dinámico de Dificultad). Es el sistema que **sube o baja la dificultad automáticamente** sin que el médico haga nada. Funciona así:

### Paso 1 — Clasificar el juego por dominio
Tiene tres "cajones":
```python
JUEGOS_COGNITIVOS = ["Encuentra la Letra", "Calculadora", "Juego 1: Memoria", "Memoria MoCA"]
JUEGOS_LENGUAJE   = ["Juego de Elsa", "Laboratorio Voz"]
JUEGOS_MOTORES    = ["Prueba de Cámara"]
```
Según a qué cajón pertenece el juego jugado, trabajará sobre `nivel_cognitivo`, `nivel_lenguaje` o `nivel_motor`.

### Paso 2 — Mirar las 2 últimas sesiones de ese dominio
Coge las **2 partidas más recientes** del mismo dominio. Si no hay 2, o si falta el dato de dificultad percibida, **no hace nada** (necesita evidencia consistente).

### Paso 3 — Aplicar las reglas
- **REGLA DE ASCENSO** ⬆️: si en **ambas** partidas hizo ≥800 puntos **y** percibió la dificultad ≤2 ("fácil") → sube un nivel (máx 5). *Interpretación: domina esto, le aburre, dale más reto.*
- **REGLA DE DESCENSO** ⬇️: si en **ambas** hizo ≤300 puntos **o** percibió dificultad =5 ("muy difícil") → baja un nivel (mín 1). *Interpretación: está sufriendo/frustrado, evita el abandono.*

### Paso 4 — Aplicar y comunicar
Si hay cambio:
1. Guarda el nuevo nivel en el campo correcto del perfil.
2. Crea una **`NotaEspecialista`** técnica para el médico (con la justificación clínica).
3. Crea una **`NotificacionBuzon`** amigable para el paciente ("¡Enhorabuena!" o "Hemos ajustado tu ritmo").

> 🧠 **Este es el segundo sistema de IA "blanda" del proyecto.** No usa Machine Learning, sino **reglas heurísticas** basadas en rendimiento + autopercepción. Trabaja en tiempo real, partida a partida, mientras el modelo ML solo actúa tras el test MoCA. Juntos forman la **doble adaptación**: macro (ML tras evaluación) + micro (DDA tras cada par de partidas).

---

## 9. Los TRES sistemas de niveles (resumen crítico)

Una de las cosas más confusas del proyecto es que hay **tres formas distintas** de asignar el nivel. Aquí queda claro:

| Sistema | Dónde | Cuándo actúa | Cómo decide |
|---------|-------|-------------|-------------|
| **1. Reglas MoCA** | `guardar_moca` | Justo al acabar el test | `if score ≥ 26 → nivel 5`… (umbral fijo) |
| **2. Modelo ML** | `auditoria_moca` + `ml_service` | Cuando el médico valida el test | Modelo scikit-learn con datos clínicos |
| **3. DDA (heurístico)** | `evaluar_ajuste_dinamico` | Tras cada par de partidas | Rendimiento + dificultad percibida |

**Orden temporal real:** (1) el paciente hace el test → nivel provisional rápido. (2) El médico lo valida → la IA refina el nivel. (3) Mientras el paciente entrena día a día → el DDA va micro-ajustando.

---

## 10. Cómo se conecta `views.py` con el resto

```
                       ┌──────────────────┐
   forms.py ──────────▶│                  │◀──── templates/ (devuelve HTML)
                       │    views.py      │
   models.py ◀────────▶│   (EL CEREBRO)   │◀──── urls.py (le manda peticiones)
                       │                  │
   ml_service.py ◀─────│                  │
   vtr_service.py ◀────│                  │
   whisper (IA voz) ◀──│                  │
                       └──────────────────┘
                              ▲
                              │ JSON (APIs)
                       Juegos JS / Unity
```

---

## 11. Resumen ejecutivo (la foto en 7 frases)

1. `views.py` es el **director de orquesta**: ~40 funciones que coordinan todo, divididas en públicas, paciente, médico, juegos, APIs y helpers.
2. El paciente pasa por un **"portero" (`dashboard`)** que lo obliga a evaluarse antes de jugar.
3. El médico tiene un panel rico: ve pacientes, **audita tests MoCA**, valida niveles (con sugerencia de la IA) y se comunica por buzón.
4. Las **APIs** (`guardar_progreso`, `transcribir_audio`, `guardar_moca`, `vtr_*`) reciben datos de los juegos en JSON y los guardan.
5. **`transcribir_audio`** usa **Whisper** para convertir voz en texto (clave en el MoCA).
6. **`evaluar_ajuste_dinamico` (DDA)** sube/baja la dificultad automáticamente según rendimiento + cansancio percibido.
7. Existen **tres sistemas de niveles** (reglas MoCA, modelo ML, DDA) que actúan en distintos momentos y se complementan.

---

## 12. Puntos sospechosos / a vigilar (para limpieza futura)

- ✅ **CORREGIDO** — `sala_evaluacion` escribía `perfil.puntuacion_cognitiva`, campo **inexistente** → línea eliminada.
- ✅ **CORREGIDO** — `urls.py` definía `transcribir_audio` y `guardar_progreso` **dos veces** → duplicados eliminados.
- 🔓 Las APIs usan `@csrf_exempt` → cómodo para los juegos, pero baja la seguridad (ver Documento 9).
- 🎮 `jugar_prueba_camara` apunta a `games/motor/juego_prueba_camara.html`, una carpeta que quizá no existe → ruta potencialmente rota (juego motor, posiblemente del experimento Unity descartado).

---

*Fin del Documento 3. Siguiente: el flujo completo del test MoCA (Documento 4).*
