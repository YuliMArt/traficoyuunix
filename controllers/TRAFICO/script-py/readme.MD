1. Instalar la herramienta necesaria
Primero instala el soporte para entornos virtuales desde los repositorios oficiales:

Bash

sudo apt-get update
sudo apt-get install python3-venv

# Asegúrate de estar en /var/cache/www/scrips OCARPETA DEL PROYECTO
cd /var/cache/www/scrips

# Crear el nuevo entorno virtual
python3 -m venv venv
3. Activar e instalar librerías
Ahora ya debería dejarte activar el entorno sin problemas:

Bash

source venv/bin/activate
(Verás que tu terminal ahora muestra (venv) al principio).

Una vez activado, instala las herramientas que usa tu script de tráfico:

Bash

pip install mysql-connector-python ijson