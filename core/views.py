from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.contrib import messages
from .forms import RegistroUsuarioForm
from .models import PerfilPaciente, SesionDeJuego
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import whisper
import os
import tempfile

# --- CONFIGURACIÓN WHISPER ---
MODELO_WHISPER = None

# =========================================================
# VISTAS PÚBLICAS
# =========================================================
def home(request):
    return render(request, "core/pages/home.html")

def historia(request):
    return render(request, "core/patients/historia.html")

def servicios(request):
    return render(request, "core/pages/servicios.html")

def contacto(request):
    return render(request, "core/pages/contacto.html")

# --- VISTA DE REGISTRO ---
def registro(request):
    if request.method == 'POST':
        form = RegistroUsuarioForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            
            # Intento robusto de detectar perfil médico
            es_medico = False
            try:
                if hasattr(user, 'perfil'): # Si related_name='perfil'
                    es_medico = user.perfil.es_medico
                elif hasattr(user, 'perfilpaciente'): # Si es el default
                    es_medico = user.perfilpaciente.es_medico
            except:
                pass

            if es_medico:
                return redirect('dashboard_medico') 
            else:
                return redirect('dashboard')
    else:
        form = RegistroUsuarioForm()
    return render(request, 'registration/registro.html', {'form': form})

# =========================================================
# ZONA PRIVADA (PACIENTE)
# =========================================================

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
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    context = {'perfil': perfil}
    return render(request, 'core/dashboard/dashboard.html', context)

# =========================================================
# ZONA PRIVADA (MÉDICO)
# =========================================================

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
    return render(request, 'core/dashboard/dashboard_medico.html', context)

@login_required
def detalle_paciente(request, pk):
    perfil_paciente = get_object_or_404(PerfilPaciente, pk=pk)
    
    # --- LÓGICA DE ACTUALIZACIÓN DE NIVELES (MÉDICO) ---
    # Esta parte recibe los datos del formulario en el HTML del médico
    if request.method == 'POST' and 'actualizar_niveles' in request.POST:
        try:
            # Capturamos los 3 niveles por separado
            perfil_paciente.nivel_cognitivo = int(request.POST.get('nivel_cognitivo', 1))
            perfil_paciente.nivel_lenguaje = int(request.POST.get('nivel_lenguaje', 1))
            perfil_paciente.nivel_motor = int(request.POST.get('nivel_motor', 1))
            
            # Actualizamos el global como referencia (opcional, igualamos al cognitivo por defecto)
            perfil_paciente.nivel_asignado = perfil_paciente.nivel_cognitivo
            
            perfil_paciente.save()
            messages.success(request, "Niveles del paciente actualizados correctamente.")
        except ValueError:
            messages.error(request, "Error al actualizar los niveles. Verifique los datos.")
        return redirect('detalle_paciente', pk=pk)
    # ----------------------------------------------------

    sesiones = SesionDeJuego.objects.filter(paciente=perfil_paciente).order_by('fecha')
    
    fechas = [sesion.fecha.strftime("%d/%m") for sesion in sesiones]
    puntos = [sesion.puntos for sesion in sesiones]
    
    context = {
        'paciente': perfil_paciente,
        'fechas': fechas,
        'puntos': puntos,
    }
    return render(request, 'core/patients/detalle_paciente.html', context)

@login_required
def forzar_evaluacion(request, pk):
    perfil = get_object_or_404(PerfilPaciente, pk=pk)
    perfil.test_completado = False
    perfil.nivel_asignado = 0
    perfil.save()
    messages.success(request, f"Se ha solicitado re-evaluación para {perfil.usuario.username}.")
    return redirect('dashboard_medico')

# =========================================================
# SISTEMA DE JUEGOS (RUTAS ACTUALIZADAS A TUS CARPETAS)
# =========================================================

@login_required
def juegos(request):
    return render(request, 'core/juegos.html')

@login_required
def jugar(request):
    return render(request, 'core/jugar.html')

