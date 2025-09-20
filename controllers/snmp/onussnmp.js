const snmp = require("snmp-native");
const Onu = require("../../models/ynx/onus");
const Olt = require("../../models/ynx/olts");
const { Sequelize } = require("sequelize");

const MonitOnusOlt = async () => {
  const olts = await Olt.findAll();
  for (const olt of olts) {
    await getOnus(olt.id, olt.ip, olt.com_rw);
    await getVlanMac(olt.id, olt.ip, olt.com_rw);
  }
};
const getOnus = (olt, host, community) => {
  const oids = {
    name: ".1.3.6.1.4.1.37950.1.1.6.1.1.4.1.24", // nombre ONU
    status: ".1.3.6.1.4.1.37950.1.1.6.1.1.4.1.16", // estatus
    nserie: ".1.3.6.1.4.1.37950.1.1.6.1.1.4.1.5", // número de serie
    modelo: ".1.3.6.1.4.1.37950.1.1.6.1.1.2.1.6", // modelo ONU
    sigonu: ".1.3.6.1.4.1.37950.1.1.6.1.1.3.1.7", // señal ONU
    sigolt: ".1.3.6.1.4.1.37950.1.1.6.1.1.3.1.8", // señal OLT
    lastreason: ".1.3.6.1.4.1.37950.1.1.6.1.1.23.1.4", // última razón de caída
  };

  const session = new snmp.Session({
    host,
    community,
  });

  let onus = {};

  const fetchOid = (oid, field) => {
    return new Promise((resolve, reject) => {
      session.getSubtree({ oid }, (error, varbinds) => {
        if (error) return reject(error);

        varbinds.forEach((vb) => {
          // OID completo como string → lo cortamos
          let parts = vb.oid;
          let sub = parts.pop();
          let port = parts.pop();
          let key = `${port}-${sub}`;

          if (!onus[key]) {
            onus[key] = {
              id: null,
              id_olt: olt,
              id_cli: null,
              sub,
              port,
            };
          }

          let value = vb.value.toString();

          // Normalizamos el estatus a boolean 0/1
          if (field === "status") {
            // aquí defines tu lógica según lo que mande la OLT
            // si es 1 = online, 0 = offline:
            value = value === "1" ? 1 : 0;
          }

          onus[key][field] = value;
        });

        resolve();
      });
    });
  };

  const onusDb = Promise.all([
    fetchOid(oids.name, "name"),
    fetchOid(oids.status, "status"),
    fetchOid(oids.nserie, "nserie"),
    fetchOid(oids.modelo, "modelo"),
    fetchOid(oids.sigonu, "sigonu"),
    fetchOid(oids.sigolt, "sigolt"),
    fetchOid(oids.lastreason, "lastreason"),
  ]).then(async () => {
    let result = Object.values(onus);
    // console.log("RESULT >>>", result);
    await Onu.bulkCreate(result, {
      updateOnDuplicate: [
        "status",
        "sigonu",
        "sigolt",
        "name",
        "info",
        "nserie",
        "modelo",
        "lastreason",
      ],
    });
    await syncOnus(result, olt);
    return result;
  });

  return onusDb;
};

const syncOnus = async (onusSnmp, idOlt = 1) => {
  // 1️⃣ Traer todas las ONUs de la DB para esta OLT
  const onusDb = await Onu.findAll({
    where: { id_olt: idOlt },
    attributes: ["port", "sub"],
  });

  // 2️⃣ Crear sets para comparar
  const existingKeys = new Set(onusSnmp.map((o) => `${o.port}-${o.sub}`));
  const dbKeys = onusDb.map((o) => `${o.port}-${o.sub}`);

  // 3️⃣ Filtrar las ONUs que ya no existen
  const toDelete = dbKeys.filter((k) => !existingKeys.has(k));

  // 4️⃣ Eliminar solo las que no existen en SNMP
  if (toDelete.length > 0) {
    await Onu.destroy({
      where: {
        id_olt: idOlt,
        [Sequelize.Op.or]: toDelete.map((k) => {
          const [port, sub] = k.split("-").map(Number);
          return { port, sub };
        }),
      },
    });
  }

  console.log(
    `Se eliminaron ${toDelete.length} ONUs que ya no existen en la OLT.`
  );
};

const getVlanMac = (olt, host, community) => {
  const oids = {
    portsub: ".1.3.6.1.4.1.37950.1.1.5.10.3.5.1.5",
    mac: ".1.3.6.1.4.1.37950.1.1.5.10.3.5.1.3",
    vlan: ".1.3.6.1.4.1.37950.1.1.5.10.3.5.1.2",
  };

  const session = new snmp.Session({
    host,
    community,
  });

  let onus = {};

  // Primero obtenemos los portsub para crear las claves
  const fetchPortSub = () => {
    return new Promise((resolve, reject) => {
      session.getSubtree({ oid: oids.portsub }, (error, varbinds) => {
        if (error) return reject(error);

        varbinds.forEach((vb, index) => {
          const [port, sub] = vb.value.toString().split(":");
          const key = `${port}-${sub}`;
          onus[key] = {
            port: parseInt(port, 10),
            sub: parseInt(sub, 10),
            index,
          };
        });

        resolve();
      });
    });
  };

  // Luego obtenemos vlan y mac según el índice
  const fetchVlanMac = (oid, field) => {
    return new Promise((resolve, reject) => {
      session.getSubtree({ oid }, (error, varbinds) => {
        if (error) return reject(error);

        varbinds.forEach((vb, i) => {
          // Encontramos la clave que corresponde según la posición (índice)
          const onuKey = Object.keys(onus)[i];
          if (onuKey) {
            onus[onuKey][field] = vb.value.toString();
          }
        });

        resolve();
      });
    });
  };

  // Ejecutamos todo
  const onusDb = fetchPortSub()
    .then(() =>
      Promise.all([
        fetchVlanMac(oids.vlan, "vlan"),
        fetchVlanMac(oids.mac, "mac"),
      ])
    )
    .then(async () => {
      const result = Object.values(onus).map((onu) => ({
        id_olt: olt,
        port: onu.port,
        sub: onu.sub,
        mac: onu.mac,
        vlan: onu.vlan,
      }));

      for (const onu of result) {
        await Onu.update(
          { mac: onu.mac, vlan: onu.vlan }, // campos a actualizar
          {
            where: {
              id_olt: olt,
              port: onu.port,
              sub: onu.sub,
            },
          }
        );
      }

      return result;
    });

  return onusDb;
};

module.exports = {
  getOnus,
  getVlanMac,
  MonitOnusOlt,
};
