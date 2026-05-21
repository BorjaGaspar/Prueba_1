# Sistema Wearable en SamiraDTx — Documentación Final

## Qué es y para qué sirve

SamiraDTx es una plataforma de rehabilitación cognitiva. Los pacientes juegan a minijuegos que miden su tiempo de reacción (VTR). El sistema Wearable añade una capa de datos biométricos a esas sesiones: se captura la frecuencia cardíaca (FC) del paciente mientras juega, sin que él lo sepa ni lo note.

El objetivo clínico es permitir al médico correlacionar el rendimiento cognitivo con el estado fisiológico. Si un paciente tarda cada vez más en reaccionar y su FC está elevada, puede ser señal de fatiga intra-sesión. Es una herramienta de observación pasiva, no de intervención.

---

## Filosofía de diseño: invisibilidad para el paciente

La decisión más importante de todo el sistema es esta: **el paciente nunca ve un número de pulsaciones**. Solo ve un icono de corazón pequeño en la esquina de la pantalla que late en rojo cuando el reloj está conectado, y es gris cuando no lo está. Nada más.

Esto es deliberado. Mostrar la FC en tiempo real a un paciente geriátrico podría generar ansiedad, distracción o comportamientos compensatorios que contaminarían los datos. El sistema es un observador silencioso.

El médico, en cambio, sí tiene acceso completo: ve los datos FC por partida, puede ver la curva segundo a segundo y compararla con el tiempo de reacción en la misma sesión.

---

## Tecnología utilizada: Web Bluetooth

La conexión con el reloj se hace mediante **Web Bluetooth**, una API nativa del navegador Chrome y Edge que permite conectarse a dispositivos Bluetooth Low Energy (BLE) directamente desde una página web, sin instalar nada.

Los relojes deportivos exponen un servicio estándar llamado **Heart Rate Service** (UUID `0x180D`). Dentro de ese servicio hay una característica llamada **Heart Rate Measurement** (UUID `0x2A37`) que el reloj actualiza automáticamente cada segundo con el BPM actual.

El navegador se "suscribe" a esas actualizaciones (GATT Notifications) y cada vez que el reloj emite un dato, el código JavaScript lo recibe en tiempo real sin tener que pedirlo activamente.

**Limitación importante**: Web Bluetooth solo funciona en Chrome y Edge, y siempre requiere un gesto del usuario (clic de botón) para abrir el selector de dispositivos. Esto es una restricción de privacidad del propio navegador que no se puede saltarse.

---

## Por qué abandonamos la reconexión automática

La versión inicial intentaba una "reconexión silenciosa" cuando el paciente navegaba de una página a otra. La idea era: si el reloj ya estaba conectado en el Dashboard, que se volviera a conectar automáticamente al entrar al juego sin que el paciente tuviera que hacer nada.

Esto no funcionó por una restricción nativa de Chrome: `navigator.bluetooth.getDevices()` (la función que devuelve dispositivos previamente permitidos) solo funciona de forma fiable en la misma pestaña y sesión donde se hizo la conexión original. Al cambiar de URL y recargar la página, el contexto BLE se pierde.

La solución definitiva es más simple y más robusta: **la conexión es siempre manual, en la pantalla de instrucciones de cada juego**. El paciente (o el terapeuta que le ayuda) pulsa el botón antes de empezar, el reloj se conecta, y a partir de ahí la grabación es automática durante el juego.

---

## Dónde vive cada pieza del sistema

### El servicio BLE: `wearable_service.js`

Hay un único archivo JavaScript que contiene toda la lógica de comunicación con el reloj. Se llama `wearable_service.js` y vive en `core/static/core/js/`. Es una librería de una sola carga que expone un objeto global `window.Wearable` con una API limpia.

Este archivo se carga en cada uno de los 4 minijuegos VTR. No se carga en el Dashboard ni en ninguna otra página del sistema, porque ya no se usa la reconexión automática y no tiene sentido tenerlo en páginas donde no se juega.

### El botón de conexión: pantalla de instrucciones de cada juego

Cada minijuego tiene una pantalla de instrucciones que el paciente ve antes de empezar. En esa pantalla, junto al botón verde de "¡Empezar a Jugar!", aparece un botón de "Vincular Reloj".

Este botón:
- **Solo aparece si el navegador soporta Web Bluetooth**. En otros navegadores (Firefox, Safari) simplemente no existe. No hay error, no hay mensaje de fallo.
- Cuando el reloj NO está conectado, muestra un icono de Bluetooth y el texto "Vincular Reloj".
- Cuando el paciente lo pulsa, Chrome abre su selector nativo de dispositivos BLE.
- Cuando la conexión tiene éxito, el botón cambia a icono de corazón rojo y texto "Reloj vinculado". Esto le da feedback claro de que está listo.

Los 4 juegos que tienen este botón son:
- Encuentra la Letra (`juego_encuentra_letra.html`)
- Encuentra la Bolita (`EncuentraLaBolita.html`)
- Lista de la Compra (`ListaCompra.html`)
- Música y Colores (`SecuenciaMusical.html`)

