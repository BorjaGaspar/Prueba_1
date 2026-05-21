# 🎯 Fases de Implementación VTR — Estrategia Incremental

**Versión:** 1.0  
**Fecha:** 18 de Mayo de 2026  
**Objetivo:** Implementar el sistema VTR en 5 fases, validando cada una antes de pasar a la siguiente  
**Filosofía:** *Pequeños pasos, validación constante, fallos detectados temprano*

---

## 📋 ¿Por qué Fases Incrementales?

En lugar de codificar todo de golpe (500+ líneas de código nuevo), dividimos el trabajo en **5 fases independientes**, cada una con:

✅ **Código enfocado** — solo lo necesario para esa fase  
✅ **Validación clara** — tests manuales antes de avanzar  
✅ **Fallos localizados** — si algo falla en fase 2, solo afecta a vtr_service.py, no a todo el proyecto  
✅ **Marcha atrás segura** — si descubrimos un problema en fase 3, rollback de `views.py` es trivial sin tocar phase 1  

**Resumen del timing esperado:**
- Fase 1 (Modelos): **30 min** → BD lista
- Fase 2 (Servicios): **45 min** → Lógica probada
- Fase 3 (API): **60 min** → Endpoints funcionales
- Fase 4 (Frontend juegos): **90 min** → Captura de datos
- Fase 5 (Panel médico): **120 min** → Visualización completa

**Total:** ~5 horas de desarrollo enfocado.

---

## 🔧 Fase 1: Base de Datos (Modelos Django)

### Objetivo
Crear la estructura de datos que soporta VTR: dos tablas nuevas + modificación de una existente.

### ¿Qué se hace?
1. Abrir `core/models.py`
2. Crear modelo **`SesionTerapia`**
   - Agrupa partidas de una conexión continua
   - Campos: `paciente` (FK), `session_id` (UUID), `fecha_inicio`, `ultima_actividad`, `vas_inicial`
   - Método `duracion_minutos` (propiedad)
3. Crear modelo **`MarcaPersonalTR`**
   - Línea base personalizada por paciente/juego/nivel
   - Campos: `paciente`, `juego`, `nivel`, `TR_ideal`, `partidas_base_calculadas`, `tiempo1/2/3`
   - Constraint `unique_together = ('paciente', 'juego', 'nivel')`
4. Añadir 4 campos a **`SesionDeJuego`** (existente):
   - `sesion_terapia` (FK a SesionTerapia, nullable)
   - `tiempo_reaccion_ms` (milisegundos)
   - `degradacion_porcentaje` (%, nullable)
   - `errores_cometidos` (contador)

### Comandos a ejecutar
```bash
python manage.py makemigrations
python manage.py migrate
```

### ✅ Validación (Antes de avanzar)
- [ ] `SesionTerapia` tabla existe en SQLite (puedo verla en `python manage.py dbshell`)
- [ ] `MarcaPersonalTR` tabla existe
- [ ] `SesionDeJuego` tiene los 4 campos nuevos
- [ ] El constraint `unique_together` está aplicado (intento crear 2 MarcaPersonalTR iguales → error)
- [ ] Migraciones limpias (sin warnings)

### ⚠️ Errores comunes
- Olvidar importar `uuid` → `from django.db import models` no incluye UUID
- Copiar `SesionDeJuego` entera → **solo añadir 4 campos** al modelo existente
- Cambiar nombres de campos existentes en `SesionDeJuego` → ❌ Rollback y reescribir migración

---

## 🧠 Fase 2: Motor de Datos (Servicios)

### Objetivo
Crear la lógica clínica en `vtr_service.py`: funciones que manejan sesiones, calibración y degradación.

### ¿Qué se hace?
1. Crear archivo nuevo: `core/services/vtr_service.py`
2. Definir constantes:
   ```python
   TIMEOUT_INACTIVIDAD_MIN = 60   # Sesión expira si no hay actividad >60 min
   VENTANA_FRESCA_MIN = 10        # Solo primeros 10 min de sesión sirven para calibración
   SCORE_MINIMO_BASE = 300        # Partida debe tener ≥300 puntos para calibración
   ```
