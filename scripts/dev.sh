#!/usr/bin/env bash
# Start the dev server; reloads on code and data changes.
set -euo pipefail
cd "$(dirname "$0")/.."
vite --config scripts/vite.config.ts "$@"
