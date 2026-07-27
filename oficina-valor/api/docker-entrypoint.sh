#!/bin/sh
set -e

echo "Waiting for database..."
i=0
until npx prisma migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Database not ready after retries"
    exit 1
  fi
  echo "Retry migrate in 2s ($i/30)..."
  sleep 2
done

# Sync columns/tables added in schema but not yet covered by older migrations (local/dev).
npx prisma db push --accept-data-loss --skip-generate || true

if [ "${SKIP_SEED}" != "1" ]; then
  npm run seed || true
fi

exec node dist/src/main.js
