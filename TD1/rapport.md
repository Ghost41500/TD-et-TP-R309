# Rapport TD1 – R309 – Micro-service HTTP avec Node.js

Fichiers : `server.js` (q1-q9), `server_https.js` + `certs/gen-certs.sh` (q10), `server_express.js` (q11), `test/server.test.js` (q12), `public/` (fichiers de test).
Lancement : `npm install`, puis `npm start` / `npm run start:https` / `npm run start:express` / `npm test`.

Méthode : je code une question à la fois, je la teste avec `curl` dans un second terminal, puis je fais un commit.

## q1-q2 : serveur Hello world

```js
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>Hello world !</h1>');
}).listen(1234);
```
```
$ curl http://localhost:1234/
<h1>Hello world !</h1>
```

## q3, q4, q7 : URL, IP:port du client, méthode

`req.url`, `req.method` et `req.socket.remoteAddress` / `remotePort` :
```js
console.log(`${req.socket.remoteAddress}:${req.socket.remotePort} ${req.method} ${req.url}`);
```
```
$ curl http://localhost:1234/ok.html ; curl -X DELETE http://localhost:1234/
127.0.0.1:36612 GET /ok.html
127.0.0.1:36640 DELETE /
```
Le port client change à chaque requête (nouvelle connexion TCP).

## q5-q6 : 404 et envoi de fichiers

Le fichier demandé est lu dans `public/` avec `fs.readFile`. Erreur `EACCES` (pas le droit de lire) : 403, autre erreur : 404. `path.basename(req.url)` empêche de sortir du dossier avec `../`.
```
$ for u in / /ok.html /bad.html /nope; do curl -s -o /dev/null -w "$u %{http_code}\n" http://localhost:1234$u; done
/ 200
/ok.html 200
/bad.html 403      (après chmod 000 public/bad.html, serveur lancé par un utilisateur non root)
/nope 404
```

## q8 : fichier de traces

À la fin de chaque réponse (événement `finish`), une ligne est ajoutée à `requests.log` :
```
2026-09-30T06:50:40.648Z 127.0.0.1:52914 GET / -> 200
2026-09-30T06:50:40.665Z 127.0.0.1:52928 GET /bad.html -> 403
```

## q9 : POST /login en JSON

Le corps arrive par morceaux (`data`), on le parse à `end`. Réponses : 200 (ok), 401 (mauvais identifiants), 400 (JSON invalide).
```
$ curl --json '{"login":"alice","password":"secret"}' http://localhost:1234/login
{"success":true,"message":"Bienvenue alice"}
$ curl --json '{"login":"alice","password":"faux"}' http://localhost:1234/login
{"success":false,"error":"Identifiants incorrects"}
```
(Utilisateurs en dur dans le code : uniquement pour le TD.)

## q10 : HTTPS

TLS chiffre les échanges et prouve l'identité du serveur grâce à un certificat signé par une CA que le client connaît. `certs/gen-certs.sh` crée avec OpenSSL : une CA (`ca.key`, `ca.crt`), une clé serveur et une demande de signature (`server.key`, `server.csr`), puis le certificat `server.crt` signé par la CA (avec `subjectAltName=DNS:localhost`, sans lequel curl refuse le certificat).

`server_https.js` réutilise le même gestionnaire que `server.js` :
```js
https.createServer({ key, cert }, handler).listen(1234);
```
```
$ curl https://localhost:1234/
curl: (60) SSL certificate problem: unable to get local issuer certificate
$ curl --cacert certs/ca.crt https://localhost:1234/
<h1>Hello world !</h1>
```

## q11 : version express

`server_express.js` refait la même chose avec express : `express.json()` lit le JSON automatiquement (`req.body`), `res.json()` / `res.status()` simplifient les réponses, et `express-session` gère les sessions avec un cookie `connect.sid`. Au login réussi, `req.session.user` mémorise l'utilisateur ; `/profile` n'est accessible qu'avec ce cookie.
```
$ curl http://localhost:1234/profile
{"success":false,"error":"Non authentifié"}
$ curl -c cj.txt --json '{"login":"alice","password":"secret"}' http://localhost:1234/login
{"success":true,"message":"Bienvenue alice"}
$ curl -b cj.txt http://localhost:1234/profile
{"success":true,"user":"alice"}
```
`-c` enregistre les cookies dans un fichier, `-b` les renvoie.

## q12 : tests unitaires

Avec le module natif `node:test` et `node:assert` : chaque test démarre le serveur sur un port libre (`listen(0)`), envoie de vraies requêtes avec `fetch`, vérifie le code et le contenu de la réponse. Les mêmes tests sont lancés sur la version http et la version express, plus un test de session pour express.
```
$ npm test
# tests 15
# pass 15
# fail 0
```
