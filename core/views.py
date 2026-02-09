from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.contrib import messages
from .forms import RegistroUsuarioForm
from .models import PerfilPaciente, SesionDeJuego
import json 

# --- NUEVOS IMPORTS PARA WHISPER ---
import whisper
import os
import tempfile
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt 

# --- CONFIGURACIÓN WHISPER ---
MODELO_WHISPER = None

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
            login(request, user)
            
            if hasattr(user, 'perfilpaciente') and user.perfilpaciente.es_medico:
                return redirect('dashboard_medico') 
            else:
                return redirect('dashboard')
    else:
        form = RegistroUsuarioForm()
    return render(request, 'registration/registro.html', {'form': form})

# --- ZONA PRIVADA (PACIENTE) ---

@login_required
def dashboard(request):
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    if perfil.es_medico:
        return redirect('dashboard_medico')
    if not perfil.test_completado:
        return redirect('sala_evaluacion')
    return redirect('juegos') 


@login_required
def resumen_paciente(request):
    # 1. Obtenemos el perfil actualizado de la base de datos
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    
    # 2. Imprimimos en la consola negra para que veas si Django lo detecta
    print(f"DEBUG: Usuario {request.user.username} - Médico: {perfil.medico_asignado}")

    # 3. Enviamos el 'perfil' explícitamente al HTML
    context = {
        'perfil': perfil
    }
    return render(request, 'core/dashboard.html', context)

# --- ZONA PRIVADA (MÉDICO) ---

@login_required
def dashboard_medico(request):
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    if not perfil.es_medico:
        return redirect('dashboard')

    mis_pacientes = PerfilPaciente.objects.filter(medico_asignado=request.user)
    total_pacientes = mis_pacientes.count()
    
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
    perfil.test_completado = False
    perfil.nivel_asignado = 0
    perfil.save()
    messages.success(request, f"Se ha solicitado re-evaluación para {perfil.usuario.username}.")
    return redirect('dashboard_medico')

@login_required
def jugar_moca_5(request):
    return render(request, 'core/juego_moca5.html')

@login_required
def jugar_moca_5_definitivo(request):
    return render(request, 'core/juego_moca5_definitivo.html')

@login_required
def jugar_prueba_camara(request):
    return render(request, 'core/juego_prueba_camara.html')

@login_required
def jugar_elsa(request):
    return render(request, 'core/juego_elsa.html')


# ---------------------------------------------------------
# FUNCIONES API (WHISPER Y GUARDADO)
# ---------------------------------------------------------
@csrf_exempt 
def transcribir_audio(request):
    global MODELO_WHISPER 

    if request.method == 'POST' and request.FILES.get('audio'):
        try:
            if MODELO_WHISPER is None:
                print("⏳ Cargando modelo Whisper por primera vez...")
                MODELO_WHISPER = whisper.load_model("tiny")
                print("✅ Modelo cargado y listo.")

            archivo_audio = request.FILES['audio']
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                for chunk in archivo_audio.chunks():
                    tmp.write(chunk)
                ruta_temporal = tmp.name

            resultado = MODELO_WHISPER.transcribe(ruta_temporal, language="es")
            texto_detectado = resultado["text"]
            
            os.remove(ruta_temporal)
            
            print(f"🎤 Whisper escuchó: {texto_detectado}")
            return JsonResponse({'texto_transcrito': texto_detectado})

        except Exception as e:
            print(f"❌ Error al transcribir: {e}")
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'No se recibió audio'}, status=400)

@csrf_exempt
def guardar_progreso(request):
    if request.method == 'POST':
        try:
            datos = json.loads(request.body)
            juego = datos.get('ejercicio', 'desconocido')
            estado = datos.get('estado', 'incompleto')
            
            print(f"💾 Guardando: Juego={juego}, Estado={estado}")

            if request.user.is_authenticated:
                perfil = getattr(request.user, 'perfilpaciente', None)
                if perfil:
                    puntos = 10 if estado == 'completado' else 0
                    SesionDeJuego.objects.create(
                        paciente=perfil,
                        juego=juego,
                        puntos=puntos,
                        comentarios=f"Estado: {estado}"
                    )
                    return JsonResponse({'status': 'ok'})
            
            return JsonResponse({'status': 'ok'})

        except Exception as e:
            print(f"❌ Error al guardar: {e}")
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Método no permitido'}, status=405)

@login_required
def jugar_calculadora(request):
    return render(request, 'core/juego_calculadora.html')