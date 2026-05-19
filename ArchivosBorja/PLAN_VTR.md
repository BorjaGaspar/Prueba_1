# PLAN_VTR.md — Sistema VTR Simplificado (Data Logger + Dashboard Médico)

**Versión:** 1.0 (Simplificada)
**Fecha:** 18 de Mayo de 2026
**Basado en:** VTR_V2.md (filtrado)
**Destinatario:** Desarrollador Junior — hoja de ruta paso a paso

---

## 0. Resumen del Pivote de Diseño

El sistema original (VTR_V2) era un sistema de **intervención clínica activa**: detectaba fatiga en tiempo real, bloqueaba niveles, reducía dificultad y mostraba pop-ups al paciente.

Este nuevo diseño lo simplifica a un sistema **pasivo de recolección de datos + visualización** (Data Logger + Dashboard Médico). El sistema **observa y registra**, pero **nunca interviene**. Toda la inteligencia clínica pasa al médico, que interpreta las gráficas.

### ✅ LO QUE SE MANTIENE

| Componente | Función |
|---|---|
| **SesionTerapia** | Agrupar partidas por timeout de inactividad (60 min). |
| **Bioseñales en crudo** | Registrar `tiempo_reaccion_ms` y `errores_cometidos` por partida. |
| **Escala VAS (opcional)** | Pop-up inicial de cansancio (1–10) guardado en `vas_inicial`, **solo informativo**. |
| **Panel del Médico** | Listado de sesiones + gráficas cruzadas (TR vs Errores). |
| **Marca Personal (TR_ideal)** | Línea base simple para poder pintar la gráfica de diferencias (%). |

### ❌ LO QUE SE ELIMINA

| Componente eliminado | Motivo |
|---|---|
| **Regla de los 3 Strikes** | Lógica de detección de fatiga eliminada. |
| **Umbrales dinámicos según VAS** | El VAS ya no modifica ningún umbral; es solo un dato. |
| **Bloqueos de nivel / Estado Refractario** | El sistema ya no bloquea ni congela niveles. |
| **Step-Down Cognitivo** | Sin reducción de variables distractoras ni flag `modo_asistido`. |
| **Pop-ups de intervención** | Sin avisos empáticos ni redirecciones a mindfulness/ejercicio. |

**Consecuencia directa en el modelo de datos:** se eliminan los campos `strikes_actuales`, `fatiga_confirmada` (de `SesionTerapia`) y `modo_asistido` (de `SesionDeJuego`).

---

## 1. Modelos de Base de Datos (Django)

> Ubicación: `core/models.py`
> Las 3 tablas: **SesionTerapia** (nueva), **MarcaPersonalTR** (nueva), **SesionDeJuego** (existente — se le añaden campos).

### 1.1. Tabla `SesionTerapia` (NUEVA)

Caja contenedora. Agrupa todas las partidas de una conexión continua del paciente.

```python
import uuid

class SesionTerapia(models.Model):
    paciente = models.ForeignKey(
        PerfilPaciente,
        on_delete=models.CASCADE,
        related_name='sesiones_terapia'
    )
    session_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    fecha_inicio = models.DateTimeField(default=timezone.now)
    ultima_actividad = models.DateTimeField(default=timezone.now)

    # VAS: SOLO INFORMATIVO. No modifica ningún umbral ni lógica.
    # null=True porque es opcional (el paciente puede no rellenarlo).
    vas_inicial = models.IntegerField(null=True, blank=True, verbose_name="Cansancio inicial (1-10)")

    class Meta:
        ordering = ['-fecha_inicio']  # Más reciente primero

    def __str__(self):
        return f"Sesión {str(self.session_id)[:8]} - {self.paciente.usuario.username} - {self.fecha_inicio.strftime('%d/%m/%Y %H:%M')}"

    @property
    def duracion_minutos(self):
        """Duración total de la sesión en minutos (para el panel médico)."""
        delta = self.ultima_actividad - self.fecha_inicio
        return round(delta.total_seconds() / 60)
```

> ⚠️ **CAMPOS ELIMINADOS respecto a VTR_V2:** `strikes_actuales`, `fatiga_confirmada`. NO los incluyas.

### 1.2. Tabla `MarcaPersonalTR` (NUEVA)

