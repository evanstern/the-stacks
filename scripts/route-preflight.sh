#!/usr/bin/env bash
set -euo pipefail

ZONE_NAME="${THE_STACKS_ZONE:-ikis.ai}"
HOSTNAME="${THE_STACKS_HOSTNAME:-thestacks.ikis.ai}"
APP_HOST_PORT="${APP_HOST_PORT:-8423}"
CF_API_TOKEN="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
CF_API_BASE="${CF_API_BASE:-https://api.cloudflare.com/client/v4}"

log() {
  printf '[route-preflight] %s\n' "$*"
}

fail() {
  printf '[route-preflight] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

cf_get() {
  local path="$1"
  curl -fsS \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${CF_API_BASE}${path}"
}

print_usage() {
  cat <<'EOF'
Usage: scripts/route-preflight.sh

Read-only preflight for routing The Stacks through the Fabrique-style host fabric.

Environment:
  CF_API_TOKEN or CLOUDFLARE_API_TOKEN  Cloudflare API token for read-only API checks
  THE_STACKS_ZONE                       Must remain ikis.ai (default: ikis.ai)
  THE_STACKS_HOSTNAME                   Must remain thestacks.ikis.ai (default: thestacks.ikis.ai)
  APP_HOST_PORT                         Must remain production host port 8423 (default: 8423)

The script does not mutate DNS records, tunnels, Traefik config, volumes, or containers.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_usage
  exit 0
fi

[[ "$ZONE_NAME" == "ikis.ai" ]] || fail "refusing zone ${ZONE_NAME}; scope is ikis.ai only"
[[ "$HOSTNAME" == "thestacks.ikis.ai" ]] || fail "refusing hostname ${HOSTNAME}; scope is thestacks.ikis.ai only"
[[ "$APP_HOST_PORT" =~ ^[0-9]+$ ]] || fail "APP_HOST_PORT must be numeric"
[[ "$APP_HOST_PORT" == "8423" ]] || fail "refusing host port ${APP_HOST_PORT}; production route target is 8423 only"

require_command curl
require_command python3

log "scope: zone=${ZONE_NAME} hostname=${HOSTNAME} intended_host_port=${APP_HOST_PORT}"
log "intended fabric: Cloudflare DNS -> Cloudflare Tunnel -> host port 80 -> Traefik -> http://host.docker.internal:${APP_HOST_PORT}"

log "local DNS lookup for ${HOSTNAME}"
if command -v dig >/dev/null 2>&1; then
  dig +short "$HOSTNAME" || true
elif command -v getent >/dev/null 2>&1; then
  getent hosts "$HOSTNAME" || true
else
  log "dig/getent unavailable; skipping local resolver lookup"
fi

if [[ -z "$CF_API_TOKEN" ]]; then
  log "Cloudflare API token not set; skipping API state checks"
else
  zone_json="$(cf_get "/zones?name=${ZONE_NAME}&status=active&per_page=1")"
  zone_id="$(python3 -c 'import json, sys
data = json.load(sys.stdin)
if not data.get("success"):
    raise SystemExit("Cloudflare zone lookup failed")
results = data.get("result") or []
if len(results) != 1:
    raise SystemExit(f"Expected exactly one active zone, found {len(results)}")
print(results[0]["id"])' <<<"$zone_json")"
  account_id="$(python3 -c 'import json, sys
data = json.load(sys.stdin)
print(data["result"][0]["account"]["id"])' <<<"$zone_json")"
  log "Cloudflare zone found: ${ZONE_NAME} (${zone_id}); account=${account_id}"

  dns_json="$(cf_get "/zones/${zone_id}/dns_records?name=${HOSTNAME}&per_page=100")"
  DNS_JSON="$dns_json" python3 - "$HOSTNAME" <<'PY'
import json
import os
import sys

hostname = sys.argv[1]
data = json.loads(os.environ["DNS_JSON"])
if not data.get("success"):
    raise SystemExit("Cloudflare DNS record lookup failed")
records = data.get("result") or []
print(f"[route-preflight] Cloudflare DNS records for {hostname}: {len(records)}")
for record in records:
    proxied = record.get("proxied")
    content = str(record.get("content", ""))
    if len(content) > 120:
        content = content[:117] + "..."
    print(
        "[route-preflight] - id={id} type={type} name={name} proxied={proxied} content={content}".format(
            id=record.get("id"),
            type=record.get("type"),
            name=record.get("name"),
            proxied=proxied,
            content=content,
        )
    )
PY

  tunnels_json="$(cf_get "/accounts/${account_id}/cfd_tunnel?is_deleted=false&per_page=100")"
  TUNNELS_JSON="$tunnels_json" python3 - <<'PY'
import json
import os

data = json.loads(os.environ["TUNNELS_JSON"])
if not data.get("success"):
    raise SystemExit("Cloudflare tunnel lookup failed")
tunnels = data.get("result") or []
print(f"[route-preflight] active Cloudflare tunnels visible to token: {len(tunnels)}")
for tunnel in tunnels:
    print(
        "[route-preflight] - id={id} name={name} status={status} created_at={created_at}".format(
            id=tunnel.get("id"),
            name=tunnel.get("name"),
            status=tunnel.get("status"),
            created_at=tunnel.get("created_at"),
        )
    )
PY
fi

if command -v cloudflared >/dev/null 2>&1; then
  log "cloudflared is installed; operator can inspect the configured tunnel with: cloudflared tunnel list"
else
  log "cloudflared not found on PATH; Cloudflare tunnel CLI checks skipped"
fi

cat <<EOF

Host-local route to install only after reviewing the preflight above:

traefik dynamic.yml:
  http:
    routers:
      thestacks-prod:
        rule: Host(\`${HOSTNAME}\`)
        service: thestacks-prod
    services:
      thestacks-prod:
        loadBalancer:
          servers:
            - url: http://host.docker.internal:${APP_HOST_PORT}

cloudflared ingress before the catch-all rule:
  - hostname: ${HOSTNAME}
    service: http://localhost:80

Cloudflare DNS if the hostname is missing and the existing tunnel is confirmed:
  cloudflared tunnel route dns <tunnel-id> ${HOSTNAME}

Safety constraints:
  - Do not edit apex ikis.ai or unrelated subdomains.
  - Do not delete DNS records, tunnels, Docker volumes, or Fabrique routing.
  - If an existing ${HOSTNAME} record conflicts, capture its id/type/content before any future mutation.
EOF
