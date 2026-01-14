#!/usr/bin/env python3
import subprocess
import ipaddress
import mysql.connector
import glob
import os
import sys
import hashlib
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
import ijson

# Forzar flush inmediato en stdout/stderr
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

DB_CONFIG = {
    "host": "192.168.10.254",
    "port": 3306,
    "user": "developer",
    "password": "Yuunix2025",
    "database": "yuunix"
}

BASE_DIR = "/var/cache/nfdump"

NUM_WORKERS = 20  # Ajusta segun RAM disponible
NUM_FILES = 10   # Numero de archivos a procesar

def obtener_redes():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute("SELECT red, cidr FROM ipv4s WHERE cidr BETWEEN 0 AND 32")
    redes = []
    for red, cidr in cursor.fetchall():
        try:
            net = ipaddress.IPv4Network(f"{red}/{cidr}", strict=False)
            redes.append((int(net.network_address), int(net.broadcast_address)))
        except Exception as e:
            print(f"?? Error red {red}/{cidr}: {e}", flush=True)
    cursor.close()
    conn.close()
    return redes

def ip_en_redes(ip, redes):
    try:
        ip_int = int(ipaddress.IPv4Address(ip))
        return any(start <= ip_int <= end for start, end in redes)
    except Exception:
        return False

def crear_flow_hash(flow):
    """Crea un hash único para identificar flujos duplicados"""
    key_fields = [
        str(flow.get("src4_addr", "")),
        str(flow.get("dst4_addr", "")),
        str(flow.get("src_port", 0)),
        str(flow.get("dst_port", 0)),
        str(flow.get("proto", 0)),
        str(flow.get("first", 0)),
        str(flow.get("last", 0)),
        str(flow.get("in_bytes", 0)),
        str(flow.get("in_pkts", 0))
    ]
    flow_string = "|".join(key_fields)
    return hashlib.md5(flow_string.encode()).hexdigest()

def procesar_archivo(file_path, redes):
    subida = defaultdict(int)
    bajada = defaultdict(int)
    seen_flows = set()
    flows_procesados = 0
    flows_duplicados = 0
    
    try:
        process = subprocess.Popen(
            ["nfdump", "-r", file_path, "-o", "json", "-n", "all"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        for flow in ijson.items(process.stdout, "item"):
            flows_procesados += 1
            flow_hash = crear_flow_hash(flow)

            if flow_hash in seen_flows:
                flows_duplicados += 1
                continue

            seen_flows.add(flow_hash)
            src = flow.get("src4_addr")
            dst = flow.get("dst4_addr")
            bytes_ = flow.get("in_bytes", 0)

            if not src or not dst or bytes_ <= 0:
                continue

            en_src = ip_en_redes(src, redes)
            en_dst = ip_en_redes(dst, redes)

            if en_src and not en_dst:
                subida[src] += bytes_
            elif en_dst and not en_src:
                bajada[dst] += bytes_

        _, stderr = process.communicate()
        if stderr:
            print(f"?? nfdump error ({file_path}): {stderr.strip()}", flush=True)

        flows_unicos = flows_procesados - flows_duplicados
        if flows_procesados > 0:
            porcentaje_dup = (flows_duplicados / flows_procesados) * 100
            print(f"?? {os.path.basename(file_path)}: {flows_procesados} flows, {flows_duplicados} duplicados ({porcentaje_dup:.1f}%), {flows_unicos} únicos", flush=True)

    except Exception as e:
        print(f"?? Error procesando {file_path}: {e}", flush=True)

    return subida, bajada

def insertar_trafico_mysql(subida, bajada, fecha):
    if not subida and not bajada:
        return

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        values = []
        for ip in set(list(subida.keys()) + list(bajada.keys())):
            up = subida.get(ip, 0)
            down = bajada.get(ip, 0)
            values.append((ip, up, down, fecha))

        sql = """
        INSERT INTO trafico (ip, up, down, fecha) VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            up = up + VALUES(up),
            down = down + VALUES(down)
        """

        cursor.execute("START TRANSACTION")
        cursor.executemany(sql, values)

        sql_sync = """
            INSERT INTO traficoCus (ip, up, down, idus, idser, idmk, mac, fecha)
            SELECT
                t.ip,
                SUM(t.up) AS up,
                SUM(t.down) AS down,
                s.idcliente,
                s.id,
                s.idnodo as idmk,
                s.mac,
                t.fecha
            FROM trafico t
            JOIN tblservicios s ON t.ip = s.ip
            WHERE t.fecha = %s
            GROUP BY t.ip, t.fecha, s.idcliente, s.id, s.idnodo, s.mac
            ON DUPLICATE KEY UPDATE
                traficoCus.up = traficoCus.up + VALUES(up),
                traficoCus.down = traficoCus.down + VALUES(down),
                traficoCus.idus = VALUES(idus),
                traficoCus.idser = VALUES(idser),
                traficoCus.idmk = VALUES(idmk),
                traficoCus.mac = VALUES(mac)
        """
        cursor.execute(sql_sync, (fecha,))
        cursor.execute("DELETE FROM trafico WHERE fecha = %s", (fecha,))
        cursor.execute("COMMIT")
        print(f"?? Insertados {len(values)} registros para fecha {fecha}", flush=True)

    except mysql.connector.Error as e:
        print(f"? Error MySQL ({fecha}): {e}", flush=True)
        cursor.execute("ROLLBACK")

    cursor.close()
    conn.close()

def worker(file_path, redes):
    basename = os.path.basename(file_path)
    if basename.startswith("nfcapd.current") or not basename.startswith("nfcapd."):
        return f"? Ignorado archivo temporal: {basename}"

    parts = basename.split(".", 1)
    fecha_raw = parts[1]
    fecha_hora = fecha_raw.split("_")[0]

    if not fecha_hora.isdigit() or len(fecha_hora) < 8:
        return f"? Nombre de archivo invalido: {basename}"

    fecha = f"{fecha_hora[:4]}-{fecha_hora[4:6]}-{fecha_hora[6:8]}"
    subida, bajada = procesar_archivo(file_path, redes)
    insertar_trafico_mysql(subida, bajada, fecha)

    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return f"? Procesado y eliminado: {file_path}"
        except Exception as e:
            return f"?? Error al eliminar {file_path}: {e}"
    else:
        return f"?? Archivo ya no existe: {file_path}"

def main():
    redes = obtener_redes()
    print(f"?? Redes cargadas: {len(redes)}", flush=True)

    archivos = []
    for dir_path in glob.glob(f"{BASE_DIR}/*/"):
        for file_path in glob.glob(f"{dir_path}/nfcapd.*"):
            basename = os.path.basename(file_path)
            if basename.startswith("nfcapd.current"):
                continue
            archivos.append(file_path)

    archivos = sorted(archivos)[:NUM_FILES]
    total = len(archivos)
    if not total:
        print("?? No hay archivos para procesar.")
        return

    print(f"?? Procesando {total} archivos con {NUM_WORKERS} procesos en paralelo", flush=True)
    count = 0
    with ProcessPoolExecutor(max_workers=NUM_WORKERS) as executor:
        futures = [executor.submit(worker, f, redes) for f in archivos]
        for future in as_completed(futures):
            result = future.result()
            count += 1
            print(f"[{count}/{total}] {result}", flush=True)

if __name__ == "__main__":
    main()