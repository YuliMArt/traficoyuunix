const axios = require("axios");
const CryptoJS = require("crypto-js");
const ipLib = require("ip");

const Servers = require("../../models/servers");
const Ipv4s = require("../../models/ynx/Ipv4");
const Servicio = require("../../models/tblservicios");
const TraficoCus = require("../../models/tltrafico");
const { Sequelize } = require("sequelize");

const buildAuthHeader = (user, password) =>
  "Basic " + Buffer.from(`${user}:${password}`).toString("base64");

const filterByIp = async (id, queues) => {
  const ipvs = await Ipv4s.findAll({ where: { nodo: id } });
  const cidrs = ipvs.map((i) => `${i.red}/${i.cidr}`).filter(Boolean);

  return queues.filter((q) => {
    if (!q.target) return false; // 👈 si no hay target, lo brincamos
    const [ipTarget] = q.target.split("/");
    return cidrs.some((cidr) => ipLib.cidrSubnet(cidr).contains(ipTarget));
  });
};
/**
 * Calcula el delta de tráfico entre el valor actual del MK y el último guardado.
 * @param {number} actual - Valor actual del MK (bytes RX o TX)
 * @param {number|null} anterior - Último valor guardado (bytes RX o TX)
 * @returns {number} - Diferencia real (delta) para sumar al día
 */
const calcularDelta = (actual, anterior) => {
  if (anterior == null) return actual; // primera vez, tomar todo como delta
  const delta = actual - anterior;
  return delta >= 0 ? delta : actual; // si reinició el MK, el delta es el valor actual
};
const getQueesTrafic = async ({ ip, port, password, user, id }) => {
  try {
    const authHeader = buildAuthHeader(user, password);
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: `http://${ip}:${port}/rest/queue/simple`,
      headers: {
        Authorization: authHeader,
      },
    };

    const response = await axios.request(config);
    let queues = response.data;
    // // filtrar queues según IP dentro de rango
    queues = await filterByIp(id, queues);
    const servicios = await Servicio.findAll({
      attributes: ["id", "idnodo", "mac", "idcliente", "ip"],
      where: { idnodo: id },
    });
    const servicioMap = new Map(servicios.map((s) => [s.ip, s]));
    // 🚀 2. Preparar arrays para inserción masiva
    const registros = [];
    const updates = [];
    for (let q of queues) {
      const [upStr, downStr] = q.bytes.split("/");
      const upActual = parseInt(upStr); // subida acumulada en el MK
      const downActual = parseInt(downStr); // bajada acumulada en el MK
      const [ipTarget] = q.target.split("/");

      const serIp = servicioMap.get(ipTarget);
      if (!serIp) continue;

      const ultimoHoy = await TraficoCus.findOne({
        where: {
          idser: serIp.id,
          fecha: Sequelize.fn("CURDATE"),
        },
        order: [["id", "DESC"]],
      });

      if (ultimoHoy) {
        // Ya existe registro del día → usar delta sobre el último de hoy
        upDelta = calcularDelta(upActual, ultimoHoy.up);
        downDelta = calcularDelta(downActual, ultimoHoy.down);

        await TraficoCus.update(
          {
            up: ultimoHoy.up + upDelta,
            down: ultimoHoy.down + downDelta,
          },
          { where: { id: ultimoHoy.id } }
        );
      } else {
        // Primer registro del día → buscar último de AYER
        const ultimoAyer = await TraficoCus.findOne({
          where: {
            idser: serIp.id,
            fecha: Sequelize.literal("DATE_SUB(CURDATE(), INTERVAL 1 DAY)"),
          },
          order: [["id", "DESC"]],
        });

        let upBase = 0,
          downBase = 0;
        if (ultimoAyer) {
          upBase = ultimoAyer.up;
          downBase = ultimoAyer.down;
        }

        await TraficoCus.create({
          idser: serIp.id,
          idus: serIp.idcliente,
          idmk: serIp.idnodo,
          mac: serIp.mac,
          ip: ipTarget,
          up: calcularDelta(upActual, upBase),
          down: calcularDelta(downActual, downBase),
          fecha: Sequelize.fn("CURDATE"),
        });
      }
    }

    //   🚀 3. Ejecutar en bloque

    // Aquí puedes guardar en tu base de datos
    if (registros.length > 0) {
      await TraficoCus.bulkCreate(registros);
    }

    if (updates.length > 0) {
      for (const u of updates) {
        await TraficoCus.update(
          { up: u.up, down: u.down },
          { where: { id: u.id } }
        );
      }
    }
  } catch (err) {
    console.error(`Error al procesar MK ${ip}:`, err.message);
  }
};

const getTraficmks = async () => {
  const mikrotikIPs = await Servers.findAll();

  mikrotikIPs.forEach(async ({ id, ip, user, pass, portweb }) => {
    let password = CryptoJS.AES.decrypt(pass, "YUUNIX24").toString(
      CryptoJS.enc.Utf8
    );
    await getQueesTrafic({ ip, port: portweb, password, user, id });
  });
};
module.exports = {
  getTraficmks,
};
