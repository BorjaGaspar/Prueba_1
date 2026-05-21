# 🧠 Sistema VTR — Explicación Completa (Versión Finalizada)

**Fecha:** 19 de Mayo de 2026
**Estado:** ✅ Implementado y funcionando
**Para quién es este documento:** Cualquiera que llegue nuevo al proyecto y no tenga ni idea de qué es el VTR. Aquí se explica la *lógica* y el *porqué*, no tanto el código línea a línea.

---

## 1. ¿Qué es el VTR? (en una frase)

El **VTR (Velocidad / Tiempo de Reacción)** es un sistema que **observa y registra** cómo de rápido reacciona un paciente mientras juega, para que el médico pueda ver **si el paciente se está fatigando a lo largo de una sesión de terapia**.

La idea clínica de fondo: cuando una persona post-ictus se cansa, **no falla más necesariamente, pero sí reacciona más lento**. El tiempo de reacción es un indicador temprano de fatiga, antes incluso de que empiecen los errores.

---

## 2. La regla de oro: el VTR NO interviene

Esto es lo más importante de entender:

> **El VTR es un OBSERVADOR PASIVO. Solo mira y apunta. Nunca cambia el juego, nunca bloquea niveles, nunca le saca pop-ups de aviso al paciente, nunca toca la dificultad.**

El sistema de dificultad dinámica que ya existía (el **DDA**) sigue haciendo su trabajo igual que antes. El VTR vive **al lado**, en paralelo, recogiendo datos sin molestar a nadie. Es como una cámara de seguridad: graba todo, pero no abre ni cierra puertas.

> ⚠️ Conceptos que se descartaron a propósito durante el diseño y que **NO existen** en el sistema final: `strikes`, `fatiga_confirmada`, `modo_asistido`, bloqueo de niveles, líneas rojas de umbral, pop-ups de alarma. Si alguien propone añadirlos, va en contra de la filosofía del VTR.

---

## 3. Los conceptos clave (la lógica)

### 3.1. La "Sesión de Terapia"

Una **sesión** es un bloque de tiempo en el que el paciente está jugando de forma continuada.

- El paciente entra, juega varias partidas seguidas → **todas pertenecen a la misma sesión**.
- Si el paciente para y **no toca nada durante más de 60 minutos**, la siguiente vez que juegue se considera una **sesión nueva**.
- Esto se hace automáticamente: cada partida "renueva" la sesión actualizando un campo `ultima_actividad`. Si pasan más de 60 minutos sin renovar, la sesión se da por terminada.

**¿Por qué agrupar por sesiones?** Porque la fatiga se mide *dentro* de una sesión. No tiene sentido comparar lo rápido que reaccionó el lunes con el martes; lo interesante es ver cómo se va ralentizando *en la misma tarde*, partida a partida.

### 3.2. El cuestionario VAS (¿cómo vienes hoy?)

Antes de empezar a jugar, al paciente se le muestra una ventanita (un modal) preguntándole:

> **"¿Cómo te encuentras hoy?"** — y elige un número del **1 (muy descansado) al 10 (agotado)**.

Detalles de la lógica:
- Aparece **una sola vez por sesión de navegador** (usa `sessionStorage`). Si juega 5 juegos seguidos, no se le pregunta 5 veces.
- Se puede **omitir** ("Prefiero no indicarlo"). El sistema funciona igual sin el dato.
- Este valor (`vas_inicial`) es **puramente informativo**. NO cambia ninguna lógica, NO bloquea nada. Solo le da contexto al médico: "este día el paciente dijo que venía cansado de 8/10, por eso quizá su gráfica está más alta de lo normal".

### 3.3. El "TR Ideal" — la marca personal del paciente

Cada paciente tiene un tiempo de reacción "normal" **distinto para cada juego y cada nivel**. No es lo mismo su velocidad en "Encuentra la Letra" nivel 2 que en "Música y Colores" nivel 4.

El **TR Ideal** es el tiempo de reacción de referencia de ese paciente, para ese juego, en ese nivel concreto. Es su "línea base", su marca personal.

