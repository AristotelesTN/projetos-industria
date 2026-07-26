#!/bin/sh
set -e
npx prisma migrate deploy
if [ "${SKIP_SEED}" != "1" ]; then
  npx prisma db seed || npx ts-node --transpile-only prisma/seed.ts || true
fi
exec node dist/src/main.js
