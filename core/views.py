from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
# Importamos el formulario nuevo y el modelo
from .forms import RegistroUsuarioForm
from .models import PerfilPaciente

# --- VISTAS PÚBLICAS (Las que ya tenías) ---

def home(request):
    return render(request, "core/home.html")

def historia(request):
    return render(request, "core/historia.html")

def servicios(request):
    return render(request, "core/servicios.html")

def contacto(request):
    return render(request, "core/contacto.html")

# --- VISTA DE REGISTRO (Nueva Lógica) ---
# Hemos cambiado la "Class Based View" por esta función
# porque nos permite guardar la casilla "es_medico" más fácilmente.

def registro(request):
    if request.method == 'POST':
        # Cargamos los datos del formulario
        form = RegistroUsuarioForm(request.POST)
        if form.is_valid():
            user = form.save()
            
            # --- AQUÍ ESTÁ LA MAGIA ---
            # Miramos si marcó la casilla "es_medico" en el formulario
            es_medico_input = form.cleaned_data.get('es_medico')
            
            # Creamos el perfil guardando ese dato inmediatamente
            PerfilPaciente.objects.create(usuario=user, es_medico=es_medico_input)
            
            # Logueamos al usuario directamente y lo mandamos al dashboard
            login(request, user)
            return redirect('dashboard')
    else:
        # Si entra por primera vez, le damos el formulario vacío
        form = RegistroUsuarioForm()
    
    # Renderizamos la plantilla de registro
    return render(request, 'registration/registro.html', {'form': form})

# --- ZONA PRIVADA ---

@login_required
def dashboard(request):
    # Obtenemos el perfil (o lo creamos si no existe por seguridad)
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    
    # --- EL SEMÁFORO DE ROLES ---
    if perfil.es_medico:
        # Si es médico, le mostramos el panel de gestión (blanco)
        return render(request, 'core/dashboard_medico.html')
    else:
        # Si es paciente, le mostramos su terapia (verde)
        return render(request, 'core/dashboard.html')

@login_required
def juegos(request):
    return render(request, 'core/juegos.html')

@login_required
def jugar(request):
    return render(request, 'core/jugar.html')