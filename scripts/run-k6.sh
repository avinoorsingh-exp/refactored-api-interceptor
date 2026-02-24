#!/usr/bin/env bash
# scripts/run-k6.sh
# Runs a k6 scenario and writes artifacts to a deterministic directory.
#
# Usage:
#   BASE_URL=http://localhost:3000 ./scripts/run-k6.sh <scenario> [extra k6 flags...]
#
# Examples:
#   BASE_URL=http://localhost:3000 ./scripts/run-k6.sh smoke
#   BASE_URL=https://dev.example.com ./scripts/run-k6.sh baseline --vus 5
#   BASE_URL=http://localhost:3000 ./scripts/run-k6.sh stress
#
# Outputs:
#   artifacts/k6/<runid>/k6-summary.json
#   artifacts/k6/<runid>/k6-summary.md
#   artifacts/k6/<runid>/k6-report.html
#   artifacts/k6/<runid>/k6.log

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SCENARIO="${1:?Usage: run-k6.sh <scenario> [extra k6 flags...]}"
shift

SCENARIO_FILE="$REPO_ROOT/apps/load-test/src/scenarios/${SCENARIO}.js"
if [ ! -f "$SCENARIO_FILE" ]; then
  echo "Error: scenario file not found: $SCENARIO_FILE"
  echo "Available scenarios:"
  ls "$REPO_ROOT/apps/load-test/src/scenarios/"*.js 2>/dev/null | xargs -I{} basename {} .js
  exit 1
fi

# Generate run ID: git short SHA if available, else ISO timestamp
if git rev-parse --short HEAD >/dev/null 2>&1; then
  RUNID="$(date +%Y%m%dT%H%M%S)-$(git rev-parse --short HEAD)"
else
  RUNID="$(date +%Y%m%dT%H%M%S)"
fi

ARTIFACT_DIR="$REPO_ROOT/artifacts/k6/$RUNID"
mkdir -p "$ARTIFACT_DIR"

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "k6 scenario:  $SCENARIO"
echo "BASE_URL:     $BASE_URL"
echo "Artifact dir: $ARTIFACT_DIR"
echo "Run ID:       $RUNID"
echo ""

# Run k6 — capture exit code even on threshold failure (no set -e)
k6 run \
  --env "BASE_URL=$BASE_URL" \
  --summary-export="$ARTIFACT_DIR/k6-summary.json" \
  "$@" \
  "$SCENARIO_FILE" \
  2>&1 | tee "$ARTIFACT_DIR/k6.log"

K6_EXIT=${PIPESTATUS[0]}

# Generate reports (md + html) even if thresholds failed
if [ -f "$ARTIFACT_DIR/k6-summary.json" ]; then
  node "$REPO_ROOT/apps/load-test/scripts/generate-report.mjs" \
    "$ARTIFACT_DIR" "$SCENARIO" "$BASE_URL" || true
fi

echo ""
echo "Artifacts written to: $ARTIFACT_DIR"
ls -la "$ARTIFACT_DIR"

exit "$K6_EXIT"
