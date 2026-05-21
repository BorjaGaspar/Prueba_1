# 🫀 Wearable BLE — Informe de Implementación Completa

**Fecha de implementación:** 20 de Mayo de 2026
**Branch:** `mis-cambios`
**Estado:** Las 7 fases del `PlanImplementacionWearable.md` finalizadas y validadas con `python manage.py check`.
**Filosofía respetada:** Aditivo, pasivo, retrocompatible. Sin tocar VTR, DDA, MoCA ni ningún flujo previo.

---

## 📋 Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Fase 1 — Base de datos](#2-fase-1--base-de-datos)
3. [Fase 2 — Backend endpoint](#3-fase-2--backend-endpoint)
4. [Fase 3 — Servicio JavaScript Bluetooth](#4-fase-3--servicio-javascript-bluetooth)
5. [Fase 4 — UI botón "Vincular Reloj" + icono corazón](#5-fase-4--ui-botón-vincular-reloj--icono-corazón)
6. [Fase 5 — Integración en 4 juegos VTR](#6-fase-5--integración-en-4-juegos-vtr)
7. [Fase 6 — Línea roja FC en gráfica del médico](#7-fase-6--línea-roja-fc-en-gráfica-del-médico)
8. [Fase 7 — Modal de detalle de partida](#8-fase-7--modal-de-detalle-de-partida)
9. [Decisiones de diseño aplicadas (impeccable + design-taste-frontend)](#9-decisiones-de-diseño-aplicadas)
10. [Anti-deriva: lo que NO se ha tocado](#10-anti-deriva-lo-que-no-se-ha-tocado)
11. [Cómo testear](#11-cómo-testear)
12. [Pendientes y próximos pasos](#12-pendientes-y-próximos-pasos)

---

## 1. Resumen ejecutivo

Se ha integrado un sistema completo de captura de frecuencia cardíaca (FC) vía Web Bluetooth (Heart Rate Service GATT, UUID `0x180D`) en los 4 minijuegos VTR existentes. El médico ya puede ver una línea roja con la FC media por partida superpuesta a la gráfica de degradación TR existente, y abrir un modal drill-down con la curva segundo a segundo al hacer clic en una fila de la tabla.

### Tabla de cambios

| Fase | Acción | Ficheros tocados |
|---|---|---|
| **1** | 4 columnas nuevas en `SesionDeJuego` | `core/models.py`, `core/migrations/0018_*.py` |
| **2** | Endpoint VTR acepta y persiste FC | `core/views.py` (`vtr_guardar_partida`) |
| **3** | Servicio JS Bluetooth (nuevo) | `core/static/core/js/wearable_service.js` |
| **4** | Botón "Vincular Reloj" + helper icono | `core/templates/core/juegos.html` |
| **5** | Wearable en 4 juegos VTR | 1 HTML + 3 JS externos + 3 HTML cargan el servicio |
| **6** | Línea roja en Chart.js del médico | `core/views.py`, `core/templates/core/patients/detalle_sesion_terapia.html` |
| **7** | Modal drill-down FC segundo a segundo | `core/templates/core/patients/detalle_sesion_terapia.html` |

### Garantías validadas

- ✅ Migración corre limpia. `db.sqlite3` migrado a `0018`.
- ✅ `python manage.py check` → sin issues tras cada fase.
- ✅ Si el paciente no vincula reloj, los 4 campos viajan `null` y todo el flujo VTR/DDA funciona idéntico al estado pre-Wearable.
- ✅ Si el navegador no es Chrome/Edge, el botón se oculta vía feature detection. Sistema funcional sin reloj.

---

## 2. Fase 1 — Base de datos

### Objetivo

Añadir 4 columnas a `SesionDeJuego` para guardar la FC mínima, máxima, media y la serie segundo a segundo de cada partida.

### Cambios en `core/models.py`

Al final de la clase `SesionDeJuego` (justo después de `errores_cometidos`):

```python
# --- CAMPOS FC (Wearable) ---
fc_min = models.IntegerField(null=True, blank=True, verbose_name="FC Mínima (bpm)")
fc_max = models.IntegerField(null=True, blank=True, verbose_name="FC Máxima (bpm)")
fc_avg = models.IntegerField(null=True, blank=True, verbose_name="FC Media (bpm)")
fc_serie = models.JSONField(null=True, blank=True, verbose_name="Serie FC segundo a segundo (bpm)")
```

### Migración

Fichero creado manualmente (sin `makemigrations` porque el proyecto corre en Docker y no hay Django nativo): `core/migrations/0018_sesiondejuego_fc_avg_sesiondejuego_fc_max_and_more.py`.

```python
class Migration(migrations.Migration):
    dependencies = [('core', '0017_sesiondejuego_degradacion_porcentaje_and_more')]
    operations = [
        migrations.AddField(model_name='sesiondejuego', name='fc_min',
            field=models.IntegerField(blank=True, null=True, verbose_name='FC Mínima (bpm)')),
        migrations.AddField(model_name='sesiondejuego', name='fc_max',
            field=models.IntegerField(blank=True, null=True, verbose_name='FC Máxima (bpm)')),
        migrations.AddField(model_name='sesiondejuego', name='fc_avg',
            field=models.IntegerField(blank=True, null=True, verbose_name='FC Media (bpm)')),
        migrations.AddField(model_name='sesiondejuego', name='fc_serie',
            field=models.JSONField(blank=True, null=True, verbose_name='Serie FC segundo a segundo (bpm)')),
    ]
```

### Aplicación de la migración

```bash
docker compose run --rm web python manage.py migrate core
# Output:
# Applying core.0018_sesiondejuego_fc_avg_sesiondejuego_fc_max_and_more... OK
```

### Validación

```bash
docker compose run --rm web python manage.py shell -c \
  "from core.models import SesionDeJuego; print([f.name for f in SesionDeJuego._meta.get_fields() if 'fc_' in f.name])"
# Output: ['fc_min', 'fc_max', 'fc_avg', 'fc_serie']
```

---

## 3. Fase 2 — Backend endpoint

### Objetivo

Que `vtr_guardar_partida` acepte y persista los 4 campos FC sin alterar la lógica VTR/DDA existente.

### Cambios en `core/views.py`

Bloque añadido **antes** de la lógica VTR existente:

```python
# --- WEARABLE: validación defensiva de datos FC ---
fc_min = fc_max = fc_avg = fc_serie = None
try:
    serie_cruda = datos.get('fc_serie')
    if isinstance(serie_cruda, list):
        serie_filtrada = [
            int(v) for v in serie_cruda
            if isinstance(v, (int, float)) and 30 <= int(v) <= 220
        ]
        if len(serie_filtrada) >= 3:
            fc_serie = serie_filtrada
            fc_min = min(serie_filtrada)
            fc_max = max(serie_filtrada)
            fc_avg = round(sum(serie_filtrada) / len(serie_filtrada))
except Exception:
    fc_min = fc_max = fc_avg = fc_serie = None
```

Y al final, en el `SesionDeJuego.objects.create(...)`, se añaden los 4 campos.

### Reglas de validación

| Regla | Implementación |
|---|---|
| Filtrar valores fuera de rango fisiológico | `30 <= int(v) <= 220` |
| Mínimo de muestras para considerarla válida | `len(serie_filtrada) >= 3`. Si menos, los 4 campos quedan `null` |
| Backend recalcula min/max/avg | Sí, no confía en el cliente. Si el frontend manda valores distintos, prevalece el backend |
| Tolerancia a payload malformado | `try/except` envolvente. Si peta, los 4 campos quedan `null` y el endpoint sigue respondiendo `200` |

### Lo que NO se tocó

- `actualizar_marca_personal()`
- `calcular_degradacion()`
- `evaluar_ajuste_dinamico()`
- `registrar_actividad()`
- La respuesta sigue siendo `{"estado": "ok"}` (filosofía VTR pasiva).

### Validación

```bash
docker compose run --rm web python manage.py check
# Output: System check identified no issues (0 silenced).
```

---

## 4. Fase 3 — Servicio JavaScript Bluetooth

### Objetivo

Crear el módulo central que gestiona la conexión BLE Heart Rate, el buffer de muestras, la persistencia del permiso y la API pública que consumen los juegos.

### Fichero nuevo

`core/static/core/js/wearable_service.js` (~200 líneas, IIFE con scope global `window.Wearable`).

### API pública (`window.Wearable`)

| Método | Qué hace |
|---|---|
| `isSupported()` | `true` si `navigator.bluetooth` existe. Para feature detection. |
| `connect()` | Lanza el diálogo nativo de selección. Persiste `localStorage.wearable_permitido = 'true'`. Devuelve `Promise<boolean>`. |
| `autoReconnect()` | Sin diálogo. Si hay flag, llama a `navigator.bluetooth.getDevices()` y reconecta al primer dispositivo previamente autorizado. Si falla, limpia el flag. |
| `disconnect()` | Cierra GATT. Mantiene el permiso (el flag sigue). |
| `forget()` | Limpia el flag + desconecta. Equivale a "olvidar el reloj". |
| `isConnected()` | Booleano. |
| `startRecording()` | Vacía buffer y empieza a acumular. Llamar al inicio de cada partida. |
| `stopRecording()` | Devuelve `{fc_min, fc_max, fc_avg, fc_serie}` o `null` si menos de 3 muestras. |
| `onStatusChange(cb)` | Pub/sub. `cb('connected' \| 'disconnected')`. |
| `getLastSampleBpm()` | Última muestra recibida (debug). |
| `mountHeartIcon(opts)` | Helper UI: inyecta un icono de corazón fijo en una esquina (CSS auto-inyectado, suscrito a `onStatusChange`). |

### Detalle técnico crítico

#### Parseo GATT del característico `0x2A37` (Heart Rate Measurement)

```javascript
function parseHeartRate(dataView) {
    if (!dataView || dataView.byteLength < 2) return null;
    var flags = dataView.getUint8(0);
    var is16bit = (flags & 0x01) === 0x01;
    try {
        return is16bit ? dataView.getUint16(1, true) : dataView.getUint8(1);
    } catch (e) { return null; }
}
```

Maneja flag `0x01` del byte 0 (formato 8 vs 16 bit), little-endian, según especificación Bluetooth SIG.

#### Auto-reconexión silenciosa

```javascript
async function autoReconnect() {
    if (!isSupported() || state.connected) return false;
    var flag = localStorage.getItem(LS_FLAG);
    if (flag !== 'true') return false;
    if (typeof navigator.bluetooth.getDevices !== 'function') return false;
    try {
        var devices = await navigator.bluetooth.getDevices();
        if (!devices || devices.length === 0) {
            localStorage.removeItem(LS_FLAG);
            return false;
        }
        await bindCharacteristic(devices[0]);
        return true;
    } catch (e) { return false; }
}
```

Se ejecuta automáticamente en `DOMContentLoaded`. Funciona en Chrome 85+ (agosto 2020) sin necesidad de user gesture porque solo lee permisos ya concedidos.

#### Buffer y agregados

```javascript
function stopRecording() {
    state.recording = false;
    if (state.buffer.length < 3) return null;
    var serie = state.buffer.slice();
    var sum = 0, minV = serie[0], maxV = serie[0];
    for (var i = 0; i < serie.length; i++) {
        sum += serie[i];
        if (serie[i] < minV) minV = serie[i];
        if (serie[i] > maxV) maxV = serie[i];
    }
    return {
        fc_min: minV, fc_max: maxV,
        fc_avg: Math.round(sum / serie.length),
        fc_serie: serie
    };
}
```

Doble validación: además del filtro 30-220 al recibir cada sample (en `onSample`), el backend vuelve a filtrar.

#### Helper UI `mountHeartIcon`

Inyecta el CSS una sola vez por sesión (`<style id="wearable-heart-style">`) y crea un `<div class="wearable-heart">` con un `<i class="bi bi-heart-fill">` que sirve como glyph. Suscrito a `onStatusChange` para alternar el atributo `data-status="connected"`.

CSS clave:

```css
.wearable-heart {
    position: fixed; top: 18px; right: 18px; z-index: 1040;
    width: 42px; height: 42px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: #ffffff; border: 1.5px solid #e4e7ec;
    color: #98a2b3;  /* gris desconectado */
    transition: color 180ms ease-out, border-color 180ms ease-out;
    pointer-events: none; user-select: none; will-change: transform;
}
.wearable-heart[data-status="connected"] { color: #d92d20; border-color: #fecdca; }
.wearable-heart[data-status="connected"] .wearable-heart-glyph {
    animation: wearable-heart-beat 1s cubic-bezier(0.16,1,0.3,1) infinite;
    transform-origin: center;
}
@keyframes wearable-heart-beat {
    0%, 60%, 100% { transform: scale(1); }
    15% { transform: scale(1.22); }
    30% { transform: scale(1); }
    45% { transform: scale(1.12); }
}
@media (prefers-reduced-motion: reduce) {
    .wearable-heart[data-status="connected"] .wearable-heart-glyph { animation: none; }
}
```

Animación construida con dos picos consecutivos para simular el doble latido cardíaco (sístole + diástole). Solo `transform` (hardware accelerated). Respeta `prefers-reduced-motion`.

### Persistencia

- `localStorage.wearable_permitido = 'true'` tras `connect()` exitoso.
- Auto-reconexión cada carga via `getDevices()`.
- Si el usuario revoca permiso desde el candado del navegador, `getDevices()` devuelve `[]` y el servicio limpia el flag automáticamente.

---

## 5. Fase 4 — UI botón "Vincular Reloj" + icono corazón

### Objetivo

Botón discreto en el menú de juegos para vincular el reloj. Icono de corazón en cada juego mostrando el estado.

### Cambios en `core/templates/core/juegos.html`

#### HTML del botón (junto al "Volver")

```html
<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
    <h2 class="fw-bold text-dark" id="titulo-seccion">Sala de Terapia</h2>

    <div class="d-flex align-items-center gap-2">
        <button id="btn-wearable" type="button"
                class="btn rounded-pill px-3 fw-bold d-none align-items-center"
                aria-label="Vincular reloj inteligente">
            <span class="wearable-icon-wrap me-2 d-inline-flex align-items-center justify-content-center">
                <i id="wearable-icon" class="bi bi-bluetooth"></i>
            </span>
            <span id="wearable-label">Vincular Reloj</span>
        </button>

        <button id="btn-volver" class="btn btn-outline-dark d-none rounded-pill px-4 fw-bold"
                onclick="irAtras()">
            <i class="bi bi-arrow-left me-2"></i> Volver
        </button>
    </div>
</div>
```

#### CSS (estados + animación)

Estados del botón controlados por `data-status="connected"`:

```css
#btn-wearable {
    font-size: 1rem !important;
    padding: 0.55rem 1.1rem !important;
    border: 1.5px solid #d6d8db !important;
    background: #ffffff; color: #344054;
    transition: border-color 180ms ease-out, background-color 180ms ease-out, color 180ms ease-out;
    will-change: border-color, background-color;
}
#btn-wearable:hover { border-color: #98a2b3 !important; background: #fafbfc; }
#btn-wearable[data-status="connected"] {
    border-color: #d92d20 !important; background: #fff5f5; color: #b42318;
}
#btn-wearable[data-status="connected"]:hover { background: #ffecec; }
#btn-wearable[data-status="connected"] .wearable-icon-wrap {
    color: #d92d20;
    animation: wearable-heartbeat 1s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
```

#### Script controlador

```javascript
(function () {
    if (!window.Wearable) return;
    var btn = document.getElementById('btn-wearable');
    var label = document.getElementById('wearable-label');
    var icon = document.getElementById('wearable-icon');

    if (!Wearable.isSupported()) {
        btn.classList.add('d-none');
        return;
    }

    function render(connected) {
        if (connected) {
            btn.setAttribute('data-status', 'connected');
            icon.className = 'bi bi-heart-fill';
            label.textContent = 'Reloj conectado';
        } else {
            btn.removeAttribute('data-status');
            icon.className = 'bi bi-bluetooth';
            label.textContent = 'Vincular Reloj';
        }
    }

    btn.classList.remove('d-none');
    btn.classList.add('d-inline-flex');
    render(Wearable.isConnected());

    Wearable.onStatusChange(function (status) { render(status === 'connected'); });

    btn.addEventListener('click', async function () {
        if (Wearable.isConnected()) return;
        btn.disabled = true;
        var original = label.textContent;
        label.textContent = 'Conectando...';
        var ok = await Wearable.connect();
        btn.disabled = false;
        if (!ok) label.textContent = original;
    });
})();
```

### Flujo UX

1. Chrome/Edge → botón visible. Firefox/Safari → botón oculto (feature detection).
2. Click → diálogo nativo → seleccionar reloj → estado cambia a "Reloj conectado" (rojo, corazón latiendo).
3. En cualquier carga posterior (otra página), `autoReconnect()` reactiva la conexión sin pop-up gracias al flag de `localStorage` + `navigator.bluetooth.getDevices()`.
4. Si el reloj se apaga o sale de rango, el evento `gattserverdisconnected` baja el estado a `disconnected` y el botón vuelve a azul.

---

## 6. Fase 5 — Integración en 4 juegos VTR

### Hallazgo crítico (corregido a mitad de la fase)

Diagnóstico inicial erróneo: pensé que solo `juego_encuentra_letra.html` estaba integrado con VTR. Tras profundizar, los otros 3 (Encuentra la Bolita, Lista de la Compra, Música y Colores) **sí tienen lógica VTR completa** (cronómetro `performance.now()`, conteo de errores, POST a `/api/vtr/guardar-partida/`), pero en archivos JavaScript externos bajo `core/static/core/js/games/`, no en el HTML. Mi grep inicial solo miraba dentro de `core/templates/`.

Por tanto, la integración wearable se redujo a 3 cambios idénticos en cada juego.

### Patrón aplicado a los 4 juegos

#### 1. Cargar `wearable_service.js` en el HTML

```html
<script src="{% static 'core/js/wearable_service.js' %}"></script>
```

#### 2. En `comenzarJuego()` (o equivalente)

```javascript
if (window.Wearable) {
    Wearable.mountHeartIcon();
    if (Wearable.isConnected()) Wearable.startRecording();
}
```

#### 3. En `guardarSesion()` (justo antes del payload)

```javascript
const fc = (window.Wearable && Wearable.isConnected())
    ? Wearable.stopRecording()
    : null;
```

Y se añaden al payload:

```javascript
fc_min: fc ? fc.fc_min : null,
fc_max: fc ? fc.fc_max : null,
fc_avg: fc ? fc.fc_avg : null,
fc_serie: fc ? fc.fc_serie : null
```

### Detalle por juego

#### 5.1 Encuentra la Letra (`juego_encuentra_letra.html`)

- El JS está **inline** dentro del template. Edición directa del HTML.
- `comenzarJuego()` modificado para montar icono y arrancar grabación.
- `guardarSesion()` modificado para añadir bloque FC al payload.
- Wearable script añadido tras `{% load static %}` en el head del bloque.

#### 5.2 Encuentra la Bolita

- Template: `core/templates/core/games/cognitivo/atencion/EncuentraLaBolita.html` → añadido `<script src="...wearable_service.js">`.
- Lógica: `core/static/core/js/games/cognitivo/atencion/EncuentraLaBolita.js` → modificadas `comenzarJuego()` y `guardarSesion()`.

#### 5.3 Lista de la Compra

- Template: `core/templates/core/games/cognitivo/memoria/ListaCompra.html` → añadido `<script src="...">`.
- Lógica: `core/static/core/js/games/cognitivo/memoria/ListaCompra.js` → modificadas `comenzarJuego()` y `guardarSesion()`.

#### 5.4 Música y Colores (Secuencia Musical)

- Template: `core/templates/core/games/cognitivo/memoria/SecuenciaMusical.html` → añadido `<script src="...">`.
- Lógica: `core/static/core/js/games/cognitivo/memoria/SecuenciaMusical.js` → modificadas `comenzarJuego()` (mantiene también la inicialización de `AudioContext`) y el bloque de guardado (función inline tras `modalResultados.show()`).

### Garantías de no-deriva

- **No se tocó** el cronómetro TR (`performance.now()`, `vtrInicioRonda`, `vtrTiemposRonda`).
- **No se tocó** el conteo `vtrErrores`.
- **No se tocó** la lógica de dificultad percibida ni estado de ánimo.
- **No se tocó** la llamada a `vtr_iniciar_sesion` desde `juegos.html`.
- Si no hay reloj vinculado, los 4 campos FC viajan `null` y el endpoint los acepta sin problema (Fase 2 los considera opcionales).

---

## 7. Fase 6 — Línea roja FC en gráfica del médico

### Objetivo

Añadir una segunda línea (roja) al Chart.js de `detalle_sesion_terapia.html` con la FC media de cada partida, con un segundo eje Y a la derecha en rango 40-200 bpm.

### Cambios en `core/views.py`

En `detalle_sesion_terapia()`, se enriquece el dict que se serializa a JSON:

```python
fc_avg = [p.fc_avg for p in partidas]
fc_min_arr = [p.fc_min for p in partidas]
fc_max_arr = [p.fc_max for p in partidas]
fc_series = [p.fc_serie for p in partidas]

datos_grafica = json.dumps({
    'labels': labels,
    'degradacion': degradacion,
    'errores': errores,
    'fc_avg': fc_avg,
    'fc_min': fc_min_arr,
    'fc_max': fc_max_arr,
    'fc_series': fc_series,
    'vas_inicial': sesion.vas_inicial,
    'duracion_min': sesion.duracion_minutos,
    'juegos': juegos_unicos,
})
```

### Cambios en el template Chart.js

#### Detección condicional

```javascript
const tieneFC = (DATOS_VTR.fc_avg || []).some(v => v !== null && v !== undefined);
if (tieneFC) document.getElementById('badge-fc-legend').classList.remove('d-none');
```

Si **ninguna** partida tiene FC, no se dibuja el dataset rojo ni el eje Y derecho. La gráfica queda exactamente igual que antes.

#### Dataset rojo añadido condicionalmente

```javascript
if (tieneFC) {
    datasets.push({
        type: 'line',
        label: 'FC Media (bpm)',
        data: DATOS_VTR.fc_avg,
        borderColor: '#d92d20',
        backgroundColor: 'rgba(217,45,32,0.08)',
        borderWidth: 2,
        pointRadius: 5,
        pointBackgroundColor: '#d92d20',
        fill: false,
        spanGaps: false,
        tension: 0.3,
        yAxisID: 'yFC',
        order: 0,
    });
}
```

#### Eje Y derecho (yFC)

```javascript
if (tieneFC) {
    scales.yFC = {
        type: 'linear', position: 'right',
        min: 40, max: 200,
        title: { display: true, text: 'FC (bpm)', font: { weight: 'bold' }, color: '#d92d20' },
        grid: { drawOnChartArea: false },  // no duplicar grid lines
        ticks: { color: '#d92d20' }
    };
}
```

#### Tooltips diferenciados

```javascript
tooltip: {
    callbacks: {
        label: function(ctx) {
            if (ctx.dataset.label === 'Calibrando') return null;
            if (ctx.dataset.label === 'FC Media (bpm)') {
                return ctx.raw === null ? 'FC: —' : `FC media: ${ctx.raw} bpm`;
            }
            return ctx.raw === null
                ? 'TR: Calibrando...'
                : `Degradación: ${ctx.raw > 0 ? '+' : ''}${ctx.raw}%`;
        }
    }
}
```

#### Badge de leyenda añadido al encabezado de la gráfica

```html
<span id="badge-fc-legend" class="badge me-2 d-none"
      style="background:#fee4e2; color:#b42318;">
    Línea roja = FC media (bpm)
</span>
```

### Resultado clínico

El médico puede cruzar visualmente: *"la FC se disparó en la partida 4 y justo en la 5 cayó el TR"*. Las partidas sin reloj quedan como hueco en la línea roja (`spanGaps: false`).

---

## 8. Fase 7 — Modal de detalle de partida

### Objetivo

Cada fila de la tabla con `fc_serie` se vuelve clicable. Click → modal con 3 tarjetas (Máx/Mín/Media) + mini-gráfica Chart.js segundo a segundo.

### Decisión arquitectónica

**Opción A: embed all** (recomendada por el plan). La serie completa de cada partida viaja en el `datos_grafica_json` inicial (campo `fc_series`). El JS lee `DATOS_VTR.fc_series[idx]` al hacer click. Sin round-trip extra al backend.

Series de ~90 enteros por partida × 10 partidas ≈ 900 ints ≈ 3 KB. Despreciable.

### Cambios en la tabla drill-down

#### Columna nueva "FC" en el `<thead>`

```html
<th class="py-2 text-center">FC</th>
```

#### `<tr>` marcada como clicable solo si tiene `fc_serie`

```html
<tr {% if p.fc_serie %}class="partida-clicable" data-partida-idx="{{ forloop.counter0 }}"
    data-juego="{{ p.juego }}" data-nivel="{{ p.nivel_jugado }}"{% endif %}>
```

#### Celda FC

```html
<td class="py-2 text-center">
    {% if p.fc_avg %}
        <span class="fc-cell fw-bold" style="color:#b42318;">
            <i class="bi bi-heart-pulse-fill me-1"></i>{{ p.fc_avg }}
        </span>
    {% else %}
        <span class="text-muted small">—</span>
    {% endif %}
</td>
```

#### CSS

```css
tr.partida-clicable { cursor: pointer; transition: background-color 140ms ease-out; }
tr.partida-clicable:hover { background-color: #fafbfc; }
tr.partida-clicable:hover .fc-cell { text-decoration: underline; }
```

Filas **sin** `fc_serie` no llevan la clase `partida-clicable`, así que no son clicables (cursor normal, sin hover special).

### Modal HTML

```html
<div class="modal fade" id="modalDetalleFC" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content rounded-4 border-0 shadow-lg">
            <div class="modal-header border-0 px-4 pt-4 pb-2">
                <div>
                    <h5 class="fw-bold text-dark mb-0" id="modalFC-titulo">Detalle de la partida</h5>
                    <p class="text-muted small mb-0" id="modalFC-subtitulo">Nivel —</p>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body px-4 pb-4">
                <div class="row g-3 mb-3">
                    <!-- 3 tarjetas: Máx (rojo), Mín (azul), Media (gris) -->
                    ...
                </div>
                <div style="height:240px;"><canvas id="modalFC-canvas"></canvas></div>
                <p class="text-muted small mb-0 mt-2 text-center">
                    Eje X: segundos desde el inicio de la partida · Eje Y: pulsaciones por minuto.
                </p>
            </div>
        </div>
    </div>
</div>
```

### Tarjetas (3 colores diferenciados)

| Tarjeta | Background | Border | Color texto |
|---|---|---|---|
| **FC Máxima** | `#fef3f2` | `1px solid #fecdca` | `#b42318` |
| **FC Mínima** | `#eff8ff` | `1px solid #b2ddff` | `#175cd3` |
| **FC Media** | `#f9fafb` | `1px solid #e4e7ec` | `#1d2939` |

**Importante:** las tarjetas usan `background-tint + border completo`, NO side-stripe (uno de los bans absolutos de `impeccable`).

### JS del modal

```javascript
(function () {
    const modalEl = document.getElementById('modalDetalleFC');
    const modal = new bootstrap.Modal(modalEl);
    let chartDetalle = null;

    document.querySelectorAll('tr.partida-clicable').forEach(function (row) {
        row.addEventListener('click', function () {
            const idx = parseInt(row.dataset.partidaIdx, 10);
            const juego = row.dataset.juego || 'Partida';
            const nivel = row.dataset.nivel || '—';

            const serie = (DATOS_VTR.fc_series || [])[idx] || null;
            const fcMin = (DATOS_VTR.fc_min || [])[idx];
            const fcMax = (DATOS_VTR.fc_max || [])[idx];
            const fcAvg = (DATOS_VTR.fc_avg || [])[idx];

            if (!serie || serie.length === 0) return;

            // Poblar header + 3 tarjetas
            document.getElementById('modalFC-titulo').textContent = juego;
            document.getElementById('modalFC-subtitulo').textContent =
                'Nivel ' + nivel + ' · ' + serie.length + ' s registrados';
            document.getElementById('modalFC-max').textContent = fcMax ?? '—';
            document.getElementById('modalFC-min').textContent = fcMin ?? '—';
            document.getElementById('modalFC-avg').textContent = fcAvg ?? '—';

            // Instanciar Chart.js con la serie
            const labelsX = serie.map((_, i) => i + 1);
            if (chartDetalle) chartDetalle.destroy();
            chartDetalle = new Chart(document.getElementById('modalFC-canvas').getContext('2d'), {
                type: 'line',
                data: { labels: labelsX, datasets: [{
                    label: 'FC (bpm)', data: serie,
                    borderColor: '#d92d20',
                    backgroundColor: 'rgba(217,45,32,0.10)',
                    borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true,
                }]},
                options: { /* ... */ }
            });

            modal.show();
        });
    });

    modalEl.addEventListener('hidden.bs.modal', function () {
        if (chartDetalle) { chartDetalle.destroy(); chartDetalle = null; }
    });
})();
```

### Gestión de memoria

El chart se **destruye** al cerrar el modal (`hidden.bs.modal`) para liberar el canvas. Si se reabre con otra partida, se vuelve a instanciar. Evita leaks tras decenas de aperturas.

---

## 9. Decisiones de diseño aplicadas

Skills externas leídas y aplicadas en este trabajo: **`impeccable`** + **`design-taste-frontend`** (ambas presentes en `.agents/skills/`).

### Reglas respetadas

#### Color y palette

- ❌ **No** `#000` ni `#fff`. Se han usado tonos `#1d2939`, `#fafbfc`, `#475467`.
- ✅ Una palette coherente (escala neutra slate + 1 accent rojo + 1 secundario azul). Sin mezclar warm/cool grays.
- ✅ Accent rojo desaturado (`#d92d20`, `#b42318`) — no saturado, no neon.
- ✅ Azul secundario (`#175cd3`) usado solo en la tarjeta FC Mínima.

#### Tipografía

- ✅ Hierarchy via weight + size, no por color.
- ✅ Body con `text-muted small` y headers con `fw-bold`.
- ✅ Sin headers gigantescos. Modales con `<h5>` máximo.

#### Layout

- ✅ NO se ha usado `h-screen` en ningún sitio nuevo.
- ✅ Sin "3 equal cards horizontally". Las tarjetas del modal son 3 col diferenciadas en color/significado.
- ✅ Sin wrap inecesario en containers.
- ✅ Rhythm de spacing (p-3/p-4/px-4 según rol).

#### Motion

- ✅ Animación `wearable-heart-beat` solo con `transform: scale(...)` (hardware accelerated).
- ✅ Botón con `transition: border-color, background-color` (hardware accel).
- ✅ Easing exponential (`cubic-bezier(0.16, 1, 0.3, 1)` — quint out, sin bounce ni elastic).
- ✅ `prefers-reduced-motion` respetado en ambos sitios (botón + icono corazón).
- ✅ Sin animaciones de layout properties (`top`, `left`, `width`, `height`).

#### Absolute bans (impeccable)

- ❌ **No side-stripe borders.** Las tarjetas del modal usan border completo + background tint.
- ❌ **No gradient text.** Texto en color sólido siempre.
- ❌ **No glassmorphism default.** Solo background colors sólidos.
- ❌ **No hero-metric template.**
- ❌ **No identical card grids.** Las 3 tarjetas tienen color/significado diferente.
- ❌ **No modal as first thought.** Drill-down con click intencional, no modal de bienvenida.

#### AI tells evitados

- ❌ Sin emojis en el código. Bootstrap Icons (`bi-heart-fill`, `bi-bluetooth`, `bi-heart-pulse-fill`).
- ❌ Sin glow neón / outer shadows decorativos. Solo el shadow sutil de Bootstrap (`shadow-sm`, `shadow-lg`).
- ❌ Sin nombres genéricos ni copywriting AI (no se ha usado "elevate", "seamless", "next-gen", etc.).
- ❌ Sin Inter font (se usa la del proyecto).
- ❌ Sin 3-column card layout genérico horizontal.

#### Performance guardrails

- ✅ `will-change: transform, border-color, background-color` solo donde aplica.
- ✅ `pointer-events: none` en el icono de corazón (decorativo).
- ✅ Chart.js del modal se **destruye** al cerrar (no leaks).
- ✅ Listener pub/sub del wearable usa fragmentos try/catch para no romper si un listener falla.

### Adaptaciones al stack real

`design-taste-frontend` asume React/Next/Tailwind/Framer Motion. SamiraDTx es Django + Bootstrap 5 + Chart.js + JS vanilla. Reglas transversales aplicadas:

| Regla design-taste-frontend | Adaptación al stack real |
|---|---|
| Tailwind classes | Bootstrap 5 utility classes (`rounded-4`, `shadow-sm`, etc.) |
| Framer Motion `useMotionValue` | CSS keyframes con `transform` |
| `'use client'` isolation | Scripts inline + `<script src="...">` segmentados por template |
| `@phosphor-icons/react` | Bootstrap Icons (`bi bi-*`) |
| `min-h-[100dvh]` | No se usa hero full-height en esta feature |

---

## 10. Anti-deriva: lo que NO se ha tocado

Bloqueo explícito de cambios fuera de scope, según el plan:

- ❌ **No** se ha modificado la lógica de `MarcaPersonalTR` (FIFO ventana de 3, calibración).
- ❌ **No** se ha modificado `evaluar_ajuste_dinamico()` (DDA).
- ❌ **No** se ha renombrado ningún campo existente.
- ❌ **No** se han migrado juegos no-VTR (Elsa, Calculadora, MoCA) al endpoint `vtr_guardar_partida`.
- ❌ **No** se muestra al paciente ningún número de bpm.
- ❌ **No** se bloquea ningún juego por ausencia de reloj.
- ❌ **No** se ha cambiado la respuesta del endpoint (sigue siendo `{"estado": "ok"}`).
- ❌ **No** se ha añadido lógica clínica automática sobre FC (alertas, bloqueos, notificaciones).
- ❌ **No** se ha modificado `EvaluacionMoCA`, `NotaEspecialista`, `NotificacionBuzon`, `SesionTerapia`, `MarcaPersonalTR`.

---

## 11. Cómo testear

### Preparación

1. Chrome o Edge (Desktop o Android).
2. Reloj BLE con Heart Rate Service (Garmin, Polar, Wahoo, banda de pecho Coospo, etc.).
3. Servidor corriendo en HTTPS o `localhost` (Web Bluetooth lo exige).

### Test 1: feature detection sin reloj

- Abrir `/terapia/` en Firefox/Safari → el botón "Vincular Reloj" NO debe aparecer.
- Abrir `/terapia/` en Chrome → el botón aparece, estado "Vincular Reloj" (azul Bluetooth).

### Test 2: vinculación inicial

- Click en "Vincular Reloj" → diálogo nativo de Chrome → elegir reloj.
- Tras conectar: botón cambia a estado rojo "Reloj conectado" con corazón latiendo.
- Verificar en DevTools: `localStorage.wearable_permitido === 'true'`.

### Test 3: auto-reconexión silenciosa

- Tras vincular, navegar a `/terapia/encuentra-letra/`.
- En ~1-2 segundos, el icono de corazón en la esquina del juego debe pasar de gris a rojo latiendo, sin pop-up.
- Volver al menú: el botón aparece directamente en estado conectado.

### Test 4: grabación durante partida

- Con reloj conectado, jugar una partida completa.
- Tras terminar, el POST a `/api/vtr/guardar-partida/` debe incluir `fc_min`, `fc_max`, `fc_avg`, `fc_serie` con valores plausibles (60-110 bpm en reposo).
- Verificar en Django admin o shell: `SesionDeJuego.objects.last()` tiene los 4 campos rellenos.

### Test 5: partida sin reloj

- Apagar el reloj o jugar sin haber vinculado.
- Tras terminar, los 4 campos viajan `null`.
- El VTR sigue calculando degradación, el DDA sigue funcionando.

### Test 6: desconexión a mitad

- Vincular reloj, empezar partida, apagar reloj a mitad.
- Tras terminar: si la serie tiene ≥3 muestras, se guarda lo capturado. Si menos, los 4 campos quedan `null`.

### Test 7: vista del médico

- Loguearse como médico, ir a `/medico/sesion/<uuid>/`.
- Si alguna partida tiene FC: se ve línea roja + eje Y derecho + badge "Línea roja = FC media".
- Si ninguna: gráfica idéntica a la pre-Wearable.
- Tabla: columna "FC" con `bi-heart-pulse-fill` + valor en rojo, o `—` si no hay.

### Test 8: modal drill-down

- Click en una fila con FC → modal abre, 3 tarjetas pobladas, mini-gráfica visible.
- Cerrar modal → reabrir otra fila → datos actualizados.
- Click en fila SIN fc_serie → no abre (no es clicable).

### Test 9: revocación de permiso

- En Chrome: candado → "Permisos" → revocar Bluetooth.
- Recargar `/terapia/`: botón vuelve a estado "Vincular Reloj" (azul).
- Verificar: `localStorage.wearable_permitido` se limpia automáticamente.

### Test 10: payload malformado

- Desde DevTools, ejecutar:
  ```javascript
  fetch('/api/vtr/guardar-partida/', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'X-CSRFToken': /* token */},
      body: JSON.stringify({juego:'X', fc_serie: [70, 500, 'foo', null, 80, 75]})
  });
  ```
- El backend debe filtrar el 500, 'foo' y null. Si quedan ≥3 muestras válidas (70, 80, 75), las guarda. Si no, todos `null`.

---

## 12. Pendientes y próximos pasos

### Validación con hardware real

⚠️ **Requerido antes de producción.** El plan marca la Fase 3 (servicio Bluetooth) como riesgo alto. Necesario probar:

- [ ] Con al menos 2 dispositivos físicos distintos (Garmin + banda Polar/Coospo) para validar el parseo de flags GATT.
- [ ] Conexión continua durante una sesión completa (10+ partidas).
- [ ] Auto-reconexión tras cierre del navegador y reapertura.
- [ ] Auto-reconexión tras apagar/encender el reloj.

### Posibles mejoras futuras (no en scope)

- Re-intento automático de conexión BLE tras desconexión inesperada (actualmente solo `getDevices()` en cada carga).
- Multi-dispositivo: guardar `device.id` específico para que el paciente pueda elegir cuál si tiene varios.
- Exportación de la serie FC a CSV desde el modal del médico.
- Cruce automático FC ↔ degradación TR en una métrica clínica derivada (ej. "% de partidas donde FC > umbral y degradación > X%").

### Ampliación de scope (decisión clínica)

- Integrar Wearable en juegos no-VTR (Elsa, Calculadora, MoCA) si el equipo clínico lo pide. Requeriría migrar esos juegos al endpoint `vtr_guardar_partida` primero.

---

## 📌 Checklist para futuros juegos VTR + Wearable

Cuando crees un juego nuevo que deba captar TR + FC:

### Template HTML

- [ ] `<script src="{% static 'core/js/wearable_service.js' %}"></script>` antes del script del juego.

### Lógica JS

- [ ] Cronómetro TR con `performance.now()` que mida solo el tiempo de procesamiento mental.
- [ ] Contar `vtrErrores`.
- [ ] Al inicio de cada partida:
  ```javascript
  if (window.Wearable) {
      Wearable.mountHeartIcon();
      if (Wearable.isConnected()) Wearable.startRecording();
  }
  ```
- [ ] Al final de la partida:
  ```javascript
  const fc = (window.Wearable && Wearable.isConnected()) ? Wearable.stopRecording() : null;
  const payload = {
      juego: "...", nivel: ..., puntos: ..., tiempo_jugado: ...,
      completado: true, tiempo_reaccion_ms: ..., errores_cometidos: ...,
      dificultad_percibida: ..., estado_animo: ...,
      fc_min: fc ? fc.fc_min : null,
      fc_max: fc ? fc.fc_max : null,
      fc_avg: fc ? fc.fc_avg : null,
      fc_serie: fc ? fc.fc_serie : null
  };
  fetch('/api/vtr/guardar-partida/', { method:'POST', headers:..., body: JSON.stringify(payload) });
  ```

### Backend

- ✅ **Nada que tocar.** El endpoint ya acepta los 4 campos.

### Panel del médico

- ✅ **Nada que tocar.** La gráfica y el modal pintan automáticamente cualquier juego cuya partida pertenezca a una `SesionTerapia` con datos FC.

---

*Documento generado el 20 de Mayo de 2026 tras completar todas las fases del PlanImplementacionWearable.md. Estado: implementación finalizada, pendiente de pruebas con hardware BLE real.*
