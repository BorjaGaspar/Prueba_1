from django.shortcuts import render

def home(request):
    return render(request, "core/home.html")

def historia(request):
    return render(request, "core/historia.html")