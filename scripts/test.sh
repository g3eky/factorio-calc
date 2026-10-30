#!/usr/bin/env bash
# Run the tests.
set -euo pipefail
cd "$(dirname "$0")/.."
vitest run --config scripts/vite.config.ts "$@"
