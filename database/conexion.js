const { Sequelize } = require("sequelize");
// Conexión da la base de datos
require("dotenv").config();
const db = new Sequelize(
  `${process.env.DB}`,
  `${process.env.USERDB}`,
  `${process.env.PASSDB}`,
  {
    host: `${process.env.DBCON}`,
    dialect: "mysql",
  }
);

module.exports = db;
