from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import PerfilPaciente

class RegistroUsuarioForm(UserCreationForm):
    # --- 1. NUEVOS CAMPOS  ---
    first_name = forms.CharField(label="Nombre", max_length=30, required=True, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ej: Borja'}))
    last_name = forms.CharField(label="Apellidos", max_length=30, required=True, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ej: Gaspar'}))
    email = forms.EmailField(label="Correo Electrónico", required=True, widget=forms.EmailInput(attrs={'class': 'form-control'}))

    # --- 2. Casilla de Rol ---
    es_medico = forms.BooleanField(required=False, label="Soy Profesional de la Salud (Médico/Terapeuta)", widget=forms.CheckboxInput(attrs={'class': 'form-check-input', 'id': 'check_es_medico'}))

    # --- 3. Datos Clínicos ---
    edad = forms.IntegerField(required=False, label="Edad", widget=forms.NumberInput(attrs={'class': 'form-control'}))
    altura = forms.IntegerField(required=False, label="Altura (cm)", widget=forms.NumberInput(attrs={'class': 'form-control'}))
    peso = forms.IntegerField(required=False, label="Peso (kg)", widget=forms.NumberInput(attrs={'class': 'form-control'}))
    
    lado_afectado = forms.ChoiceField(choices=PerfilPaciente.OPCIONES_LADO, required=False, label="Lado corporal afectado", widget=forms.Select(attrs={'class': 'form-select'}))

    # --- CAMPOS CLÍNICOS PARA MODELO ML ---
    sexo = forms.ChoiceField(choices=[('', '-- Seleccione --')] + list(PerfilPaciente.OPCIONES_SEXO), required=False, label="Sexo", widget=forms.Select(attrs={'class': 'form-select'}))
    meses_desde_ictus = forms.IntegerField(required=False, label="Meses desde el ictus", min_value=0, widget=forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Ej: 6', 'min': '0'}))
    tipo_ictus = forms.ChoiceField(choices=[('', '-- Seleccione --')] + list(PerfilPaciente.OPCIONES_TIPO_ICTUS), required=False, label="Tipo de ictus", widget=forms.Select(attrs={'class': 'form-select'}))
    hemisferio_afectado = forms.ChoiceField(choices=[('', '-- Seleccione --')] + list(PerfilPaciente.OPCIONES_HEMISFERIO), required=False, label="Hemisferio cerebral afectado", widget=forms.Select(attrs={'class': 'form-select'}))
    hemiparesia_dominante = forms.ChoiceField(choices=[('', '-- Seleccione --')] + list(PerfilPaciente.OPCIONES_HEMIPARESIA), required=False, label="¿Hemiparesia en lado dominante?", widget=forms.Select(attrs={'class': 'form-select'}))

    # --- CAMPOS PARA MOCA ---
    anios_estudio = forms.IntegerField(required=False, label="Años de escolarización (Ej: 12)", widget=forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Años de estudio'}))
    lugar_habitual = forms.CharField(required=False, label="¿Dónde suele estar? (Ej: Mi casa)", max_length=100, widget=forms.TextInput(attrs={'class': 'form-control'}))
    ciudad_residencia = forms.CharField(required=False, label="Ciudad de residencia", max_length=100, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ej: Bilbao'}))

    # --- 4. Selector de Médico ---
    medico_selector = forms.ModelChoiceField(
        queryset=User.objects.filter(perfil__es_medico=True),
        required=True,
        label="Selecciona tu Médico",
        widget=forms.Select(attrs={'class': 'form-select'}),
        empty_label="-- Selecciona un médico --"
    )

    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email']

    # --- 5. Lógica de Guardado ---
    def save(self, commit=True):
        user = super().save(commit=False)
        user.first_name = self.cleaned_data['first_name']
        user.last_name = self.cleaned_data['last_name']
        user.email = self.cleaned_data['email']
        
        if commit:
            user.save()
            es_medico = self.cleaned_data.get('es_medico')
            
            if es_medico:
                PerfilPaciente.objects.create(usuario=user, es_medico=True)
            else:
                PerfilPaciente.objects.create(
                    usuario=user,
                    es_medico=False,
                    edad=self.cleaned_data.get('edad'),
                    altura=self.cleaned_data.get('altura'),
                    peso=self.cleaned_data.get('peso'),
                    lado_afectado=self.cleaned_data.get('lado_afectado'),
                    medico_asignado=self.cleaned_data.get('medico_selector'),
                    sexo=self.cleaned_data.get('sexo') or None,
                    meses_desde_ictus=self.cleaned_data.get('meses_desde_ictus'),
                    tipo_ictus=self.cleaned_data.get('tipo_ictus') or None,
                    hemisferio_afectado=self.cleaned_data.get('hemisferio_afectado') or None,
                    hemiparesia_dominante=self.cleaned_data.get('hemiparesia_dominante') or None,
                    anios_estudio=self.cleaned_data.get('anios_estudio'),
                    lugar_habitual=self.cleaned_data.get('lugar_habitual'),
                    ciudad_residencia=self.cleaned_data.get('ciudad_residencia')
                )
                
        return user