# 🐍 Cómo Funciona Django (Explicado con SamiraDTx)

> **Documento 10 de la serie "Documentación de la Página"**
> Toda la web está construida sobre **Django**. Este documento explica **qué es Django y cómo funciona**, usando como ejemplos los archivos reales de SamiraDTx. Está pensado para que puedas **entenderlo tú y explicárselo a otra persona** (en una defensa, presentación o a un compañero). Va de lo general a lo concreto, sin dar por supuesto nada.

---

## 1. ¿Qué es Django? (la idea base)

**Django es un *framework* web escrito en Python.** Un framework es un "esqueleto con herramientas ya hechas" para construir aplicaciones sin reinventar la rueda.

Una analogía: si construir una web desde cero fuera **construir un coche pieza a pieza**, usar Django es como recibir **un chasis con motor, ruedas y dirección ya montados** — tú solo añades la carrocería y los detalles.

Django se describe como **"batteries included"** (pilas incluidas): trae de fábrica casi todo lo que una web necesita:
- Sistema de **base de datos** (ORM).
- Sistema de **usuarios y login**.
- Panel de **administración** automático.
- Protecciones de **seguridad** (CSRF, inyección SQL, XSS).
- Sistema de **plantillas** HTML.

> 🎯 **Frase para explicarlo:** "Django nos da resueltos los problemas comunes de toda web (usuarios, base de datos, seguridad, rutas) para que nos centremos en lo específico de SamiraDTx: la terapia, los juegos y la IA."

---

## 2. Proyecto vs App (la organización de Django)

Django distingue dos conceptos que en SamiraDTx son:

| Concepto | En SamiraDTx | Qué es |
|----------|--------------|--------|
| **Proyecto** | carpeta `config/` | La configuración global. El "ayuntamiento" que coordina todo. |
| **App** | carpeta `core/` | Un módulo funcional con su lógica. El "barrio" donde vive el trabajo real. |

Un proyecto puede tener **varias apps** (ej: una app de usuarios, otra de pagos, otra de blog). SamiraDTx es sencillo: tiene **una sola app** (`core`) que contiene todo (modelos, vistas, plantillas).

```
webSamiraDTx/          ← carpeta raíz
├── config/            ← EL PROYECTO (configuración)
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py / asgi.py
├── core/              ← LA APP (todo el trabajo)
│   ├── models.py
│   ├── views.py
│   ├── templates/
│   └── ...
└── manage.py          ← el mando a distancia de Django
```

---

## 3. El patrón MVT (el corazón de Django)

Django organiza el código con el patrón **MVT = Model–View–Template**. Es su versión del clásico MVC (Model-View-Controller).

| Capa | Archivo en SamiraDTx | Responsabilidad | Analogía (restaurante) |
|------|---------------------|-----------------|------------------------|
| **Model** | `core/models.py` | Los **datos** y la BD | La **despensa** (ingredientes guardados) |
| **View** | `core/views.py` | La **lógica** (qué hacer) | El **cocinero** (decide y prepara) |
| **Template** | `core/templates/` | La **presentación** (HTML) | El **plato servido** (lo que ve el cliente) |

Y una pieza extra que une todo:
- **URLconf** (`config/urls.py`) → el "**GPS**": mira la dirección que pide el navegador y decide qué cocinero (vista) la atiende.

> 🍽️ **Frase para explicarlo:** "El navegador pide un plato (URL), el GPS (urls.py) avisa al cocinero correcto (view), que coge ingredientes de la despensa (model) y los emplata (template) para servírselo al cliente."

---

## 4. El ciclo petición–respuesta (qué pasa con cada clic)

Esto es **lo más importante que entender**. Cuando un paciente hace clic en "Sala de Terapia", ocurre esto:

