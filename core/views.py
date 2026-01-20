from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.contrib import messages

# Importamos formulario y modelos
from .forms import RegistroUsuarioForm
from .models import PerfilPaciente, SesionDeJuego

# --- VISTAS PÚBLICAS ---

def home(request):
    return render(request, "core/home.html")

def historia(request):
    return render(request, "core/historia.html")

def servicios(request):
    return render(request, "core/servicios.html")

def contacto(request):
    return render(request, "core/contacto.html")

# --- VISTA DE REGISTRO ---

def registro(request):
    if request.method == 'POST':
        form = RegistroUsuarioForm(request.POST)
        if form.is_valid():
            user = form.save()
            
            es_medico = form.cleaned_data.get('es_medico')
            
            if es_medico:
                PerfilPaciente.objects.create(usuario=user, es_medico=True)
                login(request, user)
                # Si es médico, lo mandamos directo a SU panel
                return redirect('dashboard_medico') 
            else:
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

# --- ZONA PRIVADA (PACIENTE) ---

@login_required


@login_required
def dashboard(request):
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    
    # 1. SI ES MÉDICO -> A su panel (Esto no cambia)
    if perfil.es_medico:
        return redirect('dashboard_medico')
        
    # 2. SI ES PACIENTE
    # A) Si no ha hecho el test -> A evaluación
    if not perfil.test_completado:
        return redirect('sala_evaluacion')
    
    # B) Si YA ha hecho el test -> ¡DIRECTO A TERAPIA! (Cambio de Isabel)
    return redirect('juegos') 
    
    # Nota: Ya no llegamos a renderizar 'core/dashboard.html' para el paciente,
    # pero no lo borres por si acaso Isabel cambia de opinión luego.

@login_required
def dashboard_medico(request):
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    
    # Seguridad: Si un paciente intenta entrar aquí, lo mandamos fuera
    if not perfil.es_medico:
        return redirect('dashboard')

    # 1. Buscamos sus pacientes
    mis_pacientes = PerfilPaciente.objects.filter(medico_asignado=request.user)
    
    # 2. Contamos cuántos son
    total_pacientes = mis_pacientes.count()
    
    # 3. Enviamos datos
    context = {
        'pacientes': mis_pacientes,
        'total_pacientes': total_pacientes
    }
    return render(request, 'core/dashboard_medico.html', context)


# --- OTRAS VISTAS ---

@login_required
def juegos(request):
    return render(request, 'core/juegos.html')

@login_required
def jugar(request):
    return render(request, 'core/jugar.html')

@login_required
def detalle_paciente(request, pk):
    perfil_paciente = get_object_or_404(PerfilPaciente, pk=pk)
    sesiones = SesionDeJuego.objects.filter(paciente=perfil_paciente).order_by('fecha')
    
    fechas = [sesion.fecha.strftime("%d/%m") for sesion in sesiones]
    puntos = [sesion.puntos for sesion in sesiones]
    
    context = {
        'paciente': perfil_paciente,
        'fechas': fechas,
        'puntos': puntos,
    }
    return render(request, 'core/detalle_paciente.html', context)

@login_required
def sala_evaluacion(request):
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    
    if request.method == 'POST':
        nivel_elegido = int(request.POST.get('resultado_simulado'))
        perfil.nivel_asignado = nivel_elegido
        perfil.puntuacion_cognitiva = nivel_elegido * 6 
        perfil.test_completado = True
        perfil.fecha_ultima_evaluacion = timezone.now()
        perfil.save()
        return redirect('dashboard')

    return render(request, 'core/evaluacion.html')

@login_required
def forzar_evaluacion(request, pk):
    perfil = get_object_or_404(PerfilPaciente, pk=pk)
    
    # Reseteamos valores
    perfil.test_completado = False
    perfil.nivel_asignado = 0
    perfil.save()
    
    messages.success(request, f"Se ha solicitado re-evaluación para {perfil.usuario.username}.")
    
    # AHORA SÍ FUNCIONARÁ PORQUE YA EXISTE LA VISTA dashboard_medico
    return redirect('dashboard_medico')