**¿Cómo se calcula?** Con una **media móvil de los 3 tiempos más recientes** (técnica FIFO):

1. **Fase de calibración:** las 3 primeras partidas válidas solo sirven para *aprender*. Se guardan los 3 tiempos (`tiempo1`, `tiempo2`, `tiempo3`) y se hace su media → ese es el primer TR Ideal. Durante esta fase, el sistema dice "Calibrando..." y no calcula degradación todavía.

2. **Fase normal (ventana deslizante FIFO):** a partir de la 4ª partida válida, entra el tiempo nuevo y **se descarta el más antiguo**. Es una cinta transportadora de 3 huecos:
   - `tiempo1` se tira (era el más viejo)
   - `tiempo2` pasa a ser `tiempo1`
   - `tiempo3` pasa a ser `tiempo2`
   - el tiempo nuevo entra como `tiempo3`
   - se recalcula la media → nuevo TR Ideal

**¿Por qué una media móvil y no un valor fijo?** Esto fue una **corrección importante** respecto a la primera versión. Si el TR Ideal se congelara tras las 3 primeras partidas, el sistema castigaría al paciente por mejorar: a medida que su cerebro se recupera (neuroplasticidad) y se vuelve más rápido, su "ideal" antiguo quedaría obsoleto. Con la media móvil, **el TR Ideal se adapta a la mejora real del paciente a lo largo de las semanas**.

### 3.4. Las dos condiciones para que una partida "cuente" en el TR Ideal

No todas las partidas sirven para actualizar la marca personal. Para que un tiempo entre en el cálculo del TR Ideal deben cumplirse **las dos** condiciones:

1. **Ventana fresca:** la partida debe jugarse dentro de los **primeros 10 minutos** de la sesión. Lógica: los primeros minutos el paciente está fresco; ese es su verdadero "mejor tiempo". Si lo midiéramos cuando ya lleva una hora cansado, el "ideal" estaría inflado y nunca detectaríamos fatiga.

2. **Puntuación mínima:** la partida debe tener al menos **300 puntos**. Lógica: si jugó fatal (puntuación muy baja), ese tiempo no representa su capacidad real, fue un mal intento. No contamina la referencia.

Si la partida no cumple ambas, **se registra igualmente** (queda guardada con su tiempo y errores), pero **no toca el TR Ideal**.

### 3.5. La "Degradación" — el número que de verdad le importa al médico

Una vez existe un TR Ideal, cada partida nueva se compara con él:

```
Degradación (%) = ((Tiempo_de_esta_partida − TR_Ideal) / TR_Ideal) × 100
```

Interpretación:
- **Degradación = 0%** → reacciona exactamente como su línea base. Perfecto.
- **Degradación = +30%** → está reaccionando un 30% más lento de lo normal → **señal de fatiga**.
- **Degradación negativa** (−10%) → está reaccionando más rápido que su ideal → buen día / está mejorando.
- **Degradación = "Calibrando"** → todavía no hay TR Ideal (estamos en las 3 primeras partidas). No hay nada con qué comparar aún.

Este porcentaje es lo que dibuja la **línea azul** de la gráfica del médico.

---

### 3.6. La limpieza de los datos (Latencia de Arranque)
Para que los milisegundos recogidos tengan valor clínico, el VTR exige que la medición del tiempo sea pura. El cronómetro de los juegos en el frontend está programado para ignorar las animaciones, las transiciones o los tiempos de lectura.

En juegos de memoria (como Secuencia Musical), el reloj solo empieza a correr en el milisegundo exacto en el que el paciente tiene el control ("¡Tu turno!").

Esto garantiza que se mide la latencia de arranque mental y el tiempo de procesamiento puro, evitando falsos positivos de lentitud provocados por las propias animaciones del juego.

## 4. Cómo está organizada la base de datos

El VTR añadió **2 tablas nuevas** y **modificó 1 tabla existente**.

### Tabla nueva: `SesionTerapia`

Agrupa todas las partidas de un mismo "rato jugando".