```
1. NAVEGADOR pide la URL  →  /terapia/
        │
        ▼
2. config/urls.py busca esa URL en su lista y encuentra:
        path('terapia/', views.juegos, name='juegos')
        │  "esta URL la atiende la función juegos()"
        ▼
3. core/views.py ejecuta la función juegos(request):
        - consulta la base de datos (models) si hace falta
        - prepara los datos (el "contexto")
        - elige una plantilla
        │
        ▼
4. core/templates/core/juegos.html se rellena con esos datos
        │
        ▼
5. Django devuelve el HTML resultante al NAVEGADOR
```

**Ejemplo real, línea a línea, de SamiraDTx:**

`config/urls.py`:
```python
path('terapia/', views.juegos, name='juegos'),
```

`core/views.py`:
```python
@login_required
def juegos(request):
    # ... lógica: ¿hay sesión de terapia activa? ...
    return render(request, 'core/juegos.html', {'sesion_activa': sesion_activa})
```

`render(...)` hace la magia final: coge la plantilla `juegos.html`, le inyecta el diccionario `{'sesion_activa': ...}` y devuelve el HTML.

---

## 5. Los archivos clave de Django (uno por uno)

### 5.1 `manage.py` — el mando a distancia
Es el archivo desde el que se ejecutan **todos los comandos** de Django. No se edita; se usa:
```bash
python manage.py runserver        # arrancar el servidor de desarrollo
python manage.py makemigrations   # detectar cambios en los modelos
python manage.py migrate          # aplicar esos cambios a la BD
python manage.py createsuperuser  # crear un admin
python manage.py check            # verificar que todo está bien
```

### 5.2 `config/settings.py` — la configuración central
El "panel de control" del proyecto. Define (Documento 9 entra en detalle):
- **`INSTALLED_APPS`**: qué apps están activas (incluye `'core'` y las de Django).
- **`DATABASES`**: qué base de datos usar (en SamiraDTx, SQLite).
- **`MIDDLEWARE`**: capas que procesan cada petición (seguridad, sesiones, CSRF…).
- **`TEMPLATES`**: cómo encontrar los HTML.
- Idioma, zona horaria, claves de seguridad, etc.

### 5.3 `config/urls.py` — el mapa de rutas (URLconf)
Una lista que **empareja URLs con vistas**. Cada línea es un `path()`:
```python
path('dashboard/', views.dashboard, name='dashboard'),
#     ▲ la URL        ▲ la vista que la atiende   ▲ nombre interno
```
El `name='dashboard'` permite referirse a esa URL **por su nombre** en lugar de escribirla a mano. En las plantillas:
```django
<a href="{% url 'dashboard' %}">Ir al panel</a>
```
Si algún día cambias la URL de `/dashboard/` a `/panel/`, **no rompes nada**: el nombre sigue funcionando. Esto es clave en SamiraDTx, que usa `{% url '...' %}` en todas las plantillas.

### 5.4 `core/views.py` — la lógica (el cerebro)
Cada **vista** es una función que recibe un `request` y devuelve una respuesta. Tres tipos de respuesta:
```python
return render(request, 'plantilla.html', contexto)   # devuelve HTML
return redirect('dashboard')                          # redirige a otra URL
return JsonResponse({'estado': 'ok'})                 # devuelve datos (API)
```
SamiraDTx tiene ~40 vistas (Documento 3). Ejemplo:
```python
@login_required                          # ← decorador: exige estar logueado
def buzon_paciente(request):
    perfil = get_object_or_404(PerfilPaciente, usuario=request.user)
    notificaciones = perfil.notificaciones.all()      # consulta a la BD
    return render(request, 'core/dashboard/buzon_paciente.html',
                  {'notificaciones': notificaciones})
```

### 5.5 `core/models.py` — los datos (el ORM)
Aquí se definen las **tablas** de la base de datos como **clases de Python**. Esto es el **ORM** (ver sección 6). Ejemplo de SamiraDTx:
```python
class NotaEspecialista(models.Model):
    paciente = models.ForeignKey(PerfilPaciente, on_delete=models.CASCADE)
    texto = models.TextField()
    fecha = models.DateTimeField(default=timezone.now)
```
Cada clase = una tabla. Cada atributo = una columna.

