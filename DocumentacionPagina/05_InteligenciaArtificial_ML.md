# 🤖 La Inteligencia Artificial de SamiraDTx (Machine Learning)

> **Documento 5 de la serie "Documentación de la Página"**
> SamiraDTx usa **dos tipos de "inteligencia"** para personalizar la terapia. Este documento explica la principal: el **modelo de Machine Learning** que predice el nivel de dificultad ideal para cada paciente a partir de sus datos clínicos y su test MoCA. También aclara cómo convive con los otros sistemas de decisión.

---

## 1. Los tres "cerebros" de decisión (visión de conjunto)

Es fácil confundirse, así que empezamos con el mapa completo. SamiraDTx decide el nivel del paciente con **tres mecanismos distintos**:

| # | Mecanismo | Tipo | ¿IA real? | Cuándo actúa |
|---|-----------|------|-----------|--------------|
| 1 | **Reglas MoCA** (`guardar_moca`) | `if/else` por umbrales | ❌ No, reglas fijas | Justo al terminar el test |
| 2 | **Modelo ML** (`ml_service.py`) | scikit-learn (Random Forest) | ✅ Sí, IA entrenada | Cuando el médico valida el test |
| 3 | **DDA** (`evaluar_ajuste_dinamico`) | Heurística de rendimiento | ❌ No, reglas adaptativas | Tras cada par de partidas |

**Este documento se centra en el #2 (el ML real).** El #1 y el #3 se explican en el Documento 3.

> 🧠 **Idea clave:** solo el #2 es "Machine Learning" en sentido estricto (un modelo entrenado con datos). Los otros dos son sistemas de reglas inteligentes, pero no aprenden.

---

## 2. ¿Qué hace el modelo ML? (en una frase)

> Dado el **perfil clínico** de un paciente (edad, tipo de ictus, hemisferio afectado…) y los **resultados de su test MoCA** (las 7 puntuaciones), el modelo **predice el nivel de dificultad ideal (1–5)** para su terapia.

Es un problema de **clasificación**: la entrada son ~19 variables, la salida es una de 5 clases (niveles 1, 2, 3, 4 o 5).

---

## 3. Los archivos del modelo (`core/ml_models/`)

| Archivo | Qué es |
|---------|--------|
| `modelo_niveles.pkl` | El modelo **Random Forest** ya entrenado (serializado con joblib) |
| `columnas_modelo.pkl` | La **lista ordenada** de columnas que el modelo espera como entrada |
| `leer_pkl.py` | Script de utilidad para inspeccionar qué columnas hay |
| `README.md` | Nota: los `.pkl` se generan con `IA_MachineLearnig/entrenar_modelo.py` |

> 📌 **Dato importante:** el script de **entrenamiento** (`entrenar_modelo.py`) **no está en este repositorio** — vive en una carpeta hermana `IA_MachineLearnig/`. Aquí solo está el **modelo ya entrenado** (el "cerebro congelado"). La web **usa** el modelo, no lo entrena.

### ¿Qué es un `.pkl`?
Es un archivo donde Python "congela" un objeto en disco (serialización con `pickle`/`joblib`). El modelo entrenado es un objeto complejo (un bosque de árboles de decisión); guardarlo en `.pkl` permite cargarlo más tarde sin re-entrenar.

### ¿Por qué guardar las columnas aparte?
Porque un modelo de scikit-learn **es muy estricto con el orden y el nombre de las columnas**. Si en el entrenamiento la columna 3 era "Edad", en la predicción la columna 3 también debe ser "Edad". `columnas_modelo.pkl` garantiza ese orden exacto.

---

## 4. El puente: `ml_service.py` (paso a paso)

Este archivo es el **traductor** entre el mundo de Django (texto: "Isquémico", "F") y el mundo del modelo (números: 0 y 1). Su función principal es `predecir_nivel(perfil_paciente, evaluacion_moca)`.

### Paso 0 — Carga perezosa del modelo
```python
_modelo = joblib.load('modelo_niveles.pkl')
_columnas = joblib.load('columnas_modelo.pkl')
```
Se cargan **una sola vez** al primer uso (igual que Whisper). Si los archivos no existen, registra un error y devuelve `None` (no rompe la web).

### Paso 1 — Extraer datos crudos de Django
```python
datos_crudos = {
    'Edad': perfil.edad or 65,                    # valor por defecto si falta
    'Anos_Escolarizacion': perfil.anios_estudio or 12,
    'Meses_Desde_Ictus': perfil.meses_desde_ictus or 12,
    'MoCA_Visuo_Ejecutiva': evaluacion.score_visuoespacial,
    'MoCA_Atencion': evaluacion.score_atencion,
    ...
    'MoCA_Total': evaluacion.score_total,
}
```
Mezcla **datos del perfil** (clínicos) con **datos del MoCA** (puntuaciones). Si un dato falta, usa un **valor por defecto razonable** (edad 65, 12 años de estudio…) para que el modelo nunca reciba un hueco.

### Paso 2 — Transformación One-Hot (la parte delicada)
El modelo no entiende texto. Las variables categóricas ("Sexo", "Tipo de ictus") se convierten en columnas de 0 y 1. El modelo se entrenó con `pd.get_dummies(drop_first=True)`, así que `ml_service` **replica esa lógica a mano**:

