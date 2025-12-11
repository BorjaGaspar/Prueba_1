# Web Corporativa SamiraDTx (Clon Wearia)

Este proyecto es una aplicación web desarrollada con **Django** y **Bootstrap 5**. Simula la web corporativa de SamiraDTx, incluyendo una sección pública informativa y un área privada con gestión de usuarios.

## Características

* **Diseño Responsive:** Adaptado a móviles usando Bootstrap 5.
* **Gestión de Usuarios:** Registro, Inicio de Sesión y Cierre de Sesión.
* **Arquitectura:** Basada en plantillas de Django (Template Inheritance).
* **Base de Datos:** SQLite (por defecto para desarrollo).

## Requisitos Previos

* Python 3.10 o superior.
* Git.

## Instalación y Configuración

Sigue estos pasos para descargar y ejecutar el proyecto en tu ordenador local:

1.  **Clonar el repositorio:**
    ```bash
    git clone [https://github.com/TU_USUARIO/web_empresa.git](https://github.com/TU_USUARIO/web_empresa.git)
    cd web_empresa
    ```

2.  **Crear y activar un entorno virtual:**
    ```bash
    # En Windows:
    python -m venv venv
    .\venv\Scripts\activate

    # En Mac/Linux:
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Instalar dependencias:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Aplicar migraciones (Crear base de datos):**
    ```bash
    python manage.py migrate
    ```

5.  **Ejecutar el servidor:**
    ```bash
    python manage.py runserver
    ```

Visita `http://127.0.0.1:8000/` en tu navegador.

## 👤 Usuarios de Prueba

Para probar la plataforma puedes usar estas credenciales (o crear un usuario nuevo desde "Registrarse"):

* **Usuario:** admin
* **Contraseña:**  1234

## 📄 Estructura del Proyecto

* `core/`: Aplicación principal (Vistas, Modelos, Templates).
* `config/`: Configuraciones globales del proyecto (settings.py, urls.py).
* `templates/`: Archivos HTML.
* `static/`: Archivos CSS, Imágenes y JS.