### 5.6 `core/migrations/` — el historial de la BD
Cada vez que cambias `models.py`, Django genera una **migración** (un archivo numerado: `0001`, `0002`…) que describe el cambio. Ver sección 7.

### 5.7 `core/templates/` — las plantillas (la cara)
Archivos HTML con el **lenguaje de plantillas de Django**, que permite meter lógica:
```django
{% if user.perfil.es_medico %}
    <p>Bienvenido, doctor</p>
{% else %}
    <p>Hola, {{ user.first_name }}</p>
{% endif %}

{% for nota in notas %}
    <li>{{ nota.texto }}</li>
{% endfor %}
```
- `{{ variable }}` → **muestra** un valor.
- `{% etiqueta %}` → **ejecuta** lógica (if, for, url, extends…).

### 5.8 `core/forms.py` — los formularios
Django automatiza la creación y validación de formularios. SamiraDTx usa `RegistroUsuarioForm` para el registro (Documento 1). El formulario valida los datos y, al guardarse, crea el `User` y el `PerfilPaciente`.

### 5.9 `core/admin.py` — el panel de administración (gratis)
Registrando un modelo aquí, Django genera **automáticamente** una interfaz de administración en `/admin/` para ver/editar esos datos:
```python
admin.site.register(PerfilPaciente, PerfilPacienteAdmin)
```
Sin escribir HTML, tienes un CRUD completo. Es una de las "pilas incluidas" más potentes de Django.

### 5.10 `static/` — archivos estáticos
CSS, JavaScript, imágenes. En las plantillas se cargan con:
```django
{% load static %}
<img src="{% static 'core/images/logoSamiraDTx.png' %}">
```

---

## 6. El ORM en detalle (hablar con la BD sin SQL)

El **ORM (Object-Relational Mapping)** es quizá lo más característico de Django. Te deja **manipular la base de datos escribiendo Python**, no SQL.

| Lo que quieres hacer | SQL tradicional | Django ORM (lo que usa SamiraDTx) |
|----------------------|-----------------|-----------------------------------|
| Traer todos | `SELECT * FROM nota` | `NotaEspecialista.objects.all()` |
| Filtrar | `SELECT * FROM perfil WHERE es_medico=1` | `PerfilPaciente.objects.filter(es_medico=True)` |
| Uno solo | `SELECT * FROM perfil WHERE id=5` | `PerfilPaciente.objects.get(pk=5)` |
| Crear | `INSERT INTO ...` | `NotaEspecialista.objects.create(texto="...")` |
| Contar | `SELECT COUNT(*) ...` | `notificaciones.filter(leida=False).count()` |

**Ejemplos reales de SamiraDTx:**
```python
# Traer los pacientes de un médico (de dashboard_medico)
mis_pacientes = PerfilPaciente.objects.filter(medico_asignado=request.user)

# Las últimas 2 partidas de un dominio, ordenadas (del DDA)
SesionDeJuego.objects.filter(paciente=perfil, juego__in=lista).order_by('-fecha')[:2]

# Marcar mensajes como leídos (del buzón)
mensajes_sin_leer.update(leida=True)
```

**Las relaciones también son objetos.** Como `NotaEspecialista` tiene un `ForeignKey` a `PerfilPaciente`, puedes navegar la relación:
```python
nota.paciente.usuario.username     # del lado "hijo" al "padre"
perfil.notas.all()                 # del "padre" a los "hijos" (related_name)
```

> 🎯 **Frase para explicarlo:** "El ORM traduce nuestro Python a SQL por debajo. Escribimos `PerfilPaciente.objects.filter(es_medico=True)` y Django genera el `SELECT` correspondiente. Así no mezclamos SQL con Python y evitamos errores de seguridad."

