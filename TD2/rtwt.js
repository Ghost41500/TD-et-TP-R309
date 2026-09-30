// Module RTWT (R&T Web Token) : version simplifiée de JWT.
// Format : base64url(payload JSON) + "." + base64url(HMAC-SHA256(payload encodé))
const crypto = require('node:crypto');

const toBase64Url = (buf) => Buffer.from(buf).toString('base64url');

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

// Crée un token avec les données `data`, valable `expiresIn` secondes (1 h par défaut).
// `now` (en secondes) permet de fixer la date de création, utile pour les tests.
function createToken(data, secret, expiresIn = 3600, now = Math.floor(Date.now() / 1000)) {
  const payload = { ...data, iat: now, exp: now + expiresIn };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

// Décode le payload SANS vérifier la signature (utile pour afficher le contenu)
function decodeToken(token) {
  const [payloadB64] = String(token).split('.');
  return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
}

// Vérifie le format, la signature puis la date d'expiration.
// Renvoie le payload si le token est valide, sinon lève une Error avec la raison.
function verifyToken(token, secret, now = Math.floor(Date.now() / 1000)) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('Format de token invalide');

  const [payloadB64, signature] = parts;
  const expected = Buffer.from(sign(payloadB64, secret));
  const received = Buffer.from(signature);
  // timingSafeEqual : comparaison en temps constant (et exige des tailles identiques)
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new Error('Signature invalide');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Payload illisible');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new Error('Token expiré');
  return payload;
}

module.exports = { createToken, verifyToken, decodeToken };
