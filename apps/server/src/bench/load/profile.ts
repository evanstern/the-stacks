import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";

/**
 * Load bench profiles (specs/021-load-bench data-model.md "Profile"). A
 * profile is committed JSON under `apps/server/bench/load/profiles/`,
 * loaded and validated before a run ever touches a database or network.
 */

export const TierSchema = z.enum(["commit", "demand", "dev"]);
export type Tier = z.infer<typeof TierSchema>;

function strictlyAscending(values: number[]): boolean {
  return values.every((value, i) => i === 0 || value > values[i - 1]);
}

const IngestThresholdsSchema = z.object({
  throughputFloor: z.number().gt(0).lt(1),
  serviceMultiple: z.number().gt(1),
  enqueueMultiple: z.number().gt(1),
});

const IngestProfileSchema = z.object({
  volumes: z.array(z.number().int().positive()).min(2),
  workers: z.array(z.number().int().min(1).max(8)).min(1),
  docBytes: z.number().int().min(1024).max(1_048_576),
  historyRows: z.number().int().min(0),
  stepTimeoutMs: z.number().int().positive(),
  thresholds: IngestThresholdsSchema,
});

const ConcurrencyThresholdsSchema = z.object({
  latencyMultiple: z.number().gt(1),
  errorRate: z.number().min(0).max(1),
});

const ConcurrencyProfileSchema = z.object({
  users: z.array(z.number().int().positive()).min(2),
  durationMs: z.number().int().positive(),
  thinkMs: z.number().int().min(0),
  wsSend: z.boolean(),
  thresholds: ConcurrencyThresholdsSchema,
});

const ExhaustionProfileSchema = z.object({
  holdMs: z.number().int().positive(),
  recoverTimeoutMs: z.number().int().positive(),
});

const RestartProfileSchema = z.object({
  followers: z.number().int().min(0),
  reclaimTimeoutMs: z.number().int().positive(),
});

const DEV_MAX_USERS = 25;
const DEV_MAX_TOTAL_DURATION_MS = 180_000;

export const ProfileSchema = z
  .object({
    tier: TierSchema,
    ingest: IngestProfileSchema.optional(),
    concurrency: ConcurrencyProfileSchema.optional(),
    exhaustion: ExhaustionProfileSchema.optional(),
    restart: RestartProfileSchema.optional(),
  })
  .superRefine((profile, ctx) => {
    if (profile.ingest && !strictlyAscending(profile.ingest.volumes)) {
      ctx.addIssue({
        code: "custom",
        path: ["ingest", "volumes"],
        message: "ingest.volumes must be strictly ascending",
      });
    }
    if (profile.concurrency && !strictlyAscending(profile.concurrency.users)) {
      ctx.addIssue({
        code: "custom",
        path: ["concurrency", "users"],
        message: "concurrency.users must be strictly ascending",
      });
    }
    if (profile.tier === "dev" && profile.concurrency) {
      const { users, durationMs, wsSend } = profile.concurrency;
      if (Math.max(...users) > DEV_MAX_USERS) {
        ctx.addIssue({
          code: "custom",
          path: ["concurrency", "users"],
          message: `dev profile users must be <= ${DEV_MAX_USERS}`,
        });
      }
      if (users.length * durationMs > DEV_MAX_TOTAL_DURATION_MS) {
        ctx.addIssue({
          code: "custom",
          path: ["concurrency", "durationMs"],
          message: `dev profile total duration must be <= ${DEV_MAX_TOTAL_DURATION_MS}ms`,
        });
      }
      if (wsSend !== false) {
        ctx.addIssue({
          code: "custom",
          path: ["concurrency", "wsSend"],
          message: "dev profile wsSend must be false",
        });
      }
    }
  });

export type Profile = z.infer<typeof ProfileSchema>;

/** Reads and validates a profile file. Throws (ZodError or a read error) on failure. */
export function loadProfile(path: string): Profile {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return ProfileSchema.parse(raw);
}

/** Sorts object keys recursively so JSON.stringify is order-independent. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** sha-256 hex of the profile's canonical (sorted-key) JSON. */
export function profileHash(profile: Profile): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(profile)))
    .digest("hex");
}
