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

if [ "${SKIP_SEED}" != "1" ]; then
  npx prisma db seed || npx ts-node --transpile-only prisma/seed.ts || true
fi

exec node dist/src/main.js
