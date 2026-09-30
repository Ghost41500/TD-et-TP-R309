const express = require('express');
const session = require('express-session');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 1234;
const PUBLIC_DIR = path.join(__dirname, 'public');
const LOG_FILE = path.join(__dirname, 'requests.log');
const USERS = { alice: 'secret', bob: 'azerty' };

const app = express();

// q3, q4, q7, q8 : affichage et fichier de traces
app.use((req, res, next) => {
  const { remoteAddress, remotePort } = req.socket;
  const line = `${remoteAddress}:${remotePort} ${req.method} ${req.url}`;
  console.log(line);
  res.on('finish', () => {
    fs.appendFile(LOG_FILE, `${new Date().toISOString()} ${line} -> ${res.statusCode}\n`, () => {});
  });
  next();
});

// Sessions : un cookie "connect.sid" identifie l'utilisateur
app.use(session({ secret: 'secret-td1', resave: false, saveUninitialized: false }));

// Lecture automatique du JSON reçu (remplit req.body)
app.use(express.json());

app.get('/', (req, res) => res.send('<h1>Hello world !</h1>'));

// q9 : login, l'utilisateur est mémorisé dans la session
app.post('/login', (req, res) => {
  const { login, password } = req.body;
  if (USERS[login] === password) {
    req.session.user = login;
    res.json({ success: true, message: `Bienvenue ${login}` });
  } else {
    res.status(401).json({ success: false, error: 'Identifiants incorrects' });
  }
});

// Page qui nécessite d'être connecté (cookie de session)
app.get('/profile', (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, error: 'Non authentifié' });
  res.json({ success: true, user: req.session.user });
});

// q5 et q6 : fichier de public/ s'il existe, sinon 404 (403 si pas les droits)
app.use((req, res) => {
  const file = path.join(PUBLIC_DIR, path.basename(req.path));
  fs.readFile(file, (err, data) => {
    if (err) return res.status(err.code === 'EACCES' ? 403 : 404).send(err.code === 'EACCES' ? '403 Forbidden' : '404 Not Found');
    res.type('html').send(data);
  });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Serveur express sur http://localhost:${PORT}`));
}
