const { DataTypes } = require("sequelize");
const db = require("../database/conexion");

const Servicio = db.define("tblservicios", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  idcliente: {
    type: DataTypes.INTEGER,
  },
  idnodo: {
    type: DataTypes.INTEGER,
  },
  idIpv4: {
    type: DataTypes.INTEGER,
  },
  id_tec: {
    type: DataTypes.INTEGER,
  },
  tipo: {
    type: DataTypes.STRING,
  },
  firewall: {
    type: DataTypes.BOOLEAN,
  },

  redIpv4: {
    type: DataTypes.STRING,
  },

  ip: {
    type: DataTypes.STRING,
  },
  mac: {
    type: DataTypes.STRING,
  },

  instalado: {
    type: DataTypes.STRING,
  },

  status: {
    type: DataTypes.STRING,
  },

  promo: {
    type: DataTypes.BOOLEAN,
  },
  finpromo: {
    type: DataTypes.DATE,
  },

  pppuser: {
    type: DataTypes.STRING,
  },
  pppsecret: {
    type: DataTypes.STRING,
  },
});
module.exports = Servicio;
