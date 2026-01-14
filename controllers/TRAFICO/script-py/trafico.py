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

# Forzar salida inmediata en consola
sys.stdout.reconfigure(line_buffering=True)

DB_CONFIG = {
    "host": "192.168.10.254",
    "port": 3306,
    "user": "developer",
    "password": "Yuunix2025",
    "database": "yuunix"
}

BASE_DIR = "/var/cache/nfdump"
NUM_WORKERS = 10 
NUM_FILES = 20

def obtener_datos_maestros():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT red, cidr FROM ipv4s WHERE cidr BETWEEN 0 AND 32")
        redes = []
        for row in cursor.fetchall():
            net = ipaddress.IPv4Network(f"{row['red']}/{row['cidr']}", strict=False)
            redes.append((int(net.network_address), int(net.broadcast_address)))
        
        cursor.execute("SELECT ip, idcliente, id, idnodo, mac FROM tblservicios WHERE ip IS NOT NULL")
        clientes = {row['ip']: row for row in cursor.fetchall()}
        
        cursor.close()
        conn.close()
        return redes, clientes
    except Exception as e:
        print(f"❌ Error crítico DB: {e}")
        sys.exit(1)

def crear_flow_hash(flow):
    key = f"{flow.get('src4_addr')}{flow.get('dst4_addr')}{flow.get('first')}{flow.get('in_bytes')}"
    return hashlib.md5(key.encode()).hexdigest()

def procesar_archivo(file_path, redes):
    subida = defaultdict(int)
    bajada = defaultdict(int)
    seen_flows = set()
    
    try:
        process = subprocess.Popen(
            ["nfdump", "-r", file_path, "-o", "json"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )

        try:
            # ijson.items puede fallar si nfdump devuelve "No matched flows"
            for flow in ijson.items(process.stdout, "item"):
                f_hash = crear_flow_hash(flow)
                if f_hash in seen_flows: continue
                seen_flows.add(f_hash)

                src, dst = flow.get("src4_addr"), flow.get("dst4_addr")
                bytes_ = flow.get("in_bytes", 0)

                if not src or not dst: continue

                s_int = int(ipaddress.IPv4Address(src))
                d_int = int(ipaddress.IPv4Address(dst))
                
                en_src = any(start <= s_int <= end for start, end in redes)
                en_dst = any(start <= d_int <= end for start, end in redes)

                if en_src and not en_dst:
                    subida[src] += bytes_
                elif en_dst and not en_src:
                    bajada[dst] += bytes_
        except ijson.common.IncompleteJSONError:
            # Captura el error cuando el archivo está vacío o no es JSON válido
            pass

        process.wait()
    except Exception as e:
        print(f"⚠️ Error en nfdump para {file_path}: {e}")
    
    return subida, bajada

def insertar_trafico_directo(subida, bajada, fecha, mapa_clientes):
    if not subida and not bajada:
        return "ℹ️ Sin datos de clientes."

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    ips_archivo = set(list(subida.keys()) + list(bajada.keys()))
    values = []

    for ip in ips_archivo:
        if ip in mapa_clientes:
            c = mapa_clientes[ip]
            values.append((ip, subida.get(ip, 0), bajada.get(ip, 0), c['idcliente'], c['id'], c['idnodo'], c['mac'], fecha))

    if not values: return "ℹ️ IPs no registradas."

    sql = """
        INSERT INTO traficoCus (ip, up, down, idus, idser, idmk, mac, fecha)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            up = up + VALUES(up),
            down = down + VALUES(down)
    """

    try:
        cursor.execute("START TRANSACTION")
        for i in range(0, len(values), 500):
            cursor.executemany(sql, values[i:i+500])
        conn.commit()
        return f"✅ {len(values)} clientes actualizados."
    except Exception as e:
        conn.rollback()
        return f"❌ Error DB: {e}"
    finally:
        cursor.close()
        conn.close()

def worker(file_path, redes, mapa_clientes):
    # Extraemos carpeta y nombre de archivo para el log
    folder_name = os.path.basename(os.path.dirname(file_path))
    file_name = os.path.basename(file_path)

    if "current" in file_name:
        return f"🟡 Saltando archivo en uso: [{folder_name}/{file_name}]"

    try:
        f_raw = file_name.split(".")[1].split("_")[0]
        fecha = f"{f_raw[:4]}-{f_raw[4:6]}-{f_raw[6:8]}"
    except:
        return f"❌ Formato inválido: [{folder_name}/{file_name}]"

    # Procesar
    subida, bajada = procesar_archivo(file_path, redes)
    res_db = insertar_trafico_directo(subida, bajada, fecha, mapa_clientes)

    # Eliminar
    if os.path.exists(file_path):
        os.remove(file_path)
    
    return f"📂 [{folder_name}] 📄 {file_name} -> {res_db}"

def main():
    redes, mapa_clientes = obtener_datos_maestros()
    print(f"\n🚀 Iniciando procesamiento de tráfico...")
    
    archivos = []
    for f in glob.glob(f"{BASE_DIR}/*/nfcapd.*"):
        if "current" not in f: archivos.append(f)
    
    archivos = sorted(archivos)[:NUM_FILES]
    if not archivos:
        print("☕ Nada nuevo que procesar.")
        return

    print(f"📂 Encontrados {len(archivos)} archivos. Procesando...\n")

    with ProcessPoolExecutor(max_workers=NUM_WORKERS) as executor:
        futures = [executor.submit(worker, f, redes, mapa_clientes) for f in archivos]
        for future in as_completed(futures):
            try:
                print(f"  {future.result()}")
            except Exception as e:
                print(f"  ❌ Error en worker: {e}")

    print(f"\nTerminado. ✨\n")

if __name__ == "__main__":
    main()