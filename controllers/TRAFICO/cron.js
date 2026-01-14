const { spawn } = require('child_process');
const cron = require('node-cron');
const path = require('path');

const scriptPython = {
  name: 'trafico',
  path: path.join(__dirname, '/scrips/trafico.py'),
};

// Cola de ejecuci  n
let cola = Promise.resolve();

function encolarYEjecutar(script) {
  cola = cola.then(() => ejecutarScript(script)).catch(err => {
    console.error(`[${script.name}] Error:`, err.message);
  });
}

function ejecutarScript(script) {
  return new Promise((resolve, reject) => {
    const comando = `source /var/cache/www/scrips/venv/bin/activate && nice -n 19 python3 ${script.path}`;

    const proceso = spawn('bash', ['-c', comando], {
      cwd: '/var/cache/nfdump',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proceso.stdout.on('data', (data) => {
      process.stdout.write(`[${script.name}] ${data}`);
    });

    proceso.stderr.on('data', (data) => {
      process.stderr.write(`[${script.name}][ERR] ${data}`);
    });

    proceso.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`C  digo de salida: ${code}`));
      }
      resolve();
    });
  });
}

// Ejemplo: cada 1 minutos
cron.schedule('*/1 * * * *', () => {
  console.log(` ^o  Encolando script frecuente`);
  encolarYEjecutar(scriptPython);
});

console.log(' ^=^z^` Cron iniciado');