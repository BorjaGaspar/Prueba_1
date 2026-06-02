# 🎨 El Frontend — Plantillas, Layouts y Gráficas

> **Documento 7 de la serie "Documentación de la Página"**
> Hasta ahora vimos el "cerebro" (views), la BD y la IA. Este documento explica **lo que el usuario ve**: cómo está montado el HTML, cómo se reutiliza con plantillas base, qué tecnologías de diseño se usan y cómo se dibujan las gráficas del médico. Es la "cara" de SamiraDTx.

---

## 1. ¿Cómo funciona el sistema de plantillas de Django?

Django usa **herencia de plantillas**: defines un "esqueleto" base con huecos (`{% block %}`), y cada página concreta lo "rellena". Así no repites el menú, la cabecera ni los estilos en cada página.

```
layouts/base_private.html  (esqueleto: cabecera + menú + estructura)
        │  {% extends %}
        ├── juegos.html          (rellena el bloque content)
        ├── dashboard.html       (rellena el bloque content)
        ├── games/.../*.html     (rellena el bloque content)
        └── ...
```

Las dos etiquetas clave:
- **`{% extends 'layouts/base_private.html' %}`** → "hereda de este esqueleto".
- **`{% block content %}…{% endblock %}`** → "aquí va mi contenido propio".

---

## 2. Los TRES layouts base (uno por "mundo")

Coherente con los tres mundos del Documento 2:

| Layout | Para | Menú que tiene |
|--------|------|----------------|
| **`base.html`** (72 líneas) | Web pública | Navegación de marketing |
| **`base_private.html`** (218 líneas) | Paciente | Mi Resumen, Sala de Terapia, Buzón |
| **`base_medico.html`** (200 líneas) | Médico | Panel clínico de pacientes |

### Anatomía de `base_private.html` (el del paciente)

Es el más interesante porque está **diseñado para accesibilidad** (pacientes con secuelas de ictus: problemas visuales, motores, cognitivos). Tiene:

**Cabecera fija (TopAppBar):**
- Logo SamiraDTx + icono "neurology".
- Nombre del usuario.
- Botón "Salir" (logout) grande.

**Menú lateral (SideNavBar) en escritorio:**
- Mi Resumen, Sala de Terapia, Buzón Clínico (con **contador de no leídos**), Ajustar Visión.
- El enlace activo se resalta según la URL actual:
  ```django
  {% if request.resolver_match.url_name == 'juegos' %}active{% endif %}
  ```

**Menú inferior (Bottom Nav) en móvil:**
- Iconos masivos para Resumen, Terapia y Buzón (con punto rojo si hay mensajes).

**El badge de notificaciones** (cómo conecta con la BD):
```django
{% if request.user.perfil.notificaciones_sin_leer > 0 %}
    <span class="badge">{{ request.user.perfil.notificaciones_sin_leer }}</span>
{% endif %}
```
Esto usa la **propiedad calculada** `notificaciones_sin_leer` del modelo `PerfilPaciente` (Documento 1). El frontend pregunta a la BD en cada carga.

---

## 3. Las tecnologías de diseño (una mezcla peculiar)

`base_private.html` usa **tres sistemas de estilo a la vez**:

| Tecnología | Para qué se usa aquí |
|-----------|---------------------|
| **Tailwind CSS** (vía CDN) | El layout envolvente (cabecera, menú, rejilla) |
| **Bootstrap 5** (vía CDN) | Componentes dentro de las páginas (modales, botones, grid) |
| **CSS propio** (`<style>` + `styles.css`) | Estilos de accesibilidad personalizados |

> ⚠️ **Detalle técnico clave:** Tailwind se configura con `preflight: false`:
> ```js
> corePlugins: { preflight: false }  // CRÍTICO: No romper Bootstrap
> ```
> Esto evita que Tailwind "resetee" los estilos base y rompa los componentes de Bootstrap. Es un truco para que **ambos frameworks convivan** sin pelearse.

### El diseño de accesibilidad (clases `a11y-*`)
El proyecto tiene una paleta y unas clases pensadas para **alto contraste** (importante para pacientes con problemas visuales tras ictus):
```js
"a11y-bg":     "#F8F9FA"   // fondo crema (no blanco puro, evita deslumbrar)
"a11y-text":   "#333333"   // gris carbón (contraste perfecto)
"a11y-accent": "#FFD700"   // amarillo alto contraste para foco/hover
"a11y-btn-bg": "#1A1A1A"   // negro suave clínico para botones
```
Y las clases `a11y-nav-link` / `a11y-btn-primary` definen:
- **Áreas de clic masivas** (padding grande, fácil de pulsar con poca precisión motora).
- **Bordes gruesos** (4px) y sombras para delimitar bien los objetos.
- **Tipografía Lexend** (fuente diseñada para legibilidad).
- Estados `:hover`/`:focus` muy marcados (para saber siempre dónde estás).

> 🧠 Esto refleja una preocupación real por el usuario final: **personas con discapacidad cognitiva y motora**. El diseño prioriza claridad sobre estética moderna.

---

## 4. El "puente" plantilla → JavaScript

Un patrón que se repite en todo el proyecto: la plantilla Django **inyecta datos en variables JavaScript** para que el JS del juego o la gráfica los use. Ejemplo típico:

```django
<script>
    const NIVEL_DEL_SISTEMA = {{ nivel_inicial }};   // viene de la vista
    const TOKEN_DJANGO = "{{ csrf_token }}";          // token de seguridad
    const JSON_DATOS_JUEGOS = '{{ datos_juegos_json|safe }}';
</script>
<script src="{% static 'core/js/games/.../ListaCompra.js' %}"></script>
```

