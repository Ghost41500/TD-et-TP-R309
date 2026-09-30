const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const handler = require('../server');
const app = require('../server_express');

const json = (obj) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

// Les mêmes tests sont lancés sur la version http et sur la version express
for (const [name, handle] of [['http', handler], ['express', app]]) {
  test(`serveur ${name}`, async (t) => {
    // Port 0 : le système choisit un port libre
    const server = http.createServer(handle);
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => { server.close(); server.closeAllConnections(); });
    const url = `http://localhost:${server.address().port}`;

    await t.test('la racine renvoie Hello world', async () => {
      const res = await fetch(url + '/');
      assert.equal(res.status, 200);
      assert.equal(await res.text(), '<h1>Hello world !</h1>');
    });

    await t.test('404 pour une URL inconnue', async () => {
      assert.equal((await fetch(url + '/nexiste-pas')).status, 404);
    });

    await t.test('renvoie un fichier existant', async () => {
      const res = await fetch(url + '/ok.html');
      assert.equal(res.status, 200);
      assert.match(await res.text(), /Page valide par défaut/);
    });

    await t.test('login correct', async () => {
      const res = await fetch(url + '/login', json({ login: 'alice', password: 'secret' }));
      assert.equal(res.status, 200);
      assert.equal((await res.json()).success, true);
    });

    await t.test('login avec un mauvais mot de passe', async () => {
      const res = await fetch(url + '/login', json({ login: 'alice', password: 'faux' }));
      assert.equal(res.status, 401);
    });

    await t.test('login avec un JSON invalide', async () => {
      const res = await fetch(url + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
      assert.equal(res.status, 400);
    });

    if (name === 'express') {
      await t.test('session : /profile accessible seulement après login', async () => {
        assert.equal((await fetch(url + '/profile')).status, 401);
        const login = await fetch(url + '/login', json({ login: 'bob', password: 'azerty' }));
        const cookie = login.headers.get('set-cookie').split(';')[0];
        const res = await fetch(url + '/profile', { headers: { Cookie: cookie } });
        assert.equal(res.status, 200);
        assert.equal((await res.json()).user, 'bob');
      });
    }
  });
}