Línea base personalizada. Una única fila por combinación `paciente + juego + nivel`.

```python
class MarcaPersonalTR(models.Model):
    paciente = models.ForeignKey(
        PerfilPaciente,
        on_delete=models.CASCADE,
        related_name='marcas_tr'
    )
    juego = models.CharField(max_length=100)
    nivel = models.IntegerField()

    # TR ideal en milisegundos. null mientras está en calibración.
    TR_ideal = models.IntegerField(null=True, blank=True, verbose_name="TR Ideal (ms)")

    # Cuántas partidas frescas válidas (score >= 300) se han usado.
    # Cuando llega a 3, se calcula TR_ideal y se dejan de necesitar tiempos.
    partidas_base_calculadas = models.IntegerField(default=0)

    # Acumuladores temporales para las 3 primeras partidas de calibración.
    # Se rellenan en orden y, cuando el 3º está completo, se calcula la media.
    tiempo1 = models.IntegerField(null=True, blank=True)
    tiempo2 = models.IntegerField(null=True, blank=True)
    tiempo3 = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ('paciente', 'juego', 'nivel')

    def __str__(self):
        estado = f"{self.TR_ideal}ms" if self.TR_ideal else "CALIBRANDO"
        return f"{self.paciente.usuario.username} | {self.juego} N{self.nivel} | {estado}"
```

### 1.3. Tabla `SesionDeJuego` (EXISTENTE — añadir campos)

> ⚠️ Esta tabla **ya existe** en `core/models.py`. NO la reescribas entera. Solo **añade** los 4 campos siguientes a la clase existente.

Campos actuales (referencia, NO tocar): `paciente`, `juego`, `fecha`, `puntos`, `nivel_jugado`, `tiempo_jugado`, `completado`, `dificultad_percibida`, `estado_animo`, `detalles`.

**Campos NUEVOS a añadir:**

```python
    # --- CAMPOS VTR (Data Logger) ---
    sesion_terapia = models.ForeignKey(
        'SesionTerapia',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='partidas'
    )
    tiempo_reaccion_ms = models.IntegerField(null=True, blank=True, verbose_name="Tiempo de Reacción (ms)")
    degradacion_porcentaje = models.FloatField(null=True, blank=True, verbose_name="Degradación vs TR Ideal (%)")
    errores_cometidos = models.IntegerField(default=0, verbose_name="Errores en la partida")
```

> ⚠️ **CAMPO ELIMINADO respecto a VTR_V2:** `modo_asistido`. NO lo añadas (no hay Step-Down).

### 1.4. Migraciones

Tras escribir los modelos:

```bash
python manage.py makemigrations
python manage.py migrate
```

**Supervisión:** Verificar que la migración crea `SesionTerapia` y `MarcaPersonalTR`, y que añade exactamente 4 columnas a `SesionDeJuego`. Confirmar que `unique_together` de `MarcaPersonalTR` se aplicó.

---

## 2. Lógica de Backend (services.py / utils.py)

> Ubicación recomendada: **`core/services/vtr_service.py`** (nuevo archivo, junto al ya existente `core/services/ml_service.py`).
> La lógica clínica NO debe ensuciar `views.py`.

Constante global del módulo:

```python
TIMEOUT_INACTIVIDAD_MIN = 60   # Minutos para cerrar sesión por inactividad
VENTANA_FRESCA_MIN = 10        # Minutos de ventana fresca para calcular TR_ideal
SCORE_MINIMO_BASE = 300        # Puntuación mínima para que una partida cuente en la línea base
```

### 2.1. `obtener_o_crear_sesion(paciente, vas_inicial=None)`

**Responsabilidad:** devolver la sesión activa del paciente, o crear una nueva si la anterior expiró por inactividad (>60 min).

**Pseudocódigo:**

```
1. Buscar la última SesionTerapia del paciente (ordenada por -fecha_inicio).
2. SI existe Y (ahora - ultima_actividad) < 60 min:
       → Es la sesión activa. Devolverla tal cual.
3. SI NO existe O ha expirado:
       → Crear nueva SesionTerapia:
           - session_id = uuid automático
           - fecha_inicio = ahora
           - ultima_actividad = ahora
           - vas_inicial = vas_inicial recibido (puede ser None → se guarda null)
       → Devolver la nueva sesión.
```

