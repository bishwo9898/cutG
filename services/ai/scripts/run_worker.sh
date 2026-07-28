#!/bin/sh

set -eu

redis_url="${REDIS_URL:-redis://localhost:6380}"
rq_command="rq"
if [ -x .venv/bin/rq ]; then
  rq_command=".venv/bin/rq"
fi

exec "$rq_command" worker cutg-ai-hair --url "$redis_url" --worker-class rq.worker.SpawnWorker
