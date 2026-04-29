#  WebSamira (Prueba_1)

Proyecto para la gestión y visualización de datos de wearables, desarrollado en Python/Django y preparado para su implementación con Docker.

##  Requisitos

* Windows 10/11
* [Git](https://git-scm.com/)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Opcional, para despliegue rápido)
* Python 3.10+ (Si se ejecuta manualmente)

##  Instalación

### 1. Clonar el repositorio


```bash
git clone [https://github.com/BorjaGaspar/webSamiraDTx.git](https://github.com/BorjaGaspar/webSamiraDTx.git)
cd webSamiraDTx
```
### 2. Opción A: Ejecución con Docker


Si tienes Docker instalado, levanta todo el entorno con un solo comando:
```bash
docker-compose up --build
```
Importante: La primera vez que levantes el contenedor, debes sincronizar la base de datos ejecutando en otra terminal
```bash
python manage.py migrate
```

La web estará disponible en: http://localhost:8000

### 3. Opción B: Ejecución Manual (Entorno Virtual)

Si prefieres usar el método clásico sin contenedores:

Crear y activar entorno:

```bash
python -m venv venv
.\venv\Scripts\activate
```
Instalar dependencias:
```bash
pip install -r requirements.txt
```
Ejecutar servidor:
```bash
python manage.py runserver
```
## Estructura del Proyecto
* config/: Configuración global de Django.
* core/: Aplicación principal (Vistas públicas y privadas).
* requirements.txt: Dependencias.
* Dockerfile & docker-compose.yml: Configuración Docker.

---

## 🚀 Despliegue en Producción (Servidor EvidaGroup)

**Actualizado: 29 de Abril de 2026**

El proyecto está desplegado en el servidor EvidaGroup como un servicio systemd gestionado con Docker.

- **URL pública:** https://test.evidagroup.es
- **Servidor:** `85.214.130.154` (h3003385.stratoserver.net)
- **IP interna Docker:** `172.27.0.2` (red `samiradtx_network` — 172.27.0.0/16)
- **Contenedor:** `CONTAINER_SAMIRADTX`

### Diferencias entre `docker-compose.yml` y `docker-prod-compose.yml`

| | `docker-compose.yml` (local) | `docker-prod-compose.yml` (producción) |
|---|---|---|
| Puertos expuestos | `8000:8000` (acceso directo) | ❌ Ninguno (solo nginx accede internamente) |
| Red | Sin red personalizada | `samiradtx_network` con IP fija `172.27.0.2` |
| Comando | `runserver` simple | `migrate` + `runserver` |
| `restart` | No definido | `unless-stopped` |
| Acceso | `http://localhost:8000` | `https://test.evidagroup.es` (vía nginx) |

### Ejecutar en producción

```bash
# Construir la imagen (primera vez o tras cambios en Dockerfile/requirements.txt)
cd /home/admin/webSamiraDTx
docker-compose -f docker-prod-compose.yml build

# Levantar el contenedor en background
docker-compose -f docker-prod-compose.yml up -d

# Ver logs en tiempo real
docker logs CONTAINER_SAMIRADTX -f

# Detener el contenedor
docker-compose -f docker-prod-compose.yml down
```

### Gestión con systemd (recomendado en producción)

El servicio `samiradtx.service` arranca automáticamente al reiniciar el servidor y forma parte del sistema de gestión centralizado:

```bash
# Estado del servicio
systemctl status samiradtx.service

# Iniciar / detener / reiniciar
systemctl start samiradtx.service
systemctl stop samiradtx.service
systemctl restart samiradtx.service

# Ver logs del servicio
journalctl -u samiradtx.service -f

# Script centralizado (gestiona TODOS los servicios del servidor)
/home/admin/docker-services.sh status
/home/admin/docker-services.sh start    # arranca en orden jerárquico
/home/admin/docker-services.sh stop
/home/admin/docker-services.sh logs samiradtx
```

### Arquitectura nginx (proxy inverso + SSL)

El tráfico externo nunca llega directamente al contenedor. Nginx actúa como proxy inverso:

```
Internet → nginx :443 (SSL wildcard *.evidagroup.es) → 172.27.0.2:8000
```

Configuración nginx: `/etc/nginx/sites-available/samiradtx.conf`
Certificado SSL: `/etc/nginx/ssl/fullchain_evidagroup.pem` (wildcard `*.evidagroup.es`, válido hasta Oct 2026)

---

## ⚠️ Configuración importante en `config/settings.py`

### `CSRF_TRUSTED_ORIGINS` (obligatorio con HTTPS + proxy)

```python
CSRF_TRUSTED_ORIGINS = ['https://test.evidagroup.es']
```

**¿Por qué es necesaria?**
A partir de Django 4.0, cuando la aplicación está detrás de un proxy HTTPS (como nginx), Django verifica
que el origen de cada petición POST coincida exactamente con una lista de dominios de confianza.
Sin esta línea, **todos los formularios POST (login, registro, etc.) devuelven HTTP 403 Forbidden** con el
mensaje "CSRF verification failed. Origin checking failed".

`ALLOWED_HOSTS = ['*']` no es suficiente — son dos validaciones independientes en Django.

> Si en el futuro se cambia el dominio o se añade uno nuevo, añadir también aquí:
> ```python
> CSRF_TRUSTED_ORIGINS = ['https://test.evidagroup.es', 'https://nuevo-dominio.es']
> ```

### `ALLOWED_HOSTS`

```python
ALLOWED_HOSTS = ['*']
```

En producción se recomienda restringir a los dominios reales:
```python
ALLOWED_HOSTS = ['test.evidagroup.es', 'localhost', '127.0.0.1', '172.27.0.2']
```

---

## 📍 Archivos de infraestructura en el servidor

| Archivo | Descripción |
|---|---|
| `/home/admin/webSamiraDTx/docker-prod-compose.yml` | Docker Compose de producción |
| `/etc/nginx/sites-available/samiradtx.conf` | Configuración nginx con SSL |
| `/etc/systemd/system/samiradtx.service` | Servicio systemd con auto-arranque |
| `/home/admin/docker-services.sh` | Script centralizado de gestión |
| `/home/admin/logs/nginx/samiradtx.access.log` | Logs de acceso nginx |
| `/home/admin/logs/nginx/samiradtx.error.log` | Logs de error nginx |