3. Implementar 4 funciones:
   - **`obtener_o_crear_sesion(paciente, vas_inicial=None)`**
     - Si última sesión activa exists y (ahora - ultima_actividad) < 60 min → devolverla
     - Si NO exists o expiró → crear nueva con `session_id=UUID()`, guardar
   - **`registrar_actividad(sesion_terapia)`**
     - Actualizar `sesion_terapia.ultima_actividad = now()` y guardar
   - **`actualizar_marca_personal(paciente, juego, nivel, tiempo_reaccion_ms, score, sesion)`**
     - Obtener/crear fila `MarcaPersonalTR(paciente, juego, nivel)`
     - Si partida está fuera ventana 10 min → RETURN
     - Si score < 300 → RETURN
     - **Si TR_ideal es None (calibración):** rellenar `tiempo1`, `tiempo2`, `tiempo3` en orden; cuando los 3 estén llenos → calcular `TR_ideal = media(t1,t2,t3)`
     - **Si TR_ideal ya calculado (post-calibración):** FIFO — `t1=t2, t2=t3, t3=nuevo_tiempo` → recalcular `TR_ideal = media(t1,t2,t3)`. Permite actualización por neuroplasticidad.
   - **`calcular_degradacion(tiempo_reaccion_ms, TR_ideal)`**
     - Función pura: devuelve `((tiempo - TR_ideal) / TR_ideal) * 100`
     - Si `TR_ideal` es None → devolver `None` (en calibración)

### ✅ Validación (Antes de avanzar)
- [ ] `python manage.py shell` → `from core.services.vtr_service import *` (sin errores)
- [ ] Prueba manual: crear 2 sesiones del mismo paciente con >60 min de diferencia → generan 2 `session_id` distintos
- [ ] Prueba manual: `actualizar_marca_personal()` con score=250 → no aprende (descarta)
- [ ] Prueba manual: 3 partidas con score≥300 en primeros 10 min → calcula `TR_ideal`
- [ ] Prueba manual: `calcular_degradacion(2500, 2000)` → devuelve `25.0`
- [ ] Prueba manual: `calcular_degradacion(1800, None)` → devuelve `None`

### ⚠️ Errores comunes
- Olvidar `from django.utils import timezone` → necesario para `timezone.now()`
- Lógica de filtro 10 min mal (comparar minutos: `(now - inicio).total_seconds() / 60`)
- No guardar tras actualizar `ultima_actividad` → `.save()`

---

## 🔌 Fase 3: API (Endpoints Django)

### Objetivo
Exponer dos endpoints REST que comunican el juego (Unity/Web) con el backend Django.

### ¿Qué se hace?
1. Abrir `core/views.py`, añadir 2 vistas:

   **Vista 1: `vtr_iniciar_sesion`**
   ```python
   @csrf_exempt  # Si lo llama Unity/juego web
   def vtr_iniciar_sesion(request):
       # POST JSON: { "vas_inicial": 3 }  (opcional)
       # Devuelve: { "estado": "ok", "session_id": "<uuid>" } + 200
       perfil = request.user.perfil
       vas = request.POST.get('vas_inicial') or request.GET.get('vas_inicial')
       sesion = obtener_o_crear_sesion(perfil, vas_inicial=vas)
       return JsonResponse({"estado": "ok", "session_id": str(sesion.session_id)})
   ```

   **Vista 2: `vtr_guardar_partida`**
   ```python
   @csrf_exempt
   def vtr_guardar_partida(request):
       # POST JSON: { "juego": "...", "nivel": 3, "puntos": 850, 
       #              "tiempo_reaccion_ms": 2450, "errores_cometidos": 2, 
       #              "tiempo_jugado": 120, "completado": true, 
       #              "dificultad_percibida": 2, "estado_animo": 4, 
       #              "session_id": "<uuid>" }
       # Devuelve: { "estado": "ok" } + 200  (SIEMPRE, sin órdenes)
       
       # 1. Parsear JSON
       # 2. obtener_o_crear_sesion(perfil, None)  # resuelve internamente
       # 3. actualizar_marca_personal(...)  # calibración si aplica
       # 4. calcular_degradacion(...)
       # 5. Crear SesionDeJuego con todos los campos (nuevos + existentes)
       # 6. registrar_actividad(sesion)
       # 7. return JsonResponse({"estado": "ok"})  # 200 SILENCIOSO
   ```

