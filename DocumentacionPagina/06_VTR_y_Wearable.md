# ⏱️❤️ Sistema VTR + Wearable — Midiendo la Fatiga en Tiempo Real

> **Documento 6 de la serie "Documentación de la Página"**
> Estos dos sistemas son lo que diferencia a SamiraDTx de un simple "juego de puntos": miden **objetivamente** cómo está el paciente. El **VTR** mide su velocidad de reacción (¿está más lento de lo normal? = fatiga cognitiva). El **Wearable** mide su corazón (¿se está esforzando demasiado? = fatiga física). Juntos dan al médico una foto real del estado del paciente durante la terapia.

---

## PARTE 1 — EL SISTEMA VTR

### 1. ¿Qué es el VTR?

**VTR = Variabilidad del Tiempo de Reacción.** La idea clínica:
> Cuando una persona se fatiga cognitivamente, **reacciona más despacio**. Si medimos cuánto tarda en responder y lo comparamos con su "velocidad normal", podemos detectar fatiga **antes** de que el paciente la note o abandone.

No es la puntuación (eso mide acierto), es la **velocidad de respuesta** (mide estado neurológico).

### 2. Las dos tablas del VTR (repaso del Documento 1)

| Tabla | Rol |
|-------|-----|
| **`SesionTerapia`** | El "contenedor": una sesión completa de entrenamiento. Tiene un `session_id` único. |
| **`MarcaPersonalTR`** | El "récord personal": el tiempo de reacción ideal (`TR_ideal`) del paciente por juego y nivel. |
| **`SesionDeJuego`** | Cada partida guarda su `tiempo_reaccion_ms`, `degradacion_porcentaje` y `errores`. |

### 3. El cerebro del VTR: `vtr_service.py`

Tiene 3 constantes que definen sus reglas:
```python
TIMEOUT_INACTIVIDAD_MIN = 60   # tras 60 min sin jugar, se cierra la sesión
VENTANA_FRESCA_MIN = 10        # solo los primeros 10 min cuentan para el récord
SCORE_MINIMO_BASE = 300        # solo partidas con ≥300 pts cuentan para el récord
```

#### Función `obtener_o_crear_sesion`
Decide si seguir en la sesión actual o abrir una nueva:
- Si el paciente jugó hace **menos de 60 min** → reutiliza la sesión (sigue "vivo").
- Si pasó **más de 60 min** → crea una sesión nueva.

Esto agrupa automáticamente las partidas en "tandas" de terapia coherentes.

#### Función `actualizar_marca_personal` (el récord con media móvil)
Calcula el `TR_ideal` con una **media móvil FIFO de 3 tiempos**. La lógica:

**Filtros de calidad (para que el récord sea fiable):**
- Solo cuenta si la partida es de los **primeros 10 minutos** de la sesión (cuando el paciente está fresco, no fatigado).
- Solo cuenta si hizo **≥300 puntos** (si lo hizo mal, ese tiempo no representa su "velocidad real").

**Fase de calibración (las 3 primeras partidas válidas):**
```
tiempo1 = primera partida válida
tiempo2 = segunda
tiempo3 = tercera
TR_ideal = promedio de los 3
```

**Fase calibrada (ventana deslizante FIFO):**
```
Entra una partida nueva → sale la más vieja:
  tiempo1 ← tiempo2
  tiempo2 ← tiempo3
  tiempo3 ← nuevo tiempo
  TR_ideal = nuevo promedio
```

> 🧠 **¿Por qué media móvil?** Permite que el récord **evolucione**. Si el paciente mejora con la rehabilitación (neuroplasticidad), su `TR_ideal` baja con el tiempo. No se queda anclado a una marca antigua.

#### Función `calcular_degradacion`
Compara el tiempo actual contra el ideal:
```python
degradacion = ((tiempo_actual - TR_ideal) / TR_ideal) * 100
```
- Degradación **positiva** = más lento de lo normal → posible fatiga.
- Degradación **negativa** = más rápido de lo normal → buen día.
- Devuelve `None` si aún está calibrando (no hay `TR_ideal` todavía).

### 4. Flujo VTR completo (cómo se conecta)

