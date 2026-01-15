from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import PerfilPaciente

class RegistroUsuarioForm(UserCreationForm):
    # 1. Casilla de Rol
    es_medico = forms.BooleanField(
        required=False, 
        label="Soy Profesional de la Salud (Médico/Terapeuta)",
        widget=forms.CheckboxInput(attrs={'class': 'form-check-input', 'id': 'check_es_medico'})
    )

    # 2. Datos Clínicos (Los ponemos required=False para validarlos manualmente luego)
    edad = forms.IntegerField(required=False, label="Edad", widget=forms.NumberInput(attrs={'class': 'form-control'}))
    altura = forms.IntegerField(required=False, label="Altura (cm)", widget=forms.NumberInput(attrs={'class': 'form-control'}))
    peso = forms.IntegerField(required=False, label="Peso (kg)", widget=forms.NumberInput(attrs={'class': 'form-control'}))
    
    lado_afectado = forms.ChoiceField(
        choices=PerfilPaciente.OPCIONES_LADO, 
        required=False, 
        label="Lado corporal afectado",
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    # 3. Selector de Médico
    # Esto busca en la base de datos a usuarios que tengan perfil.es_medico = True
    medico_selector = forms.ModelChoiceField(
        queryset=User.objects.filter(perfil__es_medico=True),
        required=False,
        label="Selecciona tu Médico (Opcional)",
        widget=forms.Select(attrs={'class': 'form-select'}),
        empty_label="-- Prefiero ir por libre --"
    )

    class Meta:
        model = User
        fields = ['username', 'email']