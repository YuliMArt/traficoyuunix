const express = require("express");
const cors = require("cors");
const http = require("http");
const db = require("../database/conexion");

const exp = express();
const server = http.createServer(exp);
const cron = require("node-cron");
const { getTraficmks } = require("../controllers/quees/trafic");
const { pingOlts } = require("../controllers/funtionsOtmimized");
const { MonitOnusOlt } = require("../controllers/snmp/onussnmp");
class Server {
  constructor() {
    this.app = exp;
    this.port = 9080;
    this.paths = {};
    this.server = server;
    // Conectar a base de datos
    this.conectarDB();
    // Middlewares
    this.middlewares();
    // Rutas de mi aplicación
    this.routes();
    this.cronsTab();
  }

  async conectarDB() {
    try {
      await db.authenticate();
      console.log("database online");
    } catch (error) {
      throw new Error(error);
    }
  }

  async cronsTab() {
    cron.schedule("*/15 * * * *", async () => {
      getTraficmks();
    });

    cron.schedule("*/2 * * * *", async () => {
      pingOlts();
    });
    cron.schedule("*/15 * * * *", async () => {
      MonitOnusOlt();
    });
    // cron.schedule("*/20 * * * *", async () => {
    //   pingClientes();
    // });
  }
  middlewares() {
    // CORS
    this.app.use(cors());
    // Lectura y parseo del body
    this.app.use(express.json());
    // Directorio Público
    this.app.use(express.static("public"));
  }

  routes() {}

  execute() {
    this.server.listen(this.port, () => {
      console.log("Servidor corriendo en puerto", this.port);
    });
  }
}

module.exports = { Server };
