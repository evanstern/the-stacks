# Contract: gate-api.md amendment (TASK-0157)

This file holds the exact amendment text that Phase 4 applies to the frozen contract
`specs/029-proposal-gate/contracts/gate-api.md`. The operator ruled it on 2026-10-27 (spec.md,
"Open questions"). Apply it verbatim; do not paraphrase it.

## Edit 1 — step 7 of "Algorithm (one attempt)"

Replace step 7:

```
7. Every append calls the seam with `expectedLastSeq: lastSeq`. On `SeqConflictError`,
   restart from step 1. After the third conflict, refuse `CONFLICT`.
```

with:

```
7. Every append calls the seam with `expectedLastSeq: lastSeq`. On `SeqConflictError`,
   wait, then restart from step 1. After the third conflict, refuse `CONFLICT`. See the
   TASK-0157 amendment ("Ordering and retry policy") below for the order, the wait and the
   bound.
```

## Edit 2 — new amendment block

Insert this block directly after the TASK-0049 amendment block in the same section:

```
> **Amendment (TASK-0157, specs/052-talk-conflict-retry). Ordering and retry policy.**
>
> - **Per-session order.** The gate runs one session's writes one at a time, in arrival
>   order, inside the server process. A write is a `handle` call, a `submit` call or a
>   `recordPresence` call. The whole of each write runs in its turn: every attempt, every
>   wait and every `onAppended` call. Writes to different sessions never wait for each other.
> - **Parse first.** A request that fails `ProposalSchema` or `GateRequestSchema` is refused
>   `INVALID_PROPOSAL` at once. It never joins the order.
> - **Isolation.** A refusal or a thrown error ends that write only. The next write in the
>   session still runs.
> - **No re-entry.** Code that runs inside a write MUST NOT await another gate write for the
>   same session. `onAppended` listeners are synchronous for this reason.
> - **Retry bound.** At most 3 attempts per write. After a `SeqConflictError` on attempt 1 or
>   2, the gate waits a random 10–50 ms, then restarts from step 1. No wait follows attempt 3.
>   `GateDeps.retryDelayMs(attempt)` overrides the wait for tests.
> - **When `CONFLICT` can still occur.** In-process writes cannot conflict with one another.
>   A `CONFLICT` now means a writer outside this gate instance (another process, or a second
>   gate over the same database) appended to the session three times in a row.
> - **Safe to resend.** A `CONFLICT` writes zero rows. A caller may resend the same request
>   without risk of a duplicate.
> - **Wire unchanged.** `CONFLICT` keeps the `internal` error kind (ws-delivery.md).
```

## Not changed

- `specs/029-proposal-gate/contracts/ws-delivery.md`: no edit. Its `CONFLICT → internal` row
  stays true.
- `docs/wiki/ws-protocol.md` frame shapes: no edit.
