from django.contrib import admin
from django.urls import path
from core import views  # Importamos tu vista

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home, name='home'), # La ruta vacía '' es la portada
    path('historia/', views.historia, name='historia'),
    path('servicios/',views.servicios, name='servicios'),
    path('contacto/',views.contacto, name='contacto'),
]