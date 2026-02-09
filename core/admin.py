from django.contrib import admin
from .models import PerfilPaciente, SesionDeJuego

# Configuración bonita para el Perfil
class PerfilPacienteAdmin(admin.ModelAdmin):
    # CAMBIO IMPORTANTE: 'puntos' ahora es 'puntos_totales'
    # He añadido 'nivel_asignado' para que veas el nivel de cada paciente de un vistazo
    list_display = ('usuario', 'es_medico', 'puntos_totales', 'racha_dias', 'nivel_asignado')
    search_fields = ('usuario__username', 'usuario__email')
    list_filter = ('es_medico', 'test_completado') # Filtro útil para ver quién ha hecho el test

# Configuración bonita para las Sesiones
class SesionDeJuegoAdmin(admin.ModelAdmin):
    # Aquí 'puntos' SÍ es correcto (porque son los puntos de esa partida)
    list_display = ('paciente', 'juego', 'puntos', 'tiempo_jugado', 'fecha')
    list_filter = ('juego', 'fecha')
    search_fields = ('paciente__usuario__username',)
    date_hierarchy = 'fecha' # Añade una barra de navegación por fechas muy útil

# Registramos todo
admin.site.register(PerfilPaciente, PerfilPacienteAdmin)
admin.site.register(SesionDeJuego, SesionDeJuegoAdmin)