#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Este script intercambia un Page Access Token corto por uno de larga duración"
echo "y lo guarda en .env.local. Nada de esto se imprime en pantalla salvo confirmación."
echo ""

read -rp "App ID: " APP_ID
read -rsp "App Secret (oculto): " APP_SECRET
echo ""
read -rsp "Page Access Token del Graph API Explorer (oculto): " PAGE_TOKEN
echo ""
read -rp "IG Business Account ID [17841417978918612]: " IG_ID
IG_ID="${IG_ID:-17841417978918612}"
IG_ID="${IG_ID//[[:space:]]/}"

APP_ID="${APP_ID//[[:space:]]/}"
APP_SECRET="${APP_SECRET//[[:space:]]/}"
PAGE_TOKEN="${PAGE_TOKEN//[[:space:]]/}"

echo ""
echo "Intercambiando token..."

HTTP_STATUS=$(curl -sS -o /tmp/ig-token-response.json -w "%{http_code}" \
  "https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${PAGE_TOKEN}")
RESPONSE=$(cat /tmp/ig-token-response.json)
rm -f /tmp/ig-token-response.json

echo "HTTP status: ${HTTP_STATUS}"

set +e
LONG_TOKEN=$(echo "$RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data.get('access_token', ''))
")
set -e

if [ -z "$LONG_TOKEN" ]; then
  echo ""
  echo "No se pudo obtener el token. Respuesta completa de Meta (no contiene tu secret ni tu token):"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

touch .env.local
grep -v -E "^(IG_ACCESS_TOKEN|IG_BUSINESS_ACCOUNT_ID)=" .env.local > .env.local.tmp || true
mv .env.local.tmp .env.local
{
  echo "IG_ACCESS_TOKEN=${LONG_TOKEN}"
  echo "IG_BUSINESS_ACCOUNT_ID=${IG_ID}"
} >> .env.local

echo ""
echo "Guardado en .env.local:"
echo "  IG_ACCESS_TOKEN=...${LONG_TOKEN: -6} (${#LONG_TOKEN} chars)"
echo "  IG_BUSINESS_ACCOUNT_ID=${IG_ID}"
