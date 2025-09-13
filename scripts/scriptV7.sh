#!/bin/bash -l
output_dir="/var/www/monitoreoCx/csvAccounting"

# Crear el directorio de salida si no existe
mkdir -p "$output_dir"
# Verificar si se proporcionó la IP del MikroTik
if [ -z "$1" ]; then
    echo "Uso: $0 <IP_MIKROTIK>"
    exit 1
fi

# Configuración
MIKROTIK_IP="$1"  # IP del MikroTik pasada como argumento
URL="http://$MIKROTIK_IP/accounting/ip.cgi"  # URL de los datos
FECHAF=$(date +%Y-%m-%d_%H-%M-%S)
FECHA=$(date +%Y-%m-%d)  # Obtener la fecha actual 
CSV_FILE="$output_dir/v6_$FECHAF.csv"  # Nombre del archivo de salida

# Obtener datos de tráfico desde MikroTik
TRAFFIC_DATA=$(curl -s "$URL")

# Verificar si los datos fueron obtenidos correctamente
if [ -z "$TRAFFIC_DATA" ]; then
    echo "Error: No se pudo obtener datos del MikroTik."
    exit 1
fi

# Procesar y guardar en CSV
echo "$TRAFFIC_DATA" | awk -F' ' -v fecha="$FECHA" '
{
    src = $1    # IP origen
    dst = $2    # IP destino
    up = $3     # Bytes subidos desde origen
    down = $4   # Bytes recibidos en destino

    # Agrupar subida por IP origen
    ip_subida[src] += down
    # Agrupar bajada por IP destino
    ip_bajada[dst] += up
}
END {
    for (ip in ip_subida) {
        print ip "," ip_subida[ip] "," ip_bajada[ip] "," fecha >> "'$CSV_FILE'"
    }
    print "Archivo CSV generado: '$CSV_FILE'"
}'