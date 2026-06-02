#!/usr/bin/env bash
set -euo pipefail

THE_STACKS_LOCAL_URL="${THE_STACKS_LOCAL_URL:-http://localhost:8423}"
THE_STACKS_BASE_URL="${THE_STACKS_BASE_URL:-https://thestacks.ikis.ai}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin-password}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-120}"
CURL_CONNECT_TIMEOUT_SECONDS="${SMOKE_CURL_CONNECT_TIMEOUT_SECONDS:-5}"
CURL_MAX_TIME_SECONDS="${SMOKE_CURL_MAX_TIME_SECONDS:-15}"
COOKIE_JAR="$(mktemp)"
SUPPORTED_FILE="$(mktemp --suffix=.md)"
UNSUPPORTED_FILE="$(mktemp --suffix=.pdf)"
PYTHON_BIN="$(command -v python3 || command -v python || true)"

cleanup() {
  rm -f "$COOKIE_JAR" "$SUPPORTED_FILE" "$UNSUPPORTED_FILE"
}
trap cleanup EXIT

log() {
  printf '[smoke-public] %s\n' "$*"
}

fail() {
  printf '[smoke-public] ERROR: %s\n' "$*" >&2
  exit 1
}

print_usage() {
  cat <<'EOF'
Usage: scripts/smoke-public.sh [--help] [--local-only] [--public-only]

Verify the same root-mounted API contract against local production and the
public host without browser automation.

Environment:
  THE_STACKS_LOCAL_URL   Local production base URL (default: http://localhost:8423)
  THE_STACKS_BASE_URL    Public production base URL (default: https://thestacks.ikis.ai)
  ADMIN_PASSWORD         Password used for the auth smoke (default: admin-password)
  SMOKE_TIMEOUT_SECONDS  Wait timeout per base URL (default: 120)

Checks run against each selected base URL:
  /health, /auth/me, /auth/login, /sessions, /sessions/:id/messages,
  /uploads, /jobs/:id, /records/stats, plus SPA responses for / and /login.

The script fails clearly on DNS, HTTP, CORS, or routing mismatches.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

curl_base_args() {
  printf '%s\n' \
    --silent \
    --show-error \
    --connect-timeout "$CURL_CONNECT_TIMEOUT_SECONDS" \
    --max-time "$CURL_MAX_TIME_SECONDS"
}

run_curl() {
  timeout --foreground --preserve-status "${CURL_MAX_TIME_SECONDS}s" curl "$@"
}

wait_for() {
  local name="$1"
  local url="$2"
  local deadline=$((SECONDS + TIMEOUT_SECONDS))

  until run_curl $(curl_base_args) --fail "$url" >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      fail "Timed out waiting for ${name} at ${url}"
    fi
    sleep 2
  done
  log "${name} is reachable at ${url}"
}

expect_status() {
  local expected="$1"
  local description="$2"
  shift 2
  local response status body

  response="$(run_curl $(curl_base_args) -D - -o - -w '\n%{http_code}' "$@")" || fail "${description} curl command failed"
  status="${response##*$'\n'}"
  body="${response%$'\n'*}"
  body="${body#*$'\r\n\r\n'}"
  if [[ "$status" != "$expected" ]]; then
    printf '%s\n' "$body" >&2
    fail "${description} returned HTTP ${status}; expected ${expected}"
  fi
  printf '%s' "$body"
}

expect_body_contains() {
  local body="$1"
  local needle="$2"
  local description="$3"

  if [[ "$body" != *"$needle"* ]]; then
    printf '%s\n' "$body" >&2
    fail "${description} did not contain ${needle}"
  fi
}

expect_body_contains_ci() {
  local body="$1"
  local needle="$2"
  local description="$3"
  local body_lower needle_lower

  body_lower="$(printf '%s' "$body" | tr '[:upper:]' '[:lower:]')"
  needle_lower="$(printf '%s' "$needle" | tr '[:upper:]' '[:lower:]')"
  if [[ "$body_lower" != *"$needle_lower"* ]]; then
    printf '%s\n' "$body" >&2
    fail "${description} did not contain ${needle}"
  fi
}

expect_json_field_equals() {
  local body="$1"
  local field_path="$2"
  local expected="$3"
  local description="$4"
  local actual

  actual="$(printf '%s' "$body" | $PYTHON_BIN -c 'import json,sys
path = sys.argv[1].split(".") if sys.argv[1] else []
data = json.load(sys.stdin)
for key in path:
    if isinstance(data, list):
        data = data[int(key)]
    else:
        data = data[key]
if isinstance(data, bool):
    print("true" if data else "false")
elif data is None:
    print("null")
else:
    print(data)' "$field_path")" || fail "${description} was not valid JSON"

  if [[ "$actual" != "$expected" ]]; then
    fail "${description} expected ${field_path}=${expected}, got ${actual}"
  fi
}

expect_json_parses() {
  local body="$1"
  local description="$2"

  printf '%s' "$body" | $PYTHON_BIN -c 'import json,sys; json.load(sys.stdin)' >/dev/null 2>&1 || fail "${description} was not valid JSON"
}

check_cors_preflight() {
  local base_url="$1"
  local response status headers
  response="$(run_curl $(curl_base_args) -D - -o /dev/null -w '\n%{http_code}' \
    -X OPTIONS \
    -H 'Origin: https://thestacks.ikis.ai' \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: content-type' \
    "${base_url}/auth/login")" || fail "CORS preflight for ${base_url} curl command failed"
  status="${response##*$'\n'}"
  headers="${response%$'\n'*}"
  headers_lower="$(printf '%s' "$headers" | tr '[:upper:]' '[:lower:]')"
  if [[ "$status" != "204" && "$status" != "200" ]]; then
    printf '%s\n' "$headers" >&2
    fail "CORS preflight for ${base_url} returned HTTP ${status}; expected 204 or 200"
  fi
  if [[ "$headers_lower" != *$'access-control-allow-origin: https://thestacks.ikis.ai'* ]]; then
    printf '%s\n' "$headers" >&2
    fail "CORS preflight for ${base_url} did not allow https://thestacks.ikis.ai"
  fi
}

run_smoke_for_base() {
  local base_url="$1"
  local label="$2"
  local health_body unauth_body login_body session_body session_id empty_messages upload_body job_id job_body records_body root_body login_page_body unsupported_body

  wait_for "${label} health" "${base_url}/health"
  check_cors_preflight "$base_url"

  health_body="$(curl -fsS "${base_url}/health")"
  expect_json_field_equals "$health_body" "status" "ok" "${label} health response"

  unauth_body="$(expect_status 401 "${label} unauthenticated auth check" "${base_url}/auth/me")"
  expect_body_contains "$unauth_body" 'Not authenticated' "${label} unauthenticated auth check"

  login_body="$(expect_status 200 "${label} admin login" -c "$COOKIE_JAR" -H "Content-Type: application/json" -d "{\"password\":\"${ADMIN_PASSWORD}\"}" "${base_url}/auth/login")"
  expect_json_field_equals "$login_body" "authenticated" "true" "${label} admin login"

  session_body="$(expect_status 201 "${label} session creation" -b "$COOKIE_JAR" -H "Content-Type: application/json" -d '{"title":"Smoke session"}' "${base_url}/sessions")"
  session_id="$($PYTHON_BIN -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<<"$session_body")"
  expect_json_parses "$session_body" "${label} session creation"

  empty_messages="$(expect_status 200 "${label} empty session messages" -b "$COOKIE_JAR" "${base_url}/sessions/${session_id}/messages")"
  if [[ "$empty_messages" != "[]" ]]; then
    printf '%s\n' "$empty_messages" >&2
    fail "${label} empty session messages returned unexpected content"
  fi

  upload_body="$(expect_status 201 "${label} supported markdown upload" -b "$COOKIE_JAR" -F "file=@${SUPPORTED_FILE};filename=smoke.md;type=text/markdown" "${base_url}/uploads")"
  expect_json_field_equals "$upload_body" "queued" "true" "${label} supported markdown upload"
  job_id="$($PYTHON_BIN -c 'import json,sys; print(json.load(sys.stdin)["job_id"])' <<<"$upload_body")"
  expect_json_parses "$upload_body" "${label} supported markdown upload"

  job_body="$(expect_status 200 "${label} queued job lookup" -b "$COOKIE_JAR" "${base_url}/jobs/${job_id}")"
  expect_json_parses "$job_body" "${label} queued job lookup"
  expect_body_contains "$job_body" "$job_id" "${label} queued job lookup"

  unsupported_body="$(expect_status 415 "${label} unsupported file rejection" -b "$COOKIE_JAR" -F "file=@${UNSUPPORTED_FILE};filename=smoke.pdf;type=application/pdf" "${base_url}/uploads")"
  expect_body_contains "$unsupported_body" 'Unsupported file type' "${label} unsupported file rejection"

  records_body="$(expect_status 200 "${label} records stats" -b "$COOKIE_JAR" "${base_url}/records/stats")"
  expect_json_parses "$records_body" "${label} records stats"

  root_body="$(expect_status 200 "${label} SPA root" "${base_url}/")"
  expect_body_contains_ci "$root_body" '<!DOCTYPE html>' "${label} SPA root"

  login_page_body="$(expect_status 200 "${label} SPA login route" "${base_url}/login")"
  expect_body_contains_ci "$login_page_body" '<!DOCTYPE html>' "${label} SPA login route"

  log "${label} checks passed for ${base_url}"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_usage
  exit 0
fi

if [[ "${1:-}" == "--local-only" && -n "${2:-}" ]] || [[ "${1:-}" == "--public-only" && -n "${2:-}" ]]; then
  fail "unexpected extra arguments"
fi

MODE="both"
case "${1:-}" in
  --local-only)
    MODE="local"
    ;;
  --public-only)
    MODE="public"
    ;;
  "")
    ;;
  *)
    fail "unknown argument: ${1:-}"
    ;;
esac

require_command curl
require_command python3
[[ -n "$PYTHON_BIN" ]] || fail "python3 or python is required to parse smoke API responses"

printf '# Smoke Source\nAncient red dragons prefer volcanic lairs.\n' >"$SUPPORTED_FILE"
printf 'unsupported pdf placeholder\n' >"$UNSUPPORTED_FILE"

case "$MODE" in
  local)
    run_smoke_for_base "$THE_STACKS_LOCAL_URL" "local production" "local"
    ;;
  public)
    run_smoke_for_base "$THE_STACKS_BASE_URL" "public hosting" "public"
    ;;
  both)
    run_smoke_for_base "$THE_STACKS_LOCAL_URL" "local production" "local"
    run_smoke_for_base "$THE_STACKS_BASE_URL" "public hosting" "public"
    ;;
esac

log "smoke-public completed successfully"
