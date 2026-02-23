from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone 

# ================================================================
# TABLA 1: PERFIL DEL PACIENTE
# ================================================================
class PerfilPaciente(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    
    # --- DATOS GENERALES ---
    es_medico = models.BooleanField(default=False, verbose_name="¿Es Médico?")
    medico_asignado = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pacientes_supervisados')
    
    # --- DATOS FÍSICOS ---
    edad = models.IntegerField(null=True, blank=True)
    altura = models.IntegerField(null=True, blank=True)
    peso = models.IntegerField(null=True, blank=True)
    
    OPCIONES_LADO = [
        ('Izquierdo', 'Lado Izquierdo'),
        ('Derecho', 'Lado Derecho'),
        ('Ambos', 'Ambos Lados'),
        ('Ninguno', 'Sin afectación motora'),
    ]
    
    lado_afectado = models.CharField(max_length=20, choices=OPCIONES_LADO, null=True, blank=True)
    
    # --- ESTADO DE EVALUACIÓN ---
    test_completado = models.BooleanField(default=False)
    fecha_ultima_evaluacion = models.DateTimeField(null=True, blank=True)
    
    # --- NIVELES ESPECÍFICOS (NUEVO SISTEMA) ---
    # Nivel Global (Mantenemos por compatibilidad, pero usaremos los de abajo)
    nivel_asignado = models.IntegerField(default=1, verbose_name="Nivel Global (Legacy)")
    
    # Los 3 Pilares de la Terapia
    nivel_cognitivo = models.IntegerField(default=1, verbose_name="Nivel Cognitivo (1-5)")
    nivel_lenguaje = models.IntegerField(default=1, verbose_name="Nivel Lenguaje (1-5)")
    nivel_motor = models.IntegerField(default=1, verbose_name="Nivel Motor (1-5)")

    # Puntuaciones MoCA
    puntuacion_total_moca = models.IntegerField(default=0, verbose_name="MoCA Total (0-30)")
    puntuacion_cognitiva = models.IntegerField(default=0) # Campo extra que tenías
    
    # Desglose MoCA
    score_visuoespacial = models.IntegerField(default=0, verbose_name="Visuoespacial/Ejecutiva")
    score_identificacion = models.IntegerField(default=0, verbose_name="Identificación")
    score_atencion = models.IntegerField(default=0, verbose_name="Atención")
    score_lenguaje = models.IntegerField(default=0, verbose_name="Lenguaje")
    score_abstraccion = models.IntegerField(default=0, verbose_name="Abstracción")
    score_recuerdo = models.IntegerField(default=0, verbose_name="Recuerdo Diferido")
    score_orientacion = models.IntegerField(default=0, verbose_name="Orientación")
    
    puntuacion_motora = models.IntegerField(default=0, verbose_name="Score Motor (0-100)")
    
    # --- GAMIFICACIÓN ---
    racha_dias = models.IntegerField(default=0)
    dias_totales = models.IntegerField(default=0)
    puntos_totales = models.IntegerField(default=0)
    tiempo_terapia_hoy = models.IntegerField(default=0)
    
    telefono = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        return f"{self.usuario.username} ({'Médico' if self.es_medico else 'Paciente'})"


# ================================================================
# TABLA 2: HISTORIAL DE SESIONES
# ================================================================
class SesionDeJuego(models.Model):
    paciente = models.ForeignKey(PerfilPaciente, on_delete=models.CASCADE, related_name='sesiones')
    juego = models.CharField(max_length=100, default="General")
    fecha = models.DateTimeField(default=timezone.now, verbose_name="Fecha UTC")
    puntos = models.IntegerField(default=0)
    nivel_jugado = models.IntegerField(default=1)
    tiempo_jugado = models.IntegerField(default=0, verbose_name="Segundos")
    completado = models.BooleanField(default=True)
    
    # --- NUEVOS CAMPOS DE AUTOPERCEPCIÓN (Escala 1-5) ---
    dificultad_percibida = models.IntegerField(null=True, blank=True)
    estado_animo = models.IntegerField(null=True, blank=True)
    
    detalles = models.TextField(blank=True, null=True, verbose_name="Detalles JSON")

    def __str__(self):
        return f"{self.paciente.usuario.username} - {self.juego} - {self.fecha.strftime('%d/%m/%Y %H:%M')}"

    class Meta:
        ordering = ['-fecha']