```python
# Sexo: categorías ['F','M']; drop_first elimina 'F' → solo queda 'Sexo_M'
datos_crudos['Sexo_M'] = 1 if sexo == 'M' else 0

# Tipo_Ictus: ['Hemorragico','Isquemico'] → solo 'Tipo_Ictus_Isquemico'
datos_crudos['Tipo_Ictus_Isquemico'] = 1 if tipo == 'Isquemico' else 0

# Hemisferio: ['Bilateral','Derecho','Izquierdo','Ninguno'] → 3 columnas
datos_crudos['Hemisferio_Afectado_Derecho']   = 1 if h == 'Derecho'   else 0
datos_crudos['Hemisferio_Afectado_Izquierdo'] = 1 if h == 'Izquierdo' else 0
datos_crudos['Hemisferio_Afectado_Ninguno']   = 1 if h == 'Ninguno'   else 0

# Hemiparesia: ['No','Si'] → solo 'Hemiparesia_Dominante_Si'
datos_crudos['Hemiparesia_Dominante_Si'] = 1 if hemi == 'Si' else 0
```

> 🎓 **¿Qué es One-Hot y drop_first?** Convertir "categoría" en columnas binarias se llama *One-Hot Encoding*. `drop_first=True` elimina la primera categoría (alfabéticamente) para evitar redundancia matemática (la "trampa de las variables dummy"). Si Sexo no es M, ya sabemos que es F: no hace falta una columna para F. **El servicio debe replicar EXACTAMENTE lo que se hizo al entrenar, o el modelo predeciría mal.**

### Paso 3 — Construir y ordenar el DataFrame
```python
df = pd.DataFrame([datos_crudos])
for col in _columnas:
    if col not in df.columns:
        df[col] = 0          # rellenar con 0 las columnas que falten
df = df[_columnas]           # REORDENAR igual que en el entrenamiento
```
Esto garantiza que el modelo recibe **exactamente las columnas que espera, en el orden correcto**.

### Paso 4 — Predecir
```python
nivel_predicho = int(_modelo.predict(df)[0])
nivel_predicho = max(1, min(5, nivel_predicho))   # forzar rango 1-5
return nivel_predicho
```
Llama al modelo, fuerza el rango por seguridad y devuelve el nivel.

---

## 5. Las ~19 variables de entrada (resumen)

| Tipo | Variables |
|------|-----------|
| **Numéricas directas** | Edad, Años de escolarización, Meses desde ictus |
| **MoCA (8)** | Visuo-Ejecutiva, Identificación, Atención, Lenguaje, Abstracción, Recuerdo Diferido, Orientación, Total |
| **Categóricas (One-Hot)** | Sexo_M, Tipo_Ictus_Isquemico, Hemisferio (Derecho/Izquierdo/Ninguno), Hemiparesia_Dominante_Si |

> Para ver la lista exacta y su orden, se ejecuta `python core/ml_models/leer_pkl.py`, que imprime las columnas numeradas.

---

## 6. Cómo encaja con el resto del sistema

```
  Test MoCA terminado
        │
        ▼
  guardar_moca ──────► nivel PROVISIONAL (reglas if/else rápidas)
        │
        │  (el médico entra a auditar, más tarde)
        ▼
  auditoria_moca ─────► predecir_nivel(perfil, evaluacion)   ← ml_service.py
        │                       │
        │                       ▼
        │               modelo_niveles.pkl  →  nivel SUGERIDO (1-5)
        ▼
  El médico ve la sugerencia y CONFIRMA
        │
        ▼
  aplicar_nivel_ml ──► _aplicar_nivel_a_paciente ──► PerfilPaciente.nivel_*
        │
        ▼
  NotificacionBuzon al paciente + empieza terapia personalizada
```

Y a partir de ahí, mientras el paciente entrena, el **DDA** (sistema #3) hace micro-ajustes partida a partida.

---

## 7. Decisiones de diseño destacables

- **Robustez ante fallos:** si los `.pkl` no existen o algo peta, `predecir_nivel` devuelve `None` y la web sigue funcionando (el médico simplemente no ve sugerencia). La IA es un **añadido**, no un punto único de fallo.
- **Valores por defecto clínicos:** edad 65, 12 años de estudio… elegidos como "paciente típico de ictus" para que el modelo nunca falle por datos incompletos.
- **Humano en el bucle:** la IA nunca aplica el nivel sola; siempre lo confirma el médico.
- **Separación de responsabilidades:** la web **no entrena** el modelo (eso se hace offline en otra carpeta). Solo lo **carga y consulta**. Esto mantiene la web ligera y predecible.

---

## 8. Resumen ejecutivo (la foto en 6 frases)

1. SamiraDTx usa un modelo de **Machine Learning real** (Random Forest de scikit-learn) para predecir el **nivel ideal (1–5)** del paciente.
2. El modelo vive **ya entrenado** en `core/ml_models/` (`.pkl`); la web lo **usa**, no lo entrena (el entrenamiento es externo).
3. **`ml_service.py`** es el puente: traduce los datos de Django (texto) al formato numérico One-Hot que el modelo entiende.
4. La parte más delicada es **replicar exactamente** la codificación One-Hot del entrenamiento (mismo orden y nombre de columnas).
5. El modelo combina **datos clínicos** (edad, ictus, hemisferio) con las **7 puntuaciones MoCA**.
6. La IA **sugiere**, el **médico confirma**: nunca decide sola. Y si falla, la web sigue funcionando.

---

## 9. Puntos a explorar / clarificar

- ❓ ¿Qué algoritmo exacto y con qué datos se entrenó? Está en el repositorio hermano `IA_MachineLearnig/entrenar_modelo.py` (no incluido aquí).
- ❓ ¿Cuántos datos de entrenamiento? ¿Reales o sintéticos? Relevante para saber cuánto fiarse de la predicción.
- 🔬 Para auditar el modelo: ejecutar `leer_pkl.py` y, si se quiere ver importancia de variables, inspeccionar `modelo.feature_importances_`.

---

*Fin del Documento 5. Siguiente: el sistema VTR y el Wearable (Documento 6).*