Un `QuerySet` (lo que devuelven estas consultas) es **perezoso**: no toca la BD hasta que realmente usas los datos (al recorrerlos o contarlos). Eso lo hace eficiente.

---

## 7. Las migraciones (cómo evoluciona la base de datos)

Problema: si cambias `models.py` (añades un campo), la base de datos real **no se entera sola**. Las migraciones resuelven esto.

**El flujo (que se ha repetido 18 veces en SamiraDTx, migraciones `0001`–`0018`):**
```
1. Editas models.py (ej: añades el campo fc_avg para el wearable)
        │
        ▼
2. python manage.py makemigrations
        │  Django crea un archivo: 0018_sesiondejuego_fc_avg...py
        │  (describe: "añadir columna fc_avg a la tabla SesionDeJuego")
        ▼
3. python manage.py migrate
        │  Django aplica ese cambio a la base de datos REAL
        ▼
4. La BD ya tiene la columna nueva
```

Las migraciones son como un **control de versiones de la base de datos**: un historial ordenado de todos los cambios. Mirando `core/migrations/` se ve la evolución del proyecto (ej: `0009_notaespecialista` = cuando se añadieron las notas; `0018_..._fc_avg` = cuando llegó el wearable).

> ⚠️ **Importante:** las migraciones se **guardan en git** y se ejecutan en cada entorno (tu PC, el servidor). Así todos tienen la misma estructura de BD.

---

## 8. El sistema de usuarios y login (incluido)

Django trae un sistema de autenticación completo. SamiraDTx lo usa así:
- El modelo **`User`** (de Django) guarda usuario/contraseña/email. No lo creamos nosotros, viene de fábrica.
- SamiraDTx lo **extiende** con `PerfilPaciente` (relación 1:1) para los datos médicos (Documento 1).
- El decorador **`@login_required`** protege vistas: si no estás logueado, te manda al login automáticamente.
- Las rutas de login/logout vienen incluidas: `path('accounts/', include('django.contrib.auth.urls'))`.
- `request.user` siempre contiene al usuario actual.

```python
@login_required          # ← "solo usuarios logueados"
def dashboard(request):
    perfil = PerfilPaciente.objects.get_or_create(usuario=request.user)  # request.user = usuario actual
```

---

## 9. La seguridad que Django da gratis

Django protege automáticamente contra los ataques web más comunes:
| Ataque | Protección de Django |
|--------|---------------------|
| **Inyección SQL** | El ORM escapa todo automáticamente |
| **XSS** (scripts maliciosos) | Las plantillas escapan el HTML por defecto |
| **CSRF** (peticiones falsas) | Token CSRF obligatorio en formularios (`{% csrf_token %}`) |
| **Clickjacking** | Middleware `XFrameOptions` |

En SamiraDTx ves el `{% csrf_token %}` en los formularios y el `X-CSRFToken` en las llamadas fetch de los juegos. (El uso de `@csrf_exempt` en algunas APIs se comenta en el Documento 9.)

---

## 10. Comandos del día a día (chuleta)

```bash
# Arrancar el servidor local (desarrollo)
python manage.py runserver
#   → abre http://127.0.0.1:8000

# Tras cambiar models.py:
python manage.py makemigrations   # crea la migración
python manage.py migrate          # la aplica a la BD

# Crear un usuario administrador (para /admin)
python manage.py createsuperuser

# Comprobar que el proyecto no tiene errores
python manage.py check

# Abrir una consola Python con el proyecto cargado (probar el ORM)
python manage.py shell
```

> 📌 En SamiraDTx, Django y sus dependencias viven en un **entorno virtual / Docker** (por eso `python manage.py check` falla si no está activado el entorno correcto, como vimos al arreglar bugs).

---

## 11. Cómo encaja todo (el mapa completo)

