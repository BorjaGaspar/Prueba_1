# 🔒🚀 Seguridad y Despliegue

> **Documento 9 de la serie "Documentación de la Página"**
> Este documento cubre lo que hay que saber **antes de poner SamiraDTx en producción** con pacientes reales: cómo está configurada la seguridad (y qué riesgos hay ahora mismo), cómo se despliega con Docker, y una lista priorizada de cosas a arreglar. Al tratarse de **software médico con datos sensibles**, esta parte es crítica.

---

## ⚠️ Aviso importante

El proyecto está actualmente configurado en **modo desarrollo**. Varios ajustes son cómodos para programar pero **peligrosos en producción**, sobre todo manejando datos clínicos de pacientes (sujetos a RGPD en España/UE). Esta sección señala esos puntos **no para alarmar, sino para tener una checklist clara** antes del despliegue real.

---

## 1. Configuración de seguridad actual (`config/settings.py`)

| Ajuste | Valor actual | Riesgo | Qué debería ser en producción |
|--------|-------------|--------|-------------------------------|
| `DEBUG` | `True` | 🔴 Alto | `False` (con `True`, los errores muestran código y datos internos al usuario) |
| `SECRET_KEY` | Escrita en el código | 🔴 Alto | Leerla de una **variable de entorno**, nunca en el repositorio |
| `ALLOWED_HOSTS` | `['*']` | 🟠 Medio | Lista concreta de dominios (`['test.evidagroup.es']`) |
| `DATABASES` | SQLite (`db.sqlite3`) | 🟠 Medio | **PostgreSQL** para múltiples usuarios concurrentes |
| `CSRF_TRUSTED_ORIGINS` | `['https://test.evidagroup.es']` | 🟢 OK | Bien configurado |
| Cifrado HTTPS | No forzado en settings | 🟠 Medio | `SECURE_SSL_REDIRECT`, cookies seguras |

### Detalle de cada riesgo

**🔴 `DEBUG = True`** — Cuando hay un error, Django muestra una página con el **código fuente, variables y configuración**. En producción, un atacante podría provocar errores para ver información interna. Además, `DEBUG=True` desactiva `ALLOWED_HOSTS`.

**🔴 `SECRET_KEY` en el código** — Esta clave firma las sesiones y los tokens. Si está en el repositorio (y en git), cualquiera con acceso al código puede **falsificar sesiones**. Debe ir en una variable de entorno (`os.environ`).

**🟠 `ALLOWED_HOSTS = ['*']`** — Acepta peticiones de cualquier dominio. Permite ataques de "Host header injection". Debe limitarse a los dominios reales.

**🟠 SQLite** — Un solo archivo, no soporta bien escrituras concurrentes. Para una clínica con varios pacientes y médicos a la vez, conviene **PostgreSQL**.

---

## 2. El tema del CSRF y las APIs

Varias APIs usan el decorador **`@csrf_exempt`**:
```python
@csrf_exempt
def guardar_progreso(request): ...

@csrf_exempt
def transcribir_audio(request): ...

@csrf_exempt
@login_required
def vtr_guardar_partida(request): ...
```

**¿Qué significa?** Desactiva la protección CSRF (Cross-Site Request Forgery) en esas rutas.

**¿Por qué se hizo?** Porque las llaman juegos JavaScript/Unity, y era más cómodo no lidiar con el token.

**¿Es un problema?** Parcialmente mitigado:
- Las APIs VTR también tienen `@login_required` (hay que estar logueado).
- Los juegos JS **sí mandan** el token (`X-CSRFToken: csrfToken`), así que el `@csrf_exempt` es innecesario en esos casos.

**Recomendación:** quitar `@csrf_exempt` donde el frontend ya manda el token (los juegos JS lo hacen) y usar el sistema CSRF normal de Django. Mantenerlo solo donde sea estrictamente necesario (quizá Unity).

> 📌 **Matiz:** `guardar_progreso` y `transcribir_audio` **no tienen `@login_required`** → cualquiera podría llamarlas sin estar autenticado. Revisar si es intencionado.

---

## 3. Privacidad de datos clínicos (RGPD)

SamiraDTx guarda **datos médicos sensibles**: diagnóstico de ictus, puntuaciones cognitivas, audios de voz, dibujos, frecuencia cardíaca. En la UE esto es **categoría especial de datos** (RGPD Art. 9). Consideraciones:

- 🔐 **Cifrado en reposo:** los audios/dibujos Base64 están en texto plano en la BD. Convendría cifrar la BD o los campos sensibles.
- 🔐 **Cifrado en tránsito:** forzar HTTPS siempre.
- 📋 **Consentimiento:** el registro debería incluir consentimiento informado explícito.
- 🗑️ **Derecho al olvido:** mecanismo para borrar todos los datos de un paciente a petición (el `CASCADE` del modelo ayuda: borrar el `User` borra todo lo asociado).
- 👥 **Control de acceso:** verificar que un médico solo ve **sus** pacientes (actualmente `dashboard_medico` filtra por `medico_asignado`, pero algunas vistas de detalle como `detalle_paciente` reciben un `pk` directo — conviene comprobar que un médico no pueda ver pacientes de otro cambiando el ID en la URL).

