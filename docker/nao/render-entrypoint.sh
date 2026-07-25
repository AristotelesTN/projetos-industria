#!/bin/bash
set -euo pipefail
# Render injeta PORT; o Nao escuta SERVER_PORT (default 5005).
export SERVER_PORT="${PORT:-${SERVER_PORT:-5005}}"
if [ -z "${BETTER_AUTH_URL:-}" ]; then
  export BETTER_AUTH_URL="http://0.0.0.0:${SERVER_PORT}"
fi
echo "render-entrypoint SERVER_PORT=${SERVER_PORT} BETTER_AUTH_URL=${BETTER_AUTH_URL}"
exec /entrypoint.sh
