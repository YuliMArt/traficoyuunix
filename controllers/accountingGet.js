const Servicio = require("../models/tblservicios");
const fs = require("fs");
const path = require("path");
const inputDir = "./csvAccounting"; // Carpeta donde están los archivos
const { exec } = require("child_process");
const TraficoCus = require("../models/tltrafico");
const db = require("../database/conexion");
const { QueryTypes, Op } = require("sequelize");
const Servers = require("../models/servers");

const getCsvAccounting = async () => {
  const mikrotikIPs = await Servers.findAll({
    where: { [Op.and]: [{ estado: "CONECTADO" }, { flow: 0 }] },
  });

  mikrotikIPs.forEach(({ ip }) => {
    const port = 80;
    const ipp = `${ip}:${port}`;
    const comando = `sh /var/www/monitoreoCx/scripts/scriptV7.sh  ${ipp}`;

    console.log(`🚀 Ejecutando comando: ${comando}`); // Ver qué se está ejecutando

    exec(comando, (error, stdout, stderr) => {
      console.log(`📄 STDERR: ${stderr}`);
      console.log(`✅ STDOUT: ${stdout}`);

      if (error) {
        console.error(`❌ Error ejecutando script: ${error.message}`);
        console.error(`💻 Código de salida: ${error.code}`);
        console.error(`🔧 Señal recibida: ${error.signal}`);
        return;
      }
    });
  });
};
const readFilesCsvAccounting = async () => {
  try {
    // Obtener las redes desde la base de datos
    const ipsData = await db.query(
      `SELECT ips.red FROM servers s  JOIN ipv4s ips ON s.id = ips.nodo WHERE flow = 0`,
      { type: QueryTypes.SELECT }
    );

    const redes = ipsData.map((row) => row.red.trim());

    // Leer archivos CSV
    const files = fs
      .readdirSync(inputDir)
      .filter((file) => file.endsWith(".csv"));

    for (const file of files) {
      const filePath = path.join(inputDir, file);
      console.log(`📂 Procesando archivo: ${filePath}`);

      const data = fs
        .readFileSync(filePath, "utf-8")
        .split("\n")
        .filter(Boolean);

      for (const line of data) {
        const [ip, up, down, fecha] = line.split(",");

        if (parseInt(up) > 0 || parseInt(down) > 0) {
          // ✅ Verificar si la IP pertenece a alguna red antes de consultar la BD
          const perteneceARed = redes.some((red) =>
            ip.startsWith(red.split(".").slice(0, 3).join("."))
          );

          if (!perteneceARed) {
            continue; // Saltar esta IP
          }

          // 🔍 Buscar en la base de datos solo si la IP es válida
          // const serIp = await Servicioset.findOne({
          //   attributes: ["id", "mknodo", "mac", "idcliente"],
          //   where: { ip },
          // });
          const serIp = await Servicio.findOne({
            attributes: ["id", "idnodo", "mac", "idcliente"],
            where: { ip },
          });

          if (serIp) {
            const [trafico, created] = await TraficoCus.findOrCreate({
              where: {
                ip,
                idus: serIp.idcliente,
                idser: serIp.id,
                idmk: serIp.idnodo,
                mac: serIp.mac,
                fecha,
              },
              defaults: {
                up: up || 0,
                down: down || 0,
              },
            });
            if (!created) {
              console.log("ACTUALIZA");
              await trafico.update({
                up: parseInt(trafico.up) + parseInt(up),
                down: parseInt(trafico.down) + parseInt(down),
              });
            }
          }
        }
      }

      // ✅ Eliminar archivo tras procesarlo
      fs.unlinkSync(filePath);
      console.log(`✅ Archivo procesado y eliminado: ${file}`);
    }

    console.log("🚀 Todos los archivos han sido procesados y eliminados.");
  } catch (error) {
    console.error("❌ Error procesando archivos CSV:", error);
  }
};
module.exports = {
  readFilesCsvAccounting,
  getCsvAccounting,
};
