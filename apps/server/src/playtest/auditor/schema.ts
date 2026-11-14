import { z } from "zod";

/**
 * Auditor output, finding and report schemas (specs/032-playtest-harness
 * contracts/auditor.md and audit-report-schema.md), plus the run manifest
 * (data-model.md).
 */

/** What the model may answer for one segment. */
export const AuditorOutput = z
  .object({
    verdict: z.enum(["pass", "fail"]),
    findings: z
      .array(
        z.object({
          kind: z.enum([
            "ledger-contradiction",
            "invented-mechanics",
            "hidden-info-leak",
            "player-agency",
            "doctrine",
            "other",
          ]),
          doctrineId: z.string().nullable(),
          seqs: z.array(z.number().int().positive()).min(1).max(20),
          detail: z.string().min(1).max(400),
        }),
      )
      .max(12),
  })
  .refine((o) => o.verdict === "pass" || o.findings.length > 0, {
    message: "a fail verdict needs at least one finding",
  });
export type AuditorOutput = z.infer<typeof AuditorOutput>;

export const FINDING_KINDS = [
  "ledger-contradiction",
  "invented-mechanics",
  "hidden-info-leak",
  "player-agency",
  "roll-without-reason",
  "no-scene",
  "doctrine",
  "other",
  "dm-audit-flag",
  "unnarrated-deed",
] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const SEVERITY_OF: Record<FindingKind, "fail" | "warn" | "note"> = {
  "ledger-contradiction": "fail",
  "invented-mechanics": "fail",
  "hidden-info-leak": "fail",
  "player-agency": "fail",
  "roll-without-reason": "fail",
  "no-scene": "fail",
  doctrine: "warn",
  other: "warn",
  "dm-audit-flag": "note",
  "unnarrated-deed": "fail",
};

export const FindingSchema = z.object({
  id: z.string().regex(/^F\d+$/),
  source: z.enum(["check", "auditor", "dm-audit"]),
  check: z.string().nullable(),
  kind: z.enum(FINDING_KINDS),
  severity: z.enum(["fail", "warn", "note"]),
  segment: z.number().int().min(0).nullable(),
  doctrineId: z.string().nullable(),
  seqs: z.array(z.number().int().positive()).max(20),
  detail: z.string().min(1).max(400),
});
export type Finding = z.infer<typeof FindingSchema>;

const Side = z.object({
  players: z.number().int().min(0),
  npcs: z.number().int().min(0),
});
const Count = z.number().int().min(0);

/** Fight statistics for TASK-0055 (contracts/auditor.md "Fight statistics"). */
export const FightStatsSchema = z.object({
  rounds: Count,
  turns: Side,
  attackRolls: Side,
  hits: Side,
  damageDealt: Side,
  damageTaken: Side,
  reducedToZero: z.array(z.string()),
  deathSaveRolls: Count,
  fledOrBargained: z.array(z.string()).nullable(),
  /** Why `fledOrBargained` is `null`; `null` when it is derived. */
  fledOrBargainedNote: z.string().nullable().default(null),
  turnModeNarrations: Count,
});
export type FightStats = z.infer<typeof FightStatsSchema>;

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
    rows: z.number().int(),
    narrations: z.number().int(),
    segments: z.number().int(),
    rolls: z.number().int(),
    findings: z.object({
      fail: z.number().int(),
      warn: z.number().int(),
      note: z.number().int(),
    }),
  }),
  segments: z.array(
    z.object({
      index: z.number().int(),
      narrationSeq: z.number().int().nullable(),
      fromSeq: z.number().int(),
      toSeq: z.number().int(),
      checks: z.array(z.object({ id: z.string(), pass: z.boolean() })),
      auditor: z.union([
        z.object({
          verdict: z.enum(["pass", "fail"]),
          findings: z.number().int(),
          discarded: z.number().int(),
          truncated: z.boolean(),
          attempts: z.number().int(),
        }),
        z.object({ skipped: z.literal(true) }),
        z.object({ error: z.string() }),
      ]),
    }),
  ),
  findings: z.array(FindingSchema),
  fight: FightStatsSchema.nullable(),
  models: z.record(
    z.string(),
    z.object({ provider: z.string(), model: z.string() }),
  ),
  modelNote: z.string().nullable(),
  usage: z.object({
    calls: z.number().int(),
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    costUsd: z.number().nullable(),
  }),
});
export type Report = z.infer<typeof ReportSchema>;

/** The run manifest `run.json` (data-model.md). */
export const RunManifestSchema = z.object({
  v: z.literal(1),
  runId: z.string(),
  mode: z.enum(["ci", "provider", "session"]),
  commit: z.string(),
  sessionId: z.string().uuid(),
  seedId: z.string().nullable(),
  dice: z
    .object({
      scriptedFaces: z.number().int().min(0),
      seed: z.number().int().nullable(),
      drawn: z.number().int().min(0),
    })
    .optional(),
  models: z.record(
    z.string(),
    z.object({ provider: z.string(), model: z.string() }),
  ),
  startedAt: z.string(),
  finishedAt: z.string(),
  outcome: z.enum([
    "ended",
    "stalled",
    "failed",
    "budget-stopped",
    "timed-out",
  ]),
  failedJobId: z.string().optional(),
  /** Set when the scripted seat ended the run: `seat-exhausted`. */
  stallReason: z.string().optional(),
  moves: z.object({
    committed: z.number().int().min(0),
    refusals: z.array(
      z.object({ moveIndex: z.number().int().min(0), code: z.string() }),
    ),
  }),
  spend: z
    .object({
      calls: z.number().int(),
      inputTokens: z.number().int(),
      outputTokens: z.number().int(),
      costUsd: z.number().nullable(),
      ceilingUsd: z.number().nullable(),
    })
    .optional(),
  scriptRemaining: z
    .object({
      calls: z.record(z.string(), z.number().int()),
      dice: z.number().int(),
    })
    .optional(),
});
export type RunManifest = z.infer<typeof RunManifestSchema>;
