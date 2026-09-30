# Rapport TD2 – R309 – Micro-service d'authentification (tokens RTWT)

Fichiers : `rtwt.js` (module de tokens, q3), `q1_q2_exemple.js` (q1-q2), `server.js` (micro-service HTTPS, q4), `certs/gen-certs.sh` (certificat), `users.sha256` (utilisateurs fournis), `test/` (tests unitaires).
Lancement : `sh certs/gen-certs.sh` (dans Git Bash, une seule fois), `npm start`, `npm test`, `npm run exemple`. Aucune dépendance npm : tout utilise les modules natifs de Node (`crypto`, `https`, `fs`).

Méthode : je code une question à la fois, je la vérifie (script ou `curl`), puis je fais un commit.

## Comment fonctionne un token RTWT

Un token est `payload.signature`, les deux parties étant encodées en Base64Url :
- `payload` = le JSON des données (`user`, ...) plus `iat` (date de création) et `exp` (date d'expiration), en secondes depuis 1970 ;
- `signature` = `HMAC-SHA256(payload encodé, clé secrète)`, encodée en Base64Url.

Celui qui ne connaît pas la clé ne peut pas fabriquer une signature valide : si on modifie le payload (par exemple `bob` en `admin`), la signature ne correspond plus.

## q1 : décoder et vérifier le token de l'annexe

`Buffer.from(payload, 'base64url')` décode le payload, et `crypto.createHmac('sha256', 'SuperSecretKey').update(payloadEncodé).digest('base64url')` recalcule la signature :

```
$ node q1_q2_exemple.js
Payload : { user: 'bob', email: 'bob@gmail.com', iat: 1790237301, exp: 1790240901 }
Signature calculée : gdHoAOJXynTwUFourk__vuUXIvArt5bLgiX_0QZU8lk
Signature du token : gdHoAOJXynTwUFourk__vuUXIvArt5bLgiX_0QZU8lk
Signature valide ? true
```
La signature calculée est identique à celle de l'annexe : le token est authentique.

## q2 : afficher les dates en texte

`iat` et `exp` sont en secondes, alors que `new Date()` attend des millisecondes : il faut multiplier par 1000. `toLocaleString('fr-FR', { timeZone: 'Europe/Paris', ... })` donne la date en français :

```js
new Date(payload.iat * 1000).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Europe/Paris' })
```
```
Créé le  (iat) : jeudi 24 septembre 2026 à 10:08:21
Expire le (exp) : jeudi 24 septembre 2026 à 11:08:21
```
On retrouve bien la date de l'énoncé (24 septembre 2026, 10:08:21) et 1 heure de validité.

## q3 : module `rtwt.js`

Trois fonctions :
- `createToken(data, secret, expiresIn = 3600, now)` : ajoute `iat` et `exp` aux données, encode, signe ;
- `verifyToken(token, secret, now)` : vérifie le format, la signature, puis l'expiration ; renvoie le payload ou lève une erreur (`Format de token invalide`, `Signature invalide`, `Token expiré`) ;
- `decodeToken(token)` : lit le payload sans vérifier (pour l'affichage).

Deux choix de sécurité :
- la signature est comparée avec `crypto.timingSafeEqual`, en temps constant, pour ne pas donner d'indice par le temps de réponse ;
- la signature est vérifiée **avant** d'utiliser le contenu du payload.

Le paramètre `now` (facultatif) permet de fixer la date dans les tests.

**Tests unitaires** (`test/rtwt.test.js`, module `node:test`) :
- `createToken` avec `{user:'bob', email:'bob@gmail.com'}`, la clé `SuperSecretKey`, `now = 1790237301` reproduit **exactement** le token de l'annexe ;
- token valide accepté, mauvaise clé refusée, payload modifié refusé, signature modifiée refusée ;
- token expiré refusé (à la seconde près) ;
- formats invalides refusés (`''`, `'abc'`, `'a.b.c'`, `undefined`, `null`, un nombre...).

## q4 : micro-service HTTPS sur le port 4567

**Certificat** : `certs/gen-certs.sh` crée une CA et un certificat serveur pour `localhost` (même méthode qu'au TD1). Sous Windows il se lance dans Git Bash, avec `export MSYS_NO_PATHCONV=1` en début de script, sinon Git Bash déforme l'option `-subj` d'OpenSSL.

**`POST /login`** : lit le JSON `{"user": "...", "password": "..."}`, calcule le SHA-256 du mot de passe et le compare à celui du fichier `users.sha256` (format `user:sha256(pwd)`). Réponses :
- 200 `{"token": "..."}` si les identifiants sont bons ;
- 401 si l'utilisateur ou le mot de passe est incorrect ;
- 501 si le fichier des utilisateurs est inaccessible ;
- 400 si le JSON est invalide, 405 si la méthode n'est pas POST.

**`GET` ou `POST /verify`** : lit l'en-tête `Authorization: Bearer <token>` et répond `{"valid":true,"user":"xx"}` ou `{"valid":false,"error":"yy"}` (avec le code 401 quand le token est refusé).

Détails : `Object.hasOwn` empêche que `__proto__` ou `constructor` soient vus comme des utilisateurs ; la comparaison des hash se fait aussi avec `timingSafeEqual` ; la clé secrète vient de la variable d'environnement `RTWT_SECRET` (`SuperSecretKey` par défaut, uniquement pour le TD) ; les tokens sont valables 1 heure.

## q5 : tests avec curl

Les identifiants du fichier fourni sont `alice/alice`, `bob/bob` et `clark/clark` (leurs SHA-256 correspondent). Pour éviter les problèmes de guillemets, le JSON est mis dans un fichier :

```
$ echo '{"user":"alice","password":"alice"}' > ok.json
$ echo '{"user":"alice","password":"faux"}' > bad.json
```

**Connexion, bon mot de passe** :
```
$ curl --cacert certs/ca.crt --json @ok.json https://localhost:4567/login
{"token":"eyJ1c2VyIjoiYWxpY2UiLCJpYXQiOjE3OTA3NjA4OTksImV4cCI6MTc5MDc2NDQ5OX0.ABmHWu6uRscF7CggAoUI__6I0kKdCm-UXGdkTdNMe1Y"}
```

**Mauvais mot de passe** :
```
$ curl --cacert certs/ca.crt --json @bad.json -w ' [%{http_code}]\n' https://localhost:4567/login
{"error":"Identifiants incorrects"} [401]
```

**Vérification du token** (en GET puis en POST) :
```
$ curl --cacert certs/ca.crt -H "Authorization: Bearer $TOKEN" https://localhost:4567/verify
{"valid":true,"user":"alice"}
$ curl --cacert certs/ca.crt -X POST -H "Authorization: Bearer $TOKEN" https://localhost:4567/verify
{"valid":true,"user":"alice"}
```

**Cas d'erreur** :
```
$ curl --cacert certs/ca.crt https://localhost:4567/verify              # sans token
{"valid":false,"error":"Token manquant"}
$ curl ... -H "Authorization: Bearer ${TOKEN}x" https://localhost:4567/verify   # signature modifiée
{"valid":false,"error":"Signature invalide"}
$ curl ... -H "Authorization: Bearer <token de l'annexe>" https://localhost:4567/verify   # expiré
{"valid":false,"error":"Token expiré"}
```
Le token de l'annexe a une bonne signature mais il a expiré le 24/09/2026 à 11:08.

**Fichier des utilisateurs inaccessible** (fichier absent ou sans droit de lecture) :
```
$ USERS_FILE=/nexiste/pas node server.js       # autre terminal
$ curl --cacert certs/ca.crt --json @ok.json -w ' [%{http_code}]\n' https://localhost:4567/login
{"error":"Fichier des utilisateurs inaccessible"} [501]
```

**Sans `--cacert`**, curl refuse la connexion (code 60) car il ne connaît pas notre CA : c'est le comportement attendu de TLS.

## Tests unitaires du micro-service

`test/server.test.js` démarre le gestionnaire sur un port libre (`listen(0)`, en HTTP simple car ce n'est pas le TLS qui est testé) avec un fichier d'utilisateurs temporaire dont on connaît les mots de passe, puis envoie de vraies requêtes avec `fetch`. Cas testés : connexion réussie (le token est bien vérifiable avec la clé), mauvais mot de passe, utilisateur inconnu ou `__proto__`, champs manquants ou de mauvais type, JSON invalide, méthode GET sur `/login`, fichier absent (501), vrai fichier `users.sha256` (`alice/alice`), `/verify` en GET et POST, sans en-tête, signature d'une autre clé, token expiré, token mal formé, et le parcours complet login puis verify.

```
$ npm test
# tests 24
# pass 24
# fail 0
```

## Difficultés rencontrées

- `iat` et `exp` sont en secondes : sans multiplier par 1000, `new Date()` affiche une date de janvier 1970.
- La signature porte sur le payload **déjà encodé** en Base64Url, pas sur le JSON brut : c'est ce qui permet de retrouver la signature de l'annexe.
- Sous Windows, Git Bash convertit `/C=FR/...` en chemin de fichier : il faut `MSYS_NO_PATHCONV=1`.
