from django.db import models
from django.contrib.auth.models import User

# Esto amplía la información del usuario básico
class PerfilPaciente(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    
    # Datos de Rehabilitación
    racha_dias = models.IntegerField(default=0, verbose_name="Días Seguidos (Racha)")
    dias_totales = models.IntegerField(default=0, verbose_name="Días Totales Acumulados")
    puntos = models.IntegerField(default=0, verbose_name="Puntos Acumulados")
    tiempo_terapia = models.IntegerField(default=0, verbose_name="Minutos de Terapia Hoy")
    
    # Datos opcionales (por si queremos poner foto o info médica en el futuro)
    telefono = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        return f"Perfil de {self.usuario.username}"

    class Meta:
        verbose_name = "Perfil de Paciente"
        verbose_name_plural = "Perfiles de Pacientes"