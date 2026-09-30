const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 1234;
const PUBLIC_DIR = path.join(__dirname, 'public');
const LOG_FILE = path.join(__dirname, 'requests.log');
const USERS = { alice: 'secret', bob: 'azerty' };

function handler(req, res) {
  // q3, q4, q7 : URL, IP:port du client et méthode
  const { remoteAddress, remotePort } = req.socket;
  const line = `${remoteAddress}:${remotePort} ${req.method} ${req.url}`;
  console.log(line);

  // q8 : trace de chaque requête dans un fichier
  res.on('finish', () => {
    fs.appendFile(LOG_FILE, `${new Date().toISOString()} ${line} -> ${res.statusCode}\n`, () => {});
  });

  // q9 : POST /login avec du JSON {"login": "...", "password": "..."}
  if (req.url === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      try {
        const { login, password } = JSON.parse(body);
        if (USERS[login] === password) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: `Bienvenue ${login}` }));
        } else {
          res.writeHead(401);
          res.end(JSON.stringify({ success: false, error: 'Identifiants incorrects' }));
        }
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'JSON invalide' }));
      }
    });
    return;
  }

  // q1 : la racine renvoie toujours le même HTML
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h1>Hello world !</h1>');
  }

  // q5 et q6 : on renvoie le fichier de public/ s'il existe, sinon 404
  // (path.basename empêche de sortir du dossier avec "../")
  const file = path.join(PUBLIC_DIR, path.basename(req.url));
  fs.readFile(file, (err, data) => {
    if (err) {
      const status = err.code === 'EACCES' ? 403 : 404; // 403 = pas les droits de lecture
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(status === 403 ? '403 Forbidden' : '404 Not Found');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

module.exports = handler;

if (require.main === module) {
  http.createServer(handler).listen(PORT, () => {
    console.log(`Serveur HTTP sur http://localhost:${PORT}`);
  });
}