2. Registrar rutas en `config/urls.py`:
   ```python
   path('api/vtr/iniciar-sesion/', views.vtr_iniciar_sesion, name='vtr_iniciar_sesion'),
   path('api/vtr/guardar-partida/', views.vtr_guardar_partida, name='vtr_guardar_partida'),
   ```

### ✅ Validación (Antes de avanzar)
- [ ] Test con Postman/cURL: POST a `vtr_iniciar_sesion` → devuelve `session_id` válido
- [ ] Test con Postman: POST a `vtr_guardar_partida` con score=250 → `SesionDeJuego` creado, `TR_ideal` aún None
- [ ] Test: POST 3 partidas con score≥300 en <10 min → 3ª partida calcula `TR_ideal`
- [ ] Test: 4ª partida (después calibración) → `degradacion_porcentaje` tiene valor numérico
- [ ] Manejo de errores: POST sin `tiempo_reaccion_ms` → no falla (try/except), responde 200 igual
- [ ] Respuesta siempre 200, nunca contiene órdenes (ej. "no cambies de nivel")

### ⚠️ Errores comunes
- Devolver 500 si faltan campos → debería ser 200 silencioso (log el error)
- Responder `{"instruccion": "sube_nivel"}` → ❌ **NUNCA**. Juego no cambia comportamiento según respuesta
- No usar `@csrf_exempt` si lo llama desde juego embebido → CSRF token error

---

## 🎮 Fase 4: Frontend de Juegos

### Objetivo
Modificar los archivos HTML/JavaScript de los juegos para capturar y enviar datos VTR.

### ¿Qué se hace?
1. Identificar dónde están los juegos (ej. `core/templates/core/games/encuentra_la_letra.html`)

2. **Al principio de la partida:**
   - (Opcional) Mostrar pop-up VAS: "¿Cómo te sientes? 1 (muy descansado) - 10 (muy cansado)"
   - Si usuario responde → `fetch()` POST a `vtr_iniciar_sesion` con `vas_inicial`
   - Si NO responde → llamar `vtr_iniciar_sesion` con `vas_inicial=null` igual
   - Guardar `session_id` retornado en variable global o localStorage

3. **Durante la partida:**
   - Cronómetro invisible: usar `performance.now()` para medir tiempo desde que aparece ejercicio hasta que acierta
   - Contador de errores: incrementar cada vez que selecciona opción errónea
   - Guardar valores en variables locales

4. **Al terminar partida:**
   - Recopilar datos:
     ```javascript
     const datos = {
       session_id: sessionIdGuardado,
       juego: "Encuentra la Letra",
       nivel: 3,
       puntos: puntosObtenidos,
       tiempo_reaccion_ms: tiempoMedido,
       errores_cometidos: errores,
       tiempo_jugado: tiempoTotalPartida,
       completado: true,
       dificultad_percibida: 3,  // O preguntarlo al final
       estado_animo: 4            // O preguntarlo al final
     };
     ```
   - `fetch()` POST a `vtr_guardar_partida` con esos datos
   - **Ignorar respuesta** → el juego no cambia su comportamiento
   - Permitir siguiente partida inmediatamente

### ✅ Validación (Antes de avanzar)
- [ ] Abro juego en navegador → VAS pop-up aparece (si implementado)
- [ ] Juego mide tiempo de reacción: acierto rápido → tiempo_reaccion_ms < 500ms (realista)
- [ ] POST llega a Django: `SesionDeJuego` se crea con todos los campos
- [ ] `tiempo_reaccion_ms` se guarda correctamente
- [ ] `errores_cometidos` suma correctamente
- [ ] 3 partidas seguidas → `MarcaPersonalTR.TR_ideal` se calcula
- [ ] 4ª partida → `SesionDeJuego.degradacion_porcentaje` tiene valor

### ⚠️ Errores comunes
- `performance.now()` usado incorrectamente (tiempos negativos) → restar siempre: `now - inicio`
- Olvidar parar cronómetro al acertar → sigue midiendo
- No ignorar respuesta del servidor → juego espera instrucción (no la hay, cuelga)
- `errores_cometidos` cuenta cada intento, incluso los correctos → solo incrementar en fallos

---

## 📊 Fase 5: Panel del Médico (Vistas + Gráficas)

### Objetivo
Crear interfaz de clinician: listar sesiones, ver gráficas de degradación y errores, interpretar datos.

