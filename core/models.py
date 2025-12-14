from django.db import models
from django.contrib.auth.models import User

class PerfilPaciente(models.Model):
    # Relación 1 a 1 con el sistema de usuarios de Django
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    
    # --- NUEVOS CAMPOS PARA ROLES ---
    # 1. ¿Es este usuario un médico? (Por defecto NO)
    es_medico = models.BooleanField(default=False, verbose_name="¿Es Médico?")
    
    # 2. ¿Quién es su médico supervisor? (Opcional, puede ser null/blank)
    # Es una relación hacia OTRO usuario del sistema.
    medico_asignado = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, # Si el médico se borra, el paciente no se borra, solo se queda sin médico.
        null=True, 
        blank=True, 
        related_name='pacientes_supervisados', # Así el médico puede pedir "dame mi lista de pacientes"
        verbose_name="Médico Supervisor (Opcional)"
    )
    # -------------------------------

    # Datos de Rehabilitación (Solo tienen sentido si NO es médico)
    racha_dias = models.IntegerField(default=0, verbose_name="Días Seguidos (Racha)")
    dias_totales = models.IntegerField(default=0, verbose_name="Días Totales Acumulados")
    puntos = models.IntegerField(default=0, verbose_name="Puntos Acumulados")
    tiempo_terapia = models.IntegerField(default=0, verbose_name="Minutos de Terapia Hoy")
    
    # Datos opcionales
    telefono = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        role = "Médico" if self.es_medico else "Paciente"
        return f"Perfil de {self.usuario.username} ({role})"

    class Meta:
        verbose_name = "Perfil de Usuario (Médico/Paciente)"
        verbose_name_plural = "Perfiles de Usuarios"