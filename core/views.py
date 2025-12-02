from django.shortcuts import render

def home(request):
    return render(request, "core/home.html")

def historia(request):
    return render(request, "core/historia.html")

def servicios(request):
    return render(request,"core/servicios.html")

def contacto(request):
    return render(request,"core/contacto.html")

