# 🧠 SamiraDTx — Resumen Completo de la Página Web

> **Documento 2 de la serie "Documentación de la Página"**
> Este documento da la **visión general (de pájaro)** de toda la plataforma: qué es, cómo está organizada, qué carpeta hace qué, qué se conecta con qué y cuál es el recorrido completo de un dato desde que el paciente juega hasta que el médico lo ve. No entra línea por línea: busca que entiendas **el mapa entero**.
>
> Complementa al Documento 1 (`BaseDeDatos.md`), que explicaba las tablas. Aquí explicamos **todo lo que rodea** a esas tablas.

---

## 1. ¿Qué es SamiraDTx? (en una frase y en un párrafo)

**En una frase:** SamiraDTx es una **plataforma web de neurorrehabilitación digital** (un "DTx" = *Digital Therapeutic*, terapia digital) para pacientes que han sufrido un **ictus**, basada en **videojuegos terapéuticos** supervisados por un médico.

**En un párrafo:** El paciente se registra, hace un **test cognitivo MoCA** (digitalizado, con voz y dibujos), y un **modelo de Machine Learning** le asigna un nivel de dificultad personalizado. A partir de ahí, el paciente entrena jugando a **mini-juegos** (algunos hechos en JavaScript, otros son juegos completos de **Unity WebGL**) que ejercitan memoria, atención, lenguaje y motricidad. Mientras juega, el sistema **mide su tiempo de reacción** (sistema VTR) y opcionalmente su **frecuencia cardíaca** con una **pulsera Bluetooth (wearable)**. Toda esa información llega al **panel del médico**, que puede revisar los tests, leer gráficas, dejar notas y enviar mensajes al paciente.

### Las 3 ideas que mueven todo el proyecto

1. **Personalización con IA** → el nivel no lo elige el paciente "a ojo", lo predice un modelo entrenado con datos clínicos.
2. **Medición objetiva continua** → no solo "cuántos puntos hiciste", sino *cómo de rápido reaccionas* (VTR) y *cómo está tu corazón* (wearable). Esto detecta fatiga y progreso real.
3. **Supervisión médica (telemedicina)** → el médico ve todo a distancia, audita los tests y se comunica con el paciente. Modelo **"Store & Forward"**: el paciente genera datos, se guardan, el médico los revisa cuando puede.

---

## 2. Stack tecnológico (con qué está construido)

| Capa | Tecnología | Para qué |
|------|-----------|----------|
| **Backend / Web** | **Django 5.2.8** (Python) | Servidor, lógica, base de datos, rutas |
| **Base de datos** | **SQLite** (`db.sqlite3`) | Almacenamiento (un solo archivo, ideal para desarrollo) |
| **Frontend** | HTML + CSS + JavaScript (plantillas Django) | Lo que ve el usuario |
| **Juegos pesados** | **Unity WebGL** | Juegos 3D/2D que corren dentro del navegador |
| **Juegos ligeros** | **JavaScript puro** | Mini-juegos hechos a mano (bolita, lista de compra…) |
| **IA — Voz** | **OpenAI Whisper** (local) + **ffmpeg** | Transcribir los audios del test MoCA a texto |
| **IA — Niveles** | **scikit-learn** (modelo `.pkl`) + **pandas** | Predecir el nivel ideal del paciente (1–5) |
| **Wearable** | **Web Bluetooth API (BLE)** | Leer pulsaciones de una pulsera en tiempo real |
| **Despliegue** | **Docker** (`Dockerfile`, `docker-compose.yml`) | Empaquetar y desplegar la app |
| **Cálculo IA** | **PyTorch (CPU)** | Motor que necesita Whisper por debajo |

> 🔎 **Dato curioso:** el `requirements.txt` incluye `torch`, `openai-whisper`, `scikit-learn`, `pandas`, `joblib`… Esto confirma que la web **ejecuta IA en el propio servidor**, no llama a una API externa de pago. Whisper transcribe voz y scikit-learn decide niveles, todo en local.

---

## 3. Arquitectura general (el recorrido de una petición)

Django sigue el patrón **MVT** (Model–View–Template), que es su versión del clásico MVC:

```
NAVEGADOR (paciente o médico)
        │  pide una URL (ej: /terapia/)
        ▼
┌─────────────────────┐
│  config/urls.py     │  ← El "GPS": mira la URL y decide qué función llamar
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  core/views.py      │  ← El "cerebro": ejecuta la lógica, pide datos, decide qué mostrar
└─────────────────────┘
     │           │
     │           └──────────────┐
     ▼                          ▼
┌──────────────┐      ┌────────────────────┐
│ core/models.py│      │ core/services/     │  ← Lógica especializada
│ (Base datos) │      │  - ml_service.py   │     (IA de niveles)
└──────────────┘      │  - vtr_service.py  │     (tiempos de reacción)
        │             └────────────────────┘
        ▼
┌─────────────────────┐
│  core/templates/    │  ← La "cara": el HTML que se devuelve al navegador
└─────────────────────┘
        │
        ▼
   NAVEGADOR (ve la página renderizada)
```

**Resumen del flujo:** `URL → Vista → (Modelos + Servicios) → Plantilla → HTML`.

---

## 4. 🗂️ Organización de carpetas y subcarpetas (con descripción)

Esta es la estructura completa del proyecto. Lo más importante vive dentro de `core/`.

```
webSamiraDTx/                    ← RAÍZ del proyecto
│
├── manage.py                    ← Comando maestro de Django (arrancar, migrar, etc.)
├── db.sqlite3                   ← La base de datos entera (un solo archivo)
├── requirements.txt             ← Lista de librerías Python necesarias
├── Dockerfile                   ← Receta para empaquetar la app en un contenedor
├── docker-compose.yml           ← Orquestación Docker (desarrollo)
├── docker-prod-compose.yml      ← Orquestación Docker (producción)
├── ffmpeg.exe                   ← Herramienta para procesar audio (la usa Whisper)
├── README.md                    ← Descripción del repositorio
├── CLAUDE.md                    ← Instrucciones para la IA asistente (graphify)
│
├── config/                      ← ⚙️ CONFIGURACIÓN GLOBAL DEL PROYECTO DJANGO
│   ├── settings.py              ←   Ajustes: BD, apps instaladas, idioma, seguridad, Unity WASM
│   ├── urls.py                  ←   MAPA DE RUTAS: relaciona cada URL con su vista
│   ├── wsgi.py                  ←   Punto de entrada para servidores web (producción síncrona)
│   └── asgi.py                  ←   Punto de entrada asíncrono (websockets/futuro)
│
├── core/                        ← 🫀 LA APP PRINCIPAL (aquí vive el 95% del proyecto)
│   ├── models.py                ←   Las 7 tablas de la BD (ver Documento 1)
│   ├── views.py                 ←   ~40 funciones: TODA la lógica (990 líneas)
│   ├── forms.py                 ←   Formularios (sobre todo el registro de usuarios)
│   ├── admin.py                 ←   Configura el panel /admin de Django
│   ├── apps.py                  ←   Registro de la app "core"
│   ├── tests.py                 ←   Pruebas automáticas (de momento vacío/mínimo)
│   │
│   ├── migrations/              ←   📜 HISTORIAL DE CAMBIOS DE LA BD (0001 → 0018)
│   │                                 Cada archivo = una modificación de las tablas en el tiempo
│   │
│   ├── services/                ←   🧩 LÓGICA ESPECIALIZADA (separada de views para limpieza)
│   │   ├── ml_service.py        ←     PUENTE con el modelo de IA: predice el nivel (1–5)
│   │   └── vtr_service.py       ←     Lógica del tiempo de reacción: récords, degradación, fatiga
│   │
│   ├── ml_models/               ←   🤖 EL CEREBRO DE IA YA ENTRENADO
│   │   ├── modelo_niveles.pkl   ←     El modelo scikit-learn entrenado (predice niveles)
│   │   ├── columnas_modelo.pkl  ←     Orden exacto de columnas que el modelo espera
│   │   ├── leer_pkl.py          ←     Script de utilidad para inspeccionar los .pkl
│   │   └── README.md            ←     Notas sobre el modelo
│   │
│   ├── templates/core/          ←   🎨 TODO EL HTML (lo que ve el usuario)
│   │   ├── layouts/             ←     PLANTILLAS BASE que las demás heredan
│   │   │   ├── base.html        ←       Plantilla pública (web de marketing)
│   │   │   ├── base_private.html←       Plantilla del paciente (con menú de terapia)
│   │   │   └── base_medico.html ←       Plantilla del médico (con menú clínico)
│   │   ├── pages/               ←     Páginas públicas: home, servicios, contacto
│   │   ├── dashboard/           ←     Paneles de inicio (paciente y médico) + buzones
│   │   ├── patients/            ←     Vistas clínicas: detalle paciente, MoCA, sesiones, evaluación
│   │   ├── games/               ←     Las pantallas de cada juego (ver sección 8)
│   │   │   ├── moca/            ←       Juegos Unity (moca5, elsa, calculadora, identificación)
│   │   │   ├── cognitivo/       ←       Juegos JS (atención, memoria)
│   │   │   └── Lenguaje/        ←       Juego de voz
│   │   └── juegos.html          ←     La "biblioteca" de juegos del paciente
│   │
│   ├── templates/registration/  ←   🔐 Login y registro (separado por convención de Django)
│   │   ├── login.html
│   │   └── registro.html
│   │
│   └── static/core/             ←   📦 ARCHIVOS ESTÁTICOS (no cambian por usuario)
│       ├── styles.css           ←     Estilos globales
│       ├── js/                  ←     JavaScript del frontend
│       │   ├── wearable_service.js     ← Conexión Bluetooth con la pulsera (BLE)
│       │   ├── DashboardMedico/        ← JS del análisis gráfico del médico
│       │   └── games/                  ← Código de los mini-juegos en JS
│       │       └── cognitivo/
│       │           ├── atencion/       ← EncuentraLaBolita.js
│       │           └── memoria/        ← ListaCompra.js, SecuenciaMusical.js
│       ├── images/              ←     Logo, imágenes del MoCA (camello, león, rinoceronte)
│       ├── audio/               ←     Audios de referencia del test (frases, palabras)
│       └── videos/              ←     Vídeos tutoriales (ej: tutorial_letras.mp4)
│
│   └── static/games/            ←   🎮 JUEGOS UNITY WEBGL (builds compilados, muy pesados)
│                                      Carpetas Build/ + TemplateData/ por cada juego Unity
│                                      (moca5, moca5Definitivo, Identificación, calculadora…)
│
├── DocumentacionPagina/         ← 📚 ESTA documentación (Documento 1, 2, …)
│
├── ArchivosBorja/               ← 📝 NOTAS DE DESARROLLO del autor (contexto, planes)
│   ├── SAMIRADTX_CONTEXTO_COMPLETO.md
│   ├── VTR_FINALIZADO.md
│   ├── PlanImplementacionWearable.md
│   ├── wearable.md
│   └── wearablefinalizado.md
│
└── graphify-out/               ← 🕸️ Grafo de conocimiento auto-generado del código
```