```
                    ┌─────────────────────────────────────┐
   NAVEGADOR ──────▶│  config/urls.py  (mapa de rutas)     │
   pide una URL     └─────────────────────────────────────┘
                                  │ encuentra la vista
                                  ▼
                    ┌─────────────────────────────────────┐
                    │  core/views.py  (lógica / cerebro)   │
                    └─────────────────────────────────────┘
                       │              │               │
              consulta │       usa    │       elige   │
                       ▼              ▼               ▼
         ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐
         │ core/models.py│  │ core/forms.py  │  │ core/templates/  │
         │  (ORM → BD)   │  │ (formularios)  │  │  (HTML final)    │
         └──────────────┘  └────────────────┘  └──────────────────┘
                │                                       │
                ▼                                       ▼
         ┌──────────────┐                      HTML devuelto al
         │ db.sqlite3   │                          NAVEGADOR
         │ (vía migrac.)│
         └──────────────┘

   Configuración global: config/settings.py
   Panel admin gratis:   /admin (core/admin.py)
   Comandos:             manage.py
```

---

## 12. Resumen ejecutivo (la foto en 8 frases)

1. **Django** es un framework web de Python "con pilas incluidas": trae BD, usuarios, admin y seguridad ya resueltos.
2. SamiraDTx tiene un **proyecto** (`config/`, la configuración) y una **app** (`core/`, todo el trabajo).
3. Usa el patrón **MVT**: Model (datos), View (lógica), Template (HTML), unidos por el **URLconf** (`urls.py`).
4. Cada clic sigue el **ciclo petición–respuesta**: URL → vista → (modelos + plantilla) → HTML.
5. El **ORM** permite manejar la base de datos escribiendo Python (`.objects.filter(...)`) en vez de SQL.
6. Las **migraciones** son el control de versiones de la base de datos (en SamiraDTx van de la `0001` a la `0018`).
7. El **sistema de usuarios** y el decorador `@login_required` vienen de fábrica; SamiraDTx extiende `User` con `PerfilPaciente`.
8. Django aporta **seguridad automática** (SQL injection, XSS, CSRF, clickjacking) sin esfuerzo extra.

---

## 13. Glosario Django

- **Framework**: esqueleto con herramientas listas para construir software.
- **Proyecto / App**: la configuración global / un módulo funcional.
- **MVT**: Model-View-Template, la organización del código.
- **URLconf**: el archivo `urls.py` que mapea URLs a vistas.
- **Vista (view)**: función que responde a una URL.
- **Plantilla (template)**: HTML con lógica de Django (`{{ }}`, `{% %}`).
- **ORM**: traductor Python ↔ base de datos.
- **QuerySet**: el resultado de una consulta al ORM (perezoso).
- **Migración**: archivo que registra un cambio en la estructura de la BD.
- **Middleware**: capas que procesan cada petición (seguridad, sesiones…).
- **Context**: el diccionario de datos que la vista pasa a la plantilla.
- **Decorador** (`@login_required`): añade comportamiento a una vista (ej: exigir login).
- **`render` / `redirect` / `JsonResponse`**: las tres formas de responder.

---

## 14. Mini-tutorial: añadir una página nueva a SamiraDTx (para fijar ideas)

Si quisieras añadir una página `/ayuda/`, harías estos 3 pasos (el flujo MVT en acción):

**1. Crear la vista** en `core/views.py`:
```python
def ayuda(request):
    return render(request, 'core/pages/ayuda.html')
```

**2. Registrar la URL** en `config/urls.py`:
```python
path('ayuda/', views.ayuda, name='ayuda'),
```

**3. Crear la plantilla** `core/templates/core/pages/ayuda.html`:
```django
{% extends 'core/layouts/base.html' %}
{% block content %}
    <h1>Página de ayuda</h1>
{% endblock %}
```

Y ya está: al visitar `/ayuda/`, Django ejecuta la vista, renderiza la plantilla y devuelve el HTML. **Ese es el ciclo completo de Django en 3 archivos.**

---

*Fin del Documento 10. Documento fundacional: conviene leerlo antes que el 03 (views) si no conoces Django.*