> Nota: el VAS solo se guarda al **crear** la sesión. No vuelve a pedirse ni se usa para cálculos.

### 2.2. `registrar_actividad(sesion_terapia)`

**Responsabilidad:** actualizar `ultima_actividad = timezone.now()` y guardar. Se llama al final de cada partida para mantener viva la sesión.

### 2.3. `actualizar_marca_personal(paciente, juego, nivel, tiempo_reaccion_ms, score, sesion_terapia)`

**Responsabilidad:** mantener una media móvil FIFO de 3 tiempos frescos y válidos. Permite que el `TR_ideal` se actualice por neuroplasticidad (el paciente mejora con el tiempo).

**Pseudocódigo:**

```
1. Obtener (o crear) la fila MarcaPersonalTR para (paciente, juego, nivel).
2. Comprobar si la partida es "fresca":
       minutos_desde_inicio = (ahora - sesion_terapia.fecha_inicio) en minutos
       SI minutos_desde_inicio > 10 (VENTANA_FRESCA_MIN):
           → Fuera de ventana fresca. No aprende. RETURN.
3. Filtro de calidad:
       SI score < 300 (SCORE_MINIMO_BASE):
           → Partida no representativa. Se descarta. RETURN.
4. SI TR_ideal es None (fase de calibración):
       Acumular en el primer slot libre:
           SI tiempo1 es None: tiempo1 = tiempo_reaccion_ms
           elif tiempo2 es None: tiempo2 = tiempo_reaccion_ms
           elif tiempo3 es None: tiempo3 = tiempo_reaccion_ms
       partidas_base_calculadas += 1
       SI tiempo1/2/3 todos rellenos:
           TR_ideal = round((tiempo1 + tiempo2 + tiempo3) / 3)
5. SI TR_ideal ya está calculado (post-calibración):
       → Ventana deslizante FIFO: descarta el más antiguo, entra el nuevo
           tiempo1 = tiempo2
           tiempo2 = tiempo3
           tiempo3 = tiempo_reaccion_ms
       partidas_base_calculadas += 1
       TR_ideal = round((tiempo1 + tiempo2 + tiempo3) / 3)  ← se recalcula
6. Guardar la fila.
```

> **Media móvil:** `TR_ideal` nunca queda congelado. Cada nueva partida fresca y válida (score ≥ 300, primeros 10 min de sesión) actualiza la ventana deslizante. Esto permite que si el paciente mejora por neuroplasticidad, su línea base baje automáticamente, haciendo las gráficas de degradación cada vez más precisas.

### 2.4. `calcular_degradacion(tiempo_reaccion_ms, TR_ideal)`

**Responsabilidad:** función pura. Devuelve el % de degradación para pintar la gráfica.

```
SI TR_ideal es None o 0:
    → return None   (estamos en calibración, no se pinta punto)
degradacion = ((tiempo_reaccion_ms - TR_ideal) / TR_ideal) * 100
return round(degradacion, 1)
```

Ejemplo: `TR_ideal=2000ms`, partida actual `2500ms` → `((2500-2000)/2000)*100 = 25.0`.

**Supervisión Fase 2:** Probar `obtener_o_crear_sesion()` simulando inactividad >60 min (debe generar nuevo `session_id`). Probar `actualizar_marca_personal()` con score < 300 (debe descartar) y con 3 partidas frescas válidas (debe fijar `TR_ideal`). Probar `calcular_degradacion()` con `TR_ideal=None` (debe devolver `None`).

---

## 3. API Endpoints (views.py)

> Ubicación: `core/views.py` + rutas en `config/urls.py`.
> **Filosofía clave:** el backend responde **siempre en silencio** (`200 OK`). NUNCA devuelve órdenes de intervención. El juego no cambia su comportamiento según la respuesta.

### 3.1. Endpoint de Inicio de Sesión

**Ruta sugerida:** `path('api/vtr/iniciar-sesion/', views.vtr_iniciar_sesion, name='vtr_iniciar_sesion')`

