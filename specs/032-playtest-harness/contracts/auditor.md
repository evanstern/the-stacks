# Contract: the auditor agent (`playtest.audit`)

Modules: `apps/server/src/playtest/auditor/` (`segments.ts`, `checks.ts`, `prompt.ts`,
`schema.ts`, `stats.ts`, `audit.ts`), `apps/server/src/playtest/purpose.ts`. FR-010 to FR-018.
decision-0021 idea 6; decision-0007.

## Entry point

```ts
export interface AuditInput {
  transcript: StoredEvent[];          // DM view, seq order
  ledger: LedgerRow[];
  jobs: DmTurnsItem[];                // dm-api.md items (audit records)
  seed: SceneSeed | null;             // loaded from the scene.changed row's sceneId; null if none
  gateway: Gateway | null;            // null → code checks only (FR-017)
  models: Record<string, { provider: string; model: string }>;   // for the model note
  signal?: AbortSignal;
}
export async function runAudit(input: AuditInput): Promise<Report>;
```

## Segments (FR-010)

`segment(transcript, ledger): Segment[]`. Walk rows in `seq` order. Each `narration` row whose
actor is `ai:dm` closes a segment holding every row after the previous narration up to and
including it. Rows after the last narration form a tail segment only when they include a
`talk` row; otherwise they are dropped from auditing (still in the transcript). A transcript
with no `scene.changed` row yields zero segments and the single finding `no-scene`.

## Code checks (FR-011)

Pure functions over one segment (plus the seed). Each failing check is one finding with
`source: "check"`.

| Check id | Fails when | Kind |
|---|---|---|
| `prose-digits` | the narration prose (text before the first blank line) holds a character `0`–`9` | `ledger-contradiction` |
| `dice-lines` | the narration's dice lines (text after the first blank line, one per line) differ from the lines rebuilt from the segment's ledger rows with `collectFacts` + `renderRollLine` + `renderChangeLine` (`dm/facts.ts`), in seq order | `ledger-contradiction` |
| `life-states` | the prose uses a life-state word from `dm/audit-words.ts` next to a character name and the segment's ledger has no matching life-state change for that character, or a recorded life-state change's character is not named in the prose | `ledger-contradiction` |
| `roll-reasons` | a ledger roll row in the segment has an empty reason (decision-0021 idea 2) | `roll-without-reason` |
| `hidden-info` | a `public` row's text (narration, talk, journal) contains, case-insensitive, a seed `hooks.secrets` string of the location or any NPC, or the `name` of a secret tracker | `hidden-info-leak` |
| `dice-language` | the prose names dice, rolls or a d-expression and the segment's ledger has no roll | `invented-mechanics` |

Implementation notes: when `collectFacts` needs a `nameOf`, build it from the segment's
projections at the segment's last seq (`project(rows ≤ toSeq, { role: "dm" })`); the
fallback summary shipped by the DM runtime passes these checks by construction. A segment
whose narration is the factual fallback still runs every check.

## The auditor call (FR-012, FR-013)

One `gateway.chat` per segment: `purpose: "playtest.audit"`, `maxTokens` from config or 700,
`signal` passed through. The prompt (`prompt.ts`, `buildAuditorPrompt(segment, seed)`):

1. **System**: "You audit a tabletop game transcript. The ledger rows and state changes are
   true. The narration and the companions' talk are on trial. Report only problems you can tie
   to cited row numbers. Answer with JSON only."
2. **Doctrine**: every `DOCTRINE` pair rendered as `id: Rule / Wrong / Right` (≤ 1,200 tokens).
2a. **Party** (`playtest.audit-v2`, spec 074): one line per seed character, `<name> (human player)`
   or `<name> (AI companion)` from `seat`, or `(party unknown)` when the seed is null, then
   `agencyRule("auditor")`.
3. **Hidden information**: the seed's location and NPC `hooks.secrets` and the segment's
   DM-only rows (trackers), marked `[dm-only]`, with the rule "no public text may reveal these".
4. **Rows**: each row of the segment as one line `#<seq> <type> <actor> <visibility>: <summary>`
   (≤ 3,000 tokens by `estimateTokens`; truncate oldest rows first; never cut the narration or
   the rows of its own turn's ledger; set `truncated: true` on the segment result).
5. **On trial**: the narration text and every `talk` row by an `ai:companion:*` actor, verbatim.

The prompt module's header carries the `DOCTRINE_NOTICE` sentence (FR-018). The notice is not
sent to the model.

### Output schema

```ts
export const AuditorOutput = z.object({
  verdict: z.enum(["pass", "fail"]),
  findings: z.array(z.object({
    kind: z.enum(["ledger-contradiction", "invented-mechanics", "hidden-info-leak",
                  "player-agency", "doctrine", "other"]),
    doctrineId: z.string().nullable(),           // must be a DOCTRINE id when set
    seqs: z.array(z.number().int().positive()).min(1).max(20),   // must be in the segment
    detail: z.string().min(1).max(400),
  })).max(12),
}).refine((o) => o.verdict === "pass" || o.findings.length > 0);
```

Parse rules:

1. Strip one surrounding Markdown code fence if present, then `JSON.parse`, then
   `AuditorOutput.safeParse`.
2. A `doctrineId` that is not a `DOCTRINE` id becomes `null` and the finding's kind becomes
   `other`. A cited `seq` outside the segment is dropped; a finding left with no seq is dropped
   and counted in the segment's `discarded`.
3. Parse failure or a gateway error: retry the call once with the parse error appended; a second
   failure records `{ error: <kind> }` for the segment (FR-013).
4. A `pass` verdict with findings keeps the findings (the model's own inconsistency is
   recorded, not resolved).

## DM-runtime audit flags (FR-016)

For every job whose `audit.flagged` is true, one finding: `source: "dm-audit"`,
`kind: "dm-audit-flag"`, `severity: "note"`, `segment` = the segment whose narration seq follows
the job's start (or `null`), `detail` = `"final: <final>; attempts: <n>; issues: <kinds>"`.

## Fight statistics (`stats.ts`)

From the ledger and transcript (code only), for TASK-0055: rounds in turn mode, turns per side,
attack rolls and hits per side, damage dealt and taken per side, characters reduced to zero hit
points, death-save rolls, NPCs that fled or bargained (from director rows when present: else
`null`), and the number of narrations in turn mode.

## Model note

| Purpose | Calls per playtest | Strength | Suggested tier | `maxTokens` |
|---|---|---|---|---|
| `playtest.audit` | one per segment (8–15), plus at most one retry each | long-context comparison, doctrine judgment | strong; a different family than `dm.narrate` when available | 700 |

The report warns (`modelNote`) when `playtest.audit` and `dm.narrate` resolve to the same
provider and model.
