from django.contrib import admin
from django.urls import path, include
from core import views  

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # PÁGINAS PÚBLICAS
    path('', views.home, name='home'),
    path('historia/', views.historia, name='historia'),
    path('servicios/', views.servicios, name='servicios'),
    path('contacto/', views.contacto, name='contacto'),

    # API WHISPER (La nueva conexión con Unity)
    path('api/transcribir-audio/', views.transcribir_audio, name='transcribir_audio'),
    path('api/guardar-progreso/', views.guardar_progreso, name='guardar_progreso'),

    #API MocaTest
    path('api/guardar-moca/', views.guardar_moca, name='guardar_moca'),

    # RUTAS DE AUTENTICACIÓN
    path('accounts/', include('django.contrib.auth.urls')),
    path('accounts/registro/', views.registro, name='registro'),

    # PANEL PACIENTE
    path('dashboard/', views.dashboard, name='dashboard'),
    path('mi-progreso/', views.resumen_paciente, name='resumen_paciente'),
    path('terapia/', views.juegos, name='juegos'),
    path('terapia/test-memoria/', views.jugar_moca_5, name='jugar_moca_5'),
    path('terapia/test-memoria-definitivo/', views.jugar_moca_5_definitivo, name='jugar_moca_5_definitivo'),
    path('terapia/elsa/', views.jugar_elsa, name='jugar_elsa'),
    path('terapia/calculadora/', views.jugar_calculadora, name='jugar_calculadora'),
    path('terapia/encuentra-letra/', views.jugar_encuentra_letra, name='jugar_encuentra_letra'),
    path('terapia/prueba-voz/', views.jugar_prueba_voz, name='jugar_prueba_voz'),
    path('terapia/identificacion-elsa/', views.jugar_identificacion_elsa_unity, name='jugar_identificacion_elsa_unity'),
    path('buzon/', views.buzon_paciente, name='buzon_paciente'),
    path('terapia/encuentra-bolita/', views.jugar_encuentra_bolita, name='jugar_encuentra_bolita'),
    path('terapia/marea-calma/', views.jugar_marea_calma, name='jugar_marea_calma'),
    path('terapia/secuencia-musical/', views.jugar_SecuenciaMusical, name='jugar_SecuenciaMusical'),
    path('terapia/lista-compra/', views.jugar_lista_compra, name='jugar_lista_compra'),

    
    # PANEL MÉDICO 
    path('paciente/<int:pk>/', views.detalle_paciente, name='detalle_paciente'),
    path('medico/paciente/<int:pk>/analisis/', views.analisis_paciente, name='analisis_paciente'),
    path('evaluacion/', views.sala_evaluacion, name='sala_evaluacion'),
    path('forzar-evaluacion/<int:pk>/', views.forzar_evaluacion, name='forzar_evaluacion'),
    path('medico/dashboard/', views.dashboard_medico, name='dashboard_medico'),
    path('paciente/<int:pk>/moca/', views.historial_moca, name='historial_moca'),
    path('auditoria-moca/<int:pk_evaluacion>/', views.auditoria_moca, name='auditoria_moca'),
    path('api/aplicar-nivel-ml/<int:pk_evaluacion>/', views.aplicar_nivel_ml, name='aplicar_nivel_ml'),
    path('medico/paciente/<int:pk>/buzon/', views.buzon_paciente_medico, name='buzon_paciente_medico'),

    # VTR — Data Logger
    path('api/vtr/iniciar-sesion/', views.vtr_iniciar_sesion, name='vtr_iniciar_sesion'),
    path('api/vtr/guardar-partida/', views.vtr_guardar_partida, name='vtr_guardar_partida'),

    # VTR — Panel Médico
    path('medico/paciente/<int:pk>/sesiones/', views.lista_sesiones_terapia, name='lista_sesiones_terapia'),
    path('medico/sesion/<uuid:session_id>/', views.detalle_sesion_terapia, name='detalle_sesion_terapia'),
]