---

## 5. Los dos "mundos" de la aplicación

La web es en realidad **tres aplicaciones en una**, según quién entra:

### 🌍 Mundo A — Web pública (cualquiera, sin login)
Páginas de marketing/información. Hereda de `layouts/base.html`.
- `/` → Home
- `/historia/` → Historia del proyecto
- `/servicios/` → Servicios
- `/contacto/` → Contacto

### 🧑‍🦽 Mundo B — Panel del Paciente (login, `es_medico=False`)
Hereda de `layouts/base_private.html`. Aquí el paciente entrena.
- `/dashboard/` → Su panel (puntos, racha, progreso)
- `/terapia/` → Biblioteca de juegos
- `/terapia/...` → Cada juego concreto
- `/buzon/` → Mensajes que le manda el médico
- `/mi-progreso/` → Resumen de su evolución

### 🩺 Mundo C — Panel del Médico (login, `es_medico=True`)
Hereda de `layouts/base_medico.html`. Aquí el médico supervisa.
- `/medico/dashboard/` → Lista de sus pacientes
- `/paciente/<id>/` → Ficha de un paciente
- `/medico/paciente/<id>/analisis/` → Gráficas y análisis
- `/paciente/<id>/moca/` → Historial de tests MoCA
- `/auditoria-moca/<id>/` → Revisar un test concreto (ver dibujos, oír audios)
- `/medico/paciente/<id>/sesiones/` → Sesiones de terapia (VTR)
- `/medico/sesion/<uuid>/` → Detalle de una sesión (con gráfica de pulso)
- `/medico/paciente/<id>/buzon/` → Escribir mensajes al paciente

