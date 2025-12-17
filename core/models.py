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