| Campo | Para qué sirve |
|-------|----------------|
| `paciente` | A quién pertenece la sesión (FK a PerfilPaciente) |
| `session_id` | Identificador único tipo UUID (usado en la URL del médico) |
| `fecha_inicio` | Cuándo empezó la sesión |
| `ultima_actividad` | Última vez que jugó algo. Si pasan +60 min, la sesión "muere" |
| `vas_inicial` | El número 1-10 del cuestionario de cansancio (puede ser nulo) |
| `duracion_minutos` | Propiedad calculada: `ultima_actividad − fecha_inicio` |

### Tabla nueva: `MarcaPersonalTR`

La "marca personal" del paciente para cada combinación juego + nivel.

| Campo | Para qué sirve |
|-------|----------------|
| `paciente` | De quién es esta marca (FK a PerfilPaciente) |
| `juego` | A qué juego corresponde |
| `nivel` | A qué nivel de dificultad |
| `TR_ideal` | El tiempo de reacción de referencia (en ms). Nulo durante calibración |
| `tiempo1`, `tiempo2`, `tiempo3` | Los 3 tiempos de la ventana móvil FIFO |
| `partidas_base_calculadas` | Cuántas partidas válidas han entrado en el cálculo |

Restricción: solo puede haber **una** `MarcaPersonalTR` por combinación (`paciente`, `juego`, `nivel`). Es la regla `unique_together`.

### Tabla modificada: `SesionDeJuego` (se le añadieron 4 campos)

`SesionDeJuego` ya existía y registra cada partida jugada. El VTR le añadió:

| Campo nuevo | Para qué sirve |
|-------------|----------------|
| `sesion_terapia` | A qué `SesionTerapia` pertenece esta partida (FK, puede ser nulo) |
| `tiempo_reaccion_ms` | El tiempo de reacción medido en esta partida (ms) |
| `degradacion_porcentaje` | El % de degradación calculado. Nulo si estaba calibrando |
| `errores_cometidos` | Cuántos errores cometió en la partida (por defecto 0) |

> **Nota importante sobre el TR Ideal histórico:** el TR Ideal NO se guarda en cada partida (es un valor vivo que va cambiando en `MarcaPersonalTR`). Para mostrar en la tabla del médico qué TR Ideal se usó *en cada partida concreta*, se recalcula al revés desde los datos guardados:
> ```
> TR_Ideal_de_esa_partida = tiempo_reaccion_ms / (1 + degradacion_porcentaje / 100)
> ```
> Así el médico ve cómo se fue desplazando el TR Ideal partida a partida.

---

## 5. El recorrido completo de un dato (de principio a fin)

Esto es lo que pasa, paso a paso, cuando un paciente juega:

```
1. Paciente entra en "Sala de Terapia" y pulsa JUGAR en un minijuego
        ↓
2. Aparece el modal VAS: "¿Cómo te encuentras hoy? (1-10)"
   - Responde o lo omite
        ↓
3. El navegador hace POST a /api/vtr/iniciar-sesion/ con el VAS
   - El backend busca si hay una sesión activa (<60 min de inactividad)
   - Si la hay → la reutiliza. Si no → crea una SesionTerapia nueva
        ↓
4. Se carga el minijuego. El paciente juega.
   - El JavaScript del juego mide el tiempo de reacción (cronómetro
     interno, distinto en cada juego) y cuenta los errores
        ↓
5. Al terminar la partida, el juego hace POST a /api/vtr/guardar-partida/
   con: juego, nivel, puntos, tiempo_reaccion_ms, errores_cometidos...
        ↓
6. El backend (vtr_guardar_partida):
   a) Obtiene/reutiliza la sesión activa
   b) Llama a actualizar_marca_personal():
      - ¿Está dentro de los primeros 10 min Y puntuó ≥300?
        · SÍ → actualiza el TR Ideal (calibración o FIFO)
        · NO → no toca el TR Ideal
   c) Calcula la degradación comparando con el TR Ideal actual
   d) Crea el registro SesionDeJuego con todos los datos VTR
   e) Renueva ultima_actividad de la sesión
   f) Llama a evaluar_ajuste_dinamico() → el DDA de siempre, intacto
        ↓
7. Responde {"estado": "ok"}. El juego NUNCA recibe órdenes.
```