> 🔑 **Recuerda (del Documento 1):** médico y paciente son el mismo tipo de usuario; lo que cambia es el campo `es_medico`. El sistema enseña un mundo u otro según ese flag.

---

## 6. Mapa de URLs → Vistas (qué hace cada una)

`config/urls.py` conecta ~35 rutas con funciones de `core/views.py`. Agrupadas:

| Grupo | URL ejemplo | Vista | Qué hace |
|-------|------------|-------|----------|
| **Públicas** | `/`, `/servicios/` | `home`, `servicios`… | Mostrar páginas informativas |
| **Auth** | `/accounts/registro/` | `registro` | Crear cuenta (usa `forms.py`) |
| **Paciente** | `/dashboard/` | `dashboard` | Panel del paciente |
| **Paciente** | `/terapia/` | `juegos` | Biblioteca de juegos |
| **Juegos** | `/terapia/test-memoria/` | `jugar_moca_5` | Cargar un juego concreto |
| **API IA Voz** | `/api/transcribir-audio/` | `transcribir_audio` | Recibe audio → Whisper → texto |
| **API Progreso** | `/api/guardar-progreso/` | `guardar_progreso` | Guardar resultado de una partida |
| **API MoCA** | `/api/guardar-moca/` | `guardar_moca` | Guardar el test cognitivo completo |
| **API IA Nivel** | `/api/aplicar-nivel-ml/<id>/` | `aplicar_nivel_ml` | Ejecutar el modelo y asignar nivel |
| **API VTR** | `/api/vtr/iniciar-sesion/` | `vtr_iniciar_sesion` | Abrir una sesión de terapia |
| **API VTR** | `/api/vtr/guardar-partida/` | `vtr_guardar_partida` | Guardar partida con tiempo de reacción + FC |
| **Médico** | `/medico/dashboard/` | `dashboard_medico` | Lista de pacientes |
| **Médico** | `/auditoria-moca/<id>/` | `auditoria_moca` | Auditar un test (ver/oír pruebas) |
| **Médico** | `/medico/sesion/<uuid>/` | `detalle_sesion_terapia` | Ver una sesión con su gráfica |

> 💡 Las rutas que empiezan por `/api/` **no devuelven HTML**: devuelven datos (JSON) y son llamadas por el JavaScript de los juegos. El resto devuelven páginas HTML.

---

## 7. La capa de Servicios (la lógica "inteligente")

Para no amontonar toda la lógica en `views.py`, las partes complejas viven en `core/services/`:

### 🤖 `ml_service.py` — El cerebro que decide niveles
Es el **puente entre la base de datos y el modelo de IA**. Su trabajo:
1. Coge los datos clínicos del paciente (`edad`, `tipo_ictus`, `sexo`…) y sus notas MoCA.
2. Los transforma al formato exacto que entiende el modelo (técnica *One-Hot*: convierte "Isquémico" en columnas de 0s y 1s).
3. Ordena las columnas igual que cuando se entrenó el modelo (usando `columnas_modelo.pkl`).
4. Llama a `modelo.predict()` y devuelve un **nivel del 1 al 5**.

> El modelo se carga **una sola vez** al arrancar (carga perezosa) para no ralentizar cada predicción.

