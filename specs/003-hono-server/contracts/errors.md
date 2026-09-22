# Contract — the structured error shape

Every client-visible failure takes this shape: validation failures, internal failures, and
unknown paths alike (spec edge case 3). A client never receives a stack trace, a framework
default page, or a bare string.

```json
{
  "error": {
    "kind": "validation" | "internal" | "not_found",
    "message": <string, human-readable, safe to display>,
    "issues": [ { "path": <string>, "message": <string> } ]   // validation only
  }
}
```

## Rules

- **`kind` is the discriminator FR-007 requires** — it tells a client whether retrying
  differently could help. An agent reads this field to decide whether to fix its request
  or give up (CR-001).
- **`issues` appears only for `kind: "validation"`**, and names the offending input paths.
  Specificity is the point: it is what makes a validation error actionable.
- **`kind: "internal"` discloses nothing.** No stack trace, no file path, no driver
  message, no exception class (FR-006). The `message` is a fixed, generic string. Details
  belong in server logs, not in the response.
- **Status codes**: `400` for validation, `404` for not_found, `500` for internal. The
  body shape is identical across all three — a client parses one shape, always.
