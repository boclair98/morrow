#!/bin/sh
set -e

# Pull the cluster DNS server from /etc/resolv.conf and hand it to the
# nginx template as ${NGINX_RESOLVER}. Inside Kubernetes this is
# kube-dns; locally (docker compose etc.) it'll be the docker DNS.
export NGINX_RESOLVER="$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf)"

# The web pod starts independently from the API. Seed the public auth-config
# cache in the background as soon as nginx is listening, so a visitor opening
# /login does not pay the API cold-start cost.
(
  attempt=0
  while [ "$attempt" -lt 6 ]; do
    sleep 2
    if wget -q -T 45 -O /dev/null http://127.0.0.1/api/auth/providers; then
      exit 0
    fi
    attempt=$((attempt + 1))
  done
) &

# Hand control to the official nginx entrypoint, which runs envsubst on
# /etc/nginx/templates/*.template and then `exec` into nginx itself.
exec /docker-entrypoint.sh "$@"