### ⏱️ `vtr_service.py` — El cronómetro de la fatiga (VTR)
Gestiona el **tiempo de reacción** y detecta fatiga. Sus reglas:
- **`obtener_o_crear_sesion`** → si el paciente lleva >60 min inactivo, abre una sesión nueva; si no, reutiliza la actual.
- **`actualizar_marca_personal`** → mantiene el "récord personal" (`TR_ideal`) con una **media móvil de 3 tiempos** (FIFO: entra el nuevo, sale el más viejo). Solo cuenta partidas frescas (primeros 10 min) y con buena puntuación (≥300), para que el récord sea fiable. Permite que el récord mejore con el tiempo (neuroplasticidad).
- **`calcular_degradacion`** → compara el tiempo actual contra el ideal y da un **% de degradación**. Si el paciente va mucho más lento de lo normal → señal de fatiga.

---

## 8. Los Juegos (el corazón terapéutico)

Hay **dos familias** de juegos:

### 🕹️ Familia 1 — Juegos en JavaScript (ligeros, hechos a mano)
Viven como código JS en `static/core/js/games/` + su HTML en `templates/core/games/`.
| Juego | Área | Archivo |
|-------|------|---------|
| **Encuentra la Bolita** | Atención | `cognitivo/atencion/EncuentraLaBolita.js` |
| **Encuentra la Letra** | Atención | `cognitivo/atencion/juego_encuentra_letra.html` |
| **Lista de la Compra** | Memoria | `cognitivo/memoria/ListaCompra.js` |
| **Secuencia Musical** | Memoria | `cognitivo/memoria/SecuenciaMusical.js` |
| **Prueba de Voz** | Lenguaje | `Lenguaje/juego_prueba_voz.html` |

### 🎮 Familia 2 — Juegos Unity WebGL (pesados, profesionales)
Son juegos completos exportados de Unity, viven en `static/games/`. Cada uno tiene una carpeta `Build/` (el juego compilado: `.wasm`, `.data`, `.framework.js`, `.loader.js`) y `TemplateData/` (estilos del cargador).
| Juego | Para qué |
|-------|----------|
| **moca5 / moca5Definitivo** | El test MoCA jugable (con micrófono y Whisper) |
| **IdentificacionElsaUnity** | Juego de identificación con el personaje "Elsa" |
| **juego_elsa** | Juego con Elsa |
| **juego_calculadora** | Juego de cálculo |

> ⚙️ Por eso `settings.py` añade `mimetypes.add_type("application/wasm", ".wasm")`: el navegador necesita ese tipo MIME para cargar los juegos de Unity.

**Conexión juego ↔ servidor:** los juegos (sean JS o Unity) llaman a las APIs (`/api/guardar-progreso/`, `/api/vtr/guardar-partida/`, `/api/transcribir-audio/`) para enviar resultados. El servidor los guarda en la BD y aplica la lógica VTR/ML.

---

## 9. El sistema Wearable (pulsera Bluetooth)

- El archivo `static/core/js/wearable_service.js` usa la **Web Bluetooth API (BLE)** para conectarse a una **pulsera de frecuencia cardíaca** directamente desde el navegador.
- Mientras el paciente juega, va leyendo el **pulso latido a latido**.
- Al terminar la partida, esos datos se envían junto al resultado y se guardan en `SesionDeJuego` (`fc_min`, `fc_max`, `fc_avg`, `fc_serie`).
- El médico ve luego una **gráfica del pulso** en el detalle de la sesión.

> Recuerda (Documento 1): **no hay tabla Wearable**, el pulso vive dentro de cada partida.

---

## 10. Flujos completos (cómo se conecta TODO)

### 📝 Flujo 1 — Registro de un paciente
`registro.html` → `RegistroUsuarioForm` (forms.py) → crea un `User` **y** un `PerfilPaciente`, le asigna el médico elegido del desplegable.

### 🧪 Flujo 2 — Evaluación inicial (MoCA + IA)
1. El paciente juega el test MoCA (Unity). Habla por el micro → audio.
2. El audio va a `/api/transcribir-audio/` → **Whisper** lo convierte en texto.
3. Al acabar, `/api/guardar-moca/` guarda todo en `EvaluacionMoCA` (puntos, audios, dibujos, transcripciones).
4. El médico revisa el test en `auditoria-moca`.
5. El médico pulsa "aplicar nivel" → `/api/aplicar-nivel-ml/` → **ml_service** predice el nivel (1–5) → se guarda en `PerfilPaciente` (`nivel_cognitivo`, etc.).

