#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/site"
TMP="$ROOT/.mirror-tmp"
BASE="https://gcb-ds.netlify.app"

echo "Espelhando $BASE/ → $TARGET"

rm -rf "$TMP"
mkdir -p "$TMP"

wget --mirror \
  --convert-links \
  --adjust-extension \
  --page-requisites \
  --no-parent \
  --domains=gcb-ds.netlify.app \
  --reject-regex='fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com' \
  -P "$TMP" \
  "$BASE/"

rm -rf "$TARGET"
mv "$TMP/gcb-ds.netlify.app" "$TARGET"
rm -rf "$TMP"

# Páginas que o wget nem sempre rastreia (shells, markdown, OG)
EXTRA=(
  v-mendix-shell mendix-shell a-mendix-shell
  v-sap-shell sap-shell a-sap-shell
  CONTEXT.md
)
for page in "${EXTRA[@]}"; do
  out="$TARGET/$page"
  [[ "$page" != *.md ]] && out="$TARGET/${page}.html"
  curl -fsSL "$BASE/$page" -o "$out"
done

mkdir -p "$TARGET/assets/og"
for og in og-fio.png og-ds.png; do
  curl -fsSL "$BASE/assets/og/$og" -o "$TARGET/assets/og/$og"
done

echo "Espelho salvo em $TARGET ($(find "$TARGET" -type f | wc -l) arquivos)"
