const { DataTypes } = require("sequelize");
const db = require("../../database/conexion");

const Onu = db.define("onus", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_olt: {
    type: DataTypes.INTEGER,
  },

  sigonu: {
    type: DataTypes.STRING,
  },
  sigolt: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.BOOLEAN,
  },
  mac: {
    type: DataTypes.STRING,
  },
  port: {
    type: DataTypes.INTEGER,
  },
  sub: {
    type: DataTypes.INTEGER,
  },
  name: {
    type: DataTypes.STRING,
  },
  lastreason: {
    type: DataTypes.STRING,
  },
  nserie: {
    type: DataTypes.STRING,
  },
  modelo : {
       type: DataTypes.STRING,
  },
  vlan: {
    type: DataTypes.INTEGER,
  },
}, {
  indexes: [
    {
      unique: true,
      fields: ["id_olt", "port", "sub"], // 🔑 índice compuesto
    },
  ],
});
// ?ALTER TABLE onus 
// ADD UNIQUE KEY unique_onu_per_olt_port_sub (id_olt, port, sub); CREAR INDICE COMPUESTO

module.exports=Onu