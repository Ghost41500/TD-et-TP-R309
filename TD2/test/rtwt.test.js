const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createToken, verifyToken, decodeToken } = require('../rtwt');

const SECRET = 'SuperSecretKey';
// Token de l'annexe du TD (bob, créé le 24/09/2026 à 10:08:21, valable 1 heure)
const EXEMPLE =
  'eyJ1c2VyIjoiYm9iIiwiZW1haWwiOiJib2JAZ21haWwuY29tIiwiaWF0IjoxNzkwMjM3MzAxLCJleHAiOjE3OTAyNDA5MDF9' +
  '.gdHoAOJXynTwUFourk__vuUXIvArt5bLgiX_0QZU8lk';
const IAT = 1790237301;

test('createToken reproduit exactement le token de l\'annexe', () => {
  const token = createToken({ user: 'bob', email: 'bob@gmail.com' }, SECRET, 3600, IAT);
  assert.equal(token, EXEMPLE);
});

test('decodeToken lit le payload du token de l\'annexe', () => {
  assert.deepEqual(decodeToken(EXEMPLE), { user: 'bob', email: 'bob@gmail.com', iat: IAT, exp: IAT + 3600 });
});

test('verifyToken accepte un token valide et renvoie son payload', () => {
  const payload = verifyToken(EXEMPLE, SECRET, IAT + 60);
  assert.equal(payload.user, 'bob');
});

test('verifyToken refuse une mauvaise clé', () => {
  assert.throws(() => verifyToken(EXEMPLE, 'autre-cle', IAT + 60), /Signature invalide/);
});

test('verifyToken refuse un payload modifié', () => {
  const faux = Buffer.from(JSON.stringify({ user: 'admin', iat: IAT, exp: IAT + 3600 })).toString('base64url');
  const token = `${faux}.${EXEMPLE.split('.')[1]}`;
  assert.throws(() => verifyToken(token, SECRET, IAT + 60), /Signature invalide/);
});

test('verifyToken refuse une signature modifiée ou de mauvaise taille', () => {
  const [payload] = EXEMPLE.split('.');
  assert.throws(() => verifyToken(`${payload}.abc`, SECRET, IAT + 60), /Signature invalide/);
});

test('verifyToken refuse un token expiré', () => {
  assert.throws(() => verifyToken(EXEMPLE, SECRET, IAT + 3600), /expiré/);
  assert.throws(() => verifyToken(EXEMPLE, SECRET, IAT + 99999), /expiré/);
});

test('verifyToken refuse les formats invalides', () => {
  for (const mauvais of ['', 'abc', 'a.b.c', '.', 'a.', '.b', undefined, null, 42]) {
    assert.throws(() => verifyToken(mauvais, SECRET), /Format de token invalide/, String(mauvais));
  }
});

test('un token créé maintenant est valide puis expire', () => {
  const token = createToken({ user: 'alice' }, SECRET, 10, 1000);
  assert.equal(verifyToken(token, SECRET, 1005).user, 'alice');
  assert.throws(() => verifyToken(token, SECRET, 1010), /expiré/);
});
