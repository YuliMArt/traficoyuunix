const { exec } = require("child_process");
const fs = require("fs");

const processes = [
  { dir: "SOTO", port: 2062, routerIP: "10.10.10.2" }, 
  { dir: "TL-WI", port: 2063, routerIP: "10.10.10.3" }, 
  { dir: "SENGUIO", port: 2064, routerIP: "10.10.10.4" }, 
  { dir: "TL-FO", port: 2065, routerIP: "10.10.10.5" }, 
  { dir: "LOMA-CH", port: 2066, routerIP: "10.10.10.6" }, 
  { dir: "MILPILLAS", port: 2067, routerIP: "10.10.10.7" }, 
 { dir: "TUPATARO", port: 2068, routerIP: "10.10.10.8" },

];
function runCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve(stdout || stderr);
    });
  });
}

async function startProcesses() {
  console.log("🧹 Paso 1: Limpiando procesos antiguos de nfcapd...");
  // Matamos procesos anteriores una sola vez al inicio del script
  await runCommand("pkill -9 nfcapd || true");

  console.log("⏳ Paso 2: Esperando 5 segundos para liberar puertos...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  for (const { dir, port, routerIP } of processes) {
    try {
      const pathDir = `/var/cache/nfdump/${dir}`;

      if (!fs.existsSync(pathDir)) {
        fs.mkdirSync(pathDir, { recursive: true });
        console.log(`📁 Carpeta creada: ${pathDir}`);
      }

      // IMPORTANTE: -D lanza el proceso al fondo, pero el script de Node seguirá vivo
      const cmd = `nfcapd -n ${dir},${routerIP},${pathDir} -p ${port} -t 300 -y -D`;
      
      await runCommand(cmd);
      console.log(`✅ Proceso iniciado: ${dir} (IP: ${routerIP}, Puerto: ${port})`);

    } catch (err) {
      console.error(`❌ Error al iniciar ${dir}: ${err.message}`);
    }
  }

  console.log("🚀 Capturadores listos. El script permanecerá activo para evitar reinicios de PM2.");
  
  // ESTO EVITA EL BUCLE INFINITO DE PM2:
  // Mantiene el script vivo sin hacer nada, revisando cada hora.
  setInterval(() => {
    // No hace nada, solo mantiene el proceso de Node ocupado
  }, 3600000); 
}

startProcesses();
