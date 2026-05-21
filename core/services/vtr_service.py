from django.utils import timezone
from ..models import SesionTerapia, MarcaPersonalTR

TIMEOUT_INACTIVIDAD_MIN = 60
VENTANA_FRESCA_MIN = 10
SCORE_MINIMO_BASE = 300


def obtener_o_crear_sesion(paciente, vas_inicial=None):
    """Devuelve la sesión activa del paciente. Si expiró (>60 min inactividad), crea una nueva."""
    ultima = SesionTerapia.objects.filter(paciente=paciente).first()

    if ultima is not None:
        minutos_inactivo = (timezone.now() - ultima.ultima_actividad).total_seconds() / 60
        if minutos_inactivo < TIMEOUT_INACTIVIDAD_MIN:
            return ultima

    return SesionTerapia.objects.create(
        paciente=paciente,
        vas_inicial=vas_inicial,
    )


def registrar_actividad(sesion_terapia):
    """Actualiza ultima_actividad para mantener viva la sesión."""
    sesion_terapia.ultima_actividad = timezone.now()
    sesion_terapia.save(update_fields=['ultima_actividad'])


def actualizar_marca_personal(paciente, juego, nivel, tiempo_reaccion_ms, score, sesion_terapia):
    """
    Media móvil FIFO de 3 tiempos frescos y válidos.
    Calibración: rellena tiempo1/2/3 secuencialmente hasta tener los 3.
    Tras calibración: descarta el más antiguo (tiempo1), desplaza tiempo2→1, tiempo3→2,
    nuevo→tiempo3, recalcula TR_ideal. Permite actualización por neuroplasticidad.
    """
    marca, _ = MarcaPersonalTR.objects.get_or_create(
        paciente=paciente,
        juego=juego,
        nivel=nivel,
    )

    minutos_desde_inicio = (timezone.now() - sesion_terapia.fecha_inicio).total_seconds() / 60
    if minutos_desde_inicio > VENTANA_FRESCA_MIN:
        return

    if score < SCORE_MINIMO_BASE:
        return

    if marca.TR_ideal is None:
        # Fase de calibración: rellenar slots secuencialmente
        if marca.tiempo1 is None:
            marca.tiempo1 = tiempo_reaccion_ms
        elif marca.tiempo2 is None:
            marca.tiempo2 = tiempo_reaccion_ms
        elif marca.tiempo3 is None:
            marca.tiempo3 = tiempo_reaccion_ms

        marca.partidas_base_calculadas += 1

        if marca.tiempo1 is not None and marca.tiempo2 is not None and marca.tiempo3 is not None:
            marca.TR_ideal = round((marca.tiempo1 + marca.tiempo2 + marca.tiempo3) / 3)
    else:
        # Calibrado: ventana deslizante FIFO — entra nuevo, sale el más antiguo
        marca.tiempo1 = marca.tiempo2
        marca.tiempo2 = marca.tiempo3
        marca.tiempo3 = tiempo_reaccion_ms
        marca.partidas_base_calculadas += 1
        marca.TR_ideal = round((marca.tiempo1 + marca.tiempo2 + marca.tiempo3) / 3)

    marca.save()


def calcular_degradacion(tiempo_reaccion_ms, TR_ideal):
    """
    Devuelve el % de degradación respecto al TR ideal.
    Devuelve None si aún estamos en calibración (TR_ideal no calculado).
    """
    if TR_ideal is None or TR_ideal == 0:
        return None

    degradacion = ((tiempo_reaccion_ms - TR_ideal) / TR_ideal) * 100
    return round(degradacion, 1)
