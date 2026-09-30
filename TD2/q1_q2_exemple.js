// q1 et q2 : décodage et vérification de signature du token d'exemple de l'annexe,
// puis affichage des dates en texte.
const crypto = require('node:crypto');
const { decodeToken } = require('./rtwt');

const SECRET = 'SuperSecretKey';
const TOKEN =
  'eyJ1c2VyIjoiYm9iIiwiZW1haWwiOiJib2JAZ21haWwuY29tIiwiaWF0IjoxNzkwMjM3MzAxLCJleHAiOjE3OTAyNDA5MDF9' +
  '.gdHoAOJXynTwUFourk__vuUXIvArt5bLgiX_0QZU8lk';

const [payloadB64, signature] = TOKEN.split('.');

// q1 : décodage du payload (Base64Url -> JSON)
const payload = decodeToken(TOKEN);
console.log('Payload :', payload);

// q1 : la signature est le HMAC-SHA256 du payload encodé, avec la clé secrète
const expected = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
console.log('Signature calculée :', expected);
console.log('Signature du token :', signature);
console.log('Signature valide ?', expected === signature);

// q2 : iat et exp sont en secondes depuis 1970 ; JavaScript attend des millisecondes
const enTexte = (secondes) =>
  new Date(secondes * 1000).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Europe/Paris' });
console.log('Créé le  (iat) :', enTexte(payload.iat));
console.log('Expire le (exp) :', enTexte(payload.exp));
