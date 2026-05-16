#!/usr/bin/env sh
set -euo pipefail

PORT="${AIP_HTTP_PORT:-8080}"

exec gunicorn \
  --bind "0.0.0.0:${PORT}" \
  --workers "${GUNICORN_WORKERS:-2}" \
  --threads "${GUNICORN_THREADS:-4}" \
  --timeout "${GUNICORN_TIMEOUT_SEC:-120}" \
  server:application
