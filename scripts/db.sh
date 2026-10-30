#!/usr/bin/env bash
# Build only the SQLite databases into dist/db/.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/build-db.ts "$@"
