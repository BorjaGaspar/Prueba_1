# 🧠 SamiraDTx — Resumen Ejecutivo

> **Para quién es esto:** cualquier persona que **no sepa nada de programación** y quiera entender, en lenguaje claro, qué es esta página web, para qué sirve y cómo funciona por dentro. Sin tecnicismos. Con ejemplos del mundo real.

---

## 1. ¿Qué es SamiraDTx en una frase?

Es una **página web con videojuegos para ayudar a recuperarse a personas que han sufrido un ictus** (una lesión cerebral), y que está **vigilada por un médico** a distancia.

Piénsalo como un **gimnasio para el cerebro**, pero online: el paciente "entrena" jugando, la web mide cómo lo hace, y el médico revisa los resultados desde su ordenador, sin tener que estar presente.

---

## 2. ¿Para qué sirve? (el problema que resuelve)

Después de un ictus, muchas personas pierden capacidades como la **memoria, la atención o el lenguaje**. Recuperarlas requiere ejercicios repetidos y supervisados, algo caro y difícil de hacer yendo siempre a una consulta.

SamiraDTx resuelve esto:

- El paciente **entrena desde casa**, jugando.
- La web **adapta la dificultad** a cada persona (ni muy fácil ni muy difícil).
- El médico **lo supervisa todo a distancia**, como una "telemedicina".

---

## 3. Los dos protagonistas

La página tiene en realidad **dos tipos de usuario**, y cada uno ve una versión distinta:

| Quién | Qué ve | Qué hace |
|-------|--------|----------|
| 🧑‍🦽 **El paciente** | Sus juegos, sus puntos, su progreso | Entrena jugando |
| 🩺 **El médico** | La lista de sus pacientes y sus datos | Supervisa y deja mensajes |

> Curiosidad: por dentro, médico y paciente son "la misma ficha", solo que una tiene marcada una casilla que dice *"esto es un médico"*. Según esa casilla, la web le enseña una cosa u otra.

Además hay una **parte pública** (la portada, información, contacto) que puede ver cualquiera sin entrar con contraseña, como cualquier web de empresa.

---

## 4. El recorrido completo de un paciente (paso a paso)

Esta es la historia de principio a fin:

1. **Se registra.** Crea su cuenta y elige a su médico de una lista.

2. **Hace un test inicial (el "MoCA").** Es un examen cognitivo en forma de juego: dibuja, escucha, repite palabras y **habla por el micrófono**. La web entiende lo que dice gracias a una inteligencia artificial que **convierte su voz en texto** (igual que cuando le dictas un mensaje al móvil).

3. **El médico revisa ese test** y, con un clic, una **inteligencia artificial le sugiere un nivel de dificultad del 1 al 5** según los datos del paciente. Así no se elige el nivel "a ojo": lo calcula un sistema entrenado con casos reales.

4. **El paciente entrena jugando.** La web le ofrece mini-juegos adaptados a su nivel (encontrar objetos, recordar listas, secuencias musicales, etc.).

5. **Mientras juega, la web lo mide todo:**
   - **Cómo de rápido reacciona** (si reacciona mucho más lento de lo normal, puede estar cansado).
   - **El pulso del corazón**, si lleva puesta una **pulsera** que se conecta sola por Bluetooth.

6. **La dificultad se ajusta sola.** Si el paciente lo hace muy bien, sube; si le cuesta o está fatigado, baja. Siempre en su punto justo.

7. **El médico lo ve todo** en gráficas: cómo progresa, cómo late su corazón, si está cansado… y puede **mandarle mensajes** a un "buzón" dentro de la web.

---

## 5. Las "inteligencias" de la página (explicadas fácil)

La web es lista por tres motivos:

- 🎙️ **Entiende la voz.** Cuando el paciente habla en el test, un programa transcribe lo que dice automáticamente. El médico no tiene que escuchar todos los audios uno a uno.

- 🎯 **Recomienda el nivel adecuado.** En vez de adivinar, un sistema entrenado con datos médicos predice qué nivel de dificultad le conviene a cada paciente.

- ⚙️ **Se adapta sola mientras juegas.** La dificultad sube y baja en tiempo real según lo bien que vaya y si detecta fatiga. (En el sector esto se llama *dificultad dinámica*.)

> Importante: estas "inteligencias" funcionan **dentro del propio servidor de la web**, no dependen de servicios externos de pago.

---

## 6. ¿Cómo funciona por dentro? (la cocina del restaurante)

Imagina la web como un **restaurante**:

- El **cliente** (el navegador del paciente o del médico) **pide un plato** (entra en una página).
- Un **recepcionista** mira la petición y la manda a la cocina correcta. *(En la web esto es el "mapa de direcciones".)*
- El **cocinero** prepara el plato: busca los ingredientes, hace cuentas, decide qué servir. *(Es el "cerebro" de la web, donde está toda la lógica.)*
- La **despensa** guarda todos los ingredientes y datos. *(Es la base de datos: pacientes, partidas, mensajes, pulso…)*
- El **camarero** presenta el plato bonito en la mesa. *(Son las páginas HTML que finalmente ve el usuario.)*

Todo esto está construido con una tecnología muy usada y fiable llamada **Django** (basada en el lenguaje Python), la misma familia de herramientas que usan webs enormes del mundo real.

---

## 7. Los datos que guarda

La web recuerda, entre otras cosas:

- Quién es cada **paciente** y quién es su **médico**.
- Los **resultados del test** inicial (puntos, dibujos, audios).
- Cada **partida** jugada (puntos, velocidad de reacción, pulso).
- Los **mensajes** entre médico y paciente.
- Las **notas privadas** que el médico apunta sobre cada caso.

> Dato curioso: el pulso del corazón no se guarda en una "ficha de pulsera" aparte, sino **dentro de cada partida**, junto a los puntos de ese juego.

---

## 8. ¿Está lista para usarse de verdad?

La web **funciona y está completa** en cuanto a sus funciones principales (test, niveles, juegos, medición, supervisión médica).

Antes de abrirla al público con pacientes reales, quedan **tareas de seguridad y preparación** típicas de cualquier proyecto (proteger contraseñas, usar conexión segura, cambiar a una base de datos más potente para muchos usuarios). Son ajustes conocidos, no fallos de diseño.

---

## 9. La idea en 5 frases (para recordar)

1. SamiraDTx es un **gimnasio para el cerebro online** para pacientes de ictus.
2. El paciente **entrena jugando** y la web **mide cómo lo hace**.
3. Una **inteligencia artificial** decide el nivel y otra **entiende su voz**.
4. La dificultad **se ajusta sola** según el rendimiento y el cansancio.
5. El **médico supervisa todo a distancia** y se comunica con el paciente.

---

*Para detalles técnicos, consulta el resto de documentos de esta carpeta (empezando por el `00_INDICE.md`). Este resumen es solo la visión general sin tecnicismos.*