| Aspecto | Detalle |
|---|---|
| **Método** | POST |
| **Auth** | `@login_required` (o `@csrf_exempt` si lo llama Unity, igual que `guardar_progreso`) |
| **Recibe (JSON)** | `{ "vas_inicial": 3 }` (opcional; puede no venir) |
| **Hace** | Llama a `obtener_o_crear_sesion(perfil, vas_inicial)` |
| **Devuelve** | `{ "estado": "ok", "session_id": "<uuid>" }` con status 200 |

> El frontend guarda el `session_id` devuelto y lo adjunta en cada partida posterior. (Alternativa: que el backend resuelva la sesión activa internamente en cada partida y el frontend no maneje el `session_id`. Elegir UNA estrategia y documentarla.)

### 3.2. Endpoint de Registro de Partida

**Ruta sugerida:** `path('api/vtr/guardar-partida/', views.vtr_guardar_partida, name='vtr_guardar_partida')`

| Aspecto | Detalle |
|---|---|
| **Método** | POST |
| **Auth** | `@csrf_exempt` (coherente con el `guardar_progreso` actual que usan los juegos) |
| **Recibe (JSON)** | Ver tabla de campos abajo |
| **Hace** | Ver flujo abajo |
| **Devuelve** | `{ "estado": "ok" }` con status 200 — **SIEMPRE, en silencio** |

**Datos que recibe del juego (Unity/Web):**

```json
{
  "session_id": "uuid-opcional-segun-estrategia",
  "juego": "Encuentra la Letra",
  "nivel": 3,
  "puntos": 850,
  "tiempo_reaccion_ms": 2450,
  "errores_cometidos": 2,
  "tiempo_jugado": 120,
  "completado": true,
  "dificultad_percibida": 2,
  "estado_animo": 4
}
```

**Flujo interno del endpoint:**

```
1. Parsear JSON. Obtener perfil del paciente (request.user.perfil).
2. sesion = obtener_o_crear_sesion(perfil)   # resuelve/crea la sesión activa
3. actualizar_marca_personal(perfil, juego, nivel, tiempo_reaccion_ms, puntos, sesion)
4. marca = MarcaPersonalTR para (perfil, juego, nivel)
   degradacion = calcular_degradacion(tiempo_reaccion_ms, marca.TR_ideal)  # puede ser None
5. Crear SesionDeJuego:
       - paciente, juego, nivel_jugado, puntos, tiempo_jugado, completado
       - dificultad_percibida, estado_animo  (campos ya existentes)
       - sesion_terapia = sesion
       - tiempo_reaccion_ms = tiempo_reaccion_ms
       - errores_cometidos = errores_cometidos
       - degradacion_porcentaje = degradacion
6. registrar_actividad(sesion)   # actualiza ultima_actividad
7. return JsonResponse({"estado": "ok"})   # 200, SIEMPRE
```

> ⚠️ **NO HAY** respuesta `"cambio_tarea_recomendado"`. **NO HAY** lógica de strikes. **NO HAY** Step-Down. El endpoint solo registra y responde OK.

> 🔁 **Compatibilidad:** el endpoint actual `guardar_progreso` (`/api/guardar-progreso/`) puede seguir existiendo para los juegos antiguos. Este nuevo endpoint es aditivo. El DDA existente (`evaluar_ajuste_dinamico`) **no se toca** en este plan.

**Supervisión Fase 3:** Confirmar que el endpoint maneja errores sin pantallazos de Django (try/except → `JsonResponse` con status 200 o 500 controlado). Verificar que una partida sin `session_id` igual se asocia a una sesión válida. Verificar que `degradacion_porcentaje` queda `null` durante la calibración.

---

## 4. Panel del Médico (views.py + Chart.js)

> Ubicación vistas: `core/views.py`. Templates: `core/templates/core/patients/`.
> Ya existe `analisis_paciente.html` (estadística general). Aquí añadimos una **vista por sesión de terapia**.

### 4.1. Decisión de UX (recomendada)

Crear un **nuevo apartado de estadísticas por sesión de terapia**, además del general ya existente:

1. **Listado de Sesiones** (nuevo) → lista de `SesionTerapia` del paciente.
2. **Detalle de Sesión** (nuevo) → gráfica cruzada de esa sesión concreta.

