from django.contrib import admin
from django.urls import path, include
from core import views  # Importamos tu vista

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home, name='home'), # La ruta vacía '' es la portada
    path('historia/', views.historia, name='historia'),
    path('servicios/',views.servicios, name='servicios'),
    path('contacto/',views.contacto, name='contacto'),
    # RUTAS DE AUTENTICACIÓN (NUEVO)
    # Esto habilita /accounts/login/, /accounts/logout/, etc. automáticamente
    path('accounts/', include('django.contrib.auth.urls')),
    path('accounts/registro/', views.RegistroUsuario.as_view(), name='registro'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('terapia/', views.juegos, name='juegos'),
    path('jugar/', views.jugar, name='jugar'),
]