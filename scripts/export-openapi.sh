#!/usr/bin/env bash
# scripts/export-openapi.sh
# Fetches the OpenAPI JSON spec from agent-service and writes it to artifacts/.
#
# Usage:
#   ./scripts/export-openapi.sh
#   BASE_URL=https://dev.example.com ./scripts/export-openapi.sh
#
# Outputs:
#   artifacts/openapi/agent-service.openapi.json

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

BASE_URL="${BASE_URL:-http://localhost:3000}"
ENDPOINT="${BASE_URL}/api-json"
OUT_DIR="$REPO_ROOT/artifacts/openapi"
OUT_FILE="$OUT_DIR/agent-service.openapi.json"

mkdir -p "$OUT_DIR"

echo "Fetching OpenAPI spec from: $ENDPOINT"

HTTP_CODE=$(curl -s -o "$OUT_FILE" -w "%{http_code}" --max-time 10 "$ENDPOINT" 2>/dev/null) || {
  echo ""
  echo "ERROR: Could not connect to $ENDPOINT"
  echo ""
  echo "Make sure agent-service is running:"
  echo "  docker compose up -d        # full stack"
  echo "  pnpm dev:agent              # or run natively"
  echo ""
  echo "Then retry:"
  echo "  pnpm openapi:export"
  rm -f "$OUT_FILE"
  exit 1
}

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: $ENDPOINT returned HTTP $HTTP_CODE (expected 200)"
  echo ""
  echo "Response body:"
  cat "$OUT_FILE" 2>/dev/null || true
  rm -f "$OUT_FILE"
  exit 1
fi

# Validate it's JSON
if ! python3 -m json.tool "$OUT_FILE" > /dev/null 2>&1 && ! node -e "JSON.parse(require('fs').readFileSync('$OUT_FILE','utf8'))" 2>/dev/null; then
  echo "ERROR: Response is not valid JSON"
  rm -f "$OUT_FILE"
  exit 1
fi

FILE_SIZE=$(wc -c < "$OUT_FILE" | tr -d ' ')
echo "Written: $OUT_FILE ($FILE_SIZE bytes)"
