#!/usr/bin/env bash
# Serve the built site from dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
vite preview --config scripts/vite.config.ts "$@"
