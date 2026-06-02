# 🏥 Flujo de Trabajo Clínico y Usabilidad (El "Patient Journey")

> **Documento 12 de la serie "Documentación de la Página"**
> Los documentos anteriores explican la **tecnología** (vistas, plantillas, IA, base de datos). Este explica el **uso real**: cómo encaja SamiraDTx en el día a día de una clínica o un hospital, qué hace cada persona y en qué orden, y —muy importante— **cómo el diseño está adaptado a pacientes con secuelas neurológicas** (problemas visuales, motores, cognitivos y de fatiga tras un ictus).
>
> Es el documento "humano": no habla de código, habla de **personas usando el sistema**.

---

## 1. Los actores del flujo clínico

| Actor | Quién es | Qué hace en el sistema |
|-------|----------|------------------------|
| **El Especialista** | Neurólogo, médico rehabilitador o terapeuta | Da de alta al paciente, define/valida su nivel, supervisa a distancia, toma decisiones |
| **El Paciente** | Persona en rehabilitación post-ictus | Hace el test inicial y entrena con los juegos terapéuticos |
| **El Cuidador** (implícito) | Familiar o auxiliar | Puede ayudar al paciente a usar la plataforma en casa |
| **El Sistema (SamiraDTx)** | La propia plataforma | Mide, personaliza (IA + DDA), alerta y comunica automáticamente |

---

## 2. Visión global: las 3 fases del viaje

```
   FASE 1: ALTA              FASE 2: TERAPIA            FASE 3: SUPERVISIÓN
   (en consulta)             (en casa o clínica)        (remota, asíncrona)
   ───────────────           ──────────────────         ───────────────────
   El especialista     ──►   El paciente entrena   ──►  El médico revisa el
   registra al              con juegos adaptados        dashboard, decide y
   paciente y queda         a su nivel; el sistema      ajusta el tratamiento
   asignado a él            mide todo automáticamente
        ▲                                                       │
        └───────────────────────────────────────────────────────┘
              El ciclo se repite: el médico puede re-evaluar
              y la terapia se readapta continuamente
```

Este es un modelo de **telemedicina asíncrona** ("Store & Forward"): paciente y médico **no necesitan estar conectados a la vez**. El paciente genera datos cuando puede; el médico los revisa cuando puede.

---

## 3. FASE 1 — Alta del paciente (la consulta inicial)

### El acto clínico
En la consulta, el especialista incorpora al paciente al programa de rehabilitación digital. A partir de ese momento, el paciente queda **vinculado a su médico** (`medico_asignado`, ver Documento 1), de modo que todo lo que haga aparecerá en el panel de ese especialista y de ningún otro.

### Cómo ocurre en la plataforma (implementación actual)
El alta se materializa con el **formulario de registro** (`registro.html` + `RegistroUsuarioForm`), donde se capturan dos bloques de datos:

**A) Datos de cuenta y personales:** nombre, apellidos, email, usuario y contraseña.

**B) Datos clínicos que alimentan la IA** (Documento 5):
- Edad, años de escolarización, sexo.
- **Meses desde el ictus**, **tipo de ictus** (isquémico/hemorrágico).
- **Hemisferio afectado**, **hemiparesia dominante**, lado corporal afectado.
- Ciudad y lugar habitual de residencia.

**C) Selección del médico supervisor:** un desplegable obligatorio (`medico_selector`) donde se elige al especialista responsable. Esto crea la relación clínica médico↔paciente.

> 📌 **Nota de fidelidad al código:** en la versión actual, el registro es de **auto-alta**: el paciente (o un cuidador/clínico en su nombre) rellena el formulario y selecciona al médico de la lista. El panel del médico muestra un botón **"Nuevo Paciente"** (`person_add`), pero hoy es un **placeholder visual** sin función conectada. Es decir, el "dar de alta" formal lo dispara el formulario de registro, y el médico **confirma clínicamente** al paciente cuando revisa y valida su primer test (Fase 3). Conviene tenerlo en cuenta si en el futuro se quiere que sea el médico quien cree las cuentas directamente.

