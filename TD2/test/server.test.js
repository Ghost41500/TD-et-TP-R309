const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createHandler } = require('../server');
const { createToken, verifyToken } = require('../rtwt');

const SECRET = 'cle-de-test';
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

let dir, server, url;

// On teste le gestionnaire en HTTP simple (le TLS n'est pas ce qu'on teste ici),
// avec un fichier d'utilisateurs temporaire dont on connaît les mots de passe.
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'td2-'));
  const usersFile = path.join(dir, 'users.sha256');
  fs.writeFileSync(usersFile, `alice:${sha('pwd-alice')}\nbob:${sha('pwd-bob')}\n`);
  server = http.createServer(createHandler({ secret: SECRET, usersFile, quiet: true }));
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});
after(() => {
  server.close();
  server.closeAllConnections();
  fs.rmSync(dir, { recursive: true, force: true });
});

const login = (body, raw) =>
  fetch(url + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ?? JSON.stringify(body) });
const verify = (token, method = 'GET') =>
  fetch(url + '/verify', { method, headers: token === undefined ? {} : { Authorization: `Bearer ${token}` } });

test('/login avec de bons identifiants renvoie un token RTWT valide', async () => {
  const res = await login({ user: 'alice', password: 'pwd-alice' });
  assert.equal(res.status, 200);
  const { token } = await res.json();
  assert.equal(verifyToken(token, SECRET).user, 'alice');
});

test('/login avec un mauvais mot de passe renvoie 401', async () => {
  const res = await login({ user: 'alice', password: 'faux' });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).token, undefined);
});

test('/login avec un utilisateur inconnu ou __proto__ renvoie 401', async () => {
  for (const user of ['inconnu', '__proto__', 'constructor']) {
    assert.equal((await login({ user, password: 'x' })).status, 401, user);
  }
});

test('/login avec des champs manquants ou du mauvais type renvoie 401', async () => {
  assert.equal((await login({})).status, 401);
  assert.equal((await login({ user: 'alice' })).status, 401);
  assert.equal((await login({ user: ['alice'], password: 42 })).status, 401);
});

test('/login avec un JSON invalide renvoie 400', async () => {
  assert.equal((await login(null, '{oops')).status, 400);
});

test('/login en GET renvoie 405', async () => {
  assert.equal((await fetch(url + '/login')).status, 405);
});

test('/login renvoie 501 si le fichier des utilisateurs est inaccessible', async () => {
  const srv = http.createServer(createHandler({ secret: SECRET, usersFile: path.join(dir, 'absent.sha256'), quiet: true }));
  await new Promise((resolve) => srv.listen(0, resolve));
  try {
    const res = await fetch(`http://localhost:${srv.address().port}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'alice', password: 'pwd-alice' }),
    });
    assert.equal(res.status, 501);
  } finally {
    srv.close();
    srv.closeAllConnections();
  }
});

test('/login fonctionne avec le vrai fichier users.sha256 du TD (alice / alice)', async () => {
  const srv = http.createServer(createHandler({ secret: SECRET, quiet: true }));
  await new Promise((resolve) => srv.listen(0, resolve));
  try {
    const res = await fetch(`http://localhost:${srv.address().port}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'alice', password: 'alice' }),
    });
    assert.equal(res.status, 200);
  } finally {
    srv.close();
    srv.closeAllConnections();
  }
});

test('/verify accepte un token valide en GET et en POST', async () => {
  const token = createToken({ user: 'bob' }, SECRET);
  for (const method of ['GET', 'POST']) {
    const res = await verify(token, method);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { valid: true, user: 'bob' });
  }
});

test('/verify sans en-tête Authorization renvoie valid:false', async () => {
  const res = await verify(undefined);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).valid, false);
});

test('/verify refuse un token signé avec une autre clé', async () => {
  const res = await verify(createToken({ user: 'bob' }, 'autre-cle'));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { valid: false, error: 'Signature invalide' });
});

test('/verify refuse un token expiré', async () => {
  const res = await verify(createToken({ user: 'bob' }, SECRET, -10));
  assert.deepEqual(await res.json(), { valid: false, error: 'Token expiré' });
});

test('/verify refuse un token mal formé', async () => {
  const res = await verify('nimportequoi');
  assert.equal(res.status, 401);
  assert.equal((await res.json()).valid, false);
});

test('flux complet : login puis verify', async () => {
  const { token } = await (await login({ user: 'bob', password: 'pwd-bob' })).json();
  const res = await verify(token);
  assert.deepEqual(await res.json(), { valid: true, user: 'bob' });
});

test('URL inconnue : 404 en JSON', async () => {
  assert.equal((await fetch(url + '/nope')).status, 404);
});
