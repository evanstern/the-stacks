# Contract: `POST /library/ask` (SSE)

Binding for the chat UI (TASK-0028). The UI builds against this file; the server's tests assert
it. Transport per decision-0004.

## Request

```
POST /library/ask
Cookie: session=<token>
Content-Type: application/json

{ "question": "How does grappling work?" }
```

- `question`: string, 1–2000 characters after trimming. Other fields are ignored.
- Read the response with `fetch` and a stream reader. `EventSource` cannot send `POST`.

## Before the stream opens: JSON errors

These use the standard error contract (`{ error: { kind, message, issues? } }`), not SSE:

| Status | `kind` | When |
|---|---|---|
| 400 | `validation` | body is not JSON, `question` missing, empty, or over 2000 characters |
| 401 | `unauthorized` | no live session |
| 403 | `forbidden` | the session is a player (operator only: constitution VIII) |

## The stream

`200`, `Content-Type: text/event-stream`, `Cache-Control: no-cache`. Each message is:

```
event: <name>
data: <one line of JSON>

```

Grammar: `(delta | citation)* terminal`. Exactly one terminal event, then the server closes.
Terminal events: `done`, `refusal`, `error`. Events arrive in answer order: a `citation`
belongs at the point in the text where it arrives, directly after the claim it supports.

### `delta`

```json
{ "text": "Grappling uses a special melee attack" }
```

A piece of answer text (Markdown-free plain text). Append in order. Never contains citation
markup.

### `citation`

```json
{
  "n": 1,
  "chunkId": "5b0c…",
  "documentId": "a13e…",
  "book": "Basic Rules",
  "section": ["Combat", "Grappling"],
  "quote": "you can use the Attack action to make a special melee attack, a grapple",
  "span": { "start": 48213, "end": 48285 },
  "passage": {
    "kind": "prose",
    "text": "When you want to grab a creature … a grapple. …",
    "span": { "start": 48100, "end": 48790 }
  },
  "quoteInPassage": { "start": 113, "end": 185 }
}
```

| Field | Meaning |
|---|---|
| `n` | Citation number, 1-based, in first-appearance order. A repeat of the same span repeats its `n`; render it as the same reference. |
| `chunkId`, `documentId` | Stored ids. Stable while the book is not re-imported. |
| `book` | The book name as imported. |
| `section` | Heading path, outermost first. May be empty. |
| `quote` | The exact cited words, taken from the stored text (never from the model). |
| `span` | UTF-16 offsets of `quote` in the whole book text; `end` exclusive. |
| `passage.text` | The full stored passage the quote came from. |
| `passage.span` | UTF-16 offsets of the passage in the book. |
| `passage.kind` | `heading`, `prose`, `list`, `table`, `statBlock`, or `sidebar`. |
| `quoteInPassage` | UTF-16 offsets of `quote` inside `passage.text`. |

Guarantees:
- `passage.text.slice(quoteInPassage.start, quoteInPassage.end) === quote`.
- `span.start === passage.span.start + quoteInPassage.start`, and likewise for `end`.
- The stored book text sliced by `span` equals `quote`.

UTF-16 offsets are JavaScript string indices: `String.prototype.slice` uses them directly. To
open the source, render `passage.text` and highlight `quoteInPassage`. No second request is
needed.

### `done` (terminal)

```json
{ "citations": 3, "dropped": 1, "passages": 4, "promptVersion": "answer-v1" }
```

`citations` counts distinct emitted citations. `dropped` counts model citations that failed
verification and were removed. `passages` counts relevant passages given to the model. A UI may
show a notice when `dropped > 0`.

### `refusal` (terminal)

```json
{ "reason": "nothing_relevant", "message": "The library has nothing relevant to this question." }
```

| `reason` | When | Model called? |
|---|---|---|
| `nothing_relevant` | no retrieved passage passed the relevance rule | no |
| `model_declined` | the model said the passages do not answer the question, or the provider refused | yes |
| `unverified` | the model answered, but no citation survived verification | yes |

`message` is fixed per reason and safe to display. **On any `refusal`, discard every `delta`
already received** and show the refusal instead: that text is not a grounded answer.

### `error` (terminal)

```json
{ "kind": "upstream", "message": "The model provider failed. Try again." }
```

| `kind` | When |
|---|---|
| `config` | the `answering` purpose is not configured, or its provider key is missing |
| `auth` | the provider rejected the configured key |
| `rate_limit` | the provider is rate limiting after retries |
| `upstream` | the provider failed or returned a malformed stream |
| `retrieval` | the library search failed (for example, the embed purpose is misconfigured) |
| `internal` | anything else |

`message` is fixed per kind and safe to display; details go to the server log only. Text
received before an `error` is incomplete; a UI may keep it, marked as interrupted.

### Cancellation

Closing the connection (aborting the `fetch`) cancels the model call. The server writes nothing
more. There is no terminal event for a cancelled stream.

## Example

```
event: delta
data: {"text":"A grapple replaces one of your attacks"}

event: citation
data: {"n":1,"chunkId":"…","documentId":"…","book":"Basic Rules","section":["Combat","Grappling"],"quote":"…","span":{"start":48213,"end":48285},"passage":{"kind":"prose","text":"…","span":{"start":48100,"end":48790}},"quoteInPassage":{"start":113,"end":185}}

event: delta
data: {"text":"."}

event: done
data: {"citations":1,"dropped":0,"passages":2,"promptVersion":"answer-v1"}

```