### El "portero" que ordena el flujo
Tras registrarse, el paciente no puede saltar directamente a jugar. La vista `dashboard` actúa de **portero** (Documento 3):
```
¿Es médico?            → va al panel médico
¿Test sin completar?   → obligado a hacer la evaluación inicial
Si todo OK             → entra a la sala de terapia
```
Esto **garantiza una secuencia clínica correcta**: nadie entrena sin haber sido evaluado primero.

---

## 4. FASE 2 — La terapia (el día a día del paciente)

Es la fase donde el paciente pasa la mayor parte del tiempo, y donde el diseño **accesible** es crítico.

### 4.1 El test inicial (MoCA)
La primera vez, el paciente realiza la evaluación cognitiva (Documento 4): habla por el micrófono, dibuja, responde preguntas de orientación. El sistema lo transcribe con IA (Whisper) y guarda todo. Esto produce un **nivel cognitivo provisional** (1–5).

### 4.2 El chequeo de fatiga antes de cada sesión (test VAS)
Antes de empezar a jugar, si no hay una sesión de terapia activa, aparece un **modal grande y amable** ("¿Cómo te encuentras hoy?") con una **escala visual del 1 al 10** de cansancio (VAS = Escala Visual Analógica):
- "1 · Muy descansado" … "10 · Agotado", con colores verde→rojo.
- El paciente toca un número (botones grandes de 58px de alto) y confirma.
- Esto abre una **`SesionTerapia`** en el backend (`/api/vtr/iniciar-sesion/`) registrando su fatiga inicial.

> Este dato subjetivo se cruza luego con las medidas objetivas (VTR + pulso) para una imagen completa del estado del paciente (Documento 6).

### 4.3 La navegación por el catálogo (diseño guiado, sin abrumar)
La Sala de Terapia (`juegos.html`) usa una **máquina de estados de 4 pasos** que guía al paciente sin saturarlo de opciones de golpe:

```
Inicio  →  Pilares  →  Subcategorías  →  Juegos
           (Cognitivo / Lenguaje / Motor)
```
1. **Pilares**: tres grandes áreas (Cognitivo 👁️, Lenguaje 💬, Motor ✋).
2. **Subcategorías**: dentro de cada pilar (ej. Cognitivo → Atención, Memoria, Lógica, Velocidad, Visuoespacial).
3. **Juegos**: finalmente los ejercicios concretos (Encuentra la Letra, Lista de la Compra…).
4. Si una subcategoría aún no tiene juegos → cartel **"En desarrollo / validándose clínicamente"**.

Siempre hay un botón **"Volver"** claro para no perderse. Esto reduce la **carga cognitiva**: el paciente toma decisiones simples, una a una.

### 4.4 Dentro del juego: cada partida
Cada ejercicio (Documento 8) arranca en la dificultad del nivel del paciente y, mientras juega:
- Mide su **tiempo de reacción** (VTR) y errores.
- Lee su **pulso** si tiene la pulsera vinculada (wearable, Documento 6).
- Al terminar, le pregunta cómo de **difícil** lo vio y su **estado de ánimo** (modal con emojis).

### 4.5 La adaptación invisible (el sistema cuida solo al paciente)
Aquí está la magia clínica: **el sistema ajusta la terapia sin que el paciente ni el médico tengan que intervenir cada día.** El **DDA** (Documento 3):
- Si el paciente **domina** los ejercicios (puntúa alto y los ve fáciles dos veces seguidas) → **sube** el nivel para mantener el reto.
- Si el paciente **sufre** (puntúa bajo o los ve "muy difíciles") → **baja** el nivel para **evitar la frustración y el abandono terapéutico**.
- Cada ajuste genera una **nota clínica** para el médico y un **mensaje motivador** para el paciente.

> 🧠 Esto refleja un principio de rehabilitación: el ejercicio debe estar en la **"zona de desafío óptimo"** — ni tan fácil que aburra, ni tan difícil que desmotive.

---

## 5. La usabilidad adaptada a secuelas neurológicas ⭐

Esta es la sección que más diferencia a SamiraDTx de una app genérica. El paciente post-ictus puede tener **hemianopsia** (pérdida de campo visual), **hemiparesia** (debilidad de un lado), **fatiga**, **lentitud de procesamiento** o **déficit de atención**. El diseño responde a cada una:

