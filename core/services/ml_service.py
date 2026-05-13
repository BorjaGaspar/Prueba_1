"""
ml_service.py — Servicio de predicción de nivel ideal para SamiraDTx.

Este módulo actúa como PUENTE entre la base de datos de Django y el modelo
de Machine Learning entrenado con scikit-learn.

Flujo:
    1. Recibe un PerfilPaciente y una EvaluacionMoCA.
    2. Extrae los datos crudos de Django (ej: sexo="F", tipo_ictus="Isquemico").
    3. Los transforma al formato One-Hot que espera el modelo (ej: Sexo_F=1).
    4. Reordena las columnas según columnas_modelo.pkl.
    5. Llama a modelo.predict() y devuelve el nivel ideal (1-5).
"""

import os
import logging
import pandas as pd
import joblib

logger = logging.getLogger(__name__)

# ================================================================
# CARGA DEL MODELO (se ejecuta UNA sola vez al arrancar Django)
# ================================================================
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ML_DIR = os.path.join(_BASE_DIR, 'ml_models')

_modelo = None
_columnas = None

def _cargar_modelo():
    """Carga perezosa del modelo y las columnas. Solo se ejecuta una vez."""
    global _modelo, _columnas
    if _modelo is None:
        ruta_modelo = os.path.join(_ML_DIR, 'modelo_niveles.pkl')
        ruta_columnas = os.path.join(_ML_DIR, 'columnas_modelo.pkl')
        
        if not os.path.exists(ruta_modelo) or not os.path.exists(ruta_columnas):
            logger.error(
                f"[ML Service] No se encontraron los archivos del modelo en {_ML_DIR}. "
                f"Copia 'modelo_niveles.pkl' y 'columnas_modelo.pkl' a esa carpeta."
            )
            return False
        
        try:
            _modelo = joblib.load(ruta_modelo)
            _columnas = joblib.load(ruta_columnas)
            logger.info(f"[ML Service] Modelo cargado correctamente. Espera {len(_columnas)} columnas.")
        except Exception as e:
            logger.error(f"[ML Service] Error al cargar los archivos .pkl: {e}", exc_info=True)
            return False
            
    return True


# ================================================================
# FUNCIÓN PRINCIPAL: PREDECIR NIVEL IDEAL
# ================================================================
def predecir_nivel(perfil_paciente, evaluacion_moca):
    """
    Predice el nivel ideal (1-5) para un paciente tras su evaluación MoCA.
    
    Args:
        perfil_paciente: Instancia de PerfilPaciente (con datos clínicos).
        evaluacion_moca: Instancia de EvaluacionMoCA (con scores validados).
    
    Returns:
        int: Nivel ideal predicho (1-5), o None si hay error.
    """
    if not _cargar_modelo():
        return None
    
    try:
        # --- PASO 1: Extraer datos crudos de Django ---
        datos_crudos = {
            'Edad': perfil_paciente.edad or 65,  # Valor por defecto razonable
            'Anos_Escolarizacion': perfil_paciente.anios_estudio or 12,
            'Meses_Desde_Ictus': perfil_paciente.meses_desde_ictus or 12,
            'MoCA_Visuo_Ejecutiva': evaluacion_moca.score_visuoespacial,
            'MoCA_Identificacion': evaluacion_moca.score_identificacion,
            'MoCA_Atencion': evaluacion_moca.score_atencion,
            'MoCA_Lenguaje': evaluacion_moca.score_lenguaje,
            'MoCA_Abstraccion': evaluacion_moca.score_abstraccion,
            'MoCA_Recuerdo_Diferido': evaluacion_moca.score_recuerdo,
            'MoCA_Orientacion': evaluacion_moca.score_orientacion,
            'MoCA_Total': evaluacion_moca.score_total,
        }
        
        # --- PASO 2: Crear columnas One-Hot manualmente ---
        # El modelo fue entrenado con pd.get_dummies(drop_first=True).
        # Eso significa que la PRIMERA categoría alfabética de cada variable
        # se usa como referencia (se "borra"). Debemos replicar eso exactamente.
        
        # Sexo: categorías originales ['F', 'M']. drop_first elimina 'F'.
        # -> Solo queda la columna 'Sexo_M'
        sexo = perfil_paciente.sexo or 'M'
        datos_crudos['Sexo_M'] = 1 if sexo == 'M' else 0
        
        # Tipo_Ictus: ['Hemorragico', 'Isquemico']. drop_first elimina 'Hemorragico'.
        # -> Solo queda la columna 'Tipo_Ictus_Isquemico'
        tipo = perfil_paciente.tipo_ictus or 'Isquemico'
        datos_crudos['Tipo_Ictus_Isquemico'] = 1 if tipo == 'Isquemico' else 0
        
        # Hemisferio_Afectado: ['Bilateral', 'Derecho', 'Izquierdo', 'Ninguno'].
        # drop_first elimina 'Bilateral'.
        # -> Quedan: Hemisferio_Afectado_Derecho, _Izquierdo, _Ninguno
        hemisferio = perfil_paciente.hemisferio_afectado or 'Ninguno'
        datos_crudos['Hemisferio_Afectado_Derecho'] = 1 if hemisferio == 'Derecho' else 0
        datos_crudos['Hemisferio_Afectado_Izquierdo'] = 1 if hemisferio == 'Izquierdo' else 0
        datos_crudos['Hemisferio_Afectado_Ninguno'] = 1 if hemisferio == 'Ninguno' else 0
        
        # Hemiparesia_Dominante: ['No', 'Si']. drop_first elimina 'No'.
        # -> Solo queda: Hemiparesia_Dominante_Si
        hemiparesia = perfil_paciente.hemiparesia_dominante or 'No'
        datos_crudos['Hemiparesia_Dominante_Si'] = 1 if hemiparesia == 'Si' else 0
        
        # --- PASO 3: Crear DataFrame y reordenar según columnas del entrenamiento ---
        df = pd.DataFrame([datos_crudos])
        
        # Asegurar que TODAS las columnas existen (rellenar con 0 las que falten)
        for col in _columnas:
            if col not in df.columns:
                df[col] = 0
        
        # Reordenar exactamente como en el entrenamiento
        df = df[_columnas]

        
        # --- PASO 4: Predecir ---
        nivel_predicho = int(_modelo.predict(df)[0])
        
        # Asegurar rango válido
        nivel_predicho = max(1, min(5, nivel_predicho))
        
        logger.info(
            f"[ML Service] Predicción para {perfil_paciente.usuario.username}: "
            f"Nivel {nivel_predicho} (MoCA Total: {evaluacion_moca.score_total})"
        )
        
        return nivel_predicho
        
    except Exception as e:
        logger.error(f"[ML Service] Error en predicción: {e}", exc_info=True)
        return None
