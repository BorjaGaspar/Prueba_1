from django.contrib import admin
from .models import PerfilPaciente, SesionDeJuego, EvaluacionMoCA

# Configuración bonita para el Perfil
class PerfilPacienteAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'es_medico', 'puntos_totales', 'racha_dias', 'nivel_asignado')
    search_fields = ('usuario__username', 'usuario__email')
    list_filter = ('es_medico', 'test_completado') 

# Configuración bonita para las Sesiones
class SesionDeJuegoAdmin(admin.ModelAdmin):
    list_display = ('paciente', 'juego', 'puntos', 'tiempo_jugado', 'fecha')
    list_filter = ('juego', 'fecha')
    search_fields = ('paciente__usuario__username',)
    date_hierarchy = 'fecha' 

# NUEVO: Configuración para ver los resultados del test MoCA
class EvaluacionMoCAAdmin(admin.ModelAdmin):
    # Qué columnas queremos ver en la lista general
    list_display = ('paciente', 'score_total', 'fecha_evaluacion')
    list_filter = ('fecha_evaluacion',)
    search_fields = ('paciente__usuario__username',)
    date_hierarchy = 'fecha_evaluacion'
    
    # Protegemos los datos multimedia para que no se editen o borren por error en el panel
    readonly_fields = (
        'dibujo_cubo_b64', 'dibujo_reloj_b64', 'audio_frase1_b64', 
        'audio_frase2_b64', 'audio_fluidez_b64', 'audio_tren_b64', 
        'audio_reloj_b64', 'audio_recuerdo_b64', 'datos_completos_raw'
    )

# Registramos todo en el panel
admin.site.register(PerfilPaciente, PerfilPacienteAdmin)
admin.site.register(SesionDeJuego, SesionDeJuegoAdmin)
admin.site.register(EvaluacionMoCA, EvaluacionMoCAAdmin)