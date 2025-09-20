const snmp = require("snmp-native");
const ParmasOlts = () => {
  const session = new snmp.Session({
    host: "192.168.8.2", // Dirección IP del dispositivo SNMP
    community: "public", // Comunidad SNMP (asegúrate de ajustarlo según tu configuración)
    community: "private",
  });
  const oiduptime=".1.3.6.1.2.1.1.3.0";
  const temperatura=""
   session.getSubtree({ oid: oidUplink }, function (error, varbinds) {
    if (error) {
      console.log("Fail :(");
    } else {
      varbinds.forEach(function (vb) {
        console.log("Puerto Uplink = " + vb.value);
      });
    }
  });
};