```
1. Paciente abre un juego
        │  POST /api/vtr/iniciar-sesion/
        ▼
2. vtr_iniciar_sesion → obtener_o_crear_sesion() → devuelve session_id
        │
3. Paciente juega (el JS mide el tiempo de reacción de cada ronda)
        │  POST /api/vtr/guardar-partida/
        ▼
4. vtr_guardar_partida:
     - actualizar_marca_personal()  → actualiza el récord
     - calcular_degradacion()       → % vs récord
     - crea SesionDeJuego con TR + degradación + errores
     - registrar_actividad()        → mantiene viva la sesión
     - evaluar_ajuste_dinamico()    → DDA puede ajustar nivel
        │
        ▼
5. Médico ve la sesión en detalle_sesion_terapia (gráficas de degradación)
```

---

## PARTE 2 — EL WEARABLE (PULSERA BLUETOOTH)

### 5. ¿Qué es y para qué?

Una **pulsera de frecuencia cardíaca** (tipo banda de pecho o smartwatch) que se conecta al navegador por **Bluetooth (BLE)** y mide el pulso del paciente **mientras juega**. Permite al médico ver si la terapia provoca estrés físico excesivo.

> Recuerda (Documento 1): **no hay tabla Wearable**. El pulso se guarda dentro de cada `SesionDeJuego` (`fc_min`, `fc_max`, `fc_avg`, `fc_serie`).

### 6. El servicio frontend: `wearable_service.js`

Es un módulo JavaScript autónomo que expone un objeto global **`window.Wearable`**. Usa la **Web Bluetooth API** y el perfil estándar GATT de ritmo cardíaco.

**API pública:**
| Método | Qué hace |
|--------|----------|
| `isSupported()` | ¿El navegador soporta Bluetooth? |
| `connect()` | Abre el selector BLE y se conecta a la pulsera |
| `disconnect()` / `forget()` | Desconecta |
| `isConnected()` | ¿Está conectada? |
| `startRecording()` | Empieza a grabar pulsaciones (al empezar a jugar) |
| `stopRecording()` | Para y devuelve `{fc_min, fc_max, fc_avg, fc_serie}` |
| `getLastSampleBpm()` | Último pulso leído |
| `mountHeartIcon()` | Pinta un corazón ❤️ animado en la esquina de la pantalla |

**Cómo funciona por dentro:**
```js
var HR_SERVICE = 'heart_rate';                  // servicio Bluetooth estándar
var HR_CHARACTERISTIC = 'heart_rate_measurement';
```
1. **`connect()`** → pide al navegador que muestre el selector de dispositivos BLE filtrando por servicio `heart_rate`. El usuario elige su pulsera.
2. **`bindCharacteristic()`** → se suscribe a las notificaciones de pulso. Cada vez que llega un latido, se dispara `onSample`.
3. **`parseHeartRate()`** → decodifica el dato binario BLE (puede venir en 8 o 16 bits según un flag).
4. **`onSample()`** → valida que el pulso esté entre **30 y 220 bpm** (descarta lecturas absurdas) y, si está grabando, lo añade al buffer.
5. **`stopRecording()`** → calcula min/max/avg y devuelve la serie completa (solo si hay ≥3 muestras).

> 🛡️ **Filosofía "manual":** el comentario del código dice *"Conexión siempre manual: el paciente pulsa 'Vincular Reloj'… No hay reconexión automática."* Es una decisión deliberada para no marear a pacientes con problemas cognitivos con reconexiones inesperadas.

**El corazón visual (`mountHeartIcon`):** inyecta un icono ❤️ fijo en la esquina que **late con animación** cuando está conectado (y respeta `prefers-reduced-motion` para accesibilidad). Es feedback visual de que la pulsera funciona.

### 7. Cómo los juegos usan el wearable

