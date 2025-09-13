const { DataTypes } = require("sequelize");
const db = require("../../database/conexion");
const Ipv4s = db.define("ipv4s", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nodo: {
    type: DataTypes.INTEGER,
  },

  olt: {
    type: DataTypes.INTEGER,
  },
  nombre: {
    type: DataTypes.STRING,
  },
  red: {
    type: DataTypes.STRING,
  },
  cidr: {
    type: DataTypes.STRING,
  },
  tipo: {
    type: DataTypes.INTEGER,
  },
  rangos: {
    type: DataTypes.STRING,
  },
  host: {
    type: DataTypes.INTEGER,
  },
  redes: {
    type: DataTypes.STRING,
  },
});
module.exports = Ipv4s;