### 5.1 Para problemas VISUALES
- **Alto contraste deliberado**: fondo crema `#F8F9FA` (no blanco puro, que deslumbra) y texto gris carbón `#333333` (clases `a11y-*`, Documento 7).
- **Tipografía Lexend**, diseñada para legibilidad, en tamaños grandes (títulos hasta 2.5rem, texto pequeño subido a 1.1rem).
- **Bordes gruesos (4px)** y sombras para delimitar claramente cada objeto.
- Amarillo de alto contraste `#FFD700` para indicar foco/hover.

### 5.2 Para problemas MOTORES (hemiparesia, temblor, poca precisión)
- **Áreas de clic masivas**: botones y tarjetas enormes, fáciles de pulsar aunque la mano no sea precisa.
- **Botones del VAS de 58px de alto**; botones de acción con padding generoso.
- **Indicadores de hover inequívocos**: al pasar por encima, las tarjetas se elevan y muestran un **contorno negro de 4px** (`outline`), dejando clarísimo qué está seleccionado.
- **Menú inferior en móvil** con iconos gigantes (resumen, terapia, buzón).

### 5.3 Para problemas COGNITIVOS y de ATENCIÓN
- **Navegación por pasos** (máquina de estados): pocas decisiones a la vez, nunca una pantalla saturada.
- **Botón "Volver" siempre visible**: el paciente nunca se siente atrapado.
- **Instrucciones por voz**: cada juego tiene un botón "Leer instrucciones" que usa síntesis de voz (`SpeechSynthesis`) en español y **a ritmo lento** (`rate 0.85`) para pacientes con dificultad lectora.
- **Lenguaje amable y refuerzo positivo**: medallas (🥇🥈🥉), mensajes de ánimo, emojis.

### 5.4 Para la FATIGA (clave en el ictus)
- **Test VAS de cansancio** antes de cada sesión.
- **Medición objetiva de fatiga** (degradación del tiempo de reacción + frecuencia cardíaca).
- **DDA preventivo**: baja la dificultad al detectar fatiga, en lugar de dejar que el paciente colapse.
- **Sesiones agrupadas** con timeout de inactividad (60 min): no presiona al paciente a seguir.

### 5.5 Accesibilidad técnica
- Respeta `prefers-reduced-motion` (el corazón del wearable no late si el usuario desactivó animaciones).
- Opción "Prefiero no indicarlo" en el VAS (nunca obliga).
- Etiquetas ARIA y roles en los modales.

> 🎯 **En resumen:** cada elección de diseño (color, tamaño, voz, pasos, refuerzo) está pensada para que una persona con secuelas neurológicas pueda usar la plataforma **de forma autónoma y sin frustración**.

---

## 6. FASE 3 — La supervisión remota (la decisión clínica)

Mientras el paciente entrena (quizá en su casa, a kilómetros), el médico **supervisa a distancia** y toma decisiones. Su recorrido:

### 6.1 El panel del especialista (`dashboard_medico`)
Al entrar, el médico ve:
- **Resumen de actividad**: total de pacientes asignados, mensajes nuevos.
- **Tabla de "Mis Pacientes Asignados"**, cada uno con su **nivel cognitivo codificado por color**:
  | Nivel | Etiqueta clínica |
  |-------|------------------|
  | 1 | 🔴 Severo |
  | 2 | 🟠 Moderado |
  | 3 | 🔵 Leve |
  | 4 | 🟣 Límite |
  | 5 | 🟢 Normal |
  | — | ⚪ Sin Evaluar |

De un vistazo, el médico prioriza: ve quién está peor (rojo) y quién falta por evaluar (gris).

### 6.2 La ficha del paciente y la toma de decisiones
Desde la tabla, el médico puede:
- **👁️ Ver la ficha completa** (`detalle_paciente`): datos clínicos, niveles, y **escribir notas** en el historial.
- **Ajustar los niveles a mano** (Cognitivo, Lenguaje, Motor) si su criterio clínico difiere de lo que sugirió la IA.
- **🔄 Forzar una re-evaluación** (`forzar_evaluacion`): con un botón que muestra una **confirmación de seguridad** ("El paciente perderá su nivel actual y deberá repetir el Test Inicial") antes de actuar. Esto reinicia el ciclo.

