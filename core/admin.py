from django.contrib import admin
from .models import PerfilPaciente

# Esto hace que puedas ver y editar la tabla en el panel de administrador
@admin.register(PerfilPaciente)
class PerfilPacienteAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'puntos', 'racha_dias', 'dias_totales')
    search_fields = ('usuario__username',)