@login_required
def sala_evaluacion(request):
    perfil, created = PerfilPaciente.objects.get_or_create(usuario=request.user)
    if request.method == 'POST':
        nivel_elegido = int(request.POST.get('resultado_simulado'))
        
        # --- ASIGNACIÓN INICIAL MÚLTIPLE ---
        # Al hacer el test, asignamos el mismo nivel a las 3 áreas para empezar
        perfil.nivel_asignado = nivel_elegido
        perfil.nivel_cognitivo = nivel_elegido
        perfil.nivel_lenguaje = nivel_elegido
        perfil.nivel_motor = nivel_elegido
        
        perfil.puntuacion_cognitiva = nivel_elegido * 6 
        perfil.test_completado = True
        perfil.fecha_ultima_evaluacion = timezone.now()
        perfil.save()
        return redirect('dashboard')
    return render(request, 'core/patients/evaluacion.html')

# --- JUEGOS DE LENGUAJE / MOCA ---
@login_required
def jugar_moca_5(request):
    # Ruta basada en tu captura: games/Lenguaje/moca/
    return render(request, 'core/games/Lenguaje/moca/juego_moca5.html')

@login_required
def jugar_moca_5_definitivo(request):
    # Ruta basada en tu captura: games/Lenguaje/moca/
    return render(request, 'core/games/Lenguaje/moca/juego_moca5_definitivo.html')

@login_required
def jugar_elsa(request):
    # Ruta basada en tu captura: games/Lenguaje/moca/
    return render(request, 'core/games/Lenguaje/moca/juego_elsa.html')

@login_required
def jugar_calculadora(request):
    # Ruta basada en tu captura: games/Lenguaje/moca/
    return render(request, 'core/games/Lenguaje/moca/juego_calculadora.html')

# --- JUEGOS MOTORES ---
@login_required
def jugar_prueba_camara(request):
    # Ruta basada en tu captura: games/motor/
    return render(request, 'core/games/motor/juego_prueba_camara.html')

# --- JUEGOS COGNITIVOS (El nuevo) ---
@login_required
def jugar_encuentra_letra(request):
    try:
        perfil = request.user.perfil 
    except:
        perfil = None

    # --- CAMBIO CLAVE: Usamos el nivel específico COGNITIVO ---
    nivel_actual = perfil.nivel_cognitivo if perfil else 1
    
    context = {
        'nivel_inicial': nivel_actual
    }
    # Ruta basada en tu captura: games/cognitivo/
    return render(request, 'core/games/cognitivo/juego_encuentra_letra.html', context)


# =========================================================
# FUNCIONES API (GUARDADO Y WHISPER)
# =========================================================

@csrf_exempt
def guardar_progreso(request):
    """
    Guarda el progreso de cualquier juego.
    Soporta formato JSON con campos: juego, nivel, puntos, tiempo, completado.
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # Intentamos obtener el perfil de forma segura
            if hasattr(request.user, 'perfil'):
                perfil = request.user.perfil
            else:
                perfil = PerfilPaciente.objects.get(usuario=request.user)
            
            # Recibimos los datos (usamos .get para evitar errores si falta algo)
            juego_nombre = data.get('juego', data.get('ejercicio', 'Desconocido')) # Soporta ambos nombres
            nivel = data.get('nivel', 1)
            puntos = data.get('puntos', 0)
            tiempo = data.get('tiempo', 0)
            completado = data.get('completado', True)
            
            # Guardamos en BD
            SesionDeJuego.objects.create(
                paciente=perfil,
                juego=juego_nombre,
                nivel_jugado=nivel,
                puntos=puntos,
                tiempo_jugado=tiempo, # ¡Aquí se guardan tus segundos!
                completado=completado
            )
            return JsonResponse({'status': 'ok'})
        except Exception as e:
            print(f"❌ Error guardando progreso: {e}")
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    return JsonResponse({'status': 'error'}, status=400)

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