const { DataTypes } = require("sequelize");
const db = require("../database/conexion");
const Emisor = db.define("emisores", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_zona: {
    type: DataTypes.INTEGER,
  },
  nombre: {
    type: DataTypes.STRING,
  },
  equipo: {
    type: DataTypes.STRING,
  },
  ip: {
    type: DataTypes.STRING,
  },
  estado: {
    type: DataTypes.INTEGER,
  },
  user: {
    type: DataTypes.STRING,
  },
  password: {
    type: DataTypes.STRING,
  },
  access: {
    type: DataTypes.STRING,
  },
  alert: {
    type: DataTypes.STRING,
  },
  lglt: {
    type: DataTypes.STRING,
  },
  snmp: {
    type: DataTypes.STRING,
  },
  snmp_comunidad: {
    type: DataTypes.STRING,
  },
  snmp_version: {
    type: DataTypes.INTEGER,
  },
  port_web: {
    type: DataTypes.STRING,
  },
  fabricante: {
    type: DataTypes.INTEGER,
  },

  state_snmp: {
    type: DataTypes.INTEGER,
  },
  oid: {
    type: DataTypes.STRING,
  },
  debug: {
    type: DataTypes.INTEGER,
  },
  retraso: {
    type: DataTypes.INTEGER,
  },
  counterping: {
    type: DataTypes.INTEGER,
  },
  ipv4s: {
    type: DataTypes.JSON,
  },
  ap: {
    type: DataTypes.BOOLEAN,
  },
});
module.exports = Emisor;
