# 📚 Documentación Completa de SamiraDTx — Índice

Esta carpeta contiene la documentación de la plataforma **SamiraDTx**, escrita para entender **toda la página web de forma progresiva**, desde la base de datos hasta el despliegue. Cada documento es independiente pero están pensados para leerse en orden.

---

## 🗺️ Orden de lectura recomendado

| # | Documento | De qué trata | Para quién |
|---|-----------|-------------|------------|
| 1 | [`BaseDeDatos.md`](BaseDeDatos.md) | Las 7 tablas, qué guarda cada una y cómo se relacionan (1:1, 1:N) | Entender los **datos** |
| 2 | [`SamiraDTxResumenCompleto.md`](SamiraDTxResumenCompleto.md) | Visión general: qué es, stack, árbol de carpetas, los 3 mundos, flujos | Entender el **mapa completo** |
| 3 | [`03_Views_ElCerebro.md`](03_Views_ElCerebro.md) | `views.py` función por función: la lógica que coordina todo | Entender la **lógica** |
| 4 | [`04_TestMoCA_Completo.md`](04_TestMoCA_Completo.md) | El test cognitivo MoCA de principio a fin (voz, Whisper, auditoría) | Entender la **evaluación** |
| 5 | [`05_InteligenciaArtificial_ML.md`](05_InteligenciaArtificial_ML.md) | El modelo de Machine Learning que asigna niveles | Entender la **IA** |
| 6 | [`06_VTR_y_Wearable.md`](06_VTR_y_Wearable.md) | Medición de fatiga: tiempo de reacción (VTR) + pulsera (wearable) | Entender la **medición** |
| 7 | [`07_Frontend_Plantillas.md`](07_Frontend_Plantillas.md) | Plantillas, layouts, accesibilidad y gráficas (Chart.js) | Entender la **cara** |
| 8 | [`08_Catalogo_Juegos.md`](08_Catalogo_Juegos.md) | Catálogo de juegos, familias JS vs Unity, patrón común | Entender la **terapia** |
| 9 | [`09_Seguridad_y_Despliegue.md`](09_Seguridad_y_Despliegue.md) | Seguridad, RGPD, Docker y checklist para producción | Entender el **despliegue** |
| 10 | [`10_Django_Framework_Explicado.md`](10_Django_Framework_Explicado.md) | Qué es Django y cómo funciona (MVT, ORM, migraciones), con ejemplos del proyecto | Entender el **framework** (leer pronto si no conoces Django) |
| 12 | [`12_Flujo_Clinico_y_Usabilidad.md`](12_Flujo_Clinico_y_Usabilidad.md) | Patient journey: alta, terapia y supervisión; usabilidad para secuelas neurológicas | Entender el **uso real** |

---

## 🧠 Resumen en una página: ¿cómo funciona SamiraDTx?

**SamiraDTx** es una terapia digital con videojuegos para pacientes de ictus, supervisada por médicos.

1. **El paciente se registra** (crea un `User` + `PerfilPaciente`) y elige su médico → *Doc 1, 3*.
2. **Hace el test MoCA** (juego Unity con voz y dibujos). Whisper transcribe su voz → *Doc 4*.
3. **El médico audita el test** y la **IA sugiere un nivel** (1–5) según datos clínicos → *Doc 5*.
4. **El paciente entrena** con juegos adaptados a su nivel → *Doc 8*.
5. **Mientras juega, se le mide** el tiempo de reacción (VTR) y el pulso (wearable) → *Doc 6*.
6. **El sistema ajusta la dificultad** automáticamente (DDA) según rendimiento y fatiga → *Doc 3*.
7. **El médico ve todo** en gráficas y se comunica por buzón → *Doc 3, 7*.

---

## 🔑 Conceptos clave para no perderse

- **Médico = Paciente + flag `es_medico`**: no son tablas separadas, es el mismo tipo de usuario.
- **Tres sistemas de niveles**: reglas MoCA (rápido), modelo ML (inteligente), DDA (adaptativo en tiempo real).
- **Dos IAs locales**: Whisper (voz→texto) y scikit-learn (predicción de nivel).
- **El wearable no tiene tabla propia**: el pulso vive dentro de cada partida (`SesionDeJuego`).
- **Patrón Store & Forward**: el paciente genera datos, se guardan, el médico revisa de forma asíncrona.
- **Dos familias de juegos**: JavaScript (editables) y Unity WebGL (caja negra).

---

## ✅ Correcciones aplicadas (mayo 2026)

- ✅ **DDA arreglado**: los juegos "Encuentra la Bolita", "Lista de la Compra" y "Música y Colores" ahora disparan el auto-ajuste de dificultad (antes sus nombres no estaban en las listas del DDA).
- ✅ **`sala_evaluacion`**: eliminada la escritura al campo inexistente `puntuacion_cognitiva`.
- ✅ **`urls.py`**: eliminadas las rutas duplicadas (`transcribir_audio`, `guardar_progreso`).
- ✅ **Whisper aclarado**: corre solo en el servidor Django. El Whisper de Unity era del experimento descartado.

## ⚠️ Puntos pendientes recopilados (de todos los documentos)

- 🔴 Config de producción: `DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS`, HTTPS, PostgreSQL (Doc 9).
- 🔴 Auditar control de acceso (IDOR) en vistas con `pk` (Doc 9).
- 📌 **Unity descartado**: limpiar vistas/plantillas/rutas residuales de los juegos Unity (Doc 8).
- 🧹 `score_tmt` se rellena con el valor de visuoespacial en `guardar_moca` (Doc 4).

---

*Documentación generada analizando el código fuente del proyecto. Última actualización: mayo 2026.*