### El icono de corazón fijo: durante el juego

En el momento en que la página carga (no cuando el paciente pulsa el botón), se inyecta automáticamente un pequeño icono de corazón fijo en la esquina superior derecha de la pantalla. Este icono vive por encima de todo el contenido (z-index alto) y permanece visible durante toda la sesión de juego.

- Si el reloj no está conectado: corazón gris, sin animación.
- Si el reloj está conectado: corazón rojo con una animación de latido suave (transform scale, acelerada por hardware). La animación respeta `prefers-reduced-motion` para usuarios con sensibilidad a los movimientos.

El icono no tiene texto. No dice "60 bpm". Es puramente un indicador de estado: conectado / no conectado.

---

## El flujo de los datos, paso a paso

### Fase 1 — Conexión

El paciente (o el terapeuta) pulsa "Vincular Reloj" en la pantalla de instrucciones. Chrome muestra un popup nativo con los dispositivos BLE cercanos que exponen el servicio de frecuencia cardíaca. El usuario selecciona su reloj.

En ese momento, el sistema establece una conexión GATT con el reloj, obtiene el servicio Heart Rate, obtiene la característica Heart Rate Measurement y activa las notificaciones. A partir de ahí, el reloj empujará una muestra de BPM aproximadamente cada segundo, aunque el sistema no hace nada con esas muestras todavía (el "buffer de grabación" está apagado).

### Fase 2 — Inicio del juego y comienzo de la grabación

Cuando el paciente pulsa "¡Empezar a Jugar!", el juego se inicia. En ese mismo momento, si el reloj está conectado, se llama a `startRecording()`. Esto activa el buffer interno: a partir de ahora, cada muestra de BPM que llega del reloj se guarda en un array en memoria.

El paciente no nota nada. El juego funciona exactamente igual que sin reloj. El icono de corazón sigue latiendo silenciosamente en la esquina.

### Fase 3 — Durante el juego

Cada segundo (o con la frecuencia que emita el reloj), llega un valor de BPM. El sistema lo valida: debe estar entre 30 y 220 bpm. Cualquier valor fuera de ese rango se descarta como ruido o artefacto de movimiento. Los valores válidos se acumulan en el array en memoria.

El sistema no hace nada más con esos datos en tiempo real. No los muestra, no los procesa, no los envía. Solo los acumula.

### Fase 4 — Fin del juego y empaquetado de datos

Cuando el juego termina (el paciente completa las 5 rondas y pasa por el modal de autopercepción), se llama a `stopRecording()`. Esta función:

1. Detiene la grabación.
2. Comprueba que haya al menos 3 muestras válidas. Si hay menos de 3 (el reloj se desconectó inmediatamente o hubo muchos artefactos), considera que no hay datos útiles y devuelve `null`.
3. Si hay suficientes datos, calcula en el cliente: FC mínima, FC máxima y FC media.
4. Devuelve un objeto con: `fc_min`, `fc_max`, `fc_avg` y `fc_serie` (el array completo de muestras segundo a segundo).

Estos 4 valores se añaden al payload que el juego ya enviaba al backend con el resultado de la partida.

### Fase 5 — Envío y validación en Django

El frontend hace un POST a `/api/vtr/guardar-partida/` con todos los datos de la partida, incluyendo los FC. Django recibe esos datos y hace una segunda validación en el servidor (nunca se confía ciegamente en el cliente):

- Comprueba que `fc_serie` sea realmente una lista.
- Filtra los valores fuera del rango 30-220 bpm (segunda capa de limpieza).
- Requiere mínimo 3 muestras válidas para considerar los datos fiables.
- Recalcula en el servidor min/max/avg a partir de la serie filtrada (el cliente ya lo hizo, pero el servidor vuelve a hacerlo para garantizar consistencia).

Si los datos pasan la validación, se guardan en la base de datos. Si no, los campos FC quedan a `null` en esa partida y el resto de los datos (puntos, tiempo de reacción, errores) se guardan igualmente. El wearable es aditivo: su fallo no afecta al registro de la partida.

### Fase 6 — Almacenamiento en base de datos

El modelo `SesionDeJuego` tiene 4 campos opcionales añadidos para el wearable:

- `fc_min`: entero nullable, FC mínima en bpm.
- `fc_max`: entero nullable, FC máxima en bpm.
- `fc_avg`: entero nullable, FC media en bpm.
- `fc_serie`: campo JSON nullable, el array completo de muestras.

Todos son opcionales (`null=True, blank=True`). Una partida sin reloj simplemente tiene estos 4 campos a `null`.

---

## Cómo lo ve el médico

### La tabla de partidas

En el panel médico, al abrir el detalle de una sesión de terapia, hay una tabla que lista todas las partidas de esa sesión. Cada fila es una partida. La última columna de la tabla es "FC".

- Si la partida tiene datos de FC: muestra el valor medio en rojo con un icono de corazón pulsante.
- Si la partida no tiene datos de FC: muestra un guion gris "—".

