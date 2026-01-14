La Solución: Limpiar y Forzar el Inicio
Para que el tráfico se guarde en archivos, necesitamos matar los procesos viejos y arrancar el capturador con un tiempo de rotación corto (5 minutos en lugar de 30).

1. Detén el script de Node.js (PM2 o manual):

Bash

pm2 stop capturador  # O como se llame tu proceso en PM2
2. Mata manualmente todos los procesos de nfcapd colgados:

Bash

sudo pkill -9 nfcapd



1. Forzar la liberación del puerto
A veces los procesos se quedan en estado "zombie" o "Wait". Ejecuta esto para ver quién tiene el puerto realmente:

Bash

sudo lsof -i :2064
Si aparece algo, mátalo con:

Bash

sudo fuser -k 2064/udp
(Y haz lo mismo para el 2066 si es necesario: sudo fuser -k 2066/udp).


# Instala tcpdump si no lo tienes: apt install tcpdump
#asi muestra el trafico que llega
sudo tcpdump -i any udp port 2064 -n -c 10