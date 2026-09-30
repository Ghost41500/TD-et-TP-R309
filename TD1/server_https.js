const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const handler = require('./server');

const PORT = 1234;

// Clé privée et certificat du serveur, générés par certs/gen-certs.sh
const options = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'server.crt')),
};

https.createServer(options, handler).listen(PORT, () => {
  console.log(`Serveur HTTPS sur https://localhost:${PORT}`);
});
