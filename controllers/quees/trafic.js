const axios = require("axios");
const CryptoJS = require("crypto-js");
const ipLib = require("ip");

const Servers = require("../../models/servers");
const Ipv4s = require("../../models/ynx/Ipv4");
const Servicio = require("../../models/tblservicios");
const TraficoCus = require("../../models/tltrafico");
const { Sequelize } = require("sequelize");
const moment = require("moment");

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
    const config = {
      method: "get",
      maxBodyLength: Infinity,
      url: `http://${ip}:${port}/rest/queue/simple`,
      headers: { Authorization: authHeader },
    };

    const response = await axios.request(config);
    let queues = await filterByIp(id, response.data);

    const servicios = await Servicio.findAll({
      attributes: ["id", "idnodo", "mac", "idcliente", "ip"],
      where: { idnodo: id },
    });
    const servicioMap = new Map(servicios.map((s) => [s.ip, s]));

    const today = moment().format("YYYY-MM-DD");
    const yesterday = moment(today).subtract(1, "day").format("YYYY-MM-DD");

    const registros = [];
    const updates = [];

    for (let q of queues) {
      const [upStr, downStr] = q.bytes.split("/");
      const upActual = parseInt(upStr);
      const downActual = parseInt(downStr);
      const [ipTarget] = q.target.split("/");

      const serIp = servicioMap.get(ipTarget);
      if (!serIp) continue;

      // último registro de hoy
      const ultimoHoy = await TraficoCus.findOne({
        where: {
          idser: serIp.id,
          idus: serIp.idcliente,
          idmk: serIp.idnodo,
          ip: ipTarget,
          fecha: today,
        },
        order: [["id", "DESC"]],
      });

      // último registro de ayer
      const ultimoAyer = await TraficoCus.findOne({
        where: {
          idser: serIp.id,
          idus: serIp.idcliente,
          idmk: serIp.idnodo,
          ip: ipTarget,
          fecha: yesterday,
        },
        order: [["id", "DESC"]],
      });

      let baseUp = 0;
      let baseDown = 0;

     if (ultimoAyer) {
        baseUp = ultimoAyer.up;
        baseDown = ultimoAyer.down;
      }

      // Calcular delta con reinicio contemplado
      const deltaUp = upActual >= baseUp ? upActual - baseUp : upActual;
      const deltaDown = downActual >= baseDown ? downActual - baseDown : downActual;

      console.log('SUBIDA ACTUAL',upActual,"diferencia - ",ultimoAyer.up,"=+++++++",upActual-ultimoAyer.up,"DELTEA",deltaUp);

      if (ultimoHoy) {
        // actualizar acumulando el delta
        updates.push({
          id: ultimoHoy.id,
          up:  deltaUp,
          down:  deltaDown,
        });
      } else {
        // primer registro del día → crear nuevo
        registros.push({
          idser: serIp.id,
          idus: serIp.idcliente,
          idmk: serIp.idnodo,
          mac: serIp.mac,
          ip: ipTarget,
          up: deltaUp,
          down: deltaDown,
          fecha: today,
        });
      }
    }

    // Guardar nuevos
    if (registros.length > 0) {
      await TraficoCus.bulkCreate(registros);
    }

    // Actualizar existentes
    for (const u of updates) {
      await TraficoCus.update(
        { up: u.up, down: u.down },
        { where: { id: u.id } }
      );
    }

    console.log(`MK ${ip}: insertados ${registros.length}, actualizados ${updates.length}`);
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
