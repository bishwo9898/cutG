#!/bin/sh

set -u

redis_url="${REDIS_URL:-redis://localhost:6380}"
rq_command="rq"
if [ -x .venv/bin/rq ]; then
  rq_command=".venv/bin/rq"
fi

while true; do
  "$rq_command" worker cutg-ai-hair --url "$redis_url" --worker-class rq.worker.SpawnWorker
  status=$?
  case "$status" in
    0|130|143) exit "$status" ;;
  esac
  printf 'AI worker exited with status %s; retrying in 2 seconds.\n' "$status" >&2
  sleep 2
done
