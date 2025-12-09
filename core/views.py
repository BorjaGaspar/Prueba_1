from django.shortcuts import render,redirect
from django.contrib.auth.forms import UserCreationForm # <-- NUEVO: Importamos el formulario
from django.urls import reverse_lazy # <-- NUEVO
from django.views.generic import CreateView

def home(request):
    return render(request, "core/home.html")

def historia(request):
    return render(request, "core/historia.html")

def servicios(request):
    return render(request,"core/servicios.html")

def contacto(request):
    return render(request,"core/contacto.html")

class RegistroUsuario(CreateView):
    template_name = 'registration/registro.html'
    form_class = UserCreationForm
    success_url = reverse_lazy('login') # Cuando el registro sea OK, lo mandamos a Login
