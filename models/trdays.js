const { DataTypes } = require("sequelize");
const db = require("../database/conexion");

const TrD = db.define("traficdays", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  down: {
    type: DataTypes.BIGINT,
  },
  up: {
    type: DataTypes.BIGINT,
  },
  dia: {
    type: DataTypes.STRING,
  },
});
module.exports = TrD;
