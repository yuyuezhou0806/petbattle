#!/usr/bin/env bash
set -euo pipefail

DATA_ENV=/etc/pet-battle-data.env
APP_ENV=/etc/pet-battle-outline.env
COMPOSE_FILE=/var/www/pet-battle-api/pet-battle-data.compose.yml

install -d -m 0755 /var/lib/pet-battle
install -d -m 0755 /var/lib/pet-battle/postgres /var/lib/pet-battle/redis
install -d -o ubuntu -g www-data -m 0750 /var/lib/pet-battle/uploads

if [[ ! -s "$DATA_ENV" ]]; then
  postgres_password="$(openssl rand -hex 24)"
  redis_password="$(openssl rand -hex 24)"
  temp_data="$(mktemp)"
  printf 'POSTGRES_PASSWORD=%s\nREDIS_PASSWORD=%s\n' "$postgres_password" "$redis_password" > "$temp_data"
  install -o root -g root -m 0600 "$temp_data" "$DATA_ENV"
  rm -f "$temp_data"
fi

set -a
source "$DATA_ENV"
set +a

if [[ -f "$APP_ENV" ]] && grep -q '^JWT_SECRET=' "$APP_ENV"; then
  jwt_secret="$(sed -n 's/^JWT_SECRET=//p' "$APP_ENV" | head -n 1)"
else
  jwt_secret="$(openssl rand -hex 48)"
fi
temp_app="$(mktemp)"
if [[ -f "$APP_ENV" ]]; then
  grep '^OPENAI_' "$APP_ENV" > "$temp_app" || true
fi
printf 'DATABASE_URL=postgresql://petbattle:%s@127.0.0.1:5432/petbattle\n' "$POSTGRES_PASSWORD" >> "$temp_app"
printf 'REDIS_URL=redis://:%s@127.0.0.1:6379/0\n' "$REDIS_PASSWORD" >> "$temp_app"
printf 'JWT_SECRET=%s\nUPLOAD_DIR=/var/lib/pet-battle/uploads\n' "$jwt_secret" >> "$temp_app"
install -o root -g root -m 0600 "$temp_app" "$APP_ENV"
rm -f "$temp_app"

docker compose --env-file "$DATA_ENV" -f "$COMPOSE_FILE" up -d