Y el JavaScript lo recoge:
```js
let nivelUsuario = typeof NIVEL_DEL_SISTEMA !== 'undefined' ? NIVEL_DEL_SISTEMA : 1;
let csrfToken = typeof TOKEN_DJANGO !== 'undefined' ? TOKEN_DJANGO : '';
```

> 🔑 Así es como el **nivel del paciente** (calculado por la IA en el backend) llega hasta el juego en el navegador. Y el **token CSRF** permite que el JS haga peticiones POST seguras a las APIs.

---

## 5. Las gráficas del médico (`analisis_paciente.js`)

El médico tiene paneles con gráficas de evolución. Se dibujan con **Chart.js** en `analisis_paciente.js` (348 líneas). El flujo:

### Paso 1 — Datos desde el backend
La vista `analisis_paciente` (Documento 3) agrupa las sesiones en un diccionario `{juego: {nivel: {fechas, puntos, tiempos, dificultades, animos}}}` y lo pasa como JSON. El JS lo parsea:
```js
const baseDatosJuegos = JSON.parse(JSON_DATOS_JUEGOS);
```

### Paso 2 — Navegación por juego y nivel
- `cargarAnalisis(juego)` → muestra las pestañas de niveles disponibles (solo los que tienen datos).
- `cargarNivel(nivel)` → calcula estadísticas (partidas, máx puntos, ánimo medio) y dibuja.

### Paso 3 — Cuatro gráficas (`dibujarGraficas`)
| Gráfica | Tipo | Color | Mide |
|---------|------|-------|------|
| **Puntuación** | Línea con degradado | Índigo | Rendimiento en el tiempo |
| **Tiempos** | Barras | Azul cielo | Duración de partidas |
| **Dificultad** | Línea | Ámbar | Dificultad percibida (1 Muy Fácil → 5 Muy Difícil) |
| **Ánimo** | Línea | Verde | Estado de ánimo (😢 → 😄, con emojis en el eje) |

### Detalle elegante: el "apagado" de tiempos
Algunos juegos (VASOS, Encuentra la Bolita, Música y Colores) **no tienen un tiempo significativo** (son por rondas, no cronometrados). El JS detecta esos juegos y **atenúa** (opacity 0.6) la tarjeta y la gráfica de tiempos, mostrando "N/A". Así el médico no malinterpreta un dato que no aplica.

```js
if (juegoActivo === 'VASOS' || juegoActivo === 'Encuentra la Bolita' || ...) {
    statAvgTiempo.innerText = "N/A";
    overlayTiemposDisabled.classList.remove('d-none');  // muestra overlay "no aplica"
}
```

### Interpretación del ánimo
```js
function interpretarAnimo(valorMedia) {
    if (valorMedia <= 1.5) return { emoji: "😢" };
    if (valorMedia <= 2.5) return { emoji: "🙁" };
    ...
    return { emoji: "😄" };
}
```
Convierte el número medio en un emoji para lectura rápida del médico.

---

## 6. Estructura de carpetas del frontend (repaso)

```
templates/core/
├── layouts/        → los 3 esqueletos base
├── pages/          → home, servicios, contacto (público)
├── dashboard/      → paneles e index de paciente/médico + buzones
├── patients/       → vistas clínicas (detalle, MoCA, sesiones, evaluación, historia)
├── games/          → pantallas de juego (moca/, cognitivo/, Lenguaje/)
└── juegos.html     → biblioteca de juegos del paciente

templates/registration/
├── login.html
└── registro.html

static/core/
├── styles.css      → estilos globales
├── js/
│   ├── wearable_service.js       → Bluetooth (Doc 6)
│   ├── DashboardMedico/          → analisis_paciente.js (gráficas)
│   └── games/                    → lógica de los juegos JS (Doc 8)
├── images/         → logo, imágenes MoCA
├── audio/          → audios de referencia
└── videos/         → tutoriales
```

---

## 7. Resumen ejecutivo (la foto en 6 frases)

1. El frontend usa **herencia de plantillas** Django: tres layouts base (`base`, `base_private`, `base_medico`), uno por cada "mundo".
2. El layout del paciente está **diseñado para accesibilidad**: alto contraste, botones masivos, tipografía legible (clases `a11y-*`).
3. Conviven **Tailwind + Bootstrap + CSS propio**, con el truco `preflight: false` para que no se peleen.
4. Las plantillas **inyectan datos en variables JavaScript** (nivel del paciente, token CSRF, datos de gráficas) — el puente backend↔frontend.
5. Las gráficas del médico se dibujan con **Chart.js** (`analisis_paciente.js`): puntuación, tiempos, dificultad y ánimo.
6. Pequeños detalles de UX cuidan al usuario: badges de no leídos, "apagado" de métricas que no aplican, emojis de ánimo.

---

## 8. Puntos a explorar / clarificar

- 📐 El proyecto depende de **CDNs externos** (Tailwind, Bootstrap, Chart.js, Google Fonts). Sin internet, el estilo se rompe. Para producción convendría servirlos localmente.
- 🎨 `styles.css` global no se ha detallado aquí; merece una revisión si se quiere unificar el diseño.
- ♿ El enlace "Ajustar Visión" del menú apunta a `#` (placeholder) — funcionalidad de accesibilidad pendiente de implementar.

---

*Fin del Documento 7. Siguiente: el catálogo de juegos (Documento 8).*
