#!/usr/bin/env bash
# Install dependencies from the lockfile.
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci "$@"
