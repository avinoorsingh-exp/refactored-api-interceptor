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

# Load .env if present (provides K6_IMAGE, BASE_URL, k6 scenario params, etc.)
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

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
chmod 777 "$ARTIFACT_DIR"

# Resolve BASE_URL for Docker: translate localhost → host.docker.internal
# Priority: explicit BASE_URL env > K6_BASE_URL from .env > default
if [ -n "${BASE_URL:-}" ]; then
  DOCKER_BASE_URL="$(echo "$BASE_URL" | sed 's|://localhost|://host.docker.internal|; s|://127\.0\.0\.1|://host.docker.internal|')"
elif [ -n "${K6_BASE_URL:-}" ]; then
  DOCKER_BASE_URL="$(echo "$K6_BASE_URL" | sed 's|://localhost|://host.docker.internal|; s|://127\.0\.0\.1|://host.docker.internal|')"
else
  DOCKER_BASE_URL="http://host.docker.internal:3000"
fi

K6_IMAGE="${K6_IMAGE:-grafana/k6:0.54.0}"
K6_DASHBOARD_PORT="${K6_WEB_DASHBOARD_PORT:-5665}"

echo "k6 scenario:  $SCENARIO"
echo "BASE_URL:     $DOCKER_BASE_URL"
echo "Artifact dir: $ARTIFACT_DIR"
echo "Run ID:       $RUNID"
echo "k6 runner:    docker ($K6_IMAGE)"
echo ""

# Run k6 via Docker — capture exit code even on threshold failure (no set -e)
# Mount entire src/ so relative imports (../lib/, ../agents/, etc.) resolve correctly
# Use bridge network with published ports (--network host is unreliable on Docker Desktop)
docker run --rm \
  -p "${K6_DASHBOARD_PORT}:5665" \
  -v "$REPO_ROOT/apps/load-test/src:/app/src:ro" \
  -v "$ARTIFACT_DIR:/artifacts" \
  -e "BASE_URL=$DOCKER_BASE_URL" \
  -e "K6_WEB_DASHBOARD_HOST=${K6_WEB_DASHBOARD_HOST:-0.0.0.0}" \
  -e "K6_WEB_DASHBOARD_OPEN=${K6_WEB_DASHBOARD_OPEN:-false}" \
  -e "ENV=${PERF_ENV:-local}" \
  -e "AUTH_MODE=${AUTH_MODE:-none}" \
  -e "AUTH_TOKEN=${AUTH_TOKEN:-}" \
  -e "API_KEY=${API_KEY:-}" \
  -e "PAGE_SIZE_SET=${PAGE_SIZE_SET:-}" \
  -e "SEARCH_MODE=${SEARCH_MODE:-}" \
  -e "SEARCH_TERMS=${SEARCH_TERMS:-}" \
  -e "SEARCH_WEIGHTS=${SEARCH_WEIGHTS:-}" \
  -e "INCLUDES=${AGENTS_INCLUDES:-}" \
  -e "INCLUDES_WEIGHTS=${AGENTS_INCLUDES_WEIGHTS:-}" \
  -e "FIELDS_MODE=${AGENTS_FIELDS_MODE:-}" \
  -e "FIELDS_WEIGHTS=${AGENTS_FIELDS_WEIGHTS:-}" \
  -e "FIELDS_COUNT_SET=${AGENTS_FIELDS_COUNT_SET:-}" \
  -e "FILTERS=${FILTERS:-}" \
  -e "PERF_HOTSPOT_ENDPOINTS=${PERF_HOTSPOT_ENDPOINTS:-}" \
  --add-host=host.docker.internal:host-gateway \
  "$K6_IMAGE" run \
  --out web-dashboard \
  --summary-export="/artifacts/k6-summary.json" \
  "$@" \
  "/app/src/scenarios/${SCENARIO}.js" \
  2>&1 | tee "$ARTIFACT_DIR/k6.log" || true

K6_EXIT=${PIPESTATUS[0]}

# Generate reports (md + html) even if thresholds failed
if [ -f "$ARTIFACT_DIR/k6-summary.json" ]; then
  node "$REPO_ROOT/apps/load-test/scripts/generate-report.mjs" \
    "$ARTIFACT_DIR" "$SCENARIO" "$K6_BASE_URL" || true
fi

# Run regression comparison if PERF_COMPARE=true
PERF_ENV="${PERF_ENV:-local}"
if [ "${PERF_COMPARE:-}" = "true" ] && [ -f "$ARTIFACT_DIR/k6-summary.json" ]; then
  echo ""
  echo "Running regression comparison..."
  node "$REPO_ROOT/apps/load-test/scripts/compare-summaries.mjs" \
    --current "$ARTIFACT_DIR/k6-summary.json" \
    --outdir "$ARTIFACT_DIR" \
    --env "$PERF_ENV" \
    --scenario "$SCENARIO" || true
fi

echo ""
echo "Artifacts written to: $ARTIFACT_DIR"
ls -la "$ARTIFACT_DIR"

exit "$K6_EXIT"
