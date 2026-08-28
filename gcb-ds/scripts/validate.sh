#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-http://localhost:8081}"
CHECK=(
  /
  /ds
  /fio-start
  /projeto-fio
  /v-mendix-shell
  /a-sap-shell
  /CONTEXT.md
  /assets/icons/icone-brennand.svg
)

echo "Validando $BASE"
fail=0
for path in "${CHECK[@]}"; do
  if command -v curl >/dev/null 2>&1; then
    code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  else
    code=$(wget -q -O /dev/null -S "$BASE$path" 2>&1 | head -1 | awk '{print $2}')
  fi
  if [[ "$code" == "200" ]]; then
    echo "OK  $path"
  else
    echo "FAIL $path ($code)"
    fail=1
  fi
done

exit $fail
