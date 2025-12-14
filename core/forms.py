from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

class RegistroUsuarioForm(UserCreationForm):
    # Añadimos la casilla para marcar si es médico
    es_medico = forms.BooleanField(
        required=False, 
        label="Soy Profesional de la Salud (Médico/Terapeuta)",
        widget=forms.CheckboxInput(attrs={'class': 'form-check-input'})
    )
    
    class Meta:
        model = User
        fields = ['username', 'email'] # Pedimos usuario y email