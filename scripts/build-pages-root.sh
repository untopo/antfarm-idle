#!/usr/bin/env bash
# Build the GitHub Pages artifact with ANT FARM at the public root.
# Source stays organised under ant-farm-rpg/; deployment layout is intentionally flatter.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/_sitio}"
case "$OUT" in
  /|"$ROOT"|"$ROOT/ant-farm-rpg") echo "refusing unsafe output path: $OUT" >&2; exit 2 ;;
esac

rm -rf "$OUT"
mkdir -p "$OUT"
cp -a "$ROOT/ant-farm-rpg/." "$OUT/"
[ -f "$ROOT/.nojekyll" ] && cp "$ROOT/.nojekyll" "$OUT/.nojekyll" || true
rm -rf "$OUT/assets/_archivo"

# Compatibility for links shared before the root deployment. It redirects; it does not duplicate the game.
mkdir -p "$OUT/ant-farm-rpg"
cat > "$OUT/ant-farm-rpg/index.html" <<'HTML'
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=../"><link rel="canonical" href="../">
<title>ANT FARM</title></head><body><a href="../">Open ANT FARM</a>
<script>location.replace('../'+location.search+location.hash)</script></body></html>
HTML

test -f "$OUT/index.html"
test -f "$OUT/js/app.js"
test -f "$OUT/css/style.css"
grep -q 'id="mainMenu"' "$OUT/index.html"

echo "Pages root ready: $(find "$OUT" -type f | wc -l) files · $(du -sh "$OUT" | cut -f1)"
