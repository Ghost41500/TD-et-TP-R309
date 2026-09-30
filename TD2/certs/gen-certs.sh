#!/bin/sh
# Génère une CA puis un certificat serveur (pour localhost) signé par cette CA.
set -e
# Git Bash (Windows) transforme sinon "/C=FR/..." en chemin Windows
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"

# 1. La CA : clé privée + certificat auto-signé
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 365 \
  -subj "/C=FR/O=IUT Beziers/CN=R309 Test CA" -out ca.crt

# 2. Le serveur : clé privée + demande de signature (CSR)
openssl genrsa -out server.key 2048
openssl req -new -key server.key -subj "/C=FR/O=IUT Beziers/CN=localhost" -out server.csr

# 3. La CA signe le certificat (avec SAN, obligatoire pour les clients modernes)
printf "subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n" > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 365 -sha256 -extfile server.ext

openssl verify -CAfile ca.crt server.crt
