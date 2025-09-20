const { DataTypes } = require("sequelize");
const db = require("../../database/conexion");
const Olt = db.define("olts", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING,
  },
  ip: {
    type: DataTypes.STRING,
  },
  modelo: {
    type: DataTypes.STRING,
  },
  version: {
    type: DataTypes.STRING,
  },
  tipo_pon: {
    type: DataTypes.STRING,
  },
  port_ssh: {
    type: DataTypes.INTEGER,
  },
  port_telnet: {
    type: DataTypes.INTEGER,
  },
  port_snmp: {
    type: DataTypes.INTEGER,
  },
  com_read: {
    type: DataTypes.STRING,
  },
  com_rw: {
    type: DataTypes.STRING,
  },
  usuario: {
    type: DataTypes.STRING,
  },
  pass: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.STRING,
  },
  tem: {
    type: DataTypes.STRING,
  },
  id_mk: {
    type: DataTypes.INTEGER,
  },
  device : {
       type: DataTypes.STRING,
  },
  oid : {
       type: DataTypes.STRING,
  },
  hostid : {
       type: DataTypes.INTEGER,
  },
});
module.exports = Olt;
