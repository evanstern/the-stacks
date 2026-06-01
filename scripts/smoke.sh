#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
WEB_URL="${WEB_URL:-http://localhost:5173}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin-password}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-120}"
COOKIE_JAR="$(mktemp)"
SUPPORTED_FILE="$(mktemp --suffix=.md)"
UNSUPPORTED_FILE="$(mktemp --suffix=.pdf)"
PYTHON_BIN="$(command -v python3 || command -v python || true)"

cleanup() {
  rm -f "$COOKIE_JAR" "$SUPPORTED_FILE" "$UNSUPPORTED_FILE"
}
trap cleanup EXIT

log() {
  printf '[smoke] %s\n' "$*"
}

fail() {
  printf '[smoke] ERROR: %s\n' "$*" >&2
  exit 1
}

wait_for() {
  local name="$1"
  local url="$2"
  local deadline=$((SECONDS + TIMEOUT_SECONDS))

  until curl -fsS "$url" >/dev/null 2>&1; do
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

  response="$(curl -sS -w '\n%{http_code}' "$@")" || fail "${description} curl command failed"
  status="${response##*$'\n'}"
  body="${response%$'\n'*}"
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

wait_for "API health" "${API_URL}/health"
wait_for "web frontend" "${WEB_URL}"

if [[ -z "$PYTHON_BIN" ]]; then
  fail "python3 or python is required to parse smoke API responses"
fi

health_body="$(curl -fsS "${API_URL}/health")"
expect_body_contains "$health_body" '"status":"ok"' "health response"

unauth_body="$(expect_status 401 "unauthenticated auth check" "${API_URL}/auth/me")"
expect_body_contains "$unauth_body" "Not authenticated" "unauthenticated auth check"
log "unauthenticated requests return 401"

login_body="$(expect_status 200 "admin login" -c "$COOKIE_JAR" -H "Content-Type: application/json" -d "{\"password\":\"${ADMIN_PASSWORD}\"}" "${API_URL}/auth/login")"
expect_body_contains "$login_body" '"authenticated":true' "admin login"
log "admin login succeeded"

printf '# Smoke Source\nAncient red dragons prefer volcanic lairs.\n' >"$SUPPORTED_FILE"
printf 'unsupported pdf placeholder\n' >"$UNSUPPORTED_FILE"

upload_body="$(expect_status 201 "supported markdown upload" -b "$COOKIE_JAR" -F "file=@${SUPPORTED_FILE};filename=smoke.md;type=text/markdown" "${API_URL}/uploads")"
expect_body_contains "$upload_body" '"queued":true' "supported markdown upload"
job_id="$($PYTHON_BIN -c 'import json,sys; print(json.load(sys.stdin)["job_id"])' <<<"$upload_body")"
log "supported upload queued job ${job_id}"

job_body="$(expect_status 200 "queued job lookup" -b "$COOKIE_JAR" "${API_URL}/jobs/${job_id}")"
expect_body_contains "$job_body" "$job_id" "queued job lookup"

unsupported_body="$(expect_status 415 "unsupported file rejection" -b "$COOKIE_JAR" -F "file=@${UNSUPPORTED_FILE};filename=smoke.pdf;type=application/pdf" "${API_URL}/uploads")"
expect_body_contains "$unsupported_body" "Unsupported file type" "unsupported file rejection"
log "unsupported files return explicit 415"

session_body="$(expect_status 201 "session creation" -b "$COOKIE_JAR" -H "Content-Type: application/json" -d '{"title":"Smoke session"}' "${API_URL}/sessions")"
session_id="$($PYTHON_BIN -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<<"$session_body")"
log "created smoke session ${session_id}"

empty_messages="$(expect_status 200 "empty session messages" -b "$COOKIE_JAR" "${API_URL}/sessions/${session_id}/messages")"
if [[ "$empty_messages" != "[]" ]]; then
  printf '%s\n' "$empty_messages" >&2
  fail "empty session messages returned unexpected content"
fi
log "empty chat index returns []"

chat_body="$(expect_status 503 "chat without OpenAI key" -b "$COOKIE_JAR" -H "Content-Type: application/json" -d '{"content":"What do red dragons prefer?"}' "${API_URL}/sessions/${session_id}/messages")"
expect_body_contains "$chat_body" "OPENAI_API_KEY is required" "chat without OpenAI key"
log "chat dependency failures return explicit 503"

curl -fsS "${WEB_URL}" >/dev/null || fail "web frontend stopped responding after API smoke"
log "web frontend remained reachable after smoke"
log "smoke completed successfully"
