# Contract — the typed REST route

Proves the validation seam every later route inherits (research D5). It models no product
concept on purpose.

## Request

`POST /api/echo` with a JSON body validated against a schema defined in
`packages/shared` (research D4 — single-source, so TASK-0016's client imports the same
object rather than a copy).

```json
{ "message": <string, 1..500 chars> }
```

## Success response — `200 OK`

Validated on the way out as well as in, so a handler bug cannot emit a response that
violates the declared shape.

```json
{ "message": <string>, "receivedAt": <ISO-8601 timestamp> }
```

## Failure responses

Both use the single structured error shape (see [errors.md](errors.md)). Validation
failure is `400` and names the offending input; an internal failure is `500` and names
nothing.

## Why input AND output are validated

FR-004 requires both. Input validation protects the handler from the client; output
validation protects the client from the handler. An agent (CR-001) depends on the
response matching its declared schema in order to parse it without special-casing.
