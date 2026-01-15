from django.contrib import admin
from .models import PerfilPaciente, SesionDeJuego

# Configuración bonita para el Perfil
class PerfilPacienteAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'es_medico', 'puntos', 'racha_dias')
    search_fields = ('usuario__username', 'usuario__email')
    list_filter = ('es_medico',)

# Configuración bonita para las Sesiones
class SesionDeJuegoAdmin(admin.ModelAdmin):
    list_display = ('paciente', 'juego', 'puntos', 'tiempo_jugado', 'fecha')
    list_filter = ('juego', 'fecha')
    search_fields = ('paciente__usuario__username',)
    date_hierarchy = 'fecha' # Añade una barra de navegación por fechas muy útil

# Registramos todo
admin.site.register(PerfilPaciente, PerfilPacienteAdmin)
admin.site.register(SesionDeJuego, SesionDeJuegoAdmin)