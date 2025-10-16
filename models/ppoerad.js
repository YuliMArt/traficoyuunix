const { DataTypes } = require("sequelize");
const db = require("../database/conexion");
const RadAcc = db.define("radacct", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
  },
  framedipaddress: {
    type: DataTypes.STRING,
  },
  acctinputoctets: {
    type: DataTypes.INTEGER,
  },
  acctoutputoctets: {
    type: DataTypes.STRING,
  },
  callingstationid: {
    type: DataTypes.STRING,
  },
  connectinfo_start: {
    type: DataTypes.STRING,
  },
});
module.exports = RadAcc;
