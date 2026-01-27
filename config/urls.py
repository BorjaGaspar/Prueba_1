from django.contrib import admin
from django.urls import path, include
from core import views  # Importamos tu vista

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home, name='home'),
    path('historia/', views.historia, name='historia'),
    path('servicios/', views.servicios, name='servicios'),
    path('contacto/', views.contacto, name='contacto'),

    # RUTAS DE AUTENTICACIÓN
    path('accounts/', include('django.contrib.auth.urls')),
    path('accounts/registro/', views.registro, name='registro'),

    # PANEL PACIENTE
    path('dashboard/', views.dashboard, name='dashboard'),
    path('mi-progreso/', views.resumen_paciente, name='resumen_paciente'),
    path('terapia/', views.juegos, name='juegos'),
    path('jugar/', views.jugar, name='jugar'),
    path('terapia/test-memoria/', views.jugar_moca_5, name='jugar_moca_5'),
    
    # PANEL MÉDICO 
    path('paciente/<int:pk>/', views.detalle_paciente, name='detalle_paciente'),
    path('evaluacion/', views.sala_evaluacion, name='sala_evaluacion'),
    path('forzar-evaluacion/<int:pk>/', views.forzar_evaluacion, name='forzar_evaluacion'),
    path('medico/dashboard/', views.dashboard_medico, name='dashboard_medico'),
]