En cada juego JS (ej. `EncuentraLaBolita.js`):
```js
function comenzarJuego() {
    ...
    if (window.Wearable && Wearable.isConnected()) Wearable.startRecording();  // empieza a grabar
}

function guardarSesion(...) {
    const fc = (window.Wearable && Wearable.isConnected())
        ? Wearable.stopRecording()    // para y recoge la serie
        : null;
    const datos = { ..., fc_min: fc?.fc_min, fc_max: fc?.fc_max, fc_avg: fc?.fc_avg, fc_serie: fc?.fc_serie };
    fetch('/api/vtr/guardar-partida/', { ... });   // lo manda con el resto
}
```
El pulso viaja **junto** con los datos VTR a la misma API.

### 8. La validación doble (frontend + backend)

El pulso se valida **dos veces** (defensa en profundidad):
1. **Frontend** (`wearable_service.js`): descarta valores fuera de 30–220 bpm en `onSample`.
2. **Backend** (`vtr_guardar_partida` en views.py): **vuelve a filtrar** la serie a 30–220 y exige ≥3 muestras antes de guardar:
   ```python
   serie_filtrada = [int(v) for v in serie_cruda
                     if isinstance(v, (int, float)) and 30 <= int(v) <= 220]
   if len(serie_filtrada) >= 3:
       fc_serie = serie_filtrada
       fc_min, fc_max = min(serie_filtrada), max(serie_filtrada)
       fc_avg = round(sum(serie_filtrada) / len(serie_filtrada))
   ```
> Nunca te fíes solo del frontend: el navegador puede mandar cualquier cosa. El backend siempre revalida.

### 9. Cómo lo ve el médico

En `detalle_sesion_terapia` (views.py), el médico ve una gráfica que combina, por cada partida de la sesión:
- **Degradación VTR** (curva de fatiga cognitiva).
- **Errores cometidos.**
- **Frecuencia cardíaca** (`fc_avg`, `fc_min`, `fc_max` y la serie completa `fc_series`).
- El **VAS inicial** (cansancio autopercibido al empezar).

Todo se empaqueta en `datos_grafica_json` y el frontend lo dibuja con Chart.js (Documento 7).

---

## 10. La visión integrada: 3 capas de medición de fatiga

SamiraDTx mide la fatiga del paciente desde **tres ángulos** a la vez:

| Capa | Qué mide | De dónde sale |
|------|----------|---------------|
| **Subjetiva** | Lo que el paciente *dice* sentir | VAS inicial + dificultad/ánimo percibidos (modales) |
| **Cognitiva (VTR)** | Lo que su *cerebro* muestra | Degradación del tiempo de reacción |
| **Física (Wearable)** | Lo que su *cuerpo* muestra | Frecuencia cardíaca |

Cruzar las tres da una imagen mucho más rica que cualquiera por separado. Por ejemplo: si el pulso sube, la reacción se degrada **y** el paciente dice "muy difícil" → fatiga clara, el DDA bajará el nivel.

---

## 11. Resumen ejecutivo (la foto en 7 frases)

1. El **VTR** mide la **velocidad de reacción** del paciente para detectar fatiga cognitiva.
2. `vtr_service.py` mantiene un **récord personal** (`TR_ideal`) con una **media móvil de 3 tiempos**, solo con partidas frescas y buenas.
3. La **degradación** es el % que el paciente está más lento que su récord → señal de fatiga.
4. El **Wearable** es una pulsera BLE que mide el pulso vía `wearable_service.js` (Web Bluetooth).
5. El pulso se valida **dos veces** (frontend y backend, 30–220 bpm) y se guarda dentro de cada partida.
6. La conexión de la pulsera es **manual** por diseño (accesibilidad para pacientes con ictus).
7. Juntos, VTR + Wearable + autopercepción dan **tres capas** de medición de fatiga que el médico ve en gráficas.

---

## 12. Puntos a explorar / clarificar

- 🔬 ¿Qué pulseras concretas son compatibles? (cualquiera que exponga el servicio GATT estándar `heart_rate`).
- ❓ El `TR_ideal` se calibra con solo 3 muestras: ¿es suficiente estadísticamente? Posible mejora futura.
- 🔬 La reconstrucción del "TR ideal en cada partida" en `detalle_sesion_terapia` usa la degradación guardada — verificar que la fórmula inversa es exacta.

---

*Fin del Documento 6. Siguiente: el Frontend (plantillas, layouts y gráficas) — Documento 7.*
