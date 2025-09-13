const { DataTypes } = require("sequelize");
const db = require("../database/conexion");

const TraficoCus = db.define("traficoCus", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  ip: {
    type: DataTypes.STRING,
  },
  up: {
    type: DataTypes.BIGINT,
  },
  down: {
    type: DataTypes.BIGINT,
  },
  idus: {
    type: DataTypes.INTEGER,
  },
  idser: {
    type: DataTypes.INTEGER,
  },
  idmk: {
    type: DataTypes.INTEGER,
  },
  mac: {
    type: DataTypes.STRING,
  },
  fecha: {
    type: DataTypes.STRING,
  },
});
module.exports = TraficoCus;
