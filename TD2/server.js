// Micro-service d'authentification HTTPS (port 4567) avec des tokens RTWT.
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createToken, verifyToken } = require('./rtwt');

const PORT = 4567;
const EXPIRES_IN = 3600; // validité des tokens : 1 heure

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// Lit le fichier "user:sha256(pwd)" -> { user: hash }. Appelle cb(err, users).
function loadUsers(usersFile, cb) {
  fs.readFile(usersFile, 'utf8', (err, text) => {
    if (err) return cb(err);
    const users = {};
    for (const line of text.split(/\r?\n/)) {
      const [user, hash] = line.trim().split(':');
      if (user && hash) users[user] = hash.toLowerCase();
    }
    cb(null, users);
  });
}

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// POST /login {"user": "...", "password": "..."} -> {"token": "..."}
function handleLogin(req, res, { secret, usersFile }) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1e6) req.destroy();
  });
  req.on('end', () => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { error: 'JSON invalide' });
    }
    loadUsers(usersFile, (err, users) => {
      if (err) return sendJson(res, 501, { error: 'Fichier des utilisateurs inaccessible' });
      const { user, password } = data ?? {};
      if (typeof user === 'string' && typeof password === 'string' &&
          Object.hasOwn(users, user) && safeEqual(users[user], sha256(password))) {
        return sendJson(res, 200, { token: createToken({ user }, secret, EXPIRES_IN) });
      }
      sendJson(res, 401, { error: 'Identifiants incorrects' });
    });
  });
}

// GET ou POST /verify avec l'en-tête "Authorization: Bearer <token>"
function handleVerify(req, res, { secret }) {
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
  if (!match) return sendJson(res, 401, { valid: false, error: 'Token manquant' });
  try {
    const payload = verifyToken(match[1], secret);
    sendJson(res, 200, { valid: true, user: payload.user });
  } catch (err) {
    sendJson(res, 401, { valid: false, error: err.message });
  }
}

function createHandler({
  secret = process.env.RTWT_SECRET || 'SuperSecretKey',
  usersFile = process.env.USERS_FILE || path.join(__dirname, 'users.sha256'),
  quiet = false,
} = {}) {
  const options = { secret, usersFile };
  return (req, res) => {
    if (!quiet) console.log(`${req.socket.remoteAddress}:${req.socket.remotePort} ${req.method} ${req.url}`);
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/login') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { error: 'Méthode non autorisée' });
      }
      return handleLogin(req, res, options);
    }
    if (pathname === '/verify') {
      if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return sendJson(res, 405, { error: 'Méthode non autorisée' });
      }
      return handleVerify(req, res, options);
    }
    sendJson(res, 404, { error: 'Not Found' });
  };
}

module.exports = { createHandler };

if (require.main === module) {
  // Clé privée et certificat générés par certs/gen-certs.sh
  const tls = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'server.key')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'server.crt')),
  };
  https.createServer(tls, createHandler()).listen(PORT, () => {
    console.log(`Serveur HTTPS d'authentification sur https://localhost:${PORT}`);
  });
}