> Justificación: la estadística general mezcla todas las partidas históricas. La vista por sesión permite al médico ver la evolución **dentro de una conexión continua** (ej. cómo se degrada el TR a lo largo de 25 min), que es el valor clínico real del VTR.

### 4.2. Vista: Listado de Sesiones

**Ruta sugerida:** `path('medico/paciente/<int:pk>/sesiones/', views.lista_sesiones_terapia, name='lista_sesiones_terapia')`

| Aspecto | Detalle |
|---|---|
| **Auth** | `@login_required` + verificar `perfil.es_medico` |
| **Query** | `SesionTerapia.objects.filter(paciente=perfil_paciente)` (ya ordenado por `-fecha_inicio`) |
| **Muestra por fila** | Fecha/hora inicio · `duracion_minutos` · `vas_inicial` (o "No declarado") · nº de partidas (`sesion.partidas.count()`) · botón "Ver detalle" |

Template nuevo: `core/templates/core/patients/lista_sesiones_terapia.html`.

### 4.3. Vista: Detalle de Sesión (gráfica)

**Ruta sugerida:** `path('medico/sesion/<uuid:session_id>/', views.detalle_sesion_terapia, name='detalle_sesion_terapia')`

| Aspecto | Detalle |
|---|---|
| **Auth** | `@login_required` + verificar `perfil.es_medico` |
| **Query** | `partidas = SesionDeJuego.objects.filter(sesion_terapia__session_id=session_id).order_by('fecha')` |
| **Construye** | Listas JSON para Chart.js: labels (índice de partida o minuto), degradación %, errores |
| **Pasa al template** | `datos_grafica_json` vía `json.dumps(...)` (mismo patrón que `analisis_paciente`) |

**Estructura JSON sugerida para el template:**

```json
{
  "labels": [1, 2, 3, 4, 5, 6],
  "degradacion": [null, null, null, 5.0, 12.0, 25.0],
  "errores":     [0, 1, 0, 1, 2, 3],
  "vas_inicial": 3,
  "duracion_min": 25,
  "juegos": ["Encuentra la Letra", "Calculadora"]
}
```

> Los primeros puntos de `degradacion` son `null` → corresponden a la fase de calibración (aún no había `TR_ideal`). Chart.js dejará un hueco (línea rota) en esa zona.

### 4.4. Gráfica Chart.js (en el template)

| Elemento | Configuración |
|---|---|
| **Tipo** | `line` con doble eje Y |
| **Eje Y izquierdo** | % degradación TR (`degradacion`). Línea continua. `spanGaps: false` para que la calibración se vea como hueco. |
| **Eje Y derecho** | Nº de errores (`errores`). Puede ser barras o segunda línea. |
| **Eje X** | Índice de partida (o minuto de sesión). |
| **Cabecera** | Mostrar texto: `VAS declarado: 3 · Duración: 25 min · Juegos: Encuentra la Letra, Calculadora`. |
| **Zona de calibración** | Donde `degradacion` es `null`: caja sombreada gris con rayas y etiqueta *"Fase de Calibración: recopilando datos base"* (usar plugin de anotación o un dataset de fondo). |

> ⚠️ **ELIMINADO respecto a VTR_V2:** NO hay línea roja de umbral (no hay umbrales). NO hay puntos con formato distinto por `modo_asistido` (no existe). NO hay log de "Strike 3 / Fatiga confirmada". La gráfica es puramente descriptiva.

### 4.5. Drill-down (opcional, recomendado)

Tabla bajo la gráfica con una fila por partida: juego, nivel, puntos, `tiempo_reaccion_ms`, `errores_cometidos`, `degradacion_porcentaje`. Permite al médico inspeccionar el dato crudo.

**Supervisión Fase 5:** Verificar que la zona de calibración se dibuja sombreada y sin puntos. Confirmar que la gráfica no se rompe al cambiar de nivel entre partidas (el eje Y es % relativo, no ms brutos, así que es comparable). Confirmar que el VAS se muestra como informativo y no afecta a ninguna línea.

---

## 5. Fases de Implementación (orden estricto)

> **Regla de oro:** programar y validar cada fase antes de pasar a la siguiente.

