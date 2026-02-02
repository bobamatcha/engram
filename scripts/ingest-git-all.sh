#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 /path/to/repo1 [/path/to/repo2 ...]" >&2
  exit 1
fi

DAYS="${DAYS:-30}"

if [ -f "./dist/cli.js" ]; then
  ENGRAM_CMD=(node ./dist/cli.js)
else
  ENGRAM_CMD=(npx -y @4meta5/engram)
fi

for root in "$@"; do
  if [ -d "$root/.git" ]; then
    echo "Ingesting git log: $root"
    "${ENGRAM_CMD[@]}" ingest-git --workspace "$root" --days "$DAYS"
  else
    echo "Skipping (not a git repo): $root" >&2
  fi
done
