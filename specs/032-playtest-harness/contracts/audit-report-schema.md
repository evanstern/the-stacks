# Contract: the auditor report schema

Module: `apps/server/src/playtest/auditor/schema.ts` (`ReportSchema`, `FindingSchema`),
`render.ts` (`renderReport`). Files `report.json` and `report.md` in the run directory.
FR-014, FR-015, FR-016.

## Schema

```ts
export const FINDING_KINDS = [
  "ledger-contradiction", "invented-mechanics", "hidden-info-leak", "player-agency",
  "roll-without-reason", "no-scene", "doctrine", "other", "dm-audit-flag",
] as const;

export const SEVERITY_OF: Record<(typeof FINDING_KINDS)[number], "fail" | "warn" | "note"> = {
  "ledger-contradiction": "fail", "invented-mechanics": "fail", "hidden-info-leak": "fail",
  "player-agency": "fail", "roll-without-reason": "fail", "no-scene": "fail",
  doctrine: "warn", other: "warn", "dm-audit-flag": "note",
};

export const FindingSchema = z.object({
  id: z.string().regex(/^F\d+$/),
  source: z.enum(["check", "auditor", "dm-audit"]),
  check: z.string().nullable(),                   // the check id when source = "check"
  kind: z.enum(FINDING_KINDS),
  severity: z.enum(["fail", "warn", "note"]),     // always SEVERITY_OF[kind]
  segment: z.number().int().min(0).nullable(),
  doctrineId: z.string().nullable(),
  seqs: z.array(z.number().int().positive()).max(20),
  detail: z.string().min(1).max(400),
});

export const ReportSchema = z.object({
  v: z.literal(1),
  runId: z.string(),
  sessionId: z.string().uuid(),
  seedId: z.string().nullable(),
  auditedAt: z.string(),
  commit: z.string(),
  verdict: z.enum(["pass", "fail", "incomplete"]),
  auditorMode: z.enum(["model", "checks-only"]),
  counts: z.object({
    rows: z.number().int(), narrations: z.number().int(), segments: z.number().int(),
    rolls: z.number().int(),
    findings: z.object({ fail: z.number().int(), warn: z.number().int(), note: z.number().int() }),
  }),
  segments: z.array(z.object({
    index: z.number().int(),
    narrationSeq: z.number().int().nullable(),
    fromSeq: z.number().int(),
    toSeq: z.number().int(),
    checks: z.array(z.object({ id: z.string(), pass: z.boolean() })),
    auditor: z.union([
      z.object({ verdict: z.enum(["pass", "fail"]), findings: z.number().int(),
                 discarded: z.number().int(), truncated: z.boolean(), attempts: z.number().int() }),
      z.object({ skipped: z.literal(true) }),
      z.object({ error: z.string() }),
    ]),
  })),
  findings: z.array(FindingSchema),
  fight: FightStatsSchema.nullable(),             // stats.ts; null when turn mode never began
  models: z.record(z.string(), z.object({ provider: z.string(), model: z.string() })),
  modelNote: z.string().nullable(),
  usage: z.object({ calls: z.number().int(), inputTokens: z.number().int(),
                    outputTokens: z.number().int(), costUsd: z.number().nullable() }),
});
```

## Verdict

1. `incomplete` when any segment's `auditor` is `{ error }`, or when a `no-scene` finding exists.
2. Else `fail` when any finding has severity `fail`.
3. Else `pass`. `warn` and `note` findings never change the verdict.

Checks-only mode (no gateway) can still reach `pass` or `fail`; its segments record
`{ skipped: true }`.

## Finding ids

Assign ids after collection, in this order: segment index (the tail segment last, then
`null`), then source (`check`, `auditor`, `dm-audit`), then the first cited seq. Number from
`F1`. Ids are stable for a given transcript and auditor output, so the demo record can cite
them.

## `report.md` layout

1. Title `Playtest audit — <runId>`; the verdict; session, seed, commit, auditor mode.
2. Counts table.
3. Findings table: `id | severity | kind | source | segment | rows | doctrine | detail`.
4. Segment table: index, narration seq, row range, failing checks, auditor verdict.
5. Fight statistics.
6. Models per purpose, model note, usage.

Neither file holds prompt text or a key.