### Fase 1 — Base de Datos (`core/models.py`)
- [ ] Crear modelo `SesionTerapia` (con `vas_inicial`, SIN `strikes_actuales` ni `fatiga_confirmada`).
- [ ] Crear modelo `MarcaPersonalTR` (con `tiempo1/2/3`, `unique_together`).
- [ ] Añadir a `SesionDeJuego` los 4 campos: `sesion_terapia`, `tiempo_reaccion_ms`, `degradacion_porcentaje`, `errores_cometidos` (SIN `modo_asistido`).
- [ ] `makemigrations` + `migrate`.
- [ ] (Opcional) Registrar las 2 nuevas tablas en `core/admin.py` para inspección.
- **Validar:** las tablas existen, migración limpia, `unique_together` aplicado.

### Fase 2 — Motor de Datos (`core/services/vtr_service.py`)
- [ ] Crear archivo nuevo `vtr_service.py` con las constantes.
- [ ] `obtener_o_crear_sesion(paciente, vas_inicial=None)`.
- [ ] `registrar_actividad(sesion_terapia)`.
- [ ] `actualizar_marca_personal(...)` (filtro 10 min + score ≥ 300 + 3 tiempos → TR_ideal fijo).
- [ ] `calcular_degradacion(tr_actual, TR_ideal)` (devuelve `None` en calibración).
- **Validar:** tests manuales de timeout, calibración y degradación.

### Fase 3 — API (`core/views.py` + `config/urls.py`)
- [ ] Vista `vtr_iniciar_sesion` (recibe VAS opcional, devuelve `session_id`).
- [ ] Vista `vtr_guardar_partida` (registra partida, responde `{"estado":"ok"}` 200 silencioso).
- [ ] Añadir las 2 rutas en `config/urls.py`.
- [ ] Manejo de errores robusto (sin pantallazos de Django).
- **Validar:** Postman/cURL — partida fresca, partida con score bajo, partida fuera de ventana.

### Fase 4 — Frontend de los Juegos (JavaScript en los `.html` de juegos)
- [ ] (Opcional) Pop-up VAS al pulsar "Empezar Sesión" → POST a `vtr_iniciar_sesion`.
- [ ] Cronómetro invisible con `performance.now()`: arranca al mostrar ejercicio, para al acertar.
- [ ] Contador de `errores_cometidos`.
- [ ] `fetch()` POST a `vtr_guardar-partida` con todos los campos.
- [ ] Ignorar la respuesta (siempre `ok`). El juego **no cambia** según la respuesta.
- **Validar:** los datos llegan correctamente y se guardan en `SesionDeJuego`.

### Fase 5 — Panel del Médico (`core/views.py` + templates + Chart.js)
- [ ] Vista + template `lista_sesiones_terapia.html`.
- [ ] Vista + template `detalle_sesion_terapia.html` con gráfica Chart.js doble eje.
- [ ] Zona de calibración sombreada (puntos `null`).
- [ ] Cabecera con VAS informativo + duración + juegos.
- [ ] (Opcional) Tabla drill-down por partida.
- [ ] Añadir enlace a "Sesiones de Terapia" desde `detalle_paciente.html`.
- **Validar:** gráfica correcta, sin umbrales, sin puntos asistidos, calibración visible.

---

## 6. Checklist de "NO HACER" (recordatorio anti-deriva)

Al programar, NO implementes nada de esto (fue eliminado a propósito):

- ❌ Contador de strikes / regla de los 3 strikes.
- ❌ Campos `strikes_actuales`, `fatiga_confirmada`, `modo_asistido`.
- ❌ Umbral 25% / 15% según VAS (el VAS NO modifica nada).
- ❌ Bloqueo de subida/bajada de nivel.
- ❌ Estado Refractario.
- ❌ Step-Down cognitivo / reducción de variable distractora.
- ❌ Pop-ups empáticos, redirección a mindfulness o ejercicio físico.
- ❌ Respuesta del API tipo `"cambio_tarea_recomendado"`.
- ❌ Línea roja de umbral o líneas punteadas de "asistido" en la gráfica.

El sistema **observa y registra**. El médico **interpreta**. El sistema **nunca interviene**.

---

*Documento generado a partir de VTR_V2.md aplicando el filtro de simplificación (Data Logger + Dashboard pasivo). No se ha modificado ningún archivo de código fuente.*