**Punto crítico:** en el paso 6f, el VTR llama explícitamente al **DDA original**. Esto es vital: al mover los juegos del endpoint viejo (`/api/guardar-progreso/`) al nuevo (`/api/vtr/guardar-partida/`), había que asegurarse de que el sistema de dificultad dinámica seguía disparándose. Y así es: el DDA funciona exactamente igual que antes.

---

## 6. Lo que ve el médico (el panel)

El médico tiene acceso a dos pantallas nuevas:

### Pantalla 1: Lista de sesiones
Ruta: desde el perfil del paciente, botón **"Sesiones VTR"**.

Una tabla con todas las sesiones de terapia del paciente: fecha y hora, duración, cansancio declarado (VAS, con colores verde/amarillo/rojo), número de partidas, y un botón "Ver gráfica".

### Pantalla 2: Detalle de una sesión (la gráfica)
La pantalla estrella. Tiene:

- **4 tarjetas resumen:** duración, VAS inicial, nº de partidas, juegos jugados.
- **Una gráfica limpia (Chart.js)** con:
  - **Línea azul** = degradación del tiempo de reacción (%) a lo largo de las partidas. Si sube, el paciente se está fatigando.
  - **Zona gris de fondo** = el periodo de calibración (las primeras partidas, donde aún no había TR Ideal).
  - *(Decisión de diseño)* Los errores **NO** se dibujan en la gráfica. Se decidió dejar la gráfica con una sola línea para que sea elegante y legible. Si el médico ve un pico de fatiga y se pregunta "¿cometió errores aquí?", solo tiene que bajar la mirada a la tabla de abajo.
- **Tabla de detalle por partida:** nº, juego, nivel, puntos, TR (ms), **TR Ideal (ms)**, errores, y degradación (con etiquetas de color).

---

## 7. Diferencias respecto al plan original

Es normal que el plan inicial y el resultado final no coincidan al 100%. Los cambios principales fueron:

1. **TR Ideal: de "fijo" a "media móvil FIFO".** El plan original congelaba el TR Ideal tras 3 partidas. Se corrigió a una media móvil deslizante para que el sistema se adapte a la mejora del paciente (neuroplasticidad). Es el cambio conceptual más importante.

2. **Errores fuera de la gráfica.** El plan contemplaba dibujar los errores como barras rojas en la propia gráfica (doble eje Y). Se decidió quitarlos de la gráfica y dejarlos solo en la tabla, por estética y claridad. La gráfica final tiene una sola línea.

3. **Columna "TR Ideal" en la tabla.** No estaba en el plan inicial. Se añadió para que el médico no solo vea el % de diferencia, sino también el valor de referencia y cómo se fue moviendo.

4. **Preservación explícita del DDA.** Al cambiar de endpoint, se tuvo que añadir manualmente la llamada al DDA dentro del nuevo `vtr_guardar_partida` para no romper el sistema de dificultad existente.

---

## 8. Resumen para quien tenga prisa

- El VTR mide **cuánto tarda en reaccionar** el paciente y lo compara con su **marca personal (TR Ideal)**.
- Si reacciona más lento de lo normal → **degradación alta → señal de fatiga**.
- El TR Ideal se aprende en los **primeros 10 minutos** de cada sesión (con partidas de ≥300 puntos) y se va **adaptando con una media móvil de 3 tiempos**.
- Todo se agrupa por **sesiones** (corte por 60 min de inactividad).
- El médico ve una **gráfica de una sola línea azul** (fatiga) + una **tabla con el detalle**.
- El VTR **solo observa**. El sistema de dificultad (DDA) sigue funcionando aparte, sin cambios.

---

**Documento generado:** 19 de Mayo de 2026
**Estado:** Sistema VTR completo y operativo