> 🔍 **Punto a auditar (IDOR):** vistas como `detalle_paciente(request, pk)`, `auditoria_moca(request, pk_evaluacion)` o `analisis_paciente(request, pk)` cargan el objeto por `pk` sin verificar que pertenezca al médico logueado. Un médico autenticado podría ver datos de pacientes que no son suyos manipulando la URL. **Recomendación:** añadir comprobación `if paciente.medico_asignado != request.user: redirect(...)`.

---

## 4. Despliegue con Docker

El proyecto está preparado para Docker:

| Archivo | Para qué |
|---------|----------|
| `Dockerfile` | Receta para construir la imagen (instala Python, dependencias, copia el código) |
| `docker-compose.yml` | Orquestación para **desarrollo** |
| `docker-prod-compose.yml` | Orquestación para **producción** |
| `.dockerignore` | Qué archivos no meter en la imagen |

### Lo que hace pesado el despliegue
El `requirements.txt` incluye dependencias **muy grandes**:
- **`torch` (PyTorch CPU)** — cientos de MB.
- **`openai-whisper`** — el modelo de transcripción.
- **`scikit-learn`, `pandas`, `numpy`, `numba`** — el stack de IA.

Esto significa que la imagen Docker será **grande** (varios GB) y la primera carga de Whisper/modelo será lenta. Es el precio de correr **IA en local** sin depender de APIs externas.

### `ffmpeg.exe`
Está en la raíz del proyecto porque **Whisper lo necesita** para decodificar audio. En el contenedor Docker (Linux) habría que instalar `ffmpeg` vía `apt`, no usar el `.exe` de Windows.

> ⚠️ El `ffmpeg.exe` es un binario de Windows. En producción Linux/Docker hay que asegurarse de que `ffmpeg` esté instalado en el contenedor.

---

## 5. Checklist priorizada antes de producción

### 🔴 Crítico (hacer sí o sí)
- [ ] `DEBUG = False`
- [ ] Mover `SECRET_KEY` a variable de entorno
- [ ] `ALLOWED_HOSTS` con dominios concretos
- [ ] Forzar HTTPS (redirect + cookies seguras)
- [ ] Auditar control de acceso (IDOR) en vistas con `pk`

### 🟠 Importante
- [ ] Migrar de SQLite a PostgreSQL
- [ ] Revisar `@csrf_exempt` y `@login_required` en las APIs
- [ ] Cifrado de datos clínicos sensibles
- [ ] Asegurar `ffmpeg` en el contenedor

### 🟢 Mejora
- [ ] Servir CSS/JS de CDN localmente (independencia de internet)
- [ ] Logging y monitorización de errores
- [ ] Backups automáticos de la BD
- [ ] Tests automáticos (el `tests.py` está prácticamente vacío)

---

## 6. Limpieza de código pendiente (deuda técnica)

Estado actual tras la última ronda de correcciones (mayo 2026):
- ✅ **CORREGIDO** — `sala_evaluacion` escribía `perfil.puntuacion_cognitiva` (campo inexistente) → eliminado.
- ✅ **CORREGIDO** — Rutas duplicadas en `urls.py` (`transcribir_audio`, `guardar_progreso`) → eliminadas.
- ✅ **CORREGIDO** — Desincronización de nombres de juegos entre el JS y el DDA → alineados (Documento 8).
- 📌 **Unity descartado**: la idea de usar Unity se abandonó. Quedan vistas/plantillas/rutas y builds borrados como residuo → candidatos a limpieza (juegos `moca5`, `elsa`, `calculadora`, `identificacion`, `prueba_camara`).
- 🧹 **Pendiente** — `score_tmt` se rellena con el valor de visuoespacial en `guardar_moca` (posible copia-pega).

---

## 7. Resumen ejecutivo (la foto en 6 frases)

1. El proyecto está en **modo desarrollo**: `DEBUG=True`, `SECRET_KEY` en el código, `ALLOWED_HOSTS=['*']` y SQLite — todo a cambiar antes de producción.
2. Varias APIs usan **`@csrf_exempt`**; conviene revisarlo porque el frontend ya manda el token CSRF.
3. Maneja **datos clínicos sensibles** (RGPD Art. 9): requiere cifrado, consentimiento y control de acceso estricto.
4. Hay un **riesgo IDOR** potencial: vistas que cargan por `pk` sin verificar propiedad → un médico podría ver pacientes ajenos.
5. Se despliega con **Docker**; la imagen es grande por el stack de IA (PyTorch, Whisper) y necesita `ffmpeg` en el contenedor.
6. Existe una **checklist priorizada** (crítico/importante/mejora) y una lista de **deuda técnica** a limpiar.

---

*Fin del Documento 9 y de la serie de documentación base.*
