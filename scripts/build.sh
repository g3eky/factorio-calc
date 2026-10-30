#!/usr/bin/env bash
# Type-check and build the static site into dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
tsc --noEmit -p src
tsc --noEmit -p scripts
tsc --noEmit -p src/test
vite build --config scripts/vite.config.ts "$@"