### 🎮 Flujo 3 — Sesión de terapia (juego + VTR + wearable)
1. El paciente abre un juego → `/api/vtr/iniciar-sesion/` crea/reutiliza una `SesionTerapia`.
2. (Opcional) conecta la pulsera vía `wearable_service.js`.
3. Juega. El juego mide tiempo de reacción y puntos.
4. Al acabar → `/api/vtr/guardar-partida/` crea una `SesionDeJuego` con: puntos, tiempo de reacción, FC, y calcula la **degradación** vs su récord (`MarcaPersonalTR`).
5. El médico ve la sesión completa con sus gráficas.

### 💬 Flujo 4 — Comunicación médico↔paciente
El médico escribe en `buzon_paciente_medico` → crea una `NotificacionBuzon` → el paciente la ve en su `/buzon/`. También deja `NotaEspecialista` (historial interno solo para médicos).

---

## 11. Despliegue y producción

- **Docker**: `Dockerfile` + `docker-compose.yml` (desarrollo) y `docker-prod-compose.yml` (producción) empaquetan la app con todas sus dependencias (incluido PyTorch y Whisper, que son pesados).
- **ffmpeg.exe**: necesario para que Whisper procese los audios.
- **Dominio de producción**: `settings.py` confía en `https://test.evidagroup.es` (CSRF).
- ⚠️ **Avisos de seguridad pendientes para producción** (ahora mismo están en modo desarrollo):
  - `DEBUG = True` (debería ser `False` en producción).
  - `SECRET_KEY` está escrita en el código (debería ir en variable de entorno).
  - `ALLOWED_HOSTS = ['*']` (demasiado abierto).
  - Base de datos **SQLite** (para muchos usuarios convendría PostgreSQL).

---

## 12. Resumen ejecutivo (la foto completa en 8 frases)

1. **SamiraDTx es una terapia digital con videojuegos para pacientes de ictus**, supervisada por médicos.
2. Está construida con **Django (Python)** y una base de datos **SQLite**, con casi todo el código dentro de la app `core/`.
3. La estructura sigue **MVT**: `urls.py` enruta, `views.py` razona (~40 funciones), `templates/` muestra, `models.py` guarda.
4. Hay **tres mundos**: web pública, panel del paciente y panel del médico, decididos por el flag `es_medico`.
5. La lógica difícil se separa en **servicios**: `ml_service.py` (IA de niveles) y `vtr_service.py` (tiempos de reacción y fatiga).
6. Los **juegos** son de dos tipos: ligeros en JavaScript y completos en **Unity WebGL**; todos envían resultados al servidor por APIs `/api/`.
7. La plataforma usa **dos IAs locales**: **Whisper** (voz→texto en el MoCA) y **scikit-learn** (predicción de nivel).
8. El **wearable** (pulsera BLE) mide el pulso durante el juego y lo guarda dentro de cada partida para que el médico lo analice.

---

## 13. Glosario rápido

- **DTx**: Digital Therapeutic, terapia basada en software con evidencia clínica.
- **MVT**: Model-View-Template, el patrón de organización de Django.
- **Vista (view)**: función Python que responde a una URL.
- **Plantilla (template)**: archivo HTML que se rellena con datos.
- **MoCA**: test cognitivo de cribado (0–30 puntos).
- **VTR**: Variabilidad del Tiempo de Reacción (sistema para medir fatiga).
- **Whisper**: IA de OpenAI que transcribe voz a texto.
- **scikit-learn / .pkl**: librería de IA y el archivo donde se guarda el modelo entrenado.
- **One-Hot**: técnica para convertir categorías ("Isquémico") en columnas numéricas (0/1).
- **WebGL / Unity**: tecnología para correr juegos dentro del navegador.
- **BLE**: Bluetooth Low Energy, el protocolo de la pulsera wearable.
- **CSRF**: protección de seguridad de Django contra peticiones falsas.
- **Migración**: archivo que registra un cambio en la estructura de la base de datos.

---

*Fin del Documento 2.*
