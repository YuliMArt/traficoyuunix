const moment = require("moment");
const db = require("../database/conexion");
const TrD = require("../models/trdays");
const { QueryTypes } = require("sequelize");
const Servicio = require("../models/tblservicios");
const Emisor = require("../models/emisores");
const  ping = require('ping');

const Olt = require("../models/ynx/olts");
const sumTraficDay = async () => {
  const dia = moment().format("YYYY-MM-DD");

  // const traficTem = await dbTr.query(
  //   `SELECT SUM(down) as total_down, SUM(up) as total_up FROM comtrafics WHERE fecha = '${dia}'`,
  //   {
  //     type: QueryTypes.SELECT,
  //   }
  // );
  const traficTem = await db.query(
    `SELECT SUM(down) as total_down, SUM(up) as total_up FROM traficoCus WHERE fecha = '${dia}'`,
    {
      type: QueryTypes.SELECT,
    }
  );
  if (traficTem.length) {
    const trdown = traficTem[0].total_down;
    const trup = traficTem[0].total_up;
    if (trdown != null && trup != null) {
      const [data, created] = await TrD.findOrCreate({
        where: { dia },
        defaults: { dia, down: trdown, up: trup },
      });
      if (!created) {
        await dbTr.query(
          `UPDATE tradays  SET down=${trdown}, up=${trup} WHERE dia='${dia}'`,
          {
            type: QueryTypes.UPDATE,
          }
        );
      }
    }
  }
};
const pingClientes = async () => {
  let clientes = await db.query(
    ` SELECT ts.*, us.estado  FROM tblservicios ts JOIN usuarios us ON ts.idcliente=us.id  WHERE  us.estado='ACTIVO' `,
    { type: QueryTypes.SELECT }
  );
  for (let i = 0; i < clientes.length; i++) {
    const rts = clientes[i];
    let res = await ping.promise.probe(rts.ip);
    let alive = "ONLINE";
    if (!res.alive) alive = "OFFLINE";
    if (alive != rts.status) {
      await Servicio.update(
        { status: alive },
        {
          where: { id: rts.id },
        }
      );
    }
  }
};
const pingOlts = async () => {
  const olts = await Olt.findAll();
  for (let i = 0; i < olts.length; i++) {
    const rts = olts[i];
    let res = await ping.promise.probe(rts.ip);
    let alive = "ONLINE";
    if (!res.alive) alive = "OFFLINE";
    if (alive != rts.status) {
      await Olt.update(
        { status: alive },
        {
          where: { id: rts.id },
        }
      );
    }
  }
};

module.exports = {
  sumTraficDay,
  pingClientes,
  pingOlts,
};
