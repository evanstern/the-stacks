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

expect_json_nonempty_field() {
  local body="$1"
  local field_path="$2"
  local description="$3"
  local actual

  actual="$(printf '%s' "$body" | $PYTHON_BIN -c 'import json,sys
path = sys.argv[1].split(".") if sys.argv[1] else []
data = json.load(sys.stdin)
for key in path:
    if isinstance(data, list):
        data = data[int(key)]
    else:
        data = data[key]
if data is None:
    print("")
else:
    print(str(data))' "$field_path")" || fail "${description} was not valid JSON"

  if [[ -z "$actual" ]]; then
    fail "${description} expected non-empty ${field_path}"
  fi
}

expect_json_list_nonempty() {
  local body="$1"
  local field_path="$2"
  local description="$3"
  local count

  count="$(printf '%s' "$body" | $PYTHON_BIN -c 'import json,sys
path = sys.argv[1].split(".") if sys.argv[1] else []
data = json.load(sys.stdin)
for key in path:
    if isinstance(data, list):
        data = data[int(key)]
    else:
        data = data[key]
if not isinstance(data, list):
    raise SystemExit(1)
print(len(data))' "$field_path")" || fail "${description} expected ${field_path} to be a JSON list"

  if [[ "$count" == "0" ]]; then
    fail "${description} expected non-empty ${field_path}"
  fi
}

expect_status_one_of() {
  local description="$1"
  shift
  local expected_csv="$1"
  shift
  local response status body expected

  response="$(curl -sS -w '\n%{http_code}' "$@")" || fail "${description} curl command failed"
  status="${response##*$'\n'}"
  body="${response%$'\n'*}"
  IFS=',' read -r -a expected <<<"$expected_csv"
  for expected in "${expected[@]}"; do
    if [[ "$status" == "$expected" ]]; then
      printf '%s\n%s' "$status" "$body"
      return 0
    fi
  done
  printf '%s\n' "$body" >&2
  fail "${description} returned HTTP ${status}; expected one of ${expected_csv}"
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

chat_response="$(expect_status_one_of "chat dependency/configuration check" "200,503" -b "$COOKIE_JAR" -H "Content-Type: application/json" -d '{"content":"What do red dragons prefer?"}' "${API_URL}/sessions/${session_id}/messages")"
chat_status="${chat_response%%$'\n'*}"
chat_body="${chat_response#*$'\n'}"
if [[ "$chat_status" == "503" ]]; then
  expect_body_contains "$chat_body" "OPENAI_API_KEY is required" "chat without OpenAI key"
  log "chat dependency failures return explicit 503 when OpenAI is unavailable"
else
  expect_json_field_equals "$chat_body" "no_evidence" "false" "chat with OpenAI key"
  expect_json_field_equals "$chat_body" "assistant_message.role" "assistant" "chat with OpenAI key"
  expect_json_nonempty_field "$chat_body" "assistant_message.content" "chat with OpenAI key"
  expect_json_list_nonempty "$chat_body" "assistant_message.citations" "chat with OpenAI key"
  log "chat succeeds with grounded citations when OpenAI is configured"
fi

curl -fsS "${WEB_URL}" >/dev/null || fail "web frontend stopped responding after API smoke"
log "web frontend remained reachable after smoke"
log "smoke completed successfully"
