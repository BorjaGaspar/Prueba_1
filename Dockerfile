# 1. Le decimos que use una base de Python oficial 
FROM python:3.11-slim

# 2. Estas líneas evitan errores raros de Python en contenedores
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. Creamos una carpeta dentro del contenedor llamada "app" para trabajar ahí
WORKDIR /app

# 4. Copiamos requirements.txt dentro del contenedor
COPY requirements.txt /app/

# 5. Le decimos al contenedor que instale esas librerías automáticamente
RUN pip install --upgrade pip && pip install -r requirements.txt

# 6. Copiamos todo el resto de tu código dentro del contenedor
COPY . /app/

# 7. Le decimos que el comando para arrancar es el de siempre
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]