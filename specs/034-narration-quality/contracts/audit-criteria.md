# Contract: audit criteria v2 — what blocks, what advises

Amends `specs/031-dm-runtime/contracts/audit.md` ("The loop", "Deterministic checks", "The
audit call", "The audit record"). Evidence: research.md R1. Card AC #3.

## Blocking and advisory issues

| Source | Kind | Blocks? |
|---|---|---|
| Deterministic check | every kind | yes |
| `dm.audit` | `ledger-mismatch` | yes |
| `dm.audit` | `invented-mechanics` | yes |
| `dm.audit` | `player-agency` | yes |
| `dm.audit` | `doctrine` | no (advisory) |
| `dm.audit` | `other` | no (advisory) |

Code derives the attempt's result from the issues. An attempt passes when the deterministic
checks pass and the `dm.audit` call returns no blocking issue. The model's `verdict` is recorded
and not used. `AuditModelOutput` is unchanged.

## The loop (changes only)

```
  llm = det.pass ? auditCall(...) : skipped
  blocking = det.issues + llm.issues where kind blocks
  if blocking is empty: ship narration; stop
  ...
  issuesSoFar += blocking            # advisory issues never reach regeneration
```

`MAX_NARRATION_ATTEMPTS` stays 3. An audit call failure still ships the fallback.

## Deterministic checks (changes only)

| Check | Change |
|---|---|
| clarify question (new) | Fails when `facts.clarify` is non-empty and the trimmed prose does not end with `?`. Kind `doctrine`. Detail: "The facts ask a question and the prose does not end with one." |
| life states | The detail quotes the matched words, at most 60 characters: `The prose says a character dies ("<match>"), and no fact records a death.` |
| option menu | The detail quotes the closing question, at most 120 characters. |
| length | The detail states the count: `The prose is <n> words; the limit is 220.` The limit stays 220. |

## The audit call v2 (`prompts/audit.ts`, `PROMPT_VERSION = "dm.audit-v2"`)

The user prompt adds the facts' `## Party (player characters)` and `## Other characters (the
world)` sections (contracts/narration-facts.md). The system prompt states:

1. "`player-agency`: the prose decides what a PARTY member says, feels or chooses beyond their
   declared action. Showing a party member carry out their declared action is allowed. Words,
   moves and feelings of every other character are the world's, never `player-agency`."
2. "`invented-mechanics` or `ledger-mismatch`: the prose grants a rules result no fact records —
   a hit, a wound, a condition, a death, a success at an uncertain task, or a hidden discovery —
   or contradicts a fact. No rules effect means nothing was rolled; the attempt still happens
   and the world may respond. That is not a mismatch."
3. "When the facts ask a question, ending on that open question is correct."
4. "Code checks length; do not report length."
5. "Report craft concerns as `doctrine`. They are advice and do not fail the narration."

## The audit record (changes only)

```ts
interface RecordedIssue extends AuditIssue { blocking: boolean }
interface AuditAttempt {
  attempt: number;
  words: number;                                   // new: the attempt's prose word count
  deterministic: { pass: boolean; issues: RecordedIssue[] };
  llm: { verdict: "pass" | "fail"; issues: RecordedIssue[] } | { skipped: true } | { error: NodeErrorKind };
  proseSha256: string;
}
```

`final` and `flagged` keep their meaning: `flagged` is true when any attempt had a blocking
issue. The fallback journal body lists each attempt's issues with `[advisory]` before advisory
ones. Stored in `jobs.result` (jsonb). No migration.

## Tests

- `audit.test.ts`: a doctrine-only fail passes on attempt 1 with the issues recorded as
  advisory; a `player-agency` fail regenerates; regeneration receives only blocking issues; the
  clarify check fails a clarify turn's prose without a closing `?` and passes one with an open
  question; each new detail format.
- `audit.integration.test.ts` (scripted gateway): a script whose `dm.audit` returns a
  `doctrine`-only fail ships the narration with `final: "passed"`.
- The audit prompt v2 holds the party section and the five statements.