### 6.3 La auditoría del test cognitivo
Cuando un paciente completa un MoCA, el médico lo revisa en `auditoria_moca` (Documento 4):
- Ve los **dibujos** del paciente, **escucha los audios**, lee las **transcripciones**.
- Corrige las puntuaciones si la IA o el sistema se equivocaron.
- Al validar, la **IA le sugiere un nivel** y él **confirma o cambia**. La IA propone; el médico decide.

### 6.4 El análisis de evolución (gráficas)
En `analisis_paciente` (Documento 7), el médico ve la **evolución temporal** por juego y nivel: puntuación, tiempos, dificultad percibida y ánimo (con emojis). Y en `detalle_sesion_terapia`, las **curvas de fatiga** (degradación VTR + frecuencia cardíaca de cada sesión). Esto le permite responder preguntas clínicas reales: *¿está mejorando? ¿se fatiga demasiado? ¿hay que cambiar el plan?*

### 6.5 La comunicación con el paciente
El médico escribe mensajes al **buzón** del paciente (`buzon_paciente_medico`). El paciente los ve en su `/buzon/` (y se marcan como leídos al abrirlos). Es el canal de **acompañamiento humano** dentro de la plataforma.

---

## 7. El ciclo completo (cómo se realimenta todo)

```
  CONSULTA          CASA / CLÍNICA              SUPERVISIÓN REMOTA
  ────────          ──────────────              ──────────────────
  Alta + datos  →   Test MoCA inicial      →    Médico audita el test
  clínicos          (voz, dibujo, IA)            y valida el nivel (con IA)
                          │                              │
                          ▼                              ▼
                    Terapia diaria adaptada   ◄──   Nivel personalizado
                    (juegos + VTR + pulso)         aplicado al paciente
                          │                              ▲
                          ▼                              │
                    DDA ajusta dificultad    ──►   Notas clínicas
                    automáticamente                automáticas + gráficas
                          │                              │
                          ▼                              ▼
                    Mensajes/ánimo           ◄──   Médico revisa evolución,
                    en el buzón                    re-evalúa si hace falta
                          └──────────────┬───────────────┘
                                         ▼
                              El ciclo se repite y la terapia
                              se reajusta de forma continua
```

---

## 8. Resumen ejecutivo (la foto en 8 frases)

1. SamiraDTx implementa un modelo de **telemedicina asíncrona** ("Store & Forward") en tres fases: alta, terapia y supervisión remota.
2. En el **alta**, el paciente queda vinculado a un médico y se capturan los datos clínicos que alimentan la IA.
3. Un **"portero" digital** obliga a evaluarse antes de entrenar, garantizando la secuencia clínica correcta.
4. La **terapia** está guiada paso a paso (Pilares → Subcategorías → Juegos) para no abrumar, con un chequeo de fatiga (VAS) antes de cada sesión.
5. El sistema **adapta la dificultad solo** (DDA) para mantener al paciente en la zona de desafío óptimo y evitar el abandono.
6. La **usabilidad está diseñada para secuelas neurológicas**: alto contraste, botones masivos, instrucciones por voz, navegación simple y refuerzo positivo.
7. El **médico supervisa a distancia**: ve niveles codificados por color, audita tests, ajusta niveles, lee gráficas de evolución y fatiga, y se comunica por buzón.
8. Todo forma un **ciclo continuo**: el paciente genera datos, el sistema adapta, el médico decide, y la terapia se reajusta sin parar.

---

## 9. Puntos a explorar / mejorar (clínicos y de usabilidad)

- 🔧 El botón **"Nuevo Paciente"** del panel médico es un placeholder: si se quiere un alta dirigida por el médico, falta implementar esa vista.
- 📊 La tarjeta "Mensajes Nuevos" del dashboard médico muestra **0 fijo** (hardcodeado), no el conteo real → mejora pendiente.
- ♿ El enlace "Ajustar Visión" del menú del paciente aún no tiene funcionalidad (sería valioso: tamaño de fuente, modo alto contraste real).
- 🏥 Para uso hospitalario real, convendría: roles más finos (auxiliar, supervisor), informes exportables (PDF) para la historia clínica, y cumplimiento RGPD reforzado (Documento 9).

---

*Fin del Documento 12.*
