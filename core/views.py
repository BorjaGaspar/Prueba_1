from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
# Importamos el formulario nuevo y el modelo
from .forms import RegistroUsuarioForm
from .models import PerfilPaciente
from django.shortcuts import render, redirect, get_object_or_404
from .models import PerfilPaciente, SesionDeJuego
from django.utils import timezone

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
        form = RegistroUsuarioForm(request.POST)
        if form.is_valid():
            user = form.save()
            
            # Recogemos los datos del formulario
            es_medico = form.cleaned_data.get('es_medico')
            
            # Si es médico, ignoramos los datos clínicos
            if es_medico:
                PerfilPaciente.objects.create(usuario=user, es_medico=True)
            else:
                # Si es paciente, guardamos todo
                edad = form.cleaned_data.get('edad')
                altura = form.cleaned_data.get('altura')
                peso = form.cleaned_data.get('peso')
                lado = form.cleaned_data.get('lado_afectado')
                medico = form.cleaned_data.get('medico_selector')
                
                PerfilPaciente.objects.create(
                    usuario=user, 
                    es_medico=False,
                    edad=edad,
                    altura=altura,
                    peso=peso,
                    lado_afectado=lado,
                    medico_asignado=medico
                )
            
            login(request, user)
            return redirect('dashboard')
    else:
        form = RegistroUsuarioForm()
    
    return render(request, 'registration/registro.html', {'form': form})

# --- ZONA PRIVADA ---


@login_required
def dashboard(request):
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    
    # --- EL SEMÁFORO DE ROLES ---
    if perfil.es_medico:
        # 1. Buscamos TODOS los perfiles cuyo médico asignado sea el usuario actual
        mis_pacientes = PerfilPaciente.objects.filter(medico_asignado=request.user)
        
        # 2. Contamos cuántos son
        total_pacientes = mis_pacientes.count()
        
        # 3. Enviamos esos datos al HTML (contexto)
        context = {
            'pacientes': mis_pacientes,
            'total_pacientes': total_pacientes
        }
        return render(request, 'core/dashboard_medico.html', context)
        
    else:
       # Verificamos si ha completado el test inicial (Cognitivo por ahora)
        if not perfil.test_completado:
            # Si es Falso, lo redirigimos obligatoriamente a la evaluación
            return redirect('sala_evaluacion')
        
        # Si es Verdadero, le dejamos pasar y ver su dashboard
        return render(request, 'core/dashboard.html')

@login_required
def juegos(request):
    return render(request, 'core/juegos.html')

@login_required
def jugar(request):
    return render(request, 'core/jugar.html')

@login_required
def detalle_paciente(request, pk):
    # 1. Buscamos al paciente
    perfil_paciente = get_object_or_404(PerfilPaciente, pk=pk)
    
    # 2. Buscamos sus sesiones de juego (ordenadas por fecha antigua -> nueva)
    sesiones = SesionDeJuego.objects.filter(paciente=perfil_paciente).order_by('fecha')
    
    # 3. Preparamos los datos para la gráfica (Listas de Python)
    # Formateamos la fecha para que se vea corta (ej: "17/12")
    fechas = [sesion.fecha.strftime("%d/%m") for sesion in sesiones]
    puntos = [sesion.puntos for sesion in sesiones]
    
    context = {
        'paciente': perfil_paciente,
        'fechas': fechas,  # Enviamos la lista de fechas
        'puntos': puntos,  # Enviamos la lista de puntos
    }
    return render(request, 'core/detalle_paciente.html', context)

@login_required
def sala_evaluacion(request):
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    
    # Si le damos a un botón de "Simular"
    if request.method == 'POST':
        # Ahora el botón nos envía directamente el número (1, 2, 3, 4 o 5)
        nivel_elegido = int(request.POST.get('resultado_simulado'))
        
        # Asignamos el nivel exacto que hemos pulsado
        perfil.nivel_asignado = nivel_elegido
        
        # Inventamos una nota cognitiva realista según el nivel (solo para rellenar)
        # Nivel 1 = 10 pts ... Nivel 5 = 30 pts
        perfil.puntuacion_cognitiva = nivel_elegido * 6 
            
        # Guardamos que YA HIZO el test
        perfil.test_completado = True
        perfil.fecha_ultima_evaluacion = timezone.now()
        perfil.save()
        
        return redirect('dashboard')

    return render(request, 'core/evaluacion.html')