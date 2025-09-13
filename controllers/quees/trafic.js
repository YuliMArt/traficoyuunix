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
      const [upStr, downStr] = q.bytes.split("/"); // invertir
      const up = parseInt(upStr); // subida
      const down = parseInt(downStr); // bajada
      const [ipTarget] = q.target.split("/");
      const serIp = servicioMap.get(ipTarget);
      if (!serIp) continue;
      const existe = await TraficoCus.findOne({
        attributes: ["id"],
        where: {
          idser: serIp.id,
          idus: serIp.idcliente,
          idmk: serIp.idnodo,
          ip: ipTarget,
          fecha: Sequelize.fn("CURDATE"),
        },
      });

      if (existe) {
        updates.push({ id: existe.id, up, down });
      } else {
        registros.push({
          idser: serIp.id,
          idus: serIp.idcliente,
          idmk: serIp.idnodo,
          mac: serIp.mac,
          ip: ipTarget,

          up,
          down,
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
