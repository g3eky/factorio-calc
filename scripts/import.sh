#!/usr/bin/env bash
# Import game data from wube/factorio-data and names and icons from the wiki (needs luajit).
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/import/import.ts "$@"