**Todas las filas son clicables**, independientemente de si tienen FC o no. Al hacer clic en cualquier fila, se abre un modal con el detalle de esa partida.

### El modal de detalle de partida

El modal tiene dos secciones:

**Sección superior — Rendimiento cognitivo**

Cinco tarjetas pequeñas en gris neutro que muestran:
- Puntos obtenidos (verde)
- Tiempo de reacción medio en ms (azul)
- TR Ideal según el algoritmo DDA (gris)
- Errores cometidos (rojo si > 0, verde si = 0)
- Degradación del TR respecto al baseline (escala de color: verde / amarillo / rojo)

**Sección inferior — Frecuencia Cardíaca**

Tres tarjetas de colores:
- FC Máxima (fondo rojo suave, texto rojo oscuro)
- FC Mínima (fondo azul suave, texto azul oscuro)
- FC Media (fondo gris neutro, texto oscuro)

Debajo de las tarjetas, la gráfica.

**Si hay datos de FC**: se renderiza una gráfica de línea con Chart.js. El eje X son los segundos desde el inicio de la partida. El eje Y son los bpm. La escala del eje Y es **dinámica**: el mínimo es `max(30, FC_min - 10)` y el máximo es `FC_max + 10`. Esto hace que series con poca variabilidad (paciente en reposo, FC estable de 55 a 60 bpm) se vean como una curva orgánica y legible, en lugar de una línea plana en el centro de una escala fija de 40 a 200.

**Si no hay datos de FC**: las tarjetas muestran "—", el canvas no se renderiza, y en su lugar aparece un mensaje discreto: icono de reloj en gris semitransparente y texto "El paciente no utilizó el reloj en esta partida."

Al cerrar el modal, el gráfico Chart.js se destruye completamente para liberar memoria y evitar que se superpongan instancias si el médico abre varias partidas seguidas.

### La gráfica principal de la sesión

Encima de la tabla de partidas hay una gráfica grande que muestra la evolución a lo largo de toda la sesión. Si alguna partida de esa sesión tiene datos FC, aparece una segunda línea roja en esa gráfica representando la FC media de cada partida. Esta línea usa un eje Y derecho independiente (40-200 bpm) para no interferir con la escala de la línea azul de degradación de TR.

Si ninguna partida tiene FC, la línea roja simplemente no aparece.

---

## Decisiones de diseño que merecen explicación

**Por qué el botón está en la pantalla de instrucciones y no en el menú principal**

El terapeuta suele estar presente cuando el paciente inicia una sesión. La conexión del reloj es una acción de preparación, como abrocharse el cinturón antes de conducir. Colocarla en el menú principal (el Dashboard) implicaba que el paciente o terapeuta tuviera que recordar conectarlo antes de navegar al juego, y el estado de conexión se perdía al cambiar de página. Al ponerlo en la propia pantalla de instrucciones, la conexión y el inicio del juego son acciones contiguas, en la misma pantalla, en el momento correcto.

**Por qué no se muestra la FC en tiempo real durante el juego**

El juego cognitivo requiere atención plena del paciente. Cualquier elemento visual extra que cambie durante el juego es una distracción potencial. Además, ver la propia FC puede generar ansiedad en ciertos pacientes (especialmente los que tienen historial cardíaco), lo que alteraría los propios datos que queremos medir. El icono de corazón latiendo es suficiente para confirmar que el reloj está activo sin revelar información numérica.

**Por qué la validación FC ocurre en dos lugares**

El cliente calcula min/max/avg antes de enviarlos porque es más eficiente (evita mandar el array completo y que el servidor haga todo el trabajo). Pero el servidor siempre recalcula y revalida porque el frontend es código ejecutable por el paciente: podría ser manipulado. La regla de SamiraDTx es que los datos clínicos siempre se validan en el servidor, independientemente de lo que diga el cliente.

**Por qué la escala Y de la gráfica es dinámica**

Un rango fijo de 40-200 bpm tiene sentido para mostrar el espectro completo de frecuencias cardíacas humanas, pero es completamente ilegible para leer la variabilidad de una partida concreta. Si un paciente tiene la FC entre 54 y 62 bpm durante toda la partida, esos 8 bpm de variación quedan aplastados en la mitad del rango de 160 bpm, dando la apariencia de una línea completamente plana. Con la escala dinámica (min - 10 / max + 10), esa misma curva ocupa casi toda la altura del gráfico y el médico puede ver la forma real de la evolución: si subió al principio, si se estabilizó, si hubo picos en ciertos momentos del juego.

---

## Resumen del estado final

El sistema wearable está integrado en 4 juegos cognitivos, es invisible para el paciente salvo por el icono de corazón, recoge datos sin interrumpir el juego, los valida en dos capas, los almacena opcionalmente (sin romper nada si el reloj no se usa), y los expone al médico en una tabla clicable con un modal que combina rendimiento cognitivo y frecuencia cardíaca en la misma vista.

El sistema funciona en Chrome y Edge. En otros navegadores, el botón de vincular simplemente no aparece.
