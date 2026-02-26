#!/usr/bin/env bash
# scripts/export-coverage.sh
# Copies per-service coverage reports into a deterministic artifact directory.
# Usage: ./scripts/export-coverage.sh [artifact_root]
#   artifact_root defaults to ./artifacts/coverage

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACT_ROOT="${1:-$REPO_ROOT/artifacts/coverage}"

rm -rf "$ARTIFACT_ROOT"
mkdir -p "$ARTIFACT_ROOT"

copied=0

for svc_dir in "$REPO_ROOT"/services/*/; do
  svc_name="$(basename "$svc_dir")"
  cov_dir="$svc_dir/coverage"

  if [ -d "$cov_dir" ]; then
    dest="$ARTIFACT_ROOT/$svc_name"
    mkdir -p "$dest"
    cp -r "$cov_dir"/* "$dest"/
    echo "Exported coverage: $svc_name -> $dest"
    copied=$((copied + 1))
  fi
done

for pkg_dir in "$REPO_ROOT"/packages/*/; do
  pkg_name="$(basename "$pkg_dir")"
  cov_dir="$pkg_dir/coverage"

  if [ -d "$cov_dir" ]; then
    dest="$ARTIFACT_ROOT/$pkg_name"
    mkdir -p "$dest"
    cp -r "$cov_dir"/* "$dest"/
    echo "Exported coverage: $pkg_name -> $dest"
    copied=$((copied + 1))
  fi
done

if [ "$copied" -eq 0 ]; then
  echo "No coverage directories found. Run 'pnpm coverage' first."
  exit 1
fi

echo "Coverage exported to $ARTIFACT_ROOT ($copied workspace(s))"
