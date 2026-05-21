# 🏥 SamiraDTx — Contexto Completo del Proyecto

**Última actualización:** 19 de Mayo de 2026  
**Rama actual:** mis-cambios  
**Estado:** Sistema VTR incorporado (ver sección VTR y documento `VTR_FINALIZADO.md`)

---

## 📋 Índice
1. [Visión General](#visión-general)
2. [Arquitectura Central](#arquitectura-central)
3. [Las 7 Tablas Principales](#las-7-tablas-principales)
4. [Flujos de Datos](#flujos-de-datos)
5. [Roles & Vistas](#roles--vistas)
6. [API Endpoints](#api-endpoints)
7. [Estructura del Proyecto](#estructura-del-proyecto)
8. [ML Model Integration](#ml-model-integration)
9. [Relaciones en Base de Datos](#relaciones-en-base-de-datos)
10. [Tecnología Stack](#tecnología-stack)
11. [Sistema VTR](#sistema-vtr) → detalle completo en `VTR_FINALIZADO.md`

---

## 🎯 Visión General

**SamiraDTx** es una plataforma **Django + ML** para rehabilitación cognitiva de pacientes post-ictus.

### Características Principales:
- ✅ **Gamificación terapéutica** — Pacientes juegan ejercicios (cognitivos, lenguaje, motor)
- ✅ **DDA (Dificultad Dinámica)** — Sistema automático que sube/baja nivel según rendimiento
- ✅ **Evaluación MoCA** — Test cognitivo profesional con audios, dibujos, transcripción IA
- ✅ **ML Prediction** — Modelo que sugiere nivel ideal tras evaluación
- ✅ **Sistema de Mensajes** — Comunicación doctor ↔ paciente
- ✅ **Dashboard médico** — Supervisa múltiples pacientes
- ✅ **Progresión Automática** — DDA detecta si paciente mejora/falla y ajusta en tiempo real
- ✅ **VTR (Data Logger pasivo)** — Registra el tiempo de reacción para que el médico vea la fatiga intra-sesión (NO interviene, solo observa). Ver `VTR_FINALIZADO.md`

### Usuarios:
1. **Pacientes** — Juegan terapia, ven progreso, reciben feedback
2. **Médicos** — Supervisan, validan tests, ajustan niveles manualmente
3. **Sistema** — DDA automático + notificaciones

---

## 📐 Arquitectura Central

```
Django Backend (5.2.8)
├── Modelos de Datos (5 tablas principales)
├── Vistas (patient, doctor, API)
├── URLs (rutas públicas/privadas)
├── ML Service (predicción de niveles)
└── APIs (guardar juegos, MoCA, audio)

        ↓ conecta a ↓

Base de Datos (SQLite3)
├── PerfilPaciente (hub central)
├── SesionDeJuego (cada juego jugado + 4 campos VTR)
├── EvaluacionMoCA (tests cognitivos)
├── NotaEspecialista (historial clínico)
├── NotificacionBuzon (mensajes)
├── SesionTerapia (VTR: agrupa partidas por sesión)
└── MarcaPersonalTR (VTR: TR ideal por juego/nivel)

        ↓ lógica de ↓

DDA Algorithm (evaluar_ajuste_dinamico)
├── Analiza últimas 2 sesiones del dominio
├── Si rendimiento alto → SUBE nivel
├── Si rendimiento bajo → BAJA nivel
└── Crea notificaciones automáticas

        ↓ + ↓

ML Model (scikit-learn)
├── Entrada: datos paciente + MoCA scores
├── Salida: nivel recomendado (1-5)
└── Usado en: revisión médica de tests
```

---

## 🗂️ Las 7 Tablas Principales

### 1. **PerfilPaciente** — El Hub Central

Conecta TODO. Cada usuario tiene un perfil.

```python
class PerfilPaciente(models.Model):
    usuario = models.OneToOneField(User)  # Link a Django User
    es_medico = models.BooleanField()     # ¿Es doctor o paciente?
    medico_asignado = models.ForeignKey(User)  # ¿Quién lo supervisa?
    
    # DATOS DEMOGRÁFICOS
    edad, altura, peso, sexo
    lado_afectado  # Izquierdo, Derecho, Ambos, Ninguno
    lugar_habitual, ciudad_residencia, anios_estudio
    
    # DATOS CLÍNICOS PARA ML
    meses_desde_ictus
    tipo_ictus  # Isquemico, Hemorragico
    hemisferio_afectado  # Izquierdo, Derecho, Bilateral, Ninguno
    hemiparesia_dominante  # Si, No
    
    # ⭐ NIVELES (Los 3 Pilares de Terapia)
    nivel_cognitivo = 1-5  # Dificultad de juegos cognitivos
    nivel_lenguaje = 1-5   # Dificultad de juegos lenguaje
    nivel_motor = 1-5      # Dificultad de motor
    nivel_asignado = 1-5   # Global (legacy, pero usado)
    
    # PUNTUACIONES MOCA LATEST
    puntuacion_total_moca = 0-30
    score_visuoespacial, score_identificacion, score_atencion, 
    score_lenguaje, score_abstraccion, score_recuerdo, score_orientacion
    
    # GAMIFICACIÓN
    racha_dias, dias_totales, puntos_totales, tiempo_terapia_hoy
    
    # ESTADO
    test_completado = bool  # Pasó evaluación inicial?
    fecha_ultima_evaluacion = datetime
    
    # PROPIEDADES CALCULADAS
    @property tiene_moca_pendiente  # ¿Hay tests sin revisar?
    @property notificaciones_sin_leer  # ¿Mensajes nuevos?
```

**Relaciones (lo que conecta a esta tabla):**
- ← `sesiones` (SesionDeJuego) — Todos los juegos que jugó
- ← `evaluaciones_moca` (EvaluacionMoCA) — Todos sus tests MoCA
- ← `notas` (NotaEspecialista) — Notas del doctor
- ← `notificaciones` (NotificacionBuzon) — Mensajes recibidos
- → `medico_asignado` — Su doctor

---

### 2. **SesionDeJuego** — Cada Juego Jugado

Registra CADA vez que un paciente juega algo.

```python
class SesionDeJuego(models.Model):
    paciente = ForeignKey(PerfilPaciente)
    
    # QUÉ JUGÓ
    juego = "Encuentra la Letra"  # Nombre del juego
    nivel_jugado = 1-5  # Dificultad usada
    
    # RESULTADOS
    puntos = int  # Puntuación obtenida
    tiempo_jugado = int  # Segundos
    completado = bool  # ¿Terminó el juego?
    
    # 🎯 AUTOPERCEPCIÓN (Likert 1-5)
    dificultad_percibida = 1-5  # ¿Qué tan difícil fue?
    estado_animo = 1-5  # ¿Cómo se sentía?
    
    fecha = datetime  # Cuándo jugó

    # ⏱️ CAMPOS VTR (añadidos por el sistema VTR)
    sesion_terapia = ForeignKey(SesionTerapia, null=True)  # A qué sesión pertenece
    tiempo_reaccion_ms = int (nullable)  # Tiempo de reacción medido (ms)
    degradacion_porcentaje = float (nullable)  # % degradación vs TR ideal. Null si calibrando
    errores_cometidos = int (default=0)  # Errores en la partida
    
    class Meta:
        ordering = ['-fecha']  # Más nuevo primero
```

**Trigger automático:**
Cuando se guarda → `evaluar_ajuste_dinamico(perfil, juego_nombre)` → puede cambiar nivel  
(El DDA se dispara igual aunque la partida llegue por el endpoint VTR — ver sección VTR)

**Ejemplo de uso:**
```json
{
  "juego": "Encuentra la Letra",
  "nivel": 2,
  "puntos": 850,
  "tiempo": 120,
  "completado": true,
  "dificultad_percibida": 2,
  "estado_animo": 4
}
```

---

### 3. **EvaluacionMoCA** — Test Cognitivo Completo

El test profesional. MUCHOS datos.

```python
class EvaluacionMoCA(models.Model):
    paciente = ForeignKey(PerfilPaciente)
    fecha_evaluacion = datetime
    revisada_por_medico = bool  # ¿El doctor lo validó?
    
    # 7 DOMINIOS (puntuación de cada área)
    score_visuoespacial = 0-5
    score_identificacion = 0-3
    score_atencion = 0-6
    score_lenguaje = 0-3
    score_abstraccion = 0-2
    score_recuerdo = 0-5
    score_orientacion = 0-6
    score_total = 0-30  # Suma de todo
    
    # 📸 MULTIMEDIA AUDIT TRAIL (Base64)
    dibujo_cubo_b64, dibujo_reloj_b64
    audio_frase1_b64, audio_frase2_b64
    audio_fluidez_b64, audio_tren_b64, audio_reloj_b64, audio_recuerdo_b64
    
    # 🤖 TRANSCRIPCIONES IA (Whisper)
    transcripcion_frase1, transcripcion_frase2, transcripcion_fluidez
    abstraccion_tren_respuesta, abstraccion_reloj_respuesta
    transcripcion_recuerdo
    
    # 🔬 SUBPUNTUACIONES GRANULARES (Para doctor)
    score_tmt  # Visuo-spatial TMT
    respuesta_animal_1, respuesta_animal_2, respuesta_animal_3
    memoria_intento1, memoria_intento2
    atencion_numeros_dir, atencion_numeros_inv
    atencion_letras_errores, atencion_letras_score, atencion_restas_score
    lenguaje_rep_1, lenguaje_rep_2, lenguaje_fluidez_score
    abstraccion_tren_score, abstraccion_reloj_score
    orientacion_dia_semana, orientacion_dia_mes, orientacion_mes,
    orientacion_anio, orientacion_lugar, orientacion_localidad
    
    # 📦 BACKUP COMPLETO
    datos_completos_raw = JSONField  # JSON íntegro del frontend
    
    class Meta:
        ordering = ['-fecha_evaluacion']
```

---

### 4. **NotaEspecialista** — Historial Clínico

Notas del doctor (incluyendo cambios automáticos del DDA).

```python
class NotaEspecialista(models.Model):
    paciente = ForeignKey(PerfilPaciente)
    medico = ForeignKey(User)  # Quién escribió
    texto = TextField  # Contenido
    fecha = datetime
    
    class Meta:
        ordering = ['-fecha']  # Más nuevo primero
```

**Ejemplos de notas:**
- Doctor manual: "Paciente muestra buena comprensión, mejorar articulación"
- Sistema DDA: "[SISTEMA DDA] Ascenso automático. Paciente demuestra dominio..."
- Sistema DDA: "[SISTEMA DDA] Descenso preventivo. Alerta de fatiga..."

---

### 5. **NotificacionBuzon** — Mensajes

Comunicación doctor ↔ paciente + notificaciones automáticas.

```python
class NotificacionBuzon(models.Model):
    paciente = ForeignKey(PerfilPaciente)
    remitente = CharField(choices=['SISTEMA', 'MEDICO'])
    medico_autor = ForeignKey(User, nullable=True)  # Si vino de doctor
    mensaje = TextField
    fecha = datetime
    leida = bool  # ¿El paciente lo leyó?
    
    class Meta:
        ordering = ['-fecha']
```

**Ejemplos:**
- Sistema: "¡Enhorabuena! Has subido a nivel 3 en cognitivo 🎉"
- Doctor: "Excelente progreso en el test de lenguaje"

---

### 6. **SesionTerapia** — Agrupador de Partidas (VTR)

Agrupa todas las partidas de un mismo "rato jugando" para medir la fatiga *dentro* de una sesión.

```python
class SesionTerapia(models.Model):
    paciente = ForeignKey(PerfilPaciente)
    session_id = UUIDField(unique=True)   # Usado en URL del médico
    fecha_inicio = datetime
    ultima_actividad = datetime           # Si pasan +60 min sin tocar → sesión muere
    vas_inicial = int 1-10 (nullable)     # Cansancio declarado. Solo informativo
    
    @property duracion_minutos  # ultima_actividad - fecha_inicio
```

**Lógica de sesión:** cada partida renueva `ultima_actividad`. Si hay >60 min de inactividad, la siguiente partida abre una `SesionTerapia` nueva.

---

### 7. **MarcaPersonalTR** — Marca Personal del Paciente (VTR)

El tiempo de reacción de referencia (TR ideal) del paciente, único por juego + nivel.

```python
class MarcaPersonalTR(models.Model):
    paciente = ForeignKey(PerfilPaciente)
    juego = CharField
    nivel = int
    TR_ideal = int (nullable)  # ms. Null durante calibración
    tiempo1, tiempo2, tiempo3 = int (nullable)  # Ventana móvil FIFO de 3
    partidas_base_calculadas = int
    
    class Meta:
        unique_together = ('paciente', 'juego', 'nivel')
```

**Lógica clave (media móvil FIFO):**
- **Calibración:** las 3 primeras partidas válidas rellenan `tiempo1/2/3` → media = primer `TR_ideal`.
- **Tras calibrar:** entra el tiempo nuevo, sale el más antiguo (cinta de 3), se recalcula la media. Permite que el TR ideal se adapte a la mejora del paciente (neuroplasticidad).
- **Solo cuenta una partida** si: está en los primeros **10 min** de sesión **Y** puntuó **≥300**.

> ⚠️ El VTR es un **observador pasivo**: solo registra, nunca interviene ni bloquea. Detalle completo en `VTR_FINALIZADO.md`.

---

## 🔄 Flujos de Datos

### Flujo 1: Registro & Rol

```
1. Usuario va a /accounts/registro/
2. Rellena RegistroUsuarioForm:
   - username, password, nombre, apellido
   - edad, altura, peso, sexo
   - datos clínicos (ictus, hemisferio, etc.)
   - checkbox "¿Soy médico?"
   
3. Django crea User + PerfilPaciente
   - Si es_medico=True → PerfilPaciente con es_medico=True
   - Si es_medico=False → PerfilPaciente con datos clínicos
   
4. Login automático → redirect:
   - Si médico → /medico/dashboard/
   - Si paciente → /dashboard/ → /evaluacion/
```

---

### Flujo 2: DDA — El Corazón Automático

```
┌─────────────────────────────────────────────────────────────┐
│ PACIENTE JUEGA EJERCICIO → POST /api/guardar-progreso/     │
└─────────────────────────────────────────────────────────────┘
                            ↓
            JSON: {juego, nivel, puntos, tiempo, 
                   completado, dificultad_percibida, estado_animo}
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: SesionDeJuego.create()                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ ALGORITMO: evaluar_ajuste_dinamico(perfil, juego_nombre)   │
├─────────────────────────────────────────────────────────────┤
│ 1. Detecta dominio (Cognitivo/Lenguaje/Motor)              │
│ 2. Obtiene ÚLTIMAS 2 SESIONES de ese dominio               │
│ 3. Si puntos ≥ 800 + dificultad ≤ 2 → ASCEND              │
│ 4. Si puntos ≤ 300 O dificultad = 5 → DESCEND             │
│ 5. Actualiza PerfilPaciente.nivel_*                        │
│ 6. Crea NotaEspecialista (doctor) + NotificacionBuzon      │
└─────────────────────────────────────────────────────────────┘
                            ↓
           RESULTADOS:
   - PerfilPaciente.nivel_cognitivo/lenguaje/motor actualizado
   - Doctor ve nota automática en historial
   - Paciente ve notificación en su buzón
```

**Dominios & Juegos:**
```
COGNITIVO:
  - Encuentra la Letra
  - Calculadora
  - Juego 1: Memoria
  - Memoria MoCA
  
LENGUAJE:
  - Juego de Elsa
  - Laboratorio Voz
  
MOTOR:
  - Prueba de Cámara
```

---

### Flujo 3: MoCA Test & ML Prediction

```
┌──────────────────────────────────────────────────────┐
│ PACIENTE COMPLETA TEST MOCA                         │
│ POST /api/guardar-moca/                             │
├──────────────────────────────────────────────────────┤
│ JSON: {                                             │
│   score_visuoespacial, score_identificacion, ...,   │
│   score_total,                                      │
│   dibujo_cubo_b64, dibujo_reloj_b64,               │
│   audio_frase1_b64, audio_frase2_b64, ...,         │
│   transcripcion_frase1, ...,                        │
│   datos_completos_raw                              │
│ }                                                   │
└──────────────────────────────────────────────────────┘
                        ↓
        EvaluacionMoCA.create(...)
        PerfilPaciente.test_completado = True
        PerfilPaciente.puntuacion_total_moca = score_total
        PerfilPaciente.nivel_cognitivo = asigned based on score
                        ↓
         JSON response: {"status": "success"}
                        ↓
  ┌─────────────────────────────────────────────────────────┐
  │ DOCTOR REVISA EN /paciente/{pk}/moca/                 │
  │ → CLICK en evaluación → /auditoria-moca/{pk_eval}/     │
  └─────────────────────────────────────────────────────────┘
                        ↓
      Doctor puede EDITAR puntuaciones individuales
      POST /auditoria-moca/{pk_evaluacion}/
                        ↓
  ┌─────────────────────────────────────────────────────────┐
  │ BACKEND: predecir_nivel(perfil, evaluacion)            │
  ├─────────────────────────────────────────────────────────┤
  │ Input: edad, años estudio, meses ictus, MoCA scores    │
  │ Model: scikit-learn (modelo_niveles.pkl)               │
  │ Output: nivel_sugerido (1-5)                           │
  │ Response: AJAX JSON con sugerencia                     │
  └─────────────────────────────────────────────────────────┘
                        ↓
      Doctor ve sugerencia ML en pantalla
      Puede aceptar/rechazar
                        ↓
  POST /api/aplicar-nivel-ml/{pk_evaluacion}/
  JSON: {nivel_final: int}
                        ↓
  ┌─────────────────────────────────────────────────────────┐
  │ _aplicar_nivel_a_paciente()                            │
  ├─────────────────────────────────────────────────────────┤
  │ 1. PerfilPaciente.nivel_cognitivo = nivel_final        │
  │ 2. Lógica especial para lenguaje (si score_lenguaje=0) │
  │ 3. revisada_por_medico = True                          │
  │ 4. Crea NotificacionBuzon amigable para paciente       │
  └─────────────────────────────────────────────────────────┘
                        ↓
       RESULTADOS:
  - PerfilPaciente.nivel_cognitivo actualizado
  - Paciente notificado de su nuevo nivel
  - Test marcado como revisado
```

---

### Flujo 4: Transcripción Whisper

```
FRONTEND: Paciente graba audio
    ↓
POST /api/transcribir-audio/ (multipart/form-data)
    ↓
BACKEND: MODELO_WHISPER.transcribe(audio, language="es")
    ↓
Response JSON: {texto_transcrito: "..."}
    ↓
FRONTEND: Usa transcripción para scoring/validación
```

---

## 👤 Roles & Vistas

### ROL: PACIENTE

| Ruta | Vista | Función |
|------|-------|---------|
| `/dashboard/` | dashboard() | Entry point (redirige si no test) |
| `/evaluacion/` | sala_evaluacion() | Test inicial MoCA/evaluación |
| `/terapia/` | juegos() | Menú de juegos disponibles |
| `/terapia/encuentra-letra/` | jugar_encuentra_letra() | Juego cognitivo atención |
| `/terapia/encuentra-bolita/` | jugar_encuentra_bolita() | Juego cognitivo atención |
| `/terapia/lista-compra/` | jugar_lista_compra() | Juego memoria |
| `/terapia/secuencia-musical/` | jugar_SecuenciaMusical() | Juego memoria |
| `/terapia/elsa/` | jugar_elsa() | Juego lenguaje (Elsa) |
| `/terapia/calculadora/` | jugar_calculadora() | Juego MoCA calculadora |
| `/terapia/prueba-voz/` | jugar_prueba_voz() | Grabación voz (Whisper) |
| `/mi-progreso/` | resumen_paciente() | Dashboard personal |
| `/buzon/` | buzon_paciente() | Mensajes del doctor |

**APIs que usa:**
- `POST /api/guardar-progreso/` — Guarda cada juego (juegos NO-VTR)
- `POST /api/vtr/iniciar-sesion/` — Abre sesión VTR (modal VAS antes del 1er juego)
- `POST /api/vtr/guardar-partida/` — Guarda juego VTR + dispara DDA
- `POST /api/guardar-moca/` — Guarda test MoCA
- `POST /api/transcribir-audio/` — Transcribe voz

**Modal VAS:** al pulsar JUGAR en un minijuego, aparece una vez por sesión de navegador un pop-up "¿Cómo te encuentras hoy? (1-10)". Se puede omitir. Solo informativo.

---

### ROL: MÉDICO

| Ruta | Vista | Función |
|------|-------|---------|
| `/medico/dashboard/` | dashboard_medico() | Lista sus pacientes |
| `/paciente/{pk}/` | detalle_paciente() | Perfil paciente + historial + notas |
| `/paciente/{pk}/moca/` | historial_moca() | Lista tests MoCA del paciente |
| `/auditoria-moca/{pk_eval}/` | auditoria_moca() | Revisa test, obtiene sugerencia ML |
| `/medico/paciente/{pk}/analisis/` | analisis_paciente() | Gráficos progresión |
| `/medico/paciente/{pk}/buzon/` | buzon_paciente_medico() | Enviar mensaje |
| `/forzar-evaluacion/{pk}/` | forzar_evaluacion() | Pedir re-evaluación |
| `/medico/paciente/{pk}/sesiones/` | lista_sesiones_terapia() | **VTR:** lista de sesiones del paciente |
| `/medico/sesion/{session_id}/` | detalle_sesion_terapia() | **VTR:** gráfica degradación + tabla detalle |

**Acciones principales:**
- Editar niveles manualmente
- Escribir notas clínicas (NotaEspecialista)
- Revisar tests MoCA + validar scores
- Ver sugerencia ML, aceptar/rechazar
- Enviar mensajes a paciente

---

### ROL: PÚBLICO

| Ruta | Vista | Función |
|------|-------|---------|
| `/` | home() | Home page |
| `/historia/` | historia() | Historia del ictus |
| `/servicios/` | servicios() | Servicios ofrecidos |
| `/contacto/` | contacto() | Contacto |
| `/accounts/login/` | (Django) | Login |
| `/accounts/registro/` | registro() | Registro nuevo usuario |

---

## 🔌 API Endpoints

### 1. `POST /api/guardar-progreso/`
**Qué hace:** Guarda cada sesión de juego + dispara DDA

**Request:**
```json
{
  "juego": "Encuentra la Letra",
  "nivel": 2,
  "puntos": 850,
  "tiempo": 120,
  "completado": true,
  "dificultad_percibida": 2,
  "estado_animo": 4
}
```

**Response:**
```json
{"status": "ok"}
```

**Trigger:** evaluar_ajuste_dinamico() → puede cambiar nivel

---

### 2. `POST /api/guardar-moca/`
**Qué hace:** Guarda test MoCA completo con multimedia

**Request:**
```json
{
  "score_visuoespacial": 5,
  "score_identificacion": 3,
  "score_atencion": 6,
  "score_lenguaje": 3,
  "score_abstraccion": 2,
  "score_recuerdo": 5,
  "score_orientacion": 6,
  "score_total": 30,
  "dibujo_cubo_b64": "data:image/png;base64,...",
  "dibujo_reloj_b64": "data:image/png;base64,...",
  "audio_frase1_b64": "data:audio/wav;base64,...",
  "transcripcion_frase1": "Yo soy estudiante",
  ...datos_completos_raw, respuesta_animal_*, etc...
}
```

**Response:**
```json
{"status": "success", "mensaje": "Evaluación guardada correctamente..."}
```

---

### 3. `POST /api/transcribir-audio/`
**Qué hace:** Convierte audio a texto (Whisper)

**Request:** multipart/form-data
```
Content-Type: multipart/form-data
audio: [binary audio file]
```

**Response:**
```json
{"texto_transcrito": "Yo soy estudiante"}
```

---

### 4. `POST /api/aplicar-nivel-ml/{pk_evaluacion}/`
**Qué hace:** Doctor aplica nivel final tras revisar MoCA

**Request:**
```json
{"nivel_final": 3}
```

**Response:**
```json
{
  "ok": true,
  "nivel_cognitivo": 3,
  "nivel_lenguaje": 3,
  "redirect_url": "/paciente/2/moca/"
}
```

---

### 5. `POST /api/vtr/iniciar-sesion/` (VTR)
**Qué hace:** Abre o reutiliza una `SesionTerapia`. Lo llama el modal VAS antes del primer juego.

**Request:** `{"vas_inicial": 3}` (opcional, puede ir vacío `{}`)

**Response:** `{"estado": "ok", "session_id": "<uuid>"}`

---

### 6. `POST /api/vtr/guardar-partida/` (VTR)
**Qué hace:** Registra una partida con datos VTR. **Reemplaza a `/api/guardar-progreso/` para los minijuegos VTR.** Internamente:
1. Obtiene/reutiliza la sesión activa
2. Actualiza la `MarcaPersonalTR` (si está en ventana fresca + score ≥300)
3. Calcula la degradación
4. Crea el `SesionDeJuego` con campos VTR
5. **Dispara `evaluar_ajuste_dinamico()` → el DDA sigue funcionando igual**

**Request:**
```json
{
  "juego": "Encuentra la Letra",
  "nivel": 2,
  "puntos": 850,
  "tiempo_jugado": 120,
  "completado": true,
  "tiempo_reaccion_ms": 740,
  "errores_cometidos": 1,
  "dificultad_percibida": 2,
  "estado_animo": 4
}
```

**Response:** `{"estado": "ok"}` — el juego **nunca recibe órdenes** (logger pasivo).

> ⚠️ **Cambio importante:** los minijuegos VTR (Encuentra la Letra, Encuentra la Bolita, Lista de la Compra, Música y Colores) ahora hacen POST a `/api/vtr/guardar-partida/` en lugar de `/api/guardar-progreso/`. El campo `tiempo` se renombró a `tiempo_jugado`. El DDA se preservó llamándolo explícitamente dentro del nuevo endpoint.

---

## 📁 Estructura del Proyecto

```
webSamiraDTx/
├── config/                    # Django config
│   ├── settings.py           # DEBUG=True, ALLOWED_HOSTS=['*']
│   ├── urls.py               # URL routing
│   ├── wsgi.py
│   └── asgi.py
│
├── core/                      # APP PRINCIPAL
│   ├── models.py             # 7 modelos (+ SesionTerapia, MarcaPersonalTR del VTR)
│   ├── views.py              # 25+ vistas (patient, doctor, API, VTR)
│   ├── forms.py              # RegistroUsuarioForm
│   ├── admin.py              # Django admin config (+ tablas VTR registradas)
│   ├── apps.py
│   │
│   ├── services/
│   │   ├── ml_service.py     # predecir_nivel(perfil, evaluacion) → int(1-5)
│   │   └── vtr_service.py    # Motor VTR: sesiones, marca personal FIFO, degradación
│   │
│   ├── ml_models/            # 📦 IMPORTANTE
│   │   ├── modelo_niveles.pkl
│   │   └── columnas_modelo.pkl
│   │
│   ├── static/               # CSS, audio, imágenes, juegos Unity
│   │   ├── core/
│   │   │   ├── styles.css
│   │   │   ├── audio/ (frase_gato.mp3, frase_juan.mp3, moca_palabras.m4a)
│   │   │   ├── images/ (oficina.png, etc.)
│   │   │   └── videos/ (tutorial_letras.mp4)
│   │   └── games/
│   │       ├── IdentificacionElsaUnity/ (WebGL build)
│   │       ├── juego_calculadora/
│   │       ├── juego_elsa/
│   │       └── moca5/ (Whisper tiny model + assets)
│   │
│   ├── templates/
│   │   ├── core/
│   │   │   ├── layouts/ (base.html, base_private.html, base_medico.html)
│   │   │   ├── pages/ (home.html, historia.html, servicios.html, contacto.html)
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.html (paciente summary)
│   │   │   │   ├── dashboard_medico.html (doctor lista pacientes)
│   │   │   │   ├── buzon_paciente.html (inbox paciente)
│   │   │   │   └── buzon_medico.html (doctor send message)
│   │   │   ├── patients/
│   │   │   │   ├── historia.html
│   │   │   │   ├── evaluacion.html (test inicial)
│   │   │   │   ├── detalle_paciente.html (doctor view)
│   │   │   │   ├── lista_evaluaciones_moca.html
│   │   │   │   ├── auditoria_moca.html (review + ML sugerencia)
│   │   │   │   ├── analisis_paciente.html (gráficos)
│   │   │   │   ├── lista_sesiones_terapia.html (VTR: lista sesiones)
│   │   │   │   └── detalle_sesion_terapia.html (VTR: gráfica Chart.js + tabla)
│   │   │   ├── games/ (11 juegos HTML — los VTR con captura TR/errores)
│   │   │   │   ├── cognitivo/atencion/ (letra, bolita)
│   │   │   │   ├── cognitivo/memoria/ (lista, secuencia)
│   │   │   │   ├── Lenguaje/ (prueba_voz)
│   │   │   │   └── moca/ (moca5, elsa, calculadora, etc.)
│   │   │   └── juegos.html (game menu)
│   │   ├── juegos.html (game menu + modal VAS del VTR)
│   │   └── registration/ (login.html, registro.html)
│   │
│   ├── migrations/ (17 migrations — 0017 añade campos/tablas VTR)
│   └── __init__.py
│
├── manage.py
├── requirements.txt
├── README.md
├── db.sqlite3 (development database)
├── docker-compose.yml (local)
└── docker-prod-compose.yml (production)
```

---

## 🧠 ML Model Integration

**Archivo:** `core/services/ml_service.py`

**Función clave:** `predecir_nivel(perfil_paciente, evaluacion_moca) → int`

### Cómo funciona:

```python
def predecir_nivel(perfil, evaluacion):
    # 1. Extrae datos crudos del perfil y evaluación
    datos_crudos = {
        'Edad': perfil.edad or 65,
        'Anos_Escolarizacion': perfil.anios_estudio or 12,
        'Meses_Desde_Ictus': perfil.meses_desde_ictus or 12,
        'MoCA_Visuo_Ejecutiva': evaluacion.score_visuoespacial,
        'MoCA_Identificacion': evaluacion.score_identificacion,
        'MoCA_Atencion': evaluacion.score_atencion,
        'MoCA_Lenguaje': evaluacion.score_lenguaje,
        'MoCA_Abstraccion': evaluacion.score_abstraccion,
        'MoCA_Recuerdo_Diferido': evaluacion.score_recuerdo,
        'MoCA_Orientacion': evaluacion.score_orientacion,
        'MoCA_Total': evaluacion.score_total,
    }
    
    # 2. Convierte categóricas a one-hot (como se entrenó)
    datos_crudos['Sexo_M'] = 1 if perfil.sexo == 'M' else 0
    datos_crudos['Tipo_Ictus_Isquemico'] = 1 if tipo == 'Isquemico' else 0
    datos_crudos['Hemisferio_Afectado_Derecho'] = ...
    datos_crudos['Hemisferio_Afectado_Izquierdo'] = ...
    datos_crudos['Hemisferio_Afectado_Ninguno'] = ...
    datos_crudos['Hemiparesia_Dominante_Si'] = 1 if ... else 0
    
    # 3. Crea DataFrame y reordena columnas exactamente como entrenamiento
    df = pd.DataFrame([datos_crudos])
    df = df[columnas_modelo]
    
    # 4. Predice
    nivel_predicho = int(modelo.predict(df)[0])
    nivel_predicho = max(1, min(5, nivel_predicho))  # Clamp 1-5
    
    return nivel_predicho
```

### Archivos requeridos:
- `core/ml_models/modelo_niveles.pkl` — Modelo scikit-learn
- `core/ml_models/columnas_modelo.pkl` — Nombres columnas en orden

### Input features:
| Nombre | Tipo | Rango |
|--------|------|-------|
| Edad | numeric | 18-100 |
| Anos_Escolarizacion | numeric | 0-25 |
| Meses_Desde_Ictus | numeric | 0-1000 |
| MoCA_* (7 scores) | numeric | 0-30 |
| Sexo_M | binary | 0-1 |
| Tipo_Ictus_Isquemico | binary | 0-1 |
| Hemisferio_Afectado_* (3 cols) | binary | 0-1 each |
| Hemiparesia_Dominante_Si | binary | 0-1 |

### Output:
**nivel (1-5)** — Recomendación del modelo

---

## 🗄️ Relaciones en Base de Datos

```
USUARIOS DJANGO
    ↓ OneToOne (related_name='perfil')
    ↓
PERFILPACIENTE (💫 HUB CENTRAL)
    │
    ├─→ ForeignKey(User) medico_asignado
    │   (Quién lo supervisa)
    │
    ├─← SesionDeJuego (reverse relation)
    │   (Todos sus juegos)
    │   → Si cambia, trigger: evaluar_ajuste_dinamico()
    │   → Puede cambiar: nivel_cognitivo, nivel_lenguaje, nivel_motor
    │
    ├─← EvaluacionMoCA (reverse relation)
    │   (Todos sus tests MoCA)
    │   → Si doctor valida: trigger: predecir_nivel()
    │   → ML → aplicar_nivel_a_paciente()
    │   → Actualiza: nivel_cognitivo, nivel_lenguaje, puntuacion_total_moca
    │
    ├─← NotaEspecialista (reverse relation)
    │   (Notas clínicas - manual + automáticas)
    │
    └─← NotificacionBuzon (reverse relation)
        (Mensajes - manual + automáticos)
        → Leída flag
        → Propiedad notificaciones_sin_leer
```

---

## 💻 Tecnología Stack

### Backend
| Tech | Versión | Uso |
|------|---------|-----|
| **Django** | 5.2.8 | Framework web |
| **Python** | 3.10+ | Lenguaje |
| **SQLite3** | - | Database (desarrollo) |

### ML & Data
| Tech | Versión | Uso |
|------|---------|-----|
| **scikit-learn** | latest | Modelo predicción nivel |
| **pandas** | 2.3.5 | DataFrames, one-hot encoding |
| **joblib** | latest | Serialización modelo/columnas |
| **numpy** | 2.3.5 | Cálculos numéricos |

### Speech
| Tech | Versión | Uso |
|------|---------|-----|
| **openai-whisper** | 20250625 | Transcripción audio español |

### Frontend
| Tech | Uso |
|------|-----|
| **HTML5** | Templates Django |
| **CSS3** | Estilos |
| **JavaScript** | Interactividad, canvas |
| **Unity WebGL** | Juegos renderizados |

### DevOps
| Tech | Uso |
|------|-----|
| **Docker** | Containerización |
| **docker-compose** | Orquestación local |
| **nginx** | Proxy inverso (producción) |
| **systemd** | Auto-start servicios (producción) |

---

## ⚙️ Configuración Crítica

### settings.py
```python
DEBUG = True  # En producción: False
ALLOWED_HOSTS = ['*']  # En producción: ['test.evidagroup.es', ...]
DATABASES = SQLite3
CSRF_TRUSTED_ORIGINS = []  # En producción: ['https://test.evidagroup.es']
```

### ML Model Path
```
core/ml_models/
  ├── modelo_niveles.pkl ← REQUERIDO
  └── columnas_modelo.pkl ← REQUERIDO
```

Si faltan estos archivos, `predecir_nivel()` retorna `None`.

---

## 🎯 Lo Más Importante

### 1. **PerfilPaciente es el Hub**
Toda la lógica gira alrededor de esta tabla. Es OneToOne con User.

### 2. **DDA es Automático**
Cada `SesionDeJuego.create()` dispara `evaluar_ajuste_dinamico()`.  
Esto puede cambiar `nivel_cognitivo`, `nivel_lenguaje`, `nivel_motor`.

### 3. **ML Prediction es Sugerencia**
El modelo SUGIERE nivel, el doctor DECIDE.

### 4. **Notificaciones son Automáticas**
- DDA cambio de nivel → NotificacionBuzon auto-generada
- Doctor valida MoCA → NotificacionBuzon auto-generada
- Doctor escribe mensaje → NotificacionBuzon manual

### 5. **3 Niveles Independientes**
- `nivel_cognitivo` — Solo cambia DDA cognitivo + ML
- `nivel_lenguaje` — Solo cambia DDA lenguaje + lógica especial si score_lenguaje=0
- `nivel_motor` — Solo cambia DDA motor

### 6. **Domains Matter**
DDA analiza ÚLTIMAS 2 SESIONES del MISMO DOMINIO.
No mezcla Cognitivo con Lenguaje.

### 7. **VTR es Observador Pasivo**
Mide el tiempo de reacción y lo compara con la marca personal (TR ideal).
Solo registra y muestra al médico. NUNCA interviene, bloquea ni avisa al paciente.
El DDA y el VTR son sistemas independientes que conviven. Detalle: `VTR_FINALIZADO.md`.

---

## 🚀 Próximos Pasos al Trabajar

Antes de implementar cualquier feature:

1. ✅ Entiende qué tabla afectas
2. ✅ Verifica relaciones (¿quién depende de quién?)
3. ✅ ¿Dispara DDA? ¿Dispara notificaciones?
4. ✅ ¿Afecta ML prediction?
5. ✅ ¿Qué role ve esto? (Paciente/Doctor/Admin)
6. ✅ ¿Qué URL/API lo maneja?
7. ✅ ¿Qué template lo renderiza?

---

## 📞 Contacto & Links

- **URL producción:** https://test.evidagroup.es
- **Servidor:** 85.214.130.154 (EvidaGroup)
- **Branch actual:** mis-cambios
- **Última migración:** 0017 (campos VTR en SesionDeJuego + tablas SesionTerapia/MarcaPersonalTR)

---

**Documento generado:** 18 de Mayo de 2026  
**Actualizado:** 19 de Mayo de 2026 — incorporación del sistema VTR  
**Versión:** 1.1  
**Estado:** Completo (ver `VTR_FINALIZADO.md` para detalle del VTR)

Guardate este archivo y úsalo como referencia cada vez que trabajes en el proyecto. 🚀
