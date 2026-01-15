from django.db import models
from django.contrib.auth.models import User

class PerfilPaciente(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    
    # --- ROLES ---
    es_medico = models.BooleanField(default=False, verbose_name="¿Es Médico?")
    
    # --- DATOS CLÍNICOS (NUEVO) ---
    # null=True permite que estén vacíos (para usuarios antiguos o médicos)
    edad = models.IntegerField(null=True, blank=True, verbose_name="Edad")
    altura = models.IntegerField(null=True, blank=True, verbose_name="Altura (cm)")
    peso = models.IntegerField(null=True, blank=True, verbose_name="Peso (kg)")
    
    OPCIONES_LADO = [
        ('Izquierdo', 'Lado Izquierdo'),
        ('Derecho', 'Lado Derecho'),
        ('Ambos', 'Ambos Lados'),
        ('Ninguno', 'Sin afectación motora'),
    ]
    lado_afectado = models.CharField(max_length=20, choices=OPCIONES_LADO, null=True, blank=True, verbose_name="Lado Afectado (Hemiplejia)")
    
    # ### NUEVO: SISTEMA DE EVALUACIÓN Y NIVELES
    # ==========================================================
    test_completado = models.BooleanField(default=False, verbose_name="¿Evaluación Inicial Completada?")
    
    # El nivel que la web mandará a Unity (1: Muy fácil ... 5: Difícil)
    nivel_asignado = models.IntegerField(default=1, verbose_name="Nivel de Dificultad (1-5)")
    
    # Guardamos las notas exactas para ver la evolución clínica
    puntuacion_cognitiva = models.IntegerField(default=0, verbose_name="Score Cognitivo (0-30)")
    puntuacion_motora = models.IntegerField(default=0, verbose_name="Score Motor (0-100)")
    
    fecha_ultima_evaluacion = models.DateTimeField(null=True, blank=True, verbose_name="Fecha última evaluación")
    # ==========================================================

    # Gamificación (Lo que ya tenías)
    puntos = models.IntegerField(default=0)
    racha_dias = models.IntegerField(default=0)

    # --- RELACIÓN MÉDICO ---
    medico_asignado = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='pacientes_supervisados',
        verbose_name="Médico Supervisor"
    )

    # --- DATOS DE JUEGO (GAMIFICACIÓN) ---
    racha_dias = models.IntegerField(default=0, verbose_name="Días Seguidos")
    dias_totales = models.IntegerField(default=0, verbose_name="Días Totales")
    puntos = models.IntegerField(default=0, verbose_name="Puntos")
    tiempo_terapia = models.IntegerField(default=0, verbose_name="Minutos Hoy")
    
    telefono = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        role = "Médico" if self.es_medico else "Paciente"
        return f"{self.usuario.username} ({role})"
    
    
    
  
class SesionDeJuego(models.Model):
    # 1. ¿Quién jugó? (Vinculamos con el perfil del paciente)
    paciente = models.ForeignKey(PerfilPaciente, on_delete=models.CASCADE, related_name='sesiones')
    
    # 2. Datos de la partida
    fecha = models.DateTimeField(auto_now_add=True, verbose_name="Fecha y Hora")
    puntos = models.IntegerField(default=0, verbose_name="Puntos ganados")
    tiempo_jugado = models.IntegerField(default=0, verbose_name="Segundos jugados")
    
    # 3. Datos extra (opcionales por si en el futuro hay más juegos)
    juego = models.CharField(max_length=50, default="Memory", verbose_name="Nombre del Juego")
    nivel_alcanzado = models.IntegerField(default=1, verbose_name="Nivel")

    def __str__(self):
        return f"{self.paciente.usuario.username} - {self.puntos} pts ({self.fecha.strftime('%d/%m/%Y')})"

    class Meta:
        verbose_name = "Sesión de Juego"
        verbose_name_plural = "Historial de Sesiones"
        ordering = ['-fecha'] # Ordenar: las más nuevas primero