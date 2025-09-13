const { DataTypes } = require("sequelize");
const db = require("../database/conexion");
const Servers = db.define("servers", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nodo: {
    type: DataTypes.STRING,
  },
  ip: {
    type: DataTypes.STRING,
  },
  user: {
    type: DataTypes.STRING,
  },
  pass: {
    type: DataTypes.STRING,
  },
  coordenadas: {
    type: DataTypes.STRING,
  },
  version: {
    type: DataTypes.STRING,
  },
  estado: {
    type: DataTypes.STRING,
  },
  portweb: {
    type: DataTypes.INTEGER,
  },

  modelo: {
    type: DataTypes.STRING,
  },
  seguridad: {
    type: DataTypes.INTEGER,
  },
  seguridadalt: {
    type: DataTypes.INTEGER,
  },
  velocidad: {
    type: DataTypes.STRING,
  },

  apissl: {
    type: DataTypes.INTEGER,
  },
  port_api: {
    type: DataTypes.INTEGER,
  },
  api: {
    type: DataTypes.BOOLEAN,
  },
  flow: {
    type: DataTypes.BOOLEAN,
  },
  counter: {
    type: DataTypes.INTEGER,
  },

  secret: {
    type: DataTypes.STRING,
  },
  nas: {
    type: DataTypes.STRING,
  },
});
module.exports = Servers;
