# Contract: audit — the check and the bounded regenerate loop

Modules: `apps/server/src/dm/nodes/audit.ts` (checks, purpose `dm.audit`),
`apps/server/src/dm/nodes/narrate.ts` (regeneration), `apps/server/src/dm/fallback.ts` (the
factual summary). AC #7. Ordering is the anti-cheat: audit sees the narration only after
resolve applied every roll, and the narration is not in the log until audit decides.

## The loop

```
attempt = 1
loop:
  narration = narrate(facts, issuesSoFar)          # dm.narrate
  det = deterministicChecks(facts, narration)       # code
  llm = det.pass ? auditCall(facts, narration) : skipped   # dm.audit
  record attempt { attempt, det, llm }
  if det.pass and llm.verdict == "pass": ship narration; stop
  if llm call failed (gateway or invalid output): ship fallback + flag; stop
  if attempt == 3: ship fallback + flag; stop
  issuesSoFar += det.issues + llm.issues; attempt += 1
```

`MAX_NARRATION_ATTEMPTS = 3`. The loop is the pipeline's second and last conditional branch
(decision-0019). Each regeneration passes the previous text and every issue to
`dm.narrate`.

## Deterministic checks

`deterministicChecks(facts, narration): { pass: boolean; issues: AuditIssue[] }` is pure.

| Check | Fails when | Issue kind |
|---|---|---|
| no digits | the prose holds any character `0`–`9` | `ledger-mismatch` |
| dice language | the prose names dice, rolls or a d-expression and the turn has no roll | `invented-mechanics` |
| life states | the prose says a character dies, is killed, falls unconscious or is knocked out, and no fact records that life-state change for a named character; or a fact records one and the prose omits it | `ledger-mismatch` |
| outcome words | for an action with a single outcome, the prose pairs the actor's name with an opposite outcome word from a fixed list (hits/misses, succeeds/fails) | `ledger-mismatch` |
| length | the prose is over 220 words (doctrine target 100, ceiling 150, tolerance) | `doctrine` |
| option menu | a line starts with a bullet or a number, or the prose ends with an "A or B?" question | `doctrine` |
| dice lines | the dice lines differ from the renderer's output for the facts | `ledger-mismatch` (a bug guard) |

Word lists live in `audit-words.ts` and have their own tests.

## The audit call (`dm.audit`)

Prompt: the facts as JSON, the narration, the doctrine pairs marked "audit" in
[doctrine.md](doctrine.md). The model is told the facts are true and the narration is on
trial.

```ts
export const AuditModelOutput = z.object({
  verdict: z.enum(["pass", "fail"]),
  issues: z.array(z.object({
    kind: z.enum(["ledger-mismatch", "invented-mechanics", "player-agency", "doctrine", "other"]),
    detail: z.string().min(1).max(300),
  })).max(8),
}).refine((o) => o.verdict === "pass" || o.issues.length > 0);
```

A `fail` with only `doctrine` or `other` issues still fails the attempt; regeneration is
cheap and the loop is bounded.

## The factual summary (fallback)

`factualSummary(facts): string` is pure. It writes one plain sentence per action and per NPC
turn from the facts, with no adjectives. It writes no digits in the prose; the dice lines
follow as usual. It passes `deterministicChecks` by construction (a property test asserts it
over generated facts). It is not sent to `dm.audit`.

## What ships

`submitNarration` (in `resolve.ts`) submits one `narration` proposal: `text`, `actionIds` =
the beat's action ids, visibility `public`.

On a fallback, it also submits one `journal` proposal, visibility `dm`, entry id
`audit-<jobId>`, title `Audit flag: narration replaced`, body = each attempt's issues, one per
line, `sourceActionIds` = the beat's action ids.

## The audit record (FR-043)

Stored in the turn job's `result.audit`:

```ts
export interface AuditRecord {
  attempts: {
    attempt: number;
    deterministic: { pass: boolean; issues: AuditIssue[] };
    llm: { verdict: "pass" | "fail"; issues: AuditIssue[] } | { skipped: true } | { error: NodeErrorKind };
    proseSha256: string;           // the attempt's prose is not stored; its hash is
  }[];
  final: "passed" | "passed-after-regenerate" | "fallback";
  flagged: boolean;                // true when any attempt failed
  shippedProseSha256: string;
}
```

`GET /dm/sessions/:sessionId/turns` returns these records ([dm-api.md](dm-api.md)). TASK-0048's
demo record reads every `flagged: true` record and its `final` value.

Shipping the narration and its flag is the last write of the turn. The record is saved with
`finishJob` (fenced).