### ¿Qué se hace?
1. **Vista 1: Listado de Sesiones** (`lista_sesiones_terapia`)
   - Ruta: `medico/paciente/<int:pk>/sesiones/`
   - Query: `SesionTerapia.objects.filter(paciente=perfil_paciente)`
   - Template: tabla con columnas:
     - Fecha/hora inicio
     - Duración (minutos)
     - VAS inicial (o "No declarado")
     - Nº de partidas
     - Botón "Ver gráfica"

2. **Vista 2: Detalle de Sesión** (`detalle_sesion_terapia`)
   - Ruta: `medico/sesion/<uuid:session_id>/`
   - Query: `SesionDeJuego.objects.filter(sesion_terapia__session_id=session_id)`
   - Construir datos JSON para Chart.js:
     ```json
     {
       "labels": [1, 2, 3, 4, 5, 6],
       "degradacion": [null, null, null, 5.0, 12.0, 25.0],
       "errores": [0, 1, 0, 1, 2, 3],
       "vas_inicial": 3,
       "duracion_min": 25,
       "juegos": ["Encuentra la Letra", "Calculadora"]
     }
     ```

3. **Gráfica Chart.js** (en template):
   - Tipo: `line` con doble eje Y
   - Eje Y izquierdo: % degradación (línea)
   - Eje Y derecho: nº errores (barras o segunda línea)
   - Eje X: índice de partida (1, 2, 3, ...)
   - **Zona de calibración:** donde `degradacion` es `null` → sombreado gris + etiqueta "Calibrando"
   - Cabecera: muestra VAS, duración, juegos

4. **Tabla drill-down** (opcional pero recomendado):
   - Bajo la gráfica: fila por partida con datos crudos
   - Columnas: juego, nivel, puntos, `tiempo_reaccion_ms`, `errores_cometidos`, `degradacion_porcentaje`

5. **Enlace en detalle paciente:**
   - Añadir botón "Ver Sesiones de Terapia" en `detalle_paciente.html`

### ✅ Validación (Antes de avanzar)
- [ ] Accedo como médico a `/medico/paciente/1/sesiones/` → listado de sesiones aparece
- [ ] Clico "Ver gráfica" → gráfica Chart.js se carga
- [ ] Primeras 3 partidas: `degradacion` es `null` (calibración), se ve sombreado gris
- [ ] Partida 4+: `degradacion` tiene valor numérico, punto visible
- [ ] Línea roja de umbral **NO aparece** ✅ (fue eliminada)
- [ ] Pop-ups de "Fatiga detectada" **NO aparecen** ✅
- [ ] Tabla drill-down muestra datos crudos correctamente
- [ ] Zoom/pan con Chart.js funciona

### ⚠️ Errores comunes
- Olvidar `spanGaps: false` en Chart.js → calibración no se ve como hueco
- Línea roja de umbral 25% dibujada → ❌ **ELIMINAR**
- Puntos coloreados según `modo_asistido` → ❌ **NO EXISTE ese campo**
- Panel médico solo para `es_medico=True` pero sin verificación → acceso sin permiso

---

## 🎯 Resumen Ejecutivo

| Fase | Ficheros | Tiempo | Validación |
|------|----------|--------|-----------|
| **1: Modelos** | `core/models.py` | 30 min | BD creada, migraciones limpias |
| **2: Servicios** | `core/services/vtr_service.py` | 45 min | Tests manuales (timeout, calibración, degradación) |
| **3: API** | `core/views.py` + `config/urls.py` | 60 min | Postman tests (iniciar, guardar, 3 partidas) |
| **4: Frontend** | `core/templates/core/games/*.html` | 90 min | Juego captura datos, POST llega correcto |
| **5: Panel** | `core/views.py` + templates + Chart.js | 120 min | Gráfica sin umbrales, calibración visible |

---

## ⚡ Regla de Oro

**No pasar a la siguiente fase hasta validar completamente la actual.**

Si descubrimos un error en Fase 3, es fácil revertir `views.py`.  
Si lo descubrimos en Fase 5, toca reescribir la gráfica.

**Pequeños pasos → Seguridad → Éxito.** ✅

---

*Documento de guía incremental. Consultar PLAN_VTR.md para detalles técnicos de cada sección.*
