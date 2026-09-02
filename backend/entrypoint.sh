#!/bin/sh
set -e

# Database migrations are a deployment operation, not a container-start
# operation. coders.kr scales this service to zero, so doing DB/network work
# here would delay every first social-login request after an idle period. Set
# RUN_MIGRATIONS=1 only for a deliberate schema rollout, then turn it off.
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  .venv/bin/alembic upgrade head
fi
exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
