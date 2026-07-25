#!/bin/sh
set -eu
NAO_URL="${NAO_URL:-http://localhost:5005}"
cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  NAO_URL: "${NAO_URL}"
};
EOF
echo "runtime config NAO_URL=${NAO_URL}"
